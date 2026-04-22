import { uuid } from "../util/id.js";

export const SCHEMA_VERSION = 3;

export function blankCharacter(partial = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: partial.id || uuid(),
    createdAt: partial.createdAt || now,
    updatedAt: now,

    identity: {
      name: "New Adventurer",
      playerName: "",
      alignment: "TN",
      age: null,
      height: "",
      weight: "",
      eyes: "",
      hair: "",
      skin: "",
      gender: "",
      portraitDataUrl: null,
      ...(partial.identity || {})
    },

    progression: {
      classes: [{ classId: null, subclassId: null, level: 1, hitDieRolls: [] }],
      xp: 0,
      inspiration: false,
      ...(partial.progression || {})
    },

    race: { raceId: null, subraceId: null, ...(partial.race || {}) },
    background: { backgroundId: null, ...(partial.background || {}) },

    abilityScores: {
      base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      asiBonuses: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      override: {},
      ...(partial.abilityScores || {})
    },

    proficiencies: {
      skills: {},
      expertise: {},
      savingThrowsExtra: [],
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
      skillOverrides: {},
      saveOverrides: {},
      ...(partial.proficiencies || {})
    },

    combat: {
      maxHp: 1,
      currentHp: 1,
      tempHp: 0,
      hitDiceUsed: {},
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      speedBonus: 0,
      actionEconomy: { action: false, bonusAction: false, reaction: false },
      acOverride: null,
      initiativeOverride: null,
      initiativeBonus: 0,
      speedOverride: null,
      profBonusOverride: null,
      hitDieOverride: null,
      passiveOverrides: { perception: null, investigation: null, insight: null },
      customAttacks: [],
      attackOverrides: {},
      customActions: [],
      hitDiceExtra: 0,
      ...(partial.combat || {})
    },

    equipment: {
      items: [],
      currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      ...(partial.equipment || {})
    },

    spellcasting: {
      slotsUsed: {},
      pactSlotsUsed: 0,
      knownSpells: [],
      preparedSpells: [],
      spellbook: [],
      custom: [],
      saveDcOverride: null,
      attackOverride: null,
      abilityOverride: null,
      ...(partial.spellcasting || {})
    },

    features: {
      featIds: [],
      disabledFeatureIds: [],
      notes: {},
      custom: [],
      ...(partial.features || {})
    },

    lore: {
      backstory: "",
      personalityTraits: [],
      ideals: [],
      bonds: [],
      flaws: [],
      organizations: [],
      allies: [],
      deities: [],
      enemies: [],
      quests: [],
      locations: [],
      notes: "",
      ...(partial.lore || {})
    },

    party: partial.party || [],
    sessionLog: partial.sessionLog || [],

    settings: {
      hpLevelUpMethod: "average",
      autoSaveEnabled: true,
      ...(partial.settings || {})
    }
  };
}
