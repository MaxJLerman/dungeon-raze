// ---------- math + utils ----------
const PI = Math.PI,
  TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
  t = sat(t);
  return t * t * (3 - 2 * t);
};
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > PI) d -= TAU;
  if (d < -PI) d += TAU;
  return d;
}
const dampAng = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
function turnTo(a, b, maxStep) {
  const d = angDiff(a, b);
  return a + clamp(d, -maxStep, maxStep);
}
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi;
  const u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf);
  return lerp(
    lerp(hash2(xi, yi), hash2(xi + 1, yi), u),
    lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u),
    v,
  );
}
// sRGB hex -> linear rgb
function hexc(h, m = 1) {
  const f = (v) => Math.pow(v / 255, 2.2) * m;
  return [f((h >> 16) & 255), f((h >> 8) & 255), f(h & 255)];
}

// column-major 4x4
const _T = new Float32Array(16);
const M4 = {
  mul(o, a, b) {
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4],
        b1 = b[c * 4 + 1],
        b2 = b[c * 4 + 2],
        b3 = b[c * 4 + 3];
      _T[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      _T[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      _T[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      _T[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    o.set(_T);
    return o;
  },
  persp(o, fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2);
    o.fill(0);
    o[0] = t / asp;
    o[5] = t;
    o[10] = (f + n) / (n - f);
    o[11] = -1;
    o[14] = (2 * f * n) / (n - f);
    return o;
  },
  lookAt(o, ex, ey, ez, tx, ty, tz) {
    let zx = ex - tx,
      zy = ey - ty,
      zz = ez - tz;
    let l = Math.hypot(zx, zy, zz) || 1;
    zx /= l;
    zy /= l;
    zz /= l;
    let xx = zz,
      xz = -zx;
    l = Math.hypot(xx, xz) || 1;
    xx /= l;
    xz /= l; // x = up × z
    const yx = zy * xz,
      yy = zz * xx - zx * xz,
      yz = -zy * xx; // y = z × x
    o[0] = xx;
    o[1] = yx;
    o[2] = zx;
    o[3] = 0;
    o[4] = 0;
    o[5] = yy;
    o[6] = zy;
    o[7] = 0;
    o[8] = xz;
    o[9] = yz;
    o[10] = zz;
    o[11] = 0;
    o[12] = -(xx * ex + xz * ez);
    o[13] = -(yx * ex + yy * ey + yz * ez);
    o[14] = -(zx * ex + zy * ey + zz * ez);
    o[15] = 1;
    return o;
  },
  // T * Ry * Rx * Rz * S
  trs(o, px, py, pz, rx, ry, rz, sx, sy, sz) {
    const cx = Math.cos(rx),
      sxn = Math.sin(rx),
      cy = Math.cos(ry),
      syn = Math.sin(ry),
      cz = Math.cos(rz),
      szn = Math.sin(rz);
    o[0] = (cy * cz + syn * sxn * szn) * sx;
    o[1] = cx * szn * sx;
    o[2] = (-syn * cz + cy * sxn * szn) * sx;
    o[3] = 0;
    o[4] = (-cy * szn + syn * sxn * cz) * sy;
    o[5] = cx * cz * sy;
    o[6] = (syn * szn + cy * sxn * cz) * sy;
    o[7] = 0;
    o[8] = syn * cx * sz;
    o[9] = -sxn * sz;
    o[10] = cy * cx * sz;
    o[11] = 0;
    o[12] = px;
    o[13] = py;
    o[14] = pz;
    o[15] = 1;
    return o;
  },
};
