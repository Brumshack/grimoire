import { el, mount } from "../../util/dom.js";
import { sanitizeHtml } from "../../util/sanitize.js";

let activeOnClose = null;

export function openModal({ title, subtitle, body, footer, onClose, wide = false }) {
  const root = document.getElementById("modal-root");
  if (!root) return;

  const backdrop = el("div", { class: "modal-backdrop", onclick: close });
  const closeBtn = el("button", { class: "modal__close", onclick: close, "aria-label": "Close" }, "✕");
  const modal = el("div", { class: "modal", role: "dialog", "aria-modal": "true" });
  if (wide) modal.style.width = "min(900px, 94vw)";
  modal.append(closeBtn);
  if (title) modal.append(el("div", { class: "modal__title" }, title));
  if (subtitle) modal.append(el("div", { class: "modal__sub" }, subtitle));

  const bodyNode = el("div", { class: "modal__body" });
  if (typeof body === "string") bodyNode.innerHTML = sanitizeHtml(body);
  else if (body instanceof Node) bodyNode.append(body);
  else if (Array.isArray(body)) body.forEach(n => bodyNode.append(n));
  modal.append(bodyNode);

  if (footer) {
    const f = el("div", { class: "modal__footer", style: { marginTop: "1.5rem", display: "flex", gap: ".5rem", justifyContent: "flex-end" } });
    if (Array.isArray(footer)) footer.forEach(n => f.append(n));
    else if (footer instanceof Node) f.append(footer);
    modal.append(f);
  }

  mount(root, [backdrop, modal]);
  root.setAttribute("aria-hidden", "false");
  activeOnClose = onClose;

  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  function close() {
    document.removeEventListener("keydown", onKey);
    mount(root, null);
    root.setAttribute("aria-hidden", "true");
    if (typeof activeOnClose === "function") activeOnClose();
    activeOnClose = null;
  }

  return { close };
}
