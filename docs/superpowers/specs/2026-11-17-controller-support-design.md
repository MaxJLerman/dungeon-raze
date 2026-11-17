# Controller support: design

Date: 2026-11-17. Status: awaiting the owner's approval. Reviewed once by a builder check.

## Intent

The game can be played with a keyboard and mouse, or by touch. The owner wants
to play it with a controller too, in all three places they play: on a couch in
front of a TV, at a laptop, and on a phone with a Bluetooth pad paired. A wired
Xbox controller and a Bluetooth DualSense are the examples, and any controller
the browser recognises should work.

The combat is meant to feel Soulslike, so the default buttons follow the
Soulslike convention. Players can rebind them, as they can rebind keys.

## Goals

1. With a controller connected, every play action works from the pad: move
   (analog, with walk speed following how far the stick is pushed), sprint,
   look, attack, heavy, guard (tap to parry, hold to block), dodge, lock on,
   switch lock target, ability, tool, flask, pause.
2. Every screen works from the pad with no mouse: title, pause, class picker,
   controls, how to play, death, win. On the couch there is no mouse.
3. The default layout is the one the owner picked (below), and every action
   that has a button can be rebound to another pad button in the Controls
   menu, separately from its key.
4. A setting in the Controls menu hides the touch buttons and stick while a
   controller is connected, so a phone with a pad shows a clean screen.
5. Prompts name pad buttons when the pad was the last input used: the hint
   line, the Execute prompt, the class kit, the Controls menu and How to play.
   They name PlayStation buttons for a PlayStation pad and Xbox buttons for
   everything else.
6. Rumble on the main combat beats where the browser supports it, with a
   setting to turn it off.
7. Keyboard, mouse and touch play are unchanged.

## Non-goals

- The DualSense light bar, adaptive triggers, touchpad and motion sensors.
  These need WebHID, which is Chrome only and asks for permission.
- More than one player. Any connected pad drives the one player.
- Button images. Names are text, and PlayStation symbols are Unicode
  characters (✕ ○ □ △).
- Rebinding the sticks, the pause button or the menu buttons (A/Cross,
  B/Circle in menus).

## Anti-goals

- Breaking keyboard, mouse or touch play in any way, including the tests that
  cover them (`t6`, `t10`, `t12`, `t13`, `t14`).
- A pad that leaves the player stuck on a screen they can only leave with a
  mouse or a tap.
- A pad press that throws an error because the browser refused fullscreen,
  pointer lock, audio or vibration.

## Constraints

- The rules in `CLAUDE.md` apply: no dependencies, everything generated in
  code, `node build.mjs` after every change, one shared scope across `src/`.
- **The page can't see a pad until a button is pressed on it.** Browsers hide
  connected pads until then. Nothing can show "controller connected" before
  the first press.
- **A pad press may not count as a click.** Browsers only allow fullscreen,
  pointer lock and starting audio from a user action. Firefox counts a pad
  press as one. Chrome does so through a check made while the page reads the
  pad, and older reports disagree on how far a button must be pressed. Safari
  has reported fullscreen refusing a pad press. Every such call made from a pad
  press must be tried and its refusal caught. Audio that didn't start must be
  tried again on later input.
- **Mapping.** Browsers report Xbox and DualSense pads in one "standard"
  layout (`gamepad.mapping === "standard"`) in Chrome, Edge and Safari.
  Firefox only recently fixed DualSense mapping (Mozilla bug 1849039), and a
  newer report (bug 2041300) describes DualSense trouble on Windows and macOS.
  A pad with an empty `mapping` reports raw driver order.
- **Pages served in a frame.** Pad access is controlled by the `gamepad`
  permissions policy. Its default is now to allow all frames, but if a host
  blocks it `navigator.getGamepads()` throws a `SecurityError`. That has to be
  caught and controller support quietly switched off.
- The pad is read by polling `navigator.getGamepads()`, once per animation
  frame, before `update` runs so that taps land in the same frame.

## Approaches considered

