import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverStandards, suitesFor } from '../standards.mjs';
import { runConformance } from '../conformance.mjs';
import { checkImmutable } from '../check-immutable.mjs';
import { checkLinks } from '../check-links.mjs';

const SITE = 'https://jamie-clayton.github.io/githerd-rules';
const here = dirname(fileURLToPath(import.meta.url));

function write(root, path, content) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

// A standard with no profile: one schema, one valid and one invalid example.
function plainStandard(root, folder, version = '0.9', stem = folder, examples = 'examples') {
  write(root, `${folder}/${version}/${stem}.schema.json`, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `${SITE}/${folder}/${version}/${stem}.schema.json`,
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string' } }
  });
  write(root, `${folder}/${version}/${examples}/valid/named.json`, { name: 'x' });
  write(root, `${folder}/${version}/${examples}/invalid/unnamed.json`, {});
  write(root, `${folder}/${version}/${examples}/invalid/unnamed.expected.json`, { level: 'schema', rule: 'required' });
}

test('discovers every top-level folder holding a <major.minor> folder, sorted, with its tag prefix', () => {
  const root = mkdtempSync(join(tmpdir(), 'standards-'));
  mkdirSync(join(root, 'subject-vocabulary', '0.9'), { recursive: true });
  mkdirSync(join(root, 'lifecycle-policies', '0.9'), { recursive: true });
  mkdirSync(join(root, 'lifecycle-policies', 'assets'), { recursive: true });
  mkdirSync(join(root, 'rules'), { recursive: true });
  mkdirSync(join(root, '_rules', '1.0'), { recursive: true });
  mkdirSync(join(root, '.github', '1.0'), { recursive: true });
  write(root, 'GHFM0001.content.md', '# rule');

  assert.deepEqual(discoverStandards(root), [
    { folder: 'lifecycle-policies', tagPrefix: 'lifecycle-policies-v', versions: ['0.9'] },
    { folder: 'subject-vocabulary', tagPrefix: 'subject-vocabulary-v', versions: ['0.9'] }
  ]);
});

test('pairs the schema named after the standard with examples/ and any other schema with examples/<stem>/', () => {
  const root = mkdtempSync(join(tmpdir(), 'suites-'));
  plainStandard(root, 'subject-vocabulary', '0.9', 'subject-vocabulary');
  plainStandard(root, 'subject-vocabulary', '0.9', 'core-scheme', 'examples/core-scheme');
  write(root, 'subject-vocabulary/0.9/suggestions.schema.json', { $id: 'x' });

  const suites = suitesFor(join(root, 'subject-vocabulary', '0.9'), 'subject-vocabulary');
  assert.deepEqual(suites.map((s) => [s.stem, s.examplesDir?.replaceAll('\\', '/').split('/0.9/')[1] ?? null]), [
    ['core-scheme', 'examples/core-scheme'],
    ['subject-vocabulary', 'examples'],
    ['suggestions', null]
  ]);
});

test('conformance checks a second standard with no profile, and keys results by standard', async () => {
  const root = mkdtempSync(join(tmpdir(), 'conformance-'));
  plainStandard(root, 'alpha-standard');
  plainStandard(root, 'beta-standard');

  const { results, failures } = await runConformance(root, { log: () => {} });
  assert.deepEqual(failures, []);
  assert.deepEqual(Object.keys(results).sort(), [
    'alpha-standard/0.9/examples/invalid/unnamed.json',
    'alpha-standard/0.9/examples/valid/named.json',
    'beta-standard/0.9/examples/invalid/unnamed.json',
    'beta-standard/0.9/examples/valid/named.json'
  ]);
});

