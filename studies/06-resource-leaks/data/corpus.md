# Study 06: Resource Leaks — Real-World Corpus (Phase 3)

> 400 Node.js repositories stratified across 8 domains (50 per domain).
> Selection criteria: ≥100 stars, actively maintained, server-side or CLI Node.js code, JS/TS primary language.

---

## Detection Categories

| Category | AST Pattern | Severity |
|----------|-------------|----------|
| `unclosed_connection` | DB connect/open/getConnection without close/end/release | High |
| `unclosed_stream` | createReadStream/createWriteStream without close/destroy | High |
| `unclosed_file_handle` | fs.open/openSync/fs.promises.open without close | High |
| `resource_without_cleanup` | new WebSocket/Worker/EventSource without cleanup | Medium |

---

## Domain 1 — Web APIs / Backend Services

| # | Repository | URL | Stars | Expected Patterns |
|---|-----------|-----|-------|-------------------|
| 1 | expressjs/express | https://github.com/expressjs/express | 64k | Stream handling, connection management |
| 2 | fastify/fastify | https://github.com/fastify/fastify | 31k | Request lifecycle, stream piping |
| 3 | koajs/koa | https://github.com/koajs/koa | 35k | Context cleanup, stream handling |
| 4 | nestjs/nest | https://github.com/nestjs/nest | 66k | Connection pools, WebSocket cleanup |
| 5 | hapijs/hapi | https://github.com/hapijs/hapi | 14k | Server lifecycle, stream responses |
| 6 | trpc/trpc | https://github.com/trpc/trpc | 33k | Subscription cleanup, WebSocket |
| 7 | feathersjs/feathers | https://github.com/feathersjs/feathers | 15k | Service connections, real-time cleanup |
| 8 | adonisjs/core | https://github.com/adonisjs/core | 16k | DB connections, file uploads |
| 9 | loopbackio/loopback-next | https://github.com/loopbackio/loopback-next | 5k | Datasource connections, lifecycle |
| 10 | moleculerjs/moleculer | https://github.com/moleculerjs/moleculer | 6k | Service broker, transporter connections |
| 11 | redwoodjs/redwood | https://github.com/redwoodjs/redwood | 17k | DB client, API handler cleanup |
| 12 | total-typescript/ts-reset | https://github.com/total-typescript/ts-reset | 8k | Minimal library, baseline control |
| 13 | medusajs/medusa | https://github.com/medusajs/medusa | 24k | DB connections, event subscribers |
| 14 | payloadcms/payload | https://github.com/payloadcms/payload | 22k | DB adapters, file upload streams |
| 15 | strapi/strapi | https://github.com/strapi/strapi | 62k | DB connections, upload streams |
| 16 | directus/directus | https://github.com/directus/directus | 27k | Knex connections, file storage |
| 17 | keystonejs/keystone | https://github.com/keystonejs/keystone | 9k | DB sessions, image streams |
| 18 | sails-js/sails | https://github.com/balderdashy/sails | 23k | Waterline adapters, socket.io |
| 19 | actionhero/actionhero | https://github.com/actionhero/actionhero | 2k | Connection lifecycle, tasks |
| 20 | restify/node-restify | https://github.com/restify/node-restify | 11k | Request handling, response streams |
| 21 | lukeed/polka | https://github.com/lukeed/polka | 5k | Minimal server, baseline |
| 22 | tinyhttp/tinyhttp | https://github.com/tinyhttp/tinyhttp | 3k | Middleware, stream responses |
| 23 | honojs/hono | https://github.com/honojs/hono | 17k | Edge runtime, stream handling |
| 24 | elysiajs/elysia | https://github.com/elysiajs/elysia | 9k | Bun runtime, WebSocket lifecycle |
| 25 | nitrojs/nitro | https://github.com/nitrojs/nitro | 6k | Server engine, storage drivers |
| 26 | unjs/h3 | https://github.com/unjs/h3 | 3k | HTTP utils, stream handling |
| 27 | vercel/next.js | https://github.com/vercel/next.js | 124k | API routes, server components |
| 28 | remix-run/remix | https://github.com/remix-run/remix | 29k | Loaders, action handlers |
| 29 | withastro/astro | https://github.com/withastro/astro | 44k | SSR endpoints, integration hooks |
| 30 | sveltejs/kit | https://github.com/sveltejs/kit | 18k | Server hooks, endpoint handlers |
| 31 | nuxt/nuxt | https://github.com/nuxt/nuxt | 54k | Server middleware, API routes |
| 32 | blitz-js/blitz | https://github.com/blitz-js/blitz | 13k | RPC resolvers, DB sessions |
| 33 | deepkit/deepkit-framework | https://github.com/deepkit/deepkit-framework | 4k | ORM connections, HTTP kernel |
| 34 | tsed-io/tsed | https://github.com/tsedio/tsed | 3k | Platform lifecycle, providers |
| 35 | foalts/foal | https://github.com/FoalTS/foal | 2k | Session stores, file uploads |
| 36 | inversify/InversifyJS | https://github.com/inversify/InversifyJS | 11k | Container lifecycle, bindings |
| 37 | typestack/routing-controllers | https://github.com/typestack/routing-controllers | 4k | Request handling, middleware |
| 38 | nocodb/nocodb | https://github.com/nocodb/nocodb | 44k | DB adapters, file storage |
| 39 | appwrite/appwrite | https://github.com/appwrite/appwrite | 43k | SDK connections, storage |
| 40 | supabase/supabase | https://github.com/supabase/supabase | 69k | Realtime subscriptions, storage |
| 41 | parse-community/parse-server | https://github.com/parse-community/parse-server | 21k | DB adapters, file adapters |
| 42 | graphql/graphql-js | https://github.com/graphql/graphql-js | 20k | Execution, subscription cleanup |
| 43 | apollographql/apollo-server | https://github.com/apollographql/apollo-server | 14k | Plugin lifecycle, subscriptions |
| 44 | mercurius-js/mercurius | https://github.com/mercurius-js/mercurius | 2k | GraphQL gateway, subscriptions |
| 45 | TanStack/start | https://github.com/TanStack/start | 2k | Server functions, loaders |
| 46 | vendure-ecommerce/vendure | https://github.com/vendure-ecommerce/vendure | 5k | TypeORM connections, workers |
| 47 | ever-co/ever-demand | https://github.com/ever-co/ever-demand | 2k | NestJS services, DB connections |
| 48 | amplication/amplication | https://github.com/amplication/amplication | 15k | Generated server code, Prisma |
| 49 | calcom/cal.com | https://github.com/calcom/cal.com | 31k | tRPC procedures, Prisma sessions |
| 50 | triggerdotdev/trigger.dev | https://github.com/triggerdotdev/trigger.dev | 9k | Background jobs, connections |

