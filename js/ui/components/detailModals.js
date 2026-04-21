import { openModal } from "./modal.js";
import { el } from "../../util/dom.js";
import { SPELL_SCHOOLS } from "../../data/conditions.js";
import { escapeText } from "../../util/sanitize.js";

const componentString = (c) => {
  const parts = [];
  if (c?.v) parts.push("V");
  if (c?.s) parts.push("S");
  if (c?.m) parts.push(`M${c.material ? ` (${c.material})` : ""}`);
  return parts.join(", ") || "—";
};

export function openSpellDetail(spell) {
  const tags = [];
  tags.push(spell.level === 0 ? "Cantrip" : `Level ${spell.level}`);
  tags.push(SPELL_SCHOOLS[spell.school]?.name || spell.school);
  if (spell.concentration) tags.push("Concentration");
  if (spell.ritual) tags.push("Ritual");

  const body = el("div");
  body.append(el("div", { class: "row row--wrap", style: { gap: "1rem", marginBottom: "1rem" } },
    kv("Casting Time", spell.castingTime),
    kv("Range", spell.range),
    kv("Components", componentString(spell.components)),
    kv("Duration", spell.duration)
  ));
  body.append(el("p", { html: escapeText(spell.description).replace(/\n\n/g, "</p><p>") }));
  if (spell.higherLevel) {
    body.append(el("h5", {}, "At higher levels"));
    body.append(el("p", {}, spell.higherLevel));
  }
  if (spell.classes?.length) {
    body.append(el("div", { class: "tooltip__meta" }, `Classes: ${spell.classes.join(", ")}`));
  }

  openModal({ title: spell.name, subtitle: tags.join(" · "), body });
}

export function openItemDetail(item) {
  const body = el("div");
  const rows = [];
  if (item.type === "weapon") {
    rows.push(kv("Damage", `${item.damage} ${item.damageType}`));
    if (item.range) rows.push(kv("Range", item.range));
    rows.push(kv("Properties", (item.properties || []).join(", ") || "—"));
  }
  if (item.type === "armor") {
    rows.push(kv("Armor Class", item.ac));
    rows.push(kv("Type", item.armorType));
    if (item.strReq) rows.push(kv("Str Requirement", item.strReq));
    if (item.stealth) rows.push(kv("Stealth", item.stealth));
  }
  rows.push(kv("Weight", `${item.weight ?? 0} lb`));
  rows.push(kv("Cost", `${item.cost ?? 0} gp`));
  if (item.rarity) rows.push(kv("Rarity", item.rarity));

  body.append(el("div", { class: "row row--wrap", style: { gap: "1rem", marginBottom: "1rem" } }, ...rows));
  if (item.description) body.append(el("p", {}, item.description));

  openModal({ title: item.name, subtitle: item.type, body });
}

export function openFeatureDetail(feature) {
  openModal({
    title: feature.name,
    subtitle: `${feature.source || ""}${feature.level ? ` · Level ${feature.level}` : ""}`,
    body: el("p", {}, feature.desc || "")
  });
}

function kv(label, value) {
  return el("div", {},
    el("div", { class: "label", style: { marginBottom: 0 } }, label),
    el("div", {}, String(value ?? "—"))
  );
}