1. **Pad as a third input source beside keyboard and touch (chosen).** Pad
   buttons get their own codes, `P:0` to `P:17`, kept in `keys` and `taps`
   the way touch uses `T:`. A new table, `PAD_BIND`, maps each action to a pad
   code. `held()` and `hit()` read it beside the key and the touch code. The
   left stick feeds a movement vector the way the touch stick does. The right
   stick turns the camera. Combat code doesn't change.
2. **One table holding keys and pad buttons for each action.** `BIND` would
   store a list of codes per action. That's cleaner on paper, but it rewrites
   saving, loading, the swap rule in `setBind` and every prompt, and changes
   saved settings players already have. Nothing extra comes out of it.
3. **Pad presses faked as key presses.** This is the least code, but it loses
   analog movement, pad button names and separate rebinding. Dropped.

For menus, focus moves by direction: the D-pad or left stick jumps to the
nearest control in the direction pressed. Stepping only to the next or
previous control was considered and dropped, because it feels wrong on the
grid of class cards.

## What the owner decided

- Playing on a TV, a laptop and a phone with a pad.
- A Controls menu setting that hides the touch controls while a controller is
  connected.
- Soulslike default layout, rebindable.
- Approach 1, with directional menu focus.
- Sprint on L3 by default, so dodge stays on B/Circle and fires on press.
- **Sprint is a click, not a hold.** Pressing the pad's sprint button starts
  sprinting, and the sprint lasts until the left stick returns to centre or
  stamina runs out. Pressing it again while sprinting stops it. This is
  `PAD.sprint`, a latch that `playerUpdate` reads beside `held("sprint")`, so
  `p.sprint` and the dash attack work as they do now. It follows the binding,
  so a sprint rebound to a face button works the same. The keyboard's Shift
  stays a hold.
- **Starting play from the pad on a laptop or TV tries fullscreen**, if the
  browser allows it, and runs in the window if it refuses. Leaving fullscreen
  (Esc) pauses, as it does under touch.

### Default layout

Indices are the standard mapping's button numbers.

| Action | Code | Xbox | PlayStation |
|---|---|---|---|
| Attack (`light`) | `P:5` | RB | R1 |
| Heavy (`heavy`) | `P:7` | RT | R2 |
| Guard and parry (`guard`) | `P:4` | LB | L1 |
| Class ability (`special`) | `P:6` | LT | L2 |
| Dodge (`dodge`) | `P:1` | B | ○ |
| Sprint (`sprint`) | `P:10` | LS | L3 |
| Lock on (`lock`) | `P:11` | RS | R3 |
| Drink a flask (`heal`) | `P:2` | X | □ |
| Class tool (`tool`) | `P:3` | Y | △ |
| Sound on or off (`mute`) | unbound | | |
| Pause (fixed) | `P:9` | Menu | Options |
| Move (fixed) | left stick | | |
| Look (fixed) | right stick | | |
| Switch lock target (fixed) | right stick flick while locked | | |

A/Cross (`P:0`), View/Create (`P:8`) and the D-pad (`P:12` to `P:15`) are free
during play and can be bound. `P:16` (Xbox or PS button) is usually taken by
the system and is not offered. `P:17` (DualSense touchpad click, in browsers
that report it) can be bound. Triggers count as pressed past half travel.

In menus: D-pad or left stick moves focus, A/Cross presses, B/Circle goes back,
Menu/Options resumes from the pause screen. In play, Menu/Options pauses, and
on the pause screen B/Circle resumes too.

## Decisions made by me, open to the owner

- **New file `src/08d_pad.js`** holding a `PAD` controller, beside `TOUCH`.
  `frame()` calls `PAD.poll(dt)` first. Every name in it is new across `src/`.
- **Input mode.** `PAD.active` is true when the pad was the last input. It
  adds `body.pad`. A pad press sets it. A key, a mouse move or a touch clears
  it. A pad press does not turn touch mode off, because `body.touch` also
  drives the HUD layout on a phone. Prompt text picks pad names first, then
  touch names, then key names. `both()` in `09_main.js` becomes a three-way
  helper with `.lk-pad`, and the CSS gets `.padonly` beside `.kbonly` and
  `.touchonly`.
