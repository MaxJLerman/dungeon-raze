# Enemies: AI, flags, HUD tags

## Enemies (`enemyUpdate` in `06_game.js`)

- State machine in `enemyUpdate`: `idle`, `alert`, `chase`, `search`, `wind`,
  `act`, `rec`, `hit`, `recoil`, `stagger`, `roar`, `return`, `dead`, and
  two more that only some enemies use: `fall` (Drop) and `hold` (a grab, below).
  The switch has no case for `hold`: the enemy stands while its hook (D's
  grabbers) or the co-op host (the Warden for two's seize, `coop.md`) drives
  it. Nothing before the switch moves a boss in `hold` (it has poise 2, so
  no knock) or takes it out of it; a hit can (a stagger, a roar, a death).
- At most two non-boss enemies may attack at once. They claim a token with
  `takeToken`; the rest circle. In a co-op dungeon built for two (`NET.two`,
  only ever true on the host, where every enemy has a target `tg`) the limit
  is `COOP_TWO.turns` against each player: only holders with the same `tg`
  count (`coop.md`).
- `makeEnemy` reads its definition from `(G.edef || EDEF)[type]`. `G.edef`
  is `null` but in a co-op dungeon for two, where it is `coopTwoDefs()`:
  each type's entry behind an object with its own scaled `hp` and
  `posture` (the dummy's left as it is). So code reads health and posture
  from `e.def`, never `EDEF[type]`, and nothing writes to `EDEF`.
- `poise` 0 flinches on any hit, 1 only on heavy hits, 2 never.
- Posture fills from hits and parries and breaks into `stagger`, which opens
  the enemy to an execution.
- `aware` means "hunting the player": true in `chase` and `search`, false in
  `idle` and `return`.
- **Sight.** A regular enemy that is hunting follows the player only while
  `canSee(e)` holds: the line is clear and the player is within `sight` times
  `PURSUIT.seeMul`, in any direction. While it can see, it records where the
  player is and how they are moving (`lsx`, `lsz`, `lvx`, `lvz`). `lost` is
  the time since. A hit, or a neighbour's wake-up, also sets the last-seen
  spot.
- **Search.** After `PURSUIT.lostT` of broken sight, `chase` hands on to
  `search` (`toSearch`), which has three steps in `e.sub`: `go` routes to the
  last-seen spot, `guess` walks on the way the player was heading, `look`
  stands and sweeps. Seeing the player in any step returns to `chase`.
- **Giving up.** `giveUp(e)` is the one way a hunt ends: unaware, state
  `return`. `huntOver(e)` decides it for regular enemies: the player is in
  the boss chamber or dead, or the enemy is past `leashOf(e)` from its post
  with no provoke left. A hit sets `e.prov`, which suspends the leash for
  `PURSUIT.provoke` seconds, and a provoked enemy that wakes neighbours on
  their way home shares it with them.
- **Pack.** An enemy that can see the player keeps regular enemies within
  `PURSUIT.pack` in the hunt. One that is hunting but cannot see takes the
  player's position from it every step (`seeingMate`, `e.told`), so its
  search heads for where the player is now and it does not give up while it
  is being told. One that is idle or walking home is woken (`callPack`),
  under the territory rule below. The boss and the dummy take no part.
- **Territory.** An enemy walking home notices the player again only when
  `inTerritory(e)`: the player is within the leash less `PURSUIT.edge` of its
  post. This stops it turning straight back at the leash edge.
- **Boss chamber.** `G.inBoss` is set in `update`. While it is true, regular
  enemies give up and `alertE` refuses to wake them, whether by sight, a
  neighbour or a hit. `genWorld` keeps tunnel posts out of the chamber. An
  enemy hit in that time still flinches, so it can pass through `hit` and one
  step of `chase` while unaware. `chase` sends an unaware regular enemy
  straight home.
- **`e.inArena`** is an instance flag for an enemy that is part of the boss's
  fight; only the crocodile's fall bloaters set it. The boss-chamber rule
  does not hold it: `alertE` wakes it there, `huntOver` does not end its
  hunt for `G.inBoss` and, while the player is in the chamber, not for the
  leash either; while the player is in the chamber it knows where they are
  (the sight memory treats it as seeing them, without calling the pack),
  so it never loses them or searches; and `hitEnemy`'s `held` (no ambush
  bonus) does not apply to it. With the player out of the chamber it is a
  regular enemy. A type or enemy without it is unchanged. The leash and the
  always-knowing are deliberate: a bloater sees 18 m while hunting and is
  bound to its water, so without them one across the 52 m cavern would lose
  the player and give up at once.
- **Boss flags on `EDEF`.** `arena: true` makes a boss's chase give up only
  when the player is dead or out of the boss chamber (`!G.inBoss`), in place
  of the 38 m and 30 m limits. `ownPhases: true` skips `hitEnemy`'s
  phase change and roar, for a boss with its own phases. For any other
  boss `hitEnemy` sets `e.phase` to 1 plus the number of `def.marks`
  (shares of full health, `[0.5]` when it has none) its health is below;
  when that is above its phase it enters it with the roar (state `"roar"`,
  posture cleared, the sound, shake and shock ring), once a hit however
  many marks the hit crossed. A phase never falls there; the boss's reset
  on reaching home puts it back to 1. `def.roarT` maps a phase entered to
  its roar's length in seconds (the `roar` case of `enemyUpdate`), 1.2 s
  for one it does not list. An attack's `from` is the first phase it may
  be chosen in (`chooseAtk`); without it `p2: true` means 2, else 1.
  Readers of "the second phase" (the speed 1.2 and tempo 0.85 in
  `enemyUpdate`, the glow and sprite in `07_render.js`, a co-op page's
  tempo) read `e.phase >= 2`. Only the Warden for two (`coop.md`) has
  `marks` or `roarT` today, and only its `seize` has `from` (3); `EDEF`
  carries none of them. The seize (`kind: "seize"`, style `"seize"`, both
  arms wide in the wind-up) has no hit of its own on the host; `EBEH.warden`,
  which only the host copy registers, keeps it out of `chooseAtk` for 14 s
  after a seize (`coop.md`). An attack's `after` (the Warden for two's slam only, `coop.md`)
  is data for an aftershock: where a `"slam"` lands in `enemyUpdate`, and in
  a co-op page's puppet, an enemy whose phase is at least `after.from` calls
  `waveStart(x, z, after)`; `EDEF` has none, so solo slams are as ever.
  `EBEH.warden` also has `hpFloor` (outside its chamber before phase 4
  its health stops at its last mark) and, in `step`, the seal's rule: while
  `G.seal` stands and it has no live target inside the ring it stands where
  it is and never gives up or walks home (`coop.md`, the seal).
  `fell` is the big message `kill` shows for a boss (the Warden's is
  "THE WARDEN FALLS"; a boss type needs one). `spawnEnemies` leaves out any
  `boss` type once `G.bossDead`. `tests/t25.mjs` covers these and `atkOk`.
