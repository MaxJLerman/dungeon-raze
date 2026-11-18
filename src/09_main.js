// ---------- input, menus, camera, loop ----------
const canvas = $("c");
const RM = !!(
  window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches
);
const SCREENS = [
  "title",
  "pause",
  "dead",
  "win",
  "class",
  "controls",
  "howto",
];
// screens opened on top of the title or pause screen, which Back returns to
const MENUS = ["class", "controls", "howto"];
let menuBack = "title",
  rebind = null,
  swallowClick = false;
function show(state) {
  // a plaque closes at once when play stops
  if (state !== "play") closePlaque(true);
  G.state = state;
  for (const s of SCREENS) {
    const e = $("scr-" + s);
    // a screen that comes up again starts at its top
    const fresh = s === state && !e.classList.contains("show");
    e.classList.toggle("show", s === state);
    if (fresh) e.scrollTop = 0;
  }
  $("hud").classList.toggle(
    "show",
    state === "play" ||
      state === "pause" ||
      state === "dead" ||
      (MENUS.includes(state) && menuBack !== "title"),
  );
  if (state === "win") {
    const t = Math.floor(G.runT),
      m = Math.floor(t / 60),
      s = t % 60;
    $("winStats").textContent =
      G.player.cls.name +
      "   Time " +
      m +
      ":" +
      String(s).padStart(2, "0") +
      "   Kills " +
      G.kills +
      "   Deaths " +
      G.deaths;
  }
  // there is nowhere to return to from the hall itself
  $("btnBase").style.display = G.zone === "hub" ? "none" : "";
  if (state !== "play" && document.pointerLockElement === canvas)
    document.exitPointerLock();
  if (state !== "play") {
    for (const k in keys) keys[k] = false;
    TOUCH.release();
  }
}
function lockPointer() {
  try {
    const r = canvas.requestPointerLock();
    if (r && r.catch)
      r.catch(() => {
        G.noLock = true;
      });
  } catch (e) {
    G.noLock = true;
  }
}
function play() {
  // upright on a touch device the rotate overlay covers the page, and play
  // waits for the device to be turned
  if (TOUCH.on && innerHeight > innerWidth) return;
  SFX.init();
  show("play");
  TOUCH.release();
  // a touch screen has no pointer to lock, and goes fullscreen instead, and
  // so does a pad
  if (TOUCH.on) TOUCH.enterPlay();
  else if (PAD.active) PAD.enterPlay();
  else lockPointer();
  canvas.focus();
  for (const k in taps) taps[k] = false;
  mouse.dx = mouse.dy = 0;
  HUD.hint();
}
// Leaves the cave for the hall, stepping out of the portal that was used.
function toBase() {
  enterHub(G.grade);
  play();
}
function openMenu(which) {
  if (!MENUS.includes(G.state)) menuBack = G.state;
  if (which === "controls") renderControls();
  else if (which === "class") renderPicker();
  show(which);
}

// ---- class picker ----
// the key shown beside a kit line, and the name of the touch button
const KIT_KEYS = {
  Tool: ["tool", "TOOL"],
  Ability: ["special", "ABILITY"],
  Heavy: ["heavy", "HEAVY"],
};
// text for a mouse and keyboard, for a touch screen and for a pad (the
// keyboard's when none is given); the CSS shows one
const both = (kb, touch, pad = kb) =>
  '<span class="lk-mouse">' +
  kb +
  '</span><span class="lk-touch">' +
  touch +
  '</span><span class="lk-pad">' +
  pad +
  "</span>";
