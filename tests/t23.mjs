// D enemies: the behaviour hooks. Run with: SCRIPT=$PWD/tests/t23.mjs node test.mjs smoke
const step = (name, body) => ({ name, eval: `(() => { const { G, cam } = DF; G.manual = true; ${body} })()` });
// cave 99, every enemy gone, one husk 4 m in front of the player and facing them
const arena = (name, body) => step(name, `DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player, w = G.world;
  G.enemies = []; const e = DF.makeEnemy({ type: "husk", x: p.x, z: p.z + 4, yaw: Math.PI, node: -1 }); w.resolve(e, e.r); G.enemies.push(e);
  if (w.fieldAt(e.x, e.z) < 1) return { pass: false, why: "arena not open floor" };
  const keep = () => { p.hp = p.maxHp; p.stam = p.maxStam; };
  const clear = () => { delete DF.EBEH.__t; delete DF.EDEF.__k; };
  ${body}`);
export default [
  step("a type with no hooks has no entry", `return { pass: DF.EBEH && DF.EBEH.husk === undefined && DF.EBEH.brute === undefined && DF.EBEH.spitter === undefined && DF.EBEH.warden === undefined && typeof DF.EFIG === "object" && typeof DF.EPOSE === "object" };`),
  arena("step, chase and death hooks are called", `const n = { s: 0, c: 0, d: 0 };
    DF.EBEH.__t = { step() { n.s++; return false; }, chase() { n.c++; return false; }, death() { n.d++; } };
    e.type = "__t"; DF.alertE(e, true); DF.sim(1, keep); DF.kill(e); clear();
    return { pass: n.s > 30 && n.c > 0 && n.d === 1, n };`),
  arena("step returning true skips the state switch", `DF.EBEH.__t = { step() { return true; } };
    e.type = "__t"; DF.alertE(e, true); const x = e.x, z = e.z; let wind = false;
    DF.sim(2, () => { keep(); if (e.state === "wind") wind = true; });
    const d = Math.hypot(e.x - x, e.z - z); clear();
    return { pass: !wind && d < 0.05, wind, d };`),
  arena("canAttack false starts no attack and takes no token", `DF.EBEH.__t = { canAttack: () => false };
    e.type = "__t"; DF.alertE(e, true); e.x = p.x + Math.sin(0.3) * 1.5; e.z = p.z + Math.cos(0.3) * 1.5; w.resolve(e, e.r); e.cd = 0;
    let wind = false, tok = false;
    DF.sim(3, () => { keep(); if (e.state === "wind") wind = true; if (e.token) tok = true; });
    delete DF.EBEH.__t; e.type = "husk";
    let wind2 = false; DF.sim(3, () => { keep(); if (e.state === "wind") wind2 = true; });
    return { pass: !wind && !tok && wind2, wind, tok, wind2 };`),
  arena("canAttack false stops a ranged shot too", `const sp = DF.makeEnemy({ type: "spit", x: p.x, z: p.z + 8, yaw: Math.PI, node: -1 }); w.resolve(sp, sp.r); G.enemies = [sp];
    if (w.fieldAt(sp.x, sp.z) < 1) return { pass: false, why: "no floor" };
    DF.EBEH.__t = { canAttack: () => false }; sp.type = "__t"; DF.alertE(sp, true); sp.cd = 0; p.yaw = 0;
    let wind = false; DF.sim(3, () => { keep(); sp.cd = 0; if (sp.state === "wind") wind = true; });
    delete DF.EBEH.__t; sp.type = "spit"; let wind2 = false;
    DF.sim(4, () => { keep(); if (sp.state === "wind") wind2 = true; });
    return { pass: !wind && wind2, wind, wind2 };`),
  arena("wind and act hooks run for an unknown kind", `DF.EDEF.__k = { ...DF.EDEF.husk, atks: { zap: { style: "cast", kind: "zap", wind: 0.2, act: 0.3, rec: 0.2, trig: 10, dmg: 1, post: 0, reach: 1, arc: 1 } } };
    const z = DF.makeEnemy({ type: "__k", x: e.x, z: e.z, yaw: Math.PI, node: -1 }); G.enemies = [z]; z.x = e.x; z.z = e.z;
    const n = { w: 0, a: 0 }; let rec = false;
    DF.EBEH.__k = { wind() { n.w++; }, act() { n.a++; } };
    DF.alertE(z, true); DF.sim(3, () => { keep(); if (z.state === "rec") rec = true; });
    delete DF.EBEH.__k; clear();
    return { pass: n.w >= 1 && n.a >= 15 * n.w && rec, n, rec };`),
  arena("a hit hook can refuse a hit", `const hp = e.def.hp; DF.EBEH.__t = { hit: () => ({ dmg: 0, post: 0, blocked: true }) };
    e.type = "__t"; DF.hitEnemy(e, 30, 10, { src: "melee" }); const kept = e.hp === hp && e.state !== "hit" && e.kx === 0;
    delete DF.EBEH.__t; e.type = "husk"; DF.hitEnemy(e, 30, 10, { src: "melee" });
    return { pass: kept && e.hp < hp, kept, hp: e.hp };`),
  arena("a blocked hit still adds posture and can stagger", `DF.EBEH.__t = { hit: () => ({ dmg: 0, post: 1000, blocked: true }) };
    e.type = "__t"; DF.hitEnemy(e, 30, 10, { src: "melee" }); clear();
    return { pass: e.hp === e.def.hp && e.state === "stagger" && e.aware };`),
  arena("a hit hook can change damage and posture", `const hp = e.def.hp; DF.EBEH.__t = { hit: () => ({ dmg: 1, post: 0 }) };
    e.type = "__t"; DF.alertE(e, true); DF.hitEnemy(e, 30, 10, { src: "melee" }); clear();
    return { pass: Math.abs(e.hp - (hp - 1)) < 1e-6 && e.posture === 0, hp: e.hp, post: e.posture };`),
  arena("a foot hook keeps a body on its footing", `const X = e.x + 1; DF.EBEH.__t = { foot: (q, x) => x < X };
    e.type = "__t"; const out = {};
    DF.eStep(e, 1, 0, 4, 1); out.step = e.x;
    e.kx = 40; DF.sim(0.3, keep); out.kick = e.x;
    const o = DF.makeEnemy({ type: "husk", x: X - 0.45, z: e.z, yaw: 0, node: -1 }); G.enemies.push(o);
    e.x = X - 0.05; DF.separate(); out.sep = e.x; DF.sim(0.1, keep); out.after = e.x;
    out.refuse = DF.footOk(e, X + 1, e.z); out.allow = DF.footOk(e, X - 1, e.z);
    clear(); out.plain = DF.footOk(o, 1e6, 1e6);
    return { pass: out.step < X && out.kick < X && out.sep >= X && out.after < X && out.refuse === false && out.allow === true && out.plain === true, out };`),
  arena("eStep slides along an axis a foot hook allows", `DF.EBEH.__t = { foot: (q, x, z) => z < e.z + 0.001 }; e.type = "__t";
    const x = e.x, z = e.z; DF.eStep(e, 0.6, 0.8, 4, 0.1); clear();
    return { pass: Math.abs(e.x - (x + 0.24)) < 1e-6 && e.z === z && e.speed > 0 && e.speed < 4, x: e.x, z: e.z, sp: e.speed };`),
  arena("hurtPlayer uses an attack's kb", `p.state = "free"; p.iframe = 0; p.kx = p.kz = 0;
    const r = DF.hurtPlayer(5, e, { dmg: 5, kb: 20 }); const k = Math.hypot(p.kx, p.kz);
    p.state = "free"; p.iframe = 0; p.kx = p.kz = 0; DF.hurtPlayer(5, e, { dmg: 5 }); const k2 = Math.hypot(p.kx, p.kz);
    return { pass: Math.abs(k - 20) < 0.01 && Math.abs(k2 - 7) < 0.01, r, k, k2 };`),
  arena("a shot passes its start to a hit hook", `const seen = {}; DF.EBEH.__t = { hit(q, d, po, o) { seen.sx = o.sx; seen.sz = o.sz; seen.ex = q.x; seen.ez = q.z; return null; } };
    e.type = "__t"; G.projs.push({ x: e.x - 1, y: 1, z: e.z, vx: 20, vz: 0, life: 1, own: "p", dmg: 5, post: 0, kind: "bolt", c: [1, 1, 1] });
    DF.sim(0.2, keep); clear();
    return { pass: typeof seen.sx === "number" && seen.sx < seen.ex - 1 && Math.abs(seen.sz - seen.ez) < 0.2, seen };`),
];
