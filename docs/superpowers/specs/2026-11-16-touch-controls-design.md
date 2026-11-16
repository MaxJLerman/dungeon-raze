# Touch controls: design

Date: 2026-11-16. Status: awaiting the owner's approval. Reviewed once by a builder check.

## Intent

The game needs a keyboard and a mouse, and the title screen says so on touch
devices. The owner calls the missing touch version the biggest setback: most
people who open a link to the game will do it on a phone. This adds on-screen
controls for phones and tablets so the whole game, menus included, can be
played by touch.

The hard part, and the part the owner stressed, is the range of screens. A
5-inch phone in landscape is 640×360 CSS pixels; a 13-inch iPad is 1376×1032.
Controls must stay reachable and big enough to hit on the smallest, must use
the extra room on larger screens, and must stop growing at a cap so a tablet
keeps most of its screen free for dragging the camera. This must be tested
across many sizes and aspect ratios, not eyeballed on one.

## Goals

1. On a touch device every play action can be performed by touch: move,
   sprint, look, attack, heavy, guard (tap to parry, hold to block), dodge,
   lock on, switch lock target, ability, tool, flask, pause.
2. The controls use the layout the owner picked from mockups (H1b, below).
3. Every control's size and position comes from one layout function of the
   screen size, the safe-area insets, the size slider and the notch setting. Nothing is
   placed by hand per device.
4. On every supported screen: every button is at least 46 CSS px across its
   flat sides (about 7 mm on phones), no two controls overlap, nothing sits under a notch,
   rounded corner or home bar, and no control covers the health bars, the
   map, the pause button or the boss bar. The notch rule is skipped only when the player has
   switched notch clearance off (goal 5).
5. Three settings, saved with the others: button size, button opacity, and
   whether controls keep clear of the notch and rounded corners.
6. Menus (title, pause, class, how to play, controls, death, win) are usable by
   finger on a 640×360 screen.
7. Keyboard and mouse play is unchanged.
8. A test suite proves goals 3 and 4 across a device list and a sweep of sizes,
   and proves by simulated multi-finger touch that each control does what it
   should.

## Non-goals

- A layout editor for moving or resizing individual buttons. The owner chose
  automatic sizing with two sliders over that.
- Portrait play. Portrait shows a "turn your device" screen.
- Gamepad support (still in the backlog), haptics, installing as a home-screen
  app.
- Setting up GitHub Pages. It is agreed and comes as a separate small job
  after this one.
- Running inside an iframe, such as the hosted page.
- Making the renderer faster on phone GPUs. If frame rate on phones is poor,
  that is a separate piece of work. Note it if seen.
- Rebalancing combat for touch.

## Anti-goals

- Any screen in the supported range where a button is off screen, under a
  notch, overlapping another, or too small to hit. This is the failure the
  owner cares about most.
- Controls that grow without limit on tablets and eat the camera area.
- Touch handling that breaks keyboard and mouse play, or that fires when the
  player is using a mouse.
- Browser gestures leaking into play: page scroll, pinch zoom, double-tap zoom,
  pull to refresh, text selection, the long-press menu.

## Constraints

- Everything from `CLAUDE.md` applies: one concatenated scope with no imports,
  no dependencies, no network at run time except Google Fonts, `node build.mjs`
  after every change.
- **How players get the game.** The owner sends `dist/index.html` from a
  OnePlus 13 or a Mac. Friends play on Windows, Mac and iPhone. Android and
  desktop browsers run the file directly. iPhones cannot: the Files preview
  runs no JavaScript and Safari will not open local files. iPhone players will
  use a GitHub Pages address, which serves the same file as a top-level page.
  So the game always runs as the whole page, never inside someone else's
  frame, and this design does not cater for being framed.
- Fullscreen and orientation lock must start from a tap handler and their
  refusal must be caught. iPhone Safari has no fullscreen API and no
  orientation lock at all, so the layout must work with the browser bar
  showing and must re-run whenever the visible area changes.
- Pointer lock does not exist on touch devices. Touch play runs as if
  `G.noLock` were set.
