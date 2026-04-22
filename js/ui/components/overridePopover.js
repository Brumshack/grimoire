import { el, clear } from "../../util/dom.js";

/**
 * A small floating popover for setting/clearing an override.
 *
 *   openOverridePopover({
 *     anchorEl,          // DOM element to position near
 *     label,             // "AC Override", "STR Override", etc.
 *     type,              // "number" | "text" | "ability" | "select"
 *     currentValue,      // current stored value (may be null/"")
 *     baseHint,          // shows "Auto: X" line when provided
 *     onSave(value),     // value=null clears the override
 *     options,           // [{value, label}] array — required when type="select"
 *     currentNote,       // current note string (optional)
 *     onSaveNote(note),  // called with note string or null when saving
 *     currentSource,     // current source string (optional)
 *     onSaveSource(src), // called with source string or null when saving
 *   })
 */
export function openOverridePopover({
  anchorEl, label, type = "number", currentValue, baseHint, onSave,
  options, currentNote, onSaveNote, currentSource, onSaveSource
}) {
  closeExisting();

  const hasNoteFields = !!(onSaveNote || onSaveSource);
  const pop = el("div", { class: "override-pop" });
  if (hasNoteFields) pop.style.minWidth = "260px";

  pop.append(el("div", { class: "override-pop__title" }, label));
  if (baseHint != null) {
    pop.append(el("div", { style: { fontSize: "var(--fs-xs)", color: "var(--c-text-mute)" } }, `Auto: ${baseHint}`));
  }

  // ── main value input ──
  let input;
  if (type === "select" && options) {
    input = el("select");
    for (const opt of options) {
      const o = el("option", { value: opt.value }, opt.label);
      if ((currentValue ?? "") === opt.value) o.selected = true;
      input.append(o);
    }
  } else if (type === "ability") {
    input = el("select");
    for (const a of ["", "str", "dex", "con", "int", "wis", "cha"]) {
      const o = el("option", { value: a }, a ? a.toUpperCase() : "— auto —");
      if ((currentValue ?? "") === a) o.selected = true;
      input.append(o);
    }
  } else {
    input = el("input", {
      type,
      value: currentValue ?? "",
      placeholder: baseHint != null ? `leave blank → ${baseHint}` : ""
    });
  }
  pop.append(input);

  // ── optional source + note fields ──
  let sourceInput, noteInput;
  if (onSaveSource !== undefined) {
    pop.append(el("div", { class: "override-pop__section-label" }, "Source"));
    sourceInput = el("input", {
      type: "text",
      value: currentSource ?? "",
      placeholder: "e.g. Magic item, DM ruling…"
    });
    pop.append(sourceInput);
  }
  if (onSaveNote !== undefined) {
    pop.append(el("div", { class: "override-pop__section-label" }, "Notes"));
    noteInput = el("textarea", {
      rows: 2,
      placeholder: "Optional notes shown on hover…"
    });
    noteInput.value = currentNote ?? "";
    pop.append(noteInput);
  }

  const clearBtn = el("button", { class: "btn btn--sm btn--ghost" }, "Clear");
  const saveBtn  = el("button", { class: "btn btn--sm btn--primary" }, "Save");
  pop.append(el("div", { class: "override-pop__row" }, clearBtn, saveBtn));

  document.body.append(pop);
  position(pop, anchorEl);
  input.focus();
  if (input.select) input.select();

  clearBtn.addEventListener("click", () => {
    onSave(null);
    if (onSaveNote)   onSaveNote(null);
    if (onSaveSource) onSaveSource(null);
    close();
  });

  saveBtn.addEventListener("click", () => {
    const raw = type === "select" || type === "ability" ? input.value : input.value;
    let val;
    if (raw === "" || raw == null) val = null;
    else if (type === "number") { const n = Number(raw); val = Number.isFinite(n) ? n : null; }
    else val = raw;

    onSave(val);
    if (onSaveNote)   onSaveNote(noteInput?.value?.trim() || null);
    if (onSaveSource) onSaveSource(sourceInput?.value?.trim() || null);
    close();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && type !== "select" && type !== "ability") saveBtn.click();
    if (e.key === "Escape") close();
  });

  const outside = (e) => {
    if (!pop.contains(e.target) && e.target !== anchorEl && !anchorEl.contains?.(e.target)) close();
  };
  setTimeout(() => document.addEventListener("mousedown", outside), 0);

  function close() {
    document.removeEventListener("mousedown", outside);
    pop.remove();
    activePopover = null;
  }
  activePopover = { close };
}

let activePopover = null;
function closeExisting() { if (activePopover) activePopover.close(); }

function position(pop, anchor) {
  const r = anchor.getBoundingClientRect();
  const popW = 280;
  let left = Math.min(window.innerWidth - popW - 8, Math.max(8, r.left + window.scrollX));
  let top = r.bottom + window.scrollY + 6;
  if (top + 320 > window.innerHeight + window.scrollY) {
    top = r.top + window.scrollY - 6 - 320;
  }
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}
