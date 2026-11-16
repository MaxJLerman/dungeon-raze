# Enemy pursuit, sight and pathfinding: design

Date: 2026-11-16. Status: awaiting the owner's approval. Full design for a
project-sized change.

## Intent

Once an enemy notices the player it follows them for good. The owner ran to the
boss chamber to show a friend the boss and the rest of the cave slowly arrived
and crowded the fight. On other runs a lap of the cave collected every enemy.
Enemies also follow the player's true position round corners and behind rock,
as if the walls were not there.

The owner wants enemies to behave more like people: they chase what they can
see, they lose the player when sight is broken, they search for a moment, then
they give up and go back to where they stood. The player should be able to
shake a pack and should be able to fight the boss alone.

## How it works today

- `enemyUpdate` in `src/06_game.js`. An enemy becomes `aware` through `alertE`
  (sight cone `sight` in front, 3 m behind, 7.5 m if the player sprints, or
  any hit, or a neighbour within 12 m waking it through `alertIn`).
- In `chase` it steers straight at the player's real position every step and
  slides along walls (`eStep` plus `world.resolve`). Line of sight is never
  checked while chasing, except by the Spitter to decide whether to shoot.
- It gives up only when the player is more than 46 m away in a straight line
  (38 m for the boss, which also gives up 30 m from its post). Then
  `aware = false`, state `return`, a straight walk to `hx, hz`.
- `return` has no route. A post round a bend leaves the enemy pressed against
  a wall. `enemyUpdate` also skips any unaware enemy more than 75 m from the
  player, so a returning enemy freezes if the player runs far enough.
- Regular enemies keep their damage when they give up. The boss heals to full
  and resets its phase when it reaches its post.

## Goals

1. **Sight.** A regular enemy that is hunting follows the player's real
   position only while it can see them: `world.los` is clear and the player is
   within `sight * 1.5` of it, in any direction.
2. **Last seen.** While it can see the player it records where they are and
   which way they are moving. When sight has been broken for a short grace
   time it stops using the real position.
3. **Search.** It then runs to the last place it saw the player, carries on a
   few metres in the direction the player was heading, stops and looks around
   for a couple of seconds. If it sees the player at any point the chase is
   back on. Otherwise it gives up.
4. **Leash.** A regular enemy never hunts further than a set distance from its
   own post (`hx, hz`). Past that it gives up, even with the player in view.
5. **Boss chamber.** While the player is inside the boss chamber, no regular
   enemy hunts them or can notice them. Any that were hunting give up and go
   home. The owner's stated aim is to fight the boss alone, and the leash by
   itself cannot promise that for a pack in the next chamber or a Spitter
   firing in from the tunnel mouth.
6. **Going home.** An enemy that gives up walks back to its post along a real
   route and arrives, from anywhere in the cave, wherever the player is.
7. **Pathfinding.** `world.route` finds a walkable route between two points on
   the same grid that drives collision. Search and going home use it.
8. **The boss keeps its own rules.** It does not lose the player to broken
   sight. Its 38 m and 30 m limits and its heal on return stay as they are.
   When rock is between it and the player it routes round with `world.route`
   in place of pushing against the wall.
9. The README, the How to play tips and `CLAUDE.md` describe the new
   behaviour. `CLAUDE.md` today says there is no pathfinding and lists
   snagging as a known problem.

## Non-goals

- Routing the chase itself while the player is in view. A clear line of sight
  is already a clear straight walk.
- Patrols, hearing, noise from sprinting or fighting beyond the rules that
  exist today, or any stealth meter or "searching" icon on the HUD.
- Healing regular enemies when they give up. They keep their damage as today.
- A door on the boss chamber.
- Any change to how an idle enemy first notices the player, except that it
  cannot notice a player who is inside the boss chamber (goal 5).
- Scaling any of this by portal grade.
- Coordinated searching. Each enemy searches by itself.

## Anti-goals

- An enemy that finds the player without having seen them or been led there
  by a last-seen position. If a hidden player is walked up to, it has failed.
- An enemy left standing against a wall away from its post after giving up.
- A boss fight that resets because the player stepped behind a rock.
- A regular enemy taking part in the boss fight, in the chamber or by
  shooting into it.
- A visible hitch when several enemies need routes in the same moment.
- An enemy that twitches between giving up and chasing while the player
  stands at the edge of its leash or hits it on its way home.

## Constraints

- All `src/*.js` share one scope. New names must be unique across `src/`.
- `genHub()` must return every field `genWorld()` returns. `world.route` goes
  in `fieldFns` in `src/03_world.js` so the hall gets it with no extra work.
- The `dummy` flag must still be honoured. The dummy returns early from
  `enemyUpdate` today and must keep doing so.
