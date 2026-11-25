# Co-op (`06c_coopwire.js`, `06d_coophost.js`, `07c_coopclient.js`, `08e_coopui.js`, `relay/`)

Two players through grade E's cave over the internet. The design is
`docs/superpowers/specs/2026-11-24-coop-cave-slice-design.md`.

- **The pieces.** The host's page runs the normal client and, in a Web
  Worker, a second copy of the simulation, the host. The friend's page runs
  the normal client. The friend reaches the host's Worker through the relay
  (`relay/`, a Cloudflare Worker with one Durable Object per room), over a
  WebSocket from each side. The host's page talks to its own Worker by
  `postMessage`. Each client owns its own player completely (movement,
  health, stamina, flasks, focus, tool charges, rest points, death); the
  host owns every enemy, enemy shots as they are fired, kills, the boss's
  death and resets. Player ids are 1 (the host's page) and 2 (the friend).
- **The host copy.** `build.mjs` joins the files matching `^0[1-6]`
  (through `06d`) with `const COOP_HEADLESS = true` in front, a few stubs
  (`PAD`, `TOUCH`, `RM`, `padName`, `R.setWorld`) behind, and `return
COOP_HOST;`, and embeds the result as the string `COOP_HOST_SRC` in every
  build, release included. So anything the host needs lives in `06c` or
  `06d`, and those files load in Node and in a Worker: no DOM, no `window`,
  nothing at top level that touches the screen. In the page `COOP_HOST` is
  `null` (`COOP_HEADLESS_HERE` is false). `coopMakeHost()` evaluates the
  source on the page with `localStorage`, `document`, `window` and
  `navigator` passed as nothing; `coopWorkerLink()` runs it in a Worker
  made from a Blob of `"(function(localStorage,document,window,navigator){"
  - COOP_HOST_SRC + "})().worker(self);"`, so there is still one HTML file.
`tests/lib/coop.mjs` loads it in Node the same way.
- **`NET`.** `let NET = null` beside `DEV` in `06_game.js`. It is set only
  for the length of a co-op run, by the host copy (`NET.host`) or by the
  client's join (`NET.client`, with `live` false until `coopEnter()`, and
  `mates`, the other player). With it `null` the game is the single-player
  game. Both sides define every hook, as a no-op or `false` where that side
  has nothing to do: `enemies`, `frame`, `onHit`, `onShoot`, `onKill`,
  `onRespawn`, `onGate`, `onPShot`, `onBlast`, `taken`. Core reads it in
  these places and no others:
  - `update`: the host skips `playerUpdate`; with `NET` set
    `NET.enemies(dt)` replaces the enemy loop (the host steps its enemies
    with the swap below, the client moves its puppets). A death under the
    pause screen or a menu shows the dead screen while `NET.live`.
  - `projUpdate` passes over a shot with `own === "m"` (the other player's,
    drawn only).
  - `hitEnemy`: `o.pre` marks a client's proposal applied on the host, its
    multipliers already in the damage; `NET.onHit(...)` true means the
    client has proposed the hit and shown it, and the rest is skipped.
  - `hurtPlayer` returns `"remote"` for a remote player (a proxy or a mate)
    and changes nothing, and judges hits off the play screen while
    `NET.live` (the dungeon does not pause).
  - `kill` calls `NET.onKill(e)`. `bossFell` records no cleared grade on
    the host (`NET.host`), and on a client (`NET.client`) records it under
    `G.player.clsId`, the class that played, in place of `OPT.cls`.
    `kill(e, quiet)` and `bossFell(e, quiet)` take a second argument only
    the client passes: the same state with no sound, sparks, slow motion or
    message. `openGate()` (the gate over the boss's chamber) is shared by
    `bossFell` and a join after the boss's death. `respawn` calls `NET.onRespawn()` in place of
    `spawnEnemies` (one death rebuilds no enemies). `explode` calls
    `NET.onBlast`, the player's `fire` `NET.onPShot`, an enemy's `shoot`
    `NET.onShoot`, and `playerUpdate` at the exit gate `NET.onGate()`.
    `nearestStaggered` skips an enemy `NET.taken(e)` (the other player has
    begun to execute it). `enterHub` ends a client's co-op run
    (`coopEnd("left")`).
  - `09_main.js`: `frame` calls `NET.frame(dt)` every frame in real time
    and runs the simulation under every screen while `NET.live`
    (`coopStill` keeps a paused player still, and the title's own clock
    does not also advance then). `menuGoBack()` is the one way back from a
    menu (its Back button, Esc, the pad's back button, which clicks the
    button, and the touch Back gesture in `08c_touch.js`); on the room
    screen it calls `coopLeaveRoom()` first. `openMenu("coop")` calls
    `coopRoomOpen()`. `07_render.js` draws `NET.mates`; `08_hud.js` calls
    `coopHud()`, which draws the HUD's mate bar, "Waiting for the host" and
    the pause screen's co-op lines.
- **The host's placeholder and the target swap.** The host has no player
  of its own. Each joined player is a proxy (`makePlayer`, flagged `remote`,
  never stepped, moved to where its machine last said it was). `G.player`
  is a placeholder, dead and far off the grid, so code that reads it outside
  an enemy's step finds nobody. Each enemy has a target (`e.tg`, a pid): the
  nearest proxy that is there, alive and not away, kept unless another is
  `COOP.STICK` (3 m) nearer. For each enemy's step `as(px, fn)` points
  `G.player` and `G.inBoss` at that proxy and puts them back after. A hit
  from a player the enemy can see turns it on them. This leaves the
  single-player code and its tests alone, at the cost of the leaks listed in
  Known problems.
- **The wire** (`06c`). Every frame is an `ArrayBuffer` whose first byte is
  its kind: `COOP.SNAP` (1), host to client, 20 a second: host time, the
  ack (the client's highest event seq processed), the other player's record
  and one 19-byte record per enemy that is awake, not idle, dying or within
  `COOP.RANGE` (45 m) of that client, kept a second after it stops
  qualifying; `COOP.STATE` (2), client to host, 30 a second: its player;
  `COOP.EVENT` (3): a JSON array, name first. A client's events are
  numbered (`[name, seq, ...]`, from 1, never wrapping) and are requests:
  `hello` (`["hello", 0, COOP_V, cls, COOP_BUILD]`), `hit`, `parry`, `pin`,
  `exec`, `gate`, `pshot`, `pblast`. The host's events: `join` (seed,
  grade, the cave's checksum, `started`, the enemy list, dead ids, the
  boss's death, the peers), `no` (`["no", "version"]` for a hello whose
  version is not `COOP_V` or whose build is not the host's `COOP_BUILD`, a
  hello with no build included), `started` (the host's page has sent its
  first state, so its player has pressed Start; sent once to a friend
  already in), `shot`, `ring`, `roar`, `kill` (with whose event caused it),
  `reset`, `peer`, `end`, `pshot`, `pblast`. A client checks the join's
  shape before building anything (grade `"E"`, a finite seed, a string sum,
  pid 1 or 2, enemy and dead lists of the right shape with known types) and
  refuses one it cannot read as `"bad"`; it then builds the cave from the
  seed and refuses the run if `coopWorldSum` (FNV-1a over the mesh
  positions) differs; it never reads its own spawn list, only the host's.
  All numbers are in `COOP`.
- **The clock.** The client draws the host's world `COOP.DELAY` (100 ms)
  behind its estimate of the host's time, `CC.est`: its own real-time clock
  plus the largest offset (host time less arrival time) of any snapshot that
  arrived in the last `COOP.CLOCK_WIN` (0.6 s), the one that travelled
  fastest. The window is what lets it fall back: a clock fixed by the
  fastest snapshot ever would stay ahead of the snapshots once the
  connection slows, and the puppets would have nothing to draw. The drawn
  time (`CC.rt`) moves on with simulation time, faster or slower to catch
  the estimate, and jumps when more than 0.6 s off. Events that carry a
  time wait in `CC.evq` until the drawn time reaches it. One applied while
  the run is not live (queued before this player entered) or more than
  `COOP_LATE` (1 s) after its time changes state silently: no sound, big
  message or shake. A kill's sound and sparks play only within `COOP_HEAR`
  (30 m), as the puppets' other sounds do.
- **The client** (`07c`). Puppets are moved from the two snapshots round
  the drawn time; their swings are judged here on this player as the host's
  `enemyUpdate` would, so a guard or parry is decided by what this player
  saw. This player's hits are proposed and shown at once as guesses (health,
  posture, a flinch, a stagger, a death) that stand until a snapshot has
  acked them or 2 s pass. Executions are asked for with `pin` and finished
  with `exec`; the first pin to reach the host wins, and rewards a finish
  gave are taken back if the other player's pin or kill came first.
  `coopBegin(link, { cls, drive, onRefuse })` sends the hello; `coopEnter()`
  makes the run live; `coopEnd(why)` leaves co-op from anything (`"host"`
  goes to the title and says "The host has left.", `"stopped"` does the
  same with "The host's game stopped. The room is closed.", `"lost"` with
  "The connection to the room was lost. You can join again with the same
  code.", `"end"` keeps the win screen, any other reason leaves the screen
  as it is). A link is `{ send(buf), onmessage, onclose(why), close() }`; a
  close before the join is applied goes to `onRefuse` with the link's reason
  (`"hostleft"` reads as `"relay"` there). After it: `"worker"` is
  `"stopped"`; on the friend's link (`link.viaRelay`) only `"hostleft"` is
  `"host"`, and every other close, the friend's own drop included, is
  `"lost"`; on any other link it is `"host"`. An `end` that reaches a
  client not yet live (a friend still on the room screen) is refused as
  `"ended"`, "That run has ended. Ask the host for a new room.", and the
  room screen comes back ready. A join after the boss's death opens the
  gate (`openGate`). `coopPeer` takes pids 1 and 2 only, never its own. A
  hidden class plays as the first base class (`coopBaseCls`), on both
  sides, and the save is not changed.
