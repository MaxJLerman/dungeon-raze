# The D-rank gate: the seven enemies

Design agreed with the owner on 2026-11-19. This is project 2 of the D gate.
The sewer itself is in `2026-11-18-sewer-d-gate-design.md`, whose "Later
projects" section is the outline this document fills in. Read `CLAUDE.md`
first for the conventions (axes, the field, water, zones, enemies, tests).

## Why

The portal grades are a ladder and D is the first step up. The owner wants
D harder through enemies that need strategy, not through bigger numbers,
and wants none of E's enemies in D. The sewer is built and its water slows
the player; these seven enemies are what make water and position matter in
a fight. Each one asks the player a different question: where to stand,
when to strike, what to kill first.

## Goals

1. Seven enemy types, each with its own body, behaviour and counter: rat,
   drowned, brood mother, siren, eel, bloater and drain grabber.
2. They fill the sewer by room kind, so that once both batches are in, no
   E type spawns in D. The only E enemy left is the Warden in the cavern,
   until project 3.
3. A grab that the siren and the drain grabber share: the player is held and
   breaks free by mashing dodge.
4. E's cave plays exactly as before. Its enemies, its tests and its
   generator's output do not change.

## Non-goals

- The crocodile boss (project 3). The Warden stays in the cavern meanwhile.
- Opening D on the published page. D stays out of `LIVE_GRADES` until the
  crocodile lands (decided by the owner on 2026-11-19, replacing the older
  note that D opens when this project lands).
- The dev options menu on the owner's TODO. It comes later; the owner chose
  to build the enemies first.
- Scaling health or damage by grade, levels, loot or rewards.
- Changes to the classes, controls or touch layout. Being grabbed uses the
  dodge input every device already has.

## Anti-goals

- **E's enemies in D.** After batch 2, a D run spawns no husk, brute or
  spitter anywhere.
- **An enemy the player cannot reach.** Every water-bound enemy can be
  killed from dry floor at its pool's edge or by wading in. A siren that
  hides in the middle of a pool for good, or an eel that can only be hit
  from the water while it shocks, has failed.
- **Being held to death.** A grab must never chain into another grab with no
  chance to act, and two enemies must never hold the player at once.
- **Free farming.** The brood mother must not become an endless source of
  focus and tool charges.
- **A change to E.** If any E enemy moves, hits or decides differently, or
  `genWorld`'s hashes change, the work has failed even if D works.

## Constraints

- Everything in `CLAUDE.md`'s rules of the build: concatenated `src/*.js` in
  one scope (declare each name once), no dependencies, nothing loaded from
  other sites, `node build.mjs` after every change.
- Water is read only through `world.waterAt` and `world.bodyAt`. No reader
  tests whether the world is the sewer.
- Every new way of moving an enemy goes through `eStep`, so `wade` applies.
- Every new way of hitting or targeting an enemy skips a falling enemy and
  respects the dummy, as `CLAUDE.md` lists.
- All damage to enemies goes through `hitEnemy`, all damage to the player
  through `hurtPlayer`.
- Shared enemy rules stay shared: at most two attack at once (`takeToken`),
  sight and search, packs, leash and giving up, and the boss-chamber rule.
- A push to `main` publishes. D stays sealed there, so tests make D live
  through `DF.LIVE_GRADES`, as `t22` does.

## Approaches

The question was where the new behaviour lives. `enemyUpdate` (about 500
lines of a 5,000-line `06_game.js`) assumes every enemy walks after the
player on dry floor; the siren and eel never leave water, the grabber is
fixed in a wall and the drowned changes how hits land.

- **A. Branches in `enemyUpdate`.** New attack kinds and flags in `EDEF`,
  branches in the existing states. Fastest to start, but `06_game.js` grows
  by perhaps 1,500 lines and every state gains checks that E's enemies run
  through.
- **B. Behaviour hooks in a new file (chosen).** `EDEF` keeps each type's
  numbers. A new source file holds per-type behaviour, called from a few
  fixed points in `enemyUpdate`, `hitEnemy` and `kill`. A type with no hooks
  runs exactly as now. New bodies get their own figures file. The grab is one
  new player state, `held`.