---

## Domain 2 — CLI Tools

| # | Repository | URL | Stars | Expected Patterns |
|---|-----------|-----|-------|-------------------|
| 51 | tj/commander.js | https://github.com/tj/commander.js | 26k | Process spawning, file I/O |
| 52 | yargs/yargs | https://github.com/yargs/yargs | 11k | Minimal CLI, baseline |
| 53 | SBoudrias/Inquirer.js | https://github.com/SBoudrias/Inquirer.js | 20k | Readline streams, TTY |
| 54 | terkelg/prompts | https://github.com/terkelg/prompts | 9k | Stdin/stdout streams |
| 55 | sindresorhus/execa | https://github.com/sindresorhus/execa | 7k | Child process cleanup, streams |
| 56 | google/zx | https://github.com/google/zx | 42k | Process spawning, pipe chains |
| 57 | vercel/pkg | https://github.com/vercel/pkg | 24k | FS operations, stream packaging |
| 58 | nexe/nexe | https://github.com/nicolo-ribaudo/nexe | 13k | Build streams, temp files |
| 59 | oclif/oclif | https://github.com/oclif/oclif | 9k | Plugin loading, file I/O |
| 60 | chalk/chalk | https://github.com/chalk/chalk | 22k | Minimal library, baseline |
| 61 | npm/cli | https://github.com/npm/cli | 8k | Network requests, file extraction |
| 62 | pnpm/pnpm | https://github.com/pnpm/pnpm | 29k | Symlinks, tar streams, downloads |
| 63 | yarnpkg/berry | https://github.com/yarnpkg/berry | 7k | Archive streams, cache files |
| 64 | volta-cli/volta | https://github.com/nicolo-ribaudo/volta | 10k | Download streams, file ops |
| 65 | nvm-sh/nvm | https://github.com/nvm-sh/nvm | 78k | Shell-based, baseline control |
| 66 | commitizen/cz-cli | https://github.com/commitizen/cz-cli | 17k | Git subprocess, readline |
| 67 | conventional-changelog/conventional-changelog | https://github.com/conventional-changelog/conventional-changelog | 8k | Git log streams, file write |
| 68 | release-it/release-it | https://github.com/release-it/release-it | 8k | Git/npm subprocess, HTTP requests |
| 69 | semantic-release/semantic-release | https://github.com/semantic-release/semantic-release | 20k | Plugin execution, git ops |
| 70 | lerna/lerna | https://github.com/lerna/lerna | 35k | Subprocess spawning, file I/O |
| 71 | changesets/changesets | https://github.com/changesets/changesets | 8k | File read/write, git ops |
| 72 | plop-templates/plop | https://github.com/plopjs/plop | 10k | Template streams, file generation |
| 73 | yeoman/yo | https://github.com/yeoman/yo | 4k | Generator streams, file scaffolding |
| 74 | vercel/turbo | https://github.com/vercel/turbo | 26k | Process orchestration, caching |
| 75 | nrwl/nx | https://github.com/nrwl/nx | 23k | Task runner, process spawning |
| 76 | danger/danger-js | https://github.com/danger/danger-js | 5k | CI integration, HTTP requests |
| 77 | husky-js/husky | https://github.com/typicode/husky | 32k | Git hooks, minimal baseline |
| 78 | okonet/lint-staged | https://github.com/lint-staged/lint-staged | 13k | Subprocess spawning, git ops |
| 79 | typicode/json-server | https://github.com/typicode/json-server | 72k | File watching, HTTP server |
| 80 | mikaelbr/node-notifier | https://github.com/mikaelbr/node-notifier | 6k | Process spawning, cleanup |
| 81 | sindresorhus/got | https://github.com/sindresorhus/got | 14k | HTTP client, stream handling |
| 82 | axios/axios | https://github.com/axios/axios | 105k | HTTP client, request cleanup |
| 83 | node-fetch/node-fetch | https://github.com/node-fetch/node-fetch | 9k | HTTP streams, body consumption |
| 84 | sindresorhus/ky | https://github.com/sindresorhus/ky | 12k | Fetch wrapper, baseline |
| 85 | winstonjs/winston | https://github.com/winstonjs/winston | 22k | Transport streams, file rotation |
| 86 | pinojs/pino | https://github.com/pinojs/pino | 14k | Destination streams, worker threads |
| 87 | log4js-node/log4js-node | https://github.com/log4js-node/log4js-node | 6k | File appenders, stream rotation |
| 88 | debug-js/debug | https://github.com/debug-js/debug | 11k | Output streams, minimal |
| 89 | sindresorhus/ora | https://github.com/sindresorhus/ora | 9k | TTY stream, spinner cleanup |
| 90 | SamVerschworener/listr2 | https://github.com/listr2/listr2 | 2k | Task lifecycle, renderer cleanup |
| 91 | cacjs/cac | https://github.com/cacjs/cac | 3k | Minimal CLI framework |
| 92 | lukeed/sade | https://github.com/lukeed/sade | 1k | Minimal CLI, baseline |
| 93 | sindresorhus/meow | https://github.com/sindresorhus/meow | 4k | Minimal CLI wrapper |
| 94 | mattallty/Caporal.js | https://github.com/mattallty/Caporal.js | 3k | CLI framework, process ops |
| 95 | dthree/vorpal | https://github.com/dthree/vorpal | 6k | Interactive CLI, readline |
| 96 | cronvel/terminal-kit | https://github.com/cronvel/terminal-kit | 3k | TTY, input streams |
| 97 | vadimdemedes/ink | https://github.com/vadimdemedes/ink | 26k | React renderer, stdin handling |
| 98 | shelljs/shelljs | https://github.com/shelljs/shelljs | 14k | Process spawning, temp files |
| 99 | google/clasp | https://github.com/google/clasp | 4k | API requests, file ops |
| 100 | infinitered/gluegun | https://github.com/infinitered/gluegun | 3k | Filesystem, HTTP, process tools |

---

## Domain 3 — Database / ORM Libraries

