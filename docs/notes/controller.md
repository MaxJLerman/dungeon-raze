# Controller (`08d_pad.js`)

- `PAD` reads `navigator.getGamepads()` once a frame in `PAD.poll(dt)`, which
  `frame` calls. It merges every listed pad: a button counts as down on any
  pad. `keys["P:i"]` and `taps["P:i"]` are set from that. A trigger
  (`P:6`, `P:7`) is down past half travel. The press edge is taken against the
  last poll's merged state, so the first press of a pad that has just appeared
  is not lost. A missing or throwing `getGamepads` means no pads, with no error.
- `frame` skips `poll` while `G.manual` is set, so tests call `DF.PAD.poll`
  themselves, usually through `DF.sim(s, () => DF.PAD.poll(1 / 60))`.
- `PAD_BIND` maps an action to a `P:` code and `DEFAULT_PAD` holds the
  defaults. It is saved under `p` in `dungeon-raze.v2`. A saved code that
  is not in `PAD_CODES` falls back to the default. `PAD_CODES` is every
  bindable code: 0 to 8, 10 to 15 and 17. `P:9` (Menu or Options) pauses in
  play and resumes from pause, and is fixed. The D-pad is bindable in play and
  moves menu focus on a menu. `mute` is bindable too: `poll` consumes its
  tap in play and calls `SFX.toggle`. `setPadBind` swaps with the action that
  held the code.
- Axes. A pad whose `mapping` is not `"standard"` may rest an axis off-centre
  (older Firefox puts the triggers on axes at -1). `PAD.ax(p, i)` reads such an
  axis as 0 until it has once been inside the dead zone (`PAD.axOk`, by pad
  index and axis, forgotten when the pad is gone). Standard pads are read at
  once. Every stick read goes through `PAD.ax`.
- Sticks. `PAD.vec` takes, from whichever pad pushes a stick furthest, a
  direction scaled by its magnitude past a radial dead zone of 0.2, so an idle
  second pad (Steam adds a duplicate) cannot cancel the other. `PAD.move` is the
  left stick: `x` right, `y` forward, `mag` 0 to 1. `playerUpdate` uses it in
  place of the movement keys while `mag > 0` and the touch stick is idle.
  `PAD.look` is the right stick with a squared response.
- Camera. `poll` turns `cam.yaw` and `cam.pitch` itself, at 3.0 and 1.8 rad/s
  at full push and `OPT.psens` 1, with pitch clamped as in `camUpdate`. It does
  not touch the camera while locked. While locked, a flick of the right stick
  past 0.7 in x sets `mouse.wheel` once. The stick must rest before it
  arms again.
- Sprint is a latch. A tap of the sprint binding flips `PAD.sprint`. It
  clears when the stick rests, when stamina is out, when the state leaves play
  or when the pad goes. The player runs on the pad only while the latch is on
  and `PAD.move.mag >= 0.6`. A sprint attack starts the class dash on every
  input, because `playerUpdate` captures `wasSprint` before it clears
  `p.sprint`. Before this branch that dash was unreachable.
- Mode. `PAD.active` is set by a button press or a stick pushed past 0.5, not
  by drift. A key, a mouse move or a touch clears it (`PAD.init`), except that
  a touch is ignored while `body.padhide` is set, since it is then only a
  camera drag and the buttons it would name are hidden. Unplugging the last
  pad clears it too. It
  toggles `body.pad`, which shows `.padonly` and `.lk-pad` text and hides
  `.kbonly` and `.touchonly`. `body.padc` means a pad is listed at all.
  `body.ps` or `body.xb` is the button family. `PAD.fam` comes from
  `PAD.famOf(pad)`: PlayStation for Sony vendor 054c, DualSense or DualShock, or
  a "Wireless Controller" id that does not name Xbox or 045e (Chrome's Xbox id
  contains "wireless controller"). Use `famOf`, never a raw regex. `padName`
  names a code per family. `keyName` calls it for `P:` codes. `actKey(a)`
  gives the name of the input in use for prompts.
