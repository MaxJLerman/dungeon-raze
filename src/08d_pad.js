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
  // "Xbox Wireless Controller" also contains "wireless controller", so a
  // bare match on that is taken for PlayStation only when it names no Xbox
  famOf(p) {
    const id = p.id || "";
    return /054c|dualsense|dualshock/i.test(id) ||
      (/wireless controller/i.test(id) && !/xbox|045e/i.test(id))
      ? "ps"
      : "xbox";
  },
  poll(dt) {
    const list = PAD.pads();
    PAD.connected = list.length > 0;
    PAD.std = list.every((p) => p.mapping === "standard");
    document.body.classList.toggle("padc", PAD.connected);
    // buttons: down on any pad counts, and the press edge is against the last
    // poll's merged state, so the first press of a new pad is not lost
    const now = {};
    let pressed = null;
    for (let i = 0; i < 18; i++) {
      for (const p of list) {
        if (!PAD.down(p.buttons[i], i)) continue;
        now[i] = true;
        if (!PAD.prev[i] && !pressed) pressed = p;
      }
      const c = "P:" + i;
      keys[c] = !!now[i];
      if (now[i] && !PAD.prev[i]) taps[c] = true;
    }
    PAD.prev = now;
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