- **The boss** has none of the above. It keeps its 38 m and 30 m limits and
  its heal on return, and routes round rock when the line to the player is
  blocked.
- **Bound types.** An `EDEF` entry with `bound: "water"` or `bound: "wall"`
  is tied to a place. `bound(e)` reads it, and it is the one test for "heavy
  like the boss" in the class tools: the Enforcer's grapple pulls the player
  to it, and the Sapper's execution does not kick it. Its cave-in staggers
  it like any enemy, but not while it is hidden or safe (and `caveImpact`
  skips the forced stagger when a hook refused the hit). The Riftwalker's
  rifts and Drop never take it, and
  `separate` weights it like the boss, so other enemies cannot shove it.
  Its footing is a `foot` hook:
  - `waterFoot(e, x, z)` (bloater, eel, siren): `waterAt` at least 0.5 (the
    shore), `fieldAt` at least `e.r`, and the point is in the enemy's own
    body of water (`e.body`, read from where it first stood) or `bodyAt` is
    -1, which is the shore between two grid points.
  - `wallFoot(e, x, z)` (grabber): the post `hx`, `hz` and nowhere else.
  - `setRoute` gives a type that has a `foot` hook one straight point instead
    of a route, since the route grid knows nothing of water.
- **Hidden and safe.** `e.hidden` is an enemy that is not in the fight: it is
  not drawn, has no tag, cannot be locked, aimed at, hit (no flash, sound or
  alert), caught in a blast, grappled, staggered or executed, and does not
  separate or cross a rift. `makeEnemy` sets it for an `EDEF` entry with
  `ambush: true`, and its own step turns it off. Everything that skips a
  falling enemy skips a hidden one, and a lock drops the moment its enemy
  turns hidden. `e.safe` is the lesser case: still drawn and lockable, but
  not a target for damage (the eel under the water). `hitEnemy` refuses a
  hit quietly, a player's shot flies on past it (so it neither eats the shot
  nor sets off an `aoe` or sticky one), mines and tripwires ignore it, the
  cave-in forces no stagger on it, and `aimYaw` and `aimRanged` pass it
  over unless it is the locked target. An `ambush` type takes no
  part in being woken or waking others: it is left out of `seeingMate`,
  `callPack`, `alertE`'s neighbour wake and the sight wake-up, and its own
  rule says when it acts. No hidden enemy is woken by sight either.
