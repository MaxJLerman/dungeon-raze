// The dev menu is in the local build and nowhere in the release build; the
// co-op build stamp; and the host copy names nothing of the client's or the
// screen's files but what is on a short list.
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

// The host copy is files 01 to 06d. Anything it calls from a later file
// (07 on: the client, drawing, the HUD, input, the screens) is not there
// in a Worker or in Node, so a call that can run on the host throws. These
// are the names it may hold all the same, each with why it never runs there.
// A new one fails the test until it is guarded and listed.
const HOST_MAY_NAME = {
  coopEnd: "enterHub calls it only when NET.client, never true on the host",
  setEm: "only the EPOSE pose functions call it, and the host draws nothing",
  sinkInWater: "only the EPOSE pose functions call it, and the host draws nothing",
};
// Source with comments, strings, regular expressions and object keys taken
// out, so only code is searched.
function codeOnly(src) {
  let out = "",
    prev = "",
    i = 0;
  while (i < src.length) {
    const c = src[i],
      d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && d === "*") {
      const e = src.indexOf("*/", i + 2);
      i = e < 0 ? src.length : e + 2;
      out += " ";
    } else if (c === '"' || c === "'" || c === "`") {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
      i++;
      out += '""';
      prev = '"';
    } else if (c === "/" && (prev === "" || "(,=:[!&|?{};".includes(prev))) {
      let cls = false;
      for (i++; i < src.length && (src[i] !== "/" || cls); i++) {
        if (src[i] === "\\") i++;
        else if (src[i] === "[") cls = true;
        else if (src[i] === "]") cls = false;
      }
      i++;
      while (/[a-z]/.test(src[i] || "")) i++;
      out += "R";
      prev = "R";
    } else {
      out += c;
      if (!/\s/.test(c)) prev = c;
      i++;
    }
  }
  return out.replace(/([{,]\s*)[A-Za-z_$][\w$]*\s*:/g, "$1K:");
}

try {
  build("--out", devOut);
  build("--release", "--out", relOut);
  const dev = fs.readFileSync(devOut, "utf8"),
    rel = fs.readFileSync(relOut, "utf8");
  check("the dev build has the dev file", dev.includes("function devHost"));
  check("the release build has no devHost", !rel.includes("devHost"));
  check("the release build has no dev screen", !rel.includes("scr-dev"));
  check("the dev build has the lag dial", dev.includes("lagDial"));
  check("the release build has no lag dial", !rel.includes("lagDial") && !rel.includes("devCoop"));
  check("the dev build has the big cave button", dev.includes("devBigCave") && dev.includes("Big cave (co-op size)"));
  check("the release build has no big cave button", !rel.includes("devBigCave") && !rel.includes("Big cave (co-op size)"));
  check("the dev build has the Warden for two row", dev.includes("devWardenTwo") && dev.includes("data-dev-w2"));
  check("the release build has no Warden for two row", !rel.includes("devWarden") && !rel.includes("data-dev-w2"));
  check("the release build keeps the inert seam", rel.includes("let DEV = null"));
  check("the release build carries the co-op host copy", rel.includes("const COOP_HOST_SRC = "));
  check(
    "the release host copy has no devHost",
    (() => {
      const m = rel.match(/^const COOP_HOST_SRC = (".*");$/m);
      return !!m && !JSON.parse(m[1]).includes("devHost");
    })(),
  );
  // the co-op build stamp: the same in both builds of the same sources, in
  // the page and in its host copy, and another when a core source changes
  const stamp = (html) => {
    const m = html.match(/^const COOP_BUILD = "([0-9a-f]{8})";$/m),
      h = html.match(/^const COOP_HOST_SRC = (".*");$/m),
      hm = h && JSON.parse(h[1]).match(/^const COOP_BUILD = "([0-9a-f]{8})";$/m);
    return m && hm && m[1] === hm[1] ? m[1] : null;
  };
  const sd = stamp(dev),
    sr = stamp(rel);
  check("both builds carry one co-op build stamp, in the page and its host copy", !!sd && !!sr);
  check("the dev and release builds carry the same stamp", !!sd && sd === sr);
  // a scratch copy of the sources outside the repository, built as they are
  // and then with one byte of a core file changed, and with a dev file changed
  const copy = path.join(tmp, "copy");
  fs.mkdirSync(copy);
  for (const f of ["build.mjs", "index.tpl.html"]) fs.copyFileSync(path.join(ROOT, f), path.join(copy, f));
  fs.cpSync(path.join(ROOT, "src"), path.join(copy, "src"), { recursive: true });
  const scratch = (name) => {
    const out = path.join(tmp, name + ".html");
    execFileSync("node", ["build.mjs", "--out", out], { cwd: copy, stdio: "pipe" });
    return stamp(fs.readFileSync(out, "utf8"));
  };
  const same = scratch("same");
  const core = path.join(copy, "src", "06_game.js"),
    src0 = fs.readFileSync(core, "utf8");
  fs.writeFileSync(core, src0.replace(/\n$/, "") + " \n");
  const changed = scratch("changed");
  fs.writeFileSync(core, src0);
  const devFile = path.join(copy, "src", "dev", fs.readdirSync(path.join(copy, "src", "dev")).filter((f) => f.endsWith(".js")).sort()[0]);
  fs.appendFileSync(devFile, "\n");
  const devChanged = scratch("devchanged");
  check("a copy of the same sources carries the same stamp", !!same && same === sd);
  check("one changed byte in a core source changes the stamp", !!changed && changed !== sd);
  check("a change to a dev file does not change the stamp", !!devChanged && devChanged === sd);
  // the host copy names no later file's top-level function or constant but
  // those listed, unless it declares that name itself (a local, or a stub)
  const hostCode = codeOnly(JSON.parse(rel.match(/^const COOP_HOST_SRC = (".*");$/m)[1]));
  const later = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^0[7-9].*\.js$/.test(f))) {
    const t = fs.readFileSync(path.join(ROOT, "src", f), "utf8");
    for (const m of t.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm))
      later.add(m[1] || m[2]);
  }
  const esc = (n) => n.replace(/\$/g, "\\$");
  const declared = (n) => new RegExp("(?:const|let|var|function|,)\\s*" + esc(n) + "\\s*[=(,;]|[(,]\\s*" + esc(n) + "\\s*[,)]").test(hostCode);
  const used = [...later].filter((n) => new RegExp("(^|[^\\w$.])" + esc(n) + "(?![\\w$])").test(hostCode) && !declared(n));
  const unlisted = used.filter((n) => !Object.hasOwn(HOST_MAY_NAME, n)),
    stale = Object.keys(HOST_MAY_NAME).filter((n) => !used.includes(n));
  check("the scan found the later files' names (" + later.size + ")", later.size > 50 && later.has("coopEnd") && later.has("show"));
  check("the host copy names nothing of the later files but its list" + (unlisted.length ? ": " + unlisted.join(", ") : ""), unlisted.length === 0);
  check("every name on the list is still named" + (stale.length ? " (stale: " + stale.join(", ") + ")" : ""), stale.length === 0);
  // the scan itself: an unguarded call put into a copy of 06_game.js is found
  const probe = codeOnly(JSON.parse(rel.match(/^const COOP_HOST_SRC = (".*");$/m)[1]) + "\nfunction zz() { coopHud(); }\n");
  check("the scan finds a call it is not told of", new RegExp("(^|[^\\w$.])coopHud(?![\\w$])").test(probe) && !/coopHud/.test(hostCode));
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
