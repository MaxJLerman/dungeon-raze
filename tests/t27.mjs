// Co-op client: the page joins a host stepped by hand over the fake link,
// builds the same cave and draws the host's enemies as puppets.
// Run with: node build.mjs && SCRIPT=$PWD/tests/t27.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.
//
// The puppet steps were written before the page sent its own state, so they
// also send one each step (co.here); that changes nothing now. The fighting
// steps run the client alone (co.go): its own state reaches the host
// through the link.
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
      // the fake link's jitter and loss come from a seeded generator, the
      // same in every run
      const a = DF.coopSolo({ ping: 0 }).cfg.rnd,
        b = DF.coopSolo({ ping: 0 }).cfg.rnd,
        seeded = typeof a === "function" && a !== Math.random && [1, 2, 3].every(() => a() === b());
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
          DF.CC.est > 0 &&
          seeded,
        enemies: G.enemies.length,
        worst: +worst.toFixed(3),
        hostSteps: h.S.step,
        est: +DF.CC.est.toFixed(3),
        rt: +DF.CC.rt.toFixed(3),
        seeded,
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
      // a pack awake and moving. The player is kept alive: dying alone is a
      // wipe (Task 8), whose reset replaces every puppet mid-count and sends
      // the pack home.
      DF.devGod(true);
      let n = 0,
        bare = 0,
        unsent = 0;
      try {
        co.near(co.husk(18), 9);
        co.run(2);
        r.cfg.ping = 300;
        co.run(2);
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
      } finally {
        DF.devGod(false);
      }
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
      // Each puppet's position before every step, and the drawn time it was
      // at. The glide's limit is in drawn time (coopPuppet), and the drawn
      // clock runs up to twice as fast while it catches up with the
      // estimate, which the burst can move by a jitter's worth: so a step is
      // measured against the drawn time it covered, not 1/60 s. The drawn
      // time itself must never advance by more than the clock's own cap,
      // twice a step (coopEnemies): a jump would carry every puppet with it
      // in one frame, so a puppet never moves more than 3x its type's speed
      // in a real step.
      const prev = new Map();
      for (const e of G.enemies) prev.set(e, { x: e.x, z: e.z, rt: DF.CC.rt });
      let worstK = 0,
        fastSteps = 0,
        bad = null,
        steps = 0,
        rtPrev = DF.CC.rt,
        clockMax = 0;
      const clock = () => {
        clockMax = Math.max(clockMax, DF.CC.rt - rtPrev);
        rtPrev = DF.CC.rt;
      };
      co.run(2, () => {
        clock();
        log();
        for (const e of G.enemies) {
          const q = prev.get(e);
          if (q && !e.dead) {
            const d = Math.hypot(e.x - q.x, e.z - q.z),
              drt = DF.CC.rt - q.rt,
              type = e.def.speed * 1.5 * drt,
              host = hostFast(e.id, q.rt) * 60 * 1.3 * drt;
            steps++;
            if (host > type) fastSteps++;
            const k = d / (e.def.speed * drt);
            if (d > Math.max(type, host) + 1e-3) {
              if (!bad || k > bad.k) bad = { id: e.id, type: e.type, d: +d.toFixed(3), k: +k.toFixed(2) };
            } else if (host <= type && drt > 0) worstK = Math.max(worstK, k);
          }
          prev.set(e, { x: e.x, z: e.z, rt: DF.CC.rt });
        }
      });
      clock();
      const clockOk = clockMax <= 2 / 60 + 1e-6;
      const gap = DF.CC.est - DF.CC.rt;
      // and every puppet is back where the host had it at the drawn time.
      // One whose host enemy moved fast within 0.1 s of then (1.3 times its
      // pace over 1.5 times its type's speed, the step above's rule: a lunge,
      // which 20 snapshots a second cannot follow step by step) is measured
      // against its snapshots instead, as the step above leaves such moves
      // to the host's pace.
      let off = 0;
      for (const e of G.enemies) {
        const o = hostAt(e.id, DF.CC.rt);
        if (!o || e.dead || !e.nb.length || DF.CC.rt - e.nb[e.nb.length - 1].t >= 0.2) continue;
        if (hostFast(e.id, DF.CC.rt) * 60 * 1.3 <= e.def.speed * 1.5) off = Math.max(off, Math.hypot(o.x - e.x, o.z - e.z));
        else {
          const A = e.nb[0],
            B = e.nb[1],
            k = B ? Math.min(1, Math.max(0, (DF.CC.rt - A.t) / (B.t - A.t))) : 0,
            sx = B ? A.x + (B.x - A.x) * k : A.x,
            sz = B ? A.z + (B.z - A.z) * k : A.z;
          off = Math.max(off, Math.hypot(sx - e.x, sz - e.z));
        }
      }
      return {
        pass: awake >= 3 && !bad && clockOk && steps > 1000 && Math.abs(gap - 0.1) <= 0.02 && off < 0.3,
        awake,
        clockMaxStep: +(clockMax * 60).toFixed(3),
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
    name: "a cave that differs ends co-op",
    eval: async () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({
        hub: true,
        seed: 99,
        tamper: (ev) => {
          if (ev[0] === "world") ev[1].sum = "0";
          return ev;
        },
      });
      DF.show("play");
      const joined = !!DF.net() && G.zone === "hub";
      // the host's page steps into E's gate
      const q = G.world.portals.find((o) => o.grade === "E"),
        o = DF.portalFront(q, -0.75),
        p = G.player;
      p.x = o.x;
      p.z = o.z;
      co.run(3, () => (DF.net() ? undefined : false), false);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      const msg = document.getElementById("coopMsg"),
        out = {
          pass: joined && G.state === "title" && DF.net() === null && DF.CC.link === null && DF.CC.why === "cave" &&
            !msg.hidden && msg.textContent === "This browser built a different cave from the host's. Co-op cannot run here." &&
            G.zone === "hub" && G.trans === null && G.fade === 0,
          joined,
          state: G.state,
          why: DF.CC.why,
          msg: msg.textContent,
          zone: G.zone,
        };
      // the later steps play
      DF.coopSay("");
      DF.show("play");
      return out;
    },
  },
  {
    name: "after a swap the other player is not drawn where it stood in the last world",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const r = co.solo({ hub: true, seed: 99, ping: 50, mate: "idle" });
      DF.show("play");
      // the other player is heard in the hall, standing by the start
      co.run(1, null, false);
      const m = DF.net().mates[0],
        hall = { x: m.x, z: m.z, away: m.away };
      // the host's page steps into E's gate; at the first step in the new
      // world the other player has had no snapshot of it yet
      const q = G.world.portals.find((o) => o.grade === "E"),
        o = DF.portalFront(q, -0.75),
        p = G.player;
      p.x = o.x;
      p.z = o.z;
      let first = null;
      co.run(4, () => {
        if (!first && DF.CC.epoch === 2) {
          const P = G.player,
            mm = DF.net().mates[0];
          first = {
            same: mm === m,
            away: mm.away,
            d: Math.hypot(mm.x - P.x, mm.z - P.z),
            fromHall: Math.hypot(mm.x - hall.x, mm.z - hall.z),
            snaps: mm.nb.length,
            state: mm.state,
          };
        }
        if (first && G.zone === "cave" && !G.trans && !DF.net().mates[0].away) return false;
      }, false);
      const mm = DF.net().mates[0],
        px = r.host.S.px.get(2),
        c = {
          heard: hall.away === false,
          built: !!first && G.zone === "cave" && G.seed === 99,
          first: !!first && first.same && first.away === true && first.d < 0.05 && first.fromHall > 5 && first.state === "free",
          // a snapshot of the new world moves it and it is there again
          later: !mm.away && Math.hypot(mm.x - px.x, mm.z - px.z) < 0.5,
        };
      DF.coopEnd("test");
      return { pass: Object.values(c).every((v) => v === true), c, first };
    },
  },
  {
    name: "a join this page cannot read is refused before anything is built",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const bad = {
        grade: (j) => (j.grade = "D"),
        seedString: (j) => (j.seed = "99"),
        seedNull: (j) => (j.seed = null),
        sum: (j) => (j.sum = 123),
        pid: (j) => (j.pid = 3),
        enemies: (j) => (j.enemies = "all"),
        shortEnemy: (j) => j.enemies[0].pop(),
        unknownType: (j) => (j.enemies[3][1] = "dragon"),
        enemyId: (j) => (j.enemies[2][0] = "2"),
        enemyPos: (j) => (j.enemies[4][2] = null),
        dead: (j) => (j.dead = 5),
        deadId: (j) => (j.dead = ["a"]),
        peers: (j) => (j.peers = "x"),
        epochZero: (j) => (j.e = 0),
        epochFraction: (j) => (j.e = 1.5),
        epochString: (j) => (j.e = "1"),
        epochMissing: (j) => delete j.e,
        notObject: (j) => Object.keys(j).forEach((k) => delete j[k]),
      };
      const out = {};
      for (const [k, f] of Object.entries(bad)) {
        const w0 = G.world,
          n0 = G.enemies.length,
          r = co.solo({
            tamper: (ev) => {
              if (ev[0] === "join") f(ev[1]);
              return ev;
            },
          });
        out[k] = r.refused === "bad" && DF.net() === null && DF.CC.link === null && G.world === w0 && G.enemies.length === n0 && DF.CC.world === null;
        if (!out[k]) out[k] = { refused: r.refused, net: !!DF.net(), world: G.world === w0 };
      }
      return { pass: Object.values(out).every((v) => v === true), out };
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
    name: "puppets are built to match: a dungeon for two is scaled here, and a solo run after it is not",
    eval: async () => {
      const { G } = DF,
        co = window.__co,
        E = DF.EDEF,
        frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      G.manual = true;
      let join = null;
      const r = co.solo({
        seed: 99,
        two: true,
        tamper: (ev) => {
          if (ev[0] === "join") join = ev[1];
          return ev;
        },
      });
      DF.show("play");
      const h = r.host,
        hk = G.enemies.find((e) => e.type === "husk"),
        pw = G.enemies.find((e) => e.def.boss),
        c = {};
      c.joined = !!DF.net() && !!join && join.n === 2 && h.S.n === 2;
      c.count = G.enemies.length === join.enemies.length && G.enemies.length === h.G.enemies.length && G.enemies.length > 47;
      c.husk = hk.def.hp === Math.round(E.husk.hp * 1.3) && hk.def.posture === Math.round(E.husk.posture * 1.3) && hk.hp === hk.def.hp;
      c.warden = pw.def.hp === Math.round(E.warden.hp * 1.8) && pw.def.posture === Math.round(E.warden.posture * 1.5);
      c.edefKept = E.husk.hp === 42 && E.warden.hp === 620;
      // the boss bar's full width is the scaled health: the Warden at its
      // unscaled full health fills 620 / 1116 of it
      pw.aware = true;
      pw.hp = E.warden.hp;
      await frames();
      const bar = () => parseFloat(document.getElementById("bhF").style.width),
        part = bar();
      c.bar = Math.abs(part - (E.warden.hp / pw.def.hp) * 100) < 0.01;
      pw.hp = pw.def.hp;
      await frames();
      const full = bar();
      c.full = full === 100;
      pw.aware = false;
      // out of co-op, a solo run is the plain game
      DF.coopEnd("left");
      DF.newRun(99);
      const sh = G.enemies.find((e) => e.type === "husk");
      c.solo = G.edef === null && sh.def === E.husk && sh.def.hp === E.husk.hp && sh.hp === E.husk.hp && G.enemies.length === 47;
      return { pass: Object.values(c).every((v) => v === true), c, bar: [part, full], enemies: G.enemies.length };
    },
  },
  // ---- Task 7: fighting as a client ----
  {
    name: "this player's state reaches the host 30 times a second, in any screen",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      // helpers the fighting steps share
      Object.assign(co, {
        // turns this player and the camera to face e
        face(e) {
          const p = G.player,
            a = Math.atan2(e.x - p.x, e.z - p.z);
          p.yaw = a;
          DF.cam.yaw = a;
        },
        // a copy of the counts of hits on this player judged here
        judged: () => ({ ...DF.CC.judged }),
        // runs the client alone: its own state reaches the host through the link
        go: (sec, each) => co.r.step(sec, each),
      });
      // no loss: this step measures the send rate, and a lost frame arrives
      // too late to be heard inside the second
      const r = co.solo({ ping: 200, jit: 10, loss: 0 });
      const h = r.host,
        L = DF.CC.link,
        send = L.send,
        recv = h.recv;
      let sent = 0,
        heard = 0;
      L.send = (buf) => {
        if (h.wire.type(buf) === 2) sent++;
        return send(buf);
      };
      h.recv = (pid, buf) => {
        if (pid === 1 && buf && h.wire.type(buf) === 2) heard++;
        return recv(pid, buf);
      };
      const p = G.player,
        x0 = p.x,
        z0 = p.z;
      // walk for half a second, then stand for half a second
      DF.keys[DF.BIND.fwd] = true;
      co.go(0.5);
      DF.keys[DF.BIND.fwd] = false;
      co.go(0.5);
      const sent1 = sent,
        heard1 = heard;
      const px = h.S.px.get(1),
        off = Math.hypot(px.x - p.x, px.z - p.z),
        walked = Math.hypot(p.x - x0, p.z - z0);
      // paused: the state still goes, on frame time
      G.state = "pause";
      sent = 0;
      for (let i = 0; i < 30; i++) DF.net().frame(1 / 60);
      const paused = sent;
      G.state = "play";
      L.send = send;
      h.recv = recv;
      return {
        pass:
          walked > 1 &&
          off < 0.1 &&
          !px.away &&
          Math.abs(sent1 - 30) <= 1 &&
          heard1 >= 25 &&
          Math.abs(paused - 15) <= 1,
        walked: +walked.toFixed(2),
        off: +off.toFixed(3),
        away: px.away,
        sentIn1s: sent1,
        heardIn1s: heard1,
        sentPausedHalfS: paused,
      };
    },
  },
  {
    name: "an enemy's swing is judged here and hurts",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 200, jit: 10, loss: 2 });
      DF.DEV.god = false;
      const p = G.player;
      p.hp = p.maxHp;
      const he = co.husk(37),
        j0 = co.judged();
      co.near(he, 2.5);
      const n = co.go(10, () => (p.hp < p.maxHp ? false : undefined));
      const j = co.judged();
      return {
        pass: p.hp < p.maxHp && j.hit === j0.hit + 1,
        after: +(n / 60).toFixed(2),
        hp: +p.hp.toFixed(1),
        judged: j,
        hostAware: he.aware,
      };
    },
  },
  {
    name: "holding guard blocks it",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 200, jit: 10, loss: 2 });
      DF.DEV.god = false;
      const p = G.player;
      p.hp = p.maxHp;
      const he = co.husk(37),
        pe = co.pup(37);
      co.near(he, 2.2);
      co.go(0.6, () => co.face(pe));
      const j0 = co.judged();
      DF.keys[DF.BIND.guard] = true;
      const n = co.go(10, () => {
        co.face(pe);
        p.stam = p.maxStam;
        return co.judged().block > j0.block ? false : undefined;
      });
      DF.keys[DF.BIND.guard] = false;
      const j = co.judged();
      return {
        pass: j.block > j0.block && j.hit === j0.hit,
        after: +(n / 60).toFixed(2),
        judged: j,
        hp: +p.hp.toFixed(1),
      };
    },
  },
  {
    name: "a late guard parries and the host's enemy is thrown back",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 200, jit: 10, loss: 2 });
      DF.DEV.god = false;
      const p = G.player;
      p.hp = p.maxHp;
      const he = co.husk(37),
        pe = co.pup(37);
      co.near(he, 2.2);
      co.go(1, () => co.face(pe));
      const j0 = co.judged();
      const n = co.go(14, () => {
        co.face(pe);
        p.hp = p.maxHp;
        p.stam = p.maxStam;
        // the guard goes up just before the swing lands, as a player's would
        const late = pe.state === "wind" && pe.atk && pe.t > pe.atk.wind - 0.12;
        DF.keys[DF.BIND.guard] = late || pe.state === "act";
        return co.judged().parry > j0.parry ? false : undefined;
      });
      DF.keys[DF.BIND.guard] = false;
      const local = pe.state;
      let seen = "",
        at = -1;
      co.go(0.4, (i) => {
        if (!seen && (he.state === "recoil" || he.state === "stagger")) {
          seen = he.state;
          at = i;
        }
      });
      return {
        pass: co.judged().parry > j0.parry && (local === "recoil" || local === "stagger") && !!seen,
        after: +(n / 60).toFixed(2),
        local,
        host: seen,
        hostAfter: +(at / 60).toFixed(3),
      };
    },
  },
  {
    name: "the Warden's charge and slam are judged here: each hurts, and a dodge avoids each",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const r = co.solo({ ping: 100, jit: 5, loss: 0 });
      DF.DEV.god = false;
      const p = G.player,
        hw = [...r.host.S.byId.values()].find((e) => e.def.boss),
        pw = co.pup(hw.id);
      // Forces one swing of kind k on the host's Warden with a new number, as
      // its own step would number it, and runs until this page has judged
      // that swing (its hitAn is the new number) or 4 s. dodge(pw) says when
      // to tap dodge. Returns the judged result, the health lost in the step
      // it was judged in, and whether the swing was judged at all.
      const swing = (k, dodge) => {
        co.near(hw, 8);
        co.go(0.6, () => {
          p.hp = p.maxHp;
          p.stam = p.maxStam;
          co.face(pw);
        });
        p.hp = p.maxHp;
        const an = (hw.an + 1) & 255;
        Object.assign(hw, { state: "wind", atk: hw.def.atks[k], t: 0, hitDone: false, an });
        let prevHp = p.hp,
          prevJ = co.judged(),
          res = null,
          tapped = false,
          drew = false;
        co.go(4, () => {
          if (pw.an === an && (pw.state === "wind" || pw.state === "act")) drew = true;
          if (pw.hitAn === an && !res) {
            const j = co.judged();
            res = { judged: Object.keys(j).find((q) => j[q] > prevJ[q]) || "?", lost: +(prevHp - p.hp).toFixed(2) };
            return false;
          }
          if (dodge && !tapped && pw.an === an && dodge(pw)) {
            DF.taps[DF.BIND.dodge] = true;
            tapped = true;
          }
          prevHp = p.hp;
          prevJ = co.judged();
        });
        return { ...(res || { judged: null }), drew, tapped };
      };
      const reach = () => hw.r + p.r + 0.9;
      const charge = swing("charge"),
        chargeDodged = swing("charge", (e) => e.state === "act" && Math.hypot(e.x - p.x, e.z - p.z) < reach() + 1.5),
        slam = swing("slam"),
        slamDodged = swing("slam", (e) => e.state === "act" && e.t >= e.atk.act - 0.1);
      const dmg = (k) => hw.def.atks[k].dmg;
      return {
        pass:
          charge.judged === "hit" &&
          Math.abs(charge.lost - dmg("charge")) < 0.01 &&
          chargeDodged.tapped &&
          chargeDodged.judged === "none" &&
          chargeDodged.lost === 0 &&
          slam.judged === "hit" &&
          Math.abs(slam.lost - dmg("slam")) < 0.01 &&
          slamDodged.tapped &&
          slamDodged.judged === "none" &&
          slamDodged.lost === 0,
        charge,
        chargeDodged,
        slam,
        slamDodged,
      };
    },
  },
  {
    name: "this player's hits reach the host and kill there",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 200, jit: 10, loss: 2 });
      DF.DEV.god = true;
      const p = G.player,
        he = co.husk(37),
        pe = co.pup(37),
        hp0 = he.hp,
        k0 = G.kills;
      co.near(he, 1.6);
      let first = -1;
      const n = co.go(25, (i) => {
        co.face(pe);
        if (i % 30 === 0) DF.taps[DF.BIND.light] = true;
        if (first < 0 && he.hp < hp0) first = i;
        // keep within reach of where it is drawn
        DF.keys[DF.BIND.fwd] = !pe.dead && Math.hypot(pe.x - p.x, pe.z - p.z) > 2.2;
        return he.dead && pe.dead ? false : undefined;
      });
      DF.keys[DF.BIND.fwd] = false;
      co.go(1);
      DF.DEV.god = false;
      return {
        pass: he.dead && pe.dead && G.kills - k0 === 1 && first > 0 && DF.CC.pend.length === 0 && he.kBy === 1,
        after: +(n / 60).toFixed(2),
        firstHostDropStep: first,
        kills: G.kills - k0,
        pending: DF.CC.pend.length,
        killedBy: he.kBy,
      };
    },
  },
  {
    name: "the hit shows before the host answers",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 200, jit: 10, loss: 2 });
      DF.DEV.god = true;
      const net = DF.net(),
        orig = net.onHit,
        he = co.husk(37),
        pe = co.pup(37);
      co.near(he, 1.6);
      co.go(1, () => co.face(pe));
      let seen = null,
        after = null;
      net.onHit = (e, dmg, post, o) => {
        const hp = e.hp,
          host = co.hostE(e).hp,
          res = orig(e, dmg, post, o);
        if (!seen && e === pe)
          seen = { res, flash: e.flash, hp, hpAfter: e.hp, dmg, host, hostAfter: co.hostE(e).hp, pending: DF.CC.pend.length };
        return res;
      };
      co.go(3, (i) => {
        co.face(pe);
        if (i % 30 === 0 && !seen) DF.taps[DF.BIND.light] = true;
        // the step after: the drawn puppet still shows it, the host has not had it
        if (seen && !after) after = { hp: pe.hp, host: he.hp, flash: pe.flash };
        if (after) return false;
      });
      net.onHit = orig;
      DF.DEV.god = false;
      const ok =
        !!seen &&
        seen.res === true &&
        seen.flash === 1 &&
        Math.abs(seen.hp - seen.hpAfter - Math.round(seen.dmg * 100) / 100) < 1e-9 &&
        seen.hostAfter === seen.host &&
        seen.pending >= 1 &&
        !!after &&
        after.hp < seen.hp &&
        after.host === seen.host;
      return { pass: ok, seen, after };
    },
  },
  {
    name: "a guess the host never answers is dropped after 2 s, and the puppet shows the host's health again",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 100, jit: 5, loss: 0 });
      DF.DEV.god = true;
      const he = co.husk(37),
        pe = co.pup(37),
        L = DF.CC.link,
        send = L.send;
      he.hp = he.def.hp;
      co.near(he, 1.6);
      co.go(1, () => co.face(pe));
      const hp0 = he.hp;
      // this player's hits never reach the host
      let dropped = 0;
      L.send = (buf) => {
        const w = co.r.host.wire;
        if (w.type(buf) === 3 && w.eventDecode(buf)[0] === "hit") return void dropped++;
        return send(buf);
      };
      let at = -1,
        gone = -1,
        shown = null,
        tapped = false;
      co.go(6, (i) => {
        co.face(pe);
        // one press: one swing, one hit
        if (!tapped) {
          DF.taps[DF.BIND.light] = true;
          tapped = true;
        }
        if (at < 0 && DF.CC.pend.length) {
          at = i;
          shown = { pup: pe.hp, host: he.hp };
        }
        if (at >= 0 && gone < 0 && !DF.CC.pend.length) gone = i;
        if (gone >= 0 && i > gone + 2) return false;
      });
      L.send = send;
      DF.DEV.god = false;
      const held = (gone - at) / 60;
      return {
        pass:
          dropped === 1 &&
          !!shown &&
          shown.pup < shown.host - 0.5 &&
          Math.abs(held - 2) <= 2 / 60 &&
          he.hp === hp0 &&
          Math.abs(pe.hp - he.hp) < 0.2 &&
          !pe.dead,
        dropped,
        shown,
        heldFor: +held.toFixed(3),
        after: { pup: pe.hp, host: he.hp },
      };
    },
  },
  {
    name: "a spit is flown and judged here",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const r = co.solo({ ping: 200, jit: 10, loss: 2 });
      DF.DEV.god = false;
      const p = G.player,
        h = r.host,
        hs = h.S.byId.get(2),
        ps = co.pup(2);
      p.hp = p.maxHp;
      co.near(hs, 8);
      const j0 = co.judged(),
        near = new Map();
      let local = false,
        passed = 0,
        stopped = 0,
        drop = 0,
        melee = -1;
      // Once the first hit is judged, no later one lands: the host's copy of
      // this player's health is compared below, and a hit judged here in the
      // last moments before that would still be on its way (a link delay
      // late, more for a lost frame) and read as a mismatch. Which enemy hits
      // again and when moves with the game's own random choices.
      const shield = () => {
        if (drop) p.iframe = Math.max(p.iframe, 0.5);
      };
      co.go(12, (i) => {
        shield();
        if (G.projs.some((q) => q.own === "e" && q.src === ps)) local = true;
        // the host's own copy of each shot: it flies on through the proxy
        const px = h.S.px.get(1);
        for (const q of h.G.projs)
          if (q.own === "e" && !near.has(q) && Math.hypot(q.x - px.x, q.z - px.z) < 0.8) near.set(q, i);
        for (const [q, at] of near)
          if (i === at + 2) {
            if (h.G.projs.includes(q)) passed++;
            else stopped++;
          }
        if (p.hp < p.maxHp && !drop) {
          drop = p.maxHp - p.hp;
          // what was judged here by the time it hurt (a husk may come later)
          melee = co.judged().hit - j0.hit;
        }
        if (drop && passed + stopped > 0) return false;
      });
      const hpEnd = p.hp;
      co.go(0.5, shield);
      const px = h.S.px.get(1);
      return {
        pass:
          hs.type === "spit" &&
          local &&
          Math.abs(drop - DF.EDEF.spit.atks.shot.dmg) < 1e-9 &&
          melee === 0 &&
          passed >= 1 &&
          stopped === 0 &&
          p.hp === hpEnd &&
          Math.abs(px.hp - p.hp) <= px.maxHp / 255,
        local,
        drop,
        melee,
        hostShotsPassedProxy: passed,
        hostShotsStoppedAtProxy: stopped,
        proxyHp: +px.hp.toFixed(1),
        hp: +p.hp.toFixed(1),
      };
    },
  },
  {
    name: "an execution kills on the host and pays the executor",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 200, jit: 10, loss: 2 });
      // god mode would keep focus full; the husk stands alone and is staggered
      DF.DEV.god = false;
      const p = G.player,
        he = co.husk(37),
        pe = co.pup(37);
      co.near(he, 2);
      co.go(1, () => co.face(pe));
      // the host staggers it, and this page shows it
      Object.assign(he, { state: "stagger", t: 0, dur: 3.0, posture: he.def.posture, token: false });
      co.go(1, () => (pe.state === "stagger" ? false : undefined));
      co.near(he, 2);
      const shown = pe.state;
      p.focus = 0;
      const k0 = G.kills;
      let started = false;
      co.go(2.5, (i) => {
        co.face(pe);
        // until it starts: a swing or a flinch can eat one press
        if (!started && i % 10 === 0) DF.taps[DF.BIND.light] = true;
        if (p.state === "execute") started = true;
      });
      DF.DEV.god = false;
      return {
        // the execution's 12 and the kill's 6, as single player gives
        pass: shown === "stagger" && started && he.dead && pe.dead && he.kBy === 1 && p.focus === 12 + 6 && G.kills - k0 === 1,
        shown,
        started,
        hostDead: he.dead,
        killedBy: he.kBy,
        focus: p.focus,
        kills: G.kills - k0,
      };
    },
  },
  {
    name: "an execution whose pin lost gives nothing, at 200 and 300 ms",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      // The other player's pin reaches the host just before this one's, so
      // this page learns of it a round trip after its own pin: at 200 ms
      // about when the finish comes, at 300 ms after it.
      const one = (ping) => {
        const r = co.solo({ ping, jit: 10, loss: 2 }),
          h = r.host,
          recv = h.recv;
        // god mode would keep focus and health full
        DF.DEV.god = false;
        const p = G.player,
          he = co.husk(37),
          pe = co.pup(37);
        co.near(he, 2);
        co.go(1, () => co.face(pe));
        Object.assign(he, { state: "stagger", t: 0, dur: 6, posture: he.def.posture, token: false });
        co.go(1.5, () => (pe.state === "stagger" ? false : undefined));
        co.near(he, 2);
        h.recv = (pid, buf) => {
          if (pid === 1 && h.wire.type(buf) === 3) {
            const ev = h.wire.eventDecode(buf);
            if (ev[0] === "pin" && ev[2] === he.id) he.pin = 2;
          }
          return recv(pid, buf);
        };
        p.focus = 0;
        p.tool = 0;
        const hp0 = (p.hp = p.maxHp - 30),
          k0 = G.kills;
        let started = false,
          taken = false,
          skipped = false,
          ended = false,
          paid = null,
          most = 0;
        co.go(2.5, (i) => {
          co.face(pe);
          // until it starts: a swing or a flinch can eat one press
          if (!started && i % 10 === 0) DF.taps[DF.BIND.light] = true;
          if (p.state === "execute") started = true;
          // the most focus seen: above 0 when a finish paid before the answer
          most = Math.max(most, p.focus);
          if (DF.net().taken(pe)) {
            taken = true;
            if (DF.nearestStaggered() !== pe) skipped = true;
          }
          if (started && !ended && p.state !== "execute") {
            ended = true;
            // what the finish gave, before anything was taken back
            paid = { focus: p.focus, healed: +(p.hp - hp0).toFixed(1), kills: G.kills - k0, tool: p.tool };
          }
        });
        h.recv = recv;
        return {
          ping,
          started,
          ended,
          taken,
          skipped,
          paid,
          most,
          focus: p.focus,
          healed: +(p.hp - hp0).toFixed(1),
          kills: G.kills - k0,
          tool: p.tool,
          puppet: pe.state,
          puppetDead: pe.dead,
          hostDead: he.dead,
          hostPin: he.pin,
        };
      };
      const runs = [one(200), one(300)];
      return {
        pass: runs.every(
          (o) =>
            o.started && o.ended && o.taken && o.skipped && o.focus === 0 && o.healed === 0 && o.kills === 0 && o.tool === 0 && !o.puppetDead && !o.hostDead && o.hostPin === 2 &&
            // at 300 ms the answer comes after the finish: it paid, then was taken back
            (o.ping < 300 || o.most === 18),
        ),
        runs,
      };
    },
  },
  {
    name: "an execution whose enemy the other player kills first gives nothing",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const one = (ping) => {
        const r = co.solo({ ping, jit: 10, loss: 2 }),
          h = r.host,
          recv = h.recv;
        DF.DEV.god = false;
        // a second player on the host, whose hit lands as this page's pin does
        h.join(2, "fighter");
        recv(2, h.wire.eventEncode(["at", 1, h.S.epoch]));
        const p = G.player,
          he = co.husk(37),
          pe = co.pup(37);
        co.near(he, 2);
        co.go(1, () => co.face(pe));
        Object.assign(he, { state: "stagger", t: 0, dur: 6, posture: he.def.posture, token: false });
        co.go(1.5, () => (pe.state === "stagger" ? false : undefined));
        co.near(he, 2);
        h.recv = (pid, buf) => {
          const out = recv(pid, buf);
          if (pid === 1 && h.wire.type(buf) === 3) {
            const ev = h.wire.eventDecode(buf);
            if (ev[0] === "pin" && ev[2] === he.id)
              recv(2, h.wire.eventEncode(["hit", 2, he.id, 500, 0, 0, "melee", null, null, "stagger", he.an]));
          }
          return out;
        };
        p.focus = 0;
        p.tool = 0;
        const hp0 = (p.hp = p.maxHp - 30),
          k0 = G.kills;
        let started = false;
        co.go(2.5, (i) => {
          co.face(pe);
          // until it starts: a swing or a flinch can eat one press
          if (!started && i % 10 === 0) DF.taps[DF.BIND.light] = true;
          if (p.state === "execute") started = true;
        });
        h.recv = recv;
        return {
          ping,
          started,
          hostDead: he.dead,
          killedBy: he.kBy,
          puppetDead: pe.dead,
          focus: p.focus,
          healed: +(p.hp - hp0).toFixed(1),
          kills: G.kills - k0,
          tool: p.tool,
        };
      };
      const runs = [one(200), one(300)];
      return {
        pass: runs.every(
          (o) => o.started && o.hostDead && o.killedBy === 2 && o.puppetDead && o.focus === 0 && o.healed === 0 && o.kills === 0 && o.tool === 0,
        ),
        runs,
      };
    },
  },
  {
    name: "a ranged class's shot and a blast each send one event the host accepts",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const cls0 = DF.OPT.cls;
      const r = co.solo({ ping: 200, jit: 10, loss: 2 }),
        h = r.host,
        send = h.send;
      DF.DEV.god = true;
      DF.setClass("mage");
      // a second player on the host, to see what it forwards
      h.join(2, "fighter");
      h.recv(2, h.wire.eventEncode(["at", 1, h.S.epoch]));
      const got = [];
      h.send = (pid, buf) => {
        if (pid === 2 && h.wire.type(buf) === 3) {
          const ev = h.wire.eventDecode(buf);
          if (ev[0] === "pshot" || ev[0] === "pblast") got.push(ev);
        }
        return send(pid, buf);
      };
      const p = G.player;
      p.tool = p.cls.tool.max;
      let shot = null,
        blast = null;
      const n0 = G.projs.length;
      co.go(0.2, (i) => {
        if (i === 0) DF.taps[DF.BIND.light] = true;
        const q = G.projs.slice(n0).find((o) => o.own === "p");
        if (q) shot = { x: q.x, y: q.y, z: q.z, vx: q.vx, vz: q.vz, c: q.c.slice(0, 3) };
        return shot ? false : undefined;
      });
      co.go(1);
      const shots = got.filter((ev) => ev[0] === "pshot");
      co.go(0.2, (i) => {
        if (i === 0) DF.taps[DF.BIND.tool] = true;
        if (!blast && G.rings.some((g) => g.kind === "shock" && g.r === 5)) blast = { x: p.x, z: p.z };
      });
      co.go(1);
      const blasts = got.filter((ev) => ev[0] === "pblast");
      h.send = send;
      DF.setClass(cls0);
      DF.DEV.god = false;
      const s = shots[0],
        b = blasts[0],
        near = (a, v, tol) => typeof a === "number" && Math.abs(a - v) <= tol,
        allNum = (ev) => ev.slice(1).every((v) => typeof v === "number" && Number.isFinite(v));
      const okShot =
        !!s &&
        !!shot &&
        s.length === 10 &&
        allNum(s) &&
        s[1] === 1 &&
        // the shot was found after it had flown one step
        near(s[2], shot.x - shot.vx / 60, 0.02) &&
        near(s[3], shot.y, 0.01) &&
        near(s[4], shot.z - shot.vz / 60, 0.02) &&
        near(s[5], shot.vx, 0.01) &&
        near(s[6], shot.vz, 0.01) &&
        near(s[7], shot.c[0], 0.001) &&
        near(s[8], shot.c[1], 0.001) &&
        near(s[9], shot.c[2], 0.001);
      const okBlast =
        !!b && !!blast && b.length === 8 && allNum(b) && b[1] === 1 && near(b[2], blast.x, 0.05) && near(b[3], blast.z, 0.05) && b[4] === 5;
      return {
        pass: okShot && okBlast && shots.length >= 1 && blasts.length === 1,
        shot: s,
        sent: shot && { x: +shot.x.toFixed(2), y: shot.y, z: +shot.z.toFixed(2) },
        blast: b,
        shots: shots.length,
        blasts: blasts.length,
      };
    },
  },
  {
    name: "a guessed death the host refuses comes back, and pays once",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 200, jit: 10, loss: 2 });
      DF.DEV.god = true;
      const p = G.player,
        he = co.husk(37),
        pe = co.pup(37),
        net = DF.net(),
        orig = net.onHit;
      co.near(he, 1.6);
      co.go(1, () => co.face(pe));
      // low on health, and shown so here
      he.hp = 4;
      co.go(0.6, () => co.face(pe));
      const shownHp = pe.hp,
        k0 = G.kills;
      // a hit here takes the guess to 0; the host heals it before the hit arrives
      let died = false;
      net.onHit = (e, ...a) => {
        const res = orig(e, ...a);
        if (e === pe) {
          died = pe.dead;
          he.hp = 40;
          net.onHit = orig;
        }
        return res;
      };
      let back = -1;
      co.go(3, (i) => {
        co.face(pe);
        if (i % 30 === 0 && net.onHit !== orig) DF.taps[DF.BIND.light] = true;
        if (died && back < 0 && !pe.dead) back = i;
      });
      net.onHit = orig;
      const revived = {
        dead: pe.dead,
        state: pe.state,
        inList: G.enemies.includes(pe),
        byId: DF.CC.byId.get(37) === pe,
        hp: +pe.hp.toFixed(2),
        host: +he.hp.toFixed(2),
        kills: G.kills - k0,
      };
      // killed for real later: no second reward
      he.hp = 4;
      co.go(0.6, () => co.face(pe));
      co.go(3, (i) => {
        co.face(pe);
        if (i % 30 === 0) DF.taps[DF.BIND.light] = true;
        return he.dead && pe.dead ? false : undefined;
      });
      co.go(1);
      DF.DEV.god = false;
      return {
        pass:
          Math.abs(shownHp - 4) < 0.2 &&
          died &&
          back > 0 &&
          !revived.dead &&
          revived.state !== "dead" &&
          revived.inList &&
          revived.byId &&
          Math.abs(revived.hp - revived.host) < 0.2 &&
          revived.kills === 1 &&
          he.dead &&
          pe.dead &&
          G.kills - k0 === 1 &&
          DF.CC.pend.length === 0,
        shownHp: +shownHp.toFixed(2),
        died,
        backAfter: +(back / 60).toFixed(2),
        revived,
        finallyDead: [he.dead, pe.dead],
        kills: G.kills - k0,
      };
    },
  },
  {
    name: "the Warden: its slam's ring is drawn, a hit on it is not guessed, and its death opens the gate and clears E",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      DF.resetCleared();
      const r = co.solo({ ping: 200, jit: 10, loss: 2, save: true });
      DF.DEV.god = false;
      const p = G.player,
        h = r.host,
        hw = [...h.S.byId.values()].find((e) => e.def.boss),
        pw = co.pup(hw.id),
        keep = () => {
          p.hp = p.maxHp;
          p.stam = p.maxStam;
        };
      // every ring the host sends this page, with where its slam was aimed
      const sent = [],
        send0 = h.send;
      h.send = (pid, buf) => {
        if (pid === 1 && h.wire.type(buf) === 3) {
          const ev = h.wire.eventDecode(buf);
          if (ev[0] === "ring") sent.push({ x: ev[1], z: ev[2], t: ev[5], tx: hw.tx, tz: hw.tz });
        }
        return send0(pid, buf);
      };
      // when each ring reached this page, as the drawn time then was: a ring
      // whose frame (or one queued before it) was lost arrives after its time
      const arrived = [],
        link = r.link,
        recv0 = link.onmessage;
      link.onmessage = (buf) => {
        if (h.wire.type(buf) === 3) {
          const ev = h.wire.eventDecode(buf);
          if (ev[0] === "ring") arrived.push({ x: ev[1], z: ev[2], t: ev[5], rt: DF.CC.rt });
        }
        return recv0(buf);
      };
      co.near(hw, 9);
      co.go(2, keep);
      const awake = hw.aware;
      // its slam, forced on the host with a new number, as its own step would
      // number it. The ring followed is the first the host sends after the
      // force: the Warden is in this slam's wind-up until then, so no other
      // slam can send one first, and it is sent one wind-up after the force.
      // Of the rings drawn, the one drawn from that event is told apart by
      // its place and its age, which only that event's time explains.
      const force = h.S.step / 60,
        n0 = sent.length,
        old = new Set(G.rings),
        drawn = [];
      Object.assign(hw, { state: "wind", atk: hw.def.atks.slam, t: 0, hitDone: false, an: (hw.an + 1) & 255 });
      co.go(2.5, () => {
        keep();
        for (const g of G.rings)
          if (!old.has(g) && g.kind === "warn" && g.r === hw.def.atks.slam.radius) {
            old.add(g);
            drawn.push({ x: g.x, z: g.z, rt: DF.CC.rt, age: g.t });
          }
      });
      h.send = send0;
      link.onmessage = recv0;
      // drawn where the host aimed it, never before its time, and within
      // 0.05 s of when it could first be drawn: its time, or its arrival
      // when the link brought it later than that. A late one is drawn as
      // far through as it is late, so it lands when the host's does.
      const from = sent[n0],
        forced = !!from && Math.abs(from.t - force - hw.def.atks.slam.wind) < 2 / 60,
        ring =
          from &&
          drawn.find((q) => Math.hypot(q.x - from.x, q.z - from.z) < 1e-6 && Math.abs(q.age - (q.rt - from.t) - 1 / 60) < 1e-6);
      const got = from && arrived.find((q) => q.x === from.x && q.z === from.z && q.t === from.t);
      if (got) from.arrRt = got.rt;
      const ringOk =
        forced &&
        !!ring &&
        !!got &&
        Math.hypot(ring.x - from.tx, ring.z - from.tz) < 0.02 &&
        ring.rt >= from.t - 1e-6 &&
        ring.rt - Math.max(from.t, got.rt) < 0.05 &&
        // pushed as far through as it is late, then one step of the ring loop
        Math.abs(ring.age - (ring.rt - from.t) - 1 / 60) < 1e-6;
      // a hit on it changes its health here and not its state
      co.near(hw, hw.r + 1.1);
      const net = DF.net(),
        orig = net.onHit;
      let seen = null;
      net.onHit = (e, dmg, post, o) => {
        const st = e.state,
          t = e.t,
          hp = e.hp,
          res = orig(e, dmg, post, o);
        if (e === pw && !seen) seen = { res, before: st, after: e.state, t0: t, t1: e.t, ov: !!e.ov, drop: +(hp - e.hp).toFixed(2), dmg: +dmg.toFixed(2) };
        return res;
      };
      co.go(6, (i) => {
        keep();
        co.face(pw);
        if (Math.hypot(pw.x - p.x, pw.z - p.z) > hw.r + 1.6) co.near(hw, hw.r + 1.1);
        if (i % 30 === 0) DF.taps[DF.BIND.light] = true;
        return seen ? false : undefined;
      });
      net.onHit = orig;
      const notGuessed = !!seen && seen.res === true && seen.before === seen.after && seen.t0 === seen.t1 && !seen.ov && Math.abs(seen.drop - seen.dmg) < 0.01;
      // its second phase: the roar's ring is drawn here
      hw.hp = hw.def.hp * 0.5 + 2;
      let roar = false;
      co.go(6, (i) => {
        keep();
        co.face(pw);
        if (Math.hypot(pw.x - p.x, pw.z - p.z) > hw.r + 1.6) co.near(hw, hw.r + 1.1);
        if (i % 30 === 0) DF.taps[DF.BIND.light] = true;
        if (G.rings.some((g) => g.kind === "shock" && g.r === 9)) roar = true;
        return roar ? false : undefined;
      });
      // its death
      hw.hp = 1;
      co.go(0.5, keep);
      co.go(8, (i) => {
        keep();
        co.face(pw);
        if (!pw.dead && Math.hypot(pw.x - p.x, pw.z - p.z) > hw.r + 1.6) co.near(hw, hw.r + 1.1);
        if (i % 30 === 0) DF.taps[DF.BIND.light] = true;
        return G.bossDead ? false : undefined;
      });
      co.go(0.5, keep);
      const res = {
        awake,
        ring,
        ringEvent: from,
        ringOk,
        seen,
        notGuessed,
        roar,
        hostDead: hw.dead,
        killedBy: hw.kBy,
        puppetDead: pw.dead,
        bossDead: G.bossDead,
        gate: !!G.gate,
        cleared: DF.gradeCleared("E"),
      };
      // the save as it was
      DF.resetCleared();
      return {
        pass:
          awake && ringOk && notGuessed && roar && res.hostDead && res.killedBy === 1 && res.puppetDead && res.bossDead && res.gate && res.cleared === true && DF.gradeCleared("E") === false,
        ...res,
      };
    },
  },
  {
    name: "a co-op boss kill is saved under the class that played, not a hidden class",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const base = Object.keys(DF.CLASSES).find((k) => !DF.CLASSES[k].hidden),
        cls0 = DF.OPT.cls;
      DF.resetCleared();
      DF.unlockClass("enforcer");
      DF.setClass("enforcer");
      let res;
      try {
        const r = co.solo({ ping: 50, mate: "idle", save: true }),
          h = r.host,
          hw = [...h.S.byId.values()].find((e) => e.def.boss);
        const played = G.player.clsId;
        co.go(0.5);
        // the other player kills it
        let seq = 60000;
        for (let i = 0; i < 20 && !hw.dead; i++)
          h.recv(2, h.wire.eventEncode(["hit", ++seq, hw.id, 500, 0, 1, "melee", hw.x, hw.z, hw.state, hw.an]));
        co.go(1);
        res = {
          played,
          bossDead: G.bossDead,
          cleared: Object.fromEntries(Object.entries(DF.CLEARED).map(([k, v]) => [k, [...v]])),
          saved: (JSON.parse(localStorage.getItem("dungeon-raze.v2") || "{}").c || {}),
        };
      } finally {
        DF.coopEnd("test");
        DF.resetCleared();
        DF.setClass(cls0 && DF.CLASSES[cls0] && !DF.CLASSES[cls0].hidden ? cls0 : base);
      }
      return {
        pass:
          res.played === base &&
          res.bossDead &&
          JSON.stringify(res.cleared) === JSON.stringify({ [base]: ["E"] }) &&
          JSON.stringify(res.saved) === JSON.stringify({ [base]: ["E"] }),
        ...res,
      };
    },
  },
  {
    name: "a shot, ring, roar or kill that is malformed or names an unknown enemy is ignored",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      const r = co.solo({ ping: 50 });
      // this player is never heard, so nothing on the host hunts them and
      // any shot, ring or kill here came from the events below
      DF.net().live = false;
      co.go(0.5);
      const h = r.host,
        send = (ev) => h.send(1, h.wire.eventEncode(ev)),
        alive = G.enemies.filter((e) => !e.dead).length,
        k0 = G.kills,
        ringsOf = () => G.rings.filter((g) => g.kind === "warn" || (g.kind === "shock" && g.r === 9)).length;
      const bad = [
        ["shot"],
        ["shot", 2],
        ["shot", 9999, 1, 1.25, 1, 1, 1, 13, 0.1],
        ["shot", 2, "a", 1.25, 1, 1, 1, 13, 0.1],
        ["shot", 2, 1, 1.25, 1, null, 1, 13, 0.1],
        ["shot", "2", 1, 1.25, 1, 1, 1, 13, 0.1],
        ["shot", 2, 1, 1.25, 1, 1, 1, 13],
        ["ring"],
        ["ring", 1, 2],
        ["ring", "x", 1, 5, 0.6, 0.1],
        ["ring", 1, 1, 5, {}, 0.1],
        ["roar"],
        ["roar", 9999, 0.1],
        ["roar", 46, "t"],
        ["roar", null, 0.1],
        ["kill"],
        ["kill", 9999, 1, 0.1],
        ["kill", 37, "x", 0.1],
        ["kill", "37", 1, 0.1],
        ["kill", 37, 1],
        ["kill", 37, 1, null],
      ];
      for (const ev of bad) send(ev);
      let threw = null;
      try {
        co.go(1);
      } catch (e) {
        threw = String(e);
      }
      const shots = G.projs.filter((q) => q.own === "e").length;
      return {
        pass: !threw && shots === 0 && ringsOf() === 0 && G.enemies.filter((e) => !e.dead).length === alive && G.kills === k0 && !!DF.net(),
        threw,
        shots,
        rings: ringsOf(),
        alive: [alive, G.enemies.filter((e) => !e.dead).length],
      };
    },
  },
  {
    name: "puppets in a fight, for the screenshot",
    eval: () => {
      const { G } = DF,
        co = window.__co;
      G.manual = true;
      co.solo({ ping: 200, jit: 10, loss: 2 });
      // on through the screenshot; "end the run" turns it off, and so does a throw
      DF.devGod(true);
      try {
        co.near(co.husk(18), 5);
        co.run(2.2);
      } catch (err) {
        DF.devGod(false);
        throw err;
      }
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
