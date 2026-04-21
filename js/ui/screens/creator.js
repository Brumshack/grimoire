import { el, clear } from "../../util/dom.js";
import { blankCharacter } from "../../engine/characterFactory.js";
import { deriveAll } from "../../engine/derive.js";
import { saveCharacter } from "../../storage/idbStore.js";
import { updateRosterEntry } from "../../storage/localStore.js";
import { navigate } from "../router.js";
import { toast } from "../components/toast.js";

import { ABILITY_KEYS, ABILITIES, ALIGNMENTS, abilityMod } from "../../data/rules.js";
import { listRaces, resolveRace } from "../../data/races.js";
import { CLASSES, CLASS_IDS } from "../../data/classes.js";
import { BACKGROUNDS, BACKGROUND_IDS } from "../../data/backgrounds.js";
import { spellsByLevel } from "../../data/spells.js";
import { averageHitDie, STANDARD_ARRAY } from "../../util/dice.js";

/**
 * Guided creator. Steps:
 *   1. Identity
 *   2. Race
 *   3. Class
 *   4. Background
 *   5. Abilities (Standard Array)
 *   6. Skills (from class list)
 *   7. Spells (if spellcaster)
 *   8. Review
 */
const STEPS = [
  { id: "identity",   label: "Identity" },
  { id: "race",       label: "Race" },
  { id: "class",      label: "Class" },
  { id: "background", label: "Background" },
  { id: "abilities",  label: "Abilities" },
  { id: "skills",     label: "Skills" },
  { id: "spells",     label: "Spells" },
  { id: "review",     label: "Review" }
];

export function renderCreator(root) {
  const doc = blankCharacter();
  const state = { stepIndex: 0, doc, assignments: STANDARD_ARRAY.map(() => null) };
  doc.background.backgroundId = "acolyte";

  render(root, state);
}

function render(root, state) {
  clear(root);
  const step = STEPS[state.stepIndex];
  const applicableSteps = STEPS.filter(s => s.id !== "spells" || isSpellcaster(state.doc));

  const nav = el("nav", { class: "wizard__nav" },
    ...applicableSteps.map((s, i) => {
      const realIndex = STEPS.indexOf(s);
      return el("button", {
        class: `wizard__step ${realIndex === state.stepIndex ? "is-active" : ""} ${realIndex < state.stepIndex ? "is-done" : ""}`,
        type: "button",
        onclick: () => { if (canAdvanceTo(state, realIndex)) { state.stepIndex = realIndex; render(root, state); } }
      }, `${i + 1}. ${s.label}`);
    })
  );

  const body = el("div", { class: "wizard__body" });
  switch (step.id) {
    case "identity":   renderIdentity(body, state, root); break;
    case "race":       renderRace(body, state, root); break;
    case "class":      renderClass(body, state, root); break;
    case "background": renderBackground(body, state, root); break;
    case "abilities":  renderAbilities(body, state, root); break;
    case "skills":     renderSkills(body, state, root); break;
    case "spells":
      if (isSpellcaster(state.doc)) renderSpells(body, state, root);
      else { state.stepIndex++; return render(root, state); }
      break;
    case "review":     renderReview(body, state, root); break;
  }

  const footer = el("div", { class: "wizard__footer" },
    el("button", {
      class: "btn btn--ghost",
      onclick: () => navigate("/roster")
    }, "Cancel"),
    el("div", { class: "wizard__spacer" }),
    state.stepIndex > 0
      ? el("button", { class: "btn", onclick: () => { state.stepIndex--; render(root, state); } }, "Back")
      : null,
    state.stepIndex < STEPS.length - 1
      ? el("button", {
          class: "btn btn--primary",
          disabled: !canLeaveStep(state, step.id),
          onclick: () => { advance(state); render(root, state); }
        }, "Next")
      : el("button", {
          class: "btn btn--primary",
          disabled: !canFinish(state),
          onclick: async () => { await finish(state); }
        }, "Create Character")
  );

  root.append(el("section", { class: "wizard" },
    el("header", { class: "wizard__header" },
      el("h1", {}, "New Character"),
      el("p", { class: "muted" }, `Step ${state.stepIndex + 1} of ${STEPS.length}: ${step.label}`)
    ),
    nav,
    body,
    footer
  ));
}

/* ─────────────────────── steps ─────────────────────── */

