// ---------- game state, classes, combat, AI ----------
const G = {
  state: "title",
  t: 0,
  slowT: 0,
  hitstop: 0,
  shake: 0,
  world: null,
  player: null,
  enemies: [],
  projs: [],
  parts: [],
  arcs: [],
  rings: [],
  ghosts: [],
  pending: [],
  kills: 0,
  deaths: 0,
  runT: 0,
  checkpoint: null,
  bossDead: false,
  bossSeen: false,
  // routes found so far in this update; setRoute allows two
  routeN: 0,
  // true while the player is inside the boss chamber
  inBoss: false,
  gate: null,
  flashRed: 0,
  flashWhite: 0,
  msgs: [],
  noLock: false,
  seed: 1,
  // "hub" is the hall, "cave" is a dungeon. grade is the portal last entered.
  zone: "cave",
  grade: null,
  // a running portal transition { t, grade, swapped }, and the black overlay
  // amount it drives, 0 to 1
  trans: null,
  fade: 0,
  // clock for the title screen's camera sway
  t0: 0,
  // the Riftwalker's open rift ends, oldest first, and its Drop holes
  rifts: [],
  holes: [],
};
const keys = {},
  taps = {},
  mouse = { dx: 0, dy: 0, wheel: 0 };
const cam = {
  yaw: 0,
  pitch: 0.3,
  dist: 5.6,
  cd: 5.6,
  x: 0,
  y: 2,
  z: 0,
  fov: 1.08,
  px: 0,
  pz: 0,
  sens: 0.0024,
};
const tap = (c) => {
  if (taps[c]) {
    taps[c] = false;
    return true;
  }
  return false;
};
const say = (text, cls = "", dur = 1.2) => {
  G.msgs.push({ text, cls, t: dur });
  if (G.msgs.length > 3) G.msgs.shift();
};

// ---- bindings + options ----
const DEFAULT_BINDS = {
  fwd: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  sprint: "ShiftLeft",
  light: "Mouse0",
  heavy: "KeyF",
  guard: "Mouse2",
  dodge: "Space",
  lock: "KeyQ",
  special: "KeyV",
  tool: "KeyR",
  heal: "KeyE",
  mute: "KeyM",
  interact: "KeyG",
};
const ACTIONS = [
  ["fwd", "Move forward"],
  ["back", "Move back"],
  ["left", "Move left"],
  ["right", "Move right"],
  ["sprint", "Sprint"],
  ["light", "Attack"],
  ["heavy", "Heavy attack"],
  ["guard", "Guard and parry"],
  ["dodge", "Dodge"],
  ["interact", "Interact"],
  ["lock", "Lock on"],
  ["special", "Class ability"],
  ["tool", "Class tool"],
  ["heal", "Drink a flask"],
  ["mute", "Sound on or off"],
];
const BIND = Object.assign({}, DEFAULT_BINDS);
// controller buttons, as "P:" and the standard-mapping index. Movement has no
// entry: it is the left stick. null is unbound.
const DEFAULT_PAD = {
  light: "P:5",
  heavy: "P:7",
  guard: "P:4",
  special: "P:6",
  dodge: "P:1",
  sprint: "P:10",
  lock: "P:11",
  heal: "P:2",
  tool: "P:3",
  mute: null,
  interact: "P:0",
};
const PAD_BIND = Object.assign({}, DEFAULT_PAD);
// P:9 pauses and is not bindable. The D-pad is bindable in play, and moves
// menu focus on a menu.
const PAD_CODES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 17].map(
  (i) => "P:" + i,
);
// tsize scales the touch buttons, topac is their idle opacity and tnotch keeps
// them clear of the notch and rounded corners
const OPT = {
  cls: "assassin",
  sens: 1,
  invY: false,
  psens: 1,
  padHideTouch: true,
  rumble: true,
  tsize: 1,
  topac: 0.6,
  tnotch: true,
};
// a touch button sets "T:action" and a pad button "P:i"; both are read here
// beside the bound key
const held = (a) =>
    !!keys[BIND[a]] ||
    !!keys["T:" + a] ||
    (!!PAD_BIND[a] && !!keys[PAD_BIND[a]]),
  hit = (a) => {
    // all three taps are read, so that all are consumed
    const k = tap(BIND[a]),
      t = tap("T:" + a),
      d = PAD_BIND[a] ? tap(PAD_BIND[a]) : false;
    return k || t || d;
  };
function keyName(c) {
  if (!c) return "Unbound";
  if (c.startsWith("P:")) return padName(c, PAD.fam);
  const M = {
    Mouse0: "Left click",
    Mouse1: "Middle click",
    Mouse2: "Right click",
    Mouse3: "Mouse 4",
    Mouse4: "Mouse 5",
    Space: "Space",
    ShiftLeft: "Left Shift",
    ShiftRight: "Right Shift",
    ControlLeft: "Left Ctrl",
    ControlRight: "Right Ctrl",
    AltLeft: "Left Alt",
    AltRight: "Right Alt",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
  };
  if (M[c]) return M[c];
  if (c.startsWith("Key")) return c.slice(3);
  if (c.startsWith("Digit")) return c.slice(5);
  if (c.startsWith("Numpad")) return "Num " + c.slice(6);
  return c;
}
// the name of the button for an action on the input in use: the pad's
// binding while a pad was the last input, else the keyboard or mouse one
function actKey(a) {
  return PAD.active ? padName(PAD_BIND[a], PAD.fam) : keyName(BIND[a]);
}
// Hidden classes unlocked at their plaques, saved under "u". A class without
// `hidden` is always open.
const UNLOCKED = new Set();
function classOpen(id) {
  return !!CLASSES[id] && (!CLASSES[id].hidden || UNLOCKED.has(id));
}
function pickable() {
  return CLASS_IDS.filter(classOpen);
}
// true when the class was locked until now
function unlockClass(id) {
  if (!CLASSES[id] || UNLOCKED.has(id)) return false;
  UNLOCKED.add(id);
  saveOpt();
  return true;
}
function saveOpt() {
  try {
    localStorage.setItem(
      "dungeon-raze.v2",
      JSON.stringify({ b: BIND, p: PAD_BIND, o: OPT, u: [...UNLOCKED] }),
    );
  } catch (e) {
    /* storage may be unavailable */
  }
}
function loadOpt() {
  try {
    const d = JSON.parse(localStorage.getItem("dungeon-raze.v2") || "null");
    if (!d) return;
    for (const k in DEFAULT_BINDS)
      if (d.b && typeof d.b[k] === "string") BIND[k] = d.b[k];
    // the plaques release had dodge on B and Interact on Space: a save with
    // that pair takes today's defaults, Space and G, unless G is taken
    if (
      d.b &&
      d.b.dodge === "KeyB" &&
      d.b.interact === "Space" &&
      !Object.values(d.b).includes("KeyG")
    ) {
      BIND.dodge = "Space";
      BIND.interact = "KeyG";
    }
    // a pad code that is not bindable, or no longer exists, is the default
    if (d.p && typeof d.p === "object")
      for (const k in DEFAULT_PAD)
        PAD_BIND[k] =
          d.p[k] === null || PAD_CODES.includes(d.p[k]) ? d.p[k] : DEFAULT_PAD[k];
    if (Array.isArray(d.u))
      for (const id of d.u) if (CLASSES[id]) UNLOCKED.add(id);
    if (d.o) {
      // a hidden class that is not unlocked falls back to the first open one
      if (CLASSES[d.o.cls]) OPT.cls = classOpen(d.o.cls) ? d.o.cls : pickable()[0];
      if (d.o.sens > 0.1 && d.o.sens < 5) OPT.sens = d.o.sens;
      OPT.invY = !!d.o.invY;
      const num = (v, lo, hi) => typeof v === "number" && v >= lo && v <= hi;
      OPT.psens = num(d.o.psens, 0.2, 3) ? d.o.psens : 1;
      OPT.padHideTouch =
        typeof d.o.padHideTouch === "boolean" ? d.o.padHideTouch : true;
      OPT.rumble = typeof d.o.rumble === "boolean" ? d.o.rumble : true;
      if (num(d.o.tsize, 0.8, 1.2)) OPT.tsize = d.o.tsize;
      if (num(d.o.topac, 0.2, 1)) OPT.topac = d.o.topac;
      if (typeof d.o.tnotch === "boolean") OPT.tnotch = d.o.tnotch;
    }
  } catch (e) {
    /* ignore */
  }
}
function setBind(a, code) {
  const old = BIND[a];
  for (const k in BIND) if (k !== a && BIND[k] === code) BIND[k] = old;
  BIND[a] = code;
  saveOpt();
}
// the same swap rule for a controller button
function setPadBind(a, code) {
  const old = PAD_BIND[a];
  for (const k in PAD_BIND) if (k !== a && PAD_BIND[k] === code) PAD_BIND[k] = old;
  PAD_BIND[a] = code;
  saveOpt();
}

const WHITE = [1, 0.95, 0.8],
  CYAN = [0.3, 0.9, 1],
  RED = [1, 0.2, 0.12],
  AMBER = [1, 0.65, 0.2],
  VIOLET = [0.7, 0.45, 1],
  GREEN = [0.55, 1, 0.45],
  ORANGE = [1, 0.5, 0.18],
  GOLD = [1, 0.85, 0.45],
  CRIMSON = [1, 0.28, 0.32],
  HAZARD = [1, 0.92, 0.15],
  MAGENTA = [0.95, 0.3, 0.75];

// ---- classes ----
const CLASSES = {
  assassin: {
    name: "Assassin",
    tag: "Twin daggers",
    hp: 100,
    stam: 100,
    walk: 5.6,
    run: 8.4,
    chain: "l1",
    heavy: "heavy",
    dash: "dash",
    ambush: 3,
    back: 1.5,
    parry: 0.2,
    blockMul: 1.1,
    chip: 0.12,
    guardArc: 1.9,
    col: CYAN,
    dodge: { dist: 5.4, dur: 0.42, ifr: 0.32, cost: 20 },
    tool: { id: "knife", name: "Knife", max: 5, ch: "▲" },
    special: { id: "blink", name: "Blink", cost: 40 },
    kit: [
      ["Attack", "Four-hit dagger chain"],
      ["Heavy", "Long lunging thrust"],
      ["Tool", "Throwing knives"],
      ["Ability", "Blink behind your target and stab"],
      [
        "Trait",
        "Triple damage on enemies that have not noticed you. Harder hits from behind",
      ],
    ],
  },
  fighter: {
    name: "Fighter",
    tag: "Greatsword",
    hp: 125,
    stam: 110,
    walk: 5.2,
    run: 7.8,
    chain: "g1",
    heavy: "gheavy",
    dash: "gdash",
    ambush: 1.5,
    back: 1.25,
    parry: 0.18,
    blockMul: 1.0,
    chip: 0.1,
    guardArc: 1.9,
    col: ORANGE,
    armor: true,
    dodge: { dist: 4.6, dur: 0.46, ifr: 0.3, cost: 22 },
    tool: { id: "rend", name: "Rend", max: 3, ch: "▼" },
    special: { id: "berserk", name: "Berserk", cost: 50 },
    kit: [
      ["Attack", "Three wide, slow sweeps that hit everything in front"],
      ["Heavy", "Full spinning cleave"],
      ["Tool", "Rend: a ground wave that cuts through a line of enemies"],
      ["Ability", "Berserk: 8 seconds of extra damage and life steal"],
      ["Trait", "Your swings are never interrupted by a hit"],
    ],
  },
  tanker: {
    name: "Tanker",
    tag: "Shield and mace",
    hp: 160,
    stam: 120,
    walk: 4.8,
    run: 7.2,
    chain: "t1",
    heavy: "tbash",
    dash: "tbash",
    ambush: 1.5,
    back: 1.25,
    parry: 0.28,
    blockMul: 0.5,
    chip: 0,
    guardArc: 2.6,
    col: GOLD,
    dodge: { dist: 3.8, dur: 0.44, ifr: 0.26, cost: 22 },
    tool: { id: "rush", name: "Rush", max: 3, ch: "■" },
    special: { id: "fortress", name: "Fortress", cost: 40 },
    kit: [
      ["Attack", "Three mace blows that build posture fast"],
      ["Heavy", "Shield bash that cracks guards"],
      ["Tool", "Shield rush: charge through danger and slam the first enemy"],
      [
        "Ability",
        "Fortress: for 6 seconds every guarded hit is a parry, even red ones",
      ],
      [
        "Trait",
        "Blocking is cheap and takes no chip damage. The widest parry window",
      ],
    ],
  },
  mage: {
    name: "Mage",
    tag: "Staff",
    hp: 75,
    stam: 100,
    walk: 5.4,
    run: 8.0,
    chain: "m1",
    heavy: "morb",
    dash: "m1",
    ambush: 1.5,
    back: 1,
    parry: 0.2,
    blockMul: 1.3,
    chip: 0.2,
    guardArc: 1.9,
    col: VIOLET,
    ranged: true,
    focusRegen: 2,
    dodge: { dist: 6.4, dur: 0.26, ifr: 0.3, cost: 24, warp: true },
    tool: { id: "nova", name: "Nova", max: 3, ch: "●" },
    special: { id: "meteor", name: "Starfall", cost: 60 },
    kit: [
      ["Attack", "Arcane bolts, fired where the camera points"],
      ["Heavy", "Slow orb that bursts on impact"],
      ["Tool", "Nova: a blast around you that throws enemies back"],
      ["Ability", "Starfall: call down a huge burst on your target"],
      ["Trait", "Dodge is a short teleport. Focus refills on its own. Fragile"],
    ],
  },
  ranger: {
    name: "Ranger",
    tag: "Longbow",
    hp: 90,
    stam: 110,
    walk: 5.8,
    run: 8.8,
    chain: "r1",
    heavy: "rpierce",
    dash: "r1",
    ambush: 2,
    back: 1,
    parry: 0.2,
    blockMul: 1.2,
    chip: 0.15,
    guardArc: 1.9,
    col: GREEN,
    ranged: true,
    dodge: { dist: 5.6, dur: 0.4, ifr: 0.3, cost: 18 },
    tool: { id: "leap", name: "Leap shot", max: 4, ch: "▶" },
    special: { id: "volley", name: "Volley", cost: 40 },
    kit: [
      ["Attack", "Fast arrows, fired where the camera points"],
      ["Heavy", "Drawn shot that pierces every enemy in line"],
      ["Tool", "Leap shot: spring backwards and fire"],
      ["Ability", "Volley: a fan of seven piercing arrows"],
      [
        "Trait",
        "Fastest on foot. Double damage on enemies that have not noticed you",
      ],
    ],
  },
  // hidden: only in the picker once unlocked at its plaque in the hall
  enforcer: {
    name: "Enforcer",
    tag: "Pistols and shotgun",
    hidden: true,
    hp: 100,
    stam: 105,
    walk: 5.5,
    run: 8.4,
    chain: "e1",
    heavy: "eshot",
    dash: "eslide",
    ambush: 1.5,
    back: 1,
    parry: 0.2,
    blockMul: 1.15,
    chip: 0.15,
    guardArc: 1.9,
    col: CRIMSON,
    ranged: true,
    dodge: { dist: 5.0, dur: 0.4, ifr: 0.3, cost: 20 },
    tool: { id: "sticky", name: "Sticky bomb", max: 3, ch: "◆" },
    special: { id: "grapple", name: "Grapple", cost: 35 },
    kit: [
      ["Attack", "Pistol shots, fired where the camera points"],
      ["Heavy", "Shotgun: devastating up close, useless at range"],
      [
        "Tool",
        "Sticky bomb: sticks to what it hits and blows after 3 seconds. Mind the blast",
      ],
      [
        "Ability",
        "Grapple: yank light enemies to you, or pull yourself to heavy ones",
      ],
      [
        "Trait",
        "Executions are a sniper shot from range and give back a sticky bomb",
      ],
    ],
  },
  // hidden: the demolitions class, unlocked at its plaque in the hall
  sapper: {
    name: "Sapper",
    tag: "Sledgehammer and charges",
    hidden: true,
    hp: 135,
    stam: 115,
    walk: 5.0,
    run: 7.6,
    chain: "s1",
    heavy: "sslam",
    dash: "sdrop",
    ambush: 1.5,
    back: 1.25,
    parry: 0.2,
    blockMul: 0.85,
    chip: 0.08,
    guardArc: 2.0,
    col: HAZARD,
    // the trait: posture damage from the Sapper's explosions is multiplied by
    // this in explode, and none of them hurt the Sapper
    blastPost: 1.5,
    dodge: { dist: 4.2, dur: 0.46, ifr: 0.28, cost: 22 },
    tool: { id: "mine", name: "Landmine", max: 4, ch: "◎" },
    special: { id: "cavein", name: "Cave-in", cost: 50 },
    kit: [
      ["Attack", "Three heavy sledgehammer swings"],
      ["Heavy", "Hammer slam that sets off a blast in front of you"],
      ["Tool", "Landmines. Two mines close together are joined by a tripwire"],
      [
        "Ability",
        "Cave-in: bring the roof down on a pack and wall off the tunnel",
      ],
      ["Trait", "Your own blasts never hurt you, and they break guards faster"],
    ],
  },
  riftwalker: {
    name: "Riftwalker",
    tag: "Rifts and a short blade",
    hidden: true,
    hp: 110,
    stam: 105,
    walk: 5.4,
    run: 8.1,
    chain: "v1",
    heavy: "vsnap",
    dash: "vstep",
    ambush: 2,
    back: 1.35,
    parry: 0.2,
    blockMul: 1.0,
    chip: 0.1,
    guardArc: 1.9,
    col: MAGENTA,
    dodge: { dist: 5.0, dur: 0.42, ifr: 0.3, cost: 20 },
    tool: { id: "rift", name: "Rift", max: 4, ch: "◇" },
    special: { id: "drop", name: "Drop", cost: 45 },
    kit: [
      [
        "Attack",
        "Cuts through small tears that reach about 5 m. The third throws a shard",
      ],
      ["Heavy", "A tear snaps shut on the target"],
      [
        "Tool",
        "Rift ends. Open two: you, enemies and shots that go into one come out of the other",
      ],
      [
        "Ability",
        "Drop: the floor opens under a pack and it falls from the ceiling over your other rift",
      ],
      [
        "Trait",
        "Untouchable while passing through a rift, and the next hit after does more",
      ],
    ],
  },
};
const CLASS_IDS = Object.keys(CLASSES);

