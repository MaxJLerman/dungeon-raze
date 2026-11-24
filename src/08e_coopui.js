// ---------- co-op on screen ----------
// What a co-op run adds to the HUD and the menus: the other player's health
// as a thin bar under this player's vitals (#mateBar), "Waiting for the host"
// over the game while snapshots have stopped (#coopWait), the pause screen's
// note that the dungeon runs on (#pauseCoop), the room screen (#scr-coop)
// and its line of news (#coopMsg). All but the last two are hidden whenever
// NET is null.

// The deployed relay's wss:// address, set when the owner deploys it
// (relay/README.md). Empty, co-op says it cannot reach the relay. POST /new
// goes to the same address over https:// (http:// for a ws:// one).
let COOP_RELAY = "";
const COOP_PAGES = "https://maxjlerman.github.io/dungeon-raze/";
// The relay's alphabet: no O, 0, 1, I or L.
const COOP_CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;
const COOP_SAY = {
  noroom: "No room has that code.",
  full: "That room is full.",
  relay: "Cannot reach the co-op relay.",
  copy: "This copy of the game cannot play co-op. Play at " + COOP_PAGES,
  file: "Co-op does not run from a file. Run npm run dev and open http://localhost:8000/?coop=1",
  cave: "This browser built a different cave from the host's. Co-op cannot run here.",
  version: "You and the host are on different versions of the game. Both reload the page.",
  worker: "This browser cannot host a room.",
  host: "The host has left.",
  code: "That code is not valid.",
};
// CR is the room screen's state:
//   role   "host" or "friend" while a room is being made or is up, else null
//   link   the room's link once there is one; the room is over once CC.link
//          is no longer it
//   code   the room's code
//   busy   the room is being made (POST /new in flight)
//   try    counts attempts, so an answer that comes after Back is dropped
//   loc    a stand-in for location, for tests (DF.coopLoc)
//   seed   the seed the next hosted run uses, for tests; null is random
//   html   what #coopSlots last showed
const CR = { role: null, link: null, code: "", busy: false, try: 0, loc: null, seed: null, html: "" };

// Writes the co-op line on the screen it is written on: the room screen
// while it is up, else the title screen. An empty text clears and hides it.
function coopSay(text) {
  const el = $("coopMsg"),
    room = G.state === "coop",
    at = room ? $("coopSlots") : $("scr-title").querySelector(".picker");
  if (at && el.nextElementSibling !== at) at.before(el);
  el.textContent = text || "";
  el.hidden = !text;
}
// Shows #btnCoop when the address asks for co-op (?coop=1).
function coopButton(search = location.search) {
  let on = false;
  try {
    on = new URLSearchParams(search).get("coop") === "1";
  } catch (e) {
    on = false;
  }
  $("btnCoop").hidden = !on;
}

// What stops co-op before any network use, in order, as a key of
// COOP_SAY, or "" when nothing does. code is the tidied code for a join.
function coopCheck(code) {
  const loc = CR.loc || location,
    file = loc.protocol === "file:",
    pages = loc.protocol === "https:" && loc.hostname === "maxjlerman.github.io",
    local = loc.hostname === "localhost" || loc.hostname === "127.0.0.1";
  if (!(file || pages || local)) return "copy";
  if (!COOP_RELAY) return "relay";
  if (file) return "file";
  if (code !== undefined && !COOP_CODE_RE.test(code)) return "code";
  return "";
}
// A code as typed: upper case, without spaces or dashes.
const coopTidy = (s) => String(s || "").toUpperCase().replace(/[\s-]+/g, "");
const coopRelayBase = () => COOP_RELAY.replace(/\/+$/, "");
// The class this page plays in co-op (the save is not changed).
const coopMyCls = () => coopBaseCls(OPT.cls);

// True while a room is being made or is up and not yet over.
function coopRoomLive() {
  if (CR.role && !CR.busy && CR.link && CC.link !== CR.link) coopRoomClear();
  return !!CR.role;
}
function coopRoomClear() {
  Object.assign(CR, { role: null, link: null, code: "", busy: false });
}
// The room screen has just opened: its line starts empty.
function coopRoomOpen() {
  coopSay("");
  coopRoomRender();
}
// Ends a room that was not entered (Back on the room screen) and drops
// anything still on its way. A cave built by the join goes with it.
function coopLeaveRoom() {
  CR.try++;
  const mine = CR.link && CC.link === CR.link;
  coopRoomClear();
  if (!mine || (NET && NET.live)) return;
  if (NET && NET.client) enterHub();
  else coopEnd("left");
}
// The room could not go ahead: the reason as a message.
function coopRoomRefused(why) {
  coopRoomClear();
  coopSay(COOP_SAY[why] || COOP_SAY.relay);
}

