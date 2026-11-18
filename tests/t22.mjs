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
];
