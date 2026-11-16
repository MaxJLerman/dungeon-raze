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
];
