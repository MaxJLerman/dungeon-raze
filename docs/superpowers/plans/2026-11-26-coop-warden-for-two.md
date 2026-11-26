# The Warden for two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In a cave built for two co-op players the Warden has 1,550 health and four phases (attention, an aftershock, a grab only the other player can break, a sealed and darkened chamber), and every other Warden is exactly today's.

**Architecture:** `coopTwoDefs()` already gives a world for two its own enemy definitions. The Warden's entry there becomes a richer one built from a single table, `WARDEN2`: phase marks, an `after` on its slam, a `seize` attack and the flag `duo`. `EDEF.warden` is never edited. Core gains small data-driven generalisations whose defaults are today's behaviour (phase marks, an attack's first phase, a hold's length). What only this fight does lives in `EBEH.warden` hooks and in the host (`06d`), which knows the two players. Each page judges the aftershock and the seize on its own player; the host decides the hold's end and when the seal falls. The seal is rock in the field laid by one function from `world.boss`, so the host and both pages cannot differ.

**Tech Stack:** Plain JavaScript in `src/` (one shared function scope), `node build.mjs`, Node tests (`tests/coop-*.mjs`), Playwright page tests through `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-26-coop-warden-for-two-design.md`. Read it first. Then `docs/notes/coop.md`, `docs/notes/enemies.md`, `docs/notes/d-enemies.md` (the hooks), `docs/notes/player.md` (holds), and for Tasks 5 and 6 `docs/notes/world.md` (rock), `docs/notes/crocodile.md` (the falling ceiling) and `docs/notes/rendering.md`.

## Global Constraints

