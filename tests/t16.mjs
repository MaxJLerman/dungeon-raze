// Controller buttons on the desktop page: bindings, triggers, which input is
// active, the first press of a new pad, drift, unreadable pads.
// Run with: SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.
//
// A fake pad comes from window.__pads. G.manual stops the frame loop from
// polling, so each step polls the pads itself, once per simulated tick. An empty
// pad list is an unplugged pad, which pauses play, so a step that stays in play
// lets go of a button with pads(mk()).
const step = (name, body) => ({
  name,
  eval: `(async () => { const { G, cam, keys, taps } = DF; G.manual = true;
  const mk = (o = {}) => ({
    id: o.id || "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)",
    index: o.index || 0, connected: true, mapping: o.mapping ?? "standard", timestamp: performance.now(),
    buttons: Array.from({ length: 18 }, (_, i) => { const v = (o.b && o.b[i]) || 0; return { pressed: v > 0.1, value: v }; }),
    axes: o.axes || [0, 0, 0, 0],
    vibrationActuator: { playEffect(t, e) { window.__rumble.push([t, e]); return Promise.resolve("complete"); } },
  });
  const pads = (...list) => {
    window.__pads = list;
    if (!navigator.getGamepads || navigator.getGamepads.__fake !== true) {
      const f = () => window.__pads; f.__fake = true;
      Object.defineProperty(navigator, "getGamepads", { configurable: true, value: f });
    }
  };
  const tick = (n = 1) => DF.sim(n / 60, () => { DF.PAD.poll(1 / 60); });
  // one tick, returning what keys and taps held for the update that ran
  const seen = (code) => { let r = null; DF.sim(1 / 60, () => { DF.PAD.poll(1 / 60); r = { key: keys[code] === true, tap: taps[code] === true }; }); return r; };
  const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const reset = () => {
    Object.assign(DF.PAD_BIND, DF.DEFAULT_PAD); Object.assign(DF.BIND, DF.DEFAULT_BINDS);
    Object.assign(DF.OPT, { psens: 1, padHideTouch: true, rumble: true });
    window.__rumble = []; DF.PAD.endRebind();
    pads(); tick(); DF.PAD.setActive(false);
  };
  const stage = () => { DF.newRun(99); DF.show("play"); const p = G.player, n = G.world.nodes.find((q) => q.kind === "room"); for (const o of G.enemies) o.x += 1000; p.x = n.x; p.z = n.z; p.yaw = 0; cam.yaw = 0; p.lock = null; DF.PAD.poll(0); return p; };
  reset();
  ${body} })()`,
});
const EXPECT = {
  light: "P:5", heavy: "P:7", guard: "P:4", special: "P:6", dodge: "P:1",
  sprint: "P:10", lock: "P:11", heal: "P:2", tool: "P:3", mute: null,
};
export default [
  step("default bindings", `
  const exp = ${JSON.stringify(EXPECT)};
  const c = { json: JSON.stringify(DF.PAD_BIND) === JSON.stringify(exp), copy: DF.PAD_BIND !== DF.DEFAULT_PAD }, bad = [];
  for (const [a, code] of Object.entries(DF.DEFAULT_PAD)) {
    if (!code) continue;
    const i = +code.slice(2);
    pads(mk({ b: { [i]: 1 } }));
    const s = seen(code);
    if (!(s.key && s.tap)) bad.push([a, code, s]);
    pads(mk()); tick(2);
    if (keys[code]) bad.push([a, code, "stuck"]);
  }
  c.bad = bad;
  return { pass: c.json && c.copy && bad.length === 0, c };`),
  step("triggers need half travel", `
  pads(mk({ b: { 7: 0.4 } })); tick(); const lo = keys["P:7"];
  pads(mk({ b: { 7: 0.6 } })); tick(); const hi = keys["P:7"];
  pads(mk({ b: { 6: 0.4 } })); tick(); const lo6 = keys["P:6"];
  pads(mk({ b: { 6: 0.6 } })); tick(); const hi6 = keys["P:6"];
  const fix = mk({ b: { 7: 0.4 } }); fix.buttons[7].pressed = true;
  pads(fix); tick(); const lied = keys["P:7"];
  return { pass: lo === false && hi === true && lo6 === false && hi6 === true && lied === false, lo, hi, lo6, hi6, lied };`),
  step("a pad press makes the pad active", `
  const c = {};
  pads(mk({ b: { 0: 1 } })); tick();
  c.press = DF.PAD.active === true && document.body.classList.contains("pad");
  pads(mk()); tick();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w" }));
  c.key = DF.PAD.active === false && !document.body.classList.contains("pad");
  pads(mk({ b: { 0: 1 } })); tick(2); pads(mk()); tick();
  window.dispatchEvent(new MouseEvent("mousemove", { movementX: 5 }));
  c.mouse = DF.PAD.active === false;
  pads(mk({ b: { 1: 1 } })); tick(); pads(mk()); tick();
  window.dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: 0 }));
  c.stillMouse = DF.PAD.active === true;
  window.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch" }));
  c.touch = DF.PAD.active === false;
  pads(mk({ b: { 1: 1 } })); tick(); pads(mk()); tick();
  window.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse" }));
  c.mouseDown = DF.PAD.active === true;
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "AudioVolumeUp", key: "AudioVolumeUp" }));
  c.volume = DF.PAD.active === true;
  pads(mk({ axes: [0.9, 0, 0, 0] })); tick();
  const stickOn = DF.PAD.active === true;
  c.stick = stickOn;
  reset();
  return { pass: Object.values(c).every(Boolean), c };`),
  step("the first press of a new pad counts", `
  const p = stage(); pads(); tick();
  pads(mk({ b: { 5: 1 } }));
  const s = seen("P:5");
  tick(2);
  return { pass: s.tap === true && s.key === true && p.state === "attack", s, state: p.state };`),
  step("a released pad leaves nothing held", `
  const p = stage(); pads(mk({ b: { 4: 1 } })); tick(3);
  const held = DF.keys["P:4"] === true;
  pads(); tick(); const gone = DF.keys["P:4"] === false;
  return { pass: held && gone, held, gone };`),
  step("an idle drifting pad changes nothing", `
  const p = stage(); const yaw0 = cam.yaw, py = p.yaw, x0 = p.x, z0 = p.z;
  pads(mk({ axes: [0.15, -0.12, 0.14, 0.1] }));
  DF.keys[DF.BIND.fwd] = true;
  tick(60);
  DF.keys[DF.BIND.fwd] = false;
  const moved = Math.hypot(p.x - x0, p.z - z0);
  const c = { inactive: DF.PAD.active === false, body: !document.body.classList.contains("pad"), cam: cam.yaw === yaw0, moved: moved > 1, connected: DF.PAD.connected === true };
  return { pass: Object.values(c).every(Boolean), c, moved };`),
  step("a pad that can't be read", `
  const was = Object.getOwnPropertyDescriptor(navigator, "getGamepads");
  let err = null;
  try {
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => { throw new DOMException("blocked", "SecurityError"); } });
    tick(5);
  } catch (e) { err = "throw: " + e.message; }
  const throws = { connected: DF.PAD.connected === false, pads: DF.PAD.pads().length === 0 };
  try {
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: undefined });
    tick(5);
  } catch (e) { err = "missing: " + e.message; }
  const missing = { connected: DF.PAD.connected === false, pads: DF.PAD.pads().length === 0 };
  window.__pads = []; pads(); tick();
  return { pass: err === null && Object.values(throws).every(Boolean) && Object.values(missing).every(Boolean), err, throws, missing };`),
  step("family", `
  // X, not A: the step may start on a menu, where A presses a control
  pads(mk({ id: "054c-0ce6-DualSense Wireless Controller", b: { 2: 1 } })); tick(); const ps = DF.PAD.fam;
  pads(); tick();
  pads(mk({ b: { 2: 1 } })); tick(); const xb = DF.PAD.fam;
  pads(); tick();
  pads(mk({ id: "Wireless Controller (STANDARD GAMEPAD)", b: { 2: 1 } })); tick(); const ps2 = DF.PAD.fam;
  pads(mk()); tick(); const idle = DF.PAD.fam;
  return { pass: ps === "ps" && xb === "xbox" && ps2 === "ps" && idle === "ps", ps, xb, ps2, idle };`),
  step("standard mapping", `
  pads(mk()); tick(); const a = DF.PAD.std;
  pads(mk({ mapping: "" })); tick(); const b = DF.PAD.std;
  pads(mk(), mk({ mapping: "", index: 1 })); tick(); const two = DF.PAD.std;
  pads(); tick(); const none = DF.PAD.std;
  return { pass: a === true && b === false && two === false && none === true, a, b, two, none };`),
  step("two pads merge and the body flag follows", `
  pads(mk({ b: { 5: 1 } }), mk({ index: 1 })); tick();
  const a = keys["P:5"] === true, padc = document.body.classList.contains("padc");
  pads(mk(), mk({ index: 1, b: { 5: 1 } })); tick();
  const b = keys["P:5"] === true;
  pads(); tick();
  return { pass: a && b && padc && !document.body.classList.contains("padc") && keys["P:5"] === false, a, b, padc };`),
  step("dead zone and walk speed", `
  const p = stage();
  pads(mk({ axes: [0, -0.15, 0, 0] })); tick(); const z = DF.PAD.move.mag;
  pads(mk({ axes: [0, -0.6, 0, 0] })); tick(); const m = DF.PAD.move.mag;
  const dist = (ax) => { const q = stage(); pads(mk({ axes: [0, ax, 0, 0] })); const x0 = q.x, z0 = q.z; tick(60); const d = Math.hypot(q.x - x0, q.z - z0); pads(); tick(); return d; };
  const half = dist(-0.6), full = dist(-1.0), ratio = half / full;
  return { pass: z === 0 && Math.abs(m - 0.5) <= 0.01 && ratio > 0.4 && ratio < 0.6, z, m, half, full, ratio };`),
  step("right stick turns the camera", `
  const p = stage(); const r = {};
  pads(mk({ axes: [0, 0, 1, 0] })); const y0 = cam.yaw; tick(60); r.dyaw = cam.yaw - y0;
  DF.OPT.psens = 2; stage(); pads(mk({ axes: [0, 0, 1, 0] })); const y1 = cam.yaw; tick(60); r.dyaw2 = cam.yaw - y1;
  DF.OPT.psens = 1;
  stage(); cam.pitch = 0.3; pads(mk({ axes: [0, 0, 0, 1] })); tick(10); r.up = cam.pitch;
  DF.OPT.invY = true; stage(); cam.pitch = 0.3; tick(10); r.inv = cam.pitch; DF.OPT.invY = false;
  stage(); cam.pitch = 0.3; pads(mk({ axes: [0, 0, 0, -1] })); tick(120); r.low = cam.pitch;
  pads(mk({ axes: [0, 0, 0, 1] })); tick(240); r.high = cam.pitch;
  pads(); tick();
  const c = { yaw: Math.abs(r.dyaw + 3.0) <= 0.1, sens: Math.abs(r.dyaw2 - 2 * r.dyaw) <= 0.1, up: r.up > 0.3, inv: r.inv < 0.3, low: r.low >= -0.3 - 1e-9, high: r.high <= 1.15 + 1e-9 && r.high > 1.1 };
  return { pass: Object.values(c).every(Boolean), c, r };`),
  step("sprint latch", `
  const p = stage(); pads(mk({ axes: [0, -1, 0, 0] })); tick(5);
  const tapBtn = () => { pads(mk({ axes: [0, -1, 0, 0], b: { 10: 1 } })); tick(1); pads(mk({ axes: [0, -1, 0, 0] })); };
  const r = {};
  tapBtn(); tick(30); r.on = p.sprint === true && DF.PAD.sprint === true;
  pads(mk()); tick(); r.centre = DF.PAD.sprint === false;
  pads(mk({ axes: [0, -1, 0, 0] })); tick(5); tapBtn(); tick(30); r.again = DF.PAD.sprint === true;
  tapBtn(); tick(3); r.off = DF.PAD.sprint === false && p.sprint === false;
  tapBtn(); tick(5); r.back = DF.PAD.sprint === true; p.stam = 0; tick(); r.stam = DF.PAD.sprint === false;
  pads(); tick(120);
  return { pass: Object.values(r).every(Boolean), r };`),
  step("a half push walks while latched", `
  const p = stage(); pads(mk({ axes: [0, -1, 0, 0] })); tick(3);
  pads(mk({ axes: [0, -1, 0, 0], b: { 10: 1 } })); tick(1); pads(mk({ axes: [0, -1, 0, 0] })); tick(5);
  const on = DF.PAD.sprint === true;
  pads(mk({ axes: [0, -0.5, 0, 0] })); tick(10);
  return { pass: on && p.sprint === false && DF.PAD.sprint === true, on, sprint: p.sprint, latch: DF.PAD.sprint, mag: DF.PAD.move.mag };`),
  step("dash attack from the latch", `
  const p = stage(); p.stam = 100; pads(mk({ axes: [0, -1, 0, 0] })); tick(3);
  pads(mk({ axes: [0, -1, 0, 0], b: { 10: 1 } })); tick(1); pads(mk({ axes: [0, -1, 0, 0] })); tick(40);
  pads(mk({ axes: [0, -1, 0, 0], b: { 5: 1 } })); tick(2);
  const want = DF.CLASSES[DF.OPT.cls].dash;
  return { pass: p.move === want, move: p.move, want };`),
  step("flick switches lock target", `
  const p = stage();
  const [a, b] = G.enemies; a.x = p.x - 2; a.z = p.z + 6; b.x = p.x + 2; b.z = p.z + 6; a.dead = b.dead = false;
  pads(mk({ b: { 11: 1 } })); tick(1); pads(mk()); tick(1);
  const first = p.lock;
  // count lock changes tick by tick
  let changes = 0, wheel = 0, last = p.lock;
  pads(mk({ axes: [0, 0, 0.9, 0] }));
  for (let i = 0; i < 10; i++) { DF.sim(1 / 60, () => { DF.PAD.poll(1 / 60); if (DF.mouse.wheel) wheel++; }); if (p.lock !== last) { changes++; last = p.lock; } }
  const afterFirst = p.lock;
  pads(mk()); tick(3);
  let changes2 = 0, wheel2 = 0;
  pads(mk({ axes: [0, 0, -0.9, 0] }));
  for (let i = 0; i < 10; i++) { DF.sim(1 / 60, () => { DF.PAD.poll(1 / 60); if (DF.mouse.wheel) wheel2++; }); if (p.lock !== last) { changes2++; last = p.lock; } }
  const c = { hadFirst: !!first, changes: changes === 1, wheel: wheel === 1, moved: afterFirst !== first && !!afterFirst, changes2: changes2 === 1, wheel2: wheel2 === 1, back: p.lock === first };
  return { pass: Object.values(c).every(Boolean), c, changes, wheel, changes2, wheel2 };`),
  step("an idle second pad does not cancel movement", `
  stage(); pads(mk({ index: 0 }), mk({ index: 1, axes: [0, -1, 0, 0] })); tick(2);
  const a = DF.PAD.move.mag;
  pads(mk({ index: 0, axes: [0, -1, 0, 0] }), mk({ index: 1 })); tick(2);
  const b = DF.PAD.move.mag;
  pads(mk({ index: 0 }), mk({ index: 1, axes: [0, 0, 1, 0] })); const y0 = cam.yaw; tick(10);
  const turned = cam.yaw < y0 - 0.3;
  return { pass: Math.abs(a - 1) < 0.01 && Math.abs(b - 1) < 0.01 && turned, a, b, turned };`),
  step("touch stick wins", `
  // right of the camera at yaw 0 is -X
  const p = stage(); const x0 = p.x, z0 = p.z;
  pads(mk({ axes: [0, -1, 0, 0] })); DF.TOUCH.move = { x: 1, y: 0, mag: 1 };
  tick(30); DF.TOUCH.move = { x: 0, y: 0, mag: 0 };
  const dx = p.x - x0, dz = p.z - z0;
  return { pass: dx < -1 && Math.abs(dz) < Math.abs(dx) * 0.3, dx, dz };`),
  step("Menu pauses and resumes", `
  stage(); tick(2);
  const c = { start: G.state === "play" };
  pads(mk({ b: { 9: 1 } })); tick(1); c.paused = G.state === "pause";
  pads(mk()); tick(2); c.stays = G.state === "pause";
  pads(mk({ b: { 9: 1 } })); tick(1); c.resumed = G.state === "play";
  pads(mk()); tick(2);
  pads(mk({ b: { 9: 1 } })); tick(1); pads(mk()); tick(2);
  c.again = G.state === "pause";
  pads(mk({ b: { 1: 1 } })); tick(1); c.backResumes = G.state === "play";
  pads(mk()); tick(2);
  c.noTap = taps["P:9"] !== true;
  return { pass: Object.values(c).every(Boolean), c, state: G.state };`),
  step("a held button is not seen again after a screen change", `
  stage(); tick(2);
  pads(mk({ b: { 9: 1 } })); tick(1);
  const c = { paused: G.state === "pause" };
  tick(20); c.holdsPause = G.state === "pause";
  pads(mk()); tick(2); c.stillPause = G.state === "pause";
  pads(mk({ b: { 9: 1 } })); tick(1); pads(mk()); tick(2);
  c.resumed = G.state === "play";
  // hold attack across a screen change: nothing is seen until it is let go
  pads(mk({ b: { 5: 1 } })); tick(1); c.sees = keys["P:5"] === true;
  G.player.state = "free";
  DF.show("pause"); tick(1); DF.play();
  let saw = false, tapped = false;
  for (let i = 0; i < 5; i++) { DF.sim(1 / 60, () => { DF.PAD.poll(1 / 60); if (keys["P:5"]) saw = true; if (taps["P:5"]) tapped = true; }); }
  c.muted = !saw && !tapped && G.player.state !== "attack";
  pads(mk()); tick(2);
  pads(mk({ b: { 5: 1 } })); const r = (() => { let t = null; DF.sim(1 / 60, () => { DF.PAD.poll(1 / 60); t = { key: keys["P:5"] === true, tap: taps["P:5"] === true }; }); return t; })();
  c.again = r.key && r.tap;
  return { pass: Object.values(c).every(Boolean), c, saw, tapped };`),
  step("unplugging pauses", `
  stage(); pads(mk({})); tick(3);
  const c = { was: DF.PAD.connected === true && document.body.classList.contains("padc") };
  pads(); tick(1);
  c.paused = G.state === "pause";
  c.gone = DF.PAD.connected === false && !document.body.classList.contains("padc");
  return { pass: Object.values(c).every(Boolean), c, state: G.state };`),
  step("unplugging while guarding leaves nothing held", `
  const p = stage(); pads(mk({ b: { 4: 1 } })); tick(10);
  const c = { guarding: p.state === "guard" && keys["P:4"] === true };
  pads(); tick(1);
  c.cleared = keys["P:4"] === false && G.state === "pause";
  DF.play(); tick(10);
  c.free = p.state !== "guard";
  return { pass: Object.values(c).every(Boolean), c, state: p.state };`),
  step("play from the pad skips pointer lock and tries fullscreen", `
  let lock = 0, fs = 0, err = null;
  const onErr = (e) => { err = String(e.message || e); };
  window.addEventListener("error", onErr); window.addEventListener("unhandledrejection", onErr);
  const cv = document.getElementById("c") || document.querySelector("canvas");
  const oLock = cv.requestPointerLock, oFs = document.documentElement.requestFullscreen;
  cv.requestPointerLock = () => { lock++; return Promise.reject(new Error("no")); };
  document.documentElement.requestFullscreen = () => { fs++; return Promise.reject(new Error("no")); };
  DF.show("title"); DF.PAD.setActive(true);
  DF.play();
  await draw();
  const c = { lock: lock === 0, fs: fs === 1, state: G.state === "play", err: err === null };
  // with no pad active, the pointer is locked and fullscreen is left alone
  DF.show("pause"); DF.PAD.setActive(false); lock = fs = 0; DF.play(); await draw();
  c.mouse = lock === 1 && fs === 0;
  cv.requestPointerLock = oLock; document.documentElement.requestFullscreen = oFs;
  window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onErr);
  DF.show("play"); G.noLock = false;
  return { pass: Object.values(c).every(Boolean), c, lock, fs, err };`),
  step("Esc and P pause without pointer lock", `
  stage();
  const c = { noLockEl: document.pointerLockElement === null };
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape" }));
  c.esc = G.state === "pause";
  DF.show("play");
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyP", key: "p" }));
  c.p = G.state === "pause";
  DF.show("play");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("leaving fullscreen pauses on desktop", `
  // fullscreen is real here, since headless Chromium grants it
  if (document.fullscreenElement) { await document.exitFullscreen(); await draw(); }
  stage();
  const c = { desktop: DF.TOUCH.on === false, none: !document.fullscreenElement };
  // an event with no change in fullscreen is no reason to pause
  document.dispatchEvent(new Event("fullscreenchange"));
  c.stray = G.state === "play";
  let real = false;
  try { await document.documentElement.requestFullscreen(); real = !!document.fullscreenElement; } catch (e) {}
  await new Promise((r) => setTimeout(r, 150));
  c.entered = G.state === "play";
  if (real) { await document.exitFullscreen(); await new Promise((r) => setTimeout(r, 200)); }
  else { c.skipped = true; c.paused = true; }
  if (real) c.paused = G.state === "pause";
  return { pass: Object.values(c).every(Boolean), c, real };`),
  step("audio is tried on pad presses", `
  stage(); tick(2);
  let n = 0; const o = DF.SFX.init; DF.SFX.init = function () { n++; return o.apply(this, arguments); };
  pads(mk({ b: { 5: 1 } })); tick(1);
  const first = n;
  tick(5); const held = n;
  DF.SFX.init = o;
  return { pass: first >= 1 && held === first, first, held };`),
  step("no camera turn while locked", `
  const p = stage();
  const [a] = G.enemies; a.x = p.x; a.z = p.z + 6; a.dead = false;
  pads(mk({ b: { 11: 1 } })); tick(1); pads(mk()); tick(1);
  const locked = !!p.lock;
  pads(mk({ axes: [0, 0, 0.5, 0] }));
  const y0 = cam.yaw; DF.PAD.poll(1 / 60);
  return { pass: locked && cam.yaw === y0, locked, y0, y1: cam.yaw };`),
  step("locking with the stick held does not flick", `
  const p = stage();
  const [a, b] = G.enemies; a.x = p.x - 2; a.z = p.z + 6; b.x = p.x + 2; b.z = p.z + 6; a.dead = b.dead = false;
  pads(mk({ axes: [0, 0, 0.9, 0] })); tick(3);
  pads(mk({ axes: [0, 0, 0.9, 0], b: { 11: 1 } })); tick(1);
  pads(mk({ axes: [0, 0, 0.9, 0] }));
  const first = p.lock;
  let changed = false, last = p.lock;
  for (let i = 0; i < 10; i++) { tick(1); if (p.lock !== last) changed = true; last = p.lock; }
  pads(mk()); tick(3);
  pads(mk({ axes: [0, 0, 0.9, 0] })); tick(3);
  const after = p.lock;
  return { pass: !!first && !changed && !!after && after !== first, hadFirst: !!first, changed, flicked: after !== first };`),
  step("a screen opens with its first control focused", `
  const c = {};
  for (const [scr, want] of [["pause", "btnResume"], ["dead", "btnRise"], ["title", "btnPlay"]]) {
    DF.show(scr); tick(1);
    c[scr] = !!DF.PAD.focus && DF.PAD.focus.id === want && DF.PAD.focus.classList.contains("padfocus");
  }
  DF.show("class"); tick(1);
  const first = document.querySelector("#scr-class .card");
  c.class = DF.PAD.focus === first && !!first;
  // only one control carries the mark, and play clears it
  c.one = document.querySelectorAll(".padfocus").length === 1;
  DF.show("play"); tick(1);
  c.cleared = DF.PAD.focus === null && document.querySelectorAll(".padfocus").length === 0;
  // a focused control that is no longer shown does not keep focus
  DF.show("title"); tick(1);
  const was = DF.PAD.focus;
  DF.show("pause"); tick(1);
  c.moved = DF.PAD.focus !== was && DF.PAD.focus.closest(".scr").classList.contains("show");
  DF.show("title");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("focus moves by direction", `
  const tap = (b) => { pads(mk({ b: { [b]: 1 } })); tick(1); pads(mk()); tick(2); };
  const ctr = (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  DF.show("class"); DF.PAD.setActive(true); pads(mk()); tick(2);
  const c = {};
  const a = DF.PAD.focus, [ax, ay] = ctr(a);
  tap(15);
  const [bx] = ctr(DF.PAD.focus);
  c.right = DF.PAD.focus !== a && bx > ax;
  tap(14);
  c.left = DF.PAD.focus === a;
  tap(12);
  c.nothingUp = DF.PAD.focus === a;
  tap(13);
  const [, dy] = ctr(DF.PAD.focus);
  c.down = DF.PAD.focus !== a && dy > ay;
  tap(12);
  c.up = DF.PAD.focus === a;
  // the left stick moves it too
  pads(mk({ axes: [0.9, 0, 0, 0] })); tick(1); pads(mk()); tick(2);
  c.stick = DF.PAD.focus !== a && ctr(DF.PAD.focus)[0] > ax;
  DF.show("title");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("holding repeats", `
  DF.show("controls"); pads(mk()); tick(2);
  let n = 0; const o = DF.PAD.step; DF.PAD.step = function (d) { n++; return o.call(this, d); };
  const hold = (ticks) => { n = 0; pads(mk({ b: { 13: 1 } })); tick(ticks); const r = n; pads(mk()); tick(3); return r; };
  const r = { a: hold(21), b: hold(23), c: hold(44) };
  DF.PAD.step = o;
  DF.show("title");
  return { pass: r.a === 1 && r.b === 2 && r.c === 5, r };`),
  step("A presses and B goes back", `
  const tap = (b) => { pads(mk({ b: { [b]: 1 } })); tick(1); pads(mk()); tick(2); };
  const c = {};
  DF.show("title"); pads(mk()); tick(2);
  document.querySelector('#scr-title [data-open="howto"]').click(); tick(2);
  c.opened = G.state === "howto";
  tap(1);
  c.back = G.state === "title";
  // A on a button in a menu opens it
  DF.PAD.setFocus(document.querySelector('#scr-title [data-open="controls"]'));
  tap(0);
  c.press = G.state === "controls";
  tap(1);
  c.back2 = G.state === "title";
  // B does nothing on the title screen
  tap(1); c.title = G.state === "title";
  // from pause, B resumes (Task 3) and Back returns to pause
  DF.show("pause"); tick(2);
  DF.PAD.setFocus(document.querySelector('#scr-pause [data-open="howto"]'));
  tap(0); c.fromPause = G.state === "howto";
  tap(1); c.backPause = G.state === "pause";
  // the class screen: A on a card chooses it
  DF.show("class"); tick(2);
  const was = DF.OPT.cls;
  const card = [...document.querySelectorAll("#scr-class .card")].find((e) => e.dataset.cls !== was);
  DF.PAD.setFocus(card);
  tap(0);
  c.class = DF.OPT.cls === card.dataset.cls;
  c.stillFocused = DF.PAD.focus && DF.PAD.focus.dataset.cls === card.dataset.cls && DF.PAD.focus.isConnected;
  DF.setClass(was); DF.show("title");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("ranges and checkboxes", `
  const tap = (b) => { pads(mk({ b: { [b]: 1 } })); tick(1); pads(mk()); tick(2); };
  DF.show("controls"); pads(mk()); tick(2);
  const c = {}; const sens = document.getElementById("sens"), inv = document.getElementById("invY");
  DF.OPT.sens = 1; sens.value = 1; DF.OPT.invY = false; inv.checked = false;
  DF.PAD.setFocus(sens);
  tap(15);
  c.up = Math.abs(DF.OPT.sens - 1.05) < 1e-9 && DF.PAD.focus === sens;
  tap(14); tap(14);
  c.down = Math.abs(DF.OPT.sens - 0.95) < 1e-9;
  DF.PAD.setFocus(inv);
  tap(0); c.on = DF.OPT.invY === true && inv.checked;
  tap(0); c.off = DF.OPT.invY === false && !inv.checked;
  DF.OPT.sens = 1; sens.value = 1; DF.show("title");
  return { pass: Object.values(c).every(Boolean), c, sens: DF.OPT.sens };`),
  step("focus never lands on a keyboard binding", `
  const tap = (b) => { pads(mk({ b: { [b]: 1 } })); tick(1); pads(mk()); tick(1); };
  DF.show("controls"); pads(mk()); tick(2);
  const seenOn = []; let bad = 0;
  const chk = () => { if (DF.PAD.focus.matches("#binds button[data-act]")) bad++; };
  const n = document.querySelectorAll("#binds button[data-act]").length;
  for (let i = 0; i < 40; i++) { tap(13); chk(); }
  for (let i = 0; i < 40; i++) { tap(12); chk(); }
  for (const b of [14, 15, 13, 15, 12, 14]) { tap(b); chk(); }
  DF.show("title");
  return { pass: bad === 0 && n > 0, bad, n };`),
  step("focus scrolls into view", `
  const scr = document.getElementById("scr-controls");
  scr.style.height = "300px";
  DF.show("controls"); pads(mk()); tick(2);
  const tap = (b) => { pads(mk({ b: { [b]: 1 } })); tick(1); pads(mk()); tick(1); };
  const list = DF.PAD.focusables(), last = list[list.length - 1];
  for (let i = 0; i < 40; i++) tap(13);
  const r = DF.PAD.focus.getBoundingClientRect(), s = scr.getBoundingClientRect();
  const c = { atLast: DF.PAD.focus === last, scrolled: scr.scrollTop > 0, inside: r.top >= s.top - 1 && r.bottom <= s.bottom + 1 };
  scr.style.height = ""; DF.show("title");
  return { pass: Object.values(c).every(Boolean), c, r: [r.top, r.bottom], s: [s.top, s.bottom] };`),
  step("A held on Resume does not attack", `
  const p = stage(); DF.PAD_BIND.light = "P:0"; pads(mk()); tick(2);
  DF.show("pause"); tick(2);
  const c = { onResume: DF.PAD.focus && DF.PAD.focus.id === "btnResume" };
  pads(mk({ b: { 0: 1 } })); tick(1);
  c.resumed = G.state === "play";
  let key = false, tapped = false;
  for (let i = 0; i < 5; i++) DF.sim(1 / 60, () => { DF.PAD.poll(1 / 60); if (keys["P:0"]) key = true; if (taps["P:0"]) tapped = true; });
  c.muted = !key && !tapped && p.state !== "attack";
  pads(mk()); tick(3);
  pads(mk({ b: { 0: 1 } })); tick(2);
  c.again = keys["P:0"] === true && p.state === "attack";
  pads(mk()); tick(3);
  reset();
  c.restored = DF.PAD_BIND.light === "P:5";
  return { pass: Object.values(c).every(Boolean), c, state: p.state };`),
  step("Menu on title and class does nothing", `
  reset(); const c = {}; let clicks = 0;
  const spy = () => { clicks++; }; document.addEventListener("click", spy, true);
  for (const scr of ["title", "class"]) {
    DF.show(scr); pads(mk()); tick(3);
    const before = G.state, f = DF.PAD.focus;
    pads(mk({ b: { 9: 1 } })); tick(3); pads(mk()); tick(3);
    c[scr] = G.state === before && DF.PAD.focus === f;
  }
  document.removeEventListener("click", spy, true);
  c.noClick = clicks === 0;
  DF.show("title");
  return { pass: Object.values(c).every(Boolean), c, clicks };`),
  step("the Controller column", `
  reset(); DF.show("controls"); pads(mk()); tick(2);
  const btn = (a) => document.querySelector('#binds [data-pact="' + a + '"]');
  const rows = DF.G && [...document.querySelectorAll("#binds .bind")];
  const c = { rows: rows.length === 14 && rows.every((r) => r.querySelector("[data-pact]") && r.querySelector("[data-act]")) };
  c.light = btn("light").textContent === "RB";
  c.mute = btn("mute").textContent === "Unbound";
  c.moves = ["fwd", "back", "left", "right"].every((a) => btn(a).disabled && btn(a).textContent === "Left stick");
  c.rest = btn("sprint").textContent === "LS" && btn("heavy").textContent === "RT" && btn("dodge").textContent === "B";
  pads(mk({ id: "054c-0ce6-DualSense Wireless Controller", b: { 2: 1 } })); tick(2);
  c.ps = btn("light").textContent === "R1" && btn("dodge").textContent === "○" && btn("heavy").textContent === "R2";
  pads(); tick(); pads(mk({ b: { 2: 1 } })); tick(2);
  c.back = btn("light").textContent === "RB";
  pads(mk()); tick(2);
  c.names = [DF.padName("P:17", "xbox"), DF.padName("P:17", "ps"), DF.padName("P:12", "ps"), DF.padName("P:9", "ps"), DF.padName(null, "ps")].join("|") === "Share|Touchpad|D-pad up|Options|Unbound";
  c.keyName = DF.PAD.fam === "xbox";
  DF.show("title");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("rebinding a pad button", `
  reset(); DF.show("controls"); pads(mk()); tick(2);
  const btn = (a) => document.querySelector('#binds [data-pact="' + a + '"]');
  const c = {};
  DF.PAD.setFocus(btn("light"));
  pads(mk({ b: { 0: 1 } })); tick(2);
  c.waiting = DF.PAD.rebind === "light" && btn("light").textContent === "Press a controller button" && btn("light").classList.contains("wait");
  tick(4); c.heldNotBound = DF.PAD_BIND.light === "P:5" && DF.PAD.rebind === "light";
  pads(mk()); tick(3); c.stillWaiting = DF.PAD.rebind === "light";
  pads(mk({ b: { 3: 1 } })); tick(2);
  c.bound = DF.PAD_BIND.light === "P:3" && DF.PAD_BIND.tool === "P:5";
  c.done = DF.PAD.rebind === null && btn("light").textContent === "Y" && btn("tool").textContent === "RB";
  c.focus = DF.PAD.focus === btn("light") && DF.PAD.focus.isConnected;
  pads(mk()); tick(3);
  c.saved = JSON.parse(localStorage.getItem("dungeon-raze.v2")).p.light === "P:3";
  c.menuStill = G.state === "controls";
  // a button held through the wait is not read again as a menu press afterwards
  DF.PAD.setFocus(btn("heal"));
  pads(mk({ b: { 0: 1 } })); tick(2); pads(mk()); tick(2);
  pads(mk({ b: { 13: 1 } })); tick(2);
  c.dpad = DF.PAD_BIND.heal === "P:13" && DF.PAD.focus === btn("heal");
  pads(mk()); tick(3);
  DF.show("title"); reset();
  return { pass: Object.values(c).every(Boolean), c };`),
  step("cancelling a pad wait", `
  reset(); DF.show("controls"); pads(mk()); tick(2);
  const btn = (a) => document.querySelector('#binds [data-pact="' + a + '"]');
  const c = {}, before = JSON.stringify(DF.PAD_BIND);
  DF.PAD.setFocus(btn("light"));
  pads(mk({ b: { 0: 1 } })); tick(2); pads(mk()); tick(3);
  c.started = DF.PAD.rebind === "light";
  pads(mk({ b: { 9: 1 } })); tick(2); pads(mk()); tick(3);
  c.menu = DF.PAD.rebind === null && JSON.stringify(DF.PAD_BIND) === before && btn("light").textContent === "RB" && G.state === "controls";
  // a click starts it, and a key cancels it
  btn("light").click(); tick(2);
  c.clicked = DF.PAD.rebind === "light";
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w" }));
  c.key = DF.PAD.rebind === null && JSON.stringify(DF.PAD_BIND) === before && btn("light").textContent === "RB" && DF.BIND.fwd === "KeyW";
  // a wait ends when the screen does
  btn("light").click(); tick(2); DF.show("title"); tick(2);
  c.left = DF.PAD.rebind === null;
  reset();
  return { pass: Object.values(c).every(Boolean), c };`),
  step("a pad press cancels a key wait", `
  reset(); DF.show("controls"); pads(mk()); tick(2);
  const c = {}, kb = document.querySelector('#binds [data-act="light"]');
  kb.click();
  c.waiting = document.querySelector('#binds [data-act="light"]').textContent === "Press a key or mouse button";
  pads(mk({ b: { 2: 1 } })); tick(2); pads(mk()); tick(2);
  c.gone = document.querySelector('#binds [data-act="light"]').textContent === "Left click" && DF.BIND.light === "Mouse0";
  c.noPad = DF.PAD.rebind === null && DF.PAD_BIND.light === "P:5";
  // and a key wait started by a click cancels a pad wait
  document.querySelector('#binds [data-pact="light"]').click(); tick(2);
  document.querySelector('#binds [data-act="light"]').click();
  c.swapped = DF.PAD.rebind === null;
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape" }));
  DF.show("title"); reset();
  return { pass: Object.values(c).every(Boolean), c };`),
  step("menu buttons keep working after rebinding", `
  reset(); const p = stage();
  DF.setPadBind("light", "P:0"); DF.setPadBind("dodge", "P:2");
  const c = { bound: DF.PAD_BIND.light === "P:0" && DF.PAD_BIND.dodge === "P:2" };
  pads(mk()); tick(2); DF.show("pause"); tick(2);
  pads(mk({ b: { 0: 1 } })); tick(2);
  c.resumed = G.state === "play";
  pads(mk()); tick(3);
  pads(mk({ b: { 0: 1 } })); tick(2);
  c.attack = p.state === "attack";
  pads(mk()); tick(3);
  DF.show("title"); DF.openMenu("controls"); pads(mk()); tick(2);
  pads(mk({ b: { 1: 1 } })); tick(2);
  c.back = G.state === "title";
  pads(mk()); tick(2);
  reset();
  return { pass: Object.values(c).every(Boolean), c, state: p.state };`),
  step("saving", `
  reset();
  DF.setPadBind("light", "P:3"); DF.OPT.psens = 1.5; DF.OPT.padHideTouch = false; DF.OPT.rumble = false;
  DF.saveOpt();
  Object.assign(DF.PAD_BIND, DF.DEFAULT_PAD); Object.assign(DF.OPT, { psens: 1, padHideTouch: true, rumble: true });
  DF.loadOpt();
  const c = { bind: DF.PAD_BIND.light === "P:3" && DF.PAD_BIND.tool === "P:5", psens: DF.OPT.psens === 1.5, hide: DF.OPT.padHideTouch === false, rumble: DF.OPT.rumble === false };
  const bad = {};
  for (const v of ["P:9", "P:16", "bogus", 4]) {
    localStorage.setItem("dungeon-raze.v2", JSON.stringify({ b: DF.BIND, p: { light: v, heavy: null }, o: { ...DF.OPT, psens: 9 } }));
    Object.assign(DF.PAD_BIND, DF.DEFAULT_PAD); DF.OPT.psens = 2;
    DF.loadOpt();
    bad[String(v)] = DF.PAD_BIND.light === "P:5" && DF.PAD_BIND.heavy === null && DF.OPT.psens === 1;
  }
  c.bad = Object.values(bad).every(Boolean);
  localStorage.setItem("dungeon-raze.v2", JSON.stringify({ b: DF.BIND, o: { ...DF.OPT, padHideTouch: "yes", rumble: 3 } }));
  DF.loadOpt(); c.flags = DF.OPT.padHideTouch === true && DF.OPT.rumble === true;
  reset(); DF.saveOpt();
  return { pass: Object.values(c).every(Boolean), c, bad };`),
  step("Defaults resets the pad", `
  reset(); DF.setPadBind("light", "P:3"); DF.setPadBind("mute", "P:8");
  Object.assign(DF.OPT, { psens: 2.5, padHideTouch: false, rumble: false });
  DF.show("controls"); tick(2);
  document.getElementById("btnDefaults").click();
  const c = { bind: JSON.stringify(DF.PAD_BIND) === JSON.stringify(DF.DEFAULT_PAD), opts: DF.OPT.psens === 1 && DF.OPT.padHideTouch === true && DF.OPT.rumble === true };
  c.shown = document.getElementById("psens").value === "1" && document.getElementById("rumble").checked && document.getElementById("padHideTouch").checked;
  c.saved = JSON.parse(localStorage.getItem("dungeon-raze.v2")).p.light === "P:5";
  c.text = document.querySelector('#binds [data-pact="light"]').textContent === "RB";
  DF.show("title");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("settings controls", `
  reset(); DF.show("controls"); tick(2);
  const c = {}, $ = (id) => document.getElementById(id);
  const txt = (e) => e.textContent.replace(/\\s+/g, " ").trim();
  $("psens").value = "1.5"; $("psens").dispatchEvent(new Event("input", { bubbles: true }));
  c.psens = DF.OPT.psens === 1.5 && $("psensV").textContent === "1.50×";
  $("padHideTouch").checked = false; $("padHideTouch").dispatchEvent(new Event("change", { bubbles: true }));
  c.hide = DF.OPT.padHideTouch === false;
  $("rumble").checked = false; $("rumble").dispatchEvent(new Event("change", { bubbles: true }));
  c.rumble = DF.OPT.rumble === false;
  c.saved = JSON.parse(localStorage.getItem("dungeon-raze.v2")).o.psens === 1.5;
  const scr = txt($("scr-controls"));
  c.copy = ["Controller", "Camera speed (stick)", "Hide touch buttons while a controller is connected", "Vibration"].every((t) => scr.includes(t)) && txt(document.querySelector("#pset h2")) === "Controller" && txt(document.querySelector("#pset")).includes("Vibration");
  c.visible = ["psens", "padHideTouch", "rumble"].every((id) => $(id).getClientRects().length > 0);
  c.padonly = txt(document.querySelector(".padonly")) === "Choose a controller binding with ✕ or A, then press the button you want. Options or Menu cancels.";
  c.padonlyHidden = document.querySelector(".padonly").getClientRects().length === 0;
  pads(mk({ b: { 2: 1 } })); tick(2); pads(mk()); tick(2);
  c.padonlyShown = document.querySelector(".padonly").getClientRects().length > 0 && document.querySelector(".kbonly").getClientRects().length === 0;
  reset(); DF.saveOpt(); DF.show("title");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("the unrecognised pad note", `
  reset(); DF.show("controls"); pads(mk({ mapping: "" })); tick(2);
  const n = document.getElementById("pnote"), c = {};
  c.shown = n.getClientRects().length > 0 && !n.hidden;
  c.text = n.textContent.replace(/\\s+/g, " ").trim() === "This browser doesn't fully recognise your controller, so buttons may be mixed up. Rebind them below. Chrome and Edge recognise the most controllers.";
  pads(mk()); tick(2);
  c.hidden = n.getClientRects().length === 0;
  pads(mk({ mapping: "" })); tick(2); pads(); tick(2);
  c.none = n.getClientRects().length === 0;
  DF.show("title"); reset();
  return { pass: Object.values(c).every(Boolean), c };`),
  step("names", `
  const pn = DF.padName, kn = DF.keyName;
  const c = { a: pn("P:0", "xbox") === "A", cross: pn("P:0", "ps") === "✕", down: pn("P:13", "ps") === "D-pad down", none: pn(null) === "Unbound", rb: pn("P:5", "xbox") === "RB", options: pn("P:9", "ps") === "Options", share: pn("P:17", "xbox") === "Share", touchpad: pn("P:17", "ps") === "Touchpad" };
  pads(mk()); tick(); pads(mk({ b: { 2: 1 } })); tick(2); c.keyXbox = kn("P:5") === "RB";
  pads(mk()); tick(); pads(mk({ id: "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)", b: { 2: 1 } })); tick(2); c.keyPs = kn("P:5") === "R1";
  c.keyboard = kn("Mouse0") === "Left click" && kn(null) === "Unbound";
  pads(mk()); tick();
  return { pass: Object.values(c).every(Boolean), c };`),
  step("the hint line follows the last input", `
  stage(); const hint = () => document.getElementById("hint").textContent;
  const PS = "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)", c = {};
  pads(mk()); tick(); pads(mk({ b: { 2: 1 } })); tick(2); await draw(); c.xbox = hint().startsWith("RB attack · RT heavy · LB guard");
  pads(mk()); tick(); pads(mk({ id: PS, b: { 2: 1 } })); tick(2); await draw(); c.ps = hint().startsWith("R1 attack · R2 heavy · L1 guard");
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w" })); await draw();
  c.key = hint().startsWith("Left click attack");
  pads(mk()); tick(); pads(mk({ b: { 2: 1 } })); tick(2); await draw(); c.back = hint().startsWith("RB attack");
  c.shown = document.getElementById("hint").getClientRects().length > 0;
  DF.TOUCH.setOn(true); await draw(); c.touchPad = DF.PAD.active && document.getElementById("hint").getClientRects().length > 0;
  DF.PAD.setActive(false); await draw(); c.touchHidden = document.getElementById("hint").getClientRects().length === 0;
  DF.TOUCH.setOn(false); pads(mk()); tick(); pads(mk({ b: { 2: 1 } })); tick(2); await draw();
  DF.setPadBind("light", "P:3"); DF.openMenu("controls"); DF.show("play"); await draw();
  c.rebind = hint().startsWith("Y attack");
  pads(mk()); tick(); reset(); DF.show("title");
  return { pass: Object.values(c).every(Boolean), c, h: hint() };`),
  step("the Execute prompt", `
  const p = stage(), e = G.enemies[0], c = {};
  e.x = p.x; e.z = p.z + 1.5; e.dead = false; e.state = "stagger"; e.t = 0; e.dur = 600; e.aware = true;
  const pr = () => document.getElementById("prompt").textContent.trim();
  pads(mk()); tick(); pads(mk({ b: { 2: 1 } })); tick(2); await draw(); c.xbox = pr() === "RB Execute";
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w" })); await draw();
  c.key = pr() === "Left click Execute";
  DF.TOUCH.setOn(true); await draw(); c.touch = pr() === "ATTACK Execute";
  pads(mk()); tick(); pads(mk({ b: { 2: 1 } })); tick(2); await draw(); c.padOverTouch = pr() === "RB Execute";
  DF.TOUCH.setOn(false); pads(mk()); tick(); reset(); e.x += 1000; e.state = "idle"; DF.show("title");
  return { pass: Object.values(c).every(Boolean), c, pr: pr() };`),
  step("the class kit", `
  const kit = () => { const b = [...document.querySelectorAll("#scr-class .kit b")].find((x) => x.textContent.startsWith("Tool")); return b ? b.querySelector("kbd").innerText.trim() : null; };
  const PS = "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)", c = {};
  DF.openMenu("class"); await draw(); c.key = kit() === DF.keyName(DF.BIND.tool);
  pads(mk()); tick(); pads(mk({ b: { 2: 1 } })); tick(2); await draw(); c.xbox = kit() === "Y";
  pads(mk()); tick(); pads(mk({ id: PS, b: { 2: 1 } })); tick(2); await draw(); c.ps = kit() === "△";
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w" })); await draw(); c.back = kit() === c.key ? true : kit() === DF.keyName(DF.BIND.tool);
  pads(mk()); tick(); reset(); DF.show("title");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("How to play names the pause button", `
  const line = () => [...document.querySelectorAll("#scr-howto li")].find((l) => l.textContent.includes("pauses")).innerText.replace(/\\s+/g, " ").trim();
  const PS = "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)", c = {};
  DF.show("howto"); await draw(); c.key = line().includes("Esc pauses");
  pads(mk()); tick(); pads(mk({ id: PS, b: { 2: 1 } })); tick(2); await draw(); c.ps = line().includes("Options pauses") && !line().includes("Menu");
  pads(mk()); tick(); pads(mk({ b: { 2: 1 } })); tick(2); await draw(); c.xbox = line().includes("Menu pauses") && !line().includes("Options");
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w" })); await draw(); c.back = line().includes("Esc pauses");
  pads(mk()); tick(); reset(); DF.show("title");
  return { pass: Object.values(c).every(Boolean), c, l: line() };`),
  step("every Controls control can be reached by the D-pad", `
  reset(); DF.show("controls"); pads(mk()); tick(2);
  const list = DF.PAD.focusables(), reach = new Set([DF.PAD.focus]), todo = [DF.PAD.focus];
  while (todo.length) {
    const e = todo.pop();
    for (const d of ["up", "down", "left", "right"]) {
      DF.PAD.setFocus(e); DF.PAD.nav(d);
      if (!reach.has(DF.PAD.focus)) { reach.add(DF.PAD.focus); todo.push(DF.PAD.focus); }
    }
  }
  const missed = list.filter((e) => !reach.has(e)).map((e) => e.id || e.dataset.pact || e.textContent);
  DF.show("title");
  return { pass: missed.length === 0 && list.length >= 17, missed, n: list.length };`),
];
