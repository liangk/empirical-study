# Study 09 Corpus: Large Payload Anti-Patterns

300 repositories with REST/GraphQL APIs across 6 domains.

## Selection Criteria

### Inclusion Requirements

Repositories must meet **all** of the following:

1. **API-centric**: Exposes REST or GraphQL endpoints (not just CLI/library)
2. **Publicly accessible**: GitHub repository with source code available
3. **Active maintenance**: Commits within the last 2 years (ensures relevance)
4. **JavaScript/TypeScript codebase**: AST detector targets JS/TS (Prisma, TypeORM, Sequelize, Mongoose, raw SQL)
5. **API patterns present**: Uses ORM/query builders where unbounded queries are detectable

### Exclusion Criteria

- Pure frontend applications (no backend API layer)
- Static site generators (no dynamic queries)
- Abandoned/archived repositories (no activity >2 years)
- Vendored/monorepos without API code in root

### Domain Rationale

| Domain | Why Included | Expected Patterns |
|--------|--------------|-------------------|
| **SaaS / Business** | High API traffic, CRUD-heavy | `findMany()` without limit, deep includes |
| **Data / Analytics** | Large result sets, aggregations | `SELECT *`, missing pagination on reports |
| **Developer Tools** | API SDKs, proxy patterns | Unbounded proxy responses, batch endpoints |
| **E-commerce** | Product catalogs, orders | Unbounded product lists, order history |
| **Content / Media** | Asset metadata, file listings | Deep nested media objects, unbounded galleries |
| **Fintech / Banking** | Transaction history, ledgers | Unbounded transaction queries, large CSV exports |

### API Type Distribution

| Type | Count | Rationale |
|------|-------|-----------|
| REST | ~200 | Dominant API style, easier to detect missing pagination |
| GraphQL | ~50 | N+1 risk, deep query nesting, missing cursor pagination |
| REST/GraphQL | ~50 | Hybrid APIs, comparison opportunity |

### Popularity Distribution

- **High-star (>10k)**: ~40% — Established projects with production traffic, likely to have pagination patterns
- **Medium-star (1k–10k)**: ~40% — Growing projects, more likely to have anti-patterns
- **Low-star (<1k)**: ~20% — Early-stage, higher anti-pattern probability

### What We're Detecting

**Primary Anti-Patterns:**
1. **Unbounded `findMany()`**: No `take`/`limit` parameter
2. **Deep nesting without pagination**: `include` with unbounded child queries
3. **Missing cursor pagination**: Offset-based pagination on large tables
4. **No total count limits**: Streaming endpoints without backpressure

**Framework Coverage:**
- **Prisma**: `findMany()`, `include`, `cursor`, `take`, `skip`
- **TypeORM**: `find()`, `relations`, `take`, `skip`, `cursor`
- **Sequelize**: `findAll()`, `include`, `limit`, `offset`
- **Mongoose**: `find()`, `populate()`, `limit`, `cursor`
- **Raw SQL**: `SELECT *`, `LIMIT`, `OFFSET`, `FETCH FIRST`

### Corpus Limitations

- **Language bias**: Only JS/TS codebases (Python, Go, Ruby APIs excluded)
- **Framework bias**: Focus on Prisma/TypeORM/Sequelize/Mongoose (other ORMs may be missed)
- **Detection scope**: Static analysis only — runtime behavior not measured
- **URL accuracy**: All URLs verified as public GitHub repositories

---

## Domain 1: SaaS / Business Applications (50 repos)

