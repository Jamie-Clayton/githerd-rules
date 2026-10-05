// Proves the two validators agree: every example has the same schema verdict
// under Ajv and JsonSchema.Net, and neither saw an example the other missed.
// A schema tuned to one implementation's quirks fails here.
//
// Usage: node compare.mjs <ajv-results.json> <dotnet-results.json>

import { readFileSync } from 'node:fs';

const [ajvPath, dotnetPath] = process.argv.slice(2);
const ajv = JSON.parse(readFileSync(ajvPath, 'utf8'));
const dotnet = JSON.parse(readFileSync(dotnetPath, 'utf8'));

const names = [...new Set([...Object.keys(ajv), ...Object.keys(dotnet)])].sort();
const disagreements = names.filter((name) => ajv[name] !== dotnet[name]);
for (const name of disagreements) {
  console.log(`FAIL ${name}: Ajv=${ajv[name] ?? 'not run'} JsonSchema.Net=${dotnet[name] ?? 'not run'}`);
}
if (names.length === 0) {
  console.log('FAIL no results to compare');
  process.exit(1);
}
console.log(disagreements.length
  ? `\n${disagreements.length} disagreement(s) between validators`
  : `Ajv and JsonSchema.Net agree on all ${names.length} examples`);
process.exit(disagreements.length ? 1 : 0);
