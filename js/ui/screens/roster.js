import { el, clear } from "../../util/dom.js";
import { getRoster, removeRosterEntry } from "../../storage/localStore.js";
import { deleteCharacter } from "../../storage/idbStore.js";
import { exportCharacterAsJson, importCharacterFromFile, pickJsonFile } from "../../storage/exportImport.js";
import { navigate } from "../router.js";
import { toast } from "../components/toast.js";
import { openExistingCharacterForm } from "../components/existingCharacterForm.js";
import { ALIGNMENTS } from "../../data/rules.js";
import { SPELLS } from "../../data/spells.js";
import { ITEMS, listWeapons, listArmor, listGear } from "../../data/equipment.js";
import { listRaces } from "../../data/races.js";
import { CLASSES, CLASS_IDS } from "../../data/classes.js";
import { initTabbedContainer } from "../components/tabbedContainer.js";

const alignmentName = (id) => (ALIGNMENTS.find(a => a.id === id)?.name) || id || "";

export function renderRoster(mount) {
  clear(mount);
  const list = getRoster();

  const header = el("header", { class: "roster__header" },
    el("h1", { class: "roster__title" }, "Grimoire"),
    el("p", { class: "roster__subtitle" }, "Your party of heroes"),
  );

  const card = buildTabCard(list, mount);

  mount.append(el("section", { class: "roster" }, header, card));
  initTabbedContainer(card);
}

/* ─────────────────────── tab card ─────────────────────── */

function buildTabCard(list, mount) {
  return el("div", { class: "tab-card" },
    el("div", { class: "main-tab-bar" },
      el("div", { class: "mtab active", "data-main": "roster"  }, "Roster"),
      el("div", { class: "mtab",        "data-main": "library" }, "Library"),
      el("div", { class: "mtab",        "data-main": "guide"   }, "Guide"),
    ),
    rosterMainPane(list, mount),
    libraryMainPane(),
    guideMainPane(),
  );
}

/* ─────────────────────── roster pane ─────────────────────── */

function rosterMainPane(list, mount) {
  const actions = el("div", { class: "roster__actions" },
    el("button", {
      class: "btn btn--primary",
      onclick: () => navigate("/creator")
    }, "+ New Character"),
    el("button", {
      class: "btn btn--primary",
      title: "Skip the wizard — start from a blank sheet for a character you already have",
      onclick: () => openExistingCharacterForm()
    }, "+ Existing Character"),
    el("button", {
      class: "btn btn--ghost",
      onclick: async () => {
        const file = await pickJsonFile();
        if (!file) return;
        try {
          const doc = await importCharacterFromFile(file);
          toast(`Imported ${doc.identity?.name || "character"}`);
          renderRoster(mount);
        } catch (err) {
          toast(`Import failed: ${err.message}`);
        }
      }
    }, "Import JSON"),
  );

  const empty = list.length === 0;
  const allPane = el("div", { class: "sub-pane active", id: "sp-roster-all" }, actions, renderCharGrid(list, mount));
  const byClassPane = el("div", { class: "sub-pane", id: "sp-roster-class" }, actions.cloneNode(true), renderGroupedByClass(list, mount));
  const byLevelPane = el("div", { class: "sub-pane", id: "sp-roster-level" }, actions.cloneNode(true), renderSortedByLevel(list, mount));

  // Re-wire action buttons on the cloned action rows (cloneNode loses listeners)
  rewireActions(byClassPane, mount);
  rewireActions(byLevelPane, mount);

  return el("div", { class: "main-pane active", id: "mp-roster" },
    el("div", { class: "sub-tab-bar" },
      el("div", { class: "stab active", "data-group": "roster", "data-sub": "all"   }, "All"),
      el("div", { class: "stab",        "data-group": "roster", "data-sub": "class" }, "By Class"),
      el("div", { class: "stab",        "data-group": "roster", "data-sub": "level" }, "By Level"),
    ),
    allPane, byClassPane, byLevelPane
  );
}

function rewireActions(pane, mount) {
  const btns = pane.querySelectorAll(".roster__actions .btn");
  if (btns.length < 3) return;
  btns[0].onclick = () => navigate("/creator");
  btns[1].onclick = () => openExistingCharacterForm();
  btns[2].onclick = async () => {
    const file = await pickJsonFile();
    if (!file) return;
    try {
      const doc = await importCharacterFromFile(file);
      toast(`Imported ${doc.identity?.name || "character"}`);
      renderRoster(mount);
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    }
  };
}

