# Study 07: Benchmark Specifications

## BM-01: lodash — Full Default Import vs. Named Import (lodash-es)

**Hypothesis:** `import _ from 'lodash'` ships the entire lodash bundle (~25 KB gzipped) regardless
of how many functions are used. Named imports from `lodash-es` allow tree-shaking to include only
the referenced functions.

| Configuration | Entry point |
|---|---|
| Baseline (anti-pattern) | `import _ from 'lodash'; export const fn = () => _.debounce(() => {}, 300);` |
| Optimized | `import { debounce } from 'lodash-es'; export const fn = () => debounce(() => {}, 300);` |

**Expected:** Baseline ~25 KB gzipped; optimized ~2–3 KB gzipped (debounce + deps only).

---

## BM-02: moment.js — Full Import vs. dayjs

**Hypothesis:** `moment` is a non-tree-shakeable monolith (~67 KB gzipped including locale data).
`dayjs` provides a compatible API at ~2 KB gzipped.

| Configuration | Entry point |
|---|---|
| Baseline (anti-pattern) | `import moment from 'moment'; export const fn = () => moment().format('YYYY-MM-DD');` |
| Optimized (dayjs) | `import dayjs from 'dayjs'; export const fn = () => dayjs().format('YYYY-MM-DD');` |
| Optimized (date-fns) | `import { format } from 'date-fns'; export const fn = () => format(new Date(), 'yyyy-MM-dd');` |

**Expected:** moment ~67 KB gzipped; dayjs ~2 KB; date-fns ~3 KB (format only, tree-shaken).

---

## BM-03: @mui/material — Barrel Import vs. Direct Path

**Hypothesis:** `import { Button, TextField, Box } from '@mui/material'` pulls the full barrel
and may prevent tree-shaking depending on bundler configuration. Direct path imports
`import Button from '@mui/material/Button'` are always safe.

| Configuration | Entry point |
|---|---|
| Baseline (anti-pattern) | `import { Button, TextField, Box } from '@mui/material'; export { Button, TextField, Box };` |
| Optimized | `import Button from '@mui/material/Button'; import TextField from '@mui/material/TextField'; import Box from '@mui/material/Box'; export { Button, TextField, Box };` |

**Expected:** Baseline 50–150 KB gzipped depending on bundler sideEffects config; optimized
similar if bundler handles MUI ESM correctly, but direct imports are always safe.

**Note:** MUI v5+ with proper ESM + sideEffects:false configured may tree-shake barrel imports.
The benchmark measures the worst-case (no sideEffects config).

---

## BM-04: antd — Barrel Import vs. Deep Import

**Hypothesis:** `import { Button } from 'antd'` without `babel-plugin-import` loads the full antd
bundle (~350 KB gzipped). Deep imports `import Button from 'antd/lib/button'` load only the
component and its dependencies.

| Configuration | Entry point |
|---|---|
| Baseline (anti-pattern) | `import { Button } from 'antd'; export { Button };` |
| Optimized | `import Button from 'antd/es/button'; export { Button };` |

**Expected:** Baseline ~350 KB gzipped; optimized ~30–50 KB gzipped (button + deps only).

---

## BM-05: react-icons — Namespace Import vs. Named Import

**Hypothesis:** `import * as Icons from 'react-icons/fa'` imports all Font Awesome icons (~600+
SVG components). Specific named imports `import { FaHome } from 'react-icons/fa'` should
tree-shake to a single icon if the bundler supports it.

| Configuration | Entry point |
|---|---|
| Baseline (anti-pattern) | `import * as Icons from 'react-icons/fa'; export const icon = Icons.FaHome;` |
| Optimized | `import { FaHome } from 'react-icons/fa'; export const icon = FaHome;` |

**Expected:** Baseline ~800 KB raw (all icons); optimized ~2–5 KB raw (one icon).

---

## Benchmark Runner Protocol

All modules use the same runner in `src/step1-benchmarks/run-all.ts`:

1. For each module, define `baseline` and `optimized` fixture paths
2. Install the required packages locally in a temp dir (if not present)
3. Run `esbuild <entry> --bundle --minify --platform=browser --format=esm` for each fixture
4. Capture output file size (raw bytes) and gzip-compressed size
5. Calculate `sizeRatio = baseline.gzipSize / optimized.gzipSize`
6. Calculate `savings = baseline.gzipSize - optimized.gzipSize`
7. Write results to `results/bench-<timestamp>.json`

### Output Schema

```typescript
interface BenchmarkResult {
  module: string;           // e.g. "BM-01"
  library: string;          // e.g. "lodash"
  baseline: BundleMetrics;
  optimized: BundleMetrics;
  sizeRatio: number;        // baseline.gzipSize / optimized.gzipSize
  savingsKB: number;        // (baseline.gzipSize - optimized.gzipSize) / 1024
}

interface BundleMetrics {
  label: string;            // e.g. "import _ from 'lodash'"
  rawBytes: number;
  gzipBytes: number;
}
```
