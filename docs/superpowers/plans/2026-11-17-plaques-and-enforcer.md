# Plaques, Unlock Codes and the Enforcer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three inspectable plaques in the hall, a code that unlocks a hidden class, and that class, the Enforcer, fully playable.

**Architecture:** Everything is plain code in the concatenated `src/*.js` scope. The Enforcer is a new `CLASSES` entry with new `MOVES`, a `useTool` branch (sticky bomb, tracked in `G.bombs`) and a `useSpecial` branch (grapple, player state `grapple`). Plaques are a list in `03b_hub.js` that `genHub` builds meshes from. Inspecting is a player state, `inspect`, that holds `G.insp`, steers the camera in `camUpdate` and drives an HTML card from the HUD. Codes are hashed and matched against a rolling buffer of symbols.

**Tech Stack:** Vanilla JS, own WebGL renderer, headless Chromium tests through `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-17-plaques-and-enforcer-design.md`. Read it and `CLAUDE.md` before starting any task.

## Global Constraints

- Declare every name once across all of `src/`. Check with `grep -n "name" src/*.js` before adding one.
- `node build.mjs` after every source change. Tests run against `dist/index.html`.
- No dependencies, no network requests, no textures. Text in the world is HTML placed with `R.toScreen`.
- A plain code never appears in a committed file, commit message, test or comment. Only its hash is committed. The plain code lives in `tests/codes.local.json`, which is gitignored.
- No skull emblem or anything else recognisable from an existing vigilante character on the Enforcer.
- Every touch control position comes from `touchLayout`; `layoutProblems` must pass on every device in `tests/devices.mjs`.
- Storage that is missing or throws changes nothing (wrap in `try`).
- `G.world` from `genWorld` and from `genHub` have the same fields: a new hall field gets an empty value in the cave.
- Commit messages carry no `Co-Authored-By` or `Claude-Session` trailers.
- Test steps return `{ pass, ... }`; anything but `pass: true` fails the run with exit code 1.

## Review Focus

1. **Pressing Interact at a plaque mid-attack, mid-dodge or while staggered.** Expected: it opens only from `free`; otherwise the press does nothing and is not buffered. Test in Task 7.
2. **Leaving play while inspecting** (pause, death, portal transition, `toBase`). Expected: the plaque closes at once, the camera is the normal camera again, the player is `free` (or `dead`), and resuming plays normally. Test in Task 7.
3. **A movement key held down when the plaque opens.** Expected: no symbol is recorded and the player does not drift; only new presses count. Test in Task 8.
4. **Entering a code at a plaque whose class is already unlocked, or at a sealed plaque.** Expected: nothing happens, no second banner, no save write. Test in Task 8.
5. **A sticky bomb that outlives its world** (bomb ticking when the player goes through a portal, returns to base or dies, or stuck to an enemy that is grappled or executed). Expected: zone swaps clear `G.bombs`; a bomb on a moved or dead enemy follows it or drops where it died and explodes once. Test in Task 3.

---

## File map

| File | Change |
| --- | --- |
| `src/06_game.js` | Bindings, `CLASSES.enforcer`, Enforcer `MOVES`, sticky bomb and grapple, `UNLOCKED`, code hashing and matching, `inspect` state, `PLAQUE_CODES` |
| `src/03b_hub.js` | `hubPlaques()`, `plaqueFront()`, plaque meshes, glow, `plaques` field |
| `src/03_world.js` | `plaques: []` in the cave world |
| `src/05_figures.js` | Enforcer branch of `makePlayerFig` |
| `src/07_render.js` | Enforcer poses, `bullet` and `sticky` projectiles, bombs, grapple line |
| `src/04_audio.js` | `SFX.gun`, `SFX.shotgun`, `SFX.beep`, `SFX.hook`, `SFX.unlock` |
| `src/08_hud.js` | Inspect prompt, plaque card |
| `src/08b_touchlayout.js` | `prompt`, `close` and `dpad` entries |
| `src/08c_touch.js` | Fingers on prompt, close and D-pad |
| `src/08d_pad.js` | No camera turn while inspecting |
| `src/09_main.js` | Camera in `inspect`, picker filter, `DF` exports, close on leaving play |
| `index.tpl.html` | `#plaque` card markup and styles |
| `tests/t18.mjs` | New: bindings, unlocks, plaques, inspect, codes (desktop, `hub` mode) |
| `tests/t19.mjs` | New: plaques by touch (device runs, `hub` mode) |
| `tests/t6.mjs`, `tests/t16.mjs` | Enforcer cases; new defaults |
| `.gitignore` | `tests/codes.local.json` |
| `README.md`, `CLAUDE.md` | Controls and notes |

All new test steps use the helper from `tests/t8.mjs`:

```js
const step = (name, body) => ({
  name,
  eval: `(() => { const { G, cam } = DF; G.manual = true; const K = (a) => { DF.taps[DF.BIND[a]] = true; }; ${body} })()`,
});
```

---

### Task 1: Interact action and dodge on B

**Files:**
- Modify: `src/06_game.js` (`DEFAULT_BINDS` line 72, `ACTIONS` line 88, `DEFAULT_PAD` line 107, `loadOpt` line 205)
- Modify: `tests/t6.mjs` ("rebind" step restores to `'KeyB'`), `tests/t16.mjs` (expected default pad JSON at line 43 gains `interact: "P:0"`)
- Create: `tests/t18.mjs`
- Modify: `src/09_main.js` (export `DEFAULT_BINDS` is already there; add nothing)

