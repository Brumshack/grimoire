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
node --check js/path/to/file.js
# or check everything at once:
find js -name "*.js" -exec node --check {} \;
```

---

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
- **SRD 5.1 first, with named exceptions.** All rule data is hand-authored static ES modules under `js/data/`. No API calls, no fetch at runtime. The default subclass per class is the SRD one; additional subclasses (currently: **Monster Slayer Conclave** for Ranger from XGE) live alongside it in `js/data/classes.js`. Non-SRD backgrounds (currently: **Haunted One** from CoS / Van Richten's) live in `js/data/backgrounds.js`. Add more here rather than as `features.custom[]` once a homebrew subclass / background sees real campaign use.
- **Schema versioning**: every character doc has `schemaVersion` (currently **4**). Bumping it requires:
  1. Incrementing `SCHEMA_VERSION` in `js/engine/characterFactory.js`
  2. Adding a migration function keyed by the *old* version in `js/engine/migrations.js`
  3. Adding new fields with defaults to `blankCharacter()` in `characterFactory.js`

---

## Module map

| Path | Purpose |
|---|---|
| `js/data/` | Static SRD data (spells, classes, races, equipment, rules). Read-only at runtime. |
| `js/data/homebrewSchemas.js` | `SPELL_SCHEMA`, `ITEM_SCHEMA`, `FEATURE_SCHEMA`, `ATTACK_SCHEMA` — declarative field definitions + `assemble()`/`disassemble()` for the homebrew form builder. |
| `js/engine/derive.js` | `deriveAll(doc)` — single pure function, the calculation engine. |
| `js/engine/store.js` | `CharacterStore extends Emitter` — observable wrapper around a character doc. |
| `js/engine/characterFactory.js` | `blankCharacter(partial)` — canonical empty doc shape + `SCHEMA_VERSION`. |
| `js/engine/migrations.js` | Schema version migrations (v1→v2→v3→v4). |
| `js/storage/idbStore.js` | IndexedDB via Dexie; falls back to localStorage if Dexie is unavailable. |
| `js/storage/localStore.js` | `localStorage` roster index (id, name, class, level, hp — summary only). |
| `js/ui/router.js` | Hash-based router. Routes: `#/roster`, `#/creator`, `#/sheet/:id`. |
| `js/ui/screens/sheet.js` | Main character sheet. Single-page layout: stats grid at top, overview tab-card below. Very large file — Codex helpers, tab-card builders, and all section renderers live here. |
| `js/ui/screens/` | Full-page screens: `roster.js`, `creator.js`, `sheet.js`. |
| `js/ui/components/tabbedContainer.js` | `initTabbedContainer(root)` — wires `.mtab`/`.stab` click handlers scoped to `root`. Used in both the Roster screen and the sheet's overview tab-card. |
| `js/ui/components/homebrewForm.js` | `openHomebrewForm({ schema, initial?, onSave })` — generic modal form builder driven by a schema object. |
| `js/ui/components/detailModals.js` | `openSpellDetail`, `openItemDetail`, `openFeatureDetail` — click-to-view modals with source/notes editors and edit/revert buttons. |
| `js/ui/components/existingCharacterForm.js` | `openExistingCharacterForm()` — modal for adding an already-established character (name + level only; everything else filled in on the sheet). |
| `js/ui/components/overridePopover.js` | `openOverridePopover(opts)` — floating popover for stat overrides, anchored to a DOM element. Supports `type: "select"` (with `options`), and optional `currentNote`/`onSaveNote`/`currentSource`/`onSaveSource` for per-stat notes. |
| `js/ui/components/provenance.js` | `buildTooltipHtml({ baseText, sources, acquiredFrom, userNotes })` — central tooltip HTML builder. `buildSourceHtml(baseText, sources)` is a backwards-compat alias. |
| `js/ui/components/tooltip.js` | `bindTooltip(el, opts)` — attaches hover (desktop) and long-press (touch) tooltip to an element. |
| `js/ui/components/` | All other reusable components. Most take `store` (CharacterStore) as first arg. |
| `js/util/dom.js` | `el(tag, attrs, ...children)` — the only DOM builder used throughout. |
| `js/util/id.js` | `uuid()` — generates a v4-style UUID. |

---

## Character document schema (v4)

