/**
 * One HTTP server per run: `/heavy` runs the case's handler (sync as shipped,
 * or async), `/ping` answers at once. Usage: node server.js <next|redwood> <sync|async> <port>
 */
const http = require('http');
const h = require('./handlers');
const [, , which, mode, port] = process.argv;
const secret = Buffer.from('a'.repeat(32));
const token = h.encryptWithSecret(secret, JSON.stringify({ draft: true, slug: '/blog/post' }));

const heavy = {
  'next:sync': async () => h.decryptWithSecret(secret, token),
  'next:async': async () => h.decryptWithSecretAsync(secret, token),
  'redwood:sync': async () => h.hashPassword('correct horse battery staple', { salt: 'f'.repeat(64) })[0],
  'redwood:async': async () => (await h.hashPasswordAsync('correct horse battery staple', { salt: 'f'.repeat(64) }))[0],
}[`${which}:${mode}`];

http.createServer(async (req, res) => {
  if (req.url === '/heavy') {
    const out = await heavy();
    res.end(out.slice(0, 16));
  } else {
    res.end('{"ok":true}');
  }
}).listen(Number(port), () => process.send?.('ready'));
