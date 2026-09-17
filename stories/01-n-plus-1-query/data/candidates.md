# N+1 Query Detector: Candidate Repository Pool

This file lists every repository we evaluated for the N+1 Query Detector application
report, how it was sourced, and what happened when we scanned it. Anyone can rerun
this pool (see `../README.md` for the exact commands) and get the same shortlist.

Finding counts are given as before and after the detector fix described in
`../README.md` Step 4. The "before" numbers are what the original detector
reported; the "after" numbers are from the current build. Where a row says
"re-scoped", the first pass had scanned a fixture or schema-only package and the
scope was corrected in the Step 6 pass — those rows' "before" numbers are from the
original detector run against the corrected scope, so both columns describe the
same files.

Rows marked "excluded at triage" were never scanned on purpose: the repository uses
an ORM this detector does not support, or is not a JavaScript backend at all.
Reporting zero findings for them would imply the detector looked and found nothing
clean, which is not what happened. The triage data is in
`../results/expanded-corpus/orm-triage.tsv`.

## Why this list looks the way it does

The N+1 Query Detector recognizes database calls made through five ORM/query
layers: **Prisma**, **Sequelize**, **Mongoose**, **TypeORM**, and **Knex** (plus raw
`pg`/`mysql`/`sqlite3` drivers). Our first pass reused the 40-repository Prisma
corpus already built for the Missing Index study
(`../../05-missing-index/data/corpus.md`), since N+1 problems are common in the same
ORM query code that study was already sampling. That pass under-represented
Sequelize/Mongoose/TypeORM codebases, so we added a second, smaller batch of
repositories chosen specifically for ORM diversity.

Every candidate is a real, actively maintained open-source project. We do not scan
whole repositories — the product's CLI is meant for focused scans, so for each
monorepo we pick one sub-package (an `apps/*`, `packages/*`, or `server/*` module)
and keep it under ~500 JS/TS files, the scan-scope ceiling documented in
`../README.md`.

## Batch 1 — Prisma corpus (reused from the Missing Index study)

40 repositories, all originally selected for that study across five domains (API
backends, full-stack frameworks, e-commerce/SaaS, dev tools, communication). Full
detail: `../../05-missing-index/data/corpus.md`.

| Repository | Scope tried | Files in scope | Result |
|---|---|---|---|
| trpc/trpc | re-scoped to `packages/server` | 86 | 3 findings before the fix (all false positives), 0 after |
| calcom/cal.com | packages/trpc (manually re-scoped) | 398 | **22 findings before the detector fix, 7 after — all 7 genuine. Study repo.** |
| blitz-js/blitz | re-scoped to `packages/blitz/src`, `packages/generator/src`, `apps/web/src` | 120 | 5 before (all false positives), 0 after |
| wasp-lang/wasp | re-scoped to `waspc/data`, `web/src` | 525 | 1 before (false positive), 0 after |
| prisma/prisma-examples | re-scoped to `orm` | 278 | 0 before, **29 after — all genuine** (per-row `create` in seed scripts) |
| t3-oss/create-t3-app | `cli` (Prisma present) | 150 | 0 before, 0 after |
| shadcn-ui/ui | fixture scope only | 36 | UI library, no server data layer — not rescanned |
| lucia-auth/lucia | — | 1 | excluded at triage: no ORM (docs-only repository now) |
| redwoodjs/redwood | re-scoped to `packages/cli/src`, `packages/codemods/src` | 384 | 11 before (all false positives), 0 after |
| toeverything/AFFiNE | packages/backend/server | 540 | 26 findings before the fix (mostly Map/Array false positives), 11 after — all 11 genuine. Held-out validation repo. |
| keystonejs/keystone | re-scoped to `packages/core` | 190 | 8 before, 1 after — genuine (per-database query in a test helper) |
| triggerdotdev/trigger.dev | re-scoped to `apps/webapp/app/services`, `apps/webapp/app/v3` | 480 | 91 before, **13 after — all genuine** |
| amplication/amplication | 12 modules under `packages/amplication-server/src/core` | 387 | 12 before, **6 after — all genuine** |
| documenso/documenso | re-scoped to `packages/lib/server-only`, `packages/lib/jobs` | 359 | 10 before, **30 after — all genuine** |
| nextauthjs/next-auth | re-scoped to `packages` | 261 | 3 before, 1 after — genuine (per-statement D1 migration runner) |
| remix-run/examples | re-scoped to `pm-app`, `_official-blog-tutorial` | 92 | 4 before, 1 after — genuine (per-row seed `upsert`) |
| steven-tey/dub | superseded by dubinc/dub (same codebase) | — | see dubinc/dub |
| openstatusHQ/openstatus | — | 2164 | excluded at triage: Drizzle, not a supported ORM |
| twentyhq/twenty | — (Prisma pass) | — | no schema.prisma found (uses TypeORM, see Batch 2) |
| boxyhq/saas-starter-kit | re-scoped to `lib`, `pages` | 120 | 1 before (false positive), 0 after |
| dubinc/dub | re-scoped to `apps/web/lib/api`, `apps/web/app/api` | 441 | 32 before, **7 after — all genuine** |
| midday-ai/midday | `apps/api`, `apps/worker/src` (mostly Drizzle) | 323 | 10 before (all false positives), 0 after |
| maybe-finance/maybe | — | 91 | excluded at triage: Rails application |
| plausible/analytics | — | 215 | excluded at triage: Elixir backend |
| formbricks/formbricks | `apps/web/lib`, `apps/web/app/api` | 404 | 41 before, **9 after — all genuine** |
| unkeyed/unkey | — | 2567 | excluded at triage: Drizzle, not a supported ORM |
| novuhq/novu | — (Prisma pass) | — | no schema.prisma found (uses Mongoose, see Batch 2) |
| Infisical/infisical | `backend/src/server` | 365 | 8 before (all false positives), 0 after |
| lobehub/lobe-chat | — | — | excluded at triage: Drizzle; clone also unavailable |
| civitai/civitai | apps/event-engine | 107 | 18 findings before the fix (mostly false positives and already-batched queries), 2 after — both genuine. Held-out validation repo. |
| mfts/papermark | `pages/api`, `app`, `ee` | 458 | 42 before, **28 after — all genuine** |
| t3-oss/create-t3-turbo | — | 74 | excluded at triage: Drizzle, not a supported ORM |
| baptisteArno/typebot.io | re-scoped to `packages/bot-engine/src`, `packages/lib/src`, `packages/scripts/src` | 227 | 28 before, **7 after — all genuine** |
| pingdotgg/uploadthing | — | 425 | excluded at triage: Drizzle, not a supported ORM |
| chakra-ui/panda | playground | 61 | 1 before (false positive), 0 after. CSS library, no data layer |
| useplunk/plunk | re-scoped to `apps/api/src`, `apps/web/src` | 212 | 31 before, **16 after — all genuine** |
| makeplane/plane | — | 3261 | excluded at triage: Django backend |
| AnswerOverflow/AnswerOverflow | — | 761 | excluded at triage: Drizzle, not a supported ORM |
| gitroomhq/gitroom | — | — | clone failed (repository renamed) |
| nicoalbanese/kirimase | — | 54 | excluded at triage: scaffolding CLI, no ORM dependency |

