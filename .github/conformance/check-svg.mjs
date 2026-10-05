// Safety and accessibility check for every SVG published under
// lifecycle-policies/. A public SVG can execute script or pull in remote
// content, so each one must:
//
//   title              have a non-empty <title>
//   desc               have a non-empty <desc>
//   script             contain no <script> element
//   event-handler      carry no on* event-handler attribute
//   external-reference reference nothing outside itself: every href and
//                      url() target starts with #, and no @import
//   foreign-object     contain no <foreignObject>, which can carry HTML
//
// Usage: node check-svg.mjs [--root <repo root>]

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

export function checkSvg(text) {
  const findings = [];
  const add = (rule, detail) => findings.push({ rule, detail });

  const element = (name) => new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, 'i').exec(text);
  for (const name of ['title', 'desc']) {
    const match = element(name);
    if (!match || match[1].trim() === '') add(name, `missing or empty <${name}>`);
  }
  if (/<script\b/i.test(text)) add('script', '<script> element');
  if (/<foreignObject\b/i.test(text)) add('foreign-object', '<foreignObject> element');

  // Event handlers: an attribute named on<something> inside a tag.
  for (const tag of text.match(/<[a-zA-Z][^>]*>/g) ?? []) {
    const handler = /\son[a-zA-Z]+\s*=/.exec(tag);
    if (handler) add('event-handler', handler[0].trim());
  }

  for (const [, value] of text.matchAll(/(?:xlink:)?href\s*=\s*["']([^"']*)["']/gi)) {
    if (!value.startsWith('#')) add('external-reference', `href ${value}`);
  }
  for (const [, value] of text.matchAll(/url\(\s*["']?([^"')]*)["']?\s*\)/gi)) {
    if (!value.startsWith('#')) add('external-reference', `url(${value})`);
  }
  if (/@import\b/i.test(text)) add('external-reference', '@import');

  return findings;
}

function svgFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return svgFiles(path);
    return entry.name.toLowerCase().endsWith('.svg') ? [path] : [];
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootIndex = process.argv.indexOf('--root');
  const root = rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd();
  const files = svgFiles(join(root, 'lifecycle-policies'));
  let failures = 0;
  for (const file of files) {
    const findings = checkSvg(readFileSync(file, 'utf8'));
    const name = relative(root, file).replaceAll('\\', '/');
    if (findings.length === 0) console.log(`ok   ${name}`);
    for (const f of findings) { failures++; console.log(`FAIL ${name}: ${f.rule} (${f.detail})`); }
  }
  console.log(files.length === 0 ? 'No SVG files found.' : failures ? `\n${failures} SVG finding(s)` : `\nAll ${files.length} SVG files pass`);
  process.exit(failures ? 1 : 0);
}
