// A controller with touch on a phone: the buttons give way to it and come back.
// Run with: DEVICE=oneplus-13 SCRIPT=$PWD/tests/t17.mjs node test.mjs smoke
// Shots go to shots/oneplus-13-pad-touch-fight.png and shots/oneplus-13-pad-controls.png.
// Every step returns an object with a boolean `pass`.
// The fake pad prelude is the one of t16. G.manual stops the frame loop from
// polling, so each step polls the pads itself. A real touch is sent with __touch.
const step = (name, body, shot) => ({
  name,
  shot,
  eval: `(async () => { const { G, cam, keys, taps, mouse, TOUCH } = DF; G.manual = true;
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
  const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const reset = () => {
    Object.assign(DF.PAD_BIND, DF.DEFAULT_PAD); Object.assign(DF.BIND, DF.DEFAULT_BINDS);
    Object.assign(DF.OPT, { psens: 1, padHideTouch: true, rumble: true });
    window.__rumble = []; DF.PAD.endRebind();
    pads(); tick(); DF.PAD.setActive(false);
  };
  const L = () => TOUCH.layout;
  const btn = (act) => L().btns.find((b) => b.act === act);
  const shown = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== "none"; };
  const play = () => { DF.newRun(99); DF.show("play"); TOUCH.release(); for (const k in taps) taps[k] = false; mouse.dx = mouse.dy = 0; };
  reset();
  ${body} })()`,
});
export default [
  step("buttons hide while a pad is connected", `
    play(); await draw();
    const before = { btns: shown("#touch .btns"), stick: shown("#touch .stick"), body: document.body.classList.contains("padhide") };
    pads(mk()); tick(); await draw();
    const a = btn("light");
    const c = {
      touchOn: TOUCH.on === true,
      beforeShown: before.btns && before.stick && !before.body,
      padhide: document.body.classList.contains("padhide"),
      btnsGone: !shown("#touch .btns"),
      stickGone: !shown("#touch .stick"),
      pauseShown: shown("#touch .pause"),
      flasks: shown("#flasks") && shown("#knives"),
    };
    // a touch where Attack was does not press it, and a drag from there turns the camera
    const y0 = cam.yaw;
    await __touch("touchStart", [{ id: 1, x: a.x, y: a.y }]);
    await draw();
    c.noPress = keys["T:light"] !== true;
    await __touch("touchMove", [{ id: 1, x: a.x - 90, y: a.y }]);
    await draw();
    c.camera = Math.abs(cam.yaw - y0) > 0.05;
    await __touch("touchEnd", [{ id: 1, x: a.x - 90, y: a.y }]);
    await draw();
    c.lifted = TOUCH.owners.size === 0 && keys["T:light"] !== true;
    return { pass: Object.values(c).every((v) => v === true), c, before, dyaw: cam.yaw - y0 };`),
  step("the stick area turns the camera too", `
    play(); pads(mk()); tick(); await draw();
    const r = L().rest, c = {};
    const y0 = cam.yaw;
    await __touch("touchStart", [{ id: 1, x: r.x, y: r.y }]);
    await __touch("touchMove", [{ id: 1, x: r.x + 70, y: r.y }]);
    await draw();
    c.camera = Math.abs(cam.yaw - y0) > 0.05;
    c.noStick = TOUCH.move.mag === 0 && keys["T:sprint"] !== true;
    await __touch("touchEnd", [{ id: 1, x: r.x + 70, y: r.y }]);
    await draw();
    return { pass: Object.values(c).every((v) => v === true), c };`),
  step("a finger held when the pad arrives is dropped", `
    play(); await draw();
    const a = btn("light");
    await __touch("touchStart", [{ id: 1, x: a.x, y: a.y }]);
    await draw();
    const held = keys["T:light"] === true && TOUCH.owners.size === 1;
    pads(mk()); tick(); await draw();
    const c = { held, released: keys["T:light"] !== true && TOUCH.owners.size === 0 };
    await __touch("touchEnd", [{ id: 1, x: a.x, y: a.y }]);
    await draw();
    return { pass: Object.values(c).every((v) => v === true), c };`),
  step("buttons come back", `
    play(); pads(mk()); tick(); await draw();
    const c = { hid: document.body.classList.contains("padhide") };
    // the pad goes: play pauses, and resuming shows the buttons again
    pads(); tick(); await draw();
    c.paused = G.state === "pause";
    c.padhideGone = !document.body.classList.contains("padhide");
    DF.show("play"); await draw();
    c.btnsBack = shown("#touch .btns") && shown("#touch .stick");
    const a = btn("light");
    await __touch("touchStart", [{ id: 1, x: a.x, y: a.y }]);
    await draw();
    c.press = keys["T:light"] === true;
    await __touch("touchEnd", [{ id: 1, x: a.x, y: a.y }]);
    await draw();
    // the setting off: a connected pad leaves the buttons showing
    DF.OPT.padHideTouch = false; pads(mk()); tick(); await draw();
    c.settingOff = !document.body.classList.contains("padhide") && shown("#touch .btns") && shown("#touch .stick");
    DF.OPT.padHideTouch = true; await draw();
    c.settingOn = document.body.classList.contains("padhide") && !shown("#touch .btns");
    // touch mode off: no padhide even with a pad
    TOUCH.setOn(false); await draw();
    c.touchOff = !document.body.classList.contains("padhide");
    TOUCH.setOn(true); await draw();
    reset(); DF.show("title");
    return { pass: Object.values(c).every((v) => v === true), c };`),
  step("the Controller column on a phone", `
    reset(); DF.show("controls"); await draw();
    const none = { binds: shown("#binds") };
    pads(mk()); tick(2); await draw();
    const binds = document.getElementById("binds");
    const acts = [...binds.querySelectorAll("button[data-act]")].filter((b) => getComputedStyle(b).display !== "none");
    const c = { before: !none.binds, binds: shown("#binds"), noKeyButtons: acts.length === 0, padRows: binds.querySelectorAll("[data-pact]").length > 0 };
    reset(); DF.show("title");
    return { pass: Object.values(c).every((v) => v === true), c, n: acts.length };`),
  step("a pad cannot resume play behind the rotate overlay", `
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (e) {} await new Promise((r) => setTimeout(r, 150)); }
    play(); pads(mk()); tick(); await draw();
    const W = innerWidth, H = innerHeight;
    const press = (b) => { let s = null; pads(mk({ b: { [b]: 1 } })); DF.sim(1 / 60, () => { DF.PAD.poll(1 / 60); s = G.state; }); pads(mk()); tick(2); return s; };
    press(9); await draw();
    const c = { paused: G.state === "pause", focus: !!DF.PAD.focus };
    try { await __viewport(H, W); } catch (e) { return { pass: false, c, e: String(e) }; } await draw(); await draw(); TOUCH.checkPortrait();
    c.portrait = document.body.classList.contains("portrait");
    c.noFocusables = DF.PAD.focusables().length === 0;
    c.menu = press(9) === "pause";
    c.back = press(1) === "pause";
    c.a = press(0) === "pause";
    if (document.fullscreenElement) { try { await document.exitFullscreen(); } catch (e) {} await new Promise((r) => setTimeout(r, 300)); }
    try { await __viewport(W, H); } catch (e) { c.restore = String(e); } await draw(); await draw(); TOUCH.checkPortrait();
    c.landscape = !document.body.classList.contains("portrait");
    DF.show("title"); reset();
    return { pass: Object.values(c).every((v) => v === true), c };`),
  step("a touch keeps the pad prompts while the buttons are hidden", `
    play(); pads(mk()); tick(2); pads(mk({ b: { 0: 1 } })); tick(); pads(mk()); tick(2); await draw(); await draw();
    const c = { active: DF.PAD.active === true, padhide: document.body.classList.contains("padhide"), hint: shown("#hint") };
    const a = btn("light");
    await __touch("touchStart", [{ id: 1, x: a.x, y: a.y }]);
    await draw();
    c.stillActive = DF.PAD.active === true && document.body.classList.contains("pad");
    await __touch("touchEnd", [{ id: 1, x: a.x, y: a.y }]);
    await draw();
    // the buttons showing: the hint line stays out of their way, and a touch hands the prompts to touch
    DF.OPT.padHideTouch = false; await draw(); await draw();
    c.visible = !document.body.classList.contains("padhide") && shown("#touch .btns");
    c.noHint = !shown("#hint");
    await __touch("touchStart", [{ id: 1, x: a.x, y: a.y }]);
    await draw();
    c.handedBack = DF.PAD.active === false;
    await __touch("touchEnd", [{ id: 1, x: a.x, y: a.y }]);
    await draw();
    DF.OPT.padHideTouch = true; reset(); DF.show("title");
    return { pass: Object.values(c).every((v) => v === true), c };`),
  step("pad touch fight shot", `
    play(); const p = G.player, n = G.world.nodes.find((q) => q.kind === "room");
    const e = G.enemies.find((q) => q.type === "husk") || G.enemies[0];
    for (const o of G.enemies) if (o !== e) o.x += 1000;
    e.x = n.x; e.z = n.z + 3; e.aware = true; e.state = "idle"; e.hp = e.def.hp;
    p.x = n.x; p.z = n.z - 2; p.yaw = 0; p.lock = null;
    cam.yaw = 0; cam.pitch = 0.25; cam.px = p.x; cam.pz = p.z; cam.cd = 5.6;
    const PS = "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)";
    pads(mk({ id: PS, axes: [0, 0, 0.9, 0] })); tick(); pads(mk({ id: PS })); tick(); cam.yaw = 0;
    await draw(); await draw();
    const c = { padhide: document.body.classList.contains("padhide"), btnsGone: !shown("#touch .btns"), stickGone: !shown("#touch .stick"), pause: shown("#touch .pause"), hint: shown("#hint") };
    return { pass: Object.values(c).every((v) => v === true), c };`, "pad-touch-fight"),
  step("pad controls shot", `
    const PS = "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)";
    DF.show("controls"); pads(mk({ id: PS })); tick(); pads(mk({ id: PS, b: { 2: 1 } })); tick(2); pads(mk({ id: PS })); tick(2);
    await draw(); await draw();
    const c = { active: DF.PAD.active === true, focus: !!DF.PAD.focus, binds: shown("#binds") };
    return { pass: Object.values(c).every((v) => v === true), c };`, "pad-controls"),
  { name: "leave", eval: `(async () => { DF.PAD.setActive(false); window.__pads = []; DF.PAD.poll(0); DF.show("title"); return { pass: true }; })()` },
];
