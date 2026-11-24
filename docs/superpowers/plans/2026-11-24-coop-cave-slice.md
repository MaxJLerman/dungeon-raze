# Co-op Cave Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two players, each in a browser, play a whole grade E run together over the internet, joined by a six-character room code.

**Architecture:** Every player's page is a client that owns its own character and draws enemies as puppets 100 ms in the past. The host's browser also runs a headless copy of the simulation (files `01` to `06d`) in a Web Worker; it owns the enemies and has no local player. Pages talk to it through one link interface: Worker messages for the host's own page, a WebSocket through a Cloudflare relay for the friend, and a fake link with delay for tests.

**Tech Stack:** The existing dependency-free JavaScript and `build.mjs`; `DataView` for the wire; Web Worker from a Blob URL; one Cloudflare Worker with a Durable Object per room (`wrangler`, a dev dependency only); Node 22 and Playwright for tests.

**Spec:** `docs/superpowers/specs/2026-11-24-coop-cave-slice-design.md`. Read it before any task. Background: `reports/Multiplayer and engine options.md`, section "Gate 1 result".

**Worked example:** the throwaway rig, commit `7a654e0` on branch `spike/lag-rig`. `git show 7a654e0:src/dev/20_net.js` is a working host and client in one file, and `git show 7a654e0 -- src/06_game.js src/07_render.js src/09_main.js build.mjs` shows every core seam in place. Read it; copy ideas, not the file. It differs from this plan in three ways: its host had a local player (a bot), it ran only in dev builds, and it had no real transport.

## Global Constraints