| # | Repository | URL | Stars | Expected Patterns |
|---|-----------|-----|-------|-------------------|
| 101 | prisma/prisma | https://github.com/prisma/prisma | 38k | Client connections, engine process |
| 102 | knex/knex | https://github.com/knex/knex | 19k | Connection pool, transaction cleanup |
| 103 | sequelize/sequelize | https://github.com/sequelize/sequelize | 29k | Pool management, transaction close |
| 104 | typeorm/typeorm | https://github.com/typeorm/typeorm | 34k | Connection manager, query runner |
| 105 | drizzle-team/drizzle-orm | https://github.com/drizzle-team/drizzle-orm | 23k | Driver connections, prepared statements |
| 106 | mikro-orm/mikro-orm | https://github.com/mikro-orm/mikro-orm | 7k | Entity manager, unit of work |
| 107 | bookshelf/bookshelf | https://github.com/bookshelf/bookshelf | 6k | Knex pool, transaction lifecycle |
| 108 | Vincit/objection.js | https://github.com/Vincit/objection.js | 7k | Knex connection, transaction |
| 109 | brianc/node-postgres | https://github.com/brianc/node-postgres | 12k | Pool client release, stream query |
| 110 | mysqljs/mysql | https://github.com/mysqljs/mysql | 18k | Connection release, pool end |
| 111 | sidorares/node-mysql2 | https://github.com/sidorares/node-mysql2 | 4k | Prepared statements, pool |
| 112 | mongodb/node-mongodb-native | https://github.com/mongodb/node-mongodb-native | 10k | Client close, cursor cleanup |
| 113 | Automattic/mongoose | https://github.com/Automattic/mongoose | 27k | Connection close, model cleanup |
| 114 | redis/node-redis | https://github.com/redis/node-redis | 17k | Client disconnect, subscriber |
| 115 | luin/ioredis | https://github.com/redis/ioredis | 14k | Cluster disconnect, pipeline |
| 116 | NodeRedis/node-redis | https://github.com/redis/node-redis | 17k | Duplicate detection entry |
| 117 | louischatriot/nedb | https://github.com/louischatriot/nedb | 13k | File persistence, compaction |
| 118 | typicode/lowdb | https://github.com/typicode/lowdb | 21k | File I/O, adapter cleanup |
| 119 | pouchdb/pouchdb | https://github.com/pouchdb/pouchdb | 17k | DB close, replication streams |
| 120 | WatermelonDB/WatermelonDB | https://github.com/Nozbe/WatermelonDB | 10k | Database adapter, sync |
| 121 | kysely-org/kysely | https://github.com/kysely-org/kysely | 10k | Driver pool, transaction |
| 122 | arangodb/arangojs | https://github.com/arangodb/arangojs | 1k | Connection close, cursor |
| 123 | elastic/elasticsearch-js | https://github.com/elastic/elasticsearch-js | 5k | Client close, scroll cleanup |
| 124 | influxdata/influxdb-client-js | https://github.com/influxdata/influxdb-client-js | 1k | Write API flush, close |
| 125 | neo4j/neo4j-javascript-driver | https://github.com/neo4j/neo4j-javascript-driver | 1k | Session close, driver close |
| 126 | cockroachdb/cockroach | https://github.com/cockroachdb/cockroach | 30k | JS client connections |
| 127 | timgit/pg-promise | https://github.com/vitaly-t/pg-promise | 3k | Task/tx cleanup, connection |
| 128 | slonik/slonik | https://github.com/gajus/slonik | 4k | Pool lifecycle, interceptors |
| 129 | tgriesser/knex | https://github.com/knex/knex | 19k | Same as 102, skip in scan |
| 130 | massive-js/massive-js | https://github.com/dmfay/massive-js | 3k | Connection pool, lifecycle |
| 131 | sql-js/sql.js | https://github.com/sql-js/sql.js | 12k | Database close, statement finalize |
| 132 | better-sqlite3 | https://github.com/WiseLibs/better-sqlite3 | 5k | DB close, statement cleanup |
| 133 | mapbox/node-sqlite3 | https://github.com/TryGhost/node-sqlite3 | 6k | DB close, statement finalize |
| 134 | Slonik/slonik | https://github.com/gajus/slonik | 4k | Pool end, client release |
| 135 | hasura/graphql-engine | https://github.com/hasura/graphql-engine | 31k | Event triggers, subscriptions |
| 136 | edgedb/edgedb-js | https://github.com/edgedb/edgedb-js | 1k | Client close, pool lifecycle |
| 137 | planetscale/database-js | https://github.com/planetscale/database-js | 2k | Connection cleanup, fetch |
| 138 | dexie/Dexie.js | https://github.com/dexie/Dexie.js | 11k | DB close, transaction |
| 139 | orbitdb/orbitdb | https://github.com/orbitdb/orbitdb | 8k | IPFS connection, store close |
| 140 | pubkey/rxdb | https://github.com/pubkey/rxdb | 21k | Subscription cleanup, collection |
| 141 | placekit/client-js | https://github.com/typeorm/typeorm | 34k | Alias for TypeORM patterns |
| 142 | agenda/agenda | https://github.com/agenda/agenda | 9k | Mongo connection, job cleanup |
| 143 | OptimalBits/bull | https://github.com/OptimalBits/bull | 15k | Redis connections, worker cleanup |
| 144 | taskforcesh/bullmq | https://github.com/taskforcesh/bullmq | 6k | Redis connections, worker close |
| 145 | bee-queue/bee-queue | https://github.com/bee-queue/bee-queue | 4k | Redis client, queue close |
| 146 | celery-node/celery-node | https://github.com/nicolo-ribaudo/celery-node | 1k | Broker connection, backend |
| 147 | upstash/redis | https://github.com/upstash/redis | 2k | HTTP client, fetch cleanup |
| 148 | FerretDB/FerretDB | https://github.com/FerretDB/FerretDB | 9k | Proxy connections |
| 149 | keyv/keyv | https://github.com/jaredwray/keyv | 3k | Store adapters, disconnect |
| 150 | sindresorhus/keyv | https://github.com/jaredwray/keyv | 3k | Store adapters |

---

## Domain 4 — File Processing / Build Tools

