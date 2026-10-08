// Conformance profile for the Lifecycle Policy Standard: the checks that only
// make sense for this standard. The generic suite (conformance.mjs) has
// already compiled every schema and will run every example; this profile
//
//   1. validates vocabulary.json against the schema's vocabulary definition,
//      and rejects a core vocabulary that declares roles;
//   2. expands the full Dublin Core example with context.jsonld and checks
//      every Dublin Core term the standard maps is present;
//   3. supplies the semantic rules LP001 to LP005 for schema-valid examples.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import jsonld from 'jsonld';
import { checkSemantics } from '../semantic.mjs';

const DUBLIN_CORE_TERMS = [
  'conformsTo', 'title', 'description', 'identifier', 'creator', 'contributor', 'publisher', 'subject',
  'created', 'modified', 'hasVersion', 'source', 'language', 'coverage', 'rights', 'references', 'requires', 'type',
  'isReplacedBy'
].map((term) => `http://purl.org/dc/terms/${term}`);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export async function checkVersion({ dir, version, ajv, schemaId, pass, fail }) {
  const vocabulary = readJson(join(dir, 'vocabulary.json'));
  const validateVocabulary = ajv.getSchema(`${schemaId('lifecycle-policies')}#/$defs/vocabulary`);
  if (validateVocabulary(vocabulary)) pass(`${version}: vocabulary.json is a valid vocabulary`);
  else fail(`${version}: vocabulary.json invalid: ${ajv.errorsText(validateVocabulary.errors)}`);
  if (vocabulary.roles) fail(`${version}: the core vocabulary must not declare roles`);

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

  return { semantics: (stem, doc) => (stem === 'lifecycle-policies' ? checkSemantics(doc, vocabulary) : null) };
}