**Interfaces:**
- Produces: action `"interact"`, readable with `hit("interact")` and `held("interact")`. `DEFAULT_BINDS.interact === "Space"`, `DEFAULT_BINDS.dodge === "KeyB"`, `DEFAULT_PAD.interact === "P:0"`. `ACTIONS` entry `["interact", "Interact"]`.

- [ ] **Step 1: Write the failing tests** in a new `tests/t18.mjs` (header comment: `// Plaques, unlock codes and binds. Run with: SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`)

```js
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
```

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`
Expected: both steps FAIL, exit code 1.

- [ ] **Step 3: Implement.** Add the three defaults and the `ACTIONS` entry (after `dodge`). In `loadOpt`, after copying `d.b`: if the saved `d.b.dodge === "Space"` and no saved action's value is `"KeyB"`, set `BIND.dodge = "KeyB"`. Interact keeps its default when the save has none, even if it then shares Space with dodge (the spec's priority rule handles that).

- [ ] **Step 4: Update `t6` "rebind" (restore `'KeyB'`) and `t16`'s expected default pad JSON.**

- [ ] **Step 5: Run to verify they pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: every step passes, exit code 0. If a `t16` step that rebinds `P:0` now swaps with `interact`, update its expectation to match the swap rule, not the code.

- [ ] **Step 6: Commit**

```bash
git add src/06_game.js tests/t18.mjs tests/t6.mjs tests/t16.mjs
git commit -m "feat: interact action on Space and A, dodge moves to B"
```

---

### Task 2: The Enforcer's guns, execution and figure

**Files:**
- Modify: `src/06_game.js` (`CLASSES`, `MOVES`, where a move's `proj` is fired near line 2330, `execute` case near line 2479)
- Modify: `src/05_figures.js` (`makePlayerFig`), `src/07_render.js` (`posePlayer`, projectile drawing near line 692), `src/04_audio.js`
- Test: `tests/t6.mjs`

**Interfaces:**
- Produces: `CLASSES.enforcer` with `hidden: true`, `ranged: true`, `chain: "e1"`, `heavy: "eshot"`, `dash: "eslide"`, `tool: { id: "sticky", name: "Sticky bomb", max: 3, ch: "◆" }`, `special: { id: "grapple", name: "Grapple", cost: 35 }`, `col: CRIMSON` (new const `[1, 0.28, 0.32]`). Projectile kinds `"bullet"` and `"pellet"`. `proj.pellets` (count) and `proj.spread` (radians between pellets) on a move.
- `hidden` has no effect until Task 5.

Starting numbers (the spec leaves them to the builder; aim between Ranger and Fighter):

| Field | Value |
| --- | --- |
| hp, stam, walk, run | 100, 105, 5.5, 8.4 |
| ambush, back, parry, blockMul, chip, guardArc | 1.5, 1, 0.2, 1.15, 0.15, 1.9 |
| dodge | `{ dist: 5.0, dur: 0.4, ifr: 0.3, cost: 20 }` |
| `e1`, `e2` | anim `"pistol"`, wind 0.08, act 0.04, rec 0.18, stam 6, proj `{ speed: 60, dmg: 9, post: 6, kind: "bullet" }` |
| `e3` | anim `"pistol"`, wind 0.14, rec 0.3, stam 9, proj dmg 16, post 14, heavy |
| `eshot` | anim `"shotgun"`, wind 0.3, act 0.06, rec 0.45, stam 20, heavy, proj `{ speed: 40, dmg: 7, post: 7, kind: "pellet", life: 0.25, pellets: 7, spread: 0.09 }` |
| `eslide` | anim `"slide"`, lunge 4, proj `{ speed: 60, dmg: 14, post: 10, kind: "bullet" }` |
| trait | An execution refills one sticky bomb |

Kit lines for the picker: Attack "Pistol shots, fired where the camera points"; Heavy "Shotgun: devastating up close, useless at range"; Tool "Sticky bomb: sticks to what it hits and blows after 3 seconds. Mind the blast"; Ability "Grapple: yank light enemies to you, or pull yourself to heavy ones"; Trait "Executions are a sniper shot from range and give back a sticky bomb".

- [ ] **Step 1: Write the failing tests** in `tests/t6.mjs`: add `{ name: "enforcer", eval: fight("enforcer", 8) }` to the list after ranger, and:

```js
{ name: "enforcer shotgun and execution", eval: cls("enforcer", `
  const e = tp((e) => e.type === 'brute', 3); const n0 = G.projs.length; K('heavy'); let most = 0;
  DF.sim(0.6, () => { most = Math.max(most, G.projs.filter((q) => q.kind === 'pellet').length); });
  p.state = 'free'; p.tool = 0; e.state = 'stagger'; e.t = 0; e.dur = 3; DF.startExecute(e); DF.sim(0.2);
  const back = Math.hypot(p.x - e.x, p.z - e.z); DF.sim(1);
  return { pass: most === 7 && back > e.r + 3.5 && p.tool === 1, most, back, tool: p.tool }; `) },