- `aware` is read by the HUD (bars, boss bar), the renderer (eye glow), lock
  targeting in `kill`, and the ambush bonus in `hitEnemy`. Its meaning stays
  "this enemy is hunting the player".
- Timings in seconds, no dependencies, `node build.mjs` after each change.

## Approaches

**Pathfinding.** Chosen by the owner: search the cave's one-metre grid on
demand. It works in any zone built on `fieldFns`, it respects enemy size
because the grid stores distance to the nearest wall, and it removes the
snagging problem. Rejected: following the generator's chamber and tunnel
graph, which puts enemies on rails and ties movement to one generator.
Dropped early: one shared route map centred on the player, which leads every
enemy to the player's real position and so recreates the problem, and a
way-home map per enemy, which only covers going home.

**What happens when sight breaks.** Chosen by the owner: check where the
player was, then guess where they went. Rejected: stopping at once, which
makes a rock mid-fight freeze the pack, and checking the last-seen spot only.

**Where the leash is measured.** My call: from the enemy's own post. A limit
measured from the player never triggers if the player moves at the enemy's
pace, which is how the cave followed the owner to the boss.

## Design

### `world.route(ax, az, bx, bz, rad)`

- Named `route` because `world.path` is taken: it is the list of chamber ids
  from the start to the boss, read by `tests/t2.mjs`, `tests/t6.mjs` and
  `test.mjs`. That field stays as it is.
- Lives in `fieldFns`, returned beside `fieldAt`, `resolve` and `los`, and
  added to the objects returned by `genWorld` and `genHub`.
- Searches the grid points of `F`. A point is usable when its field value is
  at least `rad` plus a small margin, so a wide enemy is not sent through a
  gap it cannot fit. Diagonal steps must not cut a blocked corner.
- Start and goal snap to the nearest usable point.
- Returns a short list of `{ x, z }` waypoints ending at the goal, with
  needless points removed so the walk looks direct, or `null` when there is
  no route or the search passes a work limit.
- On `null` the caller falls back to today's straight steering. Nothing may
  freeze for want of a route.

### Following a route

- An enemy holds its route and the index of the next waypoint, steers at that
  waypoint with `eStep`, and moves on when close.
- No progress for about 1.5 s means ask for a new route. A second failure in
  `search` means give up. In `return` it keeps retrying every 2 s.
- Routes are asked for when a state starts or a retry is due, never every
  step. The boss re-plans at most twice a second while it has no line of
  sight.

### Sight and memory

- Each step, for every aware regular enemy in any state: if it can see the
  player (goal 1) it stores the player's position and velocity as last seen
  and zeroes a lost timer. Otherwise the timer runs.
- `alertE` seeds last seen. A hit sets it to the player's position at that
  moment, since a hit tells the enemy where it came from. An enemy woken
  through `alertIn` copies last seen from the enemy that woke it.
- `alertIn` wakes an enemy that is walking home only if that enemy could
  notice the player itself under the territory rule below, or if the enemy
  that woke it is provoked. In the second case it shares the provoke time, so
  hitting one of a retreating pack turns the pack.
- `chase` is unchanged while the lost timer is under the grace time. Past it,
  the enemy drops its attack token and plan and enters `search`.
- States that fall back to `chase` today (`rec`, `hit`, `recoil`, `stagger`,
  `roar`, `alert`) keep doing so. `chase` hands on to `search` on its next
  step when the player is not in view.

### New state `search`

Three steps in order. Seeing the player in any of them returns to `chase`.

1. **Go.** Route to the last-seen position at chase speed.
2. **Guess.** If the player was moving when last seen, walk in that direction
   at reduced speed, sliding along walls as enemies do today, for up to the
   guess distance or its time limit. This follows a gentle bend without a
   route. Skipped if the player was standing still.
3. **Look.** Stand and sweep the facing left and right for the look time.

Then give up.

### Giving up, the leash and the boss chamber

- A regular enemy gives up from `chase` or `search` when: the player is dead,
  the search ends, it is further than the leash from its post, or the
  player is inside the boss chamber.
- Giving up sets `aware = false`, drops the token, routes to the post and
  enters `return`. On arrival: `idle`, facing `hyaw`, as today.
- A returning enemy can notice the player again by the existing idle rules,
  but only if the player is inside its territory: within the leash, less a
  margin, of its post. This stops the twitch at the leash edge.
- **Provoked.** A hit always starts a hunt. For a few seconds after any hit
  the leash is ignored, and each hit renews it. Without this an enemy stabbed
  on its way home would turn, give up at once and turn away again. The boss
  chamber rule is never ignored.
