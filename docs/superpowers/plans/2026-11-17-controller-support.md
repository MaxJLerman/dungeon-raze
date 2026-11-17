# Controller Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The whole game, play and every menu, works from an Xbox, DualSense or other standard controller, with rebindable Soulslike buttons, pad button names in prompts, rumble, and a setting that hides the touch buttons while a pad is connected.

**Architecture:** A `PAD` controller in a new file reads `navigator.getGamepads()` once per frame. It writes pad buttons into `keys` and `taps` as `P:0` to `P:17`, and `held`/`hit` read them through a new `PAD_BIND` table beside `BIND` and the touch `T:` keys. The left stick fills `PAD.move` as the touch stick fills `TOUCH.move`. The right stick turns the camera inside `PAD.poll`. Outside play, `PAD.poll` moves focus between menu controls by direction.

**Tech Stack:** Plain JavaScript (ES2020), Gamepad API, CSS. Tests use Playwright with headless Chromium, with `navigator.getGamepads` replaced by a fake.

**Spec:** `docs/superpowers/specs/2026-11-17-controller-support-design.md`. Read it and `CLAUDE.md` before starting.

## Global Constraints

- All `src/*.js` files share one function scope. No imports or exports. Declare each name once across `src/`.
- No dependencies, nothing loaded at run time except Google Fonts. Run `node build.mjs` after every source change. `dist/` is not committed.
- Keyboard, mouse and touch play are unchanged. `tests/t2.mjs` to `tests/t15.mjs` are not edited and must still pass.
- Every call to fullscreen, pointer lock, audio or vibration made from a pad press is tried and its refusal caught. A `getGamepads` that is missing or throws switches pad support off with no error.
- Work on branch `feat/controller-support`. Commits carry no `Co-Authored-By` or session trailers.
- Screenshots are looked at, not assumed.
- Default `PAD_BIND`: `light P:5`, `heavy P:7`, `guard P:4`, `special P:6`, `dodge P:1`, `sprint P:10`, `lock P:11`, `heal P:2`, `tool P:3`, `mute null`. `fwd`, `back`, `left`, `right` have no pad entry (left stick).
- Fixed pad buttons: `P:9` pauses in play and resumes from pause. In menus, D-pad (`P:12` up, `P:13` down, `P:14` left, `P:15` right) or left stick moves focus, `P:0` presses and `P:1` goes back. Bindable codes are `P:0`–`P:8`, `P:10`–`P:15`, `P:17`.
- Triggers (`P:6`, `P:7`) count as pressed only when `value > 0.5`. Other buttons count when `pressed`.
- Stick dead zone: radial 0.2, the rest rescaled to 0..1. Camera: squared response, full deflection turns 3.0 rad/s across and 1.8 rad/s up and down at `OPT.psens` 1. Pitch is clamped to -0.3..1.15 as in `camUpdate`.
- Sprint latch: a tap of the pad sprint binding turns `PAD.sprint` on, or off if it was on. It clears when `PAD.move.mag` is 0 or stamina is at or below 0. With the pad stick moving, the player runs only while `PAD.move.mag >= 0.6`.
- Lock flick: while locked, right stick x past 0.7 after the stick was inside the dead zone sets `mouse.wheel = Math.sign(x)`, once per flick.
- Menu repeat: first move on press, repeat after 0.35 s, then every 0.12 s.
- New options and their ranges: `OPT.psens` 0.2–3 (default 1), `OPT.padHideTouch` boolean (default true), `OPT.rumble` boolean (default true). Saved in `o`. `PAD_BIND` is saved under `p` in `dungeon-raze.v2`.
- Rumble table (`dual-rumble`, ms, strong, weak): `hurt` 160, 0.7, 0.4; `gbreak` 260, 1.0, 0.6; `parry` 90, 0, 0.9; `heavy` 90, 0.5, 0.3; `execute` 220, 0.8, 0.5; `death` 500, 1.0, 1.0.
- Pad names, Xbox: `A B X Y LB RB LT RT View Menu LS RS` for 0–11, `D-pad up`, `D-pad down`, `D-pad left`, `D-pad right` for 12–15, `Share` for 17. PlayStation: `✕ ○ □ △ L1 R1 L2 R2 Create Options L3 R3`, the same D-pad names, `Touchpad` for 17. `null` is `Unbound`.
- A pad is PlayStation when its `id` matches `/054c|dualsense|dualshock|wireless controller/i`.
- Copy, exactly:
  - Controls section heading: `Controller`
  - `Camera speed (stick)`
  - `Hide touch buttons while a controller is connected`
  - `Vibration`
  - `Press a controller button`
  - Movement rows in the Controller column: `Left stick`
  - Pad mode instructions in Controls: `Choose a controller binding with ✕ or A, then press the button you want. Options or Menu cancels.`
  - Unrecognised pad note: `This browser doesn't fully recognise your controller, so buttons may be mixed up. Rebind them below. Chrome and Edge recognise the most controllers.`

