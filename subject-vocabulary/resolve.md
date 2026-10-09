---
title: Subject Vocabulary Standard 0.9 resolution
description: How a subject token in front matter resolves to a concept, version 0.9 (pre-release).
---

# Subject Vocabulary Standard: resolution

**Version 0.9, pre-release.** This page is normative. Every tool that reads
subjects (a validator, a dashboard, a suggester, an MCP server) resolves them
with these steps, so two tools never disagree about what a subject means.

The fixtures in `0.9/resolve/fixtures/` pin the
behaviour: each gives a core scheme, an adoption register and subject tokens,
and the resolutions a conforming resolver returns. The reference resolver,
[`0.9/resolve/Resolve-Subject.ps1`](0.9/resolve/Resolve-Subject.ps1) (PowerShell
7.4, no modules), passes them all. A resolver in another language conforms when
it passes them too.

The key words MUST, MUST NOT, SHOULD and MAY are to be interpreted as described
in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they
appear in all capitals.

## Inputs

- The pinned core scheme (`scheme.json` of the version the register's `$schema`
  names).
- The repository's adoption register, `docs/registers/subject-vocabulary.json`.
  A repository without one resolves as if it had a register with no concepts in
  `extend` mode.
- Subject tokens: the entries of a document's front-matter `subject` list.

The register is assumed valid: schema-valid and free of SV001 to SV009
findings. A resolver MAY refuse an invalid register; it MUST NOT guess.

## Steps

### 1. Build the concept set

Read the register's `core` (`extend` when absent).

- **extend**: the core scheme's concepts (origin `core`), then the register's
  `concepts` and `components` (origin `local`).
- **replace**: the register's `concepts` and `components` only (origin
  `local`). Core concepts take no part, though the scheme is still read for
  step 6.

Merge hints: for every `hints` key that names a concept in the set, append its
`hiddenLabel` entries to that concept's `hiddenLabel`, skipping any whose
normalised form (step 3) is already there. The retired set is the core
scheme's `retired` (extend only) plus the register's `retired`.

### 2. Build the prefix set

The prefix set is `ability` plus the register's `prefixes` (`theme` and
`component` when absent). `ability` is in the set in both modes, so under
`replace` an `ability:` token is recognised as a subject that does not resolve,
not mistaken for a keyword.

### 3. Normalise the token

In this order:

1. Unicode Normalization Form C.
2. Lowercase each code point with its Unicode simple lowercase mapping (as
   .NET `ToLowerInvariant` and Java `Character.toLowerCase` do).
3. Trim leading and trailing white space.
4. Replace each run of internal white space with one space (U+0020).

Hyphens and underscores are kept: `dashboard-ux` and `dashboard_ux` are
different tokens. Labels, `altLabel` and `legacy` keys are compared in the
same normalised form.

### 4. Classify the token

The token is **prefixed** when its normalised form matches
`^[a-z][a-z0-9]*:[a-z][a-z0-9-]*$` and the part before the colon is in the
prefix set. Every other token is a **keyword**, including one with a prefix
the register does not declare.

### 5. Resolve a prefixed token

1. A concept in the set has this notation: status `active`.
2. Otherwise a retired entry has this notation: status `retired`; the
   resolution's `notation` is its `isReplacedBy`.
3. Otherwise status `unknown`. Under `replace`, when the token's prefix is
   `ability` and a local concept declares an `exactMatch` with scheme `core`
   to this notation, `suggestion` names that local concept (the first by
   notation order).

### 6. Resolve a keyword

1. **Legacy.** A `legacy` key equal to the normalised token: status `legacy`,
   `notation` its target (or that target's `isReplacedBy` if it has since been
   retired).
2. **Labels.** Otherwise, the concepts whose normalised `prefLabel` or
   `altLabel` equals it. One: status `label`, `notation` that concept. More
   than one: status `ambiguous`, `candidates` their notations in order.
   `hiddenLabel` never resolves a keyword: hints are suggester signals, not
   names.
3. Otherwise status `unknown`.

Unprefixed keywords stay valid in documents; resolving one only says which
concept it most likely means.

### 7. Find the top concept

For a resolution with a `notation` in the concept set, `top` is reached by
following the first `broader` until a concept has none. Under `extend` a local
theme usually tops out at a core ability; under `replace`, and for any local
top concept, at a local concept.

## Output

A resolver returns, for a set of tokens:

```json
{
  "vocabulary": [
    { "notation": "ability:traceability", "origin": "core", "top": "ability:traceability", "hiddenLabel": ["ark", "typed edge"] }
  ],
  "resolutions": [
    { "token": " Ability:Traceability ", "normalised": "ability:traceability", "kind": "prefixed", "status": "active", "notation": "ability:traceability", "origin": "core", "top": "ability:traceability" }
  ]
}
```

- `vocabulary`: the concept set of step 1 in notation order, each with
  `origin`, `top` and its merged `hiddenLabel` (concept's own first, then
  hints', in register order).
- `resolutions`: one per token, in input order. `kind` is `prefixed` or
  `keyword`; `status` is `active`, `retired`, `legacy`, `label`, `ambiguous`
  or `unknown`. `notation`, `origin` and `top` are present when the token
  resolved to a concept; `retired` names the retired notation for a retired
  token; `candidates` and `suggestion` as above. Absent keys are omitted, never
  null.

Notation order is ordinal (code-point) order of the notation strings.

## Fixtures

Each fixture is one JSON file:

| Key | Meaning |
| --- | ------- |
| `description` | What the fixture proves |
| `scheme` | A core scheme object, or the string `"scheme.json"` for this version's published scheme |
| `register` | An adoption register object, or `null` for a repository without one |
| `tokens` | The subject tokens |
| `expected` | `resolutions`, and optionally `vocabulary`; a resolver's output must equal them |

Two outputs are equal when they are equal as JSON values, ignoring key order.