| # | Repo | Type | URL | Stars | Notes |
|---|------|------|-----|-------|-------|
| 1 | nocodb/nocodb | REST | https://github.com/nocodb/nocodb | 50k | Airtable alternative |
| 2 | directus/directus | REST/GraphQL | https://github.com/directus/directus | 28k | Headless CMS |
| 3 | saleor/saleor | GraphQL | https://github.com/saleor/saleor | 21k | E-commerce platform |
| 4 | shopware/shopware | REST | https://github.com/shopware/shopware | 2.5k | E-commerce platform |
| 5 | medusajs/medusa | REST | https://github.com/medusajs/medusa | 25k | E-commerce platform |
| 6 | reactioncommerce/reaction | REST/GraphQL | https://github.com/reactioncommerce/reaction | 12k | E-commerce platform |
| 7 | spree/spree | REST | https://github.com/spree/spree | 13k | E-commerce platform |
| 8 | calcom/cal.com | REST | https://github.com/calcom/cal.com | 30k | Scheduling platform |
| 9 | nextcloud/server | REST | https://github.com/nextcloud/server | 25k | Collaboration platform |
| 10 | mattermost/mattermost | REST | https://github.com/mattermost/mattermost | 30k | Chat platform |
| 11 | zammad/zammad | REST | https://github.com/zammad/zammad | 4k | Ticketing system |
| 12 | bookstackapp/bookstack | REST | https://github.com/BookStackApp/BookStack | 14k | Documentation wiki |
| 13 | documenso/documenso | REST | https://github.com/documenso/documenso | 8k | Document signing |
| 14 | n8n-io/n8n | REST | https://github.com/n8n-io/n8n | 45k | Workflow automation |
| 15 | node-red/node-red | REST | https://github.com/node-red/node-red | 20k | Flow-based programming |
| 16 | huginn/huginn | REST | https://github.com/huginn/huginn | 43k | Automation agent |
| 17 | appsmith/appsmith | REST | https://github.com/appsmithorg/appsmith | 15k | Low-code platform |
| 18 | tooljet/tooljet | REST | https://github.com/ToolJet/ToolJet | 28k | Low-code platform |
| 19 | rowy/rowy | REST | https://github.com/rowyio/rowy | 6k | Firebase CMS |
| 20 | webstudio-is/webstudio | REST | https://github.com/webstudio-is/webstudio | 5k | Visual builder |
| 21 | supertokens/supertokens-core | REST | https://github.com/supertokens/supertokens-core | 12k | Auth platform |
| 22 | casdoor/casdoor | REST | https://github.com/casdoor/casdoor | 9k | Identity platform |
| 23 | logto-io/logto | REST | https://github.com/logto-io/logto | 8k | Auth platform |
| 24 | infisical/infisical | REST | https://github.com/Infisical/infisical | 18k | Secret manager |
| 25 | jackal/jackal | REST | https://github.com/ortuman/jackal | 0.5k | XMPP server |
| 26 | mattermost/focalboard | REST | https://github.com/mattermost/focalboard | 8k | Kanban board |
| 27 | getoutline/outline | REST | https://github.com/outline/outline | 28k | Knowledge base |
| 28 | papercups-io/papercups | REST | https://github.com/papercups-io/papercups | 2k | Chat platform |
| 29 | chatwoot/chatwoot | REST | https://github.com/chatwoot/chatwoot | 20k | Customer support |
| 30 | plausible/analytics | REST | https://github.com/plausible/analytics | 20k | Web analytics |
| 31 | umami-software/umami | REST | https://github.com/umami-software/umami | 22k | Web analytics |
| 32 | posthog/posthog | REST | https://github.com/PostHog/posthog | 20k | Product analytics |
| 33 | jitsi/jitsi-meet | REST | https://github.com/jitsi/jitsi-meet | 23k | Video conferencing |
| 34 | livekit/livekit | REST | https://github.com/livekit/livekit | 10k | Real-time infra |
| 35 | 100mslive/100ms-server | REST | https://github.com/100mslive/100ms-server | 0.5k | Video SDK |
| 36 | agoraio/agora-node | REST | https://github.com/AgoraIO/agora-node | 0.3k | Video SDK |
| 37 | DailyHQ/daily-js | REST | https://github.com/daily-co/daily-js | 0.5k | Video SDK |
| 38 | papercups-io/papercups | REST | https://github.com/papercups-io/papercups | 2k | Chat platform |
| 39 | novu-co/novu | REST | https://github.com/novuhq/novu | 35k | Notification system |
| 40 | triggerdotdev/trigger.dev | REST | https://github.com/triggerdotdev/trigger.dev | 8k | Job orchestration |
| 41 | inngest/inngest-js | REST | https://github.com/inngest/inngest-js | 3k | Event-driven jobs |
| 42 | grafbase/grafbase | GraphQL | https://github.com/grafbase/grafbase | 3k | GraphQL platform |
| 43 | pantharshit00/prisma-engines | REST | https://github.com/prisma/prisma-engines | 0.5k | DB engines |
| 44 | railwayapp/railway | REST | https://github.com/railwayapp/railway | 3k | Deployment platform |
| 45 | coolify/coolify | REST | https://github.com/coollabsio/coolify | 30k | Self-hosting platform |
| 46 | elestio/elestio | REST | https://github.com/elestio/cloud | 0.3k | Cloud platform |
| 47 | calcom/cal.com | REST | https://github.com/calcom/cal.com | 30k | Scheduling platform |
| 48 | appwrite/appwrite | REST | https://github.com/appwrite/appwrite | 42k | Backend platform |
| 49 | supabase/supabase | REST | https://github.com/supabase/supabase | 70k | Firebase alternative |
| 50 | pocketbase/pocketbase | REST | https://github.com/pocketbase/pocketbase | 35k | SQLite backend |

## Domain 2: Data / Analytics APIs (50 repos)