function renderCharGrid(list, mount) {
  if (list.length === 0) {
    return el("div", { class: "empty-state" },
      el("p", {}, "No characters yet."),
      el("p", { class: "muted" }, "Create your first hero to begin.")
    );
  }
  const grid = el("div", { class: "char-grid" });
  for (const s of list) grid.append(renderCard(s, mount));
  return grid;
}

function renderGroupedByClass(list, mount) {
  if (list.length === 0) {
    return el("div", { class: "empty-state" }, el("p", {}, "No characters yet."));
  }
  const groups = new Map();
  for (const s of list) {
    const key = s.class || "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  const container = el("div", {});
  [...groups.keys()].sort().forEach(cls => {
    const group = el("div", { class: "tab-card-group" },
      el("h4", { class: "tab-card-group__title" }, cls)
    );
    const grid = el("div", { class: "char-grid" });
    for (const s of groups.get(cls)) grid.append(renderCard(s, mount));
    group.append(grid);
    container.append(group);
  });
  return container;
}

function renderSortedByLevel(list, mount) {
  if (list.length === 0) {
    return el("div", { class: "empty-state" }, el("p", {}, "No characters yet."));
  }
  const sorted = [...list].sort((a, b) => (b.level || 0) - (a.level || 0));
  const grid = el("div", { class: "char-grid" });
  for (const s of sorted) grid.append(renderCard(s, mount));
  return grid;
}

function renderCard(s, mount) {
  const hpPct = s.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((s.hp / s.maxHp) * 100))) : 0;
  const classLabel = s.subclass ? `${s.subclass} ${s.class}` : s.class;

  return el("article", { class: "char-card", tabindex: 0 },
    el("div", { class: "char-card__body", onclick: () => navigate(`/sheet/${s.id}`) },
      el("h3", { class: "char-card__name" }, s.name || "Unnamed"),
      el("div", { class: "char-card__meta" },
        el("span", {}, `Lvl ${s.level}`),
        el("span", { class: "sep" }, "·"),
        el("span", {}, s.race),
        el("span", { class: "sep" }, "·"),
        el("span", {}, classLabel),
      ),
      el("div", { class: "char-card__align" }, alignmentName(s.alignment)),
      el("div", { class: "char-card__hp" },
        el("div", { class: "char-card__hpbar" },
          el("div", { class: "char-card__hpfill", style: { width: `${hpPct}%` } })
        ),
        el("div", { class: "char-card__hptext" }, `${s.hp} / ${s.maxHp} HP`)
      ),
    ),
    el("div", { class: "char-card__actions" },
      el("button", {
        class: "btn btn--sm",
        onclick: (e) => { e.stopPropagation(); navigate(`/sheet/${s.id}`); }
      }, "Open"),
      el("button", {
        class: "btn btn--sm btn--ghost",
        onclick: async (e) => {
          e.stopPropagation();
          try { await exportCharacterAsJson(s.id); toast("Exported"); }
          catch (err) { toast(`Export failed: ${err.message}`); }
        }
      }, "Export"),
      el("button", {
        class: "btn btn--sm btn--danger",
        onclick: async (e) => {
          e.stopPropagation();
          if (!confirm(`Delete ${s.name || "this character"}? This cannot be undone.`)) return;
          await deleteCharacter(s.id);
          removeRosterEntry(s.id);
          toast("Deleted");
          renderRoster(mount);
        }
      }, "Delete"),
    )
  );
}

/* ─────────────────────── library pane ─────────────────────── */

function libraryMainPane() {
  return el("div", { class: "main-pane", id: "mp-library" },
    el("div", { class: "sub-tab-bar" },
      el("div", { class: "stab active", "data-group": "library", "data-sub": "spells"  }, "Spells"),
      el("div", { class: "stab",        "data-group": "library", "data-sub": "items"   }, "Items"),
      el("div", { class: "stab",        "data-group": "library", "data-sub": "races"   }, "Races"),
      el("div", { class: "stab",        "data-group": "library", "data-sub": "classes" }, "Classes"),
    ),
    librarySpellsPane(),
    libraryItemsPane(),
    libraryRacesPane(),
    libraryClassesPane(),
  );
}

