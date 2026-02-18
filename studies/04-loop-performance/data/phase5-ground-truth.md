# Study 04: Phase 5 — Static Analysis Ground Truth

> 100 labeled test cases for evaluating the `js-loop-detector` AST detector.
> Labels: **TP** = true positive (genuine anti-pattern) · **FP** = false positive (clean code incorrectly flagged) · **FN** = false negative (missed instance)
>
> The "Closed World" validation set consists of 50 positive cases (known anti-patterns) and 50 negative cases (clean code variants). Run `npm run detect -- --path data/ground-truth-cases/` after creating the `.ts` files below.

---

## Labeling Protocol

1. A TP is a code snippet that **genuinely** contains the anti-pattern and the detector **correctly flags** it.
2. A FP is a code snippet that **does not** contain the anti-pattern but the detector **incorrectly flags** it.
3. A FN is a code snippet that **genuinely** contains the anti-pattern but the detector **misses** it.
4. Two researchers must independently agree on TP/FP labels for any ambiguous case.

---

## Anti-Pattern Cases (50 Positive — Expected: TP)

### regex-in-loop (10 cases)

| ID | Code Pattern | Expected Label | Detector Result | Notes |
|----|-------------|----------------|-----------------|-------|
| GT-01 | `for (let i=0;i<n;i++) { const re = /foo/; re.test(s[i]); }` | TP | — | Regex literal in for-loop body |
| GT-02 | `items.forEach(x => { const re = /\d+/g; re.test(x); })` | TP | — | Regex in forEach callback |
| GT-03 | `for (const x of arr) { new RegExp(pattern).test(x); }` | TP | — | `new RegExp()` in for-of |
| GT-04 | `while (i<n) { /abc/.test(buf[i++]); }` | TP | — | Regex literal in while loop |
| GT-05 | `arr.map(s => /[A-Z]+/.test(s))` | TP | — | Regex in map callback |
| GT-06 | `arr.filter(s => { const r=/^\d+$/; return r.test(s); })` | TP | — | Regex in filter callback |
| GT-07 | `for (let i=0;i<n;i++) { const r=new RegExp('^'+prefix); r.test(s[i]); }` | TP | — | Dynamic RegExp in for loop |
| GT-08 | `items.reduce((acc,x)=>{ return /foo/.test(x)?acc+1:acc; },0)` | TP | — | Regex in reduce |
| GT-09 | `for (const k of keys) { if (new RegExp(k).test(val)) found.push(k); }` | TP | — | new RegExp per iteration |
| GT-10 | `data.flatMap(x => { const re=/\s+/; return x.split(re); })` | TP | — | Regex in flatMap callback |

### json-parse-in-loop (10 cases)

| ID | Code Pattern | Expected Label | Detector Result | Notes |
|----|-------------|----------------|-----------------|-------|
| GT-11 | `for (let i=0;i<n;i++) { const o=JSON.parse(raw); sum+=o.v; }` | TP | — | JSON.parse in for-loop |
| GT-12 | `items.forEach(x => { const d=JSON.parse(x.data); process(d); })` | TP | — | JSON.parse in forEach |
| GT-13 | `arr.map(x => JSON.parse(x))` | TP | — | JSON.parse in map |
| GT-14 | `for (const row of rows) { const obj=JSON.parse(payload); merge(row,obj); }` | TP | — | Constant payload parsed in for-of |
| GT-15 | `while(q.length){ const cfg=JSON.parse(configStr); handle(q.pop(),cfg); }` | TP | — | JSON.parse in while loop |
| GT-16 | `arr.filter(x => JSON.parse(x).active)` | TP | — | JSON.parse in filter predicate |
| GT-17 | `arr.reduce((a,x) => { const o=JSON.parse(x); return a+o.n; }, 0)` | TP | — | JSON.parse in reduce |
| GT-18 | `for (let i=0;i<n;i++) { result.push(JSON.parse(templates[i%2])); }` | TP | — | JSON.parse of repeated template |
| GT-19 | `items.flatMap(x=>JSON.parse(x.list))` | TP | — | JSON.parse in flatMap |
| GT-20 | `for (const s of strings) { if(JSON.parse(defaults).enabled) use(s); }` | TP | — | Constant JSON parsed per iteration |

### nested-loops (10 cases)

