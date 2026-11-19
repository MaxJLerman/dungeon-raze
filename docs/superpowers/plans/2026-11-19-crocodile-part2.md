# Crocodile Part Two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Old Sluicejaw: at each 25% mark it leaps into the wall tunnels and throws spiked plates that a parry sends back to knock it down; below half health the ceiling drops rubble; bloaters wash down the falls; its shadow shows under the light shafts; then D opens.

**Architecture:** Everything stays in the crocodile's hooks in `src/06b_ebeh.js` and its effects in `src/07b_dfx.js`, with two small shared seams: an `e.aloft` flag (a body up in the wall that only shots can reach) honoured wherever `e.hidden` is, except the player's shot hit loop and `aimRanged`; and a `plate` option that `projUpdate` passes to `hitEnemy`. A new mode `tunnel` (with a `leap` into it and a `drop` out of it) replaces part one's dive at a mark.

**Tech Stack:** Plain JavaScript concatenated into one page (`node build.mjs`), own WebGL renderer, headless Chromium tests through `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-19-crocodile-boss-design.md`, the part two sections: "The tunnel phase", "The falling ceiling", "Bloaters down the falls", "The shadow", "Winning". `CLAUDE.md` describes part one's modes, `CROC`, the roll and the marks.

## Global Constraints

