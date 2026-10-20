---
title: "I Re-Ran My Blocking I/O Scan. About 3% of 10,058 Sync Calls Block Anything."
pubDate: "2026-10-20"
heroImage: "../../assets/blocking-io-detection-story.webp"
author: "Ko-Hsin Liang"
repo: "https://github.com/liangk/empirical-study"
description: "In February I published 10,609 blocking I/O findings from 250 Node.js repos and said about 7% sat in request paths. I re-ran the scan at the same commits and labelled a sample by where each call runs: about 3% block anything. Here's what the real ones look like, and what one costs: Next.js preview decryption stalls every other request for 51ms."
excerpt: "Finding readFileSync in a codebase is easy. Knowing whether it runs while a server has other work waiting is not. I re-ran my Study 02 scan, labelled what it found by entry point, rebuilt the detector around reachability, and benchmarked two real true positives from Next.js and Redwood."
lastmod: "2026-10-20"
canonical_url: "https://stackinsight.dev/blog/blocking-io-detection-story"
twitter_card: "summary_large_image"
twitter_site: "@stackinsightDev"

# SEO
keywords:
  - blocking io detection
  - readFileSync in request handler
  - nodejs event loop blocking
  - pbkdf2Sync performance
  - scryptSync login latency
  - static analysis false positives
  - sync fs calls nodejs
  - event loop lag
  - nextjs preview mode performance
  - redwood dbauth scrypt
  - reachability static analysis
  - nodejs performance audit

# Structured Data (Article Schema)
schema_type: "TechArticle"
schema_proficiency_level: "Intermediate"
schema_dependencies: "Node.js v18+"
schema_time_required: "PT16M"

# Taxonomy
categories:
  - "Node.js Performance"
  - "Software Engineering Research"
  - "Backend Development"
tags:
  - blocking-io
  - event-loop
  - static-analysis
  - nodejs
  - performance
  - typescript
  - crypto
  - empirical-study

# Related
related_posts:
  - "blocking-io-empirical-study"
  - "large-payloads-detection-story"
  - "n-plus-1-query-detection-story"
series: "Detector Application Reports"
series_order: 4
---

# I Re-Ran My Blocking I/O Scan. About 3% of 10,058 Sync Calls Block Anything.

In February I published a study of blocking I/O that scanned 250 Node.js repositories, reported 10,609 synchronous calls, and said about 7% of them sat in request-handling code. I re-ran that scan at the same commits and labelled a sample by one question: does this call run while the process has other work waiting? About 3% do. An estimated 313 of 10,058, with a 95% interval of 165 to 460.

Finding `readFileSync` is easy. Knowing whether it matters is a reachability problem, and that's what I rebuilt the detector around. The new rules report 6,001 findings, and the 261 above low severity hold three quarters of the real ones I labelled. Then I measured two of them on their own code. Next.js's preview-mode decryption runs 51ms of `pbkdf2Sync` per request. At 20 previews a second, every other request on the server waits a median 60ms. The async version: 0.1ms.

---

## The Pattern

Node.js runs your JavaScript on one thread. A synchronous call holds that thread until it returns, and nothing else runs in the meantime: no other request, no timer, no callback.

```js
app.get('/report', (req, res) => {
  const data = fs.readFileSync('/var/reports/today.json', 'utf8');
  res.send(data);
});
```

In a request handler, that's every in-flight request waiting on one disk read. In a CLI it's nothing at all, because nothing else is waiting. The same line is a bug in one place and the correct, simpler choice in another. The code doesn't tell you which. Where it runs does.

That's the whole difficulty, and it's why Study 02 tried to classify each finding by context: request path, background job, startup, tooling, or unknown. This is the story of how well that worked.

## Re-running Study 02

Study 02 cloned 250 repositories with `--depth 1` in February and deleted the clones afterwards, so there was no recorded commit to go back to. What I did have was the scan's start time, 2026-02-13 22:29 UTC. For each repository I took the last commit on its default branch before that moment and re-ran Study 02's own detector on it, compiled unchanged. A repository counted as reproduced only if every finding came back: same file, same line, same method.

