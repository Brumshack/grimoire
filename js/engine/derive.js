import {
  ABILITY_KEYS, abilityMod, proficiencyBonus, carryCapacity, levelFromXp
} from "../data/rules.js";
import { SKILLS, SKILL_IDS } from "../data/skills.js";
import { resolveRace } from "../data/races.js";
import { CLASSES, classFeaturesUpToLevel, resolveClass, resolveSubclass } from "../data/classes.js";
import { BACKGROUNDS } from "../data/backgrounds.js";
import { ITEMS } from "../data/equipment.js";
import { FULL_CASTER_SLOTS, HALF_CASTER_SLOTS, WARLOCK_SLOTS } from "../data/spellSlotTables.js";

/**
 * Pure derivation of every computed value from the raw character document.
 * Returns a DerivedStats object that the UI renders from.
 */
export function deriveAll(c) {
  const resolvedRace = c.race.raceId ? resolveRace(c.race.raceId, c.race.subraceId) : null;

  const primary = c.progression.classes[0] || { classId: null, subclassId: null, level: 1 };
  const primaryClass = primary.classId ? resolveClass(primary.classId) : null;
  const primarySubclass = primary.classId && primary.subclassId ? resolveSubclass(primary.classId, primary.subclassId) : null;

  const totalLevel = c.progression.classes.reduce((s, cl) => s + (cl.level || 0), 0) || 1;
  const profBonus = pickOverride(c.combat?.profBonusOverride, proficiencyBonus(totalLevel));

  // Ability scores: base + racial + ASI + override
  const abilities = {};
  for (const k of ABILITY_KEYS) {
    const base = c.abilityScores.base?.[k] ?? 10;
    const racial = resolvedRace?.abilityBonuses?.[k] ?? 0;
    const asi = c.abilityScores.asiBonuses?.[k] ?? 0;
    const override = c.abilityScores.override?.[k];
    const score = override != null ? override : base + racial + asi;
    abilities[k] = {
      base, racial, asi,
      score: Math.min(30, Math.max(1, score)),
      mod: abilityMod(Math.min(30, Math.max(1, score)))
    };
  }

  // Proficiencies aggregation
  const background = c.background.backgroundId ? BACKGROUNDS[c.background.backgroundId] : null;

  const savingThrows = new Set(primaryClass?.savingThrows || []);
  for (const s of c.proficiencies.savingThrowsExtra || []) savingThrows.add(s);

  const skills = {};
  for (const id of SKILL_IDS) {
    const ability = SKILLS[id].ability;
    const sources = [];
    let level = "none";

    const manualLevel = c.proficiencies.skills?.[id];
    const grantedFromBackground = background?.skills?.includes(id);
    const grantedFromRace = (resolvedRace?.proficiencies?.skills || []).includes(id);

    if (grantedFromBackground) {
      level = "proficient";
      sources.push({ kind: "background", label: `Background — ${background.name}` });
    }
    if (grantedFromRace) {
      if (level === "none") level = "proficient";
      sources.push({ kind: "race", label: `Race — ${resolvedRace.fullName}` });
    }
    if (manualLevel === "proficient") {
      if (level === "none") level = "proficient";
      if (!grantedFromBackground && !grantedFromRace) {
        sources.push({ kind: "manual", label: "Class skill choice or manual" });
      }
    } else if (manualLevel === "expertise") {
      level = "expertise";
      sources.push({ kind: "expertise", label: "Expertise (2× proficiency bonus)" });
    }

    const multiplier = level === "expertise" ? 2 : level === "proficient" ? 1 : 0;
    const baseMod = abilities[ability].mod + profBonus * multiplier;
    const skillOverride = c.proficiencies?.skillOverrides?.[id];
    if (skillOverride != null) {
      sources.push({ kind: "override", label: `Manual override: ${skillOverride >= 0 ? "+" : ""}${skillOverride}` });
    }

    skills[id] = {
      id,
      name: SKILLS[id].name,
      ability,
      level,
      modifier: pickOverride(skillOverride, baseMod),
      overridden: skillOverride != null,
      sources
    };
  }

  // Saves
  const saves = {};
  for (const k of ABILITY_KEYS) {
    const sources = [];
    const prof = savingThrows.has(k);
    const fromClass = (primaryClass?.savingThrows || []).includes(k);
    const fromExtra = (c.proficiencies.savingThrowsExtra || []).includes(k);
    if (fromClass) sources.push({ kind: "class", label: `${primaryClass.name} class` });
    if (fromExtra) sources.push({ kind: "manual", label: "Added manually" });
    const baseSave = abilities[k].mod + (prof ? profBonus : 0);
    const saveOverride = c.proficiencies?.saveOverrides?.[k];
    if (saveOverride != null) {
      sources.push({ kind: "override", label: `Manual override: ${saveOverride >= 0 ? "+" : ""}${saveOverride}` });
    }
    saves[k] = {
      ability: k,
      proficient: prof,
      modifier: pickOverride(saveOverride, baseSave),
      overridden: saveOverride != null,
      sources
    };
  }

  // AC
  const ac = computeAc(c, abilities, primaryClass);

  // Speed
  const raceSpeed = resolvedRace?.speed ?? 30;
  const speed = pickOverride(c.combat?.speedOverride, raceSpeed + (c.combat.speedBonus || 0));

  // HP level-up source HP (for display; actual maxHp is persisted)
  const hitDie = pickOverride(c.combat?.hitDieOverride, primaryClass?.hitDie || 8);

  // Spell slots
  const slots = computeSpellSlots(c);

  // Passive stats
  const po = c.combat?.passiveOverrides || {};
  const passivePerception = pickOverride(po.perception, 10 + skills.perception.modifier);
  const passiveInvestigation = pickOverride(po.investigation, 10 + skills.investigation.modifier);
  const passiveInsight = pickOverride(po.insight, 10 + skills.insight.modifier);

  // Initiative
  const initiative = pickOverride(c.combat?.initiativeOverride, abilities.dex.mod + (c.combat.initiativeBonus || 0));

  // Spellcasting ability/DC/attack
  let spellAbility = null, spellSaveDC = null, spellAttack = null;
  const scOverrideAbility = c.spellcasting?.abilityOverride;
  const classCastingAbility = primaryClass?.spellcasting?.ability || null;
  spellAbility = scOverrideAbility || classCastingAbility;
  if (spellAbility) {
    const mod = abilities[spellAbility].mod;
    spellSaveDC = pickOverride(c.spellcasting?.saveDcOverride, 8 + profBonus + mod);
    spellAttack = pickOverride(c.spellcasting?.attackOverride, profBonus + mod);
  } else {
    // even without a casting class, allow manual overrides
    spellSaveDC = c.spellcasting?.saveDcOverride ?? null;
    spellAttack = c.spellcasting?.attackOverride ?? null;
  }

  // Carry
  const carry = carryCapacity(abilities.str.score);
  const carriedWeight = (c.equipment.items || []).reduce((s, it) => {
    const base = it.itemId ? ITEMS[it.itemId] : it.custom;
    const w = (base?.weight ?? 0) * (it.quantity || 1);
    return s + w;
  }, 0);

  // Features list (class + subclass + race traits + background feature)
  const notes = c.features?.notes || {};
  const featureOverrides = c.features?.overrides || {};
  const features = [];

  const pushFeature = (base, id, kind) => {
    const ov = featureOverrides[id] || {};
    features.push({
      ...base,
      // user-editable fields can be overridden
      name:   ov.name   !== undefined ? ov.name   : (base.name   || ""),
      desc:   ov.desc   !== undefined ? ov.desc   : (base.desc   || ""),
      source: ov.source !== undefined ? ov.source : (base.source || ""),
      level:  ov.level  !== undefined ? ov.level  : (base.level  ?? 1),
      // protected fields
      id, kind,
      userNotes: notes[id] || "",
      isEdited: Object.keys(ov).length > 0
    });
  };

  if (primaryClass) {
    for (const f of classFeaturesUpToLevel(primary.classId, primary.subclassId, primary.level)) {
      const id = `class:${primary.classId}:${slug(f.name)}`;
      pushFeature({ ...f, source: f.source || `${primaryClass.name} (Class)` }, id, "class");
    }
  }
  if (resolvedRace) {
    for (const t of resolvedRace.traits) {
      const id = `race:${c.race.raceId}${c.race.subraceId ? ":" + c.race.subraceId : ""}:${slug(t.name)}`;
      pushFeature({ name: t.name, desc: t.desc, source: `${resolvedRace.fullName} (Race)`, level: 1 }, id, "race");
    }
  }
  if (background) {
    const id = `bg:${c.background.backgroundId}:${slug(background.feature.name)}`;
    pushFeature({ name: background.feature.name, desc: background.feature.desc, source: `${background.name} (Background)`, level: 1 }, id, "background");
  }
  for (const f of c.features?.custom || []) {
    pushFeature({ name: f.name || "Custom Feature", desc: f.desc || "", source: f.source || "Homebrew", level: f.level ?? 1 }, f.id, "custom");
  }

  // Meta buckets — user-supplied source labels and notes for manual entries
  const langMeta    = c.proficiencies.langMeta    || {};
  const armorMeta   = c.proficiencies.armorMeta   || {};
  const weaponMeta  = c.proficiencies.weaponMeta  || {};
  const toolMeta    = c.proficiencies.toolMeta    || {};

  // Languages aggregation with provenance
  const languageDetails = {};
  (resolvedRace?.languages || []).forEach(l => {
    languageDetails[l] = { name: l, source: `Race — ${resolvedRace.fullName}`, removable: false, notes: "" };
  });
  (c.proficiencies.languages || []).forEach(l => {
    const meta = langMeta[l] || {};
    if (!languageDetails[l]) {
      languageDetails[l] = { name: l, source: meta.source || "Added manually", removable: true, notes: meta.notes || "" };
    }
  });
  const languages = Object.keys(languageDetails);

  // Auto-proficiencies with provenance
  const armorDetails = buildProficiencyDetails({
    class: primaryClass?.proficiencies?.armor,
    manual: c.proficiencies.armor,
    className: primaryClass?.name,
    raceName: resolvedRace?.fullName,
    race: resolvedRace?.proficiencies?.armor,
    meta: armorMeta
  });
  const weaponDetails = buildProficiencyDetails({
    class: primaryClass?.proficiencies?.weapons,
    manual: c.proficiencies.weapons,
    className: primaryClass?.name,
    raceName: resolvedRace?.fullName,
    race: resolvedRace?.proficiencies?.weapons,
    meta: weaponMeta
  });
  const toolDetails = buildProficiencyDetails({
    class: primaryClass?.proficiencies?.tools,
    manual: c.proficiencies.tools,
    className: primaryClass?.name,
    raceName: resolvedRace?.fullName,
    race: resolvedRace?.proficiencies?.tools,
    meta: toolMeta
  });
  const armorProf = new Set(Object.keys(armorDetails));
  const weaponProf = new Set(Object.keys(weaponDetails));
  const toolProf = new Set(Object.keys(toolDetails));

  return {
    totalLevel,
    profBonus,
    level: levelFromXp(c.progression.xp) || totalLevel,
    abilities,
    saves,
    skills,
    ac,
    speed,
    initiative,
    passivePerception,
    passiveInvestigation,
    passiveInsight,
    spellAbility, spellSaveDC, spellAttack,
    hitDie,
    slots,
    carry,
    carriedWeight,
    features,
    languages: [...languages],
    armorProficiencies: [...armorProf],
    weaponProficiencies: [...weaponProf],
    toolProficiencies: [...toolProf],
    languageDetails,
    armorProficiencyDetails: armorDetails,
    weaponProficiencyDetails: weaponDetails,
    toolProficiencyDetails: toolDetails,
    resolvedRace,
    primaryClass, primarySubclass
  };
}