## Review Focus

1. **A connected pad lying on the table.** Stick drift under the dead zone must not switch prompts to pad names, walk the player or turn the camera while someone plays with the keyboard. Task 1, step "an idle drifting pad changes nothing".
2. **A pad unplugged while a button is held.** The held action must not stay stuck on after the pad is gone. Task 3, step "unplugging while guarding leaves nothing held".
3. **Two pads, one idle.** Steam and some drivers add a duplicate virtual pad. The idle pad's centred sticks must not cancel the other's movement. Task 2, step "an idle second pad does not cancel movement".
4. **A menu button bound to a play action.** With Attack rebound to A/Cross and dodge moved off B/Circle, A still presses in menus and B still goes back. Task 5, step "menu buttons keep working after rebinding".
5. **The pad's first press.** The browser shows a pad only once a button is pressed. That press, for example R1 mid-fight, must still count. Task 1, step "the first press of a new pad counts".

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/08d_pad.js` | Create | `PAD` controller: reading pads, codes, sticks, camera, latch, flick, mode, menu focus, pad rebinding, pause rules, rumble, `padName` |
| `src/06_game.js` | Modify | `DEFAULT_PAD`, `PAD_BIND`, `setPadBind`, `PAD_CODES`; `held`/`hit` read pad codes; `keyName` names `P:` codes; `OPT` fields, save and load; pad movement and sprint in `playerUpdate`; rumble hooks |
| `src/08_hud.js` | Modify | Hint line and Execute prompt with pad names |
| `src/08c_touch.js` | Modify | Hide buttons and stick under `padHideTouch`, skip them in `classify` |
| `src/09_main.js` | Modify | `frame` calls `PAD.poll`; `play()` pad branch; Esc/P pause without lock; fullscreen-exit pause on desktop; three-way `both`; Controller column and settings; `DF` exports |
| `index.tpl.html` | Modify | Controller settings markup, `.padonly`, `.lk-pad`, `.padfocus`, `body.pad`, `body.padc`, `body.padhide` CSS, How to play pause name |
| `tests/t16.mjs` | Create | Pad behaviour on the desktop page (`smoke`) |
| `tests/t17.mjs` | Create | Pad with touch on a phone (`DEVICE=oneplus-13 ... smoke`) and screenshots |
| `CLAUDE.md`, `README.md` | Modify | Pad input section, tests, known problems |

## Test conventions

- `t16` and `t17` use the `step(name, body)` helper pattern of `tests/t10.mjs`: each step is an async `eval` that sets `G.manual = true` and returns `{ pass, ... }`.
- The prelude of every step defines:
  - `mk(o)` builds a fake pad: `{ id: o.id || "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)", index: o.index || 0, connected: true, mapping: o.mapping ?? "standard", timestamp: performance.now(), buttons: 18 × { pressed: v > 0.1, value: v } from `o.b` (map of index to value), axes: o.axes || [0, 0, 0, 0], vibrationActuator: { playEffect(t, e) { window.__rumble.push([t, e]); return Promise.resolve("complete"); } } }`.
  - `pads(...list)` sets `window.__pads = list` and defines `navigator.getGamepads` once with `Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => window.__pads })`.
  - `tick(n = 1)` runs `DF.sim(n / 60, () => { DF.PAD.poll(1 / 60); })`.
  - `draw()` waits two animation frames, as in `t10`.
  - `reset()` restores `DF.PAD_BIND` to defaults, sets `OPT` pad fields to defaults, `window.__rumble = []`, `pads()`, `tick()`, `DF.PAD.setActive(false)`.
- While `G.manual` is set, `frame` does not call `PAD.poll`. Tests call it themselves, so results don't depend on real frame timing.
- Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`. Expected last line: `all passed`.

---

### Task 1: Pad buttons reach actions

**Files:**
- Create: `src/08d_pad.js`, `tests/t16.mjs`
- Modify: `src/06_game.js` (bindings block, lines 71–123), `src/09_main.js` (`frame`, `DF`)

