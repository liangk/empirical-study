# Study 06: Resource Leaks — Real-World Corpus (Phase 3)

> 398 Node.js repositories stratified across 8 domains (~50 per domain).
> Selection criteria: ≥1k stars, actively maintained, server-side or CLI Node.js code with substantial resource management patterns (streams, connections, file handles, timers, event listeners, WebSockets, worker threads, process spawning).

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
**Selection rationale**: High-traffic frameworks and services with complex request/response lifecycle management, connection pooling, WebSocket handling, and stream processing—all prone to resource leaks under concurrent load.

| # | Repository | URL | Stars | Selection Reason: Resource Leak Patterns |
|---|-----------|-----|-------|-------------------|
| 1 | expressjs/express | https://github.com/expressjs/express | 64k | Request/response stream lifecycle, middleware chain cleanup, file upload streams (multipart), server.close() in error handlers, req/res event listener accumulation |
| 2 | fastify/fastify | https://github.com/fastify/fastify | 31k | Reply stream piping, request hooks lifecycle, connection pool management, schema validation errors leaving connections open, plugin teardown |
| 3 | koajs/koa | https://github.com/koajs/koa | 35k | Context object cleanup, response body streams, upstream/downstream error propagation without cleanup, middleware composition leaks |
| 4 | nestjs/nest | https://github.com/nestjs/nest | 66k | Dependency injection lifecycle, WebSocket gateway cleanup, microservice client connections, gRPC stream management, module teardown on hot reload |
| 5 | hapijs/hapi | https://github.com/hapijs/hapi | 14k | Server lifecycle hooks, response stream piping, plugin registration/deregistration, request.raw socket access, payload stream processing without proper cleanup |
| 6 | trpc/trpc | https://github.com/trpc/trpc | 33k | Subscription lifecycle management, WebSocket connection cleanup, SSE (EventSource) unclosed connections, long-polling timeout handlers, middleware chain teardown |
| 7 | feathersjs/feathers | https://github.com/feathersjs/feathers | 15k | Service event listener accumulation, real-time transport (Socket.IO/Primus) cleanup, database adapter connection lifecycle, authentication hooks leaving listeners attached |
| 8 | adonisjs/core | https://github.com/adonisjs/core | 16k | Database connection pool management, file upload stream handling (Drive), HTTP context cleanup, event emitter subscription leaks, health check timers |
| 9 | loopbackio/loopback-next | https://github.com/loopbackio/loopback-next | 5k | Datasource connector lifecycle, OpenAPI spec generation leaving file handles open, REST adapter connection cleanup, observer pattern subscription leaks |
| 10 | moleculerjs/moleculer | https://github.com/moleculerjs/moleculer | 6k | Service broker transporter (NATS/Redis/MQTT) connections, circuit breaker timers, cacher backend lifecycle, event bus listener accumulation, heartbeat intervals |
| 11 | redwoodjs/redwood | https://github.com/redwoodjs/redwood | 17k | Prisma client connection management, GraphQL subscription cleanup, API lambda handler teardown, dev server HMR WebSocket lifecycle, background job workers |
| 12 | total-typescript/ts-reset | https://github.com/total-typescript/ts-reset | 8k | Minimal library with no I/O—baseline control for false positive rate calibration (expected: 0 findings) |
| 13 | medusajs/medusa | https://github.com/medusajs/medusa | 24k | PostgreSQL connection pool lifecycle, event bus subscriber cleanup, Redis pub/sub connections, file service upload streams, batch job queue workers |
| 14 | payloadcms/payload | https://github.com/payloadcms/payload | 22k | MongoDB/PostgreSQL adapter connection lifecycle, file upload stream handling (local/S3), webhook delivery HTTP client cleanup, collection hooks event listener accumulation |
| 15 | strapi/strapi | https://github.com/strapi/strapi | 62k | Plugin lifecycle management, media library upload streams, database query builder connection leaks, webhook HTTP client cleanup, content-type builder file I/O streams |
| 16 | directus/directus | https://github.com/directus/directus | 26k | Database connection pooling (Knex), WebSocket subscription lifecycle, file upload stream handling, activity log file writes, flow automation timers and intervals |
| 17 | keystonejs/keystone | https://github.com/keystonejs/keystone | 9k | Prisma database client lifecycle, GraphQL subscription cleanup, session store connections, file upload field streams, admin UI dev server WebSocket |
| 18 | sails-js/sails | https://github.com/balderdashy/sails | 23k | Waterline adapters, socket.io, model lifecycle hooks, request context cleanup, response stream handling |
| 19 | actionhero/actionhero | https://github.com/actionhero/actionhero | 2k | Connection lifecycle, tasks, action hooks, file upload handling, cache adapter connections |
| 20 | restify/node-restify | https://github.com/restify/node-restify | 11k | Request handling, response streams, route lifecycle, error handler cleanup, HTTP client connections |
| 49 | calcom/cal.com | https://github.com/calcom/cal.com | 31k | tRPC procedures, Prisma sessions |
| 50 | triggerdotdev/trigger.dev | https://github.com/triggerdotdev/trigger.dev | 9k | Background jobs, connections |

---

## Domain 2 — CLI Tools
**Selection rationale**: Command-line tools with subprocess spawning, file I/O operations, network requests, stream processing, and TTY/readline interactions—common sources of process handle and stream leaks.

