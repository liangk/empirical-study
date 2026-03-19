# Experiment Design: BM02-BM06 Two-Dimensional Impact Studies

This document outlines the parameter grid experiments for BM02 through BM06, following the methodology established for BM-01.

---

## BM-02: File Descriptor Exhaustion

**Resource:** OS file descriptors (default ulimit ~1024)

**Failure modes:**
- EMFILE error when ulimit reached
- Memory accumulation from unclosed file handles
- Performance degradation as FD count increases

### Case 1: Leak Probability × Concurrency

**Question:** How do FD leaks interact with parallel file operations? At what concurrency does a small leak rate exhaust the ulimit?

**X-axis:** Leak Probability
- Values: 0%, 1%, 2%, 5%, 10%, 20%
- What it controls: Chance that `fh.close()` is skipped after `fs.promises.open()`

**Y-axis:** Concurrency
- Values: 1, 5, 10, 20, 50, 100
- What it controls: Number of file open operations happening in parallel

**Fixed parameters:**
- File size: 1 KB
- Simulation duration: 30 seconds
- ulimit: 1024 (simulated)
- Operation: read 1 byte

**Metrics:**
- Failure rate (% of operations that hit EMFILE)
- Time-to-EMFILE (when first EMFILE occurs)
- Leaked FDs count
- Throughput (successful operations/second)

**Expected findings:**
- Low concurrency + low leak = invisible problem (like BM-01)
- High concurrency + small leak = rapid EMFILE
- Amplification effect similar to connection pool case

---

### Case 2: File Size × FD Limit

**Question:** How does file size impact the severity of FD leaks? Do larger files cause OOM before EMFILE?

**X-axis:** File Size
- Values: 1 KB, 10 KB, 100 KB, 1 MB, 10 MB, 100 MB
- What it controls: Size of file being opened (affects memory per leaked FD)

**Y-axis:** FD Limit (ulimit)
- Values: 64, 128, 256, 512, 1024, 2048
- What it controls: Simulated OS file descriptor limit

**Fixed parameters:**
- Leak probability: 5%
- Concurrency: 20
- Simulation duration: 30 seconds
- Operation: read full file into buffer

**Metrics:**
- Time-to-EMFILE
- Time-to-OOM (if applicable)
- Memory per leaked FD
- Which limit hits first (EMFILE vs OOM)

**Expected findings:**
- Small files: EMFILE before OOM (FD limit dominates)
- Large files (10+ MB): OOM before EMFILE (memory limit dominates)
- Higher ulimit delays EMFILE but increases OOM risk for large files

---

### Case 3: Error Rate × Leak-on-Error

**Question:** Do file operation errors leak FDs when `try/finally` is missing?

**X-axis:** Error Rate
- Values: 0%, 1%, 5%, 10%, 15%, 20%, 30%
- What it controls: Chance that file read throws an error

**Y-axis:** Leak-on-Error Behavior
- Values (8 combinations):
  - `cleanup + 0% leak` (try/finally, no base leak)
  - `cleanup + 2% leak` (try/finally, but 2% base leak)
  - `cleanup + 5% leak`
  - `cleanup + 10% leak`
  - `no-cleanup + 0% leak` (errors leak, no base leak)
  - `no-cleanup + 2% leak`
  - `no-cleanup + 5% leak`
  - `no-cleanup + 10% leak`

**Fixed parameters:**
- Concurrency: 20
- File size: 1 KB
- ulimit: 1024
- Simulation duration: 30 seconds

**Metrics:**
- Leaked FDs count
- Failure rate
- Time-to-EMFILE
- Throughput

**Expected findings:**
- With cleanup: error rate doesn't cause FD leaks
- Without cleanup: error amplification (1% error → 68%+ failure like BM-01 case 4)
- Demonstrates critical importance of try/finally with fh.close()

---

## BM-03: Stream Leak (FD + Memory)

**Resource:** Read/write streams (combine FD + memory leak)

**Failure modes:**
- EMFILE from unclosed stream FDs
- Memory accumulation from buffered data
- Handle leak warnings

