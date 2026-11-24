# Co-op, first slice: two players through the cave over the internet

## Intent

The owner wants to play DungeonRaze with friends over the internet in closed
lobbies. This is the first playable piece of that: the owner and one friend,
each in their own browser, anywhere, play a whole grade E run together, from
arrival to the Warden's death, joined by a room code.

It is deliberately a narrow slice built end to end, before the game is
widened for parties. The lag rig (branch `spike/lag-rig`, a throwaway)
answered whether combat still feels right when enemies arrive late: the owner
played it at up to 300 ms and said dodge, parry and block feel the same as
single player. What nobody has tested is a real network: a real relay's lag,
a host whose tab goes to the background, a phone. Only real sessions answer
those, so the slice gets to a real session as early as it can.

Background, with sources: `reports/Multiplayer and engine options.md`, above
all its "Gate 1 result" section and "Host owns the world, each player owns
themselves".

## Goals

- Two players complete a grade E run together over the internet: packs, rest
  points, the Warden, the exit gate.
- A player's own combat feels as it did on the rig: hits on them are judged
  on their machine against what it drew, and their own hits show at once.
- Joining is a six-character code. No accounts, no installs.
- Single-player play is unchanged, and so is every existing test.
- The slice produces answers about real networks (see "What the first
  sessions must tell us").

## Non-goals (later projects, in the order the owner chose)

- More than two players. The wire format and host carry a list of players,
  but only two are allowed, tested and tuned.
- The hall as a lobby, grade D, the sewer's enemies and the crocodile.
- The hidden classes (Enforcer, Sapper, Riftwalker): their tools change the
  world or move enemies directly. Co-op offers the five base classes.
- Party rules beyond the minimum below: downed and revive, scaling enemy
  health or rewards by party size, shared loot.
- Direct (WebRTC) connections, a dedicated server, host migration.
- Strangers, matchmaking, chat, player names, Steam.
- Cheat resistance. A friend's machine is trusted about its own player.

## Anti-goals

- Single player changing in feel, saved data or size of download beyond what
  is stated here.
- A friend's page running a different cave or a different enemy list from
  the host's without anyone being told.
- The dungeon silently freezing. If the host stops, the friend is told.
- Anything personal stored or logged by the relay.

## Constraints

- The game is dependency-free JavaScript, every `src/*.js` file concatenated
  into one function scope by `build.mjs` (see `CLAUDE.md`). That stays. The
  conversion to modules in the report's phase A1 is not part of this.
- Co-op must work in the published copy, which is built with `--release`, so
  none of it may live in `src/dev/`. `src/dev/` may read it; core may still
  name nothing declared in `src/dev/`.
- `CLAUDE.md` says "no network requests at run time except Google Fonts".
  This design adds one exception: a WebSocket to the relay, opened only when
  a player chooses to host or join. Nothing is contacted otherwise.
- The game is also published as a single hosted HTML page whose content
  policy blocks outside connections. Co-op cannot work there. It must fail
  with a message that names the GitHub Pages address, not with an error.
- Pointer lock, fullscreen and audio rules are unchanged: starting a co-op
  run goes through `play()` from a click or key handler.
- **Never commit a plain plaque code**, as before. Co-op does not touch codes.

## Approaches

The owner chose the order of work in conversation, from three:

1. **Two players in the cave over the internet first (picked).** Real-network
   problems show up early and a friend can play soon. Some code is reworked
   when the game is widened.
2. The report's order: rebuild the foundations for everything (modules,
   effects through one channel, several players, full wire format), then
   rooms. Less rework; the first session with a friend comes after all of it.
3. Keep extending the rig locally to cover grabs, bosses and tools under fake
   lag. Thorough on feel; nothing playable with a friend.

How it is built was left to the assistant. Two shapes were considered:

- **A. Everyone is a client, and the host's browser also runs a headless
  copy of the simulation (picked).** This is exactly what the rig was, and
  what the owner approved by playing. The host player and the friend run the
  same client code, so there is one combat path to keep right. Hit-stop,
  slow motion and pause stay local to each player with no extra work,
  because the headless copy never stops. The headless copy can run in a Web
  Worker, which may keep the dungeon running when the host's tab is in the
  background, and later it can move to a server unchanged. Costs: the host's
  machine builds the cave twice and the page carries a second copy of the
  simulation source (about 0.5 MB before compression, measured on the rig);
  the host player also sees enemies 100 ms late, as the friend does.
