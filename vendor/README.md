# /vendor

Self-hosted third-party libraries. Zero network dependencies.

## Files to place here

1. **dexie.min.js** — Dexie 4.x (MIT). IndexedDB Promise wrapper.
   Download: https://unpkg.com/dexie@4/dist/dexie.min.js

2. **purify.min.js** — DOMPurify 3.x (MPL-2.0 / Apache-2.0). XSS sanitizer for rich text.
   Download: https://unpkg.com/dompurify@3/dist/purify.min.js

Both are loaded via classic `<script>` tags before the ES module app bundle,
so they attach `Dexie` and `DOMPurify` to `window`. The rest of the code
imports them via `window.Dexie` / `window.DOMPurify`.

## /5e-database (optional)

For the build-data.js pipeline, clone `bagelbits/5e-database` into
`vendor/5e-database/`. Not needed at runtime — only when regenerating
the bundled data under `/js/data/`.