| # | Repository | URL | Stars | Selection Reason: Resource Leak Patterns |
|---|-----------|-----|-------|-------------------|
| 51 | tj/commander.js | https://github.com/tj/commander.js | 26k | Action handler subprocess spawning without cleanup, option parsing with file reads, help text generation leaving streams open |
| 52 | yargs/yargs | https://github.com/yargs/yargs | 11k | Argument parsing with minimal I/O—baseline for CLI frameworks (expected: low findings) |
| 53 | SBoudrias/Inquirer.js | https://github.com/SBoudrias/Inquirer.js | 20k | Readline interface lifecycle, stdin/stdout stream handling, TTY mode switching, prompt event listener accumulation, UI renderer cleanup |
| 54 | terkelg/prompts | https://github.com/terkelg/prompts | 9k | Process stdin/stdout stream management, keypress event listeners, terminal raw mode cleanup, abort controller signal handling |
| 55 | sindresorhus/execa | https://github.com/sindresorhus/execa | 7k | Child process lifecycle (spawn/fork/exec), stdio stream piping, process error handling without cleanup, IPC channel closure, detached process management |
| 56 | google/zx | https://github.com/google/zx | 42k | Shell command process spawning, pipe operator stream chaining, process.stdout/stderr redirection, signal handling, temporary script file cleanup |
| 57 | vercel/pkg | https://github.com/vercel/pkg | 24k | Binary packaging with file stream reading, asset bundling I/O, node binary download streams, compression streams, temporary build directory cleanup |
| 58 | nexe/nexe | https://github.com/nexe/nexe | 13k | Compiler build stream processing, source code bundling file I/O, node source download streams, patch file operations, temporary build artifacts |
| 59 | oclif/oclif | https://github.com/oclif/oclif | 9k | Plugin lifecycle management, command loading file reads, hook execution context, manifest file I/O, update check HTTP requests |
| 60 | chalk/chalk | https://github.com/chalk/chalk | 22k | String styling library with no I/O—baseline control (expected: 0 findings) |
| 61 | npm/cli | https://github.com/npm/cli | 8k | Package download HTTP streams, tarball extraction, registry requests, lockfile write operations, cache directory I/O, audit report fetching |
| 62 | pnpm/pnpm | https://github.com/pnpm/pnpm | 29k | Content-addressable store symlinks, tarball extraction streams, parallel download HTTP connections, store cleanup file operations, peer dependency resolution |
| 63 | yarnpkg/berry | https://github.com/yarnpkg/berry | 7k | Zip archive stream handling, plugin loader, cache file I/O, network fetch retry logic, virtual filesystem operations, workspace protocol parsing |
| 64 | npm/npx | https://github.com/npm/npx | 2k | Package runner CLI, temporary package installation, binary execution, cache management, package resolution, subprocess spawning for command execution |
| 65 | npm/node-gyp | https://github.com/nodejs/node-gyp | 8k | Native addon build tool, subprocess spawning for compilation, Python process execution, build artifact I/O, download streams for dependencies, log file operations |
| 66 | commitizen/cz-cli | https://github.com/commitizen/cz-cli | 17k | Git command subprocess spawning, adapter prompt readline streams, configuration file reading, hook installation file operations |
| 67 | conventional-changelog/conventional-changelog | https://github.com/conventional-changelog/conventional-changelog | 8k | Git log subprocess streaming, commit parsing, changelog file write streams, template rendering, preset loading file I/O |
| 68 | release-it/release-it | https://github.com/release-it/release-it | 8k | Git operations subprocess spawning, npm publish process, GitHub API HTTP requests, changelog generation file I/O, plugin execution lifecycle |
| 69 | semantic-release/semantic-release | https://github.com/semantic-release/semantic-release | 20k | Plugin pipeline execution, git subprocess commands, release note generation, package publish processes, CI environment variable reading |
| 70 | lerna/lerna | https://github.com/lerna/lerna | 35k | Monorepo package discovery file operations, npm/yarn subprocess spawning per package, change detection git operations, publish stream coordination, workspace symlink management |
| 71 | changesets/changesets | https://github.com/changesets/changesets | 8k | Changeset file I/O operations, git subprocess for version bumping, markdown file parsing, package.json read/write streams, npm publish processes |
| 72 | plop-templates/plop | https://github.com/plopjs/plop | 10k | Handlebars template file reading, code generation file write streams, inquirer prompt streams, plopfile loading, action executor cleanup |
| 73 | yeoman/yo | https://github.com/yeoman/yo | 4k | Generator file scaffolding I/O, npm install subprocess, template copying streams, conflict resolution readline, environment cleanup |
| 74 | vercel/turbo | https://github.com/vercel/turbo | 26k | Task runner process orchestration, cache file I/O, daemon process management, workspace task graph, parallel subprocess spawning, remote cache HTTP connections |
| 75 | nrwl/nx | https://github.com/nrwl/nx | 23k | Task execution subprocess coordination, daemon process lifecycle, project graph file I/O, cache storage operations, cloud runner HTTP connections, file watcher cleanup |
| 76 | danger/danger-js | https://github.com/danger/danger-js | 5k | CI environment git operations, GitHub API HTTP client, danger rules execution, comment posting network requests, inline code review diff parsing |
| 77 | husky-js/husky | https://github.com/typicode/husky | 32k | Git hook installation file operations—minimal I/O baseline (expected: low findings, mainly installation scripts) |
| 78 | okonet/lint-staged | https://github.com/lint-staged/lint-staged | 13k | Linter subprocess spawning per file, git diff file operations, staged file stream processing, concurrent task execution, git stash apply subprocess |
| 79 | typicode/json-server | https://github.com/typicode/json-server | 72k | JSON file watching, HTTP server lifecycle, database file I/O, hot reload file watcher, static file serving streams, routes generation |
| 80 | mikaelbr/node-notifier | https://github.com/mikaelbr/node-notifier | 6k | System notification subprocess spawning (terminal-notifier/notify-send), process cleanup, icon file operations, fallback notifier lifecycle |
| 81 | sindresorhus/got | https://github.com/sindresorhus/got | 14k | HTTP request stream lifecycle, retry logic connection cleanup, response body stream handling, request pipeline hooks, agent connection pooling, timeout cleanup |
| 82 | axios/axios | https://github.com/axios/axios | 105k | HTTP request/response stream handling, interceptor cleanup, cancel token implementation, adapter connection lifecycle, upload/download progress streams, timeout handling |
| 83 | sindresorhus/p-retry | https://github.com/sindresorhus/p-retry | 1k | Promise retry utility, timeout handling, abort signal cleanup, delay timers, retry attempt tracking, error aggregation |
| 84 | sindresorhus/ky | https://github.com/sindresorhus/ky | 12k | Fetch wrapper with minimal added I/O—baseline for HTTP clients (retry logic may introduce connection leaks) |
| 85 | winstonjs/winston | https://github.com/winstonjs/winston | 22k | Log transport stream lifecycle, file rotation I/O, multiple transport cleanup, stream write queuing, error handling stream closure, console/file/HTTP transports |
| 86 | pinojs/pino | https://github.com/pinojs/pino | 14k | Extreme mode destination streams, worker thread log processing, transport stream piping, pino.destination() file handle management, sonic-boom buffer flushing |
| 87 | log4js-node/log4js-node | https://github.com/log4js-node/log4js-node | 6k | File appender stream lifecycle, log rotation file operations, date rolling file I/O, clustered appenders, TCP/HTTP appender connections, shutdown cleanup |
| 88 | debug-js/debug | https://github.com/debug-js/debug | 11k | Process.stderr output stream—minimal I/O baseline (expected: 0 findings) |
| 89 | sindresorhus/ora | https://github.com/sindresorhus/ora | 9k | TTY stream handling, spinner interval timers, readline cursor manipulation, process.stdout write streams, spinner stop cleanup, persistent log writes |
| 90 | SamVerschworener/listr2 | https://github.com/listr2/listr2 | 2k | Task execution lifecycle, renderer interval timers, subprocess task spawning, concurrent task management, output stream handling, cleanup hooks |
| 91 | cacjs/cac | https://github.com/cacjs/cac | 3k | Lightweight CLI parsing—minimal I/O baseline (expected: near-zero findings) |
| 92 | lukeed/sade | https://github.com/lukeed/sade | 1k | Micro CLI framework with no I/O—baseline control (expected: 0 findings) |
| 93 | sindresorhus/meow | https://github.com/sindresorhus/meow | 4k | CLI helper with package.json reading—minimal I/O baseline (expected: low findings, mainly file reads) |
| 94 | mattallty/Caporal.js | https://github.com/mattallty/Caporal.js | 3k | Command framework with validation, logger stream integration, colorization, action handler execution, help generation file reads |
| 95 | dthree/vorpal | https://github.com/dthree/vorpal | 6k | Interactive REPL readline interface, command history, persistent sessions, stdin/stdout handling, delimiter lifecycle, autocomplete event listeners |
| 96 | cronvel/terminal-kit | https://github.com/cronvel/terminal-kit | 3k | Terminal control sequences, TTY raw mode, keyboard input stream processing, screen buffer management, mouse event listeners, terminal state cleanup |
| 97 | vadimdemedes/ink | https://github.com/vadimdemedes/ink | 26k | React reconciler for terminal, stdin input stream, component lifecycle cleanup, useInput hook event listeners, focus management, app unmount cleanup |
| 98 | shelljs/shelljs | https://github.com/shelljs/shelljs | 14k | Unix command subprocess spawning (cp/mv/grep/sed), temp file operations, pipe stream chaining, silent mode output capture, exec process cleanup |
| 99 | google/clasp | https://github.com/google/clasp | 4k | Google Apps Script API HTTP requests, OAuth token file I/O, project file syncing, deployment upload streams, script push/pull file operations |
| 100 | infinitered/gluegun | https://github.com/infinitered/gluegun | 3k | CLI toolkit with filesystem operations, HTTP client requests, process spawning, template generation streams, prompt readline, plugin loading file I/O |

---

## Domain 3 — Database / ORM Libraries
**Selection rationale**: Database clients and ORMs with connection pooling, transaction management, cursor/result set cleanup, and prepared statement lifecycle—critical for detecting connection leaks that exhaust database resources.

