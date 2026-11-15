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
  step("boots into the hall", `return { pass: G.zone === "hub" && G.world.hub === true && G.state === "play", zone: G.zone };`),
  step("E portal leads to a cave", `
  DF.enterHub(); const p = G.player, q = G.world.portals[0];
  p.x = q.x; p.z = q.z - 3; p.yaw = 0; cam.yaw = 0; DF.keys[DF.BIND.fwd] = true;
  let peak = 0, hurt = null;
  DF.sim(4, () => { if (G.trans) { peak = Math.max(peak, G.fade); if (hurt === null) hurt = DF.hurtPlayer(50, null, { px: p.x, pz: p.z - 1 }); } return G.zone === "hub" || !!G.trans; });
  DF.keys[DF.BIND.fwd] = false; const P = G.player;
  const c = { zone: G.zone === "cave", grade: G.grade === "E", done: !G.trans && G.fade === 0, peak: peak > 0.95, hurt: hurt === "none",
    cave: G.world.shrines.length > 0 && G.enemies.some((e) => e.type === "warden"), fresh: P.state === "free" && P.hp === P.maxHp,
    msg: G.msgs.some((m) => m.text === "E-RANK GATE") };
  return { pass: Object.values(c).every(Boolean), c };`),
  step("sealed frames do nothing", `
  DF.enterHub(); const p = G.player; let ok = true; cam.yaw = 0; DF.keys[DF.BIND.fwd] = true;
  for (const q of G.world.portals.slice(1)) { p.x = q.x; p.z = q.z - 3; DF.sim(3); ok = ok && G.zone === "hub" && !G.trans; }
  DF.keys[DF.BIND.fwd] = false; return { pass: ok };`),
  step("return to base", `
  DF.enterCave("E", 99); DF.enterHub(G.grade); const p = G.player, q = G.world.portals[0];
  const at = Math.hypot(p.x - q.x, p.z - (q.z - 3.5)) < 0.01 && Math.cos(p.yaw) < -0.99;
  DF.sim(2); return { pass: at && G.zone === "hub" && !G.trans && G.checkpoint === null };`),
  step("round trips stay fresh", `
  let ok = true; const seeds = new Set();
  for (let i = 0; i < 5; i++) { DF.enterCave("E"); seeds.add(G.seed);
    DF.hitEnemy(G.enemies.find((e) => e.type === "warden"), 1e6, 0, {}); ok = ok && G.bossDead && !!G.gate;
    DF.enterHub("E"); ok = ok && G.zone === "hub" && !G.gate && !G.bossDead && G.kills === 0 && !G.player.lock; }
  DF.enterCave("E"); ok = ok && G.enemies.some((e) => e.type === "warden" && !e.dead);
  return { pass: ok && seeds.size === 5 };`),
  step("swap clears things in flight", `
  DF.enterHub(); const p = G.player, q = G.world.portals[0];
  G.projs.push({ x: 0, y: 1, z: 0, vx: 0, vz: 1, life: 9, own: "p", dmg: 1, post: 0, kind: "arrow", c: [1, 1, 1] });
  G.pending.push({ x: q.x, z: q.z, r: 3, dmg: 1, post: 0, c: [1, 1, 1], t: 0.6 });
  p.x = q.x; p.z = q.z - 0.5; DF.sim(2, () => G.zone === "hub" || !!G.trans);
  return { pass: G.zone === "cave" && G.projs.length === 0 && G.pending.length === 0 && G.rings.length === 0 };`),
  step("entering mid-dodge arrives free", `
  DF.enterHub(); const p = G.player, q = G.world.portals[0]; p.x = q.x; p.z = q.z - 2.5; p.yaw = 0; cam.yaw = 0;
  DF.keys[DF.BIND.fwd] = true; K("dodge"); DF.sim(3, () => G.zone === "hub" || !!G.trans); DF.keys[DF.BIND.fwd] = false;
  const P = G.player; return { pass: G.zone === "cave" && P.state === "free" && P.buf === null && P.iframe <= 1 };`),
  step("reduced motion cuts", `
  DF.enterHub(); DF.startTrans("E", true); return { pass: G.zone === "cave" && !G.trans && G.fade === 0 };`),
  step("run timer", `
  DF.enterHub(); DF.sim(1); const hub = G.runT; DF.enterCave("E", 99); DF.sim(1);
  return { pass: hub === 0 && G.runT > 0.9 };`),
];
