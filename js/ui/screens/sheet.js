import { el, clear } from "../../util/dom.js";
import { loadCharacter } from "../../storage/idbStore.js";
import { CharacterStore } from "../../engine/store.js";
import { navigate } from "../router.js";
import { toast } from "../components/toast.js";

import { renderAbilityBlock } from "../components/abilityBlock.js";
import { renderSkillList, renderSavingThrows } from "../components/skillList.js";
import { renderHpBar } from "../components/hpBar.js";
import { renderPips } from "../components/pipTracker.js";
import { openSpellDetail, openItemDetail, openFeatureDetail } from "../components/detailModals.js";
import { bindTooltip } from "../components/tooltip.js";

import { ALIGNMENTS } from "../../data/rules.js";
import { SPELLS, spellsByLevel } from "../../data/spells.js";
import { ITEMS, listWeapons, listArmor, listGear } from "../../data/equipment.js";

export async function renderSheet(root, id) {
  clear(root);
  root.append(el("div", { class: "loading" }, "Loading…"));

  const doc = await loadCharacter(id);
  if (!doc) {
    clear(root);
    root.append(el("div", { class: "empty-state" },
      el("p", {}, "Character not found."),
      el("button", { class: "btn", onclick: () => navigate("/roster") }, "Back to Roster")
    ));
    return;
  }

  const store = new CharacterStore(doc);
  const state = { tab: "overview" };

  function rerender() {
    clear(root);
    root.append(renderSheetChrome(store, state, rerender));
  }

  store.on("change", rerender);
  store.on("saved", () => { /* could show a subtle saved indicator */ });
  rerender();
}

/* ─────────────────────── chrome ─────────────────────── */

function renderSheetChrome(store, state, rerender) {
  const doc = store.doc;
  const d = store.derived;

  const alignment = ALIGNMENTS.find(a => a.id === doc.identity.alignment)?.name || "";
  const classLine = d.primarySubclass
    ? `${d.primarySubclass.name} ${d.primaryClass.name}`
    : d.primaryClass?.name || "—";

  const header = el("header", { class: "sheet__header" },
    el("button", { class: "btn btn--ghost", onclick: () => navigate("/roster") }, "← Roster"),
    el("div", { class: "sheet__title" },
      el("div", { class: "sheet__name", contentEditable: "true",
        oninput: e => store.update(x => { x.identity.name = e.target.textContent.trim() || "Unnamed"; }),
      }, doc.identity.name),
      el("div", { class: "sheet__subtitle" },
        el("span", {}, `Level ${d.totalLevel}`), sep(),
        el("span", {}, d.resolvedRace?.fullName || "—"), sep(),
        el("span", {}, classLine), sep(),
        el("span", {}, alignment)
      )
    ),
    el("div", { class: "sheet__spacer" }),
    el("div", { class: "sheet__xp" },
      el("span", { class: "label" }, "XP"),
      el("input", {
        type: "number", min: 0, value: doc.progression.xp || 0,
        onchange: e => store.update(x => { x.progression.xp = parseInt(e.target.value, 10) || 0; })
      })
    ),
    el("div", { class: "sheet__inspiration" },
      el("button", {
        class: `pip pip--inspiration ${doc.progression.inspiration ? "is-on" : ""}`,
        type: "button",
        onclick: () => store.update(x => { x.progression.inspiration = !x.progression.inspiration; })
      }),
      el("span", { class: "label" }, "Inspiration")
    )
  );

  const tabs = el("nav", { class: "sheet__tabs" },
    tabBtn("overview", "Overview", state, rerender),
    tabBtn("combat",   "Combat",   state, rerender),
    tabBtn("spells",   "Spells",   state, rerender, !d.primaryClass?.spellcasting),
    tabBtn("inventory","Inventory",state, rerender),
    tabBtn("features", "Features", state, rerender),
    tabBtn("lore",     "Lore",     state, rerender),
  );

  let body;
  switch (state.tab) {
    case "combat":    body = renderCombatTab(store); break;
    case "spells":    body = renderSpellsTab(store); break;
    case "inventory": body = renderInventoryTab(store); break;
    case "features":  body = renderFeaturesTab(store); break;
    case "lore":      body = renderLoreTab(store); break;
    default:          body = renderOverviewTab(store);
  }

  return el("div", { class: "sheet" }, header, tabs, body);
}

