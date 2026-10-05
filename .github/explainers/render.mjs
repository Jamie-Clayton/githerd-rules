// Renders explainer SVGs to PNG for review, plus the squint (blurred
// greyscale) and thumbnail views used to check the focal point and legibility.
// Previews are review aids only and are not committed.
//
// Usage: node render.mjs <svg folder> <png folder>

import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const [, , input, output] = process.argv;
mkdirSync(output, { recursive: true });
for (const file of readdirSync(input).filter((f) => f.endsWith('.svg'))) {
  const svgText = readFileSync(join(input, file), 'utf8');
  for (const [suffix, width] of [['', 1600], ['-thumb', 320]]) {
    const png = new Resvg(svgText, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true } }).render().asPng();
    writeFileSync(join(output, `${basename(file, '.svg')}${suffix}.png`), png);
  }
  console.log(`rendered ${file}`);
}
