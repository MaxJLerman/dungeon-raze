# Base of Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The game boots into a built hall with six graded portal frames and a training dummy; the open E portal leads to the existing cave and the player can return.

**Architecture:** The hall is a second world object with the same shape `genWorld` returns, swapped into `G.world` by `enterHub` and `enterCave`. `G.zone` says which is active. The dummy is an `EDEF` enemy type with a `dummy` flag, so every attack reaches it through `hitEnemy`.

**Tech Stack:** Plain JavaScript (ES2020), WebGL 2 through the project's own renderer `R`, HTML and CSS HUD, Playwright with headless Chromium for tests.

**Spec:** `docs/superpowers/specs/2026-11-15-base-of-operations-design.md`. Read it and `CLAUDE.md` before starting.

## Global Constraints

- All `src/*.js` files share one function scope. No imports or exports. Declare each name once across `src/`.
- No dependencies and nothing loaded at run time. All geometry is generated in code.
- Pointer lock and audio start only from a click or key handler.
- Run `node build.mjs` after every source change. `dist/` is not committed.
- Axes: ground is XZ, Y is up. Yaw `a` means forward is `(sin a, 0, cos a)`. Facing +Z, the player's left is +X.
- World vertex colours are square-root encoded bytes; the alpha byte is glow.
- Existing scripts `tests/t1.mjs` to `tests/t7.mjs` are not edited.
- The cave must play as it does today. `tests/t5.mjs` output must be identical before and after.
- Commits follow `CLAUDE.md`: authored as the repo's configured user, with no `Co-Authored-By` or session trailers.
- Screenshots are looked at, not assumed.

## Review Focus

Conditions the spec implies that are most likely to bite a player. Each is pinned by a test in the task named.

1. **Repeat trips.** Five hall-to-cave round trips, including after killing the boss, must each give a fresh cave with the boss alive and no leftover gate. Task 3, step "round trips stay fresh".
2. **Return to base while dead.** Choosing it from the death screen must give a live player in the hall at full health. Task 5, step "hall screens".
3. **Things in flight at the swap.** Projectiles and pending blasts must not carry into the next world. Task 3, step "swap clears things in flight".
4. **Entering mid-action.** Dodging or attacking into the portal must arrive in the cave free to act, and the player must be unhurtable during the fade. Task 3, steps "E portal leads to a cave" and "entering mid-dodge arrives free".
5. **Changing class in the hall.** The player stays put and the dummy stays intact. Task 4, step "class change in the hall".

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `test.mjs` | Modify | Add `hub` mode, pass or fail exit code |
| `tests/t8.mjs` | Create | Logic tests for the hall, portals, dummy, screens |
| `tests/t9.mjs` | Create | Screenshots of the hall |
| `src/03_world.js` | Modify | Extract the field and mesh helpers so the hall can share them |
| `src/03b_hub.js` | Create | `GRADES`, `portalFront`, `genHub` |
| `src/02_gl.js` | Modify | `setWorld` frees the previous world |
| `src/05_figures.js` | Modify | Dummy figure |
| `src/06_game.js` | Modify | Zones, transition, portal trigger, dummy rules, hall refills |
| `src/07_render.js` | Modify | Dummy pose, portal glow, brazier flames |
| `src/08_hud.js` | Modify | Minimap hidden in hall, portal labels, fade overlay |
| `src/09_main.js` | Modify | Boot into hall, buttons, title camera, `DF` exports |
| `index.tpl.html` | Modify | Copy, buttons, `#fade`, `#plabels`, CSS |
| `README.md`, `CLAUDE.md` | Modify | Document zones, hall, grades, dummy, tests |

`03b_hub.js` sorts after `03_world.js` because `_` sorts before `b`.

## Test conventions

Every step in `tests/t8.mjs` is built with this helper and returns an object with a boolean `pass`:

```js
const step = (name, body) => ({
  name,
  eval: `(() => { const { G, cam } = DF; G.manual = true; const K = (a) => { DF.taps[DF.BIND[a]] = true; }; ${body} })()`,
});
```

Run command, used throughout:

```bash
node build.mjs && SCRIPT=$PWD/tests/t8.mjs node test.mjs hub
```

---

### Task 1: Test runner with a hall mode and a real exit code

**Files:**
- Modify: `test.mjs`
- Create: `tests/t8.mjs`

**Interfaces:**
- Produces: `node test.mjs hub` clicks play and stays where the game puts the player. `node test.mjs smoke` clicks play and then, if `DF.enterCave` exists, calls `DF.enterCave("E")`. The process exits 1 if any step returns `pass === false` or any page error was logged.

- [ ] **Step 1: Branch and commit the documents**

```bash
git switch -c feat/base-of-operations
git add docs/superpowers
git commit -m "docs: base of operations design and plan"
```