### Case 1: Leak Probability × Concurrency

**Question:** How do stream leaks scale with parallel stream operations?

**X-axis:** Leak Probability
- Values: 0%, 1%, 2%, 5%, 10%, 20%
- What it controls: Chance that `stream.destroy()` is skipped

**Y-axis:** Concurrency
- Values: 1, 5, 10, 20, 50, 100
- What it controls: Number of streams opened in parallel

**Fixed parameters:**
- File size: 10 KB
- Stream chunk size: 1 KB
- Simulation duration: 30 seconds
- ulimit: 1024

**Metrics:**
- Leaked FD count
- Leaked memory (heap growth)
- Failure rate
- Time-to-EMFILE
- Active handle count

**Expected findings:**
- Dual failure mode: FD exhaustion OR memory exhaustion
- High concurrency amplifies both leak vectors

---

### Case 2: File Size × Leak Probability

**Question:** Do larger files make stream leaks more severe due to buffering?

**X-axis:** File Size
- Values: 1 KB, 10 KB, 100 KB, 1 MB, 10 MB, 50 MB
- What it controls: Size of file being streamed

**Y-axis:** Leak Probability
- Values: 0%, 1%, 2%, 5%, 10%, 20%

**Fixed parameters:**
- Concurrency: 20
- Chunk size: 64 KB
- Simulation duration: 30 seconds
- ulimit: 1024

**Metrics:**
- Memory per leaked stream
- Time-to-OOM
- Time-to-EMFILE
- Which limit hits first

**Expected findings:**
- Small files: FD limit dominates (like BM-02)
- Large files: memory limit dominates
- Stream buffering amplifies memory impact compared to simple file open

---

### Case 3: Error Rate × Leak-on-Error

**Question:** Do stream errors leak if `error` event handler doesn't call `destroy()`?

**X-axis:** Error Rate
- Values: 0%, 1%, 5%, 10%, 15%, 20%, 30%
- What it controls: Chance that stream emits 'error' event

**Y-axis:** Error Handling Behavior
- Values (8 combinations):
  - `destroy-on-error + 0% leak`
  - `destroy-on-error + 5% leak`
  - `destroy-on-error + 10% leak`
  - `destroy-on-error + 20% leak`
  - `no-destroy-on-error + 0% leak`
  - `no-destroy-on-error + 5% leak`
  - `no-destroy-on-error + 10% leak`
  - `no-destroy-on-error + 20% leak`

**Fixed parameters:**
- File size: 10 KB
- Concurrency: 20
- Simulation duration: 30 seconds

**Metrics:**
- Leaked FDs
- Leaked memory
- Failure rate
- Throughput

**Expected findings:**
- Without `stream.on('error', () => stream.destroy())`: error amplification
- Demonstrates importance of error + end + close event handlers

---

## BM-04: HTTP Socket Leak

**Resource:** Outgoing HTTP request sockets

**Failure modes:**
- Socket exhaustion (ECONNRESET, connection refused)
- Memory from undestroyed request objects
- Timeout accumulation

### Case 1: Leak Probability × Concurrency

**Question:** How do socket leaks scale with parallel HTTP requests?

**X-axis:** Leak Probability
- Values: 0%, 1%, 2%, 5%, 10%, 20%
- What it controls: Chance that `req.destroy()` is skipped

**Y-axis:** Concurrency
- Values: 1, 5, 10, 20, 50, 100
- What it controls: Number of parallel HTTP requests

**Fixed parameters:**
- Response size: 1 KB
- Request timeout: 5000 ms
- Simulation duration: 30 seconds
- Server: local loopback on port 19876

**Metrics:**
- Leaked socket count
- Failure rate (ECONNRESET, timeout)
- Throughput
- Active handle count

**Expected findings:**
- Similar amplification to BM-01 connection pool case
- High concurrency + small leak = cascading socket failures

---

### Case 2: Timeout Duration × Concurrency

**Question:** How do timeouts interact with concurrency when sockets aren't destroyed?

