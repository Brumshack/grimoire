const ROSTER_KEY = "grimoire:roster";
const SETTINGS_KEY = "grimoire:settings";

export function getRoster() {
  try { return JSON.parse(localStorage.getItem(ROSTER_KEY) || "[]"); }
  catch { return []; }
}

export function saveRoster(list) {
  localStorage.setItem(ROSTER_KEY, JSON.stringify(list));
}

export async function updateRosterEntry(doc, derived) {
  const list = getRoster();
  const summary = {
    id: doc.id,
    name: doc.identity?.name || "Unnamed",
    race: derived?.resolvedRace?.fullName || "—",
    class: derived?.primaryClass?.name || "—",
    subclass: derived?.primarySubclass?.name || null,
    level: derived?.totalLevel || 1,
    hp: doc.combat?.currentHp ?? 0,
    maxHp: doc.combat?.maxHp ?? 0,
    updatedAt: doc.updatedAt,
    alignment: doc.identity?.alignment || "TN"
  };
  const idx = list.findIndex(r => r.id === doc.id);
  if (idx >= 0) list[idx] = summary; else list.push(summary);
  list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  saveRoster(list);
  return summary;
}

export function removeRosterEntry(id) {
  const list = getRoster().filter(r => r.id !== id);
  saveRoster(list);
}

export function getSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); }
  catch { return {}; }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