- `node build.mjs` after every source change; tests run against `dist/index.html`.
- All `src/*.js` share one scope: declare a name once across `src/`. Nothing outside `src/dev/` names anything declared there.
- The host copy is the files matching `^0[1-6]`. It loads in Node and in a Worker and names nothing from `07` on that could run there. `node tests/t26-build.mjs` passes after every task; a new name it reports goes on `HOST_MAY_NAME` only with the reason it cannot run on the host.
- `EDEF.warden` is not edited. A Warden whose definition has no `duo` runs today's code path: with `NET` `null` nothing new runs, and the solo Warden's tests (`tests/t10.mjs`, `t11`, `t12`) pass unedited.
- Shared code changes only by data with defaults that are today's values: `def.marks` (default `[0.5]`), an attack's `from` (default 1; `p2: true` still means 2), a roar's length (default 1.2 s), `grabPlayer`'s `max` (default `HOLD.max`) and `mash` (default `true`). `tests/t23.mjs`, `t24` and `t25` (D's holds and the crocodile) pass unedited.
- Behaviour only this fight has is a hook in `EBEH.warden` that returns at once unless `e.def.duo`, or host code in `06d`. No branch on a type in `enemyUpdate`. Core reads `NET` only in places `coop.md` lists; a new place is added to that list in the same commit.
- Damage to a player goes through `hurtPlayer`, a hold through `grabPlayer`, every move of an enemy through `eStep` (a body pushed out of fresh rock uses `world.resolve`, as the cave-in does).
- Rubble is only ever a change to the field: `world.addRock` and `removeRock`. No reader gets a seal check.
- Every number of the fight is in `WARDEN2` (`06b`). `COOP_TWO.bossHp` becomes 2.5; nothing else in `COOP_TWO` changes. `COOP_V` goes from 3 to 4.
- New per-run state (`G.waves`, `G.seal`, `G.dark`) is cleared in `resetRun()`. `respawn` clears `G.waves`; it keeps `G.seal` and lays its rock again (below).
- `tests/t22.mjs` and `tests/t31.mjs` hashes are not edited: no generator changes.
- Notes go in the same commit as the code they describe.
- Never read, print or copy any `tests/codes.local.*` file. Never write a plain plaque code anywhere. No names or moves from the series the owner named as inspirations.
- Commits: `feat:` / `test:` / `docs:` / `refactor:` prefixes, no `Co-Authored-By` or `Claude-Session` trailers, no em dashes and no ", and" in messages.
- A page test step fails the run when it returns an object whose `pass` is not `true`. Node tests print `ok` or `FAIL` lines and end `all passed`.
- Failures older than this work, not this plan's to fix (`docs/notes/status.md`, backlog 11 and 12): `touch-all t14`, `touch-all t29 title` on four short phones, the flaky `coop-host` check "nothing on the host hurts or moves a proxy" and the flaky `t25` check "rubble never traps it".

## Measured before planning (a guide, not a target)

- The chamber (`world.boss`, radius 16.5) over big caves 1 to 60: 16 m of open floor round its centre; one tunnel in on 33 caves, two on 27.
- A ring of 24 capsules of radius 1.4 m end to end on a circle of radius 12.5 m, over big caves 1 to 200: no way through for a body of radius 0.4 on any; a body of radius 0.45 can stand out to 10.6 m from the centre on every heading; laying it costs 1.5 to 4.8 ms. With 18 capsules it also closed (120 caves) but the heaps `drawChunks` draws are 3.6 m long against 4.4 m segments, so 24 is used (3.3 m segments).
- The door spot (on the line from the centre toward `nodes[path[path.length - 2]]`, 9.1 m out) was clear of rock on all 200.
- Today a hit from a player the enemy can see sets its target to that player (`ASK.hit` in `06d`), so today's Warden turns on every hit. The attention rule replaces that for the Warden for two only.
- A page's `respawn` runs `G.world.clearRocks()` and empties `G.chunks`. A sealed page must lay the seal again there.
- `heldUpdate` frees the player the moment its holder's state is not `"hold"`. A puppet's state comes from snapshots, so the page must hold the puppet in `"hold"` as a guess (`e.ov`) until the host has answered.

## Review Focus

1. **A dropped connection in the sealed fight.** One player on the death screen and the other away for two seconds: the Warden stays where it is at the health it had, the rock stands, and the fight goes on when a player is live. (Task 5, `coop-warden`.)
2. **A page that respawns while sealed.** Its own `respawn` clears every rock. After it the ring is back in that page's field, the player stands at the door spot and cannot walk out. (Task 5, `t32`.)
3. **A seize the host refuses** (the page judged it late, or a tampered event): the page's player is free again within the guess's life, takes no crush, and the Warden never enters `"hold"`. (Task 4, `coop-warden` and `t32`.)
4. **The held player's page goes quiet.** The holder must not stand in `"hold"` for ever: the hold ends when its player is away. (Task 4, `coop-warden`.)
5. **A friend who joins or rejoins during phase 4.** The world description says the seal stands; the page lays the rock before its first frame and its player is at the door spot, in the dark. (Task 5, `coop-warden` and `t32`.)

---

### Task 0: Record the plan

- [ ] **Step 1: Amend the spec** where measurement changed it: the ring is 24 capsules (not 18); the held player is drawn against the Warden's chest while their position stays on the floor in front of it (the player has no height of their own).
- [ ] **Step 2: Commit.**

```bash
git add docs/superpowers/specs/2026-11-26-coop-warden-for-two-design.md docs/superpowers/plans/2026-11-26-coop-warden-for-two.md
git commit -m "docs: plan for the Warden for two"
```

---

### Task 1: Four phases, the health and the wire

Nothing new attacks yet. After this task the Warden for two has 1,550 health, roars at three marks and is in phase 4 below a quarter; phases 3 and 4 add nothing until later tasks.

**Files:**
- Modify: `src/06b_ebeh.js` (`WARDEN2`), `src/06c_coopwire.js` (`COOP_TWO.bossHp`, `coopTwoDefs`, the snapshot's flags, `COOP_V`), `src/06_game.js` (`hitEnemy`'s phase change, `chooseAtk`, the roar case, readers of `e.phase === 2`), `src/06d_coophost.js` (the `roar` event, `host.phase`), `src/07c_coopclient.js` (`roar`, the tempo), `src/07_render.js` (readers of `e.phase === 2`), `src/08_hud.js` and the page's markup and CSS for the boss bar's notches
- Create: `tests/coop-warden.mjs`, `tests/t32.mjs`
- Modify: `tests/coop-wire.mjs`, `tests/t29.mjs` (the version), any test that pins 1,116 health, `README.md` (test table), `CLAUDE.md` (table row for the Warden for two: `coop.md`, `enemies.md`; run `coop-warden`, t32)
- Modify: `docs/notes/coop.md`, `docs/notes/enemies.md`

**Interfaces:**
- Produces: `WARDEN2` in `06b`, the fight's one table. This task fills `hp: 2.5`, `marks: [0.75, 0.5, 0.25]`, `roar: { 4: 2.2 }` (seconds, by phase entered) and `lines: { 2: "The Warden burns hotter", 3: "The Warden reaches for you", 4: "The way out is gone" }`. Later tasks add their keys.
- Produces: the Warden's entry of `coopTwoDefs()`: `Object.create(EDEF.warden)` with own `hp` 1550, `posture` 210, `duo: true`, `marks`, `roarT` (from `WARDEN2.roar`) and its own `atks` object holding the same attack objects in the same key order (later tasks replace `slam` and append `seize`). Every other entry is as today.
- Produces: `def.marks` in `hitEnemy`: for a boss without `ownPhases`, the phase is 1 plus the number of marks the health is below; when that is above `e.phase` the enemy enters it with today's roar (state, posture cleared, sound, shake, ring), once per hit whatever the number of marks crossed. A phase never falls here. The roar lasts `def.roarT[phase]` or 1.2 s.
- Produces: an attack's `from`: `chooseAtk` leaves out an attack whose first phase (`a.from`, or 2 for `p2`, else 1) is above `e.phase`.
- Produces: every reader of "second phase" (`spdMul`, `tm`, the page's tempo, the glow and sprite in `07_render.js`) reads `e.phase >= 2`.
- Produces: the snapshot's flags byte carries `phase - 1` in bits 5 and 6; bit 1 is no longer set. `coopSnapDecode` gives `phase` 1 to 4.
- Produces: the host's event `["roar", eid, t, phase]`, sent whenever a boss's phase rises. The page says `WARDEN2.lines[phase]` for a `duo` definition and today's line otherwise.
- Produces: `host.phase(n)`, for tests and the dev menu: puts the living Warden for two at the start of phase `n` (2 to 4) exactly as a hit crossing that mark would, events included; returns the enemy or `null`.
- Produces: three notches on the boss bar at a definition's `marks`, none without them.

- [ ] **Step 1: Write `tests/coop-warden.mjs`** (run with `node build.mjs && node tests/coop-warden.mjs`), with helpers `duo()` (a host from `loadHost()` started with `{ seed: 99, grade: "E", two: true }`, two `fakeClient`s, returns `{ h, a, b, boss }`), `inChamber(h, d, ang)` (a walkable point `d` metres from the chamber's centre) and `strike(c, boss, dmg)` (the `hit` event). Checks:
  - "the Warden for two has 1,550 health, 210 posture and three marks": `boss.def.hp === 1550`, `boss.def.posture === 210`, `boss.def.duo === true`, `deepEqual(boss.def.marks, [0.75, 0.5, 0.25])`.
  - "the solo definition is untouched": `h.EDEF.warden.hp === 620`, and none of `duo`, `marks`, `roarT` is an own or inherited key of `h.EDEF.warden`; `Object.keys(boss.def.atks)` starts with `Object.keys(h.EDEF.warden.atks)` in order.
  - "a cave for one has today's Warden": a host started without `two`, one client: the Warden's `def === h.EDEF.warden`; one hit taking it below half sends one `roar` with phase 2; no hit takes it to phase 3.
  - "it roars once at each mark": hits that leave 1,160, then 770, then 380 health give phases 2, 3, 4 and one `["roar", id, t, phase]` each to both clients.
  - "one hit across two marks roars once": from full health a hit to 700 (after raising `COOP.MAX_DMG`-sized hits as needed) gives phase 3 and exactly one roar, phase 3.
  - "a phase does not go back": at phase 3 set `boss.hp = boss.def.hp`; the next small hit leaves phase 3.
  - "the phase 4 roar lasts 2.2 s": after entering phase 4 the state is `"roar"` at 2.1 s of ticks and not at 2.3 s; a phase 2 roar is over by 1.3 s.
  - "host.phase(n) is a hit across the mark": on a fresh host `h.phase(3)` leaves phase 3, health just under 775 and one roar event.
- [ ] **Step 2: Extend `tests/coop-wire.mjs`:** phases 1 to 4 survive `snapEncode` then `snapDecode` with `aware`, `dead` and `pin` unchanged beside them; `h.v === 4`.
- [ ] **Step 3: Run both; expect the new checks to FAIL** (`hp` 1116, no `marks`, phase decodes as 1 or 2).
- [ ] **Step 4: Implement** the table, the definition, the marks, `from`, the roar length, the `>= 2` readers, the wire and `host.phase`. Change `COOP_V` to 4 and the literals in `tests/t29.mjs`.
- [ ] **Step 5: Run** `node tests/coop-warden.mjs`, `node tests/coop-wire.mjs`, `node tests/coop-host.mjs`, `node tests/coop-e2e.mjs`, `node tests/t26-build.mjs`. Expected: `all passed`. Fix any co-op test that pinned 1,116 to read `boss.def.hp`.
- [ ] **Step 6: The notches.** Write `tests/t32.mjs` (run with `SCRIPT=$PWD/tests/t32.mjs node test.mjs smoke`) with a helper that starts `DF.coopSolo({ two: true, seed: 99, mate: "idle" })`, stands this player in the chamber and wakes the Warden. First step, "the boss bar shows three notches for two and none alone": three notch elements at 75%, 50% and 25% of the bar's width in the run for two; after `DF.coopSolo({ seed: 99 })` none. Screenshot `t32-bar`. Implement in `08_hud.js`.
- [ ] **Step 7: Run** `t32`, then `SCRIPT=$PWD/tests/t10.mjs node test.mjs smoke`, `t11`, `t12`, `t27`, `t28`. Expected: all pass, none of the older scripts edited except for the version.
- [ ] **Step 8: Notes and commit.** `coop.md`: the table's new value, the definition, the phase bits, `COOP_V` 4, the `roar` event, `host.phase`. `enemies.md`: `marks`, `from`, `roarT` under the boss flags.

```bash
git commit -m "feat: four phases and 1,550 health for the Warden for two"
```

---

### Task 2: Attention

Host only. The Warden for two hunts whoever has hurt it most lately.

**Files:**
- Modify: `src/06b_ebeh.js` (`WARDEN2.heed`), `src/06d_coophost.js` (`pick`, `ASK.hit`, `enemies`)
- Modify: `tests/coop-warden.mjs`, `docs/notes/coop.md`

**Interfaces:**
- Consumes: `e.def.duo`, `px.inBoss`, `live(px)`.
- Produces: `WARDEN2.heed = { half: 4, lead: 1.3, every: 3 }`: seconds for a score to halve, how many times the target's score the other needs, seconds between changes.
- Produces: on the host, `e.heed`, a score per pid for a `duo` boss: each accepted hit adds the health it took off; every tick each score is multiplied by `0.5 ** (dt / half)`. Cleared when the enemies are made again.
- Produces: `pick(e)` for a `duo` boss. Candidates are live players in the chamber. With two candidates the target stays, and changes to the other only when the other's score is above zero and at least `lead` times the target's, `every` seconds have passed since its last change, and its state is not `"wind"`, `"act"` or `"hold"`. With fewer than two candidates, or no score on either, today's rule decides. `ASK.hit` no longer sets the target of a `duo` boss.

- [ ] **Step 1: Add the failing checks:**
  - "it turns on the player who has hurt it more": both in the chamber 6 m either side, target is `a`; `b` deals 60 over one second, `a` nothing; within 3.5 s the target is `b`.
  - "it does not turn back inside three seconds": straight after that change `a` deals 200; the target is still `b` 2.5 s after the change and is `a` by 4 s.
  - "it does not turn mid-swing": force `boss.state = "wind"` with an attack; `b` out-damages; the target is unchanged until the state leaves `"wind"` and `"act"`.
  - "a lead under 1.3 does not turn it": scores 100 and 120.
  - "a score halves in four seconds": one hit of 80, then 4 s of ticks: the score is between 38 and 42.
  - "with one player dead, away or outside it hunts the other whatever the scores".
  - "a husk still turns on whoever hit it": today's rule for a non-boss, unchanged.
- [ ] **Step 2: Run; expect FAIL.** **Step 3: Implement.** **Step 4: Run** `coop-warden`, `coop-host`, `coop-e2e`: `all passed`.
- [ ] **Step 5: Notes and commit.**

```bash
git commit -m "feat: the Warden for two hunts whoever hurt it most"
```

---

### Task 3: The aftershock

**Files:**
- Modify: `src/06b_ebeh.js` (`WARDEN2.wave`), `src/06c_coopwire.js` (the definition's `slam`), `src/06_game.js` (`G.waves`, `waveStart`, `wavesUpdate`, the slam's landing, `resetRun`, `respawn`), `src/07c_coopclient.js` (the puppet's slam landing), `src/07_render.js` or `src/07b_dfx.js` (drawing)
- Modify: `tests/coop-warden.mjs`, `tests/t32.mjs`, `docs/notes/coop.md`, `docs/notes/enemies.md`, `docs/notes/rendering.md`

**Interfaces:**
- Produces: `WARDEN2.wave = { from: 2, wait: 0.35, speed: 11, reach: 24, band: 1.2, dmg: 14 }`.
- Produces: the definition's `slam` is a copy of `EDEF.warden.atks.slam` with `after: WARDEN2.wave`, at the same key position.
- Produces: `G.waves`, a list of `{ x, z, t, o, hit }` (`o` the `after` object, `hit` whether it has been judged on this player).
- Produces: `waveStart(x, z, o)` pushes one. Called where a slam lands, when `a.after && e.phase >= a.after.from`: in `enemyUpdate`'s slam landing and in `coopPuppet`'s.
- Produces: `wavesUpdate(dt)`, called from `update` beside `shocksUpdate`. The ring's radius is `(t - o.wait) * o.speed`. On the step in which the radius passes this player's distance from `(x, z)` (within half of `o.band`), it calls `hurtPlayer(o.dmg, null, { dmg: o.dmg, px: x, pz: z })` once and sets `hit`. A wave is dropped when its radius passes `o.reach`. On the host `hurtPlayer` returns `"remote"`.
- Produces: the ring drawn at its judged radius in the Warden's red, `o.band` deep.

- [ ] **Step 1: Failing checks in `coop-warden`:** "the slam for two carries an aftershock and the solo slam does not" (`boss.def.atks.slam.after.dmg === 14`; `h.EDEF.warden.atks.slam.after === undefined`; the key order of `atks` is unchanged).
- [ ] **Step 2: Failing steps in `t32`,** each making the Warden slam at phase 2 with this player 12 m from where it lands (set the puppet's attack through the host: `host.phase(2)`, then force a slam on the host's Warden and step):
  - "the aftershock hurts a player it passes": health falls by 14 (less the class's armour if any) between 1.2 and 1.7 s after the landing, once.
  - "a dodge through it takes nothing" (the player in `dodge` with `iframe` as the ring arrives).
  - "a guard facing it blocks": `hurtPlayer`'s result counted in `CC.judged.block` or read from stamina.
  - "phase 1 has no aftershock": `G.waves.length === 0` after a phase 1 slam.
  - "a respawn and a new world clear it".
  Screenshot `t32-wave` with the ring half way out.
- [ ] **Step 3: Run; expect FAIL.** **Step 4: Implement.**
- [ ] **Step 5: Run** `coop-warden`, `t32`, `t10`, `t11`, `t27`, `t26-build`. Look at `t32-wave`: the ring must read against the floor.
- [ ] **Step 6: Notes and commit.**

```bash
git commit -m "feat: every slam of the Warden for two sends an aftershock"
```

---

### Task 4: The grab

**Files:**
- Modify: `src/06_game.js` (`grabPlayer`, `heldUpdate`), `src/06b_ebeh.js` (`WARDEN2.seize`, `EBEH.warden`), `src/06c_coopwire.js` (the definition's `seize`), `src/06d_coophost.js` (`ASK.seized`, the hold's step, `ASK.hit`), `src/07c_coopclient.js` (judging the seize, `held`, `freed`, `crush`), `src/05_figures.js` or `src/07_render.js` (the wind-up's pose, the holding pose, the held player drawn at its chest)
- Modify: `tests/coop-warden.mjs`, `tests/t32.mjs`, `docs/notes/coop.md`, `docs/notes/player.md`, `docs/notes/enemies.md`

**Interfaces:**
- Produces: `WARDEN2.seize = { from: 3, trig: 5, wind: 0.9, act: 0.25, rec: 0.9, reach: 4.6, arc: 1.2, again: 14, hold: 4, dps: 6, breakAt: 80, stag: 2, crush: 40, toss: 6, slack: 2, late: 0.6, say: "Break its grip!" }`.
- Produces: the definition's `seize` attack, appended last: `{ style: "seize", kind: "seize", unb: true, from, trig, wind, act, rec, reach, arc, dmg: 0 }`.
- Produces: `grabPlayer(e, { dps, tx, tz, speed, max = HOLD.max, mash = true })`. `mash` may be a function returning whether struggling works now. In `heldUpdate` a dodge press counts only while it does, and the hold ends by itself at `HOLD.max` while struggling works and at `max` while it does not. Callers that pass neither behave as today.
- Produces: `EBEH.warden` (all hooks return at once unless `e.def.duo`): `atkOk` leaves `seize` out while `e.seizeT > 0`; `step` counts `e.seizeT` down; `wind` (as the seize's wind-up ends) sets `e.seizeT = again`. The shared `act` runs with no hit of its own, since only a page judges.
- Produces: on a page, in `coopPuppet`'s hit test: for `a.kind === "seize"` in `"act"`, the melee test with `a.reach` and `a.arc`; on a hit, `grabPlayer(e, { dps, tx, tz, speed, max: hold + 1, mash })` where `(tx, tz)` is 1.6 m in front of the Warden and `mash` is true when this page has no mate who is there, alive and inside the chamber. If it returns true: the puppet is set to `"hold"` under a guess (`e.ov`) and the page sends `["seized", seq, eid, an]`.
- Produces: `ASK.seized(px, [eid, an])` on the host. Accepted when the enemy is a living `duo` boss whose attack is `seize`, `e.an === an`, it is in `"act"` or began `"rec"` no more than `late` seconds ago, it holds nobody, and `px` is within `reach + px.r + slack` of it. Then `e.state = "hold"`, `e.t = 0`, `e.held = px.pid`, `e.holdDmg = 0`, and all are sent `["held", eid, pid, t]`. Otherwise nothing.
- Produces: the hold on the host, stepped in `enemies` for an enemy in `"hold"`:
  - **broken:** `ASK.hit` adds the health a hit from the other player took off to `e.holdDmg`; at `breakAt`, or when a hit leaves the enemy in `"stagger"`, the enemy is staggered for `stag` seconds (`e.dur`), `e.held = 0` and all are sent `["freed", eid, pid, t]`.
  - **crushed:** at `hold` seconds: `e.state = "rec"`, `e.held = 0`, all are sent `["crush", eid, pid, t]`.
  - **over:** the held player is dead, away, or (once its state has been `"held"`, or 0.5 s after the hold began) no longer `"held"`: `e.state = "rec"`, `e.held = 0`, nothing sent.
  - Every way out sets `e.seizeT = again`.
- Produces: on a page, timed events `held`, `freed`, `crush` (in `COOP_TAKE` and `COOP_EV_T`). `held` naming the other player says `seize.say`. `freed` naming this player calls `releaseHold()`. `crush` naming this player takes `crush` damage through `hurtPlayer` with `unb` and a knock of `toss` toward the chamber's centre, applied before the hold is released so the hold's moment of safety cannot swallow it; a `crush` or `freed` for a player not held changes nothing.
- Produces: the Warden's seize wind-up reads differently from a sweep (both arms wide), it stands with one arm raised while it holds, and the held player is drawn against its chest.

- [ ] **Step 1: Failing checks in `coop-warden`** (each from `h.phase(3)`, the Warden's attack forced to `seize`):
  - "it does not seize before phase 3": 300 draws of `chooseAtk` at phase 2 never give it.
  - "a seize the page reports is accepted": state `"hold"`, both clients get `held` with the pid.
  - "a seize is refused": from 9 m away; with another `an`; when its attack is a sweep; from a cave for one's Warden; when it already holds. In each the state is not `"hold"` and no `held` is sent.
  - "80 damage from the other player breaks it": after hits of 40 and 39 it holds; one more point frees: `freed` to both, the state `"stagger"` for 2 s, not 3.4.
  - "the held player's own hits do not count".
  - "a posture break while it holds counts as broken".
  - "unbroken, it crushes at four seconds": `crush` to both between 3.9 and 4.1 s, the state `"rec"`.
  - "it lets go when the held player dies, goes away, or is no longer held": for each, no `crush` and no `freed`, the state leaves `"hold"`. (Review Focus 4.)
  - "it does not seize again for 14 seconds".
- [ ] **Step 2: Failing steps in `t32`** (`mate: "idle"` beside this player unless said):
  - "a seize that lands holds this player": `G.player.state === "held"`, the puppet `"hold"`, health falling 6 a second, a dodge press changes nothing.
  - "a dodge through the seize is not held".
  - "the mate breaks the hold" (`mateAsk("hit", ...)` for 80): this player is free within 0.3 s and took no crush.
  - "unbroken, the crush lands": 40 damage less armour at about 4 s and a throw toward the centre.
  - "with the mate dead, struggling frees the player" (the mate scripted dead): free within `HOLD.max`.
  - "a refused seize frees the player" (`tamper` drops `held` and the host is made to refuse): free within the guess's life, no crush. (Review Focus 3.)
  - "the free player is told": as pid 2 with the scripted host player held, the line "Break its grip!" shows.
  Screenshots `t32-seize-wind`, `t32-held`.
- [ ] **Step 3: Run; expect FAIL.** **Step 4: Implement.**
- [ ] **Step 5: Run** `coop-warden`, `t32`, `t6`, `t23`, `t24`, `t25`, `t27`, `t28`, `t26-build`. D's hold tests pass unedited. Look at both screenshots.
- [ ] **Step 6: Notes and commit.** `player.md`: `grabPlayer`'s two options. `coop.md`: the three events, `seized`, who judges what, and that D's grabs are still not safe on a host (the known problem stays).

```bash
git commit -m "feat: the Warden for two seizes a player for the other to free"
```

---

### Task 5: The chamber closes in

The rules of the seal. The dark is Task 6.

**Files:**
- Modify: `src/06b_ebeh.js` (`WARDEN2.seal`, the seal's functions, `EBEH.warden.hpFloor` and `step`), `src/06_game.js` (`G.seal`, `update`, `resetRun`, `respawn`), `src/06d_coophost.js` (phase 4, `roster`, `wipe`, `onKill`), `src/07c_coopclient.js` (`seal`, `kill`, `reset`, `coopBuild`), `src/07_render.js` (`drawChunks` for a chunk with its own ends)
- Modify: `tests/coop-warden.mjs`, `tests/t32.mjs`, `docs/notes/coop.md`, `docs/notes/world.md`, `docs/notes/zones.md` (`respawn`, `resetRun`), `docs/notes/enemies.md`

**Interfaces:**
- Produces: `WARDEN2.seal = { n: 24, ring: 12.5, rock: 1.4, warn: 1.4, sweep: 0.6, door: 2, fade: 0.4 }`.
- Produces, in `06b`:
  - `sealRing(w)`: the 24 capsules `[ax, az, bx, bz]` end to end on the circle round `w.boss`, the first starting at angle 0, in order. Pure.
  - `sealDoor(w)`: `{ x, z, yaw }`, on the line from the centre toward `w.nodes[w.path[w.path.length - 2]]`, `ring - rock - door` out, resolved for a body of 0.6, facing the centre.
  - `sealBegin(adv = 0)`: `G.seal = { t: adv, ids: [], down: false }` and one `G.chunks` entry per capsule in its warning, each landing at `warn + sweep * i / n`.
  - `sealUpdate(dt)`, called from `update` while `G.seal`: lands each capsule when its time comes (`w.addRock`, its chunk now a heap, every enemy's route dropped, any enemy whose body is in the new rock moved radially inward to open floor). When the last lands, `down = true`. On a page it also keeps this player in (below).
  - `sealNow()`: the whole ring down at once (a late join, a respawn).
  - `sealEnd(crumble)`: the rocks out, the chunks gone (with the crocodile's crumble effect when `crumble`), `G.seal = null`, routes dropped.
- Produces: **this player kept in**, on a page, each step while the seal is `down` and the player is alive and not held: a player whose distance from the centre is above `ring - rock` and within `ring + rock + 0.5` is moved radially to `ring - rock - 0.6` and resolved; one further out is put at `sealDoor(w)` with a fade of `fade` seconds.
- Produces: `respawn`: after it clears the rocks, when `G.seal` stands it calls `sealNow()` and places the player at `sealDoor(w)` in place of the checkpoint. `resetRun` sets `G.seal = null`.
- Produces: `EBEH.warden.hpFloor(e)`: for a `duo` boss in phase 1 to 3 further than `w.boss.r` from the chamber's centre, `e.def.hp * marks[2]`; otherwise 0.
- Produces: `EBEH.warden.step`: while `G.seal` and nobody live to fight (`!c.alive`), it stands where it is and returns `true`.
- Produces: on the host, when a `duo` boss enters phase 4: `sealBegin()` and `["seal", eid, t]` to all. `roster()` gains `seal: !!G.seal`. `wipe()` calls `sealEnd(false)` before it makes the enemies again. The Warden's death calls `sealEnd(true)`.
- Produces: on a page: the timed event `seal` calls `sealBegin(adv)`, or `sealNow()` when it is applied late or quietly; the boss's `kill` calls `sealEnd(true)`; a `reset` or a world description with `seal` false ends a standing seal with `sealEnd(false)`, and one with `seal` true and no seal standing calls `sealNow()`.

- [ ] **Step 1: Failing checks in `coop-warden`:**
  - "the ring is closed and leaves ten metres, on 40 caves": for seeds 1 to 40, after `sealNow()` on the host's world, a flood from the centre on a 0.25 m grid for a body of radius 0.4 never passes 12.5 m, and on 72 headings a body of radius 0.45 stands out to at least 10 m.
  - "two copies lay the same rock": `sealRing` on two fresh hosts of seed 7 is deep-equal, and `fieldAt` agrees at 500 points round the ring after `sealNow()` on both.
  - "phase 4 seals the chamber": `seal` to both clients; 2.1 s later a route from the centre to the tunnel mouth is `null`; the describe of a joining client has `seal: true`.
  - "its health holds at the quarter mark outside its chamber": the Warden placed 20 m from the centre at 400 health takes 500: health is 387.5 and the phase 3; moved back inside, the next hit gives phase 4.
  - "the Warden in the rock's way is moved in": standing 13 m out when phase 4 begins, it is within 11 m and on open floor once the ring is down.
  - "sealed with nobody to fight it stays": one client dead and the other silent for 3 s, then 10 s more: the state is not `"return"`, its health and position are unchanged, the phase 4, `G.seal` stands. (Review Focus 1.)
  - "unsealed, today's walk home still resets it": phase 2, both players gone: it returns, and on arriving has 1,550 health and phase 1.
  - "a wipe lifts the seal": both dead: `reset` with `seal: false`, the route out is back, the Warden at full health and phase 1.
  - "its death lifts the seal": the route out is back and the exit gate is open.
  - "a friend who joins in phase 4 is told the seal stands". (Review Focus 5.)
- [ ] **Step 2: Failing steps in `t32`:**
  - "the rock falls after its warning": 24 chunks in warning at 0.5 s, the ring `down` by 2.1 s, `world.fieldAt` under a capsule below zero.
  - "a player outside is brought to the door": this player in the last room when the seal lands is at `sealDoor` within 0.6 s.
  - "a player under the rock is pushed inward": standing 12.5 m out, ends about 10.5 m out, not at the door.
  - "nobody walks out": holding forward toward the tunnel for 5 s leaves the player within 11.2 m.
  - "a death while sealed gets up at the door": after `respawn()` the player is at `sealDoor`, the ring is in this page's field again and `G.chunks` holds 24 heaps. (Review Focus 2.)
  - "a join in phase 4 starts sealed in": a second `coopSolo` joining a host already in phase 4 (`before` runs `host.phase(4)` and steps it 3 s): the first frame has the ring and the player at the door. (Review Focus 5.)
  - "a wipe and the Warden's death open the chamber again" (one step each).
  - "no frame of the sealed chamber draws more than the limit": `DF.R.stats.tris` world triangles at most 81,835 from the centre and from the door.
  Screenshots `t32-warn`, `t32-ring`, and `t32-ring` again with `DEVICE=iphone-se`.
- [ ] **Step 3: Run; expect FAIL.** **Step 4: Implement.**
- [ ] **Step 5: Run** `coop-warden`, `t32`, `coop-host`, `coop-e2e`, `t8`, `t25`, `t27`, `t28`, `t30`, `t31`, `t26-build`. Look at the screenshots: the ring must read as rock that closes the room, with no visible gap between heaps.
- [ ] **Step 6: Notes and commit.**

```bash
git commit -m "feat: the last phase seals the Warden's chamber"
```

---

### Task 6: The lights go out

**Files:**
- Modify: `src/06_game.js` (`G.dark`, `update`, `resetRun`), `src/06b_ebeh.js` (`WARDEN2.dark`; `sealBegin`, `sealNow` and `sealEnd` set the target), `src/07_render.js` and `src/02_gl.js` (the lights and the crystals' glow)
- Modify: `tests/t32.mjs`, `docs/notes/rendering.md`, `docs/notes/coop.md`

**Interfaces:**
- Produces: `WARDEN2.dark = { floor: 0.12, over: 2 }`.
- Produces: `G.dark = { v, to }`, both 0 to 1: `to` is 1 while a seal stands and 0 otherwise (`sealEnd(false)` also sets `v` to 0 at once); `update` moves `v` toward `to` at `1 / over` a second. `resetRun` sets both to 0.
- Produces: in drawing, every light from `world.lights` and the glow of the cave's crystals are multiplied by `lerp(1, floor, G.dark.v)`. The Warden's own light, shots, rings, sparks and the exit gate's light are not.

- [ ] **Step 1: Failing steps in `t32`:**
  - "the cave dims while sealed and not before": `G.dark.v` is 0 at phase 3, above 0.95 three seconds after phase 4 begins.
  - "the sealed chamber is darker on screen": the mean brightness of a frame from the door spot looking at the centre, read from the canvas, is under 60% of the same frame before the seal (the Warden moved out of view for both).
  - "the Warden still shows": with the Warden in view in its wind-up the brightest tenth of the frame's pixels is no dimmer than 70% of the same measure before the seal.
  - "the light comes back": 2.2 s after the Warden's death `G.dark.v` is 0; after a wipe it is 0 at once.
  Screenshots `t32-dark` (the Warden mid wind-up in the dark), `t32-dark` with `DEVICE=iphone-se`, and `t32-lit` after its death.
- [ ] **Step 2: Run; expect FAIL.** **Step 3: Implement.**
- [ ] **Step 4: Run** `t32`, `t9`, `t11`, `t22`, `t31`. Look at `t32-dark` on both sizes. If a wind-up cannot be read, raise `floor` until it can and record the value and why in `rendering.md`.
- [ ] **Step 5: Notes and commit.**

```bash
git commit -m "feat: the crystals go dark while the chamber is sealed"
```

---

### Task 7: The fight alone in the dev build

**Files:**
- Modify: `src/dev/10_dev.js`, `src/dev/20_lagdial.js` if the run needs it, the dev screen's markup
- Modify: `tests/t26.mjs`, `tests/t26-build.mjs` if it lists dev names, `docs/notes/dev-menu.md`

**Interfaces:**
- Consumes: `coopSolo`, `host.phase(n)`, `sealDoor`.
- Produces: `devWardenTwo(seed)`: a run for two alone over the fake link with the scripted mate fighting, this player and the mate standing at the chamber's mouth on the route, the last rest point lit and made the checkpoint; returns the run.
- Produces: `devWardenPhase(n)`: `host.phase(n)` on that run; nothing when no such run is live.
- Produces: on the dev screen a row "Warden for two" with the buttons "Fight" (`data-dev-w2`) and "Phase 2", "Phase 3", "Phase 4" (`data-dev-w2p="2"` and so on). Both functions on `DF`.

- [ ] **Step 1: Failing steps in `t26`:** the buttons exist in the dev build; "Fight" starts a live run whose Warden has `def.duo` and whose world is the big cave, with this player within 25 m of the chamber's centre; "Phase 4" leaves the puppet at phase 4 and `G.seal` standing within 3 s; nothing is saved (`DEV.noSave()`); a release build has none of it (`t26-build`).
- [ ] **Step 2: Run; expect FAIL.** **Step 3: Implement.** **Step 4: Run** `t26` in `hub` mode and `node tests/t26-build.mjs`.
- [ ] **Step 5: Notes and commit.**

```bash
git commit -m "feat: the dev menu starts the Warden for two alone"
```

---

### Task 8: Sweep and status

- [ ] **Step 1: Run every script in the README's test table** on the final build, as the last piece's sweep did, and the co-op Node tests. Record each result. Only the four known failures may fail.
- [ ] **Step 2: Measure and record:** the largest join in a sealed fight against the relay's 16,384 bytes; the mean cost of a host step during phase 4 with two players in the chamber; the triangles of the worst sealed frame.
- [ ] **Step 3: Look at every `t32-*` screenshot once more** on desktop and iPhone SE.
- [ ] **Step 4: Status.** `docs/notes/status.md`: the branch's record (what was built, every number of `WARDEN2`, what was measured, what nobody has checked by hand: the feel of all four phases, whether the dark hides wind-ups in play, the fight's length, high ping on the seize); backlog 10 rewritten as what remains (tuning after a playtest). `CLAUDE.md` "Where the project stands": the Warden for two. `README.md`: the rows for `coop-warden` and `t32`, the co-op paragraph. `TODO` is the owner's file and is not touched.

```bash
git commit -m "docs: record the Warden for two"
```