- **Hide touch buttons** is `OPT.padHideTouch`, on by default. "Connected"
  means a pad has been pressed and is still connected. While hidden, the
  buttons and stick are neither drawn nor hit-tested, and camera drag still
  works. The pause square stays visible so a finger can still pause. They come
  back when the pad disconnects or the setting is turned off. The setting
  shows in the Controls menu on every device, since a laptop with a touch
  screen counts too.
- **Sticks.** Radial dead zone 0.2 with the rest rescaled to 0..1. The left
  stick sets `PAD.move = { x, y, mag }`, and `playerUpdate` uses it the way it
  uses `TOUCH.move`, with touch taking priority if both are pushed. The right
  stick turns the camera with a squared response curve for fine aim. Its speed
  has its own slider, `OPT.psens` (0.2 to 3, default 1), because a stick's
  rate and a mouse's counts aren't on the same scale. At 1, full deflection
  turns about 3 radians a second across and 1.8 up and down. Invert Y is
  shared with the mouse.
- **Lock switch.** While locked, a right stick flick (past 0.7 across, after
  being inside the dead zone) sets `mouse.wheel` to its sign, as the touch
  swipe does. It needs to come back to centre before the next flick.
- **Sprint speed needs a real push.** With the latch on, the player runs only
  while the left stick is pushed past 0.6, and walks below that. This matches
  the touch stick's ring and stops a nudge giving full run speed.