```
{
  schemaVersion: 4,
  id, createdAt, updatedAt,

  identity:    { name, playerName, alignment, age, height, weight, eyes, hair, skin, gender, portraitDataUrl },
  progression: { classes: [{ classId, subclassId, level, hitDieRolls }], xp, inspiration },
  race:        { raceId, subraceId },
  background:  { backgroundId },

  abilityScores: {
    base:      { str, dex, con, int, wis, cha },   // set in character creator
    asiBonuses:{ str, dex, ... },                  // from ASI level-ups
    override:  { str?, dex?, ... }                 // per-ability manual overrides
  },

  proficiencies: {
    skills:           { [skillId]: "proficient"|"expertise" },
    savingThrowsExtra:[],           // additional saves beyond class defaults
    armor, weapons, tools, languages: [],
    skillOverrides:   { [skillId]: number },   // fixed override bypasses formula
    saveOverrides:    { [abilityKey]: number },
    skillNotes:       { [skillId]: string },   // user notes shown on hover
    skillSources:     { [skillId]: string },   // "Acquired from" labels
    saveNotes:        { [abilityKey]: string },
    saveSources:      { [abilityKey]: string },
    langMeta:         { [lang]:    { source, notes } },  // provenance for manual languages
    armorMeta:        { [name]:   { source, notes } },
    weaponMeta:       { [name]:   { source, notes } },
    toolMeta:         { [name]:   { source, notes } }
  },

  combat: {
    maxHp, currentHp, tempHp,
    hitDiceUsed:      { [dieKey]: number },     // e.g. { "d8": 2 }
    hitDiceExtra:     0,                         // manual +/- adjustment on top of level
    deathSaves:       { successes, failures },
    conditions:       [{ conditionId, source, notes }],
    resistances, immunities, vulnerabilities: [],
    speedBonus:       0,
    actionEconomy:    { action, bonusAction, reaction },
    customActions:    [{ id, name, used }],      // user-defined action economy items
    // Stat overrides (null = use formula):
    acOverride, initiativeOverride, initiativeBonus, speedOverride,
    profBonusOverride, hitDieOverride,
    passiveOverrides: { perception, investigation, insight },
    // Per-stat notes/sources (shown in hover tooltip):
    statNotes:        { [statKey]: string },   // keys: ac, initiative, speed, profBonus, hitDie, passivePerception, passiveInvestigation, passiveInsight
    statSources:      { [statKey]: string },   // same keys
    // Attack overrides & custom attacks:
    customAttacks:    [{ id, name, atkAbility, damage, damageType, range, properties[], notes }],
    attackOverrides:  { [instanceId]: { name?, atkAbility?, damage?, damageType?, range?, properties?, notes? } }
  },

  equipment: {
    items: [{
      instanceId,
      itemId,         // SRD item id, or null for custom
      custom,         // populated if homebrew item
      overrides,      // per-instance field overrides for SRD items
      quantity, equipped, attuned,
      source,         // "Acquired from" provenance label
      notes,          // user notes shown on hover
      containerId
    }],
    currency: { cp, sp, ep, gp, pp }
  },

  spellcasting: {
    slotsUsed:        { [level]: number },
    pactSlotsUsed:    0,
    knownSpells:      [],    // SRD spell ids
    preparedSpells:   [],
    spellbook:        [],
    custom:           [],    // homebrew spell records
    spellOverrides:   { [spellId]: partialSpellRecord },  // edits to SRD spells
    spellSources:     { [spellId]: string },              // "Acquired from" labels
    spellNotes:       { [spellId]: string },              // user notes
    // Stat overrides (null = use formula):
    saveDcOverride, attackOverride, abilityOverride
  },

  features: {
    featIds: [],
    disabledFeatureIds: [],
    custom:    [{ id, name, source, level, desc, _userNotes? }],
    overrides: { [featureId]: { name?, desc?, source?, level? } },  // edits to built-in features
    notes:     { [featureId]: string },   // user notes
    sources:   { [featureId]: string }    // "Acquired from" labels
  },

  lore: {
    backstory, personalityTraits[], ideals[], bonds[], flaws[], notes,
    // Codex buckets (all arrays of structured objects with `id`):
    quests[]:        { id, title, giver, status, reward, description },
    sideQuests[]:    { id, title, giver, status, reward, description },
    npcs[]:          { id, name, race, role, location, relationship, description },
    locations[]:     { id, name, region, type, description },
    maps[]:          { id, name, region, notes, imageDataUrl },   // imageDataUrl is base64
    organizations[]: { id, name, leader, allegiance, description },
    deities[]:       { id, name, domain, alignment, symbol, description },
    bestiary[]:      { id, name, threat, weakness, description },
    allies[], enemies[],          // legacy v3 buckets, kept for back-compat; UI uses npcs/bestiary
    history, worldLore            // long-form prose strings
  },
  party:      [{ name, playerName, race, class, level, notes }],
  sessionLog: [{ id, date, sessionNumber, title, notes }],
  settings:   { hpLevelUpMethod, autoSaveEnabled }
}
```

