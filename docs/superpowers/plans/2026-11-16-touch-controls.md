# Touch Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phones and tablets can play the whole game by touch, with a honeycomb of hexagon buttons and a floating stick sized from the screen by one layout function. Tests prove the layout fits on every supported screen and every control works under real multi-finger touch.

**Architecture:** A pure function `touchLayout` turns the visible size, the safe-area insets and two settings into the position and size of every control and HUD box. `layoutProblems` checks a layout against the spec's rules, and the tests sweep it across hundreds of sizes. A `TOUCH` controller draws the layout as one SVG overlay. It also routes every pointer to the control it first touched, and presses actions by writing `keys["T:<action>"]` and `taps["T:<action>"]`, which `held` and `hit` read alongside the key bindings.

**Tech Stack:** Plain JavaScript (ES2020), SVG and CSS over the WebGL 2 canvas, Pointer Events. Tests use Playwright with headless Chromium, mobile emulation and CDP `Input.dispatchTouchEvent` for real multi-point touch.

**Spec:** `docs/superpowers/specs/2026-11-16-touch-controls-design.md`. Read it and `CLAUDE.md` before starting. The mockup at `.superpowers/brainstorm/97645-1794869854/content/touch-honeycomb.html` (functions `honeycomb` and `sizes`) is the reference for the geometry, with the spec's raised floors.

## Global Constraints

- All `src/*.js` files share one function scope. No imports or exports. Declare each name once across `src/`.
- No dependencies, nothing loaded at run time except Google Fonts. Run `node build.mjs` after every source change. `dist/` is not committed.
- Keyboard and mouse play is unchanged. Existing scripts `tests/t1.mjs` to `tests/t12.mjs` are not edited and must still pass.
- Sizes from the short side `s` of the visible area: Attack `clamp(s*0.200, 66, 104)`, mid `clamp(s*0.135, 56, 74)`, small `clamp(s*0.100, 54, 56)`, gap `clamp(s*0.022, 6, 14)`, edge margin `clamp(s*0.040, 12, 32)` plus inset, stick radius `clamp(s*0.150, 52, 92)`, sprint ring `1.45 ×` stick radius, map `clamp(mid*1.5, 70, 130)` shrinking to fit, floor 56.
- Widths are corner to corner. Every button is at least 46 CSS px across its flat sides (`0.866 ×` width).
- The size slider multiplies Attack, mid, small and stick sizes. Floors apply after scaling. If a scale does not fit, use the largest that does.
- Honeycomb: `D = mid*0.866 + gap`. From Attack's centre, anticlockwise from screen-right: Dodge √3·D at 180°, Guard 2·D at 150°, Heavy √3·D at 120°, Lock 2·D at 90°, Flask √7·D at 169.1°, Tool √7·D at 130.9°, Ability √7·D at 109.1°. Attack's flat bottom sits on the bottom margin.
- Movement area: the left 42% of the screen, starting 16 px in from the left edge, below the health bars (and the boss bar when that sits under them).
- Boss bar: at the top between the health bars and pause. When that space is under 160 px wide, it goes under the health bars.
- Supported range: landscape, visible short side 280 px or more.
- Settings saved in `localStorage` key `dungeon-raze.v2` under `o`: `tsize` 0.8–1.2 (default 1), `topac` 0.2–1 (default 0.6), `tnotch` boolean (default true).
- Notch setting copy, exactly: "Keep controls clear of the notch and rounded corners". Its explanation, exactly: "Off can put buttons under the notch or a curved corner, where touches may not register."
- Portrait message, exactly: "Turn your device sideways to play."
- Fullscreen and orientation lock start from the play tap and every refusal is caught.
- Commits follow `CLAUDE.md`: no `Co-Authored-By` or session trailers. Work on the branch `feat/touch-controls`.
- Screenshots are looked at, not assumed.

## Review Focus

Conditions the spec implies but does not test, most likely to bite a player. Each is pinned by a test in the task named.