const sep = () => el("span", { class: "sep" }, "·");

function tabBtn(id, label, state, rerender, disabled = false) {
  return el("button", {
    class: `sheet__tab ${state.tab === id ? "is-active" : ""}`,
    type: "button", disabled,
    onclick: () => { state.tab = id; rerender(); }
  }, label);
}

/* ─────────────────────── overview ─────────────────────── */

function renderOverviewTab(store) {
  const d = store.derived;

  return el("div", { class: "sheet__grid" },
    // Left column
    el("div", { class: "col col--left" },
      renderAbilityBlock(store),
      statBlock(store),
      renderSavingThrows(store)
    ),
    // Middle column
    el("div", { class: "col col--mid" },
      renderSkillList(store)
    ),
    // Right column
    el("div", { class: "col col--right" },
      renderHpBar(store),
      renderCombatQuick(store),
      d.primaryClass?.spellcasting ? renderSpellcastingQuick(store) : null
    )
  );
}

function statBlock(store) {
  const d = store.derived;

  const row = (label, value, tip) => {
    const r = el("div", { class: "stat-pair" },
      el("div", { class: "stat-pair__label" }, label),
      el("div", { class: "stat-pair__value" }, value)
    );
    if (tip) bindTooltip(r, tip);
    return r;
  };

  return el("div", { class: "panel panel--stats" },
    el("div", { class: "stat-pair-grid" },
      row("AC", d.ac, { title: "Armor Class", summary: "Base AC. Auto-calculated from equipped armor, shield, and ability modifiers." }),
      row("Initiative", fmt(d.initiative), { title: "Initiative", summary: `DEX mod${store.doc.combat.initiativeBonus ? " + " + store.doc.combat.initiativeBonus : ""}.` }),
      row("Speed", `${d.speed} ft`, { title: "Speed", summary: "Walking speed in feet." }),
      row("Prof. Bonus", `+${d.profBonus}`, { title: "Proficiency Bonus", summary: `+${d.profBonus} at level ${d.totalLevel}.` }),
      row("Passive Perception", d.passivePerception, { title: "Passive Perception", summary: "10 + Perception modifier." }),
      row("Hit Dice", `${Math.max(0, d.totalLevel - (store.doc.combat.hitDiceUsed?.[`d${d.hitDie}`] || 0))} / ${d.totalLevel} d${d.hitDie}`, { title: "Hit Dice", summary: "Spent on short rests to recover HP." }),
    )
  );
}

function renderCombatQuick(store) {
  const d = store.derived;
  const doc = store.doc;

  return el("div", { class: "panel" },
    el("h3", {}, "Death Saves"),
    el("div", { class: "death-saves" },
      el("div", { class: "label" }, "Successes"),
      renderPips({
        total: 3, used: doc.combat.deathSaves.successes,
        onChange: n => store.update(x => { x.combat.deathSaves.successes = n; }),
        variant: "success"
      }),
      el("div", { class: "label" }, "Failures"),
      renderPips({
        total: 3, used: doc.combat.deathSaves.failures,
        onChange: n => store.update(x => { x.combat.deathSaves.failures = n; }),
        variant: "failure"
      }),
    )
  );
}

function renderSpellcastingQuick(store) {
  const d = store.derived;
  return el("div", { class: "panel panel--spellcasting" },
    el("h3", {}, "Spellcasting"),
    el("div", { class: "stat-pair-grid" },
      el("div", { class: "stat-pair" },
        el("div", { class: "stat-pair__label" }, "Ability"),
        el("div", { class: "stat-pair__value" }, d.spellAbility?.toUpperCase() || "—")
      ),
      el("div", { class: "stat-pair" },
        el("div", { class: "stat-pair__label" }, "Save DC"),
        el("div", { class: "stat-pair__value" }, d.spellSaveDC ?? "—")
      ),
      el("div", { class: "stat-pair" },
        el("div", { class: "stat-pair__label" }, "Attack"),
        el("div", { class: "stat-pair__value" }, fmt(d.spellAttack))
      ),
    )
  );
}