The first trial already caught something. nestjs/nest didn't reproduce, because "last commit before the cutoff" had picked a side-branch commit by date. The commit that reproduces all 1,346 files and all 9 findings is a mainline merge five days earlier. So Study 02's clones had been reused across runs for days, and the timestamp is only an upper bound. Following the first-parent line fixed it.

237 of the 247 distinct repositories reproduced. In 232 the file count matched too. In the other five it was off by a handful, from Study 02's 500 KB file limit and symlinks. The published total reconciles to the finding:

| Step | Removed | Findings left |
|---|---:|---:|
| Study 02, as published | | 10,609 |
| Three repositories listed and counted twice (directus 18, homepage 19, nock 13) | 50 | 10,559 |
| Two repositories that reproduce, but Study 02 saw far fewer files than the checkout has | 204 | 10,355 |
| Eight repositories that didn't reproduce at any commit tried | 297 | **10,058** |

Prevalence barely moves: 178 of the 237 have a finding, 75.1%, against the published 76.4%. That number was never the problem. The 7% was.

## Is It a Problem?

I drew 400 findings, stratified by Study 02's own context label, and labelled each one against criteria I wrote before reading any of them. Six labels: `tp` for a call that runs where it blocks concurrent work, four kinds of false positive (startup, runs once, tooling, not a blocking call at all), and `unsure`.

The first pass taught me something about my own labelling. I'd read 15 lines either side of each call and labelled library code by how it's usually used. That made some `tp` labels inferences. So I added a rule before revisiting anything: **every label names an entry point.** A route registration, a job handler, a listener, startup code, a CLI. A file under `scripts/` or `bin/` is its own entry point. Otherwise I traced callers with grep, up to two levels, and if no entry point turned up within two levels, the label is `unsure`, however obvious the usual use. The estimate fell by a third.

| Study 02 `context` | Findings | Sampled | `tp` | `tp` rate | Estimated `tp` |
|---|---:|---:|---:|---:|---:|
| `unknown_path` | 6,033 | 160 | 3 | 1.9% | 113 |
| `tooling_path` | 1,972 | 70 | 0 | 0.0% | 0 |
| `startup_path` | 1,281 | 70 | 2 | 2.9% | 37 |
| `request_path` | 633 | 70 | 17 | 24.3% | 154 |
| `background_path` | 139 | 30 | 2 | 6.7% | 9 |
| **Total** | **10,058** | **400** | **24** | | **313 (3.1%)** |

Weighted back to the population, that's 313 findings, with a 95% interval of 165 to 460. If every `unsure` turned out real, the ceiling is 877.

The classifier did one thing well: all 70 sampled `tooling_path` findings were tooling. But `request_path`, the label the 7% rested on, was right 17 times out of 70. The rest were build scripts that import express, dev servers, startup code that happens to sit near a route, and CLIs with a `req` variable. And `unknown_path`, 60% of everything, was overwhelmingly tooling: 133 of 160.

Labels like these are judgement calls, so I didn't want to grade my own. A second labeller, blind to my labels and to Study 02's context, relabelled 144 locations: every `tp` and `unsure`, plus 60 drawn at random from the rest. On `tp` versus not, we agreed on 93.8%, a Cohen's kappa of 0.86. None of the 60 random false positives came back `tp`. Most disagreements, 17 of 26, were `unsure` versus false positive on library code, which doesn't move the estimate. In seven the second labeller had traced further than I had, and was right, so I took its label. Five were about how to count "two levels". There I went strict: a chain three calls deep stays `unsure`, however convincing it looks, because strict is easier to reproduce.

So the scan wasn't wrong about what it found. It found sync calls, accurately. It was wrong about what they meant.

## Rebuilding the Detector

The rebuild lives in Code Evolution Lab's core engine, and it went the way the N+1 and payload rebuilds went: criteria first, a seeded sample, fixes in rounds, every round a rescan of all 237 repositories scored against the labels. A round could drop no labelled `tp`.

The engine's four rules, as shipped, reported 16,103 findings on this corpus. A third of them, 5,242, were in test and fixture directories (`test/`, `tests/`, `fixtures/`, `cypress/` and the like), which the walker now skips. The remaining 10,861 had an estimated 3.7% precision, no better than Study 02's. Their severity didn't help either: high, medium and low had `tp` rates of 7.5%, 2.1% and 4.3%. The tiers ranked nothing.