- **B. The host's own game is the authority and the friend's is a viewer.**
  The host plays the untouched single-player game with no delay. But the
  host's hit-stop and slow motion would freeze or slow the world for the
  friend unless they are rebuilt as drawing-only effects, the host's pause
  would stop the dungeon, there are two combat paths (host and client), and
  the host player's feel under those changes is untested. Rejected.

## Design

### The pieces

```
 host's browser                                   friend's browser
 +------------------+     +-----------------+
 | page: client     |<--->| Worker: host    |<==== relay ====>| page: client |
 | (owner plays)    | msg | sim, no screen  |   WebSocket     | (friend)     |
 +------------------+     +-----------------+                 +--------------+
```

- **Host sim.** A second copy of the simulation files (`01` to `06b`, plus
  the co-op files that sort with them), with no local player and no screen.
  It owns the world's dynamic state: every enemy, enemy shots at the moment
  they are fired, who is in the room, kills, the boss's death, resets. It
  steps at 60 a second on its own timer.
- **Client.** The normal page. It owns its own player completely: movement,
  stamina, health, flasks, focus, tool charges, rest points, death. Enemies
  on it are puppets drawn from the host's snapshots. It never runs enemy AI
  while in a co-op run.
- **Links.** One small interface (`send(bytes or text)`, `onmessage`,
  `onclose`) with three implementations: messages between the host's page
  and its Worker; a WebSocket through the relay; and a fake link with
  adjustable delay, jitter and loss for tests and the dev build.
- **Relay.** A small Cloudflare Worker with one Durable Object per room. It
  forwards frames and knows nothing about the game.

The host sim must also run without a Worker, stepped by hand on the main
thread, as on the rig. Tests and the dev lag dial use it that way. The same
host source is what the Worker loads (from a Blob URL built from the string
`build.mjs` embeds; there is still one HTML file and no second download).

If a Worker cannot be created, hosting is refused with a message. Joining
does not need one.

### The seam in the core

As on the rig: `let NET = null` beside `DEV` in `06_game.js`, and a handful
of `NET && ...` checks. `NET` is set only for the length of a co-op run, so
with it null the game is byte-for-byte the single-player game in behaviour.
The rig's seams are the starting list, not a limit: the enemy loop in
`update`, `hitEnemy` (the `o.pre` guard and the proposal hook), `hurtPlayer`
(`remote`), `shoot`, `kill`, `respawn`, the frame loop and drawing other
players in `render`. `DEV.noSave()` keeps its meaning in a co-op run.

### Host sim: no local player

The single-player code reads `G.player` everywhere. On the host there is no
local player. Each connected player is a **proxy**: a player object made by
`makePlayer` and flagged `remote`, never updated by `playerUpdate`, only
moved to where its own machine last said it was (position, facing, velocity,
state, sprint, health).

- `G.player` on the host is a placeholder that is dead and far away, so any
  code that reads it outside an enemy's step finds nobody.
- For each enemy's step the host points `G.player`, and the per-player flags
  the step reads (`G.inBoss` at least), at that enemy's target, then puts
  them back. This is the rig's swap, kept on purpose: it leaves the 5,700
  lines of single-player code and its tests alone. Passing the target through
  every function is the widening project's job, not this one's.
- `hurtPlayer` on the host returns at once for a proxy. Nothing on the host
  ever damages, holds or pushes a player.
- **Targeting (the assistant's call):** an enemy hunts the nearest living
  proxy and keeps it unless the other is 3 m nearer; a hit from a player it
  can see makes that player its target. With no living player in reach its
  target is the placeholder, which the existing code treats as a dead player:
  it gives up and walks home, and the Warden returns and heals as it does
  now.
- **Attack tokens** stay global: at most two regular enemies attack at once
  across both players. Tokens per target are for the widening project.
- **Boss chamber:** "the player is in the boss chamber" is worked out per
  proxy. A regular enemy gives up when its own target is in the chamber.
- Enemy shots on the host never hit a proxy. They are flown on each client.
- The host steps even when a player's menu is open. It stops only when no
  client is connected.

### What crosses the link

Starting from the rig's format (binary through `DataView` for the frequent
messages, JSON for the rare ones):