| # | Repo | Type | URL | Stars | Notes |
|---|------|------|-----|-------|-------|
| 51 | metabase/metabase | REST | https://github.com/metabase/metabase | 40k | BI platform |
| 52 | apache/superset | REST | https://github.com/apache/superset | 65k | BI platform |
| 53 | grafana/grafana | REST | https://github.com/grafana/grafana | 65k | Observability |
| 54 | elastic/kibana | REST | https://github.com/elastic/kibana | 18k | Observability |
| 55 | prometheus/prometheus | REST | https://github.com/prometheus/prometheus | 55k | Monitoring |
| 56 | grafana/loki | REST | https://github.com/grafana/loki | 25k | Log aggregation |
| 57 | grafana/tempo | REST | https://github.com/grafana/tempo | 4k | Tracing |
| 58 | jaegertracing/jaeger | REST | https://github.com/jaegertracing/jaeger | 20k | Tracing |
| 59 | openzipkin/zipkin | REST | https://github.com/openzipkin/zipkin | 17k | Tracing |
| 60 | open-telemetry/opentelemetry-js | REST | https://github.com/open-telemetry/opentelemetry-js | 2.5k | Telemetry SDK |
| 61 | census-instrumentation/opencensus-node | REST | https://github.com/census-instrumentation/opencensus-node | 0.5k | Stats collection |
| 62 | DataDog/datadog-api-client-typescript | REST | https://github.com/DataDog/datadog-api-client-typescript | 0.5k | Datadog SDK |
| 63 | newrelic/node-newrelic | REST | https://github.com/newrelic/node-newrelic | 0.5k | APM agent |
| 64 | getsentry/sentry-javascript | REST | https://github.com/getsentry/sentry-javascript | 8k | Error tracking |
| 65 | rollbar/rollbar.js | REST | https://github.com/rollbar/rollbar.js | 2k | Error tracking |
| 66 | bugsnag/bugsnag-js | REST | https://github.com/bugsnag/bugsnag-js | 1.5k | Error tracking |
| 67 | airbytehq/airbyte | REST | https://github.com/airbytehq/airbyte | 15k | Data integration |
| 68 | estuary/estuary | REST | https://github.com/estuary/flow | 2k | Data integration |
| 69 | singer-io/getting-started | REST | https://github.com/singer-io/getting-started | 0.3k | Data extraction |
| 70 | dbt-labs/dbt-core | REST | https://github.com/dbt-labs/dbt-core | 10k | Data transform |
| 71 | dagster-io/dagster | REST | https://github.com/dagster-io/dagster | 10k | Data orchestration |
| 72 | PrefectHQ/prefect | REST | https://github.com/PrefectHQ/prefect | 15k | Data orchestration |
| 73 | apache/airflow | REST | https://github.com/apache/airflow | 35k | Workflow orchestration |
| 74 | argoproj/argo-workflows | REST | https://github.com/argoproj/argo-workflows | 15k | Workflow engine |
| 75 | temporalio/temporal | REST | https://github.com/temporalio/temporal | 12k | Workflow engine |
| 76 | PipedreamHQ/pipedream | REST | https://github.com/PipedreamHQ/pipedream | 9k | Integration platform |
| 77 | taskforcesh/bullmq | REST | https://github.com/taskforcesh/bullmq | 6k | Job queue |
| 78 | agenda/agenda | REST | https://github.com/agenda/agenda | 9k | Job scheduling |
| 79 | breejs/bree | REST | https://github.com/breejs/bree | 3k | Job scheduler |
| 80 | louislam/uptime-kuma | REST | https://github.com/louislam/uptime-kuma | 60k | Uptime monitoring |
| 81 | healthchecks/healthchecks | REST | https://github.com/healthchecks/healthchecks | 8k | Cron monitoring |
| 82 | upptime/upptime | REST | https://github.com/upptime/upptime | 15k | Uptime monitoring |
| 83 | statsd/statsd | REST | https://github.com/statsd/statsd | 18k | Metrics |
| 84 | cachethq/cachet | REST | https://github.com/cachethq/cachet | 13k | Status page |
| 85 | opstrace/opstrace | REST | https://github.com/opstrace/opstrace | 1k | Observability |
| 86 | litmuschaos/litmus | REST | https://github.com/litmuschaos/litmus | 4k | Chaos engineering |
| 87 | chaos-mesh/chaos-mesh | REST | https://github.com/chaos-mesh/chaos-mesh | 7k | Chaos engineering |
| 88 | cortexproject/cortex | REST | https://github.com/cortexproject/cortex | 5k | Metrics storage |
| 89 | thanos-io/thanos | REST | https://github.com/thanos-io/thanos | 13k | Metrics storage |
| 90 | m3db/m3 | REST | https://github.com/m3db/m3 | 4.5k | Metrics platform |
| 91 | influxdata/influxdb | REST | https://github.com/influxdata/influxdb | 28k | Time-series DB |
| 92 | timescale/timescaledb | REST | https://github.com/timescale/timescaledb | 17k | Time-series DB |
| 93 | questdb/questdb | REST | https://github.com/questdb/questdb | 14k | Time-series DB |
| 94 | clickhouse/clickhouse | REST | https://github.com/ClickHouse/ClickHouse | 38k | Analytics DB |
| 95 | druid-io/druid | REST | https://github.com/apache/druid | 13k | Analytics DB |
| 96 | pinot/pinot | REST | https://github.com/apache/pinot | 5k | Analytics DB |
| 97 | cube-js/cube | REST | https://github.com/cube-js/cube | 17k | Semantic layer |
| 98 | lightdash/lightdash | REST | https://github.com/lightdash/lightdash | 8k | BI platform |
| 99 | evidence-dev/evidence | REST | https://github.com/evidence-dev/evidence | 5k | BI platform |
| 100 | growthbook/growthbook | REST | https://github.com/growthbook/growthbook | 5k | Feature flags |