```

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: the two new steps FAIL (`setClass` ignores the unknown id).

- [ ] **Step 3: Implement the class entry, moves and pellets.** Where a move's `proj` is fired, a `proj.pellets` of n fires n copies at angles `p.aim + (i - (n - 1) / 2) * spread`.

- [ ] **Step 4: Implement the execution.** In `startExecute`, when `p.clsId === "enforcer"`, stand at `e.r + 4.5` instead of `e.r + 1.0`. In the `execute` case at the strike, the Enforcer's lance arc has `len` equal to the distance to the enemy (a tracer), plays `SFX.gun(true)`, and adds one sticky bomb up to `tool.max`. Damage, healing and the dummy and boss rules stay as they are.

- [ ] **Step 5: Figure, poses, projectiles, sounds.** `makePlayerFig("enforcer")`: a long dark coat, a pistol in each hand, a shotgun shown only during `eshot`, a rifle only during an execution; set `f.rim` and `f.tips`. `posePlayer`: idle arms, guard pose (forearms crossed), anims `pistol` (arm alternates per chain step), `shotgun`, `slide`. Draw `bullet` as a thin bright streak and `pellet` as a small spark. `SFX.gun(big)` and `SFX.shotgun()` are short noise bursts with a pitch drop.

- [ ] **Step 6: Run to verify they pass, and look at it**

Run: `node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: every step passes, including "bot soak all classes" (which now includes the Enforcer). Then take a screenshot of the Enforcer at the dummy in the hall (`DF.setClass("enforcer")`, `DF.enterHub()`) and check it by eye: coat, two pistols, no emblem.

- [ ] **Step 7: Commit**

```bash
git add src tests/t6.mjs
git commit -m "feat: the Enforcer, pistols, shotgun and sniper execution"
```

---

### Task 3: Sticky bomb

**Files:**
- Modify: `src/06_game.js` (`useTool`, `projUpdate`, `resetRun` line 1166, `update`), `src/07_render.js`, `src/04_audio.js`
- Test: `tests/t6.mjs`

**Interfaces:**
- Consumes: `CLASSES.enforcer.tool.id === "sticky"` (Task 2).
- Produces: `G.bombs`, an array of `{ x, y, z, e, ox, oz, t }` (`e` the enemy it sticks to or `null`; `ox`, `oz` its offset from that enemy; `t` seconds left). `bombsUpdate(dt)` called from `update` right after `projUpdate`. Constants `STICKY = { t: 3, r: 3.5, dmg: 45, post: 40, self: 0.5 }`.

- [ ] **Step 1: Write the failing tests** in `tests/t6.mjs`:

```js
{ name: "sticky bomb", eval: cls("enforcer", `
  const e = tp((e) => e.type === 'brute', 6); e.state = 'idle'; const h0 = e.hp; K('tool'); let stuck = null;
  DF.sim(1, () => { const b = G.bombs[0]; if (b && b.e) stuck = b.e; });
  e.x += 2; DF.sim(0.05); const b = G.bombs[0], follows = b && Math.hypot(b.x - e.x, b.z - e.z) < e.r + 0.6;
  DF.sim(2.5); const c = { stuck: stuck === e, follows, gone: G.bombs.length === 0, hurt: e.hp < h0 };
  return { pass: Object.values(c).every(Boolean), c }; `) },
{ name: "sticky bomb hurts its thrower at half", eval: cls("enforcer", `
  const e = tp((e) => e.type === 'brute', 6); e.state = 'idle'; p.iframe = 0;
  G.bombs.push({ x: p.x + 1, y: 1, z: p.z, e: null, ox: 0, oz: 0, t: 0.05 }); const hp0 = p.hp; DF.sim(0.2);
  return { pass: Math.abs(hp0 - p.hp - 22.5) < 0.6, lost: hp0 - p.hp }; `) },
{ name: "sticky bomb dodged and cleared", eval: cls("enforcer", `
  G.bombs.push({ x: p.x + 1, y: 1, z: p.z, e: null, ox: 0, oz: 0, t: 0.05 }); p.iframe = 1; const hp0 = p.hp; DF.sim(0.2);
  const dodged = p.hp === hp0;
  G.bombs.push({ x: p.x + 1, y: 1, z: p.z, e: null, ox: 0, oz: 0, t: 2 }); DF.enterHub();
  return { pass: dodged && G.bombs.length === 0, dodged, left: G.bombs.length }; `) },
{ name: "sticky bomb on a dying enemy", eval: cls("enforcer", `
  const e = tp((e) => e.type === 'husk', 5); G.bombs.push({ x: e.x, y: 1, z: e.z, e, ox: 0, oz: 0, t: 1 });
  DF.hitEnemy(e, 999, 0, {}); const at = [e.x, e.z]; DF.sim(0.3); const b = G.bombs[0];
  const dropped = b && b.e === null && Math.hypot(b.x - at[0], b.z - at[1]) < 1; DF.sim(1);
  return { pass: dropped && G.bombs.length === 0, dropped }; `) },
```

`DF.hitEnemy` and `DF.enterHub` are already exported.

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: the four new steps FAIL (`G.bombs` undefined).

- [ ] **Step 3: Implement.** `useTool` branch `"sticky"`: `fire({ speed: 22, dmg: 0, post: 0, kind: "sticky", life: 0.9 }, aimRanged-or-lock)`. In `projUpdate`, a `sticky` projectile that reaches an enemy, a wall or the end of its life becomes a bomb instead of dealing damage: stuck to the enemy with its offset, or left where it stopped. `bombsUpdate`: a bomb on a live enemy follows it; on a dead one, `e` becomes `null` and it stays put; at `t <= 0` it calls `explode(x, z, STICKY.r, STICKY.dmg, STICKY.post, CRIMSON)` and, if the player is within `STICKY.r + 0.5` with line of sight, `hurtPlayer(STICKY.dmg * STICKY.self, null, { px: x, pz: z })`. `resetRun` sets `G.bombs = []`. Draw a bomb as a small sprite blinking faster as `t` runs out; `SFX.beep()` on each blink.