Round 1 removed what the labels said was noise:

- **Paths that don't serve anything.** Scripts, `bin/`, examples, playgrounds, benchmarks, codemods, migrations, build configs, `compiled/`, bundled yarn releases, minified files. 4,762 findings by path and 140 minified ones, and not one labelled `tp` among them. It also explained a loose end. 953 findings that only the engine reported, and that I couldn't account for at first, all sit in 13 files over 500 KB, mostly berry's bundled yarn CLIs. Study 02's walker skipped them by size.
- **Database calls that aren't.** The rule matched `runSync`, `getSync` and `allSync`. 35 of the 36 database findings weren't database calls. Most were methods that happen to share the name: sequelize's hook runner, directus's in-memory store, an async HTTP client in bitwarden, pm2's config getter. Seven were isolated-vm running a script, which does block but isn't a database. The 36th was db2's `querySync`, a real driver call. The rule now matches a driver's sync API only.
- **Severity from handler context.** "This file imports a server module" was the old signal for medium. It didn't predict anything, so it's gone. In a handler a call is high, critical in a loop, and elsewhere it's low. The one exception is a deliberately expensive key derivation, which never goes below medium.

That took the engine to 5,924 findings, still with every `tp`, at about 7% precision. Better, but the hard part was untouched. Seven of the 18 sampled `tp` in the engine's own sample sat at low severity, because the handler that made them matter wasn't the function holding the call. It was one or two calls up.

So the engine now does what my labelling did. While it scans each file, it indexes functions, the calls each one makes, and what each file imports. After the scan, for every finding outside a handler, it walks callers up to two levels, in the same file and through imported bindings into other files. It never links across files by name alone. If it reaches a handler, the finding gets the severity it would have inside one, and the description says which handler and how far up. A handler means a `(req, res)` or `(request, reply)` function, an `app`/`router` callback, a callback registered under a URL path, a `createServer` callback, a Next.js API route or App Router route handler, a method taking `ctx` under `controllers/`, or an Electron `ipcMain` handler.

| | Findings above low | Labelled `tp` above low (of 40) |
|---|---:|---:|
| As shipped | 3,214 | 19 |
| Handler context only | 68 | 14 |
| Reach: same-file and imported callers | 171 | 18 |
| Reach: plus `createServer`, URL-path callbacks, `(request, reply)` | 216 | 23 |
| Reach: plus instances of imported constructors | 258 | 30 |

The engine also gained what Study 02 had and it lacked: zlib's sync methods, `randomFillSync`, `.cjs` files, plus a rule of its own for isolated-vm, whose `runSync` used to be miscounted as a database call.

## What I Found

| | Study 02 detector | Engine as shipped (test and fixture directories left out) | Engine rebuilt |
|---|---:|---:|---:|
| Findings on the 237 repositories | 10,058 | 10,861 | 6,001 |
| Estimated findings that block concurrent work | 313 (3.1%) | 405 (3.7%) | 405 + 1 new (about 7%) |
| Findings above low severity | — | 3,214 | 261 |
| Labelled `tp` among them (of 40) | — | 19 | 30 |

Overall precision is still around 7%, and I don't think a static analyser gets it much higher on code like this. Most sync calls in a JavaScript repository run in tools, scripts and startup, and the corpus is full of tools: Vite, Babel, esbuild, yarn, Next.js's own build. What changed is the top of the list. Of the 24 sampled findings above low, 16 are real. That's a list a person can work through.

Here's what's on it.

## 1. Next.js: 100,000 rounds of SHA-512 per preview request

```ts
export function decryptWithSecret(secret: Buffer, encryptedData: string): string {
  // ...split salt, iv, tag, encrypted
  const key = crypto.pbkdf2Sync(secret, salt, PBKDF2_ITERATIONS, CIPHER_KEY_LENGTH, `sha512`)
  const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, key, iv)
  // ...
}
```

