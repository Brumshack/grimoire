// Declarative schemas describing the fields on custom/homebrew records.
// Consumed by js/ui/components/homebrewForm.js to render an edit modal
// and produce a validated record to persist on the character doc.

export const SPELL_SCHEMA = {
  kind: "spell",
  title: "Custom Spell",
  fields: [
    { key: "name", label: "Name", type: "text", required: true, placeholder: "Fireball" },
    { key: "level", label: "Spell Level (0 = cantrip)", type: "number", min: 0, max: 9, default: 0, help: "Enter 0 for a cantrip, 1–9 for leveled spells" },
    { key: "school", label: "School", type: "select", options: [
      { value: "abjuration", label: "Abjuration" },
      { value: "conjuration", label: "Conjuration" },
      { value: "divination", label: "Divination" },
      { value: "enchantment", label: "Enchantment" },
      { value: "evocation", label: "Evocation" },
      { value: "illusion", label: "Illusion" },
      { value: "necromancy", label: "Necromancy" },
      { value: "transmutation", label: "Transmutation" }
    ], default: "evocation" },
    { key: "castingTime", label: "Casting Time", type: "text", default: "1 action", placeholder: "1 action" },
    { key: "range", label: "Range", type: "text", default: "Self", placeholder: "60 feet" },
    { key: "components_v", label: "Verbal", type: "checkbox", default: false },
    { key: "components_s", label: "Somatic", type: "checkbox", default: false },
    { key: "components_m", label: "Material", type: "checkbox", default: false },
    { key: "material", label: "Material Description", type: "text", placeholder: "A pinch of sulfur" },
    { key: "duration", label: "Duration", type: "text", default: "Instantaneous" },
    { key: "concentration", label: "Concentration", type: "checkbox", default: false },
    { key: "ritual", label: "Ritual", type: "checkbox", default: false },
    { key: "description", label: "Description", type: "textarea", required: true, rows: 6 },
    { key: "higherLevel", label: "At Higher Levels", type: "textarea", rows: 3 },
    // ── Personal tracking (stored in separate buckets, not in the spell record) ──
    { key: "_acquiredFrom", label: "Acquired From / Source", type: "text", placeholder: "Quest reward, DM granted, Wizard's apprenticeship…" },
    { key: "_userNotes", label: "My Notes", type: "textarea", rows: 3, placeholder: "Personal notes visible on hover…" }
  ],
  // Assemble stored record shape from flat form data.
  // _acquiredFrom / _userNotes are prefixed with _ so callers know to route them separately.
  assemble(v) {
    return {
      id: v.id,
      custom: true,
      name: (v.name || "").trim(),
      level: Number(v.level) || 0,
      school: v.school || "evocation",
      castingTime: v.castingTime || "1 action",
      range: v.range || "",
      components: {
        v: !!v.components_v,
        s: !!v.components_s,
        m: !!v.components_m,
        material: v.material || ""
      },
      duration: v.duration || "Instantaneous",
      concentration: !!v.concentration,
      ritual: !!v.ritual,
      description: v.description || "",
      higherLevel: v.higherLevel || "",
      classes: [],
      // Pass through so save handlers can route them
      _acquiredFrom: v._acquiredFrom || "",
      _userNotes: v._userNotes || ""
    };
  },
  // Flatten stored record back into form shape (for editing).
  disassemble(r) {
    return {
      ...r,
      components_v: !!r?.components?.v,
      components_s: !!r?.components?.s,
      components_m: !!r?.components?.m,
      material: r?.components?.material || "",
      _acquiredFrom: r?._acquiredFrom || "",
      _userNotes: r?._userNotes || ""
    };
  }
};

