import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSvg } from '../check-svg.mjs';

const good = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img" aria-labelledby="t d">
  <title id="t">Purpose</title><desc id="d">Why the standard exists.</desc>
  <defs><marker id="m"/></defs><path d="M0 0" marker-end="url(#m)"/><use href="#m"/>
</svg>`;

const rules = (svg) => checkSvg(svg).map((f) => f.rule).sort();

test('a clean SVG with title and desc passes', () => {
  assert.deepEqual(checkSvg(good), []);
});

test('a missing title is reported', () => {
  assert.deepEqual(rules(good.replace(/<title[^>]*>.*?<\/title>/, '')), ['title']);
});

test('an empty desc is reported', () => {
  assert.deepEqual(rules(good.replace(/<desc id="d">.*?<\/desc>/, '<desc id="d">  </desc>')), ['desc']);
});

test('a script element is reported, whatever its case', () => {
  assert.deepEqual(rules(good.replace('</svg>', '<SCRIPT>alert(1)</SCRIPT></svg>')), ['script']);
});

test('an event-handler attribute is reported', () => {
  assert.deepEqual(rules(good.replace('<path d="M0 0"', '<path onclick="x()" d="M0 0"')), ['event-handler']);
});

test('external href, xlink:href, url() and @import are reported; local # references are not', () => {
  assert.deepEqual(rules(good.replace('<use href="#m"/>', '<use href="https://evil.example/x.svg#a"/>')), ['external-reference']);
  assert.deepEqual(rules(good.replace('<use href="#m"/>', '<image xlink:href="data.png"/>')), ['external-reference']);
  assert.deepEqual(rules(good.replace('url(#m)', 'url(https://evil.example/m)')), ['external-reference']);
  assert.deepEqual(rules(good.replace('<defs>', '<style>@import "https://evil.example/a.css";</style><defs>')), ['external-reference']);
});

test('a foreignObject is reported, because it can carry HTML', () => {
  assert.deepEqual(rules(good.replace('</svg>', '<foreignObject><div/></foreignObject></svg>')), ['foreign-object']);
});
