---
title: Lifecycle Policy Standard workflows
description: Worked lifecycles for initiatives, decision records, designs and risks, with the trigger and Dublin Core term on every transition.
---

# Workflows

![A document moves from draft to review to approved to superseded; each transition names its trigger and records a Dublin Core date or relation.](assets/workflow.svg)

Each policy in `lifecycle-policies.json` is a small state machine: the statuses
a document type may hold, and the transitions allowed between them. These four
are real policies, taken from the conformance examples
[`githerd.json`](0.9/examples/valid/githerd.json) (initiative, decision record,
design) and [`gelato.json`](0.9/examples/valid/gelato.json) (risk).

Each transition is labelled **trigger / Dublin Core term**: the events that may
cause it, then the term the document SHOULD record when it happens (see
[terms for the governed documents](dublin-core.md#terms-for-the-governed-documents)).
The statuses are examples. The standard requires the shape, not these names.

## Initiative

Approvers: `architect`, `productOwner`, `deliveryPlanning`. There is no
"delivering" status: an initiative stays `approved` while work is in flight.

```mermaid
stateDiagram-v2
  [*] --> draft : created
  draft --> approved : decision / dateAccepted
  draft --> archived : decision / modified
  draft --> superseded : decision / isReplacedBy
  approved --> archived : decision or milestone / modified
  approved --> superseded : decision / isReplacedBy
```

## Decision record (ADR)

Approvers: `architect`, `productOwner`, `technicalLead`. An approved decision is
never archived; a dead one is superseded by its successor.

```mermaid
stateDiagram-v2
  [*] --> proposed : created
  proposed --> review : decision or checkpoint / dateSubmitted
  proposed --> approved : decision / dateAccepted
  review --> approved : decision or checkpoint / dateAccepted
  approved --> superseded : decision / isReplacedBy
```

## Design

Approvers: `architect`, `technicalLead`.

```mermaid
stateDiagram-v2
  [*] --> draft : created
  draft --> review : decision or checkpoint / dateSubmitted
  draft --> delivered : decision / modified
  review --> approved : decision or checkpoint / dateAccepted
  approved --> delivered : milestone or checkpoint / modified
  draft --> superseded : decision / isReplacedBy
  review --> superseded : decision / isReplacedBy
  approved --> superseded : decision / isReplacedBy
```

## Risk

Approvers: `architect`, `productOwner`. Severity levels are repository-specific,
so they live in the policy's `extensions`:
`{ "severityLevels": ["low", "medium", "high", "critical"] }`.

```mermaid
stateDiagram-v2
  [*] --> open : created
  open --> review : checkpoint or decision / dateSubmitted
  review --> accepted : decision or checkpoint / dateAccepted
  review --> mitigated : decision / modified
  review --> escalated : decision or checkpoint / modified
  accepted --> closed : decision or milestone / modified
  mitigated --> closed : milestone or decision / modified
  escalated --> closed : decision / modified
```

## Writing your own

- List every status in `validStatuses`; a transition may only use declared
  statuses ([LP001](spec.md#semantic-rules)).
- Use `"from": "*"` for a move allowed from any status, such as withdrawing a
  document.
- Name triggers from your vocabulary, or from the core events `decision`,
  `checkpoint` and `milestone` ([LP002](spec.md#semantic-rules)).
- Put anything else your tools need, such as severity levels or review
  deadlines, in `extensions`.

---

Licensed Apache-2.0, see [LICENSE.md](../LICENSE.md).

<script type="module">
  // Render the Mermaid diagrams above. GitHub shows them natively; the Pages
  // site needs Mermaid itself. Pinned version, loaded only on this page.
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';
  for (const block of document.querySelectorAll('div.language-mermaid, pre > code.language-mermaid')) {
    const container = block.closest('div.language-mermaid') ?? block.parentElement;
    const diagram = document.createElement('pre');
    diagram.className = 'mermaid';
    diagram.textContent = block.textContent;
    container.replaceWith(diagram);
  }
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral' });
  await mermaid.run({ querySelector: 'pre.mermaid' });
</script>
