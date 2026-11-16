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
  ["lock", "Lock on"],
  ["special", "Class ability"],
  ["tool", "Class tool"],
  ["heal", "Drink a flask"],
  ["mute", "Sound on or off"],
];
const BIND = Object.assign({}, DEFAULT_BINDS);
const OPT = { cls: "assassin", sens: 1, invY: false };
const held = (a) => !!keys[BIND[a]],
  hit = (a) => tap(BIND[a]);
function keyName(c) {
  if (!c) return "Unbound";
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
function saveOpt() {
  try {
    localStorage.setItem(
      "dungeon-raze.v2",
      JSON.stringify({ b: BIND, o: OPT }),
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
    if (d.o) {
      if (CLASSES[d.o.cls]) OPT.cls = d.o.cls;
      if (d.o.sens > 0.1 && d.o.sens < 5) OPT.sens = d.o.sens;
      OPT.invY = !!d.o.invY;
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

const WHITE = [1, 0.95, 0.8],
  CYAN = [0.3, 0.9, 1],
  RED = [1, 0.2, 0.12],
  AMBER = [1, 0.65, 0.2],
  VIOLET = [0.7, 0.45, 1],
  GREEN = [0.55, 1, 0.45],
  ORANGE = [1, 0.5, 0.18],
  GOLD = [1, 0.85, 0.45];

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
  G.bossDead = false;
  G.bossSeen = false;
  G.gate = null;
  G.kills = 0;
  G.deaths = 0;
  G.runT = 0;
  G.projs = [];
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
  G.world.resolve(p, 0.6);
  G.projs = [];
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
  G.rings.push({ x, z, r, t: 0, dur: 0.4, kind: "shock", c });
  sparks(x, 0.8, z, 30, c, 9, 0.6, 0.15);
  G.shake = Math.max(G.shake, r > 4.5 ? 0.9 : 0.45);
  SFX.slam();
  for (const e of G.enemies) {
    if (e.dead) continue;
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

function alertE(e, quiet) {
  if (e.aware || e.dead) return;
  e.aware = true;
  if (e.state === "idle" || e.state === "return") {
    e.state = "alert";
    e.t = 0;
  }
  if (!quiet) SFX.alert();
  if (e.def.boss) G.bossSeen = true;
  for (const o of G.enemies)
    if (o !== e && !o.aware && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 12)
      o.alertIn = 0.25 + Math.random() * 0.35;
}
function stagger(e) {
  e.state = "stagger";
  e.t = 0;
  e.dur = e.def.boss ? 3.4 : 3.0;
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
  if (e.dead) return;
  const p = G.player,
    c = p.cls;
  let mult = 1;
  const close = o.src === "melee" || o.src === "blink" || o.src === "exec";
  const back = Math.abs(angDiff(e.yaw, Math.atan2(p.x - e.x, p.z - e.z))) > 2.1;
  if (!e.aware && o.src !== "reflect" && o.src !== "aoe" && c.ambush > 1) {
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
  alertE(e, true);
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
  p.t = 0;
  p.lock = null;
  p.buff = null;
  G.deaths++;
  G.slowT = 0.8;
  SFX.die();
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
    if (e.dead || e === exclude) continue;
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
    if (e.dead) continue;
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
    if (e.dead) continue;
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
  p.aim = m.proj ? aimRanged() : aimYaw(base === undefined ? p.yaw : base);
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
  p.t = 0;
  p.exT = e;
  p.exDone = false;
  p.exX = e.x + Math.sin(a) * (e.r + 1.0);
  p.exZ = e.z + Math.cos(a) * (e.r + 1.0);
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
        if (e.dead) continue;
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
  if (p.state === "dead") {
    p.t += dt;
    return;
  }
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
  const f = (held("fwd") ? 1 : 0) - (held("back") ? 1 : 0),
    s = (held("right") ? 1 : 0) - (held("left") ? 1 : 0);
  const fx = Math.sin(cam.yaw),
    fz = Math.cos(cam.yaw);
  let ix = fx * f - fz * s,
    iz = fz * f + fx * s;
  const il = Math.hypot(ix, iz);
  if (il > 0) {
    ix /= il;
    iz /= il;
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
  const doAct = (a) => {
    if (a === "light") {
      const e = nearestStaggered();
      if (e) {
        startExecute(e);
        return true;
      }
      return startMove(
        p.sprint && p.speed > c.run * 0.8 ? c.dash : c.chain,
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
      p.sprint = held("sprint") && il > 0 && p.stam > 0;
      const sp = p.sprint ? c.run : p.lock ? c.walk * 0.88 : c.walk;
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
      if (m.proj) {
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
            if (e.dead) continue;
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
        if (m.proj) {
          p.yaw = p.aim;
          fire(m.proj, p.aim);
          if (m.proj.kind === "arrow") SFX.knife();
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
        else {
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
      if (!m.proj && t >= m.wind && t < m.wind + m.act + 0.03) {
        for (const e of G.enemies) {
          if (e.dead || p.hitSet.has(e)) continue;
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
        G.arcs.push({
          lance: true,
          x: p.x,
          y: 1.2,
          z: p.z,
          yaw: p.yaw,
          len: 3.5,
          t: 0,
          dur: 0.3,
          c: AMBER,
        });
        sparks(e.x, 1.2 * e.fig.o.sc, e.z, 30, AMBER, 10, 0.6, 0.15);
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
        }
        say("EXECUTION", "crit", 0.9);
      }
      if (p.t > 0.62) p.state = "free";
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
    if (e.t > 2.4) e.gone = true;
    return;
  }
  const dx = p.x - e.x,
    dz = p.z - e.z,
    dist = Math.hypot(dx, dz),
    toP = Math.atan2(dx, dz),
    alive = p.state !== "dead";
  if (dist > 75 && !e.aware) return;
  e.postT += dt;
  if (e.postT > 2.5 && e.state !== "stagger")
    e.posture = Math.max(0, e.posture - 14 * dt);
  e.cd -= dt;
  e.kx = damp(e.kx, 0, 10, dt);
  e.kz = damp(e.kz, 0, 10, dt);
  e.x += e.kx * dt;
  e.z += e.kz * dt;
  const spdMul = e.phase === 2 ? 1.2 : 1,
    tm = e.phase === 2 ? 0.85 : 1;
  if (e.alertIn > 0) {
    e.alertIn -= dt;
    if (e.alertIn <= 0 && alive) alertE(e, true);
  }
  if (!e.aware && alive) {
    const front = Math.abs(angDiff(e.yaw, toP)) < 1.75,
      rad = front ? d.sight : p.sprint ? 7.5 : p.state === "attack" ? 0 : 3.0;
    if (dist < rad && w.los(e.x, e.z, p.x, p.z)) alertE(e);
  }
  const face = (rate) => {
    e.yaw = turnTo(e.yaw, toP, rate * dt);
  };
  switch (e.state) {
    case "idle":
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
      if (hd < 0.6) {
        e.state = "idle";
        e.yaw = e.hyaw;
        if (d.boss) {
          e.hp = d.hp;
          e.phase = 1;
          G.bossSeen = false;
        }
        break;
      }
      e.yaw = turnTo(e.yaw, Math.atan2(hx, hz), d.turn * dt);
      eStep(e, hx / hd, hz / hd, d.speed * 0.8, dt);
      break;
    }
    case "chase": {
      if (
        !alive ||
        dist > (d.boss ? 38 : 46) ||
        (d.boss && Math.hypot(e.x - e.hx, e.z - e.hz) > 30)
      ) {
        e.aware = false;
        e.state = "return";
        e.token = false;
        break;
      }
      face(d.turn);
      const ux = dx / (dist || 1),
        uz = dz / (dist || 1),
        tx = -uz * e.strafe,
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
      if (e.t > 0.32) {
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
function projUpdate(dt) {
  const p = G.player,
    w = G.world;
  for (const pr of G.projs) {
    pr.life -= dt;
    pr.x += pr.vx * dt;
    pr.z += pr.vz * dt;
    const wall = w.fieldAt(pr.x, pr.z) < 0.12;
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
        if (e.dead || (pr.hitSet && pr.hitSet.has(e))) continue;
        if (Math.hypot(pr.x - e.x, pr.z - e.z) < e.r + 0.45 + (pr.rad || 0)) {
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
    if (a.dead) continue;
    for (let j = i + 1; j < es.length; j++) {
      const b = es[j];
      if (b.dead) continue;
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
    if (a.y < 0.5) w.resolve(a, a.r);
  }
  w.resolve(p, p.r);
}
function update(dt) {
  G.t += dt;
  // a portal transition freezes the world until it has finished
  if (G.trans) {
    transUpdate(dt);
    return;
  }
  if (G.zone === "cave") G.runT += dt;
  playerUpdate(dt);
  for (const e of G.enemies) enemyUpdate(e, dt);
  projUpdate(dt);
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
