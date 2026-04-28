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
import { BACKGROUNDS } from "../../data/backgrounds.js";

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

  // Tooltip summaries that respect the override state — when a stat is overridden
  // the tooltip should read "Manually set" rather than claim the formula value.
  const acOv = doc.combat.acOverride != null;
  const initOv = doc.combat.initiativeOverride != null;
  const speedOv = doc.combat.speedOverride != null;
  const profOv = doc.combat.profBonusOverride != null;
  const ppOv = doc.combat.passiveOverrides?.perception != null;
  const hdOv = doc.combat.hitDieOverride != null;

  return el("div", { class: "panel panel--stats" },
    el("div", { class: "stat-pair-grid" },
      row("AC", d.ac, { title: "Armor Class", summary: acOv ? `Manually set to ${d.ac}.` : "Base AC. Auto-calculated from equipped armor, shield, and ability modifiers." }, "ac", acOv, "ac"),
      row("Initiative", fmt(d.initiative), { title: "Initiative", summary: initOv ? `Manually set to ${fmt(d.initiative)}.` : `DEX mod${doc.combat.initiativeBonus ? " + " + doc.combat.initiativeBonus : ""}.` }, "initiative", initOv, "initiative"),
      row("Speed", `${d.speed} ft`, { title: "Speed", summary: speedOv ? `Manually set to ${d.speed} ft.` : "Walking speed in feet." }, "speed", speedOv, "speed"),
      row("Prof. Bonus", `+${d.profBonus}`, { title: "Proficiency Bonus", summary: profOv ? `Manually set to +${d.profBonus} (overrides the level ${d.totalLevel} default of +${proficiencyBonusForLevel(d.totalLevel)}).` : `+${d.profBonus} at level ${d.totalLevel}.` }, "profBonus", profOv, "profBonus"),
      row("Passive Perception", d.passivePerception, { title: "Passive Perception", summary: ppOv ? `Manually set to ${d.passivePerception}.` : "10 + Perception modifier." }, "passivePerception", ppOv, "passivePerception"),
      row("Hit Dice", `${Math.max(0, d.totalLevel - (doc.combat.hitDiceUsed?.[`d${d.hitDie}`] || 0))} / ${d.totalLevel} d${d.hitDie}`, { title: "Hit Dice", summary: hdOv ? `Manually set to d${d.hitDie}.` : "Spent on short rests to recover HP." }, "hitDie", hdOv, "hitDie"),
    )
  );
}

// Local PB formula (don't import to avoid circular concerns) — used only in tooltip text.
function proficiencyBonusForLevel(lv) {
  return Math.ceil(1 + (Math.max(1, lv) / 4));
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

  // Derive a "Computed: …" breakdown for each spellcasting stat so the tooltip
  // ALWAYS explains why the number is what it is, even when the user hasn't
  // typed a custom source/notes string. The user-supplied `acquiredFrom` line
  // (if any) is stitched together with the auto breakdown via newline.
  const cls = d.primaryClass;
  const ability = d.spellAbility;
  const abilMod = ability ? d.abilities[ability]?.mod : null;
  const fmtMod = (m) => m == null ? "—" : (m >= 0 ? `+${m}` : `${m}`);

  const abilityBreakdown = ability
    ? `${ability.toUpperCase()} is your spellcasting ability` +
      (cls?.spellcasting?.ability === ability ? ` (${cls.name} class).` : `.`)
    : "No spellcasting class.";

  const dcBreakdown = (ability && abilMod != null && d.profBonus != null)
    ? `Computed: 8 + Prof ${d.profBonus} + ${ability.toUpperCase()} ${fmtMod(abilMod)} = ${8 + d.profBonus + abilMod}` +
      (sc.saveDcOverride != null ? ` · Override: ${sc.saveDcOverride}` : "")
    : "Spell Save DC not derivable without a casting class.";

  const atkBreakdown = (ability && abilMod != null && d.profBonus != null)
    ? `Computed: Prof ${d.profBonus} + ${ability.toUpperCase()} ${fmtMod(abilMod)} = ${fmtMod(d.profBonus + abilMod)}` +
      (sc.attackOverride != null ? ` · Override: ${fmtMod(sc.attackOverride)}` : "")
    : "Spell Attack not derivable without a casting class.";

  const spPair = (label, value, overridePath, isOverridden, tipTitle, tipSummary, autoSource, noteKey) => {
    const r = el("div", {
      class: "stat-pair",
      "data-override-path": overridePath,
      "data-overridden": isOverridden ? "true" : null
    },
      el("div", { class: "stat-pair__label" }, label),
      el("div", { class: "stat-pair__value" }, value)
    );
    // If the user wrote a source label, prefer it; otherwise show the
    // auto-derived breakdown so hovering always tells you WHY this number is
    // this number. acquiredFrom ends up rendered under "Acquired from".
    const acquired = ss[noteKey] || autoSource || null;
    bindTooltip(r, {
      title: tipTitle,
      html: buildTooltipHtml({ baseText: tipSummary, acquiredFrom: acquired, userNotes: sn[noteKey] || null })
    });
    return r;
  };

  return el("div", { class: "panel panel--spellcasting" },
    el("h3", {}, "Spellcasting"),
    el("div", { class: "stat-pair-grid" },
      spPair("Ability",  d.spellAbility?.toUpperCase() || "—", "spellAbility", !!sc.abilityOverride,       "Spellcasting Ability", "The ability used for spell attacks and save DCs.",    abilityBreakdown, "spellAbility"),
      spPair("Save DC",  d.spellSaveDC ?? "—",                 "spellSaveDC",  sc.saveDcOverride != null,  "Spell Save DC",        "DC that enemies must beat to resist your spells.",    dcBreakdown,      "spellSaveDC"),
      spPair("Attack",   fmt(d.spellAttack),                   "spellAttack",  sc.attackOverride != null,  "Spell Attack Bonus",   "Bonus added to your spell attack rolls.",             atkBreakdown,     "spellAttack"),
    )
  );
}

const fmt = m => m == null ? "—" : (m >= 0 ? `+${m}` : `${m}`);

/* ─────────────────────── overview tab-card ─────────────────────── */

