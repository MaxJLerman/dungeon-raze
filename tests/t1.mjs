// scripted scenario: fight a room pack
const near = (type, dist) =>
  `(() => { const { G, cam } = DF; const e = G.enemies.find((e) => e.type === '${type}' && !e.dead && e.state === 'idle'); if (!e) return 'none'; const p = G.player; const a = e.yaw; p.x = e.x + Math.sin(a) * ${dist}; p.z = e.z + Math.cos(a) * ${dist}; G.world.resolve(p, 0.6); p.yaw = Math.atan2(e.x - p.x, e.z - p.z); cam.yaw = p.yaw; cam.px = p.x; cam.pz = p.z; window.T = e; return { hp: e.hp, d: Math.hypot(e.x - p.x, e.z - p.z) }; })()`;
const st = `(() => { const { G } = DF; const p = G.player, e = window.T; return { p: { hp: +p.hp.toFixed(1), st: +p.stam.toFixed(0), fo: p.focus | 0, state: p.state, lock: !!p.lock }, e: e && { hp: +e.hp.toFixed(1), po: e.posture | 0, state: e.state, aware: e.aware, d: +Math.hypot(e.x - p.x, e.z - p.z).toFixed(1) }, kills: G.kills, gs: G.state, alive: G.enemies.filter((x) => !x.dead).length }; })()`;
const click = `DF.taps.m0 = true`;
export default [
  { name: "tp husk", eval: near("husk", 6), wait: 900, shot: "husk_alert" },
  { name: "after alert", eval: st, wait: 1800, shot: "husk_attack" },
  { name: "took hits?", eval: st },
  { eval: `DF.taps.KeyQ = true`, wait: 200 },
  { eval: click, wait: 230 },
  { eval: click, wait: 60, shot: "slash" },
  { eval: click, wait: 300 },
  { eval: click, wait: 330 },
  { eval: click, wait: 400, shot: "combo" },
  { name: "after combo", eval: st },
  { eval: click, wait: 250 },
  { eval: click, wait: 250 },
  { eval: click, wait: 250 },
  { eval: click, wait: 500 },
  { name: "after combo2", eval: st },
  { eval: `DF.mouse.r = true; DF.taps.m2 = true`, wait: 2500, shot: "guard" },
  { name: "guarding", eval: st },
  {
    eval: `DF.mouse.r = false; DF.taps.Space = true; DF.keys.KeyA = true`,
    wait: 200,
    shot: "dodge",
  },
  {
    eval: `DF.keys.KeyA = false; DF.taps.KeyV = true`,
    wait: 500,
    shot: "blink",
  },
  { name: "after blink", eval: st },
  { eval: `DF.taps.KeyF = true`, wait: 700 },
  { eval: `DF.taps.KeyR = true`, wait: 500 },
  { name: "end", eval: st, shot: "end" },
];
