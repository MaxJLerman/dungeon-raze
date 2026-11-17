// Runs test.mjs once per emulated device: node tests/touch-all.mjs <script> [mode]
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import devices from "./devices.mjs";
const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const script = process.argv[2];
const mode = process.argv[3] || "smoke";
if (!script) {
  console.log("usage: node tests/touch-all.mjs <script> [mode]");
  process.exit(2);
}
const abs = path.resolve(script);
let bad = 0;
for (const d of devices) {
  const r = spawnSync("node", ["test.mjs", mode], {
    cwd: ROOT,
    env: { ...process.env, DEVICE: d.id, SCRIPT: abs },
    encoding: "utf8",
  });
  const ok = r.status === 0;
  if (!ok) bad++;
  const out = (r.stdout || "") + (r.stderr || "");
  const fails = out
    .split("\n")
    .filter((l) => /^FAIL|PAGEERROR|ERRORS/.test(l))
    .join("; ");
  console.log(
    (ok ? "ok   " : "FAIL ") + d.id.padEnd(18) + `${d.w}x${d.h}` + (ok ? "" : "  " + fails),
  );
  if (!ok && process.env.VERBOSE) console.log(out);
}
console.log(bad ? bad + " of " + devices.length + " devices failed" : "all " + devices.length + " devices passed");
process.exit(bad ? 1 : 0);
