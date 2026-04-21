export const CONDITIONS = {
  blinded: {
    id: "blinded", name: "Blinded",
    description: "A blinded creature can't see and automatically fails any ability check that requires sight. Attack rolls against the creature have advantage, and the creature's attack rolls have disadvantage."
  },
  charmed: {
    id: "charmed", name: "Charmed",
    description: "A charmed creature can't attack the charmer or target them with harmful abilities or magical effects. The charmer has advantage on social interaction checks with the charmed creature."
  },
  deafened: {
    id: "deafened", name: "Deafened",
    description: "A deafened creature can't hear and automatically fails any ability check that requires hearing."
  },
  frightened: {
    id: "frightened", name: "Frightened",
    description: "A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight. The creature can't willingly move closer to the source of its fear."
  },
  grappled: {
    id: "grappled", name: "Grappled",
    description: "A grappled creature's speed becomes 0, and it can't benefit from any bonus to its speed. The condition ends if the grappler is incapacitated, or if an effect removes the grappled creature from the grappler's reach."
  },
  incapacitated: {
    id: "incapacitated", name: "Incapacitated",
    description: "An incapacitated creature can't take actions or reactions."
  },
  invisible: {
    id: "invisible", name: "Invisible",
    description: "An invisible creature is impossible to see without the aid of magic or a special sense. For hiding, it is heavily obscured. Its location can be detected by noise or tracks. Attack rolls against it have disadvantage, and its attack rolls have advantage."
  },
  paralyzed: {
    id: "paralyzed", name: "Paralyzed",
    description: "A paralyzed creature is incapacitated and can't move or speak. It automatically fails STR and DEX saves. Attack rolls against it have advantage, and any attack that hits is a critical hit if the attacker is within 5 feet."
  },
  petrified: {
    id: "petrified", name: "Petrified",
    description: "A petrified creature is transformed into a solid inanimate substance. Its weight increases by a factor of ten, and it ceases aging. It is incapacitated, can't move or speak, and is unaware of surroundings. Attack rolls against it have advantage. It automatically fails STR and DEX saves. Resistance to all damage. Immune to poison and disease."
  },
  poisoned: {
    id: "poisoned", name: "Poisoned",
    description: "A poisoned creature has disadvantage on attack rolls and ability checks."
  },
  prone: {
    id: "prone", name: "Prone",
    description: "A prone creature's only movement option is to crawl unless it stands up. It has disadvantage on attack rolls. Melee attacks against it have advantage; ranged attacks have disadvantage."
  },
  restrained: {
    id: "restrained", name: "Restrained",
    description: "A restrained creature's speed becomes 0. Attack rolls against it have advantage, and its attack rolls have disadvantage. It has disadvantage on DEX saving throws."
  },
  stunned: {
    id: "stunned", name: "Stunned",
    description: "A stunned creature is incapacitated, can't move, and can speak only falteringly. It automatically fails STR and DEX saves. Attack rolls against it have advantage."
  },
  unconscious: {
    id: "unconscious", name: "Unconscious",
    description: "An unconscious creature is incapacitated, can't move or speak, and is unaware of its surroundings. It drops what it's holding and falls prone. It automatically fails STR and DEX saves. Attack rolls against it have advantage; any attack that hits is a critical hit if the attacker is within 5 feet."
  },
  exhaustion: {
    id: "exhaustion", name: "Exhaustion",
    description: "Six levels. 1: disadvantage on ability checks. 2: speed halved. 3: disadvantage on attack rolls and saving throws. 4: HP maximum halved. 5: speed reduced to 0. 6: death."
  }
};

export const DAMAGE_TYPES = [
  "acid","bludgeoning","cold","fire","force","lightning","necrotic",
  "piercing","poison","psychic","radiant","slashing","thunder"
];

export const LANGUAGES = {
  common: { id: "common", name: "Common", type: "standard", script: "Common" },
  dwarvish: { id: "dwarvish", name: "Dwarvish", type: "standard", script: "Dwarvish" },
  elvish: { id: "elvish", name: "Elvish", type: "standard", script: "Elvish" },
  giant: { id: "giant", name: "Giant", type: "standard", script: "Dwarvish" },
  gnomish: { id: "gnomish", name: "Gnomish", type: "standard", script: "Dwarvish" },
  goblin: { id: "goblin", name: "Goblin", type: "standard", script: "Dwarvish" },
  halfling: { id: "halfling", name: "Halfling", type: "standard", script: "Common" },
  orc: { id: "orc", name: "Orc", type: "standard", script: "Dwarvish" },
  abyssal: { id: "abyssal", name: "Abyssal", type: "exotic", script: "Infernal" },
  celestial: { id: "celestial", name: "Celestial", type: "exotic", script: "Celestial" },
  draconic: { id: "draconic", name: "Draconic", type: "exotic", script: "Draconic" },
  "deep-speech": { id: "deep-speech", name: "Deep Speech", type: "exotic", script: "—" },
  infernal: { id: "infernal", name: "Infernal", type: "exotic", script: "Infernal" },
  primordial: { id: "primordial", name: "Primordial", type: "exotic", script: "Dwarvish" },
  sylvan: { id: "sylvan", name: "Sylvan", type: "exotic", script: "Elvish" },
  undercommon: { id: "undercommon", name: "Undercommon", type: "exotic", script: "Elvish" }
};

export const SPELL_SCHOOLS = {
  abjuration: { id: "abjuration", name: "Abjuration" },
  conjuration: { id: "conjuration", name: "Conjuration" },
  divination: { id: "divination", name: "Divination" },
  enchantment: { id: "enchantment", name: "Enchantment" },
  evocation: { id: "evocation", name: "Evocation" },
  illusion: { id: "illusion", name: "Illusion" },
  necromancy: { id: "necromancy", name: "Necromancy" },
  transmutation: { id: "transmutation", name: "Transmutation" }
};
