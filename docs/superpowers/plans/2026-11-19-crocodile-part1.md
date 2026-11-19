# Crocodile Part One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Warden in the sewer's boss cavern with the crocodile, Old Sluicejaw: it hides under the water, surfaces with a warning, fights on land (rearing slam, bite chain, tail sweep, death roll), and dives at each 25% of health lost.

**Architecture:** The crocodile is an `EDEF` boss with `EBEH.croc` hooks in `src/06b_ebeh.js`. A `step` hook owns its modes (`wait`, `under`, `rise`, `land`, `dive`) and lets the shared state machine run only in `land`, so its attacks, posture, stagger and execution are the shared boss path. Task 1 adds the few shared seams it needs (an attack filter hook, an arena boss, own phases, a kill message per boss), each a no-op for every existing type.

**Tech Stack:** Plain JavaScript concatenated into one page (`node build.mjs`), own WebGL renderer, headless Chromium tests through `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-19-crocodile-boss-design.md` (part one only). `CLAUDE.md` holds the conventions.

## Global Constraints

- All `src/*.js` share one scope: declare each name once. `node build.mjs` after every source change.
- No dependencies, no network, everything generated in code.
- E's cave, enemies and tests do not change: t22's hashes of caves 1, 7 and 99 hold, t5, t6, t12 pass unchanged.
- D stays out of `LIVE_GRADES`. Tests add it with `DF.LIVE_GRADES.add("D")` and remove it.
- Replacing the Warden moves t22's spawns hash only (seeds 1, 5, 9); the mesh, materials, `Wt`, pieces and dressing hashes hold. The commit says so.
- Every way of targeting an enemy skips `fall` and `hidden`; `safe` is not a target for damage.
- No hit takes it past the next mark (75%, 50%, 25% of `def.hp`) until that mark is passed.
- Name "Old Sluicejaw", threat 2, about 800 health. Every other number is a starting value for the playtest.
- Commits: plain `feat:`/`fix:`/`test:`/`docs:` messages, no `Co-Authored-By` or `Claude-Session` trailers. Never commit `shots/`, `new-names.txt` or `tests/codes.local.*`.
- Update `CLAUDE.md` in each task for what it adds; `README.md` in Task 5.

## Review Focus

1. The player stands on the surfacing spot or in the shallows when it comes up: they are hit once and pushed clear, never stuck inside it (Task 3).
2. The player dies, or leaves the cavern, while it is under, rising or holding them: it resets to `wait`, hidden, full health, no marks passed, and re-entering starts the fight again (Task 3, Task 4).
3. A mark is reached while the player is executing it: the dive waits until the execution ends, and the execution's damage still stops at the mark (Task 5).
4. Sapper rubble covers shore spots or the ring beside them: it never surfaces into rock or onto a spot with no dry footing near it (Task 3).
5. The death roll grabs a player standing beside rubble or a wall: the drag target is water the player can stand in, and after the hold it climbs back onto dry floor, never stays in the water fighting (Task 4).

---

### Task 1: Shared seams for a boss with its own rules

