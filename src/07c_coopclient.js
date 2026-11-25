// Co-op: the client. The page joins a host over a link, builds the same world
// (the co-op hall, or a cave from its seed) and draws the host's enemies as
// puppets, COOP.DELAY behind its estimate of the host's clock. A world event
// takes it to the host's next world. While in a run it steps no enemy AI.
// This file is not part of the host copy (it sorts after 06).
//
// CC is the client's state:
//   link     the link to the host; null outside co-op
//   pid      this player's id on the host, from the join event
//   world    the run's world: any other world in G.world ends co-op
//   epoch    the host's number for that world, kind its kind ("hub" or
//            "cave")
//   now      the local clock, real seconds, moved on by NET.frame
//   est      the host's time now as far as this page can tell; -1 before
//            the first snapshot
//   rt       the host time being drawn, moved on by simulation time; -1
//            before the first snapshot
//   offs     { at, off }: when each snapshot of the last COOP.CLOCK_WIN
//            seconds arrived, and its host time less that
//   byId     enemy id -> puppet
//   heard    CC.now when the last snapshot arrived, -1 before one
//   snap     the last snapshot decoded
//   drive    called each frame with dt, to pump a host stepped by hand
//   onRefuse called with the reason when the host or the cave refuses
//   why      why the last co-op run ended (kept by coopClear)
//   seq      the number of this page's last event; they count from 1, one
//            counter per world, and never wrap
//   pend     this player's hits the host has not yet had, each
//            { seq, e, dmg, post, life }: the puppet's health and posture
//            are the host's less these
//   ackR     the highest ack of a snapshot at or before the drawn time
//   evq      host events waiting for the drawn time to reach their time
//   sendAcc  frame time since this player's state was last sent
//   inHit    the seq of the hit being guessed while kill runs from it
//   quiet    true while kill runs for the host's kill event
//   exE      the enemy of the execution under way, once its pin is sent
//   exPin    the seq of that pin; exSkip: its finish was withheld; exRec:
//            its finish has been recorded; exPre: health, focus, tool and
//            kills before its finish
//   fin      { e, pin, seq, at, pre, gain }: a finish that ran here and that
//            the host has not yet answered (see coopFinCheck)
//   judged   how the swings judged here on this player came out, by
//            hurtPlayer's result
//   gate     this player has asked the host to take the party out at the gate
//   trip     this player has asked the host to travel through a hall gate,
//            once per world
//   seed     the seed the first trip asks for (coopBegin's seed), null once
//            used or for a random one
//   portT    G.t when a gate this player may not open last turned it away
//   started  the host's player has pressed Start (from the join, or the
//            started event); until then a friend cannot enter
//
// The other player is in NET.mates: a player from makePlayer, flagged remote,
// never stepped by playerUpdate, moved from its snapshot records (nb) as the
// puppets are. It blocks nothing and nothing hits it.
const CC = {};
function coopClear() {
  Object.assign(CC, {
    link: null,
    pid: 0,
    world: null,
    epoch: 0,
    kind: null,
    now: 0,
    est: -1,
    rt: -1,
    offs: [],
    byId: new Map(),
    heard: -1,
    snap: null,
    drive: null,
    onRefuse: null,
    cls: null,
    seq: 0,
    pend: [],
    ackR: 0,
    evq: [],
    sendAcc: 0,
    inHit: 0,
    quiet: false,
    exE: null,
    exPin: 0,
    exSkip: false,
    exRec: false,
    exPre: null,
    fin: null,
    judged: { hit: 0, block: 0, parry: 0, none: 0 },
    gate: false,
    trip: false,
    seed: null,
    portT: -Infinity,
    started: false,
  });
}
coopClear();
// A puppet glides back to where it should be no faster than this many times
// its type's speed, unless the host's enemy itself was moving faster. Further
// off than COOP_SNAP_D it is put there at once.
const COOP_GLIDE = 1.4,
  COOP_SNAP_D = 6,
  COOP_HEAR = 30, // sounds of puppets further off than this are not played
  COOP_GUESS = 2, // seconds a guess stands without the host's answer
  COOP_FIN_WAIT = 5, // seconds an execution's rewards wait for the host's answer
  COOP_AWAY = [0.42, 0.42, 0.42], // the other player's marker while it is away
  COOP_MATE_HIT = 0.4, // how loud a hit of the other player's sounds here
  COOP_LATE = 1; // seconds late past which a host event is applied silently

// A fresh host copy of the simulation, from the source every build embeds,
// with the page's storage and screen out of its reach.
function coopMakeHost() {
  return new Function("localStorage", "document", "window", "navigator", COOP_HOST_SRC)();
}
// The class co-op plays for a class id: itself when it is a base class, else
// the first base class. The host maps a hello's class the same way.
function coopBaseCls(id) {
  return Object.hasOwn(CLASSES, id) && !CLASSES[id].hidden
    ? id
    : CLASS_IDS.find((k) => !CLASSES[k].hidden);
}

