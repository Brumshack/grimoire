import { el, clear } from "../../util/dom.js";

/**
 * A small floating popover that sets/clears a single override field.
 *
 *   openOverridePopover({
 *     anchorEl,        // DOM element to position near
 *     label,           // "AC Override", "STR Override", etc.
 *     type,            // "number" | "text" | "ability"
 *     currentValue,    // what's stored right now (may be null)
 *     baseHint,        // label showing the auto-calculated base value
 *     onSave(value)    // value=null clears the override
 *   })
 */
export function openOverridePopover({ anchorEl, label, type = "number", currentValue, baseHint, onSave }) {
  closeExisting();

  const pop = el("div", { class: "override-pop" });
  pop.append(el("div", { class: "override-pop__title" }, label));
  if (baseHint != null) {
    pop.append(el("div", { style: { fontSize: "var(--fs-xs)", color: "var(--c-text-mute)" } }, `Auto: ${baseHint}`));
  }

  let input;
  if (type === "ability") {
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

  const clearBtn = el("button", { class: "btn btn--sm btn--ghost" }, "Clear");
  const saveBtn = el("button", { class: "btn btn--sm btn--primary" }, "Save");
  pop.append(el("div", { class: "override-pop__row" }, clearBtn, saveBtn));

  document.body.append(pop);
  position(pop, anchorEl);
  input.focus();
  if (input.select) input.select();

  clearBtn.addEventListener("click", () => { onSave(null); close(); });
  saveBtn.addEventListener("click", () => {
    const raw = input.value;
    let val;
    if (raw === "" || raw == null) val = null;
    else if (type === "number") { const n = Number(raw); val = Number.isFinite(n) ? n : null; }
    else val = raw;
    onSave(val);
    close();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
    if (e.key === "Escape") close();
  });

  // close on click outside
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
  const popW = 240;
  let left = Math.min(window.innerWidth - popW - 8, Math.max(8, r.left + window.scrollX));
  let top = r.bottom + window.scrollY + 6;
  // flip if it would go off the bottom
  if (top + 200 > window.innerHeight + window.scrollY) {
    top = r.top + window.scrollY - 6 - 200;
  }
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
}