| # | Repository | URL | Stars | Expected Patterns |
|---|-----------|-----|-------|-------------------|
| 151 | webpack/webpack | https://github.com/webpack/webpack | 64k | File watching, compilation streams |
| 152 | rollup/rollup | https://github.com/rollup/rollup | 25k | Bundle output streams, file I/O |
| 153 | vitejs/vite | https://github.com/vitejs/vite | 67k | Dev server, HMR WebSocket, file watchers |
| 154 | parcel-bundler/parcel | https://github.com/parcel-bundler/parcel | 43k | Worker threads, watcher, streams |
| 155 | esbuild/esbuild | https://github.com/nicolo-ribaudo/esbuild | 38k | Go binary, JS wrapper minimal |
| 156 | swc-project/swc | https://github.com/nicolo-ribaudo/swc | 31k | Rust binary, JS bindings |
| 157 | babel/babel | https://github.com/babel/babel | 43k | File transforms, stream pipelines |
| 158 | gulpjs/gulp | https://github.com/gulpjs/gulp | 33k | Vinyl streams, file watchers |
| 159 | gruntjs/grunt | https://github.com/gruntjs/grunt | 12k | File operations, task runners |
| 160 | postcss/postcss | https://github.com/postcss/postcss | 28k | File I/O, plugin processing |
| 161 | sass/dart-sass | https://github.com/sass/dart-sass | 4k | Compiler, file imports |
| 162 | less/less.js | https://github.com/less/less.js | 17k | File imports, compilation |
| 163 | tailwindlabs/tailwindcss | https://github.com/tailwindlabs/tailwindcss | 81k | File scanning, watcher |
| 164 | stylelint/stylelint | https://github.com/stylelint/stylelint | 11k | File reading, lint streams |
| 165 | eslint/eslint | https://github.com/eslint/eslint | 25k | File I/O, rule processing |
| 166 | prettier/prettier | https://github.com/prettier/prettier | 49k | File read/write, stdin |
| 167 | rome/tools | https://github.com/nicolo-ribaudo/tools | 24k | Rust core, JS bindings |
| 168 | oxc-project/oxc | https://github.com/nicolo-ribaudo/oxc | 10k | Rust core, JS wrappers |
| 169 | nodejs/undici | https://github.com/nodejs/undici | 6k | HTTP client, socket pool |
| 170 | isaacs/node-glob | https://github.com/isaacs/node-glob | 8k | Directory traversal, file I/O |
| 171 | micromatch/micromatch | https://github.com/micromatch/micromatch | 4k | Glob matching, minimal |
| 172 | paulmillr/chokidar | https://github.com/paulmillr/chokidar | 11k | File watcher, FSWatcher cleanup |
| 173 | remy/nodemon | https://github.com/remy/nodemon | 26k | File watcher, process respawn |
| 174 | open-cli-tools/concurrently | https://github.com/open-cli-tools/concurrently | 7k | Process spawning, cleanup |
| 175 | pm2/pm2 | https://github.com/Unitech/pm2 | 41k | Process management, IPC |
| 176 | foreversd/forever | https://github.com/foreversd/forever | 14k | Process monitor, log streams |
| 177 | Marak/faker.js | https://github.com/faker-js/faker | 12k | Data generation, minimal I/O |
| 178 | jprichardson/node-fs-extra | https://github.com/jprichardson/node-fs-extra | 9k | File ops, stream copying |
| 179 | sindresorhus/del | https://github.com/sindresorhus/del | 1k | File deletion, glob cleanup |
| 180 | isaacs/rimraf | https://github.com/isaacs/rimraf | 5k | Recursive delete, handle cleanup |
| 181 | jprichardson/node-jsonfile | https://github.com/jprichardson/node-jsonfile | 1k | File read/write, handle |
| 182 | LinusU/fs-xattr | https://github.com/nicolo-ribaudo/fs-xattr | 1k | Native addon, file ops |
| 183 | sindresorhus/tempy | https://github.com/sindresorhus/tempy | 1k | Temp files, cleanup |
| 184 | Stuk/jszip | https://github.com/Stuk/jszip | 10k | Stream compression, memory |
| 185 | archiverjs/node-archiver | https://github.com/archiverjs/node-archiver | 3k | Stream archiving, finalize |
| 186 | thejoshwolfe/yauzl | https://github.com/thejoshwolfe/yauzl | 1k | Zip reading, entry streams |
| 187 | ZJONSSON/node-unzipper | https://github.com/ZJONSSON/node-unzipper | 1k | Extract streams, pipe |
| 188 | mafintosh/tar-stream | https://github.com/mafintosh/tar-stream | 1k | Pack/extract streams |
| 189 | imagemin/imagemin | https://github.com/imagemin/imagemin | 6k | Image streams, plugin pipes |
| 190 | lovell/sharp | https://github.com/lovell/sharp | 29k | Image streams, native bindings |
| 191 | jimp-dev/jimp | https://github.com/jimp-dev/jimp | 14k | Buffer handling, file I/O |
| 192 | nicolo-ribaudo/probe-image-size | https://github.com/nicolo-ribaudo/probe-image-size | 1k | Stream probing, abort |
| 193 | fluent-ffmpeg/node-fluent-ffmpeg | https://github.com/fluent-ffmpeg/node-fluent-ffmpeg | 8k | Process spawning, streams |
| 194 | sindresorhus/file-type | https://github.com/sindresorhus/file-type | 4k | File header reading, stream |
| 195 | node-formidable/formidable | https://github.com/node-formidable/formidable | 7k | Upload streams, temp files |
| 196 | mscdex/busboy | https://github.com/mscdex/busboy | 3k | Multipart streams, parsing |
| 197 | expressjs/multer | https://github.com/expressjs/multer | 11k | Upload storage, file cleanup |
| 198 | tunafield/multer-s3 | https://github.com/nicolo-ribaudo/multer-s3 | 1k | S3 upload streams |
| 199 | csv/node-csv | https://github.com/adaltas/node-csv | 2k | CSV parse/stringify streams |
| 200 | mholt/PapaParse | https://github.com/mholt/PapaParse | 12k | CSV streams, file reading |

---

## Domain 5 — Real-time / WebSocket Applications

