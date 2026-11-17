// Touch controls under device emulation, one device at a time.
// Run with: DEVICE=pixel-9 SCRIPT=$PWD/tests/t14.mjs node test.mjs smoke
// or on every device: node tests/touch-all.mjs tests/t14.mjs
// Every step returns an object with a boolean `pass`.
const step = (name, body) => ({
  name,
  eval: `(async () => { const { G, cam, TOUCH } = DF; G.manual = true;
  const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const pts = new Map();
  const send = (type) => __touch(type, [...pts].map(([id, p]) => ({ id, x: p.x, y: p.y })));
  const T = {
    down: async (id, x, y) => { pts.set(id, { x, y }); await send("touchStart"); },
    move: async (id, x, y) => { pts.set(id, { x, y }); await send("touchMove"); },
    up: async (id) => { const p = pts.get(id); pts.delete(id); await __touch("touchEnd", [{ id, x: p.x, y: p.y }]); },
    cancel: async () => { pts.clear(); await __touch("touchCancel", []); },
  };
  const L = () => TOUCH.layout;
  const btn = (act) => L().btns.find((b) => b.act === act);
  const play = () => { DF.newRun(99); DF.show("play"); TOUCH.release(); for (const k in DF.taps) DF.taps[k] = false; };
  ${body} })()`,
});

