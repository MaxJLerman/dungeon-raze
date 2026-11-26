// Co-op: the room screen, up to the network. The page is a file:, so no
// relay can be reached; a step that needs a page on another host sets one
// with DF.coopLoc, and WebSocket, fetch and Worker are counted or stood in
// for where a step says so.
// Run with: node build.mjs && SCRIPT=$PWD/tests/t29.mjs node test.mjs title
// and on a phone: DEVICE=oneplus-13 SCRIPT=$PWD/tests/t29.mjs node test.mjs title
// Every step returns an object with a boolean `pass`.
const MSG = {
  code: "That code is not valid.",
  relay: "Cannot reach the co-op relay.",
  copy: "This copy of the game cannot play co-op. Play at https://maxjlerman.github.io/dungeon-raze/",
  file: "Co-op does not run from a file. Run npm run dev and open http://localhost:8000",
  noroom: "No room has that code.",
  full: "That room is full.",
  version: "You and the host are on different versions of the game. Both reload the page.",
  cave: "This browser built a different cave from the host's. Co-op cannot run here.",
  worker: "This browser cannot host a room.",
  stopped: "The host's game stopped. The room is closed.",
  host: "The host has left.",
  lost: "The connection to the room was lost. You can join again with the same code.",
  bad: "The host sent something this page could not read. Both reload the page.",
};
// The helpers every step shares, made once, on window.__c9.
const HELP = `
  const MSG = ${JSON.stringify(MSG)};
  const c9 = window.__c9 || (window.__c9 = (() => {
    const real = { WebSocket: window.WebSocket, fetch: window.fetch, Worker: window.Worker };
    const h = {
      real,
      socks: [], fetches: [], workers: [],
      frames: () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))),
      shown: (el) => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none",
      msg: () => { const el = document.getElementById("coopMsg"); return h.shown(el) ? el.textContent : ""; },
      // a WebSocket that never reaches anything: it records what it was
      // asked for and what was sent, and the step drives its events
      stubSockets() {
        h.socks.length = 0;
        window.WebSocket = function (url) {
          const s = { url, binaryType: "blob", readyState: 0, bufferedAmount: 0, sent: [], closed: null,
            onopen: null, onmessage: null, onclose: null, onerror: null,
            send(d) { s.sent.push(new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer).slice()); },
            close(code) { if (s.readyState < 2) { s.readyState = 3; s.closed = code === undefined ? null : code; } },
            // test side
            open() { s.readyState = 1; if (s.onopen) s.onopen({}); },
            hear(bytes) { if (s.onmessage) s.onmessage({ data: Uint8Array.from(bytes).buffer }); },
            shut(code) { s.readyState = 3; if (s.onclose) s.onclose({ code }); },
          };
          h.socks.push(s);
          return s;
        };
        Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
      },
      // fetch answers POST /new with code; nothing goes out
      stubFetch(code) {
        h.fetches.length = 0;
        window.fetch = (url, o) => {
          h.fetches.push({ url: String(url), method: o && o.method });
          return Promise.resolve(new Response(JSON.stringify({ code }), { status: 200, headers: { "Content-Type": "application/json" } }));
        };
      },
      countWorkers() {
        h.workers.length = 0;
        window.Worker = function (...a) {
          const w = new real.Worker(...a);
          h.workers.push(w);
          const t = w.terminate.bind(w);
          w.terminate = () => { w.dead = true; t(); };
          return w;
        };
      },
      restore() { Object.assign(window, real); DF.coopLoc(null); DF.coopRelay(""); DF.coopSeed(null); },
      // an event frame as the host's wire makes it
      ev(arr) { const j = new TextEncoder().encode(JSON.stringify(arr)); return [3, ...j]; },
      // the event in a frame the page sent
      sentEv(b) { return b[0] === 3 ? JSON.parse(new TextDecoder().decode(b.subarray(1))) : null; },
      // opens the room screen afresh from the title
      open() { if (DF.G.state !== "title") document.querySelector("#scr-coop [data-back]").click(); DF.show("title"); DF.openMenu("coop"); },
      join(code) { document.getElementById("coopCode").value = code; document.getElementById("coopJoin").click(); },
      back() { document.querySelector("#scr-coop [data-back]").click(); },
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),
      // hosts a room on this page: POST /new answered here, a real Worker
      // host in the hall (its first trip is cave 99), a relay address
      // nothing listens on. Resolves once the page has joined its own Worker.
      async hostLocal() {
        h.stubFetch("ABCDEF"); h.countWorkers();
        DF.coopLoc({ protocol: "http:", hostname: "localhost" });
        DF.coopRelay("ws://localhost:1");
        DF.coopSeed(99);
        h.open();
        document.getElementById("coopHost").click();
        for (let i = 0; i < 200 && !DF.net(); i++) await h.wait(50);
        return !!DF.net();
      },
      // joins as the friend through a stubbed socket to a host made on this
      // page that only this socket hears, started with start (the hall, as a
      // room is; { seed, grade } for a cave). before(h) runs on the host
      // before the friend's hello reaches it. Returns { s, h }.
      async friendIn(before, start = { hub: true }) {
        h.stubSockets();
        DF.coopLoc({ protocol: "http:", hostname: "localhost" });
        DF.coopRelay("ws://localhost:1");
        h.open();
        h.join("ABCDEF");
        const s = h.socks[h.socks.length - 1], host = DF.coopMakeHost();
        host.start(start);
        host.send = (pid, buf) => { if (pid === 2) s.hear(new Uint8Array(buf)); };
        if (before) before(host);
        s.open();
        for (const b of s.sent) host.recv(2, b.slice().buffer);
        await h.frames();
        return { s, h: host };
      },
      // the host's own player (pid 1) arrives and sends its first state, as
      // its page does once Start has been pressed
      hostStarts(host) {
        if (!host.S.px.has(1)) host.join(1, "fighter");
        // its page answers the join with its at before anything else
        if (!host.S.px.get(1).here) host.recv(1, host.wire.eventEncode(["at", 1, host.S.epoch]));
        const sp = host.G.world.spawn;
        host.recv(1, host.wire.stateEncode({ x: sp.x, z: sp.z, yaw: 0, vx: 0, vz: 0, state: "free", t: 0, move: null, hp: 1, maxHp: 1, speed: 0, guardT: 0, sprint: false }));
      },
      // what the page shows after co-op has ended
      after: () => ({ state: DF.G.state, msg: h.msg(), why: DF.CC.why, zone: DF.G.zone, net: DF.net(), link: DF.CC.link }),
    };
    return h;
  })());
`;
const step = (name, body, extra = {}) => ({
  name,
  ...extra,
  eval: `(async () => { ${HELP} try { ${body} } finally { c9.restore(); } })()`,
});
export default [
  step("Play online is always shown, with no ?coop=1", `
  const b = document.getElementById("btnCoop"), c = {};
  c.search = location.search === "";
  c.inTitle = !!b && b.closest(".scr") === document.getElementById("scr-title");
  c.shown = c9.shown(b) && b.textContent.trim() === "Play online";
  // nothing reads the address any more
  c.noGate = typeof DF.coopButton === "undefined";
  c.rest = c9.shown(document.getElementById("btnSolo"));
  return { pass: Object.values(c).every(Boolean), c };`),

  step("the screen is a menu", `
  const c = {}, scr = document.getElementById("scr-coop");
  c.listed = DF.G.state === "title";
  DF.coopSay("The host has left.");
  c.msgOnTitle = c9.msg() === "The host has left." && document.getElementById("coopMsg").closest(".scr").id === "scr-title";
  // Play online goes straight to it: no class screen on the way
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  DF.coopRelay("ws://localhost:1");
  document.getElementById("btnCoop").click();
  await c9.frames();
  c.opened = DF.G.state === "coop" && scr.classList.contains("show") && !document.getElementById("scr-title").classList.contains("show");
  // opening it clears the message
  c.cleared = c9.msg() === "";
  c.parts = ["coopHost", "coopCode", "coopJoin", "coopShow", "coopCopy", "coopCopyLink", "coopSlots", "coopCls", "coopEnter"].every((id) => scr.contains(document.getElementById(id)));
  c.noRoomYet = !c9.shown(document.getElementById("coopEnter")) && !c9.shown(document.getElementById("coopShow")) &&
    !c9.shown(document.getElementById("coopCopy")) && !c9.shown(document.getElementById("coopCopyLink"));
  // no class is chosen before there is a room
  c.noCardsYet = !c9.shown(document.getElementById("coopCls")) && [...scr.querySelectorAll(".card")].every((e) => !c9.shown(e));
  c.hud = !document.getElementById("hud").classList.contains("show");
  // Back
  c9.back();
  c.back = DF.G.state === "title" && !scr.classList.contains("show");
  // Esc
  DF.openMenu("coop");
  dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true }));
  c.esc = DF.G.state === "title";
  // a pad: focus lands on Host a room, and B goes back
  const mk = (b = {}) => ({ id: "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)", index: 0, connected: true, mapping: "standard", timestamp: performance.now(),
    buttons: Array.from({ length: 18 }, (_, i) => ({ pressed: !!b[i], value: b[i] ? 1 : 0 })), axes: [0, 0, 0, 0] });
  const pads = (...list) => { window.__pads = list; if (!navigator.getGamepads || navigator.getGamepads.__fake !== true) { const f = () => window.__pads; f.__fake = true; Object.defineProperty(navigator, "getGamepads", { configurable: true, value: f }); } };
  const was = DF.G.manual;
  DF.G.manual = true;
  pads(mk()); DF.PAD.poll(1 / 60); DF.PAD.setActive(true);
  DF.openMenu("coop");
  DF.PAD.poll(1 / 60);
  c.padFirst = !!DF.PAD.focus && DF.PAD.focus.id === "coopHost";
  pads(mk({ 1: 1 })); DF.PAD.poll(1 / 60);
  pads(mk()); DF.PAD.poll(1 / 60);
  c.padBack = DF.G.state === "title";
  pads(); DF.PAD.poll(1 / 60); DF.PAD.setActive(false);
  DF.G.manual = was;
  return { pass: Object.values(c).every(Boolean), c };`),

  step("a loose code is tidied or refused before the network", `
  const c = {}, code = document.getElementById("coopCode"), enter = document.getElementById("coopEnter");
  c9.stubSockets(); c9.stubFetch("ABCDEF"); c9.countWorkers();
  // on this file page with no relay set the relay is named first, and the
  // code is still read as it will be sent
  c9.open();
  c9.join(" ab-cd ef ");
  c.tidied = code.value === "ABCDEF";
  c.noRelay = c9.msg() === MSG.relay;
  // a page on localhost with a relay set: the code is checked
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  DF.coopRelay("ws://localhost:1");
  const bad = {};
  for (const s of ["ABC", "ABCDE0", "ABCDEO", "ABCDE1", "ABCDEI", "ABCDEL", "ABCDEFG", "", "AB CD E!"]) {
    c9.join(s);
    bad[JSON.stringify(s)] = c9.msg() === MSG.code;
  }
  c.refused = Object.values(bad).every(Boolean);
  c.bad = bad;
  c.nothingOut = c9.socks.length === 0 && c9.fetches.length === 0 && c9.workers.length === 0;
  // a good one goes to the relay, once, however often it is clicked
  code.value = " ab-cd ef ";
  document.getElementById("coopJoin").click();
  document.getElementById("coopJoin").click();
  document.getElementById("coopHost").click();
  c.oneSocket = c9.socks.length === 1 && c9.socks[0].url === "ws://localhost:1/room/ABCDEF" && c9.fetches.length === 0 && c9.workers.length === 0;
  c.msgCleared = c9.msg() === "";
  await c9.frames();
  c.waiting = c9.shown(enter) && enter.disabled && enter.textContent.trim() === "Waiting for the host to start";
  // the hello goes once the socket opens, with a base class
  const s = c9.socks[0];
  c.held = s.sent.length === 0;
  s.open();
  const hello = s.sent.length ? c9.sentEv(s.sent[0]) : null;
  c.hello = !!hello && hello[0] === "hello" && hello[2] === 3 && DF.CLASSES[hello[3]] && !DF.CLASSES[hello[3]].hidden &&
    /^[0-9a-f]{8}$/.test(hello[4]) && hello[4] === DF.coopBuild;
  // Back leaves the room and closes the socket
  c9.back();
  c.left = DF.G.state === "title" && s.readyState === 3 && DF.CC.link === null;
  return { pass: Object.values(c).every(Boolean), c };`),

  step("a close before the join names the relay's reason, never the host leaving", `
  const c = {};
  c9.stubSockets();
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  DF.coopRelay("ws://localhost:1");
  const tryClose = (how) => {
    c9.open();
    c9.join("ABCDEF");
    const s = c9.socks[c9.socks.length - 1];
    how(s);
    return { msg: c9.msg(), state: DF.G.state, link: DF.CC.link, net: DF.net(), sock: s.readyState };
  };
  const r = {
    noroom: tryClose((s) => { s.open(); s.shut(4004); }),
    full: tryClose((s) => { s.open(); s.shut(4001); }),
    failed: tryClose((s) => s.shut(1006)),
    hostGone: tryClose((s) => { s.open(); s.hear([0, 2]); }),
    version: tryClose((s) => { s.open(); s.hear(c9.ev(["no", "version"])); }),
  };
  c.noroom = r.noroom.msg === MSG.noroom;
  c.full = r.full.msg === MSG.full;
  c.failed = r.failed.msg === MSG.relay;
  // the relay's notice that the host left: the link closes its own socket
  c.hostGone = r.hostGone.msg === MSG.relay && r.hostGone.sock === 3;
  c.version = r.version.msg === MSG.version && r.version.sock === 3;
  c.allOut = Object.values(r).every((o) => o.state === "coop" && o.link === null && o.net === null);
  // the relay's joined notice is not a game frame
  c9.open(); c9.join("ABCDEF");
  const s = c9.socks[c9.socks.length - 1];
  s.open(); s.hear([0, 1]);
  c.joinedIgnored = DF.CC.link !== null && c9.msg() === "";
  // a cave that is not the host's: the join's sum does not match
  s.hear(c9.ev(["join", { v: 3, e: 1, kind: "cave", n: 1, pid: 2, seed: 99, grade: "E", sum: "00000000", enemies: [], dead: [], bossDead: false, peers: [], t: 0 }]));
  c.cave = c9.msg() === MSG.cave && DF.G.zone === "hub" && DF.net() === null && s.readyState === 3;
  c.r = Object.fromEntries(Object.entries(r).map(([k, o]) => [k, o.msg]));
  return { pass: Object.values(c).every((v) => v === true || typeof v === "object"), c };`),

  step("hosting is refused before the network where it cannot run", `
  const c = {};
  c9.stubSockets(); c9.stubFetch("ABCDEF"); c9.countWorkers();
  const host = () => { c9.open(); document.getElementById("coopHost").click(); return c9.msg(); };
  // this file page with no relay set
  c.noRelay = host() === MSG.relay;
  // another site
  DF.coopLoc({ protocol: "https:", hostname: "example.com" });
  DF.coopRelay("wss://relay.example");
  c.copy = host() === MSG.copy;
  // the published page with no relay set
  DF.coopLoc({ protocol: "https:", hostname: "maxjlerman.github.io" });
  DF.coopRelay("");
  c.pagesNoRelay = host() === MSG.relay;
  // a file page with a relay set
  DF.coopLoc(null);
  DF.coopRelay("ws://localhost:1");
  c.file = host() === MSG.file;
  c.nothingOut = c9.socks.length === 0 && c9.fetches.length === 0 && c9.workers.length === 0;
  // a browser that cannot make the Worker
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  window.Worker = function () { throw new Error("no workers here"); };
  host();
  await new Promise((r) => setTimeout(r, 50));
  c.worker = c9.msg() === MSG.worker && DF.CC.link === null && c9.fetches.length === 1;
  // POST /new refused (429, 403) or unreachable
  window.fetch = () => Promise.resolve(new Response("too many requests", { status: 429 }));
  host(); await new Promise((r) => setTimeout(r, 50));
  c.limited = c9.msg() === MSG.relay;
  window.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
  host(); await new Promise((r) => setTimeout(r, 50));
  c.unreachable = c9.msg() === MSG.relay;
  c9.back();
  return { pass: Object.values(c).every(Boolean), c };`),

  step("a hidden class falls back for the run and the save keeps it", `
  const c = {};
  const base = DF.CLASSES ? Object.keys(DF.CLASSES).find((k) => !DF.CLASSES[k].hidden) : null;
  c.unlocked = DF.unlockClass("enforcer") || DF.classOpen("enforcer");
  DF.setClass("enforcer");
  DF.renderPicker();
  c.chosen = DF.OPT.cls === "enforcer";
  c9.open();
  await c9.frames();
  const me = document.querySelector("#coopSlots .slot.me");
  c.slot = !!me && me.dataset.cls === base && me.textContent.includes(DF.CLASSES[base].name);
  // the screen's line says which class plays, and does not claim the chosen one does
  const line = () => document.querySelector("#scr-coop .sub").textContent.replace(/\\s+/g, " ").trim();
  const share = "One of you hosts a room and sends the other its code or invite link. ";
  c.line = line() === share + "The " + DF.CLASSES.enforcer.name + " cannot play online yet, so you play the " + DF.CLASSES[base].name + " unless you choose another in the room.";
  c9.back();
  DF.setClass(base);
  c9.open();
  c.lineBase = line() === share + "You each choose a class in the room.";
  DF.setClass("enforcer");
  c.two = document.querySelectorAll("#coopSlots .slot").length === 2;
  c.saveKept = DF.OPT.cls === "enforcer" && (JSON.parse(localStorage.getItem("dungeon-raze.v2") || "{}").o || {}).cls === "enforcer";
  c.base = base;
  c9.back();
  return { pass: Object.values(c).every(Boolean), c };`),

  step("hosting starts a Worker host the page joins", `
  const c = {};
  // a key in an earlier step turned touch off on a phone: back on, as a tap would
  if (navigator.maxTouchPoints > 0) { DF.TOUCH.setOn(true); await c9.frames(); }
  c9.stubFetch("ABCDEF"); c9.countWorkers();
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  // no relay listens here: the Worker's socket fails and the room stays
  DF.coopRelay("ws://localhost:1");
  DF.coopSeed(99);
  c9.open();
  const b = document.getElementById("coopHost");
  b.click(); b.click();
  // wait for the page to join its own Worker
  for (let i = 0; i < 200 && !DF.net(); i++) await new Promise((r) => setTimeout(r, 50));
  for (let i = 0; i < 60 && c9.msg() !== MSG.relay; i++) await new Promise((r) => setTimeout(r, 50));
  b.click();
  await c9.frames();
  const enter = document.getElementById("coopEnter"), show = document.getElementById("coopShow");
  c.oneWorker = c9.workers.length === 1 && c9.fetches.length === 1 && c9.fetches[0].url === "http://localhost:1/new" && c9.fetches[0].method === "POST";
  // the room starts in the hall; the first trip through E is cave 99
  c.joined = !!DF.net() && DF.net().client && !DF.net().live && DF.G.zone === "hub" && DF.CC.kind === "hub" &&
    DF.G.enemies.length === 1 && DF.G.enemies[0].def.dummy === true && DF.CC.seed === 99;
  c.code = c9.shown(show) && show.textContent.trim() === "ABCDEF" && getComputedStyle(show).userSelect !== "none";
  c.start = c9.shown(enter) && !enter.disabled && enter.textContent.trim() === "Start";
  c.relayGone = c9.msg() === MSG.relay;
  // the player is the base class; the save still says enforcer
  const base = Object.keys(DF.CLASSES).find((k) => !DF.CLASSES[k].hidden);
  c.cls = DF.G.player.clsId === base && DF.OPT.cls === "enforcer";
  const me = document.querySelector("#coopSlots .slot.me");
  c.slot = !!me && me.dataset.cls === base && document.querySelectorAll("#coopSlots .slot").length === 2;
  return { pass: Object.values(c).every(Boolean), c };`),

  step("the room screen fits and its controls are finger-sized under touch", `
  const c = {}, scr = document.getElementById("scr-coop");
  c.open = DF.G.state === "coop";
  const vw = document.documentElement.clientWidth;
  const ctl = [...scr.querySelectorAll("button, input")].filter((e) => c9.shown(e));
  const wide = ctl.filter((e) => { const r = e.getBoundingClientRect(); return r.left < -0.5 || r.right > vw + 0.5; }).map((e) => e.id || e.textContent);
  c.inside = wide.length === 0 && scr.scrollWidth <= scr.clientWidth + 1;
  const touch = document.body.classList.contains("touch");
  c.touchOnPhone = touch === navigator.maxTouchPoints > 0;
  const small = ctl.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.id || e.textContent);
  c.sizes = !touch || small.length === 0;
  c.touch = touch;
  c.wide = wide; c.small = small;
  return { pass: c.open && c.inside && c.sizes && c.touchOnPhone, c };`, { shot: "t29-room" }),

  step("the host chooses a class in the room, and the code and the invite link are copied", `
  const c = {}, pick = document.getElementById("coopCls"), cards = () => [...pick.querySelectorAll(".card")];
  const base = Object.keys(DF.CLASSES).filter((k) => !DF.CLASSES[k].hidden);
  const me = () => document.querySelector("#coopSlots .slot.me");
  c.open = DF.G.state === "coop" && !!DF.net() && !DF.net().live;
  // the cards: the base classes, the one this page plays marked
  c.cards = c9.shown(pick) && JSON.stringify(cards().map((b) => b.dataset.cls)) === JSON.stringify(base);
  const on = () => cards().filter((b) => b.classList.contains("on")).map((b) => b.dataset.cls).join();
  c.marked = on() === base[0] && DF.OPT.cls === "enforcer";
  c.label = c9.shown(document.getElementById("coopClsLbl"));
  // Start and Back sit above the cards, in reach without scrolling
  const enterBox = document.getElementById("coopEnter").getBoundingClientRect();
  c.startInView = enterBox.bottom <= innerHeight && enterBox.bottom <= pick.getBoundingClientRect().top;
  c.kit = !!pick.querySelector(".kit") && pick.querySelector(".kit").textContent.includes("Health " + DF.CLASSES[base[0]].hp);
  // a pick: this page's player, the slot, the save and the screen's line
  const to = base[3];
  cards().find((b) => b.dataset.cls === to).click();
  await c9.frames();
  c.picked = DF.G.player.clsId === to && DF.G.player.maxHp === DF.CLASSES[to].hp && DF.G.player.hp === DF.CLASSES[to].hp;
  c.slot = me().dataset.cls === to && me().textContent.includes(DF.CLASSES[to].name);
  c.saved = DF.OPT.cls === to && on() === to;
  c.line = document.getElementById("coopSub").textContent.trim().endsWith("You each choose a class in the room.");
  c.stillRoom = DF.G.state === "coop" && !!DF.net() && DF.G.zone === "hub" && DF.G.enemies.length === 1;
  // the copy buttons: the code, and this page's address with ?room=CODE
  const copy = document.getElementById("coopCopy"), link = document.getElementById("coopCopyLink");
  c.buttons = c9.shown(copy) && copy.textContent.trim() === "Copy code" && c9.shown(link) && link.textContent.trim() === "Copy invite link";
  const got = [], exec0 = document.execCommand;
  const clip = (fn) => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: fn } });
  try {
    clip((t) => { got.push(t); return Promise.resolve(); });
    copy.click();
    await c9.wait(20);
    c.code = got.length === 1 && got[0] === "ABCDEF" && copy.textContent === "Copied";
    link.click();
    await c9.wait(20);
    const url = location.href.split(/[?#]/)[0] + "?room=ABCDEF";
    c.link = got.length === 2 && got[1] === url && DF.coopInviteUrl("ABCDEF") === url && link.textContent === "Copied";
    // the labels come back
    await c9.wait(1700);
    c.labels = copy.textContent === "Copy code" && link.textContent === "Copy invite link";
    // a clipboard that refuses: the older copy command is used
    const old = [];
    clip(() => Promise.reject(new Error("denied")));
    document.execCommand = (cmd) => { old.push([cmd, document.activeElement && document.activeElement.value]); return true; };
    link.click();
    await c9.wait(20);
    c.older = old.length === 1 && old[0][0] === "copy" && old[0][1] === url && link.textContent === "Copied" && !document.querySelector("body > textarea");
    // and with neither, the button says so and the code is selected to copy by hand
    document.execCommand = () => false;
    getSelection().removeAllRanges();
    copy.click();
    await c9.wait(20);
    c.byHand = copy.textContent === "Could not copy" && String(getSelection()) === "ABCDEF";
    // a browser with no clipboard at all
    clip(undefined);
    link.click();
    await c9.wait(20);
    c.none = link.textContent === "Could not copy";
    // the labels are back for the screenshot
    await c9.wait(1700);
  } finally {
    delete navigator.clipboard;
    document.execCommand = exec0;
    getSelection().removeAllRanges();
  }
  return { pass: Object.values(c).every(Boolean), c };`, { shot: "t29-room-class" }),

  step("Start enters the hall from the click; leaving ends the Worker", `
  const c = {};
  const w = c9.workers[0];
  document.getElementById("coopEnter").click();
  document.getElementById("coopEnter").click();
  c.play = DF.G.state === "play" && !!DF.net() && DF.net().live && DF.G.zone === "hub";
  // a step of real time: the Worker steps the hall
  const t0 = DF.CC.est;
  for (let i = 0; i < 60 && DF.CC.est < t0 + 0.5; i++) await new Promise((r) => setTimeout(r, 50));
  c.runs = DF.CC.est > t0 + 0.4;
  DF.toTitle();
  for (let i = 0; i < 40 && !(w && w.dead); i++) await new Promise((r) => setTimeout(r, 50));
  c.ended = DF.net() === null && DF.CC.link === null && DF.G.zone === "hub" && !!w && w.dead === true;
  // Back from a hosted room that was not entered ends it, its Worker and the hall it built
  DF.show("title");
  c9.stubFetch("ABCDEF"); c9.countWorkers();
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  DF.coopRelay("ws://localhost:1");
  c9.open();
  document.getElementById("coopHost").click();
  for (let i = 0; i < 200 && !DF.net(); i++) await new Promise((r) => setTimeout(r, 50));
  const w2 = c9.workers[0], had = !!DF.net() && DF.CC.kind === "hub";
  c9.back();
  for (let i = 0; i < 40 && !(w2 && w2.dead); i++) await new Promise((r) => setTimeout(r, 50));
  c.backEnds = had && DF.G.state === "title" && DF.net() === null && DF.CC.link === null && DF.G.zone === "hub" && !!w2 && w2.dead === true && DF.CC.why === "left";
  DF.setClass(Object.keys(DF.CLASSES).find((k) => !DF.CLASSES[k].hidden));
  DF.show("title");
  return { pass: Object.values(c).every(Boolean), c };`),
  step("Exit to main menu leaves a hosted run and its Worker, and says nothing", `
  const c = {};
  c.hosted = await c9.hostLocal();
  const w = c9.workers[0];
  // Start is enabled by the frame after the join
  await c9.frames();
  document.getElementById("coopEnter").click();
  c.play = DF.G.state === "play" && !!DF.net() && DF.net().live && DF.G.zone === "hub";
  DF.show("pause");
  await c9.frames();
  const b = document.getElementById("btnExit");
  // in the hall, as in the solo hall, there is no Return to base
  c.btn = c9.shown(b) && !c9.shown(document.getElementById("btnBase"));
  b.click();
  for (let i = 0; i < 40 && !(w && w.dead); i++) await new Promise((r) => setTimeout(r, 50));
  c.left = DF.net() === null && DF.CC.link === null && DF.CC.why === "left" && !!w && w.dead === true;
  c.menu = DF.G.state === "title" && DF.G.zone === "hub" && c9.msg() === "";
  // the room screen is ready for another room, with no reload
  c9.stubFetch("GHJKMN"); c9.countWorkers();
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  DF.coopRelay("ws://localhost:1");
  DF.coopSeed(99);
  document.getElementById("btnCoop").click();
  c.ready = DF.G.state === "coop" && c9.shown(document.getElementById("coopHost"));
  document.getElementById("coopHost").click();
  for (let i = 0; i < 200 && !DF.net(); i++) await new Promise((r) => setTimeout(r, 50));
  c.second = !!DF.net() && document.getElementById("coopShow").textContent === "GHJKMN" && c9.workers.length === 1;
  const w2 = c9.workers[0];
  c9.back();
  for (let i = 0; i < 40 && !(w2 && w2.dead); i++) await new Promise((r) => setTimeout(r, 50));
  c.tidy = DF.net() === null && DF.G.state === "title";
  return { pass: Object.values(c).every(Boolean), c };`),
  step("a hosted room starts in the hall", `
  const c = {}, enter = document.getElementById("coopEnter");
  c.hosted = await c9.hostLocal();
  const w = c9.workers[0];
  // the join has arrived: this page is in its Worker's hall, on the room screen
  await c9.frames();
  c.hall = DF.G.state === "coop" && DF.G.zone === "hub" && DF.CC.kind === "hub" && DF.CC.epoch === 1 && !DF.net().live;
  c.start = c9.shown(enter) && !enter.disabled && enter.textContent.trim() === "Start";
  enter.click();
  c.play = DF.G.state === "play" && DF.G.zone === "hub" && !!DF.net() && DF.net().live;
  // the co-op hall: E open, every other gate sealed
  const ports = DF.G.world.portals;
  c.gates = ports.find((q) => q.grade === "E").open === true && ports.filter((q) => q.grade !== "E").every((q) => q.open === false);
  DF.toTitle();
  for (let i = 0; i < 40 && !(w && w.dead); i++) await c9.wait(50);
  c.ended = DF.net() === null && !!w && w.dead === true;
  return { pass: Object.values(c).every(Boolean), c };`),
  step("a room that never answers the hello times out", `
  const c = {};
  c9.stubSockets();
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  DF.coopRelay("ws://localhost:1");
  // setTimeout for 5 s or more is held here, to be fired by hand
  const timers = [], st0 = window.setTimeout;
  window.setTimeout = (fn, ms, ...a) => (ms >= 5000 ? (timers.push({ fn, ms }), 0) : st0(fn, ms, ...a));
  try {
    const enter = document.getElementById("coopEnter");
    c9.open();
    c9.join("ABCDEF");
    const s = c9.socks[0];
    c.noneBeforeOpen = timers.length === 0;
    s.open();
    c.timer = timers.length === 1 && timers[0].ms === 10000;
    c.waiting = DF.CC.link !== null && enter.disabled && c9.msg() === "";
    // the time runs out with no join
    if (timers[0]) timers[0].fn();
    c.timedOut = c9.msg() === MSG.relay && s.readyState === 3 && DF.CC.link === null && DF.net() === null &&
      DF.G.state === "coop" && !c9.shown(enter) && c9.shown(document.getElementById("coopPick"));
    // and the screen is ready to try again
    c9.join("ABCDEF");
    c.again = c9.socks.length === 2 && DF.CC.link !== null && c9.msg() === "";
    if (!c.again) return { pass: false, c };
    // a join in time is not undone when the time runs out
    const s2 = c9.socks[1], h = DF.coopMakeHost();
    h.start({ seed: 99, grade: "E" });
    h.send = (pid, buf) => s2.hear(new Uint8Array(buf));
    s2.open();
    for (const b of s2.sent) h.recv(2, b.slice().buffer);
    c.joined = !!DF.net() && DF.CC.link !== null;
    if (timers[1]) timers[1].fn();
    c.kept = timers.length === 2 && !!DF.net() && DF.CC.link !== null && s2.readyState === 1 && c9.msg() === "";
    c9.back();
    c.cleanedUp = DF.net() === null && DF.G.zone === "hub";
  } finally {
    window.setTimeout = st0;
  }
  return { pass: Object.values(c).every(Boolean), c };`),

  step("Start that play() refuses can be pressed again, and Back still ends the run", `
  // play() refuses while touch is on and the page is upright: touch is
  // turned on and innerHeight made taller than innerWidth here
  const c = {}, enter = document.getElementById("coopEnter");
  const d0 = Object.getOwnPropertyDescriptor(window, "innerHeight");
  const upright = (on) => {
    if (on) Object.defineProperty(window, "innerHeight", { configurable: true, get: () => innerWidth + 200 });
    else if (d0) Object.defineProperty(window, "innerHeight", d0);
    else delete window.innerHeight;
  };
  const touch0 = DF.TOUCH.on;
  try {
    // refused, then turned: Start works
    c.hosted = await c9.hostLocal();
    DF.TOUCH.setOn(true);
    upright(true);
    await c9.frames();
    enter.click();
    c.refused = DF.G.state === "coop" && !!DF.net() && DF.net().live;
    upright(false);
    await c9.frames();
    // the run is live, and the class can still be changed here
    c.cards = c9.shown(document.getElementById("coopCls"));
    c.enabled = c9.shown(enter) && !enter.disabled;
    enter.click();
    c.plays = DF.G.state === "play" && !!DF.net() && DF.net().live;
    const w = c9.workers[0];
    DF.toTitle();
    for (let i = 0; i < 40 && !(w && w.dead); i++) await c9.wait(50);
    c.ended = DF.net() === null && !!w && w.dead === true;
    // refused, then Back: the run, its cave and its Worker end
    DF.show("title");
    c.hosted2 = await c9.hostLocal();
    const w2 = c9.workers[0];
    upright(true);
    await c9.frames();
    enter.click();
    c.refused2 = DF.G.state === "coop" && !!DF.net() && DF.net().live;
    c9.back();
    for (let i = 0; i < 40 && !(w2 && w2.dead); i++) await c9.wait(50);
    c.backEnds = DF.G.state === "title" && DF.net() === null && DF.CC.link === null && DF.G.zone === "hub" && !!w2 && w2.dead === true;
  } finally {
    upright(false);
    DF.TOUCH.setOn(touch0);
    DF.show("title");
  }
  return { pass: Object.values(c).every(Boolean), c };`),

  step("a Worker that fails ends the room with a message, before or after the join", `
  const c = {};
  // before the join: a stand-in Worker that never answers and then errs
  c9.stubFetch("ABCDEF");
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  DF.coopRelay("ws://localhost:1");
  const stand = [];
  window.Worker = function () {
    const w = { onmessage: null, onerror: null, dead: false, postMessage() {}, terminate() { w.dead = true; } };
    stand.push(w);
    return w;
  };
  c9.open();
  document.getElementById("coopHost").click();
  for (let i = 0; i < 40 && !stand.length; i++) await c9.wait(25);
  if (stand[0] && stand[0].onerror) stand[0].onerror(new Event("error"));
  c.before = c9.msg() === MSG.worker && DF.CC.link === null && DF.G.state === "coop" && !!stand[0] && stand[0].dead;
  c9.back();
  c9.restore();
  // after the join and in play: the real Worker errs
  c.hosted = await c9.hostLocal();
  const w = c9.workers[0];
  await c9.frames();
  document.getElementById("coopEnter").click();
  c.play = DF.G.state === "play" && DF.net().live;
  w.onerror(new Event("error"));
  c.after = DF.G.state === "title" && c9.msg() === MSG.stopped && DF.net() === null && DF.CC.link === null &&
    DF.G.zone === "hub" && w.dead === true && DF.CC.why === "stopped";
  return { pass: Object.values(c).every(Boolean), c };`),

  step("the friend's Enter waits for the host to start, and a friend who joins later enters at once", `
  const c = {}, enter = document.getElementById("coopEnter"), txt = () => enter.textContent.trim();
  const { s, h } = await c9.friendIn();
  c.joined = !!DF.net() && DF.net().client && DF.CC.link !== null && DF.G.state === "coop";
  c.waits = c9.shown(enter) && enter.disabled && txt() === "Waiting for the host to start";
  enter.click();
  c.noEntry = DF.G.state === "coop" && !DF.net().live;
  // the host presses Start: its page's first state reaches the host
  c9.hostStarts(h);
  await c9.frames();
  c.ready = c9.shown(enter) && !enter.disabled && txt() === "Enter the hall";
  enter.click();
  c.plays = DF.G.state === "play" && DF.net().live;
  DF.coopEnd("test"); DF.enterHub(); DF.show("title");
  // a host that started before the friend joined: the join says so
  const b = await c9.friendIn((host) => c9.hostStarts(host));
  await c9.frames();
  c.later = !!DF.net() && c9.shown(enter) && !enter.disabled && txt() === "Enter the hall";
  c9.back();
  c.left = DF.net() === null && b.s.readyState === 3;
  return { pass: Object.values(c).every(Boolean), c };`),

  step("the friend's button names where it leads", `
  const c = {}, enter = document.getElementById("coopEnter"), txt = () => enter.textContent.trim();
  const { s, h } = await c9.friendIn();
  c.joined = !!DF.net() && !DF.net().live && DF.G.zone === "hub" && DF.G.state === "coop";
  c.waits = c9.shown(enter) && enter.disabled && txt() === "Waiting for the host to start";
  // the host presses Start in its hall
  c9.hostStarts(h);
  await c9.frames();
  c.hall = c9.shown(enter) && !enter.disabled && txt() === "Enter the hall";
  // the host walks into E before the friend enters: the friend is taken along
  const n0 = s.sent.length;
  h.recv(1, h.wire.eventEncode(["travel", 2, "E", 99]));
  for (const b of s.sent.slice(n0)) h.recv(2, b.slice().buffer);
  await c9.frames();
  c.cave = DF.G.zone === "cave" && DF.CC.kind === "cave" && DF.G.seed === 99 && h.S.kind === "cave" && h.S.px.get(2).here === true;
  c.screen = DF.G.state === "coop" && document.getElementById("scr-coop").classList.contains("show") && !DF.net().live;
  c.dungeon = c9.shown(enter) && !enter.disabled && txt() === "Enter the dungeon";
  enter.click();
  const p = DF.G.player, sp = DF.G.world.spawn;
  c.plays = DF.G.state === "play" && DF.net().live && DF.G.zone === "cave";
  // the friend arrives beside the cave's start, on walkable ground
  const d = Math.hypot(p.x - sp.x, p.z - sp.z);
  c.atStart = d >= 0.8 && d <= 1.6 && DF.G.world.fieldAt(p.x, p.z) > 0;
  const where = [p.x, p.z, sp.x, sp.z];
  DF.coopEnd("test"); DF.enterHub(); DF.show("title");
  return { pass: Object.values(c).every((v) => v === true), c, where };`),

  step("a friend's class, picked in the room or changed mid-run, reaches the host, and the host's shows here", `
  const c = {}, pick = document.getElementById("coopCls"), cards = () => [...pick.querySelectorAll(".card")];
  const slots = () => [...document.querySelectorAll("#coopSlots .slot")].map((e) => e.dataset.cls || "");
  const base = Object.keys(DF.CLASSES).filter((k) => !DF.CLASSES[k].hidden);
  DF.setClass(base[0]);
  // waiting for the join there are no cards
  c9.stubSockets();
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  DF.coopRelay("ws://localhost:1");
  c9.open(); c9.join("ABCDEF");
  await c9.frames();
  c.noneBeforeJoin = DF.net() === null && !c9.shown(pick) && !c9.shown(document.getElementById("coopClsLbl"));
  c9.back();
  const { s, h } = await c9.friendIn();
  c.cards = !!DF.net() && c9.shown(pick) && cards().length === base.length;
  c.first = h.S.px.get(2).clsId === base[0] && slots()[0] === base[0];
  // a pick: one numbered request (the page's first was its at), which the host takes
  const n0 = s.sent.length, to = base[2];
  cards().find((b) => b.dataset.cls === to).click();
  await c9.frames();
  const ev = s.sent.length === n0 + 1 ? c9.sentEv(s.sent[n0]) : null;
  c.asked = JSON.stringify(ev) === JSON.stringify(["cls", 2, to]);
  if (ev) h.recv(2, s.sent[n0].slice().buffer);
  c.hostHas = h.S.px.get(2).clsId === to && h.S.px.get(2).maxHp === DF.CLASSES[to].hp;
  c.mine = DF.G.player.clsId === to && DF.OPT.cls === to && slots()[0] === to && DF.CC.cls === to;
  // the host's player arrives and then picks: its slot follows
  h.join(1, base[1]);
  h.recv(1, h.wire.eventEncode(["at", 1, h.S.epoch]));
  await c9.frames();
  c.mate = slots()[1] === base[1] && DF.net().mates.length === 1;
  h.recv(1, h.wire.eventEncode(["cls", 2, base[4]]));
  await c9.frames();
  c.mateChanged = slots()[1] === base[4] && DF.net().mates.length === 1 && DF.net().mates[0].clsId === base[4];
  // the friend enters as what it picked
  c9.hostStarts(h);
  await c9.frames();
  document.getElementById("coopEnter").click();
  c.plays = DF.G.state === "play" && DF.net().live && DF.G.player.clsId === to;
  // mid-run, from the pause menu: the class screen offers the base classes
  // only, the change keeps this player's place and goes to the host
  DF.unlockClass("enforcer");
  const p = DF.G.player;
  p.x += 1.5; p.hp = p.maxHp / 2;
  const at = [p.x, p.z];
  DF.show("pause");
  document.querySelector('#scr-pause [data-open="class"]').click();
  const own = [...document.querySelectorAll("#scr-class .card")];
  c.pauseCards = DF.G.state === "class" && JSON.stringify(own.map((b) => b.dataset.cls)) === JSON.stringify(base) &&
    document.querySelector("#scr-class .card.on").dataset.cls === to;
  const n1 = s.sent.length, to2 = base[1];
  own.find((b) => b.dataset.cls === to2).click();
  const evs = s.sent.slice(n1).map((b) => c9.sentEv(b)).filter((e) => e && e[0] === "cls");
  c.askedMidRun = evs.length === 1 && evs[0][1] === 3 && evs[0][2] === to2;
  for (const b of s.sent.slice(n1)) h.recv(2, b.slice().buffer);
  c.hostHasMidRun = h.S.px.get(2).clsId === to2;
  c.kept = DF.G.player.clsId === to2 && DF.G.player.x === at[0] && DF.G.player.z === at[1] &&
    Math.abs(DF.G.player.hp - DF.CLASSES[to2].hp / 2) < 1e-6 && !!DF.net() && DF.net().live;
  // and the host's change mid-run is the same mate, where it stood
  const m0 = DF.net().mates[0], mx = m0.x;
  h.recv(1, h.wire.eventEncode(["cls", 3, base[0]]));
  await c9.frames();
  c.mateMidRun = DF.net().mates.length === 1 && DF.net().mates[0] === m0 && m0.clsId === base[0] &&
    m0.maxHp === DF.CLASSES[base[0]].hp && m0.x === mx && m0.flash === 0;
  // outside a run the class screen offers the hidden class again
  DF.coopEnd("test"); DF.enterHub(); DF.show("title");
  DF.openMenu("class", "solo");
  c.soloCards = [...document.querySelectorAll("#scr-class .card")].some((b) => b.dataset.cls === "enforcer");
  DF.show("title");
  DF.setClass(base[0]);
  return { pass: Object.values(c).every(Boolean), c };`),

  step("an invite link opens the room screen with its code filled in", `
  const c = {}, code = document.getElementById("coopCode"), join = document.getElementById("coopJoin"), host = document.getElementById("coopHost");
  c9.stubSockets(); c9.stubFetch("ABCDEF"); c9.countWorkers();
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
  DF.coopRelay("ws://localhost:1");
  const home = () => { if (DF.G.state !== "title") c9.back(); DF.show("title"); code.value = ""; DF.coopSay(""); };
  // an address with no code, or with something that is not one, is the plain page
  const plain = {};
  for (const q of ["", "?touch=1", "?room=", "?room=ABC", "?room=ABCDE0", "?room=ABCDEFG", "?broom=ABCDEF", "?room=%E0%A4%A"]) {
    home();
    plain[q] = DF.coopInvite(q) === false && DF.G.state === "title" && code.value === "";
  }
  c.plain = Object.values(plain).every(Boolean);
  c.plainEach = plain;
  // a code: the room screen, the code tidied, Join in hand, nothing sent
  home();
  c.opens = DF.coopInvite("?room=abc-def") === true && DF.G.state === "coop" && code.value === "ABCDEF";
  c.pickShown = c9.shown(join) && c9.shown(host) && document.activeElement === join;
  c.padJoin = join.hasAttribute("data-padfirst") && !host.hasAttribute("data-padfirst");
  c.nothingOut = c9.socks.length === 0 && c9.fetches.length === 0 && c9.workers.length === 0 && DF.CC.link === null;
  c.quiet = c9.msg() === "";
  // Join goes to that room
  join.click();
  c.joins = c9.socks.length === 1 && c9.socks[0].url === "ws://localhost:1/room/ABCDEF";
  // Back is the main menu, and the screen opened by hand starts on Host again
  c9.back();
  c.back = DF.G.state === "title";
  DF.openMenu("coop");
  c.padHost = host.hasAttribute("data-padfirst") && !join.hasAttribute("data-padfirst");
  // beside other things in the address
  home();
  c.among = DF.coopInvite("?touch=1&room=GHJKMN&x=2") === true && code.value === "GHJKMN";
  // a page that cannot play co-op says so on the main menu
  home();
  DF.coopLoc({ protocol: "https:", hostname: "example.com" });
  c.refused = DF.coopInvite("?room=ABCDEF") === false && DF.G.state === "title" && c9.msg() === MSG.copy && code.value === "";
  home();
  // this page was opened with no code, and booted on the main menu
  c.boot = !/[?&]room=/.test(location.search);
  return { pass: Object.values(c).every((v) => v === true || typeof v === "object"), c };`),

  step("a lost connection after the join says so, and the host leaving says that", `
  const c = {}, r = {};
  // in play: the socket drops (1006)
  let f = await c9.friendIn();
  c9.hostStarts(f.h);
  await c9.frames();
  document.getElementById("coopEnter").click();
  c.inPlay = DF.G.state === "play" && DF.net().live;
  f.s.shut(1006);
  await c9.frames();
  r.drop = c9.after();
  // joined but not in: the relay closes it for too many frames (4008)
  f = await c9.friendIn();
  f.s.shut(4008);
  await c9.frames();
  r.rate = c9.after();
  // the relay's notice that the host left
  f = await c9.friendIn();
  f.s.hear([0, 2]);
  await c9.frames();
  r.host = c9.after();
  c.hostSock = f.s.readyState === 3;
  // ten seconds without a snapshot, with the socket still open
  f = await c9.friendIn();
  c9.hostStarts(f.h);
  await c9.frames();
  document.getElementById("coopEnter").click();
  DF.net().frame(10.5);
  await c9.frames();
  r.silent = c9.after();
  c.silentSock = f.s.readyState === 3;
  const out = (o, why, msg) => o.state === "title" && o.msg === msg && o.why === why && o.zone === "hub" && o.net === null && o.link === null;
  c.drop = out(r.drop, "lost", MSG.lost);
  c.rate = out(r.rate, "lost", MSG.lost);
  c.host = out(r.host, "host", MSG.host);
  c.silent = out(r.silent, "lost", MSG.lost);
  c.r = Object.fromEntries(Object.entries(r).map(([k, o]) => [k, [o.state, o.why, o.msg]]));
  return { pass: Object.values(c).every((v) => v === true || typeof v === "object"), c };`),

  step("a world that comes before the friend enters is built at once, and the room screen stays", `
  const c = {};
  const { s, h } = await c9.friendIn(null, { seed: 99, grade: "E" });
  c.joined = !!DF.net() && DF.G.zone === "cave";
  c9.hostStarts(h);
  const n0 = s.sent.length;
  // the host's page returns to base: the friend is sent the hall
  h.recv(1, h.wire.eventEncode(["travel", 2, "hub", 0]));
  await c9.frames();
  const evs = s.sent.slice(n0).map((b) => b.slice().buffer).filter((b) => h.wire.type(b) === 3).map((b) => h.wire.eventDecode(b));
  c.hall = !!DF.net() && DF.net().live === false && DF.G.zone === "hub" && DF.CC.kind === "hub" && DF.CC.epoch === h.S.epoch && DF.G.trans === null;
  c.at = evs.some((e) => e[0] === "at" && e[1] === 1 && e[2] === h.S.epoch);
  c.screen = DF.G.state === "coop" && document.getElementById("scr-coop").classList.contains("show");
  c.noMsg = c9.msg() === "";
  c9.back();
  c.out = DF.net() === null && DF.CC.link === null;
  return { pass: Object.values(c).every(Boolean), c };`),

  step("a world this page cannot take before the friend enters is refused on the room screen, ready to try again", `
  const c = {}, r = {}, enter = document.getElementById("coopEnter");
  // the host's world events to the friend, changed by f
  const tamper = (h, f) => {
    const send = h.send;
    h.send = (pid, buf) => {
      if (pid === 2 && h.wire.type(buf) === 3) {
        const ev = h.wire.eventDecode(buf);
        if (ev[0] === "world") { f(ev[1]); buf = h.wire.eventEncode(ev); }
      }
      send(pid, buf);
    };
  };
  for (const [k, f, why] of [["bad", (d) => (d.grade = "D"), "bad"], ["cave", (d) => (d.sum = "00000000"), "cave"]]) {
    const { s, h } = await c9.friendIn();
    c9.hostStarts(h);
    tamper(h, f);
    h.recv(1, h.wire.eventEncode(["travel", 2, "E", 99]));
    await c9.frames();
    r[k] = { state: DF.G.state, msg: c9.msg(), why: DF.CC.why, zone: DF.G.zone, net: DF.net() === null, link: DF.CC.link === null, sock: s.readyState };
    c[k] = DF.G.state === "coop" && c9.msg() === MSG[why] && DF.CC.why === why && DF.G.zone === "hub" &&
      DF.net() === null && DF.CC.link === null && s.readyState === 3 &&
      c9.shown(document.getElementById("coopPick")) && !c9.shown(enter);
    // the screen is ready to try again
    c9.join("ABCDEF");
    c[k + "Again"] = DF.CC.link !== null && c9.msg() === "";
    c9.back();
  }
  c.r = r;
  return { pass: Object.values(c).every((v) => v === true || typeof v === "object"), c };`),

  step("the pause screen shows the host its room code while the relay is up, and the friend nothing", `
  const c = {}, code = document.getElementById("pauseCode");
  const txt = () => (c9.shown(code) ? code.textContent.replace(/\\s+/g, " ").trim() : "");
  c.hosted = await c9.hostLocal();
  // no relay listens here: wait for the Worker to say its socket closed
  for (let i = 0; i < 60 && c9.msg() !== MSG.relay; i++) await c9.wait(50);
  document.getElementById("coopEnter").click();
  DF.show("pause");
  await c9.frames();
  c.downHidden = txt() === "";
  // the Worker's socket opens
  DF.CC.link.onrelay("open");
  await c9.frames();
  c.shown = txt() === "Room code ABCDEF";
  const v = document.getElementById("pauseCodeV");
  c.selectable = !!v && v.textContent === "ABCDEF" && getComputedStyle(v).userSelect !== "none";
  // with it, the two copy buttons
  const copy = document.getElementById("pauseCopy"), link = document.getElementById("pauseCopyLink"), got = [];
  c.buttons = c9.shown(copy) && copy.textContent.trim() === "Copy code" && c9.shown(link) && link.textContent.trim() === "Copy invite link";
  try {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { got.push(t); return Promise.resolve(); } } });
    copy.click(); link.click();
    await c9.wait(20);
  } finally {
    delete navigator.clipboard;
  }
  c.copied = JSON.stringify(got) === JSON.stringify(["ABCDEF", location.href.split(/[?#]/)[0] + "?room=ABCDEF"]);
  // the pause screen still fits, and a pad still starts on Resume
  const scr = document.getElementById("scr-pause"), vw = document.documentElement.clientWidth;
  c.fits = [...scr.querySelectorAll("button")].filter((e) => c9.shown(e)).every((e) => { const r = e.getBoundingClientRect(); return r.left >= -0.5 && r.right <= vw + 0.5; });
  c.padFirst = document.getElementById("btnResume").hasAttribute("data-padfirst");
  // and closes again
  DF.CC.link.onrelay("closed");
  await c9.frames();
  c.closedHidden = txt() === "" && !c9.shown(copy) && !c9.shown(link);
  DF.CC.link.onrelay("open");
  const w = c9.workers[0];
  DF.toTitle();
  for (let i = 0; i < 40 && !(w && w.dead); i++) await c9.wait(50);
  DF.show("pause");
  await c9.frames();
  c.goneHidden = txt() === "" && DF.net() === null;
  DF.show("title");
  // the friend sees nothing extra
  const f = await c9.friendIn((h) => c9.hostStarts(h));
  document.getElementById("coopEnter").click();
  DF.show("pause");
  await c9.frames();
  c.friendHidden = !!DF.net() && txt() === "" && !c9.shown(document.getElementById("pauseCopy"));
  DF.coopEnd("test"); DF.enterHub(); DF.show("title");
  return { pass: Object.values(c).every(Boolean), c };`),

  step("Back by touch on the room screen ends the room as its button does", `
  const c = {}, touch0 = DF.TOUCH.on;
  try {
    DF.TOUCH.setOn(true);
    const { s } = await c9.friendIn();
    c.joined = !!DF.net() && DF.G.state === "coop";
    dispatchEvent(new PopStateEvent("popstate", { state: null }));
    await c9.frames();
    c.ended = DF.G.state === "title" && DF.net() === null && DF.CC.link === null && DF.CC.why === "left" && DF.G.zone === "hub" && s.readyState === 3;
    // another menu still goes back as before
    DF.openMenu("howto");
    dispatchEvent(new PopStateEvent("popstate", { state: null }));
    await c9.frames();
    c.howto = DF.G.state === "title";
  } finally {
    DF.TOUCH.setOn(touch0);
    DF.show("title");
  }
  return { pass: Object.values(c).every(Boolean), c };`),
];
