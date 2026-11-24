// Shared helpers for the co-op Node tests.
// loadHost() reads dist/index.html, pulls out COOP_HOST_SRC (the headless copy
// of the simulation that build.mjs embeds) and evaluates it as the page does.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

export function hostSource() {
  const html = fs.readFileSync(ROOT + "dist/index.html", "utf8");
  const m = html.match(/^const COOP_HOST_SRC = (".*");$/m);
  if (!m) throw new Error("COOP_HOST_SRC not found in dist/index.html");
  return JSON.parse(m[1]);
}

export function loadHost() {
  const noop = () => {};
  const store = { getItem: () => null, setItem: noop, removeItem: noop };
  return new Function("localStorage", "document", "window", "navigator", hostSource())(
    store,
    {},
    {},
    {},
  );
}

let failed = 0;
export function check(name, fn) {
  try {
    fn();
    console.log("ok   " + name);
  } catch (e) {
    console.log("FAIL " + name + "\n     " + (e && e.message ? e.message : e));
    failed++;
  }
}

export function done() {
  console.log(failed ? failed + " failed" : "all passed");
  if (failed) process.exitCode = 1;
}