1. **The layout changes while a finger is down.** iPhone Safari's bar collapses and expands as the page settles, which resizes the viewport mid-press. No action may stay held after a relayout. Task 3, step "relayout releases every finger".
2. **The system takes a finger.** A notification, an edge swipe or the app switcher sends `pointercancel` instead of `pointerup`. The control must release. Task 3, step "a cancelled finger releases its control".
3. **A screen change with fingers down.** Dying, pausing or winning while Guard and the stick are held. On return to play nothing is held and the stick is idle. Task 3, step "leaving play clears touch state".
4. **The browser's mouse emulation after a tap.** A tap must not also press `Mouse0`, which would attack twice, or ask for pointer lock. Task 3, step "a tap is not also a click".
5. **A touch-screen laptop.** Someone on Windows plays with the mouse and brushes the screen. Controls appear; the next mouse move hides them and mouse play works exactly as before. Task 6, step "mouse play after a stray touch".

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/08b_touchlayout.js` | Create | Pure geometry: `touchLayout`, `layoutProblems`, `hexContains`, `TOUCH_BTNS` |
| `src/08c_touch.js` | Create | `TOUCH` controller: mode, overlay drawing, pointer routing, stick, look, flick, HUD placement, readout |
| `src/06_game.js` | Modify | `held`/`hit` read `T:` keys; `OPT` touch fields, load and save; analog stick speed in `playerUpdate` |
| `src/09_main.js` | Modify | Boot and frame hooks, `play()` lock and fullscreen, portrait, Back trap, touch settings UI, `DF` exports |
| `index.tpl.html` | Modify | Viewport meta, overlay, rotate and readout markup, touch settings markup, touch-mode and menu CSS, title line |
| `test.mjs` | Modify | `DEVICE` emulation, `__touch` and `__viewport` hooks |
| `tests/devices.mjs` | Create | Device list for rendered runs |
| `tests/touch-all.mjs` | Create | Runs one script on every device and summarises |
| `tests/t13.mjs` | Create | Layout sweep, no rendering |
| `tests/t14.mjs` | Create | Touch behaviour on a device |
| `tests/t15.mjs` | Create | Screenshots on a device |
| `package.json` | Modify | `test:touch` script |
| `README.md`, `CLAUDE.md` | Modify | Touch play, conventions, tests |

## Test conventions

`tests/t13.mjs` runs on the default desktop page: `SCRIPT=$PWD/tests/t13.mjs node test.mjs title`.

`tests/t14.mjs` and `tests/t15.mjs` run under device emulation in `smoke` mode, one device at a time: `DEVICE=pixel-9 SCRIPT=$PWD/tests/t14.mjs node test.mjs smoke`, or on every device with `node tests/touch-all.mjs tests/t14.mjs`. Touches are real: the runner exposes `__touch(type, points)`, which forwards to CDP `Input.dispatchTouchEvent`. Every t14 step is built with this helper. It keeps the set of active points, because CDP wants all of them on every move.

```js
const step = (name, body) => ({
  name,
  eval: `(async () => { const { G, cam, TOUCH } = DF; G.manual = true;
  const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const pts = new Map();
  const send = (type) => __touch(type, [...pts].map(([id, p]) => ({ id, x: p.x, y: p.y })));
  const T = {
    down: async (id, x, y) => { pts.set(id, { x, y }); await send("touchStart"); },
    move: async (id, x, y) => { pts.set(id, { x, y }); await send("touchMove"); },
    up: async (id) => { const p = pts.get(id); pts.delete(id); await __touch("touchEnd", [...pts].map(([i, q]) => ({ id: i, x: q.x, y: q.y }))); },
    cancel: async () => { pts.clear(); await __touch("touchCancel", []); },
  };
  const L = () => TOUCH.layout;
  const btn = (act) => L().btns.find((b) => b.act === act);
  const play = () => { DF.newRun(99); DF.show("play"); TOUCH.release(); };
  ${body} })()`,
});
```

---

### Task 1: The layout function and the sweep

**Files:**
- Create: `src/08b_touchlayout.js`
- Modify: `src/09_main.js` (the `window.DF` object)
- Test: `tests/t13.mjs`

**Interfaces:**
- Produces:
  - `TOUCH_BTNS`: `[["light","atk"],["dodge","mid"],["guard","mid"],["heavy","mid"],["lock","mid"],["heal","small"],["tool","small"],["special","small"]]`, action name and size class, in honeycomb order.
  - `touchLayout(W, H, ins, o) -> L`. `ins = { l, r, t, b }` in CSS px. `o = { size, notch }`. When `o.notch` is false, insets are treated as zero. `L = { W, H, scale, ins, P, u, S, g, m, R, ring, btns, move, rest, vitals, map, pause, boss }`:
    - `btns`: `[{ act, x, y, d }]`, where `x` and `y` are the centre and `d` is the corner-to-corner width;
    - `move`: `{ x0, y0, x1, y1 }`;
    - `rest`: `{ x, y }`, the stick's idle centre;
    - `vitals`, `map`, `pause`, `boss`: `{ x, y, w, h }`.
  - `layoutProblems(L) -> string[]`, empty when the layout passes.
  - `hexContains(b, x, y) -> boolean`, for a flat-topped hexagon `b` with centre `x, y` and corner-to-corner width `d`.
  - `VITALS_H = 64` and `BOSS_H = 52`: the boxes the HUD must fit inside, in px.
  - `DF.touchLayout`, `DF.layoutProblems`, `DF.hexContains`.

- [ ] **Step 1: Branch**

```bash
git checkout -b feat/touch-controls
git add .gitignore docs/superpowers/specs/2026-11-16-touch-controls-design.md docs/superpowers/plans/2026-11-16-touch-controls.md
git commit -m "docs: touch controls design and plan"
```

- [ ] **Step 2: Write `tests/t13.mjs`**

Steps, each returning `{ pass, ... }`:

- `"honeycomb geometry"`: `L = DF.touchLayout(852, 393, {l:0,r:0,t:0,b:0}, {size:1, notch:true})`.
  - With `A` = the light button and `D = L.u*0.866 + L.g`, each button sits at its spec distance and angle from `A`, within 0.5 px. Note that screen y grows downward.
  - `A.y + A.d*0.433 === 393 - L.m` within 0.5.
  - `L.scale === 1`.
- `"sizes from the short side"`: at `(1376, 1032)`, `P` is 104, `u` 74, `S` 56. At `(568, 320)`, `P` is 66, `u` 56, `S` 54. Every button's `d*0.866 >= 46` at both.
- `"hexContains"`: true at the centre, true at 0.95 of the flat half-width straight up, false at 1.05 of it, true at 0.95 of the corner radius along 0°, false at 0.95 of the corner radius along 30°.
- `"problems catches overlap, bounds, hud and size"`: take a passing layout and break it four ways, each on a deep copy, expecting a non-empty result:
  - move Dodge onto Guard;
  - move Attack 10 px past the right edge;
  - grow `map` over Lock;
  - set one `d` so the flat width is 45.
- `"notch off ignores insets"`: Attack's centre moves exactly `ins.r` right and `ins.b` down between `notch:true` and `notch:false`, with insets `{l:47, r:47, t:0, b:21}`.
- `"sweep"`: the spec's sweep, with the phone ratios extended to 2.65:1 to cover fold cover screens.
  - Phones, short side 280–499 in steps of 10: ratios 16/9, 2, 19.5/9, 20/9, 22/9 and 2.65. Insets `{0,0,0,0}` and `{l:24,r:24,t:0,b:0}`; from 320, also `{l:47,r:47,t:0,b:21}`.
  - Tablets, short side 500–1100: ratios 1.2, 4/3, 1.43, 1.5 and 1.6. Insets `{0,0,0,0}` and `{l:0,r:0,t:0,b:20}`.
  - Sizes 0.8, 1 and 1.2; notch on and off.
  - Pass when every case has no problems and every `size:1` case has `scale === 1`.
  - Return the case count, the failures (first 10) and the worst values: smallest flat width, smallest gap, smallest map, and the lowest `scale` at size 1.2.

- [ ] **Step 3: Run it and see it fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t13.mjs node test.mjs title`
Expected: FAIL, `DF.touchLayout is not a function`.

