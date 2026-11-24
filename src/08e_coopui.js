// ---------- co-op on screen ----------
// What a co-op run adds to the HUD and the menus: the other player's health
// as a thin bar under this player's vitals (#mateBar), "Waiting for the host"
// over the game while snapshots have stopped (#coopWait), the pause screen's
// note that the dungeon runs on (#pauseCoop), and a line on the title screen
// (#coopMsg). All but the last are hidden whenever NET is null.

// Writes the title screen's co-op line; an empty text clears and hides it.
function coopSay(text) {
  const el = $("coopMsg");
  el.textContent = text || "";
  el.hidden = !text;
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
}
