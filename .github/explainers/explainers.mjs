// Writes the explainer SVGs for one standard's pages. Each standard with an
// assets/ folder has a generator module here, <standard>.mjs, exporting
// `explainers`: a map of file name (without .svg) to SVG text.
//
// Usage: node explainers.mjs --standard <folder> [--out <folder>]
//        (default --out: <standard>/assets in this repository)

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const arg = (flag) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : undefined; };

const standard = arg('--standard');
if (!standard || !/^[a-z0-9][a-z0-9-]*$/.test(standard)) {
  console.error('Usage: node explainers.mjs --standard <folder> [--out <folder>]');
  process.exit(2);
}
const generator = join(here, `${standard}.mjs`);
if (!existsSync(generator)) {
  console.error(`No explainer generator for ${standard}: expected .github/explainers/${standard}.mjs`);
  process.exit(1);
}
const out = arg('--out') ?? join(here, '..', '..', standard, 'assets');

const { explainers } = await import(pathToFileURL(generator).href);
mkdirSync(out, { recursive: true });
for (const [name, content] of Object.entries(explainers)) {
  writeFileSync(join(out, `${name}.svg`), content);
  console.log(`wrote ${name}.svg`);
}
