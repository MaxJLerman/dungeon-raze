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
// Refreshes the labels that show the menu's state.
function devRender() {
  const u = $("devUnlock");
  if (u) {
    const all = CLASS_IDS.every(classOpen);
    u.textContent = all ? "Hidden classes unlocked" : "Unlock hidden classes";
    u.disabled = all;
  }
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
    '<div class="row"><button type="button" id="devUnlock"></button></div>' +
    '<div class="row"><button type="button" data-back="1">Back</button></div>';
  $("scr-title").after(scr);
  scr
    .querySelector("[data-back]")
    .addEventListener("click", () => show(menuBack));
  const open = (id) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.textContent = "Dev";
    b.addEventListener("click", () => openMenu("dev"));
    return b;
  };
  $("scr-title").querySelector(".row").append(open("btnDev"));
  $("btnBase").before(open("btnDevPause"));
  $("devUnlock").addEventListener("click", devUnlockAll);
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
  DEV = { god: false, unlocked: new Set(), tick() {} };
  Object.assign(DF, { DEV, devUnlockAll });
  devBuild();
}
DF.devHost = devHost;
