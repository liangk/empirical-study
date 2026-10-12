# Labelling criteria — Blocking I/O

Written 2026-10-08, before any finding from the Step 1 rescan was read. A
label is decided from the code at the scanned commit, not from what either
detector says about it (Study 02's `context`, core-engine's severity).

## The question

Every finding is a synchronous call. Whether it is a problem depends on one
thing: **does it run while the process has other work waiting?** A sync call
in a CLI, a build script or at boot blocks nothing that matters; the same call
in a request handler stalls every in-flight request for its duration.

## Labels

Every finding gets exactly one.

| Label | Meaning |
|---|---|
| `tp` | Runs inside a long-lived process while it serves concurrent work: a request handler or middleware, a function those call, a job or queue worker, a websocket or event-emitter listener, a timer, in a server, worker or Electron main process. |
| `fp-startup` | Runs once before the process serves anything: module top level, a constructor or factory called at boot, config and template loading at startup, a server's `listen` setup. |
| `fp-once` | Reachable per request, but guarded so it executes once or rarely: memoised, cached by key, behind an `if (!loaded)`, a lazily initialised singleton. |
| `fp-tooling` | Runs in a process with nothing else to wait for: a CLI, a build or bundler step, codegen, a migration or seed, a test, a script, a dev-only server or dev tooling. |
| `fp-not-blocking` | Not a blocking Node.js call at all: a method of the same name on an in-memory or virtual filesystem (memfs, a webpack `inputFileSystem` mock), a browser API, a user-defined function that happens to end in `Sync`, dead code. |
| `unsure` | Cannot be decided from the repository alone, typically a library function whose callers decide. Reported separately; never counted as `tp`. |

### Where the line falls

- **Libraries.** A library has no request path of its own. Label by how the
  function is meant to be used, from its docs or its own call sites: express's
  `View.prototype.lookup` runs per `res.render`, so a `statSync` there is `tp`
  unless view caching makes it `fp-once`; a config library's `loadSync()` that
  the README tells you to call at boot is `fp-startup`. No evidence either way
  is `unsure`.
- **Cost does not change the label.** `existsSync` is cheap and `pbkdf2Sync`
  is not, but both are labelled by where they run. Cost is reported
  separately, by method, from the benchmarks Study 02 already has.
- **Electron.** The main process drives every window; a sync call there that
  runs after startup is `tp`. A preload or build script is labelled on its own
  terms.
- **Dev servers** (Vite, webpack-dev-server, a framework's `dev` command) are
  `fp-tooling`: they serve one developer, and the code does not run in
  production. A framework's production server code is `tp` where it applies.
- **Startup reached through a request.** A first-request lazy init that runs
  once is `fp-once`, not `tp`.
- **Loops** multiply cost but do not change the label.

## Study 02's context classifier

For each Study 02 finding in the sample, record whether its `context`
(`request_path`, `background_path`, `startup_path`, `tooling_path`,
`unknown_path`) agrees with the label, using this mapping: `request_path` and
`background_path` → `tp`; `startup_path` → `fp-startup` or `fp-once`;
`tooling_path` → `fp-tooling`. `unknown_path` agrees with nothing; what its
findings turn out to be is the estimate the published "about 7% in request
paths" rested on.

## Sampling

- Study 02 findings: 400, stratified by `context`, seeded, with the seed in
  `eval/study02-sample.json`. Only repositories pinned in Step 1.
- core-engine findings: all of them if fewer than 400; otherwise 400
  stratified by severity, seeded, in `eval/sample.json`.
- A finding reported by both detectors at the same file and line is labelled
  once and the label shared.
