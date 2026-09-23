# Study 02 — Unindexed foreign keys in public Prisma schemas

Prisma does not create indexes for foreign keys. Rails and Django do it
automatically; Prisma leaves it to you. This study measures how often that
default goes uncorrected in real schemas.

**Across 2,890 public Prisma schemas and 88,281 foreign keys, the typical
schema leaves 40% of its foreign keys unindexed.** 88.4% have at least one
unindexed foreign key, and a quarter declare no `@@index` at all.

Every schema analysed was accepted by Prisma's own validator, and on every one
of them the detector's parser reads exactly the models, foreign keys and
indexes that Prisma's parser reads.

This is the prevalence half of a pair. The [missing-index benchmark
study](https://stackinsight.dev/blog/missing-index-empirical-study) measured
what an unindexed lookup costs; this one counts how many there are.

---

## Results

| Schema size | Schemas | FKs | FKs per schema | Median unindexed per schema | Pooled unindexed % | No `@@index` at all |
|---|---:|---:|---:|---:|---:|---:|
| under 1 KB | 17 | 30 | 1.8 | 100% | 76.7% | 15 (88.2%) |
| 1–2 KB | 255 | 696 | 2.7 | 100% | 70.8% | 187 (73.3%) |
| 2–4 KB | 269 | 1,429 | 5.3 | 71.4% | 61.9% | 135 (50.2%) |
| 4–8 KB | 509 | 5,403 | 10.6 | 58.3% | 53.8% | 193 (37.9%) |
| 8–16 KB | 711 | 13,465 | 18.9 | 37.5% | 44.2% | 145 (20.4%) |
| 16–32 KB | 565 | 19,730 | 34.9 | 29.6% | 38.8% | 46 (8.1%) |
| over 32 KB | 564 | 47,528 | 84.3 | 27.4% | 33.6% | 10 (1.8%) |
| **All** | **2,890** | **88,281** | **30.5** | **40%** | **38.4%** | **731 (25.3%)** |

Of the 2,890 schemas, 2,554 have at least one unindexed foreign key and 336
have none. Every schema in the corpus has at least one foreign key, so those
two must sum to the total, and they do.

**Median, not pooled, is the headline.** The two pooled figures are biased in
opposite directions by schema size. The pooled foreign-key percentage is
dominated by the largest schemas — the top bucket alone holds 54% of all
foreign keys. "Schemas with at least one" is inflated by them instead: a
schema with 84 foreign keys almost certainly misses one. The median of each
schema's own ratio gives every schema one vote.

**The gradient is the finding.** The typical schema under 2 KB indexes none of
its foreign keys; over 32 KB, the typical schema leaves 27% unindexed. Foreign
key density rises the whole way (1.8 to 84 per schema) while the unindexed
share falls.

That is a correlation across schemas, not a trajectory within one. It is
consistent with schemas gaining indexes as they grow, and equally consistent
with small schemas being a different population — learning projects, say —
that never grow at all. This data cannot separate those. See Caveats.

The small-bucket medians are coarse by construction. A schema with two
foreign keys can only score 0%, 50% or 100%, so "median 100%" there means the
typical small schema indexes none of them, not that the measurement is
saturated.

---

## Corpus

### Collection

Schemas were found with GitHub code search, `model filename:schema.prisma`,
and fetched at the exact blob returned by the search.

Code search caps any one query at 1,000 results, so the search was split into
seven non-overlapping file-size ranges. Those ranges are not interchangeable:
size tracks how developed a schema is, and an early run that walked them in
order sampled only the smallest schemas on GitHub and produced a headline of
79%. A second early run skewed large and produced 28%. The full run covered
every range.

A candidate was **included** if it met all of these:

- the file is exactly `schema.prisma` (the search is a prefix match and also
  returns `schema.prisma_old` and similar)
- the repository is not a fork and not archived
- it was pushed to within the last year
- its name, description and topics do not contain `template`, `starter`,
  `boilerplate`, `example`, `tutorial`, `demo`, `playground`, `scaffold` or
  `sample`, and it is not marked as a GitHub template
- the schema declares at least 3 models
- at least one `@relation(fields: [...])` — a schema with no foreign keys has
  nothing to say about whether foreign keys are indexed

One schema per repository was kept: the first returned by the search.

| Stage | Schemas |
|---|---:|
| Candidates examined | 5,263 |
| Excluded: not pushed in a year | 1,859 |
| Excluded: template or example | 65 |
| Excluded: fewer than 3 models | 254 |
| Excluded: no relations | 69 |
| **Collected** | **3,016** |

The checks run in the order listed, and each candidate is counted against the
first one it fails: 3,016 + 1,859 + 65 + 254 + 69 = 5,263. The fork and
archived checks excluded nothing, because GitHub code search does not return
forks or archived repositories in the first place.

The one-year filter did more than keep out abandoned projects. It also caught
most copies of other people's projects that were pushed to a new repository
rather than forked — several copies of cal.com among them — since a copy
that is never updated goes stale.

### Analysis-stage exclusions

| Reason | Schemas |
|---|---:|
| Byte-identical to another schema (same git blob SHA) | 65 |
| Rejected by Prisma's validator | 55 |
| Snapshot of another project by an AI code-review benchmark | 5 |
| Test fixture vendored from another project | 1 |
| **Excluded** | **126** |
| **Analysed** | **2,890** |

Each schema falls into exactly one row. The checks run in the order listed,
so a rejected schema's byte-identical copies are counted as rejected rather
than as duplicates.

**Byte-identical.** A git blob SHA is a hash of the content, so equal SHAs
mean identical files. The fork filter only catches GitHub forks; copying a
project into a new repository leaves no trace in its metadata. The most
duplicated schema was cal.com's, snapshotted five times by different AI
code-review tools for the same pull request.

**Rejected by Prisma.** A schema Prisma cannot parse cannot generate a client.
The common causes were a relation missing its opposite field, a model
defined twice, a view with a primary key, and preview features that no
longer exist. Some of those are version drift rather than a broken schema;
they are excluded either way, because the claim below needs every analysed
schema to be one Prisma accepts.

---

## Validating the parser

The foreign-key counts come from the same parser that ships in the detector
(`@code-evolution/core-engine`), not from a second implementation written for
the study. A study that reimplements what it measures can disagree with the
tool it is about, and nobody notices until a reader runs the tool.

That parser was then checked against Prisma's own, on every schema. For each
one, both were asked for the models, the foreign keys, and whether each
foreign key is covered by an index; the coverage rule was applied identically
to both, so any difference would come from what the two parsers *read*.

**Result: 2,961 of 2,961 comparable schemas agree, with 0 disagreements
across 90,029 foreign keys.** (The cross-check runs before deduplication, so
its population is larger than the 2,890 analysed.)

Getting there took six fixes. Each was a valid Prisma shape the parser
misread:

| Shape | Effect before the fix | How it was found |
|---|---|---|
| `@@index(field)` without brackets | index ignored, field reported unindexed | manual verification |
| fields at column 0, no indentation | whole schema read as having no fields | arithmetic check |
| `// @@index([field])` commented out | read as a real index, hiding an unindexed key | cross-check |
| a model inside `/* */` | read as live | cross-check |
| `}model Next {` on one line | second model lost entirely | cross-check |
| `fields : [x]`, space before the colon | foreign key not recognised | cross-check |

Three of those dropped foreign keys silently rather than misreporting them.
That is why the cross-check mattered more than any sample: a key the parser
never counts never appears in the output, so no amount of checking findings
can find it.

Two differences between the parsers are deliberate and were aligned rather
than fixed:

- **Views** appear in Prisma's model list with their relations, but a view
  has no foreign-key constraint in the database and a non-materialised one
  cannot be indexed. They are not counted.
- **`@@ignore` models** are absent from Prisma's model list — typically
  introspected tables Prisma Client cannot use — so their foreign keys were
  never Prisma's to index. They are not counted either.

### Manual verification

Fourteen unindexed foreign keys were drawn at random, two from each size
bucket, with a fixed seed so the draw repeats. Each was checked by hand
against its schema. Thirteen were genuinely unindexed; one was the
bracketless `@@index(field)` above, which led to that fix.

Several of the thirteen belonged to schemas that do use `@@index` — just not
on that foreign key. Knowing to add indexes and remembering to index every
foreign key turn out to be different things.

---

## Definitions

- **Foreign key**: the column list in a `@relation(fields: [...])`. A
  composite foreign key is one foreign key, not one per column.
- **Covered**: some index on the model starts with all of the foreign key's
  columns. Postgres can only use an index from its leading column, so
  `@@index([projectId, createdAt])` covers `projectId` but not `createdAt`.
- **Index**: `@id`, `@unique`, `@@id`, `@@unique` and `@@index` all count for
  coverage, since each creates a real index. `@@fulltext` does not; it is not
  a b-tree index and cannot serve a foreign-key lookup.
- **Explicit index** (the "no `@@index` at all" column): `@@index` only.
  Counting primary keys and unique constraints here would report eight indexes
  for a schema with eight models whether or not anyone thought about indexing.

---

## Caveats

**This is public GitHub, not production.** Between 79% and 89% of schemas in
every size bucket have zero stars, so stars cannot tell learning projects from
production ones, and the largest bucket is not a proxy for production
either. The honest scope is "public, recently-maintained Prisma schemas".

**Correlation across schemas, not change over time.** Bigger schemas index
more of their foreign keys. Whether that is because schemas gain indexes as
they grow, because larger projects have more experienced authors, or because
the unindexed ones were abandoned before they got large, this data cannot
say. Telling those apart needs the git history of individual schemas.

**Declarations, not cost.** An unindexed foreign key on a 50-row lookup table
is technically unindexed and practically irrelevant. This study counts how
often the index is missing; the benchmark study measures what it costs when
the table is large.

**One schema per repository.** A monorepo with several `schema.prisma` files
contributes only the first one the search returned.

**Exact duplicates only.** Copies are removed by blob SHA. A copy with one line
changed survives. Near-duplicates were not measured; spot checks of the
largest schemas found only distinct projects.

**The template filter matches names.** `Henry-Madoa/SaccoDemo` passed because
`\bdemo\b` does not match inside CamelCase. It has 262 models and was kept.

**Pinned to blobs, not commits.** Each schema is recorded with the git blob
SHA of the exact content analysed, fetchable at
`https://api.github.com/repos/<repo>/git/blobs/<sha>`. That is reproducible,
but a blob SHA is not a commit, so it cannot form a `github.com/.../blob/`
link.

**Validated against one Prisma version.** Prisma's schema validator from npm
(`@prisma/prisma-schema-wasm` 8.x) decided which schemas were rejected.
Connection URLs were stripped before validation, since Prisma 7 moved them
out of the schema file.

---

## Reproducing

Scripts run in this order; each reads what the one before wrote.

```bash
npm install
GITHUB_TOKEN=... node scripts/collect-schemas.mjs    # → data/corpus.tsv, data/excluded.tsv, data/schemas/
node scripts/crosscheck-prisma.mjs                   # → data/crosscheck.tsv
node scripts/analyse-schemas.mjs                     # → data/results.tsv, data/summary.json, data/exclusions.tsv
node scripts/stratify.mjs                            # → data/by-size.tsv, the table above
node scripts/sample-verify.mjs                       # → data/verification.md, for manual review
```

`GITHUB_TOKEN` needs public repository read access only. Collection takes
under an hour; everything after it runs in a few minutes.

`package.json` depends on `@code-evolution/core-engine` 1.3.0 or later from
npm, the first release with the parser fixes above. The figures in this README
were produced with 1.3.0.

On Windows with Git Bash, call `node.exe` directly if `node` is aliased to
`winpty node` — winpty refuses to run when output is redirected, and fails
with nothing but `stdout is not a tty`.

---

## Data

Committed: `corpus.tsv`, `excluded.tsv`, `exclusions.tsv`, `results.tsv`,
`unindexed-fks.tsv`, `crosscheck.tsv`, `crosscheck-diffs.tsv`, `by-size.tsv`,
`summary.json`.

Not committed: `data/schemas/` and `data/verification.md`. Those are other
people's code, mostly unlicensed, so redistributing them is not ours to do.
`corpus.tsv` records the repository and blob SHA of every schema, which is
enough to fetch each one again.
