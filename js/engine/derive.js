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
  const profBonus = proficiencyBonus(totalLevel);

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
    let level = "none";
    if (c.proficiencies.skills?.[id] === "proficient") level = "proficient";
    if (c.proficiencies.skills?.[id] === "expertise") level = "expertise";
    // background/race/class granted (derived)
    const grantedFromBackground = background?.skills?.includes(id);
    const grantedFromRace = (resolvedRace?.proficiencies?.skills || []).includes(id);
    if (level === "none" && (grantedFromBackground || grantedFromRace)) level = "proficient";
    const multiplier = level === "expertise" ? 2 : level === "proficient" ? 1 : 0;
    skills[id] = {
      id,
      name: SKILLS[id].name,
      ability,
      level,
      modifier: abilities[ability].mod + profBonus * multiplier
    };
  }

  // Saves
  const saves = {};
  for (const k of ABILITY_KEYS) {
    const prof = savingThrows.has(k);
    saves[k] = {
      ability: k,
      proficient: prof,
      modifier: abilities[k].mod + (prof ? profBonus : 0)
    };
  }

  // AC
  const ac = computeAc(c, abilities, primaryClass);

  // Speed
  const raceSpeed = resolvedRace?.speed ?? 30;
  const speed = raceSpeed + (c.combat.speedBonus || 0);

  // HP level-up source HP (for display; actual maxHp is persisted)
  const hitDie = primaryClass?.hitDie || 8;

  // Spell slots
  const slots = computeSpellSlots(c);

  // Passive stats
  const passivePerception = 10 + skills.perception.modifier;
  const passiveInvestigation = 10 + skills.investigation.modifier;
  const passiveInsight = 10 + skills.insight.modifier;

  // Initiative
  const initiative = abilities.dex.mod + (c.combat.initiativeBonus || 0);

  // Spellcasting ability/DC/attack
  let spellAbility = null, spellSaveDC = null, spellAttack = null;
  if (primaryClass?.spellcasting) {
    spellAbility = primaryClass.spellcasting.ability;
    const mod = abilities[spellAbility].mod;
    spellSaveDC = 8 + profBonus + mod;
    spellAttack = profBonus + mod;
  }

  // Carry
  const carry = carryCapacity(abilities.str.score);
  const carriedWeight = (c.equipment.items || []).reduce((s, it) => {
    const base = it.itemId ? ITEMS[it.itemId] : it.custom;
    const w = (base?.weight ?? 0) * (it.quantity || 1);
    return s + w;
  }, 0);

  // Features list (class + subclass + race traits + background feature)
  const features = [];
  if (primaryClass) {
    for (const f of classFeaturesUpToLevel(primary.classId, primary.subclassId, primary.level)) {
      features.push({ ...f, kind: "class" });
    }
  }
  if (resolvedRace) {
    for (const t of resolvedRace.traits) {
      features.push({ name: t.name, desc: t.desc, source: `${resolvedRace.fullName} (Race)`, level: 1, kind: "race" });
    }
  }
  if (background) {
    features.push({
      name: background.feature.name,
      desc: background.feature.desc,
      source: `${background.name} (Background)`,
      level: 1,
      kind: "background"
    });
  }

  // Languages aggregation
  const languages = new Set(c.proficiencies.languages || []);
  (resolvedRace?.languages || []).forEach(l => languages.add(l));
  // (background grants N of choice — player picks manually)

  // Auto-proficiencies
  const armorProf = new Set([
    ...(primaryClass?.proficiencies?.armor || []),
    ...(c.proficiencies.armor || [])
  ]);
  const weaponProf = new Set([
    ...(primaryClass?.proficiencies?.weapons || []),
    ...((resolvedRace?.proficiencies?.weapons) || []),
    ...(c.proficiencies.weapons || [])
  ]);
  const toolProf = new Set([
    ...(primaryClass?.proficiencies?.tools || []),
    ...((resolvedRace?.proficiencies?.tools) || []),
    ...(c.proficiencies.tools || [])
  ]);

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
    resolvedRace,
    primaryClass, primarySubclass
  };
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
