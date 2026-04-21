import { el, clear } from "../../util/dom.js";
import { getRoster, removeRosterEntry } from "../../storage/localStore.js";
import { deleteCharacter } from "../../storage/idbStore.js";
import { exportCharacterAsJson, importCharacterFromFile, pickJsonFile } from "../../storage/exportImport.js";
import { navigate } from "../router.js";
import { toast } from "../components/toast.js";
import { ALIGNMENTS } from "../../data/rules.js";

const alignmentName = (id) => (ALIGNMENTS.find(a => a.id === id)?.name) || id || "";

export function renderRoster(mount) {
  clear(mount);
  const list = getRoster();

  const header = el("header", { class: "roster__header" },
    el("h1", { class: "roster__title" }, "Grimoire"),
    el("p", { class: "roster__subtitle" }, "Your party of heroes"),
  );

  const actions = el("div", { class: "roster__actions" },
    el("button", {
      class: "btn btn--primary",
      onclick: () => navigate("/creator")
    }, "+ New Character"),
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

  const grid = el("div", { class: "char-grid" });

  if (list.length === 0) {
    grid.append(el("div", { class: "empty-state" },
      el("p", {}, "No characters yet."),
      el("p", { class: "muted" }, "Create your first hero to begin.")
    ));
  } else {
    for (const summary of list) grid.append(renderCard(summary, mount));
  }

  mount.append(el("section", { class: "roster" }, header, actions, grid));
}

function renderCard(s, mount) {
  const hpPct = s.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((s.hp / s.maxHp) * 100))) : 0;
  const classLabel = s.subclass ? `${s.subclass} ${s.class}` : s.class;

  const card = el("article", { class: "char-card", tabindex: 0 },
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
  return card;
}
