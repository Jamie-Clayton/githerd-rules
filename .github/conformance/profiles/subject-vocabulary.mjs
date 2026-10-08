// Conformance profile for the Subject Vocabulary Standard: the checks that
// only make sense for this standard. The generic suite (conformance.mjs) has
// already compiled every schema and will run every example; this profile
//
//   1. validates the published core scheme, scheme.json, against
//      scheme.schema.json and the scheme rules (SV001, SV003 to SV005);
//   2. expands the full Dublin Core register example with context.jsonld and
//      checks every Dublin Core and SKOS term the standard maps is present,
//      and that ability: notations expand to version-independent concept IRIs;
//   3. supplies the semantic rules for schema-valid examples: register
//      examples are checked against this version's scheme.json (SV001 to
//      SV006) in extend or replace mode, scheme examples on their own.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import jsonld from 'jsonld';
import { checkRegister, checkScheme } from '../subject-vocabulary-semantic.mjs';

const DC = [
  'conformsTo', 'title', 'description', 'identifier', 'creator', 'contributor', 'publisher', 'subject',
  'created', 'modified', 'hasVersion', 'source', 'language', 'coverage', 'rights', 'references', 'audience', 'isReplacedBy'
].map((term) => `http://purl.org/dc/terms/${term}`);
const SKOS = [
  'hasTopConcept', 'notation', 'prefLabel', 'altLabel', 'hiddenLabel', 'definition', 'scopeNote',
  'broader', 'narrower', 'related', 'exactMatch', 'closeMatch', 'inScheme'
].map((term) => `http://www.w3.org/2004/02/skos/core#${term}`);
const CONCEPT_IRI = 'https://jamie-clayton.github.io/githerd-rules/subject-vocabulary/concepts/ability/';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const VERSION = /^[0-9]+\.[0-9]+$/;

export async function checkVersion({ dir, version, ajv, schemaId, pass, fail }) {
  const scheme = readJson(join(dir, 'scheme.json'));
  const validateScheme = ajv.getSchema(schemaId('scheme'));
  if (!validateScheme(scheme)) {
    fail(`${version}: scheme.json invalid: ${ajv.errorsText(validateScheme.errors)}`);
  } else {
    const findings = checkScheme(scheme);
    if (findings.length) fail(`${version}: scheme.json semantic findings ${JSON.stringify(findings)}`);
    else pass(`${version}: scheme.json is a valid core scheme with ${scheme.concepts.length} concepts`);
  }

  const published = readdirSync(dirname(dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && VERSION.test(entry.name))
    .map((entry) => entry.name);

  const context = readJson(join(dir, 'context.jsonld'));
  const full = readJson(join(dir, 'examples', 'valid', 'full-dublin-core.json'));
  try {
    const seen = new Set();
    const iris = new Set();
    const walk = (node) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          seen.add(key);
          if (key === '@id' && typeof value === 'string') iris.add(value);
          walk(value);
        }
      }
    };
    walk(await jsonld.expand(full, { expandContext: context }));
    const missing = [...DC, ...SKOS].filter((term) => !seen.has(term));
    if (missing.length) fail(`${version}: context.jsonld does not map ${missing.join(', ')}`);
    else pass(`${version}: context.jsonld maps all ${DC.length} Dublin Core and ${SKOS.length} SKOS terms`);
    if (!iris.has(`${CONCEPT_IRI}observability`)) fail(`${version}: ability:observability does not expand to ${CONCEPT_IRI}observability`);
    else pass(`${version}: ability: notations expand to version-independent concept IRIs`);
  } catch (error) {
    fail(`${version}: JSON-LD expansion failed: ${error.message}`);
  }

  return {
    semantics: (stem, doc) => {
      if (stem === 'subject-vocabulary') return checkRegister(doc, scheme, published);
      if (stem === 'scheme') return checkScheme(doc);
      return null;
    }
  };
}