// The host in a Worker on this page, from the same source, with its link.
// The link's send transfers the buffer. close() asks the Worker to stop
// (it closes its relay socket) and terminates it once it says it has, or
// after half a second. link.onrelay(state) hears the Worker's relay socket
// change ("open", "error", "closed"). A Worker that fails, at any time,
// closes the link with "worker". Throws when no Worker can be made.
function coopWorkerLink() {
  const url = URL.createObjectURL(
    new Blob(
      ["(function(localStorage,document,window,navigator){" + COOP_HOST_SRC + "})().worker(self);"],
      { type: "text/javascript" },
    ),
  );
  let worker;
  try {
    worker = new Worker(url);
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  let done = false,
    gone = null;
  const end = () => {
    clearTimeout(gone);
    worker.terminate();
    URL.revokeObjectURL(url);
  };
  const link = {
    onmessage: null,
    onclose: null,
    onrelay: null,
    send(buf) {
      if (done) return;
      try {
        worker.postMessage(buf, [buf]);
      } catch (e) {
        /* terminated */
      }
    },
    close() {
      if (done) return;
      done = true;
      try {
        worker.postMessage({ stop: true });
      } catch (e) {
        /* terminated */
      }
      gone = setTimeout(end, 500);
    },
  };
  worker.onmessage = (ev) => {
    const d = ev.data;
    if (d instanceof ArrayBuffer) {
      if (!done && link.onmessage) link.onmessage(d);
    } else if (d && d.stopped) {
      if (done) end();
    } else if (d && typeof d.relay === "string" && !done && link.onrelay) link.onrelay(d.relay);
  };
  // the host's simulation threw or never started: the run cannot go on
  worker.onerror = () => {
    if (done) return;
    done = true;
    end();
    if (link.onclose) link.onclose("worker");
  };
  return { link, worker };
}

// The friend's link to the host through the relay at url (…/room/CODE). Game
// frames pass through both ways; the relay's own frames do not: [0, 2], the
// host leaving, closes the link (and this socket), and [0, 1] is ignored.
// Events sent before the socket opens wait for it; once open, a state frame
// is dropped rather than queued while the socket is backed up. onclose(why)
// says why it closed: "hostleft" ([0, 2]), "noroom" (4004), "full" (4001)
// or "relay" (anything else, a failed or dropped socket included, and a
// socket that opened but had no join within COOP.GONE: link.joined is set by
// the join). link.viaRelay marks it as the friend's link.
function coopSocketLink(url) {
  const ws = new WebSocket(url);
  ws.binaryType = "arraybuffer";
  let done = false,
    hush = null;
  const early = [];
  const link = {
    onmessage: null,
    onclose: null,
    send(buf) {
      if (done) return;
      const ev = coopType(buf) === COOP.EVENT;
      if (ws.readyState === 0) {
        if (ev) early.push(buf);
      } else if (ws.readyState === 1 && (ev || ws.bufferedAmount <= COOP.SOCK_FULL)) {
        try {
          ws.send(buf);
        } catch (e) {
          /* closing */
        }
      }
    },
    joined: false,
    viaRelay: true,
    close() {
      if (done) return;
      done = true;
      clearTimeout(hush);
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close(1000);
      } catch (e) {
        /* already closed */
      }
    },
  };
  const fin = (why) => {
    if (done) return;
    const f = link.onclose;
    link.close();
    if (f) f(why);
  };
  ws.onopen = () => {
    for (const b of early.splice(0)) link.send(b);
    // a room that never answers (a silent host, or a seat taken in its place)
    hush = setTimeout(() => {
      if (!link.joined) fin("relay");
    }, COOP.GONE * 1000);
  };
  ws.onmessage = (ev) => {
    const d = ev.data;
    if (done || !(d instanceof ArrayBuffer) || d.byteLength < 1) return;
    if (new Uint8Array(d)[0] === 0) {
      if (new Uint8Array(d)[1] === 2) fin("hostleft");
      return;
    }
    if (link.onmessage) link.onmessage(d);
  };
  ws.onerror = () => {};
  ws.onclose = (ev) => fin(ev.code === 4004 ? "noroom" : ev.code === 4001 ? "full" : "relay");
  return link;
}

// Joins the host at the other end of link as class cls. On the join event
// the world is built and the puppets made, and NET is set with live false;
// coopEnter() then lets this player into it. A Worker host that fails after
// the join ends the run with "stopped". drive(dt), if given, is called
// every frame to pump a hand-stepped host and link. seed is what this page's
// first trip through a hall gate asks for (null: a random one). onRefuse(why)
// is called with the reason when the run cannot go ahead here: "version",
// "bad" or "cave" from the host or the join, or the reason a link gives for
// closing before the join was applied (the host leaving then reads as the
// relay). Once it has been, a closed link is the host leaving, except on the
// friend's link through the relay, where only the relay's notice is: any
// other close there, the friend's own connection dropping included, is
// "lost".
function coopBegin(link, { cls, seed = null, drive = null, onRefuse = null } = {}) {
  if (NET || CC.link) coopEnd("restart");
  coopClear();
  coopSay("");
  CC.link = link;
  CC.cls = cls;
  CC.seed = coopNum(seed) ? seed : null;
  CC.drive = drive;
  CC.onRefuse = onRefuse;
  link.onmessage = (buf) => {
    if (CC.link === link) coopRecv(buf);
  };
  link.onclose = (why) => {
    if (CC.link !== link) return;
    if (NET) coopEnd(why === "worker" ? "stopped" : link.viaRelay && why !== "hostleft" ? "lost" : "host");
    else coopRefuse(typeof why === "string" && why !== "hostleft" ? why : "relay");
  };
  link.send(coopEventEncode(["hello", 0, COOP_V, cls, COOP_BUILD]));
}
// Lets this player into the run the join built.
function coopEnter() {
  if (NET && NET.client) NET.live = true;
}
// Leaves co-op, whatever state it was in, and leaves single player working:
// the link is closed and NET (with its mates) and CC are cleared. The run's
// enemies, if it was in one, are plain enemies from here. why "host" (the
// host has gone quiet or closed the link), "stopped" (the host's Worker
// failed), "lost" (the friend's connection to the room went), "cave" (a world
// built here differs from the host's) and "bad" (the host sent a world this
// page cannot read) go back to the base and the title screen and say so; any
// other reason leaves the screen as it is.
function coopEnd(why) {
  const L = CC.link,
    inRun = !!CC.world && G.world === CC.world;
  if (NET && NET.client) {
    NET.mates.length = 0;
    NET = null;
  }
  coopClear();
  CC.why = why;
  if (L) {
    L.onmessage = null;
    L.onclose = null;
    try {
      L.close();
    } catch (e) {
      /* already closed */
    }
  }
  if (why === "host" || why === "stopped" || why === "lost" || why === "cave" || why === "bad") {
    if (inRun) enterHub();
    show("title");
    coopSay(COOP_SAY[why]);
  }
}
// The run cannot go ahead here (before the join was applied, or the join
// itself): co-op ends with the screen left as it is, and onRefuse says why.
function coopRefuse(why) {
  const f = CC.onRefuse,
    inRun = !!CC.world;
  coopEnd("refused");
  CC.why = why;
  // the cave was built only for the run: back to the base
  if (inRun) enterHub();
  if (f) f(why);
}

