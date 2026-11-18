// The Sapper's cave-in: rock in the walkable field, and the cave-in in play.
// Run with: SCRIPT=$PWD/tests/t20.mjs node test.mjs smoke
// Every step returns an object with a boolean `pass`.

// a corridor 21 m long and 8 m wide along X, walls at z 0 and z 8
const field = (name, body) => ({
  name,
  eval: `(() => {
  const mk = () => { const F = new Float32Array(22 * 9);
    for (let j = 0; j <= 8; j++) for (let i = 0; i <= 21; i++) F[j * 22 + i] = j === 0 || j === 8 ? -1 : Math.min(j, 8 - j) - 0.5;
    return DF.fieldFns(F, 0, 0, 21, 8); };
  ${body} })()`,
});

export default [
  field("a rock across a corridor blocks route and sight, and comes out again", `
  const f = mk(), before = f.route(3, 4, 18, 4, 0.5), see0 = f.los(3, 4, 18, 4);
  const id = f.addRock(10, -1, 10, 9, 1);
  const c = { pre: !!before && see0, routeCut: f.route(3, 4, 18, 4, 0.5) === null, sightCut: !f.los(3, 4, 18, 4),
    rock: f.fieldAt(10, 4) < -0.5, near: Math.abs(f.fieldAt(12.5, 4) - 1.5) < 0.2 };
  f.removeRock(id);
  c.back = !!f.route(3, 4, 18, 4, 0.5) && f.los(3, 4, 18, 4) && Math.abs(f.fieldAt(10, 4) - 3.5) < 0.01;
  return { pass: Object.values(c).every(Boolean), c };`),
  field("overlapping rocks: taking one out leaves the other", `
  const f = mk(), a = f.addRock(10, -1, 10, 9, 1), b = f.addRock(11, -1, 11, 9, 1); f.removeRock(a);
  const c = { still: f.fieldAt(11, 4) < -0.5, cut: f.route(3, 4, 18, 4, 0.5) === null };
  f.clearRocks(); c.clear = Math.abs(f.fieldAt(11, 4) - 3.5) < 0.01 && Math.abs(f.fieldAt(10, 4) - 3.5) < 0.01;
  f.removeRock(999);
  return { pass: Object.values(c).every(Boolean), c };`),
  field("resolve pushes a body out of a rock", `
  const f = mk(); f.addRock(10, -1, 10, 9, 1); const o = { x: 10.6, z: 4 };
  for (let i = 0; i < 4; i++) f.resolve(o, 0.6);
  return { pass: f.fieldAt(o.x, o.z) >= 0.59 && o.x > 10, o };`),
  field("the cave and the hall have rock calls", `
  const w = DF.G.world, h = DF.genHub();
  const ok = (x) => ["addRock", "removeRock", "clearRocks"].every((k) => typeof x[k] === "function");
  return { pass: ok(w) && ok(h) };`),
];