const fmt = m => m == null ? "—" : (m >= 0 ? `+${m}` : `${m}`);

/* ─────────────────────── combat tab ─────────────────────── */

function renderCombatTab(store) {
  const doc = store.doc;
  const d = store.derived;

  const equippedWeapons = (doc.equipment.items || [])
    .filter(i => i.equipped)
    .map(i => ({ instance: i, base: i.itemId ? ITEMS[i.itemId] : i.custom }))
    .filter(x => x.base?.type === "weapon");

  return el("div", { class: "sheet__grid" },
    el("div", { class: "col col--wide" },
      renderHpBar(store),
      el("div", { class: "panel" },
        el("h3", {}, "Attacks"),
        equippedWeapons.length === 0
          ? el("p", { class: "muted" }, "No weapons equipped.")
          : el("div", { class: "attack-list" },
              ...equippedWeapons.map(({ instance, base }) => renderAttack(store, instance, base, d))
            )
      ),
      el("div", { class: "panel" },
        el("h3", {}, "Action Economy"),
        el("div", { class: "action-economy" },
          actionPip("Action", doc.combat.actionEconomy?.action, v => store.update(x => { x.combat.actionEconomy.action = v; })),
          actionPip("Bonus Action", doc.combat.actionEconomy?.bonusAction, v => store.update(x => { x.combat.actionEconomy.bonusAction = v; })),
          actionPip("Reaction", doc.combat.actionEconomy?.reaction, v => store.update(x => { x.combat.actionEconomy.reaction = v; })),
          el("button", {
            class: "btn btn--sm",
            onclick: () => store.update(x => { x.combat.actionEconomy = { action: false, bonusAction: false, reaction: false }; })
          }, "Reset Turn")
        )
      ),
      el("div", { class: "panel" },
        el("h3", {}, "Hit Dice"),
        el("div", { class: "hit-dice" },
          el("div", { class: "label" }, `d${d.hitDie} available`),
          renderPips({
            total: d.totalLevel,
            used: doc.combat.hitDiceUsed?.[`d${d.hitDie}`] || 0,
            onChange: n => store.update(x => {
              x.combat.hitDiceUsed = x.combat.hitDiceUsed || {};
              x.combat.hitDiceUsed[`d${d.hitDie}`] = n;
            })
          })
        )
      )
    ),
    el("div", { class: "col col--side" },
      renderCombatQuick(store),
      el("div", { class: "panel" },
        el("h3", {}, "Conditions"),
        (doc.combat.conditions || []).length === 0
          ? el("p", { class: "muted" }, "None.")
          : el("ul", {},
              ...doc.combat.conditions.map(c => el("li", {}, c.conditionId))
            )
      )
    )
  );
}

function renderAttack(store, instance, base, d) {
  const ability = (base.properties || []).includes("finesse")
    ? (d.abilities.dex.mod >= d.abilities.str.mod ? "dex" : "str")
    : (base.properties || []).includes("ranged") || base.category?.includes("ranged") ? "dex" : "str";
  const mod = d.abilities[ability].mod;
  const atk = mod + d.profBonus;
  const dmg = `${base.damage}${mod >= 0 ? "+" : ""}${mod} ${base.damageType}`;
  return el("div", { class: "attack-row" },
    el("div", { class: "attack-row__name" }, base.name),
    el("div", { class: "attack-row__atk" }, fmt(atk)),
    el("div", { class: "attack-row__dmg" }, dmg),
    el("div", { class: "attack-row__range" }, base.range || "melee")
  );
}

function actionPip(label, used, onChange) {
  return el("button", {
    class: `action-pip ${used ? "is-used" : ""}`,
    type: "button",
    onclick: () => onChange(!used)
  }, label);
}

/* ─────────────────────── spells tab ─────────────────────── */

