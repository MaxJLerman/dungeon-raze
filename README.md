# DungeonRaze

A third-person melee and ranged combat prototype that runs in a desktop browser.
You pick one of five classes and start in a base of operations: a hall with six
portal frames graded E to S and a training dummy. The open portal leads to a
procedurally generated cave of looping tunnels, where you kill the boss in the
deepest chamber and return to the hall through the gate it opens.

This is a spike: it exists to find out whether the combat feels good. It is not
a finished game, and nothing in it is balanced by hand yet.

## Play

Run `node build.mjs`, then open `dist/index.html` in a recent desktop Chrome,
Edge, Firefox or Safari. It runs straight from disk with no server. It needs a
keyboard and a mouse.

## Technology

| Area           | What is used                                                                |
| -------------- | --------------------------------------------------------------------------- |
| Language       | Plain JavaScript (ES2020). No TypeScript, no framework, no packages         |
| Rendering      | WebGL 2, through a small renderer written for this project (`src/02_gl.js`) |
| Sound          | Web Audio API, every effect synthesized in code (`src/04_audio.js`)         |
| HUD and menus  | Ordinary HTML and CSS laid over the canvas                                  |
| Saved settings | `localStorage`, key `dungeon-raze.v2` (bindings, sensitivity, class)        |
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

`tests/t1.mjs` is an early real-time script kept for reference; the others drive
the simulation directly and are the ones to copy.

## Continuing the work

`CLAUDE.md` holds the working notes: coordinate conventions, how the systems fit
together, step-by-step recipes for adding a class, move or enemy, known problems
and the backlog. Read it before changing code.
