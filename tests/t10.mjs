// Enemy name tags, threat colours, the look zone and the How to play screen.
// Run with: SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.
//
// The frame loop keeps drawing and updating the HUD while G.manual is set, so
// a step changes state, awaits draw() and then reads the DOM.
const WHITE = "rgb(255, 255, 255)",
  ORANGE = "rgb(219, 77, 0)",
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
];
