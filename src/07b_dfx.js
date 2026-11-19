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