`PBKDF2_ITERATIONS` is 100,000. This runs on every request served in Preview Mode, the mode a CMS puts you in to see draft content: `tryGetPreviewData` decrypts the preview payload from the cookies on each one. Key derivation is deliberately slow; that's its job. Doing it synchronously means the slowness lands on everyone.

Preview traffic is editors, not the public, so it's light. But it's light on the same process that serves the public. This is the one I benchmarked, and the numbers are further down.

The engine reports it at high: `tryGetPreviewData` is a `(req, res)` function, one call up. It didn't, until this article's fact-check. Next.js loads the module with `require('../../crypto-utils') as typeof import('../../crypto-utils')`, and the TypeScript cast hid the import from the engine's index, so the call sat at medium with "no caller found". That's fixed in 1.5.1, with a test, and the numbers in this report are from 1.5.1. Study 02 found it too, and labelled it `request_path`, correctly. It was one of the 17.

## 2. Redwood: scrypt on every login

```ts
export const hashPassword = (text, { salt = crypto.randomBytes(32).toString('hex'), options = DEFAULT_SCRYPT_OPTIONS } = {}) => {
  const encryptedString = crypto
    .scryptSync(text.normalize('NFC'), salt, 32, options)
    .toString('hex')
  // ...
}
```

Redwood's dbAuth hashes the submitted password with `scryptSync` on every login, signup and password reset, at N=2^14 by default. Same story as Next.js: a function built to be expensive, called synchronously from `DbAuthHandler`, the class that answers each auth request. The engine reports it at medium for the same reason. One call took 29ms on the benchmark machine. Login traffic is bursty: a deploy logs everyone out, a morning standup logs everyone in.

Both of these are crypto, and neither is the most common shape. That one is much more boring.

## 3. Countly: listing plugin folders on every dashboard load

```js
plgns.forEach(plugin => {
  try {
    let contents = fs.readdirSync(__dirname + `/../../plugins/${common.sanitizeFilename(plugin)}/frontend/public/javascripts`) || [];
    toDashboard.javascripts.push.apply(toDashboard.javascripts, /* ...filter .js files */);
  }
  catch (e) { /* ... */ }
  // ...the same again for stylesheets
});
```

This is in `renderDashboard`, which the dashboard route calls on every load. For each installed plugin, two directory listings, on every page load, to find files that don't change between deploys. Each `readdirSync` is fast. Forty plugins make eighty of them per request, and on a slow or network disk "fast" stops being true.

Countly accounts for a lot of the `tp` labels: its data-migration plugin runs exports and imports, file writes and directory walks included, synchronously from API routes. It's also where the engine's reach struggles. Countly registers API routes with its own `plugins.register("/i/datamigration/export", fn)`, and its helpers are a call or two below that, some of them deeper. Callbacks registered under a URL path now count as handlers, and calls through an instance of an imported helper (`new migration_helper()`) are followed, which brought every Countly `tp` above low. The steps three or more levels down are `unsure` in my labels, and the engine mostly leaves them low. Two levels is the rule for both.

## 4. homepage: hashing every config file per request

```js
export default async function handler(req, res) {
  const hashes = configs.map((config) => {
    checkAndCopyConfig(config);
    const configYaml = join(CONF_DIR, config);
    return hash(readFileSync(configYaml, "utf8"));
  });
  // ...
}
```

A Next.js API route in homepage, the self-hosted dashboard. Seven config files read and hashed on each call, to tell the browser whether to reload. The files are small and it's a dashboard for one household, so the real cost is tiny.

I labelled it `tp` anyway, and that's deliberate. The label answers "does this run where it blocks other work?" How much it costs is a separate question, and the engine doesn't answer it either. It ranks this config read critical, a sync call in a loop in a handler, above Next.js's 51ms key derivation at high. Severity says where a call runs. Cost is what the benchmark is for.

## 5. drawio: compression in the Electron main process

```js
function writePngWithText(origBuff, key, text, compressed, base64encoded) {
  // ...
  if (compressed) {
    data = zlib.deflateRawSync(encodeURIComponent(text));
  }
  // ...
}
```

This one comes from the new coverage. Draw.io Desktop embeds the diagram's XML in exported PNGs, compressed with `deflateRawSync`, inside `exportDiagram`, which is registered with `ipcMain.on('export')`. Electron's main process drives every window. A big diagram compressing synchronously there freezes the whole app, menus included, until it's done.

