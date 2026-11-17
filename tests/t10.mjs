// Enemy name tags, threat colours, the look zone and the How to play screen.
// Run with: SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.
//
// The frame loop keeps drawing and updating the HUD while G.manual is set, so
// a step changes state, awaits draw() and then reads the DOM.
const WHITE = "rgb(255, 255, 255)",
  ORANGE = "rgb(232, 100, 0)",
  RED = "rgb(196, 0, 22)",
  BLACK = "rgb(0, 0, 0)";
const step = (name, body) => ({
  name,
  eval: `(async () => { const { G, cam } = DF; G.manual = true;
  const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const slots = () => [...document.querySelectorAll("#ebars .eb")].filter((d) => d.style.display !== "none").map((d) => { const t = d.querySelector(".tag"), cs = getComputedStyle(t); return { name: t.textContent, tier: [0, 1, 2].find((i) => t.classList.contains("t" + i)), nobar: d.classList.contains("nobar"), hp: d.querySelector("i").style.width, color: cs.color, bg: cs.backgroundColor }; });
  // One enemy of a type, unaware and unhurt, dist metres in front of the
  // player in the first room. Every other enemy is parked out of range.
  // off turns the camera away by that many radians. Without a pitch the
  // camera centre is put on the enemy's body.
  const stage = (type, dist = 6, off = 0, pitch) => { DF.newRun(99); DF.show("play"); const p = G.player, n = G.world.nodes.find((q) => q.kind === "room"), e = G.enemies.find((q) => q.type === type); for (const o of G.enemies) if (o !== e) o.x += 1000; e.x = n.x; e.z = n.z + dist / 2; e.aware = false; e.state = "idle"; e.hp = e.def.hp; p.x = n.x; p.z = n.z - dist / 2; p.yaw = 0; p.lock = null; cam.yaw = off; cam.pitch = pitch === undefined ? Math.atan2(1.62 - e.def.top * 0.55, dist) : pitch; cam.px = p.x; cam.pz = p.z; cam.cd = 5.6; return e; };
  ${body} })()`,
});
// an aware enemy of a type, off to the side of the view
const aware = (type, dist = 6, off = 0.5) =>
  `const e = stage("${type}", ${dist}, ${off}); e.aware = true; await draw();`;
