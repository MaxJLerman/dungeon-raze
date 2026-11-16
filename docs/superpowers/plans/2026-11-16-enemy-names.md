# Enemy Names and Threat Colours Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every enemy shows its name on a black plate above its head, coloured white, orange or red by how it compares with the player, and a How to play screen and the README explain the colours.

**Architecture:** Each `EDEF` entry gets a fixed `threat` of 0, 1 or 2, read only through `threatOf(enemy)` so levels can replace it later. The pooled overhead bars in `HUD` gain a name element styled by a shared `.tag` class. A slot shows under today's rule (aware or hurt) or when the enemy is inside a look zone around the screen centre with line of sight.

**Tech Stack:** Plain JavaScript (ES2020), HTML and CSS HUD over a WebGL 2 canvas, Playwright with headless Chromium for tests.

**Spec:** `docs/superpowers/specs/2026-11-16-enemy-names-design.md`. Read it and `CLAUDE.md` before starting.

## Global Constraints

- All `src/*.js` files share one function scope. No imports or exports. Declare each name once across `src/`.
- No dependencies and nothing loaded at run time.
- Run `node build.mjs` after every source change. `dist/` is not committed.
- Tag text colours: white `#FFFFFF`, orange `#DB4D00`, red `#C40016`. Tag background `#000000`.
- No existing colour variable changes. The posture bar keeps `--ember` (`#ffb347`).
- Tier meanings, worded exactly: "weaker than you", "around your level or slightly above", "much stronger than you".
- Looking at an enemy never changes its state. The HUD only reads enemies.
- Enemy stats, AI and the ambush bonus do not change. `tests/t6.mjs` and `tests/t8.mjs` must still pass.
- Existing scripts `tests/t1.mjs` to `tests/t9.mjs` are not edited.
- Names are written with `textContent`, never `innerHTML`.
- Commits follow `CLAUDE.md`: no `Co-Authored-By` or session trailers.
- Screenshots are looked at, not assumed.

## Review Focus

Conditions the spec implies that are most likely to bite a player. Each is pinned by a test in the task named.

1. **Facing an enemy without tilting the camera.** At the resting pitch of 0.3 an enemy straight ahead sits above the screen centre. It must still count as looked at. Task 2, step "resting camera pitch still counts".
2. **A slot changing owner.** A slot that showed the red, barless boss and next shows a Husk must show "Husk" in white with its bars back. Task 1, step "a reused slot is rewritten".
3. **More enemies than slots.** With the pool full, the locked target must still have its tag and bars. Task 1, step "the locked target keeps a slot".
4. **An enemy dying while tagged.** Its tag goes with its bars. Task 1, step "a dead enemy loses its tag".
5. **Looking must not wake.** After frames spent looking at an unaware enemy it is still unaware and idle. Task 2, step "looking shows the tag and full bars".

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/06_game.js` | Modify | `threat` on every `EDEF` entry, `threatOf` |
| `src/08_hud.js` | Modify | Name element per slot, tier class, boss slot, boss bar name, look zone |
| `src/09_main.js` | Modify | `howto` screen state, `threatOf` on `DF` |
| `index.tpl.html` | Modify | `.tag` CSS, boss bar markup, How to play screen, buttons, title tips removed |
| `tests/t10.mjs` | Create | Logic tests for tags, colours, look zone, How to play |
| `tests/t11.mjs` | Create | Screenshots of tags and the How to play screen |
| `README.md`, `CLAUDE.md` | Modify | Colour key, new screen, recipe step, test table |

## Test conventions

`tests/t10.mjs` runs in `smoke` mode: `SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`.

The frame loop keeps drawing and calling `HUD.update` while `G.manual` is set, so a step changes state, waits two animation frames, then reads the DOM. `test.mjs` awaits a promise returned by a step. Every step is built with this helper:

```js
const step = (name, body) => ({
  name,
  eval: `(async () => { const { G, cam } = DF; G.manual = true;
  const draw = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const slots = () => [...document.querySelectorAll("#ebars .eb")].filter((d) => d.style.display !== "none").map((d) => { const t = d.querySelector(".tag"), cs = getComputedStyle(t); return { name: t.textContent, tier: [0, 1, 2].find((i) => t.classList.contains("t" + i)), nobar: d.classList.contains("nobar"), hp: d.querySelector("i").style.width, color: cs.color, bg: cs.backgroundColor }; });
  // One enemy of a type, unaware and unhurt, dist metres in front of the
  // player in the first room. Every other enemy is parked out of range.
  // off turns the camera away by that many radians. Without a pitch the
  // camera centre is put on the enemy's body.
  const stage = (type, dist = 6, off = 0, pitch) => { DF.newRun(99); DF.show("play"); const p = G.player, n = G.world.nodes.find((q) => q.kind === "room"), e = G.enemies.find((q) => q.type === type); for (const o of G.enemies) if (o !== e) o.x += 1000; e.x = n.x; e.z = n.z + dist / 2; e.aware = false; e.state = "idle"; e.hp = e.def.hp; p.x = n.x; p.z = n.z - dist / 2; p.yaw = 0; p.lock = null; cam.yaw = off; cam.pitch = pitch === undefined ? Math.atan2(1.62 - e.def.top * 0.55, dist) : pitch; cam.px = p.x; cam.pz = p.z; cam.cd = 5.6; return e; };
  ${body} })()`,
});
```

Every step returns `{ pass, ... }` with the checked values included so a failure is readable. If seed 99 lacks an enemy type, use another seed in `stage` and say so in a comment.

Colour strings as the browser reports them: white `rgb(255, 255, 255)`, orange `rgb(219, 77, 0)`, red `rgb(196, 0, 22)`, black `rgb(0, 0, 0)`.

---

### Task 1: Threat tiers and name tags

Tags appear under today's bar rule only. The look zone comes in Task 2.

**Files:**
- Create: `tests/t10.mjs`, `tests/t11.mjs`
- Modify: `src/06_game.js` (`EDEF`), `src/08_hud.js` (`init`, boss bar and enemy bars blocks of `update`), `src/09_main.js` (`window.DF`), `index.tpl.html` (CSS near `#ebars`, `#boss` markup), `README.md`, `CLAUDE.md`

