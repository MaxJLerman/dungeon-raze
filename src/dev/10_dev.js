// ---------- dev menu: local builds only ----------
// `node build.mjs --release` (the published page) leaves this folder out.
// Even when it is built in, it turns on only for a page opened from this
// machine.
function devHost(loc) {
  return (
    loc.protocol === "file:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(loc.hostname)
  );
}
if (devHost(location)) {
  DEV = { god: false, unlocked: new Set(), tick() {} };
  DF.DEV = DEV;
}
DF.devHost = devHost;
