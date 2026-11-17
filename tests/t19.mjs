// Plaques by touch: the Inspect prompt, the D-pad and the close area.
// Run with: DEVICE=oneplus-13 SCRIPT=$PWD/tests/t19.mjs node test.mjs hub
// or on every device: node tests/touch-all.mjs tests/t19.mjs hub
// Every step returns an object with a boolean `pass`.
const step = (name, body) => ({
  name,
  eval: `(async () => { const { G, cam, TOUCH } = DF; G.manual = true;
  const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const L = () => TOUCH.layout;
  const btn = (act) => L().btns.find((b) => b.act === act);
  const mid = (b) => [b.x + b.w / 2, b.y + b.h / 2];
  let id = 1;
  const tapAt = async ([x, y]) => { const n = id++; await __touch("touchStart", [{ id: n, x, y }]); await draw();
    DF.sim(0.05); await __touch("touchEnd", [{ id: n, x, y }]); await draw(); DF.sim(0.05); };
  const stand = () => { DF.show("play"); TOUCH.release(); const p = G.player, q = G.world.plaques[0], f = DF.plaqueFront(q, 1.6);
    p.x = f.x; p.z = f.z; p.yaw = cam.yaw = q.yaw + Math.PI; p.state = "free"; DF.sim(0.05); return p; };
  ${body} })()`,
});

export default [
  step("touch: prompt opens, D-pad and buttons enter, the plaque closes", `
    DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "fwd back left right dodge heal tool dodge"); DF.enterHub(); const p = stand(); await draw();
    const prompt = document.getElementById("prompt"), shown = getComputedStyle(prompt).display !== "none" && /Inspect/.test(prompt.textContent);
    await tapAt(mid(L().prompt)); DF.sim(0.6); await draw(); const open = p.state === "inspect";
    const dp = L().dpad, r = dp.d / 3;
    const at = { U: [dp.x, dp.y - r], D: [dp.x, dp.y + r], L: [dp.x - r, dp.y], R: [dp.x + r, dp.y],
      B: [btn("dodge").x, btn("dodge").y], X: [btn("heal").x, btn("heal").y], Y: [btn("tool").x, btn("tool").y] };
    for (const ch of "UDLRBXYB") await tapAt(at[ch]);
    const unlocked = DF.UNLOCKED.has("enforcer"), still = p.state === "inspect";
    await tapAt(mid(L().close)); DF.sim(0.6); const shut = G.insp === null && p.state === "free";
    DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes();
    return { pass: shown && open && unlocked && still && shut, shown, open, unlocked, still, shut };`),
  step("touch: the plaque marks name the D-pad and buttons", `
    DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "tool tool tool tool"); DF.enterHub(); const p = stand(); await draw();
    await tapAt(mid(L().prompt)); DF.sim(0.6); await draw();
    const dp = L().dpad, r = dp.d / 3; await tapAt([dp.x + r, dp.y]); await tapAt([btn("heal").x, btn("heal").y]); await draw();
    const marks = [...document.querySelectorAll("#plaqueMarks .on")].map((e) => e.textContent).join(" ");
    DF.closePlaque(true); DF.resetPlaqueCodes();
    return { pass: marks === "→ FLASK", marks };`),
  step("touch: the D-pad shows only while inspecting, and the stick is idle", `
    DF.enterHub(); const p = stand(); await draw();
    const dp = () => document.querySelector("#touch .dpad"), vis = () => !!dp() && getComputedStyle(dp()).display !== "none";
    const before = !vis();
    p.state = "free"; DF.openPlaque(G.world.plaques[0]); DF.sim(0.6); await draw(); const during = vis();
    const d = L().dpad; await __touch("touchStart", [{ id: 99, x: d.x + d.d / 2 + 30, y: d.y }]); await draw();
    await __touch("touchMove", [{ id: 99, x: d.x + d.d / 2 + 90, y: d.y }]); await draw(); DF.sim(0.05);
    const idle = TOUCH.move.mag === 0; await __touch("touchEnd", [{ id: 99, x: d.x + d.d / 2 + 90, y: d.y }]); await draw();
    DF.closePlaque(true); await draw(); const after = !vis();
    return { pass: before && during && idle && after, before, during, idle, after };`),
  step("touch: on a cramped screen a tap on a button under the card closes it", `
    // a fullscreen window cannot be resized; leaving it pauses, and stand() plays again
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); await draw();
    const w0 = innerWidth, h0 = innerHeight; await __viewport(460, 280); await draw(); await draw(); TOUCH.relayout(); await draw();
    DF.enterHub(); const p = stand(); DF.openPlaque(G.world.plaques[0]); DF.sim(0.6); await draw();
    const c = L().close, inC = (x, y) => x > c.x + 2 && x < c.x + c.w - 2 && y > c.y + 2 && y < c.y + c.h - 2;
    // a point inside the card and inside a button that does nothing at a plaque
    let at = null;
    for (const b of L().btns) if (!["dodge", "heal", "tool"].includes(b.act))
      for (let dx = -b.d / 3; dx <= b.d / 3 && !at; dx += 2) for (let dy = -b.d / 3; dy <= b.d / 3 && !at; dy += 2)
        if (DF.hexContains(b, b.x + dx, b.y + dy) && inC(b.x + dx, b.y + dy)) at = [b.x + dx, b.y + dy, b.act];
    if (at) await tapAt(at); DF.sim(0.6);
    const shut = G.insp === null; DF.closePlaque(true);
    await __viewport(w0, h0); await draw(); await draw(); TOUCH.relayout(); await draw();
    return { pass: !!at && shut, at, shut };`),
];
