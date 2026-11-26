# Working notes for DungeonRaze

`README.md` says what the project is and how to build it. This file holds what
every change needs. The detail is in `docs/notes/`, one file per system.

## Read before you change code

**Read the notes file for every system you touch, before editing it.** They hold
rules the code does not show and breaking one is usually silent. `06_game.js`
holds many systems: pick by what you are changing. Each file also holds its
own tests in detail, recipes and known problems. When you hand work to a
subagent, name the notes files it must read.

| Changing | Read (`docs/notes/`) | Run |
| --- | --- | --- |
| Renderer, shaders, materials, sprites (`02`, `07`) | `rendering.md` | t9, t11, t22 |
| Cave generation, the field, collision, sight, routes, rock, water (`03`) | `world.md` | t5, t12, t20, t22 |
| The big cave (`genWorld` with `big`) | `world.md` | t31, t22 |
| The sewer: layout, water, pillars, pieces, dressing, spawns (`03c` to `03e`) | `sewer.md`, `world.md` | t22, t23, t24 |
| Hall, portals, grades, run and reset, game state, main menu, screens (`03b`, `06`, `09`); **recipe: open a portal** | `zones.md` | t8, t9, t22, t30 |
| Dev menu, god mode (`src/dev/10_dev.js`) | `dev-menu.md` | t26, t26-build |
| Actions, bindings | `input.md` | t16, t18 |
| Touch layout and controls (`08b`, `08c`) | `touch.md` | t13, t14, t15, t19 |
| Controller (`08d`) | `controller.md` | t16, t17 |
| Player states, damage, holds, wading; **recipes: add or tune a move, add a class** | `player.md` | t6 |
| Plaques, codes, unlocks, Enforcer, Sapper, Riftwalker | `hidden-classes.md` | t6, t18, t19, t20, t21 |
| Enemy AI, bound, hidden, safe and aloft enemies, name tags, the dummy; **recipe: add an enemy** | `enemies.md` | t10, t11, t12, t24 |
| Behaviour hooks, rat, drowned, brood mother, bloater, eel, siren, grabber (`05b`, `06b`, `07b`) | `d-enemies.md`, `enemies.md` | t23, t24 |
| The crocodile boss and its cavern | `crocodile.md`, `d-enemies.md`, `enemies.md` | t25 |
| Co-op, the host copy, the wire, the room screen, `relay/` (`06c`, `06d`, `07c`, `08e`) | `coop.md`; `relay/README.md` for the relay | coop-\*, t27, t28, t29 |
| The Warden for two (`WARDEN2`, its phases, attention, aftershock, grab, seal) | `coop.md`, `enemies.md` | coop-warden, t32 |
| Planning: project history, per-branch record, backlog | `status.md` | |

**Keeping the notes.** Put what you learn or change in the system's notes file,
in the same commit as the code. Change this file only for a rule that holds
everywhere, a new notes file or a change of status. A new system gets its own
notes file and a row above.

## Where the project stands

- A playable combat spike. Nearly everything is checked by automated tests and
  screenshots only; no human had reported on feel when this was written.
- The owner wants a hack-and-slash with Soulslike and God of War style combat,
  set mostly in cave systems so that little art is needed. The inspirations are
  Solo Leveling, Jujutsu Kaisen, Attack on Titan and Ghostwire Tokyo. Names,
  characters and signature moves from those series are deliberately not used.
- The shadow-necromancer class (raising killed enemies) was dropped by the
  owner. Do not reintroduce it unless asked.
