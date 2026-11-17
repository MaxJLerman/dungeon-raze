# Plaques, unlock codes and the Enforcer

Design agreed with the owner on 2026-11-17. Read `CLAUDE.md` first: it holds
the conventions (axes, facing, bindings, touch layout, tests) this builds on.

## Why

The owner wants the game to reward curiosity and give strategic players more
to chew on. The chosen route is secret classes: kits outside the usual
fantasy roles that change how a fight is thought about, unlocked the way old
console games unlocked things, by entering a button sequence. This first
piece builds the unlock machinery and one secret class, the Enforcer, so the
whole loop can be played: find the plaque, enter the code, see the unlock,
pick the class, fight with it.

Later pieces (in the `CLAUDE.md` backlog): the Sapper and Riftwalker kits,
quests on the plaques, the in-game hunt that leads players to the hidden list
of codes, the joke classes in `docs/ideas/joke-classes.md`, and a jump.

## Goals

1. Three plaques on the hall's left-hand wall (the +X wall, `x = 15`), one
   each for the Enforcer, the Sapper and the Riftwalker.
2. A new action, **Interact**, on Space and pad A or Cross. Standing at a
   plaque, it opens the close-up view; pressed again, it closes it.
3. In the close-up, entering the plaque's code unlocks the class and puts a
   message on screen saying so.
4. Unlocks are saved in the browser and survive closing the tab.
5. The Enforcer, a complete playable class.
6. Dodge moves from Space to **B** on keyboard. On a pad it stays B or Circle.

## Non-goals

- Jumping. Interact takes the button that jump will share later; nothing
  jumps in this piece.
- Sapper and Riftwalker kits. Their plaques exist and read as sealed.
- Quests, and gating portals D to S by class. Those portals are closed today.
- The hunt for the hidden code document. The owner holds the codes for now.
- Joke classes and their code spot.
- Ammo or reloading for the Enforcer.

## Anti-goals

- **A code readable from the repo or the page.** Codes are stored only as a
  hash. The plain code goes to the owner in conversation and into a
  gitignored local file (see Testing), and appears in no committed file,
  commit message, test or comment. Nothing in the page can decode it. This is
  a soft secret: `window.DF` ships in the public build and can unlock a class
  directly, and a short code can be brute-forced from its hash. Both are
  accepted (decided by the builder of this doc; the owner asked only that the
  code not be readable).
- **Anything owned.** The Enforcer is an original character. No skull
  emblem or anything else recognisable from an existing vigilante character.
  The sealed classes are called Sapper and Riftwalker, not after any film or
  game.
- **Locking out touch or pad players.** Every step of the loop works on
  keyboard and mouse, pad, and touch.
- **Disturbing the five existing classes**, their picker, or anyone's saved
  settings beyond the dodge move described below.

## Constraints

- No textures in the renderer (`02_gl.js` has none). Text in the world is
  HTML positioned with `R.toScreen`, as name tags and portal labels are.
- Single function scope across `src/`; declare each name once.
- `node build.mjs` after every change; tests run against `dist/index.html`.
- Touch controls: every pixel position for a touch control comes from
  `touchLayout`, and `layoutProblems` must pass on every device in
  `tests/devices.mjs`.
- Saved data lives in `dungeon-raze.v2` in `localStorage`, read by `loadOpt`
  and written by `saveOpt`. A missing or throwing storage changes nothing.

## Approaches considered for the close-up

1. **Camera glides in, an HTML plaque card grows over it.** Chosen by the
   owner. Crisp text, room for touch controls, uses the same HTML-over-world
   technique as name tags.
2. A real 3D plaque in first person with text drawn into a texture. Rejected:
   needs texture support added to the renderer and shader, a deep change for
   one feature.
3. A plain pop-up with no camera move. Rejected: loses the sense of stepping
   up to look at something, which the owner asked for.

## Design

### Interact and the dodge move

- Add `interact` to `DEFAULT_BINDS` (`"Space"`), `ACTIONS` (label "Interact")
  and `DEFAULT_PAD` (`"P:0"`). The controls menu picks it up. `dodge` defaults
  to `"KeyB"`.
- **Saved settings.** In `loadOpt`, a saved `b.dodge` of `"Space"` becomes
  `"KeyB"` when no saved action holds `"KeyB"`; otherwise it is left alone.
  The saved settings have no `interact` yet, so it takes its default.
- **Priority.** Within reach of a plaque, an Interact press opens the plaque
  and is consumed, even if another action shares the key. Elsewhere Interact
  does nothing in this piece. When jump arrives, "elsewhere" becomes jump.
