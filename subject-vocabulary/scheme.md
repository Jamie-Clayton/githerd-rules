---
title: Subject Vocabulary Standard 0.9 core scheme
description: The eight concepts of the 0.9 core scheme.
---

# The core scheme

**Version 0.9, pre-release.** The concepts of [`0.9/scheme.json`](0.9/scheme.json). Every adopting repository shares them unless its register replaces the core. Write them in front-matter `subject` by their notation.

This page is generated from `scheme.json`; a test fails if the two differ.

## Governability

`ability:governability`

> Your documents follow an agreed lifecycle: each has an owner, the right people sign off, and its metadata stays valid as it moves from draft to archived.

Lifecycles, sign-off, policies, registers and front-matter validity. Not how documents link to each other (traceability) or how they are found (discoverability). A narrower Authoring concept, ability:authoring, is reserved for a later version.

- **Other names:** governance, authorability, compliance
- **Suggester hints:** lifecycle, sign-off, approval, policy register, front matter, dublin core, validator, template
- **Related:** `ability:traceability`

## Traceability

`ability:traceability`

> You can follow any piece of work from the question that started it to the change that answered it.

Identifiers, links, lineage and history. Not search or navigation (discoverability).

- **Other names:** lineage, provenance, identifiability
- **Suggester hints:** ark, identifier, mint, backlink, supersede, typed relation, cross-reference
- **Related:** `ability:governability`, `ability:discoverability`
- **ISO/IEC 25010:2023, informative:** accountability

## Discoverability

`ability:discoverability`

> You can find the work you need, and move between related pieces, without knowing where it lives.

Search, filters, graph and board views, and navigation. Not a summary of the state of work (observability).

- **Other names:** findability, navigation, usability
- **Suggester hints:** search, filter, graph view, kanban, timeline, facet, detail panel
- **Related:** `ability:observability`, `ability:traceability`
- **ISO/IEC 25010:2023, informative:** interaction capability

## Observability

`ability:observability`

> You can see the state of all your work at a glance, and notice when something stalls.

Dashboards, metrics, reports, status roll-ups and health. Not finding one particular item (discoverability).

- **Other names:** visibility, reporting
- **Suggester hints:** dashboard, metric, report, roundup, health, trend
- **Related:** `ability:discoverability`

## Interoperability

`ability:interoperability`

> It works with the tools and agents you already use, through open formats and documented interfaces.

APIs, MCP tools, file formats, exports and agent integrations. Not how the product itself is built and released (engineering quality).

- **Other names:** integration, automatability
- **Suggester hints:** mcp, api, typespec, openapi, jira, export, sarif, agent skill, hook
- **ISO/IEC 25010:2023, informative:** compatibility

## Securability

`ability:securability`

> It is safe by default: secrets, credentials and access are protected, and risky actions ask before they act.

Threats, secrets, access control, vulnerable dependencies and safe defaults. Not whether document metadata is valid (governability).

- **Other names:** security
- **Suggester hints:** credential, secret, xss, owasp, dependabot, vulnerability, threat model, permission
- **ISO/IEC 25010:2023, informative:** security

## Repository hygiene

`ability:repository-hygiene`

> Your branches, worktrees and stashes stay tidy, and merged work is cleaned up without losing anything.

Branch, worktree and stash management and clean-up. Not the documents inside the repository (governability).

- **Other names:** repository operability, git hygiene
- **Suggester hints:** worktree, branch, stash, merged branch, prune, cleanup plan

## Engineering quality

`ability:engineering-quality` (internal)

> The product itself is tested, releasable, maintainable and fast.

Tests, continuous integration, releases, packaging, refactoring and performance of the product. Internal: customer-facing views may hide it.

- **Other names:** testability, deployability, maintainability, performance
- **Suggester hints:** pester, playwright, e2e, bdd, reqnroll, release, nuget, refactor, tech debt, latency
- **ISO/IEC 25010:2023, informative:** maintainability, performance efficiency, reliability

`ability:authoring` is reserved as a narrower concept of Governability and is not published in 0.9.

---

Licensed Apache-2.0, see [LICENSE.md](../LICENSE.md).