- **The party rules.** Both arrive at the cave's start; the host starts when
  it likes, the friend may join before or during the run and rejoining is
  joining. The friend cannot enter before the host has pressed Start (the
  join's `started`, or the `started` event; it stays set, so a friend who
  joins mid-run enters at once, and an away or paused host still counts).
  A death is the usual screen and respawn at that player's own
  rest point, and resets no enemies; while one is dead the enemies hunt the
  other. Both dead at once (away players not counted) is a wipe: the host
  makes the enemies again as a respawn does, once per wipe. Rest points are
  each player's own. Kill rewards go to the player whose event killed. The
  boss's death clears E for each in their own save. Either player in the
  gate ends the run for both (`end`, the win screen), and the room closes.
  For another run both exit to the main menu and the host makes a new room;
  no reload is needed (the end-to-end test does it).
  Pause stops nothing. A player the host has not heard for `COOP.AWAY` (2 s)
  is away: not hunted, not counted for a wipe, drawn faded. A client that
  has had no snapshot for `COOP.WAIT` (1 s) shows "Waiting for the host",
  and after `COOP.GONE` (10 s) ends co-op: `"lost"` on the friend's link,
  `"host"` on any other. The friend leaving lets the host play on.
- **The Worker driver** (`COOP_HOST.worker(scope)`). It reads `WebSocket`,
  `setInterval` and `performance` from `scope` or the global, inside that
  function only. The page posts `{ start: { seed, grade, relay, code } }`,
  then its frames, then `{ stop: true }`. It ticks the host from
  `setInterval` at 60 a second with real elapsed time, never more than
  `COOP.TICK_MAX` (0.25 s) a call, so a stalled Worker drops time rather
  than send a backlog. Frames for pid 1 go to the page by `postMessage`
  (the buffer transferred); frames for pid 2 go to the relay with the pid
  byte in front, only while the relay says the friend is in, and a snapshot
  is dropped while the socket has more than `COOP.SOCK_FULL` bytes queued.
  Relay notices are handled there and never reach `recv`. It posts `{
relay: "open" | "error" | "closed" }`; a closed relay leaves the run going
  for the page alone. On `stop`, or once the run has ended, it closes its
  socket and timer; the page then terminates it (`{ stopped: true }`, or
  after 0.5 s). The page's side is `coopWorkerLink()`: a Worker error at
  any time closes the link with `"worker"`, which before the join is the
  refusal "This browser cannot host a room." and after it ends the run
  with `coopEnd("stopped")`.
