// The resolver and suggester fixtures are inputs and outputs of the standard
// itself, so every register, scheme and expected suggestions document in them
// must be valid against the published 0.9 schemas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const here = dirname(fileURLToPath(import.meta.url));
const version = join(here, '..', '..', '..', 'subject-vocabulary', '0.9');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const SITE = 'https://jamie-clayton.github.io/githerd-rules/subject-vocabulary/0.9';

const ajv = new Ajv2020({ strict: true, allErrors: true, validateFormats: false });
for (const file of ['scheme.schema.json', 'subject-vocabulary.schema.json', 'suggestions.schema.json']) ajv.addSchema(readJson(join(version, file)));
const check = (stem, doc, label) => {
  const validate = ajv.getSchema(`${SITE}/${stem}.schema.json`);
  assert.ok(validate(doc), `${label}: ${ajv.errorsText(validate.errors)}`);
};

const fixtures = [
  ...readdirSync(join(version, 'resolve', 'fixtures')).map((f) => ({ label: `resolve/${f}`, fixture: readJson(join(version, 'resolve', 'fixtures', f)) })),
  ...readdirSync(join(version, 'suggest', 'fixtures')).map((d) => ({ label: `suggest/${d}`, fixture: readJson(join(version, 'suggest', 'fixtures', d, 'fixture.json')) }))
];

for (const { label, fixture } of fixtures) {
  test(`${label}: register and scheme are valid`, () => {
    if (fixture.register) check('subject-vocabulary', fixture.register, `${label} register`);
    if (fixture.scheme && typeof fixture.scheme === 'object' && fixture.scheme.$schema) check('scheme', fixture.scheme, `${label} scheme`);
  });
}

for (const { label, fixture } of fixtures.filter((f) => f.label.startsWith('suggest/'))) {
  test(`${label}: expected output is a valid suggestions document`, () => {
    check('suggestions', fixture.expected, `${label} expected`);
  });
}
