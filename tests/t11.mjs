// Screenshots of the enemy name tags, for looking at. Run with:
//   SCRIPT=$PWD/tests/t11.mjs node test.mjs smoke
// Files land in shots/. Nothing here asserts on looks; open the images.
const scene = (shot, body) => ({
  name: shot,
  eval: `(() => { const { G, cam } = DF; G.manual = true; ${body} return { pass: true }; })()`,
  wait: 900,
  shot,
});
// An empty first room with the player looking along +Z. put() brings one
// parked enemy of a type to a spot relative to the player, facing them.
const room = (pitch) =>
  `DF.setClass("fighter"); DF.newRun(99); DF.show("play"); const p = G.player, n = G.world.nodes.find((q) => q.kind === "room"); for (const o of G.enemies) o.x += 1000; p.x = n.x; p.z = n.z - 4; p.yaw = 0; p.lock = null; cam.yaw = 0; cam.pitch = ${pitch}; cam.px = p.x; cam.pz = p.z; cam.cd = 5.6; const put = (type, dx, dz, awake = true) => { const e = G.enemies.find((q) => q.type === type && q.x > 500); e.x = p.x + dx; e.z = p.z + dz; e.yaw = Math.PI; e.aware = awake; return e; };`;
export default [
  scene("tags_pack", `${room(0.3)} put("husk", 1.7, 6); put("spit", 0, 6.4); put("brute", -1.9, 6);`),
  scene("tags_boss", `${room(0.2)} put("warden", 1.8, 9); put("brute", -2.2, 9);`),
  scene("tags_dummy", `DF.setClass("fighter"); DF.enterHub(); DF.show("play"); const d = G.enemies.find((e) => e.def.dummy), p = G.player; p.x = d.x; p.z = d.z - 4; p.yaw = 0; cam.yaw = 0.3; cam.pitch = 0.25; cam.px = p.x; cam.pz = p.z; cam.cd = 5.6;`),
];
