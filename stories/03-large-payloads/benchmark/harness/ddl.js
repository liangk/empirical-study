/**
 * CREATE TABLE "users" (and the enums it uses) from cal.com's own
 * schema.prisma at the pinned commit. Prisma's schema engine is not
 * downloadable from this environment, so the one table the benchmark reads is
 * created from the model definition directly: every scalar and enum field, the
 * same column names (@map), the same types (@db), the same nullability.
 * Relations and indexes other than the primary key are left out; the query
 * under test reads the whole table and uses neither.
 *
 *   node ddl.js > prisma/users.sql
 */
const fs = require('fs');
const src = fs.readFileSync(`${__dirname}/prisma/schema.prisma`, 'utf8');

const enums = {};
for (const m of src.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)) {
  enums[m[1]] = m[2].split('\n').map(l => l.replace(/\/\/.*$/, '').trim()).filter(Boolean)
    .map(l => (l.match(/@map\("([^"]+)"\)/) || [null, l.split(/\s+/)[0]])[1]);
}
const model = src.match(/^model User \{([\s\S]*?)^\}/m)[1];
const table = (model.match(/@@map\(name: "(\w+)"\)/) || model.match(/@@map\("(\w+)"\)/))[1];

const PG = { Int: 'integer', String: 'text', Boolean: 'boolean', DateTime: 'timestamp(3)', Json: 'jsonb', BigInt: 'bigint', Float: 'double precision' };
const cols = [];
const usedEnums = new Set();
for (const raw of model.split('\n')) {
  const line = raw.replace(/\/\/.*$/, '').trim();
  if (!line || line.startsWith('@@')) continue;
  const f = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/);
  if (!f || f[3]) continue;
  const [, name, type, , optional, rest] = f;
  let sql;
  if (PG[type]) sql = /@db\.Uuid/.test(rest) ? 'uuid' : PG[type];
  else if (enums[type]) { sql = `"${type}"`; usedEnums.add(type); } else continue; // a relation
  const column = (rest.match(/@map\((?:name: )?"(\w+)"\)/) || [null, name])[1];
  cols.push(`  "${column}" ${sql}${optional ? '' : ' NOT NULL'}${/@id\b/.test(rest) ? ' PRIMARY KEY' : ''}`);
}
const out = [];
for (const e of usedEnums) out.push(`CREATE TYPE "${e}" AS ENUM (${enums[e].map(v => `'${v}'`).join(', ')});`);
out.push(`CREATE TABLE "${table}" (\n${cols.join(',\n')}\n);`);
process.stdout.write(out.join('\n') + '\n');
