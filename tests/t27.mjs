// Co-op client: the page joins a host stepped by hand over the fake link,
// builds the same cave and draws the host's enemies as puppets.
// Run with: node build.mjs && SCRIPT=$PWD/tests/t27.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.
//
// Until Task 8 the page sends no state of its own, so a step that needs the
// host to hunt this player sends one for it each step (co.here), standing in
// for that half of the client.
export default [
  {
    name: "puppets follow the host",
    eval: () => {
      const { G } = DF;
      G.manual = true;
      // helpers the later steps share
      const co = (window.__co = {
        r: null,
        solo(o) {
          co.r = DF.coopSolo(o);
          return co.r;
        },
        hostE: (e) => co.r.host.S.byId.get(e.id),
        pup: (id) => DF.CC.byId.get(id),
        // tells the host this page's player is where it stands
        here() {
          const h = co.r.host;
          if (DF.net()) h.recv(1, h.wire.stateEncode(G.player));
        },
        // steps the run, telling the host where this player is when here
        run(sec, each, here = true) {
          return co.r.step(sec, (i) => {
            if (here) co.here();
            return each ? each(i) : undefined;
          });
        },
        // puts this player d metres from the host enemy he, in its sight,
        // as near straight ahead of it as there is room
        near(he, d) {
          const w = G.world,
            p = G.player;
          for (let i = 0; i < 72; i++) {
            const a = he.yaw + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 36,
              x = he.x + Math.sin(a) * d,
              z = he.z + Math.cos(a) * d;
            if (w.fieldAt(x, z) > 0.8 && w.los(he.x, he.z, x, z)) {
              p.x = x;
              p.z = z;
              p.yaw = Math.atan2(he.x - x, he.z - z);
              DF.cam.px = x;
              DF.cam.pz = z;
              return true;
            }
          }
          return false;
        },
        // the host's husk at spawn index i (cave 99: 37 stands alone near
        // the start, 18 is in a pack of four)
        husk: (i) => co.r.host.S.byId.get(i),
        // worst distance between a puppet and its host enemy now
        worst() {
          let w = 0;
          for (const e of G.enemies) {
            const o = co.hostE(e);
            if (o) w = Math.max(w, Math.hypot(o.x - e.x, o.z - e.z));
          }
          return w;
        },
      });
      const r = co.solo({ ping: 0 });
      co.run(3, null, false);
      const h = r.host,
        worst = co.worst(),
        ids = G.enemies.every((e) => co.hostE(e) && co.hostE(e).type === e.type);
      return {
        pass:
          r.refused === null &&
          G.enemies.length === 47 &&
          ids &&
          worst < 0.5 &&
          DF.net().live === true &&
          h.S.step >= 170 &&
          DF.CC.est > 0,
        enemies: G.enemies.length,
        worst: +worst.toFixed(3),
        hostSteps: h.S.step,
        est: +DF.CC.est.toFixed(3),
        rt: +DF.CC.rt.toFixed(3),
      };
    },
  },
  {
    name: "at 200 ms a puppet is where the host's enemy was 200 ms ago",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 200 });
      const he = co.husk(37),
        pe = co.pup(37);
      co.near(he, 11);
      const hx = [],
        hz = [],
        hs = [],
        px = [],
        pz = [];
      co.run(4, () => {
        hx.push(he.x);
        hz.push(he.z);
        hs.push(he.state);
        px.push(pe.x);
        pz.push(pe.z);
      });
      // only where the host's husk was chasing for a while round that
      // moment (a lunge moves faster than snapshots can follow)
      let n = 0,
        worst = 0,
        moved = 0;
      for (let i = 20; i < px.length; i++) {
        const j = i - 12;
        if (j < 3 || j + 3 >= hs.length) continue;
        if (hs.slice(j - 3, j + 4).some((s) => s !== "chase")) continue;
        n++;
        worst = Math.max(worst, Math.hypot(px[i] - hx[j], pz[i] - hz[j]));
        moved = Math.max(moved, Math.hypot(hx[j] - hx[j - 1], hz[j] - hz[j - 1]) * 60);
      }
      return {
        pass: n >= 30 && moved > 2 && worst < 0.15,
        samples: n,
        hostSpeed: +moved.toFixed(2),
        worst: +worst.toFixed(3),
      };
    },
  },
  {
    name: "raising the ping in play leaves every puppet between two snapshots",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const r = co.solo({ ping: 100, jit: 8 });
      // a pack awake and moving
      co.near(co.husk(18), 9);
      co.run(2);
      r.cfg.ping = 300;
      co.run(2);
      let n = 0,
        bare = 0,
        unsent = 0;
      co.run(5, () => {
        const rt = DF.CC.rt;
        for (const e of G.enemies) {
          if (e.dead || !e.nb.length) continue;
          // one the host stopped sending (idle and far off) has no later
          // snapshot by design
          if (rt - e.nb[e.nb.length - 1].t > 0.2) {
            unsent++;
            continue;
          }
          n++;
          if (!e.nb.some((s) => s.t > rt)) bare++;
        }
      });
      const pct = +((100 * bare) / Math.max(1, n)).toFixed(2);
      return { pass: n > 100 && pct < 3, samples: n, noLaterSnapshotPct: pct, unsent };
    },
  },
  {
    name: "a stall and a burst: puppets glide back and the clock settles",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const r = co.solo({ ping: 100, jit: 5 });
      const h = r.host;
      co.near(co.husk(18), 9);
      // where every host enemy was at each host time
      const hist = new Map(),
        log = () => {
          const t = h.S.step / 60;
          for (const e of h.G.enemies) {
            let a = hist.get(e.id);
            if (!a) hist.set(e.id, (a = []));
            a.push({ t, x: e.x, z: e.z });
          }
        };
      const hostAt = (id, t) => {
        const a = hist.get(id);
        if (!a) return null;
        for (let i = 1; i < a.length; i++)
          if (a[i].t >= t) {
            const A = a[i - 1],
              B = a[i],
              k = B.t > A.t ? Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t))) : 0;
            return { x: A.x + (B.x - A.x) * k, z: A.z + (B.z - A.z) * k };
          }
        return a[a.length - 1];
      };
      // the host enemy's fastest step within 0.1 s of host time t
      const hostFast = (id, t) => {
        const a = hist.get(id) || [];
        let m = 0;
        for (let i = 1; i < a.length; i++)
          if (Math.abs(a[i].t - t) <= 0.1)
            m = Math.max(m, Math.hypot(a[i].x - a[i - 1].x, a[i].z - a[i - 1].z));
        return m;
      };
      co.run(1.5, log);
      const awake = G.enemies.filter((e) => co.hostE(e) && co.hostE(e).aware).length;
      r.cfg.hold = true;
      co.run(0.4, log);
      r.cfg.hold = false;
      // each puppet's position before every step, and the drawn time it was at
      const prev = new Map();
      for (const e of G.enemies) prev.set(e, { x: e.x, z: e.z, rt: DF.CC.rt });
      let worstK = 0,
        fastSteps = 0,
        bad = null,
        steps = 0;
      co.run(2, () => {
        log();
        for (const e of G.enemies) {
          const q = prev.get(e);
          if (q && !e.dead) {
            const d = Math.hypot(e.x - q.x, e.z - q.z),
              type = (e.def.speed * 1.5) / 60,
              host = hostFast(e.id, q.rt) * 1.3;
            steps++;
            if (host > type) fastSteps++;
            const k = d / (e.def.speed / 60);
            if (d > Math.max(type, host) + 1e-3) {
              if (!bad || k > bad.k) bad = { id: e.id, type: e.type, d: +d.toFixed(3), k: +k.toFixed(2) };
            } else if (host <= type) worstK = Math.max(worstK, k);
          }
          prev.set(e, { x: e.x, z: e.z, rt: DF.CC.rt });
        }
      });
      const gap = DF.CC.est - DF.CC.rt;
      // and every puppet is back where the host had it at the drawn time
      let off = 0;
      for (const e of G.enemies) {
        const o = hostAt(e.id, DF.CC.rt);
        if (o && !e.dead && e.nb.length && DF.CC.rt - e.nb[e.nb.length - 1].t < 0.2)
          off = Math.max(off, Math.hypot(o.x - e.x, o.z - e.z));
      }
      return {
        pass: awake >= 3 && !bad && steps > 1000 && Math.abs(gap - 0.1) <= 0.02 && off < 0.3,
        awake,
        worstSpeedMul: +worstK.toFixed(2),
        fastHostSteps: fastSteps,
        over: bad,
        estMinusRt: +gap.toFixed(4),
        offAfter: +off.toFixed(3),
      };
    },
  },
  {
    name: "after slow motion the clock catches up and puppets stay on the host's path",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      // one run per slow-motion length a perfect dodge or parry gives
      const one = (slow) => {
        const r = co.solo({ ping: 200 }),
          h = r.host,
          he = co.husk(37),
          pe = co.pup(37);
        co.near(he, 13);
        const hist = [];
        const log = () => hist.push({ t: h.S.step / 60, x: he.x, z: he.z, s: he.state });
        // the host's husk at host time t, between the steps round it
        const hostAt = (t) => {
          for (let i = 1; i < hist.length; i++)
            if (hist[i].t >= t) {
              const A = hist[i - 1],
                B = hist[i],
                k = Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t)));
              return { x: A.x + (B.x - A.x) * k, z: A.z + (B.z - A.z) * k, s: [A.s, B.s] };
            }
          return null;
        };
        // a frame as the frame loop runs it: slow motion scales the step
        const frame = () => {
          DF.net().frame(1 / 60);
          co.here();
          log();
          let sim = 1 / 60;
          if (G.slowT > 0) {
            G.slowT -= 1 / 60;
            sim *= 0.3;
          }
          DF.update(sim);
          for (const k in DF.taps) DF.taps[k] = false;
        };
        // until the husk starts its run at this player, from well off, so it
        // runs at full speed through the time the drawn clock catches up
        for (let i = 0; i < 300 && he.state !== "chase"; i++) frame();
        const from = Math.hypot(he.x - G.player.x, he.z - G.player.z),
          chased = he.state === "chase" && from > 9;
        G.slowT = slow;
        let worst = 0,
          n = 0,
          behind = 0,
          caught = 0;
        for (let i = 0; i < 90; i++) {
          frame();
          const gap = DF.CC.est - 0.1 - DF.CC.rt;
          behind = Math.max(behind, gap);
          const q = hostAt(DF.CC.rt);
          if (!q || q.s.some((s) => s !== "chase")) continue;
          n++;
          if (G.slowT <= 0 && gap > 0.05) caught++;
          worst = Math.max(worst, Math.hypot(pe.x - q.x, pe.z - q.z));
        }
        return { slow, chased, from: +from.toFixed(1), samples: n, catchUpSamples: caught, behind: +behind.toFixed(3), worst: +worst.toFixed(3) };
      };
      const res = [one(0.4), one(0.8)];
      return {
        pass: res.every((o) => o.chased && o.samples >= 40 && o.catchUpSamples >= 5 && o.behind > 0.2 && o.worst < 0.15),
        runs: res,
      };
    },
  },
  {
    name: "a respawn in a co-op run does not throw",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 100 });
      co.run(0.5);
      DF.respawn();
      co.run(1);
      const ok = !!DF.net() && G.state === "play";
      return { pass: ok, enemies: G.enemies.length };
    },
  },
  {
    name: "a wind-up becomes a swing on the table's time",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const r = co.solo({ ping: 200, jit: 10, loss: 2 });
      const he = co.husk(37),
        pe = co.pup(37);
      co.near(he, 2.5);
      let hostAct = -1,
        hs = he.state,
        winds = [];
      let cur = null;
      co.run(10, (i) => {
        // the host: when its wind-up turned into the swing, in host time
        if (he.state === "act" && hs === "wind") hostAct = r.host.S.step / 60;
        hs = he.state;
        // the puppet as the last update left it
        if (pe.state === "wind" && !cur) cur = { i, t0: pe.t, wind: pe.atk.wind * (pe.phase === 2 ? 0.85 : 1), name: Object.keys(pe.def.atks).find((k) => pe.def.atks[k] === pe.atk) };
        else if (cur && pe.state === "act") {
          // when the puppet turned act: the drawn time the last update used
          // (it moves only in an update), and how long since its wind-up began
          cur.rt = DF.CC.rt;
          cur.hostAct = hostAct;
          cur.since = (i - cur.i) / 60 + cur.t0;
          winds.push(cur);
          cur = null;
          if (winds.length >= 3) return false;
        } else if (cur && pe.state !== "wind") cur = null;
      });
      const res = winds.map((w) => ({
        atk: w.name,
        wind: w.wind,
        since: +w.since.toFixed(4),
        drawnVsHost: +(w.rt - w.hostAct).toFixed(4),
      }));
      const ok = res.every((w) => Math.abs(w.since - w.wind) <= 1 / 60 + 1e-3 && Math.abs(w.drawnVsHost) <= 1 / 60 + 1e-3);
      return { pass: res.length >= 2 && ok, swings: res };
    },
  },
  {
    name: "a different cave is refused",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const r = co.solo({
        tamper: (ev) => {
          if (ev[0] === "join") ev[1].sum = "0";
          return ev;
        },
      });
      return {
        pass: r.refused === "cave" && DF.net() === null && DF.CC.link === null,
        refused: r.refused,
        zone: G.zone,
      };
    },
  },
  {
    name: "an event with an unknown name is ignored",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      let n = 0;
      const r = co.solo({
        ping: 50,
        // after the join: an unknown name, then things that are not events
        tamper: (ev) => (ev[0] === "join" ? [ev, ["later", 1], ["later"], "later", 7, null, {}] : ev),
      });
      // and one more unknown name every second
      co.run(3, (i) => {
        if (i % 60 === 0) {
          r.host.send(1, r.host.wire.eventEncode(["later", 1]));
          n++;
        }
      });
      return {
        pass: r.refused === null && !!DF.net() && DF.net().live && G.enemies.length === 47 && DF.CC.est > 2 && n === 3,
        enemies: G.enemies.length,
        est: +DF.CC.est.toFixed(3),
      };
    },
  },
  {
    name: "leaving the run's world ends co-op and single player runs",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 0 });
      const was = !!DF.net();
      DF.enterCave("E", 7);
      DF.sim(1 / 60);
      const ended = DF.net() === null && DF.CC.link === null;
      // the cave's own enemies hunt again
      const p = G.player,
        e = G.enemies.find((q) => !q.def.boss);
      p.x = e.x + Math.sin(e.yaw) * 4;
      p.z = e.z + Math.cos(e.yaw) * 4;
      G.world.resolve(p, p.r);
      DF.sim(2);
      // and a co-op run can start again after it
      co.solo({ ping: 0 });
      co.run(0.5, null, false);
      const again = !!DF.net() && G.enemies.length === 47;
      DF.coopEnd("test");
      return { pass: was && ended && e.aware && again && DF.net() === null, ended, aware: e.aware, again };
    },
  },
  {
    name: "puppets in a fight, for the screenshot",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 200, jit: 10, loss: 2 });
      DF.devGod(true);
      co.near(co.husk(18), 5);
      co.run(2.2);
      DF.cam.yaw = G.player.yaw;
      DF.cam.px = G.player.x;
      DF.cam.pz = G.player.z;
      return { pass: G.enemies.filter((e) => e.aware).length >= 2 };
    },
  },
  { wait: 400, shot: "t27-puppets" },
  {
    name: "end the run",
    eval: () => {
      DF.devGod(false);
      DF.coopEnd("test");
      return { pass: DF.net() === null };
    },
  },
];
