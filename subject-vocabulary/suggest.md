---
title: Subject Vocabulary Standard 0.9 suggestion
description: How a suggester proposes subjects for a document, version 0.9 (pre-release).
---

# Subject Vocabulary Standard: suggestion

**Version 0.9, pre-release.** This page specifies how a suggester proposes
subjects for Markdown documents, so any language can implement it and two
suggesters given the same inputs propose the same subjects. The reference
suggester is
[`0.9/suggest/Suggest-Subjects.ps1`](0.9/suggest/Suggest-Subjects.ps1)
(PowerShell 7.4 and the `powershell-yaml` module). Its golden fixtures, in
`0.9/suggest/fixtures/`, pin the behaviour.

A suggester **proposes**; a person decides. It reads documents and never
writes one, and it has no parameter that could. A person accepts suggestions
by editing them into an acceptance record (`accepted`, `acceptedBy`,
`acceptedAt` per item in the suggestions file) or by writing the subject
themselves; the pull-request review is the binding acceptance.

The key words MUST, MUST NOT, SHOULD and MAY are to be interpreted as described
in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) when, and only when, they
appear in all capitals.

## Inputs

- Markdown documents, read-only.
- The pinned core scheme and the repository's adoption register, resolved as
  [resolve.md](resolve.md) specifies. Under `replace` the core concepts and
  their hints take no part.
- Optionally, the link graph: front-matter `references`, `requires` and
  `isPartOf` between the documents given.

## 1. Read each document once

Split the document into fields:

| Field | Content |
| ----- | ------- |
| `subject` | The front-matter `subject` list, as written |
| `title` | Front-matter `title`, and the first level-1 heading |
| `description` | Front-matter `description` |
| `heading` | Every heading of level 2 to 6 |
| `body` | Every other line, excluding front matter and fenced code blocks |

Then **tokenise each field once**: normalise the text as resolve.md step 3
(NFC, simple lowercase), split it into words (maximal runs of letters, digits,
hyphens and underscores, with leading and trailing hyphens removed), and
count every phrase of one, two or three consecutive words. Every later step
looks phrases up in these counts; no step scans the text again, and nothing
is ever matched as a regular expression.

Component paths are read from the raw body, fenced code included: any run of
characters made of letters, digits, `.`, `_`, `-` and `/` that contains a `/`.

## 2. Concept labels

A concept's **labels** are its `prefLabel`, its `altLabel` entries and its
`hiddenLabel` entries, hints from the register merged in (resolve.md step 1).
Each label is normalised and tokenised like the text. A label of one to three
words is a phrase; a longer label never matches.

## 3. Signals

Each concept collects a raw score `s` from these signals. Each signal adds at
most once per concept per field, except where the table says otherwise.

| Signal | Field | Adds | When |
| ------ | ----- | ---- | ---- |
| `existing-subject` | `subject` | 4 | A `subject` entry resolves to the concept as `legacy`, `label` or `retired` (resolve.md). An entry that resolves as `active` means the document already carries the concept: it is never suggested. |
| `title` | `title` | 3 | Any label phrase occurs in the title |
| `description` | `description` | 2 | Any label phrase occurs in the description |
| `heading` | `heading` | 1.5 | Any label phrase occurs in a heading |
| `body` | `body` | min(3, 1 + ln n) | Label phrases occur n times in total in the body |
| `definition` | `definition` | min(cap, 0.5 x (m - 1)) | m >= 2 of the concept's definition terms occur anywhere in the document |
| `link-neighbour` | `references` | 0.5 per neighbour, at most 1.5 | A linked document given in the same run carries the concept (links on) |
| `component-path` | `body` | 1 | A component path pattern of the register matches a path in the body; it adds to the component's `broader` concept, or to the component itself when it is a top concept |

