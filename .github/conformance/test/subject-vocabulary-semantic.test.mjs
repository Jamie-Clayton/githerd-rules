import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkRegister, checkScheme } from '../subject-vocabulary-semantic.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const scheme = JSON.parse(readFileSync(join(here, '..', '..', '..', 'subject-vocabulary', '0.9', 'scheme.json'), 'utf8'));
const PIN = 'https://jamie-clayton.github.io/githerd-rules/subject-vocabulary/0.9/subject-vocabulary.schema.json';
const register = (extra) => ({ $schema: PIN, title: 't', identifier: 'ark:/1/x', modified: '2026-10-08', conceptBase: 'https://example.org/', ...extra });
const rules = (findings) => findings.map((f) => f.rule);

test('the published core scheme has no findings', () => {
  assert.deepEqual(checkScheme(scheme), []);
});

test('no label or hint in the published core scheme belongs to two concepts', () => {
  const owners = new Map();
  for (const concept of scheme.concepts) {
    for (const label of [concept.prefLabel, ...(concept.altLabel ?? []), ...(concept.hiddenLabel ?? [])]) {
      const key = label.normalize('NFC').toLowerCase().trim();
      assert.ok(!owners.has(key) || owners.get(key) === concept.notation, `'${label}' belongs to ${owners.get(key)} and ${concept.notation}`);
      owners.set(key, concept.notation);
    }
  }
});

test('a hint for a theme the register does not define is SV001, not SV002', () => {
  assert.deepEqual(rules(checkRegister(register({ hints: { 'theme:missing': { hiddenLabel: ['x'] } } }), scheme, ['0.9'])), ['SV001']);
});

test('a hint for a core ability is allowed', () => {
  assert.deepEqual(checkRegister(register({ hints: { 'ability:securability': { hiddenLabel: ['sbom'] } } }), scheme, ['0.9']), []);
});

test('a legacy key that names the concept it maps to is allowed', () => {
  assert.deepEqual(checkRegister(register({ legacy: { Traceability: 'ability:traceability' } }), scheme, ['0.9']), []);
});

test('a component under an unresolved theme is SV001', () => {
  const findings = checkRegister(register({
    components: [{ notation: 'component:ui', paths: ['ui/**'], broader: ['theme:ui'] }]
  }), scheme, ['0.9']);
  assert.deepEqual(rules(findings), ['SV001']);
  assert.equal(findings[0].path, '/components/0/broader');
});

test('a component named with ability: is SV002 and is not checked further', () => {
  assert.deepEqual(rules(checkRegister(register({
    components: [{ notation: 'ability:ui', paths: ['ui/**'], broader: ['theme:nowhere'] }]
  }), scheme, ['0.9'])), ['SV002']);
});

test('altLabel comparison folds case and surrounding space', () => {
  assert.deepEqual(rules(checkRegister(register({
    concepts: [{ notation: 'theme:x', prefLabel: 'X', altLabel: [' OBSERVABILITY '], broader: ['ability:observability'] }]
  }), scheme, ['0.9'])), ['SV005']);
});

test('a broader cycle in the core scheme is SV001', () => {
  const concept = (name, broader) => ({ notation: `ability:${name}`, prefLabel: name, definition: 'd', scopeNote: 's', audience: 'customer', broader: [broader] });
  const findings = checkScheme({ concepts: [concept('a', 'ability:b'), concept('b', 'ability:a')] });
  assert.ok(findings.length > 0 && findings.every((f) => f.rule === 'SV001'), JSON.stringify(findings));
});
