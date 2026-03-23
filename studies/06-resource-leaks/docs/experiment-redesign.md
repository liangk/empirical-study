# Study 06: Experiment Redesign

## Why a redesign was needed

The original `src/step1-benchmarks/experiments/` suite was good for Step 1 blog content, but it was uneven for Step 2 scaling analysis.

BM-01 through BM-04 already produced clean hard-threshold outcomes:
- pool exhaustion
- EMFILE / FD exhaustion
- stream exhaustion
- socket exhaustion

BM-05 and BM-06 were weaker for scaling because many scenarios only showed gradual degradation, not a finite `timeToExhaustion`:
- BM-05 timer leaks often produced heap growth and callback amplification without hitting OOM in 30 seconds
- BM-06 listener leaks often produced warnings and linear emit slowdown without a hard crash

That made the Step 2 article too broad if we claimed universal time-to-failure math across all six benchmark families.

The redesigned suite in `src/step1-benchmarks/experiments-redisign/` fixes this by making every benchmark produce either:
- a hard resource exhaustion threshold, or
- an explicit operational failure threshold

---

## Redesign goals

1. Keep BM-01 through BM-04 compatible with the existing table JSON shape
2. Preserve comparable case structure across BM-01 through BM-06
3. Make BM-05 and BM-06 produce meaningful finite `timeToExhaustion` values when the system crosses an operational failure boundary
4. Keep the output format compatible with `src/step2-scaling/fit-curves.ts`
5. Make the redesigned suite runnable independently from the original one

---

## Folder layout

The redesigned experiment suite lives in:

`src/step1-benchmarks/experiments-redisign/`

It contains:
- `types.ts`
- `runner-utils.ts`
- shared simulators
- `run-experiments-bm01.ts` through `run-experiments-bm06.ts`
- case files under `bm01/` through `bm06/`

The old suite remains untouched in `experiments/` for backward comparison.

---

## What changed by benchmark

## BM-01 to BM-04

### Status
These modules did not need conceptual redesign.

### Reason
They already model hard resource ceilings well:
- BM-01: connection pool exhaustion
- BM-02: file descriptor exhaustion
- BM-03: stream + FD/heap exhaustion
- BM-04: socket exhaustion / timeout-driven collapse

### Changes made
- copied into `experiments-redisign/`
- made runnable via redesigned runner entrypoints
- kept JSON output shape compatible with scaling

---

## BM-05: Timer leaks

### Original problem
The original BM-05 mostly measured:
- leaked timer count
- heap growth
- callback invocations

But many grids never hit OOM during the 30 second window, so `timeToExhaustion` stayed `null`/`Infinity`. That is analytically useful, but weak for a Step 2 article framed as outage prediction.

### Redesign
The redesigned timer simulator adds an explicit operational failure threshold:
- **heap exhaustion** when `heapGrowthBytes >= maxHeapBytes`
- **event-loop saturation** when simulated `meanLatencyMs >= maxMeanLatencyMs`

### New failure interpretation
A timer leak is now treated as exhausted when either:
- memory is exhausted, or
- timer callback amplification pushes the event loop into unacceptable latency

### Why this is better
This matches production reality better:
- many timer leaks do not crash immediately
- they first become an outage because latency becomes unacceptable

### Thresholds used
- `maxHeapBytes`: configured per experiment family
- `maxMeanLatencyMs`: default `50ms`

### Effect on scaling
BM-05 now yields finite `timeToExhaustion` for high-rate / short-interval timer scenarios that previously only showed degradation.

---

## BM-06: Listener leaks

### Original problem
The original BM-06 treated `MaxListenersExceededWarning` as a signal, but many scenarios still had no clean exhaustion boundary.

### Redesign
The redesigned listener simulator adds operational failure thresholds:
- **heap exhaustion** when listener closure memory exceeds `maxHeapBytes`
- **listener threshold breach** when an emitter exceeds `maxListenersPerEmitter`
- **emit-latency saturation** when `meanEmitLatencyMs >= maxMeanEmitLatencyMs`

### New failure interpretation
A listener leak is now treated as operationally exhausted when any of these are true:
- too many listeners on a single emitter
- emit latency becomes operationally significant
- heap pressure crosses the configured limit

### Thresholds used
- `maxListenersPerEmitter`: benchmark-configurable
- `maxHeapBytes`: benchmark-configurable
- `maxMeanEmitLatencyMs`: default `30ms`

### Why this is better
Listener leaks usually kill systems by degradation first, crash second. The redesign captures both.

---

## Output compatibility

The redesigned runners write the same high-level JSON structure as the original suite:
- array of case objects
- per-case `tables`
- numeric metric grids keyed by X and Y labels

This is why `fit-curves.ts` can consume redesign output without a schema rewrite.

---

## Scaling updates

`src/step2-scaling/fit-curves.ts` was updated to:
- support `--source classic`
- support `--source redesign`
- automatically prefer `experiments-redisign` when present
- emit result filenames as `scaling-classic-*.json` or `scaling-redesign-*.json`

This makes it easy to compare old and redesigned scaling results.

---

## Recommended usage

### Run redesigned experiments

```bash
npm run experiments:redesign:bm01
npm run experiments:redesign:bm02
npm run experiments:redesign:bm03
npm run experiments:redesign:bm04
npm run experiments:redesign:bm05
npm run experiments:redesign:bm06
```

### Run redesigned scaling

```bash
npm run scaling:redesign
```

### Force classic scaling

```bash
npm run scaling -- --source classic
```

---

## Publication impact

### After redesign, stronger Step 2 claims are possible

- BM-01 to BM-04 remain the best hard-ceiling outage predictors
- BM-05 and BM-06 now provide operational-failure time instead of only soft degradation curves

### Still important caveat
BM-05 and BM-06 remain different in nature from BM-01/BM-02:
- their exhaustion is often **service-level degradation first**
- not necessarily immediate process death

So the strongest wording for publication is still:
- **hard resource leaks produce hard TTF cliffs**
- **timer and listener leaks produce operational failure thresholds that can also be modeled as TTF once the threshold is defined**

---

## Next follow-up

After running the redesigned suite:
1. compare classic vs redesign scaling outputs
2. validate BM-05/BM-06 now show enough finite `timeToExhaustion` cells
3. decide whether Step 2 publication should cover all six benchmarks or be split into:
   - hard-ceiling leaks
   - degradation-driven leaks
