import { validateCharacter } from "../engine/validation.js";
import { migrate } from "../engine/migrations.js";
import { saveCharacter, loadCharacter } from "./idbStore.js";
import { updateRosterEntry } from "./localStore.js";
import { deriveAll } from "../engine/derive.js";
import { uuid } from "../util/id.js";

export async function exportCharacterAsJson(id) {
  const doc = await loadCharacter(id);
  if (!doc) throw new Error("character not found");
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (doc.identity?.name || "character").replace(/[^a-z0-9\-_]+/gi, "_");
  a.href = url;
  a.download = `${safeName}.grimoire.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importCharacterFromFile(file, { replaceId = false } = {}) {
  const text = await file.text();
  let doc;
  try { doc = JSON.parse(text); }
  catch { throw new Error("not valid JSON"); }
  doc = migrate(doc);
  const v = validateCharacter(doc);
  if (!v.ok) throw new Error("invalid character: " + v.errors.join(", "));
  if (replaceId) doc.id = uuid();
  doc.updatedAt = new Date().toISOString();
  await saveCharacter(doc);
  const derived = deriveAll(doc);
  await updateRosterEntry(doc, derived);
  return doc;
}

export function pickJsonFile() {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}