**Interfaces:**
- Produces: `threatOf(e)` returning `0 | 1 | 2`, where `e` is an enemy object with a `def`. Exposed as `DF.threatOf`.
- Produces: CSS classes `.tag` with `.t0`, `.t1`, `.t2`, usable on any inline element.
- Produces: each `#ebars .eb` contains one `.tag` element followed by the existing `<i>` (health) and `<b>` (posture). Class `nobar` on `.eb` hides the bar box and both fills.
- Produces: `#bossNm`, a `.tag` inside `#boss .nm`.

- [ ] **Step 1: Commit the design and plan**

```bash
git add docs/superpowers/specs/2026-11-16-enemy-names-design.md docs/superpowers/plans/2026-11-16-enemy-names.md
git commit -m "docs: design and plan for enemy names"
```

- [ ] **Step 2: Write the failing tests in `tests/t10.mjs`**

Use the helper above. Steps and their assertions:

| Step name | Setup | Passes when |
| --- | --- | --- |
| threat tiers | none | `DF.EDEF` threat is 0 for `husk`, `spit`, `dummy`; 1 for `brute`; 2 for `warden`; every entry has a threat of 0, 1 or 2; `DF.threatOf({ def: DF.EDEF.brute }) === 1` |
| an aware husk has a white tag | `stage("husk", 6, 0.5)`, `e.aware = true`, `await draw()` | `slots()` is one entry: name `Husk`, tier 0, `nobar` false, color white, bg black |
| an aware brute has an orange tag | same with `"brute"` | one entry: name `Brute`, tier 1, color `rgb(219, 77, 0)` |
| a hurt spitter has a white tag | `stage("spit", 6, 0.5)`, `e.hp -= 1` | one entry: name `Spitter`, tier 0 |
| the boss has a red tag and no small bars | `stage("warden", 10, 0.3)`, `e.aware = true` | one entry: name `The Ossuary Warden`, tier 2, `nobar` true, color `rgb(196, 0, 22)`; `#boss` has class `show`; `#bossNm` text is `The Ossuary Warden` and it has classes `tag` and `t2` |
| an unnoticed enemy off to the side has no tag | `stage("husk", 6, 0.5)` | `slots().length === 0` |
| a reused slot is rewritten | boss step's setup, `await draw()`, then the husk step's setup, `await draw()` | one entry: name `Husk`, tier 0, `nobar` false |
| a dead enemy loses its tag | husk step's setup, `await draw()`, `DF.hitEnemy(e, 9999, 0, { src: "melee" })`, `await draw()` | `e.dead === true` and `slots().length === 0` |
| the locked target keeps a slot | `stage("brute", 6, 0.5)`; take 12 non-boss, non-brute enemies, move each to `e.x + i * 0.05, e.z`, set them aware; `G.enemies = [...those12, e]`; `e.aware = true`; `G.player.lock = e` | `slots().length === 10` and one entry is named `Brute` |
| the posture bar keeps its colour | husk step's setup | `getComputedStyle(document.documentElement).getPropertyValue("--ember").trim() === "#ffb347"` and the computed background of the slot's `<b>` is `rgb(255, 179, 71)` |
| the dummy has a white tag | `DF.enterHub(); DF.show("play")`, stand 4 metres south of the dummy as `tests/t8.mjs` does, `cam.yaw = 0.5` | one entry: name `Training dummy`, tier 0 |

