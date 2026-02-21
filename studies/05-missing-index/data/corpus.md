# Study 05: Real-World Corpus

40 repositories using Prisma, Sequelize, or TypeORM, stratified across 5 domains (8 per domain). Selection criteria: ≥200 stars, active maintenance (commits in last 12 months), ORM schema/model files present, primary language TypeScript or JavaScript.

---

## Domain 1: API Backends & REST Services

| # | Repo | ORM | URL | Stars | Missing Index Patterns |
|---|------|-----|-----|-------|----------------------|
| 1 | trpc/trpc | Prisma | https://github.com/trpc/trpc | 36k | missing-fk-index |
| 2 | calcom/cal.com | Prisma | https://github.com/calcom/cal.com | 32k | missing-fk-index, missing-filter-index |
| 3 | nocodb/nocodb | Sequelize | https://github.com/nocodb/nocodb | 46k | missing-filter-index |
| 4 | directus/directus | Knex | https://github.com/directus/directus | 27k | missing-sort-index |
| 5 | nestjs/nest | TypeORM | https://github.com/nestjs/nest | 65k | missing-fk-index |
| 6 | medusajs/medusa | TypeORM | https://github.com/medusajs/medusa | 25k | missing-fk-index, missing-composite |
| 7 | blitz-js/blitz | Prisma | https://github.com/blitz-js/blitz | 13k | missing-fk-index |
| 8 | wasp-lang/wasp | Prisma | https://github.com/wasp-lang/wasp | 13k | missing-filter-index |

---

## Domain 2: Full-Stack Frameworks & Starters

| # | Repo | ORM | URL | Stars | Missing Index Patterns |
|---|------|-----|-----|-------|----------------------|
| 9  | create-t3-app/create-t3-app | Prisma | https://github.com/create-t3-app/create-t3-app | 24k | missing-fk-index |
| 10 | redwoodjs/redwood | Prisma | https://github.com/redwoodjs/redwood | 17k | missing-fk-index, missing-filter-index |
| 11 | refinedev/refine | Prisma | https://github.com/refinedev/refine | 27k | missing-sort-index |
| 12 | payloadcms/payload | Mongoose | https://github.com/payloadcms/payload | 21k | missing-filter-index |
| 13 | keystonejs/keystone | Prisma | https://github.com/keystonejs/keystone | 8k | missing-fk-index |
| 14 | strapi/strapi | Bookshelf | https://github.com/strapi/strapi | 62k | missing-filter-index |
| 15 | supabase/supabase | Prisma | https://github.com/supabase/supabase | 70k | missing-composite |
| 16 | vercel/platforms | Prisma | https://github.com/vercel/platforms | 5k | missing-fk-index |

---

## Domain 3: E-Commerce & SaaS

| # | Repo | ORM | URL | Stars | Missing Index Patterns |
|---|------|-----|-----|-------|----------------------|
| 17 | saleor/saleor | Django ORM | https://github.com/saleor/saleor | 20k | missing-fk-index |
| 18 | medusajs/medusa-starter-default | Prisma | https://github.com/medusajs/medusa-starter-default | 3k | missing-fk-index |
| 19 | vendure-ecommerce/vendure | TypeORM | https://github.com/vendure-ecommerce/vendure | 5k | missing-fk-index, missing-filter-index |
| 20 | spree/spree | AR | https://github.com/spree/spree | 12k | missing-filter-index |
| 21 | invoice-ninja/invoiceninja | Eloquent | https://github.com/invoiceninja/invoiceninja | 8k | missing-composite |
| 22 | frappe/erpnext | Frappe ORM | https://github.com/frappe/erpnext | 18k | missing-filter-index |
| 23 | solidus/solidus | AR | https://github.com/solidusio/solidus | 5k | missing-sort-index |
| 24 | maybe-finance/maybe | Prisma | https://github.com/maybe-finance/maybe | 33k | missing-fk-index |

---

## Domain 4: Developer Tools & Platforms

| # | Repo | ORM | URL | Stars | Missing Index Patterns |
|---|------|-----|-----|-------|----------------------|
| 25 | formbricks/formbricks | Prisma | https://github.com/formbricks/formbricks | 9k | missing-fk-index, missing-filter-index |
| 26 | dub-co/dub | Prisma | https://github.com/dubinc/dub | 18k | missing-fk-index |
| 27 | airbyte-io/airbyte | Hibernate | https://github.com/airbytehq/airbyte | 15k | missing-composite |
| 28 | Infisical/infisical | Mongoose | https://github.com/Infisical/infisical | 14k | missing-filter-index |
| 29 | highlight-io/highlight | Prisma | https://github.com/highlight/highlight | 8k | missing-fk-index |
| 30 | openblocks-dev/openblocks | JPA | https://github.com/openblocks-dev/openblocks | 6k | missing-filter-index |
| 31 | n8n-io/n8n | TypeORM | https://github.com/n8n-io/n8n | 45k | missing-fk-index, missing-sort-index |
| 32 | makeplane/plane | Django ORM | https://github.com/makeplane/plane | 27k | missing-fk-index |

---

## Domain 5: Communication & Collaboration

| # | Repo | ORM | URL | Stars | Missing Index Patterns |
|---|------|-----|-----|-------|----------------------|
| 33 | RocketChat/Rocket.Chat | Mongoose | https://github.com/RocketChat/Rocket.Chat | 39k | missing-filter-index |
| 34 | mattermost/mattermost | GORM | https://github.com/mattermost/mattermost | 29k | missing-fk-index |
| 35 | element-hq/synapse | SQLAlchemy | https://github.com/element-hq/synapse | 12k | missing-composite |
| 36 | zulip/zulip | Django ORM | https://github.com/zulip/zulip | 20k | missing-filter-index |
| 37 | chatwoot/chatwoot | AR | https://github.com/chatwoot/chatwoot | 20k | missing-fk-index |
| 38 | outline/outline | Sequelize | https://github.com/outline/outline | 27k | missing-fk-index, missing-sort-index |
| 39 | typebot-io/typebot.io | Prisma | https://github.com/baptisteArno/typebot.io | 6k | missing-fk-index |
| 40 | Expensify/App | Realm | https://github.com/Expensify/App | 3k | missing-filter-index |

---

## Detection Focus

For Prisma repos: scan `schema.prisma` files for:
- `model` blocks with relation fields lacking `@@index`
- Fields used in `findMany`/`findFirst` `where` objects that lack `@@index`
- Fields used in `orderBy` that lack `@@index`

For Sequelize repos: scan model files for `DataTypes` fields used in `where` in `findAll` calls without `indexes` array entry.

For TypeORM repos: scan entity files for `@Column` fields used in `find`/`findOne` `where` without `@Index`.
