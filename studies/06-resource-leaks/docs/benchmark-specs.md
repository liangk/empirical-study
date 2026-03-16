# Study 06: Benchmark Specifications

## Overview

Six benchmark modules measuring resource leak impact. Each module compares a **leaky** pattern (no cleanup) against a **proper** pattern (correct cleanup). The primary metric is resource accumulation rate and time-to-failure, not speedup ratio.

---

## BM-01: Database Connection Pool Exhaustion

### Hypothesis
H1: Unclosed database connections exhaust the connection pool within 100 iterations, causing subsequent queries to hang or timeout.

### Setup
- PostgreSQL local instance, connection pool size = 10 (default `pg` pool).
- Each iteration: open a connection via `createConnection()` or `pool.connect()`, execute a trivial `SELECT 1`, do NOT release.

### Leaky Pattern
```typescript
async function handleRequest() {
  const client = await pool.connect();
  const result = await client.query('SELECT 1');
  // Missing: client.release()
  return result;
}
```

### Proper Pattern
```typescript
async function handleRequest() {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT 1');
    return result;
  } finally {
    client.release();
  }
}
```

### Metrics
- Active connections per iteration (`pool.totalCount`, `pool.idleCount`, `pool.waitingCount`)
- Iteration at which pool timeout occurs
- Memory (heapUsed) per iteration

### n Values
10, 50, 100, 500, 1000 iterations

---

## BM-02: File Descriptor Exhaustion (EMFILE)

### Hypothesis
H2: Unclosed file handles via `fs.promises.open()` exhaust the OS file descriptor limit, producing EMFILE within ~1000 iterations on default ulimit.

### Setup
- Create a temporary 1KB test file.
- Each iteration: open the file, read a byte, do NOT close.

### Leaky Pattern
```typescript
async function readByte() {
  const fh = await fs.promises.open(testFile, 'r');
  const buf = Buffer.alloc(1);
  await fh.read(buf, 0, 1, 0);
  // Missing: await fh.close()
  return buf[0];
}
```

### Proper Pattern
```typescript
async function readByte() {
  const fh = await fs.promises.open(testFile, 'r');
  try {
    const buf = Buffer.alloc(1);
    await fh.read(buf, 0, 1, 0);
    return buf[0];
  } finally {
    await fh.close();
  }
}
```

### Metrics
- Open FD count per iteration (via `process._getActiveHandles()` or `/proc/self/fd` on Linux)
- Iteration at EMFILE error
- heapUsed per iteration

### n Values
10, 50, 100, 500, 1000

---

## BM-03: Stream Leak on Error Path

### Hypothesis
H3: A `createReadStream` that encounters an error without `stream.destroy()` leaks the file descriptor and accumulates memory at ≥1KB per iteration.

### Setup
- Create a readable stream, simulate an error mid-read (e.g., read from a file that gets deleted, or force an error event).
- Baseline: no error handler / no destroy.
- Optimized: `stream.on('error', () => stream.destroy())`.

### Leaky Pattern
```typescript
function processFile(path: string) {
  const stream = fs.createReadStream(path);
  stream.on('data', (chunk) => { /* process */ });
  // Missing: stream.on('error', ...) and stream.destroy()
}
```

### Proper Pattern
```typescript
function processFile(path: string) {
  const stream = fs.createReadStream(path);
  stream.on('data', (chunk) => { /* process */ });
  stream.on('error', () => stream.destroy());
  stream.on('end', () => stream.destroy());
}
```

### Metrics
- Active handle count per iteration
- heapUsed growth per iteration
- FD count per iteration

### n Values
10, 50, 100, 500, 1000

---

## BM-04: HTTP Socket Leak

### Hypothesis
H4: Outgoing `http.request()` calls without `req.destroy()` on timeout/error accumulate sockets, causing ECONNRESET or socket hang-up within 500 iterations.

### Setup
- Local HTTP server on loopback.
- Each iteration: send `http.request()`, read response, do NOT destroy on timeout.

### Leaky Pattern
```typescript
function fetchData(url: string): Promise<string> {
  return new Promise((resolve) => {
    const req = http.request(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => {}); // swallow error, no cleanup
    // Missing: req.setTimeout(5000, () => req.destroy())
    req.end();
  });
}
```

### Proper Pattern
```typescript
function fetchData(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.request(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', (err) => { req.destroy(); reject(err); });
    req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}
```

### Metrics
- Active socket count per iteration
- Active handle count
- heapUsed per iteration

### n Values
10, 50, 100, 500, 1000

---

## BM-05: Timer/Interval Leak

### Hypothesis
H5: `setInterval` without `clearInterval` accumulates timer references, growing heap at a measurable rate per iteration. 1000 leaked intervals consume ≥5MB.

### Setup
- Each iteration: create a `setInterval(fn, 1000)` that captures a 4KB buffer in its closure.
- Baseline: never clear.
- Optimized: `clearInterval` after use.

### Leaky Pattern
```typescript
function startPolling() {
  const buffer = Buffer.alloc(4096); // 4KB captured in closure
  setInterval(() => {
    processBuffer(buffer);
  }, 1000);
  // Missing: clearInterval — timer runs forever, buffer never GC'd
}
```

### Proper Pattern
```typescript
function startPolling() {
  const buffer = Buffer.alloc(4096);
  const id = setInterval(() => {
    processBuffer(buffer);
  }, 1000);
  // Cleanup after use
  setTimeout(() => clearInterval(id), 100);
}
```

### Metrics
- heapUsed per iteration (primary)
- Active timer count via `process._getActiveHandles().filter(h => h.constructor.name === 'Timeout').length`
- RSS per iteration

### n Values
10, 50, 100, 500, 1000

---

## BM-06: Event Listener Accumulation

### Hypothesis
H6: Adding `emitter.on()` listeners without corresponding `removeListener` triggers MaxListenersExceededWarning at 11 listeners and grows heap linearly. 1000 leaked listeners with 4KB closures consume ≥4MB.

### Setup
- Shared `EventEmitter` instance.
- Each iteration: attach a listener with a 4KB closure.
- Baseline: never remove.
- Optimized: remove after use.

### Leaky Pattern
```typescript
const emitter = new EventEmitter();
function subscribe() {
  const buffer = Buffer.alloc(4096);
  emitter.on('data', () => {
    processBuffer(buffer);
  });
  // Missing: emitter.removeListener / emitter.off
}
```

### Proper Pattern
```typescript
const emitter = new EventEmitter();
function subscribe() {
  const buffer = Buffer.alloc(4096);
  const handler = () => { processBuffer(buffer); };
  emitter.on('data', handler);
  // Cleanup
  setTimeout(() => emitter.off('data', handler), 100);
}
```

### Metrics
- `emitter.listenerCount('data')` per iteration
- heapUsed per iteration
- MaxListenersExceededWarning occurrence iteration

### n Values
10, 50, 100, 500, 1000

---

## Summary Table

| Module | Resource | Leak Rate Metric | Failure Threshold |
|--------|----------|-----------------|-------------------|
| BM-01 | DB connections | connections/iteration | Pool size (default 10) |
| BM-02 | File descriptors | FDs/iteration | OS ulimit (default ~1024) |
| BM-03 | Streams + FDs | handles/iteration + bytes/iteration | EMFILE or OOM |
| BM-04 | HTTP sockets | sockets/iteration | Socket limit or ECONNRESET |
| BM-05 | Timers + memory | bytes/iteration | OOM (heap limit) |
| BM-06 | Listeners + memory | listeners/iteration + bytes/iteration | MaxListenersExceeded + OOM |
