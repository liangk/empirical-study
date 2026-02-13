# Study 1: Blocking I/O — Public Node.js Repository Sample List

> Compiled for the "Hidden Cost of Blocking I/O" empirical study.
> All repos are public GitHub repositories suitable for scanning for synchronous I/O patterns:
> `readFileSync`, `writeFileSync`, `existsSync`, `readdirSync`, `statSync`,
> `execSync`, `spawnSync`, `crypto.pbkdf2Sync`, `crypto.scryptSync`,
> `crypto.randomBytes` (sync overload), `JSON.parse(readFileSync(...))`, etc.

---

## Scan Targets (Blocking Patterns to Detect)

| Pattern | Module | Severity in Request Path |
|---------|--------|--------------------------|
| `fs.readFileSync` | `fs` | High |
| `fs.writeFileSync` | `fs` | High |
| `fs.existsSync` | `fs` | Medium |
| `fs.readdirSync` | `fs` | Medium |
| `fs.statSync` / `fs.lstatSync` | `fs` | Medium |
| `fs.mkdirSync` | `fs` | Low-Medium |
| `fs.accessSync` | `fs` | Medium |
| `fs.copyFileSync` | `fs` | High |
| `child_process.execSync` | `child_process` | Critical |
| `child_process.spawnSync` | `child_process` | Critical |
| `child_process.execFileSync` | `child_process` | Critical |
| `crypto.pbkdf2Sync` | `crypto` | High (CPU-bound) |
| `crypto.scryptSync` | `crypto` | High (CPU-bound) |
| `crypto.randomFillSync` | `crypto` | Medium |
| `crypto.generateKeyPairSync` | `crypto` | High |
| `zlib.deflateSync` / `inflateSync` / `gzipSync` / `gunzipSync` | `zlib` | High |
| `dns.lookupSync` (via `dns` module) | `dns` | High |

---

## Category 1: Web Frameworks & HTTP Servers

These repos define the server abstractions. Blocking patterns in core or examples propagate to downstream users.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 1 | expressjs/express | https://github.com/expressjs/express | 65k+ | De facto standard Node.js web framework |
| 2 | fastify/fastify | https://github.com/fastify/fastify | 33k+ | High-performance web framework |
| 3 | koajs/koa | https://github.com/koajs/koa | 35k+ | Next-gen web framework by Express team |
| 4 | hapijs/hapi | https://github.com/hapijs/hapi | 14k+ | Enterprise-grade framework |
| 5 | nestjs/nest | https://github.com/nestjs/nest | 69k+ | Progressive Node.js framework (TypeScript) |
| 6 | trpc/trpc | https://github.com/trpc/trpc | 35k+ | End-to-end typesafe APIs |
| 7 | feathersjs/feathers | https://github.com/feathersjs/feathers | 15k+ | Real-time framework |
| 8 | adonisjs/core | https://github.com/adonisjs/core | 17k+ | TypeScript-first web framework |
| 9 | moleculerjs/moleculer | https://github.com/moleculerjs/moleculer | 6k+ | Microservices framework |
| 10 | total-typescript/ts-reset | https://github.com/total-typescript/ts-reset | 8k+ | TypeScript utility |

## Category 2: CMS & Headless CMS

CMS platforms are prime candidates — they handle file uploads, template rendering, and config loading in request paths.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 11 | TryGhost/Ghost | https://github.com/TryGhost/Ghost | 48k+ | Publishing platform (Express-based) |
| 12 | strapi/strapi | https://github.com/strapi/strapi | 65k+ | Headless CMS (Koa-based) |
| 13 | keystonejs/keystone | https://github.com/keystonejs/keystone | 9k+ | Headless CMS & GraphQL API |
| 14 | payloadcms/payload | https://github.com/payloadcms/payload | 28k+ | Headless CMS (Next.js/Express) |
| 15 | directus/directus | https://github.com/directus/directus | 29k+ | Data platform / headless CMS |
| 16 | apostrophecms/apostrophe | https://github.com/apostrophecms/apostrophe | 4k+ | Full-featured CMS |
| 17 | Putaitu/hashbrown-cms | https://github.com/Putaitu/hashbrown-cms | 300+ | Headless CMS |
| 18 | gilbitron/Raneto | https://github.com/gilbitron/Raneto | 2.8k+ | Markdown knowledgebase |
| 19 | getgrav/grav | https://github.com/getgrav/grav | 14k+ | Flat-file CMS (has Node.js build tools) |
| 20 | webiny/webiny-js | https://github.com/webiny/webiny-js | 7k+ | Serverless headless CMS |

