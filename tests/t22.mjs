// The sewer: water, D opening, the generator, its look and its culling.
// Run with: SCRIPT=$PWD/tests/t22.mjs node test.mjs smoke
const step = (name, body) => ({ name, eval: `(() => { const { G, cam } = DF; G.manual = true; ${body} })()` });
// a sewer run from a seed, with D live for the test
const sewer = (name, body, seed = 5) => step(name, `DF.LIVE_GRADES.add("D"); DF.newRun(${seed}, "D"); DF.show("play"); G.state = "play";
  const w = G.world, p = G.player, D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const routeLen = (ax, az, bx, bz) => { const r = w.route(ax, az, bx, bz, 0.6); if (!r) return Infinity; let l = 0, a = { x: ax, z: az }; for (const q of r) { l += D(a, q); a = q; } return l; };
  ${body}`);
export default [
  step("genWorld is unchanged by the refactor", `const GOLD = {"1":[746235854,114597360,"0,1,5,6,10,14,15",4096],"7":[1576213153,-448329776,"0,4,5,9,10,14,15",4560],"99":[-498320114,1281514488,"0,1,5,6,10,14,15",4464]};
  const h = (a) => { let x = 0; for (let i = 0; i < a.length; i++) x = (x * 31 + Math.round(a[i] * 1000)) | 0; return x; };
  const got = {}; for (const s of [1, 7, 99]) { DF.newRun(s); const w = G.world; got[s] = [h(w.pos), h(w.col), w.path.join(","), JSON.stringify(w.spawns).length]; }
  return { pass: JSON.stringify(got) === JSON.stringify(GOLD), got };`),
  step("every world reads water as dry", `const h = DF.genHub(); DF.newRun(99); const w = G.world;
    const ok = (x) => x.waterAt(0, 0) === 0 && x.bodyAt(0, 0) === -1 && Array.isArray(x.bodies) && Array.isArray(x.grates) && Array.isArray(x.wallTunnels) && Array.isArray(x.shafts);
    const F = new Float32Array(25).fill(1), Wt = new Float32Array(25); Wt[12] = 1; const f = DF.fieldFns(F, 0, 0, 4, 4, Wt);
    return { pass: ok(h) && ok(w) && f.waterAt(2, 2) === 1 && f.waterAt(2.5, 2) === 0.5 && f.waterAt(-5, 0) === 0 };`),
  step("water slows walking by WATER.slow", `DF.newRun(99); DF.show("play"); G.state = "play"; const w = G.world, p = G.player;
    const run = (wet) => { DF.newRun(99); const p = G.player; G.world.waterAt = () => wet; const x = p.x, z = p.z; DF.keys[DF.BIND.fwd] = true; DF.sim(0.6); DF.keys[DF.BIND.fwd] = false; return Math.hypot(p.x - x, p.z - z); };
    const dry = run(0), wet = run(1);
    return { pass: Math.abs(wet / dry - DF.WATER.slow) < 0.05, dry, wet };`),
  step("a dodge in water is shorter and lasts as long", `const go = (wet) => { DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player; G.world.waterAt = () => wet; const x = p.x, z = p.z;
      DF.keys[DF.BIND.fwd] = true; DF.taps[DF.BIND.dodge] = true; let n = 0; DF.sim(1.2, () => { if (p.state === "dodge") n++; }); DF.keys[DF.BIND.fwd] = false; return { d: Math.hypot(p.x - x, p.z - z), n }; };
    const a = go(0), b = go(1);
    return { pass: b.d < a.d * 0.75 && b.n === a.n, a, b };`),
  step("an enemy's wade factor scales its step in water", `DF.newRun(99); const e = G.enemies.find((e) => !e.def.boss);
    const stepX = (wet, wade) => { G.world.waterAt = () => wet; const old = e.def.wade; e.def.wade = wade; const x = e.x; DF.eStep(e, 1, 0, 4, 0.5); const d = e.x - x; e.x = x; e.def.wade = old; return d; };
    const base = stepX(0, 1.5), fast = stepX(1, 1.5), slow = stepX(1, undefined);
    return { pass: Math.abs(base - 2) < 1e-6 && Math.abs(fast - 3) < 1e-6 && Math.abs(slow - 2 * DF.WATER.slow) < 1e-6 };`),
  step("a sprint attack in water still starts the dash", `DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player; G.world.waterAt = () => 1;
    DF.keys[DF.BIND.fwd] = true; DF.keys[DF.BIND.sprint] = true; DF.sim(1.0);
    const sp = p.speed, ds = p.dspeed, run = p.cls.run;
    DF.taps[DF.BIND.light] = true; DF.sim(0.05);
    DF.keys[DF.BIND.fwd] = false; DF.keys[DF.BIND.sprint] = false;
    return { pass: p.state === "attack" && p.move === p.cls.dash && sp < run * 0.8 && ds > run * 0.8, move: p.move, state: p.state, sp, ds, run };`),
];
