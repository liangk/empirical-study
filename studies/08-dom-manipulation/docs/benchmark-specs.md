# Study 08: Benchmark Specifications

## BM-01: Forced Synchronous Layout (Layout Thrashing)

**Hypothesis**: Reading a layout property (`offsetWidth`) immediately after a style write, inside a loop, forces the browser to flush pending style recalculations synchronously on every iteration, multiplying layout cost by n.

**Baseline** (`bm01-layout-thrash-baseline.html`):
```js
for (let i = 0; i < n; i++) {
  el.style.width = (el.offsetWidth + 1) + 'px'; // read then write, each iteration
}
```

**Optimized** (`bm01-layout-thrash-optimized.html`):
```js
const w = el.offsetWidth; // single read
for (let i = 0; i < n; i++) {
  el.style.width = (w + i) + 'px'; // write only
}
```

**Metrics**: `durationMs`, `longTaskCount`
**n values**: 100, 500, 1 000, 5 000, 10 000 iterations
**Expected**: 5–20× speedup; baseline generates n forced layouts; optimized generates 1

---

## BM-02: innerHTML in Loop

**Hypothesis**: Repeated `innerHTML +=` inside a loop triggers n parse-and-serialize cycles plus n layout invalidations. A single template-string assignment triggers one.

**Baseline** (`bm02-innerhtml-baseline.html`):
```js
for (let i = 0; i < n; i++) {
  container.innerHTML += `<div class="item">${i}</div>`;
}
```

**Optimized** (`bm02-innerhtml-optimized.html`):
```js
container.innerHTML = Array.from({ length: n }, (_, i) =>
  `<div class="item">${i}</div>`
).join('');
```

**Metrics**: `durationMs`, final node count (correctness check)
**n values**: 100, 500, 1 000, 5 000, 10 000 items
**Expected**: 3–15× speedup; baseline is O(n²) in DOM serialization

---

## BM-03: Individual Style Mutation in Loop

**Hypothesis**: Setting multiple `element.style.X = Y` properties per iteration invalidates layout once per write. Toggling a pre-defined CSS class applies all properties in a single style recalculation.

**Baseline** (`bm03-style-mutation-baseline.html`):
```js
items.forEach(el => {
  el.style.backgroundColor = '#ff0000';
  el.style.color = '#ffffff';
  el.style.padding = '8px';
  el.style.borderRadius = '4px';
});
```

**Optimized** (`bm03-style-mutation-optimized.html`):
```js
items.forEach(el => {
  el.classList.add('highlighted');  // single recalc for all properties
});
```

**Metrics**: `durationMs`
**n values**: 100, 500, 1 000, 5 000, 10 000 elements
**Expected**: 2–8× speedup at large n; smaller gains at n < 500

---

## BM-04: DOM Query Inside Loop

**Hypothesis**: Calling `querySelector` or `getElementById` inside a loop traverses the full DOM tree on every call. Caching the reference outside the loop reduces lookup to O(1).

**Baseline** (`bm04-query-cache-baseline.html`):
```js
for (let i = 0; i < n; i++) {
  const el = document.getElementById('target'); // O(n) DOM walk × n
  el.textContent = String(i);
}
```

**Optimized** (`bm04-query-cache-optimized.html`):
```js
const el = document.getElementById('target');   // O(n) DOM walk × 1
for (let i = 0; i < n; i++) {
  el.textContent = String(i);
}
```

**Metrics**: `durationMs`
**n values**: 100, 500, 1 000, 5 000, 10 000 iterations
**Expected**: 2–5× speedup; scales with DOM tree size and browser optimization level

---

## BM-05: Bulk List Rendering — appendChild vs. DocumentFragment

**Hypothesis**: Calling `appendChild` n times triggers n layout invalidations and potentially n reflows. Inserting a `DocumentFragment` triggers exactly one.

**Baseline** (`bm05-list-render-baseline.html`):
```js
for (let i = 0; i < n; i++) {
  const li = document.createElement('li');
  li.textContent = `Item ${i}`;
  list.appendChild(li);  // triggers potential reflow each time
}
```

**Optimized** (`bm05-list-render-optimized.html`):
```js
const frag = document.createDocumentFragment();
for (let i = 0; i < n; i++) {
  const li = document.createElement('li');
  li.textContent = `Item ${i}`;
  frag.appendChild(li);  // off-screen
}
list.appendChild(frag);  // single reflow
```

**Metrics**: `durationMs`, fps during render
**n values**: 100, 500, 1 000, 5 000, 10 000 items
**Expected**: 3–10× speedup; most impactful at n ≥ 1 000
