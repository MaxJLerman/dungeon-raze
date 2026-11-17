// ---- controller ----
// Pads are polled once a frame. Each button of the standard mapping is merged
// across every listed pad into keys["P:i"], with taps["P:i"] on its press
// edge, and held() and hit() read those through PAD_BIND.
const PAD = {
  // true when a pad was the last input, which shows pad prompts
  active: false,
  // true while a pad is listed
  connected: false,
  // false when a listed pad does not report the standard mapping
  std: true,
  // "xbox" or "ps", from the last pad pressed
  fam: "xbox",
  prev: {},
  famSeen: false,
  // left stick: x right, y forward, mag 0..1 past the dead zone
  move: { x: 0, y: 0, mag: 0 },
  // right stick, squared response: x right, y down
  look: { x: 0, y: 0 },
  // the sprint latch: a tap of the sprint button turns it on or off
  sprint: false,
  // the lock flick fires once per push, and the stick must rest in between
  flickArm: true,
  // codes that stay ignored until they are released, so a button held across
  // a screen change is not read again on the new screen
  mute: new Set(),
  // the screen the last poll saw
  screen: null,
  pads() {
    try {
      const l = navigator.getGamepads ? navigator.getGamepads() : null;
      return l ? [...l].filter((p) => p && p.connected) : [];
    } catch (e) {
      return [];
    }
  },
  setActive(v) {
    PAD.active = !!v;
    document.body.classList.toggle("pad", PAD.active);
  },
  // a button counts as down at half travel on a trigger, else when pressed
  down(b, i) {
    if (!b) return false;
    return i === 6 || i === 7 ? b.value > 0.5 : !!b.pressed;
  },
  // the stick, past a radial dead zone of 0.2 and rescaled to 0..1
  stick(p, ax) {
    const x = p.axes[ax] || 0,
      y = p.axes[ax + 1] || 0,
      len = Math.hypot(x, y);
    return len < 0.2 ? 0 : Math.min(1, (len - 0.2) / 0.8);
  },
  // the stick (ax is its x axis) of whichever pad pushes it furthest, as a
  // direction scaled by its dead-zone magnitude, so an idle pad cannot cancel
  // another's push. y is the raw axis, positive for down.
  vec(list, ax) {
    let best = { x: 0, y: 0, mag: 0 };
    for (const p of list) {
      const mag = PAD.stick(p, ax);
      if (mag <= best.mag) continue;
      const x = p.axes[ax] || 0,
        y = p.axes[ax + 1] || 0,
        len = Math.hypot(x, y);
      best = { x: (x / len) * mag, y: (y / len) * mag, mag };
    }
    return best;
  },
  // "Xbox Wireless Controller" also contains "wireless controller", so a
  // bare match on that is taken for PlayStation only when it names no Xbox
  famOf(p) {
    const id = p.id || "";
    return /054c|dualsense|dualshock/i.test(id) ||
      (/wireless controller/i.test(id) && !/xbox|045e/i.test(id))
      ? "ps"
      : "xbox";
  },
  // from a pad press: a pad has no pointer to lock, so play goes fullscreen
  enterPlay() {
    try {
      const r = document.documentElement.requestFullscreen();
      if (r && r.catch) r.catch(() => {});
    } catch (e) {}
  },
  poll(dt) {
    const list = PAD.pads();
    const wasConnected = PAD.connected;
    PAD.connected = list.length > 0;
    PAD.std = list.every((p) => p.mapping === "standard");
    document.body.classList.toggle("padc", PAD.connected);
    // buttons: down on any pad counts, and the press edge is against the last
    // poll's merged state, so the first press of a new pad is not lost
    const now = {},
      screenChanged = PAD.screen !== G.state;
    PAD.screen = G.state;
    let pressed = null;
    for (let i = 0; i < 18; i++) {
      const c = "P:" + i,
        down = list.find((p) => PAD.down(p.buttons[i], i));
      // a screen change mutes what is held now, until it is let go
      if (down && screenChanged) PAD.mute.add(c);
      if (!down) PAD.mute.delete(c);
      if (PAD.mute.has(c)) {
        keys[c] = false;
        delete taps[c];
        continue;
      }
      keys[c] = !!down;
      if (!down) continue;
      now[i] = true;
      if (!PAD.prev[i]) {
        taps[c] = true;
        if (!pressed) pressed = down;
      }
    }
    PAD.prev = now;
    // a press may be what lets the browser start audio
    if (pressed) {
      try {
        SFX.init();
      } catch (e) {}
    }
    // a pad that was listed and is gone leaves nothing held, and pauses play
    if (wasConnected && !PAD.connected) {
      for (const k in keys) if (k.startsWith("P:")) keys[k] = false;
      for (const k in taps) if (k.startsWith("P:")) delete taps[k];
      PAD.sprint = false;
      if (G.state === "play") show("pause");
    }
    // a pad only takes over the prompts by a press or a real stick push
    let act = pressed;
    if (!act)
      for (const p of list)
        if (PAD.stick(p, 0) > 0.5 || PAD.stick(p, 2) > 0.5) act = p;
    if (act) {
      PAD.fam = PAD.famOf(act);
      PAD.famSeen = true;
      PAD.setActive(true);
    } else if (!PAD.famSeen && list.length) PAD.fam = PAD.famOf(list[0]);
    // the pause button, and the back button of the pause screen, are fixed
    if (taps["P:9"] && (G.state === "play" || G.state === "pause")) {
      delete taps["P:9"];
      if (G.state === "play") show("pause");
      else play();
    } else if (taps["P:1"] && G.state === "pause") {
      delete taps["P:1"];
      play();
    }
    // sticks
    const lv = PAD.vec(list, 0),
      rv = PAD.vec(list, 2),
      inPlay = G.state === "play",
      p = G.player;
    PAD.move = { x: lv.x, y: -lv.y, mag: lv.mag };
    PAD.look = { x: rv.x * rv.mag, y: rv.y * rv.mag };
    // the latch reads the tap without consuming it
    if (inPlay && PAD_BIND.sprint && taps[PAD_BIND.sprint]) PAD.sprint = !PAD.sprint;
    if (PAD.move.mag === 0 || !inPlay || (p && p.stam <= 0)) PAD.sprint = false;
    if (inPlay && !(p && p.lock)) {
      const sn = OPT.psens * dt;
      cam.yaw -= PAD.look.x * 3.0 * sn;
      cam.pitch = clamp(
        cam.pitch + PAD.look.y * 1.8 * sn * (OPT.invY ? -1 : 1),
        -0.3,
        1.15,
      );
    }
    // a flick of the right stick while locked switches target
    // a push held past the flick line while not locked also uses up the flick,
    // so locking with the stick held does not switch at once
    if (rv.mag === 0) PAD.flickArm = true;
    else if (Math.abs(rv.x) > 0.7) {
      if (inPlay && p && p.lock && PAD.flickArm) mouse.wheel = Math.sign(rv.x);
      PAD.flickArm = false;
    }
  },
  init() {
    // the last input decides: a key, a mouse or a touch hands back to them
    const off = () => PAD.active && PAD.setActive(false);
    addEventListener("keydown", (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (!e.code || e.code === "Unidentified" || /^(Audio|Media)/.test(e.code)) return;
      off();
    });
    addEventListener("mousemove", (e) => {
      if (e.movementX || e.movementY) off();
    });
    addEventListener(
      "pointerdown",
      (e) => {
        if (e.pointerType === "touch") off();
      },
      true,
    );
  },
};