- The browser cannot report a screen's physical size. Sizes are in CSS pixels,
  which on phones and tablets are about 130 to 165 per inch. The 46 px floor
  was chosen so the smallest button is at least 7 mm on every device in the
  list below. It is measured across the hexagon's flat sides, the narrow way,
  because that is what decides whether a thumb lands on it.
- Sizes are taken from the visible area, not the physical screen. On an
  iPhone the browser bar always takes some of it, and an Android phone keeps
  its bar until fullscreen is granted, so several current phones have a
  visible short side under 320 px (Pixel 9 at 308, Pixel 5 at 293).
- A page cannot block the system's edge swipes (Safari's swipe back, Android's
  back gesture, the home-bar swipe).
- Chromium's emulation cannot fake safe-area insets. The layout function takes
  the insets as inputs so tests can pass them in.
- The renderer already caps the pixel ratio at 1.5 (`02_gl.js`), so a 3× phone
  does not draw at full resolution.

## Approaches considered

1. **One layout function, one touch handler, one SVG overlay. Chosen.**
   A pure function returns every shape. One SVG layer draws them. One handler
   follows every pointer and gives it to whatever it first touched. Tests can
   call the function for any size and check exactly the geometry that fingers
   hit.
2. **A separate HTML element per button with its own listeners.** Closest to
   the current HUD. Rejected: hexagons need CSS clipping, so the drawn shape
   and the hit area can drift apart, and several fingers at once are harder to
   route correctly.
3. **Controls drawn into the game canvas.** Full visual control. Rejected:
   hand-written drawing and hit-testing, and tests cannot read the layout from
   the page.

The owner picked 1.

## What the owner decided

### Layout (mockup H1b, "hexagons on a honeycomb")

Landscape. All buttons are flat-topped hexagons on one honeycomb grid in the
bottom-right corner.

- **Attack** is the large hexagon in the corner, its flat bottom on the bottom
  margin.
- Let `D` be the centre spacing of neighbouring mid-size cells:
  `D = mid × 0.866 + gap`, so neighbouring mid buttons are exactly one gap
  apart, flat side to flat side.
- From Attack's centre, angles measured anticlockwise from screen-right:
  - **Dodge** at distance √3·D, 180°
  - **Guard** at 2·D, 150°
  - **Heavy** at √3·D, 120°
  - **Lock** at 2·D, 90°
  - **Flask** at √7·D, 169.1°
  - **Tool** at √7·D, 130.9°
  - **Ability** at √7·D, 109.1°
- Attack is the large size, the four above it mid size, the last three small.
- Each button's touch area is its hexagon.

The mockup page that produced this is kept at
`.superpowers/brainstorm/*/content/touch-honeycomb.html` (not committed). Its
`honeycomb()` and `sizes()` functions are the reference implementation of the
geometry.

### Movement and sprint

- The stick appears where the left thumb lands, anywhere in the movement area:
  the left 42% of the screen, below the health bars.
- Pushing the stick past a dashed ring at 1.45 times its radius sprints, as in
  the football game the owner referenced. There is no sprint button.
- Walking speed follows how far the stick is pushed, instead of today's
  all-or-nothing keys.

### Camera

Dragging anywhere that is not a button and not in the movement area turns the
camera.

### Sizing

Sizes come from the short side `s` of the visible area in CSS px (its height,
in landscape):

| Part             | Rule                                   |
| ---------------- | -------------------------------------- |
| Attack           | clamp(s × 0.200, 66, 104)              |
| Mid buttons      | clamp(s × 0.135, 56, 74)               |
| Small buttons    | clamp(s × 0.100, 54, 56)               |
| Gap              | clamp(s × 0.022, 6, 14)                |
| Edge margin      | clamp(s × 0.040, 12, 32) + safe inset  |
| Stick radius     | clamp(s × 0.150, 52, 92)               |
| Sprint ring      | stick radius × 1.45                    |
| Map              | clamp(mid × 1.5, 70, 130), see below   |

