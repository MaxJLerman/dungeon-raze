// Touch controls geometry: where every button, the stick area and the HUD
// boxes go for a given screen. Pure functions, no DOM. The honeycomb of
// buttons sits at the bottom right and the sweep in tests/t13.mjs checks it
// on every size and notch the game supports.
const VITALS_H = 64,
  BOSS_H = 52;
// action and size class, in honeycomb order; attack is the centre cell
const TOUCH_BTNS = [
  ["light", "atk"],
  ["dodge", "mid"],
  ["guard", "mid"],
  ["heavy", "mid"],
  ["lock", "mid"],
  ["heal", "small"],
  ["tool", "small"],
  ["special", "small"],
];

// A flat-topped hexagon with centre x, y and corner-to-corner width d
function hexContains(b, x, y) {
  const dx = x - b.x,
    dy = y - b.y,
    ap = b.d * 0.433;
  return (
    Math.abs(dy) <= ap &&
    Math.abs(dx * 0.866 + dy * 0.5) <= ap &&
    Math.abs(dx * 0.866 - dy * 0.5) <= ap
  );
}

// distance from a hexagon's centre to its edge, a little over in between
// corners, so a positive gap built from it is a lower bound
function hexReach(d, th) {
  let m = 0;
  for (let k = 0; k < 6; k++) m = Math.max(m, Math.cos(th - (k * Math.PI) / 3));
  return (d / 2) * m;
}

// one string per failed check; empty when the layout passes
function layoutProblems(L) {
  const out = [],
    { W, H, ins, btns } = L;
  const hit = (a, b) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const box = (b) => ({
    x: b.x - b.d / 2,
    y: b.y - b.d * 0.433,
    w: b.d,
    h: b.d * 0.866,
  });
  const bx0 = ins.l,
    bx1 = W - ins.r,
    by0 = ins.t,
    by1 = H - ins.b;
  for (const b of btns) {
    if (b.d * 0.866 < 46) out.push(b.act + " flat width " + (b.d * 0.866).toFixed(1));
    const q = box(b);
    if (q.x < bx0 - 0.01 || q.x + q.w > bx1 + 0.01 || q.y < by0 - 0.01 || q.y + q.h > by1 + 0.01)
      out.push(b.act + " out of bounds");
    for (const k of ["vitals", "map", "pause", "boss", "move"])
      if (hit(q, L[k])) out.push(b.act + " over " + k);
  }
  for (let i = 0; i < btns.length; i++)
    for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i],
        b = btns[j],
        th = Math.atan2(b.y - a.y, b.x - a.x);
      const gap =
        Math.hypot(b.x - a.x, b.y - a.y) -
        hexReach(a.d, th) -
        hexReach(b.d, th + Math.PI);
      if (gap < 5.5) out.push(a.act + " and " + b.act + " gap " + gap.toFixed(1));
    }
  for (const k of ["pause", "boss"])
    for (const o of ["vitals", "map"])
      if (hit(L[k], L[o])) out.push(k + " over " + o);
  if (L.map.w < 56) out.push("map " + L.map.w.toFixed(1));
  // The stick body, radius R, must sit inside the move area. The sprint ring
  // (1.45 R) is only a drag threshold and the finger is captured wherever it
  // goes, so the ring may reach past the area.
  const { rest, R, move } = L;
  if (
    rest.x - R < move.x0 ||
    rest.x + R > move.x1 ||
    rest.y - R < move.y0 ||
    rest.y + R > move.y1
  )
    out.push("stick body outside move area");
  return out;
}

function layoutAt(W, H, ins, scale) {
  const s = Math.min(W, H);
  // size scales the clamped value; its floor applies after
  const sz = (k, lo, hi, floor) => Math.max(floor, clamp(s * k, lo, hi) * scale);
  const P = sz(0.2, 66, 104, 66),
    u = sz(0.135, 56, 74, 56),
    S = sz(0.1, 54, 56, 54),
    g = clamp(s * 0.022, 6, 14),
    m = clamp(s * 0.04, 12, 32),
    R = sz(0.15, 52, 92, 52),
    ring = R * 1.45;
  const ax = W - m - ins.r - P / 2,
    ay = H - m - ins.b - P * 0.433,
    D = u * 0.866 + g,
    s3 = Math.sqrt(3),
    s7 = Math.sqrt(7);
  const spots = {
    light: [0, 0],
    dodge: [s3 * D, 180],
    guard: [2 * D, 150],
    heavy: [s3 * D, 120],
    lock: [2 * D, 90],
    heal: [s7 * D, 169.1],
    tool: [s7 * D, 130.9],
    special: [s7 * D, 109.1],
  };
  const btns = TOUCH_BTNS.map(([act, cls]) => {
    const [r, deg] = spots[act],
      a = (deg * Math.PI) / 180;
    return {
      act,
      x: ax + r * Math.cos(a),
      y: ay - r * Math.sin(a),
      d: cls === "atk" ? P : cls === "mid" ? u : S,
    };
  });
  const top = m + ins.t,
    clusterTop = Math.min(...btns.map((b) => b.y - b.d * 0.433));
  const vitals = { x: m + ins.l, y: top, w: clamp(W * 0.26, 150, 300), h: VITALS_H };
  const ms = Math.min(clamp(u * 1.5, 70, 130), clusterTop - top - g);
  const map = { x: W - m - ins.r - ms, y: top, w: ms, h: ms };
  const ps = S * 0.866;
  const pause = { x: map.x - g - ps, y: top, w: ps, h: ps };
  const bx = vitals.x + vitals.w + g;
  let boss = { x: bx, y: vitals.y, w: pause.x - g - bx, h: BOSS_H };
  if (boss.w < 160)
    boss = { x: vitals.x, y: vitals.y + VITALS_H + g, w: vitals.w, h: BOSS_H };
  const x0 = 16 + ins.l,
    y0 = Math.max(vitals.y + vitals.h, boss.y + boss.h) + g;
  const move = { x0, y0, x1: W * 0.42, y1: H - ins.b };
  const rest = { x: x0 + ring + 4, y: move.y1 - m - ring };
  return { W, H, scale, ins, P, u, S, g, m, R, ring, btns, move, rest, vitals, map, pause, boss };
}

// the largest size at or below o.size, down to 0.8, that passes
function touchLayout(W, H, ins, o) {
  const e = o.notch ? ins : { l: 0, r: 0, t: 0, b: 0 };
  let L;
  for (let k = Math.round(o.size * 100); ; k -= 5) {
    const c = Math.max(80, k);
    L = layoutAt(W, H, e, c / 100);
    if (layoutProblems(L).length === 0 || c <= 80) return L;
  }
}
