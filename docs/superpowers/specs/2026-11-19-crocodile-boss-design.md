# The crocodile: D's boss

Project 3 of the D gate. Projects 1 and 2 (the sewer, its water and its
enemies) are merged. This spec replaces the outline under "Project 3: the
crocodile" in `2026-11-18-sewer-d-gate-design.md` wherever the two differ.

## Intent

D has a whole zone and seven enemy types, but its boss cavern still holds
E's Warden as a stand-in, so D cannot open on the published page. The
crocodile is the last piece. Once it is in, D joins `LIVE_GRADES` and the
D portal opens for anyone who has cleared E.

The owner wants Soulslike and God of War style combat. The crocodile should
be a fight of reading and punishing: it hides in the water, comes up with a
warning, fights hard on land where it can be punished, and three times in
the fight climbs into the walls and has to be knocked down with a parry.

## Goals

1. A boss with its own body and moveset in the sewer's boss cavern, in
   place of the Warden.
2. Land phases with a real moveset, including a lunging grab into a death
   roll that uses the existing hold (mash dodge to break free).
3. At each 25% of health lost, a tunnel phase: it leaps into the wall
   tunnels and throws spiked plates, and a parried plate knocks it down.
4. Below half health the ceiling drops rubble; bloaters wash down the
   falls; its shadow shows under the light shafts.
5. D joins `LIVE_GRADES` when part two lands, and the D portal opens on the
   published page once E is cleared.

## Non-goals

- Grade scaling of difficulty and kill rewards. That is backlog item 2's
  next step, separate from this.
- A general boss-phase system for the C to S bosses (see Approaches).
- The dev options menu.
- Changing the Warden or anything in E.

## Anti-goals

- **A recreation of a specific boss from another game or series.** The
  name, look and moves are original. No reference to the inspiration
  series by name.
- **A fight that can be skipped.** A big combo must not carry it past a
  25% mark, so every tunnel phase happens.
- **A tunnel phase only one class can answer.** Every class can parry a
  plate, and shots can still hurt it up there, so ranged classes are not
  forced to parry and melee classes are not locked out.
- **E changes.** E's cave, enemies and tests stay exactly as they are; the
  t22 hashes of caves 1, 7 and 99 hold.

## Constraints

- The build rules in `CLAUDE.md`: one scope across `src/`, no dependencies,
  no network, everything generated in code.
- The owner's earlier choice (D enemies spec, approach B): the crocodile
  reuses the per-type hooks (`EBEH`, `EFIG`, `EPOSE`) and the `held` state.
- The sewer's triangle budget: no sewer frame may draw more than cave 99
  (t22 checks this). The crocodile's figure and effects must fit.
- D stays out of `LIVE_GRADES` until part two is merged.
- The rules every new way of targeting an enemy follows: skip `fall` and
  `hidden`; `safe` is not a target for damage.

## Approaches

1. **Crocodile only, on the enemy hooks (chosen).** A `step` hook owns its
   modes (under, surfacing, on land, in a tunnel, knocked down). On land it
   hands over to the shared boss path, so its attacks, posture, stagger and
   execution work as the Warden's do. The water, tunnels and plates are its
   own rules, and the death roll uses `grabPlayer`. It matches the owner's
   earlier choice of hooks, leaves E untouched and is the least new code.
   The cost: some of it may be copied when the C boss arrives.
2. **A general boss-phase system first.** Health marks that start a
   scripted sequence, damage capped at marks, modes out of reach, with the
   crocodile as its first user. It would serve later bosses, but it designs
   for four bosses nobody knows yet, takes longer, and leaves the Warden as
   a second way of doing the same thing unless it is moved too.

The owner chose 1. Shared pieces get pulled out when the C boss shows what
really repeats.

## The fight, as decided

These are the owner's decisions, in the order they were made.

- **Proper land phases.** It surfaces, comes onto the ring and stays up for
  a while with a real moveset, closer to the Warden than to a quick visit.
- **A death roll grab.** One of its land attacks is a lunging grab that
  holds the player in a death roll, using the existing hold: damage over
  time, mash dodge to break free.
- **A tunnel phase at every 25% of health lost**, at 75%, 50% and 25%.
- **Shots can hurt it in a tunnel**, but a parried plate is the big payoff
  and the only way to knock it down. Knocked down, it falls onto the ring
  and the fight on land carries on.
- **Two parts**, with D sealed until both are in.

The owner also accepted these, which were proposed and not objected to:

