# Study 04: Loop Performance — Real-World Corpus (Phase 4)

> 40 open-source repositories stratified across 5 domains (8 per domain).
> Selection criteria: ≥500 stars, active PR/issue tracker, test suite with >60% coverage, loop-intensive domain, no major-corporation primary authorship.

---

## Selection Criteria (per Plan §4.1)

1. **Stars** — ≥ 500 GitHub stars (ensures active maintenance and community interest).
2. **PR acceptability** — Active issue tracker accepting pull requests (required for Phase 4.5 patch campaign).
3. **Test coverage** — Existing CI test suite with reasonable coverage (>60%), so patches can be auto-verified.
4. **Loop intensity** — Domain known to involve heavy data transformation: web frameworks, data processing, build tools, ORM/query, CLI, rendering engines.
5. **Ownership** — Not primarily authored by a major corporation (to avoid slow/bureaucratic PR processes).

---

## Domain Stratification

| Domain | Projects per domain | Representative Project Types |
|--------|--------------------|-----------------------------|
| Data Transformation | 8 | ETL libraries, CSV/JSON processors, schema validators |
| Web Serving | 8 | HTTP frameworks, middleware stacks, routing libraries |
| Build Tooling | 8 | Bundlers, linters, transpilers, task runners |
| UI / Rendering | 8 | Component libraries, template engines, charting libraries |
| Developer Utilities | 8 | CLI tools, test runners, code formatters |

---

## Domain 1 — Data Transformation

| # | Repository | Lang | URL | Stars | Expected Anti-Patterns |
|---|-----------|------|-----|-------|------------------------|
| 1 | lodash/lodash | JS | https://github.com/lodash/lodash | 58k | Chained array methods, nested array methods |
| 2 | ramda/ramda | JS | https://github.com/ramda/ramda | 23k | Chained transforms, nested map/filter |
| 3 | ajv-validator/ajv | JS | https://github.com/ajv-validator/ajv | 12k | Schema validation loops, nested object iteration |
| 4 | d3/d3 | JS | https://github.com/d3/d3 | 108k | Nested loops, chained data transforms |
| 5 | pandas-dev/pandas | Py | https://github.com/pandas-dev/pandas | 43k | iterrows (Python-level loop over DataFrame) |
| 6 | numpy/numpy | Py | https://github.com/numpy/numpy | 27k | Nested Python loops before vectorization |
| 7 | marshmallow-code/marshmallow | Py | https://github.com/marshmallow-code/marshmallow | 7k | Schema validation loops, nested field iteration |
| 8 | jmespath/jmespath.py | Py | https://github.com/jmespath/jmespath.py | 2k | Recursive tree traversal, JSON path loops |

---

## Domain 2 — Web Serving

| # | Repository | Lang | URL | Stars | Expected Anti-Patterns |
|---|-----------|------|-----|-------|------------------------|
| 9 | expressjs/express | JS | https://github.com/expressjs/express | 64k | Sequential middleware chain loops |
| 10 | fastify/fastify | JS | https://github.com/fastify/fastify | 31k | Route matching loops, plugin iteration |
| 11 | sindresorhus/got | JS | https://github.com/sindresorhus/got | 14k | Sequential async I/O, retry loops |
| 12 | axios/axios | JS | https://github.com/axios/axios | 104k | Interceptor chain loops, sequential requests |
| 13 | pallets/flask | Py | https://github.com/pallets/flask | 67k | Sequential I/O in request hooks |
| 14 | django/django | Py | https://github.com/django/django | 79k | ORM N+1 adjacent patterns, queryset loops |
| 15 | tiangolo/fastapi | Py | https://github.com/tiangolo/fastapi | 75k | Dependency injection loops, validation iteration |
| 16 | psf/requests | Py | https://github.com/psf/requests | 51k | Sequential retry loops, redirect chain |

---

## Domain 3 — Build Tooling

