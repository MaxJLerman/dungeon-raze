# Status, history and backlog

## Where the project stands

- A playable combat spike, built in one conversation, tuned by automated tests
  and screenshots only. No human had reported on feel when this was written.
- The owner wants a hack-and-slash with Soulslike and God of War style combat,
  set mostly in cave systems so that little art is needed. The inspirations are
  Solo Leveling, Jujutsu Kaisen, Attack on Titan and Ghostwire Tokyo.
- Names, characters and signature moves from those series are deliberately not
  used. The classes are the generic hunter archetypes with original kits.
- An earlier idea, a shadow-necromancer class that raises killed enemies, was
  dropped by the owner. Do not reintroduce it unless asked.
- The intended next stage is to widen the game with several agents working in
  parallel, once the owner says the combat feels right.
- Touch controls for phones and tablets were added on branch
  `feat/touch-controls`, tested under Chromium device emulation only. No
  phone has been played on yet.
- The game starts in a base of operations: a built hall with six portal frames
  graded E, D, C, B, A and S, and a training dummy. E is always open and
  leads to the cave. D leads to the sewer and opens once E's boss is dead.
  C to S are sealed. Grades carry no difficulty or rewards yet; the owner wants
  enemy difficulty and kill rewards to scale by grade, with S the hardest.
- Controller support was added on branch `feat/controller-support`, tested
  with a faked Gamepad API only. No real pad has been played yet.
- Branch `feat/plaques-enforcer` added three plaques on the hall's left wall,
  an Inspect close-up, input codes that unlock hidden classes, and the first
  hidden class, the Enforcer.
- Branch `feat/sapper` added the second hidden class, the Sapper: a
  sledgehammer, landmines joined by tripwires, and a cave-in that crushes a
  pack and walls off a tunnel for a while.
- Branch `feat/riftwalker` added the third and last plaque class, the
  Riftwalker: paired rift ends that the player, regular enemies and shots
  pass through, and a Drop that sends a pack through the floor and out of
  the roof. No plaque is sealed now.
- Branch `feat/sewer` is the first of three projects for the D gate: the
  sewer zone, its water, and D opening once E's boss is dead. Branch
  `feat/d-enemies` is project 2, built in two batches. Batch 1 added the
  per-type hooks and the rat, the drowned and the brood mother, which fill
  the brood rooms and the tunnels. Batch 2 (`feat/d-enemies-water`) added
  the siren, eel, bloater and drain grabber, the rules for enemies bound to
  water or a wall, a held player state, and their placement: sirens or eels
  in pool rooms, bloaters in pools and gutters, grabbers at grates. Project
  3 is the crocodile boss, built in two parts. Part one (`feat/crocodile`)
  gave Old Sluicejaw its body, numbers and place in the cavern's centre
  pool, in place of the Warden, and its fight cycle: it waits under until
  the player enters the cavern, swims under, surfaces with a warning and
  fights on land, where its death roll drags the player into the water. At
  75%, 50% and 25% of its health no hit takes it past the mark, and
  reaching one breaks off what it is doing. Part two (`feat/crocodile-2`)
  added the rest: at a mark it leaps into the cavern's wall tunnels and
  throws spiked plates from one mouth after another, then drops back into
  the water. Shots hurt it there up to a cap per phase, and a parried plate
  knocks it down onto the ring, staggered. Below half health chunks of the
  cavern's ceiling fall on the dry ring and stay as rubble. Bloaters wash
  down the falls during the fight, and its shadow shows under the light
  shafts while it is under. With the crocodile finished, D is in
  `LIVE_GRADES`: its portal opens in the hall once E's boss is dead, on the
  published page too. A D run has no E type in it. The design is in
  `docs/superpowers/specs/2026-11-19-d-enemies-design.md` for the enemies,
  `docs/superpowers/specs/2026-11-18-sewer-d-gate-design.md` for the sewer
  and `docs/superpowers/specs/2026-11-19-crocodile-boss-design.md` for the
  crocodile.
  It has been checked by tests and screenshots only, never played by hand.