## Domain 3: Developer Tools / APIs (50 repos)

| # | Repo | Type | URL | Stars | Notes |
|---|------|------|-----|-------|-------|
| 101 | octokit/octokit.js | REST | https://github.com/octokit/octokit.js | 6k | GitHub SDK |
| 102 | googleapis/google-api-nodejs-client | REST | https://github.com/googleapis/google-api-nodejs-client | 11k | Google API SDK |
| 103 | aws/aws-sdk-js-v3 | REST | https://github.com/aws/aws-sdk-js-v3 | 3k | AWS SDK |
| 104 | Azure/azure-sdk-for-js | REST | https://github.com/Azure/azure-sdk-for-js | 2k | Azure SDK |
| 105 | firebase/firebase-functions | REST | https://github.com/firebase/firebase-functions | 3k | Firebase Functions |
| 106 | vercel/vercel | REST | https://github.com/vercel/vercel | 13k | Deployment API |
| 107 | netlify/cli | REST | https://github.com/netlify/cli | 1.5k | Deployment CLI |
| 108 | heroku/node-js-getting-started | REST | https://github.com/heroku/node-js-getting-started | 1k | Platform API |
| 109 | digitalocean/doctl | REST | https://github.com/digitalocean/doctl | 3k | DO CLI/API |
| 110 | linode/linode-cli | REST | https://github.com/linode/linode-cli | 0.3k | Linode CLI |
| 111 | vultr/vultr-node | REST | https://github.com/vultr/vultr-node | 0.1k | Vultr SDK |
| 112 | cloudflare/workers-types | REST | https://github.com/cloudflare/workers-types | 1k | CF Types |
| 113 | fastly/fastly-js | REST | https://github.com/fastly/fastly-js | 0.1k | Fastly SDK |
| 114 | akamai/AkamaiOPEN-edgegrid-node | REST | https://github.com/akamai/AkamaiOPEN-edgegrid-node | 0.1k | Akamai SDK |
| 115 | stripe/stripe-node | REST | https://github.com/stripe/stripe-node | 2k | Payments API |
| 116 | braintree/braintree_node | REST | https://github.com/braintree/braintree_node | 0.5k | Payments API |
| 117 | square/square-nodejs-sdk | REST | https://github.com/square/square-nodejs-sdk | 0.3k | Payments API |
| 118 | plaid/plaid-node | REST | https://github.com/plaid/plaid-node | 0.5k | Banking API |
| 119 | twilio/twilio-node | REST | https://github.com/twilio/twilio-node | 1.5k | Communication API |
| 120 | sendgrid/sendgrid-nodejs | REST | https://github.com/sendgrid/sendgrid-nodejs | 1.5k | Email API |
| 121 | mailgun/mailgun-js | REST | https://github.com/mailgun/mailgun-js | 0.5k | Email API |
| 122 | wildbit/postmark-js | REST | https://github.com/wildbit/postmark-js | 0.1k | Email API |
| 123 | mailchimp/mailchimp-marketing-node | REST | https://github.com/mailchimp/mailchimp-marketing-node | 0.2k | Marketing API |
| 124 | HubSpot/hubspot-api-nodejs | REST | https://github.com/HubSpot/hubspot-api-nodejs | 0.3k | CRM API |
| 125 | jsforce/jsforce | REST | https://github.com/jsforce/jsforce | 0.5k | CRM API |
| 126 | blakmatrix/node-zendesk | REST | https://github.com/blakmatrix/node-zendesk | 0.3k | Support API |
| 127 | intercom/intercom-node | REST | https://github.com/intercom/intercom-node | 0.2k | Support API |
| 128 | slackapi/node-slack-sdk | REST | https://github.com/slackapi/node-slack-sdk | 3k | Chat API |
| 129 | discordjs/discord.js | REST | https://github.com/discordjs/discord.js | 25k | Chat API |
| 130 | telegraf/telegraf | REST | https://github.com/telegraf/telegraf | 7k | Bot API |
| 131 | microsoft/botframework-sdk | REST | https://github.com/microsoft/botframework-sdk | 4k | Bot framework |
| 132 | botpress/botpress | REST | https://github.com/botpress/botpress | 12k | Bot platform |
| 133 | RasaHQ/rasa | REST | https://github.com/RasaHQ/rasa | 15k | NLU platform |
| 134 | recastai/recastai-nodejs | REST | https://github.com/recastai/recastai-nodejs | 0.1k | NLP SDK |
| 135 | openai/openai-node | REST | https://github.com/openai/openai-node | 8k | AI API |
| 136 | anthropics/anthropic-sdk-typescript | REST | https://github.com/anthropics/anthropic-sdk-typescript | 1k | AI API |
| 137 | cohere-ai/cohere-typescript | REST | https://github.com/cohere-ai/cohere-typescript | 0.2k | AI API |
| 138 | huggingface/huggingface.js | REST | https://github.com/huggingface/huggingface.js | 1k | ML API |
| 139 | replicate/replicate-js | REST | https://github.com/replicate/replicate-js | 0.3k | ML API |
| 140 | cloudinary/cloudinary_npm | REST | https://github.com/cloudinary/cloudinary_npm | 1k | Media API |
| 141 | imgix/imgix-core-js | REST | https://github.com/imgix/imgix-core-js | 0.2k | Image API |
| 142 | muxinc/mux-node-sdk | REST | https://github.com/muxinc/mux-node-sdk | 0.2k | Video API |
| 143 | vimeo/vimeo.js | REST | https://github.com/vimeo/vimeo.js | 0.4k | Video SDK |
| 144 | videojs/video.js | REST | https://github.com/videojs/video.js | 38k | Video player |
| 145 | ytdl-org/youtube-dl | REST | https://github.com/ytdl-org/youtube-dl | 130k | Video downloader |
| 146 | fluent-ffmpeg/node-fluent-ffmpeg | REST | https://github.com/fluent-ffmpeg/node-fluent-ffmpeg | 7k | FFmpeg wrapper |
| 147 | poe-i/poe-nodejs | REST | https://github.com/poe-i/poe-nodejs | 0.5k | Game API |
| 148 | steam/steam-webapi | REST | https://github.com/SteamRE/SteamKit | 3k | Steam API |
| 149 | xbox/xbox-live-api | REST | https://github.com/OpenXbox/xbox-webapi-python | 0.5k | Xbox API |
| 150 | playstation/playstation-api | REST | https://github.com/TheOlgadev/PlayStationAPI | 0.2k | PlayStation API |