Leave the owner's uncommitted edit to `CLAUDE.md` alone until Task 7.

- [ ] **Step 2: Install the test tooling**

```bash
npm install --no-save playwright && npx playwright install chromium
mkdir -p shots && node build.mjs
t5line() { SCRIPT=$PWD/tests/t5.mjs node test.mjs smoke | grep "seed sweep" | sed 's/"genMs":[0-9]*,//'; }
t5line | tee shots/baseline-t5.txt
```

Expected: one `seed sweep` line with `"nbad":0`. `shots/` is ignored by git. `t5line` is reused in later tasks; redefine it in each new shell.

- [ ] **Step 3: Write the failing test**

Create `tests/t8.mjs` with the `step` helper above and one step:

```js
export default [
  step("hub world", `return { pass: typeof DF.genHub === "function" };`),
];
```

- [ ] **Step 4: Run it and see the runner ignore the failure**

Run: `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub; echo exit=$?`
Expected: prints `hub world {"pass":false}` and `exit=0`. The exit code is the bug.

- [ ] **Step 5: Change `test.mjs`**

- `mkdir` the `shots` directory at start.
- Mode `hub`: click `#btnPlay`, wait, do not enter a cave.
- Mode `smoke`: as now, then `await p.evaluate(() => DF.enterCave && DF.enterCave("E"))` before the info line.
- For each step result that is an object with `pass === false`, print `FAIL <name>` and count it.
- At the end print `N failed` or `all passed`, and set `process.exitCode = 1` if anything failed or `errs` is non-empty.

- [ ] **Step 6: Verify**

Run: `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub; echo exit=$?`
Expected: `FAIL hub world`, `1 failed`, `exit=1`.
Run: `SCRIPT=$PWD/tests/t5.mjs node test.mjs smoke; echo exit=$?`
Expected: `all passed`, `exit=0`.

- [ ] **Step 7: Commit**

```bash
git add test.mjs tests/t8.mjs
git commit -m "test: hall mode and failing exit code in the runner"
```

---

### Task 2: The hall world

**Files:**
- Modify: `src/03_world.js` (the `fieldAt`, `resolve`, `los` closures and the `tri` packer inside `genWorld`)
- Create: `src/03b_hub.js`
- Modify: `src/09_main.js` (the `window.DF` object)
- Test: `tests/t8.mjs`

**Interfaces:**
- Produces, in `03_world.js`:
  - `fieldFns(F, minX, minZ, W, H)` returns `{ fieldAt(x, z), resolve(obj, rad), los(ax, az, bx, bz) }` with the exact behaviour the three closures have today.
  - `meshSink()` returns `{ P, C, tri(a, b, c, col, glow = 0) }` with the exact packing `genWorld` uses today.
- Produces, in `03b_hub.js`:
  - `GRADE_IDS = ["E", "D", "C", "B", "A", "S"]`
  - `GRADES`, keyed by id, each `{ id, name, col }`. `name` is `"E-rank gate"` and so on. `col` is linear RGB; E is `CRY.cyan`.
  - `portalFront(portal, d)` returns `{ x, z }`, the point `d` metres in front of the portal along its facing.
  - `genHub()` returns a world object with every key `genWorld` returns, plus `hub: true`, `portals` and `dummySpot`.
- Exposed on `DF`: `genHub`, `portalFront`, `GRADES`.

**Pinned values:**

| Thing | Value |
| --- | --- |
| Walkable rectangle | x from -15 to 15, z from -17 to 17. North is +Z |
| Grid | `minX = -18`, `minZ = -20`, `W = 36`, `H = 40` |
| Field | `min(15 - |x|, 17 - |z|, dist to each obstacle - its radius)`, floored at -3 |
| Ceiling | `ceilAt` returns 7 everywhere |
| Pillars | radius 1, at x = ±12, z = -9, -1 and 7 |
| Braziers | radius 0.8 obstacles, at x = ±12, z = -5 and 3 |
| Portals | index 0 to 5 are grades E, D, C, B, A, S at x = 11.5, 6.9, 2.3, -2.3, -6.9, -11.5; all at z = 16, `yaw = PI`. Each is `{ x, z, yaw, grade, open }`, with only E open |
| Start | `spawn = { x: 0, z: -10 }`, `spawnYaw = 0` |
| Dummy | `dummySpot = { x: -5, z: -1, yaw: PI }` |
| Lights | four braziers in `CRY.amber` and the E portal in cyan, five in total, in the shape `{ x, y, z, c, i, r, ph }` |
| Halos | one per brazier flame, in the shape `{ x, y, z, c, s }` |
| Empty in the hall | `nodes`, `edges`, `path`, `shrines`, `spawns` are `[]`; `start` and `boss` are `null` |

The start is 7 m in from the south wall so the camera, which sits 5.6 m behind the player, has room.

- [ ] **Step 1: Write the failing test**

