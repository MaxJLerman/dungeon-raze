# Touch (`08b_touchlayout.js`, `08c_touch.js`)

- `touchLayout(W, H, insets, { size, notch })` is a pure function. It returns
  every position: `btns` (`{ act, x, y, d }`, `d` is corner-to-corner width),
  `pause`, the stick area `move`, its resting place `rest`, radius `R` and
  sprint `ring`, and the `vitals`, `map` and `boss` boxes for the HUD. It
  tries the requested size and steps down by 0.05, to 0.8 at the least, until
  `layoutProblems(L)` finds nothing. `L.scale` is the size it used.
- **Every control comes from the layout.** Nothing else in `src/` holds a
  pixel position for a touch control. The overlay is an SVG drawn from
  `TOUCH.layout`, hit-testing is `hexContains` on the same entries, and
  `place()` writes the HUD boxes as inline styles. To add a button, add it to
  `TOUCH_BTNS` and `LOOK`, give it a spot in `layoutAt`, and make
  `layoutProblems` pass on every device in `tests/devices.mjs`.
- The sizes, button positions and margins are in the comments and code of
  `layoutAt`. They derive from the short side of the screen. The button
  arrangement is one the owner drew on a OnePlus 13 (905 by 412): each
  button sits a set gap from the one it hangs off, in the direction that
  layout had, and `tests/t13.mjs` holds it to within 3 px there.
- `TOUCH` is the controller. A finger belongs to the control it first touched
  (`TOUCH.owners`, keyed by pointer id) until it lifts: a button, the pause
  square, the stick or the camera. A second finger in the stick area turns the
  camera. `release()` drops every finger and every `T:` key, and runs when the
  state leaves play, on every relayout and when touch mode turns off.
- The stick lands where the thumb does. `TOUCH.move` is `{ x, y, mag }`, and
  `playerUpdate` uses it in place of the movement keys while `mag > 0`, with
  `mag` scaling walk speed. A drag of the camera area is added to `mouse.dx`
  and `mouse.dy`, as a mouse would be. The Attack finger aims after it moves
  8 px. A quick sideways swipe of a camera finger while locked sets
  `mouse.wheel`, which switches the lock.
- **Touch mode.** `TOUCH.on` is set at start when the browser reports a coarse
  pointer, or no hover with touch points, or the URL has `?touch=1`
  (`TOUCH.forced`). It adds `body.touch`, which the CSS uses to show the
  buttons and hide keyboard-only parts. Unless forced, the last input decides:
  a key or a mouse move turns it off, a touch turns it on, and that touch is
  handled as the first press on the controls. Volume and media keys, an
  on-screen keyboard's composition and unidentified keys do not count as a
  keyboard. A forced page ignores the mouse and shows a readout of size,
  insets and scale.
- Layout follows the visible size and the safe-area insets, read through a
  hidden probe element with `env(safe-area-inset-*)`, which is read again only
  after a resize, orientation or visual viewport event or a `TOUCH.relayout()`
  call. `update` compares the size and settings every frame, and those events
  call `relayout` only when that comparison changed, so a resize that changed
  nothing keeps the fingers.
  Tests fake the insets with `window.__fakeInsets` or `TOUCH.fakeInsets`.
- Held upright, a touch device gets `body.portrait`, which shows `#rotate`
  ("Turn your device sideways to play.", with a smaller line about rotation
  lock) over everything, and the game pauses. A tap on it asks for fullscreen
  and a landscape lock (`goLandscape`), for phones with auto-rotate off; it
  does not arm Back or start play. The layout is made for a visible short side
  of 280 px or more.
