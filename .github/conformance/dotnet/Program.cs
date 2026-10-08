// Second, independent validator for the conformance suite of every standard
// in this repository (JsonSchema.Net). It finds standards and their suites
// by the same convention as standards.mjs: a standard is a top-level folder
// (not starting with . or _) holding <major.minor>/ folders; in each, every
// <stem>.schema.json is a suite whose examples are in examples/ when the stem
// is the standard's name, else in examples/<stem>/. It evaluates every example
// against its schema and checks schema-level expectations itself, then writes
// each example's verdict to --out so compare.mjs can prove it agrees with Ajv
// example by example.
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

var standards = SubfolderNames(root)
    .Where(name => !name.StartsWith('.') && !name.StartsWith('_'))
    .Select(folder => (Folder: folder, Versions: SubfolderNames(Path.Combine(root, folder)).Where(IsVersion).ToList()))
    .Where(standard => standard.Versions.Count > 0)
    .ToList();

if (standards.Count == 0)
{
    failures++;
    Console.WriteLine("FAIL no <standard>/<major.minor>/ folder found");
}

foreach (var (folder, versions) in standards)
{
    foreach (var version in versions)
    {
        var dir = Path.Combine(root, folder, version);
        // One registry per version, so its schemas can reference each other.
        var buildOptions = new BuildOptions { SchemaRegistry = new SchemaRegistry() };
        var options = new EvaluationOptions { OutputFormat = OutputFormat.List };

        foreach (var schemaFile in Directory.GetFiles(dir, "*.schema.json").Order(StringComparer.Ordinal))
        {
            var stem = Path.GetFileName(schemaFile)[..^".schema.json".Length];
            var schema = JsonSchema.FromText(File.ReadAllText(schemaFile), buildOptions);
            var examplesDir = stem == folder ? Path.Combine(dir, "examples") : Path.Combine(dir, "examples", stem);
            if (!Directory.Exists(Path.Combine(examplesDir, "valid")))
            {
                Report(false, "", $"{folder}/{version}: {stem}.schema.json has no examples");
                continue;
            }

            foreach (var kind in new[] { "valid", "invalid" })
            {
                var exampleFolder = Path.Combine(examplesDir, kind);
                if (!Directory.Exists(exampleFolder))
                {
                    continue;
                }
                var relative = Path.GetRelativePath(dir, exampleFolder).Replace('\\', '/');
                foreach (var file in Directory.GetFiles(exampleFolder, "*.json")
                             .Where(f => !f.EndsWith(".expected.json", StringComparison.Ordinal))
                             .Order(StringComparer.Ordinal))
                {
                    var name = $"{folder}/{version}/{relative}/{Path.GetFileName(file)}";
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

static IEnumerable<string> SubfolderNames(string path) =>
    Directory.GetDirectories(path).Select(p => Path.GetFileName(p)!).Order(StringComparer.Ordinal);

static bool IsVersion(string name) => Regex.IsMatch(name, @"^[0-9]+\.[0-9]+$");

string? ArgValue(string flag)
{
    var index = Array.IndexOf(args, flag);
    return index >= 0 && index + 1 < args.Length ? args[index + 1] : null;
}