function librarySpellsPane() {
  const all = Object.values(SPELLS).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  const search = el("input", {
    type: "text",
    class: "tab-card-search",
    placeholder: `Search ${all.length} spells…`
  });
  const list = el("div", { class: "tab-card-list" });
  const scroll = el("div", { class: "tab-card-scroll" }, list);

  const levelLabel = (l) => l === 0 ? "Cantrip" : `Lvl ${l}`;
  const paint = (query = "") => {
    clear(list);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter(sp => sp.name.toLowerCase().includes(q) || (sp.school || "").toLowerCase().includes(q))
      : all;
    if (filtered.length === 0) {
      list.append(el("div", { class: "tab-card-empty" }, "No spells match."));
      return;
    }
    for (const sp of filtered) {
      list.append(el("div", { class: "tab-card-row" },
        el("div", { class: "tab-card-row__name" }, sp.name),
        el("div", { class: "tab-card-row__meta" }, levelLabel(sp.level)),
        el("div", { class: "tab-card-row__meta" }, sp.school || ""),
        el("div", { class: "tab-card-row__meta" }, (sp.classes || []).join(", "))
      ));
    }
  };

  search.addEventListener("input", () => paint(search.value));
  paint();

  return el("div", { class: "sub-pane active", id: "sp-library-spells" }, search, scroll);
}

function libraryItemsPane() {
  const weapons = listWeapons();
  const armor = listArmor();
  const gear = listGear();
  const all = [...weapons, ...armor, ...gear];

  const search = el("input", {
    type: "text",
    class: "tab-card-search",
    placeholder: `Search ${all.length} items…`
  });
  const listEl = el("div", {});
  const scroll = el("div", { class: "tab-card-scroll" }, listEl);

  const paint = (query = "") => {
    clear(listEl);
    const q = query.trim().toLowerCase();
    const match = (i) => !q || i.name.toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q);
    const sections = [
      { title: "Weapons", items: weapons.filter(match) },
      { title: "Armor",   items: armor.filter(match) },
      { title: "Gear",    items: gear.filter(match) },
    ];
    const anyVisible = sections.some(s => s.items.length > 0);
    if (!anyVisible) {
      listEl.append(el("div", { class: "tab-card-empty" }, "No items match."));
      return;
    }
    for (const section of sections) {
      if (section.items.length === 0) continue;
      const group = el("div", { class: "tab-card-group" },
        el("h4", { class: "tab-card-group__title" }, `${section.title} (${section.items.length})`)
      );
      const rows = el("div", { class: "tab-card-list" });
      for (const it of section.items) {
        rows.append(el("div", { class: "tab-card-row" },
          el("div", { class: "tab-card-row__name" }, it.name),
          el("div", { class: "tab-card-row__meta" }, it.damage || it.ac ? (it.damage ? `${it.damage} ${it.damageType || ""}` : `AC ${it.ac}`) : (it.weight != null ? `${it.weight} lb` : "")),
          el("div", { class: "tab-card-row__meta" }, `${it.cost ?? ""} gp`),
          el("div", { class: "tab-card-row__meta" }, (it.category || it.type || "").replace(/-/g, " "))
        ));
      }
      group.append(rows);
      listEl.append(group);
    }
  };

  search.addEventListener("input", () => paint(search.value));
  paint();

  return el("div", { class: "sub-pane", id: "sp-library-items" }, search, scroll);
}

function libraryRacesPane() {
  const races = listRaces();
  const scroll = el("div", { class: "tab-card-scroll" });
  const list = el("div", { class: "tab-card-list" });
  for (const r of races) {
    const bonuses = Object.entries(r.abilityBonuses || {}).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(", ");
    list.append(el("div", { class: "tab-card-row" },
      el("div", { class: "tab-card-row__name" }, r.name),
      el("div", { class: "tab-card-row__meta" }, `${r.size || ""}`),
      el("div", { class: "tab-card-row__meta" }, `${r.speed || "—"} ft`),
      el("div", { class: "tab-card-row__meta" }, bonuses)
    ));
  }
  scroll.append(list);
  return el("div", { class: "sub-pane", id: "sp-library-races" }, scroll);
}

function libraryClassesPane() {
  const scroll = el("div", { class: "tab-card-scroll" });
  const list = el("div", { class: "tab-card-list" });
  for (const id of CLASS_IDS) {
    const c = CLASSES[id];
    list.append(el("div", { class: "tab-card-row" },
      el("div", { class: "tab-card-row__name" }, c.name),
      el("div", { class: "tab-card-row__meta" }, `d${c.hitDie} HD`),
      el("div", { class: "tab-card-row__meta" }, (c.savingThrows || []).map(s => s.toUpperCase()).join(", ")),
      el("div", { class: "tab-card-row__meta" }, c.spellcasting ? `${c.spellcasting.ability?.toUpperCase() || ""} caster` : "Martial")
    ));
  }
  scroll.append(list);
  return el("div", { class: "sub-pane", id: "sp-library-classes" }, scroll);
}