Replace the step in `tests/t8.mjs` with:

```js
step("hub world", `
  const w = DF.genHub(), P = w.portals, f = (o) => w.fieldAt(o.x, o.z);
  const front = P.map((q) => DF.portalFront(q, 3.5));
  const pillars = [-12, 12].flatMap((x) => [-9, -1, 7].map((z) => ({ x, z })));
  const c = {
    arrays: ["nodes","edges","path","shrines","halos","lights","spawns","portals"].every((k) => Array.isArray(w[k])),
    fns: ["fieldAt","ceilAt","resolve","los"].every((k) => typeof w[k] === "function"),
    hub: w.hub === true && w.nodes.length === 0 && w.shrines.length === 0,
    mesh: w.pos.length > 0 && w.pos.length % 9 === 0 && w.col.length === (w.pos.length / 3) * 4,
    grades: P.map((q) => q.grade).join("") === "EDCBAS",
    order: P.every((q, i) => i === 0 || q.x < P[i - 1].x),
    open: P.map((q) => +q.open).join("") === "100000",
    pitch: P[0].x === 11.5 && Math.abs(P[0].x - P[1].x - 4.6) < 0.01,
    front: Math.abs(front[0].x - 11.5) < 0.01 && Math.abs(front[0].z - 12.5) < 0.01,
    start: w.spawn.x === 0 && w.spawn.z === -10 && w.spawnYaw === 0 && f(w.spawn) >= 1,
    dummy: w.dummySpot.x === -5 && w.dummySpot.z === -1 && f(w.dummySpot) >= 2,
    walls: f({ x: 0, z: 0 }) > 5 && f({ x: 16, z: 0 }) < 0 && f({ x: 0, z: 18 }) < 0,
    pillars: pillars.every((q) => f(q) < 0),
    reach: P.every((q) => f(q) >= 0.5) && front.every((q) => f(q) >= 2),
    sight: front.every((q) => w.los(w.spawn.x, w.spawn.z, q.x, q.z)),
    ceil: w.ceilAt(0, 0) === 7,
    lights: w.lights.length === 5,
    names: DF.GRADES.E.name === "E-rank gate" && DF.GRADES.S.name === "S-rank gate",
  };
  return { pass: Object.values(c).every(Boolean), c };`),
```

- [ ] **Step 2: Run it to see it fail**

Expected: `FAIL hub world` with a page error that `DF.genHub` is not a function.

- [ ] **Step 3: Extract `fieldFns` and `meshSink` in `src/03_world.js`**

Move the bodies out unchanged and have `genWorld` call them. `ceilRaw`, `ceilAt`, `rock`, `wv` and the rest stay inside `genWorld`.

- [ ] **Step 4: Prove the cave is unchanged**

Run: `node build.mjs && t5line | diff - shots/baseline-t5.txt`
Expected: no output.

- [ ] **Step 5: Write `GRADE_IDS`, `GRADES`, `portalFront(portal, d)` and `genHub()` in `src/03b_hub.js`**

Build the mesh with `meshSink().tri`. Emit, in cooler and cleaner stone than `ROCK_A`:

- a floor of 2 m slabs whose shade varies by `hash2`;
- four walls and a ceiling at y = 7;
- six pillars and four brazier bowls;
- six identical arches against the north wall, each with an opening about 2.4 m wide and 3.4 m tall;
- a dark stone fill in the five sealed arches, and nothing in the open one;
- a low step ring on the floor in front of each arch, and a round floor mark at `dummySpot`.

Add `genHub`, `portalFront` and `GRADES` to `window.DF`.

- [ ] **Step 6: Run the test to see it pass**

Expected: `hub world {"pass":true,...}`, `all passed`.

- [ ] **Step 7: Commit**

```bash
git add src/03_world.js src/03b_hub.js src/09_main.js tests/t8.mjs
git commit -m "feat: hall world with six graded portal frames"
```

---

### Task 3: Zones, the portal trigger and the transition

**Files:**
- Modify: `src/02_gl.js` (`mesh`, `setWorld`)
- Modify: `src/06_game.js` (`G`, `newRun`, `update`, `hurtPlayer`)
- Modify: `src/09_main.js` (`boot`, `window.DF`)
- Modify: `src/08_hud.js`, `index.tpl.html` (fade overlay)
- Test: `tests/t8.mjs`