- [ ] **Step 4: Implement `src/08b_touchlayout.js`**

`touchLayout`:
- Compute sizes at scale `o.size`. If `layoutProblems` is non-empty, retry at `o.size - 0.05` and so on down to 0.8. Return the first layout that passes, or the 0.8 one.
- The vitals box is `{ x: m+ins.l, y: m+ins.t, w: clamp(W*0.26, 150, 300), h: VITALS_H }`.
- Map: right-aligned at `m+ins.r` from the right and `m+ins.t` from the top, size `min(clamp(u*1.5,70,130), clusterTop - (m+ins.t) - g)`. `clusterTop` is the smallest `y - d*0.433` among the buttons.
- Pause: a square of side `S*0.866`, `g` to the left of the map, top-aligned with it.
- Boss: `{ x: vitals right + g, w: pause.x - g - that x, y: vitals.y, h: BOSS_H }`. If `w < 160`, use `{ x: vitals.x, y: vitals.y + VITALS_H + g, w: vitals.w, h: BOSS_H }` instead.
- `move`: `x0 = 16 + ins.l`, `x1 = W*0.42`, `y0` = bottom of the lowest box among vitals and an under-vitals boss, plus `g`, and `y1 = H - ins.b`.
- `rest`: `{ x: x0 + ring + 4, y: y1 - m - ring }`.

`layoutProblems` returns one string per failed check:
- a flat width under 46;
- a gap between any two buttons under 5.5 px. Measure along the line between centres, centre distance minus each shape's reach toward the other; the reach of a hexagon at angle θ is `d/2 · max over k of cos(θ − 60°k)`. This is a lower bound on the true distance, so a positive gap guarantees no overlap;
- a button's bounding box outside `[ins.l, W-ins.r] × [ins.t, H-ins.b]`, or outside `[0,W] × [0,H]` when insets were ignored;
- a button's bounding box intersecting `vitals`, `map`, `pause`, `boss` or `move`;
- `pause` or `boss` intersecting `vitals` or `map`;
- a map under 56;
- the stick circle (centre `rest`, radius `ring`) not inside `move`.

Add the three functions to `window.DF` in `src/09_main.js`.

