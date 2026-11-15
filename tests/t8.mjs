// Base of operations: hall world, portals, transition, training dummy, screens.
// Run with: SCRIPT=$PWD/tests/t8.mjs node test.mjs hub
// Every step returns an object with a boolean `pass`.
const step = (name, body) => ({
  name,
  eval: `(() => { const { G, cam } = DF; G.manual = true; const K = (a) => { DF.taps[DF.BIND[a]] = true; }; ${body} })()`,
});
// place moves the player to stand `dist` metres in front of the dummy, facing
// it. near also declares d and p, so use it once per step.
const place = (dist) => `p.x = d.x; p.z = d.z - ${dist}; p.yaw = 0; cam.yaw = 0; cam.px = p.x; cam.pz = p.z;`;
const near = (dist) => `const d = G.enemies.find((e) => e.def.dummy), p = G.player; ${place(dist)}`;
const reach = (id) => (id === "mage" || id === "ranger" ? 9 : 2.4);
const shown = `const shown = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== "none"; };`;
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
    lights: w.lights.length === 6,
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
  p.x = q.x; p.z = q.z; DF.sim(2, () => G.zone === "hub" || !!G.trans);
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
  step("the hall holds only the dummy", `
  DF.enterHub(); const d = G.enemies[0], s = G.world.dummySpot;
  return { pass: G.enemies.length === 1 && d.def.dummy === true && d.x === s.x && d.z === s.z && d.aware === true };`),
  ...["assassin", "fighter", "tanker", "mage", "ranger"].map((id) =>
    step("dummy survives " + id, `
    DF.setClass("${id}"); DF.enterHub(); ${near(reach(id))}
    K("lock"); DF.sim(0.1); const locked = p.lock === d; let hits = 0, f0 = d.flash;
    for (let r = 0; r < 4; r++) {
      DF.sim(1.5, (i) => { if (i % 12 === 0) K("light"); if (d.flash > f0) hits++; f0 = d.flash; });
      p.stam = p.maxStam; p.state = "free"; K("heavy"); DF.sim(1.3);
      p.state = "free"; K("tool"); DF.sim(1.0);
      p.state = "free"; p.focus = 100; K("special"); DF.sim(2.0);
      p.hp = p.maxHp; p.stam = p.maxStam; p.state = "free"; ${place(reach(id))}
    }
    const c = { locked, hits: hits >= 4, alive: !d.dead && d.state !== "dead" && G.enemies.includes(d), hp: d.hp === d.def.hp,
      home: d.x === d.hx && d.z === d.hz && d.yaw === d.hyaw, nan: p.x === p.x, kills: G.kills === 0 };
    return { pass: Object.values(c).every(Boolean), c, hits };`),
  ),
  step("dummy can be staggered and executed", `
  DF.setClass("fighter"); DF.enterHub(); ${near(2.4)}
  d.posture = d.def.posture - 1; K("light"); DF.sim(0.8, () => d.state !== "stagger"); const stag = d.state === "stagger";
  p.state = "free"; p.hp = 50; K("light"); DF.sim(0.2); const exec = p.state === "execute"; DF.sim(4);
  const c = { stag, exec, alive: !d.dead && G.enemies.includes(d), idle: d.state === "idle", post: d.posture === 0, hp: d.hp === d.def.hp, healed: p.hp > 50 };
  return { pass: Object.values(c).every(Boolean), c };`),
  step("stagger ends on its own", `
  DF.setClass("fighter"); DF.enterHub(); ${near(6)} d.posture = d.def.posture; DF.hitEnemy(d, 1, 1, { src: "melee" });
  const stag = d.state === "stagger"; DF.sim(4); return { pass: stag && d.state === "idle" && d.posture === 0 };`),
  step("hall refills", `
  DF.setClass("fighter"); DF.enterHub(); let p = G.player; p.focus = 0; p.tool = 0; DF.sim(4);
  const hub = p.focus >= 99 && p.tool >= Math.min(2, p.cls.tool.max);
  DF.enterCave("E", 99); p = G.player; p.focus = 0; p.tool = 0; p.restCD = 99; DF.sim(4);
  return { pass: hub && p.focus < 50 && p.tool === 0 };`),
  step("class change in the hall", `
  DF.setClass("fighter"); DF.enterHub(); ${near(4)} const x = p.x, z = p.z; DF.setClass("mage"); DF.sim(0.5);
  return { pass: G.player.clsId === "mage" && Math.hypot(G.player.x - x, G.player.z - z) < 0.5 && G.enemies.length === 1 && !d.dead && G.zone === "hub" };`),
  step("hall screens", `${shown}
  const txt = (id) => document.getElementById(id).textContent.trim(), click = (id) => document.getElementById(id).click();
  const c = { play: txt("btnPlay") === "Enter the hall" };
  DF.enterHub(); DF.show("pause"); c.hubPause = !shown("btnBase");
  DF.enterCave("E", 99); DF.show("pause"); c.cavePause = shown("btnBase") && txt("btnBase") === "Return to base";
  click("btnBase"); c.fromPause = G.zone === "hub" && G.state === "play";
  DF.enterCave("E", 99); G.player.state = "dead"; G.player.hp = 0; G.player.t = 2; DF.show("play"); DF.sim(0.1); DF.show("dead");
  c.deadBtns = shown("btnRise") && txt("btnDeadBase") === "Return to base"; click("btnDeadBase");
  c.fromDead = G.zone === "hub" && G.state === "play" && G.player.state === "free" && G.player.hp === G.player.maxHp;
  DF.enterCave("E", 99); DF.show("win"); c.win = txt("btnAgain") === "Return to base"; click("btnAgain"); c.fromWin = G.zone === "hub" && G.state === "play";
  const q = G.world.portals[0]; G.player.x = q.x; G.player.z = q.z - 8; G.player.yaw = 0; cam.yaw = 0; cam.pitch = 0.1; cam.px = q.x; cam.pz = q.z - 8;
  return { pass: Object.values(c).every(Boolean), c };`),
  { wait: 500 },
  step("hall HUD", `${shown}
  const L = [...document.querySelectorAll("#plabels > *")].filter((e) => getComputedStyle(e).display !== "none");
  const open = L.find((e) => e.textContent.trim() === "E-rank gate"), sealed = L.find((e) => e.textContent.trim() === "D-rank gate · Sealed");
  const c = { open: !!open && !open.classList.contains("sealed"), sealed: !!sealed && sealed.classList.contains("sealed"),
    far: !L.some((e) => /^S-rank/.test(e.textContent.trim())), map: !shown("map"), fade: getComputedStyle(document.getElementById("fade")).opacity === "0" };
  // the fade must cover the HUD too: probe which element is on top of the health bar
  const fd = document.getElementById("fade"), r = document.getElementById("hpF").getBoundingClientRect();
  const hud = document.getElementById("hud"); hud.style.pointerEvents = fd.style.pointerEvents = "auto";
  c.fadeOnTop = document.elementFromPoint(r.left + 2, r.top + 2) === fd; hud.style.pointerEvents = fd.style.pointerEvents = "";
  DF.enterCave("E", 99); return { pass: Object.values(c).every(Boolean), c };`),
  { wait: 500 },
  step("cave HUD", `${shown}
  const L = [...document.querySelectorAll("#plabels > *")].filter((e) => getComputedStyle(e).display !== "none");
  DF.enterHub(); return { pass: L.length === 0 && shown("map") };`),
  step("portal fires inside the arch", `
  DF.enterHub(); const p = G.player, q = G.world.portals[0];
  p.x = q.x; p.z = q.z - 3; p.yaw = 0; cam.yaw = 0; DF.keys[DF.BIND.fwd] = true;
  let at = null; DF.sim(4, () => { if (G.trans && at === null) at = G.player.z; return G.zone === "hub" || !!G.trans; });
  DF.keys[DF.BIND.fwd] = false;
  // the frame's front face is at z = 16.5; the fade must not start out on the floor ring
  return { pass: G.zone === "cave" && at !== null && at >= 15.7, at };`),
  step("frames are solid", `
  DF.enterHub(); const p = G.player; cam.yaw = 0; DF.keys[DF.BIND.fwd] = true; const zs = [];
  for (const q of G.world.portals.slice(1)) { p.x = q.x; p.z = q.z - 3; DF.sim(3); zs.push(+p.z.toFixed(2)); }
  DF.keys[DF.BIND.fwd] = false;
  // player radius is 0.45, so the body must stop at the frame's front face
  return { pass: G.zone === "hub" && zs.every((z) => z <= 16.07), zs };`),
];
