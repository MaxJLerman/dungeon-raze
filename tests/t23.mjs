// D enemies: the behaviour hooks. Run with: SCRIPT=$PWD/tests/t23.mjs node test.mjs smoke
const step = (name, body) => ({ name, eval: `(() => { const { G, cam } = DF; G.manual = true; ${body} })()` });
// cave 99, every enemy gone, one enemy of the given type `dist` m in front of the player and facing them
const arenaOf = (type, dist, name, body) => step(name, `DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player, w = G.world;
  G.enemies = []; const e = DF.makeEnemy({ type: "${type}", x: p.x, z: p.z + ${dist}, yaw: Math.PI, node: -1 }); w.resolve(e, e.r); G.enemies.push(e);
  // straight ahead if that is floor, else the first heading round the player with floor and a clear line
  if (w.fieldAt(e.x, e.z) < 1) for (let a = 0.4; a < 6.3; a += 0.4) { const x = p.x + Math.sin(a) * ${dist}, z = p.z + Math.cos(a) * ${dist};
    if (w.fieldAt(x, z) >= 1 && w.los(p.x, p.z, x, z)) { e.x = x; e.z = z; e.yaw = Math.atan2(p.x - x, p.z - z); e.hx = x; e.hz = z; e.hyaw = e.yaw; break; } }
  if (w.fieldAt(e.x, e.z) < 1) return { pass: false, why: "arena not open floor" };
  const keep = () => { p.hp = p.maxHp; p.stam = p.maxStam; };
  const clear = () => { delete DF.EBEH.__t; delete DF.EDEF.__k; };
  ${body}`);
