export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k === "dataset" && typeof v === "object") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "html") node.innerHTML = v;
    else if (k in node) { try { node[k] = v; } catch { node.setAttribute(k, v); } }
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

export function mount(parent, content) {
  clear(parent);
  if (Array.isArray(content)) content.forEach(n => parent.append(n));
  else if (content != null) parent.append(content);
}

export function on(node, evt, selectorOrFn, maybeFn) {
  if (typeof selectorOrFn === "function") {
    node.addEventListener(evt, selectorOrFn);
    return () => node.removeEventListener(evt, selectorOrFn);
  }
  const handler = (e) => {
    const target = e.target.closest(selectorOrFn);
    if (target && node.contains(target)) maybeFn(e, target);
  };
  node.addEventListener(evt, handler);
  return () => node.removeEventListener(evt, handler);
}