- **The boss chamber.** The player is inside when within `boss.r` of
  `world.boss`, and stays inside until beyond `boss.r + bossPad`, so standing
  on the line does not flicker. The rule is skipped when `world.boss` is
  null, as in the hall. While the player is inside:
  - a regular enemy in `chase` or `search` gives up. One part-way through an
    attack finishes it first, so a lunge may carry it over the line before it
    turns for home. The chamber edge is not a wall;
  - no regular enemy becomes aware, whether by sight, by `alertIn` or by
    being hit. A hit still does its damage and flinch.
- **Posts near the chamber.** `genWorld` posts a Husk at the midpoint of some
  tunnels, and on some seeds that is inside the boss chamber. A tunnel post
  that would fall within `boss.r + bossPad` of the boss is moved back along
  its tunnel until it is outside. This uses no random numbers, so the rest of
  the cave is unchanged. Run `tests/t5.mjs`.
- The existing 46 m rule for regular enemies is removed. These rules replace
  it.
- The `dist > 75 && !e.aware` skip in `enemyUpdate` must not apply to an
  enemy in `return`.

### Starting numbers

One table in `src/06_game.js`, for example `PURSUIT`, so tuning is one place.

| Name      | Value        | Meaning                                         |
| --------- | ------------ | ----------------------------------------------- |
| `seeMul`  | 1.5          | Hunting sight range as a multiple of `sight`    |
| `lostT`   | 0.35 s       | Broken sight tolerated before `search`          |
| `guess`   | 8 m, 2.5 s   | Distance and time limit of the guess step       |
| `look`    | 2.5 s        | Time spent looking around                       |
| `leash`   | 32 m         | Furthest a regular enemy hunts from its post    |
| `edge`    | 4 m          | Territory is the leash less this                |
| `provoke` | 4 s          | Leash ignored for this long after a hit         |
| `bossPad` | 3 m          | Added to `boss.r` for leaving and for posts     |

Chambers are about 44 m apart with radii of 8.5 to 12 m, so 32 m lets an
enemy leave its chamber and follow down a tunnel but not settle in the next
chamber. An `EDEF` entry may carry its own `leash`.

### Tests

New `tests/t12.mjs`, run with `smoke`, driving `DF.sim` like the others:

1. `world.route` from the start to the boss chamber exists on several seeds,
   every leg keeps clearance for the radius asked, and a search stays within
   a time bound.
2. Lost sight: a chasing Husk whose player is moved out of view enters
   `search`, reaches the last-seen spot, never closes on the hidden player,
   gives up and is `idle` at its post within a time bound.
3. Seen again: the player stepping back into view during `search` returns it
   to `chase`.
4. Leash: a player kept in view and led away is dropped at the leash, and the
   enemy gets home.
5. Boss chamber: with aware enemies close by, a Spitter among them, and the
   player then placed inside, within a time bound no regular enemy is aware,
   none is inside `boss.r`, none fires, and all reach their posts. On several
   seeds no regular post lies within `boss.r + bossPad` of the boss.
6. Boss: the Warden stays aware with line of sight blocked.
7. Provoked: a hit on a returning enemy beyond its leash makes it hunt for
   the provoke time, and a pack-mate walking home beside it turns with it.
8. Far return: with the player moved 100 m away, a returning enemy still
   reaches its post.

`tests/t5.mjs`, `t6.mjs`, `t8.mjs` and `t10.mjs` must still pass.

## My calls, for the owner to check

- Goal 5, the boss chamber rule. It was not asked for in those words. It
  keys on where the player is, not the enemy, so stepping into the chamber
  sheds every pursuer at once and Spitters cannot fire in from the tunnel.
- A regular enemy hit from inside the boss chamber takes the damage and does
  not come after the player.
- Tunnel Husks posted inside the boss chamber are moved back up their tunnel.
- The provoked rule and its 4 seconds, and that a provoked enemy turns its
  retreating pack-mates with it.
- Hunting sight ignores facing: a hunting enemy sees the player in any
  direction when the line is clear. "Break line of sight" is then the one
  rule the player has to learn.
- The guess step walks on in the player's last direction with wall sliding,
  not along a planned route.
- Every number in the table.
- Hiding and shooting with a ranged class is not specially prevented. An
  enemy that is hit runs to where the shot came from, which is the only
  counter.
- An enemy walking home counts as unaware, so the Assassin's ambush bonus
  applies to it, as it does today.

## Left to the builder

- The search algorithm, its data layout and its work limit.
- How waypoints are thinned.
- How a pack arriving at one last-seen spot avoids jostling, for example an
  arrival radius.
- The look-around motion. A facing sweep is enough. No new pose is required.
- Whether route requests need spreading across frames to meet the no-hitch
  anti-goal.
- Wording of the How to play tip and the README and `CLAUDE.md` edits.