- README and the in-game hint text are updated for dodge on B and Interact.

### The plaques

- Built in `genHub` from a list like `hubPortals()`: `hubPlaques()` returns
  `{ id, x, z, yaw, cls }` for each. They sit on the +X wall at about
  `z = -6, 0, 6`, facing into the hall (`yaw = -PI/2`), at eye height. Order
  from the hall's entrance end: Enforcer, Sapper, Riftwalker (builder may
  change the spacing to clear pillars and the E portal).
- Each plaque is a flat stone slab with a trim and a faint glow, built from
  the same primitives as the portal frames. An unlocked plaque glows in the
  class colour; a sealed one is dark.
- **Prompt.** Within about 2 metres and roughly facing the plaque, the HUD
  shows "`<key>` Inspect" the way it shows the Execute prompt, using
  `actKey("interact")` on keyboard and pad.
- **Touch.** Touch has no Interact button. Under touch the prompt reads
  "Inspect" and is itself tappable. Tapping it opens the plaque. This keeps
  the owner's honeycomb unchanged.

### The close-up

- Opening sets player state `inspect`. The player stops, cannot attack or
  take other actions, and mouse and stick look are ignored. The game stays in
  `play`. Only the player's own sticky bomb can hurt them in the hall; one
  still ticking when a plaque is opened goes off as normal.
- The camera eases over about 0.5 s to a point roughly 1.6 m in front of the
  plaque at eye height, looking straight at it. Closing eases it back to
  where it was.
- An HTML plaque card scales up from the plaque's on-screen position
  (`R.toScreen`) to fill most of the screen. Its content:
  - **Locked, live (Enforcer):** an emblem, a cryptic epithet instead of the
    class name, and a row of empty marks that fill as inputs are entered.
  - **Unlocked:** the class name, its tag and its kit lines from `CLASSES`.
  - **Sealed (Sapper, Riftwalker):** an emblem and the word "Sealed". It takes
    no code.
  - A line naming the close input: "`<key>` Close", with a tappable close
    control under touch.
- Pressing Interact again, or pausing, closes it. Leaving play closes it.

### Codes

- **Symbols.** A code is a sequence of 8 to 10 symbols from seven: Up, Down,
  Left, Right, and the three actions **dodge**, **heal** and **tool**. The
  action symbols read whatever key or button each action is bound to. With
  default bindings these are B, X and Y on an Xbox pad (Circle, Square,
  Triangle on PlayStation) and B, E and R on keyboard. Interact is never a
  symbol, since it closes the plaque.
- **Input sources while inspecting.**
  - Directions: a press of the `fwd`, `back`, `left` or `right` binding, the
    D-pad (`P:12` to `P:15`, read raw while inspecting) or a left-stick push
    past 0.5 that must return to rest before it counts again.
  - Actions: `hit("dodge")`, `hit("heal")`, `hit("tool")`, which already read
    keyboard, pad and touch.
  - Touch: an on-screen D-pad appears in the close-up, and the honeycomb's
    Dodge, Flask and Tool buttons stay live as the action symbols. The D-pad's
    position comes from `touchLayout` (a new `dpad` entry) and must pass
    `layoutProblems` on every device.
- **Matching.** Keep the last ten symbols. After every symbol, hash the tail
  of each length the plaque's code could have and compare with the stored
  hash. There is no "wrong" state; old inputs simply roll off.
