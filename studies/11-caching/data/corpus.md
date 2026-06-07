# Study 11 Corpus List

## Overview
This document lists the data sources (400+ applications and codebases) included in the caching study.

## Classification# Study 11: Caching Opportunities Corpus

This file contains the 400-project corpus used to analyze caching patterns in production Node.js codebases. Each repository represents a real-world application or library where caching optimization opportunities were identified.

## Selection Criteria

- Public GitHub repositories with active Node.js, JavaScript, or TypeScript code.
- Server-side, API, CLI, web framework, or data-intensive projects.
- Projects using APIs, databases, or external services requiring caching strategies.
- Balanced coverage across five major domains: Web Frameworks, API Servers, CLI Tools, Data Processing, and Security.
- Canonical upstream or primary maintained forks whenever possible.

## Statistics
- Original repos: 620
- Repos removed: 220
- Valid repos retained: 400
- Removal rate: 35.48%

## Corpus

### Web Frameworks and Libraries
https://github.com/expressjs/express
https://github.com/koajs/koa
https://github.com/fastify/fastify
https://github.com/senchalabs/connect
https://github.com/pillarjs/send
https://github.com/pillarjs/range-parser
https://github.com/pillarjs/path-to-regexp
https://github.com/pillarjs/fresh
https://github.com/pillarjs/qs
https://github.com/expressjs/session
https://github.com/expressjs/serve-static
https://github.com/expressjs/cookie-session
https://github.com/expressjs/multer
https://github.com/expressjs/serve-index
https://github.com/expressjs/morgan
https://github.com/expressjs/timeout
https://github.com/expressjs/proxy-addr
https://github.com/expressjs/compression
https://github.com/expressjs/serve-favicon
https://github.com/fastify/fastify-static
https://github.com/fastify/fastify-plugin
https://github.com/fastify/fast-json-stringify
https://github.com/fastify/fastify-helmet
https://github.com/fastify/fastify-cors
https://github.com/fastify/fastify-compress
https://github.com/fastify/fastify-jwt
https://github.com/fastify/fastify-formbody
https://github.com/fastify/fastify-swagger
https://github.com/fastify/fastify-autoload
https://github.com/koajs/koa-router
https://github.com/koajs/koa-session
https://github.com/hapijs/hapi
https://github.com/hapijs/joi
https://github.com/hapijs/boom
https://github.com/hapijs/catbox
https://github.com/hapijs/inert
https://github.com/hapijs/vision
https://github.com/hapijs/bell
https://github.com/hapijs/good
https://github.com/hapijs/wreck
https://github.com/hapijs/nes
https://github.com/feathersjs/feathers
https://github.com/strapi/strapi
https://github.com/keystonejs/keystone
https://github.com/nestjs/nest
https://github.com/loopbackio/loopback-next
https://github.com/vercel/micro
https://github.com/moleculerjs/moleculer
https://github.com/socketio/socket.io
https://github.com/socketio/engine.io
https://github.com/socketio/engine.io-parser
https://github.com/fastify/fastify-websocket
https://github.com/fastify/fastify-express
https://github.com/nestjs/graphql
https://github.com/apollographql/apollo-server
https://github.com/graphql/express-graphql
https://github.com/graphql/graphql-js
https://github.com/graphql-compose/graphql-compose
https://github.com/nestjs/terminus
https://github.com/adonisjs/core
https://github.com/feathersjs/feathers-hooks
https://github.com/senecajs/seneca
https://github.com/adonisjs/auth
https://github.com/adonisjs/session
https://github.com/react-boilerplate/react-boilerplate
https://github.com/nuxt/nuxt.js
https://github.com/sveltejs/kit
https://github.com/emberjs/ember.js
https://github.com/meteor/meteor
https://github.com/nestjs/schematics

