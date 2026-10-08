// Conformance suite for every published version of every standard in this
// repository (see standards.mjs for how standards and their suites are
// found). For each <standard>/<major.minor>/ folder it:
//
//   1. compiles every <stem>.schema.json in strict mode, which validates it
//      against the JSON Schema 2020-12 metaschema, and checks its $id is the
//      published URL of that file;
//   2. checks every example against its expectation: valid examples pass the
//      schema and every semantic rule; each invalid example fails exactly the
//      level and rule its .expected.json names;
//   3. runs the standard's own profile, profiles/<standard>.mjs, when there is
//      one: checks only that standard needs, and its semantic rules. A
//      standard with no profile has no semantic rules, so a semantic
//      expectation in it fails.
//
// Writes the schema verdict per example to --out, so a second, independent
// validator can be compared with this one (compare.mjs).
//
// Usage: node conformance.mjs --root <repo root> --out <results.json>

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { discoverStandards, suitesFor } from './standards.mjs';

const SITE = 'https://jamie-clayton.github.io/githerd-rules';
const here = dirname(fileURLToPath(import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

async function loadProfile(folder) {
  const path = join(here, 'profiles', `${folder}.mjs`);
  return existsSync(path) ? import(pathToFileURL(path).href) : null;
}

export async function runConformance(root, { log = console.log } = {}) {
  const failures = [];
  const fail = (message) => { failures.push(message); log(`FAIL ${message}`); };
  const pass = (message) => log(`ok   ${message}`);
  const results = {};

  const standards = discoverStandards(root);
  if (standards.length === 0) fail('no <standard>/<major.minor>/ folder found');

  for (const { folder, versions } of standards) {
    const profile = await loadProfile(folder);
    for (const version of versions) {
      const dir = join(root, folder, version);
      const at = `${folder}/${version}`;
      const schemaId = (stem) => `${SITE}/${folder}/${version}/${stem}.schema.json`;
      const suites = suitesFor(dir, folder);
      if (suites.length === 0) { fail(`${at}: no *.schema.json`); continue; }

      // Format is an annotation only, as the standards say, so both validators
      // agree. One instance per version, so its schemas can reference each other.
      const ajv = new Ajv2020({ strict: true, allErrors: true, validateFormats: false });
      const compiled = [];
      for (const suite of suites) {
        const schema = readJson(join(dir, suite.schemaFile));
        if (schema.$id !== schemaId(suite.stem)) { fail(`${at}: $id is ${schema.$id}, expected ${schemaId(suite.stem)}`); continue; }
        try {
          ajv.addSchema(schema);
          compiled.push({ ...suite, validate: ajv.getSchema(schema.$id) });
          pass(`${at}: ${suite.schemaFile} compiles in strict mode against the 2020-12 metaschema`);
        } catch (error) {
          fail(`${at}: ${suite.schemaFile} does not compile: ${error.message}`);
        }
      }
      if (compiled.length !== suites.length) continue;

      const checks = profile ? await profile.checkVersion({ dir, version: at, ajv, schemaId, pass, fail }) : null;

      for (const { stem, schemaFile, examplesDir, validate } of compiled) {
        if (!examplesDir) { fail(`${at}: ${schemaFile} has no examples (expected ${stem === folder ? 'examples' : `examples/${stem}`}/valid)`); continue; }
        for (const kind of ['valid', 'invalid']) {
          const exampleFolder = join(examplesDir, kind);
          if (!existsSync(exampleFolder)) continue;
          for (const file of readdirSync(exampleFolder).filter((f) => f.endsWith('.json') && !f.endsWith('.expected.json')).sort()) {
            const name = `${at}/${exampleFolder.slice(dir.length + 1).replaceAll('\\', '/')}/${file}`;
            const doc = readJson(join(exampleFolder, file));
            const schemaValid = validate(doc);
            const schemaErrors = schemaValid ? '' : ajv.errorsText(validate.errors);
            const findings = schemaValid ? (checks?.semantics(stem, doc) ?? null) : [];
            results[name] = schemaValid;

            if (kind === 'valid') {
              if (!schemaValid) fail(`${name}: expected valid, schema says ${schemaErrors}`);
              else if (findings?.length) fail(`${name}: expected valid, semantic findings ${JSON.stringify(findings)}`);
              else pass(`${name}: valid`);
              continue;
            }

            const expectedPath = join(exampleFolder, `${basename(file, '.json')}.expected.json`);
            if (!existsSync(expectedPath)) { fail(`${name}: no .expected.json`); continue; }
            const expected = readJson(expectedPath);
            if (expected.level === 'schema') {
              const keywords = new Set((validate.errors ?? []).map((e) => e.keyword));
              if (schemaValid) fail(`${name}: expected a schema failure (${expected.rule}), schema passed`);
              else if (!keywords.has(expected.rule)) fail(`${name}: expected the ${expected.rule} keyword to fail, got ${schemaErrors}`);
              else pass(`${name}: rejected by the schema (${expected.rule})`);
            } else if (findings === null) {
              fail(`${name}: expects ${expected.rule}, but ${stem} has no semantic checker (profiles/${folder}.mjs)`);
            } else {
              const rules = [...new Set(findings.map((f) => f.rule))];
              if (!schemaValid) fail(`${name}: expected only ${expected.rule}, but the schema rejected it: ${schemaErrors}`);
              else if (rules.length !== 1 || rules[0] !== expected.rule) fail(`${name}: expected only ${expected.rule}, got ${JSON.stringify(rules)}`);
              else pass(`${name}: rejected by ${expected.rule}`);
            }
          }
        }
      }
    }
  }
  return { results, failures };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith('--') ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), [])
  );
  const { results, failures } = await runConformance(args.root ?? process.cwd());
  if (args.out) writeFileSync(args.out, JSON.stringify(results, null, 2) + '\n');
  console.log(failures.length ? `\n${failures.length} conformance failure(s)` : '\nConformance suite passed');
  process.exit(failures.length ? 1 : 0);
}
