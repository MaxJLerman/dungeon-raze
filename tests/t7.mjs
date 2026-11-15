const setup = (id) =>
  `DF.setClass('${id}'); DF.newRun(99); const { G, cam } = DF; G.manual = true; DF.show('play'); const p = G.player; const tp = (sel, dist, side = 0.5) => { const e = G.enemies.find(sel); const a = e.yaw; p.x = e.x + Math.sin(a) * dist; p.z = e.z + Math.cos(a) * dist; G.world.resolve(p, 0.6); p.yaw = Math.atan2(e.x - p.x, e.z - p.z); cam.yaw = p.yaw + side; cam.pitch = 0.3; cam.px = p.x; cam.pz = p.z; cam.cd = 5.6; e.aware = true; e.state = 'chase'; e.cd = 9; return e; }; const K = (a) => { DF.taps[DF.BIND[a]] = true; };`;
export default [
  { eval: `DF.openMenu('controls'); 1`, wait: 400, shot: "m_controls" },
  {
    eval: `DF.show('title'); DF.show('pause'); DF.openMenu('class'); DF.setClass('mage'); document.querySelector('.scr.show .card').click(); DF.setClass('mage'); 1`,
    wait: 400,
    shot: "m_class",
  },
  {
    name: "fighter",
    eval: `(() => { ${setup("fighter")} const e = tp((e) => e.type === 'husk' && e.node >= 0, 2.6); K('light'); DF.sim(1, () => !(p.state === 'attack' && p.t > 0.3)); return p.move + ' ' + p.t.toFixed(2); })()`,
    wait: 600,
    shot: "c_fighter",
  },
  {
    name: "tanker",
    eval: `(() => { ${setup("tanker")} const e = tp((e) => e.type === 'brute', 3); p.focus = 100; K('special'); DF.sim(0.2); DF.keys[DF.BIND.guard] = true; K('guard'); DF.sim(0.3); return p.state + ' ' + p.buff; })()`,
    wait: 600,
    shot: "c_tanker",
  },
  {
    name: "mage",
    eval: `(() => { ${setup("mage")} DF.keys[DF.BIND.guard] = false; const e = tp((e) => e.type === 'brute', 10, 0.25); p.focus = 100; p.lock = e; K('special'); DF.sim(0.5); K('light'); DF.sim(1, () => !(p.state === 'attack' && p.t > 0.19)); return p.move + ' projs ' + G.projs.length + ' pending ' + G.pending.length; })()`,
    wait: 600,
    shot: "c_mage",
  },
  {
    name: "ranger",
    eval: `(() => { ${setup("ranger")} const e = tp((e) => e.type === 'brute', 11, 0.25); p.focus = 100; K('light'); DF.sim(0.12); const mv = p.move; DF.sim(0.4); K('special'); DF.sim(0.1); return mv + ' projs ' + G.projs.length; })()`,
    wait: 600,
    shot: "c_ranger",
  },
];