## Batch 2 — ORM-diversity additions (Sequelize / TypeORM / Mongoose)

Added after batch 1 turned out Prisma-heavy. Picked for being well-known,
actively-maintained apps built on an ORM the detector recognizes but batch 1 barely
covered.

| Repository | ORM | Scope tried | Files in scope | Result |
|---|---|---|---|---|
| **outline/outline** | Sequelize | `server/{routes,commands,presenters,queues,policies,services}` | 334 | **38 findings before the detector fix, 27 after — all 27 genuine. Study repo.** |
| medusajs/medusa | TypeORM | packages/medusa/src/api/admin | 477 | 3 findings before the fix (all false positives), 0 after. Held-out validation repo. |
| twentyhq/twenty | TypeORM | packages/twenty-server/src/modules/{workflow,calendar} | 470 | 18 findings before the fix (mostly false positives), 9 after — all 9 genuine. Held-out validation repo. |
| novuhq/novu | Mongoose | apps/api/src/app/{integrations,inbox,subscribers,activity,events} | 335 | 30 findings before the fix (mostly false positives), 1 after — genuine. Held-out validation repo. |
| **immich-app/immich** | Kysely (SQL query builder) + custom repository layer | `server/src/{services,repositories,controllers,workers,commands}` | 172 | **18 findings before the detector fix, 8 after — all 8 genuine. Study repo.** |

Note: `getoutline/outline` is not a valid GitHub path — the project's actual
organization is `outline/outline`.

## Final selection: 3 repositories

We picked three repositories, one per major ORM family, each with findings that
survived manual line-by-line verification against the source:

1. **outline/outline** (Sequelize) — the deepest result: 27 confirmed N+1 patterns
   concentrated in the notification-delivery pipeline (background jobs that fan out
   a Sequelize lookup per mention, per recipient, or per group).
2. **calcom/cal.com** (Prisma, `packages/trpc`) — 7 confirmed findings in a widely
   used scheduling product, four of them write-side N+1s (`update`/`upsert` per
   item) that the original detector could not see at all.
3. **immich-app/immich** (Kysely / custom repository layer) — 8 confirmed findings,
   including `deleteBulkMetadata()`, a method that runs one `DELETE` per item
   inside its own loop.

## Held-out validation set

Five repositories were scanned but deliberately kept out of the detector-improvement
work, so they could be used to check that the fixes generalise rather than overfit:
**toeverything/AFFiNE**, **twentyhq/twenty**, **civitai/civitai**, **novuhq/novu**,
and **medusajs/medusa**. Findings across those five dropped from 95 to 23 after the
fixes, and all 23 were confirmed genuine by hand. Details in `../results/summary.md`.

Note that AFFiNE and civitai were originally set aside because their genuine hits
sat in migration and setup scripts rather than request-serving code. After the
detector was fixed, AFFiNE turned out to contain eleven genuine N+1 patterns,
several of them in production paths (workspace permission writes, calendar
subscription sync, an invite handler) — the earlier judgement was made on noisy
output, which is its own lesson about scanning before the tooling is trustworthy.
