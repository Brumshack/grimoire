// SRD 5.1 races (OGL).
// speed in feet.

export const RACES = {
  dwarf: {
    id: "dwarf", name: "Dwarf", size: "Medium", speed: 25,
    abilityBonuses: { con: 2 },
    languages: ["common", "dwarvish"],
    darkvision: 60,
    proficiencies: { weapons: ["battleaxe","handaxe","light-hammer","warhammer"] },
    traits: [
      { name: "Dwarven Resilience", desc: "Advantage on saves vs. poison; resistance to poison damage." },
      { name: "Stonecunning", desc: "Whenever you make an Int (History) check related to the origin of stonework, double your proficiency bonus." },
      { name: "Dwarven Combat Training", desc: "Proficiency with the battleaxe, handaxe, light hammer, and warhammer." }
    ],
    subraces: [
      {
        id: "hill-dwarf", name: "Hill Dwarf",
        abilityBonuses: { wis: 1 },
        traits: [
          { name: "Dwarven Toughness", desc: "Your hit point maximum increases by 1, and it increases by 1 every time you gain a level." }
        ]
      }
    ]
  },
  elf: {
    id: "elf", name: "Elf", size: "Medium", speed: 30,
    abilityBonuses: { dex: 2 },
    languages: ["common", "elvish"],
    darkvision: 60,
    proficiencies: { skills: ["perception"] },
    traits: [
      { name: "Fey Ancestry", desc: "Advantage on saves vs. being charmed; magic can't put you to sleep." },
      { name: "Trance", desc: "Elves don't need to sleep. They meditate deeply for 4 hours a day. This is the equivalent of a long rest." }
    ],
    subraces: [
      {
        id: "high-elf", name: "High Elf",
        abilityBonuses: { int: 1 },
        languages: [ /* one extra of choice */ ],
        proficiencies: { weapons: ["longsword","shortsword","shortbow","longbow"] },
        traits: [
          { name: "Elf Weapon Training", desc: "Proficiency with longsword, shortsword, shortbow, and longbow." },
          { name: "Cantrip", desc: "Know one cantrip of your choice from the wizard spell list. INT is your spellcasting ability." },
          { name: "Extra Language", desc: "Learn one extra language of your choice." }
        ]
      }
    ]
  },
  halfling: {
    id: "halfling", name: "Halfling", size: "Small", speed: 25,
    abilityBonuses: { dex: 2 },
    languages: ["common","halfling"],
    traits: [
      { name: "Lucky", desc: "When you roll a 1 on the d20 for an attack, ability check, or saving throw, reroll and use the new roll." },
      { name: "Brave", desc: "Advantage on saving throws against being frightened." },
      { name: "Halfling Nimbleness", desc: "You can move through the space of any creature that is of a size larger than yours." }
    ],
    subraces: [
      {
        id: "lightfoot-halfling", name: "Lightfoot Halfling",
        abilityBonuses: { cha: 1 },
        traits: [
          { name: "Naturally Stealthy", desc: "You can attempt to hide even when obscured only by a creature at least one size larger than you." }
        ]
      }
    ]
  },
  human: {
    id: "human", name: "Human", size: "Medium", speed: 30,
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    languages: ["common" /* + 1 extra */],
    traits: [
      { name: "Extra Language", desc: "Learn one extra language of your choice." }
    ],
    subraces: []
  },
  dragonborn: {
    id: "dragonborn", name: "Dragonborn", size: "Medium", speed: 30,
    abilityBonuses: { str: 2, cha: 1 },
    languages: ["common","draconic"],
    traits: [
      { name: "Draconic Ancestry", desc: "Choose one type of dragon; this determines your breath weapon and damage resistance." },
      { name: "Breath Weapon", desc: "You can use your action to exhale destructive energy. DEX or CON save (determined by ancestry). Damage = 2d6, increasing with level." },
      { name: "Damage Resistance", desc: "Resistance to the damage type associated with your draconic ancestry." }
    ],
    subraces: []
  },
  gnome: {
    id: "gnome", name: "Gnome", size: "Small", speed: 25,
    abilityBonuses: { int: 2 },
    languages: ["common","gnomish"],
    darkvision: 60,
    traits: [
      { name: "Gnome Cunning", desc: "Advantage on all INT, WIS, and CHA saving throws against magic." }
    ],
    subraces: [
      {
        id: "rock-gnome", name: "Rock Gnome",
        abilityBonuses: { con: 1 },
        proficiencies: { tools: ["tinkers-tools"] },
        traits: [
          { name: "Artificer's Lore", desc: "When you make an INT (History) check related to magic items, alchemical objects, or technological devices, double your proficiency bonus." },
          { name: "Tinker", desc: "Proficient with tinker's tools. You can spend 1 hour and 10 gp to construct a Tiny clockwork device." }
        ]
      }
    ]
  },
  "half-elf": {
    id: "half-elf", name: "Half-Elf", size: "Medium", speed: 30,
    abilityBonuses: { cha: 2 /* + two other +1s of choice */ },
    languages: ["common","elvish" /* + 1 of choice */],
    darkvision: 60,
    traits: [
      { name: "Fey Ancestry", desc: "Advantage on saves vs. being charmed; magic can't put you to sleep." },
      { name: "Skill Versatility", desc: "Proficiency in any two skills of your choice." },
      { name: "Ability Score Choice", desc: "Choose two different ability scores (other than Charisma) to increase by 1." }
    ],
    subraces: []
  },
  "half-orc": {
    id: "half-orc", name: "Half-Orc", size: "Medium", speed: 30,
    abilityBonuses: { str: 2, con: 1 },
    languages: ["common","orc"],
    darkvision: 60,
    proficiencies: { skills: ["intimidation"] },
    traits: [
      { name: "Relentless Endurance", desc: "When reduced to 0 HP (not killed outright), you can drop to 1 HP instead. Once per long rest." },
      { name: "Savage Attacks", desc: "On a critical hit with a melee weapon attack, roll one extra damage die." }
    ],
    subraces: []
  },
  tiefling: {
    id: "tiefling", name: "Tiefling", size: "Medium", speed: 30,
    abilityBonuses: { cha: 2, int: 1 },
    languages: ["common","infernal"],
    darkvision: 60,
    traits: [
      { name: "Hellish Resistance", desc: "Resistance to fire damage." },
      { name: "Infernal Legacy", desc: "Know thaumaturgy. At 3rd level cast hellish rebuke once per long rest; at 5th level cast darkness once per long rest. CHA is your spellcasting ability." }
    ],
    subraces: []
  }
};