Widths in the table are corner to corner. A flat-topped hexagon is 0.866 of
that across its flat sides, so the small floor of 54 gives 46.8 px the narrow
way, and the mid floor of 56 gives 48.5. (The mockup used 46 and 50 corner to
corner; the builder check pointed out that left the small buttons at 40 px
the narrow way.)

On short screens the map shrinks so that it ends one gap above the top of the
honeycomb, down to a floor of 56 px.

The floors keep small phones usable. The caps keep tablets mostly free for
the camera: in the mockup the right half of a 13-inch iPad stayed 92% free.
These numbers are a first draft and may be tuned in the owner's playtest.

### Settings

- **Button size:** a slider from 80% to 120%, default 100%. It multiplies
  Attack, mid, small and stick sizes. The floors still apply after scaling.
  If a scale does not fit the screen, the layout uses the largest scale that
  does, so the guarantee in goal 4 holds at every slider value.
- **Button opacity:** a slider. A pressed button lights up fully whatever the
  setting.
- **Keep clear of the notch and rounded corners:** on or off, default on. The
  owner asked for this so players can decide for themselves. On, the layout
  adds the device's safe-area insets to the edge margins, as in the mockup.
  Off, it ignores them and uses the plain edge margins, so controls sit nearer
  the screen edges and a little more room is left for the camera. The setting
  is explained in one line: off can put buttons under the notch or a curved
  corner, where touches may not register. Off changes nothing on a device with
  no insets. For the insets to be readable at all the page needs
  `viewport-fit=cover` in its viewport tag, which also lets the game draw
  under the notch whatever the setting.
- The existing look sensitivity and invert settings apply to touch look too.
- On touch devices, the controls screen shows these settings instead of the
  key bindings.

## Decisions made by me, open to the owner

- **When touch controls show:** at start if the device reports a coarse
  pointer or touch support, and whenever a touch arrives. They hide when a
  key is pressed or the mouse moves, and come back on the next touch.
- **Touch presses actions, not keys.** A touch on Guard makes `held("guard")`
  and `hit("guard")` true directly, whatever the key bindings are. Keyboard
  and touch can be used together.
- **One finger, one control.** A finger belongs to whatever it first touched
  until it lifts. Sliding off a button does not press another. A finger that
  starts on a button keeps it held even if it drifts off.
- **Switching lock target:** while locked on, a quick sideways flick in the
  camera area moves to the next target. It does what the mouse wheel does now.
- **Pause:** a small button left of the map, sized like the small buttons.
- **Charges on buttons:** Flask and Tool show how many uses remain. Ability
  shows when there is enough focus. Empty buttons dim.
- **Boss bar:** moves to the top centre in touch mode. The bottom is taken by
  controls. The control-hint line at the bottom is hidden in touch mode.
- **Portrait:** a full-screen "turn your device" message. If it appears during
  play the game pauses.
- **Fullscreen:** the play button asks for fullscreen and landscape lock where
  the browser allows. Refusal is caught and ignored.
- **Supported range:** landscape, with a visible short side of 280 CSS px or
  more. That covers phones whose browser bar is showing. Tests promise goal 4
  from 280 up. A check of the geometry across the sweep below found that the
  honeycomb fits at 100% everywhere in that range once the map shrinks. On
  phones with a short side under about 300, and tablets with a short side
  between 500 and 650, the 120% setting falls back to 110%, 100% or 90%. The
  rule "use the largest scale that fits" covers that.
- **Screen edges:** the movement area starts 16 px in from the left edge, so a
  thumb near the edge is less likely to trigger the system back swipe. When
  the game is the top-level page, pressing Back during play opens the pause
  screen instead of leaving.
- **Boss bar:** in touch mode it sits at the top between the health bars and
  the pause button. Where that space is under 160 px wide, it sits under the
  health bars instead.
- **Aiming with one thumb:** a finger that holds Attack and drags also turns
  the camera, as the fire button does in mobile shooters. Without this the
  Ranger and Mage would need a second finger to aim while shooting. It applies
  to every class; for melee classes it simply turns the camera. There is no
  extra aim assist for touch.
