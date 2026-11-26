// The dev menu: the host gate, opening and closing it, and each action.
// Run with: node build.mjs && SCRIPT=$PWD/tests/t26.mjs node test.mjs hub
// (node tests/t26-build.mjs checks that a release build leaves it out.)
const draw = `const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));`;
const step = (name, body) => ({
  name,
  eval: `(async () => { const { G } = DF; G.manual = true; ${draw}
  const $ = (s) => document.querySelector(s);
  const key = (code) => window.dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
  ${body} })()`,
});
export default [
  step("devHost allows only local pages", `
  const h = (protocol, hostname) => DF.devHost({ protocol, hostname });
  const yes = [h("file:", ""), h("http:", "localhost"), h("http:", "127.0.0.1"), h("http:", "[::1]")];
  const no = [h("https:", "maxjlerman.github.io"), h("http:", "192.168.1.5")];
  const dev = !!DF.DEV && DF.DEV.god === false;
  return { pass: yes.every(Boolean) && !no.some(Boolean) && dev, yes, no, dev };`),
  step("the Dev button opens it from the title and Back returns", `
  DF.show("title"); await draw();
  $("#btnDev").click(); await draw();
  const opened = G.state, shown = $("#scr-dev").classList.contains("show");
  $("#scr-dev [data-back]").click(); await draw();
  return { pass: opened === "dev" && shown && G.state === "title", opened, shown, back: G.state };`),
  step("from pause it returns to pause", `
  DF.show("pause"); await draw();
  $("#btnDevPause").click(); await draw();
  const opened = G.state;
  key("Escape"); await draw();
  return { pass: opened === "dev" && G.state === "pause", opened, back: G.state };`),
  step("backquote opens it from play by way of pause", `
  DF.show("play"); G.state = "play";
  key("Backquote"); await draw();
  const opened = G.state;
  $("#scr-dev [data-back]").click(); await draw();
  const back = G.state;
  key("Backquote"); const again = G.state; key("Backquote");
  return { pass: opened === "dev" && back === "pause" && again === "dev" && G.state === "pause", opened, back, again, last: G.state };`),
  step("backquote yields to a binding", `
  const was = DF.BIND.light; DF.BIND.light = "Backquote";
  try {
    DF.show("play"); G.state = "play"; DF.taps.Backquote = false;
    key("Backquote");
    return { pass: G.state === "play" && DF.taps.Backquote === true, state: G.state, tap: DF.taps.Backquote };
  } finally { DF.BIND.light = was; DF.taps.Backquote = false; }`),
  step("backquote is ignored outside title, pause, play and dev", `
  DF.show("title"); DF.openMenu("controls"); await draw();
  key("Backquote"); await draw();
  const s = G.state; DF.show("title");
  return { pass: s === "controls", state: s };`),
  step("unlock adds every hidden class to the picker", `
  const hid = ["enforcer", "sapper", "riftwalker"];
  const before = hid.filter((id) => DF.pickable().includes(id));
  DF.show("title"); DF.openMenu("dev"); await draw();
  $("#devUnlock").click(); await draw();
  const after = hid.filter((id) => DF.pickable().includes(id));
  const card = !!$('.picker .card[data-cls="sapper"]'), off = $("#devUnlock").disabled;
  return { pass: before.length === 0 && after.length === 3 && card && off, before, after, card, off };`),
  step("unlocks never reach the save", `
  DF.saveOpt();
  const u = JSON.parse(localStorage.getItem("dungeon-raze.v2")).u;
  const inSet = ["enforcer", "sapper", "riftwalker"].filter((id) => DF.UNLOCKED.has(id));
  return { pass: u.length === 0 && inSet.length === 0, u, inSet };`),
  step("a dev class does not survive a reload", `
  DF.setClass("enforcer"); DF.saveOpt();
  const kept = new Set(DF.DEV.unlocked); DF.DEV.unlocked.clear();
  DF.loadOpt();
  const cls = DF.OPT.cls, first = DF.pickable()[0];
  for (const id of kept) DF.DEV.unlocked.add(id);
  DF.setClass("fighter"); DF.saveOpt();
  return { pass: cls === first && cls !== "enforcer", cls, first };`),
  step("every gate opens from the menu", `
  const cleared = JSON.stringify(DF.CLEARED), out = [];
  for (const g of ["E", "D", "C", "B", "A", "S"]) {
    DF.show("title"); DF.openMenu("dev"); await draw();
    $('[data-dev-gate="' + g + '"]').click();
    out.push({ g, ok: G.zone === "cave" && G.grade === g && G.state === "play" && !!G.world.sewer === (g === "D") });
  }
  const same = JSON.stringify(DF.CLEARED) === cleared;
  return { pass: out.every((o) => o.ok) && same, out, same };`),
  step("the big cave button walks the 36-room cave alone", `
  const cleared = JSON.stringify(DF.CLEARED), out = {};
  DF.devBigCave(99);
  out.fn = [G.zone, G.grade, !!G.world.big, G.world.nodes.length, DF.net(), G.state, DF.DEV.run === G.world];
  DF.show("title"); DF.openMenu("dev"); await draw();
  const btn = $('#scr-dev [data-dev-big]');
  btn.click();
  out.btn = [btn && btn.textContent, G.zone, G.grade, !!G.world.big, G.world.nodes.length, DF.net(), G.state, DF.DEV.run === G.world];
  const same = JSON.stringify(DF.CLEARED) === cleared;
  const ok = (a) => a[a.length - 7] === "cave" && a[a.length - 6] === "E" && a[a.length - 5] === true && a[a.length - 4] === 36 && a[a.length - 3] === null && a[a.length - 2] === "play" && a[a.length - 1] === true;
  return { pass: ok(out.fn) && ok(out.btn) && out.btn[0] === "Big cave (co-op size)" && same, out, same };`),
  step("a random big cave without a seed, and the small cave after a return to base", `
  DF.devBigCave(); const a = G.seed, bigA = G.world.big; DF.devBigCave(); const b = G.seed;
  DF.enterHub(G.grade); G.state = "play";
  const p = G.player, q = G.world.portals[0];
  p.x = q.x; p.z = q.z - 3; p.yaw = 0; DF.cam.yaw = 0; DF.keys[DF.BIND.fwd] = true;
  DF.sim(4, () => G.zone === "hub" || !!G.trans); DF.keys[DF.BIND.fwd] = false;
  const small = G.zone === "cave" && G.grade === "E" && !G.trans && !G.world.big && G.world.nodes.length < 36;
  return { pass: bigA === true && a !== b && small, a, b, bigA, zone: G.zone, big: G.world.big, n: G.world.nodes.length };`),
  step("boss jump lands at the last rest point", `
  const bad = []; let single = 0;
  for (const [g, type] of [["E", "warden"], ["D", "croc"]])
    for (let seed = 1; seed <= 12; seed++) {
      DF.devBoss(g, seed);
      const w = G.world, p = G.player, sh = w.shrines.at(-1), cp = G.checkpoint;
      if (w.shrines.length === 1) single++;
      const near = Math.hypot(p.x - sh.x, p.z - sh.z) < 3;
      const closer = w.shrines.length === 1 ||
        Math.hypot(p.x - w.boss.x, p.z - w.boss.z) < Math.hypot(w.spawn.x - w.boss.x, w.spawn.z - w.boss.z);
      const boss = G.enemies.some((e) => e.def.boss && e.type === type);
      if (!(cp === sh && sh.lit && near && closer && boss && G.state === "play" && G.grade === g))
        bad.push({ g, seed, cp: cp === sh, lit: sh.lit, near, closer, boss });
    }
  return { pass: bad.length === 0, bad, single };`),
  step("a death after a boss jump wakes at that rest point", `
  DF.devBoss("D", 5);
  const sh = G.checkpoint; G.player.hp = 0; DF.respawn();
  const p = G.player, d = Math.hypot(p.x - sh.x, p.z - sh.z);
  return { pass: G.checkpoint === sh && d < 3, d };`),
  step("god takes no damage and refuses grabs", `
  DF.devGate("E"); G.state = "play";
  const p = G.player, rat = DF.makeEnemy({ type: "rat", x: p.x + 1, z: p.z, yaw: 0, node: -1 });
  const hit = () => { p.hp = p.maxHp; p.iframe = 0; p.state = "free"; G.grabGrace = 0;
    return [DF.hurtPlayer(50, null, { px: p.x + 1, pz: p.z }), p.hp, DF.hurtPlayer(5, null, { px: p.x + 1, pz: p.z, dot: true }), p.hp,
      DF.grabPlayer(rat, { dps: 8, tx: p.x, tz: p.z, speed: 4 })]; };
  const off = hit(); p.state = "free"; p.hold = null;
  DF.devGod(true); const on = hit();
  const pass = off[0] === "hit" && off[1] < p.maxHp && off[4] === true &&
    on[0] === "none" && on[1] === p.maxHp && on[2] === "none" && on[3] === p.maxHp && on[4] === false;
  return { pass, off, on };`),
  step("god keeps everything full", `
  const p = G.player; p.stam = 0; p.flasks = 0; p.tool = 0; p.focus = 0; p.hp = 1;
  DF.sim(1 / 60);
  const out = { hp: p.hp, stam: p.stam, flasks: p.flasks, tool: p.tool, focus: p.focus };
  return { pass: p.hp === p.maxHp && p.stam === p.maxStam && p.flasks === 3 && p.tool === p.cls.tool.max && p.focus === 100, ...out };`),
  step("god holds through world swaps", `
  DF.enterCave("D"); DF.enterHub(); DF.enterCave("E"); G.player.hp = 0; DF.respawn(); await draw();
  const badge = $("#devBadge"), shown = !!badge && !badge.hidden, btn = $("#devGod").textContent;
  return { pass: DF.DEV.god === true && shown && btn === "God mode: on", god: DF.DEV.god, shown, btn };`),
  step("god holds through a crocodile fight", `
  const fight = (god) => {
    DF.devGod(god); DF.devBoss("D", 5); G.state = "play";
    const p = G.player, w = G.world, B = w.boss;
    for (let k = 0; k < 32; k++) { const q = (k / 32) * Math.PI * 2, x = B.x + Math.sin(q) * 16, z = B.z + Math.cos(q) * 16;
      if (w.waterAt(x, z) === 0 && w.fieldAt(x, z) >= 3) { p.x = x; p.z = z; break; } }
    DF.cam.px = p.x; DF.cam.pz = p.z; G.flashRed = 0;
    let hurt = 0, held = 0, low = p.maxHp, chunk = false;
    DF.sim(25, (i) => {
      if (G.inBoss && !chunk) { DF.crocDropChunk(p.x, p.z); chunk = true; }
      if (G.flashRed > 0) hurt++; if (p.state === "held") held++; low = Math.min(low, p.hp);
      if (!god) { p.hp = p.maxHp; if (p.state === "dead") return false; }
    });
    return { hurt, held, low, inBoss: G.inBoss, chunk };
  };
  const off = fight(false), on = fight(true);
  return { pass: off.hurt > 0 && on.hurt === 0 && on.held === 0 && on.low === G.player.maxHp && on.chunk, off, on };`),
  step("god keeps parry, block and the perfect dodge", `
  DF.devGod(true); DF.devGate("E"); G.state = "play";
  const p = G.player, rat = DF.makeEnemy({ type: "rat", x: p.x, z: p.z + 1, yaw: Math.PI, node: -1 });
  G.enemies.push(rat); p.yaw = 0;
  const atk = { pp: 0 };
  p.state = "guard"; p.guardT = 0; p.iframe = 0;
  const parry = DF.hurtPlayer(20, rat, atk), recoil = rat.state;
  p.state = "guard"; p.guardT = 5; p.iframe = 0; const stam = p.stam;
  const block = DF.hurtPlayer(20, rat, atk), hpB = p.hp, stamB = p.stam;
  p.state = "dodge"; p.iframe = 0.3; p.pdUsed = false;
  const dodge = DF.hurtPlayer(20, rat, atk), pd = p.pdUsed;
  p.state = "free"; p.iframe = 0;
  const pass = parry === "parry" && (recoil === "recoil" || recoil === "stagger") && block === "block" && hpB === p.maxHp && stamB === stam &&
    dodge === "none" && pd === true;
  return { pass, parry, recoil, block, hpB, stamB, stam, dodge, pd };`),
  step("a boss killed in a dev run or under god is not saved", `
  DF.resetCleared(); const p0 = localStorage.getItem("dungeon-raze.v2");
  const bossKill = () => { const b = G.enemies.find((e) => e.def.boss); b.hp = 0; DF.kill(b); return DF.gradeCleared("E"); };
  DF.devGod(false); DF.devBoss("E", 3); const dev = bossKill();
  DF.devGod(true); DF.newRun(3, "E"); G.state = "play"; const god = bossKill();
  DF.devGod(false); DF.newRun(3, "E"); G.state = "play"; const plain = bossKill();
  DF.resetCleared();
  return { pass: dev === false && god === false && plain === true, dev, god, plain };`),
  step("god off hurts again", `
  DF.devGod(false); await draw();
  const p = G.player; p.hp = p.maxHp; p.iframe = 0; p.state = "free"; G.state = "play";
  const r = DF.hurtPlayer(10, null, { px: p.x + 1, pz: p.z }), badge = $("#devBadge");
  return { pass: r === "hit" && p.hp < p.maxHp && badge.hidden && $("#devGod").textContent === "God mode: off", r, hp: p.hp };`),
  step("the co-op button starts a run alone and shows the lag dial", `
  DF.enterHub(); DF.show("title"); DF.openMenu("dev"); await draw();
  const btn = $("#devCoop");
  btn.click(); await draw();
  const net = DF.net() !== null, dial = $("#lagDial"), shown = !!dial && !dial.hidden && dial.offsetWidth > 0;
  const r = DF.lagRun().out, cfg = { ping: r.cfg.ping, jit: r.cfg.jit, loss: r.cfg.loss };
  const rc = dial && dial.getBoundingClientRect(), small = !!rc && rc.width < 280 && rc.height < 260;
  const corner = !!rc && (rc.left < 40 || innerWidth - rc.right < 40);
  const mate = !!r.mate && r.mate.mode === "fight";
  return { pass: !!btn && btn.textContent === "Co-op alone, with lag" && net && shown && G.state === "play" && cfg.ping === 100 && cfg.jit === 8 && cfg.loss === 2 && mate && small && corner,
    net, shown, state: G.state, cfg, mate, small, corner };`),
  step("the ping slider changes the solo link", `
  const r = DF.lagRun().out, sl = $('#lagDial [data-lag="ping"]');
  sl.value = "300"; sl.dispatchEvent(new Event("input", { bubbles: true }));
  const j = $('#lagDial [data-lag="jit"]'); j.value = "20"; j.dispatchEvent(new Event("input", { bubbles: true }));
  const l = $('#lagDial [data-lag="loss"]'); l.value = "9"; l.dispatchEvent(new Event("input", { bubbles: true }));
  const label = $('#lagDial [data-lag-v="ping"]').textContent;
  return { pass: r.cfg.ping === 300 && r.cfg.jit === 20 && r.cfg.loss === 9 && label.includes("300"), cfg: { ...r.cfg }, label };`),
  step("a click on the panel starts no attack and leaves the pointer alone", `
  G.state = "play"; DF.taps.Mouse0 = false; DF.keys.Mouse0 = false;
  const sl = $('#lagDial [data-lag="ping"]'), lock = document.pointerLockElement;
  for (const t of ["pointerdown", "mousedown", "mouseup", "click"]) sl.dispatchEvent(new MouseEvent(t, { bubbles: true, button: 0 }));
  sl.focus(); sl.dispatchEvent(new Event("change", { bubbles: true }));
  const focus = document.activeElement === sl;
  return { pass: !DF.taps.Mouse0 && !DF.keys.Mouse0 && document.pointerLockElement === lock && !focus, tap: DF.taps.Mouse0, focus };`),
  step("the second player can be swapped during the run", `
  const lag = DF.lagRun(), r = lag.out, sel = $('#lagDial [data-lag-mate]');
  const set = async (v) => { sel.value = v; sel.dispatchEvent(new Event("change", { bubbles: true })); r.step(1.5); };
  const out = {};
  await set("none"); out.none = [r.mate, r.host.S.px.size, DF.net().mates.length];
  await set("idle"); out.idle = [r.mate && r.mate.mode, r.host.S.px.size, DF.net().mates.length];
  await set("follow"); out.follow = [r.mate && r.mate.mode, r.host.S.px.size, DF.net().mates.length];
  await set("fight"); out.fight = [r.mate && r.mate.mode, r.host.S.px.size, DF.net().mates.length];
  return { pass: out.none[0] === null && out.none[1] === 1 && out.none[2] === 0 &&
    out.idle[0] === "idle" && out.idle[1] === 2 && out.idle[2] === 1 &&
    out.follow[0] === "follow" && out.follow[1] === 2 && out.follow[2] === 1 &&
    out.fight[0] === "fight" && out.fight[1] === 2 && out.fight[2] === 1, out };`),
  step("the readout shows kB/s down and up and enemies per snapshot", `
  const r = DF.lagRun().out; r.cfg.ping = 40; r.cfg.jit = 0; r.cfg.loss = 0;
  // the sim in step with the clock, as the frame loop runs it
  for (let i = 0; i < 12; i++) { r.step(0.1); await new Promise((f) => setTimeout(f, 100)); }
  const txt = $("#lagStat").textContent, m = txt.match(/down ([\\d.]+) kB\\/s.*up ([\\d.]+) kB\\/s[\\s\\S]*?(\\d+) enemies/);
  return { pass: !!m && +m[1] > 0 && +m[3] > 0 && DF.CC.snap.en.length === +m[3], txt, bytes: { ...r.bytes } };`),
  step("[ and ] change the ping by 25 within 0 to 400, in play and unbound only", `
  const r = DF.lagRun().out; G.state = "play"; r.cfg.ping = 100;
  const out = [];
  key("BracketRight"); out.push(r.cfg.ping);
  const slider = $('#lagDial [data-lag="ping"]').value;
  key("BracketLeft"); key("BracketLeft"); out.push(r.cfg.ping);
  r.cfg.ping = 390; key("BracketRight"); out.push(r.cfg.ping);
  r.cfg.ping = 10; key("BracketLeft"); out.push(r.cfg.ping);
  r.cfg.ping = 100; G.state = "pause"; key("BracketRight"); const paused = r.cfg.ping; G.state = "play";
  const was = DF.BIND.light; DF.BIND.light = "BracketRight"; key("BracketRight"); const bound = r.cfg.ping; DF.BIND.light = was;
  return { pass: out.join() === "125,75,400,0" && paused === 100 && bound === 100 && slider === "125", out, paused, bound, slider };`),
  step("a second click ends the old run and starts a fresh one", `
  const a = DF.lagRun().out, link = DF.CC.link, step0 = a.host.S.step;
  DF.show("title"); DF.openMenu("dev"); await draw();
  $("#devCoop").click(); await draw();
  const b = DF.lagRun().out;
  a.step(0.5); const old = a.host.S.step - step0;
  return { pass: b !== a && b.host !== a.host && DF.CC.link === b.link && DF.CC.link !== link && link.closed === true && DF.net() !== null && b.cfg.ping === 100 && old === 0 && !$("#lagDial").hidden, old, closed: link.closed };`),
  step("the dial is not shown for a run the dev menu did not start", `
  DF.coopSolo({ ping: 50 }); await new Promise((f) => setTimeout(f, 700));
  const hidden = $("#lagDial").hidden, on = DF.net() !== null;
  return { pass: hidden && on && DF.lagRun() === null, hidden, on };`),
  step("leaving for the hall hides the panel", `
  DF.show("title"); DF.openMenu("dev"); await draw();
  $("#devCoop").click(); await draw();
  const before = !$("#lagDial").hidden;
  DF.enterHub(); await new Promise((f) => setTimeout(f, 700));
  return { pass: before && $("#lagDial").hidden && DF.net() === null, before, hidden: $("#lagDial").hidden, net: DF.net() };`),
  step("the panel hides when the run ends for another reason", `
  DF.show("title"); DF.openMenu("dev"); await draw();
  $("#devCoop").click(); await draw();
  const before = !$("#lagDial").hidden;
  DF.coopEnd("host"); await new Promise((f) => setTimeout(f, 700));
  return { pass: before && $("#lagDial").hidden && DF.net() === null, before };`),
  step("the Warden for two row has Fight and the three phase buttons", `
  DF.enterHub(); DF.show("title"); DF.openMenu("dev"); await draw();
  const f = $("#scr-dev [data-dev-w2]"), ps = [2, 3, 4].map((n) => $('#scr-dev [data-dev-w2p="' + n + '"]'));
  const labels = [f && f.textContent, ...ps.map((b) => b && b.textContent)];
  const shown = [f, ...ps].every((b) => b && b.offsetWidth > 0);
  return { pass: !!f && ps.every(Boolean) && shown && labels.join("|") === "Fight|Phase 2|Phase 3|Phase 4" && typeof DF.devWardenTwo === "function" && typeof DF.devWardenPhase === "function", labels, shown };`),
  step("Fight starts the Warden for two alone, at the chamber's mouth, saving nothing", `
  const cleared = JSON.stringify(DF.CLEARED), saved0 = localStorage.getItem("dungeon-raze.v2");
  $("#scr-dev [data-dev-w2]").click(); await draw();
  const run = DF.devWardenRun(), B = G.enemies.find((e) => e.def.boss), w = G.world, bc = w.boss;
  const d = Math.hypot(G.player.x - bc.x, G.player.z - bc.z);
  const mate = run && run.mate && Math.hypot(run.mate.p.x - bc.x, run.mate.p.z - bc.z);
  const hb = run && run.host.G.enemies.find((e) => e.def.boss);
  const sh = w.shrines.at(-1);
  const out = { live: !!run && DF.net() !== null, duo: !!B && B.def.duo === true, hostDuo: !!hb && hb.def.duo === true, big: !!w.big, n: w.nodes.length,
    d: +d.toFixed(1), mate: mate && +mate.toFixed(1), mode: run && run.mate.mode, state: G.state, noSave: DF.DEV.noSave(),
    cp: G.checkpoint === sh && sh.lit, same: JSON.stringify(DF.CLEARED) === cleared, phase: B && B.phase, seal: G.seal };
  return { pass: out.live && out.duo && out.hostDuo && out.big && out.n === 36 && d < 25 && mate < 25 && out.mode === "fight" && out.state === "play" && out.noSave && out.cp && out.same && out.phase === 1 && out.seal === null, out };`),
  step("Phase 4 puts the puppet in phase 4 and the seal stands within 3 s", `
  const run = DF.devWardenRun();
  DF.devGod(true);
  try { $("#scr-dev [data-dev-w2p]"); DF.show("dev"); $('#scr-dev [data-dev-w2p="4"]').click(); run.step(3, () => (G.seal && G.enemies.find((e) => e.def.boss).phase === 4 ? false : undefined)); } finally { DF.devGod(false); }
  const B = G.enemies.find((e) => e.def.boss), hb = run.host.G.enemies.find((e) => e.def.boss);
  return { pass: B.phase === 4 && hb.phase === 4 && !!G.seal && !!run.host.G.seal, puppet: B.phase, host: hb.phase, seal: !!G.seal, hostSeal: !!run.host.G.seal };`),
  { shot: "t26-warden2" },
  step("a phase cannot be asked for twice, and no run means nothing", `
  const again = DF.devWardenPhase(4), ph = DF.devWardenPhase(2);
  DF.enterHub(); await draw();
  const none = DF.devWardenPhase(3), run = DF.devWardenRun();
  return { pass: again === null && ph === null && none === null && run === null && DF.net() === null && G.seal === null, again, ph, none, run, net: DF.net(), seal: G.seal };`),
  step("Phase 2 and 3 buttons start from phase 1", `
  const seen = [];
  for (const n of [2, 3]) {
    DF.devWardenTwo(99); DF.devGod(true);
    try { const run = DF.devWardenRun(); DF.show("dev"); $('#scr-dev [data-dev-w2p="' + n + '"]').click(); run.step(0.5); seen.push(G.enemies.find((e) => e.def.boss).phase); } finally { DF.devGod(false); }
  }
  DF.enterHub();
  return { pass: seen.join() === "2,3", seen };`),
  step("Fight refuses to tear down a room with a real friend", `
  DF.devWardenTwo(99);
  const run = DF.devWardenRun(), link = DF.CC.link, net = DF.net();
  link.solo = false;
  DF.show("dev"); await draw();
  $("#scr-dev [data-dev-w2]").click(); await draw();
  const msg = $("#devW2Msg").textContent, same = DF.CC.link === link && DF.net() === net && !link.closed;
  const r = DF.devWardenTwo(5);
  link.solo = true;
  $("#scr-dev [data-dev-w2]").click(); await draw();
  return { pass: same && r === null && msg.length > 0 && msg.length < 90 && DF.devWardenRun() !== run && $("#devW2Msg").textContent === "", msg, same, r };`),
  step("leaving the fight leaves no room, host or seal", `
  const run = DF.devWardenRun(), link = DF.CC.link;
  DF.devGod(true);
  try { DF.devWardenPhase(4); run.step(3, () => (G.seal ? false : undefined)); } finally { DF.devGod(false); }
  const sealed = !!G.seal;
  G.state = "pause"; DF.show("pause"); await draw();
  $("#btnExit").click(); await draw();
  return { pass: sealed && DF.net() === null && DF.CC.link === null && link.closed === true && G.seal === null && G.zone === "hub" && DF.devWardenRun() === null,
    sealed, net: DF.net(), seal: G.seal, closed: link.closed, zone: G.zone };`),
  step("a wipe in the sealed fight takes the seal down", `
  DF.devWardenTwo(99);
  const run = DF.devWardenRun();
  DF.devGod(true);
  try { DF.devWardenPhase(4); run.step(3, () => (G.seal ? false : undefined)); } finally { DF.devGod(false); }
  const sealed = !!G.seal && !!run.host.G.seal;
  run.mate.kill(); G.player.hp = 0; G.player.state = "dead";
  run.step(6, () => (G.seal === null && run.host.G.seal === null ? false : undefined));
  const out = { sealed, seal: G.seal === null, hostSeal: run.host.G.seal === null, net: DF.net() !== null };
  DF.enterHub();
  return { pass: sealed && out.seal && out.hostSeal && DF.net() === null, out };`),
  step("the dev screen over the title", `
  DF.enterHub(); DF.show("title"); DF.openMenu("dev"); await draw(); await draw();
  return { pass: G.state === "dev" };`),
  { shot: "t26-dev" },
];