## Category 3: Full-Stack Application Boilerplates

Boilerplates are high-value targets — patterns here get copied into thousands of production apps.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 21 | sahat/hackathon-starter | https://github.com/sahat/hackathon-starter | 35k+ | Node.js web app boilerplate |
| 22 | hagopj13/node-express-boilerplate | https://github.com/hagopj13/node-express-boilerplate | 7k+ | Express + Mongoose REST API |
| 23 | santiq/bulletproof-nodejs | https://github.com/santiq/bulletproof-nodejs | 5k+ | Express.js project architecture |
| 24 | danielfsousa/express-rest-boilerplate | https://github.com/danielfsousa/express-rest-boilerplate | 2k+ | Express REST boilerplate |
| 25 | madhums/node-express-mongoose | https://github.com/madhums/node-express-mongoose | 5k+ | Node Express Mongoose demo |
| 26 | w3tecch/express-typescript-boilerplate | https://github.com/w3tecch/express-typescript-boilerplate | 3k+ | Express + TypeScript |
| 27 | edwinhern/express-typescript | https://github.com/edwinhern/express-typescript | 2k+ | Express + TypeScript starter 2025 |
| 28 | kunalkapadia/express-mongoose-es6-rest-api | https://github.com/kunalkapadia/express-mongoose-es6-rest-api | 3k+ | Express ES6 REST API |
| 29 | maitraysuthar/rest-api-nodejs-mongodb | https://github.com/maitraysuthar/rest-api-nodejs-mongodb | 2k+ | REST API Node.js + MongoDB |
| 30 | kriasoft/react-starter-kit | https://github.com/kriasoft/react-starter-kit | 22k+ | React + Express isomorphic starter |
| 31 | react-boilerplate/react-boilerplate | https://github.com/react-boilerplate/react-boilerplate | 29k+ | Scalable React boilerplate |
| 32 | talyssonoc/node-api-boilerplate | https://github.com/talyssonoc/node-api-boilerplate | 3k+ | Domain-driven Node.js API |
| 33 | gothinkster/node-express-realworld-example-app | https://github.com/gothinkster/node-express-realworld-example-app | 3k+ | RealWorld spec (Express + Mongoose) |
| 34 | gothinkster/koa-knex-realworld-example | https://github.com/gothinkster/koa-knex-realworld-example | 300+ | RealWorld spec (Koa + Knex) |
| 35 | linnovate/mean | https://github.com/linnovate/mean | 12k+ | MEAN stack boilerplate |

## Category 4: Real-World Production Applications

Active, production-grade applications where blocking I/O has direct user impact.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 36 | RocketChat/Rocket.Chat | https://github.com/RocketChat/Rocket.Chat | 41k+ | Team communication platform |
| 37 | wekan/wekan | https://github.com/wekan/wekan | 19k+ | Open-source Kanban board |
| 38 | outline/outline | https://github.com/outline/outline | 29k+ | Wiki & knowledge base |
| 39 | medusajs/medusa | https://github.com/medusajs/medusa | 27k+ | Open-source eCommerce |
| 40 | calcom/cal.com | https://github.com/calcom/cal.com | 33k+ | Scheduling infrastructure |
| 41 | nocodb/nocodb | https://github.com/nocodb/nocodb | 50k+ | Open-source Airtable alternative |
| 42 | n8n-io/n8n | https://github.com/n8n-io/n8n | 51k+ | Workflow automation |
| 43 | appwrite/appwrite | https://github.com/appwrite/appwrite | 46k+ | Backend server platform |
| 44 | verdaccio/verdaccio | https://github.com/verdaccio/verdaccio | 16k+ | Private npm registry |
| 45 | etherpad/etherpad-lite | https://github.com/etherpad/etherpad-lite | 17k+ | Real-time collaborative editor |
| 46 | NodeBB/NodeBB | https://github.com/NodeBB/NodeBB | 14k+ | Forum platform |
| 47 | parse-community/parse-server | https://github.com/parse-community/parse-server | 21k+ | Parse backend |
| 48 | Countly/countly-server | https://github.com/Countly/countly-server | 5k+ | Analytics platform |
| 49 | umami-software/umami | https://github.com/umami-software/umami | 23k+ | Website analytics |
| 50 | ToolJet/ToolJet | https://github.com/ToolJet/ToolJet | 33k+ | Low-code platform |
| 51 | twentyhq/twenty | https://github.com/twentyhq/twenty | 24k+ | CRM platform |
| 52 | hoppscotch/hoppscotch | https://github.com/hoppscotch/hoppscotch | 66k+ | API development ecosystem |
| 53 | Budibase/budibase | https://github.com/Budibase/budibase | 23k+ | Low-code platform |
| 54 | ever-co/ever-gauzy | https://github.com/ever-co/ever-gauzy | 2k+ | Business management platform |
| 55 | invoiceninja/invoiceninja | https://github.com/invoiceninja/invoiceninja | 8k+ | Invoicing (has Node.js parts) |
| 56 | lessonspace/react-pdf-viewer | https://github.com/wojtekmaj/react-pdf | 9k+ | PDF rendering |
| 57 | lobehub/lobe-chat | https://github.com/lobehub/lobe-chat | 52k+ | AI chat framework (Next.js) |
| 58 | immich-app/immich | https://github.com/immich-app/immich | 55k+ | Photo & video management |
| 59 | maybe-finance/maybe | https://github.com/maybe-finance/maybe | 35k+ | Personal finance app |
| 60 | documenso/documenso | https://github.com/documenso/documenso | 8k+ | Document signing (Next.js) |