- **Pause and focus.** Disconnecting the pad in play pauses. Starting play
  from a pad press skips pointer lock (a stick doesn't need it), so losing
  lock doesn't pause either. Leaving fullscreen pauses instead. In a session
  with no pointer lock, Esc and P both pause from the keyboard, as P does in
  the `G.noLock` fallback. If the player then clicks, the existing mouse
  handler asks for lock as it does now. `SFX.init()` is tried again on every
  pad press, key press and click until audio is running.
- **Several pads.** All connected pads are read. Their buttons are merged and
  the stick with the larger push wins. The last one pressed decides the button
  names.
- **Pad family.** PlayStation if the `id` holds the Sony vendor id `054c` or
  "DualSense", "DualShock" or "Wireless Controller"; Xbox names for everything
  else.
- **Unrecognised mapping.** A pad whose `mapping` isn't `"standard"` is still
  read with standard numbers. The Controls menu then shows a line saying the
  buttons may be mixed up, can be rebound, and work best in Chrome or Edge.
  The sticks may be wrong on such a pad, and that is accepted.
- **Menu focus.** Focus moves between visible, enabled buttons, cards, range
  inputs and checkboxes on the shown screen, picking the nearest in the
  pressed direction by the centres of their bounding boxes. Holding repeats
  after 0.35 s, then every 0.12 s. When a screen opens in pad mode, its first
  button is focused (Play on the title, Resume on pause, Rise on death). A
  `.padfocus` outline marks the focus, because a script `focus()` doesn't
  always show the browser's own ring. Left and right on a focused range input
  step it and fire its `input` event. A/Cross on a checkbox toggles it and
  fires `change`. The focused control scrolls into view.
- **B/Circle in menus** does what that screen's Back button does: a menu in
  `MENUS` returns to `menuBack`, pause resumes, and title, death and win do
  nothing.
- **Rebinding.** The Controls list gets a second column, "Controller". Pressing
  a controller binding waits until every pad button is released, then shows
  "Press a controller button". The next pad button binds it, using the same
  swap rule as `setBind`. Menu/Options cancels. The movement rows show "Left
  stick" and can't be rebound on the pad. Pad focus skips the keyboard
  column, so a couch player can't start a key wait they can't finish. If a key
  wait was started by mouse, any pad button cancels it. A key press while a pad
  binding is waiting cancels that. Under `body.touch` the CSS hides `#binds`.
  With a pad connected, the Controller column shows there and the keyboard
  column stays hidden.
- **Held buttons across a screen change** must be released before they count
  again, so Menu/Options held to resume doesn't pause again, and A/Cross held
  on Play doesn't attack.
- **Flask and tool counts.** The touch HUD hides them because the buttons show
  them. While `padHideTouch` hides the buttons, the counts show again.
- **TV-sized text and HUD are out of scope.** If the owner wants them for the
  couch, they're a separate piece of work across the HUD and menu CSS.
- **Saving.** `PAD_BIND` saves under `p` in `dungeon-raze.v2`, and `psens`,
  `padHideTouch` and `rumble` save in `o`, each validated on load as the
  existing settings are. Defaults resets the pad table and settings too.
- **Rumble**, `OPT.rumble`, on by default, through
  `gamepad.vibrationActuator.playEffect("dual-rumble", ...)`. Every call is
  guarded and its promise's rejection caught. Effects:

  | Event | Duration | Strong | Weak |
  |---|---|---|---|
  | Player hurt | 160 ms | 0.7 | 0.4 |
  | Guard break | 260 ms | 1.0 | 0.6 |
  | Perfect parry | 90 ms | 0 | 0.9 |
  | Heavy attack lands | 90 ms | 0.5 | 0.3 |
  | Execute | 220 ms | 0.8 | 0.5 |
  | Death | 500 ms | 1.0 | 1.0 |

  The hooks are one `PAD.rumble(kind)` call at each place in `hurtPlayer`,
  `hitEnemy`, the execute case and death. It does nothing unless the pad was
  the last input.
- **Names in prompts.** The pause button is named in How to play ("Menu" or
  "Options"). The Execute prompt shows the attack button, for example "RB
  Execute" or "R1 Execute".

## Testing

- New `tests/t16.mjs`, run with `smoke` (cave) and `hub`. It fakes pads by
  replacing `navigator.getGamepads` in the page with a function returning
  plain objects (`{ id, index, connected, mapping, buttons: [{ pressed, value }],
  axes, vibrationActuator }`), and moves them through `DF.sim` steps. It
  covers:
  - each default binding reaching its action through `held` and `hit`
  - triggers at 0.4 doing nothing and at 0.6 pressing
  - the dead zone, and walk speed scaling with stick push
  - the sprint latch: on with a press, off on centre, on empty stamina and on
    a second press; walking below 0.6 push; the dash attack from it
  - right stick turning the camera, invert Y, `psens`
  - a flick switching the lock target, and a held stick not repeating it
  - pause on Menu/Options, resume from pause, pause on disconnect, pause on
    leaving fullscreen, Esc and P pausing a session with no pointer lock
  - pad focus never landing on a keyboard binding, and a pad press cancelling
    a key wait
  - `PAD.active` and `body.pad` set by a pad press and cleared by a key, a
    mouse move and a touch
  - prompts switching between key, touch and pad names, PlayStation and Xbox
  - menu focus moving in all four directions on every screen, A pressing,
    B going back, range and checkbox handling
  - rebinding with the swap rule, cancel on Menu/Options, save and reload
  - touch buttons hidden under `padHideTouch` on a phone device, and shown
    again on disconnect and with the setting off
  - a `getGamepads` that throws, and a `vibrationActuator` that is missing or
    rejects, raising no error
- Screenshots of the Controls menu and a fight in pad mode on desktop and on
  one phone device, checked by eye.
- Existing `t6`, `t10`, `t12`, `t13`, `t14` and `t15` still pass unchanged.
- Hand test by the owner, which no automated test replaces: a wired Xbox pad
  and a Bluetooth DualSense on Chrome and Safari on macOS, and a pad on the
  phone. In particular, whether a pad press can start audio and fullscreen.

## Left to the builder

- Where exactly each rumble call sits inside the functions named above.
- How the right stick's turn reaches `cam.yaw`: adding to `mouse.dx` in mouse
  units or turning the camera directly in `camUpdate`.
- The look of the `.padfocus` outline and the pad name styling inside `kbd`,
  within the existing menu style.
- `CLAUDE.md` updates: an Input section for the pad, the test recipe for
  `t16`, and replacing "There is no gamepad support" in Known problems with
  what is still untested on hardware.