- All `src/*.js` share one scope: declare each name once. `node build.mjs` after every source change.
- No dependencies, no network, everything generated in code.
- E's cave, enemies and tests do not change; t22's hashes all hold (no generation changes in this plan).
- Every shared change is a no-op for every type that never sets the new flag or option.
- Every way of targeting an enemy skips `fall`, `hidden` and now `aloft` (but for the player's shots and `aimRanged`); `safe` is not a target for damage.
- No hit takes it past the next mark. In one tunnel phase, damage from every source totals at most `CROC.tunCap` (100, about half a quarter of 800); damage past that is lost. The cap holds after every multiplier (through `crocFloor`, which both the `hit` hook and `hpFloor` read).
- Only a parried plate knocks it out of a tunnel. Without one it throws all its plates and drops back into the water unhurt.
- Plates per tunnel: 1 or 2 in the phase from the 75% mark, 1 to 4 from the 50% and 25% marks; tunnels visited 1 to 4 (at most the number of mouths), each count random.
- The falling ceiling starts at the 50% mark, lands only on the dry ring, never in water or on the entrance crossing, hurts the player and never the crocodile, and at most `CROC.rockCap` heaps stand at once.
- D joins `LIVE_GRADES` in Task 5 and not before.
- Commits: plain messages, no `Co-Authored-By` or `Claude-Session` trailers. Never commit `shots/`, `new-names.txt` or `tests/codes.local.*`.
- Update `CLAUDE.md` in each task for what it adds.

## Review Focus

1. The player leaves the cavern or dies mid tunnel phase, with plates in flight and rubble standing: the crocodile resets (back to `wait`, `y` 0, not aloft), its rubble is removed, fall bloaters are gone, no plate hurts after (Task 1, Task 3, Task 4).
2. A plate parried after the crocodile has left that mouth, or a second plate parried in the same phase: a knock-down happens only while it is at the mouth the plate came from, and once per phase (Task 2).
3. A ranged class shooting it throughout a tunnel phase with every multiplier (berserk, backstab): the phase's total is `CROC.tunCap` at most and the next mark is never passed (Task 2).
4. A class tool aimed at it in a tunnel (grapple, lock, rifts and Drop, a Sapper cave-in at the far wall, melee from the fall pool under the mouth, a blast): nothing reaches it but shots (Task 1).
5. Rubble lands where the crocodile wants to surface, roll the player to or climb out: it never stands inside rock and the player is pushed clear of a heap that lands on them (Task 3).

---

### Task 1: The tunnel phase: leap, mouths, plates, drop

**Files:**
- Modify: `src/06b_ebeh.js` (`CROC` additions, the mark branch, modes `leap`, `tunnel`, `drop`, `crocReset`)
- Modify: `src/06_game.js` (the `aloft` skips; the lock drop)
- Modify: `src/05b_dbodies.js` (the throw pose at a mouth), `src/07b_dfx.js` (`drawMouths`)
- Modify: `src/09_main.js` (exports)
- Test: `tests/t25.mjs`

**Interfaces:**
- Consumes: `w.wallTunnels` (`{ x, y, z, yaw }`, 3 to 5, on the far wall, `y` 5, `yaw` facing the cavern's centre); `crocNextMark`, `crocFloor`, `crocUnder`, `releaseHold`, `G.projs` and `shoot` as the pattern for an enemy shot.
- Produces:
  - `CROC.leapT: 0.8, mouthIn: 1, mouthWarn: 1, throwWind: 0.5, throwGap: 1.2, linger: 1, plateSpeed: 15, plateDmg: 14, tunCap: 100, dropT: 0.6`.
  - `e.aloft`: true while it is in a tunnel mode. Shared rule: every place that skips `e.hidden` skips `e.aloft` too (grep `e.hidden` in `src/06_game.js` and `src/06b_ebeh.js`: lock, `aimYaw`, the melee loop, `explode`, Starfall, mines and wires, clouds, eel shocks, `separate`, rifts and Drop, the relock, `grappleTarget`, `nearestStaggered`, blink, the reach tear, the lock drop), except the player's shot hit loop in `projUpdate` and `aimRanged`.
  - Modes: `leap` (it flies from where it stands to the first mouth over `CROC.leapT`, `safe`); `tunnel` with `e.tun = { list: [mouth indices], k, n, sub, t, plates, hp0, knocked }`, sub `warn` (hidden in the wall, the next mouth warns for `CROC.mouthWarn`), `show` (at the mouth, aloft, throwing), then the next mouth; `drop` (from the last mouth into the fall pool under it over `CROC.dropT`, then `crocUnder`).
  - At a mouth its position is the mouth pulled `CROC.mouthIn` toward the cavern's centre, `e.y = mouth.y`, facing the player.
  - `crocMouthPlan(e, w) -> { list, n }`: the mouths to visit in order (distinct, random, count 1 to 4, at most the number of mouths) and plates per mouth (`n[k]`: 1 or 2 when `e.marks === 1`, else 1 to 4).
  - Plates: real enemy shots in `G.projs` (`own: "e"`, `src: e`, `kind: "plate"`, `plate: true`, `dmg: CROC.plateDmg`, speed `CROC.plateSpeed`, parryable and blockable), thrown after a `CROC.throwWind` tail whip, `CROC.throwGap` apart, aimed at the player; drawn falling from the mouth's height to chest height along their flight. It stays at a mouth until `CROC.linger` after its last plate there.
  - The mark branch (part one's `crocDive(e, w, true)`) now starts `leap`, keeping everything else it does (marks, release a hold, drop the attack, empty a stagger's posture). Part one's dive after the land clock is unchanged.
  - `drawMouths`: during `warn`, a surge of foam pouring from the next mouth and two glowing eyes in it.
  - `crocReset` clears all of it (`aloft`, `y`, `e.tun`).

- [ ] **Step 1: Write the failing tests in `tests/t25.mjs`**

On a D run, seed 5, the fight begun, the crocodile brought to land and then hit to 600.
- `"a mark leaps into a tunnel"`: within `CROC.leapT` + 0.1 s it is in mode `tunnel`, at a mouth of `w.wallTunnels` (within `CROC.mouthIn` + 0.05 of the pulled-in point), `e.y` equal to the mouth's `y`, `e.aloft`.
- `"plates per tunnel follow the mark"`: 200 calls of `crocMouthPlan` with `marks` 1 give every `n[k]` in 1..2 and `list.length` in 1..min(4, mouths); with `marks` 2 and 3, `n[k]` in 1..4, and every value seen at least once.
- `"it throws real plates at the player"`: over the phase, every plate is in `G.projs` with `own "e"`, `kind "plate"`, `src` the crocodile; a passive player standing still in the open takes `CROC.plateDmg` per plate that reaches them (or the block result while guarding).
- `"the next mouth warns first"`: before it shows at mouth k > 0 there is a `warn` of `CROC.mouthWarn` during which it is hidden; `drawMouths` draws without error.
- `"no parry: it drops back unhurt"`: a player who never parries: after the last plate it goes `drop` then `under`, with health unchanged by the phase, `aloft` false, `y` 0.
- `"nothing but shots reaches it up there"` (Review Focus 4): at a mouth, the player in the fall pool under it: melee (`DF.taps` light attack while facing it), `DF.explode` on it, a grapple, `pickLock`, `aimYaw`, a Drop and a mine under it leave its health unchanged and it is never the lock; `separate` does not push the player.
- `"leaving mid phase resets it"` (Review Focus 1): player moved out of the cavern while a plate is in flight: it is in `wait`, `aloft` false, `y` 0, and the plate (which still flies) is the only thing left.
- Screenshots `t25-mouth-warn.png` (the warning at a mouth) and `t25-mouth-throw.png` (it at a mouth, mid whip, a plate in the air).

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`
Expected: FAIL (a mark still dives).

- [ ] **Step 3: Implement the `aloft` rule, `CROC` additions, `crocMouthPlan`, the modes, the plates, the throw pose and `drawMouths`.** Export `crocMouthPlan` and `CROC` on `DF`.

- [ ] **Step 4: Run the suites**

Run: `node build.mjs && for t in t25 t24 t22 t21 t20 t6 t12; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || break; done`
Expected: all PASS. Look at both shots.

- [ ] **Step 5: Commit**

```bash
git add src/06b_ebeh.js src/06_game.js src/05b_dbodies.js src/07b_dfx.js src/09_main.js tests/t25.mjs CLAUDE.md
git commit -m "feat: at each mark Old Sluicejaw leaps into the wall tunnels and throws spiked plates"
```

### Task 2: Shots, the tunnel cap and the parry knock-down

**Files:**
- Modify: `src/06b_ebeh.js` (`crocFloor`, the `hit` hook, the knock-down)
- Modify: `src/06_game.js` (`projUpdate` passes `plate: !!pr.plate` in the options of its `hitEnemy` call and keeps `pr.plate` through the reflect)
- Test: `tests/t25.mjs`

**Interfaces:**
- Consumes: Task 1's `tunnel` mode and `e.tun`; the existing reflect (a parried enemy shot becomes the player's and flies toward its `src` at 24 m/s).
- Produces: `crocFloor(e)` in `tunnel`, `leap` and `drop`: `max(crocNextMark(e), e.tun.hp0 - CROC.tunCap)` where `hp0` is its health when the phase began. The `hit` hook: a hit with `o.plate` while it is at the mouth that plate was thrown from and the phase has not been knocked yet knocks it down: `e.tun.knocked = true`, it falls over `CROC.dropT` from the mouth to the nearest dry footing point of the ring below (`crocDry` from the foot of the mouth), lands staggered (`stagger(e)`), `aloft` false, `y` 0, mode `land` with `e.landT = CROC.land`. Each plate records the mouth it came from (`pr.mouth`).

- [ ] **Step 1: Write the failing tests in `tests/t25.mjs`**

- `"shots hurt it at a mouth"`: a player shot (`G.projs` with `own "p"`) aimed at it at a mouth lowers its health; the same shot with it in `warn` (hidden) passes on.
- `"a tunnel phase takes at most tunCap"` (Review Focus 3): berserk on, shots every step through a whole phase: total health lost in the phase is at most `CROC.tunCap` and never below the next mark; the next phase's total starts again from 0.
- `"a parried plate knocks it down"`: the player guards with a fresh parry as a plate arrives (`p.guardT` within `p.parryWin`): the plate turns `own "p"`, flies back, and within 2 s the crocodile is in `land`, staggered, `y` 0, on dry floor of the ring, `e.tun.knocked`.
- `"one knock-down per phase and only at its mouth"` (Review Focus 2): a reflected plate that arrives after it moved on to the next mouth does not knock it down; a second parried plate in the same phase after a knock-down changes nothing.
- `"knocked down, the land fight carries on"`: after the stagger it fights on land (it can be executed: `nearestStaggered` finds it) and later dives on its land clock as in part one.

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`
Expected: FAIL.

- [ ] **Step 3: Implement the floor, the `plate` option, `pr.mouth` and the knock-down.**

- [ ] **Step 4: Run the suites**

Run: `node build.mjs && for t in t25 t24 t6 t22; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || break; done`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/06b_ebeh.js src/06_game.js tests/t25.mjs CLAUDE.md
git commit -m "feat: a parried plate knocks Old Sluicejaw out of its tunnel, and shots there are capped"
```

### Task 3: The falling ceiling

**Files:**
- Modify: `src/06b_ebeh.js` (`CROC` additions, `G.chunks`, `crocChunkSpot`, the fall in `step`)
- Modify: `src/06_game.js` (`resetRun` and `respawn` clear `G.chunks`)
- Modify: `src/07b_dfx.js` (the dust warning), `src/07_render.js` (draw heaps as the cave-in rubble is drawn)
- Test: `tests/t25.mjs`

**Interfaces:**
- Consumes: `w.addRock(ax, az, bx, bz, r) -> id`, `w.removeRock(id)`; `e.marks`; `crocReset`.
- Produces: `CROC.fallEvery: [6, 10], fallWarn: 1.4, fallR: 1.6, fallDmg: 20, rockR: 1.4, rockCap: 5`. `G.chunks`: `[{ x, z, t, id }]`, `t` counting down the warning, `id` the rock once it lands. `crocChunkSpot(e, w, p) -> { x, z } | null`: a point 3 to 8 m from the player inside the cavern with `waterAt` 0 within `CROC.rockR` of it, `fieldAt >= CROC.rockR + 0.5`, at least 4 m from the entrance crossing (the dry gap in the moat at the entrance), at least `e.r + CROC.rockR` from the crocodile and at least `2 * CROC.rockR` from every standing heap; `null` when none of 40 tries fits.

Rules: while the fight is on and `e.marks >= 2`, every random `CROC.fallEvery` it drops a chunk at `crocChunkSpot`. After `CROC.fallWarn` the rock lands (`addRock` as a short capsule of radius `CROC.rockR`); a player within `CROC.fallR` takes `CROC.fallDmg` through `hurtPlayer` (unblockable, a dodge's invulnerability avoids it) and `w.resolve` pushes them clear. It never hurts an enemy. A sixth heap removes the oldest. `crocReset` and the crocodile's death leave heaps that have landed for the death and remove them for a reset; `resetRun`/`respawn` clear the list.

- [ ] **Step 1: Write the failing tests in `tests/t25.mjs`**

- `"no ceiling before half health"`: marks 0 and 1 for 30 s: `G.chunks` stays empty.
- `"chunks fall on the dry ring with a warning"`: marks 2, 60 s: every chunk's spot is dry, not in water, not on the entrance crossing; each lands `CROC.fallWarn` after it appears; after landing `fieldAt` at its centre is below 0 (rock).
- `"a chunk hurts the player, not the crocodile"`: a chunk forced on the player: hp drops by `CROC.fallDmg`, the player ends outside the rock; a chunk forced beside the crocodile: its health unchanged.
- `"at most rockCap heaps"`: after 8 landings, 5 rocks stand and the oldest went first.
- `"rubble never traps it"` (Review Focus 5): heaps on its next surfacing spot, its roll target and its climb-out: it never stands where `fieldAt < e.r` (sampled every step over 60 s), the player never inside rock.
- `"leaving clears the rubble"` (Review Focus 1): with 3 heaps, the player leaves: `G.chunks` empty and every rock removed (`fieldAt` back to the base there).
- Screenshot `t25-ceiling.png` (a dust warning and a landed heap).

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`
Expected: FAIL.

- [ ] **Step 3: Implement the chunks, the dust warning and the heaps.**

- [ ] **Step 4: Run the suites**

Run: `node build.mjs && for t in t25 t20 t22 t24; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || break; done`
Expected: all PASS. Look at the shot.

- [ ] **Step 5: Commit**

```bash
git add src/06b_ebeh.js src/06_game.js src/07b_dfx.js src/07_render.js tests/t25.mjs CLAUDE.md
git commit -m "feat: below half health the cavern's ceiling falls in on the ring"
```

### Task 4: Bloaters down the falls, and the shadow

**Files:**
- Modify: `src/06b_ebeh.js` (`CROC` additions, the bloater drop in `step`, `crocReset`)
- Modify: `src/06_game.js` (`e.arena` on an instance: `huntOver` and `alertE` let it hunt in the boss chamber)
- Modify: `src/07b_dfx.js` (the shadow in `drawWakes`)
- Test: `tests/t25.mjs`

**Interfaces:**
- Consumes: `EDEF.bloater`, `makeEnemy`, `waterFoot`, `w.wallTunnels`, `w.shafts` (`{ x, z, r, top }`).
- Produces: `CROC.bloatEvery: 14, bloatCap: 2`. A fall bloater is a normal bloater made at a water point of the fall pool under a random mouth where `waterFoot` holds for it, with `e.arena = true` and `e.fromFall = true`, made aware at once. Instance flag `e.arena`: `huntOver` ignores `G.inBoss` for it and `alertE` does not refuse it in the boss chamber; no other type sets it. While the fight is on (any mode but `wait`), every `CROC.bloatEvery` one comes down if fewer than `CROC.bloatCap` fall bloaters live. `crocReset` removes every fall bloater from `G.enemies` (no cloud, no reward). Its cloud already hurts the crocodile through the `hit` hook and the floor.
- The shadow: while `under`, when it is within a shaft's `r` of the shaft's centre, `drawWakes` draws a dark elongated blob (`R.blob`) along its heading at its position.

- [ ] **Step 1: Write the failing tests in `tests/t25.mjs`**

- `"bloaters wash down the falls"`: fight on for 40 s: fall bloaters appear in fall pools (within 6 m of the far wall, in water), never more than `CROC.bloatCap` alive, each aware and hunting while the player is in the cavern.
- `"a cloud beside it hurts it"`: a fall bloater killed beside the surfaced crocodile on land: the crocodile loses health over the cloud's ticks, never past its floor.
- `"leaving removes them"` (Review Focus 1): player leaves: no fall bloater in `G.enemies`, no cloud made.
- `"its shadow shows under a shaft"`: crocodile `under` moved under a shaft: one more blob is drawn that frame than with it out of every shaft (count `R.blob` calls by wrapping it in the test).
- Screenshot `t25-shadow.png`.

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t25.mjs node test.mjs smoke`
Expected: FAIL.

- [ ] **Step 3: Implement the drop, `e.arena` and the shadow.**

- [ ] **Step 4: Run the suites**

Run: `node build.mjs && for t in t25 t24 t23 t12 t22; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || break; done`
Expected: all PASS. Look at the shot.

- [ ] **Step 5: Commit**

```bash
git add src/06b_ebeh.js src/06_game.js src/07b_dfx.js tests/t25.mjs CLAUDE.md
git commit -m "feat: bloaters wash down the falls, and Old Sluicejaw's shadow shows under the shafts"
```

### Task 5: D opens

**Files:**
- Modify: `src/03b_hub.js` (`LIVE_GRADES` gains `"D"`)
- Modify: `tests/t8.mjs` (the sealed-frames step: E and, once E is cleared, D open; C, B, A, S sealed), `tests/t22.mjs` (its add and delete of D around runs stays harmless with D live)
- Modify: `CLAUDE.md`, `README.md`
- Test: `tests/t8.mjs`, `tests/t22.mjs`, `tests/t25.mjs`

**Interfaces:**
- Consumes: `portalOpen(grade)`, `clearGrade`, `CLEARED`.
- Produces: the D portal opens in the hall for a player whose save has E cleared, and leads to the sewer.

- [ ] **Step 1: Write the failing tests**

- t8 `"D opens once E is cleared"`: with nothing cleared only E is open; after `DF.clearGrade("E", cls)` and a rebuilt hall, D's frame is open and stepping into it starts a run with `G.grade === "D"` and a sewer world; C, B, A and S stay sealed.
- t25 `"a full D run ends at the crocodile"`: from the hall with E cleared, through the D portal, the crocodile killed (by `hitEnemy` through its marks, skipping the waits): `DF.gradeCleared("D")`, the gate out opens, the message says `OLD SLUICEJAW FALLS`.

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`
Expected: FAIL (D sealed).

- [ ] **Step 3: Add `"D"` to `LIVE_GRADES` and update t22's handling if needed.**

- [ ] **Step 4: Update the docs**

`CLAUDE.md`: the project-stands paragraph (D is open: E's boss kill opens it), the crocodile section (part two in: tunnels, plates, ceiling, fall bloaters, shadow, `aloft`, `e.arena`, `plate`), the zones section's `LIVE_GRADES` lines, the "Open another portal" recipe's D example, Known problems (every new `CROC` number set without a playtest; D is now on the published page untested by hand), Backlog item 2 (D done; C next). `README.md`: D is playable.

- [ ] **Step 5: Run every suite**

Run: `node build.mjs && for t in t25 t24 t23 t22 t21 t20 t16 t12 t10 t6 t5; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || break; done; for t in t8 t18 t9; do SCRIPT=$PWD/tests/$t.mjs node test.mjs hub || break; done`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/03b_hub.js tests/t8.mjs tests/t22.mjs tests/t25.mjs CLAUDE.md README.md
git commit -m "feat: the D gate opens once E's boss is dead"
```
