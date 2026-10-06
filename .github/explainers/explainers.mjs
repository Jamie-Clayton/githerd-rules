// The five explainers for the Lifecycle Policy Standard pages. Each makes one
// idea land, with the accent colour reserved for its focal element.
//
// Usage: node explainers.mjs [--out <folder>]   (default: lifecycle-policies/assets)

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  W, svg, box, ellipse, arrow, line, text, onAccent, highlight, numbered, starPerson, checkMark
} from './sketch.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outIndex = process.argv.indexOf('--out');
const out = outIndex >= 0 ? process.argv[outIndex + 1] : join(here, '..', '..', 'lifecycle-policies', 'assets');

const title = (t) => text(W / 2, 92, t, { size: 52, weight: 700 });
const solidAccent = { fill: 'accent', fillStyle: 'solid', stroke: 'accent' };

// 1. Purpose: one file format, many users. Hub layout; focal is the standard.
const purpose = svg({
  title: 'Why a lifecycle policy standard',
  desc: 'One public file format, lifecycle-policies.json, for decision records, Kanban delivery work and runbooks alike, that any repository or tool can pin and validate, with data that maps to Jira later.',
  body: [
    title('Why a lifecycle policy standard?'),
    ellipse(800, 480, 620, 280, solidAccent),
    onAccent(800, 462, 'One public file format', { size: 40, weight: 700 }),
    onAccent(800, 515, 'lifecycle-policies.json', { size: 30, weight: 700 }),
    box(110, 220, 330, 130), text(275, 278, 'Decisions', { size: 30, weight: 700 }), text(275, 320, 'records, designs', { size: 22 }),
    box(1160, 220, 330, 130), text(1325, 278, 'Kanban board', { size: 30, weight: 700 }), text(1325, 320, 'stories, bugs', { size: 22 }),
    box(110, 640, 330, 130), text(275, 698, 'Runbooks', { size: 30, weight: 700 }), text(275, 740, 'and change requests', { size: 22 }),
    box(1160, 640, 330, 130), text(1325, 698, 'Jira, one day', { size: 30, weight: 700 }), text(1325, 740, 'data maps cleanly', { size: 22 }),
    arrow(440, 300, 540, 395), arrow(1160, 300, 1060, 395),
    arrow(440, 700, 545, 575), arrow(1160, 700, 1055, 575, { dashed: true }),
    highlight(470, 845, 660, 56),
    text(800, 883, 'Checked by any JSON Schema validator', { size: 28 })
  ].join('\n')
});

// 2. Anatomy: what is in the file. Focal is the policies band.
const bands = [
  { y: 175, h: 90, label: '"$schema"', note: 'The pin: which version you follow', side: 'left' },
  { y: 285, h: 90, label: 'title, identifier, modified', note: 'Dublin Core: what, who, when', side: 'left' },
  { y: 395, h: 90, label: '"vocabulary"', note: 'Your roles and trigger events', side: 'right' },
  { y: 505, h: 250, label: '"policies"', note: 'One policy per document type', side: 'right', focal: true },
  { y: 775, h: 90, label: '"extensions"', note: 'Your own keys, kept apart', side: 'left' }
];
const anatomy = svg({
  title: 'Anatomy of lifecycle-policies.json',
  desc: 'The file has five parts: the $schema pin, Dublin Core metadata, a vocabulary of roles and events, one policy per document type, and an extensions object for your own keys. The policies are the heart of it.',
  body: [
    title('Anatomy of lifecycle-policies.json'),
    box(540, 150, 520, 740),
    ...bands.map((b) => [
      b.focal ? box(565, b.y, 470, b.h, solidAccent) : box(565, b.y, 470, b.h),
      b.focal
        ? onAccent(800, b.y + 70, b.label, { size: 34, weight: 700 }) + onAccent(800, b.y + 130, ['validStatuses', 'transitions', 'approverRoles'], { size: 24, lineHeight: 1.5 })
        : text(800, b.y + b.h / 2 + 9, b.label, { size: 26 }),
      b.side === 'left'
        ? text(480, b.y + b.h / 2 + 8, b.note, { size: 22, anchor: 'end', weight: b.focal ? 700 : 400 }) + arrow(490, b.y + b.h / 2, 555, b.y + b.h / 2)
        : text(1120, b.y + b.h / 2 + 8, b.note, { size: b.focal ? 28 : 22, anchor: 'start', weight: b.focal ? 700 : 400 }) + arrow(1110, b.y + b.h / 2, 1045, b.y + b.h / 2)
    ].join('')),
    text(800, 950, 'A local file per repository, in a standard shape', { size: 22 })
  ].join('\n')
});

