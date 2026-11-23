import fs from "node:fs";
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
const js =
  "(() => {\n'use strict';\n" +
  files.map((f) => fs.readFileSync(f, "utf8")).join("\n") +
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
  "KiB js" + (release ? " (release)" : ""),
);
