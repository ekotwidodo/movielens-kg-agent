import React, { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import cytoscape from "cytoscape";
import { executeSparql } from "../api/client";
import { PREFIXES, movieUri as buildMovieUri } from "../api/vocabulary";
import { 
  ArrowLeft, 
  Star, 
  Tag, 
  ExternalLink, 
  Share2, 
  Loader2 
} from "lucide-react";
import { MoviePoster } from "../components/MoviePoster";

export const MovieDetail: React.FC = () => {
  const { movieId } = useParams<{ movieId: string }>();
  const [loading, setLoading] = useState(true);
  const [movie, setMovie] = useState<{
    uri: string;
    title: string;
    genres: string[];
    imdbId?: string;
    tmdbId?: string;
    avgRating?: number;
    ratingCount?: number;
    tags: Array<{ name: string; count: number }>;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  useEffect(() => {
    if (!movieId) return;

    const fetchMovieData = async () => {
      setLoading(true);
      const movieUri = buildMovieUri(movieId);

      const metaQuery = `
        ${PREFIXES}

        SELECT ?title ?imdbId ?tmdbId ?avgRating ?ratingCount
               (GROUP_CONCAT(DISTINCT ?genreLabel; separator=", ") AS ?genres)
        WHERE {
          <${movieUri}> a ml:Movie ;
                        ml:title ?title .
          OPTIONAL { <${movieUri}> ml:averageRating ?avgRating }
          OPTIONAL { <${movieUri}> ml:ratingCount ?ratingCount }
          OPTIONAL { <${movieUri}> ml:hasGenre ?genre . ?genre ml:genreLabel ?genreLabel }
          OPTIONAL { <${movieUri}> ml:imdbId ?imdbId }
          OPTIONAL { <${movieUri}> ml:tmdbId ?tmdbId }
        }
        GROUP BY ?title ?imdbId ?tmdbId ?avgRating ?ratingCount
      `;

      const tagQuery = `
        ${PREFIXES}
        SELECT ?tagContent (COUNT(?tag) AS ?count)
        WHERE {
          ?tag ml:taggedMovie <${movieUri}> ;
               ml:tagText ?tagContent .
        }
        GROUP BY ?tagContent
        ORDER BY DESC(?count)
        LIMIT 10
      `;

      try {
        const [metaRes, tagRes] = await Promise.all([
          executeSparql(metaQuery),
          executeSparql(tagQuery),
        ]);

        const b = metaRes.results.bindings[0];
        if (b) {
          const genresStr = b.genres?.value || "";
          const tags = tagRes.results.bindings.map((t) => ({
            name: t.tagContent?.value || "",
            count: parseInt(t.count?.value || "1", 10),
          }));

          const data = {
            uri: movieUri,
            title: b.title?.value || "Movie Detail",
            genres: genresStr ? genresStr.split(", ") : [],
            imdbId: b.imdbId?.value,
            tmdbId: b.tmdbId?.value,
            avgRating: b.avgRating ? parseFloat(b.avgRating.value) : undefined,
            ratingCount: b.ratingCount ? parseInt(b.ratingCount.value, 10) : 0,
            tags,
          };
          setMovie(data);
        }
      } catch (err) {
        console.error("Failed to load movie details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieData();
  }, [movieId]);

  const initCytoscape = (data: {
    uri: string;
    title: string;
    genres: string[];
    tags: Array<{ name: string; count: number }>;
  }) => {
    if (!containerRef.current) return;

    const elements: cytoscape.ElementDefinition[] = [];

    // Center Movie Node (Deep Teal)
    elements.push({
      data: {
        id: "center_movie",
        label: data.title,
        color: "#0D9488",
        size: 50,
      },
    });

    // Genre Nodes (Emerald)
    data.genres.forEach((genre, idx) => {
      const gId = `genre_${idx}`;
      elements.push({
        data: { id: gId, label: genre, color: "#10B981", size: 34 },
      });
      elements.push({
        data: {
          id: `edge_genre_${idx}`,
          source: "center_movie",
          target: gId,
          label: "hasGenre",
        },
      });
    });

    // Tag Nodes (Turquoise)
    data.tags.slice(0, 6).forEach((tag, idx) => {
      const tId = `tag_${idx}`;
      elements.push({
        data: { id: tId, label: `"${tag.name}"`, color: "#14B8A6", size: 28 },
      });
      elements.push({
        data: {
          id: `edge_tag_${idx}`,
          source: "center_movie",
          target: tId,
          label: "taggedWith",
        },
      });
    });

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            label: "data(label)",
            color: "#0f172a",
            "font-size": "10px",
            "font-weight": 500,
            "text-valign": "bottom",
            "text-margin-y": 4,
            width: "data(size)",
            height: "data(size)",
            "border-width": 2,
            "border-color": "#ffffff",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": "#cbd5e1",
            "target-arrow-color": "#0d9488",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": "8px",
            color: "#64748b",
            "text-rotation": "autorotate",
            "text-margin-y": -4,
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        padding: 30,
      },
    });
  };

  useEffect(() => {
    if (loading || !movie) return;

    initCytoscape({
      uri: movie.uri,
      title: movie.title,
      genres: movie.genres,
      tags: movie.tags,
    });

    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [loading, movie]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-2 text-slate-400">
        <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
        <p className="text-xs">Loading movie facts from Knowledge Graph...</p>
      </div>
    );
  }

  if (!movie) {
    return (
      <div className="max-w-7xl mx-auto py-16 px-4 text-center space-y-3">
        <p className="text-sm text-slate-600">Movie not found in Knowledge Graph.</p>
        <Link to="/movies" className="inline-flex items-center gap-1.5 text-xs text-teal-700 font-semibold">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to catalog</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button */}
      <Link
        to="/movies"
        className="neo-btn-white px-3.5 py-1.5 text-xs font-black uppercase tracking-wider"
      >
        <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
        <span>Back to Movie Catalog</span>
      </Link>

      {/* Main Grid: Details on Left, Mini Graph on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Metadata */}
        <div className="lg:col-span-5 space-y-4">
          <div className="neo-box p-6 space-y-5">
            {/* 2:3 Movie Poster */}
            <div className="w-full max-w-[280px] mx-auto border-2 border-black shadow-[3px_3px_0px_0px_#000] overflow-hidden">
              <MoviePoster
                title={movie.title}
                tmdbId={movie.tmdbId}
                imdbId={movie.imdbId}
                genres={movie.genres}
                size="lg"
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono font-bold text-black border border-black bg-white px-2 py-0.5">
                ID: {movieId}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-black uppercase tracking-tight leading-snug pt-1">
                {movie.title}
              </h1>
            </div>

            {/* Ratings Aggregate */}
            <div className="p-4 border-2 border-black bg-[#ccff00] shadow-[2px_2px_0px_0px_#000] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Star className="w-5 h-5 text-black fill-black stroke-[2.5]" />
                <div>
                  <div className="text-xl font-black text-black font-mono">
                    {movie.avgRating !== undefined ? `${movie.avgRating.toFixed(2)} / 5.0` : "No ratings"}
                  </div>
                  <div className="text-xs font-bold text-black/80">
                    From {movie.ratingCount?.toLocaleString()} verified ratings
                  </div>
                </div>
              </div>
            </div>

            {/* Genres */}
            <div className="space-y-1.5">
              <div className="text-xs font-black uppercase text-black/70 tracking-wider flex items-center justify-between">
                <span>Genres</span>
                <span className="text-xs text-black/60 font-medium">Click to browse</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {movie.genres.map((g, idx) => (
                  <Link
                    key={idx}
                    to={`/movies?genre=${encodeURIComponent(g)}`}
                    className="text-xs font-extrabold uppercase px-3 py-1 border-2 border-black bg-white text-black hover:bg-[#ccff00] shadow-[1.5px_1.5px_0px_0px_#000] transition-colors"
                    title={`Browse all ${g} movies in catalog`}
                  >
                    <span>{g}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Tags */}
            {movie.tags.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-black uppercase text-black/70 tracking-wider">
                  <div className="flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Community Tags</span>
                  </div>
                  <span className="text-xs text-black/60 font-medium">Click to browse</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {movie.tags.map((t, idx) => (
                    <Link
                      key={idx}
                      to={`/movies?tag=${encodeURIComponent(t.name)}`}
                      className="text-xs font-bold px-2.5 py-1 border border-black bg-white text-black hover:bg-[#ccff00] shadow-[1px_1px_0px_0px_#000] transition-colors inline-flex items-center gap-1"
                      title={`Browse movies tagged with "${t.name}"`}
                    >
                      <span>#{t.name}</span>
                      <span className="text-slate-500 font-mono">({t.count})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* External Links */}
            <div className="pt-3 border-t-2 border-black flex items-center gap-2">
              {movie.imdbId && (
                <a
                  href={`https://www.imdb.com/title/tt${movie.imdbId.padStart(7, "0")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="neo-btn-white px-3 py-1 text-xs font-bold"
                >
                  <span>View on IMDb</span>
                  <ExternalLink className="w-3 h-3 stroke-[2.5]" />
                </a>
              )}
              {movie.tmdbId && (
                <a
                  href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="neo-btn-white px-3 py-1 text-xs font-bold"
                >
                  <span>View on TMDb</span>
                  <ExternalLink className="w-3 h-3 stroke-[2.5]" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Embedded Cytoscape Neighborhood Graph */}
        <div className="lg:col-span-7 space-y-2">
          <div className="neo-box overflow-hidden flex flex-col h-[480px]">
            <div className="px-4 py-3 border-b-2 border-black flex items-center justify-between bg-white">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 border-2 border-black bg-[#ccff00] flex items-center justify-center text-black font-black">
                  <Share2 className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span className="font-black text-black text-xs uppercase tracking-tight">
                  Neighborhood Subgraph (1-Hop)
                </span>
              </div>
              <Link
                to={`/explore?startUri=${encodeURIComponent(movie.uri)}`}
                className="neo-btn-white px-2.5 py-1 text-xs font-bold"
              >
                <span>Open in Explorer</span>
                <ExternalLink className="w-3 h-3 stroke-[2.5]" />
              </Link>
            </div>

            {/* Canvas */}
            <div className="flex-1 w-full bg-slate-50/50 relative">
              <div ref={containerRef} className="w-full h-full" />
            </div>

            {/* Subgraph Legend */}
            <div className="px-4 py-2 bg-white border-t-2 border-black flex items-center gap-4 text-xs font-bold text-black">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border border-black bg-[#042f2e]" />
                <span>Movie</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border border-black bg-[#ccff00]" />
                <span>Genre</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
