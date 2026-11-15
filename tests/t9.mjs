// Screenshots of the hall, for looking at. Run with:
//   node test.mjs title && SCRIPT=$PWD/tests/t9.mjs node test.mjs hub
// Files land in shots/. Nothing here asserts on looks; open the images.
const at = (x, z, yaw, pitch = 0.2) =>
  `const { G, cam } = DF; G.manual = true; DF.show("play"); const p = G.player; p.x = ${x}; p.z = ${z}; p.yaw = ${yaw}; cam.yaw = ${yaw}; cam.pitch = ${pitch}; cam.px = p.x; cam.pz = p.z; cam.cd = 5.6;`;
const view = (shot, x, z, yaw, pitch) => ({
  name: shot,
  eval: `(() => { DF.setClass("fighter"); DF.enterHub(); ${at(x, z, yaw, pitch)} return { pass: G.zone === "hub" }; })()`,
  wait: 700,
  shot,
});
const dummy = `const d = G.enemies.find((e) => e.def.dummy); p.x = d.x; p.z = d.z - 2.4; p.yaw = 0; cam.yaw = 0.6; cam.pitch = 0.28; cam.px = p.x; cam.pz = p.z;`;
export default [
  view("hub_start", 0, -10, 0, 0.15),
  view("hub_portal", 9.6, 10.5, 0.3, 0.1),
  view("hub_sealed", 0.4, 10.5, 0.3, 0.1),
  view("hub_side", 0, 5, Math.PI / 2, 0.2),
  {
    name: "hub_dummy",
    eval: `(() => { DF.setClass("fighter"); DF.enterHub(); ${at(0, 0, 0)} ${dummy} DF.taps[DF.BIND.light] = true; DF.sim(1, () => !(p.state === "attack" && d.flash > 0.5)); return { pass: d.flash > 0, state: p.state }; })()`,
    wait: 700,
    shot: "hub_dummy",
  },
  {
    name: "hub_stagger",
    eval: `(() => { DF.setClass("fighter"); DF.enterHub(); ${at(0, 0, 0)} ${dummy} d.posture = d.def.posture; DF.hitEnemy(d, 1, 1, { src: "melee" }); G.hitstop = 0; DF.sim(0.4); return { pass: d.state === "stagger" }; })()`,
    wait: 700,
    shot: "hub_stagger",
  },
  {
    name: "hub_fade",
    eval: `(() => { DF.enterHub(); ${at(11.5, 14, 0)} G.trans = { t: 0.4, grade: "E", swapped: true }; G.fade = 1; return { pass: true }; })()`,
    wait: 500,
    shot: "hub_fade",
  },
  {
    name: "cave_arrival",
    eval: `(() => { DF.enterHub(); DF.startTrans("E", true); const { G } = DF; G.manual = true; DF.show("play"); return { pass: G.zone === "cave" && !G.trans }; })()`,
    wait: 900,
    shot: "cave_arrival",
  },
  // what a returning player sees first, from each end of the row
  ...["E", "S"].map((g) => ({
    name: "hub_return_" + g,
    eval: `(() => { const { G } = DF; DF.enterHub("${g}"); G.manual = true; DF.show("play"); return { pass: G.zone === "hub" }; })()`,
    wait: 700,
    shot: "hub_return_" + g,
  })),
  { eval: `(() => { DF.enterHub(); return { pass: true }; })()` },
];
