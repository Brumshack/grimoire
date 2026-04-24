import { el, clear } from "../../util/dom.js";
import { loadCharacter } from "../../storage/idbStore.js";
import { CharacterStore } from "../../engine/store.js";
import { migrate } from "../../engine/migrations.js";
import { navigate } from "../router.js";
import { toast } from "../components/toast.js";

import { renderAbilityBlock } from "../components/abilityBlock.js";
import { renderSkillList, renderSavingThrows } from "../components/skillList.js";
import { renderHpBar } from "../components/hpBar.js";
import { renderPips } from "../components/pipTracker.js";
import { openSpellDetail, openItemDetail, openFeatureDetail } from "../components/detailModals.js";
import { bindTooltip } from "../components/tooltip.js";
import { buildTooltipHtml } from "../components/provenance.js";
import { openHomebrewForm } from "../components/homebrewForm.js";
import { SPELL_SCHEMA, ITEM_SCHEMA, FEATURE_SCHEMA, ATTACK_SCHEMA } from "../../data/homebrewSchemas.js";
import { uuid } from "../../util/id.js";
import { openOverridePopover } from "../components/overridePopover.js";
import { openModal } from "../components/modal.js";
import { initTabbedContainer } from "../components/tabbedContainer.js";

import { ALIGNMENTS } from "../../data/rules.js";
import { SPELLS, spellsByLevel } from "../../data/spells.js";
import { ITEMS, listWeapons, listArmor, listGear } from "../../data/equipment.js";
import { listRaces } from "../../data/races.js";
import { CLASSES, CLASS_IDS } from "../../data/classes.js";

export async function renderSheet(root, id) {
  clear(root);
  root.append(el("div", { class: "loading" }, "Loading…"));

  const loaded = await loadCharacter(id);
  if (!loaded) {
    clear(root);
    root.append(el("div", { class: "empty-state" },
      el("p", {}, "Character not found."),
      el("button", { class: "btn", onclick: () => navigate("/roster") }, "Back to Roster")
    ));
    return;
  }

  const doc = migrate(loaded);
  const store = new CharacterStore(doc);
  const state = { tab: "overview" };

  function rerender() {
    clear(root);
    root.append(renderSheetChrome(store, state, rerender));
  }

  // Delegate clicks on anything tagged with [data-override-path].
  root.addEventListener("click", (e) => {
    // ignore clicks directly on interactive children (pip toggles, inputs)
    if (e.target.closest("button, input, select, textarea, a")) return;
    const target = e.target.closest("[data-override-path]");
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    openOverrideFor(store, target);
  });

  store.on("change", rerender);
  store.on("saved", () => { /* could show a subtle saved indicator */ });
  rerender();
}

/* ─────────────────────── chrome ─────────────────────── */

function renderSheetChrome(store, state, rerender) {
  const doc = store.doc;
  const d = store.derived;

  const alignment = ALIGNMENTS.find(a => a.id === doc.identity.alignment)?.name || "Alignment";
  const classLine = d.primarySubclass
    ? `${d.primarySubclass.name} ${d.primaryClass.name}`
    : d.primaryClass?.name || "— Class";

  const header = el("header", { class: "sheet__header" },
    el("button", { class: "btn btn--ghost", onclick: () => navigate("/roster") }, "← Roster"),
    el("div", { class: "sheet__title" },
      el("div", { class: "sheet__name", contentEditable: "true",
        oninput: e => store.update(x => { x.identity.name = e.target.textContent.trim() || "Unnamed"; }),
      }, doc.identity.name),
      el("div", { class: "sheet__subtitle" },
        el("span", { "data-override-path": "identity.level",     title: "Click to edit level"     }, `Level ${d.totalLevel}`), sep(),
        el("span", { "data-override-path": "identity.race",      title: "Click to edit race"      }, d.resolvedRace?.fullName || "— Race"), sep(),
        el("span", { "data-override-path": "identity.class",     title: "Click to edit class"     }, classLine), sep(),
        el("span", { "data-override-path": "identity.alignment", title: "Click to edit alignment" }, alignment)
      )
    ),
    el("div", { class: "sheet__spacer" }),
    el("div", { class: "sheet__xp" },
      el("span", { class: "label" }, "XP"),
      el("input", {
        type: "number", min: 0, value: doc.progression.xp || 0,
        onchange: e => store.update(x => { x.progression.xp = parseInt(e.target.value, 10) || 0; })
      })
    ),
    el("div", { class: "sheet__inspiration" },
      el("button", {
        class: `pip pip--inspiration ${doc.progression.inspiration ? "is-on" : ""}`,
        type: "button",
        onclick: () => store.update(x => { x.progression.inspiration = !x.progression.inspiration; })
      }),
      el("span", { class: "label" }, "Inspiration")
    )
  );

  const body = renderOverviewTab(store, state, rerender);
  return el("div", { class: "sheet", "data-edit-mode": "on" }, header, body);
}

/* ─────────────────────── override routing ─────────────────────── */

// Map data-override-path tokens to popover config + commit action.
function openOverrideFor(store, target) {
  const path = target.getAttribute("data-override-path");
  const doc = store.doc;
  const d = store.derived;

  // ── identity fields (level, race, class, alignment) ──
  if (path === "identity.level") {
    openOverridePopover({
      anchorEl: target, label: "Character Level", type: "number",
      currentValue: doc.progression.classes[0]?.level || 1, baseHint: null,
      onSave: v => store.update(x => { x.progression.classes[0].level = Math.max(1, Math.min(20, v ?? 1)); })
    });
    return;
  }
  if (path === "identity.alignment") {
    openOverridePopover({
      anchorEl: target, label: "Alignment", type: "select",
      options: ALIGNMENTS.map(a => ({ value: a.id, label: a.name })),
      currentValue: doc.identity.alignment || "TN", baseHint: null,
      onSave: v => store.update(x => { x.identity.alignment = v || "TN"; })
    });
    return;
  }
  if (path === "identity.race") {
    const races = listRaces();
    openOverridePopover({
      anchorEl: target, label: "Race", type: "select",
      options: [{ value: "", label: "— None —" }, ...races.map(r => ({ value: r.id, label: r.fullName }))],
      currentValue: doc.race.raceId
        ? (doc.race.subraceId ? `${doc.race.raceId}:${doc.race.subraceId}` : doc.race.raceId)
        : "",
      baseHint: null,
      onSave: v => store.update(x => {
        if (!v) { x.race.raceId = null; x.race.subraceId = null; return; }
        const [raceId, subraceId = null] = v.split(":");
        x.race.raceId = raceId;
        x.race.subraceId = subraceId;
      })
    });
    return;
  }
  if (path === "identity.class") {
    openOverridePopover({
      anchorEl: target, label: "Class", type: "select",
      options: [{ value: "", label: "— None —" }, ...CLASS_IDS.map(id => ({ value: id, label: CLASSES[id].name }))],
      currentValue: doc.progression.classes[0]?.classId || "", baseHint: null,
      onSave: v => store.update(x => {
        if (!v) { x.progression.classes[0].classId = null; x.progression.classes[0].subclassId = null; return; }
        const cls = CLASSES[v];
        const level = x.progression.classes[0]?.level || 1;
        const firstSub = cls.subclasses?.[0];
        x.progression.classes[0].classId = v;
        x.progression.classes[0].subclassId = (firstSub && firstSub.level <= level) ? firstSub.id : null;
      })
    });
    return;
  }

  const defs = {
    ac:            { label: "AC Override",          type: "number", get: () => doc.combat.acOverride,            base: d.ac,            set: v => x => { x.combat.acOverride = v; },            noteKey: "ac" },
    initiative:    { label: "Initiative Override",  type: "number", get: () => doc.combat.initiativeOverride,    base: d.abilities.dex.mod + (doc.combat.initiativeBonus || 0), set: v => x => { x.combat.initiativeOverride = v; }, noteKey: "initiative" },
    speed:         { label: "Speed Override (ft)",  type: "number", get: () => doc.combat.speedOverride,         base: (d.resolvedRace?.speed ?? 30) + (doc.combat.speedBonus || 0), set: v => x => { x.combat.speedOverride = v; }, noteKey: "speed" },
    profBonus:     { label: "Proficiency Bonus",    type: "number", get: () => doc.combat.profBonusOverride,     base: d.profBonus,     set: v => x => { x.combat.profBonusOverride = v; },     noteKey: "profBonus" },
    hitDie:        { label: "Hit Die Size",         type: "number", get: () => doc.combat.hitDieOverride,        base: d.primaryClass?.hitDie ?? 8, set: v => x => { x.combat.hitDieOverride = v; }, noteKey: "hitDie" },
    passivePerception:    { label: "Passive Perception",    type: "number", get: () => doc.combat.passiveOverrides?.perception,    base: 10 + d.skills.perception.modifier,    set: v => x => { x.combat.passiveOverrides = x.combat.passiveOverrides || {}; x.combat.passiveOverrides.perception = v; },    noteKey: "passivePerception" },
    passiveInvestigation: { label: "Passive Investigation", type: "number", get: () => doc.combat.passiveOverrides?.investigation, base: 10 + d.skills.investigation.modifier, set: v => x => { x.combat.passiveOverrides = x.combat.passiveOverrides || {}; x.combat.passiveOverrides.investigation = v; }, noteKey: "passiveInvestigation" },
    passiveInsight:       { label: "Passive Insight",       type: "number", get: () => doc.combat.passiveOverrides?.insight,       base: 10 + d.skills.insight.modifier,       set: v => x => { x.combat.passiveOverrides = x.combat.passiveOverrides || {}; x.combat.passiveOverrides.insight = v; },       noteKey: "passiveInsight" },
    spellSaveDC:   { label: "Spell Save DC",        type: "number", get: () => doc.spellcasting.saveDcOverride,  base: d.spellSaveDC,   set: v => x => { x.spellcasting.saveDcOverride = v; }, noteKey: "spellSaveDC",  noteBucket: "spellcasting" },
    spellAttack:   { label: "Spell Attack",         type: "number", get: () => doc.spellcasting.attackOverride,  base: d.spellAttack,   set: v => x => { x.spellcasting.attackOverride = v; }, noteKey: "spellAttack",  noteBucket: "spellcasting" },
    spellAbility:  { label: "Spellcasting Ability", type: "ability", get: () => doc.spellcasting.abilityOverride, base: d.primaryClass?.spellcasting?.ability || "—", set: v => x => { x.spellcasting.abilityOverride = v || null; }, noteKey: "spellAbility", noteBucket: "spellcasting" }
  };

  // ability score override: abilityScores.str etc.
  const abMatch = path.match(/^ability\.(str|dex|con|int|wis|cha)$/);
  if (abMatch) {
    const k = abMatch[1];
    const base = (doc.abilityScores.base?.[k] ?? 10) + (d.resolvedRace?.abilityBonuses?.[k] ?? 0) + (doc.abilityScores.asiBonuses?.[k] ?? 0);
    openOverridePopover({
      anchorEl: target, label: `${k.toUpperCase()} Override`, type: "number",
      currentValue: doc.abilityScores.override?.[k], baseHint: base,
      onSave: v => store.update(x => {
        x.abilityScores.override = x.abilityScores.override || {};
        if (v == null) delete x.abilityScores.override[k];
        else x.abilityScores.override[k] = v;
      }),
      currentNote:   doc.abilityScores.notes?.[k],
      onSaveNote:    note => store.update(x => {
        x.abilityScores.notes = x.abilityScores.notes || {};
        if (!note) delete x.abilityScores.notes[k]; else x.abilityScores.notes[k] = note;
      }),
      currentSource: doc.abilityScores.sources?.[k],
      onSaveSource:  src => store.update(x => {
        x.abilityScores.sources = x.abilityScores.sources || {};
        if (!src) delete x.abilityScores.sources[k]; else x.abilityScores.sources[k] = src;
      })
    });
    return;
  }

  // skill override: skill.<id>
  const skMatch = path.match(/^skill\.(.+)$/);
  if (skMatch) {
    const id = skMatch[1];
    const sk = d.skills[id];
    if (!sk) return;
    openOverridePopover({
      anchorEl: target, label: `${sk.name} Override`, type: "number",
      currentValue: doc.proficiencies.skillOverrides?.[id],
      baseHint: sk.overridden ? "—" : sk.modifier,
      onSave: v => store.update(x => {
        x.proficiencies.skillOverrides = x.proficiencies.skillOverrides || {};
        if (v == null) delete x.proficiencies.skillOverrides[id];
        else x.proficiencies.skillOverrides[id] = v;
      }),
      currentNote:   doc.proficiencies?.skillNotes?.[id],
      onSaveNote:    note => store.update(x => {
        x.proficiencies.skillNotes = x.proficiencies.skillNotes || {};
        if (!note) delete x.proficiencies.skillNotes[id]; else x.proficiencies.skillNotes[id] = note;
      }),
      currentSource: doc.proficiencies?.skillSources?.[id],
      onSaveSource:  src => store.update(x => {
        x.proficiencies.skillSources = x.proficiencies.skillSources || {};
        if (!src) delete x.proficiencies.skillSources[id]; else x.proficiencies.skillSources[id] = src;
      })
    });
    return;
  }

  // save override: save.<ability>
  const svMatch = path.match(/^save\.(str|dex|con|int|wis|cha)$/);
  if (svMatch) {
    const k = svMatch[1];
    openOverridePopover({
      anchorEl: target, label: `${k.toUpperCase()} Save Override`, type: "number",
      currentValue: doc.proficiencies.saveOverrides?.[k],
      baseHint: d.saves[k].overridden ? "—" : d.saves[k].modifier,
      onSave: v => store.update(x => {
        x.proficiencies.saveOverrides = x.proficiencies.saveOverrides || {};
        if (v == null) delete x.proficiencies.saveOverrides[k];
        else x.proficiencies.saveOverrides[k] = v;
      }),
      currentNote:   doc.proficiencies?.saveNotes?.[k],
      onSaveNote:    note => store.update(x => {
        x.proficiencies.saveNotes = x.proficiencies.saveNotes || {};
        if (!note) delete x.proficiencies.saveNotes[k]; else x.proficiencies.saveNotes[k] = note;
      }),
      currentSource: doc.proficiencies?.saveSources?.[k],
      onSaveSource:  src => store.update(x => {
        x.proficiencies.saveSources = x.proficiencies.saveSources || {};
        if (!src) delete x.proficiencies.saveSources[k]; else x.proficiencies.saveSources[k] = src;
      })
    });
    return;
  }

  const def = defs[path];
  if (!def) return;
  const nBucket = def.noteBucket || "combat";
  openOverridePopover({
    anchorEl: target, label: def.label, type: def.type,
    currentValue: def.get(), baseHint: def.base,
    onSave: v => store.update(def.set(v)),
    ...(def.noteKey ? {
      currentNote:   doc[nBucket].statNotes?.[def.noteKey],
      onSaveNote:    note => store.update(x => {
        x[nBucket].statNotes = x[nBucket].statNotes || {};
        if (!note) delete x[nBucket].statNotes[def.noteKey]; else x[nBucket].statNotes[def.noteKey] = note;
      }),
      currentSource: doc[nBucket].statSources?.[def.noteKey],
      onSaveSource:  src => store.update(x => {
        x[nBucket].statSources = x[nBucket].statSources || {};
        if (!src) delete x[nBucket].statSources[def.noteKey]; else x[nBucket].statSources[def.noteKey] = src;
      })
    } : {})
  });
}

