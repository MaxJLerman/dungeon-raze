# Co-op lobby, gate travel and a dungeon for two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A co-op room starts in the hall, the host's step through gate E takes both players into one cave and the exit gate brings both back, and a cave entered by two is harder in five listed ways.

**Architecture:** The host copy keeps one simulation for the life of the room and swaps its world (hall or cave), numbering each world with an epoch. It describes a world to clients in `join` and in a new `world` event; a client builds it and answers `at`, and until then the host treats that player as not there. Tuning for two is a per-dungeon table of scaled enemy definitions (`G.edef`), extra spawns added on the host only, a per-target attack turn rule and a boss heal, all driven by one constant `COOP_TWO`.

**Tech Stack:** Plain JavaScript in `src/` (one shared function scope), `node build.mjs`, Node tests (`tests/coop-*.mjs`), Playwright page tests through `test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-25-coop-lobby-design.md`. Read it first. Then read `docs/notes/coop.md`, `docs/notes/zones.md` and, for Task 2's plaque step, the first section of `docs/notes/hidden-classes.md`.

## Global Constraints

- `node build.mjs` after every source change; tests run against `dist/index.html`.
- All `src/*.js` share one scope: declare a name once across `src/`. Nothing outside `src/dev/` names anything declared there.
- The host copy is the files matching `^0[1-6]`. Anything the host needs lives in `06c` or `06d`, loads in Node and in a Worker, and names nothing from `07` on. `node tests/t26-build.mjs` must pass after every task.
- Core (`06_game.js`, `09_main.js`, `07_render.js`, `08_hud.js`) reads `NET` only in the places `docs/notes/coop.md` lists. Every new place is added to that list in the same commit.
- With `NET` null nothing here runs. `tests/t22.mjs` hashes are unchanged and no solo test file is edited to make it pass.
- Co-op grades: E only. The co-op hall has E open and D, C, B, A, S sealed on the Worker and on both pages.
- `COOP_V` goes from 1 to 2.
- `COOP_TWO`, exact values: `{ extra: 1, extraDeep: 2, hp: 1.3, post: 1.3, bossHp: 1.8, bossPost: 1.5, turns: 2, bossHeal: 0.25 }`.
- Copy, exact: "Only the host can open a gate." / "OUT ALIVE" / "Enter the hall" / "Enter the dungeon" / "Waiting for the host to start" / "Start" / `<boss name> + " feeds on the fallen."`
- Notes go in the same commit as the code they describe (`coop.md`, `zones.md`, `hidden-classes.md`, `dev-menu.md`).
- Never read, print or copy any `tests/codes.local.*` file. Never write a plain plaque code anywhere.
- Commits: `feat:` / `test:` / `docs:` prefixes, no `Co-Authored-By` or `Claude-Session` trailers, no em dashes and no ", and" in messages.
- A page test step fails the run when it returns an object whose `pass` is not `true`. Node tests print `ok` or `FAIL` lines and end `all passed`.

## Review Focus

1. **Exit to main menu in the middle of a co-op fade.** The pending swap must not build a co-op world after co-op has ended: two seconds later the page is on the title with its own hall and `NET` null. (Task 2, t28.)
2. **A friend still on the room screen when the host travels.** Its page builds the new world unseen, the button changes from "Enter the hall" to "Enter the dungeon", and entering lands at the cave's start beside the host. (Task 3, t29.)
3. **Two leaving requests that cross.** The host's Return to base and the friend's step into the exit gate in the same tick swap the world once; the epoch rises by one. (Task 1, coop-host.)
4. **A player's own hall comes back.** A host whose save has E cleared sees D sealed in the co-op hall and open again after Exit to main menu. (Task 2, t28.)
5. **A dead player is taken along.** A host who presses Return to base on the death screen, and a dead friend when the host does, both arrive alive on the play screen. (Task 2, t28.)

---

### Task 0: Record the design

- [ ] **Step 1: Commit the spec and this plan.**

```bash
git add docs/superpowers/specs/2026-11-25-coop-lobby-design.md docs/superpowers/plans/2026-11-25-coop-lobby.md
git commit -m "docs: design and plan for the co-op lobby"
```

