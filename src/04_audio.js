// ---------- synthesized audio ----------
const SFX = (() => {
  let ac = null,
    master = null,
    nbuf = null,
    on = true;
  function init() {
    if (ac) {
      if (ac.state === "suspended") ac.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
      nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      drone();
    } catch (e) {
      ac = null;
    }
  }
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function noise(dur, f0, f1, peak, type = "bandpass", q = 1, delay = 0) {
    if (!ac || !on) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource();
    s.buffer = nbuf;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ac.createGain();
    env(g, t, 0.008, dur, peak);
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }
  function tone(dur, f0, f1, peak, type = "sine", delay = 0) {
    if (!ac || !on) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ac.createGain();
    env(g, t, 0.006, dur, peak);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function drone() {
    const s = ac.createBufferSource();
    s.buffer = nbuf;
    s.loop = true;
    const f = ac.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 140;
    f.Q.value = 4;
    const g = ac.createGain();
    g.gain.value = 0.22;
    const l = ac.createOscillator();
    l.frequency.value = 0.07;
    const lg = ac.createGain();
    lg.gain.value = 60;
    l.connect(lg);
    lg.connect(f.frequency);
    l.start();
    s.connect(f);
    f.connect(g);
    g.connect(master);
    s.start();
    const o = ac.createOscillator();
    o.type = "sine";
    o.frequency.value = 55;
    const og = ac.createGain();
    og.gain.value = 0.05;
    o.connect(og);
    og.connect(master);
    o.start();
  }
  return {
    init,
    toggle() {
      on = !on;
      if (master) master.gain.value = on ? 0.5 : 0;
      return on;
    },
    whoosh(heavy) {
      noise(
        heavy ? 0.26 : 0.16,
        heavy ? 500 : 900,
        heavy ? 2200 : 3800,
        heavy ? 0.5 : 0.32,
        "bandpass",
        1.4,
      );
    },
    hit(heavy) {
      noise(0.12, 2400, 500, 0.7, "bandpass", 0.8);
      tone(
        heavy ? 0.22 : 0.13,
        heavy ? 150 : 190,
        50,
        heavy ? 0.9 : 0.6,
        "triangle",
      );
    },
    crit() {
      tone(0.3, 1300, 700, 0.3, "triangle");
      noise(0.2, 3000, 700, 0.6, "highpass", 0.7);
      tone(0.25, 120, 40, 0.9, "sine");
    },
    parry() {
      tone(0.5, 2100, 1900, 0.42, "triangle");
      tone(0.42, 3170, 2900, 0.26, "sine");
      tone(0.3, 4310, 4000, 0.14, "sine");
      noise(0.07, 6000, 3000, 0.5, "highpass", 0.6);
    },
    block() {
      tone(0.14, 700, 380, 0.4, "square");
      noise(0.1, 1600, 500, 0.5, "bandpass", 1);
    },
    dodge() {
      noise(0.2, 400, 1700, 0.28, "bandpass", 0.8);
    },
    hurt() {
      tone(0.25, 210, 70, 0.8, "sawtooth");
      noise(0.16, 900, 200, 0.6, "lowpass", 0.7);
    },
    tele(unb) {
      if (unb) {
        tone(0.4, 190, 380, 0.4, "sawtooth");
        tone(0.4, 197, 392, 0.3, "square");
      } else tone(0.2, 880, 1320, 0.2, "triangle");
    },
    kill() {
      tone(0.5, 320, 55, 0.6, "triangle");
      noise(0.4, 1400, 150, 0.45, "lowpass", 0.8);
    },
    stagger() {
      tone(0.35, 520, 1040, 0.35, "triangle");
      tone(0.35, 780, 1560, 0.2, "sine", 0.05);
    },
    exec() {
      noise(0.1, 5000, 1500, 0.8, "highpass", 0.7);
      tone(0.5, 140, 32, 1.0, "sine", 0.03);
      tone(0.4, 1760, 880, 0.25, "triangle", 0.03);
    },
    blink() {
      noise(0.25, 3000, 300, 0.4, "bandpass", 2);
      tone(0.25, 1500, 300, 0.2, "sine");
    },
    knife() {
      noise(0.1, 3000, 5000, 0.25, "highpass", 0.8);
    },
    heal() {
      tone(0.5, 440, 880, 0.25, "sine");
      tone(0.5, 660, 1320, 0.15, "sine", 0.08);
    },
    shrine() {
      tone(1.2, 330, 330, 0.3, "sine");
      tone(1.2, 495, 495, 0.2, "sine", 0.12);
      tone(1.4, 660, 660, 0.16, "sine", 0.24);
    },
    gun(big) {
      noise(big ? 0.22 : 0.12, 2400, 300, big ? 0.7 : 0.45, "bandpass", 0.7);
      tone(big ? 0.2 : 0.1, big ? 160 : 220, 50, big ? 0.6 : 0.35, "square");
    },
    shotgun() {
      noise(0.35, 1800, 120, 1.0, "lowpass", 0.5);
      tone(0.3, 120, 35, 0.8, "sine");
      noise(0.08, 4000, 2000, 0.3, "highpass", 0.7, 0.02);
    },
    unlock() {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone(0.9, f, f, 0.22, "triangle", i * 0.09),
      );
      noise(0.8, 6000, 2000, 0.12, "highpass", 0.7, 0.3);
    },
    hook() {
      noise(0.18, 3500, 900, 0.35, "bandpass", 3);
      tone(0.3, 600, 180, 0.2, "sawtooth", 0.05);
    },
    // the Sapper's hammer landing
    thud(big) {
      tone(big ? 0.4 : 0.25, big ? 120 : 150, 40, big ? 0.9 : 0.6, "sine");
      noise(big ? 0.3 : 0.18, 900, 120, big ? 0.6 : 0.4, "lowpass", 0.8);
    },
    // the roof coming down, and the rubble giving way
    rumble() {
      tone(1.4, 70, 22, 1.2, "sine");
      noise(1.3, 400, 60, 1.0, "lowpass", 0.5);
      noise(0.6, 2500, 600, 0.35, "bandpass", 0.8, 0.1);
    },
    crumble() {
      for (let i = 0; i < 6; i++)
        noise(0.12, 1600 - i * 120, 400, 0.25, "bandpass", 1.5, i * 0.07);
      tone(0.5, 110, 40, 0.4, "sine");
    },
    // a mine pressed into the floor, and a tripwire snapping
    mine() {
      tone(0.05, 2200, 1800, 0.18, "square");
      tone(0.08, 900, 900, 0.12, "square", 0.08);
    },
    wire() {
      tone(0.25, 1400, 300, 0.3, "sawtooth");
      noise(0.1, 5000, 2000, 0.2, "highpass", 1);
    },
    beep() {
      tone(0.06, 1900, 1900, 0.12, "square");
    },
    // the Riftwalker: a tear opening, passing through one, a tear closing,
    // the floor opening under a pack
    tear() {
      noise(0.35, 300, 3200, 0.3, "bandpass", 4);
      tone(0.35, 180, 620, 0.18, "triangle");
    },
    cross() {
      noise(0.28, 2600, 400, 0.32, "bandpass", 2);
      tone(0.25, 700, 240, 0.16, "sine");
    },
    shut() {
      noise(0.2, 2400, 300, 0.22, "bandpass", 4);
      tone(0.18, 520, 160, 0.12, "triangle");
    },
    hole() {
      tone(0.6, 90, 40, 0.6, "sine");
      noise(0.5, 200, 1400, 0.35, "bandpass", 3);
    },
    shot() {
      tone(0.25, 520, 180, 0.3, "sawtooth");
      noise(0.2, 800, 2500, 0.2, "bandpass", 2);
    },
    slam() {
      tone(0.7, 90, 24, 1.2, "sine");
      noise(0.5, 500, 60, 0.9, "lowpass", 0.6);
    },
    alert() {
      tone(0.18, 300, 520, 0.22, "square");
    },
    roar() {
      tone(1.1, 110, 60, 0.7, "sawtooth");
      tone(1.1, 117, 55, 0.5, "square");
      noise(1.0, 300, 900, 0.5, "bandpass", 0.6);
    },
    die() {
      tone(1.4, 220, 40, 0.7, "sawtooth");
      tone(1.6, 110, 30, 0.6, "sine", 0.1);
    },
    win() {
      [392, 494, 587, 784].forEach((f, i) =>
        tone(1.2, f, f, 0.22, "triangle", i * 0.14),
      );
    },
  };
})();
