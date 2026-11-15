import fs from "node:fs";
const dir = new URL("./src/", import.meta.url);
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".js"))
  .sort();
const js =
  "(() => {\n'use strict';\n" +
  files.map((f) => fs.readFileSync(new URL(f, dir), "utf8")).join("\n") +
  "\n})();";
const tpl = fs.readFileSync(
  new URL("./index.tpl.html", import.meta.url),
  "utf8",
);
fs.mkdirSync(new URL("./dist/", import.meta.url), { recursive: true });
fs.writeFileSync(
  new URL("./dist/index.html", import.meta.url),
  tpl.replace("/*__JS__*/", () => js),
);
console.log(
  "built",
  files.length,
  "files,",
  (js.length / 1024).toFixed(1),
  "KiB js",
);
