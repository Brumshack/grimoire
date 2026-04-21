import { el } from "../../util/dom.js";

export function toast(message, { duration = 2200 } = {}) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const node = el("div", { class: "toast" }, message);
  root.append(node);
  setTimeout(() => node.remove(), duration);
}
