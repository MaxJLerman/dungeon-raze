# Co-op: the Warden for two

Design, 2026-11-26. The third of three pieces the owner chose to build one
at a time. The first two are merged: the hall as a lobby with a dungeon
tuned for two (`2026-11-25-coop-lobby-design.md`) and the bigger cave
(`2026-11-26-coop-big-cave-design.md`).

## What the owner asked for

"Maybe the boss has a lot more health and multiple (more) phases", then
"please start on the more health and phases for the Warden when two fight
it". Shown three directions, the owner chose the one where the fight needs
both players, "but more of it". Shown eleven ideas, the owner chose:

- four phases;
- the Warden turns on whoever has hurt it most;
- an aftershock ring after every slam;
- a grab that only the other player can break;
- the chamber closes in for the last phase, with the lights out as its
  mood;
- "when the chamber closes in, the exit door should close. So if people
  have realized that they can leave the boss room to go and heal and then
  come back, they now can't do this for the last phase";
- a player who dies after the seal gets up inside, at the sealed door.

Why: the Warden only ever fights one player at a time. The other stands
behind it and hits freely, so more health alone makes the fight longer and
not harder. Each chosen idea either stops the free hits, threatens both
players at once, or puts one player's survival in the other's hands.

Lines marked *my call* are choices the owner did not make and may change.

## Today, measured

- Solo: 620 health, 140 posture, two phases. At half health it roars, moves
  1.2 times as fast, winds up in 0.85 of the time and gains a five-shot
  volley.
- For two: the same fight with `COOP_TWO.bossHp` 1.8 (1,116 health) and
  `bossPost` 1.5 (210 posture). A player's death in its chamber heals it a
  quarter of its full health (`bossHeal`); its phase does not go back.
- The host picks an enemy's target as the nearest live player, kept unless
  the other is `COOP.STICK` nearer (`pick` in `06d`).
- Each page judges a puppet's swing on its own player, so a guard, parry or
  dodge is decided by what that player saw. The host's `hurtPlayer` returns
  `"remote"` and changes nothing.
- The Warden leaves its chamber to chase, gives up at its 38 m and 30 m
  limits, walks home, and on arriving is at full health and phase 1.
- The chamber (`world.boss`, radius 16.5): over big caves 1 to 60 it has 16
  m of open floor around its centre and one tunnel in (33 caves) or two
  (27). It has no door.
- Nothing in co-op changes the field today. Co-op plays base classes only,
  so the Sapper's rubble never happens there. The crocodile's falling
  ceiling (`G.chunks`, `06b`, drawn by `drawChunks`) already does a dust
  warning, a falling rock and a heap that is a capsule of rock in the field.
- A snapshot carries an enemy's phase as one bit (`flags & 2`).
- Holds exist for D's enemies (`grabPlayer`, `p.state === "held"`,
  `HOLD`). They are not safe on a co-op host (`coop.md`, known problems).

## Goals

1. In a cave for two the Warden has four phases and about 2.5 times its
   solo health.
2. Each of the four chosen mechanics works for two players over the wire,
   with each page judging what lands on its own player.
3. In the last phase nobody can leave the fight, and nobody is locked out
   of it.
4. The solo Warden, and the Warden of a co-op cave built for one, are
   exactly as today.

## Non-goals

- Any change to the solo fight, to Old Sluicejaw, or to regular enemies.
- A new model for the Warden. New poses and effects on the model it has
  are in.
- Retuning the enemy count or `COOP_TWO`'s other numbers.
- Making D's grabs safe on a host. The Warden's grab is built for co-op
  from the start and does not go through that path.
- A tether, falling rock aimed at players, a chained charge, summoned
  packs: offered and not chosen.

## What would make this a failure even if it works

- The solo fight changes in any way.
- A player ends up outside the sealed chamber with the fight going on.
- The grab is damage the held player could never have avoided, or a hold
  that cannot end.