**Interfaces:**
- Produces:
  - `DEFAULT_PAD`: an object mapping action to code or `null`.
  - `PAD_BIND`: the live copy of `DEFAULT_PAD`.
  - `PAD_CODES`: the array of bindable codes.
  - `PAD.poll(dt)`: reads pads, sets `keys["P:i"]` while a button is down and `taps["P:i"]` on its press edge.
  - `PAD.active`: true when the pad was the last input. `PAD.setActive(v)` sets it and toggles `body.pad`.
  - `PAD.connected`: true while a pad that has been seen is still listed. It toggles `body.padc`.
  - `PAD.std`: true when every listed pad has `mapping === "standard"`.
  - `PAD.fam`: `"xbox"` or `"ps"`, taken from the last pad pressed.
  - `PAD.pads()`: the list of connected pads, or `[]` when `getGamepads` is missing or throws.
  - `held(a)` and `hit(a)` also read `PAD_BIND[a]`.
  - `DF.PAD`, `DF.PAD_BIND`, `DF.DEFAULT_PAD`.

- [ ] **Step 1: Write the failing tests in `tests/t16.mjs`**
  - `default bindings`: for each action in `DEFAULT_PAD`, press its button for one tick and check `hit(action)` fires through the game. Observe it through `DF.keys[code] === true` and `DF.taps` being set before the sim's clear. Also check `JSON.stringify(DF.PAD_BIND) === JSON.stringify(expected)` with the Global Constraints table.
  - `triggers need half travel`: button 7 at value 0.4 with `pressed: true` gives `keys["P:7"]` false. At 0.6 it gives true.
  - `a pad press makes the pad active`: after a press, `PAD.active === true` and `document.body.classList.contains("pad")`. A keydown `KeyW` dispatched on `window` makes it false. So does a `mousemove` with `movementX: 5`, and a `pointerdown` with `pointerType: "touch"`.
  - `the first press of a new pad counts`: `pads()`, `tick()`, then `pads(mk({ b: { 5: 1 } }))` with one `tick()`. `taps["P:5"]` was seen in that tick, so the player is in `attack` after `tick(2)` in a cave room.
  - `an idle drifting pad changes nothing`: with `axes [0.15, -0.12, 0.18, 0.1]` and `DF.keys[DF.BIND.fwd] = true` for 60 ticks, `PAD.active === false`, `cam.yaw` is unchanged and the player moved forward by keyboard.
  - `a pad that can't be read`: `getGamepads` throws a `SecurityError`. `tick(5)` raises no error and `PAD.connected === false`. Also delete it (`value: undefined`): no error.
  - `family`: `id` with `054c` gives `PAD.fam === "ps"`. The default `id` gives `"xbox"`.
  - `standard mapping`: `mapping: ""` gives `PAD.std === false`.

- [ ] **Step 2: Run and see the steps fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`
Expected: `FAIL` lines, `threw` showing `DF.PAD` undefined.

- [ ] **Step 3: Add `DEFAULT_PAD`, `PAD_BIND` and `PAD_CODES` beside `BIND` in `src/06_game.js`, and extend `held` and `hit`**

`hit` reads all three taps so all are consumed, the way it reads both now. A `null` binding is skipped.

- [ ] **Step 4: Create `src/08d_pad.js` with `PAD` and `PAD.poll(dt)`**

`poll` merges buttons from all listed pads. A button pressed on any pad counts. The press edge is per code, against last poll's merged state. Any press edge, or any stick past 0.5 after the dead zone, calls `setActive(true)` and records `fam` from that pad. `init()` registers the `keydown`, `mousemove` and touch `pointerdown` listeners that call `setActive(false)`. The keydown listener uses the same exclusions as `08c_touch.js` lines 413–420. The `mousemove` listener ignores events with zero movement. Call `PAD.init()` from `boot()` after `TOUCH.init()`. `frame` calls `PAD.poll(dt)` first, unless `G.manual`.

- [ ] **Step 5: Run and see them pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`
Expected: `all passed`.

- [ ] **Step 6: Commit**

```bash
git add src/06_game.js src/08d_pad.js src/09_main.js tests/t16.mjs
git commit -m "feat: read controller buttons as bound actions"
```

### Task 2: Sticks, camera, sprint latch and lock flick

**Files:**
- Modify: `src/08d_pad.js`, `src/06_game.js` (`playerUpdate` input block around 2081–2113, `free` case around 2182), `src/09_main.js` (sensitivity UI comes in Task 5), `tests/t16.mjs`

**Interfaces:**
- Consumes: `PAD.poll` from Task 1.
- Produces:
  - `PAD.move`: `{ x, y, mag }`, where `y` is positive for forward (stick up) and `x` positive for right.
  - `PAD.look`: `{ x, y }`, curved, with `y` positive for stick down.
  - `PAD.sprint`: the sprint latch, a boolean.
  - `OPT.psens`.