const arena = (name, body) => arenaOf("husk", 4, name, body);
// a lone enemy 2.6 m in front of a low camera, three-quarters on, for looking at. The camera
// distance is shortened for the shot and put back by the step that follows.
const view = (type, name, body, shot) => [
  { ...step(name, `window.__cd0 = window.__cd0 || cam.dist; DF.newRun(99); DF.show("play"); G.state = "play"; const p = G.player, w = G.world;
  G.enemies = []; const cy = 3.5, fx = Math.sin(cy), fz = Math.cos(cy), pit = 0.55;
  p.yaw = cam.yaw = cy; cam.pitch = pit; cam.dist = 0.6; cam.cd = 0.6; cam.px = p.x; cam.pz = p.z;
  const ex = p.x + (-fz) * 0.6 + fx * (2.6 - Math.cos(pit) * 0.6), ez = p.z + fx * 0.6 + fz * (2.6 - Math.cos(pit) * 0.6);
  const e = DF.makeEnemy({ type: "${type}", x: ex, z: ez, yaw: cy - 1.0, node: -1 }); G.enemies.push(e); e.aware = true;
  p.fig.root.s = [0.0001, 0.0001, 0.0001];
  ${body}`), wait: 400, shot },
  step("the camera and the player are put back", `cam.dist = window.__cd0; DF.newRun(99); return { pass: true };`),
];
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
    DF.alertE(z, true); DF.sim(4, () => { keep(); if (z.state === "rec") { rec = true; return false; } });
    delete DF.EBEH.__k; clear();
    return { pass: n.w === 1 && n.a >= 15 && n.a <= 25 && rec, n, rec };`),
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
  arenaOf("rat", 1.2, "a rat cannot attack while swimming", `DF.alertE(e, true); e.cd = 0; const sw = new Set(), dr = new Set();
    w.waterAt = () => 1; DF.sim(4, () => { keep(); sw.add(e.state); });
    w.waterAt = () => 0; e.cd = 0; DF.sim(4, () => { keep(); dr.add(e.state); });
    return { pass: !sw.has("wind") && dr.has("wind"), sw: [...sw], dr: [...dr] };`),
  arenaOf("rat", 1.2, "a rat attacks at a shore reading of 0.5, not above", `DF.alertE(e, true); e.cd = 0; const seen = (v) => { const s = new Set(); e.cd = 0; w.waterAt = () => v; DF.sim(4, () => { keep(); s.add(e.state); }); return s.has("wind"); };
    const at = seen(0.5), above = seen(0.51);
    return { pass: at && !above, at, above };`),
  step("a rat outpaces the player in water", `const best = Math.max(...Object.values(DF.CLASSES).map((c) => c.run)) * DF.WATER.slow, rat = DF.EDEF.rat.speed * DF.wadeOf(DF.EDEF.rat);
    return { pass: rat > best, rat, best };`),
  arenaOf("rat", 3, "the rat's body", `const f = e.fig; const out = {};
    const finite = () => { let ok = true; (function rec(n) { for (const v of [...n.p, ...n.r, ...n.s]) if (!Number.isFinite(v)) ok = false; n.ch.forEach(rec); })(f.root); return ok; };
    let threw = null, finiteAll = true;
    for (const wet of [0, 1]) { w.waterAt = () => wet;
      for (const st of ["idle", "alert", "chase", "search", "wind", "act", "rec", "hit", "recoil", "stagger", "roar", "return", "dead"]) {
        e.state = st; e.t = 0.2; e.atk = e.def.atks.pounce; e.speed = 3; e.walk = 1.3;
        try { DF.poseEnemy(e); if (!finite()) finiteAll = false; } catch (x) { threw = st + " " + wet + " " + x.message; } } }
    return { pass: !!DF.EFIG.rat && Array.isArray(f.rim) && Array.isArray(f.eye) && threw === null && finiteAll, threw, finiteAll, rim: f.rim, eye: f.eye };`),
  ...view("rat", "a rat running, for looking at", `e.state = "chase"; e.speed = e.def.speed; e.walk = 1.1; return { pass: true };`, "t23-rat"),
  ...view("rat", "a rat rearing half way through its wind-up, for looking at", `e.atk = e.def.atks.bite; e.state = "wind"; e.t = e.atk.wind * 0.5; return { pass: true };`, "t23-rat-rear"),
  ...view("rat", "a rat swimming, for looking at", `w.waterAt = () => 1; e.state = "chase"; e.speed = 4; e.walk = 1.1; return { pass: true };`, "t23-rat-swim"),
  // the same swim in a real pool of the sewer, where the water is drawn
  { ...step("a rat swimming in a sewer pool, for looking at", `window.__cd0 = window.__cd0 || cam.dist; DF.LIVE_GRADES.add("D"); DF.newRun(5, "D"); DF.show("play"); G.state = "play"; DF.LIVE_GRADES.delete("D");
  const p = G.player, w = G.world; G.enemies = [];
  let at = null; for (let x = -200; x < 200 && !at; x += 1) for (let z = -200; z < 200; z += 1) if (w.waterAt(x, z) === 1 && w.waterAt(x + 2, z) === 1 && w.waterAt(x - 2, z) === 1 && w.waterAt(x, z + 2) === 1 && w.waterAt(x, z - 2) === 1 && w.waterAt(x + 4, z - 4) === 1 && w.fieldAt(x, z) > 2) { at = { x, z }; break; }
  if (!at) return { pass: false, why: "no pool" };
  const cy = 1.2, pit = 0.55, fx = Math.sin(cy), fz = Math.cos(cy);
  p.x = at.x - fx * 2.6 + fz * 0.6; p.z = at.z - fz * 2.6 - fx * 0.6;
  p.yaw = cam.yaw = cy; cam.pitch = pit; cam.dist = 0.6; cam.cd = 0.6; cam.px = p.x; cam.pz = p.z;
  const e = DF.makeEnemy({ type: "rat", x: at.x, z: at.z, yaw: cy - 1.0, node: -1 }); G.enemies.push(e); e.aware = true; e.state = "chase"; e.speed = 4; e.walk = 1.1;
  p.fig.root.s = [0.0001, 0.0001, 0.0001];
  return { pass: w.waterAt(e.x, e.z) === 1, at }; `), wait: 500, shot: "t23-rat-swim-sewer" },
  // ---- the drowned ----
  arenaOf("drowned", 4, "front hits do nothing to the drowned", `const hp = e.def.hp, p0 = e.posture;
    DF.hitEnemy(e, 20, 10, { src: "melee" });
    return { pass: e.hp === 90 && hp === 90 && Math.abs(e.posture - p0 - 2.5) < 1e-6 && e.state !== "hit", hp: e.hp, post: e.posture };`),
  arenaOf("drowned", 4, "a front heavy deals its full posture", `const p0 = e.posture;
    DF.hitEnemy(e, 20, 10, { src: "melee", heavy: true });
    return { pass: e.hp === 90 && Math.abs(e.posture - p0 - 10) < 1e-6, hp: e.hp, post: e.posture };`),
  arenaOf("drowned", 4, "front heavies break it into a stagger", `let n = 0, hpOk = true;
    while (e.state !== "stagger" && n < 8) { DF.hitEnemy(e, 20, 20, { src: "melee", heavy: true }); n++; if (e.state !== "stagger" && e.hp !== 90) hpOk = false; }
    return { pass: e.state === "stagger" && n <= 4 && hpOk && e.hp === 90, n, hp: e.hp, st: e.state };`),
  arenaOf("drowned", 4, "side and back hits land", `const out = {};
    const at = (ang, d) => { e.state = "idle"; e.hp = 90; e.yaw = Math.PI; p.x = e.x + Math.sin(Math.PI + ang) * d; p.z = e.z + Math.cos(Math.PI + ang) * d; };
    at(Math.PI, 3); DF.hitEnemy(e, 20, 10, { src: "melee" }); out.back = e.hp;
    at(Math.PI / 2, 3); DF.hitEnemy(e, 20, 10, { src: "melee" }); out.side = e.hp;
    at(-Math.PI / 2, 3); DF.hitEnemy(e, 20, 10, { src: "melee" }); out.side2 = e.hp;
    return { pass: out.back < 90 && out.side < 90 && out.side2 < 90, out };`),
  arenaOf("drowned", 4, "every pellet from the front is stopped", `const pz = { sx: e.x + Math.sin(e.yaw) * 1, sz: e.z + Math.cos(e.yaw) * 1 };
    for (let i = 0; i < 5; i++) DF.hitEnemy(e, 8, 4, { src: "pellet", ...pz });
    return { pass: e.hp === 90, hp: e.hp };`),
  arenaOf("drowned", 4, "blasts and executions go round the cover", `const out = {};
    DF.hitEnemy(e, 20, 10, { src: "aoe", fx: e.x + Math.sin(e.yaw) * 2, fz: e.z + Math.cos(e.yaw) * 2 }); out.aoe = e.hp;
    e.hp = 90; DF.stagger(e); DF.hitEnemy(e, 20, 10, { src: "exec", heavy: true }); out.exec = e.hp;
    return { pass: out.aoe < 90 && out.exec < 90, out };`),
  arenaOf("drowned", 4, "the bash shoves the player", `p.state = "free"; p.iframe = 0; p.kx = p.kz = 0;
    DF.hurtPlayer(12, e, DF.EDEF.drowned.atks.bash); const k = Math.hypot(p.kx, p.kz);
    return { pass: Math.abs(k - 14) < 0.01, k };`),
  arenaOf("drowned", 3, "the drowned's body", `const f = e.fig; const out = {};
    const finite = () => { let ok = true; (function rec(n) { for (const v of [...n.p, ...n.r, ...n.s]) if (!Number.isFinite(v)) ok = false; n.ch.forEach(rec); })(f.root); return ok; };
    let threw = null, finiteAll = true;
    for (const st of ["idle", "alert", "chase", "search", "wind", "act", "rec", "hit", "recoil", "stagger", "roar", "return", "dead"]) for (const an of ["bash", "edge"]) {
      e.state = st; e.t = 0.2; e.atk = e.def.atks[an]; e.speed = 2; e.walk = 1.3;
      try { DF.poseEnemy(e); if (!finite()) finiteAll = false; } catch (x) { threw = st + " " + x.message; } }
    return { pass: !!DF.EFIG.drowned && !!DF.EPOSE.drowned && Array.isArray(f.rim) && Array.isArray(f.eye) && threw === null && finiteAll, threw, finiteAll };`),
  ...view("drowned", "a drowned with its cover up, for looking at", `cam.pitch = 0.12; e.yaw = cy + Math.PI - 0.45; e.x += fx * 1.2; e.z += fz * 1.2; e.state = "chase"; e.speed = e.def.speed; e.walk = 1.1; return { pass: true };`, "t23-drowned"),
  // ---- the brood mother ----
  arenaOf("brood", 9, "she sends out rats, at most four at once", `if (!w.los(e.x, e.z, p.x, p.z)) return { pass: false, why: "no sight" };
    DF.alertE(e, true); let max = 0;
    DF.sim(40, () => { keep(); const n = G.enemies.filter((o) => o.mom === e && !o.dead).length; max = Math.max(max, n); });
    const kids = G.enemies.filter((o) => o.mom === e);
    return { pass: max === 4 && kids.every((o) => o.type === "rat" && o.born === true && o.node === e.node && o.aware), max, kids: kids.length };`),
  arenaOf("brood", 9, "she sends the first rat three seconds into a hunt and the next six later", `DF.alertE(e, true); const at = [];
    let t = 0; DF.sim(16, () => { keep(); t += 1 / 60; const n = G.enemies.filter((o) => o.mom === e).length; if (n > at.length) at.push(+t.toFixed(1)); });
    return { pass: at.length === 3 && Math.abs(at[0] - 3.4) < 0.9 && Math.abs(at[1] - at[0] - 6) < 0.3 && Math.abs(at[2] - at[1] - 6) < 0.3, at };`),
  arenaOf("brood", 9, "a sent-out rat is born behind her, away from the player", `DF.alertE(e, true); let r = null;
    DF.sim(8, () => { keep(); r = G.enemies.find((o) => o.mom === e); if (r) return false; });
    if (!r) return { pass: false, why: "no rat" };
    const k = ((r.x - e.x) * (p.x - e.x) + (r.z - e.z) * (p.z - e.z)) / (Math.hypot(r.x - e.x, r.z - e.z) * Math.hypot(p.x - e.x, p.z - e.z) || 1);
    return { pass: k < 0 && Math.hypot(r.x - e.x, r.z - e.z) < 3, k, d: Math.hypot(r.x - e.x, r.z - e.z) };`),
  arenaOf("brood", 9, "she stops when she dies", `DF.alertE(e, true); DF.sim(40, keep);
    const before = G.enemies.filter((o) => o.mom === e).length; DF.kill(e);
    DF.sim(12, keep); const after = G.enemies.filter((o) => o.mom === e).length;
    return { pass: before > 0 && after === before, before, after };`),
  arenaOf("brood", 9, "her rats give no tool charge and less focus", `const mk = (born) => { const r = DF.makeEnemy({ type: "rat", x: p.x + 2, z: p.z + 2, yaw: 0, node: -1 }); r.mom = e; r.born = born; G.enemies.push(r); return r; };
    let toolBorn = 0, focusOk = true;
    for (let i = 0; i < 40; i++) { p.tool = 0; p.focus = 0; DF.kill(mk(true)); toolBorn += p.tool; if (p.focus !== DF.BROOD.focus) focusOk = false; }
    let toolPlain = 0, plainFocus = 0;
    for (let i = 0; i < 40; i++) { p.tool = 0; p.focus = 0; DF.kill(mk(undefined)); toolPlain += p.tool; plainFocus = p.focus; }
    return { pass: toolBorn === 0 && focusOk && toolPlain > 0 && plainFocus === 6 && DF.BROOD.focus === 2, toolBorn, focusOk, toolPlain, plainFocus };`),
  arenaOf("brood", 9, "she keeps her distance", `DF.alertE(e, true); e.cd = 0; let wind = false;
    // the player walks toward her from 9 m to 5 m over 2 s
    const px = p.x, pz = p.z; e.x = px; e.z = pz + 9; w.resolve(e, e.r); e.state = "chase"; e.birthT = 0;
    const ex = e.x, ez = e.z, dir = Math.atan2(ex - px, ez - pz);
    for (let i = 0; i < 120; i++) { const d = 9 - 4 * ((i + 1) / 120); p.x = ex - Math.sin(dir) * d; p.z = ez - Math.cos(dir) * d; keep(); DF.sim(1 / 60); if (e.state === "wind") wind = true; }
    const dist = Math.hypot(e.x - p.x, e.z - p.z);
    return { pass: dist > DF.BROOD.close && !wind && DF.BROOD.close === 3 && DF.BROOD.keep === 7, dist, wind };`),
  arenaOf("brood", 5, "she backs away from a player inside her keep distance", `DF.alertE(e, true); e.cd = 5; DF.sim(0.2, keep); const d0 = Math.hypot(e.x - p.x, e.z - p.z); let wind = false;
    DF.sim(1.5, () => { keep(); if (e.state === "wind") wind = true; });
    const d1 = Math.hypot(e.x - p.x, e.z - p.z);
    return { pass: d1 > d0 + 0.8 && !wind, d0, d1 };`),
  arenaOf("brood", 9, "a brood mother sends rats while the hook conditions hold (control)", `DF.alertE(e, true); e.birthT = DF.BROOD.every - 0.1;
    DF.sim(1, keep); const n = G.enemies.filter((o) => o.mom === e).length;
    return { pass: n === 1, n };`),
  arenaOf("brood", 9, "she sends nothing while staggered", `DF.alertE(e, true); e.birthT = DF.BROOD.every - 0.1; DF.stagger(e); e.dur = 3;
    DF.sim(1, keep); const n = G.enemies.filter((o) => o.mom === e).length;
    return { pass: n === 0 && e.state === "stagger", n, st: e.state };`),
  arenaOf("brood", 9, "she sends nothing while falling", `DF.alertE(e, true); e.birthT = DF.BROOD.every - 0.1; e.state = "fall"; e.vy = 0; e.y = 6;
    DF.sim(1, keep); const n = G.enemies.filter((o) => o.mom === e).length;
    return { pass: n === 0, n };`),
  arenaOf("brood", 9, "she sends nothing under the boss rule", `// the hook on its own, in a state and awake where it would send
    DF.alertE(e, true); e.state = "chase"; e.birthT = DF.BROOD.every - 0.1; G.inBoss = true;
    const c = { p, w, dx: p.x - e.x, dz: p.z - e.z, dist: Math.hypot(p.x - e.x, p.z - e.z), toP: 0, alive: true };
    DF.EBEH.brood.step(e, 0.2, c); const direct = G.enemies.filter((o) => o.mom === e).length;
    G.inBoss = false; DF.EBEH.brood.step(e, 0.2, c); const control = G.enemies.filter((o) => o.mom === e).length;
    // and in the run, with the player in a chamber that holds the whole arena
    e.birthT = DF.BROOD.every - 0.1; w.boss = { x: p.x, z: p.z, r: 40 };
    DF.sim(1, keep); const n = G.enemies.filter((o) => o.mom === e).length - control; G.inBoss = false;
    return { pass: direct === 0 && control === 1 && n === 0, direct, control, n };`),
  arenaOf("brood", 9, "an unaware brood mother sends nothing", `e.birthT = DF.BROOD.every - 0.1; e.state = "idle"; e.aware = false; p.x += 60;
    DF.sim(1, () => { keep(); e.aware = false; }); const n = G.enemies.filter((o) => o.mom === e).length;
    return { pass: n === 0, n };`),
  arenaOf("brood", 9, "a respawn clears her rats", `DF.alertE(e, true); DF.sim(10, keep);
    const had = G.enemies.filter((o) => o.mom === e).length;
    const s = { type: "brood", x: e.hx, z: e.hz, yaw: e.hyaw, node: -1 }; w.spawns = [s];
    DF.respawn(); DF.sim(0.1);
    const mothers = G.enemies.filter((o) => o.type === "brood");
    return { pass: had >= 1 && !G.enemies.some((o) => o.born || o.mom) && mothers.length === 1 && mothers[0].birthT === DF.BROOD.every - DF.BROOD.first, had, birthT: mothers[0] && mothers[0].birthT };`),
  arenaOf("brood", 9, "her rats share her post", `DF.alertE(e, true); let r = null;
    DF.sim(8, () => { keep(); r = G.enemies.find((o) => o.mom === e); if (r) return false; });
    if (!r) return { pass: false, why: "no rat" };
    const same = r.hx === e.hx && r.hz === e.hz && r.hyaw === e.hyaw;
    let far = null; for (let x = -150; x <= 150 && !far; x += 3) for (let z = -150; z <= 150; z += 3) if (Math.hypot(x - p.x, z - p.z) > 85 && w.fieldAt(x, z) > 1.5) { far = { x, z }; break; }
    if (!far) return { pass: false, why: "no far floor" };
    p.x = far.x; p.z = far.z; DF.sim(20, keep);
    const d = Math.hypot(r.x - e.hx, r.z - e.hz);
    return { pass: same && d < 3, same, d };`),
  arenaOf("brood", 3, "the brood mother's body", `const f = e.fig; const out = {};
    const finite = () => { let ok = true; (function rec(n) { for (const v of [...n.p, ...n.r, ...n.s]) if (!Number.isFinite(v)) ok = false; n.ch.forEach(rec); })(f.root); return ok; };
    let threw = null, finiteAll = true;
    for (const wet of [0, 1]) { w.waterAt = () => wet;
      for (const st of ["idle", "alert", "chase", "search", "wind", "act", "rec", "hit", "recoil", "stagger", "roar", "return", "dead"]) {
        e.state = st; e.t = 0.2; e.atk = e.def.atks.bite; e.speed = 3; e.walk = 1.3;
        try { DF.poseEnemy(e); if (!finite()) finiteAll = false; } catch (x) { threw = st + " " + wet + " " + x.message; } } }
    w.waterAt = () => 0; e.state = "chase";
    e.birthAt = G.t; DF.poseEnemy(e); const hot = f.sac.em[0] - f.sac.em0[0];
    e.birthAt = G.t - 9; DF.poseEnemy(e); const cool = f.sac.em[0] - f.sac.em0[0];
    const rat = DF.makeEnemy({ type: "rat", x: 0, z: 0, yaw: 0, node: -1 });
    return { pass: !!DF.EFIG.brood && !!DF.EPOSE.brood && Array.isArray(f.rim) && Array.isArray(f.eye) && threw === null && finiteAll && hot > 0.15 && hot > cool + 0.1 && f.o.sc > rat.fig.o.sc * 1.3, threw, finiteAll, hot, cool, sc: f.o.sc, rsc: rat.fig.o.sc };`),
  ...view("brood", "a brood mother with two rats beside her, for looking at", `e.x += fx * 1.4; e.z += fz * 1.4; e.yaw = cy + Math.PI - 1.3; e.state = "chase"; e.speed = 0; e.walk = 1.1;
    for (const s of [-1, 1]) { const r = DF.makeEnemy({ type: "rat", x: e.x + (-fz) * s * 2.3 - fx * 0.8, z: e.z + fx * s * 2.3 - fz * 0.8, yaw: e.yaw + s * 0.3, node: -1 }); r.state = "chase"; r.aware = true; r.speed = 0; r.walk = 0.4 + s; G.enemies.push(r); }
    return { pass: true };`, "t23-brood"),
  step("the camera is put back", `cam.dist = window.__cd0; DF.newRun(99); return { pass: true };`),
];
