// Co-op: the host. It exists only in the host copy of the simulation (see
// COOP_HEADLESS in build.mjs); in the page it is null.
//
// The host owns every enemy and has no player of its own. Each connected
// player is a proxy: a player from makePlayer, flagged remote, never stepped,
// only moved to where its own machine last said it was. G.player is a
// placeholder, dead and far outside the cave, so code that reads it outside an
// enemy's step finds nobody. For each enemy's step G.player and G.inBoss are
// pointed at that enemy's target and put back after.
const COOP_HOST = COOP_HEADLESS_HERE
  ? (() => {
      // px: proxies by pid. byId: enemies by id (the index in world.spawns).
      // step: host steps since start; host time is step * COOP.STEP.
      // ended: the run is over (a player took the gate); nothing more happens.
      const S = { px: new Map(), byId: new Map(), step: 0, ended: false };
      let acc = 0,
        ph = null, // the placeholder
        armed = true, // a wipe may fire; cleared by one, set again by a living player
        by = 0; // the pid whose proposal is being applied, 0 outside one
      const now = () => S.step * COOP.STEP;
      const send = (pid, buf) => {
        if (host.send) host.send(pid, buf);
      };
      const tell = (pid, ev) => send(pid, coopEventEncode(ev));
      const others = (pid, ev) => {
        for (const id of S.px.keys()) if (id !== pid) tell(id, ev);
      };
      const all = (ev) => {
        for (const id of S.px.keys()) tell(id, ev);
      };
      const r2 = (v) => Math.round(v * 100) / 100;
      // co-op offers the base classes; anything else plays as the first
      const baseCls = (id) =>
        Object.hasOwn(CLASSES, id) && !CLASSES[id].hidden
          ? id
          : Object.keys(CLASSES).find((k) => !CLASSES[k].hidden);

      // Who an enemy hunts: the nearest proxy that is there, alive and not
      // away, kept unless another is COOP.STICK nearer. 0 is nobody.
      const live = (px) => px && !px.away && px.state !== "dead";
      function pick(e) {
        const cur = S.px.get(e.tg);
        let best = null,
          bd = Infinity;
        for (const px of S.px.values()) {
          if (!live(px)) continue;
          const d = Math.hypot(px.x - e.x, px.z - e.z);
          if (d < bd) {
            bd = d;
            best = px;
          }
        }
        if (best && live(cur) && cur !== best) {
          const dc = Math.hypot(cur.x - e.x, cur.z - e.z);
          if (!(bd < dc - COOP.STICK)) best = cur;
        }
        e.tg = best ? best.pid : 0;
        return best || ph;
      }
      // Each tick, before the enemies: who is away, and who is in the boss
      // chamber (in within its radius, out past the pad, as update does).
      function present() {
        const t = now(),
          bc = G.world.boss;
        for (const px of S.px.values()) {
          px.away = t - px.heard > COOP.AWAY;
          if (!bc) px.inBoss = false;
          else {
            const d = Math.hypot(px.x - bc.x, px.z - bc.z);
            if (d < bc.r) px.inBoss = true;
            else if (d > bc.r + PURSUIT.bossPad) px.inBoss = false;
          }
        }
      }
      // Runs fn with G.player and G.inBoss pointed at px, and puts them back.
      function as(px, fn) {
        const p0 = G.player,
          b0 = G.inBoss;
        G.player = px;
        G.inBoss = px.inBoss;
        try {
          fn();
        } finally {
          G.player = p0;
          G.inBoss = b0;
        }
      }
      function enemies(dt) {
        present();
        for (const e of G.enemies) {
          const s0 = e.state,
            tg = pick(e);
          as(tg, () => enemyUpdate(e, dt));
          // a new swing gets a new number, so a client can tell swings apart
          if (e.state === "wind" && s0 !== "wind") e.an = (e.an + 1) & 255;
          // the slam's warning ring, which a client cannot work out itself
          if (e.state === "act" && s0 !== "act" && e.atk && e.atk.kind === "slam")
            all(["ring", r2(e.tx), r2(e.tz), e.atk.radius, e.atk.act, now()]);
          // a pin lasts as long as the stagger it was given in
          if (e.pin && e.state !== "stagger" && !e.dead) e.pin = 0;
        }
      }
      // Every present player (joined and not away) dead: the enemies are
      // made again as a respawn makes them. Once per wipe: it fires again
      // only after a present player has been alive.
      function wipe() {
        let n = 0,
          up = false;
        for (const px of S.px.values())
          if (!px.away) {
            n++;
            if (px.state !== "dead") up = true;
          }
        if (up) armed = true;
        if (!n || up || !armed) return;
        armed = false;
        spawnEnemies();
        number();
        all(["reset", roster(), now()]);
      }
      // Ids are spawn indices. spawnEnemies makes one enemy per spawn, in
      // order, leaving out a boss once it is dead, so the same walk finds
      // each enemy's spawn.
      function number() {
        S.byId.clear();
        let k = 0;
        G.world.spawns.forEach((s, i) => {
          if (G.bossDead && EDEF[s.type] && EDEF[s.type].boss) return;
          const e = G.enemies[k++];
          e.id = i;
          e.an = 0;
          e.pin = 0;
          e.tg = 0;
          S.byId.set(i, e);
        });
      }
      // The enemies as the join and reset events carry them.
      function roster() {
        const list = [...S.byId.values()];
        return {
          enemies: list.map((e) => [e.id, e.type, r2(e.x), r2(e.z), r2(e.yaw)]),
          dead: list.filter((e) => e.dead || e.gone).map((e) => e.id),
          bossDead: G.bossDead,
        };
      }

      // What a client is sent: every other proxy, and each enemy that is
      // awake, not idle, dying, or within COOP.RANGE of it, kept a second
      // after it stops qualifying.
      function snap(px) {
        const t = now(),
          players = [],
          list = [];
        for (const o of S.px.values()) if (o !== px) players.push(o);
        for (const e of G.enemies) {
          if (
            e.aware ||
            e.state !== "idle" ||
            e.dead ||
            Math.hypot(e.x - px.x, e.z - px.z) < COOP.RANGE
          )
            px.seen.set(e.id, t);
          const s = px.seen.get(e.id);
          if (s !== undefined && t - s <= 1) list.push(e);
        }
        send(px.pid, coopSnapEncode(t, px.ack, players, list));
      }

      const start = ({ seed, grade }) => {
        newRun(seed, grade);
        S.px.clear();
        S.step = 0;
        S.ended = false;
        acc = 0;
        armed = true;
        by = 0;
        number();
        ph = G.player;
        // off the field's grid, where resolve leaves it alone
        Object.assign(ph, {
          remote: true,
          state: "dead",
          hp: 0,
          x: -1e4,
          z: -1e4,
          pid: 0,
          inBoss: false,
        });
        NET = {
          host: true,
          enemies,
          frame() {},
          onHit: () => false,
          onShoot,
          onKill,
          onRespawn() {},
          onGate() {},
          onPShot() {},
          onBlast() {},
          taken: () => false,
        };
      };
      const join = (pid, cls) => {
        const id = baseCls(cls),
          px = makePlayer(id);
        Object.assign(px, {
          remote: true,
          pid,
          heard: -Infinity,
          away: true,
          inBoss: false,
          ack: 0,
          seen: new Map(), // enemy id -> host time it last qualified for this client
        });
        S.px.delete(pid);
        const peers = [...S.px.values()].map((o) => [o.pid, o.clsId]);
        S.px.set(pid, px);
        tell(pid, [
          "join",
          {
            v: COOP_V,
            pid,
            seed: G.seed,
            grade: G.grade,
            sum: coopWorldSum(G.world),
            ...roster(),
            peers,
            t: now(),
          },
        ]);
        others(pid, ["peer", pid, id]);
      };
      const leave = (pid) => {
        if (!S.px.delete(pid)) return;
        others(pid, ["peer", pid, null]);
      };
      // An enemy shot: each client flies its own copy.
      function onShoot(pr) {
        all([
          "shot", pr.src ? pr.src.id : -1, r2(pr.x), r2(pr.y), r2(pr.z),
          r2(pr.vx), r2(pr.vz), pr.dmg, now(),
        ]);
      }
      // Every death is announced once, with whose proposal caused it.
      function onKill(e) {
        if (e.kSent) return;
        e.kSent = true;
        e.kBy = by;
        all(["kill", e.id, by, now()]);
      }

      // What a client may ask. Each handler gets the proxy and the event's
      // arguments after its seq; anything of the wrong shape is ignored.
      const num = (v) => typeof v === "number" && Number.isFinite(v);
      const live1 = (eid) => {
        const e = num(eid) ? S.byId.get(eid) : undefined;
        return e && !e.dead ? e : null;
      };
      const ASK = {
        hit(px, [eid, dmg, post, flags, src, fx, fz, seenState, seenAn]) {
          const e = live1(eid);
          if (!e || !num(dmg) || dmg < 0 || dmg > COOP.MAX_DMG) return;
          if (!num(post) || post < 0) return;
          const fl = num(flags) ? flags : 0,
            heavy = !!(fl & 1),
            dot = !!(fl & 2),
            d = e.def;
          // Favour the attacker: the client saw the enemy before this swing
          // and its hit would flinch it, so the flinch stands here too.
          const flinch =
            !dot && (d.poise === 0 || (d.poise === 1 && heavy && seenState !== "wind"));
          if (flinch && seenState !== "act" && e.state === "act" && e.an === seenAn)
            e.state = "chase";
          // a hit from a player it can see turns it on them
          if (e.tg !== px.pid && G.world.los(e.x, e.z, px.x, px.z)) e.tg = px.pid;
          const ph0 = e.phase;
          as(px, () =>
            hitEnemy(e, dmg, post, {
              src: typeof src === "string" ? src : "",
              heavy,
              dot,
              fx: num(fx) ? fx : undefined,
              fz: num(fz) ? fz : undefined,
              pre: true,
            }),
          );
          if (d.boss && ph0 !== 2 && e.phase === 2) all(["roar", e.id, now()]);
        },
        // as hurtPlayer's parry branch does to the enemy; one staggered or
        // roaring on the host has nothing to be thrown out of
        parry(px, [eid, , pp]) {
          const e = live1(eid);
          if (!e || !num(pp) || pp < 0 || e.state === "stagger" || e.state === "roar") return;
          e.posture += pp;
          e.postT = 0;
          if (e.posture >= e.def.posture) as(px, () => stagger(e));
          else {
            e.state = "recoil";
            e.t = 0;
            e.dur = e.def.boss ? 0.55 : 1.0;
            e.token = false;
            e.y = 0;
          }
        },
        // an execution begun: the first to ask keeps it open
        pin(px, [eid]) {
          const e = live1(eid);
          if (!e || e.state !== "stagger" || e.pin) return;
          e.pin = px.pid;
          e.dur = Math.max(e.dur, e.t + 1.5);
        },
        exec(px, [eid]) {
          const e = live1(eid);
          if (!e || e.pin !== px.pid) return;
          e.hp = 0;
          as(px, () => kill(e));
        },
        gate() {
          if (!G.bossDead) return;
          all(["end", G.runT]);
          S.ended = true;
        },
        pshot(px, a) {
          if (a.length < 8 || !a.slice(0, 8).every(num)) return;
          others(px.pid, ["pshot", px.pid, ...a.slice(0, 8)]);
        },
        pblast(px, a) {
          if (a.length < 6 || !a.slice(0, 6).every(num)) return;
          others(px.pid, ["pblast", px.pid, ...a.slice(0, 6)]);
        },
      };
      // Applies one event from px. Unknown names (including "spawn", which
      // only the host sends) are ignored. A numeric seq is acknowledged
      // whether or not the event was honoured.
      function ask(px, ev) {
        if (!Array.isArray(ev)) return;
        const [name, seq, ...args] = ev;
        try {
          if (typeof name === "string" && Object.hasOwn(ASK, name)) {
            by = px.pid;
            ASK[name](px, args);
          }
        } finally {
          by = 0;
          if (num(seq)) px.ack = Math.max(px.ack, seq);
        }
      }

      // From a pid that has not joined only a hello is heard: ["hello", seq,
      // v, cls] joins it when v is this build's COOP_V, and otherwise it is
      // told ["no", "version"] and stays out.
      function hello(pid, ev) {
        if (!Array.isArray(ev) || ev[0] !== "hello") return;
        if (ev[2] === COOP_V) join(pid, ev[3]);
        else tell(pid, ["no", "version"]);
      }
      // A STATE frame moves its proxy; an EVENT is a request. Anything that
      // does not decode is dropped. After the run has ended nothing is heard.
      const recv = (pid, buf) => {
        const px = S.px.get(pid);
        if (S.ended) return;
        try {
          const k = coopType(buf);
          if (!px) {
            if (k === COOP.EVENT) hello(pid, coopEventDecode(buf));
          } else if (k === COOP.STATE) {
            const s = coopStateDecode(buf);
            px.x = s.x;
            px.z = s.z;
            px.yaw = s.yaw;
            px.vx = s.vx;
            px.vz = s.vz;
            px.state = s.state;
            px.t = s.tt;
            px.move = s.move;
            px.hp = s.hp * px.maxHp;
            px.speed = s.speed;
            px.guardT = s.guardT;
            px.sprint = s.sprint;
            px.heard = now();
          } else if (k === COOP.EVENT) ask(px, coopEventDecode(buf));
        } catch (e) {
          /* a malformed frame is ignored */
        }
      };
      const tick = (dt) => {
        if (!S.px.size || S.ended) return;
        acc = Math.min(acc + dt, 0.25);
        while (acc >= COOP.STEP) {
          acc -= COOP.STEP;
          // the host has no screens: its world never pauses or ends
          G.state = "play";
          update(COOP.STEP);
          wipe();
          G.msgs.length = 0;
          S.step++;
          if (S.step % COOP.SNAP_EVERY === 0) for (const px of S.px.values()) snap(px);
        }
      };
      const none = () => {};
      const host = {
        start,
        join,
        leave,
        recv,
        tick,
        send: null,
        G,
        S,
        worker: none,
        sum: coopWorldSum,
        wire: {
          type: coopType,
          snapEncode: coopSnapEncode,
          snapDecode: coopSnapDecode,
          stateEncode: coopStateEncode,
          stateDecode: coopStateDecode,
          eventEncode: coopEventEncode,
          eventDecode: coopEventDecode,
          fakePair: coopFakePair,
          moves: COOP_MOVES,
          ps: COOP_PS,
          es: COOP_ES,
        },
      };
      return host;
    })()
  : null;