function renderSpellsTab(store) {
  const doc = store.doc;
  const d = store.derived;
  const cls = d.primaryClass;
  if (!cls?.spellcasting) return el("div", { class: "panel" }, el("p", {}, "This class does not cast spells."));

  const slots = d.slots;
  const known = new Set(doc.spellcasting.knownSpells || []);

  const slotBar = slots ? renderSlotTracker(store, slots) : null;

  const byLevel = spellsByLevel(cls.id);
  const sections = [...byLevel.keys()].sort((a, b) => a - b).map(lvl => {
    const spellsAtLevel = byLevel.get(lvl).filter(s => known.has(s.id));
    if (spellsAtLevel.length === 0) return null;
    return el("div", { class: "spell-section" },
      el("h3", {}, lvl === 0 ? "Cantrips" : `Level ${lvl}`),
      el("div", { class: "spell-list" },
        ...spellsAtLevel.map(s => renderSpellRow(store, s, lvl))
      )
    );
  }).filter(Boolean);

  return el("div", { class: "sheet__grid" },
    el("div", { class: "col col--wide" },
      slotBar,
      ...sections,
      el("details", { class: "spell-library" },
        el("summary", {}, "+ Add Spell from Library"),
        el("div", { class: "spell-library__list" },
          ...[...byLevel.keys()].sort((a,b)=>a-b).flatMap(lvl =>
            byLevel.get(lvl).filter(s => !known.has(s.id)).map(s =>
              el("button", {
                class: "btn btn--sm",
                onclick: () => store.update(x => {
                  x.spellcasting.knownSpells = [...new Set([...(x.spellcasting.knownSpells || []), s.id])];
                })
              }, `${s.name} (${lvl === 0 ? "Cantrip" : `L${lvl}`})`)
            )
          )
        )
      )
    ),
    el("div", { class: "col col--side" },
      renderSpellcastingQuick(store),
    )
  );
}

function renderSpellRow(store, spell, level) {
  const row = el("div", { class: "spell-row" },
    el("div", { class: "spell-row__name", onclick: () => openSpellDetail(spell) }, spell.name),
    el("div", { class: "spell-row__meta" },
      `${spell.school} · ${spell.castingTime}${spell.concentration ? " · C" : ""}${spell.ritual ? " · R" : ""}`
    ),
    el("button", {
      class: "btn btn--sm btn--danger",
      onclick: () => store.update(x => {
        x.spellcasting.knownSpells = (x.spellcasting.knownSpells || []).filter(id => id !== spell.id);
      })
    }, "Remove")
  );
  bindTooltip(row, {
    title: spell.name,
    summary: spell.description.slice(0, 160) + (spell.description.length > 160 ? "…" : ""),
    sourceRef: "SRD",
    onMore: () => openSpellDetail(spell)
  });
  return row;
}

function renderSlotTracker(store, slots) {
  const doc = store.doc;
  if (slots.kind === "pact") {
    return el("div", { class: "panel" },
      el("h3", {}, `Pact Slots (Level ${slots.slotLevel})`),
      renderPips({
        total: slots.slots,
        used: doc.spellcasting.pactSlotsUsed || 0,
        onChange: n => store.update(x => { x.spellcasting.pactSlotsUsed = n; })
      })
    );
  }
  const rows = slots.perLevel.map((count, lvl) => {
    if (!count || lvl === 0) return null;
    const used = doc.spellcasting.slotsUsed?.[String(lvl)] || 0;
    return el("div", { class: "slot-row" },
      el("div", { class: "slot-row__label" }, `Level ${lvl}`),
      renderPips({
        total: count, used,
        onChange: n => store.update(x => {
          x.spellcasting.slotsUsed = x.spellcasting.slotsUsed || {};
          x.spellcasting.slotsUsed[String(lvl)] = n;
        })
      })
    );
  }).filter(Boolean);
  if (rows.length === 0) return null;
  return el("div", { class: "panel" },
    el("h3", {}, "Spell Slots"),
    ...rows
  );
}