| # | Repository | URL | Stars | Selection Reason: Resource Leak Patterns |
|---|-----------|-----|-------|-------------------|
| 101 | prisma/prisma | https://github.com/prisma/prisma | 38k | Prisma Client connection lifecycle, query engine subprocess management, connection pool exhaustion, transaction rollback cleanup, interactive transaction timeout, middleware chain cleanup |
| 102 | knex/knex | https://github.com/knex/knex | 19k | Connection pool lifecycle (pg/mysql/sqlite), transaction begin/commit/rollback cleanup, query builder resource release, stream query cursor management, connection timeout handling |
| 103 | sequelize/sequelize | https://github.com/sequelize/sequelize | 29k | Database connection pool management, transaction lifecycle (managed/unmanaged), model hook execution cleanup, association lazy loading, connection retry logic, dialect-specific connection handling |
| 104 | typeorm/typeorm | https://github.com/typeorm/typeorm | 34k | Connection manager lifecycle, query runner release, entity manager transactions, migration execution connection cleanup, subscriber event handler cleanup, cache provider connections |
| 105 | drizzle-team/drizzle-orm | https://github.com/drizzle-team/drizzle-orm | 23k | Database driver connection management, prepared statement lifecycle, transaction block cleanup, connection pooling (postgres.js/mysql2), batch query execution, migration connection handling |
| 106 | mikro-orm/mikro-orm | https://github.com/mikro-orm/mikro-orm | 7k | EntityManager fork lifecycle, unit of work cleanup, identity map management, connection driver lifecycle, transaction context cleanup, flush operation resource release |
| 107 | bookshelf/bookshelf | https://github.com/bookshelf/bookshelf | 6k | Underlying Knex connection pool, transaction block cleanup, model fetch query execution, relation loading connection management, plugin lifecycle hooks |
| 108 | Vincit/objection.js | https://github.com/Vincit/objection.js | 7k | Knex connection pool wrapping, transaction scope management, query builder cleanup, eager loading connection usage, graph insert/upsert operations, hook execution context |
| 109 | brianc/node-postgres | https://github.com/brianc/node-postgres | 12k | Connection pool client acquire/release, query result stream consumption, COPY stream operations, prepared statement cleanup, connection error handling, SSL connection management |
| 110 | mysqljs/mysql | https://github.com/mysqljs/mysql | 18k | Connection pool lifecycle, connection.end() cleanup, streaming query results, connection queue management, error event listener cleanup, multiple statement execution |
| 111 | sidorares/node-mysql2 | https://github.com/sidorares/node-mysql2 | 4k | Prepared statement lifecycle, connection pooling, binary protocol streams, execute/close statement cleanup, connection compression streams, promise wrapper resource management |
| 112 | mongodb/node-mongodb-native | https://github.com/mongodb/node-mongodb-native | 10k | MongoClient connection lifecycle, cursor stream cleanup, change stream monitoring, session management, topology monitoring connections, GridFS stream operations |
| 113 | Automattic/mongoose | https://github.com/Automattic/mongoose | 27k | Mongoose connection lifecycle, model compilation, change stream watchers, middleware hook cleanup, connection pool management, cursor stream operations, transaction session cleanup |
| 114 | redis/node-redis | https://github.com/redis/node-redis | 17k | Redis client connection lifecycle, pub/sub subscriber cleanup, command queue management, pipeline execution, multi/exec transaction blocks, socket connection handling, reconnection strategy |
| 115 | luin/ioredis | https://github.com/redis/ioredis | 14k | Redis cluster connection management, sentinel discovery, pipeline command buffering, pub/sub channel cleanup, Lua script loading, connection pool per node, automatic reconnection streams |
| 116 | louischatriot/nedb | https://github.com/louischatriot/nedb | 13k | File-based database persistence, auto-compaction file I/O, index file operations, cursor iteration cleanup, in-memory mode baseline comparison |
| 117 | typicode/lowdb | https://github.com/typicode/lowdb | 21k | JSON file database read/write operations, adapter lifecycle (node/browser), write queue management, file locking, synchronous disk operations |
| 118 | pouchdb/pouchdb | https://github.com/pouchdb/pouchdb | 17k | PouchDB instance lifecycle, replication stream management, changes feed event listeners, sync protocol connections, attachment blob streams, indexedDB/WebSQL adapter cleanup |
| 119 | WatermelonDB/WatermelonDB | https://github.com/Nozbe/WatermelonDB | 10k | SQLite adapter connection lifecycle, sync protocol HTTP connections, lazy load query execution, batch operation transactions, observe() subscription cleanup, worker thread management |
| 120 | kysely-org/kysely | https://github.com/kysely-org/kysely | 10k | Type-safe query builder with driver pooling, transaction scope cleanup, streaming query results, connection plugin lifecycle, dialect-specific connection management, CTE query execution |
| 121 | arangodb/arangojs | https://github.com/arangodb/arangojs | 1k | ArangoDB driver connection lifecycle, cursor stream cleanup, transaction commit/abort, graph traversal query execution, collection stream operations, connection pool management |
| 122 | elastic/elasticsearch-js | https://github.com/elastic/elasticsearch-js | 5k | Elasticsearch client connection lifecycle, scroll API cursor cleanup, bulk operation batching, search stream results, connection pool per node, point-in-time search cleanup |
| 123 | influxdata/influxdb-client-js | https://github.com/influxdata/influxdb-client-js | 1k | Write API buffer flush operations, query API stream results, client close cleanup, batch write point buffering, HTTP connection management, retry queue handling |
| 124 | neo4j/neo4j-javascript-driver | https://github.com/neo4j/neo4j-javascript-driver | 1k | Neo4j driver connection lifecycle, session management, transaction cleanup, reactive session streams, connection pool to cluster nodes, bookmark tracking |
| 125 | cockroachdb/cockroach | https://github.com/cockroachdb/cockroach | 30k | Go-based database with JS client bindings—minimal JS resource management (mainly connection protocol) |
| 126 | timgit/pg-promise | https://github.com/vitaly-t/pg-promise | 3k | PostgreSQL promise wrapper, task/transaction context cleanup, connection release, query formatting, batch operation execution, helper method cleanup |
| 127 | slonik/slonik | https://github.com/gajus/slonik | 4k | PostgreSQL client with connection pool lifecycle, interceptor chain cleanup, type parser registration, query execution stream handling, connection retry logic |
| 128 | vitaly-t/pg-promise | https://github.com/vitaly-t/pg-promise | 3k | PostgreSQL promise interface, connection pool management, transaction nesting, task/batch execution, query stream handling, prepared statement lifecycle, connection context cleanup |
| 129 | sql-js/sql.js | https://github.com/sql-js/sql.js | 12k | SQLite compiled to WebAssembly, database instance close, prepared statement finalization, in-memory database lifecycle, export/import buffer operations |
| 130 | better-sqlite3 | https://github.com/WiseLibs/better-sqlite3 | 5k | Native SQLite binding with synchronous API, database close cleanup, prepared statement disposal, transaction rollback handling, WAL mode checkpoint operations |
| 131 | mapbox/node-sqlite3 | https://github.com/TryGhost/node-sqlite3 | 6k | Asynchronous SQLite binding, database close cleanup, statement finalization, callback-based query execution, trace/profile event listener cleanup |
| 132 | hasura/graphql-engine | https://github.com/hasura/graphql-engine | 31k | Haskell-based engine with JS client—event trigger webhook subscriptions, GraphQL subscription WebSocket lifecycle, live query cleanup, action handler HTTP connections |
| 133 | edgedb/edgedb-js | https://github.com/edgedb/edgedb-js | 1k | EdgeDB client connection lifecycle, connection pooling, transaction block cleanup, query result set iteration, schema introspection queries, codegen file operations |
| 134 | planetscale/database-js | https://github.com/planetscale/database-js | 2k | Serverless MySQL over HTTP, fetch-based query execution, connection string parsing, query result streaming, branch connection management |
| 135 | dexie/Dexie.js | https://github.com/dexie/Dexie.js | 11k | IndexedDB wrapper, database close cleanup, transaction lifecycle, observable query subscriptions, bulk operations, version upgrade migration handling |
| 136 | orbitdb/orbitdb | https://github.com/orbitdb/orbitdb | 8k | Distributed database over IPFS, peer connection management, database store close cleanup, replication event streams, pubsub message handling, OrbitDB identity management |
| 137 | pubkey/rxdb | https://github.com/pubkey/rxdb | 21k | Reactive database with RxJS observables, query subscription cleanup, replication protocol connections, collection destroy lifecycle, change event streams, plugin system cleanup |
| 138 | agenda/agenda | https://github.com/agenda/agenda | 9k | Job scheduling with MongoDB backend, database connection lifecycle, job processing intervals, job lock cleanup, recurring job timers, queue drain handling |
| 139 | OptimalBits/bull | https://github.com/OptimalBits/bull | 15k | Redis-backed job queue, connection per queue, worker process lifecycle, event listener cleanup, job completion cleanup, rate limiter timers, blocked connection management |
| 140 | taskforcesh/bullmq | https://github.com/taskforcesh/bullmq | 6k | Modern Bull rewrite, Redis connection pooling, worker lifecycle cleanup, flow producer connections, job completion events, rate limiting, queue event subscriptions |
| 141 | bee-queue/bee-queue | https://github.com/bee-queue/bee-queue | 4k | Simple Redis queue, client connection lifecycle, worker processing loop cleanup, job ready event listeners, stalling job check intervals, queue close operations |
| 142 | kue/kue | https://github.com/Automattic/kue | 9k | Redis-backed priority job queue, job.remove() cleanup, worker process lifecycle, event listener management, job state transitions, delayed job timers, graceful shutdown |
| 143 | OptimalBits/bull-board | https://github.com/felixmosh/bull-board | 2k | Bull/BullMQ UI dashboard, Express/Fastify/Hapi server integration, queue monitoring connections, SSE event streams, Redis connection pooling, real-time job updates |
| 144 | FerretDB/FerretDB | https://github.com/FerretDB/FerretDB | 9k | MongoDB-compatible proxy to PostgreSQL—Go-based server with JS client connection management, wire protocol handling |
| 145 | keyv/keyv | https://github.com/jaredwray/keyv | 3k | Key-value storage abstraction, adapter connection lifecycle (Redis/MongoDB/SQLite/PostgreSQL), namespace cleanup, TTL expiration timers, compression stream handling |
| 146 | sindresorhus/keyv | https://github.com/jaredwray/keyv | 3k | Duplicate entry of #145—same repository (jaredwray/keyv) |

---

## Domain 4 — File Processing / Build Tools
**Selection rationale**: Build tools and file processors with extensive file I/O, file watching, worker threads, compilation streams, and archive/image processing—high likelihood of unclosed file handles and watcher leaks.

