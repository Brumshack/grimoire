#!/usr/bin/env node
/**
 * import-vault.js
 * Parse an Obsidian vault folder for a D&D character and output a .grimoire.json
 *
 * Usage:
 *   node scripts/import-vault.js "<path/to/vault>" [output.grimoire.json]
 *
 * If no output path is given, writes <CharacterName>.grimoire.json next to the script.
 * Logs a detailed import report to stderr.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const vaultPath = process.argv[2];
if (!vaultPath) {
  console.error("Usage: node scripts/import-vault.js <vault-path> [output.grimoire.json]");
  process.exit(1);
}

const outputPath = process.argv[3] || null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid() { return crypto.randomUUID(); }
function slug(s) { return (s || "").toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return fm;
}

function parseMarkdownTable(block) {
  const lines = block.split(/\r?\n/).filter(l => l.trim().startsWith("|"));
  if (lines.length < 2) return [];
  const headers = lines[0].split("|").map(h => h.trim().toLowerCase()).filter(Boolean);
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i].split("|").map(c => c.trim()).filter((_, j) => j > 0 && j <= headers.length);
    if (cells.length === 0) continue;
    const row = {};
    headers.forEach((h, j) => { row[h] = (cells[j] || "").replace(/\[\[.*?\|?(.*?)\]\]/g, "$1"); });
    rows.push(row);
  }
  return rows;
}

function stripLinks(s) {
  return (s || "").replace(/\[\[.*?\|?(.*?)\]\]/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}

function stripCallouts(s) {
  return (s || "").replace(/^>\s*\[!.*?\][-+]?\s*$/gm, "").replace(/^>\s?/gm, "").trim();
}

function extractSection(content, heading) {
  // Allow any emoji/non-word chars before the heading text
  const re = new RegExp(`##+ [^\\w\\n]*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?(?=\\n##+ |$)`, "i");
  const m = content.match(re);
  return m ? m[0] : "";
}

// ── File discovery ────────────────────────────────────────────────────────────

function walkDir(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else results.push(full);
  }
  return results;
}

const allFiles = walkDir(vaultPath);
const mdFiles = allFiles.filter(f => f.endsWith(".md"));

// ── Grimoire doc skeleton ─────────────────────────────────────────────────────

const doc = {
  schemaVersion: 4,
  id: uuid(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  identity: { name: "Imported Character", playerName: "", alignment: "TN", age: null, height: "", weight: "", eyes: "", hair: "", skin: "", gender: "", portraitDataUrl: null },
  progression: { classes: [{ classId: null, subclassId: null, level: 1, hitDieRolls: [] }], xp: 0, inspiration: false },
  race: { raceId: null, subraceId: null },
  background: { backgroundId: null },
  abilityScores: { base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, asiBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, override: {}, notes: {}, sources: {} },
  proficiencies: { skills: {}, expertise: {}, savingThrowsExtra: [], armor: [], weapons: [], tools: [], languages: [], skillOverrides: {}, saveOverrides: {}, skillNotes: {}, skillSources: {}, saveNotes: {}, saveSources: {} },
  combat: {
    maxHp: 1, currentHp: 1, tempHp: 0, hitDiceUsed: {}, hitDiceExtra: 0,
    deathSaves: { successes: 0, failures: 0 },
    conditions: [], resistances: [], immunities: [], vulnerabilities: [],
    speedBonus: 0, actionEconomy: { action: false, bonusAction: false, reaction: false },
    customActions: [], acOverride: null, initiativeOverride: null, initiativeBonus: 0,
    speedOverride: null, profBonusOverride: null, hitDieOverride: null,
    passiveOverrides: { perception: null, investigation: null, insight: null },
    statNotes: {}, statSources: {}, customAttacks: [], attackOverrides: {}
  },
  equipment: { items: [], currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } },
  spellcasting: {
    slotsUsed: {}, pactSlotsUsed: 0,
    knownSpells: [], preparedSpells: [], spellbook: [], custom: [], spellOverrides: {},
    spellSources: {}, spellNotes: {}, saveDcOverride: null, attackOverride: null, abilityOverride: null
  },
  features: { featIds: [], disabledFeatureIds: [], custom: [], overrides: {}, notes: {}, sources: {} },
  lore: {
    backstory: "", personalityTraits: [], ideals: [], bonds: [], flaws: [], notes: "",
    quests: [], sideQuests: [], npcs: [], locations: [], maps: [],
    organizations: [], deities: [], bestiary: [],
    allies: [], enemies: [], history: "", worldLore: ""
  },
  party: [], sessionLog: [],
  settings: { hpLevelUpMethod: "average", autoSaveEnabled: true }
};

// ── Import log ────────────────────────────────────────────────────────────────

const imported = [];
const skipped  = [];
function ok(what, where) { imported.push({ what, where }); }
function skip(file, reason) { skipped.push({ file: path.relative(vaultPath, file), reason }); }

// ── Class / race / alignment maps ────────────────────────────────────────────

const CLASS_MAP = {
  "ranger": "ranger", "fighter": "fighter", "barbarian": "barbarian", "bard": "bard",
  "cleric": "cleric", "druid": "druid", "monk": "monk", "paladin": "paladin",
  "rogue": "rogue", "sorcerer": "sorcerer", "warlock": "warlock", "wizard": "wizard"
};
const RACE_MAP = {
  "wood elf": "elf:wood-elf", "high elf": "elf:high-elf", "dark elf": "elf:dark-elf", "drow": "elf:dark-elf",
  "hill dwarf": "dwarf:hill-dwarf", "mountain dwarf": "dwarf:mountain-dwarf",
  "lightfoot halfling": "halfling:lightfoot-halfling", "stout halfling": "halfling:stout-halfling",
  "human": "human", "dragonborn": "dragonborn", "tiefling": "tiefling",
  "half-elf": "half-elf", "half-orc": "half-orc",
  "forest gnome": "gnome:forest-gnome", "rock gnome": "gnome:rock-gnome"
};
const ALIGN_MAP = {
  "lawful good": "LG", "neutral good": "NG", "chaotic good": "CG",
  "lawful neutral": "LN", "true neutral": "TN", "neutral": "TN", "chaotic neutral": "CN",
  "lawful evil": "LE", "neutral evil": "NE", "chaotic evil": "CE"
};
const ABILITY_MAP = { "str": "str", "dex": "dex", "con": "con", "int": "int", "wis": "wis", "cha": "cha",
  "strength": "str", "dexterity": "dex", "constitution": "con", "intelligence": "int", "wisdom": "wis", "charisma": "cha" };
const SKILL_MAP = {
  "acrobatics": "acrobatics", "animal handling": "animalHandling", "arcana": "arcana",
  "athletics": "athletics", "deception": "deception", "history": "history",
  "insight": "insight", "intimidation": "intimidation", "investigation": "investigation",
  "medicine": "medicine", "nature": "nature", "perception": "perception",
  "performance": "performance", "persuasion": "persuasion", "religion": "religion",
  "sleight of hand": "sleightOfHand", "stealth": "stealth", "survival": "survival"
};
const SRD_SPELLS = new Set([
  "mage-hand","hunters-mark","shield","cure-wounds","healing-word","bless","sleep",
  "thunderwave","burning-hands","magic-missile","charm-person","detect-magic",
  "hold-person","invisibility","misty-step","web","scorching-ray","spiritual-weapon",
  "counterspell","dispel-magic","fireball","lightning-bolt","fly","haste","revivify",
  "polymorph","wall-of-fire","cone-of-cold","raise-dead","heal","wish",
  "acid-splash","fire-bolt","poison-spray","ray-of-frost","shocking-grasp",
  "vicious-mockery","eldritch-blast","guidance","light","mending","message",
  "minor-illusion","prestidigitation","resistance","sacred-flame","thaumaturgy","spare-the-dying"
]);
const SRD_ITEMS = new Set([
  "longbow","shortbow","crossbow-light","crossbow-hand","crossbow-heavy","sling","dart","blowgun",
  "club","dagger","greatclub","handaxe","javelin","light-hammer","mace","quarterstaff","sickle","spear",
  "battleaxe","flail","glaive","greataxe","greatsword","halberd","lance","longsword","maul",
  "morningstar","pike","rapier","scimitar","shortsword","trident","war-pick","warhammer","whip","net",
  "padded","leather","studded","hide","chain-shirt","scale-mail","breastplate","half-plate",
  "ring-mail","chain-mail","splint","plate","shield"
]);

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseDashboard(content, file) {
  // Extract name from H1
  const nameMatch = content.match(/^#\s+(.+?)(?:\s+—.+)?$/m);
  if (nameMatch) { doc.identity.name = stripLinks(nameMatch[1]).trim(); ok("name", "identity.name"); }

  // Level, class, race, alignment from frontmatter or H1 subtitle
  const fm = parseFrontmatter(content);
  if (fm.level) { doc.progression.classes[0].level = parseInt(fm.level) || 1; ok("level", "progression.classes[0].level"); }

  const classRaw = (fm.class || "").toLowerCase().replace(/\s*\(.*\)/, "").trim();
  const classId = CLASS_MAP[classRaw];
  if (classId) { doc.progression.classes[0].classId = classId; ok("class → " + classId, "progression.classes[0].classId"); }

  const raceRaw = (fm.race || "").toLowerCase().trim();
  const raceId = RACE_MAP[raceRaw];
  if (raceId) { doc.race.raceId = raceId; ok("race → " + raceId, "race.raceId"); }

  // Alignment from subtitle line
  const alignMatch = content.match(/chaotic neutral|lawful good|neutral good|chaotic good|lawful neutral|true neutral|lawful evil|neutral evil|chaotic evil/i);
  if (alignMatch) {
    const alignId = ALIGN_MAP[alignMatch[0].toLowerCase()];
    if (alignId) { doc.identity.alignment = alignId; ok("alignment → " + alignId, "identity.alignment"); }
  }

  // Party members
  const partySection = extractSection(content, "Party");
  const partyLines = partySection.match(/[-*]\s+\[\[(.+?)\]\].*?(?:—|-)(.+)/g) || [];
  for (const line of partyLines) {
    const m = line.match(/\[\[(.+?)\]\].*?(?:—|-)\s*(.+)/);
    if (!m) continue;
    const [, name, desc] = m;
    const parts = desc.split(",").map(p => p.trim());
    doc.party.push({ name: stripLinks(name), playerName: "", race: "", class: parts[0] || "", level: parseInt((parts[1] || "").replace(/\D/g, "")) || 0, notes: desc });
    ok("party member: " + name, "party[]");
  }
}

function parseStats(content, file) {
  // Ability scores table
  const abilitySection = extractSection(content, "Ability Scores");
  const abilityRows = parseMarkdownTable(abilitySection);
  for (const row of abilityRows) {
    const key = ABILITY_MAP[(row.stat || "").toLowerCase()];
    if (!key) continue;
    const score = parseInt(row.score);
    if (!isNaN(score)) {
      doc.abilityScores.override[key] = score;
      ok(`${key.toUpperCase()} ${score}`, `abilityScores.override.${key}`);
    }
  }

  // Core numbers
  const coreSection = extractSection(content, "Core Numbers");
  const coreRows = parseMarkdownTable(coreSection);
  for (const row of coreRows) {
    const stat = (row.stat || "").toLowerCase();
    const val = stripLinks(row.value || "");
    const num = parseInt(val);
    if (stat.includes("hp")) { doc.combat.maxHp = num; doc.combat.currentHp = num; ok("HP " + num, "combat.maxHp/currentHp"); }
    else if (stat.includes("armor") || stat === "ac") { doc.combat.acOverride = num; ok("AC " + num, "combat.acOverride"); }
    else if (stat.includes("speed")) { doc.combat.speedOverride = parseInt(val); ok("Speed " + parseInt(val), "combat.speedOverride"); }
    else if (stat.includes("initiative")) { doc.combat.initiativeOverride = parseInt(val.replace(/[^0-9+-]/g, "")); ok("Initiative " + val, "combat.initiativeOverride"); }
    else if (stat.includes("proficiency") || stat.includes("prof")) { /* derives from level */ ok("Proficiency Bonus noted", "derived from level"); }
    else if (stat.includes("passive perc")) { doc.combat.passiveOverrides.perception = num; ok("Passive Perception " + num, "combat.passiveOverrides.perception"); }
    else if (stat.includes("spell save")) { doc.spellcasting.saveDcOverride = num; ok("Spell Save DC " + num, "spellcasting.saveDcOverride"); }
    else if (stat.includes("spell attack")) { doc.spellcasting.attackOverride = parseInt(val.replace(/[^0-9+-]/g, "")); ok("Spell Attack " + val, "spellcasting.attackOverride"); }
  }

  // Skills
  const skillSection = extractSection(content, "Skills");
  const skillRows = parseMarkdownTable(skillSection);
  for (const row of skillRows) {
    const skillId = SKILL_MAP[(row.skill || "").toLowerCase()];
    if (!skillId) continue;
    const prof = (row["proficient?"] || row.proficient || "").toLowerCase();
    if (prof.includes("✅") || prof.includes("yes") || prof.includes("true")) {
      doc.proficiencies.skills[skillId] = "proficient";
      const src = stripLinks(row.source || "");
      if (src) { doc.proficiencies.skillSources[skillId] = src; doc.proficiencies.skillNotes[skillId] = src; }
      ok("Skill: " + skillId + " (proficient)", "proficiencies.skills." + skillId);
    }
  }

  // Saving throws
  const saveSection = extractSection(content, "Saving Throws");
  const saveRows = parseMarkdownTable(saveSection);
  for (const row of saveRows) {
    const ability = (row.save || row.saving || "").toLowerCase().split(" ")[0];
    const key = ABILITY_MAP[ability];
    if (!key) continue;
    const prof = (row["proficient?"] || row.proficient || "").toLowerCase();
    if (prof.includes("✅") || prof.includes("yes")) {
      // Ranger saves are derived from class; extra saves go in savingThrowsExtra
      ok("Save: " + key + " (proficient, from class)", "derived");
    }
  }

  // Proficiencies section
  const profSection = extractSection(content, "Proficiencies");
  if (/simple|martial/i.test(profSection)) {
    if (!doc.proficiencies.weapons.length) {
      doc.proficiencies.weapons = ["simple", "martial"];
      ok("Weapon proficiencies: simple, martial", "proficiencies.weapons");
    }
  }
  if (/light|medium/i.test(profSection)) {
    if (!doc.proficiencies.armor.length) {
      doc.proficiencies.armor = ["light", "medium", "shields"];
      ok("Armor proficiencies: light, medium, shields", "proficiencies.armor");
    }
  }
}

