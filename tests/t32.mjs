// The Warden for two on the page: a co-op run alone over the fake link
// (DF.coopSolo with two), the page joined to a host stepped by hand, with
// an idle scripted second player.
// Run with: node build.mjs && SCRIPT=$PWD/tests/t32.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.
export default [
  {
    name: "the boss bar shows three notches for two and none alone",
    eval: async () => {
      const { G } = DF;
      G.manual = true;
      // helpers the later steps share
      const w2 = (window.__w2 = {
        r: null,
        // a co-op run alone: by default big cave 99 built for two, with an
        // idle second player
        start(o = { two: true, seed: 99, mate: "idle" }) {
          if (DF.DEV) DF.devGod(false);
          w2.r = DF.coopSolo(o);
          DF.show("play");
          return w2.r;
        },
        step: (sec, each) => w2.r.step(sec, each),
        host: () => w2.r.host,
        // the host's Warden, and this page's puppet of it
        hostBoss: () => w2.r.host.G.enemies.find((e) => e.def.boss),
        boss: () => G.enemies.find((e) => e.def.boss),
        // a walkable point d metres from the boss chamber's centre, with a
        // clear line to it, as near the direction ang as there is
        inChamber(d, ang = 0) {
          const w = G.world,
            bc = w.boss;
          for (let i = 0; i < 72; i++) {
            const a = ang + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 36,
              x = bc.x + Math.sin(a) * d,
              z = bc.z + Math.cos(a) * d;
            if (w.fieldAt(x, z) > 0.8 && w.los(bc.x, bc.z, x, z)) return { x, z, a };
          }
          return null;
        },
        // stands this player d metres from the chamber's centre, facing
        // the Warden, the camera behind
        standIn(d = 8, ang = 0) {
          const q = w2.inChamber(d, ang),
            p = G.player,
            b = w2.boss();
          if (!q) return false;
          p.x = q.x;
          p.z = q.z;
          p.state = "free";
          p.yaw = DF.cam.yaw = Math.atan2(b.x - q.x, b.z - q.z);
          DF.cam.px = q.x;
          DF.cam.pz = q.z;
          return true;
        },
        // steps, unhurt, until this page's Warden is awake (at most sec);
        // true when it is
        wake(sec = 4) {
          DF.devGod(true);
          try {
            w2.step(sec, () => (w2.boss().aware ? false : undefined));
          } finally {
            DF.devGod(false);
          }
          return w2.boss().aware;
        },
        // the boss bar's notches, each as the share of the bar's width at
        // its centre
        notches() {
          const bar = document.querySelector("#boss .bhp"),
            br = bar.getBoundingClientRect();
          return [...bar.querySelectorAll(".mk")].map((n) => {
            const r = n.getBoundingClientRect();
            return +((r.left + r.width / 2 - br.left) / br.width).toFixed(4);
          });
        },
        barShown: () => document.getElementById("boss").classList.contains("show"),
        frames: () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))),
        // a walkable point d metres from (x, z) with a clear line to it,
        // the nearest to the chamber's centre's side there is
        spotFrom(x, z, d) {
          const w = G.world,
            bc = w.boss,
            a0 = Math.atan2(bc.x - x, bc.z - z);
          for (let i = 0; i < 72; i++) {
            const a = a0 + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 36,
              qx = x + Math.sin(a) * d,
              qz = z + Math.cos(a) * d;
            if (w.fieldAt(qx, qz) > 0.8 && w.los(x, z, qx, qz)) return { x: qx, z: qz };
          }
          return null;
        },
        // A run for two with the Warden at phase n, then a slam forced on the
        // host's Warden that lands where it stands, with this player dist
        // metres from that spot, facing it. Returns the landing's place.
        slamSetup(n, dist = 12) {
          w2.start();
          const c = { stood: w2.standIn(8), awake: w2.wake() };
          if (n > 1) {
            c.entered = !!w2.host().phase(n);
            DF.devGod(true);
            try {
              w2.step(4, () => (w2.hostBoss().state === "roar" ? undefined : false));
            } finally {
              DF.devGod(false);
            }
          }
          const hb = w2.hostBoss(),
            q = w2.spotFrom(hb.x, hb.z, dist),
            p = G.player;
          c.spot = !!q;
          p.x = q.x;
          p.z = q.z;
          p.state = "free";
          p.vx = p.vz = 0;
          p.yaw = DF.cam.yaw = Math.atan2(hb.x - q.x, hb.z - q.z);
          DF.cam.px = q.x;
          DF.cam.pz = q.z;
          // its slam, as the host's own wind-up would end: in the act, the
          // slam landing where it stands
          Object.assign(hb, {
            state: "act",
            atk: hb.def.atks.slam,
            t: 0,
            hitDone: false,
            an: (hb.an + 1) & 255,
            sx: hb.x,
            sz: hb.z,
            tx: hb.x,
            tz: hb.z,
          });
          c.phase = hb.phase;
          return { x: hb.x, z: hb.z, c };
        },
        // steps sec seconds with the host's Warden kept in its recovery, so
        // that nothing else it does reaches this player; each(n, wave) sees
        // the step number and the first wave of this page, if any
        runSlam(sec, each) {
          let n = 0;
          w2.step(sec, () => {
            const hb = w2.hostBoss();
            if (hb.state === "rec") hb.t = 0;
            n++;
            return each(n, G.waves[0]);
          });
          return n;
        },
      });
      const c = {};
      w2.start();
      c.two = w2.boss().def.duo === true && w2.host().S.n === 2;
      c.stood = w2.standIn(8);
      c.awake = w2.wake();
      await w2.frames();
      const two = w2.notches();
      c.shown = w2.barShown();
      c.notches =
        two.length === 3 && [0.75, 0.5, 0.25].every((m, i) => Math.abs(two[i] - m) < 0.01);
      // a run for one: today's Warden, and no notches
      w2.start({ seed: 99 });
      c.one = !w2.boss().def.duo && w2.host().S.n === 1;
      c.stoodOne = w2.standIn(8);
      c.awakeOne = w2.wake();
      await w2.frames();
      const one = w2.notches();
      c.shownOne = w2.barShown();
      c.none = one.length === 0;
      return { pass: Object.values(c).every((v) => v === true), c, two, one };
    },
  },
  {
    name: "the boss bar for two, for the screenshot",
    eval: async () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      w2.start();
      const stood = w2.standIn(9),
        awake = w2.wake();
      w2.standIn(9);
      await w2.frames();
      return { pass: stood && awake && w2.barShown() && w2.notches().length === 3 };
    },
  },
  { wait: 400, shot: "t32-bar" },
  {
    name: "the aftershock hurts a player it passes, once",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.slamSetup(2).c,
        p = G.player;
      let land = -1,
        last = p.hp;
      const drops = [];
      w2.runSlam(4, (n, w) => {
        if (land < 0 && w) land = n;
        if (p.hp < last - 1e-9) drops.push({ at: (n - land) / 60, by: +(last - p.hp).toFixed(3) });
        last = p.hp;
      });
      const d = drops[0];
      return {
        pass:
          c.stood && c.awake && c.entered && c.spot && c.phase === 2 && land > 0 &&
          drops.length === 1 && Math.abs(d.by - 14) < 1e-6 && d.at >= 1.2 && d.at <= 1.7,
        c,
        drops,
      };
    },
  },
  {
    name: "a dodge through it takes nothing",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.slamSetup(2).c,
        p = G.player,
        hp0 = p.hp;
      let dodged = false,
        pd = false;
      w2.runSlam(4, (n, w) => {
        // a dodge begun a tenth of a second before the front arrives
        if (w && !dodged && (w.t - w.o.wait) * w.o.speed >= Math.hypot(p.x - w.x, p.z - w.z) - w.o.band / 2 - 1.1) {
          dodged = true;
          Object.assign(p, { state: "dodge", t: 0, ddur: 0.4, ddx: 0, ddz: 0, ddist: 0, iframe: 0.35, pdUsed: false });
        }
        if (dodged && p.pdUsed) pd = true;
      });
      return { pass: c.phase === 2 && dodged && pd && p.hp === hp0, c, dodged, perfect: pd, hp: [hp0, p.hp] };
    },
  },
  {
    name: "a guard facing it blocks",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.slamSetup(2).c,
        p = G.player,
        hp0 = p.hp,
        cl = p.cls;
      let up = false,
        stam0 = null;
      w2.runSlam(4, (n, w) => {
        if (w && !up && (w.t - w.o.wait) * w.o.speed >= Math.hypot(p.x - w.x, p.z - w.z) - w.o.band / 2 - 4) {
          // the guard held from 0.35 s before, past any parry window
          up = true;
          DF.keys[DF.BIND.guard] = true;
        }
        if (up && stam0 === null && p.state === "guard") stam0 = p.stam;
      });
      DF.keys[DF.BIND.guard] = false;
      const chip = hp0 - p.hp,
        spent = stam0 - p.stam;
      return {
        pass:
          c.phase === 2 && up && stam0 !== null &&
          Math.abs(chip - 14 * cl.chip) < 1e-6 && Math.abs(spent - 14 * cl.blockMul) < 1e-6,
        c,
        chip,
        spent,
        want: [14 * cl.chip, 14 * cl.blockMul],
      };
    },
  },
  {
    name: "phase 1 has no aftershock",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.slamSetup(1).c,
        p = G.player,
        hp0 = p.hp;
      let most = 0;
      w2.runSlam(3, () => {
        most = Math.max(most, G.waves.length);
      });
      const pup = w2.boss();
      return {
        pass: c.phase === 1 && pup.slamAn !== undefined && most === 0 && G.waves.length === 0 && p.hp === hp0,
        c,
        landed: pup.slamAn !== undefined,
        most,
      };
    },
  },
  {
    name: "a respawn and a new world clear it",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      w2.slamSetup(2);
      w2.runSlam(3, (n, w) => (w ? false : undefined));
      const before = G.waves.length;
      DF.respawn();
      const afterRespawn = G.waves.length;
      w2.slamSetup(2);
      w2.runSlam(3, (n, w) => (w ? false : undefined));
      const second = G.waves.length;
      w2.start();
      return {
        pass: before === 1 && afterRespawn === 0 && second === 1 && G.waves.length === 0,
        before,
        afterRespawn,
        second,
        afterStart: G.waves.length,
      };
    },
  },
  {
    name: "the aftershock half way out, for the screenshot",
    eval: async () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.slamSetup(2, 12).c;
      let r = 0;
      w2.runSlam(4, (n, w) => {
        if (!w) return;
        r = (w.t - w.o.wait) * w.o.speed;
        return r >= 5.5 ? false : undefined;
      });
      await w2.frames();
      return { pass: c.phase === 2 && G.waves.length === 1 && r >= 5.5 && r < 6.5, r: +r.toFixed(2) };
    },
  },
  { wait: 400, shot: "t32-wave" },
  {
    name: "a seize that lands holds this player",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      Object.assign(w2, {
        // A run for two (o for coopSolo) with the Warden at phase 3 and its
        // roar over, kept still 7 m from the chamber's centre facing it,
        // this player 3.5 m in front of it (toward the centre) facing it,
        // and the scripted mate, alive unless dead says otherwise, 2 m to
        // this player's side. Then seize() puts the host's Warden in the
        // wind-up of its seize at this player.
        seizeSetup(o, dead = false) {
          w2.start(o);
          const c = { stood: w2.standIn(8), awake: w2.wake() };
          c.entered = !!w2.host().phase(3);
          DF.devGod(true);
          try {
            w2.step(3, () => (w2.hostBoss().state === "roar" ? undefined : false));
          } finally {
            DF.devGod(false);
          }
          const hb = w2.hostBoss(),
            bc = G.world.boss,
            q = w2.inChamber(7),
            yaw = Math.atan2(bc.x - q.x, bc.z - q.z),
            fx = Math.sin(yaw),
            fz = Math.cos(yaw),
            m = w2.r.mate.p;
          c.spot = !!q;
          const put = () => {
            Object.assign(hb, { x: q.x, z: q.z, yaw, state: "recoil", t: 0, dur: 9, kx: 0, kz: 0, plan: null });
            const p = G.player;
            Object.assign(p, { x: q.x + fx * 3.5, z: q.z + fz * 3.5, state: "free", vx: 0, vz: 0, kx: 0, kz: 0 });
            p.yaw = DF.cam.yaw = yaw + Math.PI;
            DF.cam.px = p.x;
            DF.cam.pz = p.z;
            // beside this player, to its right
            m.x = p.x - Math.cos(p.yaw) * 2;
            m.z = p.z + Math.sin(p.yaw) * 2;
          };
          if (dead) w2.r.mate.kill();
          DF.devGod(true);
          try {
            w2.step(0.6, put);
          } finally {
            DF.devGod(false);
          }
          G.player.hp = G.player.maxHp;
          c.near = Math.hypot(w2.boss().x - q.x, w2.boss().z - q.z) < 0.2;
          c.mate = w2.mateState() === (dead ? "dead" : "free");
          return c;
        },
        // the mate's state on this page, and this page's pid
        mateState: () => DF.net().mates[0].state,
        me: () => 3 - DF.net().mates[0].pid,
        seize() {
          const hb = w2.hostBoss();
          Object.assign(hb, {
            state: "wind",
            atk: hb.def.atks.seize,
            t: 0,
            an: (hb.an + 1) & 255,
            tg: w2.me(),
          });
          return hb;
        },
        // steps sec seconds; true when this player lost no 35 or more at once
        noCrush(sec) {
          const p = G.player;
          let last = p.hp,
            most = 0;
          w2.step(sec, () => {
            most = Math.max(most, last - p.hp);
            last = p.hp;
          });
          return most < 35;
        },
        // steps until this player is held (or sec runs out); the steps taken
        seizeRun(sec = 2, each) {
          let n = 0,
            got = false;
          w2.step(sec, () => {
            n++;
            if (each) each(n);
            if (G.player.state === "held") {
              got = true;
              return false;
            }
          });
          return got ? n : -1;
        },
      });
      const c = w2.seizeSetup(),
        hb = w2.seize(),
        p0 = G.player,
        got = w2.seizeRun(2);
      const p = G.player,
        pup = w2.boss();
      c.held = got > 0 && p.state === "held";
      c.hostHold = hb.state === "hold" || hb.state === "act";
      // dragged to 1.6 m in front of it
      w2.step(1);
      const ahead = Math.hypot(p.x - (pup.x + Math.sin(pup.yaw) * 1.6), p.z - (pup.z + Math.cos(pup.yaw) * 1.6));
      c.dragged = ahead < 0.3;
      c.puppet = pup.state === "hold";
      c.host = hb.state === "hold" && hb.held === w2.me();
      // six a second, in ticks
      const hp0 = p.hp;
      w2.step(2);
      const fell = hp0 - p.hp;
      c.ticks = Math.abs(fell - 12) <= 3;
      c.still = p.state === "held";
      // a dodge press does nothing while the mate can break it
      const t0 = p.hold.t;
      DF.taps[DF.BIND.dodge] = true;
      w2.step(1 / 60);
      c.press = p.state === "held" && p.hold.jolt === 0 && Math.abs(p.hold.t - t0 - 1 / 60) < 1e-6;
      c.same = p === p0;
      c.mateUp = w2.mateState() === "free";
      return { pass: Object.values(c).every((v) => v === true), c, got, fell: +fell.toFixed(2), ahead: +ahead.toFixed(2) };
    },
  },
  {
    name: "a dodge through the seize is not held",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.seizeSetup(),
        hb = w2.seize(),
        p = G.player,
        pup = w2.boss(),
        wd = hb.atk.wind * 0.85;
      let dodged = false,
        held = false,
        hostHold = false;
      w2.step(2, () => {
        if (!dodged && pup.state === "wind" && pup.t >= wd - 0.1) {
          dodged = true;
          Object.assign(p, { state: "dodge", t: 0, ddur: 0.4, ddx: 0, ddz: 0, ddist: 0, iframe: 0.35, pdUsed: false });
        }
        if (p.state === "held") held = true;
        if (hb.state === "hold") hostHold = true;
      });
      c.dodged = dodged;
      c.free = !held && !hostHold;
      c.swung = pup.hitAn === hb.an;
      return { pass: Object.values(c).every((v) => v === true), c };
    },
  },
  {
    name: "the mate breaks the hold",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.seizeSetup(),
        hb = w2.seize();
      c.held = w2.seizeRun(2) > 0;
      w2.step(0.5);
      const p = G.player;
      w2.r.mateAsk("hit", hb.id, 80, 0, 0, "melee", null, null, hb.state, hb.an);
      c.stagger = hb.state === "stagger" && hb.dur === 2;
      let n = 0;
      w2.step(1, () => {
        if (p.state !== "held") return false;
        n++;
      });
      c.soon = p.state !== "held" && n / 60 <= 0.3;
      c.safe = p.iframe > 0;
      // no crush: no loss of 35 or more at once (the Warden's own swings
      // are 17 to 28) until well past when it would have come
      c.noCrush = w2.noCrush(4);
      return { pass: Object.values(c).every((v) => v === true), c, took: n / 60 };
    },
  },
  {
    name: "unbroken, the crush lands",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.seizeSetup(),
        hb = w2.seize(),
        bc = G.world.boss;
      c.held = w2.seizeRun(2) > 0;
      const p = G.player;
      let n = 0,
        last = p.hp,
        crush = null;
      const drops = [];
      w2.step(5, () => {
        n++;
        if (p.hp < last - 1e-9) {
          drops.push(+(last - p.hp).toFixed(3));
          if (last - p.hp > 30 && !crush) crush = { at: n / 60, by: last - p.hp, d: Math.hypot(p.x - bc.x, p.z - bc.z), n };
        }
        last = p.hp;
        if (crush && n - crush.n >= 36) return false;
      });
      c.crushed = !!crush;
      if (crush) {
        // 40, or 43 if a tick of the hold fell in the same step
        c.by = Math.abs(crush.by - 40) < 1e-6 || Math.abs(crush.by - 43) < 1e-6;
        c.when = crush.at >= 3.9 && crush.at <= 4.5;
        c.thrown = crush.d - Math.hypot(p.x - bc.x, p.z - bc.z) > 3;
      }
      c.free = p.state !== "held";
      return { pass: Object.values(c).every((v) => v === true), c, crush, drops };
    },
  },
  {
    name: "with the mate dead, struggling frees the player",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.seizeSetup(undefined, true),
        hb = w2.seize();
      c.held = w2.seizeRun(2) > 0;
      const p = G.player;
      c.can = !!p.hold && p.hold.mash() === true;
      let n = 0;
      w2.step(3, () => {
        if (p.state !== "held") return false;
        if (n % 15 === 0) DF.taps[DF.BIND.dodge] = true;
        n++;
      });
      c.free = p.state !== "held" && n / 60 < 1.5;
      // the host lets go once it sees this player free
      w2.step(0.5);
      c.hostLet = hb.state !== "hold" && !hb.held;
      return { pass: Object.values(c).every((v) => v === true), c, took: n / 60 };
    },
  },
  {
    name: "a refused seize frees the player",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      // the host's held events never reach this page
      const c = w2.seizeSetup({ two: true, seed: 99, mate: "idle", tamper: (ev) => (ev[0] === "held" ? null : ev) }),
        hb = w2.seize(),
        pup = w2.boss(),
        wd = hb.atk.wind * 0.85;
      // the host's swing number moves on just before this page judges the
      // swing it saw, so the report names a swing the host is not in
      let moved = false,
        hostHold = false;
      c.held = w2.seizeRun(2, () => {
        if (hb.state === "hold") hostHold = true;
        if (!moved && pup.state === "wind" && pup.t >= wd - 0.05) {
          moved = true;
          hb.an = (hb.an + 7) & 255;
        }
      }) > 0;
      c.moved = moved;
      const p = G.player;
      let n = 0;
      w2.step(3, () => {
        if (hb.state === "hold") hostHold = true;
        if (p.state !== "held") return false;
        n++;
      });
      c.free = p.state !== "held" && n / 60 < 2;
      c.never = !hostHold;
      c.noCrush = w2.noCrush(4.5);
      return { pass: Object.values(c).every((v) => v === true), c, took: n / 60 };
    },
  },
  {
    name: "the free player is told",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      // this page is the friend; the scripted host player is seized
      w2.start({ two: true, seed: 99, mate: "idle", pid: 2 });
      const c = { stood: w2.standIn(8), awake: w2.wake(), entered: !!w2.host().phase(3) };
      DF.devGod(true);
      try {
        w2.step(3, () => (w2.hostBoss().state === "roar" ? undefined : false));
      } finally {
        DF.devGod(false);
      }
      const hb = w2.hostBoss(),
        m = w2.r.mate;
      Object.assign(m.p, { x: hb.x + Math.sin(hb.yaw) * 3, z: hb.z + Math.cos(hb.yaw) * 3 });
      w2.step(0.1);
      m.p.state = "held";
      Object.assign(hb, { state: "act", atk: hb.def.atks.seize, t: 0, an: (hb.an + 1) & 255 });
      m.ask("seized", hb.id, hb.an);
      c.hold = hb.state === "hold" && hb.held === 1;
      const told = () => G.msgs.some((o) => o.text === "Break its grip!");
      c.told = false;
      w2.step(1, () => {
        if (told()) {
          c.told = true;
          return false;
        }
      });
      return { pass: Object.values(c).every((v) => v === true), c, msgs: G.msgs.map((o) => o.text) };
    },
  },
  {
    name: "the seize's wind-up, for the screenshot",
    eval: async () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.seizeSetup(),
        hb = w2.seize(),
        pup = w2.boss(),
        wd = hb.atk.wind * 0.85;
      w2.step(2, () => (pup.state === "wind" && pup.t >= wd * 0.75 ? false : undefined));
      c.wind = pup.state === "wind" && pup.atk.kind === "seize";
      DF.devGod(true);
      G.msgs.length = 0;
      await w2.frames();
      return { pass: Object.values(c).every((v) => v === true), c };
    },
  },
  { wait: 400, shot: "t32-seize-wind" },
  {
    name: "the hold, for the screenshot",
    eval: async () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      DF.devGod(false);
      const c = { held: w2.seizeRun(2) > 0 };
      DF.devGod(true);
      w2.step(0.8);
      const p = G.player;
      c.still = p.state === "held";
      // from the side away from the mate
      DF.cam.yaw = p.yaw - 1.2;
      G.msgs.length = 0;
      await w2.frames();
      return { pass: Object.values(c).every((v) => v === true), c };
    },
  },
  { wait: 400, shot: "t32-held" },
  {
    name: "the rock falls after its warning",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      DF.devGod(false);
      Object.assign(w2, {
        // A run for two (o for coopSolo) with this player 8 m from the
        // chamber's centre and the Warden awake; then the host's Warden is
        // put in phase 4, so the seal begins on the host now
        sealSetup(o) {
          w2.start(o);
          const c = { stood: w2.standIn(8), awake: w2.wake() };
          c.entered = !!w2.host().phase(4);
          return c;
        },
        // steps unhurt until this page's ring is down, at most sec; the
        // steps taken, or -1
        untilDown(sec = 3, each) {
          let n = 0,
            got = false;
          DF.devGod(true);
          try {
            w2.step(sec, () => {
              if (each) each(n);
              n++;
              if (G.seal && G.seal.down) {
                got = true;
                return false;
              }
            });
          } finally {
            DF.devGod(false);
          }
          return got ? n : -1;
        },
        // the midpoint of each capsule of the ring on this page
        mids: () => DF.sealRing(G.world).map(([ax, az, bx, bz]) => ({ x: (ax + bx) / 2, z: (az + bz) / 2 })),
        // every capsule is rock in this page's field
        ringIn: () => w2.mids().every((q) => G.world.fieldAt(q.x, q.z) < 0),
        ringOut: () => w2.mids().every((q) => G.world.fieldAt(q.x, q.z) > 0),
        heaps: () => G.chunks.filter((k) => k.seal && k.id).length,
        // how far this player is from the door spot, and from the centre
        fromDoor() {
          const q = DF.sealDoor(G.world);
          return Math.hypot(G.player.x - q.x, G.player.z - q.z);
        },
        fromCentre: () => Math.hypot(G.player.x - G.world.boss.x, G.player.z - G.world.boss.z),
        // steps sec seconds unhurt, holding forward toward the room before
        // the chamber; the furthest this player got from the centre
        walkOut(sec) {
          const w = G.world,
            n = w.nodes[w.path[w.path.length - 2]],
            p = G.player,
            yaw = Math.atan2(n.x - p.x, n.z - p.z);
          p.yaw = DF.cam.yaw = yaw;
          let far = 0;
          DF.devGod(true);
          DF.keys[DF.BIND.fwd] = true;
          try {
            w2.step(sec, () => {
              DF.cam.yaw = Math.atan2(n.x - p.x, n.z - p.z);
              far = Math.max(far, w2.fromCentre());
            });
          } finally {
            DF.keys[DF.BIND.fwd] = false;
            DF.devGod(false);
          }
          return far;
        },
      });
      const c = w2.sealSetup(),
        T = DF.WARDEN2.seal;
      DF.devGod(true);
      try {
        w2.step(0.5);
      } finally {
        DF.devGod(false);
      }
      const warn = G.chunks.filter((k) => k.seal && !k.id).length;
      c.warn = warn === 24 && !!G.seal && !G.seal.down;
      c.notYet = w2.mids().every((q) => G.world.fieldAt(q.x, q.z) > 0);
      const n = w2.untilDown(2);
      c.down = n >= 0 && (n + 30) / 60 <= 2.1;
      c.rock = w2.ringIn();
      c.heaps = w2.heaps() === 24;
      // the page's rock is the host's
      const hw = w2.host().G.world,
        B = G.world.boss;
      let differ = 0;
      for (let k = 0; k < 200; k++) {
        const a = (k / 200) * 2 * Math.PI,
          r = 10 + (k % 5),
          x = B.x + Math.sin(a) * r,
          z = B.z + Math.cos(a) * r;
        if (Math.abs(hw.fieldAt(x, z) - G.world.fieldAt(x, z)) > 1e-9) differ++;
      }
      c.same = differ === 0;
      return { pass: Object.values(c).every((v) => v === true), c, warn, at: (n + 30) / 60, T, differ };
    },
  },
  {
    name: "a player outside is brought to the door",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.sealSetup(),
        w = G.world,
        n = w.nodes[w.path[w.path.length - 2]],
        p = G.player;
      // this player in the room before the chamber
      Object.assign(p, { x: n.x, z: n.z, state: "free", vx: 0, vz: 0 });
      w.resolve(p, p.r);
      DF.cam.px = p.x;
      DF.cam.pz = p.z;
      c.outside = w2.fromCentre() > 20;
      let down = -1,
        at = -1;
      DF.devGod(true);
      try {
        w2.step(3.5, (i) => {
          if (down < 0 && G.seal && G.seal.down) down = i;
          if (down >= 0 && w2.fromDoor() < 0.2) {
            at = i;
            return false;
          }
        });
      } finally {
        DF.devGod(false);
      }
      c.down = down >= 0;
      c.door = at >= 0 && (at - down) / 60 <= 0.6;
      c.faded = G.fade > 0;
      c.facing = Math.abs(DF.angDiff(p.yaw, Math.atan2(w.boss.x - p.x, w.boss.z - p.z))) < 0.1;
      // the fade is over within its own length, and hurtPlayer was never stopped
      w2.step(DF.WARDEN2.seal.fade + 0.05);
      c.clear = G.fade === 0;
      return { pass: Object.values(c).every((v) => v === true), c, took: (at - down) / 60 };
    },
  },
  {
    name: "a player under the rock is pushed inward",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.sealSetup(),
        w = G.world,
        B = w.boss,
        door = DF.sealDoor(w),
        // 12.5 m out, across the chamber from the door
        q = w2.inChamber(12.5, Math.atan2(B.x - door.x, B.z - door.z)),
        p = G.player;
      c.spot = !!q;
      const put = () => Object.assign(p, { x: q.x, z: q.z, state: "free", vx: 0, vz: 0 });
      put();
      DF.cam.px = p.x;
      DF.cam.pz = p.z;
      // standing there until the ring is down
      c.down = w2.untilDown(3, put) >= 0;
      w2.step(0.2);
      const d = w2.fromCentre();
      c.inward = Math.abs(d - 10.5) < 0.35;
      c.notDoor = w2.fromDoor() > 2;
      c.room = w.fieldAt(p.x, p.z) >= p.r - 0.1;
      return { pass: Object.values(c).every((v) => v === true), c, d: +d.toFixed(2) };
    },
  },
  {
    name: "nobody walks out",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.sealSetup();
      c.down = w2.untilDown(3) >= 0;
      const q = DF.sealDoor(G.world),
        p = G.player;
      Object.assign(p, { x: q.x, z: q.z, yaw: q.yaw, state: "free", vx: 0, vz: 0 });
      const far = w2.walkOut(5);
      c.walked = far > 10;
      c.kept = far <= 11.2 && w2.fromCentre() <= 11.2;
      return { pass: Object.values(c).every((v) => v === true), c, far: +far.toFixed(2) };
    },
  },
  {
    name: "a death while sealed gets up at the door",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.sealSetup();
      c.down = w2.untilDown(3) >= 0;
      const p = G.player;
      Object.assign(p, { hp: 0, state: "dead", t: 2 });
      DF.respawn();
      c.door = w2.fromDoor() < 0.05;
      c.alive = G.player.state === "free" && G.player.hp === G.player.maxHp;
      c.rock = w2.ringIn();
      c.heaps = w2.heaps() === 24 && G.chunks.length === 24;
      c.sealed = !!G.seal && G.seal.down;
      // and cannot walk out
      const far = w2.walkOut(3);
      c.kept = far <= 11.2;
      return { pass: Object.values(c).every((v) => v === true), c, far: +far.toFixed(2) };
    },
  },
  {
    name: "a join in phase 4 starts sealed in",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      let join = null;
      w2.start({
        two: true,
        seed: 99,
        mate: "idle",
        before: (h) => h.phase(4),
        tamper: (ev) => {
          if (ev[0] === "join") join = ev[1];
          return ev;
        },
      });
      const c = { told: !!join && join.seal === true };
      // this page's first frame, before any step
      c.sealed = !!G.seal && G.seal.down;
      c.rock = w2.ringIn();
      c.heaps = w2.heaps() === 24;
      c.door = w2.fromDoor() < 0.05;
      c.cam = Math.hypot(DF.cam.px - G.player.x, DF.cam.pz - G.player.z) < 0.05;
      return { pass: Object.values(c).every((v) => v === true), c };
    },
  },
  {
    name: "a wipe opens the chamber again",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.sealSetup();
      c.down = w2.untilDown(3) >= 0;
      w2.r.mate.kill();
      Object.assign(G.player, { hp: 0, state: "dead", t: 0 });
      w2.step(1, () => (G.seal ? undefined : false));
      c.open = G.seal === null && w2.ringOut() && w2.heaps() === 0;
      c.host = w2.host().G.seal === null && w2.hostBoss().phase === 1;
      DF.respawn();
      c.shrine = w2.fromDoor() > 3;
      return { pass: Object.values(c).every((v) => v === true), c };
    },
  },
  {
    name: "the Warden's death opens the chamber again",
    eval: () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.sealSetup();
      c.down = w2.untilDown(3) >= 0;
      const hb = w2.hostBoss();
      hb.hp = 5;
      w2.r.mateAsk("hit", hb.id, 50, 0, 0, "melee", null, null, hb.state, hb.an);
      c.dead = hb.dead === true;
      DF.devGod(true);
      try {
        w2.step(1, () => (G.seal ? undefined : false));
      } finally {
        DF.devGod(false);
      }
      c.open = G.seal === null && w2.ringOut() && w2.heaps() === 0;
      c.gate = !!G.gate;
      return { pass: Object.values(c).every((v) => v === true), c };
    },
  },
  {
    name: "no frame of the sealed chamber draws more than the limit",
    eval: async () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.sealSetup();
      c.down = w2.untilDown(3) >= 0;
      DF.devGod(true);
      const p = G.player,
        B = G.world.boss,
        q = DF.sealDoor(G.world),
        tris = [];
      for (const at of [{ x: B.x, z: B.z, yaw: q.yaw + Math.PI }, q]) {
        for (let k = 0; k < 4; k++) {
          Object.assign(p, { x: at.x, z: at.z, state: "free" });
          p.yaw = DF.cam.yaw = at.yaw + (k * Math.PI) / 2;
          DF.cam.px = p.x;
          DF.cam.pz = p.z;
          await w2.frames();
          tris.push(DF.R.stats.tris);
        }
      }
      DF.devGod(false);
      c.under = tris.every((t) => t > 0 && t <= 81835);
      return { pass: Object.values(c).every((v) => v === true), c, tris };
    },
  },
  {
    name: "the rock's warning, for the screenshot",
    eval: async () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      const c = w2.sealSetup(),
        p = G.player,
        B = G.world.boss,
        q = DF.sealDoor(G.world);
      DF.devGod(true);
      w2.step(0.9);
      // the Warden out of the view, behind this player
      const hb = w2.hostBoss(),
        bx = B.x - q.x,
        bz = B.z - q.z,
        bd = Math.hypot(bx, bz);
      Object.assign(hb, { x: B.x + (bx / bd) * 9, z: B.z + (bz / bd) * 9 });
      w2.step(0.3);
      // at the centre looking out at the door's side of the ring
      Object.assign(p, { x: B.x, z: B.z, state: "free" });
      p.yaw = DF.cam.yaw = Math.atan2(q.x - B.x, q.z - B.z);
      DF.cam.px = p.x;
      DF.cam.pz = p.z;
      c.warn = G.chunks.filter((k) => k.seal && !k.id).length > 0;
      G.msgs.length = 0;
      await w2.frames();
      return { pass: Object.values(c).every((v) => v === true), c };
    },
  },
  { wait: 400, shot: "t32-warn" },
  {
    name: "the ring, for the screenshot",
    eval: async () => {
      const { G } = DF,
        w2 = window.__w2;
      G.manual = true;
      DF.devGod(true);
      const p = G.player,
        B = G.world.boss,
        q = DF.sealDoor(G.world),
        hb = w2.hostBoss(),
        bx = B.x - q.x,
        bz = B.z - q.z,
        bd = Math.hypot(bx, bz);
      // the Warden kept still out of the view, behind this player
      w2.step(2, () => Object.assign(hb, { x: B.x + (bx / bd) * 9, z: B.z + (bz / bd) * 9, state: "recoil", t: 0, dur: 9 }));
      Object.assign(p, { x: B.x + (B.x - q.x) * 0.3, z: B.z + (B.z - q.z) * 0.3, state: "free" });
      p.yaw = DF.cam.yaw = Math.atan2(q.x - B.x, q.z - B.z);
      DF.cam.px = p.x;
      DF.cam.pz = p.z;
      const down = !!G.seal && G.seal.down;
      G.msgs.length = 0;
      await w2.frames();
      return { pass: down, down };
    },
  },
  { wait: 400, shot: "t32-ring" },
  {
    name: "end the run",
    eval: () => {
      DF.devGod(false);
      DF.coopEnd("test");
      return { pass: DF.net() === null };
    },
  },
];