- `TOUCH.enterPlay` runs from the play tap: one history entry so that Back
  pauses the game, then `goLandscape` (fullscreen, then a landscape lock).
  `popstate` under touch pauses from play and arms another entry. From the
  pause, dead and win screens it only arms another, and from a menu it goes
  to the menu's return screen as that screen's Back button does, so a second
  Back does not leave the page. `TOUCH.menuOpen`, which `openMenu` calls
  for a menu opened over the main menu, arms the entry too, so Back on the
  class screen, the room screen, How to play or Controls returns to the
  main menu even before the first play (`tests/t30.mjs` checks it with a
  real `history.back()`, since a made-up `popstate` cannot tell). Back is
  not caught on the main menu itself; an entry left armed there (the
  menu's own Back button was used) takes one Back that does nothing. Each
  of fullscreen and the lock can be refused or missing, as on iPhone, and
  every refusal is caught.
- Under touch the game also pauses when fullscreen ends (Android's Back
  leaves fullscreen first and sends no `popstate`), when the page is hidden
  and when the window loses focus. Resume asks for fullscreen again. Desktop
  keeps its own rule, pausing when pointer lock is lost. A test that calls
  `exitFullscreen` in play therefore ends up paused.
- Plaques by touch. The layout gives `prompt` (the Inspect prompt, tapped to
  open; the first of four spots clear of buttons and HUD), `dpad` (in the
  stick area) and `close` (the card's box; a tap on the card closes it).
  `layoutProblems` checks all three. While a plaque is open, `classify`
  sends the D-pad arms as `T:fwd`, `T:back`, `T:left`, `T:right`, the buttons
  as usual, the card as `T:interact`, and nothing else. The D-pad replaces
  the stick in the SVG only then. `place()` sizes the prompt and the card.
- Settings are `OPT.tsize` (0.8 to 1.2), `OPT.topac` (0.2 to 1) and
  `OPT.tnotch`, saved under `o` in `dungeon-raze.v2` and set in the Controls
  menu. Menu text that differs by input uses `.kbonly` and `.touchonly`, or
  `.lk-mouse` and `.lk-touch` inline. The Execute prompt and the class kit
  show the button names (ATTACK, HEAVY, TOOL, ABILITY) under touch, and How to
  play names the pause button. Button hover styles apply only where
  `(hover: hover)`, so a tap leaves nothing highlighted.
- The stick lands where the thumb does, but its origin is clamped so the stick
  body stays inside the stick area, clear of the health bars. Landing at an
  edge therefore starts with the stick already pushed.
- Under touch the HUD hides the flask and tool counts, because the Flask and
  Tool buttons show them, and the boss name plate is held inside the boss box.

## Tests

- Run `tests/t13.mjs` after any change to `touchLayout`. It runs on the plain
  desktop page: `SCRIPT=$PWD/tests/t13.mjs node test.mjs title`.
- Run `tests/t14.mjs` on every device after any change to the touch controller,
  the touch HUD or menus on small screens:
  `node tests/touch-all.mjs tests/t14.mjs`. Touch steps send real touches, so
  they wait two animation frames before reading the result, compare positions
  with a tolerance, and read `TOUCH.owners` by iteration because the browser
  numbers pointers itself.
- Run `tests/t15.mjs` on every device to look at the controls over the hall
  and over a fight. Open `shots/<device>-touch-hall.png` and
  `shots/<device>-touch-fight.png` and check them by eye.

## Known problems

- iPhones cannot run the file directly; they play at
  https://maxjlerman.github.io/dungeon-raze/.
- Touch was checked only in Chromium device emulation. Fullscreen, the
  orientation lock and the Back gesture in particular have not run on a real
  phone or on Safari.
- A swipe to switch lock target picks the next target without regard to the
  direction of the swipe.
- `tests/t14.mjs` fails two steps on every device (`node tests/touch-all.mjs
  tests/t14.mjs`, 12 of 12): "controls screen shows touch settings" (keys
  `label` and `note` false: the notch label and note text it expects) and
  "the rotate screen takes a tap" (key `line` false: the line under the
  rotate message). Seen on 239d320, before the main menu and the co-op
  lobby, and unchanged by `feat/coop-lobby`. The cause is not
  investigated; the page text may have changed and not the test.
- `tests/t14.mjs` on ipad-pro-13 fails the step "leaving fullscreen during
  play pauses" now and then. It fails on `main` before the Warden for two
  too (3 runs of 4 on ddc360e). The cause is not investigated.