- [ ] **Step 5: Run it and see it pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t13.mjs node test.mjs title`
Expected: every step passes, `all passed`. The sweep reports a smallest flat width of at least 46.

- [ ] **Step 6: Commit**

```bash
git add src/08b_touchlayout.js src/09_main.js tests/t13.mjs
git commit -m "feat: touch layout function and size sweep"
```

---

### Task 2: Device emulation, overlay and HUD placement

**Files:**
- Create: `src/08c_touch.js`, `tests/devices.mjs`, `tests/touch-all.mjs`, `tests/t14.mjs`
- Modify: `test.mjs`, `index.tpl.html`, `src/09_main.js`, `package.json`

**Interfaces:**
- Consumes: `touchLayout`, `layoutProblems`, `TOUCH_BTNS` from Task 1.
- Produces:
  - `TOUCH.init()`, called once in `boot()` after `HUD.init()`.
  - `TOUCH.update(dt)`, called in `frame()` after `HUD.update(dt)`.
  - `TOUCH.on`: boolean, touch mode.
  - `TOUCH.setOn(v)`: toggles `document.body.classList` `touch` and applies or clears the HUD placement.
  - `TOUCH.layout`: the current `L`.
  - `TOUCH.relayout()`.
  - `TOUCH.fakeInsets`: `null`, or `{l,r,t,b}` used instead of the real insets (tests only).
  - `TOUCH.forced`: true when the URL has `?touch=1`.
  - `TOUCH.release()`: lifts every finger and clears all `T:` keys. It's added in Task 3 but declared here.
  - `TOUCH.move`: `{ x: 0, y: 0, mag: 0 }`. Declared here, filled in Task 4.
  - `DF.TOUCH`.
- `tests/devices.mjs` default-exports `[{ id, name, w, h, dpr, ins }]`. `ins` holds the insets the test should fake.
  - Playwright landscape descriptors:
    - `iphone-se`: "iPhone SE (3rd gen)", 667×375.
    - `iphone-16`: "iPhone 16", 734×343, ins `{l:47,r:47,t:0,b:21}`.
    - `iphone-16-pro-max`: 838×390, ins as above.
    - `pixel-9`: 756×308.
    - `pixel-5`: 802×293.
    - `galaxy-s24`: 780×360.
    - `fold-7-cover`: "Galaxy Z Fold 7 Cover", 788×308.
    - `moto-g4`: 640×360.
    - `ipad-pro-11`: 1194×834, ins `{l:0,r:0,t:0,b:20}`.
  - Custom entries:
    - `oneplus-13`: 905×412, dpr 3.5.
    - `ipad-mini`: 1133×744, dpr 2, ins `{b:20}`.
    - `ipad-pro-13`: 1376×1032, dpr 2, ins `{b:20}`.
  - Where a descriptor exists, copy its viewport and dpr from Playwright's `devices["<name> landscape"]`; if a copied size differs from the one listed here, keep Playwright's. All entries set `isMobile` and `hasTouch` true. Missing inset sides are 0.

- [ ] **Step 1: Give the runner devices**

In `test.mjs`, when `process.env.DEVICE` is set:
- find the entry in `tests/devices.mjs`;
- create the page from a context with that viewport, `deviceScaleFactor`, `isMobile: true` and `hasTouch: true`;
- open a CDP session and `exposeFunction("__touch", (type, touchPoints) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints }))`;
- `exposeFunction("__viewport", (w, h) => p.setViewportSize({ width: w, height: h }))`;
- before the page script runs, `addInitScript` setting `window.__fakeInsets` to the entry's `ins`;
- prefix screenshot names with the device id.

Without `DEVICE`, nothing changes. `tests/touch-all.mjs <script> [mode]` runs `test.mjs` once per device, mode `smoke` by default. It prints one line per device and exits 1 if any device failed. Add `"test:touch": "node tests/touch-all.mjs tests/t14.mjs"` to `package.json`.

- [ ] **Step 2: Write the first `tests/t14.mjs` steps**

- `"touch mode on a phone"`: after `play()` and `await draw()`:
  - `TOUCH.on` is true;
  - `document.body.classList.contains("touch")`;
  - `#touch` is displayed;
  - it holds 8 hexagon polygons and the pause button.
- `"overlay matches the layout"`: for every button, the polygon's bounding rect centre is within 1 px of `(b.x, b.y)` and its width within 1 px of `b.d`.
- `"hud sits in its boxes"`: the rects of `#vitals`, `#map` and `#boss` (forced visible) each lie inside `L().vitals`, `L().map` and `L().boss` within 1 px. `#hint` is not displayed.
- `"layout passes on this device"`: `DF.layoutProblems(L())` is empty and `L().scale === 1`.
- `"fake insets are used"`: `L().ins` equals the device's `ins`.

- [ ] **Step 3: Run it and see it fail**

Run: `node build.mjs && DEVICE=pixel-9 SCRIPT=$PWD/tests/t14.mjs node test.mjs smoke`
Expected: FAIL, `DF.TOUCH` undefined.

- [ ] **Step 4: Implement the overlay and placement**

`index.tpl.html`:
- Add `<div id="touch"><svg></svg></div>` after `#hud`, and `<div id="treadout"></div>`.
- `#touch` is fixed, `inset:0`, shown only under `body.touch` while the HUD shows the play state.
- `body.touch #hint { display: none }`.

`src/08c_touch.js`:
- `TOUCH.on` starts true when any of these hold:
  - `matchMedia("(pointer: coarse)")` matches;
  - `matchMedia("(hover: none)")` matches and `navigator.maxTouchPoints > 0`;
  - `?touch=1` is in the URL.
- Insets: `TOUCH.fakeInsets || window.__fakeInsets`, or else read from a hidden probe whose padding is `env(safe-area-inset-*)`.
- `relayout()` calls `touchLayout(innerWidth, innerHeight, ins, { size: OPT.tsize ?? 1, notch: OPT.tnotch ?? true })`. It runs on `resize`, `orientationchange` and `visualViewport` `resize`.
- Rebuild the SVG on each relayout. Each button is a flat-topped hexagon polygon with corner radius `d/2`, plus a label. Draw the pause square, a faint stick at `rest` with its dashed sprint ring, and nothing else.
- While `on`, give `#vitals`, `#map` and `#boss` inline `left/top/width/height` from the layout; clear those inline styles when `on` turns false.
- `#treadout` shows `W×H · insets l r t b · scale` only when `TOUCH.forced`.

Labels and colours follow the mockup and the game's palette.

- [ ] **Step 5: Run it on every device**