const sep = () => el("span", { class: "sep" }, "·");

/* ─────────────────────── hit dice panel (shared) ──────────────────────── */

function renderHitDicePanel(store) {
  const d = store.derived;
  const doc = store.doc;
  return el("div", { class: "panel" },
    el("div", { class: "panel__header" },
      el("h3", {}, "Hit Dice"),
      el("div", { style: { display: "flex", gap: "var(--sp-2)", alignItems: "center" } },
        el("span", {
          class: "hit-die-badge",
          "data-override-path": "hitDie",
          title: "Click to change die size"
        }, `d${d.hitDie}${doc.combat.hitDieOverride != null ? " ✎" : ""}`),
        el("button", {
          class: "btn btn--sm",
          title: "Reset all hit dice used",
          onclick: () => store.update(x => { x.combat.hitDiceUsed = {}; })
        }, "Long Rest")
      )
    ),
    el("div", { class: "hit-dice" },
      renderPips({
        total: Math.max(1, d.totalLevel + (doc.combat.hitDiceExtra || 0)),
        used: Object.values(doc.combat.hitDiceUsed || {}).reduce((s, n) => s + n, 0),
        onChange: n => store.update(x => {
          x.combat.hitDiceUsed = {};
          if (n > 0) x.combat.hitDiceUsed[`d${d.hitDie}`] = n;
        })
      }),
      el("div", { class: "hit-dice__controls" },
        el("button", {
          class: "btn btn--sm btn--ghost hit-dice__adjust",
          title: "Remove a hit die",
          onclick: () => store.update(x => {
            const extra = x.combat.hitDiceExtra || 0;
            const total = d.totalLevel + extra;
            if (total > 1) x.combat.hitDiceExtra = extra - 1;
          })
        }, "−"),
        el("span", { class: "hit-dice__total-label" },
          `${Math.max(1, d.totalLevel + (doc.combat.hitDiceExtra || 0))} total`
        ),
        el("button", {
          class: "btn btn--sm btn--ghost hit-dice__adjust",
          title: "Add a hit die",
          onclick: () => store.update(x => {
            x.combat.hitDiceExtra = (x.combat.hitDiceExtra || 0) + 1;
          })
        }, "+")
      )
    )
  );
}

/* ─────────────────────── overview ─────────────────────── */

function renderOverviewTab(store, state, rerender) {
  const d = store.derived;
  const sc = store.doc.spellcasting;
  const showSpellcasting = d.primaryClass?.spellcasting
    || sc.abilityOverride
    || (sc.custom?.length ?? 0) > 0
    || (sc.knownSpells?.length ?? 0) > 0;

  const grid = el("div", { class: "sheet__grid" },
    // Left column
    el("div", { class: "col col--left" },
      renderAbilityBlock(store),
      statBlock(store),
      renderSavingThrows(store)
    ),
    // Middle column
    el("div", { class: "col col--mid" },
      renderSkillList(store)
    ),
    // Right column
    el("div", { class: "col col--right" },
      renderHpBar(store),
      renderHitDicePanel(store),
      renderCombatQuick(store),
      showSpellcasting ? renderSpellcastingQuick(store) : null
    )
  );

  return el("div", { class: "overview" },
    grid,
    renderOverviewTabCard(store, state, rerender)
  );
}

function statBlock(store) {
  const d = store.derived;
  const doc = store.doc;

  const row = (label, value, tip, overridePath, overridden, statKey) => {
    const attrs = { class: "stat-pair" };
    if (overridePath) {
      attrs["data-override-path"] = overridePath;
      if (overridden) attrs["data-overridden"] = "true";
    }
    const r = el("div", attrs,
      el("div", { class: "stat-pair__label" }, label),
      el("div", { class: "stat-pair__value" }, value)
    );
    if (tip) {
      const note   = statKey ? (doc.combat.statNotes?.[statKey] || null) : null;
      const source = statKey ? (doc.combat.statSources?.[statKey] || null) : null;
      if (note || source) {
        bindTooltip(r, {
          title: tip.title,
          html: buildTooltipHtml({ baseText: tip.summary, acquiredFrom: source, userNotes: note })
        });
      } else {
        bindTooltip(r, tip);
      }
    }
    return r;
  };

  return el("div", { class: "panel panel--stats" },
    el("div", { class: "stat-pair-grid" },
      row("AC", d.ac, { title: "Armor Class", summary: "Base AC. Auto-calculated from equipped armor, shield, and ability modifiers." }, "ac", doc.combat.acOverride != null, "ac"),
      row("Initiative", fmt(d.initiative), { title: "Initiative", summary: `DEX mod${doc.combat.initiativeBonus ? " + " + doc.combat.initiativeBonus : ""}.` }, "initiative", doc.combat.initiativeOverride != null, "initiative"),
      row("Speed", `${d.speed} ft`, { title: "Speed", summary: "Walking speed in feet." }, "speed", doc.combat.speedOverride != null, "speed"),
      row("Prof. Bonus", `+${d.profBonus}`, { title: "Proficiency Bonus", summary: `+${d.profBonus} at level ${d.totalLevel}.` }, "profBonus", doc.combat.profBonusOverride != null, "profBonus"),
      row("Passive Perception", d.passivePerception, { title: "Passive Perception", summary: "10 + Perception modifier." }, "passivePerception", doc.combat.passiveOverrides?.perception != null, "passivePerception"),
      row("Hit Dice", `${Math.max(0, d.totalLevel - (doc.combat.hitDiceUsed?.[`d${d.hitDie}`] || 0))} / ${d.totalLevel} d${d.hitDie}`, { title: "Hit Dice", summary: "Spent on short rests to recover HP." }, "hitDie", doc.combat.hitDieOverride != null, "hitDie"),
    )
  );
}

function renderCombatQuick(store) {
  const d = store.derived;
  const doc = store.doc;

  return el("div", { class: "panel" },
    el("h3", {}, "Death Saves"),
    el("div", { class: "death-saves" },
      el("div", { class: "label" }, "Successes"),
      renderPips({
        total: 3, used: doc.combat.deathSaves.successes,
        onChange: n => store.update(x => { x.combat.deathSaves.successes = n; }),
        variant: "success"
      }),
      el("div", { class: "label" }, "Failures"),
      renderPips({
        total: 3, used: doc.combat.deathSaves.failures,
        onChange: n => store.update(x => { x.combat.deathSaves.failures = n; }),
        variant: "failure"
      }),
    )
  );
}

function renderSpellcastingQuick(store) {
  const d = store.derived;
  const doc = store.doc;
  const sc = doc.spellcasting || {};
  const sn = sc.statNotes   || {};
  const ss = sc.statSources || {};

  const spPair = (label, value, overridePath, isOverridden, tipTitle, tipSummary, noteKey) => {
    const r = el("div", {
      class: "stat-pair",
      "data-override-path": overridePath,
      "data-overridden": isOverridden ? "true" : null
    },
      el("div", { class: "stat-pair__label" }, label),
      el("div", { class: "stat-pair__value" }, value)
    );
    bindTooltip(r, {
      title: tipTitle,
      html: buildTooltipHtml({ baseText: tipSummary, acquiredFrom: ss[noteKey] || null, userNotes: sn[noteKey] || null })
    });
    return r;
  };

  return el("div", { class: "panel panel--spellcasting" },
    el("h3", {}, "Spellcasting"),
    el("div", { class: "stat-pair-grid" },
      spPair("Ability",  d.spellAbility?.toUpperCase() || "—", "spellAbility", !!sc.abilityOverride,       "Spellcasting Ability", "The ability used for spell attacks and save DCs.",    "spellAbility"),
      spPair("Save DC",  d.spellSaveDC ?? "—",                 "spellSaveDC",  sc.saveDcOverride != null,  "Spell Save DC",        "DC that enemies must beat to resist your spells.",    "spellSaveDC"),
      spPair("Attack",   fmt(d.spellAttack),                   "spellAttack",  sc.attackOverride != null,  "Spell Attack Bonus",   "Bonus added to your spell attack rolls.",             "spellAttack"),
    )
  );
}

const fmt = m => m == null ? "—" : (m >= 0 ? `+${m}` : `${m}`);

/* ─────────────────────── overview tab-card ─────────────────────── */

const OVERVIEW_MAIN_TABS = [
  { id: "actions",     label: "Actions" },
  { id: "spells",      label: "Spells" },
  { id: "inventory",   label: "Inventory" },
  { id: "features",    label: "Features & Traits" },
  { id: "backgrounds", label: "Background" },
  { id: "codex",       label: "Codex" },
];

function renderOverviewTabCard(store, state, rerender) {
  const ov = state.overview || (state.overview = { main: "actions", sub: {} });

  const mainPanes = OVERVIEW_MAIN_TABS.map(m => {
    switch (m.id) {
      case "actions":     return buildActionsPane(store, state);
      case "spells":      return buildSpellsPane(store, state);
      case "inventory":   return buildInventoryPane(store, state);
      case "features":    return buildFeaturesPane(store, state);
      case "backgrounds": return buildBackgroundsPane(store, state);
      case "codex":       return buildCodexPane(store, state, rerender);
    }
  });

  // Apply persisted active state
  mainPanes.forEach((pane, i) => {
    pane.classList.toggle("active", ov.main === OVERVIEW_MAIN_TABS[i].id);
  });

  const tabCard = el("div", { class: "tab-card tab-card--overview" },
    el("div", { class: "main-tab-bar" },
      ...OVERVIEW_MAIN_TABS.map(m => {
        const btn = el("button", {
          class: "mtab" + (ov.main === m.id ? " active" : ""),
          "data-main": m.id
        }, m.label);
        btn.addEventListener("click", () => { ov.main = m.id; });
        return btn;
      })
    ),
    ...mainPanes
  );

  initTabbedContainer(tabCard);
  return tabCard;
}

// Build a .main-pane with sub-tab bar + sub-panes. `subs` is [{id, label, build}]
function buildSubTabPane(groupId, subs, state) {
  const ov = state.overview;
  const current = ov.sub[groupId] || subs[0].id;

  const bar = el("div", { class: "sub-tab-bar" },
    ...subs.map(s => {
      const btn = el("button", {
        class: "stab" + (current === s.id ? " active" : ""),
        "data-group": groupId,
        "data-sub": s.id
      }, s.label);
      btn.addEventListener("click", () => { ov.sub[groupId] = s.id; });
      return btn;
    })
  );

  const panes = subs.map(s => {
    const pane = el("div", {
      class: "sub-pane" + (current === s.id ? " active" : ""),
      id: `sp-${groupId}-${s.id}`
    });
    const content = s.build();
    if (content) {
      if (Array.isArray(content)) pane.append(...content.filter(Boolean));
      else pane.append(content);
    }
    return pane;
  });

  return el("div", { class: "main-pane", id: `mp-${groupId}` }, bar, ...panes);
}

// ── shared row helpers ────────────────────────────────────────────────────
function ovEmpty(text) {
  return el("div", { class: "ov-empty" }, text);
}
function ovList(items) {
  if (!items.length) return ovEmpty("Nothing here yet.");
  return el("div", { class: "ov-list" }, ...items);
}
function ovRow(title, meta, onClick, actions) {
  const attrs = { class: "ov-row" + (actions?.length ? " ov-row--has-actions" : "") };
  if (onClick) attrs.onclick = onClick;
  return el("div", attrs,
    el("div", { class: "ov-row__name" }, title),
    meta ? el("div", { class: "ov-row__meta" }, meta) : el("div", { class: "ov-row__meta" }),
    actions?.length ? el("div", { class: "ov-row__actions" }, ...actions) : null
  );
}
function ovAddBar(...buttons) {
  return el("div", { class: "ov-add-bar" }, ...buttons.filter(Boolean));
}
function ovAddBtn(label, onClick) {
  return el("button", { class: "btn btn--sm ov-add-btn", onclick: onClick }, label);
}
function ovPane(list, ...addBtns) {
  return el("div", {},
    list,
    addBtns.length ? ovAddBar(...addBtns) : null
  );
}