function slug(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function buildProficiencyDetails({ class: classList, manual, race, className, raceName, meta = {} }) {
  const out = {};
  (classList || []).forEach(name => {
    out[name] = { name, source: `Class — ${className || "class"}`, removable: false, notes: "" };
  });
  (race || []).forEach(name => {
    if (!out[name]) out[name] = { name, source: `Race — ${raceName || "race"}`, removable: false, notes: "" };
  });
  (manual || []).forEach(name => {
    if (!out[name]) {
      const m = meta[name] || {};
      out[name] = { name, source: m.source || "Added manually", removable: true, notes: m.notes || "" };
    }
  });
  return out;
}

/** Return override when set (non-null, non-undefined, not ""); otherwise fallback. */
function pickOverride(override, fallback) {
  if (override === null || override === undefined || override === "") return fallback;
  return override;
}

function computeAc(c, abilities, primaryClass) {
  if (c.combat.acOverride != null) return c.combat.acOverride;

  const dex = abilities.dex.mod;
  const con = abilities.con.mod;
  const wis = abilities.wis.mod;

  // Find equipped armor / shield
  const equipped = (c.equipment.items || []).filter(i => i.equipped);
  const items = equipped.map(i => i.itemId ? ITEMS[i.itemId] : i.custom).filter(Boolean);
  const armor = items.find(i => i.type === "armor" && i.armorType !== "shield");
  const shield = items.find(i => i.type === "armor" && i.armorType === "shield");

  let base = 10 + dex;

  // Class-specific Unarmored Defense
  if (!armor) {
    if (primaryClass?.id === "barbarian") base = 10 + dex + con;
    else if (primaryClass?.id === "monk" && !shield) base = 10 + dex + wis;
    else if (primaryClass?.id === "sorcerer" && primaryClass?.subclasses?.[0]?.id === "draconic") {
      // Draconic Resilience: only applies if subclass is draconic
      const sub = c.progression.classes[0]?.subclassId;
      if (sub === "draconic") base = 13 + dex;
    }
  } else {
    if (armor.armorType === "light") base = armor.ac + dex;
    else if (armor.armorType === "medium") base = armor.ac + Math.min(2, dex);
    else if (armor.armorType === "heavy") base = armor.ac;
  }
  if (shield) base += shield.ac;
  return base;
}

function computeSpellSlots(c) {
  const primary = c.progression.classes[0];
  if (!primary?.classId) return null;
  const cls = CLASSES[primary.classId];
  if (!cls?.spellcasting) return null;
  const lv = Math.max(0, Math.min(20, primary.level));

  if (cls.spellcasting.progression === "full") {
    const row = FULL_CASTER_SLOTS[lv];
    return { kind: "slots", perLevel: row.slice() };
  }
  if (cls.spellcasting.progression === "half") {
    const row = HALF_CASTER_SLOTS[lv];
    return { kind: "slots", perLevel: row.slice() };
  }
  if (cls.spellcasting.progression === "pact") {
    const pact = WARLOCK_SLOTS[lv];
    return { kind: "pact", slots: pact?.slots || 0, slotLevel: pact?.slotLevel || 1 };
  }
  return null;
}
