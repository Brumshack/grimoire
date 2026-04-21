import { SCHEMA_VERSION } from "./characterFactory.js";

// migration functions indexed by the "from" version.
const migrations = {
  // 1: (doc) => { ... return v2Doc; }
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