**Interfaces:**
- Consumes: `genHub()`, `portalFront(portal, d)`, `GRADES` from Task 2.
- Produces:
  - `G.zone`: `"hub"` or `"cave"`. `G.grade`: a grade id or `null`. `G.trans`: `null` or the running transition. `G.fade`: 0 to 1.
  - `resetRun()`: clears `projs`, `parts`, `arcs`, `rings`, `ghosts`, `pending`, `msgs`, `gate`, `bossDead`, `bossSeen`, `kills`, `deaths`, `runT`, `hitstop`, `slowT`, `shake` and both flash values. `newRun` and `enterHub` both call it.
  - `enterHub(fromGrade = null)`: sets the zone, builds and uploads the hall, makes a fresh player, clears the checkpoint, spawns `world.spawns`, snaps the camera. With `fromGrade`, the player stands at `portalFront(thatPortal, 3.5)` with `yaw = PI` and the camera behind.
  - `enterCave(gradeId, seed = random)`: sets `G.grade`, calls `newRun(seed)`, then `say(GRADES[gradeId].name.toUpperCase(), "big", 3)`.
  - `newRun(seed)`: unchanged meaning, and sets `G.zone = "cave"`.
  - `startTrans(gradeId, cut = RM)`: with `cut`, calls `enterCave` at once. Otherwise sets `G.trans`.
- Exposed on `DF`: `enterHub`, `enterCave`, `startTrans`.

**Pinned behaviour:**

- The transition lasts 0.8 s of simulation time. `G.fade` rises linearly to 1 at 0.4 s, the swap happens there, and it falls to 0 by 0.8 s, when `G.trans` becomes `null`.
- While `G.trans` is set, `update` advances only the transition, and `hurtPlayer` returns `"none"`.
- The trigger is checked in `update`, in the hall only, when there is no transition and the player is not dead: within 1.2 m of an open portal's `x, z`.
- `G.runT` advances only in the cave.
- `R.setWorld` deletes the previous world's vertex array and buffers. `mesh` must return the buffers for that.
- `boot` calls `enterHub()` where it called `newRun`.
- `#fade` is a full-screen black element above the canvas and below the menus, with `pointer-events: none`. `HUD.update` sets its opacity from `G.fade`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/t8.mjs`:

```js
step("boots into the hall", `return { pass: G.zone === "hub" && G.world.hub === true && G.state === "play", zone: G.zone };`),
step("E portal leads to a cave", `
  DF.enterHub(); const p = G.player, q = G.world.portals[0];
  p.x = q.x; p.z = q.z - 3; p.yaw = 0; cam.yaw = 0; DF.keys[DF.BIND.fwd] = true;
  let peak = 0, hurt = null;
  DF.sim(4, () => { if (G.trans) { peak = Math.max(peak, G.fade); if (hurt === null) hurt = DF.hurtPlayer(50, null, { px: p.x, pz: p.z - 1 }); } return G.zone === "hub" || !!G.trans; });
  DF.keys[DF.BIND.fwd] = false; const P = G.player;
  const c = { zone: G.zone === "cave", grade: G.grade === "E", done: !G.trans && G.fade === 0, peak: peak > 0.95, hurt: hurt === "none",
    cave: G.world.shrines.length > 0 && G.enemies.some((e) => e.type === "warden"), fresh: P.state === "free" && P.hp === P.maxHp,
    msg: G.msgs.some((m) => m.text === "E-RANK GATE") };
  return { pass: Object.values(c).every(Boolean), c };`),
step("sealed frames do nothing", `
  DF.enterHub(); const p = G.player; let ok = true; cam.yaw = 0; DF.keys[DF.BIND.fwd] = true;
  for (const q of G.world.portals.slice(1)) { p.x = q.x; p.z = q.z - 3; DF.sim(3); ok = ok && G.zone === "hub" && !G.trans; }
  DF.keys[DF.BIND.fwd] = false; return { pass: ok };`),
step("return to base", `
  DF.enterCave("E", 99); DF.enterHub(G.grade); const p = G.player, q = G.world.portals[0];
  const at = Math.hypot(p.x - q.x, p.z - (q.z - 3.5)) < 0.01 && Math.cos(p.yaw) < -0.99;
  DF.sim(2); return { pass: at && G.zone === "hub" && !G.trans && G.checkpoint === null };`),
step("round trips stay fresh", `
  let ok = true; const seeds = new Set();
  for (let i = 0; i < 5; i++) { DF.enterCave("E"); seeds.add(G.seed);
    DF.hitEnemy(G.enemies.find((e) => e.type === "warden"), 1e6, 0, {}); ok = ok && G.bossDead && !!G.gate;
    DF.enterHub("E"); ok = ok && G.zone === "hub" && !G.gate && !G.bossDead && G.kills === 0 && !G.player.lock; }
  DF.enterCave("E"); ok = ok && G.enemies.some((e) => e.type === "warden" && !e.dead);
  return { pass: ok && seeds.size === 5 };`),