## Category 5: SSR Frameworks & Meta-Frameworks

These run server-side code on every request. Blocking I/O in middleware or route handlers is especially impactful.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 61 | vercel/next.js | https://github.com/vercel/next.js | 128k+ | React framework with SSR |
| 62 | nuxt/nuxt | https://github.com/nuxt/nuxt | 55k+ | Vue.js meta-framework |
| 63 | sveltejs/kit | https://github.com/sveltejs/kit | 19k+ | SvelteKit framework |
| 64 | remix-run/remix | https://github.com/remix-run/remix | 30k+ | Full-stack React framework |
| 65 | withastro/astro | https://github.com/withastro/astro | 48k+ | Content-focused web framework |
| 66 | gatsbyjs/gatsby | https://github.com/gatsbyjs/gatsby | 55k+ | React-based SSG framework |
| 67 | redwoodjs/redwood | https://github.com/redwoodjs/redwood | 17k+ | Full-stack JS/TS framework |
| 68 | blitz-js/blitz | https://github.com/blitz-js/blitz | 14k+ | Full-stack React framework |
| 69 | hexojs/hexo | https://github.com/hexojs/hexo | 40k+ | Blog framework |
| 70 | 11ty/eleventy | https://github.com/11ty/eleventy | 17k+ | Static site generator |

## Category 6: Build Tools & Bundlers

These use many sync operations during build but some leak into dev-server request paths.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 71 | webpack/webpack | https://github.com/webpack/webpack | 65k+ | Module bundler |
| 72 | vitejs/vite | https://github.com/vitejs/vite | 70k+ | Next-gen frontend tooling |
| 73 | parcel-bundler/parcel | https://github.com/parcel-bundler/parcel | 44k+ | Zero-config bundler |
| 74 | evanw/esbuild | https://github.com/evanw/esbuild | 38k+ | Fast bundler (Go + JS) |
| 75 | rollup/rollup | https://github.com/rollup/rollup | 25k+ | Module bundler |
| 76 | swc-project/swc | https://github.com/swc-project/swc | 32k+ | Fast compiler (Rust + JS) |
| 77 | babel/babel | https://github.com/babel/babel | 43k+ | JavaScript compiler |
| 78 | turbopack/turbo | https://github.com/vercel/turbo | 27k+ | Incremental bundler (Rust + JS) |
| 79 | biomejs/biome | https://github.com/biomejs/biome | 16k+ | Formatter/linter |
| 80 | eslint/eslint | https://github.com/eslint/eslint | 25k+ | Linter (uses readFileSync for config) |

## Category 7: CLI Tools & DevOps