- One page has rock where the other does not.
- The last phase is too dark to read the Warden's wind-ups.
- The Warden spins between the two players instead of fighting.

## Approaches considered

**A. A second rulebook on the same Warden (chosen).** `coopTwoDefs()`
already gives every enemy of a world for two its own definition object made
from `EDEF`'s. The Warden's entry there gains what the fight for two needs:
its phase marks, its extra attacks and a flag the behaviour reads.
`EDEF.warden` is not edited. The behaviour is hooks in `EBEH.warden` that
do nothing unless the definition carries the flag. The owner left the
wiring to me; this is *my call*.

**B. A separate boss type swapped in for two.** Clean to reason about, but
it duplicates the figure, the name, the death message and every test and
lookup keyed on the type.

**C. The host scripts the phases from outside.** The least shared code,
but pages judge swings from the shared attack table, so the new attacks
must live there anyway, and a grab cannot be driven from the host alone.

## The design

### Which Warden is which

A world for two (`S.n === 2`, which for grade E is the big cave) has the
Warden for two for as long as that world lasts, wipes included and after a
player leaves. Every other Warden is today's. The page knows from the
world description's `n`, as it does for the cave's size.

### Health and phases

- Health 1,550 (`bossHp` 2.5). Posture stays 210. *My call*; the owner
  said "a lot more".
- Phase 2 below 75% of full health, phase 3 below 50%, phase 4 below 25%.
- Each change is today's phase change: the roar, posture cleared, the
  shock ring. A hit that crosses two marks roars once and enters the later
  phase; whatever the skipped phase switches on is on.
- A phase never goes back while the fight lasts. The heal for a death can
  lift health above a mark without undoing the phase, as today.
- The Warden's reset (it walks home, or a wipe) puts it at full health and
  phase 1 and undoes everything the phases did.
- Everything a phase adds stays for the later phases.
- The boss bar shows three notches at the marks. *My call.*

| Phase | Adds |
| --- | --- |
| 1 | Attention: it hunts whoever has hurt it most lately |
| 2 | Today's second phase (speed, tempo, volley) and the aftershock |
| 3 | The grab |
| 4 | The chamber closes in, the ways out are sealed, the lights go out |

The order of phases 2 and 3 is *my call*.

### Phase 1: attention

The host keeps a score for each player: the damage that player has dealt to
the Warden, halving every 4 seconds. The Warden's target is the live player
in its chamber with the higher score. It changes target only when the other
player's score is at least 1.3 times its target's, at least 3 seconds after
its last change, and never during a wind-up or a swing. With no score to
compare (the fight has just begun, or one player is dead, away or outside)
today's nearest-player rule decides. All numbers are *my call* and go in
one table.

This holds in every phase.

### Phase 2: the aftershock

Phase 2 keeps what today's second phase gives: speed 1.2, tempo 0.85 and
the volley.

From phase 2, every slam that lands sends a ring out from where it landed.
It starts 0.35 s after the landing, grows at 11 m a second to 24 m, and is
a band 1.2 m deep. A player the band passes over takes 14 damage. It can be
dodged through or guarded, and it does not stop at walls. Each page starts
the ring itself when its puppet's slam lands and judges it on its own
player, so no new message is needed. The ring is drawn as the game's rings
are, in the Warden's red.

### Phase 3: the grab

A new attack, `seize`, chosen like its others from phase 3 on when its
target is within 5 m, and not again for 14 s after it ends. Its wind-up is
0.9 s with its own pose (both arms wide) so it reads differently from a
sweep. It reaches 4.6 m in a narrow arc. It cannot be guarded or parried.
It can be dodged.