- At each mark it breaks off what it is doing and goes at once, even in the
  middle of an attack.
- Damage stops at each mark: no hit, shot, blast or cloud takes it past the
  next mark until that mark's tunnel phase has begun.
- If nobody parries, it throws all its plates, drops back down unhurt and
  the land fight carries on.
- Shots in a tunnel phase are capped at about half a quarter of its health
  (chosen after the builder check, over going straight on to the next
  tunnel phase or waiting at the mark).
- From the 75% mark it throws 1 or 2 plates per tunnel; from the 50% and
  25% marks, 1 to 4. It visits 1 to 4 tunnels each time, each count random.

## The design

### Starting, and leaving the cavern

*My calls:*

- It starts under the water. The fight begins when the player first enters
  the cavern (`G.inBoss`): the boss bar comes up and it starts its first
  spell under. It cannot be woken by sight, since a hidden enemy is never
  seen.
- If the player leaves the cavern mid-fight, it gives up as the Warden
  does: it heals to full, its marks reset to none passed, its rubble
  crumbles and it waits under again. This matches E's boss, and nothing is
  lost yet by leaving.
- The shared boss leash (38 m from the player, 30 m from its post) does not
  apply to it. The cavern is its whole range, and leaving the cavern is the
  only thing that ends the fight short of a death.

### Under the water

- It swims the moat and the centre pool. While under it is `hidden`: not
  drawn, no tag, cannot be locked, aimed at, hit or caught in a blast. The
  boss bar stays up once the fight has begun.
- A wake and bubbles on the surface show where it is heading.
- *My call:* the moat and the centre pool are joined below the ring, so it
  can come up in either. Its wake fades at one shore and starts at the
  other. It does not draw a wake across dry floor.
- It stays under for a short spell and then picks where to surface.

### Surfacing

- It picks a spot on a shore of the moat or the centre pool, not the last
  one it used, and favouring one near the player.
- A short warning first (bubbles boiling up, a ripple ring), then it bursts
  out, rears up on its hind legs and comes down in an attack. Someone
  standing on the spot when it comes up is hit.
- It then stands on the ring for the land phase.

### On land

- It fights through the shared boss path: wind, act and recovery, posture,
  stagger, execution, hitstop, the boss bar. Its attacks are `EDEF` entries
  like the Warden's.
- **Moveset.**
  - **Rearing slam:** the attack it surfaces with. It rears up and crashes
    down in front of it.
  - **Bite chain:** two or three snapping bites with short lunges.
  - **Tail sweep:** a wide sweep behind and to the sides, for a player who
    circles behind it. It starts it when the player is behind it.
  - **Death roll:** a lunging grab with the red unblockable warning. It
    calls `grabPlayer` and drags the player to a point about 2 m into the
    nearest water, rolling as it goes, and deals damage over time
    (`atk.dot`). Mash dodge breaks free early, as with the siren. When the
    hold ends it cannot grab again for a while.
    *My call:* it goes into the shallows with the player for the roll, then
    climbs back onto the ring and carries on the same land phase. The roll
    does not end the land phase and does not stop its clock, so a grab is
    never an escape.
- **How long it stays.** A land phase lasts a set time and then it walks or
  lunges back to the nearest water and dives. A stagger stops that clock
  and adds time to it, so staggering it keeps it out longer. An execution
  is open to the player as on the Warden.
- On land it keeps to dry floor (a `foot` rule the other way round from
  `waterFoot`) and enters the water only to dive and, in the shallows, for
  the death roll.

### The 25% marks

- At 75%, 50% and 25% of its health it starts a tunnel phase. If a hit
  would take it past the next mark, the hit's damage stops at the mark.
  This runs through its `hit` hook, so it covers melee, shots, blasts,
  mines and clouds alike.
- Reaching a mark breaks off whatever it is doing, an attack included. A
  hold in progress ends (the player is released as if the hold ran out).
