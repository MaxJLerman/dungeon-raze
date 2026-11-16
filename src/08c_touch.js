// ---------- Touch controls ----------
// Draws the on-screen buttons from touchLayout() and puts the health bars,
// map and boss bar into the boxes it gives them. Input handling is not here
// yet. Touch mode starts on when the browser reports a touch screen, or when
// the URL has ?touch=1.
const TOUCH = {
  on: false,
  layout: null,
  fakeInsets: null, // tests only: { l, r, t, b } used in place of the real insets
  forced: false,
  move: { x: 0, y: 0, mag: 0 },
  // set up in init
  init: null,
  update: null,
  setOn: null,
  relayout: null,
  release() {},
};
(() => {
  const SVGNS = "http://www.w3.org/2000/svg";
  // how each button looks: label, then its colour as r,g,b
  const LOOK = {
    light: ["ATTACK", "255,179,71"],
    guard: ["GUARD", "88,224,255"],
    dodge: ["DODGE", "134,201,143"],
    heavy: ["HEAVY", "255,138,92"],
    lock: ["LOCK", "232,226,212"],
    heal: ["FLASK", "216,67,46"],
    tool: ["TOOL", "232,226,212"],
    special: ["ABILITY", "180,140,255"],
  };
  const HUD_BOXES = [
    ["vitals", "vitals"],
    ["map", "map"],
    ["boss", "boss"],
  ];
  let host = null,
    svg = null,
    probe = null,
    readout = null,
    lastKey = "",
    shown = false;

  function detect() {
    const mm = (q) => !!(window.matchMedia && matchMedia(q).matches);
    return (
      mm("(pointer: coarse)") ||
      (mm("(hover: none)") && navigator.maxTouchPoints > 0) ||
      TOUCH.forced
    );
  }
  function insets() {
    const f = TOUCH.fakeInsets || window.__fakeInsets;
    if (f)
      return { l: f.l || 0, r: f.r || 0, t: f.t || 0, b: f.b || 0 };
    const cs = getComputedStyle(probe);
    const n = (v) => parseFloat(v) || 0;
    return {
      l: n(cs.paddingLeft),
      r: n(cs.paddingRight),
      t: n(cs.paddingTop),
      b: n(cs.paddingBottom),
    };
  }
  const el = (name, attrs, parent) => {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  function hexPoints(b) {
    const r = b.d / 2,
      pts = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k;
      pts.push((b.x + r * Math.cos(a)).toFixed(2) + "," + (b.y - r * Math.sin(a)).toFixed(2));
    }
    return pts.join(" ");
  }
  function draw() {
    const L = TOUCH.layout;
    svg.replaceChildren();
    svg.setAttribute("viewBox", "0 0 " + L.W + " " + L.H);
    svg.setAttribute("width", L.W);
    svg.setAttribute("height", L.H);
    // the stick: where it rests, and the ring to push past to sprint
    const st = el("g", { class: "stick", opacity: 0.35 }, svg);
    el("circle", { class: "stick-ring", cx: L.rest.x, cy: L.rest.y, r: L.ring, fill: "none", stroke: "rgba(255,179,71,.55)", "stroke-width": 2, "stroke-dasharray": "6 6" }, st);
    el("circle", { class: "stick-base", cx: L.rest.x, cy: L.rest.y, r: L.R, fill: "rgba(10,13,20,.3)", stroke: "rgba(232,226,212,.5)", "stroke-width": 2 }, st);
    const g = el("g", { class: "btns", opacity: OPT.topac ?? 0.6 }, svg);
    for (const b of L.btns) {
      const [label, col] = LOOK[b.act];
      const dark = b.act === "lock" || b.act === "tool";
      el("polygon", { class: "hex", "data-act": b.act, points: hexPoints(b), fill: dark ? "rgba(10,13,20,.45)" : "rgba(" + col + ",.2)", stroke: "rgba(" + col + ",.85)", "stroke-width": 2, "stroke-linejoin": "round" }, g);
      const t = el("text", { class: "lbl", x: b.x, y: b.y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": clamp(b.d * 0.866 * 0.2, 9, 18), fill: "rgba(255,255,255,.85)" }, g);
      t.textContent = label;
    }
    // pause: a square with two bars
    const q = L.pause,
      pg = el("g", { class: "pause", opacity: OPT.topac ?? 0.6 }, svg);
    el("rect", { x: q.x, y: q.y, width: q.w, height: q.h, rx: 4, fill: "rgba(10,13,20,.45)", stroke: "rgba(232,226,212,.6)", "stroke-width": 2 }, pg);
    const bw = q.w * 0.14,
      bh = q.h * 0.4;
    for (const dx of [-0.17, 0.17])
      el("rect", { x: q.x + q.w / 2 + dx * q.w - bw / 2, y: q.y + (q.h - bh) / 2, width: bw, height: bh, fill: "rgba(232,226,212,.85)" }, pg);
  }
  // inline left/top/width/height for the three HUD parts, or none
  function place(on) {
    const L = TOUCH.layout;
    for (const [id, k] of HUD_BOXES) {
      const e = $(id);
      if (on && L) {
        const b = L[k];
        e.style.left = b.x + "px";
        e.style.top = b.y + "px";
        e.style.width = b.w + "px";
        e.style.height = b.h + "px";
      } else {
        e.style.left = e.style.top = e.style.width = e.style.height = "";
      }
    }
  }
  function relayout() {
    if (!TOUCH.on) return;
    const ins = insets();
    TOUCH.layout = touchLayout(innerWidth, innerHeight, ins, {
      size: OPT.tsize ?? 1,
      notch: OPT.tnotch ?? true,
    });
    lastKey = key();
    draw();
    place(true);
    const L = TOUCH.layout;
    readout.textContent = TOUCH.forced
      ? L.W + "×" + L.H + " · insets " + [ins.l, ins.r, ins.t, ins.b].join(" ") + " · " + L.scale
      : "";
    readout.style.display = TOUCH.forced ? "block" : "none";
  }
  const key = () => {
    const i = insets();
    return [innerWidth, innerHeight, i.l, i.r, i.t, i.b, OPT.tsize, OPT.tnotch, OPT.topac].join("|");
  };
  function setOn(v) {
    TOUCH.on = !!v;
    document.body.classList.toggle("touch", TOUCH.on);
    if (TOUCH.on) relayout();
    else {
      TOUCH.layout = null;
      place(false);
      svg.replaceChildren();
      readout.style.display = "none";
    }
  }
  TOUCH.init = () => {
    host = $("touch");
    svg = host.querySelector("svg");
    readout = $("treadout");
    probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(probe);
    TOUCH.forced = /[?&]touch=1(&|$)/.test(location.search);
    const re = () => relayout();
    addEventListener("resize", re);
    addEventListener("orientationchange", re);
    if (window.visualViewport) visualViewport.addEventListener("resize", re);
    setOn(detect());
  };
  TOUCH.setOn = setOn;
  TOUCH.relayout = relayout;
  // runs every frame: the buttons show only while playing, and a change in
  // size, insets or settings that no event reported is picked up here
  TOUCH.update = (dt) => {
    if (!TOUCH.on) return;
    const s = G.state === "play";
    if (s !== shown) {
      shown = s;
      host.classList.toggle("show", s);
    }
    if (key() !== lastKey) relayout();
  };
})();