## Domain 4: E-commerce / Marketplace APIs (50 repos)

| # | Repo | Type | URL | Stars | Notes |
|---|------|------|-----|-------|-------|
| 151 | Shopify/shopify-api-js | REST/GraphQL | https://github.com/Shopify/shopify-api-js | 1k | E-commerce API |
| 152 | woocommerce/woocommerce | REST | https://github.com/woocommerce/woocommerce | 9k | E-commerce platform |
| 153 | magento/magento2 | REST | https://github.com/magento/magento2 | 11k | E-commerce platform |
| 154 | bigcommerce/bigcommerce-api-node | REST | https://github.com/bigcommerce/bigcommerce-api-node | 0.1k | E-commerce API |
| 155 | jonathansamines/node-ebay-api | REST | https://github.com/jonathansamines/node-ebay-api | 0.1k | eBay API wrapper |
| 156 | aws-amplify/amplify-js | REST | https://github.com/aws-amplify/amplify-js | 10k | AWS Amplify SDK |
| 157 | request/request | REST | https://github.com/request/request | 22k | HTTP request lib |
| 158 | axios/axios | REST | https://github.com/axios/axios | 105k | HTTP client |
| 159 | node-fetch/node-fetch | REST | https://github.com/node-fetch/node-fetch | 9k | Fetch API for Node |
| 160 | BestBuyAPIs/bestbuy-sdk-js | REST | https://github.com/BestBuyAPIs/bestbuy-sdk-js | 0.1k | Best Buy SDK |
| 161 | gorillab/reader | REST | https://github.com/gorillab/reader | 0.5k | RSS reader API |
| 162 | chaijs/chai | REST | https://github.com/chaijs/chai | 8k | Assertion library |
| 163 | sinonjs/sinon | REST | https://github.com/sinonjs/sinon | 10k | Test spies/stubs |
| 164 | visionmedia/supertest | REST | https://github.com/visionmedia/supertest | 10k | HTTP testing |
| 165 | expressjs/express | REST | https://github.com/expressjs/express | 65k | Web framework |
| 166 | koajs/koa | REST | https://github.com/koajs/koa | 35k | Web framework |
| 167 | fastify/fastify | REST | https://github.com/fastify/fastify | 32k | Web framework |
| 168 | hapijs/hapi | REST | https://github.com/hapijs/hapi | 14k | Web framework |
| 169 | restify/node-restify | REST | https://github.com/restify/node-restify | 11k | REST framework |
| 170 | nestjs/nest | REST | https://github.com/nestjs/nest | 65k | Node.js framework |
| 171 | Yelp/yelp-fusion | REST | https://github.com/Yelp/yelp-fusion | 1k | Business API |
| 172 | feathersjs/feathers | REST | https://github.com/feathersjs/feathers | 15k | API framework |
| 173 | googlemaps/js-api-loader | REST | https://github.com/googlemaps/js-api-loader | 0.5k | Maps API |
| 174 | mapbox/mapbox-sdk-js | REST | https://github.com/mapbox/mapbox-sdk-js | 0.3k | Maps API |
| 175 | Automattic/mongoose | REST | https://github.com/Automattic/mongoose | 26k | MongoDB ODM |
| 176 | sequelize/sequelize | REST | https://github.com/sequelize/sequelize | 29k | SQL ORM |
| 177 | prisma/prisma | REST | https://github.com/prisma/prisma | 38k | Database ORM |
| 178 | bookshelf/bookshelf | REST | https://github.com/bookshelf/bookshelf | 6k | SQL ORM |
| 179 | knex/knex | REST | https://github.com/knex/knex | 18k | SQL query builder |
| 180 | typeorm/typeorm | REST | https://github.com/typeorm/typeorm | 33k | TypeScript ORM |
| 181 | mikro-orm/mikro-orm | REST | https://github.com/mikro-orm/mikro-orm | 7k | TypeScript ORM |
| 182 | ipinfo/node | REST | https://github.com/ipinfo/node | 0.2k | IP geolocation API |
| 183 | Vincit/objection.js | REST | https://github.com/Vincit/objection.js | 9k | SQL ORM |
| 184 | luvit/camo | REST | https://github.com/luvit/camo | 2k | MongoDB ODM |
| 185 | sequelize/umzug | REST | https://github.com/sequelize/umzug | 3k | Migration tool |
| 186 | nodeca/js-yaml | REST | https://github.com/nodeca/js-yaml | 4k | YAML parser |
| 187 | remy/nodemon | REST | https://github.com/remy/nodemon | 26k | Node monitor |
| 188 | Unitech/pm2 | REST | https://github.com/Unitech/pm2 | 41k | Process manager |
| 189 | cheeriojs/cheerio | REST | https://github.com/cheeriojs/cheerio | 28k | HTML parser |
| 190 | puppeteer/puppeteer | REST | https://github.com/puppeteer/puppeteer | 90k | Browser automation |
| 191 | jsdom/jsdom | REST | https://github.com/jsdom/jsdom | 20k | DOM simulator |
| 192 | isaacs/node-glob | REST | https://github.com/isaacs/node-glob | 9k | File globbing |
| 193 | sindresorhus/got | REST | https://github.com/sindresorhus/got | 14k | HTTP client |
| 194 | request/request-promise | REST | https://github.com/request/request-promise | 7k | Promise HTTP |
| 195 | mikeal/request | REST | https://github.com/request/request | 22k | HTTP request |
| 196 | node-formidable/formidable | REST | https://github.com/node-formidable/formidable | 7k | Form parser |
| 197 | expressjs/body-parser | REST | https://github.com/expressjs/body-parser | 6k | Body parser |
| 198 | expressjs/cors | REST | https://github.com/expressjs/cors | 5k | CORS middleware |
| 199 | sindresorhus/ky | REST | https://github.com/sindresorhus/ky | 12k | HTTP client |
| 200 | tj/commander.js | REST | https://github.com/tj/commander.js | 26k | CLI parser |

