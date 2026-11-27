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
// toGate walks the player forward into the open gate q from 3 m in front,
// until the gate asks (G.ask), a trip begins or sec runs out
const toGate = `const toGate = (q, sec = 4) => { const p = G.player; p.x = q.x; p.z = q.z - 3; p.yaw = 0; cam.yaw = 0; DF.keys[DF.BIND.fwd] = true;
  DF.sim(sec, () => !G.ask && G.zone === "hub" && !G.trans); DF.keys[DF.BIND.fwd] = false; };`;
export default [
  step("hub world", `
  const w = DF.genHub(), P = w.portals, f = (o) => w.fieldAt(o.x, o.z);
  const front = P.map((q) => DF.portalFront(q, 3.5));
  const pillars = [-12, 12].flatMap((x) => [-9, -1, 7].map((z) => ({ x, z })));
  const c = {
    arrays: ["nodes","edges","path","shrines","halos","lights","spawns","portals","plaques"].every((k) => Array.isArray(w[k])),
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
  DF.sim(4, () => { if (G.ask) DF.gateAnswer(true); if (G.trans) { peak = Math.max(peak, G.fade); if (hurt === null) hurt = DF.hurtPlayer(50, null, { px: p.x, pz: p.z - 1 }); } return G.zone === "hub" || !!G.trans; });
  DF.keys[DF.BIND.fwd] = false; const P = G.player;
  const c = { zone: G.zone === "cave", grade: G.grade === "E", done: !G.trans && G.fade === 0, peak: peak > 0.95, hurt: hurt === "none",
    cave: G.world.shrines.length > 0 && G.enemies.some((e) => e.type === "warden"), fresh: P.state === "free" && P.hp === P.maxHp,
    msg: G.msgs.some((m) => m.text === "E-RANK GATE") };
  return { pass: Object.values(c).every(Boolean), c };`),
  step("sealed frames do nothing", `
  DF.resetCleared(); DF.enterHub(); const p = G.player; let ok = G.world.portals.map((q) => +q.open).join("") === "100000"; cam.yaw = 0; DF.keys[DF.BIND.fwd] = true;
  for (const q of G.world.portals.slice(1)) { p.x = q.x; p.z = q.z - 3; DF.sim(3); ok = ok && G.zone === "hub" && !G.trans; }
  DF.keys[DF.BIND.fwd] = false; return { pass: ok };`),
  step("D opens once E is cleared", `
  DF.resetCleared(); DF.enterHub(); const before = G.world.portals.map((q) => +q.open).join("");
  DF.clearGrade("E", "fighter"); DF.enterHub(); const after = G.world.portals.map((q) => +q.open).join("");
  let p = G.player; const q = G.world.portals[1]; cam.yaw = 0; p.x = q.x; p.z = q.z - 3; p.yaw = 0; DF.keys[DF.BIND.fwd] = true;
  DF.sim(4, () => (G.ask && DF.gateAnswer(true), G.zone === "hub" || !!G.trans)); DF.keys[DF.BIND.fwd] = false;
  const c = { before: before === "100000", after: after === "110000", d: q.grade === "D" && q.open, zone: G.zone === "cave", grade: G.grade === "D",
    sewer: !!G.world.sewer && G.enemies.some((e) => e.type === "croc"), done: !G.trans };
  // the rest stay sealed with E cleared
  DF.enterHub(); p = G.player; cam.yaw = 0; DF.keys[DF.BIND.fwd] = true; c.sealed = true;
  for (const r of G.world.portals.slice(2)) { p.x = r.x; p.z = r.z - 3; DF.sim(3); c.sealed = c.sealed && !r.open && G.zone === "hub" && !G.trans; }
  DF.keys[DF.BIND.fwd] = false; DF.resetCleared(); DF.enterHub();
  return { pass: Object.values(c).every(Boolean), c, before, after };`),
  step("return to base", `
  DF.enterCave("E", 99); DF.enterHub(G.grade); const p = G.player, q = G.world.portals[0];
  const at = Math.hypot(p.x - q.x, p.z - (q.z - 3.5)) < 0.01 && Math.cos(p.yaw) < -0.5;
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
  p.x = q.x; p.z = q.z; DF.sim(2, () => (G.ask && DF.gateAnswer(true), G.zone === "hub" || !!G.trans));
  return { pass: G.zone === "cave" && G.projs.length === 0 && G.pending.length === 0 && G.rings.length === 0 };`),
  step("entering mid-dodge arrives free", `
  DF.enterHub(); const p = G.player, q = G.world.portals[0]; p.x = q.x; p.z = q.z - 2.5; p.yaw = 0; cam.yaw = 0;
  DF.keys[DF.BIND.fwd] = true; K("dodge"); DF.sim(3, () => (G.ask && DF.gateAnswer(true), G.zone === "hub" || !!G.trans)); DF.keys[DF.BIND.fwd] = false;
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
    K("lock"); DF.sim(0.1); const locked = p.lock === d;
    // hits are counted by the dummy's flash rising; settle lets stragglers land uncounted
    const count = (sec, each) => { let n = 0, f0 = d.flash; DF.sim(sec, (i) => { if (each) each(i); if (d.flash > f0) n++; f0 = d.flash; }); return n; };
    const ready = (dist) => { DF.sim(0.6); p.hp = p.maxHp; p.stam = p.maxStam; p.state = "free"; p.buf = null; p.x = d.x; p.z = d.z - dist; p.yaw = 0; cam.yaw = 0; cam.px = p.x; cam.pz = p.z; };
    const n = { light: 0, heavy: 0, tool: 0, special: 0 }; let buffed = false;
    for (let r = 0; r < 3; r++) {
      ready(${reach(id)}); n.light += count(1.5, (i) => { if (i % 12 === 0) K("light"); });
      ready(${reach(id)}); K("heavy"); n.heavy += count(1.5);
      ready(${id === "mage" ? 4 : reach(id)}); p.tool = p.cls.tool.max; K("tool"); n.tool += count(1.5);
      ready(${reach(id)}); p.focus = 100; K("special"); n.special += count(2.2, () => { buffed = buffed || !!p.buff; });
    }
    const selfBuff = ${id === "fighter" || id === "tanker"};
    const c = { locked, light: n.light >= 3, heavy: n.heavy >= 1, tool: n.tool >= 1, special: selfBuff ? buffed : n.special >= 1,
      alive: !d.dead && d.state !== "dead" && G.enemies.includes(d), hp: d.hp === d.def.hp,
      home: d.x === d.hx && d.z === d.hz && d.yaw === d.hyaw, nan: p.x === p.x, kills: G.kills === 0 };
    return { pass: Object.values(c).every(Boolean), c, n };`),
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
  const c = { play: txt("btnSolo") === "Play solo" };
  // the round trips above cleared E; with nothing cleared D's label reads Sealed in the next step
  DF.resetCleared(); DF.enterHub(); DF.show("pause"); c.hubPause = !shown("btnBase");
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
  let at = null; DF.sim(4, () => { if (G.ask) DF.gateAnswer(true); if (G.trans && at === null) at = G.player.z; return G.zone === "hub" || !!G.trans; });
  DF.keys[DF.BIND.fwd] = false;
  // the frame's front face is at z = 16.5; the fade must not start out on the floor ring
  return { pass: G.zone === "cave" && at !== null && at >= 15.7, at };`),
  step("a gate asks first", `${toGate}
  DF.enterHub(); const q = G.world.portals[0], p = G.player, o = DF.portalFront(q, -0.75); toGate(q);
  const a = G.ask, c = { ask: !!a && a.grade === "E", state: G.state === "enter", inside: Math.hypot(o.x - p.x, o.z - p.z) < 1, hub: G.zone === "hub", still: !G.trans };
  // it asks once and nothing travels while it waits
  DF.keys[DF.BIND.fwd] = true; DF.sim(1); DF.keys[DF.BIND.fwd] = false;
  c.waits = G.ask === a && G.state === "enter" && G.zone === "hub" && !G.trans;
  DF.gateAnswer(false); DF.sim(1);
  return { pass: Object.values(c).every(Boolean), c };`),
  step("Enter goes in", `${toGate}
  DF.enterHub(); toGate(G.world.portals[0]); const asked = !!G.ask; DF.gateAnswer(true);
  const c = { asked, closed: G.ask === null && G.state === "play", fades: !!G.trans && G.zone === "hub" };
  DF.sim(4, () => (G.ask && DF.gateAnswer(true), G.zone === "hub" || !!G.trans));
  c.cave = G.zone === "cave" && G.grade === "E" && !G.trans && G.ask === null;
  // an answer with nothing asked does nothing
  DF.enterHub(); DF.gateAnswer(true); DF.gateAnswer(false); c.idle = G.zone === "hub" && !G.trans && G.player.state === "free";
  return { pass: Object.values(c).every(Boolean), c };`),
  step("Stay out throws the player out of the arch", `${toGate}
  const was = DF.OPT.cls, bad = [];
  for (const id of Object.keys(DF.CLASSES)) {
    DF.setClass(id); DF.enterHub(); const q = G.world.portals[0], p = G.player, o = DF.portalFront(q, -0.75);
    toGate(q); p.stam = 40; const yaw = p.yaw, cy = cam.yaw, x0 = p.x;
    DF.gateAnswer(false);
    const c = { cls: p.clsId === id, closed: G.ask === null && G.state === "play", dodge: p.state === "dodge",
      out: Math.abs(p.ddx - Math.sin(q.yaw)) < 1e-9 && Math.abs(p.ddz - Math.cos(q.yaw)) < 1e-9, free: p.stam === 40 };
    DF.sim(1);
    // out past the circle (1 m) with room to spare, straight along the way the gate faces, the view as it was
    c.clear = Math.hypot(o.x - p.x, o.z - p.z) > 2 && Math.abs(p.x - x0) < 0.3 && p.z < q.z - 1;
    c.view = cam.yaw === cy && p.yaw === yaw; c.stays = G.zone === "hub" && !G.trans && G.ask === null && p.state === "free";
    if (!Object.values(c).every(Boolean)) bad.push([id, c, +p.x.toFixed(2), +p.z.toFixed(2)]);
  }
  DF.setClass(was); DF.enterHub();
  return { pass: bad.length === 0, bad };`),
  step("walked in sideways, thrown straight out", `
  DF.enterHub(); const q = G.world.portals[0], p = G.player, o = DF.portalFront(q, -0.75);
  p.x = o.x; p.z = o.z - 0.5; p.yaw = cam.yaw = Math.PI / 2; DF.sim(0.1); const asked = !!G.ask && G.state === "enter";
  DF.gateAnswer(false); DF.sim(1);
  const c = { asked, clear: Math.hypot(o.x - p.x, o.z - p.z) > 2 && Math.abs(p.x - o.x) < 0.3 && p.z < q.z - 1, view: cam.yaw === Math.PI / 2 && p.yaw === Math.PI / 2 };
  return { pass: Object.values(c).every(Boolean), c, at: [p.x, p.z] };`),
  step("no second question until the player has left", `${toGate}
  DF.enterHub(); const q = G.world.portals[0], p = G.player, o = DF.portalFront(q, -0.75); toGate(q);
  DF.gateAnswer(false); const c = { off: G.askOff === true };
  // kept in the circle after the answer: not asked again
  p.x = o.x; p.z = o.z - 0.5; p.state = "free"; DF.sim(0.5);
  c.held = Math.hypot(o.x - p.x, o.z - p.z) < 1 && G.ask === null && G.askOff === true && G.zone === "hub" && !G.trans;
  // once outside the circle it is ready again
  p.x = q.x; p.z = q.z - 3; DF.sim(0.1); c.ready = G.askOff === false && G.ask === null;
  toGate(q); c.again = !!G.ask && G.state === "enter";
  DF.gateAnswer(false); DF.sim(1);
  return { pass: Object.values(c).every(Boolean), c };`),
  step("a world swap under the question closes it", `${toGate}
  DF.enterHub(); toGate(G.world.portals[0]); const asked = !!G.ask && G.state === "enter"; DF.enterHub();
  const a = G.ask === null && G.askOff === false && G.state === "play";
  toGate(G.world.portals[0]); DF.gateAnswer(false); const off = G.askOff === true; DF.enterHub();
  return { pass: asked && a && off && G.askOff === false, asked, a, off };`),
  step("frames are solid", `
  DF.enterHub(); const p = G.player; cam.yaw = 0; DF.keys[DF.BIND.fwd] = true; const zs = [];
  // an open D (E was cleared above) would take the player through; the sealed ones are walked into
  const shut = G.world.portals.filter((q) => !q.open);
  for (const q of shut) { p.x = q.x; p.z = q.z - 3; DF.sim(3); zs.push(+p.z.toFixed(2)); }
  DF.keys[DF.BIND.fwd] = false;
  // player radius is 0.45, so the body must stop at the frame's front face
  return { pass: G.zone === "hub" && shut.length >= 4 && zs.every((z) => z <= 16.07), zs };`),
  step("respawn in the hall is safe", `
  DF.enterHub(); let threw = false; try { DF.respawn(); } catch (e) { threw = true; }
  const p = G.player; return { pass: !threw && G.zone === "hub" && p.state === "free" && p.hp === p.maxHp && G.enemies.length === 1 };`),
  step("return view is clear", `
  const blocked = [];
  for (const g of Object.keys(DF.GRADES)) { DF.enterHub(g); const p = G.player;
    // nothing solid within 10 m straight ahead, and the view is into the hall
    if (!G.world.los(p.x, p.z, p.x + Math.sin(p.yaw) * 10, p.z + Math.cos(p.yaw) * 10) || Math.cos(p.yaw) > -0.5 || Math.abs(cam.yaw - p.yaw) > 1e-9) blocked.push(g); }
  return { pass: blocked.length === 0, blocked };`),
  step("round trips through the portal and the menu", `
  let ok = true; DF.enterHub();
  for (let i = 0; i < 3; i++) { const p = G.player, q = G.world.portals[0]; p.x = q.x; p.z = q.z - 2; p.yaw = 0; cam.yaw = 0;
    DF.keys[DF.BIND.fwd] = true; DF.sim(4, () => (G.ask && DF.gateAnswer(true), G.zone === "hub" || !!G.trans)); DF.keys[DF.BIND.fwd] = false;
    const b = G.enemies.find((e) => e.type === "warden"); ok = ok && G.zone === "cave" && !!b && !b.dead && !G.gate;
    DF.hitEnemy(b, 1e6, 0, {}); ok = ok && G.bossDead; DF.toBase();
    ok = ok && G.zone === "hub" && G.state === "play" && !G.gate && !G.bossDead && G.enemies.length === 1 && G.player.hp === G.player.maxHp; }
  return { pass: ok };`),
  step("entering mid-attack arrives free", `
  DF.setClass("fighter"); DF.enterHub(); const p = G.player, q = G.world.portals[0]; p.x = q.x; p.z = q.z - 1.6; p.yaw = 0; cam.yaw = 0;
  DF.keys[DF.BIND.fwd] = true; K("light"); let mid = false;
  DF.sim(4, () => { if (G.ask) DF.gateAnswer(true); if (G.zone === "hub" && G.trans && p.state === "attack") mid = true; return G.zone === "hub" || !!G.trans; }); DF.keys[DF.BIND.fwd] = false;
  const P = G.player; return { pass: G.zone === "cave" && P.state === "free" && P.buf === null, mid };`),
  step("a moved portal takes its frame with it", `
  // one open gate on the east wall, facing west into the hall
  const w = DF.genHub([{ x: 14, z: 0, yaw: -Math.PI / 2, grade: "E", open: true }]), v = w.pos;
  let frame = false, north = false;
  for (let i = 0; i < v.length; i += 3) {
    if (Math.abs(v[i] - 14.5) < 0.01 && Math.abs(v[i + 2]) < 2 && v[i + 1] > 3) frame = true;
    if (Math.abs(v[i + 2] - 16.5) < 0.01 && v[i + 1] > 3 && v[i + 1] < 4.1) north = true;
  }
  const f = DF.portalFront(w.portals[0], 3.5);
  return { pass: frame && !north && w.fieldAt(14.45, 0) < 0.1 && w.fieldAt(0, 16.4) > 0.5 && Math.abs(f.x - 10.5) < 0.01 && w.lights.length === 6, frame, north };`),
  step("zone air is not shared", `
  DF.enterHub(); const a = DF.R.env.amb[0]; DF.R.env.amb[0] = 9; DF.enterHub(); const hub = DF.R.env.amb[0];
  DF.enterCave("E", 99); const c = DF.R.env.fogD; DF.R.env.fog[0] = 9; DF.enterCave("E", 99); const cave = DF.R.env.fog[0]; DF.enterHub();
  return { pass: hub === a && cave !== 9 && c === 0.03, hub, cave };`),
  step("pause hides the fade", `
  DF.enterHub(); G.trans = { t: 0.2, grade: "E", swapped: false }; G.fade = 0.5; DF.show("pause"); return { pass: true };`),
  { wait: 400 },
  step("pause hides the fade, checked", `
  const fd = document.getElementById("fade"), hud = document.getElementById("hud"), hp = document.getElementById("hpF"), r = hp.getBoundingClientRect();
  const hidden = getComputedStyle(fd).opacity === "0";
  // the pause menu covers the health fill, as it covers the rest of the HUD
  // (t10 "menus cover the health bar")
  hud.style.pointerEvents = "auto"; const top = document.elementFromPoint(r.left + 2, r.top + 2); hud.style.pointerEvents = "";
  const covered = !!top && document.getElementById("scr-pause").contains(top);
  G.trans = null; G.fade = 0; DF.show("title"); window.__t0 = G.t;
  return { pass: hidden && covered, hidden, top: top && top.id };`),
  { wait: 500 },
  step("the title backdrop animates", `
  const moved = G.t - window.__t0; DF.enterHub(); DF.show("play"); return { pass: moved > 0.2, moved };`),
];
