## 1. Server and client, same machine

| Users in the table | Strategy | Rows sent | Response | Gzipped | Query (Prisma) | Serialise (superjson) | Server total | Client parse |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | as-found | 1,000 | 1.4 MB | 127 KB | 50.5ms | 75.5ms | 126.3ms | 27.9ms |
| 1,000 | suggested | 100 | 139 KB | 14 KB | 7.4ms | 6.8ms | 15.1ms | 2.5ms |
| 10,000 | as-found | 10,000 | 13.7 MB | 1.2 MB | 437.1ms | 743.9ms | 1155.1ms | 284.2ms |
| 10,000 | suggested | 100 | 139 KB | 14 KB | 8.6ms | 7.1ms | 15.7ms | 2.4ms |
| 50,000 | as-found | 50,000 | 68.8 MB | 6.1 MB | 2544.0ms | 4217.1ms | 6724.5ms | 1654.7ms |
| 50,000 | suggested | 100 | 139 KB | 14 KB | 9.1ms | 6.8ms | 15.8ms | 2.6ms |

## 2. Where the server time goes, as found

| Users | PostgreSQL + node-pg | Prisma query (incl. row mapping) | superjson serialise | Server total |
|---:|---:|---:|---:|---:|
| 1,000 | 16.5ms | 50.5ms | 75.5ms | 126.3ms |
| 10,000 | 134.9ms | 437.1ms | 743.9ms | 1155.1ms |
| 50,000 | 675.3ms | 2544.0ms | 4217.1ms | 6724.5ms |

## 3. Database distance

| Users | Strategy | local-socket | proxied-2.8ms | proxied-4.9ms |
|---:|---|---:|---:|---:|
| 1,000 | as-found | 126.3ms | 135.0ms | 118.7ms |
| 1,000 | suggested | 15.1ms | 21.5ms | 19.7ms |
| 10,000 | as-found | 1155.1ms | 1103.4ms | 1169.9ms |
| 10,000 | suggested | 15.7ms | 20.1ms | 21.3ms |
| 50,000 | as-found | 6724.5ms | 6748.2ms | 6698.0ms |
| 50,000 | suggested | 15.8ms | 16.0ms | 21.8ms |

## Ratios

- 1,000 users: server 8x, bytes 10x, client parse 11x, bytes per row 1427, heap growth 22.7 MB vs 11.6 MB
- 10,000 users: server 74x, bytes 101x, client parse 116x, bytes per row 1436, heap growth 159.7 MB vs 11.6 MB
- 50,000 users: server 424x, bytes 508x, client parse 638x, bytes per row 1443, heap growth 789.5 MB vs 11.6 MB