- **Aloft.** `e.aloft` is an enemy up in the wall where only shots reach it
  (the crocodile in its tunnel phase). Every place that skips `e.hidden`
  skips `e.aloft` too, except two: the player's shot hit loop in
  `projUpdate` and `aimRanged`, so shots and their aim still find it. So it
  cannot be locked (a lock on it drops), aimed at by `aimYaw`, hit in melee
  or by the reach tear or blink, caught in a blast, cloud or eel shock,
  grappled, executed, dropped, crossed through a rift, set off a mine or
  wire, struck or pushed by a cave-in or a Drop's landing, or separated, and
  a sticky bomb on it drops off. `hitEnemy` itself does not skip it. A
  bursting shot (`aoe`, the Mage's orb) that strikes it still bursts, and
  since the burst passes over it, the shot loop hits it with the shot's
  damage as an `aoe` hit. Types that never set it are unchanged.
- **Falling shots.** A shot with `vy` falls by it each step to no lower
  than its `yTo` (`projUpdate`), or, with `vy` above 0, climbs to no
  higher; the crocodile's plates use it. A parried one is set to climb
  back to its `src`'s height (`vy` 0 when the source is dead). Only the
  drawn height changes: hits are on the flat floor as for every shot. A
  parried plate (`plate` on an `own "p"` shot) passes every enemy but its
  `src`, since it flies back up to the mouth over what stands below.
- **Water.** An `EDEF` entry may carry `wade`, a factor on its speed in
  water: below 1 slows it, above 1 speeds it. `wadeOf(def)` returns it, or
  `WATER.slow` when the entry has none, and E's types have none (the bloater
  is 1.0, the eel 2.0, the siren 1.8). `eStep`
  applies it (`wadeMul(waterAt(e.x, e.z), wadeOf(e.def))`), and `walkRoute`,
  charges and lunges go through `eStep`, so nothing needs a check in a state.
  A new way of moving an enemy must go through `eStep` too.
- **Movement.** In view, enemies steer straight at the player and slide
  along walls. Out of view they follow a route: `setRoute(e, x, z)` asks
  `world.route` (at most two per `update`, so callers retry when it returns
  false) and `walkRoute(e, speed, dt)` follows it. `routeAim(e)` is the step
  both it and the boss use to find the next point. `search` and `return` use
  them. A route that makes no headway for 1.5 seconds is dropped and asked
  for again.
