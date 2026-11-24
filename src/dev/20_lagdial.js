// ---------- the lag dial: local builds only ----------
// A co-op run alone: a host copy stepped by hand on this page, joined over
// the fake link, whose ping, jitter and loss can be changed while it runs.
//
// coopSolo({ seed, ping, jit, loss, mate, before, tamper, save }) returns
// { host, cfg, step(sec, each), mate, refused } once the join has been
// applied or refused. before(host) runs before anyone joins. tamper(ev), if
// given, sees every event the host sends this page and returns the event to
// send, a list of them, or null for none. With save false (the default) the
// run is the dev run, so nothing it does is saved. step(sec, each) is DF.sim
// with the link and host pumped before each step. mate is for the scripted
// second player, which comes later.
function coopSolo({
  seed = 99,
  ping = 0,
  jit = 0,
  loss = 0,
  mate = null,
  before = null,
  tamper = null,
  save = false,
} = {}) {
  if (NET || CC.link) coopEnd("restart");
  const host = coopMakeHost(),
    cfg = { ping, jit, loss, hold: false },
    pair = coopFakePair(cfg);
  host.start({ seed, grade: "E" });
  if (before) before(host);
  host.send = (pid, buf) => {
    if (pid !== 1) return;
    if (!tamper || coopType(buf) !== COOP.EVENT) return pair.host.send(buf);
    const res = tamper(coopEventDecode(buf));
    if (res === null || res === undefined) return;
    const list = Array.isArray(res) && Array.isArray(res[0]) ? res : [res];
    for (const ev of list) pair.host.send(coopEventEncode(ev));
  };
  pair.host.onmessage = (buf) => host.recv(1, buf);
  pair.host.onclose = () => host.leave(1);
  // the host and the link on one clock
  let now = 0;
  const drive = (dt) => {
    host.tick(dt);
    now += dt;
    pair.step(now);
  };
  const out = {
    host,
    cfg,
    mate,
    refused: null,
    step: (sec, each) =>
      DF.sim(sec, (i) => {
        if (NET) NET.frame(1 / 60);
        return each ? each(i) : undefined;
      }),
  };
  coopBegin(pair.client, {
    cls: OPT.cls,
    drive,
    onRefuse: (why) => (out.refused = why),
  });
  // until the join is applied or refused, 10 s at most
  for (let i = 0; i < 600 && !NET && out.refused === null; i++) drive(1 / 60);
  if (NET) {
    if (!save && DEV) DEV.run = G.world;
    coopEnter();
  }
  return out;
}
DF.coopSolo = coopSolo;
