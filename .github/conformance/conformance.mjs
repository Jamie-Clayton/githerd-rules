// Conformance suite for every published version of the Lifecycle Policy
// Standard. For each lifecycle-policies/<major.minor>/ folder it:
//
//   1. compiles the schema in strict mode, which validates it against the
//      JSON Schema 2020-12 metaschema;
//   2. validates vocabulary.json against the schema's vocabulary definition;
//   3. checks every example against its expectation: valid examples pass the
//      schema and every semantic rule; each invalid example fails exactly the
//      level and rule its .expected.json names;
//   4. expands the full Dublin Core example with context.jsonld and checks
//      every Dublin Core term the standard maps is present.
//
// Writes the schema verdict per example to --out, so a second, independent
// validator can be compared with this one (compare.mjs).
//
// Usage: node conformance.mjs --root <repo root> --out <results.json>

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import jsonld from 'jsonld';
import { checkSemantics } from './semantic.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), [])
);
const root = args.root ?? process.cwd();
const outPath = args.out;

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const failures = [];
const fail = (message) => { failures.push(message); console.log(`FAIL ${message}`); };
const pass = (message) => console.log(`ok   ${message}`);
const results = {};

const DUBLIN_CORE_TERMS = [
  'conformsTo', 'title', 'description', 'identifier', 'creator', 'contributor', 'publisher', 'subject',
  'created', 'modified', 'hasVersion', 'source', 'language', 'coverage', 'rights', 'references', 'requires', 'type',
  'isReplacedBy'
].map((term) => `http://purl.org/dc/terms/${term}`);

const standardRoot = join(root, 'lifecycle-policies');
const versions = readdirSync(standardRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && /^[0-9]+\.[0-9]+$/.test(entry.name))
  .map((entry) => entry.name);
if (versions.length === 0) fail('no lifecycle-policies/<major.minor>/ folder found');

for (const version of versions) {
  const dir = join(standardRoot, version);
  const schema = readJson(join(dir, 'lifecycle-policies.schema.json'));
  const expectedId = `https://jamie-clayton.github.io/githerd-rules/lifecycle-policies/${version}/lifecycle-policies.schema.json`;
  if (schema.$id !== expectedId) fail(`${version}: $id is ${schema.$id}, expected ${expectedId}`);

  // Format is an annotation only, as the standard says, so both validators agree.
  const ajv = new Ajv2020({ strict: true, allErrors: true, validateFormats: false });
  let validate;
  try {
    validate = ajv.compile(schema);
    pass(`${version}: schema compiles in strict mode against the 2020-12 metaschema`);
  } catch (error) {
    fail(`${version}: schema does not compile: ${error.message}`);
    continue;
  }

  const vocabulary = readJson(join(dir, 'vocabulary.json'));
  const validateVocabulary = ajv.getSchema(`${expectedId}#/$defs/vocabulary`);
  if (validateVocabulary(vocabulary)) pass(`${version}: vocabulary.json is a valid vocabulary`);
  else fail(`${version}: vocabulary.json invalid: ${ajv.errorsText(validateVocabulary.errors)}`);
  if (vocabulary.roles) fail(`${version}: the core vocabulary must not declare roles`);

  for (const kind of ['valid', 'invalid']) {
    const folder = join(dir, 'examples', kind);
    for (const file of readdirSync(folder).filter((f) => f.endsWith('.json') && !f.endsWith('.expected.json'))) {
      const name = `${version}/${kind}/${file}`;
      const doc = readJson(join(folder, file));
      const schemaValid = validate(doc);
      const schemaErrors = schemaValid ? '' : ajv.errorsText(validate.errors);
      const findings = schemaValid ? checkSemantics(doc, vocabulary) : [];
      results[name] = schemaValid;

      if (kind === 'valid') {
        if (!schemaValid) fail(`${name}: expected valid, schema says ${schemaErrors}`);
        else if (findings.length) fail(`${name}: expected valid, semantic findings ${JSON.stringify(findings)}`);
        else pass(`${name}: valid`);
        continue;
      }

      const expectedPath = join(folder, `${basename(file, '.json')}.expected.json`);
      if (!existsSync(expectedPath)) { fail(`${name}: no .expected.json`); continue; }
      const expected = readJson(expectedPath);
      if (expected.level === 'schema') {
        const keywords = new Set((validate.errors ?? []).map((e) => e.keyword));
        if (schemaValid) fail(`${name}: expected a schema failure (${expected.rule}), schema passed`);
        else if (!keywords.has(expected.rule)) fail(`${name}: expected the ${expected.rule} keyword to fail, got ${schemaErrors}`);
        else pass(`${name}: rejected by the schema (${expected.rule})`);
      } else {
        const rules = [...new Set(findings.map((f) => f.rule))];
        if (!schemaValid) fail(`${name}: expected only ${expected.rule}, but the schema rejected it: ${schemaErrors}`);
        else if (rules.length !== 1 || rules[0] !== expected.rule) fail(`${name}: expected only ${expected.rule}, got ${JSON.stringify(rules)}`);
        else pass(`${name}: rejected by ${expected.rule}`);
      }
    }
  }

  // Dublin Core: expand the full example with the published context, offline.
  const context = readJson(join(dir, 'context.jsonld'));
  const full = readJson(join(dir, 'examples', 'valid', 'full-dublin-core.json'));
  try {
    const expanded = await jsonld.expand(full, { expandContext: context });
    const seen = new Set();
    const walk = (node) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) { seen.add(key); walk(value); }
    };
    walk(expanded);
    const missing = DUBLIN_CORE_TERMS.filter((term) => !seen.has(term));
    if (missing.length) fail(`${version}: context.jsonld does not map ${missing.join(', ')}`);
    else pass(`${version}: context.jsonld maps all ${DUBLIN_CORE_TERMS.length} Dublin Core terms`);
  } catch (error) {
    fail(`${version}: JSON-LD expansion failed: ${error.message}`);
  }
}

if (outPath) writeFileSync(outPath, JSON.stringify(results, null, 2) + '\n');
console.log(failures.length ? `\n${failures.length} conformance failure(s)` : '\nConformance suite passed');
process.exit(failures.length ? 1 : 0);