In "the locked target keeps a slot" the lock pulls the camera toward the target each frame. That is fine: the step only checks which enemies hold slots.

- [ ] **Step 3: Run the tests to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: the steps that expect a tag or a threat value print `FAIL`, and the last line is `N failed`. "an unnoticed enemy off to the side has no tag" passes already, and "the posture bar keeps its colour" fails only because `slots()` finds no `.tag` yet.

- [ ] **Step 4: Add threat data in `src/06_game.js`**

Add `threat` to each `EDEF` entry with the values in the "threat tiers" test. Next to `EDEF`, add:

```js
// How an enemy compares with the player: 0 weaker, 1 around the player's
// level or slightly above, 2 much stronger. Fixed per type until levels
// exist; then this compares levels and nothing else needs to change.
function threatOf(e) {
  return e.def.threat;
}
```

Nothing else reads `def.threat`. Add `threatOf` to `window.DF` in `src/09_main.js`.

- [ ] **Step 5: Add the tag styles and boss bar markup in `index.tpl.html`**

- `.tag`: inline block, background `#000`, padding `1px 6px 2px`, `var(--body)` at 13px, weight 600, letter spacing 0.1em, uppercase, no wrapping, line height 1.25.
- `.tag.t0` colour `#fff`. `.tag.t1` colour `#db4d00`. `.tag.t2` colour `#c40016`, `var(--display)` at 16px.
- `#ebars .eb .tag`: absolutely positioned, centred on the bar, its bottom edge 4px above the bar's top.
- `#ebars .eb.nobar`: no background and no outline; its `<i>` and `<b>` are not displayed.
- Replace the hard-coded boss name with `<div class="nm"><span class="tag t2" id="bossNm"></span></div>`. `#boss .nm .tag` is 20px with padding `2px 10px`. Remove the `text-shadow` from `#boss .nm`.

- [ ] **Step 6: Draw the tags in `src/08_hud.js`**

- `init`: the pool is 10 slots. Each slot is `<span class="tag"></span><i></i><b></b>` and its record also holds the tag element, a cached name and a cached tier.
- Boss bar block: when the shown boss changes, set `#bossNm` text from `boss.def.name` and its class to `tag t` + `threatOf(boss)`.
- Enemy bars block, for each candidate enemy:
  - Visit the lock target first if there is a living one, then `G.enemies` in order, skipping the lock target.
  - Skip if dead, not `vis`, farther than 26, or `R.toScreen` returns null. Bosses are no longer skipped.
  - Show if `e.aware || e.hp < e.def.hp`.
  - Write the name and the `t0`/`t1`/`t2` class only when the cached name or tier differs.
  - Toggle `nobar` on the slot with `!!e.def.boss`.
  - Position, bar widths and `stag` stay as they are.

- [ ] **Step 7: Run the tests to see them pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: last lines `no errors` and `all passed`.

- [ ] **Step 8: Run the existing suites**

Run: `SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke` and `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`
Expected: both end `all passed`.

- [ ] **Step 9: Write `tests/t11.mjs` and look at the screenshots**

Follow `tests/t9.mjs`: synchronous steps with `wait: 700` and a `shot`. Run in `smoke` mode. Shots:

| Shot | Scene |
| --- | --- |
| `tags_pack` | A Husk, a Spitter and a Brute about 1.5 metres apart, 6 metres ahead, all aware, camera pitch 0.3 |
| `tags_boss` | The Warden and a Brute side by side, 9 metres ahead, both aware, camera pitch 0.2 |
| `tags_dummy` | The hall, 4 metres from the dummy |

Run: `SCRIPT=$PWD/tests/t11.mjs node test.mjs smoke`, then open the three files in `shots/`.
Check: every tag is readable and centred over its enemy; orange and red are told apart at a glance in `tags_boss`; the red text is legible on black; the long boss name is not clipped; the tag does not overlap the bar. If red reads dim, raise the `.t2` size or weight and re-shoot. Do not change the hex values.

- [ ] **Step 10: Update the documents**

`README.md`, under "What is in the game", after the Enemies entry:

```markdown
- **Enemy names:** every enemy shows its name on a black plate above its head
  when it notices you or when you look at it. The colour of the name compares
  the enemy with you. White: weaker than you (Husk, Spitter, training dummy).
  Orange: around your level or slightly above (Brute). Red: much stronger than
  you (the Ossuary Warden). Levels are not implemented yet, so today the
  colour is fixed per enemy type.
```