/* ── Actions pane ── */
function buildActionsPane(store, state) {
  const doc = store.doc;
  const d = store.derived;

  const equippedWeapons = (doc.equipment.items || [])
    .filter(i => i.equipped)
    .map(i => {
      const base = i.itemId ? ITEMS[i.itemId] : i.custom;
      if (!base || base.type !== "weapon") return null;
      const ov = (doc.combat.attackOverrides || {})[i.instanceId] || null;
      return { instance: i, base: ov ? { ...base, ...ov } : base };
    })
    .filter(Boolean);
  const customAttacks = doc.combat.customAttacks || [];
  const customActions = doc.combat.customActions || [];

  const features = d.features || [];
  const matchAction   = (f) => /(^|\b)as an action\b|\buse (a|your) action\b|\btake the .* action\b/i.test(f.desc || "");
  const matchBonus    = (f) => /\bbonus action\b/i.test(f.desc || "");
  const matchReaction = (f) => /\breaction\b/i.test(f.desc || "");
  const actionFeats   = features.filter(f => matchAction(f)   && !matchBonus(f) && !matchReaction(f));
  const bonusFeats    = features.filter(f => matchBonus(f));
  const reactionFeats = features.filter(f => matchReaction(f));
  const otherLimited  = features.filter(f => /\buses?\b.*(per|\/)\s*(short|long) rest|\b(\d+)\s*\/\s*(short|long) rest/i.test(f.desc || ""));

  const weaponRows = equippedWeapons.map(({ instance, base }) => {
    const meta = `${base.damage || "—"} ${base.damageType || ""} · ${base.range || "melee"}`;
    const row = ovRow(base.name, meta, () => openItemDetail(base, { store, instanceId: instance.instanceId }));
    bindTooltip(row, {
      title: base.name,
      html: buildTooltipHtml({
        baseText: meta + (base.properties?.length ? `\nProperties: ${base.properties.join(", ")}` : ""),
        acquiredFrom: instance.source || "",
        userNotes: instance.notes || ""
      }),
      sourceRef: instance.itemId ? "SRD" : "Homebrew",
      onMore: () => openItemDetail(base, { store, instanceId: instance.instanceId })
    });
    return row;
  });

  const customAttackRow = (a) => {
    const meta = `${a.damage || "—"} ${a.damageType || ""} · ${a.range || "—"}`;
    const editBtn = el("button", { class: "btn btn--sm", title: "Edit", onclick: e => {
      e.stopPropagation();
      openHomebrewForm({
        schema: ATTACK_SCHEMA,
        initial: ATTACK_SCHEMA.disassemble(a),
        onSave: record => store.update(x => {
          const idx = (x.combat.customAttacks || []).findIndex(r => r.id === a.id);
          if (idx >= 0) x.combat.customAttacks[idx] = { ...record, id: a.id };
        })
      });
    }}, "✎");
    const delBtn = el("button", { class: "btn btn--sm btn--danger", title: "Remove", onclick: e => {
      e.stopPropagation();
      store.update(x => { x.combat.customAttacks = (x.combat.customAttacks || []).filter(r => r.id !== a.id); });
    }}, "×");
    const row = ovRow(a.name + " ★", meta, null, [editBtn, delBtn]);
    bindTooltip(row, {
      title: a.name,
      html: buildTooltipHtml({
        baseText: meta + (a.properties?.length ? `\nProperties: ${a.properties.join(", ")}` : ""),
        acquiredFrom: a._acquiredFrom || "",
        userNotes: a.notes || a._userNotes || ""
      }),
      sourceRef: "Homebrew"
    });
    return row;
  };

  const featureRow = (f) => {
    const row = ovRow(f.name,
      (f.desc || "").slice(0, 120) + ((f.desc?.length || 0) > 120 ? "…" : ""),
      () => openFeatureDetail(f, { store }));
    const savedSource = store.doc.features?.sources?.[f.id] || "";
    bindTooltip(row, {
      title: f.name,
      html: buildTooltipHtml({ baseText: f.desc, acquiredFrom: savedSource, userNotes: f.userNotes }),
      sourceRef: f.source,
      onMore: () => openFeatureDetail(f, { store })
    });
    return row;
  };

  const customActionRow = (a) => {
    const typeLabel = { action: "Action", bonusAction: "Bonus Action", reaction: "Reaction", other: "Other" }[a.actionType] || "Custom";
    const editBtn = el("button", { class: "btn btn--sm", title: "Edit", onclick: e => {
      e.stopPropagation();
      openAddCustomActionModal(store, a.actionType || "action", a);
    }}, "✎");
    const delBtn = el("button", { class: "btn btn--sm btn--danger", title: "Remove", onclick: e => {
      e.stopPropagation();
      store.update(x => { x.combat.customActions = (x.combat.customActions || []).filter(r => r.id !== a.id); });
    }}, "×");
    const row = ovRow(a.name + (a.used ? " · used" : ""), typeLabel, null, [editBtn, delBtn]);
    bindTooltip(row, { title: a.name, html: buildTooltipHtml({ baseText: `${typeLabel} — click ✎ to edit or × to remove` }) });
    return row;
  };

  // Filter customActions by type (legacy records without actionType default to "action")
  const caByType = (type) => customActions.filter(a => (a.actionType || "action") === type);
  const caOther  = customActions.filter(a => a.actionType === "other");

  const mkAddAttack = () => ovAddBtn("+ Add Attack", () => openHomebrewForm({
    schema: ATTACK_SCHEMA,
    onSave: record => store.update(x => {
      x.combat.customAttacks = x.combat.customAttacks || [];
      x.combat.customAttacks.push(record);
    })
  }));
  const mkAddAction = (type = "action") => ovAddBtn("+ Add Custom Action", () => openAddCustomActionModal(store, type));

  const customAttackRows = customAttacks.map(customAttackRow);

  const subs = [
    { id: "all", label: "All", build: () => ovPane(ovList([
      ...weaponRows, ...customAttackRows,
      ...actionFeats.map(featureRow),   ...caByType("action").map(customActionRow),
      ...bonusFeats.map(featureRow),    ...caByType("bonusAction").map(customActionRow),
      ...reactionFeats.map(featureRow), ...caByType("reaction").map(customActionRow),
      ...caOther.map(customActionRow)
    ]), mkAddAttack(), mkAddAction())},
    { id: "attack",   label: "Attack",       build: () => ovPane(ovList([...weaponRows, ...customAttackRows]), mkAddAttack()) },
    { id: "action",   label: "Action",       build: () => ovPane(ovList([...actionFeats.map(featureRow),   ...caByType("action").map(customActionRow)]),      mkAddAction("action")) },
    { id: "bonus",    label: "Bonus Action", build: () => ovPane(ovList([...bonusFeats.map(featureRow),    ...caByType("bonusAction").map(customActionRow)]),  mkAddAction("bonusAction")) },
    { id: "reaction", label: "Reaction",     build: () => ovPane(ovList([...reactionFeats.map(featureRow), ...caByType("reaction").map(customActionRow)]),     mkAddAction("reaction")) },
    { id: "other",    label: "Other",        build: () => ovPane(ovList(caOther.map(customActionRow)), mkAddAction("other")) },
    { id: "limited",  label: "Limited Use",  build: () => ovPane(ovList(otherLimited.map(featureRow)), mkAddAction("other")) },
  ];
  return buildSubTabPane("actions", subs, state);
}

/* ── Spells pane ── */
function buildSpellsPane(store, state) {
  const doc = store.doc;
  const d = store.derived;
  const cls = d.primaryClass;
  const hasCaster = !!cls?.spellcasting;
  const known = new Set(doc.spellcasting.knownSpells || []);
  const overrides = doc.spellcasting.spellOverrides || {};
  const byLevel = hasCaster ? spellsByLevel(cls.id) : new Map();

  const spells = [];
  if (hasCaster) {
    for (const lvl of byLevel.keys()) {
      for (const s of byLevel.get(lvl)) {
        if (known.has(s.id)) {
          const ov = overrides[s.id];
          spells.push(ov ? { ...s, ...ov, id: s.id } : s);
        }
      }
    }
  }
  for (const s of doc.spellcasting.custom || []) spells.push(s);

  const sc = doc.spellcasting || {};
  const spellRow = (s) => {
    const isCustom = !!s.custom;
    const label = s.name + (isCustom ? " ★" : "") + (s.concentration ? " · C" : "") + (s.ritual ? " · R" : "");
    const meta = `${s.school || ""} · ${s.castingTime || ""}`.trim();
    const row = ovRow(label, meta, () => openSpellDetail(s, { store }));
    const compParts = [];
    if (s.components?.v) compParts.push("V");
    if (s.components?.s) compParts.push("S");
    if (s.components?.m) compParts.push(`M${s.components.material ? ` (${s.components.material})` : ""}`);
    const compStr = compParts.join(", ") || "—";
    const tipBase = [
      `Casting Time: ${s.castingTime || "—"}`,
      `Range: ${s.range || "—"}`,
      `Components: ${compStr}`,
      `Duration: ${s.duration || "—"}`
    ].join(" · ") + (s.description ? "\n\n" + s.description.slice(0, 160) + (s.description.length > 160 ? "…" : "") : "");
    bindTooltip(row, {
      title: s.name,
      html: buildTooltipHtml({
        baseText: tipBase,
        acquiredFrom: sc.spellSources?.[s.id] || s._acquiredFrom || s.source || "",
        userNotes: sc.spellNotes?.[s.id] || s._userNotes || ""
      }),
      sourceRef: isCustom ? "Homebrew" : "SRD",
      onMore: () => openSpellDetail(s, { store })
    });
    return row;
  };

  const byLvl = (lvl) => spells.filter(s => (s.level ?? 0) === lvl);
  const ritualList = spells.filter(s => s.ritual);
  const concList   = spells.filter(s => s.concentration);

  const addCustomSpell = (lvl) => ovAddBtn(
    lvl === 0 ? "+ Add Custom Cantrip" : "+ Add Custom Spell",
    () => openHomebrewForm({
      schema: SPELL_SCHEMA,
      initial: { level: lvl ?? 1, castingTime: "1 action", duration: "Instantaneous", school: "evocation", name: "", description: "" },
      onSave: record => store.update(x => {
        x.spellcasting.custom = x.spellcasting.custom || [];
        x.spellcasting.custom.push(lvl === 0 ? { ...record, level: 0 } : record);
      })
    })
  );

  const spellLibraryDropdown = hasCaster
    ? el("details", { class: "ov-library" },
        el("summary", { class: "ov-library__toggle" }, "+ Add from Spell Library"),
        el("div", { class: "ov-library__list" },
          ...[...byLevel.keys()].sort((a, b) => a - b).flatMap(lvl =>
            byLevel.get(lvl).filter(s => !known.has(s.id)).map(s =>
              el("button", {
                class: "btn btn--sm",
                onclick: () => store.update(x => {
                  x.spellcasting.knownSpells = [...new Set([...(x.spellcasting.knownSpells || []), s.id])];
                })
              }, `${s.name} (${lvl === 0 ? "Cantrip" : `L${lvl}`})`)
            )
          )
        )
      )
    : null;

  const levelSubs = [];
  for (let lvl = 1; lvl <= 9; lvl++) {
    if (byLvl(lvl).length > 0) {
      levelSubs.push({
        id: `l${lvl}`, label: `Level ${lvl}`,
        build: () => ovPane(ovList(byLvl(lvl).map(spellRow)), addCustomSpell(lvl))
      });
    }
  }

  const subs = [
    { id: "all", label: "All", build: () => {
      const parts = [];
      if (byLvl(0).length) parts.push(el("h4", { class: "ov-group-h" }, "Cantrips"), ovList(byLvl(0).map(spellRow)));
      for (let lvl = 1; lvl <= 9; lvl++) {
        if (byLvl(lvl).length) parts.push(el("h4", { class: "ov-group-h" }, `Level ${lvl}`), ovList(byLvl(lvl).map(spellRow)));
      }
      const list = parts.length ? el("div", {}, ...parts) : ovEmpty("No spells known.");
      return el("div", {}, list, ovAddBar(addCustomSpell(0), addCustomSpell(1)), spellLibraryDropdown);
    }},
    { id: "cantrips", label: "Cantrips", build: () => ovPane(ovList(byLvl(0).map(spellRow)), addCustomSpell(0)) },
    ...levelSubs,
    { id: "ritual",        label: "Ritual",        build: () => ovPane(ovList(ritualList.map(spellRow)), addCustomSpell(1)) },
    { id: "concentration", label: "Concentration", build: () => ovPane(ovList(concList.map(spellRow)),   addCustomSpell(1)) },
  ];
  return el("div", { class: "spells-pane" },
    renderSlotTracker(store, d.slots),
    buildSubTabPane("spells", subs, state)
  );
}