Run: `node build.mjs && node tests/touch-all.mjs tests/t14.mjs`
Expected: every device passes.

- [ ] **Step 6: Commit**

```bash
git add src/08c_touch.js src/09_main.js index.tpl.html test.mjs package.json tests/devices.mjs tests/touch-all.mjs tests/t14.mjs
git commit -m "feat: touch overlay drawn from the layout, device test runner"
```

---

### Task 3: Buttons and pause

**Files:**
- Modify: `src/08c_touch.js`, `src/06_game.js:106-107` (`held`, `hit`), `src/09_main.js` (`play`, `show`)
- Test: `tests/t14.mjs`

**Interfaces:**
- Consumes: `hexContains`, `TOUCH.layout` from Tasks 1 and 2.
- Produces:
  - A touch on a button sets `keys["T:"+act] = true` and `taps["T:"+act] = true`. Lifting sets `keys["T:"+act] = false`.
  - `held(a) = !!keys[BIND[a]] || !!keys["T:" + a]`.
  - `hit(a) = tap(BIND[a]) || tap("T:" + a)`. Both sides are always evaluated, so that both taps are consumed.
  - `TOUCH.release()`.
  - `TOUCH.owners`: a `Map` from pointerId to `{ kind: "btn"|"pause"|"move"|"look", act?, x0, y0, t0, x, y }`.

- [ ] **Step 1: Write the failing steps in `tests/t14.mjs`**

- `"every button presses its action"`: for each `b` of `L().btns`:
  - `await T.down(1, b.x, b.y)`;
  - check `DF.keys["T:"+b.act] && DF.taps["T:"+b.act]`;
  - `await T.up(1)`;
  - check `!DF.keys["T:"+b.act]`;
  - clear `DF.taps`.

  All 8 must pass.
- `"attack attacks"`: tap Attack, `DF.sim(0.05)`, `G.player.state === "attack"`.
- `"guard holds"`:
  - hold Guard and `DF.sim(0.3)`: `G.player.state === "guard"`;
  - `await T.up(1)` and `DF.sim(0.3)`: the state is `"free"`.
- `"a gap presses nothing"`: touch at the midpoint of Dodge and Guard's centres. No `T:` key is set and `TOUCH.owners.get(1).kind === "look"`.
- `"sliding off keeps the button"`: down on Heavy, move to Lock's centre. `keys["T:heavy"]` stays true and `keys["T:lock"]` stays false.
- `"pause button pauses"`: tap the centre of `L().pause`; `G.state === "pause"`.
- `"a tap is not also a click"`: tap Attack. Afterwards `!DF.taps.Mouse0`, `!DF.keys.Mouse0` and `document.pointerLockElement === null`. After `DF.sim(0.05)`: `G.player.state === "attack"`, `G.player.move === G.player.cls.chain` and `G.player.buf` is null, so exactly one attack started and none is queued.
- `"relayout releases every finger"`: hold Guard and Attack, then `await __viewport(innerWidth - 20, innerHeight)` and `await draw()`. No `T:` key is held, `TOUCH.owners.size === 0`, and the layout width changed. Restore the viewport.
- `"a cancelled finger releases its control"`: hold Guard, `await T.cancel()`; `!DF.keys["T:guard"]`.
- `"charges show on buttons"`:
  - set `G.player.flasks = 2` and `await draw()`: the Flask button's label shows 2;
  - set it to 0: the Flask button has class `empty`;
  - set `G.player.focus = 0`: Ability has class `empty`;
  - set it to `G.player.cls.special.cost`: Ability does not;
  - the same check for Tool with `G.player.tool`.
- `"leaving play clears touch state"`: hold Guard, then `DF.show("pause")` and `DF.show("play")`. Nothing is held, `TOUCH.owners.size === 0` and `TOUCH.move.mag === 0`.

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && DEVICE=iphone-se SCRIPT=$PWD/tests/t14.mjs node test.mjs smoke`
Expected: the new steps fail.

- [ ] **Step 3: Implement routing**

In `TOUCH.update`, show the remaining count on Flask (`p.flasks`) and Tool (`p.tool`). Give Flask, Tool and Ability (`p.focus < p.cls.special.cost`) the class `empty` when they cannot be used; it dims them.

On `#touch`:
- Listen for `pointerdown`, `pointermove`, `pointerup` and `pointercancel`. Accept `pointerType` `touch` and `pen`, and `mouse` too when `TOUCH.forced`.
- `pointerdown` calls `preventDefault()` and `setPointerCapture`, then classifies the point in this order: a button by `hexContains`, the pause rect, the `move` rect, otherwise `look`.
- `pause` calls `show("pause")` on release.
- `release()` lifts every owner and sets every `keys["T:*"]` false.
- Call `release()` from:
  - `relayout()`;
  - `show()` whenever the new state is not `play`;
  - `play()`.
- `#touch` covers the canvas, so the canvas `mousedown` handler never sees touches.
- `play()` calls `lockPointer()` only when `!TOUCH.on`.

- [ ] **Step 4: Run them and see them pass, on every device**

Run: `node build.mjs && node tests/touch-all.mjs tests/t14.mjs`
Expected: every device passes.

- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/08c_touch.js src/09_main.js tests/t14.mjs
git commit -m "feat: touch buttons press actions, pause button"
```

---

### Task 4: Stick, camera, flick and aim

**Files:**
- Modify: `src/08c_touch.js`, `src/06_game.js:2062-2072` and the `free` case near `:2157` (`playerUpdate`)
- Test: `tests/t14.mjs`

**Interfaces:**
- Consumes: `TOUCH.owners`, `TOUCH.layout`.
- Produces:
  - `TOUCH.move = { x, y, mag }`: `x` is screen-right and `y` is screen-up, as a unit vector or zero. `mag` is in `[0,1]`: `raw = dist/R`, and `mag = raw < 0.15 ? 0 : min(1, (raw - 0.15)/0.85)`.
  - `keys["T:sprint"]` is true while the finger is beyond `ring` from where it landed.
  - Look: each move of a `look` finger, or of a finger on Attack once it has moved more than 8 px, adds `dxPx * Math.PI / (W * cam.sens)` to `mouse.dx`, and the same with `dyPx` to `mouse.dy`.
  - Flick: a `look` finger that travels at least `max(40, 0.06*W)` px horizontally within 250 ms, with `|dx| > 2|dy|`, sets `mouse.wheel = Math.sign(dx)` once, while `G.player.lock` is set.

- [ ] **Step 1: Write the failing steps**

Every step starts with `play()` and the player standing in the first room. The player's speed is `Math.hypot(G.player.vx, G.player.vz)` and the class's walk speed is `G.player.cls.walk`.

- `"small push walks slowly"`: down at `L().rest`, move up by `0.5*L().R`, `DF.sim(1)`. The speed is between 0.3 and 0.55 of walk.
- `"full push runs"`: move up by `L().R`, `DF.sim(1)`. The speed is between 0.9 and 1.1 of walk, and `!G.player.sprint`.
- `"past the ring sprints"`: move up by `L().ring + 4`, `DF.sim(0.5)`. `G.player.sprint === true`.
- `"lifting stops"`: lift, `DF.sim(0.5)`. The speed is under 0.2 and `TOUCH.move.mag === 0`.
- `"stick follows the thumb"`: down at a point 60 px right of `rest` inside `move`. `TOUCH.owners.get(1).x0` equals that point; the stick lands where the thumb lands.
- `"camera drag turns"`: with `cam.yaw` saved, drag a `look` finger right by `0.25*W` in 6 moves, then `await draw()`. `cam.yaw` changed by `-Math.PI/4 * DF.OPT.sens` within 10%.
- `"three fingers at once"`: stick pushed up full, a look finger dragging and Attack held. All three register: `TOUCH.move.mag > 0.9`, the yaw changes and `keys["T:light"]`. Lifting the look finger leaves the other two held.
- `"aim while attacking"`: down on Attack, move 0.2·W right in steps. The yaw changed and `keys["T:light"]` is still true. After lifting, it is false.
- `"flick switches lock"`:
  - place two husks 4 m in front of the player, 3 m apart sideways, with every other enemy parked 1000 m away as in `tests/t10.mjs`;
  - lock on with the Lock button and save `G.player.lock`;
  - flick right 0.1·W in 3 moves within 100 ms, then `DF.sim(1/60)`;
  - the lock is the other husk.
- `"keyboard movement unchanged"`: with no finger down, `DF.keys[DF.BIND.fwd] = true` and `DF.sim(1)`. The speed is within 0.9 to 1.1 of walk.

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && DEVICE=galaxy-s24 SCRIPT=$PWD/tests/t14.mjs node test.mjs smoke`
Expected: the new steps fail.

- [ ] **Step 3: Implement the stick and look in `src/08c_touch.js`**

The stick's origin is where the finger landed. Draw the base at the origin, the knob clamped to `R` and the dashed ring at `ring`. Return to the faint `rest` drawing when the finger lifts.

- [ ] **Step 4: Use the stick in `playerUpdate`**

- Make `f` and `s` `let`. When `TOUCH.move.mag > 0`, set `f = TOUCH.move.y`, `s = TOUCH.move.x` and `im = TOUCH.move.mag`; otherwise `im = 1`.
- In the `free` case, the non-sprint speed becomes `sp * im`.
- `ix`, `iz` and `il` keep their meaning, so dodge and the class tools are unchanged.

- [ ] **Step 5: Run them and see them pass, on every device, then run the combat tests**

Run: `node build.mjs && node tests/touch-all.mjs tests/t14.mjs && node test.mjs smoke && SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`
Expected: every device passes. `t6` reports all passed.

- [ ] **Step 6: Commit**

```bash
git add src/06_game.js src/08c_touch.js tests/t14.mjs
git commit -m "feat: floating stick with analog speed and sprint ring, touch look, flick to switch lock"
```

---

### Task 5: Settings

**Files:**
- Modify: `src/06_game.js:105` (`OPT`), `:145-169` (`saveOpt`, `loadOpt`); `src/09_main.js` (`renderControls`, the settings listeners, `btnDefaults`, `DF`); `index.tpl.html` (`#scr-controls`)
- Test: `tests/t14.mjs`

