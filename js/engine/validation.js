import { ABILITY_KEYS } from "../data/rules.js";

export function validateCharacter(doc) {
  const errors = [];
  if (!doc || typeof doc !== "object") { errors.push("Not an object"); return { ok: false, errors }; }
  if (typeof doc.id !== "string") errors.push("missing id");
  if (!doc.identity || typeof doc.identity.name !== "string") errors.push("missing identity.name");
  if (!Array.isArray(doc.progression?.classes)) errors.push("missing progression.classes");
  if (doc.abilityScores?.base) {
    for (const k of ABILITY_KEYS) {
      const v = doc.abilityScores.base[k];
      if (typeof v !== "number" || v < 1 || v > 30) errors.push(`ability ${k} out of range`);
    }
  } else {
    errors.push("missing abilityScores.base");
  }
  return { ok: errors.length === 0, errors };
}
