// ---- effects of the D gate's enemies ----
// A bloater's poison cloud: drifting green sprites inside its radius that thin
// out over its life, a faint ring on the water at its edge, and a bright puff
// at the start of the burst. Everything is additive, so overlapping puffs
// thicken the gas.
function drawClouds() {
  for (const c of G.clouds) {
    const k = sat(c.t / CLOUD.life),
      fade = sat(c.t / 0.12) * (1 - k) * (1 - k * 0.3),
      seed = c.x * 12.9898 + c.z * 78.233;
    const PUFFS = 18;
    for (let i = 0; i < PUFFS; i++) {
      // each puff circles slowly at its own radius and rises as it thins
      const h = Math.abs(Math.sin(seed + i * 7.31)),
        h2 = Math.abs(Math.sin(seed * 1.7 + i * 3.17)),
        a = (i / PUFFS) * TAU + c.t * (0.35 + h * 0.3) * (i & 1 ? 1 : -1) + h2 * 6,
        rr = c.r * (0.1 + 0.85 * h2) * (0.85 + 0.15 * Math.sin(c.t * 1.3 + i)),
        y = -0.1 + 0.3 * h + c.t * (0.1 + 0.12 * h2) + 0.15 * Math.sin(c.t * 1.9 + i * 2),
        s = (0.5 + 0.8 * h) * (0.8 + 0.4 * sat(c.t / 1.2)),
        g = 0.65 + 0.3 * h;
      R.sprite(c.x + Math.sin(a) * rr, y, c.z + Math.cos(a) * rr, s, 0.2 * g, 0.75 * g, 0.1, 0.26 * fade);
    }
    // the dense core, and the burst's flash
    R.sprite(c.x, 0.15 + c.t * 0.1, c.z, c.r * 0.7, 0.3, 0.85, 0.2, 0.1 * fade);
    const b = sat(1 - c.t / 0.3);
    if (b > 0) R.sprite(c.x, 0.2, c.z, c.r * 1.3, 0.7, 1, 0.5, 0.7 * b);
    R.ring(c.x, -0.25, c.z, c.r * 0.9, c.r, 0.3, 0.9, 0.2, 0.45 * fade);
  }
}
// An eel's shock: every point of the shocked body's water on a 1 m lattice
// over its room (12 m round the body's middle when it has none) lights bright
// blue-white and crackles with short bright streaks for EEL.lit s. Only
// points where bodyAt is that body's id, so another pool stays dark. An eel
// that is gathering the charge shows a gathering glow on the water along it.
function drawShocks() {
  const w = G.world;
  for (const s of G.shocks) {
    const b = w.bodies[s.body];
    if (!b) continue;
    const n = s.room,
      x0 = n ? n.x - n.hw : b.x - 12,
      x1 = n ? n.x + n.hw : b.x + 12,
      z0 = n ? n.z - n.hd : b.z - 12,
      z1 = n ? n.z + n.hd : b.z + 12,
      k = sat(s.t / s.dur),
      env = sat(s.t / 0.04) * (1 - k * k),
      step = Math.floor(G.t * 24);
    for (let x = Math.ceil(x0); x <= x1; x++)
      for (let z = Math.ceil(z0); z <= z1; z++) {
        if (w.waterAt(x, z) < 0.5 || w.bodyAt(x, z) !== s.body) continue;
        const h = Math.abs(Math.sin(x * 12.9898 + z * 78.233)),
          fl = 0.7 + 0.3 * Math.abs(Math.sin(step * 1.7 + h * 40));
        R.flat(x, 0.05, z, 1.1, 0.3, 0.55, 1, 0.75 * env * fl);
        R.flat(x, 0.06, z, 0.7, 0.85, 0.95, 1, 0.4 * env * fl);
        // a crackling streak up off the water, a new shape every 1/24 s
        const q = Math.abs(Math.sin(x * 4.37 + z * 9.11 + step * 2.9));
        if (q < 0.45) {
          const a = q * 40,
            ln = 0.5 + 0.9 * h,
            sx = Math.sin(a),
            sz = Math.cos(a);
          R.ribbon(
            4,
            (t, side) => {
              const j = Math.sin(t * 17 + a * 5 + step) * 0.12;
              return [
                x + sx * ln * t + j * sz + (side ? 0.035 : 0),
                0.08 + t * (0.25 + 0.5 * h),
                z + sz * ln * t - j * sx,
              ];
            },
            0.8,
            0.95,
            1,
            (t) => 0.9 * env * (1 - t * 0.7),
          );
        }
      }
    // a tall flash over the middle of the water at the moment of the shock
    const f = sat(1 - s.t / 0.15);
    if (f > 0) R.sprite(b.x, 0.5, b.z, 3.2, 0.5, 0.75, 1, 0.4 * f);
  }
  // the charge gathering: glows along a glowing eel, strengthening to the shock
  for (const e of G.enemies) {
    if (e.type !== "eel" || e.dead || !(e.glowT > 0) || !e.vis) continue;
    const g = sat(1 - e.glowT / EEL.glow),
      fl = 0.7 + 0.3 * Math.sin(G.t * 40);
    for (let i = 0; i < 6; i++) {
      const d = i * 0.6;
      R.sprite(e.x - Math.sin(e.yaw) * d, 0.12, e.z - Math.cos(e.yaw) * d, 0.5 + 0.5 * g, 0.4, 0.75, 1, (0.15 + 0.45 * g) * fl);
    }
    R.ring(e.x, 0.06, e.z, 0.6 + 2.2 * g, 0.7 + 2.2 * g, 0.4, 0.75, 1, 0.5 * (1 - g * 0.5));
  }
}
// A siren's song: while it pulls, pale rings travel from her to the player,
// each standing across the line between them and closing as it nears them,
// and slow rings spread on the water round her.
function drawSongs() {
  const p = G.player,
    wl = -WATER.sink + 0.03;
  for (const e of G.enemies) {
    if (e.type !== "siren" || e.dead || !e.vis || !e.sing) continue;
    const dx = p.x - e.x,
      dz = p.z - e.z,
      d = Math.hypot(dx, dz) || 1,
      rx = -dz / d,
      rz = dx / d;
    for (let i = 0; i < 4; i++) {
      // 0 leaving her mouth, 1 reaching the player
      const k = (G.t * 0.8 + i / 4) % 1,
        cx = e.x + dx * k,
        cz = e.z + dz * k,
        cy = lerp(0.65, 1.15, k),
        rr = lerp(0.75, 0.3, k),
        a = 0.55 * Math.sin(PI * k);
      R.ribbon(
        20,
        (t, side) => {
          const an = t * TAU,
            r = rr + (side ? 0.07 : 0);
          return [cx + rx * Math.cos(an) * r, cy + Math.sin(an) * r, cz + rz * Math.cos(an) * r];
        },
        0.75,
        0.95,
        1,
        () => a,
      );
    }
    for (let i = 0; i < 2; i++) {
      const k = (G.t * 0.5 + i / 2) % 1,
        r = 0.7 + 2.2 * k;
      R.ring(e.x, wl, e.z, r - 0.06, r, 0.65, 0.9, 0.95, 0.45 * (1 - k));
    }
  }
}
// Old Sluicejaw under the water. Swimming, a V of foam spreads back from
// just ahead of its head along its heading, brighter the faster it goes, with
// a few bubbles over its back; rising, bubbles boil up over the spot and a
// ring widens on the water, both quickening toward the burst. Everything is
// drawn on water only, so no wake ever crosses dry floor.
function drawWakes() {
  const w = G.world,
    wl = -WATER.sink + 0.03,
    wet = (x, z) => w.waterAt(x, z) >= 0.5,
    foam = [0.7, 0.88, 0.82];
  // a ring on the water that fades out where it would cross dry floor
  const waterRing = (x, z, r0, r1, a) =>
    R.ribbon(
      32,
      (t, s) => {
        const an = t * TAU,
          rr = s ? r1 : r0;
        return [x + Math.cos(an) * rr, wl, z + Math.sin(an) * rr];
      },
      foam[0],
      foam[1],
      foam[2],
      (t) => (wet(x + Math.cos(t * TAU) * r1, z + Math.sin(t * TAU) * r1) ? a : 0),
    );
  for (const e of G.enemies) {
    if (e.type !== "croc" || e.dead || (e.mode !== "under" && e.mode !== "rise")) continue;
    if (Math.hypot(e.x - R.cam.x, e.z - R.cam.z) > 66) continue;
    const t = G.t;
    if (e.mode === "under") {
      const k = sat(e.speed / (CROC.swim * 0.5)),
        fx = Math.sin(e.yaw),
        fz = Math.cos(e.yaw),
        // right of its heading: (-cos yaw, sin yaw)
        rx = -fz,
        rz = fx,
        hx = e.x + fx * 1.4,
        hz = e.z + fz * 1.4;
      if (k > 0.1) {
        // the bow wave, then the two arms of the V, each puff drifting outward
        if (wet(hx, hz)) R.flat(hx, wl, hz, 0.9, foam[0], foam[1], foam[2], 0.9 * k);
        for (let i = 1; i <= 12; i++)
          for (const sd of [-1, 1]) {
            const d = i * 0.5,
              j = Math.sin(t * 7 + i * 1.9 + sd) * 0.12,
              sp = d * 0.42 + j,
              x = hx - fx * d + rx * sd * sp,
              z = hz - fz * d + rz * sd * sp;
            if (!wet(x, z)) continue;
            const a = k * (1 - i / 13) * (0.8 + 0.2 * Math.sin(t * 11 + i));
            R.flat(x, wl, z, 0.4 + d * 0.07, foam[0], foam[1], foam[2], 1.1 * a);
          }
        // the trail of churned water over its back
        for (let i = 0; i < 6; i++) {
          const d = i * 0.6,
            x = e.x - fx * d,
            z = e.z - fz * d;
          if (wet(x, z)) R.flat(x, wl, z, 0.6, foam[0], foam[1], foam[2], 0.5 * k * (1 - i / 6));
        }
      }
      // a few bubbles over it, rising and bursting at the surface
      for (let i = 0; i < 4; i++) {
        const ph = (t * 1.3 + i * 0.37) % 1,
          h = Math.sin(i * 12.9898 + Math.floor(t * 1.3 + i * 0.37) * 4.1),
          x = e.x + Math.sin(h * 9) * 0.7,
          z = e.z + Math.cos(h * 7) * 0.7;
        if (wet(x, z)) R.sprite(x, wl + ph * 0.15, z, 0.1 + ph * 0.08, 0.8, 0.95, 0.9, 0.9 * (1 - ph));
      }
      continue;
    }
    // rising: k runs 0 to 1 over the warning
    const k = sat(1 - e.modeT / CROC.warn),
      n = 6 + Math.round(k * 14);
    for (let i = 0; i < n; i++) {
      const ph = (t * (1.6 + k * 2.4) + i * 0.173) % 1,
        h = Math.sin(i * 78.233 + Math.floor(t * 2 + i * 0.173) * 3.7),
        rr = (0.3 + Math.abs(h) * 1.2) * (0.6 + 0.4 * k),
        an = h * 20 + i,
        x = e.x + Math.sin(an) * rr,
        z = e.z + Math.cos(an) * rr;
      if (!wet(x, z)) continue;
      R.sprite(x, wl + ph * (0.2 + 0.4 * k), z, 0.12 + 0.12 * k, 0.8, 0.95, 0.9, (0.6 + 0.4 * k) * (1 - ph));
    }
    // the churn over the spot, and the rings widening from it
    R.flat(e.x, wl, e.z, 1.0 + 0.8 * k, foam[0], foam[1], foam[2], 0.45 + 0.5 * k);
    for (let i = 0; i < 2; i++) {
      const q = (t * (0.9 + k) + i / 2) % 1,
        r = 0.6 + 2.2 * q;
      waterRing(e.x, e.z, r - 0.12, r, (0.6 + 0.5 * k) * (1 - q));
    }
  }
}
