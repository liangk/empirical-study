/**
 * A TCP proxy that adds a fixed delay to every forwarded chunk in both
 * directions, so a query issued through it pays roughly 2 x DELAY_MS of extra
 * round-trip time. Copied from the N+1 benchmark (stories/01) so both stories
 * measure distance the same way, with one change: Nagle's algorithm is off on
 * both sockets. A small result arriving behind a delayed chunk otherwise waits
 * for a 40ms delayed ACK, which measured the proxy rather than the query.
 *
 *   node latency-proxy.js <listenPort> <targetPort> <delayMs>
 */
const net = require('net');

const listenPort = parseInt(process.argv[2], 10);
const targetPort = parseInt(process.argv[3], 10);
const delayMs = parseFloat(process.argv[4]);

const delayedWrite = (socket, chunk) => {
  setTimeout(() => {
    if (!socket.destroyed) socket.write(chunk);
  }, delayMs);
};

const server = net.createServer((client) => {
  const upstream = net.connect({ host: '127.0.0.1', port: targetPort });
  client.setNoDelay(true);
  upstream.setNoDelay(true);

  client.on('data', (chunk) => delayedWrite(upstream, chunk));
  upstream.on('data', (chunk) => delayedWrite(client, chunk));

  const close = () => {
    client.destroy();
    upstream.destroy();
  };
  client.on('error', close);
  upstream.on('error', close);
  client.on('end', close);
  upstream.on('end', close);
});

server.listen(listenPort, '127.0.0.1', () => {
  process.stdout.write(`proxy ${listenPort} -> ${targetPort} (+${delayMs}ms each way)\n`);
});