CLI tools commonly use sync operations. Some also run as daemon/server processes.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 81 | google/zx | https://github.com/google/zx | 43k+ | Shell scripting in JS |
| 82 | shelljs/shelljs | https://github.com/shelljs/shelljs | 14k+ | Unix shell commands in JS |
| 83 | lerna/lerna | https://github.com/lerna/lerna | 35k+ | Multi-package repository management |
| 84 | changesets/changesets | https://github.com/changesets/changesets | 9k+ | Versioning workflow |
| 85 | semantic-release/semantic-release | https://github.com/semantic-release/semantic-release | 21k+ | Automated versioning |
| 86 | commitizen/cz-cli | https://github.com/commitizen/cz-cli | 17k+ | Commit convention CLI |
| 87 | typicode/husky | https://github.com/typicode/husky | 33k+ | Git hooks |
| 88 | lint-staged/lint-staged | https://github.com/lint-staged/lint-staged | 13k+ | Run linters on staged files |
| 89 | vercel/pkg | https://github.com/vercel/pkg | 24k+ | Package Node.js into executable |
| 90 | tj/commander.js | https://github.com/tj/commander.js | 27k+ | CLI framework |
| 91 | yargs/yargs | https://github.com/yargs/yargs | 11k+ | CLI argument parser |
| 92 | enquirer/enquirer | https://github.com/enquirer/enquirer | 8k+ | CLI prompts |
| 93 | SBoudrias/Inquirer.js | https://github.com/SBoudrias/Inquirer.js | 20k+ | Interactive CLI prompts |
| 94 | sindresorhus/execa | https://github.com/sindresorhus/execa | 7k+ | Process execution |
| 95 | pnpm/pnpm | https://github.com/pnpm/pnpm | 30k+ | Package manager |
| 96 | npm/cli | https://github.com/npm/cli | 8k+ | npm CLI |
| 97 | yarnpkg/berry | https://github.com/yarnpkg/berry | 7k+ | Yarn package manager |
| 98 | volta-cli/volta | https://github.com/volta-cli/volta | 11k+ | Node version manager |
| 99 | nvm-sh/nvm | https://github.com/nvm-sh/nvm | 81k+ | Node Version Manager |
| 100 | Schniz/fnm | https://github.com/Schniz/fnm | 19k+ | Fast Node Manager |

## Category 8: Testing Frameworks & Tools

Test runners use sync I/O heavily. Some also provide server modes (watch, UI).

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 101 | jestjs/jest | https://github.com/jestjs/jest | 44k+ | Testing framework |
| 102 | mochajs/mocha | https://github.com/mochajs/mocha | 23k+ | Test framework |
| 103 | avajs/ava | https://github.com/avajs/ava | 21k+ | Concurrent test runner |
| 104 | cypress-io/cypress | https://github.com/cypress-io/cypress | 47k+ | E2E testing |
| 105 | playwright-community/jest-playwright | https://github.com/playwright-community/jest-playwright | 500+ | Playwright + Jest |
| 106 | vitest-dev/vitest | https://github.com/vitest-dev/vitest | 13k+ | Vite-native test framework |
| 107 | stryker-mutator/stryker-js | https://github.com/stryker-mutator/stryker-js | 3k+ | Mutation testing |
| 108 | nock/nock | https://github.com/nock/nock | 13k+ | HTTP mocking |
| 109 | ladjs/supertest | https://github.com/ladjs/supertest | 14k+ | HTTP assertions |
| 110 | sinonjs/sinon | https://github.com/sinonjs/sinon | 10k+ | Test spies, stubs, mocks |

## Category 9: Authentication & Security Libraries

Auth libraries frequently use synchronous crypto operations in hot paths.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 111 | jaredhanson/passport | https://github.com/jaredhanson/passport | 23k+ | Auth middleware for Express |
| 112 | jaredhanson/passport-local | https://github.com/jaredhanson/passport-local | 4k+ | Local username/password strategy |
| 113 | auth0/node-jsonwebtoken | https://github.com/auth0/node-jsonwebtoken | 18k+ | JWT implementation |
| 114 | kelektiv/node.bcrypt.js | https://github.com/kelektiv/node.bcrypt.js | 8k+ | bcrypt for Node.js |
| 115 | dcodeIO/bcrypt.js | https://github.com/dcodeIO/bcrypt.js | 3k+ | Pure JS bcrypt |
| 116 | panva/jose | https://github.com/panva/jose | 6k+ | JWS/JWE/JWT/JWK |
| 117 | lucia-auth/lucia | https://github.com/lucia-auth/lucia | 10k+ | Auth library |
| 118 | nextauthjs/next-auth | https://github.com/nextauthjs/next-auth | 25k+ | Auth for Next.js |
| 119 | supertokens/supertokens-node | https://github.com/supertokens/supertokens-node | 1k+ | Auth SDK |
| 120 | ory/kratos | https://github.com/ory/kratos | 11k+ | Identity & user management |