// 3. Workflow: how a document moves. Spine; focal is the approval step.
const states = [
  { x: 120, label: 'draft' }, { x: 470, label: 'review' }, { x: 820, label: 'approved', focal: true }, { x: 1170, label: 'superseded' }
];
const workflow = svg({
  title: 'How a document moves through its lifecycle',
  desc: 'A document moves from draft to review to approved to superseded. Each transition names its trigger and records a Dublin Core date or relation, and the approval step is decided by the roles the policy names.',
  body: [
    title('How a document moves through its lifecycle'),
    text(120, 300, 'starts here: dcterms created', { size: 22, anchor: 'start' }), arrow(200, 315, 240, 372),
    ...states.map((s) => (s.focal
      ? box(s.x, 380, 310, 130, solidAccent) + onAccent(s.x + 155, 458, s.label, { size: 36, weight: 700 })
      : box(s.x, 380, 310, 130) + text(s.x + 155, 455, s.label, { size: 32, weight: 700 }))),
    arrow(430, 445, 470, 445), arrow(780, 445, 820, 445), arrow(1130, 445, 1170, 445),
    numbered(450, 560, 1), text(450, 625, ['dateSubmitted', 'checkpoint'], { size: 22 }),
    numbered(800, 560, 2), text(800, 625, ['dateAccepted', 'decision'], { size: 22 }),
    numbered(1150, 560, 3), text(1150, 625, ['isReplacedBy', 'decision'], { size: 22 }),
    starPerson(975, 250, 1.1),
    text(1040, 245, ['approverRoles', 'decide this step'], { size: 24, anchor: 'start', weight: 700 }),
    arrow(975, 320, 975, 372),
    highlight(330, 815, 940, 56),
    text(800, 853, 'Every transition names its trigger: decision, checkpoint or milestone', { size: 26 })
  ].join('\n')
});

// 4. Dublin Core map: every key is a shared word. Hub; focal is dcterms.
const elements = ['title', 'creator', 'subject', 'description', 'publisher', 'contributor', 'date', 'type',
  'format', 'identifier', 'source', 'language', 'relation', 'coverage', 'rights'];
const ring = elements.map((name, i) => {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / elements.length;
  const x = 800 + 600 * Math.cos(angle);
  const y = 500 + 300 * Math.sin(angle);
  return box(x - 95, y - 30, 190, 60) + text(x, y + 8, name, { size: 24 });
});
const dublinCore = svg({
  title: 'The Dublin Core map',
  desc: 'Every envelope key in lifecycle-policies.json is one of the fifteen Dublin Core elements or a DCMI term, so any tool that knows Dublin Core understands the file. $schema maps to conformsTo.',
  body: [
    title('The Dublin Core map'),
    ...ring,
    ellipse(800, 500, 560, 280, solidAccent),
    onAccent(800, 482, 'dcterms', { size: 44, weight: 700 }),
    onAccent(800, 534, '15 shared words', { size: 30, weight: 700 }),
    highlight(470, 872, 660, 96),
    text(800, 910, ['$schema is conformsTo', 'replacedBy is isReplacedBy'], { size: 24 })
  ].join('\n')
});

// 5. Adopt: three steps. Spine; focal is the passing result.
const steps = [
  { x: 90, n: 1, head: 'Copy an example', sub: ['examples/valid/', 'minimal.json'] },
  { x: 470, n: 2, head: 'Set $schema', sub: ['.../lifecycle-policies/0.9/', 'lifecycle-policies.schema.json'] },
  { x: 850, n: 3, head: 'Run any validator', sub: ['Ajv, JsonSchema.Net,', 'your editor'] }
];
const adopt = svg({
  title: 'Adopt the standard in three steps',
  desc: 'Copy an example file, set its $schema to the released 0.9 schema URL, and run any JSON Schema validator. The result is a policy file that conforms.',
  body: [
    title('Adopt it in three steps'),
    ...steps.map((s) => [
      numbered(s.x + 150, 300, s.n),
      box(s.x, 360, 300, 230),
      text(s.x + 150, 420, s.head, { size: 28, weight: 700 }),
      text(s.x + 150, 480, s.sub, { size: 20 })
    ].join('')),
    arrow(395, 475, 465, 475), arrow(775, 475, 845, 475), arrow(1155, 475, 1215, 475),
    ellipse(1385, 475, 300, 220, solidAccent),
    onAccent(1385, 465, 'Conforms', { size: 38, weight: 700 }),
    checkMark(1385, 520, 44, { stroke: 'paper' }),
    starPerson(1385, 650, 1), text(1385, 760, 'you, in minutes', { size: 22 }),
    highlight(520, 860, 560, 56),
    text(800, 898, 'No special tooling needed', { size: 28 })
  ].join('\n')
});

mkdirSync(out, { recursive: true });
for (const [name, content] of Object.entries({ purpose, anatomy, workflow, 'dublin-core': dublinCore, adopt })) {
  writeFileSync(join(out, `${name}.svg`), content);
  console.log(`wrote ${name}.svg`);
}
