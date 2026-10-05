// Hand-drawn primitives for the Lifecycle Policy Standard explainers.
// rough.js with a fixed seed, so every build produces the same paths. Colours
// are applied through CSS classes with presentation-attribute fallbacks, so an
// SVG reads on light pages, and switches to a dark palette under
// prefers-color-scheme: dark where the viewer supports it.

import rough from 'roughjs';

export const W = 1600;
export const H = 1000;

const COLOURS = { ink: '#1F2933', accent: '#E4572E', hl: '#FFE066', paper: '#FFFDF7' };
const ROLE_BY_HEX = Object.fromEntries(Object.entries(COLOURS).map(([role, hex]) => [hex.toLowerCase(), role]));
const FONT = "'Segoe Print', 'Bradley Hand', 'Ink Free', 'Comic Sans MS', 'Comic Neue', cursive";

const gen = rough.generator();
let seed = 42;
const base = () => ({ seed: seed++, roughness: 1.3, bowing: 1.1, stroke: COLOURS.ink, strokeWidth: 2.4 });

const escapeXml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function paths(drawable, extraAttrs = '') {
  return gen.toPaths(drawable).map((p) => {
    const strokeRole = ROLE_BY_HEX[String(p.stroke).toLowerCase()];
    const fillRole = p.fill && p.fill !== 'none' ? ROLE_BY_HEX[String(p.fill).toLowerCase()] : null;
    const cls = [strokeRole && p.stroke !== 'none' ? `st-${strokeRole}` : '', fillRole ? `fi-${fillRole}` : ''].filter(Boolean).join(' ');
    const opacity = fillRole === 'hl' || strokeRole === 'hl' ? ' opacity="0.6"' : '';
    return `<path class="${cls}" d="${p.d}" stroke="${p.stroke}" stroke-width="${p.strokeWidth}" fill="${p.fill ?? 'none'}" stroke-linecap="round" stroke-linejoin="round"${opacity}${extraAttrs}/>`;
  }).join('');
}

const opts = (o = {}) => {
  const out = { ...base(), ...o };
  for (const key of ['stroke', 'fill']) if (out[key] && COLOURS[out[key]]) out[key] = COLOURS[out[key]];
  return out;
};

export const box = (x, y, w, h, o) => paths(gen.rectangle(x, y, w, h, opts(o)));
export const ellipse = (cx, cy, w, h, o) => paths(gen.ellipse(cx, cy, w, h, opts(o)));
export const circle = (cx, cy, d, o) => paths(gen.circle(cx, cy, d, opts(o)));
export const line = (x1, y1, x2, y2, o) => paths(gen.line(x1, y1, x2, y2, opts(o)));
export const path = (d, o) => paths(gen.path(d, opts(o)));
export const dashed = (x1, y1, x2, y2, o) => paths(gen.line(x1, y1, x2, y2, opts(o)), ' stroke-dasharray="14 10"');

export function arrow(x1, y1, x2, y2, o = {}) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const L = 20;
  const head = (s) => [x2 - L * Math.cos(a + s), y2 - L * Math.sin(a + s)];
  const [ax, ay] = head(0.45);
  const [bx, by] = head(-0.45);
  const shaft = o.dashed ? dashed(x1, y1, x2, y2, o) : line(x1, y1, x2, y2, o);
  return shaft + path(`M${ax} ${ay} L${x2} ${y2} L${bx} ${by}`, o);
}

// Highlighter swipe behind a label.
export const highlight = (x, y, w, h) => paths(gen.rectangle(x, y, w, h, opts({ stroke: 'none', fill: 'hl', fillStyle: 'solid', roughness: 2 })));

export function text(x, y, value, { size = 22, weight = 400, anchor = 'middle', role = 'ink', rotate = 0, lineHeight = 1.3 } = {}) {
  const lines = Array.isArray(value) ? value : [value];
  const transform = rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : '';
  const tspans = lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * lineHeight}">${escapeXml(l)}</tspan>`).join('');
  return `<text class="t-${role}" x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${COLOURS[role]}"${transform}>${tspans}</text>`;
}

export function numbered(cx, cy, n) {
  return circle(cx, cy, 52, { fill: 'ink', fillStyle: 'solid' }) + text(cx, cy + 9, String(n), { size: 26, weight: 700, role: 'paper' });
}

export function starPerson(cx, cy, scale = 1) {
  const r = 34 * scale;
  const spikes = Array.from({ length: 10 }, (_, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? r : r * 0.45;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)} ${(cy + 46 * scale + radius * Math.sin(angle)).toFixed(1)}`;
  });
  return circle(cx, cy, 30 * scale, { fill: 'ink', fillStyle: 'solid' }) + path(`M${spikes.join(' L')} Z`);
}

export function checkMark(cx, cy, size = 40, o) {
  return path(`M${cx - size * 0.5} ${cy} L${cx - size * 0.1} ${cy + size * 0.4} L${cx + size * 0.6} ${cy - size * 0.5}`, { strokeWidth: 6, ...o });
}

export function svg({ title, desc, body }) {
  const style = [
    '.paper{fill:#FFFDF7}',
    '.st-ink{stroke:#1F2933}.fi-ink,.t-ink{fill:#1F2933}',
    '.st-accent{stroke:#E4572E}.fi-accent{fill:#E4572E}',
    '.st-hl{stroke:#FFE066}.fi-hl{fill:#FFE066}',
    '.t-paper,.on-accent{fill:#FFFDF7}.st-paper{stroke:#FFFDF7}',
    '@media (prefers-color-scheme: dark){',
    '.paper{fill:#16191D}',
    '.st-ink{stroke:#ECEAE4}.fi-ink,.t-ink{fill:#ECEAE4}',
    '.st-hl{stroke:#6B5600}.fi-hl{fill:#6B5600}',
    '.t-paper{fill:#16191D}',
    '}'
  ].join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="title desc">`,
    `<title id="title">${escapeXml(title)}</title>`,
    `<desc id="desc">${escapeXml(desc)}</desc>`,
    `<!-- Lifecycle Policy Standard explainer. Apache-2.0, Copyright 2026 Jamie Clayton. Generated by .github/explainers; edit the generator, not this file. -->`,
    `<style>${style}</style>`,
    `<rect class="paper" x="0" y="0" width="${W}" height="${H}" fill="#FFFDF7"/>`,
    body,
    '</svg>',
    ''
  ].join('\n');
}

// Text that sits on an accent fill keeps the light colour in both themes.
export const onAccent = (x, y, value, o = {}) => text(x, y, value, { ...o, role: 'paper' }).replace('class="t-paper"', 'class="on-accent"');
