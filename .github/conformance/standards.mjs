// Finds the standards this repository publishes, so every check runs over all
// of them and a new standard needs no edit to the tooling.
//
// A standard is a top-level folder holding at least one <major.minor>/ version
// folder, for example lifecycle-policies/0.9/. Folders starting with . or _
// (the tooling, the mirrored rule collection) are never standards. Each
// standard releases under its own tag prefix, <folder>-v, as in
// lifecycle-policies-v0.9.1.
//
// Inside a version folder, each <stem>.schema.json is one suite. The schema
// named after the standard takes its examples from examples/valid and
// examples/invalid; any other schema takes them from examples/<stem>/. The
// JsonSchema.Net validator (dotnet/Program.cs) applies the same convention.
//
// Usage: node standards.mjs --list   (prints one folder per line)

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const VERSION = /^[0-9]+\.[0-9]+$/;
const directories = (dir) => readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const byOrdinal = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function discoverStandards(root) {
  return directories(root)
    .filter((name) => !name.startsWith('.') && !name.startsWith('_'))
    .map((folder) => ({ folder, tagPrefix: `${folder}-v`, versions: directories(join(root, folder)).filter((v) => VERSION.test(v)).sort(byOrdinal) }))
    .filter((standard) => standard.versions.length > 0)
    .sort((a, b) => byOrdinal(a.folder, b.folder));
}

export function suitesFor(versionDir, folder) {
  return readdirSync(versionDir)
    .filter((file) => file.endsWith('.schema.json'))
    .sort(byOrdinal)
    .map((schemaFile) => {
      const stem = schemaFile.slice(0, -'.schema.json'.length);
      const examplesDir = stem === folder ? join(versionDir, 'examples') : join(versionDir, 'examples', stem);
      return { stem, schemaFile, examplesDir: existsSync(join(examplesDir, 'valid')) ? examplesDir : null };
    });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes('--list')) {
  const rootIndex = process.argv.indexOf('--root');
  for (const { folder } of discoverStandards(rootIndex >= 0 ? process.argv[rootIndex + 1] : process.cwd())) console.log(folder);
}
