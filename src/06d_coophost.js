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
      const S = { px: new Map(), byId: new Map(), step: 0 };
      let acc = 0,
        ph = null; // the placeholder
      const now = () => S.step * COOP.STEP;
      const send = (pid, buf) => {
        if (host.send) host.send(pid, buf);
      };
      const tell = (pid, ev) => send(pid, coopEventEncode(ev));
      const others = (pid, ev) => {
        for (const id of S.px.keys()) if (id !== pid) tell(id, ev);
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
      function enemies(dt) {
        present();
        const p0 = G.player,
          b0 = G.inBoss;
        for (const e of G.enemies) {
          const s0 = e.state,
            tg = pick(e);
          G.player = tg;
          G.inBoss = tg.inBoss;
          enemyUpdate(e, dt);
          // a new swing gets a new number, so a client can tell swings apart
          if (e.state === "wind" && s0 !== "wind") e.an = (e.an + 1) & 255;
        }
        G.player = p0;
        G.inBoss = b0;
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
        S.byId.clear();
        S.step = 0;
        acc = 0;
        // a fresh run spawns every entry of world.spawns, in order
        G.enemies.forEach((e, i) => {
          e.id = i;
          e.an = 0;
          e.pin = 0;
          e.tg = 0;
          S.byId.set(i, e);
        });
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
          onShoot() {},
          onKill() {},
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
        const all = [...S.byId.values()];
        tell(pid, [
          "join",
          {
            v: COOP_V,
            pid,
            seed: G.seed,
            grade: G.grade,
            sum: coopWorldSum(G.world),
            enemies: all.map((e) => [e.id, e.type, r2(e.x), r2(e.z), r2(e.yaw)]),
            dead: all.filter((e) => e.dead || e.gone).map((e) => e.id),
            bossDead: G.bossDead,
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
      // A STATE frame moves its proxy; events wait for later tasks. Anything
      // that does not decode is dropped.
      const recv = (pid, buf) => {
        const px = S.px.get(pid);
        if (!px) return;
        try {
          const k = coopType(buf);
          if (k === COOP.STATE) {
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
          } else if (k === COOP.EVENT) coopEventDecode(buf);
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