/* ─────────────────────── guide pane ─────────────────────── */

function guideMainPane() {
  return el("div", { class: "main-pane", id: "mp-guide" },
    el("div", { class: "sub-tab-bar" },
      el("div", { class: "stab active", "data-group": "guide", "data-sub": "start"   }, "Getting Started"),
      el("div", { class: "stab",        "data-group": "guide", "data-sub": "privacy" }, "Data & Privacy"),
      el("div", { class: "stab",        "data-group": "guide", "data-sub": "credits" }, "Credits"),
    ),
    el("div", { class: "sub-pane active", id: "sp-guide-start" }, guideStart()),
    el("div", { class: "sub-pane", id: "sp-guide-privacy" }, guidePrivacy()),
    el("div", { class: "sub-pane", id: "sp-guide-credits" }, guideCredits()),
  );
}

function guideStart() {
  const box = el("div", { class: "guide-block" });
  box.innerHTML = `
    <h4>Welcome to Grimoire</h4>
    <p>A tactical character sheet for D&amp;D 5e, built on the SRD 5.1 (OGL 1.0a).</p>

    <h4>Two ways to begin</h4>
    <ul>
      <li><strong>+ New Character</strong> — guided wizard: pick race, class, abilities (standard array), equipment.</li>
      <li><strong>+ Existing Character</strong> — blank sheet for a hero you already have; fill everything in inline on the sheet.</li>
    </ul>

    <h4>Everything is editable</h4>
    <p>Click any stat with a dashed underline to override it. AC, speed, initiative, hit dice, spell DC, skill modifiers, per-ability scores, attacks — every computed value can be overridden with a note and an "acquired from" source. Hover to read, click to edit.</p>

    <h4>The Codex tab</h4>
    <p>A journal-style second home for lore: session log, quests, NPCs, places, maps, factions, gods, bestiary, and more. Swipe between 14 parchment pages.</p>

    <h4>Homebrew</h4>
    <p>Every list (spells, items, features, attacks) accepts custom entries via the <code>+ Custom</code> buttons.</p>
  `;
  return box;
}

function guidePrivacy() {
  const box = el("div", { class: "guide-block" });
  box.innerHTML = `
    <h4>Everything is local</h4>
    <p>Grimoire runs entirely in your browser. There are no servers, no accounts, no analytics, no cloud sync.</p>

    <h4>Where your data lives</h4>
    <ul>
      <li><strong>IndexedDB</strong> — full character documents (Dexie DB <code>grimoire</code>, table <code>characters</code>).</li>
      <li><strong>localStorage</strong> — a small roster summary (name, class, level, HP) for the front page.</li>
    </ul>

    <h4>Backing up</h4>
    <p>Use the <strong>Export</strong> button on a character card to save a <code>.grimoire.json</code> file. Use <strong>Import JSON</strong> to load one back. Back up regularly — clearing browser data wipes characters.</p>

    <h4>Content license</h4>
    <p>All rule data is from the SRD 5.1 under the OGL 1.0a. No Player's Handbook-only content is included.</p>
  `;
  return box;
}

function guideCredits() {
  const box = el("div", { class: "guide-block" });
  box.innerHTML = `
    <h4>Built on</h4>
    <ul>
      <li>Vanilla ES modules — no framework, no build step.</li>
      <li><a href="https://dexie.org/" target="_blank" rel="noopener">Dexie</a> for IndexedDB.</li>
      <li><a href="https://github.com/cure53/DOMPurify" target="_blank" rel="noopener">DOMPurify</a> for safe HTML rendering.</li>
    </ul>

    <h4>Game content</h4>
    <p>Dungeons &amp; Dragons 5th Edition SRD 5.1, released by Wizards of the Coast under the Open Game License 1.0a.</p>

    <h4>Scope</h4>
    <ul>
      <li>9 races (with PHB 2014 subraces)</li>
      <li>12 classes, one SRD subclass each</li>
      <li>1 background (Acolyte)</li>
      <li>~45 core spells (expandable via <code>scripts/build-data.js</code>)</li>
    </ul>
  `;
  return box;
}
