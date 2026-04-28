import { openModal } from "./modal.js";
import { el } from "../../util/dom.js";
import { SPELL_SCHOOLS } from "../../data/conditions.js";
import { escapeText } from "../../util/sanitize.js";
import { openHomebrewForm } from "./homebrewForm.js";
import { SPELL_SCHEMA, ITEM_SCHEMA, FEATURE_SCHEMA } from "../../data/homebrewSchemas.js";

const componentString = (c) => {
  const parts = [];
  if (c?.v) parts.push("V");
  if (c?.s) parts.push("S");
  if (c?.m) parts.push(`M${c.material ? ` (${c.material})` : ""}`);
  return parts.join(", ") || "—";
};

/**
 * openSpellDetail(spell, opts?)
 *   opts.store — shows Source, My Notes, and an "Edit Spell Data" button.
 *   Overrides saved to doc.spellcasting.spellOverrides[spell.id]
 */
export function openSpellDetail(spell, opts = {}) {
  const tags = [];
  tags.push(spell.level === 0 ? "Cantrip" : `Level ${spell.level}`);
  tags.push(SPELL_SCHOOLS[spell.school]?.name || spell.school);
  if (spell.concentration) tags.push("Concentration");
  if (spell.ritual) tags.push("Ritual");
  if (spell.isEdited) tags.push("✎ edited");

  const body = el("div");
  body.append(el("div", { class: "row row--wrap", style: { gap: "1rem", marginBottom: "1rem" } },
    kv("Casting Time", spell.castingTime),
    kv("Range", spell.range),
    kv("Components", componentString(spell.components)),
    kv("Duration", spell.duration)
  ));
  body.append(el("p", { html: escapeText(spell.description || spell.desc || "").replace(/\n\n/g, "</p><p>") }));
  if (spell.higherLevel) {
    body.append(el("h5", {}, "At higher levels"));
    body.append(el("p", {}, spell.higherLevel));
  }
  if (spell.classes?.length) {
    body.append(el("div", { class: "tooltip__meta" }, `Classes: ${spell.classes.join(", ")}`));
  }

  let modal;
  const footer = [];

  if (opts.store && spell.id) {
    const sc = opts.store.doc.spellcasting || {};
    body.append(renderSourceEditor({
      initial: sc.spellSources?.[spell.id] || spell.source || "",
      onSave: v => opts.store.update(x => {
        x.spellcasting.spellSources = x.spellcasting.spellSources || {};
        if (v) x.spellcasting.spellSources[spell.id] = v;
        else delete x.spellcasting.spellSources[spell.id];
      })
    }));
    body.append(renderNotesEditor({
      title: "My Notes",
      initial: sc.spellNotes?.[spell.id] || "",
      onSave: v => opts.store.update(x => {
        x.spellcasting.spellNotes = x.spellcasting.spellNotes || {};
        if (v) x.spellcasting.spellNotes[spell.id] = v;
        else delete x.spellcasting.spellNotes[spell.id];
      })
    }));

    // "Edit Spell Data" — opens homebrewForm pre-filled with current (possibly overridden) data
    const editBtn = el("button", {
      class: "btn btn--sm btn--ghost",
      onclick: () => {
        modal?.close();
        const sc = opts.store.doc.spellcasting || {};
        // Inject stored source/notes into the form initial values
        const initialData = {
          ...SPELL_SCHEMA.disassemble(spell),
          _acquiredFrom: sc.spellSources?.[spell.id] || spell._acquiredFrom || "",
          _userNotes: sc.spellNotes?.[spell.id] || spell._userNotes || ""
        };
        openHomebrewForm({
          schema: SPELL_SCHEMA,
          initial: initialData,
          onSave: (record) => {
            // Extract and route personal tracking fields separately
            const { _acquiredFrom, _userNotes, ...spellData } = record;
            opts.store.update(x => {
              // Save source/notes to their buckets
              x.spellcasting.spellSources = x.spellcasting.spellSources || {};
              if (_acquiredFrom) x.spellcasting.spellSources[spell.id] = _acquiredFrom;
              else delete x.spellcasting.spellSources[spell.id];
              x.spellcasting.spellNotes = x.spellcasting.spellNotes || {};
              if (_userNotes) x.spellcasting.spellNotes[spell.id] = _userNotes;
              else delete x.spellcasting.spellNotes[spell.id];

              if (spell.custom) {
                // Custom spell: update in-place
                const idx = (x.spellcasting.custom || []).findIndex(s => s.id === spell.id);
                if (idx >= 0) x.spellcasting.custom[idx] = { ...spellData, id: spell.id };
              } else {
                // SRD spell: save as override
                x.spellcasting.spellOverrides = x.spellcasting.spellOverrides || {};
                x.spellcasting.spellOverrides[spell.id] = spellData;
              }
            });
          }
        });
      }
    }, "✎ Edit Spell Data");

    // "Revert to Original" — only shown if there are overrides
    const isOverridden = !!(opts.store.doc.spellcasting?.spellOverrides?.[spell.id]);
    if (isOverridden && !spell.custom) {
      const revertBtn = el("button", {
        class: "btn btn--sm btn--ghost",
        onclick: () => {
          modal?.close();
          opts.store.update(x => {
            if (x.spellcasting.spellOverrides) delete x.spellcasting.spellOverrides[spell.id];
          });
        }
      }, "↺ Revert to Original");
      footer.push(revertBtn);
    }
    footer.push(editBtn);
  }

  modal = openModal({ title: spell.name, subtitle: tags.join(" · "), body, footer: footer.length ? footer : undefined });
}