// A frame from the host. One that does not decode is dropped, and so is an
// event that is not an array or whose name this page does not know.
function coopRecv(buf) {
  let k, m;
  try {
    k = coopType(buf);
    if (k === COOP.SNAP) m = coopSnapDecode(buf);
    else if (k === COOP.EVENT) m = coopEventDecode(buf);
    else return;
  } catch (e) {
    return;
  }
  if (k === COOP.SNAP) {
    if (NET) coopSnap(m);
    return;
  }
  if (!Array.isArray(m)) return;
  if (m[0] === "join") {
    if (!NET) coopJoin(m[1]);
  } else if (m[0] === "no") coopRefuse(typeof m[1] === "string" ? m[1] : "no");
  else if (NET && Object.hasOwn(COOP_TAKE, m[0]) && COOP_TAKE[m[0]](m)) CC.evq.push(m);
  else if (NET && Object.hasOwn(COOP_NOW, m[0]) && COOP_NOW[m[0]](m)) coopNow(m);
}
// The host events that wait for the drawn time, each with the index of its
// host time and its check: every field a number and any enemy named known.
// One that fails is ignored.
const coopNum = (v) => typeof v === "number" && Number.isFinite(v);
const coopNums = (m, n) => m.length >= n && m.slice(1, n).every(coopNum);
const COOP_EV_T = { shot: 8, ring: 5, roar: 2, kill: 3 };
const COOP_TAKE = {
  // ["shot", eid, x, y, z, vx, vz, dmg, t]
  shot: (m) => coopNums(m, 9) && CC.byId.has(m[1]),
  // ["ring", x, z, radius, dur, t]
  ring: (m) => coopNums(m, 6) && m[3] > 0 && m[4] > 0,
  // ["roar", eid, t]
  roar: (m) => coopNums(m, 3) && CC.byId.has(m[1]),
  // ["kill", eid, pid, t]
  kill: (m) => coopNums(m, 4) && CC.byId.has(m[1]),
};
// The host events applied as they arrive, with their checks.
const COOP_NOW = {
  // ["peer", pid, class], or class null when that player has left
  peer: (m) => coopNum(m[1]) && (m[2] === null || typeof m[2] === "string"),
  // ["cls", pid, class]: the other player has changed class
  cls: (m) => coopNum(m[1]) && typeof m[2] === "string",
  // ["reset", { enemies, dead, bossDead }, t]: after a wipe
  reset: (m) => !!m[1] && typeof m[1] === "object" && Array.isArray(m[1].enemies),
  // ["world", { ...description, from, won }]: the host has built another
  // world (coopTravel checks the rest)
  world: (m) => !!m[1] && typeof m[1] === "object" && !Array.isArray(m[1]),
  // ["started"]: the host's player has pressed Start
  started: () => true,
  // ["pshot", pid, x, y, z, vx, vz, r, g, b]: the other player's shot
  pshot: (m) => coopNums(m, 10),
  // ["pblast", pid, x, z, radius, r, g, b]: the other player's blast
  pblast: (m) => coopNums(m, 8) && m[4] > 0,
};

// A world this page can build, as join and world describe it: the hall, or
// a cave of a grade co-op plays from a finite seed, and every list of its
// shape. Checked before anything is built, so a bad one leaves nothing half
// made.
function coopWorldOk(d) {
  const id = (v) => Number.isInteger(v) && v >= 0,
    enemy = (q) =>
      Array.isArray(q) && q.length >= 5 && id(q[0]) && typeof q[1] === "string" && Object.hasOwn(EDEF, q[1]) &&
      coopNum(q[2]) && coopNum(q[3]) && coopNum(q[4]);
  return (
    (d.kind === "hub" || (d.kind === "cave" && COOP.GRADES.includes(d.grade) && coopNum(d.seed))) &&
    typeof d.sum === "string" &&
    Array.isArray(d.enemies) &&
    d.enemies.every(enemy) &&
    Array.isArray(d.dead) &&
    d.dead.every(id) &&
    (d.peers === undefined || Array.isArray(d.peers))
  );
}
// The join: the host's world built here (coopBuild), and NET set. Nothing
// here reads the world's own spawn list. Another wire version is "version";
// anything else this page cannot read is "bad"; a world that differs from
// the host's is "cave".
function coopJoin(j) {
  if (!j || typeof j !== "object" || Array.isArray(j)) return coopRefuse("bad");
  if (typeof j.v === "number" && j.v !== COOP_V) return coopRefuse("version");
  if (j.v !== COOP_V || !coopWorldOk(j) || (j.pid !== 1 && j.pid !== 2)) return coopRefuse("bad");
  CC.pid = j.pid;
  if (!coopBuild(j)) return coopRefuse("cave");
  CC.started = !!j.started;
  CC.link.joined = true;
  NET = {
    client: true,
    live: false,
    mates: [],
    enemies: coopEnemies,
    frame: coopFrame,
    onHit: coopHit,
    onShoot() {},
    onKill: coopKilled,
    // the host owns the enemies: a death here rebuilds nothing
    onRespawn() {},
    onGate: coopGate,
    onPortal: coopPortal,
    onPShot: coopPShot,
    onBlast: coopBlast,
    taken: coopTaken,
  };
  for (const q of Array.isArray(j.peers) ? j.peers : [])
    if (Array.isArray(q) && coopNum(q[0]) && typeof q[1] === "string") coopPeer(q[0], q[1]);
}
// Builds the world d describes, as a join or a world event carries it,
// without leaving co-op: the co-op hall (in front of d.from's gate when it
// came from one) or the grade's cave from its seed. False, with nothing
// more done, when its checksum is not the host's. Otherwise this player is
// made the class co-op plays (where the world put them), the host's enemies
// become the puppets, the gate over a dead boss opens, and everything that
// belonged to the last world goes: event numbers, guesses, queued events,
// an execution under way, a gate or trip asked for, the other player's
// snapshots. Then the host is told this page is there (at).
function coopBuild(d) {
  if (d.kind === "hub") enterHub(typeof d.from === "string" ? d.from : null, true);
  else enterCave(d.grade, d.seed);
  CC.world = G.world;
  if (coopWorldSum(G.world) !== d.sum) return false;
  // a hidden class plays as the first base class, as on the host; the save
  // keeps it
  const cls = coopBaseCls(CC.cls);
  if (cls && G.player.clsId !== cls) {
    const o = G.player;
    G.player = makePlayer(cls);
    Object.assign(G.player, { x: o.x, z: o.z, yaw: o.yaw });
    snapCam();
  }
  coopPuppets(d);
  G.bossDead = !!d.bossDead;
  // built after the boss died: its gate is open, as bossFell leaves it
  if (G.bossDead && G.world.boss) openGate();
  Object.assign(CC, {
    epoch: d.e,
    kind: d.kind,
    seq: 0,
    pend: [],
    ackR: 0,
    evq: [],
    snap: null,
    fin: null,
    exE: null,
    gate: false,
    trip: false,
    heard: CC.now,
  });
  if (NET) for (const m of NET.mates) m.nb = [];
  // this page is in the host's world: until it says so the host ignores it
  coopAsk("at", d.e);
  return true;
}
// The puppets, from the host's list as the join and reset events carry it:
// [id, type, x, z, yaw] each, leaving out the ids in dead and any entry that
// is malformed or names a type this page does not know.
function coopPuppets(r) {
  const dead = new Set(Array.isArray(r.dead) ? r.dead : []);
  CC.byId.clear();
  G.enemies = [];
  for (const q of Array.isArray(r.enemies) ? r.enemies : []) {
    if (!Array.isArray(q)) continue;
    const [id, type, x, z, yaw] = q;
    if (![id, x, z, yaw].every(coopNum) || !Object.hasOwn(EDEF, type) || dead.has(id)) continue;
    const e = makeEnemy({ type, x, z, yaw });
    coopAdopt(e, id);
    G.enemies.push(e);
  }
}
// gx, gz: where the puppet is drawn, kept apart from x and z, which the
// shared code (separate) may push. nb: snapshots heard, oldest first.
// teleAn, actAn: the attack number whose wind-up and swing were last heard.
// hitAn, slamAn: the attack number whose swing or slam was last judged on
// this player. ov: a guess this page made, { seq, life }, which stands
// until a snapshot at the drawn time has had event seq, or life runs out.
// gd: the seq of the event behind a death guessed here, until the host
// answers it. paid: this page has given the rewards of its death.
function coopAdopt(e, id) {
  e.id = id;
  e.nb = [];
  e.gx = e.x;
  e.gz = e.z;
  e.teleAn = e.actAn = -1;
  CC.byId.set(id, e);
}

