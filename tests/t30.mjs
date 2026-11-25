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
  // the test page is a file:, which cannot play co-op: stand in for localhost
  DF.coopLoc({ protocol: "http:", hostname: "localhost" });
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

  // a real mouse over the cards; a phone has no __mouse and no hover
  step("cards stay readable under the mouse", `
  const c = {}, d = {};
  if (!window.__mouse) return { pass: true, skipped: true };
  home();
  id("btnSolo").click();
  const lum = (s) => {
    const v = s.match(/[\\d.]+/g).map(Number), f = (x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4),
      a = v.length > 3 ? v[3] : 1;
    // a see-through background lies over a near black screen
    return 0.2126 * f(v[0] * a) + 0.7152 * f(v[1] * a) + 0.0722 * f(v[2] * a);
  };
  const ratio = (el, bg) => { const x = lum(getComputedStyle(el).color), y = lum(bg); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  for (const k of ["on", "other"]) {
    const el = k === "on" ? $("#scr-class .card.on") : card(other()), r = el.getBoundingClientRect();
    await window.__mouse(r.left + r.width / 2, r.top + r.height / 2);
    await frames();
    const bg = getComputedStyle(el).backgroundColor;
    d[k] = [ratio(el.querySelector("b"), bg), ratio(el.querySelector("span"), bg)].map((x) => +x.toFixed(1));
    c[k] = el.matches(":hover") && d[k].every((x) => x >= 4.5);
  }
  await window.__mouse(1, 1);
  home();
  return { ...all(c), d };`),

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
  // straight to the room screen: the class is chosen there, in a room
  id("btnCoop").click();
  await frames();
  c.room = G.state === "coop" && id("scr-coop").classList.contains("show");
  c.noClassScreen = !id("scr-class").classList.contains("show") && DF.classFor() !== "online";
  c.heading = $("#scr-coop h1").textContent.trim() === "Play online";
  c.line = $("#scr-coop .sub").textContent.replace(/\\s+/g, " ").includes("You each choose a class in the room.");
  const me = $("#coopSlots .slot.me");
  c.slot = !!me && me.dataset.cls === DF.OPT.cls;
  c.noCards = !shown(id("coopCls"));
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

  step("enter and space, from the main menu to the hall", `
  const c = {};
  const idle = () => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); };
  home(); idle();
  key("Enter");
  c.opens = G.state === "class" && DF.classFor() === "solo";
  // and again on the class screen: the way forward
  idle();
  key("Enter");
  await frames();
  c.plays = G.state === "play" && G.zone === "hub";
  home(); idle();
  key("Space");
  c.space = G.state === "class" && DF.classFor() === "solo";
  idle();
  key("Space");
  await frames();
  c.spacePlays = G.state === "play";
  // the class screen has no online way forward any more
  home(); idle();
  DF.openMenu("class", "online");
  c.noOnline = DF.classFor() === null && !shown(id("btnPlay"));
  key("Enter");
  c.enterNothing = G.state === "class";
  home();
  // opened from pause there is no way forward, and Enter does nothing
  DF.show("pause"); DF.openMenu("class"); idle();
  key("Enter");
  c.fromPause = G.state === "class";
  home();
  return all(c);`),

  step("a co-op line does not outlive a solo start", `
  const c = {};
  home();
  DF.coopSay("The host has left.");
  c.said = shown(id("coopMsg"));
  // other menus leave it be
  $('#scr-title [data-open="howto"]').click();
  $("#scr-howto [data-back]").click();
  c.kept = shown(id("coopMsg")) && G.state === "title";
  id("btnSolo").click();
  id("btnPlay").click();
  await frames();
  DF.show("pause");
  id("btnExit") && id("btnExit").click();
  await frames();
  c.menu = G.state === "title";
  c.gone = !shown(id("coopMsg")) && id("coopMsg").textContent === "";
  return all(c);`),

  step("Play online says at once when this page cannot play co-op", `
  const c = {}, d = {};
  const says = (loc) => { home(); DF.coopSay(""); DF.coopLoc(loc); id("btnCoop").click(); const el = id("coopMsg"); return { state: G.state, msg: shown(el) ? el.textContent : "" }; };
  try {
    d.file = says(null);
    c.file = d.file.state === "title" && /^Co-op does not run from a file\\./.test(d.file.msg);
    d.copy = says({ protocol: "https:", hostname: "example.com" });
    c.copy = d.copy.state === "title" && /^This copy of the game cannot play co-op\\./.test(d.copy.msg);
    c.above = id("coopMsg").nextElementSibling === $("#scr-title .row");
    // Play solo is not held back, and a page that may play goes on
    id("btnSolo").click();
    c.solo = G.state === "class";
    d.ok = says({ protocol: "https:", hostname: "maxjlerman.github.io" });
    c.ok = d.ok.state === "coop" && d.ok.msg === "";
  } finally {
    DF.coopLoc({ protocol: "http:", hostname: "localhost" });
    home(); DF.coopSay("");
  }
  return { ...all(c), d };`),

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
  { name: "back to the main menu", eval: `DF.show("title"); DF.coopLoc(null)` },
];
