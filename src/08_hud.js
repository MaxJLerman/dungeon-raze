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
    };
    const host = $("ebars");
    for (let i = 0; i < 8; i++) {
      const d = document.createElement("div");
      d.className = "eb";
      d.innerHTML = "<i></i><b></b>";
      host.appendChild(d);
      ebars.push({ d, hp: d.firstChild, po: d.lastChild });
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
  function update(dt) {
    const p = G.player;
    if (!p) return;
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
    // enemy bars
    let n = 0;
    for (const e of G.enemies) {
      if (n >= ebars.length) break;
      if (e.dead || e.def.boss || !e.vis) continue;
      if (!e.aware && e.hp >= e.def.hp) continue;
      const d = Math.hypot(e.x - p.x, e.z - p.z);
      if (d > 26) continue;
      const s = R.toScreen(e.x, e.def.top + 0.25, e.z);
      if (!s) continue;
      const b = ebars[n++];
      b.d.style.display = "block";
      b.d.style.transform =
        "translate(" + (s[0] - 32).toFixed(1) + "px," + s[1].toFixed(1) + "px)";
      b.hp.style.width = sat(e.hp / e.def.hp) * 100 + "%";
      b.po.style.width = sat(e.posture / e.def.posture) * 100 + "%";
      b.d.classList.toggle("stag", e.state === "stagger");
    }
    for (let i = n; i < ebars.length; i++) ebars[i].d.style.display = "none";
    // prompt
    const ex =
      p.state !== "dead" && p.state !== "execute" ? nearestStaggered() : null;
    let pr = "";
    if (ex) pr = "<kbd>" + keyName(BIND.light) + "</kbd> Execute";
    if (el.pr !== pr) {
      el.pr = pr;
      el.prompt.innerHTML = pr;
      el.prompt.style.display = pr ? "block" : "none";
    }
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
      g.arc(X(n.x), Z(n.z), n.r * sc, 0, TAU);
      g.fillStyle =
        n.kind === "boss" ? "rgba(216,67,46,0.5)" : "rgba(150,190,205,0.4)";
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
  function hint() {
    if (!el || !G.player) return;
    const c = G.player.cls,
      k = (a) => keyName(BIND[a]);
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
  return { init, update, hint };
})();