function coopSnap(s) {
  CC.heard = CC.now;
  CC.snap = s;
  CC.offs.push({ at: CC.now, off: s.t - CC.now });
  for (const r of s.en) {
    const e = CC.byId.get(r.id);
    if (!e) continue;
    r.t = s.t;
    r.ack = s.ack;
    coopBuf(e.nb, r);
  }
  for (const r of s.players) {
    const m = NET.mates.find((o) => o.pid === r.pid);
    if (!m) continue;
    r.t = s.t;
    coopBuf(m.nb, r);
  }
}
// Keeps a short list of snapshots, oldest first; one older than the last is
// dropped.
function coopBuf(nb, r) {
  if (nb.length && r.t <= nb[nb.length - 1].t) return;
  nb.push(r);
  if (nb.length > 40) nb.shift();
}
// The snapshots round the drawn time: A at or before it, B the next if any,
// and k how far between them. null when none is at or before it.
function coopAt(nb, rt) {
  while (nb.length > 1 && nb[1].t <= rt) nb.shift();
  const A = nb[0];
  if (!A || A.t > rt) return null;
  const B = nb[1];
  return { A, B, k: B ? sat((rt - A.t) / (B.t - A.t)) : 0 };
}

// Real time, every frame: sends this player's state COOP.STATE_HZ times a
// second once in the run, whatever the screen, pumps the link (and a
// hand-stepped host) and works out the host's clock: this page's clock plus
// the largest offset of any snapshot of the last COOP.CLOCK_WIN seconds, the
// one that travelled fastest. Only recent ones count, so the estimate falls
// back when the connection slows.
function coopFrame(dt) {
  if (G.world !== CC.world) return coopEnd("world");
  CC.now += dt;
  if (NET.live) {
    const per = 1 / COOP.STATE_HZ;
    CC.sendAcc += dt;
    if (CC.sendAcc >= per - 1e-6) {
      CC.sendAcc = Math.max(0, CC.sendAcc - per) % per;
      if (CC.link) CC.link.send(coopStateEncode(G.player));
    }
  }
  if (CC.drive) CC.drive(dt);
  if (!NET) return;
  // a host not heard from for COOP.GONE seconds of real time has gone; on
  // the friend's link the room may still be there, so it says so
  if (CC.now - CC.heard > COOP.GONE) return coopEnd(CC.link && CC.link.viaRelay ? "lost" : "host");
  const o = CC.offs;
  while (o.length > 1 && o[0].at < CC.now - COOP.CLOCK_WIN) o.shift();
  if (o.length) {
    let m = -Infinity;
    for (const q of o) m = Math.max(m, q.off);
    CC.est = CC.now + m;
  }
}
// Simulation time, in place of the enemy loop: moves the drawn time on,
// faster when it has fallen behind and slower when ahead, and brings every
// puppet to it, after the host events whose time it has reached. Hit-stop
// and slow motion stop or slow it with the rest. Guesses the host has had
// leave the pending list here, and so do those older than COOP_GUESS.
// An enemy that is not a puppet (no snapshots: one a single-player respawn
// made in place of the puppets) is stepped as single player steps it.
function coopEnemies(dt) {
  if (G.world !== CC.world) {
    coopEnd("world");
    for (const e of G.enemies) enemyUpdate(e, dt);
    return;
  }
  const rt0 = CC.rt;
  if (CC.est >= 0) {
    const target = CC.est - COOP.DELAY,
      behind = target - CC.rt;
    if (CC.rt < 0 || Math.abs(behind) > 0.6) CC.rt = target;
    else CC.rt += dt * clamp(1 + (behind - dt) * 4, 0.5, 2);
  }
  const rt = CC.rt,
    drt = Math.abs(rt - rt0);
  coopEvents(rt);
  coopExec();
  for (const e of G.enemies) {
    if (!e.nb) enemyUpdate(e, dt);
    else {
      if (e.dead && e.gd) coopSettle(e, rt);
      if (!e.dead) coopPuppet(e, dt, rt, drt);
      else {
        enemyUpdate(e, dt);
        // a body whose death the host has not answered stays
        if (e.gd) e.gone = false;
        else if (e.gone) CC.byId.delete(e.id);
      }
    }
  }
  for (const q of CC.pend) q.life -= dt;
  CC.pend = CC.pend.filter((q) => q.seq > CC.ackR && q.life > 0);
  for (const m of NET.mates) coopMate(m, dt, rt);
  // an enemy's shot stops at the other player's body, as it would at this one's
  for (const pr of G.projs) {
    if (pr.own !== "e" || pr.life <= 0) continue;
    for (const m of NET.mates)
      if (!m.away && m.state !== "dead" && Math.hypot(pr.x - m.x, pr.z - m.z) < 0.8) {
        pr.life = -1;
        sparks(pr.x, pr.y, pr.z, 6, pr.c, 4, 0.3);
        break;
      }
  }
}
// One enemy as the host had it at the drawn time rt, which moved drt this
// step.
function coopPuppet(e, dt, rt, drt) {
  const p = G.player,
    d = e.def;
  e.flash = Math.max(0, e.flash - dt * 6);
  const at = coopAt(e.nb, rt);
  e.x = e.gx;
  e.z = e.gz;
  if (!at) {
    e.speed = 0;
    return;
  }
  const { A, B, k } = at,
    tx = B ? lerp(A.x, B.x, k) : A.x,
    tz = B ? lerp(A.z, B.z, k) : A.z;
  // After a stall the drawn spot can be well off the host's: glide there.
  // The limit is in drawn time, so while the clock catches up (after slow
  // motion, say) a puppet keeps up with its spot, and the host's own pace
  // between the two snapshots lets a charge or a lunge through at its speed.
  const pace = B ? Math.hypot(B.x - A.x, B.z - A.z) / Math.max(1e-3, B.t - A.t) : 0,
    lim = drt * Math.max(COOP_GLIDE * d.speed, 1.2 * pace),
    gap = Math.hypot(tx - e.gx, tz - e.gz);
  if (gap <= lim || gap > COOP_SNAP_D) {
    e.gx = tx;
    e.gz = tz;
  } else {
    e.gx += ((tx - e.gx) * lim) / gap;
    e.gz += ((tz - e.gz) * lim) / gap;
  }
  const mv = Math.hypot(e.gx - e.x, e.gz - e.z);
  e.x = e.gx;
  e.z = e.gz;
  e.y = B ? lerp(A.y, B.y, k) : A.y;
  e.yaw = B ? A.yaw + angDiff(A.yaw, B.yaw) * k : A.yaw;
  e.speed = dt > 0 ? mv / dt : 0;
  e.walk += (mv * 2.0) / e.fig.o.sc;
  // the host's health and posture, less this player's hits it has not had
  if (A.ack > CC.ackR) CC.ackR = A.ack;
  let pd = 0,
    pp = 0;
  for (const q of CC.pend)
    if (q.e === e && q.seq > A.ack) {
      pd += q.dmg;
      pp += q.post;
    }
  e.hp = A.hp - pd;
  e.posture = Math.min(d.posture, A.post * d.posture + pp);
  e.an = A.an;
  const near = Math.hypot(p.x - e.x, p.z - e.z) < COOP_HEAR;
  // Its health fell by more than this player's own hits explain: the other
  // player's hit (hpV is the health drawn last step, less this player's hits
  // since, which coopHit takes off it).
  if (e.hpV !== undefined && e.hp < e.hpV - 0.25) {
    e.flash = 1;
    if (near) SFX.hit(false, COOP_MATE_HIT);
  }
  e.hpV = e.hp;
  if (A.aware && !e.aware && near) SFX.alert();
  e.aware = A.aware;
  e.phase = A.phase;
  if (A.dead) return coopDie(e, NET.live);
  // a guess stands until the host has had the event it came from, or 2 s
  if (e.ov && (A.ack >= e.ov.seq || (e.ov.life -= dt) <= 0)) e.ov = null;
  if (e.ov) {
    e.t += dt;
    return;
  }
  // The host's state carried on from the snapshot to the drawn time: a
  // wind-up becomes its swing and a swing its recovery on the table's times.
  const keys = Object.keys(d.atks || {}),
    tm = e.phase === 2 ? 0.85 : 1;
  let s = A.state,
    t = A.tt + (rt - A.t),
    a = A.atk >= 0 ? d.atks[keys[A.atk]] || null : null;
  if (!a && (s === "wind" || s === "act" || s === "rec")) s = "chase";
  if (a && s === "wind" && t >= a.wind * tm) {
    s = "act";
    t -= a.wind * tm;
  }
  if (a && s === "act" && t >= a.act) {
    s = "rec";
    t -= a.act;
  }
  if (s === "wind" && e.teleAn !== A.an) {
    e.teleAn = A.an;
    if (near) SFX.tele(!!a.unb);
  }
  if ((s === "act" || s === "rec") && e.actAn !== A.an) {
    e.actAn = A.an;
    if (near) SFX.whoosh(true);
  }
  if (s === "stagger" && e.state !== "stagger") {
    if (near) SFX.stagger();
    sparks(e.x, d.top * 0.6, e.z, 14, AMBER, 5);
  }
  e.state = s;
  e.t = t;
  e.atk = a;
  e.dur = A.dur;
  // the hit test the host's enemyUpdate runs, run here against this player
  if (!a || p.state === "dead" || e.hitAn === A.an) return;
  const dx = p.x - e.x,
    dz = p.z - e.z,
    dist = Math.hypot(dx, dz);
  let hit = false;
  if (a.kind === "slam") {
    // it lands as the swing ends: once a swing, and not long after
    if (s !== "rec" || e.slamAn === A.an || t > 0.2) return;
    e.slamAn = A.an;
    if (near) {
      SFX.slam();
      G.shake = 1;
    }
    G.rings.push({
      x: e.x,
      z: e.z,
      r: a.radius,
      t: 0,
      dur: 0.45,
      kind: "shock",
      c: RED,
    });
    sparks(e.x, 0.3, e.z, 40, [1, 0.5, 0.2], 9, 0.6, 0.16);
    hit = dist < a.radius;
  } else if (s !== "act") return;
  else if (a.kind === "charge") hit = dist < e.r + p.r + 0.9;
  else if (!a.kind)
    hit =
      t > 0.02 &&
      dist < a.reach + p.r &&
      (dist < e.r + 0.9 || Math.abs(angDiff(e.yaw, Math.atan2(dx, dz))) < a.arc / 2);
  if (!hit) return;
  e.hitAn = A.an;
  const res = hurtPlayer(a.dmg, e, a);
  CC.judged[res] = (CC.judged[res] || 0) + 1;
  // hurtPlayer has thrown this copy back; the host does the same to its own
  if (res === "parry") {
    const seq = coopAsk("parry", e.id, A.an, a.pp || (d.boss ? 30 : 42));
    e.ov = { seq, life: COOP_GUESS };
  }
}
// A death the host decided: the look and sound of kill(), none of its
// rewards, and those only when loud and within COOP_HEAR of this player.
// The body then falls through enemyUpdate's dead case.
function coopDie(e, loud = true) {
  const p = G.player;
  e.dead = true;
  e.state = "dead";
  e.t = 0;
  e.y = 0;
  e.ov = null;
  e.gd = 0;
  if (loud && Math.hypot(e.x - p.x, e.z - p.z) < COOP_HEAR) {
    SFX.kill();
    sparks(e.x, e.def.top * 0.5, e.z, 26, e.fig.eye, 7, 0.7, 0.14);
  }
  if (p.lock === e) p.lock = null;
}

