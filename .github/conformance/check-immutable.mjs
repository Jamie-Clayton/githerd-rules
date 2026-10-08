// A released version of a standard never changes: every adopter's vendored
// copy and $schema pin depend on it.
//
// For each standard (standards.mjs) and each of its tags
// <standard>-vMAJOR.MINOR.PATCH with MAJOR >= 1, the folder
// <standard>/MAJOR.MINOR/ must be byte-identical at HEAD to what the tag
// released. A change belongs in a new major.minor folder.
//
// 0.x tags are pre-releases for testing: each patch tag marks a testable point,
// and the 0.x folder may still change between them, as semantic versioning
// allows for major version zero. They are reported, not frozen.
//
// Needs full history and tags (actions/checkout fetch-depth: 0).
// Usage: node check-immutable.mjs [--root <repo root>]

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { discoverStandards } from './standards.mjs';

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function checkImmutable(root) {
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const lines = [];
  let failures = 0;

  for (const { folder, tagPrefix } of discoverStandards(root)) {
    const tags = git('tag', '--list', `${tagPrefix}*`).split('\n').filter(Boolean);
    if (tags.length === 0) lines.push(`none ${folder}: no released versions yet (no ${tagPrefix}* tags); nothing is immutable.`);
    const form = new RegExp(`^${escape(tagPrefix)}([0-9]+)\\.([0-9]+)\\.([0-9]+)$`);

    for (const tag of tags) {
      const match = form.exec(tag);
      if (!match) {
        lines.push(`FAIL ${tag}: not of the form ${tagPrefix}MAJOR.MINOR.PATCH`);
        failures++;
        continue;
      }
      const released = `${folder}/${match[1]}.${match[2]}/`;
      if (match[1] === '0') {
        lines.push(`pre  ${tag} is a 0.x pre-release; ${released} may still change`);
        continue;
      }
      const changed = git('diff', '--name-only', tag, 'HEAD', '--', released).split('\n').filter(Boolean);
      if (changed.length) {
        lines.push(`FAIL ${tag} released ${released}, which has since changed:\n  ${changed.join('\n  ')}`);
        failures++;
      } else {
        lines.push(`ok   ${released} unchanged since ${tag}`);
      }
    }
  }
  return { failures, lines };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rootIndex = process.argv.indexOf('--root');
  const { failures, lines } = checkImmutable(rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd());
  for (const line of lines) console.log(line);
  process.exit(failures ? 1 : 0);
}
