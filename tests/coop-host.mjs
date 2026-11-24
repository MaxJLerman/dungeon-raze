// The headless host copy builds and loads in Node.
// Run with: node build.mjs && node tests/coop-host.mjs
import assert from "node:assert/strict";
import { loadHost, check, done } from "./lib/coop.mjs";

check("the host copy loads in Node and builds cave 99", () => {
  const h = loadHost();
  h.start({ seed: 99, grade: "E" });
  assert.equal(h.G.enemies.length, 47);
  assert.equal(h.G.world.pos.length / 9, 81835);
});
check("two host copies do not share state", () => {
  const a = loadHost(),
    b = loadHost();
  a.start({ seed: 99, grade: "E" });
  b.start({ seed: 7, grade: "E" });
  assert.notEqual(a.G.world, b.G.world);
});
done();