const MOVES = {
  // assassin
  l1: {
    anim: "r",
    wind: 0.1,
    act: 0.09,
    rec: 0.26,
    dmg: 11,
    post: 9,
    range: 2.6,
    arc: 2.0,
    lunge: 1.5,
    stam: 9,
    next: "l2",
    tilt: 0.3,
    dir: 1,
  },
  l2: {
    anim: "l",
    wind: 0.09,
    act: 0.09,
    rec: 0.26,
    dmg: 11,
    post: 9,
    range: 2.6,
    arc: 2.0,
    lunge: 1.4,
    stam: 9,
    next: "l3",
    tilt: -0.3,
    dir: -1,
  },
  l3: {
    anim: "x",
    wind: 0.12,
    act: 0.1,
    rec: 0.3,
    dmg: 15,
    post: 13,
    range: 2.8,
    arc: 2.2,
    lunge: 1.8,
    stam: 10,
    next: "l4",
    tilt: 0.9,
    dir: 1,
    dbl: true,
  },
  l4: {
    anim: "spin",
    wind: 0.16,
    act: 0.14,
    rec: 0.44,
    dmg: 24,
    post: 22,
    range: 3.1,
    arc: TAU,
    lunge: 1.6,
    stam: 13,
    next: null,
    tilt: 0,
    dir: 1,
    heavy: true,
  },
  heavy: {
    anim: "thrust",
    wind: 0.3,
    act: 0.12,
    rec: 0.46,
    dmg: 30,
    post: 38,
    range: 3.4,
    arc: 1.2,
    lunge: 4.0,
    stam: 20,
    next: null,
    heavy: true,
    lance: true,
  },
  dash: {
    anim: "thrust",
    wind: 0.08,
    act: 0.12,
    rec: 0.34,
    dmg: 18,
    post: 16,
    range: 3.2,
    arc: 1.3,
    lunge: 3.4,
    stam: 12,
    next: "l2",
    lance: true,
  },
  // fighter
  g1: {
    anim: "gr",
    wind: 0.22,
    act: 0.12,
    rec: 0.4,
    dmg: 22,
    post: 20,
    range: 3.5,
    arc: 2.7,
    lunge: 1.6,
    stam: 14,
    next: "g2",
    tilt: 0.2,
    dir: 1,
    wide: 1.5,
  },
  g2: {
    anim: "gl",
    wind: 0.2,
    act: 0.12,
    rec: 0.42,
    dmg: 22,
    post: 20,
    range: 3.5,
    arc: 2.7,
    lunge: 1.6,
    stam: 14,
    next: "g3",
    tilt: -0.2,
    dir: -1,
    wide: 1.5,
  },
  g3: {
    anim: "gover",
    wind: 0.3,
    act: 0.12,
    rec: 0.55,
    dmg: 36,
    post: 36,
    range: 3.7,
    arc: 1.3,
    lunge: 2.0,
    stam: 18,
    next: null,
    tilt: 1.45,
    dir: 1,
    heavy: true,
  },
  gheavy: {
    anim: "spin",
    wind: 0.42,
    act: 0.18,
    rec: 0.55,
    dmg: 40,
    post: 45,
    range: 3.8,
    arc: TAU,
    lunge: 1.2,
    stam: 26,
    next: null,
    tilt: 0,
    dir: 1,
    heavy: true,
  },
  gdash: {
    anim: "gover",
    wind: 0.16,
    act: 0.12,
    rec: 0.45,
    dmg: 28,
    post: 26,
    range: 3.6,
    arc: 1.4,
    lunge: 4.2,
    stam: 16,
    next: "g2",
    tilt: 1.45,
    dir: 1,
    heavy: true,
  },
  // tanker
  t1: {
    anim: "r",
    wind: 0.16,
    act: 0.1,
    rec: 0.32,
    dmg: 15,
    post: 17,
    range: 2.8,
    arc: 2.0,
    lunge: 1.3,
    stam: 10,
    next: "t2",
    tilt: 0.25,
    dir: 1,
  },
  t2: {
    anim: "rb",
    wind: 0.16,
    act: 0.1,
    rec: 0.32,
    dmg: 15,
    post: 17,
    range: 2.8,
    arc: 2.0,
    lunge: 1.3,
    stam: 10,
    next: "t3",
    tilt: -0.2,
    dir: -1,
  },
  t3: {
    anim: "over",
    wind: 0.26,
    act: 0.12,
    rec: 0.46,
    dmg: 25,
    post: 32,
    range: 2.9,
    arc: 1.4,
    lunge: 1.5,
    stam: 14,
    next: null,
    tilt: 1.45,
    dir: 1,
    heavy: true,
  },
  tbash: {
    anim: "bash",
    wind: 0.18,
    act: 0.12,
    rec: 0.4,
    dmg: 12,
    post: 46,
    range: 2.5,
    arc: 1.9,
    lunge: 2.6,
    stam: 18,
    next: "t1",
    heavy: true,
    lance: true,
  },
  trush: {
    anim: "bash",
    wind: 0.06,
    act: 0.36,
    rec: 0.3,
    dmg: 16,
    post: 38,
    range: 2.5,
    arc: 2.2,
    lunge: 8.0,
    stam: 0,
    next: "t1",
    heavy: true,
    lance: true,
    ifr: 0.42,
  },
  // mage
  m1: {
    anim: "cast",
    wind: 0.14,
    act: 0.06,
    rec: 0.24,
    stam: 8,
    next: "m2",
    proj: { speed: 30, dmg: 11, post: 8, kind: "bolt" },
  },
  m2: {
    anim: "cast",
    wind: 0.12,
    act: 0.06,
    rec: 0.24,
    stam: 8,
    next: "m3",
    proj: { speed: 30, dmg: 11, post: 8, kind: "bolt" },
  },
  m3: {
    anim: "cast",
    wind: 0.2,
    act: 0.06,
    rec: 0.36,
    stam: 11,
    next: null,
    proj: {
      speed: 32,
      dmg: 19,
      post: 15,
      kind: "bolt",
      big: true,
      heavy: true,
    },
  },
  morb: {
    anim: "castup",
    wind: 0.42,
    act: 0.08,
    rec: 0.42,
    stam: 22,
    next: null,
    heavy: true,
    proj: { speed: 16, dmg: 26, post: 30, kind: "orb", aoe: 3.6, life: 1.6 },
  },
  // ranger
  r1: {
    anim: "bow",
    wind: 0.16,
    act: 0.05,
    rec: 0.22,
    stam: 7,
    next: "r2",
    proj: { speed: 46, dmg: 13, post: 9, kind: "arrow" },
  },
  r2: {
    anim: "bow",
    wind: 0.14,
    act: 0.05,
    rec: 0.22,
    stam: 7,
    next: "r3",
    proj: { speed: 46, dmg: 13, post: 9, kind: "arrow" },
  },
  r3: {
    anim: "bow",
    wind: 0.22,
    act: 0.05,
    rec: 0.34,
    stam: 10,
    next: null,
    proj: { speed: 50, dmg: 21, post: 16, kind: "arrow", heavy: true },
  },
  rpierce: {
    anim: "bow",
    wind: 0.5,
    act: 0.06,
    rec: 0.38,
    stam: 20,
    next: null,
    heavy: true,
    proj: {
      speed: 60,
      dmg: 34,
      post: 30,
      kind: "arrow",
      pierce: true,
      heavy: true,
      big: true,
    },
  },
  // enforcer
  e1: {
    anim: "pistol",
    wind: 0.08,
    act: 0.04,
    rec: 0.18,
    stam: 6,
    next: "e2",
    proj: { speed: 60, dmg: 9, post: 6, kind: "bullet" },
  },
  e2: {
    anim: "pistolL",
    wind: 0.08,
    act: 0.04,
    rec: 0.18,
    stam: 6,
    next: "e3",
    proj: { speed: 60, dmg: 9, post: 6, kind: "bullet" },
  },
  e3: {
    anim: "pistol2",
    wind: 0.14,
    act: 0.04,
    rec: 0.3,
    stam: 9,
    next: null,
    proj: { speed: 60, dmg: 16, post: 14, kind: "bullet", heavy: true },
  },
  // a spread of pellets, each fired `spread` radians from the next
  eshot: {
    anim: "shotgun",
    wind: 0.3,
    act: 0.06,
    rec: 0.45,
    stam: 20,
    next: null,
    heavy: true,
    proj: {
      speed: 40,
      dmg: 7,
      post: 7,
      kind: "pellet",
      life: 0.25,
      pellets: 7,
      spread: 0.09,
    },
  },
  // a proj move with a lunge slides forward while it fires
  eslide: {
    anim: "slide",
    wind: 0.12,
    act: 0.18,
    rec: 0.3,
    stam: 10,
    next: null,
    lunge: 4,
    proj: { speed: 60, dmg: 14, post: 10, kind: "bullet" },
  },
  // sapper: a sledgehammer
  s1: {
    anim: "gr",
    wind: 0.22,
    act: 0.1,
    rec: 0.34,
    dmg: 18,
    post: 16,
    range: 2.7,
    arc: 1.9,
    lunge: 0.6,
    stam: 12,
    next: "s2",
    tilt: 0.25,
    dir: 1,
  },
  s2: {
    anim: "gl",
    wind: 0.24,
    act: 0.1,
    rec: 0.36,
    dmg: 20,
    post: 18,
    range: 2.7,
    arc: 1.9,
    lunge: 0.6,
    stam: 12,
    next: "s3",
    tilt: -0.25,
    dir: -1,
  },
  s3: {
    anim: "gover",
    wind: 0.36,
    act: 0.12,
    rec: 0.5,
    dmg: 30,
    post: 30,
    range: 2.8,
    arc: 1.4,
    lunge: 0.8,
    stam: 16,
    next: null,
    tilt: 1.45,
    dir: 1,
    heavy: true,
  },
  // a move with `blast` hits only through an explosion d metres ahead
  sslam: {
    anim: "hslam",
    wind: 0.45,
    act: 0.08,
    rec: 0.6,
    dmg: 0,
    post: 0,
    range: 2.4,
    arc: 1.4,
    lunge: 0.4,
    stam: 24,
    next: null,
    tilt: 1.45,
    dir: 1,
    heavy: true,
    blast: { d: 1.9, r: 2.4, dmg: 32, post: 34 },
  },
  sdrop: {
    anim: "gover",
    wind: 0.3,
    act: 0.12,
    rec: 0.5,
    dmg: 26,
    post: 30,
    range: 2.6,
    arc: 1.4,
    lunge: 3.5,
    stam: 14,
    next: null,
    tilt: 1.45,
    dir: 1,
    heavy: true,
  },
  // riftwalker: `reach` cuts come out of a small tear beside the target, so
  // they land from range; aimYaw looks that far for a target
  v1: {
    anim: "r",
    wind: 0.16,
    act: 0.08,
    rec: 0.28,
    dmg: 12,
    post: 11,
    range: 5.0,
    arc: 0.6,
    lunge: 0.3,
    stam: 10,
    next: "v2",
    tilt: 0.3,
    dir: 1,
    reach: true,
  },
  v2: {
    anim: "l",
    wind: 0.15,
    act: 0.08,
    rec: 0.28,
    dmg: 12,
    post: 11,
    range: 5.0,
    arc: 0.6,
    lunge: 0.3,
    stam: 10,
    next: "v3",
    tilt: -0.3,
    dir: -1,
    reach: true,
  },
  v3: {
    anim: "r",
    wind: 0.18,
    act: 0.05,
    rec: 0.34,
    stam: 11,
    next: null,
    proj: { speed: 26, dmg: 18, post: 16, kind: "shard", life: 0.9 },
  },
  vsnap: {
    anim: "x",
    wind: 0.38,
    act: 0.1,
    rec: 0.5,
    dmg: 30,
    post: 42,
    range: 6.0,
    arc: 0.6,
    lunge: 0,
    stam: 22,
    next: null,
    tilt: 0.9,
    dir: 1,
    heavy: true,
    reach: true,
  },
  vstep: {
    anim: "thrust",
    wind: 0.12,
    act: 0.12,
    rec: 0.42,
    dmg: 24,
    post: 26,
    range: 3.0,
    arc: 1.2,
    lunge: 5.0,
    stam: 14,
    next: null,
    tilt: 0,
    dir: 1,
    heavy: true,
    ifr: 0.3,
  },
};
const EDEF = {
  husk: {
    name: "Husk",
    threat: 0,
    hp: 42,
    posture: 50,
    speed: 4.4,
    turn: 7,
    r: 0.5,
    sight: 15,
    cd: 1.3,
    poise: 0,
    hunch: 0.45,
    top: 1.9,
    atks: {
      swipe: {
        style: "over",
        wind: 0.5,
        act: 0.12,
        rec: 0.5,
        dmg: 13,
        reach: 2.5,
        arc: 1.7,
        lunge: 1.2,
        trig: 2.3,
      },
      lunge: {
        style: "thrust",
        wind: 0.65,
        act: 0.2,
        rec: 0.7,
        dmg: 16,
        reach: 2.2,
        arc: 1.3,
        lunge: 4.6,
        trig: 5.6,
        minTrig: 3.2,
      },
    },
  },
  brute: {
    name: "Brute",
    threat: 1,
    hp: 120,
    posture: 100,
    speed: 2.9,
    turn: 4,
    r: 0.85,
    sight: 15,
    cd: 1.6,
    poise: 1,
    hunch: 0.2,
    top: 2.8,
    atks: {
      sw1: {
        style: "sweep",
        wind: 0.7,
        act: 0.16,
        rec: 0.35,
        dmg: 20,
        reach: 3.5,
        arc: 2.6,
        lunge: 1.0,
        trig: 3.3,
        chain: "sw2",
      },
      sw2: {
        style: "over",
        wind: 0.55,
        act: 0.16,
        rec: 0.85,
        dmg: 24,
        reach: 3.6,
        arc: 1.5,
        lunge: 1.4,
      },
      crush: {
        style: "slam",
        wind: 1.0,
        act: 0.18,
        rec: 1.0,
        dmg: 34,
        reach: 3.9,
        arc: 1.8,
        lunge: 1.6,
        trig: 3.6,
        unb: true,
        w: 0.6,
      },
    },
  },
  spit: {
    name: "Spitter",
    threat: 0,
    hp: 30,
    posture: 36,
    speed: 3.4,
    turn: 6,
    r: 0.45,
    sight: 19,
    cd: 2.4,
    poise: 0,
    hunch: 0.15,
    top: 1.9,
    ranged: true,
    atks: {
      shot: {
        style: "cast",
        kind: "shot",
        wind: 0.7,
        act: 0.1,
        rec: 0.5,
        dmg: 13,
        trig: 17,
      },
    },
  },
  warden: {
    name: "The Ossuary Warden",
    boss: true,
    threat: 2,
    hp: 620,
    posture: 140,
    speed: 3.7,
    turn: 4.5,
    r: 1.35,
    sight: 22,
    cd: 1.0,
    poise: 2,
    hunch: 0.1,
    top: 4.4,
    atks: {
      c1: {
        style: "sweep",
        wind: 0.6,
        act: 0.16,
        rec: 0.2,
        dmg: 17,
        reach: 5.2,
        arc: 2.6,
        lunge: 1.6,
        trig: 5.2,
        chain: "c2",
        w: 2,
      },
      c2: {
        style: "sweep",
        wind: 0.42,
        act: 0.16,
        rec: 0.2,
        dmg: 17,
        reach: 5.2,
        arc: 2.6,
        lunge: 1.8,
        chain: "c3",
      },
      c3: {
        style: "over",
        wind: 0.62,
        act: 0.18,
        rec: 0.95,
        dmg: 24,
        reach: 5.6,
        arc: 1.5,
        lunge: 2.2,
      },
      slam: {
        style: "slam",
        kind: "slam",
        wind: 0.75,
        act: 0.6,
        rec: 0.95,
        dmg: 28,
        trig: 16,
        minTrig: 5,
        unb: true,
        radius: 5.4,
      },
      charge: {
        style: "thrust",
        kind: "charge",
        wind: 0.85,
        act: 0.5,
        rec: 0.85,
        dmg: 28,
        trig: 15,
        minTrig: 6,
        unb: true,
      },
      volley: {
        style: "cast",
        kind: "volley",
        wind: 0.8,
        act: 0.1,
        rec: 0.7,
        dmg: 12,
        trig: 20,
        minTrig: 6,
        p2: true,
      },
    },
  },
  // The training dummy in the hall. The dummy flag makes it inert and
  // unkillable: see makeEnemy, enemyUpdate, hitEnemy, kill and the execute
  // case. It has no speed, senses or attacks because it never uses them.
  dummy: {
    name: "Training dummy",
    threat: 0,
    dummy: true,
    hp: 100,
    posture: 60,
    r: 0.5,
    poise: 2,
    top: 1.9,
    atks: {},
  },
};

// How an enemy compares with the player: 0 weaker, 1 around the player's
// level or slightly above, 2 much stronger. Fixed per type until levels
// exist; then this compares levels and nothing else needs to change.
// How regular enemies hunt and when they stop. One table so tuning is one
// place. The boss keeps its own limits in the chase case of enemyUpdate.
const PURSUIT = {
  seeMul: 1.5, // hunting sight range as a multiple of sight
  lostT: 0.35, // seconds of broken sight tolerated before searching
  guessDist: 8, // metres walked on in the player's last direction
  guessT: 3.5, // and the longest that walk may take; slow enemies stop short
  look: 2.5, // seconds spent looking around before giving up
  leash: 32, // furthest a regular enemy hunts from its post
  edge: 6, // territory is the leash less this
  pack: 16, // an enemy that sees the player keeps others this near informed
  provoke: 4, // seconds the leash is ignored after a hit
  bossPad: 3, // added to the boss chamber radius for leaving and for posts
};
function threatOf(e) {
  return e.def.threat;
}

