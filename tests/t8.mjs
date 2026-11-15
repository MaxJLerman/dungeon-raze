// Base of operations: hall world, portals, transition, training dummy, screens.
// Run with: SCRIPT=$PWD/tests/t8.mjs node test.mjs hub
// Every step returns an object with a boolean `pass`.
const step = (name, body) => ({
  name,
  eval: `(() => { const { G, cam } = DF; G.manual = true; const K = (a) => { DF.taps[DF.BIND[a]] = true; }; ${body} })()`,
});
export default [
  step("hub world", `
  const w = DF.genHub(), P = w.portals, f = (o) => w.fieldAt(o.x, o.z);
  const front = P.map((q) => DF.portalFront(q, 3.5));
  const pillars = [-12, 12].flatMap((x) => [-9, -1, 7].map((z) => ({ x, z })));
  const c = {
    arrays: ["nodes","edges","path","shrines","halos","lights","spawns","portals"].every((k) => Array.isArray(w[k])),
    fns: ["fieldAt","ceilAt","resolve","los"].every((k) => typeof w[k] === "function"),
    hub: w.hub === true && w.nodes.length === 0 && w.shrines.length === 0,
    mesh: w.pos.length > 0 && w.pos.length % 9 === 0 && w.col.length === (w.pos.length / 3) * 4,
    grades: P.map((q) => q.grade).join("") === "EDCBAS",
    order: P.every((q, i) => i === 0 || q.x < P[i - 1].x),
    open: P.map((q) => +q.open).join("") === "100000",
    pitch: P[0].x === 11.5 && Math.abs(P[0].x - P[1].x - 4.6) < 0.01,
    front: Math.abs(front[0].x - 11.5) < 0.01 && Math.abs(front[0].z - 12.5) < 0.01,
    start: w.spawn.x === 0 && w.spawn.z === -10 && w.spawnYaw === 0 && f(w.spawn) >= 1,
    dummy: w.dummySpot.x === -5 && w.dummySpot.z === -1 && f(w.dummySpot) >= 2,
    walls: f({ x: 0, z: 0 }) > 5 && f({ x: 16, z: 0 }) < 0 && f({ x: 0, z: 18 }) < 0,
    pillars: pillars.every((q) => f(q) < 0),
    reach: P.every((q) => f(q) >= 0.5) && front.every((q) => f(q) >= 2),
    sight: front.every((q) => w.los(w.spawn.x, w.spawn.z, q.x, q.z)),
    ceil: w.ceilAt(0, 0) === 7,
    lights: w.lights.length === 5,
    names: DF.GRADES.E.name === "E-rank gate" && DF.GRADES.S.name === "S-rank gate",
  };
  return { pass: Object.values(c).every(Boolean), c };`),
];
