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
    name: "end the run",
    eval: () => {
      DF.devGod(false);
      DF.coopEnd("test");
      return { pass: DF.net() === null };
    },
  },
];