// Sends the numbered event [name, seq, ...args] and returns its seq.
function coopAsk(name, ...args) {
  const seq = ++CC.seq;
  if (CC.link) CC.link.send(coopEventEncode([name, seq, ...args]));
  return seq;
}
const coopR2 = (v) => Math.round(v * 100) / 100;
const coopCol = (c) =>
  (Array.isArray(c) ? c : WHITE).slice(0, 3).map((v) => Math.round(v * 1000) / 1000);

// Host events, once the drawn time has reached the moment they happened.
// One applied while the run is not live (queued before this player
// entered) or more than COOP_LATE seconds after its time (a stall, a hidden
// tab) changes state silently: no sound, no big message, no shake.
function coopEvents(rt) {
  if (rt < 0) return;
  const later = [];
  for (const ev of CC.evq) {
    if (ev[COOP_EV_T[ev[0]]] > rt) later.push(ev);
    else coopApply(ev, rt);
  }
  CC.evq = later;
}
function coopApply(ev, rt) {
  const p = G.player,
    t = ev[COOP_EV_T[ev[0]]],
    adv = Math.max(0, rt - t),
    quiet = !NET.live || rt - t > COOP_LATE;
  if (ev[0] === "shot") {
    // an enemy's shot, flown here from where it is by now
    const [, eid, x, y, z, vx, vz, dmg] = ev,
      src = CC.byId.get(eid);
    if (!src) return;
    G.projs.push({
      x: x + vx * adv,
      y,
      z: z + vz * adv,
      vx,
      vz,
      life: 2.6 - adv,
      own: "e",
      dmg,
      src,
      kind: "spit",
      c: src.def.boss ? RED : [1, 0.45, 0.2],
    });
    if (!quiet && Math.hypot(x - p.x, z - p.z) < COOP_HEAR) SFX.shot();
  } else if (ev[0] === "ring") {
    // a slam's warning ring
    const [, x, z, r, dur] = ev;
    if (adv < dur) G.rings.push({ x, z, r, t: adv, dur, kind: "warn", c: RED });
  } else if (ev[0] === "roar") {
    // a boss's second phase, as hitEnemy shows it
    const e = CC.byId.get(ev[1]);
    if (!e || e.dead || quiet) return;
    SFX.roar();
    G.shake = 1;
    G.rings.push({ x: e.x, z: e.z, r: 9, t: 0, dur: 0.6, kind: "shock", c: RED });
    const d = Math.hypot(e.x - p.x, e.z - p.z) || 1;
    if (d < 9 && p.state !== "dead") {
      p.kx = ((p.x - e.x) / d) * 16;
      p.kz = ((p.z - e.z) / d) * 16;
    }
    say("The Warden burns hotter", "", 2.5);
  } else if (ev[0] === "kill") {
    // One already dead here stays as it is, and a death guessed here is
    // settled. Otherwise it dies, with kill's rewards when this player's
    // event caused it (and not already paid for).
    const [, eid, pid] = ev,
      e = CC.byId.get(eid);
    if (!e) return;
    // an execution's finish that paid here: kept only if this player killed it
    if (CC.fin && CC.fin.e === e) {
      if (pid === CC.pid) CC.fin = null;
      else coopTakeBack();
    }
    if (e.dead) e.gd = 0;
    else if (pid === CC.pid && !e.paid) {
      CC.quiet = true;
      try {
        kill(e, quiet);
      } finally {
        CC.quiet = false;
      }
    } else coopDie(e, !quiet);
    if (e.def.boss && !G.bossDead) bossFell(e, quiet);
  }
}