**Files:**
- Modify: `src/06_game.js` (`chooseAtk` ~4040 and its call ~4417; the chase case's boss leash ~4336; the half-health phase block in `hitEnemy` ~2449; `kill`'s boss message ~2314; the spawn filter ~1848; the Warden's `EDEF` entry)
- Modify: `src/06b_ebeh.js` (header comment: the new hook)
- Create: `tests/t25.mjs`

**Interfaces:**
- Produces: hook `atkOk(e, a, c) -> bool` in `EBEH`, read by `chooseAtk(e, dist, c)`: an attack the hook refuses is left out of the choice. `def.arena: true`: a boss whose chase gives up only when `!alive || !G.inBoss` (in place of the 38 m and 30 m limits). `def.ownPhases: true`: `hitEnemy`'s half-health phase change does not run. `def.fell`: the big message `kill` shows for a boss; the Warden gets `fell: "THE WARDEN FALLS"`. The spawn filter skips any `boss` type once `G.bossDead`, not only `"warden"`.

- [ ] **Step 1: Write the failing tests in `tests/t25.mjs`**

Same step pattern as `tests/t24.mjs`: each step registers a test type `__k` (copy of `DF.EDEF.warden` with changes) inside a `try` and deletes it in `finally`. Header: `// Run with: SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`.

- `"atkOk leaves refused attacks out"`: `__k` with `EBEH.__k = { atkOk: (e, a) => a !== e.def.atks.c1 }`; 200 calls of `DF.chooseAtk(e, 4, c)` at 4 m never return `atks.c1`; with no `atkOk` hook c1 comes up at least once.
- `"an arena boss holds while the player is in the cavern"`: in a D run (seed 5) put `__k` (`arena: true`) at the cavern centre, aware, in `chase`, its post 35 m away; `G.inBoss = true`, player 40 m off: after `DF.sim(0.5)` it is still `chase`. Set the player outside the cavern so `G.inBoss` turns false: within 0.5 s its state is `return`. A plain boss copy without `arena` gives up at 40 m as today.
- `"own phases skip the half-health roar"`: `__k` with `ownPhases: true` hit from full to 45%: `e.phase === 1`, state is not `roar`. The Warden itself still roars (`phase === 2`).
- `"a boss names its own fall"`: kill a `__k` with `fell: "TEST FALLS"`: the message element shows `TEST FALLS`; killing the Warden shows `THE WARDEN FALLS`.

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`
Expected: FAIL (`chooseAtk` ignores `atkOk`, the arena boss gives up, `__k` roars, the message is the Warden's).

- [ ] **Step 3: Implement the four seams in `src/06_game.js`**, each reducing to today's code for a type without the flag or hook. Export `chooseAtk` on `DF` (`src/09_main.js`) if it is not already. Document `atkOk` in the `06b_ebeh.js` header.

- [ ] **Step 4: Run t25, then the E suites**

Run: `node build.mjs && for t in t25 t5 t6 t12 t22 t24; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || break; done`
Expected: all PASS; t22 hashes unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/06b_ebeh.js src/09_main.js tests/t25.mjs CLAUDE.md
git commit -m "feat: an attack filter hook, arena bosses, own phases and a fall message per boss"
```

### Task 2: Old Sluicejaw's body, numbers and place in the cavern

**Files:**
- Modify: `src/06_game.js` (`EDEF.croc`)
- Modify: `src/05b_dbodies.js` (`EFIG.croc`, `EPOSE.croc`)
- Modify: `src/03c_sewer.js` (the boss spawn ~1535)
- Modify: `tests/t22.mjs` (spawns hash; the dry-spawns check allows the crocodile in water), `tests/t23.mjs` and `tests/t24.mjs` (any "no E type but the Warden" check becomes "no E type")
- Test: `tests/t25.mjs`

**Interfaces:**
- Consumes: Task 1's `arena`, `ownPhases`, `fell`.
- Produces: `EDEF.croc` with these fields and attacks (the numbers are starting values):

```js
croc: {
  name: "Old Sluicejaw", boss: true, arena: true, ownPhases: true,
  fell: "OLD SLUICEJAW FALLS", threat: 2, hp: 800, posture: 160,
  speed: 3.4, turn: 2.2, r: 1.3, sight: 30, cd: 0.9, poise: 2, top: 2.2,
  atks: {
    rear: { kind: "rear", style: "slam", wind: 0.5, act: 0.4, rec: 0.9, dmg: 26, radius: 3.5, unb: true },
    b1:   { style: "thrust", wind: 0.5,  act: 0.14, rec: 0.25, dmg: 16, reach: 3.6, arc: 1.2, lunge: 1.2, trig: 3.6, chain: "b2", w: 3 },
    b2:   { style: "thrust", wind: 0.32, act: 0.14, rec: 0.25, dmg: 16, reach: 3.6, arc: 1.2, lunge: 1.2, chain: "b3" },
    b3:   { style: "thrust", wind: 0.45, act: 0.16, rec: 0.8,  dmg: 22, reach: 3.8, arc: 1.2, lunge: 1.6 },
    tail: { style: "sweep",  wind: 0.55, act: 0.2,  rec: 0.7,  dmg: 20, reach: 4.6, arc: TAU, trig: 4.6, w: 2 },
    roll: { kind: "roll", style: "thrust", wind: 0.75, act: 0.25, rec: 0.9, dmg: 8, reach: 3.8, arc: 1.0, lunge: 2.4, trig: 4.5, unb: true, w: 1.5 },
  },
},
```

`rear` has no `trig`: only the surfacing starts it (Task 3). `roll` is grabbed in Task 4; until then its act does nothing. The spawn becomes `{ type: "croc", x: boss.x, z: boss.z, yaw: ea, node: boss.id, kind: "boss" }` (the centre pool), and `S.wardenD` goes.

- [ ] **Step 1: Write the failing tests in `tests/t25.mjs`**

- `"the cavern holds the crocodile, not the Warden"`: over D seeds 1 to 12, every sewer has exactly one `croc` spawn, of `kind: "boss"`, inside the cavern, and no `warden`; the cave (seed 99) still has its Warden.
- `"the crocodile's body in every state"`: on a D run, stage the crocodile visible on the ring and draw it in `idle`, `chase`, `wind`/`act` of `rear`, `b1`, `tail` and `roll`, `stagger` and `dead`; `R.nodePos` of its head is above its body in `rear`'s act and every pose draws without error. Screenshots `shots/t25-croc-idle.png`, `t25-croc-rear.png`, `t25-croc-bite.png`, `t25-croc-tail.png`, `t25-croc-roll.png`.
- `"a sewer frame stays in budget"`: with the crocodile drawn in the cavern, `R.stats.tris` stays under cave 99's whole draw (t22's number).

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`
Expected: FAIL (no `croc` type).

- [ ] **Step 3: Add `EDEF.croc`, `EFIG.croc` and `EPOSE.croc`, and the spawn.** The figure is primitive-built and original: long low body, heavy tail of tapering segments, four short legs, a long two-part jaw (`f.jaw` opens for bites), dark green-black with a pale belly, `f.rim` and `f.eye` set. Poses: walking low, rearing on the hind legs (`rear`), jaw snaps (`b1`..`b3`), the tail sweep (body turning with the tail), the roll (the body turning about its long axis), stagger, dead on its back.

- [ ] **Step 4: Update t22, t23, t24 and run the suites**

Run: `node build.mjs && for t in t25 t22 t23 t24 t10; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || break; done`
Expected: all PASS. Only t22's spawns hash moved (record the new values). Look at the `t25-croc-*` shots.

- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/05b_dbodies.js src/03c_sewer.js tests/t22.mjs tests/t23.mjs tests/t24.mjs tests/t25.mjs CLAUDE.md
git commit -m "feat: Old Sluicejaw's body takes the Warden's place in the sewer cavern (t22 spawns hash moves)"
```

