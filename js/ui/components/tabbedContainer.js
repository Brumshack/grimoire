// Nested tabbed container. Wires .mtab / .stab inside the given root.
// Naming convention (keep these four prefixes exactly):
//   <div class="mtab" data-main="X">        → pane with id "mp-X"
//   <div class="stab" data-group="X" data-sub="Y"> → pane with id "sp-X-Y"
// `active` class marks the current tab button AND pane.
// Exactly one .mtab.active + .main-pane.active at any time.
// Within each main-pane, exactly one .stab.active + .sub-pane.active.

export function initTabbedContainer(root) {
  if (!root) return;

  root.querySelectorAll(".mtab").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.main;
      root.querySelectorAll(".mtab").forEach(b => b.classList.remove("active"));
      root.querySelectorAll(".main-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const pane = root.querySelector("#mp-" + t);
      if (pane) pane.classList.add("active");
    });
  });

  root.querySelectorAll(".stab").forEach(btn => {
    btn.addEventListener("click", () => {
      const g = btn.dataset.group, s = btn.dataset.sub;
      root.querySelectorAll(`.stab[data-group="${g}"]`).forEach(b => b.classList.remove("active"));
      root.querySelectorAll(`[id^="sp-${g}-"]`).forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const pane = root.querySelector(`#sp-${g}-${s}`);
      if (pane) pane.classList.add("active");
    });
  });
}