function renderIdentity(body, state) {
  const d = state.doc.identity;
  body.append(
    el("div", { class: "form-grid" },
      field("Character Name", el("input", {
        type: "text", value: d.name,
        oninput: e => { d.name = e.target.value; }
      })),
      field("Player Name", el("input", {
        type: "text", value: d.playerName,
        oninput: e => { d.playerName = e.target.value; }
      })),
      field("Alignment", selectEl(ALIGNMENTS.map(a => ({ v: a.id, label: a.name })), d.alignment, v => { d.alignment = v; })),
      field("Gender", el("input", { type: "text", value: d.gender, oninput: e => { d.gender = e.target.value; }})),
      field("Age", el("input", { type: "number", value: d.age ?? "", oninput: e => { d.age = parseInt(e.target.value, 10) || null; }})),
      field("Height", el("input", { type: "text", value: d.height, oninput: e => { d.height = e.target.value; }})),
      field("Weight", el("input", { type: "text", value: d.weight, oninput: e => { d.weight = e.target.value; }})),
      field("Eyes", el("input", { type: "text", value: d.eyes, oninput: e => { d.eyes = e.target.value; }})),
      field("Hair", el("input", { type: "text", value: d.hair, oninput: e => { d.hair = e.target.value; }})),
      field("Skin", el("input", { type: "text", value: d.skin, oninput: e => { d.skin = e.target.value; }})),
    )
  );
}

function renderRace(body, state, root) {
  const options = listRaces();
  const current = `${state.doc.race.raceId || ""}${state.doc.race.subraceId ? ":" + state.doc.race.subraceId : ""}`;

  const cards = el("div", { class: "choice-grid" });
  for (const opt of options) {
    const resolved = resolveRace(opt.raceId, opt.subraceId);
    const selected = opt.id === current;
    const bonuses = Object.entries(resolved.abilityBonuses || {})
      .map(([k, v]) => `${k.toUpperCase()} +${v}`).join(", ");
    cards.append(el("button", {
      class: `choice-card ${selected ? "is-selected" : ""}`,
      type: "button",
      onclick: () => {
        state.doc.race.raceId = opt.raceId;
        state.doc.race.subraceId = opt.subraceId;
        render(root, state);
      }
    },
      el("h3", {}, resolved.fullName),
      el("div", { class: "choice-card__meta" }, `Speed ${resolved.speed} ft · ${resolved.size}${resolved.darkvision ? " · Darkvision " + resolved.darkvision + " ft" : ""}`),
      el("div", { class: "choice-card__bonuses" }, bonuses || "—"),
      el("ul", { class: "choice-card__traits" },
        ...resolved.traits.slice(0, 3).map(t => el("li", {}, el("strong", {}, t.name + ": "), document.createTextNode(t.desc.slice(0, 90) + (t.desc.length > 90 ? "…" : ""))))
      )
    ));
  }
  body.append(cards);
}

function renderClass(body, state, root) {
  const cards = el("div", { class: "choice-grid" });
  for (const id of CLASS_IDS) {
    const cls = CLASSES[id];
    const selected = state.doc.progression.classes[0]?.classId === id;
    const saves = cls.savingThrows.map(s => s.toUpperCase()).join("/");
    cards.append(el("button", {
      class: `choice-card ${selected ? "is-selected" : ""}`,
      type: "button",
      onclick: () => {
        const subclass = (cls.subclasses?.[0]?.level === 1) ? cls.subclasses[0].id : null;
        state.doc.progression.classes[0] = { classId: id, subclassId: subclass, level: 1, hitDieRolls: [] };
        render(root, state);
      }
    },
      el("h3", {}, cls.name),
      el("div", { class: "choice-card__meta" }, `Hit Die d${cls.hitDie} · Saves ${saves}`),
      el("div", { class: "choice-card__bonuses" }, cls.spellcasting ? `Caster (${cls.spellcasting.ability.toUpperCase()})` : "Non-caster"),
      el("ul", { class: "choice-card__traits" },
        ...cls.features.filter(f => f.level === 1).slice(0, 3).map(f =>
          el("li", {}, el("strong", {}, f.name + ": "), document.createTextNode(f.desc.slice(0, 90) + (f.desc.length > 90 ? "…" : "")))
        )
      )
    ));
  }
  body.append(cards);
}

function renderBackground(body, state, root) {
  const cards = el("div", { class: "choice-grid" });
  for (const id of BACKGROUND_IDS) {
    const bg = BACKGROUNDS[id];
    const selected = state.doc.background.backgroundId === id;
    cards.append(el("button", {
      class: `choice-card ${selected ? "is-selected" : ""}`,
      type: "button",
      onclick: () => { state.doc.background.backgroundId = id; render(root, state); }
    },
      el("h3", {}, bg.name),
      el("div", { class: "choice-card__meta" }, `Skills: ${bg.skills.join(", ")}`),
      el("div", {}, el("strong", {}, bg.feature.name + ": "), document.createTextNode(bg.feature.desc.slice(0, 160) + "…"))
    ));
  }
  body.append(cards);
  body.append(el("p", { class: "muted", style: { marginTop: "1rem" } },
    "Only Acolyte is in the SRD. Other backgrounds can be added as homebrew later."));
}