/* ── Inventory pane ── */
function buildInventoryPane(store, state) {
  const doc = store.doc;
  const items = doc.equipment.items || [];

  const getBase = (it) => {
    const baseData = it.itemId ? ITEMS[it.itemId] : it.custom;
    if (!baseData) return null;
    return (it.overrides && Object.keys(it.overrides).length)
      ? { ...baseData, ...it.overrides } : baseData;
  };
  const rowFor = (it) => {
    const base = getBase(it);
    if (!base) return null;
    const isCustom = !it.itemId && !!it.custom;
    const meta = base.type === "weapon" ? `${base.damage || ""} ${base.damageType || ""}`.trim()
               : base.type === "armor"  ? `AC ${base.ac} (${base.armorType})`
               : (base.description || "").slice(0, 80);
    const qty = it.quantity > 1 ? ` ×${it.quantity}` : "";
    const row = ovRow(base.name + qty + (it.equipped ? " · equipped" : "") + (it.attuned ? " · attuned" : ""),
      meta, () => openItemDetail(base, { store, instanceId: it.instanceId }));
    const acquiredFrom = it.source || (isCustom ? (it.custom?._acquiredFrom || "") : "");
    const userNotes    = it.notes  || (isCustom ? (it.custom?._userNotes    || "") : "");
    bindTooltip(row, {
      title: base.name,
      html: buildTooltipHtml({ baseText: meta || base.description, acquiredFrom, userNotes }),
      sourceRef: isCustom ? "Homebrew" : "SRD",
      onMore: () => openItemDetail(base, { store, instanceId: it.instanceId })
    });
    return row;
  };

  const isComponentPouch = (it) => {
    const base = getBase(it);
    return /component pouch/i.test(base?.name || "");
  };
  const isBackpack = (it) => {
    const base = getBase(it);
    return /backpack|haversack|sack$|\bpack\b/i.test(base?.name || "") && !isComponentPouch(it);
  };

  const equipment   = items.filter(it => it.equipped);
  const backpacks   = items.filter(isBackpack);
  const compPouches = items.filter(isComponentPouch);
  const attunement  = items.filter(it => it.attuned);
  const other       = items.filter(it =>
    !it.equipped && !it.attuned && !isBackpack(it) && !isComponentPouch(it));

  const mkAddCustomItem = () => ovAddBtn("+ Add Custom Item", () => openHomebrewForm({
    schema: ITEM_SCHEMA,
    onSave: record => store.update(x => {
      x.equipment.items.push({
        instanceId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        itemId: null, custom: record, quantity: 1,
        equipped: false, attuned: false, notes: "", containerId: null
      });
    })
  }));

  const itemLibrary = el("details", { class: "ov-library" },
    el("summary", { class: "ov-library__toggle" }, "+ Add from Item Library"),
    el("div", { class: "ov-library__list" },
      ...groupedItems().map(group => el("div", { class: "ov-library__group" },
        el("div", { class: "ov-library__group-title" }, group.label),
        ...group.items.map(base => el("button", {
          class: "btn btn--sm",
          onclick: () => store.update(x => {
            x.equipment.items.push({
              instanceId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
              itemId: base.id, custom: null, quantity: 1,
              equipped: false, attuned: false, notes: "", containerId: null
            });
          })
        }, base.name))
      ))
    )
  );

  const subs = [
    { id: "all",        label: "All",               build: () => el("div", {}, ovList(items.map(rowFor).filter(Boolean)), ovAddBar(mkAddCustomItem()), itemLibrary) },
    { id: "equipment",  label: "Equipment",         build: () => ovPane(ovList(equipment.map(rowFor).filter(Boolean)), mkAddCustomItem()) },
    { id: "backpack",   label: "Backpack",          build: () => ovPane(ovList(backpacks.map(rowFor).filter(Boolean)), mkAddCustomItem()) },
    { id: "pouch",      label: "Component Pouch",   build: () => ovPane(ovList(compPouches.map(rowFor).filter(Boolean)), mkAddCustomItem()) },
    { id: "attunement", label: "Attunement",        build: () => ovPane(ovList(attunement.map(rowFor).filter(Boolean)), mkAddCustomItem()) },
    { id: "other",      label: "Other Possessions", build: () => ovPane(ovList(other.map(rowFor).filter(Boolean)), mkAddCustomItem()) },
  ];
  return buildSubTabPane("inventory", subs, state);
}

/* ── Features & Traits pane ── */
function buildFeaturesPane(store, state) {
  const doc = store.doc;
  const d = store.derived;
  const features = d.features || [];

  const featureRow = (f) => {
    const row = ovRow(
      f.name + (f.level ? ` · L${f.level}` : "") + (f.kind === "custom" ? " ★" : ""),
      (f.desc || "").slice(0, 120) + ((f.desc?.length || 0) > 120 ? "…" : ""),
      () => openFeatureDetail(f, { store })
    );
    const savedSource = store.doc.features?.sources?.[f.id] || "";
    bindTooltip(row, {
      title: f.name,
      html: buildTooltipHtml({ baseText: f.desc, acquiredFrom: savedSource, userNotes: f.userNotes }),
      sourceRef: f.source,
      onMore: () => openFeatureDetail(f, { store })
    });
    return row;
  };

  const classFeats = features.filter(f => f.kind === "class");
  const traits     = features.filter(f => f.kind === "race" || f.kind === "background");
  const featsList  = features.filter(f =>
    (doc.features?.featIds || []).includes(f.id) || /\bfeat\b/i.test(f.source || ""));

  const mkAddFeature = () => ovAddBtn("+ Add Custom Feature", () => openHomebrewForm({
    schema: FEATURE_SCHEMA,
    onSave: record => store.update(x => {
      x.features.custom = x.features.custom || [];
      x.features.custom.push(record);
    })
  }));

  const subs = [
    { id: "all",    label: "All",            build: () => ovPane(ovList(features.map(featureRow)), mkAddFeature()) },
    { id: "class",  label: "Class Features", build: () => ovPane(ovList(classFeats.map(featureRow)), mkAddFeature()) },
    { id: "traits", label: "Special Traits", build: () => ovPane(ovList(traits.map(featureRow)), mkAddFeature()) },
    { id: "feats",  label: "Feats",          build: () => ovPane(ovList(featsList.map(featureRow)), mkAddFeature()) },
  ];
  return buildSubTabPane("features", subs, state);
}

/* ── Background pane ── */
function buildBackgroundsPane(store, state) {
  const doc = store.doc;

  const proseList = (label, path) => {
    const arr = (doc.lore?.[path] || []);
    return el("div", { class: "ov-prose-group" },
      el("h4", { class: "ov-group-h" }, label),
      el("textarea", {
        class: "ov-prose",
        rows: 3,
        placeholder: `Record your ${label.toLowerCase()}, one per line…`,
        value: Array.isArray(arr) ? arr.join("\n") : (arr || ""),
        onchange: e => store.update(x => {
          const lines = e.target.value.split("\n").map(s => s.trim()).filter(Boolean);
          x.lore = x.lore || {};
          x.lore[path] = lines;
        })
      })
    );
  };

  const identityField = (label, key) => el("label", { class: "ov-field" },
    el("span", { class: "ov-field-label" }, label),
    el("input", {
      type: "text",
      value: doc.identity?.[key] || "",
      placeholder: `—`,
      onchange: e => store.update(x => { x.identity[key] = e.target.value; })
    })
  );

  const subs = [
    { id: "characteristics", label: "Characteristics", build: () => el("div", { class: "ov-prose-wrap" },
      proseList("Personality Traits", "personalityTraits"),
      proseList("Ideals", "ideals"),
      proseList("Bonds", "bonds"),
      proseList("Flaws", "flaws")
    )},
    { id: "appearance", label: "Appearance", build: () => el("div", { class: "ov-fields-grid" },
      identityField("Age", "age"),
      identityField("Height", "height"),
      identityField("Weight", "weight"),
      identityField("Eyes", "eyes"),
      identityField("Hair", "hair"),
      identityField("Skin", "skin"),
      identityField("Gender", "gender")
    )},
  ];
  return buildSubTabPane("backgrounds", subs, state);
}

/* ── Codex pane (lined parchment) ── */
function buildCodexPane(store, state, rerender) {
  const subs = CODEX_SECTIONS.map(s => ({
    id: s.id,
    label: s.title,
    build: () => {
      const page = el("article", { class: "codex__page" });
      renderCodexPage(page, s.id, store);
      const header = el("header", { class: "codex__page-header" },
        el("span", { class: "codex__page-num" }, s.flourish),
        el("h2", { class: "codex__page-title" }, s.title)
      );
      return el("div", { class: "codex codex--embedded" },
        el("div", { class: "codex__book" }, header, page)
      );
    }
  }));
  return buildSubTabPane("codex", subs, state);
}

/* ─────────────────────── combat tab ─────────────────────── */

function renderCombatTab(store) {
  const doc = store.doc;
  const d = store.derived;

  // Equipped weapons merged with any per-instance attack overrides
  const equippedWeapons = (doc.equipment.items || [])
    .filter(i => i.equipped)
    .map(i => {
      const base = i.itemId ? ITEMS[i.itemId] : i.custom;
      if (!base || base.type !== "weapon") return null;
      const ov = (doc.combat.attackOverrides || {})[i.instanceId] || null;
      return { instance: i, base, override: ov };
    })
    .filter(Boolean);

  const customAttacks = doc.combat.customAttacks || [];
  const customActions = doc.combat.customActions || [];
  const hasAttacks = equippedWeapons.length > 0 || customAttacks.length > 0;

  return el("div", { class: "sheet__grid" },
    el("div", { class: "col col--wide" },
      renderHpBar(store),

      /* ── Attacks ── */
      el("div", { class: "panel" },
        el("div", { class: "panel__header" },
          el("h3", {}, "Attacks"),
          el("button", {
            class: "btn btn--sm btn--add-custom",
            onclick: () => openHomebrewForm({
              schema: ATTACK_SCHEMA,
              onSave: record => store.update(x => {
                x.combat.customAttacks = x.combat.customAttacks || [];
                x.combat.customAttacks.push(record);
              })
            })
          }, "+ Add Attack")
        ),
        !hasAttacks
          ? el("p", { class: "muted" }, "No weapons equipped. Equip from inventory or add a custom attack.")
          : el("div", { class: "attack-list" },
              ...equippedWeapons.map(({ instance, base, override }) =>
                renderAttackRow(store, d, "equipped", { instance, base, override })
              ),
              ...customAttacks.map(atk =>
                renderAttackRow(store, d, "custom", { atk })
              )
            )
      ),

      /* ── Action Economy ── */
      el("div", { class: "panel" },
        el("div", { class: "panel__header" },
          el("h3", {}, "Action Economy"),
          el("button", {
            class: "btn btn--sm",
            onclick: () => store.update(x => {
              x.combat.actionEconomy = { action: false, bonusAction: false, reaction: false };
              (x.combat.customActions || []).forEach(a => { a.used = false; });
            })
          }, "Reset Turn")
        ),
        el("div", { class: "action-economy" },
          actionPip("Action",       doc.combat.actionEconomy?.action,       v => store.update(x => { x.combat.actionEconomy.action = v; })),
          actionPip("Bonus Action", doc.combat.actionEconomy?.bonusAction,  v => store.update(x => { x.combat.actionEconomy.bonusAction = v; })),
          actionPip("Reaction",     doc.combat.actionEconomy?.reaction,     v => store.update(x => { x.combat.actionEconomy.reaction = v; })),
          ...customActions.map((a, idx) => customActionPip(store, a, idx)),
          el("button", {
            class: "btn btn--sm btn--add-custom btn--edit-only",
            onclick: () => openAddCustomActionModal(store)
          }, "+ Add")
        )
      ),

      /* ── Hit Dice ── */
      renderHitDicePanel(store)
    ),
    el("div", { class: "col col--side" },
      renderCombatQuick(store),
      el("div", { class: "panel" },
        el("h3", {}, "Conditions"),
        (doc.combat.conditions || []).length === 0
          ? el("p", { class: "muted" }, "None.")
          : el("ul", {},
              ...doc.combat.conditions.map(c => el("li", {}, c.conditionId))
            )
      )
    )
  );
}

// ── Attack helpers ────────────────────────────────────────────────────────────

/** Ability mod for the chosen attack ability (excludes proficiency). */
function atkAbilityMod(atkAbility, d) {
  if (atkAbility === "spell") {
    if (d.spellAttack != null) return d.spellAttack - d.profBonus;
    return d.abilities.str.mod;
  }
  if (atkAbility === "flat") return 0;
  return d.abilities[atkAbility]?.mod ?? 0;
}

/** Full attack bonus including proficiency. */
function calcAtkBonus(atkAbility, d) {
  if (atkAbility === "spell") return d.spellAttack ?? (d.abilities.str.mod + d.profBonus);
  if (atkAbility === "flat") return d.profBonus;
  return (d.abilities[atkAbility]?.mod ?? 0) + d.profBonus;
}

/** Best ability for a weapon based on properties. */
function weaponAbility(base, d) {
  const props = base.properties || [];
  const isRanged = props.includes("ranged") || (base.range && base.range.includes("/"));
  if (props.includes("finesse")) {
    return d.abilities.dex.mod >= d.abilities.str.mod ? "dex" : "str";
  }
  return isRanged ? "dex" : "str";
}