---

## Key patterns

### Override pattern
Every SRD-derived value can be overridden. Override buckets are stored on the raw doc and merged at render/derive time. The SRD base is **never mutated**.

- **Stat overrides** (AC, speed, initiative, proficiency bonus, hit die, passives, spell DC/attack/ability, per-ability scores, per-skill/save modifiers): stored as `null`-able fields on `combat`, `proficiencies`, `abilityScores.override`, `spellcasting`.
- **Content overrides** (spell fields, item fields, feature fields, attack stats): stored in separate `*Overrides` buckets, merged onto the base record at render time.
- Use `pickOverride(override, fallback)` in `derive.js` — returns the override only when it is non-null, non-undefined, and non-"".

### Always-on editing (no Edit Stats toggle)
The sheet has **no edit-mode toggle**. `data-edit-mode="on"` is hardcoded on the root `.sheet` element so all editing affordances are always visible. The CSS classes `btn--edit-only`, `.add-inline`, `.chip__x`, and `[data-override-path]` dashed outlines are all permanently active.

`btn--edit-only` elements (and their `div` wrappers) are always `display: inline-flex / flex`. New code should not assume any gating — just render controls directly.

The global click delegate on the root element routes `[data-override-path]` attribute clicks to `openOverrideFor()`, which maps the path token to the correct popover config. It skips `button`, `input`, `select`, `textarea`, `a` descendants so interactive children fire normally.

**Identity fields in the sheet header** — Level, Race, Class, and Alignment are rendered as clickable `<span data-override-path="identity.*">` elements in `.sheet__subtitle`. Clicking them opens an `openOverridePopover` with:
- `identity.level` → number input → sets `progression.classes[0].level`
- `identity.alignment` → select dropdown → sets `identity.alignment`
- `identity.race` → select from `listRaces()` → sets `race.raceId` / `race.subraceId`
- `identity.class` → select from `CLASS_IDS` → sets `progression.classes[0].classId` and auto-picks first subclass if its unlock level ≤ character level

### Override popover with notes
`openOverridePopover` accepts optional note/source fields for any stat:
```js
openOverridePopover({
  anchorEl, label, type,         // "number" | "text" | "ability" | "select"
  currentValue, baseHint, onSave,
  options,                       // [{value, label}] — required when type="select"
  currentNote, onSaveNote,       // note textarea shown in hover tooltip
  currentSource, onSaveSource    // source input shown in hover tooltip
});
```
When `onSaveNote` / `onSaveSource` are provided the popover renders Source and Notes fields below the main input. Clear resets all three (value, note, source) to null. Notes/sources are stored in `combat.statNotes`, `combat.statSources`, `proficiencies.skillNotes`, `proficiencies.skillSources`, `proficiencies.saveNotes`, `proficiencies.saveSources` and are displayed via `buildTooltipHtml` in the stat's hover tooltip.

### Stable feature IDs
Feature IDs are slug-based so overrides survive level-ups:
- Class features: `class:{classId}:{slug(name)}`
- Race traits: `race:{raceId}:{subraceId}:{slug(name)}`
- Background: `bg:{backgroundId}:{slug(name)}`
- Custom: whatever ID was assigned at creation (`custom-{uuid}`)

### Homebrew form builder
`openHomebrewForm({ schema, initial?, onSave })` renders a modal form from a schema object. Schemas live in `js/data/homebrewSchemas.js`. Each schema has:
- `fields[]` — field definitions with `type`, `label`, `key`, `default`, `required`, `showIf`, `placeholder`, `help`
- `assemble(formState)` — produces the stored record shape
- `disassemble(storedRecord)` — flattens back into form state for editing