- **Posts.** An idle regular enemy more than a metre from its post walks
  back. If a body cannot stand on a post because it is too tight against a
  wall, the nearest spot it can reach becomes the post.
- Every pursuit number is in the `PURSUIT` table next to `EDEF`. An `EDEF`
  entry may carry its own `leash`.
- `threat` on an `EDEF` entry is 0, 1 or 2: weaker than the player, around
  their level or slightly above, much stronger. Read it only through
  `threatOf(e)`, which is where levels will plug in. It colours the name tag
  above the enemy: `.tag.t0` white, `.t1` orange, `.t2` red, in
  `index.tpl.html`. The same classes style the name on the big boss bar.
- The HUD keeps a pool of ten overhead slots, each a name tag over a health
  and posture bar. The locked target takes a slot first. A boss on the big bar
  gets no slot, even when locked, because that bar shows its name. A boss
  that has not noticed the player gets the tag alone (`nobar`).
- A slot shows when the enemy is aware, hurt, or looked at, within 26 metres.
  "Looked at" is `looked` in `08_hud.js`: the enemy's body is inside a box
  around the screen centre and `world.los` from the player is clear. The box
  is tall because the resting camera looks down, so an enemy straight ahead
  sits above the centre. The HUD only reads enemies; looking never wakes one.
- `EDEF.dummy` is the training dummy. Its `dummy: true` flag is honoured in
  nine places: `makeEnemy` (always aware, so no ambush bonus and its bar
  shows), `enemyUpdate` (pinned in place, no AI), `hitEnemy` (health restored
  after every hit), `kill` (refuses), the `execute` case of `playerUpdate`
  (stands back up, and is not kicked by the Sapper or dropped by the
  Riftwalker), `caveImpact` and `separate` (not pushed out of the rubble),
  and `riftBodies` and `holesUpdate` (never crosses a rift, never falls).
  Any new way of killing or moving an enemy must respect it.

## Recipe: add an enemy

1. Add an entry to `EDEF` with its attacks and its `threat`, and a `leash`
   if it should hunt nearer or further than `PURSUIT.leash`. An attack with
   `trig` can start a sequence; one without can only be reached through
   another's `chain`.
   `unb: true` makes it unblockable and shows the red warning.
2. Add a figure in `makeEnemyFig`, with `f.rim` and `f.eye`. A D type puts
   its figure in `EFIG` and its pose in `EPOSE` (`05b_dbodies.js`) instead.
3. Reference the type name in `PACKS` in `03_world.js`, or, for the sewer, in
   the spawn block at the end of `genSewer`.
4. An attack with special movement needs a `kind` and handling in the `wind`
   and `act` cases of `enemyUpdate`. See `slam`, `charge`, `shot`, `volley`.
   A D type does this through the `wind` and `act` hooks in `EBEH`.
5. Behaviour that only this type has (a rule on when it may attack, a hit it
   refuses, ground it may not stand on, something it does each step) is a hook
   in `EBEH` (`06b_ebeh.js`), not a branch in `enemyUpdate`. Anything that
   moves the type must go through `eStep`.

## Tests

- Run `tests/t10.mjs` after any change to the HUD, enemy name tags or menus,
  and `tests/t11.mjs` to look at them. Both use `smoke`. Their steps wait two
  animation frames before reading the DOM, because the HUD only updates when
  a frame is drawn.
- Run `tests/t12.mjs` after any change to enemy movement, sight, giving up
  or `fieldFns`. It uses `smoke`. `DF.fieldFns` lets a test build a small
  field by hand, which is how the route tests make walls and gaps of an exact
  width.

## Known problems

- A regular enemy hit from inside the boss chamber takes the damage and does
  not respond. Such hits get no ambush bonus (`held` in `hitEnemy`).
- Enemies only route when the player is out of view. In view they still
  steer straight, so a wide enemy can catch on a corner the line of sight
  just clears.
