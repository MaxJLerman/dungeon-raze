const tp = (sel, dist) =>
  `const { G, cam } = DF; const p = G.player; const e = G.enemies.find(${sel}); const a = e.yaw; p.x = e.x + Math.sin(a) * ${dist}; p.z = e.z + Math.cos(a) * ${dist}; G.world.resolve(p, 0.6); p.yaw = Math.atan2(e.x - p.x, e.z - p.z); cam.yaw = p.yaw; p.hp = 100; p.stam = 100; p.state = 'free'; p.lock = null; p.iframe = 0;`;
const passive = (
  sel,
  dist,
  secs,
) => `(() => { DF.newRun(99); DF.G.state='play'; DF.G.manual = true; ${tp(sel, dist)} let dmg = 0, last = p.hp, tl = [], ls = '', firstHit = -1, deadAt = -1;
  DF.sim(${secs}, (i) => { if (p.hp < last) { dmg += last - p.hp; if (firstHit < 0) firstHit = i / 60; } last = p.hp; const s = e.state + (e.atk && (e.state==='wind') ? ':' + Object.keys(e.def.atks).find((k) => e.def.atks[k] === e.atk) : ''); if (s !== ls) { tl.push((i / 60).toFixed(1) + s); ls = s; } if (p.state === 'dead' && deadAt < 0) { deadAt = i / 60; return false; } });
  return { dmg, firstHit, deadAt, d: Math.hypot(e.x-p.x,e.z-p.z).toFixed(1), tl: tl.slice(0, 60).join(' ') }; })()`;
export default [
  {
    name: "passive vs husk pack",
    eval: passive("(e) => e.type === 'husk' && e.node >= 0", 5, 30),
  },
  {
    name: "passive vs brute",
    eval: passive("(e) => e.type === 'brute'", 5, 30),
  },
  {
    name: "passive vs spitter",
    eval: passive("(e) => e.type === 'spit'", 10, 30),
  },
  {
    name: "passive vs warden",
    eval: passive("(e) => e.type === 'warden'", 8, 40),
  },
];
