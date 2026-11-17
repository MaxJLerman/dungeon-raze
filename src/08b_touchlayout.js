// Touch controls geometry: where every button, the stick area and the HUD
// boxes go for a given screen. Pure functions, no DOM. The buttons gather
// round attack at the bottom right and the sweep in tests/t13.mjs checks them
// on every size and notch the game supports.
const VITALS_H = 64,
  BOSS_H = 52;
// action and size class; layoutAt places each one and gives it its size
const TOUCH_BTNS = [
  ["light", "atk"],
  ["dodge", "mid"],
  ["guard", "mid"],
  ["heavy", "mid"],
  ["special", "mid"],
  ["lock", "lock"],
  ["heal", "small"],
  ["tool", "small"],
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

// The gap between two buttons, negative when they overlap. Both are
// flat-topped hexagons, so the shape b's centre must stay out of is a
// flat-topped hexagon of width a.d + b.d round a's centre, and the gap is
// the distance from b's centre to that shape.
function hexGap(a, b) {
  const r = (a.d + b.d) / 2,
    vx = b.x - a.x,
    vy = b.y - a.y;
  let out = -Infinity,
    near = Infinity;
  for (let k = 0; k < 6; k++) {
    const t0 = (k * Math.PI) / 3,
      t1 = t0 + Math.PI / 3,
      tn = t0 + Math.PI / 6;
    // how far v is outside this edge's line
    out = Math.max(out, vx * Math.cos(tn) + vy * Math.sin(tn) - r * 0.866);
    // distance from v to this edge
    const px = r * Math.cos(t0),
      py = r * Math.sin(t0),
      ex = r * Math.cos(t1) - px,
      ey = r * Math.sin(t1) - py,
      t = clamp(((vx - px) * ex + (vy - py) * ey) / (ex * ex + ey * ey), 0, 1);
    near = Math.min(near, Math.hypot(vx - px - t * ex, vy - py - t * ey));
  }
  return out <= 0 ? out : near;
}

// a button of width d placed exactly g clear of button c, in the direction
// th (radians, 0 to the right, positive going up the screen)
function hexBeside(c, d, th, g) {
  const at = (r) => ({ x: c.x + r * Math.cos(th), y: c.y - r * Math.sin(th), d, th });
  let lo = 0,
    hi = (c.d + d) / 2 + g;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (hexGap(c, at(mid)) < g) lo = mid;
    else hi = mid;
  }
  return at(hi);
}