- **Host to each client, 20 a second: a snapshot.** Host time, the highest
  event number of that client's it has processed, the other player's record
  (position, facing, state, move, time in state, health, guard, sprint), and
  one 19-byte record per enemy that is awake, dying, or within 45 m of that
  client. Measured on the rig's format: 5 to 12 kB/s at the most crowded
  spots of four dungeons, so no delta encoding yet.
- **Client to host, 30 a second: its player's state** (12 bytes on the rig;
  add what the other player's drawing needs).
- **Client to host, numbered events:** a proposed hit (enemy, final damage,
  posture, flags, source, where from, the enemy state and attack number the
  client saw), a parry, an execution begun, an execution finished, a
  respawn, a shot fired or blast set off by this player (for the other
  player's eyes only).
- **Host to client events:** the join message (below), an enemy shot fired
  (start, velocity, damage, host time), a slam's warning ring, a roar's push,
  a kill (enemy, whose kill), the boss's death, enemies reset, the other
  player's shots and blasts, the other player joining or leaving, the run
  ending.

Everything travels over the WebSocket, which is reliable and ordered, so the
rig's separate handling of lost packets is not needed on the real link. The
fake link keeps delay, jitter and loss so that a stall on a real connection
can be imitated.

### Joining, and the same cave on both machines

Chrome's and Safari's JavaScript engines built seven dungeons with identical
meshes and enemy lists in order, but a few spawn points differed by about
1e-14 m. So a client builds the cave from the seed itself, and takes the
enemies from the host:

- The join message carries the seed and grade, a checksum of the cave's mesh
  as the host built it, the enemy list (id, type, position, facing), which
  ids are dead, whether the boss is dead, and the other player's class.
- The client builds the cave, compares the checksum, and makes its puppets
  from the host's list, never from its own spawn list. If the checksum
  differs it leaves the room and says that this browser built a different
  cave and co-op cannot run here.
- The check is run across engines before anything else is built on it:
  many seeds in Chrome's, Safari's and Firefox's engines. A browser whose
  cave differs is refused with the message above in this slice; sending the
  cave itself from the host is not in scope.
- Enemy ids are the host's. Enemies created later than the start (none in
  grade E) would be announced by an event; the format should allow it.
- The friend may join before the run starts or at any time during it, and
  arrives at the cave's start either way. Rejoining after a drop is the same
  as joining.

### Client: enemies as puppets, hits judged locally

As proven on the rig; `src/dev/20_net.js` on `spike/lag-rig` is the worked
example and may be read, but none of it is carried over as it stands.

- **Drawing.** Each puppet is drawn 100 ms behind the client's estimate of
  host time, between the snapshot before that moment and the one after.
  State and time-in-state come from the earlier snapshot and are carried
  forward locally on the attack table's timings, so a wind-up turns into its
  swing on the exact frame. Sounds for telegraphs, swings, staggers and
  alerts are made locally from those transitions.
- **Clock.** Host time is estimated as local time plus the largest offset
  seen in any snapshot of the last 0.6 s. It must be able to fall back when
  the connection slows; an estimate that only rose made every enemy step at
  20 a second on the rig. The drawn time moves on simulation time (so it
  stops for hit-stop and slows for slow motion) and catches up at a bounded
  rate.
- **Hits on this player** are tested on the client against the drawn puppet
  with the same shapes `enemyUpdate` uses, then go through the unchanged
  `hurtPlayer`. A parry throws the puppet back locally and tells the host,
  which adds the posture and recoils or staggers its enemy.
- **Enemy shots** are created on each client from the host's event and flown
  there. A shot that reaches the other player's drawn body disappears. A
  parried shot becomes the client's own.
- **This player's hits** show at once (flash, sparks, sound, hit-stop,
  focus, a guessed flinch, stagger or death) and are proposed to the host.
  A puppet holds its guessed state until a snapshot shows the host has
  processed that event. The host applies the proposal with the damage as
  sent. **The owner's choices from the rig:** an enemy the client saw outside
  its swing and flinched stays flinched even if its swing had begun on the
  host; slow motion on a perfect dodge or parry stays.
- **Executions.** Starting one tells the host, which keeps that enemy
  staggered for the first player to ask and marks it taken so the other
  player's prompt skips it. Finishing one tells the host to kill it. If both
  start inside the lag window both animations play, the first to finish
  kills, and the other gets nothing. That is accepted for the slice.