**Definition terms.** At vocabulary load, each concept's `definition` is
normalised and split into words once; words of fewer than three characters
and the words in [`0.9/suggest/stopwords.txt`](0.9/suggest/stopwords.txt) are
removed, and the rest, de-duplicated, are its terms. A document matches a term
when the term occurs as a word anywhere in its title, description, headings
or body. The cap defaults to 1.5; a suggester MAY expose it (the reference
calls it `-DefinitionWeight`) so the signal can be measured, and 0 disables
it.

**Component path patterns** match a whole path. `**` matches any run of
characters including `/`, `*` any run without `/`, and `?` one character
other than `/`. They are compared as strings only: a suggester never resolves
them against the file system.

**Link neighbours.** A `references`, `requires` or `isPartOf` value names a
neighbour when it equals another given document's front-matter `id`, or is a
relative path that reaches it. A neighbour carries the concepts its own
`subject` entries resolve to (any resolved status).

## 4. Score and choose

- `score = s / (s + 3)`, rounded to four decimal places (half away from zero).
- Suggest a concept when its score is 0.35 or more (s of about 1.62 or more),
  and the document does not already carry it.
- Order by score, highest first, then by notation in ordinal order; keep the
  first three.
- **Roll up.** For each kept local concept whose top concept (resolve.md step
  7) is a different concept, also suggest the top concept, unless the
  document carries it or it is already suggested, with the same score and
  reasons. Rolled-up suggestions come after the three and do not count
  towards them, so a reader sees both the theme and the ability it belongs
  to.

Each suggestion lists its reasons in the signal order of the table above, one
per signal and field: `signal`, `field`, `match` (the first matching label in
ordinal order, the matched definition terms joined by ", ", the first
neighbour's path, or the matched body path) and `weight` (rounded to four
decimal places). `s` is the sum of the reasons' rounded weights.

## 5. Output

A suggestions document valid against
[`0.9/suggestions.schema.json`](0.9/suggestions.schema.json): one entry per
document in path order (repository-relative, `/`-separated), with its
`existing` subject entries as written and its suggestions. The same inputs
always give the same document; `generatedAt` is optional and ignored when
outputs are compared.

## 6. Measuring

A suggester's quality is its recall against subjects people chose: run it
with each document's own `subject` entries hidden, and count, per concept,
the share of documents a person tagged with that concept that the suggester
proposes it for. The 0.9 baseline is recorded in the reference suggester's
tests: a synthetic labelled corpus in `0.9/suggest/recall/`, written for the
standard, with its per-concept recall in `0.9/suggest/recall/baseline.json`.
A change to a suggester MUST NOT lower any concept's recall on that corpus by
more than 0.05.

Measured on 2026-10-10 with the reference suggester against three private
repositories (1,350 Markdown documents), links on and each document's own
subjects hidden. Human tags (`subject`, `labels`, `tags` and `category`) were
mapped to concepts by the ten-entry map the 2026-10-07 tagging analysis used,
so only concepts that map has an entry for are measured. No document text is
reproduced here.

| Repository | Documents | Covered | Concept | Tagged | Recall, definition on | Recall, off |
| ---------- | --------- | ------- | ------- | ------ | --------------------- | ----------- |
| A | 486 | 98.8% | Governability | 53 | 0.96 | 0.94 |
| A | | | Traceability | 39 | 0.82 | 0.82 |
| A | | | Securability | 11 | 0.91 | 0.73 |
| A | | | Engineering quality | 9 | 1.00 | 1.00 |
| B | 448 | 82.1% | Engineering quality | 35 | 0.63 | 0.69 |
| B | | | Interoperability | 22 | 0.32 | 0.32 |
| B | | | Securability | 5 | 0.40 | 0.40 |
| C | 416 | 87.5% | Interoperability | 2 | 1.00 | 1.00 |
| C | | | Governability | 1 | 1.00 | 1.00 |

A covered document received 2.2 to 2.6 suggestions on average. Recall is
not the whole story: the suggester proposes up to three concepts where a
person often chose one, so a reviewer declines some; the coverage report (a
later release) measures how many are accepted.