- **The friend's link** (`coopSocketLink(url)`, with `viaRelay` set) hides
  the relay's framing: game frames pass through; `[0, 2]` (the host left)
  closes the link and the socket with `"hostleft"`; `[0, 1]` is ignored; events sent before the socket opens wait for
  it; once open, a state frame is dropped rather than queued while
  `bufferedAmount` is over `COOP.SOCK_FULL`. A socket that opens and has
  no join within `COOP.GONE` (10 s of real time; `coopJoin` sets
  `link.joined`) is closed: a silent host, or a host whose own socket never
  arrived so the friend took seat 1. A close says `"noroom"` (4004),
  `"full"` (4001) or `"relay"` (anything else, that timeout included), and
  the room screen is left ready to try again. A close after the join is
  `"lost"` (see the client), but for `"hostleft"`.
- **The relay's framing** (`relay/README.md` is the contract). `POST /new`
  gives `{ code }`, six characters without O, 0, 1, I or L. `GET
/room/CODE` upgrades; the first socket in is the host. Friend to host the
  relay prepends the sender's pid byte; host to friend the host's first byte
  is the addressee and is stripped. Its own frames start with 0: the host
  hears `[0, 1, 2]` (joined) and `[0, 2, 2]` (left), the friend `[0, 2]`
  (the host left; the friend must then close its socket). Closes: 4004 no
  such room, 4001 full, 4009 a frame over 16,384 bytes, 4008 a frame
  that finds the socket's token bucket empty (600 frames, refilled at 120 a
  second, two numbers in the room's memory), 1003 a text frame. HTTP 403 for a request whose `Origin`
  is not in the relay's `ALLOWED_ORIGINS` (the Pages site, as deployed) and
  not `http://localhost` or `http://127.0.0.1` on any port; a request with no
  `Origin` header is let through. 429 past the per-address limit. Game frames never start with 0.
