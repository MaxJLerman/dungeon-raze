// ---------- Touch controls ----------
// Draws the on-screen buttons from touchLayout() and puts the health bars,
// map and boss bar into the boxes it gives them. Every finger belongs to the
// control it first touched, whatever it slides over afterwards: a button sets
// keys["T:act"] and taps["T:act"], read through held() and hit(). The stick and
// the camera area are classified here but acted on later. Touch mode starts on
// when the browser reports a touch screen, or when the URL has ?touch=1.
const TOUCH = {
  on: false,
  layout: null,
  fakeInsets: null, // tests only: { l, r, t, b } used in place of the real insets
  forced: false,
  move: { x: 0, y: 0, mag: 0 },
  // pointerId -> { kind: "btn"|"pause"|"move"|"look", act?, x0, y0, t0, x, y }
  owners: new Map(),
  // set up in init
  init: null,
  update: null,
  setOn: null,
  relayout: null,
  checkPortrait: null,
  enterPlay: null,
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
  // buttons that show how many are left
  const COUNTS = { heal: "flasks", tool: "tool" };
  // whether the D-pad is drawn, for the plaque being open
  let dpadShown = null;
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
    shown = false,
    insC = null, // the probe's insets, read again only after a resize
    btnEls = {},
    stickEls = null;

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
    if (insC) return insC;
    const cs = getComputedStyle(probe);
    const n = (v) => parseFloat(v) || 0;
    return (insC = {
      l: n(cs.paddingLeft),
      r: n(cs.paddingRight),
      t: n(cs.paddingTop),
      b: n(cs.paddingBottom),
    });
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
    const ring = el("circle", { class: "stick-ring", cx: L.rest.x, cy: L.rest.y, r: L.ring, fill: "none", stroke: "rgba(255,179,71,.55)", "stroke-width": 2, "stroke-dasharray": "6 6" }, st);
    const base = el("circle", { class: "stick-base", cx: L.rest.x, cy: L.rest.y, r: L.R, fill: "rgba(10,13,20,.3)", stroke: "rgba(232,226,212,.5)", "stroke-width": 2 }, st);
    const knob = el("circle", { class: "stick-knob", cx: L.rest.x, cy: L.rest.y, r: L.R * 0.42, fill: "rgba(232,226,212,.35)", stroke: "rgba(232,226,212,.8)", "stroke-width": 2 }, st);
    stickEls = { g: st, ring, base, knob };
    const g = el("g", { class: "btns" }, svg);
    btnEls = {};
    for (const b of L.btns) {
      const [label, col] = LOOK[b.act];
      const dark = b.act === "lock" || b.act === "tool";
      const bg = el("g", { class: "btn", "data-act": b.act }, g);
      const poly = el("polygon", { class: "hex", "data-act": b.act, points: hexPoints(b), fill: dark ? "rgba(10,13,20,.45)" : "rgba(" + col + ",.2)", stroke: "rgba(" + col + ",.85)", "stroke-width": 2, "stroke-linejoin": "round" }, bg);
      const counted = !!COUNTS[b.act],
        fs = clamp(b.d * 0.866 * 0.2, 9, 18);
      const t = el("text", { class: "lbl", x: b.x, y: counted ? b.y - b.d * 0.12 : b.y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": fs, fill: "rgba(255,255,255,.85)" }, bg);
      t.textContent = label;
      let cnt = null;
      if (counted) {
        cnt = el("text", { class: "lbl cnt", "data-act": b.act, x: b.x, y: b.y + b.d * 0.2, "text-anchor": "middle", "dominant-baseline": "central", "font-size": fs * 1.4, fill: "rgba(255,255,255,.95)" }, bg);
      }
      btnEls[b.act] = { g: bg, poly, cnt };
    }
    refresh();
    drawStick(null);
    // the D-pad for entering a plaque's code, shown only while one is open
    const d = L.dpad,
      a = d.d / 3,
      dg = el("g", { class: "dpad" }, svg);
    for (const [dir, ox, oy, pts] of [
      ["fwd", 0, -1, [0, -0.32, -0.22, 0.12, 0.22, 0.12]],
      ["back", 0, 1, [0, 0.32, -0.22, -0.12, 0.22, -0.12]],
      ["left", -1, 0, [-0.32, 0, 0.12, -0.22, 0.12, 0.22]],
      ["right", 1, 0, [0.32, 0, -0.12, -0.22, -0.12, 0.22]],
    ]) {
      const cx = d.x + ox * a,
        cy = d.y + oy * a,
        ag = el("g", { class: "btn", "data-act": dir }, dg);
      const poly = el("rect", { class: "arm", x: cx - a / 2, y: cy - a / 2, width: a, height: a, rx: 6, fill: "rgba(10,13,20,.45)", stroke: "rgba(232,226,212,.75)", "stroke-width": 2 }, ag);
      el("polygon", { points: [0, 2, 4].map((i) => cx + pts[i] * a + "," + (cy + pts[i + 1] * a)).join(" "), fill: "rgba(232,226,212,.85)" }, ag);
      btnEls[dir] = { g: ag, poly, cnt: null };
    }
    // drawn as things stand, so the next idle frame has nothing to change
    dpadShown = G.state === "play" && !!G.insp;
    dg.style.display = dpadShown ? "" : "none";
    stickEls.g.style.display = dpadShown ? "none" : "";
    // pause: a square with two bars
    const q = L.pause,
      pg = el("g", { class: "pause" }, svg);
    el("rect", { x: q.x, y: q.y, width: q.w, height: q.h, rx: 4, fill: "rgba(10,13,20,.45)", stroke: "rgba(232,226,212,.6)", "stroke-width": 2 }, pg);
    const bw = q.w * 0.14,
      bh = q.h * 0.4;
    for (const dx of [-0.17, 0.17])
      el("rect", { x: q.x + q.w / 2 + dx * q.w - bw / 2, y: q.y + (q.h - bh) / 2, width: bw, height: bh, fill: "rgba(232,226,212,.85)" }, pg);
  }
  // the stick is drawn where the finger landed, with the knob at the finger
  // clamped to the base; with no finger it goes back to its faint rest place
  function drawStick(o) {
    if (!stickEls) return;
    const L = TOUCH.layout,
      c = o ? { x: o.x0, y: o.y0 } : L.rest;
    let kx = c.x,
      ky = c.y;
    if (o) {
      const dx = o.x - o.x0,
        dy = o.y - o.y0,
        d = Math.hypot(dx, dy),
        k = d > L.R ? L.R / d : 1;
      kx += dx * k;
      ky += dy * k;
    }
    for (const n of ["ring", "base"]) {
      stickEls[n].setAttribute("cx", c.x);
      stickEls[n].setAttribute("cy", c.y);
    }
    stickEls.knob.setAttribute("cx", kx);
    stickEls.knob.setAttribute("cy", ky);
    stickEls.g.setAttribute("opacity", o ? 0.9 : 0.35);
  }
  // counts on the buttons, and dimming of the ones that cannot be used now
  function refresh() {
    const p = G.player;
    if (!p || !p.cls) return;
    for (const act in btnEls) {
      const e = btnEls[act];
      let empty = false;
      if (COUNTS[act]) {
        const n = p[COUNTS[act]];
        if (e.n !== n) {
          e.n = n;
          e.cnt.textContent = n;
        }
        empty = !(n > 0);
      } else if (act === "special") empty = p.focus < p.cls.special.cost;
      if (e.empty !== empty) {
        e.empty = empty;
        e.g.classList.toggle("empty", empty);
        e.poly.classList.toggle("empty", empty);
      }
    }
  }
  // inline left/top/width/height for the three HUD parts, or none
  function place(on) {
    const L = TOUCH.layout;
    // the prompt sits in its box; the plaque card takes its size, and the HUD
    // centres it
    const pr = $("prompt"),
      pc = $("plaque");
    if (on && L) {
      Object.assign(pr.style, { left: L.prompt.x + "px", top: L.prompt.y + "px", width: L.prompt.w + "px", height: L.prompt.h + "px" });
      Object.assign(pc.style, { width: L.close.w + "px", height: L.close.h + "px" });
    } else {
      for (const e of [pr, pc]) e.style.left = e.style.top = e.style.width = e.style.height = "";
    }
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
  // a touch device held upright shows only a request to turn it; playing stops
  function checkPortrait() {
    const p = TOUCH.on && innerHeight > innerWidth;
    document.body.classList.toggle("portrait", p);
    if (p && G.state === "play") show("pause");
    return p;
  }
  TOUCH.checkPortrait = checkPortrait;
  function relayout() {
    if (!TOUCH.on) return;
    // a finger that was on a control that moves is no longer on it
    release();
    // the layout is for landscape; upright there is nothing to lay out
    if (checkPortrait()) {
      lastKey = key();
      return;
    }
    const ins = insets();
    TOUCH.layout = touchLayout(innerWidth, innerHeight, ins, {
      size: clamp(Number(OPT.tsize) || 1, 0.8, 1.2),
      notch: OPT.tnotch !== false,
    });
    host.style.setProperty("--tac", clamp(Number(OPT.topac) || 0.6, 0.2, 1));
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
    v = !!v;
    // no finger or T: key may stay held when the controls go away
    if (TOUCH.on && !v) release();
    TOUCH.on = v;
    document.body.classList.toggle("touch", v);
    if (v) {
      insC = null;
      relayout();
      // show the buttons now, not at the next frame, so the next touch lands on them
      shown = G.state === "play";
      host.classList.toggle("show", shown);
    } else {
      TOUCH.layout = null;
      place(false);
      svg.replaceChildren();
      btnEls = {};
      stickEls = null;
      readout.style.display = "none";
      shown = false;
      host.classList.remove("show");
      checkPortrait();
    }
  }
  // ---- fingers ----
  const owners = TOUCH.owners;
  const heldBy = (act) => {
    for (const o of owners.values()) if (o.kind === "btn" && o.act === act) return true;
    return false;
  };
  function lift(id) {
    const o = owners.get(id);
    if (!o) return null;
    owners.delete(id);
    if (o.kind === "btn" && !heldBy(o.act)) {
      keys["T:" + o.act] = false;
      if (btnEls[o.act]) {
        btnEls[o.act].g.classList.remove("down");
        btnEls[o.act].poly.classList.remove("down");
      }
    }
    if (o.kind === "move") {
      TOUCH.move.x = TOUCH.move.y = TOUCH.move.mag = 0;
      keys["T:sprint"] = false;
      drawStick(null);
    }
    return o;
  }
  function release() {
    for (const id of [...owners.keys()]) lift(id);
    for (const k in keys) if (k.startsWith("T:")) keys[k] = false;
    for (const act in btnEls) {
      btnEls[act].g.classList.remove("down");
      btnEls[act].poly.classList.remove("down");
    }
    TOUCH.move.x = TOUCH.move.y = TOUCH.move.mag = 0;
    drawStick(null);
  }
  TOUCH.release = release;
  const accepts = (e) =>
    e.pointerType === "touch" || e.pointerType === "pen" || (TOUCH.forced && e.pointerType === "mouse");
  const inBox = (q, x, y) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h;
  // the Inspect prompt shows, so a tap on it opens the plaque
  const promptUp = () =>
    G.zone === "hub" && G.player && G.player.state === "free" && !G.insp && !!plaqueAt();
  function classify(x, y) {
    const L = TOUCH.layout,
      // with a pad connected the buttons and stick are gone, so a finger there turns the camera
      hid = document.body.classList.contains("padhide");
    if (G.insp) {
      // a plaque is open: the D-pad and the buttons enter its code, a tap on
      // the plaque closes it, and nothing moves or turns
      const d = L.dpad,
        dx = x - d.x,
        dy = y - d.y,
        a = d.d / 6;
      if (!hid && Math.max(Math.abs(dx), Math.abs(dy)) <= d.d / 2 && Math.min(Math.abs(dx), Math.abs(dy)) <= a)
        if (Math.max(Math.abs(dx), Math.abs(dy)) > a)
          return { kind: "btn", act: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "back" : "fwd" };
      // the code buttons first; the card takes taps on any other it covers
      if (!hid)
        for (const b of L.btns)
          if (CODE_BTNS.includes(b.act) && hexContains(b, x, y)) return { kind: "btn", act: b.act };
      if (inBox(L.pause, x, y)) return { kind: "pause" };
      if (inBox(L.close, x, y)) return { kind: "btn", act: "interact" };
      if (!hid) for (const b of L.btns) if (hexContains(b, x, y)) return { kind: "btn", act: b.act };
      return { kind: "none" };
    }
    if (promptUp() && inBox(L.prompt, x, y)) return { kind: "btn", act: "interact" };
    if (!hid) for (const b of L.btns) if (hexContains(b, x, y)) return { kind: "btn", act: b.act };
    const q = L.pause;
    if (x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) return { kind: "pause" };
    const m = L.move;
    // one stick: a second finger in its area turns the camera instead
    if (!hid && x >= m.x0 && x <= m.x1 && y >= m.y0 && y <= m.y1 && !hasKind("move"))
      return { kind: "move" };
    return { kind: "look" };
  }
  const hasKind = (k) => {
    for (const o of owners.values()) if (o.kind === k) return true;
    return false;
  };
  // the stick's vector, from where the finger landed
  function steer(o) {
    const L = TOUCH.layout,
      dx = o.x - o.x0,
      dy = o.y - o.y0,
      d = Math.hypot(dx, dy),
      raw = d / L.R,
      m = TOUCH.move;
    m.mag = raw < 0.15 ? 0 : Math.min(1, (raw - 0.15) / 0.85);
    m.x = m.mag > 0 ? dx / d : 0;
    m.y = m.mag > 0 ? -dy / d : 0;
    keys["T:sprint"] = d > L.ring;
    drawStick(o);
  }
  // turns the camera as a mouse would: a drag of the screen's width is half a turn
  function look(dxPx, dyPx) {
    const W = TOUCH.layout.W;
    mouse.dx += (dxPx * Math.PI) / (W * cam.sens);
    mouse.dy += (dyPx * Math.PI) / (W * cam.sens);
  }
  // a quick sideways swipe of a look finger switches the lock target
  function flick(o, t) {
    const h = o.hist;
    h.push({ t, x: o.x, y: o.y });
    while (h.length > 1 && t - h[0].t > 250) h.shift();
    if (o.flicked || !G.player || !G.player.lock) return;
    const dx = o.x - h[0].x,
      dy = o.y - h[0].y;
    if (Math.abs(dx) >= Math.max(40, 0.06 * TOUCH.layout.W) && Math.abs(dx) > 2 * Math.abs(dy)) {
      mouse.wheel = Math.sign(dx);
      o.flicked = true;
    }
  }
  function onDown(e) {
    if (!TOUCH.on || !TOUCH.layout || !accepts(e) || G.state !== "play") return;
    e.preventDefault();
    try {
      host.setPointerCapture(e.pointerId);
    } catch (err) {}
    if (owners.has(e.pointerId)) lift(e.pointerId);
    const o = classify(e.clientX, e.clientY);
    o.x0 = o.x = e.clientX;
    o.y0 = o.y = e.clientY;
    if (o.kind === "move") {
      // the stick body stays inside its area, clear of the health bars
      const m = TOUCH.layout.move,
        R = TOUCH.layout.R;
      o.x0 = o.x0 < m.x0 + R ? m.x0 + R : o.x0 > m.x1 - R ? m.x1 - R : o.x0;
      o.y0 = o.y0 < m.y0 + R ? m.y0 + R : o.y0 > m.y1 - R ? m.y1 - R : o.y0;
    }
    o.t0 = performance.now();
    o.hist = [{ t: o.t0, x: o.x, y: o.y }];
    owners.set(e.pointerId, o);
    if (o.kind === "move") steer(o);
    if (o.kind === "btn") {
      keys["T:" + o.act] = true;
      taps["T:" + o.act] = true;
      if (btnEls[o.act]) {
        btnEls[o.act].g.classList.add("down");
        btnEls[o.act].poly.classList.add("down");
      }
    }
  }
  function onMove(e) {
    const o = owners.get(e.pointerId);
    if (!o || !accepts(e)) return;
    e.preventDefault();
    // a frame may bring several moves in one event; each is read in order
    const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const s of list.length ? list : [e]) {
      const dx = s.clientX - o.x,
        dy = s.clientY - o.y;
      o.x = s.clientX;
      o.y = s.clientY;
      if (o.kind === "look") {
        look(dx, dy);
        flick(o, s.timeStamp);
      } else if (o.kind === "btn" && o.act === "light") {
        // the Attack finger aims once it has clearly moved
        if (!o.aim && Math.hypot(o.x - o.x0, o.y - o.y0) > 8) o.aim = true;
        if (o.aim) look(dx, dy);
      }
    }
    if (o.kind === "move") steer(o);
  }
  function onUp(e) {
    const o = owners.get(e.pointerId);
    if (!o || !accepts(e)) return;
    e.preventDefault();
    o.x = e.clientX;
    o.y = e.clientY;
    lift(e.pointerId);
    if (o.kind === "pause" && e.type === "pointerup" && G.state === "play") show("pause");
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
    for (const t of ["pointerdown", "pointermove", "pointerup", "pointercancel"])
      host.addEventListener(t, t === "pointerdown" ? onDown : t === "pointermove" ? onMove : onUp);
    // the last input decides the mode: a key or a mouse brings back the desktop
    // controls, a touch brings back the buttons. A forced page stays as it is.
    // Keys a phone sends without a keyboard (volume, media, an on-screen
    // keyboard's composition) do not count as a keyboard.
    addEventListener("keydown", (e) => {
      if (!TOUCH.on || TOUCH.forced) return;
      if (e.isComposing || e.keyCode === 229) return;
      if (!e.code || e.code === "Unidentified" || /^(Audio|Media)/.test(e.code)) return;
      setOn(false);
    });
    addEventListener("pointermove", (e) => {
      if (TOUCH.on && !TOUCH.forced && e.pointerType === "mouse") setOn(false);
    });
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (TOUCH.on || e.pointerType !== "touch") return;
        setOn(true);
        // the touch that woke the controls is the first press on them
        onDown(e);
      },
      true,
    );
    // The Back gesture pauses the game instead of leaving the page. Back on the
    // pause screen or a menu stays where it is, as its Back button would.
    addEventListener("popstate", () => {
      armed = false;
      if (!TOUCH.on) return;
      if (G.state === "play") {
        show("pause");
        arm();
      } else if (MENUS.includes(G.state)) {
        const to = menuBack;
        menuGoBack();
        if (to !== "title") arm();
      } else if (G.state === "pause" || G.state === "dead" || G.state === "win") arm();
    });
    // Android's Back leaves fullscreen first, with no popstate: that pauses too
    const pauseIfPlaying = () => {
      if (TOUCH.on && G.state === "play") show("pause");
    };
    const fsChange = () => {
      if (!(document.fullscreenElement || document.webkitFullscreenElement)) pauseIfPlaying();
    };
    document.addEventListener("fullscreenchange", fsChange);
    document.addEventListener("webkitfullscreenchange", fsChange);
    // a hidden page or a lost focus pauses, so no enemy plays on while you are away
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseIfPlaying();
    });
    addEventListener("blur", pauseIfPlaying);
    // a resize that changed nothing must not drop the fingers
    const re = () => {
      insC = null;
      if (key() !== lastKey) relayout();
    };
    addEventListener("resize", re);
    addEventListener("orientationchange", re);
    if (window.visualViewport) visualViewport.addEventListener("resize", re);
    // the rotate screen: a tap tries fullscreen and a landscape lock
    const rot = $("rotate");
    if (rot) rot.addEventListener("click", () => goLandscape());
    setOn(detect());
  };
  // one history entry for Back to use up; put back whenever it has been used
  let armed = false;
  function arm() {
    if (armed) return;
    try {
      history.pushState({ dungeonRaze: 1 }, "");
      armed = true;
    } catch (e) {}
  }
  // Fullscreen, then a landscape lock. A browser may refuse or lack either
  // (iPhone has no fullscreen for pages), and none of that may stop the game.
  function goLandscape() {
    const quiet = () => {};
    const lock = () => {
      try {
        const so = screen.orientation;
        if (so && so.lock) {
          const r = so.lock("landscape");
          if (r && r.catch) r.catch(quiet);
        }
      } catch (e) {}
    };
    try {
      const de = document.documentElement,
        fs = de.requestFullscreen || de.webkitRequestFullscreen;
      if (fs && !document.fullscreenElement) {
        const r = fs.call(de, { navigationUI: "hide" });
        if (r && r.then) r.then(lock, () => lock()).catch(quiet);
        else lock();
      } else lock();
    } catch (e) {
      lock();
    }
  }
  // From the tap that starts play: the Back catcher, then goLandscape
  TOUCH.enterPlay = () => {
    arm();
    goLandscape();
  };
  TOUCH.setOn = setOn;
  TOUCH.relayout = () => {
    insC = null;
    relayout();
  };
  // runs every frame: the buttons show only while playing, and a change in
  // size, insets or settings that no event reported is picked up here
  TOUCH.update = (dt) => {
    // the buttons and stick give way to a connected pad, if the setting says so
    const hide = TOUCH.on && OPT.padHideTouch && PAD.connected;
    if (hide !== document.body.classList.contains("padhide")) {
      document.body.classList.toggle("padhide", hide);
      if (hide) release();
    }
    if (!TOUCH.on) return;
    const s = G.state === "play";
    if (s !== shown) {
      shown = s;
      host.classList.toggle("show", s);
    }
    if (key() !== lastKey) relayout();
    if (s) refresh();
    // the D-pad takes the stick's place while a plaque is open
    const ins = s && !!G.insp;
    if (ins !== dpadShown && svg) {
      dpadShown = ins;
      const dg = svg.querySelector(".dpad");
      if (dg) dg.style.display = ins ? "" : "none";
      if (stickEls) stickEls.g.style.display = ins ? "none" : "";
    }
  };
})();
