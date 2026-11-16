# Enemy names and threat colours: design

Date: 2026-11-16. Status: awaiting the owner's approval. Short design for a
small change.

## Intent

The player cannot tell how dangerous an enemy is until it hits them. The owner
wants every enemy to carry a name tag whose colour says how it compares with
the player, so the player can size up a fight before committing. The colour key
must be explained in the game and in the README so a new player learns it.

Levels do not exist yet. The branch is `feat/enemy-levels` and this is its
first step: the tags and the colour key now, real levels later.

## Goals

1. Every enemy shows its name on a black plate above its head.
2. The text colour is the threat tier:

   | Tier   | Colour            | Meaning                                  | Enemies today         |
   | ------ | ----------------- | ---------------------------------------- | --------------------- |
   | White  | `#FFFFFF`         | Weaker than you                          | Husk, Spitter, dummy  |
   | Orange | `#DB4D00`         | Around your level or slightly above      | Brute                 |
   | Red    | `#C40016`         | Much stronger than you                   | The Ossuary Warden    |

3. A tag shows when either is true:
   - the enemy's bars would show today (it has noticed the player or is
     hurt, within 26 metres), or
   - the player is looking at it: it is near the middle of the screen, within
     26 metres, with line of sight.
4. A "How to play" screen, opened from the title and pause menus, explains the
   three colours and holds the combat tips now on the title screen.
5. The README explains the three colours.

## Non-goals

- Levels, level numbers on tags, or any change to enemy or player stats.
- Scaling by portal grade.
- Changing when enemies notice the player. Looking at an enemy never wakes it
  and never affects the ambush bonus.
- Changing the posture bar. It keeps its colour (`--ember`).

## Anti-goals

- A Brute tag and a boss tag that look alike at a glance. If orange and red
  cannot be told apart in a screenshot, the feature has failed.
- Tags on enemies the player has not found yet and cannot see: through walls
  or far off in the dark. This governs the looking rule. An enemy that has
  noticed the player or been hurt keeps its tag and bars behind cover, as its
  bars do today, because goal 3 ties the tag to the bars. Ruled after the
  final review, which found the two statements in conflict.

## Approaches

**Where the tag is drawn.** Chosen: a name element added to each pooled
overhead bar in `HUD` (`#ebars`). It is the mechanism the bars and portal
labels already use and it gets the page fonts. Rejected: text in the WebGL
renderer, which has no text support.

**Where the colour comes from.** Chosen: one function, `threatOf(enemy)`,
returning 0, 1 or 2. Today it returns a fixed `threat` value from the enemy's
`EDEF` entry. When levels exist only this function changes, to compare the
enemy's level with the player's. Rejected: deriving the tier from health or
damage, which would move whenever balance is tuned.

**How "looking at" is decided.** Chosen: a zone around the screen centre; every
enemy inside it qualifies. Rejected: only the single nearest enemy to the
centre, which flickers between members of a tight pack; and the ranged aim
assist's yaw test, which ignores looking up and down.

The owner picked "bars plus looking at" over "bars only" and "always in view".
The three choices above are the builder's, stated to the owner before this
document was written.

## Design

### Data (`06_game.js`)

- Add `threat` to every `EDEF` entry: `husk` 0, `spit` 0, `dummy` 0, `brute` 1,
  `warden` 2.
- Add `threatOf(e)`, which returns `e.def.threat`. Everything that needs a tier
  calls it; nothing else reads `def.threat`.

### Tags (`08_hud.js`, `index.tpl.html`)

- Each pooled bar element gains a name child. It sits centred above the bar,
  does not wrap, and may be wider than the 64 pixel bar.
- One shared CSS class gives the tag its look: solid black background, small
  padding, uppercase body font. Three modifier classes set the text colour by
  tier. The same classes are used for the overhead tags, the name on the big
  boss bar and the examples on the How to play screen, so all three match.