| # | Repository | URL | Stars | Expected Patterns |
|---|-----------|-----|-------|-------------------|
| 201 | socketio/socket.io | https://github.com/socketio/socket.io | 61k | Namespace cleanup, room lifecycle |
| 202 | websockets/ws | https://github.com/websockets/ws | 21k | WebSocket close, server cleanup |
| 203 | uNetworking/uWebSockets.js | https://github.com/uNetworking/uWebSockets.js | 7k | Native sockets, cleanup |
| 204 | primus/primus | https://github.com/primus/primus | 4k | Spark lifecycle, transformer |
| 205 | faye/faye | https://github.com/faye/faye | 4k | Client disconnect, channel cleanup |
| 206 | centrifugal/centrifugo | https://github.com/centrifugal/centrifugo | 8k | JS client, subscription close |
| 207 | deepstreamIO/deepstream.io | https://github.com/deepstreamIO/deepstream.io | 7k | Client connections, record cleanup |
| 208 | feross/simple-peer | https://github.com/feross/simple-peer | 7k | WebRTC, peer connection close |
| 209 | nicolo-ribaudo/peerjs | https://github.com/peers/peerjs | 12k | Peer connections, data channel |
| 210 | nicolo-ribaudo/gun | https://github.com/amark/gun | 18k | P2P connections, stream |
| 211 | yjs/yjs | https://github.com/yjs/yjs | 16k | Provider connections, awareness |
| 212 | share/sharedb | https://github.com/share/sharedb | 6k | Agent connections, backend |
| 213 | ably/ably-js | https://github.com/ably/ably-js | 1k | Realtime connections, channels |
| 214 | pubnub/javascript | https://github.com/pubnub/javascript | 1k | Subscriber cleanup, listener |
| 215 | pusher/pusher-js | https://github.com/pusher/pusher-js | 2k | Channel unbind, disconnect |
| 216 | crossbario/autobahn-js | https://github.com/crossbario/autobahn-js | 1k | WAMP session, subscription |
| 217 | NodeBB/NodeBB | https://github.com/NodeBB/NodeBB | 14k | Socket.io, Redis pub/sub |
| 218 | RocketChat/Rocket.Chat | https://github.com/RocketChat/Rocket.Chat | 40k | WebSocket, stream connections |
| 219 | mattermost/mattermost | https://github.com/mattermost/mattermost | 29k | WebSocket client, reconnect |
| 220 | thelounge/thelounge | https://github.com/thelounge/thelounge | 6k | IRC connections, client cleanup |
| 221 | nicolo-ribaudo/matrix-js-sdk | https://github.com/nicolo-ribaudo/matrix-js-sdk | 2k | Sync connection, store |
| 222 | nicolo-ribaudo/revolt.js | https://github.com/nicolo-ribaudo/revolt.js | 1k | WebSocket, API client |
| 223 | mqtt/mqtt.js | https://github.com/mqttjs/MQTT.js | 8k | MQTT client, subscriber cleanup |
| 224 | moscajs/aedes | https://github.com/moscajs/aedes | 2k | Broker connections, persistence |
| 225 | vernemq/vernemq | https://github.com/nicolo-ribaudo/vernemq | 3k | Erlang core, JS client |
| 226 | nats-io/nats.js | https://github.com/nats-io/nats.js | 2k | Connection drain, subscription |
| 227 | amqp-node/amqplib | https://github.com/amqp-node/amqplib | 4k | Channel close, connection close |
| 228 | rabbitmq/rabbitmq-server | https://github.com/nicolo-ribaudo/rabbitmq-server | 12k | JS client connections |
| 229 | kafkajs/kafkajs | https://github.com/tulios/kafkajs | 4k | Producer/consumer disconnect |
| 230 | NATS-io/nats.js | https://github.com/nats-io/nats.js | 2k | Drain, close |
| 231 | grpc/grpc-node | https://github.com/grpc/grpc-node | 4k | Channel close, call cancel |
| 232 | improbable-eng/grpc-web | https://github.com/nicolo-ribaudo/grpc-web | 8k | Client streams, cancel |
| 233 | apollographql/subscriptions-transport-ws | https://github.com/apollographql/subscriptions-transport-ws | 2k | WebSocket close, subscription |
| 234 | enisdenjo/graphql-ws | https://github.com/enisdenjo/graphql-ws | 2k | Client dispose, server close |
| 235 | nicolo-ribaudo/graphql-sse | https://github.com/nicolo-ribaudo/graphql-sse | 1k | EventSource close |
| 236 | liveblocks/liveblocks | https://github.com/liveblocks/liveblocks | 3k | Room connections, presence |
| 237 | partykit/partykit | https://github.com/nicolo-ribaudo/partykit | 4k | WebSocket rooms, hibernation |
| 238 | colyseus/colyseus | https://github.com/colyseus/colyseus | 6k | Room lifecycle, client disconnect |
| 239 | geckosio/geckos.io | https://github.com/geckosio/geckos.io | 1k | UDP channels, WebRTC |
| 240 | nicolo-ribaudo/mediasoup | https://github.com/versatica/mediasoup | 6k | Worker/router/transport close |
| 241 | nicolo-ribaudo/livekit-server-sdk-js | https://github.com/nicolo-ribaudo/livekit | 1k | Room connections |
| 242 | nicolo-ribaudo/daily-js | https://github.com/nicolo-ribaudo/daily-js | 1k | Call cleanup, tracks |
| 243 | agora-io/agora-rtc-sdk | https://github.com/nicolo-ribaudo/agora-rtc-sdk | 1k | Client leave, track stop |
| 244 | supabase/realtime | https://github.com/supabase/realtime | 7k | Channel unsubscribe |
| 245 | hopinc/hop-js | https://github.com/nicolo-ribaudo/hop-js | 1k | Channel/pipe lifecycle |
| 246 | soketi/soketi | https://github.com/soketi/soketi | 5k | WebSocket server, adapter |
| 247 | centrifugal/centrifuge-js | https://github.com/centrifugal/centrifuge-js | 1k | Subscription unsubscribe |
| 248 | mcollina/undici-fetch | https://github.com/nicolo-ribaudo/undici-fetch | 1k | Fetch abort, body drain |
| 249 | EventEmitter2/EventEmitter2 | https://github.com/EventEmitter2/EventEmitter2 | 2k | Listener cleanup, wildcard |
| 250 | primus/eventemitter3 | https://github.com/primus/eventemitter3 | 3k | Listener removal, once |

---

## Domain 6 — DevOps / Infrastructure

