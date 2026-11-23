/**
 * MovieLens graph vocabulary shared by every SPARQL view.
 *
 * Mirrors backend/domain/vocabulary.py: the namespace must be the same one used
 * to build the graph. Override it at build time with VITE_GRAPH_NAMESPACE
 * (Compose forwards MOVIELENS_NAMESPACE).
 */

export const GRAPH_NAMESPACE: string =
  import.meta.env.VITE_GRAPH_NAMESPACE || "https://example.org/movielens/";

export const RDFS_NAMESPACE = "http://www.w3.org/2000/01/rdf-schema#";

/** Announces the `ml:` and `rdfs:` prefixes on a query. */
export const PREFIXES = [
  `PREFIX ml: <${GRAPH_NAMESPACE}>`,
  `PREFIX rdfs: <${RDFS_NAMESPACE}>`,
].join("\n");

export const movieUri = (movieId: string): string => `${GRAPH_NAMESPACE}movie/${movieId}`;

export const userUri = (userId: string): string => `${GRAPH_NAMESPACE}user/${userId}`;

export const genreUri = (slug: string): string => `${GRAPH_NAMESPACE}genre/${slug}`;
