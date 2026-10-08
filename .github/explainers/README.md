# Explainer generator

Generates the explainer SVGs in each standard's `assets/` folder, for example
the five in `lifecycle-policies/assets/`. Each standard has its own drawings,
`<standard>.mjs`, sharing the shapes in `sketch.mjs`. The SVGs are build
output: edit the drawings or `sketch.mjs`, then regenerate. CI fails if a
committed SVG differs from what the generator produces, or if a standard has
an `assets/` folder and no generator.

```bash
npm ci
node explainers.mjs --standard lifecycle-policies    # writes lifecycle-policies/assets/*.svg
node render.mjs ../../lifecycle-policies/assets /tmp/previews   # PNG and 320px previews for review
```

Each explainer makes one idea land, and the accent colour is reserved for its
focal element. Check the PNG and the 320px thumbnail before committing: the
focal element should still be the most prominent thing when blurred, and the
title should still read at thumbnail size.

## Provenance

- Shapes: [rough.js](https://github.com/rough-stuff/rough) (MIT), fixed seeds,
  so the output is reproducible.
- Previews: [resvg-js](https://github.com/yisibl/resvg-js) (MPL-2.0), used only
  to render review PNGs; nothing from it is published.
- Text: system handwriting fonts referenced by name (Segoe Print, Bradley Hand,
  Ink Free, Comic Sans MS, Comic Neue, then the generic `cursive`). No font is
  embedded or redistributed.
- Drawings: original, made for this standard. No third-party artwork, logos or
  likenesses.

Licensed Apache-2.0, as the rest of this repository.
