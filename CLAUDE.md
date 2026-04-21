# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. Serve the project root over HTTP (ES modules block `file://`):

```bash
npx serve . --listen 8080
```

Then open `http://localhost:8080`.

Before first run, vendor scripts must be present (one-time download):
```bash
curl -L https://unpkg.com/dexie@4/dist/dexie.min.js -o vendor/dexie.min.js
curl -L https://unpkg.com/dompurify@3/dist/purify.min.js -o vendor/purify.min.js
```

Syntax-check all JS without a browser:
```bash
find js -name "*.js" -exec node --check {} \;
```

## Architecture

**No framework, no build step, no bundler.** Pure ES modules loaded directly by the browser. `index.html` loads two classic `<script>` vendor tags (Dexie, DOMPurify attaching to `window`), then `<script type="module" src="js/main.js">`.

### Data flow

```
Character doc (persisted JSON)
    ↓
deriveAll(doc)  →  DerivedStats object  (pure, no state)
    ↓
UI components render from { store.doc, store.derived }
```

`CharacterStore` (`js/engine/store.js`) wraps the raw document. Call `store.update(fn)` to mutate — it re-runs `deriveAll`, emits `"change"`, and debounce-saves (500ms) to IndexedDB. Never mutate `store.doc` directly.

### Key architectural rules

- **Derived stats are never persisted.** AC, skill modifiers, spell DC, etc. are always recomputed by `deriveAll()` from the raw document. Only the raw character JSON is saved.
- **SRD 5.1 only** (OGL 1.0a). All rule data is hand-authored static ES modules under `js/data/`. No API calls, no fetch at runtime.
- **One subclass per class** in the data — the only subclass included for each class is the one published in the SRD.
- **Schema versioning**: every character doc has `schemaVersion`. Bumping it requires adding a migration in `js/engine/migrations.js`.

### Module map

| Path | Purpose |
|---|---|
| `js/data/` | Static SRD data (spells, classes, races, equipment, rules). Read-only at runtime. |
| `js/engine/derive.js` | `deriveAll(doc)` — single pure function, the calculation engine. |
| `js/engine/store.js` | `CharacterStore extends Emitter` — observable wrapper around a character doc. |
| `js/engine/characterFactory.js` | `blankCharacter(partial)` — canonical empty doc shape + `SCHEMA_VERSION`. |
| `js/storage/idbStore.js` | IndexedDB via Dexie; falls back to localStorage if Dexie is unavailable. |
| `js/storage/localStore.js` | `localStorage` roster index (id, name, class, level, hp — summary only). |
| `js/ui/router.js` | Hash-based router. Routes: `#/roster`, `#/creator`, `#/sheet/:id`. |
| `js/ui/screens/` | Full-page screens: `roster.js`, `creator.js`, `sheet.js`. |
| `js/ui/components/` | Reusable components. All take `store` (CharacterStore) as first arg. |
| `js/util/dom.js` | `el(tag, attrs, ...children)` — the only DOM builder used throughout. |

### Storage split

- **localStorage** — roster index only (`grimoire:roster`). Written via `updateRosterEntry()` after every save.
- **IndexedDB** — full character documents. Dexie DB name `"grimoire"`, table `characters`.
- **Export format** — raw character JSON, `.grimoire.json` extension.

### CSS

Design tokens in `css/tokens.css` (colors, spacing, typography, shadows). No CSS-in-JS. Class naming is BEM-ish. `css/phase1.css` holds supplementary styles for the Phase 1 screens; older partial stubs in `css/sheet.css` and `css/creator.css` may overlap.

### Routing

Hash-based. `main.js` calls `defineRoute` for each path, then `initRouter()`. Navigation is always via `navigate(path)` from `js/ui/router.js` — never set `location.hash` directly.

## Content scope

SRD 5.1 only. What this means practically:
- 9 races (subraces only where SRD-published)
- 12 classes, 1 subclass each
- 1 background (Acolyte)
- ~45 core spells; full spell list requires running `scripts/build-data.js` against `vendor/5e-database/`
- No feats (`js/data/feats.js` is intentionally empty)

## Phased delivery

- **Phase 1 (done):** Roster, creator (standard array), full sheet with 6 tabs, export/import
- **Phase 2:** Level-up flow, conditions tracker, point buy, full lore section
- **Phase 3:** Multiclassing, homebrew builder, print/PDF, service worker