function parseSpells(content, file) {
  // Spell DC / Attack
  const dcMatch = content.match(/Spell Save DC[:\s]+(\d+)/i);
  if (dcMatch) { doc.spellcasting.saveDcOverride = parseInt(dcMatch[1]); ok("Spell Save DC " + dcMatch[1], "spellcasting.saveDcOverride"); }
  const atkMatch = content.match(/Spell Attack[:\s+\+]+(\d+)/i);
  if (atkMatch) { doc.spellcasting.attackOverride = parseInt(atkMatch[1]); ok("Spell Attack +" + atkMatch[1], "spellcasting.attackOverride"); }
  const abilityMatch = content.match(/\*\*Ability:\*\*\s*(\w+)/i);
  if (abilityMatch) {
    const ab = ABILITY_MAP[abilityMatch[1].toLowerCase()];
    if (ab) { doc.spellcasting.abilityOverride = ab; ok("Spell Ability: " + ab, "spellcasting.abilityOverride"); }
  }

  // Parse each spell heading (### SpellName)
  const spellBlocks = content.split(/\n### /);
  for (let i = 1; i < spellBlocks.length; i++) {
    const block = spellBlocks[i];
    const nameMatch = block.match(/^\[?([^\]|\n]+)\]?/);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/\(.*?\)/, "").trim();
    if (!name || name.length < 2) continue;

    const tableRows = parseMarkdownTable(block);
    const props = {};
    for (const row of tableRows) {
      if (row["cast time"] || row["casting time"]) props.castingTime = row["cast time"] || row["casting time"];
      if (row.range) props.range = row.range;
      if (row.duration) props.duration = row.duration;
      if (row.components) props.components = row.components;
      if (row.concentration === "✅") props.concentration = true;
    }

    const level = i === 1 ? 0 : (() => {
      const hdrMatch = content.substring(0, content.indexOf("### " + block)).match(/## (\d+)[a-z]* Level/gi);
      return hdrMatch ? parseInt(hdrMatch[hdrMatch.length - 1].match(/\d+/)[0]) : 1;
    })();

    const concentration = /✅/.test(block) || /Conc,/i.test(block) || /Concentration/i.test(block);
    const ritual = /ritual/i.test(block);

    const descMatch = block.match(/\[!info\]-?\s*Description\s*\n([\s\S]*?)(?=\n>\s*\[!|$)/);
    const desc = descMatch ? stripCallouts(descMatch[1]) : "";

    const spellIdCandidate = slug(name);
    if (SRD_SPELLS.has(spellIdCandidate)) {
      if (!doc.spellcasting.knownSpells.includes(spellIdCandidate)) {
        doc.spellcasting.knownSpells.push(spellIdCandidate);
        ok("Known spell (SRD): " + name, "spellcasting.knownSpells");
      }
    } else {
      const existing = doc.spellcasting.custom.find(s => s.name === name);
      if (!existing) {
        const compStr = props.components || "";
        doc.spellcasting.custom.push({
          id: "vault-spell-" + spellIdCandidate + "-" + uuid().slice(0, 8),
          name,
          level,
          school: "",
          castingTime: props.castingTime || "1 action",
          range: props.range || "—",
          components: { v: /\bV\b/.test(compStr), s: /\bS\b/.test(compStr), m: /\bM\b/.test(compStr), material: "" },
          duration: props.duration || "Instantaneous",
          concentration,
          ritual,
          description: desc,
          custom: true
        });
        ok("Custom spell: " + name + " (level " + level + ")", "spellcasting.custom[]");
      }
    }
  }
}

function parseInventory(content, file) {
  const sections = content.split(/\n###\s+/);
  for (let i = 1; i < sections.length; i++) {
    const block = sections[i];
    const nameMatch = block.match(/^(.+)/);
    if (!nameMatch) continue;
    let itemName = nameMatch[1].trim();
    if (itemName.includes("×")) { /* handle quantity */ }
    const qty = itemName.match(/×\s*(\d+)/) ? parseInt(itemName.match(/×\s*(\d+)/)[1]) : 1;
    itemName = itemName.replace(/\s*×\s*\d+/, "").trim();

    const tableRows = parseMarkdownTable(block);
    const equipped = tableRows.some(r => Object.values(r).some(v => /✅\s*(equipped|in use)/i.test(v)));
    const attuned = tableRows.some(r => Object.values(r).some(v => /✅\s*(yes|attuned)/i.test(v)));
    const notCarried = tableRows.some(r => Object.values(r).some(v => /❌\s*no longer/i.test(v)));
    if (notCarried) { skip(file, "Item no longer carried: " + itemName); continue; }

    const noteMatch = block.match(/\[!info\]-?\s*(?:Notes?|Description)[\s\S]*?\n([\s\S]*?)(?=\n>?\s*\[!|$)/);
    const notes = noteMatch ? stripCallouts(noteMatch[1]).slice(0, 300) : "";

    const itemIdCandidate = slug(itemName);
    // Simple SRD match attempt
    const srdMatch = Array.from(SRD_ITEMS).find(id => itemIdCandidate.includes(id) || id.includes(itemIdCandidate));
    const instanceId = "vault-item-" + slug(itemName) + "-" + uuid().slice(0, 8);

    if (srdMatch && !itemName.toLowerCase().includes("magic") && !itemName.toLowerCase().includes("silver") && !itemName.toLowerCase().includes("cloak") && !itemName.toLowerCase().includes("stone") && !itemName.toLowerCase().includes("eyes")) {
      doc.equipment.items.push({ instanceId, itemId: srdMatch, custom: null, overrides: null, quantity: qty, equipped, attuned, source: "", notes, containerId: null });
      ok("Equipment (SRD: " + srdMatch + "): " + itemName, "equipment.items[]");
    } else {
      const itemType = /armor|leather|cloak/i.test(itemName) ? "armor" : /sword|bow|crossbow|weapon|lance|pike|bolt/i.test(itemName) ? "weapon" : "gear";
      doc.equipment.items.push({
        instanceId, itemId: null,
        custom: { name: itemName, type: itemType, desc: notes },
        overrides: null, quantity: qty, equipped, attuned, source: "", notes, containerId: null
      });
      ok("Equipment (custom): " + itemName, "equipment.items[]");
    }
  }
}

function parseFeats(content, file) {
  const featureSections = content.split(/\n###\s+/);
  for (let i = 1; i < featureSections.length; i++) {
    const block = featureSections[i];
    const nameMatch = block.match(/^(.+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/\s*\*\(.*?\)\*/, "").trim();
    if (!name || name.length < 2) continue;

    // Find source from parent section (## heading)
    const contentUpToHere = content.substring(0, content.indexOf("### " + block.substring(0, 20)));
    const parentHeaders = contentUpToHere.match(/^## .+/gm) || [];
    const source = parentHeaders.length > 0 ? parentHeaders[parentHeaders.length - 1].replace(/^## /, "").replace(/[🧝🎭🌲🗡️💠🖤✨]+\s*/u, "").trim() : "";

    const levelMatch = name.match(/Level\s+(\d+)/i) || block.match(/Level\s+(\d+)/i);
    const level = levelMatch ? parseInt(levelMatch[1]) : null;

    const descLines = block.split("\n").slice(1).filter(l => !l.startsWith("|") && !l.startsWith("#")).join("\n");
    const desc = stripCallouts(descLines).trim().slice(0, 800);

    doc.features.custom.push({
      id: "vault-feat-" + slug(name) + "-" + uuid().slice(0, 8),
      name, source: stripLinks(source), level, desc
    });
    ok("Feature: " + name, "features.custom[]");
  }
}

function parseLanguages(content, file) {
  const rows = parseMarkdownTable(content);
  for (const row of rows) {
    const lang = row.language || row["**language**"] || Object.values(row)[0] || "";
    const cleaned = lang.replace(/\*\*/g, "").trim();
    if (cleaned && cleaned.length > 1 && !doc.proficiencies.languages.includes(cleaned)) {
      doc.proficiencies.languages.push(cleaned);
      ok("Language: " + cleaned, "proficiencies.languages[]");
    }
  }
}

function parsePerson(content, file) {
  const fm = parseFrontmatter(content);
  const nameMatch = content.match(/^#\s+👤\s+(.+)$/m) || content.match(/^#\s+(.+)$/m);
  if (!nameMatch) return;
  const name = stripLinks(nameMatch[1]).trim();

  const raceMatch = content.match(/\*\*(?:Race|Type):\*\*\s*(.+)/);
  const roleMatch = content.match(/\*\*Role:\*\*\s*(.+)/);
  const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/);
  const locationMatch = content.match(/\*\*Location(?:\s+First\s+Met)?:\*\*\s*(.+)/);

  const relSection = extractSection(content, "Relationship");
  const relationship = stripLinks(relSection).replace(/^#+.*/gm, "").trim().slice(0, 200);

  const infoSection = extractSection(content, "Known Info") || extractSection(content, "Personality");
  const desc = stripLinks(stripCallouts(infoSection)).replace(/^#+.*/gm, "").trim().slice(0, 400);

  doc.lore.npcs.push({
    id: "vault-npc-" + slug(name) + "-" + uuid().slice(0, 8),
    name,
    race: stripLinks(raceMatch?.[1] || fm.race || ""),
    role: stripLinks(roleMatch?.[1] || ""),
    location: stripLinks(locationMatch?.[1] || ""),
    relationship: relationship || (fm["person-type"] === "pc" ? "Party member" : ""),
    description: desc || stripLinks(statusMatch?.[1] || "")
  });
  ok("NPC: " + name, "lore.npcs[]");
}

function parsePlace(content, file) {
  const fm = parseFrontmatter(content);
  const nameMatch = content.match(/^#\s+🗺️\s+(.+)$/m) || content.match(/^#\s+(.+)$/m);
  if (!nameMatch) return;
  const name = stripLinks(nameMatch[1]).trim();

  const descSection = extractSection(content, "Description") || extractSection(content, "Atmosphere");
  const desc = stripLinks(stripCallouts(descSection)).replace(/^#+.*/gm, "").trim().slice(0, 400);

  doc.lore.locations.push({
    id: "vault-loc-" + slug(name) + "-" + uuid().slice(0, 8),
    name, region: fm.region || "", type: fm["place-type"] || "", description: desc
  });
  ok("Location: " + name, "lore.locations[]");
}

function parseQuest(content, file) {
  const fm = parseFrontmatter(content);
  const nameMatch = content.match(/^#\s+(?:🧭\s+)?(.+)$/m);
  if (!nameMatch) return;
  const title = stripLinks(nameMatch[1]).replace(/\[\[.*?\]\]/g, m => m.replace(/.*\|(.+)\]\]/, "$1")).trim();

  const giverMatch = content.match(/\*\*Quest Giver:\*\*\s*(.+)/);
  const objSection = extractSection(content, "Objective") || extractSection(content, "Summary");
  const desc = stripLinks(stripCallouts(objSection)).replace(/^#+.*/gm, "").trim().slice(0, 500);

  const questObj = {
    id: "vault-quest-" + slug(title) + "-" + uuid().slice(0, 8),
    title, giver: stripLinks(giverMatch?.[1] || "Party"), status: fm.status || "active", reward: "", description: desc
  };

  if ((fm["quest-type"] || "").toLowerCase() === "side") {
    doc.lore.sideQuests.push(questObj);
    ok("Side Quest: " + title, "lore.sideQuests[]");
  } else {
    doc.lore.quests.push(questObj);
    ok("Quest: " + title, "lore.quests[]");
  }
}

function parseSession(content, file) {
  const fm = parseFrontmatter(content);
  const titleMatch = content.match(/^#\s+📅\s+(.+)$/m) || content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? stripLinks(titleMatch[1]).trim() : path.basename(file, ".md");

  const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/);
  const whatSection = extractSection(content, "What Happened");
  const notes = stripLinks(stripCallouts(whatSection)).replace(/^#+.*/gm, "").trim().slice(0, 1000);

  doc.sessionLog.push({
    id: "vault-session-" + uuid().slice(0, 8),
    date: dateMatch?.[1]?.trim() || fm["session-date"] || "",
    sessionNumber: parseInt(fm["session-number"]) || 0,
    title, notes
  });
  ok("Session: " + title, "sessionLog[]");
}

function parseLore(content, file) {
  const fm = parseFrontmatter(content);
  const loreType = (fm["lore-type"] || "").toLowerCase();

  if (loreType === "history") {
    const nameMatch = content.match(/^#\s+📜\s+(.+)$/m) || content.match(/^#\s+(.+)$/m);
    const cleaned = stripLinks(stripCallouts(content.replace(/^---[\s\S]*?---/, "").replace(/^#+.*/gm, h => "\n" + h))).trim();
    doc.lore.history = (doc.lore.history ? doc.lore.history + "\n\n" : "") + cleaned.slice(0, 3000);
    ok("History prose (" + (nameMatch?.[1] || path.basename(file)) + ")", "lore.history");
  } else if (loreType === "factions") {
    // Each ## section is an organization
    const orgBlocks = content.split(/\n## /);
    for (let i = 1; i < orgBlocks.length; i++) {
      const block = orgBlocks[i];
      const nameMatch = block.match(/^(.+)/);
      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/[⚔️🏰🐊⛵🌑]+\s*/u, "").trim();
      if (!name || name.length < 2) continue;
      if (/related|🔗/i.test(name)) continue;
      const leaderMatch = block.match(/\*\*Leader:\*\*\s*(.+)/);
      const typeMatch = block.match(/\*\*Type:\*\*\s*(.+)/);
      const desc = stripLinks(stripCallouts(block.split("\n").slice(2).join("\n"))).trim().slice(0, 400);
      doc.lore.organizations.push({
        id: "vault-org-" + slug(name) + "-" + uuid().slice(0, 8),
        name, leader: stripLinks(leaderMatch?.[1] || ""), allegiance: stripLinks(typeMatch?.[1] || ""), description: desc
      });
      ok("Faction: " + name, "lore.organizations[]");
    }
  } else if (loreType === "gods") {
    const godBlocks = content.split(/\n## /);
    for (let i = 1; i < godBlocks.length; i++) {
      const block = godBlocks[i];
      const nameMatch = block.match(/^(.+)/);
      if (!nameMatch) continue;
      // Strip leading emoji and check for section names to skip
      const name = nameMatch[1].replace(/^[^\w(]+/, "").trim();
      if (!name || name.length < 2) continue;
      if (/related|🔗/i.test(name)) continue;
      const domainMatch = block.match(/\*\*Domain:\*\*\s*(.+)/);
      const alignMatch = block.match(/\*\*Alignment:\*\*\s*(.+)/);
      const desc = stripLinks(block.split("\n").slice(1).filter(l => !l.startsWith("**")).join("\n")).trim().slice(0, 300);
      doc.lore.deities.push({
        id: "vault-deity-" + slug(name) + "-" + uuid().slice(0, 8),
        name, domain: domainMatch?.[1] || "", alignment: alignMatch?.[1] || "", symbol: "", description: desc
      });
      ok("Deity: " + name, "lore.deities[]");
    }
  } else {
    // Default: worldLore
    const cleaned = stripLinks(stripCallouts(content.replace(/^---[\s\S]*?---/, ""))).trim();
    doc.lore.worldLore = (doc.lore.worldLore ? doc.lore.worldLore + "\n\n" : "") + cleaned.slice(0, 3000);
    ok("World Lore prose (" + path.basename(file) + ")", "lore.worldLore");
  }
}

// ── Process files ─────────────────────────────────────────────────────────────

const TEMPLATE_NAMES = ["npc template", "place template", "session template", "template"];

for (const file of mdFiles) {
  const rel = path.relative(vaultPath, file);
  const basename = path.basename(file, ".md").toLowerCase();

  if (TEMPLATE_NAMES.some(t => basename.includes(t))) { skip(file, "Template file — skipped"); continue; }
  if (basename.includes("ai recap") || basename.includes("raw")) { skip(file, "Duplicate/raw session file — skipped"); continue; }
  if (basename === "resources") { skip(file, "External links only — not character data"); continue; }

  const content = fs.readFileSync(file, "utf8");
  const fm = parseFrontmatter(content);
  const noteType = (fm["note-type"] || "").toLowerCase();
  const subtype  = (fm.subtype || "").toLowerCase();

  if (noteType === "dashboard" || basename === "home") { parseDashboard(content, file); }
  else if (noteType === "character" && subtype === "stats") { parseStats(content, file); }
  else if (noteType === "character" && subtype === "spells") { parseSpells(content, file); }
  else if (noteType === "character" && subtype === "inventory") { parseInventory(content, file); }
  else if (noteType === "character" && (subtype === "feats-traits" || subtype === "feats")) { parseFeats(content, file); }
  else if (noteType === "character" && subtype === "languages") { parseLanguages(content, file); }
  else if (noteType === "character") { skip(file, "Unknown character subtype: " + subtype); }
  else if (noteType === "person") { parsePerson(content, file); }
  else if (noteType === "place") { parsePlace(content, file); }
  else if (noteType === "quest") { parseQuest(content, file); }
  else if (noteType === "session") { parseSession(content, file); }
  else if (noteType === "lore") { parseLore(content, file); }
  else { skip(file, "No recognised note-type in frontmatter (found: \"" + (fm["note-type"] || "") + "\")"); }
}

// Handle portrait PNGs
for (const f of allFiles.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))) {
  skip(f, "Portrait image — import manually in the sheet's Identity section (drag or paste)");
}
// Handle .base files
for (const f of allFiles.filter(f => f.endsWith(".base"))) {
  skip(f, "Obsidian Bases file (.base) — not a markdown document");
}

// ── Output ────────────────────────────────────────────────────────────────────

const characterName = doc.identity.name;
const outFile = outputPath || path.join(vaultPath, slug(characterName) + ".grimoire.json");
fs.writeFileSync(outFile, JSON.stringify(doc, null, 2), "utf8");

// Log to stderr
console.error("\n══════════════════════════════════════════════");
console.error(`  GRIMOIRE VAULT IMPORT — ${characterName}`);
console.error("══════════════════════════════════════════════\n");
console.error(`✅  IMPORTED (${imported.length} items)\n`);
for (const { what, where } of imported) {
  console.error(`  ✅  ${what}`);
  console.error(`       → ${where}`);
}
console.error(`\n⚠️  NOT IMPORTED (${skipped.length} items)\n`);
for (const { file: f, reason } of skipped) {
  console.error(`  ⚠️  ${f}`);
  console.error(`       ${reason}`);
}
console.error(`\n📄  Output: ${outFile}`);
console.error("\n══════════════════════════════════════════════\n");
