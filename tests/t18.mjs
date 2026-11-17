// Plaques, unlock codes and binds.
// Run with: SCRIPT=$PWD/tests/t18.mjs node test.mjs hub
// Every step returns an object with a boolean `pass`.
// The real codes live only in tests/codes.local.json, which git ignores. The
// steps that enter a code swap in a test code with DF.setPlaqueCode instead.
import fs from "node:fs";
const local = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL("./codes.local.json", import.meta.url)));
  } catch {
    return null;
  }
})();
const step = (name, body) => ({
  name,
  eval: `(async () => { const { G, cam } = DF; G.manual = true; const K = (a) => { DF.taps[DF.BIND[a]] = true; }; ${body} })()`,
});
// stand facing the first plaque, close enough to inspect it
// (in play: removing a fake pad in an earlier step pauses the game)
const stand = `DF.show("play"); const p = G.player, q = G.world.plaques[0], f = DF.plaqueFront(q, 1.6);
  p.x = f.x; p.z = f.z; p.yaw = cam.yaw = q.yaw + Math.PI; p.state = "free"; DF.sim(0.05);`;
export default [
  step("default binds", `
  const c = { key: DF.DEFAULT_BINDS.interact === "KeyG", dodge: DF.DEFAULT_BINDS.dodge === "Space",
    pad: DF.DEFAULT_PAD.interact === "P:0", padDodge: DF.DEFAULT_PAD.dodge === "P:1" };
  return { pass: Object.values(c).every(Boolean), c };`),
  step("old saves take the new dodge and interact keys", `
  const save = (b) => localStorage.setItem("dungeon-raze.v2", JSON.stringify({ b, p: {}, o: {} }));
  const load = (b) => { Object.assign(DF.BIND, DF.DEFAULT_BINDS); save(Object.assign({}, DF.DEFAULT_BINDS, b)); DF.loadOpt(); return { ...DF.BIND }; };
  // from before plaques: dodge on Space, no interact
  const a = load({ dodge: "Space", interact: undefined }), oldest = a.dodge === "Space" && a.interact === "KeyG";
  // from the plaques release: dodge on B, interact on Space
  const b = load({ dodge: "KeyB", interact: "Space" }), moved = b.dodge === "Space" && b.interact === "KeyG";
  // unless the player has put something else on G
  const c = load({ dodge: "KeyB", interact: "Space", heavy: "KeyG" }),
    kept = c.dodge === "KeyB" && c.interact === "Space" && c.heavy === "KeyG";
  // a dodge the player chose stays where it is
  const d = load({ dodge: "KeyC", interact: "Space" }), chosen = d.dodge === "KeyC" && d.interact === "Space";
  Object.assign(DF.BIND, DF.DEFAULT_BINDS); DF.saveOpt();
  return { pass: oldest && moved && kept && chosen, oldest, moved, kept, chosen };`),
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
  return pr().then((el) => { const t = el.textContent; return { pass: near && away && far && /Inspect/.test(t) && /\\bG\\b/.test(t), near, away, far, t }; });`),
  step("inspect opens and closes", `
  DF.enterHub(); ${stand} const cy = cam.yaw; K("interact"); DF.sim(0.6);
  const open = p.state === "inspect" && G.insp && G.insp.k === 1;
  DF.mouse.dx = 300; DF.keys[DF.BIND.fwd] = true; DF.sim(0.3); DF.keys[DF.BIND.fwd] = false;
  const still = Math.hypot(p.x - f.x, p.z - f.z) < 0.01 && Math.abs(cam.yaw - cy) < 1e-6;
  K("interact"); DF.sim(0.6); const shut = p.state === "free" && G.insp === null;
  p.x = 0; p.z = -10; DF.sim(0.05); K("interact"); DF.sim(0.2); const nothing = p.state === "free";
  return { pass: open && still && shut && nothing, open, still, shut, nothing };`),
  step("inspect only from free", `
  DF.enterHub(); ${stand} K("light"); DF.sim(0.05); K("interact"); DF.sim(0.3);
  const busy = p.state !== "inspect"; DF.sim(1); const unbuffered = p.state !== "inspect";
  return { pass: busy && unbuffered, state: p.state };`),
  step("leaving play closes it", `
  const out = {};
  for (const how of ["pause", "base", "dead"]) {
    DF.enterHub(); ${stand} K("interact"); DF.sim(0.6);
    if (how === "pause") { DF.show("pause"); DF.show("play"); }
    if (how === "base") DF.toBase();
    if (how === "dead") DF.hurtPlayer(9999, null, { px: p.x, pz: p.z - 1 });
    out[how] = G.insp === null && G.player.state !== "inspect";
  }
  DF.respawn(); DF.show("play");
  return { pass: Object.values(out).every(Boolean), out };`),
  step("a hit while inspecting closes it", `
  // a bomb still ticking, or anything else that hurts without killing
  DF.enterHub(); ${stand} K("interact"); DF.sim(0.6); const open = p.state === "inspect";
  DF.hurtPlayer(10, null, { px: p.x, pz: p.z - 1 }); DF.sim(0.5);
  const shut = G.insp === null && p.state !== "inspect";
  return { pass: open && shut, open, shut, insp: !!G.insp, state: p.state };`),
  step("pad A opens, right stick does not turn the camera", `
  DF.enterHub(); ${stand} const pads = [{ index: 0, connected: true, mapping: "standard", id: "fake",
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }];
  navigator.getGamepads = () => pads; DF.PAD.poll(1 / 60);
  pads[0].buttons[0] = { pressed: true, value: 1 }; DF.sim(0.05, () => DF.PAD.poll(1 / 60));
  pads[0].buttons[0] = { pressed: false, value: 0 }; DF.sim(0.6, () => DF.PAD.poll(1 / 60));
  const open = p.state === "inspect", cy = cam.yaw; pads[0].axes[2] = 1; DF.sim(0.3, () => DF.PAD.poll(1 / 60));
  pads[0].axes[2] = 0; const still = Math.abs(cam.yaw - cy) < 1e-6; DF.closePlaque(true); navigator.getGamepads = () => [];
  DF.PAD.poll(1 / 60); return { pass: open && still, open, still };`),
  step("keyboard code unlocks", `
  DF.UNLOCKED.clear(); DF.saveOpt(); DF.setPlaqueCode("enforcer", "fwd fwd back back left right dodge heal tool dodge"); DF.enterHub(); ${stand}
  const B = DF.BIND, key = { U: B.fwd, D: B.back, L: B.left, R: B.right, B: B.dodge, X: B.heal, Y: B.tool };
  K("interact"); DF.sim(0.6); const send = (s) => { for (const ch of s) { DF.taps[key[ch]] = true; DF.sim(0.05); } };
  send("UUDDLRBXYX"); const wrong = !DF.UNLOCKED.has("enforcer");
  send("UUDDLRBXYB"); const right = DF.UNLOCKED.has("enforcer") && G.msgs.some((m) => /ENFORCER UNLOCKED/.test(m.text));
  DF.closePlaque(true); DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes(); return { pass: wrong && right, wrong, right };`),
  step("pad code unlocks", `
  DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "left right left right tool tool heal dodge"); DF.enterHub(); ${stand}
  const pads = [{ index: 0, connected: true, mapping: "standard", id: "fake",
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }];
  navigator.getGamepads = () => pads; const btn = { U: 12, D: 13, L: 14, R: 15, B: 1, X: 2, Y: 3 };
  const press = (i) => { pads[0].buttons[i] = { pressed: true, value: 1 }; DF.sim(0.05, () => DF.PAD.poll(1 / 60));
    pads[0].buttons[i] = { pressed: false, value: 0 }; DF.sim(0.05, () => DF.PAD.poll(1 / 60)); };
  press(0); DF.sim(0.6, () => DF.PAD.poll(1 / 60)); for (const ch of "LRLRYYXB") press(btn[ch]);
  const ok = DF.UNLOCKED.has("enforcer"); DF.closePlaque(true); navigator.getGamepads = () => []; DF.PAD.poll(1 / 60);
  DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes(); return { pass: ok };`),
  step("a D-pad bound to an action still enters its direction", `
  DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "fwd fwd back back"); DF.enterHub(); ${stand}
  DF.setPadBind("tool", "P:12"); DF.setPadBind("heal", "P:13"); const pads = [{ index: 0, connected: true, mapping: "standard", id: "fake",
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }];
  navigator.getGamepads = () => pads;
  const press = (i) => { pads[0].buttons[i] = { pressed: true, value: 1 }; DF.sim(0.05, () => DF.PAD.poll(1 / 60));
    pads[0].buttons[i] = { pressed: false, value: 0 }; DF.sim(0.05, () => DF.PAD.poll(1 / 60)); };
  const done = () => { DF.closePlaque(true); navigator.getGamepads = () => []; DF.PAD.poll(1 / 60);
    Object.assign(DF.PAD_BIND, DF.DEFAULT_PAD); Object.assign(DF.BIND, DF.DEFAULT_BINDS); DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes(); };
  press(0); DF.sim(0.6, () => DF.PAD.poll(1 / 60)); for (const i of [12, 12, 13, 13]) press(i);
  const ok = DF.UNLOCKED.has("enforcer"), syms = G.insp ? G.insp.syms.join("") : "-"; done();
  return { pass: ok, syms };`),
  step("Interact on a D-pad button still closes", `
  DF.enterHub(); ${stand} DF.setPadBind("interact", "P:13"); const pads = [{ index: 0, connected: true, mapping: "standard", id: "fake",
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }];
  navigator.getGamepads = () => pads;
  const press = (i) => { pads[0].buttons[i] = { pressed: true, value: 1 }; DF.sim(0.05, () => DF.PAD.poll(1 / 60));
    pads[0].buttons[i] = { pressed: false, value: 0 }; DF.sim(0.05, () => DF.PAD.poll(1 / 60)); };
  const done = () => { DF.closePlaque(true); navigator.getGamepads = () => []; DF.PAD.poll(1 / 60);
    Object.assign(DF.PAD_BIND, DF.DEFAULT_PAD); Object.assign(DF.BIND, DF.DEFAULT_BINDS); DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes(); };
  press(13); DF.sim(0.6, () => DF.PAD.poll(1 / 60)); const open = p.state === "inspect";
  press(13); DF.sim(0.6, () => DF.PAD.poll(1 / 60)); const shut = G.insp === null && p.state === "free"; done();
  return { pass: open && shut, open, shut };`),
  step("Interact sharing a movement key names pause to close", `
  DF.enterHub(); ${stand} DF.BIND.interact = "KeyW"; DF.taps.KeyW = true; DF.sim(0.6);
  const open = p.state === "inspect";
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
    const txt = document.getElementById("plaqueClose").textContent; DF.closePlaque(true);
    Object.assign(DF.BIND, DF.DEFAULT_BINDS); DF.saveOpt();
    r({ pass: open && /Esc|P/.test(txt) && !/W/.test(txt), open, txt }); })));`),
  step("a running player walks into the close-up", `
  DF.enterHub(); ${stand} p.sprint = true; K("interact"); DF.sim(0.6);
  const ok = p.state === "inspect" && !p.sprint; DF.closePlaque(true);
  return { pass: ok, sprint: p.sprint };`),
  step("left stick enters directions once per push", `
  DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "fwd back left right fwd back left right"); DF.enterHub(); ${stand}
  const pads = [{ index: 0, connected: true, mapping: "standard", id: "fake",
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }];
  navigator.getGamepads = () => pads; DF.taps[DF.BIND.interact] = true; DF.sim(0.6, () => DF.PAD.poll(1 / 60));
  const ax = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  for (const ch of "UDLRUDLR") { pads[0].axes[0] = ax[ch][0]; pads[0].axes[1] = ax[ch][1]; DF.sim(0.2, () => DF.PAD.poll(1 / 60));
    pads[0].axes[0] = pads[0].axes[1] = 0; DF.sim(0.1, () => DF.PAD.poll(1 / 60)); }
  const ok = DF.UNLOCKED.has("enforcer"); DF.closePlaque(true); navigator.getGamepads = () => []; DF.PAD.poll(1 / 60);
  DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes(); return { pass: ok };`),
  step("held keys, sealed and already open plaques take nothing", `
  DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "fwd fwd fwd fwd fwd fwd fwd fwd"); DF.enterHub(); ${stand}
  DF.keys[DF.BIND.fwd] = true; K("interact"); DF.sim(1); DF.keys[DF.BIND.fwd] = false;
  const held = G.insp.syms.length === 0 && !DF.UNLOCKED.has("enforcer"); DF.closePlaque(true);
  DF.unlockClass("enforcer"); G.msgs.length = 0; let writes = 0; const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (...a) { writes++; return real.apply(this, a); };
  K("interact"); DF.sim(0.6); for (let i = 0; i < 8; i++) { DF.taps[DF.BIND.fwd] = true; DF.sim(0.05); }
  const opened = G.msgs.filter((m) => /UNLOCKED/.test(m.text)).length === 0 && writes === 0; DF.closePlaque(true);
  const r = G.world.plaques[1], g = DF.plaqueFront(r, 1.6); p.x = g.x; p.z = g.z; DF.sim(0.05);
  K("interact"); DF.sim(0.6); for (let i = 0; i < 8; i++) { DF.taps[DF.BIND.fwd] = true; DF.sim(0.05); }
  const sealed = p.state === "inspect" && G.insp.q.id === "sapper" && writes === 0;
  Storage.prototype.setItem = real; DF.closePlaque(true); DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes();
  return { pass: held && opened && sealed, held, opened, sealed };`),
  step("shared key enters the symbol", `
  DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "dodge dodge dodge dodge dodge dodge dodge dodge"); DF.BIND.dodge = "Space"; DF.BIND.interact = "Space"; DF.enterHub(); ${stand}
  K("interact"); DF.sim(0.6); for (let i = 0; i < 8; i++) { DF.taps.Space = true; DF.sim(0.05); }
  const ok = DF.UNLOCKED.has("enforcer") && p.state === "inspect"; DF.closePlaque(true);
  Object.assign(DF.BIND, DF.DEFAULT_BINDS); DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes(); return { pass: ok };`),
  step("a code reads in each input's own notation", `
  const s = ["right", "heal", "fwd", "back", "left", "dodge", "tool"], t = (m) => DF.codeText(s, m).join(" ");
  const got = { kb: t("kb"), touch: t("touch"), xbox: t("xbox"), ps: t("ps") };
  const want = { kb: "D E W S A Space R", touch: "→ FLASK ↑ ↓ ← DODGE TOOL", xbox: "→ X ↑ ↓ ← B Y", ps: "→ □ ↑ ↓ ← ○ △" };
  DF.BIND.dodge = "KeyC"; DF.PAD_BIND.heal = "P:0";
  const rebound = DF.codeText(["dodge"], "kb")[0] === "C" && DF.codeText(["heal"], "xbox")[0] === "A";
  Object.assign(DF.BIND, DF.DEFAULT_BINDS); Object.assign(DF.PAD_BIND, DF.DEFAULT_PAD);
  const same = Object.keys(want).every((k) => got[k] === want[k]);
  return { pass: same && rebound, got, rebound };`),
  step("the plaque marks show presses in the input in use", `
  DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "tool tool tool tool"); DF.enterHub(); ${stand}
  K("interact"); DF.sim(0.6); K("right"); DF.sim(0.05); K("heal"); DF.sim(0.05);
  const marks = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() =>
    r([...document.querySelectorAll("#plaqueMarks .on")].map((e) => e.textContent).join(" ")))));
  const kb = await marks(); DF.PAD.active = true; DF.PAD.fam = "ps"; const ps = await marks();
  DF.PAD.fam = "xbox"; const xb = await marks(); DF.PAD.active = false;
  DF.closePlaque(true); DF.resetPlaqueCodes();
  return { pass: kb === "D E" && ps === "→ □" && xb === "→ X", kb, ps, xb };`),
  step("the real code", local && local.enforcer ? `
  DF.UNLOCKED.clear(); DF.enterHub(); ${stand}
  K("interact"); DF.sim(0.6); for (const a of ${JSON.stringify(local && local.enforcer)}.split(" ")) { K(a); DF.sim(0.05); }
  const ok = DF.UNLOCKED.has("enforcer"); DF.closePlaque(true); DF.UNLOCKED.clear(); DF.saveOpt(); return { pass: ok };`
    : `return { pass: true, skipped: "no tests/codes.local.json" };`),
];
