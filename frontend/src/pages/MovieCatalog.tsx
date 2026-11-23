import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { executeSparql } from "../api/client";
import { PREFIXES } from "../api/vocabulary";
import { Search, Loader2, Tag as TagIcon, X } from "lucide-react";
import { MovieCard, MovieItem } from "../components/MovieCard";

type Movie = MovieItem;

const PAGE_SIZE = 24;

export const MovieCatalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlGenre = searchParams.get("genre");
  const urlTag = searchParams.get("tag");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenres, setSelectedGenres] = useState<string[]>(urlGenre ? [urlGenre] : []);
  const [selectedTag, setSelectedTag] = useState<string | null>(urlTag || null);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const observerTarget = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);

  // Sync state if URL query params change (e.g. user navigated from MovieDetail)
  useEffect(() => {
    const g = searchParams.get("genre");
    const t = searchParams.get("tag");
    if (g && !selectedGenres.includes(g)) {
      setSelectedGenres([g]);
    } else if (!g && selectedGenres.length === 1 && selectedGenres[0] === urlGenre) {
      // url param cleared
    }
    if (t !== selectedTag) {
      setSelectedTag(t || null);
    }
  }, [searchParams]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) => {
      const next = prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre];
      const newParams = new URLSearchParams(searchParams);
      if (next.length === 1) {
        newParams.set("genre", next[0]);
      } else {
        newParams.delete("genre");
      }
      setSearchParams(newParams);
      return next;
    });
  };

  const clearAllFilters = () => {
    setSelectedGenres([]);
    setSelectedTag(null);
    setSearchTerm("");
    setSearchParams(new URLSearchParams());
  };

  const removeTagFilter = () => {
    setSelectedTag(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("tag");
    setSearchParams(newParams);
  };

  const fetchGenres = async () => {
    const query = `
      ${PREFIXES}

      SELECT DISTINCT ?label
      WHERE {
        ?genre a ml:Genre ;
               ml:genreLabel ?label .
      }
      ORDER BY ?label
    `;

    try {
      const res = await executeSparql(query);
      setGenres(
        res.results.bindings
          .map((b) => b.label?.value)
          .filter((value): value is string => Boolean(value))
      );
    } catch (err) {
      console.error("Genre query error:", err);
    }
  };

  const fetchMoviesBatch = async (currentOffset: number, isInitial = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (isInitial) {
      setLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }

    const hasSearch = searchTerm.trim().length > 0;
    const hasGenre = selectedGenres.length > 0;
    const hasTag = Boolean(selectedTag && selectedTag.trim().length > 0);

    const filterConditions: string[] = [];
    if (hasSearch) {
      const sanitized = searchTerm.trim().replace(/"/g, '\\"');
      filterConditions.push(`FILTER(CONTAINS(LCASE(?title), LCASE("${sanitized}")))`);
    }
    if (hasGenre) {
      selectedGenres.forEach((genre, index) => {
        const sanitized = genre.replace(/"/g, '\\"');
        filterConditions.push(
          `?genreNode${index} a ml:Genre ; ml:genreLabel "${sanitized}" . ?movie ml:hasGenre ?genreNode${index} .`
        );
      });
    }
    if (hasTag && selectedTag) {
      const sanitizedTag = selectedTag.trim().replace(/"/g, '\\"');
      filterConditions.push(
        `?tagAssignment ml:tagText "${sanitizedTag}" ; ml:taggedMovie ?movie .`
      );
    }

    // Only ORDER BY when we have a filter (sorting 80k+ rows times out).
    // Without filter, TDB2 returns in insertion order which is very fast.
    const orderClause = hasSearch || hasGenre || hasTag ? "ORDER BY ?title" : "";

    const query = `
      ${PREFIXES}

      SELECT ?movie ?title ?imdbId ?tmdbId ?avgRating (GROUP_CONCAT(DISTINCT ?genreLabel; SEPARATOR=", ") AS ?genres)
      WHERE {
        {
          SELECT ?movie ?title WHERE {
            ?movie a ml:Movie ;
                   ml:title ?title .
            ${filterConditions.join("\n            ")}
          }
          ${orderClause}
          LIMIT ${PAGE_SIZE}
          OFFSET ${currentOffset}
        }
        OPTIONAL { ?movie ml:averageRating ?avgRating }
        OPTIONAL {
          ?movie ml:hasGenre ?genre .
          ?genre ml:genreLabel ?genreLabel .
        }
        OPTIONAL { ?movie ml:imdbId ?imdbId }
        OPTIONAL { ?movie ml:tmdbId ?tmdbId }
      }
      GROUP BY ?movie ?title ?imdbId ?tmdbId ?avgRating
    `;

    try {
      const res = await executeSparql(query);
      const parsed: Movie[] = res.results.bindings.map((b) => {
        const uri = b.movie?.value || "";
        const id = uri.split("/").pop() || "";
        const genresStr = b.genres?.value || "";
        return {
          uri,
          id,
          title: b.title?.value || "Untitled",
          genres: genresStr ? genresStr.split(", ") : [],
          imdbId: b.imdbId?.value,
          tmdbId: b.tmdbId?.value,
          avgRating: b.avgRating ? parseFloat(b.avgRating.value) : undefined,
        };
      });

      if (isInitial) {
        setMovies(parsed);
      } else {
        setMovies((prev) => {
          const existing = new Set(prev.map((m) => m.uri));
          const unique = parsed.filter((m) => !existing.has(m.uri));
          return [...prev, ...unique];
        });
      }

      setOffset(currentOffset + parsed.length);
      if (parsed.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load movies from SPARQL endpoint.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchGenres();
  }, []);

  // When filters or search change, reset pagination and load first batch
  useEffect(() => {
    setHasMore(true);
    setOffset(0);
    const timer = setTimeout(() => {
      fetchMoviesBatch(0, true);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedGenres, selectedTag]);

  // IntersectionObserver for automatic lazy loading as user scrolls down
  useEffect(() => {
    if (loading || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && !isFetchingRef.current) {
          fetchMoviesBatch(offset, false);
        }
      },
      { threshold: 0.1, rootMargin: "350px" }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [loading, loadingMore, hasMore, offset, searchTerm, selectedGenres, selectedTag]);

  const hasAnyFilter = selectedGenres.length > 0 || selectedTag !== null || searchTerm.trim().length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Title & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 font-black text-xs uppercase tracking-wider bg-[#ccff00] text-black border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span>03 / KNOWLEDGE GRAPH ENTITIES</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-black uppercase tracking-tight leading-none mt-1">
            Movie Knowledge Graph Catalog
          </h1>
          <p className="text-xs sm:text-sm text-slate-800 font-medium">
            Search and explore 84,000+ movie entities directly from the RDF triplestore.
          </p>
        </div>
        {movies.length > 0 && (
          <div className="text-xs font-mono font-black text-black bg-[#ccff00] px-3.5 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] self-start sm:self-auto uppercase">
            Loaded: <span className="underline">{movies.length.toLocaleString()}</span> movies
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="neo-box p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-black absolute left-3 top-3.5 stroke-[2.5]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search movie title (e.g. Matrix, Toy Story, Pulp Fiction)..."
              className="w-full pl-9 pr-3 py-2.5 border-2 border-black bg-[#FAF8F5] focus:bg-white text-xs font-bold text-black outline-none shadow-[2px_2px_0px_0px_#000]"
            />
          </div>
          {hasAnyFilter && (
            <button
              onClick={clearAllFilters}
              className="neo-btn-white px-3 py-2 text-xs uppercase tracking-wider"
            >
              Clear All Filters
            </button>
          )}
        </div>

        {/* Active Tag Filter Pill */}
        {selectedTag && (
          <div className="flex items-center gap-2 pt-2 border-t-2 border-black">
            <span className="text-xs font-black uppercase text-black/70">Active Tag:</span>
            <span className="neo-badge">
              <TagIcon className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>#{selectedTag}</span>
              <button
                type="button"
                onClick={removeTagFilter}
                className="hover:text-red-600 cursor-pointer p-0.5"
                title="Remove tag filter"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            </span>
          </div>
        )}

        {/* Genre Filter Chips (multi-select) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t-2 border-black">
          <span className="text-xs font-black uppercase text-black/70 mr-1">Genres:</span>
          {genres.map((g) => (
            <button
              key={g}
              onClick={() => toggleGenre(g)}
              className={`text-xs px-3 py-1 border-2 border-black font-extrabold uppercase transition-all shadow-[1.5px_1.5px_0px_0px_#000] cursor-pointer ${selectedGenres.includes(g)
                  ? "bg-[#ccff00] text-black"
                  : "bg-white text-black hover:bg-slate-100"
                }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Movies Grid */}
      {loading && movies.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-2 text-slate-400">
          <Loader2 className="w-7 h-7 text-teal-600 animate-spin" />
          <p className="text-xs">Loading movies from Knowledge Graph...</p>
        </div>
      ) : movies.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
            {movies.map((m) => (
              <MovieCard key={m.uri} movie={m} />
            ))}
          </div>

          {/* Lazy Load Sentinel & Indicators */}
          <div ref={observerTarget} className="py-8 flex flex-col items-center justify-center min-h-[70px]">
            {loadingMore && (
              <div className="flex items-center gap-2 text-xs text-slate-600 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-xs">
                <Loader2 className="w-4 h-4 text-teal-600 animate-spin" />
                <span>Loading more movies ({movies.length.toLocaleString()} loaded)...</span>
              </div>
            )}

            {!hasMore && movies.length > 0 && (
              <div className="text-center py-4 text-xs text-slate-400">
                <p>Showing all {movies.length.toLocaleString()} matching movies from Knowledge Graph.</p>
              </div>
            )}

            {hasMore && !loadingMore && !loading && movies.length > 0 && (
              <button
                type="button"
                onClick={() => fetchMoviesBatch(offset, false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs cursor-pointer transition-all hover:border-teal-400"
              >
                Load More Movies ({PAGE_SIZE})
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500 space-y-1">
          <p className="font-medium text-slate-700 text-sm">No movies matched your search</p>
          <p className="text-xs text-slate-400">Try adjusting your search terms or clearing the genre/tag filters.</p>
        </div>
      )}
    </div>
  );
};
