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

import { ALIGNMENTS } from "../../data/rules.js";
import { SPELLS, spellsByLevel } from "../../data/spells.js";
import { ITEMS, listWeapons, listArmor, listGear } from "../../data/equipment.js";

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
  const state = { tab: "overview", editMode: false };

  function rerender() {
    clear(root);
    root.append(renderSheetChrome(store, state, rerender));
  }

  // Delegate clicks on anything tagged with [data-override-path] while edit mode is on.
  root.addEventListener("click", (e) => {
    if (!state.editMode) return;
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

  const alignment = ALIGNMENTS.find(a => a.id === doc.identity.alignment)?.name || "";
  const classLine = d.primarySubclass
    ? `${d.primarySubclass.name} ${d.primaryClass.name}`
    : d.primaryClass?.name || "—";

  const header = el("header", { class: "sheet__header" },
    el("button", { class: "btn btn--ghost", onclick: () => navigate("/roster") }, "← Roster"),
    el("div", { class: "sheet__title" },
      el("div", { class: "sheet__name", contentEditable: "true",
        oninput: e => store.update(x => { x.identity.name = e.target.textContent.trim() || "Unnamed"; }),
      }, doc.identity.name),
      el("div", { class: "sheet__subtitle" },
        el("span", {}, `Level ${d.totalLevel}`), sep(),
        el("span", {}, d.resolvedRace?.fullName || "—"), sep(),
        el("span", {}, classLine), sep(),
        el("span", {}, alignment)
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
    ),
    el("button", {
      class: `btn btn--sm ${state.editMode ? "btn--primary" : "btn--ghost"}`,
      type: "button",
      title: "Toggle edit mode — click any stat to override it",
      onclick: () => { state.editMode = !state.editMode; rerender(); }
    }, state.editMode ? "✓ Editing" : "✎ Edit Stats")
  );

  const tabs = el("nav", { class: "sheet__tabs" },
    tabBtn("overview", "Overview", state, rerender),
    tabBtn("combat",   "Combat",   state, rerender),
    tabBtn("spells",   "Spells",   state, rerender, !d.primaryClass?.spellcasting),
    tabBtn("inventory","Inventory",state, rerender),
    tabBtn("features", "Features", state, rerender),
    tabBtn("lore",     "Lore",     state, rerender),
  );

  let body;
  switch (state.tab) {
    case "combat":    body = renderCombatTab(store); break;
    case "spells":    body = renderSpellsTab(store); break;
    case "inventory": body = renderInventoryTab(store); break;
    case "features":  body = renderFeaturesTab(store); break;
    case "lore":      body = renderLoreTab(store); break;
    default:          body = renderOverviewTab(store);
  }

  return el("div", { class: "sheet", "data-edit-mode": state.editMode ? "on" : "off" }, header, tabs, body);
}

/* ─────────────────────── override routing ─────────────────────── */

// Map data-override-path tokens to popover config + commit action.
function openOverrideFor(store, target) {
  const path = target.getAttribute("data-override-path");
  const doc = store.doc;
  const d = store.derived;

  const defs = {
    ac:            { label: "AC Override",          type: "number", get: () => doc.combat.acOverride,            base: d.ac,            set: v => x => { x.combat.acOverride = v; } },
    initiative:    { label: "Initiative Override",  type: "number", get: () => doc.combat.initiativeOverride,    base: d.abilities.dex.mod + (doc.combat.initiativeBonus || 0), set: v => x => { x.combat.initiativeOverride = v; } },
    speed:         { label: "Speed Override (ft)",  type: "number", get: () => doc.combat.speedOverride,         base: (d.resolvedRace?.speed ?? 30) + (doc.combat.speedBonus || 0), set: v => x => { x.combat.speedOverride = v; } },
    profBonus:     { label: "Proficiency Bonus",    type: "number", get: () => doc.combat.profBonusOverride,     base: d.profBonus,     set: v => x => { x.combat.profBonusOverride = v; } },
    hitDie:        { label: "Hit Die Size",         type: "number", get: () => doc.combat.hitDieOverride,        base: d.primaryClass?.hitDie ?? 8, set: v => x => { x.combat.hitDieOverride = v; } },
    passivePerception:    { label: "Passive Perception",    type: "number", get: () => doc.combat.passiveOverrides?.perception,    base: 10 + d.skills.perception.modifier,    set: v => x => { x.combat.passiveOverrides = x.combat.passiveOverrides || {}; x.combat.passiveOverrides.perception = v; } },
    passiveInvestigation: { label: "Passive Investigation", type: "number", get: () => doc.combat.passiveOverrides?.investigation, base: 10 + d.skills.investigation.modifier, set: v => x => { x.combat.passiveOverrides = x.combat.passiveOverrides || {}; x.combat.passiveOverrides.investigation = v; } },
    passiveInsight:       { label: "Passive Insight",       type: "number", get: () => doc.combat.passiveOverrides?.insight,       base: 10 + d.skills.insight.modifier,       set: v => x => { x.combat.passiveOverrides = x.combat.passiveOverrides || {}; x.combat.passiveOverrides.insight = v; } },
    spellSaveDC:   { label: "Spell Save DC",        type: "number", get: () => doc.spellcasting.saveDcOverride,  base: d.spellSaveDC,   set: v => x => { x.spellcasting.saveDcOverride = v; } },
    spellAttack:   { label: "Spell Attack",         type: "number", get: () => doc.spellcasting.attackOverride,  base: d.spellAttack,   set: v => x => { x.spellcasting.attackOverride = v; } },
    spellAbility:  { label: "Spellcasting Ability", type: "ability", get: () => doc.spellcasting.abilityOverride, base: d.primaryClass?.spellcasting?.ability || "—", set: v => x => { x.spellcasting.abilityOverride = v || null; } }
  };

  // ability score override: abilityScores.str etc.
  const abMatch = path.match(/^ability\.(str|dex|con|int|wis|cha)$/);
  if (abMatch) {
    const k = abMatch[1];
    const base = (doc.abilityScores.base?.[k] ?? 10) + (d.resolvedRace?.abilityBonuses?.[k] ?? 0) + (doc.abilityScores.asiBonuses?.[k] ?? 0);
    openOverridePopover({
      anchorEl: target,
      label: `${k.toUpperCase()} Override`,
      type: "number",
      currentValue: doc.abilityScores.override?.[k],
      baseHint: base,
      onSave: v => store.update(x => {
        x.abilityScores.override = x.abilityScores.override || {};
        if (v == null) delete x.abilityScores.override[k];
        else x.abilityScores.override[k] = v;
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
      anchorEl: target,
      label: `${sk.name} Override`,
      type: "number",
      currentValue: doc.proficiencies.skillOverrides?.[id],
      baseHint: sk.overridden ? "—" : sk.modifier,
      onSave: v => store.update(x => {
        x.proficiencies.skillOverrides = x.proficiencies.skillOverrides || {};
        if (v == null) delete x.proficiencies.skillOverrides[id];
        else x.proficiencies.skillOverrides[id] = v;
      })
    });
    return;
  }

  // save override: save.<ability>
  const svMatch = path.match(/^save\.(str|dex|con|int|wis|cha)$/);
  if (svMatch) {
    const k = svMatch[1];
    openOverridePopover({
      anchorEl: target,
      label: `${k.toUpperCase()} Save Override`,
      type: "number",
      currentValue: doc.proficiencies.saveOverrides?.[k],
      baseHint: d.saves[k].overridden ? "—" : d.saves[k].modifier,
      onSave: v => store.update(x => {
        x.proficiencies.saveOverrides = x.proficiencies.saveOverrides || {};
        if (v == null) delete x.proficiencies.saveOverrides[k];
        else x.proficiencies.saveOverrides[k] = v;
      })
    });
    return;
  }

  const def = defs[path];
  if (!def) return;
  openOverridePopover({
    anchorEl: target,
    label: def.label,
    type: def.type,
    currentValue: def.get(),
    baseHint: def.base,
    onSave: v => store.update(def.set(v))
  });
}

const sep = () => el("span", { class: "sep" }, "·");

function tabBtn(id, label, state, rerender, disabled = false) {
  return el("button", {
    class: `sheet__tab ${state.tab === id ? "is-active" : ""}`,
    type: "button", disabled,
    onclick: () => { state.tab = id; rerender(); }
  }, label);
}

/* ─────────────────────── overview ─────────────────────── */

function renderOverviewTab(store) {
  const d = store.derived;

  return el("div", { class: "sheet__grid" },
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
      renderCombatQuick(store),
      d.primaryClass?.spellcasting ? renderSpellcastingQuick(store) : null
    )
  );
}

function statBlock(store) {
  const d = store.derived;
  const doc = store.doc;

  const row = (label, value, tip, overridePath, overridden) => {
    const attrs = { class: "stat-pair" };
    if (overridePath) {
      attrs["data-override-path"] = overridePath;
      if (overridden) attrs["data-overridden"] = "true";
    }
    const r = el("div", attrs,
      el("div", { class: "stat-pair__label" }, label),
      el("div", { class: "stat-pair__value" }, value)
    );
    if (tip) bindTooltip(r, tip);
    return r;
  };

  return el("div", { class: "panel panel--stats" },
    el("div", { class: "stat-pair-grid" },
      row("AC", d.ac, { title: "Armor Class", summary: "Base AC. Auto-calculated from equipped armor, shield, and ability modifiers." }, "ac", doc.combat.acOverride != null),
      row("Initiative", fmt(d.initiative), { title: "Initiative", summary: `DEX mod${doc.combat.initiativeBonus ? " + " + doc.combat.initiativeBonus : ""}.` }, "initiative", doc.combat.initiativeOverride != null),
      row("Speed", `${d.speed} ft`, { title: "Speed", summary: "Walking speed in feet." }, "speed", doc.combat.speedOverride != null),
      row("Prof. Bonus", `+${d.profBonus}`, { title: "Proficiency Bonus", summary: `+${d.profBonus} at level ${d.totalLevel}.` }, "profBonus", doc.combat.profBonusOverride != null),
      row("Passive Perception", d.passivePerception, { title: "Passive Perception", summary: "10 + Perception modifier." }, "passivePerception", doc.combat.passiveOverrides?.perception != null),
      row("Hit Dice", `${Math.max(0, d.totalLevel - (doc.combat.hitDiceUsed?.[`d${d.hitDie}`] || 0))} / ${d.totalLevel} d${d.hitDie}`, { title: "Hit Dice", summary: "Spent on short rests to recover HP." }, "hitDie", doc.combat.hitDieOverride != null),
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
  return el("div", { class: "panel panel--spellcasting" },
    el("h3", {}, "Spellcasting"),
    el("div", { class: "stat-pair-grid" },
      el("div", { class: "stat-pair", "data-override-path": "spellAbility", "data-overridden": sc.abilityOverride ? "true" : null },
        el("div", { class: "stat-pair__label" }, "Ability"),
        el("div", { class: "stat-pair__value" }, d.spellAbility?.toUpperCase() || "—")
      ),
      el("div", { class: "stat-pair", "data-override-path": "spellSaveDC", "data-overridden": sc.saveDcOverride != null ? "true" : null },
        el("div", { class: "stat-pair__label" }, "Save DC"),
        el("div", { class: "stat-pair__value" }, d.spellSaveDC ?? "—")
      ),
      el("div", { class: "stat-pair", "data-override-path": "spellAttack", "data-overridden": sc.attackOverride != null ? "true" : null },
        el("div", { class: "stat-pair__label" }, "Attack"),
        el("div", { class: "stat-pair__value" }, fmt(d.spellAttack))
      ),
    )
  );
}

const fmt = m => m == null ? "—" : (m >= 0 ? `+${m}` : `${m}`);

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
      el("div", { class: "panel" },
        el("div", { class: "panel__header" },
          el("h3", {}, "Hit Dice"),
          el("div", { style: { display: "flex", gap: "var(--sp-2)", alignItems: "center" } },
            el("span", {
              class: "hit-die-badge",
              "data-override-path": "hitDie",
              title: "Click in Edit Stats mode to change die size"
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
      )
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
  let name, atkBonus, dmgStr, range, properties, notes, isEdited;

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
    html: buildTooltipHtml({ baseText: tipLines.join(" · "), userNotes: notes })
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

function openAddCustomActionModal(store) {
  const nameInp = el("input", {
    type: "text",
    placeholder: "Second Wind, Bardic Inspiration, Channel Divinity…",
    style: { width: "100%", padding: "var(--sp-1) var(--sp-2)", background: "var(--c-bg-0)", border: "1px solid var(--c-border)", color: "var(--c-text)", borderRadius: "var(--r-sm)", fontFamily: "inherit", fontSize: "var(--fs-sm)" }
  });
  const saveBtn   = el("button", { class: "btn btn--primary" }, "Add");
  const cancelBtn = el("button", { class: "btn btn--ghost" }, "Cancel");
  const m = openModal({
    title: "Add Custom Action",
    body: el("div", { class: "notes-editor" },
      el("div", { class: "notes-editor__label" }, "Action Name"),
      nameInp
    ),
    footer: [cancelBtn, saveBtn]
  });
  setTimeout(() => nameInp.focus(), 0);
  nameInp.addEventListener("keydown", e => {
    if (e.key === "Enter") saveBtn.click();
    if (e.key === "Escape") m.close();
  });
  cancelBtn.addEventListener("click", () => m.close());
  saveBtn.addEventListener("click", () => {
    const name = nameInp.value.trim();
    if (!name) return;
    store.update(x => {
      x.combat.customActions = x.combat.customActions || [];
      x.combat.customActions.push({ id: `ca-${uuid()}`, name, used: false });
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
  const slotBar = slots ? renderSlotTracker(store, slots) : null;

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
  const spellNote = sc.spellNotes?.[spell.id] || "";
  const spellSource = sc.spellSources?.[spell.id] || spell.source || "";
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
  if (slots.kind === "pact") {
    return el("div", { class: "panel" },
      el("h3", {}, `Pact Slots (Level ${slots.slotLevel})`),
      renderPips({
        total: slots.slots,
        used: doc.spellcasting.pactSlotsUsed || 0,
        onChange: n => store.update(x => { x.spellcasting.pactSlotsUsed = n; })
      })
    );
  }
  const rows = slots.perLevel.map((count, lvl) => {
    if (!count || lvl === 0) return null;
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
  }).filter(Boolean);
  if (rows.length === 0) return null;
  return el("div", { class: "panel" },
    el("h3", {}, "Spell Slots"),
    ...rows
  );
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
  bindTooltip(row, {
    title: base.name,
    html: buildTooltipHtml({ baseText: itemSummary, acquiredFrom: it.source, userNotes: it.notes }),
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

/* ─────────────────────── lore tab ─────────────────────── */

function renderLoreTab(store) {
  const doc = store.doc;
  const lore = doc.lore;

  const ARRAY_KEYS = new Set(["personalityTraits","ideals","bonds","flaws"]);
  const loreValue = (key) => {
    const v = lore[key];
    if (Array.isArray(v)) return v.join("\n");
    return v || "";
  };
  const textarea = (label, key) => el("label", { class: "field field--full" },
    el("div", { class: "field__label" }, label),
    el("textarea", {
      rows: 4,
      onchange: e => store.update(x => {
        if (ARRAY_KEYS.has(key)) {
          x.lore[key] = e.target.value.split("\n").map(s => s.trim()).filter(Boolean);
        } else {
          x.lore[key] = e.target.value;
        }
      })
    }, loreValue(key))
  );

  return el("div", { class: "sheet__grid" },
    el("div", { class: "col col--wide" },
      el("div", { class: "panel" },
        el("h3", {}, "Backstory"),
        textarea("Backstory", "backstory")
      ),
      el("div", { class: "panel" },
        el("h3", {}, "Personality"),
        textarea("Personality Traits", "personalityTraits"),
        textarea("Ideals", "ideals"),
        textarea("Bonds", "bonds"),
        textarea("Flaws", "flaws"),
      ),
      el("div", { class: "panel" },
        el("h3", {}, "Notes"),
        textarea("Notes", "notes")
      )
    ),
    el("div", { class: "col col--side" },
      el("div", { class: "panel" },
        el("h3", {}, "Appearance"),
        ...["age","height","weight","eyes","hair","skin","gender"].map(k =>
          el("label", { class: "field" },
            el("div", { class: "field__label" }, k[0].toUpperCase() + k.slice(1)),
            el("input", {
              type: k === "age" ? "number" : "text",
              value: doc.identity[k] ?? "",
              onchange: e => store.update(x => {
                x.identity[k] = k === "age" ? (parseInt(e.target.value, 10) || null) : e.target.value;
              })
            })
          )
        )
      )
    )
  );
}
