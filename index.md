---
id: ghfm-rule-index
title: "GHFM compliance rule index"
description: "Catalogue of the 10 GHFM front-matter diagnostic rules emitted by the Githerd harness metadata validator."
creator: scripts/Build-RuleDocs.ps1
subject:
  - compliance-rule
  - ghfm
  - rule-index
---

<!--
  GENERATED FILE -- do not edit by hand.
  Regenerate: pwsh -NoProfile -File scripts/Build-RuleDocs.ps1
-->

# Githerd compliance rules

Every diagnostic the Githerd front-matter validator emits carries a stable
`GHFM` identifier and a link to the page below that explains it. The
identifier is the durable handle; the kebab-case name beside it is the
readable one and may change without the identifier changing.

Severity is the default the validator applies. Enforcement phase is when
the rule became active: a `warning` annotates a pull request, an `error`
blocks it.

| Rule | Name | Severity | Phase |
| ---- | ---- | -------- | ----- |
| [GHFM0001](https://jamie-clayton.github.io/githerd-rules/rules/GHFM0001) | `missing-front-matter` | `warning` | B |
| [GHFM0002](https://jamie-clayton.github.io/githerd-rules/rules/GHFM0002) | `yaml-parse-error` | `error` | A |
| [GHFM0003](https://jamie-clayton.github.io/githerd-rules/rules/GHFM0003) | `schema-validation-error` | `error` | A |
| [GHFM0004](https://jamie-clayton.github.io/githerd-rules/rules/GHFM0004) | `yaml-1-1-hazard` | `error` | A |
| [GHFM0005](https://jamie-clayton.github.io/githerd-rules/rules/GHFM0005) | `yaml-alias` | `error` | A |
| [GHFM0006](https://jamie-clayton.github.io/githerd-rules/rules/GHFM0006) | `ai-tool-key-in-non-tool-file` | `warning` | A |
| [GHFM0007](https://jamie-clayton.github.io/githerd-rules/rules/GHFM0007) | `title-duplicates-h1` | `warning` | A |
| [GHFM0008](https://jamie-clayton.github.io/githerd-rules/rules/GHFM0008) | `identifier-shoulder-mismatch` | `warning` | C |
| [GHFM0009](https://jamie-clayton.github.io/githerd-rules/rules/GHFM0009) | `unknown-key` | `warning` | A |
| [GHFM0010](https://jamie-clayton.github.io/githerd-rules/rules/GHFM0010) | `metrics-key-shape` | `error` | A |

## Using a rule identifier

- In a pull-request comment or an editor, quote the identifier and the
  name together: `GHFM0009 (unknown-key)`.
- To reach a page directly, append the identifier to the rules path:
  `https://jamie-clayton.github.io/githerd-rules/rules/GHFM0009`.
- The kebab name resolves too. It redirects to the identifier page, so
  `https://jamie-clayton.github.io/githerd-rules/rules/unknown-key` lands in the same place.
- Arriving from an archived CI log with a retired code? Each rule page
  records the code it replaced under its Formerly heading, and the SARIF
  output carries the same mapping as `deprecatedIds`. Nothing emits the
  retired codes any more; they resolve, they do not fire.
