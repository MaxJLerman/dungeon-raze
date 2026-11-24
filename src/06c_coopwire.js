// Co-op: the numbers both ends share. This file and 06d are part of the host
// copy of the simulation, which runs in a Worker or in Node, so nothing here
// touches the screen.
const COOP_V = 1;
const COOP = {
  SNAP: 1, // message kinds
  STATE: 2,
  EVENT: 3,
  STEP: 1 / 60, // a host step
  SNAP_EVERY: 3, // steps between snapshots, so 20 a second
  STATE_HZ: 30, // client states a second
  DELAY: 0.1, // draw delay, seconds
  RANGE: 45, // enemies within this of a player go in a snapshot
  AWAY: 2, // seconds of silence before a player counts as away
  CLOCK_WIN: 0.6, // clock window, seconds
  WAIT: 1, // seconds without a snapshot before "Waiting for the host"
  GONE: 10, // seconds of silence before a player leaves
  STICK: 3, // target hysteresis, metres
  MAX_DMG: 500,
};
// True only in the host copy, whose build declares COOP_HEADLESS first.
const COOP_HEADLESS_HERE = typeof COOP_HEADLESS !== "undefined";

// FNV-1a, 32 bits, over the bytes of the world's vertex positions. Two browsers
// that build the same cave from a seed must get the same string.
function coopWorldSum(world) {
  const pos = world.pos;
  const b = new Uint8Array(pos.buffer, pos.byteOffset, pos.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) {
    h ^= b[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
