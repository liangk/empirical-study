# Array Size Calibration Guide

## Purpose

Determine optimal component data sizes for memory leak benchmarks based on:
1. **Signal clarity** - separation between BAD and GOOD variants
2. **Rate measurement** - MB/min growth stability
3. **Budget framing** - time-to-threshold under constrained environments

## Running Calibration

```bash
npm run bench:calibrate
```

This tests 5 array sizes (500, 1000, 2500, 5000, 10000) with 50 cycles each.

## Output

Generates `results/calibration-{timestamp}.json` with:
- Raw results for each size × variant combination
- Signal-to-noise ratio (SNR) calculations
- Three recommended sizes: minimal, moderate, aggressive

## Interpreting Results

### Signal-to-Noise Ratio (SNR)
```
SNR = |BAD growth - GOOD growth| / |GOOD growth|
```

- **SNR > 2**: Minimal acceptable separation
- **SNR > 3**: Good separation for reliable measurement
- **SNR > 5**: Excellent clarity for formal studies

### Growth Rate
Target range: **0.5 - 5 MB/min**
- Too low: noise dominates signal
- Too high: unrealistic for typical app scenarios

## Recommendations

### Minimal (Quick Tests)
Lowest size with SNR > 2. Use for:
- Rapid iteration during scenario development
- Smoke tests before formal runs
- Resource-constrained CI environments

### Moderate (Standard Runs)
Balanced SNR and realistic growth rate. Use for:
- Standard benchmark runs
- Comparative studies across frameworks
- Publication-ready results

### Aggressive (Maximum Clarity)
Highest SNR tested. Use for:
- Formal research studies
- When maximum signal clarity is critical
- Demonstrating worst-case scenarios

## Example Output

```
=== Calibration Results ===

Recommendations:
  Minimal:   1000 - Lowest size with SNR > 2 (2.34), suitable for quick tests
  Moderate:  2500 - Balanced SNR (3.87) and growth rate (1.23 MB/min)
  Aggressive: 5000 - Highest SNR (6.12), clearest signal for formal studies

Analysis Notes:
  - Tested 5 array sizes with 50 cycles each
  - Signal-to-Noise ratios range from 1.23 to 6.12
  - Growth rates range from 0.234 to 4.567 MB/min
```

## Applying Results

After calibration, update scenario files:

```typescript
// Before calibration
private data: number[] = new Array(2500).fill(0).map(() => Math.random());

// After calibration (example: moderate = 3500)
private data: number[] = new Array(3500).fill(0).map(() => Math.random());
```

## Notes

- Run calibration on representative hardware (not just dev machines)
- Re-calibrate if:
  - Benchmark methodology changes significantly
  - Target environments change (e.g., mobile vs desktop)
  - Node.js version changes materially
- Consider running calibration with different `--max-old-space-size` values to simulate constrained environments