- [ ] **Step 4: Run to verify they pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: every step passes.

- [ ] **Step 5: Commit**

```bash
git add src tests/t6.mjs
git commit -m "feat: the Enforcer's sticky bomb"
```

---

### Task 4: Grappling hook

**Files:**
- Modify: `src/06_game.js` (`useSpecial`, `playerUpdate` states, `enemyUpdate`), `src/07_render.js`, `src/04_audio.js`
- Test: `tests/t6.mjs`

**Interfaces:**
- Consumes: `CLASSES.enforcer.special.id === "grapple"` (Task 2).
- Produces: `grappleTarget()` returns the locked enemy, or else the live enemy within 14 m in line of sight nearest the `aimRanged()` direction within 0.3 rad, or `null`. `grappleLight(e)` is `!e.def.boss && !e.def.dummy && e.def.poise === 0`. Player state `"grapple"` with `p.gT` (target) moving the player. Enemy field `e.yank = { tx, tz, t }` moving the enemy. Both end with the two `e.r + 1.2` apart, and the enemy in `hit` for 0.5 s.

- [ ] **Step 1: Write the failing tests** in `tests/t6.mjs`:

```js
{ name: "grapple pulls light enemies, pulls you to heavy ones", eval: cls("enforcer", `
  const out = {};
  for (const type of ['husk', 'brute']) {
    const e = tp((e) => e.type === type, 9); e.state = 'idle'; p.state = 'free'; p.focus = 100; p.lock = e;
    const e0 = [e.x, e.z], p0 = [p.x, p.z]; K('special'); DF.sim(0.8);
    out[type] = { gap: +Math.hypot(p.x - e.x, p.z - e.z).toFixed(2), eMoved: Math.hypot(e.x - e0[0], e.z - e0[1]) > 3,
      pMoved: Math.hypot(p.x - p0[0], p.z - p0[1]) > 3, focus: p.focus | 0 };
  }
  const c = { husk: out.husk.eMoved && !out.husk.pMoved && out.husk.gap < 2.5,
    brute: out.brute.pMoved && !out.brute.eMoved && out.brute.gap < 3, cost: out.husk.focus <= 66 };
  return { pass: Object.values(c).every(Boolean), c, out }; `) },
{ name: "grapple with no target spends nothing", eval: cls("enforcer", `
  for (const e of G.enemies) e.dead = true; p.focus = 100; p.lock = null; K('special'); DF.sim(0.3);
  return { pass: p.focus >= 99 && p.state === 'free', focus: p.focus, state: p.state }; `) },
```

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: the two new steps FAIL.

- [ ] **Step 3: Implement** `grappleTarget`, `grappleLight`, the `grapple` branch in `useSpecial` (no target: `say("No target", "bad", 0.8)`, return `false` before spending focus), the `grapple` player state (moves to the target over about 0.3 s with `iframe` held, then `free`), and `e.yank` handled at the top of `enemyUpdate` for about 0.25 s with `world.resolve`. The dummy stays pinned, so the player is pulled to it. Draw the line with `R.ribbon` from the player's hand (`R.nodePos`) to the target while either is moving. `SFX.hook()`.

- [ ] **Step 4: Run to verify they pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: every step passes.

- [ ] **Step 5: Commit**

```bash
git add src tests/t6.mjs
git commit -m "feat: the Enforcer's grappling hook"
```

---

### Task 5: Saved unlocks and the hidden class in the picker

**Files:**
- Modify: `src/06_game.js` (`saveOpt`, `loadOpt`), `src/09_main.js` (`renderPicker` line 117, `DF`)
- Test: `tests/t18.mjs`

**Interfaces:**
- Produces: `UNLOCKED` (a `Set` of class ids). `unlockClass(id) -> boolean` (true when newly unlocked; saves). `classOpen(id) -> boolean` (`!CLASSES[id].hidden || UNLOCKED.has(id)`). `pickable() -> string[]` (`CLASS_IDS.filter(classOpen)`). Save field `u: [...UNLOCKED]`. All four exported on `DF`.

- [ ] **Step 1: Write the failing tests** in `tests/t18.mjs`:

```js
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
```

