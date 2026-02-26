# Study 05: Real-World Corpus

40 Prisma repositories stratified across 5 domains (8 repos per domain). Selection criteria: ≥1k stars, active maintenance (commits in last 12 months), schema.prisma files present, primary language TypeScript or JavaScript.

---

## Domain 1: API Backends & REST Services

| # | Repo | URL | Stars | Missing Index Patterns |
|---|------|-----|-------|----------------------|
| 1 | trpc/trpc | https://github.com/trpc/trpc | 36k | missing-fk-index |
| 2 | calcom/cal.com | https://github.com/calcom/cal.com | 32k | missing-fk-index, missing-filter-index |
| 3 | blitz-js/blitz | https://github.com/blitz-js/blitz | 13k | missing-fk-index |
| 4 | wasp-lang/wasp | https://github.com/wasp-lang/wasp | 13k | missing-filter-index |
| 5 | prisma/prisma-examples | https://github.com/prisma/prisma-examples | 6k | missing-fk-index |
| 6 | t3-oss/create-t3-app | https://github.com/t3-oss/create-t3-app | 24k | missing-fk-index |
| 7 | shadcn-ui/ui | https://github.com/shadcn-ui/ui | 75k | missing-fk-index, missing-filter-index |
| 8 | lucia-auth/lucia | https://github.com/lucia-auth/lucia | 9k | missing-sort-index |

---

## Domain 2: Full-Stack Frameworks & Starters

| # | Repo | URL | Stars | Missing Index Patterns |
|---|------|-----|-------|----------------------|
| 9  | redwoodjs/redwood | https://github.com/redwoodjs/redwood | 17k | missing-fk-index, missing-filter-index |
| 10 | toeverything/AFFiNE | https://github.com/toeverything/AFFiNE | 35k | missing-sort-index |
| 11 | keystonejs/keystone | https://github.com/keystonejs/keystone | 8k | missing-fk-index |
| 12 | triggerdotdev/trigger.dev | https://github.com/triggerdotdev/trigger.dev | 12k | missing-composite |
| 13 | amplication/amplication | https://github.com/amplication/amplication | 15k | missing-fk-index |
| 14 | documenso/documenso | https://github.com/documenso/documenso | 8k | missing-fk-index |
| 15 | nextauthjs/next-auth | https://github.com/nextauthjs/next-auth | 24k | missing-fk-index |
| 16 | remix-run/examples | https://github.com/remix-run/examples | 6k | missing-filter-index |

---

## Domain 3: E-Commerce & SaaS

| # | Repo | URL | Stars | Missing Index Patterns |
|---|------|-----|-------|----------------------|
| 17 | steven-tey/dub | https://github.com/steven-tey/dub | 17k | missing-fk-index |
| 18 | openstatusHQ/openstatus | https://github.com/openstatusHQ/openstatus | 6k | missing-fk-index |
| 19 | twentyhq/twenty | https://github.com/twentyhq/twenty | 15k | missing-fk-index, missing-filter-index |
| 20 | boxyhq/saas-starter-kit | https://github.com/boxyhq/saas-starter-kit | 3k | missing-fk-index |
| 21 | dubinc/dub | https://github.com/dubinc/dub | 18k | missing-fk-index |
| 22 | midday-ai/midday | https://github.com/midday-ai/midday | 4k | missing-composite |
| 23 | maybe-finance/maybe | https://github.com/maybe-finance/maybe | 28k | missing-fk-index |
| 24 | plausible/analytics | https://github.com/plausible/analytics | 19k | missing-sort-index |

---

## Domain 4: Developer Tools & Platforms

| # | Repo | URL | Stars | Missing Index Patterns |
|---|------|-----|-------|----------------------|
| 25 | formbricks/formbricks | https://github.com/formbricks/formbricks | 9k | missing-fk-index, missing-filter-index |
| 26 | unkeyed/unkey | https://github.com/unkeyed/unkey | 3k | missing-fk-index |
| 27 | novuhq/novu | https://github.com/novuhq/novu | 34k | missing-fk-index |
| 28 | infisical/infisical | https://github.com/Infisical/infisical | 14k | missing-filter-index |
| 29 | lobehub/lobe-chat | https://github.com/lobehub/lobe-chat | 38k | missing-fk-index |
| 30 | civitai/civitai | https://github.com/civitai/civitai | 6k | missing-composite |
| 31 | papermark/papermark | https://github.com/mfts/papermark | 5k | missing-fk-index |
| 32 | t3-oss/create-t3-turbo | https://github.com/t3-oss/create-t3-turbo | 5k | missing-sort-index |

---

## Domain 5: Communication & Collaboration

| # | Repo | URL | Stars | Missing Index Patterns |
|---|------|-----|-------|----------------------|
| 33 | typebot-io/typebot.io | https://github.com/baptisteArno/typebot.io | 6k | missing-fk-index |
| 34 | pingdotgg/uploadthing | https://github.com/pingdotgg/uploadthing | 4k | missing-filter-index |
| 35 | chakra-ui/panda | https://github.com/chakra-ui/panda | 5k | missing-fk-index |
| 36 | useplunk/plunk | https://github.com/useplunk/plunk | 3k | missing-fk-index, missing-composite |
| 37 | makeplane/plane | https://github.com/makeplane/plane | 27k | missing-filter-index |
| 38 | AnswerOverflow/AnswerOverflow | https://github.com/AnswerOverflow/AnswerOverflow | 2k | missing-fk-index |
| 39 | gitroom-io/gitroom | https://github.com/gitroomhq/gitroom | 4k | missing-sort-index |
| 40 | nicoalbanese/kirimase | https://github.com/nicoalbanese/kirimase | 3k | missing-fk-index |

---

## Detection Focus

**For Prisma repos:** scan `schema.prisma` files for:
- `model` blocks with relation fields lacking `@@index`
- Fields used in `findMany`/`findFirst` `where` objects that lack `@@index`
- Fields used in `orderBy` that lack `@@index`