function renderAttackRow(store, d, kind, opts) {
  let name, atkBonus, dmgStr, range, properties, notes, acquiredFrom, isEdited;

  if (kind === "equipped") {
    const { instance, base, override } = opts;
    isEdited = !!override;
    const merged = override ? { ...base, ...override } : base;
    name = merged.name || base.name;
    const ability = override?.atkAbility || weaponAbility(base, d);
    atkBonus = calcAtkBonus(ability, d);
    const mod = atkAbilityMod(ability, d);
    const modPart = mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : "";
    dmgStr = `${merged.damage || "—"}${modPart} ${merged.damageType || ""}`.trim();
    range = merged.range || "melee";
    properties = (merged.properties || []).join(", ");
    notes = override?.notes || "";
    acquiredFrom = opts.instance.source || "";
  } else {
    const { atk } = opts;
    isEdited = false;
    name = atk.name;
    atkBonus = calcAtkBonus(atk.atkAbility, d);
    const mod = atkAbilityMod(atk.atkAbility, d);
    const modPart = mod !== 0 ? (mod > 0 ? `+${mod}` : `${mod}`) : "";
    dmgStr = `${atk.damage || "—"}${modPart} ${atk.damageType || ""}`.trim();
    range = atk.range || "melee";
    properties = (atk.properties || []).join(", ");
    notes = atk.notes || "";
    acquiredFrom = atk._acquiredFrom || "";
  }

  // Actions column: edit + remove/revert (edit-mode only)
  const actionBtns = [];
  actionBtns.push(el("button", {
    class: "btn btn--sm",
    title: "Edit attack",
    onclick: (e) => {
      e.stopPropagation();
      if (kind === "equipped") {
        const { instance, base, override } = opts;
        const ability = override?.atkAbility || weaponAbility(base, d);
        const initial = {
          id: instance.instanceId,
          name: override?.name || base.name,
          atkAbility: ability,
          damage: override?.damage || base.damage || "",
          damageType: override?.damageType || base.damageType || "",
          range: override?.range || base.range || "",
          properties: override?.properties || base.properties || [],  // keep as array — disassemble will join
          notes: override?.notes || ""
        };
        openHomebrewForm({
          schema: ATTACK_SCHEMA,
          initial: ATTACK_SCHEMA.disassemble(initial),
          onSave: record => store.update(x => {
            x.combat.attackOverrides = x.combat.attackOverrides || {};
            x.combat.attackOverrides[instance.instanceId] = record;
          })
        });
      } else {
        const { atk } = opts;
        openHomebrewForm({
          schema: ATTACK_SCHEMA,
          initial: ATTACK_SCHEMA.disassemble(atk),
          onSave: record => store.update(x => {
            const idx = (x.combat.customAttacks || []).findIndex(a => a.id === atk.id);
            if (idx >= 0) x.combat.customAttacks[idx] = { ...record, id: atk.id };
          })
        });
      }
    }
  }, "✎"));

  if (kind === "custom") {
    actionBtns.push(el("button", {
      class: "btn btn--sm btn--danger",
      title: "Remove attack",
      onclick: (e) => {
        e.stopPropagation();
        store.update(x => {
          x.combat.customAttacks = (x.combat.customAttacks || []).filter(a => a.id !== opts.atk.id);
        });
      }
    }, "×"));
  } else if (opts.override) {
    actionBtns.push(el("button", {
      class: "btn btn--sm btn--ghost",
      title: "Revert to original weapon stats",
      onclick: (e) => {
        e.stopPropagation();
        store.update(x => {
          if (x.combat.attackOverrides) delete x.combat.attackOverrides[opts.instance.instanceId];
        });
      }
    }, "↺"));
  }

  const row = el("div", { class: `attack-row${isEdited ? " is-edited" : ""}${kind === "custom" ? " is-custom" : ""}` },
    el("div", { class: "attack-row__name" },
      name,
      kind === "custom" ? el("span", { class: "attack-badge" }, "★") : null,
      isEdited ? el("span", { class: "attack-badge" }, "✎") : null
    ),
    el("div", { class: "attack-row__atk" }, fmt(atkBonus)),
    el("div", { class: "attack-row__dmg" }, dmgStr),
    el("div", { class: "attack-row__range" }, range),
    el("div", { class: "attack-row__actions btn--edit-only" }, ...actionBtns)
  );

  // Tooltip
  const tipLines = [
    `ATK: ${fmt(atkBonus)}`,
    `Damage: ${dmgStr || "—"}`,
    `Range: ${range || "—"}`
  ];
  if (properties) tipLines.push(`Properties: ${properties}`);
  bindTooltip(row, {
    title: name,
    html: buildTooltipHtml({ baseText: tipLines.join(" · "), acquiredFrom, userNotes: notes })
  });

  return row;
}

// ── Action Economy helpers ────────────────────────────────────────────────────

function actionPip(label, used, onChange) {
  return el("button", {
    class: `action-pip${used ? " is-used" : ""}`,
    type: "button",
    onclick: () => onChange(!used)
  }, label);
}

function customActionPip(store, action, idx) {
  const pip = el("div", { class: "action-pip-wrap" },
    el("button", {
      class: `action-pip${action.used ? " is-used" : ""}`,
      type: "button",
      onclick: () => store.update(x => {
        const a = (x.combat.customActions || [])[idx];
        if (a) a.used = !a.used;
      })
    }, action.name),
    el("button", {
      class: "action-pip-remove btn--edit-only",
      type: "button",
      title: "Remove",
      onclick: () => store.update(x => {
        x.combat.customActions = (x.combat.customActions || []).filter(a => a.id !== action.id);
      })
    }, "×")
  );
  return pip;
}

function openAddCustomActionModal(store, defaultType = "action", existingAction = null) {
  const ACTION_TYPES = [
    { value: "action",      label: "Action" },
    { value: "bonusAction", label: "Bonus Action" },
    { value: "reaction",    label: "Reaction" },
    { value: "other",       label: "Other / Limited Use" },
  ];
  const fieldStyle = { width: "100%", padding: "var(--sp-1) var(--sp-2)", background: "var(--c-bg-0)", border: "1px solid var(--c-border)", color: "var(--c-text)", borderRadius: "var(--r-sm)", fontFamily: "inherit", fontSize: "var(--fs-sm)" };
  const nameInp = el("input", { type: "text", placeholder: "Second Wind, Bardic Inspiration…", style: { ...fieldStyle }, value: existingAction?.name || "" });
  const typeSelect = el("select", { style: { ...fieldStyle, marginTop: "var(--sp-2)" } },
    ...ACTION_TYPES.map(t => el("option", { value: t.value, selected: (existingAction?.actionType || defaultType) === t.value ? "true" : null }, t.label))
  );
  const saveBtn   = el("button", { class: "btn btn--primary" }, existingAction ? "Save" : "Add");
  const cancelBtn = el("button", { class: "btn btn--ghost" }, "Cancel");
  const m = openModal({
    title: existingAction ? "Edit Action" : "Add Custom Action",
    body: el("div", { class: "notes-editor" },
      el("div", { class: "notes-editor__label" }, "Name"),
      nameInp,
      el("div", { class: "notes-editor__label", style: { marginTop: "var(--sp-2)" } }, "Type"),
      typeSelect
    ),
    footer: [cancelBtn, saveBtn]
  });
  setTimeout(() => nameInp.focus(), 0);
  nameInp.addEventListener("keydown", e => { if (e.key === "Enter") saveBtn.click(); if (e.key === "Escape") m.close(); });
  cancelBtn.addEventListener("click", () => m.close());
  saveBtn.addEventListener("click", () => {
    const name = nameInp.value.trim();
    if (!name) return;
    const actionType = typeSelect.value;
    store.update(x => {
      x.combat.customActions = x.combat.customActions || [];
      if (existingAction) {
        const idx = x.combat.customActions.findIndex(a => a.id === existingAction.id);
        if (idx >= 0) x.combat.customActions[idx] = { ...x.combat.customActions[idx], name, actionType };
      } else {
        x.combat.customActions.push({ id: `ca-${uuid()}`, name, used: false, actionType });
      }
    });
    m.close();
  });
}

/* ─────────────────────── spells tab ─────────────────────── */

