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
      return {
        pass: he.dead && he.kBy === 2 && pe.dead && flash > 0 && quiet > 0 && loud === 0 && arcs > 0 && swung && G.kills === 0 && DF.CC.seq === 0,
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
    name: "both dead resets the enemies, keeps the kills and the mate, and brings me back",
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
      c8.die();
      c8.step(3, () => (resets ? false : undefined));
      c8.step(0.5);
      const p = G.player,
        cp = G.checkpoint,
        h = r.host;
      return {
        pass:
          resets === 1 &&
          kills === 1 &&
          G.kills === 1 &&
          G.runT >= runT &&
          G.bossDead === boss &&
          G.enemies.length === 47 &&
          G.enemies.filter((e) => !e.dead).length === 47 &&
          h.G.enemies.filter((e) => !e.dead).length === 47 &&
          G.enemies.every((e) => DF.CC.byId.get(e.id) === e) &&
          DF.CC.pend.length === 0 &&
          p.state !== "dead" &&
          Math.hypot(p.x - cp.x, p.z - cp.z) < 3 &&
          G.state === "dead" &&
          DF.net().mates.length === 1 &&
          r.mate.p.state === "free",
        resets,
        kills: [kills, G.kills],
        alive: G.enemies.filter((e) => !e.dead).length,
        hostAlive: h.G.enemies.filter((e) => !e.dead).length,
        me: p.state,
        screen: G.state,
        mate: r.mate.p.state,
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
      const d0 = Math.hypot(he.x - G.player.x, he.z - G.player.z);
      c8.step(4);
      const away = m.away,
        tg1 = he.tg,
        d1 = Math.hypot(he.x - G.player.x, he.z - G.player.z),
        faded = await look();
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
          d1 < d0 - 1 &&
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
            h.recv(9, h.wire.eventEncode(["hello", 0, h.v, "fighter"]));
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
    name: "the gate ends the run for both, sent once",
    eval: () => {
      const { G } = DF,
        c8 = window.__c8;
      G.manual = true;
      let end = null;
      const r = c8.solo({
        ping: 200,
        mate: "idle",
        tamper: (ev) => {
          if (ev[0] === "end") end = ev;
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
      c8.step(1.5, () => (G.state === "win" ? false : undefined));
      h.recv = recv;
      return {
        pass: open && gates === 1 && G.state === "win" && !!end && G.runT === end[1] && DF.net() === null && DF.CC.why === "end" && r.mate.ended === true,
        open,
        gates,
        state: G.state,
        runT: [G.runT, end && end[1]],
        why: DF.CC.why,
        mateEnded: r.mate.ended,
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
        vb = document.getElementById("vitals").querySelector(".bar.fo").getBoundingClientRect(),
        mb = document.getElementById("mateBar").getBoundingClientRect(),
        under = mb.top >= vb.bottom && mb.height > 0 && mb.height <= 8;
      r.mate.leave();
      c8.step(0.5);
      const left = DF.net().mates.length === 0;
      await c8.frames();
      const barGone = !c8.shown("mateBar");
      // malformed peer events change nothing; a good one adds the mate
      for (const ev of [["peer"], ["peer", "x", "mage"], ["peer", 2, 7], ["reset", 5, 0], ["end", "soon"], ["pshot", 2, "a"], ["pblast", 2, 1, 1, -1, 1, 1, 1]])
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
