# DungeonRaze

A third-person melee and ranged combat prototype that runs in a desktop or
mobile browser.
You pick one of five classes and start in a base of operations: a hall with six
portal frames graded E to S and a training dummy. The open portal leads to a
procedurally generated cave of looping tunnels, where you kill the boss in the
deepest chamber and return to the hall through the gate it opens.

This is a spike: it exists to find out whether the combat feels good. It is not
a finished game, and nothing in it is balanced by hand yet.

## Play

Run `node build.mjs`, then open `dist/index.html` in a recent desktop Chrome,
Edge, Firefox or Safari. It runs straight from disk with no server. On a
desktop it needs a keyboard and a mouse, or a controller.

Phones and tablets play in landscape by touch. The file runs on Android and on
desktop. iPhones cannot open it from disk, so they play at
https://maxjlerman.github.io/dungeon-raze/. Adding `?touch=1` to the address forces the touch
controls on a desktop, with a readout of the screen size, so the layout can be
checked with a mouse.

### Touch controls

The buttons are hexagons in a honeycomb at the bottom right, with Attack at the
centre. The stick is the left 42% of the screen. The controls appear when play
starts and the keyboard hint is hidden.

| Control                         | What it does                                                           |
| ------------------------------- | ---------------------------------------------------------------------- |
| Stick (left side of the screen) | Walk. It appears where the thumb lands. A small push walks slowly      |
| Past the dashed ring            | Sprint                                                                 |
| Drag anywhere else              | Turn the camera. A second finger in the stick area also turns it       |
| Quick swipe sideways            | While locked on, switch to the next target                             |
| Attack                          | Light attack chain. Drag the finger to aim while attacking             |
| Heavy, Dodge                    | Heavy attack and dodge                                                 |
| Guard                           | Hold to guard. Guarding just as a hit lands parries                         |
| Lock                            | Lock on to the nearest enemy, or let go                                |
| Flask, Tool, Ability            | Heal, use the class tool, use the class ability. Flask and Tool show how many are left |
| Pause (top right)               | Opens the pause menu                                                   |

A finger belongs to the control it first touched, so sliding off a button
keeps it held. The Back gesture pauses the game instead of leaving the page.
Holding the device upright shows "Turn your device sideways to play." and
pauses. Pressing a key or moving a mouse brings back the desktop controls, and
a touch brings back the buttons.

The Controls menu has three settings for touch: button size (0.8 to 1.2 times,
cut down on small screens so everything fits), button opacity (20% to 100%),
and "Keep controls clear of the notch and rounded corners", on by default.

### Controller

Any controller the browser reports as a standard gamepad works. One that is not
reported as standard also works, and the Controls menu then warns that buttons
may be mixed up. A PlayStation
pad is shown with its own button names. Pressing a pad button switches the
prompts to the pad. A key, the mouse or a touch switches them back. The
Controls menu rebinds every button, sets the camera speed of the stick and turns
vibration off. Chrome and Edge recognise the most controllers. When a pad is
connected on a touch device the on-screen buttons are hidden, unless that setting
is turned off.

| Control (Xbox / PlayStation)           | What it does                                                    |
| -------------------------------------- | --------------------------------------------------------------- |
| Left stick                             | Walk. A small push walks slowly                                 |
| Right stick                            | Turn the camera. While locked on, flick it sideways to switch target |
| RB / R1                                | Light attack chain                                              |
| RT / R2                                | Heavy attack                                                    |
| LB / L1                                | Hold to guard. Guarding just as a hit lands parries             |
| LT / L2                                | Class ability                                                   |
| B / Circle                             | Dodge                                                           |
| X / Square                             | Drink a flask                                                   |
| Y / Triangle                           | Use the class tool                                              |
| Left stick click (LS / L3)             | Sprint on or off. Push the stick well over to run               |
| Right stick click (RS / R3)            | Lock on to the nearest enemy, or let go                         |
| Menu / Options                         | Pause and resume                                                 |
| D-pad or left stick, A / Cross, B / Circle | In menus: move, press, go back                              |

Sound on or off has no pad button by default. A sprint attack starts the
class dash. Playing with a pad goes fullscreen, because a pad has no pointer to
lock. Leaving fullscreen pauses the game.

