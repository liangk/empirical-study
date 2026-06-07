# Study 11: Caching Opportunities in Production Code

A practical empirical study that finds missed caching opportunities in Node.js applications, quantifies their impact, and recommends cache strategies by use case.

## Status
ACTIVE - Performance Multiplier

## Objectives
- Detect repeated API calls and redundant data fetches
- Identify repeatable pure function computations
- Find duplicate database queries and GraphQL query reuse
- Compare caching strategies across in-memory, Redis, CDN, browser, and GraphQL

## Structure
- [content/](content/): Study reports, draft findings, and case summaries
- [data/](data/): Scan results, aggregated datasets, and supporting data
- [docs/](docs/): Research protocol, detection design, and methodology
- [results/](results/): Generated summaries, markdown reports, and charts
- [src/](src/): Scan, analyze, and report generation code

## Getting Started
1. Install dependencies: `npm install`
2. Validate TypeScript: `npm run check`
3. Scan a repository: `npm run scan -- --path <repo-path> --output results/cache-opportunities.json`
4. Analyze findings: `npm run analyze -- --input results/cache-opportunities.json --output results/summary.json`
5. Generate report: `npm run report -- --analysis results/summary.json --output results/cache-opportunities-report.md`

## Running the Corpus
By default the corpus runner reads `data/corpus.md`, stores local clones under `.repos/`, and clones repositories that are not already present. Add `--skip-clone` to scan only repositories that already exist locally.

Supported local clone layouts:
- `.repos/<repo>`
- `.repos/<owner>__<repo>`
- `.repos/<owner>-<repo>`
- `.repos/<owner>/<repo>`

Small clone-and-scan smoke run:

```bash
npm run scan:corpus -- --corpus data/corpus.md --max-repos 5 --output-dir results/corpus --aggregate-output results/cache-opportunities-corpus.json
```

Full local corpus run:

```bash
npm run scan:corpus -- --corpus data/corpus.md --output-dir results/corpus --aggregate-output results/cache-opportunities-corpus.json
npm run analyze -- --input results/cache-opportunities-corpus.json --output results/summary.json
npm run report -- --analysis results/summary.json --output results/cache-opportunities-report.md
```

The corpus scan also writes `results/corpus/manifest.json` with scanned, missing, and errored repositories.

Useful options:
- `--repos-dir <path>`: local clone directory, default `.repos`.
- `--skip-clone`: do not clone missing repositories; scan existing local clones only.
- `--clone-depth <n>`: shallow clone depth, default `1`.
- `--max-repos <n>`: scan only the first `n` repositories from the corpus.

## Output Fields
Each finding includes the first location, normalized signature, category, severity, `occurrenceCount`, and the complete list of repeated occurrences. The analyzer reports both distinct findings and total repeated call occurrences.

## Notes
This study is designed to bootstrap a reproducible caching opportunity analysis workflow for real repositories.
