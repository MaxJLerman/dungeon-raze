// ---------- the lag dial: local builds only ----------
// A co-op run alone: a host copy stepped by hand on this page, joined over
// the fake link, whose ping, jitter and loss can be changed while it runs.
//
// coopSolo({ seed, ping, jit, loss, mate, before, tamper, save }) returns
// { host, cfg, step(sec, each), mate, refused, halt } once the join has been
// applied or refused. before(host) runs before anyone joins. tamper(ev), if
// given, sees every event the host sends this page and returns the event to
// send, a list of them, or null for none. With save false (the default) the
// run is the dev run, so nothing it does is saved. step(sec, each) is DF.sim
// with the link and host pumped before each step. mate "idle", "follow" or
// "fight" adds a scripted second player once this page is in (see
// coopMateBot). While halt is true the host is not stepped and the link
// carries nothing, as if the host had gone quiet. link is this page's end of
// the fake link, and bytes counts what has gone down (host to this page) and
// up over it, for the lag dial's readout.
function coopSolo({
  seed = 99,
  ping = 0,
  jit = 0,
  loss = 0,
  mate = null,
  before = null,
  tamper = null,
  save = false,
} = {}) {
  if (NET || CC.link) coopEnd("restart");
  const host = coopMakeHost(),
    cfg = { ping, jit, loss, hold: false },
    pair = coopFakePair(cfg),
    bytes = { down: 0, up: 0 };
  for (const [end, k] of [[pair.host, "down"], [pair.client, "up"]]) {
    const send = end.send;
    end.send = (buf) => {
      bytes[k] += buf.byteLength;
      return send(buf);
    };
  }
  host.start({ seed, grade: "E" });
  if (before) before(host);
  const out = {
    host,
    cfg,
    link: pair.client,
    bytes,
    mate: null,
    refused: null,
    halt: false,
    step: (sec, each) =>
      DF.sim(sec, (i) => {
        if (NET) NET.frame(1 / 60);
        return each ? each(i) : undefined;
      }),
  };
  host.send = (pid, buf) => {
    if (pid === 2 && out.mate) return out.mate.recv(buf);
    if (pid !== 1) return;
    if (!tamper || coopType(buf) !== COOP.EVENT) return pair.host.send(buf);
    const res = tamper(coopEventDecode(buf));
    if (res === null || res === undefined) return;
    const list = Array.isArray(res) && Array.isArray(res[0]) ? res : [res];
    for (const ev of list) pair.host.send(coopEventEncode(ev));
  };
  pair.host.onmessage = (buf) => host.recv(1, buf);
  pair.host.onclose = () => host.leave(1);
  // the host and the link on one clock
  let now = 0;
  const drive = (dt) => {
    if (out.halt) return;
    if (out.mate) out.mate.step(dt);
    host.tick(dt);
    now += dt;
    pair.step(now);
  };
  coopBegin(pair.client, {
    cls: OPT.cls,
    drive,
    onRefuse: (why) => (out.refused = why),
  });
  // until the join is applied or refused, 10 s at most
  for (let i = 0; i < 600 && !NET && out.refused === null; i++) drive(1 / 60);
  if (NET) {
    if (!save && DEV) DEV.run = G.world;
    coopEnter();
    if (mate) {
      out.mate = coopMateBot(host, mate);
      // until this page has heard of it
      for (let i = 0; i < 600 && NET && !NET.mates.length; i++) drive(1 / 60);
    }
  }
  return out;
}

// Swaps the second player of a solo run: the old one leaves, and mode "idle",
// "follow" or "fight" brings in a new one (any other mode, none).
function coopSetMate(out, mode) {
  const old = out.mate;
  out.mate = null;
  if (old) old.leave();
  if (mode) out.mate = coopMateBot(out.host, mode);
  return out.mate;
}