## Category 10: API & Backend Services

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 121 | typicode/json-server | https://github.com/typicode/json-server | 73k+ | Fake REST API |
| 122 | mongo-express/mongo-express | https://github.com/mongo-express/mongo-express | 5k+ | MongoDB admin UI |
| 123 | node-red/node-red | https://github.com/node-red/node-red | 20k+ | Visual IoT tool |
| 124 | graphql/graphql-js | https://github.com/graphql/graphql-js | 20k+ | GraphQL reference impl |
| 125 | apollographql/apollo-server | https://github.com/apollographql/apollo-server | 14k+ | GraphQL server |
| 126 | prisma/prisma | https://github.com/prisma/prisma | 40k+ | ORM / database toolkit |
| 127 | sequelize/sequelize | https://github.com/sequelize/sequelize | 29k+ | SQL ORM |
| 128 | typeorm/typeorm | https://github.com/typeorm/typeorm | 34k+ | TypeScript ORM |
| 129 | knex/knex | https://github.com/knex/knex | 19k+ | SQL query builder |
| 130 | Automattic/mongoose | https://github.com/Automattic/mongoose | 27k+ | MongoDB ODM |
| 131 | agenda/agenda | https://github.com/agenda/agenda | 10k+ | Job scheduling |
| 132 | OptimalBits/bull | https://github.com/OptimalBits/bull | 16k+ | Redis-based queue |
| 133 | taskforcesh/bullmq | https://github.com/taskforcesh/bullmq | 6k+ | Message queue |
| 134 | bee-queue/bee-queue | https://github.com/bee-queue/bee-queue | 4k+ | Job/task queue |
| 135 | helmetjs/helmet | https://github.com/helmetjs/helmet | 10k+ | Security headers middleware |

## Category 11: File Upload / Processing / Media

File processing in request handlers is a key source of blocking I/O.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 136 | expressjs/multer | https://github.com/expressjs/multer | 12k+ | Multipart file upload |
| 137 | lovell/sharp | https://github.com/lovell/sharp | 29k+ | Image processing |
| 138 | nodemailer/nodemailer | https://github.com/nodemailer/nodemailer | 17k+ | Email sending |
| 139 | Automattic/juice | https://github.com/Automattic/juice | 3k+ | CSS inlining for email |
| 140 | benphelps/homepage | https://github.com/gethomepage/homepage | 20k+ | Application dashboard |
| 141 | pdfkit/pdfkit | https://github.com/foliojs/pdfkit | 10k+ | PDF generation |
| 142 | bpampuch/pdfmake | https://github.com/bpampuch/pdfmake | 12k+ | PDF from JS |
| 143 | SheetJS/sheetjs | https://github.com/SheetJS/sheetjs | 35k+ | Spreadsheet parsing |
| 144 | exceljs/exceljs | https://github.com/exceljs/exceljs | 14k+ | Excel workbook manager |
| 145 | paulmillr/chokidar | https://github.com/paulmillr/chokidar | 11k+ | File watching |

## Category 12: Logging, Config & Utilities

Config loaders and loggers often use sync I/O at init — but sometimes also per-request.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 146 | winstonjs/winston | https://github.com/winstonjs/winston | 23k+ | Logging library |
| 147 | pinojs/pino | https://github.com/pinojs/pino | 14k+ | Fast logger |
| 148 | log4js-node/log4js-node | https://github.com/log4js-node/log4js-node | 6k+ | Logging framework |
| 149 | motdotla/dotenv | https://github.com/motdotla/dotenv | 19k+ | Environment variable loader |
| 150 | node-config/node-config | https://github.com/node-config/node-config | 6k+ | Configuration manager |
| 151 | mozilla/node-convict | https://github.com/mozilla/node-convict | 2k+ | Config management |
| 152 | cosmiconfig/cosmiconfig | https://github.com/cosmiconfig/cosmiconfig | 4k+ | Config file finder (has sync API) |
| 153 | davidtheclark/cosmiconfig | https://github.com/davidtheclark/cosmiconfig | 4k+ | Config search |
| 154 | mrmlnc/fast-glob | https://github.com/mrmlnc/fast-glob | 3k+ | Glob matching |
| 155 | isaacs/node-glob | https://github.com/isaacs/node-glob | 8k+ | Glob matching (has sync) |

## Category 13: Middleware & Express Ecosystem

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 156 | expressjs/morgan | https://github.com/expressjs/morgan | 8k+ | HTTP request logger |
| 157 | expressjs/cors | https://github.com/expressjs/cors | 6k+ | CORS middleware |
| 158 | expressjs/body-parser | https://github.com/expressjs/body-parser | 6k+ | Body parsing middleware |
| 159 | expressjs/session | https://github.com/expressjs/session | 6k+ | Session middleware |
| 160 | expressjs/serve-static | https://github.com/expressjs/serve-static | 1k+ | Static file serving |
| 161 | expressjs/compression | https://github.com/expressjs/compression | 3k+ | Compression middleware |
| 162 | http-party/http-proxy | https://github.com/http-party/node-http-proxy | 14k+ | HTTP proxy |
| 163 | chimurai/http-proxy-middleware | https://github.com/chimurai/http-proxy-middleware | 11k+ | Proxy middleware |
| 164 | express-rate-limit/express-rate-limit | https://github.com/express-rate-limit/express-rate-limit | 3k+ | Rate limiting |
| 165 | expressjs/cookie-parser | https://github.com/expressjs/cookie-parser | 2k+ | Cookie parsing |