step("swap clears things in flight", `
  DF.enterHub(); const p = G.player, q = G.world.portals[0];
  G.projs.push({ x: 0, y: 1, z: 0, vx: 0, vz: 1, life: 9, own: "p", dmg: 1, post: 0, kind: "arrow", c: [1, 1, 1] });
  G.pending.push({ x: q.x, z: q.z, r: 3, dmg: 1, post: 0, c: [1, 1, 1], t: 0.6 });
  p.x = q.x; p.z = q.z - 0.5; DF.sim(2, () => G.zone === "hub" || !!G.trans);
  return { pass: G.zone === "cave" && G.projs.length === 0 && G.pending.length === 0 && G.rings.length === 0 };`),
step("entering mid-dodge arrives free", `
  DF.enterHub(); const p = G.player, q = G.world.portals[0]; p.x = q.x; p.z = q.z - 2.5; p.yaw = 0; cam.yaw = 0;
  DF.keys[DF.BIND.fwd] = true; K("dodge"); DF.sim(3, () => G.zone === "hub" || !!G.trans); DF.keys[DF.BIND.fwd] = false;
  const P = G.player; return { pass: G.zone === "cave" && P.state === "free" && P.buf === null && P.iframe <= 1 };`),
step("reduced motion cuts", `
  DF.enterHub(); DF.startTrans("E", true); return { pass: G.zone === "cave" && !G.trans && G.fade === 0 };`),
step("run timer", `
  DF.enterHub(); DF.sim(1); const hub = G.runT; DF.enterCave("E", 99); DF.sim(1);
  return { pass: hub === 0 && G.runT > 0.9 };`),
```

- [ ] **Step 2: Run to see them fail**

Expected: `hub world` passes; the nine new steps fail or throw.

- [ ] **Step 3: Implement the interfaces and pinned behaviour above**

- [ ] **Step 4: Run to see them pass**

Expected: `all passed`, `exit=0`.

- [ ] **Step 5: Check the cave tests still run clean**

```bash
t5line | diff - shots/baseline-t5.txt
SCRIPT=$PWD/tests/t2.mjs node test.mjs smoke | tail -1
SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke | tail -1
```

Expected: no output from the diff, then `all passed` twice.

- [ ] **Step 6: Commit**

```bash
git add src tests/t8.mjs index.tpl.html
git commit -m "feat: boot into the hall and travel through the E portal"
```

---

### Task 4: Training dummy and hall refills

**Files:**
- Modify: `src/06_game.js` (`EDEF`, `makeEnemy`, `enemyUpdate`, `hitEnemy`, `kill`, the `execute` case of `playerUpdate`, `playerUpdate`)
- Modify: `src/05_figures.js` (`makeEnemyFig`)
- Modify: `src/07_render.js` (`poseEnemy`, the eye sprites in `render`)
- Modify: `src/03b_hub.js` (`spawns`)
- Modify: `src/09_main.js` (`window.DF`)
- Test: `tests/t8.mjs`

**Interfaces:**
- Consumes: `enterHub`, `enterCave`, `G.zone` from Task 3; `dummySpot` from Task 2.
- Produces:
  - `EDEF.dummy = { name: "Training dummy", dummy: true, hp: 100, posture: 60, speed: 1, turn: 0, r: 0.5, sight: 0, cd: 9, poise: 2, hunch: 0, top: 1.9, atks: {} }`
  - `genHub().spawns` is `[{ type: "dummy", x: -5, z: -1, yaw: PI, node: -1 }]`.
  - `makeEnemyFig("dummy")` returns a finished figure with every node the other enemy figures have, `rim`, and `eye = [0, 0, 0]`.

**Pinned behaviour:**

- `makeEnemy` sets `aware: true` for a dummy. That turns off the ambush bonus and makes its bar show under the existing HUD rule.
- `enemyUpdate` for a dummy does only this: decay `flash`; pin `x`, `z`, `yaw` to `hx`, `hz`, `hyaw`; zero `kx`, `kz`; apply the normal posture decay; and in `stagger`, count `t` up to `dur`, then go to `idle` with posture 0.
- `hitEnemy` runs in full, then sets a dummy's `hp` back to `def.hp` before the death check.
- `kill` returns at once for a dummy.
- The execution's non-boss branch, for a dummy, sets `state = "idle"`, `t = 0`, `posture = 0` and `G.hitstop = 0.13` instead of killing. The player's health and focus gain and the `EXECUTION` message are unchanged.
- `poseEnemy` for a dummy: rock the chest back by `0.35 * e.flash`; slump forward with the amber tint while staggered; no walk, attack or kneel pose.
- `render` skips the eye sprites for a dummy.
- In `playerUpdate`, while `G.zone === "hub"`: focus gains 25 a second up to 100, and one tool charge returns every 1.5 s up to the class maximum.
- The figure is a stake, a padded torso, a crossbar and a sack head. It should read as a practice post, not a creature.

- [ ] **Step 1: Write the failing tests**

Append to `tests/t8.mjs`. `place` and `near` are string helpers defined at the top of the file. `near` declares `d` and `p` and may be used once per step; `place` only moves the player:

```js
const place = (dist) => `p.x = d.x; p.z = d.z - ${dist}; p.yaw = 0; cam.yaw = 0; cam.px = p.x; cam.pz = p.z;`;
const near = (dist) => `const d = G.enemies.find((e) => e.def.dummy), p = G.player; ${place(dist)}`;
```

```js
step("the hall holds only the dummy", `
  DF.enterHub(); const d = G.enemies[0], s = G.world.dummySpot;
  return { pass: G.enemies.length === 1 && d.def.dummy === true && d.x === s.x && d.z === s.z && d.aware === true };`),