export default [
  step("touch mode on a phone", `
    play(); await draw();
    const el = document.getElementById("touch");
    const polys = el.querySelectorAll("svg polygon.hex");
    const c = {
      on: TOUCH.on === true,
      bodyClass: document.body.classList.contains("touch"),
      shown: getComputedStyle(el).display !== "none",
      hexes: polys.length === 8,
      pause: !!el.querySelector(".pause"),
    };
    return { pass: Object.values(c).every((v) => v === true), ...c, n: polys.length };`),
  step("overlay matches the layout", `
    play(); await draw();
    const el = document.getElementById("touch");
    const out = [];
    for (const b of L().btns) {
      const poly = el.querySelector('polygon.hex[data-act="' + b.act + '"]');
      if (!poly) { out.push(b.act + " missing"); continue; }
      const r = poly.getBoundingClientRect();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      if (Math.abs(cx - b.x) > 1 || Math.abs(cy - b.y) > 1 || Math.abs(r.width - b.d) > 1)
        out.push(b.act + " " + [cx, cy, r.width].map((v) => v.toFixed(1)).join(","));
    }
    return { pass: out.length === 0, bad: out };`),
  step("hud sits in its boxes", `
    play(); await draw();
    const boss = document.getElementById("boss");
    const prev = boss.style.display;
    boss.style.display = "flex";
    await draw();
    const within = (id, B) => {
      const e = document.getElementById(id), r = e.getBoundingClientRect();
      return Math.abs(r.x - B.x) <= 1 && Math.abs(r.y - B.y) <= 1 &&
        Math.abs(r.width - B.w) <= 1 && Math.abs(r.height - B.h) <= 1;
    };
    // the content must fit in the box too, not just the box be placed
    const fits = (id) => { const e = document.getElementById(id); return e.scrollHeight <= e.clientHeight + 1; };
    const c = {
      vitals: within("vitals", L().vitals),
      map: within("map", L().map),
      boss: within("boss", L().boss),
      vitalsFit: fits("vitals"),
      bossFit: fits("boss"),
      hint: getComputedStyle(document.getElementById("hint")).display === "none",
    };
    const m = { vitalsH: document.getElementById("vitals").scrollHeight, bossH: boss.scrollHeight };
    boss.style.display = prev;
    return { pass: Object.values(c).every((v) => v === true), ...c, ...m };`),
  step("layout passes on this device", `
    const probs = DF.layoutProblems(L());
    return { pass: probs.length === 0 && L().scale === 1, probs, scale: L().scale };`),
  step("fake insets are used", `
    const i = L().ins, w = window.__fakeInsets;
    const c = { l: i.l === w.l, r: i.r === w.r, t: i.t === w.t, b: i.b === w.b };
    return { pass: Object.values(c).every((v) => v === true), got: i, want: w };`),
  step("forced mode keeps the page visible", `
    const was = TOUCH.forced;
    TOUCH.forced = true; TOUCH.setOn(true);
    play(); await draw();
    const cs = getComputedStyle(document.body);
    const c = {
      bodyShown: cs.display !== "none",
      bodyColour: cs.color !== "rgb(255, 179, 71)",
      overlay: getComputedStyle(document.getElementById("touch")).display !== "none",
      readout: getComputedStyle(document.getElementById("treadout")).display !== "none",
    };
    TOUCH.forced = was; TOUCH.setOn(true); await draw();
    return { pass: Object.values(c).every((v) => v === true), ...c, display: cs.display, colour: cs.color };`),

  step("every button presses its action", `
    play(); await draw();
    const bad = [];
    for (const b of L().btns) {
      await T.down(1, b.x, b.y);
      if (!(DF.keys["T:" + b.act] && DF.taps["T:" + b.act])) bad.push(b.act + " down");
      await T.up(1);
      if (DF.keys["T:" + b.act]) bad.push(b.act + " stuck");
      for (const k in DF.taps) DF.taps[k] = false;
    }
    return { pass: bad.length === 0 && L().btns.length === 8, bad };`),
  step("attack attacks", `
    play(); await draw();
    const b = btn("light");
    await T.down(1, b.x, b.y); await T.up(1);
    DF.sim(0.05);
    return { pass: G.player.state === "attack", state: G.player.state };`),
  step("guard holds", `
    play(); await draw();
    const b = btn("guard");
    await T.down(1, b.x, b.y);
    DF.sim(0.3);
    const held = G.player.state;
    await T.up(1);
    DF.sim(0.3);
    return { pass: held === "guard" && G.player.state === "free", held, after: G.player.state };`),
  step("a gap presses nothing", `
    play(); await draw();
    const a = btn("dodge"), b = btn("guard");
    await T.down(1, (a.x + b.x) / 2, (a.y + b.y) / 2);
    // the browser numbers pointers itself, so take the only owner
    const owners = [...TOUCH.owners.values()];
    const any = Object.keys(DF.keys).filter((k) => k.startsWith("T:") && DF.keys[k]);
    await T.up(1);
    return { pass: any.length === 0 && owners.length === 1 && owners[0].kind === "look", any, kinds: owners.map((o) => o.kind) };`),
  step("sliding off keeps the button", `
    play(); await draw();
    const h = btn("heavy"), k = btn("lock");
    await T.down(1, h.x, h.y);
    await T.move(1, k.x, k.y);
    const c = { heavy: !!DF.keys["T:heavy"], lock: !!DF.keys["T:lock"] };
    await T.up(1);
    return { pass: c.heavy === true && c.lock === false, ...c };`),
  step("pause button pauses", `
    play(); await draw();
    const q = L().pause;
    await T.down(1, q.x + q.w / 2, q.y + q.h / 2);
    const early = G.state;
    await T.up(1);
    return { pass: early === "play" && G.state === "pause", early, state: G.state };`),
  step("a tap is not also a click", `
    play(); await draw();
    for (const k in DF.taps) DF.taps[k] = false;
    const b = btn("light");
    await T.down(1, b.x, b.y); await T.up(1);
    await new Promise((r) => setTimeout(r, 400));
    const c = { tap: !DF.taps.Mouse0, key: !DF.keys.Mouse0, lock: document.pointerLockElement === null };
    DF.sim(0.05);
    const p = G.player;
    c.attack = p.state === "attack";
    c.first = p.move === p.cls.chain;
    c.noQueue = p.buf == null;
    return { pass: Object.values(c).every((v) => v === true), ...c, move: p.move, buf: p.buf };`),
  step("relayout releases every finger", `
    play(); await draw();
    const g = btn("guard"), a = btn("light"), w0 = L().W;
    await T.down(1, g.x, g.y); await T.down(2, a.x, a.y);
    const before = TOUCH.owners.size;
    await __viewport(innerWidth - 20, innerHeight);
    await draw(); await draw();
    const held = Object.keys(DF.keys).filter((k) => k.startsWith("T:") && DF.keys[k]);
    const c = { before: before === 2, held: held.length === 0, owners: TOUCH.owners.size === 0, changed: L().W !== w0 };
    await T.cancel();
    await __viewport(w0, innerHeight);
    await draw(); await draw();
    return { pass: Object.values(c).every((v) => v === true), ...c, held };`),
  step("a cancelled finger releases its control", `
    play(); await draw();
    const g = btn("guard");
    await T.down(1, g.x, g.y);
    const was = !!DF.keys["T:guard"];
    await T.cancel();
    return { pass: was && !DF.keys["T:guard"] && TOUCH.owners.size === 0, was, now: DF.keys["T:guard"] };`),
  step("charges show on buttons", `
    play(); await draw();
    const p = G.player, el = document.getElementById("touch");
    const poly = (act) => el.querySelector('polygon.hex[data-act="' + act + '"]');
    const cnt = (act) => { const e = el.querySelector('.cnt[data-act="' + act + '"]'); return e ? e.textContent : null; };
    const empty = (act) => poly(act).classList.contains("empty");
    const c = {};
    p.flasks = 2; await draw();
    c.flaskCount = cnt("heal") === "2"; c.flaskFull = !empty("heal");
    p.flasks = 0; await draw();
    c.flaskEmpty = empty("heal");
    p.focus = 0; await draw();
    c.abilityEmpty = empty("special");
    p.focus = p.cls.special.cost; await draw();
    c.abilityReady = !empty("special");
    p.tool = 3; await draw();
    c.toolCount = cnt("tool") === "3"; c.toolFull = !empty("tool");
    p.tool = 0; await draw();
    c.toolEmpty = empty("tool");
    return { pass: Object.values(c).every((v) => v === true), ...c };`),
  step("leaving play clears touch state", `
    play(); await draw();
    const g = btn("guard");
    await T.down(1, g.x, g.y);
    DF.show("pause"); DF.show("play");
    const held = Object.keys(DF.keys).filter((k) => k.startsWith("T:") && DF.keys[k]);
    const c = { held: held.length === 0, owners: TOUCH.owners.size === 0, move: TOUCH.move.mag === 0 };
    await T.cancel();
    return { pass: Object.values(c).every((v) => v === true), ...c, held };`),

  // ---- stick, look, aim and flick ----
  step("small push walks slowly", `
    play(); await draw();
    const p = G.player, r = L().rest, R = L().R;
    await T.down(1, r.x, r.y);
    await T.move(1, r.x, r.y - R * 0.25);
    await T.move(1, r.x, r.y - R * 0.5);
    await draw();
    DF.sim(1);
    const v = Math.hypot(p.vx, p.vz) / p.cls.walk, mag = TOUCH.move.mag;
    await T.up(1);
    return { pass: v > 0.3 && v < 0.55, v, mag };`),
  step("full push runs", `
    play(); await draw();
    const p = G.player, r = L().rest, R = L().R;
    await T.down(1, r.x, r.y);
    await T.move(1, r.x, r.y - R * 0.5);
    await T.move(1, r.x, r.y - R);
    await draw();
    DF.sim(1);
    const v = Math.hypot(p.vx, p.vz) / p.cls.walk, sprint = p.sprint;
    await T.up(1);
    return { pass: v > 0.9 && v < 1.1 && !sprint, v, sprint };`),
  step("past the ring sprints", `
    play(); await draw();
    const p = G.player, r = L().rest, d = L().ring + 4;
    await T.down(1, r.x, r.y);
    await T.move(1, r.x, r.y - d / 2);
    await T.move(1, r.x, r.y - d);
    await draw();
    DF.sim(0.5);
    const c = { sprint: p.sprint === true, key: DF.keys["T:sprint"] === true };
    await T.up(1);
    c.keyOff = !DF.keys["T:sprint"];
    return { pass: Object.values(c).every((v) => v === true), ...c };`),
  step("lifting stops", `
    play(); await draw();
    const p = G.player, r = L().rest, R = L().R;
    await T.down(1, r.x, r.y);
    await T.move(1, r.x, r.y - R);
    await draw();
    DF.sim(0.5);
    const moving = Math.hypot(p.vx, p.vz) > 1;
    await T.up(1);
    DF.sim(0.5);
    const v = Math.hypot(p.vx, p.vz);
    return { pass: moving && v < 0.2 && TOUCH.move.mag === 0, moving, v, mag: TOUCH.move.mag };`),
  step("stick follows the thumb", `
    play(); await draw();
    const r = L().rest, x = r.x + 60, y = r.y;
    await T.down(1, x, y);
    const o = [...TOUCH.owners.values()].find((q) => q.kind === "move");
    await draw();
    const base = document.querySelector("#touch .stick-base");
    const c = {
      owner: !!o && Math.abs(o.x0 - x) < 0.01 && Math.abs(o.y0 - y) < 0.01,
      still: TOUCH.move.mag === 0,
      base: Math.abs(+base.getAttribute("cx") - x) < 1 && Math.abs(+base.getAttribute("cy") - y) < 1,
    };
    await T.move(1, x, y - L().R);
    await draw();
    const knob = document.querySelector("#touch .stick-knob");
    c.knob = !!knob && Math.abs(+knob.getAttribute("cy") - (y - L().R)) < 1;
    c.dir = TOUCH.move.y > 0.99 && Math.abs(TOUCH.move.x) < 0.01;
    await T.up(1);
    await draw();
    c.rest = Math.abs(+base.getAttribute("cx") - r.x) < 1 && Math.abs(+base.getAttribute("cy") - r.y) < 1;
    return { pass: Object.values(c).every((v) => v === true), ...c };`),
  step("camera drag turns", `
    play(); await draw();
    G.player.lock = null;
    const W = L().W, x = W * 0.5, y = L().H * 0.3, y0 = cam.yaw, p0 = cam.pitch;
    await T.down(1, x, y);
    const kind = [...TOUCH.owners.values()][0].kind;
    for (let i = 1; i <= 6; i++) await T.move(1, x + W * 0.25 * i / 6, y);
    await draw();
    const d = cam.yaw - y0, want = -Math.PI / 4 * DF.OPT.sens;
    await T.up(1);
    return { pass: kind === "look" && Math.abs(d - want) < Math.abs(want) * 0.1 && Math.abs(cam.pitch - p0) < 0.01, kind, d, want };`),
  step("three fingers at once", `
    play(); await draw();
    G.player.lock = null;
    const r = L().rest, R = L().R, W = L().W, a = btn("light"), x = W * 0.5, y = L().H * 0.3;
    await T.down(1, r.x, r.y);
    await T.move(1, r.x, r.y - R);
    await draw();
    await T.down(2, x, y);
    await T.down(3, a.x, a.y);
    const y0 = cam.yaw;
    for (let i = 1; i <= 4; i++) await T.move(2, x + W * 0.05 * i, y);
    await draw();
    const c = { stick: TOUCH.move.mag > 0.9, yaw: Math.abs(cam.yaw - y0) > 0.05, light: DF.keys["T:light"] === true };
    await T.up(2);
    c.stickKept = TOUCH.move.mag > 0.9;
    c.lightKept = DF.keys["T:light"] === true;
    await T.up(3); await T.up(1);
    return { pass: Object.values(c).every((v) => v === true), ...c };`),
  step("aim while attacking", `
    play(); await draw();
    G.player.lock = null;
    const a = btn("light"), W = L().W, dir = a.x + W * 0.2 < W - 2 ? 1 : -1, y0 = cam.yaw;
    await T.down(1, a.x, a.y);
    await T.move(1, a.x + dir * 4, a.y);
    await draw();
    const still = cam.yaw === y0;
    for (let i = 1; i <= 5; i++) await T.move(1, a.x + dir * W * 0.04 * i, a.y);
    await draw();
    const c = { still, yaw: Math.abs(cam.yaw - y0) > 0.1, held: DF.keys["T:light"] === true };
    await T.up(1);
    c.released = !DF.keys["T:light"];
    return { pass: Object.values(c).every((v) => v === true), ...c, d: cam.yaw - y0 };`),
  step("flick switches lock", `
    DF.newRun(99); DF.show("play"); TOUCH.release();
    const p = G.player, n = G.world.nodes.find((q) => q.kind === "room");
    const hs = G.enemies.filter((q) => q.type === "husk").slice(0, 2);
    for (const o of G.enemies) if (!hs.includes(o)) o.x += 1000;
    p.x = n.x; p.z = n.z - 2; p.yaw = 0; p.lock = null; cam.yaw = 0; cam.px = p.x; cam.pz = p.z;
    hs[0].x = p.x - 1.5; hs[1].x = p.x + 1.5;
    for (const h of hs) { h.z = p.z + 4; h.aware = false; h.state = "idle"; }
    await draw();
    const lk = btn("lock");
    await T.down(1, lk.x, lk.y); await T.up(1);
    DF.sim(1 / 60);
    const first = p.lock;
    const W = L().W, x = W * 0.5, y = L().H * 0.3;
    await T.down(2, x, y);
    // sent together, so the three moves are stamped within a few ms of each
    // other; awaiting each one waits on a frame and can take over 100 ms
    const fire = [];
    for (let i = 1; i <= 3; i++) { pts.set(2, { x: x + W * 0.1 * i / 3, y }); fire.push(send("touchMove")); }
    await Promise.all(fire);
    await draw();
    DF.sim(1 / 60);
    const second = p.lock;
    await T.up(2);
    const other = hs.find((h) => h !== first);
    return { pass: hs.length === 2 && !!first && hs.includes(first) && second === other && second !== first, hs: hs.length, first: !!first, switched: second === other };`),
  step("a slow drag does not flick", `
    DF.newRun(99); DF.show("play"); TOUCH.release();
    const p = G.player, n = G.world.nodes.find((q) => q.kind === "room");
    const hs = G.enemies.filter((q) => q.type === "husk").slice(0, 2);
    for (const o of G.enemies) if (!hs.includes(o)) o.x += 1000;
    p.x = n.x; p.z = n.z - 2; p.yaw = 0; p.lock = null; cam.yaw = 0; cam.px = p.x; cam.pz = p.z;
    hs[0].x = p.x - 1.5; hs[1].x = p.x + 1.5;
    for (const h of hs) { h.z = p.z + 4; h.aware = false; h.state = "idle"; }
    await draw();
    const lk = btn("lock");
    await T.down(1, lk.x, lk.y); await T.up(1);
    DF.sim(1 / 60);
    const first = p.lock;
    const W = L().W, x = W * 0.5, y = L().H * 0.3;
    await T.down(2, x, y);
    for (let i = 1; i <= 4; i++) { await T.move(2, x + W * 0.04 * i, y); await draw(); await new Promise((r) => setTimeout(r, 300)); }
    DF.sim(1 / 60);
    await T.up(2);
    return { pass: !!first && p.lock === first, same: p.lock === first };`),
  step("keyboard movement unchanged", `
    play(); await draw();
    const p = G.player;
    DF.keys[DF.BIND.fwd] = true;
    DF.sim(1);
    DF.keys[DF.BIND.fwd] = false;
    const v = Math.hypot(p.vx, p.vz) / p.cls.walk;
    return { pass: v > 0.9 && v < 1.1, v };`),
  step("controls screen shows touch settings", `
    DF.openMenu("controls"); await draw();
    const vis = (id) => getComputedStyle(document.getElementById(id)).display !== "none";
    const lab = document.querySelector('label[for="tnotch"]');
    const note = document.getElementById("tnotchNote");
    const c = {
      tset: vis("tset"),
      binds: !vis("binds"),
      label: !!lab && lab.textContent.trim() === "Keep controls clear of the notch and rounded corners",
      note: !!note && note.textContent.trim() === "Off can put buttons under the notch or a curved corner, where touches may not register.",
      size: !!document.getElementById("tsize"),
      opac: !!document.getElementById("topac"),
    };
    return { pass: Object.values(c).every((v) => v === true), ...c };`),
  step("size slider grows and is capped", `
    DF.openMenu("controls"); await draw();
    const set = async (v) => { const e = document.getElementById("tsize"); e.value = v; e.dispatchEvent(new Event("input", { bubbles: true })); await draw(); };
    const W = innerWidth, H = innerHeight;
    await set(1.2);
    const l = L(), sc = l.scale, probs = DF.layoutProblems(l);
    const up = sc + 0.05;
    const next = up > 1.2 + 1e-9 ? null : DF.touchLayout(W, H, l.ins, { size: up, notch: true }).scale;
    const c = {
      range: sc >= 1 - 1e-9 && sc <= 1.2 + 1e-9,
      fits: probs.length === 0,
      largest: up > 1.2 + 1e-9 || next < up - 1e-9,
    };
    if (W === 1376 && H === 1032) c.ipad = Math.abs(btn("light").d - 1.2 * 104) < 0.01;
    if (W === 756 && H === 308) c.pixel = sc < 1.2 - 1e-9 && sc >= 1 - 1e-9;
    await set(1);
    c.reset = L().scale === 1;
    return { pass: Object.values(c).every((v) => v === true), ...c, sc, probs, W, H };`),
  step("opacity slider", `
    DF.openMenu("controls"); await draw();
    const e = document.getElementById("topac");
    e.value = 0.3; e.dispatchEvent(new Event("input", { bubbles: true }));
    play(); await draw();
    const op = (act) => parseFloat(getComputedStyle(document.querySelector('.btn[data-act="' + act + '"]')).opacity);
    const idle = op("guard");
    const b = btn("light");
    await T.down(1, b.x, b.y); await draw();
    const held = op("light"), other = op("guard");
    await T.up(1); await draw();
    const after = op("light");
    DF.openMenu("controls"); await draw();
    e.value = 0.6; e.dispatchEvent(new Event("input", { bubbles: true }));
    const c = { idle: Math.abs(idle - 0.3) < 0.01, held: held === 1, other: Math.abs(other - 0.3) < 0.01, after: Math.abs(after - 0.3) < 0.01 };
    return { pass: Object.values(c).every((v) => v === true), ...c, idle, held, other, after };`),
  step("notch toggle moves controls by the insets", `
    DF.openMenu("controls"); await draw();
    TOUCH.fakeInsets = { l: 47, r: 47, t: 0, b: 21 }; TOUCH.relayout(); await draw();
    const a0 = { x: btn("light").x, y: btn("light").y };
    const cb = document.getElementById("tnotch");
    cb.checked = false; cb.dispatchEvent(new Event("change", { bubbles: true })); await draw();
    const a1 = { x: btn("light").x, y: btn("light").y };
    cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); await draw();
    const a2 = { x: btn("light").x, y: btn("light").y };
    TOUCH.fakeInsets = null; TOUCH.relayout();
    const c = {
      dx: Math.abs(a1.x - a0.x - 47) < 0.01,
      dy: Math.abs(a1.y - a0.y - 21) < 0.01,
      back: Math.abs(a2.x - a0.x) < 0.01 && Math.abs(a2.y - a0.y) < 0.01,
      on: DF.OPT.tnotch === true,
    };
    return { pass: Object.values(c).every((v) => v === true), ...c, a0, a1, a2 };`),
  step("settings persist", `
    DF.openMenu("controls"); await draw();
    const fire = (id, v, ev) => { const e = document.getElementById(id); if (e.type === "checkbox") e.checked = v; else e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); };
    fire("tsize", 0.9, "input"); fire("topac", 0.4, "input"); fire("tnotch", false, "change");
    const o = JSON.parse(localStorage["dungeon-raze.v2"]).o;
    const saved = Math.abs(o.tsize - 0.9) < 1e-9 && Math.abs(o.topac - 0.4) < 1e-9 && o.tnotch === false;
    DF.OPT.tsize = 1; DF.OPT.topac = 0.6; DF.OPT.tnotch = true;
    DF.loadOpt();
    const back = Math.abs(DF.OPT.tsize - 0.9) < 1e-9 && Math.abs(DF.OPT.topac - 0.4) < 1e-9 && DF.OPT.tnotch === false;
    // bad stored values are ignored
    const keep = JSON.parse(localStorage["dungeon-raze.v2"]);
    const tryBad = (o2) => { DF.OPT.tsize = 1; DF.OPT.topac = 0.6; DF.OPT.tnotch = true; localStorage["dungeon-raze.v2"] = JSON.stringify({ b: keep.b, o: Object.assign({}, keep.o, o2) }); DF.loadOpt(); return DF.OPT.tsize === 1 && DF.OPT.topac === 0.6 && DF.OPT.tnotch === true; };
    const bad = [{ tsize: "big", topac: "x", tnotch: "no" }, { tsize: 5, topac: 0, tnotch: 1 }, { tsize: null, topac: null, tnotch: null }, { tsize: 0.5, topac: 9, tnotch: "x" }].map(tryBad);
    localStorage["dungeon-raze.v2"] = JSON.stringify(keep);
    document.getElementById("btnDefaults").click(); await draw();
    const d = { size: DF.OPT.tsize === 1, opac: DF.OPT.topac === 0.6, notch: DF.OPT.tnotch === true,
      ui: document.getElementById("tsize").value === "1" && document.getElementById("topac").value === "0.6" && document.getElementById("tnotch").checked === true,
      stored: JSON.parse(localStorage["dungeon-raze.v2"]).o.tsize === 1 };
    const c = { saved, back, bad: bad.every((v) => v), ...d };
    return { pass: Object.values(c).every((v) => v === true), ...c, badRes: bad };`),
];