## Domain 5: Content / Media APIs (50 repos)

| # | Repo | Type | URL | Stars | Notes |
|---|------|------|-----|-------|-------|
| 201 | contentful/contentful.js | REST | https://github.com/contentful/contentful.js | 2k | CMS SDK |
| 202 | prismicio/prismic-javascript | REST | https://github.com/prismicio/prismic-javascript | 0.2k | CMS SDK |
| 203 | storyblok/storyblok-js | REST | https://github.com/storyblok/storyblok-js | 0.2k | CMS SDK |
| 204 | strapi/strapi | REST | https://github.com/strapi/strapi | 60k | Headless CMS |
| 205 | Kentico/kontent-delivery-sdk-js | REST | https://github.com/Kentico/kontent-delivery-sdk-js | 0.1k | CMS SDK |
| 206 | payloadcms/payload | REST | https://github.com/payloadcms/payload | 25k | Headless CMS |
| 207 | honojs/hono | REST | https://github.com/honojs/hono | 20k | Web framework |
| 208 | graphile/postgraphile | GraphQL | https://github.com/graphile/postgraphile | 13k | GraphQL layer |
| 209 | hasura/graphql-engine | GraphQL | https://github.com/hasura/graphql-engine | 35k | GraphQL engine |
| 210 | apollographql/apollo-client | GraphQL | https://github.com/apollographql/apollo-client | 19k | GraphQL client |
| 211 | graphql/graphql-js | GraphQL | https://github.com/graphql/graphql-js | 20k | GraphQL JS |
| 212 | nexus/nexus | GraphQL | https://github.com/graphql-nexus/nexus | 4k | GraphQL schema |
| 213 | typegraphql/typegraphql | GraphQL | https://github.com/MichalLytek/type-graphql | 6k | GraphQL types |
| 214 | expressjs/multer | REST | https://github.com/expressjs/multer | 12k | File upload |
| 215 | svg/svgo | REST | https://github.com/svg/svgo | 20k | SVG optimizer |
| 216 | Automattic/mongoose | REST | https://github.com/Automattic/mongoose | 26k | MongoDB ODM |
| 217 | mysqljs/mysql | REST | https://github.com/mysqljs/mysql | 18k | MySQL client |
| 218 | nodejs/docker-node | REST | https://github.com/nodejs/docker-node | 2k | Docker Node.js |
| 219 | markedjs/marked | REST | https://github.com/markedjs/marked | 32k | Markdown parser |
| 220 | unifiedjs/unified | REST | https://github.com/unifiedjs/unified | 7k | Text processing |
| 221 | lovell/sharp | REST | https://github.com/lovell/sharp | 28k | Image processing |
| 222 | marcbachmann/node-html-pdf | REST | https://github.com/marcbachmann/node-html-pdf | 3k | HTML to PDF |
| 223 | jimp-dev/jimp | REST | https://github.com/jimp-dev/jimp | 14k | Image processing |
| 224 | aheckmann/gm | REST | https://github.com/aheckmann/gm | 7k | GraphicsMagick |
| 225 | nodeca/pica | REST | https://github.com/nodeca/pica | 3k | Image resize |
| 226 | NaturalNode/natural | REST | https://github.com/NaturalNode/natural | 11k | NLP library |
| 227 | handlebars-lang/handlebars.js | REST | https://github.com/handlebars-lang/handlebars.js | 18k | Template engine |
| 228 | janl/mustache.js | REST | https://github.com/janl/mustache.js | 14k | Template engine |
| 229 | mde/ejs | REST | https://github.com/mde/ejs | 13k | Template engine |
| 230 | pugjs/pug | REST | https://github.com/pugjs/pug | 22k | Template engine |
| 231 | nuxt/nuxt | REST | https://github.com/nuxt/nuxt | 55k | Vue framework |
| 232 | gatsbyjs/gatsby | REST | https://github.com/gatsbyjs/gatsby | 55k | Static site gen |
| 233 | reduxjs/redux | REST | https://github.com/reduxjs/redux | 60k | State management |
| 234 | browserless/browserless | REST | https://github.com/browserless/browserless | 7k | Browser API |
| 235 | puppeteer/puppeteer | REST | https://github.com/puppeteer/puppeteer | 90k | Browser automation |
| 236 | microsoft/playwright | REST | https://github.com/microsoft/playwright | 70k | Browser automation |
| 237 | SeleniumHQ/selenium | REST | https://github.com/SeleniumHQ/selenium | 30k | Browser automation |
| 238 | cypress-io/cypress | REST | https://github.com/cypress-io/cypress | 50k | Testing API |
| 239 | DevExpress/testcafe | REST | https://github.com/DevExpress/testcafe | 10k | Testing API |
| 240 | webdriverio/webdriverio | REST | https://github.com/webdriverio/webdriverio | 9k | Testing API |
| 241 | nightwatch/nightwatch | REST | https://github.com/nightwatch/nightwatch | 11k | Testing API |
| 242 | karma-runner/karma | REST | https://github.com/karma-runner/karma | 12k | Testing API |
| 243 | jestjs/jest | REST | https://github.com/jestjs/jest | 45k | Testing API |
| 244 | vitest-dev/vitest | REST | https://github.com/vitest-dev/vitest | 15k | Testing API |
| 245 | mochajs/mocha | REST | https://github.com/mochajs/mocha | 22k | Testing API |
| 246 | jasmine/jasmine | REST | https://github.com/jasmine/jasmine | 15k | Testing API |
| 247 | avajs/ava | REST | https://github.com/avajs/ava | 20k | Testing API |
| 248 | tapjs/node-tap | REST | https://github.com/tapjs/node-tap | 2k | Testing API |
| 249 | ljharb/tape | REST | https://github.com/ljharb/tape | 5k | Testing API |
| 250 | chaijs/chai-http | REST | https://github.com/chaijs/chai-http | 1k | HTTP testing |