- **The room screen** (`08e`, screen `coop` in `SCREENS` and `MENUS`).
  `#btnCoop` ("Play online") on the main menu is always shown, and reaches
  this screen by way of the class screen's Continue; nothing reads
  `?coop=1` any more, and an address that carries it works the same. The
  screen's heading is "Play online", and `coopRoomOpen` writes its first
  line (`#coopSub`): "You play the class you just chose.", or, for a hidden
  class, "The Enforcer cannot play online yet, so you play the Assassin."
  with the two names. `#coopHost` posts to `/new`,
  starts the Worker with a random seed and joins it; it shows the code
  (`#coopShow`, large and selectable, `#coopCopy`), the two slots
  (`#coopSlots`, each `.slot` with `data-cls` once known, `.me` for this
  player) and `#coopEnter` ("Start", which enters at once, alone if need
  be). `#coopJoin` tidies `#coopCode` (upper case, no spaces or dashes) and
  opens the socket; `#coopEnter` reads "Waiting for the host to start",
  disabled, until the join has arrived and the host has started, then
  "Enter the cave". Entering is
  `coopEnter()` then `play()`, from the click. A second click while one is
  under way does nothing. `play()` refuses on an upright touch device; the
  run is live all the same, and a later click (once the device is turned)
  calls `play()` again. Back, Esc, the pad's back button or the touch Back
  gesture on this screen (all through `menuGoBack`) ends a room not yet in
  play (`coopLeaveRoom`), its Worker and the cave the join built, live or
  not. While a hosted room is open and the relay link is up, the pause
  screen shows "Room code" and the code (`#pauseCode`, `#pauseCodeV`,
  selectable); a friend's pause screen shows no code. Before any network use, in order (`coopCheck`): the page must
  be the Pages site, `localhost`, `127.0.0.1` or a `file:`; `COOP_RELAY`
  must be set; a `file:` page is told to run `npm run dev`; a code must be
  six characters of the alphabet. `#coopMsg` is one element, written only by
  `coopSay`, which moves it onto the screen it is written on (the room
  screen while it is up, else the main menu, above its row of buttons);
  opening the room screen clears it. The messages are in `COOP_SAY`, among them `lost` ("The connection
  to the room was lost. You can join again with the same code."), `ended`
  ("That run has ended. Ask the host for a new room.") and `bad` ("The host
  sent something this page could not read. Both reload the page."). `COOP_RELAY` is the deployed relay's
  `wss://` address (empty, co-op says it cannot reach the relay); `POST /new` goes to
  the same address with `http` for `ws`. `DF.coopRelay`, `DF.coopLoc` (a
  stand-in for `location`) and `DF.coopSeed` are for tests.
- **Privacy.** Only game frames cross the link. No name, no chat, no
  analytics, no logging. The relay stores only whether a room exists.
- **The dev lag dial** (`src/dev/20_lagdial.js`, local builds only):
  `coopSolo` runs a co-op run alone over the fake link (`coopFakePair`)
  with a host stepped on the page, and the dev menu's "Co-op alone, with
  lag" button opens a panel with ping, jitter, loss and a scripted second
  player. It is the tool for checking feel. The fake link draws its jitter
  and loss from `cfg.rnd` (`Math.random` when unset); `coopSolo` takes
  `rnd` and otherwise makes a generator from the fixed `LAG_SEED` for each
  run, so a test sees the same jitter and loss every time, while the lag
  dial passes `Math.random`. The game's own random choices (which enemy
  attacks, and when) are not seeded, so a test step must not rest on when
  a hit lands or which frame a loss falls on.

## Tests

- Co-op has its own tests. Run the Node ones after any change to `06c`,
  `06d` or anything the host copy runs; each prints `ok` or `FAIL` lines and
  ends `all passed`:
  - `node tests/coop-host.mjs`: the host copy in Node with scripted fake
    clients (targets and the swap, proposals, parries, executions, kill
    credit, the boss chamber, wipes, joining mid-run), and the Worker
    driver with a stand-in for the Worker's global (the 0.25 s cap, the
    pid byte, relay notices, a closed relay, stop and the end).
  - `node tests/coop-wire.mjs`: the wire formats and the fake link.
  - `node tests/coop-caves.mjs`: caves built from seeds 1 to 40 in Node,
    Chromium, Firefox and WebKit compared by checksum (run it after any
    change to cave generation).
  - `node tests/coop-relay.mjs`: the relay under `wrangler dev` on port 8787
    (started and always stopped by `tests/lib/relay.mjs`, metrics off, no
    login, no deploy).
  - Page tests: `tests/t27.mjs` (the client against a hand-stepped host over
    the fake link: puppets, hits, parries, executions, the checksum) and
    `tests/t28.mjs` (the other player and the party rules), both with
    `smoke`; `tests/t29.mjs` (the room screen up to the network: the button,
    the code's tidying and refusal, every message, the order of the checks,
    the class fallback, a Worker host on the page, Back, Exit to main menu
    from a hosted run and a second room after it, a room that never
    answers, a Start that `play()` refuses, a Worker that fails) with
    `title`, on
    the desktop page and on a phone:
    `DEVICE=oneplus-13 SCRIPT=$PWD/tests/t29.mjs node test.mjs title`. Look
    at `shots/t29-room.png` and `shots/oneplus-13-t29-room.png`.
  - `node tests/coop-e2e.mjs`: end to end. It serves `dist/` on port 8123,
    starts the relay on 8787, and drives Chromium pages: host and join by
    code, both enter, the friend sees the host move, an old version
    refused, the friend reloads and rejoins, a host page that stops drawing
    (marked away after 2 s while the dungeon runs on), a full room, the host
    leaving, the gate ending the run and the room, and then on two fresh
    pages the friend exiting to the main menu (the host plays on), the host
    exiting (the friend is told) and a second room with no reload. The host
    page's address has no `?coop=1` and the friend's has it. Every HTTP request but
    to localhost is aborted (Playwright's routing does not see WebSockets;
    the only socket address the test gives the pages is the local relay). Afterwards `lsof -i :8787` and `lsof -i :8123` must
    show nothing.