---

### Task 1: The host swaps worlds

**Files:**
- Modify: `src/06d_coophost.js` (the whole of world handling), `src/06c_coopwire.js` (`COOP_V`, `COOP.GRADES`)
- Modify: `src/06_game.js` (`enterHub`), `src/03b_hub.js` (`genHub`, `hubPortals`)
- Modify: `src/07c_coopclient.js` (one line: answer `at` after a join), `src/dev/20_lagdial.js` (the scripted player answers `at`)
- Modify: `tests/lib/coop.mjs`, `tests/coop-host.mjs`, `tests/coop-wire.mjs`
- Modify: `docs/notes/coop.md`, `docs/notes/zones.md`

**Interfaces:**
- Produces, hall: `hubPortals(coop = false)` and `genHub(coop = false)`: with `coop` true a portal's `open` is `grade === "E"`. `enterHub(fromGrade = null, coop = false)`: with `coop` true it does not call `coopEnd` and builds `genHub(true)`.
- Produces, wire: `COOP.GRADES = ["E"]`. A world description `D = { e, kind, grade, seed, sum, n, enemies, dead, bossDead, t }`: `e` the epoch (integer from 1), `kind` `"hub"` or `"cave"`, `grade` a grade id or `null` in the hall, `seed` a number (0 in the hall), `n` 1 or 2 (the players the world was built for; always 1 until Task 4 and always 1 in the hall), the rest as `join` carries them today.
- Produces, host events: `join` is `["join", { v, pid, started, peers, ...D }]`. `["world", { ...D, from, won }]`: `from` is the grade whose gate the party comes out of (`null` unless `kind` is `"hub"`), `won` the run time in seconds when the exit gate caused it, else `null`.
- Produces, client requests: `["travel", seq, to, seed]` (`to` is `"hub"` or a grade in `COOP.GRADES`; `seed` a finite number, ignored for `"hub"`), `["at", seq, e]`.
- Produces, host API: `host.start({ hub: true })` starts in the hall; `host.start({ seed, grade })` still starts in a cave. `host.S` gains `epoch`, `kind`, `n`. Each proxy gains `here` (false until its `at` for the current epoch).
- Produces, test helper: `fakeClient(host, pid, cls, { at = true } = {})`. With `at` true it answers every `join` and `world` with `at` at once. `c.world` is the latest description, `c.arrive()` sends the answer by hand, and `c.ev` numbering restarts at 1 after each `world`.
- In this task `gate` still sends `end`. Task 2 changes it.

- [ ] **Step 1: Extend `tests/lib/coop.mjs`** as the Interfaces say.
- [ ] **Step 2: Write the failing checks in `tests/coop-host.mjs`** (a `hall()` helper beside `cave()` that calls `h.start({ hub: true })`):
  - "a room starts in the hall": `S.kind === "hub"`, `S.epoch === 1`, one enemy of type `dummy`, the join's `kind === "hub"`, `grade === null`, `n === 1`, and `G.world.portals` open for E only.
  - "the co-op hall is the same with any save": `sum` of `genHub(true)` equals the join's `sum`.
  - "the host's player travels": pid 1 `ev("travel", "E", 99)` gives both clients a `world` with `e === 2`, `kind === "cave"`, `seed === 99`, 47 enemies and `sum` equal to `cave()`'s; `S.kind === "cave"`.
  - "the friend cannot travel": the same from pid 2 changes nothing. Neither does `travel` to `"D"`, to `"E"` while already in a cave, to `"hub"` while in the hall, or with a seed that is not a finite number.
  - "a player is not there until it answers": with `{ at: false }`, after the `world` the client gets no snapshot over 1 s of ticks, its `at(x, z)` states do not move its proxy, a `hit` on enemy 37 changes no health and is not acknowledged (`px.ack` unchanged), and enemy 37 does not wake with it standing beside it. After `c.arrive()` and one state all four work.
  - "a wrong epoch is not an arrival": `ev("at", S.epoch - 1)` leaves `here` false.
  - "event numbers start again": after a swap `px.ack === 0`, and the client's first event (its `at`, seq 1) sets it to 1.
  - "an arrival after a wipe gets the enemies again": hold the friend's `at`, kill an enemy through pid 1, then `arrive()`: the friend receives a `reset` whose `dead` holds that id.
  - "back to the hall": pid 1 `ev("travel", "hub")` from the cave gives a `world` with `kind === "hub"`, `from === "E"`, `won === null`, and the proxies stand within 0.01 of `portalFront` of E's portal at 3.5 m.
  - "a second trip is a fresh cave": hall, travel 99, hub, travel 7: epochs 2, 3, 4, the last `sum` differs from the first, `G.bossDead` is false and every enemy is alive.
  - "crossing requests swap once" (Review Focus 3): in a cave with the boss dead, pid 1 `travel hub` and pid 2 `gate` before the next tick: `S.epoch` has risen by exactly 1.
  - "a join mid-swap": pid 2 joins after the host built a cave and before pid 1 answered: its join carries the cave and `e === S.epoch`.
  - "the dummy stands back up": in the hall, stagger the dummy with `parry` events, `pin` then `exec`: it is not dead, `hp === def.hp`, and no `kill` event was sent.
