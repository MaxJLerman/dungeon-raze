// The main menu in a browser that cannot start WebGL 2: the page says so
// and both Play buttons are disabled; How to play and Controls are left.
// Run with: node build.mjs && node tests/t30-nogl.mjs
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
let failed = 0;
const check = (name, ok, got) => {
  console.log((ok ? "ok   " : "FAIL ") + name + (ok || got === undefined ? "" : "\n     " + JSON.stringify(got)));
  if (!ok) failed++;
};

const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  // nothing but the file itself is fetched
  await p.route("**/*", (r) => (r.request().url().startsWith("file:") ? r.continue() : r.abort()));
  // a canvas that hands out no WebGL 2 context
  await p.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...a) {
      return kind === "webgl2" ? null : real.call(this, kind, ...a);
    };
  });
  await p.goto("file://" + ROOT + "dist/index.html");
  await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const id = (s) => document.getElementById(s);
    return {
      sub: document.querySelector("#scr-title .sub").textContent.trim(),
      solo: !!id("btnSolo") && id("btnSolo").disabled,
      online: !!id("btnCoop") && id("btnCoop").disabled,
      howto: !document.querySelector('#scr-title [data-open="howto"]').disabled,
    };
  });
  check("the main menu says the game cannot draw", /^This browser cannot start WebGL 2/.test(r.sub), r.sub);
  check("Play solo is disabled", r.solo === true, r);
  check("Play online is disabled", r.online === true, r);
  // a click on a disabled Play button goes nowhere
  await p.evaluate(() => {
    document.getElementById("btnSolo").click();
    document.getElementById("btnCoop").click();
  });
  const shown = await p.evaluate(() => [...document.querySelectorAll(".scr.show")].map((e) => e.id));
  check("no screen opens from them", shown.length === 0 || (shown.length === 1 && shown[0] === "scr-title"), shown);
  check("no page error", errs.length === 0, errs);
} finally {
  await b.close();
}
console.log(failed ? failed + " failed" : "all passed");
process.exit(failed ? 1 : 0);
