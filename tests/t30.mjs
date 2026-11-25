// The main menu, choosing a class after a Play button, and Exit to main
// menu. Runs from the title, on the desktop page and on a phone:
//   node build.mjs && SCRIPT=$PWD/tests/t30.mjs node test.mjs title
//   DEVICE=iphone-se SCRIPT=$PWD/tests/t30.mjs node test.mjs title
// Every step returns an object with a boolean `pass`.
const HELP = `
  const $ = (s) => document.querySelector(s), id = (s) => document.getElementById(s);
  const shown = (el) => !!el && !el.hidden && el.getClientRects().length > 0 && getComputedStyle(el).display !== "none";
  const txt = (s) => { const el = id(s); return el ? el.textContent.trim() : null; };
  const frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  const G = DF.G;
  const key = (code) => dispatchEvent(new KeyboardEvent("keydown", { code, key: code, bubbles: true }));
  const other = () => DF.pickable().find((c) => c !== DF.OPT.cls);
  const card = (cls) => $('#scr-class .card[data-cls="' + cls + '"]');
  // back to the main menu whatever the last step left
  const home = () => { if (G.state === "coop") $("#scr-coop [data-back]").click(); DF.show("title"); };
  const all = (c) => ({ pass: Object.values(c).every((v) => v === true), c });
`;
const step = (name, body) => ({
  name,
  eval: `(async () => { ${HELP} ${body} })()`,
});

