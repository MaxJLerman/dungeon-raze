# Co-op: the hall as a lobby, gate travel and a dungeon tuned for two

Design, 2026-11-25. The first of three pieces the owner chose to build one
at a time. The second is a much bigger cave for two players, drawn in
pieces as the sewer is; the third is more health and more phases for the
Warden. Neither is part of this one.

## What the owner asked for

Today a co-op room is one grade E cave: pressing Host builds it, a friend
is sent it, and the room closes when either player takes the exit gate.
The owner wants the friend to join the host in the hall instead, and to be
pulled into a dungeon with the host whenever the host steps through a
gate. Because two players make the cave much easier, the dungeon must be
harder when it is entered by two. The owner approved these five changes:

| Change | Starting number |
| --- | --- |
| More enemies in each room | one extra per pack, two in the deepest rooms |
| Regular enemies tougher | health and posture x1.3 |
| The Warden tougher | health x1.8, posture x1.5 |
| Attack turns per player | two attackers per player, not two in all |
| A death at the boss costs something | the Warden regains 25% of its health when a player dies in its chamber |

Why: a room should be a place two players meet and set out from more than
once, not a single forced run, and that run should still be a fight.

## Goals

- A friend who joins a room stands in the host's hall and sees the host.
- The host stepping through a gate takes both players into the same
  dungeon. Leaving it brings both back to the hall, and the room stays
  open for another run.
- A dungeon entered by two players is harder in the five ways above.
- Every number of the tuning sits in one table.

## Non-goals

- Grade D in co-op. Its gate is sealed in a co-op hall.
- The bigger cave and the Warden's extra phases (pieces two and three).
- More than two players, or a lobby other than the hall.
- Changing enemy damage, speed or timings, kill rewards or flasks.
- A revive, a confirmation before leaving, or any guard against cheating.
- The dev menu's gates and boss jumps during a co-op room. They are left
  as they are.

## Anti-goals

- The single-player game changing in any way. With `NET` null nothing here
  runs, t22's hashes hold and every solo test passes untouched.
- A friend left behind in a world the host has left, or hunted in a world
  it has not finished building.
- A room that closes because a run ended.

## How it works today

`docs/notes/coop.md` is the record. In short: the host's page runs a
second copy of the simulation in a Worker (`06d`). `start({ seed, grade })`
builds one cave there. A `join` event carries that cave (seed, grade,
checksum, the enemy list) and the client refuses any grade but E. Proxies
stand in for players on the host; each client owns its own player. The
`gate` request, once the boss is dead, sends `end` and the run is over.
`enterHub` on a client ends co-op. The hall is a world like any other: it
has one enemy in its spawn list, the training dummy, and its mesh differs
with which gates are open (a sealed gate is filled with blocks).

## Approaches

1. **One host for the life of the room, which swaps its world** (chosen).
   The Worker starts in the hall and builds a new world each time the
   party travels. It tells both pages with one `world` event that carries
   what `join` carries today. The hall is run exactly as a cave is: the
   dummy is a host-owned enemy and both players see each other's hits on
   it. Cost: every place that assumes one world for the life of the link
   has to learn about a swap. Benefit: one code path for hall and cave,
   and the big cave of piece two is just another world to swap to.
2. **The hall as a meeting room only.** In the hall the Worker passes
   player positions and simulates nothing; each page keeps its own dummy.
   On travel it starts a run as it does today. Less to change on the host,
   but co-op gets a second mode (enemies local in the hall, puppets in a
   cave) that every hook in `NET` must branch on, and the dummy is not
   shared.
3. **A new room for each run.** The room is ended and made again on every
   trip. The relay ties a room to the host's socket, so the friend would
   be dropped and need a new code each time. Rejected.

The owner left the how to the builder; 1 was picked for the single code
path.

## The design

### Worlds and travel

- The room's world is one of two kinds: the hall, or a grade's dungeon
  from a seed. The host keeps an epoch, a number that goes up by one with
  each world it builds.
- The Worker starts in the hall when the room is made. `host.start({ seed,
  grade })` still starts straight in a cave, because the lag dial, t27,
  t28 and the Node tests use it.
- **The co-op hall has E open and every other gate sealed, on the Worker
  and on both pages**, whatever either save holds. This keeps the three
  meshes the same (the Worker has no save) and keeps D out. A page that
  leaves co-op gets its own hall back.