// The scripted second player, pid 2: a fake client on the host's end, with
// no screen, that talks to the host as a page would (a state 30 times a
// second, numbered events). It plays a melee base class other than this
// page's. mode "idle" stands at the start; "follow" keeps within 3.5 m of
// player 1, by a route when it cannot see them; "fight" also walks to the
// nearest aware enemy within 10 m and swings at it, proposing a 14-damage
// light hit every 0.5 to 0.9 s from within 2.2 m. The returned bot has
// kill() (it reports itself dead), revive(), away(on) (it stops sending, as a
// hidden page does), leave(), p (its player state) and cls; ended is set by
// the host's end event and resets counts its reset events.
function coopMateBot(host, mode) {
  const w = host.G.world,
    wire = host.wire,
    cls = ["fighter", "assassin", "tanker"].find((k) => k !== OPT.cls),
    c = CLASSES[cls],
    mv = MOVES[c.chain],
    per = 1 / COOP.STATE_HZ;
  const p = {
    x: w.spawn.x + 1.4,
    z: w.spawn.z,
    yaw: w.spawnYaw,
    vx: 0,
    vz: 0,
    r: 0.45,
    state: "free",
    t: 0,
    move: null,
    hp: c.hp,
    maxHp: c.hp,
    speed: 0,
    guardT: 0,
    sprint: false,
  };
  w.resolve(p, p.r);
  let seq = 0,
    sendAcc = 0,
    cd = 0,
    tg = null,
    hitDue = false,
    way = null,
    wayT = 0;
  const ask = (name, ...args) => host.recv(2, wire.eventEncode([name, ++seq, ...args]));
  const r2 = (v) => Math.round(v * 100) / 100;
  // walks toward (x, z) at speed sp; resolve keeps it out of the rock
  const walk = (x, z, sp, dt) => {
    const dx = x - p.x,
      dz = z - p.z,
      d = Math.hypot(dx, dz) || 1;
    p.yaw = Math.atan2(dx, dz);
    p.vx = (dx / d) * sp;
    p.vz = (dz / d) * sp;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    w.resolve(p, p.r);
    p.speed = sp;
  };
  const stand = () => {
    p.vx = p.vz = p.speed = 0;
    p.sprint = false;
  };
  const target = () => {
    let best = null,
      bd = 10;
    for (const e of host.G.enemies) {
      if (e.dead || !e.aware || e.hidden || e.state === "fall") continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d < bd && w.los(p.x, p.z, e.x, e.z)) {
        bd = d;
        best = e;
      }
    }
    return best;
  };
  const follow = (dt) => {
    const q = host.S.px.get(1);
    if (!q || q.away || q.state === "dead") return stand();
    const d = Math.hypot(q.x - p.x, q.z - p.z);
    if (d < 3.5) return stand();
    let gx = q.x,
      gz = q.z;
    if (!w.los(p.x, p.z, q.x, q.z)) {
      wayT -= dt;
      if (wayT <= 0 || !way) {
        wayT = 0.5;
        way = w.route(p.x, p.z, q.x, q.z, p.r);
      }
      const n = way && way.find((o) => Math.hypot(o.x - p.x, o.z - p.z) > 0.8);
      if (n) {
        gx = n.x;
        gz = n.z;
      }
    }
    p.sprint = d > 9;
    walk(gx, gz, p.sprint ? c.run : c.walk, dt);
  };
  const bot = {
    pid: 2,
    cls,
    mode,
    p,
    silent: false,
    left: false,
    ended: false,
    resets: 0,
    kill() {
      Object.assign(p, { state: "dead", t: 0, hp: 0, move: null });
      stand();
    },
    revive() {
      Object.assign(p, { state: "free", t: 0, hp: p.maxHp, move: null });
    },
    away(on) {
      bot.silent = !!on;
    },
    leave() {
      if (bot.left) return;
      bot.left = true;
      host.leave(2);
    },
    // what the host sends it: a wipe brings it back at the start, as a page
    // respawns at its first shrine; the end stops it
    recv(buf) {
      if (bot.left || wire.type(buf) !== COOP.EVENT) return;
      const ev = wire.eventDecode(buf);
      if (ev[0] === "reset") {
        bot.resets++;
        if (p.state === "dead") {
          bot.revive();
          p.x = w.spawn.x + 1.4;
          p.z = w.spawn.z;
          w.resolve(p, p.r);
        }
      } else if (ev[0] === "end") bot.ended = true;
    },
    step(dt) {
      // a hidden page neither moves nor sends
      if (bot.left || bot.silent || bot.ended) return;
      p.t += dt;
      cd -= dt;
      if (p.state === "attack") {
        stand();
        if (hitDue && p.t >= mv.wind) {
          hitDue = false;
          if (tg && !tg.dead && Math.hypot(tg.x - p.x, tg.z - p.z) <= 2.2)
            ask("hit", tg.id, 14, mv.post, 0, "melee", r2(p.x), r2(p.z), tg.state, tg.an);
        }
        if (p.t >= mv.wind + mv.act + mv.rec) Object.assign(p, { state: "free", t: 0, move: null });
      }
      if (p.state === "free") {
        tg = mode === "fight" ? target() : null;
        if (tg) {
          const d = Math.hypot(tg.x - p.x, tg.z - p.z);
          if (d > 1.8) walk(tg.x, tg.z, c.walk, dt);
          else {
            stand();
            p.yaw = Math.atan2(tg.x - p.x, tg.z - p.z);
            if (cd <= 0) {
              Object.assign(p, { state: "attack", t: 0, move: c.chain });
              hitDue = true;
              cd = 0.5 + Math.random() * 0.4;
            }
          }
        } else if (mode !== "idle") follow(dt);
        else stand();
      }
      sendAcc += dt;
      if (sendAcc >= per - 1e-6) {
        sendAcc = Math.max(0, sendAcc - per) % per;
        host.recv(2, wire.stateEncode(p));
      }
    },
  };
  host.recv(2, wire.eventEncode(["hello", 0, host.v, cls]));
  return bot;
}
DF.coopSolo = coopSolo;

