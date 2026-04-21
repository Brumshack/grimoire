// Uses Dexie (from vendor/dexie.min.js attaches window.Dexie).
// Fallback path: if Dexie is missing, fall back to localStorage JSON blob per character.

const DB_NAME = "grimoire";
const DB_VERSION = 1;

let _db = null;

function getDb() {
  if (_db) return _db;
  if (!window.Dexie) return null;
  const db = new window.Dexie(DB_NAME);
  db.version(DB_VERSION).stores({
    characters: "id,updatedAt",
    homebrew: "id,kind",
    settings: "key"
  });
  _db = db;
  return db;
}

export async function saveCharacter(doc) {
  const db = getDb();
  if (db) return db.table("characters").put({ ...doc });
  localStorage.setItem(`char:${doc.id}`, JSON.stringify(doc));
}

export async function loadCharacter(id) {
  const db = getDb();
  if (db) return db.table("characters").get(id);
  const raw = localStorage.getItem(`char:${id}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteCharacter(id) {
  const db = getDb();
  if (db) return db.table("characters").delete(id);
  localStorage.removeItem(`char:${id}`);
}

export async function listAllCharacters() {
  const db = getDb();
  if (db) return db.table("characters").toArray();
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("char:")) {
      try { out.push(JSON.parse(localStorage.getItem(k))); } catch {}
    }
  }
  return out;
}
