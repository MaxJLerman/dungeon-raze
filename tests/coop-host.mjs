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
check("coopWorldSum of cave 99 is the same on two fresh host copies", () => {
  const a = loadHost(),
    b = loadHost();
  a.start({ seed: 99, grade: "E" });
  b.start({ seed: 99, grade: "E" });
  const sa = a.sum(a.G.world),
    sb = b.sum(b.G.world);
  assert.match(sa, /^[0-9a-f]{8}$/);
  assert.equal(sa, sb);
  b.start({ seed: 7, grade: "E" });
  assert.notEqual(b.sum(b.G.world), sa);
});
done();