// ---------- the dev menu's button and the lag dial ----------
// #devCoop starts a run alone over the fake link (coopSolo) and shows the
// panel #lagDial while that run is live: sliders for the link, a select for
// the second player and a readout. The panel is built here, so a release
// build has no trace of it. lagRun is the run the button started, or null.
let lagRun = null;
const LAG_START = { ping: 100, jit: 8, loss: 2, mate: "fight" },
  LAG_SLIDERS = [
    ["ping", "Ping (round trip)", 0, 400, 5, " ms"],
    ["jit", "Jitter", 0, 60, 1, " ms"],
    ["loss", "Packet loss", 0, 15, 1, " %"],
  ],
  LAG_MATES = [["", "none"], ["idle", "idle"], ["follow", "follows"], ["fight", "fights"]];

// true while the run the button started is the one in play
function lagLive() {
  return !!lagRun && !!NET && CC.link === lagRun.out.link;
}
function devCoop() {
  if (NET || CC.link) coopEnd("restart");
  lagRun = null;
  const out = coopSolo({ ...LAG_START });
  if (!NET) return out;
  lagRun = { out, at: performance.now(), down: out.bytes.down, up: out.bytes.up, kbDown: 0, kbUp: 0 };
  lagSync();
  play();
  return out;
}
// shows or hides the panel, and sets its labels from the link
function lagSync() {
  const el = $("lagDial");
  if (!el) return;
  const live = lagLive();
  el.hidden = !live;
  if (!live) return;
  const cfg = lagRun.out.cfg;
  for (const [k, , , , , unit] of LAG_SLIDERS) {
    el.querySelector('[data-lag="' + k + '"]').value = cfg[k];
    el.querySelector('[data-lag-v="' + k + '"]').textContent = cfg[k] + unit;
  }
  el.querySelector("[data-lag-mate]").value = lagRun.out.mate ? lagRun.out.mate.mode : "";
}
// the readout: bytes over the link since it was last read, per second
function lagStat() {
  if (!lagLive()) return;
  const r = lagRun,
    now = performance.now(),
    dt = (now - r.at) / 1000;
  if (dt > 0) {
    r.kbDown = (r.out.bytes.down - r.down) / dt / 1024;
    r.kbUp = (r.out.bytes.up - r.up) / dt / 1024;
  }
  r.at = now;
  r.down = r.out.bytes.down;
  r.up = r.out.bytes.up;
  $("lagStat").textContent =
    "down " + r.kbDown.toFixed(1) + " kB/s, up " + r.kbUp.toFixed(2) + " kB/s\n" +
    (CC.snap ? CC.snap.en.length : 0) + " enemies a snapshot";
}
function lagBuild() {
  const scr = $("scr-dev");
  if (!scr) return;
  const row = document.createElement("div");
  row.className = "row";
  row.innerHTML = '<button type="button" id="devCoop">Co-op alone, with lag</button>';
  scr.querySelector("[data-back]").parentNode.before(row);
  $("devCoop").addEventListener("click", devCoop);
  const el = document.createElement("div");
  el.id = "lagDial";
  el.hidden = true;
  el.style.cssText =
    "position:fixed;left:8px;bottom:8px;z-index:60;width:190px;padding:5px 7px;" +
    "font:11px/1.45 monospace;color:#cfe;background:rgba(0,0,0,.6);" +
    "border:1px solid #4a6;border-radius:4px";
  el.innerHTML =
    '<b style="letter-spacing:1px">LAG DIAL</b> <span style="opacity:.7">[ ] ping</span>' +
    LAG_SLIDERS.map(
      ([k, name, lo, hi, st]) =>
        '<label style="display:block">' + name + ' <span data-lag-v="' + k + '"></span>' +
        '<input type="range" data-lag="' + k + '" min="' + lo + '" max="' + hi +
        '" step="' + st + '" style="width:100%;margin:0"></label>',
    ).join("") +
    '<label style="display:block">Second player <select data-lag-mate>' +
    LAG_MATES.map(([v, name]) => '<option value="' + v + '">' + name + "</option>").join("") +
    "</select></label>" +
    '<pre id="lagStat" style="margin:3px 0 0;font:inherit;white-space:pre-wrap"></pre>';
  document.body.append(el);
  // a press on the panel is the panel's: it starts no attack and asks for no
  // pointer lock, and a control does not keep the keyboard afterwards
  for (const t of ["mousedown", "mouseup", "pointerdown", "touchstart", "wheel"])
    el.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
  for (const i of el.querySelectorAll("[data-lag]"))
    i.addEventListener("input", () => {
      if (!lagLive()) return;
      lagRun.out.cfg[i.dataset.lag] = +i.value;
      lagSync();
    });
  el.addEventListener("change", (e) => {
    if (e.target.matches("[data-lag-mate]") && lagLive()) {
      coopSetMate(lagRun.out, e.target.value);
      lagSync();
    }
    e.target.blur();
  });
  addEventListener("keydown", (e) => {
    if (e.repeat || G.state !== "play" || !lagLive()) return;
    if (e.code !== "BracketLeft" && e.code !== "BracketRight") return;
    if (Object.values(BIND).includes(e.code)) return;
    const cfg = lagRun.out.cfg;
    cfg.ping = clamp(cfg.ping + (e.code === "BracketLeft" ? -25 : 25), 0, 400);
    say("PING " + cfg.ping + " MS", "", 1);
    lagSync();
  });
  // the run can end anywhere (the hall, the host, the end screen), so look
  // for it rather than be told: the panel follows within a quarter second
  let n = 0;
  setInterval(() => {
    lagSync();
    if (++n % 2 === 0) lagStat();
  }, 250);
}
if (DEV) {
  lagBuild();
  Object.assign(DF, { devCoop, lagRun: () => (lagLive() ? lagRun : null) });
}
