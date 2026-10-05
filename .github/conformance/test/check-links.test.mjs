import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkLinks } from '../check-links.mjs';

const SITE = 'https://jamie-clayton.github.io/githerd-rules';

function fixture(pages) {
  const root = mkdtempSync(join(tmpdir(), 'links-'));
  mkdirSync(join(root, 'lifecycle-policies', '0.9'), { recursive: true });
  mkdirSync(join(root, 'lifecycle-policies', 'assets'), { recursive: true });
  writeFileSync(join(root, 'LICENSE.md'), 'licence');
  writeFileSync(join(root, 'lifecycle-policies', '0.9', 'lifecycle-policies.schema.json'), '{}');
  writeFileSync(join(root, 'lifecycle-policies', 'assets', 'purpose.svg'), '<svg/>');
  writeFileSync(join(root, 'lifecycle-policies', 'spec.md'), '# spec');
  for (const [name, body] of Object.entries(pages)) writeFileSync(join(root, 'lifecycle-policies', name), body);
  return root;
}

const broken = (root) => checkLinks(root).map((f) => f.target);

test('relative, site-absolute, anchor and external links that resolve pass', () => {
  const root = fixture({
    'index.md': [
      '[Spec](spec.md) [Spec html](spec.html) [Section](spec.md#keys) [Here](#top)',
      '![Purpose](assets/purpose.svg) [Schema](0.9/lifecycle-policies.schema.json)',
      `[Licence](../LICENSE.md) [Abs](${SITE}/lifecycle-policies/spec) [Dir](${SITE}/lifecycle-policies/)`,
      '[Outside](https://json-schema.org/) <img src="assets/purpose.svg" alt="x">'
    ].join('\n')
  });
  assert.deepEqual(broken(root), []);
});

test('a relative link to a missing page is reported', () => {
  const root = fixture({ 'index.md': '[Gone](workflows.md)' });
  assert.deepEqual(broken(root), ['workflows.md']);
});

test('a missing image in an HTML src is reported', () => {
  const root = fixture({ 'index.md': '<img src="assets/missing.svg" alt="x">' });
  assert.deepEqual(broken(root), ['assets/missing.svg']);
});

test('a site-absolute link into the standard that does not exist is reported', () => {
  const root = fixture({ 'index.md': `[Old](${SITE}/lifecycle-policies/1.0/lifecycle-policies.schema.json)` });
  assert.deepEqual(broken(root), [`${SITE}/lifecycle-policies/1.0/lifecycle-policies.schema.json`]);
});

test('links inside fenced code blocks are ignored', () => {
  const root = fixture({ 'index.md': '```\n[Not a link](nowhere.md)\n```\n' });
  assert.deepEqual(broken(root), []);
});