export const ITEM_SCHEMA = {
  kind: "item",
  title: "Custom Item",
  fields: [
    { key: "name", label: "Name", type: "text", required: true, placeholder: "Ring of Feather Falling" },
    { key: "type", label: "Type", type: "select", options: [
      { value: "weapon", label: "Weapon" },
      { value: "armor", label: "Armor" },
      { value: "gear", label: "Adventuring Gear" },
      { value: "tool", label: "Tool" },
      { value: "magic", label: "Magic Item" },
      { value: "consumable", label: "Consumable" }
    ], default: "gear" },
    { key: "weight", label: "Weight (lb)", type: "number", min: 0, step: 0.1, default: 0 },
    { key: "cost", label: "Cost (gp)", type: "number", min: 0, default: 0 },
    { key: "rarity", label: "Rarity", type: "select", options: [
      { value: "", label: "—" },
      { value: "common", label: "Common" },
      { value: "uncommon", label: "Uncommon" },
      { value: "rare", label: "Rare" },
      { value: "veryRare", label: "Very Rare" },
      { value: "legendary", label: "Legendary" },
      { value: "artifact", label: "Artifact" }
    ], default: "" },
    // Weapon-specific
    { key: "damage", label: "Damage (weapons)", type: "text", placeholder: "1d8", showIf: (v) => v.type === "weapon" },
    { key: "damageType", label: "Damage Type", type: "text", placeholder: "slashing", showIf: (v) => v.type === "weapon" },
    { key: "range", label: "Range (weapons)", type: "text", placeholder: "20/60", showIf: (v) => v.type === "weapon" },
    { key: "propertiesStr", label: "Properties (comma-sep)", type: "text", placeholder: "finesse, light", showIf: (v) => v.type === "weapon" },
    // Armor-specific
    { key: "ac", label: "Armor Class", type: "number", min: 0, showIf: (v) => v.type === "armor" },
    { key: "armorType", label: "Armor Type", type: "select", options: [
      { value: "light", label: "Light" },
      { value: "medium", label: "Medium" },
      { value: "heavy", label: "Heavy" },
      { value: "shield", label: "Shield" }
    ], default: "light", showIf: (v) => v.type === "armor" },
    { key: "strReq", label: "Str Requirement", type: "number", min: 0, showIf: (v) => v.type === "armor" },
    { key: "stealth", label: "Stealth Disadvantage?", type: "text", placeholder: "Disadvantage", showIf: (v) => v.type === "armor" },
    // Attunement
    { key: "attunement", label: "Requires Attunement", type: "checkbox", default: false },
    { key: "description", label: "Description", type: "textarea", rows: 5 },
    // ── Personal tracking ──
    { key: "_acquiredFrom", label: "Acquired From / Source", type: "text", placeholder: "Looted, purchased, DM granted…" },
    { key: "_userNotes", label: "My Notes", type: "textarea", rows: 3, placeholder: "Personal notes visible on hover…" }
  ],
  assemble(v) {
    const r = {
      id: v.id,
      custom: true,
      name: (v.name || "").trim(),
      type: v.type || "gear",
      weight: Number(v.weight) || 0,
      cost: Number(v.cost) || 0,
      rarity: v.rarity || "",
      attunement: !!v.attunement,
      description: v.description || "",
      _acquiredFrom: v._acquiredFrom || "",
      _userNotes: v._userNotes || ""
    };
    if (v.type === "weapon") {
      r.damage = v.damage || "";
      r.damageType = v.damageType || "";
      r.range = v.range || "";
      r.properties = (v.propertiesStr || "").split(",").map(s => s.trim()).filter(Boolean);
    }
    if (v.type === "armor") {
      r.ac = Number(v.ac) || 10;
      r.armorType = v.armorType || "light";
      r.strReq = Number(v.strReq) || 0;
      r.stealth = v.stealth || "";
    }
    return r;
  },
  disassemble(r) {
    return {
      ...r,
      propertiesStr: (r?.properties || []).join(", "),
      _acquiredFrom: r?._acquiredFrom || "",
      _userNotes: r?._userNotes || ""
    };
  }
};

export const FEATURE_SCHEMA = {
  kind: "feature",
  title: "Custom Feature or Trait",
  fields: [
    { key: "name", label: "Name", type: "text", required: true, placeholder: "Keen Mind" },
    { key: "source", label: "Source", type: "text", default: "Homebrew", placeholder: "Feat, homebrew, magic item..." },
    { key: "level", label: "Level Gained", type: "number", min: 1, max: 20, default: 1 },
    { key: "desc", label: "Description", type: "textarea", required: true, rows: 6 },
    // ── Personal tracking ──
    { key: "_userNotes", label: "My Notes", type: "textarea", rows: 3, placeholder: "Personal notes visible on hover…" }
  ],
  assemble(v) {
    return {
      id: v.id,
      name: (v.name || "").trim(),
      source: v.source || "Homebrew",
      level: Number(v.level) || 1,
      desc: v.desc || "",
      _userNotes: v._userNotes || ""
    };
  },
  disassemble(r) {
    return {
      ...r,
      _userNotes: r?._userNotes || ""
    };
  }
};

export const ATTACK_SCHEMA = {
  kind: "attack",
  title: "Attack",
  fields: [
    { key: "name",       label: "Name",                   type: "text",   required: true,  placeholder: "Longsword" },
    { key: "atkAbility", label: "Attack Ability",         type: "select", default: "str",
      options: [
        { value: "str",   label: "Strength" },
        { value: "dex",   label: "Dexterity" },
        { value: "int",   label: "Intelligence" },
        { value: "wis",   label: "Wisdom" },
        { value: "cha",   label: "Charisma" },
        { value: "spell", label: "Spellcasting ability" },
        { value: "flat",  label: "None (proficiency only)" }
      ]
    },
    { key: "damage",     label: "Damage Dice",            type: "text",   required: true,  placeholder: "1d8" },
    { key: "damageType", label: "Damage Type",            type: "text",   placeholder: "slashing" },
    { key: "range",      label: "Range",                  type: "text",   placeholder: "5 ft. (melee)" },
    { key: "properties", label: "Properties (comma-sep)", type: "text",   placeholder: "finesse, light, thrown…" },
    { key: "notes",      label: "Notes",                  type: "textarea", rows: 3, placeholder: "Flavor, special rules…" }
  ],
  assemble(v) {
    return {
      id: v.id,
      name:       (v.name || "").trim(),
      atkAbility: v.atkAbility || "str",
      damage:     v.damage || "1d4",
      damageType: v.damageType || "",
      range:      v.range || "",
      properties: (v.properties || "").split(",").map(s => s.trim()).filter(Boolean),
      notes:      v.notes || ""
    };
  },
  disassemble(r) {
    const props = r?.properties;
    return {
      ...r,
      properties: Array.isArray(props) ? props.join(", ") : (props || "")
    };
  }
};