Export `renderPicker` on `DF` for this.

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`
Expected: the two new steps FAIL.

- [ ] **Step 3: Implement.** `loadOpt` reads `d.u` (array; ids not in `CLASSES` ignored) before it checks `d.o.cls`, and accepts `d.o.cls` only when `classOpen`; otherwise `OPT.cls = pickable()[0]`. `renderPicker` maps `pickable()` instead of `CLASS_IDS`. `setClass` is unchanged (tests set hidden classes directly).

- [ ] **Step 4: Run to verify they pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub && SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: every step passes.

- [ ] **Step 5: Commit**

```bash
git add src tests/t18.mjs
git commit -m "feat: hidden classes and saved unlocks"
```

---

### Task 6: Plaques in the hall and the Inspect prompt

**Files:**
- Modify: `src/03b_hub.js` (new `hubPlaques`, `plaqueFront`, meshes in `genHub`, return `plaques`), `src/03_world.js` (`plaques: []`), `src/06_game.js` (`PLAQUE_CODES`, `plaqueAt`), `src/08_hud.js` (prompt near line 174), `src/09_main.js` (`DF`)
- Test: `tests/t18.mjs`, `tests/t8.mjs`

**Interfaces:**
- Produces: `hubPlaques()` returns, in order, `{ id: "enforcer", cls: "enforcer", x: 14.85, z: -13, yaw: -PI / 2 }`, `{ id: "sapper", cls: null, x: 14.85, z: -5, yaw: -PI / 2 }`, `{ id: "riftwalker", cls: null, x: 14.85, z: 3, yaw: -PI / 2 }`. `cls: null` means sealed. These sit between the pillars at `z = -9, -1, 7`; adjust `z` only if a reach check fails. `plaqueFront(q, d)` is `portalFront` for a plaque. `G.world.plaques` is that list in the hall and `[]` in a cave. `PLAQUE_CODES = { enforcer: { hash, len } }`, filled in Task 8 (until then `{}`). `plaqueAt() -> plaque | null`: the hall plaque whose centre is within 2.6 m of the player and within 1.2 rad of `cam.yaw`. Plaque centre height `PLAQUE_Y = 1.7`. Exported on `DF`: `hubPlaques`, `plaqueFront`, `plaqueAt`.

- [ ] **Step 1: Write the failing tests** in `tests/t18.mjs`:

```js
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
```

If the runner does not await a returned promise, wait two frames the way `t10` does instead. Also update `t8`'s "hub world" step: `arrays` includes `"plaques"`.

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`
Expected: the two new steps FAIL.

- [ ] **Step 3: Implement.** Meshes in `genHub` with `frameOf`, `box` and the glow alpha: a slab 1.1 wide, 1.4 tall, 0.12 deep, centred at `PLAQUE_Y`, with a trim. A live plaque (`cls` set) glows in its class colour once unlocked and faintly before; a sealed one is dark. A plaque gets a point light only if `buildLights()` still has room; do not displace portal lights. The HUD prompt shows `<kbd>actKey("interact")</kbd> Inspect` (touch: `INSPECT`) whenever `plaqueAt()` is not null and the player is `free`, after the Execute prompt (Execute wins).

- [ ] **Step 4: Run to verify they pass, and look**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub && SCRIPT=$PWD/tests/t8.mjs node test.mjs hub && SCRIPT=$PWD/tests/t9.mjs node test.mjs hub`
Expected: every step passes. Open the hall shots from `t9` and one of the plaque wall, and check the plaques by eye.

- [ ] **Step 5: Commit**

```bash
git add src tests/t18.mjs tests/t8.mjs
git commit -m "feat: three plaques on the hall's left wall"
```

---

### Task 7: The close-up

**Files:**
- Modify: `src/06_game.js` (`playerUpdate`, `resetRun`, new `openPlaque`, `closePlaque`, `inspectUpdate`), `src/09_main.js` (`camUpdate` line 237, `show`), `src/08d_pad.js` (`poll`), `src/08_hud.js`, `index.tpl.html`
- Test: `tests/t18.mjs`

**Interfaces:**
- Consumes: `plaqueAt()`, `plaqueFront()`, `PLAQUE_Y` (Task 6); `classOpen()` (Task 5).
- Produces: `G.insp = { q, k, dir, syms, stick } | null`. `k` runs 0 to 1 over 0.5 s while `dir` is 1 and back while `dir` is -1; at 0 with `dir` -1, `G.insp` is `null` and the player is `free`. `openPlaque(q)`, `closePlaque(now: boolean)` (`now` skips the ease). `inspectUpdate(dt)`. Player state `"inspect"`. `#plaque` card with `.locked`, `.open` or `.sealed`, children `#plaqueTitle`, `#plaqueBody`, `#plaqueMarks`, `#plaqueClose`.

- [ ] **Step 1: Write the failing tests** in `tests/t18.mjs`. Put a shared helper at the top of the file:

```js
const stand = `const p = G.player, q = G.world.plaques[0], f = DF.plaqueFront(q, 1.6);
  p.x = f.x; p.z = f.z; p.yaw = cam.yaw = q.yaw + Math.PI; p.state = "free"; DF.sim(0.05);`;
```

```js
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
  return { pass: Object.values(out).every(Boolean), out };`),
step("pad A opens, left stick does not turn the camera", `
  DF.enterHub(); ${stand} const pads = [{ index: 0, connected: true, mapping: "standard", id: "fake",
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }];
  navigator.getGamepads = () => pads; DF.PAD.poll(1 / 60);
  pads[0].buttons[0] = { pressed: true, value: 1 }; DF.sim(0.05, () => DF.PAD.poll(1 / 60));
  pads[0].buttons[0] = { pressed: false, value: 0 }; DF.sim(0.6, () => DF.PAD.poll(1 / 60));
  const open = p.state === "inspect", cy = cam.yaw; pads[0].axes[2] = 1; DF.sim(0.3, () => DF.PAD.poll(1 / 60));
  pads[0].axes[2] = 0; const still = Math.abs(cam.yaw - cy) < 1e-6; DF.closePlaque(true); navigator.getGamepads = () => [];
  DF.PAD.poll(1 / 60); return { pass: open && still, open, still };`),
```

Export `closePlaque`, `openPlaque` on `DF`.

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`
Expected: the four new steps FAIL.