- **Browser gestures** are blocked on the play area and controls: no scroll,
  zoom, pull to refresh, selection or long-press menu. Menus may still scroll
  if they do not fit.
- **Testing on a desktop:** adding `?touch=1` to the page address forces touch
  mode and lets mouse clicks act as touches. The owner can try it at any window
  size, and so can a resized Chrome window. In that mode a small readout shows
  the visible size, the insets and the button scale in use, so the owner can
  read the real numbers off the OnePlus 13 and add them to the device list.

## Testing

Run with Playwright as the other tests are, with touch and mobile emulation
turned on.

1. **Layout sweep, no rendering.** Call the layout function in the page for
   every short side in steps of 10 px, at slider values 80%, 100% and 120%.
   - Phones, short side 280 to 499: aspect ratios 16:9, 2:1, 19.5:9, 20:9 and
     22:9. Insets of none and 24 px each side. From 320 up, also iPhone insets
     of 47 px each side and 21 px at the bottom.
   - Tablets and foldables, short side 500 to 1100: ratios 1.2:1 (an open
     foldable), 4:3, 1.43:1, 3:2 and 16:10. Insets of none and 20 px at the
     bottom.
   Every case runs with notch clearance on and off. Each must pass every check
   in goal 4 at the scale the layout settles on, and at 100% that scale must
   be 100%. Report the worst case for each
   check.
2. **Device list, rendered.** In landscape: iPhone SE, a current iPhone, a
   large iPhone, a Pixel 9 or newer (308 px short side), a Galaxy, a 640×360
   Android, the owner's OnePlus 13 (estimated at about 905×412 in landscape
   before browser bars; to be confirmed on the phone, see below), an iPad Mini (the 1133×744 model), an 11-inch iPad and a 13-inch
   iPad Pro (1376×1032). Playwright has no 13-inch iPad Pro and its iPad Mini
   is the old 1024×768 model, so those two and the OnePlus 13 are custom
   entries. For each: the
   layout checks again on the real page, and a screenshot of the hall and of
   a cave fight to `shots/`.
3. **Every button works.** On each device, a touch at each button's centre
   fires its action once, a held touch on Guard holds guard, and a touch in
   each gap between buttons fires nothing and turns the camera instead.
4. **Several fingers at once.** Stick, camera drag and Attack held together all
   register. Lifting one does not release the others.
5. **Stick.** A small push walks slowly, a full push runs, past the ring
   sprints. Lifting stops the player.
6. **Lock flick.** With two enemies in range, a flick moves the lock to the
   other.
7. **Notch clearance.** On a device entry with insets, switching the setting
   off moves the controls toward the edges by exactly the insets, and back
   again when it is switched on. The choice survives a reload.
8. **Aim while attacking.** Holding Attack and dragging turns the camera, and
   lifting releases Attack.
9. **Mode switching.** A key press hides the controls, a touch shows them.
   With touch hidden, mouse play still works exactly as before.
10. **Portrait.** Rotating to portrait shows the message and pauses play.
11. **Menus at 640×360.** Every menu button can be reached and tapped.
12. **The existing tests still pass.**

A visual pass in a real Chrome window, resized to several of the sizes above
with `?touch=1`, completes the check. Screenshots are the only check on looks.

## Left to the builder

- How the layout function, overlay and handler are split across `src/` files,
  and their names.
- How the hexagon hit test is written.
- How `playerUpdate` takes the stick's direction and strength, as long as
  keyboard movement is unchanged.
- The look sensitivity for touch drags, starting from "a drag across the full
  screen width turns about 180°" before the sensitivity slider.
- The dead zone of the stick and the flick speed and distance for switching
  lock.
- Labels or icons on buttons, colours and the pressed look, keeping to the
  game's palette and the mockup.
- Whether the test runner gains a mode for device emulation or the touch tests
  get their own runner.
- Updating `README.md` and `CLAUDE.md` with the new controls and tests.
