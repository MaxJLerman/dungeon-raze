// ---------- HUD ----------
const $ = (id) => document.getElementById(id);
const HUD = (() => {
  let el = null,
    ebars = [],
    plabels = [],
    hpLag = 100,
    mapT = 0,
    lastMsg = "";
  function init() {
    el = {
      hp: $("hpF"),
      hpL: $("hpL"),
      st: $("stF"),
      fo: $("foF"),
      flasks: $("flasks"),
      knives: $("knives"),
      blink: $("blinkR"),
      boss: $("boss"),
      bn: $("bossNm"),
      bh: $("bhF"),
      bp: $("bpF"),
      ret: $("ret"),
      prompt: $("prompt"),
      msgs: $("msgs"),
      map: $("map"),
      vigR: $("vigR"),
      vigW: $("vigW"),
      stBar: $("stBar"),
      cross: $("cross"),
      hint: $("hint"),
      fade: $("fade"),
      plaque: $("plaque"),
      plTitle: $("plaqueTitle"),
      plBody: $("plaqueBody"),
      plMarks: $("plaqueMarks"),
      plClose: $("plaqueClose"),
    };
    const host = $("ebars");
    for (let i = 0; i < 10; i++) {
      const d = document.createElement("div");
      d.className = "eb";
      d.innerHTML = '<span class="tag"></span><i></i><b></b>';
      host.appendChild(d);
      ebars.push({
        d,
        nm: d.firstChild,
        hp: d.children[1],
        po: d.lastChild,
        name: "",
        tier: -1,
      });
    }
    const ph = $("plabels");
    for (let i = 0; i < GRADE_IDS.length; i++) {
      const d = document.createElement("div");
      d.className = "pl";
      ph.appendChild(d);
      plabels.push({ d, text: "" });
    }
  }
  function pips(n, max, ch) {
    let s = "";
    for (let i = 0; i < max; i++)
      s += '<u class="' + (i < n ? "on" : "") + '">' + ch + "</u>";
    return s;
  }
  // True when the player is looking at an enemy: it is near the middle of the
  // screen with nothing solid between them. s is the screen point above its
  // head. The zone is a tall box because the camera rests above the player
  // looking down, which puts an enemy straight ahead above the screen centre.
  // The box grows with the enemy's size on screen. This only reads.
  function looked(e, s) {
    const m = R.toScreen(e.x, e.y + e.def.top * 0.55, e.z);
    if (!m) return false;
    const W = canvas.clientWidth,
      H = canvas.clientHeight,
      hh = Math.abs(m[1] - s[1]);
    if (Math.abs(m[0] - W / 2) > 0.1 * H + 0.5 * hh) return false;
    if (Math.abs(m[1] - H / 2) > 0.28 * H + hh) return false;
    return G.world.los(G.player.x, G.player.z, e.x, e.z);
  }
  function update(dt) {
    const p = G.player;
    if (!p) return;
    coopHud();
    hpLag = p.hp > hpLag ? p.hp : damp(hpLag, p.hp, 3, dt);
    el.hp.style.width = sat(p.hp / p.maxHp) * 100 + "%";
    el.hpL.style.width = sat(hpLag / p.maxHp) * 100 + "%";
    el.st.style.width = sat(p.stam / p.maxStam) * 100 + "%";
    el.stBar.classList.toggle("out", p.stam <= 0);
    el.fo.style.width = sat(p.focus / 100) * 100 + "%";
    el.fo.classList.toggle("ready", p.focus >= p.cls.special.cost);
    if (el.hintCls !== p.clsId) {
      el.hintCls = p.clsId;
      hint();
    }
    const cl = p.cls,
      it = p.flasks + "|" + p.tool + p.clsId;
    if (it !== el.items) {
      el.items = it;
      el.flasks.innerHTML = pips(p.flasks, 3, "◆");
      el.knives.innerHTML = pips(p.tool, cl.tool.max, cl.tool.ch);
    }
    const bt = p.buff
      ? p.buff.toUpperCase() + " " + Math.ceil(p.buffT) + "s"
      : p.focus >= cl.special.cost
        ? cl.special.name.toUpperCase() + " READY"
        : "";
    if (bt !== el.bt) {
      el.bt = bt;
      el.blink.textContent = bt;
    }
    el.cross.style.display =
      cl.ranged && !p.lock && G.state === "play" ? "block" : "none";
    // boss bar
    let boss = null;
    for (const e of G.enemies) if (e.def.boss && !e.dead && e.aware) boss = e;
    el.boss.classList.toggle("show", !!boss);
    if (boss) {
      if (el.bossE !== boss) {
        el.bossE = boss;
        el.bn.textContent = boss.def.name;
        el.bn.className = "tag t" + threatOf(boss);
        // a notch at each of its phase marks, none for a boss without them
        const bar = el.bh.parentNode;
        for (const n of bar.querySelectorAll(".mk")) n.remove();
        for (const m of boss.def.marks || []) {
          const n = document.createElement("span");
          n.className = "mk";
          n.style.left = m * 100 + "%";
          bar.appendChild(n);
        }
      }
      el.bh.style.width = sat(boss.hp / boss.def.hp) * 100 + "%";
      el.bp.style.width = sat(boss.posture / boss.def.posture) * 100 + "%";
    }
    // lock reticle
    const L =
      p.lock && !p.lock.dead
        ? R.toScreen(p.lock.x, p.lock.def.top * 0.55 + p.lock.y, p.lock.z)
        : null;
    if (L) {
      el.ret.style.display = "block";
      el.ret.style.transform =
        "translate(" +
        L[0].toFixed(1) +
        "px," +
        L[1].toFixed(1) +
        "px) rotate(45deg)";
    } else el.ret.style.display = "none";
    // enemy names and bars: a name tag over a health and posture bar. A boss
    // on the big bar gets no slot, because that bar shows its name. One that
    // has not noticed the player yet gets the tag alone.
    let n = 0;
    const slot = (e) => {
      if (n >= ebars.length || e.dead || !e.vis || e === boss) return;
      if (Math.hypot(e.x - p.x, e.z - p.z) > 26) return;
      const s = R.toScreen(e.x, e.def.top + 0.25, e.z);
      if (!s) return;
      // shown once it has noticed the player or been hurt, or when looked at
      if (!e.aware && e.hp >= e.def.hp && !looked(e, s)) return;
      const b = ebars[n++],
        tier = threatOf(e);
      if (b.name !== e.def.name) {
        b.name = e.def.name;
        b.nm.textContent = b.name;
      }
      if (b.tier !== tier) {
        b.tier = tier;
        b.nm.className = "tag t" + tier;
      }
      b.d.style.display = "block";
      b.d.style.transform =
        "translate(" + (s[0] - 32).toFixed(1) + "px," + s[1].toFixed(1) + "px)";
      b.hp.style.width = sat(e.hp / e.def.hp) * 100 + "%";
      b.po.style.width = sat(e.posture / e.def.posture) * 100 + "%";
      b.d.classList.toggle("stag", e.state === "stagger");
      b.d.classList.toggle("nobar", !!e.def.boss);
    };
    // the locked target goes first so a full pool never drops it
    const lk = p.lock && !p.lock.dead ? p.lock : null;
    if (lk) slot(lk);
    for (const e of G.enemies) if (e !== lk) slot(e);
    for (let i = n; i < ebars.length; i++) ebars[i].d.style.display = "none";
    // prompt
    const ex =
      p.state !== "dead" && p.state !== "execute" ? nearestStaggered() : null;
    let pr = "";
    // only while struggling works (the Warden for two's hold: not while the
    // other player can break it)
    if (p.state === "held") {
      if (p.hold && holdMash(p.hold))
        pr = "<kbd>" + (PAD.active ? actKey("dodge") : TOUCH.on ? "DODGE" : keyName(BIND.dodge)) + "</kbd> Break free";
    } else if (ex) pr = "<kbd>" + (PAD.active ? actKey("light") : TOUCH.on ? "ATTACK" : keyName(BIND.light)) + "</kbd> Execute";
    else if (p.state === "free" && plaqueAt())
      pr = "<kbd>" + (PAD.active ? actKey("interact") : TOUCH.on ? "TAP" : keyName(BIND.interact)) + "</kbd> Inspect";
    if (el.pr !== pr) {
      el.pr = pr;
      el.prompt.innerHTML = pr;
      el.prompt.style.display = pr ? "block" : "none";
    }
    plaqueCard();
    // messages
    for (const m of G.msgs) m.t -= dt;
    G.msgs = G.msgs.filter((m) => m.t > 0);
    const key = G.msgs.map((m) => m.text).join("|");
    if (key !== lastMsg) {
      lastMsg = key;
      el.msgs.innerHTML = G.msgs
        .map((m) => '<div class="m ' + m.cls + '">' + m.text + "</div>")
        .join("");
    }
    G.flashRed = Math.max(0, G.flashRed - dt * 1.6);
    G.flashWhite = Math.max(0, G.flashWhite - dt * 4);
    const low =
      p.hp < 30 && p.state !== "dead" ? 0.25 + 0.1 * Math.sin(G.t * 6) : 0;
    el.vigR.style.opacity = Math.max(G.flashRed, low).toFixed(2);
    el.vigW.style.opacity = (G.flashWhite * 0.35).toFixed(2);
    // only while playing: a menu opened mid-transition must not be blacked out
    el.fade.style.opacity = (G.state === "play" ? G.fade : 0).toFixed(2);
    // the hall has nothing to explore, so it has no minimap
    const hub = G.zone === "hub";
    el.map.style.display = hub ? "none" : "";
    mapT -= dt;
    if (mapT <= 0 && !hub) {
      mapT = 0.1;
      drawMap();
    }
    // a name above each portal frame that is near and in view
    const ps = hub ? G.world.portals : [];
    for (let i = 0; i < plabels.length; i++) {
      const q = ps[i],
        b = plabels[i];
      let s = null;
      if (q && Math.hypot(q.x - p.x, q.z - p.z) < 16) {
        s = R.toScreen(q.x, 4.3, q.z);
        // toScreen only rejects points behind the camera
        if (
          s &&
          (s[0] < 0 ||
            s[1] < 0 ||
            s[0] > canvas.clientWidth ||
            s[1] > canvas.clientHeight)
        )
          s = null;
      }
      if (!s) {
        b.d.style.display = "none";
        continue;
      }
      const text = GRADES[q.grade].name + (q.open ? "" : " · Sealed");
      if (b.text !== text) {
        b.text = text;
        b.d.textContent = text;
        b.d.classList.toggle("sealed", !q.open);
      }
      b.d.style.display = "block";
      b.d.style.transform =
        "translate(" +
        s[0].toFixed(1) +
        "px," +
        s[1].toFixed(1) +
        "px) translate(-50%,-100%)";
    }
  }
  // The sewer's water as the map shows it: every other grid point of every
  // body of water, in a room or tunnel the player has seen. Each point is tied
  // once to its room (inside the room's box) or else to the nearest tunnel,
  // and worlds without bodies of water give nothing.
  const mapPts = new WeakMap();
  function mapWater(w) {
    if (!w.bodies || !w.bodies.length) return [];
    let pts = mapPts.get(w);
    if (!pts) {
      pts = [];
      for (let j = 0; j <= w.H; j += 2)
        for (let i = 0; i <= w.W; i += 2) {
          const x = i + w.minX,
            z = j + w.minZ;
          if (w.bodyAt(x, z) < 0) continue;
          let node = -1,
            edge = -1;
          for (const n of w.nodes) {
            const inside =
              n.kind === "boss"
                ? Math.hypot(x - n.x, z - n.z) < n.r
                : Math.abs(x - n.x) <= n.hw && Math.abs(z - n.z) <= n.hd;
            if (inside) {
              node = n.id;
              break;
            }
          }
          if (node < 0) {
            let best = 36;
            w.edges.forEach((e, ei) => {
              for (const q of e.pts) {
                const d = (q.x - x) * (q.x - x) + (q.z - z) * (q.z - z);
                if (d < best) {
                  best = d;
                  edge = ei;
                }
              }
            });
            if (edge < 0) continue;
          }
          pts.push({ x, z, node, edge });
        }
      mapPts.set(w, pts);
    }
    return pts.filter((q) =>
      q.node >= 0 ? w.nodes[q.node].seen : w.edges[q.edge].seen,
    );
  }
  // a rounded box path for a sewer room, from its centre and half sizes
  function roomPath(g, x0, y0, x1, y1, r) {
    r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
    g.moveTo(x0 + r, y0);
    g.arcTo(x1, y0, x1, y1, r);
    g.arcTo(x1, y1, x0, y1, r);
    g.arcTo(x0, y1, x0, y0, r);
    g.arcTo(x0, y0, x1, y0, r);
    g.closePath();
  }
  function drawMap() {
    const c = el.map,
      g = c.getContext("2d"),
      w = G.world,
      p = G.player,
      S = c.width;
    const sc = (S - 16) / Math.max(w.W - 40, w.H - 40),
      ox = 8 - (w.minX + 20) * sc,
      oz = 8 - (w.minZ + 20) * sc;
    const X = (x) => S - (x * sc + ox),
      Z = (z) => S - (z * sc + oz);
    g.clearRect(0, 0, S, S);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.strokeStyle = "rgba(150,190,205,0.55)";
    g.lineWidth = 3.2;
    for (const e of w.edges) {
      if (!e.seen) continue;
      g.beginPath();
      e.pts.forEach((q, i) =>
        i ? g.lineTo(X(q.x), Z(q.z)) : g.moveTo(X(q.x), Z(q.z)),
      );
      g.stroke();
    }
    for (const n of w.nodes) {
      if (!n.seen) continue;
      g.beginPath();
      // a sewer room is a rounded box; the boss cavern and cave rooms round
      if (n.hw && n.kind !== "boss")
        roomPath(
          g,
          X(n.x + n.hw),
          Z(n.z + n.hd),
          X(n.x - n.hw),
          Z(n.z - n.hd),
          SEWER.corner * sc,
        );
      else g.arc(X(n.x), Z(n.z), n.r * sc, 0, TAU);
      g.fillStyle =
        n.kind === "boss" ? "rgba(216,67,46,0.5)" : "rgba(150,190,205,0.4)";
      g.fill();
    }
    const wet = mapWater(w);
    if (wet.length) {
      // one path, so squares that touch do not darken each other
      g.beginPath();
      const s2 = 2 * sc;
      for (const q of wet) g.rect(X(q.x) - s2 / 2, Z(q.z) - s2 / 2, s2, s2);
      g.fillStyle = "rgba(70,160,150,0.5)";
      g.fill();
    }
    for (const sh of w.shrines) {
      if (!w.nodes[sh.node].seen) continue;
      g.fillStyle = sh.lit ? "#ffb347" : "#6f8fb8";
      g.beginPath();
      g.arc(X(sh.x), Z(sh.z), 3, 0, TAU);
      g.fill();
    }
    if (G.gate) {
      g.strokeStyle = "#58e0ff";
      g.lineWidth = 2;
      g.beginPath();
      g.arc(X(G.gate.x), Z(G.gate.z), 5, 0, TAU);
      g.stroke();
    }
    // player arrow (map x is mirrored so that it matches the camera's handedness)
    const px = X(p.x),
      pz = Z(p.z),
      a = p.yaw;
    g.fillStyle = "#e8e2d4";
    g.beginPath();
    const pt = (ang, r) => [px - Math.sin(ang) * r, pz - Math.cos(ang) * r];
    let q = pt(a, 6);
    g.moveTo(q[0], q[1]);
    q = pt(a + 2.5, 4.5);
    g.lineTo(q[0], q[1]);
    q = pt(a - 2.5, 4.5);
    g.lineTo(q[0], q[1]);
    g.closePath();
    g.fill();
  }
  // the plaque card: content when it changes, then its place and size, from
  // the plaque on screen at k 0 to the middle of the screen at k 1
  let plKey = "";
  // text for innerHTML
  function esc(t) {
    return String(t).replace(/[&<>"]/g, (c) => "&#" + c.charCodeAt(0) + ";");
  }
  function plaqueCard() {
    const i = G.insp,
      d = el.plaque;
    if (!i || G.state !== "play") {
      d.style.display = "none";
      d.classList.remove("flare");
      plKey = "";
      return;
    }
    const q = i.q,
      open = q.cls && classOpen(q.cls),
      code = q.cls && PLAQUE_CODES[q.cls],
      n = code && !open ? code.len : 0,
      got = Math.min(n, i.syms.length),
      // what was pressed, in the notation of the input in use
      shown = codeText(i.syms.slice(i.syms.length - got)),
      close = closeName(),
      key = [q.id, open, got, close, shown.join(" ")].join("|");
    if (key !== plKey) {
      plKey = key;
      d.classList.toggle("sealed", !q.cls);
      d.classList.toggle("locked", !!q.cls && !open);
      d.classList.toggle("open", !!open);
      const col = q.cls ? CLASSES[q.cls].col : [0.7, 0.72, 0.78];
      d.style.setProperty(
        "--pc",
        "rgb(" + col.map((v) => Math.round(Math.sqrt(sat(v)) * 255)).join(",") + ")",
      );
      if (open) {
        const c = CLASSES[q.cls];
        el.plTitle.textContent = c.name;
        el.plBody.innerHTML =
          "<div><i>" + c.tag + "</i></div>" +
          c.kit.map((k) => "<div><b>" + k[0] + "</b>" + k[1] + "</div>").join("");
      } else {
        el.plTitle.textContent = PLAQUE_TEXT[q.id] || "Sealed";
        el.plBody.textContent = "";
      }
      let m = "";
      for (let j = 0; j < n; j++)
        m += j < got ? '<b class="on">' + esc(shown[j]) + "</b>" : "<u></u>";
      el.plMarks.innerHTML = m;
      el.plClose.innerHTML = close;
    }
    const k = smooth(i.k),
      W = canvas.clientWidth,
      H = canvas.clientHeight,
      s = R.toScreen(q.x, PLAQUE_Y, q.z) || [W / 2, H / 2],
      // under touch the layout gives the card its box, clear of the buttons
      L = TOUCH.on && TOUCH.layout,
      cx = L ? L.close.x + L.close.w / 2 : W / 2,
      cy = L ? L.close.y + L.close.h / 2 : H / 2,
      x = lerp(s[0], cx, k),
      y = lerp(s[1], cy, k);
    if (i.flare) {
      // restart the flare on a fresh unlock
      i.flare = false;
      d.classList.remove("flare");
      void d.offsetWidth;
      d.classList.add("flare");
    }
    d.style.display = "flex";
    d.style.opacity = k.toFixed(3);
    d.style.transform =
      "translate(" + (x - d.offsetWidth / 2).toFixed(1) + "px," +
      (y - d.offsetHeight / 2).toFixed(1) + "px) scale(" + lerp(0.1, 1, k).toFixed(3) + ")";
  }
  // what closes the plaque: Interact, or pausing when Interact's key is also
  // a code key and so enters the code instead
  function closeName() {
    if (TOUCH.on && !PAD.active) return "Tap the plaque to close";
    const a = PAD.active ? PAD_BIND : BIND,
      ik = a.interact,
      // those presses enter a symbol first, so Interact never sees them
      shared = ["dodge", "heal", "tool", "fwd", "back", "left", "right"].some((x) => a[x] && a[x] === ik);
    if (!shared) return "<kbd>" + actKey("interact") + "</kbd> Close";
    return "<kbd>" + (PAD.active ? padName("P:9", PAD.fam) : G.noLock ? "P" : "Esc") + "</kbd> Close";
  }
  function hint() {
    if (!el || !G.player) return;
    const c = G.player.cls,
      k = actKey;
    el.hint.textContent =
      k("light") +
      " attack · " +
      k("heavy") +
      " heavy · " +
      k("guard") +
      " guard, tap to parry · " +
      k("dodge") +
      " dodge · " +
      k("lock") +
      " lock on · " +
      k("special") +
      " " +
      c.special.name.toLowerCase() +
      " · " +
      k("tool") +
      " " +
      c.tool.name.toLowerCase() +
      " · " +
      k("heal") +
      " flask";
  }
  return { init, update, hint, mapWater };
})();