- [ ] **Step 3: Implement opening and closing.** In `playerUpdate`, after the `dead` check and before input is read: if `p.state === "inspect"`, call `inspectUpdate(dt)` and return. Before the `act` reads: if `p.state === "free"` and `plaqueAt()` is not null and `hit("interact")`, call `openPlaque` and return (this consumes Space even when dodge shares it). `inspectUpdate` advances `k`, holds the player still, and on `hit("interact")` sets `dir = -1` (Task 8 reads symbols first). `show(state)` calls `closePlaque(true)` when leaving `play`; `resetRun` sets `G.insp = null`; death closes it.

- [ ] **Step 4: Implement the view.** In `camUpdate`, skip `mouse.dx`/`dy` while `G.insp`, and after the normal eye and target are computed, blend both toward the eye `plaqueFront(q, 1.6)` at height `PLAQUE_Y` and the target `(q.x, PLAQUE_Y, q.z)` by `smoothstep(k)`. `PAD.poll` does not turn the camera while `G.insp`. The HUD places `#plaque` from `R.toScreen(q.x, PLAQUE_Y, q.z)` at `k = 0` to the screen centre at `k = 1`, scaling from 0.1 to fill about 80% of the short side, opacity following `k`. Card content per the spec's three cases; the title of a locked live plaque is its epithet (the Enforcer's: "The one who settles accounts"); `#plaqueMarks` has `len` empty marks; `#plaqueClose` reads `<kbd>actKey("interact")</kbd> Close`. Styles in `index.tpl.html`, stone-coloured, matching the menu fonts.

- [ ] **Step 5: Run to verify they pass, and look**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`
Expected: every step passes. Take screenshots at `k` of 0.5 and 1 and check by eye that the card grows out of the plaque.

- [ ] **Step 6: Commit**

```bash
git add src index.tpl.html tests/t18.mjs
git commit -m "feat: inspect a plaque in close-up"
```

---

### Task 8: Codes

**Files:**
- Modify: `src/06_game.js` (`codeHash`, `CODE_SYMS`, `readSyms`, symbol handling in `inspectUpdate`, `PLAQUE_CODES`), `src/08_hud.js` (marks, unlock flare), `src/04_audio.js` (`SFX.unlock`), `src/09_main.js` (`DF`), `.gitignore`
- Create: `tests/codes.local.json` (gitignored, not committed)
- Test: `tests/t18.mjs`

**Interfaces:**
- Consumes: `G.insp` (Task 7), `unlockClass`, `classOpen` (Task 5).
- Produces: symbols are single letters: `U D L R` and `B` (dodge), `X` (heal), `Y` (tool). `codeHash(str) -> string`: a 53-bit string hash (cyrb53) as hex. `readSyms() -> string[]`: this update's new symbols, in order. `DF.setPlaqueCode(id, syms)` replaces `PLAQUE_CODES[id]` with `{ hash: codeHash(syms), len: syms.length }`; `DF.resetPlaqueCodes()` restores the shipped ones.

- [ ] **Step 1: Write the failing tests** in `tests/t18.mjs`. At the top of the file, read the local codes in Node:

```js
import fs from "node:fs";
const local = (() => { try { return JSON.parse(fs.readFileSync(new URL("./codes.local.json", import.meta.url))); } catch { return null; } })();
```

```js
step("keyboard code unlocks", `
  DF.UNLOCKED.clear(); DF.saveOpt(); DF.setPlaqueCode("enforcer", "UUDDLRBXYB"); DF.enterHub(); ${stand}
  const B = DF.BIND, key = { U: B.fwd, D: B.back, L: B.left, R: B.right, B: B.dodge, X: B.heal, Y: B.tool };
  K("interact"); DF.sim(0.6); const send = (s) => { for (const ch of s) { DF.taps[key[ch]] = true; DF.sim(0.05); } };
  send("UUDDLRBXYX"); const wrong = !DF.UNLOCKED.has("enforcer");
  send("UUDDLRBXYB"); const right = DF.UNLOCKED.has("enforcer") && G.msgs.some((m) => /ENFORCER UNLOCKED/.test(m.text));
  DF.resetPlaqueCodes(); return { pass: wrong && right, wrong, right };`),
step("pad code unlocks", `
  DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "LRLRYYXB"); DF.enterHub(); ${stand}
  const pads = [{ index: 0, connected: true, mapping: "standard", id: "fake",
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] }];
  navigator.getGamepads = () => pads; const btn = { U: 12, D: 13, L: 14, R: 15, B: 1, X: 2, Y: 3 };
  const press = (i) => { pads[0].buttons[i] = { pressed: true, value: 1 }; DF.sim(0.05, () => DF.PAD.poll(1 / 60));
    pads[0].buttons[i] = { pressed: false, value: 0 }; DF.sim(0.05, () => DF.PAD.poll(1 / 60)); };
  press(0); DF.sim(0.6, () => DF.PAD.poll(1 / 60)); for (const ch of "LRLRYYXB") press(btn[ch]);
  const ok = DF.UNLOCKED.has("enforcer"); DF.closePlaque(true); navigator.getGamepads = () => []; DF.PAD.poll(1 / 60);
  DF.resetPlaqueCodes(); return { pass: ok };`),
