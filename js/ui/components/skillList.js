import { el } from "../../util/dom.js";
import { SKILL_IDS, SKILLS } from "../../data/skills.js";
import { ABILITIES } from "../../data/rules.js";
import { bindTooltip } from "./tooltip.js";
import { buildSourceHtml } from "./provenance.js";

const fmtMod = (m) => (m >= 0 ? `+${m}` : `${m}`);

export function renderSkillList(store) {
  const rows = SKILL_IDS.map(id => {
    const s = store.derived.skills[id];
    const state = s.level;
    const pip = el("button", {
      class: "stat-row__pip", type: "button", title: "Toggle proficiency / expertise",
      dataset: { state },
      onclick: () => {
        store.update(doc => {
          const cur = doc.proficiencies.skills?.[id] || "none";
          const next = cur === "none" ? "proficient" : cur === "proficient" ? "expertise" : "none";
          doc.proficiencies.skills = doc.proficiencies.skills || {};
          if (next === "none") delete doc.proficiencies.skills[id];
          else doc.proficiencies.skills[id] = next;
        });
      }
    });
    const row = el("div", {
      class: "stat-row",
      tabindex: 0,
      "data-override-path": `skill.${id}`,
      "data-overridden": s.overridden ? "true" : null
    },
      pip,
      el("span", { class: "stat-row__ab" }, SKILLS[id].ability.toUpperCase()),
      el("span", { class: "stat-row__name" }, SKILLS[id].name),
      el("span", { class: "stat-row__val" }, fmtMod(s.modifier))
    );
    const baseLine = `${ABILITIES[SKILLS[id].ability].full}-based. ${
      s.level === "expertise" ? "Expertise (2× proficiency bonus)." :
      s.level === "proficient" ? "Proficient." : "Not proficient."
    }`;
    bindTooltip(row, {
      title: SKILLS[id].name,
      html: buildSourceHtml(baseLine, s.sources),
      sourceRef: "PHB"
    });
    return row;
  });
  return el("div", { class: "stat-list" }, ...rows);
}

export function renderSavingThrows(store) {
  const rows = Object.values(store.derived.saves).map(sv => {
    const pip = el("button", {
      class: "stat-row__pip", type: "button",
      dataset: { state: sv.proficient ? "proficient" : "none" },
      onclick: () => {
        store.update(doc => {
          const extra = new Set(doc.proficiencies.savingThrowsExtra || []);
          if (extra.has(sv.ability)) extra.delete(sv.ability);
          else extra.add(sv.ability);
          doc.proficiencies.savingThrowsExtra = [...extra];
        });
      }
    });
    const saveBase = `${sv.proficient ? "Proficient" : "Not proficient"} in ${ABILITIES[sv.ability].full} saves.`;
    const row = el("div", {
      class: "stat-row",
      "data-override-path": `save.${sv.ability}`,
      "data-overridden": sv.overridden ? "true" : null
    },
      pip,
      el("span", { class: "stat-row__ab" }, sv.ability.toUpperCase()),
      el("span", { class: "stat-row__name" }, ABILITIES[sv.ability].full),
      el("span", { class: "stat-row__val" }, fmtMod(sv.modifier))
    );
    bindTooltip(row, {
      title: `${ABILITIES[sv.ability].full} Save`,
      html: buildSourceHtml(saveBase, sv.sources),
      sourceRef: "PHB"
    });
    return row;
  });
  return el("div", { class: "stat-list" }, ...rows);
}