/**
 * openItemDetail(item, opts?)
 *   opts.store + opts.instanceId — shows Source, My Notes, and an "Edit Item Data" button.
 *   Overrides saved to the item instance's .overrides field.
 */
export function openItemDetail(item, opts = {}) {
  const isEdited = !!(opts.instanceId && (opts.store?.doc.equipment.items || []).find(i => i.instanceId === opts.instanceId)?.overrides);

  const body = el("div");
  const rows = [];
  if (item.type === "weapon") {
    rows.push(kv("Damage", `${item.damage} ${item.damageType}`));
    if (item.range) rows.push(kv("Range", item.range));
    rows.push(kv("Properties", (item.properties || []).join(", ") || "—"));
  }
  if (item.type === "armor") {
    rows.push(kv("Armor Class", item.ac));
    rows.push(kv("Type", item.armorType));
    if (item.strReq) rows.push(kv("Str Requirement", item.strReq));
    if (item.stealth) rows.push(kv("Stealth", item.stealth));
  }
  rows.push(kv("Weight", `${item.weight ?? 0} lb`));
  rows.push(kv("Cost", `${item.cost ?? 0} gp`));
  if (item.rarity) rows.push(kv("Rarity", item.rarity));

  body.append(el("div", { class: "row row--wrap", style: { gap: "1rem", marginBottom: "1rem" } }, ...rows));
  if (item.description) body.append(el("p", {}, item.description));

  let modal;
  const footer = [];

  if (opts.store && opts.instanceId) {
    const cur = (opts.store.doc.equipment.items || []).find(i => i.instanceId === opts.instanceId);
    body.append(renderSourceEditor({
      initial: cur?.source || "",
      onSave: v => opts.store.update(x => {
        const i = (x.equipment.items || []).find(i => i.instanceId === opts.instanceId);
        if (i) i.source = v || "";
      })
    }));
    body.append(renderNotesEditor({
      title: "My Notes",
      initial: cur?.notes || "",
      onSave: v => opts.store.update(x => {
        const i = (x.equipment.items || []).find(i => i.instanceId === opts.instanceId);
        if (i) i.notes = v;
      })
    }));

    const editBtn = el("button", {
      class: "btn btn--sm btn--ghost",
      onclick: () => {
        modal?.close();
        // Inject stored source/notes into the form initial values
        const initialData = {
          ...ITEM_SCHEMA.disassemble(item),
          _acquiredFrom: cur?.source || item._acquiredFrom || "",
          _userNotes: cur?.notes || item._userNotes || ""
        };
        openHomebrewForm({
          schema: ITEM_SCHEMA,
          initial: initialData,
          onSave: (record) => {
            // Extract and route personal tracking fields separately
            const { _acquiredFrom, _userNotes, ...itemData } = record;
            const isCustomInstance = !cur?.itemId && !!cur?.custom;
            opts.store.update(x => {
              const i = (x.equipment.items || []).find(i => i.instanceId === opts.instanceId);
              if (!i) return;
              // Save source/notes to per-instance fields
              i.source = _acquiredFrom || "";
              i.notes = _userNotes || "";
              if (isCustomInstance) {
                i.custom = { ...itemData, id: item.id || itemData.id };
              } else {
                // SRD item: store as per-instance override
                i.overrides = itemData;
              }
            });
          }
        });
      }
    }, "✎ Edit Item Data");

    if (cur?.overrides && cur.itemId) {
      const revertBtn = el("button", {
        class: "btn btn--sm btn--ghost",
        onclick: () => {
          modal?.close();
          opts.store.update(x => {
            const i = (x.equipment.items || []).find(i => i.instanceId === opts.instanceId);
            if (i) delete i.overrides;
          });
        }
      }, "↺ Revert to Original");
      footer.push(revertBtn);
    }
    footer.push(editBtn);
  }

  const subtitle = isEdited ? `${item.type} · ✎ edited` : item.type;
  modal = openModal({ title: item.name, subtitle, body, footer: footer.length ? footer : undefined });
}