It's the only real problem among the 45 findings the new patterns added. The rest were builds, test tooling, and libraries whose own repositories never call them from anything that serves.

## What a Blocking Call Actually Costs

The detector says a sync call runs where a handler reaches it. That's a shape, not a cost. So I took the two crypto cases, as their projects wrote them, and put each behind a minimal HTTP server with two routes. `/heavy` runs the code as shipped (or its async form, same parameters). `/ping` answers immediately. Then I sent `/ping` at a steady 200 requests per second, for 20 seconds, while sending `/heavy` at increasing rates, and measured `/ping`'s latency from the moment each request was due.

That's the question that matters: not how slow the login is, but what the login does to everything else.

| Preview requests per second | Mode | `/ping` p50 | `/ping` p99 | `/ping` max |
|---:|---|---:|---:|---:|
| 0 | sync | 0.4ms | 3.7ms | 34.2ms |
| 5 | sync | 0.8ms | 53.5ms | 101.3ms |
| 5 | async | 0.3ms | 4.1ms | 29.3ms |
| 10 | sync | 6.1ms | 60.4ms | 107.7ms |
| 10 | async | 0.1ms | 4.3ms | 59.7ms |
| 20 | sync | 60.6ms | 273.9ms | 1,402.5ms |
| 20 | async | 0.1ms | 4.9ms | 16.8ms |
| 30 | sync | 3,746.9ms | 26,980.1ms | 27,269.5ms |
| 30 | async | 0.3ms | 7.1ms | 19.3ms |

At five previews a second, nobody notices the median. The tail is another matter: one ping in a hundred waits 53ms, because it arrived during a decryption. At 20 a second, the median ping takes 60ms, for a route that does nothing. And at 30 a second the server is asked for 1.5 seconds of synchronous CPU every second, so it falls behind and never catches up. The median ping waits 3.7 seconds, and the queue was still growing when the run stopped. The async server, at the same load, kept its p99 under 8ms throughout.

The async version doesn't make the preview faster. Its own median was 51 to 57ms, about the same as the sync one at low load. It moves the work to libuv's thread pool, off the thread every other request needs. That's the entire fix.

| Logins per second | Mode | `/ping` p50 | `/ping` p99 | `/ping` max |
|---:|---|---:|---:|---:|
| 5 | sync | 0.4ms | 43.9ms | 61.5ms |
| 5 | async | 0.3ms | 2.3ms | 11.3ms |
| 20 | sync | 14.2ms | 44.4ms | 89.9ms |
| 20 | async | 0.1ms | 4.5ms | 27.4ms |
| 30 | sync | 117.8ms | 13,589.1ms | 14,251.5ms |
| 30 | async | 0.3ms | 5.8ms | 18.2ms |

Redwood's scrypt costs less per call, 29ms, so it takes more logins to tip over. At 30 a second it does: a p99 of 13.6 seconds for a ping.

Study 02's benchmarks measured the same mechanism on synthetic handlers in February, and they stand: `execSync` in a handler dropped throughput 280x, and `pbkdf2Sync` caused timeouts the async version didn't. What the scan got wrong was how often that situation exists in real code. What these two runs add is that it does exist, in projects people deploy, written by people who know what they're doing.

## The Fix

When the call is already inside an async function, the fix is one line, and the engine writes it:

```ts
// before, inside an async function
const key = crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LENGTH, 'sha512')
// after: what the solution generator writes, with the arguments as found
const key = (await new Promise((resolve, reject) => crypto.pbkdf2(secret, salt, ITERATIONS, KEY_LENGTH, 'sha512', (err, key) => (err ? reject(err) : resolve(key)))))
```

`fs` calls become `fs.promises`, crypto and zlib calls become their callback form wrapped in a promise, isolated-vm calls become their async twins. The wrapper is there so the suggestion needs no import and is complete as pasted. It's held to the standard the Missing Index and payload generators set: paste it over the call, rescan, and the finding has to be gone. Applied to every finding in the corpus, it made 1,165 suggestions, 1,162 cleared on a rescan, none broke a file's syntax, and the other three are in files the checker's parser can't read as they stand.