Fields prefixed `_` (e.g. `_acquiredFrom`, `_userNotes`) are **personal tracking fields** — `assemble()` passes them through but the save handler in `detailModals.js` routes them to their own storage buckets (`spellSources`, `spellNotes`, `item.source`, `item.notes`, `features.notes`) separately from the content record.

`showIf` on a field hides it conditionally. It only triggers a re-render when the field has `key === "type"` or `rerenders: true`.

### Tooltip pattern
```js
bindTooltip(element, {
  title: "Name",
  html: buildTooltipHtml({ baseText, sources, acquiredFrom, userNotes }),
  sourceRef: "SRD",         // optional small label
  onMore: () => openModal() // optional "More" button
});
```
`buildTooltipHtml` escapes all text, converts `\n` to `<br>`, and renders sections in order: acquired-from → base text → sources list → user notes.

### Pip fill pattern
Pips use `data-used="true"` attribute (not a class) to fill gold:
```js
el("button", { class: "pip", "data-used": isActive ? "true" : null, ... })
```

### Panel header pattern (title + action buttons)
```js
el("div", { class: "panel__header" },
  el("h3", {}, "Section Title"),
  el("button", { class: "btn btn--sm" }, "Action")
)
```

### Overview tab-card (the sheet's primary navigation)
The character sheet renders a single page — no top-level tab bar. Below the stats/skills grid is a nested tab-card built by `renderOverviewTabCard(store, state, rerender)` with six main tabs:

**Actions · Spells · Inventory · Features & Traits · Background · Codex**

Each main tab has sub-tabs (e.g. Spells: All / Cantrips / Level 1-9 / Ritual / Concentration). The active main tab and per-group active sub-tab are persisted on `state.overview = { main, sub: { [groupId]: activeSubId } }` so selections survive store-update rerenders.

Tab wiring uses `initTabbedContainer(tabCard)` plus extra click listeners that write back to `state.overview`.

**Adding items** — every sub-pane has contextual "+" buttons created by factory functions (prefixed `mk`). Factories are required because a single DOM node can only have one parent — sharing an element across panes silently moves it.

```js
// ✓ factory — fresh node each call
const mkAdd = () => ovAddBtn("+ Add", () => openHomebrewForm(...));
// ✗ shared element — gets stolen by the last pane that appends it
const addBtn = ovAddBtn("+ Add", ...);
```

### Codex pattern
The **Codex** is embedded as the last main tab of the overview tab-card via `buildCodexPane`. Each of the 14 CODEX_SECTIONS becomes a sub-tab; its content is rendered by `renderCodexPage(host, sectionId, store)`.

`CODEX_SECTIONS` (module-level const in `sheet.js`) drives both the embedded Codex sub-tabs and the standalone `renderCodexTab` (which still exists as reference but is no longer wired to any route).

Three kinds of Codex pages:
1. **Single-form pages** (Hero): renders existing `lore.*` strings/arrays as editable fields.
2. **List pages** (Quests, Side Quests, People, Places, Factions, Gods, Bestiary): driven by a `*_CFG` config (`QUEST_CFG`, `NPC_CFG`, …) with `arrayKey`, `blank()`, and `fields[]`. `codexListPage(store, cfg)` renders them generically.
3. **Prose pages** (History, World Lore, Journal): a single long `<textarea class="codex__prose">` bound to a `lore.*` string.

All codex lists mutate via `store.update(x => x.lore[cfg.arrayKey].push(...))`. Each entry has a stable `id` so index-based edits survive re-renders.

Maps (`lore.maps[]`) store images as base64 data URLs in `imageDataUrl` — no file path or remote fetch.

Styling lives in `css/phase1.css` under the `/* CODEX */` block. The embedded variant uses `.codex--embedded` to reduce padding/shadow. Key classes: `.codex__book` (parchment page), `.codex__toc` (ribbon sidebar, standalone only), `.codex__card` (list entries, ruby left-border).

### Nested tab-card pattern (roster + sheet)
Both the Roster screen and the sheet's overview tab-card use the same two-level tab system from `js/ui/components/tabbedContainer.js`.