- [ ] **Step 1: Write the failing tests**
  - `dead zone and walk speed`: left stick `axes[1] = -0.15` gives `PAD.move.mag === 0`. `-0.6` gives `mag ≈ 0.5` (±0.01). In a room, 60 ticks at `-0.6` move the player about half as far as 60 ticks at `-1.0` (ratio 0.4–0.6).
  - `right stick turns the camera`: lock off, `axes[2] = 1` for 60 ticks changes `cam.yaw` by `-3.0 ± 0.1`. `axes[3] = 1` for 10 ticks raises `cam.pitch`. The same with `OPT.invY = true` lowers it. `OPT.psens = 2` doubles the yaw change.
  - `sprint latch`: stick at `-1`, tap button 10 once (one tick down, then up) and run 30 ticks. `p.sprint === true` and `PAD.sprint === true`. Centring the stick for one tick gives `PAD.sprint === false`. Latch again, then tap 10 again: off. Latch again, set `p.stam = 0`, tick: off.
  - `a half push walks while latched`: latch on with stick at `-0.5` (mag below 0.6). `p.sprint === false` and `PAD.sprint === true`.
  - `dash attack from the latch`: latched sprint at full speed for 40 ticks, then tap 5. `p.move === DF.CLASSES[DF.OPT.cls].dash` (`startMove` stores the move id in `p.move`).
  - `flick switches lock target`: stage two enemies in front, lock with a tap of 11, then `axes[2] = 0.9` for 10 ticks. `p.lock` changed exactly once, and `DF.mouse.wheel` was nonzero in only one tick. Return to 0, flick again: it changes again.
  - `an idle second pad does not cancel movement`: `pads(mk({ index: 0 }), mk({ index: 1, axes: [0, -1, 0, 0] }))` gives `PAD.move.mag ≈ 1`.
  - `touch stick wins`: `DF.TOUCH.move = { x: 1, y: 0, mag: 1 }` with the pad stick forward. The player moves right of the camera.

- [ ] **Step 2: Run and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`
Expected: `FAIL` on the new steps.

- [ ] **Step 3: Implement the sticks in `PAD.poll`**

The stick with the larger magnitude across pads wins, separately for each stick. In `G.state === "play"`, `poll` turns the camera: `cam.yaw -= look.x * 3.0 * OPT.psens * dt` and `cam.pitch += look.y * 1.8 * OPT.psens * dt * (OPT.invY ? -1 : 1)`, clamped. It does not turn while `G.player.lock` is set. The latch and the flick follow Global Constraints. The latch reads the tap of `PAD_BIND.sprint` without consuming it.

- [ ] **Step 4: Use `PAD.move` and the latch in `playerUpdate`**

After the touch block: `else if (PAD.move.mag > 0) { f = PAD.move.y; s = PAD.move.x; im = PAD.move.mag; }`. In `free`, the run test becomes:

```js
const padMove = TOUCH.move.mag === 0 && PAD.move.mag > 0,
  run = padMove ? PAD.sprint && PAD.move.mag >= 0.6 : held("sprint");
p.sprint = run && il > 0 && p.stam > 0;
```

- [ ] **Step 5: Run and see them pass, then run `tests/t6.mjs` to confirm combat is unchanged**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: `all passed` twice.

- [ ] **Step 6: Commit**

```bash
git add src/06_game.js src/08d_pad.js tests/t16.mjs
git commit -m "feat: move, look, sprint and switch targets with the sticks"
```

### Task 3: Pausing, starting play and held buttons

**Files:**
- Modify: `src/08d_pad.js`, `src/09_main.js` (`play`, play keydown handler around line 330, add a desktop `fullscreenchange` rule), `tests/t16.mjs`

**Interfaces:**
- Consumes: `PAD.active`, `PAD.connected`.
- Produces:
  - `PAD.enterPlay()`: tries fullscreen and catches any refusal.
  - `PAD.mute`: the set of codes that stay ignored until they are released.

- [ ] **Step 1: Write the failing tests**
  - `Menu pauses and resumes`: in play, tap 9: `G.state === "pause"`. Release, tap 9 again: `"play"`. On pause, tap 1: `"play"`.
  - `a held button is not seen again after a screen change`: hold 9 through pause and 20 more ticks: still `"pause"`, with no flicker back to play. Resume with 0 on the focused Resume while 0 is still held, then 5 ticks in play: the player is not attacking, and `keys["P:0"]` is false until 0 is released and pressed again.
  - `unplugging pauses`: in play, `pads()` then tick: `"pause"`, `PAD.connected === false`, `body.padc` gone.
  - `unplugging while guarding leaves nothing held`: hold 4 (guard) for 10 ticks, then `pads()` and tick. `keys["P:4"]` is false. Resume with `DF.play()` and tick 10: `p.state !== "guard"`.
  - `play from the pad skips pointer lock and tries fullscreen`: with `PAD.active`, spy on `canvas.requestPointerLock` and `document.documentElement.requestFullscreen` (replace each with a counter that returns a rejected promise). `DF.play()`: pointer lock called 0 times, fullscreen 1 time, no page error, `G.state === "play"`.
  - `Esc and P pause without pointer lock`: in play with `document.pointerLockElement` null, dispatch keydown `Escape`: pause. Resume, then `KeyP`: pause.
  - `leaving fullscreen pauses on desktop`: in play, dispatch `fullscreenchange` on `document` with no `fullscreenElement`: pause.
  - `audio is tried on pad presses`: spy `DF.SFX.init` (export `SFX` in `DF`). A press edge calls it.

- [ ] **Step 2: Run and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`
Expected: `FAIL` on the new steps.

