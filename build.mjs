import fs from "node:fs";
import crypto from "node:crypto";
// node build.mjs [--release] [--out <file>]
// --release leaves out src/dev/ (the dev menu), as the published page must.
const argv = process.argv.slice(2),
  release = argv.includes("--release"),
  outAt = argv.indexOf("--out"),
  out =
    outAt >= 0 && argv[outAt + 1]
      ? new URL(argv[outAt + 1], "file://" + process.cwd() + "/")
      : new URL("./dist/index.html", import.meta.url);
const list = (d) =>
  fs.existsSync(d)
    ? fs
        .readdirSync(d)
        .filter((f) => f.endsWith(".js"))
        .sort()
        .map((f) => new URL(f, d))
    : [];
const files = [
  ...list(new URL("./src/", import.meta.url)),
  ...(release ? [] : list(new URL("./src/dev/", import.meta.url))),
];
const read = (f) => fs.readFileSync(f, "utf8"),
  base = (f) => f.pathname.split("/").pop();
// The co-op build stamp: 8 hex characters of a hash of the core sources
// (src/*.js in order, not src/dev/), so a dev build and a release build of
// the same sources carry the same one, and any change to the game's own code
// gives another. A co-op host refuses a friend's page with a different stamp.
const core = list(new URL("./src/", import.meta.url));
const stamp = crypto
  .createHash("sha256")
  .update(core.map((f) => base(f) + "\n" + read(f)).join("\n"))
  .digest("hex")
  .slice(0, 8);
const BUILD = "const COOP_BUILD = " + JSON.stringify(stamp) + ";\n";
// The co-op host is a second copy of the simulation: files 01 to 06d, which
// need no browser, a few stand-ins for what later files declare, and the
// source ends by returning COOP_HOST. Every build carries it as a string,
// COOP_HOST_SRC, which a Worker or a Node test evaluates. COOP_HEADLESS comes
// first because 06c reads it with typeof, which a const declared later would
// make a ReferenceError.
const HOST_HEAD = "const COOP_HEADLESS = true;\n" + BUILD;
const HOST_STUBS = `
const PAD = { rumble() {}, move: { x: 0, y: 0, mag: 0 }, active: false, sprint: false, fam: "xb" },
  TOUCH = { move: { x: 0, y: 0, mag: 0 }, on: false },
  RM = false;
function padName() { return ""; }
R.setWorld = () => {};
`;
const hostSrc =
  "'use strict';\n" +
  HOST_HEAD +
  files
    .filter((f) => /^0[1-6]/.test(base(f)))
    .map(read)
    .join("\n") +
  HOST_STUBS +
  "\nreturn COOP_HOST;";
const js =
  "(() => {\n'use strict';\n" +
  "const COOP_HOST_SRC = " +
  JSON.stringify(hostSrc).replace(/</g, "\\u003c") +
  ";\n" +
  BUILD +
  files.map(read).join("\n") +
  "\n})();";
const tpl = fs.readFileSync(
  new URL("./index.tpl.html", import.meta.url),
  "utf8",
);
fs.mkdirSync(new URL(".", out), { recursive: true });
fs.writeFileSync(out, tpl.replace("/*__JS__*/", () => js));
console.log(
  "built",
  files.length,
  "files,",
  (js.length / 1024).toFixed(1),
  "KiB js" + (release ? " (release)" : "") + ", co-op build " + stamp,
);