...["assassin", "fighter", "tanker", "mage", "ranger"].map((id) =>
  step("dummy survives " + id, `
    DF.setClass("${id}"); DF.enterHub(); ${near(id === "mage" || id === "ranger" ? 9 : 2.4)}
    K("lock"); DF.sim(0.1); const locked = p.lock === d; let hits = 0, f0 = d.flash;
    for (let r = 0; r < 4; r++) {
      DF.sim(1.5, (i) => { if (i % 12 === 0) K("light"); if (d.flash > f0) hits++; f0 = d.flash; });
      p.stam = p.maxStam; p.state = "free"; K("heavy"); DF.sim(1.3);
      p.state = "free"; K("tool"); DF.sim(1.0);
      p.state = "free"; p.focus = 100; K("special"); DF.sim(2.0);
      p.hp = p.maxHp; p.stam = p.maxStam; p.state = "free"; ${place(id === "mage" || id === "ranger" ? 9 : 2.4)}
    }
    const c = { locked, hits: hits >= 4, alive: !d.dead && d.state !== "dead" && G.enemies.includes(d), hp: d.hp === d.def.hp,
      home: d.x === d.hx && d.z === d.hz && d.yaw === d.hyaw, nan: p.x === p.x, kills: G.kills === 0 };
    return { pass: Object.values(c).every(Boolean), c, hits };`)),
step("dummy can be staggered and executed", `
  DF.setClass("fighter"); DF.enterHub(); ${near(2.4)}
  d.posture = d.def.posture - 1; K("light"); DF.sim(0.8, () => d.state !== "stagger"); const stag = d.state === "stagger";
  p.state = "free"; p.hp = 50; K("light"); DF.sim(0.2); const exec = p.state === "execute"; DF.sim(4);
  const c = { stag, exec, alive: !d.dead && G.enemies.includes(d), idle: d.state === "idle", post: d.posture === 0, hp: d.hp === d.def.hp, healed: p.hp > 50 };
  return { pass: Object.values(c).every(Boolean), c };`),
step("stagger ends on its own", `
  DF.setClass("fighter"); DF.enterHub(); ${near(6)} d.posture = d.def.posture; DF.hitEnemy(d, 1, 1, { src: "melee" });
  const stag = d.state === "stagger"; DF.sim(4); return { pass: stag && d.state === "idle" && d.posture === 0 };`),
step("hall refills", `
  DF.setClass("fighter"); DF.enterHub(); let p = G.player; p.focus = 0; p.tool = 0; DF.sim(4);
  const hub = p.focus >= 99 && p.tool >= Math.min(2, p.cls.tool.max);
  DF.enterCave("E", 99); p = G.player; p.focus = 0; p.tool = 0; p.restCD = 99; DF.sim(4);
  return { pass: hub && p.focus < 50 && p.tool === 0 };`),
step("class change in the hall", `
  DF.setClass("fighter"); DF.enterHub(); ${near(4)} const x = p.x, z = p.z; DF.setClass("mage"); DF.sim(0.5);
  return { pass: G.player.clsId === "mage" && Math.hypot(G.player.x - x, G.player.z - z) < 0.5 && G.enemies.length === 1 && !d.dead && G.zone === "hub" };`),
```

If a class never lands four hits at the given distance, adjust the distance in the test, not the dummy.

- [ ] **Step 2: Run to see them fail**

Expected: the Task 2 and 3 steps pass; the ten new steps fail.

- [ ] **Step 3: Implement the dummy and the refills as pinned above**

Add `makeEnemy` to `window.DF`.

- [ ] **Step 4: Run to see them pass**

Expected: `all passed`.

- [ ] **Step 5: Check combat is unchanged**

```bash
SCRIPT=$PWD/tests/t2.mjs node test.mjs smoke | tail -1
SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke | tail -1
```

Expected: `all passed` twice.

- [ ] **Step 6: Commit**

```bash
git add src tests/t8.mjs
git commit -m "feat: training dummy and hall refills"
```

---

### Task 5: Screens and HUD

**Files:**
- Modify: `index.tpl.html` (title, pause, death and win screens; `#plabels`; CSS)
- Modify: `src/09_main.js` (`show`, `boot`, `camUpdate`)
- Modify: `src/08_hud.js` (`init`, `update`, `drawMap`)
- Test: `tests/t8.mjs`