- [ ] **Step 3: Implement**
  - `poll` remembers `G.state`. When it changes, every code down at that moment goes into `PAD.mute` and its `keys` entry is cleared. A muted code produces no key, tap or menu action until it reads released.
  - When a seen pad is no longer listed, `poll` clears every `P:` key. If in play, it calls `show("pause")`.
  - `P:9` and the pause-screen `P:1` are handled in `poll`, not through `BIND`.
  - Every press edge calls `SFX.init()`.
  - In `play()`: `if (TOUCH.on) TOUCH.enterPlay(); else if (PAD.active) PAD.enterPlay(); else lockPointer();`.
  - In the play keydown handler: `Escape` or `KeyP` with `document.pointerLockElement !== canvas` calls `show("pause")`, replacing the `G.noLock` P check.
  - Add a `fullscreenchange` listener that pauses when not `TOUCH.on`, in play and with no fullscreen element. Touch keeps its own.

- [ ] **Step 4: Run t16, and t14 on one device to check touch pausing**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke && DEVICE=oneplus-13 SCRIPT=$PWD/tests/t14.mjs node test.mjs smoke`
Expected: `all passed` twice.

- [ ] **Step 5: Commit**

```bash
git add src/08d_pad.js src/09_main.js tests/t16.mjs
git commit -m "feat: pause, resume and start play from a controller"
```

### Task 4: Menus by pad

**Files:**
- Modify: `src/08d_pad.js`, `index.tpl.html` (`.padfocus` style), `tests/t16.mjs`

**Interfaces:**
- Consumes: `PAD.mute` and the state tracking from Task 3.
- Produces:
  - `PAD.focusables()`: the visible, enabled `button`, `.card`, `input[type=range]` and `input[type=checkbox]` elements on `.scr.show`, excluding `#binds button[data-act]`.
  - `PAD.nav(dir)`: moves focus, with `dir` one of `"up"`, `"down"`, `"left"`, `"right"`.
  - `PAD.focus`: the focused element, marked `.padfocus`.

- [ ] **Step 1: Write the failing tests**
  - `a screen opens with its first control focused`: in pad mode, `show("pause")` then tick: `PAD.focus.id === "btnResume"`. For `dead`, it is `btnRise`. For `title`, `btnPlay`. For `class`, the first `.card`.
  - `focus moves by direction`: on the class screen, a right tap moves to a card whose centre x is greater. Down moves to a control whose centre y is greater. A direction with nothing there keeps focus.
  - `holding repeats`: holding D-pad down on the controls screen for 0.34 s moves once, at 0.36 s twice, and at 0.36 + 0.12 × 3 s five times.
  - `A presses and B goes back`: on `howto` opened from title, B gives `"title"`. On `class`, A on a card makes `OPT.cls` that card's class.
  - `ranges and checkboxes`: focus `#sens`, then a right tap raises `OPT.sens` by its step and fires `input`. A on `#invY` flips `OPT.invY`.
  - `focus never lands on a keyboard binding`: pressing down 40 times through the controls screen never has `PAD.focus.matches("#binds button[data-act]")`.
  - `focus scrolls into view`: set `#scr-controls` style `height: 300px`, then move down to the last control. Its bounding rect lies within the screen element's rect.

