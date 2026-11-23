# Dataset Usage

## Source

| Item | Value |
|---|---|
| Dataset | MovieLens Latest Small (`ml-latest-small`) |
| Publisher | GroupLens Research, University of Minnesota |
| Dataset page | <https://grouplens.org/datasets/movielens/latest/> |
| README | <https://files.grouplens.org/datasets/movielens/ml-latest-small-README.html> |
| Published contents (README) | 100,836 ratings, 3,683 tag applications, 9,742 movies, 610 users; generated 26 September 2018 |

The importer never assumes these numbers. It counts the rows of the files it
receives and writes the counts to the import report.

**Important caveat:** GroupLens calls this a *development* dataset. It may
change over time and is not meant for shared research results. For formal
experiments later, use a stable (benchmark) MovieLens release and record its
checksums.

## How to get the data

1. Download `ml-latest-small.zip` from the official dataset page.
2. Extract it so that the CSV files are in `datasets/ml-latest-small/`:

   ```text
   datasets/ml-latest-small/
   ├── README.txt
   ├── links.csv      (optional)
   ├── movies.csv     (required)
   ├── ratings.csv    (required)
   └── tags.csv       (optional)
   ```

3. Create the local manifest:

   ```bash
   cp datasets/manifest.example.json datasets/ml-latest-small/manifest.json
   ```

   Then fill in `snapshot_id` and `retrieval_date` (the day you downloaded the
   files). The manifest is stored in the graph as dataset provenance.

The import report also records a SHA-256 checksum of every source file, so a
specific download can be identified later.

## Handling rules

- Raw MovieLens files are **not** committed. `datasets/*/` is in `.gitignore`.
- Generated RDF files and reports (`data/`) are **not** committed either.
- The software does not scrape movielens.org and does not fetch anything from
  IMDb or TMDb. `imdbId` and `tmdbId` are stored as plain identifiers.
- Original MovieLens IDs are kept as source identifiers.
- User IDs are anonymized, dataset-local identifiers. They must not be used to
  re-identify people or to guess demographic information. No user data is
  added.
- Publishing the RDF conversion may count as redistribution. Check the current
  GroupLens terms before doing so. The public SPARQL endpoint should be treated
  the same way.
- This project is not endorsed by GroupLens or the University of Minnesota.

## Usage license (summary)

The full terms are in `README.txt` inside the downloaded archive. In short, the
dataset may be used for research purposes if:

- you do not state or imply endorsement by the University of Minnesota or the
  GroupLens Research Group;
- you acknowledge the dataset in publications (see the citation below);
- any redistribution, including transformations, uses the same license
  conditions;
- you do not use it for commercial or revenue-bearing purposes without
  permission from GroupLens.

## Citation

> F. Maxwell Harper and Joseph A. Konstan. 2015. The MovieLens Datasets:
> History and Context. ACM Transactions on Interactive Intelligent Systems
> (TiiS) 5, 4: 19:1–19:19. <https://doi.org/10.1145/2827872>