- **The Warden.** Its slam's warning ring and its roar's push arrive as
  events and are applied locally. The boss bar reads the puppet. Its guessed
  state is never predicted from the client's hits (it has poise 2), only its
  health.
- **Known and accepted:** an enemy knocked back by this player's hit moves
  after the round trip, not at once.

### The other player on screen

Drawn from its record with the same interpolation, posed by `posePlayer`,
with a blob shadow and a small marker over its head. Its swings show slash
trails made locally from its move and timing. Its shots and blasts are drawn
from events and hurt nothing on this client. An enemy's health falling
without a hit of this player's shows a flash and a quieter hit sound. No
name is shown; the marker is the class's colour.

### Party rules for the slice (the assistant's calls; the owner may change any)

- **Start.** Both players arrive at the cave's start. The host chooses when
  to start; the seed is random.
- **Death.** A dead player gets the usual screen. Respawning puts them at
  their own last-lit rest point with the usual refill. One death does not
  reset the enemies. While a player is dead the enemies hunt the other.
- **Wipe.** If both are dead at the same time, the host resets the enemies
  as a single-player respawn does (a dead boss stays dead).
- **Rest points** are each player's own: lighting one makes it that player's
  checkpoint and refills that player.
- **Kill rewards** (focus, the chance of a tool charge, the kill count) go
  to the player whose hit killed.
- **The boss.** Its death clears grade E for both players, each under their
  own class in their own save, unless that client's `DEV.noSave()` is true.
  The exit gate appears for both.
- **The end.** When either player steps into the gate the run ends for both
  and both see the win screen. The room then closes; another run is a new
  code. Making that smoother belongs to the party-flow project.
- **Pause** does not stop the dungeon. The pause screen says so in a co-op
  run. In a co-op run the client keeps simulating under the pause screen, so
  a paused player stands where they were and can be hit.
- **Away.** A page that is hidden or frozen (a background tab, a locked
  phone) stops simulating, so nothing can judge hits on its player. The host
  treats a player it has heard no state from for 2 s as away: enemies stop
  hunting them and they do not count as alive for the wipe. They are drawn
  faded on the other screen, and resume where they stood, with nothing said,
  when their page runs again. This applies to the host's own page too, whose
  Worker may keep the dungeon running while the page is hidden. The client's
  simulation is not moved off the frame loop, and the host never judges a
  hit on a player: both would break what approach A was picked for.
- **Leaving.** If the friend leaves, the host plays on. If the host leaves
  or cannot be heard for 10 s, the friend is told the host has gone and
  returns to the title. When snapshots stop for more than a second the
  friend sees "Waiting for the host" over the game until they resume.

### Screens

A **Play with a friend** button on the title screen opens a screen with
**Host a room** and **Join with a code** (a six-character field). Hosting
shows the code, large, with a copy button, the two player slots with their
classes, and **Start** once the friend is in (the host may also start alone
and be joined later). Joining shows the same slots and waits for the host.
The class is the one chosen on the title screen; a hidden class falls back
to the first base class for the run without changing the save. Errors are
plain sentences: no such room, room full, cannot reach the relay, this copy
of the game cannot play co-op (with the GitHub Pages address).

The screen follows the rules for menus in `CLAUDE.md` (`SCREENS`, `MENUS`,
pad focus, touch sizes). During a run, the HUD gains one thing: the other
player's health as a thin bar under the player's own vitals.

**The button is hidden unless the address has `?coop=1`** (the assistant's
call), so the published page shows nothing new to passers-by until the owner
says co-op is ready. The owner sends a friend the link with it.

### Relay

- `relay/` in this repository: one Worker script and its `wrangler` config.
  It is not part of the page build.
- `POST /new` returns an unused room code: six characters from an alphabet
  without look-alikes (no 0, O, 1, I, L). `GET /room/CODE` upgrades to a
  WebSocket; the first socket in is the host.
- It forwards frames between the host and the friend and adds nothing but a
  one-byte sender or addressee. A join or leave is told to the other side.
- Limits: two sockets a room, a cap on message size and on messages a
  second, a room dropped ten minutes after its last socket closes, and only
  the published page's origin and `localhost` accepted.