**X-axis:** Timeout Duration
- Values: 100ms, 500ms, 1000ms, 2000ms, 5000ms, 10000ms
- What it controls: `req.setTimeout()` value

**Y-axis:** Concurrency
- Values: 1, 5, 10, 20, 50, 100

**Fixed parameters:**
- Leak probability: 5% (on timeout, `req.destroy()` skipped)
- Response delay: 50ms (server artificial delay)
- Simulation duration: 30 seconds

**Metrics:**
- p95 latency
- Timeout count
- Leaked socket count
- Throughput

**Expected findings:**
- Long timeout + high concurrency = latency spike (similar to BM-01 case 3)
- Short timeout = fail-fast with lower latency
- Timeout doesn't prevent leaks, only changes when failures occur

---

### Case 3: Error Rate × Leak-on-Error

**Question:** Do HTTP errors leak sockets when error handler doesn't destroy?

**X-axis:** Error Rate
- Values: 0%, 1%, 5%, 10%, 15%, 20%, 30%
- What it controls: Chance that server returns 500 error

**Y-axis:** Error Handling
- Values (8 combinations):
  - `destroy-on-error + 0% leak`
  - `destroy-on-error + 5% leak`
  - `destroy-on-error + 10% leak`
  - `destroy-on-error + 20% leak`
  - `no-destroy-on-error + 0% leak`
  - `no-destroy-on-error + 5% leak`
  - `no-destroy-on-error + 10% leak`
  - `no-destroy-on-error + 20% leak`

**Fixed parameters:**
- Concurrency: 20
- Timeout: 5000ms
- Simulation duration: 30 seconds

**Metrics:**
- Leaked socket count
- Failure rate
- Throughput
- Time-to-socket-exhaustion

**Expected findings:**
- Without `req.on('error', () => req.destroy())`: error amplification
- Critical for production APIs that call unreliable external services

---

## BM-05: Timer Leak

**Resource:** setInterval/setTimeout timers + closure memory

**Failure modes:**
- Memory accumulation from captured closures
- CPU overhead from active timers
- Event loop saturation

### Case 1: Leak Probability × Concurrency

**Question:** How do timer leaks scale with parallel timer creation?

**X-axis:** Leak Probability
- Values: 0%, 1%, 2%, 5%, 10%, 20%
- What it controls: Chance that `clearInterval()` is skipped

**Y-axis:** Concurrency
- Values: 1, 5, 10, 20, 50, 100
- What it controls: Timers created per second

**Fixed parameters:**
- Closure size: 4 KB
- Timer interval: 1000ms
- Simulation duration: 30 seconds

**Metrics:**
- Active timer count
- Heap growth
- CPU utilization (simulated by tracking timer fire count)
- Memory per leaked timer

**Expected findings:**
- Memory grows linearly with leaked timer count
- Active timers consume CPU even if closure is small
- No hard failure threshold (unlike FD/connection limits)

---

### Case 2: Closure Size × Leak Probability

**Question:** How does captured closure size amplify timer leak memory impact?

**X-axis:** Closure Size
- Values: 0 bytes, 1 KB, 4 KB, 16 KB, 64 KB, 256 KB, 1 MB
- What it controls: Size of buffer captured in timer callback closure

**Y-axis:** Leak Probability
- Values: 0%, 1%, 2%, 5%, 10%, 20%

**Fixed parameters:**
- Concurrency: 20
- Timer interval: 1000ms
- Simulation duration: 30 seconds

**Metrics:**
- Heap growth rate (bytes/second)
- Memory per leaked timer
- Time-to-OOM (if heap limit exceeded)

**Expected findings:**
- Large closures + high leak rate = rapid OOM
- Even small (1 KB) closures accumulate to MB over time
- Demonstrates why capturing large objects in timer callbacks is dangerous

---

### Case 3: Timer Interval × Concurrency

**Question:** Do short-interval timers cause CPU saturation when leaked?

**X-axis:** Timer Interval
- Values: 1ms, 10ms, 50ms, 100ms, 500ms, 1000ms, 5000ms
- What it controls: Delay between timer callback executions

