# Benchmark: what a blocking call in a handler does to every other request

Two true positives from the labelled sample, as their projects wrote them
(`handlers.js`), each behind a minimal HTTP server (`server.js`):

- **Next.js `decryptWithSecret`** (`packages/next/src/server/crypto-utils.ts`
  at `e0668e4`): `pbkdf2Sync`, 100,000 iterations of SHA-512, run on every
  request served in Preview Mode (`tryGetPreviewData`). Label L327.
- **Redwood dbAuth `hashPassword`**
  (`packages/auth-providers/dbAuth/api/src/shared.ts` at `a7852fb`):
  `scryptSync` at N=2^14, r=8, p=1, run on every login, signup and password
  reset. Labels L334, L551.

Each server has `/heavy`, the code as shipped or its async form (same
parameters, same output), and `/ping`, which answers at once. `bench.js` sends
`/ping` at 200/s for 20 s while sending `/heavy` at 0, 5, 10, 20 and 30/s, open
loop: each request goes out on schedule whether or not earlier ones have
answered, and latency is measured from its scheduled time. One fresh server
process per cell.

```bash
DURATION=20 HEAVY_RATES=0,5,10,20,30 node bench.js results/handler-blocking.json
```

Run 2026-10-20 on a 2-core cloud VM (Intel Xeon 2.10 GHz, Node 22.22.0,
default libuv thread pool of 4). The load generator shares the machine. One
call on an idle process: 50.9 ms (Next.js), 28.8 ms (Redwood), median of 21.
Results: `results/handler-blocking.json` and `.log`.

The tails are noisy (an idle server's worst ping was 34 ms). The medians, and
the rate at which the sync server stops keeping up, are the robust part.
