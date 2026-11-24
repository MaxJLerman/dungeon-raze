// The co-op relay (relay/worker.js) run locally under `wrangler dev`, with
// a clean state directory and no Cloudflare account (tests/lib/relay.mjs
// starts and stops it).
// Run with: node tests/coop-relay.mjs
import assert from "node:assert/strict";
import http from "node:http";
import { RELAY_PORT as PORT, startRelay, stopRelay, killRelayNow, relayReady } from "./lib/relay.mjs";

const BASE = "http://127.0.0.1:" + PORT;
const WS = "ws://127.0.0.1:" + PORT;
const WAIT_MS = 3000; // the first-socket window, shortened for the expiry check
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log("ok   " + name);
  } catch (e) {
    console.log("FAIL " + name + "\n     " + (e && e.message ? e.message : e));
    failed++;
  }
}

const newCode = async () => (await (await fetch(BASE + "/new", { method: "POST" })).json()).code;

// A socket that keeps what it hears. next() waits for the next frame;
// closed resolves with the close code.
function sock(code) {
  const ws = new WebSocket(WS + "/room/" + code);
  ws.binaryType = "arraybuffer";
  const q = [];
  let wake = null;
  const s = { ws, q, code: null };
  s.closed = new Promise((res) => {
    ws.addEventListener("close", (ev) => {
      s.code = ev.code;
      res(ev.code);
      wake && wake();
    });
  });
  s.opened = new Promise((res, rej) => {
    ws.addEventListener("open", res);
    ws.addEventListener("close", () => rej(new Error("socket closed before it opened")));
    setTimeout(() => rej(new Error("socket did not open in 5 s")), 5000);
  });
  s.opened.catch(() => {}); // a test that never awaits it is not an unhandled rejection
  ws.addEventListener("error", () => {});
  ws.addEventListener("message", (ev) => {
    q.push(typeof ev.data === "string" ? ev.data : Array.from(new Uint8Array(ev.data)));
    wake && wake();
  });
  s.next = async (ms = 3000) => {
    const t0 = Date.now();
    while (!q.length) {
      if (Date.now() - t0 > ms) throw new Error("no frame in " + ms + " ms (closed: " + s.code + ")");
      await new Promise((r) => {
        wake = r;
        setTimeout(r, 50);
      });
    }
    return q.shift();
  };
  s.silent = async (ms = 400) => {
    await sleep(ms);
    assert.deepEqual(q, [], "expected nothing to arrive");
  };
  s.send = (a) => ws.send(Uint8Array.from(a));
  return s;
}
// Code the socket closed with, waiting up to ms.
async function closeCode(s, ms = 3000) {
  return Promise.race([s.closed, sleep(ms).then(() => "still open")]);
}
async function pair() {
  const code = await newCode();
  const host = sock(code);
  await host.opened;
  const friend = sock(code);
  await friend.opened;
  assert.deepEqual(await host.next(), [0, 1, 2]);
  return { code, host, friend };
}
// An upgrade request with node:http, so that it can carry any Origin.
function upgrade(code, origin, ip) {
  return new Promise((resolve, reject) => {
    const req = http.request(BASE + "/room/" + code, {
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
        ...(origin ? { Origin: origin } : {}),
        ...(ip ? { "CF-Connecting-IP": ip } : {}),
      },
    });
    req.on("response", (res) => {
      res.resume();
      resolve({ status: res.statusCode });
    });
    req.on("upgrade", (res, socket) => {
      socket.destroy();
      resolve({ status: res.statusCode });
    });
    req.on("error", reject);
    req.end();
  });
}

const open = [];
const track = (s) => (open.push(s), s);

// The per-address limit, with the real counts (10 /new and 30 room requests)
// over a window shortened to 4 s so that it can be seen to end. Under
// wrangler dev every request comes from one address, unless a request names
// another in CF-Connecting-IP.
async function limitTests() {
  await startRelay({ RATE_WINDOW_MS: 4000 });
  await relayReady();
  const post = (headers = {}) => fetch(BASE + "/new", { method: "POST", headers });

  await check("the 11th POST /new in a window gets 429 and the first 10 do not", async () => {
    for (let i = 0; i < 10; i++) assert.equal((await post()).status, 200, "call " + (i + 1));
    const r = await post();
    assert.equal(r.status, 429);
    assert.ok(Number(r.headers.get("retry-after")) >= 1, "Retry-After");
    assert.equal((await post()).status, 429);
  });

  await check("a refused origin still gets 403, not 429, and another address is not limited", async () => {
    assert.equal((await post({ Origin: "https://example.com" })).status, 403);
    assert.equal((await post({ "CF-Connecting-IP": "203.0.113.9" })).status, 200);
  });

  await check("the limit ends with the window", async () => {
    await sleep(4500);
    assert.equal((await post()).status, 200);
  });

  await check("the 31st room request in a window gets 429 and the first 30 do not", async () => {
    await sleep(4500);
    for (let i = 0; i < 30; i++) assert.equal((await upgrade("ZZZZZZ", null)).status, 101, "call " + (i + 1));
    assert.equal((await upgrade("ZZZZZZ", null)).status, 429);
    // /new has its own count
    assert.equal((await post()).status, 200);
    assert.equal((await upgrade("ZZZZZZ", null, "203.0.113.9")).status, 101);
  });

  await stopRelay();
}

