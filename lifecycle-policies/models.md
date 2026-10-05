---
title: Models and APIs from the Lifecycle Policy Standard
description: Generate C# and TypeScript models, and describe REST APIs, from the published lifecycle-policies.json schema.
---

# Models and APIs

The standard is defined in JSON Schema 2020-12, so the schema itself is the
contract for models and APIs. Generate from it; do not hand-write a second copy.

Every command below was run against the published 0.9 schema on 2026-10-05,
with the tool versions shown.

```text
https://jamie-clayton.github.io/githerd-rules/lifecycle-policies/0.9/lifecycle-policies.schema.json
```

Keep a copy of the schema version you pin in your own repository, and generate
from that copy, so a build never depends on the network and an upgrade is a
reviewable change.

## C# with Corvus.Text.Json

Verified with .NET 10, `Corvus.Text.Json` and `Corvus.Text.Json.SourceGenerator`
5.7.5.

```bash
dotnet add package Corvus.Text.Json.SourceGenerator
dotnet add package Corvus.Text.Json
mkdir -p Schemas
curl -sSfo Schemas/lifecycle-policies.schema.json \
  https://jamie-clayton.github.io/githerd-rules/lifecycle-policies/0.9/lifecycle-policies.schema.json
```

Register the schema with the source generator in your `.csproj`:

```xml
<ItemGroup>
  <AdditionalFiles Include="Schemas/lifecycle-policies.schema.json" />
</ItemGroup>
```

Declare the type, then parse and validate:

```csharp
using Corvus.Text.Json;
using Example.Policies;

using var doc = ParsedJsonDocument<LifecyclePolicies>.Parse(
    File.ReadAllText("docs/registers/lifecycle-policies.json"));
LifecyclePolicies policies = doc.RootElement;

Console.WriteLine((string)policies.Title);
Console.WriteLine(policies.EvaluateSchema()); // True when the file meets the schema rules

namespace Example.Policies
{
    [JsonSchemaTypeGenerator("Schemas/lifecycle-policies.schema.json")]
    public readonly partial struct LifecyclePolicies;
}
```

`EvaluateSchema()` checks the schema rules only. The
[semantic rules](spec.md#semantic-rules) LP001 to LP005 compare parts of the
file with each other and need code of their own; the reference implementation
is [`semantic.mjs`](https://github.com/Jamie-Clayton/githerd-rules/blob/main/.github/conformance/semantic.mjs).

## TypeScript with json-schema-to-typescript

Verified with `json-schema-to-typescript` 15 and TypeScript 5 in `--strict` mode.

```bash
curl -sSfo lifecycle-policies.schema.json \
  https://jamie-clayton.github.io/githerd-rules/lifecycle-policies/0.9/lifecycle-policies.schema.json
npx json-schema-to-typescript@15 \
  -i lifecycle-policies.schema.json -o lifecycle-policies.d.ts --strictIndexSignatures
```

`--strictIndexSignatures` is needed: `fieldContract` allows extra string keys
beside its optional ones, and without the flag the generated type fails
TypeScript's strict checks (error TS2411).

```ts
import { readFileSync } from "node:fs";
import type { LifecyclePolicies } from "./lifecycle-policies";

const policies = JSON.parse(readFileSync("lifecycle-policies.json", "utf8")) as LifecyclePolicies;
```

The types describe the shape; they do not validate. Validate with a JSON Schema
2020-12 validator such as [Ajv](https://ajv.js.org/) (`ajv/dist/2020`) before
trusting the cast.

## REST APIs with OpenAPI 3.1

OpenAPI 3.1 uses the JSON Schema 2020-12 dialect, so an API that serves or
accepts lifecycle policies can reference the published schema directly. There
is no translation step, so nothing is lost. Verified with `@redocly/cli` 1:
`lint` passes and `bundle --dereferenced` resolves the remote reference.

```yaml
openapi: 3.1.0
info:
  title: Example policy service
  version: 1.0.0
paths:
  /repositories/{repository}/lifecycle-policies:
    get:
      operationId: getLifecyclePolicies
      parameters:
        - name: repository
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: The repository's lifecycle-policies.json
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LifecyclePolicies'
components:
  schemas:
    LifecyclePolicies:
      $ref: 'https://jamie-clayton.github.io/githerd-rules/lifecycle-policies/0.9/lifecycle-policies.schema.json'
```

```bash
npx @redocly/cli@1 lint openapi.yaml
npx @redocly/cli@1 bundle openapi.yaml --dereferenced -o openapi.bundled.json
```

## Validating in an editor

Editors that understand JSON Schema, such as Visual Studio Code, read the
`$schema` key and validate the file as you type. No extension or configuration
is needed.

---

Licensed Apache-2.0, see [LICENSE.md](../LICENSE.md).