test('conformance fails a schema with no examples, a wrong $id, and a semantic expectation with no profile', async () => {
  const root = mkdtempSync(join(tmpdir(), 'conformance-'));
  plainStandard(root, 'alpha-standard');
  write(root, 'alpha-standard/0.9/orphan.schema.json', {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `${SITE}/alpha-standard/0.9/orphan.schema.json`, type: 'object'
  });
  plainStandard(root, 'beta-standard');
  write(root, 'beta-standard/0.9/beta-standard.schema.json', {
    $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `${SITE}/elsewhere.schema.json`, type: 'object'
  });
  plainStandard(root, 'gamma-standard');
  write(root, 'gamma-standard/0.9/examples/invalid/needs-rule.json', { name: 'x' });
  write(root, 'gamma-standard/0.9/examples/invalid/needs-rule.expected.json', { level: 'semantic', rule: 'GS001' });

  const { failures } = await runConformance(root, { log: () => {} });
  assert.ok(failures.some((f) => f.includes('alpha-standard/0.9: orphan.schema.json has no examples')), failures.join('\n'));
  assert.ok(failures.some((f) => f.includes('beta-standard/0.9: $id is')), failures.join('\n'));
  assert.ok(failures.some((f) => f.includes('gamma-standard/0.9/examples/invalid/needs-rule.json') && f.includes('no semantic checker')), failures.join('\n'));
});

test('conformance fails when no standard is found', async () => {
  const root = mkdtempSync(join(tmpdir(), 'conformance-'));
  const { failures } = await runConformance(root, { log: () => {} });
  assert.deepEqual(failures, ['no <standard>/<major.minor>/ folder found']);
});

test('a released 1.x version is frozen per standard, under that standard\'s own tag prefix', () => {
  const root = mkdtempSync(join(tmpdir(), 'immutable-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  plainStandard(root, 'alpha-standard', '1.0');
  plainStandard(root, 'beta-standard', '1.0');
  git('add', '-A');
  git('commit', '-qm', 'release');
  git('tag', 'alpha-standard-v1.0.0');
  git('tag', 'beta-standard-v1.0.0');
  write(root, 'beta-standard/1.0/examples/valid/named.json', { name: 'changed' });
  git('commit', '-qam', 'change a released version');

  const { failures, lines } = checkImmutable(root);
  assert.equal(failures, 1, lines.join('\n'));
  assert.ok(lines.some((l) => l.startsWith('ok   alpha-standard/1.0/')), lines.join('\n'));
  assert.ok(lines.some((l) => l.startsWith('FAIL beta-standard-v1.0.0')), lines.join('\n'));
});

test('internal links are checked in every standard', () => {
  const root = mkdtempSync(join(tmpdir(), 'links-'));
  mkdirSync(join(root, 'alpha-standard', '0.9'), { recursive: true });
  mkdirSync(join(root, 'beta-standard', '0.9'), { recursive: true });
  write(root, 'alpha-standard/index.md', '[Beta](../beta-standard/index.md)');
  write(root, 'beta-standard/index.md', `[Gone](spec.md) [Alpha](${SITE}/alpha-standard/)`);
  assert.deepEqual(checkLinks(root).map((f) => `${f.page} -> ${f.target}`), ['beta-standard/index.md -> spec.md']);
});

test('the workflow runs on any change outside the mirrored rule pages, so a new standard is never skipped', () => {
  const workflow = readFileSync(join(here, '..', '..', 'workflows', 'standards.yml'), 'utf8').replaceAll('\r\n', '\n');
  assert.doesNotMatch(workflow, /^\s+paths:/m, 'an allow-list of paths would skip a new standard folder');
  const blocks = [...workflow.matchAll(/^\s+paths-ignore:\n((?:\s+- .+\n)+)/gm)].map((m) => m[1]);
  assert.equal(blocks.length, 2, 'pull_request and push both ignore only the mirrored rule pages');
  for (const block of blocks) {
    const patterns = [...block.matchAll(/- '([^']+)'/g)].map((m) => m[1]);
    assert.ok(patterns.length > 0);
    for (const pattern of patterns) {
      assert.match(pattern, /^(GHFM\*\.content\.md|rules\/\*\*|_rules\/\*\*|index\.md|_config\.yml)$/,
        `'${pattern}' could hide a standard, the licence or the tooling`);
    }
  }
});