| ID | Code Pattern | Expected Label | Detector Result | Notes |
|----|-------------|----------------|-----------------|-------|
| GT-21 | `for(let i=0;i<n;i++) { for(let j=0;j<n;j++) { f(a[i],b[j]); } }` | TP | — | Classic O(n²) nested for |
| GT-22 | `for(const x of A) { for(const y of B) { if(x.id===y.id) pairs.push([x,y]); } }` | TP | — | Nested for-of |
| GT-23 | `A.forEach(x => B.forEach(y => merge(x,y)))` | TP | — | Nested forEach |
| GT-24 | `for(let i=0;i<n;i++) { for(const y of arr) { sum+=i*y; } }` | TP | — | Mixed nested loops |
| GT-25 | `while(i<n) { let j=0; while(j<m) { process(i,j++); } i++; }` | TP | — | Nested while loops |
| GT-26 | `for(let i=0;i<n;i++) { for(let j=i+1;j<n;j++) { compare(a[i],a[j]); } }` | TP | — | Triangle nested loop |
| GT-27 | `rows.forEach(r => cols.forEach(c => cells.push(r*c)))` | TP | — | Nested forEach O(n×m) |
| GT-28 | `for(const g of groups) { for(const m of g.members) { idx[m]=g.id; } }` | TP | — | Nested for-of, O(n×k) |
| GT-29 | `for(let i=0;i<A.length;i++) { for(let j=0;j<B.length;j++) { if(A[i]===B[j]) res++; } }` | TP | — | Linear-scan inner |
| GT-30 | `items.forEach(x => { for(const tag of tags) { if(x.tag===tag) mark(x); } })` | TP | — | forEach + for-of nested |

### nested-array-methods / chained-array-methods (10 cases)

| ID | Code Pattern | Expected Label | Detector Result | Notes |
|----|-------------|----------------|-----------------|-------|
| GT-31 | `A.forEach(x => B.filter(y=>y.g===x.g).forEach(y=>use(x,y)))` | TP | — | filter inside forEach |
| GT-32 | `arr.map(x => x.items.filter(i=>i.ok).map(i=>i.v))` | TP | — | Double nested map+filter |
| GT-33 | `data.filter(x=>x.active).map(x=>x.value*2)` | TP | — | Chained filter+map |
| GT-34 | `items.filter(x=>x>0).map(x=>x*x).reduce((a,b)=>a+b,0)` | TP | — | Triple chain |
| GT-35 | `arr.filter(x=>x.type==='A').map(x=>transform(x))` | TP | — | filter+map two-pass |
| GT-36 | `list.map(x=>x.children.filter(c=>c.active))` | TP | — | map with nested filter |
| GT-37 | `data.filter(Boolean).map(JSON.stringify)` | TP | — | filter+map chain |
| GT-38 | `rows.filter(r=>r.score>50).map(r=>({...r,grade:'B'}))` | TP | — | filter+map with spread |
| GT-39 | `arr.map(x=>x.tags).filter(t=>t.includes('js'))` | TP | — | map+filter (reversed order) |
| GT-40 | `groups.forEach(g => g.items.map(i=>i.id).filter(id=>seen.has(id)).forEach(id=>dups.push(id)))` | TP | — | Triple nested callback chain |

### sequential-await-in-loop (10 cases)

| ID | Code Pattern | Expected Label | Detector Result | Notes |
|----|-------------|----------------|-----------------|-------|
| GT-41 | `for(const id of ids) { const r=await fetch(id); results.push(r); }` | TP | — | await in for-of |
| GT-42 | `for(let i=0;i<n;i++) { await delay(100); }` | TP | — | await in for loop |
| GT-43 | `while(queue.length) { const res=await process(queue.shift()); out.push(res); }` | TP | — | await in while |
| GT-44 | `for(const url of urls) { const html=await get(url); parse(html); }` | TP | — | Sequential HTTP in loop |
| GT-45 | `for(const f of files) { const data=await readFile(f); transform(data); }` | TP | — | Sequential file I/O |
| GT-46 | `for(let i=0;i<items.length;i++) { await save(items[i]); }` | TP | — | Sequential DB writes |
| GT-47 | `for(const task of tasks) { const r=await runTask(task); log(r); }` | TP | — | Sequential task execution |
| GT-48 | `for(const chunk of chunks) { const r=await upload(chunk); status.push(r); }` | TP | — | Sequential uploads |
| GT-49 | `while(pending.length) { const done=await resolveNext(pending); mark(done); }` | TP | — | await in while with array |
| GT-50 | `for(const q of queries) { results[q.id]=await db.query(q.sql); }` | TP | — | Sequential DB queries |

---

## Clean Code Cases (50 Negative — Expected: No Flag / FP if flagged)

### Hoisted regex — should NOT flag (10 cases)