export function listRaces() {
  const out = [];
  for (const r of Object.values(RACES)) {
    if (r.subraces && r.subraces.length) {
      for (const s of r.subraces) {
        out.push({
          id: `${r.id}:${s.id}`,
          raceId: r.id,
          subraceId: s.id,
          name: s.name,
          fullName: s.name,
          speed: r.speed,
          size: r.size
        });
      }
    } else {
      out.push({
        id: r.id,
        raceId: r.id,
        subraceId: null,
        name: r.name,
        fullName: r.name,
        speed: r.speed,
        size: r.size
      });
    }
  }
  return out;
}

/** Combined traits/bonuses for race + subrace. */
export function resolveRace(raceId, subraceId) {
  const race = RACES[raceId];
  if (!race) return null;
  const sub = subraceId ? (race.subraces || []).find(s => s.id === subraceId) : null;

  const abilityBonuses = { ...(race.abilityBonuses || {}) };
  if (sub?.abilityBonuses) {
    for (const [k, v] of Object.entries(sub.abilityBonuses)) {
      abilityBonuses[k] = (abilityBonuses[k] || 0) + v;
    }
  }
  const languages = Array.from(new Set([...(race.languages || []), ...((sub?.languages) || [])]));
  const traits = [...(race.traits || []), ...((sub?.traits) || [])];

  const proficiencies = { ...(race.proficiencies || {}) };
  if (sub?.proficiencies) {
    for (const [k, v] of Object.entries(sub.proficiencies)) {
      proficiencies[k] = Array.from(new Set([...(proficiencies[k] || []), ...v]));
    }
  }

  return {
    raceId, subraceId,
    name: sub ? sub.name : race.name,
    fullName: sub ? `${race.name} (${sub.name})` : race.name,
    size: race.size,
    speed: race.speed,
    darkvision: race.darkvision || 0,
    abilityBonuses,
    languages,
    traits,
    proficiencies
  };
}
