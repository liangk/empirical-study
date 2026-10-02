# Labelling criteria — Large Payloads

Written before any core-engine finding was read. A label is decided from the
code at the pinned commit, not from what the rule says about it.

## What the rules claim

- `payload/unbounded-query` — a database query returning a collection, with no
  row limit.
- `payload/large-return` — the same, returned straight out of a function.

Missing field selection alone is **not** a finding (decided 2026-09-23). A
query with a row limit and no `select` is out of scope: what blows up a
response is the number of rows, not the number of columns. Study 09's
`deep_nested_include` and `select_star` are also out of scope for this story.

## Labels

Every finding gets exactly one.

| Label | Meaning |
|---|---|
| `tp` | A real database query, in code that serves users, whose row count grows with data and has nothing bounding it. |
| `fp-not-a-query` | Not a database call: `Array.prototype.find`, lodash, a Map, a UI test helper, an HTTP client, an in-memory store. |
| `fp-bounded-by-key` | A database query, but the rows are bounded by the filter: a unique key, a primary-key list whose size the caller controls, or a parent whose children are few by construction (a user's roles, a form's fields, an enum-like table). |
| `fp-bounded-elsewhere` | A limit exists but the rule cannot see it: a chained `.limit()`, a `paginate()` wrapper, a limit passed in through a variable the rule does not follow. |
| `fp-not-served` | A real, unbounded query in code that never serves a request: migrations, seeds, one-off scripts, CLI tools, fixtures, dev tooling. |
| `unsure` | Cannot be decided from the repository alone. Reported separately; never counted as `tp`. |

### Where the line falls

- **Grows with data** means the table, or the slice the filter selects, gets
  longer as the product is used: messages, events, logs, orders, sessions,
  analyses, notifications. A tenant- or user-scoped query on such a table is
  still `tp` — "all of one user's sessions" is unbounded if nothing prunes
  sessions.
- **Few by construction** needs a reason in the code or the schema, not a
  guess about usage. "Solutions per issue are usually few" is `unsure` unless
  something caps them.
- **Background jobs and admin endpoints** count as served. A nightly job that
  loads a whole table is exactly the failure this rule exists for.
