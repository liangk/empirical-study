# Detection Design for Caching Opportunity Study

This document describes the static detection rules used by the `11-caching` study scanner.

## Goals
- Identify repeated network requests in source code.
- Detect duplicate GraphQL queries that can benefit from response caching.
- Find repeated database operations that may be cached at the app/ORM layer.
- Surface repeated pure computations that can be memoized.

## Input
- JavaScript and TypeScript source files
- File types: `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`

## Scan Strategy
- Parse files with `@babel/parser` using `typescript` and `jsx` plugins.
- Traverse AST nodes to identify call expressions.
- Normalize call signatures so repeated call shapes are grouped.

## Detection Categories
### HTTP fetch reuse
- `fetch(url)` and `window.fetch(url)` calls
- Cacheable `GET` and `HEAD` request shapes
- `axios.get(...)`, `http.get(...)`, and similar URL/method signatures
- Client wrapper calls such as `api.get(...)` or `client.head(...)` when the object name suggests an HTTP client
- Obvious non-cacheable writes such as `POST`, `PUT`, and `DELETE` are excluded by default

### GraphQL query reuse
- `gql` tagged template literal definitions
- `client.query(...)`, `client.mutate(...)`, `watchQuery(...)`, and `execute(...)` invocations on GraphQL clients
- Queries are normalized by the raw query string or template literal content
- Object-form query calls such as ``client.query({ query: gql`...` })`` are normalized by the query document

### Database query reuse
- ORM / DB operations such as `prisma.*`, `db.query`, `knex.*`, `repository.*`, `model.*`
- Methods including `aggregate`, `count`, `execute`, `find`, `findAll`, `findById`, `findMany`, `findOne`, `findFirst`, `findUnique`, `query`, and `raw`
- Query arguments are normalized to preserve repeated query shapes

### Pure compute reuse
- Call sites using simple pure functions that are not labeled as common impure APIs
- Excludes known side-effect prefixes such as `get`, `fetch`, `load`, `save`, `update`, `delete`, `send`, `write`, `set`, and `clear`
- Only detects repeated calls with simple, serializable arguments

## Analysis Output
- Raw findings are written as JSON with fields:
  - `file`
  - `line`
  - `column`
  - `category`
  - `severity`
  - `message`
  - `signature`
  - `snippet`
  - `occurrenceCount`
  - `occurrences`

The analyzer reports both distinct repeated signatures and total repeated call occurrences. This keeps triage manageable while still preserving the multiplier effect of highly repeated call sites.

## Recommendation Mapping
- `repeated_http_fetch`: HTTP response caching, request deduplication, memoized API wrappers
- `repeated_graphql_query`: GraphQL operation-level caching, persisted query reuse
- `repeated_db_query`: ORM/application-layer query result caching
- `repeated_pure_compute`: Memoization of repeated computations

## Limitations
- Static analysis cannot confirm runtime predicate or input stability.
- Dynamic URL construction and complex query builders may be under-detected.
- The scanner is designed for high-confidence, low-noise findings rather than exhaustive detection.
