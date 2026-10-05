---
title: Lifecycle Policy Standard 0.9 specification
description: Normative definition of lifecycle-policies.json, version 0.9 (pre-release).
---

# Lifecycle Policy Standard: specification

**Version 0.9, pre-release.** This version is published for testing before 1.0.
It may still change within its `0.9/` folder; see [Versioning](#versioning).

The machine-readable definition is the JSON Schema at
[`0.9/lifecycle-policies.schema.json`](0.9/lifecycle-policies.schema.json). Where
this page and the schema disagree, the schema wins for the schema-level rules
and this page wins for the [semantic rules](#semantic-rules), which JSON Schema
cannot express.

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, RECOMMENDED, MAY and
OPTIONAL are to be interpreted as described in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they
appear in capitals.

## The file

A conforming file is a UTF-8 JSON document whose top-level value is an object.
By convention it is named `lifecycle-policies.json`; a repository usually keeps
it at `docs/registers/lifecycle-policies.json`, but the standard does not
require a location.

Each repository owns its own file. The standard defines the shape; the
repository decides which document types it governs, which statuses they may
hold, and who approves them.

## Envelope keys

Schema locations are JSON Pointers into
[`0.9/lifecycle-policies.schema.json`](0.9/lifecycle-policies.schema.json).
Dublin Core mappings are defined in [`0.9/context.jsonld`](0.9/context.jsonld)
and explained in [Dublin Core](dublin-core.md).

| Key | Required | Value | Dublin Core | Schema location |
| --- | --- | --- | --- | --- |
| `$schema` | REQUIRED | The URL of the released schema version the file conforms to, of the form `https://jamie-clayton.github.io/githerd-rules/lifecycle-policies/MAJOR.MINOR/lifecycle-policies.schema.json`. A floating version such as `latest` MUST NOT be used. | `conformsTo` | `#/properties/$schema` |
| `title` | REQUIRED | Name of the policy set. Non-empty string. | `title` | `#/properties/title` |
| `identifier` | REQUIRED | Persistent identifier of the policy set: a URI, such as an ARK or an `https:` URL. | `identifier` | `#/properties/identifier` |
| `modified` | REQUIRED | When the policy set last changed. A date (`2026-10-05`) or a date-time with an offset (`2026-10-05T15:30:00+10:00` or `...Z`). A date-time without an offset is invalid. | `modified` | `#/properties/modified` |
| `policies` | REQUIRED | One [policy](#policies) per governed document type, keyed by that type. At least one. | `type` (per policy) | `#/properties/policies` |
| `description` | OPTIONAL | What the policy set governs and why. | `description` | `#/properties/description` |
| `created` | OPTIONAL | When the policy set was first created. Same format as `modified`. | `created` | `#/properties/created` |
| `version` | OPTIONAL | The policy set's own semantic version (`MAJOR.MINOR.PATCH`), independent of the standard version in `$schema`. | `hasVersion` | `#/properties/version` |
| `creator` | OPTIONAL | Who authored the policy set. | `creator` | `#/properties/creator` |
| `contributor` | OPTIONAL | Others who contributed. Array of unique strings. | `contributor` | `#/properties/contributor` |
| `publisher` | OPTIONAL | The repository or organisation publishing the policy set. | `publisher` | `#/properties/publisher` |
| `subject` | OPTIONAL | Keywords. Array of unique strings. | `subject` | `#/properties/subject` |
| `source` | OPTIONAL | The policy set this one was derived from. | `source` | `#/properties/source` |
| `language` | OPTIONAL | BCP 47 language tag for `description` and `notes`, such as `en-AU`. | `language` | `#/properties/language` |
| `coverage` | OPTIONAL | What the policy set governs: a repository, or path globs within one. | `coverage` | `#/properties/coverage` |
| `rights` | OPTIONAL | Licence of the policy set, ideally an SPDX identifier. | `rights` | `#/properties/rights` |
| `references` | OPTIONAL | Related resources. Array of unique strings. | `references` | `#/properties/references` |
| `rolesRef` | OPTIONAL | Where the role catalogue lives: a URI or a repository-relative path. | `requires` | `#/properties/rolesRef` |
| `fieldContract` | OPTIONAL | How consumers find the lifecycle value on a governed entry. See [fieldContract](#fieldcontract). | | `#/properties/fieldContract` |
| `vocabulary` | OPTIONAL | The roles and trigger events the file uses. See [Vocabulary](#vocabulary). | | `#/$defs/vocabulary` |
| `extensions` | OPTIONAL | Repository-specific data. See [Extensions](#extensions). | | `#/$defs/extensions` |

Any other top-level key is invalid.

## Policies

`policies` is an object. Each key is a document type and each value is a
policy (`#/$defs/policy`):

| Key | Required | Value | Schema location |
| --- | --- | --- | --- |
| `type` | REQUIRED | The governed document type ([token](#tokens)). MUST equal the policy's key in `policies` ([LP004](#semantic-rules)). | `#/$defs/policy/properties/type` |
| `field` | REQUIRED | Which key on a governed entry carries its lifecycle status, for example `lifecycle` or `status`. | `#/$defs/policy/properties/field` |
| `validStatuses` | REQUIRED | The statuses this type may hold. Unique [tokens](#tokens), at least one. | `#/$defs/policy/properties/validStatuses` |
| `transitions` | REQUIRED | The allowed moves between statuses, as [transitions](#transitions). May be empty. | `#/$defs/policy/properties/transitions` |
| `approverRoles` | OPTIONAL | Roles that may approve transitions for this type. Unique [tokens](#tokens). Local to this repository: a consumer MUST NOT merge one repository's approver roles into another's. | `#/$defs/policy/properties/approverRoles` |
| `notes` | OPTIONAL | Why the policy is shaped this way. | `#/$defs/policy/properties/notes` |
| `extensions` | OPTIONAL | Repository-specific data for this type. | `#/$defs/extensions` |

Any other key in a policy is invalid.

### Transitions

A transition (`#/$defs/transition`) is an object:

| Key | Required | Value |
| --- | --- | --- |
| `from` | REQUIRED | A status in `validStatuses`, or `*` meaning any status ([LP001](#semantic-rules)). |
| `to` | REQUIRED | A status in `validStatuses` ([LP001](#semantic-rules)). |
| `triggeredBy` | REQUIRED | The events that may cause the transition. Unique [tokens](#tokens), at least one, each an active event ([LP002](#semantic-rules)). |
| `extensions` | OPTIONAL | Repository-specific data for this transition. |

Any other key in a transition is invalid.

## Vocabulary

`vocabulary` (`#/$defs/vocabulary`) declares the tokens the file uses:

| Key | Value |
| --- | --- |
| `roles` | The role tokens this repository uses. When present, every `approverRoles` entry MUST be one of them ([LP003](#semantic-rules)). |
| `triggeredBy.active` | REQUIRED when `triggeredBy` is present. The events transitions may name. At least one. |
| `triggeredBy.retired` | Tokens no longer emitted, each with `value`, `replacedBy`, `deprecatedAt` (date), and OPTIONAL `removedAt` (date) and `rationale`. |
| `deprecationWindow` | How long a retired token is still accepted on read: `unit` (`release` or `day`) and `length` (integer, 0 or more). |

When a file declares no `vocabulary.triggeredBy`, its events are checked against
the **core vocabulary** published with each version at
[`0.9/vocabulary.json`](0.9/vocabulary.json): `decision`, `checkpoint` and
`milestone`, with `gate` retired in favour of `checkpoint`. The core vocabulary
declares no roles, because the standard cannot know an adopter's roles.

A consumer MAY accept a retired token on read during its deprecation window. A
producer SHOULD NOT write a retired token.

## Extensions

`extensions` (`#/$defs/extensions`) is an object for data the standard does not
define. It is allowed on the file, on each policy and on each transition. Its
keys and values are unconstrained.

Every other object in the file is closed: an unknown key is invalid. This is
what lets a validator catch a typo such as `validStatus`, while still leaving a
place for repository-specific data such as a risk register's severity levels:

```json
"risk": {
  "type": "risk",
  "field": "lifecycle",
  "validStatuses": ["open", "review", "closed"],
  "transitions": [{ "from": "open", "to": "review", "triggeredBy": ["checkpoint"] }],
  "extensions": { "severityLevels": ["low", "medium", "high", "critical"] }
}
```

A consumer MUST ignore extensions it does not understand. The JSON-LD context
keeps `extensions` as an opaque JSON value.

## fieldContract

`fieldContract` (`#/properties/fieldContract`) states how consumers find the
lifecycle value on a governed entry. `rule` is REQUIRED; `rationale` and
`appliesTo` are OPTIONAL; further string-valued keys MAY carry repository
narrative. A consumer MUST read the key named by each policy's `field` and MUST
NOT hardcode it.

## Tokens

Statuses, document types, roles and events are tokens (`#/$defs/token`): a
lowercase letter followed by letters, digits or hyphens, for example `draft`,
`in-progress` or `productOwner`. Spaces are invalid.

## Conformance

A file conforms to a version of this standard when it meets both levels.

### Schema rules

The file MUST be valid against the JSON Schema 2020-12 document its `$schema`
names. The `format` keyword is an annotation only; validators MUST NOT be relied
on to assert it, and the schema uses patterns wherever a format matters.

### Semantic rules

These rules compare one part of the file with another, which JSON Schema cannot
express. They apply to a file that already meets the schema rules.

| Rule | Requirement |
| --- | --- |
| **LP001** | Every transition's `to`, and its `from` unless it is `*`, MUST be one of that policy's `validStatuses`. |
| **LP002** | Every `triggeredBy` token MUST be in `vocabulary.triggeredBy.active`, or, when the file declares no `vocabulary.triggeredBy`, in the core vocabulary's `active` list. |
| **LP003** | When `vocabulary.roles` is present, every `approverRoles` token MUST be one of them. |
| **LP004** | Each key in `policies` MUST equal that policy's `type`. |
| **LP005** | No token MAY appear both in `vocabulary.triggeredBy.active` and as the `value` of an entry in `vocabulary.triggeredBy.retired`. |

The reference implementation is
[`.github/conformance/semantic.mjs`](https://github.com/Jamie-Clayton/githerd-rules/blob/main/.github/conformance/semantic.mjs).

### Conformance examples

Each version ships examples under `examples/valid/` and `examples/invalid/`.
Every invalid example has a sibling `.expected.json` naming the level (`schema`
or `semantic`) and the rule it breaks. The suite runs on every change under two
independent validators, Ajv and JsonSchema.Net, which must agree on every
example.

## Versioning

- A file pins a version through `$schema`, using a `MAJOR.MINOR` folder.
  Consumers SHOULD keep a copy of the pinned schema in their own repository, so
  validation works offline and an upgrade shows up as a reviewable change.
- Releases are tagged `lifecycle-policies-vMAJOR.MINOR.PATCH` in
  [githerd-rules](https://github.com/Jamie-Clayton/githerd-rules).
- **0.x versions are pre-releases.** Their folder MAY change between patch tags
  while the standard is tested.
- **From 1.0, a released `MAJOR.MINOR` folder never changes.** A minor release
  only adds: new optional keys, new vocabulary tokens, relaxed constraints. A
  major release may break. Each ships in its own folder.

## Licence

The standard, its schema, examples and pages are licensed under the
[Apache License 2.0](../LICENSE.md). Redistributions keep the
[NOTICE](https://github.com/Jamie-Clayton/githerd-rules/blob/main/NOTICE).

---

Licensed Apache-2.0, see [LICENSE.md](../LICENSE.md).