async function coopHostRoom() {
  if (coopRoomLive()) return;
  const bad = coopCheck();
  if (bad) return coopSay(COOP_SAY[bad]);
  const my = ++CR.try;
  CR.role = "host";
  CR.busy = true;
  coopSay("");
  coopRoomRender();
  let code = "";
  try {
    const r = await fetch(coopRelayBase().replace(/^ws/, "http") + "/new", { method: "POST" });
    if (r.ok) code = String((await r.json()).code || "");
  } catch (e) {
    code = "";
  }
  if (my !== CR.try) return;
  if (!COOP_CODE_RE.test(code)) return coopRoomRefused("relay");
  let w;
  try {
    w = coopWorkerLink();
  } catch (e) {
    return coopRoomRefused("worker");
  }
  Object.assign(CR, { busy: false, code, link: w.link });
  w.link.onrelay = coopRelayNews;
  const seed = CR.seed !== null ? CR.seed : (Math.random() * 1e9) | 0 || 7;
  w.worker.postMessage({ start: { seed, grade: "E", relay: coopRelayBase(), code } });
  coopBegin(w.link, { cls: coopMyCls(), onRefuse: coopRoomRefused });
  coopRoomRender();
}
// The host's relay socket, as its Worker reports it. Gone, the run goes on
// for this page alone.
function coopRelayNews(s) {
  if (s !== "error" && s !== "closed") return;
  if (G.state === "coop") coopSay(COOP_SAY.relay);
  else if (NET && NET.live) say("The co-op relay has closed. No friend can join now.", "", 4);
}
function coopJoinRoom() {
  if (coopRoomLive()) return;
  const input = $("coopCode"),
    code = coopTidy(input.value);
  input.value = code;
  const bad = coopCheck(code);
  if (bad) return coopSay(COOP_SAY[bad]);
  let link;
  try {
    link = coopSocketLink(coopRelayBase() + "/room/" + code);
  } catch (e) {
    return coopSay(COOP_SAY.relay);
  }
  CR.try++;
  Object.assign(CR, { role: "friend", busy: false, code, link });
  coopSay("");
  coopBegin(link, { cls: coopMyCls(), onRefuse: coopRoomRefused });
  coopRoomRender();
}
// Into the run the join built, from this player's click.
function coopEnterRoom() {
  if (!coopRoomLive() || !NET || !NET.client || NET.live || CC.link !== CR.link) return;
  coopEnter();
  play();
}
function coopCopy() {
  const code = CR.code,
    b = $("coopCopy");
  if (!code) return;
  const done = () => {
    b.textContent = "Copied";
    setTimeout(() => (b.textContent = "Copy"), 1500);
  };
  try {
    navigator.clipboard.writeText(code).then(done, () => coopSelectCode());
  } catch (e) {
    coopSelectCode();
  }
}
// selects the code on screen, for a copy by hand
function coopSelectCode() {
  try {
    const r = document.createRange();
    r.selectNodeContents($("coopShow"));
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  } catch (e) {
    /* nothing to select */
  }
}

// The room screen from CR, NET and CC. Called when it opens and every frame
// it is up (from coopHud); the slots are rewritten only when they change.
function coopRoomRender() {
  const live = coopRoomLive(),
    host = CR.role === "host",
    joined = !!(NET && NET.client && CR.link && CC.link === CR.link),
    mate = joined && NET.mates.length ? NET.mates[0] : null,
    enter = $("coopEnter");
  $("coopPick").hidden = live;
  $("coopRoom").hidden = !live || !CR.code || !host;
  if ($("coopShow").textContent !== CR.code) $("coopShow").textContent = CR.code;
  enter.hidden = !live;
  enter.disabled = !joined;
  const label = host ? "Start" : joined ? "Enter the cave" : "Waiting for the host to start";
  if (enter.textContent !== label) enter.textContent = label;
  const me = coopMyCls(),
    slot = (cls, who, mine) =>
      '<div class="slot' + (mine ? " me" : "") + '"' + (cls ? ' data-cls="' + cls + '"' : "") + ">" +
      "<span>" + who + "</span><b>" + (cls ? CLASSES[cls].name : live ? "Not here yet" : "None yet") + "</b></div>";
  const html =
    slot(me, host ? "You, hosting" : "You", true) +
    slot(mate ? mate.clsId : null, CR.role === "friend" ? "The host" : "Your friend", false);
  if (html !== CR.html) {
    CR.html = html;
    $("coopSlots").innerHTML = html;
  }
}
function coopUiInit() {
  coopButton();
  $("btnCoop").addEventListener("click", () => openMenu("coop"));
  $("coopHost").addEventListener("click", coopHostRoom);
  $("coopJoin").addEventListener("click", coopJoinRoom);
  $("coopCode").addEventListener("keydown", (e) => {
    if (e.code === "Enter" || e.code === "NumpadEnter") {
      e.preventDefault();
      coopJoinRoom();
    }
  });
  $("coopEnter").addEventListener("click", coopEnterRoom);
  $("coopCopy").addEventListener("click", coopCopy);
  $("scr-coop").querySelector("[data-back]").addEventListener("click", coopLeaveRoom);
}

// Called from HUD.update every frame. The wait is measured in real time
// since the last snapshot (CC.now), so it shows under the pause screen and
// through hit-stop too.
function coopHud() {
  const run = !!(NET && NET.client),
    m = run ? NET.mates[0] : null,
    bar = $("mateBar");
  bar.hidden = !m;
  if (m) {
    const c = m.cls.col.map((v) => Math.round(Math.sqrt(sat(v)) * 255)).join(",");
    $("mateF").style.width = sat(m.hp / m.maxHp) * 100 + "%";
    $("mateF").style.background = "rgb(" + c + ")";
    bar.classList.toggle("away", m.away);
  }
  $("coopWait").hidden = !(run && CC.heard >= 0 && CC.now - CC.heard > COOP.WAIT);
  $("pauseCoop").hidden = !run;
  if (G.state === "coop") coopRoomRender();
}