- `PAD.mute` holds codes that stay ignored until released. A screen change mutes
  every button held at that moment. An action in a menu that changes the
  screen takes what is held with it, so a press does not act twice.
- Menus. While the state is not play, `PAD.menu` keeps a focus on the open
  screen: the D-pad or left stick moves it to the nearest control ahead,
  repeating after 0.35 s and then every 0.12 s, `P:0` presses it and `P:1`
  clicks that screen's `[data-back]` button. `focusables` skips the keyboard
  binding column (`#binds button[data-act]`), which the rebind flow covers.
  A screen opens on its first control, or the one with `data-padfirst`
  (`#btnSolo` on the main menu; `#btnPlay` on the class screen when a Play
  button opened it, because class cards come first). The focus is drawn by
  `.padfocus`, styled under `body.pad`. A range takes left and right.
  `PAD.menu` does not run while `PAD.rebind` is set.
- Rebinding. `PAD.startRebind(a)` waits for a pad button, which the Controls
  menu shows as "Press a controller button". It arms once every button is
  let go and takes the next press. `P:9` cancels. A key wait started with the
  mouse is cancelled by any pad press.
- Starting play. `play()` calls `PAD.enterPlay` only when touch mode is off and
  a pad is the active input. It asks for fullscreen and catches a refusal,
  since a pad has no pointer to lock. Under touch, `TOUCH.enterPlay` runs
  instead. A pad press, a key press in play and a click on the canvas also
  call `SFX.init`, so audio is retried until it runs. `play()` does nothing
  while touch is on and the device is upright (`innerHeight > innerWidth`),
  because the rotate overlay covers the page, and `PAD.focusables` is empty
  under `body.portrait`, so no pad button can resume play there.
- Pausing. `P:9` pauses a pad player. So does unplugging the pad during play,
  which also clears every held `P:` key and the latch. On a desktop, play also
  pauses when pointer lock is lost and when fullscreen that the page entered
  ends. Esc or P also pause whenever the pointer is not locked, which is always
  so for a pad player. Under touch the rules in `touch.md` apply.
- With touch on and a pad connected, `TOUCH.update` sets `body.padhide`, which
  hides the buttons and the stick. The flask and tool counts are shown again,
  because no button shows them. `classify` stops treating those areas as
  controls so a finger there turns the camera. The buttons come back when the
  pad is unplugged, when `OPT.padHideTouch` (on by default) is turned off or
  when touch mode ends. A touch alone does not bring them back. The hint line
  (`#hint`) shows under touch only while `body.padhide` is set.
- Rumble. `PAD.rumble(kind)` plays a `dual-rumble` effect from `PAD_RUMBLE` on
  the pad last pressed, only while a pad is the active input and `OPT.rumble`
  is on. `hurtPlayer` plays hurt, parry and guard break, `hitEnemy` plays
  a heavy melee hit. The player's death and `startExecute` play their own.
  A missing actuator, a throw or a rejected promise changes nothing.
- Settings are `OPT.psens` (0.2 to 3), `OPT.padHideTouch` and `OPT.rumble`,
  saved in `o`. The Controls menu shows a pad column and these settings. It
  warns when a listed pad does not report the standard mapping.

## Tests

- Run `tests/t16.mjs` after any change to `08d_pad.js`, pad bindings or the pad
  menus. It runs on the desktop page and fakes the Gamepad API with
  `navigator.getGamepads`: `SCRIPT=$PWD/tests/t16.mjs node test.mjs smoke`.
  Set `DF.G.manual` and call `DF.PAD.poll` yourself, as the steps do.
- Run `tests/t17.mjs` after any change to how a pad and touch share the screen.
  It uses a phone with a fake pad. Shots of the fight and the Controls menu go
  to `shots/`:
  `DEVICE=oneplus-13 SCRIPT=$PWD/tests/t17.mjs node test.mjs smoke`.

## Known problems

- Controllers are checked only with a faked Gamepad API. No real pad has been
  tried.
- Whether a pad press may start audio and fullscreen differs by browser.
- The DualSense mapping in Firefox may be wrong. A pad that does not report
  the standard mapping gets a note in the Controls menu.