function renderAbilities(body, state, root) {
  body.append(el("p", { class: "muted" },
    "Using the Standard Array — assign 15, 14, 13, 12, 10, 8 to each ability."));

  const used = new Set(state.assignments.filter(v => v != null));

  const table = el("div", { class: "ability-assign" });
  ABILITY_KEYS.forEach((ab, i) => {
    const value = state.assignments[i];
    const resolvedRace = state.doc.race.raceId ? resolveRace(state.doc.race.raceId, state.doc.race.subraceId) : null;
    const racial = resolvedRace?.abilityBonuses?.[ab] || 0;
    const total = (value ?? 10) + racial;
    const mod = abilityMod(total);

    const select = el("select", {
      onchange: e => {
        state.assignments[i] = e.target.value === "" ? null : +e.target.value;
        state.doc.abilityScores.base[ab] = state.assignments[i] ?? 10;
        render(root, state);
      }
    },
      el("option", { value: "" }, "—"),
      ...STANDARD_ARRAY.map(v => el("option", {
        value: String(v),
        selected: value === v,
        disabled: used.has(v) && value !== v
      }, String(v)))
    );

    table.append(el("div", { class: "ability-assign__row" },
      el("div", { class: "ability-assign__name" }, ABILITIES[ab].full),
      select,
      el("div", { class: "ability-assign__racial" }, racial ? `+${racial}` : "—"),
      el("div", { class: "ability-assign__total" }, String(total)),
      el("div", { class: "ability-assign__mod" }, mod >= 0 ? `+${mod}` : String(mod)),
    ));
  });
  body.append(table);
}

function renderSkills(body, state, root) {
  const cls = CLASSES[state.doc.progression.classes[0].classId];
  const bg = BACKGROUNDS[state.doc.background.backgroundId];
  const grantedByBg = new Set(bg?.skills || []);
  const choices = cls.skillChoices || { count: 0, options: [] };
  const currentPicks = new Set(Object.entries(state.doc.proficiencies.skills || {})
    .filter(([, v]) => v === "proficient").map(([k]) => k));
  // ignore background-granted in the class selection list
  const eligible = choices.options.filter(id => !grantedByBg.has(id));

  body.append(el("p", { class: "muted" },
    `Choose ${choices.count} skills from your ${cls.name} list. Background already grants: ${[...grantedByBg].join(", ") || "—"}.`));

  const grid = el("div", { class: "skill-picker" });
  for (const id of eligible) {
    const selected = currentPicks.has(id);
    grid.append(el("button", {
      class: `skill-pick ${selected ? "is-selected" : ""}`,
      type: "button",
      onclick: () => {
        const skills = state.doc.proficiencies.skills || {};
        if (skills[id] === "proficient") delete skills[id];
        else if ([...Object.values(skills)].filter(v => v === "proficient").length < choices.count + 100) {
          skills[id] = "proficient";
        }
        // Enforce count
        const proficient = Object.entries(skills).filter(([, v]) => v === "proficient");
        if (proficient.length > choices.count) {
          // Remove the oldest until within count
          delete skills[proficient[0][0]];
        }
        state.doc.proficiencies.skills = skills;
        render(root, state);
      }
    }, idToLabel(id)));
  }
  body.append(grid);
}

function renderSpells(body, state, root) {
  const cls = CLASSES[state.doc.progression.classes[0].classId];
  const sc = cls.spellcasting;
  const cantripsKnown = sc.cantripsKnownByLevel?.[1] || 0;
  const spellsKnown = sc.kind === "known" ? (sc.spellsKnownByLevel?.[1] || 0) : null;
  const byLevel = spellsByLevel(cls.id);

  body.append(el("p", { class: "muted" },
    sc.kind === "known"
      ? `Choose ${cantripsKnown} cantrips and ${spellsKnown} 1st-level spells known.`
      : `Choose ${cantripsKnown} cantrips. You prepare spells each day (not selected here).`
  ));

  const known = new Set(state.doc.spellcasting.knownSpells || []);

  for (const level of [...byLevel.keys()].sort((a, b) => a - b)) {
    if (level > 1) continue;
    body.append(el("h3", { class: "spell-picker__header" },
      level === 0 ? `Cantrips (choose ${cantripsKnown})` :
                     (sc.kind === "known" ? `Level 1 (choose ${spellsKnown})` : "Level 1 (browse only)")
    ));
    const row = el("div", { class: "spell-picker" });
    for (const sp of byLevel.get(level)) {
      const selected = known.has(sp.id);
      row.append(el("button", {
        class: `spell-pick ${selected ? "is-selected" : ""}`,
        type: "button",
        onclick: () => {
          if (selected) known.delete(sp.id);
          else {
            const limit = level === 0 ? cantripsKnown : (spellsKnown ?? 99);
            const samLevel = [...known].filter(id => (byLevel.get(level) || []).some(s => s.id === id)).length;
            if (samLevel < limit) known.add(sp.id);
          }
          state.doc.spellcasting.knownSpells = [...known];
          render(root, state);
        }
      },
        el("div", { class: "spell-pick__name" }, sp.name),
        el("div", { class: "spell-pick__meta" }, `${sp.school} · ${sp.castingTime}`)
      ));
    }
    body.append(row);
  }
}

