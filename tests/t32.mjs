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
    name: "end the run",
    eval: () => {
      DF.devGod(false);
      DF.coopEnd("test");
      return { pass: DF.net() === null };
    },
  },
];
