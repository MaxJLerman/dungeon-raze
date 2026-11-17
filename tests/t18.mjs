// Plaques, unlock codes and binds.
// Run with: SCRIPT=$PWD/tests/t18.mjs node test.mjs hub
// Every step returns an object with a boolean `pass`.
const step = (name, body) => ({
  name,
  eval: `(() => { const { G, cam } = DF; G.manual = true; const K = (a) => { DF.taps[DF.BIND[a]] = true; }; ${body} })()`,
});
export default [
  step("default binds", `
  const c = { key: DF.DEFAULT_BINDS.interact === "Space", dodge: DF.DEFAULT_BINDS.dodge === "KeyB",
    pad: DF.DEFAULT_PAD.interact === "P:0", padDodge: DF.DEFAULT_PAD.dodge === "P:1" };
  return { pass: Object.values(c).every(Boolean), c };`),
  step("old save moves dodge off Space", `
  const save = (b) => localStorage.setItem("dungeon-raze.v2", JSON.stringify({ b, p: {}, o: {} }));
  Object.assign(DF.BIND, DF.DEFAULT_BINDS);
  save(Object.assign({}, DF.DEFAULT_BINDS, { dodge: "Space", interact: undefined }));
  DF.loadOpt(); const moved = DF.BIND.dodge === "KeyB" && DF.BIND.interact === "Space";
  Object.assign(DF.BIND, DF.DEFAULT_BINDS);
  save(Object.assign({}, DF.DEFAULT_BINDS, { dodge: "Space", heavy: "KeyB", interact: undefined }));
  DF.loadOpt(); const kept = DF.BIND.dodge === "Space" && DF.BIND.heavy === "KeyB";
  Object.assign(DF.BIND, DF.DEFAULT_BINDS); DF.saveOpt();
  return { pass: moved && kept, moved, kept };`),
];