| # | Repository | URL | Stars | Selection Reason: Resource Leak Patterns |
|---|-----------|-----|-------|-------------------|
| 151 | webpack/webpack | https://github.com/webpack/webpack | 64k | File watcher lifecycle (chokidar), compilation asset streams, plugin hook cleanup, module graph memory, dev server WebSocket, HMR runtime connections, cache filesystem I/O |
| 152 | rollup/rollup | https://github.com/rollup/rollup | 25k | Bundle output file streams, watch mode file monitoring, plugin context cleanup, module resolution cache, sourcemap generation I/O, chunk emission streams |
| 153 | vitejs/vite | https://github.com/vitejs/vite | 67k | Dev server HTTP/WebSocket lifecycle, HMR client connections, file watcher cleanup, module graph hot update, plugin container lifecycle, optimizer cache I/O, preview server |
| 154 | parcel-bundler/parcel | https://github.com/parcel-bundler/parcel | 43k | Worker farm thread pool management, file watcher lifecycle, asset pipeline streams, cache directory I/O, HMR server WebSocket, package manager subprocess |
| 155 | esbuild/esbuild | https://github.com/evanw/esbuild | 38k | Go binary with JS wrapper—minimal JS resource management (mainly subprocess communication, watch mode process lifecycle) |
| 156 | privatenumber/esbuild-loader | https://github.com/privatenumber/esbuild-loader | 1k | Webpack loader using esbuild, worker thread pool for compilation, file transformation streams, cache management, sourcemap generation |
| 157 | babel/babel | https://github.com/babel/babel | 43k | Source file transformation I/O, plugin/preset loading, config file reading, AST traversal memory, sourcemap generation, cache directory operations, watch mode file monitoring |
| 158 | gulpjs/gulp | https://github.com/gulpjs/gulp | 33k | Vinyl file stream pipeline, gulp.watch() file monitoring, task orchestration, stream transformation chains, plugin stream cleanup, glob file reading |
| 159 | gruntjs/grunt | https://github.com/gruntjs/grunt | 12k | Task runner file I/O operations, file.copy/delete streams, watch task file monitoring, template processing, config file loading, multi-task execution |
| 160 | postcss/postcss | https://github.com/postcss/postcss | 28k | CSS file parsing I/O, plugin pipeline processing, sourcemap generation, result cleanup, AST node traversal, file watching in runners |
| 161 | sass/dart-sass | https://github.com/sass/dart-sass | 4k | Dart-based Sass compiler—JS wrapper for subprocess communication, file import resolution, watch mode process lifecycle, compilation cache |
| 162 | less/less.js | https://github.com/less/less.js | 17k | LESS file parsing and imports, @import file resolution, compilation output streams, sourcemap generation, file system plugin, watch mode monitoring |
| 163 | tailwindlabs/tailwindcss | https://github.com/tailwindlabs/tailwindcss | 81k | Content file scanning (glob patterns), JIT mode file watching, PostCSS plugin lifecycle, config file loading, build cache I/O, class extraction parsing |
| 164 | stylelint/stylelint | https://github.com/stylelint/stylelint | 11k | CSS/SCSS file reading streams, linting rule execution, fix mode file writing, cache file I/O, plugin loading, formatter output streams |
| 165 | eslint/eslint | https://github.com/eslint/eslint | 25k | Source file reading/parsing, rule execution context, fix mode file writing, cache directory I/O, plugin/config loading, formatter output, file watcher in --watch mode |
| 166 | dprint/dprint | https://github.com/dprint/dprint | 3k | Rust-based formatter with JS plugin, WASM module lifecycle, file formatting streams, config file loading, plugin communication, incremental formatting cache |
| 167 | standard/standard | https://github.com/standard/standard | 29k | JavaScript linter with ESLint under the hood, file reading/parsing, fix mode file writing, cache directory I/O, formatter output streams |
| 168 | oxc-project/oxc | https://github.com/oxc-project/oxc | 10k | Rust-based parser/linter with JS bindings—minimal JS resource management (native module lifecycle, worker thread pool) |
| 169 | nodejs/undici | https://github.com/nodejs/undici | 6k | HTTP/1.1 client with connection pooling, socket lifecycle management, request/response stream handling, pipeline multiplexing, agent pool cleanup, keep-alive connections |
| 170 | isaacs/node-glob | https://github.com/isaacs/node-glob | 8k | Directory traversal with readdir streams, pattern matching, stat cache management, symlink following, abort signal handling, minimatch pattern compilation |
| 171 | micromatch/micromatch | https://github.com/micromatch/micromatch | 4k | Pure glob pattern matching library—minimal I/O baseline (expected: near-zero findings, mainly pattern compilation) |
| 172 | paulmillr/chokidar | https://github.com/paulmillr/chokidar | 11k | File system watcher with fs.watch/fs.watchFile, watcher.close() cleanup, event listener management, polling interval timers, recursive directory monitoring, symlink handling |
| 173 | remy/nodemon | https://github.com/remy/nodemon | 26k | File watcher for auto-restart, child process spawning/killing, config file monitoring, ignore pattern matching, signal handling, debounce timers, process cleanup on exit |
| 174 | open-cli-tools/concurrently | https://github.com/open-cli-tools/concurrently | 7k | Multiple process spawning, stdio stream handling, process kill-on-exit, prefix stream transformation, restart logic, signal propagation, command completion tracking |
| 175 | pm2/pm2 | https://github.com/Unitech/pm2 | 41k | Process manager daemon, cluster mode workers, IPC communication, log file streams, monitoring intervals, RPC server, God daemon process, app restart logic, graceful shutdown |
| 176 | foreversd/forever | https://github.com/foreversd/forever | 14k | Process monitoring daemon, child process respawn, log file stream rotation, monitor socket server, process cleanup, signal handling, restart policy timers |
| 177 | Marak/faker.js | https://github.com/faker-js/faker | 12k | Data generation library with no I/O—baseline control (expected: 0 findings) |
| 178 | jprichardson/node-fs-extra | https://github.com/jprichardson/node-fs-extra | 9k | Extended filesystem operations, copy/move stream handling, recursive directory operations, JSON file read/write, ensureDir file creation, remove/emptyDir cleanup |
| 179 | sindresorhus/del | https://github.com/sindresorhus/del | 1k | File deletion with glob patterns, rimraf-style recursive removal, dry-run mode, trash/permanent deletion, concurrency control, path validation |
| 180 | isaacs/rimraf | https://github.com/isaacs/rimraf | 5k | Recursive directory removal, file handle cleanup, retry logic for locked files, glob pattern support, parallel deletion, EMFILE handling |
| 181 | jprichardson/node-jsonfile | https://github.com/jprichardson/node-jsonfile | 1k | JSON file read/write operations, file handle management, atomic writes with temp files, pretty-printing, error handling |
| 182 | LinusU/fs-xattr | https://github.com/LinusU/fs-xattr | 1k | Native addon for extended file attributes—minimal JS resource management (native module lifecycle, file descriptor operations) |
| 183 | sindresorhus/tempy | https://github.com/sindresorhus/tempy | 1k | Temporary file/directory creation, automatic cleanup on process exit, unique name generation, temp file handle management |
| 184 | Stuk/jszip | https://github.com/Stuk/jszip | 10k | ZIP archive creation/extraction, compression streams, file entry iteration, generateAsync stream output, memory buffer management, worker thread compression |
| 185 | archiverjs/node-archiver | https://github.com/archiverjs/node-archiver | 3k | Archive stream creation (zip/tar), file append streams, directory globbing, compression pipeline, finalize() cleanup, pointer/offset tracking |
| 186 | thejoshwolfe/yauzl | https://github.com/thejoshwolfe/yauzl | 1k | ZIP file reading with streaming, entry stream extraction, central directory parsing, file handle management, openReadStream() cleanup, lazyEntries mode |
| 187 | ZJONSSON/node-unzipper | https://github.com/ZJONSSON/node-unzipper | 1k | ZIP extraction streams, pipe-based extraction, entry filtering, directory creation, stream transformation, auto-drain handling |
| 188 | mafintosh/tar-stream | https://github.com/mafintosh/tar-stream | 1k | TAR archive pack/extract streams, entry header parsing, stream piping, finalize() cleanup, header buffer management |
| 189 | imagemin/imagemin | https://github.com/imagemin/imagemin | 6k | Image optimization pipeline, plugin stream processing, buffer/file input, concurrent optimization, output stream writing, plugin cleanup |
| 190 | lovell/sharp | https://github.com/lovell/sharp | 29k | High-performance image processing with libvips, stream input/output, pipeline chaining, native resource cleanup, worker thread pool, buffer management, metadata extraction |
| 191 | jimp-dev/jimp | https://github.com/jimp-dev/jimp | 14k | Pure JavaScript image processing, file read/write operations, buffer manipulation, font loading, plugin system, async operation chains |
| 192 | nodeca/probe-image-size | https://github.com/nodeca/probe-image-size | 1k | Image dimension probing from streams, HTTP request streams, early abort after header read, minimal buffer consumption, timeout handling |
| 193 | fluent-ffmpeg/node-fluent-ffmpeg | https://github.com/fluent-ffmpeg/node-fluent-ffmpeg | 8k | FFmpeg subprocess spawning, input/output stream piping, progress monitoring, process kill handling, temp file cleanup, multiple input streams |
| 194 | sindresorhus/file-type | https://github.com/sindresorhus/file-type | 4k | File type detection from streams/buffers, magic number parsing, stream peeking without consumption, minimal I/O |
| 195 | node-formidable/formidable | https://github.com/node-formidable/formidable | 7k | Multipart form parsing, file upload streams, temporary file creation, field/file event handling, hash calculation streams, maxFileSize enforcement |
| 196 | mscdex/busboy | https://github.com/mscdex/busboy | 3k | Multipart/form-data stream parsing, file upload handling, field extraction, backpressure management, limit enforcement, stream cleanup |
| 197 | expressjs/multer | https://github.com/expressjs/multer | 11k | Express middleware for file uploads, storage engine (disk/memory), temp file cleanup, stream handling, filename generation, file filter validation |
| 198 | tunafield/multer-s3 | https://github.com/badunk/multer-s3 | 1k | Multer storage engine for S3, upload stream piping to AWS, multipart upload handling, metadata setting, ACL configuration, stream error handling |
| 199 | csv/node-csv | https://github.com/adaltas/node-csv | 2k | CSV parsing/stringifying streams, transform pipeline, record buffering, delimiter detection, quote handling, stream backpressure |
| 200 | mholt/PapaParse | https://github.com/mholt/PapaParse | 12k | CSV parser with streaming support, file reading, worker thread parsing, chunk processing, abort handling, download/upload stream parsing |

---

## Domain 5 — Real-time / WebSocket Applications
**Selection rationale**: Real-time communication libraries with WebSocket connections, pub/sub subscriptions, peer-to-peer networking, and event-driven architectures—prone to connection leaks, subscription accumulation, and event listener buildup.

