// Second, independent validator for the Lifecycle Policy Standard's
// conformance suite (JsonSchema.Net). It evaluates every example of every
// published version against that version's schema and checks schema-level
// expectations itself, then writes each example's verdict to --out so
// compare.mjs can prove it agrees with Ajv example by example.
//
// Usage: dotnet run -- --root <repo root> --out <results.json>

using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Json.Schema;

var root = ArgValue("--root") ?? Directory.GetCurrentDirectory();
var outPath = ArgValue("--out");

var results = new SortedDictionary<string, bool>(StringComparer.Ordinal);
var failures = 0;

var standardRoot = Path.Combine(root, "lifecycle-policies");
var versions = Directory.GetDirectories(standardRoot)
    .Select(Path.GetFileName)
    .Where(name => name is not null && Regex.IsMatch(name, @"^[0-9]+\.[0-9]+$"))
    .Select(name => name!)
    .Order(StringComparer.Ordinal)
    .ToList();

foreach (var version in versions)
{
    var dir = Path.Combine(standardRoot, version);
    var schema = JsonSchema.FromText(File.ReadAllText(Path.Combine(dir, "lifecycle-policies.schema.json")));
    var options = new EvaluationOptions { OutputFormat = OutputFormat.List };

    foreach (var kind in new[] { "valid", "invalid" })
    {
        var folder = Path.Combine(dir, "examples", kind);
        foreach (var file in Directory.GetFiles(folder, "*.json")
                     .Where(f => !f.EndsWith(".expected.json", StringComparison.Ordinal))
                     .Order(StringComparer.Ordinal))
        {
            var name = $"{version}/{kind}/{Path.GetFileName(file)}";
            using var document = JsonDocument.Parse(File.ReadAllText(file));
            var evaluation = schema.Evaluate(document.RootElement, options);
            results[name] = evaluation.IsValid;

            var keywords = (evaluation.Details ?? [])
                .Where(d => d.Errors is not null)
                .SelectMany(d => d.Errors!.Keys)
                .ToHashSet(StringComparer.Ordinal);

            if (kind == "valid")
            {
                Report(evaluation.IsValid, $"{name}: valid", $"{name}: expected valid, failed {string.Join(", ", keywords)}");
                continue;
            }

            var expected = JsonNode.Parse(File.ReadAllText(Path.ChangeExtension(file, ".expected.json")))!;
            var level = (string)expected["level"]!;
            var rule = (string)expected["rule"]!;
            if (level == "schema")
            {
                Report(!evaluation.IsValid && keywords.Contains(rule),
                    $"{name}: rejected by the schema ({rule})",
                    $"{name}: expected the {rule} keyword to fail; valid={evaluation.IsValid}, failed [{string.Join(", ", keywords)}]");
            }
            else
            {
                // Semantic rules are outside JSON Schema: the document must be schema-valid.
                Report(evaluation.IsValid, $"{name}: schema-valid, as {rule} requires",
                    $"{name}: {rule} example must be schema-valid; failed [{string.Join(", ", keywords)}]");
            }
        }
    }
}

if (outPath is not null)
{
    File.WriteAllText(outPath, JsonSerializer.Serialize(results, new JsonSerializerOptions { WriteIndented = true }) + "\n");
}

Console.WriteLine(failures == 0 ? "\nJsonSchema.Net conformance passed" : $"\n{failures} JsonSchema.Net conformance failure(s)");
return failures == 0 ? 0 : 1;

void Report(bool ok, string passMessage, string failMessage)
{
    if (ok) { Console.WriteLine($"ok   {passMessage}"); }
    else { failures++; Console.WriteLine($"FAIL {failMessage}"); }
}

string? ArgValue(string flag)
{
    var index = Array.IndexOf(args, flag);
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
}