## Technology

| Area           | What is used                                                                |
| -------------- | --------------------------------------------------------------------------- |
| Language       | Plain JavaScript (ES2020). No TypeScript, no framework, no packages         |
| Rendering      | WebGL 2, through a small renderer written for this project (`src/02_gl.js`) |
| Sound          | Web Audio API, every effect synthesized in code (`src/04_audio.js`)         |
| HUD and menus  | Ordinary HTML and CSS laid over the canvas                                  |
| Saved settings | `localStorage`, key `dungeon-raze.v2` (bindings, sensitivity, class, touch and controller settings) |
| Build          | One Node script that concatenates the source into a single HTML file        |
| Tests          | Playwright driving headless Chromium with software WebGL                    |
| Fonts          | Two Google Fonts, with system fallbacks when offline                        |

There is no game engine and no 3D library. All art is generated in code:
characters are assembled from boxes, cones, cylinders and spheres, and the cave
mesh is built from a mathematical field at load time. There are no image, model
or audio files in the repository.

## Build

    node build.mjs

The script reads every `src/*.js` file in filename order, wraps them in one
function scope, and substitutes them into `index.tpl.html` at the `/*__JS__*/`
marker. The result is `dist/index.html`, which is the whole game.

Because the files are concatenated rather than imported, they share one scope.
The numeric prefixes set the order, and later files may use anything declared in
earlier ones.

## Source layout

| File                 | What it holds                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `index.tpl.html`     | Page shell: CSS, HUD elements, and the title, pause, class, controls, how to play, death and win screens |
| `src/01_math.js`     | Math helpers, seeded random numbers, value noise, 4x4 matrices                              |
| `src/02_gl.js`       | Renderer `R`: lit pass, additive effects pass, scene nodes `Nd`, primitive meshes           |
| `src/03_world.js`    | `genWorld(seed)`: cave graph, walkable field, collision, world mesh, lights, spawns         |
| `src/03b_hub.js`     | `genHub()`: the hall, its portal frames and the portal grades `GRADES`                      |
| `src/04_audio.js`    | `SFX`: synthesized sound effects and ambient drone                                          |
| `src/05_figures.js`  | Player and enemy figures, base pose, enemy attack poses                                     |
| `src/06_game.js`     | Game state `G`, key bindings, classes, moves, combat rules, enemy AI, projectiles           |
| `src/07_render.js`   | Player and enemy posing per state, light selection, per-frame drawing                       |
| `src/08_hud.js`      | `HUD`: bars, enemy name tags and bars, lock-on reticle, messages, minimap                   |
| `src/08b_touchlayout.js` | `touchLayout()`: where every touch button, the stick area and the HUD boxes go, and `layoutProblems()` |
| `src/08c_touch.js`   | `TOUCH`: draws the buttons, tracks fingers, switches touch mode, fullscreen and Back        |
| `src/08d_pad.js`     | `PAD`: reads controllers, sticks, camera, sprint latch, menu focus, rebinding, rumble       |
| `src/09_main.js`     | Input events, menus, camera, main loop, test hook `window.DF`                               |
| `build.mjs`          | The build script                                                                            |
| `test.mjs`, `tests/` | Headless test runner and scenario scripts                                                   |

## What is in the game

- **Classes:** Assassin, Fighter, Tanker, Mage, Ranger. Each has its own attack
  chain, heavy attack, limited-use tool, focus-costing ability and passive trait.
- **Shared combat:** stamina, guard with a timed parry, dodge with brief
  invulnerability, lock-on, enemy posture that breaks into an execution, three
  healing flasks.
- **Enemies:** Husk (fast melee), Brute (armoured, has an unblockable slam),
  Spitter (ranged, its shots can be parried back), and the Ossuary Warden boss
  with two phases.
- **Pursuit:** enemies chase what they can see. Break their line of sight and
  they run to where they last saw you, carry on a little the way you were
  heading, look around, then walk back to their post. They also turn back 32
  metres from their post, unless you have just hit them. An enemy that can see
  you keeps others within 16 metres in the hunt, so a pack does not split up
  because one of them lost you round a corner. While you are inside the boss
  chamber no enemy but the boss hunts you.