- Branch `feat/coop-cave` added two-player co-op through grade E's cave, the
  first slice of co-op: the host's dungeon runs in a Web Worker in the
  host's page, the friend joins through a small relay (`relay/`) with a
  six-character code, and each page owns its own player. **Play online** on
  the main menu leads to it, for every visitor. The owner
  deployed the relay on 2026-11-25 and `COOP_RELAY` holds its address. It
  has been checked by tests (Node, the page, and two Chromium pages through
  a local relay) and once by two headless Chromium pages on one machine
  through the deployed relay, never by hand or between two machines. More players, the
  hall as a lobby, D, the hidden classes and party rules beyond the minimum
  are later projects (see the spec's Non-goals).
- Branch `feat/main-menu` made the first page a main menu: Play solo, Play
  online, How to play and Controls, with no class picker on it. The class
  is chosen after a Play button, and the pause, death and win screens can
  exit to the main menu. `?coop=1` is no longer read. The design is
  `docs/superpowers/specs/2026-11-25-main-menu-design.md`. Checked by tests
  and screenshots only.
- Branch `feat/coop-invite-link` added sharing a room by link and moved the
  online class choice into the room. A host copies the code or an invite
  link (the page's address with `?room=CODE`) from the room screen or the
  pause screen; the link opens the room screen with the code filled in.
  Play online goes straight to the room screen, each player picks a class
  there once in the room, and a class changed in the room or from the
  pause menu mid-run shows on the other page. No spec was written: the
  detail is in `coop.md`. Checked by tests and screenshots only.
- Branch `feat/coop-lobby` made the hall the co-op lobby. A room the page
  hosts starts in the hall, both players are in it, and the host (pid 1)
  steps into gate E to take both into the cave; they come back to the hall
  together, in front of that gate, when the cave is left. In co-op only E is
  open: D and C to S are sealed whatever the save says. A cave entered by
  two is harder: 1.3 times the health and posture for every enemy, 2.5 and
  1.5 times for the boss, one extra enemy in each room pack (two in the deep
  one), two attack turns against each player instead of two in all, and a
  death in the boss chamber heals the boss a quarter of its health. The
  numbers are `COOP_TWO` in `06c`, and they are guesses until two people
  have played it. The design is
  `docs/superpowers/specs/2026-11-25-coop-lobby-design.md`; the detail is in
  `coop.md`. Checked by tests (Node, the page, and two Chromium pages
  through a local relay) and screenshots only, never by hand or between two
  machines.
- Branch `feat/coop-big-cave` made the cave that a co-op room enters a much
  bigger one. A cave entered by two is 36 rooms on a 6 by 6 grid (16 in the usual
  cave), made by `genWorld` with `big`, and it is drawn in pieces cut and
  chosen by the same code the sewer uses. The dev menu has a button to walk
  it alone. The design is
  `docs/superpowers/specs/2026-11-26-coop-big-cave-design.md`; the detail is
  in `world.md` and `coop.md`. What was measured, on this machine:
  - The cave is 165 to 218 pieces over seeds 1 to 200 and 179,663 to
    210,583 triangles whole (the same seeds).
  - The worst view lists 57,980 triangles and the average is 28,275, over
    22,384 views on six seeds. The worst real frame along the route on three
    seeds draws 28,073. The limit is 81,835, the whole of small cave 99.
  - Building it takes 679 to 708 ms in the page (headless Chromium). The host
    copy skips working out what each piece sees and takes about 60 to 120 ms in
    Node.
  - Enemies for two on seeds 1 to 20 and 99: 155 to 199, mean 178, and 188 for
    seed 99 (155 to 216 over seeds 1 to 300; seed 103 has 216). The design
    first expected 150 to 190; seeds 5 (193), 8 (191) and 18
    (199) run above it. Nothing was tuned.
  - The largest join message is 6,233 bytes against the relay's 16,384. A host
    step in the big cave costs 0.35 ms on average.
  - Every route is 10 to 12 rooms with four rest points.
  - Not checked by hand: nobody has played it with two players at all, the
    length of a run for two is unknown, and the build time on a real phone is
    unmeasured. `COOP_TWO` is unchanged.
- Branch `feat/coop-warden-two` made the Warden of a cave for two a harder
  fight. The design is `docs/superpowers/specs/2026-11-26-coop-warden-for-two-design.md`;
  the detail is in `coop.md` (the Warden for two), `enemies.md`, `rendering.md`
  and `dev-menu.md`. A Warden of a cave for one, and the solo one, are
  untouched. For two it has:
  - 1,550 health (`WARDEN2.hp`, 2.5 times the solo 620) and 210 posture,
    and four phases, at 75%, 50% and 25% of its health, each with a roar
    (phase 4's lasts 2.2 s) and a line; the boss bar draws a notch at each
    mark. The heal of a quarter of its health on a death in its chamber is
    unchanged. To tune the Warden's health for two, edit `WARDEN2.hp`;
    `COOP_TWO.bossHp` (also 2.5) scales any other boss of a world for two
    and does not reach the Warden.
  - Phase 1: it turns on whoever has hurt it most lately (a damage score per
    player that halves every 4 s), not on the nearest.
  - Phase 2: today's second phase, and an aftershock ring after every slam.
  - Phase 3: a grab that the other player breaks. The held player can
    struggle free only when no mate can help (dead, away or outside the
    chamber).
  - Phase 4: a ring of 24 heaps of rock closes the chamber, so nobody can
    leave it, a player who dies gets up at the door inside the ring, and the
    chamber goes dark. The seal lifts when the Warden dies or the party is
    wiped.
  - The dev menu's "Warden for two" row is how to see it alone: Fight, then
    Phase 2, 3 or 4.
  - Every number of `WARDEN2` (`src/06b_ebeh.js`), all first guesses:
    - `hp` 2.5, `marks` 0.75, 0.5 and 0.25, `roar` `{ 4: 2.2 }`.
    - `heed` (attention): `half` 4 s, `lead` 1.3, `every` 3 s.
    - `wave` (the aftershock): `from` phase 2, `wait` 0.35 s, `speed` 11 m/s,
      `reach` 24 m, `band` 1.2 m, `dmg` 14.
    - `seize` (the grab): `from` phase 3, `trig` 5 m, `wind` 0.9 s, `act`
      0.25 s, `rec` 0.9 s, `reach` 4.6 m, `arc` 1.2, `again` 14 s, `hold`
      4 s, `dps` 6, `breakAt` 80 damage from the other player, `stag` 2 s,
      `crush` 40, `toss` 6 m, `slack` 2 m, `late` 0.6 s, `front` 1.6 m,
      `pull` 8 m/s, `unseen` 0.5 s (the host lets go of a player it has
      never seen held), and the line "Break its grip!". The seize's real
      wind-up is about 0.77 s: from phase 2 on the tempo of 0.85 applies.
    - `seal`: `n` 24 capsules, `ring` 12.5 m, `rock` 1.4 m, `warn` 1.4 s,
      `sweep` 0.6 s, `door` 2 m, `fade` 0.4 s.
    - `dark`: `floor` 0.12 (the crystals), `amb` 0.12 (the cave's ambient
      light), `lamp` 0.25 (the player's lamp), `over` 2 s.
  - What was measured, on this machine, on the final build:
    - The largest join in a sealed fight is 6,252 bytes (big cave 18, 199
      enemies; big cave 99 with 188 enemies is 5,931) against the relay's
      16,384. The last branch's record has 6,233 for the same seed.
      Over seeds 1 to 20 and 99 the largest frame of any other kind
      in 20 s of the sealed fight (snapshots and events, two players in the
      chamber) is 272 bytes.
    - The mean cost of a host step in phase 4, the seal down and two
      players standing in the chamber: 0.31 ms (0.26 to 0.36 ms over seeds 1,
      5, 18 and 99, 30 s each; the worst single step 1.7 ms). The same
      players in phase 1 cost 0.31 ms (0.26 to 0.33), so the fight adds
      nothing measurable. The big cave's mean was 0.35 ms before.
    - The worst sealed frame draws 21,463 triangles (cave 5, 8 m from the
      centre), over 240 frames from the centre, the door and 12 spots 4,
      8 and 11 m out, four ways each, on seeds 1, 5, 7, 13, 18 and 99. The
      limit is 81,835, the whole of small cave 99. `tests/t32.mjs`'s own
      frames, on cave 99, peak at 11,598.
    - The dark: the spec said the crystals dim to 12%. Measured, that moved
      the frame by 2 to 4%, so the cave's ambient light and the player's lamp
      are dimmed too (`dark.amb`, `dark.lamp`); the sealed frame is then 57%
      of the one before the seal and the Warden's wind-up keeps its
      brightest tenth at 70% or more (`rendering.md`).
  - Not checked by hand, and what the owner should know:
    - Nobody has played this with two people. Every number above is a first
      guess. The feel of all four phases, the fight's length and whether the
      grab works at high ping are unknown.
    - Whether the dark is too dark, or hides wind-ups in play, is the
      owner's to judge. Screenshots show the Warden's raised arms and its red
      glow reading at 8 to 9 m, and the player's own dark body reading
      mostly by its rim and the lamp.
    - Breaking the Warden's hold staggers it, and a stagger fills its
      posture, so a pair that frees each other opens an execution on it about
      every 14 s (the seize's `again`). This is a balance effect nobody has
      judged.
    - The crush's throw carries the held player toward the chamber's centre
      and can carry them through the Warden (`coop.md`, known problems).
    - While the seal stands, a wipe counts a player who has gone quiet (a
      stalled tab, or a friend who has joined but is still on the room
      screen) by its last state. The host never drops a silent player by
      itself, so this lasts until that player comes back or their socket
      closes, and meanwhile the other keeps getting up at the door with the
      Warden healing each time. A closed socket is a `leave`, and a player
      who has left is not counted, so one player dead and the other's
      socket closed is still a wipe.
    - On the iPhone SE the boss bar sits over the Warden's head and raised
      arms at fighting distance (`shots/iphone-se-t32-dark.png`). That is older
      than the dark but matters more in it.
    - When the seal lands, any enemy inside the chamber's reach but not
      inside the ring is moved in, the Warden included.
  - The sweep of the whole test table before the whole-branch review: 39
    scripts, 43 runs with the device variants. Only `touch-all` t14 and t29 `title` on
    four short phones failed, both known (backlog 11).
- Branch `feat/gate-confirm` made an open gate in the hall ask before the
  trip, so a player who walked in by accident can back out. The design is
  `docs/superpowers/specs/2026-11-27-gate-confirm-design.md`; the detail is
  in `zones.md` (A gate asks first, The gate's question) and `coop.md`.
  - "Enter gate E?" with Enter and Stay out, on a screen in the middle of
    the view. Stay out throws the player out of the arch with a free
    dodge, the camera left alone. The exit gate over a dead boss asks
    nothing.
  - In co-op only the host's page is asked. The friend is told "Only the
    host can open a gate." as before.
  - Not checked by hand: nobody has seen the throw, used the screen with a
    real mouse lock, a real pad or a real phone, or tried it in Firefox or
    Safari. Whether the mouse comes back where play took it (which the
    screen's place in the middle answers) was reasoned from the browser's
    rules, not seen.
  - Left from the review, all small: a phone turned upright under the
    question can be put into play under the rotate screen by Back or a
    pad's B; on Android in fullscreen the first Back likely only leaves
    fullscreen; a player who binds dodge or attack to Enter answers with
    it; no test ends co-op or dies under the question.

## Backlog, roughly in the order discussed

1. Tune feel from the owner's playtest: timing windows, sensitivity, difficulty.
2. Give the portal grades meaning: enemy difficulty and kill rewards per
   grade, then open D to S. D's place and water are built (`feat/sewer`) and
   so are its enemies (`feat/d-enemies`, `feat/d-enemies-water`) and the
   crocodile boss (`feat/crocodile`, `feat/crocodile-2`), and D is in
   `LIVE_GRADES`. C is next. Revisit whether dying should send the player back
   to the base once there are rewards to lose.
3. Loot, inventory and an extraction loop. The owner asked for these early on
   and they were set aside to get combat playable first.
4. More enemy variety and a second boss.
5. A harsher surface area or city zone, if the owner wants to leave the caves.
6. Split the work into lanes for parallel agents: combat and camera, enemies,
   world generation, loot and progression, rendering and effects, HUD, touch
   layout, touch input, tests.
   Agree shared data shapes (`CLASSES`, `MOVES`, `EDEF`) before fanning out.
7. A jump. The owner first asked for it on Space and A or Cross, with dodge
   on B. Dodge has since gone back to Space and Interact to G, so the
   keyboard key for a jump needs asking again (not Ctrl: Ctrl+W closes the
   tab). On a pad, near a plaque the same button inspects instead. What the
   jump is for in a fight (movement, clearing slam shockwaves, jump attacks,
   invulnerability) is undecided; ask the owner before building it. The floor is flat, so there is nothing to
   jump onto. A touch Jump button must fit the owner's honeycomb layout.
8. Hidden classes and joke classes. See `docs/ideas/joke-classes.md`. All
   three plaque classes are built. Still to come: the joke classes, quests on
   the plaques that open portals D to S to a class, and the in-game hunt that
   leads players to the hidden list of codes.
9. What remains of the bigger cave for two (`feat/coop-big-cave`, recorded
   above): retune `COOP_TWO` and the pack table once two people have played
   it. Their numbers are guesses.
10. What remains of the Warden for two (`feat/coop-warden-two`, recorded
    above): tune `WARDEN2` and the heal after a playtest with two people.
    The first things to judge are the fight's length, the dark, the grab's
    stagger loop and the grab at high ping. The wipe rule for an away player
    while the seal stands and the crush's throw through the Warden are known
    problems in `coop.md`.
11. Two phone test failures older than the co-op lobby: `tests/t14.mjs` on
    every device and `tests/t29.mjs` on four short phones. See the known
    problems in `touch.md` and `coop.md`. Causes not investigated.
12. A flaky host check older than the co-op lobby: "nothing on the host
    hurts or moves a proxy" in `tests/coop-host.mjs` fails now and then (2 runs in
    400 on an idle machine, 1 run of 13 during the final review of the big
    cave, so the rate is not known). See the known problems in `coop.md`. Cause not investigated.
    A second flaky check, "rubble never traps it" in `tests/t25.mjs`, fails
    now and then and passes on a rerun. See the known problems in
    `crocodile.md`. Cause not investigated.
13. `ASK.exec` on the host kills any pinned enemy outright, the Warden for
    two included. It is older than `feat/coop-warden-two`, but breaking the
    Warden's hold now gives a stagger, and so an execution, on demand.
