// Touch layout: honeycomb geometry, sizes, hit shapes, problem checks and the size sweep.
// Run with: SCRIPT=$PWD/tests/t13.mjs node test.mjs title
// Every step returns an object with a boolean `pass`.
const step = (name, body) => ({
  name,
  eval: `(() => { const { touchLayout, layoutProblems, hexContains } = DF;
  const Z = { l: 0, r: 0, t: 0, b: 0 };
  const near = (a, b, e = 0.5) => Math.abs(a - b) <= e;
  const by = (L, act) => L.btns.find((b) => b.act === act);
  const all = (c) => Object.values(c).every((v) => v === true);
  ${body} })()`,
});

export default [
  step("honeycomb geometry", `
    const L = touchLayout(852, 393, Z, { size: 1, notch: true });
    const A = by(L, "light"), D = L.u * 0.866 + L.g, s3 = Math.sqrt(3), s7 = Math.sqrt(7);
    const spec = { dodge: [s3, 180], guard: [2, 150], heavy: [s3, 120], special: [2, 90],
      heal: [s7, 169.1], tool: [s7, 130.9] };
    const at = {};
    for (const [act, [k, deg]] of Object.entries(spec)) {
      const b = by(L, act), a = deg * Math.PI / 180;
      at[act] = near(b.x, A.x + k * D * Math.cos(a)) && near(b.y, A.y - k * D * Math.sin(a));
    }
    // lock is in the column left of ability, raised by between 2.5 and 3.5 cells
    const K = by(L, "lock"), up = (A.y - K.y) / D;
    at.lock = near(K.x, A.x - 0.866 * D) && up >= 2.5 - 1e-6 && up <= 3.5 + 1e-6;
    const tall = touchLayout(1376, 1032, Z, { size: 1, notch: true });
    at.lockTall = near((by(tall, "light").y - by(tall, "lock").y) / (tall.u * 0.866 + tall.g), 3.5, 0.01);
    const c = { ...at, bottom: near(A.y + A.d * 0.433, 393 - L.m), scale: L.scale === 1, count: L.btns.length === 8 };
    return { pass: all(c), ...c, up };`),
  step("sizes from the short side", `
    const a = touchLayout(1376, 1032, Z, { size: 1, notch: true });
    const b = touchLayout(568, 320, Z, { size: 1, notch: true });
    const p = touchLayout(852, 393, Z, { size: 1, notch: true });
    const flat = (L) => L.btns.every((x) => x.d * 0.866 >= 46);
    const d = (L, act) => by(L, act).d;
    const c = { bigP: a.P === 135, bigU: near(a.u, 74 * 1.12, 0.01), bigK: a.k === 74, bigS: a.S === 56,
      smallP: near(b.P, 83.2, 0.01), smallU: b.u === 56, smallK: b.k === 56, smallS: b.S === 54,
      flatBig: flat(a), flatSmall: flat(b),
      order: [a, b, p].every((L) => d(L, "light") > d(L, "dodge") && d(L, "dodge") >= d(L, "lock") && d(L, "lock") >= d(L, "heal")),
      midSame: [a, b, p].every((L) => ["guard", "heavy", "special"].every((x) => d(L, x) === d(L, "dodge"))),
      phoneGrows: p.u > p.k && p.P > p.k * 1.5 };
    return { pass: all(c), ...c, got: [a.P, a.u, a.k, a.S, b.P, b.u, b.k, b.S, p.P, p.u, p.k] };`),
  step("hexContains", `
    const h = { x: 100, y: 200, d: 80 }, r = 40, ap = r * 0.866, rad = (d) => d * Math.PI / 180;
    const c = {
      centre: hexContains(h, 100, 200),
      flatIn: hexContains(h, 100, 200 - 0.95 * ap),
      flatOut: !hexContains(h, 100, 200 - 1.05 * ap),
      cornerIn: hexContains(h, 100 + 0.95 * r, 200),
      thirtyOut: !hexContains(h, 100 + 0.95 * r * Math.cos(rad(30)), 200 + 0.95 * r * Math.sin(rad(30))),
    };
    return { pass: all(c), ...c };`),
  step("problems catches overlap, bounds, hud, move area and size", `
    const base = touchLayout(852, 393, Z, { size: 1, notch: true });
    const copy = () => JSON.parse(JSON.stringify(base));
    const o = layoutProblems(base);
    const a = copy(); { const d = by(a, "dodge"), g = by(a, "guard"); d.x = g.x; d.y = g.y; }
    const b = copy(); { const k = by(b, "light"); k.x += b.W - b.ins.r - (k.x + k.d / 2) + 10; }
    const c = copy(); { const k = by(c, "lock"); c.map = { x: k.x - 20, y: k.y - 20, w: 80, h: 80 }; }
    const d = copy(); by(d, "tool").d = 45 / 0.866;
    const e = copy(); { const k = by(e, "light"); k.x = 50; k.y = 200; }
    const r = { base: o.length === 0, overlap: layoutProblems(a).length > 0, bounds: layoutProblems(b).length > 0,
      hud: layoutProblems(c).length > 0, size: layoutProblems(d).length > 0,
      move: layoutProblems(e).some((x) => /over move/.test(x)) };
    return { pass: all(r), ...r, baseProblems: o };`),
  step("notch off ignores insets", `
    const ins = { l: 47, r: 47, t: 0, b: 21 };
    const on = touchLayout(852, 393, ins, { size: 1, notch: true });
    const off = touchLayout(852, 393, ins, { size: 1, notch: false });
    const a = by(on, "light"), b = by(off, "light");
    const c = { x: near(b.x - a.x, ins.r, 0.001), y: near(b.y - a.y, ins.b, 0.001), same: on.scale === 1 && off.scale === 1 };
    return { pass: all(c), ...c, dx: b.x - a.x, dy: b.y - a.y, scales: [on.scale, off.scale] };`),
  step("sweep", `
    const cases = [];
    const phoneIns = (s) => [Z, { l: 24, r: 24, t: 0, b: 0 }, ...(s >= 320 ? [{ l: 47, r: 47, t: 0, b: 21 }] : [])];
    for (let s = 280; s <= 499; s += 10)
      for (const q of [16 / 9, 2, 19.5 / 9, 20 / 9, 22 / 9, 2.65])
        for (const ins of phoneIns(s)) cases.push([Math.round(s * q), s, ins]);
    for (let s = 500; s <= 1100; s += 10)
      for (const q of [1.2, 4 / 3, 1.43, 1.5, 1.6])
        for (const ins of [Z, { l: 0, r: 0, t: 0, b: 20 }]) cases.push([Math.round(s * q), s, ins]);
    let n = 0, fails = [], minFlat = 1e9, minGap = 1e9, minMap = 1e9, minScale12 = 9;
    const reach = (b, th) => { let m = 0; for (let k = 0; k < 6; k++) m = Math.max(m, Math.cos(th - k * Math.PI / 3)); return b.d / 2 * m; };
    for (const [W, H, ins] of cases) for (const size of [0.8, 1, 1.2]) for (const notch of [true, false]) {
      n++;
      const L = touchLayout(W, H, ins, { size, notch });
      const p = layoutProblems(L);
      const bad = p.length > 0 || (size === 1 && L.scale !== 1);
      if (bad && fails.length < 10) fails.push({ W, H, ins, size, notch, scale: L.scale, p: p.slice(0, 3) });
      for (const b of L.btns) minFlat = Math.min(minFlat, b.d * 0.866);
      for (let i = 0; i < L.btns.length; i++) for (let j = i + 1; j < L.btns.length; j++) {
        const a = L.btns[i], b = L.btns[j], th = Math.atan2(b.y - a.y, b.x - a.x);
        minGap = Math.min(minGap, Math.hypot(b.x - a.x, b.y - a.y) - reach(a, th) - reach(b, th + Math.PI));
      }
      minMap = Math.min(minMap, L.map.w);
      if (size === 1.2) minScale12 = Math.min(minScale12, L.scale);
    }
    return { pass: fails.length === 0, cases: n, fails, minFlat, minGap, minMap, minScale12 };`),
];