| # | Repository | URL | Stars | Selection Reason: Resource Leak Patterns |
|---|-----------|-----|-------|-------------------|
| 201 | socketio/socket.io | https://github.com/socketio/socket.io | 61k | WebSocket server namespace management, room join/leave cleanup, socket disconnect handling, adapter pub/sub connections (Redis/MongoDB), middleware chain cleanup, heartbeat timers |
| 202 | websockets/ws | https://github.com/websockets/ws | 21k | WebSocket server/client lifecycle, connection close cleanup, ping/pong heartbeat timers, message event listeners, upgrade request handling, per-message deflate streams |
| 203 | uNetworking/uWebSockets.js | https://github.com/uNetworking/uWebSockets.js | 7k | High-performance native WebSocket implementation, socket lifecycle, pub/sub topic subscriptions, backpressure handling, SSL context cleanup, HTTP upgrade handling |
| 204 | primus/primus | https://github.com/primus/primus | 4k | Real-time framework abstraction, spark (connection) lifecycle, transformer plugin cleanup (ws/engine.io/sockjs), heartbeat intervals, reconnection strategy timers |
| 205 | faye/faye | https://github.com/faye/faye | 4k | Pub/sub messaging protocol, client connection lifecycle, channel subscription cleanup, Bayeux protocol handling, transport adapter (WebSocket/long-polling) cleanup, timeout timers |
| 206 | centrifugal/centrifugo | https://github.com/centrifugal/centrifugo | 8k | Real-time messaging server JS client, subscription lifecycle, channel presence tracking, history stream cleanup, reconnection backoff timers, RPC call cleanup |
| 207 | deepstreamIO/deepstream.io | https://github.com/deepstreamIO/deepstream.io | 7k | Real-time data sync platform, client connection management, record subscription cleanup, RPC provider registration, event listener accumulation, presence tracking |
| 208 | feross/simple-peer | https://github.com/feross/simple-peer | 7k | WebRTC peer connection wrapper, RTCPeerConnection lifecycle, data channel cleanup, ICE candidate gathering, stream track management, signal event listeners |
| 209 | peers/peerjs | https://github.com/peers/peerjs | 12k | WebRTC peer-to-peer library, peer connection lifecycle, data connection cleanup, media connection streams, signaling server WebSocket, peer discovery cleanup |
| 210 | amark/gun | https://github.com/amark/gun | 18k | Decentralized graph database, peer mesh network connections, WebSocket/WebRTC transport cleanup, subscription graph traversal, sync protocol streams, storage adapter I/O |
| 211 | yjs/yjs | https://github.com/yjs/yjs | 16k | CRDT collaborative editing, provider connection lifecycle (WebSocket/WebRTC), awareness protocol cleanup, document sync streams, subdocument management, observer subscriptions |
| 212 | share/sharedb | https://github.com/share/sharedb | 6k | Operational transformation backend, agent connection management, document subscription cleanup, database backend connections, pub/sub adapter (Redis), query stream lifecycle |
| 213 | ably/ably-js | https://github.com/ably/ably-js | 1k | Realtime messaging client, connection state machine, channel attach/detach cleanup, presence member tracking, message queue management, WebSocket/Comet fallback |
| 214 | pubnub/javascript | https://github.com/pubnub/javascript | 1k | PubNub SDK, subscribe/unsubscribe lifecycle, listener management, heartbeat intervals, presence tracking, message history polling, reconnection logic |
| 215 | pusher/pusher-js | https://github.com/pusher/pusher-js | 2k | Pusher Channels client, channel subscription lifecycle, event unbinding, connection state management, WebSocket/HTTP fallback, activity timeout timers |
| 216 | crossbario/autobahn-js | https://github.com/crossbario/autobahn-js | 1k | WAMP protocol implementation, session lifecycle, subscription/registration cleanup, RPC call management, WebSocket transport, progressive call results streams |
| 217 | NodeBB/NodeBB | https://github.com/NodeBB/NodeBB | 14k | Forum platform with Socket.io real-time, Redis pub/sub connections, room management, notification streams, database connection pooling, session store cleanup |
| 218 | RocketChat/Rocket.Chat | https://github.com/RocketChat/Rocket.Chat | 40k | Team chat platform, WebSocket DDP connections, MongoDB change streams, subscription lifecycle, file upload streams, notification workers, federation protocol |
| 219 | mattermost/mattermost | https://github.com/mattermost/mattermost | 29k | Go-based server with JS client, WebSocket connection management, reconnection strategy, event subscription cleanup, file upload streams, plugin system lifecycle |
| 220 | thelounge/thelounge | https://github.com/thelounge/thelounge | 6k | IRC web client, IRC server connections, Socket.io client sessions, message stream handling, file upload cleanup, network reconnection timers |
| 221 | matrix-org/matrix-js-sdk | https://github.com/matrix-org/matrix-js-sdk | 2k | Matrix protocol SDK, sync loop HTTP long-polling, room timeline streams, event store I/O, crypto device tracking, to-device message queues, presence timers |
| 222 | revoltchat/revolt.js | https://github.com/revoltchat/revolt.js | 1k | Revolt chat client library, WebSocket event stream, REST API client connections, message cache management, file upload streams, typing indicator timers |
| 223 | mqtt/mqtt.js | https://github.com/mqttjs/MQTT.js | 8k | MQTT protocol client, connection lifecycle (TCP/WebSocket/TLS), topic subscription cleanup, QoS message queues, keepalive ping timers, reconnection backoff |
| 224 | moscajs/aedes | https://github.com/moscajs/aedes | 2k | MQTT broker, client connection management, subscription tree cleanup, persistence adapter I/O, retained message storage, will message handling, heartbeat monitoring |
| 225 | vernemq/vernemq | https://github.com/vernemq/vernemq | 3k | Erlang-based MQTT broker with JS client bindings—minimal JS resource management (client connection protocol, subscription handling) |
| 226 | nats-io/nats.js | https://github.com/nats-io/nats.js | 2k | NATS messaging client, connection drain/close lifecycle, subscription cleanup, request/reply pattern cleanup, JetStream consumer management, reconnection timers |
| 227 | amqp-node/amqplib | https://github.com/amqp-node/amqplib | 4k | AMQP 0-9-1 client, channel/connection lifecycle, consumer tag cleanup, queue/exchange declarations, prefetch buffer management, heartbeat timers |
| 228 | rabbitmq/rabbitmq-server | https://github.com/rabbitmq/rabbitmq-server | 12k | Erlang-based message broker with JS client libraries—minimal JS resource management (connection protocol, channel management) |
| 229 | kafkajs/kafkajs | https://github.com/tulios/kafkajs | 4k | Apache Kafka client, producer/consumer lifecycle, broker connection pooling, partition assignment, offset commit cleanup, heartbeat intervals, batch processing |
| 230 | grpc/grpc-node | https://github.com/grpc/grpc-node | 4k | gRPC client/server, channel lifecycle, call cancellation, streaming RPC cleanup (client/server/bidi), metadata handling, keepalive timers, connection pooling |
| 231 | improbable-eng/grpc-web | https://github.com/improbable-eng/grpc-web | 8k | gRPC-Web client, streaming call lifecycle, XHR/fetch transport cleanup, call cancellation, metadata headers, response stream handling |
| 232 | apollographql/subscriptions-transport-ws | https://github.com/apollographql/subscriptions-transport-ws | 2k | GraphQL subscriptions over WebSocket, subscription lifecycle, connection init/ack, keepalive timers, operation cleanup, reconnection logic |
| 233 | enisdenjo/graphql-ws | https://github.com/enisdenjo/graphql-ws | 2k | GraphQL over WebSocket protocol, client/server lifecycle, subscription cleanup, connection acknowledgment, ping/pong heartbeat, lazy connection mode |
| 234 | enisdenjo/graphql-sse | https://github.com/enisdenjo/graphql-sse | 1k | GraphQL over Server-Sent Events, EventSource connection lifecycle, subscription stream cleanup, retry logic, connection timeout handling |
| 235 | liveblocks/liveblocks | https://github.com/liveblocks/liveblocks | 3k | Collaborative platform, room connection lifecycle, presence tracking cleanup, storage subscription, broadcast channel, undo/redo history, WebSocket reconnection |
| 236 | feathersjs/feathers | https://github.com/feathersjs/feathers | 15k | Real-time API framework, service event emitters, WebSocket transport lifecycle, hook chain execution, authentication session management, channel subscription cleanup |
| 237 | colyseus/colyseus | https://github.com/colyseus/colyseus | 6k | Multiplayer game server, room lifecycle management, client connection cleanup, state synchronization, matchmaking, seat reservation timers, graceful shutdown |
| 238 | geckosio/geckos.io | https://github.com/geckosio/geckos.io | 1k | Real-time multiplayer with WebRTC data channels, UDP-like unreliable transport, peer connection lifecycle, channel cleanup, signaling server WebSocket |
| 239 | versatica/mediasoup | https://github.com/versatica/mediasoup | 6k | WebRTC SFU, worker process lifecycle, router/transport/producer/consumer cleanup, C++ worker subprocess, RTP stream handling, SCTP data channels |
| 240 | livekit/server-sdk-js | https://github.com/livekit/server-sdk-js | 1k | LiveKit server SDK, room service gRPC connections, participant tracking, track publication, egress/ingress management, webhook delivery |
| 241 | daily-co/daily-js | https://github.com/daily-co/daily-js | 1k | Video call client SDK, call instance lifecycle, media track cleanup, participant events, screen share streams, recording management, network quality monitoring |
| 242 | AgoraIO/API-Examples-Web | https://github.com/AgoraIO/API-Examples-Web | 1k | Agora RTC examples, client join/leave lifecycle, local/remote track management, stream subscription cleanup, audio/video device handling |
| 243 | supabase/realtime | https://github.com/supabase/realtime | 7k | Elixir-based realtime server with JS client, channel subscription lifecycle, presence tracking, broadcast messaging, PostgreSQL replication stream, WebSocket connection |
| 244 | hopinc/js | https://github.com/hopinc/js | 1k | Hop platform SDK, channel/pipe connection management, deployment API client, project resource cleanup, WebSocket event streams |
| 245 | soketi/soketi | https://github.com/soketi/soketi | 5k | Pusher-compatible WebSocket server, connection management, channel subscription cleanup, adapter backend (Redis/local), presence tracking, webhook delivery |
| 246 | centrifugal/centrifuge-js | https://github.com/centrifugal/centrifuge-js | 1k | Centrifugo JS client, subscription lifecycle, presence/history tracking, RPC calls, reconnection backoff, token refresh, publication streams |
| 247 | mcollina/undici-fetch | https://github.com/nodejs/undici | 1k | Undici fetch implementation, request/response stream lifecycle, body consumption, abort signal handling, connection pool cleanup, redirect following |
| 248 | EventEmitter2/EventEmitter2 | https://github.com/EventEmitter2/EventEmitter2 | 2k | Enhanced EventEmitter, listener registration/removal, wildcard event patterns, namespace support, max listeners enforcement, memory leak detection |
| 249 | primus/eventemitter3 | https://github.com/primus/eventemitter3 | 3k | Lightweight EventEmitter, listener lifecycle, once() auto-removal, removeAllListeners cleanup, event context binding, minimal memory footprint |

---

## Domain 6 — DevOps / Infrastructure
**Selection rationale**: DevOps tools and infrastructure SDKs with container API clients, cloud service connections, monitoring agents, CI/CD integrations, and deployment pipelines—high risk of unclosed HTTP clients and process leaks.

