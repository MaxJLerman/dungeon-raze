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
    name: "end the run",
    eval: () => {
      DF.devGod(false);
      DF.coopEnd("test");
      return { pass: DF.net() === null };
    },
  },
];
