// Base of operations: hall world, portals, transition, training dummy, screens.
// Run with: SCRIPT=$PWD/tests/t8.mjs node test.mjs hub
// Every step returns an object with a boolean `pass`.
const step = (name, body) => ({
  name,
  eval: `(() => { const { G, cam } = DF; G.manual = true; const K = (a) => { DF.taps[DF.BIND[a]] = true; }; ${body} })()`,
});
export default [
  step("hub world", `return { pass: typeof DF.genHub === "function" };`),
];