- [ ] **Step 2: Run and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`
Expected: `FAIL` on the new steps.

- [ ] **Step 3: Implement menu focus in `PAD.poll` outside play**

Direction comes from `P:12`–`P:15` or the left stick past 0.5. To choose the next control, among candidates whose centre lies ahead of the current one along the direction by more than 1 px, pick the smallest `along + 2 × across`. A on a checkbox toggles `checked` and dispatches `change`. A on anything else calls `click()`. Left and right on a range call `stepUp()` or `stepDown()` and dispatch `input`. B on a `MENUS` screen clicks that screen's `[data-back]`. B on pause resumes, as Task 3 does. Call `scrollIntoView({ block: "nearest" })` on each move. Style `.padfocus` with a 2px `var(--ember)` outline and a 3px offset.

- [ ] **Step 4: Run and see them pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`
Expected: `all passed`.

- [ ] **Step 5: Commit**

```bash
git add src/08d_pad.js index.tpl.html tests/t16.mjs
git commit -m "feat: move through every menu with a controller"
```

### Task 5: Controller column, rebinding and settings

**Files:**
- Modify: `src/06_game.js` (`setPadBind`, `saveOpt`, `loadOpt`, `OPT`), `src/09_main.js` (`renderControls`, settings listeners, Defaults, `DF`), `src/08d_pad.js` (pad rebind wait), `index.tpl.html` (Controller settings markup, `#binds` row layout, CSS for `body.touch.padc #binds`), `tests/t16.mjs`

**Interfaces:**
- Consumes: `PAD.focusables`, `PAD.focus` from Task 4.
- Produces:
  - `setPadBind(a, code)`: binds a code to an action, with the swap rule of `setBind`.
  - `PAD.rebind`: the action waiting for a pad button, or `null`.
  - Each `#binds` row holds a key button `[data-act]` and a pad button `[data-pact]`.
  - Settings `#psens` with `#psensV`, `#padHideTouch`, `#rumble`, `#pnote`.
  - `OPT.psens`, `OPT.padHideTouch`, `OPT.rumble`.

- [ ] **Step 1: Write the failing tests**
  - `the Controller column`: each `ACTIONS` row has a `[data-pact]` button. Light reads `RB`, or `R1` with a PlayStation pad active. Movement rows read `Left stick` and are disabled. Mute reads `Unbound`.
  - `rebinding a pad button`: A on Attack's `[data-pact]` while 0 is still held shows `Press a controller button` and doesn't bind 0. Release, press 3: `PAD_BIND.light === "P:3"`, `PAD_BIND.tool === "P:5"` (swap), and focus is back on Attack's `[data-pact]`.
  - `cancelling`: during a wait, 9 cancels with the binding unchanged. During a wait, a keydown `KeyW` cancels.
  - `a pad press cancels a key wait`: click Attack's `[data-act]` (mouse), then press 2: the key wait is gone and `BIND.light === "Mouse0"`.
  - `menu buttons keep working after rebinding`: bind light to `P:0` and dodge to `P:2`. On pause, A on Resume resumes, then in play a tap of 0 attacks. On `controls`, B returns to `menuBack`.
  - `saving`: after a rebind and `OPT.psens = 1.5`, `OPT.padHideTouch = false`, `OPT.rumble = false`, `saveOpt()`. Resetting in memory, then `DF.loadOpt()`, restores all four. A saved `p` with `light: "P:9"` or `"P:16"` or `"bogus"` loads as the default `P:5`. `psens` 9 loads as 1.
  - `Defaults resets the pad`: click `#btnDefaults`: `PAD_BIND` equals `DEFAULT_PAD` and the three options are at their defaults.
  - `settings controls`: `#psens` input sets `OPT.psens` and `#psensV` reads `1.50×`. `#padHideTouch` and `#rumble` change their options. The copy matches Global Constraints.
  - `the unrecognised pad note`: `#pnote` is visible with `mapping: ""` and hidden with `"standard"`. Its text matches Global Constraints.

- [ ] **Step 2: Run and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`
Expected: `FAIL` on the new steps.

- [ ] **Step 3: Implement**
  - `renderControls` writes both buttons per row, and sets the three new inputs and `#pnote` visibility.
  - The pad wait lives in `PAD`. It starts from A or a click on `[data-pact]`, waits for all buttons released, then takes the next non-muted press edge that is in `PAD_CODES`. `P:9` cancels.
  - The capture-phase keydown in `boot()` cancels a pad wait.
  - `PAD.poll` cancels a key wait (`rebind`) on any press edge by calling `finishRebind(null)`.
  - Validate on load: codes in `PAD_CODES` or `null`, `psens` in range, booleans.
  - CSS: under `body.touch`, `#binds` shows only with `body.padc`, and its `[data-act]` buttons stay hidden. The Controller settings block shows on every device. `.padonly` shows only under `body.pad`, which also hides `.kbonly` and `.touchonly`. Put the rules after the existing `body.touch` ones.

