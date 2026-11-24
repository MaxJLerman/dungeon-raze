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
  });
}
coopClear();
// A puppet glides back to where it should be no faster than this many times
// its type's speed, unless the host's enemy itself was moving faster. Further
// off than COOP_SNAP_D it is put there at once.
const COOP_GLIDE = 1.4,
  COOP_SNAP_D = 6,
  COOP_HEAR = 30; // sounds of puppets further off than this are not played

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
}

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
    onHit: () => false,
    onShoot() {},
    onKill() {},
    onRespawn() {},
    onGate() {},
    onPShot() {},
    onBlast() {},
    taken: () => false,
  };
}
// gx, gz: where the puppet is drawn, kept apart from x and z, which the
// shared code (separate) may push. nb: snapshots heard, oldest first.
// teleAn, actAn: the attack number whose wind-up and swing were last heard.
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

// Real time, every frame: pumps the link (and a hand-stepped host) and
// works out the host's clock: this page's clock plus the largest offset of
// any snapshot of the last COOP.CLOCK_WIN seconds, the one that travelled
// fastest. Only recent ones count, so the estimate falls back when the
// connection slows.
function coopFrame(dt) {
  if (G.world !== CC.world) return coopEnd("world");
  CC.now += dt;
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
// puppet to it. Hit-stop and slow motion stop or slow it with the rest.
function coopEnemies(dt) {
  if (G.world !== CC.world) {
    coopEnd("world");
    for (const e of G.enemies) enemyUpdate(e, dt);
    return;
  }
  if (CC.est >= 0) {
    const target = CC.est - COOP.DELAY,
      behind = target - CC.rt;
    if (CC.rt < 0 || Math.abs(behind) > 0.6) CC.rt = target;
    else CC.rt += dt * clamp(1 + (behind - dt) * 4, 0.5, 2);
  }
  const rt = CC.rt;
  for (const e of G.enemies) {
    if (e.dead) {
      enemyUpdate(e, dt);
      if (e.gone) CC.byId.delete(e.id);
    } else coopPuppet(e, dt, rt);
  }
}
// One enemy as the host had it at the drawn time.
function coopPuppet(e, dt, rt) {
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
  // The host's own pace between the two snapshots lets a charge or a lunge
  // through at its real speed.
  const pace = B ? Math.hypot(B.x - A.x, B.z - A.z) / Math.max(1e-3, B.t - A.t) : 0,
    lim = dt * Math.max(COOP_GLIDE * d.speed, 1.2 * pace),
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
  e.hp = A.hp;
  e.posture = A.post * d.posture;
  const near = Math.hypot(p.x - e.x, p.z - e.z) < COOP_HEAR;
  if (A.aware && !e.aware && near) SFX.alert();
  e.aware = A.aware;
  e.phase = A.phase;
  if (A.dead) return coopDie(e);
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
}
// A death the host decided: the look and sound of kill(), none of its
// rewards. The body then falls through enemyUpdate's dead case.
function coopDie(e) {
  const p = G.player;
  e.dead = true;
  e.state = "dead";
  e.t = 0;
  e.y = 0;
  SFX.kill();
  sparks(e.x, e.def.top * 0.5, e.z, 26, e.fig.eye, 7, 0.7, 0.14);
  if (p.lock === e) p.lock = null;
}
