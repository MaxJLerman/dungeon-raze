import fs from "node:fs";
import { fileURLToPath } from "node:url";
// set PLAYWRIGHT_MODULE to a full path if playwright is not resolvable from here
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const ROOT = fileURLToPath(new URL(".", import.meta.url));
// modes: "title" stays on the main menu, "hub" plays solo and stays in the
// hall, "smoke" clicks play and then enters a cave.
const mode = process.argv[2] || "smoke";
fs.mkdirSync(ROOT + "shots", { recursive: true });
const b = await chromium.launch({
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
// DEVICE=<id from tests/devices.mjs> emulates a phone or tablet with touch
let dev = null,
  p;
if (process.env.DEVICE) {
  dev = (await import("./tests/devices.mjs")).default.find(
    (d) => d.id === process.env.DEVICE,
  );
  if (!dev) throw new Error("unknown DEVICE " + process.env.DEVICE);
  const ctx = await b.newContext({
    viewport: { width: dev.w, height: dev.h },
    deviceScaleFactor: dev.dpr,
    isMobile: true,
    hasTouch: true,
  });
  p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await p.exposeFunction("__touch", (type, touchPoints) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints }),
  );
  await p.exposeFunction("__viewport", (w, h) =>
    p.setViewportSize({ width: w, height: h }),
  );
  await p.addInitScript((ins) => {
    window.__fakeInsets = ins;
  }, dev.ins);
} else p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on("console", (m) => {
  if (m.type() === "error" && !/ERR_|Failed to load resource/.test(m.text()))
    errs.push(m.text());
});
p.on("pageerror", (e) =>
  errs.push(
    "PAGEERROR " +
      e.message +
      "\n" +
      (e.stack || "").split("\n").slice(0, 4).join("\n"),
  ),
);
await p.route("**/*", (r) =>
  r.request().url().startsWith("file:") ? r.continue() : r.abort(),
);
await p.goto("file://" + ROOT + "dist/index.html");
await p.waitForTimeout(1500);
const shot = (n) =>
  p.screenshot({ path: `${ROOT}shots/${dev ? dev.id + "-" : ""}${n}.png` });
await shot("title");
if (mode !== "title") {
  // a phone taps; a mouse click would count as a mouse and turn touch mode off
  // Play solo on the main menu, then Enter the hall on the class screen
  for (const b of ["#btnSolo", "#btnPlay"]) {
    if (dev) await p.tap(b);
    else await p.click(b);
    await p.waitForTimeout(300);
  }
  await p.waitForTimeout(300);
  if (mode === "smoke")
    await p.evaluate(() => {
      if (DF.enterCave) DF.enterCave("E");
    });
  const info = await p.evaluate(() => {
    const { G } = DF;
    return {
      state: G.state,
      noLock: G.noLock,
      tris: G.world.pos.length / 9,
      enemies: G.enemies.length,
      lights: G.world.lights.length,
      shrines: G.world.shrines.length,
      edges: G.world.edges.length,
      path: G.world.path,
      draws: DF.R.stats.draws,
    };
  });
  console.log(JSON.stringify(info));
  await shot("play0");
}
let failed = 0;
if (process.env.SCRIPT) {
  const steps = (await import(process.env.SCRIPT)).default;
  for (const s of steps) {
    if (s.eval) {
      let r;
      try {
        r = await p.evaluate(s.eval);
      } catch (e) {
        r = { pass: false, threw: e.message.split("\n")[0] };
      }
      if (r !== undefined && !s.after) console.log(s.name || "eval", JSON.stringify(r));
      // a step may hand its result to node, to print or save it
      if (s.after) await s.after(r);
      // a step that reports a pass at all must report true
      if (r && typeof r === "object" && "pass" in r && r.pass !== true) {
        console.log("FAIL " + (s.name || "eval"));
        failed++;
      }
    }
    if (s.wait) await p.waitForTimeout(s.wait);
    if (s.shot) await shot(s.shot);
  }
}
console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "no errors");
console.log(failed || errs.length ? failed + " failed" : "all passed");
if (failed || errs.length) process.exitCode = 1;
await b.close();