## Category 14: Static Site Generators & Blog Platforms

SSGs use heavy sync I/O during build, but dev servers also process on request.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 166 | facebook/docusaurus | https://github.com/facebook/docusaurus | 57k+ | Documentation framework |
| 167 | vuejs/vitepress | https://github.com/vuejs/vitepress | 14k+ | Vite-powered SSG |
| 168 | docsifyjs/docsify | https://github.com/docsifyjs/docsify | 28k+ | Documentation site generator |
| 169 | jsdoc/jsdoc | https://github.com/jsdoc/jsdoc | 15k+ | API documentation generator |
| 170 | TypeStrong/typedoc | https://github.com/TypeStrong/typedoc | 8k+ | TypeScript documentation |
| 171 | middleman/middleman | https://github.com/middleman/middleman | 7k+ | Static site generator |
| 172 | metalsmith/metalsmith | https://github.com/metalsmith/metalsmith | 8k+ | Pluggable static site generator |
| 173 | assemble/assemble | https://github.com/assemble/assemble | 4k+ | Static site generator |
| 174 | gridsome/gridsome | https://github.com/gridsome/gridsome | 9k+ | Vue.js SSG |
| 175 | DimitriMikadze/Mean-Blog | https://github.com/DimitriMikadze/Mean-Blog | 300+ | MEAN stack blog |

## Category 15: Real-Time & WebSocket

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 176 | socketio/socket.io | https://github.com/socketio/socket.io | 61k+ | Real-time engine |
| 177 | websockets/ws | https://github.com/websockets/ws | 22k+ | WebSocket library |
| 178 | primus/primus | https://github.com/primus/primus | 4k+ | Real-time abstraction layer |
| 179 | uNetworking/uWebSockets.js | https://github.com/uNetworking/uWebSockets.js | 8k+ | Fast WebSockets |
| 180 | Automattic/engine.io | https://github.com/socketio/engine.io | 3k+ | Transport layer for Socket.IO |

## Category 16: Task Runners & Automation

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 181 | gulpjs/gulp | https://github.com/gulpjs/gulp | 33k+ | Streaming build system |
| 182 | gruntjs/grunt | https://github.com/gruntjs/grunt | 12k+ | Task runner |
| 183 | kimmobrunfeldt/concurrently | https://github.com/open-cli-tools/concurrently | 7k+ | Run commands concurrently |
| 184 | mysticatea/npm-run-all | https://github.com/mysticatea/npm-run-all | 6k+ | Run npm scripts in parallel |
| 185 | remy/nodemon | https://github.com/remy/nodemon | 26k+ | Auto-restart on file changes |

## Category 17: Scaffolding & Code Generation

Scaffolding tools use execSync/spawnSync for git init, npm install, etc.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 186 | facebook/create-react-app | https://github.com/facebook/create-react-app | 103k+ | React project scaffolding |
| 187 | vuejs/create-vue | https://github.com/vuejs/create-vue | 4k+ | Vue project scaffolding |
| 188 | angular/angular-cli | https://github.com/angular/angular-cli | 27k+ | Angular CLI |
| 189 | yeoman/yo | https://github.com/yeoman/yo | 4k+ | Scaffolding tool |
| 190 | plop-js/plop | https://github.com/plopjs/plop | 5k+ | Micro-generator |

## Category 18: Monitoring, Profiling & Debugging

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 191 | clinicjs/node-clinic | https://github.com/clinicjs/node-clinic | 3k+ | Node.js performance profiling |
| 192 | davidmarkclements/0x | https://github.com/davidmarkclements/0x | 3k+ | Flamegraph profiling |
| 193 | pm2/pm2 | https://github.com/Unitech/pm2 | 42k+ | Process manager |
| 194 | nock/nock | https://github.com/nock/nock | 13k+ | HTTP mocking |
| 195 | mcollina/autocannon | https://github.com/mcollina/autocannon | 8k+ | HTTP benchmarking |

## Category 19: Desktop & Electron Apps