Add `tests/t10.mjs` ("Enemy name tags, threat colours, look zone, How to play screen") and `tests/t11.mjs` ("Screenshots of the name tags and the How to play screen") to the tests table, and "name tags" to the `src/08_hud.js` row.

`CLAUDE.md`:
- Enemies section: `threat` on `EDEF` is 0, 1 or 2 and is read only through `threatOf(e)`, which is where levels will plug in. The tag colours are `.tag.t0`, `.t1`, `.t2` in `index.tpl.html`.
- "Add an enemy" recipe, step 1: set `threat`.
- Testing section: run `tests/t10.mjs` after any change to the HUD, enemy tags or menus, and `tests/t11.mjs` to look at them.

- [ ] **Step 11: Commit**

```bash
git add src index.tpl.html tests/t10.mjs tests/t11.mjs README.md CLAUDE.md
git commit -m "feat: enemy name tags coloured by threat"
```

---

### Task 2: Looking at an enemy shows its tag

**Files:**
- Modify: `src/08_hud.js` (enemy bars block), `tests/t10.mjs`, `tests/t11.mjs`, `CLAUDE.md`

**Interfaces:**
- Consumes: the slot loop and `.tag` elements from Task 1.
- Produces: nothing other tasks use.

- [ ] **Step 1: Add the failing tests to `tests/t10.mjs`**

| Step name | Setup | Passes when |
| --- | --- | --- |
| looking shows the tag and full bars | `stage("husk")`, `await draw()`, `await draw()` | one entry: name `Husk`, tier 0, hp `100%`; `e.aware === false`; `e.state === "idle"` |
| resting camera pitch still counts | `stage("husk", 12, 0, 0.3)` | one entry named `Husk` |
| a wall hides the tag | `stage("husk")`, `G.world.los = () => false` | `slots().length === 0` |
| beyond 26 metres there is no tag | `stage("husk")`, `e.z = G.player.z + 30`, `cam.pitch = Math.atan2(1.62 - e.def.top * 0.55, 30)`, `G.world.los = () => true` | `slots().length === 0` |
| a pack in the zone all show | `stage("husk")`, bring one parked Spitter to `e.x, e.z + 1.5`, unaware | two entries, names `Husk` and `Spitter` |
| looking at the boss shows only its tag | `stage("warden", 10)` | one entry: tier 2, `nobar` true; `#boss` does not have class `show` |

The step "an unnoticed enemy off to the side has no tag" from Task 1 stays and covers looking away.

- [ ] **Step 2: Run the tests to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: `FAIL` on the four steps that expect a tag; the two that expect none pass already.

- [ ] **Step 3: Add the look zone in `src/08_hud.js`**

Add a function inside `HUD`, `looked(e, s)`, where `s` is the slot's screen point already computed at `e.def.top + 0.25`. It returns true when all hold:

- `m = R.toScreen(e.x, e.y + e.def.top * 0.55, e.z)` is not null.
- With `H = canvas.clientHeight`, `W = canvas.clientWidth` and `hh = Math.abs(m[1] - s[1])`:
  `Math.abs(m[0] - W / 2) < 0.1 * H + 0.5 * hh` and `Math.abs(m[1] - H / 2) < 0.28 * H + hh`.
- `G.world.los(G.player.x, G.player.z, e.x, e.z)`.

Test the screen box before `los`, which is the costly part. The show rule becomes `e.aware || e.hp < e.def.hp || looked(e, s)`. The function reads and never writes.

- [ ] **Step 4: Run the tests to see them pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: `no errors`, `all passed`.

- [ ] **Step 5: Run the existing suites**

Run: `SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke` and `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`
Expected: both end `all passed`.

- [ ] **Step 6: Add a screenshot and look at it**

Add to `tests/t11.mjs`: `tags_look`, an unaware Brute 10 metres ahead at camera pitch 0.3 with nothing else near.
Run: `SCRIPT=$PWD/tests/t11.mjs node test.mjs smoke`
Check: the Brute carries an orange tag and full bars while standing idle.

- [ ] **Step 7: Document and commit**

`CLAUDE.md`, HUD or Enemies notes: a slot shows when the enemy is aware, hurt, or inside the look zone in `looked` in `08_hud.js`; the zone is a tall box because the resting camera looks down; the HUD never changes enemy state.

```bash
git add src/08_hud.js tests/t10.mjs tests/t11.mjs CLAUDE.md
git commit -m "feat: show an enemy's name when the player looks at it"
```

