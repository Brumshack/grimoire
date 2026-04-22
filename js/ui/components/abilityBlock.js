import { el } from "../../util/dom.js";
import { ABILITY_KEYS, ABILITIES, abilityMod } from "../../data/rules.js";
import { bindTooltip } from "./tooltip.js";

const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);

export function renderAbilityBlock(store) {
  const derived = store.derived;
  const overrideMap = store.doc.abilityScores.override || {};
  const rows = ABILITY_KEYS.map(k => {
    const a = derived.abilities[k];
    const isOverridden = overrideMap[k] != null;
    const scoreInput = el("input", {
      type: "number", min: "1", max: "30",
      value: String(a.base),
      onchange: (e) => {
        const v = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 10));
        store.update(doc => { doc.abilityScores.base[k] = v; });
      }
    });
    const tile = el("div", {
      class: "ability",
      tabindex: 0,
      "data-override-path": `ability.${k}`,
      "data-overridden": isOverridden ? "true" : null
    },
      el("div", { class: "ability__name" }, ABILITIES[k].name.slice(0, 3).toUpperCase()),
      el("div", { class: "ability__mod" }, fmtMod(a.mod)),
      el("div", { class: "ability__score" }, scoreInput)
    );
    bindTooltip(tile, {
      title: ABILITIES[k].full,
      summary: `Score: ${a.score}. Modifier: ${fmtMod(a.mod)}. Base ${a.base}, racial ${a.racial || 0}, ASI ${a.asi || 0}.`,
      sourceRef: "PHB"
    });
    return tile;
  });
  return el("div", { class: "ability-grid" }, ...rows);
}