Electron apps run Node.js on the main thread where blocking I/O freezes the entire UI.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 196 | microsoft/vscode | https://github.com/microsoft/vscode | 166k+ | Code editor |
| 197 | atom/atom | https://github.com/atom/atom | 60k+ | Text editor (archived) |
| 198 | jgraph/drawio-desktop | https://github.com/jgraph/drawio-desktop | 51k+ | Diagramming tool |
| 199 | notable/notable | https://github.com/notable/notable | 23k+ | Markdown notes app |
| 200 | marktext/marktext | https://github.com/marktext/marktext | 48k+ | Markdown editor |
| 201 | Zettlr/Zettlr | https://github.com/Zettlr/Zettlr | 10k+ | Markdown editor |
| 202 | bitwarden/clients | https://github.com/bitwarden/clients | 9k+ | Password manager clients |
| 203 | standardnotes/app | https://github.com/standardnotes/app | 5k+ | Encrypted notes |
| 204 | desktop/desktop | https://github.com/desktop/desktop | 20k+ | GitHub Desktop |
| 205 | GitSquared/edex-ui | https://github.com/GitSquared/edex-ui | 41k+ | Sci-fi terminal emulator |

## Category 20: Miscellaneous Node.js Applications

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 206 | Automattic/wp-calypso | https://github.com/Automattic/wp-calypso | 13k+ | WordPress.com frontend |
| 207 | reactioncommerce/reaction | https://github.com/reactioncommerce/reaction | 12k+ | eCommerce platform |
| 208 | HabitRPG/habitica | https://github.com/HabitRPG/habitica | 12k+ | Habit tracker RPG |
| 209 | timeoff-management/application | https://github.com/timeoff-management/application | 1k+ | Leave management |
| 210 | coderaiser/cloudcmd | https://github.com/coderaiser/cloudcmd | 2k+ | Cloud file manager |
| 211 | nasa/openmct | https://github.com/nasa/openmct | 12k+ | Mission control framework |
| 212 | badges/shields | https://github.com/badges/shields | 24k+ | Badge service |
| 213 | typicode/lowdb | https://github.com/typicode/lowdb | 21k+ | JSON file database |
| 214 | louislam/uptime-kuma | https://github.com/louislam/uptime-kuma | 62k+ | Uptime monitoring |
| 215 | coollabsio/coolify | https://github.com/coollabsio/coolify | 36k+ | Self-hosted PaaS |
| 216 | dani-garcia/vaultwarden | https://github.com/dani-garcia/vaultwarden | 40k+ | Bitwarden server (Rust, JS client) |
| 217 | portainer/portainer | https://github.com/portainer/portainer | 31k+ | Container management UI |
| 218 | gethomepage/homepage | https://github.com/gethomepage/homepage | 20k+ | Application dashboard |
| 219 | subnub/myDrive | https://github.com/subnub/myDrive | 3k+ | Google Drive clone |
| 220 | IMA-WorldHealth/bhima-2.X | https://github.com/IMA-WorldHealth/bhima | 300+ | Hospital management |

## Category 21: Template & Rendering Engines

Template engines often read templates synchronously from disk.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 221 | pugjs/pug | https://github.com/pugjs/pug | 22k+ | Template engine |
| 222 | handlebars-lang/handlebars.js | https://github.com/handlebars-lang/handlebars.js | 18k+ | Template engine |
| 223 | mozilla/nunjucks | https://github.com/mozilla/nunjucks | 9k+ | Template engine |
| 224 | tj/ejs | https://github.com/mde/ejs | 8k+ | Embedded JavaScript templates |
| 225 | marko-js/marko | https://github.com/marko-js/marko | 13k+ | Template engine |
| 226 | janl/mustache.js | https://github.com/janl/mustache.js | 16k+ | Logic-less templates |
| 227 | harttle/liquidjs | https://github.com/harttle/liquidjs | 2k+ | Liquid template engine |
| 228 | eta-dev/eta | https://github.com/eta-dev/eta | 1k+ | Lightweight template engine |

## Category 22: Server-Side Rendering Examples & Tutorials