**Interfaces:**
- Consumes: `TOUCH.relayout()`.
- Produces:
  - `OPT.tsize`, `OPT.topac`, `OPT.tnotch`, with the defaults and ranges in Global Constraints. `loadOpt` rejects values outside the ranges.
  - Inputs `#tsize` (range 0.8–1.2, step 0.05), `#topac` (range 0.2–1, step 0.05) and `#tnotch` (checkbox) live in a block `#tset`. `#tset` shows instead of `#binds` while `TOUCH.on`.
  - `DF.loadOpt`, `DF.saveOpt`.

- [ ] **Step 1: Write the failing steps**

- `"controls screen shows touch settings"`: `DF.openMenu("controls")`, `await draw()`. `#tset` is displayed and `#binds` is not. The notch label and explanation text equal the Global Constraints copy.
- `"size slider grows and is capped"`: run on every device.
  - Set `#tsize` to 1.2 and dispatch `input`.
  - `L().scale` is between 1 and 1.2, and `layoutProblems(L())` is empty.
  - On `ipad-pro-13`, Attack's `d` is 1.2 × 104.
  - On `pixel-9` the scale is the largest step that fits. Check that `scale + 0.05` is either above 1.2 or has problems.
  - Reset to 1.
- `"opacity slider"`: set `#topac` to 0.3; the computed opacity of an idle button is 0.3. A held button shows at 1.
- `"notch toggle moves controls by the insets"`:
  - set `TOUCH.fakeInsets = { l:47, r:47, t:0, b:21 }` and relayout;
  - save Attack's centre, untick `#tnotch` and dispatch `change`;
  - Attack moved exactly +47 x and +21 y;
  - tick it again and it is back.
- `"settings persist"`:
  - set size 0.9, opacity 0.4 and notch off;
  - `JSON.parse(localStorage["dungeon-raze.v2"]).o` has those values;
  - set the `OPT` fields to their defaults and call `DF.loadOpt()`; they are restored;
  - "Reset to defaults" restores 1, 0.6 and true.

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && DEVICE=iphone-16 SCRIPT=$PWD/tests/t14.mjs node test.mjs smoke`
Expected: the new steps fail.

- [ ] **Step 3: Implement**

Add the `OPT` fields, loading, saving and the markup. Each input saves and calls `TOUCH.relayout()`. Opacity is a CSS variable on `#touch`; a pressed button overrides it to 1.

- [ ] **Step 4: Run them and see them pass, on every device**

Run: `node build.mjs && node tests/touch-all.mjs tests/t14.mjs`
Expected: every device passes.

- [ ] **Step 5: Commit**

```bash
git add src/06_game.js src/09_main.js index.tpl.html tests/t14.mjs
git commit -m "feat: touch settings for button size, opacity and notch clearance"
```

---

### Task 6: Platform: mode switching, portrait, Back, fullscreen, gestures, menus

**Files:**
- Modify: `src/08c_touch.js`, `src/09_main.js` (`play`, the `keydown` listener, `boot`), `index.tpl.html` (viewport meta, `#rotate`, CSS, the title `.touch` line)
- Test: `tests/t14.mjs`

**Interfaces:**
- Consumes: `TOUCH.setOn`, `TOUCH.release`, `show`, `play`.
- Produces:
  - `#rotate`, shown under `body.touch.portrait`.
  - `TOUCH.checkPortrait()`, which runs on every relayout.
  - The viewport meta becomes `width=device-width, initial-scale=1, viewport-fit=cover`.

- [ ] **Step 1: Write the failing steps**

- `"keyboard hides, touch shows"`:
  - `dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }))`: `TOUCH.on` is false and `#touch` is hidden;
  - `T.down/T.up` anywhere: `TOUCH.on` is true.
- `"mouse play after a stray touch"`: in touch mode, dispatch a `PointerEvent("pointermove", { pointerType: "mouse", bubbles: true })` on `window`.
  - `TOUCH.on` is false and `#vitals` has no inline `left`.
  - A synthetic `mousedown` with `button: 0` on the canvas sets `DF.taps.Mouse0`.
- `"forced mode ignores mouse"`: with `TOUCH.forced = true`, the same pointermove leaves `TOUCH.on` true. Reset `forced`.
- `"portrait pauses and asks to rotate"`:
  - in play, `await __viewport(H, W)` (swapped) and `await draw()`;
  - `#rotate` is displayed with the text "Turn your device sideways to play." and `G.state === "pause"`;
  - swap back and `#rotate` is hidden.
- `"Back opens pause"`:
  - `DF.play()`, then `history.back()` and wait 150 ms;
  - `G.state === "pause"` and `location.href` unchanged.
- `"gestures are blocked"`:
  - computed `touch-action` of `#touch` is `none`;
  - `overscroll-behavior` of `html` is `none`;
  - `user-select` of `body` is `none`;
  - `-webkit-touch-callout` of `body` is `none`;
  - the viewport meta contains `viewport-fit=cover`.
- `"play survives refused fullscreen"`: `DF.play()` with `document.documentElement.requestFullscreen` replaced by `() => Promise.reject(new Error("no"))`. The state is `"play"`. The runner's "no errors" check covers unhandled rejections.
- `"menus fit 640×360"`: only when `innerWidth === 640`. For each of `title`, `pause`, `class`, `controls`, `howto`, `dead` and `win`:
  - `DF.show(s)`;
  - every visible `.scr.show button`, after `scrollIntoView`, lies fully inside the viewport and is at least 44 px tall;
  - the Back button of each menu, tapped with `T.down/T.up` at its centre, returns to the screen it came from.

