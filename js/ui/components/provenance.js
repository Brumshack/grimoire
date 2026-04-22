import { escapeText } from "../../util/sanitize.js";

/**
 * Build an HTML body string for a tooltip that includes a base description,
 * an optional "Sources" list, and optional user notes.
 *
 *   buildTooltipHtml({
 *     baseText: "Proficient.",
 *     sources: [{ label: "Race — High Elf" }, ...],
 *     userNotes: "Use this against fiends."
 *   })
 */
export function buildTooltipHtml({ baseText, sources, acquiredFrom, userNotes } = {}) {
  let out = "";

  // "Acquired from" shown first — it's the most useful quick-reference context
  if (acquiredFrom && acquiredFrom.trim()) {
    out += `<b>Acquired from:</b> ${escapeText(acquiredFrom.trim())}`;
  }

  if (baseText) {
    out += `${out ? "<br><br>" : ""}${escapeText(baseText).replace(/\n/g, "<br>")}`;
  }

  const srcList = (sources || []).filter(Boolean);
  if (srcList.length) {
    const items = srcList.map(s => `<li>${escapeText(s.label || "")}</li>`).join("");
    out += `${out ? "<br><br>" : ""}<b>Sources</b><ul>${items}</ul>`;
  }

  if (userNotes && userNotes.trim()) {
    const noteHtml = escapeText(userNotes.trim()).replace(/\n/g, "<br>");
    out += `${out ? "<br>" : ""}<b>My Notes</b><br>${noteHtml}`;
  }

  return out;
}

/** Backward-compatible alias used by skill/save tooltips. */
export function buildSourceHtml(baseText, sources) {
  return buildTooltipHtml({ baseText, sources });
}
