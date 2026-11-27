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
  c.noBlurb = !shown($("#scr-title .sub"));
  // nothing shows but the title and the buttons: no line about turning a phone
  c.bare = JSON.stringify([...id("scr-title").children].filter(shown).map((el) => el.tagName + "." + el.className)) === JSON.stringify(["H1.", "DIV.row"]);
  // centred, two buttons to a row, and the dev build's fifth alone beneath
  const box = (el) => el.getBoundingClientRect(), mid = (el) => (box(el).left + box(el).right) / 2, near = (a, b) => Math.abs(a - b) <= 1;
  const [solo, online, howto, controls] = row.map(box), dev = id("btnDev");
  c.title = near(mid($("#scr-title h1")), innerWidth / 2);
  c.grid = near(solo.top, online.top) && near(howto.top, controls.top) && howto.top >= solo.bottom
    && near(solo.left, howto.left) && near(online.left, controls.left) && online.left >= solo.right
    && near(solo.width, online.width) && near(solo.width, howto.width) && near(solo.width, controls.width);
  c.gridMid = near((solo.left + online.right) / 2, innerWidth / 2);
  c.dev = !dev || (box(dev).top >= howto.bottom && near(mid(dev), innerWidth / 2) && near(box(dev).width, solo.width));
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

  // With the hidden classes open there are eight cards. On a phone on its
  // side they are one line across the whole screen that a thumb drags
  // sideways; a taller screen keeps the grid.
  step("the class line scrolls sideways on a phone", `
  const c = {}, d = {}, was = DF.OPT.cls;
  const add = Object.keys(DF.CLASSES).filter((k) => DF.CLASSES[k].hidden && !DF.UNLOCKED.has(k));
  const box = (el) => el.getBoundingClientRect();
  const line = () => $("#scr-class .cards"), cards = () => [...line().children];
  const seen = (el) => box(el).left >= -0.5 && box(el).right <= innerWidth + 0.5;
  for (const k of add) DF.UNLOCKED.add(k);
  try {
    home();
    id("btnSolo").click();
    await frames();
    d.size = innerWidth + "x" + innerHeight; d.cards = cards().length;
    c.eight = d.cards === Object.keys(DF.CLASSES).length && d.cards > 5;
    if (innerHeight > 420) {
      // the grid: every card on the screen with nothing to scroll
      c.grid = line().scrollWidth <= line().clientWidth + 1 && cards().every(seen);
      return { ...all(c), d };
    }
    const top = box(cards()[0]).top;
    c.oneLine = cards().every((b) => Math.abs(box(b).top - top) <= 1);
    c.edgeToEdge = box(line()).left <= 0.5 && box(line()).right >= innerWidth - 0.5;
    c.underTitle = Math.abs(box(cards()[0]).left - box($("#scr-class h1")).left) <= 1;
    c.more = line().scrollWidth > line().clientWidth + 1 && !seen(cards().at(-1));
    // a real thumb drags the line
    if (window.__touch) {
      const y = top + box(cards()[0]).height / 2, x0 = innerWidth * 0.75, x1 = innerWidth * 0.2;
      await window.__touch("touchStart", [{ id: 1, x: x0, y }]);
      for (let i = 1; i <= 8; i++) { await window.__touch("touchMove", [{ id: 1, x: x0 + (x1 - x0) * i / 8, y }]); await frames(); }
      await window.__touch("touchEnd", [{ id: 1, x: x1, y }]);
      await frames();
      d.dragged = Math.round(line().scrollLeft);
      c.drag = d.dragged > 100 && G.state === "class" && DF.OPT.cls === was;
    }
    // the far end: the last card whole, and picking it keeps it there
    line().scrollLeft = line().scrollWidth;
    await frames();
    const last = cards().at(-1), to = last.dataset.cls;
    c.end = seen(last) && to !== was;
    last.click();
    await frames();
    const on = $("#scr-class .card.on");
    d.after = Math.round(line().scrollLeft);
    c.kept = !!on && on.dataset.cls === to && seen(on) && d.after > 0;
    // and it is in sight when the screen opens again
    home();
    id("btnSolo").click();
    await frames();
    c.reopen = seen($("#scr-class .card.on")) && $("#scr-class .card.on").dataset.cls === to;
    // back to the first card
    cards()[0].click();
    await frames();
    c.first = seen($("#scr-class .card.on")) && line().scrollLeft === 0;
  } finally {
    for (const k of add) DF.UNLOCKED.delete(k);
    DF.setClass(was);
    DF.renderPicker();
    home();
  }
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
  // every class, hidden ones too: the line of cards. Nothing is saved.
  { name: "shot: the class screen with every class", eval: `(() => {
    const add = Object.keys(DF.CLASSES).filter((k) => DF.CLASSES[k].hidden && !DF.UNLOCKED.has(k));
    for (const k of add) DF.UNLOCKED.add(k);
    DF.renderPicker();
    window.__t30add = add;
  })()`, wait: 400, shot: "t30-class-all" },
  { name: "back to the main menu", eval: `for (const k of window.__t30add) DF.UNLOCKED.delete(k); DF.renderPicker(); DF.show("title"); DF.coopLoc(null)` },
];