- [ ] **Step 4: Run t16, and t10 to check the menus**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke && SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: `all passed` twice.

- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/08d_pad.js src/09_main.js index.tpl.html tests/t16.mjs
git commit -m "feat: rebind controller buttons and set stick speed in Controls"
```

### Task 6: Pad names in prompts

**Files:**
- Modify: `src/06_game.js` (`keyName`), `src/08d_pad.js` (`padName`), `src/08_hud.js` (`hint`, Execute prompt line 174), `src/09_main.js` (`both`, `renderPicker`), `index.tpl.html` (`.lk-pad` CSS, How to play pause line 1136), `tests/t16.mjs`

**Interfaces:**
- Consumes: `PAD.fam`, `PAD.active`, `PAD_BIND`.
- Produces:
  - `padName(code, fam)`: the name, using the Global Constraints table.
  - `keyName(c)`: returns `padName(c, PAD.fam)` for `P:` codes.
  - `both(kb, touch, pad)`: adds `<span class="lk-pad">`.
  - `actKey(a)`: `PAD.active ? padName(PAD_BIND[a], PAD.fam) : keyName(BIND[a])`.

- [ ] **Step 1: Write the failing tests**
  - `names`: `padName("P:0", "xbox") === "A"`, `padName("P:0", "ps") === "✕"`, `padName("P:13", "ps") === "D-pad down"`, `padName(null) === "Unbound"`.
  - `the hint line follows the last input`: Xbox pad active: `#hint` begins `RB attack · RT heavy · LB guard`. PlayStation: `R1 attack · R2 heavy · L1 guard`. After a keydown: `Left click attack`.
  - `the Execute prompt`: a staggered enemy in reach with an Xbox pad active shows `RB Execute`. Under touch it still shows `ATTACK Execute` (set `TOUCH.on` through `TOUCH.setOn(true)` with the pad inactive).
  - `the class kit`: with a pad active, the visible `kbd` text for Tool reads `Y`, or `△` for PlayStation.
  - `How to play names the pause button`: pad active, PlayStation: the visible pause line reads `Options`. Xbox: `Menu`.

- [ ] **Step 2: Run and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`
Expected: `FAIL` on the new steps.

- [ ] **Step 3: Implement**

`setActive` and a change of `fam` call `HUD.hint()` and `renderPicker()`. The pause line uses a `.lk-pad` span with an inner `.ps` and `.xb` span. `body.pad.ps` or `body.pad.xb`, set from `PAD.fam`, shows the right one. The hint line also shows under `body.touch.pad`.

- [ ] **Step 4: Run t16 and t10**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke && SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: `all passed` twice.

- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/08d_pad.js src/08_hud.js src/09_main.js index.tpl.html tests/t16.mjs
git commit -m "feat: show controller button names in prompts"
```

### Task 7: Hide touch buttons and rumble

**Files:**
- Create: `tests/t17.mjs`
- Modify: `src/08c_touch.js` (`classify`, `TOUCH.update`), `index.tpl.html` (`body.touch.padhide` rules), `src/08d_pad.js` (`PAD.rumble`), `src/06_game.js` (rumble calls), `tests/t16.mjs`

**Interfaces:**
- Consumes: `PAD.connected`, `OPT.padHideTouch`, `OPT.rumble`.
- Produces:
  - `PAD.rumble(kind)`: kind is one of `"hurt"`, `"gbreak"`, `"parry"`, `"heavy"`, `"execute"` or `"death"`. It plays on the last pad pressed, only while `PAD.active && OPT.rumble`.
  - `body.padhide` is set while `TOUCH.on && OPT.padHideTouch && PAD.connected`.