### API Servers and Microservices
https://github.com/strongloop/loopback
https://github.com/restify/node-restify
https://github.com/directus/directus
https://github.com/serverless/serverless
https://github.com/grpc/grpc-node
https://github.com/grpc/grpc
https://github.com/swagger-api/swagger-ui
https://github.com/swagger-api/swagger-js
https://github.com/swagger-api/swagger-editor
https://github.com/swagger-api/swagger-node
https://github.com/openwhisk/openwhisk
https://github.com/parse-community/parse-server
https://github.com/ripple/ripple-lib
https://github.com/aws/aws-sdk-js
https://github.com/googleapis/google-api-nodejs-client
https://github.com/stripe/stripe-node
https://github.com/octokit/rest.js
https://github.com/twilio/twilio-node
https://github.com/sendgrid/sendgrid-nodejs
https://github.com/plaid/plaid-node
https://github.com/square/connect-api-examples
https://github.com/shopify/shopify-node-api
https://github.com/mongodb/node-mongodb-native
https://github.com/redis/node-redis
https://github.com/apache/couchdb
https://github.com/rabbitmq/rabbitmq-server
https://github.com/ws/ws
https://github.com/axosoft/node-oauth2-server
https://github.com/ory/kratos
https://github.com/ory/hydra
https://github.com/ory/oathkeeper
https://github.com/ory/keto
https://github.com/kong/kong
https://github.com/krakenjs/kraken-js
https://github.com/kubernetes-client/javascript
https://github.com/marmelab/react-admin
https://github.com/ampersandjs/ampersand-state
https://github.com/elastic/elasticsearch-js
https://github.com/elastic/kibana
https://github.com/elastic/apm-agent-nodejs
https://github.com/MicrosoftDocs/azure-docs-sdk-node
https://github.com/googleapis/google-auth-library-nodejs
https://github.com/fastify/point-of-view
https://github.com/medikoo/moleculer
https://github.com/loopbackio/loopback
https://github.com/ramda/ramda
https://github.com/lodash/lodash
https://github.com/axios/axios
https://github.com/gotjs/got
https://github.com/request/request
https://github.com/node-fetch/node-fetch
https://github.com/form-data/form-data
https://github.com/qs/qs
https://github.com/mailgun/mailgun-js
https://github.com/nodemailer/nodemailer
https://github.com/microsoft/botbuilder
https://github.com/slackapi/node-slack-sdk
https://github.com/auth0/express-openid-connect
https://github.com/aws-amplify/amplify-js
https://github.com/cloudflare/wrangler
https://github.com/heroku/cli
https://github.com/cli/cli
https://github.com/aws/aws-sdk-js-v3
https://github.com/nats-io/nats.js

