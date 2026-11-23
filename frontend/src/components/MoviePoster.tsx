import React, { useEffect, useState } from "react";
import { Film, Sparkles } from "lucide-react";

interface MoviePosterProps {
  title: string;
  tmdbId?: string;
  imdbId?: string;
  genres?: string[];
  className?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
}

// Global in-memory cache to prevent repeated network requests across renders
const posterCache = new Map<string, string | null>();

export const MoviePoster: React.FC<MoviePosterProps> = ({
  title,
  tmdbId,
  imdbId,
  genres = [],
  className = "",
  alt,
  size = "md",
}) => {
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  // Extract clean title and release year (e.g. "Heat (1995)" -> "Heat", "1995")
  const yearMatch = title.match(/\((\d{4})\)/);
  const year = yearMatch ? yearMatch[1] : null;
  const cleanTitle = title.replace(/\s*\(\d{4}\)$/, "").trim();
  const cacheKey = tmdbId ? `tmdb_${tmdbId}` : imdbId ? `imdb_${imdbId}` : `title_${title}`;

  useEffect(() => {
    let isMounted = true;

    // Check memory cache first
    if (posterCache.has(cacheKey)) {
      const cached = posterCache.get(cacheKey) || null;
      setPosterUrl(cached);
      setLoading(false);
      return;
    }

    // Check sessionStorage
    try {
      const sessionCached = sessionStorage.getItem(`poster_${cacheKey}`);
      if (sessionCached) {
        posterCache.set(cacheKey, sessionCached);
        setPosterUrl(sessionCached);
        setLoading(false);
        return;
      }
    } catch {
      // Ignore storage errors in private browsing
    }

    const fetchPoster = async () => {
      // 1. Try TMDB API if user or environment provided a TMDB API key
      const tmdbKey =
        localStorage.getItem("tmdb_api_key") ||
        (import.meta.env.VITE_TMDB_API_KEY as string | undefined);

      if (tmdbKey && tmdbId) {
        try {
          const res = await fetch(
            `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.poster_path) {
              const fullUrl = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
              if (isMounted) {
                setPosterUrl(fullUrl);
                posterCache.set(cacheKey, fullUrl);
                try {
                  sessionStorage.setItem(`poster_${cacheKey}`, fullUrl);
                } catch {}
                setLoading(false);
                return;
              }
            }
          }
        } catch {
          // Fall through to open fallback
        }
      }

      // 2. Open Fallback via Wikipedia REST API (Free, no API key needed, high reliability)
      try {
        const variants = [
          year ? `${cleanTitle.replace(/\s+/g, "_")}_(${year}_film)` : null,
          `${cleanTitle.replace(/\s+/g, "_")}_(film)`,
          cleanTitle.replace(/\s+/g, "_"),
        ].filter((v): v is string => Boolean(v));

        for (const variant of variants) {
          const wikiRes = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(variant)}`,
            { headers: { Accept: "application/json" } }
          );

          if (wikiRes.ok) {
            const wikiData = await wikiRes.json();
            if (wikiData.thumbnail?.source) {
              const img = wikiData.thumbnail.source;
              if (isMounted) {
                setPosterUrl(img);
                posterCache.set(cacheKey, img);
                try {
                  sessionStorage.setItem(`poster_${cacheKey}`, img);
                } catch {}
                setLoading(false);
                return;
              }
            }
          }
        }
      } catch {
        // Fallback to placeholder
      }

      if (isMounted) {
        posterCache.set(cacheKey, null);
        setLoading(false);
      }
    };

    fetchPoster();

    return () => {
      isMounted = false;
    };
  }, [cacheKey, cleanTitle, year, tmdbId]);

  const primaryGenre = genres.length > 0 ? genres[0] : null;

  return (
    <div
      className={`relative w-full aspect-[2/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-md flex flex-col justify-between select-none ${className}`}
    >
      {/* Real Poster Image (when found and not errored) */}
      {posterUrl && !imgError && (
        <img
          src={posterUrl}
          alt={alt || title}
          loading="lazy"
          onError={() => setImgError(true)}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}

      {/* Modern 2:3 Placeholder Poster (shown when loading, errored, or no poster found) */}
      {(!posterUrl || imgError) && (
        <div className="absolute inset-0 flex flex-col justify-between p-3.5 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-slate-100">
          {/* Top Bar: Brand & Year Pill */}
          <div className="flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5 opacity-90">
              <Film className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs font-mono tracking-wider font-semibold text-slate-200 uppercase">
                MovieLens
              </span>
            </div>
            {year && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800/90 border border-slate-700 text-teal-300">
                {year}
              </span>
            )}
          </div>

          {/* Center Graphic & Title */}
          <div className="flex flex-col items-center justify-center text-center my-auto py-2 z-10">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center mb-2.5 shadow-sm group-hover:border-teal-500/50 transition-colors">
              <Film className="w-6 h-6 text-teal-400/90" />
            </div>
            <p
              className={`font-bold text-slate-100 leading-snug line-clamp-3 px-1 ${
                size === "lg" ? "text-base sm:text-lg" : "text-sm sm:text-base"
              }`}
            >
              {cleanTitle}
            </p>
          </div>

          {/* Bottom Bar: Genre Pill or Placeholder Notice */}
          <div className="flex items-center justify-center gap-1 pt-2 border-t border-slate-800/80 z-10">
            {primaryGenre ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-950/85 text-teal-200 border border-teal-800/60 truncate max-w-full">
                {primaryGenre}
              </span>
            ) : (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>Feature Film</span>
              </span>
            )}
          </div>

          {/* Subtle Film Strip Pattern Accent on Background */}
          <div className="absolute inset-0 bg-radial from-transparent to-black/40 pointer-events-none" />
        </div>
      )}

      {/* Subtle Loading Shimmer when actively fetching */}
      {loading && !posterUrl && (
        <div className="absolute inset-0 bg-slate-800/50 animate-pulse pointer-events-none" />
      )}
    </div>
  );
};