**Interfaces:**
- Consumes: `enterHub(fromGrade)`, `G.zone`, `G.grade`, `GRADES`, `world.portals`.
- Produces: `toBase()`, which calls `enterHub(G.grade)` then `play()`. It is the click handler for all three "Return to base" buttons.

**Pinned copy and markup:**

| Element | Value |
| --- | --- |
| `#btnPlay` text | `Enter the hall` |
| Title subtitle | `Six gates stand in the hall, graded E to S. Only the first is open. Pick a class, step through it, and come back alive.` |
| Pause button | id `btnBase`, text `Return to base`, replacing `#btnNew`. Hidden while `G.zone === "hub"` |
| Death screen | keeps `#btnRise`; adds `#btnDeadBase`, text `Return to base` |
| `#btnAgain` text | `Return to base` |
| Open portal label | the grade's `name`, for example `E-rank gate` |
| Sealed portal label | the name, then ` · Sealed`, with class `sealed` and dimmer styling |

**Pinned behaviour:**

- `#map` is hidden while in the hall, and `drawMap` is skipped there.
- `#plabels` holds six label elements. Each frame in the hall, a label is shown when its portal is within 16 m of the player, `R.toScreen(x, 4.3, z)` is not `null`, and the point is inside the viewport. `toScreen` returns `null` only behind the camera, so the viewport check is needed. All labels are hidden in the cave.
- On the title screen in the hall, the camera sways: `cam.yaw = 0.45 * Math.sin(G.t0 * 0.1)`, where `G.t0` is a clock that advances in `camUpdate` while on the title. It does not orbit, so the arches stay in view.

- [ ] **Step 1: Write the failing tests**

Append to `tests/t8.mjs`. These are plain steps, because a rendered frame must pass between setup and reading the DOM:

```js
const shown = `const shown = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== "none"; };`;
```

```js
step("hall screens", `${shown}
  const txt = (id) => document.getElementById(id).textContent.trim(), click = (id) => document.getElementById(id).click();
  const c = { play: txt("btnPlay") === "Enter the hall" };
  DF.enterHub(); DF.show("pause"); c.hubPause = !shown("btnBase");
  DF.enterCave("E", 99); DF.show("pause"); c.cavePause = shown("btnBase") && txt("btnBase") === "Return to base";
  click("btnBase"); c.fromPause = G.zone === "hub" && G.state === "play";
  DF.enterCave("E", 99); G.player.state = "dead"; G.player.hp = 0; G.player.t = 2; DF.show("play"); DF.sim(0.1); DF.show("dead");
  c.deadBtns = shown("btnRise") && txt("btnDeadBase") === "Return to base"; click("btnDeadBase");
  c.fromDead = G.zone === "hub" && G.state === "play" && G.player.state === "free" && G.player.hp === G.player.maxHp;
  DF.enterCave("E", 99); DF.show("win"); c.win = txt("btnAgain") === "Return to base"; click("btnAgain"); c.fromWin = G.zone === "hub" && G.state === "play";
  const q = G.world.portals[0]; G.player.x = q.x; G.player.z = q.z - 8; G.player.yaw = 0; cam.yaw = 0; cam.pitch = 0.1; cam.px = q.x; cam.pz = q.z - 8;
  return { pass: Object.values(c).every(Boolean), c };`),
{ wait: 500 },
step("hall HUD", `${shown}
  const L = [...document.querySelectorAll("#plabels > *")].filter((e) => getComputedStyle(e).display !== "none");
  const open = L.find((e) => e.textContent.trim() === "E-rank gate"), sealed = L.find((e) => e.textContent.trim() === "D-rank gate · Sealed");
  const c = { open: !!open && !open.classList.contains("sealed"), sealed: !!sealed && sealed.classList.contains("sealed"),
    far: !L.some((e) => /^S-rank/.test(e.textContent.trim())), map: !shown("map"), fade: getComputedStyle(document.getElementById("fade")).opacity === "0" };
  DF.enterCave("E", 99); return { pass: Object.values(c).every(Boolean), c };`),
{ wait: 500 },
step("cave HUD", `${shown}
  const L = [...document.querySelectorAll("#plabels > *")].filter((e) => getComputedStyle(e).display !== "none");
  DF.enterHub(); return { pass: L.length === 0 && shown("map") };`),
```

- [ ] **Step 2: Run to see them fail**

Expected: the three new steps fail.

- [ ] **Step 3: Implement the copy, markup and behaviour pinned above**

- [ ] **Step 4: Run to see them pass**

Expected: `all passed`.

- [ ] **Step 5: Check the menu screenshots still run**

Run: `SCRIPT=$PWD/tests/t7.mjs node test.mjs smoke | tail -1`
Expected: `all passed`.