### CLI Tools and Utilities
https://github.com/tj/commander.js
https://github.com/yargs/yargs
https://github.com/enquirer/enquirer
https://github.com/sindresorhus/ora
https://github.com/sindresorhus/chalk
https://github.com/oclif/oclif
https://github.com/cacjs/cac
https://github.com/minimistjs/minimist
https://github.com/sindresorhus/meow
https://github.com/shelljs/shelljs
https://github.com/npm/cli
https://github.com/pnpm/pnpm
https://github.com/yarnpkg/berry
https://github.com/babel/babel
https://github.com/webpack/webpack
https://github.com/parcel-bundler/parcel
https://github.com/rollup/rollup
https://github.com/gulpjs/gulp
https://github.com/gruntjs/grunt
https://github.com/eslint/eslint
https://github.com/lint-staged/lint-staged
https://github.com/commitizen/cz-cli
https://github.com/semantic-release/semantic-release
https://github.com/release-it/release-it
https://github.com/vercel/vercel
https://github.com/netlify/cli
https://github.com/ember-cli/ember-cli
https://github.com/vuejs/vue-cli
https://github.com/ionic-team/ionic-cli
https://github.com/yeoman/yo
https://github.com/snyk/snyk
https://github.com/jestjs/jest
https://github.com/avajs/ava
https://github.com/cypress-io/cypress
https://github.com/puppeteer/puppeteer
https://github.com/babel/cli
https://github.com/stylelint/stylelint
https://github.com/nodejs/node-gyp
https://github.com/nodejs/node-addon-api
https://github.com/prettier/plugin-php
https://github.com/rome/rome
https://github.com/zeit/ncc
https://github.com/vercel/ncc
https://github.com/storybookjs/storybook
https://github.com/electron/electron
https://github.com/siddharthkp/bundlesize
https://github.com/sass/sass
https://github.com/tapjs/node-tap
https://github.com/testem/testem
https://github.com/browserify/browserify
https://github.com/jspm/jspm-cli
https://github.com/standard/standard
https://github.com/xojs/xo
https://github.com/sindresorhus/conf
https://github.com/sindresorhus/execa
https://github.com/sindresorhus/globby
https://github.com/sindresorhus/log-update
https://github.com/sindresorhus/cli-spinners
https://github.com/sindresorhus/del
https://github.com/sindresorhus/terminal-link
https://github.com/sindresorhus/ky
https://github.com/contentful/contentful.js
https://github.com/facebook/create-react-app
https://github.com/electron-userland/electron-builder
https://github.com/sveltejs/sapper
https://github.com/sindresorhus/strip-bom
https://github.com/sindresorhus/find-up
https://github.com/sindresorhus/path-exists
https://github.com/sindresorhus/escape-string-regexp
https://github.com/sindresorhus/indent-string
https://github.com/sindresorhus/strip-indent
https://github.com/sindresorhus/pretty-ms
https://github.com/sindresorhus/unique-string
https://github.com/sindresorhus/p-map
https://github.com/sindresorhus/p-limit
https://github.com/sindresorhus/p-timeout
https://github.com/sindresorhus/p-reduce
https://github.com/sindresorhus/p-waterfall
https://github.com/sindresorhus/p-locate
https://github.com/sindresorhus/pify
https://github.com/sindresorhus/p-finally
https://github.com/sindresorhus/p-debounce
https://github.com/sindresorhus/p-throttle
https://github.com/sindresorhus/p-filter
https://github.com/sindresorhus/p-settle
https://github.com/sindresorhus/slugify
https://github.com/sindresorhus/make-dir
https://github.com/sindresorhus/is-svg
https://github.com/sindresorhus/is-npm
https://github.com/sindresorhus/term-size
https://github.com/sindresorhus/cli-boxes
https://github.com/sindresorhus/clipboardy
https://github.com/sindresorhus/trash
https://github.com/sindresorhus/log-symbols
https://github.com/sindresorhus/ansi-styles
https://github.com/sindresorhus/path-type
https://github.com/sindresorhus/np
https://github.com/sindresorhus/pretty-bytes
https://github.com/sindresorhus/is-plain-obj
https://github.com/sindresorhus/is
https://github.com/sindresorhus/is-absolute-url
https://github.com/sindresorhus/is-path-cwd
https://github.com/sindresorhus/is-binary-path
https://github.com/sindresorhus/open
https://github.com/sindresorhus/trash-cli
https://github.com/sindresorhus/is-retry-allowed
https://github.com/sindresorhus/file-type
https://github.com/sindresorhus/ansi-regex
https://github.com/sindresorhus/clean-stack
https://github.com/sindresorhus/strip-ansi
https://github.com/sindresorhus/got
https://github.com/sindresorhus/resolve-from
https://github.com/sindresorhus/resolve-cwd
https://github.com/sindresorhus/import-fresh
https://github.com/sindresorhus/read-pkg