- **Only the host's player travels.** When the host's page steps into the
  open gate it asks the Worker to travel (`travel`, with the grade and the
  seed the page chose; `DF.coopSeed` still sets it for tests). Only pid 1
  may ask. The friend stepping into the gate does nothing but show a line
  ("Only the host can open a gate.").
- The Worker builds the world, moves every proxy to its arrival point
  (the cave's start; in the hall, in front of the gate they came out of)
  at full health, raises the epoch and sends every client a `world` event:
  epoch, kind, grade, seed, checksum, the enemy list, and how many players
  the dungeon was built for.
- A client that gets `world` drops its puppets, queued events and guesses,
  fades out as a solo gate does, builds the world from the event, checks
  the checksum, fades in and answers `at` with the epoch. A player who was
  dead, paused or in a menu is taken along all the same and arrives alive;
  one who was on the death screen lands on the play screen.
  A checksum that differs ends co-op for that page as a bad join does.
- **Until a client's `at` for the current epoch arrives the host treats
  that player as not there**: its states and its requests about enemies
  are ignored, it is not hunted and not counted for a wipe, and it is sent
  no snapshots and no events about the new world's enemies. This is what
  keeps a hit meant for the old world from landing on an enemy that
  reuses its id. `travel` and `gate` from such a player are ignored too,
  so a Return to base that crosses the friend's step into the gate does
  not swap the world twice. A joiner answers `at` as well, hosts started
  with `host.start()` included, so the fake clients in `tests/lib/coop.mjs`
  and the lag dial's scripted player must send it.
- When an `at` arrives and the enemies have changed since that client's
  `world` was sent (a wipe, the boss's death), the host sends it the list
  again.
- Each client's event numbers and the host's ack start again at every
  swap. A room now outlives a run, and the count must not creep toward
  the 65,535 limit `coop.md` lists.
- `join` carries the same world description, so a friend who joins while
  the host is in a dungeon lands in that dungeon, as today.
- The client's swap to the hall must not end co-op, as `enterHub` does
  now. Exit to main menu still ends it.

### Leaving a dungeon

- **The exit gate.** With the boss dead, either player stepping into the
  gate takes both back to the hall, in front of E's gate. There is no win
  screen in co-op: each player sees "OUT ALIVE" and the run's time as a
  message on arrival (the host's clock, so both read the same). The room
  stays open. E is recorded as cleared in each player's own save when the
  boss dies, as now, but the line "A new gate has opened in the base." is
  not shown in co-op, where D stays sealed.
- **Return to base.** The host's pause and death screens keep the button,
  and it takes both players back to the hall. The friend's screens do not
  show it; the friend's ways out are Rise (on death) and Exit to main
  menu.
- **Exit to main menu** is as now: the friend's leaves the host playing,
  the host's closes the room and the friend is told.
- The next trip through the gate is a fresh cave from a new seed.

### In the hall

- The dummy is a host-owned enemy like any other. An execution on it must
  leave it standing with its health back, as in single player (today the
  host's `exec` sets its health to 0 and `kill` returns early for a
  dummy).
- Plaques can be read but not used during a co-op run (the owner's call).
  Inspect opens a plaque and shows its card exactly as in the solo hall,
  and closes the same way. While it is open no symbols are taken, so no
  code can be entered and nothing unlocks: hidden classes cannot be
  played online, and an unlock that changed this player's class mid-run
  would break that. The other player sees the reader standing at the
  plaque.
- Focus and tool charges refill, there is no minimap and no run timer, as
  in the solo hall. Changing class from the pause screen works as it does
  mid-run.

### The room screen

- The host's Start and the friend's enter button both lead to the hall.
  The friend's button reads "Enter the hall" (or, when the host is already
  in a dungeon, "Enter the dungeon").
- The friend still cannot enter before the host has pressed Start. This
  is kept only because it is how the screen works today.

### A dungeon tuned for two

- **When.** The host counts the players in the room (entered or still on
  the room screen) at the moment it builds a dungeon. Two makes it a
  dungeon for two, for as long as that world lasts, wipes included. One
  makes it today's dungeon, and a friend who joins it mid-run does not
  change it. The count travels in `world` and `join` so a client builds
  its puppets to match.
- **The table.** One constant (in `06c`, beside `COOP`) holds: extra
  enemies per pack (1), per pack in the deepest rooms (2), the health and
  posture multiplier for regular enemies (1.3), the Warden's health (1.8)
  and posture (1.5) multipliers, attackers per player (2) and the share of
  health the Warden regains (0.25).
- **More enemies.** The host adds the extras to its own spawn list after
  the cave is generated, so the generator, its seeds and t22's hashes are
  untouched; clients already take the enemy list from the host. An extra
  is one more of a type already in that room's pack, drawn from the pack
  by a generator seeded from the cave's seed, and placed near it on
  walkable ground. "Deepest" is the last row of the pack table. Tunnel
  posts and the boss get none. The same seed gives the same extras.
- **Tougher enemies.** Health and posture are scaled for every enemy of
  the dungeon, on the host and on each client's puppets alike, so bars,
  the Warden's half-health phase change and the snapshot's posture
  fraction all read the scaled values. The dummy is never scaled.
- **Attack turns.** Among regular enemies, at most two may hold an attack
  turn against the same player. In a dungeon built for one the rule stays
  two in all.
- **A death at the boss.** When a player dies inside the boss's chamber
  while the boss is alive and awake, the boss regains 25% of its full
  health, capped at full. Its phase does not go back. Both players see a
  line saying so. A wipe still resets everything, as now.

### The wire

- New: `world` (host to client), `travel` (host's page to the Worker,
  pid 1 only) and `at` (client to host). `gate` now leads to a `world`
  for the hall, not to `end`. `join` carries the world description and
  the player count. `COOP_V` goes up by one.
- The client's check of a join or a world accepts the hall or grade E and
  refuses anything else as `"bad"`.

## Left to the builder

- How the scaled health and posture reach every reader (a per-dungeon copy
  of each enemy definition is the obvious way; nothing may change `EDEF`
  itself).
- How the co-op hall is told which gates are open, and how the client's
  swap avoids `enterHub`'s co-op exit.
- The exact fields and order of `world`, `travel` and `at`, and which
  existing events count as "about the new world's enemies".
- Where the extras stand within a room, and the wording of the new lines.
- Whether `end` survives for any case. It is not needed by this design.

## Rules that still hold

- The host copy loads in Node and in a Worker; nothing from `07` on may
  run there (`tests/t26-build.mjs`).
- Core reads `NET` only in the places `coop.md` lists. Any new place is
  added to that list in the same commit.
- New per-run state is cleared in `resetRun()`.
- `coop.md` and `zones.md` are updated with the code, and the Known
  problems this fixes or adds are edited there.

## Tests

- `tests/coop-host.mjs`: a room that starts in the hall; `travel` from
  pid 1 and its refusal from pid 2; the epoch and `at` (states and hits
  ignored until it arrives, no snapshots before it); the gate and Return
  to base leading back to the hall; a second trip giving a fresh cave;
  the dummy surviving an execution; the count of players fixing the
  tuning; each of the five changes, and none of them in a dungeon built
  for one.
- `tests/coop-wire.mjs`: the new events.
- `tests/coop-caves.mjs`: the co-op hall's checksum the same in every
  browser.
- `tests/t27.mjs` and `tests/t28.mjs`: a client taken from hall to cave
  and back over the fake link, a dead and a paused player taken along,
  scaled puppets, the friend's missing Return to base, the line at the
  gate, and a plaque that opens and shows its card in a co-op hall but
  takes no code.
- `tests/t29.mjs`: the room screen's new wording and a Worker host that
  starts in the hall.
- `tests/coop-e2e.mjs`: two pages meet in the hall and see each other,
  the host walks through the gate and both are in the same cave, the gate
  brings both back and the room is still open, a second trip.
- Every solo test listed in `CLAUDE.md` for `06_game.js` and the hall
  still passes, and t22's hashes are unchanged.
- The lag dial's `coopSolo` gains what the page tests need: a start in
  the hall, a dungeon built for two, and the page as pid 2. A seed from
  `DF.coopSeed` applies to the first trip only.

## Risks

- Every number in the tuning is a guess until two people have played it.
- The hall's mesh has never been compared across browsers. If it
  differs, `genHub` may be changed so long as the solo hall looks and
  collides the same.
- A swap rebuilds a cave on both pages and in the Worker at once; on a
  slow phone the fade may hold on black for a moment.
