// Co-op: the host. It exists only in the host copy of the simulation (see
// COOP_HEADLESS in build.mjs); in the page it is null.
const COOP_HOST = COOP_HEADLESS_HERE
  ? (() => {
      const S = {}; // the host's own state, filled in by later tasks
      const start = ({ seed, grade }) => {
        newRun(seed, grade);
      };
      const none = () => {};
      return {
        start,
        join: none,
        leave: none,
        recv: none,
        tick: none,
        send: null,
        G,
        S,
        worker: none,
        sum: coopWorldSum,
      };
    })()
  : null;
