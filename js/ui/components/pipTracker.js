import { el } from "../../util/dom.js";

/**
 * Generic pip row. Click a pip to toggle used/unused.
 *  total: number of pips
 *  used: number currently used (fills left to right)
 *  onChange(newUsed): callback
 *  variant: optional class suffix
 */
export function renderPips({ total, used, onChange, variant = "" }) {
  const cls = variant ? `pip pip--${variant}` : "pip";
  const pips = [];
  for (let i = 0; i < total; i++) {
    const idx = i;
    const isUsed = idx < used;
    pips.push(el("button", {
      class: cls, type: "button",
      dataset: { used: String(isUsed) },
      onclick: () => {
        if (!isUsed) onChange(idx + 1);
        else onChange(idx);
      },
      "aria-label": isUsed ? "used" : "unused"
    }));
  }
  return el("div", { class: "pips" }, ...pips);
}
