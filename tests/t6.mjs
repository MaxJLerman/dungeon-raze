const cls = (id, body) =>
  `(() => { DF.setClass('${id}'); DF.newRun(99); const { G, cam } = DF; G.state = 'play'; G.manual = true; const p = G.player; const tp = (sel, dist) => { const e = G.enemies.find(sel); const a = e.yaw; p.x = e.x + Math.sin(a) * dist; p.z = e.z + Math.cos(a) * dist; G.world.resolve(p, 0.6); p.yaw = Math.atan2(e.x - p.x, e.z - p.z); cam.yaw = p.yaw; cam.px = p.x; cam.pz = p.z; return e; }; const K = (a) => { DF.taps[DF.BIND[a]] = true; }; ${body} })()`;
const fight = (id, dist) =>
  cls(
    id,
    `const e = tp((e) => e.type === 'brute', ${dist}); const h0 = e.hp; p.focus = 100; let log = [];
  K('light'); DF.sim(0.9, (i) => { if (i % 12 === 0) K('light'); }); log.push('chain ' + (h0 - e.hp).toFixed(0)); let h = e.hp;
  DF.sim(1.2); p.hp = p.maxHp; p.stam = p.maxStam; p.state = 'free'; K('heavy'); DF.sim(1.3); log.push('heavy ' + (h - e.hp).toFixed(0)); h = e.hp;
  p.hp = p.maxHp; p.stam = p.maxStam; p.state = 'free'; K('tool'); DF.sim(1.0); log.push('tool ' + (h - e.hp).toFixed(0) + ' left ' + p.tool); h = e.hp;
  p.hp = p.maxHp; p.state = 'free'; K('special'); DF.sim(1.5); log.push('special ' + (h - e.hp).toFixed(0) + ' focus ' + (p.focus | 0) + ' buff ' + p.buff);
  K('dodge'); DF.keys[DF.BIND.left] = true; DF.sim(0.6); DF.keys[DF.BIND.left] = false;
  return { cls: p.cls.name, hp: p.maxHp, log, edead: e.dead, estate: e.state, nan: !(p.x === p.x), pstate: p.state };`,
  );
export default [
  { name: "assassin", eval: fight("assassin", 2.4) },
  { name: "fighter", eval: fight("fighter", 2.8) },
  { name: "tanker", eval: fight("tanker", 2.4) },
  { name: "mage", eval: fight("mage", 9) },
  { name: "ranger", eval: fight("ranger", 10) },
  {
    name: "fortress parry",
    eval: cls(
      "tanker",
      `const e = tp((e) => e.type === 'brute', 3); e.aware = true; e.state = 'chase'; e.plan = e.def.atks.crush; e.cd = 0; p.focus = 100; K('special'); DF.keys[DF.BIND.guard] = true; K('guard'); DF.sim(4, () => e.state !== 'recoil' && e.state !== 'stagger'); DF.keys[DF.BIND.guard] = false; return { hp: p.hp, estate: e.state, po: e.posture | 0, buff: p.buff };`,
    ),
  },
  {
    name: "fighter armor",
    eval: cls(
      "fighter",
      `const e = tp((e) => e.type === 'husk' && e.node >= 0, 2.2); e.aware = true; e.state = 'chase'; e.cd = 0; let interrupted = 0, swings = 0; DF.sim(6, (i) => { if (p.state === 'free') { K('light'); swings++; } if (p.state === 'hit') interrupted++; if (p.hp < 40) p.hp = p.maxHp; }); return { interrupted, swings, kills: G.kills };`,
    ),
  },
  {
    name: "rebind",
    eval: `(() => { const b0 = Object.assign({}, DF.BIND); DF.setBind('dodge', 'KeyF'); const r = { dodge: DF.BIND.dodge, heavy: DF.BIND.heavy }; DF.setBind('dodge', 'KeyB'); return { r, restored: DF.BIND.dodge === b0.dodge && DF.BIND.heavy === b0.heavy, saved: !!localStorage.getItem('dungeon-raze.v2') }; })()`,
  },
  {
    name: "bot soak all classes",
    eval: `(() => { const out = {}; for (const id of Object.keys(DF.CLASSES)) { DF.setClass(id); DF.newRun(4242); const { G } = DF; G.state = 'play'; G.manual = true; const p = G.player, w = G.world, B = DF.BIND; const path = w.path.map((i) => w.nodes[i]); let pi = 1, nan = 0, deaths = 0;
      DF.sim(150, (i) => { const n = path[pi]; DF.cam.yaw = Math.atan2(n.x - p.x, n.z - p.z) + Math.sin(i * 0.01) * 0.8; DF.keys[B.fwd] = true; if (Math.hypot(n.x - p.x, n.z - p.z) < 4 && pi < path.length - 1) pi++; if (i % 19 === 0) DF.taps[B.light] = true; if (i % 97 === 0) DF.taps[B.dodge] = true; if (i % 131 === 0) DF.taps[B.heavy] = true; if (i % 211 === 0) DF.taps[B.special] = true; if (i % 173 === 0) DF.taps[B.lock] = true; if (i % 151 === 0) DF.taps[B.tool] = true; DF.keys[B.guard] = i % 500 > 440; if (i % 257 === 0) DF.taps[B.heal] = true; if (p.x !== p.x) nan++; for (const e of G.enemies) if (e.x !== e.x) nan++; if (p.state === 'dead' && p.t > 2) { deaths++; DF.respawn(); pi = 1; } });
      DF.keys[B.fwd] = false; DF.keys[B.guard] = false; out[id] = { nan, deaths, kills: G.kills, pi }; } return out; })()`,
  },
];