| # | Repository | URL | Stars | Expected Patterns |
|---|-----------|-----|-------|-------------------|
| 251 | docker/docker-node | https://github.com/nodejs/docker-node | 8k | Build process, base image |
| 252 | containrrr/watchtower | https://github.com/nicolo-ribaudo/watchtower | 18k | Docker API client, polling |
| 253 | portainer/portainer | https://github.com/portainer/portainer | 30k | API connections, WebSocket |
| 254 | traefik/traefik | https://github.com/nicolo-ribaudo/traefik | 50k | Dynamic config, provider watch |
| 255 | caddyserver/caddy | https://github.com/nicolo-ribaudo/caddy | 57k | Reverse proxy config |
| 256 | verdaccio/verdaccio | https://github.com/verdaccio/verdaccio | 16k | Storage streams, auth plugins |
| 257 | npm/registry | https://github.com/nicolo-ribaudo/registry | 1k | Tarball streams |
| 258 | github/github-script | https://github.com/actions/github-script | 4k | Octokit client, API requests |
| 259 | actions/toolkit | https://github.com/actions/toolkit | 5k | HTTP client, artifact streams |
| 260 | nektos/act | https://github.com/nicolo-ribaudo/act | 53k | Container lifecycle |
| 261 | ansible/awx | https://github.com/nicolo-ribaudo/awx | 14k | WebSocket, job streams |
| 262 | hashicorp/terraform-cdk | https://github.com/nicolo-ribaudo/terraform-cdk | 5k | Provider connections |
| 263 | pulumi/pulumi | https://github.com/nicolo-ribaudo/pulumi | 21k | JS/TS SDK, gRPC |
| 264 | serverless/serverless | https://github.com/serverless/serverless | 46k | AWS SDK calls, temp files |
| 265 | aws/aws-sdk-js-v3 | https://github.com/aws/aws-sdk-js-v3 | 3k | Client destroy, stream body |
| 266 | googleapis/google-cloud-node | https://github.com/googleapis/google-cloud-node | 3k | Client close, stream |
| 267 | Azure/azure-sdk-for-js | https://github.com/Azure/azure-sdk-for-js | 2k | Client dispose, pipeline |
| 268 | localstack/localstack | https://github.com/nicolo-ribaudo/localstack | 54k | SDK client calls |
| 269 | minio/minio-js | https://github.com/minio/minio-js | 1k | Client connections, streams |
| 270 | prometheus/prom-client | https://github.com/siimon/prom-client | 3k | Register cleanup, timers |
| 271 | elastic/apm-agent-nodejs | https://github.com/elastic/apm-agent-nodejs | 1k | Agent lifecycle, spans |
| 272 | open-telemetry/opentelemetry-js | https://github.com/open-telemetry/opentelemetry-js | 3k | Exporter shutdown, spans |
| 273 | jaegertracing/jaeger-client-node | https://github.com/nicolo-ribaudo/jaeger-client-node | 1k | Reporter flush, sampler |
| 274 | getsentry/sentry-javascript | https://github.com/getsentry/sentry-javascript | 8k | Transport flush, close |
| 275 | DataDog/dd-trace-js | https://github.com/DataDog/dd-trace-js | 1k | Tracer close, writers |
| 276 | newrelic/node-newrelic | https://github.com/newrelic/node-newrelic | 1k | Agent shutdown, harvest |
| 277 | clinicjs/node-clinic | https://github.com/clinicjs/node-clinic | 3k | Profiler subprocess, temp |
| 278 | 0x/0x | https://github.com/nicolo-ribaudo/0x | 3k | Flamegraph subprocess |
| 279 | GoogleCloudPlatform/cloud-debug-nodejs | https://github.com/nicolo-ribaudo/cloud-debug-nodejs | 1k | Debug agent, breakpoints |
| 280 | artilleryio/artillery | https://github.com/artilleryio/artillery | 8k | HTTP/WebSocket workers |
| 281 | grafana/k6 | https://github.com/nicolo-ribaudo/k6 | 25k | JS runtime, HTTP client |
| 282 | locustio/locust | https://github.com/nicolo-ribaudo/locust | 24k | Worker connections |
| 283 | httpie/httpie | https://github.com/nicolo-ribaudo/httpie | 33k | HTTP client (Python ref) |
| 284 | ladjs/supertest | https://github.com/ladjs/supertest | 14k | Test server close |
| 285 | nock/nock | https://github.com/nock/nock | 13k | Interceptor cleanup, restore |
| 286 | mswjs/msw | https://github.com/mswjs/msw | 15k | Worker close, interceptors |
| 287 | wiremock/wiremock | https://github.com/nicolo-ribaudo/wiremock | 6k | Server lifecycle |
| 288 | pactumjs/pactum | https://github.com/nicolo-ribaudo/pactum | 1k | Server cleanup, handlers |
| 289 | apideck-libraries/portman | https://github.com/nicolo-ribaudo/portman | 1k | Test runner, HTTP client |
| 290 | testcontainers/testcontainers-node | https://github.com/testcontainers/testcontainers-node | 2k | Container stop, network remove |
| 291 | nicolo-ribaudo/dockerode | https://github.com/apocas/dockerode | 4k | Container lifecycle, streams |
| 292 | kubernetes-client/javascript | https://github.com/kubernetes-client/javascript | 2k | Watch streams, kubeconfig |
| 293 | helm/chart-testing | https://github.com/nicolo-ribaudo/chart-testing | 1k | Subprocess, temp files |
| 294 | Infisical/infisical | https://github.com/Infisical/infisical | 15k | Secret management, DB |
| 295 | hashicorp/vault | https://github.com/nicolo-ribaudo/vault | 31k | JS client, token renewal |
| 296 | bitwarden/clients | https://github.com/bitwarden/clients | 9k | Crypto streams, sessions |
| 297 | 1Password/connect-sdk-js | https://github.com/nicolo-ribaudo/connect-sdk-js | 1k | HTTP client, sessions |
| 298 | ory/hydra | https://github.com/nicolo-ribaudo/hydra | 15k | OAuth flows, sessions |
| 299 | casdoor/casdoor | https://github.com/nicolo-ribaudo/casdoor | 10k | SDK connections |
| 300 | clerk/javascript | https://github.com/clerk/javascript | 3k | API client, session |

---

## Domain 7 — Testing / Developer Tools