function renderSpellsTab(store) {
  const doc = store.doc;
  const d = store.derived;
  const cls = d.primaryClass;

  const customSpells = doc.spellcasting.custom || [];
  const hasCaster = !!cls?.spellcasting;

  const slots = d.slots;
  const slotBar = renderSlotTracker(store, slots); // always shown; handles null gracefully

  // Build a map of level → spell objects, merging SRD "known" with custom spells.
  const known = new Set(doc.spellcasting.knownSpells || []);
  const byLevel = hasCaster ? spellsByLevel(cls.id) : new Map();

  const knownByLevel = new Map();
  const addToLevel = (lvl, spell) => {
    if (!knownByLevel.has(lvl)) knownByLevel.set(lvl, []);
    knownByLevel.get(lvl).push(spell);
  };
  const spellOverrides = doc.spellcasting.spellOverrides || {};
  if (hasCaster) {
    for (const lvl of byLevel.keys()) {
      for (const s of byLevel.get(lvl)) {
        if (known.has(s.id)) {
          const ov = spellOverrides[s.id];
          addToLevel(lvl, ov ? { ...s, ...ov, id: s.id, isEdited: true } : s);
        }
      }
    }
  }
  for (const s of customSpells) addToLevel(s.level || 0, s);

  const sortedLevels = [...knownByLevel.keys()].sort((a, b) => a - b);
  const sections = sortedLevels.map(lvl =>
    el("div", { class: "spell-section" },
      el("h3", {}, lvl === 0 ? "Cantrips" : `Level ${lvl}`),
      el("div", { class: "spell-list" },
        ...knownByLevel.get(lvl).map(s => renderSpellRow(store, s))
      )
    )
  );

  const addCustomSave = (record) => store.update(x => {
    x.spellcasting.custom = x.spellcasting.custom || [];
    x.spellcasting.custom.push(record);
  });
  const addCustomCantripBtn = el("button", {
    class: "btn--add-custom",
    onclick: () => openHomebrewForm({
      schema: SPELL_SCHEMA,
      initial: { level: 0, castingTime: "1 action", duration: "Instantaneous", school: "evocation", name: "", description: "" },
      onSave: (record) => addCustomSave({ ...record, level: 0 })
    })
  }, "+ Add Custom Cantrip");
  const addCustomSpellBtn = el("button", {
    class: "btn--add-custom",
    onclick: () => openHomebrewForm({
      schema: SPELL_SCHEMA,
      initial: { level: 1, castingTime: "1 action", duration: "Instantaneous", school: "evocation", name: "", description: "" },
      onSave: (record) => addCustomSave(record)
    })
  }, "+ Add Custom Spell");

  const libraryBlock = hasCaster
    ? el("details", { class: "spell-library" },
        el("summary", {}, "+ Add Spell from Library"),
        el("div", { class: "spell-library__list" },
          ...[...byLevel.keys()].sort((a,b)=>a-b).flatMap(lvl =>
            byLevel.get(lvl).filter(s => !known.has(s.id)).map(s =>
              el("button", {
                class: "btn btn--sm",
                onclick: () => store.update(x => {
                  x.spellcasting.knownSpells = [...new Set([...(x.spellcasting.knownSpells || []), s.id])];
                })
              }, `${s.name} (${lvl === 0 ? "Cantrip" : `L${lvl}`})`)
            )
          )
        )
      )
    : el("p", { class: "muted" }, "This class does not cast spells — but you can still add custom spells below.");

  return el("div", { class: "sheet__grid" },
    el("div", { class: "col col--wide" },
      slotBar,
      ...sections,
      el("div", { style: { marginTop: "var(--sp-3)", display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" } },
        addCustomCantripBtn,
        addCustomSpellBtn
      ),
      libraryBlock
    ),
    el("div", { class: "col col--side" },
      renderSpellcastingQuick(store),
    )
  );
}

function renderSpellRow(store, spell) {
  const isCustom = !!spell.custom;
  const hasNotes = !!store.doc.spellcasting?.spellNotes?.[spell.id];
  const row = el("div", { class: "spell-row" },
    el("div", { class: "spell-row__name", onclick: () => openSpellDetail(spell, { store }) },
      spell.name, isCustom ? " ★" : "", hasNotes ? " 📝" : ""
    ),
    el("div", { class: "spell-row__meta" },
      `${spell.school} · ${spell.castingTime}${spell.concentration ? " · C" : ""}${spell.ritual ? " · R" : ""}`
    ),
    isCustom
      ? el("div", { class: "btn--edit-only", style: { display: "flex", gap: "4px" } },
          el("button", {
            class: "btn btn--sm",
            onclick: () => openSpellDetail(spell, { store })
          }, "Edit"),
          el("button", {
            class: "btn btn--sm btn--danger",
            onclick: () => store.update(x => {
              x.spellcasting.custom = (x.spellcasting.custom || []).filter(s => s.id !== spell.id);
            })
          }, "×")
        )
      : el("button", {
          class: "btn btn--sm btn--danger btn--edit-only",
          onclick: () => store.update(x => {
            x.spellcasting.knownSpells = (x.spellcasting.knownSpells || []).filter(id => id !== spell.id);
          })
        }, "Remove")
  );
  const sc = store.doc.spellcasting || {};
  const spellNote   = sc.spellNotes?.[spell.id]   || spell._userNotes   || "";
  const spellSource = sc.spellSources?.[spell.id] || spell._acquiredFrom || spell.source || "";
  const baseSummary = (spell.description || "").slice(0, 160) + ((spell.description?.length || 0) > 160 ? "…" : "");

  // Build component string: V, S, M (material)
  const compParts = [];
  if (spell.components?.v) compParts.push("V");
  if (spell.components?.s) compParts.push("S");
  if (spell.components?.m) compParts.push(`M${spell.components.material ? ` (${spell.components.material})` : ""}`);
  const compStr = compParts.join(", ") || "—";

  const spellMeta = [
    `Casting Time: ${spell.castingTime || "—"}`,
    `Range: ${spell.range || "—"}`,
    `Components: ${compStr}`,
    `Duration: ${spell.duration || "—"}`
  ].join(" · ");

  bindTooltip(row, {
    title: spell.name,
    html: buildTooltipHtml({ baseText: spellMeta + (baseSummary ? "\n\n" + baseSummary : ""), acquiredFrom: spellSource, userNotes: spellNote }),
    sourceRef: isCustom ? "Homebrew" : "SRD",
    onMore: () => openSpellDetail(spell, { store })
  });
  return row;
}

function renderSlotTracker(store, slots) {
  const doc = store.doc;

  if (slots?.kind === "pact") {
    return el("div", { class: "panel" },
      el("div", { class: "panel__header" },
        el("h3", {}, `Pact Slots (Level ${slots.slotLevel})`),
        el("button", { class: "btn btn--sm", onclick: () => openConfigureSlotsModal(store, slots) }, "Configure")
      ),
      renderPips({
        total: slots.slots,
        used: doc.spellcasting.pactSlotsUsed || 0,
        onChange: n => store.update(x => { x.spellcasting.pactSlotsUsed = n; })
      })
    );
  }

  // perLevel is 1-indexed: index 0 is unused, indices 1-9 are spell levels L1-L9.
  // This indexing is set by computeSpellSlots in derive.js.
  const rows = slots?.kind === "slots"
    ? slots.perLevel.map((count, lvl) => {
        if (!count || lvl === 0) return null; // index 0 unused; skip empty levels
        const used = doc.spellcasting.slotsUsed?.[String(lvl)] || 0;
        return el("div", { class: "slot-row" },
          el("div", { class: "slot-row__label" }, `Level ${lvl}`),
          renderPips({
            total: count, used,
            onChange: n => store.update(x => {
              x.spellcasting.slotsUsed = x.spellcasting.slotsUsed || {};
              x.spellcasting.slotsUsed[String(lvl)] = n;
            })
          })
        );
      }).filter(Boolean)
    : [];

  return el("div", { class: "panel" },
    el("div", { class: "panel__header" },
      el("h3", {}, "Spell Slots"),
      el("button", { class: "btn btn--sm", onclick: () => openConfigureSlotsModal(store, slots) }, "Configure")
    ),
    rows.length > 0
      ? el("div", {}, ...rows)
      : el("p", { class: "muted" }, "No spell slots. Click Configure to set them manually.")
  );
}

function openConfigureSlotsModal(store, currentSlots) {
  const doc = store.doc;
  const overrides = doc.spellcasting.slotMaxOverrides || {};

  // Show the currently effective max for each level (override takes priority over class table)
  const getEffective = (lvl) => {
    if (overrides[String(lvl)] !== undefined) return overrides[String(lvl)];
    if (currentSlots?.kind === "slots") return currentSlots.perLevel[lvl] || 0;
    return 0;
  };

  const inputs = {};
  const grid = el("div", { style: { display: "grid", gridTemplateColumns: "auto 80px", gap: "6px 12px", alignItems: "center", marginTop: "var(--sp-2)" } });

  for (let lvl = 1; lvl <= 9; lvl++) {
    const eff = getEffective(lvl);
    grid.append(
      el("div", { style: { fontSize: "var(--fs-sm)", fontWeight: "bold" } }, `Level ${lvl}`),
      inputs[lvl] = el("input", {
        type: "number", min: "0", max: "20", value: String(eff),
        style: { padding: "4px 8px", background: "var(--c-bg-0)", border: "1px solid var(--c-border)", color: "var(--c-text)", borderRadius: "var(--r-sm)", fontFamily: "inherit", fontSize: "var(--fs-sm)", width: "100%" }
      })
    );
  }

  const body = el("div",
    el("p", { class: "muted", style: { marginBottom: "var(--sp-2)" } },
      "Set maximum slots per level. Your class table is shown by default; edit any level to override it."),
    grid
  );

  const saveBtn   = el("button", { class: "btn btn--primary" }, "Save");
  const cancelBtn = el("button", { class: "btn btn--ghost" }, "Cancel");
  const m = openModal({ title: "Configure Spell Slots", body, footer: [cancelBtn, saveBtn] });

  cancelBtn.addEventListener("click", () => m.close());
  saveBtn.addEventListener("click", () => {
    const newOverrides = {};
    for (let lvl = 1; lvl <= 9; lvl++) {
      const v = parseInt(inputs[lvl].value, 10);
      if (Number.isFinite(v) && v > 0) newOverrides[String(lvl)] = v;
    }
    store.update(x => { x.spellcasting.slotMaxOverrides = newOverrides; });
    m.close();
  });
}

/* ─────────────────────── inventory tab ─────────────────────── */

function renderInventoryTab(store) {
  const doc = store.doc;
  const d = store.derived;

  const items = doc.equipment.items || [];
  const totalWeight = d.carriedWeight;

  return el("div", { class: "sheet__grid" },
    el("div", { class: "col col--wide" },
      el("div", { class: "panel" },
        el("h3", {}, "Equipment"),
        items.length === 0
          ? el("p", { class: "muted" }, "No items.")
          : el("div", { class: "inv-list" },
              ...items.map(it => renderInvItem(store, it))
            ),
        el("div", { style: { marginTop: "var(--sp-2)", display: "flex", gap: "var(--sp-2)", flexWrap: "wrap" } },
          el("button", {
            class: "btn--add-custom",
            onclick: () => openHomebrewForm({
              schema: ITEM_SCHEMA,
              onSave: (record) => store.update(x => {
                x.equipment.items.push({
                  instanceId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
                  itemId: null, custom: record, quantity: 1,
                  equipped: false, attuned: false, notes: "", containerId: null
                });
              })
            })
          }, "+ Add Custom Item")
        ),
        el("details", { class: "inv-add" },
          el("summary", {}, "+ Add Item from Library"),
          el("div", { class: "inv-add__grid" },
            ...groupedItems().map(group => el("div", { class: "inv-add__group" },
              el("h4", {}, group.label),
              el("div", { class: "inv-add__buttons" },
                ...group.items.map(base => el("button", {
                  class: "btn btn--sm",
                  onclick: () => store.update(x => {
                    x.equipment.items.push({
                      instanceId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
                      itemId: base.id, custom: null, quantity: 1,
                      equipped: false, attuned: false, notes: "", containerId: null
                    });
                  })
                }, base.name))
              )
            ))
          )
        )
      )
    ),
    el("div", { class: "col col--side" },
      el("div", { class: "panel" },
        el("h3", {}, "Currency"),
        ...["pp","gp","ep","sp","cp"].map(coin => el("div", { class: "currency-row" },
          el("div", { class: "currency-row__label" }, coin.toUpperCase()),
          el("input", {
            type: "number", min: 0,
            value: doc.equipment.currency?.[coin] || 0,
            onchange: e => store.update(x => {
              x.equipment.currency = x.equipment.currency || {};
              x.equipment.currency[coin] = Math.max(0, parseInt(e.target.value, 10) || 0);
            })
          })
        ))
      ),
      el("div", { class: "panel" },
        el("h3", {}, "Carrying"),
        el("div", {}, `${totalWeight.toFixed(1)} / ${d.carry.carry} lb`),
        totalWeight > d.carry.encumbered
          ? el("div", { class: "warning" }, totalWeight > d.carry.heavilyEncumbered ? "Heavily encumbered" : "Encumbered")
          : null
      )
    )
  );
}

function renderInvItem(store, it) {
  const baseData = it.itemId ? ITEMS[it.itemId] : it.custom;
  if (!baseData) return el("div", { class: "inv-row" }, "Unknown item");
  // Merge per-instance overrides on top of the base SRD/custom data
  const base = (it.overrides && Object.keys(it.overrides).length)
    ? { ...baseData, ...it.overrides }
    : baseData;
  const isCustom = !it.itemId && !!it.custom;
  const row = el("div", { class: "inv-row" },
    el("button", {
      class: "pip",
      "data-used": it.equipped ? "true" : null,
      title: it.equipped ? "Equipped (click to unequip)" : "Click to equip",
      type: "button",
      onclick: () => store.update(x => {
        const i = x.equipment.items.find(i => i.instanceId === it.instanceId);
        if (i) i.equipped = !i.equipped;
      })
    }),
    el("div", { class: "inv-row__name", onclick: () => openItemDetail(base, { store, instanceId: it.instanceId }) },
      base.name, isCustom ? " ★" : "", it.notes ? " 📝" : ""
    ),
    isCustom ? el("button", {
      class: "btn btn--sm",
      onclick: () => openHomebrewForm({
        schema: ITEM_SCHEMA,
        initial: base,
        onSave: (updated) => store.update(x => {
          const i = x.equipment.items.find(i => i.instanceId === it.instanceId);
          if (i) i.custom = { ...updated, id: base.id };
        })
      })
    }, "Edit") : null,
    el("input", {
      type: "number", min: 0, value: it.quantity || 1, class: "inv-row__qty",
      onchange: e => store.update(x => {
        const i = x.equipment.items.find(i => i.instanceId === it.instanceId);
        if (i) i.quantity = Math.max(0, parseInt(e.target.value, 10) || 1);
      })
    }),
    el("div", { class: "inv-row__weight" }, `${((base.weight || 0) * (it.quantity || 1)).toFixed(1)} lb`),
    el("button", {
      class: "btn btn--sm btn--danger btn--edit-only",
      onclick: () => store.update(x => {
        x.equipment.items = x.equipment.items.filter(i => i.instanceId !== it.instanceId);
      })
    }, "×")
  );
  const itemSummary = base.type === "weapon" ? `${base.damage} ${base.damageType}` :
                      base.type === "armor"  ? `AC ${base.ac} (${base.armorType})` :
                      (base.description || "Adventuring gear");
  const invAcquiredFrom = it.source || (isCustom ? (it.custom?._acquiredFrom || "") : "");
  const invUserNotes    = it.notes  || (isCustom ? (it.custom?._userNotes    || "") : "");
  bindTooltip(row, {
    title: base.name,
    html: buildTooltipHtml({ baseText: itemSummary, acquiredFrom: invAcquiredFrom, userNotes: invUserNotes }),
    sourceRef: isCustom ? "Homebrew" : "SRD",
    onMore: () => openItemDetail(base, { store, instanceId: it.instanceId })
  });
  return row;
}

function groupedItems() {
  return [
    { label: "Weapons", items: listWeapons() },
    { label: "Armor", items: listArmor() },
    { label: "Gear", items: listGear() },
  ];
}

/* ─────────────────────── features tab ─────────────────────── */

function renderFeaturesTab(store) {
  const d = store.derived;
  const grouped = {};
  for (const f of d.features) {
    const key = f.source || f.kind || "Other";
    (grouped[key] = grouped[key] || []).push(f);
  }

  const addCustomBtn = el("button", {
    class: "btn--add-custom",
    onclick: () => openHomebrewForm({
      schema: FEATURE_SCHEMA,
      onSave: (record) => store.update(x => {
        x.features.custom = x.features.custom || [];
        x.features.custom.push(record);
      })
    })
  }, "+ Add Custom Feature or Trait");

  return el("div", { class: "sheet__grid" },
    el("div", { class: "col col--wide" },
      el("div", { style: { marginBottom: "var(--sp-2)" } }, addCustomBtn),
      ...Object.entries(grouped).map(([source, features]) =>
        el("div", { class: "panel" },
          el("h3", {}, source),
          el("div", { class: "feature-list" },
            ...features.map(f => {
              const isCustom = f.kind === "custom";
              const hasNotes = !!f.userNotes;
              const row = el("div", { class: "feature-row", onclick: (e) => {
                // don't open detail if the click was on an action button
                if (e.target.closest("button")) return;
                openFeatureDetail(f, { store });
              } },
                el("div", { class: "feature-row__name" },
                  f.name, isCustom ? " ★" : "", hasNotes ? " 📝" : ""
                ),
                f.level ? el("div", { class: "feature-row__level" }, `L${f.level}`) : null,
                el("div", { class: "feature-row__desc" },
                  (f.userNotes ? `${f.desc || ""}\n\nNotes: ${f.userNotes}` : (f.desc || ""))
                    .slice(0, 140) + ((f.desc?.length || 0) > 140 ? "…" : "")
                ),
                isCustom ? el("div", { style: { gridArea: "level", display: "flex", gap: "4px", alignItems: "center" } },
                  el("button", {
                    class: "btn btn--sm",
                    onclick: () => openHomebrewForm({
                      schema: FEATURE_SCHEMA,
                      initial: f,
                      onSave: (updated) => store.update(x => {
                        const idx = (x.features.custom || []).findIndex(c => c.id === f.id);
                        if (idx >= 0) x.features.custom[idx] = { ...updated, id: f.id };
                      })
                    })
                  }, "Edit"),
                  el("button", {
                    class: "btn btn--sm btn--danger",
                    onclick: () => store.update(x => {
                      x.features.custom = (x.features.custom || []).filter(c => c.id !== f.id);
                    })
                  }, "×")
                ) : null
              );
              const savedFeatureSource = store.doc.features?.sources?.[f.id] || "";
              bindTooltip(row, {
                title: f.name,
                html: buildTooltipHtml({ baseText: f.desc, acquiredFrom: savedFeatureSource, userNotes: f.userNotes }),
                sourceRef: f.source,
                onMore: () => openFeatureDetail(f, { store })
              });
              return row;
            })
          )
        )
      )
    ),
    el("div", { class: "col col--side" },
      renderLanguagePanel(store),
      renderProficiencyPanel(store, "Armor", "armor", d.armorProficiencyDetails),
      renderProficiencyPanel(store, "Weapons", "weapons", d.weaponProficiencyDetails),
      renderProficiencyPanel(store, "Tools", "tools", d.toolProficiencyDetails)
    )
  );
}

function renderLanguagePanel(store) {
  const d = store.derived;
  const details = d.languageDetails || {};
  const chips = Object.values(details).map(l => renderChip({
    label: l.name,
    sourceText: l.source,
    notes: l.notes,
    removable: l.removable,
    onRemove: () => store.update(x => {
      x.proficiencies.languages = (x.proficiencies.languages || []).filter(n => n !== l.name);
      if (x.proficiencies.langMeta) delete x.proficiencies.langMeta[l.name];
    })
  }));

  return el("div", { class: "panel" },
    el("h3", {}, "Languages"),
    chips.length ? el("div", { class: "chips" }, ...chips) : el("p", { class: "muted" }, "None."),
    el("div", { class: "add-inline" },
      el("button", {
        class: "btn--add-custom",
        onclick: () => promptAdd({
          title: "Add Language",
          placeholder: "Celestial",
          onSave: ({ name, source, notes }) => store.update(x => {
            const n = name.trim();
            if (!n) return;
            const list = new Set(x.proficiencies.languages || []);
            list.add(n);
            x.proficiencies.languages = [...list];
            if (source || notes) {
              x.proficiencies.langMeta = x.proficiencies.langMeta || {};
              x.proficiencies.langMeta[n] = { source: source || "Added manually", notes: notes || "" };
            }
          })
        })
      }, "+ Add Language")
    )
  );
}

function renderProficiencyPanel(store, label, key, details) {
  const metaKey = key + "Meta";   // "armorMeta", "weaponMeta", "toolMeta"
  const chips = Object.values(details || {}).map(p => renderChip({
    label: p.name,
    sourceText: p.source,
    notes: p.notes,
    removable: p.removable,
    onRemove: () => store.update(x => {
      x.proficiencies[key] = (x.proficiencies[key] || []).filter(n => n !== p.name);
      if (x.proficiencies[metaKey]) delete x.proficiencies[metaKey][p.name];
    })
  }));
  return el("div", { class: "panel" },
    el("h3", {}, label),
    chips.length ? el("div", { class: "chips" }, ...chips) : el("p", { class: "muted" }, "None."),
    el("div", { class: "add-inline" },
      el("button", {
        class: "btn--add-custom",
        onclick: () => promptAdd({
          title: `Add ${label} Proficiency`,
          placeholder: label === "Armor" ? "Dragonscale" : label === "Weapons" ? "Greatsword" : "Thieves' Tools",
          onSave: ({ name, source, notes }) => store.update(x => {
            const n = name.trim();
            if (!n) return;
            const list = new Set(x.proficiencies[key] || []);
            list.add(n);
            x.proficiencies[key] = [...list];
            if (source || notes) {
              x.proficiencies[metaKey] = x.proficiencies[metaKey] || {};
              x.proficiencies[metaKey][n] = { source: source || "Added manually", notes: notes || "" };
            }
          })
        })
      }, `+ Add ${label}`)
    )
  );
}

function renderChip({ label, sourceText, notes, removable, onRemove }) {
  const chip = el("span", { class: "chip" },
    el("span", {}, label),
    removable ? el("button", {
      class: "chip__x", type: "button", title: "Remove",
      onclick: (e) => { e.stopPropagation(); onRemove(); }
    }, "×") : null
  );
  // Always bind a tooltip showing source + notes if either is present
  if (sourceText || notes) {
    bindTooltip(chip, {
      title: label,
      html: buildTooltipHtml({ baseText: sourceText, userNotes: notes }),
      sourceRef: null
    });
  }
  return chip;
}

// Modal form for adding a language / proficiency, with optional source and notes.
function promptAdd({ title, placeholder, onSave }) {
  const vals = { name: "", source: "", notes: "" };

  const field = (labelText, key, type = "text", ph = "") => {
    const inputAttrs = {
      type,
      placeholder: ph,
      oninput: e => { vals[key] = e.target.value; }
    };
    if (type === "textarea") {
      const ta = el("textarea", { placeholder: ph, rows: 3, oninput: e => { vals[key] = e.target.value; } });
      return el("label", { class: "field" },
        el("div", { class: "field__label" }, labelText),
        ta
      );
    }
    const inp = el("input", inputAttrs);
    if (key === "name") {
      // keep ref to first field so we can focus it
      setTimeout(() => inp.focus(), 0);
      inp.addEventListener("keydown", e => { if (e.key === "Enter") saveBtn.click(); if (e.key === "Escape") m.close(); });
    }
    return el("label", { class: "field" },
      el("div", { class: "field__label" }, labelText),
      inp
    );
  };

  const body = el("div", { style: { display: "flex", flexDirection: "column", gap: "var(--sp-2)" } },
    field(`Name *`, "name", "text", placeholder),
    field("Source (optional)", "source", "text", "e.g. DM granted, magic item, feat…"),
    field("Notes (optional)", "notes", "textarea", "Any notes you want to see on hover…")
  );

  const saveBtn = el("button", { class: "btn btn--primary" }, "Add");
  const cancel  = el("button", { class: "btn btn--ghost" }, "Cancel");
  const m = openModal({ title, body, footer: [cancel, saveBtn] });

  cancel.addEventListener("click", () => m.close());
  saveBtn.addEventListener("click", () => {
    if (!vals.name.trim()) return;
    onSave(vals);
    m.close();
  });
}

/* ─────────────────────── codex tab ─────────────────────── */

const CODEX_SECTIONS = [
  { id: "character",    title: "The Hero",     flourish: "I"    },
  { id: "party",        title: "Fellowship",   flourish: "II"   },
  { id: "sessions",     title: "Session Log",  flourish: "III"  },
  { id: "quests",       title: "Quests",       flourish: "IV"   },
  { id: "sidequests",   title: "Side Quests",  flourish: "V"    },
  { id: "npcs",         title: "People",       flourish: "VI"   },
  { id: "places",       title: "Places",       flourish: "VII"  },
  { id: "maps",         title: "Maps",         flourish: "VIII" },
  { id: "factions",     title: "Factions",     flourish: "IX"   },
  { id: "gods",         title: "Gods & Faiths",flourish: "X"    },
  { id: "bestiary",     title: "Bestiary",     flourish: "XI"   },
  { id: "history",      title: "History",      flourish: "XII"  },
  { id: "worldlore",    title: "World Lore",   flourish: "XIII" },
  { id: "journal",      title: "Journal",      flourish: "XIV"  },
];

function renderCodexTab(store, state, rerender) {
  if (!state.codexPage) state.codexPage = "character";
  const currentIdx = Math.max(0, CODEX_SECTIONS.findIndex(s => s.id === state.codexPage));
  const current = CODEX_SECTIONS[currentIdx];

  const goto = (id) => { state.codexPage = id; rerender(); };
  const prev = () => { if (currentIdx > 0) goto(CODEX_SECTIONS[currentIdx - 1].id); };
  const next = () => { if (currentIdx < CODEX_SECTIONS.length - 1) goto(CODEX_SECTIONS[currentIdx + 1].id); };

  const toc = el("nav", { class: "codex__toc" },
    ...CODEX_SECTIONS.map(s =>
      el("button", {
        class: "codex__toc-item" + (s.id === current.id ? " is-active" : ""),
        onclick: () => goto(s.id)
      },
        el("span", { class: "codex__toc-num" }, s.flourish),
        el("span", { class: "codex__toc-title" }, s.title)
      )
    )
  );

  const page = el("article", { class: "codex__page" });
  renderCodexPage(page, current.id, store);

  const header = el("header", { class: "codex__page-header" },
    el("span", { class: "codex__page-num" }, current.flourish),
    el("h2", { class: "codex__page-title" }, current.title),
    el("span", { class: "codex__page-meta" }, `Page ${currentIdx + 1} of ${CODEX_SECTIONS.length}`)
  );

  const controls = el("div", { class: "codex__controls" },
    el("button", {
      class: "codex__nav codex__nav--prev",
      disabled: currentIdx === 0,
      "aria-label": "Previous page",
      onclick: prev
    }, "‹"),
    el("div", { class: "codex__dots" },
      ...CODEX_SECTIONS.map((s, i) => el("button", {
        class: "codex__dot" + (i === currentIdx ? " is-active" : ""),
        onclick: () => goto(s.id),
        "aria-label": s.title
      }))
    ),
    el("button", {
      class: "codex__nav codex__nav--next",
      disabled: currentIdx === CODEX_SECTIONS.length - 1,
      "aria-label": "Next page",
      onclick: next
    }, "›")
  );

  const spread = el("div", { class: "codex__spread" },
    toc,
    el("div", { class: "codex__book" },
      header,
      page,
      controls
    )
  );

  // Touch swipe support
  let touchStartX = null;
  page.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  page.addEventListener("touchend", e => {
    if (touchStartX == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) < 60) return;
    if (dx < 0) next(); else prev();
  });

  return el("div", { class: "codex" }, spread);
}

function renderCodexPage(root, id, store) {
  clear(root);
  switch (id) {
    case "character":  root.append(...codexCharacterPage(store)); break;
    case "party":      root.append(...codexPartyPage(store)); break;
    case "sessions":   root.append(...codexSessionsPage(store)); break;
    case "quests":     root.append(...codexListPage(store, QUEST_CFG)); break;
    case "sidequests": root.append(...codexListPage(store, SIDEQUEST_CFG)); break;
    case "npcs":       root.append(...codexListPage(store, NPC_CFG)); break;
    case "places":     root.append(...codexListPage(store, PLACE_CFG)); break;
    case "maps":       root.append(...codexMapsPage(store)); break;
    case "factions":   root.append(...codexListPage(store, FACTION_CFG)); break;
    case "gods":       root.append(...codexListPage(store, GOD_CFG)); break;
    case "bestiary":   root.append(...codexListPage(store, BEAST_CFG)); break;
    case "history":    root.append(...codexProseTextPage(store, "history", "Campaign History", "Chronicle the campaign's events, past and present — the deeds of heroes and villains, the rise and fall of nations.")); break;
    case "worldlore":  root.append(...codexProseTextPage(store, "worldLore", "World Lore", "Legends, myths, cosmology, magic — the fabric of the world as your character knows it.")); break;
    case "journal":    root.append(...codexJournalPage(store)); break;
  }
}

/* ── helpers ── */

function codexParchmentNote(text) {
  return el("p", { class: "codex__intro" }, text);
}

function codexSectionDivider() {
  return el("div", { class: "codex__divider", "aria-hidden": "true" }, "✦ ✦ ✦");
}

function codexAddBtn(label, onClick) {
  return el("button", { class: "codex__add", onclick: onClick },
    el("span", { class: "codex__add-plus" }, "+"),
    label
  );
}

function codexEmptyState(text) {
  return el("div", { class: "codex__empty" }, text);
}

function codexTextField(label, value, onChange, opts = {}) {
  const inp = el("input", {
    type: opts.type || "text",
    value: value ?? "",
    placeholder: opts.placeholder || "",
    onchange: e => onChange(opts.type === "number" ? (parseInt(e.target.value, 10) || null) : e.target.value)
  });
  return el("label", { class: "codex__field" + (opts.full ? " codex__field--full" : "") },
    el("span", { class: "codex__field-label" }, label),
    inp
  );
}

function codexTextareaField(label, value, onChange, rows = 5) {
  return el("label", { class: "codex__field codex__field--full" },
    el("span", { class: "codex__field-label" }, label),
    el("textarea", {
      rows,
      onchange: e => onChange(e.target.value)
    }, value || "")
  );
}

function codexSelectField(label, value, options, onChange) {
  const sel = el("select", {
    onchange: e => onChange(e.target.value)
  }, ...options.map(o => {
    const opt = el("option", { value: o.value }, o.label);
    if (o.value === (value ?? "")) opt.selected = true;
    return opt;
  }));
  return el("label", { class: "codex__field" },
    el("span", { class: "codex__field-label" }, label),
    sel
  );
}

function codexProseTextarea(lorePath, store, placeholder) {
  return el("textarea", {
    class: "codex__prose",
    rows: 14,
    placeholder: placeholder || "",
    onchange: e => store.update(x => { x.lore[lorePath] = e.target.value; })
  }, store.doc.lore[lorePath] || "");
}

/* ── character page ── */

function codexCharacterPage(store) {
  const doc = store.doc;
  const lore = doc.lore;
  const ARRAY_KEYS = new Set(["personalityTraits","ideals","bonds","flaws"]);
  const arrToText = (v) => Array.isArray(v) ? v.join("\n") : (v || "");

  const field = (label, key, rows = 3) => el("label", { class: "codex__field codex__field--full" },
    el("span", { class: "codex__field-label" }, label),
    el("textarea", {
      rows,
      onchange: e => store.update(x => {
        if (ARRAY_KEYS.has(key)) {
          x.lore[key] = e.target.value.split("\n").map(s => s.trim()).filter(Boolean);
        } else {
          x.lore[key] = e.target.value;
        }
      })
    }, arrToText(lore[key]))
  );

  const appearanceRow = el("div", { class: "codex__grid codex__grid--appearance" },
    ...["age","height","weight","eyes","hair","skin","gender"].map(k =>
      codexTextField(
        k[0].toUpperCase() + k.slice(1),
        doc.identity[k] ?? "",
        (v) => store.update(x => { x.identity[k] = k === "age" ? (v === "" ? null : (parseInt(v, 10) || null)) : v; }),
        { type: k === "age" ? "number" : "text" }
      )
    )
  );

  return [
    codexParchmentNote(`Here begins the tale of ${doc.identity.name || "our hero"}.`),
    el("section", { class: "codex__section" },
      el("h3", { class: "codex__subhead" }, "Backstory"),
      field("", "backstory", 8)
    ),
    codexSectionDivider(),
    el("section", { class: "codex__section" },
      el("h3", { class: "codex__subhead" }, "Bearing & Appearance"),
      appearanceRow
    ),
    codexSectionDivider(),
    el("section", { class: "codex__section" },
      el("h3", { class: "codex__subhead" }, "Of the Spirit"),
      el("p", { class: "codex__hint" }, "One per line."),
      field("Personality Traits", "personalityTraits", 3),
      field("Ideals", "ideals", 3),
      field("Bonds", "bonds", 3),
      field("Flaws", "flaws", 3),
    ),
  ];
}

/* ── party page ── */

function codexPartyPage(store) {
  const doc = store.doc;
  const party = doc.party || [];

  const card = (m, idx) => el("div", { class: "codex__card" },
    el("div", { class: "codex__card-head" },
      el("input", {
        class: "codex__card-title-input",
        value: m.name || "",
        placeholder: "Name",
        onchange: e => store.update(x => { x.party[idx].name = e.target.value; })
      }),
      el("button", {
        class: "codex__card-remove",
        title: "Remove",
        onclick: () => store.update(x => { x.party.splice(idx, 1); })
      }, "✕")
    ),
    el("div", { class: "codex__grid codex__grid--2" },
      codexTextField("Player", m.playerName || "", v => store.update(x => { x.party[idx].playerName = v; })),
      codexTextField("Race", m.race || "", v => store.update(x => { x.party[idx].race = v; })),
      codexTextField("Class", m.class || "", v => store.update(x => { x.party[idx].class = v; })),
      codexTextField("Level", m.level ?? "", v => store.update(x => { x.party[idx].level = v; }), { type: "number" }),
    ),
    codexTextareaField("Notes", m.notes || "", v => store.update(x => { x.party[idx].notes = v; }), 3)
  );

  return [
    codexParchmentNote("Those who walk this road beside you."),
    party.length === 0
      ? codexEmptyState("No companions recorded yet.")
      : el("div", { class: "codex__cards" }, ...party.map(card)),
    codexAddBtn("Add Companion", () => store.update(x => {
      x.party = x.party || [];
      x.party.push({ name: "", playerName: "", race: "", class: "", level: 1, notes: "" });
    })),
  ];
}

/* ── sessions page ── */

function codexSessionsPage(store) {
  const doc = store.doc;
  const log = doc.sessionLog || [];

  const card = (entry) => {
    const idx = doc.sessionLog.findIndex(s => s.id === entry.id);
    return el("div", { class: "codex__card codex__card--session" },
      el("div", { class: "codex__card-head" },
        el("input", {
          class: "codex__card-num",
          type: "number",
          value: entry.sessionNumber ?? "",
          placeholder: "#",
          title: "Session #",
          onchange: e => store.update(x => { x.sessionLog[idx].sessionNumber = parseInt(e.target.value, 10) || null; })
        }),
        el("input", {
          class: "codex__card-date",
          type: "date",
          value: entry.date || "",
          onchange: e => store.update(x => { x.sessionLog[idx].date = e.target.value; })
        }),
        el("input", {
          class: "codex__card-title-input",
          value: entry.title || "",
          placeholder: "Session title…",
          onchange: e => store.update(x => { x.sessionLog[idx].title = e.target.value; })
        }),
        el("button", {
          class: "codex__card-remove",
          title: "Remove",
          onclick: () => store.update(x => { x.sessionLog.splice(idx, 1); })
        }, "✕")
      ),
      el("textarea", {
        class: "codex__card-notes",
        rows: 6,
        placeholder: "What happened this session? Who did we meet? What treasures did we find?",
        onchange: e => store.update(x => { x.sessionLog[idx].notes = e.target.value; })
      }, entry.notes || "")
    );
  };

  const sorted = [...log].sort((a, b) => {
    const na = a.sessionNumber ?? -1;
    const nb = b.sessionNumber ?? -1;
    return nb - na;
  });

  return [
    codexParchmentNote("The chronicle of our adventures, session by session."),
    log.length === 0
      ? codexEmptyState("No sessions recorded yet.")
      : el("div", { class: "codex__cards" }, ...sorted.map(card)),
    codexAddBtn("New Session", () => store.update(x => {
      x.sessionLog = x.sessionLog || [];
      const nextNum = Math.max(0, ...x.sessionLog.map(s => s.sessionNumber || 0)) + 1;
      const today = new Date().toISOString().slice(0, 10);
      x.sessionLog.push({ id: `sess-${uuid()}`, sessionNumber: nextNum, date: today, title: "", notes: "" });
    })),
  ];
}

/* ── generic list configs ── */

const QUEST_CFG = {
  arrayKey: "quests",
  intro: "The paths we have sworn to walk.",
  emptyText: "No quests recorded yet.",
  addLabel: "New Quest",
  blank: () => ({ id: `q-${uuid()}`, title: "", giver: "", status: "active", reward: "", description: "" }),
  fields: [
    { key: "title",       label: "Title",       type: "text", prominent: true, placeholder: "The name of the quest" },
    { key: "giver",       label: "Quest Giver", type: "text" },
    { key: "status",      label: "Status",      type: "select", options: [
      { value: "active", label: "Active" },
      { value: "in-progress", label: "In Progress" },
      { value: "completed", label: "Completed" },
      { value: "failed", label: "Failed" },
      { value: "abandoned", label: "Abandoned" },
    ]},
    { key: "reward",      label: "Reward",      type: "text" },
    { key: "description", label: "Description", type: "textarea", rows: 5, full: true },
  ],
};

const SIDEQUEST_CFG = { ...QUEST_CFG,
  arrayKey: "sideQuests",
  intro: "Lesser errands and detours along the way.",
  emptyText: "No side quests recorded yet.",
  addLabel: "New Side Quest",
  blank: () => ({ id: `sq-${uuid()}`, title: "", giver: "", status: "active", reward: "", description: "" }),
};

const NPC_CFG = {
  arrayKey: "npcs",
  intro: "The folk — kindred, cruel, and strange — that we have met upon the road.",
  emptyText: "No people recorded yet.",
  addLabel: "New Person",
  blank: () => ({ id: `npc-${uuid()}`, name: "", race: "", role: "", location: "", relationship: "neutral", description: "" }),
  fields: [
    { key: "name",        label: "Name",        type: "text", prominent: true },
    { key: "race",        label: "Race",        type: "text" },
    { key: "role",        label: "Role / Title",type: "text" },
    { key: "location",    label: "Last Seen",   type: "text" },
    { key: "relationship",label: "Relationship",type: "select", options: [
      { value: "ally", label: "Ally" },
      { value: "friendly", label: "Friendly" },
      { value: "neutral", label: "Neutral" },
      { value: "rival", label: "Rival" },
      { value: "enemy", label: "Enemy" },
      { value: "unknown", label: "Unknown" },
      { value: "deceased", label: "Deceased" },
    ]},
    { key: "description", label: "Notes",       type: "textarea", rows: 5, full: true },
  ],
};

const PLACE_CFG = {
  arrayKey: "locations",
  intro: "Cities, ruins, wilds, and hidden halls.",
  emptyText: "No places recorded yet.",
  addLabel: "New Place",
  blank: () => ({ id: `loc-${uuid()}`, name: "", region: "", type: "", description: "" }),
  fields: [
    { key: "name",        label: "Name",        type: "text", prominent: true },
    { key: "region",      label: "Region",      type: "text" },
    { key: "type",        label: "Type",        type: "text", placeholder: "City, ruin, forest…" },
    { key: "description", label: "Description", type: "textarea", rows: 5, full: true },
  ],
};

const FACTION_CFG = {
  arrayKey: "organizations",
  intro: "Guilds, cults, orders, and houses of power.",
  emptyText: "No factions recorded yet.",
  addLabel: "New Faction",
  blank: () => ({ id: `fac-${uuid()}`, name: "", allegiance: "neutral", leader: "", description: "" }),
  fields: [
    { key: "name",        label: "Name",        type: "text", prominent: true },
    { key: "leader",      label: "Leadership",  type: "text" },
    { key: "allegiance",  label: "Allegiance",  type: "select", options: [
      { value: "allied", label: "Allied" },
      { value: "friendly", label: "Friendly" },
      { value: "neutral", label: "Neutral" },
      { value: "rival", label: "Rival" },
      { value: "hostile", label: "Hostile" },
      { value: "unknown", label: "Unknown" },
    ]},
    { key: "description", label: "Description", type: "textarea", rows: 5, full: true },
  ],
};

const GOD_CFG = {
  arrayKey: "deities",
  intro: "The powers above — and below.",
  emptyText: "No gods recorded yet.",
  addLabel: "New Deity",
  blank: () => ({ id: `god-${uuid()}`, name: "", domain: "", alignment: "", symbol: "", description: "" }),
  fields: [
    { key: "name",        label: "Name",        type: "text", prominent: true },
    { key: "domain",      label: "Domain",      type: "text", placeholder: "War, Life, Trickery…" },
    { key: "alignment",   label: "Alignment",   type: "text" },
    { key: "symbol",      label: "Holy Symbol", type: "text" },
    { key: "description", label: "Tenets & Lore",type: "textarea", rows: 5, full: true },
  ],
};

const BEAST_CFG = {
  arrayKey: "bestiary",
  intro: "The beasts and horrors we have faced.",
  emptyText: "No creatures recorded yet.",
  addLabel: "New Creature",
  blank: () => ({ id: `bst-${uuid()}`, name: "", threat: "", weakness: "", description: "" }),
  fields: [
    { key: "name",        label: "Name",         type: "text", prominent: true },
    { key: "threat",      label: "Threat Level", type: "text", placeholder: "Trivial, Dangerous, Deadly…" },
    { key: "weakness",    label: "Known Weakness",type: "text" },
    { key: "description", label: "Notes",        type: "textarea", rows: 5, full: true },
  ],
};

function codexListPage(store, cfg) {
  const doc = store.doc;
  const list = doc.lore[cfg.arrayKey] || [];

  const renderField = (entry, idx, f) => {
    const value = entry[f.key];
    const onChange = (v) => store.update(x => {
      x.lore[cfg.arrayKey][idx][f.key] = v;
    });
    if (f.type === "textarea") {
      return codexTextareaField(f.label, value || "", onChange, f.rows || 4);
    }
    if (f.type === "select") {
      return codexSelectField(f.label, value, f.options, onChange);
    }
    return codexTextField(f.label, value, onChange, { type: f.type, placeholder: f.placeholder });
  };

  const card = (entry) => {
    const idx = doc.lore[cfg.arrayKey].findIndex(e => e.id === entry.id);
    const prominent = cfg.fields.find(f => f.prominent);
    const otherFields = cfg.fields.filter(f => !f.prominent && !f.full);
    const fullFields = cfg.fields.filter(f => f.full);

    const head = el("div", { class: "codex__card-head" },
      prominent
        ? el("input", {
            class: "codex__card-title-input",
            value: entry[prominent.key] || "",
            placeholder: prominent.label,
            onchange: e => store.update(x => { x.lore[cfg.arrayKey][idx][prominent.key] = e.target.value; })
          })
        : null,
      el("button", {
        class: "codex__card-remove",
        title: "Remove",
        onclick: () => store.update(x => { x.lore[cfg.arrayKey].splice(idx, 1); })
      }, "✕")
    );

    const grid = otherFields.length
      ? el("div", { class: "codex__grid codex__grid--2" }, ...otherFields.map(f => renderField(entry, idx, f)))
      : null;

    return el("div", { class: "codex__card" },
      head,
      grid,
      ...fullFields.map(f => renderField(entry, idx, f))
    );
  };

  return [
    codexParchmentNote(cfg.intro),
    list.length === 0
      ? codexEmptyState(cfg.emptyText)
      : el("div", { class: "codex__cards" }, ...list.map(card)),
    codexAddBtn(cfg.addLabel, () => store.update(x => {
      x.lore[cfg.arrayKey] = x.lore[cfg.arrayKey] || [];
      x.lore[cfg.arrayKey].push(cfg.blank());
    })),
  ];
}

/* ── maps page ── */

function codexMapsPage(store) {
  const doc = store.doc;
  const maps = doc.lore.maps || [];

  const card = (m) => {
    const idx = doc.lore.maps.findIndex(x => x.id === m.id);
    const fileInput = el("input", {
      type: "file",
      accept: "image/*",
      style: { display: "none" },
      onchange: e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          store.update(x => { x.lore.maps[idx].imageDataUrl = reader.result; });
        };
        reader.readAsDataURL(file);
      }
    });
    const imgBox = m.imageDataUrl
      ? el("img", { class: "codex__map-img", src: m.imageDataUrl, alt: m.name || "Map" })
      : el("div", { class: "codex__map-placeholder" }, "No image — click Upload");

    return el("div", { class: "codex__card codex__card--map" },
      el("div", { class: "codex__card-head" },
        el("input", {
          class: "codex__card-title-input",
          value: m.name || "",
          placeholder: "Map name",
          onchange: e => store.update(x => { x.lore.maps[idx].name = e.target.value; })
        }),
        el("button", {
          class: "codex__card-remove",
          title: "Remove",
          onclick: () => store.update(x => { x.lore.maps.splice(idx, 1); })
        }, "✕")
      ),
      imgBox,
      el("div", { class: "codex__map-actions" },
        fileInput,
        el("button", { class: "codex__btn", onclick: () => fileInput.click() }, m.imageDataUrl ? "Replace Image" : "Upload Image"),
        m.imageDataUrl
          ? el("button", { class: "codex__btn", onclick: () => store.update(x => { x.lore.maps[idx].imageDataUrl = null; }) }, "Remove Image")
          : null
      ),
      codexTextField("Region", m.region || "", v => store.update(x => { x.lore.maps[idx].region = v; })),
      codexTextareaField("Notes", m.notes || "", v => store.update(x => { x.lore.maps[idx].notes = v; }), 3)
    );
  };

  return [
    codexParchmentNote("Maps of the lands we have traveled."),
    maps.length === 0
      ? codexEmptyState("No maps yet. Add one to begin.")
      : el("div", { class: "codex__cards codex__cards--maps" }, ...maps.map(card)),
    codexAddBtn("New Map", () => store.update(x => {
      x.lore.maps = x.lore.maps || [];
      x.lore.maps.push({ id: `map-${uuid()}`, name: "", region: "", notes: "", imageDataUrl: null });
    })),
  ];
}

/* ── prose pages (history, worldLore) ── */

function codexProseTextPage(store, key, heading, hint) {
  return [
    codexParchmentNote(hint),
    el("section", { class: "codex__section" },
      codexProseTextarea(key, store, `Write freely. ${heading}…`)
    )
  ];
}

/* ── journal notes page ── */

function codexJournalPage(store) {
  return [
    codexParchmentNote("Your private journal. Thoughts, sketches, reminders — whatever you wish to record."),
    el("section", { class: "codex__section" },
      el("textarea", {
        class: "codex__prose",
        rows: 20,
        placeholder: "Dear journal…",
        onchange: e => store.update(x => { x.lore.notes = e.target.value; })
      }, store.doc.lore.notes || "")
    )
  ];
}