---

### Task 3: How to play screen

**Files:**
- Modify: `index.tpl.html` (title and pause screens, new screen, CSS), `src/09_main.js` (`SCREENS`, `show`, `openMenu`, the Escape handler), `tests/t10.mjs`, `tests/t11.mjs`, `README.md`, `CLAUDE.md`

**Interfaces:**
- Consumes: `.tag`, `.t0`, `.t1`, `.t2` from Task 1.
- Produces: state `"howto"` and screen `#scr-howto`, opened with `openMenu("howto")`.

- [ ] **Step 1: Add the failing tests to `tests/t10.mjs`**

| Step name | Actions | Passes when |
| --- | --- | --- |
| how to play opens from the title | `DF.show("title")`, click `#scr-title [data-open="howto"]` | `G.state === "howto"`; `#scr-howto` has class `show`; `#hud` does not have class `show`; after clicking `#scr-howto [data-back]`, `G.state === "title"` |
| how to play opens from pause | `DF.show("play")`, `DF.show("pause")`, click `#scr-pause [data-open="howto"]` | `G.state === "howto"`; `#hud` has class `show`; after dispatching a `keydown` with code `Escape` on `window`, `G.state === "pause"` |
| the colour key is right | none | `#scr-howto .tag` are three elements with `t0`, `t1`, `t2` in that order and computed colours white, `rgb(219, 77, 0)`, `rgb(196, 0, 22)`, each on `rgb(0, 0, 0)`; the screen's text contains "weaker than you", "around your level or slightly above" and "much stronger than you" |
| the tips moved | none | `document.querySelector("#scr-title .tips") === null`; `#scr-howto` text contains "Pale flash", "Orange bar full" and "Shrines" |

- [ ] **Step 2: Run the tests to see them fail**

Run: `node build.mjs && SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: the four new steps print `FAIL`.

- [ ] **Step 3: Add the screen to `index.tpl.html`**

- Add `<button type="button" data-open="howto">How to play</button>` before the Controls button on the title screen and on the pause screen.
- Remove the `<ul class="tips">` from the title screen.
- Add `#scr-howto` with classes `scr wide`, after `#scr-controls`:
  - `<h1 class="sm">How to play</h1>`
  - Heading "Enemy names".
  - Paragraph: "A name appears above an enemy when it notices you or when you look at it. The colour of the name compares that enemy with you."
  - A list of three rows, each an example tag then its meaning:
    - `<span class="tag t0">Husk</span>` "White name: weaker than you."
    - `<span class="tag t1">Brute</span>` "Orange name: around your level or slightly above."
    - `<span class="tag t2">The Ossuary Warden</span>` "Red name: much stronger than you."
  - Heading "Combat".
  - The three tips removed from the title screen, unchanged, in a `<ul class="tips">`.
  - `<div class="row"><button type="button" data-back="1">Back</button></div>`
- Add a style for the two section headings that fits the existing screens: `var(--display)`, smaller than `h1.sm`, colour `var(--bone)`.

- [ ] **Step 4: Wire the state in `src/09_main.js`**

- Add `"howto"` to `SCREENS`.
- `show`: the HUD stays visible for `howto` under the same condition as `class` and `controls`.
- `openMenu`: `menuBack` is not overwritten when already in `howto`; `renderControls` runs only for `controls` and `renderPicker` only for `class`.
- The Escape handler that closes `class` and `controls` also closes `howto`.

- [ ] **Step 5: Run the tests to see them pass**

Run: `node build.mjs && SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`
Expected: `no errors`, `all passed`.

- [ ] **Step 6: Run the existing suites**

Run: `SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke` and `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`
Expected: both end `all passed`.

- [ ] **Step 7: Add screenshots and look at them**

Add to `tests/t11.mjs`: `m_howto` (opened from the title) and `m_howto_pause` (opened from pause in the cave).
Run: `SCRIPT=$PWD/tests/t11.mjs node test.mjs smoke`
Check `shots/m_howto.png`, `shots/m_howto_pause.png` and `shots/title.png`: the three example tags match the in-world tags; nothing overflows at 1280 by 720; the title screen looks balanced without its tips and its three buttons fit on one row.

- [ ] **Step 8: Document and commit**

`README.md`: add "a How to play screen with the name colour key and combat tips" to the Menus entry, and `howto` to the `index.tpl.html` row's list of screens.
`CLAUDE.md`: add `howto` to the list of `G.state` values.

```bash
git add src/09_main.js index.tpl.html tests/t10.mjs tests/t11.mjs README.md CLAUDE.md
git commit -m "feat: How to play screen with the name colour key"
```
