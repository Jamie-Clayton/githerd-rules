---
title: Adopt the Subject Vocabulary Standard 0.9
description: Adopting the subject vocabulary in a repository, offline and with PowerShell 7.4 only.
---

# Adopt the Subject Vocabulary Standard

**Version 0.9, pre-release.** Everything here runs offline with PowerShell 7.4.
The suggester also needs the `powershell-yaml` module; nothing else is
required, and no Githerd or other tool is involved.

## 1. Keep a copy of the version you pin

Copy the released `subject-vocabulary/0.9/` folder, from the
`subject-vocabulary-v0.9.x` tag of
[githerd-rules](https://github.com/Jamie-Clayton/githerd-rules), into your
repository, for example under `schemas/vendor/subject-vocabulary/0.9/`. Checks
then run without the network, and an upgrade arrives as a reviewable change.
Replace the folder whole when you upgrade; never edit it.

## 2. Write your register

Save `docs/registers/subject-vocabulary.json`, starting from an example:

- [`minimal.json`](0.9/examples/valid/minimal.json): pin the standard, add nothing.
- [`local-themes.json`](0.9/examples/valid/local-themes.json): extend the core
  with your own themes, components, hints and a map of the tags you used before.
- [`replace-with-top-concepts.json`](0.9/examples/valid/replace-with-top-concepts.json):
  replace the core with your own set, matched to the core where you can.

```json
{
  "$schema": "https://jamie-clayton.github.io/githerd-rules/subject-vocabulary/0.9/subject-vocabulary.schema.json",
  "title": "Example repository subject vocabulary",
  "identifier": "https://example.org/registers/subject-vocabulary",
  "modified": "2026-10-10",
  "conceptBase": "https://example.org/subjects/",
  "concepts": [
    {
      "notation": "theme:dashboard-ux",
      "prefLabel": "Dashboard UX",
      "definition": "The dashboard is quick to read and pleasant to use.",
      "broader": ["ability:discoverability"]
    }
  ]
}
```

Give every concept a `definition`: the promise it makes. People choose by it,
and the suggester uses it as a signal. Map the tag strings you already use in
`legacy`, so existing documents get suggestions straight away.

## 3. Check it

```powershell
pwsh schemas/vendor/subject-vocabulary/0.9/check/Test-SubjectVocabulary.ps1 -RegisterPath docs/registers/subject-vocabulary.json
```

The guard checks the JSON Schema and rules SV001 to SV009 against the copy
beside it, prints one finding per problem and exits 2 if anything blocks. Run
it on every commit; it reads nothing outside the two files.

## 4. Suggest, then let a person choose

```powershell
pwsh schemas/vendor/subject-vocabulary/0.9/suggest/Suggest-Subjects.ps1 -Path docs -RepositoryRoot . -WithLinks -AsJson
```

The suggester writes a suggestions document to the output, with the reasons
for each suggestion. It never edits a document. A person reviews it and writes
the subjects they accept, or marks them `accepted` with `acceptedBy` and
`acceptedAt` for a tool to apply in their own working tree; the pull-request
review decides.

To see what a subject means, resolve it:

```powershell
pwsh schemas/vendor/subject-vocabulary/0.9/resolve/Resolve-Subject.ps1 -Scheme schemas/vendor/subject-vocabulary/0.9/scheme.json -Register docs/registers/subject-vocabulary.json -Token 'lineage', 'theme:dashboard-ux' -AsJson
```

## Upgrading

Copy the new version's folder beside the old one, change `$schema`, run the
guard, and remove the old folder in the same pull request. Retired concepts
name their replacement, and the resolver follows it.

---

Licensed Apache-2.0, see [LICENSE.md](../LICENSE.md).
