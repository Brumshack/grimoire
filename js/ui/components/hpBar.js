import { el } from "../../util/dom.js";

/** HP bar + quick edit. `store` is the CharacterStore. */
export function renderHpBar(store) {
  const c = store.doc;
  const cur = c.combat.currentHp ?? 0;
  const max = Math.max(1, c.combat.maxHp ?? 1);
  const temp = c.combat.tempHp ?? 0;

  const pct = Math.max(0, Math.min(100, (cur / max) * 100));
  const color = hpColor(pct);
  const tempPct = Math.max(0, Math.min(100 - pct, (temp / max) * 100));

  const delta = el("input", { class: "input", type: "number", min: "1", placeholder: "±HP" });
  delta.style.width = "64px";

  const apply = (sign) => {
    const v = parseInt(delta.value, 10);
    if (!Number.isFinite(v) || v < 1) return;
    store.update(doc => {
      if (sign === 1) {
        doc.combat.currentHp = Math.min(doc.combat.maxHp, (doc.combat.currentHp ?? 0) + v);
      } else {
        let remaining = v;
        const absorbed = Math.min(doc.combat.tempHp ?? 0, remaining);
        doc.combat.tempHp = (doc.combat.tempHp ?? 0) - absorbed;
        remaining -= absorbed;
        doc.combat.currentHp = Math.max(0, (doc.combat.currentHp ?? 0) - remaining);
        if ((doc.combat.currentHp || 0) > 0) doc.combat.deathSaves = { successes: 0, failures: 0 };
      }
    });
    delta.value = "";
  };

  const currentEditable = el("span", {
    class: "hp__current",
    contenteditable: "true",
    spellcheck: false,
    onblur: (e) => {
      const raw = e.target.textContent.trim();
      const v = parseInt(raw, 10);
      if (Number.isFinite(v)) {
        store.update(doc => { doc.combat.currentHp = Math.max(0, Math.min(doc.combat.maxHp, v)); });
      } else {
        e.target.textContent = String(cur);
      }
    },
    onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }
  }, String(cur));

  const maxInline = el("input", {
    class: "hp__max-edit",
    type: "number", min: "1",
    value: String(max),
    style: { width: "60px", textAlign: "center", background: "transparent", border: "1px dashed transparent", color: "inherit", fontFamily: "inherit", fontSize: "inherit" },
    onchange: (e) => {
      const v = Math.max(1, parseInt(e.target.value, 10) || 1);
      store.update(doc => {
        doc.combat.maxHp = v;
        doc.combat.currentHp = Math.min(v, doc.combat.currentHp ?? v);
      });
    }
  });

  const tempInput = el("input", {
    class: "input",
    type: "number", min: "0",
    value: String(temp),
    style: { width: "56px" },
    onchange: (e) => {
      const v = Math.max(0, parseInt(e.target.value, 10) || 0);
      store.update(doc => { doc.combat.tempHp = v; });
    }
  });

  return el("div", { class: "hp" },
    el("div", { class: "hp__head" },
      el("div", {}, currentEditable, el("span", { class: "hp__slash" }, " / "), maxInline),
      el("div", { class: "row", style: { gap: ".5rem" } },
        el("span", { class: "label", style: { marginBottom: 0 } }, "Temp"),
        tempInput
      )
    ),
    el("div", { class: "hp__bar" },
      el("div", { class: "hp__fill", style: { width: `${pct}%`, backgroundColor: color } }),
      tempPct > 0 ? el("div", { class: "hp__temp-fill", style: { left: `${pct}%`, width: `${tempPct}%` } }) : null
    ),
    el("div", { class: "hp__ops" },
      delta,
      el("button", { class: "btn btn--sm btn--danger", onclick: () => apply(-1) }, "−Damage"),
      el("button", { class: "btn btn--sm", onclick: () => apply(1) }, "+Heal")
    )
  );
}

function hpColor(pct) {
  // 100→60% green, 60→25% yellow, 25→0% red, interpolated
  const green = [76, 175, 80];
  const yellow = [255, 193, 7];
  const red = [244, 67, 54];
  let rgb;
  if (pct >= 60) {
    const t = (pct - 60) / 40;
    rgb = lerp(yellow, green, t);
  } else if (pct >= 25) {
    const t = (pct - 25) / 35;
    rgb = lerp(red, yellow, t);
  } else {
    const t = pct / 25;
    rgb = lerp([180, 40, 30], red, t);
  }
  return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
}

function lerp(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