- The shared boss phase change at half health (the Warden's roar and "The
  Warden burns hotter") must not run for it. The crocodile's phases are its
  own.
- **Part one has no tunnels yet**: at a mark it dives at once and the land
  fight carries on. Part two puts the tunnel phase there.

### The tunnel phase (part two)

- It leaps from the ring into one of the wall tunnels (`world.wallTunnels`:
  3 to 5 mouths halfway up the far wall, at `y` 5, each facing the
  cavern's centre).
- In a tunnel it whips its tail and flings spiked plates at the player:
  real enemy shots through `G.projs`. Each tunnel gets its count of plates
  (above), then it moves on to the next tunnel through the wall unseen.
- **Warning.** Before it shows at a mouth, that mouth surges with water or
  shows glowing eyes, so the player can see where the next plate comes
  from.
- **Shots hurt it** while it is at a mouth (the player's shots must be able
  to reach a body that stands in the wall, not stop on it). The 25% cap
  still holds.
- **A cap per tunnel phase** (the owner's choice): shots in one tunnel
  phase take off at most about half a quarter of its health (about 100 of
  800). Damage past that is lost. So the next mark is always reached on
  land, ranged players still face the land fight, and a parry stays the
  fastest way through.
- **A parried plate** flies back to it (the existing reflect sends a
  parried shot toward its source) and knocks it out of the tunnel. It lands
  on the ring stunned (a stagger), open to punishment and execution, and
  the land fight carries on from there.
- **No parry:** after its last plate it drops back into the water unhurt
  and the fight carries on.
- Melee cannot reach it in a tunnel, and nothing locks onto it there (a
  lock on it drops when it leaps).

### The falling ceiling (part two)

- From the 50% mark, chunks of the ceiling come down now and then. Each
  shows a dust warning on the floor first, then falls and becomes rubble
  through `world.addRock`, which blocks its lunges, sight and shots and
  gives the player cover.
- It falls only on the dry ring, never in water and never on the entrance
  crossing. A chunk landing on the player hurts them; one landing on the
  crocodile does not.
- Rubble stays for the rest of the fight. *My call:* a cap on how many
  heaps stand at once, the oldest crumbling when a new one falls, so the
  ring never closes up.

### Bloaters down the falls (part two)

- Now and then a bloater washes down one of the wall tunnels' falls into
  its fall pool and joins the fight as a normal bloater. A cap keeps a few
  at most alive at once.
- A bloater's cloud already hurts every enemy in it, so popping one beside
  the surfaced crocodile hurts it. No new rule is needed for that; it goes
  through the crocodile's `hit` hook and its 25% cap like any hit.

### The shadow (part two)

- While it is under and passes beneath a light shaft's pool of light
  (`world.shafts`), its dark shape shows through the water there. Drawn as
  a ground blob, so it costs no triangles.

### Its body

- Primitive-built like every figure: a long low body, a heavy tail, short
  legs that let it rear onto its hind legs, a long jaw. Original look, dark
  green-black with a pale belly. `EFIG` and `EPOSE` hold it.
- Poses for swimming (only what shows above water, if anything), rearing,
  each attack, the roll, stagger, the tunnel throw and the fall when
  knocked down.

### Its name

*My call, for the owner to change:* **Old Sluicejaw**, threat 2, shown on
the boss bar like the Warden's name.

### Winning

- Killing it records D as cleared through `clearGrade`, as the Warden does
  today, and opens the gate out. C is not live, so no "new gate" message.
- `LIVE_GRADES` gains D in part two, so the published D portal opens for a
  player who has cleared E.

## Part one and part two

**Part one** (D stays sealed): its body; under the water, the wake,
surfacing and its warning; the land phase with the rearing slam, bite
chain, tail sweep and death roll; the land clock and stagger; the 25% marks
and their damage cap, each mark diving at once; replacing the Warden in the
cavern; the tests.

**Part two**: the tunnel phase, plates, the mouth warning, shots reaching
it, the parry knock-down; the falling ceiling; bloaters down the falls; the
shadow; `LIVE_GRADES` gains D; t8's sealed-frames step and t22 updated for
D open.

## Left to the builder

- Every number: health (about 800, against the Warden's 620), posture, how
  long it stays under and on land, the stagger bonus, each attack's timing
  and damage, the death roll's damage and drag speed and cooldown, plate
  speed and damage, how often the ceiling falls and its cap, how often a
  bloater comes down and its cap. All set by tests and screenshots, for the
  owner's playtest to tune.
- How the stand-in for "joined below the ring" is drawn, as long as no wake
  crosses dry floor.
- Its radius and how it fits the 4 m moat, as long as it never stands in a
  wall.
- The tests: a new `tests/t25.mjs` for the crocodile, with screenshots of
  it surfacing, on land, in the death roll and (part two) in a tunnel
  mouth. Replacing the Warden moves t22's spawns hash only; say so in the
  commit.
- `CLAUDE.md` and `README.md` updated in each part.