## Known problems

- Co-op is grade E, two players and the five base classes, and assumes
  desktop Chrome or Safari. It has not been played by hand or between two
  machines. The relay is deployed on the owner's Cloudflare account, free
  plan; a change to `relay/` reaches players only when the owner runs
  `npx wrangler deploy` again.
- The co-op host never simulates a player, so on the host nothing pushes an
  enemy off a player (each client keeps itself out of the puppets it
  draws). An enemy's last-seen memory can leak between the two players:
  `seeingMate` copies a pack-mate's sighting of the other player, and a
  target switch keeps the old target's last-seen spot.
- D's grabs and the siren's song are not safe on a co-op host: their callers
  treat `hurtPlayer`'s `"remote"` as a hit that landed and would
  `grabPlayer` a proxy. Co-op is E only, where nothing grabs. Fix this
  before hosting D.
- Co-op executions: the first player whose `pin` reaches the host gets the
  kill (the spec said the first to finish). A lost pin's rewards are taken
  back; if the other player's kill event is applied on the very step this
  player's finish runs, the rewards stay. A second execution finished within
  about 0.6 s of an unanswered first one is not checked (high ping only). A
  lost pin on the Warden still lands its 120 damage as an ordinary hit.
- The other player may hit an enemy someone is executing; whoever's hit
  kills it gets the kill.
