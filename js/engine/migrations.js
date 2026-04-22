import { SCHEMA_VERSION } from "./characterFactory.js";

const migrations = {
  // v1 → v2: add override buckets for full customization.
  1: (doc) => {
    doc.combat = doc.combat || {};
    doc.combat.initiativeOverride = doc.combat.initiativeOverride ?? null;
    doc.combat.speedOverride = doc.combat.speedOverride ?? null;
    doc.combat.profBonusOverride = doc.combat.profBonusOverride ?? null;
    doc.combat.hitDieOverride = doc.combat.hitDieOverride ?? null;
    doc.combat.passiveOverrides = doc.combat.passiveOverrides || {
      perception: null, investigation: null, insight: null
    };

    doc.proficiencies = doc.proficiencies || {};
    doc.proficiencies.skillOverrides = doc.proficiencies.skillOverrides || {};
    doc.proficiencies.saveOverrides = doc.proficiencies.saveOverrides || {};

    doc.spellcasting = doc.spellcasting || {};
    doc.spellcasting.custom = doc.spellcasting.custom || [];
    doc.spellcasting.saveDcOverride = doc.spellcasting.saveDcOverride ?? null;
    doc.spellcasting.attackOverride = doc.spellcasting.attackOverride ?? null;
    doc.spellcasting.abilityOverride = doc.spellcasting.abilityOverride ?? null;

    doc.features = doc.features || {};
    doc.features.custom = doc.features.custom || [];

    doc.schemaVersion = 2;
    return doc;
  },

  // v2 → v3: add custom attacks, attack overrides, custom actions.
  2: (doc) => {
    doc.combat = doc.combat || {};
    doc.combat.customAttacks   = doc.combat.customAttacks   || [];
    doc.combat.attackOverrides = doc.combat.attackOverrides || {};
    doc.combat.customActions   = doc.combat.customActions   || [];
    doc.schemaVersion = 3;
    return doc;
  },
};

export function migrate(doc) {
  if (!doc || typeof doc !== "object") return doc;
  let current = doc.schemaVersion || 1;
  while (current < SCHEMA_VERSION) {
    const fn = migrations[current];
    if (!fn) break;
    doc = fn(doc);
    current = doc.schemaVersion;
  }
  doc.schemaVersion = SCHEMA_VERSION;
  return doc;
}