- Read `CLAUDE.md` first. `node build.mjs` after every source change; the page is `dist/index.html`.
- All `src/*.js` share one function scope: declare a name once across `src/`. No imports, no exports, no run-time dependencies.
- Co-op code is core, not dev: nothing of it in `src/dev/` except the lag dial (Task 9). Core must name nothing declared in `src/dev/`.
- The host copy is built from files matching `^0[1-6]`, so anything the host needs is in `06c_coopwire.js` or `06d_coophost.js`. Those files must load in Node and in a Worker: no DOM, no `window`, nothing at top level that touches the screen.
- Core calls the `NET` hooks without checking that each exists, so the host's `NET` and the client's `NET` both define every hook this plan names (`enemies`, `frame`, `onHit`, `onShoot`, `onKill`, `onRespawn`, `onGate`, `onPShot`, `onBlast`, `taken`), as a no-op or `false` where that side has nothing to do.
- With `NET === null` the game behaves exactly as before. Every existing test (`t1` to `t26`, including the cave hashes in `t22`) passes unchanged after every task.
- One new run-time connection is allowed: the relay, opened only when a player hosts or joins.
- Two players only. Player ids are `1` (the host's page) and `2` (the friend).
- Rates and numbers, from the spec: 60 host steps a second, 20 snapshots a second, 30 client states a second, 100 ms draw delay, enemies within 45 m in a snapshot, away after 2 s of silence, clock window 0.6 s, "Waiting for the host" after 1 s without a snapshot, leave after 10 s, target hysteresis 3 m.
- Co-op offers the five base classes. A hidden class falls back to the first base class for the run and the save is not touched.
- The **Play with a friend** button shows only when the address has `?coop=1`.
- New per-run state is cleared in `resetRun()`.
- Never commit a plain plaque code; never read or print `tests/codes.local.*`.
- Commits: conventional prefixes (`feat:`, `fix:`, `test:`, `docs:`, `chore:`). **No `Co-Authored-By` or `Claude-Session` trailers.** Do not push and do not open a PR.

## Review Focus

Inputs the spec implies and no happy-path test exercises, most likely first. Each has a test in the task named.

1. **A stalled connection that then delivers a burst.** A real socket can hold everything for 400 ms and release it at once. Puppets must glide back, not teleport or freeze for good. (Task 6)
2. **Leaving co-op and playing alone.** After a run ends, the host vanishes or the player returns to base, `NET` must be `null` and a solo cave must run enemy AI again. (Task 8)
3. **Joining in the middle of a fight.** Enemies already dead, staggered or mid-swing must appear so, with no burst of kill sounds, rewards or hits. (Task 8)
4. **Two pages on different versions of the game.** One player has a cached older page. They must be told to reload, not shown a broken cave. (Task 11)
5. **A code typed loosely, and buttons pressed twice.** Lower case, spaces and look-alike characters in the code; a second click on Host or Enter. One room, one Worker, one run. (Task 11)

## File Structure

| File | Responsibility |
|---|---|
| `build.mjs` (modify) | Also embeds the host source as `COOP_HOST_SRC` in every build |
| `src/06_game.js` (modify) | `let NET = null` and the seams listed in Tasks 4, 5, 7, 8 |
| `src/06c_coopwire.js` (create) | Constants, cave checksum, snapshot, state and event codecs, the fake link. In both copies |
| `src/06d_coophost.js` (create) | The host role: proxies, targeting, snapshots, applying events, the Worker driver. Active only in the host copy |
| `src/07c_coopclient.js` (create) | The client role: clock, puppets, local hit test, prediction, the other player, links to a Worker and a socket |
| `src/07_render.js`, `src/09_main.js` (modify) | Draw other players; frame seam; `SCREENS` and `MENUS` entries; `DF` additions |
| `src/08e_coopui.js` (create) | The room screen, error messages, the other player's health bar, the waiting overlay |
| `index.tpl.html` (modify) | Markup and styles for the room screen and the two HUD elements |
| `src/dev/20_lagdial.js` (create) | Dev only: `DF.coopSolo`, the ping, jitter and loss sliders, a scripted second player |
| `relay/worker.js`, `relay/wrangler.toml`, `relay/README.md` (create) | The relay |
| `tests/lib/coop.mjs` (create) | Loads the host source in Node; fake clients; a tiny `check` runner |
| `tests/coop-wire.mjs`, `tests/coop-host.mjs`, `tests/coop-caves.mjs`, `tests/coop-relay.mjs`, `tests/coop-e2e.mjs` (create) | Node-run tests |
| `tests/t27.mjs`, `tests/t28.mjs` (create) | Page tests, run with `test.mjs smoke` |

Run commands used throughout:

- Node tests: `node build.mjs && node tests/coop-host.mjs` (each prints `ok` or `FAIL` lines and ends `all passed` or exits 1).
- Page tests: `node build.mjs && SCRIPT=$PWD/tests/t27.mjs node test.mjs smoke`.
- Regression set, run at the end of every task: `node tests/t26-build.mjs`, then `t5`, `t6`, `t12`, `t22` with `smoke` and `t8`, `t26` with `hub`.

---

## Part 1: the host

### Task 1: The host copy builds and loads

**Files:**
- Modify: `build.mjs`, `tests/t26-build.mjs`
- Create: `src/06c_coopwire.js`, `src/06d_coophost.js`, `tests/lib/coop.mjs`, `tests/coop-host.mjs`

**Interfaces:**
- Produces: `COOP_HOST_SRC` (a string constant at the top of the page bundle, in release builds too). Evaluating `new Function("localStorage", "document", "window", "navigator", COOP_HOST_SRC)()` returns the host object `COOP_HOST`.
- Produces in `06c`: `const COOP_V = 1`; `const COOP = { SNAP: 1, STATE: 2, EVENT: 3, STEP: 1 / 60, SNAP_EVERY: 3, STATE_HZ: 30, DELAY: 0.1, RANGE: 45, AWAY: 2, CLOCK_WIN: 0.6, WAIT: 1, GONE: 10, STICK: 3, MAX_DMG: 500 }`; `const COOP_HEADLESS_HERE = typeof COOP_HEADLESS !== "undefined"`.
- Produces in `06d`: `const COOP_HOST = COOP_HEADLESS_HERE ? { start, join, leave, recv, tick, send: null, G, S, worker } : null`. In this task only `start({ seed, grade })` and `G` do anything: `start` calls `newRun(seed, grade)`.
- Produces in `tests/lib/coop.mjs`: `loadHost() -> host object` (reads `dist/index.html`, extracts `COOP_HOST_SRC`, evaluates it as above); `check(name, fn)`; `done()`.

- [ ] **Step 1: Write the failing test** in `tests/coop-host.mjs`:

```js
check("the host copy loads in Node and builds cave 99", () => {
  const h = loadHost();
  h.start({ seed: 99, grade: "E" });
  assert.equal(h.G.enemies.length, 47);
  assert.equal(h.G.world.pos.length / 9, 81835);
});
check("two host copies do not share state", () => {
  const a = loadHost(), b = loadHost();
  a.start({ seed: 99, grade: "E" }); b.start({ seed: 7, grade: "E" });
  assert.notEqual(a.G.world, b.G.world);
});
```

- [ ] **Step 2:** Run `node build.mjs && node tests/coop-host.mjs`. Expected: FAIL, `COOP_HOST_SRC` not found.
- [ ] **Step 3: Build the host source in `build.mjs`.** As the rig's `build.mjs` does, but in every build and with these names: the stub block declares `const COOP_HEADLESS = true;` plus the five stand-ins (`PAD`, `TOUCH`, `RM`, `padName`, `R.setWorld`), and the source ends `return COOP_HOST;`. Escape `<` in the embedded string.
- [ ] **Step 4:** Create the two source files with the interfaces above.
- [ ] **Step 5:** Add to `tests/t26-build.mjs`: the release build contains `COOP_HOST_SRC` and still contains no `devHost`.
- [ ] **Step 6:** Run the Node test (PASS) and the regression set (all pass).
- [ ] **Step 7: Commit** `feat: build a headless host copy of the simulation`.

### Task 2: The same cave in every browser engine

**Files:**
- Modify: `src/06c_coopwire.js`
- Create: `tests/coop-caves.mjs`

**Interfaces:**
- Produces: `coopWorldSum(world) -> string`: FNV-1a, 32 bits, hex, over the bytes of `world.pos` (a `Float32Array`).

- [ ] **Step 1: Write the test.** `tests/coop-caves.mjs` computes `coopWorldSum` for seeds 1 to 40 of grade E in Node, then in each of Playwright's `chromium`, `firefox` and `webkit` on `about:blank` by evaluating the host source there. It prints one line per engine (`firefox 40/40 match`) and lists any seed that differs. It fails only if Chromium differs from Node; a difference in Firefox or WebKit is printed as a finding.
- [ ] **Step 2:** If Firefox or WebKit is not installed for Playwright, run `npx playwright install firefox webkit` (a download of a few hundred MB).
- [ ] **Step 3:** Implement `coopWorldSum`; run the test.
- [ ] **Step 4:** Add to `tests/coop-host.mjs`: `coopWorldSum` of cave 99 is the same string on two fresh host copies.
- [ ] **Step 5: Commit** `test: compare caves across browser engines`. Put the per-engine result in the commit body. If any engine differs on any seed, stop and report it before Task 3: the spec refuses such a browser, and the owner should know which.

### Task 3: The wire

**Files:**
- Modify: `src/06c_coopwire.js`
- Create: `tests/coop-wire.mjs`

**Interfaces (all in the host copy and the page):**
- Every message is an `ArrayBuffer` whose first byte is `COOP.SNAP`, `COOP.STATE` or `COOP.EVENT`. `coopType(buf) -> number`.
- `coopSnapEncode(t, ack, players, enemies) -> ArrayBuffer` and `coopSnapDecode(buf) -> { t, ack, players, en }`.
  - A decoded player: `{ pid, x, z, yaw, state, tt, move, hp, speed, guardT, sprint, away }`. `state` is a name from the player state list, `tt` seconds in that state, `move` a `MOVES` key or `null`, `hp` 0 to 1.
  - A decoded enemy: `{ id, x, z, y, yaw, state, tt, atk, an, hp, post, aware, phase, dead, dur, pin }`. `atk` is an index into `Object.keys(def.atks)` or -1, `an` the attack number (0 to 255), `post` 0 to 1, `pin` the pid executing it or 0.
  - At most 16 bytes a player and 20 an enemy. Positions to 1/32 m, angles to 16 bits, times to 1 ms.
- `coopStateEncode(p) -> ArrayBuffer` from a player object; `coopStateDecode(buf) -> { x, z, yaw, vx, vz, state, tt, move, hp, speed, guardT, sprint }`.
- `coopEventEncode(arr) -> ArrayBuffer` (UTF-8 JSON after the type byte); `coopEventDecode(buf) -> array`. `arr[0]` is the event's name.
- A **link** is `{ send(buf), onmessage, onclose, close() }`. `coopFakePair(cfg) -> { client, host, step(now) }`: two joined links; `cfg` is a live `{ ping, jit, loss, hold }` (ms, ms, percent, boolean). Frames are delivered in order after `ping / 2 ± jit`; a frame "lost" (probability `loss`) arrives `ping + 60` ms later instead, as a retransmit would; while `hold` is true nothing is delivered and everything queued arrives on the first `step` after it clears.

- [ ] **Step 1: Write the failing tests** in `tests/coop-wire.mjs`:

```js
check("a snapshot survives the round trip", () => {
  // one player and two enemies with awkward values: negative positions,
  // yaw just under 2π, state "stagger", atk -1, an 255, pin 2
  // assert every decoded field within its quantum (1/32 m, 2π/65536, 1 ms)
});
check("a snapshot of 31 enemies is at most 700 bytes", () => {});
check("state and event round trips", () => {
  assert.deepEqual(coopEventDecode(coopEventEncode(["hit", 7, 12, 31.5])), ["hit", 7, 12, 31.5]);
});
check("the fake link delays, keeps order and never drops", () => {
  // ping 200, jit 20, loss 50: 200 frames sent 10 ms apart all arrive,
  // in order, none earlier than 80 ms after sending
});
check("a held link delivers the backlog in order when released", () => {});
```

- [ ] **Step 2:** Run; expected FAIL (functions not defined).
- [ ] **Step 3:** Implement the codecs and the fake link. Byte layouts are yours; the rig's `netSnapEncode` is a starting point.
- [ ] **Step 4:** Run (PASS), regression set, **commit** `feat: co-op wire format and a fake link`.

### Task 4: A host with no local player

**Files:**
- Modify: `src/06_game.js`, `src/06d_coophost.js`, `tests/lib/coop.mjs`, `tests/coop-host.mjs`

**Interfaces:**
- Consumes: Task 3's codecs.
- Produces the `NET` seam: `let NET = null;` beside `let DEV = null;` in `06_game.js`. This task adds four reads of it, each inert when `NET` is null:
  1. `update`: `if (NET) NET.enemies(dt); else for (const e of G.enemies) enemyUpdate(e, dt);`
  2. `update`: `playerUpdate(dt)` is skipped when `NET && NET.host`.
  3. `hurtPlayer`: returns `"remote"` at once for a player with `remote` set.
  4. `shoot`: `if (NET) NET.onShoot(<the shot just pushed>)`.
- Produces on the host object:
  - `start({ seed, grade })`: builds the run, gives every enemy `id` (its index in `G.world.spawns`) and `an = 0`, replaces `G.player` with a placeholder (`makePlayer`, `remote: true`, `state: "dead"`, far outside the cave), sets `NET = { host: true, enemies, onShoot, ... }`.
  - `join(pid, cls)`: makes a proxy (`makePlayer(cls)`, `remote: true`, at the cave's start) in `S.px` and sends that client the join event; tells other clients `["peer", pid, cls]`.
  - `leave(pid)`: removes the proxy; tells the others `["peer", pid, null]`.
  - `recv(pid, buf)`: a `STATE` frame moves that proxy and stamps `px.heard`; anything malformed is ignored without throwing.
  - `tick(dt)`: does nothing while no proxy is joined; otherwise accumulates real time, steps `update(COOP.STEP)` with `G.state = "play"`, and after every `COOP.SNAP_EVERY` steps sends each client its snapshot through `host.send(pid, buf)`.
  - `S`: `{ px: Map<pid, proxy>, byId: Map<id, enemy>, step }`.
- The join event: `["join", { v: COOP_V, pid, seed, grade, sum, enemies: [[id, type, x, z, yaw], ...], dead: [id, ...], bossDead, peers: [[pid, cls], ...], t }]`.
- Rules this task implements, from the spec's "Host sim" section:
  - Each enemy's step runs with `G.player` and `G.inBoss` pointed at its target, then restored. The target is the nearest proxy that is joined, not dead and not away, kept unless another is `COOP.STICK` (3 m) nearer; with none, the placeholder.
  - A proxy is **away** when `now - px.heard > COOP.AWAY`.
  - `px.inBoss` follows the same in and out rule `update` uses for `G.inBoss` (inside `bc.r`, out past `bc.r + PURSUIT.bossPad`).
  - An enemy entering `wind` gets `an = (an + 1) & 255`.
  - A client's snapshot holds every other proxy, and each enemy that is aware, not idle, dying, or within `COOP.RANGE` of that client, plus one second of grace after it stops qualifying.
- Produces in `tests/lib/coop.mjs`: `fakeClient(host, pid, cls) -> { join, snap, events, at(x, z, extra), ev(name, ...args) -> seq }` (`at` sends a `STATE` frame, `ev` sends a numbered event `[name, seq, ...args]`; `snap` is the latest decoded snapshot, `events` every decoded host event, `join` the join payload) and `run(host, sec, each)` which ticks at 1/60.

- [ ] **Step 1: Write the failing tests** in `tests/coop-host.mjs` (each starts cave 99 and moves one chosen `husk` and the proxies by hand):

```js
check("joining sends the cave and every enemy", () => {
  // join.v === 1, join.seed === 99, join.enemies.length === 47,
  // join.sum === coopWorldSum(host.G.world), join.dead.length === 0
});
check("an enemy hunts the nearer player and keeps it within 3 m", () => {
  // A at 4 m, B at 6 m, run 1 s -> e.tg === 1
  // B to 2.5 m -> still 1;  B to 0.9 m -> 2
});
check("an away player is not hunted", () => {
  // A alone at 4 m sends no state for 2.5 s -> e.aware === false or e.state "return"
});
check("a dead player is not hunted, and with nobody the enemy goes home", () => {});
check("the boss chamber rule is per player", () => {
  // A inside world.boss radius, B outside beside an aware husk:
  // the husk keeps hunting B; move B inside too -> it gives up
});
check("nothing on the host hurts or moves a proxy", () => {
  // 20 s standing in a pack: px.hp, px.x, px.z unchanged
});
check("snapshots: 20 a second, the other player in each, enemies by range", () => {
  // over 5 s client 1 gets 100 +/- 1 snapshots; players has pid 2 only;
  // an idle enemy 60 m away is absent, one 30 m away present
});
check("leaving removes the proxy, tells the other, and the host plays on", () => {});
check("with nobody joined the host does not step", () => {});
check("a malformed frame is ignored", () => {
  // empty buffer, unknown type, a STATE cut short, an EVENT that is not JSON
});
```

- [ ] **Step 2:** Run; expected FAIL.
- [ ] **Step 3:** Add the four seams to `06_game.js`. Run the regression set now: it must pass before any host code exists.
- [ ] **Step 4:** Implement the host functions above in `06d_coophost.js` and the helpers in `tests/lib/coop.mjs`.
- [ ] **Step 5:** Run (PASS), regression set, **commit** `feat: co-op host with proxies and per-enemy targets`.

### Task 5: What clients can ask of the host

**Files:**
- Modify: `src/06_game.js`, `src/06d_coophost.js`, `tests/coop-host.mjs`

**Interfaces:**
- Seams added to `06_game.js`:
  1. `hitEnemy`: the ambush, backstab and berserk multipliers are skipped when `o.pre` (see the rig's diff), and just before `e.hp -= dmg * mult;`: `if (NET && NET.onHit(e, dmg * mult, post, o)) return;`
  2. `kill`: the boss branch moves, unchanged, into `function bossFell(e)`, which `kill` calls; then at the end of `kill`: `if (NET) NET.onKill(e);`
- Events the host accepts (`seq` is the client's counter; the host records the highest it has processed per client and puts it in that client's snapshots as `ack`):
  - `["hit", seq, eid, dmg, post, flags, src, fx, fz, seenState, seenAn]` with `flags` bit 0 heavy, bit 1 dot. Applied as `hitEnemy(e, dmg, post, { src, heavy, dot, fx, fz, pre: true })` with `G.player` pointed at the proxy. Refused silently when the enemy is unknown or dead or `dmg > COOP.MAX_DMG`.
    - **Favour the attacker:** if the client saw the enemy outside `act` (`seenState !== "act"`), the hit would flinch it (the same poise rule `hitEnemy` uses), and the host's enemy is now in `act` of the same attack (`e.an === seenAn`), the host takes it out of `act` first so the flinch lands.
    - A hit from a player the enemy can see (`world.los`) who is not its target makes that player its target.
  - `["parry", seq, eid, an, pp]`: `e.posture += pp`, then `stagger(e)` if full, else the recoil `hurtPlayer`'s parry branch gives (`state "recoil"`, `dur` 0.55 for a boss and 1.0 otherwise).
  - `["pin", seq, eid]`: if the enemy is staggered and `e.pin` is unset, `e.pin = pid` and its stagger lasts at least 1.5 s more. Otherwise nothing.
  - `["exec", seq, eid]`: honoured only when `e.pin === pid`: `e.hp = 0; kill(e)`.
  - `["gate", seq]`: accepted only when the boss is dead; the host sends everyone `["end", runSeconds]` and stops.
  - `["pshot", seq, x, y, z, vx, vz, r, g, b]` and `["pblast", seq, x, z, radius, r, g, b]`: forwarded to the other client with the sender's pid in place of `seq`.
- Events the host sends (the last element of each is the host time it happened):
  - `["shot", eid, x, y, z, vx, vz, dmg, t]` from `NET.onShoot`.
  - `["ring", x, z, radius, dur, t]` when an enemy with a `slam` attack enters `act`.
  - `["roar", eid, t]` when a boss's `phase` becomes 2. (The code has no push on the roar: it is a sound, a shake and a shock ring of radius 9.)
  - `["kill", eid, pid, t]` once per dead enemy; `pid` is whose hit or execution killed it.
  - `["reset", { enemies, dead, bossDead }, t]` after a wipe, with `enemies` and `dead` shaped as in the join event.
- The name `"spawn"` is reserved for a later event announcing an enemy made after the start (grade E has none). Both sides ignore an event whose name they do not know, without throwing.
- **Wipe:** when at least one proxy is present (joined and not away) and every present proxy is dead, the host calls `spawnEnemies()`, gives the new enemies their ids again (the index of each one's spawn, a dead boss's spawn skipped) and sends `reset`.

- [ ] **Step 1: Write the failing tests** in `tests/coop-host.mjs`:

```js
check("a proposed hit takes exactly the damage sent", () => {
  // husk hp 42: hit dmg 10 -> 32; ack in the next snapshot === that seq
});
check("the host adds no ambush bonus to a proposal", () => {
  // unaware husk, dmg 10 -> hp 32, not 42 - 10 * ambush
});
check("a hit that kills sends one kill with the killer's pid", () => {});
check("favour the attacker: a flinch seen before the swing still lands", () => {
  // host husk put in act with an = 5; hit with seenState "wind", seenAn 5
  // -> state "hit";  same with seenAn 4 -> stays "act"
});
check("a hit over the ceiling, on a dead enemy or an unknown id does nothing", () => {});
check("a hit pulls the enemy onto the hitter", () => {});
check("a parry adds posture and recoils, or staggers when full", () => {});
check("an execution: the first pin wins and only that player's exec kills", () => {
  // both pin in the same step: snapshot pin === 1; exec from 2 -> alive;
  // exec from 1 -> dead, kill event pid 1
});
check("an enemy shot is announced once and never hits a proxy", () => {});
check("the Warden's slam sends a ring and its second phase a roar", () => {});
check("one death resets nothing; both dead resets the enemies", () => {
  // kill 3 husks, player 1 dead -> still 3 dead; player 2 dead too ->
  // a reset event, 47 alive, ids equal to spawn indices
});
check("an away player does not hold up the wipe", () => {});
check("the gate ends the run only once the boss is dead", () => {});
```

- [ ] **Step 2:** Run; expected FAIL.
- [ ] **Step 3:** Add the two seams. `bossFell` is a pure move of code: run `t6` and `t8` before going on.
- [ ] **Step 4:** Implement the event handling.
- [ ] **Step 5:** Run (PASS), regression set, **commit** `feat: co-op host applies hits, parries, executions and wipes`.

---

## Part 2: the client

### Task 6: Enemies as puppets

**Files:**
- Create: `src/07c_coopclient.js`, `src/dev/20_lagdial.js` (only `DF.coopSolo` in this task), `tests/t27.mjs`
- Modify: `src/06_game.js`, `src/09_main.js`

**Interfaces:**
- Seam added to `09_main.js` `frame`: `if (NET && !G.manual) NET.frame(dt);` with the real, unscaled `dt`, before the simulation step.
- Produces in `07c`:
  - `coopMakeHost() -> host object` (a fresh copy from `COOP_HOST_SRC`, with `localStorage`, `document`, `window` and `navigator` out of its reach).
  - `coopBegin(link, { cls, drive, onRefuse }) -> void`: sends `["hello", 0, COOP_V, cls]`, and on the join event enters the cave with `enterCave(grade, seed)`, compares `coopWorldSum(G.world)` with `sum`, replaces `G.enemies` with puppets made from the host's list through `makeEnemy` (ids from the host), and sets `NET = { live: true, enemies, frame, mates: [], ... }`. On a different checksum it closes the link and calls `onRefuse("cave")`. `drive(dt)`, if given, is called every frame to pump a hand-stepped host and link.
  - `coopEnd(why) -> void`: clears `NET`, closes the link, hides co-op HUD parts. Called when `G.world` is no longer the run's world, among others.
  - `CC`: the client's state, exposed as `DF.CC` for tests. It has at least `rt` (the host time being drawn), `est` (estimated host time), `pid`, `byId` (id to puppet), `link`.
- The host must answer `["hello", seq, v, cls]`: this task adds to the host's `recv` that a hello with `v !== COOP_V` gets `["no", "version"]` and no join. (In the solo and Worker drivers the driver calls `host.join` when it sees a matching hello.)
- Puppet rules, as proven on the rig (`netPuppet`, `netAt`, `netClientEnemies`):
  - Position, height and facing are interpolated between the snapshot at or before `CC.rt` and the next. With no later snapshot the puppet holds.
  - State, time in state and attack come from the earlier snapshot, carried forward by `CC.rt - snapshot.t` and by the attack table: `wind` becomes `act` at `atk.wind * (phase === 2 ? 0.85 : 1)`, `act` becomes `rec` at `atk.act`.
  - `SFX.tele`, `SFX.whoosh(true)`, `SFX.stagger` and `SFX.alert` play once per transition, within 30 m.
  - Dead puppets go through `enemyUpdate` for their death animation and are removed when `gone`.
- Clock rules: `CC.est = localNow + max(snapshot.t - arrivalLocalNow)` over the snapshots of the last `COOP.CLOCK_WIN` seconds. `CC.rt` advances by simulation `dt` times `clamp(1 + (target - rt - dt) * 4, 0.5, 2)` where `target = est - COOP.DELAY`, and jumps to `target` when more than 0.6 s off.
- Produces in `src/dev/20_lagdial.js`: `DF.coopSolo({ seed = 99, ping = 0, jit = 0, loss = 0, mate = null, before = null, tamper = null }) -> { host, cfg, step(sec, each), mate, refused }`. It makes a host with `coopMakeHost()`, calls `before(host)` if given (a test's chance to change the host's world before anyone joins), joins this page as pid 1 over `coopFakePair(cfg)`, sets `DEV.run` so nothing is saved, and returns once the join has been applied or refused (pump the link until then). `tamper(eventArray) -> eventArray`, if given, is applied to every event the host sends. `refused` is `null` or the reason given to `onRefuse`. `step(sec, each)` is `DF.sim` with `NET.frame(1/60)` before each step. `mate` is used from Task 8.

- [ ] **Step 1: Write the failing tests** in `tests/t27.mjs` (each `eval` sets `DF.G.manual = true`):

```js
// "puppets follow the host": coopSolo({ ping: 0 }), step 3 s:
//   G.enemies.length === 47; worst |puppet - host enemy| < 0.5 m; NET.live
// "at 200 ms a puppet is where the host's enemy was 200 ms ago": ping 200,
//   record the host husk's x each step while it chases; puppet x at step n
//   within 0.15 m of the host's at step n - 12
// "raising the ping in play leaves every puppet between two snapshots":
//   ping 100, step 2 s; ping 300, step 2 s; over 5 s, among puppets heard
//   from within 0.2 s, fewer than 3% have no snapshot later than CC.rt
// "a stall and a burst": cfg.hold = true for 0.4 s then false; over the next
//   2 s no puppet moves more than 1.5x its type's speed in a step, and after
//   it CC.est - CC.rt is within 20 ms of 0.1               (Review Focus 1)
// "a wind-up becomes a swing on the table's time": a husk winding up:
//   puppet state turns "act" within one step of atk.wind after it turned "wind"
// "a different cave is refused": tamper sets the join's sum to "0":
//   the result's refused === "cave" and DF.net() === null
// "an event with an unknown name is ignored": tamper adds ["later", 1] : no error
```

- [ ] **Step 2:** Run; expected FAIL (`DF.coopSolo` is not a function).
- [ ] **Step 3:** Add the frame seam; implement `07c` to the rules above and `DF.coopSolo`. The puppets' enemy loop is the client's `NET.enemies`.
- [ ] **Step 4:** Run (PASS), regression set (including `t26` with `hub`), **commit** `feat: co-op client draws the host's enemies as puppets`.

### Task 7: Fighting as a client

**Files:**
- Modify: `src/06_game.js`, `src/07c_coopclient.js`, `tests/t27.mjs`

**Interfaces:**
- Seams added to `06_game.js`:
  1. `nearestStaggered` skips an enemy when `NET && NET.taken(e)` (pinned by the other player).
  2. Where a shot with `own: "p"` is pushed to `G.projs` (find every site): `if (NET) NET.onPShot(<shot>)`. In `explode`: `if (NET) NET.onBlast(x, z, r, c)`.
- `CC.pend`: this client's hits the host has not yet acknowledged, each `{ seq, e, dmg, post }`.
- The client's `NET.onKill(e)` sends `exec` when `kill` ran from an execution, and nothing when it ran from a guessed hit (the host reaches that death through the hit itself).
- Client behaviour, from the spec's "Client" section and the rig's `netPuppet` and `netClientHit`:
  - **Hits on this player.** For every puppet in `act` (and a slam as it ends), once per attack number: the shapes `enemyUpdate` uses (plain melee: `t > 0.02 && dist < a.reach + p.r && (dist < e.r + 0.9 || |angDiff(e.yaw, toPlayer)| < a.arc / 2)`; charge: `dist < e.r + p.r + 0.9`; slam at its end: `dist < a.radius`), then the unchanged `hurtPlayer(a.dmg, e, a)`. A `"parry"` result sends `["parry", seq, eid, an, a.pp || (boss ? 30 : 42)]`.
  - **Enemy shots** are made from the `shot` event when `CC.rt` reaches its time, advanced by the time already passed, and flown by the unchanged `projUpdate`.
  - **Ring and roar** events draw the warning ring, and the roar's sound, shake and radius-9 shock ring, at their time.
  - **This player's hits** (`NET.onHit`, which returns true so `hitEnemy` stops): send the `hit` event with the final damage, then show what `hitEnemy` shows from that point (flash, sparks, hit-stop 0.1 heavy or 0.055, shake, focus, sound, rumble) and guess the result: health, posture, and for a non-boss a flinch, stagger or death. A puppet with a guess holds it until a snapshot's `ack` reaches that event's `seq`, or 2 s. A boss's state is never guessed.
  - **Executions:** entering `execute` sends `pin`; finishing sends `exec`. `NET.taken(e)` is true when the latest snapshot has `pin` set to another pid.
  - **Kills:** a `kill` event for an enemy this client has not already killed plays the death without rewards unless `pid === CC.pid`, in which case it gives the rewards `kill` gives (kill count, 6 focus, a 0.4 chance of a tool charge). A boss's kill event calls `bossFell(e)` on every client.
  - Slow motion and hit-stop are untouched: they already stop or slow `CC.rt` because it advances on simulation time.

- [ ] **Step 1: Write the failing tests** in `tests/t27.mjs`, all at `ping: 200, jit: 10, loss: 2` unless stated (the rig's `tests/t27.mjs` at `7a654e0` has working versions of the first five to adapt):

```js
// "an enemy's swing is judged here and hurts": stand 2.5 m in front of the
//   nearest husk, god mode off: within 10 s p.hp < 100
// "holding guard blocks it": hurtPlayer returns "block" within 10 s
// "a late guard parries and the host's enemy is thrown back": the host
//   enemy's state becomes "recoil" or "stagger" within 0.4 s of the parry
// "this player's hits reach the host and kill there": light attacks every
//   0.5 s: host enemy dead, puppet dead, G.kills up by 1, nothing pending
// "the hit shows before the host answers": on the step the attack lands the
//   puppet's flash is 1 and its hp has dropped, while the host's is unchanged
// "a spit is flown and judged here": a spit's shot reaches a still player
//   and hurts; the host's proxy is untouched
// "an execution kills on the host and pays the executor": a staggered husk:
//   after the execution host enemy dead, focus up by 12
// "the Warden: its slam's ring is drawn, a hit on it is not guessed, and its
//   death opens the gate and clears E": DF.resetCleared() first; force the
//   boss to 1 hp on the host; after the kill G.bossDead, G.gate set,
//   DF.gradeCleared("E") === true; reset the save at the end of the step
//   (put gradeCleared, resetCleared and OPT on DF if they are not there)
```

- [ ] **Step 2:** Run; expected FAIL.
- [ ] **Step 3:** Add the seams (regression set must pass), then implement.
- [ ] **Step 4:** Run (PASS), regression set, **commit** `feat: co-op client judges hits on itself and proposes its own`.

### Task 8: The other player, and the party's rules

**Files:**
- Modify: `src/06_game.js`, `src/07_render.js`, `src/09_main.js`, `src/07c_coopclient.js`, `src/08e_coopui.js` (create), `index.tpl.html`, `src/dev/20_lagdial.js`
- Create: `tests/t28.mjs`

**Interfaces:**
- Seams:
  1. `07_render.js`, after the player is drawn: for each `m` of `NET.mates`, `posePlayer(m)`, draw its figure, and a blob shadow unless dead (see the rig's diff).
  2. `09_main.js` `frame`: the simulation also runs while `NET && NET.live` whatever `G.state` is; when it runs outside `"play"` and `"dead"`, every `keys` and `taps` entry is cleared first, so a paused player stands still.
  3. `hurtPlayer`: its `G.state !== "play"` refusal does not apply while `NET && NET.live`.
  4. `respawn`: `if (NET) NET.onRespawn(); else spawnEnemies();`
  5. The exit gate in `playerUpdate`: `if (NET) NET.onGate(); else { G.state = "win"; SFX.win(); }`
- Client behaviour:
  - `NET.mates` holds one player object per other player, made with `makePlayer(cls)`, moved from its snapshot record with the puppets' interpolation; `t`, `state` and `move` from the record so `posePlayer` animates it. It has a marker over its head in its class colour (`R.sprite`), and is shown as away (grey marker, no rim light, or a real fade if the figure shader allows it; say which you chose) when its record has `away`.
  - Its swings make the slash arcs `playerUpdate` makes for the local player, from its move and timing. `pshot` and `pblast` events draw a shot or a blast that hurts nothing.
  - A puppet whose health falls with no pending hit of this client's flashes, with a quiet hit sound.
  - An enemy's shot that comes within 0.8 m of another player's drawn body disappears there.
  - `NET.onRespawn` rebuilds nothing. A `reset` event replaces the puppets from its list. `NET.onGate` sends `gate`; the `end` event sets `G.state = "win"` with the host's run time and then calls `coopEnd("end")`: the room is over.
  - `#coopWait` ("Waiting for the host") shows when no snapshot has arrived for `COOP.WAIT` seconds of real time and hides when one does. After `COOP.GONE` seconds, or when the link closes, `coopEnd("host")` runs, the title screen shows, and `#coopMsg` reads "The host has left."
  - `#mateBar` shows the other player's health under the player's own vitals during a run.
  - The pause screen shows the line "The dungeon does not pause in co-op." during a run.
- `DF.coopSolo`'s `mate` option: `"idle"`, `"follow"` or `"fight"` adds a scripted pid 2 (a fake client on the host end, no screen): idle stands at the start; follow keeps within 3.5 m of player 1 using `world.route` when out of sight; fight also walks to the nearest aware enemy within 10 m and proposes a 14-damage light melee hit every 0.5 to 0.9 s. The returned `mate` has `kill()` (reports itself dead), `revive()`, `away(on)` and `leave()`.

- [ ] **Step 1: Write the failing tests** in `tests/t28.mjs`:

```js
// "the other player is drawn where the host has it": mate "follow", ping 100:
//   after 5 s of walking, |NET.mates[0] - host proxy 2| < 0.6 m
// "its hits show on my puppets": mate "fight" beside a husk: the puppet's
//   flash rises above 0 with CC.pend empty, and G.kills is unchanged when it dies
// "pause does not stop the dungeon": show("pause"), step 3 s with a husk
//   attacking: p.hp falls; with DF.keys[DF.BIND.fwd] held the player has not moved
// "one death resets nothing": 2 husks dead, player dies, respawn(): still 2 dead
// "both dead resets the enemies": mate.kill(), then the player dies: a reset
//   arrives, 47 puppets alive
// "an away mate is marked and the enemies come for me": mate.away(true)
// "an enemy's shot stops at the other player": a spit's shot aimed through
//   the mate is gone from G.projs when it reaches it
// "joining mid-fight": `before` kills 2 husks and staggers one:
//   after joining, those 2 are absent or dead with no SFX.kill call and
//   G.kills === 0, and the staggered one is drawn staggered      (Review Focus 3)
// "the gate ends the run for both": boss dead on the host, walk into the gate:
//   G.state === "win"
// "a silent host": stop stepping the host: #coopWait shows after 1 s; after
//   10 s G.state === "title", DF.net() === null, #coopMsg has "The host has left."
// "after co-op, a solo cave works": DF.enterCave("E", 99); step 5 s near a
//   husk: it becomes aware and moves; DF.net() === null           (Review Focus 2)
// "return to base leaves the run": DF.enterHub("E") during a run -> DF.net() === null
// then: { shot: "t28-mate" } of a fight with the other player in view, and
//   { shot: "t28-wait" } of the waiting overlay
```

- [ ] **Step 2:** Run; expected FAIL.
- [ ] **Step 3:** Add the seams (regression set must pass), then implement. Add `DF.net = () => NET`.
- [ ] **Step 4:** Run (PASS). Open `shots/t28-mate.png` and `shots/t28-wait.png` and check them by eye: the other player is visible, marked and lit like the player; the overlay reads clearly.
- [ ] **Step 5:** Regression set, **commit** `feat: the other player on screen and the co-op party rules`.

### Task 9: The lag dial in the dev menu

**Files:**
- Modify: `src/dev/20_lagdial.js`, `tests/t26.mjs`

**Interfaces:**
- Consumes: `DF.coopSolo`.
- Produces: a dev-menu button `#devCoop` ("Co-op alone, with lag") that calls `DF.coopSolo({ ping: 100, jit: 8, loss: 2, mate: "fight" })` and `play()`; a panel `#lagDial` shown during such a run with sliders for ping (0 to 400 ms), jitter (0 to 60), loss (0 to 15%) and a select for the second player (none, idle, follow, fight), and a readout of kB/s down and up and enemies per snapshot. `[` and `]` change ping by 25 ms in play unless bound to an action.

- [ ] **Step 1:** Add to `tests/t26.mjs`: clicking `#devCoop` starts a run with `DF.net() !== null` and `#lagDial` visible; setting the ping slider to 300 changes the solo link's `cfg.ping`; leaving for the hall hides the panel. Add to `tests/t26-build.mjs`: the release build has no `lagDial`.
- [ ] **Step 2:** Run (FAIL), implement, run (PASS), regression set.
- [ ] **Step 3: Commit** `feat: dev menu starts a co-op run alone with a lag dial`.

---

## Part 3: rooms

### Task 10: The relay

**Files:**
- Create: `relay/worker.js`, `relay/wrangler.toml`, `relay/README.md`, `tests/coop-relay.mjs`
- Modify: `package.json` (add `wrangler` to `devDependencies`), `.gitignore` (`relay/.wrangler/`)

**Interfaces:**
- `POST /new` returns `{ "code": "XXXXXX" }`: six characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, naming a room that is not in use.
- `GET /room/CODE` with `Upgrade: websocket`. The first socket in a room is the host (pid 1), the second the friend (pid 2). These refusals accept the socket and then close it with a code, so that a browser can read the reason: `4004` no such room (a code `/new` never issued, or an expired room), `4001` full.
- Framing, all binary:
  - Friend to host: the relay prepends one byte, the sender's pid.
  - Host to friend: the host's first byte is the addressee's pid; the relay strips it.
  - From the relay itself: the host receives `[0, kind, pid]` and the friend `[0, kind]`, with `kind` 1 joined and 2 left. Type byte 0 is therefore reserved on the wire.
- Limits: a frame over 16,384 bytes closes the sender with `4009`; more than 120 frames in a second closes it with `4008`; a room with no sockets for 10 minutes is forgotten. Allowed origins are the comma-separated `ALLOWED_ORIGINS` variable plus any `http://localhost:*` and `http://127.0.0.1:*`; a request with no `Origin` header is allowed. A refused origin gets HTTP 403 in place of the upgrade (so there is no `4003` close after all: a browser sees only a failed socket).
- Nothing is stored beyond the room's existence and nothing about a player is logged.

- [ ] **Step 1: Write the failing test** `tests/coop-relay.mjs`: it starts `npx wrangler dev --port 8787` in `relay/`, waits for it, and with Node's built-in `WebSocket` checks: a new code matches `/^[A-HJKMNP-Z2-9]{6}$/`; host and friend forward to each other with the pid byte added and stripped as above; the host hears `[0, 1, 2]` when the friend joins and `[0, 2, 2]` when it leaves; the friend hears `[0, 2]` when the host leaves; a third socket closes `4001`; `/room/ZZZZZZ` closes `4004`; an upgrade with `Origin: https://example.com` gets 403 (make that one request with `node:http` and `Upgrade` headers if this Node's `WebSocket` cannot set a header); a 20,000-byte frame closes `4009`. It stops `wrangler` at the end.
- [ ] **Step 2:** `npm install --save-dev wrangler`; run the test; expected FAIL.
- [ ] **Step 3:** Implement the Worker and its Durable Object.
- [ ] **Step 4: Check the cost.** Read Cloudflare's current pricing pages for Workers and Durable Objects. In `relay/README.md` write the free plan's limits beside this game's rates (one room: 20 frames a second from the host, 30 from each client) and how many hours of two-player play a day that allows. If it is under three hours, stop and report before Task 11.
- [ ] **Step 5:** `relay/README.md` also holds the owner's deploy steps: `npx wrangler login`, `npx wrangler deploy` in `relay/`, set `ALLOWED_ORIGINS` to `https://maxjlerman.github.io`, then put the deployed address in `COOP_RELAY` (Task 11). **Do not run `wrangler login` or `wrangler deploy` yourself.**
- [ ] **Step 6:** Run (PASS), **commit** `feat: co-op relay`.

### Task 11: The room screen and real links

**Files:**
- Modify: `src/06d_coophost.js`, `src/07c_coopclient.js`, `src/08e_coopui.js`, `src/09_main.js`, `index.tpl.html`, `CLAUDE.md`, `README.md`
- Create: `tests/coop-e2e.mjs`, `tests/t29.mjs`

**Interfaces:**
- `let COOP_RELAY = ""` (the deployed relay's `wss://` address; empty until the owner deploys) and `const COOP_PAGES = "https://maxjlerman.github.io/dungeon-raze/"` in `08e`. `DF.coopRelay(url)` sets it for tests.
- `COOP_HOST.worker(scope)`: the Worker driver. It listens on `scope.onmessage` for `{ start: { seed, grade, relay, code } }`, starts the run, opens the WebSocket to `relay + "/room/" + code` as the host, and from then on: frames from the page (pid 1) arrive as `ArrayBuffer` messages and go back by `scope.postMessage`; frames from the relay carry the pid byte of Task 10. It calls `join` on a matching hello and `leave` on a relay "left" notice or a closed page. It ticks from `setInterval` at 60 a second using real elapsed time. It posts `{ relay: "open" | "closed" | "error" }` to the page as that changes.
- In `07c`: `coopWorkerLink() -> { link, worker }` (a Worker from a Blob of `"(function(localStorage,document,window,navigator){" + COOP_HOST_SRC + "})().worker(self);"`); `coopSocketLink(url) -> link`.
- Screen `coop` (add to `SCREENS` and `MENUS`), with these ids for tests: `#btnCoop` on the title screen (hidden unless `?coop=1`), `#scr-coop`, `#coopHost`, `#coopCode` (the input), `#coopJoin`, `#coopShow` (the code, large), `#coopCopy`, `#coopSlots` (two slots with class names), `#coopEnter`, `#coopMsg`.
- Flow:
  - **Host a room:** `POST /new`, start the Worker with a random seed, show the code. `#coopEnter` reads "Start" and enters the cave at once (alone if the friend has not arrived).
  - **Join with a code:** the code is upper-cased and spaces and dashes are removed. A character outside the relay's alphabet (which has no `O`, `0`, `1`, `I` or `L`) or a length other than six is refused before any network use with "That code is not valid." Otherwise open the socket and send the hello. `#coopEnter` reads "Waiting for the host to start" and is disabled until the join event arrives, then "Enter the cave".
  - Entering always happens from the player's own click, through `play()`.
  - A second click on `#coopHost`, `#coopJoin` or `#coopEnter` while the first is in progress does nothing.
- Messages, exact text in `#coopMsg`:
  - "No room has that code." (`4004`)
  - "That room is full." (`4001`)
  - "Cannot reach the co-op relay." (fetch or socket failure, a refused origin, or `COOP_RELAY` empty)
  - "This copy of the game cannot play co-op. Play at https://maxjlerman.github.io/dungeon-raze/" (the page is not on that host, `localhost`, `127.0.0.1` or `file:`; checked before any network use)
  - "This browser built a different cave from the host's. Co-op cannot run here." (checksum)
  - "You and the host are on different versions of the game. Both reload the page." (`["no", "version"]`)
  - "This browser cannot host a room." (the Worker could not be created)
  - "The host has left."
- The class used is `OPT.cls` when it is not `hidden`, else the first non-hidden entry of `CLASS_IDS`; `OPT.cls` is not changed.

- [ ] **Step 1: Write the failing page tests** `tests/t29.mjs` (run with `title`; the page is `file:`, so no relay is reachable):

```js
// "#btnCoop is hidden without ?coop=1"
// "a loose code is tidied or refused before the network": " ab-cd ef " is
//   read as ABCDEF; "ABC" and "ABCDE0" give "That code is not valid."
//                                                              (Review Focus 5)
// "with no relay set, hosting says it cannot reach the relay"
// "a hidden class falls back for the run and the save keeps it": with the
//   Enforcer unlocked and chosen, the slot shows the first base class and
//   DF.OPT.cls is still "enforcer"
// "the screen is a menu": Back and Esc return to the title; pad focus lands
//   on #coopHost
// { shot: "t29-room" }
```

- [ ] **Step 2: Write the failing end-to-end test** `tests/coop-e2e.mjs`. It serves `dist/` from a Node `http` server on port 8123, starts the relay as Task 10's test does, opens two Chromium pages at `http://localhost:8123/?coop=1`, calls `DF.coopRelay("ws://localhost:8787")` in each, and checks:
  - Host clicks `#btnCoop`, `#coopHost`: `#coopShow` holds a six-character code. A second click on `#coopHost` makes no second Worker (count `Worker` constructions with an init script). (Review Focus 5)
  - Friend types the code and clicks `#coopJoin`: both pages' `#coopSlots` show two classes.
  - Host clicks `#coopEnter`, then the friend: both are in play with `DF.net() !== null`, 47 enemies each, and the same `coopWorldSum`.
  - The host walks forward 3 s: on the friend's page `DF.net().mates[0]` has moved more than 2 m.
  - The friend reloads, rejoins with the same code and enters: 47 enemies again.
  - **A host page that stops drawing:** in the host page replace `requestAnimationFrame` with a function that never calls back (what a hidden tab does). For the next 5 s the friend's `DF.CC.est` keeps rising, and the host's player is `away` in the friend's snapshots after 2 s. (This imitates a hidden tab; the real thing is checked by hand.)
  - A third page joining gets "That room is full."
  - A page whose hello carries `v: 0` (patch `COOP_V` through an init script that rewrites the hello frame) gets the different-versions message. (Review Focus 4)
  - The host page closes: within 12 s the friend is on the title screen with "The host has left."
- [ ] **Step 3:** Run both; expected FAIL.
- [ ] **Step 4:** Implement the Worker driver, the two links, the screen and its styles (follow the existing `.scr` screens; the code display is large and selectable).
- [ ] **Step 5:** Run both (PASS). Open `shots/t29-room.png` and check it by eye. Also run `DEVICE=oneplus-13 SCRIPT=$PWD/tests/t29.mjs node test.mjs title` and check `shots/oneplus-13-t29-room.png`: nothing overflows and the buttons are finger-sized. Further phone polish waits for the first session.
- [ ] **Step 5b:** When the run ends (`end` sent) or the host's page asks to stop, the Worker closes its socket and is terminated; add that to the end-to-end test (after the host takes the gate, the friend sees the win screen and both have `DF.net() === null`).
- [ ] **Step 6: Document.** In `CLAUDE.md`: a "Co-op" section under "How the systems fit together" (the pieces, the `NET` seam and every place core reads it, the host's placeholder player and target swap, the wire, the clock rule and why it must fall back, the party rules, the relay framing, how to run each co-op test), the changed build rule (the host copy; "no network requests" now excepts the relay), an entry in "Where the project stands", and the slice's limits in "Known problems". In `README.md`: how to host and join, and that it needs `?coop=1` for now.
- [ ] **Step 7:** Regression set, **commit** `feat: co-op rooms, a Worker host and the relay link`.

### Task 12: The whole suite, and the hand-off

**Files:**
- Create: `docs/coop-first-session.md`

- [ ] **Step 1:** Run every test: `node tests/t26-build.mjs`; `t1` to `t7`, `t10` to `t12`, `t20` to `t25`, `t27`, `t28` with `smoke`; `t8`, `t9`, `t18`, `t26` with `hub`; `t13`, `t29` with `title`; `t16`; `node tests/touch-all.mjs tests/t14.mjs`; `node tests/coop-wire.mjs`, `coop-host.mjs`, `coop-caves.mjs`, `coop-relay.mjs`, `coop-e2e.mjs`. Paste the last line of each into the commit body. Any failure is fixed in the task that owns the code, not here.
- [ ] **Step 2:** Measure and record the release page's size before and after this branch (`node build.mjs --release`, bytes of `dist/index.html`, raw and gzipped).
- [ ] **Step 3:** Write `docs/coop-first-session.md`: what the owner does to deploy the relay (from `relay/README.md`) and set `COOP_RELAY`; the link to send a friend; and the five questions from the spec's "What the first sessions must tell us", each with what to do and what to note, including the real hidden-tab check in Chrome, Safari and Firefox.
- [ ] **Step 4: Commit** `docs: co-op first session checklist`.
- [ ] **Step 5:** Report to the owner: what is built, the test results, the page size change, the cross-engine result from Task 2, the relay cost finding from Task 10, and that the next step is theirs (deploy the relay).