// An execution: its pin is asked for as it begins, and the staggered puppet
// (not a boss, whose state is never guessed) held for it. Once the other
// player is known to have pinned it first, or to have killed it, it plays
// out and gives nothing: the finish (and with it every reward) is marked
// done before it comes. A finish that does run is recorded (CC.fin) until
// the host has answered it, and what it gave is taken back if the kill or
// the pin turns out to have been the other player's.
function coopExec() {
  const p = G.player,
    e = p.exT;
  coopFinCheck();
  if (p.state !== "execute" || !e || !e.nb) {
    CC.exE = null;
    return;
  }
  if (CC.exE !== e) {
    CC.exE = e;
    CC.exPin = 0;
    CC.exSkip = false;
    CC.exRec = false;
    if (!e.dead) {
      CC.exPin = coopAsk("pin", e.id);
      if (!e.def.boss) e.ov = { seq: Infinity, life: 1.6 };
    }
  }
  if (!p.exDone) {
    if (coopTaken(e) || (e.dead && !e.paid)) {
      p.exDone = true;
      CC.exSkip = true;
      e.ov = null;
    } else CC.exPre = { hp: p.hp, focus: p.focus, tool: p.tool, kills: G.kills };
  } else if (!CC.exSkip && !CC.exRec && CC.exPin && CC.exPre) {
    // the finish ran this step: what it gave, and the event it sent
    CC.exRec = true;
    const a = CC.exPre;
    CC.fin = {
      e,
      pin: CC.exPin,
      seq: CC.seq,
      at: CC.now,
      pre: a,
      gain: {
        hp: Math.max(0, p.hp - a.hp),
        focus: Math.max(0, p.focus - a.focus),
        tool: Math.max(0, p.tool - a.tool),
        kills: Math.max(0, G.kills - a.kills),
      },
    };
  }
}
// Settles the finish recorded in CC.fin from the newest snapshot of its
// enemy, once that snapshot has had the pin. Pinned by the other player:
// taken back. Before the host has had the finish, not pinned by this one:
// taken back; pinned by it: a boss's stands, a regular enemy's waits for its
// kill. After: a regular enemy still alive refused the exec, so taken back,
// and a boss's stands. A dead enemy waits for its kill event, which decides
// by its pid. With no answer in COOP_FIN_WAIT seconds what it gave stays.
function coopFinCheck() {
  const f = CC.fin;
  if (!f) return;
  if (CC.now - f.at > COOP_FIN_WAIT) {
    CC.fin = null;
    return;
  }
  const r = f.e.nb[f.e.nb.length - 1];
  if (!r || r.ack < f.pin || r.dead) return;
  const boss = f.e.def.boss;
  if (r.pin && r.pin !== CC.pid) coopTakeBack();
  else if (r.ack < f.seq) {
    if (r.pin !== CC.pid) coopTakeBack();
    else if (boss) CC.fin = null;
  } else if (boss) CC.fin = null;
  else coopTakeBack();
}
// Takes back what the recorded finish gave: health, focus, the tool charge
// and the kill, none below what it was before the finish (or below what it
// is now, if it has fallen since). The enemy's rewards are no longer paid.
function coopTakeBack() {
  const f = CC.fin,
    p = G.player,
    back = (now, gain, pre) => Math.max(now - gain, Math.min(now, pre));
  CC.fin = null;
  p.hp = back(p.hp, f.gain.hp, f.pre.hp);
  p.focus = back(p.focus, f.gain.focus, f.pre.focus);
  p.tool = back(p.tool, f.gain.tool, f.pre.tool);
  G.kills = back(G.kills, f.gain.kills, f.pre.kills);
  f.e.paid = false;
}
// True when the latest snapshot has e pinned by the other player.
function coopTaken(e) {
  const nb = e && e.nb,
    r = nb && nb[nb.length - 1];
  return !!(r && r.pin && r.pin !== CC.pid);
}