| # | Repository | URL | Stars | Selection Reason: Resource Leak Patterns |
|---|-----------|-----|-------|-------------------|
| 250 | docker/docker-node | https://github.com/nodejs/docker-node | 8k | Official Node.js Docker images—minimal JS resource management (mainly Dockerfile build scripts, base image configuration) |
| 251 | dockerode/dockerode | https://github.com/apocas/dockerode | 4k | Docker Engine API client, container/image lifecycle, stream handling for logs/exec, network/volume management, build context streams, event monitoring |
| 252 | portainer/portainer | https://github.com/portainer/portainer | 30k | Container management UI, Docker API HTTP client connections, WebSocket real-time updates, environment endpoint management, volume/network cleanup |
| 253 | traefik/traefik | https://github.com/traefik/traefik | 50k | Go-based reverse proxy—minimal JS resource management (if any JS admin interface exists) |
| 254 | fastify/fastify-cli | https://github.com/fastify/fastify-cli | 1k | Fastify CLI tool, server lifecycle management, plugin loading, watch mode file monitoring, generator scaffolding, subprocess spawning |
| 255 | verdaccio/verdaccio | https://github.com/verdaccio/verdaccio | 16k | npm registry proxy, package tarball streams, storage backend I/O, authentication plugin lifecycle, HTTP server connections, search index updates |
| 256 | cnpm/cnpmjs.org | https://github.com/cnpm/cnpmjs.org | 5k | npm registry mirror, package sync worker, tarball download/upload streams, database connection pooling, sync queue management, registry proxy HTTP client |
| 257 | github/github-script | https://github.com/actions/github-script | 4k | GitHub Actions script runner, Octokit API client connections, action context cleanup, script execution isolation, require() module loading |
| 258 | actions/toolkit | https://github.com/actions/toolkit | 5k | GitHub Actions SDK, HTTP client for API requests, artifact upload/download streams, cache save/restore I/O, tool download streams, exec subprocess spawning |
| 259 | nektos/act | https://github.com/nektos/act | 53k | Go-based local GitHub Actions runner—minimal JS resource management (runs actions in containers) |
| 260 | ansible/awx | https://github.com/ansible/awx | 14k | Ansible Tower web UI, WebSocket job status updates, API client connections, inventory sync, playbook execution streams, task manager workers |
| 261 | hashicorp/terraform-cdk | https://github.com/hashicorp/terraform-cdk | 5k | Terraform CDK for TypeScript, provider plugin subprocess spawning, state file I/O, resource graph construction, synth output streams, stack lifecycle |
| 262 | serverless/serverless | https://github.com/serverless/serverless | 46k | Serverless framework, cloud provider API clients, deployment package creation, log streaming, plugin lifecycle, configuration file I/O, service cleanup |
| 263 | sst/sst | https://github.com/sst/sst | 21k | Serverless Stack framework, AWS CDK integration, live Lambda development, WebSocket debug connections, CloudFormation deployment streams, resource cleanup |
| 264 | aws/aws-sdk-js-v3 | https://github.com/aws/aws-sdk-js-v3 | 3k | AWS SDK v3, client.destroy() lifecycle, request/response streams, credential provider refresh, middleware stack cleanup, retry strategy timers, S3 multipart uploads |
| 265 | googleapis/google-cloud-node | https://github.com/googleapis/google-cloud-node | 3k | Google Cloud SDK, client.close() cleanup, gRPC channel lifecycle, streaming API calls, authentication token refresh, BigQuery result streams, Storage upload/download |
| 266 | linode/linode-js-sdk | https://github.com/linode/manager | 1k | Linode API SDK, HTTP client connections, resource management, event polling, volume/network operations, firewall rule management, backup scheduling |
| 267 | localstack/localstack | https://github.com/localstack/localstack | 54k | Python-based AWS emulator with JS client SDKs—minimal JS resource management (mainly SDK connection configuration) |
| 268 | minio/minio-js | https://github.com/minio/minio-js | 1k | MinIO S3-compatible client, HTTP connection pooling, object upload/download streams, bucket notification listeners, presigned URL generation, multipart upload cleanup |
| 269 | prometheus/prom-client | https://github.com/siimon/prom-client | 3k | Prometheus metrics client, metric registry cleanup, histogram/summary timers, gauge collection intervals, pushgateway HTTP client, metric scrape endpoint |
| 270 | elastic/apm-agent-nodejs | https://github.com/elastic/apm-agent-nodejs | 1k | APM agent, transaction/span lifecycle, HTTP client for APM server, metadata collection, error capture, metric aggregation intervals, graceful shutdown |
| 271 | open-telemetry/opentelemetry-js | https://github.com/open-telemetry/opentelemetry-js | 3k | OpenTelemetry SDK, exporter shutdown cleanup, span processor batching, metric reader intervals, context propagation, resource detector cleanup, tracer provider lifecycle |
| 272 | jaegertracing/jaeger-client-node | https://github.com/jaegertracing/jaeger-client-node | 1k | Jaeger tracing client, reporter flush/close, UDP sender socket, sampler refresh intervals, span buffer management, metrics reporter cleanup |
| 273 | bugsnag/bugsnag-js | https://github.com/bugsnag/bugsnag-js | 2k | Error monitoring SDK, event delivery HTTP client, breadcrumb storage, session tracking, plugin lifecycle, network queue management, flush timers |
| 274 | DataDog/dd-trace-js | https://github.com/DataDog/dd-trace-js | 1k | Datadog APM tracer, tracer shutdown, writer flush intervals, agent HTTP client, span encoding, profiler subprocess, metric aggregation, plugin lifecycle |
| 275 | newrelic/node-newrelic | https://github.com/newrelic/node-newrelic | 1k | New Relic APM agent, agent shutdown cleanup, harvest cycle timers, collector HTTP client, transaction traces, metric aggregation, custom instrumentation hooks |
| 276 | clinicjs/node-clinic | https://github.com/clinicjs/node-clinic | 3k | Node.js profiler suite, subprocess spawning for profiling tools, temp file cleanup, flamegraph generation, heap snapshot I/O, metrics collection streams |
| 277 | davidmarkclements/0x | https://github.com/davidmarkclements/0x | 3k | Flamegraph profiler, subprocess spawning for perf/dtrace, temp file operations, SVG generation streams, process signal handling, cleanup on exit |
| 278 | GoogleCloudPlatform/cloud-debug-nodejs | https://github.com/GoogleCloudPlatform/cloud-debug-nodejs | 1k | Cloud Debugger agent, breakpoint management, snapshot capture, API client connections, source file reading, expression evaluation, agent lifecycle |
| 279 | artilleryio/artillery | https://github.com/artilleryio/artillery | 8k | Load testing tool, worker process spawning, HTTP/WebSocket client connections, scenario execution, metrics aggregation, report generation streams, plugin lifecycle |
| 280 | grafana/k6 | https://github.com/grafana/k6 | 25k | Go-based load tester with JS runtime—minimal JS resource management (JS test script execution, HTTP client connections in Go runtime) |
| 281 | locustio/locust | https://github.com/locustio/locust | 24k | Python-based load tester—minimal JS resource management (web UI may have JS components) |
| 282 | Kong/insomnia | https://github.com/Kong/insomnia | 34k | API client/testing tool, HTTP request execution, WebSocket connections, GraphQL subscriptions, plugin system, workspace sync, response streaming |
| 283 | ladjs/supertest | https://github.com/ladjs/supertest | 14k | HTTP assertion library, test server lifecycle, request/response streams, agent connection cleanup, expect chain execution, server.close() handling |
| 284 | nock/nock | https://github.com/nock/nock | 13k | HTTP mocking library, interceptor registration/cleanup, nock.cleanAll() restore, request matching, response stream simulation, persist/isDone tracking |
| 285 | mswjs/msw | https://github.com/mswjs/msw | 15k | Mock Service Worker, service worker lifecycle, request interceptor cleanup, handler registration, response resolver execution, worker.stop() cleanup |
| 286 | wiremock/wiremock | https://github.com/wiremock/wiremock | 6k | Java-based mock server with JS client—minimal JS resource management (client HTTP connections to mock server) |
| 287 | pactumjs/pactum | https://github.com/pactumjs/pactum | 1k | REST API testing tool, mock server lifecycle, request handler cleanup, interaction recording, state management, response template processing |
| 288 | apideck-libraries/portman | https://github.com/apideck-libraries/portman | 1k | OpenAPI to Postman converter, file I/O operations, collection generation, test script injection, HTTP client for validation, Newman runner integration |
| 289 | testcontainers/testcontainers-node | https://github.com/testcontainers/testcontainers-node | 2k | Test container management, Docker API client, container lifecycle (start/stop), network creation/removal, volume cleanup, log stream following, wait strategies |
| 290 | apocas/dockerode | https://github.com/apocas/dockerode | 4k | Docker API client, container/image/network lifecycle, exec stream handling, build context tar streams, event monitoring, volume management, swarm operations |
| 291 | kubernetes-client/javascript | https://github.com/kubernetes-client/javascript | 2k | Kubernetes API client, watch stream lifecycle, kubeconfig parsing, resource CRUD operations, exec/attach streams, log streaming, informer cache management |
| 292 | rancher/rancher | https://github.com/rancher/rancher | 23k | Kubernetes management platform, cluster connection pooling, WebSocket for real-time updates, kubectl proxy streams, monitoring agent connections, multi-cluster sync |
| 293 | Infisical/infisical | https://github.com/Infisical/infisical | 15k | Secret management platform, database connection pooling, encryption key lifecycle, API client connections, WebSocket sync, audit log streams, CLI subprocess |
| 294 | hashicorp/vault | https://github.com/hashicorp/vault | 31k | Go-based secrets manager with JS client, HTTP API connections, token renewal timers, lease management, secret caching, authentication backend connections |
| 295 | bitwarden/clients | https://github.com/bitwarden/clients | 9k | Password manager clients, encryption/decryption streams, session management, sync protocol WebSocket, vault database I/O, attachment file streams, auto-lock timers |
| 296 | 1Password/connect-sdk-js | https://github.com/1Password/connect-sdk-js | 1k | 1Password Connect SDK, HTTP client for API requests, session token management, vault item retrieval, file attachment streams, webhook subscriptions |
| 297 | ory/hydra | https://github.com/ory/hydra | 15k | Go-based OAuth2 server with JS SDK, OAuth flow management, session storage connections, consent/login challenge handling, token introspection, client registration |
| 298 | casdoor/casdoor | https://github.com/casdoor/casdoor | 10k | Go-based identity platform with JS SDK, authentication API connections, session management, OAuth provider integration, user sync, LDAP connections |
| 299 | clerk/javascript | https://github.com/clerk/javascript | 3k | Authentication SDK, API client connections, session token refresh, WebSocket for real-time updates, user metadata sync, organization management, webhook handling |

---

## Domain 7 — Testing / Developer Tools
**Selection rationale**: Testing frameworks and developer tools with worker threads, browser automation, file watchers, subprocess spawning, and code instrumentation—prone to worker/process leaks and unclosed browser connections.

