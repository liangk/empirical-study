/**
 * Download cal.com's schema.prisma at the commit Study 09 pinned, and drop the
 * generators other than `client` (zod, kysely, enums), which need packages the
 * benchmark does not install. The schema is cal.com's, so it is fetched rather
 * than committed.
 *
 *   node fetch-schema.js
 */
const fs = require('fs');
const COMMIT = '46eb533dbd20b74686efa520684e662c0f21051c';
const URL = `https://raw.githubusercontent.com/calcom/cal.com/${COMMIT}/packages/prisma/schema.prisma`;

(async () => {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`${res.status} ${URL}`);
  const schema = (await res.text()).replace(/generator (?!client\b)\w+ \{[^}]*\}\n?/g, '');
  fs.mkdirSync(`${__dirname}/prisma`, { recursive: true });
  fs.writeFileSync(`${__dirname}/prisma/schema.prisma`, schema);
  console.log(`prisma/schema.prisma from calcom/cal.com@${COMMIT.slice(0, 7)}`);
})();
