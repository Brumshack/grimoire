const CONFIG = {
  ALLOWED_TAGS: ["p","br","b","strong","i","em","u","s","ul","ol","li","blockquote","h3","h4","h5","h6","a","code","pre","hr"],
  ALLOWED_ATTR: ["href","title","target","rel"],
  ALLOW_DATA_ATTR: false
};

export function sanitizeHtml(dirty) {
  if (typeof dirty !== "string") return "";
  if (!window.DOMPurify) {
    console.warn("DOMPurify unavailable; escaping text");
    return escapeText(dirty);
  }
  return window.DOMPurify.sanitize(dirty, CONFIG);
}

export function escapeText(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