HTML naming convention (must be exact):
```html
<div class="tab-card">
  <div class="main-tab-bar">
    <button class="mtab" data-main="X">Label</button>
  </div>
  <div class="main-pane" id="mp-X">
    <div class="sub-tab-bar">
      <button class="stab" data-group="X" data-sub="Y">Label</button>
    </div>
    <div class="sub-pane" id="sp-X-Y">…</div>
  </div>
</div>
```

`initTabbedContainer(root)` wires all click handlers scoped to `root` — safe to call on detached DOM and supports multiple independent tab-cards on the same page. Apply `.active` to the initial mtab/main-pane/stab/sub-pane before calling it.

---

## Storage split

- **localStorage** — roster index only (`grimoire:roster`). Written via `updateRosterEntry()` after every save.
- **IndexedDB** — full character documents. Dexie DB name `"grimoire"`, table `characters`.
- **Export format** — raw character JSON, `.grimoire.json` extension.

---

## CSS

Design tokens in `css/tokens.css` (colors, spacing, typography, shadows). No CSS-in-JS. Class naming is BEM-ish.

- `css/phase1.css` — primary stylesheet for all Phase 1 UI. Add new styles here.
- `css/sheet.css`, `css/creator.css` — older partial stubs; may have overlapping rules. Prefer `phase1.css` for new work.
- `css/components.css` — shared component styles (`.pip`, `.pips`, tooltips, modals).

**Key CSS variables** (from `tokens.css`): `--c-gold`, `--c-bg-0/1/2/3`, `--c-text`, `--c-text-dim`, `--c-text-mute`, `--c-border`, `--c-good`, `--c-bad`, `--sp-1..4`, `--fs-xs/sm/lg`, `--font-display`, `--r-sm`, `--tr-fast`.

---

## Routing

Hash-based. `main.js` calls `defineRoute` for each path, then `initRouter()`. Navigation is always via `navigate(path)` from `js/ui/router.js` — never set `location.hash` directly.

---

## Content scope

SRD 5.1 only. What this means practically:
- 9 races (subraces only where SRD-published)
- 12 classes, 1 subclass each
- 1 background (Acolyte)
- ~45 core spells; full spell list requires running `scripts/build-data.js` against `vendor/5e-database/`
- No feats (`js/data/feats.js` is intentionally empty)

---

## Actions tab — what shows as an attack row

Any `equipment.items[]` entry where **`equipped: true` AND `custom.type === "weapon"`** (or `itemId` resolves to a weapon) renders as an attack row in the Actions tab. This is intentional for standard equipped weapons, but causes duplicates when a custom attack is *also* defined in `combat.customAttacks[]` for the same item.

