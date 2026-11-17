// Writes each code in tests/codes.local.json in all four notations, with the
// default binds, to tests/codes.local.md, which git ignores. For writing the
// hidden list of codes. Never commit the output.
// Run with: SCRIPT=$PWD/tests/codes-print.mjs node test.mjs title
import fs from "node:fs";
const file = new URL("./codes.local.json", import.meta.url);
const out = new URL("./codes.local.md", import.meta.url);
const local = (() => {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return null;
  }
})();
const MODES = [
  ["kb", "Keyboard"],
  ["touch", "Touch"],
  ["xbox", "Xbox"],
  ["ps", "PlayStation"],
];
export default local
  ? [
      {
        name: "codes",
        eval: `(() => {
  const b = { ...DF.BIND }, pb = { ...DF.PAD_BIND };
  Object.assign(DF.BIND, DF.DEFAULT_BINDS); Object.assign(DF.PAD_BIND, DF.DEFAULT_PAD);
  const codes = ${JSON.stringify(local)}, modes = ${JSON.stringify(MODES.map((m) => m[0]))}, r = {};
  for (const id in codes) { r[id] = {}; for (const m of modes) r[id][m] = DF.codeText(codes[id].split(" "), m); }
  Object.assign(DF.BIND, b); Object.assign(DF.PAD_BIND, pb); return r; })()`,
        after(r) {
          let md = "# Plaque codes\n\nWith the default binds. Never commit this file.\n";
          for (const id in r) {
            md += "\n## " + id + "\n\n";
            for (const [m, name] of MODES) md += "- " + name + ": " + r[id][m].join(", ") + "\n";
          }
          fs.writeFileSync(out, md);
          console.log(md);
          console.log("written to tests/codes.local.md");
        },
      },
    ]
  : [{ name: "codes", eval: `({ skipped: "no tests/codes.local.json" })` }];