- [ ] **Step 6: Commit**

```bash
git add src index.tpl.html tests/t8.mjs
git commit -m "feat: return to base, hall HUD and portal labels"
```

---

### Task 6: How the hall looks

**Files:**
- Modify: `src/07_render.js` (`render`)
- Modify: `src/03b_hub.js`, `src/05_figures.js`, `index.tpl.html` as tuning requires
- Create: `tests/t9.mjs`

**Interfaces:**
- Consumes: `world.portals`, `world.halos`, `GRADES[id].col`, `G.zone`.

**Pinned behaviour:**

- In the hall, `render` draws the open portal's surface inside its arch with the additive effect calls (`R.sprite`, `R.ribbon`), in the grade's colour, with slow motion in it. Sealed portals draw nothing extra.
- Each brazier draws a flickering flame with sprites.
- The cave's rendering is not changed.

- [ ] **Step 1: Write the screenshot script**

Create `tests/t9.mjs`. Each entry sets up a view with `DF.enterHub()` or `DF.enterCave`, places the player and camera, sets `G.manual = true`, then uses `wait: 700` and `shot`:

| Shot name | View |
| --- | --- |
| `hub_start` | From the spawn point, `cam.yaw = 0`, `cam.pitch = 0.15`. All six frames in view |
| `hub_portal` | 6 m in front of the E portal, facing it, label visible |
| `hub_sealed` | 6 m in front of the C frame, facing it |
| `hub_side` | From x = 0, z = 5 with `cam.yaw = PI / 2`, showing pillars and braziers |
| `hub_dummy` | Fighter 2.4 m from the dummy, mid light attack, as in `tests/t7.mjs` |
| `hub_stagger` | Dummy in `stagger` with the execute prompt showing |
| `hub_fade` | `G.trans` forced to the midpoint, to confirm the overlay covers the screen |
| `cave_arrival` | The first frame after `DF.startTrans("E", true)` |

- [ ] **Step 2: Implement the portal surface and brazier flames**

- [ ] **Step 3: Take the shots**

```bash
node build.mjs && node test.mjs title && SCRIPT=$PWD/tests/t9.mjs node test.mjs hub
```

Expected: `all passed`, and files in `shots/`, including `title.png`.

- [ ] **Step 4: Look at every screenshot and fix what is wrong**

Open each PNG. Each of these must be true; tune and re-shoot until they are:

- All six frames are visible from the start, E on the left and S on the right.
- E glows cyan and the other five are plainly dark and sealed.
- The stone reads as built and cooler than cave rock. Nothing looks like a cave chamber.
- Braziers give warm light, and the hall is neither blown out nor murky.
- There are no holes, missing faces or flicker where floor, walls, ceiling, pillars and arches meet.
- The camera does not show through a wall or the ceiling in any shot.
- The dummy reads as a practice post, sits on its floor mark, and shows its bar.
- Labels sit above their arches and are readable; sealed ones are dimmer.
- The title screen shows the hall behind the menu.
- `cave_arrival` looks like the cave does today.

- [ ] **Step 5: Re-run the logic tests**

Run: `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub | tail -1`
Expected: `all passed`.

- [ ] **Step 6: Commit**

```bash
git add src index.tpl.html tests/t9.mjs
git commit -m "feat: portal glow, brazier flames and hall tuning"
```

---

### Task 7: Documentation and final check

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: Update `README.md`**

- Opening paragraph and "What is in the game": the hall, the six gates with only E open, the training dummy.
- Source layout table: add `src/03b_hub.js`.
- Tests: the `hub` mode, and rows for `tests/t8.mjs` and `tests/t9.mjs`.

- [ ] **Step 2: Update `CLAUDE.md`**

Keep the owner's existing uncommitted edit. Add:

- "Where the project stands": the base exists; grades carry no difficulty or rewards yet.
- "How the systems fit together": a "Zones" section covering `G.zone`, `enterHub`, `enterCave`, `newRun`, the transition living in `update`, and the rule that the hall world has every field the cave world has.
- "Enemies": the `dummy` flag and the five places it is honoured.
- "Recipes": "Open another portal", which is setting `open` on its `portals` entry and giving `enterCave` something to do with the grade.
- "Testing": `tests/t8.mjs` after any change to zones, portals or the dummy.
- "Backlog": grade difficulty and rewards as the next step for the base.

- [ ] **Step 3: Run everything**

```bash
node build.mjs
for t in t2 t5 t6 t7; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke | tail -1; done
SCRIPT=$PWD/tests/t8.mjs node test.mjs hub | tail -1
SCRIPT=$PWD/tests/t9.mjs node test.mjs hub | tail -1
t5line | diff - shots/baseline-t5.txt
```

Expected: `all passed` six times, and no output from the diff.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: base of operations, zones and the training dummy"
```
