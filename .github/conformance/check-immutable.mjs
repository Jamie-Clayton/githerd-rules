// A released version of the Lifecycle Policy Standard never changes: every
// adopter's vendored copy and $schema pin depend on it (adr-065 D2).
//
// For each tag lifecycle-policies-vMAJOR.MINOR.PATCH, the folder
// lifecycle-policies/MAJOR.MINOR/ must be byte-identical at HEAD to what the
// tag released. A change belongs in a new major.minor folder.
//
// Needs full history and tags (actions/checkout fetch-depth: 0).
// Usage: node check-immutable.mjs [--root <repo root>]

import { execFileSync } from 'node:child_process';

const rootIndex = process.argv.indexOf('--root');
const root = rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd();
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();

const tags = git('tag', '--list', 'lifecycle-policies-v*').split('\n').filter(Boolean);
let failures = 0;

if (tags.length === 0) {
  console.log('No released versions yet (no lifecycle-policies-v* tags); nothing is immutable.');
}

for (const tag of tags) {
  const match = /^lifecycle-policies-v([0-9]+)\.([0-9]+)\.([0-9]+)$/.exec(tag);
  if (!match) {
    console.log(`FAIL ${tag}: not of the form lifecycle-policies-vMAJOR.MINOR.PATCH`);
    failures++;
    continue;
  }
  const folder = `lifecycle-policies/${match[1]}.${match[2]}/`;
  const changed = git('diff', '--name-only', tag, 'HEAD', '--', folder).split('\n').filter(Boolean);
  if (changed.length) {
    console.log(`FAIL ${tag} released ${folder}, which has since changed:\n  ${changed.join('\n  ')}`);
    failures++;
  } else {
    console.log(`ok   ${folder} unchanged since ${tag}`);
  }
}

process.exit(failures ? 1 : 0);
