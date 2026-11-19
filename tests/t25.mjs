// Shared seams for a boss with its own rules: the atkOk hook, def.arena, def.ownPhases, def.fell.
// Run with: SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke
// The test type __k (a copy of the Warden) is registered inside each step and deleted at its end.
const draw = `const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));`;
const step = (name, body) => ({
  name,
  eval: `(async () => { const { G, cam } = DF; G.manual = true; ${draw}
  const drop = () => { delete DF.EDEF.__k; delete DF.EBEH.__k; };
  const reg = (extra) => { DF.EDEF.__k = { ...DF.EDEF.warden, ...extra }; };
  try { ${body} } finally { drop(); } })()`,
});
// a D run (seed 5) with the player and the cavern's centre to hand
const dRun = `DF.setClass("fighter"); DF.LIVE_GRADES.add("D"); DF.newRun(5, "D"); DF.LIVE_GRADES.delete("D"); DF.show("play"); G.state = "play";
  const p = G.player, w = G.world, B = w.boss; G.enemies = []; G.projs = [];`;
export default [
  step("atkOk leaves refused attacks out", `
  DF.newRun(99); DF.show("play"); G.state = "play"; G.enemies = [];
  reg({});
  const mk = () => DF.makeEnemy({ type: "__k", x: G.player.x + 4, z: G.player.z, yaw: 0, node: -1 });
  const e = mk(), c1 = e.def.atks.c1, c = { p: G.player, w: G.world, dx: 4, dz: 0, dist: 4, toP: 0, alive: true };
  let plain = 0; for (let i = 0; i < 200; i++) if (DF.chooseAtk(e, 4, c) === c1) plain++;
  let seen = 0, other = 0, called = 0;
  DF.EBEH.__k = { atkOk: (q, a, cc) => { if (cc === c) called++; return a !== q.def.atks.c1; } };
  for (let i = 0; i < 200; i++) { const a = DF.chooseAtk(e, 4, c); if (a === c1) seen++; else if (a) other++; }
  const out = { plain, seen, other, called };
  return { pass: plain > 0 && seen === 0 && called > 0, ...out };`),
  step("an arena boss holds while the player is in the cavern", `
  ${dRun}
  const run = (extra) => {
    reg(extra); G.enemies = [];
    const e = DF.makeEnemy({ type: "__k", x: B.x - 20, z: B.z, yaw: 0, node: -1 });
    e.hx = e.x - 35; e.hz = e.z; e.aware = true; e.state = "chase"; e.hp = e.def.hp; G.enemies.push(e);
    p.x = B.x + 20; p.z = B.z; p.hp = p.maxHp; p.state = "free"; cam.px = p.x; cam.pz = p.z; G.inBoss = true;
    return e;
  };
  const keep = () => { p.hp = p.maxHp; p.stam = p.maxStam; };
  // arena, player in the cavern 40 m off: it holds
  let e = run({ arena: true }); DF.sim(0.5, keep); const held = e.state, inBoss = G.inBoss;
  // the player leaves the cavern: G.inBoss turns false and it gives up
  p.x = B.x + B.r + DF.PURSUIT.bossPad + 4; p.z = B.z; DF.sim(0.5, keep); const left = e.state, inBossOut = G.inBoss;
  // a plain boss copy gives up at 40 m, as today
  e = run({}); DF.sim(0.5, keep); const plain = e.state;
  return { pass: held === "chase" && inBoss === true && left === "return" && inBossOut === false && plain === "return", held, inBoss, left, inBossOut, plain };`),
  step("own phases skip the half-health roar", `
  DF.newRun(99); DF.show("play"); G.state = "play"; G.enemies = [];
  const hit = (type, extra) => {
    if (extra) reg(extra);
    const e = DF.makeEnemy({ type, x: G.player.x + 3, z: G.player.z, yaw: 0, node: -1 }); G.enemies = [e]; e.aware = true;
    e.hp = e.def.hp * 0.52; DF.hitEnemy(e, e.def.hp * 0.07, 0, { src: "melee" });
    return { phase: e.phase, state: e.state, hp: e.hp / e.def.hp };
  };
  const own = hit("__k", { ownPhases: true });
  const wd = hit("warden");
  return { pass: own.phase === 1 && own.state !== "roar" && wd.phase === 2 && wd.state === "roar", own, wd };`),
  step("a boss names its own fall", `
  ${dRun}
  const fall = async (type, extra) => {
    if (extra) reg(extra);
    G.msgs = []; G.bossDead = false;
    const e = DF.makeEnemy({ type, x: B.x, z: B.z, yaw: 0, node: -1 }); G.enemies = [e];
    DF.kill(e); await draw();
    return document.getElementById("msgs").textContent;
  };
  try {
    const own = await fall("__k", { fell: "TEST FALLS" });
    const wd = await fall("warden");
    return { pass: own.includes("TEST FALLS") && !own.includes("WARDEN") && wd.includes("THE WARDEN FALLS"), own, wd };
  } finally { DF.resetCleared(); G.bossDead = false; }`),
];