**Y-axis:** Concurrency
- Values: 1, 5, 10, 20, 50, 100
- What it controls: Number of leaked timers

**Fixed parameters:**
- Leak probability: 100% (all timers leaked for this test)
- Closure size: 1 KB
- Simulation duration: 30 seconds

**Metrics:**
- Timer fire count (CPU proxy)
- Event loop delay
- Throughput (concurrent operations degradation)

**Expected findings:**
- Short interval (1-10ms) + many timers = event loop saturation
- Long interval (1000ms+) = mainly memory problem, not CPU
- Demonstrates two failure modes: memory (closure) + CPU (active timers)

---

## BM-06: Event Listener Leak

**Resource:** EventEmitter listeners + closure memory

**Failure modes:**
- MaxListenersExceededWarning (default 10 listeners per event)
- Memory accumulation from captured closures
- Emit performance degradation (O(n) listener iteration)

### Case 1: Leak Probability × Listener Count

**Question:** When do listener leaks trigger MaxListenersExceededWarning? How does it scale past the warning?

**X-axis:** Leak Probability
- Values: 0%, 1%, 5%, 10%, 20%, 50%, 100%
- What it controls: Chance that `emitter.off()` is skipped

**Y-axis:** Target Listener Count
- Values: 5, 10, 20, 50, 100, 200
- What it controls: How many listeners to attempt to add

**Fixed parameters:**
- Closure size: 4 KB
- Event emit frequency: 10 Hz (100ms interval)
- Simulation duration: 30 seconds
- Single emitter instance

**Metrics:**
- Active listener count
- Iteration when MaxListenersExceededWarning occurs (default: 11)
- Heap growth
- Event emit latency (as listener count increases)

**Expected findings:**
- Warning at 11 listeners (configurable via `setMaxListeners`)
- Warning doesn't prevent further leaks — just logs
- Emit performance degrades linearly with listener count

---

### Case 2: Closure Size × Leak Probability

**Question:** How does listener closure size impact memory accumulation?

**X-axis:** Closure Size
- Values: 0 bytes, 1 KB, 4 KB, 16 KB, 64 KB, 256 KB, 1 MB
- What it controls: Size of buffer captured in listener callback

**Y-axis:** Leak Probability
- Values: 0%, 1%, 2%, 5%, 10%, 20%

**Fixed parameters:**
- Listener addition rate: 20/second
- Event emit frequency: 10 Hz
- Simulation duration: 30 seconds

**Metrics:**
- Heap growth rate
- Memory per leaked listener
- Time-to-OOM

**Expected findings:**
- Similar to BM-05 case 2 (timer closures)
- Large closures in listeners = rapid memory growth
- Common in React/Vue apps with component listeners capturing state

---

### Case 3: Event Frequency × Listener Count

**Question:** Do high-frequency events cause CPU saturation with many listeners?

**X-axis:** Event Emit Frequency
- Values: 1 Hz, 10 Hz, 50 Hz, 100 Hz, 500 Hz, 1000 Hz
- What it controls: How often `emitter.emit('event')` is called

**Y-axis:** Listener Count
- Values: 1, 10, 50, 100, 500, 1000
- What it controls: Number of leaked listeners (100% leak rate for this test)

**Fixed parameters:**
- Closure size: 1 KB
- Simulation duration: 30 seconds
- Single emitter instance

**Metrics:**
- Total listener callback invocations (frequency × count × duration)
- Event loop delay
- Emit latency (time to notify all listeners)
- CPU utilization proxy

**Expected findings:**
- High frequency (500+ Hz) + many listeners (100+) = event loop saturation
- Emit is O(n) where n = listener count
- Common in real-time apps (WebSocket message broadcasts, metrics emitters)

---

## Summary: Experiment Case Matrix (Final Implemented)