// A hit by this player, handed over by hitEnemy once its multipliers are in:
// proposed to the host, and shown here at once with what it will most likely
// do. A boss's state is never guessed, only its health.
function coopHit(e, dmg, post, o, mult = 1) {
  if (!e.nb) return false; // not a puppet: single player's hit
  const p = G.player,
    d = e.def,
    dm = coopR2(dmg),
    po = coopR2(post),
    ox = o.fx !== undefined ? o.fx : p.x,
    oz = o.fz !== undefined ? o.fz : p.z;
  const seq = coopAsk(
    "hit", e.id, dm, po, (o.heavy ? 1 : 0) | (o.dot ? 2 : 0), o.src || "",
    coopR2(ox), coopR2(oz), e.state, e.an || 0,
  );
  const pe = e.state === "stagger" ? 0 : po * (e.state === "wind" ? 1.25 : 1);
  CC.pend.push({ seq, e, dmg: dm, post: pe, life: COOP_GUESS });
  // what hitEnemy shows from here on
  e.flash = 1;
  if (e.hpV !== undefined) e.hpV -= dm;
  hitShow(e, o, mult);
  // the guess: health and posture for every enemy, and for all but a boss
  // its death, stagger or flinch, held until the host has had the hit
  e.hp -= dm;
  e.posture += pe;
  if (d.boss) return true;
  if (e.hp <= 0) {
    // dies here at once; the host reaches the same end through the hit
    if (e.paid) coopDie(e);
    else {
      CC.inHit = seq;
      try {
        kill(e);
      } finally {
        CC.inHit = 0;
      }
    }
    e.gd = seq;
    return true;
  }
  if (hitReact(e, o)) e.ov = { seq, life: COOP_GUESS };
  return true;
}
// kill() ran here. From a guessed hit the host reaches the same end through
// the hit itself; from an execution it has to be told, and the death waits
// for its answer as a guessed one does. Either way its rewards are paid.
function coopKilled(e) {
  if (!e.nb) return;
  e.paid = true;
  if (CC.quiet || CC.inHit) return;
  e.gd = coopAsk("exec", e.id);
}
// A death guessed here, once the host has had the event behind it: it
// stands if the host has the enemy dead or no longer sends it, and is undone
// once a snapshot at the drawn time has had the event and has it alive.
function coopSettle(e, rt) {
  const s = CC.snap;
  if (!s || s.ack < e.gd) return;
  const last = e.nb[e.nb.length - 1];
  if (!last || last.t !== s.t || last.dead) {
    e.gd = 0;
    return;
  }
  const at = coopAt(e.nb, rt);
  if (!at || at.A.ack < e.gd) return;
  if (at.A.dead) e.gd = 0;
  else
    Object.assign(e, {
      dead: false,
      gone: false,
      gd: 0,
      ov: null,
      state: at.A.state,
      t: at.A.tt,
      y: 0,
      vy: 0,
      fallH: 0,
      kick: null,
    });
}

// This player's shots and blasts, for the other player's eyes.
function coopPShot(pr) {
  const r = coopR2;
  coopAsk("pshot", r(pr.x), r(pr.y), r(pr.z), r(pr.vx), r(pr.vz), ...coopCol(pr.c));
}
function coopBlast(x, z, r, c) {
  coopAsk("pblast", coopR2(x), coopR2(z), coopR2(r), ...coopCol(c));
}

// ---- the other player, and the party's rules ----