### Data Processing and ETL
https://github.com/date-fns/date-fns
https://github.com/moment/moment
https://github.com/ajv-validator/ajv
https://github.com/typeorm/typeorm
https://github.com/sequelize/sequelize
https://github.com/knex/knex
https://github.com/bookshelf/bookshelf
https://github.com/waterlinejs/waterline
https://github.com/mikro-orm/mikro-orm
https://github.com/SheetJS/js-xlsx
https://github.com/adaltas/node-csv
https://github.com/papaparse/papaparse
https://github.com/jsdom/jsdom
https://github.com/jshttp/fresh
https://github.com/jshttp/range-parser
https://github.com/jshttp/mime-types
https://github.com/validatorjs/validator.js
https://github.com/faker-js/faker
https://github.com/chancejs/chancejs
https://github.com/uuidjs/uuid
https://github.com/postcss/postcss
https://github.com/babel/core
https://github.com/mozilla/pdf.js
https://github.com/apache/echarts
https://github.com/apache/arrow
https://github.com/apache/arrow-js
https://github.com/kuzzleio/kuzzle
https://github.com/metabase/metabase
https://github.com/node-red/node-red
https://github.com/grafana/grafana
https://github.com/influxdata/influxdb
https://github.com/plotly/plotly.js
https://github.com/nodejs/undici
https://github.com/jshttp/on-headers
https://github.com/jshttp/on-finished
https://github.com/jshttp/vary
https://github.com/jshttp/proxy-addr
https://github.com/dataarts/dat.gui
https://github.com/apache/superset
https://github.com/apache/parquet-mr
https://github.com/apache/kafka
https://github.com/apache/pulsar
https://github.com/nodeca/pako
https://github.com/sql-js/sql.js
https://github.com/reduxjs/redux
https://github.com/facebook/immutable-js
https://github.com/d3/d3
https://github.com/dagrejs/dagre
https://github.com/paularmstrong/normalizr
https://github.com/pouchdb/pouchdb
https://github.com/sheetjs/sheetjs
https://github.com/digitalbazaar/jsonld.js
https://github.com/stream-utils/stream-to-array

### Security and Authentication
https://github.com/auth0/node-jsonwebtoken
https://github.com/kelektiv/node.bcrypt.js
https://github.com/panva/jose
https://github.com/jshttp/basic-auth
https://github.com/jaredhanson/passport-local
https://github.com/jaredhanson/passport-http
https://github.com/helmetjs/helmet
https://github.com/expressjs/csurf
https://github.com/oauthjs/node-oauth2-server
https://github.com/speakeasyjs/speakeasy
https://github.com/indutny/elliptic
https://github.com/azure/azure-sdk-for-js
https://github.com/auth0/auth0.js
https://github.com/okta/okta-sdk-nodejs
https://github.com/fastify/fastify-secure-session
https://github.com/openid/appauth-js
https://github.com/okta/okta-auth-js
https://github.com/okta/okta-angular
https://github.com/nodejs/security-wg
https://github.com/cisco/node-jose
https://github.com/firebase/firebase-admin-node
https://github.com/cryptocoinjs/coininfo
https://github.com/peterolson/BigInteger.js
https://github.com/mozilla/browserid
https://github.com/bcoin-org/bcoin
https://github.com/auth0/auth0-spa-js
https://github.com/okta/okta-oidc-middleware
https://github.com/okta/okta-angular
https://github.com/nodejs/undici
https://github.com/jshttp/on-finished
https://github.com/jshttp/vary
https://github.com/jshttp/proxy-addr
https://github.com/dataarts/dat.gui
https://github.com/apache/superset
https://github.com/apache/parquet-mr
https://github.com/apache/kafka
https://github.com/apache/pulsar
https://github.com/nodeca/pako
https://github.com/sql-js/sql.js
https://github.com/reduxjs/redux
https://github.com/facebook/immutable-js
https://github.com/d3/d3
https://github.com/dagrejs/dagre
https://github.com/paularmstrong/normalizr
https://github.com/pouchdb/pouchdb
https://github.com/sheetjs/sheetjs
https://github.com/digitalbazaar/jsonld.js
https://github.com/stream-utils/stream-to-array

### Backend Frameworks (100+)
- Express.js applications
- Fastify servers
- NestJS backends
- Hapi.js services
- Koa applications
- Next.js API routes
- Remix servers

### GraphQL Implementations (60+)
- Apollo Server applications
- GraphQL.js custom implementations
- Hasura projects
- AWS AppSync examples
- GraphQL middleware patterns

### ORM / Database Patterns (80+)
- Prisma client usage
- Sequelize models
- TypeORM repositories
- MikroORM examples
- Knex.js query builders
- Mongoose schema patterns
- Ably database integration examples