**Rule:** if the real attack lives in `customAttacks`, set the item's `custom.type = "gear"` and `equipped = false` so it is tracked as owned but doesn't create a phantom row. Examples: ammunition (Silver Bolts), items whose attack stats are fully overridden in customAttacks (Leo Deliznia's Silver Crossbow).

### Actions tab structure (April 2026)

The Actions main tab has been reorganised. Sub-tabs:

- **All** — every actionable thing the character has, broken into subheaders (Weapon Attacks, Spell Attacks, Other Actions, Spell Bonus Actions, Other Bonus Actions, Spell Reactions, Other Reactions, Other). Each section is alphabetised internally.
- **Action** — combines what used to be Attack + Action. Subheaders: Weapon Attacks / Spell Attacks / Other Actions. Followed by the basic D&D actions cheat sheet.
- **Bonus Action** — Spell Bonus Actions / Other Bonus Actions. Followed by basic bonus actions cheat sheet.
- **Reaction** — Spell Reactions / Other Reactions. Followed by basic reactions cheat sheet.
- **Other** — custom-action records the user typed with `actionType: "other"`.
- **Limited Use** — feature-records whose `desc` mentions per-rest charges.

The categorisation comes from `categorisedPane(groups, addBtns, cheatTitle, cheatRows)` in `buildActionsPane`. Empty subgroups still render their header with an em-dash placeholder so the structure is always visible.

### Combat feats are filtered out of action lists
A combat feat like Crossbow Expert mentions "you can use a bonus action to attack with a hand crossbow" in its description, so the substring match `\bbonus action\b` would put it under Bonus Action. We don't want that — those feats belong under Features & Traits → Combat Feats. The `isCombatFeatLike(f)` predicate (in `buildActionsPane`) keeps the Action / Bonus Action / Reaction lists clean by excluding any feature whose name or `source` matches a known feat keyword (Crossbow Expert, Sharpshooter, Sentinel, etc.) or fighting style.

---

## `ovRow` — 4th argument (actions column)

`ovRow(title, meta, onClick, actions?)` accepts an optional 4th arg — an array of button elements. When provided, the row renders as a 3-column grid with the buttons in a right-aligned `.ov-row__actions` div. CSS class `.ov-row--has-actions` is added automatically.

```js
ovRow("Feature Name", "Source", () => openDetail(), [editBtn(), deleteBtn()])
```

---

## Spell slot tracker

`renderSlotTracker(store, slots)` is defined in `sheet.js` and renders inside the **Slots** sub-tab of the Spells pane (the panel is no longer above the sub-tab bar). The "Configure" button opens `openConfigureSlotsModal`, which reads/writes `doc.spellcasting.slotMaxOverrides`.

The tracker also includes a **Concentrating** toggle (checkbox + free-text spell name) that writes to `doc.spellcasting.concentrating` (boolean) and `doc.spellcasting.concentratingOn` (string). Use this during combat to track which concentration spell is active; the value is displayed as part of slot tracking but is not (yet) consulted by derived stats.

Use `slotMaxOverrides` for any character whose spell slots don't follow the standard class table (e.g. half-casters with atypical distributions, multiclass, or magic items that grant extra slots):

```json
"slotMaxOverrides": { "1": 4, "2": 3, "3": 3, "4": 3, "5": 2 }
```

Magic item save bonuses have no dedicated schema field — use `proficiencies.saveOverrides` with the final computed value and explain the math in `proficiencies.saveNotes`.

### Spell tile presentation (April 2026)
Ritual and Concentration are no longer separate sub-tabs in the Spells pane. Both qualities are shown directly on each spell row's meta line — e.g. `evocation · 1 action · Concentration` or `divination · 1 minute · Ritual`. The earlier single-letter `· C` / `· R` markers were replaced because users found them illegible.

## Spellcasting quick panel — auto-derived breakdowns
`renderSpellcastingQuick` builds a tooltip for Save DC / Attack / Ability that **always** explains why the number is the number, even without saved metadata. The breakdown ("Computed: 8 + Prof 5 + WIS +4 = 17") is derived from current ability mods + prof bonus + override and stitched into the tooltip's `acquiredFrom` slot. Any user-supplied `spellcasting.statSources[key]` overrides the auto string. User-supplied `spellcasting.statNotes[key]` is rendered separately (under "Notes").

## Inventory — multi-category items
An item can live in **multiple** inventory buckets. The override is `it.categories: string[]`; the legacy single-string `it.category` is still respected for back-compat. If neither override is set, heuristics (name regex, type, magical flag) decide a primary category and may auto-add `magical` so the same Cloak of Protection appears in both Armor and Magical Items.

The per-item ⚑ button in inventory rows opens `openItemCategoryPopover` — a checkbox-per-category modal. Saving writes `it.categories`; "Reset to Auto" clears both fields and falls back to heuristics.

## Class-feature variant labels
Class features that ask the player to pick a variant (Favored Enemy, Natural Explorer, Fighting Style, Ranger Archetype) display the chosen variant in their title. The pattern is to write the variant on the FIRST LINE of `features.notes[featureId]` (no trailing punctuation, < 80 chars); the sheet appends it as `Feature Name (Variant)` automatically.

Example:
```json
"features": {
  "notes": {
    "class:ranger:favored-enemy":    "Fiends, Undead, Beasts\n\n+2 damage to all three types …",
    "class:ranger:natural-explorer": "Forest, Underdark\n\nDoubled prof on INT/WIS …",
    "class:ranger:fighting-style":   "Archery\n\n+2 to ranged attack rolls …"
  }
}
```

The full note (including content after `\n\n`) is still shown in the hover tooltip. Implementation: `variantSuffix(f)` in `buildFeaturesPane`.

---

## `/import-vault` — workflow notes (Raylock Flystone import, April 2026)

### Two-script pattern
The import script (`scripts/import-vault.js`) produces a base JSON. A second post-processing script (`fix-grimoire.js` in the vault folder) applies corrections that the parser can't infer. A third (`patch-grimoire.js`) applies targeted updates from files the first pass missed.

**Run order:**
```bash
node scripts/import-vault.js "<vault-path>"        # generates base JSON
node fix-grimoire.js                               # run from inside vault folder
node patch-grimoire.js                             # run from inside vault folder
```

### ID stability warning
`scripts/import-vault.js` uses `crypto.randomUUID()` — IDs are **random per run**. Fix scripts that reference specific `id` / `instanceId` values will break on re-import. Either:
- Make IDs deterministic (hash of type + slug), or
- Run fix scripts only on first import and maintain the JSON directly thereafter.

### Auto-derived features — don't double-import
Race traits and class features auto-derive from `race.raceId` and `progression.classes[]`. Importing them into `features.custom[]` too causes duplicates in the Features & Traits tab. **Do not import:**
- Wood Elf / any race traits (Darkvision, Keen Senses, Fey Ancestry, Trance, Elf Weapon Training, Fleet of Foot, Mask of the Wild)
- Standard Ranger class features (Favored Enemy, Natural Explorer, Extra Attack, Land's Stride, Hide in Plain Sight, Vanish, Primeval Awareness)

Instead, put campaign-specific notes (custom enemy types, terrain choices) into `features.notes["class:ranger:favored-enemy"]` etc. — they appear in hover tooltips on the auto-derived rows.

**Do import** as `features.custom[]`: non-SRD subclass features (Monster Slayer, Aberrant Dragonmark), non-SRD backgrounds (Haunted One), and any feat/gift with no SRD equivalent.

### Consolidate multi-part features
Vault files sometimes split a single feature across multiple headings (e.g. "What It Does" + "Dragonmark Quirk", or "Charges" + "What It Does" + "Permanent Flaw"). These should be merged into one `features.custom[]` entry with a combined `desc`.

### Spells — source routing
- Ranger class spells → `spellcasting.custom[]` (not `knownSpells` unless they're in the SRD spell data)
- Dragonmark / feat spells → `spellcasting.custom[]` with `source` set to the feat name
- All spells get sources in `spellcasting.spellSources[id]` and notes in `spellcasting.spellNotes[id]`
- `slotMaxOverrides` must be set manually for half-casters (Ranger L15 = `{ "1":4, "2":3, "3":3, "4":3, "5":2 }`)

### Vault files that commonly lack `note-type` frontmatter
These files exist in most vaults but won't be caught by the parser — handle manually or add frontmatter to the vault:
- `Lore/Mysteries & Lore.md` → `lore.worldLore`
- `Lore/Party Backstories.md` → `lore.backstory` + `party[].notes`
- `Character/KOs.md` → append to `lore.history`
- `Resources.md` → skip (reference doc, no schema target)
- `People/[deity-as-person].md` (e.g. Auril the Frost Maiden) → captured in `lore.deities[]` instead

### Equipment equipped/attuned state
The vault rarely records `equipped: true` explicitly. Apply these rules:
- Worn armor → `equipped: true`
- All attuned items → `equipped: true` (attunement requires wearing/holding)
- Ammunition → `type: "gear"`, `equipped: false`
- Weapons that have a `customAttacks[]` entry → `type: "gear"`, `equipped: false` to avoid duplicate Actions rows

---

## Phased delivery

- **Phase 1 (done):** Roster (nested tab-card: Roster/Library/Guide), creator (standard array), single-page character sheet with overview tab-card (7 main tabs: Actions, Spells, Inventory, Features & Traits, Proficiencies, Background, Codex), export/import, full stat overrides, custom spells/items/features/attacks (add buttons in every sub-pane), provenance tooltips on all tab-card rows (hover shows description + source + notes + More button), source+notes on everything (per-stat notes/sources in override popovers), always-on inline editing (no edit-mode toggle), "Existing Character" quick-entry flow (name + level → blank sheet), identity editing from sheet header (class/race/alignment/level dropdowns), languages/proficiencies editable, Codex embedded as tab with 14 sections (Hero, Fellowship, Session Log, Quests, Side Quests, People, Places, Maps, Factions, Gods & Faiths, Bestiary, History, World Lore, Journal) in lined-parchment style
- **Phase 2:** Level-up flow, conditions tracker with rule tooltips, point buy ability scores, action economy from class features (Second Wind, etc.)
- **Phase 3:** Multiclassing, print/PDF view, service worker for offline install, dice roll animations
