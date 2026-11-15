const tp = (sel, dist, side = 0) =>
  `const { G, cam } = DF; const p = G.player; const e = G.enemies.find(${sel}); const a = e.yaw + ${side}; p.x = e.x + Math.sin(a) * ${dist}; p.z = e.z + Math.cos(a) * ${dist}; G.world.resolve(p, 0.6); p.yaw = Math.atan2(e.x - p.x, e.z - p.z); cam.yaw = p.yaw + 0.5; cam.pitch = 0.32; cam.px = p.x; cam.pz = p.z; p.hp = 100; p.stam = 100; p.state = 'free'; p.lock = null; p.iframe = 0; G.hitstop = 0; G.slowT = 0;`;
export default [
  { eval: `DF.newRun(99); DF.G.state = 'play'; DF.G.manual = true; 1` },
  {
    name: "slash",
    eval: `(() => { ${tp("(e) => e.type === 'husk' && e.node >= 0", 2.2)} e.aware = true; e.state = 'chase'; e.cd = 5; p.lock = e; DF.taps.m0 = true; DF.sim(1, () => !(p.state === 'attack' && p.t > 0.16)); return p.state + ' ' + p.t.toFixed(2) + ' arcs ' + G.arcs.length; })()`,
    wait: 700,
    shot: "s_slash",
  },
  {
    name: "spin",
    eval: `(() => { const { G } = DF; const p = G.player; let n = 0; DF.sim(3, (i) => { if (p.state === 'free' || (p.state === 'attack' && p.t > 0.3)) DF.taps.m0 = true; return !(p.move === 'l4' && p.t > 0.24 && p.state === 'attack'); }); return p.move + ' ' + p.t.toFixed(2) + ' ehp ' + p.lock?.hp; })()`,
    wait: 700,
    shot: "s_spin",
  },
  {
    name: "stagger",
    eval: `(() => { ${tp("(e) => e.type === 'brute' && !e.dead", 2.6)} e.aware = true; e.state = 'chase'; e.cd = 9; e.posture = e.def.posture - 2; DF.taps.KeyF = true; DF.sim(0.7); return e.state; })()`,
    wait: 700,
    shot: "s_stagger",
  },
  {
    name: "guard vs brute",
    eval: `(() => { ${tp("(e) => e.type === 'brute' && !e.dead && e.state !== 'stagger'", 3.0)} e.aware = true; e.state = 'chase'; e.cd = 0; DF.mouse.r = true; DF.taps.m2 = true; DF.sim(4, () => !(e.state === 'wind' && e.t > e.atk.wind * 0.8)); return e.state + ' ' + (e.atk && e.atk.style) + ' p ' + p.state; })()`,
    wait: 700,
    shot: "s_guard",
  },
  { eval: `DF.mouse.r = false; 1` },
  {
    name: "boss slam",
    eval: `(() => { ${tp("(e) => e.type === 'warden'", 9, 0.4)} e.aware = true; e.state = 'chase'; e.plan = e.def.atks.slam; e.cd = 0; DF.sim(5, () => !(e.state === 'act' && e.t > 0.3)); return e.state + ' y=' + e.y.toFixed(1); })()`,
    wait: 900,
    shot: "s_slam",
  },
  {
    name: "boss combo",
    eval: `(() => { const { G } = DF; const p = G.player; const e = G.enemies.find((e) => e.type === 'warden'); DF.sim(1.5); p.hp = 100; p.state = 'free'; p.x = e.x + Math.sin(e.yaw) * 4; p.z = e.z + Math.cos(e.yaw) * 4; DF.cam.px = p.x; DF.cam.pz = p.z; p.yaw = Math.atan2(e.x - p.x, e.z - p.z); p.lock = e; DF.cam.yaw = p.yaw; e.state = 'chase'; e.plan = e.def.atks.c1; e.cd = 0; DF.sim(5, () => !(e.state === 'wind' && e.t > e.atk.wind * 0.85)); return e.state; })()`,
    wait: 900,
    shot: "s_boss",
  },
  {
    name: "gate",
    eval: `(() => { const { G } = DF; const p = G.player; const e = G.enemies.find((e) => e.type === 'warden'); e.hp = 1; DF.hitEnemy(e, 5, 0, { src: 'melee' }); DF.sim(3); p.state = 'free'; p.hp = 100; p.lock = null; p.x = G.gate.x + 5; p.z = G.gate.z + 3; DF.cam.px = p.x; DF.cam.pz = p.z; DF.cam.yaw = Math.atan2(G.gate.x - p.x, G.gate.z - p.z) + 0.3; return G.bossDead; })()`,
    wait: 900,
    shot: "s_gate",
  },
];