- It stores nothing and logs nothing about players.
- **The owner deploys it**, on their own free Cloudflare account, with
  `npx wrangler deploy` after a login only they can do. Its address goes in
  one constant in the source. Whether the free plan's limits cover an
  evening of play has to be checked against Cloudflare's current pricing
  when the plan is written; the report's estimate is that friends-scale use
  costs nothing.

### Build

- `build.mjs` embeds the host source as a string in every build, release
  included, as it does on the rig for local builds.
- The co-op files that the host sim needs must sort into the range of files
  the host is built from; client-only co-op code (puppets, the room screen)
  sorts with the presentation files.
- `tests/t26-build.mjs` keeps checking that a release build carries no dev
  code, and additionally that it carries co-op.
- The dev build adds, in `src/dev/`, the lag dial the rig had: a way to
  start a co-op run alone over the fake link with sliders for ping, jitter
  and loss, and an optional scripted second player. It is the tool for
  checking feel on later work (grabs, the sewer).

### Tests

- **The existing suite passes unchanged**, including the cave hashes in t22.
- **Host tests in Node**: the host source with two scripted fake clients
  (objects that send state and events; no screen). Targeting and its
  hysteresis, a hit switching target, proposals applied, the flinch rule
  that favours the attacker, parry posture, the execution race, kill credit,
  the per-player boss-chamber rule, wipe and reset, joining mid-run, a
  client vanishing. Minutes of play run in milliseconds.
- **Client tests in the page** (`test.mjs smoke`, stepped with `DF.sim`):
  the real client against a hand-stepped host over the fake link at 200 ms
  with jitter and loss. The rig's checks carry over as the starting set
  (a swing hurts, guard blocks, a late guard parries and the host's enemy is
  thrown back, hits kill on the host, raising the ping in play leaves every
  puppet between two snapshots), plus the Warden's slam and roar, death and
  respawn without a reset, the cave checksum refusing a wrong cave, and the
  other player drawn where the host says.
- **End to end**: two pages and the relay running locally: make a room, join
  by code, start, each sees the other move, the friend leaves and rejoins,
  the host leaves and the friend is told. One step hides the host's page and
  measures whether the dungeon keeps stepping.
- **Screenshots** of the room screen and of a fight with the other player in
  view, looked at by eye, on the desktop page and one phone layout.
- **By hand**: the owner and a friend on real connections.

### What the first sessions must tell us

1. Does combat still feel right at the relay's real lag, and what is that lag?
2. Does the dungeon keep running when the host's tab is in the background,
   in Chrome, Safari and Firefox? (Unverified. If it does not, the friend
   sees "Waiting for the host", and a server-run host becomes the next step.)
3. Does a WebSocket's stall under packet loss show as hitching? (If so,
   direct connections move up the list.)
4. Does a phone work as the friend's device?
5. Is two attackers at once across two players too easy?

**Devices for the first session (the assistant's assumption; the owner was
asked and did not say):** both players on a desktop browser, Chrome or
Safari. The cross-engine cave check still comes first because it is cheap.
The phone layout of the room screen and the per-browser background check
come after the first session, not before it.

## Left to the builder

- File names and how the co-op code is split, within the build rule above.
- The exact byte layouts, as long as snapshot size stays near the rig's.
- How the relay is run locally for the end-to-end test (`wrangler dev` or
  otherwise). The page itself must stay dependency-free.
- The room screen's layout and wording, within the game's existing style.
- Sanity limits on what the host accepts from a client (an enemy that
  exists, a damage ceiling). They are for robustness, not cheat resistance.
- The order of work, provided the first friend session is not held back by
  polish. A sensible order: host sim with no local player and its Node
  tests; client over the fake link to the rig's standard, with the Warden;
  relay, room screen and end-to-end; then the session.

## Calls the assistant made that the owner should check

1. Everyone is a client, with the host sim in a Worker (approach A).
2. Co-op offers only the five base classes for now.
3. The party rules above, above all: one death resets nothing, both dead
   resets the enemies, and the room closes at the end of a run.
4. Pause does not stop the dungeon.
5. The button is hidden behind `?coop=1` until the owner says otherwise.
6. The relay runs on the owner's Cloudflare account, and the page may open
   that one connection.
7. Two players only; three to five wait for the widening project.
8. A player whose page is hidden is ignored by enemies until they return.
9. A browser that builds a different cave from the host's is refused, not
   repaired.
