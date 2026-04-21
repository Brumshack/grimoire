export const PROFICIENCY_BY_LEVEL = [0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];

export function proficiencyBonus(totalLevel) {
  return Math.ceil(Math.max(1, totalLevel) / 4) + 1;
}

export const XP_THRESHOLDS = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

export function levelFromXp(xp) {
  let lv = 1;
  for (let i = 1; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) lv = i + 1;
  }
  return Math.min(lv, 20);
}

export const ASI_LEVELS = [4, 8, 12, 16, 19];
export function asiLevels(classId) {
  if (classId === "fighter") return [4, 6, 8, 12, 14, 16, 19];
  if (classId === "rogue") return [4, 8, 10, 12, 16, 19];
  return ASI_LEVELS;
}

export const CURRENCY_IN_GP = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

export function carryCapacity(str) {
  return {
    carry: str * 15,
    pushDragLift: str * 30,
    encumbered: str * 5,
    heavilyEncumbered: str * 10
  };
}

export const ABILITY_KEYS = ["str","dex","con","int","wis","cha"];
export const ABILITIES = {
  str: { name: "Strength", full: "Strength" },
  dex: { name: "Dexterity", full: "Dexterity" },
  con: { name: "Constitution", full: "Constitution" },
  int: { name: "Intelligence", full: "Intelligence" },
  wis: { name: "Wisdom", full: "Wisdom" },
  cha: { name: "Charisma", full: "Charisma" }
};

export function abilityMod(score) {
  return Math.floor(((score ?? 10) - 10) / 2);
}

export const ALIGNMENTS = [
  { id: "LG", name: "Lawful Good",  desc: "Acts as a good person is expected or required to act." },
  { id: "NG", name: "Neutral Good", desc: "Does the best to help others according to their needs." },
  { id: "CG", name: "Chaotic Good", desc: "Acts as conscience directs, with little regard for expectations." },
  { id: "LN", name: "Lawful Neutral",  desc: "Acts as law, tradition, or personal code directs." },
  { id: "TN", name: "True Neutral",    desc: "Does what seems like a good idea; avoids taking sides." },
  { id: "CN", name: "Chaotic Neutral", desc: "Follows whims; prizes freedom above all else." },
  { id: "LE", name: "Lawful Evil",    desc: "Takes what they want within the limits of tradition or loyalty." },
  { id: "NE", name: "Neutral Evil",   desc: "Does whatever they can get away with, without compassion." },
  { id: "CE", name: "Chaotic Evil",   desc: "Acts with arbitrary violence, spurred by greed, hatred, or bloodlust." }
];

export const SOURCE_SRD = "D&D 5e SRD 5.1 (OGL)";