| # | Repository | Lang | URL | Stars | Expected Anti-Patterns |
|---|-----------|------|-----|-------|------------------------|
| 17 | webpack/webpack | JS | https://github.com/webpack/webpack | 64k | Nested graph traversal, module dependency loops |
| 18 | parcel-bundler/parcel | JS | https://github.com/parcel-bundler/parcel | 43k | Async I/O in loops, nested asset traversal |
| 19 | rollup/rollup | JS | https://github.com/rollup/rollup | 25k | Module resolution loops, tree-shaking iteration |
| 20 | vitejs/vite | JS | https://github.com/vitejs/vite | 68k | Plugin hook iteration loops, module graph traversal |
| 21 | pylint-dev/pylint | Py | https://github.com/pylint-dev/pylint | 5k | AST traversal loops, checker iteration |
| 22 | PyCQA/flake8 | Py | https://github.com/PyCQA/flake8 | 3k | Sequential file checking, regex in loops |
| 23 | psf/black | Py | https://github.com/psf/black | 38k | AST transformation loops, chained formatting |
| 24 | pypa/pip | Py | https://github.com/pypa/pip | 9k | Dependency resolution nested loops |

---

## Domain 4 — UI / Rendering

| # | Repository | Lang | URL | Stars | Expected Anti-Patterns |
|---|-----------|------|-----|-------|------------------------|
| 25 | chartjs/Chart.js | JS | https://github.com/chartjs/Chart.js | 64k | Nested loops over datasets/points |
| 26 | processing/p5.js | JS | https://github.com/processing/p5.js | 21k | requestAnimationFrame loops, DOM manipulation |
| 27 | mrdoob/three.js | JS | https://github.com/mrdoob/three.js | 100k | Render loop, geometry iteration, nested transforms |
| 28 | recharts/recharts | JS | https://github.com/recharts/recharts | 21k | Chart rendering loops, nested transforms |
| 29 | Jinja2/jinja | Py | https://github.com/pallets/jinja | 10k | Template rendering loops, nested block iteration |
| 30 | matplotlib/matplotlib | Py | https://github.com/matplotlib/matplotlib | 20k | Dataset rendering loops, nested polygon iteration |
| 31 | bokeh/bokeh | Py | https://github.com/bokeh/bokeh | 19k | Glyph rendering loops, data transform iteration |
| 32 | plotly/plotly.py | Py | https://github.com/plotly/plotly.py | 16k | Figure update loops, trace iteration |

---

## Domain 5 — Developer Utilities

| # | Repository | Lang | URL | Stars | Expected Anti-Patterns |
|---|-----------|------|-----|-------|------------------------|
| 33 | sindresorhus/execa | JS | https://github.com/sindresorhus/execa | 6k | Sequential async subprocess loops |
| 34 | isaacs/node-glob | JS | https://github.com/isaacs/node-glob | 8k | Nested file system traversal loops |
| 35 | jestjs/jest | JS | https://github.com/jestjs/jest | 43k | Test runner loops, async test serialization |
| 36 | prettier/prettier | JS | https://github.com/prettier/prettier | 49k | AST traversal loops, chained format transforms |
| 37 | pytest-dev/pytest | Py | https://github.com/pytest-dev/pytest | 12k | Test collection loops, fixture resolution |
| 38 | scrapy/scrapy | Py | https://github.com/scrapy/scrapy | 52k | Item pipeline sequential processing, crawl loops |
| 39 | celery/celery | Py | https://github.com/celery/celery | 24k | Task queue worker loops, sequential dispatch |
| 40 | apache/airflow | Py | https://github.com/apache/airflow | 37k | DAG traversal nested loops, task dependency |

---

## Phase 4 Measurement Subjects (§4.4)

For real-world performance measurement, the top 3 confirmed instances per anti-pattern type (21 subjects total) are selected from the confirmed findings database after automated detection (§4.2) and manual review (§4.2 labeling).

| Anti-Pattern | Top 3 Repos (candidates — confirmed after scan) |
|--------------|------------------------------------------------|
| Regex in loop | TBD after scan |
| JSON parse in loop | TBD after scan |
| Sequential async I/O | TBD after scan |
| Nested loops | TBD after scan |
| Nested array methods | TBD after scan |
| Chained array methods | TBD after scan |
| DOM manipulation | TBD after scan |

---

## Phase 4.5 Patch Tracking

| # | Repo | Anti-Pattern | PR URL | Submitted | Status | Outcome Notes |
|---|------|-------------|--------|-----------|--------|---------------|
| — | — | — | — | — | pending | To be filled after scan + measurement |
