// Co-op: the client. The page joins a host over a link, builds the same cave
// from its seed and draws the host's enemies as puppets, COOP.DELAY behind
// its estimate of the host's clock. While in a run it steps no enemy AI.
// This file is not part of the host copy (it sorts after 06).
//
// CC is the client's state:
//   link     the link to the host; null outside co-op
//   pid      this player's id on the host, from the join event
//   world    the run's world: any other world in G.world ends co-op
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
//            counter per run, and never wrap
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
const CC = {};
function coopClear() {
  Object.assign(CC, {
    link: null,
    pid: 0,
    world: null,
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
  COOP_FIN_WAIT = 5; // seconds an execution's rewards wait for the host's answer

// A fresh host copy of the simulation, from the source every build embeds,
// with the page's storage and screen out of its reach.
function coopMakeHost() {
  return new Function("localStorage", "document", "window", "navigator", COOP_HOST_SRC)();
}

// Joins the host at the other end of link as class cls. On the join event
// the cave is built and the puppets made, and NET is set with live false;
// coopEnter() then lets this player into it. drive(dt), if given, is called
// every frame to pump a hand-stepped host and link. onRefuse(why) is called
// with "version" or "cave" when the run cannot go ahead here.
function coopBegin(link, { cls, drive = null, onRefuse = null } = {}) {
  if (NET || CC.link) coopEnd("restart");
  coopClear();
  CC.link = link;
  CC.cls = cls;
  CC.drive = drive;
  CC.onRefuse = onRefuse;
  link.onmessage = (buf) => {
    if (CC.link === link) coopRecv(buf);
  };
  link.onclose = () => {
    if (CC.link === link) coopEnd("closed");
  };
  link.send(coopEventEncode(["hello", 0, COOP_V, cls]));
}
// Lets this player into the run the join built.
function coopEnter() {
  if (NET && NET.client) NET.live = true;
}
// Leaves co-op, whatever state it was in, and leaves single player working:
// the link is closed and NET and CC are cleared. The run's enemies, if it
// was in one, are plain enemies from here.
function coopEnd(why) {
  const L = CC.link;
  if (NET && NET.client) NET = null;
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
}
function coopRefuse(why) {
  const f = CC.onRefuse,
    inRun = !!CC.world;
  coopEnd(why);
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
    if (!NET && m[1] && typeof m[1] === "object") coopJoin(m[1]);
  } else if (m[0] === "no") coopRefuse(typeof m[1] === "string" ? m[1] : "no");
  else if (NET && Object.hasOwn(COOP_TAKE, m[0]) && COOP_TAKE[m[0]](m)) CC.evq.push(m);
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

// The join: the same cave from the seed, checked against the host's sum,
// and the host's enemies as puppets. Nothing here reads the cave's own
// spawn list.
function coopJoin(j) {
  if (j.v !== COOP_V) return coopRefuse("version");
  enterCave(j.grade, j.seed);
  CC.world = G.world;
  if (coopWorldSum(G.world) !== j.sum) return coopRefuse("cave");
  CC.pid = j.pid;
  const dead = new Set(j.dead || []);
  G.enemies = [];
  for (const [id, type, x, z, yaw] of j.enemies || []) {
    if (!EDEF[type] || dead.has(id)) continue;
    const e = makeEnemy({ type, x, z, yaw });
    coopAdopt(e, id);
    G.enemies.push(e);
  }
  G.bossDead = !!j.bossDead;
  NET = {
    client: true,
    live: false,
    mates: [],
    enemies: coopEnemies,
    frame: coopFrame,
    onHit: coopHit,
    onShoot() {},
    onKill: coopKilled,
    onRespawn() {},
    onGate() {},
    onPShot: coopPShot,
    onBlast: coopBlast,
    taken: coopTaken,
  };
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
  if (A.aware && !e.aware && near) SFX.alert();
  e.aware = A.aware;
  e.phase = A.phase;
  if (A.dead) return coopDie(e);
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
// rewards. The body then falls through enemyUpdate's dead case.
function coopDie(e) {
  const p = G.player;
  e.dead = true;
  e.state = "dead";
  e.t = 0;
  e.y = 0;
  e.ov = null;
  e.gd = 0;
  SFX.kill();
  sparks(e.x, e.def.top * 0.5, e.z, 26, e.fig.eye, 7, 0.7, 0.14);
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
    adv = Math.max(0, rt - t);
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
    if (Math.hypot(x - p.x, z - p.z) < COOP_HEAR) SFX.shot();
  } else if (ev[0] === "ring") {
    // a slam's warning ring
    const [, x, z, r, dur] = ev;
    if (adv < dur) G.rings.push({ x, z, r, t: adv, dur, kind: "warn", c: RED });
  } else if (ev[0] === "roar") {
    // a boss's second phase, as hitEnemy shows it
    const e = CC.byId.get(ev[1]);
    if (!e || e.dead) return;
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
        kill(e);
      } finally {
        CC.quiet = false;
      }
    } else coopDie(e);
    if (e.def.boss && !G.bossDead) bossFell(e);
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
