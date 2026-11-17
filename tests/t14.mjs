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
    up: async (id) => { const p = pts.get(id); pts.delete(id); await __touch("touchEnd", [...pts].map(([i, q]) => ({ id: i, x: q.x, y: q.y }))); },
    cancel: async () => { pts.clear(); await __touch("touchCancel", []); },
  };
  const L = () => TOUCH.layout;
  const btn = (act) => L().btns.find((b) => b.act === act);
  const play = () => { DF.newRun(99); DF.show("play"); TOUCH.release(); };
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
];
