import { el } from "../../util/dom.js";
import { openModal } from "./modal.js";
import { uuid } from "../../util/id.js";
import { toast } from "./toast.js";

/**
 * Open a modal with a form built from a schema (see js/data/homebrewSchemas.js).
 *
 *   openHomebrewForm({
 *     schema: SPELL_SCHEMA,
 *     initial: existingRecord,        // optional — edit mode
 *     onSave: (assembledRecord) => {  // called with the stored-shape record
 *       store.update(d => { d.spellcasting.custom.push(assembledRecord); });
 *     }
 *   });
 */
export function openHomebrewForm({ schema, initial, onSave }) {
  const isEdit = !!initial;
  const state = seedState(schema, initial);

  const body = el("div", { class: "homebrew-form" });
  const renderFields = () => {
    body.innerHTML = "";
    for (const f of schema.fields) {
      if (typeof f.showIf === "function" && !f.showIf(state)) continue;
      body.append(renderField(f, state, renderFields));
    }
  };
  renderFields();

  const saveBtn = el("button", { class: "btn btn--primary", onclick: save }, isEdit ? "Save" : "Add");
  const cancelBtn = el("button", { class: "btn btn--ghost" }, "Cancel");

  const modal = openModal({
    title: isEdit ? `Edit ${schema.title}` : `New ${schema.title}`,
    body,
    footer: [cancelBtn, saveBtn],
    wide: true
  });
  cancelBtn.addEventListener("click", () => modal.close());

  function save() {
    for (const f of schema.fields) {
      if (f.required && !String(state[f.key] ?? "").trim()) {
        toast(`${f.label} is required.`);
        return;
      }
    }
    if (!state.id) state.id = `custom-${uuid()}`;
    const record = schema.assemble(state);
    onSave?.(record);
    modal.close();
  }
}

function seedState(schema, initial) {
  const base = {};
  for (const f of schema.fields) {
    if (f.default !== undefined) base[f.key] = f.default;
  }
  if (initial) {
    const d = schema.disassemble ? schema.disassemble(initial) : initial;
    Object.assign(base, d);
  }
  return base;
}

function renderField(f, state, rerender) {
  const labelId = `hbf-${f.key}`;
  const label = el("label", { class: "homebrew-form__label", for: labelId }, f.label + (f.required ? " *" : ""));
  const help = f.help ? el("div", { class: "homebrew-form__help" }, f.help) : null;
  let input;

  const syncAndMaybeRerender = () => {
    // re-run showIf conditions whenever a field that others depend on changes
    if (f.key === "type" || f.rerenders) rerender();
  };

  if (f.type === "textarea") {
    input = el("textarea", {
      id: labelId,
      rows: f.rows || 4,
      placeholder: f.placeholder || "",
      value: state[f.key] ?? "",
      oninput: (e) => { state[f.key] = e.target.value; }
    });
  } else if (f.type === "select") {
    input = el("select", {
      id: labelId,
      onchange: (e) => { state[f.key] = e.target.value; syncAndMaybeRerender(); }
    });
    for (const opt of f.options) {
      const o = el("option", { value: opt.value }, opt.label);
      if (String(state[f.key] ?? "") === String(opt.value)) o.selected = true;
      input.append(o);
    }
    // ensure `type` field triggers conditional re-render
    if (f.key === "type") input.addEventListener("change", rerender);
  } else if (f.type === "checkbox") {
    input = el("input", {
      id: labelId,
      type: "checkbox",
      checked: !!state[f.key],
      onchange: (e) => { state[f.key] = e.target.checked; syncAndMaybeRerender(); }
    });
    return el("div", { class: "homebrew-form__row homebrew-form__row--check" }, input, label, help);
  } else if (f.type === "number") {
    input = el("input", {
      id: labelId,
      type: "number",
      min: f.min != null ? String(f.min) : undefined,
      max: f.max != null ? String(f.max) : undefined,
      step: f.step != null ? String(f.step) : "1",
      placeholder: f.placeholder || "",
      value: state[f.key] ?? "",
      oninput: (e) => { state[f.key] = e.target.value === "" ? null : Number(e.target.value); }
    });
  } else {
    input = el("input", {
      id: labelId,
      type: "text",
      placeholder: f.placeholder || "",
      value: state[f.key] ?? "",
      oninput: (e) => { state[f.key] = e.target.value; }
    });
  }

  return el("div", { class: "homebrew-form__row" }, label, input, help);
}