- [ ] **Step 3: Run `node build.mjs && node tests/coop-host.mjs`.** Expected: the new checks FAIL (`h.start` ignores `hub`).
- [ ] **Step 4: Implement the hall parameter** in `03b_hub.js` and `enterHub` as the Interfaces say. `enterHub` places the player in front of `fromGrade`'s portal exactly as it does now.
- [ ] **Step 5: Implement the host.** One internal `build(kind, grade, seed, from)` used by `start`, `travel` and (in Task 2) `gate`: builds with `enterHub(from, true)` or `newRun(seed, grade)`, re-points the placeholder, calls `number()`, raises `S.epoch`, and for every proxy sets `here = false`, `heard = -Infinity`, `ack = 0`, clears `seen`, restores full health and state `"free"` and moves it to the arrival point (the world's start, or the player position `enterHub` chose). `NET` is set once, before the first build. `ASK.travel` and `ASK.at` as specified; `ask()` drops, without acknowledging, every event but `at` from a proxy that is not `here`; `recv` ignores a STATE from one; `snap` skips one; `all` and `others` skip one for the world-bound events `shot`, `ring`, `roar`, `kill`, `reset`. A proxy not `here` is not `live()` and is not counted by `wipe()`. A counter raised by every kill and wipe, remembered per proxy when its `world` or `join` is sent, decides the `reset` on arrival. `ASK.exec` on a dummy restores its health and posture and clears the pin in place of `kill`.
- [ ] **Step 6: Keep the page working.** `COOP_V = 2`. In `coopJoin`, after the join is applied, `coopAsk("at", j.e)`. In `20_lagdial.js` the scripted player answers `at` to its `join` and to any `world`. `coopJoinOk` still requires `grade === "E"`; Task 2 loosens it.
- [ ] **Step 7: Add to `tests/coop-wire.mjs`:** a `world` event with a full description round-trips through `eventEncode` and `eventDecode`; a `join` of cave 99 encodes to fewer than 16,384 bytes (the relay's cap).
- [ ] **Step 8: Run** `node build.mjs && node tests/coop-host.mjs && node tests/coop-wire.mjs && node tests/t26-build.mjs`, then `node build.mjs` and `SCRIPT=$PWD/tests/t27.mjs node test.mjs smoke`, `SCRIPT=$PWD/tests/t28.mjs node test.mjs smoke`, `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`, `SCRIPT=$PWD/tests/t22.mjs node test.mjs smoke`. Expected: all pass, t22 hashes unchanged. Existing coop-host checks that relied on a proxy being present without `at` now pass through the helper's automatic answer; fix any that built their own client.
- [ ] **Step 9: Update `coop.md`** (the wire: `world`, `travel`, `at`, the epoch and the "not there" rule; `enterHub`'s new parameter) and `zones.md` (`genHub(coop)`, `hubPortals(coop)`). **Commit:** `feat: the co-op host swaps worlds and starts in the hall`.

---

### Task 2: The client is taken between worlds

**Files:**
- Modify: `src/07c_coopclient.js`, `src/06d_coophost.js` (`gate`, removal of `end`), `src/06_game.js` (`transUpdate`, the portal check at the end of `update`, `bossFell`, the plaque code read), `src/09_main.js` (`toBase`, `show`), `src/08e_coopui.js` (`COOP_SAY`, `coopHostRoom` passes the seed), `src/dev/20_lagdial.js`
- Modify: `tests/t27.mjs`, `tests/t28.mjs`, `tests/coop-host.mjs`, `tests/coop-e2e.mjs`, `tests/t29.mjs` (only what the removal of `end` breaks)
- Modify: `docs/notes/coop.md`, `docs/notes/zones.md`, `docs/notes/hidden-classes.md`, `docs/notes/dev-menu.md`

**Interfaces:**
- Consumes: Task 1's description `D`, `world`, `travel`, `at`, `enterHub(from, true)`.
- Produces, core: a transition may carry its own swap: `G.trans = { t, swapped, swap }`, and `transUpdate` calls `tr.swap()` in place of `enterCave(tr.grade)` when it is set. New hook `NET.onPortal(grade)` on both sides (a no-op on the host), called by the portal check in `update` in place of `startTrans` while `NET` is set.
- Produces, client: `coopWorldOk(d)` (true for `kind === "hub"`, or `kind === "cave"` with `grade` in `COOP.GRADES` and a finite seed, plus today's list checks); `coopBuild(d)` (builds the world without ending co-op, checks the sum, fixes the class, makes the puppets, opens the gate when `bossDead`, clears `CC.seq`, `CC.pend`, `CC.evq`, `CC.fin`, `CC.exE`, `CC.gate`, the travel flag and every mate's snapshot list, sets `CC.world`, `CC.epoch`, `CC.kind`, `CC.heard = CC.now`, then asks `at`; false when the sum differs); `coopTravel(d)` (the `world` event: at once when the run is not live or motion is reduced, else through a fade whose `swap` is `coopBuild`); `coopPortal(grade)` (pid 1 asks `travel` once per epoch, with the first trip's seed from `coopBegin`'s new option `seed` and a random one after; pid 2 gets the line, once per approach); `coopLeads()` (true with no co-op run or when this page is pid 1); `coopBase()` (asks `travel` to `"hub"`).
- Produces, lag dial: `coopSolo({ hub = false, pid = 1, ... })`: `hub` starts the host in the hall; `pid: 2` puts the page in as the friend and the scripted player in as the host (it can be told to travel: `out.mateAsk(name, ...args)`).
- Produces, tests: `DF` gains any name these steps use and it lacks (`clearGrade`, `resetCleared`, `classOpen`, `EDEF`), added to the `DF` list in `09_main.js`.

- [ ] **Step 1: Write the failing page steps.** In `tests/t28.mjs` (mode `smoke`, over `DF.coopSolo`):
  - "from the hall to the cave and back": `coopSolo({ hub: true, seed: 99 })`, enter: `G.zone === "hub"`, one enemy (the dummy), `DF.net().live`. Walk the player into E's opening (`DF.sim`): after the fade `G.zone === "cave"`, `G.seed === 99`, 47 puppets, and the player stands where a solo `newRun(99)` starts. Set the boss dead on the host, step into the gate: `G.zone === "hub"`, `DF.net()` still set, the player in front of E's portal, messages include "OUT ALIVE" and no win screen (`G.state === "play"`).
  - "a second trip is a new cave": step in again without `DF.coopSeed`: `G.seed !== 99`.
  - "the friend is taken along": `coopSolo({ hub: true, pid: 2 })`, enter, `out.mateAsk("travel", "E", 99)`: the page lands in cave 99. Walking the page's player into E's opening in the hall instead shows "Only the host can open a gate." and `G.zone` stays `"hub"` after 2 s.
  - "Return to base" (Review Focus 5): as pid 1 in the cave, kill the page's player, wait for the death screen, click `#btnDeadBase`: `G.zone === "hub"`, `G.player.state !== "dead"`, `hp === maxHp`, `G.state === "play"`. As pid 2: `#btnBase` and `#btnDeadBase` are not shown on the pause and death screens, and are shown again after `DF.coopEnd("left")`. A dead friend when the host travels arrives alive on the play screen.
  - "exit in the middle of a co-op fade" (Review Focus 1): start the trip, and while `G.trans` is set click `#btnExit` from the pause screen; `DF.sim(2)`: `G.state === "title"`, `DF.net() === null`, `G.zone === "hub"`, `G.trans === null`.
  - "the player's own hall comes back" (Review Focus 4): with E cleared in the save (`DF.clearGrade("E", DF.OPT.cls)`, undone at the end with `DF.resetCleared()`), the co-op hall's D portal has `open === false`; after Exit to main menu, Play solo and Enter the hall, it is `true`.
  - "a plaque reads but takes no code": in a co-op hall, stand at a plaque and Inspect: `G.insp` is set and the card is shown. With `DF.setPlaqueCode` giving it a test code, enter that code: `DF.classOpen(cls) === false`. The scripted other player's record of this player has `state === "inspect"` while the card is open. After `DF.coopEnd("left")` and a fresh hall the same code unlocks it. Undo with `DF.resetPlaqueCodes()` and remove the unlock.
  - "no new gate line in co-op": the boss's death in a co-op cave adds no message containing "A new gate has opened".
  - "reduced motion cuts": with the reduced-motion flag the swap happens on the step the `world` arrives, with `G.trans` never set.
  In `tests/t27.mjs`: "a cave that differs ends co-op": tamper the `world` event's `sum`: the page is on the title showing `COOP_SAY.cave` and `DF.net() === null`.
- [ ] **Step 2: Run** `node build.mjs && SCRIPT=$PWD/tests/t28.mjs node test.mjs smoke`. Expected: the new steps FAIL (`coopSolo` ignores `hub`).
- [ ] **Step 3: Implement the client and the core hooks** as the Interfaces say. `coopJoin` uses `coopWorldOk` and `coopBuild`. `coopNow` handles `world` through `coopTravel`. A `world` whose `won` is a number says "OUT ALIVE" (`"big"`, 4 s) and the time as the win screen writes it (`m:ss`) once the player has arrived. A player on the death screen when a build finishes is shown the play screen. `coopBuild` returning false mid-run is `coopEnd("cave")`, which joins `"host"`, `"stopped"` and `"lost"` in going to the title with its line. The fade's `swap` does nothing unless `CC.link` is still the link it was made for. `toBase()` calls `coopBase()` then `play()` during a co-op run. `show()` hides `#btnBase` and `#btnDeadBase` when `!coopLeads()`. `bossFell` skips the new-gate line when `NET` is set. The plaque code read (the `code = id && !classOpen(id) && PLAQUE_CODES[id]` line) also requires `!NET`.
- [ ] **Step 4: The host's gate.** `ASK.gate` with the boss dead calls `build("hub", null, 0, G.grade)` and sends `world` with `won: G.runT`. Remove `end`, `S.ended`, `COOP_SAY.ended`, the client's `end` handler and `coopEnd`'s `"end"` case; the Worker driver now stops only on `stop`. Update the coop-host checks that expected `end` ("the gate ends the run") to expect the hall, and the Worker driver check that expected a shut on the end. Add the other order to "crossing requests swap once": `gate` from pid 2 then `travel hub` from pid 1 in one tick also raises the epoch by exactly 1.
- [ ] **Step 5: Update `tests/coop-e2e.mjs`:** where the gate ended the run and the room, both pages are now in the hall with `DF.net()` set and the friend still sees the host; the "run has ended" refusal is removed. Update any `tests/t29.mjs` step that read `COOP_SAY.ended`.
- [ ] **Step 6: Run** `node build.mjs`, then `node tests/coop-host.mjs`, `node tests/t26-build.mjs`, t27, t28 (`smoke`), `SCRIPT=$PWD/tests/t29.mjs node test.mjs title`, `SCRIPT=$PWD/tests/t30.mjs node test.mjs title`, `SCRIPT=$PWD/tests/t8.mjs node test.mjs hub`, `SCRIPT=$PWD/tests/t18.mjs node test.mjs hub`, `SCRIPT=$PWD/tests/t6.mjs node test.mjs smoke`, `node tests/coop-e2e.mjs`. Expected: all pass. Afterwards `lsof -i :8787` and `lsof -i :8123` show nothing.
- [ ] **Step 7: Notes.** `coop.md`: the party rules (leaving, Return to base, no win screen, the friend at the gate), the new `NET` read sites (`onPortal` in `update`, the plaque code read, `show`, `toBase`, `transUpdate`'s `swap` reads none), `coopEnd`'s reasons, the removal of `end`. `zones.md`: the transition's `swap`. `hidden-classes.md`: a plaque takes nothing during a co-op run. `dev-menu.md`: `coopSolo`'s new options. **Commit:** `feat: co-op players travel between the hall and the cave together`.

---

### Task 3: A room starts in the hall

**Files:**
- Modify: `src/06d_coophost.js` (the Worker driver's `start` message), `src/08e_coopui.js`
- Modify: `tests/t29.mjs`, `tests/coop-e2e.mjs`, `tests/coop-caves.mjs`, `tests/coop-host.mjs` (the Worker driver checks)
- Modify: `docs/notes/coop.md`, `README.md` (the co-op paragraph and the test table, where they say the room is one cave)

**Interfaces:**
- Consumes: `host.start({ hub: true })`, `CC.kind`, `coopBegin(link, { cls, seed, onRefuse })`.
- Produces: the page posts `{ start: { hub: true, relay, code } }`; the driver passes `hub` through and still accepts `{ seed, grade }`.

- [ ] **Step 1: Write the failing steps in `tests/t29.mjs`:**
  - "a hosted room starts in the hall": Host with the stand-in relay, wait for the join: `G.zone === "hub"`, `#coopEnter` reads "Start"; click it: `G.state === "play"`, `G.zone === "hub"`, `DF.net().live`.
  - "the friend's button names where it leads" (Review Focus 2): as the friend over a hand-stepped host, joined and not entered: "Waiting for the host to start" until `started`, then "Enter the hall". The host travels to E: the button reads "Enter the dungeon" and `G.zone === "cave"` with the room screen still up. Click: `G.state === "play"` and the player stands at the cave's start.
  - Update the steps that expected "Enter the cave".
- [ ] **Step 2: Run** `node build.mjs && SCRIPT=$PWD/tests/t29.mjs node test.mjs title`. Expected: the new steps FAIL.
- [ ] **Step 3: Implement.** `coopHostRoom` posts the hub start and hands `CR.seed` to `coopBegin`. `coopRoomRender`'s label: host "Start"; friend ready: `CC.kind === "hub" ? "Enter the hall" : "Enter the dungeon"`; else "Waiting for the host to start". The Worker driver passes `hub`.
- [ ] **Step 4: `tests/coop-e2e.mjs`, the lobby flow on two real pages:** host and join by code; both enter; each page has `G.zone === "hub"` and one mate; the friend sees the host's mate move when the host walks. The host walks into E's opening: both pages reach `G.zone === "cave"` with equal `G.seed` and equal `DF.coopWorldSum(G.world)`. The friend who rejoins by the invite link mid-run lands in the cave. With the boss killed through the host, the gate brings both back to the hall and the host's pause screen still shows the room code. A second trip gives a different `G.seed`. Keep the existing steps for class changes, an old version, a full room, an away host, the host leaving and the two exits.
- [ ] **Step 5: `tests/coop-caves.mjs`:** also compare the co-op hall's sum (`h.start({ hub: true })`, `h.sum(h.G.world)`) across Node and the three engines, reported as the caves are. If an engine differs, stop and report it before changing `genHub`: the spec allows a fix there only if the solo hall looks and collides the same (t8, t9).
- [ ] **Step 6: Run** t29 on the desktop page and `DEVICE=oneplus-13 SCRIPT=$PWD/tests/t29.mjs node test.mjs title`, `node tests/coop-host.mjs`, `node tests/coop-caves.mjs`, `node tests/coop-e2e.mjs`, `node tests/t26-build.mjs`. Look at `shots/t29-room.png` and `shots/oneplus-13-t29-room.png`. Expected: all pass.
- [ ] **Step 7: Notes** (`coop.md`: the room screen, the Worker's start message, the first paragraph, and Known problems: "Co-op is grade E" stays, the room-per-run lines go) and `README.md`. **Commit:** `feat: a co-op room starts in the hall`.

---

### Task 4: A dungeon tuned for two

**Files:**
- Modify: `src/06c_coopwire.js` (`COOP_TWO`, `coopTwoDefs`, `coopExtras`), `src/06d_coophost.js`, `src/06_game.js` (`makeEnemy`, `resetRun`, `takeToken`), `src/07c_coopclient.js`, `src/dev/20_lagdial.js`
- Modify: `tests/coop-host.mjs`, `tests/t27.mjs`, `tests/t28.mjs`
- Modify: `docs/notes/coop.md`, `docs/notes/enemies.md`, `docs/notes/zones.md`

**Interfaces:**
- Produces, core: `G.edef`, `null` or a table of enemy definitions by type; `makeEnemy` reads `(G.edef || EDEF)[s.type]`; `resetRun()` sets it to `null`. `takeToken(e)`: when `NET && NET.two`, it counts only token holders whose `tg` equals `e.tg` and the limit is `COOP_TWO.turns`; otherwise exactly today's rule.
- Produces, `06c`: `coopTwoDefs()` returns a table with every key of `EDEF`: the dummy's own entry, and for every other type `Object.create(EDEF[type])` with own `hp` and `posture` multiplied by `COOP_TWO.hp` and `COOP_TWO.post`, or `bossHp` and `bossPost` for a boss, each rounded to a whole number. `EDEF` is never changed. `coopExtras(world, seed)` returns the extra spawns `{ type, x, z, yaw, node }`: spawns are grouped by `node` (`node >= 0`, not a boss); a group whose types sorted are `brute, brute, spit` gets `COOP_TWO.extraDeep`, any other `COOP_TWO.extra`; each extra's type is drawn from its group with `rng(seed ^ 0x2c0)`, in spawn order, and it stands 1 to 2.5 m from the drawn member after `world.resolve(o, 1.2)`.
- Produces, host: `S.n` is 2 when a cave is built with two proxies in `S.px` (or `start({ seed, grade, two: true })`), else 1; the hall is always 1. For `n === 2`, after `newRun`: `G.edef = coopTwoDefs()`, the extras are appended to `G.world.spawns`, `spawnEnemies()` and `number()` run again. `NET.two` is `S.n === 2`. Host event `["fed", eid, t]`.
- Produces, client: `coopBuild` sets `G.edef = coopTwoDefs()` when `d.n === 2`, before the puppets are made. `fed` waits for the drawn time like `roar` and says the line (`e.def.name + " feeds on the fallen."`), silent when late.
- Produces, lag dial: `coopSolo({ two = false })` passes `two` to `host.start`.

- [ ] **Step 1: Write the failing checks in `tests/coop-host.mjs`:**
  - "the count of players fixes the tuning": hall with two clients, travel 99: `world.n === 2`. Hall with one: `n === 1`, and a friend who joins that cave gets a join with `n === 1` and the enemy count unchanged. Two players, then the friend leaves, back to the hall, travel again: `n === 1`.
  - "more enemies": for seed 99 built for two, every room pack has 1 more enemy than `cave()`'s and each brute, brute, spit room 2 more; no extra has `node === -1`, none is a boss, every extra stands on walkable ground (`fieldAt > 0`) within 3 m of a member of its pack; building it twice gives the same list.
  - "tougher": a husk's `def.hp` is `Math.round(EDEF.husk.hp * 1.3)` and its posture likewise; the Warden's `def.hp === Math.round(620 * 1.8)` and `def.posture === 210`; `e.hp === e.def.hp` at spawn; `EDEF.husk.hp` itself is unchanged; the snapshot's posture fraction for a husk at half its scaled posture decodes within 1/255 of 0.5; the Warden enters phase 2 at half its scaled health and not before.
  - "two attackers per player": six husks awake, three beside each of two players standing 30 m apart in line of sight of their own three: over 10 s at most 2 hold a token against each player and at some tick 4 hold one in all. In a cave built for one with the same set-up the total never passes 2.
  - "a death at the boss feeds it": built for two, the Warden awake at 40% health, pid 2 inside the chamber sends a state with `state: "dead"`: the Warden's health rises by 25% of `def.hp`, both clients get one `fed`, and a second dead state from the same death adds nothing. At 90% it stops at 100%. Outside the chamber, with the boss asleep, or in a cave built for one: no change and no `fed`. A Warden in phase 2 fed above half stays in phase 2.
  - "a wipe keeps the tuning": both dead: the remade enemies have the scaled health and the same extras.
  - "the hall is never tuned": with two players in the hall the dummy's `def === EDEF.dummy` and there is one enemy.
- [ ] **Step 2: Run** `node build.mjs && node tests/coop-host.mjs`. Expected: the new checks FAIL (`coopTwoDefs` is not defined).
- [ ] **Step 3: Implement `06c` and the core changes,** then the host (the feed is checked once per tick in `present()` from each proxy's change to `"dead"`), then the client and the lag dial option.
- [ ] **Step 4: Page steps.** `tests/t27.mjs`, "puppets are built to match": `coopSolo({ seed: 99, two: true })`: the puppet count equals the join's list, a husk puppet's `def.hp` is the scaled value, the boss bar's full width stands for the scaled health, and after `DF.coopEnd("left")` and a solo `DF.newRun(99)` a husk's `def.hp === DF.EDEF.husk.hp` and `G.edef === null`. `tests/t28.mjs`, "the feed is announced": tamper in a `fed` for the Warden: the messages include "The Ossuary Warden feeds on the fallen."
- [ ] **Step 5: Run everything `06_game.js` can touch.** `node build.mjs`, then `node tests/coop-host.mjs`, `node tests/coop-wire.mjs`, `node tests/t26-build.mjs`, t27 and t28 (`smoke`), and with `smoke`: t5, t6, t10, t11, t12, t20, t22, t23, t24, t25; with `hub`: t8, t26; `node tests/coop-e2e.mjs`. Expected: all pass, t22 hashes unchanged.
- [ ] **Step 6: Notes.** `coop.md`: a section "A dungeon for two" (when it is decided, `COOP_TWO`, `G.edef`, the extras, the turn rule, the feed and `fed`), `NET.two` and `takeToken` added to the list of `NET` read sites, Known problems (the numbers are untested by hand; a friend joining a cave built for one makes it easier). `enemies.md`: the token rule's co-op case and that `makeEnemy` reads `G.edef`. `zones.md`: `G.edef` in `resetRun`. **Commit:** `feat: a co-op cave entered by two is harder`.

---

### Task 5: Sweep and status

**Files:**
- Modify: `CLAUDE.md` ("Where the project stands": co-op now meets in the hall), `docs/notes/status.md` (this branch's record; the bigger co-op cave and the Warden's extra phases as the next two pieces), `TODO` is the owner's file and is left alone

- [ ] **Step 1: Run every script in `CLAUDE.md`'s table once more** on the final build, plus `DEVICE=iphone-se SCRIPT=$PWD/tests/t30.mjs node test.mjs title` and `node tests/touch-all.mjs tests/t29.mjs`. Expected: all pass. Report any failure with its output; do not edit a solo test to make it pass.
- [ ] **Step 2: Look at** `shots/t29-room.png`, `shots/t28-*.png` and `shots/t9-*.png` (the solo hall, unchanged).
- [ ] **Step 3: Update the two files. Commit:** `docs: record the co-op lobby`.