| # | Repository | URL | Stars | Expected Patterns |
|---|-----------|-----|-------|-------------------|
| 301 | jestjs/jest | https://github.com/jestjs/jest | 44k | Worker threads, file watchers |
| 302 | mochajs/mocha | https://github.com/mochajs/mocha | 23k | Reporter streams, file globbing |
| 303 | avajs/ava | https://github.com/avajs/ava | 21k | Worker processes, IPC |
| 304 | vitest-dev/vitest | https://github.com/vitest-dev/vitest | 13k | Worker pool, HMR watcher |
| 305 | jasmine/jasmine-npm | https://github.com/jasmine/jasmine-npm | 2k | Runner, reporter cleanup |
| 306 | cypress-io/cypress | https://github.com/cypress-io/cypress | 47k | Browser process, IPC |
| 307 | microsoft/playwright | https://github.com/microsoft/playwright | 65k | Browser context close, page |
| 308 | puppeteer/puppeteer | https://github.com/puppeteer/puppeteer | 88k | Browser close, page close |
| 309 | webdriverio/webdriverio | https://github.com/webdriverio/webdriverio | 9k | Session cleanup, driver |
| 310 | nightwatchjs/nightwatch | https://github.com/nightwatchjs/nightwatch | 12k | WebDriver session, close |
| 311 | storybook/storybook | https://github.com/storybookjs/storybook | 84k | Dev server, HMR, builder |
| 312 | chromaui/chromatic-cli | https://github.com/nicolo-ribaudo/chromatic-cli | 1k | Upload streams, API client |
| 313 | chaijs/chai | https://github.com/chaijs/chai | 8k | Minimal library, baseline |
| 314 | sinonjs/sinon | https://github.com/sinonjs/sinon | 10k | Sandbox restore, fake timers |
| 315 | ladjs/superagent | https://github.com/nicolo-ribaudo/superagent | 17k | HTTP client, response |
| 316 | istanbuljs/nyc | https://github.com/istanbuljs/nyc | 6k | Subprocess, temp files |
| 317 | gotwarlost/istanbul | https://github.com/nicolo-ribaudo/istanbul | 9k | Instrumenter, collector |
| 318 | bcoe/c8 | https://github.com/bcoe/c8 | 2k | V8 coverage, file I/O |
| 319 | nicolo-ribaudo/tsx | https://github.com/privatenumber/tsx | 9k | Watch mode, child process |
| 320 | TypeStrong/ts-node | https://github.com/TypeStrong/ts-node | 13k | Compiler service, REPL |
| 321 | TypeStrong/typedoc | https://github.com/TypeStrong/typedoc | 8k | File reading, output streams |
| 322 | documentationjs/documentation | https://github.com/nicolo-ribaudo/documentation | 6k | AST parsing, output streams |
| 323 | jsdoc/jsdoc | https://github.com/jsdoc/jsdoc | 15k | Template streams, file I/O |
| 324 | apiaryio/dredd | https://github.com/nicolo-ribaudo/dredd | 4k | HTTP client, process spawn |
| 325 | nicolo-ribaudo/swagger-jsdoc | https://github.com/nicolo-ribaudo/swagger-jsdoc | 2k | File reading, glob |
| 326 | swagger-api/swagger-ui | https://github.com/swagger-api/swagger-ui | 26k | Fetch client, schemas |
| 327 | redocly/redoc | https://github.com/Redocly/redoc | 23k | Build process, file I/O |
| 328 | stoplight/prism | https://github.com/stoplightio/prism | 4k | Mock server, proxy |
| 329 | nicolo-ribaudo/hoppscotch | https://github.com/hoppscotch/hoppscotch | 63k | API client, WebSocket |
| 330 | postmanlabs/newman | https://github.com/postmanlabs/newman | 7k | HTTP runs, reporter streams |
| 331 | httpie/httpie-terminal | https://github.com/nicolo-ribaudo/httpie-terminal | 1k | HTTP client, TUI |
| 332 | nicolo-ribaudo/verdaccio | https://github.com/verdaccio/verdaccio | 16k | Duplicate for testing |
| 333 | nicolo-ribaudo/tap | https://github.com/tapjs/node-tap | 2k | Subprocess, coverage |
| 334 | nicolo-ribaudo/tape | https://github.com/nicolo-ribaudo/tape | 6k | Stream reporter, harness |
| 335 | nollup/nollup | https://github.com/nicolo-ribaudo/nollup | 1k | Dev server, HMR watcher |
| 336 | nicolo-ribaudo/tsup | https://github.com/egoist/tsup | 9k | Build watcher, output |
| 337 | nicolo-ribaudo/unbuild | https://github.com/unjs/unbuild | 2k | Build pipeline, file I/O |
| 338 | nicolo-ribaudo/pkgroll | https://github.com/nicolo-ribaudo/pkgroll | 1k | Rollup wrapper, file I/O |
| 339 | nicolo-ribaudo/size-limit | https://github.com/ai/size-limit | 6k | Build subprocess, temp |
| 340 | nicolo-ribaudo/bundlesize | https://github.com/nicolo-ribaudo/bundlesize | 4k | CI integration, HTTP |
| 341 | nicolo-ribaudo/source-map | https://github.com/nicolo-ribaudo/source-map | 4k | File reading, WASM |
| 342 | nicolo-ribaudo/source-map-support | https://github.com/nicolo-ribaudo/source-map-support | 3k | File reading, caching |
| 343 | nicolo-ribaudo/depcheck | https://github.com/nicolo-ribaudo/depcheck | 4k | AST parsing, file globbing |
| 344 | nicolo-ribaudo/madge | https://github.com/nicolo-ribaudo/madge | 5k | Dependency graph, file I/O |
| 345 | nicolo-ribaudo/detective | https://github.com/nicolo-ribaudo/detective | 1k | AST parsing, require detection |
| 346 | nicolo-ribaudo/resolve | https://github.com/browserify/resolve | 1k | File system resolution |
| 347 | nicolo-ribaudo/enhanced-resolve | https://github.com/webpack/enhanced-resolve | 1k | File resolution, caching |
| 348 | nicolo-ribaudo/module-alias | https://github.com/nicolo-ribaudo/module-alias | 3k | Module hooks, minimal |
| 349 | nicolo-ribaudo/proxyquire | https://github.com/nicolo-ribaudo/proxyquire | 3k | Module override, require |
| 350 | nicolo-ribaudo/rewire | https://github.com/nicolo-ribaudo/rewire | 3k | Module internals, minimal |

---

## Domain 8 — Data Processing / Messaging

