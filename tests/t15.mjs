// Screenshots of the touch controls on each device, with real touches held.
// Run on every device with: node tests/touch-all.mjs tests/t15.mjs
// or on one: DEVICE=pixel-9 SCRIPT=$PWD/tests/t15.mjs node test.mjs smoke
// Shots go to shots/<device>-touch-hall.png and shots/<device>-touch-fight.png.
// Every step returns an object with a boolean `pass`.
const step = (name, body, shot) => ({
  name,
  shot,
  eval: `(async () => { const { G, cam, TOUCH } = DF; G.manual = true;
  const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const L = () => TOUCH.layout;
  const btn = (act) => L().btns.find((b) => b.act === act);
  const probs = () => DF.layoutProblems(L());
  ${body} })()`,
});

export default [
  // in the hall, a finger holds the stick pushed up
  step("hall with the stick pushed up", `
    DF.enterHub(); DF.show("play"); TOUCH.release(); await draw();
    const r = L().rest, R = L().R;
    await __touch("touchStart", [{ id: 1, x: r.x, y: r.y }]);
    await __touch("touchMove", [{ id: 1, x: r.x, y: r.y - R * 0.6 }]);
    await draw();
    DF.sim(0.4); await draw();
    const c = { zone: G.zone === "hub", moving: TOUCH.move.mag > 0.3, layout: probs().length === 0 };
    return { pass: Object.values(c).every((v) => v === true), ...c, probs: probs() };`, "touch-hall"),
  { name: "lift the stick", eval: `(async () => { await __touch("touchEnd", [{ id: 1, x: 0, y: 0 }]); DF.TOUCH.release(); return { pass: DF.TOUCH.owners.size === 0 }; })()` },
  // in the cave, a husk four metres ahead, Attack held, boss bar forced on
  step("fight with Attack held", `
    DF.newRun(99); DF.show("play"); TOUCH.release();
    const p = G.player, n = G.world.nodes.find((q) => q.kind === "room");
    const e = G.enemies.find((q) => q.type === "husk");
    for (const o of G.enemies) if (o !== e) o.x += 1000;
    e.x = n.x; e.z = n.z + 2; e.aware = true; e.state = "idle"; e.hp = e.def.hp;
    p.x = n.x; p.z = n.z - 2; p.yaw = 0; p.lock = null;
    cam.yaw = 0; cam.pitch = Math.atan2(1.62 - e.def.top * 0.55, 4); cam.px = p.x; cam.pz = p.z; cam.cd = 5.6;
    await draw();
    // the boss bar is forced on; the HUD would clear its class, so use the style
    const boss = document.getElementById("boss");
    boss.style.display = "flex";
    document.getElementById("bossNm").textContent = "The Ossuary Warden";
    document.getElementById("bossNm").className = "tag t2";
    document.getElementById("bhF").style.width = "80%";
    document.getElementById("bpF").style.width = "35%";
    const a = btn("light");
    await __touch("touchStart", [{ id: 1, x: a.x, y: a.y }]);
    DF.sim(0.12); await draw();
    const c = { attack: DF.keys["T:light"] === true, state: G.player.state === "attack", layout: probs().length === 0 };
    return { pass: Object.values(c).every((v) => v === true), ...c, probs: probs() };`, "touch-fight"),
  { name: "lift Attack", eval: `(async () => { await __touch("touchEnd", [{ id: 1, x: 0, y: 0 }]); DF.TOUCH.release(); document.getElementById("boss").style.display = ""; return { pass: DF.TOUCH.owners.size === 0 }; })()` },
];