/* ─────────────────────── inventory tab ─────────────────────── */

function renderInventoryTab(store) {
  const doc = store.doc;
  const d = store.derived;

  const items = doc.equipment.items || [];
  const totalWeight = d.carriedWeight;

  return el("div", { class: "sheet__grid" },
    el("div", { class: "col col--wide" },
      el("div", { class: "panel" },
        el("h3", {}, "Equipment"),
        items.length === 0
          ? el("p", { class: "muted" }, "No items.")
          : el("div", { class: "inv-list" },
              ...items.map(it => renderInvItem(store, it))
            ),
        el("details", { class: "inv-add" },
          el("summary", {}, "+ Add Item"),
          el("div", { class: "inv-add__grid" },
            ...groupedItems().map(group => el("div", { class: "inv-add__group" },
              el("h4", {}, group.label),
              el("div", { class: "inv-add__buttons" },
                ...group.items.map(base => el("button", {
                  class: "btn btn--sm",
                  onclick: () => store.update(x => {
                    x.equipment.items.push({
                      instanceId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
                      itemId: base.id, custom: null, quantity: 1,
                      equipped: false, attuned: false, notes: "", containerId: null
                    });
                  })
                }, base.name))
              )
            ))
          )
        )
      )
    ),
    el("div", { class: "col col--side" },
      el("div", { class: "panel" },
        el("h3", {}, "Currency"),
        ...["pp","gp","ep","sp","cp"].map(coin => el("div", { class: "currency-row" },
          el("div", { class: "currency-row__label" }, coin.toUpperCase()),
          el("input", {
            type: "number", min: 0,
            value: doc.equipment.currency?.[coin] || 0,
            onchange: e => store.update(x => {
              x.equipment.currency = x.equipment.currency || {};
              x.equipment.currency[coin] = Math.max(0, parseInt(e.target.value, 10) || 0);
            })
          })
        ))
      ),
      el("div", { class: "panel" },
        el("h3", {}, "Carrying"),
        el("div", {}, `${totalWeight.toFixed(1)} / ${d.carry.carry} lb`),
        totalWeight > d.carry.encumbered
          ? el("div", { class: "warning" }, totalWeight > d.carry.heavilyEncumbered ? "Heavily encumbered" : "Encumbered")
          : null
      )
    )
  );
}

function renderInvItem(store, it) {
  const base = it.itemId ? ITEMS[it.itemId] : it.custom;
  if (!base) return el("div", { class: "inv-row" }, "Unknown item");
  const row = el("div", { class: "inv-row" },
    el("button", {
      class: `pip ${it.equipped ? "is-on" : ""}`,
      title: "Equipped",
      type: "button",
      onclick: () => store.update(x => {
        const i = x.equipment.items.find(i => i.instanceId === it.instanceId);
        if (i) i.equipped = !i.equipped;
      })
    }),
    el("div", { class: "inv-row__name", onclick: () => openItemDetail(base) }, base.name),
    el("input", {
      type: "number", min: 0, value: it.quantity || 1, class: "inv-row__qty",
      onchange: e => store.update(x => {
        const i = x.equipment.items.find(i => i.instanceId === it.instanceId);
        if (i) i.quantity = Math.max(0, parseInt(e.target.value, 10) || 1);
      })
    }),
    el("div", { class: "inv-row__weight" }, `${((base.weight || 0) * (it.quantity || 1)).toFixed(1)} lb`),
    el("button", {
      class: "btn btn--sm btn--danger",
      onclick: () => store.update(x => {
        x.equipment.items = x.equipment.items.filter(i => i.instanceId !== it.instanceId);
      })
    }, "×")
  );
  bindTooltip(row, {
    title: base.name,
    summary: base.type === "weapon" ? `${base.damage} ${base.damageType}` :
             base.type === "armor"  ? `AC ${base.ac} (${base.armorType})` :
             (base.description || "Adventuring gear"),
    sourceRef: "SRD",
    onMore: () => openItemDetail(base)
  });
  return row;
}