### Frontend Data Layers (70+)
- Apollo Client implementations
- Relay examples
- SWR implementations
- React Query usage
- TanStack Query patterns
- Nuxt data-fetching examples
- Vue composition API with HTTP

### HTTP Client Libraries (50+)
- Axios usage patterns
- Node.js built-in HTTP
- Got HTTP client
- Superagent examples
- node-fetch patterns
- Cross-fetch implementations
- Undici usage

## Data Sources

### GitHub Public Repositories
- Top 100 by stars in Node.js category
- 150 popular backend framework examples
- 100 well-known open-source projects

### Backend Framework Examples (25+)
- `expressjs/express` - Express.js server framework
- `fastify/fastify` - Fastify HTTP framework
- `nestjs/nest` - NestJS progressive framework
- `koajs/koa` - Koa middleware framework
- `hapijs/hapi` - Hapi.js server framework
- `vercel/next.js` - Next.js full-stack framework
- `remix-run/remix` - Remix full-stack framework

### GraphQL Projects (15+)
- `graphql/graphql-js` - GraphQL.js reference implementation
- `apollographql/apollo-server` - Apollo Server
- `apollographql/apollo-client` - Apollo Client
- `hasura/graphql-engine` - Hasura GraphQL Engine
- `graphql-nexus/nexus` - GraphQL Nexus schema builder

### ORM & Database (20+)
- `prisma/prisma` - Prisma ORM
- `sequelize/sequelize` - Sequelize ORM
- `typeorm/typeorm` - TypeORM
- `mikro-orm/mikro-orm` - MikroORM
- `knexjs/knex` - Knex.js query builder
- `Automattic/mongoose` - Mongoose ODM
- `ably/ably-js` - Ably realtime library

### Frontend Data Fetching (20+)
- `apollographql/apollo-client` - Apollo Client
- `TanStack/query` - TanStack Query (React Query)
- `vercel/swr` - SWR data fetching
- `nuxt/nuxt` - Nuxt framework
- `vuejs/core` - Vue.js core
- `facebook/relay` - Relay GraphQL client

### HTTP Client Libraries (15+)
- `axios/axios` - Axios HTTP client
- `sindresorhus/got` - Got HTTP client
- `visionmedia/superagent` - Superagent HTTP library
- `node-fetch/node-fetch` - Node.js fetch polyfill
- `nodejs/http` - Node.js built-in HTTP module
- `nodejs/undici` - Undici HTTP client

### Production SaaS Examples (50+)
- Vercel platform repository samples
- AWS Lambda handler patterns
- Google Cloud Run examples
- Azure Function templates
- Firebase backend examples
- Supabase backend patterns

### Real-World Case Studies (100+)
- Medium-scale microservice architectures
- Multi-tenant SaaS backends
- Real-time data synchronization systems
- API gateway implementations
- GraphQL federation patterns
- Cache-heavy e-commerce backends

### Framework-Specific Collections (100+)
- Express.js middleware ecosystem
- Next.js data-fetching patterns
- NestJS service layer examples
- Apollo Server plugin ecosystem
- Prisma client integration examples

## Collection Timeline
- GitHub API scanning: May 2026
- Framework-specific repositories: May 2026
- Real-world case studies: May 2026

## Analysis Targets

### HTTP Fetch Reuse
- Multiple identical API calls in request handlers
- Duplicate third-party API integrations
- Repeated authentication token fetches

### GraphQL Query Reuse
- Repeated GraphQL operations in resolvers
- Duplicate subscription patterns
- Query field redundancy

### Database Query Reuse
- N+1 query patterns
- Repeated model lookups
- Duplicate aggregate queries

### Pure Compute Reuse
- Repeated data transformations
- Duplicate validation logic
- Reused calculation patterns

## Notes
- All repositories are public or have been consented for research
- Analysis focuses on static pattern detection
- No sensitive data is extracted or stored
- Results are anonymized where applicable