function makePlayer(id) {
  const w = G.world,
    c = CLASSES[id];
  return {
    cls: c,
    clsId: id,
    x: w.spawn.x,
    z: w.spawn.z,
    yaw: w.spawnYaw,
    r: 0.45,
    hp: c.hp,
    maxHp: c.hp,
    stam: c.stam,
    maxStam: c.stam,
    focus: 40,
    flasks: 3,
    tool: c.tool.max,
    state: "free",
    t: 0,
    move: null,
    hitSet: null,
    buf: null,
    bufT: 0,
    iframe: 0,
    stamDelay: 0,
    guardT: 0,
    parryWin: c.parry,
    parryCD: 0,
    lock: null,
    vx: 0,
    vz: 0,
    kx: 0,
    kz: 0,
    speed: 0,
    walk: 0,
    sprint: false,
    fig: makePlayerFig(id),
    flash: 0,
    toolCD: 0,
    restCD: 0,
    refillT: 0,
    buff: null,
    buffT: 0,
    throwT: 0,
    gLine: 0,
    ddur: 0.42,
  };
}
function setClass(id) {
  if (!CLASSES[id]) return;
  OPT.cls = id;
  saveOpt();
  const p = G.player;
  if (!p) return;
  const c = CLASSES[id],
    fr = p.hp / p.maxHp,
    dead = p.state === "dead";
  Object.assign(p, {
    cls: c,
    clsId: id,
    maxHp: c.hp,
    hp: dead ? 0 : Math.max(1, c.hp * fr),
    maxStam: c.stam,
    stam: c.stam,
    tool: c.tool.max,
    fig: makePlayerFig(id),
    state: dead ? "dead" : "free",
    buff: null,
    buffT: 0,
    buf: null,
    parryWin: c.parry,
  });
}
function makeEnemy(s) {
  const d = EDEF[s.type];
  return {
    type: s.type,
    node: s.node,
    def: d,
    x: s.x,
    z: s.z,
    y: 0,
    yaw: s.yaw,
    hx: s.x,
    hz: s.z,
    hyaw: s.yaw,
    r: d.r,
    hp: d.hp,
    posture: 0,
    postT: 9,
    state: "idle",
    t: 0,
    // a dummy counts as aware so it cannot be ambushed and its bar shows
    aware: !!d.dummy,
    alertIn: -1,
    cd: 0.4 + Math.random() * 0.8,
    atk: null,
    plan: null,
    hitDone: false,
    flash: 0,
    speed: 0,
    walk: Math.random() * 6,
    ph: Math.random() * 6,
    strafe: Math.random() < 0.5 ? 1 : -1,
    strafeT: 0,
    fig: makeEnemyFig(s.type),
    dead: false,
    gone: false,
    phase: 1,
    kx: 0,
    kz: 0,
    token: false,
    snap: null,
    dur: 0,
    // the route being walked: points in order, the next one, how many were
    // abandoned since the state began, and progress toward the next point
    route: null,
    ri: 0,
    fails: 0,
    best: 1e9,
    stuck: 0,
    rt: 0,
    // where the current route was asked to end
    rgx: s.x,
    rgz: s.z,
    // where the player was last seen and how they were moving, seconds since
    // then, and the step of a search: go, guess or look
    lsx: s.x,
    lsz: s.z,
    lvx: 0,
    lvz: 0,
    lost: 0,
    sub: "",
    gd: 0,
    gsx: 0,
    gsz: 0,
    gpx: 0,
    gpz: 0,
    ly: 0,
    alertBy: null,
    // true while a pack-mate that can see the player is feeding last seen
    told: false,
    // seconds left in which a hit makes it ignore its leash
    prov: 0,
  };
}
function spawnEnemies() {
  G.enemies = [];
  for (const s of G.world.spawns) {
    if (s.type === "warden" && G.bossDead) continue;
    G.enemies.push(makeEnemy(s));
  }
}
// Air for each zone. The cave keeps the renderer's defaults; the hall is a
// built room, so it is clearer and a little brighter.
const ENV_CAVE = {
    amb: R.env.amb.slice(),
    fog: R.env.fog.slice(),
    fogD: R.env.fogD,
  },
  ENV_HUB = { amb: [0.15, 0.17, 0.22], fog: [0.03, 0.035, 0.05], fogD: 0.014 };
// Copies, so nothing that later adjusts R.env can change the presets.
function setEnv(e) {
  R.env.amb = e.amb.slice();
  R.env.fog = e.fog.slice();
  R.env.fogD = e.fogD;
}
// Clears everything that must not carry from one world into the next.
function resetRun() {
  if (G.world && G.world.clearRocks) G.world.clearRocks();
  G.caveins = [];
  G.mines = [];
  G.rifts = [];
  G.holes = [];
  G.insp = null;
  G.bossDead = false;
  G.bossSeen = false;
  G.gate = null;
  G.kills = 0;
  G.deaths = 0;
  G.runT = 0;
  G.projs = [];
  G.bombs = [];
  G.parts = [];
  G.arcs = [];
  G.rings = [];
  G.ghosts = [];
  G.msgs = [];
  G.pending = [];
  G.hitstop = 0;
  G.slowT = 0;
  G.shake = 0;
  G.flashRed = 0;
  G.flashWhite = 0;
  G.trans = null;
  G.fade = 0;
  G.routeN = 0;
  G.inBoss = false;
}
function snapCam() {
  cam.yaw = G.player.yaw;
  cam.pitch = 0.3;
  cam.px = G.player.x;
  cam.pz = G.player.z;
}
// Starts a cave from a seed. Tests call this directly.
function newRun(seed) {
  G.zone = "cave";
  setEnv(ENV_CAVE);
  G.seed = seed;
  G.world = genWorld(seed);
  R.setWorld(G.world.pos, G.world.col);
  resetRun();
  G.player = makePlayer(OPT.cls);
  G.checkpoint = G.world.shrines[0];
  spawnEnemies();
  snapCam();
}
// Puts the player in the hall. With fromGrade they step out of that grade's
// portal, facing into the hall; otherwise they stand at the start point.
function enterHub(fromGrade = null) {
  G.zone = "hub";
  setEnv(ENV_HUB);
  G.world = genHub();
  R.setWorld(G.world.pos, G.world.col);
  resetRun();
  const p = (G.player = makePlayer(OPT.cls));
  const q = fromGrade && G.world.portals.find((o) => o.grade === fromGrade);
  if (q) {
    const f = portalFront(q, 3.5);
    p.x = f.x;
    p.z = f.z;
    // look toward the middle of the hall, not straight ahead: the end frames
    // line up with the pillar rows
    p.yaw = Math.atan2(-f.x, -f.z);
  }
  G.checkpoint = null;
  spawnEnemies();
  snapCam();
}
// Enters a freshly generated cave through the portal of the given grade.
function enterCave(gradeId, seed = (Math.random() * 1e9) | 0 || 7) {
  G.grade = gradeId;
  newRun(seed);
  say(GRADES[gradeId].name.toUpperCase(), "big", 3);
}
// Begins the fade into a cave. A cut swaps at once, for reduced motion.
function startTrans(gradeId, cut = RM) {
  SFX.blink();
  if (cut) enterCave(gradeId);
  else G.trans = { t: 0, grade: gradeId, swapped: false };
}
const TRANS_HALF = 0.4;
function transUpdate(dt) {
  const tr = G.trans;
  tr.t += dt;
  if (!tr.swapped && tr.t >= TRANS_HALF) {
    tr.swapped = true;
    enterCave(tr.grade);
    // entering the cave reset the transition; put it back to fade in
    G.trans = tr;
  }
  G.fade =
    tr.t < TRANS_HALF ? tr.t / TRANS_HALF : sat(2 - tr.t / TRANS_HALF);
  if (tr.t >= TRANS_HALF * 2) {
    G.trans = null;
    G.fade = 0;
  }
}
function respawn() {
  // the hall has no shrine to wake at; start it over
  if (!G.checkpoint) {
    enterHub();
    G.state = "play";
    return;
  }
  const p = G.player,
    c = G.checkpoint;
  Object.assign(p, {
    x: c.x,
    z: c.z - 1.6,
    hp: p.maxHp,
    stam: p.maxStam,
    focus: 40,
    flasks: 3,
    tool: p.cls.tool.max,
    state: "free",
    t: 0,
    lock: null,
    vx: 0,
    vz: 0,
    kx: 0,
    kz: 0,
    iframe: 1,
    buf: null,
    buff: null,
    buffT: 0,
  });
  // the same cave again: its rubble has to come out of the field
  G.world.clearRocks();
  G.caveins = [];
  G.mines = [];
  G.rifts = [];
  G.holes = [];
  G.world.resolve(p, 0.6);
  G.projs = [];
  G.bombs = [];
  G.rings = [];
  G.pending = [];
  G.bossSeen = false;
  spawnEnemies();
  cam.px = p.x;
  cam.pz = p.z;
  G.state = "play";
}

// ---- fx helpers ----
function sparks(x, y, z, n, col, spd = 6, life = 0.4, size = 0.12) {
  for (let i = 0; i < n && G.parts.length < 700; i++) {
    const a = Math.random() * TAU,
      u = Math.random() * 2 - 1,
      s = Math.sqrt(1 - u * u),
      v = spd * (0.3 + Math.random() * 0.9);
    G.parts.push({
      x,
      y,
      z,
      vx: Math.cos(a) * s * v,
      vy: u * v + spd * 0.25,
      vz: Math.sin(a) * s * v,
      t: 0,
      life: life * (0.5 + Math.random()),
      size,
      c: col,
      g: 9,
    });
  }
}
function ghost(p) {
  G.ghosts.push({ x: p.x, z: p.z, t: 0, c: p.cls.col });
}
function explode(x, z, r, dmg, post, c) {
  post *= G.player.cls.blastPost || 1;
  G.rings.push({ x, z, r, t: 0, dur: 0.4, kind: "shock", c });
  sparks(x, 0.8, z, 30, c, 9, 0.6, 0.15);
  G.shake = Math.max(G.shake, r > 4.5 ? 0.9 : 0.45);
  SFX.slam();
  for (const e of G.enemies) {
    if (e.dead || e.state === "fall") continue;
    if (Math.hypot(e.x - x, e.z - z) < r + e.r && G.world.los(x, z, e.x, e.z))
      hitEnemy(e, dmg, post, { src: "aoe", heavy: true, fx: x, fz: z });
  }
}

// ---- tokens ----
function takeToken(e) {
  if (e.def.boss || e.token) return true;
  let n = 0;
  for (const o of G.enemies) if (o.token && !o.dead) n++;
  if (n >= 2) return false;
  e.token = true;
  return true;
}