export default [
  step("main menu", `
  const c = {}, row = [...document.querySelectorAll("#scr-title .row button")].filter((b) => b.id !== "btnDev" && shown(b));
  c.shown = id("scr-title").classList.contains("show") && G.state === "title";
  c.noPicker = $("#scr-title .picker") === null;
  c.row = JSON.stringify(row.map((b) => b.textContent.trim())) === JSON.stringify(["Play solo", "Play online", "How to play", "Controls"]);
  c.ids = !!row[0] && row[0].id === "btnSolo" && row[1].id === "btnCoop";
  c.online = !!id("btnCoop") && id("btnCoop").hidden === false && location.search === "";
  c.noGate = typeof DF.coopButton === "undefined";
  c.padFirst = !!id("btnSolo") && id("btnSolo").hasAttribute("data-padfirst");
  c.blurb = !/Pick a class/.test($("#scr-title .sub").textContent);
  return all(c);`),

  step("play solo", `
  const c = {};
  home();
  const was = DF.OPT.cls;
  id("btnSolo").click();
  c.state = G.state === "class" && DF.classFor() === "solo";
  c.forward = shown(id("btnPlay")) && txt("btnPlay") === "Enter the hall" && id("btnPlay").hasAttribute("data-padfirst");
  c.noSub = !!id("classSub") && id("classSub").hidden === true;
  c.saved = !!$("#scr-class .card.on") && $("#scr-class .card.on").dataset.cls === was;
  const to = other();
  card(to).click();
  c.picked = DF.OPT.cls === to && txt("btnPlay") === "Enter the hall";
  id("btnPlay").click();
  await frames();
  c.play = G.state === "play" && G.zone === "hub";
  c.cls = G.player.clsId === to;
  return all(c);`),

  // Review Focus 1: no forward button mid-run
  step("class from pause", `
  const c = {};
  DF.show("pause");
  $('#scr-pause [data-open="class"]').click();
  c.state = G.state === "class" && DF.classFor() === null;
  c.noForward = !shown(id("btnPlay")) && !id("btnPlay").hasAttribute("data-padfirst");
  c.sub = shown(id("classSub")) && /Switching mid-run/.test(txt("classSub"));
  $("#scr-class [data-back]").click();
  c.back = G.state === "pause";
  return all(c);`),

  step("play online", `
  const c = {};
  home();
  id("btnCoop").click();
  c.state = G.state === "class" && DF.classFor() === "online";
  c.forward = shown(id("btnPlay")) && txt("btnPlay") === "Continue";
  id("btnPlay").click();
  await frames();
  c.room = G.state === "coop" && id("scr-coop").classList.contains("show");
  c.heading = $("#scr-coop h1").textContent.trim() === "Play online";
  c.line = $("#scr-coop .sub").textContent.replace(/\\s+/g, " ").includes("You play the class you just chose.");
  const me = $("#coopSlots .slot.me");
  c.slot = !!me && me.dataset.cls === DF.OPT.cls;
  $("#scr-coop [data-back]").click();
  c.back = G.state === "title";
  return all(c);`),

  step("back from the class screen", `
  const c = {};
  home();
  id("btnSolo").click();
  $("#scr-class [data-back]").click();
  c.button = G.state === "title";
  id("btnCoop").click();
  key("Escape");
  c.esc = G.state === "title";
  return all(c);`),

  step("enter on the main menu", `
  const c = {};
  home();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  key("Enter");
  c.opens = G.state === "class" && DF.classFor() === "solo";
  home();
  return all(c);`),

  step("the co-op line sits above the buttons", `
  const c = {};
  home();
  DF.coopSay("The host has left.");
  const m = id("coopMsg");
  c.said = shown(m) && m.textContent === "The host has left.";
  c.above = m.nextElementSibling === $("#scr-title .row");
  DF.coopSay("");
  c.cleared = !shown(m);
  return all(c);`),

  step("the touch Back gesture", `
  const c = {}, touch0 = DF.TOUCH.on;
  try {
    DF.TOUCH.setOn(true);
    home();
    id("btnSolo").click();
    dispatchEvent(new PopStateEvent("popstate", { state: null }));
    c.fromClass = G.state === "title";
    id("btnCoop").click();
    id("btnPlay").click();
    c.inRoom = G.state === "coop";
    dispatchEvent(new PopStateEvent("popstate", { state: null }));
    c.fromRoom = G.state === "title";
  } finally {
    DF.TOUCH.setOn(touch0);
    home();
  }
  return all(c);`),

  // A real Back, not a made-up event: before the first play nothing has
  // given the browser an entry to go back to but the page before the game.
  step("a real Back under touch on the class screen stays on the page", `
  const c = {}, touch0 = DF.TOUCH.on;
  const back = () => new Promise((res) => {
    const on = () => { clearTimeout(t); res(true); };
    const t = setTimeout(() => { removeEventListener("popstate", on); res(false); }, 1500);
    addEventListener("popstate", on, { once: true });
    history.back();
  });
  try {
    DF.TOUCH.setOn(true);
    home();
    id("btnSolo").click();
    c.fromClass = (await back()) && G.state === "title";
    id("btnCoop").click();
    id("btnPlay").click();
    c.fromRoom = (await back()) && G.state === "title";
    id("btnSolo").click();
    $("#scr-class [data-back]").click();
    id("btnSolo").click();
    c.afterButton = (await back()) && G.state === "title";
    c.here = location.pathname.endsWith("index.html");
  } finally {
    DF.TOUCH.setOn(touch0);
    home();
  }
  return all(c);`),

  // Review Focus 5
  step("fits a small screen", `
  const c = {}, d = {};
  home();
  await frames();
  const inside = (el) => { el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect(); return r.left >= -0.5 && r.top >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; };
  const row = [...document.querySelectorAll("#scr-title .row button")].filter(shown);
  c.menu = row.length >= 4 && row.every(inside);
  id("btnSolo").click();
  await frames();
  c.forward = inside(id("btnPlay"));
  c.back = inside($("#scr-class [data-back]"));
  d.size = innerWidth + "x" + innerHeight;
  home();
  return { ...all(c), d };`),

  step("exit from the hall", `
  const c = {};
  DF.enterHub(); DF.show("play"); DF.show("pause");
  await frames();
  c.btn = shown(id("btnExit")) && txt("btnExit") === "Exit to main menu";
  c.noBase = !shown(id("btnBase"));
  c.last = $("#scr-pause .row").lastElementChild === id("btnExit");
  const hall = G.enemies.length;
  id("btnExit").click();
  await frames();
  c.title = G.state === "title" && id("scr-title").classList.contains("show");
  c.hall = G.zone === "hub" && G.enemies.length === hall;
  c.hud = !id("hud").classList.contains("show");
  return all(c);`),

  step("exit from a cave", `
  const c = {};
  DF.enterHub();
  const hall = G.enemies.length;
  DF.enterCave("E", 99); DF.show("play"); G.kills = 3; DF.show("pause");
  await frames();
  c.both = shown(id("btnBase")) && shown(id("btnExit"));
  c.order = id("btnBase").nextElementSibling === id("btnExit");
  id("btnExit").click();
  await frames();
  c.title = G.state === "title";
  c.fresh = G.zone === "hub" && G.enemies.length === hall && G.kills === 0;
  c.hud = !id("hud").classList.contains("show");
  return all(c);`),

  step("exit from death", `
  const c = {};
  DF.enterCave("E", 99); G.player.state = "dead"; G.player.hp = 0; G.player.t = 2; DF.show("play"); DF.sim(0.1); DF.show("dead");
  await frames();
  c.btn = shown(id("btnDeadExit")) && txt("btnDeadExit") === "Exit to main menu";
  c.last = $("#scr-dead .row").lastElementChild === id("btnDeadExit");
  id("btnDeadExit").click();
  await frames();
  await frames();
  c.title = G.state === "title" && !id("scr-dead").classList.contains("show");
  c.alive = G.player.state !== "dead" && G.player.hp === G.player.maxHp && G.zone === "hub";
  return all(c);`),

  step("exit from the win screen", `
  const c = {};
  DF.enterCave("E", 99); DF.show("win");
  await frames();
  c.btn = shown(id("btnWinExit")) && txt("btnWinExit") === "Exit to main menu";
  c.last = $("#scr-win .row").lastElementChild === id("btnWinExit");
  id("btnWinExit").click();
  await frames();
  await frames();
  c.title = G.state === "title" && !id("scr-win").classList.contains("show");
  c.hall = G.zone === "hub";
  return all(c);`),

  // Review Focus 3
  step("the class picked after an exit is the one played", `
  const c = {};
  DF.enterCave("E", 99); DF.show("play"); DF.show("pause");
  id("btnExit").click();
  const to = other();
  id("btnSolo").click();
  card(to).click();
  id("btnPlay").click();
  await frames();
  c.play = G.state === "play" && G.zone === "hub";
  c.cls = G.player.clsId === to && DF.OPT.cls === to;
  c.full = G.player.hp === G.player.maxHp;
  home();
  return all(c);`),

  // Review Focus 4
  step("exit during a portal fade", `
  const c = {}, was = G.manual;
  G.manual = true;
  try {
    DF.enterHub(); DF.show("play");
    G.trans = { t: 0, grade: "E", swapped: false };
    DF.sim(0.05);
    c.fading = !!G.trans && G.zone === "hub";
    DF.toTitle();
    c.cleared = G.trans === null && G.state === "title";
    id("btnSolo").click();
    id("btnPlay").click();
    DF.sim(2);
    c.stays = G.zone === "hub" && G.state === "play" && G.trans === null;
  } finally {
    G.manual = was;
    home();
  }
  return all(c);`),

  // shots to look at: shots/[device-]t30-menu.png and t30-class.png
  { name: "shot: the main menu", eval: `DF.show("title")`, wait: 400, shot: "t30-menu" },
  { name: "shot: the class screen for a solo start", eval: `document.getElementById("btnSolo").click()`, wait: 400, shot: "t30-class" },
  { name: "back to the main menu", eval: `DF.show("title")` },
];