Then the honest part. Of the 40 labelled true positives, the drop-in fix applies to 12.

The other 26 sit in a synchronous function or callback. Countly's handlers are callback-style. Next.js's `decryptWithSecret` is a sync function called from `tryGetPreviewData`, which is sync too. Redwood's `hashPassword` is a sync helper. You can't paste an `await` into a sync function. The fix is to make the function async, and then every caller, up to one that already is. That's a refactor, and a tool that pretends otherwise ships broken code.

So for those, the engine says so. The recommendation starts with "Refactor, not a drop-in fix:" and names what to change. For a sync handler: make the handler async. For a `forEach`: turn it into a `for...of` inside an async function. For Redwood's `hashPassword`: make it async and await it at its callers, which it lists. They're `resetPassword`, `_verifyPassword` and `_createUser` in `DbAuthHandler.ts`, and all three are already async, so the refactor stops one level up. 26 of the 40 get a note like that. Two get neither: a crypto function imported by name, whose async twin isn't in scope, and an `openSync` whose async form returns a different kind of handle.

Payload's generator reached 104 of 109 true positives, because a row limit fits anywhere. A blocking call is a property of the code around it, and most of the time the fix is too.

## Can You Trust These Numbers?

Every estimate here comes from labels, and the labels are published: criteria written before any finding was read, the amendments added after the first pass and why, both samples, every label with its entry point or caller chain, the second labeller's labels and every disagreement. Like the N+1 and payload reports, the labelling was AI-assisted, a review loop over each finding's source and its callers rather than me tracing some 800 call sites unaided. The blind second pass is there because of that. A kappa of 0.86 on `tp` versus not, on the hardest cases, is the number to argue with.

The strict two-level rule cuts both ways. It keeps labels reproducible, and it puts real problems in `unsure`. Budibase runs user JavaScript through isolated-vm's `runSync` on every request that evaluates a binding. That blocks. But the request is three levels up, through the template engine, so it's `unsure`, and the estimate doesn't count it. That's why the upper bound, 877 if every `unsure` is real, sits so far above the estimate.

I haven't measured recall. I know what the rules report is ranked usefully, and I don't know what they miss. Package-name imports inside a monorepo are one known gap: the reach analysis follows `./service`, not `@budibase/backend-core`. Job workers, Electron menu handlers and framework-specific registrations like Apostrophe's `apiRoutes` aren't handlers to it either.

## Running This Yourself

The rebuilt rules ship in Code Evolution Lab 1.5.1. It's an offline static analyser: no account, no API, your code doesn't leave your machine.

```bash
npx code-evolution-lab@1.5.1 analyze src/server --category blocking-io --solutions
```

Start with everything above low. High and critical are calls a handler runs, directly or within two calls, and a finding reached through its callers names the handler and how far up. Medium is mostly expensive crypto, which deserves a look wherever it is. Low is where tools, startup code and everything the engine couldn't connect to a handler end up. It isn't safe by definition. It's unranked.

The study is reproducible from the repository: the recovered commits, both detectors' output for every repository, the labels, the round-by-round rescans, and the benchmark harness with both projects' code.

## Caveats

The corpus is Study 02's, by design: 237 of its repositories at the commits that reproduce it. It leans towards popular projects, and many of them are developer tools, where sync I/O is mostly correct. A corpus of production services would have a higher `tp` rate. The 3% describes this corpus, not Node.js code in general.

The benchmark is two handlers on one 2-core cloud machine, with the load generator on the same machine, one 20-second run per cell. The tails are noisy: an idle server's worst ping was 34ms. The medians, and the point where the sync server stops keeping up, are what to trust. Production hardware with more cores moves the tipping point. It doesn't move the mechanism, because the event loop is one thread on any machine.

Study 02's benchmarks stand. Its prevalence figure, 76% of repositories with a sync call, stands too. Its "about 7% in request paths" doesn't: the classifier behind it was right on a quarter of its sample, and the article now says so at the top. The defensible statement is about 3% of sync calls, roughly 300 in this corpus, run where they block concurrent work.