- A hit sent just before a wipe and arriving just after it lands on the
  fresh enemy that reuses the id (events carry no reset number).
- The other player's hits are shown from a puppet's health dropping, so a
  guess of this player's that expires unanswered after 2 s can replay as the
  other player's flash.
- A reflected (parried) shot is not shown to the other player. The other
  player's shots are drawn when they arrive, about 100 ms ahead of their
  drawn body.
- A guessed-dead enemy that is still alive on the host but further than
  45 m away stays dead on that client.
- A co-op run with more than 65,535 events from one player stops being
  acknowledged: the seq travels in the JSON event and never wraps, but the
  ack in a snapshot is 16 bits, and the host refuses a seq above 65,535.
- The checksum that refuses a different cave covers the world mesh
  positions only.
- In co-op, a dead player's screen still says the enemies come back, which
  is not true of a single death; a class changed in the pause menu mid-run
  is not shown to the other player (and may be a hidden class); a dead
  player's marker floats above the body; a dead player sees no Warden slam
  ring.
- The relay's per-address limit is in memory, per isolate, best effort.
  Nothing caps spending on Cloudflare's paid plan: stay on the free plan,
  where the worst case is that co-op stops until 00:00 UTC. The pricing
  figures in `relay/README.md` were read once and should be checked against
  Cloudflare's pages. The hibernation path is not exercised by the test.
- A co-op host page in a hidden tab: the Worker keeps the dungeon running
  and the host's player is marked away after 2 s (the end-to-end test
  imitates this by stopping animation frames). Whether every browser keeps a
  Worker's timers running in a background tab is unverified.
- The relay closes a socket whose token bucket runs dry: a burst of 600
  frames passes, then 120 a second. The Worker and the friend's link drop
  snapshots and states while the browser's socket queue is backed up and
  never hand the host more than 0.25 s at once, so only frames already
  handed to the operating system before a stall of more than about 10 s
  could still arrive together past the burst.
- Dead enemies stay in every snapshot for the rest of the run (the spec
  said "dying"), about 1 kB a snapshot late in a run. Changing it touches
  how a guessed death is confirmed.
- The relay ends a room the moment the host's socket closes (the spec said
  a room is dropped ten minutes after its last socket closes), and the
  host's Worker does not reconnect, so any drop of the host's connection
  ends co-op for that run.
- Cheating is not guarded against (a non-goal): a client with the code can
  kill every enemy or end the run once the boss is dead.
- Only Chromium has hosted a room. Whether Safari and Firefox send the
  page's origin from a Blob-URL Worker's WebSocket is unverified; if they
  send `null`, the relay refuses that host.
- Whether a friend's hard network drop (Wi-Fi off) leaves seat 2 taken, so
  a rejoin says "That room is full." until Cloudflare notices the dead
  socket, is unverified without a deploy.
- When the relay closes under a host who is playing, the run goes on alone
  and a line says no friend can join; a friend already in is told the host
  has left.
- The dev lag dial's panel swallows a mouse release over it in the
  no-pointer-lock fallback.