function groupedItems() {
  return [
    { label: "Weapons", items: listWeapons() },
    { label: "Armor", items: listArmor() },
    { label: "Gear", items: listGear() },
  ];
}

/* ─────────────────────── features tab ─────────────────────── */

function renderFeaturesTab(store) {
  const d = store.derived;
  const grouped = {};
  for (const f of d.features) {
    const key = f.source || f.kind || "Other";
    (grouped[key] = grouped[key] || []).push(f);
  }

  return el("div", { class: "sheet__grid" },
    el("div", { class: "col col--wide" },
      ...Object.entries(grouped).map(([source, features]) =>
        el("div", { class: "panel" },
          el("h3", {}, source),
          el("div", { class: "feature-list" },
            ...features.map(f => {
              const row = el("div", { class: "feature-row", onclick: () => openFeatureDetail(f) },
                el("div", { class: "feature-row__name" }, f.name),
                f.level ? el("div", { class: "feature-row__level" }, `L${f.level}`) : null,
                el("div", { class: "feature-row__desc" }, f.desc?.slice(0, 140) + (f.desc?.length > 140 ? "…" : ""))
              );
              bindTooltip(row, { title: f.name, summary: f.desc, sourceRef: f.source, onMore: () => openFeatureDetail(f) });
              return row;
            })
          )
        )
      )
    ),
    el("div", { class: "col col--side" },
      el("div", { class: "panel" },
        el("h3", {}, "Languages"),
        el("ul", {}, ...d.languages.map(l => el("li", {}, l)))
      ),
      el("div", { class: "panel" },
        el("h3", {}, "Proficiencies"),
        el("div", { class: "label" }, "Armor"),
        el("div", {}, d.armorProficiencies.join(", ") || "—"),
        el("div", { class: "label" }, "Weapons"),
        el("div", {}, d.weaponProficiencies.join(", ") || "—"),
        el("div", { class: "label" }, "Tools"),
        el("div", {}, d.toolProficiencies.join(", ") || "—")
      )
    )
  );
}

/* ─────────────────────── lore tab ─────────────────────── */

function renderLoreTab(store) {
  const doc = store.doc;
  const lore = doc.lore;

  const ARRAY_KEYS = new Set(["personalityTraits","ideals","bonds","flaws"]);
  const loreValue = (key) => {
    const v = lore[key];
    if (Array.isArray(v)) return v.join("\n");
    return v || "";
  };
  const textarea = (label, key) => el("label", { class: "field field--full" },
    el("div", { class: "field__label" }, label),
    el("textarea", {
      rows: 4,
      onchange: e => store.update(x => {
        if (ARRAY_KEYS.has(key)) {
          x.lore[key] = e.target.value.split("\n").map(s => s.trim()).filter(Boolean);
        } else {
          x.lore[key] = e.target.value;
        }
      })
    }, loreValue(key))
  );

  return el("div", { class: "sheet__grid" },
    el("div", { class: "col col--wide" },
      el("div", { class: "panel" },
        el("h3", {}, "Backstory"),
        textarea("Backstory", "backstory")
      ),
      el("div", { class: "panel" },
        el("h3", {}, "Personality"),
        textarea("Personality Traits", "personalityTraits"),
        textarea("Ideals", "ideals"),
        textarea("Bonds", "bonds"),
        textarea("Flaws", "flaws"),
      ),
      el("div", { class: "panel" },
        el("h3", {}, "Notes"),
        textarea("Notes", "notes")
      )
    ),
    el("div", { class: "col col--side" },
      el("div", { class: "panel" },
        el("h3", {}, "Appearance"),
        ...["age","height","weight","eyes","hair","skin","gender"].map(k =>
          el("label", { class: "field" },
            el("div", { class: "field__label" }, k[0].toUpperCase() + k.slice(1)),
            el("input", {
              type: k === "age" ? "number" : "text",
              value: doc.identity[k] ?? "",
              onchange: e => store.update(x => {
                x.identity[k] = k === "age" ? (parseInt(e.target.value, 10) || null) : e.target.value;
              })
            })
          )
        )
      )
    )
  );
}
