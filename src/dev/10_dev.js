// ---------- dev menu: local builds only ----------
// `node build.mjs --release` (the published page) leaves this folder out.
// Even when it is built in, it turns on only for a page opened from this
// machine.
function devHost(loc) {
  return (
    loc.protocol === "file:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(loc.hostname)
  );
}
// Opens every hidden class for this session. They go in DEV.unlocked, never
// in UNLOCKED, so the save does not learn of them. Returns the ids added.
function devUnlockAll() {
  const added = CLASS_IDS.filter((id) => !classOpen(id));
  for (const id of added) DEV.unlocked.add(id);
  renderPicker();
  devRender();
  return added;
}
// Through any gate, open or not, into a fresh world of that grade. Grades
// with no world of their own get the cave, as WORLD_GEN says.
function devGate(grade) {
  enterCave(grade);
  DEV.run = G.world;
  play();
}
// The cave a co-op pair enters, walked alone: E's 36-room cave, with no net.
// Without a seed the cave is a random one, as through the gate.
function devBigCave(seed) {
  enterCave("E", seed, true);
  DEV.run = G.world;
  play();
}
// The bosses there are to jump to, by grade.
const DEV_BOSSES = [
  ["E", "The Warden"],
  ["D", "Old Sluicejaw"],
];
// A fresh run of the grade that starts at its last rest point, the one
// nearest the boss, lit and made the checkpoint so a death wakes there too.
// A cave too short for one starts at its arrival rest point.
function devBoss(grade, seed) {
  enterCave(grade, seed);
  DEV.run = G.world;
  const w = G.world,
    p = G.player,
    sh = w.shrines[w.shrines.length - 1];
  sh.lit = true;
  G.checkpoint = sh;
  p.x = sh.x;
  p.z = sh.z - 1.6;
  w.resolve(p, 0.6);
  if (w.boss) p.yaw = Math.atan2(w.boss.x - p.x, w.boss.z - p.z);
  snapCam();
  play();
}
// The Warden for two, fought alone: a co-op run over the fake link (coopSolo)
// in a cave for two, with the scripted second player fighting. This player
// and that one stand at the door spot, the way into the chamber the seal
// leaves, and the last rest point is lit and the checkpoint, as devBoss does.
// Nothing is saved (coopSolo makes the run the dev run). A room with a real
// friend, or one being joined, is not torn down: nothing starts and the dev
// screen says why. Returns the run (see coopSolo), or null.
let wardenRun = null;
function devWardenSay(text) {
  const m = $("devW2Msg");
  if (!m) return;
  m.textContent = text;
  m.hidden = !text;
}
function devWardenTwo(seed = 1 + Math.floor(Math.random() * 99999)) {
  if ((NET || CC.link) && !(CC.link && CC.link.solo)) {
    devWardenSay("A co-op room is open. Leave it first.");
    return null;
  }
  devWardenSay("");
  wardenRun = null;
  const out = coopSolo({ two: true, seed, mate: "fight" });
  if (!NET) {
    devWardenSay("The run did not start" + (out.refused ? ": " + out.refused : "."));
    return null;
  }
  wardenRun = out;
  const w = G.world,
    p = G.player,
    sh = w.shrines[w.shrines.length - 1],
    d = sealDoor(w),
    m = out.mate.p;
  sh.lit = true;
  G.checkpoint = sh;
  Object.assign(p, { x: d.x, z: d.z, yaw: d.yaw });
  // beside this player, to its right
  Object.assign(m, { x: d.x - Math.cos(d.yaw) * 1.6, z: d.z + Math.sin(d.yaw) * 1.6, yaw: d.yaw });
  out.host.G.world.resolve(m, m.r);
  snapCam();
  play();
  return out;
}
// The run the Fight button started, while it is the page's run, else null.
function devWardenLive() {
  return wardenRun && NET && CC.link === wardenRun.link ? wardenRun : null;
}
// The Warden of that run put at the start of phase n (2 to 4), as host.phase
// does; null with no such run, or once it is in phase n or later.
function devWardenPhase(n) {
  const r = devWardenLive();
  return r ? r.host.phase(n) : null;
}
// God mode: hurtPlayer takes nothing and grabPlayer refuses while it is on,
// and tick keeps everything full. It stays on through world swaps and is
// off on every page load. Returns the new setting.
function devGod(on = !DEV.god) {
  DEV.god = !!on;
  devRender();
  return DEV.god;
}
function devTick() {
  const p = G.player;
  if (!DEV.god || !p || p.state === "dead") return;
  p.hp = p.maxHp;
  p.stam = p.maxStam;
  p.flasks = 3;
  p.tool = p.cls.tool.max;
  p.focus = 100;
}
// Refreshes the labels that show the menu's state.
function devRender() {
  const u = $("devUnlock");
  if (u) {
    const all = CLASS_IDS.every(classOpen);
    u.textContent = all ? "Hidden classes unlocked" : "Unlock hidden classes";
    u.disabled = all;
  }
  const g = $("devGod");
  if (g) g.textContent = "God mode: " + (DEV.god ? "on" : "off");
  const b = $("devBadge");
  if (b) b.hidden = !DEV.god;
}
// The backquote key: from play it opens the menu over pause, so Back lands
// on the pause screen; on the menu it goes back. A player who has bound the
// key to an action keeps that action.
function devToggle() {
  if (G.state === "play") {
    show("pause");
    openMenu("dev");
  } else if (G.state === "title" || G.state === "pause") openMenu("dev");
  else if (G.state === "dev") show(menuBack);
}
function devBuild() {
  const scr = document.createElement("div");
  scr.id = "scr-dev";
  scr.className = "scr wide";
  scr.innerHTML =
    '<h1 class="sm">Dev</h1>' +
    '<p class="sub">Local builds only. Nothing here is saved.</p>' +
    '<div class="row"><button type="button" id="devUnlock"></button>' +
    '<button type="button" id="devGod"></button></div>' +
    '<p class="sub">Enter a gate</p><div class="row">' +
    GRADE_IDS.map(
      (g) =>
        '<button type="button" data-dev-gate="' + g + '">' + GRADES[g].name + "</button>",
    ).join("") +
    '<button type="button" data-dev-big="1">Big cave (co-op size)</button>' +
    '</div><p class="sub">Jump to a boss</p><div class="row">' +
    DEV_BOSSES.map(
      ([g, name]) =>
        '<button type="button" data-dev-boss="' + g + '">' + name + "</button>",
    ).join("") +
    "</div>" +
    '<p class="sub">Warden for two</p><div class="row">' +
    '<button type="button" data-dev-w2="1">Fight</button>' +
    [2, 3, 4]
      .map((n) => '<button type="button" data-dev-w2p="' + n + '">Phase ' + n + "</button>")
      .join("") +
    '</div><p class="sub" id="devW2Msg" hidden></p>' +
    '<div class="row"><button type="button" data-back="1">Back</button></div>';
  $("scr-title").after(scr);
  scr
    .querySelector("[data-back]")
    .addEventListener("click", () => show(menuBack));
  const open = (id, text) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.textContent = text;
    b.addEventListener("click", () => openMenu("dev"));
    return b;
  };
  $("scr-title").querySelector(".row").append(open("btnDev", "Dev menu"));
  $("btnBase").before(open("btnDevPause", "Dev"));
  $("devUnlock").addEventListener("click", devUnlockAll);
  $("devGod").addEventListener("click", () => devGod());
  // shown over the game while god mode is on, so it is never forgotten
  const badge = document.createElement("div");
  badge.id = "devBadge";
  badge.textContent = "GOD";
  badge.hidden = true;
  badge.style.cssText =
    "position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:50;" +
    "padding:2px 8px;font:700 12px/1.4 monospace;letter-spacing:2px;" +
    "color:#ffd166;background:rgba(0,0,0,.55);border:1px solid #ffd166;" +
    "border-radius:3px;pointer-events:none";
  document.body.append(badge);
  for (const b of scr.querySelectorAll("[data-dev-gate]"))
    b.addEventListener("click", () => devGate(b.dataset.devGate));
  scr.querySelector("[data-dev-big]").addEventListener("click", () => devBigCave());
  for (const b of scr.querySelectorAll("[data-dev-boss]"))
    b.addEventListener("click", () => devBoss(b.dataset.devBoss));
  scr.querySelector("[data-dev-w2]").addEventListener("click", () => devWardenTwo());
  for (const b of scr.querySelectorAll("[data-dev-w2p]"))
    b.addEventListener("click", () => {
      if (devWardenPhase(+b.dataset.devW2p)) play();
    });
  SCREENS.push("dev");
  MENUS.push("dev");
  addEventListener("keydown", (e) => {
    if (e.code !== "Backquote" || e.repeat) return;
    if (Object.values(BIND).includes("Backquote")) return;
    devToggle();
  });
  devRender();
}
if (devHost(location)) {
  // run: the world a dev action started, kept through respawn (same world)
  DEV = {
    god: false,
    unlocked: new Set(),
    run: null,
    tick: devTick,
    // a boss kill now is not saved as a cleared grade
    noSave: () => DEV.god || (!!G.world && DEV.run === G.world),
  };
  Object.assign(DF, { DEV, devUnlockAll, devGate, devBigCave, devBoss, devGod, devWardenTwo, devWardenPhase, devWardenRun: devWardenLive });
  devBuild();
}
DF.devHost = devHost;
