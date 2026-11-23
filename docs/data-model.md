# RDF Data Model

This page describes how MovieLens CSV files map to RDF: the ontology classes,
properties, IRI rules, and datatypes.

The vocabulary and ontology schema are constructed by `backend/kg_builder.py`.
Both the graph builder and the agent's SPARQL prompt share this schema definition.

## Namespace and prefixes

The default namespace is a **placeholder** for the prototype and can be
changed with `MOVIELENS_NAMESPACE`. It is not a permanent public identifier.

```turtle
@prefix ml:   <https://example.org/movielens/> .
@prefix rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:  <http://www.w3.org/2001/XMLSchema#> .
@prefix dct:  <http://purl.org/dc/terms/> .
```

The Turtle output also binds short prefixes for resources, such as
`movie:` = `ml:` + `movie/`. They are only a shorter way to write the same IRIs.

## Classes

| Class | IRI pattern | Description |
|---|---|---|
| `ml:Movie` | `ml:` + `movie/{movieId}` | A movie represented in MovieLens. |
| `ml:User` | `ml:` + `user/{userId}` | An anonymized MovieLens user identifier. |
| `ml:Genre` | `ml:` + `genre/{slug}` | A genre category from the MovieLens genres field. |
| `ml:RatingEvent` | `ml:` + `rating/{event-key}` | A user's rating of a movie at a given time. |
| `ml:TagAssignment` | `ml:` + `tag-assignment/{event-key}` | A user-generated tag applied to a movie at a given time. |
| `ml:DatasetSnapshot` | `ml:` + `dataset/{snapshot_id}` | Metadata describing one imported dataset snapshot. |
| `ml:SourceFile` | `ml:` + `dataset/{snapshot_id}/source-file/{file}` | A CSV file that was used to build a dataset snapshot. |

## Properties

| Property | Domain | Range | Description |
|---|---|---|---|
| `ml:movieId` | `ml:Movie` | `xsd:integer` | Original MovieLens movieId. |
| `ml:userId` | `ml:User` | `xsd:integer` | Original anonymized userId. |
| `ml:title` | `ml:Movie` | `xsd:string` | Movie title as supplied, usually with the year. |
| `ml:hasGenre` | `ml:Movie` | `ml:Genre` | Connects a movie to a genre. |
| `ml:genreLabel` | `ml:Genre` | `xsd:string` | Original genre label, e.g. 'Sci-Fi'. |
| `ml:hasNoListedGenres` | `ml:Movie` | `xsd:boolean` | True when MovieLens lists '(no genres listed)' for the movie. |
| `ml:averageRating` | `ml:Movie` | `xsd:decimal` | Precomputed average rating score for this movie across all ratings (0.5 to 5.0). |
| `ml:ratingCount` | `ml:Movie` | `xsd:integer` | Precomputed total number of ratings received by this movie. |
| `ml:ratingEvent` | `ml:User` | `ml:RatingEvent` | Connects a user to a rating event. |
| `ml:ratedMovie` | `ml:RatingEvent` | `ml:Movie` | Movie receiving the rating. |
| `ml:ratingValue` | `ml:RatingEvent` | `xsd:decimal` | Rating value between 0.5 and 5.0. |
| `ml:ratingTimestamp` | `ml:RatingEvent` | `xsd:dateTime` | UTC time of the rating. |
| `ml:tagAssignment` | `ml:User` | `ml:TagAssignment` | Connects a user to a tag assignment. |
| `ml:taggedMovie` | `ml:TagAssignment` | `ml:Movie` | Movie receiving the tag. |
| `ml:tagText` | `ml:TagAssignment` | `xsd:string` | User-generated tag text, kept as-is. |
| `ml:tagTimestamp` | `ml:TagAssignment` | `xsd:dateTime` | UTC time of the tag assignment. |
| `ml:imdbId` | `ml:Movie` | `xsd:string` | IMDb identifier from links.csv (not fetched). |
| `ml:tmdbId` | `ml:Movie` | `xsd:string` | TMDb identifier from links.csv (not fetched). |
| `ml:sourceDataset` | `ml:Movie`, `ml:User`, `ml:Genre` | `ml:DatasetSnapshot` | Connects an entity resource to the snapshot it was imported from. |

### Provenance properties

| Property | Domain | Range | Description |
|---|---|---|---|
| `ml:releaseId` | `ml:DatasetSnapshot` | `xsd:string` | Dataset release, e.g. ml-latest-small. |
| `ml:retrievalDate` | `ml:DatasetSnapshot` | `xsd:date` | Date the files were downloaded. |
| `ml:importedAt` | `ml:DatasetSnapshot` | `xsd:dateTime` | Time the graph was built. |
| `ml:importerVersion` | `ml:DatasetSnapshot` | `xsd:string` | Version of this software. |
| `ml:usageTerms` | `ml:DatasetSnapshot` | `xsd:string` | Reference to the dataset usage terms. |
| `ml:hasSourceFile` | `ml:DatasetSnapshot` | `ml:SourceFile` | A file used for the snapshot. |
| `ml:fileName` | `ml:SourceFile` | `xsd:string` | Source file name. |
| `ml:rowCount` | `ml:SourceFile` | `xsd:integer` | Number of data rows in the file. |
| `ml:sha256` | `ml:SourceFile` | `xsd:string` | SHA-256 checksum of the file. |