### Task 3: Under, rising and on land

**Files:**
- Modify: `src/06b_ebeh.js` (`CROC`, `EBEH.croc`, the functions below)
- Modify: `src/07b_dfx.js` (`drawWakes`), `src/07_render.js` (call it)
- Modify: `src/09_main.js` (export `CROC`, `crocShores`, `crocFoot`, `crocPickSpot`)
- Test: `tests/t25.mjs`

**Interfaces:**
- Consumes: `EDEF.croc` (Task 2), `atkOk` (Task 1), `waterFoot`/`keepFooting`/`eStep` (existing).
- Produces:
  - `CROC = { under: [3, 5], swim: 7, warn: 0.9, burst: 18, land: 10, stagBonus: 3, minNew: 8, near: 4 }` (seconds, m/s, damage, metres).
  - `e.mode`: `"wait"` (before the fight, hidden at its post), `"under"` (hidden, swimming to `e.spot`), `"rise"` (hidden, the warning at `e.spot`), `"land"` (shown, the shared state machine runs), `"dive"` (shown, walking to the nearest water, then `under`). `e.modeT` is the time left in the mode. `step` returns true in every mode but `land`.
  - Tests call `DF.pickLock`, `DF.aimYaw`, `DF.hitEnemy`, `DF.explode`, `DF.respawn`, `DF.gradeCleared`, `DF.makeEnemy` and `R.stats`: export on `DF` any that are missing.
  - `crocShores(e, w) -> [{ x, z, body }]`: cached on `e.shores`; points on a 1 m lattice inside `w.boss.r` with `waterAt >= 0.5`, `fieldAt >= e.r`, and a dry point (`waterAt < 0.5`, `fieldAt >= e.r`) within 3 m.
  - `crocPickSpot(e, c) -> { x, z, body } | null`: of the shores whose `fieldAt` is still at least `e.r` (rubble), at least `CROC.minNew` from `e.lastSpot` and at least `CROC.near` from the player, the nearest to the player.
  - `crocFoot(e, x, z) -> bool`: `fieldAt >= e.r`; and in mode `land`, unless `e.wet`, `waterAt < 0.5`. Modes other than `land` and `dive` are not footing-checked (the hook moves it).
  - `crocReset(e)`: full health, `e.marks = 0`, `e.mode = "wait"`, hidden, back at its post, `aware` false, state `idle`, `G.bossSeen = false`.
  - `atkOk` for the crocodile: `rear` never (no `trig` anyway); `b1` and `roll` only with the player within 1.2 rad of its facing; `tail` only with the player more than 1.9 rad off its facing.