function renderPicker() {
  // a rebuilt picker keeps the focused card, the pad's and the keyboard's
  const hosts = [...document.querySelectorAll(".picker")],
    keep = [PAD.focus, document.activeElement].map((f) => {
      const h = f && f.closest && f.closest(".picker");
      return h && f.dataset.cls ? [hosts.indexOf(h), f.dataset.cls] : null;
    });
  for (const host of hosts) {
    const cur = CLASSES[OPT.cls];
    host.innerHTML =
      '<div class="cards">' +
      pickable().map((id) => {
        const c = CLASSES[id];
        return (
          '<button type="button" class="card' +
          (id === OPT.cls ? " on" : "") +
          '" data-cls="' +
          id +
          '" aria-pressed="' +
          (id === OPT.cls) +
          '"><b>' +
          c.name +
          "</b><span>" +
          c.tag +
          "</span></button>"
        );
      }).join("") +
      "</div>" +
      '<div class="kit"><div class="stat">Health ' +
      cur.hp +
      "   Stamina " +
      cur.stam +
      "</div>" +
      cur.kit
        .map(
          (k) =>
            "<div><b>" +
            k[0] +
            (KIT_KEYS[k[0]]
              ? " <kbd>" +
                both(
                  keyName(BIND[KIT_KEYS[k[0]][0]]),
                  KIT_KEYS[k[0]][1],
                  padName(PAD_BIND[KIT_KEYS[k[0]][0]], PAD.fam),
                ) +
                "</kbd>"
              : "") +
            "</b><span>" +
            k[1] +
            "</span></div>",
        )
        .join("") +
      "</div>";
  }
  const card = (k) =>
    k && hosts[k[0]].querySelector('.card[data-cls="' + k[1] + '"]');
  if (keep[0] && card(keep[0])) PAD.setFocus(card(keep[0]));
  if (keep[1] && card(keep[1])) card(keep[1]).focus();
}
// ---- controls menu ----
function renderControls() {
  // a rebuilt list keeps the pad's place in it
  const fk =
    PAD.focus && $("binds").contains(PAD.focus) ? PAD.focus.dataset.pact : null;
  PAD.famShown = PAD.fam;
  $("binds").innerHTML =
    ACTIONS.map(([a, label]) => {
      const moves = !(a in DEFAULT_PAD);
      return (
        '<div class="bind"><span>' +
        label +
        '</span><button type="button" data-act="' +
        a +
        '"' +
        (rebind === a ? ' class="wait"' : "") +
        ">" +
        (rebind === a ? "Press a key or mouse button" : keyName(BIND[a])) +
        '</button><button type="button" data-pact="' +
        a +
        '"' +
        (PAD.rebind === a ? ' class="wait"' : "") +
        (moves ? " disabled" : "") +
        ">" +
        (moves
          ? "Left stick"
          : PAD.rebind === a
            ? "Press a controller button"
            : padName(PAD_BIND[a], PAD.fam)) +
        "</button></div>"
      );
    }).join("");
  if (fk) PAD.setFocus($("binds").querySelector('[data-pact="' + fk + '"]'));
  $("sens").value = OPT.sens;
  $("sensV").textContent = OPT.sens.toFixed(2) + "×";
  $("invY").checked = OPT.invY;
  $("psens").value = OPT.psens;
  $("psensV").textContent = OPT.psens.toFixed(2) + "×";
  $("padHideTouch").checked = OPT.padHideTouch;
  $("rumble").checked = OPT.rumble;
  $("tsize").value = OPT.tsize;
  $("tsizeV").textContent = OPT.tsize.toFixed(2) + "×";
  $("topac").value = OPT.topac;
  $("topacV").textContent = Math.round(OPT.topac * 100) + "%";
  $("tnotch").checked = OPT.tnotch;
  $("pnote").hidden = !(PAD.connected && !PAD.std);
  HUD.hint();
}
function finishPadRebind(code) {
  if (code) setPadBind(PAD.rebind, code);
  PAD.endRebind();
  renderControls();
  renderPicker();
}
function finishRebind(code) {
  if (code) setBind(rebind, code);
  rebind = null;
  renderControls();
  renderPicker();
}

