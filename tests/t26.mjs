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
];