// True when e can see the player: alive, within hunting sight range and with
// a clear line. Facing does not matter to an enemy that is already hunting.
function canSee(e) {
  const p = G.player;
  return (
    p.state !== "dead" &&
    Math.hypot(p.x - e.x, p.z - e.z) <= e.def.sight * PURSUIT.seeMul &&
    G.world.los(e.x, e.z, p.x, p.z)
  );
}
// How far from its post a regular enemy will hunt.
function leashOf(e) {
  return e.def.leash || PURSUIT.leash;
}
// True when the player is close enough to e's post for e to take notice of
// them on its way home. Narrower than the leash, so an enemy that gave up at
// the leash does not turn straight back.
function inTerritory(e) {
  const p = G.player;
  return Math.hypot(p.x - e.hx, p.z - e.hz) < leashOf(e) - PURSUIT.edge;
}
// True when a regular enemy should stop hunting: the player is in the boss
// chamber or dead, or it is past its leash and no recent hit is keeping it
// out there. A hit never overrides the boss chamber.
function huntOver(e) {
  return (
    G.inBoss ||
    G.player.state === "dead" ||
    (e.prov <= 0 && Math.hypot(e.x - e.hx, e.z - e.hz) > leashOf(e))
  );
}
// A regular enemy that is hunting and can see the player right now.
function seesNow(o) {
  return o.aware && !o.dead && o.lost === 0 && !o.def.boss && !o.def.dummy;
}
// The nearest pack-mate of e that can see the player, within calling
// distance, or null. e takes the player's position from it.
function seeingMate(e) {
  let best = null,
    bd = PURSUIT.pack;
  for (const o of G.enemies) {
    if (o === e || !seesNow(o)) continue;
    const d = Math.hypot(o.x - e.x, o.z - e.z);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}
// e can see the player: wake any regular enemy within calling distance that
// is idle or walking home, as long as the player is in its territory or e is
// provoked. The wake-up runs through alertIn, like a first alert.
function callPack(e) {
  for (const o of G.enemies) {
    if (o === e || o.aware || o.dead || o.alertIn > 0) continue;
    if (o.def.boss || o.def.dummy) continue;
    if (o.state !== "idle" && o.state !== "return") continue;
    if (Math.hypot(o.x - e.x, o.z - e.z) >= PURSUIT.pack) continue;
    if (!inTerritory(o) && !(e.prov > 0)) continue;
    o.alertIn = 0.25 + Math.random() * 0.35;
    o.alertBy = e;
  }
}
// Sight is broken: run to where the player was last seen, guess, look round.
function toSearch(e) {
  e.state = "search";
  e.sub = "go";
  e.t = 0;
  e.gd = 0;
  e.token = false;
  e.plan = null;
  e.route = null;
  e.fails = 0;
}
// The hunt is over: forget the player and walk back to the post.
function giveUp(e) {
  e.aware = false;
  e.state = "return";
  e.token = false;
  e.plan = null;
  e.route = null;
  e.fails = 0;
}
// by is the enemy that woke this one, if any. It passes on where it last saw
// the player; otherwise the enemy starts from where the player is now.
function alertE(e, quiet, by) {
  if (e.aware || e.dead) return;
  // nothing but the boss takes notice of a player in the boss chamber
  if (G.inBoss && !e.def.boss) return;
  e.aware = true;
  const src = by || G.player;
  e.lsx = by ? by.lsx : src.x;
  e.lsz = by ? by.lsz : src.z;
  e.lvx = by ? by.lvx : src.vx;
  e.lvz = by ? by.lvz : src.vz;
  e.lost = 0;
  if (e.state === "idle" || e.state === "return") {
    e.state = "alert";
    e.t = 0;
  }
  if (!quiet) SFX.alert();
  if (e.def.boss) G.bossSeen = true;
  for (const o of G.enemies)
    if (o !== e && !o.aware && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 12) {
      o.alertIn = 0.25 + Math.random() * 0.35;
      o.alertBy = e;
    }
}
// k scales how long it lasts: the Sapper's cave-in staggers a brute for less
function stagger(e, k = 1) {
  e.state = "stagger";
  e.t = 0;
  e.dur = (e.def.boss ? 3.4 : 3.0) * k;
  e.posture = e.def.posture;
  e.token = false;
  e.y = 0;
  SFX.stagger();
  sparks(e.x, e.def.top * 0.6, e.z, 14, AMBER, 5);
}
function kill(e) {
  if (e.def.dummy) return;
  e.dead = true;
  e.state = "dead";
  e.t = 0;
  e.token = false;
  e.y = 0;
  G.kills++;
  const p = G.player;
  p.focus = Math.min(100, p.focus + 6);
  if (Math.random() < 0.4) p.tool = Math.min(p.cls.tool.max, p.tool + 1);
  SFX.kill();
  sparks(e.x, e.def.top * 0.5, e.z, 26, e.fig.eye, 7, 0.7, 0.14);
  if (p.lock === e) {
    p.lock = null;
    let b = null,
      bd = p.cls.ranged ? 22 : 13;
    for (const o of G.enemies)
      if (!o.dead && o.aware) {
        const d = Math.hypot(o.x - p.x, o.z - p.z);
        if (d < bd) {
          bd = d;
          b = o;
        }
      }
    p.lock = b;
  }
  if (e.def.boss) {
    G.bossDead = true;
    G.gate = { x: G.world.boss.x, z: G.world.boss.z, t: 0 };
    G.slowT = 1.2;
    say("THE WARDEN FALLS", "big", 4);
    say("A gate opens. Step through to leave.", "", 6);
    SFX.win();
  }
}
function hitEnemy(e, dmg, post, o = {}) {
  if (e.dead || e.state === "fall") return;
  const p = G.player,
    c = p.cls;
  // the Riftwalker's trait: the first hit after coming out of a rift
  if (p.riftBonus > 0) {
    dmg *= 1 + RIFT.bonus;
    p.riftBonus = 0;
  }
  let mult = 1;
  const close = o.src === "melee" || o.src === "blink" || o.src === "exec";
  const back = Math.abs(angDiff(e.yaw, Math.atan2(p.x - e.x, p.z - e.z))) > 2.1;
  // An enemy that the boss chamber rule keeps from waking is not caught off
  // guard: without this every hit on it would be an ambush.
  const held = G.inBoss && !e.def.boss;
  if (
    !e.aware &&
    !held &&
    o.src !== "reflect" &&
    o.src !== "aoe" &&
    c.ambush > 1
  ) {
    mult = c.ambush;
    say("AMBUSH", "crit");
    SFX.crit();
  } else if (
    back &&
    (o.src === "melee" || o.src === "blink") &&
    e.state !== "stagger" &&
    c.back > 1
  ) {
    mult = c.back;
    say("BACKSTAB", "crit", 0.8);
    SFX.crit();
  }
  if (p.buff === "berserk") {
    mult *= 1.4;
    p.hp = Math.min(p.maxHp, p.hp + dmg * 0.15);
  }
  e.hp -= dmg * mult;
  if (e.def.dummy) e.hp = e.def.hp;
  e.flash = 1;
  // a hit always starts a hunt, even past the leash
  if (!e.def.boss && !e.def.dummy) e.prov = PURSUIT.provoke;
  alertE(e, true);
  if (!e.def.boss && !e.def.dummy) {
    // a hit tells the enemy where it came from
    e.lsx = p.x;
    e.lsz = p.z;
    e.lvx = e.lvz = 0;
    if (e.state === "search") {
      e.sub = "go";
      e.route = null;
      e.fails = 0;
    }
  }
  if (e.state !== "stagger") {
    e.posture += post * (e.state === "wind" ? 1.25 : 1);
    e.postT = 0;
  }
  const ox = o.fx !== undefined ? o.fx : p.x,
    oz = o.fz !== undefined ? o.fz : p.z;
  let dx = e.x - ox,
    dz = e.z - oz;
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl;
  dz /= dl;
  if (e.def.poise === 0) {
    const k = o.heavy ? 9 : 5;
    e.kx = dx * k;
    e.kz = dz * k;
  }
  sparks(
    e.x - dx * e.r * 0.6,
    1.0 * e.fig.o.sc + 0.2,
    e.z - dz * e.r * 0.6,
    o.heavy ? 16 : 9,
    mult > 1 ? AMBER : close ? WHITE : c.col,
    o.heavy ? 8 : 6,
  );
  if (close) {
    G.hitstop = Math.max(G.hitstop, o.heavy ? 0.1 : 0.055);
    G.shake = Math.max(G.shake, o.heavy ? 0.5 : 0.28);
    p.focus = Math.min(100, p.focus + (o.heavy ? 6 : 4));
  } else if (o.src !== "reflect") {
    G.shake = Math.max(G.shake, o.heavy ? 0.3 : 0.12);
    p.focus = Math.min(100, p.focus + (o.src === "aoe" ? 2 : 3));
  }
  SFX.hit(o.heavy);
  if (o.heavy && o.src === "melee") PAD.rumble("heavy");
  if (e.hp <= 0) {
    kill(e);
    return;
  }
  if (e.def.boss && e.phase === 1 && e.hp < e.def.hp * 0.5) {
    e.phase = 2;
    e.state = "roar";
    e.t = 0;
    e.posture = 0;
    e.y = 0;
    SFX.roar();
    G.shake = 1;
    G.rings.push({
      x: e.x,
      z: e.z,
      r: 9,
      t: 0,
      dur: 0.6,
      kind: "shock",
      c: RED,
    });
    const d = Math.hypot(e.x - p.x, e.z - p.z) || 1;
    if (d < 9) {
      p.kx = ((p.x - e.x) / d) * 16;
      p.kz = ((p.z - e.z) / d) * 16;
    }
    say("The Warden burns hotter", "", 2.5);
    return;
  }
  if (e.state === "stagger" || e.state === "roar") return;
  if (e.posture >= e.def.posture) {
    stagger(e);
    return;
  }
  const flinch =
    e.def.poise === 0 || (e.def.poise === 1 && o.heavy && e.state !== "wind");
  if (flinch && e.state !== "act") {
    e.state = "hit";
    e.t = 0;
    e.hitT = 0;
    e.token = false;
  }
}
function hurtPlayer(dmg, e, atk) {
  const p = G.player,
    c = p.cls;
  if (p.state === "dead" || G.state !== "play" || G.trans) return "none";
  if (p.state === "execute" || p.state === "blink") return "none";
  if (p.iframe > 0) {
    if (p.state === "dodge" && !p.pdUsed) {
      p.pdUsed = true;
      G.slowT = Math.max(G.slowT, 0.4);
      p.focus = Math.min(100, p.focus + 15);
      say("PERFECT DODGE", "good", 0.9);
      SFX.stagger();
    }
    return "none";
  }
  const sx = e ? e.x : atk.px,
    sz = e ? e.z : atk.pz,
    fort = p.buff === "fortress";
  const from = Math.atan2(sx - p.x, sz - p.z),
    facing = Math.abs(angDiff(p.yaw, from)) < c.guardArc;
  const kdx = Math.sin(from),
    kdz = Math.cos(from);
  if (p.state === "guard" && facing && (!atk.unb || fort)) {
    if (p.guardT <= p.parryWin || fort) {
      SFX.parry();
      sparks(p.x + kdx * 0.7, 1.3, p.z + kdz * 0.7, 18, WHITE, 9, 0.35);
      G.slowT = Math.max(G.slowT, 0.16);
      G.shake = Math.max(G.shake, 0.35);
      G.flashWhite = 0.5;
      p.focus = Math.min(100, p.focus + (fort ? 3 : 10));
      p.stam = Math.min(p.maxStam, p.stam + 10);
      say("PARRY", "good", 0.7);
      PAD.rumble("parry");
      if (e && !e.dead) {
        e.posture += atk.pp || (e.def.boss ? 30 : 42);
        e.postT = 0;
        if (e.posture >= e.def.posture) stagger(e);
        else {
          e.state = "recoil";
          e.t = 0;
          e.dur = e.def.boss ? 0.55 : 1.0;
          e.token = false;
          e.y = 0;
        }
      }
      return "parry";
    }
    p.stam -= dmg * c.blockMul;
    p.stamDelay = 0.9;
    p.hp -= dmg * c.chip;
    p.kx = -kdx * 4;
    p.kz = -kdz * 4;
    SFX.block();
    sparks(p.x + kdx * 0.6, 1.2, p.z + kdz * 0.6, 6, WHITE, 5, 0.25);
    G.shake = Math.max(G.shake, 0.3);
    if (p.stam <= 0) {
      p.state = "gbreak";
      p.t = 0;
      say("GUARD BROKEN", "bad", 1);
      PAD.rumble("gbreak");
    }
    if (p.hp <= 0) playerDie();
    return "block";
  }
  const armored = (c.armor && p.state === "attack") || p.buff === "berserk";
  if (armored) dmg *= 0.85;
  p.hp -= dmg;
  p.flash = 1;
  G.flashRed = 0.6;
  G.shake = Math.max(G.shake, 0.7);
  G.hitstop = Math.max(G.hitstop, 0.06);
  SFX.hurt();
  const kb = (atk.unb ? 11 : 7) * (armored ? 0.3 : 1);
  p.kx = -kdx * kb;
  p.kz = -kdz * kb;
  sparks(p.x, 1.2, p.z, 10, RED, 5);
  if (p.hp <= 0) {
    playerDie();
    return "hit";
  }
  PAD.rumble("hurt");
  if (!armored) {
    p.state = "hit";
    p.t = 0;
    p.buf = null;
  }
  return "hit";
}
function playerDie() {
  const p = G.player;
  p.hp = 0;
  p.state = "dead";
  G.insp = null;
  p.t = 0;
  p.lock = null;
  p.buff = null;
  G.deaths++;
  G.slowT = 0.8;
  SFX.die();
  PAD.rumble("death");
  for (const e of G.enemies) e.token = false;
}

// ---- player ----
function nearestStaggered() {
  const p = G.player;
  let b = null,
    bd = 3.7;
  for (const e of G.enemies)
    if (!e.dead && e.state === "stagger") {
      const d = Math.hypot(e.x - p.x, e.z - p.z) - e.r;
      if (d < bd) {
        bd = d;
        b = e;
      }
    }
  return b;
}
function pickLock(exclude) {
  const p = G.player;
  let best = null,
    bs = 1e9;
  const far = p.cls.ranged ? 34 : 24;
  for (const e of G.enemies) {
    if (e.dead || e === exclude || e.state === "fall") continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d > far) continue;
    const a = Math.abs(angDiff(cam.yaw, Math.atan2(e.x - p.x, e.z - p.z)));
    if (a > 1.25 && d > 5) continue;
    if (!G.world.los(p.x, p.z, e.x, e.z)) continue;
    const s = a * 8 + d * 0.5;
    if (s < bs) {
      bs = s;
      best = e;
    }
  }
  return best;
}
function aimYaw(base, range = 4.8, cone = 1.1) {
  const p = G.player;
  if (p.lock) return Math.atan2(p.lock.x - p.x, p.lock.z - p.z);
  let best = null,
    bs = 1e9;
  for (const e of G.enemies) {
    if (e.dead || e.state === "fall") continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d > range + e.r) continue;
    const a = Math.abs(angDiff(base, Math.atan2(e.x - p.x, e.z - p.z)));
    if (a > cone) continue;
    const s = a * 2 + d * 0.4;
    if (s < bs) {
      bs = s;
      best = e;
    }
  }
  return best ? Math.atan2(best.x - p.x, best.z - p.z) : base;
}
// ranged aim: lock target, else the enemy nearest the camera's forward line, else straight ahead
function aimRanged() {
  const p = G.player;
  if (p.lock) return Math.atan2(p.lock.x - p.x, p.lock.z - p.z);
  let best = null,
    bs = 1;
  for (const e of G.enemies) {
    if (e.dead || e.state === "fall") continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d > 36) continue;
    const ey = Math.atan2(e.x - p.x, e.z - p.z),
      s = Math.abs(angDiff(cam.yaw, ey)) / (d < 6 ? 0.9 : 0.3);
    if (s < bs && G.world.los(p.x, p.z, e.x, e.z)) {
      bs = s;
      best = ey;
    }
  }
  return best === null ? cam.yaw : best;
}
function fire(spec, a, extra) {
  const p = G.player,
    s = Object.assign({}, spec, extra);
  G.projs.push({
    x: p.x + Math.sin(a) * 0.7,
    y: s.y || 1.25,
    z: p.z + Math.cos(a) * 0.7,
    vx: Math.sin(a) * s.speed,
    vz: Math.cos(a) * s.speed,
    life: s.life || 1.2,
    own: "p",
    dmg: s.dmg,
    post: s.post,
    kind: s.kind,
    c: s.c || p.cls.col,
    aoe: s.aoe || 0,
    rad: s.rad || 0,
    heavy: !!s.heavy,
    big: !!s.big,
    hitSet: s.pierce ? new Set() : null,
  });
}
function startMove(id, base, free) {
  const p = G.player,
    m = MOVES[id];
  if (p.stam <= 0 && !free) return false;
  if (!free) {
    p.stam -= m.stam * (p.buff === "berserk" ? 0.5 : 1);
    p.stamDelay = 0.75;
  }
  p.state = "attack";
  p.move = id;
  p.t = 0;
  p.hitSet = new Set();
  p.arcDone = false;
  const b0 = base === undefined ? p.yaw : base;
  p.aim = m.proj
    ? aimRanged()
    : m.reach
      ? aimYaw(b0, m.range + 0.5, 0.7)
      : aimYaw(b0);
  p.buf = null;
  if (m.ifr) p.iframe = Math.max(p.iframe, m.ifr);
  return true;
}
function startDodge(ix, iz, il, free) {
  const p = G.player,
    d = p.cls.dodge;
  if (p.stam <= 0 && !free) return false;
  if (!free) {
    p.stam -= d.cost;
    p.stamDelay = 0.7;
  }
  p.state = "dodge";
  p.t = 0;
  p.pdUsed = false;
  p.buf = null;
  p.ddur = d.dur;
  if (il > 0) {
    p.ddx = ix;
    p.ddz = iz;
    p.ddist = d.dist;
    if (!p.lock && !free) p.yaw = Math.atan2(ix, iz);
  } else {
    p.ddx = -Math.sin(p.yaw);
    p.ddz = -Math.cos(p.yaw);
    p.ddist = d.dist * 0.63;
  }
  p.iframe = d.ifr;
  ghost(p);
  if (d.warp) {
    SFX.blink();
    sparks(p.x, 1.1, p.z, 12, p.cls.col, 4, 0.4);
  } else SFX.dodge();
  return true;
}
function startExecute(e) {
  const p = G.player,
    a = Math.atan2(p.x - e.x, p.z - e.z);
  p.state = "execute";
  PAD.rumble("execute");
  p.t = 0;
  p.exT = e;
  p.exDone = false;
  // the Enforcer steps back and finishes with a sniper shot
  const back = e.r + (p.clsId === "enforcer" ? 4.5 : 1.0);
  p.exX = e.x + Math.sin(a) * back;
  p.exZ = e.z + Math.cos(a) * back;
  p.iframe = 0.9;
  p.buf = null;
  e.dur = Math.max(e.dur, e.t + 1.0);
  ghost(p);
}
function startBlink(ix, iz, il) {
  const p = G.player,
    w = G.world;
  let e = p.lock;
  if (!e) {
    e = pickLock();
    if (e && Math.hypot(e.x - p.x, e.z - p.z) > 16) e = null;
  }
  let spot = null;
  if (e) {
    for (const off of [PI, PI - 0.9, PI + 0.9, PI - 1.6, PI + 1.6]) {
      const a = e.yaw + off,
        tx = e.x + Math.sin(a) * (e.r + 1.15),
        tz = e.z + Math.cos(a) * (e.r + 1.15);
      if (w.fieldAt(tx, tz) > 0.55) {
        spot = [tx, tz];
        break;
      }
    }
  }
  if (e && spot) {
    if (p.focus < 40) {
      say("Not enough focus", "bad", 0.8);
      return false;
    }
    p.focus -= 40;
    p.bT = e;
  } else {
    if (p.focus < 25) {
      say("Not enough focus", "bad", 0.8);
      return false;
    }
    const dx = il > 0 ? ix : Math.sin(p.yaw),
      dz = il > 0 ? iz : Math.cos(p.yaw);
    let ok = 0;
    for (let d = 0.5; d <= 7.5; d += 0.5) {
      if (w.fieldAt(p.x + dx * d, p.z + dz * d) > 0.6) ok = d;
      else break;
    }
    if (ok < 2) return false;
    p.focus -= 25;
    spot = [p.x + dx * ok, p.z + dz * ok];
    p.bT = null;
    if (!p.lock) p.yaw = Math.atan2(dx, dz);
  }
  p.state = "blink";
  p.t = 0;
  p.bx = spot[0];
  p.bz = spot[1];
  p.bDone = false;
  p.bHit = false;
  p.iframe = 0.5;
  p.buf = null;
  SFX.blink();
  ghost(p);
  sparks(p.x, 1.1, p.z, 14, CYAN, 4, 0.5);
  return true;
}
// The hall plaque the player is at: within 2.6 m of its face and roughly in
// the camera's view, or null.
function plaqueAt() {
  const p = G.player;
  if (G.zone !== "hub" || !p) return null;
  for (const q of G.world.plaques) {
    if (Math.hypot(q.x - p.x, q.z - p.z) > 2.6) continue;
    if (Math.abs(angDiff(cam.yaw, Math.atan2(q.x - p.x, q.z - p.z))) < 1.2)
      return q;
  }
  return null;
}
// Inspecting a plaque. G.insp is { q, k, dir, syms, stick } or null: k runs
// 0 to 1 over 0.5 s while opening (dir 1) and back while closing (dir -1),
// and drives the camera and the card.
const INSPECT_T = 0.5;
// what a locked plaque says instead of the class name
const PLAQUE_TEXT = {
  enforcer: "The one who settles accounts",
  sapper: "The one who brings the roof down",
  riftwalker: "Sealed",
};
// A code is a list of action names: fwd, back, left, right, dodge, heal and
// tool, entered with whatever they are bound to. Its hash is taken over the
// names joined by spaces. Only the hash ships; the codes themselves are kept
// out of the repo. codeText writes a code in an input's own notation.
const SHIPPED_CODES = {
  enforcer: { hash: "14ac1f9c18e2c", len: 10 },
  sapper: { hash: "b469f1954f03b", len: 10 },
};
const PLAQUE_CODES = {};
function resetPlaqueCodes() {
  for (const k in PLAQUE_CODES) delete PLAQUE_CODES[k];
  for (const k in SHIPPED_CODES) PLAQUE_CODES[k] = { ...SHIPPED_CODES[k] };
}
resetPlaqueCodes();
// for tests: give a plaque a code of their own
function setPlaqueCode(id, syms) {
  const a = Array.isArray(syms) ? syms : syms.trim().split(/\s+/);
  PLAQUE_CODES[id] = { hash: codeHash(a.join(" ")), len: a.length };
}
// the input in use: "kb", "touch", or the pad family "xbox" or "ps"
function inputMode() {
  return PAD.active ? PAD.fam : TOUCH.on ? "touch" : "kb";
}
// One code symbol in an input's notation. Directions are the D-pad's arrows
// on a pad and by touch, the movement keys on a keyboard; the actions are
// their bound key, pad button or touch button.
const SYM_ARROW = { fwd: "↑", back: "↓", left: "←", right: "→" };
const SYM_TOUCH = { dodge: "DODGE", heal: "FLASK", tool: "TOOL" };
function symText(sym, mode) {
  if (mode === "kb") return keyName(BIND[sym]);
  if (SYM_ARROW[sym]) return SYM_ARROW[sym];
  if (mode === "touch") return SYM_TOUCH[sym] || sym;
  return padName(PAD_BIND[sym], mode);
}
function codeText(syms, mode = inputMode()) {
  return syms.map((s) => symText(s, mode));
}
// a 53-bit string hash (cyrb53), as hex
function codeHash(str) {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
// This update's new code symbols, in order. The actions are read first, so a
// key that Interact shares with one of them enters the symbol. Only presses
// count, so a key held as the plaque opened adds nothing, and the left stick
// counts once per push.
function readSyms() {
  const out = [],
    i = G.insp;
  // the D-pad first and raw, so an action bound to it still enters its
  // direction; Interact's own button is left to close the plaque
  for (const [c, sy] of [
    ["P:12", "fwd"],
    ["P:13", "back"],
    ["P:14", "left"],
    ["P:15", "right"],
  ])
    if (c !== PAD_BIND.interact && tap(c)) out.push(sy);
  for (const a of ["dodge", "heal", "tool"]) if (hit(a)) out.push(a);
  for (const a of ["fwd", "back", "left", "right"]) if (hit(a)) out.push(a);
  const m = PAD.move;
  if (i && m.mag < 0.2) i.stick = false;
  else if (i && !i.stick && m.mag > 0.5) {
    i.stick = true;
    out.push(
      Math.abs(m.x) > Math.abs(m.y) ? (m.x > 0 ? "right" : "left") : m.y > 0 ? "fwd" : "back",
    );
  }
  return out;
}
function openPlaque(q) {
  const p = G.player;
  p.state = "inspect";
  p.vx = p.vz = 0;
  p.sprint = false;
  p.buf = null;
  p.lock = null;
  // a stick already pushed must come back to rest before it counts
  G.insp = { q, k: 0, dir: 1, syms: [], stick: PAD.move.mag >= 0.2 };
  SFX.whoosh(false);
}
// now skips the ease, for leaving play
function closePlaque(now) {
  const p = G.player;
  if (!G.insp) return;
  if (now) {
    G.insp = null;
    if (p && p.state === "inspect") p.state = "free";
  } else G.insp.dir = -1;
}
function inspectUpdate(dt) {
  const p = G.player,
    i = G.insp;
  p.vx = p.vz = 0;
  p.speed = 0;
  if (!i) {
    p.state = "free";
    return;
  }
  i.k = clamp(i.k + (i.dir * dt) / INSPECT_T, 0, 1);
  if (i.dir < 0) {
    if (i.k <= 0) closePlaque(true);
    return;
  }
  // a live plaque whose class is still locked takes its code
  const id = i.q.cls,
    code = id && !classOpen(id) && PLAQUE_CODES[id];
  for (const sy of readSyms()) {
    if (!code) continue;
    i.syms.push(sy);
    if (i.syms.length > 10) i.syms.shift();
    if (
      i.syms.length >= code.len &&
      codeHash(i.syms.slice(-code.len).join(" ")) === code.hash
    ) {
      unlockClass(id);
      i.flare = true;
      SFX.unlock();
      say(CLASSES[id].name.toUpperCase() + " UNLOCKED", "crit", 2.5);
      say("Choose it from the class picker", "good", 2.5);
      break;
    }
  }
  if (hit("interact")) i.dir = -1;
}
// The grapple's target: the locked enemy, or the one the camera points at,
// within 14 m and in sight.
function grappleTarget() {
  const p = G.player,
    w = G.world,
    ok = (e) =>
      e &&
      !e.dead &&
      Math.hypot(e.x - p.x, e.z - p.z) <= 14 &&
      w.los(p.x, p.z, e.x, e.z);
  if (p.lock) return ok(p.lock) ? p.lock : null;
  const a = aimRanged();
  let best = null,
    bd = 0.3;
  for (const e of G.enemies) {
    if (!ok(e)) continue;
    const d = Math.abs(angDiff(a, Math.atan2(e.x - p.x, e.z - p.z)));
    if (d <= bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}
// light enemies come to the Enforcer; heavy ones, the boss and the pinned
// dummy pull the Enforcer to them
function grappleLight(e) {
  return !e.def.boss && !e.def.dummy && e.def.poise === 0;
}
function startGrapple() {
  const p = G.player,
    e = grappleTarget();
  if (!e) {
    say("No target", "bad", 0.8);
    return false;
  }
  const a = Math.atan2(e.x - p.x, e.z - p.z),
    gap = e.r + 1.2;
  p.yaw = a;
  p.gT = e;
  SFX.hook();
  if (grappleLight(e)) {
    e.yank = {
      tx: p.x + Math.sin(a) * gap,
      tz: p.z + Math.cos(a) * gap,
      t: 0.25,
    };
    p.throwT = 0.3;
    p.gLine = 0.3;
  } else {
    p.state = "grapple";
    p.t = 0;
    p.gx = e.x - Math.sin(a) * gap;
    p.gz = e.z - Math.cos(a) * gap;
    p.buf = null;
    p.gLine = 0.35;
    if (!e.def.dummy && !e.def.boss && e.state !== "stagger") {
      e.state = "hit";
      e.t = 0;
      e.hitT = 0.85;
      e.token = false;
    }
  }
  return true;
}
function useSpecial(ix, iz, il) {
  const p = G.player,
    sp = p.cls.special,
    w = G.world;
  if (sp.id === "blink") return startBlink(ix, iz, il);
  if (p.focus < sp.cost) {
    say("Not enough focus", "bad", 0.8);
    return false;
  }
  if (sp.id === "berserk") {
    p.buff = "berserk";
    p.buffT = 8;
    SFX.roar();
    sparks(p.x, 1.2, p.z, 30, ORANGE, 7, 0.6);
    G.shake = 0.6;
    say("BERSERK", "crit", 1);
  } else if (sp.id === "fortress") {
    p.buff = "fortress";
    p.buffT = 6;
    SFX.shrine();
    SFX.parry();
    sparks(p.x, 1.2, p.z, 30, GOLD, 6, 0.6);
    say("FORTRESS", "good", 1);
  } else if (sp.id === "meteor") {
    let tx, tz;
    if (p.lock) {
      tx = p.lock.x;
      tz = p.lock.z;
    } else {
      const a = aimRanged();
      let ok = 2;
      for (let d = 2; d <= 11; d += 0.5) {
        if (w.fieldAt(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d) > 0.3)
          ok = d;
        else break;
      }
      let best = null,
        bd = 1e9;
      for (const e of G.enemies) {
        if (e.dead || e.state === "fall") continue;
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (
          d < 30 &&
          Math.abs(angDiff(a, Math.atan2(e.x - p.x, e.z - p.z))) < 0.2 &&
          d < bd &&
          w.los(p.x, p.z, e.x, e.z)
        ) {
          bd = d;
          best = e;
        }
      }
      if (best) {
        tx = best.x;
        tz = best.z;
      } else {
        tx = p.x + Math.sin(a) * ok;
        tz = p.z + Math.cos(a) * ok;
      }
      p.yaw = a;
    }
    G.rings.push({
      x: tx,
      z: tz,
      r: 5.5,
      t: 0,
      dur: 0.9,
      kind: "warn",
      c: VIOLET,
    });
    G.pending.push({
      t: 0.9,
      x: tx,
      z: tz,
      r: 5.5,
      dmg: 75,
      post: 60,
      c: VIOLET,
      beam: true,
    });
    SFX.tele(true);
    p.throwT = 0.5;
    say("STARFALL", "good", 1);
  } else if (sp.id === "cavein") {
    // thrown at the lock target or along the camera, short of any wall
    const a = p.lock ? Math.atan2(p.lock.x - p.x, p.lock.z - p.z) : cam.yaw,
      far = p.lock
        ? Math.min(CAVEIN.range, Math.hypot(p.lock.x - p.x, p.lock.z - p.z))
        : 9;
    let ok = 0.5;
    for (let d = 0.5; d <= far; d += 0.25) {
      if (w.fieldAt(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d) > 0.3) ok = d;
      else break;
    }
    p.yaw = a;
    p.throwT = 0.4;
    SFX.whoosh(true);
    startCaveIn(p.x + Math.sin(a) * ok, p.z + Math.cos(a) * ok);
  } else if (sp.id === "drop") {
    // the floor opens at the lock target or along the camera, short of walls
    const a = p.lock ? Math.atan2(p.lock.x - p.x, p.lock.z - p.z) : cam.yaw,
      far = p.lock
        ? Math.min(CAVEIN.range, Math.hypot(p.lock.x - p.x, p.lock.z - p.z))
        : 9;
    let ok = 0.5;
    for (let d = 0.5; d <= far; d += 0.25) {
      if (w.fieldAt(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d) > 0.3) ok = d;
      else break;
    }
    p.yaw = a;
    p.throwT = 0.3;
    startDrop(p.x + Math.sin(a) * ok, p.z + Math.cos(a) * ok);
  } else if (sp.id === "grapple") {
    if (!startGrapple()) return false;
  } else if (sp.id === "volley") {
    const a = aimRanged();
    p.yaw = a;
    for (let i = -3; i <= 3; i++)
      fire(
        { speed: 48, dmg: 15, post: 12, kind: "arrow", pierce: true },
        a + i * 0.13,
      );
    SFX.whoosh(true);
    SFX.knife();
    p.throwT = 0.3;
    G.shake = 0.3;
  }
  p.focus -= sp.cost;
  return true;
}
function useTool(ix, iz, il) {
  const p = G.player,
    id = p.cls.tool.id;
  if (p.tool <= 0 || p.toolCD > 0) return false;
  if (id === "rush") {
    if (!startMove("trush", il > 0 ? Math.atan2(ix, iz) : p.yaw, true))
      return false;
    SFX.dodge();
    ghost(p);
  } else if (id === "knife") {
    const a = p.lock ? Math.atan2(p.lock.x - p.x, p.lock.z - p.z) : aimRanged();
    p.yaw = a;
    p.throwT = 0.2;
    fire({ speed: 32, dmg: 14, post: 14, kind: "knife", life: 1.1 }, a);
    SFX.knife();
  } else if (id === "rend") {
    const a = aimYaw(il > 0 ? Math.atan2(ix, iz) : p.yaw, 13, 0.8);
    p.yaw = a;
    p.throwT = 0.3;
    fire(
      {
        speed: 20,
        dmg: 20,
        post: 24,
        kind: "wave",
        pierce: true,
        rad: 0.9,
        life: 0.75,
        heavy: true,
        y: 0.5,
      },
      a,
    );
    SFX.whoosh(true);
    G.shake = 0.3;
  } else if (id === "nova") {
    p.throwT = 0.35;
    p.iframe = Math.max(p.iframe, 0.25);
    explode(p.x, p.z, 5, 12, 32, VIOLET);
  } else if (id === "sticky") {
    const a = p.lock ? Math.atan2(p.lock.x - p.x, p.lock.z - p.z) : aimRanged();
    p.yaw = a;
    p.throwT = 0.25;
    fire({ speed: 22, dmg: 0, post: 0, kind: "sticky", life: 0.9 }, a);
    SFX.knife();
  } else if (id === "rift") {
    // along the camera, the furthest spot with room, from near to far
    const a = cam.yaw,
      w = G.world;
    let ok = 0;
    for (let d = RIFT.near; d <= RIFT.far + 1e-6; d += 0.25) {
      if (w.fieldAt(p.x + Math.sin(a) * d, p.z + Math.cos(a) * d) < RIFT.room)
        break;
      ok = d;
    }
    const r = ok
      ? openRift(p.x + Math.sin(a) * ok, p.z + Math.cos(a) * ok, a + PI)
      : "room";
    if (typeof r === "string") {
      say(
        r === "close" ? "Too close to the other rift" : "No room for a rift",
        "bad",
        0.8,
      );
      return false;
    }
    p.yaw = a;
    p.throwT = 0.25;
  } else if (id === "mine") {
    plantMine(p.x, p.z);
    p.throwT = 0.3;
    SFX.mine();
  } else if (id === "leap") {
    const a = aimRanged();
    p.yaw = a;
    fire({ speed: 46, dmg: 18, post: 20, kind: "arrow", heavy: true }, a);
    SFX.knife();
    startDodge(-Math.sin(a), -Math.cos(a), 1, true);
    p.iframe = 0.36;
  }
  p.tool--;
  p.toolCD = 0.35;
  return true;
}
function playerUpdate(dt) {
  const p = G.player,
    w = G.world,
    c = p.cls;
  p.flash = Math.max(0, p.flash - dt * 5);
  p.toolCD -= dt;
  p.parryCD -= dt;
  p.restCD -= dt;
  if (G.zone === "hub") {
    // the hall is for practice: focus and tool charges come back on their own
    p.focus = Math.min(100, p.focus + 25 * dt);
    p.refillT += dt;
    if (p.refillT >= 1.5) {
      p.refillT = 0;
      p.tool = Math.min(c.tool.max, p.tool + 1);
    }
  }
  if (p.throwT > 0) p.throwT -= dt;
  if (p.gLine > 0) p.gLine -= dt;
  if (p.state === "dead") {
    p.t += dt;
    return;
  }
  if (p.state === "inspect") {
    inspectUpdate(dt);
    return;
  }
  // a close-up lasts only while the player is in it: whatever moved them out
  // (a hit, a bomb going off) puts the camera back at once
  if (G.insp) closePlaque(true);
  p.iframe = Math.max(0, p.iframe - dt);
  if (p.buff) {
    p.buffT -= dt;
    if (p.buffT <= 0) p.buff = null;
    else if (Math.random() < dt * 14)
      sparks(
        p.x,
        0.4 + Math.random() * 1.2,
        p.z,
        1,
        p.buff === "berserk" ? ORANGE : GOLD,
        1.5,
        0.5,
        0.09,
      );
  }
  if (c.focusRegen) p.focus = Math.min(100, p.focus + c.focusRegen * dt);
  // input
  let f = (held("fwd") ? 1 : 0) - (held("back") ? 1 : 0),
    s = (held("right") ? 1 : 0) - (held("left") ? 1 : 0),
    im = 1; // how far the touch stick is pushed
  if (TOUCH.move.mag > 0) {
    f = TOUCH.move.y;
    s = TOUCH.move.x;
    im = TOUCH.move.mag;
  } else if (PAD.move.mag > 0) {
    f = PAD.move.y;
    s = PAD.move.x;
    im = PAD.move.mag;
  }
  const fx = Math.sin(cam.yaw),
    fz = Math.cos(cam.yaw);
  let ix = fx * f - fz * s,
    iz = fz * f + fx * s;
  const il = Math.hypot(ix, iz);
  if (il > 0) {
    ix /= il;
    iz /= il;
  }
  // at a plaque, Interact opens it and takes the press, even from an action
  // that shares the key
  if (p.state === "free" && G.zone === "hub") {
    const q = plaqueAt();
    if (q && hit("interact")) {
      openPlaque(q);
      return;
    }
  }
  let act = null;
  if (hit("light")) act = "light";
  if (hit("heavy")) act = "heavy";
  if (hit("dodge")) act = "dodge";
  if (hit("tool")) act = "tool";
  if (hit("heal")) act = "heal";
  if (hit("special")) act = "special";
  if (hit("lock")) {
    p.lock = p.lock ? null : pickLock();
    if (!p.lock) cam.pitch = Math.min(cam.pitch, 0.5);
  }
  if (mouse.wheel && p.lock) {
    const n = pickLock(p.lock);
    if (n) p.lock = n;
  }
  mouse.wheel = 0;
  if (
    p.lock &&
    (p.lock.dead ||
      Math.hypot(p.lock.x - p.x, p.lock.z - p.z) > (c.ranged ? 42 : 30))
  )
    p.lock = null;
  const guardPress = hit("guard"),
    guardHeld = held("guard");
  if (act) {
    p.buf = act;
    p.bufT = 0.3;
  }
  if (p.buf) {
    p.bufT -= dt;
    if (p.bufT <= 0) p.buf = null;
  }
  const lockYaw = p.lock ? Math.atan2(p.lock.x - p.x, p.lock.z - p.z) : null;
  const inYaw = () => (il > 0 ? Math.atan2(ix, iz) : p.yaw);
  // p.sprint is cleared each update before a buffered attack is read, so a
  // running start is judged from the update before
  const wasSprint = p.sprint;
  const doAct = (a) => {
    if (a === "light") {
      const e = nearestStaggered();
      if (e) {
        startExecute(e);
        return true;
      }
      return startMove(
        wasSprint && p.speed > c.run * 0.8 ? c.dash : c.chain,
        inYaw(),
      );
    }
    if (a === "heavy") return startMove(c.heavy, inYaw());
    if (a === "dodge") return startDodge(ix, iz, il);
    if (a === "tool") {
      p.buf = null;
      return useTool(ix, iz, il);
    }
    if (a === "heal") {
      p.buf = null;
      if (p.flasks > 0 && p.hp < p.maxHp) {
        p.state = "heal";
        p.t = 0;
        p.healed = false;
        return true;
      }
      return false;
    }
    if (a === "special") {
      p.buf = null;
      return useSpecial(ix, iz, il);
    }
    return false;
  };
  const startGuard = () => {
    p.state = "guard";
    p.guardT = 0;
    p.parryWin = p.parryCD > 0 ? c.parry * 0.5 : c.parry;
    p.parryCD = 0.55;
  };
  let mvx = 0,
    mvz = 0;
  p.sprint = false;
  switch (p.state) {
    case "free": {
      if ((guardPress || guardHeld) && p.stam > 0) {
        startGuard();
        break;
      }
      if (p.buf && doAct(p.buf)) break;
      // a pad stick sprints from the latch, and only at a hard push
      const padMove = TOUCH.move.mag === 0 && PAD.move.mag > 0,
        run = padMove ? PAD.sprint && PAD.move.mag >= 0.6 : held("sprint");
      p.sprint = run && il > 0 && p.stam > 0;
      const sp = p.sprint ? c.run : (p.lock ? c.walk * 0.88 : c.walk) * im;
      p.vx = damp(p.vx, ix * sp, 14, dt);
      p.vz = damp(p.vz, iz * sp, 14, dt);
      mvx = p.vx;
      mvz = p.vz;
      if (p.sprint) {
        p.stam -= 11 * dt;
        p.stamDelay = 0.5;
      }
      if (p.lock && !p.sprint) p.yaw = dampAng(p.yaw, lockYaw, 16, dt);
      else if (il > 0) p.yaw = dampAng(p.yaw, Math.atan2(ix, iz), 14, dt);
      break;
    }
    case "guard": {
      p.guardT += dt;
      p.stamDelay = Math.max(p.stamDelay, 0.15);
      if (
        p.buf === "dodge" ||
        p.buf === "light" ||
        p.buf === "heavy" ||
        p.buf === "special" ||
        p.buf === "tool"
      ) {
        if (doAct(p.buf)) break;
      }
      if (guardPress) {
        p.guardT = 0;
        p.parryWin = c.parry * 0.5;
        p.parryCD = 0.55;
      }
      if (!guardHeld && p.guardT >= 0.22) {
        p.state = "free";
        break;
      }
      p.vx = damp(p.vx, ix * 2.4, 14, dt);
      p.vz = damp(p.vz, iz * 2.4, 14, dt);
      mvx = p.vx;
      mvz = p.vz;
      p.yaw = dampAng(p.yaw, p.lock ? lockYaw : cam.yaw, 16, dt);
      break;
    }
    case "attack": {
      const m = MOVES[p.move];
      p.t += dt;
      const t = p.t;
      if (m.proj) {
        if (t < m.wind) p.aim = aimRanged();
      } else if (p.lock) p.aim = lockYaw;
      if (t < m.wind + m.act * 0.5) p.yaw = dampAng(p.yaw, p.aim, 24, dt);
      if (m.proj && m.lunge && t < m.wind + m.act) {
        const v = m.lunge / (m.wind + m.act);
        p.vx = Math.sin(p.yaw) * v;
        p.vz = Math.cos(p.yaw) * v;
        mvx = p.vx;
        mvz = p.vz;
      } else if (m.proj) {
        p.vx = damp(p.vx, ix * c.walk * 0.55, 12, dt);
        p.vz = damp(p.vz, iz * c.walk * 0.55, 12, dt);
        mvx = p.vx;
        mvz = p.vz;
      } else {
        if (t > m.wind * 0.4 && t < m.wind + m.act) {
          let blocked = false;
          const hx = Math.sin(p.yaw),
            hz = Math.cos(p.yaw);
          for (const e of G.enemies) {
            if (e.dead || e.state === "fall") continue;
            const dx = e.x - p.x,
              dz = e.z - p.z,
              d = Math.hypot(dx, dz);
            if (d < e.r + p.r + 0.75 && dx * hx + dz * hz > 0) {
              blocked = true;
              break;
            }
          }
          if (!blocked) {
            const v = m.lunge / (m.wind * 0.6 + m.act);
            mvx = hx * v;
            mvz = hz * v;
          }
        }
        p.vx = mvx;
        p.vz = mvz;
      }
      if (t >= m.wind && !p.arcDone) {
        p.arcDone = true;
        SFX.whoosh(m.heavy);
        if (m.blast) {
          const b = m.blast;
          explode(
            p.x + Math.sin(p.yaw) * b.d,
            p.z + Math.cos(p.yaw) * b.d,
            b.r,
            b.dmg,
            b.post,
            c.col,
          );
          SFX.thud(true);
        } else if (m.proj) {
          p.yaw = p.aim;
          const n = m.proj.pellets || 1;
          for (let i = 0; i < n; i++)
            fire(m.proj, p.aim + (i - (n - 1) / 2) * (m.proj.spread || 0));
          if (m.proj.kind === "arrow") SFX.knife();
          else if (m.proj.kind === "pellet") SFX.shotgun();
          else if (m.proj.kind === "bullet") SFX.gun(m.proj.heavy);
          else SFX.shot();
        } else if (m.lance)
          G.arcs.push({
            lance: true,
            x: p.x,
            y: 1.2,
            z: p.z,
            yaw: p.yaw,
            len: m.range + 0.3,
            t: 0,
            dur: 0.2,
            c: c.col,
            wd: m.anim === "bash" ? 0.7 : 0.26,
          });
        else if (m.reach) {
          // the cut comes out of a small tear 1.4 m short of the target, to
          // one side
          const e = G.enemies.find(
              (e) =>
                !e.dead &&
                Math.hypot(e.x - p.x, e.z - p.z) < m.range + e.r &&
                Math.abs(angDiff(p.yaw, Math.atan2(e.x - p.x, e.z - p.z))) <
                  m.arc / 2 + 0.2,
            ),
            d = e ? Math.max(0.8, Math.hypot(e.x - p.x, e.z - p.z) - 1.4) : 2,
            sx = -Math.cos(p.yaw) * 0.5 * m.dir,
            sz = Math.sin(p.yaw) * 0.5 * m.dir;
          G.arcs.push({
            x: p.x + Math.sin(p.yaw) * d + sx,
            y: 1.2,
            z: p.z + Math.cos(p.yaw) * d + sz,
            yaw: p.yaw,
            tilt: m.tilt,
            r0: 0.2,
            r1: 1.6,
            a0: 1.25 * m.dir,
            a1: -1.25 * m.dir,
            t: 0,
            dur: 0.24,
            c: c.col,
            tear: true,
          });
        } else {
          const wd = m.wide || 1;
          G.arcs.push({
            x: p.x,
            y: 1.2,
            z: p.z,
            yaw: p.yaw,
            tilt: m.tilt,
            r0: 0.9,
            r1: m.range - 0.1,
            a0: m.arc >= TAU ? 0 : 1.25 * m.dir * (m.tilt > 1.2 ? 1.5 : 1),
            a1: m.arc >= TAU ? TAU : -1.25 * m.dir * (m.tilt > 1.2 ? 0.2 : 1),
            t: 0,
            dur: 0.2 * wd,
            c: c.col,
          });
          if (m.dbl)
            G.arcs.push({
              x: p.x,
              y: 1.2,
              z: p.z,
              yaw: p.yaw,
              tilt: -m.tilt,
              r0: 0.9,
              r1: m.range - 0.1,
              a0: -1.25,
              a1: 1.25,
              t: 0,
              dur: 0.2,
              c: c.col,
            });
        }
      }
      if (
        !m.proj &&
        !m.blast &&
        t >= m.wind &&
        t < m.wind + m.act + 0.03
      ) {
        for (const e of G.enemies) {
          if (e.dead || e.state === "fall" || p.hitSet.has(e)) continue;
          const dx = e.x - p.x,
            dz = e.z - p.z,
            d = Math.hypot(dx, dz);
          if (d > m.range + e.r) continue;
          if (
            m.arc < TAU &&
            d > e.r + 0.8 &&
            Math.abs(angDiff(p.yaw, Math.atan2(dx, dz))) > m.arc / 2
          )
            continue;
          if (!w.los(p.x, p.z, e.x, e.z)) continue;
          p.hitSet.add(e);
          hitEnemy(e, m.dmg, m.post, { heavy: m.heavy, src: "melee" });
        }
      }
      const tr = t - m.wind - m.act;
      if (tr > 0) {
        if (p.buf === "dodge" && doAct("dodge")) break;
        if (tr > m.rec * 0.3) {
          if (p.buf === "light") {
            const e = nearestStaggered();
            if (e) {
              startExecute(e);
              break;
            }
            if (m.next && startMove(m.next, inYaw())) break;
          }
          if (p.buf === "heavy" && tr > m.rec * 0.45 && doAct("heavy")) break;
          if ((p.buf === "special" || p.buf === "tool") && doAct(p.buf)) break;
          if ((guardPress || guardHeld) && tr > m.rec * 0.5 && p.stam > 0) {
            startGuard();
            break;
          }
        }
        if (tr >= m.rec) {
          p.state = "free";
          if (p.buf === "light") doAct("light");
        }
      } else if (t < m.wind * 0.8 && p.buf === "dodge" && !m.ifr)
        doAct("dodge");
      break;
    }
    case "dodge": {
      p.t += dt;
      const dur = p.ddur,
        k = p.t / dur,
        v = (p.ddist / dur) * (1.6 - 1.2 * k);
      mvx = p.ddx * v;
      mvz = p.ddz * v;
      p.vx = mvx * 0.4;
      p.vz = mvz * 0.4;
      if (p.lock) p.yaw = dampAng(p.yaw, lockYaw, 10, dt);
      if (k > 0.72 && p.buf === "light") {
        p.state = "free";
        startMove(c.dash, inYaw());
        break;
      }
      if (k >= 1) {
        p.state = "free";
        if (c.dodge.warp) sparks(p.x, 1.1, p.z, 10, c.col, 4, 0.4);
      }
      break;
    }
    case "hit": {
      p.t += dt;
      p.vx = p.vz = 0;
      if (p.t > 0.34) p.state = "free";
      break;
    }
    case "gbreak": {
      p.t += dt;
      p.vx = p.vz = 0;
      if (p.t > 1.0) {
        p.state = "free";
        p.stam = 25;
      }
      break;
    }
    case "heal": {
      p.t += dt;
      p.vx = damp(p.vx, ix * 1.8, 10, dt);
      p.vz = damp(p.vz, iz * 1.8, 10, dt);
      mvx = p.vx;
      mvz = p.vz;
      if (p.t > 0.55 && !p.healed) {
        p.healed = true;
        p.flasks--;
        p.hp = Math.min(p.maxHp, p.hp + 45);
        SFX.heal();
        sparks(p.x, 1.2, p.z, 14, [0.4, 1, 0.5], 3, 0.7);
      }
      if (p.t > 0.9) p.state = "free";
      if (p.buf === "dodge" && p.t < 0.4) doAct("dodge");
      break;
    }
    case "execute": {
      p.t += dt;
      const e = p.exT;
      p.x = damp(p.x, p.exX, 22, dt);
      p.z = damp(p.z, p.exZ, 22, dt);
      p.yaw = Math.atan2(e.x - p.x, e.z - p.z);
      p.vx = p.vz = 0;
      p.iframe = Math.max(p.iframe, 0.2);
      if (p.t >= 0.26 && !p.exDone) {
        p.exDone = true;
        SFX.exec();
        G.slowT = 0.4;
        G.shake = 1;
        G.flashWhite = 0.6;
        p.hp = Math.min(p.maxHp, p.hp + 10);
        p.focus = Math.min(100, p.focus + 12);
        const sniper = p.clsId === "enforcer",
          sapper = p.clsId === "sapper";
        if (sniper) {
          // a tracer all the way to the target, and a sticky bomb back
          SFX.gun(true);
          p.tool = Math.min(c.tool.max, p.tool + 1);
        }
        G.arcs.push({
          lance: true,
          x: p.x,
          y: sniper ? 1.45 : 1.2,
          z: p.z,
          yaw: p.yaw,
          len: sniper ? Math.hypot(e.x - p.x, e.z - p.z) : 3.5,
          t: 0,
          dur: 0.3,
          c: sniper ? c.col : AMBER,
          wd: sniper ? 0.1 : undefined,
        });
        sparks(e.x, 1.2 * e.fig.o.sc, e.z, 30, AMBER, 10, 0.6, 0.15);
        // the Sapper jams a charge in and kicks: the body flies on and the
        // charge goes off where it lands. The boss and the dummy are too
        // heavy to kick, so it goes off on them.
        let bx = e.x,
          bz = e.z;
        if (sapper) {
          const heavy = e.def.boss || e.def.dummy,
            a = Math.atan2(e.x - p.x, e.z - p.z);
          if (!heavy) {
            let d = 0;
            while (
              d < 4 &&
              G.world.fieldAt(
                e.x + Math.sin(a) * (d + 0.25),
                e.z + Math.cos(a) * (d + 0.25),
              ) > 0.5
            )
              d += 0.25;
            bx = e.x + Math.sin(a) * d;
            bz = e.z + Math.cos(a) * d;
          }
          G.pending.push({
            t: 0.45,
            x: bx,
            z: bz,
            r: 3.5,
            dmg: 50,
            post: 50,
            c: c.col,
          });
          SFX.thud(true);
          SFX.mine();
        }
        if (e.def.boss) {
          e.state = "recoil";
          e.t = 0;
          e.dur = 1.0;
          e.posture = 0;
          hitEnemy(e, 120, 0, { heavy: true, src: "exec" });
          if (!e.dead && e.state !== "roar") {
            e.state = "recoil";
            e.t = 0;
            e.dur = 1.0;
          }
        } else if (e.def.dummy) {
          // the dummy takes the execution and stands back up
          e.state = "idle";
          e.t = 0;
          e.posture = 0;
          G.hitstop = 0.13;
        } else {
          e.hp = 0;
          G.hitstop = 0.13;
          kill(e);
          if (sapper) {
            const k = Math.hypot(bx - e.x, bz - e.z) / 0.4;
            const a = Math.atan2(bx - e.x, bz - e.z);
            e.kick = { vx: Math.sin(a) * k, vz: Math.cos(a) * k, t: 0.4 };
          }
        }
        say("EXECUTION", "crit", 0.9);
      }
      if (p.t > 0.62) p.state = "free";
      break;
    }
    case "grapple": {
      // reeled to a heavy target, untouchable on the way
      p.t += dt;
      p.vx = p.vz = 0;
      p.iframe = Math.max(p.iframe, 0.1);
      const k = Math.min(1, dt / Math.max(dt, 0.3 - p.t + dt));
      p.x += (p.gx - p.x) * k;
      p.z += (p.gz - p.z) * k;
      w.resolve(p, p.r);
      if (p.gT && !p.gT.dead) p.yaw = Math.atan2(p.gT.x - p.x, p.gT.z - p.z);
      if (p.t >= 0.3) p.state = "free";
      break;
    }
    case "blink": {
      p.t += dt;
      p.vx = p.vz = 0;
      if (p.t >= 0.12 && !p.bDone) {
        p.bDone = true;
        p.x = p.bx;
        p.z = p.bz;
        if (p.bT) p.yaw = Math.atan2(p.bT.x - p.x, p.bT.z - p.z);
        sparks(p.x, 1.1, p.z, 14, CYAN, 4, 0.5);
        ghost(p);
      }
      if (p.bT && p.t >= 0.2 && !p.bHit) {
        p.bHit = true;
        SFX.whoosh(true);
        G.arcs.push({
          lance: true,
          x: p.x,
          y: 1.2,
          z: p.z,
          yaw: p.yaw,
          len: 3,
          t: 0,
          dur: 0.2,
          c: CYAN,
        });
        if (!p.bT.dead) hitEnemy(p.bT, 34, 30, { heavy: true, src: "blink" });
      }
      if (p.t > (p.bT ? 0.44 : 0.22)) {
        p.state = "free";
      }
      break;
    }
  }
  // knockback + integrate
  p.kx = damp(p.kx, 0, 9, dt);
  p.kz = damp(p.kz, 0, 9, dt);
  p.x += (mvx + p.kx) * dt;
  p.z += (mvz + p.kz) * dt;
  p.speed = Math.hypot(mvx, mvz);
  p.walk += p.speed * dt * 2.1;
  if (p.stamDelay > 0) p.stamDelay -= dt;
  else
    p.stam = Math.min(
      p.maxStam,
      p.stam +
        (p.state === "guard" ? (p.buff === "fortress" ? 38 : 12) : 38) * dt,
    );
  if (p.stam < -15) p.stam = -15;
  // shrines + gate
  for (const sh of w.shrines) {
    const d = Math.hypot(sh.x - p.x, sh.z - p.z);
    if (d < 0.95) {
      const a = Math.atan2(p.x - sh.x, p.z - sh.z);
      p.x = sh.x + Math.sin(a) * 0.95;
      p.z = sh.z + Math.cos(a) * 0.95;
    }
    if (
      d < 2.8 &&
      (!sh.lit ||
        (p.restCD <= 0 &&
          (p.hp < p.maxHp || p.flasks < 3 || p.tool < c.tool.max)))
    ) {
      const first = !sh.lit;
      sh.lit = true;
      G.checkpoint = sh;
      p.hp = p.maxHp;
      p.flasks = 3;
      p.tool = c.tool.max;
      p.restCD = 8;
      SFX.shrine();
      sparks(sh.x, 1.5, sh.z, 30, AMBER, 4, 1.0);
      say(first ? "SHRINE KINDLED" : "RESTED", "good", 2);
      if (first)
        say("Checkpoint set. Health, flasks and tools restored.", "", 3);
    }
  }
  if (
    G.gate &&
    G.gate.t > 1.2 &&
    Math.hypot(G.gate.x - p.x, G.gate.z - p.z) < 1.5
  ) {
    G.state = "win";
    SFX.win();
  }
}

// ---- enemies ----
function chooseAtk(e, dist) {
  const c = [];
  for (const k in e.def.atks) {
    const a = e.def.atks[k];
    if (a.trig === undefined) continue;
    if (a.p2 && e.phase < 2) continue;
    if (dist < (a.minTrig || 0)) continue;
    c.push(a);
  }
  if (!c.length) return null;
  let tot = 0;
  for (const a of c) tot += a.w || 1;
  let r = Math.random() * tot;
  for (const a of c) {
    r -= a.w || 1;
    if (r <= 0) return a;
  }
  return c[0];
}
function eStep(e, dx, dz, spd, dt) {
  e.x += dx * spd * dt;
  e.z += dz * spd * dt;
  e.speed = spd;
  e.walk += (spd * dt * 2.0) / e.fig.o.sc;
}
// Gives e a route to (x, z). A point nothing can route to becomes a straight
// walk, so an enemy never stands still for want of a route. At most two
// routes are found per update; false means ask again next step.
function setRoute(e, x, z) {
  if (G.routeN >= 2) return false;
  G.routeN++;
  e.route = G.world.route(e.x, e.z, x, z, e.r) || [{ x, z }];
  e.rgx = x;
  e.rgz = z;
  e.ri = 0;
  e.best = 1e9;
  e.stuck = 0;
  return true;
}
// The unit direction from e to the next point of its route, moving on past
// points it has reached. null when there is no route or it has been walked.
function routeAim(e) {
  const R = e.route;
  if (!R) return null;
  while (e.ri < R.length) {
    const q = R[e.ri],
      dx = q.x - e.x,
      dz = q.z - e.z,
      dl = Math.hypot(dx, dz);
    if (dl >= 0.6) return { x: dx / dl, z: dz / dl, d: dl };
    e.ri++;
    e.best = 1e9;
    e.stuck = 0;
  }
  return null;
}
// Walks e along its route. True once the last point is reached. A walk that
// makes no headway for 1.5 seconds drops the route and counts a failure.
function walkRoute(e, spd, dt) {
  if (!e.route) return false;
  const a = routeAim(e);
  if (!a) return true;
  if (a.d < e.best - 0.2) {
    e.best = a.d;
    e.stuck = 0;
  } else if ((e.stuck += dt) > 1.5) {
    e.route = null;
    e.fails++;
    return false;
  }
  e.yaw = turnTo(e.yaw, Math.atan2(a.x, a.z), e.def.turn * dt);
  eStep(e, a.x, a.z, spd, dt);
  return false;
}
function shoot(e, a, dmg, spd) {
  G.projs.push({
    x: e.x + Math.sin(a) * (e.r + 0.3),
    y: 1.25 * e.fig.o.sc,
    z: e.z + Math.cos(a) * (e.r + 0.3),
    vx: Math.sin(a) * spd,
    vz: Math.cos(a) * spd,
    life: 2.6,
    own: "e",
    dmg,
    src: e,
    kind: "spit",
    c: e.def.boss ? RED : [1, 0.45, 0.2],
  });
}
function enemyUpdate(e, dt) {
  const p = G.player,
    w = G.world,
    d = e.def;
  e.flash = Math.max(0, e.flash - dt * 6);
  e.speed = 0;
  if (d.dummy) {
    // pinned to its spot: no senses, no movement, no attacks
    e.x = e.hx;
    e.z = e.hz;
    e.yaw = e.hyaw;
    e.kx = e.kz = 0;
    e.postT += dt;
    if (e.state === "stagger") {
      e.t += dt;
      if (e.t > e.dur) {
        e.state = "idle";
        e.posture = 0;
      }
    } else if (e.postT > 2.5) e.posture = Math.max(0, e.posture - 14 * dt);
    return;
  }
  if (e.state === "dead") {
    e.t += dt;
    // kicked away by the Sapper's execution
    if (e.kick && e.kick.t > 0) {
      e.x += e.kick.vx * dt;
      e.z += e.kick.vz * dt;
      e.kick.t -= dt;
      w.resolve(e, e.r);
    }
    if (e.t > 2.4) e.gone = true;
    return;
  }
  if (e.state === "fall") {
    // dropped through the floor, out of the roof: out of the fight till down
    e.vy -= DROP.g * dt;
    e.y += e.vy * dt;
    if (e.y <= 0) landEnemy(e);
    return;
  }
  if (e.yank) {
    // reeled in by the Enforcer's grapple, then reeling from it
    const y = e.yank,
      k = Math.min(1, dt / Math.max(dt, y.t));
    e.x += (y.tx - e.x) * k;
    e.z += (y.tz - e.z) * k;
    w.resolve(e, e.r);
    y.t -= dt;
    if (y.t <= 0) e.yank = null;
    // a staggered enemy stays open to an execution; any other reels a moment
    if (e.state !== "stagger") {
      e.state = "hit";
      e.t = 0;
      e.hitT = 0.5;
      e.token = false;
    }
    return;
  }
  const dx = p.x - e.x,
    dz = p.z - e.z,
    dist = Math.hypot(dx, dz),
    toP = Math.atan2(dx, dz),
    alive = p.state !== "dead";
  if (dist > 75 && !e.aware && e.state !== "return") return;
  e.postT += dt;
  if (e.postT > 2.5 && e.state !== "stagger")
    e.posture = Math.max(0, e.posture - 14 * dt);
  e.cd -= dt;
  e.prov = Math.max(0, e.prov - dt);
  e.kx = damp(e.kx, 0, 10, dt);
  e.kz = damp(e.kz, 0, 10, dt);
  e.x += e.kx * dt;
  e.z += e.kz * dt;
  const spdMul = e.phase === 2 ? 1.2 : 1,
    tm = e.phase === 2 ? 0.85 : 1;
  if (e.alertIn > 0) {
    e.alertIn -= dt;
    if (e.alertIn <= 0 && alive) {
      // one walking home is woken only inside its territory, or by a
      // provoked neighbour, whose provoke it then shares
      const by = e.alertBy;
      if (d.boss || e.state !== "return" || inTerritory(e)) alertE(e, true, by);
      else if (by && by.prov > 0) {
        e.prov = by.prov;
        alertE(e, true, by);
      }
      e.alertBy = null;
    }
  }
  if (
    !e.aware &&
    alive &&
    (d.boss || e.state !== "return" || inTerritory(e))
  ) {
    const front = Math.abs(angDiff(e.yaw, toP)) < 1.75,
      rad = front ? d.sight : p.sprint ? 7.5 : p.state === "attack" ? 0 : 3.0;
    if (dist < rad && w.los(e.x, e.z, p.x, p.z)) alertE(e);
  }
  // sight memory, in every state, for a regular enemy that is hunting
  if (e.aware && !d.boss) {
    if (canSee(e)) {
      e.lsx = p.x;
      e.lsz = p.z;
      e.lvx = p.vx;
      e.lvz = p.vz;
      e.lost = 0;
      e.told = false;
      callPack(e);
    } else {
      e.lost += dt;
      // a pack-mate that can see the player says where they are
      const m = seeingMate(e);
      e.told = !!m;
      if (m) {
        e.lsx = m.lsx;
        e.lsz = m.lsz;
        e.lvx = m.lvx;
        e.lvz = m.lvz;
      }
    }
  }
  const face = (rate) => {
    e.yaw = turnTo(e.yaw, toP, rate * dt);
  };
  switch (e.state) {
    case "idle":
      // shoved off the post, for example by one walking past: go back
      if (!d.boss && Math.hypot(e.x - e.hx, e.z - e.hz) > 1) {
        e.state = "return";
        e.route = null;
        e.fails = 0;
      }
      break;
    case "alert":
      e.t += dt;
      face(d.turn * 1.5);
      if (e.t > 0.4) {
        e.state = "chase";
        e.t = 0;
      }
      break;
    case "return": {
      const hx = e.hx - e.x,
        hz = e.hz - e.z,
        hd = Math.hypot(hx, hz);
      const arrive = () => {
        e.state = "idle";
        e.yaw = e.hyaw;
        e.route = null;
        if (d.boss) {
          e.hp = d.hp;
          e.phase = 1;
          G.bossSeen = false;
        }
      };
      if (hd < 0.6) {
        arrive();
        break;
      }
      if (!e.route) setRoute(e, e.hx, e.hz);
      // A post too tight against a wall for a body to stand on: the route
      // ends as near as a body fits, and that spot becomes the post.
      if (walkRoute(e, d.speed * 0.8, dt)) {
        e.hx = e.x;
        e.hz = e.z;
        arrive();
      }
      break;
    }
    case "chase": {
      if (
        d.boss
          ? !alive || dist > 38 || Math.hypot(e.x - e.hx, e.z - e.hz) > 30
          : huntOver(e)
      ) {
        giveUp(e);
        break;
      }
      // a flinch can end here without the enemy ever having been alerted
      if (!d.boss && !e.aware) {
        giveUp(e);
        break;
      }
      if (!d.boss && e.lost > PURSUIT.lostT) {
        toSearch(e);
        break;
      }
      let ux = dx / (dist || 1),
        uz = dz / (dist || 1),
        aim = null;
      if (d.boss) {
        // the boss always knows where the player is; with rock in the way
        // it walks round, planning again at most twice a second
        if (w.los(e.x, e.z, p.x, p.z)) e.route = null;
        else {
          e.rt -= dt;
          if ((!e.route || e.rt <= 0) && setRoute(e, p.x, p.z)) e.rt = 0.5;
          aim = routeAim(e);
        }
      }
      if (aim) {
        ux = aim.x;
        uz = aim.z;
        e.yaw = turnTo(e.yaw, Math.atan2(ux, uz), d.turn * dt);
      } else face(d.turn);
      const tx = -uz * e.strafe,
        tz = ux * e.strafe;
      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafeT = 1.5 + Math.random() * 2;
        if (Math.random() < 0.5) e.strafe = -e.strafe;
      }
      if (d.ranged) {
        if (dist < 6.5)
          eStep(
            e,
            -ux * 0.9 + tx * 0.4,
            -uz * 0.9 + tz * 0.4,
            d.speed * 0.8,
            dt,
          );
        else if (dist > 14 || !w.los(e.x, e.z, p.x, p.z))
          eStep(e, ux, uz, d.speed, dt);
        else eStep(e, tx, tz, d.speed * 0.35, dt);
        if (
          e.cd <= 0 &&
          dist < 17 &&
          dist > 3 &&
          Math.abs(angDiff(e.yaw, toP)) < 0.5 &&
          w.los(e.x, e.z, p.x, p.z)
        ) {
          e.atk = d.atks.shot;
          e.state = "wind";
          e.t = 0;
          SFX.tele(false);
        }
        break;
      }
      if (e.cd <= 0 && !e.plan) e.plan = chooseAtk(e, dist);
      if (e.plan && dist < (e.plan.minTrig || 0)) e.plan = null;
      const want = e.plan && e.cd <= 0 && (e.token || takeToken(e));
      if (want) {
        if (dist <= e.plan.trig + e.r * 0.3) {
          if (Math.abs(angDiff(e.yaw, toP)) < 0.7) {
            e.atk = e.plan;
            e.plan = null;
            e.state = "wind";
            e.t = 0;
            SFX.tele(!!e.atk.unb);
          }
        } else eStep(e, ux, uz, d.speed * spdMul, dt);
      } else {
        const ring = d.boss ? 6 : 4.6 + e.r;
        if (dist > ring + 1.2) eStep(e, ux, uz, d.speed * spdMul, dt);
        else if (dist < ring - 1.2)
          eStep(
            e,
            -ux * 0.8 + tx * 0.5,
            -uz * 0.8 + tz * 0.5,
            d.speed * 0.5,
            dt,
          );
        else eStep(e, tx, tz, d.speed * 0.42, dt);
      }
      break;
    }
    case "search": {
      if (huntOver(e)) {
        giveUp(e);
        break;
      }
      if (e.lost === 0) {
        // seen again
        e.state = "chase";
        e.route = null;
        break;
      }
      // Told where the player is now, and it is not where this search was
      // heading: go there instead. Planned at most twice a second.
      e.rt -= dt;
      if (
        e.told &&
        e.rt <= 0 &&
        Math.hypot(e.lsx - e.rgx, e.lsz - e.rgz) > 2 &&
        setRoute(e, e.lsx, e.lsz)
      ) {
        e.sub = "go";
        e.fails = 0;
        e.rt = 0.5;
      }
      if (e.sub === "go") {
        if (e.fails >= 2) {
          giveUp(e);
          break;
        }
        if (!e.route && !setRoute(e, e.lsx, e.lsz)) break;
        if (walkRoute(e, d.speed * spdMul, dt)) {
          e.route = null;
          e.t = 0;
          if (Math.hypot(e.lvx, e.lvz) > 0.5) {
            e.sub = "guess";
            e.gd = 0;
            e.gsx = e.gpx = e.x;
            e.gsz = e.gpz = e.z;
            e.stuck = 0;
          } else {
            e.sub = "look";
            e.ly = e.yaw;
          }
        }
      } else if (e.sub === "guess") {
        // carry on the way the player was heading, sliding along walls
        const v = Math.hypot(e.lvx, e.lvz) || 1,
          gx = e.lvx / v,
          gz = e.lvz / v;
        e.t += dt;
        e.yaw = turnTo(e.yaw, Math.atan2(gx, gz), d.turn * dt);
        eStep(e, gx, gz, d.speed * 0.6, dt);
        e.gd = Math.hypot(e.x - e.gsx, e.z - e.gsz);
        let done = e.gd >= PURSUIT.guessDist || e.t >= PURSUIT.guessT;
        if ((e.stuck += dt) >= 0.5) {
          // no headway in half a second means a wall
          if (Math.hypot(e.x - e.gpx, e.z - e.gpz) < 0.3) done = true;
          e.gpx = e.x;
          e.gpz = e.z;
          e.stuck = 0;
        }
        if (done) {
          e.sub = "look";
          e.t = 0;
          e.ly = e.yaw;
        }
      } else {
        e.t += dt;
        e.yaw = e.ly + Math.sin(e.t * 2.6) * 1.1;
        // a pack-mate still has eyes on the player: keep looking
        if (e.t >= PURSUIT.look && !e.told) giveUp(e);
      }
      break;
    }
    case "wind": {
      e.t += dt;
      const a = e.atk,
        wd = a.wind * tm;
      if (e.t < wd - 0.13) face((a.kind === "charge" ? 6 : d.turn) * 0.9);
      if (e.t >= wd) {
        e.state = "act";
        e.t = 0;
        e.hitDone = false;
        SFX.whoosh(true);
        if (a.kind === "shot") {
          const lead = (dist / 14) * 0.5;
          shoot(e, Math.atan2(dx + p.vx * lead, dz + p.vz * lead), a.dmg, 14);
          SFX.shot();
        } else if (a.kind === "volley") {
          for (let i = -2; i <= 2; i++) shoot(e, toP + i * 0.24, a.dmg, 15);
          SFX.shot();
        } else if (a.kind === "slam") {
          e.sx = e.x;
          e.sz = e.z;
          let k = Math.min(1, 15 / (dist || 1));
          const o = { x: e.x + dx * k, z: e.z + dz * k };
          w.resolve(o, e.r + 0.2);
          e.tx = o.x;
          e.tz = o.z;
          G.rings.push({
            x: o.x,
            z: o.z,
            r: a.radius,
            t: 0,
            dur: a.act,
            kind: "warn",
            c: RED,
          });
        }
      }
      break;
    }
    case "act": {
      e.t += dt;
      const a = e.atk,
        k = sat(e.t / a.act),
        hx = Math.sin(e.yaw),
        hz = Math.cos(e.yaw);
      if (a.kind === "slam") {
        const sk = smooth(k);
        e.x = lerp(e.sx, e.tx, sk);
        e.z = lerp(e.sz, e.tz, sk);
        e.y = Math.sin(PI * k) * 3.4;
        if (k >= 1) {
          e.y = 0;
          SFX.slam();
          G.shake = 1;
          G.rings.push({
            x: e.x,
            z: e.z,
            r: a.radius,
            t: 0,
            dur: 0.45,
            kind: "shock",
            c: RED,
          });
          sparks(e.x, 0.3, e.z, 40, [1, 0.5, 0.2], 9, 0.6, 0.16);
          if (Math.hypot(p.x - e.x, p.z - e.z) < a.radius)
            hurtPlayer(a.dmg, e, a);
          e.state = "rec";
          e.t = 0;
        }
        break;
      }
      if (a.kind === "charge") {
        eStep(e, hx, hz, 28, dt);
        if (Math.random() < 0.6) sparks(e.x, 0.3, e.z, 1, RED, 2, 0.4);
        if (!e.hitDone && dist < e.r + p.r + 0.9) {
          e.hitDone = true;
          hurtPlayer(a.dmg, e, a);
        }
        if (w.fieldAt(e.x + hx * (e.r + 0.4), e.z + hz * (e.r + 0.4)) < 0.3) {
          e.state = "rec";
          e.t = 0;
          G.shake = Math.max(G.shake, 0.6);
          SFX.slam();
          break;
        }
      } else if (!a.kind) {
        eStep(e, hx, hz, (a.lunge || 0) / a.act, dt);
        if (
          !e.hitDone &&
          e.t > 0.02 &&
          dist < a.reach + p.r &&
          (dist < e.r + 0.9 || Math.abs(angDiff(e.yaw, toP)) < a.arc / 2)
        ) {
          e.hitDone = true;
          hurtPlayer(a.dmg, e, a);
          if (e.state !== "act") break;
        }
      }
      if (k >= 1) {
        e.state = "rec";
        e.t = 0;
      }
      break;
    }
    case "rec": {
      e.t += dt;
      const a = e.atk;
      if (e.t >= a.rec * tm) {
        if (a.chain && dist < 8 && alive) {
          e.atk = d.atks[a.chain];
          e.state = "wind";
          e.t = 0;
          SFX.tele(!!e.atk.unb);
        } else {
          e.token = false;
          e.cd = d.cd * (0.6 + Math.random() * 0.7) * tm;
          e.state = "chase";
          e.atk = null;
        }
      }
      break;
    }
    case "hit":
      e.t += dt;
      // a flinch is short; the grapple sets a longer one in hitT
      if (e.t > (e.hitT || 0.32)) {
        e.hitT = 0;
        e.state = "chase";
        e.cd = Math.max(e.cd, 0.25);
      }
      break;
    case "recoil":
      e.t += dt;
      if (e.t > e.dur) {
        e.state = "chase";
        e.cd = 0.3;
      }
      break;
    case "stagger":
      e.t += dt;
      if (e.t > e.dur) {
        e.state = "chase";
        e.posture = 0;
        e.cd = 0.4;
      }
      break;
    case "roar":
      e.t += dt;
      if (e.t > 1.2) {
        e.state = "chase";
        e.cd = 0.2;
      }
      break;
  }
}
// The Enforcer's sticky bomb: stuck to an enemy (moving with it) or to a
// spot, it goes off after STICKY.t seconds and hurts the thrower too, at
// STICKY.self of the damage, through hurtPlayer.
const STICKY = { t: 3, r: 3.5, dmg: 45, post: 40, self: 0.5 };
function plantBomb(x, z, e) {
  G.bombs.push({
    x,
    y: e ? 1.1 : 0.4,
    z,
    e,
    ox: e ? x - e.x : 0,
    oz: e ? z - e.z : 0,
    t: STICKY.t,
  });
  SFX.beep();
}
function bombsUpdate(dt) {
  const p = G.player,
    w = G.world;
  for (const b of G.bombs) {
    if (b.e && b.e.dead) {
      b.e = null;
      b.y = 0.4;
    }
    if (b.e) {
      b.x = b.e.x + b.ox;
      b.z = b.e.z + b.oz;
    }
    // beeps quicken as it runs out
    const per = b.t > 1 ? 0.5 : 0.2,
      was = Math.floor(b.t / per);
    b.t -= dt;
    if (b.t > 0 && Math.floor(b.t / per) !== was) SFX.beep();
    if (b.t <= 0) {
      explode(b.x, b.z, STICKY.r, STICKY.dmg, STICKY.post, CRIMSON);
      if (
        Math.hypot(p.x - b.x, p.z - b.z) < STICKY.r + 0.5 &&
        w.los(b.x, b.z, p.x, p.z)
      )
        hurtPlayer(STICKY.dmg * STICKY.self, null, { px: b.x, pz: b.z });
    }
  }
  G.bombs = G.bombs.filter((b) => b.t > 0);
}
// The Sapper's cave-in. A charge lands where it was thrown; at the end of its
// fuse rock falls on a ridge lying across the throw, crushing and staggering
// what is under it, and the rubble stands as rock in the walkable field for
// CAVEIN.life seconds. Everything that reads the field treats it as wall.
const CAVEIN = {
  fuse: 0.9,
  range: 12,
  thick: 1,
  half: 5.5,
  into: 0.8,
  dmg: 55,
  post: 60,
  life: 12,
  crumble: 1.5,
  // standing at once; a new one brings the oldest down early
  cap: 3,
  // a forced stagger lasts this share of the usual time, by enemy type
  stag: { brute: 0.75 },
};
// distance from (x, z) to the segment from (ax, az) to (bx, bz)
function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax,
    dz = bz - az,
    l2 = dx * dx + dz * dz,
    t = l2 ? clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) : 0;
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
// distance from (x, z) to a cave-in's ridge line
function ridgeD(c, x, z) {
  return segDist(x, z, c.ax, c.az, c.bx, c.bz);
}
function inRubble(x, z) {
  for (const c of G.caveins)
    if (c.phase === "stand" && ridgeD(c, x, z) < CAVEIN.thick + 0.3) return true;
  return false;
}
function startCaveIn(tx, tz) {
  const p = G.player,
    w = G.world,
    yaw =
      Math.hypot(tx - p.x, tz - p.z) > 0.5
        ? Math.atan2(tx - p.x, tz - p.z)
        : p.yaw,
    // along the ridge: across the throw
    ux = Math.cos(yaw),
    uz = -Math.sin(yaw);
  // each end runs out to the rock, past other rubble, and into it
  const end = (s) => {
    let d = 0;
    while (d < CAVEIN.half) {
      const x = tx + ux * s * (d + 0.25),
        z = tz + uz * s * (d + 0.25);
      if (w.fieldAt(x, z) < 0.3 && !inRubble(x, z)) break;
      d += 0.25;
    }
    return d + CAVEIN.into;
  };
  const ea = end(-1),
    eb = end(1);
  const c = {
    x: tx,
    z: tz,
    yaw,
    t: CAVEIN.fuse,
    phase: "fuse",
    fx: p.x,
    fz: p.z,
    ax: tx - ux * ea,
    az: tz - uz * ea,
    bx: tx + ux * eb,
    bz: tz + uz * eb,
    id: 0,
    ceil: w.ceilAt(tx, tz),
    seed: (Math.random() * 1e9) | 0,
  };
  while (G.caveins.length >= CAVEIN.cap) {
    const old = G.caveins.shift();
    if (old.phase === "stand") crumbleCave(old);
  }
  G.caveins.push(c);
  SFX.beep();
}
function crumbleCave(c) {
  G.world.removeRock(c.id);
  for (const e of G.enemies) e.route = null;
  SFX.crumble();
  for (let s = 0; s <= 1; s += 0.1)
    sparks(lerp(c.ax, c.bx, s), 0.8, lerp(c.az, c.bz, s), 3, [0.55, 0.5, 0.45], 3, 0.8, 0.22);
  c.gone = true;
}
function caveImpact(c) {
  const p = G.player,
    w = G.world,
    th = CAVEIN.thick,
    nx = Math.sin(c.yaw),
    nz = Math.cos(c.yaw),
    // which side of the ridge a point is on, along the throw
    off = (o) => (o.x - c.x) * nx + (o.z - c.z) * nz,
    thrown = Math.sign((c.fx - c.x) * nx + (c.fz - c.z) * nz) || -1;
  for (const e of G.enemies) {
    if (e.dead || ridgeD(c, e.x, e.z) > th + e.r + 0.4) continue;
    hitEnemy(e, CAVEIN.dmg, CAVEIN.post, {
      src: "aoe",
      heavy: true,
      fx: c.x,
      fz: c.z,
    });
    // a stagger the crush earned by filling posture keeps its full length
    if (!e.dead && !e.def.boss && e.state !== "stagger")
      stagger(e, CAVEIN.stag[e.type] || 1);
  }
  // mines under the ridge go off now, before the rock would bury their blast
  for (const m of [...G.mines])
    if (ridgeD(c, m.x, m.z) < th + 0.5) blowMine(m);
  c.id = w.addRock(c.ax, c.az, c.bx, c.bz, th);
  // nobody is left inside: out along the throw to the side they are on; one
  // on the line goes to the player's side, and the player to where it threw
  // from. The dummy stays pinned.
  const po = off(p),
    pside = Math.abs(po) < 0.05 ? thrown : Math.sign(po);
  const out = (o, r, side) => {
    if (ridgeD(c, o.x, o.z) >= th + r) return;
    const d = off(o),
      s = Math.abs(d) < 0.05 ? side : Math.sign(d),
      to = s * (th + r + 0.15) - d;
    o.x += nx * to;
    o.z += nz * to;
    w.resolve(o, r);
  };
  out(p, 0.6, pside);
  for (const e of G.enemies) if (!e.def.dummy) out(e, e.r, pside);
  for (const e of G.enemies) e.route = null;
  for (let s = 0; s <= 1; s += 0.1)
    sparks(
      lerp(c.ax, c.bx, s),
      0.6,
      lerp(c.az, c.bz, s),
      4,
      [0.55, 0.5, 0.45],
      5,
      0.7,
      0.2,
    );
  G.shake = Math.max(G.shake, 1);
  SFX.rumble();
}
function caveUpdate(dt) {
  for (const c of G.caveins) {
    c.t -= dt;
    if (c.phase === "fuse") {
      if (c.t <= 0) {
        caveImpact(c);
        c.phase = "stand";
        c.t = CAVEIN.life;
      }
    } else if (c.t <= 0) crumbleCave(c);
    else if (c.t < CAVEIN.crumble && Math.random() < dt * 12) {
      const s = Math.random();
      sparks(lerp(c.ax, c.bx, s), 1.2, lerp(c.az, c.bz, s), 2, [0.55, 0.5, 0.45], 1.5, 0.6, 0.15);
    }
  }
  G.caveins = G.caveins.filter((c) => !c.gone);
}
// The Sapper's landmines. Each arms MINE.arm seconds after planting and goes
// off when an enemy body comes within MINE.trig of it. A mine planted near
// another is wired to it, and an enemy crossing a wire whose mines are both
// armed sets off both. A mine going off sets off the mines in its blast, a
// moment later. The player never sets one off.
const MINE = {
  arm: 0.8,
  trig: 0.5,
  r: 3,
  dmg: 40,
  post: 35,
  link: 6,
  wires: 2,
  cap: 8,
  chain: 0.12,
};
function plantMine(x, z) {
  const w = G.world,
    m = { x, z, t: 0, links: [], fuse: null };
  let best = null,
    bd = MINE.link;
  for (const o of G.mines) {
    if (o.fuse !== null || o.links.length >= MINE.wires) continue;
    const d = Math.hypot(o.x - x, o.z - z);
    if (d < bd && w.los(x, z, o.x, o.z)) {
      bd = d;
      best = o;
    }
  }
  if (best) {
    m.links.push(best);
    best.links.push(m);
  }
  G.mines.push(m);
  // past the cap the oldest goes quiet, with its wires
  while (G.mines.length > MINE.cap) dropMine(G.mines[0]);
  return m;
}
function dropMine(m) {
  for (const o of m.links) o.links = o.links.filter((q) => q !== m);
  G.mines = G.mines.filter((q) => q !== m);
}
function boomMine(m) {
  if (m.fuse === null) m.fuse = 0;
}
function minesUpdate(dt) {
  for (const m of G.mines) {
    m.t += dt;
    if (m.fuse !== null || m.t < MINE.arm) continue;
    for (const e of G.enemies)
      if (
        !e.dead &&
        e.state !== "fall" &&
        Math.hypot(e.x - m.x, e.z - m.z) < MINE.trig + e.r
      ) {
        boomMine(m);
        break;
      }
    for (const o of m.links) {
      if (o.t < MINE.arm || o.fuse !== null) continue;
      for (const e of G.enemies)
        if (
          !e.dead &&
          e.state !== "fall" &&
          segDist(e.x, e.z, m.x, m.z, o.x, o.z) < e.r
        ) {
          boomMine(m);
          boomMine(o);
          SFX.wire();
          break;
        }
    }
  }
  for (const m of [...G.mines]) {
    if (m.fuse === null) continue;
    m.fuse -= dt;
    if (m.fuse <= 0) blowMine(m);
  }
}
// a mine going off: the blast, and the mines in it go off a moment later
function blowMine(m) {
  const w = G.world;
  dropMine(m);
  explode(m.x, m.z, MINE.r, MINE.dmg, MINE.post, HAZARD);
  for (const o of G.mines)
    if (
      o.fuse === null &&
      Math.hypot(o.x - m.x, o.z - m.z) < MINE.r &&
      w.los(m.x, m.z, o.x, o.z)
    )
      o.fuse = MINE.chain;
}
// ---- the Riftwalker's rifts ----
// An end is a short line across its facing; a pair carries what crosses one
// line out of the other (riftMove). Rifts never touch the walkable field.
const RIFT = {
  // half the width of an end's line, and how tall it is drawn
  half: 0.9,
  tall: 2.2,
  life: 20,
  // the tool opens an end this far ahead, at least and at most
  near: 2,
  far: 8,
  // two ends no closer than this; the field an end needs
  apart: 3,
  room: 1.0,
  // an enemy that came out of a rift passes through ends as air this long
  rest: 3,
  // the trait: untouchable this long after a crossing, and the next hit
  // within bonusT does bonus more
  safe: 0.4,
  bonus: 0.5,
  bonusT: 2,
  // the player cannot cross again this soon
  cd: 0.25,
};
let riftId = 0;
// the end, or why not: "close" to the other end, or no "room"
function openRift(x, z, yaw) {
  const w = G.world;
  for (const o of G.rifts)
    if (Math.hypot(o.x - x, o.z - z) < RIFT.apart) return "close";
  if (w.fieldAt(x, z) < RIFT.room) return "room";
  const ux = Math.cos(yaw),
    uz = -Math.sin(yaw);
  for (let d = -RIFT.half; d <= RIFT.half + 1e-6; d += RIFT.half / 3)
    if (w.fieldAt(x + ux * d, z + uz * d) < 0.3) return "room";
  const e = { x, z, yaw, t: 0, life: RIFT.life, id: ++riftId };
  // the oldest goes; a pair is never more than two
  while (G.rifts.length >= 2) G.rifts.shift();
  G.rifts.push(e);
  SFX.tear();
  return e;
}
function riftPair(A) {
  if (G.rifts.length < 2) return null;
  return G.rifts[0] === A ? G.rifts[1] : G.rifts[1] === A ? G.rifts[0] : null;
}
// turn a vector (x, z) by angle a: a facing yaw becomes yaw + a
function riftTurn(x, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return [x * c + z * s, -x * s + z * c];
}
// the angle the last crossing turned its mover by
let riftA = 0;
// Did o, moving from (ox, oz) to where it is now, cross an end of a pair? If
// so it comes out of the other end, offset and heading turned by
// yaw_B - yaw_A + PI, on the side that turn puts it, clear of the line by
// its radius r, and put through resolve (r 0 for a shot: no resolve).
function riftMove(o, ox, oz, r) {
  if (G.rifts.length < 2) return false;
  for (const A of G.rifts) {
    const B = riftPair(A),
      nx = Math.sin(A.yaw),
      nz = Math.cos(A.yaw),
      s0 = (ox - A.x) * nx + (oz - A.z) * nz,
      s1 = (o.x - A.x) * nx + (o.z - A.z) * nz;
    if (!((s0 > 0 && s1 <= 0) || (s0 < 0 && s1 >= 0))) continue;
    const k = s0 / (s0 - s1),
      qx = ox + (o.x - ox) * k,
      qz = oz + (o.z - oz) * k;
    if (Math.abs((qx - A.x) * nz - (qz - A.z) * nx) > RIFT.half) continue;
    const a = B.yaw - A.yaw + PI,
      [rx, rz] = riftTurn(qx - A.x, qz - A.z, a),
      [dx, dz] = riftTurn(o.x - ox, o.z - oz, a),
      bx = Math.sin(B.yaw),
      bz = Math.cos(B.yaw),
      sd = dx * bx + dz * bz >= 0 ? 1 : -1;
    o.x = B.x + rx + bx * sd * (r + 0.15);
    o.z = B.z + rz + bz * sd * (r + 0.15);
    if ("vx" in o) [o.vx, o.vz] = riftTurn(o.vx, o.vz, a);
    if ("yaw" in o) o.yaw += a;
    if (r > 0) G.world.resolve(o, r);
    A.flash = B.flash = 1;
    riftA = a;
    return true;
  }
  return false;
}
// where the player and every enemy stood before this update moved them, or
// null with no pair open
function riftSnap() {
  if (G.rifts.length < 2) return null;
  const e = new Map();
  for (const o of G.enemies) e.set(o, [o.x, o.z]);
  return { p: [G.player.x, G.player.z], e };
}
// bodies that crossed an end this update. The player, not while dead,
// executing or inspecting, keeps a lock and turns the camera with them, and
// gets the trait. A regular enemy that comes out rests: ends are air to it
// for RIFT.rest. The boss, the dummy, a falling or airborne enemy never cross.
function riftBodies(prev) {
  const p = G.player;
  if (
    p.state !== "dead" &&
    p.state !== "execute" &&
    p.state !== "inspect" &&
    !(p.riftCD > 0) &&
    riftMove(p, prev.p[0], prev.p[1], p.r)
  ) {
    const a = riftA;
    [p.ddx, p.ddz] = riftTurn(p.ddx || 0, p.ddz || 0, a);
    [p.kx, p.kz] = riftTurn(p.kx || 0, p.kz || 0, a);
    if (p.aim !== undefined) p.aim += a;
    cam.yaw += a;
    cam.px = p.x;
    cam.pz = p.z;
    p.iframe = Math.max(p.iframe, RIFT.safe);
    p.riftBonus = RIFT.bonusT;
    p.riftCD = RIFT.cd;
    SFX.cross();
  }
  for (const e of G.enemies) {
    if (e.dead || e.def.boss || e.def.dummy || e.state === "fall") continue;
    if (e.rest > 0 || e.y > 0.3) continue;
    const q = prev.e.get(e);
    if (!q || !riftMove(e, q[0], q[1], e.r)) continue;
    [e.kx, e.kz] = riftTurn(e.kx || 0, e.kz || 0, riftA);
    e.route = null;
    e.rest = RIFT.rest;
  }
}
// a shot that crossed an end this step; a regular enemy's shot becomes the
// player's, as a parried one does. The boss's shots go through as if the
// tear were air.
function riftShot(pr, ox, oz) {
  if (pr.src && pr.src.def && pr.src.def.boss) return;
  if (!riftMove(pr, ox, oz, 0)) return;
  if (pr.own === "e") {
    pr.own = "p";
    pr.post = 20;
    pr.c = MAGENTA;
    pr.life = Math.max(pr.life, 1.2);
  }
}
function riftsUpdate(dt) {
  const p = G.player;
  if (p.riftCD > 0) p.riftCD -= dt;
  if (p.riftBonus > 0) p.riftBonus = Math.max(0, p.riftBonus - dt);
  for (const e of G.enemies) if (e.rest > 0) e.rest -= dt;
  for (const e of G.rifts) {
    e.t += dt;
    if (e.flash > 0) e.flash = Math.max(0, e.flash - dt * 3);
  }
  const n = G.rifts.length;
  G.rifts = G.rifts.filter((e) => e.t < e.life);
  if (G.rifts.length < n) SFX.shut();
}
// ---- Drop: the floor opens under a pack ----
const DROP = {
  fuse: 0.5,
  r: 2.2,
  g: 22,
  // damage per metre fallen
  dmg: 4.5,
  // a landing hurts other enemies round it, never the player
  impact: { r: 1.6, dmg: 14, post: 20 },
};
// where something dropped at (x, z) lands: under the end of an open pair
// further from it, otherwise back on the spot
function dropSpot(x, z) {
  if (G.rifts.length === 2) {
    const [a, b] = G.rifts;
    return Math.hypot(a.x - x, a.z - z) > Math.hypot(b.x - x, b.z - z)
      ? [a.x, a.z]
      : [b.x, b.z];
  }
  return [x, z];
}
function startDrop(x, z) {
  const [lx, lz] = dropSpot(x, z),
    h = { x, z, t: 0, lx, lz };
  G.holes.push(h);
  SFX.hole();
  return h;
}
// e drops out of the ceiling over the i-th of n spots round (lx, lz). It is
// out of the fight (state "fall") until it lands. kill: an execution's body.
function dropEnemy(e, lx, lz, i, n, kill) {
  const w = G.world,
    a = (i / Math.max(1, n)) * TAU,
    rr = n > 1 ? 0.9 + e.r : 0,
    o = { x: lx + Math.sin(a) * rr, z: lz + Math.cos(a) * rr };
  for (let k = 0; k < 4; k++) w.resolve(o, e.r);
  e.x = o.x;
  e.z = o.z;
  e.y = w.ceilAt(o.x, o.z) - 0.6;
  e.vy = 0;
  e.fallH = e.y;
  e.token = false;
  e.route = null;
  e.kx = e.kz = 0;
  if (!kill) {
    e.wasAware = e.aware;
    e.state = "fall";
  }
  if (G.player.lock === e) G.player.lock = null;
  // a small tear in the roof where it comes out
  sparks(o.x, e.y, o.z, 16, MAGENTA, 4, 0.5);
}
function landEnemy(e) {
  e.y = 0;
  e.vy = 0;
  G.shake = Math.max(G.shake, 0.5);
  SFX.thud(true);
  sparks(e.x, 0.2, e.z, 20, [0.6, 0.55, 0.5], 5, 0.5);
  const im = DROP.impact;
  for (const o of G.enemies)
    if (
      o !== e &&
      !o.dead &&
      o.state !== "fall" &&
      Math.hypot(o.x - e.x, o.z - e.z) < im.r + o.r
    )
      hitEnemy(o, im.dmg, im.post, { src: "aoe", heavy: true, fx: e.x, fz: e.z });
  if (e.dead) return;
  e.state = "idle";
  e.t = 0;
  hitEnemy(e, DROP.dmg * e.fallH, 30, { heavy: true, src: "drop" });
  if (!e.dead) {
    if (e.wasAware) alertE(e, true);
    stagger(e, CAVEIN.stag[e.type] || 1);
  }
}
function holesUpdate(dt) {
  for (const h of G.holes) {
    h.t += dt;
    if (h.t < DROP.fuse) continue;
    const fall = G.enemies.filter(
      (e) =>
        !e.dead &&
        !e.def.boss &&
        !e.def.dummy &&
        e.state !== "fall" &&
        Math.hypot(e.x - h.x, e.z - h.z) < DROP.r + e.r,
    );
    fall.forEach((e, i) => dropEnemy(e, h.lx, h.lz, i, fall.length));
    h.done = true;
  }
  G.holes = G.holes.filter((h) => !h.done);
}
function projUpdate(dt) {
  const p = G.player,
    w = G.world;
  for (const pr of G.projs) {
    pr.life -= dt;
    pr.x += pr.vx * dt;
    pr.z += pr.vz * dt;
    if (G.rifts.length === 2)
      riftShot(pr, pr.x - pr.vx * dt, pr.z - pr.vz * dt);
    const wall = w.fieldAt(pr.x, pr.z) < 0.12;
    if (pr.kind === "sticky" && (wall || pr.life <= 0)) {
      // it sticks where it stopped, a step back from a wall
      plantBomb(pr.x - pr.vx * dt, pr.z - pr.vz * dt, null);
      pr.life = -1;
      continue;
    }
    if (wall || pr.life <= 0) {
      if (pr.aoe)
        explode(
          pr.x - pr.vx * dt,
          pr.z - pr.vz * dt,
          pr.aoe,
          pr.dmg,
          pr.post,
          pr.c,
        );
      else if (wall) sparks(pr.x, pr.y, pr.z, 6, pr.c, 4, 0.3);
      pr.life = -1;
      continue;
    }
    if (pr.own === "e") {
      if (Math.hypot(pr.x - p.x, pr.z - p.z) < 0.8) {
        const res = hurtPlayer(pr.dmg, null, {
          px: pr.x - pr.vx,
          pz: pr.z - pr.vz,
          proj: true,
        });
        if (res === "parry") {
          pr.own = "p";
          pr.dmg = 30;
          pr.post = 30;
          pr.kind = "reflect";
          pr.life = 2;
          pr.c = CYAN;
          pr.heavy = true;
          const s = pr.src;
          let a = Math.atan2(-pr.vx, -pr.vz);
          if (s && !s.dead) a = Math.atan2(s.x - pr.x, s.z - pr.z);
          pr.vx = Math.sin(a) * 24;
          pr.vz = Math.cos(a) * 24;
        } else if (res !== "none" || p.iframe <= 0) pr.life = -1;
      }
    } else {
      for (const e of G.enemies) {
        if (e.dead || e.state === "fall" || (pr.hitSet && pr.hitSet.has(e)))
          continue;
        if (Math.hypot(pr.x - e.x, pr.z - e.z) < e.r + 0.45 + (pr.rad || 0)) {
          if (pr.kind === "sticky") {
            plantBomb(pr.x, pr.z, e);
            pr.life = -1;
            break;
          }
          if (pr.aoe) {
            explode(pr.x, pr.z, pr.aoe, pr.dmg, pr.post, pr.c);
            pr.life = -1;
            break;
          }
          hitEnemy(e, pr.dmg, pr.post, { src: pr.kind, heavy: pr.heavy });
          if (pr.hitSet) pr.hitSet.add(e);
          else {
            pr.life = -1;
            break;
          }
        }
      }
    }
  }
  G.projs = G.projs.filter((q) => q.life > 0);
}
function separate() {
  const p = G.player,
    w = G.world,
    es = G.enemies;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (a.dead || a.state === "fall") continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j];
      if (b.dead || b.state === "fall") continue;
      const dx = b.x - a.x,
        dz = b.z - a.z,
        d = Math.hypot(dx, dz),
        m = a.r + b.r + 0.15;
      if (d < m && d > 1e-4) {
        const k = ((m - d) / d) * 0.5,
          wa = a.def.boss ? 0 : b.def.boss ? 1 : 0.5;
        a.x -= dx * k * wa * 2;
        a.z -= dz * k * wa * 2;
        b.x += dx * k * (1 - wa) * 2;
        b.z += dz * k * (1 - wa) * 2;
      }
    }
    if (
      p.state !== "dead" &&
      p.state !== "dodge" &&
      p.state !== "blink" &&
      p.state !== "execute" &&
      a.y < 0.5
    ) {
      const dx = p.x - a.x,
        dz = p.z - a.z,
        d = Math.hypot(dx, dz),
        m = a.r + p.r;
      if (d < m && d > 1e-4) {
        const k = (m - d) / d,
          wp = a.def.poise ? 1 : 0.6;
        p.x += dx * k * wp;
        p.z += dz * k * wp;
        a.x -= dx * k * (1 - wp);
        a.z -= dz * k * (1 - wp);
      }
    }
    // the dummy stays on its spot, even inside a cave-in's rubble
    if (a.y < 0.5 && !a.def.dummy) w.resolve(a, a.r);
  }
  w.resolve(p, p.r);
}
function update(dt) {
  G.t += dt;
  G.routeN = 0;
  // a portal transition freezes the world until it has finished
  if (G.trans) {
    transUpdate(dt);
    return;
  }
  if (G.zone === "cave") G.runT += dt;
  // The boss chamber: in once within its radius, out once past the pad, so
  // standing on the line does not flicker.
  const bc = G.world.boss;
  if (!bc) G.inBoss = false;
  else {
    const bd = Math.hypot(G.player.x - bc.x, G.player.z - bc.z);
    if (bd < bc.r) G.inBoss = true;
    else if (bd > bc.r + PURSUIT.bossPad) G.inBoss = false;
  }
  const prev = riftSnap();
  playerUpdate(dt);
  for (const e of G.enemies) enemyUpdate(e, dt);
  if (prev) riftBodies(prev);
  projUpdate(dt);
  bombsUpdate(dt);
  caveUpdate(dt);
  minesUpdate(dt);
  riftsUpdate(dt);
  holesUpdate(dt);
  for (const q of G.pending) {
    q.t -= dt;
    if (q.t <= 0) {
      explode(q.x, q.z, q.r, q.dmg, q.post, q.c);
      G.flashWhite = 0.4;
    }
  }
  G.pending = G.pending.filter((q) => q.t > 0);
  separate();
  G.enemies = G.enemies.filter((e) => !e.gone);
  for (const q of G.parts) {
    q.t += dt;
    q.vy -= q.g * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.z += q.vz * dt;
    if (q.y < 0.05) {
      q.y = 0.05;
      q.vy *= -0.4;
      q.vx *= 0.6;
      q.vz *= 0.6;
    }
  }
  G.parts = G.parts.filter((q) => q.t < q.life);
  for (const a of G.arcs) a.t += dt;
  G.arcs = G.arcs.filter((a) => a.t < a.dur);
  for (const r of G.rings) r.t += dt;
  G.rings = G.rings.filter((r) => r.t < r.dur);
  for (const g of G.ghosts) g.t += dt;
  G.ghosts = G.ghosts.filter((g) => g.t < 0.35);
  if (G.gate) G.gate.t += dt;
  // map discovery
  const p = G.player,
    w = G.world;
  for (const n of w.nodes)
    if (!n.seen && Math.hypot(n.x - p.x, n.z - p.z) < n.r + 3) n.seen = true;
  for (const e of w.edges)
    if (!e.seen) {
      for (let i = 0; i < e.pts.length; i += 2) {
        const q = e.pts[i];
        if (Math.abs(q.x - p.x) < 5 && Math.abs(q.z - p.z) < 5) {
          e.seen = true;
          break;
        }
      }
    }
  if (p.state === "dead" && p.t > 1.6 && G.state === "play") G.state = "dead";
  // open portals in the hall: stepping into the arch starts the trip. This
  // must stay the last thing update does, because a cut swaps the world here.
  if (G.zone === "hub" && p.state !== "dead")
    for (const q of w.portals) {
      if (!q.open) continue;
      const c = portalFront(q, -PORTAL_IN);
      if (Math.hypot(c.x - p.x, c.z - p.z) < PORTAL_R) {
        startTrans(q.grade);
        break;
      }
    }
}