Rules (the spec's "Starting", "Under the water", "Surfacing" and "On land"):
- `wait`: on `G.inBoss` it calls `alertE(e)` (the boss bar comes up) and goes `under` for a random time in `CROC.under`.
- `under`: hidden; it moves at `CROC.swim` through water toward `e.spot` (picked on entry). When `e.spot` is in another body, it moves at once to that body's water point nearest its position (the joined-below rule; no wake on dry floor). When it arrives and the time is up: `rise` for `CROC.warn`.
- `rise`: hidden at `e.spot`; then shown, `e.lastSpot = e.spot`, a player within `e.r + 0.8` of the spot takes `CROC.burst` through `hurtPlayer` and is pushed clear, and it starts `rear` (state `wind`, `e.atk = atks.rear`), mode `land`, `e.landT = CROC.land`.
- `rear` (`wind`/`act` hooks for kind `"rear"`): over the act it moves through `eStep` to the dry footing point nearest the player within 3 m of the spot, then hits everything of the player's within `atk.radius` in front of it (unblockable, as the shared slam does).
- `land`: `e.landT` runs down except in `stagger`; entering `stagger` adds `CROC.stagBonus`. At 0, once its state is `chase` or `rec`, it goes `dive`: through `eStep` to the nearest shore point, then `under`.
- `state === "return"` (the shared give-up when `G.inBoss` turns false) and a respawn call `crocReset`.
- `drawWakes` (`07b_dfx.js`, effects only): in `under`, a V of foam sprites behind its heading and a few bubbles over it; in `rise`, bubbles boiling up and a widening ring at `e.spot`.

- [ ] **Step 1: Write the failing tests in `tests/t25.mjs`**

Each on a D run, seed 5, the player placed on the ring.
- `"it waits under until the player enters the cavern"`: before entry `e.mode === "wait"`, `e.hidden`, the boss bar hidden; after the player steps inside, `e.aware`, the bar shows, `e.mode === "under"`.
- `"under it cannot be locked, hit or aimed at"`: in `under`, `DF.pickLock()` does not return it, `DF.hitEnemy(e, 50, 0, {})` leaves `e.hp` unchanged, `DF.aimYaw()` ignores it.
- `"it surfaces at a new shore spot with a warning"`: sim until `rise`: `e.spot` is in water, at least `CROC.minNew` from the last spot, at least `CROC.near` from the player; `rise` lasts `CROC.warn` (±1 step) while hidden; then `e.mode === "land"`, shown, state `wind` with `rear`; after the act it stands on dry floor.
- `"standing on the spot hurts and pushes clear"` (Review Focus 1): player on `e.spot` at the end of `rise`: hp drops by `CROC.burst` (or a guard result), and after 0.5 s the player is at least `e.r + p.r` from it.
- `"land lasts CROC.land and a stagger keeps it up"`: from `land`, with a passive player out of reach, it is `dive` or `under` by `CROC.land + 3` s; forcing a stagger at 5 s keeps it in `land` until at least `CROC.land + CROC.stagBonus`.
- `"it turns its tail on a player behind it"`: player 3.5 m directly behind: over 200 `chooseAtk` calls only `tail` comes up; in front, `tail` never does.
- `"leaving the cavern resets it"` (Review Focus 2): hurt it to 70%, then move the player out: within 1 s `e.mode === "wait"`, `e.hp === e.def.hp`, hidden, bar hidden; walking back in starts it again. Same after `DF.respawn()`.
- `"it never surfaces into rubble"` (Review Focus 4): `w.addRock` over half its shore spots: 30 picks of `crocPickSpot` all have `fieldAt >= e.r` and a dry footing point within 3 m.
- Screenshots `t25-wake.png` (under, mid-moat) and `t25-rise.png` (the warning).

- [ ] **Step 2: Run and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`
Expected: FAIL (no modes).

- [ ] **Step 3: Implement `CROC`, `crocShores`, `crocPickSpot`, `crocFoot`, `crocReset` and `EBEH.croc` (`step`, `atkOk`, `wind`, `act`, `foot`) in `src/06b_ebeh.js`, and `drawWakes`.**

- [ ] **Step 4: Run the suites**

Run: `node build.mjs && for t in t25 t24 t23 t22 t6 t12 t21 t20; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || break; done`
Expected: all PASS. Look at `t25-wake` and `t25-rise`.

- [ ] **Step 5: Commit**

```bash
git add src/06b_ebeh.js src/07b_dfx.js src/07_render.js src/09_main.js tests/t25.mjs CLAUDE.md
git commit -m "feat: Old Sluicejaw swims under, surfaces with a warning and fights on land"
```

### Task 4: The death roll

**Files:**
- Modify: `src/06b_ebeh.js` (`EBEH.croc.act` for kind `"roll"`, `crocRollSpot`, `CROC` additions)
- Modify: `src/05b_dbodies.js` (the roll pose while holding)
- Test: `tests/t25.mjs`

**Interfaces:**
- Consumes: `grabPlayer(e, { dps, tx, tz, speed })`, `HOLD`, `releaseHold()` (existing); Task 3's modes and `crocFoot`.
- Produces: `CROC.rollDps: 12`, `CROC.dragSpeed: 4`, `CROC.rollIn: 2`, `CROC.rollCD: 8`. `crocRollSpot(e, c) -> { x, z }`: the water point nearest the player, then `CROC.rollIn` further along the same line, walked back until `waterAt >= 0.5` and `fieldAt >= p.r`; the player's own spot when none. `e.wet`: true from the grab until it is back on dry floor. `e.rollCD`: counts down; `atkOk` refuses `roll` while it is above 0.

Rules: the act lunges as the siren's grab does and, in reach, in its arc and in sight, calls `hurtPlayer(a.dmg, e, a)` and then `grabPlayer` toward `crocRollSpot`; on success its state is `hold` and it moves beside the player to the spot through `eStep`, drawn rolling. When the hold ends, however it ended, `e.rollCD = CROC.rollCD`, and the step walks it to the nearest dry footing point before the shared states run again; then `e.wet = false`. The roll does not stop `e.landT`.

- [ ] **Step 1: Write the failing tests in `tests/t25.mjs`**

- `"the death roll drags the player into the water"`: crocodile on land facing a player 3 m in front, `e.state = "wind"`, `e.atk = atks.roll`: within the wind and act the player is `held`, `p.hold.by === e`; after 1 s the player is in water (`waterAt >= 0.5`) and has lost about `CROC.rollDps` per second (± one tick).
- `"mashing dodge breaks the roll"`: tap dodge every 0.1 s: the hold ends before `HOLD.max`; `e.rollCD` is about `CROC.rollCD`; `chooseAtk` never gives `roll` while it is above 0.
- `"it climbs back out and fights on"` (Review Focus 5): after the hold, within 3 s it stands on dry floor (`waterAt < 0.5`), `e.wet === false`, mode still `land`, and `e.landT` kept running through the roll.
- `"a roll beside a wall or rubble"` (Review Focus 5): rubble from `addRock` between the player and the nearest water: the drag target is water with `fieldAt >= p.r`, and the player ends there or at their own spot, never inside rock.
- `"dying in the roll resets it"` (Review Focus 2): player hp set to 1 during the hold, sim to death and `DF.respawn()`: the crocodile is in `wait`, hidden, full health, no hold.
- Screenshot `t25-roll.png` (mid-roll).

- [ ] **Step 2: Run and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`
Expected: FAIL (the roll does nothing).

- [ ] **Step 3: Implement the roll act, `crocRollSpot`, the climb-out and the hold pose.**

- [ ] **Step 4: Run the suites**

Run: `node build.mjs && for t in t25 t24 t6; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || break; done; SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`
Expected: all PASS. Look at `t25-roll`.

- [ ] **Step 5: Commit**

```bash
git add src/06b_ebeh.js src/05b_dbodies.js tests/t25.mjs CLAUDE.md
git commit -m "feat: Old Sluicejaw's death roll drags the player into the water"
```

### Task 5: The 25% marks

**Files:**
- Modify: `src/06b_ebeh.js` (`EBEH.croc.hit`, `crocNextMark`, the mark in `step`)
- Modify: `CLAUDE.md`, `README.md`
- Test: `tests/t25.mjs`

**Interfaces:**
- Consumes: the `hit` hook (`null | { dmg, post, blocked }`), Task 3's `dive` and `crocReset`, `releaseHold()`.
- Produces: `crocNextMark(e) -> number`: `e.def.hp * (1 - 0.25 * (e.marks + 1))` while `e.marks < 3`, else 0. `e.marks`: marks passed, 0 to 3.

Rules: the hit hook caps `dmg` so `e.hp - dmg >= crocNextMark(e)` (posture unchanged), for every source including `dot` and executions. At the start of `step`, when `e.hp <= crocNextMark(e)` and the player is not executing it: `e.marks++`, a hold of its ends through `releaseHold()`, its attack is dropped, and it goes `dive` at once (part two will put the tunnel phase here). While the player is executing it, the mark waits for the execution to end.

- [ ] **Step 1: Write the failing tests in `tests/t25.mjs`**

- `"no hit passes a mark"`: on land at full health, `DF.hitEnemy(e, 500, 0, { heavy: true })`: `e.hp === 600`; same for a `dot` hit and a blast (`DF.explode`) from 600 + 1: hp stops at 600.
- `"a mark breaks off and dives"`: hit it to 600 mid-`wind` of `b1`: next step `e.marks === 1`, mode `dive` or `under`, no attack lands after.
- `"a mark ends the death roll"`: player held in the roll, crocodile brought to the 75% mark: the player is no longer `held` and has `HOLD.safe` of invulnerability.
- `"the marks fall at 75, 50 and 25 and then it can die"`: drive it through all three (surfacing each time), then a hit from 25% kills it; `G.bossDead`, D recorded as cleared (`DF.gradeCleared("D")`), the message shows `OLD SLUICEJAW FALLS`, no "new gate" message (C is not live).
- `"an execution at a mark"` (Review Focus 3): staggered at 610, executed: the execution's damage stops it at 600, the player's execute plays to its end, then it dives.

- [ ] **Step 2: Run and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`
Expected: FAIL (no cap).

- [ ] **Step 3: Implement `crocNextMark`, the hit hook and the mark in `step`.**

- [ ] **Step 4: Update the docs**

`CLAUDE.md`: a "The crocodile" bullet under Enemy behaviours (modes, `CROC`, the marks and their cap, the roll, what is left for part two), Testing gets `t25`, Known problems gets "The crocodile is untested by hand; every `CROC` number and its moveset were set without a playtest", the Where-the-project-stands paragraph and Backlog item 2 say part one is in and part two remains before D joins `LIVE_GRADES`. `README.md`: the D boss in a line.

- [ ] **Step 5: Run every suite**

Run: `node build.mjs && for t in t25 t24 t23 t22 t21 t20 t16 t12 t10 t6 t5; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || break; done; for t in t8 t18; do SCRIPT=$PWD/tests/$t.mjs node test.mjs hub || break; done`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/06b_ebeh.js tests/t25.mjs CLAUDE.md README.md
git commit -m "feat: Old Sluicejaw dives at each quarter of its health, and no hit passes a mark"
```
