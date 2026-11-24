// Starts and stops the co-op relay (relay/worker.js) under `wrangler dev`, on
// 127.0.0.1:8787, with a clean state directory and no Cloudflare account.
// Metrics are off, and nothing here logs in, deploys or publishes.
//
//   await startRelay(vars)  starts it, with each of vars as a --var
//   await relayReady()      waits until it answers
//   await stopRelay()       stops the whole process group and removes the state
//   killRelayNow()          the same, synchronously, for an exit handler
//
// wrangler dev runs in its own process group, so that npx, node and workerd
// can all be stopped together. The group's pid is kept apart from the child,
// so stopping reaches workerd even when npx has already gone.
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export const RELAY_PORT = 8787;
export const RELAY_BASE = "http://127.0.0.1:" + RELAY_PORT;
const relayDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "relay");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let child = null;
let groupPid = null;
let stateDir = null;
let log = "";

// Fails with a plain message when something already holds the port.
function portFree() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", () =>
      reject(new Error("port " + RELAY_PORT + " is in use: see `lsof -i :" + RELAY_PORT + "` and stop what holds it")),
    );
    srv.listen(RELAY_PORT, "127.0.0.1", () => srv.close(() => resolve()));
  });
}
export async function startRelay(vars = {}) {
  await portFree();
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "relay-state-"));
  log = "";
  const flags = Object.entries(vars).flatMap(([k, v]) => ["--var", k + ":" + v]);
  child = spawn(
    "npx",
    ["wrangler", "dev", "--port", String(RELAY_PORT), "--ip", "127.0.0.1", "--persist-to", stateDir, ...flags],
    {
      cwd: relayDir,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" },
    },
  );
  groupPid = child.pid;
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  child.on("exit", () => (child = null));
}
const groupAlive = () => {
  try {
    process.kill(-groupPid, 0);
    return true;
  } catch {
    return false;
  }
};
export async function stopRelay() {
  if (groupPid !== null) {
    for (const sig of ["SIGTERM", "SIGKILL"]) {
      try {
        process.kill(-groupPid, sig);
      } catch {}
      for (let i = 0; i < 16 && groupAlive(); i++) await sleep(250);
      if (!groupAlive()) break;
    }
    groupPid = null;
  }
  if (stateDir) fs.rmSync(stateDir, { recursive: true, force: true });
  stateDir = null;
}
// Last resort, synchronous, for the exit handler.
export function killRelayNow() {
  if (groupPid !== null) {
    try {
      process.kill(-groupPid, "SIGKILL");
    } catch {}
  }
  if (stateDir) fs.rmSync(stateDir, { recursive: true, force: true });
}
// Answers on a path that is not rate limited and costs nothing.
export async function relayReady() {
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    if (!child) throw new Error("wrangler dev exited early:\n" + log);
    try {
      const r = await fetch(RELAY_BASE + "/nope");
      if (r.status === 404) return;
    } catch {}
    await sleep(300);
  }
  throw new Error("wrangler dev did not answer in 90 s:\n" + log);
}
