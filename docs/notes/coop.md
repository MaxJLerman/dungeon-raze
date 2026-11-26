# Co-op (`06c_coopwire.js`, `06d_coophost.js`, `07c_coopclient.js`, `08e_coopui.js`, `relay/`)

Two players over the internet: a room starts in the host's hall, and the
host stepping into E's gate takes both into the same cave; the exit gate or
the host's Return to base brings both back, and the room stays open for
another trip. The designs are
`docs/superpowers/specs/2026-11-24-coop-cave-slice-design.md` and
`docs/superpowers/specs/2026-11-25-coop-lobby-design.md` (the hall as a
lobby).

- **The pieces.** The host's page runs the normal client and, in a Web
  Worker, a second copy of the simulation, the host. The friend's page runs
  the normal client. The friend reaches the host's Worker through the relay
  (`relay/`, a Cloudflare Worker with one Durable Object per room), over a
  WebSocket from each side. The host's page talks to its own Worker by
  `postMessage`. Each client owns its own player completely (movement,
  health, stamina, flasks, focus, tool charges, rest points, death); the
  host owns every enemy, enemy shots as they are fired, kills, the boss's
  death and resets. Player ids are 1 (the host's page) and 2 (the friend).
- **The host copy.** `build.mjs` joins the files matching `^0[1-6]`
  (through `06d`) with `const COOP_HEADLESS = true` in front, a few stubs
  (`PAD`, `TOUCH`, `RM`, `padName`, `R.setWorld`) behind, and `return
COOP_HOST;`, and embeds the result as the string `COOP_HOST_SRC` in every
  build, release included. So anything the host needs lives in `06c` or
  `06d`, and those files load in Node and in a Worker: no DOM, no `window`,
  nothing at top level that touches the screen. In the page `COOP_HOST` is
  `null` (`COOP_HEADLESS_HERE` is false). `coopMakeHost()` evaluates the
  source on the page with `localStorage`, `document`, `window` and
  `navigator` passed as nothing; `coopWorkerLink()` runs it in a Worker
  made from a Blob of `"(function(localStorage,document,window,navigator){"
  - COOP_HOST_SRC + "})().worker(self);"`, so there is still one HTML file.
`tests/lib/coop.mjs` loads it in Node the same way.
- **`NET`.** `let NET = null` beside `DEV` in `06_game.js`. It is set only
  for the length of a co-op run, by the host copy (`NET.host`) or by the
  client's join (`NET.client`, with `live` false until `coopEnter()`, and
  `mates`, the other player). With it `null` the game is the single-player
  game. Both sides define every hook, as a no-op or `false` where that side
  has nothing to do: `enemies`, `frame`, `onHit`, `onShoot`, `onKill`,
  `onRespawn`, `onGate`, `onPortal`, `onPShot`, `onBlast`, `taken`. The
  host's also has `two`, a getter (`S.n === 2`), since `NET` is set once
  and worlds change. Core
  reads it in these places and no others:
  - `update`: the host skips `playerUpdate`; with `NET` set
    `NET.enemies(dt)` replaces the enemy loop (the host steps its enemies
    with the swap below, the client moves its puppets). A death under the
    pause screen or a menu shows the dead screen while `NET.live`. The
    portal check at its end calls `NET.onPortal(grade)` in place of
    `startTrans` (a no-op on the host, which has no player; the client's
    `coopPortal`).
  - `projUpdate` passes over a shot with `own === "m"` (the other player's,
    drawn only).
  - `hitEnemy`: `o.pre` marks a client's proposal applied on the host, its
    multipliers already in the damage; `NET.onHit(...)` true means the
    client has proposed the hit and shown it, and the rest is skipped.
  - `hurtPlayer` returns `"remote"` for a remote player (a proxy or a mate)
    and changes nothing, and judges hits off the play screen while
    `NET.live` (the dungeon does not pause).
  - `kill` calls `NET.onKill(e)`. `bossFell` records no cleared grade on
    the host (`NET.host`), and on a client (`NET.client`) records it under
    `G.player.clsId`, the class that played, in place of `OPT.cls`; with
    `NET` set it skips the line "A new gate has opened in the base.", since
    the co-op hall keeps D sealed. `kill(e, quiet)` and `bossFell(e, quiet)` take a second argument only
    the client passes: the same state with no sound, sparks, slow motion or
    message. `openGate()` (the gate over the boss's chamber) is shared by
    `bossFell`, a world built after the boss's death and a client's
    `reset` that says the boss is dead. `respawn` calls `NET.onRespawn()` in place of
    `spawnEnemies` (one death rebuilds no enemies). `explode` calls
    `NET.onBlast`, the player's `fire` `NET.onPShot`, an enemy's `shoot`
    `NET.onShoot`, and `playerUpdate` at the exit gate `NET.onGate()`.
    `nearestStaggered` skips an enemy `NET.taken(e)` (the other player has
    begun to execute it). `takeToken` reads `NET.two` (the host's, true in a
    dungeon for two; a client's `NET` has no `two`): only holders with the
    same `tg` count, up to `COOP_TWO.turns`. `enterHub` ends a client's co-op run
    (`coopEnd("left")`), unless its second argument, `coop`, is true:
    `enterHub(fromGrade, true)` is a co-op world swap to the co-op hall
    (`genHub(true)`, `zones.md`), which the host's `build` makes and which
    stays in co-op. `inspectUpdate`'s plaque code read (`code = !NET && id
    && ...`) takes no symbols with `NET` set: a plaque opens and shows its
    card in a co-op hall but nothing can be entered (`hidden-classes.md`).
    `transUpdate` reads no `NET`: a co-op fade carries its own `swap`
    (`zones.md`).
  - `09_main.js`: `frame` calls `NET.frame(dt)` every frame in real time
    and runs the simulation under every screen while `NET.live`
    (`coopStill` keeps a paused player still, and the title's own clock
    does not also advance then). `show` hides `#btnBase` and `#btnDeadBase`
    when `!coopLeads()` (a friend's page in a co-op run). `toBase` during a
    co-op run (`NET.client`) calls `coopBase()` and `play()` in place of
    `enterHub(G.grade)`. `menuGoBack()` is the one way back from a
    menu (its Back button, Esc, the pad's back button, which clicks the
    button, and the touch Back gesture in `08c_touch.js`); on the room
    screen it calls `coopLeaveRoom()` first. `openMenu("coop")` calls
    `coopRoomOpen()`. `07_render.js` draws `NET.mates`; `08_hud.js` calls
    `coopHud()`, which draws the HUD's mate bar, "Waiting for the host" and
    the pause screen's co-op lines.
- **The host's placeholder and the target swap.** The host has no player
  of its own. Each joined player is a proxy (`makePlayer`, flagged `remote`,
  never stepped, moved to where its machine last said it was). `G.player`
  is a placeholder, dead and far off the grid, so code that reads it outside
  an enemy's step finds nobody. Every world the host builds makes a new
  `G.player`, which becomes the placeholder. Each enemy has a target (`e.tg`, a pid): the
  nearest proxy that is there, alive and not away, kept unless another is
  `COOP.STICK` (3 m) nearer. For each enemy's step `as(px, fn)` points
  `G.player` and `G.inBoss` at that proxy and puts them back after. A hit
  from a player the enemy can see turns it on them (not the Warden for
  two's: its attention, below). This leaves the
  single-player code and its tests alone, at the cost of the leaks listed in
  Known problems.
- **Worlds and travel** (the host, `06d`). A room's world is the hall
  (`S.kind` `"hub"`) or a grade's cave from a seed (`"cave"`).
  `host.start({ hub: true })` starts in the hall, as every room the page
  hosts does; `host.start({ seed, grade })` still starts in a cave (the lag
  dial, t27, t28 and the Node tests). Every world comes from
  one internal `build(kind, grade, seed, from, won, two)`: `S.n` settled
  first (below), then `enterHub(from, true)` or `newRun(seed, grade, S.n
  === 2)`, the placeholder re-pointed, `number()`, and
  `S.epoch` raised by one (the first world is epoch 1). Every proxy is
  taken along: moved to where the world put its player (the cave's start,
  or 3.5 m in front of `from`'s gate in the hall), pid 2's `COOP.BESIDE`
  (1.2 m) to the right of that point (`coopSpot`, below), full health, state
  `"free"`, its `seen` cleared, `heard` `-Infinity`, `ack` 0 and `here`
  false; then each is sent `world`. `S.n` is the players the world was
  built for: 2 for a dungeon for two (below), else 1. The co-op hall has E open and every other
  gate sealed whatever the save says (`genHub(true)`), so the host, which
  has no save, and both pages build one mesh. `NET` is set once in `start`,
  before the first build. **Only pid 1 travels** (`travel`): to a grade in
  `COOP.GRADES` (`["E"]`) with a finite seed from the hall, or to `"hub"`
  from a cave (back in front of that grade's gate). Anything else is
  ignored. **A proxy is not there** (`here` false) from its join or a world
  until its `at` for the current epoch arrives: its states are ignored, of
  its events only `at` is heard (the rest are dropped unacknowledged, so a
  hit meant for the old world cannot land on an enemy that reuses its id,
  and a `gate` or `travel` crossing a swap does nothing), it is not `live()`
  (not hunted) and not counted by `wipe()`, it is sent no snapshots, and
  `all` and `others` skip it for the world-bound events `shot`, `ring`,
  `roar`, `kill`, `reset` and `fed`. A counter (`ver`) is raised by every kill and
  wipe and remembered on each proxy when its join or world is sent; an `at`
  that finds it changed is answered with `reset` (the enemies again). An
  event that swaps the world is not acknowledged, since the new world's
  numbers start again: the host's ack is 0 and the client counts from 1
  (its `at`). In the hall the dummy is a host enemy like any other; an
  `exec` on it gives back its health and posture, clears the pin and sends
  no `kill`, as single player's execution does. The page's finish on the
  dummy never runs `kill`, so `coopExec` sends that `exec` itself when it
  records the finish, and holds the puppet standing (`e.ov`) until the host
  has had it; `coopFinCheck` judges the dummy as it judges a boss, so the
  finish's health and focus stand. A puppet of a type with no speed (the
  dummy) is put where the host has it, never glided.
- **A dungeon for two** (`06c`, `06d`, `07c`). **When:** `build` counts
  `S.px.size` before it builds a cave: two or more joined players (entered
  or still on the room screen) make it a dungeon for two (`S.n` 2) for as
  long as that world lasts, wipes included and after a player leaves; one
  makes the usual cave, and a friend who joins it mid-run gets that cave
  and changes nothing. A friend who leaves a cave for two and joins again
  gets it back, enemies as they stand. The hall is never tuned and
  the dummy never scaled. `host.start({ seed, grade, two: true })` forces
  it (tests, `coopSolo({ two })`). The count travels as `n` in `join` and
  `world`. **The big cave:** a cave for two is the big cave (`world.md`):
  the host builds `newRun(seed, grade, S.n === 2)`, so `S.n === 2` and
  `world.big` go together for grade E; any other grade ignores `big` (a
  sewer started for two in a test is the sewer, with `n` 2). The page
  decides from the description alone: `coopBuild` builds `enterCave(grade,
  seed, d.n === 2)`. No new field travels; a world whose `n` does not match
  what the host built gives another sum and is refused (`"cave"`, t27).
  The host copy skips the pieces' sight lines (`sees:
  !COOP_HEADLESS_HERE` in `genWorld`), so its pieces' `sees` are empty and
  a host build takes about 60 to 120 ms in Node (the first in a fresh copy the
  slowest), against about 700 ms on a page; `pos` is the same either way,
  so `coopWorldSum` agrees (t27, t28, `coop-caves`, `coop-e2e`). **The table** is `COOP_TWO` in `06c`: `{ extra: 1, extraDeep:
  2, hp: 1.3, post: 1.3, bossHp: 2.5, bossPost: 1.5, turns: 2, bossHeal:
  0.25 }` (the Warden's health is `WARDEN2.hp`'s, below; `bossHp` was 1.8
  before the Warden for two). **Tougher:** `coopTwoDefs()` is a table with every key of
  `EDEF`: the dummy's own entry, and for every other type
  `Object.create(EDEF[type])` with its own `hp` and `posture` multiplied by
  `hp` and `post` (`bossHp` and `bossPost` for a boss), rounded. `EDEF`
  itself is never changed. `G.edef` holds it for the world (`null` means
  `EDEF`'s own), `makeEnemy` reads `(G.edef || EDEF)[type]` and
  `resetRun()` clears it, so every reader of `e.def` (bars, the Warden's
  phase changes, the snapshot's posture fraction, a wipe's enemies) sees
  the scaled values. On the host `build` sets it after
  `newRun`; a client's `coopBuild` sets it when `d.n === 2`, before the
  puppets are made (cave 99: a husk 55 health and 65 posture, the Warden
  1550 and 210). The Warden's entry is the Warden for two (below). **More enemies:** `coopExtras(world, seed)` groups the
  spawns by `node` (rooms only: no tunnel post, node -1, and no boss); a
  deep pack, one holding two or more brutes, gets `extraDeep`, any other
  `extra` (in the small cave only `brute, brute, spit` is deep; in the big
  cave its two larger packs are too). Each extra is a
  copy of a member drawn with `rng(seed ^ 0x2c0)` in spawn order, 1 to
  2.5 m from it, then `world.resolve(o, 1.2)`. `build` appends them to
  `G.world.spawns` after generation (the generator and t22's hashes are
  untouched; the checksum covers the mesh only) and runs `spawnEnemies()`
  and `number()` again, so they are host enemies like any other and reach
  clients in the enemy list. Big cave 99 for two has 188 enemies; over
  seeds 1 to 20 and 99 the count for two is 155 to 199, mean 178.1, and over
  seeds 1 to 300 it is 155 to 216 (seed 103 has 216)
  (`coop-host`, "the enemy count for two"). The design first expected 150
  to 190 and nothing was tuned. A host step in big cave 99
  with one player at the start and one five rooms along costs about
  0.35 ms in Node (a minute's mean, "a minute in the big cave"). **Attack turns:** `takeToken` with `NET.two` counts only token
  holders with the same target (`tg`), up to `turns` each, so two players
  face up to four attackers; otherwise it is the solo rule, two in all.
  `pick` can change a holder's target afterwards (the target dies, is away,
  or the other is `COOP.STICK` nearer), and so can a hit (`ASK.hit` turns
  an enemy on a player it can see), so both call the host's `retarget(e,
  t0)`: a non-boss holder that changes from one player to another gives its
  turn up (`e.token = false`) when the new target already has `turns` other
  holders.
  A swing already under way is not cut off, so a third attacker may begin
  one against that target while it finishes.
  **The feed:** each tick `present()` remembers every proxy's state
  (`was`, reset to `"free"` by `build`); a change to `"dead"` inside the
  boss chamber, in a dungeon for two with the boss alive and `aware`,
  gives the boss `bossHeal` of its full health, capped at full, and sends
  `["fed", eid, t]` to every player there. Its phase does not go back. A
  client waits for the drawn time as for `roar` and says "<boss name> feeds
  on the fallen." ("The Ossuary Warden feeds on the fallen."), silent when
  late or not live; its health follows from the snapshots.
- **The Warden for two** (`06b`, `06c`, `06d`, `07c`; the design is
  `docs/superpowers/specs/2026-11-26-coop-warden-for-two-design.md`). The
  Warden of a world for two is a harder fight; every other Warden, the
  solo one and that of a co-op cave for one, is today's. **The table** is
  `WARDEN2` at the end of `06b`, the one place for the fight's numbers:
  `hp` 2.5 (times the solo 620), `marks` `[0.75, 0.5, 0.25]`, `roar` `{ 4:
  2.2 }` (seconds by the phase entered) and `lines` (what a page says on
  entering phases 2, 3 and 4: "The Warden burns hotter", "The Warden
  reaches for you", "The way out is gone"). **The definition:** the
  Warden's entry of `coopTwoDefs()` is `Object.create(EDEF.warden)` with
  its own `hp` 1550, `posture` 210, `duo: true`, `marks` and `roarT` (from
  `WARDEN2`), and an `atks` object of its own that holds the solo Warden's
  attack objects in the same key order: the snapshot sends an attack as its
  index in `Object.keys(def.atks)` and finds it by identity, so a later
  attack goes after them. Its `slam` is a copy of the solo one with
  `after: WARDEN2.wave`, at the same key position (each side calls
  `coopTwoDefs()` once per world and uses its own result, so both hold the
  same copy). `EDEF.warden` has none of these keys, and its slam has no
  `after`.
  `def.duo` is how code tells this Warden from today's. **Four phases:**
  `hitEnemy` gives a boss without `ownPhases` phase 1 plus the number of
  its `marks` its health is below (`enemies.md`), so this Warden enters
  phase 2 below 1,162.5, 3 below 775 and 4 below 387.5, roaring once a hit
  whatever the marks it crossed; the phase 4 roar lasts 2.2 s. A phase
  never falls but on its reset (home, or a wipe), and the feed can lift its
  health over a mark without undoing one. Everything today's second phase
  gives (speed 1.2, tempo 0.85, the volley, the glow) holds from phase 2
  on (`e.phase >= 2`, on the host and in the page's puppet). Phase 2 adds
  the aftershock; phases 3 and 4 add nothing else yet. **The aftershock**
  (`WARDEN2.wave`, `{ from: 2, wait: 0.35, speed: 11, reach: 24, band: 1.2,
  dmg: 14 }`): a slam whose attack has an `after` calls `waveStart(x, z,
  after)` where it lands, when the Warden's phase is at least `after.from`:
  on the host in `enemyUpdate`'s slam landing, on a page in `coopPuppet`'s
  (once a slam, as the ring and the sound are). `G.waves` is a list of `{ x,
  z, t, o, hit }`; `wavesUpdate(dt)`, beside `shocksUpdate` in `update`,
  ages them. The ring's radius is `(t - o.wait) * o.speed`. Each page judges
  it on its own player only: on the step the radius plus half of `o.band`
  reaches the player's distance from `(x, z)` it calls `hurtPlayer(o.dmg,
  null, { dmg: o.dmg, px: x, pz: z })` once and sets `hit`, so a dodge in
  its iframes takes nothing and a guard facing the centre blocks (`hurtPlayer`
  takes the source from `px` and `pz` when `e` is null). On the host
  `hurtPlayer` returns `"remote"`, so the host's own `G.waves` only
  age. A wave is dropped when its radius passes `o.reach`; `resetRun` and
  `respawn` empty `G.waves`. The page's wave starts at the slam's landing as
  the page sees it, about 100 ms after the host's. It is drawn at the judged
  radius (`rendering.md`). **Attention** (`WARDEN2.heed`, `{ half: 4, lead: 1.3,
  every: 3 }`; host only, nothing on a page changes): the host keeps `e.heed`
  on a `duo` boss, a score per pid. Each hit `ASK.hit` accepts adds the
  health it took off (its health before `hitEnemy` less after, never below
  0, so a kill counts what was left); every tick each score is multiplied by
  `0.5 ** (dt / half)` and one under 0.01 is dropped. `number()` makes it
  `{}` (and `e.heedAt`, the time of its last turn, `-Infinity`) whenever the
  enemies are made again. `pick(e)` for a `duo` boss: the candidates are the
  live players in the chamber (`px.inBoss`). With two, and its target one of
  them, and a score on either, the target stays; it changes to the other
  only when the other's score is above zero and at least `lead` times the
  target's, `every` seconds have passed since `heedAt`, and the state is not
  `"wind"`, `"act"` or `"hold"`. Otherwise (fewer than two candidates, no
  score on either, or a target that is not a candidate) the nearest rule
  decides as for any enemy. `ASK.hit` no longer sets the target of a `duo`
  boss; for every other enemy it still does. **The roar** is `["roar", eid, t, phase]`, sent to both
  by `ASK.hit` whenever a boss's phase rises (a solo-tuned Warden's too,
  phase 2); the page waits for the drawn time and says `WARDEN2.lines[phase]`
  for a `duo` definition, today's line otherwise; `COOP_TAKE` refuses a
  roar whose phase is not 2, 3 or 4. **The boss bar** draws a notch at each
  of a definition's `marks` (`08_hud.js`, `.mk` in `#boss .bhp`), so three
  for the Warden for two and none for any other boss. **`host.phase(n)`**,
  for tests and the dev menu: puts the living Warden for two at the start
  of phase `n` (2 to 4) as a hit from nobody (`as` the placeholder) does
  that takes it from 1 above that mark to 1 under, roar event included,
  and returns the enemy; `null` with no such Warden or once it is in phase
  `n` or later.
- **The wire** (`06c`). Every frame is an `ArrayBuffer` whose first byte is
  its kind: `COOP.SNAP` (1), host to client, 20 a second: host time, the
  ack (the client's highest event seq processed), the other player's record
  and one 19-byte record per enemy that is awake, not idle, dying or within
  `COOP.RANGE` (45 m) of that client, kept a second after it stops
  qualifying; `COOP.STATE` (2), client to host, 30 a second: its player;
  `COOP.EVENT` (3): a JSON array, name first. A client's events are
  numbered (`[name, seq, ...]`, from 1 in each world, never wrapping) and
  are requests: `hello` (`["hello", 0, COOP_V, cls, COOP_BUILD]`), `at`
  (`["at", seq, e]`: this page is in the world of epoch `e`; a page sends it
  as soon as it has applied a join, a joiner of a cave included, and must
  send it for every `world`), `travel` (`["travel", seq, to, seed]`, `to`
  `"hub"` or a grade in `COOP.GRADES`, `seed` ignored for `"hub"`; pid 1
  only), `hit`, `parry`, `pin`,
  `exec`, `gate`, `pshot`, `pblast`, `cls` (`["cls", seq, class]`, a class
  picked on the room screen or changed from the pause menu mid-run: the
  proxy becomes that class where it stands, with the same share of health,
  a hidden one as the first base class, and the other player is told with
  the host's own `cls`). The host's events carry a world description `D =
  { e, kind, grade, seed, sum, n, enemies, dead, bossDead, t }`: the epoch,
  `"hub"` or `"cave"`, the grade (`null` in the hall), the seed (0 in the
  hall), the world's checksum, the players it was built for, the enemy
  list, dead ids, the boss's death and host time. `join` is `["join", { v,
  pid, started, peers, ...D }]`; `world` is `["world", { ...D, from, won
  }]`, sent to every player on each swap (`from`, the grade whose gate the
  party comes out of in the hall, else `null`; `won`, the host's run time
  when the exit gate caused it, else `null`). `gate` with the boss dead is a
  swap to the hall in front of the grade's gate with `won` set; with the boss
  alive, or in the hall, it does nothing. There is no `end`: a room outlives
  every run.
  The rest: `no` (`["no", "version"]` for a hello whose
  version is not `COOP_V` or whose build is not the host's `COOP_BUILD`, a
  hello with no build included), `started` (the host's page has sent its
  first state, so its player has pressed Start; sent once to a friend
  already in), `shot`, `ring`, `roar` (`["roar", eid, t, phase]`, the
  phase a boss has entered), `kill` (with whose event caused it),
  `reset`, `fed` (`["fed", eid, t]`, a dungeon for two's boss fed on a
  death in its chamber, above), `peer`, `cls` (`["cls", pid, class]`, the other player has
  changed class: `coopMateCls` changes the mate in place, keeping where it
  is and its share of health), `pshot`, `pblast`. A client checks a join's
  or a world's shape before building anything (`coopWorldOk`: an epoch `e`
  that is a whole number from 1; kind `"hub"`,
  or `"cave"` with a grade in `COOP.GRADES` and a finite seed; a string sum;
  enemy and dead lists of the right shape with known types; for a join, pid
  1 or 2) and refuses a join it cannot read as `"bad"` (a world as
  `coopEnd("bad")`, or, before this page has entered, as a join is
  refused); it then builds the world (`coopBuild`) and refuses it
  if `coopWorldSum` (FNV-1a over the mesh positions) differs; it never reads
  its own spawn list, only the host's. All numbers are in `COOP`. `COOP_V`
  is 4 (1 before `world`, `travel` and `at`; 2 until a world for two
  meant the big cave; 3 until the Warden for two's four phases). An
  enemy's record carries its flags in byte 17: 1 aware, 4 dead, 8 and 16
  the pin, and the phase less one in 32 and 64 (bit 2 is no longer set), so
  `coopSnapDecode` gives `phase` 1 to 4. The page follows every
  `world` (see the client between worlds). A join of cave 99 is about 1.5 kB; a join
  of big cave 99 built for two (188 enemies) is 5,901 bytes, and the largest
  of seeds 1 to 20 (seed 18, 199 enemies) 6,233 bytes, under the relay's
  16,384-byte frame. Snapshots carry only the enemies within
  `COOP.RANGE`, so their size follows the fight, not the cave.
- **The clock.** The client draws the host's world `COOP.DELAY` (100 ms)
  behind its estimate of the host's time, `CC.est`: its own real-time clock
  plus the largest offset (host time less arrival time) of any snapshot that
  arrived in the last `COOP.CLOCK_WIN` (0.6 s), the one that travelled
  fastest. The window is what lets it fall back: a clock fixed by the
  fastest snapshot ever would stay ahead of the snapshots once the
  connection slows, and the puppets would have nothing to draw. The drawn
  time (`CC.rt`) moves on with simulation time, faster or slower to catch
  the estimate, and jumps when more than 0.6 s off. Events that carry a
  time wait in `CC.evq` until the drawn time reaches it. One applied while
  the run is not live (queued before this player entered) or more than
  `COOP_LATE` (1 s) after its time changes state silently: no sound, big
  message or shake. A kill's sound and sparks play only within `COOP_HEAR`
  (30 m), as the puppets' other sounds do.
- **The client** (`07c`). Puppets are moved from the two snapshots round
  the drawn time; their swings are judged here on this player as the host's
  `enemyUpdate` would, so a guard or parry is decided by what this player
  saw. This player's hits are proposed and shown at once as guesses (health,
  posture, a flinch, a stagger, a death) that stand until a snapshot has
  acked them or 2 s pass. Executions are asked for with `pin` and finished
  with `exec`; the first pin to reach the host wins, and rewards a finish
  gave are taken back if the other player's pin or kill came first.
  `coopBegin(link, { cls, seed, drive, onRefuse })` sends the hello (`seed`
  is the first trip's, below); `coopEnter()` makes the run live;
  `coopEnd(why)` leaves co-op from anything (`"host"` goes to the title and
  says "The host has left.", `"stopped"` does the same with "The host's game
  stopped. The room is closed.", `"lost"` with "The connection to the room
  was lost. You can join again with the same code.", `"cave"` with "This
  browser built a different cave from the host's. Co-op cannot run here."
  (a world that differs mid-run), `"bad"` with the `bad` line (a world this
  page cannot read); any other reason leaves the screen as it is). A refusal
  (`coopRefuse`) ends co-op leaving the screen as it is and hands the reason
  to `onRefuse`. A link is `{ send(buf), onmessage, onclose(why), close() }`; a
  close before the join is applied goes to `onRefuse` with the link's reason
  (`"hostleft"` reads as `"relay"` there). After it: `"worker"` is
  `"stopped"`; on the friend's link (`link.viaRelay`) only `"hostleft"` is
  `"host"`, and every other close, the friend's own drop included, is
  `"lost"`; on any other link it is `"host"`. A world built after the
  boss's death opens the gate (`openGate`), and so does a `reset` whose
  `bossDead` is true: `coopReset` takes `G.bossDead` from the list, so a
  page whose `at` the host answered after the fight (it was told nothing of
  the kill) has the boss dead and its gate open. A wipe after the boss's
  death sends `bossDead` true again and the gate is left as it is. `coopPeer` takes pids 1 and 2
  only, never its own. A hidden class plays as the first base class
  (`coopBaseCls`), on both sides, and the save is not changed.
- **The client between worlds** (`07c`). `coopBuild(d)` builds the world a
  join or a `world` describes without leaving co-op (`enterHub(d.from,
  true)` or `enterCave(grade, seed, d.n === 2)`), returns false if its sum differs,
  makes this player the class co-op plays where the world put them, makes
  the puppets, opens the gate over a dead boss, and clears what belonged to
  the last world: `CC.seq` (the `at` is 1 again), `pend`, `ackR`, `evq`,
  `snap`, `fin`, `exE`, `gate`, `trip` and every mate's snapshots; it sets
  `CC.world`, `CC.epoch`, `CC.kind` and `CC.heard`, then sends `at`, and
  for a `world` (not a join) `cls` with this page's class (`CC.cls`): the
  host drops a `cls` from a player not there, so a card clicked under the
  fade, or on the room screen within a round trip of the host's travel,
  would otherwise change this page's class and not the proxy's. The host
  ignores a `cls` that changes nothing. A join needs none: its hello
  carried the class, and no card calls the host before `NET` is set. The
  other player (a mate) is not drawn where it stood in the last world: each
  mate is marked away and put where it arrives (full health, state
  `"free"`) until a snapshot of the new world moves it. **Where each
  arrives:** `coopSpot(world, pid, x, z, yaw, r)` in `06c`, from the
  world's arrival point and facing: pid 1 on the point, the friend (pid 2)
  `COOP.BESIDE` (1.2 m) to its right (`(-cos yaw, 0, sin yaw)`), moved out
  of the rock by `world.resolve`. The host's `build` (and `join`, from the
  world's start) and the page's `coopBuild` both place by it, so the host's
  proxy of a friend not yet heard stands where that friend's page put
  itself, and the two figures never stand inside each other; the camera is
  snapped after.
  `coopJoin` is `coopWorldOk`, then `coopBuild`, then `NET`. A `world` goes
  to `coopTravel(d)`: a run not yet live (a friend on the room screen) or
  reduced motion (`RM`) builds at once; otherwise it fades out as a solo gate
  does (`G.trans` with `swap`, `zones.md`) and builds at full black. The
  swap does nothing if `CC.link` is no longer the link it was made for (co-op
  ended or another run began under the fade), and a second `world` before
  the first was built replaces it. A build that fails mid-run is
  `coopEnd("cave")`. Before this page has entered (`!NET.live`, a friend on
  the room screen) a `world` that fails `coopWorldOk` or whose sum differs
  goes through `coopRefuse` with the same reason (`"bad"`, `"cave"`), as a
  bad join does: the room screen stays up, shows that line and is ready to
  try again. After a build a player on the death screen is shown the
  play screen; a dead, paused or menu player is taken along all the same,
  alive (the world made a new player). A `world` with `won` a number says
  "OUT ALIVE" (big, 4 s) and "Time m:ss" (the host's clock, as the win
  screen writes it) on arrival. `coopLeads()` is true with no co-op run or
  as pid 1. `coopPortal(grade)` (`NET.onPortal`): pid 1 asks `travel` once
  per world (`CC.trip`), the first trip with `coopBegin`'s `seed` and every
  later one with a random seed; pid 2 is told "Only the host can open a
  gate." once each time it steps in (`CC.portT`). `coopBase()` asks `travel`
  to `"hub"`.
- **The party rules.** Both arrive at the world's arrival point (the
  cave's start, or in front of the gate they came out of), the friend 1.2 m
  to the host's right; the host starts
  when it likes, the friend may join before or during a run and rejoining is
  joining. The friend cannot enter before the host has pressed Start (the
  join's `started`, or the `started` event; it stays set, so a friend who
  joins mid-run enters at once, and an away or paused host still counts).
  A death is the usual screen and respawn at that player's own
  rest point, and resets no enemies; while one is dead the enemies hunt the
  other. Both dead at once (away players not counted) is a wipe: the host
  makes the enemies again as a respawn does, once per wipe. Rest points are
  each player's own. Kill rewards go to the player whose event killed. The
  boss's death clears E for each in their own save, with no line about a
  new gate. Either player in the exit gate takes both back to the hall in
  front of E's gate: there is no win screen in co-op, each sees "OUT ALIVE"
  and the run's time, and the room stays open. **Only the host's page leads**:
  it opens a hall gate (the next trip is a fresh cave from a new seed) and
  its pause and death screens' Return to base takes both to the hall; the
  friend's screens do not show Return to base, and the friend stepping into
  a gate is told "Only the host can open a gate." The friend's ways out are
  Rise and Exit to main menu. Exit to main menu ends co-op for that page: the
  friend's leaves the host playing, the host's closes the room. A page that
  leaves gets its own hall back.
  Pause stops nothing. A player the host has not heard for `COOP.AWAY` (2 s)
  is away: not hunted, not counted for a wipe, drawn faded. A client that
  has had no snapshot for `COOP.WAIT` (1 s) shows "Waiting for the host",
  and after `COOP.GONE` (10 s) ends co-op: `"lost"` on the friend's link,
  `"host"` on any other. The friend leaving lets the host play on.
- **The Worker driver** (`COOP_HOST.worker(scope)`). It reads `WebSocket`,
  `setInterval` and `performance` from `scope` or the global, inside that
  function only. The page posts `{ start: { hub: true, relay, code } }` (the
  driver passes `hub` to `start`, and still takes `{ seed, grade }` in its
  place for a cave), then its frames, then `{ stop: true }`. It ticks the host from
  `setInterval` at 60 a second with real elapsed time, never more than
  `COOP.TICK_MAX` (0.25 s) a call, so a stalled Worker drops time rather
  than send a backlog. Frames for pid 1 go to the page by `postMessage`
  (the buffer transferred); frames for pid 2 go to the relay with the pid
  byte in front, only while the relay says the friend is in, and a snapshot
  is dropped while the socket has more than `COOP.SOCK_FULL` bytes queued.
  Relay notices are handled there and never reach `recv`. It posts `{
relay: "open" | "error" | "closed" }`; a closed relay leaves the run going
  for the page alone. Only `stop` closes its socket and timer (a room
  outlives every run); the page then terminates it (`{ stopped: true }`, or
  after 0.5 s). The page's side is `coopWorkerLink()`: a Worker error at
  any time closes the link with `"worker"`, which before the join is the
  refusal "This browser cannot host a room." and after it ends the run
  with `coopEnd("stopped")`.
- **The friend's link** (`coopSocketLink(url)`, with `viaRelay` set) hides
  the relay's framing: game frames pass through; `[0, 2]` (the host left)
  closes the link and the socket with `"hostleft"`; `[0, 1]` is ignored; events sent before the socket opens wait for
  it; once open, a state frame is dropped rather than queued while
  `bufferedAmount` is over `COOP.SOCK_FULL`. A socket that opens and has
  no join within `COOP.GONE` (10 s of real time; `coopJoin` sets
  `link.joined`) is closed: a silent host, or a host whose own socket never
  arrived so the friend took seat 1. A close says `"noroom"` (4004),
  `"full"` (4001) or `"relay"` (anything else, that timeout included), and
  the room screen is left ready to try again. A close after the join is
  `"lost"` (see the client), but for `"hostleft"`.
- **The relay's framing** (`relay/README.md` is the contract). `POST /new`
  gives `{ code }`, six characters without O, 0, 1, I or L. `GET
/room/CODE` upgrades; the first socket in is the host. Friend to host the
  relay prepends the sender's pid byte; host to friend the host's first byte
  is the addressee and is stripped. Its own frames start with 0: the host
  hears `[0, 1, 2]` (joined) and `[0, 2, 2]` (left), the friend `[0, 2]`
  (the host left; the friend must then close its socket). Closes: 4004 no
  such room, 4001 full, 4009 a frame over 16,384 bytes, 4008 a frame
  that finds the socket's token bucket empty (600 frames, refilled at 120 a
  second, two numbers in the room's memory), 1003 a text frame. HTTP 403 for a request whose `Origin`
  is not in the relay's `ALLOWED_ORIGINS` (the Pages site, as deployed) and
  not `http://localhost` or `http://127.0.0.1` on any port; a request with no
  `Origin` header is let through. 429 past the per-address limit. Game frames never start with 0.
- **The room screen** (`08e`, screen `coop` in `SCREENS` and `MENUS`).
  `#btnCoop` ("Play online") on the main menu is always shown, and opens
  this screen at once (`playOnline`), with no class screen on the way;
  nothing reads `?coop=1` any more, and an address that carries it works
  the same. The screen's heading is "Play online", and `coopRoomRender`
  keeps its first line (`#coopSub`, from `coopSubText`): "One of you hosts
  a room and sends the other its code or invite link. You each choose a
  class in the room.", or, while the saved class is a hidden one, "The
  Enforcer cannot play online yet, so you play the Assassin unless you
  choose another in the room." with the two names. `#coopHost` posts to
  `/new`, starts the Worker in the hall and joins it (`CR.seed`, which
  `DF.coopSeed` sets, is handed to `coopBegin` as the first trip's seed,
  random when null); it shows the
  code (`#coopShow`, large and selectable), `#coopCopy` ("Copy code") and
  `#coopCopyLink` ("Copy invite link"), the two slots (`#coopSlots`, each
  `.slot` with `data-cls` once known, `.me` for this player) and
  `#coopEnter` ("Start", which enters the hall at once, alone if need be).
  **The class is chosen in the room, not before it.** `#coopCls` (a
  `.picker`, with its line `#coopClsLbl`) is shown only while this page is
  joined, so to the host once its Worker has answered and to the friend
  once the join has arrived, a friend who joins mid-run included.
  `renderPicker` fills it with the base classes only and marks
  `coopMyCls()`. A card's click is the one click handler for every `.card`
  (`setClass`, so the save and this page's player change), which then
  calls `coopClsPicked()`: in a co-op run `CC.cls` is set and the host is
  asked with `cls`. The other page's slot follows from the `cls` the host
  sends. The cards sit below Start and Back so those stay in reach on a
  short screen. **The class can also change mid-run**, from the pause
  screen's Change class, by the same click handler: during a co-op run
  (`NET.client`) `renderPicker` gives every picker the base classes only
  and marks `G.player.clsId`, so a hidden class cannot be picked there.
  **The invite link** is this page's own address with `?room=CODE`
  (`coopInviteUrl`; the address without its query or hash, so the Pages
  site on the Pages site and localhost on localhost). `boot` calls
  `coopInvite(location.search)` after it has shown the main menu: a code
  of the right shape (`coopInviteCode`, tidied as a typed one is) opens
  this screen as Play online does, fills `#coopCode`, focuses `#coopJoin`
  and moves `data-padfirst` to it (`coopPadFirst`; `coopRoomOpen` puts it
  back on `#coopHost`). Nothing is sent until Join is pressed. A page
  `coopCheck` refuses says why on the main menu instead, and anything that
  is not a code is ignored. The address keeps `?room=`, so a reload (which
  some messages ask for) comes back to this screen with the code.
  `coopCopy(button, text, shown)` is every copy button's click:
  `navigator.clipboard`, else the older `execCommand("copy")` through a
  textarea (`coopCopyOld`), else the button reads "Could not copy" and the
  code on screen is selected; the button reads "Copied" for 1.5 s. `#coopJoin` tidies `#coopCode` (upper case, no spaces or dashes) and
  opens the socket; `#coopEnter` reads "Waiting for the host to start",
  disabled, until the join has arrived and the host has started, then
  names where it leads: "Enter the hall" (`CC.kind` `"hub"`) or "Enter the
  dungeon" (the host is already in a cave, so the join or a `world` built
  it there). Entering is
  `coopEnter()` then `play()`, from the click. A second click while one is
  under way does nothing. `play()` refuses on an upright touch device; the
  run is live all the same, and a later click (once the device is turned)
  calls `play()` again. Back, Esc, the pad's back button or the touch Back
  gesture on this screen (all through `menuGoBack`) ends a room not yet in
  play (`coopLeaveRoom`), its Worker and the world the join built, live or
  not. While a hosted room is open and the relay link is up, the pause
  screen shows "Room code" and the code (`#pauseCode`, `#pauseCodeV`,
  selectable) and the same two copy buttons (`#pauseInvite`, which is laid
  out as a `.row` but is not one, so `#scr-pause .row` is still the menu;
  `#btnResume` carries `data-padfirst` so a pad still starts there); a
  friend's pause screen shows neither. Before any network use, in order (`coopCheck`): the page must
  be the Pages site, `localhost`, `127.0.0.1` or a `file:`; `COOP_RELAY`
  must be set; a `file:` page is told to run `npm run dev`; a code must be
  six characters of the alphabet. `#coopMsg` is one element, written only by
  `coopSay`, which moves it onto the screen it is written on (the room
  screen while it is up, else the main menu, above its row of buttons);
  opening the room screen clears it. The messages are in `COOP_SAY`, among them `lost` ("The connection
  to the room was lost. You can join again with the same code."), `cave`
  and `bad` ("The host sent something this page could not read. Both
  reload the page."). `COOP_RELAY` is the deployed relay's
  `wss://` address (empty, co-op says it cannot reach the relay); `POST /new` goes to
  the same address with `http` for `ws`. `DF.coopRelay`, `DF.coopLoc` (a
  stand-in for `location`) and `DF.coopSeed` are for tests, which also
  call `DF.coopInvite(search)` and `DF.coopInviteUrl(code)`.
- **Privacy.** Only game frames cross the link. No name, no chat, no
  analytics, no logging. The relay stores only whether a room exists.
- **The dev lag dial** (`src/dev/20_lagdial.js`, local builds only):
  `coopSolo` runs a co-op run alone over the fake link (`coopFakePair`)
  with a host stepped on the page, and the dev menu's "Co-op alone, with
  lag" button opens a panel with ping, jitter, loss and a scripted second
  player (`coopMateBot`, which answers its join and every `world` with
  `at`, counting its events from 1 again after a world, and is taken along
  to where the host put it; `snap` is the last snapshot it was sent). It is
  the tool for checking feel. `coopSolo({ hub: true })` starts the host in
  the hall, where `seed` is the first trip's; `pid: 2` puts the page in as
  the friend and the scripted player in first as the host's page (pid 1,
  idle unless `mate` says otherwise), and `out.mateAsk(name, ...args)` has
  it ask the host anything (`travel` included). `coopSolo({ two: true })`
  starts the host's cave as a dungeon for two, so the big cave (passed to
  `host.start`; nothing for the hall). Without `save` the dev run
  (`DEV.run`) follows the run from world to world, so nothing it does is
  saved. The fake link draws its jitter
  and loss from `cfg.rnd` (`Math.random` when unset); `coopSolo` takes
  `rnd` and otherwise makes a generator from the fixed `LAG_SEED` for each
  run, so a test sees the same jitter and loss every time, while the lag
  dial passes `Math.random`. The game's own random choices (which enemy
  attacks, and when) are not seeded, so a test step must not rest on when
  a hit lands or which frame a loss falls on.

## Tests

- Co-op has its own tests. Run the Node ones after any change to `06c`,
  `06d` or anything the host copy runs; each prints `ok` or `FAIL` lines and
  ends `all passed`:
  - `node tests/coop-host.mjs`: the host copy in Node with scripted fake
    clients (targets and the swap, proposals, parries, executions, kill
    credit, the boss chamber, wipes, joining mid-run; a room that starts in
    the hall, `travel` and its refusals, the epoch and `at` (an `at` for
    another epoch is not acknowledged), back to the hall, the gate back to
    the hall with the run's time and the room still open, a second trip,
    crossing requests in both orders, a join mid-swap, the friend's proxy
    beside the host's on every arrival, a `cls` across a swap, the dummy's
    execution; a dungeon for two: the count of players, the extras, the
    scaled health and posture and the Warden's phase change, two attackers
    per player, a turn given up when a target changes or a hit turns the
    holder, the boss's feed and where it does not happen, a wipe, the
    hall never tuned; the big cave: built exactly for two, a friend who
    joins a cave for one gets the small cave, it stays big through a wipe
    and a leave, a friend who joins it again under way, its extras, the
    enemy count over seeds 1 to 20 and 99, the build time and a minute's
    step cost, each printed), and the Worker driver with a stand-in for the Worker's
    global (the 0.25 s cap, the pid byte, relay notices, a closed relay,
    stop, and a gate that does not stop it; a start in the hall, as the page
    posts it, and one with a seed and a grade in a cave).
    `fakeClient(host, pid, cls, { at = true })` in `tests/lib/coop.mjs`
    answers every join and world with `at` at once, as a page does; with
    `at` false the test sends it with `c.arrive()`. Its event numbers start
    again after each world, and `c.world` is the latest description. A test
    that joins a player some other way (`host.join`, a hello) must send that
    player's `at` itself, or the host ignores it.
  - `node tests/coop-warden.mjs`: the Warden for two on the host copy in
    Node with two scripted players: its health, posture and marks, the
    solo definition untouched and a cave for one's Warden as today, a roar
    at each mark with its phase to both players, one roar for a hit across
    two marks, a phase that does not fall, the phase 4 roar's 2.2 s and
    `host.phase`. Its helpers (`duo`, `inChamber`, `stand`, `strike`,
    `strikeTo`) are for the checks later parts of this fight add. It also
    checks that the slam for two carries the aftershock, the solo slam does
    not, and the key order is unchanged.
  - `node tests/coop-wire.mjs`: the wire formats and the fake link, the
    phases 1 to 4 beside the other flags and `COOP_V` 4, a
    `world` event's round trip and the size of the joins of big cave 99 and
    of the seed of 1 to 20 with the most enemies, built for two, against
    the relay's cap (the larger printed).
  - `node tests/coop-caves.mjs`: caves built from seeds 1 to 40, big caves
    for two from seeds 1 to 10 and the co-op hall in Node, Chromium,
    Firefox and WebKit compared by checksum (run it after any change to
    cave or hall generation).
  - `node tests/coop-relay.mjs`: the relay under `wrangler dev` on port 8787
    (started and always stopped by `tests/lib/relay.mjs`, metrics off, no
    login, no deploy).
  - Page tests: `tests/t27.mjs` (the client against a hand-stepped host over
    the fake link: puppets, hits, parries, executions, the checksum, a
    world that differs mid-run, a join's epoch, the other player after a
    swap, puppets and the boss bar scaled for two in the big cave with the
    host's sum and a plain solo run after it, a world for two that says
    `n` 1 refused) and `tests/t28.mjs` (the other player and
    the party rules: the gate back to the hall, from the hall to the cave
    (the big cave, in pieces, with the host's sum) and back, a second trip, the friend taken along and turned away at a
    gate, a paused player taken along, the feed's line, Return to base, an
    exit mid-fade, the player's own hall after co-op, a plaque that takes no code, no new-gate line, reduced motion,
    an execution on the dummy that leaves it standing on both sides and
    keeps its rewards, a `reset` with the boss dead that opens its gate, a
    class picked while a world is on its way reaching the host after it,
    the friend arriving beside the host's arrival point),
    both with `smoke`; `tests/t32.mjs` (the Warden for two on the page,
    `smoke`: the boss bar's three notches for two and none alone; look at
    `shots/t32-bar.png`, three notches at a quarter, half and three
    quarters of the bar; its `window.__w2` helpers start a run for two,
    stand this player in the chamber and wake the Warden, and force a slam
    on the host's Warden at phase n with this player 12 m from where it
    lands: `slamSetup`, `runSlam`). It also covers the aftershock: it hurts
    for 14 once between 1.2 and 1.7 s after the landing, a dodge through
    it takes nothing, a guard facing it blocks (stamina and chip read), a
    phase 1 slam sends none, and a respawn and a new world clear it; look at
    `shots/t32-wave.png`, a red ring half way out between the Warden and
    this player, on the floor; `tests/t29.mjs` (the room screen up to the network: the button,
    the code's tidying and refusal, every message, the order of the checks,
    the class fallback, a Worker host on the page that starts in the hall,
    the friend's button naming the hall or the dungeon, a `world` refused
    before the friend enters, the class cards for the
    host and the friend, the `cls` request from the room and from the pause
    menu mid-run, the copy buttons with a
    stand-in clipboard, an invite address through `DF.coopInvite`, a world
    that arrives before the friend enters, Back, Exit to main menu
    from a hosted run and a second room after it, a room that never
    answers, a Start that `play()` refuses, a Worker that fails) with
    `title`, on
    the desktop page and on a phone:
    `DEVICE=oneplus-13 SCRIPT=$PWD/tests/t29.mjs node test.mjs title`, or on
    every phone with `node tests/touch-all.mjs tests/t29.mjs title` (the
    `title` is needed: the default mode is `smoke`). Look
    at `shots/t29-room.png`, `shots/t29-room-class.png` (the cards and
    the copy buttons) and the two `shots/oneplus-13-t29-*.png`.
  - `node tests/coop-e2e.mjs`: end to end. It serves `dist/` on port 8123,
    starts the relay on 8787, and drives Chromium pages: host and join by
    code, each picks a class and the other page shows it, both enter the
    hall as what they picked, each with the other there, each changes class
    from the pause menu and the other page shows that, the friend sees the
    host walk in the hall, the host walks into E's gate and both pages are
    in one cave (same seed and sum, built for two: the big cave on both,
    188 enemies and scaled husks), an old version refused, the friend
    comes back by the invite link the host's pause screen copies (a real
    page load with `?room=`) and lands in the cave, picks a class mid-run
    and enters, a host page that stops drawing
    (marked away after 2 s while the dungeon runs on), a full room, the host
    leaving, a second room through E together, the gate bringing both
    pages to the hall with the host's pause screen still showing the code,
    a second trip into a cave of another seed, and then on two fresh
    pages the friend exiting to the main menu (the host plays on), the host
    exiting (the friend is told) and a second room with no reload. The host
    page's address has no `?coop=1` and the friend's has it. Every HTTP request but
    to localhost is aborted (Playwright's routing does not see WebSockets;
    the only socket address the test gives the pages is the local relay). Afterwards `lsof -i :8787` and `lsof -i :8123` must
    show nothing.

## Known problems

- The numbers of a dungeon for two (`COOP_TWO`) are the owner's starting
  guesses and have not been played by hand. A friend who joins a cave built
  for one makes it easier: the count is taken only when the cave is built.
- A run for two is in the big cave, 36 rooms and about 178 enemies against
  16 rooms and about 47 alone. How long such a run takes, and whether that
  is too long, has not been tried by hand.

- Co-op is grade E, two players and the five base classes, and assumes
  desktop Chrome or Safari. It has not been played by hand or between two
  machines. The relay is deployed on the owner's Cloudflare account, free
  plan; a change to `relay/` reaches players only when the owner runs
  `npx wrangler deploy` again.
- The co-op host never simulates a player, so on the host nothing pushes an
  enemy off a player (each client keeps itself out of the puppets it
  draws). An enemy's last-seen memory can leak between the two players:
  `seeingMate` copies a pack-mate's sighting of the other player, and a
  target switch keeps the old target's last-seen spot.
- D's grabs and the siren's song are not safe on a co-op host: their callers
  treat `hurtPlayer`'s `"remote"` as a hit that landed and would
  `grabPlayer` a proxy. Co-op is E only, where nothing grabs. Fix this
  before hosting D.
- Co-op executions: the first player whose `pin` reaches the host gets the
  kill (the spec said the first to finish). A lost pin's rewards are taken
  back; if the other player's kill event is applied on the very step this
  player's finish runs, the rewards stay. A second execution finished within
  about 0.6 s of an unanswered first one is not checked (high ping only). A
  lost pin on the Warden still lands its 120 damage as an ordinary hit.
- The other player may hit an enemy someone is executing; whoever's hit
  kills it gets the kill.
- A hit sent just before a wipe and arriving just after it lands on the
  fresh enemy that reuses the id (events carry no reset number).
- The other player's hits are shown from a puppet's health dropping, so a
  guess of this player's that expires unanswered after 2 s can replay as the
  other player's flash.
- A reflected (parried) shot is not shown to the other player. The other
  player's shots are drawn when they arrive, about 100 ms ahead of their
  drawn body.
- A guessed-dead enemy that is still alive on the host but further than
  45 m away stays dead on that client.
- A co-op world in which one player sends more than 65,535 events stops
  acknowledging them: the seq travels in the JSON event and never wraps,
  but the ack in a snapshot is 16 bits, and the host refuses a seq above
  65,535. The count starts again with each world.
- The checksum that refuses a different cave covers the world mesh
  positions only.
- In co-op, a dead player's screen still says the enemies come back, which
  is not true of a single death; a dead
  player's marker floats above the body; a dead player sees no Warden slam
  ring.
- The relay's per-address limit is in memory, per isolate, best effort.
  Nothing caps spending on Cloudflare's paid plan: stay on the free plan,
  where the worst case is that co-op stops until 00:00 UTC. The pricing
  figures in `relay/README.md` were read once and should be checked against
  Cloudflare's pages. The hibernation path is not exercised by the test.
- A co-op host page in a hidden tab: the Worker keeps the dungeon running
  and the host's player is marked away after 2 s (the end-to-end test
  imitates this by stopping animation frames). Whether every browser keeps a
  Worker's timers running in a background tab is unverified.
- The relay closes a socket whose token bucket runs dry: a burst of 600
  frames passes, then 120 a second. The Worker and the friend's link drop
  snapshots and states while the browser's socket queue is backed up and
  never hand the host more than 0.25 s at once, so only frames already
  handed to the operating system before a stall of more than about 10 s
  could still arrive together past the burst.
- Dead enemies stay in every snapshot for the rest of the run (the spec
  said "dying"), about 1 kB a snapshot late in a run. Changing it touches
  how a guessed death is confirmed.
- The relay ends a room the moment the host's socket closes (the spec said
  a room is dropped ten minutes after its last socket closes), and the
  host's Worker does not reconnect, so any drop of the host's connection
  ends co-op for that run.
- Cheating is not guarded against (a non-goal): a client with the code can
  kill every enemy or take the party out once the boss is dead.
- A dead host's page that presses Return to base is on the play screen
  until the hall arrives, so the death screen shows again for about a round
  trip before the fade.
- A death in the co-op hall would end co-op on Rise (`respawn` with no
  checkpoint is `enterHub()`). Nothing in the hall hurts a base class.
- `travel` is asked once per world: a trip the host ignores (it never
  should, the page's `at` goes first) leaves the gate shut until the next
  world.
- Only Chromium has hosted a room. Whether Safari and Firefox send the
  page's origin from a Blob-URL Worker's WebSocket is unverified; if they
  send `null`, the relay refuses that host.
- Whether a friend's hard network drop (Wi-Fi off) leaves seat 2 taken, so
  a rejoin says "That room is full." until Cloudflare notices the dead
  socket, is unverified without a deploy.
- When the relay closes under a host who is playing, the run goes on alone
  and a line says no friend can join; a friend already in is told the host
  has left.
- An invite link opens the room screen but does not join: the friend
  presses Join. The link stays in the address, so a page reloaded or
  bookmarked after the room has closed opens on the room screen with a
  dead code ("No room has that code." on Join). The copy buttons were
  checked with a stand-in clipboard only, never against a real one, and
  there is no share sheet (`navigator.share`) on phones.
- The dev lag dial's panel swallows a mouse release over it in the
  no-pointer-lock fallback.
- `tests/t29.mjs` fails one step on the short phones pixel-9, pixel-5,
  fold-7-cover and moto-g4 (`node tests/touch-all.mjs tests/t29.mjs title`,
  4 of 12; the other eight pass): "the host chooses a class in the room, and
  the code and the invite link are copied", key `startInView`. That key
  checks that the bottom of Start and Back (`#coopEnter`) is inside the
  viewport and above the class cards, and it fails on the short landscape
  viewports of pixel-9, pixel-5, fold-7-cover and moto-g4 (293 to 360 px
  high). Seen on 239d320, before the co-op lobby, and unchanged by it. The
  cause is not investigated.
- A dead friend taken along by the host arrives on the play screen without
  pointer lock: the death screen released it and the swap is not a click,
  so on desktop the camera does not turn until the first click, which also
  swings.
- A page that arrives in a cave after the boss has died there (its tab was
  stalled through the fight) is told the boss is dead by the host's `reset`
  and gets the exit gate, but `bossFell` does not run on it, so that page's
  save does not record the clear of E.
- The `tests/coop-host.mjs` check "nothing on the host hurts or moves a
  proxy" fails now and then on its last assertion, the swing-number
  count (for example `an 8 vs 0+7`: the husk's swing number is one more
  than the swings the check counted). It failed 2 of 400 runs on 81a32fe
  (the commit this branch started from, on an idle machine) and 1 of 13 runs
  during the final review of the big cave, so the rate is not known, and it
  is older than the co-op lobby. The cause is not investigated; a failure of that one check alone
  is run again before it is believed.