| # | Repository | URL | Stars | Selection Reason: Resource Leak Patterns |
|---|-----------|-----|-------|-------------------|
| 300 | jestjs/jest | https://github.com/jestjs/jest | 44k | Test runner with worker threads, file watcher (--watch mode), coverage instrumentation, module mocking, snapshot file I/O, reporter output streams, worker pool cleanup |
| 301 | mochajs/mocha | https://github.com/mochajs/mocha | 23k | Test framework, reporter output streams, file globbing for test discovery, --watch mode file monitoring, hook execution, parallel mode worker processes |
| 302 | avajs/ava | https://github.com/avajs/ava | 21k | Concurrent test runner, worker process spawning per test file, IPC communication, --watch mode file monitoring, snapshot file operations, shared worker cleanup |
| 303 | vitest-dev/vitest | https://github.com/vitest-dev/vitest | 13k | Vite-powered test runner, worker thread pool, HMR file watcher, module graph hot update, coverage collection, browser mode WebSocket, UI server lifecycle |
| 304 | jasmine/jasmine-npm | https://github.com/jasmine/jasmine-npm | 2k | BDD test framework, spec runner lifecycle, reporter cleanup, custom matcher registration, spy/stub cleanup, random seed generation |
| 305 | cypress-io/cypress | https://github.com/cypress-io/cypress | 47k | E2E testing framework, browser process lifecycle, IPC between runner and browser, video recording streams, screenshot file I/O, network proxy, plugin subprocess |
| 306 | microsoft/playwright | https://github.com/microsoft/playwright | 65k | Browser automation, browser/context/page lifecycle, CDP connection, video recording streams, trace file I/O, network interception, worker cleanup, screenshot buffers |
| 307 | puppeteer/puppeteer | https://github.com/puppeteer/puppeteer | 88k | Chrome DevTools Protocol automation, browser.close() cleanup, page lifecycle, CDP session management, screenshot/PDF generation, network interception, target tracking |
| 308 | webdriverio/webdriverio | https://github.com/webdriverio/webdriverio | 9k | WebDriver automation, session lifecycle, driver connection cleanup, element reference tracking, screenshot file operations, service worker management, multiremote sessions |
| 309 | nightwatchjs/nightwatch | https://github.com/nightwatchjs/nightwatch | 12k | E2E testing framework, WebDriver session management, browser driver process, test worker lifecycle, screenshot/video capture, assertion queue, parallel runner cleanup |
| 310 | storybook/storybook | https://github.com/storybookjs/storybook | 84k | Component development environment, dev server lifecycle, HMR WebSocket, builder (webpack/vite) cleanup, addon manager, preview iframe, file watcher, static file serving |
| 311 | chromaui/chromatic-cli | https://github.com/chromaui/chromatic-cli | 1k | Visual testing CLI, build upload streams, API client connections, git metadata extraction, snapshot comparison, tunnel connection for local builds |
| 312 | chaijs/chai | https://github.com/chaijs/chai | 8k | Assertion library with no I/O—baseline control (expected: 0 findings) |
| 313 | sinonjs/sinon | https://github.com/sinonjs/sinon | 10k | Test spy/stub/mock library, sandbox.restore() cleanup, fake timer management, XHR/fetch mocking, event listener tracking, clock tick intervals |
| 314 | ladjs/superagent | https://github.com/ladjs/superagent | 17k | HTTP request library, request/response stream handling, multipart form uploads, timeout management, retry logic, agent connection pooling, abort handling |
| 315 | istanbuljs/nyc | https://github.com/istanbuljs/nyc | 6k | Code coverage tool, subprocess spawning for instrumentation, temp file operations, coverage map I/O, source map processing, reporter output streams |
| 316 | gotwarlost/istanbul | https://github.com/gotwarlost/istanbul | 9k | Code coverage instrumentation, file reading/writing, coverage collector, report generation streams, source map handling, hook registration |
| 317 | bcoe/c8 | https://github.com/bcoe/c8 | 2k | V8 native coverage tool, coverage file I/O, subprocess spawning, report generation, source map resolution, temp directory cleanup |
| 318 | privatenumber/tsx | https://github.com/privatenumber/tsx | 9k | TypeScript execution, watch mode file monitoring, child process spawning, esbuild transform, module cache, signal handling, process cleanup |
| 319 | TypeStrong/ts-node | https://github.com/TypeStrong/ts-node | 13k | TypeScript execution engine, compiler service lifecycle, REPL stdin/stdout streams, module resolution cache, transpile-only mode, ESM loader hooks |
| 320 | TypeStrong/typedoc | https://github.com/TypeStrong/typedoc | 8k | Documentation generator, source file reading, TypeScript compiler API, output file streams, theme rendering, plugin lifecycle, watch mode monitoring |
| 321 | documentationjs/documentation | https://github.com/documentationjs/documentation | 6k | Documentation tool, AST parsing for JSDoc, file reading, output format streams (HTML/Markdown/JSON), theme rendering, git integration |
| 322 | jsdoc/jsdoc | https://github.com/jsdoc/jsdoc | 15k | API documentation generator, source file parsing, template rendering streams, output file I/O, plugin system, configuration file reading |
| 323 | apiaryio/dredd | https://github.com/apiaryio/dredd | 4k | API testing tool, HTTP client connections, hook subprocess spawning, transaction execution, reporter output, API Blueprint/OpenAPI parsing |
| 324 | Surnet/swagger-jsdoc | https://github.com/Surnet/swagger-jsdoc | 2k | OpenAPI spec generator, source file reading, JSDoc parsing, glob pattern matching, YAML/JSON output, definition merging |
| 325 | swagger-api/swagger-ui | https://github.com/swagger-api/swagger-ui | 26k | API documentation UI, fetch client for spec loading, schema validation, Try-it-out request execution, OAuth flow handling, plugin system |
| 326 | redocly/redoc | https://github.com/Redocly/redoc | 23k | OpenAPI documentation renderer, spec file loading, build process file I/O, bundle generation, static site output, theme customization |
| 327 | stoplight/prism | https://github.com/stoplightio/prism | 4k | OpenAPI mock server, HTTP server lifecycle, spec validation, request/response matching, proxy mode connections, dynamic response generation |
| 328 | hoppscotch/hoppscotch | https://github.com/hoppscotch/hoppscotch | 63k | API testing platform, HTTP client connections, WebSocket testing, GraphQL subscriptions, SSE connections, collection sync, environment variables |
| 329 | postmanlabs/newman | https://github.com/postmanlabs/newman | 7k | Postman CLI runner, HTTP request execution, collection iteration, reporter output streams, environment variable management, script execution sandbox |
| 330 | usebruno/bruno | https://github.com/usebruno/bruno | 25k | Offline API client, HTTP/GraphQL request execution, collection file I/O, environment variable management, script runner, response caching, git-friendly storage |
| 331 | tapjs/tap | https://github.com/tapjs/node-tap | 2k | TAP test framework, subprocess spawning for parallel tests, coverage collection, reporter streams, snapshot file operations, timeout management |
| 332 | tape/tape | https://github.com/tape-testing/tape | 6k | Minimal test harness, TAP stream output, assertion tracking, test completion cleanup, createStream() lifecycle, exit handling |
| 333 | nollup/nollup | https://github.com/PepsRyuu/nollup | 1k | Rollup dev server, HMR WebSocket, file watcher, module graph updates, plugin execution, middleware chain, hot reload connections |
| 334 | egoist/tsup | https://github.com/egoist/tsup | 9k | TypeScript bundler, watch mode file monitoring, esbuild subprocess, output file streams, DTS generation, sourcemap writing, onSuccess hook execution |
| 335 | unjs/unbuild | https://github.com/unjs/unbuild | 2k | Universal build tool, build pipeline execution, file I/O operations, rollup/mkdist integration, stub mode file watching, declaration generation |
| 336 | privatenumber/pkgroll | https://github.com/privatenumber/pkgroll | 1k | Package bundler, rollup build execution, file I/O for multiple entry points, DTS bundling, sourcemap generation, output cleanup |
| 337 | ai/size-limit | https://github.com/ai/size-limit | 6k | Bundle size checker, webpack/rollup subprocess spawning, temp file operations, size calculation, CI integration, time limit measurement |
| 338 | siddharthkp/bundlesize | https://github.com/siddharthkp/bundlesize | 4k | Bundle size testing, file size calculation, CI service API connections, compression analysis, GitHub status API, configuration file reading |
| 339 | mozilla/source-map | https://github.com/mozilla/source-map | 4k | Source map library, file reading/parsing, WASM module loading, mapping generation, consumer/generator lifecycle, VLQ encoding/decoding |
| 340 | evanw/node-source-map-support | https://github.com/evanw/node-source-map-support | 3k | Stack trace enhancement, source map file reading, cache management, Error.prepareStackTrace hook, inline sourcemap extraction |
| 341 | depcheck/depcheck | https://github.com/depcheck/depcheck | 4k | Dependency checker, file globbing for source files, AST parsing for imports, package.json reading, parser selection, special handler execution |
| 342 | pahen/madge | https://github.com/pahen/madge | 5k | Module dependency analyzer, file reading for dependency extraction, graph generation, circular dependency detection, image output streams, AST parsing |
| 343 | browserify/detective | https://github.com/browserify/detective | 1k | Dependency detection via AST parsing, require/import extraction, minimal I/O baseline (mainly string parsing) |
| 344 | browserify/resolve | https://github.com/browserify/resolve | 1k | Module resolution algorithm, file system stat operations, package.json reading, symlink resolution, cache management, path traversal |
| 345 | webpack/enhanced-resolve | https://github.com/webpack/enhanced-resolve | 1k | Advanced module resolver, file system operations, resolution cache, plugin system, symlink handling, alias resolution, package exports |
| 346 | ilearnio/module-alias | https://github.com/ilearnio/module-alias | 3k | Module path aliasing, require hook registration, package.json reading, path mapping—minimal I/O baseline |
| 347 | thlorenz/proxyquire | https://github.com/thlorenz/proxyquire | 3k | Module mocking for testing, require override, module cache manipulation, stub injection, callThru handling, dependency isolation |
| 348 | jhnns/rewire | https://github.com/jhnns/rewire | 3k | Module private variable access, require wrapper, getter/setter injection, module reloading, AST transformation—minimal I/O baseline |

---

## Domain 8 — Data Processing / Messaging
**Selection rationale**: Stream processing libraries, message queues, worker pools, reactive programming, and data transformation pipelines—high risk of stream leaks, worker thread accumulation, and subscription cleanup failures.