async function main() {
  await startRelay({ ROOM_WAIT_MS: WAIT_MS, RATE_NEW: 100000, RATE_ROOM: 100000 });
  await relayReady();

  await check("POST /new returns a six character code from the alphabet", async () => {
    const r = await fetch(BASE + "/new", { method: "POST" });
    assert.equal(r.status, 200);
    const { code } = await r.json();
    assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
    assert.notEqual(code, await newCode());
  });

  await check("every code from /new is in the alphabet over 200 calls and all differ", async () => {
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const c = await newCode();
      assert.match(c, /^[A-HJKMNP-Z2-9]{6}$/);
      seen.add(c);
    }
    assert.equal(seen.size, 200);
  });

  await check("host and friend forward to each other with the pid byte added and stripped", async () => {
    const { host, friend } = await pair();
    track(host), track(friend);
    friend.send([9, 8, 7]);
    assert.deepEqual(await host.next(), [2, 9, 8, 7]);
    host.send([2, 5, 6]);
    assert.deepEqual(await friend.next(), [5, 6]);
    // a frame for a pid that is not there goes nowhere
    host.send([1, 3, 3]);
    host.send([3, 3, 3]);
    await friend.silent();
    await host.silent(100);
    // frame bytes pass untouched, including a zero type byte
    friend.send([0, 255, 0]);
    assert.deepEqual(await host.next(), [2, 0, 255, 0]);
    // a host frame that is only its address byte carries nothing and is dropped
    host.send([2]);
    host.send([2, 7]);
    assert.deepEqual(await friend.next(), [7], "the empty payload was forwarded");
    const big = new Uint8Array(16384).map((_, i) => i & 255);
    host.ws.send(Uint8Array.from([2, ...big.subarray(0, 16383)]));
    const got = await friend.next();
    assert.equal(got.length, 16383);
    host.ws.close();
    friend.ws.close();
  });

  await check("the host hears [0,1,2] on a join and [0,2,2] on a leave, and the seat can be taken again", async () => {
    const { code, host, friend } = await pair();
    track(host), track(friend);
    friend.ws.close(1000);
    assert.deepEqual(await host.next(), [0, 2, 2]);
    const friend2 = track(sock(code));
    await friend2.opened;
    assert.deepEqual(await host.next(), [0, 1, 2]);
    friend2.send([4]);
    assert.deepEqual(await host.next(), [2, 4]);
    host.send([2, 6]);
    assert.deepEqual(await friend2.next(), [6]);
    host.ws.close();
    friend2.ws.close();
  });

  await check("a third socket closes 4001", async () => {
    const { code, host, friend } = await pair();
    track(host), track(friend);
    const third = track(sock(code));
    assert.equal(await closeCode(third), 4001);
    // the pair is not disturbed
    friend.send([1]);
    assert.deepEqual(await host.next(), [2, 1]);
    host.ws.close();
    friend.ws.close();
  });

  await check("the friend hears [0,2] when the host leaves, and the room is gone", async () => {
    const { code, host, friend } = await pair();
    track(host), track(friend);
    host.ws.close(1000);
    assert.deepEqual(await friend.next(), [0, 2]);
    friend.ws.close(1000); // what a client does on hearing it
    const late = track(sock(code));
    assert.equal(await closeCode(late), 4004);
  });

  await check("a code that /new never issued closes 4004, so does a malformed one", async () => {
    const a = track(sock("ZZZZZZ"));
    assert.equal(await closeCode(a), 4004);
    const b = track(sock("abc"));
    assert.equal(await closeCode(b), 4004);
  });

  await check("a code is good for a first socket only for the wait window", async () => {
    const code = await newCode();
    await sleep(WAIT_MS + 1500);
    const s = track(sock(code));
    assert.equal(await closeCode(s), 4004);
    // the same code, used in time, hosts
    const code2 = await newCode();
    const h = track(sock(code2));
    await h.opened;
    await sleep(WAIT_MS + 1500);
    const f = track(sock(code2));
    await f.opened;
    assert.deepEqual(await h.next(), [0, 1, 2]);
    h.ws.close();
    f.ws.close();
  });

  await check("an upgrade from another origin gets 403, an allowed or missing origin does not", async () => {
    const code = await newCode();
    assert.equal((await upgrade(code, "https://example.com")).status, 403);
    assert.equal((await upgrade(code, "https://maxjlerman.github.io.evil.com")).status, 403);
    assert.equal((await upgrade(code, "http://localhost:8000")).status, 101);
    assert.equal((await upgrade(code, "http://127.0.0.1:8123")).status, 101);
    // the host's seat is taken by the allowed upgrades above and gone with them; use a new room
    const code2 = await newCode();
    assert.equal((await upgrade(code2, "https://maxjlerman.github.io")).status, 101);
    const code3 = await newCode();
    assert.equal((await upgrade(code3, null)).status, 101);
  });

  await check("POST /new and OPTIONS answer a browser's fetch from an allowed origin and refuse others", async () => {
    for (const origin of ["http://localhost:8000", "http://127.0.0.1:9", "https://maxjlerman.github.io"]) {
      const r = await fetch(BASE + "/new", { method: "POST", headers: { Origin: origin } });
      assert.equal(r.status, 200, origin);
      assert.equal(r.headers.get("access-control-allow-origin"), origin);
      assert.match(r.headers.get("vary") || "", /Origin/i);
      assert.match((await r.json()).code, /^[A-HJKMNP-Z2-9]{6}$/);
      const p = await fetch(BASE + "/new", {
        method: "OPTIONS",
        headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
      });
      assert.ok(p.status === 204 || p.status === 200, "preflight " + p.status);
      assert.equal(p.headers.get("access-control-allow-origin"), origin);
      assert.match(p.headers.get("access-control-allow-methods") || "", /POST/);
    }
    const bad = await fetch(BASE + "/new", { method: "POST", headers: { Origin: "https://example.com" } });
    assert.equal(bad.status, 403);
    assert.equal(bad.headers.get("access-control-allow-origin"), null);
    const badPre = await fetch(BASE + "/new", {
      method: "OPTIONS",
      headers: { Origin: "https://example.com", "Access-Control-Request-Method": "POST" },
    });
    assert.equal(badPre.status, 403);
    const none = await fetch(BASE + "/new", { method: "POST" });
    assert.equal(none.status, 200);
  });

  await check("a 20,000 byte frame closes the sender 4009 and the host is told", async () => {
    const { host, friend } = await pair();
    track(host), track(friend);
    friend.ws.send(new Uint8Array(20000));
    assert.equal(await closeCode(friend), 4009);
    assert.deepEqual(await host.next(), [0, 2, 2]);
    host.ws.close();
  });

  await check("a frame of 16,384 bytes goes through and one of 16,385 does not", async () => {
    const { host, friend } = await pair();
    track(host), track(friend);
    friend.ws.send(new Uint8Array(16383)); // plus the pid byte makes 16,384 to the host
    assert.equal((await host.next()).length, 16384);
    friend.ws.send(new Uint8Array(16384));
    assert.equal((await host.next()).length, 16385, "the limit is on the frame the sender sent: 16,384");
    friend.ws.send(new Uint8Array(16385));
    assert.equal(await closeCode(friend), 4009);
    host.ws.close();
  });

  await check("more than 120 frames in a second closes the sender 4008, 100 do not", async () => {
    const { host, friend } = await pair();
    track(host), track(friend);
    for (let i = 0; i < 100; i++) friend.send([1, i]);
    for (let i = 0; i < 100; i++) assert.deepEqual(await host.next(), [2, 1, i]);
    assert.equal(friend.code, null, "100 frames in a second are fine");
    await sleep(1200);
    for (let i = 0; i < 200; i++) friend.send([1, i & 255]);
    assert.equal(await closeCode(friend), 4008);
    // the host got what passed, then hears the friend go
    let last;
    do last = await host.next();
    while (last[0] === 2);
    assert.deepEqual(last, [0, 2, 2]);
    host.ws.close();
  });

  await check("the host is held to the same rate", async () => {
    const { host, friend } = await pair();
    track(host), track(friend);
    for (let i = 0; i < 200; i++) host.send([2, i & 255]);
    assert.equal(await closeCode(host), 4008);
    // the host going ends the room; the friend gets what passed, then hears it
    let last;
    do last = await friend.next();
    while (last.length === 1);
    assert.deepEqual(last, [0, 2]);
  });

  await check("a text frame closes the sender 1003", async () => {
    const { host, friend } = await pair();
    track(host), track(friend);
    friend.ws.send("hello");
    assert.equal(await closeCode(friend), 1003);
    host.ws.close();
  });

  await check("other paths and methods are refused", async () => {
    assert.equal((await fetch(BASE + "/nope")).status, 404);
    assert.equal((await fetch(BASE + "/new")).status, 405);
    assert.equal((await fetch(BASE + "/room/ABCDEF")).status, 426);
  });
}

// Whatever goes wrong, the server goes with it.
const WATCHDOG_MS = 150000;
async function bail(why, code) {
  console.log("FAIL harness\n     " + why);
  killRelayNow();
  process.exit(code);
}
setTimeout(() => bail("the test ran past " + WATCHDOG_MS / 1000 + " s", 1), WATCHDOG_MS).unref();
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => bail(sig, 130));
process.on("uncaughtException", (e) => bail("uncaught: " + (e && e.stack ? e.stack : e), 1));
process.on("unhandledRejection", (e) => bail("unhandled rejection: " + (e && e.stack ? e.stack : e), 1));
process.on("exit", killRelayNow);

try {
  await limitTests();
  await main();
} catch (e) {
  console.log("FAIL harness\n     " + (e && e.message ? e.message : e));
  failed++;
} finally {
  for (const s of open) try { s.ws.close(); } catch {}
  await stopRelay();
}
console.log(failed ? failed + " failed" : "all passed");
process.exit(failed ? 1 : 0);