// rolls a button of width d round c, gap clear of it, from th0 in steps of
// step until it is g clear of every button in others; it stays at th0 when
// it is clear there
function hexRoll(c, d, th0, step, gap, g, others) {
  const clear = (q) => others.every((o) => hexGap(o, q) >= g - 1e-6);
  let a = th0,
    q = hexBeside(c, d, a, gap);
  if (clear(q)) return q;
  for (let i = 0; i < 720 && !clear(q); i++) q = hexBeside(c, d, (a += step), gap);
  // the first clear step overshoots by up to one step; close it up
  let lo = a - step,
    hi = a;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (clear(hexBeside(c, d, mid, gap))) hi = mid;
    else lo = mid;
  }
  return hexBeside(c, d, hi, gap);
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
    // move is { x0, y0, x1, y1 }; the others are { x, y, w, h }
    const mv = L.move,
      mr = { x: mv.x0, y: mv.y0, w: mv.x1 - mv.x0, h: mv.y1 - mv.y0 };
    for (const k of ["vitals", "map", "pause", "boss"])
      if (hit(q, L[k])) out.push(b.act + " over " + k);
    if (hit(q, mr)) out.push(b.act + " over move");
  }
  for (let i = 0; i < btns.length; i++)
    for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i],
        b = btns[j],
        gap = hexGap(a, b);
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
  // the plaque controls
  if (L.prompt) {
    const pq = L.prompt;
    for (const b of btns) if (hit(pq, box(b))) out.push("prompt over " + b.act);
    for (const k of ["vitals", "map", "pause", "boss"]) if (hit(pq, L[k])) out.push("prompt over " + k);
    const d = L.dpad,
      dq = { x: d.x - d.d / 2, y: d.y - d.d / 2, w: d.d, h: d.d };
    if (dq.x < move.x0 - 0.01 || dq.x + dq.w > move.x1 + 0.01 || dq.y < move.y0 - 0.01 || dq.y + dq.h > move.y1 + 0.01)
      out.push("dpad outside move area");
    if (d.d / 3 < 40) out.push("dpad arm " + (d.d / 3).toFixed(1));
    if (hit(dq, L.close)) out.push("plaque over dpad");
    if (L.close.w < 150) out.push("plaque " + L.close.w.toFixed(1));
  }
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
  // attack is about 20% over its first size, dodge, guard, heavy and ability
  // about 22% over lock's, and on the smallest screens both fall back to the
  // floors
  const u = sz(0.18, 56, clamp(s * 0.135, 56, 74) * 1.22, 56),
    // attack stays at least 1.4 times the four round it, as in the owner's
    // layout, so they keep clear of each other on the smallest screens
    P = Math.max(sz(0.243, 66, 126, 66), u * 1.4),
    k = sz(0.135, 56, 74, 56),
    S = sz(0.1, 54, 56, 54),
    g = clamp(s * 0.022, 6, 14),
    m = clamp(s * 0.04, 12, 32),
    R = sz(0.15, 52, 92, 52),
    ring = R * 1.45;
  const top = m + ins.t,
    mapPref = clamp(k * 1.5, 70, 130),
    A = { x: W - m - ins.r - P / 2, y: H - m - ins.b - P * 0.433, d: P };
  // The owner's layout, drawn on a OnePlus 13. Each button sits g clear of
  // the one it hangs off, in the direction that layout had: guard on top of
  // attack and flask on top of guard, heavy at attack's upper left and dodge
  // at its lower left, ability left of heavy, lock above ability, and tool
  // above heavy. Lock and tool keep the wider gaps that layout gave them.
  const deg = (d) => (d * Math.PI) / 180;
  const at = { light: A };
  at.guard = hexBeside(A, u, deg(90), g);
  at.heal = hexBeside(at.guard, S, deg(90), g);
  at.heavy = hexBeside(A, u, deg(145), g);
  at.special = hexBeside(at.heavy, u, deg(-162), g);
  at.dodge = hexBeside(A, u, deg(-165), g);
  // Where there is less room, as on the smallest screens, tool slides left
  // round heavy until it clears flask, and lock slides left round ability
  // until it clears tool.
  const step = Math.PI / 360;
  at.tool = hexRoll(at.heavy, S, deg(83), step, g * 1.85, g, [at.heal, at.guard]);
  at.lock = hexRoll(at.special, k, deg(84), step, g * 2.3, g, [at.tool, at.heavy]);
  const btns = TOUCH_BTNS.map(([act]) => ({ act, x: at[act].x, y: at[act].y, d: at[act].d }));
  const clusterTop = Math.min(...btns.map((b) => b.y - b.d * 0.433));
  const vitals = { x: m + ins.l, y: top, w: clamp(W * 0.26, 150, 300), h: VITALS_H };
  const ms = Math.min(mapPref, clusterTop - top - g);
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
  // In the hall. The Inspect prompt, tapped to open a plaque: low in the
  // middle as on a desktop if that is clear of the buttons and the HUD, else
  // moved left of the buttons, else up under the HUD. It may cover the stick
  // area, and takes the finger only while it shows.
  const pw = clamp(W * 0.3, 150, 240),
    ph = 48,
    over = (r, q) => r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h,
    hexBox = (b) => ({ x: b.x - b.d / 2, y: b.y - b.d * 0.433, w: b.d, h: b.d * 0.866 }),
    clear = (r) => !btns.some((b) => over(r, hexBox(b))) && ![vitals, map, pause, boss].some((q) => over(r, q)),
    leftOf = Math.max(x0, Math.min(W / 2 - pw / 2, Math.min(...btns.map((b) => b.x - b.d / 2)) - g - pw));
  const spots = [
    [W / 2 - pw / 2, H * 0.62 - ph / 2],
    [leftOf, H * 0.62 - ph / 2],
    [W / 2 - pw / 2, y0],
    [leftOf, y0],
  ].map(([x, y]) => ({ x, y, w: pw, h: ph }));
  const prompt = spots.find(clear) || spots[0];
  // While a plaque is open: a D-pad at the left of the stick area, and the
  // plaque card in the middle, which a tap closes. The card is as wide as the
  // room the D-pad leaves on both sides.
  const dd = Math.min(2.4 * R, move.y1 - move.y0, move.x1 - move.x0),
    dpad = {
      x: move.x0 + dd / 2,
      y: clamp(rest.y, move.y0 + dd / 2, move.y1 - dd / 2),
      d: dd,
    };
  const cw = Math.min(s * 0.62, 420, W - 2 * (dpad.x + dd / 2 + g)),
    chh = Math.min(s * 0.8, 540),
    close = { x: W / 2 - cw / 2, y: H / 2 - chh / 2, w: cw, h: chh };
  return { W, H, scale, ins, P, u, k, S, g, m, R, ring, btns, move, rest, vitals, map, pause, boss, prompt, dpad, close };
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
