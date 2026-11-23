import React from "react";
import { Link } from "react-router-dom";
import { Star, Share2 } from "lucide-react";
import { MoviePoster } from "./MoviePoster";

export interface MovieItem {
  uri: string;
  id: string;
  title: string;
  genres: string[];
  imdbId?: string;
  tmdbId?: string;
  avgRating?: number;
}

interface MovieCardProps {
  movie: MovieItem;
}

export const MovieCard: React.FC<MovieCardProps> = ({ movie }) => {
  return (
    <div className="group border-2 border-black bg-white shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all flex flex-col justify-between">
      <div className="space-y-2">
        {/* Poster */}
        <div className="relative overflow-hidden bg-slate-900 border-b-2 border-black">
          <Link to={`/movies/${movie.id}`}>
            <MoviePoster
              title={movie.title}
              tmdbId={movie.tmdbId}
              imdbId={movie.imdbId}
              genres={movie.genres}
              size="sm"
            />
          </Link>
          {movie.avgRating !== undefined && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 border-2 border-black bg-[#ccff00] text-black text-xs font-mono font-black shadow-[1.5px_1.5px_0px_0px_#000] pointer-events-none">
              <Star className="w-3 h-3 fill-black text-black stroke-[2.5]" />
              <span>{movie.avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Movie Title & Genres */}
        <div className="px-3 pt-1.5 space-y-1.5">
          <Link
            to={`/movies/${movie.id}`}
            title={movie.title}
            className="font-black text-black text-sm line-clamp-2 hover:underline leading-snug uppercase tracking-tight"
          >
            {movie.title}
          </Link>

          <div className="flex flex-wrap gap-1">
            {movie.genres.slice(0, 2).map((g, idx) => (
              <span
                key={idx}
                className="text-xs font-bold px-2 py-0.5 border border-black bg-white text-black shadow-[1px_1px_0px_0px_#000] truncate max-w-[100px]"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-3 pt-2 mt-2 border-t-2 border-black flex items-center justify-between text-xs bg-slate-50">
        <Link
          to={`/movies/${movie.id}`}
          className="flex items-center gap-1.5 font-black text-xs text-black hover:text-[#042f2e] uppercase tracking-wide transition-colors"
        >
          <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Graph</span>
        </Link>

        <div className="flex items-center gap-2">
          {movie.imdbId && (
            <a
              href={`https://www.imdb.com/title/tt${movie.imdbId.padStart(7, "0")}`}
              target="_blank"
              rel="noreferrer"
              title="IMDb"
              className="font-bold text-black border border-black bg-white hover:bg-[#ccff00] px-1.5 py-0.5 shadow-[1px_1px_0px_0px_#000] transition-colors"
            >
              IMDb
            </a>
          )}
          {movie.tmdbId && (
            <a
              href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
              target="_blank"
              rel="noreferrer"
              title="TMDb"
              className="font-bold text-black border border-black bg-white hover:bg-[#ccff00] px-1.5 py-0.5 shadow-[1px_1px_0px_0px_#000] transition-colors"
            >
              TMDb
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
