// Renders subject-vocabulary/scheme.md from a version's scheme.json, so the
// page can never drift from the data. CI fails when the committed page
// differs from what this produces (test/subject-vocabulary-fixtures.test.mjs).
//
// Usage: node scheme-page.mjs --root <repo root> [--version 0.9]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function renderSchemePage(scheme, version) {
  const lines = [
    '---',
    `title: Subject Vocabulary Standard ${version} core scheme`,
    `description: The ${scheme.concepts.length === 8 ? 'eight' : scheme.concepts.length} concepts of the ${version} core scheme.`,
    '---',
    '',
    '# The core scheme',
    '',
    `**Version ${version}, pre-release.** The concepts of [\`${version}/scheme.json\`](${version}/scheme.json). Every adopting repository shares them unless its register replaces the core. Write them in front-matter \`subject\` by their notation.`,
    '',
    'This page is generated from `scheme.json`; a test fails if the two differ.',
    ''
  ];
  for (const c of scheme.concepts) {
    lines.push(`## ${c.prefLabel}`, '', `\`${c.notation}\`${c.audience === 'internal' ? ' (internal)' : ''}`, '', `> ${c.definition}`, '', c.scopeNote, '');
    if (c.altLabel?.length) lines.push(`- **Other names:** ${c.altLabel.join(', ')}`);
    if (c.hiddenLabel?.length) lines.push(`- **Suggester hints:** ${c.hiddenLabel.join(', ')}`);
    if (c.related?.length) lines.push(`- **Related:** ${c.related.map((r) => `\`${r}\``).join(', ')}`);
    if (c.closeMatch?.length) lines.push(`- **ISO/IEC 25010:2023, informative:** ${c.closeMatch.map((m) => m.notation).join(', ')}`);
    lines.push('');
  }
  lines.push('`ability:authoring` is reserved as a narrower concept of Governability and is not published in 0.9.', '', '---', '', 'Licensed Apache-2.0, see [LICENSE.md](../LICENSE.md).', '');
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (flag, fallback) => { const i = process.argv.indexOf(flag); return i >= 0 ? process.argv[i + 1] : fallback; };
  const root = arg('--root', process.cwd());
  const version = arg('--version', '0.9');
  const scheme = JSON.parse(readFileSync(join(root, 'subject-vocabulary', version, 'scheme.json'), 'utf8'));
  writeFileSync(join(root, 'subject-vocabulary', 'scheme.md'), renderSchemePage(scheme, version));
  console.log('wrote subject-vocabulary/scheme.md');
}
