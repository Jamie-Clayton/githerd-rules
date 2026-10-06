---
title: Lifecycle Policy Standard and Jira
description: How lifecycle-policies.json lines up with Jira workflows, so a future integration is a mapping rather than a remodel.
---

# Jira mapping

**No synchronisation is offered.** The standard does not import, export or sync
Jira workflows. This page records how the data lines up, so that if a
repository later connects to Jira, the integration is a field-by-field mapping
rather than a remodel.

## Concepts

| Lifecycle Policy Standard | Jira | Notes |
| --- | --- | --- |
| A policy in `policies` (one per document type) | An issue type and the workflow assigned to it | |
| The `policies` object as a whole | A workflow scheme: which workflow each issue type uses | |
| Policy key and `type` | Issue type name | |
| `validStatuses` | The statuses in the workflow | Jira status names may contain spaces; tokens may not, so `In Progress` maps to `in-progress`. |
| `transitions[]`, `from` and `to` | Workflow transitions between statuses | |
| `"from": "*"` | A global transition, available from any status | |
| `triggeredBy` | The transition's name, or the event that fires it, such as an automation rule | Jira transitions are usually named by the action, such as "Approve"; the standard names the kind of event, such as `decision`. |
| `approverRoles` | A transition condition restricting it to members of a project role | |
| `vocabulary.roles` | Project roles | |
| `field` | The issue's Status field | Jira always uses Status, so `field` has no Jira equivalent beyond that. |
| `identifier`, `title` | Workflow or workflow scheme name and ID | |
| `extensions` | Custom fields, status categories, or anything else a Jira integration needs | Carried as opaque data, for example `{ "jira": { "statusCategory": { "review": "In Progress" } } }`. |

## Worked examples

Three conformance examples carry Atlassian-shaped data in `extensions`, so
the mapping can be read off real files.

**A Jira Software Kanban board.**
[`kanban-delivery.json`](0.9/examples/valid/kanban-delivery.json) models a
Kanban project's columns as statuses, with `field` set to `status`. Each
policy names its Jira issue type and maps every status to a Jira status
category:

```json
"story": {
  "type": "story",
  "field": "status",
  "validStatuses": ["backlog", "selected-for-development", "in-progress", "in-review", "done"],
  "approverRoles": ["productOwner"],
  "extensions": {
    "jira": {
      "issueType": "Story",
      "statusCategory": {
        "backlog": "To Do",
        "selected-for-development": "To Do",
        "in-progress": "In Progress",
        "in-review": "In Progress",
        "done": "Done"
      }
    }
  }
}
```

Transitions carry the Jira transition name and, where one applies, the
condition that would restrict it, such as "Only the product owner" on
`in-review` to `done`. The board's work-in-progress limits sit in the file's
top-level `extensions`.

**Jira Service Management change requests.**
[`operational-runbooks.json`](0.9/examples/valid/operational-runbooks.json)
has a `change-request` policy modelled on a typical change-management
workflow: planning, awaiting approval, scheduled, implementing,
post-implementation review, then completed, declined or failed. Its
`approverRoles`, `changeManager` and `changeAdvisoryBoard`, correspond to the
approvers a change request is routed to, and `extensions.jira.issueType` is
`Change`.

**Confluence page status.** Decision records in
[`governance-documents.json`](0.9/examples/valid/governance-documents.json)
and runbooks in `operational-runbooks.json` map their statuses to Confluence
page statuses (Rough draft, In progress, Ready for review, Verified) in
`extensions.confluence.pageStatus`, for teams that keep those documents in
Confluence rather than in a repository.

## Jira concepts with no counterpart

| Jira | Why it has no counterpart |
| --- | --- |
| **Validators** | They check input at transition time, such as "a field must be set". The standard describes which moves are allowed, not what data a move needs. |
| **Post-functions** | They act after a transition, such as setting a field or firing an event. The standard records no behaviour. |
| **Transition screens** | User-interface configuration. |
| **Resolutions** | Jira's separate "why it is done" field. A repository that needs it can carry it in `extensions`. |
| **Status categories** | Jira's To Do, In Progress and Done grouping. Not part of the standard; carry it in `extensions` if needed. |

An integration that writes to Jira would have to supply these itself. One that
reads from Jira would drop them, or keep them in `extensions`.

## Shape of a future integration

1. Map each policy to an issue type and its workflow, and the `policies` object
   to a workflow scheme.
2. Map tokens to Jira names, keeping the mapping in `extensions` rather than
   renaming statuses, because tokens cannot contain spaces.
3. Map `approverRoles` to "user is in project role" conditions.
4. Keep anything Jira-only in `extensions`, so a round trip through the
   standard's file loses nothing.

Jira, Jira Software, Jira Service Management and Confluence are trademarks of
Atlassian. The Lifecycle Policy Standard is independent and is not affiliated
with or endorsed by Atlassian.

---

Licensed Apache-2.0, see [LICENSE.md](../LICENSE.md).
