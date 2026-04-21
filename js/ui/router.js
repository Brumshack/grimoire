/**
 * Hash-based router. Routes:
 *   #/roster           → roster
 *   #/creator          → new character
 *   #/sheet/:id        → character sheet
 */

const routes = [];

export function defineRoute(pattern, handler) {
  const keys = [];
  const re = new RegExp(
    "^" +
      pattern.replace(/:([^/]+)/g, (_, k) => { keys.push(k); return "([^/]+)"; }) +
      "$"
  );
  routes.push({ re, keys, handler });
}

function parse(hash) {
  const path = hash.startsWith("#") ? hash.slice(1) : hash;
  return path || "/roster";
}

export function resolve() {
  const path = parse(location.hash);
  for (const r of routes) {
    const m = r.re.exec(path);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      return r.handler(params);
    }
  }
  navigate("/roster", true);
}

export function navigate(path, replace = false) {
  const hash = "#" + (path.startsWith("/") ? path : `/${path}`);
  if (replace) history.replaceState(null, "", hash);
  else location.hash = hash;
  if (replace) resolve();
}

export function initRouter() {
  window.addEventListener("hashchange", resolve);
  resolve();
}