If it lands, the player is held (`p.state` `"held"`, drawn against the
Warden's chest while their position stays on the floor in front of it) and the Warden stands still in state `"hold"` for up to 4 s. The
held player takes 6 damage a second.

- **Broken:** the other player deals 80 damage to the Warden while it
  holds. The held player drops free with the hold's usual moment of
  safety, and the Warden is staggered for 2 s.
- **Not broken:** at 4 s the Warden crushes for 40 and throws the player
  6 m toward the chamber's centre.
- **Nobody to break it:** if the other player is dead, away or outside the
  chamber when the grab lands, or becomes so during it, the held player
  can struggle free by pressing dodge under `HOLD`'s rules, as from D's
  grabs. Otherwise struggling does nothing.
- The held player's death ends the hold.
- A posture break of the Warden while it holds counts as broken. Nothing
  else frees the player early.

The shared hold code ends every hold at `HOLD.max` (2 s) and lets dodge
presses free the player. This hold lasts 4 s and struggling works only
when nobody can break it, so `grabPlayer` takes the hold's length and
whether struggling works as options whose defaults are today's values.
D's grabs pass neither and are unchanged; their tests must pass untouched.

Who decides what: the target's page judges whether the seize landed, as
with any swing, and tells the host. The host accepts it only if the Warden
is in that attack against that player and the player is within its reach
plus a small allowance, then starts the hold and tells both pages with the
time. The host counts the damage, decides broken or crushed and says so.
The crush lands on the held player's page when it is told. A page shows a
line to the free player while the hold lasts: "Break its grip!" *My call.*

All numbers are *my call*.

### Phase 4: the chamber closes in

**Where it can begin.** The Warden for two chases out of its chamber as
today's does. While it is outside the chamber's radius its health cannot
fall below the 25% mark (the `hpFloor` hook), so the last phase always
begins with it in its chamber. Inside the chamber but outside the ring, it
is moved in with the other bodies, below. *My call.*

On entering phase 4 the Warden's roar lasts 2.2 s and during it:

- **The rock.** A ring of rock falls round the chamber's centre: 24
  capsules of radius 1.4 m (the crocodile's rubble) end to end on a circle
  of radius 12.5 m. Measured on big caves 1 to 200, this ring is closed to
  a body on every one and leaves 10.6 m of floor a body can stand on. Dust shows where each will land for 1.4 s, then they
  land in a sweep round the circle over 0.6 s. About 11 m of open floor is
  left of the 16 m. The ring is the door closing: every tunnel mouth is
  behind it. The rock is only a change to the field, made by the same
  function on the host and on both pages from `world.boss` alone, so the
  three cannot differ. Every enemy's route is dropped when it lands.
- **Bodies.** Anything under the rock when it lands is pushed inward to
  open floor, the Warden included. A falling rock does no damage. *My
  call*: the seal is a rule of the fight, not an attack.
- **Nobody locked out.** A live player who is outside the ring when it
  lands is brought to the door spot with a short fade. The door spot is
  inside the ring, 2 m in from the rock, on the line from the chamber's
  centre toward the route's last room. While the seal stands, every
  arrival is at the door spot: a player getting up after a death, a friend
  joining or rejoining, and a player who was away when the rock fell and
  is still outside when they come back.
- **The lights.** The cave's crystals dim to 12% over 2 s on both pages
  and stay there while the seal stands. The Warden's own glow, shots,
  rings and sparks light as usual. The floor of 12% is *my call* and the
  builder may raise it from the screenshots.

While the seal stands a player who dies sees the usual death screen and
gets up at the door spot with what a respawn gives today. The Warden's
heal for that death is unchanged.

**It stands its ground.** While the seal stands the Warden does not give
up the hunt or walk home, whatever its limits say. With no live player to
fight (one on the death screen and the other away, say) it waits where it
is until one is live again. So a dropped connection cannot reset a sealed
fight; only a wipe can. *My call.*

The seal ends in two ways. When the Warden falls, the rock crumbles, the
lights come back over 2 s and the exit gate opens as today. On a wipe, or
any other reset of the Warden, the rock and the dark go at once and the
players are at their rest points as today.

### The host and the wire

- The snapshot's flags carry the phase in two bits. `COOP_V` goes from 3
  to 4.
- New timed events, host to pages: the phase change (today's `roar`, now
  with the phase), the hold starting, the hold broken, the crush, the seal
  landing and the seal ending. One new event from a page to the host: its
  player was seized.
- The join and world descriptions say whether the seal stands, so a page
  that arrives late builds the rock at once and starts in the dark. The
  Warden's phase reaches it in the first snapshot, as its health does.
- The attention scores live on the host only.
- The host copy runs all of this in Node and in a Worker: no drawing, no
  sound.

### The dev build's way in

The dev menu gains "Warden for two": it starts a run for two alone over
the fake link (`coopSolo` with `two`), stands the player at the chamber's
door and offers buttons that put the Warden at each phase. `coopSolo`'s
scripted mate lets the grab be seen alone. Dev only, under `src/dev/`.
*My call.*

## Constraints that bind every part

- `EDEF.warden` is not edited, and with `NET` `null` no new code runs.
- Behaviour only this fight has is hooks in `EBEH`, not branches in
  `enemyUpdate`. Core reads `NET` only in places the notes list; a new
  place is added to that list.
- Damage to a player goes through `hurtPlayer`, a hold through
  `grabPlayer`, every move of an enemy through `eStep`.
- Shared player code changes only by options whose defaults are today's
  behaviour.
- Rubble is only ever a change to the field.
- New per-run state is cleared in `resetRun()`, and in `respawn` if it
  must not outlive a death. The seal must outlive one player's death and
  must not outlive a wipe.
- Files `01` to `06` load in Node and a Worker and name nothing from `07`
  on that could run there.
- Input is read with `held` and `hit`. Touch and controller need no new
  control: struggling uses dodge.
- No plain plaque code anywhere. No names or moves from the series the
  owner named as inspirations.
- Notes go in `coop.md`, `enemies.md` and the notes of any other system
  touched, in the same commit as the code.

## Tests

- **Host, in Node, two scripted players:** health and the three marks;
  one roar for a hit across two marks; the attention rule (it turns, it
  does not turn inside 3 s or mid-swing, it falls back to nearest); a
  seize accepted and refused; a hold broken at 80 damage, a crush at 4 s,
  the struggle when the other is dead, away or outside; a posture break
  during a hold; health held at the 25% mark while the Warden is outside
  its chamber; a sealed Warden with nobody live to fight stays put and
  keeps its health; the seal's rock
  identical on the host and a page copy; a player outside is moved in; a
  death after the seal gets up at the door spot; a wipe clears the rock
  and resets the phase; a friend joining during phase 4 arrives sealed in.
- **Solo unchanged:** the solo Warden's existing tests pass untouched,
  and a check that a solo Warden's definition has none of the new keys.
- **Page:** the aftershock judged on this player (hit, dodged, guarded);
  the held pose and the struggle; the dark; the notches. Screenshots of
  the aftershock, the hold, the rock falling, the sealed dark chamber, on
  desktop and on one phone.
- **Wire:** the two phase bits round the trip; a page of version 3 is
  refused.
- The full table once at the end, as for the other pieces.

## Left to the builder

- Names of functions, events and table keys.
- How the Warden's wide-armed pose and the held pose are posed.
- How the door spot is found when rock or a wall sits on the first choice.
- Whether the attention scores halve continuously or in steps.

## Risks

- Nobody has played two-player at all. Every number here is a first
  guess, set to be changed in one table.
- The dark may hide wind-ups. Screenshots are the only check before a
  playtest.
- At high ping the seize is judged 100 ms or more behind the host. The
  host's allowance on reach covers it; a dodge that looked clean could
  still be refused rarely.
- A ring of rock through a chamber with two mouths and uneven walls may
  leave a gap or pinch the floor on some seed. The host test walks the
  ring on many seeds.
- The fight is long: 1,550 health with heals for deaths. The owner's
  playtest decides.
