// Co-op end to end: the built page served from dist/ on localhost:8123, the
// relay under wrangler dev on localhost:8787, and several Chromium pages
// hosting, joining by code and by invite link, and picking classes. Every HTTP request but to localhost is
// aborted. Playwright's routing does not see WebSockets: the only socket
// address the pages are given is the local relay (DF.coopRelay).
// Run with: node build.mjs && node tests/coop-e2e.mjs
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startRelay, stopRelay, killRelayNow, relayReady } from "./lib/relay.mjs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const PORT = 8123;
const PAGE = "http://localhost:" + PORT + "/";
const RELAY = "ws://localhost:8787";
const CODE_RE = /^[A-HJKMNP-Z2-9]{6}$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log("ok   " + name);
  } catch (e) {
    console.log("FAIL " + name + "\n     " + (e && e.message ? e.message.split("\n").slice(0, 6).join("\n     ") : e));
    failed++;
  }
}
// Waits until fn() (run in node) returns something truthy, and returns it.
async function until(what, fn, ms = 15000, every = 100) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) throw new Error("timed out after " + ms + " ms waiting for " + what);
    await sleep(every);
  }
}

// ---- the page server: dist/ and nothing else ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".png": "image/png" };
let server = null;
function serve() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, "http://localhost");
      const rel = u.pathname === "/" ? "index.html" : decodeURIComponent(u.pathname.slice(1));
      const f = path.join(DIST, rel);
      if (!f.startsWith(DIST + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(f).pipe(res);
    });
    server.once("error", (e) =>
      reject(new Error("port " + PORT + " is in use: see `lsof -i :" + PORT + "` (" + e.code + ")")),
    );
    server.listen(PORT, "127.0.0.1", resolve);
  });
}
function unserve() {
  if (!server) return Promise.resolve();
  const s = server;
  server = null;
  s.closeAllConnections && s.closeAllConnections();
  return new Promise((r) => s.close(() => r()));
}