- [ ] **Step 1: Write the failing tests**
  - In `t16`, `rumble on combat beats`: pad active, `hurtPlayer` with the player in `free` adds `["dual-rumble", { duration: 160, strongMagnitude: 0.7, weakMagnitude: 0.4 }]` to `window.__rumble` (`startDelay` may be present). A perfect parry gives the `parry` entry. A guard break gives `gbreak`. A heavy `hitEnemy` on a living enemy gives `heavy`. `startExecute` gives `execute`. Death gives `death`.
  - In `t16`, `no rumble when off or inactive`: with `OPT.rumble = false` or `PAD.active = false`, nothing is added.
  - In `t16`, `a missing or failing actuator`: `vibrationActuator` undefined, then one whose `playEffect` throws, then one that returns a rejected promise. A hurt in each case raises no page error.
  - In `t17` (run with `DEVICE=oneplus-13`), using the same prelude:
    - `buttons hide while a pad is connected`: in play, connect a pad and tick. `body.padhide` is set, `#touch .btns` and `.stick` aren't displayed, and the pause square is. A real touch (`__touch`) at the Attack button's centre from `TOUCH.layout` doesn't set `keys["T:light"]`, and the camera turns on a drag from there. `#flasks` is displayed.
    - `buttons come back`: `pads()` and tick (pause on unplug), then resume. `body.padhide` is gone, and a touch on Attack sets `keys["T:light"]`. With a pad connected and `OPT.padHideTouch = false`, buttons show.
    - `the Controller column on a phone`: with a pad connected, `#binds` is displayed and no `[data-act]` button in it is.
    - Screenshots: `shot: "pad-touch-fight"` in a fight with buttons hidden, `shot: "pad-controls"` on the Controls screen in pad mode.
  - In `t16`, screenshots `pad-fight` (desktop, PlayStation pad active, hint line visible) and `pad-controls`.

- [ ] **Step 2: Run and see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke; DEVICE=oneplus-13 SCRIPT=$PWD/tests/t17.mjs node test.mjs smoke`
Expected: `FAIL` on the new steps.

- [ ] **Step 3: Implement**

`classify` skips `L.btns` and the `move` area while `body.padhide`, so those touches become `look`. `TOUCH.update` toggles `body.padhide` and calls `release()` when it turns on. `PAD.rumble` follows the table in Global Constraints. Every call is inside `try`, and a returned promise gets `.catch`. Hooks:
- `hurtPlayer`: `hurt` where it returns `"hit"`, `gbreak` where it sets `p.state = "gbreak"`, `parry` where it returns `"parry"`.
- `hitEnemy`: `heavy` when `o.heavy` and the source is the player's melee.
- `startExecute`: `execute`.
- `hurtPlayer`: `death` where it sets `p.state = "dead"`.

- [ ] **Step 4: Run both, and t14 on every device**

Run: `node build.mjs && SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke && DEVICE=oneplus-13 SCRIPT=$PWD/tests/t17.mjs node test.mjs smoke && node tests/touch-all.mjs tests/t14.mjs`
Expected: `all passed`, `all passed`, and every device line passing.

- [ ] **Step 5: Look at the four screenshots**

Open `shots/pad-fight.png`, `shots/pad-controls.png`, `shots/oneplus-13-pad-touch-fight.png` and `shots/oneplus-13-pad-controls.png`. Check that:
- the names read right and the focus outline is visible
- nothing overlaps
- no touch buttons are drawn on the phone fight shot.

- [ ] **Step 6: Commit**

```bash
git add src/08c_touch.js src/08d_pad.js src/06_game.js index.tpl.html tests/t16.mjs tests/t17.mjs
git commit -m "feat: hide touch buttons with a controller, rumble on combat beats"
```

### Task 8: Docs and full regression

**Files:**
- Modify: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Update `CLAUDE.md`**
  - Add a "Controller (`08d_pad.js`)" section under "How the systems fit together": `P:` codes, `PAD_BIND`, `PAD.move`, the latch, camera in `poll`, menu focus, `PAD.mute`, the pause rules, `body.pad`, `body.padc`, `body.padhide`, and that `frame` skips `poll` under `G.manual`.
  - Under Input and bindings, add: "To give an action a pad default, add it to `DEFAULT_PAD`."
  - Under Testing, add `t16` and `t17` with their commands.
  - In Known problems, replace "There is no gamepad support" with three items:
    - Controllers are checked only with a faked Gamepad API; no real pad has been tried.
    - Whether a pad press may start audio and fullscreen differs by browser.
    - DualSense mapping in Firefox may be wrong.
  - Remove "Gamepad support" from the Backlog.

- [ ] **Step 2: Update `README.md` controls with the default pad layout**

- [ ] **Step 3: Run every test**

Run: `node build.mjs && for t in 2 3 4 5 6 7 10 11 12 16; do SCRIPT=$PWD/tests/t$t.mjs node test.mjs smoke || echo "FAILED t$t"; done; for t in 8 9; do SCRIPT=$PWD/tests/t$t.mjs node test.mjs hub || echo "FAILED t$t"; done; SCRIPT=$PWD/tests/t13.mjs node test.mjs title; node tests/touch-all.mjs tests/t14.mjs; node tests/touch-all.mjs tests/t15.mjs; DEVICE=oneplus-13 SCRIPT=$PWD/tests/t17.mjs node test.mjs smoke`

Expected: no `FAILED` line, and every run ends `all passed`. `t1` is an early real-time script kept for reference (README) and is not run.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: controller support"
```