function camUpdate(dt) {
  const p = G.player,
    w = G.world;
  if (G.state === "play" && G.insp) {
    // looking at a plaque: the view is fixed on it
  } else if (G.state === "play") {
    const sn = cam.sens * OPT.sens;
    cam.yaw -= mouse.dx * sn;
    cam.pitch = clamp(
      cam.pitch + mouse.dy * sn * (OPT.invY ? -1 : 1),
      -0.3,
      1.15,
    );
    if (p.lock && !p.lock.dead) {
      cam.yaw = dampAng(
        cam.yaw,
        Math.atan2(p.lock.x - p.x, p.lock.z - p.z),
        6,
        dt,
      );
      cam.pitch = damp(cam.pitch, p.lock.def.boss ? 0.2 : 0.28, 2.5, dt);
    }
  } else if (G.state === "title") {
    // sway instead of orbiting, so the row of gates stays in view
    G.t0 += dt;
    cam.yaw = 0.45 * Math.sin(G.t0 * 0.1);
  }
  mouse.dx = mouse.dy = 0;
  cam.px = damp(cam.px, p.x, 18, dt);
  cam.pz = damp(cam.pz, p.z, 18, dt);
  const fx = Math.sin(cam.yaw),
    fz = Math.cos(cam.yaw),
    rx = -fz,
    rz = fx;
  let so = 0.6;
  if (w.fieldAt(cam.px + rx * so, cam.pz + rz * so) < 0.5) so = 0;
  const pvx = cam.px + rx * so,
    pvy = 1.62,
    pvz = cam.pz + rz * so,
    cp = Math.cos(cam.pitch),
    sp = Math.sin(cam.pitch);
  const D = cam.dist * (p.lock && p.lock.def.boss ? 1.35 : 1),
    N = 16;
  let tmax = 1;
  for (let i = 1; i <= N; i++) {
    const t = i / N,
      x = pvx - fx * cp * D * t,
      y = pvy + sp * D * t,
      z = pvz - fz * cp * D * t;
    if (w.fieldAt(x, z) < 0.4 || y > w.ceilAt(x, z) - 0.4 || y < 0.35) {
      tmax = (i - 1) / N;
      break;
    }
  }
  const allow = Math.max(0.6, D * tmax);
  cam.cd = allow < cam.cd ? allow : damp(cam.cd, allow, 5, dt);
  cam.x = pvx - fx * cp * cam.cd;
  cam.y = pvy + sp * cam.cd;
  cam.z = pvz - fz * cp * cam.cd;
  G.shake = Math.max(0, G.shake - dt * 2.6);
  const sh = G.shake * G.shake * (RM ? 0.04 : 0.22);
  const sx = (Math.random() - 0.5) * sh,
    sy = (Math.random() - 0.5) * sh,
    sz = (Math.random() - 0.5) * sh;
  cam.fov = damp(cam.fov, p.sprint ? 1.16 : 1.08, 5, dt);
  const eye = [cam.x + sx, cam.y + sy, cam.z + sz],
    look = [
      cam.x + fx * cp * 10 + sx,
      cam.y - sp * 10 + sy,
      cam.z + fz * cp * 10 + sz,
    ];
  if (G.insp) {
    // glide to face the plaque from in front of it
    const q = G.insp.q,
      k = smooth(G.insp.k),
      f = plaqueFront(q, 1.6),
      to = [f.x, PLAQUE_Y, f.z],
      at = [q.x, PLAQUE_Y, q.z],
      L = TOUCH.on && TOUCH.layout;
    if (L) {
      // under touch the card may sit off centre, clear of the buttons: turn
      // the view so the plaque itself sits behind the card
      const off = L.close.x + L.close.w / 2 - L.W / 2,
        focal = L.H / 2 / Math.tan(cam.fov / 2),
        yaw = Math.atan2(at[0] - to[0], at[2] - to[2]),
        sh = (-off * 1.6) / focal;
      at[0] += -Math.cos(yaw) * sh;
      at[2] += Math.sin(yaw) * sh;
    }
    for (let i = 0; i < 3; i++) {
      eye[i] = lerp(eye[i], to[i], k);
      look[i] = lerp(look[i], at[i], k);
    }
  }
  R.setCam(eye[0], eye[1], eye[2], look[0], look[1], look[2], cam.fov);
}
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!(dt > 0)) dt = 0.016;
  // tests set G.manual and poll the pads themselves
  if (!G.manual) PAD.poll(dt);
  if (!G.manual && (G.state === "play" || G.state === "dead")) {
    let sim = dt;
    if (G.hitstop > 0) {
      G.hitstop -= dt;
      sim = 0;
    } else if (G.slowT > 0) {
      G.slowT -= dt;
      sim = dt * 0.3;
    }
    if (sim > 0) {
      const n = sim > 0.022 ? 2 : 1;
      for (let i = 0; i < n; i++) update(sim / n);
    }
    for (const k in taps) taps[k] = false;
  }
  // nothing is simulated on the title, but its backdrop should still move
  if (G.state === "title") G.t += dt;
  camUpdate(dt);
  render();
  HUD.update(dt);
  TOUCH.update(dt);
  if (G.state === "dead" && !$("scr-dead").classList.contains("show"))
    show("dead");
  if (G.state === "win" && !$("scr-win").classList.contains("show"))
    show("win");
}
function boot() {
  if (!R.init(canvas)) {
    $("scr-title").querySelector(".sub").textContent =
      "This browser cannot start WebGL 2, so the game cannot draw. Try a recent Chrome, Edge, Firefox or Safari.";
    $("btnPlay").disabled = true;
    return;
  }
  loadOpt();
  HUD.init();
  TOUCH.init();
  PAD.init();
  enterHub();
  renderPicker();
  renderControls();
  // rebinding captures the next key or mouse button before anything else sees it
  addEventListener(
    "keydown",
    (e) => {
      // a key cancels a wait for a pad button
      if (PAD.rebind) {
        e.preventDefault();
        e.stopImmediatePropagation();
        PAD.endRebind();
        renderControls();
        return;
      }
      if (!rebind) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      finishRebind(e.code === "Escape" ? null : e.code);
    },
    true,
  );
  addEventListener(
    "mousedown",
    (e) => {
      if (!rebind) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      swallowClick = true;
      finishRebind("Mouse" + e.button);
    },
    true,
  );
  addEventListener(
    "click",
    (e) => {
      if (swallowClick) {
        swallowClick = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );
  addEventListener("keydown", (e) => {
    if (G.state === "play") {
      // a key press may be what lets the browser start audio
      try {
        SFX.init();
      } catch (err) {}
      if (!e.repeat) taps[e.code] = true;
      keys[e.code] = true;
      if (!e.ctrlKey && !e.metaKey && !/^F\d+$/.test(e.code))
        e.preventDefault();
      // with no pointer lock, the browser sends no Esc to leave, so pause here
      if (
        (e.code === "Escape" || e.code === "KeyP") &&
        document.pointerLockElement !== canvas
      )
        show("pause");
      if (e.code === BIND.mute && !e.repeat) SFX.toggle();
      return;
    }
    const idle =
      !document.activeElement ||
      document.activeElement === document.body ||
      document.activeElement === canvas;
    if ((e.code === "Enter" || e.code === "Space") && idle) {
      e.preventDefault();
      if (G.state === "dead") {
        respawn();
        play();
      } else if (G.state === "pause" || G.state === "title") play();
    }
    if (e.code === "Escape" && MENUS.includes(G.state)) show(menuBack);
  });
  addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });
  addEventListener("blur", () => {
    for (const k in keys) keys[k] = false;
    TOUCH.release();
  });
  canvas.addEventListener("mousedown", (e) => {
    if (G.state !== "play") return;
    e.preventDefault();
    try {
      SFX.init();
    } catch (err) {}
    if (document.pointerLockElement !== canvas && !G.noLock) lockPointer();
    taps["Mouse" + e.button] = true;
    keys["Mouse" + e.button] = true;
  });
  addEventListener("mouseup", (e) => {
    keys["Mouse" + e.button] = false;
  });
  addEventListener("mousemove", (e) => {
    if (
      G.state === "play" &&
      (document.pointerLockElement === canvas || G.noLock)
    ) {
      mouse.dx += e.movementX || 0;
      mouse.dy += e.movementY || 0;
    }
  });
  addEventListener(
    "wheel",
    (e) => {
      if (G.state === "play") mouse.wheel = e.deltaY;
    },
    { passive: true },
  );
  addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("pointerlockchange", () => {
    if (
      document.pointerLockElement !== canvas &&
      G.state === "play" &&
      !G.noLock
    )
      show("pause");
  });
  // leaving fullscreen pauses on a desktop, which touch does for itself. Only
  // a change out of fullscreen counts, not an event with nothing left to leave.
  let wasFull = false;
  document.addEventListener("fullscreenchange", () => {
    const full = !!document.fullscreenElement;
    if (!TOUCH.on && G.state === "play" && wasFull && !full) show("pause");
    wasFull = full;
  });
  document.addEventListener("pointerlockerror", () => {
    G.noLock = true;
  });
  // menus
  $("btnPlay").addEventListener("click", play);
  $("btnResume").addEventListener("click", play);
  $("btnRise").addEventListener("click", () => {
    respawn();
    play();
  });
  for (const id of ["btnAgain", "btnBase", "btnDeadBase"])
    $(id).addEventListener("click", toBase);
  for (const b of document.querySelectorAll("[data-open]"))
    b.addEventListener("click", () => openMenu(b.dataset.open));
  for (const b of document.querySelectorAll("[data-back]"))
    b.addEventListener("click", () => show(menuBack));
  document.addEventListener("click", (e) => {
    const card = e.target.closest && e.target.closest(".card");
    if (card) {
      setClass(card.dataset.cls);
      renderPicker();
      HUD.hint();
      const again = document.querySelector(".scr.show .card.on");
      if (again) again.focus();
      return;
    }
    const pb = e.target.closest && e.target.closest("#binds button[data-pact]");
    if (pb) {
      PAD.startRebind(pb.dataset.pact);
      return;
    }
    const bb = e.target.closest && e.target.closest("#binds button[data-act]");
    if (bb) {
      PAD.endRebind();
      rebind = bb.dataset.act;
      renderControls();
    }
  });
  $("sens").addEventListener("input", (e) => {
    OPT.sens = clamp(parseFloat(e.target.value) || 1, 0.2, 3);
    $("sensV").textContent = OPT.sens.toFixed(2) + "×";
    saveOpt();
  });
  $("invY").addEventListener("change", (e) => {
    OPT.invY = e.target.checked;
    saveOpt();
  });
  $("psens").addEventListener("input", (e) => {
    OPT.psens = clamp(parseFloat(e.target.value) || 1, 0.2, 3);
    $("psensV").textContent = OPT.psens.toFixed(2) + "×";
    saveOpt();
  });
  $("padHideTouch").addEventListener("change", (e) => {
    OPT.padHideTouch = e.target.checked;
    saveOpt();
  });
  $("rumble").addEventListener("change", (e) => {
    OPT.rumble = e.target.checked;
    saveOpt();
  });
  // touch settings: each one saves and lays the buttons out again
  $("tsize").addEventListener("input", (e) => {
    OPT.tsize = clamp(parseFloat(e.target.value) || 1, 0.8, 1.2);
    $("tsizeV").textContent = OPT.tsize.toFixed(2) + "×";
    saveOpt();
    TOUCH.relayout();
  });
  $("topac").addEventListener("input", (e) => {
    OPT.topac = clamp(parseFloat(e.target.value) || 0.6, 0.2, 1);
    $("topacV").textContent = Math.round(OPT.topac * 100) + "%";
    saveOpt();
    TOUCH.relayout();
  });
  $("tnotch").addEventListener("change", (e) => {
    OPT.tnotch = e.target.checked;
    saveOpt();
    TOUCH.relayout();
  });
  $("btnDefaults").addEventListener("click", () => {
    Object.assign(BIND, DEFAULT_BINDS);
    Object.assign(PAD_BIND, DEFAULT_PAD);
    PAD.endRebind();
    OPT.sens = 1;
    OPT.invY = false;
    OPT.psens = 1;
    OPT.padHideTouch = true;
    OPT.rumble = true;
    OPT.tsize = 1;
    OPT.topac = 0.6;
    OPT.tnotch = true;
    saveOpt();
    TOUCH.relayout();
    renderControls();
    renderPicker();
  });
  show("title");
  requestAnimationFrame((t) => {
    last = t;
    frame(t);
  });
}
window.DF = {
  G,
  cam,
  R,
  keys,
  taps,
  mouse,
  update,
  newRun,
  enterHub,
  enterCave,
  startTrans,
  genHub,
  TOUCH,
  PAD,
  PAD_BIND,
  DEFAULT_PAD,
  DEFAULT_BINDS,
  setPadBind,
  padName,
  keyName,
  SFX,
  touchLayout,
  layoutProblems,
  hexContains,
  hexGap,
  fieldFns,
  portalFront,
  hubPlaques,
  plaqueFront,
  plaqueAt,
  GRADES,
  respawn,
  show,
  play,
  MOVES,
  EDEF,
  threatOf,
  PURSUIT,
  CLASSES,
  UNLOCKED,
  classOpen,
  pickable,
  unlockClass,
  renderPicker,
  BIND,
  OPT,
  setClass,
  setBind,
  toBase,
  hitEnemy,
  alertE,
  hurtPlayer,
  startExecute,
  startCaveIn,
  RIFT,
  openRift,
  riftMove,
  riftBodies,
  shoot,
  fire,
  angDiff,
  plantMine,
  boomMine,
  MINE,
  CAVEIN,
  stagger,
  openPlaque,
  closePlaque,
  posePlayer,
  setPlaqueCode,
  codeText,
  inputMode,
  resetPlaqueCodes,
  openMenu,
  loadOpt,
  saveOpt,
  sim(sec, each) {
    const n = Math.round(sec * 60);
    for (let i = 0; i < n; i++) {
      if (each && each(i) === false) return i;
      update(1 / 60);
      for (const k in taps) taps[k] = false;
    }
    return n;
  },
};
boot();