function renderReview(body, state) {
  const doc = state.doc;
  const resolved = resolveRace(doc.race.raceId, doc.race.subraceId);
  const cls = CLASSES[doc.progression.classes[0].classId];
  const bg = BACKGROUNDS[doc.background.backgroundId];

  // Apply derived initial HP
  const conMod = abilityMod((doc.abilityScores.base.con || 10) + (resolved?.abilityBonuses?.con || 0));
  const maxHp = (cls.hitDie) + conMod;
  doc.combat.maxHp = Math.max(1, maxHp);
  doc.combat.currentHp = doc.combat.maxHp;

  body.append(el("div", { class: "review" },
    reviewRow("Name", doc.identity.name),
    reviewRow("Alignment", ALIGNMENTS.find(a => a.id === doc.identity.alignment)?.name || "—"),
    reviewRow("Race", resolved?.fullName || "—"),
    reviewRow("Class", cls.name),
    reviewRow("Background", bg?.name || "—"),
    reviewRow("HP", `${doc.combat.maxHp} (d${cls.hitDie} + ${conMod >= 0 ? "+" : ""}${conMod} CON)`),
    reviewRow("Ability Scores", ABILITY_KEYS.map(k => {
      const r = resolved?.abilityBonuses?.[k] || 0;
      const v = (doc.abilityScores.base[k] || 10) + r;
      return `${k.toUpperCase()} ${v}`;
    }).join(" · ")),
    reviewRow("Skills", [
      ...Object.entries(doc.proficiencies.skills).filter(([,v]) => v === "proficient").map(([k]) => idToLabel(k)),
      ...(bg?.skills || []).map(idToLabel)
    ].join(", ") || "—"),
    doc.spellcasting.knownSpells.length
      ? reviewRow("Spells Known", doc.spellcasting.knownSpells.length + " spells")
      : null
  ));
}

/* ─────────────────────── helpers ─────────────────────── */

function isSpellcaster(doc) {
  const cls = CLASSES[doc.progression.classes[0]?.classId];
  return !!cls?.spellcasting;
}

function canLeaveStep(state, id) {
  const d = state.doc;
  switch (id) {
    case "identity":   return !!d.identity.name?.trim();
    case "race":       return !!d.race.raceId;
    case "class":      return !!d.progression.classes[0]?.classId;
    case "background": return !!d.background.backgroundId;
    case "abilities":  return state.assignments.every(v => v != null);
    case "skills": {
      const cls = CLASSES[d.progression.classes[0].classId];
      const n = Object.values(d.proficiencies.skills || {}).filter(v => v === "proficient").length;
      return n === (cls.skillChoices?.count || 0);
    }
    case "spells":     return true;
    default:           return true;
  }
}

function canAdvanceTo(state, idx) {
  for (let i = 0; i < idx; i++) {
    if (!canLeaveStep(state, STEPS[i].id)) return false;
  }
  return true;
}

function canFinish(state) {
  return STEPS.slice(0, -1).every(s => canLeaveStep(state, s.id));
}

function advance(state) {
  state.stepIndex = Math.min(STEPS.length - 1, state.stepIndex + 1);
  if (STEPS[state.stepIndex].id === "spells" && !isSpellcaster(state.doc)) {
    state.stepIndex++;
  }
}

async function finish(state) {
  const doc = state.doc;
  doc.updatedAt = new Date().toISOString();
  await saveCharacter(doc);
  const derived = deriveAll(doc);
  await updateRosterEntry(doc, derived);
  toast(`${doc.identity.name} created`);
  navigate(`/sheet/${doc.id}`);
}

function field(label, input) {
  return el("label", { class: "field" },
    el("div", { class: "field__label" }, label),
    input
  );
}

function selectEl(options, value, onChange) {
  return el("select", {
    onchange: e => onChange(e.target.value)
  }, ...options.map(o => el("option", { value: o.v, selected: value === o.v }, o.label)));
}

function reviewRow(label, value) {
  return el("div", { class: "review__row" },
    el("div", { class: "review__label" }, label),
    el("div", { class: "review__value" }, value || "—")
  );
}

function idToLabel(id) {
  return id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