- Built: the hall with portals E to S, E (cave, the Warden) and D (sewer, seven
  enemy types, Old Sluicejaw; opens once E's boss is dead), five base classes
  and three hidden ones, touch, controller, dev menu, main menu and two-player
  co-op. A co-op room meets in the hall, the two travel through gate E
  together and back, and a cave entered by two is a much bigger cave (36
  rooms, drawn in pieces) and harder, and its Warden is a harder fight of
  four phases (it hunts whoever hurt it most, an aftershock follows each slam,
  a grab only the other player can break, and a last phase that seals the
  chamber and puts the lights out). In co-op D is sealed too. C to S are
  sealed. Grades carry no difficulty or rewards yet.
- Next: the owner's verdict on the combat and a playtest of co-op with two
  people (every number of the Warden for two, `WARDEN2`, is a first guess),
  then widening the game with several agents in parallel. The detail and the
  backlog are in `docs/notes/status.md`.

## Rules of the build

- `node build.mjs` after every source change. The page that runs is
  `dist/index.html`, and it is not committed. A push to `main` builds it
  with `--release` and publishes it to GitHub Pages
  (`.github/workflows/pages.yml`).
- `src/dev/*.js` (the dev menu) is appended after `src/*.js`, and only when
  `--release` is not passed. **Every published copy of the page, on GitHub
  Pages or the hosted single page, is built with `--release`;** a plain
  build is for this machine only. Nothing outside `src/dev/` may name anything
  declared there; core code reads `DEV` alone, which stays `null` in a
  release build. `node tests/t26-build.mjs` checks both builds.
- Every build, release included, also embeds the co-op host copy, the files
  matching `^0[1-6]` as the string `COOP_HOST_SRC` (see `docs/notes/coop.md`). Those files
  must load in Node and in a Worker: no DOM, no `window`, nothing at top
  level that touches the screen. Co-op is core, not dev: only the lag dial
  is in `src/dev/`. A name from a file of `07` on that the host copy holds
  must never run there; `tests/t26-build.mjs` fails on any such name not on
  its `HOST_MAY_NAME` list, which says why each one cannot run.
- Every build also stamps `COOP_BUILD`, 8 hex characters of a hash of the
  core sources (`src/*.js` in order, not `src/dev/`), declared before the
  sources in the page and in the host copy. A dev and a release build of the
  same sources carry the same stamp, and any change to a core source changes
  it, so nobody has to remember to bump anything: a co-op host refuses a
  page of another build. `COOP_V` is only the wire's own version.
- All `src/*.js` files are concatenated into one function scope. There are no
  imports or exports. Declare a name once across the whole of `src/`.
- No dependencies, no network requests at run time except Google Fonts and
  the co-op relay, which is opened only when a player hosts or joins. The
  game is also published as a single hosted HTML page whose content policy
  blocks loading models, images or data from other sites, so keep everything
  generated in code or inlined. That page cannot play co-op: the room screen
  tells it to play on the Pages site.
- Pointer lock, fullscreen and audio must start from a click or key handler,
  and a refusal must be caught. `G.noLock` is the fallback when lock is denied.

## Conventions that are easy to get wrong

- **Axes:** the ground is the XZ plane, Y is up, units are roughly metres.
- **Facing:** an angle `yaw` means forward is `(sin yaw, 0, cos yaw)`. Use
  `Math.atan2(dx, dz)` to get the yaw from one point toward another.
- **Right-hand side:** with forward as above, right is `(-cos yaw, 0, sin yaw)`.
  A figure faces its local +Z, so its right arm sits at negative X.
- **Node transforms:** `Nd` composes translate, then rotate Y, X, Z, then scale.
  Only leaf nodes that carry a mesh should have non-uniform scale.
- **Limb rotation:** a limb hangs along -Y from its pivot. Negative X rotation
  swings it forward, positive swings it back. Positive Z rotation moves a
  hanging limb toward +X.
- **Colour:** `hexc(0xRRGGBB)` converts to linear RGB. World vertex colours are
  stored square-root encoded in bytes and squared in the shader. The alpha byte
  is a glow amount, used by crystals.
- **Minimap:** it is mirrored in X on purpose so left and right match the
  camera.

## Rules that hold everywhere

Each is explained in the notes file named.

- All damage to enemies goes through `hitEnemy`, to the player through
  `hurtPlayer`, and holds through `grabPlayer`. (`player.md`)
- A new way of hitting or targeting an enemy must skip a falling, hidden or
  aloft one and respect `safe`, and a new way of killing or moving one must
  respect the training dummy. (`enemies.md`, `hidden-classes.md`)
- Every move of an enemy goes through `eStep`. (`enemies.md`)
- Behaviour only one D type has is a hook in `EBEH`, not a branch in
  `enemyUpdate`. (`d-enemies.md`)
- Rubble is only ever a change to the field, and water is read only through
  `waterAt` and `bodyAt`. Readers get no rubble or zone checks. (`world.md`)
- Every world generator returns the same shape. Seeded generators draw in a
  fixed order, and t22 holds hashes of the results. (`world.md`, `sewer.md`)
- New per-run state is cleared in `resetRun()`, and in `respawn` too if it must
  not outlive a death. (`zones.md`)
- Game code reads input with `held(action)` and `hit(action)`, never raw codes.
  (`input.md`)
- Touch positions come only from `touchLayout`. (`touch.md`)
- With `DEV` and `NET` both `null` the game is the plain single-player game.
  Core reads them only in the places the notes list. (`dev-menu.md`, `coop.md`)
- **Never commit a plain plaque code**, in source, tests, comments, commits or
  docs. (`hidden-classes.md`)

## Testing

Run the scripts in the table above for what you changed; how to run each one,
what it checks and which screenshots to look at are in the notes file. The
README's test table says in a line what each script checks. The usual form is
`node build.mjs && SCRIPT=$PWD/tests/t6.mjs node test.mjs <mode>`, the mode
being `smoke` (enters a cave), `hub` (the hall) or `title` (the main menu).

- `window.DF` exposes the internals to tests. Set `DF.G.manual = true` to stop
  the frame loop from advancing the simulation, then call
  `DF.sim(seconds, eachStep)` to run it at a fixed 60 steps per second.
  Returning `false` from `eachStep` stops early.
- Simulate input by setting `DF.keys[DF.BIND.fwd] = true` or
  `DF.taps[DF.BIND.light] = true`.
- `DEVICE=<id> node test.mjs smoke` runs the page as a phone or tablet from
  `tests/devices.mjs`: its viewport and pixel ratio, touch on, fake insets, and
  play started by a tap. It exposes `__touch(type, points)`, which sends real
  touches through the Chrome DevTools protocol, and `__viewport(w, h)`.
  `node tests/touch-all.mjs <script>` runs a script on every device in turn and
  prints one line each.
- Headless Chromium needs these flags for WebGL:
  `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.
  Rendering is slow there, a few seconds per screenshot, which is why tests
  drive the simulation directly instead of waiting in real time.
- A test step that returns an object with a `pass` value other than `true`
  fails the run with exit code 1.
- Screenshots are the only check on how things look. Take them; do not assume.

## Decisions already made, with reasons

- **Browser, not Unreal.** The owner considered Unreal for a commercial release
  and then chose a browser build to play sooner.
- **Own renderer, not Three.js.** The workspace it was built in could not
  download libraries, and a dependency-free page can be tested headlessly and
  hosted anywhere.
- **Primitive-built characters.** The hosting page cannot load outside models,
  and this keeps the repo free of binary assets.
- **Healer class left out.** It has no role in a solo game. The owner was
  offered a self-sustain version and had not answered.

## Commit conventions

Do not add `Co-Authored-By: Claude` or `Claude-Session` trailers.