step("held keys, sealed and already open plaques take nothing", `
  DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "UUUUUUUU"); DF.enterHub(); ${stand}
  DF.keys[DF.BIND.fwd] = true; K("interact"); DF.sim(1); DF.keys[DF.BIND.fwd] = false;
  const held = G.insp.syms.length === 0 && !DF.UNLOCKED.has("enforcer"); DF.closePlaque(true);
  DF.unlockClass("enforcer"); let writes = 0; const real = Storage.prototype.setItem;
  Storage.prototype.setItem = function (...a) { writes++; return real.apply(this, a); };
  K("interact"); DF.sim(0.6); for (let i = 0; i < 8; i++) { DF.taps[DF.BIND.fwd] = true; DF.sim(0.05); }
  const opened = G.msgs.filter((m) => /UNLOCKED/.test(m.text)).length === 0 && writes === 0; DF.closePlaque(true);
  const r = G.world.plaques[1], g = DF.plaqueFront(r, 1.6); p.x = g.x; p.z = g.z; DF.sim(0.05);
  K("interact"); DF.sim(0.6); const sealed = p.state === "inspect" && document.getElementById("plaque").classList.contains("sealed");
  Storage.prototype.setItem = real; DF.closePlaque(true); DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes();
  return { pass: held && opened && sealed, held, opened, sealed };`),
step("shared key enters the symbol", `
  DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "BBBBBBBB"); DF.BIND.dodge = "Space"; DF.enterHub(); ${stand}
  K("interact"); DF.sim(0.6); for (let i = 0; i < 8; i++) { DF.taps.Space = true; DF.sim(0.05); }
  const ok = DF.UNLOCKED.has("enforcer") && p.state === "inspect"; DF.closePlaque(true);
  DF.BIND.dodge = "KeyB"; DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes(); return { pass: ok };`),
step("the real code", local && local.enforcer ? `
  DF.UNLOCKED.clear(); DF.enterHub(); ${stand}
  const B = DF.BIND, key = { U: B.fwd, D: B.back, L: B.left, R: B.right, B: B.dodge, X: B.heal, Y: B.tool };
  K("interact"); DF.sim(0.6); for (const ch of ${JSON.stringify(local.enforcer)}) { DF.taps[key[ch]] = true; DF.sim(0.05); }
  const ok = DF.UNLOCKED.has("enforcer"); DF.closePlaque(true); DF.UNLOCKED.clear(); DF.saveOpt(); return { pass: ok };`
  : `return { pass: true, skipped: "no tests/codes.local.json" };`),
```

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`
Expected: the first four new steps FAIL; "the real code" passes as skipped.

- [ ] **Step 3: Implement `codeHash` and `readSyms`.** `readSyms` reads, in this order: `hit("dodge")`, `hit("heal")`, `hit("tool")`, then `hit("fwd")`, `hit("back")`, `hit("left")`, `hit("right")`, then raw taps `P:12` to `P:15`, then the left stick (`PAD.move` past 0.5, quantised to the nearer axis, counted once until `mag` falls below 0.2, tracked in `G.insp.stick`). Reading the action symbols first is what makes a key shared with Interact count as the symbol. Because only taps count, a key held when the plaque opened adds nothing.

- [ ] **Step 4: Implement matching in `inspectUpdate`.** Only for a plaque with `cls` set, `classOpen(cls)` false and an entry in `PLAQUE_CODES`: push each symbol to `G.insp.syms` (keep the last 10), fill `#plaqueMarks` with the last `len`, and when `codeHash(last len joined) === hash` call `unlockClass`, `SFX.unlock()`, `say(NAME + " UNLOCKED", "crit", 2.5)` and `say("Choose it from the class picker", "good", 2.5)`, flare the card in the class colour and switch it to `.open`. Then read `hit("interact")` to close. The close line names the pause key when Interact's key is also a symbol key.

- [ ] **Step 5: Choose the real code.** Pick a 10-symbol Enforcer code. Write `{ "enforcer": "<code>" }` to `tests/codes.local.json`, add `tests/codes.local.json` to `.gitignore`, and set `PLAQUE_CODES.enforcer` to `{ hash: codeHash("<code>"), len: 10 }` with the hash written as a literal (compute it once in Node). Report the plain code back in your task summary so it can be passed to the owner. Never write it anywhere else.

