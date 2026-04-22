import { el } from "../../util/dom.js";
import { openModal } from "./modal.js";
import { blankCharacter } from "../../engine/characterFactory.js";
import { deriveAll } from "../../engine/derive.js";
import { saveCharacter } from "../../storage/idbStore.js";
import { updateRosterEntry } from "../../storage/localStore.js";
import { navigate } from "../router.js";
import { toast } from "./toast.js";

/**
 * Blank-slate entry flow for a character you already have worked up elsewhere.
 * Prompts only for name + level; everything else is filled in via edit mode on
 * the sheet (AC/HP/abilities/skills/spells/inventory/features all have overrides).
 */
export function openExistingCharacterForm() {
  const state = { name: "", level: 1 };

  const nameInput = el("input", {
    type: "text",
    placeholder: "e.g. Raylock",
    autofocus: true,
    oninput: e => { state.name = e.target.value; updateSubmit(); },
    onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }
  });

  const levelInput = el("input", {
    type: "number",
    min: 1, max: 20, value: 1,
    oninput: e => { state.level = parseInt(e.target.value, 10) || 1; },
    onkeydown: e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }
  });

  const body = el("div", { class: "form-grid" },
    el("label", { class: "field field--full" },
      el("div", { class: "field__label" }, "Character Name"),
      nameInput
    ),
    el("label", { class: "field" },
      el("div", { class: "field__label" }, "Level"),
      levelInput
    ),
    el("p", { class: "muted", style: { gridColumn: "1 / -1", marginTop: "0" } },
      "Leave race, class, abilities, HP, and everything else blank — fill them in on the sheet using Edit Stats."
    )
  );

  const submitBtn = el("button", {
    class: "btn btn--primary",
    disabled: true,
    onclick: submit
  }, "Create & Open");

  const cancelBtn = el("button", {
    class: "btn btn--ghost",
    onclick: () => modal.close()
  }, "Cancel");

  const modal = openModal({
    title: "Add Existing Character",
    subtitle: "Blank slate for a character that's already established — edit everything from the sheet.",
    body,
    footer: [cancelBtn, submitBtn]
  });

  // Autofocus doesn't always win against the modal's focus handling.
  setTimeout(() => nameInput.focus(), 0);

  function updateSubmit() {
    submitBtn.disabled = !state.name.trim();
  }

  async function submit() {
    const name = state.name.trim();
    if (!name) return;
    submitBtn.disabled = true;

    const level = Math.max(1, Math.min(20, parseInt(state.level, 10) || 1));
    const doc = blankCharacter();
    doc.identity.name = name;
    doc.progression.classes[0].level = level;
    doc.updatedAt = new Date().toISOString();

    try {
      await saveCharacter(doc);
      await updateRosterEntry(doc, deriveAll(doc));
      toast(`${name} added`);
      modal.close();
      navigate(`/sheet/${doc.id}`);
    } catch (err) {
      submitBtn.disabled = false;
      toast(`Failed to add: ${err.message}`);
    }
  }
}
