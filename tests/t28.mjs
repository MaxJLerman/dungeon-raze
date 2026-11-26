// Co-op: the other player on screen, and the party's rules (pause, death, a
// wipe, the exit gate, a silent host, leaving). The page joins a host stepped
// by hand over the fake link; DF.coopSolo's mate option adds a scripted
// second player on the host's end.
// Run with: node build.mjs && SCRIPT=$PWD/tests/t28.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.
export default [
  {
    name: "the other player is drawn where the host has it",
    eval: () => {
      const { G } = DF;
      G.manual = true;
      // helpers the later steps share
      const c8 = (window.__c8 = {
        r: null,
        seq: 1000,
        solo(o) {
          if (DF.DEV) DF.devGod(false);
          c8.r = DF.coopSolo(o);
          DF.show("play");
          return c8.r;
        },
        step: (sec, each) => c8.r.step(sec, each),
        // a gate in the hall
        portal: (grade = "E") => G.world.portals.find((q) => q.grade === grade),
        // walks this player into grade's gate in the hall from 2.5 m in
        // front of it, letting go once in its opening, and steps until
        // until() (by default: in the cave, the fade over) or sec runs out
        walkIn(grade = "E", sec = 4, until = () => G.zone === "cave" && !G.trans) {
          const q = c8.portal(grade),
            p = G.player,
            f = DF.portalFront(q, 2.5),
            o = DF.portalFront(q, -0.75),
            fwd = DF.BIND.fwd;
          p.x = f.x;
          p.z = f.z;
          p.state = "free";
          p.yaw = DF.cam.yaw = q.yaw + Math.PI;
          DF.cam.px = f.x;
          DF.cam.pz = f.z;
          DF.keys[fwd] = true;
          c8.step(sec, () => {
            if (G.trans || G.zone !== "hub" || Math.hypot(G.player.x - o.x, G.player.z - o.z) < 0.8) DF.keys[fwd] = false;
            if (until()) return false;
          });
          DF.keys[fwd] = false;
          return until();
        },
        // steps until the world is kind and its fade is over
        arrive: (kind, sec = 3) => c8.step(sec, () => (G.zone === kind && !G.trans ? false : undefined)),
        // every message said from now, read each time it is called
        msgLog() {
          const seen = new Set(),
            texts = [];
          return () => {
            for (const m of G.msgs)
              if (!seen.has(m)) {
                seen.add(m);
                texts.push(m.text);
              }
            return texts;
          };
        },
        husk: (i) => c8.r.host.S.byId.get(i),
        pup: (id) => DF.CC.byId.get(id),
        px: (pid) => c8.r.host.S.px.get(pid),
        mate: () => DF.net().mates[0],
        // a request from pid, as that player's page would send it
        ask(pid, ev) {
          const h = c8.r.host;
          h.recv(pid, h.wire.eventEncode([ev[0], ++c8.seq, ...ev.slice(1)]));
        },
        // kills the host's enemy he with pid's hits of 500
        hostKill(pid, he) {
          for (let i = 0; i < 10 && !he.dead; i++)
            c8.ask(pid, ["hit", he.id, 500, 0, 1, "melee", he.x, he.z, he.state, he.an]);
          return he.dead;
        },
        // a point d metres from (x, z) with room and a clear line to it,
        // as near the direction a as there is
        spot(x, z, a, d) {
          const w = G.world;
          for (let i = 0; i < 72; i++) {
            const b = a + ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 36,
              qx = x + Math.sin(b) * d,
              qz = z + Math.cos(b) * d;
            if (w.fieldAt(qx, qz) > 0.8 && w.los(x, z, qx, qz)) return { x: qx, z: qz, a: b };
          }
          return null;
        },
        // puts this player d metres in front of the host enemy he, facing it
        near(he, d) {
          const q = c8.spot(he.x, he.z, he.yaw, d),
            p = G.player;
          if (!q) return false;
          p.x = q.x;
          p.z = q.z;
          p.yaw = Math.atan2(he.x - q.x, he.z - q.z);
          DF.cam.yaw = p.yaw;
          DF.cam.px = q.x;
          DF.cam.pz = q.z;
          return true;
        },
        // puts the scripted mate d metres in front of the host enemy he
        mateAt(he, d, a = he.yaw) {
          const q = c8.spot(he.x, he.z, a, d),
            m = c8.r.mate.p;
          if (!q) return false;
          m.x = q.x;
          m.z = q.z;
          m.yaw = Math.atan2(he.x - q.x, he.z - q.z);
          return true;
        },
        // the player dies as a hit kills them
        die() {
          const p = G.player;
          p.hp = 1;
          p.iframe = 0;
          return DF.hurtPlayer(20, null, { px: p.x + 1, pz: p.z, unb: true });
        },
        // a host event sent to this page now
        tell(ev) {
          const h = c8.r.host;
          h.send(1, h.wire.eventEncode(ev));
        },
        frames: () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))),
        shown: (id) => {
          const el = document.getElementById(id);
          return !!el && !el.hidden && el.offsetParent !== null && getComputedStyle(el).display !== "none";
        },
      });
      const r = c8.solo({ ping: 100, mate: "follow" });
      DF.devGod(true);
      const p = G.player,
        w = G.world,
        m = c8.mate(),
        h = r.host;
      // walk along the way to the boss, steering round corners by a route
      const goal = w.nodes[w.path[Math.min(3, w.path.length - 1)]];
      let way = w.route(p.x, p.z, goal.x, goal.z, p.r) || [];
      const hist = [],
        at = (t) => {
          for (let i = 1; i < hist.length; i++)
            if (hist[i].t >= t) {
              const A = hist[i - 1],
                B = hist[i],
                k = B.t > A.t ? Math.min(1, Math.max(0, (t - A.t) / (B.t - A.t))) : 0;
              return { x: A.x + (B.x - A.x) * k, z: A.z + (B.z - A.z) * k };
            }
          return null;
        };
      let worst = 0,
        n = 0;
      const m0 = { x: m.x, z: m.z };
      c8.step(5, (i) => {
        const q2 = c8.px(2);
        hist.push({ t: h.S.step / 60, x: q2.x, z: q2.z });
        way = way.filter((q) => Math.hypot(q.x - p.x, q.z - p.z) > 1);
        const q = way[0] || goal;
        DF.cam.yaw = Math.atan2(q.x - p.x, q.z - p.z);
        DF.keys[DF.BIND.fwd] = true;
        if (i < 60) return;
        // drawn at the drawn time: where the host had it then
        const o = at(DF.CC.rt);
        if (!o) return;
        n++;
        worst = Math.max(worst, Math.hypot(o.x - m.x, o.z - m.z));
      });
      DF.keys[DF.BIND.fwd] = false;
      const walked = Math.hypot(m.x - m0.x, m.z - m0.z);
      // stopped: the mate catches up and stands; drawn where the host has it now
      c8.step(1.5);
      const q2 = c8.px(2),
        q1 = c8.px(1),
        now = Math.hypot(q2.x - m.x, q2.z - m.z),
        gap = Math.hypot(q2.x - q1.x, q2.z - q1.z);
      return {
        pass: n > 200 && worst < 0.6 && walked > 8 && now < 0.6 && gap < 4 && DF.net().mates.length === 1 && m.remote === true && m !== G.player,
        samples: n,
        worstAtDrawnTime: +worst.toFixed(3),
        mateWalked: +walked.toFixed(2),
        drawnVsHostNow: +now.toFixed(3),
        mateToPlayer: +gap.toFixed(2),
      };
    },
  },
  {
    name: "its hits show on my puppets: a flash, a quiet sound, its slash, and no kill of mine",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ ping: 100, mate: "fight" });
      DF.devGod(true);
      const he = c8.husk(37),
        pe = c8.pup(37),
        col = DF.CLASSES[r.mate.cls].col;
      c8.mateAt(he, 4);
      // quiet hit sounds, by volume
      const hit0 = DF.SFX.hit;
      let quiet = 0,
        loud = 0;
      DF.SFX.hit = (heavy, v = 1) => {
        if (v < 1) quiet++;
        else loud++;
        return hit0(heavy, v);
      };
      let flash = 0,
        arcs = 0,
        swung = false,
        deadAt = -1;
      try {
        c8.step(15, (i) => {
          if (DF.CC.pend.length === 0) flash = Math.max(flash, pe.flash);
          arcs = Math.max(arcs, G.arcs.filter((a) => a.c === col).length);
          if (c8.mate().state === "attack") swung = true;
          if (he.dead && deadAt < 0) deadAt = i;
          if (deadAt >= 0 && i > deadAt + 30) return false;
        });
      } finally {
        DF.SFX.hit = hit0;
      }
      // this page sent no event but its at (seq 1)
      return {
        pass: he.dead && he.kBy === 2 && pe.dead && flash > 0 && quiet > 0 && loud === 0 && arcs > 0 && swung && G.kills === 0 && DF.CC.seq === 1,
        hostDead: he.dead,
        killedBy: he.kBy,
        puppetDead: pe.dead,
        flash: +flash.toFixed(2),
        quietHits: quiet,
        loudHits: loud,
        mateArcs: arcs,
        kills: G.kills,
        mySeq: DF.CC.seq,
      };
    },
  },
  {
    name: "the other player's shots and blasts are drawn and hurt nothing",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ ping: 0, mate: "idle" });
      c8.step(0.5);
      const he = c8.husk(37),
        pe = c8.pup(37),
        p = G.player,
        hp0 = pe.hp,
        hhp0 = he.hp,
        php0 = p.hp,
        seq0 = DF.CC.seq;
      // a shot from 6 m off straight through the husk, and a blast on it
      const a = Math.atan2(pe.x - p.x, pe.z - p.z),
        q = c8.spot(pe.x, pe.z, a + Math.PI, 5) || { x: p.x, z: p.z };
      const vx = ((pe.x - q.x) / Math.hypot(pe.x - q.x, pe.z - q.z)) * 20,
        vz = ((pe.z - q.z) / Math.hypot(pe.x - q.x, pe.z - q.z)) * 20;
      c8.tell(["pshot", 2, q.x, 1.2, q.z, vx, vz, 0.2, 0.9, 0.4]);
      c8.tell(["pblast", 2, pe.x, pe.z, 3.5, 0.9, 0.5, 0.2]);
      let shot = null,
        ring = false,
        near = 9;
      c8.step(1, () => {
        const s = G.projs.find((o) => o.own === "m");
        if (s) {
          shot = shot || { c: s.c.slice() };
          near = Math.min(near, Math.hypot(s.x - pe.x, s.z - pe.z));
        }
        if (G.rings.some((g) => Math.abs(g.r - 3.5) < 1e-6)) ring = true;
      });
      return {
        pass: !!shot && shot.c[1] === 0.9 && near < 0.8 && ring && pe.hp === hp0 && he.hp === hhp0 && !pe.flash && p.hp === php0 && DF.CC.seq === seq0 && r.refused === null,
        shot,
        passedThrough: +near.toFixed(2),
        ring,
        puppetHp: [hp0, pe.hp],
        hostHp: [hhp0, he.hp],
        events: DF.CC.seq - seq0,
      };
    },
  },
  {
    name: "pause does not stop the dungeon, and a death under it shows the dead screen",
    eval: async () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      c8.solo({ ping: 50, mate: "idle" });
      const p = G.player,
        he = c8.husk(37);
      c8.near(he, 2.4);
      c8.step(1);
      DF.show("pause");
      await c8.frames();
      const note = c8.shown("pauseCoop") && document.getElementById("pauseCoop").textContent.includes("The dungeon does not pause in co-op.");
      p.hp = p.maxHp;
      const hp0 = p.hp,
        x0 = p.x,
        z0 = p.z;
      let v = 0,
        hit = 0;
      c8.step(3, () => {
        DF.keys[DF.BIND.fwd] = true;
        v = Math.max(v, Math.hypot(p.vx, p.vz));
        if (p.state === "hit") hit++;
      });
      DF.keys[DF.BIND.fwd] = false;
      const hp1 = p.hp,
        still = G.state === "pause",
        moved = Math.hypot(p.x - x0, p.z - z0);
      // a death while paused: the dead screen takes the pause screen's place
      const res = c8.die();
      c8.step(2.2);
      await c8.frames();
      const dead = G.state === "dead" && c8.shown("scr-dead") && !c8.shown("scr-pause");
      DF.respawn();
      DF.show("play");
      return {
        pass: note && hp1 < hp0 && v < 0.05 && still && res === "hit" && dead,
        note,
        hp: [hp0, +hp1.toFixed(1)],
        inputSpeed: +v.toFixed(3),
        movedByHits: +moved.toFixed(2),
        hitSteps: hit,
        res,
        dead,
      };
    },
  },
  {
    name: "one death resets nothing",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      let resets = 0;
      c8.solo({
        ping: 50,
        mate: "idle",
        tamper: (ev) => {
          if (ev[0] === "reset") resets++;
          return ev;
        },
      });
      c8.step(0.5);
      const a = c8.husk(37),
        b = c8.husk(18);
      c8.hostKill(2, a);
      c8.hostKill(2, b);
      c8.step(0.6);
      const was = new Set(G.enemies),
        dead0 = c8.pup(37).dead && c8.pup(18).dead;
      c8.die();
      c8.step(2.2);
      const sawDead = G.state === "dead";
      DF.respawn();
      DF.show("play");
      c8.step(1.5);
      const p = G.player,
        cp = G.checkpoint,
        gone = (id) => !c8.pup(id) || c8.pup(id).dead;
      return {
        pass: dead0 && sawDead && resets === 0 && a.dead && b.dead && gone(37) && gone(18) && G.enemies.every((e) => was.has(e)) && p.state !== "dead" && Math.hypot(p.x - cp.x, p.z - cp.z) < 3 && !!DF.net(),
        resets,
        hostDead: [a.dead, b.dead],
        sameEnemies: G.enemies.every((e) => was.has(e)),
        alive: G.enemies.filter((e) => !e.dead).length,
      };
    },
  },
  {
    name: "both dead resets the enemies, keeps the kills and the mate, and leaves me dead until I rise",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      let resets = 0;
      const r = c8.solo({
        ping: 50,
        mate: "idle",
        tamper: (ev) => {
          if (ev[0] === "reset") resets++;
          return ev;
        },
      });
      c8.step(0.5);
      // one kill of the mate's, one of mine
      c8.hostKill(2, c8.husk(37));
      DF.hitEnemy(c8.pup(18), 100, 0, { src: "melee" });
      c8.step(1);
      const kills = G.kills,
        runT = G.runT,
        boss = G.bossDead;
      r.mate.kill();
      c8.step(0.5);
      const p = G.player,
        cp = G.checkpoint,
        h = r.host;
      c8.die();
      const fell = { x: p.x, z: p.z };
      c8.step(3, () => (resets ? false : undefined));
      c8.step(0.5);
      // still dead where they fell, on the dead screen, the fall playing on
      const afterReset = {
        me: p.state,
        moved: +Math.hypot(p.x - fell.x, p.z - fell.z).toFixed(3),
        t: +p.t.toFixed(2),
        alive: G.enemies.filter((e) => !e.dead).length,
      };
      // the fall plays out and the dead screen comes up as in single player
      c8.step(1.5);
      afterReset.screen = G.state;
      afterReset.stillDead = p.state === "dead" && Math.hypot(p.x - fell.x, p.z - fell.z) === 0;
      const puppets = new Set(G.enemies);
      // staying on the dead screen brings no second wipe
      c8.step(5);
      const resetsWhileDead = resets;
      DF.respawn();
      DF.show("play");
      c8.step(0.5);
      return {
        pass:
          resets === 1 &&
          resetsWhileDead === 1 &&
          kills === 1 &&
          G.kills === 1 &&
          G.runT >= runT &&
          G.bossDead === boss &&
          afterReset.me === "dead" &&
          afterReset.screen === "dead" &&
          afterReset.stillDead &&
          afterReset.moved === 0 &&
          afterReset.t > 0.4 &&
          afterReset.alive === 47 &&
          G.enemies.length === 47 &&
          G.enemies.filter((e) => !e.dead).length === 47 &&
          G.enemies.every((e) => puppets.has(e)) &&
          h.G.enemies.filter((e) => !e.dead).length === 47 &&
          G.enemies.every((e) => DF.CC.byId.get(e.id) === e) &&
          DF.CC.pend.length === 0 &&
          p.state === "free" &&
          Math.hypot(p.x - cp.x, p.z - cp.z) < 3 &&
          DF.net().mates.length === 1 &&
          r.mate.p.state === "free",
        resets,
        resetsWhileDead,
        kills: [kills, G.kills],
        afterReset,
        alive: G.enemies.filter((e) => !e.dead).length,
        hostAlive: h.G.enemies.filter((e) => !e.dead).length,
        me: p.state,
        atCheckpoint: +Math.hypot(p.x - cp.x, p.z - cp.z).toFixed(2),
        mate: r.mate.p.state,
      };
    },
  },
  {
    name: "a reset mid-execution ends it: no pin or exec after, and no bomb, blast, shot or lock left",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ ping: 200, mate: "idle" }),
        h = r.host,
        p = G.player,
        he = c8.husk(37),
        pe = c8.pup(37);
      c8.near(he, 2);
      c8.step(0.5);
      Object.assign(he, { state: "stagger", t: 0, dur: 3.0, posture: he.def.posture, token: false });
      c8.step(1, () => (pe.state === "stagger" ? false : undefined));
      // every event this page sends once the reset is in
      let applied = false;
      const sent = [],
        L = DF.CC.link,
        send = L.send;
      L.send = (buf) => {
        if (applied && h.wire.type(buf) === 3) sent.push(h.wire.eventDecode(buf)[0]);
        return send(buf);
      };
      DF.startExecute(pe);
      c8.step(1 / 60);
      const executing = p.state === "execute",
        pinned = DF.CC.exE === pe;
      // things riding the old puppets: a bomb on it, a blast due, a spit in
      // the air far off, and the lock
      G.bombs.push({ x: pe.x, y: 1.1, z: pe.z, e: pe, ox: 0, oz: 0, t: 3 });
      G.pending.push({ x: pe.x, z: pe.z, r: 3, dmg: 10, post: 0, c: [1, 1, 1], t: 0.5 });
      G.projs.push({ x: p.x + 30, y: 1.2, z: p.z, vx: 10, vz: 0, life: 2, own: "e", dmg: 8, src: pe, kind: "spit", c: [1, 0.45, 0.2] });
      p.lock = pe;
      const list = [...h.S.byId.values()];
      c8.tell([
        "reset",
        { enemies: list.map((e) => [e.id, e.type, e.x, e.z, e.yaw]), dead: list.filter((e) => e.dead).map((e) => e.id), bossDead: false },
        h.S.step / 60,
      ]);
      let at = null;
      c8.step(1.5, () => {
        if (!applied && !G.enemies.includes(pe)) {
          applied = true;
          at = {
            state: p.state,
            exT: p.exT,
            bombs: G.bombs.length,
            pending: G.pending.length,
            spits: G.projs.filter((o) => o.own === "e").length,
            lock: p.lock,
          };
        }
      });
      L.send = send;
      return {
        pass:
          executing &&
          pinned &&
          applied &&
          at.state === "free" &&
          !at.exT &&
          at.bombs === 0 &&
          at.pending === 0 &&
          at.spits === 0 &&
          at.lock === null &&
          !sent.includes("pin") &&
          !sent.includes("exec") &&
          p.state === "free" &&
          !DF.CC.fin,
        executing,
        pinned,
        applied,
        atReset: at && { ...at, exT: !!at.exT, lock: !!at.lock },
        sentAfter: sent,
        now: p.state,
      };
    },
  },
  {
    name: "an away mate is marked and the enemies come for me",
    eval: async () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ ping: 50, mate: "idle" });
      DF.devGod(true);
      const he = c8.husk(37);
      c8.mateAt(he, 2.5);
      c8.near(he, 9);
      c8.step(2);
      const tg0 = he.tg,
        m = c8.mate();
      // what the frame draws for the mate: its rim light and its marker
      const look = async () => {
        const dn = DF.R.drawNode,
          sp = DF.R.sprite;
        let rim = null,
          mark = null;
        DF.R.drawNode = (root, rm) => {
          if (root === m.fig.root) rim = rm || [0, 0, 0];
          return dn(root, rm);
        };
        DF.R.sprite = (x, y, z, s, cr, cg, cb, a) => {
          if (Math.hypot(x - m.x, z - m.z) < 0.05 && y > 2) mark = [cr, cg, cb];
          return sp(x, y, z, s, cr, cg, cb, a);
        };
        try {
          await c8.frames();
        } finally {
          DF.R.drawNode = dn;
          DF.R.sprite = sp;
        }
        return { rim, mark };
      };
      const lit = await look();
      r.mate.away(true);
      // The husk turns to me only once the mate has been away COOP.AWAY (2 s),
      // then finishes what it was doing and crosses to me. How long that
      // takes, and where it stood when the mate went, are not seeded, so the
      // step waits for it to arrive (0.4 to 3.5 s after it turns, measured)
      // and does not compare two distances a fixed time apart.
      const dist = () => Math.hypot(he.x - G.player.x, he.z - G.player.z);
      const d0 = dist(),
        // within reach of me, and well nearer than it was
        want = Math.min(3, d0 - 1.5);
      let d1 = Infinity;
      const watch = () => {
        if (he.tg === 1) d1 = Math.min(d1, dist());
      };
      c8.step(4, watch);
      const away = m.away,
        tg1 = he.tg;
      c8.step(8, () => {
        watch();
        if (d1 < want) return false;
      });
      const faded = await look();
      r.mate.away(false);
      c8.step(1);
      const back = !m.away;
      const col = DF.CLASSES[r.mate.cls].col,
        same = (a, b) => !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) < 1e-6),
        grey = (c) => !!c && Math.abs(c[0] - c[1]) < 1e-6 && Math.abs(c[1] - c[2]) < 1e-6;
      return {
        pass:
          tg0 === 2 &&
          away &&
          tg1 === 1 &&
          d1 < want &&
          back &&
          same(lit.mark, col) &&
          lit.rim.some((v) => v > 0) &&
          grey(faded.mark) &&
          faded.rim.every((v) => v === 0),
        targetBefore: tg0,
        targetAway: tg1,
        away,
        back,
        huskToMe: [+d0.toFixed(2), +d1.toFixed(2)],
        lit,
        faded,
      };
    },
  },
  {
    name: "an enemy's shot stops at the other player, and not at a dead one",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ ping: 0, mate: "idle" });
      const p = G.player,
        w = G.world;
      // a straight clear line from the player
      let a = 0;
      for (let i = 0; i < 72; i++) {
        const b = (i * Math.PI) / 36;
        let ok = true;
        for (let d = 0; d <= 11 && ok; d += 0.5) ok = w.fieldAt(p.x + Math.sin(b) * d, p.z + Math.cos(b) * d) > 1;
        if (ok) {
          a = b;
          break;
        }
      }
      const along = (d) => ({ x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d });
      Object.assign(r.mate.p, along(5));
      c8.step(1);
      const m = c8.mate(),
        src = G.enemies.find((e) => e.type === "spit") || G.enemies[0],
        hp0 = p.hp;
      // a spit's shot from 11 m out, aimed at the player through the mate
      const fire = () => {
        const s = along(11);
        c8.tell(["shot", src.id, s.x, 1.2, s.z, -Math.sin(a) * 12, -Math.cos(a) * 12, 8, DF.CC.rt]);
        let pr = null,
          last = null,
          seen = false;
        c8.step(1.5, () => {
          const q = G.projs.find((o) => o.own === "e" && o.dmg === 8);
          if (q) {
            pr = q;
            seen = true;
            last = { x: q.x, z: q.z, toMate: Math.hypot(q.x - m.x, q.z - m.z), toMe: Math.hypot(q.x - p.x, q.z - p.z) };
          } else if (seen) return false;
        });
        return { seen, gone: !G.projs.includes(pr), last };
      };
      const stopped = fire(),
        hp1 = p.hp;
      r.mate.kill();
      c8.step(0.5);
      DF.devGod(true);
      const passes = fire();
      return {
        pass:
          stopped.seen &&
          stopped.gone &&
          stopped.last.toMate < 1.05 &&
          stopped.last.toMe > 3 &&
          hp1 === hp0 &&
          passes.seen &&
          passes.last.toMe < 2,
        stopped,
        passes,
        hp: [hp0, hp1],
      };
    },
  },
  {
    name: "joining mid-fight: the dead stay dead and the staggered one is drawn staggered",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const k0 = DF.SFX.kill;
      let kills = 0;
      DF.SFX.kill = () => {
        kills++;
        return k0();
      };
      let ids = null;
      try {
        c8.solo({
          ping: 0,
          // a player 9 joins first, kills two husks, staggers one and leaves
          before: (h) => {
            const ask = (ev) => h.recv(9, h.wire.eventEncode([ev[0], ++c8.seq, ...ev.slice(1)]));
            h.recv(9, h.wire.eventEncode(["hello", 0, h.v, "fighter", h.build]));
            ask(["at", h.S.epoch]);
            const husks = [...h.S.byId.values()].filter((e) => e.type === "husk" && e.id !== 37);
            const [a, b] = husks,
              s = h.S.byId.get(37);
            for (const e of [a, b]) for (let i = 0; i < 3 && !e.dead; i++) ask(["hit", e.id, 500, 0, 1, "melee", e.x, e.z, e.state, e.an]);
            ask(["hit", s.id, 1, 500, 1, "melee", s.x, s.z, s.state, s.an]);
            ids = { dead: [a.id, b.id], deadNow: a.dead && b.dead, stag: s.state };
            h.leave(9);
          },
        });
        c8.step(0.4);
      } finally {
        DF.SFX.kill = k0;
      }
      const gone = ids.dead.every((id) => !DF.CC.byId.get(id) || DF.CC.byId.get(id).dead),
        pe = c8.pup(37);
      return {
        pass: ids.deadNow && ids.stag === "stagger" && gone && kills === 0 && G.kills === 0 && pe.state === "stagger" && G.enemies.length === 45,
        ids,
        gone,
        killSounds: kills,
        kills: G.kills,
        staggered: pe.state,
        enemies: G.enemies.length,
      };
    },
  },
  {
    name: "a kill sounds only near this player, and not when it was applied before entering or late",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const k0 = DF.SFX.kill;
      let sounds = 0;
      DF.SFX.kill = () => {
        sounds++;
        return k0();
      };
      const out = {};
      try {
        const r = c8.solo({ ping: 50, mate: "idle" });
        DF.devGod(true);
        // beside the pack of four round husk 18
        c8.near(c8.husk(18), 6);
        c8.step(0.5);
        const p = G.player,
          h = r.host,
          d = (e) => Math.hypot(e.x - p.x, e.z - p.z),
          list = [...h.S.byId.values()].filter((e) => !e.dead && !e.def.boss).sort((a, b) => d(a) - d(b)),
          near = list.slice(0, 3),
          far = list.find((e) => d(e) > 40 && !near.includes(e));
        out.dists = [...near.map(d), d(far)].map((v) => +v.toFixed(1));
        const one = (e, sec = 0.6) => {
          const s0 = sounds;
          c8.hostKill(2, e);
          c8.step(sec);
          return { sounds: sounds - s0, dead: !!c8.pup(e.id) && c8.pup(e.id).dead };
        };
        out.near = one(near[0]);
        out.far = one(far);
        // applied while the run is not live
        DF.net().live = false;
        out.notLive = one(near[1]);
        DF.net().live = true;
        // applied late: the link holds everything for 2 s
        r.cfg.hold = true;
        const s0 = sounds;
        c8.hostKill(2, near[2]);
        c8.step(2);
        r.cfg.hold = false;
        c8.step(0.6);
        out.late = { sounds: sounds - s0, dead: c8.pup(near[2].id).dead };
      } finally {
        DF.SFX.kill = k0;
        DF.devGod(false);
      }
      const ok = (o, n) => o.dead && o.sounds === n;
      return {
        pass: out.dists.slice(0, 3).every((v) => v < 25) && out.dists[3] > 40 && ok(out.near, 1) && ok(out.far, 0) && ok(out.notLive, 0) && ok(out.late, 0),
        ...out,
      };
    },
  },
  {
    name: "the gate takes both back to the hall, sent once, with no win screen",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      let world = null;
      const r = c8.solo({
        ping: 200,
        mate: "idle",
        tamper: (ev) => {
          if (ev[0] === "world") world = ev[1];
          return ev;
        },
      });
      const h = r.host,
        recv = h.recv;
      let gates = 0;
      h.recv = (pid, buf) => {
        if (pid === 1 && h.wire.type(buf) === 3 && h.wire.eventDecode(buf)[0] === "gate") gates++;
        return recv(pid, buf);
      };
      const wd = [...h.S.byId.values()].find((e) => e.def.boss);
      c8.step(0.5);
      for (let i = 0; i < 20 && !wd.dead; i++) c8.ask(2, ["hit", wd.id, 500, 0, 1, "melee", wd.x, wd.z, wd.state, wd.an]);
      c8.step(2);
      const open = G.bossDead && !!G.gate,
        p = G.player;
      p.x = G.gate.x;
      p.z = G.gate.z;
      c8.arrive("hub");
      h.recv = recv;
      const t = world ? Math.floor(world.won) : -1,
        time = "Time " + Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
      const c = {
        open,
        gates: gates === 1,
        hall: G.zone === "hub" && h.S.kind === "hub" && !!DF.net() && DF.net().live === true,
        noWin: G.state === "play",
        world: !!world && world.kind === "hub" && world.from === "E" && typeof world.won === "number" && world.won > 2,
        said: G.msgs.some((m) => m.text === "OUT ALIVE") && G.msgs.some((m) => m.text === time),
        mateIn: c8.px(2).here === true && DF.net().mates.length === 1,
      };
      return { pass: Object.values(c).every(Boolean), c, msgs: G.msgs.map((m) => m.text), time };
    },
  },
  {
    name: "joining with the Warden dead: the gate is there, and stepping into it takes both to the hall",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      let killed = null;
      const r = c8.solo({
        ping: 100,
        // a player 9 kills the Warden and leaves before this page joins
        before: (h) => {
          const ask = (ev) => h.recv(9, h.wire.eventEncode([ev[0], ++c8.seq, ...ev.slice(1)]));
          h.recv(9, h.wire.eventEncode(["hello", 0, h.v, "fighter", h.build]));
          ask(["at", h.S.epoch]);
          const wd = [...h.S.byId.values()].find((e) => e.def.boss);
          for (let i = 0; i < 20 && !wd.dead; i++) ask(["hit", wd.id, 500, 0, 1, "melee", wd.x, wd.z, wd.state, wd.an]);
          killed = wd.dead && h.G.bossDead;
          h.leave(9);
        },
      });
      DF.devGod(true);
      const h = r.host,
        recv = h.recv;
      let gates = 0;
      h.recv = (pid, buf) => {
        if (pid === 1 && h.wire.type(buf) === 3 && h.wire.eventDecode(buf)[0] === "gate") gates++;
        return recv(pid, buf);
      };
      const w = G.world,
        bossDead = G.bossDead,
        gate = G.gate ? { x: G.gate.x, z: G.gate.z } : null,
        atBoss = !!gate && Math.hypot(gate.x - w.boss.x, gate.z - w.boss.z) < 1e-9;
      const p = G.player;
      if (gate) {
        p.x = gate.x;
        p.z = gate.z;
      }
      c8.arrive("hub", 3.5);
      h.recv = recv;
      DF.devGod(false);
      const hall = G.zone === "hub" && G.state === "play" && !!DF.net() && h.S.kind === "hub";
      return {
        pass: killed && bossDead && !!gate && atBoss && gates === 1 && hall,
        killed,
        bossDead,
        gate,
        atBoss,
        gates,
        hall,
        state: G.state,
      };
    },
  },
  {
    name: "from the hall to the cave and back",
    eval: async () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ hub: true, seed: 99, ping: 50, mate: "idle" });
      DF.devGod(true);
      const h = r.host,
        c = {};
      c.hall = G.zone === "hub" && G.enemies.length === 1 && G.enemies[0].def.dummy === true && !!DF.net() && DF.net().live === true;
      c.went = c8.walkIn("E");
      const w = G.world,
        p = G.player;
      // two in the room: a dungeon for two, the big cave drawn in pieces
      // with the host's extra enemies (188 in big cave 99)
      c.cave = G.zone === "cave" && G.seed === 99 && h.S.n === 2 && G.enemies.length === h.G.enemies.length && G.enemies.length === 188 && G.enemies.every((e) => !!e.nb);
      c.big = w.big === true && h.G.world.big === true && Array.isArray(w.pieces) && w.pieces.length > 0 &&
        DF.coopWorldSum(w) === h.sum(h.G.world);
      c.atStart = Math.hypot(p.x - w.spawn.x, p.z - w.spawn.z) < 1e-6;
      c.hostCave = h.S.kind === "cave" && h.G.seed === 99 && c8.px(1).here === true && c8.px(2).here === true;
      // the Warden dies on the host; this page steps into its gate
      const wd = [...h.S.byId.values()].find((e) => e.def.boss);
      c8.hostKill(2, wd);
      c8.step(2);
      c.gate = G.bossDead && !!G.gate;
      if (G.gate) {
        p.x = G.gate.x;
        p.z = G.gate.z;
      }
      c8.arrive("hub");
      const P = G.player,
        f = DF.portalFront(c8.portal("E"), 3.5);
      c.back = G.zone === "hub" && !!DF.net() && DF.net().live === true && h.S.kind === "hub";
      c.inFront = Math.hypot(P.x - f.x, P.z - f.z) < 0.05;
      c.out = G.msgs.some((m) => m.text === "OUT ALIVE") && G.msgs.some((m) => /^Time \d+:\d\d$/.test(m.text));
      await c8.frames();
      c.noWin = G.state === "play" && !document.getElementById("scr-win").classList.contains("show");
      DF.devGod(false);
      return { pass: Object.values(c).every((v) => v === true), c, msgs: G.msgs.map((m) => m.text) };
    },
  },
  {
    name: "a second trip is a new cave",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const went = c8.walkIn("E"),
        h = c8.r.host;
      return {
        pass: went && G.zone === "cave" && G.seed !== 99 && h.G.seed === G.seed && G.enemies.length > 0 && G.enemies.every((e) => !!e.nb),
        seed: G.seed,
        hostSeed: h.G.seed,
      };
    },
  },
  {
    name: "the friend is taken along, and cannot open a gate",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ hub: true, pid: 2, ping: 50 }),
        h = r.host,
        c = {};
      c.joined = G.zone === "hub" && DF.CC.pid === 2 && DF.net().mates.length === 1 && DF.net().mates[0].pid === 1;
      r.mateAsk("travel", "E", 99);
      c8.arrive("cave");
      c.taken = G.zone === "cave" && G.seed === 99 && h.S.n === 2 && G.enemies.length === h.G.enemies.length && c8.px(2).here === true;
      r.mateAsk("travel", "hub");
      c8.arrive("hub");
      c.back = G.zone === "hub" && c8.px(2).here === true;
      const e0 = h.S.epoch,
        log = c8.msgLog();
      c8.walkIn("E", 2, () => {
        log();
        return false;
      });
      const line = "Only the host can open a gate.",
        o = DF.portalFront(c8.portal("E"), -0.75);
      c.inGate = Math.hypot(G.player.x - o.x, G.player.z - o.z) < 1;
      c.line = log().filter((t) => t === line).length === 1;
      // nothing asked since this world's at and cls
      c.stays = G.zone === "hub" && h.S.epoch === e0 && !G.trans && DF.CC.seq === 2;
      return { pass: Object.values(c).every((v) => v === true), c, msgs: log() };
    },
  },
  {
    name: "a paused player is taken along",
    eval: async () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ hub: true, pid: 2, ping: 50 }),
        c = {};
      DF.show("pause");
      await c8.frames();
      c.paused = G.zone === "hub" && G.state === "pause" && c8.shown("scr-pause");
      r.mateAsk("travel", "E", 99);
      c8.arrive("cave");
      await c8.frames();
      const p = G.player,
        sp = G.world.spawn;
      c.cave = G.zone === "cave" && G.seed === 99 && !G.trans;
      // the friend: beside the cave's start, on walkable ground
      const d = Math.hypot(p.x - sp.x, p.z - sp.z);
      c.atStart = d >= 0.8 && d <= 1.6 && G.world.fieldAt(p.x, p.z) > 0;
      c.live = DF.net() !== null && DF.net().live === true;
      c.stillPaused = G.state === "pause" && c8.shown("scr-pause");
      DF.show("play");
      return { pass: Object.values(c).every((v) => v === true), c, where: [p.x, p.z, sp.x, sp.z] };
    },
  },
  {
    name: "the feed is announced",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const line = "The Ossuary Warden feeds on the fallen.";
      let wid = null;
      // a fed for the Warden half a second after the join's time
      const r = c8.solo({
        ping: 50,
        two: true,
        tamper: (ev) => {
          if (ev[0] !== "join") return ev;
          const q = ev[1].enemies.find((o) => o[1] === "warden");
          wid = q[0];
          return [ev, ["fed", wid, ev[1].t + 0.5]];
        },
      });
      const log = c8.msgLog(),
        c = {};
      c8.step(1.5, () => {
        log();
      });
      c.said = log().filter((t) => t === line).length === 1;
      // one long past its time is silent
      c8.tell(["fed", wid, r.host.S.step / 60 - 3]);
      c8.step(0.5, () => {
        log();
      });
      c.lateQuiet = log().filter((t) => t === line).length === 1;
      // a malformed one or one naming no enemy is ignored
      c8.tell(["fed", 9999, r.host.S.step / 60]);
      c8.tell(["fed", wid]);
      c8.tell(["fed", String(wid), r.host.S.step / 60]);
      let threw = null;
      try {
        c8.step(0.5, () => {
          log();
        });
      } catch (e) {
        threw = String(e);
      }
      c.ignored = !threw && log().filter((t) => t === line).length === 1 && !!DF.net();
      return { pass: wid !== null && Object.values(c).every((v) => v === true), c, threw, msgs: log() };
    },
  },
  {
    name: "Return to base: the host's takes both to the hall; the friend has none; a dead friend arrives alive",
    eval: async () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const c = {};
      // the host's page, dead in the cave
      let r = c8.solo({ hub: true, seed: 99, ping: 50, mate: "idle" });
      c.inCave = c8.walkIn("E");
      c8.die();
      c8.step(2.5, () => (G.state === "dead" ? false : undefined));
      await c8.frames();
      c.deadScreen = G.state === "dead" && c8.shown("btnDeadBase");
      document.getElementById("btnDeadBase").click();
      c8.arrive("hub");
      const P = G.player;
      c.base = G.zone === "hub" && P.state !== "dead" && P.hp === P.maxHp && G.state === "play" && !!DF.net() && r.host.S.kind === "hub";
      await c8.frames();
      c.playScreen = !document.getElementById("scr-dead").classList.contains("show");
      // the friend's pause and death screens have no Return to base
      r = c8.solo({ hub: true, pid: 2, ping: 50 });
      r.mateAsk("travel", "E", 99);
      c8.arrive("cave");
      DF.show("pause");
      await c8.frames();
      c.friendPause = !c8.shown("btnBase") && c8.shown("btnResume") && c8.shown("btnExit");
      DF.show("dead");
      await c8.frames();
      c.friendDead = !c8.shown("btnDeadBase") && c8.shown("btnRise") && c8.shown("btnDeadExit");
      DF.coopEnd("left");
      DF.show("pause");
      await c8.frames();
      c.soloPause = c8.shown("btnBase");
      DF.show("dead");
      await c8.frames();
      c.soloDead = c8.shown("btnDeadBase");
      // a dead friend when the host travels
      r = c8.solo({ hub: true, pid: 2, ping: 50 });
      c8.die();
      c8.step(2.5, () => (G.state === "dead" ? false : undefined));
      c.friendDied = G.state === "dead" && G.player.state === "dead";
      r.mateAsk("travel", "E", 99);
      c8.arrive("cave");
      const F = G.player;
      c.alive = G.zone === "cave" && F.state !== "dead" && F.hp === F.maxHp && G.state === "play";
      await c8.frames();
      c.friendPlay = !document.getElementById("scr-dead").classList.contains("show");
      return { pass: Object.values(c).every((v) => v === true), c };
    },
  },
  {
    name: "exit in the middle of a co-op fade",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      c8.solo({ hub: true, seed: 99, ping: 50 });
      c8.walkIn("E", 3, () => !!G.trans);
      const fading = !!G.trans && G.zone === "hub";
      DF.show("pause");
      document.getElementById("btnExit").click();
      DF.sim(2);
      return {
        pass: fading && G.state === "title" && DF.net() === null && G.zone === "hub" && G.trans === null,
        fading,
        state: G.state,
        zone: G.zone,
        trans: !!G.trans,
      };
    },
  },
  {
    name: "the player's own hall comes back",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      DF.resetCleared();
      DF.clearGrade("E", DF.OPT.cls);
      c8.solo({ hub: true });
      const coop = c8.portal("E").open === true && c8.portal("D").open === false;
      DF.show("pause");
      document.getElementById("btnExit").click();
      document.getElementById("btnSolo").click();
      document.getElementById("btnPlay").click();
      const solo = G.state === "play" && DF.net() === null && G.zone === "hub" && c8.portal("D").open === true;
      DF.resetCleared();
      return { pass: coop && solo, coop, solo };
    },
  },
  {
    name: "a plaque reads but takes no code in a co-op hall",
    eval: async () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ hub: true, ping: 50, mate: "idle" }),
        c = {},
        q = G.world.plaques.find((o) => o.cls),
        cls = q.cls,
        tap = (a) => (DF.taps[DF.BIND[a]] = true);
      DF.UNLOCKED.delete(cls);
      DF.saveOpt();
      DF.setPlaqueCode(cls, "fwd back left right");
      const stand = () => {
        const p = G.player,
          f = DF.plaqueFront(q, 1.6);
        p.x = f.x;
        p.z = f.z;
        p.yaw = DF.cam.yaw = q.yaw + Math.PI;
        p.state = "free";
      };
      stand();
      c8.step(0.05);
      tap("interact");
      c8.step(0.6);
      c.open = !!G.insp && G.player.state === "inspect";
      await c8.frames();
      c.card = c8.shown("plaque");
      for (const a of ["fwd", "back", "left", "right"]) {
        tap(a);
        c8.step(0.05);
      }
      c.noCode = DF.classOpen(cls) === false && !!G.insp && G.insp.syms.length === 0;
      c8.step(0.5);
      const me = r.mate.snap && r.mate.snap.players.find((o) => o.pid === 1);
      c.seen = !!me && me.state === "inspect";
      tap("interact");
      c8.step(0.6);
      c.closed = !G.insp && G.player.state === "free";
      // out of co-op, in a fresh hall, the same code unlocks it
      DF.coopEnd("left");
      DF.enterHub();
      DF.show("play");
      stand();
      DF.sim(0.05);
      tap("interact");
      DF.sim(0.6);
      for (const a of ["fwd", "back", "left", "right"]) {
        tap(a);
        DF.sim(0.05);
      }
      c.solo = DF.classOpen(cls) === true;
      DF.closePlaque(true);
      DF.UNLOCKED.delete(cls);
      DF.saveOpt();
      DF.resetPlaqueCodes();
      return { pass: Object.values(c).every((v) => v === true), c };
    },
  },
  {
    name: "no new gate line in co-op",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      DF.resetCleared();
      // saved, so the kill clears E and would open D in a solo hall
      const r = c8.solo({ hub: true, seed: 99, ping: 50, mate: "idle", save: true }),
        h = r.host;
      DF.devGod(true);
      const went = c8.walkIn("E");
      DF.devGod(false);
      const log = c8.msgLog(),
        wd = [...h.S.byId.values()].find((e) => e.def.boss);
      c8.hostKill(2, wd);
      c8.step(2, () => void log());
      const texts = log(),
        c = {
          went,
          dead: G.bossDead === true,
          said: texts.includes("A gate opens. Step through to leave."),
          cleared: DF.gradeCleared("E") === true,
          noLine: !texts.some((t) => t.includes("A new gate has opened")),
        };
      DF.coopEnd("left");
      DF.resetCleared();
      return { pass: Object.values(c).every((v) => v === true), c, texts };
    },
  },
  {
    name: "reduced motion cuts: the swap is on the step the world arrives",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ hub: true, seed: 99, ping: 50 }),
        h = r.host;
      DF.setRM(true);
      let at = null,
        trans = false;
      const om = r.link.onmessage;
      r.link.onmessage = (buf) => {
        om(buf);
        if (!at && h.wire.type(buf) === 3 && h.wire.eventDecode(buf)[0] === "world")
          at = { zone: G.zone, seed: G.seed, trans: !!G.trans };
      };
      c8.walkIn("E", 3, () => {
        trans = trans || !!G.trans;
        return G.zone === "cave";
      });
      DF.setRM(false);
      return {
        pass: !!at && at.zone === "cave" && at.seed === 99 && !at.trans && !trans && G.trans === null,
        at,
        trans,
      };
    },
  },
  {
    name: "a mate who leaves is removed; a join's peers and a peer event draw one; malformed ones are ignored",
    eval: async () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ ping: 50, mate: "idle" });
      c8.step(0.5);
      await c8.frames();
      const bar = c8.shown("mateBar"),
        vb = document.getElementById("vitals").getBoundingClientRect(),
        mb = document.getElementById("mateBar").getBoundingClientRect(),
        under = mb.top >= vb.bottom && mb.top - vb.bottom < 12 && mb.height > 0 && mb.height <= 8;
      r.mate.leave();
      c8.step(0.5);
      const left = DF.net().mates.length === 0;
      await c8.frames();
      const barGone = !c8.shown("mateBar");
      // malformed peer events change nothing; a good one adds the mate
      // only pids 1 and 2 exist, and this page's own is never a mate
      for (const ev of [["peer"], ["peer", "x", "mage"], ["peer", 2, 7], ["peer", 3, "mage"], ["peer", 0, "mage"], ["peer", DF.CC.pid, "mage"], ["reset", 5, 0], ["end", "soon"], ["pshot", 2, "a"], ["pblast", 2, 1, 1, -1, 1, 1, 1]])
        c8.tell(ev);
      c8.step(0.3);
      const still = !!DF.net() && DF.net().mates.length === 0 && G.enemies.length === 47 && G.state === "play";
      c8.tell(["peer", 2, "enforcer"]);
      c8.step(0.3);
      const fell = DF.net().mates.length === 1 && c8.mate().clsId === "assassin" && c8.mate().remote;
      // a join that lists a peer draws it at once
      c8.solo({
        ping: 0,
        tamper: (ev) => {
          if (ev[0] === "join") ev[1].peers = [[2, "mage"]];
          return ev;
        },
      });
      const fromJoin = DF.net().mates.length === 1 && c8.mate().clsId === "mage" && c8.mate().pid === 2;
      const net = DF.net();
      DF.coopEnd("test");
      await c8.frames();
      return {
        pass: bar && under && left && barGone && still && fell && fromJoin && net.mates.length === 0 && !c8.shown("mateBar") && !c8.shown("coopWait"),
        bar,
        under,
        left,
        barGone,
        still,
        fell,
        fromJoin,
      };
    },
  },
  {
    name: "a silent host: Waiting for the host after a second, gone when it speaks",
    eval: async () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ ping: 50, mate: "idle" });
      c8.step(1);
      r.halt = true;
      c8.step(0.6);
      await c8.frames();
      const early = c8.shown("coopWait");
      c8.step(0.6);
      await c8.frames();
      const shown = c8.shown("coopWait") && document.getElementById("coopWait").textContent.includes("Waiting for the host");
      r.halt = false;
      c8.step(0.5);
      await c8.frames();
      const hidden = !c8.shown("coopWait");
      r.halt = true;
      c8.step(1.3);
      await c8.frames();
      DF.cam.yaw = G.player.yaw;
      return {
        pass: !early && shown && hidden && c8.shown("coopWait") && !!DF.net(),
        early,
        shown,
        hidden,
      };
    },
  },
  { wait: 400, shot: "t28-wait" },
  {
    name: "a silent host: after ten seconds, back to the title and told why",
    eval: async () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      let t = 0;
      c8.step(10, () => {
        if (!DF.net()) return false;
        t++;
      });
      await c8.frames();
      const msg = document.getElementById("coopMsg");
      return {
        pass: G.state === "title" && DF.net() === null && DF.CC.link === null && DF.CC.why === "host" && c8.shown("coopMsg") && msg.textContent === "The host has left." && G.zone === "hub" && !c8.shown("coopWait") && t / 60 > 8.3,
        state: G.state,
        why: DF.CC.why,
        msg: msg.textContent,
        zone: G.zone,
        silentFor: +(t / 60 + 1.3).toFixed(2),
      };
    },
  },
  {
    name: "after co-op, a solo cave works",
    eval: () => {
      const { G } = DF;
      G.manual = true;
      DF.enterCave("E", 99);
      DF.show("play");
      const p = G.player,
        e = G.enemies[37];
      const q = window.__c8.spot(e.x, e.z, e.yaw, 6);
      p.x = q.x;
      p.z = q.z;
      const x0 = e.x,
        z0 = e.z;
      DF.sim(5);
      return {
        pass: DF.net() === null && e.type === "husk" && e.aware && Math.hypot(e.x - x0, e.z - z0) > 1 && !e.nb,
        aware: e.aware,
        moved: +Math.hypot(e.x - x0, e.z - z0).toFixed(2),
      };
    },
  },
  {
    name: "after a run that ended and after a refusal, a solo cave works as before",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const solo = () => {
        DF.enterCave("E", 99);
        DF.show("play");
        const p = G.player,
          e = G.enemies[37],
          q = c8.spot(e.x, e.z, e.yaw, 6);
        p.x = q.x;
        p.z = q.z;
        const x0 = e.x,
          z0 = e.z;
        DF.sim(5);
        return DF.net() === null && DF.CC.link === null && e.type === "husk" && e.aware && Math.hypot(e.x - x0, e.z - z0) > 1 && !e.nb;
      };
      const out = {};
      // ended
      c8.solo({ ping: 0 });
      c8.step(0.3);
      DF.coopEnd("end");
      out.ended = DF.CC.why === "end" && solo();
      // refused: another cave, and a join it cannot read
      const refused = (f) => {
        const r = c8.solo({ ping: 0, tamper: (ev) => (ev[0] === "join" && f(ev[1]), ev) });
        return r.refused;
      };
      out.caveWhy = refused((j) => (j.sum = "0"));
      out.cave = out.caveWhy === "cave" && solo();
      out.badWhy = refused((j) => (j.grade = "D"));
      out.bad = out.badWhy === "bad" && solo();
      return { pass: out.ended && out.cave && out.bad, ...out };
    },
  },
  {
    name: "return to base leaves the run",
    eval: async () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      c8.solo({ ping: 50, mate: "idle" });
      c8.step(0.5);
      const was = !!DF.net();
      DF.enterHub("E");
      DF.show("pause");
      await c8.frames();
      const note = c8.shown("pauseCoop");
      DF.show("play");
      return {
        pass: was && DF.net() === null && DF.CC.link === null && DF.CC.why === "left" && G.zone === "hub" && !note,
        why: DF.CC.why,
        zone: G.zone,
        pauseNote: note,
      };
    },
  },
  {
    name: "an execution on the dummy in a co-op hall leaves it standing, here and on the host, and its rewards stand",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ hub: true, ping: 50 }),
        h = r.host,
        p = G.player,
        he = h.G.enemies[0],
        pe = c8.pup(he.id),
        c = {};
      c.dummy = he.def.dummy === true && !!pe && pe.def.dummy === true;
      // what this page asks of the host
      const sent = [],
        recv = h.recv;
      h.recv = (pid, buf) => {
        if (pid === 1 && h.wire.type(buf) === 3) sent.push(h.wire.eventDecode(buf)[0]);
        return recv(pid, buf);
      };
      c8.near(he, 2);
      // the host staggers it, and this page shows it
      Object.assign(he, { state: "stagger", t: 0, dur: 3.0, posture: he.def.posture });
      c8.step(1, () => (pe.state === "stagger" ? false : undefined));
      c.shown = pe.state === "stagger";
      // drawn where the host has it (a type with no speed once glided to NaN)
      c.drawn = Math.hypot(pe.x - he.x, pe.z - he.z) < 0.05;
      c8.near(he, 2);
      p.focus = 0;
      const hp0 = (p.hp = p.maxHp - 30);
      let started = false,
        fin = null,
        after = -1,
        host = null,
        last = null,
        drop = 0,
        hpDrop = 0,
        again = false;
      c8.step(4, (i) => {
        p.yaw = DF.cam.yaw = Math.atan2(pe.x - p.x, pe.z - p.z);
        // until it starts: a swing can eat one press
        if (!started && i % 10 === 0) DF.taps[DF.BIND.light] = true;
        if (p.state === "execute") started = true;
        if (!fin && started && p.exDone) {
          fin = { hp: p.hp, focus: p.focus };
          after = 0;
        } else if (fin) after++;
        // half a second after the finish: the host's dummy as it stands
        if (after === 30) host = { state: he.state, pin: he.pin, hp: he.hp, dead: he.dead };
        // the hall fills focus on its own; a take-back is a fall
        if (last) {
          drop = Math.min(drop, p.focus - last.focus);
          hpDrop = Math.min(hpDrop, p.hp - last.hp);
        }
        last = { hp: p.hp, focus: p.focus };
        if (fin && pe.state === "stagger") again = true;
      });
      h.recv = recv;
      c.started = started && !!fin;
      c.execSent = sent.includes("pin") && sent.includes("exec");
      c.host = !!host && host.state !== "stagger" && host.pin === 0 && host.hp === he.def.hp && host.dead === false;
      c.hostNow = he.state !== "stagger" && he.pin === 0 && he.hp === he.def.hp && !he.dead && h.G.enemies[0] === he;
      c.puppet = !pe.dead && pe.state !== "stagger" && pe.hp === pe.def.hp && !again;
      c.paid = !!fin && Math.abs(fin.hp - hp0 - 10) < 1e-6 && p.hp === fin.hp && hpDrop === 0 && drop === 0 && DF.CC.fin === null;
      return {
        pass: Object.values(c).every((v) => v === true),
        c,
        sent,
        host,
        fin,
        drop,
        hpDrop,
        hp: [hp0, p.hp],
        puppet: { state: pe.state, hp: pe.hp, again },
      };
    },
  },
  {
    name: "a reset with the Warden dead opens its gate; with it alive, the boss stands and there is no gate",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const c = {};
      // a player 9 is in the cave; this page's at is still on its way
      let r = c8.solo({
        ping: 200,
        before: (h) => {
          h.recv(9, h.wire.eventEncode(["hello", 0, h.v, "fighter", h.build]));
          h.recv(9, h.wire.eventEncode(["at", ++c8.seq, h.S.epoch]));
        },
      });
      let h = r.host;
      const wd = [...h.S.byId.values()].find((e) => e.def.boss);
      c.notHere = c8.px(1).here === false;
      // the Warden dies before the host has heard this page: it is told
      // nothing of the kill, and its at is answered with the enemies again
      for (let i = 0; i < 20 && !wd.dead; i++)
        h.recv(9, h.wire.eventEncode(["hit", ++c8.seq, wd.id, 500, 0, 1, "melee", wd.x, wd.z, wd.state, wd.an]));
      c.killed = wd.dead && h.G.bossDead;
      c8.step(1);
      c.here = c8.px(1).here === true;
      c.dead = G.bossDead === true && !!G.gate && !G.enemies.some((e) => e.def.boss && !e.dead);
      c.gateAt = !!G.gate && Math.hypot(G.gate.x - G.world.boss.x, G.gate.z - G.world.boss.z) < 1e-9;
      // a wipe after the boss's death says it is dead again: the gate stays
      const g = G.gate,
        list = (dead) => {
          const es = [...h.S.byId.values()].filter((e) => !(dead && e.def.boss));
          return { enemies: es.map((e) => [e.id, e.type, e.x, e.z, e.yaw]), dead: [], bossDead: dead };
        };
      c8.tell(["reset", list(true), h.S.step / 60]);
      c8.step(0.2);
      c.kept = G.gate === g && G.bossDead === true;
      h.leave(9);
      // with the boss alive a wipe sends it alive: its puppet stands, no gate
      r = c8.solo({ ping: 50 });
      h = r.host;
      c8.step(0.3);
      c8.tell(["reset", list(false), h.S.step / 60]);
      c8.step(0.2);
      const b = G.enemies.find((e) => e.def.boss);
      c.alive = !!b && !b.dead && G.bossDead === false && !G.gate;
      return { pass: Object.values(c).every((v) => v === true), c };
    },
  },
  {
    name: "a class picked while a world is on its way reaches the host after it",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ hub: true, pid: 2, ping: 50 }),
        h = r.host,
        c = {},
        told = [],
        send = h.send;
      h.send = (to, buf) => {
        if (to === 1 && h.wire.type(buf) === 3) {
          const ev = h.wire.eventDecode(buf);
          if (ev[0] === "cls") told.push(ev);
        }
        return send(to, buf);
      };
      const base = Object.keys(DF.CLASSES).filter((k) => !DF.CLASSES[k].hidden),
        saved = DF.OPT.cls,
        was = c8.px(2).clsId,
        to = base.find((k) => k !== was && k !== G.player.clsId);
      c.was = G.player.clsId === was;
      // the host travels; this page picks a class before its world arrives
      r.mateAsk("travel", "E", 99);
      c.away = c8.px(2).here === false;
      const card = document.createElement("button");
      card.className = "card";
      card.dataset.cls = to;
      document.body.appendChild(card);
      card.click();
      card.remove();
      c.mine = G.player.clsId === to && DF.CC.cls === to;
      c8.step(0.08);
      // the host dropped it: this player was not there
      c.dropped = c8.px(2).clsId === was && told.length === 0;
      c8.arrive("cave");
      c8.step(0.5);
      c.cave = G.zone === "cave" && c8.px(2).here === true;
      c.proxy = c8.px(2).clsId === to;
      c.told = told.length === 1 && told[0][1] === 2 && told[0][2] === to;
      c.still = G.player.clsId === to;
      h.send = send;
      // the save as it was, for the steps after
      DF.setClass(saved);
      return { pass: Object.values(c).every((v) => v === true), c, was, to, proxy: c8.px(2).clsId, told };
    },
  },
  {
    name: "the friend arrives beside the host's arrival point, on walkable ground",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ hub: true, pid: 2, ping: 50 }),
        h = r.host,
        c = {},
        at = {};
      // within 0.8 to 1.6 m of where pid 1 arrives, on walkable ground, and
      // where the host put this player's proxy before hearing it
      const beside = (k, q, px) => {
        const p = G.player,
          d = Math.hypot(p.x - q.x, p.z - q.z);
        at[k] = { d: +d.toFixed(3), field: +G.world.fieldAt(p.x, p.z).toFixed(3), proxy: px && +Math.hypot(p.x - px.x, p.z - px.z).toFixed(3) };
        return d >= 0.8 && d <= 1.6 && G.world.fieldAt(p.x, p.z) > 0 && (!px || Math.hypot(p.x - px.x, p.z - px.z) < 0.05);
      };
      const mark = () => ({ p1: { x: c8.px(1).x, z: c8.px(1).z }, p2: { x: c8.px(2).x, z: c8.px(2).z } });
      c.join = beside("join", G.world.spawn, null);
      r.mateAsk("travel", "E", 99);
      let m = mark();
      c8.arrive("cave");
      const sp = G.world.spawn;
      c.p1Cave = Math.hypot(m.p1.x - sp.x, m.p1.z - sp.z) < 1e-6;
      c.cave = G.zone === "cave" && beside("cave", sp, m.p2);
      r.mateAsk("travel", "hub");
      m = mark();
      c8.arrive("hub");
      const f = DF.portalFront(c8.portal("E"), 3.5);
      c.p1Hall = Math.hypot(m.p1.x - f.x, m.p1.z - f.z) < 0.05;
      c.hall = G.zone === "hub" && beside("hall", f, m.p2);
      return { pass: Object.values(c).every((v) => v === true), c, at };
    },
  },
  {
    name: "a fight with the other player in view, for the screenshot",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      const r = c8.solo({ ping: 100, jit: 8, mate: "fight" });
      DF.devGod(true);
      const he = c8.husk(18);
      c8.mateAt(he, 3.5);
      const m = r.mate.p,
        a = Math.atan2(m.x - he.x, m.z - he.z),
        q = c8.spot(m.x, m.z, a, 5),
        p = G.player;
      p.x = q.x;
      p.z = q.z;
      c8.step(2.4);
      const mm = c8.mate();
      p.yaw = DF.cam.yaw = Math.atan2(mm.x - p.x, mm.z - p.z);
      DF.cam.px = p.x;
      DF.cam.pz = p.z;
      return { pass: !!mm && G.enemies.filter((e) => e.aware).length >= 2, aware: G.enemies.filter((e) => e.aware).length, mate: mm.state };
    },
  },
  { wait: 400, shot: "t28-mate" },
  {
    name: "end the run",
    eval: () => {
      DF.devGod(false);
      DF.coopEnd("test");
      return { pass: DF.net() === null };
    },
  },
];
