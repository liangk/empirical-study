# Preliminary Report — N+1 Query Detector Application Report

Status check before we turn this into the final stackinsight.dev article. Everything
below is backed by files already saved to `stories/01-n-plus-1-query/` on your
machine (raw JSON, logs, candidate list) — this is the condensed version for review.

## What we did

1. Reused the 40-repo Prisma corpus from the Missing Index study, added 5 more
   repos to cover Sequelize/TypeORM/Mongoose/Kysely — 45 candidates total.
2. Scanned every candidate with the actual product CLI, built from the **public**
   free-tier repo (so the whole pipeline is reader-reproducible).
3. Manually read every single finding against its source line — did not trust the
   raw detector output.
4. Picked 3 repos, one per ORM family, based on which had genuine, explainable
   findings in real request-serving or job-processing code (not test/migration
   scripts).

## Headline numbers

| Repo | ORM | Files scanned | Raw findings | Confirmed genuine | False-positive rate |
|---|---|---:|---:|---:|---:|
| outline/outline | Sequelize | 334 | 38 | 22 | 42% |
| calcom/cal.com | Prisma | 398 | 22 | 3 | 86% |
| immich-app/immich | Kysely | 172 | 18 | 2 | 89% |
| **Total** | | **904** | **78** | **27** | **65%** |

## The three stories in one line each

- **outline/outline** — 22 real findings, all one root cause: the notification
  job pipeline (mentions, comments, published docs) resolves recipients with a
  `findByPk()` per person instead of one batched query. Worst case: 301 queries
  for 100 items. This is the flagship case — deep, consistent, production hot-path.
- **calcom/cal.com** — thinner but credible: 3 real hits (a `prisma.eventType.update()`
  per item while disabling an app integration, a booking lookup, a credential
  lookup) buried in 19 false positives. Useful as the "well-known product" anchor
  and as the repo we used to compare the public vs. commercial detector build.
- **immich-app/immich** — smallest (2 hits) but the most self-explanatory: a
  method literally named `deleteBulkMetadata()` deletes one row at a time in a
  loop. No context needed to see the bug.

## The finding we're not hiding

65% of raw findings across the three repos were false positives, almost all one
pattern: the detector's method-name heuristic confuses `Map.get()`/`Array.find()`
with an ORM lookup when it can't otherwise resolve the ORM. We confirmed the
commercial build already has a partial fix for this (`orm !== 'Unknown'` filtering)
that the public build doesn't. This becomes its own section in the article — it's
a credibility asset, not something to bury.

## What's already drafted

- Full narrative article: `stories/01-n-plus-1-query/content/n-plus-1-query-application-report.md`
  (stackinsight-study voice: "I" voice, declarative, no bullet "takeaway" lists).
  It exists as a **draft** — not yet run through your SEO/AIEO frontmatter pipeline
  or moved into `astro-blog`.
- Full reproduction trail: `README.md`, `data/candidates.md`, `results/*.json` +
  `results/summary.md`, `logs/*.log`, `scripts/scan-repo.sh`.

## Open questions before we finalize the write-up

1. Does the outline/cal.com/immich selection and ordering (flagship → known-brand
   → self-explanatory) feel right, or would you rather lead with cal.com for name
   recognition?
2. Do you want the 65% false-positive section kept as prominent as it is now
   (its own "What the detector still gets wrong" section), or trimmed down?
3. Ready for this to go through `stackinsight-seo` and get moved into `astro-blog`
   with full frontmatter, or do you want another editing pass on the prose first?
4. Same question for the other 10 detector reports — do you want the same
   "preliminary report first, then write" checkpoint for each of those, or was
   this a one-off check given how much the scope shifted on this one?
