export default [
  {
    name: "seed sweep",
    eval: `(() => { const { G } = DF; G.manual = true; const bad = []; let tmax = 0, emin = 99, emax = 0, tri = 0;
    for (let s = 1; s <= 40; s++) { const t0 = performance.now(); DF.newRun(s * 7919); tmax = Math.max(tmax, performance.now() - t0); const w = G.world;
      for (const e of w.edges) for (const q of e.pts) if (w.fieldAt(q.x, q.z) < 1.2) bad.push('edge ' + s + ' f=' + w.fieldAt(q.x, q.z).toFixed(2));
      for (const sp of w.spawns) if (w.fieldAt(sp.x, sp.z) < 0.45) bad.push('spawn ' + s + ' ' + sp.type + ' f=' + w.fieldAt(sp.x, sp.z).toFixed(2));
      for (const sh of w.shrines) if (w.fieldAt(sh.x, sh.z) < 2) bad.push('shrine ' + s);
      if (w.nodes.some((n) => n.depth < 0)) bad.push('unreachable ' + s);
      if (w.fieldAt(w.spawn.x, w.spawn.z) < 1) bad.push('spawn pt ' + s);
      emin = Math.min(emin, w.spawns.length); emax = Math.max(emax, w.spawns.length); tri = Math.max(tri, w.pos.length / 9); }
    return { bad: bad.slice(0, 12), nbad: bad.length, genMs: Math.round(tmax), emin, emax, tri }; })()`,
  },
];
