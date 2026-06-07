# Study: Caching Opportunities in Production Code

## Hypothesis
Many Node.js applications perform repeatable data retrievals or computations without caching, creating low-hanging performance wins.

## Research Questions
1. How often do apps execute identical API or database calls inside the same request flow?
2. Where do repeated pure function computations appear in source code?
3. How often do GraphQL queries or HTTP fetches repeat with the same parameters?
4. Which caching strategies are the best fit for each class of opportunity?

## Methodology
### Data Collection
- Sample size: 400 applications or codebases
- Selection criteria: Node.js backends, frontend data layers, API clients
- Data sources: GitHub repositories, open-source Node.js projects, published examples

### Detection Methods
- Static code scanning of JS/TS/JSX/TSX sources
- AST-based identification of repeated network, DB, and computation calls
- Query signature normalization for HTTP, GraphQL, and ORM methods
- Local corpus scanning through `npm run scan:corpus` against pre-cloned repositories

### Analysis Methods
- Summary of findings by category and severity
- Top files and call signatures by distinct finding count and repeated occurrence count
- Correlation with framework usage (Express, Next.js, Apollo, Prisma, Sequelize)
- Recommendation mapping to cache strategies

### Validation
- Manual review of high-frequency findings
- Reasonableness checks for false positives
- Reproducibility through the scan/analyze/report pipeline
- Corpus manifest review for missing local clones and scan errors

## Timeline
- Day 1: Build scanner and classification rules
- Day 2: Run corpus scans and collect results
- Day 3: Analyze data and generate summary report
- Day 4: Produce article, visuals, and recommendations

## Expected Outputs
- Scan results JSON for repository findings
- Aggregated summary report with category counts
- Markdown report with cache strategy recommendations
- Example cache opportunity cases
- `results/corpus/manifest.json` documenting corpus scan coverage
