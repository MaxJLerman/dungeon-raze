// The dev menu is in the local build and nowhere in the release build.
// Run with: node tests/t26-build.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "raze-build-"));
const devOut = path.join(tmp, "dev.html"),
  relOut = path.join(tmp, "release.html");
const build = (...args) =>
  execFileSync("node", ["build.mjs", ...args], { cwd: ROOT, stdio: "pipe" });

let failed = 0;
const check = (name, ok) => {
  console.log((ok ? "ok   " : "FAIL ") + name);
  if (!ok) failed++;
};

try {
  build("--out", devOut);
  build("--release", "--out", relOut);
  const dev = fs.readFileSync(devOut, "utf8"),
    rel = fs.readFileSync(relOut, "utf8");
  check("the dev build has the dev file", dev.includes("function devHost"));
  check("the release build has no devHost", !rel.includes("devHost"));
  check("the release build has no dev screen", !rel.includes("scr-dev"));
  check("the release build keeps the inert seam", rel.includes("let DEV = null"));
  const start = Date.now() - 1000;
  build();
  check(
    "a plain build still writes dist/index.html",
    fs.statSync(path.join(ROOT, "dist/index.html")).mtimeMs >= start,
  );
} catch (e) {
  check("the builds ran: " + e.message.split("\n")[0], false);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? failed + " failed" : "all passed");
if (failed) process.exitCode = 1;