| ID | Code Pattern | Expected Label | Detector Result | Notes |
|----|-------------|----------------|-----------------|-------|
| GT-51 | `const RE=/foo/; for(let i=0;i<n;i++) { RE.test(s[i]); }` | No flag | — | Regex hoisted correctly |
| GT-52 | `const DATE_RE=/\d{4}-\d{2}-\d{2}/; arr.forEach(x=>DATE_RE.test(x))` | No flag | — | Const regex before forEach |
| GT-53 | `const patterns=[/a/,/b/]; items.filter(x=>patterns.some(p=>p.test(x)))` | No flag | — | Array of pre-built regex |
| GT-54 | `const r=new RegExp(expr); for(const s of strs) r.test(s);` | No flag | — | RegExp hoisted before loop |
| GT-55 | `const compiled=patterns.map(p=>new RegExp(p)); data.forEach(x=>compiled.forEach(r=>r.test(x)))` | No flag | — | Pre-compiled outside loop |
| GT-56 | `function check(re,s){return re.test(s);} const r=/\d+/; arr.forEach(x=>check(r,x))` | No flag | — | Regex passed as argument |
| GT-57 | `const [a,b]=[/foo/,/bar/]; strs.forEach(s=>{a.test(s);b.test(s);})` | No flag | — | Destructured hoisted regex |
| GT-58 | `class V { #re=/\d+/; validate(s){return this.#re.test(s);} }` | No flag | — | Regex as class field |
| GT-59 | `const map=new Map(rules.map(r=>[r.name,new RegExp(r.pat)])); items.forEach(x=>map.get(x.type)?.test(x.v))` | No flag | — | RegExp built once into Map |
| GT-60 | `const RE_CACHE={};function getRe(p){return RE_CACHE[p]||(RE_CACHE[p]=new RegExp(p));} arr.forEach(x=>getRe(x.pat).test(x.v))` | No flag | — | Manual memoized regex |

### Parallel async — should NOT flag (10 cases)

| ID | Code Pattern | Expected Label | Detector Result | Notes |
|----|-------------|----------------|-----------------|-------|
| GT-61 | `const results=await Promise.all(ids.map(id=>fetch(id)))` | No flag | — | Correct parallelization |
| GT-62 | `const [a,b,c]=await Promise.all([fetchA(),fetchB(),fetchC()])` | No flag | — | Parallel destructure |
| GT-63 | `await Promise.allSettled(tasks.map(t=>run(t)))` | No flag | — | allSettled |
| GT-64 | `const rs=await Promise.all(chunks.map(async c=>{const d=await read(c);return parse(d);}))` | No flag | — | Async map with internal await |
| GT-65 | `const data=await Promise.all(urls.map(u=>axios.get(u)))` | No flag | — | axios parallel |
| GT-66 | `for await (const chunk of stream) { process(chunk); }` | No flag | — | for-await-of is NOT sequential I/O anti-pattern |
| GT-67 | `const ps=items.map(x=>asyncOp(x)); const rs=await Promise.all(ps)` | No flag | — | Map then all |
| GT-68 | `await pMap(items,async x=>heavyWork(x),{concurrency:4})` | No flag | — | Concurrency-limited parallel (no direct await in loop) |
| GT-69 | `const results={}; await Promise.all(keys.map(async k=>{results[k]=await get(k);}))` | No flag | — | Parallel with side effects |
| GT-70 | `async function batch(arr){return Promise.all(arr.map(fn))}` | No flag | — | Helper function |

### Map/Set lookups — should NOT flag for nested-loops (10 cases)

| ID | Code Pattern | Expected Label | Detector Result | Notes |
|----|-------------|----------------|-----------------|-------|
| GT-71 | `const m=new Map(B.map(b=>[b.id,b])); for(const a of A){const b=m.get(a.id);if(b)pairs.push([a,b]);}` | No flag | — | O(n) Map lookup |
| GT-72 | `const set=new Set(ids); arr.filter(x=>set.has(x.id))` | No flag | — | Set membership |
| GT-73 | `const idx={}; B.forEach(b=>idx[b.k]=b); A.forEach(a=>{const b=idx[a.k];if(b)use(a,b);})` | No flag | — | Object index lookup |
| GT-74 | `const sorted=arr.sort((a,b)=>a-b); for(let i=1;i<sorted.length;i++) check(sorted[i-1],sorted[i]);` | No flag | — | Single loop after sort |
| GT-75 | `const cache=new Map(); for(const x of items){if(!cache.has(x.k))cache.set(x.k,compute(x.k)); use(cache.get(x.k),x);}` | No flag | — | Memoized single loop |
| GT-76 | `const byId=_.keyBy(users,'id'); orders.forEach(o=>{o.user=byId[o.userId];})` | No flag | — | Pre-indexed via keyBy |
| GT-77 | `const flat=matrix.flat(); for(let i=0;i<flat.length;i++) process(flat[i]);` | No flag | — | Flat then single loop |
| GT-78 | `for(let i=0;i<n;i++) { const v=arr[i]; sum+=v; }` | No flag | — | Plain single for-loop |
| GT-79 | `arr.forEach((x,i)=>{ const prev=arr[i-1]; if(prev) check(prev,x); })` | No flag | — | Adjacent-pair single-pass |
| GT-80 | `const counted=arr.reduce((acc,x)=>{acc[x]=(acc[x]||0)+1;return acc;},{})` | No flag | — | Single-pass reduce |