- **An application's own wrapper** — `this.catsService.findAll()`,
  `repo.findAllForUser(id)` calling a method the application defines — is
  `fp-not-a-query`. The query inside it is a finding in its own file, labelled
  there; counting the call site too would count one query twice. (Added
  2026-09-23 after the structural-class check, before any of the 300 were read.)
  **Refined 2026-09-24, after S247–S259 and S306:** the premise above does not
  always hold. A generic data-access method that passes the caller's filter
  straight to the database (novu's `BaseRepository.find(query, select,
  options)`, Lightdash's `SpaceModel.find(filters)` over knex) runs whatever
  query the caller wrote, and that query is reported nowhere else. So a call to
  an application-defined method is labelled as the query it runs at runtime,
  unless that same query is already a finding on another line — then the call
  site is `fp-not-a-query` (duplicate). Every label given under the first
  wording was revisited: S154, S247–S259 and S260 changed; S076–S100's Nest
  samples, S270 and S300–S301 did not.
- **Library code** (an ORM, an SDK, a query builder's own source) is labelled
  on its own terms: a `findAll` inside Sequelize's implementation is not an
  application query, so it is `fp-not-a-query`.

## Study 09 findings

The Study 09 detector's findings are labelled with the same table, restricted
to the first two labels plus `unsure`: the question there is only whether the
detector found a database query at all. In `eval/study09-labels.json` the
first label is written `db-query` rather than `tp`, because a real query is
only an upper bound on a real finding — whether it is unbounded is not judged
for Study 09's findings. The plan was to decide most of them mechanically from the source line, with
the rules in `eval/score.js`, checked against a hand-labelled sample. That was
not needed: the estimate rests on the 400-finding sample alone, and all 400
were labelled by hand from their source lines. No mechanical rule was applied
and `eval/score.js` does not exist. (Corrected 2026-09-24.)

## Sampling

- core-engine findings: all of them, if there are fewer than 400; otherwise a
  stratified random sample of 400 by repository, seeded, with the seed in
  `eval/sample.json`.
- Study 09 findings: 400, stratified by pattern, seeded the same way.

Precision is `tp / (all labels − unsure)`, reported with the `unsure` count
beside it.

## Amendment — 2026-09-23, before any finding was labelled

A path breakdown of the 3,441 round-1 findings (no finding read) showed 2,085
of them in four structural classes: test directories the engine's walker does
not skip (`test/`, `tests/`, `fixtures/`, cypress), minified bundles (a source
line over 1,000 characters), migrations and seeds, and sample/example
directories. The 400-finding sample is therefore stratified by class first:

- 25 from each structural class (100), to check the path rule behind it;
- 300 from the remaining findings, stratified by repository (proportional,
  at least one per repository), seeded.

A structural class is only used in the results if its 25-finding check agrees
with the path rule on every finding. Otherwise its findings are labelled like
the rest.

---

# Stage 2

## `payload/api-response` — written 2026-09-24, before any finding was read

### What the rule claims

A request handler sends the result of a database query to the client, and
nothing bounds the number of rows: the query has no limit, is not a
single-row lookup, is not bounded by the caller's keys, and the handler does
not paginate. Study 09's `missing_pagination` is this rule: a list endpoint
with no pagination contract is a handler whose response carries such a result.

"Sends to the client" means the value reaches `res.json()`, `res.send()`,
`reply.send()`, `c.json()`, `ctx.body =`, a `Response.json()` / `NextResponse.json()`,
or is returned from a function the framework calls as a handler (a Nest
controller method, a Next.js route handler, a tRPC procedure).

### One finding per query

A query that reaches a response is reported as `payload/api-response` and not
also as `payload/unbounded-query` or `payload/large-return`. It is the more
specific claim: the rows are serialised and sent over the network.

### Labels

The Stage 1 labels, with one addition:

| Label | Meaning |
|---|---|
| `tp` | The rows reach the response, and the query meets Stage 1's `tp` definition. |
| `fp-not-a-response` | The query is real and unbounded, but its result does not reach the response — it is counted, filtered to a bounded subset, or used only to decide something. |
| Stage 1 labels | `fp-not-a-query`, `fp-bounded-by-key`, `fp-bounded-elsewhere`, `fp-not-served`, `unsure`, decided exactly as in Stage 1. |

A result that is `.map()`-ed or `.filter()`-ed and then sent still reaches the
response: mapping keeps the row count, and a filter in memory is applied after
every row was loaded.

### Why this is not a port

The backend's `large_api_payload` is the model, but its data-flow check never
fires on the ordinary shapes. Tested 2026-09-24 against the backend source:
`const users = await prisma.user.findMany(); res.json(users)`,
`res.json(await prisma.user.findMany())`, `res.status(200).json(users)` and a
promise-then handler all produce `select_all_query` and no
`large_api_payload`. It compares a variable's initialiser to the call by
identity, so an `await` in between breaks it, and it reads the arguments of the
wrong call. The one shape that reaches its data-flow code throws
(`scope.path` is undefined). The rule is written from its intent, not its code.

### Labelling notes, `payload/api-response`

- All 74 findings labelled; a cross-file finding is only `tp` if the linked
  endpoint's code was read and the rows do reach its response.
- Round 2 (2026-09-24): a call site that is a call into the application's own
  finder-named method, whose query is a finding elsewhere, is a duplicate.
  A008 and A049 were labelled `fp-not-a-query` for that reason in round 1;
  round 2 removes them and the queries they wrap (OAuthClientRepository.ts:100,
  role.repository.ts:15) are labelled in their place.

## Query builders — written 2026-09-24, before any finding was read

### What the rule claims

The same claim as `payload/unbounded-query`, for queries written with a
builder instead of an ORM finder: an executed read with nothing bounding the
rows. Reported under `payload/unbounded-query` (or `payload/api-response` when
the rows reach a response), because the claim is the same; the title names the
builder so the two can be told apart.

Builders covered:

- knex-style chains rooted at a handle called with a table:
  `knex('users')`, `this.database('spaces')`, `trx('t')`, `db('t')`, and
  `knex.select(...).from(...)`.
- TypeORM's `createQueryBuilder(...)` ending in `getMany()`, `getRawMany()` or
  `getManyAndCount()`.
- Kysely's `selectFrom(...)` ending in `execute()`.

### Executed, and bounded

A chain is executed when it is awaited, returned, followed by `.then()`, or
ends in a terminal method (`getMany`, `execute`, ...). A chain that is only
built — a subquery passed to `whereIn`, a builder handed to another function —
is not a query yet.

knex builders are mutable: `const q = knex('t'); if (page) q.limit(n); return
q;` is common. So a builder held in a variable counts as bounded when any call
on that variable, anywhere in the function, bounds it. A conditional limit is
treated as a limit: whether the condition holds is not visible statically, and
a rule that reports every optional-pagination endpoint would be wrong more
often than right.

Bounding: `.limit()`, `.first()`, `.take()`, `.paginate()`, aggregates
(`count`, `sum`, `avg`, `min`, `max`), `executeTakeFirst()`, `getOne()`,
`getCount()`, `.stream()`. A where on the table's own key (`where('id', x)`,
`whereIn('id', ids)`, `where({ id })`) bounds it the way Stage 1's
`fp-bounded-by-key` does; a where on a foreign key does not.

Writes (`insert`, `update`, `del`, `delete`, `truncate`, `increment`,
Kysely's `insertInto` / `updateTable` / `deleteFrom`) are not reads.

### Labels

Stage 1's labels, decided the same way.

### Sampling, query builders — 2026-09-25, before any finding was read

621 builder findings on the 283 repositories (`results/rounds/s2-builders.json`):
more than 400, so a sample. A repository breakdown (no finding read) put 29 of
them in the source of ORMs and query builders themselves (knex, typeorm,
objection, bookshelf, mikro-orm), which Stage 1 labels `fp-not-a-query`
("library code"). Stratified: 10 from that stratum to check it, 389 from the
rest by repository (proportional, at least one each), seed 20260925,
`eval/builders-sample.json`.

### Labelling notes, query builders — 2026-09-25

All 399 were labelled before any fix was scored. Nine sampled findings are
Stage 1 finder findings that the sample picked up by repository (`not-builder`);
they are listed and left out of the builder precision.

How the Stage 1 labels were applied to shapes the builder sample raised:

- **The same query reported twice** — once at the query, once at the
  `return rows.map(...)` that follows it — is `fp-not-a-query` on the second
  line, with the note "duplicate", as in Stage 1's wrapper rule. The label goes
  on the line the fix stops reporting, so a fix never loses the query itself.
- **`const [row] = await ...where(<own key>, x)`**: `fp-bounded-by-key`.
- **A tenant's configured items** (colour palettes, access tokens, service
  accounts, Slack channel mappings, an agent's user access list): `unsure`. They
  do not grow with product use the way messages or runs do, and nothing in the
  code caps them.
- **"Few in practice"** (a user's organisations, one job's log rows, a space's
  ancestors, slugs sharing a prefix) is `unsure`, not `fp-bounded-by-key`: the
  Stage 1 rule needs a reason in the code. A first pass had put 29 of these
  under `fp-bounded-elsewhere`; they were moved before round 2 was scored, and
  aggregates grouped by an enum-like column (`COUNT(*) ... GROUP BY role`) went
  to `fp-bounded-by-key`.
- **Copying a whole project** (Lightdash's preview-project copy reads every
  row of a dozen tables on purpose): `unsure`.
- **An ORM's own source outside the library stratum** (`strapi/packages/core/database`)
  is library code, `fp-not-a-query`, as the stratum rule says. The 10-finding
  library stratum agreed with its path rule on all 10.
- **A mutable builder with a conditional key filter** — Lightdash's
  `if (schedulerUuids?.length) q = q.whereIn('scheduler.scheduler_uuid', ids)` —
  keeps its `tp` label (without the filter it reads every scheduler of a
  project), and the rule's reading of it follows "a conditional limit is
  treated as a limit" above. That is the design's cost and is reported as such.

## `payload/deep-include` — written 2026-09-24, before any finding was read

### What the rule claims

An ORM query loads related rows three or more relations deep, and at least one
of those relations is to-many with no row limit of its own. Each to-many level
multiplies the rows per parent, so the payload grows with the product of the
fan-outs, not with the number of root rows.

Depth counts relations, not object nesting. That is the difference from Study
09's `deep_nested_include`, which fired on any call whose first argument nested
three objects deep: `where: { a: { b: { gte: x } } }` is three objects and no
relation. Counted:

| ORM | Relation syntax | One level |
|---|---|---|
| Prisma | `include: { posts: ... }`, `select: { posts: { ... } }` | each key under `include`; a key under `select` whose value is an object with its own `select`, `include`, `where`, `orderBy` or `take` (`_count` is not a relation) |
| Drizzle (relational queries) | `with: { posts: ... }` | each key under `with` |
| Sequelize | `include: [Model, { model, include: [...] }]` | each element; `{ all: true, nested: true }` counts as unbounded depth |
| TypeORM | `relations: ['a', 'a.b.c']` or `relations: { a: { b: true } }` | each dotted segment or nested key |
| MikroORM | `populate: ['a.b.c']` | each dotted segment |
| Mongoose | `.populate({ path, populate: { path, ... } })` | each nested `populate` |

The depth of a query is its deepest relation path. The rule reports at 3 or
more, as Study 09 did, once per query, at the query call. It is a separate
claim from `unbounded-query`: a query can carry both.

### Labels

| Label | Meaning |
|---|---|
| `tp` | A real ORM query, in code that serves users, whose relation tree is three or more relations deep and contains at least one to-many relation with no `take`/`limit` of its own. |
| `fp-not-a-query` | Not an ORM query: an options object that happens to nest, a route or config definition, an ORM's own source. |
| `fp-shallow` | An ORM query, but the rule miscounted: fewer than three of the nested levels are relations (a JSON-field filter, a scalar `select`, `orderBy` on a relation field). |
| `fp-to-one` | Three or more relations deep, but every relation in the tree is to-one, or every to-many carries its own row limit: the rows per root are bounded by construction. |
| `fp-not-served` | As in Stage 1: migrations, seeds, scripts, tests, examples. |
| `unsure` | The cardinality of a relation cannot be decided from the repository (the schema or model is not in it, or a relation name is computed). |

Cardinality is read from the schema: `posts Post[]` in `schema.prisma`, a
Sequelize `hasMany` / `belongsToMany`, a TypeORM `@OneToMany` /
`@ManyToMany`, a Mongoose array of refs. A to-many whose parent is itself
bounded to one row at the root (a `findUnique`) still counts: one project's
members' sessions' events is still unbounded.

## `payload/select-star` — written 2026-09-24, before any finding was read

### What the rule claims

A `SELECT *` (or `SELECT t.*`) SQL string is sent to the database by the
application, and the rows it returns come back to the application with every
column. Wide columns (JSON, text, blobs) travel whether the caller uses them or
not, and the payload grows when someone adds a column.

Study 09's `select_star` matched the regex `SELECT\s+\*\s+FROM` in any string
or template literal, whatever happened to it. The rule requires the string to
reach a database call: passed, directly or through a `const` in the same
function, to `query`, `raw`, `execute`, `exec`, `unsafe`, `prepare`,
`$queryRaw` / `$queryRawUnsafe`, pg-promise's `any` / `many` / `one` /
`oneOrNone` / `manyOrNone`, or written as a `sql` tagged template.

Not claimed: `EXISTS (SELECT * ...)` and `IN (SELECT * ...)` (no rows come
back), `INSERT ... SELECT *` and `CREATE TABLE ... AS SELECT *` (the rows stay
in the database). `SELECT COUNT(*)` does not match. A knex or ORM query with no
column list is also `SELECT *` on the wire; it is out of scope here, as decided
for this story (Stage 2 scope, item 4: "only when the string reaches a
database").

Whether the caller needed every column is not judged: that would need the
schema and every use of the result. A true positive is an upper bound on waste,
the same way Study 09's findings were judged for being database calls at all.

### Labels

| Label | Meaning |
|---|---|
| `tp` | A `SELECT *` string executed by the application against a database, in code that serves users, whose rows are returned to the application. |
| `fp-not-a-query` | The string is not executed by the application: documentation, a log or error message, a default query shown in a SQL editor, a SQL parser's test input, an ORM's own source. |
| `fp-not-returned` | Executed, but no rows come back with every column: an outer `SELECT *` over a subquery or CTE that already chose its columns, `EXISTS`, `INSERT ... SELECT *`, a `CREATE ... AS SELECT *`. |
| `fp-not-served` | As in Stage 1: migrations, seeds, scripts, tests, examples. |
| `unsure` | Cannot be decided from the repository (a user-authored query, a dynamic table name whose schema is external). |

### Labelling notes, `payload/select-star` — 2026-09-25

- All 151 round-1 findings were labelled; fewer than 400, so no sample.
- A read of a system catalog (`information_schema`, `sqlite_master`,
  `v$version`) is `tp` as the criteria are written: the string is executed and
  every column comes back. The catalog's columns are fixed, so the "grows when
  someone adds a column" half of the claim does not apply; they are counted
  separately in the results.
- A connection check (`SELECT * FROM system_schema.keyspaces` whose rows are
  discarded) is `tp` for the same reason.
- `UPDATE/INSERT ... RETURNING *` followed by `SELECT * FROM` the CTE is `tp`:
  every column of the written rows comes back.
- The source of a database library (TypeORM's query runners, MikroORM's
  driver, the Cosmos SDK, Payload's Drizzle adapter) is `fp-not-a-query`, as
  in Stage 1.

## `payload/unbounded-graphql` — written 2026-10-01, before any finding was read

### What the rule claims

A GraphQL resolver returns the rows of a database query with no row limit. The
client asked for a list field and gets every matching row, serialised into
the response, however large the table grows. It is `payload/api-response`
for GraphQL: same claim, different transport. Study 09 declared
`unbounded_graphql` and never implemented it.

A resolver is:

- a class method decorated `@Query` or `@ResolveField` (NestJS) or
  `@Query` / `@FieldResolver` (type-graphql);
- a function under a type name in a resolver map, an object with a `Query`
  or `Mutation` key: `{ Query: { users: () => ... }, User: { posts: (p) => ... } }`;
- the `resolve` function of a field config that also names its `type`
  (graphql-js `GraphQLObjectType` fields, Pothos `t.field` / `t.prismaField`,
  Nexus `t.list.field`).

The query is traced the same way as for `api-response`, in the same file and
across files. A query reported here is not also reported as `api-response`,
`unbounded-query` or `large-return`: one finding per query. A query that
reaches both a REST response and a resolver is reported as `api-response`.
Nest's `@Query` and `@ResolveField` were route decorators for `api-response`
until now; they move here.

A field resolver under a parent type (`User.posts`) runs once per parent. Its
own row limit is what this rule judges; the per-parent repetition is an N+1
question and out of scope here.

### Labels

Stage 1's labels, plus `fp-not-a-response` as defined for `api-response`.
A query bounded by pagination arguments the resolver passes on (`take:
args.first`) is bounded. A query loaded whole and paginated in memory
(`connectionFromArray(await findMany(), args)`) is `tp`: every row was read.
A DataLoader batch function bounded by the batch's keys is
`fp-bounded-by-key`.
