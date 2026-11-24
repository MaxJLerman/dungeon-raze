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

// The four browser names are parameters passed nothing, so inside the host
// they are undefined, as in a Worker (Node has a global navigator of its own),
// and any use of the DOM fails here too.
export function loadHost() {
  return new Function("localStorage", "document", "window", "navigator", hostSource())();
}

// A client of a host stepped by hand. It joins at once; frames the host sends
// it arrive through host.send, which is installed here and routes by pid.
//   join    the join event's payload
//   snap    the latest decoded snapshot, nsnap how many have arrived
//   events  every decoded host event
//   at(x, z, extra)   sends a STATE frame for a player standing there
//   ev(name, ...args) sends the numbered event [name, seq, ...args]; returns seq
const CLIENTS = new WeakMap();
export function fakeClient(host, pid, cls) {
  let route = CLIENTS.get(host);
  if (!route) {
    route = new Map();
    CLIENTS.set(host, route);
    host.send = (to, buf) => {
      const c = route.get(to);
      if (c) c.take(buf);
    };
  }
  const wire = host.wire;
  let seq = 0;
  const c = {
    pid,
    join: null,
    snap: null,
    nsnap: 0,
    events: [],
    take(buf) {
      const k = wire.type(buf);
      if (k === 1) {
        c.snap = wire.snapDecode(buf);
        c.nsnap++;
      } else if (k === 3) {
        const ev = wire.eventDecode(buf);
        c.events.push(ev);
        if (ev[0] === "join") c.join = ev[1];
      }
    },
    at(x, z, extra = {}) {
      const p = {
        x,
        z,
        yaw: 0,
        vx: 0,
        vz: 0,
        state: "free",
        t: 0,
        move: null,
        hp: 1,
        maxHp: 1,
        speed: 0,
        guardT: 0,
        sprint: false,
        ...extra,
      };
      host.recv(pid, wire.stateEncode(p));
    },
    ev(name, ...args) {
      seq++;
      host.recv(pid, wire.eventEncode([name, seq, ...args]));
      return seq;
    },
  };
  route.set(pid, c);
  host.join(pid, cls);
  return c;
}

// Ticks the host at 1/60 for sec seconds, calling each(i) before every tick.
// each returning false stops early.
export function run(host, sec, each) {
  const n = Math.round(sec * 60);
  for (let i = 0; i < n; i++) {
    if (each && each(i) === false) return;
    host.tick(1 / 60);
  }
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