### Correct single-pass chained methods (10 cases)

| ID | Code Pattern | Expected Label | Detector Result | Notes |
|----|-------------|----------------|-----------------|-------|
| GT-81 | `arr.reduce((acc,x)=>{if(x.active)acc.push(x.v*2);return acc;},[])` | No flag | — | Single-pass reduce (correct) |
| GT-82 | `arr.flatMap(x=>x.active?[x.v*2]:[])` | No flag | — | flatMap as fused filter+map |
| GT-83 | `const out=[]; for(const x of arr){if(x.active)out.push(x.v*2);}` | No flag | — | Manual single-pass loop |
| GT-84 | `arr.forEach(x=>{if(x.ok)result.push(transform(x));})` | No flag | — | forEach with inline filter |
| GT-85 | `const r=arr.reduce((s,x)=>s+x,0)` | No flag | — | Simple sum reduce |
| GT-86 | `arr.some(x=>x>threshold)` | No flag | — | Short-circuit some |
| GT-87 | `arr.every(x=>x!==null)` | No flag | — | Short-circuit every |
| GT-88 | `arr.find(x=>x.id===target)` | No flag | — | Short-circuit find |
| GT-89 | `const unique=[...new Set(arr.map(x=>x.k))]` | No flag | — | Dedup via Set |
| GT-90 | `arr.sort((a,b)=>a.score-b.score).slice(0,10)` | No flag | — | Sort + slice, not a loop anti-pattern |

### Edge cases — detector must NOT flag these (10 cases)

| ID | Code Pattern | Expected Label | Detector Result | Notes |
|----|-------------|----------------|-----------------|-------|
| GT-91 | `const r=/foo/; if(r.test(x)) doSomething()` | No flag | — | Regex outside any loop |
| GT-92 | `JSON.parse(input)` | No flag | — | JSON.parse outside loop |
| GT-93 | `await fetch(url)` | No flag | — | Single await outside loop |
| GT-94 | `for(let i=0;i<1;i++) { /foo/.test(s); }` | TP | — | Loop of 1 — still technically a pattern (document as edge case) |
| GT-95 | `function processItem(x){const re=/\d+/;return re.test(x);}` | No flag | — | Regex in non-loop function body |
| GT-96 | `const vals=arr.map(x=>x.value)` | No flag | — | Simple map, no chaining |
| GT-97 | `const filtered=arr.filter(x=>x>0)` | No flag | — | Simple filter, no chaining |
| GT-98 | `for(const x of arr){for(const y of [x]){}}`  | TP | — | Nested loop but inner array is constant size 1 — document as low-severity edge |
| GT-99 | `[1,2,3].forEach(x=>console.log(x))` | No flag | — | Literal array, no async or regex |
| GT-100 | `const a=arr.filter(x=>x); const b=a.map(x=>x*2)` | No flag | — | Separate statements — NOT chained |

---

## Running the Validation

```bash
# After creating ground-truth-cases/ directory with .ts files for each pattern:
npm run detect -- --path data/ground-truth-cases/

# Fill in Detector Result column above manually from output.
# Then compute metrics per pattern in evaluate-tools.ts.
```

---

## Expected Metrics (Target Thresholds)

| Pattern | Target Precision | Target Recall | Target F1 |
|---------|-----------------|---------------|-----------|
| regex-in-loop | ≥ 0.85 | ≥ 0.80 | ≥ 0.82 |
| json-parse-in-loop | ≥ 0.90 | ≥ 0.85 | ≥ 0.87 |
| nested-loops | ≥ 0.80 | ≥ 0.85 | ≥ 0.82 |
| nested-array-methods | ≥ 0.75 | ≥ 0.80 | ≥ 0.77 |
| chained-array-methods | ≥ 0.75 | ≥ 0.80 | ≥ 0.77 |
| sequential-await-in-loop | ≥ 0.90 | ≥ 0.90 | ≥ 0.90 |

> Viability threshold for CI/CD integration: Precision > 0.80 (per Plan §5).
