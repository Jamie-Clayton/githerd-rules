// Internal link check for the pages of every standard (standards.mjs). Every
// Markdown link, image and HTML href/src in <standard>/**/*.md must resolve to
// a file in this repository when it is:
//
//   - relative (resolved against the page's folder), or
//   - absolute into https://jamie-clayton.github.io/githerd-rules/
//
// A page link may name the .md source, the rendered .html, or be extensionless;
// a folder link needs an index.md. Anchors, other sites and mailto are not
// checked, and links inside fenced code blocks are ignored.
//
// Usage: node check-links.mjs [--root <repo root>]

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { discoverStandards } from './standards.mjs';

const SITE = 'https://jamie-clayton.github.io/githerd-rules/';

function markdownFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith('.md') ? [path] : [];
  });
}

function targetsIn(markdown) {
  const text = markdown.replace(/^(```|~~~)[\s\S]*?^\1/gm, '');
  const targets = [];
  for (const [, target] of text.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) targets.push(target);
  for (const [, target] of text.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)) targets.push(target);
  return targets;
}

function resolves(path) {
  const candidates = [path, `${path}.md`, path.replace(/\.html$/, '.md'), join(path, 'index.md')];
  return candidates.some((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

export function checkLinks(root) {
  const findings = [];
  const pages = discoverStandards(root).flatMap(({ folder }) => markdownFiles(join(root, folder)));
  for (const page of pages) {
    for (const target of targetsIn(readFileSync(page, 'utf8'))) {
      if (target.startsWith('#') || target.startsWith('mailto:')) continue;
      let local;
      if (target.startsWith(SITE)) local = join(root, target.slice(SITE.length));
      else if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      else if (target.startsWith('/')) local = join(root, target.replace(/^\/githerd-rules\//, '/'));
      else local = resolve(dirname(page), target);
      local = decodeURI(local.split('#')[0].split('?')[0]);
      if (!resolves(local)) findings.push({ page: relative(root, page).replaceAll('\\', '/'), target });
    }
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootIndex = process.argv.indexOf('--root');
  const root = rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd();
  const findings = checkLinks(root);
  for (const f of findings) console.log(`FAIL ${f.page}: ${f.target} does not resolve`);
  console.log(findings.length ? `\n${findings.length} broken link(s)` : 'All internal links resolve');
  process.exit(findings.length ? 1 : 0);
}