- **Enemy names:** every enemy shows its name on a black plate above its head
  when it notices you or when you look at it. The colour of the name compares
  the enemy with you. White: weaker than you (Husk, Spitter, training dummy).
  Orange: around your level or slightly above (Brute). Red: much stronger than
  you (the Ossuary Warden). Levels are not implemented yet, so today the
  colour is fixed per enemy type.
- **Base of operations:** a built hall where every session starts. Six portal
  frames stand along the far wall in rank order, E to S. Only E is open; the
  rest are sealed until grades are given difficulty and rewards. Walking into
  the open portal starts a new cave. The pause, death and win screens return
  you to the hall.
- **Training dummy:** stands in the hall, takes every attack and ability, can
  be staggered and executed, and never dies. Focus and tool charges refill on
  their own in the hall.
- **Cave:** sixteen chambers on a jittered grid joined by winding tunnels, with
  extra tunnels so routes loop. A new layout every run. Shrines are checkpoints.
- **Menus:** class picker, controls menu with rebinding, mouse sensitivity and
  inverted look, and a How to play screen with the name colour key and combat
  tips. How to play opens from the title and pause screens.

## Tests

The runner needs Playwright and a Chromium build:

    npm install && npx playwright install chromium
    node build.mjs
    SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke

`test.mjs` opens the built page, reports any console or page errors, and runs
the steps exported by the script named in `SCRIPT`. The mode decides where the
steps start: `smoke` clicks play and enters a cave, `hub` clicks play and stays
in the hall, and `title` stays on the title screen. A step that returns an
object with a `pass` value other than `true` fails the run, and the process
exits with code 1.
Screenshots go to `shots/`.

| Script          | What it checks                                                                          |
| --------------- | --------------------------------------------------------------------------------------- |
| `tests/t2.mjs`  | Parry, ambush, stagger and execution, dodge, boss, win, death and respawn, long bot run |
| `tests/t3.mjs`  | How fast each enemy type kills a player who stands still                                |
| `tests/t4.mjs`  | Screenshots of key combat moments                                                       |
| `tests/t5.mjs`  | Forty generated caves for blocked tunnels and bad spawn points                          |
| `tests/t6.mjs`  | Every class: chain, heavy, tool, ability, rebinding, bot run per class                  |
| `tests/t7.mjs`  | Screenshots of the menus and each class                                                 |
| `tests/t8.mjs`  | The hall, portals, transition, training dummy and return to base. Run in `hub` mode     |
| `tests/t9.mjs`  | Screenshots of the hall, portal, dummy and the arrival in the cave. Run in `hub` mode   |
| `tests/t10.mjs` | Enemy name tags, threat colours, look zone, How to play screen                          |
| `tests/t11.mjs` | Screenshots of the name tags and the How to play screen                                 |
| `tests/t12.mjs` | Routes, lost sight and searching, leash, provoke, boss chamber                          |
| `tests/t13.mjs` | Touch layout geometry, hit shapes and a size sweep. Run in `title` mode                 |
| `tests/t14.mjs` | Touch play with real touches under device emulation: buttons, stick, look, settings, portrait, Back |
| `tests/t15.mjs` | Screenshots of the hall and a fight with touch controls on every device                 |
| `tests/t16.mjs` | Controller input with a faked Gamepad API: buttons, sticks, camera, menus, rebinding, rumble |
| `tests/t17.mjs` | A controller with touch on a phone: the buttons hide and return, with screenshots. Run with `DEVICE=oneplus-13` |

The touch scripts `t14` and `t15` run under emulated phones and tablets. Run
one device with `DEVICE=pixel-9 SCRIPT=$PWD/tests/t14.mjs node test.mjs smoke`,
or every device in `tests/devices.mjs` with
`node tests/touch-all.mjs tests/t14.mjs`. Screenshots are named
`shots/<device>-<name>.png`.

`tests/t1.mjs` is an early real-time script kept for reference; the others drive
the simulation directly and are the ones to copy.

## Continuing the work

`CLAUDE.md` holds the working notes: coordinate conventions, how the systems fit
together, step-by-step recipes for adding a class, move or enemy, known problems
and the backlog. Read it before changing code.