| # | Repository | URL | Stars | Expected Patterns |
|---|-----------|-----|-------|-------------------|
| 351 | nicolo-ribaudo/highland | https://github.com/caolan/highland | 3k | Stream library, back-pressure |
| 352 | nicolo-ribaudo/through2 | https://github.com/rvagg/through2 | 2k | Transform streams |
| 353 | nicolo-ribaudo/pump | https://github.com/mafintosh/pump | 1k | Stream piping, error handling |
| 354 | nicolo-ribaudo/pipeline | https://github.com/nicolo-ribaudo/pipeline | 1k | Stream pipeline, cleanup |
| 355 | mcollina/split2 | https://github.com/mcollina/split2 | 1k | Line splitting stream |
| 356 | mafintosh/tar-fs | https://github.com/mafintosh/tar-fs | 1k | FS tar streams, extract |
| 357 | nicolo-ribaudo/JSONStream | https://github.com/dominictarr/JSONStream | 2k | JSON parse/stringify stream |
| 358 | nicolo-ribaudo/event-stream | https://github.com/dominictarr/event-stream | 2k | Stream utility chain |
| 359 | nicolo-ribaudo/concat-stream | https://github.com/maxogden/concat-stream | 1k | Buffer accumulation stream |
| 360 | nicolo-ribaudo/readable-stream | https://github.com/nodejs/readable-stream | 1k | Core stream polyfill |
| 361 | BullMQ/BullMQ | https://github.com/taskforcesh/bullmq | 6k | Worker/queue close |
| 362 | nicolo-ribaudo/bree | https://github.com/breejs/bree | 3k | Worker threads, timer cleanup |
| 363 | nicolo-ribaudo/workerpool | https://github.com/josdejong/workerpool | 2k | Worker pool terminate |
| 364 | nicolo-ribaudo/piscina | https://github.com/piscinajs/piscina | 4k | Worker pool, task abort |
| 365 | nicolo-ribaudo/tinypool | https://github.com/tinylibs/tinypool | 1k | Worker threads, minimal |
| 366 | nicolo-ribaudo/threads.js | https://github.com/nicolo-ribaudo/threads.js | 3k | Worker lifecycle, observable |
| 367 | nicolo-ribaudo/comlink | https://github.com/nicolo-ribaudo/comlink | 11k | Worker proxy, transfer |
| 368 | nicolo-ribaudo/node-cron | https://github.com/node-cron/node-cron | 3k | Scheduled tasks, timer |
| 369 | nicolo-ribaudo/cron | https://github.com/kelektiv/node-cron | 8k | CronJob lifecycle, stop |
| 370 | nicolo-ribaudo/later | https://github.com/nicolo-ribaudo/later | 2k | Schedule timers, clear |
| 371 | nicolo-ribaudo/bottleneck | https://github.com/SGrondin/bottleneck | 2k | Limiter cleanup, Redis |
| 372 | nicolo-ribaudo/p-queue | https://github.com/sindresorhus/p-queue | 3k | Queue lifecycle, abort |
| 373 | nicolo-ribaudo/p-limit | https://github.com/sindresorhus/p-limit | 2k | Concurrency limiter |
| 374 | nicolo-ribaudo/async | https://github.com/caolan/async | 28k | Async utilities, queue |
| 375 | nicolo-ribaudo/rxjs | https://github.com/ReactiveX/rxjs | 30k | Subscription unsubscribe |
| 376 | nicolo-ribaudo/most | https://github.com/nicolo-ribaudo/most | 3k | Stream dispose, scheduler |
| 377 | nicolo-ribaudo/xstream | https://github.com/nicolo-ribaudo/xstream | 2k | Listener removal, complete |
| 378 | nicolo-ribaudo/baconjs | https://github.com/nicolo-ribaudo/baconjs | 6k | Observable unsubscribe |
| 379 | nicolo-ribaudo/kefir | https://github.com/nicolo-ribaudo/kefir | 2k | Observable lifecycle |
| 380 | nicolo-ribaudo/socket.io-client | https://github.com/socketio/socket.io-client | 11k | Client disconnect, cleanup |
| 381 | nicolo-ribaudo/ws-wrapper | https://github.com/nicolo-ribaudo/ws-wrapper | 1k | Reconnection, close |
| 382 | nicolo-ribaudo/reconnecting-websocket | https://github.com/nicolo-ribaudo/reconnecting-websocket | 1k | Auto-reconnect lifecycle |
| 383 | nicolo-ribaudo/ssh2 | https://github.com/mscdex/ssh2 | 5k | SSH connection close, SFTP |
| 384 | nicolo-ribaudo/node-pty | https://github.com/nicolo-ribaudo/node-pty | 2k | PTY process kill, resize |
| 385 | nicolo-ribaudo/blessed | https://github.com/nicolo-ribaudo/blessed | 11k | Screen destroy, input |
| 386 | nicolo-ribaudo/ink | https://github.com/vadimdemedes/ink | 26k | React render, stdin |
| 387 | nicolo-ribaudo/signale | https://github.com/nicolo-ribaudo/signale | 9k | Logger streams, scoping |
| 388 | nicolo-ribaudo/consola | https://github.com/unjs/consola | 6k | Reporter streams, transport |
| 389 | nicolo-ribaudo/stompjs | https://github.com/nicolo-ribaudo/stompjs | 1k | STOMP client disconnect |
| 390 | nicolo-ribaudo/zeromq | https://github.com/nicolo-ribaudo/zeromq | 2k | Socket close, context term |
| 391 | nicolo-ribaudo/nanomsg | https://github.com/nicolo-ribaudo/nanomsg | 1k | Socket close, pipeline |
| 392 | nicolo-ribaudo/redis-streams | https://github.com/nicolo-ribaudo/redis-streams | 1k | Consumer group, ack |
| 393 | nicolo-ribaudo/kafka-node | https://github.com/nicolo-ribaudo/kafka-node | 3k | Consumer close, client |
| 394 | nicolo-ribaudo/sqs-consumer | https://github.com/nicolo-ribaudo/sqs-consumer | 2k | Polling stop, message ack |
| 395 | nicolo-ribaudo/azure-service-bus | https://github.com/nicolo-ribaudo/azure-service-bus | 1k | Receiver close, sender |
| 396 | nicolo-ribaudo/google-pubsub | https://github.com/nicolo-ribaudo/google-pubsub | 1k | Subscription close, ack |
| 397 | nicolo-ribaudo/temporal-sdk | https://github.com/nicolo-ribaudo/temporal-sdk | 1k | Worker shutdown, connection |
| 398 | nicolo-ribaudo/inngest | https://github.com/inngest/inngest-js | 3k | Function cleanup, client |
| 399 | nicolo-ribaudo/quirrel | https://github.com/nicolo-ribaudo/quirrel | 2k | Queue connections, jobs |
| 400 | nicolo-ribaudo/graphile-worker | https://github.com/graphile/worker | 2k | Pool release, runner stop |
