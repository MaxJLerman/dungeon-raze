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
  { name: "enforcer", eval: fight("enforcer", 8) },
  { name: "sapper", eval: fight("sapper", 2.6) },
  {
    name: "sapper slam blasts in front",
    eval: cls("sapper", `
  const e = tp((e) => e.type === 'brute', 2.6); e.state = 'idle'; const h0 = e.hp, p0 = e.posture, hp0 = p.hp; K('heavy');
  // read just after the slam lands at 0.45 s, before the brute it woke can swing back
  DF.sim(0.55);
  const hit = e.hp < h0, post = e.posture - p0;
  return { pass: hit && p.hp === hp0 && post >= 50, hit, post, hurt: hp0 - p.hp }; `),
  },
  {
    name: "mine arms and blows on an enemy",
    eval: cls("sapper", `
  const e = tp((e) => e.type === 'husk', 6); e.state = 'idle'; const h0 = e.hp, hp0 = p.hp; K('tool'); DF.sim(0.3);
  // the husk is held on the mine, so only the arming decides when it goes off
  const m = G.mines[0], early = !!m, hold = () => { if (!e.dead) { e.x = m.x + 0.2; e.z = m.z; } };
  DF.sim(0.2, hold); const waited = G.mines.length === 1;
  DF.sim(0.8, hold); return { pass: early && waited && G.mines.length === 0 && e.hp < h0 && p.hp === hp0, early, waited, left: G.mines.length, hurt: hp0 - p.hp }; `),
  },
  {
    name: "two mines wire up and a crossing sets both off",
    eval: cls("sapper", `
  const e = tp((e) => e.type === 'brute', 12); e.state = 'idle'; const a = DF.plantMine(p.x, p.z), b = DF.plantMine(p.x + 4, p.z);
  const wired = a.links.includes(b) && b.links.includes(a); DF.sim(1); e.x = p.x + 2; e.z = p.z + 0.3; DF.sim(0.2);
  return { pass: wired && G.mines.length === 0, wired, left: G.mines.length }; `),
  },
  {
    name: "a mine sets off its neighbour and the cap holds",
    eval: cls("sapper", `
  const e = tp((e) => e.type === 'husk', 12); e.state = 'idle'; DF.plantMine(p.x + 5, p.z); DF.plantMine(p.x + 7, p.z + 2); DF.sim(1);
  DF.boomMine(G.mines[0]); DF.sim(0.4); const chained = G.mines.length === 0;
  // no enemies from here: the player alone, standing among armed mines
  G.enemies = []; G.projs = [];
  for (let i = 0; i < 12; i++) DF.plantMine(p.x + (i % 4), p.z + (i >> 2)); const capped = G.mines.length === DF.MINE.cap;
  const linked = G.mines.every((m) => m.links.every((o) => G.mines.includes(o)));
  const hp0 = p.hp; DF.sim(2); const safe = p.hp === hp0 && G.mines.length === DF.MINE.cap;
  return { pass: chained && capped && linked && safe, chained, capped, linked, n: G.mines.length, safe, lost: hp0 - p.hp }; `),
  },
  {
    name: "sapper execution kicks a charge that hurts the next one",
    eval: cls("sapper", `
  const e = tp((e) => e.type === 'husk', 2), o = G.enemies.find((x) => x !== e && x.type === 'brute');
  const dir = Math.atan2(e.x - p.x, e.z - p.z); o.x = e.x + Math.sin(dir) * 4; o.z = e.z + Math.cos(dir) * 4; o.state = 'idle';
  const h0 = o.hp, hp0 = p.hp, ex = e.x, ez = e.z; e.state = 'stagger'; e.t = 0; e.dur = 3; DF.startExecute(e); DF.sim(1);
  const flew = Math.hypot(e.x - ex, e.z - ez);
  return { pass: e.dead && flew > 2 && o.hp < h0 && p.hp === hp0, dead: e.dead, flew, hurt: h0 - o.hp, lost: hp0 - p.hp }; `),
  },
  {
    name: "sapper is hidden until unlocked",
    eval: `(() => { DF.UNLOCKED.clear();
  const c = { hidden: DF.CLASSES.sapper.hidden === true, out: !DF.pickable().includes('sapper') };
  DF.unlockClass('sapper'); c.in = DF.pickable().includes('sapper'); DF.UNLOCKED.clear(); DF.saveOpt();
  return { pass: Object.values(c).every(Boolean), c }; })()`,
  },
  {
    name: "enforcer shotgun and execution",
    eval: cls("enforcer", `
  const e = tp((e) => e.type === 'brute', 3); K('heavy'); let most = 0;
  DF.sim(0.6, () => { most = Math.max(most, G.projs.filter((q) => q.kind === 'pellet').length); });
  p.state = 'free'; p.tool = 0; e.state = 'stagger'; e.t = 0; e.dur = 3; DF.startExecute(e); DF.sim(0.2);
  const back = Math.hypot(p.x - e.x, p.z - e.z); const rnd = Math.random; Math.random = () => 0.99; // no kill refill
  DF.sim(1, () => !p.exDone); Math.random = rnd; const tool = p.tool;
  return { pass: most === 7 && back > e.r + 3.5 && tool === 1, most, back, tool }; `),
  },
  {
    name: "sticky bomb",
    eval: cls("enforcer", `
  const e = tp((e) => e.type === 'brute', 6); e.state = 'idle'; const h0 = e.hp; K('tool'); let stuck = null;
  DF.sim(1, () => { const b = G.bombs[0]; if (b && b.e) stuck = b.e; });
  e.x += 2; DF.sim(0.05); const b = G.bombs[0], follows = b && Math.hypot(b.x - e.x, b.z - e.z) < e.r + 0.6;
  DF.sim(2.5); const c = { stuck: stuck === e, follows, gone: G.bombs.length === 0, hurt: e.hp < h0 };
  return { pass: Object.values(c).every(Boolean), c }; `),
  },
  {
    name: "sticky bomb hurts its thrower at half",
    eval: cls("enforcer", `
  const e = tp((e) => e.type === 'brute', 6); e.state = 'idle'; p.iframe = 0;
  G.bombs.push({ x: p.x + 1, y: 1, z: p.z, e: null, ox: 0, oz: 0, t: 0.05 }); const hp0 = p.hp; DF.sim(0.2);
  return { pass: Math.abs(hp0 - p.hp - 22.5) < 0.6, lost: hp0 - p.hp }; `),
  },
  {
    name: "sticky bomb dodged and cleared",
    eval: cls("enforcer", `
  G.bombs.push({ x: p.x + 1, y: 1, z: p.z, e: null, ox: 0, oz: 0, t: 0.05 }); p.iframe = 1; const hp0 = p.hp; DF.sim(0.2);
  const dodged = p.hp === hp0;
  G.bombs.push({ x: p.x + 1, y: 1, z: p.z, e: null, ox: 0, oz: 0, t: 2 }); DF.enterHub();
  return { pass: dodged && G.bombs.length === 0, dodged, left: G.bombs.length }; `),
  },
  {
    name: "sticky bomb on a dying enemy",
    eval: cls("enforcer", `
  const e = tp((e) => e.type === 'husk', 5); G.bombs.push({ x: e.x, y: 1, z: e.z, e, ox: 0, oz: 0, t: 1 });
  DF.hitEnemy(e, 999, 0, {}); const at = [e.x, e.z]; DF.sim(0.3); const b = G.bombs[0];
  const dropped = b && b.e === null && Math.hypot(b.x - at[0], b.z - at[1]) < 1; DF.sim(1);
  return { pass: dropped && G.bombs.length === 0, dropped }; `),
  },
  {
    name: "grapple pulls light enemies, pulls you to heavy ones",
    eval: cls("enforcer", `
  const out = {};
  for (const type of ['husk', 'brute']) {
    const e = tp((e) => e.type === type, 9); e.state = 'idle'; p.state = 'free'; p.focus = 100; p.lock = e;
    const e0 = [e.x, e.z], p0 = [p.x, p.z]; K('special'); DF.sim(0.8);
    out[type] = { gap: +Math.hypot(p.x - e.x, p.z - e.z).toFixed(2), eMoved: Math.hypot(e.x - e0[0], e.z - e0[1]) > 3,
      pMoved: Math.hypot(p.x - p0[0], p.z - p0[1]) > 3, focus: p.focus | 0 };
  }
  const c = { husk: out.husk.eMoved && !out.husk.pMoved && out.husk.gap < 2.5,
    brute: out.brute.pMoved && !out.brute.eMoved && out.brute.gap < 3, cost: out.husk.focus <= 66 };
  return { pass: Object.values(c).every(Boolean), c, out }; `),
  },
  {
    name: "grapple keeps a stagger",
    eval: cls("enforcer", `
  // a staggered enemy grappled to, or yanked in, stays open to an execution
  const out = {};
  for (const type of ['husk', 'brute']) {
    const e = tp((e) => e.type === type, 9); e.state = 'stagger'; e.t = 0; e.dur = 3; p.state = 'free'; p.focus = 100; p.lock = e;
    K('special'); DF.sim(0.8); out[type] = e.state;
  }
  return { pass: out.husk === 'stagger' && out.brute === 'stagger', out }; `),
  },
  {
    name: "grapple leaves time to follow up",
    eval: cls("enforcer", `
  // after the pull, the enemy is still reeling for a while
  const out = {};
  for (const type of ['husk', 'brute']) {
    const e = tp((e) => e.type === type, 9); e.state = 'idle'; p.state = 'free'; p.focus = 100; p.lock = e;
    K('special'); let t = 0, began = false, done = -1, freed = -1;
    DF.sim(2, () => { t += 1 / 60; if (e.yank || p.state === 'grapple') began = true;
      if (began && done < 0 && !e.yank && p.state === 'free') done = t; if (done >= 0 && freed < 0 && e.state !== 'hit') freed = t; return freed < 0; });
    out[type] = +(freed - done).toFixed(2);
  }
  return { pass: out.husk >= 0.4 && out.brute >= 0.4, out }; `),
  },
  {
    name: "grapple has its own pose",
    eval: cls("enforcer", `
  // reeled in: the hook arm out ahead, leaning in, legs trailing
  const e = tp((e) => e.type === 'brute', 9); e.state = 'idle'; p.state = 'free'; p.focus = 100; p.lock = e;
  K('special'); DF.sim(0.1); const f = p.fig, inG = p.state === 'grapple'; DF.posePlayer(p);
  const c = { inG, arm: f.armR.r[0] < -1.3, lean: f.chest.r[0] > 0.25, legs: f.legL.r[0] > 0.3 || f.legR.r[0] > 0.3 };
  return { pass: Object.values(c).every(Boolean), c }; `),
  },
  {
    name: "grapple with no target spends nothing",
    eval: cls("enforcer", `
  for (const e of G.enemies) e.dead = true; p.focus = 100; p.lock = null; K('special'); DF.sim(0.3);
  return { pass: p.focus >= 99 && p.state === 'free', focus: p.focus, state: p.state }; `),
  },
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
    eval: `(() => { const b0 = Object.assign({}, DF.BIND); DF.setBind('dodge', 'KeyF'); const r = { dodge: DF.BIND.dodge, heavy: DF.BIND.heavy }; DF.setBind('dodge', b0.dodge); return { r, restored: DF.BIND.dodge === b0.dodge && DF.BIND.heavy === b0.heavy, saved: !!localStorage.getItem('dungeon-raze.v2') }; })()`,
  },
  {
    name: "bot soak all classes",
    eval: `(() => { const out = {}; for (const id of Object.keys(DF.CLASSES)) { DF.setClass(id); DF.newRun(4242); const { G } = DF; G.state = 'play'; G.manual = true; const p = G.player, w = G.world, B = DF.BIND; const path = w.path.map((i) => w.nodes[i]); let pi = 1, nan = 0, deaths = 0;
      DF.sim(150, (i) => { const n = path[pi]; DF.cam.yaw = Math.atan2(n.x - p.x, n.z - p.z) + Math.sin(i * 0.01) * 0.8; DF.keys[B.fwd] = true; if (Math.hypot(n.x - p.x, n.z - p.z) < 4 && pi < path.length - 1) pi++; if (i % 19 === 0) DF.taps[B.light] = true; if (i % 97 === 0) DF.taps[B.dodge] = true; if (i % 131 === 0) DF.taps[B.heavy] = true; if (i % 211 === 0) DF.taps[B.special] = true; if (i % 173 === 0) DF.taps[B.lock] = true; if (i % 151 === 0) DF.taps[B.tool] = true; DF.keys[B.guard] = i % 500 > 440; if (i % 257 === 0) DF.taps[B.heal] = true; if (p.x !== p.x) nan++; for (const e of G.enemies) if (e.x !== e.x) nan++; if (p.state === 'dead' && p.t > 2) { deaths++; DF.respawn(); pi = 1; } });
      DF.keys[B.fwd] = false; DF.keys[B.guard] = false; out[id] = { nan, deaths, kills: G.kills, pi }; } return out; })()`,
  },
];
