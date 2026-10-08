// Reference checker for the Subject Vocabulary Standard's semantic rules: the
// ones JSON Schema cannot express because they compare one concept with
// another, or a register with the core scheme it pins. Run only on documents
// that are already schema-valid.
//
//   SV001  Every broader, narrower and related notation, and every hints key
//          outside ability:, resolves to an active core or local concept; every
//          broader chain ends at a core concept with no broader, with no cycle.
//   SV002  A register never adds or redefines an ability: concept: no local
//          concept, component or hint uses an ability: notation the core
//          scheme does not define, and no local concept repeats a core one.
//   SV003  No notation is both active and retired; every isReplacedBy names an
//          active concept.
//   SV004  Core concepts use ability:; local concepts and components use
//          theme: or component:.
//   SV005  No altLabel or legacy key equals another concept's notation or
//          prefLabel, compared case-insensitively, so a legacy string or
//          absorbed name leads to exactly one concept.
//   SV006  A register's $schema names a version the standard has published.
//
// Each concept or entry raises at most one finding per rule, in that order,
// so a single mistake is reported once.

const CORE = 'ability:';
const LOCAL = ['theme:', 'component:'];
const fold = (text) => text.normalize('NFC').toLowerCase().trim();

function makeFindings() {
  const findings = [];
  return { findings, add: (rule, path, message) => findings.push({ rule, path, message }) };
}

function checkReferences(concepts, active, add, base) {
  concepts.forEach((concept, i) => {
    for (const key of ['broader', 'narrower', 'related']) {
      for (const target of concept[key] ?? []) {
        if (!active.has(target)) add('SV001', `${base}/${i}/${key}`, `'${target}' is not an active concept.`);
      }
    }
  });
}

function checkChains(byNotation, add, label) {
  for (const [notation, { concept, path }] of byNotation) {
    const seen = new Set([notation]);
    let current = concept;
    while ((current.broader ?? []).length > 0) {
      const next = current.broader.find((n) => byNotation.has(n));
      if (!next) break; // unresolved targets are reported by checkReferences
      if (seen.has(next)) {
        add('SV001', `${path}/broader`, `${label} '${notation}' has a broader cycle through '${next}'.`);
        break;
      }
      seen.add(next);
      current = byNotation.get(next).concept;
    }
  }
}

function checkRetired(active, retired, add, base) {
  retired.forEach((entry, i) => {
    if (active.has(entry.notation)) add('SV003', `${base}/${i}/notation`, `'${entry.notation}' is both active and retired.`);
    else if (!active.has(entry.isReplacedBy)) add('SV003', `${base}/${i}/isReplacedBy`, `'${entry.isReplacedBy}' is not an active concept.`);
  });
}

function checkLabels(entries, add) {
  // entries: { notation, prefLabel?, altLabel?, path }[]
  const owners = new Map();
  for (const entry of entries) {
    owners.set(fold(entry.notation), entry.notation);
    if (entry.prefLabel) owners.set(fold(entry.prefLabel), entry.notation);
  }
  for (const entry of entries) {
    for (const label of entry.altLabel ?? []) {
      const owner = owners.get(fold(label));
      if (owner && owner !== entry.notation) {
        add('SV005', `${entry.path}/altLabel`, `altLabel '${label}' is the notation or prefLabel of '${owner}'.`);
        break;
      }
    }
  }
  return owners;
}

/** Checks a core scheme on its own. */
export function checkScheme(scheme) {
  const { findings, add } = makeFindings();
  const concepts = scheme.concepts;
  const active = new Set(concepts.map((c) => c.notation));

  concepts.forEach((concept, i) => {
    if (!concept.notation.startsWith(CORE)) add('SV004', `/concepts/${i}/notation`, `Core concept '${concept.notation}' must use the ability: prefix.`);
  });
  checkReferences(concepts, active, add, '/concepts');
  checkChains(new Map(concepts.map((c, i) => [c.notation, { concept: c, path: `/concepts/${i}` }])), add, 'Concept');
  checkRetired(active, scheme.retired ?? [], add, '/retired');
  checkLabels(concepts.map((c, i) => ({ ...c, path: `/concepts/${i}` })), add);
  return findings;
}

/**
 * Checks an adoption register against the core scheme it pins.
 * publishedVersions: the major.minor versions the standard has published.
 */
export function checkRegister(register, scheme, publishedVersions) {
  const { findings, add } = makeFindings();
  const core = new Map(scheme.concepts.map((c) => [c.notation, c]));
  const locals = (register.concepts ?? []).map((c, i) => ({ concept: c, path: `/concepts/${i}` }))
    .concat((register.components ?? []).map((c, i) => ({ concept: c, path: `/components/${i}` })));

  // SV002 and SV004: what a local entry may be called.
  const valid = [];
  for (const entry of locals) {
    const { notation } = entry.concept;
    if (notation.startsWith(CORE)) {
      add('SV002', `${entry.path}/notation`, core.has(notation)
        ? `'${notation}' is a core concept; a register may add hints to it but not redefine it.`
        : `'${notation}' adds an ability; only the core scheme defines abilities.`);
    } else if (!LOCAL.some((prefix) => notation.startsWith(prefix))) {
      add('SV004', `${entry.path}/notation`, `Local notation '${notation}' must use the theme: or component: prefix.`);
    } else {
      valid.push(entry);
    }
  }
  for (const key of Object.keys(register.hints ?? {})) {
    if (key.startsWith(CORE) && !core.has(key)) add('SV002', `/hints/${key}`, `Hint for '${key}', which the core scheme does not define.`);
  }

  // SV001: references and chains over the resolved vocabulary.
  const active = new Set([...core.keys(), ...valid.map((e) => e.concept.notation)]);
  locals.forEach((entry) => {
    if (!valid.includes(entry)) return;
    for (const key of ['broader', 'narrower', 'related']) {
      for (const target of entry.concept[key] ?? []) {
        if (!active.has(target)) add('SV001', `${entry.path}/${key}`, `'${target}' is not an active concept.`);
      }
    }
  });
  for (const key of Object.keys(register.hints ?? {})) {
    if (!key.startsWith(CORE) && !active.has(key)) add('SV001', `/hints/${key}`, `Hint for '${key}', which is not an active concept.`);
  }
  // Every local entry has a broader (the schema requires it), so a chain
  // through locals either reaches a core concept, meets an unresolved
  // notation (reported above), or cycles. Core chains are checked with the
  // scheme itself.
  checkChains(new Map(valid.map((e) => [e.concept.notation, e])), add, 'Local concept');

  // SV003: retirement.
  checkRetired(active, register.retired ?? [], add, '/retired');

  // SV005: labels, over the core scheme and the register together.
  const owners = checkLabels([
    ...scheme.concepts.map((c) => ({ ...c, altLabel: [], path: '(core)' })),
    ...valid.map((e) => ({ ...e.concept, path: e.path }))
  ], add);
  for (const [key, target] of Object.entries(register.legacy ?? {})) {
    const owner = owners.get(fold(key));
    if (owner && owner !== target) add('SV005', `/legacy/${key}`, `Legacy key '${key}' is the notation or prefLabel of '${owner}'.`);
  }

  // SV006: the pin names a published version.
  const pinned = /\/subject-vocabulary\/([0-9]+\.[0-9]+)\//.exec(register.$schema)?.[1];
  if (!publishedVersions.includes(pinned)) add('SV006', '/$schema', `Version ${pinned} of the standard has not been published.`);

  return findings;
}
