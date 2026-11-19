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