- **A key shared with Interact** (possible after loading an old save, on
  keyboard or pad). In the close-up, a press that is both Interact and a code
  symbol counts as the symbol, and the plaque is then left by pausing; the
  card's close line names whatever closes it. This way no saved layout can
  stop a code from being entered. (Builder of this doc's call.)
- **Storage.** Each plaque stores only a hash of its code string, computed
  with a small inline string hash (no `crypto.subtle`, which is not available
  on every origin the page runs from). A determined reader could brute-force
  a short code from the hash; that is accepted.
- **On a match:** the plaque card flares in the class colour, a sound plays,
  the screen shows "ENFORCER UNLOCKED" through `say` or a larger banner, and
  a smaller line says where to choose the class (the class picker on the
  pause and title screens). The unlock is saved. The player keeps their
  current class; the builder may add a "Switch now" control on the card.
- The builder chooses the Enforcer's code, gives it to the owner in the
  conversation, and commits only its hash. The Sapper and Riftwalker get
  codes when they are built.

### Saving unlocks

- Saved under `u` in `dungeon-raze.v2` as an array of class ids, written with
  the rest by `saveOpt`, read by `loadOpt` (unknown ids ignored).
- A class with `hidden: true` in `CLASSES` appears in the picker only once
  unlocked. `OPT.cls` naming a hidden class that is not unlocked falls back to
  the first class. Code that loops `CLASS_IDS` for other reasons is
  unchanged.

### The Enforcer

A gunman in a long dark coat. Ranged (`ranged: true`), aiming with
`aimRanged` like the Ranger and Mage. Colour of the builder's choosing that
differs from the five existing ones.

| Slot | What it does |
| --- | --- |
| Light chain | Pistol shots. A chain of quick shots, the last one harder. One or two pistols is the builder's call |
| Heavy | Shotgun: a short-range spread of pellets, strong posture damage up close, weak at distance |
| Sprint attack (`dash`) | Builder's call; a sliding shot fits |
| Execution | Steps back from the staggered enemy and finishes it with a sniper shot, with a long tracer |
| Tool | Sticky bomb, 3 charges. Thrown; on hitting an enemy it sticks to it and moves with it. After 3 seconds it explodes, damaging everything in an area. If it hits a wall or the floor it sticks there. If the enemy dies first, it drops and still explodes. The blast also hurts the Enforcer at half damage, through `hurtPlayer`, so dodge invulnerability, block and parry apply (owner's decision) |
| Ability | Grappling hook, costs focus. Fired at the locked target, or the one `aimRanged` points at, within about 14 m and in line of sight. Light enemies (husk, spitter) are pulled to the player; heavy ones (brute, the boss) and the dummy pull the player to them. Either way the two end up in melee range with a moment to follow up |
| Trait | Builder's call, in the spirit of the class |

- **Figure:** a new branch in `makePlayerFig` with `f.rim` and `f.tips`; the
  shotgun and rifle may appear only while used. Idle arm pose and guard pose
  in `posePlayer`, and poses for any new `anim` names.
- **Moves:** new `MOVES` entries with `proj`. New projectile kinds (bullet,
  pellet, sticky bomb, hook line) need drawing where projectiles are drawn.
- **Execution:** the `execute` case of `playerUpdate` places the player
  `e.r + 1` from the enemy. For the Enforcer, place further back and draw a
  shot instead of the lance. Damage, healing and the dummy rule are unchanged.
- **Sounds:** gunshots, shotgun blast, bomb stick and beep, grapple fire and
  reel, all synthesised in `04_audio.js`.
- Numbers (health, stamina, damage, timings) are the builder's to set, aiming
  between the Ranger and the Fighter. Balance is untested by hand across the
  game, and this class will be tuned in playtest.

## Testing

- **New `tests/t18.mjs`**, hub mode, covering:
  - Interact opens and closes a plaque on keyboard and on a faked pad;
    a press away from the plaques does nothing.
  - The Enforcer's code unlocks it on keyboard, on a faked pad and, on a
    device run, through the touch D-pad and buttons. A wrong sequence does
    not. The sealed plaques accept nothing.
  - The unlock survives a reload; the picker shows the Enforcer only after.
  - Dodge migration: a saved `dodge: "Space"` becomes `"KeyB"`, and a save
    that already uses `KeyB` elsewhere is left alone.
  - Screenshots of the hall wall and of the close-up, checked by eye.
- **The code in tests.** `DF` gets a way to replace a plaque's stored hash
  with the hash of a test sequence. `t18` uses that for every code-entry
  check, so the mechanism is tested without the real code. One extra step
  checks the real code only when a gitignored local file (for example
  `tests/codes.local.json`) is present, and is skipped with a note otherwise.
  The builder creates that file for the owner. Nothing in the page decodes a
  code.
- Add the Enforcer to `tests/t6.mjs`.
- Run `t8` (hall), `t10` (HUD prompt), `t13` and `t14` on every device
  (touch D-pad in the layout), `t16` (pad bindings), `t17`.

## Docs to update

- README: controls tables (dodge on B and Circle, Interact on Space and A or
  Cross), and a line that the hall has plaques to inspect. No codes, no
  mention that plaques take codes.
- `CLAUDE.md`: Interact and its priority rule, plaques and `hubPlaques()`,
  the `inspect` player state, the `hidden` class flag and `u` in the save,
  the code hashing and the test hook, the touch D-pad in the layout, and
  `t18`.

## Left to the builder

- The Enforcer's code, numbers, colour, trait, sprint attack, figure and
  poses.
- Plaque look, epithets and emblems, and exact spacing on the wall.
- The hash function and the obfuscation of the test hook.
- Whether the unlock card offers "Switch now".
