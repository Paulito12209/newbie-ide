/**
 * Measures the built bundle. Reports what a cold visitor actually downloads
 * (entry chunks) separately from the lazily loaded language grammars.
 */
import { gzipSync } from 'node:zlib';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(DIST).filter((f) => /\.(js|css|html)$/.test(f));
const rows = files
  .map((path) => {
    const raw = readFileSync(path);
    return {
      path: path.replace(DIST + '/', ''),
      raw: raw.length,
      gzip: gzipSync(raw, { level: 9 }).length,
      // Everything Vite splits out of the entry is fetched on demand.
      lazy: !/(^|\/)(index-[A-Za-z0-9_-]+\.(js|css)|index\.html)$/.test(path),
    };
  })
  .sort((a, b) => b.gzip - a.gzip);

const kb = (n) => (n / 1024).toFixed(2).padStart(8) + ' KB';
const initial = rows.filter((r) => !r.lazy);
const lazy = rows.filter((r) => r.lazy);
const sum = (list, key) => list.reduce((total, row) => total + row[key], 0);

for (const row of rows) {
  console.log(`${kb(row.raw)} raw  ${kb(row.gzip)} gzip  ${row.lazy ? 'lazy   ' : 'initial'}  ${row.path}`);
}
console.log('-'.repeat(64));
console.log(`initial (cold load): ${kb(sum(initial, 'gzip'))} gzip`);
console.log(`lazy (on demand):    ${kb(sum(lazy, 'gzip'))} gzip`);
console.log(`total:               ${kb(sum(rows, 'gzip'))} gzip`);