const OVERVIEW_MAIN_TABS = [
  { id: "actions",       label: "Actions" },
  { id: "spells",        label: "Spells" },
  { id: "inventory",     label: "Inventory" },
  { id: "features",      label: "Features & Traits" },
  { id: "proficiencies", label: "Proficiencies" },
  { id: "backgrounds",   label: "Background" },
  { id: "codex",         label: "Codex" },
];

function renderOverviewTabCard(store, state, rerender) {
  const ov = state.overview || (state.overview = { main: "actions", sub: {} });

  const mainPanes = OVERVIEW_MAIN_TABS.map(m => {
    switch (m.id) {
      case "actions":       return buildActionsPane(store, state);
      case "spells":        return buildSpellsPane(store, state);
      case "inventory":     return buildInventoryPane(store, state);
      case "features":      return buildFeaturesPane(store, state);
      case "proficiencies": return buildProficienciesPane(store, state);
      case "backgrounds":   return buildBackgroundsPane(store, state);
      case "codex":         return buildCodexPane(store, state, rerender);
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
  // Combat feats and Fighting Styles describe their effects in terms of bonus actions
  // ("you can use a bonus action to attack with a hand crossbow"), but they're not
  // *castable* abilities — they're passive-eligible feats that live under Features
  // & Traits → Combat Feats. Excluding them here keeps the Bonus Action tab as a list
  // of "things you actively spend a bonus action on" rather than feat reference rows.
  const FEAT_PATTERN = /\bfeat\b|fighting style|crossbow expert|sharpshooter|great weapon master|polearm master|war caster|sentinel|lucky|alert|tough|magic initiate|tavern brawler|inspiring leader|dual wielder|mobile|defensive duelist|elemental adept|grappler|charger|healer|heavy armor master|keen mind|linguist|mage slayer|medium armor master|observant|resilient|ritual caster|savage attacker|skill expert|piercer|slasher|crusher/i;
  const isCombatFeatLike = (f) => FEAT_PATTERN.test(f.source || "") || FEAT_PATTERN.test(f.name || "");
  const matchAction   = (f) => /(^|\b)as an action\b|\buse (a|your) action\b|\btake the .* action\b/i.test(f.desc || "");
  const matchBonus    = (f) => /\bbonus action\b/i.test(f.desc || "");
  const matchReaction = (f) => /\breaction\b/i.test(f.desc || "");
  const actionFeats   = features.filter(f => matchAction(f)   && !matchBonus(f) && !matchReaction(f) && !isCombatFeatLike(f));
  const bonusFeats    = features.filter(f => matchBonus(f)    && !isCombatFeatLike(f));
  const reactionFeats = features.filter(f => matchReaction(f) && !isCombatFeatLike(f));
  const otherLimited  = features.filter(f => /\buses?\b.*(per|\/)\s*(short|long) rest|\b(\d+)\s*\/\s*(short|long) rest/i.test(f.desc || ""));

  // ── Spells, classified by casting time ──
  // Pull every spell the character knows (SRD + custom). castingTime drives bucket:
  //   "1 action"        → attack/action lists (attack-shaped spells go to Attack)
  //   "1 bonus action"  → bonus action list
  //   "1 reaction"      → reaction list (this is why Shield wasn't appearing — the
  //                       pane previously iterated only features.desc, not spells)
  const allSpells = collectKnownSpells(doc);
  const spellAct      = allSpells.filter(s => /\b1?\s*action\b/i.test(s.castingTime || "") && !/bonus/i.test(s.castingTime || "") && !/reaction/i.test(s.castingTime || ""));
  const spellBonus    = allSpells.filter(s => /bonus action/i.test(s.castingTime || ""));
  const spellReaction = allSpells.filter(s => /reaction/i.test(s.castingTime || ""));
  // Spells with a fixed charge pool (not spell slots) — shown in Limited Use tab.
  const limitedSpells = allSpells.filter(s => {
    const txt = s.description || s.desc || "";
    return /\b\d+\s*(charges?|uses?)\b|\bper (dawn|day)\b|\bonce per (short|long) rest\b/i.test(txt);
  });
  // Attack-shaped spells = ones whose description implies a roll-to-hit or save-for-damage.
  // Custom spells use `desc`; SRD spells use `description` — always check both.
  const isAttackSpell = (s) => {
    const txt = `${s.description || s.desc || ""} ${s.higherLevel || ""}`;
    return /\bspell attack\b/i.test(txt)
        || /\b(ranged|melee)\s+(spell\s+)?attack\b/i.test(txt)
        || /\b\d+d\d+\s+(damage|fire|cold|lightning|necrotic|psychic|radiant|thunder|acid|poison|force|bludgeoning|piercing|slashing)/i.test(txt);
  };
  const attackSpells = spellAct.filter(isAttackSpell);
  const nonAttackActionSpells = spellAct.filter(s => !attackSpells.includes(s));

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

  // Helper: extract the primary damage expression from a spell's text.
  // Returns e.g. "8d8 cold" or "3d8" — used on action tiles so players can see
  // damage at a glance without opening the detail modal.
  const spellDmgStr = (s) => {
    if (s.damage) return s.damageType ? `${s.damage} ${s.damageType}` : s.damage;
    const txt = s.description || s.desc || "";
    const m = txt.match(/\b(\d+d\d+(?:[+\-]\d+)?)\s+(cold|fire|lightning|necrotic|psychic|radiant|thunder|acid|poison|force|bludgeoning|piercing|slashing)\b/i)
           || txt.match(/\b(\d+d\d+(?:[+\-]\d+)?)\s+\w*\s*damage\b/i);
    if (!m) return "";
    return m[2] ? `${m[1]} ${m[2]}` : m[1];
  };

  // Render a spell as an action row (clickable to open the spell detail modal).
  const spellRow = (s) => {
    const dmg = spellDmgStr(s);
    const txt = s.description || s.desc || "";
    const meta = [s.castingTime || "", s.range || "—", dmg, s.concentration ? "Concentration" : "", s.ritual ? "Ritual" : ""].filter(Boolean).join(" · ");
    const row = ovRow(s.name + (s.custom ? " ★" : "") + " · spell", meta, () => openSpellDetail(s, { store }));
    const tipDesc = txt.slice(0, 200) + (txt.length > 200 ? "…" : "");
    bindTooltip(row, {
      title: s.name,
      html: buildTooltipHtml({
        baseText: `${meta}\n\n${tipDesc}`,
        acquiredFrom: doc.spellcasting?.spellSources?.[s.id] || s._acquiredFrom || "",
        userNotes: doc.spellcasting?.spellNotes?.[s.id] || s._userNotes || ""
      }),
      sourceRef: s.custom ? "Homebrew" : "SRD",
      onMore: () => openSpellDetail(s, { store })
    });
    return row;
  };

  // ── D&D 5e (2014) basic actions cheat sheet ──
  // Pulled from PHB Ch.9. Shown as inert reference rows under a sub-header on each
  // action-type pane so users can remember Help / Disengage / Dodge etc. mid-combat.
  const cheatSheetRow = (name, desc) => {
    const row = ovRow(name, desc, null);
    row.classList.add("ov-row--cheat");
    bindTooltip(row, { title: name, html: buildTooltipHtml({ baseText: desc }) });
    return row;
  };
  const BASIC_ACTIONS = [
    ["Attack",       "Make one melee or ranged attack. Replace with multiple attacks if you have Extra Attack."],
    ["Cast a Spell", "Cast a spell with a casting time of 1 action."],
    ["Dash",         "Gain extra movement equal to your speed for the turn."],
    ["Disengage",    "Your movement doesn't provoke opportunity attacks for the rest of the turn."],
    ["Dodge",        "Attacks against you have disadvantage; you have advantage on Dex saves. Lost if incapacitated or speed = 0."],
    ["Help",         "Give an ally advantage on their next ability check, or on their next attack against a target within 5 ft. of you."],
    ["Hide",         "Make a Stealth check (DM decides if you can hide)."],
    ["Ready",        "Choose a trigger and a reaction; the reaction fires when the trigger occurs (uses your reaction)."],
    ["Search",       "Devote attention to finding something. Usually a Wisdom (Perception) or Intelligence (Investigation) check."],
    ["Use an Object", "Interact with a second object on your turn (the first interaction is free)."],
    ["Improvise",    "Attempt anything not on this list — DM decides ability check / attack roll required."],
  ];
  const BASIC_BONUS_ACTIONS = [
    ["Two-Weapon Fighting", "If you took the Attack action and attacked with a light melee weapon in one hand, you can attack with another light melee weapon in the other hand."],
    ["Off-Hand Attack",     "Bonus-action attack with a light weapon you used for two-weapon fighting (no ability mod added unless negative)."],
    ["Class / Spell Bonus", "Anything else granted by a class feature, spell, or feat that explicitly costs a bonus action (e.g. Cunning Action, Healing Word)."],
  ];
  const BASIC_REACTIONS = [
    ["Opportunity Attack", "When a hostile creature you can see leaves your reach, use your reaction to make one melee attack against it."],
    ["Ready (triggered)",  "When a trigger you set with the Ready action occurs, use your reaction to take the readied action."],
    ["Class / Spell Reaction", "Anything else that explicitly costs a reaction (e.g. Shield, Counterspell, Hellish Rebuke, Uncanny Dodge)."],
  ];
  const cheatSheet = (rows) => el("div", { class: "ov-cheat" },
    el("h4", { class: "ov-group-h ov-group-h--cheat" }, rows[0]),
    ...rows[1].map(([n, d]) => cheatSheetRow(n, d))
  );

  // Build a sub-pane that's split into NAMED CATEGORIES with collapsible sub-headers.
  // Each section is alphabetised. Empty sections render an em-dash placeholder.
  const alpha = (rows) => rows.slice().sort((a, b) => {
    const an = a?.querySelector?.(".ov-row__name")?.textContent || "";
    const bn = b?.querySelector?.(".ov-row__name")?.textContent || "";
    return an.localeCompare(bn);
  });
  const collapsibleSection = (heading, rows) =>
    el("details", { open: true, class: "ov-group-details" },
      el("summary", { class: "ov-group-h ov-group-h--collapsible" }, heading),
      rows.length ? ovList(alpha(rows)) : ovEmpty("—")
    );
  const categorisedPane = (groups, addBtns = [], cheatTitle, cheatRows) => {
    const sections = groups.map(([heading, rows]) => collapsibleSection(heading, rows));
    return el("div", {},
      el("div", {}, ...sections),
      addBtns.length ? ovAddBar(...addBtns) : null,
      cheatRows ? cheatSheet([cheatTitle, cheatRows]) : null
    );
  };

  // Combined Action tab (Attack + Action merged): three categories.
  const actionGroups = () => [
    ["Weapon Attacks", [...weaponRows, ...customAttackRows]],
    ["Spell Attacks",  attackSpells.map(spellRow)],
    ["Other Actions",  [...actionFeats.map(featureRow), ...caByType("action").map(customActionRow), ...nonAttackActionSpells.map(spellRow)]]
  ];
  const bonusGroups = () => [
    ["Spell Bonus Actions", spellBonus.map(spellRow)],
    ["Other Bonus Actions", [...bonusFeats.map(featureRow), ...caByType("bonusAction").map(customActionRow)]]
  ];
  const reactionGroups = () => [
    ["Spell Reactions", spellReaction.map(spellRow)],
    ["Other Reactions", [...reactionFeats.map(featureRow), ...caByType("reaction").map(customActionRow)]]
  ];

  // The All tab gets the full set of category subheaders, alphabetised within each.
  const allGroups = () => [
    ["Weapon Attacks",      [...weaponRows, ...customAttackRows]],
    ["Spell Attacks",       attackSpells.map(spellRow)],
    ["Other Actions",       [...actionFeats.map(featureRow), ...caByType("action").map(customActionRow), ...nonAttackActionSpells.map(spellRow)]],
    ["Spell Bonus Actions", spellBonus.map(spellRow)],
    ["Other Bonus Actions", [...bonusFeats.map(featureRow), ...caByType("bonusAction").map(customActionRow)]],
    ["Spell Reactions",     spellReaction.map(spellRow)],
    ["Other Reactions",     [...reactionFeats.map(featureRow), ...caByType("reaction").map(customActionRow)]],
    ["Other",               caOther.map(customActionRow)]
  ];

  const subs = [
    { id: "all",      label: "All",          build: () => categorisedPane(allGroups(), [mkAddAttack(), mkAddAction()],
        "Basic D&D Actions", [...BASIC_ACTIONS, ...BASIC_BONUS_ACTIONS, ...BASIC_REACTIONS]) },
    { id: "action",   label: "Action",       build: () => categorisedPane(actionGroups(),   [mkAddAttack(), mkAddAction("action")],   "Basic D&D Actions",        BASIC_ACTIONS) },
    { id: "bonus",    label: "Bonus Action", build: () => categorisedPane(bonusGroups(),    [mkAddAction("bonusAction")],             "Basic D&D Bonus Actions",  BASIC_BONUS_ACTIONS) },
    { id: "reaction", label: "Reaction",     build: () => categorisedPane(reactionGroups(), [mkAddAction("reaction")],                "Basic D&D Reactions",      BASIC_REACTIONS) },
    { id: "other",    label: "Other",        build: () => ovPane(ovList(caOther.map(customActionRow)), mkAddAction("other")) },
    { id: "limited",  label: "Limited Use",  build: () => ovPane(
        ovList([...otherLimited.map(featureRow), ...limitedSpells.map(spellRow)]),
        mkAddAction("other")
      ) },
  ];
  return buildSubTabPane("actions", subs, state);
}

/**
 * Gather every spell the character "knows" — SRD-listed spells from `knownSpells`
 * (with overrides merged) plus all custom spells. Returns plain spell objects with
 * `.id`, `.name`, `.castingTime`, `.description`, etc. Used by the Actions pane to
 * classify spells by casting time (action / bonus action / reaction).
 */
function collectKnownSpells(doc) {
  const out = [];
  const known = doc.spellcasting?.knownSpells || [];
  const overrides = doc.spellcasting?.spellOverrides || {};
  for (const id of known) {
    const base = SPELLS[id];
    if (!base) continue;
    const ov = overrides[id];
    out.push(ov ? { ...base, ...ov, id } : base);
  }
  for (const s of doc.spellcasting?.custom || []) {
    // Custom spells use `desc`; normalise to `description` so downstream
    // code (isAttackSpell, spellRow tooltip, etc.) can use a single field.
    out.push(s.description != null ? s : { ...s, description: s.desc || "" });
  }
  return out;
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
  const addedIds = new Set();
  if (hasCaster) {
    for (const lvl of byLevel.keys()) {
      for (const s of byLevel.get(lvl)) {
        if (known.has(s.id)) {
          const ov = overrides[s.id];
          spells.push(ov ? { ...s, ...ov, id: s.id } : s);
          addedIds.add(s.id);
        }
      }
    }
  }
  // Include any known spells not in the class spell list — e.g. cantrips/spells
  // granted by feats (Aberrant Dragonmark → Mage Hand, Shield) that don't appear
  // in spellsByLevel("ranger") because they're not Ranger class spells.
  for (const id of (doc.spellcasting.knownSpells || [])) {
    if (!addedIds.has(id) && SPELLS[id]) {
      const ov = overrides[id];
      const base = SPELLS[id];
      spells.push(ov ? { ...base, ...ov, id } : base);
      addedIds.add(id);
    }
  }
  for (const s of doc.spellcasting.custom || []) {
    // Normalise desc → description so spellRow can use a single field.
    spells.push(s.description != null ? s : { ...s, description: s.desc || "" });
  }

  const sc = doc.spellcasting || {};

  // Extract primary damage from a spell's text. Prefers explicit damage/damageType
  // fields (set when editing in the form); falls back to regex on the description.
  const spellDmgStr = (s) => {
    if (s.damage) return s.damageType ? `${s.damage} ${s.damageType}` : s.damage;
    const txt = s.description || s.desc || "";
    const m = txt.match(/\b(\d+d\d+(?:[+\-]\d+)?)\s+(cold|fire|lightning|necrotic|psychic|radiant|thunder|acid|poison|force|bludgeoning|piercing|slashing)\b/i)
           || txt.match(/\b(\d+d\d+(?:[+\-]\d+)?)\s+\w*\s*damage\b/i);
    if (!m) return "";
    return m[2] ? `${m[1]} ${m[2]}` : m[1];
  };

  const spellRow = (s) => {
    const isCustom = !!s.custom;
    const label = s.name + (isCustom ? " ★" : "");
    const dmg = spellDmgStr(s);
    // Meta line: school · casting time · damage (if any) · Concentration · Ritual
    const tags = [
      s.school || "",
      s.castingTime || "",
      dmg,
      s.concentration ? "Concentration" : "",
      s.ritual ? "Ritual" : ""
    ].filter(Boolean);
    const meta = tags.join(" · ");
    const row = ovRow(label, meta, () => openSpellDetail(s, { store }));
    const compParts = [];
    if (s.components?.v) compParts.push("V");
    if (s.components?.s) compParts.push("S");
    if (s.components?.m) compParts.push(`M${s.components.material ? ` (${s.components.material})` : ""}`);
    const compStr = compParts.join(", ") || "—";
    // description field is authoritative; desc is the custom-spell alias
    const descText = s.description || s.desc || "";
    const tipBase = [
      `Casting Time: ${s.castingTime || "—"}`,
      `Range: ${s.range || "—"}`,
      `Components: ${compStr}`,
      `Duration: ${s.duration || "—"}`
    ].join(" · ") + (descText ? "\n\n" + descText.slice(0, 200) + (descText.length > 200 ? "…" : "") : "");
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
    { id: "slots", label: "Slots", build: () => renderSlotTracker(store, d.slots) },
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
  ];
  // Ritual and Concentration sub-tabs were removed — those qualities are now shown
  // directly on each spell tile's meta line (e.g. "evocation · 1 action · Concentration").
  // Slots are now scoped to their own sub-tab — no longer permanently visible above the sub-tab bar.
  return buildSubTabPane("spells", subs, state);
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

  // Equip toggle button — flipping equipped status drives derived AC/skills/saves
  // recomputation via the override pattern: items that grant bonuses should write
  // those bonuses into proficiencies.skillOverrides / saveOverrides only when
  // equipped. To keep this generic, we expose an equip toggle and re-derive on save.
  const equipBtn = (it) => el("button", {
    class: "btn btn--sm" + (it.equipped ? " btn--primary" : ""),
    title: it.equipped ? "Unequip" : "Equip",
    onclick: e => {
      e.stopPropagation();
      store.update(x => {
        const target = x.equipment.items.find(r => r.instanceId === it.instanceId);
        if (target) target.equipped = !target.equipped;
      });
    }
  }, it.equipped ? "Unequip" : "Equip");

  const attuneBtn = (it) => {
    const base = getBase(it);
    // only show attune button if the item supports/requires attunement, or already attuned
    const attunable = base?.attunement || base?.requiresAttunement || it.attuned ||
                      /requires attunement/i.test(base?.description || "");
    if (!attunable) return null;
    return el("button", {
      class: "btn btn--sm" + (it.attuned ? " btn--primary" : ""),
      title: it.attuned ? "End attunement" : "Attune",
      onclick: e => {
        e.stopPropagation();
        store.update(x => {
          const target = x.equipment.items.find(r => r.instanceId === it.instanceId);
          if (target) target.attuned = !target.attuned;
        });
      }
    }, it.attuned ? "Unattune" : "Attune");
  };

  const editBtn = (it) => {
    const base = getBase(it);
    if (!base) return null;
    return el("button", {
      class: "btn btn--sm",
      title: "Edit / view details",
      onclick: e => {
        e.stopPropagation();
        openItemDetail(base, { store, instanceId: it.instanceId });
      }
    }, "✎");
  };

  // Category editor — opens a popover with a checkbox per category. Items can live
  // in multiple categories at once (e.g. Cloak of Protection is both Armor and a
  // Magical Item). Saving writes `it.categories` (array). Selecting nothing clears
  // both `it.categories` and the legacy `it.category` so heuristics resume.
  const CATEGORY_LABELS = {
    armor: "Armor", weapons: "Weapons", magical: "Magical Items", trinkets: "Trinkets",
    food: "Food", potions: "Potions", personal: "Personal Items",
    componentPouch: "Component Pouch", other: "Other"
  };
  const categoryBtn = (it) => el("button", {
    class: "btn btn--sm",
    title: "Categorize this item",
    onclick: e => {
      e.stopPropagation();
      openItemCategoryPopover(store, it, e.currentTarget, CATEGORY_LABELS, categoriesFor);
    }
  }, "⚑");

  const delBtn = (it) => el("button", {
    class: "btn btn--sm btn--danger",
    title: "Remove",
    onclick: e => {
      e.stopPropagation();
      store.update(x => {
        x.equipment.items = (x.equipment.items || []).filter(r => r.instanceId !== it.instanceId);
      });
    }
  }, "×");

  const rowFor = (it) => {
    const base = getBase(it);
    if (!base) return null;
    const isCustom = !it.itemId && !!it.custom;
    const meta = base.type === "weapon" ? `${base.damage || ""} ${base.damageType || ""}`.trim()
               : base.type === "armor"  ? `AC ${base.ac} (${base.armorType})`
               : (base.description || "").slice(0, 80);
    const qty = it.quantity > 1 ? ` ×${it.quantity}` : "";
    const tags = [
      it.equipped ? "equipped" : null,
      it.attuned  ? "attuned"  : null
    ].filter(Boolean).join(" · ");
    const title = base.name + qty + (tags ? ` · ${tags}` : "");
    const actions = [equipBtn(it), attuneBtn(it), categoryBtn(it), editBtn(it), delBtn(it)].filter(Boolean);
    const row = ovRow(title, meta, () => openItemDetail(base, { store, instanceId: it.instanceId }), actions);
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

  // ── Categorisation ──
  // An item can belong to ANY NUMBER of categories. The user override is `it.categories`
  // (array) — if set, the item appears in every listed bucket. Legacy single-string
  // `it.category` is migrated on read. If no override is set, heuristics decide a
  // primary category PLUS auto-add "magical" when the item is magical (so e.g. a
  // Cloak of Protection shows up in both Armor and Magical Items at once).
  const nameOf = (it) => (getBase(it)?.name || "").toLowerCase();
  const typeOf = (it) => (getBase(it)?.type || "").toLowerCase();

  const isComponentPouch = (it) => /component pouch/i.test(nameOf(it));
  const isPotion         = (it) => /potion|elixir|philter|tonic/i.test(nameOf(it));
  const isFood           = (it) => /\b(ration|rations|food|bread|cheese|fruit|meat|provision|trail meal|water flask|waterskin|wine|ale|beer|mead)\b/i.test(nameOf(it));
  const isWeapon         = (it) => typeOf(it) === "weapon";
  const isArmor          = (it) => typeOf(it) === "armor";
  const isMagical        = (it) => {
    const b = getBase(it);
    if (!b) return false;
    if (b.rarity && b.rarity !== "" && b.rarity !== "common") return true;
    if (b.attunement || b.requiresAttunement) return true;
    if (typeOf(it) === "magic") return true;
    if (it.attuned) return true;
    return false;
  };
  const isPersonal       = (it) => /\b(clothes|outfit|robe|cloak(?! of)|cape|hat|boots|gloves|belt|jewelry|necklace|earring|bracelet|signet|locket|memento|pouch|amulet)\b/i.test(nameOf(it));
  const isTrinket        = (it) => typeOf(it) === "trinket" ||
                                   /\btrinket\b/i.test(nameOf(it)) ||
                                   /\btrinket\b/i.test(getBase(it)?.description || "");

  const categoriesFor = (it) => {
    // Explicit override from the user — array of category ids.
    if (Array.isArray(it.categories) && it.categories.length) return [...new Set(it.categories)];
    // Legacy single-string override.
    if (typeof it.category === "string" && it.category) return [it.category];

    const cats = new Set();
    if (isComponentPouch(it)) cats.add("componentPouch");
    if (isPotion(it))         cats.add("potions");
    if (isFood(it))           cats.add("food");
    if (isMagical(it))        cats.add("magical");
    if (isWeapon(it))         cats.add("weapons");
    if (isArmor(it))          cats.add("armor");
    if (isTrinket(it))        cats.add("trinkets");
    if (isPersonal(it))       cats.add("personal");
    if (cats.size === 0)      cats.add("other");
    return [...cats];
  };

  const buckets = {
    armor:           [], weapons:  [], magical:  [], trinkets: [],
    food:            [], potions:  [], personal: [], componentPouch: [],
    other:           []
  };
  for (const it of items) {
    const cats = categoriesFor(it);
    for (const c of cats) {
      (buckets[c] || buckets.other).push(it);
    }
  }

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

  const paneFor = (bucket) => ovPane(ovList(bucket.map(rowFor).filter(Boolean)), mkAddCustomItem());

  // Build the All tab with collapsible category sections. Each item appears under
  // its first matching category only (to avoid showing it multiple times in the
  // flat All view — per-category sub-tabs still show the full membership).
  const BUCKET_ORDER = [
    ["armor", "Armor"], ["weapons", "Weapons"], ["magical", "Magical Items"],
    ["trinkets", "Trinkets"], ["potions", "Potions"], ["food", "Food"],
    ["personal", "Personal Items"], ["componentPouch", "Component Pouch"], ["other", "Other Possessions"]
  ];
  const allGroupedInventory = () => {
    const seen = new Set();
    const sections = [];
    for (const [key, label] of BUCKET_ORDER) {
      const bucket = buckets[key];
      if (!bucket.length) continue;
      const rows = bucket.filter(it => {
        if (seen.has(it.instanceId)) return false;
        seen.add(it.instanceId);
        return true;
      }).map(rowFor).filter(Boolean);
      if (!rows.length) continue;
      sections.push(el("details", { open: true, class: "ov-group-details" },
        el("summary", { class: "ov-group-h ov-group-h--collapsible" }, label),
        ovList(rows)
      ));
    }
    return sections.length ? el("div", {}, ...sections) : ovEmpty("No items yet.");
  };

  const subs = [
    { id: "all",            label: "All",                build: () => el("div", {}, allGroupedInventory(), ovAddBar(mkAddCustomItem()), itemLibrary) },
    { id: "armor",          label: "Armor",              build: () => paneFor(buckets.armor) },
    { id: "weapons",        label: "Weapons",            build: () => paneFor(buckets.weapons) },
    { id: "magical",        label: "Magical Items",      build: () => paneFor(buckets.magical) },
    { id: "trinkets",       label: "Trinkets",           build: () => paneFor(buckets.trinkets) },
    { id: "food",           label: "Food",               build: () => paneFor(buckets.food) },
    { id: "potions",        label: "Potions",            build: () => paneFor(buckets.potions) },
    { id: "personal",       label: "Personal Items",     build: () => paneFor(buckets.personal) },
    { id: "componentPouch", label: "Component Pouch",    build: () => paneFor(buckets.componentPouch) },
    { id: "other",          label: "Other Possessions",  build: () => paneFor(buckets.other) },
  ];
  return buildSubTabPane("inventory", subs, state);
}

/* ── Features & Traits pane ── */
function buildFeaturesPane(store, state) {
  const doc = store.doc;
  const d = store.derived;
  const features = d.features || [];
  // Look up the background data so we can label background features "(Background Name)"
  const bgData = BACKGROUNDS[doc.background?.backgroundId] || null;

  // For class/race features, append the user-chosen variant in parentheses to the
  // title — e.g. "Favored Enemy (Fiends, Undead, Beasts)". The variant is read from
  // features.notes[id]; if the note's first line looks like a comma-separated
  // variant list (no period, < 80 chars) we append it as a parenthesised suffix.
  // Falls back to the plain feature name when no variant has been set.
  const variantSuffix = (f) => {
    const note = (store.doc.features?.notes?.[f.id] || "").trim();
    if (!note) return "";
    const firstLine = note.split(/\r?\n/)[0].trim();
    if (!firstLine) return "";
    if (firstLine.length > 80) return "";
    if (/[.!?]/.test(firstLine)) return "";  // looks like prose, not a variant list
    return ` (${firstLine})`;
  };

  const featureRow = (f) => {
    const row = ovRow(
      f.name + variantSuffix(f) + (f.level ? ` · L${f.level}` : "") + (f.kind === "custom" ? " ★" : ""),
      (f.desc || "").slice(0, 120) + ((f.desc?.length || 0) > 120 ? "…" : ""),
      () => openFeatureDetail(f, { store })
    );
    const savedSource = store.doc.features?.sources?.[f.id] || "";
    bindTooltip(row, {
      title: f.name + variantSuffix(f),
      html: buildTooltipHtml({ baseText: f.desc, acquiredFrom: savedSource, userNotes: f.userNotes }),
      sourceRef: f.source,
      onMore: () => openFeatureDetail(f, { store })
    });
    return row;
  };

  // Background features get "(Background Name)" appended to the title so it's
  // immediately clear which background granted the feature. E.g.:
  //   "Heart of Darkness (Haunted One)"
  const bgFeatureRow = (f) => {
    const bgSuffix = bgData ? ` (${bgData.name})` : "";
    const title = f.name + bgSuffix + (f.level ? ` · L${f.level}` : "");
    const row = ovRow(title,
      (f.desc || "").slice(0, 120) + ((f.desc?.length || 0) > 120 ? "…" : ""),
      () => openFeatureDetail(f, { store })
    );
    const savedSource = store.doc.features?.sources?.[f.id] || "";
    bindTooltip(row, {
      title: f.name + bgSuffix,
      html: buildTooltipHtml({ baseText: f.desc, acquiredFrom: savedSource || f.source, userNotes: f.userNotes }),
      sourceRef: f.source,
      onMore: () => openFeatureDetail(f, { store })
    });
    return row;
  };

  // Categorise features into the buckets the user wants. Auto-derived class/race/
  // background features are reliable (they have stable kind tags). Custom features
  // need source-text heuristics — combat feats and "special" traits both end up in
  // features.custom, so we route them by the `source` field the import / homebrew
  // form filled in.
  const FEAT_SOURCES = /\bfeat\b|fighting style|crossbow expert|sharpshooter|great weapon master|polearm master|war caster|sentinel|lucky|alert|tough|magic initiate|tavern brawler|inspiring leader|martial adept|skilled|elemental adept|grappler|charger|mobile|defensive duelist|dual wielder|healer|heavy armor master|keen mind|linguist|mage slayer|medium armor master|observant|resilient|ritual caster|savage attacker|skill expert|piercer|slasher|crusher/i;
  const SPECIAL_SOURCES = /monster slayer|gloom stalker|hunter conclave|beast master|fey wanderer|drakewarden|swarmkeeper|horizon walker|aberrant dragonmark|aberrant mind|dragonmark|dark gift|supernatural gift|epic boon|haunted one|cursed|gift of|pact of|otherworldly patron/i;

  const isCombatFeat = (f) =>
    (doc.features?.featIds || []).includes(f.id) ||
    FEAT_SOURCES.test(f.source || "") ||
    FEAT_SOURCES.test(f.name || "");

  const isSpecial = (f) => f.kind === "custom" && (
    SPECIAL_SOURCES.test(f.source || "") ||
    SPECIAL_SOURCES.test(f.name || "")
  );

  const racialTraits  = features.filter(f => f.kind === "race");
  const bgFeats       = features.filter(f => f.kind === "background");
  const classFeatures = features.filter(f => f.kind === "class");
  // Special traits take priority over combat feats. Aberrant Dragonmark's source
  // contains "feat" but the name/source matches SPECIAL_SOURCES — it should live
  // under Special Traits, not Combat Feats.
  const specialTraits = features.filter(f => isSpecial(f));
  const combatFeats   = features.filter(f => isCombatFeat(f) && !isSpecial(f));
  const usedIds = new Set([...racialTraits, ...bgFeats, ...classFeatures, ...combatFeats, ...specialTraits].map(f => f.id));
  const otherCustom = features.filter(f => f.kind === "custom" && !usedIds.has(f.id));

  const mkAddFeature = () => ovAddBtn("+ Add Custom Feature", () => openHomebrewForm({
    schema: FEATURE_SCHEMA,
    onSave: record => store.update(x => {
      x.features.custom = x.features.custom || [];
      x.features.custom.push(record);
    })
  }));

  // All tab: collapsible sections per category, alphabetised within each.
  // Empty sections are skipped (dense list — no value in showing empty headers).
  const alphaFeats = (arr) => arr.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const allGroupedRows = () => {
    const groups = [
      ["Racial Traits",  racialTraits,  featureRow],
      ["Background",     bgFeats,       bgFeatureRow],
      ["Class Features", classFeatures, featureRow],
      ["Special Traits", specialTraits, featureRow],
      ["Combat Feats",   combatFeats,   featureRow],
      ["Other",          otherCustom,   featureRow]
    ];
    const sections = [];
    for (const [heading, list, rowFn] of groups) {
      if (!list.length) continue;
      sections.push(el("details", { open: true, class: "ov-group-details" },
        el("summary", { class: "ov-group-h ov-group-h--collapsible" }, heading),
        ovList(alphaFeats(list).map(rowFn))
      ));
    }
    return sections.length ? el("div", {}, ...sections) : ovEmpty("No features yet.");
  };

  const subs = [
    { id: "all",      label: "All",              build: () => el("div", {}, allGroupedRows(), ovAddBar(mkAddFeature())) },
    { id: "racial",   label: "Racial Traits",    build: () => ovPane(ovList(alphaFeats(racialTraits).map(featureRow)),   mkAddFeature()) },
    { id: "bg",       label: "Background",       build: () => ovPane(ovList(alphaFeats(bgFeats).map(bgFeatureRow)),      mkAddFeature()) },
    { id: "class",    label: "Class Features",   build: () => ovPane(ovList(alphaFeats(classFeatures).map(featureRow)),  mkAddFeature()) },
    { id: "special",  label: "Special Traits",   build: () => ovPane(ovList(alphaFeats(specialTraits).map(featureRow)),  mkAddFeature()) },
    { id: "feats",    label: "Combat Feats",     build: () => ovPane(ovList(alphaFeats(combatFeats).map(featureRow)),    mkAddFeature()) },
    ...(otherCustom.length ? [{ id: "other", label: "Other", build: () => ovPane(ovList(alphaFeats(otherCustom).map(featureRow)), mkAddFeature()) }] : []),
  ];
  return buildSubTabPane("features", subs, state);
}

/* ── Proficiencies pane ── */
// Single home for everything proficiency-shaped: skills, weapons, armor, tools,
// languages, saving-throw proficiencies. Each chip carries a hover tooltip with
// its source ("Class — Ranger", "Race — Wood Elf", "Added manually") and any
// user-supplied notes; clicking +Add lets the player record where a manual
// proficiency came from so it shows up later on hover.
function buildProficienciesPane(store, state) {
  const d = store.derived;

  // Each panel is a FACTORY so a fresh DOM tree is built per sub-tab render. The
  // earlier implementation cached the panels and then appended each into both the
  // All sub-pane and its dedicated sub-pane — appending a node a second time moves
  // it from its first parent, which is why the All tab silently rendered empty.
  const mkLang   = () => renderLanguagePanel(store);
  const mkArmor  = () => renderProficiencyPanel(store, "Armor",   "armor",   d.armorProficiencyDetails);
  const mkWeapon = () => renderProficiencyPanel(store, "Weapons", "weapons", d.weaponProficiencyDetails);
  const mkTool   = () => renderProficiencyPanel(store, "Tools",   "tools",   d.toolProficiencyDetails);

  // Saving-throw proficiencies — derived from class + manual extras. Render as
  // chips per ability so the player can see at a glance which saves they're
  // proficient in.
  const mkSaves = () => {
    const saveChips = [];
    for (const k of ["str", "dex", "con", "int", "wis", "cha"]) {
      if (d.saves[k].proficient) {
        const src = (d.saves[k].sources || []).map(s => s.label).join(" · ");
        saveChips.push(renderChip({
          label: `${k.toUpperCase()} Save`,
          sourceText: src,
          notes: store.doc.proficiencies?.saveNotes?.[k] || "",
          removable: false
        }));
      }
    }
    return el("div", { class: "panel" },
      el("h3", {}, "Saving Throw Proficiencies"),
      saveChips.length ? el("div", { class: "chips" }, ...saveChips) : el("p", { class: "muted" }, "None.")
    );
  };

  // Skills panel — every skill that's proficient or expertise, as a chip with a
  // hover tooltip explaining where the proficiency came from (Class skill choice,
  // Race, Background, Expertise, item bonus, etc.).
  const mkSkills = () => {
    const skillChips = [];
    const skills = d.skills || {};
    for (const id of Object.keys(skills)) {
      const s = skills[id];
      if (s.level === "none") continue;
      const tag = s.level === "expertise" ? " ★" : "";
      const sourceText = (s.sources || []).map(x => x.label).join(" · ");
      const notes = store.doc.proficiencies?.skillNotes?.[id] || "";
      const mod = s.modifier;
      const fmtVal = mod >= 0 ? `+${mod}` : `${mod}`;
      skillChips.push(renderChip({
        label: `${s.name}${tag} (${fmtVal})`,
        sourceText,
        notes,
        removable: false
      }));
    }
    return el("div", { class: "panel" },
      el("h3", {}, "Skill Proficiencies"),
      skillChips.length ? el("div", { class: "chips" }, ...skillChips) : el("p", { class: "muted" }, "None.")
    );
  };

  const subs = [
    {
      id: "all",
      label: "All",
      build: () => el("div", { class: "prof-grid" },
        mkSkills(), mkWeapon(), mkArmor(), mkTool(), mkLang(), mkSaves()
      )
    },
    { id: "skills",    label: "Skills",    build: () => mkSkills() },
    { id: "weapons",   label: "Weapons",   build: () => mkWeapon() },
    { id: "armor",     label: "Armor",     build: () => mkArmor() },
    { id: "tools",     label: "Tools",     build: () => mkTool() },
    { id: "languages", label: "Languages", build: () => mkLang() },
    { id: "saves",     label: "Saves",     build: () => mkSaves() }
  ];
  return buildSubTabPane("proficiencies", subs, state);
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

  // Concentrating toggle — single bit on the doc the player flips when they cast a
  // concentration spell. Surfaced inside the slots panel as a checkbox so it lives
  // next to slot tracking, where players actually look during combat.
  // Layout: flex row — checkbox+label on the left (no-shrink), text input fills
  // the remaining width. The slot-row grid is overridden with flex so the label
  // text ("Concentrating on:") never overlaps the spell-name input.
  const concentrating = !!doc.spellcasting.concentrating;
  const concentratingOn = doc.spellcasting.concentratingOn || "";
  const concentrationToggle = el("div", {
    class: "slot-row slot-row--concentration",
    style: { display: "flex", alignItems: "center", gap: "var(--sp-2)", paddingTop: "var(--sp-2)", borderTop: "1px solid var(--c-border)" }
  },
    el("label", { style: { display: "flex", alignItems: "center", gap: "var(--sp-1)", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", fontSize: "var(--fs-xs)", color: "var(--c-gold)", textTransform: "uppercase", letterSpacing: "0.1em" } },
      el("input", {
        type: "checkbox",
        checked: concentrating,
        onchange: e => store.update(x => {
          x.spellcasting.concentrating = !!e.target.checked;
          if (!e.target.checked) x.spellcasting.concentratingOn = "";
        })
      }),
      "Concentrating on:"
    ),
    el("input", {
      type: "text",
      placeholder: "spell name (optional)",
      value: concentratingOn,
      style: { flex: "1", minWidth: 0, padding: "4px 8px", background: "var(--c-bg-0)", border: "1px solid var(--c-border)", color: "var(--c-text)", borderRadius: "var(--r-sm)", fontFamily: "inherit", fontSize: "var(--fs-sm)" },
      onchange: e => store.update(x => { x.spellcasting.concentratingOn = e.target.value; })
    })
  );

  return el("div", { class: "panel" },
    el("div", { class: "panel__header" },
      el("h3", {}, "Spell Slots"),
      el("button", { class: "btn btn--sm", onclick: () => openConfigureSlotsModal(store, slots) }, "Configure")
    ),
    rows.length > 0
      ? el("div", {}, ...rows, concentrationToggle)
      : el("div", {}, el("p", { class: "muted" }, "No spell slots. Click Configure to set them manually."), concentrationToggle)
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

/**
 * Per-item category editor. Items can live in multiple categories at once — e.g.
 * a Cloak of Protection is both Armor and a Magical Item. The popover shows a
 * checkbox per category; saving writes `it.categories` (array). Unchecking
 * everything resets to heuristic categorisation by clearing both `it.categories`
 * and the legacy `it.category` field.
 */
function openItemCategoryPopover(store, it, anchorEl, labels, computeCurrent) {
  const current = new Set(computeCurrent(it));
  const items = Object.entries(labels);

  const grid = el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", marginTop: "var(--sp-2)" } });
  const checks = {};
  for (const [id, label] of items) {
    checks[id] = el("input", { type: "checkbox", checked: current.has(id) });
    grid.append(el("label", { style: { display: "flex", alignItems: "center", gap: "var(--sp-1)", fontSize: "var(--fs-sm)", cursor: "pointer" } }, checks[id], el("span", {}, label)));
  }

  const body = el("div",
    el("p", { class: "muted", style: { marginBottom: "var(--sp-2)", fontSize: "var(--fs-xs)" } },
      "Pick one or more categories. The item appears in every selected list. Uncheck everything to fall back to automatic categorisation."),
    grid
  );

  const saveBtn   = el("button", { class: "btn btn--primary" }, "Save");
  const clearBtn  = el("button", { class: "btn btn--ghost" }, "Reset to Auto");
  const cancelBtn = el("button", { class: "btn btn--ghost" }, "Cancel");
  const m = openModal({ title: "Categorize Item", body, footer: [cancelBtn, clearBtn, saveBtn] });

  cancelBtn.addEventListener("click", () => m.close());
  clearBtn.addEventListener("click", () => {
    store.update(x => {
      const target = x.equipment.items.find(r => r.instanceId === it.instanceId);
      if (target) { delete target.categories; delete target.category; }
    });
    m.close();
  });
  saveBtn.addEventListener("click", () => {
    const picked = items.map(([id]) => id).filter(id => checks[id].checked);
    store.update(x => {
      const target = x.equipment.items.find(r => r.instanceId === it.instanceId);
      if (!target) return;
      if (picked.length === 0) {
        delete target.categories;
        delete target.category;
      } else {
        target.categories = picked;
        delete target.category; // clean up legacy single-string field
      }
    });
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