| Module | Cases | Case 1 | Case 2 | Case 3 | Case 4 | Case 5 |
|--------|-------|--------|--------|--------|--------|--------|
| **BM-01** | 5 | Leak Prob × Concurrency | Query Time × Pool Size | Burst × Timeout | Error Rate × Leak-on-Error | Leak Prob × DB Max Conns |
| **BM-02** | 4 | Leak Prob × Concurrency | File Size × FD Limit | Error Rate × Leak-on-Error | Open Rate × FD Limit | — |
| **BM-03** | 4 | Leak Prob × Concurrency | File Size × Leak Prob | Error Rate × Error Handling | Stream Type × Leak Prob | — |
| **BM-04** | 5 | Leak Prob × Concurrency | Timeout × Concurrency | Error Rate × Error Handling | Response Size × Concurrency | Keep-Alive × Leak Prob |
| **BM-05** | 4 | Leak Prob × Creation Rate | Closure Size × Leak Prob | Timer Interval × Creation Rate | Timer Type × Leak Prob | — |
| **BM-06** | 5 | Leak Prob × Listener Count | Closure Size × Leak Prob | Event Freq × Listener Count | Emitter Count × Listeners | once vs on × Leak Rate |

**Total: 27 experiment cases** across 6 modules

**Rationale for case count differences:**
- **BM-02 (4):** Added Case 4 (Open Rate × FD Limit) to distinguish throughput-based vs concurrency-based exhaustion
- **BM-03 (4):** Added Case 4 (Stream Type) because ReadStream/WriteStream/Transform have different buffering semantics, changing the OOM timeline
- **BM-04 (5):** Added Case 4 (Response Size) and Case 5 (Keep-Alive) — both fundamentally change socket lifecycle; keep-alive is the dominant production pattern and deserves dedicated measurement
- **BM-05 (4):** Added Case 4 (setTimeout vs setInterval) — the two timer types have completely different auto-cleanup semantics; setTimeout self-removes, setInterval does not
- **BM-06 (5):** Added Case 4 (Emitter Count) for the cross-component pattern, and Case 5 (once vs on) since once() auto-removes listeners, making its leak behavior structurally different

**Common patterns across modules:**
- **Case 1** for all modules: Leak Probability × Concurrency/Rate — fundamental scaling relationship
- **Case 3** for BM02-04: Error Rate × Cleanup Behavior — importance of try/finally and error handlers
- **Case 2** for BM05-06: Closure Size × Leak Probability — memory impact of captured closures

---

## Implementation Notes

### Simulator Requirements

Each module needs a lightweight discrete-event simulator similar to `pool-simulator.ts`:

- **BM-02:** `fd-simulator.ts` — track open FD count, simulate EMFILE at limit
- **BM-03:** `stream-simulator.ts` — track FD + buffered memory, dual limits
- **BM-04:** `socket-simulator.ts` — track active sockets, simulate connection failures
- **BM-05:** `timer-simulator.ts` — track active timers + memory, simulate event loop delay
- **BM-06:** `listener-simulator.ts` — track listeners per emitter, simulate emit latency

### Metrics Standardization

All simulators should return:
```typescript
interface SimulationResult {
  // Universal metrics
  failureRate: number;           // 0-1
  throughput: number;            // operations/second
  
  // Resource-specific
  leakedResources: number;       // FDs, sockets, timers, listeners
  timeToExhaustion: number | null; // ms, or null if never exhausted
  
  // Performance metrics
  meanLatencyMs?: number;
  p95LatencyMs?: number;
  
  // Memory metrics (BM-03, BM-05, BM-06)
  heapGrowthBytes?: number;
  memoryPerLeakedResource?: number;
  
  // Module-specific
  [key: string]: any;
}
```

### Output Format

Results JSON structure:
```typescript
interface ExperimentResult {
  caseId: string;              // "bm02-case1"
  caseName: string;            // "Leak Probability × Concurrency"
  module: string;              // "BM-02"
  xAxisName: string;
  yAxisName: string;
  tables: {
    [metricName: string]: {
      unit: string;
      data: Record<string, any>[];
    };
  };
  timestamp: string;
}
```

All results saved to `results/experiments-bm0X-<timestamp>.json` for each module.