// ---- the pages ----
let browser = null;
const pages = [];
const errs = [];
// Counts Workers (and their terminate calls) and keeps every WebSocket, so a
// step can see what the page made. Runs before the page's own script.
function counters() {
  const W = window.Worker;
  window.__workers = [];
  window.Worker = function (...a) {
    const w = new W(...a);
    window.__workers.push(w);
    const t = w.terminate.bind(w);
    w.terminate = () => {
      w.__dead = true;
      t();
    };
    return w;
  };
  window.Worker.prototype = W.prototype;
  const S = window.WebSocket;
  window.__socks = [];
  window.WebSocket = function (...a) {
    const s = new S(...a);
    window.__socks.push(s);
    return s;
  };
  Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  window.WebSocket.prototype = S.prototype;
}
// Rewrites this page's hello to carry version 0, as an older build would.
function versionZero() {
  const send = WebSocket.prototype.send;
  WebSocket.prototype.send = function (d) {
    try {
      const b = new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer);
      if (b[0] === 3) {
        const ev = JSON.parse(new TextDecoder().decode(b.subarray(1)));
        if (ev[0] === "hello") {
          ev[2] = 0;
          const j = new TextEncoder().encode(JSON.stringify(ev)),
            o = new Uint8Array(j.length + 1);
          o[0] = 3;
          o.set(j, 1);
          return send.call(this, o.buffer);
        }
      }
    } catch {}
    return send.call(this, d);
  };
}
async function openPage(name, { v0 = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
  // HTTP to this machine only: the page and the relay (WebSockets pass by
  // routing; the only address the pages are given for one is the local relay)
  await ctx.route("**/*", (r) => {
    const u = r.request().url();
    return /^(http|ws):\/\/(localhost|127\.0\.0\.1):(8123|8787)\//.test(u) ? r.continue() : r.abort();
  });
  await ctx.addInitScript(counters);
  if (v0) await ctx.addInitScript(versionZero);
  const p = await ctx.newPage();
  p.on("console", (m) => {
    if (m.type() === "error" && !/ERR_|Failed to load resource/.test(m.text())) errs.push(name + ": " + m.text());
  });
  p.on("pageerror", (e) => errs.push(name + ": PAGEERROR " + e.message));
  // Play online needs nothing in the address. A friend's page keeps the
  // old ?coop=1, which links already sent still carry and which does nothing.
  await p.goto(PAGE + (/friend/i.test(name) ? "?coop=1" : ""));
  await prep(p);
  pages.push(p);
  p.__name = name;
  return p;
}
async function prep(p) {
  await p.waitForFunction(() => window.DF && DF.G && DF.G.world, null, { timeout: 30000 });
  await p.evaluate((relay) => {
    DF.coopRelay(relay);
    DF.coopSeed(99);
    // a refused pointer lock would pause play; this test has no pointer
    DF.G.noLock = true;
  }, RELAY);
}
const msg = (p) =>
  p.evaluate(() => {
    const el = document.getElementById("coopMsg");
    return el && !el.hidden && el.getClientRects().length ? el.textContent : "";
  });
const state = (p) => p.evaluate(() => DF.G.state);
// Play online on the main menu goes straight to the room screen
async function toRoom(p) {
  await p.click("#btnCoop");
}
// Picks a class card on the room screen (the cards show once in the room).
async function pickCls(p, cls) {
  await until(p.__name + "'s class cards", () =>
    p.evaluate(() => document.getElementById("coopCls").getClientRects().length > 0),
  );
  await p.click('#coopCls .card[data-cls="' + cls + '"]');
}
// The class in each slot, this page's first: "" for one not here.
const slotCls = (p) =>
  p.evaluate(() => [...document.querySelectorAll("#coopSlots .slot")].map((s) => s.dataset.cls || ""));
async function hostRoom(p) {
  await toRoom(p);
  // two clicks before the first has answered
  await p.evaluate(() => {
    const b = document.getElementById("coopHost");
    b.click();
    b.click();
  });
  const code = await until("a room code", () =>
    p.evaluate(() => {
      const el = document.getElementById("coopShow");
      return el && el.getClientRects().length ? el.textContent.trim() : "";
    }).then((t) => (/^[A-Z0-9]{6}$/.test(t) ? t : "")),
  );
  await p.evaluate(() => document.getElementById("coopHost").click());
  return code;
}
async function joinRoom(p, code) {
  await toRoom(p);
  await p.fill("#coopCode", code.toLowerCase().slice(0, 3) + "-" + code.toLowerCase().slice(3));
  await p.click("#coopJoin");
}
async function enter(p) {
  await until(p.__name + "'s enter button", () => p.evaluate(() => !document.getElementById("coopEnter").disabled));
  await p.click("#coopEnter");
  await until(p.__name + " in play", () => p.evaluate(() => DF.G.state === "play" && !!DF.net() && DF.net().live));
}
const slots = (p) =>
  p.evaluate(() => [...document.querySelectorAll("#coopSlots .slot[data-cls]")].map((s) => s.dataset.cls));
const info = (p) =>
  p.evaluate(() => ({
    state: DF.G.state,
    net: !!DF.net(),
    enemies: DF.G.enemies.length,
    sum: DF.coopWorldSum(DF.G.world),
    seed: DF.G.seed,
  }));

async function main() {
  await serve();
  await startRelay({});
  await relayReady();
  browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
  });
  const host = await openPage("host");
  let friend = await openPage("friend");
  let code = null;

  await check("the host makes a room and a second click makes no second Worker", async () => {
    assert.equal(await state(host), "title");
    code = await hostRoom(host);
    assert.match(code, CODE_RE);
    await sleep(300);
    const n = await host.evaluate(() => window.__workers.length);
    assert.equal(n, 1, "Workers made");
    const enterText = await host.evaluate(() => document.getElementById("coopEnter").textContent.trim());
    assert.equal(enterText, "Start");
    // the friend cannot have touched the network yet
    assert.equal(await friend.evaluate(() => window.__socks.length + window.__workers.length), 0);
  });

  await check("the friend joins by code and both pages show two classes", async () => {
    await joinRoom(friend, code);
    assert.equal(await friend.inputValue("#coopCode"), code, "the code is tidied");
    await until("two slots on both pages", async () => (await slots(host)).length === 2 && (await slots(friend)).length === 2);
    const a = await slots(host),
      b = await slots(friend);
    assert.deepEqual([...a].sort(), [...b].sort());
    assert.equal(await msg(friend), "");
    // the host has not pressed Start: the friend waits, and still does a moment later
    await sleep(1000);
    const btn = () => friend.evaluate(() => { const b = document.getElementById("coopEnter"); return { text: b.textContent.trim(), off: b.disabled }; });
    assert.deepEqual(await btn(), { text: "Waiting for the host to start", off: true });
  });

  await check("each picks a class in the room and the other page shows it", async () => {
    await pickCls(friend, "tanker");
    await until("the host to show the friend's class", async () => (await slotCls(host))[1] === "tanker");
    assert.equal((await slotCls(friend))[0], "tanker");
    await pickCls(host, "mage");
    await until("the friend to show the host's class", async () => (await slotCls(friend))[1] === "mage");
    assert.deepEqual(await slotCls(host), ["mage", "tanker"]);
    // a second thought, before entering
    await pickCls(friend, "ranger");
    await until("the host to show the change", async () => (await slotCls(host))[1] === "ranger");
    assert.deepEqual(await slotCls(friend), ["ranger", "mage"]);
    // still waiting on the host, and nothing was said
    assert.equal(await msg(friend), "");
    assert.equal(await msg(host), "");
  });

  await check("both enter: in play, 47 enemies each and the same cave", async () => {
    await enter(host);
    // the host's Start lets the friend in
    await until("the friend's button to read Enter the cave", () =>
      friend.evaluate(() => { const b = document.getElementById("coopEnter"); return !b.disabled && b.textContent.trim() === "Enter the cave"; }),
    );
    await enter(friend);
    const a = await info(host),
      b = await info(friend);
    assert.equal(a.state, "play");
    assert.equal(b.state, "play");
    assert.ok(a.net && b.net, "NET on both");
    assert.equal(a.enemies, 47);
    assert.equal(b.enemies, 47);
    assert.equal(a.seed, 99);
    assert.equal(a.sum, b.sum);
    // each plays what it picked, and is drawn as that on the other page
    const who = (p) => p.evaluate(() => [DF.G.player.clsId, DF.net().mates.map((m) => m.clsId).join()]);
    assert.deepEqual(await who(host), ["mage", "ranger"]);
    assert.deepEqual(await who(friend), ["ranger", "mage"]);
  });

  await check("a class changed from the pause menu mid-run shows on the other page", async () => {
    // Pause, Change class, a card, Back, Resume, as a player would
    const change = (p, cls) =>
      p.evaluate((cls) => {
        DF.show("pause");
        document.querySelector('#scr-pause [data-open="class"]').click();
        document.querySelector('#scr-class .card[data-cls="' + cls + '"]').click();
        document.querySelector("#scr-class [data-back]").click();
        DF.show("play");
        return DF.G.player.clsId;
      }, cls);
    const mate = (p) => p.evaluate(() => (DF.net() && DF.net().mates[0] ? DF.net().mates[0].clsId : ""));
    assert.equal(await change(friend, "assassin"), "assassin");
    await until("the host to see the friend's new class", async () => (await mate(host)) === "assassin");
    assert.equal(await change(host, "tanker"), "tanker");
    await until("the friend to see the host's new class", async () => (await mate(friend)) === "tanker");
    // both are still in the same run
    assert.equal(await state(host), "play");
    assert.equal(await state(friend), "play");
    assert.equal((await info(friend)).enemies, 47);
  });

  await check("the host's pause screen shows the room code while the relay is up; the friend's does not", async () => {
    const shownCode = (p) =>
      p.evaluate(async () => {
        DF.show("pause");
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const el = document.getElementById("pauseCode"),
          t = el && !el.hidden && el.getClientRects().length ? el.textContent.replace(/\s+/g, " ").trim() : "";
        DF.show("play");
        return t;
      });
    assert.equal(await until("the host's code on its pause screen", async () => (await shownCode(host)) || ""), "Room code " + code);
    assert.equal(await shownCode(friend), "");
  });

  await check("the host walks and the friend sees them move more than 2 m", async () => {
    await until("the friend hears the host", () => friend.evaluate(() => DF.net() && DF.net().mates.length === 1 && !DF.net().mates[0].away), 10000);
    const m0 = await friend.evaluate(() => ({ x: DF.net().mates[0].x, z: DF.net().mates[0].z }));
    // walk toward the next chamber on the way to the boss, steering by a route
    await host.evaluate(() => {
      const { G } = DF,
        w = G.world,
        p = G.player,
        goal = w.nodes[w.path[Math.min(2, w.path.length - 1)]];
      let way = w.route(p.x, p.z, goal.x, goal.z, p.r) || [];
      window.__steer = setInterval(() => {
        way = way.filter((q) => Math.hypot(q.x - p.x, q.z - p.z) > 1);
        const q = way[0] || goal;
        DF.cam.yaw = Math.atan2(q.x - p.x, q.z - p.z);
        DF.keys[DF.BIND.fwd] = true;
      }, 50);
    });
    await sleep(3000);
    const moved = await until(
      "the friend to see the host 2 m away",
      () =>
        friend.evaluate((m0) => {
          const m = DF.net().mates[0];
          const d = Math.hypot(m.x - m0.x, m.z - m0.z);
          return d > 2 ? d : 0;
        }, m0),
      20000,
    );
    await host.evaluate(() => {
      clearInterval(window.__steer);
      DF.keys[DF.BIND.fwd] = false;
    });
    assert.ok(moved > 2, "moved " + moved);
  });

  await check("a page whose hello is from another version is told so", async () => {
    // the friend's seat is taken: free it by reloading the friend
    await friend.reload();
    await until("the host to see the friend go", () => host.evaluate(() => DF.net() && DF.net().mates.length === 0), 15000);
    const old = await openPage("old", { v0: true });
    await joinRoom(old, code);
    await until("the versions message", async () => (await msg(old)) !== "", 15000);
    assert.equal(await msg(old), "You and the host are on different versions of the game. Both reload the page.");
    assert.equal(await old.evaluate(() => DF.net()), null);
    assert.equal(await old.evaluate(() => DF.G.zone), "hub");
    // its socket is closed, so the seat is free again
    await until("the old page's socket to close", () => old.evaluate(() => window.__socks.every((s) => s.readyState === 3)), 10000);
    await old.context().close();
    pages.splice(pages.indexOf(old), 1);
  });

  await check("the friend comes back by the host's invite link, picks a class and enters", async () => {
    // the link as the host's pause screen copies it
    const link = await host.evaluate(async () => {
      const got = [];
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => (got.push(t), Promise.resolve()) } });
      DF.show("pause");
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      document.getElementById("pauseCopyLink").click();
      await new Promise((r) => setTimeout(r, 50));
      delete navigator.clipboard;
      DF.show("play");
      return got.join();
    });
    assert.equal(link, PAGE + "?room=" + code);
    await friend.goto(link);
    await prep(friend);
    friend.__name = "friend";
    // the room screen, the code filled in, and nothing sent yet
    assert.equal(await state(friend), "coop");
    assert.equal(await friend.inputValue("#coopCode"), code);
    assert.equal(await friend.evaluate(() => window.__socks.length + window.__workers.length), 0);
    assert.equal(await friend.evaluate(() => document.activeElement && document.activeElement.id), "coopJoin");
    await friend.click("#coopJoin");
    // the run is under way: the class can still be picked before entering
    await pickCls(friend, "fighter");
    await until("the host to see the friend's new class", () =>
      host.evaluate(() => DF.net() && DF.net().mates.length === 1 && DF.net().mates[0].clsId === "fighter"),
    );
    await enter(friend);
    assert.equal(await friend.evaluate(() => DF.G.player.clsId), "fighter");
    const b = await info(friend);
    assert.equal(b.enemies, 47);
    assert.ok(b.net);
    assert.equal(b.sum, (await info(host)).sum);
    await until("each sees the other", async () =>
      (await host.evaluate(() => DF.net() && DF.net().mates.length === 1)) &&
      (await friend.evaluate(() => DF.net() && DF.net().mates.length === 1 && !DF.net().mates[0].away)),
    );
  });

  await check("a host page that stops drawing keeps the dungeon running and is marked away", async () => {
    const away0 = await friend.evaluate(() => DF.CC.snap.players.find((q) => q.pid === 1).away);
    assert.equal(away0, false, "the host is there before");
    // what a hidden tab does: no more animation frames on the host's page
    await host.evaluate(() => {
      window.requestAnimationFrame = () => 0;
    });
    const t0 = Date.now(),
      est = [await friend.evaluate(() => DF.CC.est)];
    let awayAt = null;
    while (Date.now() - t0 < 5000) {
      await sleep(250);
      const r = await friend.evaluate(() => ({ est: DF.CC.est, away: DF.CC.snap.players.find((q) => q.pid === 1).away, state: DF.G.state }));
      est.push(r.est);
      if (r.away && awayAt === null) awayAt = (Date.now() - t0) / 1000;
      assert.equal(r.state, "play");
    }
    for (let i = 1; i < est.length; i++) assert.ok(est[i] >= est[i - 1], "the host's clock went back at sample " + i);
    assert.ok(est[est.length - 1] - est[0] > 3.5, "the host's clock rose " + (est[est.length - 1] - est[0]) + " s in 5 s");
    assert.ok(awayAt !== null, "the host was never marked away");
    assert.ok(awayAt >= 1.75 && awayAt <= 4, "marked away after " + awayAt + " s");
    assert.equal(await friend.evaluate(() => DF.net().mates[0].away), true);
  });

  await check("a third page joining is told the room is full", async () => {
    const third = await openPage("third");
    await joinRoom(third, code);
    await until("the full message", async () => (await msg(third)) !== "", 15000);
    assert.equal(await msg(third), "That room is full.");
    assert.equal(await third.evaluate(() => DF.net()), null);
    assert.equal(await third.evaluate(() => DF.CC.link), null);
    await third.context().close();
    pages.splice(pages.indexOf(third), 1);
  });

  await check("the host page closes: the friend is told within 12 s", async () => {
    const t0 = Date.now();
    await host.context().close();
    pages.splice(pages.indexOf(host), 1);
    await until(
      "the friend on the title screen",
      async () => (await state(friend)) === "title" && (await msg(friend)) === "The host has left.",
      12000,
    );
    assert.equal(await friend.evaluate(() => DF.net()), null);
    assert.equal(await friend.evaluate(() => DF.G.zone), "hub");
    await until("the friend's socket to close", () => friend.evaluate(() => window.__socks.every((s) => s.readyState === 3)), 5000);
    console.log("     told after " + ((Date.now() - t0) / 1000).toFixed(1) + " s");
  });

  await check("after the gate: both in the hall, the room still open, and the friend still sees the host", async () => {
    const host2 = await openPage("host2");
    const code2 = await hostRoom(host2);
    assert.notEqual(code2, code);
    // opening the room screen clears the last message
    await joinRoom(friend, code2);
    assert.equal(await msg(friend), "");
    await enter(host2);
    await enter(friend);
    // the host's player kills the Warden through proposed hits, then asks for
    // the gate
    await until(
      "the Warden dead on the host's page",
      () =>
        host2.evaluate(() => {
          const e = DF.G.enemies.find((o) => o.def.boss);
          if (!e) return false;
          if (!e.dead && DF.net()) DF.hitEnemy(e, 100, 0, { src: "melee" });
          return DF.G.bossDead;
        }),
      20000,
      300,
    );
    await host2.evaluate(() => DF.net().onGate());
    const said = {};
    const hall = (p) =>
      p.evaluate(() => {
        const { G } = DF;
        return {
          in: G.zone === "hub" && !G.trans && G.state === "play" && !!DF.net() && DF.net().live,
          out: G.msgs.some((m) => m.text === "OUT ALIVE"),
        };
      });
    await until(
      "both in the hall",
      async () => {
        const a = await hall(host2),
          b = await hall(friend);
        said.host = said.host || a.out;
        said.friend = said.friend || b.out;
        return a.in && b.in;
      },
      10000,
    );
    assert.equal(said.host && said.friend, true, "OUT ALIVE on both");
    assert.equal(await host2.evaluate(() => window.__workers.length === 1 && !window.__workers[0].__dead), true, "the Worker ended");
    const a = await info(host2),
      b = await info(friend);
    assert.equal(a.sum, b.sum);
    // the friend still sees the host, who walks into the hall
    await until("the friend hears the host in the hall", () => friend.evaluate(() => DF.net().mates.length === 1 && !DF.net().mates[0].away), 10000);
    const m0 = await friend.evaluate(() => ({ x: DF.net().mates[0].x, z: DF.net().mates[0].z }));
    await host2.evaluate(() => {
      DF.cam.yaw = DF.G.player.yaw;
      DF.keys[DF.BIND.fwd] = true;
    });
    const moved = await until(
      "the friend to see the host 1.5 m away",
      () =>
        friend.evaluate((m0) => {
          const m = DF.net().mates[0];
          const d = Math.hypot(m.x - m0.x, m.z - m0.z);
          return d > 1.5 ? d : 0;
        }, m0),
      15000,
    );
    await host2.evaluate(() => (DF.keys[DF.BIND.fwd] = false));
    assert.ok(moved > 1.5, "moved " + moved);
    // both leave: the friend first, then the host, whose exit closes the room
    for (const p of [friend, host2])
      await p.evaluate(() => {
        DF.show("pause");
        document.getElementById("btnExit").click();
      });
    await until("the host's Worker terminated", () => host2.evaluate(() => window.__workers.every((w) => w.__dead === true)), 5000);
  });

  // Exit to main menu, on two fresh pages that are never reloaded
  const host3 = await openPage("host3");
  const friend3 = await openPage("friend3");
  const exit = (p) =>
    p.evaluate(() => {
      DF.show("pause");
      document.getElementById("btnExit").click();
    });
  let code3 = "";
  await check("the friend exits to the main menu: the host plays on", async () => {
    code3 = await hostRoom(host3);
    await joinRoom(friend3, code3);
    await enter(host3);
    await enter(friend3);
    await until("the host to see the friend", () => host3.evaluate(() => DF.net().mates.length === 1), 15000);
    await exit(friend3);
    assert.equal(await state(friend3), "title");
    // leaving by choice says nothing
    assert.equal(await msg(friend3), "");
    assert.equal(await friend3.evaluate(() => DF.net()), null);
    assert.equal(await friend3.evaluate(() => DF.G.zone), "hub");
    await until("the host to see the friend go", () => host3.evaluate(() => !!DF.net() && DF.net().mates.length === 0), 15000);
    await sleep(2000);
    assert.equal(await host3.evaluate(() => DF.G.state === "play" && !!DF.net() && DF.net().live), true);
    assert.equal(await msg(host3), "");
  });

  await check("the host exits to the main menu: the room closes and the friend is told", async () => {
    // back in with the same code, with no reload
    await joinRoom(friend3, code3);
    await enter(friend3);
    await exit(host3);
    assert.equal(await state(host3), "title");
    assert.equal(await msg(host3), "");
    assert.equal(await host3.evaluate(() => DF.net()), null);
    await until("the host's Worker terminated", () => host3.evaluate(() => window.__workers.every((w) => w.__dead === true)), 5000);
    await until(
      "the friend on the main menu, told",
      async () => (await state(friend3)) === "title" && (await msg(friend3)) === "The host has left.",
      12000,
    );
    assert.equal(await friend3.evaluate(() => DF.net()), null);
  });

  await check("a second room on the same two pages, with no reload", async () => {
    const code4 = await hostRoom(host3);
    assert.match(code4, CODE_RE);
    assert.notEqual(code4, code3);
    await joinRoom(friend3, code4);
    // opening the room screen cleared "The host has left."
    assert.equal(await msg(friend3), "");
    await enter(host3);
    await enter(friend3);
    await until("each to see the other", async () =>
      (await host3.evaluate(() => DF.net().mates.length === 1)) && (await friend3.evaluate(() => DF.net().mates.length === 1)), 15000);
    const a = await info(host3), b = await info(friend3);
    assert.equal(a.sum, b.sum);
    assert.equal(a.state, "play");
    assert.equal(b.state, "play");
  });
}

// Whatever goes wrong, the servers and the browser go with it.
const WATCHDOG_MS = 420000;
async function bail(why, code) {
  console.log("FAIL harness\n     " + why);
  killRelayNow();
  try {
    if (server) server.close();
  } catch {}
  try {
    if (browser) await Promise.race([browser.close(), sleep(3000)]);
  } catch {}
  process.exit(code);
}
setTimeout(() => bail("the test ran past " + WATCHDOG_MS / 1000 + " s", 1), WATCHDOG_MS).unref();
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => bail(sig, 130));
process.on("uncaughtException", (e) => bail("uncaught: " + (e && e.stack ? e.stack : e), 1));
process.on("unhandledRejection", (e) => bail("unhandled rejection: " + (e && e.stack ? e.stack : e), 1));
process.on("exit", killRelayNow);

try {
  await main();
} catch (e) {
  console.log("FAIL harness\n     " + (e && e.message ? e.message : e));
  failed++;
} finally {
  if (browser) await browser.close().catch(() => {});
  await unserve();
  await stopRelay();
}
if (errs.length) {
  console.log("ERRORS:\n" + errs.join("\n"));
  failed++;
}
console.log(failed ? failed + " failed" : "all passed");
process.exit(failed ? 1 : 0);
