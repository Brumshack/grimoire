export function rollDie(sides) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % sides) + 1;
}

export function rollDice(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(sides));
  return rolls;
}

/** parse "2d6+3" → { count, sides, mod } */
export function parseExpr(expr) {
  const m = String(expr).trim().match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!m) return null;
  const sign = m[3] === "-" ? -1 : 1;
  return { count: +m[1], sides: +m[2], mod: m[4] ? sign * +m[4] : 0 };
}

export function rollExpr(expr) {
  const p = parseExpr(expr);
  if (!p) return null;
  const rolls = rollDice(p.count, p.sides);
  const total = rolls.reduce((s, r) => s + r, 0) + p.mod;
  return { rolls, mod: p.mod, total, expr };
}

/** Point-buy cost table */
export const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

/** average hp per hit die (round up) = sides/2 + 1 */
export function averageHitDie(sides) {
  return Math.floor(sides / 2) + 1;
}
