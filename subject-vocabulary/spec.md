---
title: Subject Vocabulary Standard 0.9 specification
description: Normative definition of subject-vocabulary.json and the core scheme, version 0.9 (pre-release).
---

# Subject Vocabulary Standard: specification

**Version 0.9, pre-release.** This version is published for testing before 1.0.
It may still change within its `0.9/` folder; see [Versioning](#versioning).

The machine-readable definitions are the JSON Schemas in [`0.9/`](index.md#files-for-version-09).
Where this page and a schema disagree, the schema wins for the schema-level
rules and this page wins for the [semantic rules](#semantic-rules).

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, RECOMMENDED, MAY and
OPTIONAL are to be interpreted as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they
appear in all capitals.

## Layers

| Layer | Owned by | Lives at |
| --- | --- | --- |
| The core scheme | This standard | `0.9/scheme.json` |
| The format, resolution and suggestion | This standard | `0.9/`, [resolve.md](resolve.md), [suggest.md](suggest.md) |
| A repository's adoption register | That repository | `docs/registers/subject-vocabulary.json` (RECOMMENDED path) |
| Which subjects a document carries | Its author | front-matter `subject` |

A subject is any string in a document's Dublin Core `subject` list. A string
with a declared prefix (`ability:`, or one the register declares, such as
`theme:`) opts into resolution; every other string is a plain keyword and
stays valid.

## Concepts

A concept is a SKOS concept in plain JSON. The keys:

| Key | SKOS or Dublin Core term | Meaning |
| --- | --- | --- |
| `notation` | `skos:notation` | The token written in `subject`: a prefix, a colon, a lowercase name |
| `prefLabel` | `skos:prefLabel` | The label people read |
| `definition` | `skos:definition` | The promise the concept makes. REQUIRED for core concepts, RECOMMENDED for every other |
| `scopeNote` | `skos:scopeNote` | What is in and out of scope, naming the nearest neighbour |
| `audience` | `dcterms:audience` | `customer` or `internal`; customer-facing views MAY hide internal concepts |
| `altLabel` | `skos:altLabel` | Other names, including names it absorbed |
| `hiddenLabel` | `skos:hiddenLabel` | Suggester hints, never displayed; matched as literal strings |
| `broader`, `narrower`, `related` | `skos:broader`, `skos:narrower`, `skos:related` | Hierarchy and association |
| `exactMatch`, `closeMatch` | `skos:exactMatch`, `skos:closeMatch` | Comparable concepts elsewhere; `"scheme": "core"` names a core ability |
| `extensions` | | Data the standard does not define |

`ability:` concept IRIs are version-independent:
`https://jamie-clayton.github.io/githerd-rules/subject-vocabulary/concepts/ability/<name>`,
so `ability:traceability` is the same concept in every version. A local
concept's IRI is the register's `conceptBase`, its prefix, `/` and its name.

## The core scheme

`0.9/scheme.json` holds the core abilities; see [The core scheme](scheme.md).
`ability:` always means this scheme: no repository may define, redefine or
reuse it.

## The adoption register

`subject-vocabulary.json` in a repository pins a released version through
`$schema` and says what the repository adds.

| Key | Meaning |
| --- | --- |
| `$schema` | REQUIRED. The released version followed: `.../subject-vocabulary/0.9/subject-vocabulary.schema.json` |
| `title`, `identifier`, `modified` | REQUIRED Dublin Core envelope; the other Dublin Core terms of the lifecycle standard are OPTIONAL |
| `core` | `extend` (default): the core abilities plus this register's concepts. `replace`: this register's concepts only |
| `prefixes` | Local prefixes this register opts into resolution; default `theme` and `component`; never `ability` |
| `conceptBase` | IRI base of local concepts; REQUIRED once `concepts` or `components` is present |
| `concepts` | Local concepts. One without `broader` is a top concept |
| `components` | Concepts with `paths`: path patterns of the code they cover |
| `hints` | Extra `hiddenLabel` entries for concepts, keyed by notation; additive only |
| `legacy` | Tag strings used before adopting, each mapped to the concept that replaces it |
| `retired` | Local concepts no longer offered, each with `isReplacedBy` and `deprecatedAt` |
| `extensions` | Data the standard does not define; for example a tool's subject policy |

Under `replace` the register MUST hold at least one concept. Its concepts MAY
declare `exactMatch` or `closeMatch` with `"scheme": "core"` to a core
ability, so cross-repository roll-ups still line up: an exact match counts
inside that ability's group, a close match is shown beside it, never summed.

## Conformance

### Schema rules

A register, a core scheme or a suggestions file MUST be valid against the
JSON Schema 2020-12 document of its kind. `format` is an annotation only.

### Semantic rules

These compare one concept with another, or a register with the scheme it
pins. They apply to a schema-valid register. Labels are compared after the
normalisation of [resolve.md](resolve.md) step 3.

| Rule | Requirement |
| --- | --- |
| **SV001** | Every `broader`, `narrower` and `related` notation, and every `hints` key, MUST resolve to an active concept of the resolved vocabulary; every `broader` chain MUST end at a top concept, with no cycle. Under `replace` at least one local concept MUST be a top concept. |
| **SV002** | `ability:` is reserved. Under `extend` no local concept, component or hint MAY add an `ability:` notation or repeat a core one, and a core `exactMatch` is refused (use `broader`). Under `replace` no local concept, component, hint key or legacy target MAY use `ability:`. Every match to `"scheme": "core"` MUST name an active core ability. |
| **SV003** | No notation MAY be both active and retired; every `isReplacedBy` MUST name an active concept. |
| **SV004** | Core concepts MUST use `ability:`; local concepts and components MUST use a declared prefix. |
| **SV005** | No `altLabel` or `legacy` key MAY equal another concept's notation or `prefLabel`. |
| **SV006** | `$schema` MUST name a version the standard has published, and the one the repository vendors. |
| **SV007** | Every local concept and component MUST have at most one `broader`. |
| **SV008** | Under `extend`, no local label MAY equal a core label. Under `replace`, a local concept with a core label MUST declare a core `exactMatch` or `closeMatch` to that concept. |
| **SV009** | Every `legacy` target MUST resolve to an active concept, and no `altLabel` or `hiddenLabel`, hints included, MAY belong to two concepts. |

The reference checker is
[`.github/conformance/subject-vocabulary-semantic.mjs`](https://github.com/Jamie-Clayton/githerd-rules/blob/main/.github/conformance/subject-vocabulary-semantic.mjs);
the adopter guard, [`0.9/check/Test-SubjectVocabulary.ps1`](0.9/check/Test-SubjectVocabulary.ps1),
implements the same rules in PowerShell and is tested against every example.

### Conformance examples

Each version ships examples under `examples/` (registers), `examples/scheme/`
and `examples/suggestions/`, each with `valid/` and `invalid/`. Every invalid
example has a sibling `.expected.json` naming the level and the rule it
breaks. The suite runs on every change under Ajv and JsonSchema.Net, which
must agree on every example.

## Writing subjects

No tool writes a subject on its own. A suggester proposes; a person accepts,
by editing an acceptance record (`accepted`, `acceptedBy`, `acceptedAt`) or by
writing the subject; the pull-request review is the binding acceptance.

## Versioning

- A register pins a version through `$schema`, using a `MAJOR.MINOR` folder.
  Adopters SHOULD keep a copy of the pinned folder in their repository, so
  checks run offline and an upgrade is a reviewable change.
- Releases are tagged `subject-vocabulary-vMAJOR.MINOR.PATCH` in
  [githerd-rules](https://github.com/Jamie-Clayton/githerd-rules).
- **0.x versions are pre-releases.** Their folder MAY change between patch tags.
- **From 1.0, a released `MAJOR.MINOR` folder never changes.** A minor release
  only adds; a major release may break. Each ships in its own folder. A
  concept is retired with `isReplacedBy`, never deleted.

## Licence

The standard, its schemas, scheme, examples, scripts and pages are licensed
under the [Apache License 2.0](../LICENSE.md). Redistributions keep the
[NOTICE](https://github.com/Jamie-Clayton/githerd-rules/blob/main/NOTICE).
ISO/IEC 25010:2023 matches cite characteristic names only; no ISO text is
reproduced.

---

Licensed Apache-2.0, see [LICENSE.md](../LICENSE.md).