These represent what developers actually copy into production.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 229 | bradtraversy/node_passport_login | https://github.com/bradtraversy/node_passport_login | 1k+ | Passport login tutorial |
| 230 | bradtraversy/storybooks | https://github.com/bradtraversy/storybooks | 700+ | Node/Express/MongoDB/Passport app |
| 231 | bradtraversy/devconnector_2.0 | https://github.com/bradtraversy/devconnector_2.0 | 2k+ | MERN stack social network |
| 232 | academind/node-restful-api-tutorial | https://github.com/academind/node-restful-api-tutorial | 1k+ | REST API tutorial |
| 233 | john-smilga/node-express-course | https://github.com/john-smilga/node-express-course | 4k+ | Express course projects |
| 234 | WebDevSimplified/Nodejs-Passport-Login | https://github.com/WebDevSimplified/Nodejs-Passport-Login | 500+ | Passport tutorial |
| 235 | Apress/pro-express.js | https://github.com/azat-co/proexpressjs | 1k+ | Pro Express.js book code |
| 236 | jamesqquick/node-auth | https://github.com/jamesqquick/node-auth | 300+ | Node auth tutorial |
| 237 | trulymittal/Nodejs-REST-API | https://github.com/trulymittal/Nodejs-REST-API | 400+ | REST API example |
| 238 | ipenywis/react-node-fullstack | https://github.com/ipenywis/react-node-fullstack | 300+ | Full-stack example |

## Category 23: HTTPS / TLS / SSL Examples

Nearly all HTTPS server setup tutorials use `readFileSync` for certificate loading.

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 239 | FiloSottile/mkcert | https://github.com/FiloSottile/mkcert | 51k+ | Local CA for dev certs |
| 240 | devcert-cli/devcert | https://github.com/davewasmer/devcert | 1k+ | Dev certificates |
| 241 | greenlock/greenlock-express | https://github.com/Daplie/greenlock-express | 200+ | Auto Let's Encrypt for Express |

## Category 24: Additional Production Apps & Services

| # | Repository | URL | Stars (approx) | Description |
|---|-----------|-----|----------------|-------------|
| 242 | mattermost/mattermost | https://github.com/mattermost/mattermost | 31k+ | Team messaging (has Node.js) |
| 243 | jitsi/jitsi-meet | https://github.com/jitsi/jitsi-meet | 23k+ | Video conferencing |
| 244 | excalidraw/excalidraw | https://github.com/excalidraw/excalidraw | 88k+ | Whiteboard tool |
| 245 | PostHog/posthog | https://github.com/PostHog/posthog | 22k+ | Product analytics |
| 246 | apitable/apitable | https://github.com/apitable/apitable | 13k+ | Spreadsheet-database platform |
| 247 | requarks/wiki | https://github.com/requarks/wiki | 25k+ | Wiki.js wiki engine |
| 248 | plausible/analytics | https://github.com/plausible/analytics | 21k+ | Web analytics (has JS tracker) |
| 249 | directus/directus | https://github.com/directus/directus | 29k+ | Open data platform |
| 250 | minio/minio | https://github.com/minio/minio | 49k+ | Object storage (has JS client) |

---

## Usage Notes

### Recommended Scan Approach

1. **Clone each repo** (or use GitHub Code Search API)
2. **grep/ripgrep** for blocking patterns:
   ```bash
   rg "readFileSync|writeFileSync|existsSync|readdirSync|statSync|mkdirSync|execSync|spawnSync|execFileSync|pbkdf2Sync|scryptSync|randomFillSync|generateKeyPairSync|deflateSync|inflateSync|gzipSync|gunzipSync" \
     --type js --type ts \
     -l
   ```
3. **Categorize each finding** by location:
   - **Initialization** (module top-level, `app.listen` callback) — generally acceptable
   - **Request handler** (inside route/controller/middleware) — problematic
   - **Background task** (worker threads, job processors) — context-dependent
4. **Prioritize request-path occurrences** for performance impact measurement

### GitHub Code Search Queries

You can also use GitHub's code search directly:

```
readFileSync language:JavaScript path:routes/ OR path:controllers/ OR path:middleware/
readFileSync language:TypeScript path:src/routes/ OR path:src/controllers/
execSync language:JavaScript path:server/ OR path:api/
crypto.pbkdf2Sync language:JavaScript
```

### Expected Findings

Based on ecosystem patterns, expect to find:
- **readFileSync for SSL/TLS certs** — very common in HTTPS setup, usually at init (acceptable)
- **readFileSync for config/env files** — common at startup (acceptable)
- **readFileSync for templates/assets in request handlers** — problematic, found in CMS and SSR apps
- **execSync for git/shell operations** — common in CLI tools and CI, problematic if in server code
- **crypto sync operations for password hashing** — found in auth middleware, highly impactful under load
- **existsSync/statSync for file checks** — scattered across many projects, subtle performance drain
- **writeFileSync for logging** — found in custom loggers, blocks event loop on disk I/O

---

*Total repos listed: ~250*
*Last updated: 2026-02-13*
