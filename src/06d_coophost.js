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
      // started: the host's own page (pid 1) has sent a state in this run,
      // so its player has pressed Start; it stays set.
      // epoch: raised by one with each world the host builds, from 1. kind:
      // "hub" (the hall) or "cave". n: the players the world was built for,
      // 2 for a cave built with two in the room (a dungeon for two), else 1.
      const S = {
        px: new Map(),
        byId: new Map(),
        step: 0,
        started: false,
        epoch: 0,
        kind: "cave",
        n: 1,
      };
      let acc = 0,
        ph = null, // the placeholder
        armed = true, // a wipe may fire; cleared by one, set again by a living player
        by = 0, // the pid whose proposal is being applied, 0 outside one
        sum = "", // the world's checksum, taken once per build
        // raised by every kill and wipe: a proxy remembers it when its world
        // or join is sent, and gets the enemies again on arrival if it moved
        ver = 0;
      const now = () => S.step * COOP.STEP;
      const send = (pid, buf) => {
        if (host.send) host.send(pid, buf);
      };
      const tell = (pid, ev) => send(pid, coopEventEncode(ev));
      // A proxy that has not answered the world with its at is not there:
      // events about this world's enemies are not sent to it.
      const BOUND = ["shot", "ring", "roar", "kill", "reset", "fed", "held", "freed", "crush"];
      const hears = (px, ev) => px.here || !BOUND.includes(ev[0]);
      const others = (pid, ev) => {
        for (const [id, px] of S.px) if (id !== pid && hears(px, ev)) tell(id, ev);
      };
      const all = (ev) => {
        for (const [id, px] of S.px) if (hears(px, ev)) tell(id, ev);
      };
      const r2 = (v) => Math.round(v * 100) / 100;
      // co-op offers the base classes; anything else plays as the first
      const baseCls = (id) =>
        Object.hasOwn(CLASSES, id) && !CLASSES[id].hidden
          ? id
          : Object.keys(CLASSES).find((k) => !CLASSES[k].hidden);

      // Who an enemy hunts: the nearest proxy that is there, alive and not
      // away, kept unless another is COOP.STICK nearer. 0 is nobody.
      const live = (px) => px && px.here && !px.away && px.state !== "dead";
      function nearest(e) {
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
      // The Warden for two hunts whoever has hurt it most lately (e.heed,
      // below). Both players live in its chamber and one with a score: it
      // keeps its target and turns to the other only on a lead, not within
      // heed.every of its last turn and not in a swing or a hold. Else
      // today's rule.
      function pick(e) {
        if (!e.def.duo) return nearest(e);
        const H = WARDEN2.heed,
          cs = [];
        for (const px of S.px.values()) if (live(px) && px.inBoss) cs.push(px);
        const cur = S.px.get(e.tg);
        if (cs.length === 2 && cs.includes(cur)) {
          const o = cs[0] === cur ? cs[1] : cs[0],
            so = e.heed[o.pid] || 0,
            sc = e.heed[cur.pid] || 0;
          if (so > 0 || sc > 0) {
            if (
              so > 0 &&
              so >= H.lead * sc &&
              now() - e.heedAt >= H.every &&
              e.state !== "wind" &&
              e.state !== "act" &&
              e.state !== "hold"
            ) {
              e.tg = o.pid;
              e.heedAt = now();
            }
            return S.px.get(e.tg);
          }
        }
        return nearest(e);
      }
      // Each tick, before the enemies: who is away, and who is in the boss
      // chamber (in within its radius, out past the pad, as update does).
      // A player whose state has just become "dead" inside the chamber feeds
      // the boss; was is its state at the last tick, so each death counts
      // once.
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
          if (px.state === "dead" && px.was !== "dead" && px.inBoss) feed();
          px.was = px.state;
        }
      }
      // A death in the boss's chamber in a dungeon for two, with the boss
      // alive and awake: it regains COOP_TWO.bossHeal of its full health,
      // never past full, and its phase stays as it is. Both players are told.
      function feed() {
        if (S.n !== 2) return;
        const b = G.enemies.find((e) => e.def.boss && !e.dead);
        if (!b || !b.aware) return;
        b.hp = Math.min(b.def.hp, b.hp + b.def.hp * COOP_TWO.bossHeal);
        all(["fed", b.id, now()]);
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
      // In a dungeon for two a turn is held against one player: a holder
      // whose target has just changed from t0 to a player who already has
      // COOP_TWO.turns other holders gives its turn up. pick and a hit both
      // change targets.
      function retarget(e, t0) {
        if (!NET.two || !e.token || e.def.boss || !t0 || !e.tg || e.tg === t0) return;
        let n = 0;
        for (const o of G.enemies) if (o !== e && o.token && !o.dead && o.tg === e.tg) n++;
        if (n >= COOP_TWO.turns) e.token = false;
      }
      // Every score of a duo boss halves each heed.half seconds; one too
      // small to matter is dropped, so an old hit never turns it.
      function fade(e, dt) {
        const k = 0.5 ** (dt / WARDEN2.heed.half);
        for (const id of Object.keys(e.heed)) {
          if ((e.heed[id] *= k) < 0.01) delete e.heed[id];
        }
      }
      // The Warden for two's hooks (WARDEN2.seize in 06b). Only the host
      // steps a Warden for two, so only the host copy has them, and each
      // does nothing for a Warden without def.duo. Its seize is not chosen
      // while e.seizeT, the seconds until it may seize again, is above 0;
      // the count starts as a seize's wind-up ends, landed or not, and
      // again when its hold ends (letGo). The seize's act has no hit of its
      // own: the page of the player it reaches judges it (ASK.seized).
      EBEH.warden = {
        atkOk: (e, a) => !e.def.duo || a.kind !== "seize" || !(e.seizeT > 0),
        step(e, dt) {
          if (e.def.duo && e.seizeT > 0) e.seizeT = Math.max(0, e.seizeT - dt);
        },
        wind(e) {
          if (e.def.duo && e.atk.kind === "seize") e.seizeT = WARDEN2.seize.again;
        },
      };
      // The end of a hold, however it ended: it holds nobody and may not
      // seize again for seize.again seconds. rec: it goes to its recovery,
      // if it is still in "hold".
      function letGo(e, rec) {
        e.held = 0;
        e.seizeT = WARDEN2.seize.again;
        if (rec && e.state === "hold") {
          e.state = "rec";
          e.t = 0;
        }
      }
      // A hold of the Warden for two, each tick: enemyUpdate has no case
      // for "hold", so it stands while this times it. At seize.hold seconds
      // it crushes. It lets go with nothing sent when anything else has
      // taken it out of "hold" (a roar, a death; the held page then frees
      // itself), or when the held player is dead, away, or no longer
      // "held" once the host has seen them held or half a second has passed
      // (a page's state comes a little after its seized).
      function holding(e, dt) {
        const px = S.px.get(e.held);
        if (e.dead || e.state !== "hold") return letGo(e, false);
        e.t += dt;
        if (px && px.state === "held") e.heldSeen = true;
        if (!px || px.away || px.state === "dead" || (px.state !== "held" && (e.heldSeen || e.t >= 0.5)))
          return letGo(e, true);
        if (e.t >= WARDEN2.seize.hold - 1e-9) {
          all(["crush", e.id, e.held, now()]);
          letGo(e, true);
        }
      }
      function enemies(dt) {
        present();
        for (const e of G.enemies) {
          if (e.def.duo) fade(e, dt);
          const s0 = e.state,
            t0 = e.tg,
            tg = pick(e);
          retarget(e, t0);
          as(tg, () => enemyUpdate(e, dt));
          if (e.held) holding(e, dt);
          // a new swing gets a new number, so a client can tell swings apart
          if (e.state === "wind" && s0 !== "wind") e.an = (e.an + 1) & 255;
          // the slam's warning ring, which a client cannot work out itself
          if (e.state === "act" && s0 !== "act" && e.atk && e.atk.kind === "slam")
            all(["ring", r2(e.tx), r2(e.tz), e.atk.radius, e.atk.act, now()]);
          // a pin lasts as long as the stagger it was given in
          if (e.pin && e.state !== "stagger" && !e.dead) e.pin = 0;
        }
      }
      // Every present player (joined, there and not away) dead: the enemies
      // are made again as a respawn makes them. Once per wipe: it fires again
      // only after a present player has been alive.
      function wipe() {
        let n = 0,
          up = false;
        for (const px of S.px.values())
          if (px.here && !px.away) {
            n++;
            if (px.state !== "dead") up = true;
          }
        if (up) armed = true;
        if (!n || up || !armed) return;
        armed = false;
        spawnEnemies();
        number();
        ver++;
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
          // a duo boss's scores by pid, and when it last turned
          if (e.def.duo) {
            e.heed = {};
            e.heedAt = -Infinity;
          }
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
      // The world as join and world carry it: epoch, kind, grade (null in
      // the hall), seed (0 in the hall), checksum, the players it was built
      // for, the enemies and host time.
      function describe() {
        const hub = S.kind === "hub";
        return {
          e: S.epoch,
          kind: S.kind,
          grade: hub ? null : G.grade,
          seed: hub ? 0 : G.seed,
          sum,
          n: S.n,
          ...roster(),
          t: now(),
        };
      }

      // What a client is sent: every other proxy, and each enemy that is
      // awake, not idle, dying, or within COOP.RANGE of it, kept a second
      // after it stops qualifying. A proxy not there is sent nothing.
      function snap(px) {
        if (!px.here) return;
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

      // Builds a world and takes every proxy there: the hall with
      // enterHub(from, true), in front of from's gate when from is a grade,
      // or a cave with newRun(seed, grade, big). Each proxy arrives where the
      // world put its player (the cave's start, or before the gate), at full
      // health and not yet there: it is sent the world and is heard again
      // once its at for this epoch arrives. Its event numbers start again.
      // won: the run time when the exit gate caused the trip, else null.
      // A cave built with two players in the room (joined, entered or not),
      // or with two set, is a dungeon for two for as long as it lasts: the
      // big cave (for grade E), the scaled definitions and the extra spawns,
      // its enemies made again from them. The hall never is.
      function build(kind, grade, seed, from, won = null, two = false) {
        S.n = kind === "cave" && (two || S.px.size >= 2) ? 2 : 1;
        if (kind === "hub") enterHub(from, true);
        else newRun(seed, grade, S.n === 2);
        S.kind = kind;
        if (S.n === 2) {
          G.edef = coopTwoDefs();
          G.world.spawns.push(...coopExtras(G.world, seed));
          spawnEnemies();
        }
        S.epoch++;
        sum = coopWorldSum(G.world);
        armed = true;
        number();
        // where the world put its player, before that player becomes the
        // placeholder
        const p = G.player,
          ax = p.x,
          az = p.z,
          ayaw = p.yaw;
        ph = p;
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
        for (const px of S.px.values()) {
          // the friend beside the point, as its page puts itself
          const q = coopSpot(G.world, px.pid, ax, az, ayaw, px.r);
          Object.assign(px, {
            here: false,
            heard: -Infinity,
            away: true,
            ack: 0,
            inBoss: false,
            hp: px.maxHp,
            state: "free",
            was: "free",
            t: 0,
            move: null,
            x: q.x,
            z: q.z,
            yaw: ayaw,
            vx: 0,
            vz: 0,
            speed: 0,
            sprint: false,
          });
          px.seen.clear();
        }
        const d = { ...describe(), from: kind === "hub" ? from : null, won };
        for (const px of [...S.px.values()]) {
          px.ver = ver;
          tell(px.pid, ["world", d]);
        }
      }
      // A room's first world: the hall with { hub: true }, else the cave
      // from seed and grade (two: a dungeon for two whoever is in, for tests).
      const start = ({ hub = false, seed, grade = "E", two = false } = {}) => {
        S.px.clear();
        S.step = 0;
        S.started = false;
        S.epoch = 0;
        acc = 0;
        by = 0;
        ver = 0;
        NET = {
          host: true,
          enemies,
          frame() {},
          onHit: () => false,
          onShoot,
          onKill,
          onRespawn() {},
          onGate() {},
          // the host has no player to step into a gate
          onPortal() {},
          onPShot() {},
          onBlast() {},
          taken: () => false,
          // a dungeon for two: takeToken counts each player's attackers
          get two() {
            return S.n === 2;
          },
        };
        if (hub) build("hub", null, 0, null);
        else build("cave", grade, seed, null, null, two);
      };
      const join = (pid, cls) => {
        const id = baseCls(cls),
          px = makePlayer(id),
          w = G.world,
          // where its page will put it: the world's start, the friend beside it
          q = coopSpot(w, pid, w.spawn.x, w.spawn.z, w.spawnYaw, px.r);
        Object.assign(px, {
          x: q.x,
          z: q.z,
          remote: true,
          pid,
          heard: -Infinity, // until its first state: the player has not entered
          away: true,
          inBoss: false,
          ack: 0,
          here: false, // until its at for this epoch
          was: px.state, // its state at the last tick, for the boss's feed
          ver,
          seen: new Map(), // enemy id -> host time it last qualified for this client
        });
        S.px.delete(pid);
        const peers = [...S.px.values()].map((o) => [o.pid, o.clsId]);
        S.px.set(pid, px);
        tell(pid, ["join", { v: COOP_V, pid, started: S.started, peers, ...describe() }]);
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
        ver++;
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
          const flinch = hitFlinches(d, heavy, dot, seenState);
          if (flinch && seenState !== "act" && e.state === "act" && e.an === seenAn)
            e.state = "chase";
          // a hit from a player it can see turns it on them, and a turn
          // held against the other may go with that; the Warden for two
          // goes by its scores instead (pick)
          if (!d.duo && e.tg !== px.pid && G.world.los(e.x, e.z, px.x, px.z)) {
            const t0 = e.tg;
            e.tg = px.pid;
            retarget(e, t0);
          }
          const ph0 = e.phase,
            hp0 = e.hp,
            // an execution that need not kill (the Warden's) comes as a hit:
            // from the player who pinned it, it recoils as in single player
            ex = src === "exec" && e.pin === px.pid;
          if (ex) {
            e.pin = 0;
            e.state = "recoil";
            e.t = 0;
            e.dur = 1.0;
            e.posture = 0;
          }
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
          if (ex && !e.dead && e.state !== "roar") {
            e.state = "recoil";
            e.t = 0;
            e.dur = 1.0;
          }
          // the health it took off, never below 0 (a kill counts what was left)
          const took = Math.max(0, hp0 - Math.max(0, e.hp));
          if (d.duo) e.heed[px.pid] = (e.heed[px.pid] || 0) + took;
          if (d.boss && e.phase > ph0) all(["roar", e.id, now(), e.phase]);
          // a hold is broken by the other player's damage, or by any
          // posture break: staggered for seize.stag, and both are told
          if (e.held && !e.dead && (e.state === "hold" || e.state === "stagger")) {
            if (px.pid !== e.held) e.holdDmg += took;
            if (e.state === "stagger" || e.holdDmg >= WARDEN2.seize.breakAt) {
              const pid = e.held;
              if (e.state !== "stagger") stagger(e);
              e.dur = WARDEN2.seize.stag;
              letGo(e, false);
              all(["freed", e.id, pid, now()]);
            }
          }
        },
        // ["seized", seq, eid, an]: this player's page judged that the
        // Warden for two's seize of swing an landed on it. Taken when it is
        // in that swing of its seize, in the act or no more than seize.late
        // into its recovery, holding nobody, and the player within its
        // reach, their radius and seize.slack; then it holds them and both
        // are told. Anything else is nothing: the page's guess runs out
        // and it frees itself.
        seized(px, [eid, an]) {
          const e = live1(eid),
            W = WARDEN2.seize;
          if (!e || !e.def.duo || !e.atk || e.atk.kind !== "seize" || e.an !== an || e.held) return;
          if (!(e.state === "act" || (e.state === "rec" && e.t <= W.late))) return;
          if (Math.hypot(px.x - e.x, px.z - e.z) > e.atk.reach + px.r + W.slack) return;
          Object.assign(e, { state: "hold", t: 0, held: px.pid, holdDmg: 0, heldSeen: false });
          all(["held", e.id, px.pid, now()]);
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
          if (e.def.dummy) {
            // the dummy takes the execution and stands back up, as in
            // single player
            Object.assign(e, { hp: e.def.hp, posture: 0, pin: 0, state: "idle", t: 0 });
            return;
          }
          e.hp = 0;
          as(px, () => kill(e));
        },
        // the exit gate, once the boss is dead: both players back to the
        // hall, in front of this grade's gate, with the run's time
        gate() {
          if (!G.bossDead || S.kind !== "cave") return;
          build("hub", null, 0, G.grade, G.runT);
        },
        // ["travel", seq, to, seed]: the host's own player (pid 1) takes the
        // party from the hall to a grade's cave from seed, or from a cave
        // back to the hall, in front of that grade's gate
        travel(px, [to, seed]) {
          if (px.pid !== 1) return;
          if (to === "hub") {
            if (S.kind !== "hub") build("hub", null, 0, G.grade);
          } else if (S.kind === "hub" && COOP.GRADES.includes(to) && num(seed))
            build("cave", to, seed, null);
        },
        // ["at", seq, e]: this player is in the world of epoch e. If the
        // enemies have changed since its world or join was sent, it is sent
        // them again.
        at(px, [e]) {
          if (px.here || e !== S.epoch) return;
          px.here = true;
          if (px.ver !== ver) tell(px.pid, ["reset", roster(), now()]);
        },
        pshot(px, a) {
          if (a.length < 8 || !a.slice(0, 8).every(num)) return;
          others(px.pid, ["pshot", px.pid, ...a.slice(0, 8)]);
        },
        pblast(px, a) {
          if (a.length < 6 || !a.slice(0, 6).every(num)) return;
          others(px.pid, ["pblast", px.pid, ...a.slice(0, 6)]);
        },
        // A class picked on the room screen, or changed in the pause menu
        // mid-run: the proxy becomes that class where it stands, with the
        // same share of health, and the other player is told.
        cls(px, [id]) {
          if (typeof id !== "string") return;
          const n = makePlayer(baseCls(id));
          if (n.clsId === px.clsId) return;
          const fr = px.maxHp > 0 ? px.hp / px.maxHp : 1;
          Object.assign(px, {
            cls: n.cls,
            clsId: n.clsId,
            maxHp: n.maxHp,
            hp: n.maxHp * fr,
            maxStam: n.maxStam,
            stam: n.stam,
            tool: n.tool,
            parryWin: n.parryWin,
            fig: n.fig,
          });
          others(px.pid, ["cls", px.pid, px.clsId]);
        },
      };
      // Applies one event from px. Unknown names (including "spawn", which
      // only the host sends) are ignored. A seq must be an integer from 1 to
      // 65535 (a client counts from 1 and never wraps): any other is refused
      // and not acknowledged. A good seq is acknowledged whether or not the
      // event was honoured, unless it swapped the world: the new world's
      // numbers start again from 0. From a player not there (no at for this
      // epoch yet) only an at is heard; anything else is dropped and not
      // acknowledged, so nothing meant for the old world lands in the new. An
      // at for another epoch is not acknowledged either.
      function ask(px, ev) {
        if (!Array.isArray(ev)) return;
        const [name, seq, ...args] = ev;
        if (!Number.isInteger(seq) || seq < 1 || seq > 65535) return;
        if (!px.here && name !== "at") return;
        const b0 = by,
          e0 = S.epoch;
        try {
          if (typeof name === "string" && Object.hasOwn(ASK, name)) {
            by = px.pid;
            ASK[name](px, args);
          }
        } finally {
          by = b0;
          if (S.epoch === e0 && (name !== "at" || args[0] === S.epoch)) px.ack = Math.max(px.ack, seq);
        }
      }

      // From a pid that has not joined only a hello is heard: ["hello", seq,
      // v, cls, build] joins it when v is COOP_V and build is this page's
      // COOP_BUILD (the stamp build.mjs puts on the core sources), and
      // otherwise (a hello with no stamp included) it is told ["no",
      // "version"] and stays out.
      function hello(pid, ev) {
        if (!Array.isArray(ev) || ev[0] !== "hello") return;
        if (ev[2] === COOP_V && ev[4] === COOP_BUILD) join(pid, ev[3]);
        else tell(pid, ["no", "version"]);
      }
      // A STATE frame moves its proxy (not one that is not there); an EVENT
      // is a request. Anything that does not decode is dropped.
      const recv = (pid, buf) => {
        const px = S.px.get(pid);
        try {
          const k = coopType(buf);
          if (!px) {
            if (k === COOP.EVENT) hello(pid, coopEventDecode(buf));
          } else if (k === COOP.STATE) {
            if (!px.here) return;
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
            // the host's page has started: a friend waiting to enter is told
            if (pid === 1 && !S.started) {
              S.started = true;
              others(1, ["started"]);
            }
          } else if (k === COOP.EVENT) ask(px, coopEventDecode(buf));
        } catch (e) {
          /* a malformed frame is ignored */
        }
      };
      const tick = (dt) => {
        if (!S.px.size) return;
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
      // The Worker driver: the host as it runs in a Worker in the host's page.
      // scope is the Worker's global (or a stand-in in a test); only this
      // reads WebSocket, setInterval and performance, from scope or else the
      // global. The page posts { start: { hub: true, relay, code } } once (a
      // room starts in the hall; { seed, grade } in place of hub starts in
      // that cave), then this player's frames as ArrayBuffers (pid 1), and
      // { stop: true } when co-op ends there. Frames for pid 1 go back by postMessage; pid
      // 2 is the friend, through the relay socket opened as the room's host:
      // its frames arrive with its pid byte in front and go out with it. The
      // relay's own frames (first byte 0) are read here and never reach recv.
      // The page is told { relay: "open" | "error" | "closed" } as the socket
      // changes; when it closes the run goes on for the page alone. Only stop
      // closes the socket and stops the timer: the room outlives a run.
      function worker(scope) {
        const glob = typeof globalThis !== "undefined" ? globalThis : {},
          WS = scope.WebSocket || glob.WebSocket,
          every = scope.setInterval ? scope.setInterval.bind(scope) : glob.setInterval,
          stopEvery = scope.clearInterval ? scope.clearInterval.bind(scope) : glob.clearInterval,
          perf = scope.performance || glob.performance;
        let ws = null,
          timer = null,
          last = 0,
          friend = false, // the relay has said pid 2 is in the room
          done = false;
        const post = (m, tr) => {
          try {
            scope.postMessage(m, tr);
          } catch (e) {
            /* the page is gone */
          }
        };
        host.send = (pid, buf) => {
          if (done) return;
          if (pid === 1) return post(buf, [buf]);
          if (pid !== 2 || !friend || !ws || ws.readyState !== 1) return;
          // after a stall the socket's queue is not added to, but for events
          if (ws.bufferedAmount > COOP.SOCK_FULL && coopType(buf) !== COOP.EVENT) return;
          const out = new Uint8Array(buf.byteLength + 1);
          out[0] = 2;
          out.set(new Uint8Array(buf), 1);
          try {
            ws.send(out.buffer);
          } catch (e) {
            /* closing */
          }
        };
        const shut = () => {
          if (ws) {
            const w = ws;
            ws = null;
            w.onclose = w.onmessage = w.onerror = null;
            try {
              w.close(1000);
            } catch (e) {
              /* already closed */
            }
          }
          if (timer !== null) stopEvery(timer);
          timer = null;
        };
        // A relay frame: a notice, or the friend's frame behind its pid byte.
        const fromRelay = (data) => {
          if (!(data instanceof ArrayBuffer) || data.byteLength < 1) return;
          const b = new Uint8Array(data);
          if (b[0] === 0) {
            if (b[1] === 1 && b[2] === 2) friend = true;
            else if (b[1] === 2 && b[2] === 2) {
              friend = false;
              leave(2);
            }
          } else if (b[0] === 2 && b.length > 1 && friend) recv(2, data.slice(1));
        };
        const open = (url) => {
          try {
            ws = new WS(url);
          } catch (e) {
            ws = null;
            post({ relay: "error" });
            post({ relay: "closed" });
            return;
          }
          ws.binaryType = "arraybuffer";
          ws.onopen = () => post({ relay: "open" });
          ws.onmessage = (ev) => fromRelay(ev.data);
          ws.onerror = () => post({ relay: "error" });
          ws.onclose = () => {
            ws = null;
            if (friend) leave(2);
            friend = false;
            post({ relay: "closed" });
          };
        };
        // Real elapsed time, never more than COOP.TICK_MAX a call: a Worker
        // that stalls loses the time rather than sending a backlog.
        const step = () => {
          const t = perf.now(),
            dt = (t - last) / 1000;
          last = t;
          if (dt > 0) tick(Math.min(dt, COOP.TICK_MAX));
        };
        scope.onmessage = (ev) => {
          const d = ev.data;
          if (done) return;
          if (d instanceof ArrayBuffer) recv(1, d);
          else if (d && d.start && timer === null) {
            const o = d.start;
            start(o.hub ? { hub: true } : { seed: o.seed, grade: o.grade || "E" });
            last = perf.now();
            timer = every(step, 1000 / 60);
            if (o.relay && o.code) open(String(o.relay).replace(/\/+$/, "") + "/room/" + o.code);
          } else if (d && d.stop) {
            leave(1);
            shut();
            done = true;
            post({ stopped: true });
          }
        };
      }
      // For tests and the dev menu: the living Warden for two put at the
      // start of phase n (2 to 4), as a hit from nobody that takes it from
      // just above that mark to just under it does, roar and events
      // included. Returns the enemy, or null when there is no such Warden or
      // it is already in phase n or later (a phase never falls).
      function phase(n) {
        const e = G.enemies.find((o) => o.def.duo && !o.dead),
          m = e && e.def.marks[n - 2];
        if (!m || e.phase >= n) return null;
        const ph0 = e.phase;
        e.hp = e.def.hp * m + 1;
        as(ph, () => hitEnemy(e, 2, 0, { src: "", pre: true }));
        if (e.phase > ph0) all(["roar", e.id, now(), e.phase]);
        return e;
      }
      const host = {
        v: COOP_V,
        build: COOP_BUILD,
        start,
        join,
        leave,
        recv,
        tick,
        phase,
        // for tests: an enemy's draw of its next attack at dist metres
        chooseAtk,
        send: null,
        G,
        S,
        // for tests: the host's NET, and the definitions it never changes
        get NET() {
          return NET;
        },
        EDEF,
        worker,
        sum: coopWorldSum,
        // for tests: the hall or a cave's own world as either kind of page
        // builds it, and a save
        genHub,
        genWorld,
        clearGrade,
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