- [ ] **Step 6: Run to verify they pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`
Expected: every step passes, and "the real code" runs rather than skips.

- [ ] **Step 7: Check the code is not committed**

Run: `git status --short && git grep -n "$(node -e 'console.log(require("./tests/codes.local.json").enforcer)')" || echo clean`
Expected: `tests/codes.local.json` is not listed, and the grep prints `clean`.

- [ ] **Step 8: Commit**

```bash
git add src .gitignore tests/t18.mjs
git commit -m "feat: plaque codes unlock hidden classes"
```

---

### Task 9: Plaques by touch

**Files:**
- Modify: `src/08b_touchlayout.js` (`layoutAt`, `layoutProblems`), `src/08c_touch.js` (classify), `src/08_hud.js` (`place`)
- Create: `tests/t19.mjs`
- Test: `tests/t13.mjs`, `tests/t14.mjs`

**Interfaces:**
- Consumes: `plaqueAt()` (Task 6), `G.insp` (Task 7), `readSyms` reading `T:` taps (Task 8).
- Produces: layout entries `prompt` `{ x, y, w, h }` (the Inspect prompt box, centred horizontally above the cluster top), `close` `{ x, y, w, h }` (the card's close control, top centre under the pause square's row) and `dpad` `{ x, y, d }` (centre and full width, centred on `rest`, `d = 2.4 * R` capped so it stays inside `move`). `layoutProblems` adds: `prompt` and `close` overlap no button, `vitals`, `map`, `pause` or `boss`; `dpad` sits inside `move`.
- A finger on `prompt` while the prompt shows sets `keys`/`taps["T:interact"]`; on `close` while inspecting, the same; on a `dpad` arm while inspecting, `taps["T:fwd" | "T:back" | "T:left" | "T:right"]`. The Dodge, Flask and Tool buttons work as before, so they give `B`, `X` and `Y`. While inspecting, the stick and camera areas take no finger.

- [ ] **Step 1: Write the failing tests.** In `t13`, add a step that every device in `tests/devices.mjs` gets a layout with `prompt`, `close` and `dpad` and that `layoutProblems` is empty. Create `tests/t19.mjs` (run with `DEVICE=<id> SCRIPT=$PWD/tests/t19.mjs node test.mjs hub`), using `__touch` as `t14` does and waiting two frames before reading:

```js
step("touch: prompt opens, D-pad and buttons enter, close closes", `
  DF.UNLOCKED.clear(); DF.setPlaqueCode("enforcer", "UDLRBXYB"); DF.enterHub(); ${stand}
  const L = DF.TOUCH.layout, mid = (b) => [b.x + b.w / 2, b.y + b.h / 2], btn = (a) => L.btns.find((b) => b.act === a);
  const arm = { U: [L.dpad.x, L.dpad.y - L.dpad.d * 0.35], D: [L.dpad.x, L.dpad.y + L.dpad.d * 0.35],
    L: [L.dpad.x - L.dpad.d * 0.35, L.dpad.y], R: [L.dpad.x + L.dpad.d * 0.35, L.dpad.y],
    B: [btn("dodge").x, btn("dodge").y], X: [btn("heal").x, btn("heal").y], Y: [btn("tool").x, btn("tool").y] };
  const tapAt = async ([x, y]) => { await __touch("touchStart", [{ x, y }]); await frames(2); DF.sim(0.05); await __touch("touchEnd", []); await frames(2); };
  return (async () => { await frames(2); await tapAt(mid(L.prompt)); DF.sim(0.6); const open = G.player.state === "inspect";
    for (const ch of "UDLRBXYB") await tapAt(arm[ch]); const unlocked = DF.UNLOCKED.has("enforcer");
    await tapAt(mid(L.close)); DF.sim(0.6); const shut = G.insp === null; DF.UNLOCKED.clear(); DF.saveOpt(); DF.resetPlaqueCodes();
    return { pass: open && unlocked && shut, open, unlocked, shut }; })();`),
```

Copy the `step` and `stand` helpers from `t18`, and the `frames` helper and the `__touch` call shape from `t14`; adapt the snippet to them rather than the other way round.

- [ ] **Step 2: Run to verify they fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t13.mjs node test.mjs title && DEVICE=oneplus-13 SCRIPT=$PWD/tests/t19.mjs node test.mjs hub`
Expected: the new steps FAIL.

- [ ] **Step 3: Implement** the three layout entries and their checks, the classify rules in `08c_touch.js`, the D-pad and close control drawn in the SVG overlay only while inspecting, and `place()` writing the prompt box under touch.

- [ ] **Step 4: Run to verify they pass on every device**

Run: `node build.mjs && SCRIPT=$PWD/tests/t13.mjs node test.mjs title && node tests/touch-all.mjs tests/t19.mjs hub && node tests/touch-all.mjs tests/t14.mjs && node tests/touch-all.mjs tests/t15.mjs`
Expected: every device passes. Open `shots/<device>-touch-hall.png` for two devices and check by eye.

- [ ] **Step 5: Commit**

```bash
git add src tests/t13.mjs tests/t19.mjs
git commit -m "feat: inspect plaques and enter codes by touch"
```

---

### Task 10: Docs and the full sweep

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: README.** Keyboard: dodge on B, Interact on Space. Controller table: A / Cross is Interact. Touch table: the Inspect prompt is tapped. One line: the hall has plaques you can inspect. Nothing about codes or hidden classes.

- [ ] **Step 2: CLAUDE.md.** Add: the `interact` action and its priority at a plaque; `hubPlaques()`, `plaqueFront`, `plaqueAt`, `PLAQUE_Y`, `G.world.plaques`; the `inspect` and `grapple` player states and `G.insp`; `hidden` on a class, `UNLOCKED`, `classOpen`, `pickable`, `u` in the save; `codeHash`, `PLAQUE_CODES`, symbols, `DF.setPlaqueCode`, `tests/codes.local.json`; `G.bombs` and `STICKY`; the touch `prompt`, `close` and `dpad` layout entries; `t18` and `t19` under Testing; the Enforcer in Known problems as untested by hand. Update the Player state list.

- [ ] **Step 3: Full sweep**

Run each, from the repo root, after `node build.mjs`:
`SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`, `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`, `SCRIPT=$PWD/tests/t9.mjs node test.mjs hub`, `SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`, `SCRIPT=$PWD/tests/t5.mjs node test.mjs smoke`, `SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`, `SCRIPT=$PWD/tests/t12.mjs node test.mjs smoke`, `SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`, `DEVICE=oneplus-13 SCRIPT=$PWD/tests/t17.mjs node test.mjs smoke`, `SCRIPT=$PWD/tests/t13.mjs node test.mjs title`, `node tests/touch-all.mjs tests/t14.mjs`, `node tests/touch-all.mjs tests/t19.mjs hub`.
Expected: all exit 0.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: plaques, codes and the Enforcer"
```