- [ ] **Step 2: Run them and see them fail**

Run: `node build.mjs && DEVICE=moto-g4 SCRIPT=$PWD/tests/t14.mjs node test.mjs smoke`
Expected: the new steps fail.

- [ ] **Step 3: Implement**

- `TOUCH.setOn(false)` on any `keydown`, and on `pointermove` with `pointerType === "mouse"` when not `forced`. `TOUCH.setOn(true)` on any touch `pointerdown`, on the document as well as the overlay.
- `checkPortrait()` toggles `body.portrait` when `on && innerHeight > innerWidth`. Entering portrait during play calls `show("pause")`.
- In `play()`, when `TOUCH.on`:
  - call `requestFullscreen({ navigationUI: "hide" })` and then `screen.orientation.lock("landscape")`, each guarded by existence checks and `.catch(() => {})`;
  - push one history entry the first time; on `popstate` during play, call `show("pause")` and push again.
- CSS:
  - `touch-action: none` on `#touch` and the canvas; `overscroll-behavior: none` on `html` and `body`; `user-select: none` and `-webkit-touch-callout: none` on `body`;
  - `.scr` keeps `overflow-y: auto` with `touch-action: pan-y`;
  - `.scr button` gets `min-height: 44px`;
  - a `max-height: 420px` media block tightens `.scr` gaps, padding and headings so the menus fit 640×360.
- The title's `.touch` line reads: "On a phone or tablet, turn it sideways. The controls appear when you start."

- [ ] **Step 4: Run them and see them pass, on every device**

Run: `node build.mjs && node tests/touch-all.mjs tests/t14.mjs`
Expected: every device passes.

- [ ] **Step 5: Commit**

```bash
git add src/08c_touch.js src/09_main.js index.tpl.html tests/t14.mjs
git commit -m "feat: touch mode switching, portrait screen, Back to pause, fullscreen, menus for small screens"
```

---

### Task 7: Screenshots, a real-browser pass, docs and the full suite

**Files:**
- Create: `tests/t15.mjs`
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: Write `tests/t15.mjs`**

Take two screenshots on each device:
- `touch-hall`: in the hall, with a finger holding the stick pushed up.
- `touch-fight`: in the cave, a husk 4 m ahead, Attack held and the boss bar forced visible.

Each step also returns `{ pass: DF.layoutProblems(DF.TOUCH.layout).length === 0 }`.

- [ ] **Step 2: Run it on every device and look at every screenshot**

Run: `node build.mjs && node tests/touch-all.mjs tests/t15.mjs`
Expected: every device passes.

Open every `shots/<device>-touch-*.png` and check:
- the hexagons sit in the corner with even gaps;
- nothing covers the health bars, map, pause or boss bar;
- nothing is clipped;
- the stick and ring are drawn.

Fix anything that looks wrong and re-run.

- [ ] **Step 3: Resize a real Chrome window**

1. Serve the build with `npm run dev`.
2. Using the Claude in Chrome tools, open `http://localhost:8000/?touch=1` in a new tab and start play.
3. Resize the window to 667×375, 756×308, 905×412, 1133×744 and 1376×1032.
4. At each size, screenshot the page and check the readout's size against the window.
5. Click Attack, Guard and the pause button with the mouse, which acts as touch in forced mode.

Report what you saw, with the screenshots.

- [ ] **Step 4: Update the docs**

`README.md`:
- **Play:** phones and tablets play in landscape by touch. The file runs on Android and desktop. iPhones need the GitHub Pages address, once set up.
- A touch-controls table.
- The new settings.

`CLAUDE.md`:
- the `T:` keys and how `held`/`hit` read them;
- `TOUCH` and `touchLayout`, with the rule that every control comes from the layout;
- `?touch=1`;
- the `DEVICE` runner and `touch-all.mjs`;
- t13, t14 and t15 in Testing.

Also:
- add "touch layout" and "touch input" to the backlog's lane list;
- add to Known problems: "iPhones cannot run the file directly; they need the GitHub Pages address".

- [ ] **Step 5: Run the whole suite**

Run:

```bash
node build.mjs
for t in t1 t2 t3 t4 t5 t6 t7 t10 t12; do SCRIPT=$PWD/tests/$t.mjs node test.mjs smoke || echo "FAIL $t"; done
for t in t8 t9; do SCRIPT=$PWD/tests/$t.mjs node test.mjs hub || echo "FAIL $t"; done
SCRIPT=$PWD/tests/t11.mjs node test.mjs smoke
SCRIPT=$PWD/tests/t13.mjs node test.mjs title
node tests/touch-all.mjs tests/t14.mjs
node tests/touch-all.mjs tests/t15.mjs
```

Expected: no `FAIL` lines, every run ends `all passed`. If one of t1 to t4 or t7 already failed on `main` before this branch, show that with a run on `main` and say so rather than editing it.

- [ ] **Step 6: Commit**

```bash
git add tests/t15.mjs README.md CLAUDE.md
git commit -m "test: touch screenshots on every device; docs for touch play"
```
