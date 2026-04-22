import { el, mount } from "../../util/dom.js";
import { sanitizeHtml, escapeText } from "../../util/sanitize.js";

const HOVER_DELAY = 300;
const LONGPRESS_DELAY = 500;
const TOUCH_SLOP = 10;

let activeNode = null;
let hoverTimer = null;
let longpressTimer = null;
let touchStart = null;

const isCoarse = () => window.matchMedia("(pointer: coarse)").matches;

/** Attach tooltip behavior to an element.
 *  @param {Element} elm
 *  @param {object|function} data — { title, summary, sourceRef, acquiredFrom, html, onMore }
 */
export function bindTooltip(elm, data) {
  elm.tabIndex = elm.tabIndex || 0;
  const get = () => (typeof data === "function" ? data() : data);

  // Desktop hover
  elm.addEventListener("mouseenter", () => {
    if (isCoarse()) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showTooltip(elm, get()), HOVER_DELAY);
  });
  elm.addEventListener("mouseleave", () => {
    clearTimeout(hoverTimer);
    hideTooltip();
  });
  // Keyboard focus
  elm.addEventListener("focus", () => showTooltip(elm, get()));
  elm.addEventListener("blur", () => hideTooltip());

  // Touch long-press
  elm.addEventListener("touchstart", (e) => {
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    clearTimeout(longpressTimer);
    longpressTimer = setTimeout(() => {
      e.preventDefault();
      showTooltip(elm, get(), { touch: true });
    }, LONGPRESS_DELAY);
  }, { passive: false });
  elm.addEventListener("touchmove", (e) => {
    if (!touchStart) return;
    const dx = e.touches[0].clientX - touchStart.x;
    const dy = e.touches[0].clientY - touchStart.y;
    if (Math.hypot(dx, dy) > TOUCH_SLOP) clearTimeout(longpressTimer);
  });
  elm.addEventListener("touchend", () => clearTimeout(longpressTimer));
  elm.addEventListener("contextmenu", (e) => {
    if (isCoarse()) e.preventDefault();
  });
}

function showTooltip(anchor, data, { touch = false } = {}) {
  if (!data) return;
  const root = document.getElementById("tooltip-root");
  if (!root) return;

  // data.html comes from buildTooltipHtml which already escapes all user
  // content — set it directly so tags like <b> and <br> render correctly
  // even when DOMPurify is not loaded. Plain-text summary is escaped inline.
  const bodyHtml = data.html
    ? (window.DOMPurify ? sanitizeHtml(data.html) : data.html)
    : escapeText(data.summary || "");
  const tip = el("div", { class: "tooltip" + (touch ? " tooltip--touch" : ""), role: "tooltip" });
  if (data.title) tip.append(el("div", { class: "tooltip__title" }, data.title));
  if (bodyHtml) {
    const body = el("div", { class: "tooltip__body" });
    body.innerHTML = bodyHtml;
    tip.append(body);
  }
  const metaBits = [];
  if (data.sourceRef) metaBits.push(data.sourceRef);
  if (data.acquiredFrom) metaBits.push(data.acquiredFrom);
  if (metaBits.length) tip.append(el("div", { class: "tooltip__meta" }, metaBits.join(" · ")));
  if (data.onMore) {
    const more = el("span", { class: "tooltip__more", onclick: (e) => { e.stopPropagation(); hideTooltip(); data.onMore(); } }, "More");
    tip.append(more);
  }

  mount(root, tip);
  positionTooltip(tip, anchor);
  activeNode = tip;

  if (touch) {
    const off = (e) => {
      if (!tip.contains(e.target)) { hideTooltip(); document.removeEventListener("click", off); }
    };
    setTimeout(() => document.addEventListener("click", off), 0);
  }
}

function positionTooltip(tip, anchor) {
  const r = anchor.getBoundingClientRect();
  const tR = tip.getBoundingClientRect();
  let top = r.bottom + 8;
  let left = r.left + r.width / 2 - tR.width / 2;
  if (top + tR.height > window.innerHeight - 8) top = r.top - tR.height - 8;
  left = Math.max(8, Math.min(left, window.innerWidth - tR.width - 8));
  tip.style.top = `${top}px`;
  tip.style.left = `${left}px`;
}

export function hideTooltip() {
  const root = document.getElementById("tooltip-root");
  if (root) mount(root, null);
  activeNode = null;
}
