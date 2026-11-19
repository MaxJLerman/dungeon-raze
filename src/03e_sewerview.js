// ---------- the sewer's culling: pieces and what each sees ----------

// Cuts the sewer's mesh into pieces for culling: each room, and each tunnel
// in stretches of S.piece.runs runs. Returns the pieces, the grid of piece
// ids and the mesh sorted by piece, so each piece is one range of vertices.
// o = { nodes, edges, F, W, H, minX, minZ, P, C, M, los }.
function sewerPieces(o) {
  const { nodes, edges, F, W, H, minX, minZ, P, C, M, los } = o,
    S = SEWER,
    W1 = W + 1,
    NP = W1 * (H + 1),
    cut = S.piece.fog / ENV_SEWER.fogD;
  // the cells each piece holds: a room's own, then each walkable cell to the
  // nearest tunnel run
  const core = new Int32Array(NP).fill(-1),
    best = new Float32Array(NP).fill(1e9);
  let nc = 0;
  const box = (x0, z0, x1, z1, fn) => {
    const ia = Math.max(0, Math.floor(x0 - minX)),
      ib = Math.min(W, Math.ceil(x1 - minX)),
      ja = Math.max(0, Math.floor(z0 - minZ)),
      jb = Math.min(H, Math.ceil(z1 - minZ));
    for (let j = ja; j <= jb; j++)
      for (let i = ia; i <= ib; i++) fn(j * W1 + i, i + minX, j + minZ);
  };
  for (const n of nodes) {
    const id = nc++;
    box(n.x - n.hw, n.z - n.hd, n.x + n.hw, n.z + n.hd, (k, x, z) => {
      const d =
        n.kind === "boss"
          ? n.r - Math.hypot(x - n.x, z - n.z)
          : roomField(n, x, z);
      if (d > 0) {
        core[k] = id;
        best[k] = -1;
      }
    });
  }
  const m = S.tunR + 1;
  for (const e of edges) {
    const line = [nodes[e.a], ...e.bends, nodes[e.b]];
    for (let i = 0; i < line.length - 1; i++) {
      if (i % S.piece.runs === 0) nc++;
      const id = nc - 1,
        a = line[i],
        b = line[i + 1],
        dx = b.x - a.x,
        dz = b.z - a.z,
        l2 = dx * dx + dz * dz || 1;
      box(
        Math.min(a.x, b.x) - m,
        Math.min(a.z, b.z) - m,
        Math.max(a.x, b.x) + m,
        Math.max(a.z, b.z) + m,
        (k, x, z) => {
          if (F[k] <= 0) return;
          const t = sat(((x - a.x) * dx + (z - a.z) * dz) / l2),
            d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
          if (d < best[k]) {
            best[k] = d;
            core[k] = id;
          }
        },
      );
    }
  }
  // drop candidates that hold no cell (a stretch wholly inside a room)
  const remap = new Int32Array(nc).fill(-1);
  let np = 0;
  for (let k = 0; k < NP; k++) if (core[k] >= 0 && remap[core[k]] < 0) remap[core[k]] = 0;
  for (let i = 0; i < nc; i++) if (remap[i] === 0) remap[i] = np++;
  for (let k = 0; k < NP; k++) if (core[k] >= 0) core[k] = remap[core[k]];
  // every other cell takes the nearest piece, by a chamfer distance in
  // thirds of a metre; the piece grid keeps those within S.piece.pad
  const own = Int32Array.from(core),
    dist = new Float32Array(NP);
  for (let k = 0; k < NP; k++) dist[k] = own[k] >= 0 ? 0 : 1e9;
  const relax = (k, q, wgt) => {
    if (dist[q] + wgt < dist[k]) {
      dist[k] = dist[q] + wgt;
      own[k] = own[q];
    }
  };
  for (let j = 0; j <= H; j++)
    for (let i = 0; i <= W; i++) {
      const k = j * W1 + i;
      if (i > 0) relax(k, k - 1, 3);
      if (j > 0) {
        relax(k, k - W1, 3);
        if (i > 0) relax(k, k - W1 - 1, 4);
        if (i < W) relax(k, k - W1 + 1, 4);
      }
    }
  for (let j = H; j >= 0; j--)
    for (let i = W; i >= 0; i--) {
      const k = j * W1 + i;
      if (i < W) relax(k, k + 1, 3);
      if (j < H) {
        relax(k, k + W1, 3);
        if (i < W) relax(k, k + W1 + 1, 4);
        if (i > 0) relax(k, k + W1 - 1, 4);
      }
    }
  const pieceGrid = new Int16Array(NP).fill(-1);
  for (let k = 0; k < NP; k++)
    if (dist[k] <= S.piece.pad * 3) pieceGrid[k] = own[k];
  // the mesh, sorted by the piece of each triangle's centre cell
  const nt = P.length / 9,
    tp = new Int32Array(nt),
    cnt = new Int32Array(np + 1);
  for (let t = 0; t < nt; t++) {
    const b = t * 9,
      i = clamp(Math.round((P[b] + P[b + 3] + P[b + 6]) / 3 - minX), 0, W),
      j = clamp(Math.round((P[b + 2] + P[b + 5] + P[b + 8]) / 3 - minZ), 0, H);
    tp[t] = Math.max(0, own[j * W1 + i]);
    cnt[tp[t] + 1]++;
  }
  for (let i = 0; i < np; i++) cnt[i + 1] += cnt[i];
  const pieces = [];
  for (let i = 0; i < np; i++)
    pieces.push({
      first: cnt[i] * 3,
      count: (cnt[i + 1] - cnt[i]) * 3,
      box: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9],
      sees: [],
    });
  const pos = new Float32Array(P.length),
    col = new Uint8Array(C.length),
    mat = new Uint8Array(M.length),
    at = cnt.slice(0, np);
  for (let t = 0; t < nt; t++) {
    const d = at[tp[t]]++,
      bx = pieces[tp[t]].box;
    for (let v = 0; v < 3; v++) {
      for (let c = 0; c < 3; c++) {
        const val = P[t * 9 + v * 3 + c];
        pos[d * 9 + v * 3 + c] = val;
        if (val < bx[c]) bx[c] = val;
        if (val > bx[c + 3]) bx[c + 3] = val;
      }
      for (let c = 0; c < 4; c++) col[d * 12 + v * 4 + c] = C[t * 12 + v * 4 + c];
      mat[d * 3 + v] = M[t * 3 + v];
    }
  }
  // a piece's box holds its cells too, so one with no triangles still has one
  for (let k = 0; k < NP; k++) {
    const id = core[k];
    if (id < 0) continue;
    const bx = pieces[id].box,
      x = (k % W1) + minX,
      z = ((k / W1) | 0) + minZ;
    bx[0] = Math.min(bx[0], x);
    bx[2] = Math.min(bx[2], z);
    bx[3] = Math.max(bx[3], x);
    bx[5] = Math.max(bx[5], z);
    bx[1] = Math.min(bx[1], 0);
    bx[4] = Math.max(bx[4], 0);
  }
  // what each piece sees: itself, its neighbours on the grid, any piece in
  // sight between sample points within the fog, and then the neighbours of
  // every piece on that list. The camera can stand anywhere in a piece and
  // see past a corner that no pair of samples clears; the extra ring is what
  // catches those, and it is what keeps the list generous
  const sees = pieces.map((_, i) => new Set([i])),
    nb = pieces.map(() => []),
    link = (a, b) => {
      sees[a].add(b);
      sees[b].add(a);
    };
  for (let j = 0; j <= H; j++)
    for (let i = 0; i <= W; i++) {
      const k = j * W1 + i,
        a = pieceGrid[k];
      if (a < 0) continue;
      for (const q of [i < W ? k + 1 : -1, j < H ? k + W1 : -1]) {
        const b = q < 0 ? -1 : pieceGrid[q];
        if (b < 0 || b === a || sees[a].has(b)) continue;
        link(a, b);
        nb[a].push(b);
        nb[b].push(a);
      }
    }
  // samples: a lattice over each piece's cells, and every S.piece.edge-th
  // cell on its rim (against a wall or another piece), where the camera
  // sees furthest round a corner
  const smp = pieces.map(() => []),
    st = S.piece.sample,
    eg = S.piece.edge;
  for (let j = 0; j <= H; j++)
    for (let i = 0; i <= W; i++) {
      const k = j * W1 + i,
        a = core[k];
      if (a < 0 || F[k] <= 0) continue;
      const rim =
        (i + j) % eg === 0 &&
        i > 0 &&
        j > 0 &&
        i < W &&
        j < H &&
        [k - 1, k + 1, k - W1, k + W1].some((q) => core[q] !== a || F[q] <= 0);
      if ((i % st === 0 && j % st === 0) || rim) smp[a].push(i + minX, j + minZ);
    }
  // a piece with no sample is sampled at its deepest cell
  for (let id = 0; id < np; id++)
    if (!smp[id].length) {
      let kb = -1;
      for (let k = 0; k < NP; k++) if (core[k] === id && (kb < 0 || F[k] > F[kb])) kb = k;
      smp[id].push((kb % W1) + minX, ((kb / W1) | 0) + minZ);
    }
  const gap = (a, b) =>
    Math.hypot(
      Math.max(0, a[0] - b[3], b[0] - a[3]),
      Math.max(0, a[2] - b[5], b[2] - a[5]),
    );
  for (let a = 0; a < np; a++)
    for (let b = a + 1; b < np; b++) {
      if (sees[a].has(b) || gap(pieces[a].box, pieces[b].box) > cut) continue;
      const sa = smp[a],
        sb = smp[b];
      search: for (let i = 0; i < sa.length; i += 2)
        for (let j = 0; j < sb.length; j += 2)
          if (los(sa[i], sa[i + 1], sb[j], sb[j + 1])) {
            link(a, b);
            break search;
          }
    }
  // one ring more, both ways, from the lists as the sight lines left them
  const sight = sees.map((t) => [...t]);
  for (let i = 0; i < np; i++) for (const j of sight[i]) for (const m of nb[j]) link(i, m);
  for (let i = 0; i < np; i++) pieces[i].sees = [...sees[i]].sort((a, b) => a - b);
  const pieceAt = (x, z) => {
    const i = Math.round(x - minX),
      j = Math.round(z - minZ);
    return i < 0 || j < 0 || i > W || j > H ? -1 : pieceGrid[j * W1 + i];
  };
  return { pieces, pieceGrid, pieceAt, pos, col, mat };
}
// The pieces of w to draw this frame, from the camera at (cx, cz) and the
// player at (px, pz): what the camera's piece and the player's piece see,
// within the fog of the camera and, with frustum, inside the view. A camera
// outside every piece shows nothing to cull by, so then it is what the
// player's piece sees within the fog of the player. null draws everything.
function visiblePieces(w, cx, cz, px, pz, frustum = true) {
  const ps = w.pieces;
  if (!ps) return null;
  const cut = SEWER.piece.fog / ENV_SEWER.fogD,
    a = w.pieceAt(cx, cz),
    b = w.pieceAt(px, pz),
    seen = new Uint8Array(ps.length),
    out = [];
  if (a < 0) {
    cx = px;
    cz = pz;
    frustum = false;
  }
  const take = (id) => {
    if (seen[id]) return;
    seen[id] = 1;
    const bx = ps[id].box,
      dx = Math.max(0, bx[0] - cx, cx - bx[3]),
      dz = Math.max(0, bx[2] - cz, cz - bx[5]);
    if (dx * dx + dz * dz <= cut * cut && (!frustum || R.boxVisible(bx))) out.push(id);
  };
  if (a < 0 && b < 0) for (let id = 0; id < ps.length; id++) take(id);
  for (const s of [a, b]) if (s >= 0) for (const id of ps[s].sees) take(id);
  return out;
}
