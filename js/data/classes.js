// SRD 5.1 classes (OGL). One subclass each (the only one released in the SRD).
// Structure:
//   id, name, hitDie: 6|8|10|12
//   savingThrows: [abilityKeys]
//   proficiencies: { armor:[], weapons:[], tools:[] }
//   skillChoices: { count, options: [skillId] }
//   spellcasting: { ability, progression: "full"|"half"|"pact"|null, preparedFormula?: (char) => n }
//   features: [{ level, name, desc, subclassOnly?, kind? }]
//   subclasses: [{ id, name, level, features }]
//
// `features` lists features gained at each level. UI auto-populates based on current level.

const c = (o) => Object.freeze(o);

export const CLASSES = {
  barbarian: c({
    id: "barbarian", name: "Barbarian", hitDie: 12,
    savingThrows: ["str","con"],
    proficiencies: {
      armor: ["light","medium","shields"],
      weapons: ["simple","martial"],
      tools: []
    },
    skillChoices: { count: 2, options: ["animal-handling","athletics","intimidation","nature","perception","survival"] },
    spellcasting: null,
    startingEquipment: [
      "Greataxe or any martial melee weapon",
      "Two handaxes or any simple weapon",
      "Explorer's pack and four javelins"
    ],
    features: [
      { level: 1, name: "Rage", desc: "In battle, you fight with primal ferocity. As a bonus action you can enter a rage for up to 1 minute, gaining advantage on STR checks and saves, +2 damage on STR melee attacks, and resistance to bludgeoning/piercing/slashing damage. Uses scale with level." },
      { level: 1, name: "Unarmored Defense", desc: "While not wearing armor, your AC = 10 + DEX mod + CON mod. A shield is allowed." },
      { level: 2, name: "Reckless Attack", desc: "On your first attack on a turn, gain advantage on melee STR weapon attack rolls. Attack rolls against you have advantage until your next turn." },
      { level: 2, name: "Danger Sense", desc: "Advantage on DEX saves against effects you can see while not blinded, deafened, or incapacitated." },
      { level: 3, name: "Primal Path", desc: "Choose a primal path that shapes your rage." },
      { level: 5, name: "Extra Attack", desc: "You can attack twice whenever you take the Attack action." },
      { level: 5, name: "Fast Movement", desc: "Your walking speed increases by 10 feet while not wearing heavy armor." },
      { level: 7, name: "Feral Instinct", desc: "Advantage on initiative. If you're surprised at the start of combat, you can still act normally on your first turn if you enter a rage first." },
      { level: 9, name: "Brutal Critical", desc: "Roll one additional weapon damage die when determining damage for a critical hit with a melee attack (more at 13, 17)." },
      { level: 11, name: "Relentless Rage", desc: "If rage isn't ended and you drop to 0 HP but aren't killed outright, you can make a DC 10 CON save (increasing by 5 each time) to drop to 1 HP instead." }
    ],
    subclasses: [{
      id: "berserker", name: "Path of the Berserker", level: 3,
      features: [
        { level: 3, name: "Frenzy", desc: "Optionally go into a frenzy on rage; you can make a single melee weapon attack as a bonus action each turn. Gain one level of exhaustion when frenzy ends." },
        { level: 6, name: "Mindless Rage", desc: "You can't be charmed or frightened while raging." },
        { level: 10, name: "Intimidating Presence", desc: "Action: target creature within 30 ft must make a WIS save (DC 8 + prof + CHA) or be frightened of you for 1 minute." },
        { level: 14, name: "Retaliation", desc: "When damaged by a creature within 5 ft, you can use your reaction to make a melee weapon attack against that creature." }
      ]
    }]
  }),

  bard: c({
    id: "bard", name: "Bard", hitDie: 8,
    savingThrows: ["dex","cha"],
    proficiencies: {
      armor: ["light"],
      weapons: ["simple","hand-crossbows","longswords","rapiers","shortswords"],
      tools: ["three-musical-instruments-of-choice"]
    },
    skillChoices: { count: 3, options: Object.keys({
      acrobatics:1,"animal-handling":1,arcana:1,athletics:1,deception:1,history:1,insight:1,intimidation:1,
      investigation:1,medicine:1,nature:1,perception:1,performance:1,persuasion:1,religion:1,
      "sleight-of-hand":1,stealth:1,survival:1
    }) },
    spellcasting: {
      ability: "cha", progression: "full",
      kind: "known",
      cantripsKnownByLevel: [0,2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
      spellsKnownByLevel:   [0,4,5,6,7,8,9,10,11,12,14,15,15,16,18,19,19,20,22,22,22]
    },
    startingEquipment: [
      "Rapier, longsword, or any simple weapon",
      "Diplomat's pack or entertainer's pack",
      "Lute or any other musical instrument",
      "Leather armor and a dagger"
    ],
    features: [
      { level: 1, name: "Bardic Inspiration (d6)", desc: "Bonus action: target one creature within 60 ft. that can hear you. It gains one Bardic Inspiration die (d6) to add to one ability check, attack roll, or saving throw within 10 minutes. Uses = CHA modifier (min 1), recover on long rest (short rest at 5th)." },
      { level: 1, name: "Spellcasting", desc: "You cast bard spells. CHA is your spellcasting ability." },
      { level: 2, name: "Jack of All Trades", desc: "Add half your proficiency bonus (rounded down) to any ability check you make that doesn't already include your proficiency bonus." },
      { level: 2, name: "Song of Rest (d6)", desc: "During a short rest, you and friendly creatures regaining HP by spending hit dice regain extra HP (d6, scales with level)." },
      { level: 3, name: "Bard College", desc: "Choose a bard college." },
      { level: 3, name: "Expertise", desc: "Choose two of your skill proficiencies; your proficiency bonus is doubled for any check using those skills." },
      { level: 5, name: "Bardic Inspiration (d8)", desc: "Your Bardic Inspiration die is a d8. You recover all expended uses on a short or long rest." },
      { level: 5, name: "Font of Inspiration", desc: "You regain all expended uses of Bardic Inspiration on a short rest." },
      { level: 6, name: "Countercharm", desc: "Action: start a performance that lasts until the end of your next turn. Friendly creatures within 30 ft that can hear you have advantage on saves against being frightened or charmed." },
      { level: 10, name: "Bardic Inspiration (d10)", desc: "Your Bardic Inspiration die becomes a d10." },
      { level: 10, name: "Expertise (second)", desc: "Choose another two skill proficiencies for Expertise." },
      { level: 10, name: "Magical Secrets", desc: "Choose two spells from any class's spell list. They count as bard spells for you." }
    ],
    subclasses: [{
      id: "lore", name: "College of Lore", level: 3,
      features: [
        { level: 3, name: "Bonus Proficiencies", desc: "Proficiency with three skills of your choice." },
        { level: 3, name: "Cutting Words", desc: "Reaction: expend one use of Bardic Inspiration to subtract the rolled die from a creature's attack, ability check, or damage roll within 60 ft." },
        { level: 6, name: "Additional Magical Secrets", desc: "Learn two spells of your choice from any class. They count as bard spells." },
        { level: 14, name: "Peerless Skill", desc: "On an ability check, you can expend one use of Bardic Inspiration to add the rolled die to the check." }
      ]
    }]
  }),

  cleric: c({
    id: "cleric", name: "Cleric", hitDie: 8,
    savingThrows: ["wis","cha"],
    proficiencies: {
      armor: ["light","medium","shields"],
      weapons: ["simple"],
      tools: []
    },
    skillChoices: { count: 2, options: ["history","insight","medicine","persuasion","religion"] },
    spellcasting: {
      ability: "wis", progression: "full",
      kind: "prepared",
      preparedFormula: (char, mod, level) => Math.max(1, mod + level),
      cantripsKnownByLevel: [0,3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5]
    },
    startingEquipment: [
      "Mace or warhammer (if proficient)",
      "Scale mail, leather armor, or chain mail (if proficient)",
      "Light crossbow and 20 bolts, or any simple weapon",
      "Priest's pack or explorer's pack",
      "Shield and a holy symbol"
    ],
    features: [
      { level: 1, name: "Spellcasting", desc: "Cast cleric spells prepared each morning. WIS is your spellcasting ability." },
      { level: 1, name: "Divine Domain", desc: "Choose a domain that grants bonus spells and features." },
      { level: 2, name: "Channel Divinity (1/rest)", desc: "Use one Channel Divinity option per short or long rest. Base option: Turn Undead." },
      { level: 5, name: "Destroy Undead (CR 1/2)", desc: "When undead fail their save vs. Turn Undead, low-CR undead are destroyed. Threshold improves with level." },
      { level: 6, name: "Channel Divinity (2/rest)", desc: "You can use your Channel Divinity twice between rests." },
      { level: 8, name: "Divine Strike / Potent Spellcasting", desc: "Domain feature at 8th level." },
      { level: 10, name: "Divine Intervention", desc: "Action: implore your deity's aid. Roll percentile; if ≤ your cleric level, your deity intervenes. Cannot be used again for 7 days if successful, 1 day if not." },
      { level: 18, name: "Channel Divinity (3/rest)", desc: "You can use your Channel Divinity three times between rests." }
    ],
    subclasses: [{
      id: "life-domain", name: "Life Domain", level: 1,
      features: [
        { level: 1, name: "Heavy Armor Proficiency", desc: "Gain proficiency with heavy armor." },
        { level: 1, name: "Disciple of Life", desc: "Healing spells you cast restore additional HP = 2 + the spell's level." },
        { level: 2, name: "Channel Divinity: Preserve Life", desc: "Use Channel Divinity to restore HP = 5 × your cleric level among creatures within 30 ft (divided as you choose)." },
        { level: 6, name: "Blessed Healer", desc: "Healing spells you cast on others heal you for 2 + the spell's level." },
        { level: 8, name: "Divine Strike", desc: "1/turn when you hit with a weapon attack, deal an extra 1d8 radiant damage (2d8 at 14th)." },
        { level: 17, name: "Supreme Healing", desc: "When you normally roll dice to restore HP with a spell, use the maximum number possible instead." }
      ]
    }]
  }),

  druid: c({
    id: "druid", name: "Druid", hitDie: 8,
    savingThrows: ["int","wis"],
    proficiencies: {
      armor: ["light","medium","shields"],
      weapons: ["clubs","daggers","darts","javelins","maces","quarterstaffs","scimitars","sickles","slings","spears"],
      tools: ["herbalism-kit"]
    },
    skillChoices: { count: 2, options: ["arcana","animal-handling","insight","medicine","nature","perception","religion","survival"] },
    spellcasting: {
      ability: "wis", progression: "full",
      kind: "prepared",
      preparedFormula: (char, mod, level) => Math.max(1, mod + level),
      cantripsKnownByLevel: [0,2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4]
    },
    startingEquipment: [
      "Wooden shield or any simple weapon",
      "Scimitar or any simple melee weapon",
      "Leather armor, explorer's pack, and a druidic focus"
    ],
    features: [
      { level: 1, name: "Druidic", desc: "You know Druidic, the secret language of druids." },
      { level: 1, name: "Spellcasting", desc: "Cast druid spells; WIS is your spellcasting ability." },
      { level: 2, name: "Wild Shape", desc: "Action: transform into a beast you have seen. Limits scale with level. Usable twice per short/long rest." },
      { level: 2, name: "Druid Circle", desc: "Choose a druid circle." },
      { level: 18, name: "Timeless Body", desc: "You age more slowly; for every 10 years, your body ages only 1 year." },
      { level: 18, name: "Beast Spells", desc: "You can cast many of your druid spells in any shape you assume using Wild Shape." },
      { level: 20, name: "Archdruid", desc: "Unlimited Wild Shape uses. You can ignore the Verbal and Somatic components of druid spells." }
    ],
    subclasses: [{
      id: "land", name: "Circle of the Land", level: 2,
      features: [
        { level: 2, name: "Bonus Cantrip", desc: "Learn one additional druid cantrip of your choice." },
        { level: 2, name: "Natural Recovery", desc: "Once per day during a short rest, recover spell slots with total level ≤ half your druid level (rounded up)." },
        { level: 3, name: "Circle Spells", desc: "Your mystical connection to the land gives you access to circle spells." },
        { level: 6, name: "Land's Stride", desc: "Difficult terrain of nonmagical plants doesn't slow you. Advantage on saves vs. plants magically created." },
        { level: 10, name: "Nature's Ward", desc: "Immune to disease and poison; can't be charmed or frightened by elementals or fey." },
        { level: 14, name: "Nature's Sanctuary", desc: "Creatures of the beast or plant type attacking you must WIS save or choose a new target." }
      ]
    }]
  }),

  fighter: c({
    id: "fighter", name: "Fighter", hitDie: 10,
    savingThrows: ["str","con"],
    proficiencies: {
      armor: ["light","medium","heavy","shields"],
      weapons: ["simple","martial"],
      tools: []
    },
    skillChoices: { count: 2, options: ["acrobatics","animal-handling","athletics","history","insight","intimidation","perception","survival"] },
    spellcasting: null,
    startingEquipment: [
      "Chain mail or leather armor + longbow + 20 arrows",
      "A martial weapon and a shield, or two martial weapons",
      "Light crossbow + 20 bolts, or two handaxes",
      "Dungeoneer's pack or explorer's pack"
    ],
    features: [
      { level: 1, name: "Fighting Style", desc: "Choose a fighting style (Archery, Defense, Dueling, Great Weapon Fighting, Protection, Two-Weapon Fighting)." },
      { level: 1, name: "Second Wind", desc: "Bonus action: regain 1d10 + your fighter level HP. Recover on short or long rest." },
      { level: 2, name: "Action Surge", desc: "On your turn, take one additional action (and a possible bonus action). Once per short rest; twice at 17th." },
      { level: 3, name: "Martial Archetype", desc: "Choose a martial archetype." },
      { level: 5, name: "Extra Attack", desc: "Attack twice when you take the Attack action (three times at 11th, four at 20th)." },
      { level: 9, name: "Indomitable", desc: "Reroll a failed saving throw; must use the new roll. Once per long rest." },
      { level: 20, name: "Extra Attack (3)", desc: "Attack four times whenever you take the Attack action." }
    ],
    subclasses: [{
      id: "champion", name: "Champion", level: 3,
      features: [
        { level: 3, name: "Improved Critical", desc: "Your weapon attacks score a critical hit on a roll of 19 or 20." },
        { level: 7, name: "Remarkable Athlete", desc: "Add half your proficiency bonus (rounded up) to STR, DEX, or CON checks that don't already use your proficiency bonus. Your running long jump distance increases by your STR modifier." },
        { level: 10, name: "Additional Fighting Style", desc: "Choose a second option from the Fighting Style class feature." },
        { level: 15, name: "Superior Critical", desc: "Your weapon attacks score a critical hit on a roll of 18–20." },
        { level: 18, name: "Survivor", desc: "At the start of each of your turns, if you have no more than half your HP and at least 1 HP, regain 5 + your CON modifier HP." }
      ]
    }]
  }),

  monk: c({
    id: "monk", name: "Monk", hitDie: 8,
    savingThrows: ["str","dex"],
    proficiencies: {
      armor: [],
      weapons: ["simple","shortswords"],
      tools: ["one-artisans-tool-or-musical-instrument-of-choice"]
    },
    skillChoices: { count: 2, options: ["acrobatics","athletics","history","insight","religion","stealth"] },
    spellcasting: null,
    startingEquipment: [
      "Shortsword or any simple weapon",
      "Dungeoneer's pack or explorer's pack",
      "10 darts"
    ],
    features: [
      { level: 1, name: "Unarmored Defense", desc: "While not wearing armor or using a shield, your AC = 10 + DEX mod + WIS mod." },
      { level: 1, name: "Martial Arts", desc: "You can use DEX for attack and damage with unarmed strikes and monk weapons; roll a d4 in place of normal damage (scales). Make one unarmed strike as a bonus action when you Attack." },
      { level: 2, name: "Ki", desc: "You have ki points equal to your monk level. Fuels Flurry of Blows, Patient Defense, and Step of the Wind." },
      { level: 2, name: "Unarmored Movement", desc: "Your speed increases by 10 ft while not wearing armor or using a shield (scales with level)." },
      { level: 3, name: "Monastic Tradition", desc: "Choose a monastic tradition." },
      { level: 3, name: "Deflect Missiles", desc: "Reaction: reduce damage from a ranged weapon attack by 1d10 + DEX mod + monk level." },
      { level: 4, name: "Slow Fall", desc: "Reaction when falling: reduce falling damage by 5 × your monk level." },
      { level: 5, name: "Extra Attack", desc: "Attack twice whenever you take the Attack action." },
      { level: 5, name: "Stunning Strike", desc: "Once per turn when you hit with a melee weapon attack, spend 1 ki to attempt to stun the target (CON save)." },
      { level: 7, name: "Evasion", desc: "On a successful DEX save for half damage, take no damage. On a failure, take only half." },
      { level: 7, name: "Stillness of Mind", desc: "Action: end one effect on yourself causing you to be charmed or frightened." },
      { level: 10, name: "Purity of Body", desc: "Immune to disease and poison." },
      { level: 14, name: "Diamond Soul", desc: "Proficiency in all saving throws. Spend 1 ki to reroll a failed save." },
      { level: 15, name: "Timeless Body", desc: "No longer need food or water, and you age more slowly." },
      { level: 18, name: "Empty Body", desc: "Spend 4 ki to become invisible for 1 minute. Spend 8 ki to cast astral projection." },
      { level: 20, name: "Perfect Self", desc: "Regain 4 ki on initiative if you have none remaining." }
    ],
    subclasses: [{
      id: "open-hand", name: "Way of the Open Hand", level: 3,
      features: [
        { level: 3, name: "Open Hand Technique", desc: "When you hit a creature with Flurry of Blows, impose one: DEX save or knock prone; STR save or push 15 ft; can't take reactions until end of your next turn." },
        { level: 6, name: "Wholeness of Body", desc: "Action: regain HP = 3 × your monk level. Once per long rest." },
        { level: 11, name: "Tranquility", desc: "At end of a long rest, gain effect like sanctuary until next long rest. DC = 8 + WIS + prof." },
        { level: 17, name: "Quivering Palm", desc: "Spend 3 ki to set vibrations in a creature you hit. Action: end them; CON save or drop to 0 HP (half damage on success)." }
      ]
    }]
  }),

  paladin: c({
    id: "paladin", name: "Paladin", hitDie: 10,
    savingThrows: ["wis","cha"],
    proficiencies: {
      armor: ["light","medium","heavy","shields"],
      weapons: ["simple","martial"],
      tools: []
    },
    skillChoices: { count: 2, options: ["athletics","insight","intimidation","medicine","persuasion","religion"] },
    spellcasting: {
      ability: "cha", progression: "half",
      kind: "prepared",
      preparedFormula: (char, mod, level) => Math.max(1, mod + Math.floor(level / 2))
    },
    startingEquipment: [
      "Martial weapon + shield, or two martial weapons",
      "Five javelins or any simple melee weapon",
      "Priest's pack or explorer's pack",
      "Chain mail and a holy symbol"
    ],
    features: [
      { level: 1, name: "Divine Sense", desc: "Action: until end of next turn, know the location of celestials, fiends, and undead within 60 ft that aren't behind total cover. 1 + CHA mod uses per long rest." },
      { level: 1, name: "Lay on Hands", desc: "Healing pool of HP = 5 × paladin level. Spend as an action to heal or cure disease/poison." },
      { level: 2, name: "Fighting Style", desc: "Choose a fighting style (Defense, Dueling, Great Weapon Fighting, Protection)." },
      { level: 2, name: "Spellcasting", desc: "Cast paladin spells; CHA is your spellcasting ability." },
      { level: 2, name: "Divine Smite", desc: "When you hit with a melee weapon attack, expend one spell slot to deal extra radiant damage (2d8 + 1d8 per slot level above 1, max 5d8; +1d8 vs. undead/fiends)." },
      { level: 3, name: "Divine Health", desc: "Immune to disease." },
      { level: 3, name: "Sacred Oath", desc: "Choose a sacred oath." },
      { level: 5, name: "Extra Attack", desc: "Attack twice when you take the Attack action." },
      { level: 6, name: "Aura of Protection", desc: "Within 10 ft (30 ft at 18th), you and friendly creatures add your CHA mod (min +1) to saving throws." },
      { level: 10, name: "Aura of Courage", desc: "You and friendly creatures within aura can't be frightened while you're conscious." },
      { level: 11, name: "Improved Divine Smite", desc: "Melee weapon attacks deal an extra 1d8 radiant damage." },
      { level: 14, name: "Cleansing Touch", desc: "Action: end one spell on yourself or a willing creature you touch. Uses = CHA mod (min 1) per long rest." }
    ],
    subclasses: [{
      id: "devotion", name: "Oath of Devotion", level: 3,
      features: [
        { level: 3, name: "Channel Divinity", desc: "Two options: Sacred Weapon (bonus to attack = CHA), Turn the Unholy." },
        { level: 7, name: "Aura of Devotion", desc: "You and friendly creatures within aura can't be charmed while you're conscious." },
        { level: 15, name: "Purity of Spirit", desc: "Always protection from evil and good effect." },
        { level: 20, name: "Holy Nimbus", desc: "Action: aura of light, 30 ft, 1 minute. Enemies that start their turn in aura take 10 radiant. Advantage on saves vs. spells cast by fiends/undead." }
      ]
    }]
  }),

  ranger: c({
    id: "ranger", name: "Ranger", hitDie: 10,
    savingThrows: ["str","dex"],
    proficiencies: {
      armor: ["light","medium","shields"],
      weapons: ["simple","martial"],
      tools: []
    },
    skillChoices: { count: 3, options: ["animal-handling","athletics","insight","investigation","nature","perception","stealth","survival"] },
    spellcasting: {
      ability: "wis", progression: "half",
      kind: "known",
      cantripsKnownByLevel: Array(21).fill(0),
      spellsKnownByLevel: [0,0,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11]
    },
    startingEquipment: [
      "Scale mail or leather armor",
      "Two shortswords or two simple melee weapons",
      "Dungeoneer's pack or explorer's pack",
      "Longbow and a quiver of 20 arrows"
    ],
    features: [
      { level: 1, name: "Favored Enemy", desc: "Choose a type of favored enemy. Advantage on WIS (Survival) to track them and INT checks to recall info about them." },
      { level: 1, name: "Natural Explorer", desc: "Choose one type of favored terrain. While traveling there, gain bonuses to tracking and navigation." },
      { level: 2, name: "Fighting Style", desc: "Choose a fighting style (Archery, Defense, Dueling, Two-Weapon Fighting)." },
      { level: 2, name: "Spellcasting", desc: "Cast ranger spells; WIS is your spellcasting ability." },
      { level: 3, name: "Ranger Archetype", desc: "Choose a ranger archetype." },
      { level: 3, name: "Primeval Awareness", desc: "Action: spend one spell slot to sense whether certain creature types are within 1 mile (6 miles in favored terrain)." },
      { level: 5, name: "Extra Attack", desc: "Attack twice when you take the Attack action." },
      { level: 8, name: "Land's Stride", desc: "Move through nonmagical difficult terrain without cost. Advantage on saves vs. plants magically created." },
      { level: 10, name: "Hide in Plain Sight", desc: "Spend 1 minute creating camouflage. +10 to Stealth while you don't move or take actions." },
      { level: 14, name: "Vanish", desc: "Hide as a bonus action. Can't be tracked by nonmagical means." },
      { level: 18, name: "Feral Senses", desc: "When fighting creatures you can't see, no disadvantage on attacks. Aware of invisible creatures within 30 ft." },
      { level: 20, name: "Foe Slayer", desc: "Once per turn, add WIS mod to attack or damage roll vs. a favored enemy." }
    ],
    subclasses: [{
      id: "hunter", name: "Hunter", level: 3,
      features: [
        { level: 3, name: "Hunter's Prey", desc: "Choose one: Colossus Slayer, Giant Killer, or Horde Breaker." },
        { level: 7, name: "Defensive Tactics", desc: "Choose one: Escape the Horde, Multiattack Defense, or Steel Will." },
        { level: 11, name: "Multiattack", desc: "Choose one: Volley (AoE ranged) or Whirlwind Attack (AoE melee)." },
        { level: 15, name: "Superior Hunter's Defense", desc: "Choose one: Evasion, Stand Against the Tide, or Uncanny Dodge." }
      ]
    }]
  }),

  rogue: c({
    id: "rogue", name: "Rogue", hitDie: 8,
    savingThrows: ["dex","int"],
    proficiencies: {
      armor: ["light"],
      weapons: ["simple","hand-crossbows","longswords","rapiers","shortswords"],
      tools: ["thieves-tools"]
    },
    skillChoices: { count: 4, options: ["acrobatics","athletics","deception","insight","intimidation","investigation","perception","performance","persuasion","sleight-of-hand","stealth"] },
    spellcasting: null,
    startingEquipment: [
      "Rapier or shortsword",
      "Shortbow + quiver of 20 arrows, or shortsword",
      "Burglar's pack, dungeoneer's pack, or explorer's pack",
      "Leather armor, two daggers, and thieves' tools"
    ],
    features: [
      { level: 1, name: "Expertise", desc: "Choose two skill proficiencies (or one skill + thieves' tools). Proficiency bonus is doubled for those." },
      { level: 1, name: "Sneak Attack", desc: "1/turn, deal extra damage (1d6 at 1st, scaling to 10d6 at 19th) to one creature you hit with a finesse or ranged weapon, if you have advantage or an ally is adjacent to the target (and you don't have disadvantage)." },
      { level: 1, name: "Thieves' Cant", desc: "You know thieves' cant, a secret mix of dialect, jargon, and code." },
      { level: 2, name: "Cunning Action", desc: "Take a bonus action on each of your turns to Dash, Disengage, or Hide." },
      { level: 3, name: "Roguish Archetype", desc: "Choose a roguish archetype." },
      { level: 5, name: "Uncanny Dodge", desc: "Reaction when hit by an attacker you can see: halve the damage against you." },
      { level: 7, name: "Evasion", desc: "On a DEX save for half damage, take no damage on success and only half on failure." },
      { level: 11, name: "Reliable Talent", desc: "On ability checks using skills you're proficient in, treat a d20 roll of 9 or lower as a 10." },
      { level: 14, name: "Blindsense", desc: "If you can hear, you are aware of the location of any hidden or invisible creature within 10 ft." },
      { level: 15, name: "Slippery Mind", desc: "You gain proficiency in WIS saving throws." },
      { level: 18, name: "Elusive", desc: "No attack roll has advantage against you while you aren't incapacitated." },
      { level: 20, name: "Stroke of Luck", desc: "Turn a missed attack into a hit, or a failed ability check into a 20, once per short or long rest." }
    ],
    subclasses: [{
      id: "thief", name: "Thief", level: 3,
      features: [
        { level: 3, name: "Fast Hands", desc: "Use Cunning Action bonus action to make a DEX (Sleight of Hand) check, use thieves' tools, or take the Use an Object action." },
        { level: 3, name: "Second-Story Work", desc: "Climbing no longer costs extra movement. On a running jump, distance increases by DEX mod." },
        { level: 9, name: "Supreme Sneak", desc: "Advantage on Stealth checks if you move no more than half your speed on that turn." },
        { level: 13, name: "Use Magic Device", desc: "Ignore all class, race, and level requirements on the use of magic items." },
        { level: 17, name: "Thief's Reflexes", desc: "On first round of combat, take two turns: one at your initiative, one at initiative - 10." }
      ]
    }]
  }),

  sorcerer: c({
    id: "sorcerer", name: "Sorcerer", hitDie: 6,
    savingThrows: ["con","cha"],
    proficiencies: {
      armor: [],
      weapons: ["daggers","darts","slings","quarterstaffs","light-crossbows"],
      tools: []
    },
    skillChoices: { count: 2, options: ["arcana","deception","insight","intimidation","persuasion","religion"] },
    spellcasting: {
      ability: "cha", progression: "full",
      kind: "known",
      cantripsKnownByLevel: [0,4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6],
      spellsKnownByLevel:   [0,2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15]
    },
    startingEquipment: [
      "Light crossbow + 20 bolts, or any simple weapon",
      "Component pouch or arcane focus",
      "Dungeoneer's pack or explorer's pack",
      "Two daggers"
    ],
    features: [
      { level: 1, name: "Spellcasting", desc: "Cast sorcerer spells; CHA is your spellcasting ability." },
      { level: 1, name: "Sorcerous Origin", desc: "Choose a sorcerous origin (at level 1)." },
      { level: 2, name: "Font of Magic", desc: "Sorcery points = sorcerer level. Convert between spell slots and sorcery points." },
      { level: 3, name: "Metamagic", desc: "Learn two metamagic options. Learn one more at 10th and 17th." },
      { level: 20, name: "Sorcerous Restoration", desc: "Regain 4 sorcery points on a short rest." }
    ],
    subclasses: [{
      id: "draconic", name: "Draconic Bloodline", level: 1,
      features: [
        { level: 1, name: "Dragon Ancestor", desc: "Choose a dragon ancestor; learn Draconic and double proficiency on CHA checks with dragons." },
        { level: 1, name: "Draconic Resilience", desc: "HP max increases by 1 per sorcerer level. While not wearing armor, AC = 13 + DEX mod." },
        { level: 6, name: "Elemental Affinity", desc: "Add your CHA mod to damage of spells that deal your ancestor's element. Spend 1 sorcery point to gain resistance to that damage type for 1 hour." },
        { level: 14, name: "Dragon Wings", desc: "Bonus action: sprout wings, gaining flying speed equal to your walking speed." },
        { level: 18, name: "Draconic Presence", desc: "Action: spend 5 sorcery points to project an aura of awe or fear (30 ft) for 1 minute." }
      ]
    }]
  }),

  warlock: c({
    id: "warlock", name: "Warlock", hitDie: 8,
    savingThrows: ["wis","cha"],
    proficiencies: {
      armor: ["light"],
      weapons: ["simple"],
      tools: []
    },
    skillChoices: { count: 2, options: ["arcana","deception","history","intimidation","investigation","nature","religion"] },
    spellcasting: {
      ability: "cha", progression: "pact",
      kind: "known",
      cantripsKnownByLevel: [0,2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
      spellsKnownByLevel:   [0,2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15]
    },
    startingEquipment: [
      "Light crossbow + 20 bolts, or any simple weapon",
      "Component pouch or arcane focus",
      "Scholar's pack or dungeoneer's pack",
      "Leather armor, any simple weapon, and two daggers"
    ],
    features: [
      { level: 1, name: "Otherworldly Patron", desc: "Choose an otherworldly patron (at level 1)." },
      { level: 1, name: "Pact Magic", desc: "Cast spells through your pact. Spell slots are short-rest-recharging and always cast at the highest level you have available." },
      { level: 2, name: "Eldritch Invocations", desc: "Learn two eldritch invocations. More at higher levels." },
      { level: 3, name: "Pact Boon", desc: "Choose Pact of the Chain, Blade, or Tome." },
      { level: 11, name: "Mystic Arcanum (6th)", desc: "Choose one 6th-level spell you can cast once per long rest without using a spell slot." },
      { level: 13, name: "Mystic Arcanum (7th)", desc: "Choose one 7th-level spell you can cast once per long rest." },
      { level: 15, name: "Mystic Arcanum (8th)", desc: "Choose one 8th-level spell you can cast once per long rest." },
      { level: 17, name: "Mystic Arcanum (9th)", desc: "Choose one 9th-level spell you can cast once per long rest." },
      { level: 20, name: "Eldritch Master", desc: "Once per long rest, plead to your patron to recover all pact magic spell slots (1 minute activation)." }
    ],
    subclasses: [{
      id: "fiend", name: "The Fiend", level: 1,
      features: [
        { level: 1, name: "Dark One's Blessing", desc: "When you reduce a hostile creature to 0 HP, gain temporary HP = CHA mod + warlock level (min 1)." },
        { level: 6, name: "Dark One's Own Luck", desc: "Add 1d10 to an ability check or saving throw. Recharges on short/long rest." },
        { level: 10, name: "Fiendish Resilience", desc: "Choose one damage type after each short/long rest; resistant to it until next rest." },
        { level: 14, name: "Hurl Through Hell", desc: "When you hit a non-fiend creature with an attack, banish it to the Nine Hells for a round; it takes 10d10 psychic damage. Once per long rest." }
      ]
    }]
  }),

  wizard: c({
    id: "wizard", name: "Wizard", hitDie: 6,
    savingThrows: ["int","wis"],
    proficiencies: {
      armor: [],
      weapons: ["daggers","darts","slings","quarterstaffs","light-crossbows"],
      tools: []
    },
    skillChoices: { count: 2, options: ["arcana","history","insight","investigation","medicine","religion"] },
    spellcasting: {
      ability: "int", progression: "full",
      kind: "prepared-spellbook",
      preparedFormula: (char, mod, level) => Math.max(1, mod + level),
      cantripsKnownByLevel: [0,3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5]
    },
    startingEquipment: [
      "Quarterstaff or dagger",
      "Component pouch or arcane focus",
      "Scholar's pack or explorer's pack",
      "Spellbook"
    ],
    features: [
      { level: 1, name: "Spellcasting", desc: "Cast wizard spells prepared from your spellbook. INT is your spellcasting ability." },
      { level: 1, name: "Arcane Recovery", desc: "Once per day during a short rest, recover spell slots with combined level ≤ half your wizard level (rounded up). No slot above 5th." },
      { level: 2, name: "Arcane Tradition", desc: "Choose an arcane tradition." },
      { level: 18, name: "Spell Mastery", desc: "Choose a 1st-level and a 2nd-level wizard spell in your spellbook; cast them at their lowest level without using a slot." },
      { level: 20, name: "Signature Spells", desc: "Choose two 3rd-level wizard spells as signature spells; cast each once per short or long rest without using a slot." }
    ],
    subclasses: [{
      id: "evocation", name: "School of Evocation", level: 2,
      features: [
        { level: 2, name: "Evocation Savant", desc: "Gold and time needed to copy evocation spells into your spellbook is halved." },
        { level: 2, name: "Sculpt Spells", desc: "Protect friendly creatures from your evocation spells' effects. Choose up to 1 + spell level; they take no damage on a successful save (half if they fail)." },
        { level: 6, name: "Potent Cantrip", desc: "Creatures that succeed on a save against your damaging cantrips take half damage (but no other effect)." },
        { level: 10, name: "Empowered Evocation", desc: "Add your INT modifier to damage of one evocation spell you cast." },
        { level: 14, name: "Overchannel", desc: "When casting a wizard spell of 1st-5th level that deals damage, deal max damage. Using again before a long rest deals necrotic damage to yourself." }
      ]
    }]
  })
};

export const CLASS_IDS = Object.keys(CLASSES);

export function resolveClass(classId) {
  return CLASSES[classId] || null;
}

export function resolveSubclass(classId, subclassId) {
  const cls = CLASSES[classId];
  if (!cls) return null;
  return (cls.subclasses || []).find(s => s.id === subclassId) || null;
}

export function classFeaturesUpToLevel(classId, subclassId, level) {
  const cls = CLASSES[classId];
  if (!cls) return [];
  const out = cls.features.filter(f => f.level <= level).map(f => ({ ...f, source: `${cls.name}` }));
  const sub = subclassId ? resolveSubclass(classId, subclassId) : null;
  if (sub) {
    for (const f of sub.features) {
      if (f.level <= level) out.push({ ...f, source: `${cls.name} — ${sub.name}` });
    }
  }
  return out.sort((a,b) => a.level - b.level);
}