| # | Repository | URL | Stars | Selection Reason: Resource Leak Patterns |
|---|-----------|-----|-------|-------------------|
| 349 | caolan/highland | https://github.com/caolan/highland | 3k | Functional reactive stream library, stream lifecycle, backpressure handling, consume/each/toArray cleanup, parallel stream processing, error propagation |
| 350 | rvagg/through2 | https://github.com/rvagg/through2 | 2k | Transform stream wrapper, stream creation/destruction, flush callback, error handling, pipe chain cleanup, objectMode streams |
| 351 | mafintosh/pump | https://github.com/mafintosh/pump | 1k | Stream pipe utility with cleanup, error propagation, destroy on error, callback on finish, multi-stream chaining, proper unpipe handling |
| 352 | mafintosh/pumpify | https://github.com/mafintosh/pumpify | 1k | Stream pipeline composition with pump, automatic cleanup on error, transform chain management, destroy propagation, duplex stream wrapper |
| 353 | mcollina/split2 | https://github.com/mcollina/split2 | 1k | Line-delimited stream splitter, transform stream lifecycle, buffer management, custom matcher support, encoding handling, stream cleanup |
| 354 | mafintosh/tar-fs | https://github.com/mafintosh/tar-fs | 1k | TAR filesystem streams, pack/extract stream lifecycle, file handle management, directory traversal, entry filtering, symlink handling |
| 355 | dominictarr/JSONStream | https://github.com/dominictarr/JSONStream | 2k | Streaming JSON parser/stringifier, transform stream lifecycle, path filtering, large JSON handling, parse error recovery, stream backpressure |
| 356 | dominictarr/event-stream | https://github.com/dominictarr/event-stream | 2k | Stream utility library, map/filter/reduce streams, pause/resume handling, split/join operations, duplex stream creation, pipeline cleanup |
| 357 | maxogden/concat-stream | https://github.com/maxogden/concat-stream | 1k | Buffer concatenation stream, writable stream lifecycle, memory accumulation, callback on finish, encoding handling, object mode support |
| 358 | nodejs/readable-stream | https://github.com/nodejs/readable-stream | 1k | Node.js streams polyfill, stream base class implementation, Readable/Writable/Transform/Duplex lifecycle, destroy() cleanup, pipeline utilities |
| 359 | BullMQ/BullMQ | https://github.com/taskforcesh/bullmq | 6k | Redis-based job queue (duplicate of #140), worker/queue lifecycle, event listener cleanup, connection pooling, job processing streams |
| 360 | breejs/bree | https://github.com/breejs/bree | 3k | Job scheduler with worker threads, worker lifecycle management, cron timer intervals, job timeout handling, graceful shutdown, worker message passing |
| 361 | josdejong/workerpool | https://github.com/josdejong/workerpool | 2k | Worker thread pool, pool.terminate() cleanup, task queue management, worker spawn/kill, timeout handling, promise-based task execution |
| 362 | piscinajs/piscina | https://github.com/piscinajs/piscina | 4k | Fast worker thread pool, worker lifecycle, task abortion, transferable objects, idle timeout, queue management, resource limits enforcement |
| 363 | tinylibs/tinypool | https://github.com/tinylibs/tinypool | 1k | Minimal worker thread pool, worker creation/destruction, task execution, thread recycling, error handling, pool cleanup |
| 364 | andywer/threads.js | https://github.com/andywer/threads.js | 3k | Worker thread abstraction, spawn/terminate lifecycle, observable streams from workers, transfer objects, pool management, thread communication |
| 365 | GoogleChromeLabs/comlink | https://github.com/GoogleChromeLabs/comlink | 11k | RPC for Web Workers, proxy object lifecycle, transferable handling, endpoint cleanup, MessageChannel management, worker termination |
| 366 | node-cron/node-cron | https://github.com/node-cron/node-cron | 3k | Cron job scheduler, task.stop() cleanup, interval timer management, timezone handling, scheduled task execution, destroy on exit |
| 367 | kelektiv/node-cron | https://github.com/kelektiv/node-cron | 8k | CronJob class, job.stop() lifecycle, timer interval cleanup, onTick callback execution, timezone support, start/stop state management |
| 368 | bunkat/later | https://github.com/bunkat/later | 2k | Schedule expression parser, timer creation/clearing, recurrence calculation, schedule execution, timeout management, parse/compile caching |
| 369 | SGrondin/bottleneck | https://github.com/SGrondin/bottleneck | 2k | Rate limiter, limiter.disconnect() cleanup, Redis connection for distributed limiting, job queue management, reservoir refill timers, event listener cleanup |
| 370 | sindresorhus/p-queue | https://github.com/sindresorhus/p-queue | 3k | Promise queue with concurrency control, queue.clear() cleanup, pending promise tracking, timeout handling, interval/timeout timers, event emitter lifecycle |
| 371 | sindresorhus/p-limit | https://github.com/sindresorhus/p-limit | 2k | Promise concurrency limiter, active promise tracking, queue management, minimal resource footprint—baseline for async control |
| 372 | caolan/async | https://github.com/caolan/async | 28k | Async utility library, queue/cargo lifecycle, parallel/series execution, retry timers, whilst/until loops, iterator cleanup, callback management |
| 373 | ReactiveX/rxjs | https://github.com/ReactiveX/rxjs | 30k | Reactive programming library, subscription.unsubscribe() cleanup, observable lifecycle, operator chain teardown, scheduler timers, subject cleanup, resource management |
| 374 | cujojs/most | https://github.com/cujojs/most | 3k | Reactive stream library, stream.dispose() cleanup, scheduler task management, event source cleanup, combinator teardown, propagation graph |
| 375 | staltz/xstream | https://github.com/staltz/xstream | 2k | Reactive stream library, listener.unsubscribe() cleanup, stream completion, producer lifecycle, operator chain disposal, memory stream management |
| 376 | baconjs/bacon.js | https://github.com/baconjs/bacon.js | 6k | Functional reactive programming, unsubscribe() cleanup, EventStream/Property lifecycle, combinator disposal, lazy evaluation, bus cleanup |
| 377 | kefirjs/kefir | https://github.com/kefirjs/kefir | 2k | Reactive library, observable subscription cleanup, stream/property lifecycle, pool management, activation/deactivation, emitter disposal |
| 378 | sockjs/sockjs-client | https://github.com/sockjs/sockjs-client | 5k | SockJS client library, connection lifecycle, transport fallback (WebSocket/XHR/iframe), reconnection logic, event listener cleanup, session management |
| 379 | bminer/ws-wrapper | https://github.com/bminer/ws-wrapper | 1k | WebSocket wrapper with auto-reconnect, connection lifecycle, reconnection backoff timers, event listener cleanup, close handling |
| 380 | pladaria/reconnecting-websocket | https://github.com/pladaria/reconnecting-websocket | 1k | Auto-reconnecting WebSocket, connection retry timers, exponential backoff, manual close vs auto-reconnect, event delegation, cleanup on destroy |
| 381 | mscdex/ssh2 | https://github.com/mscdex/ssh2 | 5k | SSH2 protocol implementation, client.end() cleanup, SFTP session lifecycle, channel management, stream forwarding, keepalive timers, authentication flows |
| 382 | microsoft/node-pty | https://github.com/microsoft/node-pty | 2k | Pseudo-terminal for Node, pty.kill() cleanup, process spawning, stdin/stdout streams, resize event handling, native addon lifecycle |
| 383 | chjj/blessed | https://github.com/chjj/blessed | 11k | Terminal UI library, screen.destroy() cleanup, input stream handling, widget lifecycle, event listener accumulation, render loop, key handler cleanup |
| 384 | vadimdemedes/ink | https://github.com/vadimdemedes/ink | 26k | React for CLI (duplicate of #97), app.unmount() cleanup, stdin stream handling, component lifecycle, render loop, useInput hook listeners |
| 385 | klaudiosinani/signale | https://github.com/klaudiosinani/signale | 9k | Logging library, stream output (stdout/stderr), scoped logger instances, interactive mode timers, file transport streams, configuration management |
| 386 | unjs/consola | https://github.com/unjs/consola | 6k | Universal console logger, reporter output streams, transport lifecycle, log level filtering, browser/Node.js compatibility, mock mode |
| 387 | stomp-js/stompjs | https://github.com/stomp-js/stompjs | 1k | STOMP messaging protocol, client.deactivate() cleanup, WebSocket/TCP transport, subscription management, heartbeat timers, receipt handling |
| 388 | zeromq/zeromq.js | https://github.com/zeromq/zeromq.js | 2k | ZeroMQ bindings, socket.close() cleanup, context termination, message queue management, native addon lifecycle, async iterator cleanup |
| 389 | nickdesaulniers/node-nanomsg | https://github.com/nickdesaulniers/node-nanomsg | 1k | Nanomsg bindings, socket.close() cleanup, pipeline/bus/pair patterns, native addon lifecycle, message buffer management |
| 390 | redis/node-redis | https://github.com/redis/node-redis | 1k | Redis client (duplicate of #114), consumer group cleanup, stream acknowledgment, connection lifecycle, pub/sub subscriptions |
| 391 | SOHU-Co/kafka-node | https://github.com/SOHU-Co/kafka-node | 3k | Kafka client, consumer.close() cleanup, producer lifecycle, offset management, broker connection pooling, heartbeat intervals |
| 392 | bbc/sqs-consumer | https://github.com/bbc/sqs-consumer | 2k | AWS SQS consumer, consumer.stop() cleanup, polling loop intervals, message processing, visibility timeout, batch handling, error retry |
| 393 | amqp-node/amqplib | https://github.com/amqp-node/amqplib | 3k | AMQP 0-9-1 client, connection/channel lifecycle, consumer tag management, message acknowledgment, queue/exchange operations, heartbeat timers, connection recovery |
| 394 | googleapis/nodejs-pubsub | https://github.com/googleapis/nodejs-pubsub | 1k | Google Cloud Pub/Sub, subscription.close() cleanup, message acknowledgment, streaming pull, flow control, lease management, gRPC connections |
| 395 | temporalio/sdk-typescript | https://github.com/temporalio/sdk-typescript | 1k | Temporal workflow SDK, worker.shutdown() cleanup, gRPC connection lifecycle, workflow execution, activity heartbeat, timer management |
| 396 | inngest/inngest-js | https://github.com/inngest/inngest-js | 3k | Serverless queue platform SDK, function registration cleanup, HTTP client connections, event sending, step execution, retry handling |
| 397 | quirrel-dev/quirrel | https://github.com/quirrel-dev/quirrel | 2k | Job queueing service, client connection cleanup, job scheduling, cron jobs, Redis backend connections, webhook delivery |
| 398 | graphile/worker | https://github.com/graphile/worker | 2k | PostgreSQL-based job queue, pool.release() cleanup, runner.stop() lifecycle, job polling, LISTEN/NOTIFY, graceful shutdown, cron scheduling |
| 399 | hapijs/catbox | https://github.com/hapijs/catbox | 1k | Multi-strategy caching, client.stop() cleanup, policy lifecycle, segment isolation, TTL expiration timers, backend adapter connections (memory/Redis/Memcached) |
| 400 | isaacs/node-lru-cache | https://github.com/isaacs/node-lru-cache | 5k | LRU cache implementation, cache disposal, TTL expiration timers, max size enforcement, stale data cleanup, fetch/memo operations, updateAgeOnGet tracking |