// A host event that does not wait for the drawn time.
function coopNow(m) {
  const k = m[0];
  if (k === "peer") coopPeer(m[1], m[2]);
  else if (k === "cls") coopMateCls(m[1], m[2]);
  else if (k === "reset") coopReset(m[1]);
  else if (k === "started") CC.started = true;
  else if (k === "world") coopTravel(m[1]);
  else if (k === "pshot") {
    // drawn and flown, and hurts nothing here (projUpdate passes over "m")
    const [, , x, y, z, vx, vz, r, g, b] = m;
    G.projs.push({ x, y, z, vx, vz, life: 3, own: "m", dmg: 0, kind: "arrow", c: [r, g, b] });
  } else if (k === "pblast") {
    // explode's look and sound, with no hit
    const [, , x, z, r, cr, cg, cb] = m,
      p = G.player,
      c = [cr, cg, cb];
    G.rings.push({ x, z, r, t: 0, dur: 0.4, kind: "shock", c });
    sparks(x, 0.8, z, 30, c, 9, 0.6, 0.15);
    if (NET.live && Math.hypot(x - p.x, z - p.z) < COOP_HEAR) {
      G.shake = Math.max(G.shake, 0.3);
      SFX.slam();
    }
  }
}
// The other player joining (cls a class id) or leaving (cls null). A class
// co-op does not offer plays as the first base class, as on the host. Only
// pids 1 and 2 exist, and this page's own is never a mate.
function coopPeer(pid, cls) {
  if ((pid !== 1 && pid !== 2) || pid === CC.pid) return;
  const ms = NET.mates,
    i = ms.findIndex((m) => m.pid === pid);
  if (i >= 0) ms.splice(i, 1);
  if (cls === null) return;
  const m = makePlayer(coopBaseCls(cls));
  // away until a snapshot says otherwise: the host has not heard it yet
  Object.assign(m, { remote: true, pid, nb: [], away: true, ddur: m.cls.dodge.dur, swing: null });
  ms.push(m);
}
// The other player has changed class, on the room screen or mid-run: the
// same mate where it stands, with the same share of health (so no flash),
// as the new class.
function coopMateCls(pid, cls) {
  const m = NET.mates.find((q) => q.pid === pid);
  if (!m) return;
  const n = makePlayer(coopBaseCls(cls)),
    fr = m.maxHp > 0 ? m.hp / m.maxHp : 1;
  Object.assign(m, {
    cls: n.cls,
    clsId: n.clsId,
    maxHp: n.maxHp,
    hp: n.maxHp * fr,
    parryWin: n.parryWin,
    fig: n.fig,
    ddur: n.cls.dodge.dur,
  });
}
// The other player at the drawn time rt: where it was, what it was doing and
// how long it had been at it, so posePlayer animates it; a flash when its
// health falls; and the slash of each swing as it lands.
function coopMate(m, dt, rt) {
  m.flash = Math.max(0, m.flash - dt * 5);
  const at = coopAt(m.nb, rt);
  if (!at) return;
  const { A, B, k } = at,
    x = B ? lerp(A.x, B.x, k) : A.x,
    z = B ? lerp(A.z, B.z, k) : A.z;
  m.x = x;
  m.z = z;
  m.yaw = B ? A.yaw + angDiff(A.yaw, B.yaw) * k : A.yaw;
  m.move = A.move && MOVES[A.move] ? A.move : null;
  m.state = A.state === "attack" && !m.move ? "free" : A.state;
  m.t = A.tt + (rt - A.t);
  m.speed = A.speed;
  m.walk += m.speed * dt * 2.1;
  m.guardT = A.guardT;
  m.sprint = A.sprint;
  m.away = A.away;
  const hp = A.hp * m.maxHp;
  if (hp < m.hp - 0.5) m.flash = 1;
  m.hp = hp;
  coopMateSwing(m, rt);
}
// One slash per swing, made here from its move and timing as playerUpdate
// makes this player's. A swing is its move and the drawn time it began.
function coopMateSwing(m, rt) {
  if (m.state !== "attack") return;
  const mv = MOVES[m.move],
    start = rt - m.t,
    s = m.swing;
  if (!s || s.move !== m.move || Math.abs(s.start - start) > 0.1)
    m.swing = { move: m.move, start, done: false };
  if (m.swing.done || m.t < mv.wind) return;
  m.swing.done = true;
  // a shot or a blast arrives as its own event
  if (mv.proj || mv.blast) return;
  swingArcs(m, mv);
  const p = G.player;
  if (Math.hypot(m.x - p.x, m.z - p.z) < COOP_HEAR) SFX.whoosh(mv.heavy);
}
// After a wipe: the host's enemies, fresh, in place of the puppets, as the
// join makes them. Everything that pointed at the old puppets goes with them:
// every guess and pending hit, the enemies' shots, this player's bombs and
// blasts still due, the lock, and an execution under way (it ends, and sends
// nothing more). A dead player stays dead where they fell, on the dead
// screen; Rise again respawns them as in single player. The kill count, the
// run's time and the boss's death are kept.
function coopReset(r) {
  const p = G.player;
  coopPuppets(r);
  CC.pend = [];
  CC.evq = [];
  CC.fin = null;
  CC.exE = null;
  G.projs = G.projs.filter((o) => o.own !== "e");
  G.bombs = [];
  G.pending = [];
  p.lock = null;
  p.exT = null;
  if (p.state === "execute") {
    p.state = "free";
    p.t = 0;
  }
}
// The exit gate: asked of the host once; its world event takes both players
// back to the hall.
function coopGate() {
  if (CC.gate) return;
  CC.gate = true;
  coopAsk("gate");
}

// ---- travel between worlds ----

// True when this page leads the party: with no co-op run, or as the host's
// own page (pid 1). Only it opens a gate in the hall or returns to base.
function coopLeads() {
  return !NET || !NET.client || CC.pid === 1;
}
// A hall gate this player stands in (NET.onPortal, in place of startTrans).
// The host's page asks the host to travel there, once per world: the first
// trip with coopBegin's seed, any later one with a random seed. The friend
// cannot open a gate and is told so, once each time it steps in.
function coopPortal(grade) {
  if (coopLeads()) {
    if (CC.trip) return;
    CC.trip = true;
    const seed = CC.seed !== null ? CC.seed : (Math.random() * 1e9) | 0 || 7;
    CC.seed = null;
    coopAsk("travel", grade, seed);
    return;
  }
  if (!(G.t - CC.portT < 0.1)) say("Only the host can open a gate.", "", 2.5);
  CC.portT = G.t;
}
// Return to base in a co-op run: the host is asked to take the party to the
// hall (it hears only the host's page).
function coopBase() {
  coopAsk("travel", "hub", 0);
}
// The host has built another world (a world event). A run not yet entered,
// or under reduced motion, builds it at once; otherwise it fades out as a
// solo gate does and builds it at full black (the transition's swap). A
// player dead, paused or in a menu is taken along all the same and arrives
// alive; one on the death screen lands on the play screen. A world this page
// cannot read ends co-op ("bad"), and so does one it builds differently
// ("cave"). From the exit gate (won, the host's run time) it says "OUT
// ALIVE" and the time on arrival, in place of the win screen.
function coopTravel(d) {
  if (!coopWorldOk(d)) return coopEnd("bad");
  const link = CC.link;
  const swap = () => {
    // co-op ended, or another run began, while the fade ran: nothing to do
    if (!NET || CC.link !== link) return;
    if (!coopBuild(d)) {
      coopEnd("cave");
      return false;
    }
    if (G.state === "dead") show("play");
    if (coopNum(d.won)) {
      const t = Math.floor(d.won);
      say("OUT ALIVE", "big", 4);
      say("Time " + Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"), "", 4);
    }
  };
  if (!NET.live || RM) return void swap();
  const tr = G.trans;
  // a second world before the first was built: build that one instead
  if (tr && tr.swap && !tr.swapped) {
    tr.swap = swap;
    return;
  }
  SFX.blink();
  G.trans = { t: tr ? sat(G.fade) * TRANS_HALF : 0, swapped: false, swap };
}