export default [
  step("threat tiers", `
  const T = DF.EDEF;
  const c = {
    husk: T.husk.threat === 0, spit: T.spit.threat === 0, dummy: T.dummy.threat === 0,
    brute: T.brute.threat === 1, warden: T.warden.threat === 2,
    all: Object.values(T).every((d) => [0, 1, 2].includes(d.threat)),
    fn: typeof DF.threatOf === "function" && DF.threatOf({ def: T.brute }) === 1,
  };
  return { pass: Object.values(c).every(Boolean), c };`),
  step("an aware husk has a white tag", `
  ${aware("husk")} const s = slots();
  return { pass: s.length === 1 && s[0].name === "Husk" && s[0].tier === 0 && s[0].nobar === false && s[0].color === "${WHITE}" && s[0].bg === "${BLACK}", s };`),
  step("an aware brute has an orange tag", `
  ${aware("brute")} const s = slots();
  return { pass: s.length === 1 && s[0].name === "Brute" && s[0].tier === 1 && s[0].color === "${ORANGE}" && s[0].bg === "${BLACK}", s };`),
  step("a hurt spitter has a white tag", `
  const e = stage("spit", 6, 0.5); e.hp -= 1; await draw(); const s = slots();
  return { pass: s.length === 1 && s[0].name === "Spitter" && s[0].tier === 0, s };`),
  step("the boss has a red tag and no small bars", `
  ${aware("warden", 10, 0.3)} const s = slots(), big = document.getElementById("boss"), nm = document.getElementById("bossNm");
  const c = {
    slot: s.length === 1 && s[0].name === "The Ossuary Warden" && s[0].tier === 2 && s[0].nobar === true,
    red: s.length === 1 && s[0].color === "${RED}" && s[0].bg === "${BLACK}",
    big: big.classList.contains("show"),
    name: !!nm && nm.textContent === "The Ossuary Warden" && nm.classList.contains("tag") && nm.classList.contains("t2"),
  };
  return { pass: Object.values(c).every(Boolean), c, s };`),
  step("a staggered boss has no glowing bar", `
  ${aware("warden", 10, 0.3)} e.state = "stagger"; await draw();
  const d = [...document.querySelectorAll("#ebars .eb")].find((q) => q.style.display !== "none"), cs = getComputedStyle(d);
  return { pass: d.classList.contains("stag") && d.classList.contains("nobar") && cs.boxShadow === "none", shadow: cs.boxShadow };`),
  step("an unnoticed enemy off to the side has no tag", `
  stage("husk", 6, 0.5); await draw(); const s = slots();
  return { pass: s.length === 0, s };`),
  step("a reused slot is rewritten", `
  { ${aware("warden", 10, 0.3)} }
  const before = slots();
  ${aware("husk")} const s = slots();
  return { pass: before.length === 1 && before[0].nobar === true && s.length === 1 && s[0].name === "Husk" && s[0].tier === 0 && s[0].nobar === false && s[0].color === "${WHITE}", before, s };`),
  step("a dead enemy loses its tag", `
  ${aware("husk")} const before = slots().length;
  DF.hitEnemy(e, 9999, 0, { src: "melee" }); await draw(); const s = slots();
  return { pass: before === 1 && e.dead === true && s.length === 0, before, dead: e.dead, s };`),
  step("the locked target keeps a slot", `
  const e = stage("brute", 6, 0.5);
  const o = G.enemies.filter((q) => q !== e && !q.def.boss && q.type !== "brute").slice(0, 12);
  o.forEach((q, i) => { q.x = e.x + (i + 1) * 0.05; q.z = e.z; q.aware = true; });
  G.enemies = [...o, e]; e.aware = true; G.player.lock = e; await draw(); const s = slots();
  return { pass: o.length === 12 && s.length === 10 && s.some((q) => q.name === "Brute"), others: o.length, n: s.length, names: s.map((q) => q.name) };`),
  step("the posture bar keeps its colour", `
  ${aware("husk")}
  const b = [...document.querySelectorAll("#ebars .eb")].find((d) => d.style.display !== "none").querySelector("b");
  const ember = getComputedStyle(document.documentElement).getPropertyValue("--ember").trim(), bg = getComputedStyle(b).backgroundColor;
  return { pass: slots().length === 1 && ember === "#ffb347" && bg === "rgb(255, 179, 71)", ember, bg };`),
  step("the dummy has a white tag", `
  DF.enterHub(); DF.show("play"); const d = G.enemies.find((q) => q.def.dummy), p = G.player;
  p.x = d.x; p.z = d.z - 4; p.yaw = 0; p.lock = null; cam.yaw = 0.5; cam.pitch = 0.3; cam.px = p.x; cam.pz = p.z; cam.cd = 5.6;
  await draw(); const s = slots();
  return { pass: s.length === 1 && s[0].name === "Training dummy" && s[0].tier === 0 && s[0].color === "${WHITE}", s };`),
  // ---- the look zone: an unnoticed enemy near the middle of the screen ----
  step("looking shows the tag and full bars", `
  const e = stage("husk"); await draw(); await draw(); const s = slots();
  return { pass: s.length === 1 && s[0].name === "Husk" && s[0].tier === 0 && s[0].hp === "100%" && e.aware === false && e.state === "idle", s, aware: e.aware, state: e.state };`),
  step("resting camera pitch still counts", `
  stage("husk", 12, 0, 0.3); await draw(); const s = slots();
  return { pass: s.length === 1 && s[0].name === "Husk", s };`),
  step("a wall hides the tag", `
  stage("husk"); G.world.los = () => false; await draw(); const s = slots();
  return { pass: s.length === 0, s };`),
  step("beyond 26 metres there is no tag", `
  const e = stage("husk"); e.z = G.player.z + 30; cam.pitch = Math.atan2(1.62 - e.def.top * 0.55, 30); G.world.los = () => true; await draw(); const s = slots();
  return { pass: s.length === 0, s };`),
  step("a pack in the zone all show", `
  const e = stage("husk"), o = G.enemies.find((q) => q.type === "spit"); o.x = e.x; o.z = e.z + 1.5; o.aware = false; await draw(); const s = slots();
  return { pass: s.length === 2 && s.map((q) => q.name).sort().join() === "Husk,Spitter", s };`),
  step("looking at the boss shows only its tag", `
  stage("warden", 10); await draw(); const s = slots();
  return { pass: s.length === 1 && s[0].tier === 2 && s[0].nobar === true && !document.getElementById("boss").classList.contains("show"), s };`),
  // ---- the How to play screen ----
  step("how to play opens from the title", `
  const $ = (q) => document.querySelector(q), on = (q) => $(q).classList.contains("show");
  DF.show("title"); $('#scr-title [data-open="howto"]').click();
  const c = { state: G.state === "howto", shown: on("#scr-howto"), hud: !on("#hud") };
  $("#scr-howto [data-back]").click(); c.back = G.state === "title" && !on("#scr-howto");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("how to play opens from pause", `
  const $ = (q) => document.querySelector(q), on = (q) => $(q).classList.contains("show");
  DF.newRun(99); DF.show("play"); DF.show("pause"); $('#scr-pause [data-open="howto"]').click();
  const c = { state: G.state === "howto", shown: on("#scr-howto"), hud: on("#hud") };
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape" })); c.back = G.state === "pause" && !on("#scr-howto");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("the colour key is right", `
  const tags = [...document.querySelectorAll("#scr-howto .tag")], text = document.getElementById("scr-howto").textContent.replace(/\\s+/g, " ");
  DF.show("title"); DF.openMenu("howto");
  const col = tags.map((t) => getComputedStyle(t).color), bg = tags.map((t) => getComputedStyle(t).backgroundColor);
  const c = {
    three: tags.length === 3 && tags.every((t, i) => t.classList.contains("t" + i)),
    colours: col.join("|") === "${WHITE}|${ORANGE}|${RED}",
    black: bg.length === 3 && bg.every((b) => b === "${BLACK}"),
    white: text.includes("weaker than you"), orange: text.includes("around your level or slightly above"), red: text.includes("much stronger than you"),
  };
  DF.show("title");
  return { pass: Object.values(c).every(Boolean), c, col };`),
  step("the tips moved", `
  const text = (document.getElementById("scr-howto") || document.createElement("p")).textContent.replace(/\\s+/g, " ");
  const c = { title: document.querySelector("#scr-title .tips") === null, parry: text.includes("Pale flash"), posture: text.includes("Orange bar full"), shrines: text.includes("Shrines") };
  return { pass: Object.values(c).every(Boolean), c };`),
  // the health fill once sat above the menu screens, so it did not dim
  step("menus cover the health bar", `
  DF.newRun(99); DF.show("play"); await draw();
  const vit = document.getElementById("vitals"), hud = document.getElementById("hud");
  // the HUD ignores the pointer, which elementFromPoint honours; let it in
  // for the check
  hud.style.pointerEvents = "auto";
  const onTop = () => { const r = document.getElementById("hpF").getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && vit.contains(e); };
  const c = { play: onTop() };
  DF.show("pause"); await draw(); c.pause = !onTop();
  DF.openMenu("controls"); await draw(); c.controls = !onTop();
  DF.show("play"); await draw(); c.back = onTop();
  hud.style.pointerEvents = "";
  return { pass: Object.values(c).every(Boolean), c };`),
];
