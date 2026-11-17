// Plaques, unlock codes and binds.
// Run with: SCRIPT=$PWD/tests/t18.mjs node test.mjs hub
// Every step returns an object with a boolean `pass`.
const step = (name, body) => ({
  name,
  eval: `(() => { const { G, cam } = DF; G.manual = true; const K = (a) => { DF.taps[DF.BIND[a]] = true; }; ${body} })()`,
});
export default [
  step("default binds", `
  const c = { key: DF.DEFAULT_BINDS.interact === "Space", dodge: DF.DEFAULT_BINDS.dodge === "KeyB",
    pad: DF.DEFAULT_PAD.interact === "P:0", padDodge: DF.DEFAULT_PAD.dodge === "P:1" };
  return { pass: Object.values(c).every(Boolean), c };`),
  step("old save moves dodge off Space", `
  const save = (b) => localStorage.setItem("dungeon-raze.v2", JSON.stringify({ b, p: {}, o: {} }));
  Object.assign(DF.BIND, DF.DEFAULT_BINDS);
  save(Object.assign({}, DF.DEFAULT_BINDS, { dodge: "Space", interact: undefined }));
  DF.loadOpt(); const moved = DF.BIND.dodge === "KeyB" && DF.BIND.interact === "Space";
  Object.assign(DF.BIND, DF.DEFAULT_BINDS);
  save(Object.assign({}, DF.DEFAULT_BINDS, { dodge: "Space", heavy: "KeyB", interact: undefined }));
  DF.loadOpt(); const kept = DF.BIND.dodge === "Space" && DF.BIND.heavy === "KeyB";
  Object.assign(DF.BIND, DF.DEFAULT_BINDS); DF.saveOpt();
  return { pass: moved && kept, moved, kept };`),
  step("hidden until unlocked", `
  DF.UNLOCKED.clear(); DF.saveOpt(); DF.renderPicker();
  const cards = () => [...document.querySelectorAll(".picker .card")].map((b) => b.dataset.cls);
  const before = !DF.pickable().includes("enforcer") && !cards().includes("enforcer");
  const fresh = DF.unlockClass("enforcer"), again = DF.unlockClass("enforcer"); DF.renderPicker();
  const after = DF.pickable().includes("enforcer") && cards().includes("enforcer");
  DF.UNLOCKED.clear(); DF.loadOpt(); const kept = DF.UNLOCKED.has("enforcer");
  return { pass: before && fresh && !again && after && kept, before, fresh, again, after, kept };`),
  step("locked class in a save falls back", `
  DF.UNLOCKED.clear(); DF.OPT.cls = "enforcer"; DF.saveOpt(); DF.OPT.cls = "fighter"; DF.loadOpt();
  const fell = DF.OPT.cls === DF.pickable()[0];
  const real = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error("full"); };
  let ok = true; try { ok = DF.unlockClass("enforcer") && DF.classOpen("enforcer"); } catch (e) { ok = false; }
  Storage.prototype.setItem = real; DF.UNLOCKED.clear(); DF.saveOpt();
  return { pass: fell && ok, fell, ok };`),
  step("plaques on the left wall", `
  DF.enterHub(); const w = G.world, P = w.plaques;
  const c = { three: P.length === 3, ids: P.map((q) => q.id).join() === "enforcer,sapper,riftwalker",
    wall: P.every((q) => q.x > 14 && Math.abs(q.yaw + Math.PI / 2) < 1e-6),
    reach: P.every((q) => w.fieldAt(DF.plaqueFront(q, 1.6).x, DF.plaqueFront(q, 1.6).z) >= 0.8),
    clear: P.every((q) => w.portals.every((g) => Math.hypot(g.x - q.x, g.z - q.z) > 4)),
    cave: (DF.newRun(7), Array.isArray(G.world.plaques) && G.world.plaques.length === 0) };
  DF.enterHub(); return { pass: Object.values(c).every(Boolean), c };`),
  step("inspect prompt", `
  DF.enterHub(); const p = G.player, q = G.world.plaques[0], f = DF.plaqueFront(q, 1.6);
  const at = (x, z, yaw) => { p.x = x; p.z = z; p.yaw = cam.yaw = yaw; DF.sim(0.05); };
  const pr = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(document.getElementById("prompt")))));
  at(f.x, f.z, q.yaw + Math.PI); const near = DF.plaqueAt() === q;
  at(f.x, f.z, q.yaw); const away = DF.plaqueAt() === null;
  at(0, -10, 0); const far = DF.plaqueAt() === null;
  at(f.x, f.z, q.yaw + Math.PI);
  return pr().then((el) => { const t = el.textContent; return { pass: near && away && far && /Inspect/.test(t) && /Space/.test(t), near, away, far, t }; });`),
];
