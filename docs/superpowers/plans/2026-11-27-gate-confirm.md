# Gate confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An open hall gate asks "Enter gate E?" before the trip, and Stay out throws the player back out of the arch with a free dodge.

**Architecture:** Core (`06_game.js`) holds what is asked in `G.ask` and sets `G.state = "enter"`; the frame loop shows the screen, as it does for the win screen. `gateAnswer(yes)` in core does the trip or the throw, so tests and the host copy need no DOM. `09_main.js` owns the screen, its 0.35 s guard and the mouse lock.

**Tech Stack:** Plain JS concatenated by `build.mjs`, Playwright tests through `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-27-gate-confirm-design.md`

## Global Constraints

- Read `docs/notes/zones.md`, `coop.md`, `player.md`, `controller.md`, `touch.md` and `input.md` before editing their systems. `node build.mjs` after every source change.
- Files `01` to `06` are the co-op host copy: no DOM, and no name from a file of `07` on.
- A name is declared once across `src/`. `G.gate` is the exit gate; this feature uses `G.ask`, the state `"enter"` and `#scr-enter`.
- The heading is exactly `Enter gate E?` (the gate's letter). No second line. Buttons read `Enter` and `Stay out`.
- New per-run state is cleared in `resetRun()`.
- No Claude trailers in commits.

## Review Focus

- A dodge (Space) or attack click made as the player walks in must not answer: Space never answers, and nothing answers in the first 0.35 s. (Task 2 tests.)
- Walking in sideways or backwards: the throw is along the gate's `yaw`, not the player's facing, and lands outside the circle. (Task 1 test.)
- Esc cannot re-lock the mouse: after Esc, `G.noLock` stays false. (Task 2 test.)
- The world ends under the question (exit, co-op ending, world swap): the screen closes and `G.ask` is null. (Task 1 and 2 tests.)
- Co-op friend steps in: not asked, not thrown, told "Only the host can open a gate." once. (Task 3 test.)

---

### Task 1: Core ask and answer

**Files:**
- Modify: `src/06_game.js` (`G`, `resetRun`, the portal check at the end of `update`, new functions after `startTrans`)
- Modify: `src/06d_coophost.js` and `src/07c_coopclient.js` (the `NET` objects)
- Modify: `src/09_main.js` (`DF` only)
- Test: `tests/t8.mjs`, and every script that walks into a gate

**Interfaces:**
- Produces: `G.ask` (`{ grade, yaw }` or `null`), `G.askOff` (boolean, true from Stay out until the player is outside every open gate's circle), `gateAnswer(yes)` (no-op with no `G.ask`; clears it, sets `G.state = "play"` if it was `"enter"`, then `NET ? NET.onPortal(grade) : startTrans(grade)` or `startDodge(sin yaw, cos yaw, 1, true)` with `G.askOff = true`), `NET.asks()` (host copy: `false`; page: `coopLeads() && !CC.trip`), `DF.gateAnswer`.

- [ ] **Step 1: Failing tests in `tests/t8.mjs`** (new steps after "portal fires inside the arch"): "a gate asks first" (walk in: `G.ask.grade === "E"`, `G.state === "enter"`, still `hub`, no `G.trans`; more sim does not ask twice or travel); "Enter goes in" (`DF.gateAnswer(true)` then sim: cave, `G.ask === null`, `G.state === "play"`); "Stay out throws the player out" for every class (after `DF.gateAnswer(false)`: state `dodge`, `cam.yaw` and `p.yaw` and stamina unchanged, after 1 s outside the circle by more than 1 m and along the gate's `yaw`, `G.ask === null`, no trip); "thrown straight out when walked in sideways" (yaw and cam turned 90 degrees, same landing line); "no second question until the player has left" (after the throw `G.askOff` clears; walking back in asks again; a player put back in the circle while `askOff` holds is not asked); "a world swap under the question closes it" (`DF.enterHub()` with `G.ask` set: `G.ask === null`, `G.state === "play"`).
- [ ] **Step 2: Run** `node build.mjs && SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`. Expected: the new steps FAIL.
- [ ] **Step 3: Implement.** The check asks only when `!NET || NET.asks()`, the state is not `execute`, `blink`, `grapple`, `held` or `inspect`, and neither `G.ask` nor `G.askOff` is set; otherwise with `NET` it calls `NET.onPortal` as today. `resetRun` clears both and turns an `"enter"` state back to `"play"`.
- [ ] **Step 4: Existing scripts answer Enter** where they expected the trip: t8 (every `DF.sim` that walks in), t26, t27 (three), t28 (`walkIn`), coop-e2e (`walkE`). The friend's walk-ins stay as they are.
- [ ] **Step 5: Run** t8, t9, t22 (`hub`/`smoke` as their headers say), t26, t26-build. Expected: all pass.
- [ ] **Step 6: Commit** `feat: a hall gate asks before it is entered`.

### Task 2: The screen

**Files:**
- Modify: `index.tpl.html` (`#scr-enter` after `#scr-pause`: `h1#enterQ`, a `.row` with `#btnEnter` (`data-padfirst`) and `#btnStay`)
- Modify: `src/09_main.js` (`SCREENS`, `show`, `play(lock = true)`, `enterAnswer(yes, lock = true)`, the frame loop, the key handler, the button clicks, `DF`)
- Modify: `src/08d_pad.js` (B on the screen clicks `#btnStay`), `src/08c_touch.js` (Back is Stay out)
- Test: `tests/t8.mjs`

**Interfaces:**
- Consumes: `G.ask`, `gateAnswer(yes)` from Task 1.
- Produces: `enterAnswer(yes, lock = true)`: does nothing unless `G.state === "enter"` and 350 ms (`ENTER_GUARD`, `performance.now()`) have passed since the screen opened; else `gateAnswer(yes)` then `play(lock)`. `play(false)` skips `lockPointer()`. `DF.enterAnswer`.

- [ ] **Step 1: Failing tests in `tests/t8.mjs`** (async steps that let frames run): the screen shows with heading `Enter gate E?` (and `D` for gate D), two buttons with those labels, no `.sub`, and fits the viewport; an answer inside 350 ms does nothing and after it works; a Space keydown does not answer; an Enter keydown enters; an Esc keydown stays out with `G.noLock === false`; a click on `#btnStay` throws the player out and `#scr-enter` is hidden; a pad B tap (`DF.taps["P:1"]` with `PAD.poll`) stays out; `DF.toTitle()` under the question leaves no screen but the title. Shot `t8-enter`.
- [ ] **Step 2: Run** t8. Expected: the new steps FAIL.
- [ ] **Step 3: Implement.** The frame loop shows `"enter"` when the state says so and hides it when the state is `"play"` again. The HUD stays up under it. Esc calls `enterAnswer(false, false)`.
- [ ] **Step 4: Run** t8, t9, t30 (desktop and `DEVICE=iphone-se`), t16, t17, t13, `DEVICE=iphone-se` t8 for the shot. Look at `shots/t8-enter.png` and `shots/iphone-se-t8-enter.png`.
- [ ] **Step 5: Commit** `feat: the gate's question is a screen with Enter and Stay out`.

### Task 3: Co-op

**Files:**
- Test: `tests/t28.mjs` (the party-rules steps), `tests/coop-e2e.mjs`

- [ ] **Step 1: Tests.** t28: the host's page walking in is asked, the hall runs on under it, Enter travels both, Stay out throws the host out and no `travel` is asked (`h.S.epoch` unchanged); the friend's existing "Only the host can open a gate." step also checks `G.ask === null` and that it is not thrown (still in the circle). 
- [ ] **Step 2: Run** t27, t28, t29, coop-host, coop-wire, coop-e2e, coop-caves, coop-warden, t32. Expected: pass.
- [ ] **Step 3: Commit** `test: the gate's question in co-op`.

### Task 4: Notes

**Files:**
- Modify: `docs/notes/zones.md` (portals bullet, `G.state` list, `resetRun`, tests), `docs/notes/coop.md` (`NET.asks`, the party rules), `docs/notes/controller.md`, `docs/notes/touch.md`, `README.md` (test table row for t8)

- [ ] **Step 1: Write the notes**, in the commits of the code they describe where possible.
- [ ] **Step 2: Full run** of every script in the tables of `CLAUDE.md` for zones, co-op, controller and touch.
