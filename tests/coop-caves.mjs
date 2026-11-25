// Two browsers must build the same cave from a seed. This builds seeds 1 to 40
// of grade E in Node and in Chromium, Firefox and WebKit, and compares a
// checksum of each cave's vertex positions (coopWorldSum).
// Fails only if Node throws or Chromium differs from Node. A difference in
// Firefox or WebKit, or one that will not launch, is printed as a finding.
// Run with: node build.mjs && node tests/coop-caves.mjs
// Set PLAYWRIGHT_MODULE to a full path if playwright is not resolvable from here.
import { loadHost, hostSource } from "./lib/coop.mjs";

const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
let fail = false;

// Node
const host = loadHost();
const ref = {};
for (const s of SEEDS) {
  host.start({ seed: s, grade: "E" });
  ref[s] = host.sum(host.G.world);
}
console.log("node     " + SEEDS.length + " caves built");

// The same code, run inside a page. Takes the host source and the seeds.
const inPage = ({ src, seeds }) => {
  const h = new Function("localStorage", "document", "window", "navigator", src)();
  const out = {};
  for (const s of seeds) {
    h.start({ seed: s, grade: "E" });
    out[s] = h.sum(h.G.world);
  }
  return out;
};

const pw = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const src = hostSource();
const findings = [];
for (const name of ["chromium", "firefox", "webkit"]) {
  let br;
  try {
    br = await pw[name].launch();
    const page = await br.newPage();
    await page.goto("about:blank");
    const got = await page.evaluate(inPage, { src, seeds: SEEDS });
    const bad = SEEDS.filter((s) => got[s] !== ref[s]);
    const line =
      name.padEnd(8) + " " + (SEEDS.length - bad.length) + "/" + SEEDS.length + " match";
    console.log(line);
    if (bad.length) {
      const msg = name + " differs on seeds " + bad.join(", ");
      console.log("FINDING " + msg);
      findings.push(msg);
      if (name === "chromium") fail = true;
    }
  } catch (e) {
    const msg = name + " could not run: " + (e && e.message ? e.message.split("\n")[0] : e);
    console.log(name.padEnd(8) + " " + (name === "chromium" ? "FAIL " : "FINDING ") + msg);
    findings.push(msg);
    if (name === "chromium") fail = true;
  } finally {
    if (br) await br.close();
  }
}
console.log(findings.length ? findings.length + " finding(s)" : "all engines agree with Node");
if (fail) process.exitCode = 1;
