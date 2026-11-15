const tp = (sel, dist, front = true) =>
  `const { G, cam } = DF; const p = G.player; const e = G.enemies.find(${sel}); const a = e.yaw + (${front} ? 0 : Math.PI); p.x = e.x + Math.sin(a) * ${dist}; p.z = e.z + Math.cos(a) * ${dist}; G.world.resolve(p, 0.6); p.yaw = Math.atan2(e.x - p.x, e.z - p.z); cam.yaw = p.yaw; p.hp = 100; p.stam = 100; p.state = 'free'; p.lock = null; p.iframe = 0;`;
export default [
  { eval: `DF.G.manual = true; 1` },
  {
    name: "parry",
    eval: `(() => { ${tp("(e) => e.type === 'husk' && !e.dead && e.node === -1", 2.0)} const log = []; let parried = false;
      DF.sim(6, () => { if (e.state === 'wind' && e.t > e.atk.wind - 0.08 && p.state === 'free') { DF.taps.m2 = true; DF.mouse.r = true; } if (e.state === 'recoil' && !parried) { parried = true; log.push('recoil po=' + (e.posture|0) + ' php=' + p.hp); DF.mouse.r = false; } if (parried && e.state === 'recoil' && p.state === 'free') DF.taps.m0 = true; });
      DF.mouse.r = false; return { parried, log, ehp: e.hp, estate: e.state, php: p.hp, focus: p.focus }; })()`,
  },
  {
    name: "ambush+backstab",
    eval: `(() => { ${tp("(e) => e.type === 'husk' && !e.dead && e.state === 'idle'", 1.6, false)} const h0 = e.hp; const aware0 = e.aware; DF.taps.m0 = true; DF.sim(0.4); return { aware0, h0, h1: e.hp, dead: e.dead, state: e.state }; })()`,
  },
  {
    name: "stagger+execute",
    eval: `(() => { ${tp("(e) => e.type === 'brute' && !e.dead", 2.4)} e.aware = true; e.state = 'chase'; e.posture = e.def.posture - 5; DF.taps.KeyF = true; DF.sim(0.6); const st = e.state; DF.taps.m0 = true; DF.sim(0.2); const ps = p.state; DF.sim(1.0); return { st, ps, dead: e.dead, php: p.hp, kills: G.kills }; })()`,
  },
  {
    name: "dodge iframes",
    eval: `(() => { ${tp("(e) => e.type === 'husk' && !e.dead && e.state === 'idle'", 2.0)} let pd = false; const hp0 = p.hp; DF.sim(5, () => { if (e.state === 'wind' && e.t > e.atk.wind - 0.05 && p.state === 'free') { DF.taps.Space = true; DF.keys.KeyA = true; } if (p.state !== 'dodge') DF.keys.KeyA = false; }); return { hp0, hp1: p.hp, msgs: G.msgs.map((m) => m.text) }; })()`,
  },
  {
    name: "knife+blink",
    eval: `(() => { ${tp("(e) => e.type === 'spit' && !e.dead", 9)} e.aware = true; e.state = 'chase'; const h0 = e.hp; p.focus = 100; DF.taps.KeyR = true; DF.sim(0.5); const h1 = e.hp; DF.taps.KeyV = true; DF.sim(0.6); return { h0, h1, h2: e.hp, dead: e.dead, d: Math.hypot(e.x - p.x, e.z - p.z), focus: p.focus, pstate: p.state }; })()`,
  },
  {
    name: "boss",
    eval: `(() => { ${tp("(e) => e.type === 'warden'", 9)} const seen = {}; let nan = false, minF = 9, hits = 0, lastHp = p.hp;
      DF.sim(60, (i) => { if (e.atk && e.state === 'wind') seen[Object.keys(e.def.atks).find((k) => e.def.atks[k] === e.atk)] = 1; if (!(e.x === e.x) || !(p.x === p.x)) nan = true; minF = Math.min(minF, G.world.fieldAt(e.x, e.z)); if (p.hp < lastHp) hits++; lastHp = p.hp; if (p.hp < 40) p.hp = 100; if (i === 1500) e.hp = e.def.hp * 0.52; if (i % 600 === 0 && e.state === 'chase') { e.plan = e.def.atks[i % 1200 === 0 ? 'slam' : 'volley']; e.cd = 0; } DF.keys.KeyS = (i % 300) < 120; if (p.state === 'dead') return false; }); DF.keys.KeyS = false;
      return { seen: Object.keys(seen), nan, minF, hits, bossHp: e.hp, phase: e.phase, bstate: e.state, pstate: p.state }; })()`,
  },
  {
    name: "boss kill + win",
    eval: `(() => { const { G } = DF; const p = G.player; const e = G.enemies.find((e) => e.type === 'warden'); e.hp = 5; p.state = 'free'; p.x = e.x + 2; p.z = e.z; G.world.resolve(p, .5); DF.hitEnemy(e, 10, 0, { src: 'melee' }); DF.sim(2); const gate = !!G.gate; p.x = G.gate.x; p.z = G.gate.z; DF.sim(0.2); return { gate, state: G.state, bossDead: G.bossDead }; })()`,
  },
  {
    name: "death+respawn",
    eval: `(() => { DF.newRun(4242); const { G } = DF; const p = G.player; G.state = 'play'; DF.hurtPlayer(500, null, { px: p.x + 1, pz: p.z }); const s1 = p.state; DF.sim(2); const gs = G.state; DF.respawn(); return { s1, gs, after: G.state, hp: p.hp, deaths: G.deaths, enemies: G.enemies.length }; })()`,
  },
  {
    name: "bot soak",
    eval: `(() => { const { G } = DF; const p = G.player; let nan = 0, stuck = 0, deaths = 0, maxOut = 0; const w = G.world; const path = w.path.map((i) => w.nodes[i]); let pi = 1; const t0 = performance.now();
      DF.sim(240, (i) => { const n = path[pi]; const a = Math.atan2(n.x - p.x, n.z - p.z); DF.cam.yaw = a + Math.sin(i * 0.01) * 0.8; DF.keys.KeyW = true; DF.keys.ShiftLeft = i % 400 < 150; if (Math.hypot(n.x - p.x, n.z - p.z) < 4 && pi < path.length - 1) pi++; if (i % 23 === 0) DF.taps.m0 = true; if (i % 97 === 0) DF.taps.Space = true; if (i % 131 === 0) DF.taps.KeyF = true; if (i % 211 === 0) DF.taps.KeyV = true; if (i % 173 === 0) DF.taps.KeyQ = true; if (i % 301 === 0) DF.taps.KeyR = true; DF.mouse.r = i % 500 > 440; if (i % 500 === 441) DF.taps.m2 = true; if (i % 257 === 0) DF.taps.KeyE = true;
        if (p.x !== p.x) nan++; for (const e of G.enemies) if (e.x !== e.x) nan++; maxOut = Math.max(maxOut, -w.fieldAt(p.x, p.z)); if (p.state === 'dead' && p.t > 2) { deaths++; DF.respawn(); pi = 1; } });
      DF.keys.KeyW = false; DF.keys.ShiftLeft = false; DF.mouse.r = false;
      return { ms: Math.round(performance.now() - t0), nan, deaths, pi, kills: G.kills, maxOut, hp: p.hp, node: pi, seen: w.nodes.filter((n) => n.seen).length }; })()`,
  },
];
