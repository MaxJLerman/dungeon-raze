// Controller buttons on the desktop page: bindings, triggers, which input is
// active, the first press of a new pad, drift, unreadable pads.
// Run with: SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.
//
// A fake pad comes from window.__pads. G.manual stops the frame loop from
// polling, so each step polls the pads itself, once per simulated tick.
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
    Object.assign(DF.PAD_BIND, DF.DEFAULT_PAD); window.__rumble = [];
    pads(); tick(); DF.PAD.setActive(false);
  };
  const stage = () => { DF.newRun(99); DF.show("play"); const p = G.player, n = G.world.nodes.find((q) => q.kind === "room"); for (const o of G.enemies) o.x += 1000; p.x = n.x; p.z = n.z; p.yaw = 0; cam.yaw = 0; p.lock = null; return p; };
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
    pads(); tick(2);
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
  pads(); tick();
  window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w" }));
  c.key = DF.PAD.active === false && !document.body.classList.contains("pad");
  pads(mk({ b: { 0: 1 } })); tick(2); pads(); tick();
  window.dispatchEvent(new MouseEvent("mousemove", { movementX: 5 }));
  c.mouse = DF.PAD.active === false;
  pads(mk({ b: { 1: 1 } })); tick(); pads(); tick();
  window.dispatchEvent(new MouseEvent("mousemove", { movementX: 0, movementY: 0 }));
  c.stillMouse = DF.PAD.active === true;
  window.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "touch" }));
  c.touch = DF.PAD.active === false;
  pads(mk({ b: { 1: 1 } })); tick(); pads(); tick();
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
  pads(mk({ axes: [0.15, -0.12, 0.18, 0.1] }));
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
  pads(mk({ id: "054c-0ce6-DualSense Wireless Controller", b: { 0: 1 } })); tick(); const ps = DF.PAD.fam;
  pads(); tick();
  pads(mk({ b: { 0: 1 } })); tick(); const xb = DF.PAD.fam;
  pads(); tick();
  pads(mk({ id: "Wireless Controller (STANDARD GAMEPAD)", b: { 0: 1 } })); tick(); const ps2 = DF.PAD.fam;
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
];
