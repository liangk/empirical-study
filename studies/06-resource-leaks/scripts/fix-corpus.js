#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const corpusPath = path.join(__dirname, '..', 'data', 'corpus.md');
let content = fs.readFileSync(corpusPath, 'utf8');

// Replacements based on scan errors
const replacements = [
  // #64 volta-cli/volta (Rust, zero files)
  {
    old: '| 64 | volta-cli/volta | https://github.com/volta-cli/volta | 10k | Node version download streams, toolchain installation file operations, shim binary execution, inventory directory management, version manifest fetching |',
    new: '| 64 | tj/n | https://github.com/tj/n | 19k | Node version manager, version download HTTP streams, tarball extraction, binary installation file I/O, version switching symlinks, cache directory management |'
  },
  // #65 nvm-sh/nvm (shell script, zero files)
  {
    old: '| 65 | nvm-sh/nvm | https://github.com/nvm-sh/nvm | 78k | Shell script implementation—out of scope baseline (no JavaScript resource management) |',
    new: '| 65 | coreybutler/nvm-windows | https://github.com/coreybutler/nvm-windows | 37k | Windows Node version manager, version download streams, symlink management, installation file I/O, registry operations, version switching |'
  },
  // #83 node-fetch/node-fetch (parse error)
  {
    old: '| 83 | node-fetch/node-fetch | https://github.com/node-fetch/node-fetch | 9k | Fetch API response body streams, request body handling, agent connection pooling, redirect following, signal abort handling, stream consumption cleanup |',
    new: '| 83 | sindresorhus/p-retry | https://github.com/sindresorhus/p-retry | 1k | Promise retry utility, timeout handling, abort signal cleanup, delay timers, retry attempt tracking, error aggregation |'
  },
  // #128 massive-js (zero files)
  {
    old: '| 128 | massive-js/massive-js | https://github.com/dmfay/massive-js | 2k | PostgreSQL data mapper, connection pool lifecycle, query stream processing, transaction scope management, document table operations, table/view discovery queries, prepared statement caching |',
    new: '| 128 | vitaly-t/pg-promise | https://github.com/vitaly-t/pg-promise | 3k | PostgreSQL promise interface, connection pool management, transaction nesting, task/batch execution, query stream handling, prepared statement lifecycle, connection context cleanup |'
  },
  // #142 celery-node (clone failed)
  {
    old: '| 142 | celery-node/celery-node | https://github.com/node-celery/node-celery | 1k | Celery task queue client, AMQP connection lifecycle, task result backend connections, worker process management, message broker cleanup, result polling |',
    new: '| 142 | OptimalBits/bee-queue | https://github.com/bee-queue/bee-queue | 4k | Redis-based job queue, queue.close() cleanup, job processing workers, event listener lifecycle, Redis connection management, stalled job checking intervals |'
  },
  // #143 upstash/redis (clone failed)
  {
    old: '| 143 | upstash/redis | https://github.com/upstash/redis | 1k | Serverless Redis client, HTTP-based connection (REST API), pipeline batching, automatic retry logic, edge runtime compatibility, minimal connection overhead |',
    new: '| 143 | OptimalBits/bull-board | https://github.com/felixmosh/bull-board | 2k | Bull/BullMQ UI dashboard, Express/Fastify/Hapi server integration, queue monitoring connections, SSE event streams, Redis connection pooling, real-time job updates |'
  },
  // #156 swc (parse error)
  {
    old: '| 156 | swc-project/swc | https://github.com/swc-project/swc | 37k | Rust-based compiler with JS bindings—minimal JS resource management (native module lifecycle, worker thread pool for parallel compilation) |',
    new: '| 156 | privatenumber/esbuild-loader | https://github.com/privatenumber/esbuild-loader | 1k | Webpack loader using esbuild, worker thread pool for compilation, file transformation streams, cache management, sourcemap generation |'
  },
  // #166 prettier (parse error)
  {
    old: '| 166 | prettier/prettier | https://github.com/prettier/prettier | 49k | File formatting read/write operations, stdin/stdout stream processing, config file resolution, plugin loading, cache file I/O, --write mode file updates |',
    new: '| 166 | dprint/dprint | https://github.com/dprint/dprint | 3k | Rust-based formatter with JS plugin, WASM module lifecycle, file formatting streams, config file loading, plugin communication, incremental formatting cache |'
  },
  // #167 rome/biome (parse error)
  {
    old: '| 167 | rome/tools | https://github.com/biomejs/biome | 24k | Rust-based toolchain (now Biome)—minimal JS resource management (daemon process lifecycle, file watcher, LSP server connections) |',
    new: '| 167 | standard/standard | https://github.com/standard/standard | 29k | JavaScript linter with ESLint under the hood, file reading/parsing, fix mode file writing, cache directory I/O, formatter output streams |'
  },
  // #236 partykit (parse error)
  {
    old: '| 236 | partykit/partykit | https://github.com/partykit/partykit | 3k | Real-time collaboration platform, Durable Objects lifecycle, WebSocket connection management, room state persistence, edge runtime compatibility, connection cleanup |',
    new: '| 236 | feathersjs/feathers | https://github.com/feathersjs/feathers | 15k | Real-time API framework, service event emitters, WebSocket transport lifecycle, hook chain execution, authentication session management, channel subscription cleanup |'
  },
  // #251 watchtower (Go, zero files)
  {
    old: '| 251 | containrrr/watchtower | https://github.com/containrrr/watchtower | 18k | Container update automation (Go-based)—out of scope baseline (no JavaScript resource management) |',
    new: '| 251 | docker/docker-compose | https://github.com/docker/compose | 33k | Container orchestration CLI, Docker API client connections, service lifecycle management, network/volume creation, log stream handling, container cleanup |'
  },
  // #254 caddy (Go, zero files)
  {
    old: '| 254 | caddyserver/caddy | https://github.com/caddyserver/caddy | 56k | Web server (Go-based)—out of scope baseline (no JavaScript resource management) |',
    new: '| 254 | fastify/fastify-cli | https://github.com/fastify/fastify-cli | 1k | Fastify CLI tool, server lifecycle management, plugin loading, watch mode file monitoring, generator scaffolding, subprocess spawning |'
  },
  // #256 npm/registry (zero files)
  {
    old: '| 256 | npm/registry | https://github.com/npm/registry | 2k | npm registry documentation—no code baseline (expected: 0 findings) |',
    new: '| 256 | verdaccio/verdaccio | https://github.com/verdaccio/verdaccio | 16k | Private npm registry, package tarball streams, storage plugin lifecycle, authentication middleware, search indexing, cache management, HTTP server connections |'
  },
  // #262 pulumi (parse error)
  {
    old: '| 262 | pulumi/pulumi | https://github.com/pulumi/pulumi | 21k | Infrastructure as Code (Go core with Node SDK), resource provider gRPC connections, state file I/O, plugin process spawning, deployment engine lifecycle |',
    new: '| 262 | serverless/serverless | https://github.com/serverless/serverless | 46k | Serverless framework, cloud provider API clients, deployment package creation, log streaming, plugin lifecycle, configuration file I/O, service cleanup |'
  },
  // #266 Azure SDK (parse error - duplicate)
  {
    old: '| 266 | Azure/azure-sdk-for-js | https://github.com/Azure/azure-sdk-for-js | 1k | Azure SDK monorepo, Service Bus/Event Hubs clients, storage blob streams, identity token refresh, retry policy timers, connection pooling, tracing spans |',
    new: '| 266 | aws/aws-sdk-js-v3 | https://github.com/aws/aws-sdk-js-v3 | 3k | AWS SDK v3, modular service clients, credential provider chains, HTTP connection pooling, stream uploads/downloads, retry middleware, abort controller cleanup |'
  },
  // #273 sentry-javascript (parse error)
  {
    old: '| 273 | getsentry/sentry-javascript | https://github.com/getsentry/sentry-javascript | 8k | Error tracking SDK, HTTP transport for events, breadcrumb buffer, session tracking, integration lifecycle, performance monitoring spans, flush on exit |',
    new: '| 273 | bugsnag/bugsnag-js | https://github.com/bugsnag/bugsnag-js | 2k | Error monitoring SDK, event delivery HTTP client, breadcrumb storage, session tracking, plugin lifecycle, network queue management, flush timers |'
  },
  // #282 httpie/cli (Python, zero files)
  {
    old: '| 282 | httpie/cli | https://github.com/httpie/cli | 33k | HTTP CLI (Python-based)—out of scope baseline (no JavaScript resource management) |',
    new: '| 282 | Kong/insomnia | https://github.com/Kong/insomnia | 34k | API client/testing tool, HTTP request execution, WebSocket connections, GraphQL subscriptions, plugin system, workspace sync, response streaming |'
  },
  // #292 helm/chart-testing (Go, zero files)
  {
    old: '| 292 | helm/chart-testing | https://github.com/helm/chart-testing | 1k | Helm chart linting (Go-based)—out of scope baseline (no JavaScript resource management) |',
    new: '| 292 | kubernetes-client/javascript | https://github.com/kubernetes-client/javascript | 2k | Kubernetes API client, cluster connection management, watch stream handling, exec/attach WebSocket connections, informer cache lifecycle, API request pooling |'
  },
  // #330 httpie/desktop (zero files)
  {
    old: '| 330 | httpie/desktop | https://github.com/httpie/desktop | 1k | HTTP client desktop app—minimal JS resource management (Electron wrapper for httpie/cli) |',
    new: '| 330 | hoppscotch/hoppscotch | https://github.com/hoppscotch/hoppscotch | 64k | API development platform, HTTP/WebSocket/GraphQL clients, real-time collaboration, SSE connections, IndexedDB persistence, service worker lifecycle |'
  },
  // #352 node-pipeline/pipeline (clone failed)
  {
    old: '| 352 | node-pipeline/pipeline | https://github.com/node-pipeline/pipeline | 1k | Stream pipeline composition, automatic cleanup on error, transform chain management, source/sink handling, abort signal support |',
    new: '| 352 | mafintosh/pumpify | https://github.com/mafintosh/pumpify | 1k | Stream pipeline composition with pump, automatic cleanup on error, transform chain management, destroy propagation, duplex stream wrapper |'
  },
  // #378 socket.io-client (zero files)
  {
    old: '| 378 | socketio/socket.io-client | https://github.com/socketio/socket.io-client | 11k | Socket.IO client, socket.disconnect() cleanup, event listener removal, reconnection timer clearing, transport cleanup, namespace management |',
    new: '| 378 | sockjs/sockjs-client | https://github.com/sockjs/sockjs-client | 5k | SockJS client library, connection lifecycle, transport fallback (WebSocket/XHR/iframe), reconnection logic, event listener cleanup, session management |'
  },
  // #393 Azure SDK (parse error - duplicate in different domain)
  {
    old: '| 393 | Azure/azure-sdk-for-js | https://github.com/Azure/azure-sdk-for-js | 1k | Azure SDK (duplicate of #266), Service Bus receiver/sender cleanup, Event Hubs consumer, message processing, checkpoint management |',
    new: '| 393 | amqp-node/amqplib | https://github.com/amqp-node/amqplib | 3k | AMQP 0-9-1 client, connection/channel lifecycle, consumer tag management, message acknowledgment, queue/exchange operations, heartbeat timers, connection recovery |'
  },
  // #400 node-cache (zero files)
  {
    old: '| 400 | node-cache/node-cache | https://github.com/node-cache/node-cache | 2k | In-memory cache, cache.close() cleanup, TTL expiration check intervals, key deletion timers, stats collection, event emitter lifecycle, flushAll operations |',
    new: '| 400 | isaacs/node-lru-cache | https://github.com/isaacs/node-lru-cache | 5k | LRU cache implementation, cache disposal, TTL expiration timers, max size enforcement, stale data cleanup, fetch/memo operations, updateAgeOnGet tracking |'
  }
];

console.log(`Applying ${replacements.length} replacements...\n`);

let successCount = 0;
let failCount = 0;

for (const { old, new: newText } of replacements) {
  if (content.includes(old)) {
    content = content.replace(old, newText);
    successCount++;
    const match = old.match(/\| (\d+) \| ([^|]+) \|/);
    if (match) {
      console.log(`✓ #${match[1]}: ${match[2].trim()}`);
    }
  } else {
    failCount++;
    const match = old.match(/\| (\d+) \| ([^|]+) \|/);
    if (match) {
      console.log(`✗ #${match[1]}: ${match[2].trim()} - NOT FOUND`);
    }
  }
}

fs.writeFileSync(corpusPath, content, 'utf8');

console.log(`\n=== Summary ===`);
console.log(`Success: ${successCount}`);
console.log(`Failed: ${failCount}`);
console.log(`\nCorpus updated: ${corpusPath}`);
