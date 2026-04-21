import { rollDie, averageHitDie } from "../util/dice.js";
import { abilityMod, asiLevels } from "../data/rules.js";
import { CLASSES, classFeaturesUpToLevel } from "../data/classes.js";

/**
 * Guided level-up helper. Computes what the character gains at the new level.
 */
export function previewLevelUp(character, classIndex = 0) {
  const entry = character.progression.classes[classIndex];
  if (!entry) return null;
  const cls = CLASSES[entry.classId];
  if (!cls) return null;
  const nextLevel = entry.level + 1;
  if (nextLevel > 20) return { atCap: true };

  const conMod = abilityMod((character.abilityScores.base.con || 10)
    + ((character.abilityScores.asiBonuses.con) || 0));
  const averageHp = averageHitDie(cls.hitDie) + conMod;

  const features = classFeaturesUpToLevel(entry.classId, entry.subclassId, nextLevel)
    .filter(f => f.level === nextLevel);

  const asiLv = asiLevels(entry.classId).includes(nextLevel);
  const needsSubclass = cls.subclasses?.some(s => s.level === nextLevel && !entry.subclassId);

  return {
    nextLevel,
    cls,
    hitDie: cls.hitDie,
    averageHp,
    conMod,
    newFeatures: features,
    asiAvailable: asiLv,
    needsSubclass
  };
}

export function applyLevelUp(character, opts) {
  const classIndex = opts.classIndex ?? 0;
  const entry = character.progression.classes[classIndex];
  const cls = CLASSES[entry.classId];
  if (!cls) return character;

  const nextLevel = entry.level + 1;
  if (nextLevel > 20) return character;

  const conMod = abilityMod((character.abilityScores.base.con || 10)
    + ((character.abilityScores.asiBonuses.con) || 0));

  let hpGain = 0;
  if (opts.hpMethod === "roll") {
    hpGain = Math.max(1, rollDie(cls.hitDie) + conMod);
    entry.hitDieRolls = [...(entry.hitDieRolls || []), hpGain - conMod];
  } else {
    hpGain = Math.max(1, averageHitDie(cls.hitDie) + conMod);
  }

  entry.level = nextLevel;
  character.combat.maxHp = (character.combat.maxHp || 1) + hpGain;
  character.combat.currentHp = Math.min(character.combat.maxHp, (character.combat.currentHp || 0) + hpGain);

  if (opts.subclassId) entry.subclassId = opts.subclassId;
  if (opts.asi) {
    for (const [k, v] of Object.entries(opts.asi)) {
      character.abilityScores.asiBonuses[k] = (character.abilityScores.asiBonuses[k] || 0) + v;
    }
  }
  return character;
}