- **C. A separate update loop for D creatures.** Most freedom, but it copies
  the shared rules above, the copies drift, and the crocodile would face the
  same choice again.

The owner chose B: the crocodile will reuse the hooks and `held`, and E stays
exactly as played.

## The design

### Two batches

One design, two build plans, each on its own branch and merged before the
next starts (*builder's call, agreed with the owner*):

1. **Batch 1, dry land:** the hooks, the rat, the drowned and the brood
   mother. The brood mother sends out rats, so the rat comes first. Brood
   rooms and tunnel posts get their real enemies.
2. **Batch 2, water:** the `held` state, the siren, the eel, the bloater and
   the drain grabber. Pool rooms and tunnel walls get theirs.

The plan for batch 1 is written first. Its hooks must already have room for
what batch 2 needs (the footing rule and starting `held`), so batch 2 adds
entries and does not reshape the hooks. Batch 2's plan is written after
batch 1 merges (*builder's call*).

Between the batches, pool rooms still spawn E's stand-ins. D is sealed, so
that is seen only in tests and a D opened by hand.

### Hooks

A table of behaviours keyed by enemy type, in a new file after
`06_game.js` in sort order (for example `06b_denemies.js`). `enemyUpdate`,
`hitEnemy` and `kill` look up the enemy's entry and call a hook only when it
has one. The hook points (names and signatures are the builder's):

- **Each step**, after the shared senses and before the state switch, for
  timers and abilities that run in any state (the brood mother's births,
  the eel's charge). It may take over the step.
- **Chase movement and attack choice**, in place of the shared steering for
  types that do not walk at the player (water-bound and wall-bound types).
- **Attack kinds**, for the wind and act of attacks with special movement,
  beside the existing `slam`, `charge`, `shot` and `volley`.
- **A hit filter** in `hitEnemy`, before damage is applied, that may change
  the damage and posture of a hit or refuse it (the drowned's shield).
- **A death hook** in `kill` (the bloater's burst, the brood mother's rats).
- **A footing rule**: where the type may stand. Water-bound types may stand
  only in their own body of water (`bodyAt` equal to the body they spawned
  in, and `waterAt` at least 0.5). Beside a tunnel gutter's shore `bodyAt`
  can read -1 where `waterAt` is 0.5 or more, so a reading of -1 there
  counts as the body's own (*builder's call*). Wall-bound types may not move
  at all.
  `eStep`, knockback, `separate`, the Sapper's push and `resolve` all keep a
  body on its footing.

Types that are water-bound or wall-bound are treated like the boss by the
class tools that move enemies: the Enforcer's grapple pulls the player to
them rather than yanking them, they never cross a rift, a Drop does not take
them, and the Sapper's and Riftwalker's executions happen in place
(*builder's call*). They still take every hit, stagger and execution.

### Being held

A player state, `held`, that any enemy can start through one function, used
by the siren and the drain grabber (*decided by the owner: mash dodge to
break free*).

- Mash presses are read with `hit('dodge')`, cost no stamina and count at
  zero stamina, so empty stamina never traps the player. They do not start
  a dodge and are not buffered; a press held over from the hold does not
  fire a dodge on release (*builder's call*).
- Both grabs are unblockable and show the red warning. Dodging the warning
  is the main answer; a parry cannot stop them.
- While held the player cannot move, attack or use tools, and is moved by
  the holder (dragged into water, pulled against the wall). Damage ticks
  through `hurtPlayer` while held.
- A hold lasts at most about 2 s. Each dodge press cuts about 0.35 s off.
  The holder letting go, being staggered or killed also frees the player.
- On release, a short invulnerability (about 0.4 s) and a grace of about
  1.5 s in which no enemy can grab again. Only one enemy holds at a time.
- Other enemies' hits still land on a held player. That is the danger of
  being caught in a crowd, and the grace stops it chaining into another grab.
- `held` ends on death, on `resetRun` and on leaving play. It works the same
  on keyboard, pad and touch, because dodge is a button on all three.
- The camera keeps following the player; the HUD shows a short prompt (the
  dodge input's name, through `actKey`) while held.

### The enemies

Numbers are starting values for tuning (*builder's call unless marked*).
Threat follows `threatOf`: 0 white, 1 orange, 2 red (*builder's call*).

**Rat** (weak, threat 0, batch 1). Low health, poise 0, comes in packs of 3
to 5. On land it rears up on its hind legs, which is its wind-up, then
bites. In water it swims flat and fast, `wade` about 1.6, and it cannot
attack while `waterAt` is above 0.5: it must climb out and rear first, and
that is the opening. It routes through water when that is shorter. Found in
tunnels, brood rooms and some pool rooms.

**Drowned** (medium, threat 1, batch 1). Slow, poise 1, carries a manhole
cover held forward. Hits from the front, about 60 degrees either side of
its facing, do no health damage and throw sparks, and shots from the front
are stopped too. Heavy hits from the front still deal their posture damage
(light ones about a quarter of theirs), so heavies break its guard into a
stagger and an execution. Hits from the side or behind land normally, and
its turn rate is low, so flanking works. Attacks: a shield bash that shoves
the player back, and an overhead strike with the cover's edge. Ambush and
backstab bonuses apply as for any enemy. Found in tunnels and brood rooms.
`wade` is the default.

**Brood mother** (medium, high priority, threat 1, batch 1). A bloated
rat, slow and heavy (poise 1). One per brood room. It keeps behind its
pack, away from the player. While it is hunting it sends out a rat about
every 6 s, from its body, with at most 4 of its own rats alive at once, and
it stops when it dies. Its rats join the hunt at once. A rat it sends out
gives no tool charge when killed and less focus than a placed rat, so it
cannot be farmed (*builder's call*). On a respawn after death, its sent-out
rats are gone with everything else. It defends itself with a slow bite
when the player reaches it. "High priority" means the player should kill it
first: nothing in targeting or the HUD changes for it, and keeping back from
the player stays within the shared leash and sight rules (*builder's
call*).

**Siren** (strong, threat 2, batch 2). Fast in water and cannot go on land
(water-bound). She guards the crossing in a pool room: her post is in the
water beside the crossing. Her lunge reaches about 4 m from the water's edge
onto the bank, grabs the player and drags them into her pool (`held`). Her
song is a wind-up then about 2 s in which the player is pulled toward her at
about walking pace; a dodge breaks it and the player can move against it.
She comes to the edge to lunge and sing, and that is when she can be hit
from dry floor; staggering her at the edge opens her to an execution. Her
drag ends about 2 m into her pool. After a hold she sinks back toward her
post and cannot grab again for about 6 s, well past the grace, so the
player has time to wade out (*builder's call*). The crossing's position is
added to the room's record in `genSewer` without any new draws, so her post
can be placed beside it. A pool
room holds sirens or eels, never both, and never a brood mother.

**Eel** (medium, threat 1, batch 2). Water-bound, in pool rooms without a
siren, one or two to a room. It bites a player at or in its water. About
every 8 s it glows for about 1.2 s, which is the warning, then shocks its
whole body of water: the player is hurt if they stand in that body
(`bodyAt` and `waterAt` above 0.5), and so are other enemies in it, rats
and bloaters included. The body of water is drawn lit while the shock
lands, so the player sees which pool it was. Other pools are safe. The eel
surfaces to bite and while glowing, and can be hit then from the bank.

**Bloater** (weak, threat 0, batch 2). Water-bound, in any water, tunnel
gutters included. It drifts slowly toward the player when hunting and bumps
for small damage. When it dies it bursts into a poison cloud, about 3 m
across, for about 3 s, which hurts everyone inside, enemies too, through
`hurtPlayer` and `hitEnemy` (an `aoe` hit). Killing one beside a pack is a
tactic; an eel's shock can set one off.

**Water-bound enemies out of reach.** A water-bound enemy hunts from its
pool: it moves to the point of its own body nearest the player and waits
there, at the edge, facing them. The shared sight, search, leash and
giving-up rules still decide when the hunt ends. An eel's timer runs only
while it hunts, so an idle eel never shocks (*builder's call*).

**Drain grabber** (ambush, threat 1, batch 2). Wall-bound: an arm living in
one of `world.grates` (grates and drains), about one in three of them. It is
hidden until it strikes: no tag, no bar, no lock. When the player passes
within about 2.5 m in front of its grate, the arm lunges with the red
warning and grabs (`held`), pulling the player against the wall. Once it has
struck it can be hit, locked and named; enough damage makes it pull back for
a few seconds, and more kills it. It re-arms after about 4 s. It never
chases, routes or joins a pack, and it does not take an attack token,
because an ambush should not wait its turn. Tunnels only.

### Placement

The sewer already records a kind on every spawn (`pool`, `brood`, `tunnel`,
`boss`) and returns its bodies of water and grates. Placement replaces the
`PACK` table and the tunnel husks in `genSewer`'s spawns (*builder's call
on the mix*):

- **Brood room:** one brood mother at the back of the room, 2 to 4 rats,
  and sometimes a drowned. Never a siren.
- **Pool room:** either one siren at the crossing, or one or two eels in
  the bodies away from the crossing; plus a few rats on the walkways and a
  bloater or two in the water. Sirens and eels never share a room.
- **Tunnel posts:** a drowned or a pack of rats. Bloaters in some gutters.
- **Grates:** drain grabbers in about one in three.
- Water-bound enemies spawn on water in their own body, every other type on
  dry floor, as now.

The draws for enemies come from the sewer's stream after everything else, so
the layout, water and dressing of every seed stay as they are. `genSewer`'s
spawn hashes in `t22` change on purpose, in each batch, and the commit says
so; the mesh, water and pieces hashes must not.

### Bodies and look

A new figures file (for example `05b_dfigures.js`) with each body built from
primitives, facing +Z like every figure, with `f.rim` and `f.eye`:

- Rat: a low four-legged body that rears onto its hind legs; swims flat.
- Brood mother: a bigger, swollen rat.
- Drowned: a waterlogged human shape carrying a round manhole cover.
- Siren: a human upper body over a tail, drawn low in the water.
- Eel: a long segmented body that rises from the water, glowing when charged.
- Bloater: a swollen floating sac.
- Drain grabber: a long jointed arm reaching out of the grate.

Their poses go in `07_render.js` or a new render file beside it. The
screenshots are the check: each type alone, and a fight in a pool room and a
brood room. New sounds (squeak, song, shock buzz, burst, grate rattle) come
from `SFX` like the rest (*builder's call*).

### Tests

A new test file for the D enemies, run in `smoke` with D made live:

- each type spawns where its room kind says, and none of E's types spawn in
  D after batch 2 (the Warden excepted);
- the rat cannot attack while swimming and outpaces the player in water;
- the drowned refuses front hits, takes side and back hits, and breaks to a
  stagger from front heavies;
- the brood mother's rats cap at four, stop at its death and give no tool
  charge;
- water-bound enemies never leave their body, under pushes, knockback and
  separation;
- `held`: dodge presses cut the hold short, one holder at a time, the grace
  after release, release on the holder's death or stagger;
- the eel's shock hurts only those in its body, enemies included, and sets
  off a bloater;
- the bloater's cloud hurts the player and enemies in it;
- the grabber is hidden until it strikes and re-arms;
- every water-bound enemy can be hit from dry floor at its pool's edge;
- screenshots of each body and of a fight in each room kind.

`t5`, `t6`, `t12`, `t20` and `t21` pass unchanged, and `t22`'s `genWorld`
hashes do not move. `CLAUDE.md` and `README.md` gain the new types, the hooks
and `held`.

## Left to the builder

- Every number not fixed above, including health, damage, timings, speeds,
  ranges and counts per room.
- The hook names, signatures and exact call points, the file names, and how
  the footing rule is enforced, within the rules above.
- The bodies' shapes, colours and poses, and the sounds.
- How the eel's lit body of water and the poison cloud are drawn.
- How the held prompt reads on each input.