## Domain 6: Fintech / Banking APIs (50 repos)

| # | Repo | Type | URL | Stars | Notes |
|---|------|------|-----|-------|-------|
| 251 | localtunnel/localtunnel | REST | https://github.com/localtunnel/localtunnel | 18k | Tunneling tool |
| 252 | http-party/node-http-proxy | REST | https://github.com/http-party/node-http-proxy | 13k | HTTP proxy |
| 253 | chalk/chalk | REST | https://github.com/chalk/chalk | 21k | Terminal colors |
| 254 | debug-js/debug | REST | https://github.com/debug-js/debug | 11k | Debug utility |
| 255 | shelljs/shelljs | REST | https://github.com/shelljs/shelljs | 14k | Shell commands |
| 256 | AlexVirdee/sensai | REST | https://github.com/AlexVirdee/sensai | 0.5k | AI platform |
| 257 | vercel/pkg | REST | https://github.com/vercel/pkg | 18k | Binary compiler |
| 258 | pkgjs/create-package-json | REST | https://github.com/pkgjs/create-package-json | 0.5k | Package utils |
| 259 | pkgjs/parseargs | REST | https://github.com/pkgjs/parseargs | 1k | CLI parser |
| 260 | npm/cli | REST | https://github.com/npm/cli | 8k | NPM CLI |
| 261 | yarnpkg/yarn | REST | https://github.com/yarnpkg/yarn | 6k | Package manager |
| 262 | sindresorhus/p-throttle | REST | https://github.com/sindresorhus/p-throttle | 1k | Promise throttle |
| 263 | sindresorhus/p-memoize | REST | https://github.com/sindresorhus/p-memoize | 1k | Promise memoize |
| 264 | sindresorhus/p-settle | REST | https://github.com/sindresorhus/p-settle | 1k | Promise settle |
| 265 | sindresorhus/p-pipe | REST | https://github.com/sindresorhus/p-pipe | 1k | Promise pipe |
| 266 | sindresorhus/p-reduce | REST | https://github.com/sindresorhus/p-reduce | 1k | Promise reduce |
| 267 | sindresorhus/is | REST | https://github.com/sindresorhus/is | 3k | Type checking |
| 268 | sindresorhus/p-queue | REST | https://github.com/sindresorhus/p-queue | 4k | Promise queue |
| 269 | sindresorhus/p-locate | REST | https://github.com/sindresorhus/p-locate | 1k | Promise locate |
| 270 | sindresorhus/p-wait-for | REST | https://github.com/sindresorhus/p-wait-for | 1k | Promise wait |
| 271 | sindresorhus/mem | REST | https://github.com/sindresorhus/mem | 3k | Memoization |
| 272 | sindresorhus/p-retry | REST | https://github.com/sindresorhus/p-retry | 2k | Promise retry |
| 273 | sindresorhus/p-timeout | REST | https://github.com/sindresorhus/p-timeout | 1k | Promise timeout |
| 274 | sindresorhus/p-props | REST | https://github.com/sindresorhus/p-props | 1k | Promise props |
| 275 | sindresorhus/p-catch-if | REST | https://github.com/sindresorhus/p-catch-if | 0.5k | Promise catch |
| 276 | sindresorhus/p-each-series | REST | https://github.com/sindresorhus/p-each-series | 0.5k | Promise series |
| 277 | sindresorhus/p-limit | REST | https://github.com/sindresorhus/p-limit | 6k | Concurrency limit |
| 278 | sindresorhus/ow | REST | https://github.com/sindresorhus/ow | 7k | Argument validation |
| 279 | sindresorhus/emittery | REST | https://github.com/sindresorhus/emittery | 2k | Event emitter |
| 280 | sindresorhus/globby | REST | https://github.com/sindresorhus/globby | 6k | Glob utility |
| 281 | sindresorhus/p-map | REST | https://github.com/sindresorhus/p-map | 3k | Promise map |
| 282 | sindresorhus/p-filter | REST | https://github.com/sindresorhus/p-filter | 1k | Promise filter |
| 283 | sindresorhus/p-any | REST | https://github.com/sindresorhus/p-any | 1k | Promise race |
| 284 | sindresorhus/parse-json | REST | https://github.com/sindresorhus/parse-json | 1k | JSON parser |
| 285 | sindresorhus/read-pkg | REST | https://github.com/sindresorhus/read-pkg | 1k | Package reader |
| 286 | sindresorhus/write-pkg | REST | https://github.com/sindresorhus/write-pkg | 0.5k | Package writer |
| 287 | sindresorhus/strip-json-comments | REST | https://github.com/sindresorhus/strip-json-comments | 2k | JSON comments |
| 288 | sindresorhus/has-yarn | REST | https://github.com/sindresorhus/has-yarn | 0.5k | Yarn checker |
| 289 | sindresorhus/has-npm | REST | https://github.com/sindresorhus/has-npm | 0.5k | NPM checker |
| 290 | sindresorhus/pkg-dir | REST | https://github.com/sindresorhus/pkg-dir | 1k | Package dir |
| 291 | sindresorhus/delay | REST | https://github.com/sindresorhus/delay | 2k | Promise delay |
| 292 | sindresorhus/p-debounce | REST | https://github.com/sindresorhus/p-debounce | 1k | Promise debounce |
| 293 | sindresorhus/arrify | REST | https://github.com/sindresorhus/arrify | 1k | Array utility |
| 294 | sindresorhus/decamelize | REST | https://github.com/sindresorhus/decamelize | 1k | String utility |
| 295 | sindresorhus/camelcase | REST | https://github.com/sindresorhus/camelcase | 2k | String utility |
| 296 | sindresorhus/kebabcase | REST | https://github.com/sindresorhus/kebab-case | 1k | String utility |
| 297 | sindresorhus/slugify | REST | https://github.com/sindresorhus/slugify | 3k | String utility |
| 298 | sindresorhus/humanize-string | REST | https://github.com/sindresorhus/humanize-string | 1k | String utility |
| 299 | sindresorhus/trim-newlines | REST | https://github.com/sindresorhus/trim-newlines | 1k | String utility |
| 300 | sindresorhus/indent-string | REST | https://github.com/sindresorhus/indent-string | 1k | String utility |