- The red tier also uses the display font (`--display`), so the boss differs
  from the Brute in shape as well as colour. Red is `#C40016`, chosen by the
  owner; `--blood` (`#D8432E`) is not used because it is too close to
  `#DB4D00`. `#C40016` on black has a contrast of about 3.4 to 1, low for
  small text, so the red tag is set a little larger or heavier than the
  others and its legibility is checked by screenshot.
- The posture bar keeps `--ember` (`#FFB347`). No existing colour variable
  changes.
- Name text and tier class are cached per pool slot and written only when they
  change, as the portal labels do.
- The boss takes a pool slot for its tag. Its small bars stay hidden because
  the big bar already shows them. The name on the big bar is filled from
  `def.name` instead of being hard-coded in the template.

### When a tag shows

For each living, drawn enemy within 26 metres, show its slot if:

- it is aware of the player or below full health (today's rule), or
- it is looked at: the screen position of its body midpoint (the point the
  lock reticle uses) is within a zone around the screen centre, and
  `world.los` from the player to it is clear.

The zone is a tall box, not a circle. The camera sits above the player and
looks down at its resting pitch, so an enemy straight ahead appears above the
screen centre: about 25 pixels above at 3 metres and 140 at 26 metres, on a
720 pixel high screen. The box is therefore about a tenth of the screen height
to either side of the centre and about 0.28 of it above and below, widened by
the enemy's size on screen so that a near Brute counts when the centre is
anywhere on its body. A player who turns to face an enemy without tilting the
camera must still get its tag.

An enemy shown only because it is looked at shows its tag and its full bars
together. The pool stays capped; raising it from 8 to 10 to make room for the
boss is the builder's call.

### How to play screen (`index.tpl.html`, `09_main.js`)

- New screen `howto`, added to `SCREENS`, opened by a "How to play" button next
  to "Controls" on the title and pause screens, with a Back button. It follows
  the `controls` screen's behaviour for `menuBack` and for keeping the HUD
  visible when opened from pause.
- Contents:
  - **Enemy names.** Three example tags in their real colours with the meanings
    from the table above, worded as "weaker than you", "around your level or
    slightly above" and "much stronger than you". One line saying a name shows
    when an enemy notices you or when you look at it.
  - **Combat.** The three tips now on the title screen (pale flash and red
    glow, orange bar and execution, shrines and pause), moved here. The title
    screen loses its tips list.
- The posture tip keeps saying "orange bar"; the names section says "orange
  name". They are different things and the wording keeps them apart.

### Documents

- `README.md`: an "Enemy names" entry under "What is in the game" with the
  colour key, saying the colours are fixed per enemy type until levels exist.
  Mention the How to play screen under Menus. Add the new test script to the
  table.
- `CLAUDE.md`: add "set `threat`" to the "Add an enemy" recipe, describe
  `threatOf` and the tag rule under the HUD or Enemies notes, and add `howto`
  to the list of states.

## Testing

- New `tests/t10.mjs`, run in `smoke` mode, driving the simulation directly and
  reading the DOM under `#ebars`:
  - an unaware, unhurt enemy placed in front of the camera shows a tag with its
    name and tier class;
  - the same enemy with the camera turned away shows nothing;
  - an unaware enemy behind a wall and centred on screen shows nothing;
  - an aware enemy off-centre still shows its tag;
  - Husk and Spitter are tier 0, Brute tier 1, the Warden tier 2, and the
    Warden's slot has no small bars;
  - the How to play screen opens from title and pause and returns to each.
- The HUD reads the camera matrix from the last drawn frame. The builder must
  confirm how tests get a fresh frame after moving the camera (the screenshot
  scripts use a wait) before relying on DOM reads.
- Screenshots: a Husk, a Brute and the Warden tagged in one or more shots so
  white, orange and red can be compared, the dummy's tag in the hall, and the
  How to play screen. Re-take the title screenshot, which loses its tips.
- Re-run `tests/t6.mjs` and `tests/t8.mjs`, which cover combat rules and the
  dummy.

## Left to the builder

- The tag's font size and padding, and the gap above the bar.
- The look zone's size and how it scales with distance.
- Whether the pool grows to make room for the boss.
- The layout of the How to play screen within the existing `.scr.wide` style.