The snapshot also uses `dct:identifier` (the `snapshot_id`), `dct:title`
(dataset name), `dct:source` (official
dataset page) and `rdfs:seeAlso` (official README).

The vocabulary itself is stored in the graph: every class is an `rdfs:Class`
and every property is an `rdf:Property`, with `rdfs:label`, `rdfs:comment`,
and (when there is a single one) `rdfs:domain` and `rdfs:range`.

### Design notes

- `ml:movieId` and `ml:userId` repeat the IDs that are already in the IRIs.
  This lets queries (and the agent) ask for "movie 1" without parsing IRIs.
- Provenance is recorded once per dataset snapshot (`ml:DatasetSnapshot` and
  `ml:SourceFile`), not per fact.
- `ml:sourceDataset` is set on movies, users, and genres only. Rating and tag
  events are not linked one by one; the snapshot already describes where they
  come from.

## IRI rules

All IRIs are created by one class: `ResourceIris` in
`src/movielens_kg_agent/domain/iris.py`.

| Resource | Rule | Example |
|---|---|---|
| Movie | original `movieId` | `ml:movie/1` |
| User | original anonymized `userId` | `ml:user/42` |
| Genre | slug of the label: lowercase ASCII, apostrophes removed, other non-alphanumerics become `-` | `Children's` → `ml:genre/childrens`, `Sci-Fi` → `ml:genre/sci-fi` |
| Rating event | first 32 hex characters of SHA-256 over `rating`, `userId`, `movieId`, rating (e.g. `4.0`), Unix timestamp | `ml:rating/61953833c70d013c801f5da161db379a` |
| Tag assignment | same, over `tag`, `userId`, `movieId`, original tag text, Unix timestamp | `ml:tag-assignment/…` |
| Dataset snapshot | `snapshot_id` from the manifest (letters, digits, `.`, `_`, `-`) | `ml:dataset/ml-latest-small-2026-11-17` |

Why hashes for events:

- The same source row always gives the same IRI, so importing twice does not
  create duplicates.
- Tag text is free user input. Hashing keeps it out of the IRI, so Unicode and
  punctuation can never break an IRI.

## Mapping rules

### `movies.csv` (required)

| Column | Becomes |
|---|---|
| `movieId` | the movie IRI and `ml:movieId` (`xsd:integer`) |
| `title` | `ml:title`, exactly as in the file |
| `genres` | split on `\|`; one `ml:hasGenre` link per label, and one `ml:Genre` resource per label with `ml:genreLabel` |
| `genres` = `(no genres listed)` | **no** genre resource; `ml:hasNoListedGenres true` instead |

Every movie gets `ml:hasNoListedGenres` (`true` or `false`).

### `ratings.csv` (required)

Each row becomes one `ml:RatingEvent`:

- `ml:ratedMovie` → the movie, `ml:ratingValue` as `xsd:decimal` (e.g. `4.0`),
  `ml:ratingTimestamp` as UTC `xsd:dateTime`.
- The user gets `ml:ratingEvent` → the event.

### `tags.csv` (optional)

Each row becomes one `ml:TagAssignment` with `ml:taggedMovie`, `ml:tagText`
(original text, not trimmed) and `ml:tagTimestamp`. The user gets
`ml:tagAssignment` → the assignment. The same tag text from another user or
at another time is a separate assignment.

### `links.csv` (optional)

`imdbId` and `tmdbId` are stored as strings (leading zeros are kept). An empty
value is left out of the graph; no identifier is ever invented. No data is
fetched from IMDb or TMDb.

### Users

A `ml:User` is created for every `userId` that appears in `ratings.csv` or
`tags.csv`. MovieLens has no user file and no user attributes.

## Validation rules

The importer checks every row and reports problems with file name, line
number, and column. In strict mode (the default) any problem stops the import
and the old graph file is kept.

| File | Rule |
|---|---|
| all | file is UTF-8; required columns exist; each row has the same number of fields as the header |
| movies | `movieId` positive integer and unique; `title` not empty; `genres` not empty |
| movies | two different genre labels must not produce the same slug |
| ratings | `userId`, `movieId` positive integers; movie exists; rating 0.5–5.0 in 0.5 steps; timestamp is whole seconds ≥ 0 |
| ratings | a duplicate event (same user, movie, rating, timestamp) is an error, never silently merged |
| tags | `userId`, `movieId` valid; movie exists; tag not empty; timestamp valid; a fully identical row is an error |
| links | `movieId` exists and appears once |

## Example

```turtle
movie:1 a ml:Movie ;
    ml:movieId 1 ;
    ml:title "Toy Story (1995)" ;
    ml:hasGenre genre:adventure, genre:animation, genre:children, genre:comedy, genre:fantasy ;
    ml:hasNoListedGenres false ;
    ml:imdbId "0114709" ;
    ml:tmdbId "862" ;
    ml:sourceDataset dataset:ml-latest-small-2026-11-17 .

genre:comedy a ml:Genre ;
    ml:genreLabel "Comedy" .

user:1 a ml:User ;
    ml:userId 1 ;
    ml:ratingEvent rating:61953833c70d013c801f5da161db379a .

rating:61953833c70d013c801f5da161db379a a ml:RatingEvent ;
    ml:ratedMovie movie:1 ;
    ml:ratingValue 4.0 ;
    ml:ratingTimestamp "2000-07-30T18:45:03+00:00"^^xsd:dateTime .
```

See [`examples/sparql/`](examples/sparql/) for tested example queries.