/**
 * openFeatureDetail(feature, opts?)
 *   opts.store — shows Source override, My Notes, and an "Edit Feature Data" button.
 *   Overrides saved to doc.features.overrides[feature.id]
 */
export function openFeatureDetail(feature, opts = {}) {
  const body = el("div");
  body.append(el("p", {}, feature.desc || ""));

  let modal;
  const footer = [];

  if (opts.store && feature.id) {
    body.append(renderSourceEditor({
      initial: opts.store.doc.features?.sources?.[feature.id] || "",
      onSave: v => opts.store.update(x => {
        x.features = x.features || {};
        x.features.sources = x.features.sources || {};
        if (v) x.features.sources[feature.id] = v;
        else delete x.features.sources[feature.id];
      })
    }));
    body.append(renderNotesEditor({
      title: "My Notes",
      initial: opts.store.doc.features?.notes?.[feature.id] || feature.userNotes || "",
      onSave: v => opts.store.update(x => {
        x.features = x.features || {};
        x.features.notes = x.features.notes || {};
        if (v) x.features.notes[feature.id] = v;
        else delete x.features.notes[feature.id];
      })
    }));

    const editBtn = el("button", {
      class: "btn btn--sm btn--ghost",
      onclick: () => {
        modal?.close();
        // Inject stored notes into the form initial values
        const initialData = {
          ...FEATURE_SCHEMA.disassemble(feature),
          _userNotes: opts.store.doc.features?.notes?.[feature.id] || feature._userNotes || feature.userNotes || ""
        };
        openHomebrewForm({
          schema: FEATURE_SCHEMA,
          initial: initialData,
          onSave: (record) => {
            // Extract and route personal tracking fields separately
            const { _userNotes, ...featureData } = record;
            opts.store.update(x => {
              // Save notes to the notes bucket
              x.features = x.features || {};
              x.features.notes = x.features.notes || {};
              if (_userNotes) x.features.notes[feature.id] = _userNotes;
              else delete x.features.notes[feature.id];

              if (feature.kind === "custom") {
                // Custom feature: edit in-place
                const idx = (x.features.custom || []).findIndex(f => f.id === feature.id);
                if (idx >= 0) x.features.custom[idx] = { ...featureData, id: feature.id };
              } else {
                // Built-in feature: save as override
                x.features.overrides = x.features.overrides || {};
                x.features.overrides[feature.id] = featureData;
              }
            });
          }
        });
      }
    }, "✎ Edit Feature Data");

    const isOverridden = !!(opts.store.doc.features?.overrides?.[feature.id]) && feature.kind !== "custom";
    if (isOverridden) {
      const revertBtn = el("button", {
        class: "btn btn--sm btn--ghost",
        onclick: () => {
          modal?.close();
          opts.store.update(x => {
            if (x.features?.overrides) delete x.features.overrides[feature.id];
          });
        }
      }, "↺ Revert to Original");
      footer.push(revertBtn);
    }
    footer.push(editBtn);
  }

  const subtitle = `${feature.source || ""}${feature.level ? ` · Level ${feature.level}` : ""}${feature.isEdited ? " · ✎ edited" : ""}`;
  modal = openModal({ title: feature.name, subtitle, body, footer: footer.length ? footer : undefined });
}

// ─── Shared editors ───────────────────────────────────────────────────────────

function renderSourceEditor({ initial, onSave }) {
  const wrap = el("div", { class: "notes-editor" });
  wrap.append(el("div", { class: "notes-editor__label" }, "Acquired From / Source"));
  const inp = el("input", {
    type: "text",
    placeholder: "e.g. Reward from quest, DM granted, Learned from wizard…",
    value: initial || "",
    style: { width: "100%", padding: "var(--sp-1) var(--sp-2)", background: "var(--c-bg-0)", border: "1px solid var(--c-border)", color: "var(--c-text)", borderRadius: "var(--r-sm)", fontFamily: "inherit", fontSize: "var(--fs-sm)" }
  });
  let timer = null;
  const save = () => onSave(inp.value.trim());
  inp.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(save, 400); });
  inp.addEventListener("blur", save);
  wrap.append(inp);
  return wrap;
}

function renderNotesEditor({ title, initial, onSave }) {
  const wrap = el("div", { class: "notes-editor" });
  wrap.append(el("div", { class: "notes-editor__label" }, title));
  const ta = el("textarea", {
    placeholder: "Add your own notes, tweaks, or flavor...",
    value: initial || ""
  });
  let timer = null;
  const save = () => onSave(ta.value);
  ta.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(save, 400); });
  ta.addEventListener("blur", save);
  wrap.append(ta);
  return wrap;
}

function kv(label, value) {
  return el("div", {},
    el("div", { class: "label", style: { marginBottom: 0 } }, label),
    el("div", {}, String(value ?? "—"))
  );
}
