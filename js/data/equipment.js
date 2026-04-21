// SRD 5.1 equipment (OGL). Weight in lb, cost in gp.
// Weapon properties: finesse, light, heavy, two-handed, versatile(d#), thrown, ranged, ammunition, loading, reach, special, martial, simple.

const W = (o) => ({ type: "weapon", ...o });
const A = (o) => ({ type: "armor", ...o });
const G = (o) => ({ type: "gear", ...o });

export const ITEMS = {
  /* ===== Simple Melee ===== */
  "club":            W({ id: "club",            name: "Club",            cost: 0.1,  weight: 2,  damage: "1d4",  damageType: "bludgeoning", properties: ["light"], category: "simple-melee" }),
  "dagger":          W({ id: "dagger",          name: "Dagger",          cost: 2,    weight: 1,  damage: "1d4",  damageType: "piercing",    properties: ["finesse","light","thrown"], range: "20/60", category: "simple-melee" }),
  "greatclub":       W({ id: "greatclub",       name: "Greatclub",       cost: 0.2,  weight: 10, damage: "1d8",  damageType: "bludgeoning", properties: ["two-handed"], category: "simple-melee" }),
  "handaxe":         W({ id: "handaxe",         name: "Handaxe",         cost: 5,    weight: 2,  damage: "1d6",  damageType: "slashing",    properties: ["light","thrown"], range: "20/60", category: "simple-melee" }),
  "javelin":         W({ id: "javelin",         name: "Javelin",         cost: 0.5,  weight: 2,  damage: "1d6",  damageType: "piercing",    properties: ["thrown"], range: "30/120", category: "simple-melee" }),
  "light-hammer":    W({ id: "light-hammer",    name: "Light hammer",    cost: 2,    weight: 2,  damage: "1d4",  damageType: "bludgeoning", properties: ["light","thrown"], range: "20/60", category: "simple-melee" }),
  "mace":            W({ id: "mace",            name: "Mace",            cost: 5,    weight: 4,  damage: "1d6",  damageType: "bludgeoning", properties: [], category: "simple-melee" }),
  "quarterstaff":    W({ id: "quarterstaff",    name: "Quarterstaff",    cost: 0.2,  weight: 4,  damage: "1d6",  damageType: "bludgeoning", properties: ["versatile(1d8)"], category: "simple-melee" }),
  "sickle":          W({ id: "sickle",          name: "Sickle",          cost: 1,    weight: 2,  damage: "1d4",  damageType: "slashing",    properties: ["light"], category: "simple-melee" }),
  "spear":           W({ id: "spear",           name: "Spear",           cost: 1,    weight: 3,  damage: "1d6",  damageType: "piercing",    properties: ["thrown","versatile(1d8)"], range: "20/60", category: "simple-melee" }),

  /* ===== Simple Ranged ===== */
  "crossbow-light":  W({ id: "crossbow-light",  name: "Crossbow, light", cost: 25,   weight: 5,  damage: "1d8",  damageType: "piercing", properties: ["ammunition","loading","two-handed"], range: "80/320", category: "simple-ranged" }),
  "dart":            W({ id: "dart",            name: "Dart",            cost: 0.05, weight: 0.25, damage: "1d4", damageType: "piercing", properties: ["finesse","thrown"], range: "20/60", category: "simple-ranged" }),
  "shortbow":        W({ id: "shortbow",        name: "Shortbow",        cost: 25,   weight: 2,  damage: "1d6",  damageType: "piercing", properties: ["ammunition","two-handed"], range: "80/320", category: "simple-ranged" }),
  "sling":           W({ id: "sling",           name: "Sling",           cost: 0.1,  weight: 0,  damage: "1d4",  damageType: "bludgeoning", properties: ["ammunition"], range: "30/120", category: "simple-ranged" }),

  /* ===== Martial Melee ===== */
  "battleaxe":       W({ id: "battleaxe",       name: "Battleaxe",       cost: 10, weight: 4,  damage: "1d8",  damageType: "slashing", properties: ["versatile(1d10)"], category: "martial-melee" }),
  "flail":           W({ id: "flail",           name: "Flail",           cost: 10, weight: 2,  damage: "1d8",  damageType: "bludgeoning", properties: [], category: "martial-melee" }),
  "glaive":          W({ id: "glaive",          name: "Glaive",          cost: 20, weight: 6,  damage: "1d10", damageType: "slashing", properties: ["heavy","reach","two-handed"], category: "martial-melee" }),
  "greataxe":        W({ id: "greataxe",        name: "Greataxe",        cost: 30, weight: 7,  damage: "1d12", damageType: "slashing", properties: ["heavy","two-handed"], category: "martial-melee" }),
  "greatsword":      W({ id: "greatsword",      name: "Greatsword",      cost: 50, weight: 6,  damage: "2d6",  damageType: "slashing", properties: ["heavy","two-handed"], category: "martial-melee" }),
  "halberd":         W({ id: "halberd",         name: "Halberd",         cost: 20, weight: 6,  damage: "1d10", damageType: "slashing", properties: ["heavy","reach","two-handed"], category: "martial-melee" }),
  "lance":           W({ id: "lance",           name: "Lance",           cost: 10, weight: 6,  damage: "1d12", damageType: "piercing", properties: ["reach","special"], category: "martial-melee" }),
  "longsword":       W({ id: "longsword",       name: "Longsword",       cost: 15, weight: 3,  damage: "1d8",  damageType: "slashing", properties: ["versatile(1d10)"], category: "martial-melee" }),
  "maul":            W({ id: "maul",            name: "Maul",            cost: 10, weight: 10, damage: "2d6",  damageType: "bludgeoning", properties: ["heavy","two-handed"], category: "martial-melee" }),
  "morningstar":     W({ id: "morningstar",     name: "Morningstar",     cost: 15, weight: 4,  damage: "1d8",  damageType: "piercing", properties: [], category: "martial-melee" }),
  "pike":            W({ id: "pike",            name: "Pike",            cost: 5,  weight: 18, damage: "1d10", damageType: "piercing", properties: ["heavy","reach","two-handed"], category: "martial-melee" }),
  "rapier":          W({ id: "rapier",          name: "Rapier",          cost: 25, weight: 2,  damage: "1d8",  damageType: "piercing", properties: ["finesse"], category: "martial-melee" }),
  "scimitar":        W({ id: "scimitar",        name: "Scimitar",        cost: 25, weight: 3,  damage: "1d6",  damageType: "slashing", properties: ["finesse","light"], category: "martial-melee" }),
  "shortsword":      W({ id: "shortsword",      name: "Shortsword",      cost: 10, weight: 2,  damage: "1d6",  damageType: "piercing", properties: ["finesse","light"], category: "martial-melee" }),
  "trident":         W({ id: "trident",         name: "Trident",         cost: 5,  weight: 4,  damage: "1d6",  damageType: "piercing", properties: ["thrown","versatile(1d8)"], range: "20/60", category: "martial-melee" }),
  "war-pick":        W({ id: "war-pick",        name: "War pick",        cost: 5,  weight: 2,  damage: "1d8",  damageType: "piercing", properties: [], category: "martial-melee" }),
  "warhammer":       W({ id: "warhammer",       name: "Warhammer",       cost: 15, weight: 2,  damage: "1d8",  damageType: "bludgeoning", properties: ["versatile(1d10)"], category: "martial-melee" }),
  "whip":            W({ id: "whip",            name: "Whip",            cost: 2,  weight: 3,  damage: "1d4",  damageType: "slashing", properties: ["finesse","reach"], category: "martial-melee" }),

  /* ===== Martial Ranged ===== */
  "blowgun":         W({ id: "blowgun",         name: "Blowgun",         cost: 10,   weight: 1,  damage: "1",    damageType: "piercing", properties: ["ammunition","loading"], range: "25/100", category: "martial-ranged" }),
  "crossbow-hand":   W({ id: "crossbow-hand",   name: "Crossbow, hand",  cost: 75,   weight: 3,  damage: "1d6",  damageType: "piercing", properties: ["ammunition","light","loading"], range: "30/120", category: "martial-ranged" }),
  "crossbow-heavy":  W({ id: "crossbow-heavy",  name: "Crossbow, heavy", cost: 50,   weight: 18, damage: "1d10", damageType: "piercing", properties: ["ammunition","heavy","loading","two-handed"], range: "100/400", category: "martial-ranged" }),
  "longbow":         W({ id: "longbow",         name: "Longbow",         cost: 50,   weight: 2,  damage: "1d8",  damageType: "piercing", properties: ["ammunition","heavy","two-handed"], range: "150/600", category: "martial-ranged" }),
  "net":             W({ id: "net",             name: "Net",             cost: 1,    weight: 3,  damage: "—",    damageType: "—",       properties: ["special","thrown"], range: "5/15", category: "martial-ranged" }),

  /* ===== Light Armor ===== */
  "padded":       A({ id: "padded",       name: "Padded armor",   cost: 5,   weight: 8,  ac: 11, armorType: "light",  dexCap: null, stealth: "disadvantage" }),
  "leather":      A({ id: "leather",      name: "Leather armor",  cost: 10,  weight: 10, ac: 11, armorType: "light",  dexCap: null }),
  "studded":      A({ id: "studded",      name: "Studded leather",cost: 45,  weight: 13, ac: 12, armorType: "light",  dexCap: null }),
  /* ===== Medium Armor ===== */
  "hide":         A({ id: "hide",         name: "Hide armor",     cost: 10,  weight: 12, ac: 12, armorType: "medium", dexCap: 2 }),
  "chain-shirt":  A({ id: "chain-shirt",  name: "Chain shirt",    cost: 50,  weight: 20, ac: 13, armorType: "medium", dexCap: 2 }),
  "scale-mail":   A({ id: "scale-mail",   name: "Scale mail",     cost: 50,  weight: 45, ac: 14, armorType: "medium", dexCap: 2, stealth: "disadvantage" }),
  "breastplate":  A({ id: "breastplate",  name: "Breastplate",    cost: 400, weight: 20, ac: 14, armorType: "medium", dexCap: 2 }),
  "half-plate":   A({ id: "half-plate",   name: "Half plate",     cost: 750, weight: 40, ac: 15, armorType: "medium", dexCap: 2, stealth: "disadvantage" }),
  /* ===== Heavy Armor ===== */
  "ring-mail":    A({ id: "ring-mail",    name: "Ring mail",      cost: 30,    weight: 40, ac: 14, armorType: "heavy", stealth: "disadvantage" }),
  "chain-mail":   A({ id: "chain-mail",   name: "Chain mail",     cost: 75,    weight: 55, ac: 16, armorType: "heavy", strReq: 13, stealth: "disadvantage" }),
  "splint":       A({ id: "splint",       name: "Splint armor",   cost: 200,   weight: 60, ac: 17, armorType: "heavy", strReq: 15, stealth: "disadvantage" }),
  "plate":        A({ id: "plate",        name: "Plate armor",    cost: 1500,  weight: 65, ac: 18, armorType: "heavy", strReq: 15, stealth: "disadvantage" }),
  /* ===== Shield ===== */
  "shield":       A({ id: "shield",       name: "Shield",         cost: 10,    weight: 6,  ac: 2,  armorType: "shield" }),

  /* ===== Adventuring Gear (common) ===== */
  "backpack":         G({ id: "backpack",         name: "Backpack",         cost: 2,    weight: 5 }),
  "bedroll":          G({ id: "bedroll",          name: "Bedroll",          cost: 1,    weight: 7 }),
  "blanket":          G({ id: "blanket",          name: "Blanket",          cost: 0.5,  weight: 3 }),
  "candle":           G({ id: "candle",           name: "Candle",           cost: 0.01, weight: 0 }),
  "chain-10ft":       G({ id: "chain-10ft",       name: "Chain (10 ft.)",   cost: 5,    weight: 10 }),
  "crowbar":          G({ id: "crowbar",          name: "Crowbar",          cost: 2,    weight: 5 }),
  "flask":            G({ id: "flask",            name: "Flask",            cost: 0.02, weight: 1 }),
  "grappling-hook":   G({ id: "grappling-hook",   name: "Grappling hook",   cost: 2,    weight: 4 }),
  "hammer":           G({ id: "hammer",           name: "Hammer",           cost: 1,    weight: 3 }),
  "healers-kit":      G({ id: "healers-kit",      name: "Healer's kit",     cost: 5,    weight: 3 }),
  "holy-symbol":      G({ id: "holy-symbol",      name: "Holy symbol",      cost: 5,    weight: 1 }),
  "lantern-hooded":   G({ id: "lantern-hooded",   name: "Hooded lantern",   cost: 5,    weight: 2 }),
  "oil":              G({ id: "oil",              name: "Oil (flask)",      cost: 0.1,  weight: 1 }),
  "rations":          G({ id: "rations",          name: "Rations (1 day)",  cost: 0.5,  weight: 2 }),
  "rope-hempen":      G({ id: "rope-hempen",      name: "Rope, hempen (50 ft.)", cost: 1,  weight: 10 }),
  "rope-silk":        G({ id: "rope-silk",        name: "Rope, silk (50 ft.)",   cost: 10, weight: 5 }),
  "spellbook":        G({ id: "spellbook",        name: "Spellbook",        cost: 50,   weight: 3 }),
  "thieves-tools":    G({ id: "thieves-tools",    name: "Thieves' tools",   cost: 25,   weight: 1 }),
  "tinderbox":        G({ id: "tinderbox",        name: "Tinderbox",        cost: 0.5,  weight: 1 }),
  "torch":            G({ id: "torch",            name: "Torch",            cost: 0.01, weight: 1 }),
  "waterskin":        G({ id: "waterskin",        name: "Waterskin",        cost: 0.2,  weight: 5 }),
  "arrows-20":        G({ id: "arrows-20",        name: "Arrows (20)",      cost: 1,    weight: 1 }),
  "crossbow-bolts-20": G({ id: "crossbow-bolts-20", name: "Crossbow bolts (20)", cost: 1, weight: 1.5 }),
  "component-pouch":  G({ id: "component-pouch",  name: "Component pouch",  cost: 25,   weight: 2 }),
  "arcane-focus-orb": G({ id: "arcane-focus-orb", name: "Arcane focus (orb)", cost: 20, weight: 3 }),
  "druidic-focus":    G({ id: "druidic-focus",    name: "Druidic focus",    cost: 1,    weight: 1 }),

  /* ===== Basic Magic Items (SRD sampler) ===== */
  "potion-healing":   G({ id: "potion-healing",   name: "Potion of Healing", cost: 50, weight: 0.5, rarity: "Common",
                          description: "Regain 2d4+2 hit points when you drink this potion." }),
  "potion-greater-healing": G({ id: "potion-greater-healing", name: "Potion of Greater Healing", cost: 150, weight: 0.5, rarity: "Uncommon",
                          description: "Regain 4d4+4 hit points." })
};

export const ITEM_IDS = Object.keys(ITEMS);

export function listWeapons() { return Object.values(ITEMS).filter(i => i.type === "weapon"); }
export function listArmor() { return Object.values(ITEMS).filter(i => i.type === "armor"); }
export function listGear() { return Object.values(ITEMS).filter(i => i.type === "gear"); }
