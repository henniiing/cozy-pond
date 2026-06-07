"use strict";

/* =========================================================================
   COZY POND — kveldsfiske
   Single-screen procedural pixel scene + menu / market / shops / inventory.
   Everything is drawn on a 480x270 canvas. No image assets.
   ========================================================================= */

const canvas = document.getElementById("game");
const SS = 2;                 // supersample: sharper text while art stays pixelated
const W = 480, H = 270;       // logical scene size
canvas.width = W * SS; canvas.height = H * SS;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
ctx.scale(SS, SS);

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);
const frame = $("frame");
const hudEl = $("hud");
const hintEl = $("hint");
const reelEl = $("reel");
const progressEl = $("progress");
const tensionEl = $("tension");
const catchEl = $("catch");
const catchName = $("catchName");
const catchInfo = $("catchInfo");
const catchTag = $("catchTag");
const moneyEl = $("money");
const basketCountEl = $("basketCount");
const rodNameEl = $("rodName");

/* =========================================================================
   Save / economy
   ========================================================================= */
const SAVE_KEY = "cozyPond_v1";
function defaultSave() {
  return { money: 0, rodLevel: 0, beers: 0, basket: [], record: {}, location: "skogstjern", unlocked: ["skogstjern"], owned: [0], stock: { beer: 0, snus: 0, cigar: 0, akevitt: 0, snabel: 0 }, license: 0, gated: true, seenIntro: false };
}
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === "object") return Object.assign(defaultSave(), s);
  } catch (e) {}
  return defaultSave();
}
let save = loadSave();
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}
const fmt = (n) => Math.round(n).toLocaleString("nb-NO");

/* =========================================================================
   Fish + rods
   ========================================================================= */
// kr = base kr per kg. weight = rarity. min/max in kg.
const FISH = [
  { key: "abbor",  name: "Abbor",  min: 0.1, max: 1.6, weight: 30, kr: 40,  shape: "normal", body: "#5f7d3a", belly: "#d9d2a6", fin: "#c23b2b", pattern: "stripes", spot: "#3a4a22", seed: 11 },
  { key: "mort",   name: "Mort",   min: 0.08, max: 0.5, weight: 26, kr: 18, shape: "normal", body: "#97a6b2", belly: "#e8eef2", fin: "#d23b2b", pattern: "plain", seed: 23 },
  { key: "sik",    name: "Sik",    min: 0.3, max: 2.2, weight: 14, kr: 55,  shape: "normal", body: "#aab6c2", belly: "#eef3f7", fin: "#8c9aa6", pattern: "plain", seed: 31 },
  { key: "brasme", name: "Brasme", min: 0.4, max: 3.5, weight: 12, kr: 25,  shape: "tall", body: "#9b8642", belly: "#e6dcb0", fin: "#5b4a2a", pattern: "plain", seed: 41 },
  { key: "gjedde", name: "Gjedde", min: 0.8, max: 9.0, weight: 12, kr: 45,  shape: "long", body: "#566b39", belly: "#d4d39a", fin: "#7a4030", pattern: "spots", spot: "#c6d488", seed: 53 },
  { key: "orret",  name: "Ørret",  min: 0.25, max: 4.5, weight: 14, kr: 120, shape: "normal", body: "#7a6a4a", belly: "#e8c9a0", fin: "#6b5638", pattern: "spots", spot: "#b03a2a", seed: 61 },
  { key: "roye",   name: "Røye",   min: 0.25, max: 3.0, weight: 8,  kr: 145, shape: "normal", body: "#4f6d8a", belly: "#e06b3a", fin: "#e8783a", pattern: "spots", spot: "#f2c9a0", seed: 71 },
  { key: "harr",   name: "Harr",   min: 0.25, max: 1.6, weight: 7,  kr: 95,  shape: "normal", body: "#7d8a93", belly: "#dfe6ea", fin: "#6a4a7a", pattern: "spots", spot: "#3a2c4a", bigDorsal: true, seed: 83 },
  { key: "lake",   name: "Lake",   min: 0.4, max: 3.0, weight: 5,  kr: 50,  shape: "long", body: "#5a5236", belly: "#cfc18a", fin: "#4a4326", pattern: "spots", spot: "#3a3520", seed: 97 },
  { key: "karpe",  name: "Karpe",  min: 0.6, max: 6.0, weight: 6,  kr: 30,  shape: "round", body: "#a8762f", belly: "#e6c98a", fin: "#7a531f", pattern: "plain", seed: 101 },
];
const FISH_BY_KEY = Object.fromEntries(FISH.map((f) => [f.key, f]));

const JUNK = [
  { key: "stovel", name: "Gammel støvel", junk: true, weight: 3, tag: "...skuffende.", kind: "boot" },
  { key: "boks",   name: "Blikkboks",     junk: true, weight: 2, tag: "Forsøpling!", kind: "can" },
];

const RODS = [
  { name: "Pinnestang",            reel: 1.0,  tens: 0.9,  rare: 0.0,  window: 1.0,  cost: 0,    color: "#7a5a36", grip: "#3b2b1f", tip: "#caa97a" },
  { name: "Glassfiberstang",       reel: 1.1,  tens: 0.85, rare: 0.1,  window: 1.06, cost: 180,  color: "#3f7d8c", grip: "#23404a", tip: "#bfe6ef" },
  { name: "Karbonstang",           reel: 1.2,  tens: 0.8,  rare: 0.2,  window: 1.12, cost: 700,  color: "#2c2c34", grip: "#7a1f1f", tip: "#d24a3a" },
  { name: "Proffstang",            reel: 1.3,  tens: 0.74, rare: 0.32, window: 1.18, cost: 2200, color: "#caa23a", grip: "#5a3aa0", tip: "#fff2a0" },
  { name: "Splittbambusstang",     reel: 1.4,  tens: 0.7,  rare: 0.42, window: 1.24, cost: 4500, color: "#7d9a3a", grip: "#3a2a14", tip: "#e8f0a0" },
  { name: "Nordlysstang",          reel: 1.5,  tens: 0.66, rare: 0.55, window: 1.3,  cost: 9000, color: "#2fc0a0", grip: "#3a2a6a", tip: "#b0ffe6" },
];
const rod = () => RODS[save.rodLevel] || RODS[0];

/* =========================================================================
   Locations (each water has its own look + fish)
   ========================================================================= */
const LOCATIONS = [
  {
    key: "skogstjern", name: "Skogstjernet", cost: 0, desc: "Abbor, mort & gjedde",
    sky: ["#181432", "#2b2a55", "#5b4a78", "#a86a76", "#d98e63"],
    water: ["#3a3a6e", "#26305c", "#121a38"],
    tree: "#15122b", moon: true, fog: 0, junk: 1, forest: true,
    fish: ["abbor", "mort", "brasme", "gjedde", "karpe", "sik"],
    rare: { key: "gammelgjedda", name: "Gammelgjedda", min: 6, max: 14, kr: 110, shape: "long", body: "#3f5230", belly: "#cfd49a", fin: "#6a3a28", pattern: "spots", spot: "#d2e08a", seed: 731, tag: "En skikkelig urskogsmonster! 🐊" },
  },
  {
    key: "fjellvatn", name: "Fjellvatnet", cost: 2500, desc: "\u00d8rret, r\u00f8ye & harr \u2014 dyrt",
    sky: ["#0e1430", "#1f2a52", "#3a4f7a", "#6f8fb0", "#cfe0ec"],
    water: ["#2a4a6e", "#1c3450", "#0e2030"],
    tree: "#1a2a3a", snow: true, moon: true, fog: 0.05, junk: 0.5, mountains: true,
    fish: ["orret", "roye", "harr", "sik", "mort"],
    rare: { key: "storroye", name: "Gammelrøya", min: 4, max: 9, kr: 220, shape: "normal", body: "#3f5d7a", belly: "#f08b4a", fin: "#f8983a", pattern: "spots", spot: "#fff0d0", seed: 701 },
  },
  {
    key: "elva", name: "Stryket", cost: 900, desc: "\u00d8rret, harr & lake",
    sky: ["#241a32", "#3a2a48", "#6a4a5a", "#c08a5a", "#e0a878"],
    water: ["#3a5a5a", "#264a48", "#143230"],
    tree: "#142218", moon: false, fog: 0, junk: 0.8, waterfall: true,
    fish: ["orret", "harr", "lake", "gjedde", "mort", "sik"],
    rare: { key: "kjempeorret", name: "Kjempeørret", min: 5, max: 12, kr: 200, shape: "normal", body: "#6a5838", belly: "#f0d2a0", fin: "#5a4628", pattern: "spots", spot: "#c03a2a", seed: 711 },
  },
  {
    key: "myra", name: "Trollmyra", cost: 300, desc: "Skummelt \u2014 store troll lurer",
    sky: ["#0e1a14", "#16241a", "#2a3a26", "#46502e", "#6a5a3a"],
    water: ["#2a3a26", "#1a2a1a", "#0e1a10"],
    tree: "#0a140c", fog: 0.28, moon: true, spooky: true, junk: 1.6, eyes: true,
    fish: ["lake", "gjedde", "karpe", "brasme", "abbor"],
    rare: { key: "myrtroll", name: "Myrtrollet", min: 9, max: 22, kr: 90, shape: "long", body: "#3a4a2a", belly: "#5a6a38", fin: "#2a3520", pattern: "spots", spot: "#1a2410", seed: 999, tag: "Hva i alle dager?!" },
  },
  {
    key: "elgtjern", name: "Elgtjernet", cost: 1500, desc: "Lyst sommertjern \u2014 elgen titter innom",
    sky: ["#1b2c52", "#395a86", "#6f93b4", "#d6a878", "#f4d79a"],
    water: ["#2f6f72", "#1f5256", "#123638"],
    tree: "#1d3a22", moon: true, fog: 0.03, junk: 0.7, moose: true, summer: true,
    fish: ["orret", "abbor", "sik", "mort", "karpe", "brasme"],
    rare: { key: "tjernsgiganten", name: "Tjernsgiganten", min: 6, max: 16, kr: 170, shape: "round", body: "#7a6a2a", belly: "#e8d88a", fin: "#5a4a1a", pattern: "plain", seed: 811, tag: "S\u00e5 stor at elgen ble misunnelig! \ud83e\udeac" },
  },
  {
    key: "nordlys", name: "Nordlysvatnet", cost: 4000, desc: "Arktisk \u2014 nordlyset danser",
    sky: ["#02060f", "#06101e", "#0a1828", "#0e2236", "#143048"],
    water: ["#10283a", "#0a1c2c", "#06121e"],
    tree: "#0c1822", snow: true, fog: 0.06, junk: 0.4, aurora: true,
    fish: ["roye", "harr", "sik", "orret", "lake"],
    rare: { key: "nordlysroya", name: "Nordlysr\u00f8ya", min: 5, max: 11, kr: 300, shape: "normal", body: "#2a6a7a", belly: "#9affd0", fin: "#6affc0", pattern: "spots", spot: "#e0fff0", seed: 821, tag: "Den lyser som selve nordlyset! \u2728" },
  },
];
// register rare/legendary fish so they can be looked up + sold
LOCATIONS.forEach((l) => { if (l.rare) { l.rare.junk = false; l.rare.legendary = true; l.rare.weight = 1; FISH_BY_KEY[l.rare.key] = l.rare; } });
// trophy fish, one per water, for the record book
const RARES = LOCATIONS.filter((l) => l.rare).map((l) => ({ ...l.rare, locName: l.name }));
let LOC = LOCATIONS[0];
function setLocation(key) {
  LOC = LOCATIONS.find((l) => l.key === key) || LOCATIONS[0];
  save.location = LOC.key; persist();
}
const locFish = () => FISH.filter((f) => LOC.fish.includes(f.key));

function pickFish() {
  const r = rod().rare;
  const luck = buff.t > 0 ? buff.luck : 0;
  // legendary catch of this location
  if (LOC.rare && Math.random() < 0.014 + r * 0.02 + luck * 0.04) return LOC.rare;
  const pool = [];
  for (const f of locFish()) {
    let w = f.weight;
    if (f.kr >= 90) w *= 1 + r * 1.0 + luck * 1.1;       // valuable fish more likely with good rod / boost
    if (f.kr <= 30) w *= 1 - r * 0.28 - luck * 0.18;
    pool.push({ f, w });
  }
  for (const j of JUNK) pool.push({ f: j, w: j.weight * (1 - r * 0.6 - luck * 0.4) * (LOC.junk || 1) });
  let total = pool.reduce((s, p) => s + Math.max(0, p.w), 0);
  let x = Math.random() * total;
  for (const p of pool) {
    if ((x -= Math.max(0, p.w)) <= 0) return p.f;
  }
  return locFish()[0];
}

function rollWeight(f) {
  const p = Math.max(0.7, 1.8 - save.rodLevel * 0.22);
  return +(f.min + (f.max - f.min) * Math.pow(Math.random(), p)).toFixed(2);
}

/* =========================================================================
   Scene anchors
   ========================================================================= */
const WATER_Y = 150;
const ROD_TIP = { x: 150, y: 70, bx: 150 };
const BOBBER_HOME = { x: 330, y: 178 };
const SEKK = { x: 12, y: 150, w: 30, h: 26 };
const RADIO = { x: 50, y: 160, w: 18, h: 13 };
const TRUCK = { x: 2, y: 116, w: 44, h: 22 };
const FISH_STALL = { x: 12, y: 90, w: 96, h: 100 };
const KIOSK_STALL = { x: 132, y: 90, w: 96, h: 100 };
const ROD_STALL = { x: 252, y: 90, w: 96, h: 100 };
const CASINO_STALL = { x: 372, y: 90, w: 96, h: 100 };
const MARKET_TRUCK = { x: 6, y: 214, w: 60, h: 30 };

/* =========================================================================
   State
   ========================================================================= */
let screen = "menu";        // menu | game | market | shopFish | shopRod | inventory
let prevScreen = "menu";
let fishState = "ready";    // ready | casting | waiting | bite | hooked | reveal | missed
let t = 0, stateTime = 0;

let biteTimer = 0, biteWindow = 0, nibbleTimer = 0, nibbleShake = 0;
let holding = false, progress = 0, tension = 0, pullTimer = 0, pulling = 0;
let currentFish = null, currentCatch = null, missReason = "";
let castProgress = 0;

let bobber = { x: BOBBER_HOME.x, y: BOBBER_HOME.y, sink: 0 };
let castTarget = { x: BOBBER_HOME.x, y: BOBBER_HOME.y };

// world map spots + travel animation
const MAP_SPOTS = [
  { key: "skogstjern", x: 90, y: 180 },
  { key: "myra", x: 160, y: 92 },
  { key: "elgtjern", x: 235, y: 215 },
  { key: "elva", x: 300, y: 138 },
  { key: "fjellvatn", x: 388, y: 74 },
  { key: "nordlys", x: 435, y: 188 },
];
let travel = { key: null, t: 0, dur: 2.8, toName: "" };
// one-time opening cinematic (poor farm boy leaves the farm to go fishing)
let intro = { t: 0, running: false, enginePlayed: false, rodSfx: false };
const IN = { walkStart: 1.4, walkEnd: 7.2, throwS: 7.2, throwE: 8.2, climbS: 8.6, climbE: 10.2, engine: 10.4, driveS: 11.2, end: 18.6 };
function startTravel(key) {
  travel.key = key; travel.t = 0;
  travel.toName = key === "market" ? "Markedet" : ((LOCATIONS.find((l) => l.key === key) || {}).name || "");
  screen = "travel";
  OVERLAYS.forEach((o) => $(o).classList.remove("active"));
  hudEl.classList.add("hidden");
  stopRadio(); inspector.active = false;
  ensureAudio(); sfxHorn(); startEngine();
}
// travel to a water, buying its unlock first if needed (markedet is always free)
function tryTravel(key) {
  if (key === "market") { startTravel("market"); return; }
  const loc = LOCATIONS.find((l) => l.key === key); if (!loc) return;
  if ((save.unlocked || []).includes(key)) {
    if (key === save.location) setScreen("game"); else startTravel(key);
    return;
  }
  if (save.money < loc.cost) { setScreen("game"); setHint(`${loc.name} koster ${fmt(loc.cost)} kr — fisk litt mer`); sfxMiss(); return; }
  save.money -= loc.cost; save.unlocked.push(key); persist(); refreshHUD(); sfxCoin();
  startTravel(key);
}

// guy beer animation
let sipTimer = 6 + Math.random() * 6, sipAnim = 0, drinking = 0, drinkKind = "beer";
const cans = []; // thrown beer cans {x,y,vx,vy,rot,life}

// boosts / vices (consumables grant temporary luck + reeling ease)
let buff = { label: "", luck: 0, reel: 0, t: 0, dur: 1, color: "#fff" };
let buffFlash = 0, drunk = 0, smoking = 0, snusing = 0;
const smoke = [];
let coolerMenu = false, truckMenu = false, rodPanel = false, bagPanel = false, recordsPanel = false, godsakerPanel = false, kioskIdleTimer = 5, partyNode = null;
let marketNode = null, casinoAmbNode = null, casinoSpinNode = null;
let menuNode = null;
// fiskeoppsynet (license inspector) — a rare visiting NPC
let inspector = { active: false, t: 0, x: -18, phase: "in", line: "", fined: false };
let inspectorTimer = 80 + Math.random() * 120;
// per-location random happenings (themed like the inspector but unique to each water)
let gameEvent = { active: false, t: 0, dur: 0, title: "", line: "", color: "#cfe" };
let eventTimer = 45 + Math.random() * 65;
let catStealTimer = 80 + Math.random() * 110;

// ambient
const fireflies = Array.from({ length: 14 }, () => ({ x: Math.random() * W, y: 40 + Math.random() * 110, ph: Math.random() * 6.28, sp: 0.3 + Math.random() * 0.5, drift: Math.random() * 6.28 }));
const stars = Array.from({ length: 42 }, () => ({ x: Math.random() * W, y: Math.random() * 92, b: Math.random(), tw: Math.random() * 6.28 }));
// the occasional shooting star streaking across the arctic sky (Nordlysvatnet)
let shootStar = { on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, timer: 5 + Math.random() * 9 };
// the cottage cat (Findus) — tags along on fishing trips and pads about doing its own thing
let cat = { state: "away", x: -20, y: 220, timer: 14 + Math.random() * 26, t: 0, action: "sit", target: 116, chaseX: 0, mission: null, eat: 0, munch: 0 };
// market passers-by (cosmetic NPCs that stroll the street back and forth)
const NPC_COLORS = [["#7a4a6a", "#caa23a"], ["#3a5a7a", "#d8d2c0"], ["#6a5a3a", "#b23a2a"], ["#4a6a4a", "#e0b48a"]];
const marketNPCs = Array.from({ length: 4 }, (_, i) => ({
  x: Math.random() * W, y: 184 + (i % 3) * 7,
  dir: Math.random() < 0.5 ? 1 : -1, sp: 10 + Math.random() * 12,
  coat: NPC_COLORS[i % NPC_COLORS.length][0], hat: NPC_COLORS[i % NPC_COLORS.length][1],
  ph: Math.random() * 6.28, pause: 0,
}));
const ripples = [];
function addRipple(x, y, max = 14) { ripples.push({ x, y, r: 1, max, life: 1 }); }

let wolfTimer = 30 + Math.random() * 50;
let cricketTimer = 0;

/* =========================================================================
   Audio (Web Audio, procedural)
   ========================================================================= */
let audioCtx = null, muted = false, noiseBuf = null, masterGain = null;
const VOL_KEY = "cozyPond_vol";
let masterVol = (() => { const v = parseFloat(localStorage.getItem(VOL_KEY)); return isNaN(v) ? 0.7 : Math.min(1, Math.max(0, v)); })();
function effVol() { return muted ? 0 : masterVol; }
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const len = audioCtx.sampleRate * 1;
    noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    masterGain = audioCtx.createGain();
    masterGain.gain.value = effVol();
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}
function blip(freq, dur, type = "sine", vol = 0.16, when = 0) {
  if (muted || !audioCtx) return;
  const tt = audioCtx.currentTime + when;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, tt);
  g.gain.exponentialRampToValueAtTime(vol, tt + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
  o.connect(g).connect(masterGain || audioCtx.destination);
  o.start(tt); o.stop(tt + dur + 0.02);
}
function noise(dur, freq, vol = 0.15, type = "lowpass") {
  if (muted || !audioCtx) return;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuf;
  const filt = audioCtx.createBiquadFilter(); filt.type = type; filt.frequency.value = freq;
  const g = audioCtx.createGain();
  const tt = audioCtx.currentTime;
  g.gain.setValueAtTime(vol, tt);
  g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
  src.connect(filt).connect(g).connect(masterGain || audioCtx.destination);
  src.start(tt); src.stop(tt + dur);
}

/* ---- recorded samples (mp3 files in /lyder) ---- */
const SAMPLES = { burp: "burp", fart: "fart", engine: "engine", yiha: "yiha", howl: "howl", cigar: "lighitng-cigar", radio: "radiosong1", radio2: "radiosong2", radio3: "radiosong3", radio4: "radiosong4", hoo: "hooooo", party: "muffled-party-music", moan: "woman-moan", grumpyVoice: "grumpy-man-sound", ohbro: "oh-brother", eyybro: "eyy-eyy-eyy-sup-my.bro", market: "market-sound", casinoAmb: "casino-ambient-sound", casinoSpin: "casino-spin", ladyWelcome: "lady-welcome-talk", menuMusic: "menu-music", introMusic: "intro-music" };
const sampleEls = {};
for (const k in SAMPLES) { const a = new Audio(`lyder/${SAMPLES[k]}.mp3`); a.preload = "auto"; sampleEls[k] = a; }
const activeLoops = new Set();
const activeVoices = new Set(); // longer one-shot voice/sfx clones, so they can be cut on screen change
function playSample(name, opts = {}) {
  if (muted) return null;
  const base = sampleEls[name]; if (!base) return null;
  const loop = !!opts.loop;
  const node = loop ? base : base.cloneNode(true);
  node.loop = loop;
  node._baseVol = clamp(opts.vol == null ? 1 : opts.vol, 0, 1);
  node.volume = node._baseVol * effVol();
  if (opts.rate) node.playbackRate = opts.rate;
  node._stopped = false;
  try { node.currentTime = 0; } catch (e) {}
  const pr = node.play();
  if (pr && pr.then) { node._playPromise = pr; pr.then(() => { if (node._stopped) { try { node.pause(); } catch (e) {} } }).catch(() => {}); }
  if (loop) activeLoops.add(node);
  else { activeVoices.add(node); node.addEventListener("ended", () => activeVoices.delete(node), { once: true }); }
  return node;
}
// pause reliably even if the async play() promise hasn't resolved yet (avoids audio bleeding past a stop)
function stopSample(node) {
  if (!node) return;
  node._stopped = true;
  try { node.pause(); node.currentTime = 0; } catch (e) {}
  if (node._playPromise && node._playPromise.then) node._playPromise.then(() => { try { node.pause(); } catch (e) {} }).catch(() => {});
  activeLoops.delete(node); activeVoices.delete(node);
}
function stopAllVoices() { activeVoices.forEach((n) => stopSample(n)); activeVoices.clear(); }

const sfxCast = () => { blip(230, 0.16, "triangle", 0.1); setTimeout(() => noise(0.18, 700, 0.12), 150); };
const sfxPlop = () => { blip(380, 0.1, "sine", 0.14); noise(0.12, 500, 0.08); };
const sfxBite = () => { blip(540, 0.07, "square", 0.14); noise(0.25, 900, 0.16); };
const sfxReel = () => blip(85 + Math.random() * 35, 0.05, "sawtooth", 0.04);
const sfxSplash = () => noise(0.3, 700, 0.18);
const sfxCatch = () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.16, "triangle", 0.15, i * 0.09));
const sfxMiss = () => { blip(200, 0.18, "sawtooth", 0.12); blip(130, 0.22, "sawtooth", 0.12, 0.11); };
const sfxCoin = () => [880, 1175].forEach((f, i) => blip(f, 0.12, "square", 0.12, i * 0.06));
const sfxCanOpen = () => { noise(0.12, 4000, 0.12, "highpass"); blip(180, 0.1, "sine", 0.06); };
const sfxGulp = () => blip(140, 0.09, "sine", 0.1);
const sfxThrow = () => blip(300, 0.08, "triangle", 0.07);
const sfxClink = () => blip(700, 0.06, "square", 0.06);
const sfxLady = () => { blip(660, 0.16, "sine", 0.1); blip(880, 0.18, "sine", 0.1, 0.1); blip(988, 0.2, "sine", 0.08, 0.22); };
const sfxGrumpy = () => { blip(110, 0.2, "sawtooth", 0.13); blip(88, 0.24, "sawtooth", 0.12, 0.12); };
const sfxHorn = () => { blip(330, 0.18, "square", 0.11); blip(247, 0.24, "square", 0.11, 0.18); };
const sfxKiosk = () => { blip(523, 0.1, "square", 0.08); blip(784, 0.12, "square", 0.08, 0.08); noise(0.06, 4000, 0.04, "highpass"); };
function sfxBurp() {
  if (muted || !audioCtx) return;
  const tt = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain(), lp = audioCtx.createBiquadFilter();
  o.type = "sawtooth"; lp.type = "lowpass"; lp.frequency.value = 600;
  o.frequency.setValueAtTime(150, tt);
  o.frequency.linearRampToValueAtTime(68, tt + 0.34);
  const lfo = audioCtx.createOscillator(), lg = audioCtx.createGain();
  lfo.frequency.value = 19; lg.gain.value = 28; lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, tt);
  g.gain.exponentialRampToValueAtTime(0.2, tt + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.4);
  o.connect(lp).connect(g).connect(masterGain || audioCtx.destination);
  o.start(tt); lfo.start(tt); o.stop(tt + 0.42); lfo.stop(tt + 0.42);
}
function frogCroak() { if (muted || !audioCtx) return; const f = 88 + Math.random() * 30; blip(f, 0.12, "sawtooth", 0.07); blip(f * 1.1, 0.1, "sawtooth", 0.05, 0.13); }
function owlHoot() { if (muted || !audioCtx) return; blip(430, 0.16, "sine", 0.055); blip(380, 0.22, "sine", 0.05, 0.24); }
function plopRandom() { if (muted || !audioCtx) return; blip(300 + Math.random() * 120, 0.09, "sine", 0.07); }
let engineNode = null;
function startEngine() {
  engineNode = playSample("engine", { vol: 0.45, loop: true });
  playSample("yiha", { vol: 0.85 });
}
function stopEngine() {
  stopSample(engineNode); engineNode = null;
}
let frogTimer = 3 + Math.random() * 5, owlTimer = 10 + Math.random() * 14;
let ladyIdleTimer = 3, rodIdleTimer = 4;

function cricketChirp() {
  if (muted || !audioCtx) return;
  const f = 4200 + Math.random() * 600;
  blip(f, 0.012, "square", 0.025);
  blip(f, 0.012, "square", 0.025, 0.03);
  blip(f, 0.012, "square", 0.025, 0.06);
}
function wolfHowl() {
  if (muted || !audioCtx) return;
  const tt = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(180, tt);
  o.frequency.linearRampToValueAtTime(300, tt + 0.6);
  o.frequency.linearRampToValueAtTime(250, tt + 1.4);
  o.frequency.linearRampToValueAtTime(150, tt + 2.0);
  const lp = audioCtx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
  g.gain.setValueAtTime(0.0001, tt);
  g.gain.exponentialRampToValueAtTime(0.08, tt + 0.4);
  g.gain.setValueAtTime(0.08, tt + 1.4);
  g.gain.exponentialRampToValueAtTime(0.0001, tt + 2.1);
  o.connect(lp).connect(g).connect(masterGain || audioCtx.destination);
  o.start(tt); o.stop(tt + 2.2);
}
// low, guttural zombie/troll groan from the bog
function trollGroan() {
  if (muted || !audioCtx) return;
  const tt = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain(), lp = audioCtx.createBiquadFilter();
  o.type = "sawtooth"; lp.type = "lowpass"; lp.frequency.value = 380;
  o.frequency.setValueAtTime(70, tt);
  o.frequency.linearRampToValueAtTime(54, tt + 0.5);
  o.frequency.linearRampToValueAtTime(62, tt + 1.0);
  o.frequency.linearRampToValueAtTime(40, tt + 1.6);
  // a slow wobble makes it sound like a moaning "uuurrgh"
  const lfo = audioCtx.createOscillator(), lg = audioCtx.createGain();
  lfo.frequency.value = 6.5; lg.gain.value = 10; lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(0.0001, tt);
  g.gain.exponentialRampToValueAtTime(0.13, tt + 0.3);
  g.gain.setValueAtTime(0.12, tt + 1.1);
  g.gain.exponentialRampToValueAtTime(0.0001, tt + 1.7);
  o.connect(lp).connect(g).connect(masterGain || audioCtx.destination);
  o.start(tt); lfo.start(tt); o.stop(tt + 1.8); lfo.stop(tt + 1.8);
}
// a silly nasal moose honk — two goofy notes
function mooseCall() {
  if (muted || !audioCtx) return;
  const tt = audioCtx.currentTime;
  const honk = (start, f0, f1) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain(), lp = audioCtx.createBiquadFilter();
    o.type = "sawtooth"; lp.type = "lowpass"; lp.frequency.value = 1100;
    o.frequency.setValueAtTime(f0, tt + start);
    o.frequency.linearRampToValueAtTime(f1, tt + start + 0.34);
    // nasal buzz
    const lfo = audioCtx.createOscillator(), lg = audioCtx.createGain();
    lfo.frequency.value = 22; lg.gain.value = 14; lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, tt + start);
    g.gain.exponentialRampToValueAtTime(0.12, tt + start + 0.05);
    g.gain.setValueAtTime(0.11, tt + start + 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, tt + start + 0.42);
    o.connect(lp).connect(g).connect(masterGain || audioCtx.destination);
    o.start(tt + start); lfo.start(tt + start); o.stop(tt + start + 0.44); lfo.stop(tt + start + 0.44);
  };
  honk(0, 196, 150);
  honk(0.4, 165, 120);
}
let radio = { on: false };
let radioNode = null;
const RADIO_SONGS = ["radio", "radio2", "radio3", "radio4"];
let radioIdx = 0;
function radioTick(dt) { /* HTMLAudio handles playback; playlist advances on 'ended' */ }
function playRadioSong() {
  radioNode = playSample(RADIO_SONGS[radioIdx], { vol: 0.45 });
  if (radioNode) {
    activeLoops.add(radioNode);
    radioNode.addEventListener("ended", () => {
      activeLoops.delete(radioNode);
      if (!radio.on) return;
      radioIdx = (radioIdx + 1) % RADIO_SONGS.length;
      playRadioSong();
    }, { once: true });
  }
}
function clickRadio() {
  ensureAudio();
  radio.on = !radio.on;
  if (radio.on) { radioIdx = Math.floor(Math.random() * RADIO_SONGS.length); playRadioSong(); }
  else { stopSample(radioNode); radioNode = null; }
  sfxClink();
}
function stopRadio() {
  radio.on = false;
  if (radioNode) { stopSample(radioNode); radioNode = null; }
}

/* =========================================================================
   Helpers
   ========================================================================= */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v) | 0;
const lerp = (a, b, k) => a + (b - a) * k;
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp255(((n >> 16) & 255) + amt), g = clamp255(((n >> 8) & 255) + amt), b = clamp255((n & 255) + amt);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function px(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
let lastHint = null;
function setHint(text) {
  if (text === lastHint) return;
  lastHint = text;
  hintEl.textContent = text || "";
  hintEl.classList.toggle("hidden", !text || screen !== "game");
}

/* =========================================================================
   Procedural fish sprite — draws on any 2D context with pixel blocks
   ========================================================================= */
function drawFishSprite(g, ox, oy, u, f) {
  const cell = (cx, cy, col) => { g.fillStyle = col; g.fillRect(Math.round(ox + cx * u), Math.round(oy + cy * u), u, u); };
  let L = 24, Hh = 5;
  if (f.shape === "long") { L = 34; Hh = 4; }
  else if (f.shape === "tall") { L = 22; Hh = 8; }
  else if (f.shape === "round") { L = 20; Hh = 7; }
  let seed = f.seed || 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const half = (L - 1) / 2;

  // tail fin (left)
  for (let k = 1; k <= 4; k++) {
    const fh = k + 1;
    for (let j = -fh; j <= fh; j++) cell(-half - k, j, f.fin);
  }
  // body columns (head at right)
  for (let i = 0; i < L; i++) {
    const u01 = i / (L - 1);
    const x = Math.round(i - half);
    const prof = Math.sin(Math.pow(u01, 0.6) * Math.PI * 0.92 + 0.08);
    let hh = Math.max(0, Math.round(Hh * prof * (0.55 + 0.6 * u01)));
    if (u01 > 0.9) hh = Math.max(1, hh - 1);
    for (let j = -hh; j <= hh; j++) {
      let col = f.body;
      if (j > hh * 0.25) col = f.belly;
      else if (j < -hh * 0.55) col = shade(f.body, -18);
      cell(x, j, col);
    }
    if (f.pattern === "stripes" && hh > 0 && i % 3 === 0 && u01 < 0.85) {
      for (let j = -hh; j <= Math.round(-hh * 0.1); j++) cell(x, j, shade(f.body, -34));
    }
    if (f.pattern === "spots" && hh > 1) {
      if (rnd() < 0.22) cell(x, Math.round(-hh * 0.5 + rnd() * hh), f.spot || "#222");
      if (rnd() < 0.14) cell(x, Math.round(rnd() * hh * 0.5), f.spot || "#222");
    }
  }
  // dorsal fin
  const dcx = Math.round((f.shape === "long" ? 0.5 : 0.1) * half);
  const dorTop = -Hh - (f.bigDorsal ? 3 : 1);
  for (let dx = -2; dx <= 2; dx++)
    for (let j = dorTop; j <= -Math.max(1, Hh - 2); j++) cell(dcx + dx, j, f.fin);
  // pectoral + anal fin
  cell(Math.round(half * 0.35), Math.round(Hh * 0.4), f.fin);
  cell(Math.round(half * 0.35) + 1, Math.round(Hh * 0.4) + 1, f.fin);
  cell(Math.round(-half * 0.2), Hh - 1, f.fin);
  // eye
  cell(Math.round(half - 1.5), -1, "#ffffff");
  g.fillStyle = "#10131f";
  g.fillRect(Math.round(ox + (half - 1.5) * u + u * 0.25), Math.round(oy - 1 * u + u * 0.1), Math.max(1, u * 0.6), Math.max(1, u * 0.6));
  // mouth
  cell(Math.round(half + 0.5), 0, shade(f.body, -30));
}

function drawJunkSprite(g, ox, oy, u, kind) {
  const cell = (cx, cy, col) => { g.fillStyle = col; g.fillRect(Math.round(ox + cx * u), Math.round(oy + cy * u), u, u); };
  if (kind === "can") {
    for (let x = -3; x <= 3; x++) for (let y = -5; y <= 5; y++) cell(x, y, x <= -2 ? "#9aa0a8" : "#c9ccd2");
    for (let y = -5; y <= 5; y++) cell(-1, y, "#cf3b3b");
    cell(0, -6, "#7f8189"); cell(1, -6, "#7f8189");
  } else { // boot
    for (let x = -2; x <= 2; x++) for (let y = -6; y <= 2; y++) cell(x, y, "#4a3b2c");
    for (let x = -2; x <= 5; x++) cell(x, 3, "#3a2e22");
    for (let x = -2; x <= 5; x++) cell(x, 4, "#2c2218");
    cell(-2, -6, "#5a4836"); cell(-1, -6, "#5a4836");
  }
}

// sprite data-url cache for DOM lists
const spriteCache = {};
function fishSpriteURL(f, u = 2) {
  const key = f.key + "_" + u;
  if (spriteCache[key]) return spriteCache[key];
  const c = document.createElement("canvas");
  c.width = 80; c.height = 48;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  if (f.junk) drawJunkSprite(g, 40, 24, u, f.kind); else drawFishSprite(g, 44, 24, u, f);
  return (spriteCache[key] = c.toDataURL());
}
function rodSpriteURL(r) {
  const key = "rod_" + r.name;
  if (spriteCache[key]) return spriteCache[key];
  const c = document.createElement("canvas"); c.width = 40; c.height = 40;
  const g = c.getContext("2d"); g.imageSmoothingEnabled = false;
  g.strokeStyle = r.color; g.lineWidth = 3; g.lineCap = "round";
  g.beginPath(); g.moveTo(6, 34); g.quadraticCurveTo(20, 10, 34, 6); g.stroke();
  g.strokeStyle = r.grip; g.lineWidth = 4; g.beginPath(); g.moveTo(6, 34); g.lineTo(12, 24); g.stroke();
  g.fillStyle = r.grip; g.beginPath(); g.arc(12, 26, 3, 0, 6.28); g.fill();
  g.fillStyle = r.tip; g.fillRect(33, 5, 3, 3);
  g.strokeStyle = "rgba(220,230,255,0.7)"; g.lineWidth = 1; g.beginPath(); g.moveTo(34, 6); g.lineTo(30, 34); g.stroke();
  return (spriteCache[key] = c.toDataURL());
}

/* =========================================================================
   Input
   ========================================================================= */
function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - r.top;
  return { x: (cx / r.width) * W, y: (cy / r.height) * H };
}
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const padRect = (r, p) => ({ x: r.x - p, y: r.y - p, w: r.w + p * 2, h: r.h + p * 2 });

function canvasPress(p) {
  ensureAudio();
  if (screen === "intro") { if (!intro.running) startIntroPlayback(); else endIntro(); return; }
  if (screen === "market") {
    if (inRect(p.x, p.y, MARKET_TRUCK)) { startTravel(save.location); return; }
    if (inRect(p.x, p.y, FISH_STALL)) { setScreen("shopFish"); }
    else if (inRect(p.x, p.y, KIOSK_STALL)) { sfxKiosk(); setScreen("shopKiosk"); }
    else if (inRect(p.x, p.y, ROD_STALL)) { setScreen("shopRod"); }
    else if (inRect(p.x, p.y, CASINO_STALL)) { setScreen("shopCasino"); }
    return;
  }
  if (screen === "map") {
    for (const sp of MAP_SPOTS) {
      if (Math.hypot(p.x - sp.x, p.y - (sp.y - 12)) < 18) {
        tryTravel(sp.key);
        return;
      }
    }
    return;
  }
  if (screen !== "game") return;
  // in-scene travel picker over the parked truck
  if (truckMenu) {
    for (const it of truckItemRects()) if (inRect(p.x, p.y, it)) {
      truckMenu = false;
      tryTravel(it.key);
      return;
    }
    truckMenu = false; return;
  }
  // the brown sekk by your side: consumables + swap rod + see your catch
  if (coolerMenu) {
    if (backBtnRect && inRect(p.x, p.y, backBtnRect)) { coolerMenu = false; sfxClink(); return; }
    for (const it of coolerItemRects()) if (inRect(p.x, p.y, it)) {
      coolerMenu = false;
      if (it.key === "_godsaker") { godsakerPanel = true; sfxClink(); }
      else if (it.key === "_bag") { bagPanel = true; sfxClink(); }
      else if (it.key === "_rods") { rodPanel = true; sfxClink(); }
      else if (it.key === "_records") { recordsPanel = true; sfxClink(); }
      return;
    }
    coolerMenu = false; return;
  }
  // godsaker sub-panel: pick a consumable to use
  if (godsakerPanel) {
    if (backBtnRect && inRect(p.x, p.y, backBtnRect)) { godsakerPanel = false; coolerMenu = true; sfxClink(); return; }
    for (const it of godsakerRects()) if (inRect(p.x, p.y, it)) {
      useConsumable(it.key); return;        // stay open so you can knock back several in a row
    }
    godsakerPanel = false; return;
  }
  // in-scene rod picker (no overlay menu)
  if (rodPanel) {
    if (backBtnRect && inRect(p.x, p.y, backBtnRect)) { rodPanel = false; coolerMenu = true; sfxClink(); return; }
    for (const it of rodPanelRects()) if (inRect(p.x, p.y, it)) {
      if (save.owned.includes(it.level)) { equipRod(it.level); setHint("Byttet til " + RODS[it.level].name); }
      rodPanel = false; return;
    }
    rodPanel = false; return;
  }
  // in-scene catch summary / records (no overlay menu)
  if (bagPanel) {
    if (backBtnRect && inRect(p.x, p.y, backBtnRect)) { bagPanel = false; coolerMenu = true; sfxClink(); return; }
    bagPanel = false; return;
  }
  if (recordsPanel) {
    if (backBtnRect && inRect(p.x, p.y, backBtnRect)) { recordsPanel = false; coolerMenu = true; sfxClink(); return; }
    recordsPanel = false; return;
  }
  // shoo the thieving cat before it finishes off your smallest fish
  if (cat.mission === "steal" && (cat.state === "arrive" || cat.state === "eat") &&
      inRect(p.x, p.y, { x: cat.x - 12, y: cat.y - 18, w: 30, h: 24 })) {
    cat.state = "leave"; cat.mission = null; cat.t = 0; catHiss();
    showCatEvent("Du jaget katten!", "Fisken er reddet — pus stikker av.");
    return;
  }
  if (fishState === "reveal") { closeReveal(); return; }
  if (fishState === "ready") {
    if (inRect(p.x, p.y, padRect(TRUCK, 6))) { truckMenu = true; sfxHorn(); return; }
    if (inRect(p.x, p.y, padRect(SEKK, 10))) { coolerMenu = true; sfxClink(); return; }
    if (inRect(p.x, p.y, padRect(RADIO, 6))) { clickRadio(); return; }
    // cast where you click on the water (keyboard uses default spot)
    if (p.x >= 0 && p.y > WATER_Y) {
      castTarget.x = clamp(p.x, 185, 462);
      castTarget.y = clamp(p.y, WATER_Y + 14, H - 26);
    } else {
      castTarget.x = BOBBER_HOME.x; castTarget.y = BOBBER_HOME.y;
    }
    startCast(); return;
  }
  if (fishState === "waiting") { setMiss("For tidlig!"); return; }
  if (fishState === "bite") { hookFish(); return; }
  if (fishState === "hooked") { holding = true; return; }
}

canvas.addEventListener("mousedown", (e) => { e.preventDefault(); canvasPress(toCanvas(e)); });
canvas.addEventListener("mouseup", () => (holding = false));
canvas.addEventListener("mouseleave", () => { holding = false; hover.on = false; hoverProp = null; canvas.style.cursor = "default"; });
canvas.addEventListener("touchstart", (e) => { e.preventDefault(); canvasPress(toCanvas(e)); }, { passive: false });
canvas.addEventListener("touchend", (e) => { e.preventDefault(); holding = false; }, { passive: false });

// hover feedback: a pointer cursor (and an in-scene highlight) over anything clickable
let hover = { x: -1, y: -1, on: false };
let hoverProp = null;        // "truck" | "sekk" | "radio" — highlighted in the fishing scene
function interactiveAt(p) {
  if (screen === "intro") return "play";
  if (screen === "menu") return null; // menu uses real DOM buttons
  if (screen === "market") {
    if (inRect(p.x, p.y, MARKET_TRUCK) || inRect(p.x, p.y, FISH_STALL) || inRect(p.x, p.y, KIOSK_STALL) || inRect(p.x, p.y, ROD_STALL) || inRect(p.x, p.y, CASINO_STALL)) return "btn";
    return null;
  }
  if (screen === "map") {
    for (const sp of MAP_SPOTS) if (Math.hypot(p.x - sp.x, p.y - (sp.y - 12)) < 18) return "btn";
    return null;
  }
  if (screen !== "game") return null;
  if (truckMenu) { for (const it of truckItemRects()) if (inRect(p.x, p.y, it)) return "btn"; return "btn"; }
  if (coolerMenu) { if (backBtnRect && inRect(p.x, p.y, backBtnRect)) return "btn"; for (const it of coolerItemRects()) if (inRect(p.x, p.y, it)) return "btn"; return "btn"; }
  if (godsakerPanel) { if (backBtnRect && inRect(p.x, p.y, backBtnRect)) return "btn"; for (const it of godsakerRects()) if (inRect(p.x, p.y, it)) return "btn"; return "btn"; }
  if (rodPanel) { if (backBtnRect && inRect(p.x, p.y, backBtnRect)) return "btn"; for (const it of rodPanelRects()) if (inRect(p.x, p.y, it)) return "btn"; return "btn"; }
  if (bagPanel || recordsPanel) return "btn";
  if (fishState === "reveal") return "btn";
  if (fishState === "ready") {
    if (inRect(p.x, p.y, padRect(TRUCK, 6))) return "truck";
    if (inRect(p.x, p.y, padRect(SEKK, 10))) return "sekk";
    if (inRect(p.x, p.y, padRect(RADIO, 6))) return "radio";
    if (p.x >= 0 && p.y > WATER_Y) return "water";
    return null;
  }
  if (fishState === "bite" || fishState === "hooked") return "btn";
  return null;
}
function updateCursor() {
  if (!hover.on) { canvas.style.cursor = "default"; hoverProp = null; return; }
  const k = interactiveAt(hover);
  hoverProp = (screen === "game" && fishState === "ready" && (k === "truck" || k === "sekk" || k === "radio")) ? k : null;
  canvas.style.cursor = !k ? "default" : (k === "water" ? "crosshair" : "pointer");
}
canvas.addEventListener("mousemove", (e) => { const p = toCanvas(e); hover.x = p.x; hover.y = p.y; hover.on = true; updateCursor(); });
canvas.addEventListener("mouseenter", () => { hover.on = true; });
// highlight the hovered prop in the fishing scene so it's obvious it can be clicked
const HOVER_LABELS = { truck: "Reise", sekk: "Sekk", radio: "Radio" };
function drawHoverHighlight() {
  if (!hoverProp) return;
  const r = hoverProp === "truck" ? padRect(TRUCK, 6) : hoverProp === "sekk" ? padRect(SEKK, 10) : padRect(RADIO, 6);
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.globalAlpha = 0.45 + 0.45 * pulse; ctx.strokeStyle = "#ffe6a0"; ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, r.w - 1, r.h - 1);
  // corner ticks for a "selectable" feel
  ctx.globalAlpha = 0.7 + 0.3 * pulse;
  for (const [ox, oy, dx, dy] of [[r.x, r.y, 1, 1], [r.x + r.w, r.y, -1, 1], [r.x, r.y + r.h, 1, -1], [r.x + r.w, r.y + r.h, -1, -1]]) {
    px(Math.round(ox - (dx < 0 ? 3 : 0)), Math.round(oy), 3, 1, "#fff2c0");
    px(Math.round(ox), Math.round(oy - (dy < 0 ? 3 : 0)), 1, 3, "#fff2c0");
  }
  ctx.globalAlpha = 1;
  // floating label
  const label = HOVER_LABELS[hoverProp];
  if (label) {
    ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const lw = ctx.measureText(label).width + 8, lx = r.x + r.w / 2, ly = r.y - 7;
    px(Math.round(lx - lw / 2), Math.round(ly - 5), Math.round(lw), 10, "rgba(14,12,22,0.85)");
    ctx.fillStyle = "#ffe6a0"; ctx.fillText(label, lx, ly);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
}

window.addEventListener("keydown", (e) => {
  if (screen === "intro") {
    if (e.code === "KeyM") { toggleMute(); return; }
    if (!intro.running) startIntroPlayback(); else endIntro();
    return;
  }
  if (e.code === "Space") { e.preventDefault(); if (!e.repeat && screen === "game") canvasPress({ x: -1, y: -1 }); }
  if (e.code === "KeyM") toggleMute();
  if (e.code === "KeyF") toggleFullscreen();
  if (e.code === "Escape") {
    if (screen === "shopFish" || screen === "shopRod" || screen === "shopKiosk" || screen === "shopCasino") setScreen("market");
    else if (screen === "market") startTravel(save.location);
    else if (screen === "map") setScreen("game");
    else if (screen === "help") setScreen(prevScreen === "menu" ? "menu" : "game");
  }
});
window.addEventListener("keyup", (e) => { if (e.code === "Space") holding = false; });

// browsers block audio until the first user gesture — kick off the menu music then
function kickMenuMusic() {
  if (screen === "intro") return; // the intro manages its own audio; keep the listener for the menu later
  if (!muted && screen === "menu") {
    if (!menuNode) menuNode = playSample("menuMusic", { loop: true, vol: 0.5 });
    else if (menuNode.paused) { const pr = menuNode.play(); if (pr && pr.catch) pr.catch(() => {}); }
  }
  window.removeEventListener("pointerdown", kickMenuMusic);
  window.removeEventListener("keydown", kickMenuMusic);
}
window.addEventListener("pointerdown", kickMenuMusic);
window.addEventListener("keydown", kickMenuMusic);

// DOM action buttons
frame.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  doAction(b.dataset.action, b.dataset);
});

// volume sliders (hover popups on the speaker buttons) — keep them all in sync
document.querySelectorAll(".vol-slider").forEach((s) => {
  s.addEventListener("input", (e) => { ensureAudio(); setMasterVolume(parseInt(e.target.value, 10) / 100); });
});
syncVolUI();

function doAction(a, data) {
  switch (a) {
    case "startGame": setScreen("game"); break;
    case "watchIntro": if (menuNode) { stopSample(menuNode); menuNode = null; } startIntro(); startIntroPlayback(); break;
    case "openMarket": setScreen("market"); break;
    case "openMap": setScreen("map"); break;
    case "openHelp": prevScreen = screen; setScreen("help"); break;
    case "openMenu": setScreen("menu"); break;
    case "backToGame": setScreen("game"); break;
    case "driveBack": startTravel(save.location); break;
    case "shopFish": setScreen("shopFish"); break;
    case "shopRod": setScreen("shopRod"); break;
    case "sellAll": sellAll(); break;
    case "sellSpecies": sellSpecies(data.key); break;
    case "buyRod": buyRod(parseInt(data.level, 10)); break;
    case "equipRod": equipRod(parseInt(data.level, 10)); break;
    case "buyConsumable": buyConsumable(data.kind); break;
    case "buyLicense": buyLicense(); break;
    case "openKiosk": setScreen("shopKiosk"); break;
    case "casinoColor": casinoColor(data.color); break;
    case "casinoBet": casinoBet(data.amt); break;
    case "casinoSpin": casinoSpin(); break;
    case "backFromHelp": setScreen(prevScreen === "menu" ? "menu" : "game"); break;
    case "toggleMute": toggleMute(); break;
    case "toggleFullscreen": toggleFullscreen(); break;
    case "resetSave": if (confirm("Nullstille all framgang?")) { save = defaultSave(); setLocation(save.location); persist(); refreshAll(); } break;
  }
}

function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = effVol();
  if (muted) activeLoops.forEach((n) => { try { n.pause(); } catch (e) {} });
  else activeLoops.forEach((n) => { n.volume = (n._baseVol == null ? 1 : n._baseVol) * effVol(); const pr = n.play(); if (pr && pr.catch) pr.catch(() => {}); });
  if (muted) stopAllVoices();
  // if we just unmuted on the menu and music never started, kick it off now
  if (!muted && screen === "menu" && !menuNode) menuNode = playSample("menuMusic", { loop: true, vol: 0.5 });
  syncVolUI();
}
// master volume 0..1, controlled by the hover slider on the speaker button
function setMasterVolume(v) {
  masterVol = Math.min(1, Math.max(0, v));
  const wasMuted = muted;
  if (masterVol > 0) muted = false;          // dragging the slider up unmutes
  else muted = true;                          // all the way down acts as mute
  try { localStorage.setItem(VOL_KEY, masterVol.toFixed(2)); } catch (e) {}
  if (masterGain) masterGain.gain.value = effVol();
  const ev = effVol();
  activeLoops.forEach((n) => {
    n.volume = (n._baseVol == null ? 1 : n._baseVol) * ev;
    if (!muted && n.paused) { const pr = n.play(); if (pr && pr.catch) pr.catch(() => {}); }
    if (muted) { try { n.pause(); } catch (e) {} }
  });
  activeVoices.forEach((n) => { n.volume = (n._baseVol == null ? 1 : n._baseVol) * ev; });
  // if we unmuted on the menu and music never started, kick it off
  if (wasMuted && !muted && screen === "menu" && !menuNode) menuNode = playSample("menuMusic", { loop: true, vol: 0.5 });
  syncVolUI();
}
// keep every speaker icon + slider in sync with the current state
function syncVolUI() {
  const pct = Math.round(masterVol * 100);
  document.querySelectorAll(".vol-slider").forEach((s) => { if (document.activeElement !== s) s.value = pct; });
  document.querySelectorAll(".mute-btn").forEach((b) => { b.textContent = muted ? "\uD83D\uDD07" : "\uD83D\uDD0A"; });
}
function toggleFullscreen() {
  if (!document.fullscreenElement) frame.requestFullscreen?.();
  else document.exitFullscreen?.();
}

/* =========================================================================
   Screen management
   ========================================================================= */
const OVERLAYS = ["menu", "market", "map", "help", "shopFish", "shopRod", "shopKiosk", "shopCasino"];
function setScreen(name) {
  const from = screen;
  if (from === "travel") stopEngine();
  // cut any lingering voice/greeting lines from the previous screen before the new one speaks
  if (name !== from) stopAllVoices();
  coolerMenu = false; truckMenu = false; rodPanel = false; bagPanel = false; recordsPanel = false; godsakerPanel = false;
  if (name !== "game") { resetFishing(); stopRadio(); inspector.active = false; }
  // rod seller: hooooo on entry (sour until purchase), fart on the way out
  if (name === "shopRod" && from !== "shopRod") { speak("rodSpeech", "Hmf. Skal du kjøpe noe, eller bare glo?"); playSample("hoo", { vol: 0.45 }); rodGrumpyBuy = false; rodHop = 0; }
  if (from === "shopRod" && name !== "shopRod") playSample("fart", { vol: 0.7 });
  // fish lady: a spoken welcome when you walk in to sell
  if (name === "shopFish" && from !== "shopFish") { speak("ladySpeech", "Hei, kjekken… har du noe fint til meg i dag?"); playSample("ladyWelcome", { vol: 0.8 }); }
  // casino croupier greeting
  if (name === "shopCasino" && from !== "shopCasino") playSample("ohbro", { vol: 0.7 });
  // kiosk: muffled party music on loop while inside + a greeting
  if (name === "shopKiosk" && from !== "shopKiosk") { speak("kioskSpeech", "Tjena! Trygdepatron, snus, sigarillo, blænnvin — eller snabelstoff for de tøffe? Alt for et godt fiske."); playSample("eyybro", { vol: 0.7 }); }
  // looping ambience per screen — always clear it first so nothing bleeds between screens
  if (partyNode) { stopSample(partyNode); partyNode = null; }
  if (marketNode) { stopSample(marketNode); marketNode = null; }
  if (casinoAmbNode) { stopSample(casinoAmbNode); casinoAmbNode = null; }
  if (casinoSpinNode) { stopSample(casinoSpinNode); casinoSpinNode = null; }
  if (menuNode && name !== "menu") { stopSample(menuNode); menuNode = null; }
  if (casino.spinning && name !== "shopCasino") { casino.spinning = false; casino.win = false; }
  if (name === "shopKiosk") partyNode = playSample("party", { loop: true, vol: 0.4 });
  else if (name === "market") marketNode = playSample("market", { loop: true, vol: 0.45 });
  else if (name === "shopCasino") casinoAmbNode = playSample("casinoAmb", { loop: true, vol: 0.4 });
  else if (name === "menu" && !menuNode) menuNode = playSample("menuMusic", { loop: true, vol: 0.5 });
  screen = name;
  OVERLAYS.forEach((o) => $(o).classList.toggle("active", o === name));
  hudEl.classList.toggle("hidden", name !== "game");
  if (name !== "game") { reelEl.classList.add("hidden"); catchEl.classList.add("hidden"); hintEl.classList.add("hidden"); }
  if (name === "game") { resetFishing(); setHint("Klikk for å kaste ut"); }
  if (name === "shopFish") buildBasket();
  if (name === "shopRod") buildRods();
  if (name === "shopKiosk") buildKiosk();
  if (name === "shopCasino") { speak("casinoSpeech", "Welcome, my friend! Velg rød eller svart, sett innsatsen og spinn. Treffer fargen vinner du dobbelt — men pass deg for grønn null! 🎩"); buildCasino(); }
  refreshHUD();
  ensureAudio();
  hoverProp = null; updateCursor();   // recompute the cursor for the new screen even without a mouse move
}

function refreshHUD() {
  moneyEl.textContent = fmt(save.money);
  basketCountEl.textContent = save.basket.length;
  rodNameEl.textContent = rod().name;
  document.querySelectorAll(".moneyMirror").forEach((e) => (e.textContent = fmt(save.money)));
}
function refreshAll() { refreshHUD(); buildBasket(); buildRods(); buildKiosk(); }

/* =========================================================================
   Fishing state machine
   ========================================================================= */
function setFish(s) { fishState = s; stateTime = 0; }
function resetFishing() {
  fishState = "ready"; stateTime = 0; holding = false;
  progress = 0; tension = 0; pulling = 0; pullTimer = 0; castProgress = 0; nibbleShake = 0;
  bobber.x = BOBBER_HOME.x; bobber.y = BOBBER_HOME.y; bobber.sink = 0;
  castTarget.x = BOBBER_HOME.x; castTarget.y = BOBBER_HOME.y;
  reelEl.classList.add("hidden"); catchEl.classList.add("hidden");
  tensionEl.classList.remove("danger");
}
function setMiss(reason) {
  setFish("missed"); missReason = reason; sfxMiss();
  reelEl.classList.add("hidden");
}
function startCast() { setFish("casting"); castProgress = 0; sfxCast(); setHint(""); }
function beginWaiting() {
  setFish("waiting");
  bobber.x = castTarget.x; bobber.y = castTarget.y; bobber.sink = 0;
  addRipple(bobber.x, bobber.y, 18); sfxPlop();
  biteTimer = 4 + Math.random() * 7;
  nibbleTimer = 1.5 + Math.random() * 2.5;
  setHint("Vent til duppen går under…");
}
function triggerBite() {
  setFish("bite"); biteWindow = rod().window; bobber.sink = 0;
  addRipple(bobber.x, bobber.y, 22); sfxBite();
  setHint("NÅ! Klikk!");
}
function hookFish() {
  currentFish = pickFish();
  setFish("hooked");
  progress = 8; tension = 12; pullTimer = 0.6 + Math.random() * 0.8; pulling = 0; holding = false;
  reelEl.classList.remove("hidden");
  setHint("Hold for å sveive — slipp når den drar!");
  sfxSplash();
}
function finalizeCatch() {
  const f = currentFish;
  if (f.junk) {
    currentCatch = { f, junk: true, tag: f.tag };
  } else {
    const weight = rollWeight(f);
    const value = Math.round(f.kr * weight);
    const rec = save.record[f.key] || { count: 0, best: 0 };
    const isPB = rec.count > 0 && weight > rec.best;   // genuinely beat a previous personal best
    rec.count++; if (weight > rec.best) rec.best = weight;
    save.record[f.key] = rec;
    save.basket.push({ key: f.key, weight, value });
    if (save.license > 0) save.license--;
    persist();
    // legendary fish keep their flavour line; otherwise celebrate a real new record
    const tag = f.legendary ? (f.tag || "Sjelden fangst! 🏆") : (isPB ? "Ny rekord! 🏆" : "");
    currentCatch = { f, weight, value, tag };
  }
}
function catchFish() {
  reelEl.classList.add("hidden");
  finalizeCatch();
  setFish("reveal");
  const c = currentCatch;
  if (c.junk) { catchName.textContent = c.f.name; catchInfo.textContent = "verdiløst"; catchTag.textContent = c.tag || ""; }
  else { catchName.textContent = c.f.name; catchInfo.textContent = c.weight.toFixed(2) + " kg · " + fmt(c.value) + " kr"; catchTag.textContent = c.tag || ""; }
  catchEl.classList.remove("hidden");
  setHint("");
  if (c.junk) sfxMiss(); else sfxCatch();
  refreshHUD();
}
function closeReveal() { catchEl.classList.add("hidden"); setFish("ready"); setHint("Klikk for å kaste ut"); }

/* ---- consumables / boosts ---- */
function applyBuff(label, luck, reel, dur, color) {
  // one shared rus-meter: snus, øl, sigarillo … all feed the SAME pool, so mixing never bugs out
  const fresh = buff.t <= 0;
  if (fresh) { buff.luck = 0; buff.reel = 0; buff.t = 0; buff.dur = 0; buff.count = 0; }
  buff.count = (buff.count || 0) + 1;
  const fade = fresh ? 1 : 0.6;            // diminishing returns as the rus piles up
  buff.luck = clamp(buff.luck + luck * fade, 0, 1.4);
  buff.reel = clamp(buff.reel + reel * fade, 0, 0.95);
  buff.t = Math.min(buff.t + dur * fade, 150);
  buff.dur = Math.max(buff.dur, buff.t);
  buff.label = label;
  buff.color = color;
  buffFlash = 1;
}
function drinkBeer() {
  drinking = 2.2; drinkKind = "beer"; sipAnim = 0; save.beers++; persist();
  sfxCanOpen();
  setTimeout(sfxGulp, 700); setTimeout(sfxGulp, 1100); setTimeout(sfxGulp, 1500);
  setTimeout(() => { playSample("burp", { vol: 0.85 }); if (Math.random() < 0.45) setTimeout(() => playSample("fart", { vol: 0.6 }), 500); }, 2150);
  applyBuff("Ølmodig", 0.2, 0.12, 22, "#ffcf5a");
  drunk = Math.min(1, drunk + 0.5);
}
function drinkAkevitt() {
  drinking = 2.6; drinkKind = "akevitt"; sipAnim = 0;
  sfxCanOpen();
  setTimeout(sfxGulp, 600); setTimeout(sfxGulp, 1000); setTimeout(sfxGulp, 1400);
  setTimeout(() => { playSample("burp", { vol: 1 }); setTimeout(() => playSample("fart", { vol: 0.7 }), 600); }, 2100);
  applyBuff("Brennevin", 0.55, 0.3, 45, "#ffe08a");
  drunk = Math.min(1.2, drunk + 0.95);
}
function drinkSnabel() {
  drinking = 2.8; drinkKind = "snabel"; sipAnim = 0;
  sfxCanOpen();
  setTimeout(sfxGulp, 600); setTimeout(sfxGulp, 1050); setTimeout(sfxGulp, 1500); setTimeout(sfxGulp, 1900);
  setTimeout(() => { playSample("burp", { vol: 1 }); setTimeout(() => playSample("fart", { vol: 0.85 }), 650); }, 2300);
  applyBuff("Snabelstoff", 0.8, 0.42, 60, "#d8e0c0");
  drunk = Math.min(1.5, drunk + 1.25);
}
function takeSnus() {
  snusing = 1.4;
  blip(520, 0.05, "square", 0.08); setTimeout(() => blip(300, 0.08, "sine", 0.07), 120);
  applyBuff("Snusrus", 0.15, 0.08, 18, "#5fbf5f");
}
function smokeCigar() {
  smoking = 6.5;
  playSample("cigar", { vol: 0.8 });
  applyBuff("Røykpause", 0.3, 0.15, 30, "#caa46a");
}
function useConsumable(kind) {
  const names = { beer: "trygdepatron", snus: "snus", cigar: "sigarillo", akevitt: "blænnvin", snabel: "snabelstoff" };
  if ((save.stock[kind] || 0) <= 0) { setHint(`Tom for ${names[kind]} — kjøp i kiosken`); sfxMiss(); return; }
  save.stock[kind]--; persist();
  if (kind === "beer") drinkBeer();
  else if (kind === "snus") takeSnus();
  else if (kind === "cigar") smokeCigar();
  else if (kind === "akevitt") drinkAkevitt();
  else if (kind === "snabel") drinkSnabel();
}
function throwCan() {
  cans.push({ x: 78, y: 96, vx: 80 + Math.random() * 30, vy: -90, rot: 0, life: 2.5 });
  sfxThrow();
}

/* =========================================================================
   Market actions
   ========================================================================= */
function sellAll() {
  if (!save.basket.length) { speak("ladySpeech", "Tom kurv? Kom tilbake når du har fanget noe, da."); return; }
  const total = save.basket.reduce((s, b) => s + b.value, 0);
  const n = save.basket.length;
  save.money += total; save.basket = []; persist();
  sfxCoin(); playSample("moan", { vol: 0.6 });
  speak("ladySpeech", `Mmm, ${n} fisk for ${fmt(total)} kr. Takk skal du ha, kjekken 😘`);
  buildBasket(); refreshHUD();
}
function sellSpecies(key) {
  const sold = save.basket.filter((b) => b.key === key);
  if (!sold.length) return;
  const total = sold.reduce((s, b) => s + b.value, 0);
  save.basket = save.basket.filter((b) => b.key !== key);
  save.money += total; persist();
  sfxCoin(); playSample("moan", { vol: 0.6 });
  const f = FISH_BY_KEY[key];
  speak("ladySpeech", `${sold.length}× ${f.name} for ${fmt(total)} kr — godt valg 😘`);
  buildBasket(); refreshHUD();
}
function buyRod(level) {
  const r = RODS[level];
  if (!r) return;
  if (save.owned.includes(level)) { equipRod(level); return; }
  if (save.money < r.cost) { speak("rodSpeech", "Du har ikke råd. Kom igjen når du har penger. Hmf."); rodGrumpyBuy = false; sfxMiss(); return; }
  save.money -= r.cost; save.owned.push(level); save.rodLevel = level; persist();
  sfxCoin(); rodGrumpyBuy = true; rodHop = 1;
  speak("rodSpeech", `«${r.name}». Endelig litt handel. Ikke knekk den, da.`);
  buildRods(); refreshHUD();
}
function equipRod(level) {
  if (!save.owned.includes(level)) return;
  save.rodLevel = level; persist();
  sfxClink();
  buildRods(); refreshHUD();
}
function speak(id, text) { const e = $(id); if (e) e.textContent = text; }

/* ---- fiskekort (fishing license) sold by the rod seller ---- */
const LICENSE_COST = 100, LICENSE_GRANT = 60, LICENSE_FINE = 50, LICENSE_FINE_PCT = 0.25;
function buyLicense() {
  if (save.money < LICENSE_COST) { speak("rodSpeech", "Fiskekort koster penger, det også. Kom igjen med kontanter."); sfxMiss(); return; }
  save.money -= LICENSE_COST; save.license = (save.license || 0) + LICENSE_GRANT; persist();
  sfxCoin();
  speak("rodSpeech", `Vær så god — et fiskekort som varer ${LICENSE_GRANT} fangster. Hold deg på rett side av loven.`);
  buildRods(); refreshHUD();
}

/* ---- fiskeoppsynet: a rare inspector who checks your license ---- */
function triggerInspector() {
  inspector.active = true; inspector.t = 0; inspector.x = -18; inspector.phase = "in"; inspector.fined = false; inspector.line = "";
  playSample("grumpyVoice", { vol: 0.55 });
}
function resolveInspector() {
  if ((save.license || 0) > 0) {
    inspector.line = "Fiskekortet i orden. God fangst!";
    sfxClink();
  } else if (save.money >= LICENSE_FINE) {
    // the fine scales with your wealth — 25 % of what you've got (min 50 kr), so it stings when you're rich
    const fine = Math.max(LICENSE_FINE, Math.round(save.money * LICENSE_FINE_PCT));
    save.money -= fine; persist(); refreshHUD(); inspector.fined = true;
    inspector.line = `Intet fiskekort? ${fmt(fine)} kr i bot!`;
    sfxMiss();
  } else {
    inspector.line = "Mangler kort... advarsel denne gang.";
  }
}

/* ---- random per-location happenings (unique flavour + small effects per water) ---- */
const LOCATION_EVENTS = {
  skogstjern: [
    { t: "Skogvokteren", l: "«Det napper bedre ved sivet!» roper en turg\u00e5er.", k: "luck", luck: 0.35, dur: 18, c: "#8affc0", s: "hiker" },
    { t: "Frekt ekorn", l: "Et ekorn napper en kjeks fra sekken og spretter til skogs.", k: "flavor", c: "#caa07a", s: "squirrel" },
    { t: "Flaskepost", l: "Du fisker opp en flaske med {n} kr i!", k: "money", amt: [25, 60], c: "#ffd877", s: "bottle" },
    { t: "Villbring\u00e6r", l: "Du finner bring\u00e6r p\u00e5 bredden \u2014 s\u00f8tt og godt!", k: "luck", luck: 0.2, dur: 14, c: "#f06a8a", s: "berries" },
  ],
  fjellvatn: [
    { t: "Reinsdyr", l: "Et reinsdyr kommer ned for \u00e5 drikke. Magisk!", k: "luck", luck: 0.3, dur: 16, c: "#cfe6ff", s: "reindeer" },
    { t: "Fjellvind", l: "En iskald kastevind \u2014 fisken s\u00f8ker mot dypet.", k: "scare", c: "#9ec2e0", s: "wind" },
    { t: "Fjellklatrer", l: "En klatrer vinker og mister {n} kr i vannet til deg.", k: "money", amt: [40, 90], c: "#ffd877", s: "climber" },
    { t: "Sn\u00f8fonn", l: "Et dr\u00f8nn i fjellet skremmer fisken vekk!", k: "scare", c: "#e0eaff", s: "avalanche" },
  ],
  elva: [
    { t: "T\u00f8mmerfl\u00f8ting", l: "En diger t\u00f8mmerstokk sklir forbi og r\u00f8rer opp vannet.", k: "scare", c: "#8a6a3a", s: "log" },
    { t: "Kajakkpadler", l: "En padler suser forbi \u2014 fisken sprer seg!", k: "scare", c: "#5ad0ff", s: "kayak" },
    { t: "Gullvasking", l: "Du ser gullglimt i grunna og plukker {n} kr!", k: "money", amt: [50, 120], c: "#ffd877", s: "goldpan" },
    { t: "Fossegrimen", l: "Fossegrimen spiller fela \u2014 flaksen f\u00f8lger tonene.", k: "luck", luck: 0.45, dur: 20, c: "#b0ffe6", s: "fossegrim" },
  ],
  myra: [
    { t: "Lyktemann", l: "Et bluss svever over myra og lokker fram napp.", k: "luck", luck: 0.4, dur: 16, c: "#aaffd0", s: "wisp" },
    { t: "Sur troll", l: "Trollet brummer \u2014 du kaster det en fisk for husfreden ({n} kr).", k: "loss", amt: [10, 30], c: "#6a8a4a", s: "troll" },
    { t: "Myrgass", l: "En stor boble plopper \u2014 fisken rygger unna!", k: "scare", c: "#9abf6a", s: "bubble" },
    { t: "Gammelt s\u00f8lv", l: "Du roter opp {n} kr i gamle mynter fra mudderet.", k: "money", amt: [30, 80], c: "#cfd6dd", s: "coins" },
  ],
  elgtjern: [
    { t: "Frekk elg", l: "Elgen vasser uti og slubrer i seg agnet ditt!", k: "scare", c: "#7a5a3a", s: "moose" },
    { t: "Piknikfamilie", l: "En familie deler vafler med deg \u2014 herlig hum\u00f8r!", k: "luck", luck: 0.3, dur: 18, c: "#ffd877", s: "picnic" },
    { t: "Bever", l: "En bever smeller halen i vannet \u2014 pladask!", k: "scare", c: "#6a4a2a", s: "beaver" },
    { t: "Fint s\u00f8kke", l: "Du finner et eksklusivt sluk verdt {n} kr.", k: "money", amt: [40, 100], c: "#caa23a", s: "lure" },
  ],
  nordlys: [
    { t: "Stjerne\u00f8nske", l: "Et stjerneskudd! Du \u00f8nsker deg storfisk \u2014 flaksen flammer!", k: "luck", luck: 0.6, dur: 22, c: "#b0ffe6", s: "wish" },
    { t: "Nordlyset blusser", l: "Himmelen flammer gr\u00f8nt \u2014 fisken biter ivrig!", k: "luck", luck: 0.45, dur: 20, c: "#8affc0", s: "auroraflare" },
    { t: "Fiskenisse", l: "En liten nisse legger igjen {n} kr p\u00e5 isen til deg.", k: "money", amt: [60, 140], c: "#ffd877", s: "gnome" },
    { t: "Polarkulde", l: "Bitende kulde \u2014 fisken blir doven og sky.", k: "scare", c: "#cfe6ff", s: "frost" },
  ],
};
function triggerGameEvent() {
  const list = LOCATION_EVENTS[save.location];
  if (!list || !list.length) return;
  const ev = list[Math.floor(Math.random() * list.length)];
  let line = ev.l;
  if (ev.amt) {
    const amount = Math.round(ev.amt[0] + Math.random() * (ev.amt[1] - ev.amt[0]));
    if (ev.k === "money") { save.money += amount; persist(); refreshHUD(); sfxCoin(); line = line.replace("{n}", fmt(amount)); }
    else if (ev.k === "loss") { const loss = Math.min(amount, save.money); save.money -= loss; persist(); refreshHUD(); sfxMiss(); line = line.replace("{n}", fmt(loss)); }
  } else if (ev.k === "luck") {
    applyBuff(ev.t, ev.luck, 0, ev.dur, ev.c); blip(660, 0.1, "sine", 0.05);
  } else if (ev.k === "scare") {
    if (fishState === "waiting" || fishState === "bite") { setFish("waiting"); biteTimer = 5 + Math.random() * 7; addRipple(bobber.x, bobber.y, 20); setHint("Fisken ble skremt \u2014 vent litt..."); }
    sfxMiss();
  } else {
    blip(440, 0.06, "triangle", 0.04);
  }
  // the visual actor crosses left↔right or appears for the whole banner duration
  const dir = Math.random() < 0.5 ? 1 : -1;
  gameEvent = { active: true, t: 0, dur: 7, title: ev.t, line, color: ev.c, sprite: ev.s, dir, seed: Math.random() * 6.28 };
}

/* ---- kiosk (alcohol / snus / cigars) ---- */
const KIOSK_GOODS = {
  beer: { name: "Trygdepatron", per: 6, cost: 36, blurb: "Sekspakning på billigtilbud — lite napp, kort flaks (~22 s). Drikk flere for stablet rus!", color: "#caa23a" },
  snus: { name: "Snus", per: 20, cost: 50, blurb: "Boks med 20 prilla under leppa — litt flaks, kort tid (~18 s).", color: "#3a7a3a" },
  cigar: { name: "Sigarillo", per: 12, cost: 80, blurb: "Pakke med 12 — røykpause med roligere hånd, god flaks (~30 s).", color: "#7a5a2a" },
  akevitt: { name: "Blænnvin", per: 1, cost: 110, blurb: "Hjemmekjært brennevin! Stor flaks, lang tid (~45 s) — men du vingler.", color: "#caa84a" },
  snabel: { name: "Snabelstoff", per: 1, cost: 250, blurb: "Hjemmebrentdunk på topphylla! Vill flaks, lengst tid (~60 s) — du sjangler skikkelig.", color: "#d8d2c0" },
};
function buyConsumable(kind) {
  const g = KIOSK_GOODS[kind]; if (!g) return;
  if (save.money < g.cost) { speak("kioskSpeech", "Tomme lommer? Kom igjen med kontanter, kompis."); sfxMiss(); return; }
  save.money -= g.cost; save.stock[kind] = (save.stock[kind] || 0) + g.per; persist();
  sfxCoin(); sfxKiosk();
  speak("kioskSpeech", `Vær så god — ${g.per}× ${g.name}. Skitt fiske! 🎣`);
  buildKiosk(); refreshHUD();
}
function buildKiosk() {
  const list = $("kioskList"); if (!list) return;
  list.innerHTML = "";
  for (const key in KIOSK_GOODS) {
    const g = KIOSK_GOODS[key];
    const have = save.stock[key] || 0;
    const afford = save.money >= g.cost;
    const row = document.createElement("div");
    row.className = "rod-row" + (afford ? "" : " locked");
    row.innerHTML = `<span class="grow"><b>${g.name}</b> <small>(${g.per} stk)</small><br><small>${g.blurb}</small><br><small>Har: ${have}</small></span>` +
      `<button class="buy-btn" data-action="buyConsumable" data-kind="${key}" ${afford ? "" : "disabled"}>${fmt(g.cost)} kr</button>`;
    list.appendChild(row);
  }
}

/* ---- casino (rouletten — rød, svart eller grønn 0) ---- */
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
function rouletteColor(n) { return n === 0 ? "green" : (RED_NUMBERS.has(n) ? "red" : "black"); }
// real European wheel pocket order (0 first) — used so the ball lands on the right colour
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const CASINO_BETS = [50, 100, 250, 500];
// payout multiplier on a winning bet (total returned = stake × payout). Green is a long shot.
const CASINO_PAYOUT = { red: 2, black: 2, green: 14 };
let casino = { color: "red", bet: 100, spinning: false, t: 0, dur: 3.4, result: 0, angle: -Math.PI / 2 - 0.5 / 37 * Math.PI * 2, startAngle: 0, targetAngle: 0, win: false };
function casinoColor(c) { if (casino.spinning) return; casino.color = c; sfxClink(); buildCasino(); }
function casinoBet(amt) { if (casino.spinning) return; casino.bet = parseInt(amt, 10); sfxClink(); buildCasino(); }
function casinoSpin() {
  if (casino.spinning) return;
  if (save.money < casino.bet) { speak("casinoSpeech", "No cash, no spin, my friend. Come back with some green."); sfxMiss(); return; }
  save.money -= casino.bet; persist(); refreshHUD();
  casino.spinning = true; casino.t = 0; casino.result = Math.floor(Math.random() * 37); casino.win = false;
  // spin the wheel so the winning pocket comes to rest under the top pointer
  const ri = WHEEL_ORDER.indexOf(casino.result);
  const pocketCenter = (ri + 0.5) / 37 * Math.PI * 2;       // angle of that pocket in the wheel
  const want = -Math.PI / 2 - pocketCenter;                 // bring it to the top (−90°)
  casino.startAngle = casino.angle;
  let delta = (want - casino.angle) % (Math.PI * 2); if (delta < 0) delta += Math.PI * 2;
  casino.targetAngle = casino.angle + Math.PI * 2 * 5 + delta; // 5 full turns then settle
  casinoSpinNode = playSample("casinoSpin", { vol: 0.6 });
  speak("casinoSpeech", "Round and round she goes… hold on tight now!");
  const r = $("casinoResult"); if (r) { r.textContent = ""; r.className = "casino-result"; }
  buildCasino();
}
function settleRoulette() {
  casino.spinning = false;
  casino.angle = casino.targetAngle;
  if (casinoSpinNode) { stopSample(casinoSpinNode); casinoSpinNode = null; }
  const col = rouletteColor(casino.result);
  casino.win = col === casino.color;
  const colName = col === "red" ? "rød" : col === "black" ? "svart" : "grønn";
  if (casino.win) {
    const payout = CASINO_PAYOUT[col] || 2;
    save.money += casino.bet * payout; persist(); sfxCoin();
    const bonus = col === "green" ? " GRØNN JACKPOT! 🍀" : "";
    speak("casinoSpeech", `${casino.result} ${colName} — winner winner!${bonus} Well played, brother. 🎉`);
    const r = $("casinoResult");
    if (r) { r.textContent = `+${fmt(casino.bet * payout)} kr`; r.className = "casino-result win"; }
  } else {
    sfxMiss();
    speak("casinoSpeech", `${casino.result} ${colName} — not your colour this time. Chin up, friend!`);
    const r = $("casinoResult");
    if (r) { r.textContent = `−${fmt(casino.bet)} kr`; r.className = "casino-result lose"; }
  }
  refreshHUD(); buildCasino();
}
function buildCasino() {
  document.querySelectorAll("#shopCasino .cas-col").forEach((b) => b.classList.toggle("active", b.dataset.color === casino.color));
  document.querySelectorAll("#shopCasino .cas-bet").forEach((b) => b.classList.toggle("active", parseInt(b.dataset.amt, 10) === casino.bet));
  const spin = $("casinoSpin");
  if (spin) { spin.disabled = casino.spinning || save.money < casino.bet; spin.textContent = casino.spinning ? "Spinner…" : `Spinn ${fmt(casino.bet)} kr`; }
}

/* =========================================================================
   Build DOM lists
   ========================================================================= */
function buildBasket() {
  const list = $("basketList"); if (!list) return;
  list.innerHTML = "";
  if (!save.basket.length) {
    list.innerHTML = '<div class="empty-note">Kurven er tom.</div>';
  } else {
    // group by species
    const groups = {};
    for (const b of save.basket) {
      const gkey = b.key;
      groups[gkey] = groups[gkey] || { count: 0, value: 0, best: 0 };
      groups[gkey].count++; groups[gkey].value += b.value;
      groups[gkey].best = Math.max(groups[gkey].best, b.weight);
    }
    for (const key in groups) {
      const f = FISH_BY_KEY[key]; const g = groups[key];
      const row = document.createElement("div"); row.className = "basket-row";
      row.innerHTML = `<img src="${fishSpriteURL(f, 2)}" alt=""><span class="grow">${f.name} ×${g.count}<br><small>største ${g.best.toFixed(2)} kg</small></span><button class="mini-sell" data-action="sellSpecies" data-key="${key}">${fmt(g.value)} kr</button>`;
      list.appendChild(row);
    }
  }
  $("basketTotal").textContent = fmt(save.basket.reduce((s, b) => s + b.value, 0));
  $("sellAllBtn").disabled = !save.basket.length;
}

let rodGrumpyBuy = null, rodHop = 0;
function buildRods() {
  const list = $("rodList"); if (!list) return;
  list.innerHTML = "";
  RODS.forEach((r, i) => {
    const owned = save.owned.includes(i);
    const equipped = i === save.rodLevel;
    const row = document.createElement("div");
    row.className = "rod-row" + (owned ? " owned" : "") + (equipped ? " equipped" : "");
    const stats = `Innhaling +${Math.round((r.reel - 1) * 100)}% · Tåler ${Math.round((1 - r.tens) * 100)}% mer drag · Sjeldne fisk +${Math.round(r.rare * 100)}%`;
    let btn;
    if (equipped) btn = `<button class="buy-btn" disabled>I bruk</button>`;
    else if (owned) btn = `<button class="buy-btn" data-action="equipRod" data-level="${i}">Bruk</button>`;
    else btn = `<button class="buy-btn" data-action="buyRod" data-level="${i}" ${save.money < r.cost ? "disabled" : ""}>${fmt(r.cost)} kr</button>`;
    row.innerHTML = `<img class="rod-pic" src="${rodSpriteURL(r)}" alt=""><div class="rod-info"><div class="rod-title">${r.name}</div><div class="rod-stats">${stats}</div></div>${btn}`;
    list.appendChild(row);
  });
  // fiskekort (fishing licence) — keeps the inspector off your back
  const lic = save.license || 0;
  const licRow = document.createElement("div");
  licRow.className = "rod-row" + (save.money < LICENSE_COST ? " locked" : "");
  const licStatus = lic > 0 ? `Gyldig — dekker ${lic} fangster til` : "Du mangler fiskekort!";
  licRow.innerHTML = `<div class="rod-info"><div class="rod-title">🎫 Fiskekort</div><div class="rod-stats">${licStatus} · slipp bot fra fiskeoppsynet</div></div><button class="buy-btn" data-action="buyLicense" ${save.money < LICENSE_COST ? "disabled" : ""}>${fmt(LICENSE_COST)} kr</button>`;
  list.appendChild(licRow);
}

/* =========================================================================
   Update
   ========================================================================= */
function update(dt) {
  t += dt; stateTime += dt;

  // ambient everywhere
  for (const r of ripples) { r.r += dt * 18; r.life -= dt * 1.3; }
  for (let i = ripples.length - 1; i >= 0; i--) if (ripples[i].life <= 0) ripples.splice(i, 1);
  for (const ff of fireflies) {
    ff.ph += dt * ff.sp * 2; ff.drift += dt * 0.5;
    ff.x += Math.cos(ff.drift) * dt * 6; ff.y += Math.sin(ff.drift * 0.7) * dt * 4;
    if (ff.x < -5) ff.x = W + 5; if (ff.x > W + 5) ff.x = -5;
    if (ff.y < 35) ff.y = 35; if (ff.y > 150) ff.y = 150;
  }
  radioTick(dt);

  // opening cinematic
  if (screen === "intro") {
    if (intro.running) {
      intro.t += dt;
      if (!intro.rodSfx && intro.t >= IN.throwS) { intro.rodSfx = true; sfxThrow(); }
      if (!intro.enginePlayed && intro.t >= IN.engine) { intro.enginePlayed = true; startEngine(); }
      if (intro.t >= IN.end) endIntro();
    }
    return;
  }

  // travel animation runs independently of the fishing world
  if (screen === "travel") {
    travel.t += dt;
    if (travel.t >= travel.dur) {
      stopEngine();
      if (travel.key === "market") { resetFishing(); setScreen("market"); }
      else { setLocation(travel.key); resetFishing(); setScreen("game"); }
    }
    return;
  }

  // crickets + wolf (only on outdoor screens)
  if (screen === "game" || screen === "menu") {
    cricketTimer -= dt;
    if (cricketTimer <= 0) { cricketTimer = 0.6 + Math.random() * 1.4; if (Math.random() < 0.7) cricketChirp(); }
    updateCat(dt);
    // the cat sometimes sneaks in to nick your smallest fish — tap it to shoo it off
    if (screen === "game" && cat.state === "away" && cat.mission == null) {
      catStealTimer -= dt;
      if (catStealTimer <= 0) {
        catStealTimer = 85 + Math.random() * 120;
        if (save.basket.length > 0 && !inspector.active && !gameEvent.active && fishState !== "reveal") startCatSteal();
      }
    }
    wolfTimer -= dt;
    if (wolfTimer <= 0) { wolfTimer = 45 + Math.random() * 70; playSample("howl", { vol: 0.4 }); }
    // goofy ambient critters, themed per location
    frogTimer -= dt;
    if (frogTimer <= 0) { frogTimer = 4 + Math.random() * 7; if (LOC.spooky || Math.random() < 0.5) frogCroak(); }
    owlTimer -= dt;
    if (owlTimer <= 0) { owlTimer = 12 + Math.random() * 16; if (LOC.spooky) frogCroak(); else if (LOC.moon) owlHoot(); else plopRandom(); }
    // Trollmyra: glowing eyes appear in the treeline + a distant groan
    if (LOC.eyes) {
      eyeTimer -= dt;
      if (eyeTimer <= 0) {
        if (eyeShown) { eyeShown = false; eyeTimer = 5 + Math.random() * 9; }
        else { eyeShown = true; eyeTimer = 3 + Math.random() * 4; eyeX = 30 + Math.random() * (W - 90); eyeY = 104 + Math.random() * 22; eyeBlink = 0; if (Math.random() < 0.6) trollGroan(); }
      }
      if (eyeShown) { eyeBlink += dt; if (eyeBlink > 0.16) eyeBlink = (Math.random() < 0.012) ? 0 : 0.13; }
    } else if (eyeShown) { eyeShown = false; }
    // Elgtjernet: a silly moose wanders in from the right now and then
    if (LOC.moose) {
      moose.blink += dt; if (moose.blink > 0.16) moose.blink = (Math.random() < 0.02) ? 0 : 0.14;
      if (moose.state === "away") {
        moose.timer -= dt;
        if (moose.timer <= 0) { moose.state = "walkin"; moose.x = W + 30; moose.ph = 0; moose.called = false; }
      } else if (moose.state === "walkin") {
        moose.x -= dt * 22; moose.ph += dt * 6;
        if (moose.x <= W - 78) { moose.x = W - 78; moose.state = "look"; moose.timer = 3 + Math.random() * 3.5; if (!moose.called) { mooseCall(); moose.called = true; } }
      } else if (moose.state === "look") {
        moose.timer -= dt;
        if (Math.random() < 0.004) mooseCall();
        if (moose.timer <= 0) moose.state = "walkout";
      } else if (moose.state === "walkout") {
        moose.x += dt * 26; moose.ph += dt * 6;
        if (moose.x > W + 30) { moose.state = "away"; moose.timer = 11 + Math.random() * 16; }
      }
    } else if (moose.state !== "away") { moose.state = "away"; moose.timer = 8 + Math.random() * 10; }
    // Nordlysvatnet: a shooting star streaks across the sky every so often
    if (LOC.aurora) {
      if (shootStar.on) {
        shootStar.x += shootStar.vx * dt; shootStar.y += shootStar.vy * dt; shootStar.life -= dt;
        if (shootStar.life <= 0 || shootStar.x > W + 40 || shootStar.y > 110) shootStar.on = false;
      } else {
        shootStar.timer -= dt;
        if (shootStar.timer <= 0) {
          shootStar.on = true; shootStar.life = 0.7 + Math.random() * 0.5;
          shootStar.x = 20 + Math.random() * (W * 0.5); shootStar.y = 8 + Math.random() * 34;
          const sp = 150 + Math.random() * 90; shootStar.vx = sp; shootStar.vy = sp * (0.4 + Math.random() * 0.35);
          shootStar.timer = 6 + Math.random() * 11;
        }
      }
    } else if (shootStar.on) { shootStar.on = false; }
  }
  // fiskeoppsynet — a rare inspector who checks your fishing licence
  if (screen === "game") {
    if (inspector.active) {
      inspector.t += dt;
      if (inspector.phase === "in") {
        inspector.x = lerp(inspector.x, 64, dt * 3);
        if (inspector.t > 1.5) { inspector.phase = "check"; resolveInspector(); }
      } else if (inspector.phase === "check") {
        if (inspector.t > 5) inspector.phase = "out";
      } else {
        inspector.x -= dt * 45;
        if (inspector.x < -22) inspector.active = false;
      }
    } else if (fishState === "ready" && !coolerMenu && !truckMenu && !rodPanel && !bagPanel && !recordsPanel && !godsakerPanel) {
      inspectorTimer -= dt;
      if (inspectorTimer <= 0) {
        inspectorTimer = 130 + Math.random() * 160;
        if (save.money > LICENSE_FINE) triggerInspector();
      }
    }
    // per-location random happenings (can fire while you fish; not during the inspector or menus)
    if (gameEvent.active) { gameEvent.t += dt; if (gameEvent.t > gameEvent.dur) gameEvent.active = false; }
    if (!gameEvent.active && !inspector.active && !coolerMenu && !truckMenu && !rodPanel && !bagPanel && !recordsPanel && !godsakerPanel) {
      eventTimer -= dt;
      if (eventTimer <= 0) { eventTimer = 50 + Math.random() * 70; triggerGameEvent(); }
    }
  }
  // chatty shopkeepers make idle noises
  if (screen === "shopFish") { ladyIdleTimer -= dt; if (ladyIdleTimer <= 0) { ladyIdleTimer = 4 + Math.random() * 5; sfxLady(); } }
  if (screen === "shopRod") { rodIdleTimer -= dt; if (rodIdleTimer <= 0) { rodIdleTimer = 4.5 + Math.random() * 4; playSample("grumpyVoice", { vol: 0.5 }); } }
  if (screen === "shopKiosk") { kioskIdleTimer -= dt; if (kioskIdleTimer <= 0) { kioskIdleTimer = 5 + Math.random() * 5; sfxKiosk(); } }
  // market passers-by stroll the street
  if (screen === "market") {
    for (const n of marketNPCs) {
      if (n.pause > 0) { n.pause -= dt; continue; }
      n.x += n.dir * n.sp * dt; n.ph += dt * 8;
      if (n.x < 10) { n.x = 10; n.dir = 1; if (Math.random() < 0.5) n.pause = 0.5 + Math.random(); }
      else if (n.x > W - 10) { n.x = W - 10; n.dir = -1; if (Math.random() < 0.5) n.pause = 0.5 + Math.random(); }
      else if (Math.random() < dt * 0.25) n.dir *= -1;
    }
  }
  if (screen === "shopCasino" && casino.spinning) {
    casino.t += dt;
    const frac = clamp(casino.t / casino.dur, 0, 1);
    // ease-out: wheel decelerates smoothly to the exact pocket so the ball lands on the result
    const ease = 1 - Math.pow(1 - frac, 3);
    casino.angle = casino.startAngle + (casino.targetAngle - casino.startAngle) * ease;
    if (casino.t >= casino.dur) settleRoulette();
  }
  if (rodHop > 0) rodHop = Math.max(0, rodHop - dt * 2.2);

  // thrown cans physics
  for (const c of cans) {
    c.vy += 320 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += dt * 8; c.life -= dt;
    if (c.y > 138) { c.y = 138; c.vy *= -0.35; c.vx *= 0.6; }
  }
  for (let i = cans.length - 1; i >= 0; i--) if (cans[i].life <= 0) cans.splice(i, 1);

  // beer drinking sequence
  if (drinking > 0) {
    drinking -= dt;
    if (drinking <= 0.3 && !drinkThrown) { if (drinkKind === "beer") throwCan(); drinkThrown = true; }
    if (drinking <= 0) drinkThrown = false;
  }
  // buffs + vices
  if (buff.t > 0) buff.t -= dt;
  if (buffFlash > 0) buffFlash -= dt;
  if (drunk > 0) drunk = Math.max(0, drunk - dt * 0.02);
  if (snusing > 0) snusing -= dt;
  if (smoking > 0) {
    smoking -= dt;
    if (Math.random() < dt * 12) smoke.push({ x: 80 + Math.random() * 2, y: 95, vx: 5 + Math.random() * 7, vy: -12 - Math.random() * 8, life: 1.5, size: 1 + Math.random() * 1.5 });
  }
  for (const s of smoke) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy *= 0.97; s.life -= dt * 0.7; s.size += dt * 2.5; }
  for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].life <= 0) smoke.splice(i, 1);
  // idle sips (visual only) when relaxed and not in a drink sequence
  sipAnim = Math.max(0, sipAnim - dt);
  if (screen === "game" && drinking <= 0 && (fishState === "ready" || fishState === "waiting")) {
    sipTimer -= dt;
    if (sipTimer <= 0) { sipTimer = 8 + Math.random() * 8; sipAnim = 1.2; sfxGulp(); }
  }

  if (screen !== "game") return; // fishing logic only on water

  switch (fishState) {
    case "ready":
      bobber.x = castTarget.x; bobber.y = castTarget.y;
      break;
    case "casting":
      castProgress = Math.min(1, stateTime / 0.55);
      if (castProgress >= 1) beginWaiting();
      break;
    case "waiting": {
      bobber.y = castTarget.y + Math.sin(t * 1.6) * 1.2;
      nibbleTimer -= dt; nibbleShake = Math.max(0, nibbleShake - dt * 4);
      if (nibbleTimer <= 0) { nibbleTimer = 1.5 + Math.random() * 3; nibbleShake = 1; addRipple(bobber.x, bobber.y, 9); blip(420, 0.05, "sine", 0.06); }
      bobber.y += Math.sin(t * 22) * nibbleShake * 1.4;
      biteTimer -= dt; if (biteTimer <= 0) triggerBite();
      break;
    }
    case "bite":
      bobber.sink = Math.min(10, bobber.sink + dt * 60);
      bobber.y = castTarget.y + bobber.sink;
      if (Math.random() < dt * 8) addRipple(bobber.x, bobber.y - bobber.sink, 10);
      biteWindow -= dt; if (biteWindow <= 0) setMiss("Den slapp…");
      break;
    case "hooked": {
      const r = rod();
      pullTimer -= dt;
      if (pulling > 0) pulling -= dt;
      else if (pullTimer <= 0) { pulling = 0.4 + Math.random() * 0.6; pullTimer = 0.8 + Math.random() * 1.2; }
      const fishPull = currentFish.junk ? 0.5 : (currentFish.kr >= 90 ? 1.3 : currentFish.shape === "long" ? 1.5 : 1.0);
      // a fish fights harder the bigger it can get — so trophies stay a real battle on any rod,
      // while tiddlers stay easy even on a basic stick (smooths the early/late difficulty curve)
      const fishFight = currentFish.junk ? 0.5 : clamp(0.55 + (currentFish.max || 2) * 0.13, 0.55, 2.4);
      const rb = buff.t > 0 ? buff.reel : 0;
      if (holding) { progress += dt * 22 * r.reel * (1 + rb); tension += dt * 20 * r.tens * fishFight * (1 - rb * 0.4); if (Math.random() < dt * 12) sfxReel(); }
      else { progress -= dt * 5; tension -= dt * 32; }
      if (pulling > 0) tension += dt * 30 * fishFight * fishPull * 0.7 * r.tens;
      progress = clamp(progress, 0, 100); tension = clamp(tension, 0, 100);
      bobber.y = castTarget.y + 6 + Math.sin(t * 18) * (pulling > 0 ? 4 : 1.5);
      bobber.x = castTarget.x + Math.sin(t * 9) * (pulling > 0 ? 3 : 1);
      progressEl.style.width = progress + "%";
      tensionEl.style.width = tension + "%";
      tensionEl.classList.toggle("danger", tension > 75);
      if (progress >= 100) catchFish();
      else if (tension >= 100) setMiss("Lina røk!");
      break;
    }
    case "reveal":
      break;
    case "missed":
      setHint(missReason);
      if (stateTime > 1.6) { setFish("ready"); setHint("Klikk for å kaste ut"); }
      break;
  }
}
let drinkThrown = false;

/* =========================================================================
   Render — scene pieces
   ========================================================================= */
function drawSky() {
  const s = LOC.sky;
  const g = ctx.createLinearGradient(0, 0, 0, WATER_Y);
  g.addColorStop(0.0, s[0]); g.addColorStop(0.45, s[1]);
  g.addColorStop(0.75, s[2]); g.addColorStop(0.92, s[3]); g.addColorStop(1, s[4]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, WATER_Y);
}
function drawStars() {
  for (const s of stars) {
    const tw = 0.5 + 0.5 * Math.sin(t * 1.5 + s.tw);
    const a = (0.3 + s.b * 0.7) * tw * (1 - s.y / 120);
    if (a <= 0) continue;
    ctx.globalAlpha = a; px(s.x, s.y, 1, 1, "#fff7e0");
  }
  ctx.globalAlpha = 1;
  drawShootStar();
}
// a bright streak with a fading tail (only while LOC.aurora and shootStar.on)
function drawShootStar() {
  if (!shootStar.on) return;
  const x = shootStar.x, y = shootStar.y;
  const tx = x - shootStar.vx * 0.05, ty = y - shootStar.vy * 0.05;
  const g = ctx.createLinearGradient(tx, ty, x, y);
  g.addColorStop(0, "rgba(180,230,255,0)"); g.addColorStop(1, "rgba(220,245,255,0.9)");
  ctx.strokeStyle = g; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
  ctx.fillStyle = "#fff"; ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(Math.round(x) - 1, Math.round(y), 1, 1); ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 1);
}
function drawMoon() {
  if (!LOC.moon) return;
  const mx = 396, my = 40;
  const gg = ctx.createRadialGradient(mx, my, 2, mx, my, 34);
  gg.addColorStop(0, "rgba(255,243,210,0.45)"); gg.addColorStop(1, "rgba(255,243,210,0)");
  ctx.fillStyle = gg; ctx.fillRect(mx - 36, my - 36, 72, 72);
  ctx.fillStyle = "#fdf3c8"; ctx.beginPath(); ctx.arc(mx, my, 13, 0, 6.28); ctx.fill();
  ctx.fillStyle = LOC.sky[2]; ctx.beginPath(); ctx.arc(mx + 6, my - 3, 12, 0, 6.28); ctx.fill();
}
function drawTreeline() {
  ctx.fillStyle = LOC.tree;
  let seed = 1; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const caps = [];
  for (let x = -10; x < W + 10; x += 7) { const h = 14 + rnd() * 26; ctx.fillRect(x, WATER_Y - h, 8, h); caps.push([x, WATER_Y - h, h]); }
  for (let x = 0; x < W; x += 26) { const r = 10 + rnd() * 8; ctx.beginPath(); ctx.arc(x, WATER_Y - 24 - rnd() * 12, r, 0, 6.28); ctx.fill(); }
  if (LOC.snow) {
    ctx.fillStyle = "#dfeaf2";
    for (const c of caps) if (c[2] > 26) ctx.fillRect(c[0], c[1], 8, 3);
  }
}
// distant snow-capped mountain range (Fjellvatnet)
function drawMountains() {
  if (!LOC.mountains) return;
  let seed = 5; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  // far range, hazy blue
  ctx.fillStyle = "#2c3e58";
  ctx.beginPath(); ctx.moveTo(0, WATER_Y);
  for (let x = -20; x <= W + 20; x += 60) { const peak = WATER_Y - 46 - rnd() * 30; ctx.lineTo(x, peak); ctx.lineTo(x + 30, WATER_Y - 20 - rnd() * 10); }
  ctx.lineTo(W, WATER_Y); ctx.closePath(); ctx.fill();
  // near range, darker, with snow caps
  seed = 19;
  const peaks = [];
  ctx.fillStyle = "#243a54";
  ctx.beginPath(); ctx.moveTo(0, WATER_Y);
  for (let x = -10; x <= W + 10; x += 86) { const px2 = x + 20, peakY = WATER_Y - 30 - rnd() * 34; ctx.lineTo(px2, peakY); peaks.push([px2, peakY]); ctx.lineTo(x + 60, WATER_Y - 14 - rnd() * 8); }
  ctx.lineTo(W, WATER_Y); ctx.closePath(); ctx.fill();
  // snow caps on the near peaks
  ctx.fillStyle = "#dfeaf2";
  for (const p of peaks) {
    ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] - 9, p[1] + 14); ctx.lineTo(p[0] - 4, p[1] + 11);
    ctx.lineTo(p[0], p[1] + 15); ctx.lineTo(p[0] + 4, p[1] + 11); ctx.lineTo(p[0] + 9, p[1] + 14); ctx.closePath(); ctx.fill();
  }
}
// a stream/waterfall pouring in from the right bank (Stryket)
function drawWaterfall() {
  if (!LOC.waterfall) return;
  const fx = W - 30, topY = WATER_Y - 40;
  // mossy rock ledge the water falls over
  ctx.fillStyle = "#243a26"; ctx.fillRect(fx - 6, topY - 8, 44, 16);
  ctx.fillStyle = "#1a2c1c"; ctx.fillRect(fx - 6, topY + 4, 44, 5);
  // falling water columns
  for (let i = 0; i < 7; i++) {
    const cx = fx + i * 5;
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 6 + i);
    ctx.fillStyle = i % 2 ? "#cfe0e6" : "#aecbd6";
    const len = (WATER_Y - topY) + 6;
    ctx.fillRect(cx, topY, 2, len);
  }
  ctx.globalAlpha = 1;
  // churning foam where it hits the pond
  for (let i = 0; i < 9; i++) {
    const fxx = fx - 2 + i * 4 + Math.sin(t * 5 + i) * 2;
    const fy = WATER_Y + 1 + Math.sin(t * 7 + i * 1.3) * 2;
    ctx.globalAlpha = 0.4 + 0.4 * Math.abs(Math.sin(t * 4 + i));
    ctx.fillStyle = "#eaf3f6"; ctx.fillRect(fxx, fy, 2, 2);
  }
  ctx.globalAlpha = 1;
  // drifting current lines flowing left away from the falls
  ctx.strokeStyle = "rgba(200,225,232,0.25)"; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const yy = WATER_Y + 8 + i * 9, sx = fx - ((t * 40 + i * 30) % 120);
    ctx.beginPath(); ctx.moveTo(sx, yy); ctx.lineTo(sx - 16, yy); ctx.stroke();
  }
}
// two glowing eyes lurking in the dark treeline (Trollmyra)
let eyeBlink = 0, eyeTimer = 4 + Math.random() * 6, eyeX = 60, eyeY = 118, eyeShown = false;
function drawLurkingEyes() {
  if (!LOC.eyes || !eyeShown) return;
  if (eyeBlink > 0.12) return; // eyes "closed" during a blink
  const glow = 0.55 + 0.3 * Math.sin(t * 2.5);
  ctx.globalAlpha = glow * 0.5; ctx.fillStyle = "#d8ff5a";
  ctx.beginPath(); ctx.arc(eyeX, eyeY, 3.5, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.arc(eyeX + 9, eyeY, 3.5, 0, 6.28); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = "#f4ff9a";
  px(eyeX - 1, eyeY - 1, 2, 2, "#f4ff9a"); px(eyeX + 8, eyeY - 1, 2, 2, "#f4ff9a");
  px(eyeX, eyeY, 1, 1, "#1a1a0a"); px(eyeX + 9, eyeY, 1, 1, "#1a1a0a");
}
// cozy forest-tarn touches: lily pads on the water + drifting autumn leaves (Skogstjernet)
const LILY_PADS = [
  { x: 70, y: 196, r: 9, flower: true }, { x: 96, y: 188, r: 6, flower: false },
  { x: 408, y: 192, r: 8, flower: false }, { x: 388, y: 204, r: 7, flower: true },
  { x: 250, y: 210, r: 7, flower: false },
];
const LEAVES = Array.from({ length: 7 }, () => ({ x: Math.random() * W, y: WATER_Y + 8 + Math.random() * 80, sp: 4 + Math.random() * 6, ph: Math.random() * 6.28, c: ["#c2772f", "#a85a2a", "#b89a3a", "#8a4a26"][Math.floor(Math.random() * 4)] }));
function drawForestDetails() {
  if (!LOC.forest) return;
  // lily pads floating on the surface
  for (const p of LILY_PADS) {
    const wob = Math.sin(t * 1.3 + p.x) * 1;
    ctx.fillStyle = "#2f5a2e"; ctx.beginPath(); ctx.ellipse(p.x, p.y + wob, p.r, p.r * 0.55, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#3f7a3a"; ctx.beginPath(); ctx.ellipse(p.x - 1, p.y - 1 + wob, p.r * 0.7, p.r * 0.4, 0, 0, 6.28); ctx.fill();
    // little notch
    ctx.fillStyle = LOC.water[1]; ctx.fillRect(p.x + p.r - 2, p.y - 1 + wob, 3, 2);
    if (p.flower) { px(p.x - 1, p.y - 2 + wob, 2, 2, "#f0c0d0"); px(p.x, p.y - 3 + wob, 1, 1, "#ffe6a0"); }
  }
  // drifting leaves on the water
  for (const lf of LEAVES) {
    lf.x -= lf.sp * 0.016; lf.ph += 0.02;
    if (lf.x < -6) { lf.x = W + 6; lf.y = WATER_Y + 8 + Math.random() * 80; }
    const yy = lf.y + Math.sin(lf.ph) * 1.5;
    ctx.globalAlpha = 0.85; px(Math.round(lf.x), Math.round(yy), 3, 2, lf.c);
    px(Math.round(lf.x) + 1, Math.round(yy) - 1, 1, 1, shade(lf.c, 20));
    ctx.globalAlpha = 1;
  }
}
// Elgtjernet — a lush, sunny summer tarn: a little red cabin with a jetty, blooming
// water lilies, bulrushes and dragonflies darting over the water (distinct from the others)
const WATER_LILIES = [
  { x: 150, y: 198, r: 8 }, { x: 200, y: 212, r: 7 }, { x: 300, y: 200, r: 9 }, { x: 360, y: 216, r: 7 },
];
const dragonflies = Array.from({ length: 3 }, (_, i) => ({ x: 200 + i * 60, y: WATER_Y + 18 + i * 10, ph: Math.random() * 6.28, sp: 0.7 + Math.random() * 0.5, col: ["#5ad0ff", "#8affc0", "#caa0ff"][i % 3] }));
function drawSummerDetails() {
  if (!LOC.summer) return;
  // a small wooden jetty poking into the water (kept clear of the moose's spot on the right bank)
  const jx = 332, jy = 132;
  px(jx + 2, jy + 14, 4, 22, "#5a4026"); px(jx - 14, jy + 26, 22, 4, "#6b4a2c"); px(jx - 14, jy + 26, 22, 1, "#7d5736");
  px(jx - 12, jy + 30, 2, 8, "#3e2a18"); px(jx + 4, jy + 30, 2, 8, "#3e2a18"); // posts
  // bulrushes / cattails along the right bank
  ctx.strokeStyle = "#2c4a22"; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const rx = 392 + i * 9, h = 26 + (i % 3) * 6, sway = Math.sin(t * 0.9 + i) * 3;
    ctx.beginPath(); ctx.moveTo(rx, WATER_Y + 18); ctx.lineTo(rx + sway, WATER_Y + 18 - h); ctx.stroke();
    px(rx + sway - 1, WATER_Y + 18 - h - 6, 3, 7, "#6a4326"); // brown cattail head
    px(rx + sway, WATER_Y + 18 - h - 9, 1, 3, "#3a2a18");     // tip spike
  }
  // blooming water lilies (pink flowers — brighter & summery vs forest's plain pads)
  for (const p of WATER_LILIES) {
    const wob = Math.sin(t * 1.2 + p.x) * 1;
    ctx.fillStyle = "#2f6a34"; ctx.beginPath(); ctx.ellipse(p.x, p.y + wob, p.r, p.r * 0.55, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#46913f"; ctx.beginPath(); ctx.ellipse(p.x - 1, p.y - 1 + wob, p.r * 0.7, p.r * 0.4, 0, 0, 6.28); ctx.fill();
    ctx.fillStyle = LOC.water[1]; ctx.fillRect(p.x + p.r - 2, p.y - 1 + wob, 3, 2);
    // pink bloom
    px(p.x - 2, p.y - 3 + wob, 5, 2, "#f2a8c8"); px(p.x - 1, p.y - 4 + wob, 3, 1, "#ffd0e2");
    px(p.x, p.y - 3 + wob, 1, 2, "#ffe6a0");
  }
  // dragonflies darting just above the surface
  for (const d of dragonflies) {
    d.ph += 0.05 * d.sp;
    const dx = d.x + Math.cos(d.ph) * 34, dy = d.y + Math.sin(d.ph * 1.7) * 7;
    const flap = Math.sin(t * 30) > 0 ? 1 : 0;
    px(Math.round(dx), Math.round(dy), 4, 1, d.col);             // body
    px(Math.round(dx) + 4, Math.round(dy), 1, 1, shade(d.col, 30));
    ctx.globalAlpha = 0.55;
    px(Math.round(dx) + 1, Math.round(dy) - 1 - flap, 2, 1, "#dff3ff"); // upper wings
    px(Math.round(dx) + 1, Math.round(dy) + 1 + flap, 2, 1, "#dff3ff"); // lower wings
    ctx.globalAlpha = 1;
  }
}
// shimmering northern lights across the arctic sky (Nordlysvatnet)
function drawAurora() {
  if (!LOC.aurora) return;
  const bands = [
    { y: 40, amp: 16, col: "120,255,180", spd: 0.5, h: 26 },
    { y: 58, amp: 22, col: "150,120,255", spd: 0.32, h: 22 },
    { y: 30, amp: 12, col: "120,220,255", spd: 0.7, h: 18 },
  ];
  for (const b of bands) {
    for (let x = 0; x <= W; x += 6) {
      const wave = Math.sin(x * 0.025 + t * b.spd) * b.amp + Math.sin(x * 0.07 - t * b.spd * 1.5) * (b.amp * 0.4);
      const top = b.y + wave;
      const flick = 0.10 + 0.06 * Math.sin(t * 1.7 + x * 0.05);
      const g = ctx.createLinearGradient(0, top, 0, top + b.h);
      g.addColorStop(0, `rgba(${b.col},0)`);
      g.addColorStop(0.5, `rgba(${b.col},${flick})`);
      g.addColorStop(1, `rgba(${b.col},0)`);
      ctx.fillStyle = g; ctx.fillRect(x, top, 7, b.h);
    }
  }
}
// a silly moose that wanders in from the right, has a look around, and ambles off (Elgtjernet)
let moose = { state: "away", timer: 6 + Math.random() * 8, x: W + 30, ph: 0, blink: 0, called: false };
function drawMoose() {
  if (!LOC.moose || moose.state === "away") return;
  const baseY = WATER_Y - 6;        // standing on the right bank at the waterline
  const x = Math.round(moose.x), y = Math.round(baseY);
  const bob = (moose.state === "walkin" || moose.state === "walkout") ? Math.abs(Math.sin(moose.ph)) * 1.5 : Math.sin(t * 1.2) * 0.6;
  const yy = y - bob;
  const stride = (moose.state === "walkin" || moose.state === "walkout") ? Math.sin(moose.ph) * 2.5 : 0;
  // shadow
  ctx.globalAlpha = 0.25; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(x, baseY + 14, 18, 3, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
  const fur = "#4a3320", furD = "#3a2718", muzzle = "#2a1d12";
  // legs (front + back, alternating)
  px(x - 11, yy - 2, 4, 16 + stride, furD); px(x + 7, yy - 2, 4, 16 - stride, furD);
  px(x - 5, yy - 2, 4, 16 - stride, fur); px(x + 1, yy - 2, 4, 16 + stride, fur);
  // big barrel body
  px(x - 13, yy - 20, 26, 16, fur); px(x - 13, yy - 20, 26, 3, shade(fur, 14));
  px(x - 13, yy - 7, 26, 3, furD);
  // hump over shoulders
  px(x + 4, yy - 24, 10, 6, fur);
  // neck + head reaching to the right
  px(x + 10, yy - 22, 7, 10, fur);
  px(x + 14, yy - 26, 11, 9, fur);              // head
  px(x + 23, yy - 22, 7, 6, muzzle);            // long droopy muzzle
  px(x + 24, yy - 20, 2, 2, "#100a06");         // nostril
  // floppy ear
  px(x + 11, yy - 28, 4, 4, furD);
  // googly eye (the silly bit) — blinks now and then
  if (moose.blink <= 0.1) { px(x + 17, yy - 24, 3, 3, "#fff"); px(x + 18, yy - 23, 1, 1, "#100a06"); }
  else px(x + 17, yy - 23, 3, 1, "#100a06");
  // oversized goofy antlers
  ctx.strokeStyle = "#caa86a"; ctx.lineWidth = 2; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 18, yy - 28); ctx.lineTo(x + 14, yy - 36); ctx.moveTo(x + 14, yy - 36); ctx.lineTo(x + 8, yy - 36);
  ctx.moveTo(x + 14, yy - 36); ctx.lineTo(x + 12, yy - 41); ctx.moveTo(x + 14, yy - 36); ctx.lineTo(x + 18, yy - 40);
  ctx.moveTo(x + 22, yy - 27); ctx.lineTo(x + 26, yy - 35); ctx.moveTo(x + 26, yy - 35); ctx.lineTo(x + 31, yy - 35);
  ctx.moveTo(x + 26, yy - 35); ctx.lineTo(x + 28, yy - 40); ctx.moveTo(x + 26, yy - 35); ctx.lineTo(x + 23, yy - 40);
  ctx.stroke(); ctx.lineWidth = 1; ctx.lineCap = "butt";
}
function drawWater() {
  const wc = LOC.water;
  const g = ctx.createLinearGradient(0, WATER_Y, 0, H);
  g.addColorStop(0, wc[0]); g.addColorStop(0.25, wc[1]); g.addColorStop(1, wc[2]);
  ctx.fillStyle = g; ctx.fillRect(0, WATER_Y, W, H - WATER_Y);
  for (let i = 0; i < 16; i++) {
    const y = WATER_Y + 6 + i * 7, off = Math.sin(t * 0.8 + i * 0.9) * 6;
    ctx.globalAlpha = 0.06 + (i / 16) * 0.05; ctx.fillStyle = "#9fb6ff"; ctx.fillRect(0, y, W, 1);
    ctx.globalAlpha = 0.05; ctx.fillRect(off, y + 2, W, 1);
  }
  ctx.globalAlpha = 1;
  for (const r of ripples) {
    ctx.globalAlpha = Math.max(0, r.life) * 0.5; ctx.strokeStyle = "#b9c8ff"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r, r.r * 0.4, 0, 0, 6.28); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function drawReflections() {
  if (LOC.moon) {
    ctx.globalAlpha = 0.18; ctx.fillStyle = "#fdf3c8";
    for (let i = 0; i < 10; i++) { const y = WATER_Y + 6 + i * 5, w = 10 - i * 0.6 + Math.sin(t * 2 + i) * 3; ctx.fillRect(396 - w / 2, y, Math.max(2, w), 1); }
  }
  ctx.globalAlpha = 0.1; ctx.fillStyle = LOC.sky[4]; ctx.fillRect(0, WATER_Y, W, 10);
  ctx.globalAlpha = 0.18; ctx.fillStyle = "#0c1330";
  drawFishShadow((t * 14) % (W + 80) - 40, 210, 1);
  drawFishShadow(W + 60 - (t * 10) % (W + 80), 240, -1);
  ctx.globalAlpha = 1;
}
function drawFog() {
  if (!LOC.fog) return;
  const spooky = LOC.spooky;
  for (let i = 0; i < 4; i++) {
    const y = WATER_Y - 16 + i * 12;
    const off = Math.sin(t * 0.3 + i * 1.7) * 30;
    ctx.globalAlpha = LOC.fog * (0.5 + 0.2 * Math.sin(t * 0.4 + i));
    ctx.fillStyle = spooky ? "#9fc0a0" : "#cdd8e6";
    ctx.beginPath(); ctx.ellipse(W / 2 + off, y, 200, 10, 0, 0, 6.28); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawFishShadow(x, y, dir) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 3, 0, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-15, -3 + Math.sin(t * 6) * 2); ctx.lineTo(-15, 3 + Math.sin(t * 6) * 2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawShore() {
  ctx.fillStyle = "#1e3326";
  ctx.beginPath(); ctx.moveTo(0, WATER_Y - 6); ctx.lineTo(0, H); ctx.lineTo(132, H);
  ctx.quadraticCurveTo(150, WATER_Y + 8, 96, WATER_Y - 4); ctx.quadraticCurveTo(40, WATER_Y - 14, 0, WATER_Y - 6); ctx.fill();
  ctx.fillStyle = "#16261c";
  ctx.beginPath(); ctx.moveTo(0, WATER_Y - 1); ctx.quadraticCurveTo(60, WATER_Y + 5, 120, WATER_Y + 14); ctx.lineTo(132, H); ctx.lineTo(0, H); ctx.fill();
  ctx.strokeStyle = "#2f5238"; ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) { const gx = 6 + i * 7; if (gx > 120) continue; const gy = WATER_Y - 4 + (i % 3) * 4 + Math.min(40, i * 2); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 1 + Math.sin(t + i) * 1.5, gy - 5); ctx.stroke(); }
}
function drawLine() {
  let tipX = ROD_TIP.x, tipY = ROD_TIP.y, bx = bobber.x, by = bobber.y;
  if (fishState === "casting") {
    const p = castProgress;
    bx = lerp(ROD_TIP.x + 6, castTarget.x, p); by = lerp(ROD_TIP.y + 6, castTarget.y, p) - Math.sin(p * Math.PI) * 60;
    bobber.x = bx; bobber.y = by;
  } else if (fishState === "ready" || fishState === "missed" || fishState === "reveal") return;
  if (fishState === "hooked") { tipX = ROD_TIP.bx; tipY += (pulling > 0 ? 3 : 1); }
  ctx.strokeStyle = "rgba(225,230,255,0.55)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(tipX, tipY);
  ctx.quadraticCurveTo((tipX + bx) / 2, (tipY + by) / 2 + 10, bx, by); ctx.stroke();
}
function drawBobber() {
  if (fishState === "ready" || fishState === "missed" || fishState === "reveal") return;
  const x = bobber.x, y = bobber.y;
  if (fishState !== "casting") {
    ctx.globalAlpha = 0.35; ctx.strokeStyle = "#0c1330"; ctx.beginPath(); ctx.ellipse(x, y + 2, 5, 2, 0, 0, 6.28); ctx.stroke(); ctx.globalAlpha = 1;
  }
  px(x - 2, y - 4, 4, 3, "#e23b3b"); px(x - 2, y - 1, 4, 2, "#f4f4f4"); px(x - 1, y + 1, 2, 2, "#222"); px(x - 2, y - 4, 1, 1, "#ff8a8a");
}

function drawGuy() {
  const bob = Math.sin(t * 1.4) * 0.6;
  const sway = drunk > 0 ? Math.sin(t * 1.7) * drunk * 2.2 : 0;
  const baseX = 70 + sway, baseY = 112 + bob;
  // chair
  ctx.strokeStyle = "#3a3f55"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(baseX - 14, baseY + 36); ctx.lineTo(baseX - 6, baseY - 6); ctx.stroke();
  px(baseX - 16, baseY + 14, 30, 4, "#7a2d3a"); px(baseX - 14, baseY - 8, 26, 22, "#8c3543"); px(baseX - 14, baseY - 8, 26, 3, "#a3434f");
  ctx.beginPath(); ctx.moveTo(baseX - 14, baseY + 16); ctx.lineTo(baseX - 20, baseY + 40); ctx.moveTo(baseX + 12, baseY + 16); ctx.lineTo(baseX + 18, baseY + 40); ctx.moveTo(baseX - 14, baseY + 16); ctx.lineTo(baseX + 6, baseY + 40); ctx.stroke();
  // legs
  px(baseX - 2, baseY + 16, 24, 5, "#3b4a6b"); px(baseX + 18, baseY + 18, 16, 5, "#33405e"); px(baseX + 32, baseY + 18, 6, 6, "#43352a");
  // torso plaid
  px(baseX - 8, baseY - 4, 18, 22, "#b8473f");
  ctx.globalAlpha = 0.35; ctx.fillStyle = "#6e251f";
  for (let i = 0; i < 3; i++) ctx.fillRect(baseX - 8 + i * 6, baseY - 4, 2, 22);
  for (let i = 0; i < 4; i++) ctx.fillRect(baseX - 8, baseY - 4 + i * 6, 18, 2);
  ctx.globalAlpha = 1;
  // head + hat
  const drinkRaise = drinking > 0 ? Math.sin(clamp((2.6 - drinking) / 2.6, 0, 1) * Math.PI) : 0;
  const sip = Math.max(drinkRaise, sipAnim > 0 ? Math.sin((1.2 - sipAnim) / 1.2 * Math.PI) : 0);
  const headX = baseX, headY = baseY - 14 - sip * 2;
  px(headX - 4, headY - 4, 9, 8, "#e3b58c"); px(headX - 4, headY + 3, 9, 2, "#caa07a");
  px(headX - 8, headY - 2, 17, 2, "#d8b25a"); px(headX - 5, headY - 7, 11, 6, "#e7c56e"); px(headX - 5, headY - 3, 11, 1, "#b8923f");
  // arm
  const armY = baseY - 2;
  if (sip > 0.15) {
    px(baseX + 2, baseY - 2, 5, 8, "#b8473f"); px(baseX + 4, headY + 1, 4, 5, "#e3b58c");
    const bottle = drinking > 0 && (drinkKind === "akevitt" || drinkKind === "snabel");
    if (drinkKind === "snabel" && drinking > 0) { // hjemmebrent-dunk
      px(baseX + 3, headY - 1, 5, 6, "#dcd6c4"); px(baseX + 3, headY - 1, 5, 1, "#f0ece0"); px(baseX + 7, headY - 2, 2, 2, "#b03020");
    } else if (bottle) { // brennevinsflaske
      px(baseX + 4, headY - 2, 3, 7, "#9a7a3a"); px(baseX + 4, headY - 3, 3, 2, "#caa84a");
    } else { // ølboks
      px(baseX + 4, headY, 3, 4, "#cf3b3b"); px(baseX + 4, headY, 3, 1, "#e8e8e8");
    }
    // far hand still on rod
    px(baseX + 14, armY - 1, 4, 4, "#e3b58c");
    drawRod(baseX + 16, armY - 1);
  } else {
    px(baseX + 4, armY, 12, 4, "#c85a50"); px(baseX + 14, armY - 1, 4, 4, "#e3b58c");
    drawRod(baseX + 16, armY - 1);
  }
  // vice details at the mouth
  if (smoking > 0) { px(headX + 4, headY + 1, 4, 1, "#e8e2d0"); px(headX + 8, headY + 1, 1, 1, "#ff7a3a"); }
  if (buff.label === "Snusrus" && buff.t > 0) { px(headX - 2, headY + 3, 3, 2, "#caa07a"); }
  if (snusing > 0) { px(baseX + 2, headY + 1, 4, 4, "#e3b58c"); } // hand near lip
}
function drawRod(hx, hy) {
  const rc = rod();
  ctx.strokeStyle = rc.color; ctx.lineWidth = 2;
  let bend = 0;
  if (fishState === "hooked") bend = (tension / 100) * 14 + (pulling > 0 ? 6 : 0);
  const tipx = ROD_TIP.x + bend, tipy = ROD_TIP.y + bend * 0.4;
  ctx.beginPath(); ctx.moveTo(hx, hy);
  ctx.quadraticCurveTo((hx + ROD_TIP.x) / 2 - 6, (hy + ROD_TIP.y) / 2 - 10, tipx, tipy); ctx.stroke();
  px(hx - 1, hy - 1, 3, 3, rc.grip);        // grip
  px(tipx - 1, tipy - 1, 2, 2, rc.tip);     // bright tip
  ROD_TIP.bx = tipx;
}

function drawProps() {
  // the brown sekk by your side — drikke, stenger og fangst bor her
  const s = SEKK;
  px(s.x, s.y, s.w, s.h, "#6b4a2c");                 // body
  px(s.x, s.y, s.w, 4, "#7d5736");                   // top rim
  px(s.x, s.y + 8, s.w, s.h - 8, "#5e4026");         // lower shade
  px(s.x + 2, s.y + 2, s.w - 4, 9, "#8a6a44");       // front flap
  px(s.x + 2, s.y + 11, s.w - 4, 1, "#3e2a18");      // flap seam
  px(s.x + s.w / 2 - 2, s.y + 6, 4, 6, "#caa46a");   // buckle
  px(s.x + s.w / 2 - 1, s.y + 7, 2, 4, "#3e2a18");
  px(s.x - 2, s.y + 5, 2, s.h - 10, "#4a3320");      // side straps
  px(s.x + s.w, s.y + 5, 2, s.h - 10, "#4a3320");
  // a fishing-rod tip pokes out of the sekk so it reads as "utstyret bor her"
  ctx.strokeStyle = rod().color; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(s.x + 6, s.y); ctx.lineTo(s.x + 1, s.y - 12); ctx.stroke();
  px(s.x + 1, s.y - 13, 2, 2, rod().tip);            // bright rod tip
  // worm bucket
  const bx = 100, by = 156;
  px(bx, by, 16, 14, "#9aa0ad"); px(bx, by, 16, 3, "#c2c8d4"); px(bx + 1, by + 1, 14, 3, "#5a3a2a");
  ctx.strokeStyle = "#b0593f"; ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) { const wx = bx + 3 + i * 4; ctx.beginPath(); ctx.moveTo(wx, by + 2); ctx.lineTo(wx + Math.sin(t * 3 + i) * 1.5, by - 1); ctx.stroke(); }
  // radio
  const rd = RADIO;
  px(rd.x, rd.y, rd.w, rd.h, "#6b4a2e"); px(rd.x, rd.y, rd.w, 3, "#7d5a3a");
  px(rd.x + 2, rd.y + 4, 8, 7, "#3a2a1c"); // speaker grille
  for (let i = 0; i < 3; i++) px(rd.x + 3, rd.y + 5 + i * 2, 6, 1, "#5a4632");
  px(rd.x + 12, rd.y + 4, 4, 3, radio.on ? "#7dffb0" : "#33402f"); // dial light
  px(rd.x + 13, rd.y + 9, 2, 3, "#caa"); // knob
  px(rd.x + 7, rd.y - 4, 1, 5, "#bbb"); // antenna
  if (radio.on) { // sound waves
    ctx.strokeStyle = "rgba(125,255,176,0.6)"; ctx.lineWidth = 1;
    for (let i = 1; i <= 2; i++) { const rr = 3 + i * 3 + (Math.sin(t * 6) + 1) * 1.5; ctx.beginPath(); ctx.arc(rd.x - 1, rd.y + 6, rr, Math.PI * 0.6, Math.PI * 1.4); ctx.stroke(); }
  }
  // lantern hung on a wooden post on the grassy bank, up away from the water
  const lx = 116, ly = 110;
  // post + crossarm
  px(lx + 9, ly - 2, 3, 42, "#46331f"); px(lx + 9, ly - 2, 3, 42 - 6, "#46331f");
  px(lx + 1, ly - 4, 11, 3, "#46331f"); px(lx + 2, ly - 4, 1, 5, "#2a1d12"); // crossarm + hook
  const flick = 0.8 + 0.2 * Math.sin(t * 9) + 0.1 * Math.sin(t * 23);
  const gg = ctx.createRadialGradient(lx + 3, ly + 5, 1, lx + 3, ly + 5, 38 * flick);
  gg.addColorStop(0, "rgba(255,196,110,0.32)"); gg.addColorStop(1, "rgba(255,196,110,0)");
  ctx.fillStyle = gg; ctx.fillRect(lx - 35, ly - 30, 76, 70);
  px(lx, ly, 7, 10, "#5a4a3a"); px(lx + 1, ly + 1, 5, 7, `rgba(255,210,${(120 + flick * 60) | 0},0.9)`); px(lx + 2, ly - 3, 3, 3, "#4a3c2e");
  // thrown cans
  for (const can of cans) {
    ctx.save(); ctx.translate(can.x, can.y); ctx.rotate(can.rot);
    px(-2, -3, 4, 6, "#cf3b3b"); px(-2, -3, 4, 1, "#e8e8e8"); px(-2, 2, 4, 1, "#9aa0a8");
    ctx.restore();
  }
}
function drawReedsFront() {
  ctx.strokeStyle = "#10261a"; ctx.lineWidth = 2;
  const reed = (x, h, ph) => { ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + Math.sin(t * 0.8 + ph) * 6, H - h * 0.6, x + Math.sin(t * 0.8 + ph) * 10, H - h); ctx.stroke(); ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x + Math.sin(t * 0.8 + ph) * 10 - 1, H - h - 6, 3, 8); };
  for (let i = 0; i < 5; i++) reed(W - 8 - i * 11, 40 + i * 8, i);
  for (let i = 0; i < 3; i++) reed(150 + i * 9, 30 + i * 6, i + 2);
}
function drawFireflies() {
  for (const ff of fireflies) {
    const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(ff.ph));
    ctx.globalAlpha = glow * 0.8; ctx.fillStyle = "#fff2a0"; ctx.beginPath(); ctx.arc(ff.x, ff.y, 2.2, 0, 6.28); ctx.fill();
    ctx.globalAlpha = glow; px(ff.x, ff.y, 1, 1, "#fffbe0");
  }
  ctx.globalAlpha = 1;
}
function drawVignette() {
  const g = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 300);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.06; ctx.fillStyle = "#3a2a55"; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
}

function drawRevealFish() {
  if (fishState !== "reveal" || !currentCatch) return;
  // soft spotlight
  const cx = W / 2, cy = 96;
  const gg = ctx.createRadialGradient(cx, cy, 6, cx, cy, 70);
  gg.addColorStop(0, "rgba(255,240,200,0.22)"); gg.addColorStop(1, "rgba(255,240,200,0)");
  ctx.fillStyle = gg; ctx.fillRect(cx - 80, cy - 70, 160, 140);
  const c = currentCatch;
  if (c.junk) { drawJunkSprite(ctx, cx, cy, 4, c.f.kind); return; }
  const ratio = c.weight / c.f.max;
  const u = Math.round(clamp(2.5 + ratio * 5.5, 3, 9));
  // gentle float
  drawFishSprite(ctx, cx, cy + Math.sin(t * 2) * 3, u, c.f);
}

/* ---- other screens' backdrops ---- */
function drawMenuBg() {
  drawSky(); drawStars(); drawAurora(); drawMoon(); drawMountains(); drawTreeline(); drawLurkingEyes(); drawMoose(); drawWater(); drawWaterfall(); drawReflections(); drawForestDetails(); drawSummerDetails(); drawShore();
  drawGuy(); drawProps(); drawCat(); drawReedsFront(); drawFireflies(); drawVignette();
}
function drawMarketBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#241a33"); g.addColorStop(0.6, "#3a2a44"); g.addColorStop(1, "#241826");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawStars();
  // ground
  px(0, 200, W, 70, "#2a2030");
  for (let x = 0; x < W; x += 24) px(x, 200, 1, 70, "#1c1622");
  // string lights
  ctx.strokeStyle = "#4a3a2a"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 46); ctx.quadraticCurveTo(W / 2, 76, W, 46); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const x = i / 11 * W, y = 46 + Math.sin(i / 11 * Math.PI) * 30;
    const on = 0.6 + 0.4 * Math.sin(t * 3 + i);
    ctx.globalAlpha = on; ctx.fillStyle = ["#ffd877", "#ff9a6a", "#9affc0"][i % 3];
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 6.28); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // people strolling the street (drawn behind the stalls so they read as in the crowd)
  for (const n of marketNPCs) drawMarketNPC(n);
  // stalls + shopkeepers (counter drawn last so they stand behind it)
  drawStall(60, 110, "#7a3b3b");
  drawLady(60, 150);
  drawStallCounter(60, 110);
  drawStall(180, 110, "#3b7a4a");
  drawKioskKeeper(180, 150);
  drawStallCounter(180, 110);
  drawStall(300, 110, "#3b5a7a");
  drawGrumpyMan(300, 150);
  drawStallCounter(300, 110);
  drawStall(420, 110, "#5a2a4a");
  drawCroupier(420, 150);
  drawStallCounter(420, 110);
  // wooden signs (no emoji)
  drawSign(60, 92, "FISKEHANDEL");
  drawSign(180, 92, "KIOSK");
  drawSign(300, 92, "FISKEUTSTYR");
  drawSign(420, 92, "KASINO");
  // pulsing «click me» outline on each stall
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.globalAlpha = 0.35 + 0.45 * pulse; ctx.strokeStyle = "#ffe6a0"; ctx.lineWidth = 1;
  ctx.strokeRect(FISH_STALL.x, FISH_STALL.y + 6, FISH_STALL.w, FISH_STALL.h - 10);
  ctx.strokeRect(KIOSK_STALL.x, KIOSK_STALL.y + 6, KIOSK_STALL.w, KIOSK_STALL.h - 10);
  ctx.strokeRect(ROD_STALL.x, ROD_STALL.y + 6, ROD_STALL.w, ROD_STALL.h - 10);
  ctx.strokeRect(CASINO_STALL.x, CASINO_STALL.y + 6, CASINO_STALL.w, CASINO_STALL.h - 10);
  ctx.globalAlpha = 1;
  drawMarketTruck();
  drawFireflies(); drawVignette();
}
// our own truck parked at the market — click it to drive back to the water
function drawMarketTruck() {
  const r = MARKET_TRUCK, x = r.x, y = r.y, w = r.w;
  // tyre-track patch on the ground
  ctx.fillStyle = "#1c1622";
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + r.h - 2, w / 2, 3, 0, 0, 6.28); ctx.fill();
  // body (side view, cab to the left)
  px(x + 4, y + 14, w - 6, 13, "#b23a2a");     // bed
  px(x + 4, y + 4, 24, 13, "#c64636");         // cab
  px(x + 8, y + 7, 14, 8, "#bfe6ef");          // window
  px(x + 4, y + 25, w - 6, 3, "#7a241c");      // chassis shadow
  // wheels
  px(x + 11, y + 26, 8, 6, "#1a1a1a"); px(x + 14, y + 28, 2, 2, "#555");
  px(x + w - 16, y + 26, 8, 6, "#1a1a1a"); px(x + w - 13, y + 28, 2, 2, "#555");
  // headlight + rod sticking out of the bed
  px(x + 3, y + 11, 2, 3, "#ffe9a0");
  ctx.strokeStyle = "#caa97a"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + w - 6, y + 14); ctx.lineTo(x + w + 4, y - 1); ctx.stroke();
  // pulsing «click» outline + label
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.globalAlpha = 0.35 + 0.45 * pulse; ctx.strokeStyle = "#ffe6a0"; ctx.lineWidth = 1;
  ctx.strokeRect(r.x, r.y + 2, r.w, r.h - 2);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffe6a0"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("← til vannet", x + w / 2, y - 4);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function drawMarketNPC(n) {
  const x = Math.round(n.x), y = Math.round(n.y);
  const bob = n.pause > 0 ? 0 : Math.abs(Math.sin(n.ph)) * 1.2;
  const yy = y - bob;
  const sw = n.dir;
  const stride = n.pause > 0 ? 0 : Math.sin(n.ph) * 2;
  // tiny shadow
  ctx.globalAlpha = 0.25; px(x - 3, y + 13, 8, 1, "#000"); ctx.globalAlpha = 1;
  // legs (alternating stride)
  px(x - 2, yy + 8, 2, 5 + stride, "#2a2230"); px(x + 1, yy + 8, 2, 5 - stride, "#2a2230");
  // coat / body
  px(x - 3, yy, 7, 9, n.coat); px(x - 3, yy, 7, 2, shade(n.coat, 18));
  // swinging arm
  px(x + (sw > 0 ? 3 : -4), yy + 2, 2, 6, shade(n.coat, -12));
  // head + hat
  px(x - 2, yy - 5, 5, 5, "#e0b48a");
  px(x - 3, yy - 7, 7, 3, n.hat);
}
function drawStall(cx, cy, color) {
  px(cx - 50, cy, 100, 70, "#2a2230");
  // roof stripes
  for (let i = 0; i < 10; i++) px(cx - 50 + i * 10, cy - 14, 10, 14, i % 2 ? color : "#e8e2d0");
  px(cx - 54, cy - 16, 108, 4, "#1c1622");
}
function drawSign(cx, y, text) {
  const w = Math.max(40, text.length * 6 + 12);
  // posts
  px(cx - w / 2 + 2, y - 6, 2, 20, "#3a2c1e"); px(cx + w / 2 - 4, y - 6, 2, 20, "#3a2c1e");
  ctx.fillStyle = "#5a4632"; ctx.fillRect(cx - w / 2, y - 8, w, 13);
  ctx.fillStyle = "#3a2c1e"; ctx.fillRect(cx - w / 2, y - 8, w, 2);
  ctx.fillStyle = "#ffe6a0"; ctx.font = "8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, cx, y); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function drawStallCounter(cx, cy, goods) {
  px(cx - 50, cy + 50, 100, 8, "#4a3a2a"); px(cx - 50, cy + 50, 100, 2, "#5e4a32");
}
function drawShopFishBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2a2438"); g.addColorStop(1, "#181420"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // counter with fish on ice
  px(60, 170, 360, 60, "#5a4634"); px(60, 170, 360, 6, "#6e573f");
  px(80, 150, 200, 22, "#cfe6f2"); // ice tray
  // a few fish on ice
  [FISH_BY_KEY.orret, FISH_BY_KEY.roye, FISH_BY_KEY.abbor, FISH_BY_KEY.sik].forEach((f, i) => drawFishSprite(ctx, 110 + i * 50, 158, 2, f));
  // the lady, standing right at the counter
  drawLady(330, 148);
  drawPriceBoard();
  drawVignette();
}
// pixel-art chalkboard on the wall — kr/kg for species you have actually caught
function drawPriceBoard() {
  const rows = [];
  for (const f of FISH) { const r = save.record[f.key]; if (r && r.count > 0) rows.push({ name: f.name, kr: f.kr, trophy: false }); }
  for (const f of RARES) { const r = save.record[f.key]; if (r && r.count > 0) rows.push({ name: f.name, kr: f.kr, trophy: true }); }
  const x = 12, y = 18, rowH = 8, colW = 90, headH = 13;
  const firstRowY = y + headH + 6;            // baseline of the first price row
  const wallBottom = 138;                     // keep the whole board above the ice tray / counter
  const rowsPerCol = Math.max(1, Math.floor((wallBottom - firstRowY) / rowH) + 1);
  const ncol = rows.length ? Math.ceil(rows.length / rowsPerCol) : 1;
  const tallest = rows.length ? Math.min(rowsPerCol, rows.length) : 2;
  const w = ncol * colW;
  const h = headH + 6 + tallest * rowH;
  // hanging strings to the nail rail
  ctx.strokeStyle = "#6a563a"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 10, y - 4); ctx.lineTo(x + 3, y - 13); ctx.moveTo(x + w - 10, y - 4); ctx.lineTo(x + w - 3, y - 13); ctx.stroke();
  px(x + 1, y - 14, w - 2, 2, "#7a5a3a"); // nail rail
  // wooden frame + slate
  px(x - 3, y - 3, w + 6, h + 6, "#4a3320");
  px(x, y, w, h, "#1b2a23");
  px(x, y, w, 2, "#28392f");
  px(x, y + h - 2, w, 2, "#10180f");
  // title
  ctx.fillStyle = "#ffe6a0"; ctx.font = "bold 7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("KILOPRIS", x + w / 2, y + 8);
  px(x + 8, y + 13, w - 16, 1, "#3a5a4a");
  if (!rows.length) {
    ctx.fillStyle = "#8aa89a"; ctx.font = "6px monospace";
    ctx.fillText("fang fisk for", x + w / 2, y + 25);
    ctx.fillText("\u00e5 se prisen", x + w / 2, y + 33);
  } else {
    ctx.font = "6px monospace"; ctx.textBaseline = "middle";
    rows.forEach((rw, i) => {
      const col = Math.floor(i / rowsPerCol), idx = i % rowsPerCol;
      const cx = x + col * colW, ry = firstRowY + idx * rowH;
      if (col > 0 && idx === 0) px(cx, y + 4, 1, h - 8, "#10180f"); // column divider
      ctx.textAlign = "left"; ctx.fillStyle = rw.trophy ? "#ffd65a" : "#dfeee6";
      ctx.fillText((rw.trophy ? "\u2605" : "") + rw.name, cx + 6, ry);
      ctx.textAlign = "right"; ctx.fillStyle = rw.trophy ? "#ffd65a" : "#9dffb8";
      ctx.fillText(fmt(rw.kr) + "/kg", cx + colW - 6, ry);
    });
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function drawLady(x, y) {
  const sway = Math.sin(t * 1.1) * 1.2;
  x += sway;
  const fixing = Math.sin(t * 0.5) > 0.7; // periodically fixes her hair
  // big hair
  px(x - 10, y - 11, 20, 13, "#3a2a40");
  px(x - 11, y - 2, 5, 20, "#3a2a40"); px(x + 6, y - 2, 5, 20, "#3a2a40");
  px(x - 9, y - 13, 18, 4, "#4a3550");
  // face
  px(x - 6, y - 6, 12, 11, "#e8b894"); px(x - 6, y + 4, 12, 2, "#d2a07c");
  // lashes + eyes
  px(x - 3, y - 2, 2, 1, "#2a2030"); px(x + 2, y - 2, 2, 1, "#2a2030");
  px(x - 3, y - 3, 2, 1, "#2a2030"); px(x + 2, y - 3, 2, 1, "#2a2030");
  // blush + lips
  px(x - 5, y + 1, 2, 2, "#f0a0a0"); px(x + 4, y + 1, 2, 2, "#f0a0a0");
  px(x - 2, y + 2, 4, 1, "#c83a5a");
  // red dress
  px(x - 10, y + 6, 20, 24, "#b83a5a"); px(x - 10, y + 6, 20, 3, "#d2557a");
  // big bust
  px(x - 9, y + 8, 8, 7, "#e8b894"); px(x + 1, y + 8, 8, 7, "#e8b894");
  px(x - 9, y + 8, 8, 1, "#f2c9a6"); px(x + 1, y + 8, 8, 1, "#f2c9a6");
  px(x - 1, y + 9, 2, 5, "#c98a6a"); // cleavage shadow
  px(x - 10, y + 13, 20, 2, "#a8324f");
  // arms
  if (fixing) { px(x - 14, y + 7, 5, 8, "#e8b894"); px(x - 12, y - 6, 4, 12, "#e8b894"); px(x + 9, y + 9, 5, 13, "#e8b894"); }
  else { px(x - 14, y + 9, 5, 13, "#e8b894"); px(x + 9, y + 9, 5, 13, "#e8b894"); }
  // wink sparkle
  if (Math.sin(t * 1.5) > 0.85) px(x + 6, y - 8, 2, 2, "#fff");
}
function drawShopRodBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2a2820"); g.addColorStop(1, "#181610"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // wall with the actual rods for sale, each in its own colour
  const n = RODS.length, gap = (W - 80) / n;
  RODS.forEach((r, i) => {
    const rx = 40 + gap * (i + 0.5), top = 44, bot = 146;
    const owned = save.owned.includes(i), equipped = i === save.rodLevel;
    // peg
    px(rx - 2, top - 6, 5, 5, "#7a5a3a");
    // the rod itself
    ctx.strokeStyle = r.color; ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(rx, top); ctx.quadraticCurveTo(rx + 10, (top + bot) / 2, rx + 6, bot); ctx.stroke();
    ctx.strokeStyle = r.grip; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(rx, top); ctx.lineTo(rx + 2, top + 16); ctx.stroke();
    px(rx - 2, top - 1, 3, 3, r.tip);
    ctx.lineWidth = 1; ctx.lineCap = "butt";
    // little label
    ctx.fillStyle = owned ? "#9affc0" : "#cbb890"; ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(equipped ? "I BRUK" : (owned ? "EID" : fmt(r.cost) + "kr"), rx + 4, bot + 9);
  });
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  // counter
  px(60, 175, 360, 55, "#4a3a26"); px(60, 175, 360, 6, "#5e4a32");
  drawGrumpyMan(150, 148);
  drawVignette();
}
function drawShopKioskBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1e2a24"); g.addColorStop(1, "#121814"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // shelves with goods
  for (let s = 0; s < 3; s++) {
    const sy = 56 + s * 30;
    px(70, sy + 16, 230, 3, "#3a2c1e");
    for (let i = 0; i < 9; i++) {
      const gx = 80 + i * 25, kind = ["beer", "snus", "cigar", "akevitt"][(i + s) % 4];
      drawConsumableIcon(kind, gx, sy + 10);
    }
  }
  // neon "ÅPENT" sign
  const on = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.globalAlpha = on; ctx.fillStyle = "#ff6abf"; ctx.font = "10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("ÅPENT", 380, 56); ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  // festive flashing party lights strung across the top
  const cols = ["#ff5a5a", "#ffd65a", "#5affa0", "#5ab0ff", "#c45aff"];
  for (let i = 0; i < 11; i++) {
    const lx = 40 + i * 38, ly = 26 + Math.sin(i * 0.9) * 3;
    const bri = 0.4 + 0.6 * Math.abs(Math.sin(t * 5 + i));
    ctx.globalAlpha = bri; px(lx, ly, 4, 5, cols[i % cols.length]); ctx.globalAlpha = 1;
    px(lx + 1, ly - 2, 2, 2, "#3a3a3a");
  }
  // counter
  px(60, 175, 360, 55, "#3a4a32"); px(60, 175, 360, 6, "#4a5e3f");
  drawKioskKeeper(150, 148);
  drawVignette();
}
function drawRouletteWheel(cx, cy, rad) {
  const N = 37;
  for (let i = 0; i < N; i++) {
    const n = WHEEL_ORDER[i];
    const a0 = casino.angle + i / N * Math.PI * 2, a1 = casino.angle + (i + 1) / N * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rad, a0, a1); ctx.closePath();
    const col = rouletteColor(n);
    ctx.fillStyle = col === "green" ? "#1f9a4a" : col === "red" ? "#b22a2a" : "#1a1a1a"; ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.5; ctx.stroke();
  }
  // golden rim + hub
  ctx.strokeStyle = "#caa23a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.28); ctx.stroke();
  ctx.fillStyle = "#3a2a16"; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 6.28); ctx.fill();
  ctx.strokeStyle = "#caa23a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 6.28); ctx.stroke();
  // the result number sits in the hub once the wheel rests
  if (!casino.spinning) {
    const col = rouletteColor(casino.result);
    ctx.fillStyle = col === "green" ? "#7dffb0" : col === "red" ? "#ff9a8a" : "#e0e0e0";
    ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(casino.result), cx, cy + 1); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
  // the ball rests at the top pointer (the winning pocket rotates to meet it)
  const br = rad - 5;
  const bx = cx, by = cy - br;
  ctx.fillStyle = "#f4f4f4"; ctx.beginPath(); ctx.arc(bx, by, 2, 0, 6.28); ctx.fill();
  // top pointer
  ctx.fillStyle = "#ffe6a0"; ctx.beginPath(); ctx.moveTo(cx, cy - rad - 1); ctx.lineTo(cx - 4, cy - rad - 9); ctx.lineTo(cx + 4, cy - rad - 9); ctx.closePath(); ctx.fill();
}
function drawCroupier(x, y) {
  // old-school, kind-faced gentleman in a sharp red suit
  // red suit body
  px(x - 16, y + 4, 32, 30, "#9a1f2a"); px(x - 16, y + 4, 32, 3, "#bf2f3a");
  // lapels + white shirt
  px(x - 4, y + 4, 8, 22, "#f4efe6");
  px(x - 8, y + 5, 5, 16, "#7a141d"); px(x + 3, y + 5, 5, 16, "#7a141d");
  // bow tie
  px(x - 3, y + 6, 6, 3, "#1a1a1a"); px(x - 1, y + 6, 2, 3, "#3a3a3a");
  // arms (one gestures while the wheel spins)
  const wave = casino.spinning ? Math.sin(t * 8) * 3 : Math.sin(t * 1.5) * 1;
  px(x - 20, y + 8, 5, 16, "#9a1f2a"); px(x + 15, y + 8 + wave, 5, 14, "#9a1f2a");
  px(x - 20, y + 22, 4, 4, "#5a3a2a"); px(x + 16, y + 20 + wave, 4, 4, "#5a3a2a"); // hands
  // head — warm dark skin tone
  px(x - 8, y - 10, 16, 14, "#5a3a26"); px(x - 8, y + 2, 16, 2, "#46301f");
  // friendly eyes + bright smile
  px(x - 5, y - 5, 3, 2, "#f4f4f4"); px(x + 2, y - 5, 3, 2, "#f4f4f4");
  px(x - 4, y - 5, 1, 2, "#2a1a10"); px(x + 3, y - 5, 1, 2, "#2a1a10");
  px(x - 4, y + 0, 8, 2, "#f4f4f4"); // big white grin
  // grey moustache (old-school)
  px(x - 4, y - 1, 8, 1, "#d8d2c8");
  // greying hair + a touch of sideburns
  px(x - 9, y - 12, 18, 4, "#3a2a1e"); px(x - 9, y - 11, 18, 1, "#6a5a4a");
  px(x - 9, y - 8, 2, 5, "#4a3a2a"); px(x + 7, y - 8, 2, 5, "#4a3a2a");
  // a little flower in the lapel
  px(x + 5, y + 7, 2, 2, "#ffd65a");
}
function drawShopCasinoBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#241018"); g.addColorStop(1, "#160a10"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawStars();
  // marquee bulbs
  for (let i = 0; i < 16; i++) {
    const lx = 18 + i * 30, bri = 0.4 + 0.6 * Math.abs(Math.sin(t * 4 + i * 0.7));
    ctx.globalAlpha = bri; px(lx, 16, 4, 4, ["#ffd65a", "#ff5a8a", "#5affa0"][i % 3]); ctx.globalAlpha = 1;
  }
  // neon ROULETTE
  const on = 0.6 + 0.4 * Math.sin(t * 4);
  ctx.globalAlpha = on; ctx.fillStyle = "#ff6abf"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("ROULETTE", 240, 34); ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  // the gentleman stands behind the table; the felt is drawn over his lower half
  drawCroupier(250, 74);
  // green felt table
  px(40, 92, 400, 70, "#1f5a36"); px(40, 92, 400, 4, "#2f7a4a");
  // red / green / black bet spots on the felt
  px(96, 138, 34, 18, "#b22a2a"); px(224, 138, 34, 18, "#1f9a4a"); px(352, 138, 34, 18, "#1a1a1a");
  ctx.fillStyle = "#fff"; ctx.font = "8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("RØD 2×", 113, 147); ctx.fillText("0  14×", 241, 147); ctx.fillText("SVART 2×", 369, 147);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  // highlight the spot you've bet on
  const betSpot = casino.color === "red" ? 96 : casino.color === "green" ? 224 : 352;
  ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 4); ctx.strokeStyle = "#ffe6a0"; ctx.lineWidth = 1.5;
  ctx.strokeRect(betSpot - 1, 137, 36, 20); ctx.globalAlpha = 1;
  // the wheel he spins for you
  drawRouletteWheel(170, 112, 28);
  drawVignette();
}
function drawGrumpyMan(x, y) {
  // small hop of joy when he finally sells something
  y -= rodHop > 0 ? Math.sin(rodHop * Math.PI) * 5 : 0;
  // big round body
  px(x - 18, y + 4, 36, 30, "#3a6a4a"); px(x - 18, y + 4, 36, 3, "#4a7a58"); // green apron/shirt
  // arms crossed
  px(x - 20, y + 14, 40, 6, "#2f5a3e");
  px(x - 6, y + 12, 12, 5, "#caa07a");
  // head
  px(x - 9, y - 8, 18, 14, "#e0b48a");
  // big beard
  px(x - 10, y + 2, 20, 10, "#8a7a5a"); px(x - 8, y + 10, 16, 4, "#7a6a4a");
  // brows + eyes (angrier while still sour)
  const sour = rodGrumpyBuy === false;
  px(x - 6, y - 4, 5, 1, "#4a3a2a"); px(x + 1, y - 4, 5, 1, "#4a3a2a");
  if (sour) { px(x - 6, y - 4, 5, 1, "#3a2a1a"); px(x + 1, y - 5, 5, 1, "#3a2a1a"); }
  px(x - 5, y - 2, 2, 2, "#2a2030"); px(x + 3, y - 2, 2, 2, "#2a2030");
  // mouth: frown when sour, neutral otherwise
  if (sour) { px(x - 3, y + 2, 6, 1, "#7a4a3a"); px(x - 3, y + 1, 1, 1, "#7a4a3a"); px(x + 2, y + 1, 1, 1, "#7a4a3a"); }
  else px(x - 3, y + 1, 6, 1, "#8a5a4a");
  // hipster straw hat
  px(x - 12, y - 10, 24, 2, "#d8b25a"); px(x - 7, y - 16, 14, 6, "#e7c56e"); px(x - 7, y - 11, 14, 1, "#a8782f");
  // angrier if you left without buying (visual steam)
  if (sour) {
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 8); ctx.fillStyle = "#ff7a5a";
    ctx.fillRect(x + 12, y - 18 + Math.sin(t * 6) * 2, 2, 4); ctx.fillRect(x + 16, y - 22 + Math.cos(t * 6) * 2, 2, 4);
    ctx.globalAlpha = 1;
  }
}
/* ---- boost visuals ---- */
function drawBuffAura() {
  if (buff.t <= 0) return;
  const a = clamp(0.12 + 0.06 * Math.sin(t * 4) + buffFlash * 0.3, 0, 0.55);
  const gx = 70 + (drunk > 0 ? Math.sin(t * 1.7) * drunk * 2.2 : 0), gy = 104;
  const gg = ctx.createRadialGradient(gx, gy, 4, gx, gy, 30);
  gg.addColorStop(0, hexA(buff.color, a)); gg.addColorStop(1, hexA(buff.color, 0));
  ctx.fillStyle = gg; ctx.fillRect(gx - 32, gy - 34, 64, 68);
}
function drawSmoke() {
  for (const s of smoke) {
    ctx.globalAlpha = clamp(s.life, 0, 1) * 0.5;
    ctx.fillStyle = "#d8d4d0";
    ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, 6.28); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawConsumableIcon(kind, x, y) {
  if (kind === "beer") { px(x - 2, y - 3, 4, 6, "#cf3b3b"); px(x - 2, y - 3, 4, 1, "#e8e8e8"); }
  else if (kind === "snus") { px(x - 3, y - 2, 6, 4, "#2f7a3a"); px(x - 3, y - 2, 6, 1, "#4a9a55"); }
  else if (kind === "cigar") { px(x - 3, y, 6, 2, "#6a4a2a"); px(x + 3, y, 1, 2, "#ff7a3a"); }
  else if (kind === "akevitt") { px(x - 1, y - 4, 2, 2, "#caa84a"); px(x - 2, y - 2, 4, 6, "#9a7a3a"); px(x - 2, y - 2, 4, 1, "#d8c07a"); }
  else if (kind === "snabel") { px(x - 3, y - 2, 6, 6, "#dcd6c4"); px(x - 3, y - 2, 6, 1, "#f0ece0"); px(x + 2, y - 4, 2, 2, "#b03020"); px(x - 4, y - 1, 1, 3, "#b8b2a0"); }
}
// shared back-arrow for in-scene panels; the open panel sets this each frame for hit-testing
let backBtnRect = null;
function drawBackArrow(panelX, panelW, top) {
  const x = panelX + panelW - 16, y = top + 3;
  backBtnRect = { x, y, w: 13, h: 11 };
  px(x, y, 13, 11, "#2a2440");
  ctx.fillStyle = "#ffd6a0"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("\u2039", x + 6, y + 6);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
const COOLER_MENU = [
  { key: "_godsaker", name: "Godsaker", action: true },
  { key: "_rods", name: "Bytt stang", action: true },
  { key: "_bag", name: "Se fangst", action: true },
  { key: "_records", name: "Rekorder", action: true },
];
const CONSUMABLES = [
  { key: "beer", name: "Trygdepatron" },
  { key: "snus", name: "Snus" },
  { key: "cigar", name: "Sigarillo" },
  { key: "akevitt", name: "Blænnvin" },
  { key: "snabel", name: "Snabelstoff" },
];
function coolerItemRects() {
  const w = 122, h = 17, x = 12;
  return COOLER_MENU.map((it, i) => ({ ...it, x, y: 170 - i * 21, w, h }));
}
function drawCoolerMenu() {
  if (!coolerMenu) return;
  const rects = coolerItemRects();
  const top = rects[rects.length - 1].y - 15, bot = rects[0].y + 17 + 4;
  px(8, top, 130, bot - top, "rgba(14,12,22,0.94)");
  px(8, top, 130, 3, "#caa46a");
  ctx.fillStyle = "#e6c98a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("SEKKEN", 8 + 65, top + 8);
  drawBackArrow(8, 130, top);
  for (const it of rects) {
    px(it.x, it.y, it.w, it.h, "#2a2440");
    px(it.x, it.y, it.w, 1, "#3a2e4a");
    const cy = it.y + it.h / 2;
    const ic = it.key === "_godsaker" ? "🍬" : it.key === "_rods" ? "🎣" : it.key === "_bag" ? "🎒" : "🏆";
    ctx.fillStyle = "#bfc8ff"; ctx.font = "8px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(ic, it.x + 5, cy);
    ctx.fillStyle = "#dfe6ff"; ctx.font = "9px monospace"; ctx.fillText(it.name, it.x + 20, cy + 1);
    ctx.fillStyle = "#9aa6d0"; ctx.textAlign = "right"; ctx.fillText("›", it.x + it.w - 6, cy);
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function godsakerRects() {
  const w = 122, h = 17, x = 12;
  return CONSUMABLES.map((it, i) => ({ ...it, x, y: 170 - i * 21, w, h }));
}
function drawGodsakerPanel() {
  if (!godsakerPanel) return;
  const rects = godsakerRects();
  const top = rects[rects.length - 1].y - 15, bot = rects[0].y + 17 + 4;
  px(8, top, 130, bot - top, "rgba(14,12,22,0.94)");
  px(8, top, 130, 3, "#caa46a");
  ctx.fillStyle = "#e6c98a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("GODSAKER", 8 + 65, top + 8);
  drawBackArrow(8, 130, top);
  for (const it of rects) {
    px(it.x, it.y, it.w, it.h, "#241c30");
    px(it.x, it.y, it.w, 1, "#3a2e4a");
    const cy = it.y + it.h / 2;
    const stock = save.stock[it.key] || 0;
    drawConsumableIcon(it.key, it.x + 10, cy);
    ctx.fillStyle = stock > 0 ? "#f0e6d0" : "#7a6a72"; ctx.font = "9px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(it.name, it.x + 22, cy + 1);
    ctx.fillStyle = stock > 0 ? "#ffe6a0" : "#a06a6a";
    ctx.textAlign = "right"; ctx.fillText(stock + " stk", it.x + it.w - 5, cy + 1);
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
/* in-scene rod picker (replaces the old inventory overlay for "Bytt stang") */
function rodPanelRects() {
  const owned = save.owned.slice().sort((a, b) => a - b);
  const w = 132, h = 20, x = 12;
  return owned.map((level, i) => ({ level, x, y: 150 - i * 22, w, h }));
}
function drawRodPanel() {
  if (!rodPanel) return;
  const rects = rodPanelRects();
  const top = rects[rects.length - 1].y - 16, bot = rects[0].y + 20 + 5;
  px(8, top, 140, bot - top, "rgba(14,12,22,0.94)");
  px(8, top, 140, 3, "#caa46a");
  ctx.fillStyle = "#e6c98a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("BYTT STANG", 8 + 70, top + 8);
  drawBackArrow(8, 140, top);
  for (const it of rects) {
    const equipped = it.level === save.rodLevel;
    px(it.x, it.y, it.w, it.h, equipped ? "#2e3a26" : "#241c30");
    px(it.x, it.y, it.w, 1, equipped ? "#4a6a3a" : "#3a2e4a");
    const r = RODS[it.level];
    // little colored rod swatch
    ctx.strokeStyle = r.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(it.x + 5, it.y + it.h - 4); ctx.lineTo(it.x + 14, it.y + 4); ctx.stroke();
    px(it.x + 13, it.y + 3, 2, 2, r.tip);
    ctx.fillStyle = equipped ? "#bfe6a0" : "#f0e6d0"; ctx.font = "9px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(r.name, it.x + 20, it.y + 11);
    ctx.fillStyle = equipped ? "#9affc0" : "#9aa6d0"; ctx.textAlign = "right";
    ctx.fillText(equipped ? "i bruk" : "velg ›", it.x + it.w - 5, it.y + 11);
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
/* in-scene catch summary (replaces the old inventory overlay for "Se fangst") */
function drawBagPanel() {
  if (!bagPanel) return;
  const groups = {};
  for (const b of save.basket) { groups[b.key] = groups[b.key] || { count: 0, value: 0 }; groups[b.key].count++; groups[b.key].value += b.value; }
  const keys = Object.keys(groups);
  const rows = Math.max(1, keys.length);
  const x = 12, w = 168, rh = 14, top = 40, headH = 22;
  const h = headH + rows * rh + 18;
  px(x, top, w, h, "rgba(14,12,22,0.95)");
  px(x, top, w, 3, "#caa46a");
  ctx.fillStyle = "#e6c98a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("FANGSTEN DIN", x + w / 2, top + 11);
  drawBackArrow(x, w, top);
  ctx.font = "9px monospace"; ctx.textBaseline = "middle";
  if (!keys.length) {
    ctx.fillStyle = "#9aa6d0"; ctx.textAlign = "center";
    ctx.fillText("Kurven er tom — gå og fisk!", x + w / 2, top + headH + 6);
  } else {
    let total = 0;
    keys.forEach((k, i) => {
      const g = groups[k]; total += g.value;
      const f = FISH_BY_KEY[k];
      const y = top + headH + i * rh + 7;
      ctx.fillStyle = "#f0e6d0"; ctx.textAlign = "left";
      ctx.fillText(`${f.name} ×${g.count}`, x + 8, y);
      ctx.fillStyle = "#ffe6a0"; ctx.textAlign = "right";
      ctx.fillText(fmt(g.value) + " kr", x + w - 8, y);
    });
    ctx.fillStyle = "#9affc0"; ctx.textAlign = "left";
    ctx.fillText("Verdi: " + fmt(total) + " kr", x + 8, top + headH + rows * rh + 7);
  }
  ctx.fillStyle = "#8a93b8"; ctx.font = "7px monospace"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText("klikk for å lukke", x + w - 6, top + h - 7);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
/* in-scene record book (replaces the old inventory "Rekorder" tab) */
function drawRecordsPanel() {
  if (!recordsPanel) return;
  let caught = 0;
  for (const f of FISH) { const r = save.record[f.key]; if (r && r.count > 0) caught++; }
  let trophies = 0;
  for (const f of RARES) { const r = save.record[f.key]; if (r && r.count > 0) trophies++; }
  const x = 8, w = 196, rh = 12, top = 18, headH = 24;
  const h = headH + FISH.length * rh + 16 + RARES.length * rh + 12;
  px(x, top, w, h, "rgba(14,12,22,0.96)");
  px(x, top, w, 3, "#caa46a");
  ctx.fillStyle = "#e6c98a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("REKORDBOKA", x + w / 2, top + 10);
  drawBackArrow(x, w, top);
  ctx.font = "7px monospace"; ctx.fillStyle = "#9aa6d0";
  ctx.fillText(`Arter: ${caught}/${FISH.length}   Troféer: ${trophies}/${RARES.length}`, x + w / 2, top + 19);
  ctx.font = "8px monospace"; ctx.textBaseline = "middle";
  FISH.forEach((f, i) => {
    const r = save.record[f.key];
    const has = r && r.count > 0;
    const y = top + headH + i * rh + 6;
    ctx.textAlign = "left"; ctx.fillStyle = has ? "#f0e6d0" : "#6a6472";
    ctx.fillText(has ? f.name : "???", x + 8, y);
    ctx.textAlign = "right";
    if (has) { ctx.fillStyle = "#ffe6a0"; ctx.fillText(`${r.best.toFixed(2)} kg · ×${r.count}`, x + w - 8, y); }
    else { ctx.fillStyle = "#6a6472"; ctx.fillText("ikke fanget", x + w - 8, y); }
  });
  // trophy fish section
  const ty = top + headH + FISH.length * rh + 10;
  ctx.textAlign = "center"; ctx.fillStyle = "#ffd877"; ctx.font = "bold 8px monospace";
  ctx.fillText("— TROFÉFISK —", x + w / 2, ty);
  ctx.font = "8px monospace";
  RARES.forEach((f, i) => {
    const r = save.record[f.key];
    const has = r && r.count > 0;
    const y = ty + 10 + i * rh;
    ctx.textAlign = "left"; ctx.fillStyle = has ? "#ffe6a0" : "#6a6472";
    ctx.fillText(has ? "🏆 " + f.name : "🔒 ???", x + 8, y);
    ctx.textAlign = "right"; ctx.font = "7px monospace";
    if (has) { ctx.fillStyle = "#ffd877"; ctx.fillText(`${r.best.toFixed(2)} kg · ×${r.count}`, x + w - 8, y); }
    else { ctx.fillStyle = "#6a6472"; ctx.fillText(f.locName, x + w - 8, y); }
    ctx.font = "8px monospace";
  });
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
const TRUCK_MENU = [{ key: "market", name: "Marked", desc: "Selg fisk · kjøp utstyr · spill", cost: 0 }].concat(LOCATIONS.map((l) => ({ key: l.key, name: l.name, desc: l.desc || "", cost: l.cost || 0 })));
function truckItemRects() {
  const w = 150, h = 24, x = W - 160;
  return TRUCK_MENU.map((it, i) => ({ ...it, x, y: 44 + i * 27, w, h }));
}
function drawTruckMenu() {
  if (!truckMenu) return;
  const rects = truckItemRects();
  const top = rects[0].y - 18, bot = rects[rects.length - 1].y + 18 + 5;
  const x = rects[0].x - 5, w = rects[0].w + 10;
  px(x, top, w, bot - top, "rgba(14,12,22,0.94)");
  px(x, top, w, 3, "#d24a3a");
  ctx.fillStyle = "#ffd6a0"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("HVOR SKAL VI?", x + w / 2, top + 9);
  for (const it of rects) {
    const here = it.key === save.location;
    const locked = it.key !== "market" && !(save.unlocked || []).includes(it.key);
    const afford = save.money >= it.cost;
    px(it.x, it.y, it.w, it.h, here ? "#2a3a2a" : (locked ? "#1c1622" : "#241c30"));
    px(it.x, it.y, it.w, 1, "#3a2e4a");
    ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.font = "9px monospace";
    ctx.fillStyle = it.key === "market" ? "#ffe6a0" : (here ? "#9affc0" : (locked ? "#8a7a6a" : "#f0e6d0"));
    ctx.fillText((it.key === "market" ? "» " : locked ? "🔒 " : "  ") + it.name, it.x + 7, it.y + 8);
    if (it.desc) { ctx.fillStyle = "#9aa6b8"; ctx.font = "7px monospace"; ctx.fillText(it.desc, it.x + 9, it.y + 17); }
    ctx.textAlign = "right";
    if (here) { ctx.fillStyle = "#9affc0"; ctx.font = "8px monospace"; ctx.fillText("her", it.x + it.w - 6, it.y + 8); }
    else if (locked) { ctx.fillStyle = afford ? "#ffe6a0" : "#a06a6a"; ctx.font = "8px monospace"; ctx.fillText(fmt(it.cost) + " kr", it.x + it.w - 6, it.y + 8); }
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function drawParkedTruck() {
  const r = TRUCK, x = r.x, y = r.y;
  // small earthy tyre-track patch so it reads as parked on the bank (not floating)
  ctx.fillStyle = "#241a10";
  ctx.beginPath(); ctx.ellipse(x + r.w / 2, y + r.h, r.w / 2 - 1, 3, 0, 0, 6.28); ctx.fill();
  // body (side view, cab to the left)
  px(x + 3, y + 11, r.w - 5, 10, "#b23a2a");   // bed
  px(x + 3, y + 4, 18, 10, "#c64636");         // cab
  px(x + 6, y + 6, 11, 6, "#bfe6ef");          // window
  px(x + 3, y + 19, r.w - 5, 3, "#7a241c");    // chassis shadow
  // wheels
  px(x + 8, y + 20, 6, 5, "#1a1a1a"); px(x + 10, y + 22, 2, 2, "#555");
  px(x + r.w - 12, y + 20, 6, 5, "#1a1a1a"); px(x + r.w - 10, y + 22, 2, 2, "#555");
  // headlight
  px(x + 2, y + 9, 2, 3, "#ffe9a0");
  // rod sticking out of the bed
  ctx.strokeStyle = "#caa97a"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + r.w - 5, y + 11); ctx.lineTo(x + r.w + 3, y - 2); ctx.stroke();
}
function drawInspector() {
  if (!inspector.active) return;
  const x = inspector.x, y = 112;
  const walk = inspector.phase === "in" || inspector.phase === "out";
  const step = walk ? Math.sin(t * 10) * 2 : 0;
  // legs
  px(x - 3, y + 18, 3, 8 + step, "#2a3a2a"); px(x + 1, y + 18, 3, 8 - step, "#2a3a2a");
  // body / uniform
  px(x - 5, y + 4, 11, 15, "#3a5a3a"); px(x - 5, y + 4, 11, 3, "#4a6a4a");
  px(x - 1, y + 7, 2, 9, "#caa84a");              // button strip
  // arms + clipboard
  px(x - 8, y + 6, 3, 11, "#3a5a3a"); px(x + 6, y + 6, 3, 9, "#3a5a3a");
  px(x + 7, y + 12, 6, 7, "#d8d2c0"); px(x + 8, y + 13, 4, 1, "#6a6a6a"); px(x + 8, y + 15, 4, 1, "#6a6a6a");
  // head + cap
  px(x - 4, y - 5, 9, 9, "#e8c098"); px(x - 4, y + 2, 9, 2, "#d2a07c");
  px(x - 5, y - 7, 11, 3, "#243a24"); px(x - 6, y - 5, 6, 2, "#243a24");
  px(x - 2, y - 1, 5, 1, "#1a1a1a");
  // speech bubble while checking
  if (inspector.phase === "check" && inspector.line) {
    const bw = 154, bx = x + 14, by = y - 18;
    px(bx, by, bw, 18, "rgba(14,12,22,0.95)");
    px(bx, by, bw, 2, inspector.fined ? "#d24a3a" : "#7dffb0");
    ctx.font = "7px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#9aa6d0"; ctx.fillText("Fiskeoppsynet:", bx + 4, by + 6);
    ctx.fillStyle = inspector.fined ? "#ffb0a0" : "#dfe6ff"; ctx.fillText(inspector.line, bx + 4, by + 13);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
}
// Visual actor for a random event — a little animated sprite acting out the happening.
// p = lifecycle 0..1; ea = fade alpha; dir = travel direction; sd = per-event random seed.
function drawEventActor() {
  if (!gameEvent.active || !gameEvent.sprite) return;
  const p = clamp(gameEvent.t / gameEvent.dur, 0, 1);
  const ea = Math.min(clamp(gameEvent.t / 0.5, 0, 1), clamp((gameEvent.dur - gameEvent.t) / 0.8, 0, 1));
  const dir = gameEvent.dir || 1, sd = gameEvent.seed || 0;
  const cross = dir > 0 ? -24 + p * (W + 48) : W + 24 - p * (W + 48); // left↔right crossing x
  ctx.save();
  ctx.globalAlpha = ea;
  switch (gameEvent.sprite) {
    case "squirrel": {
      // scampers along the treeline, hopping, bushy tail flicking
      const x = cross, hop = Math.abs(Math.sin(t * 9)) * 5, y = 128 - hop;
      ctx.save(); if (dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
      px(x - 4, y, 8, 5, "#a8702f"); px(x - 4, y, 8, 1, "#c08a45");      // body
      px(x + 3, y - 4, 5, 5, "#a8702f"); px(x + 6, y - 6, 2, 2, "#a8702f"); // head + ear
      px(x + 6, y - 2, 1, 1, "#1a1208");                                  // eye
      // big curling tail
      ctx.strokeStyle = "#9a6428"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 3, y + 2); ctx.quadraticCurveTo(x - 12, y - 2, x - 8, y - 9); ctx.stroke();
      px(x - 3, y + 4, 2, 2, "#7a4e20"); px(x + 1, y + 4, 2, 2, "#7a4e20"); // legs
      ctx.restore();
      break;
    }
    case "hiker": {
      // a rambler at the far bank, waving an arm
      const x = 372, y = 116, wave = Math.sin(t * 6) * 4;
      px(x - 4, y, 8, 12, "#3a6a4a"); px(x - 4, y, 8, 2, "#4a7a5a");       // jacket
      px(x - 5, y + 1, 3, 9, "#7a5a3a");                                   // backpack
      px(x - 3, y + 12, 3, 7, "#2a3a2a"); px(x + 1, y + 12, 3, 7, "#2a3a2a"); // legs
      px(x - 3, y - 7, 7, 7, "#e8c098"); px(x - 4, y - 9, 9, 3, "#b23a2a"); // head + cap
      ctx.strokeStyle = "#3a6a4a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 3, y + 2); ctx.lineTo(x + 8, y - 6 + wave); ctx.stroke(); // waving arm
      px(x + 7, y - 8 + wave, 2, 2, "#e8c098");
      ctx.globalAlpha = ea * (0.5 + 0.5 * Math.sin(t * 5)); px(x - 12, y - 12, 2, 6, "#ffe6a0"); // little "!" hint
      break;
    }
    case "bottle": {
      // a corked bottle bobbing on the water near the float, then a sparkle as you fish it up
      const x = clamp(bobber.x + 20, 120, W - 30), y = WATER_Y + 8 + Math.sin(t * 2 + sd) * 1.5;
      addRippleMaybe(x, y);
      px(x - 2, y - 6, 4, 10, "#5a8a6a"); px(x - 1, y - 6, 1, 10, "#7aa888"); // glass
      px(x - 1, y - 9, 2, 3, "#caa07a");                                       // cork
      px(x - 2, y - 2, 4, 3, "#e8e0c0");                                       // paper note inside
      if (p > 0.55) { sparkle(x, y - 2, t); }
      break;
    }
    case "berries": {
      // a raspberry bush on the bank, glistening
      const x = 30, y = 210;
      ctx.fillStyle = "#2c4a22"; for (const [ox, oy] of [[0, 0], [-5, 2], [5, 2], [-2, -4], [3, -3]]) { ctx.beginPath(); ctx.arc(x + ox, y + oy, 4, 0, 6.28); ctx.fill(); }
      for (const [ox, oy] of [[-3, 1], [4, 2], [0, -2], [-5, 4], [3, 5]]) px(x + ox, y + oy, 2, 2, "#d23a5a");
      sparkle(x + Math.sin(t * 2) * 4, y - 4, t * 1.3);
      break;
    }
    case "reindeer": {
      // a reindeer at the far shore dipping its head to drink
      const x = 366, y = 150, dip = (Math.sin(t * 1.6) * 0.5 + 0.5) * 8;
      px(x - 2, y + 4, 3, 9, "#6a4a32"); px(x + 6, y + 4, 3, 9, "#6a4a32"); // legs in shallows
      px(x - 4, y - 4, 14, 9, "#7a5436"); px(x - 4, y - 4, 14, 2, "#8a6442"); // body
      const hx = x + 11, hy = y - 6 + dip;                                    // head dips
      px(hx, hy, 6, 6, "#7a5436"); px(hx + 4, hy + 3, 3, 2, "#5a3e28");       // head + muzzle
      px(hx + 1, hy + 1, 1, 1, "#1a1208");                                    // eye
      ctx.strokeStyle = "#caa07a"; ctx.lineWidth = 1;                         // antlers
      ctx.beginPath(); ctx.moveTo(hx + 1, hy); ctx.lineTo(hx - 2, hy - 7); ctx.lineTo(hx - 5, hy - 6); ctx.moveTo(hx - 2, hy - 7); ctx.lineTo(hx, hy - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx + 4, hy); ctx.lineTo(hx + 7, hy - 7); ctx.lineTo(hx + 10, hy - 6); ctx.stroke();
      if (dip > 6) addRippleMaybe(hx + 3, y + 2);
      break;
    }
    case "wind": {
      // gusts sweeping across the surface, carrying flecks
      ctx.strokeStyle = "rgba(220,235,255,0.5)"; ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const yy = 138 + i * 6, ph = (t * 2 + i * 0.7) % 1, xx = dir > 0 ? ph * (W + 40) - 20 : W + 20 - ph * (W + 40);
        ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + dir * 14, yy - 4, xx + dir * 26, yy); ctx.stroke();
        ctx.globalAlpha = ea * 0.7; px(xx + dir * 26, yy - 1, 2, 2, "#eaf2ff"); ctx.globalAlpha = ea;
      }
      break;
    }
    case "climber": {
      // a tiny climber up on the mountain, waving, then a coin glints down into the water
      const x = 392, y = 78, wave = Math.sin(t * 6) * 3;
      px(x - 2, y, 4, 6, "#b23a2a"); px(x - 2, y + 6, 2, 4, "#2a3a4a"); px(x, y + 6, 2, 4, "#2a3a4a");
      px(x - 2, y - 4, 4, 4, "#e8c098");
      ctx.strokeStyle = "#b23a2a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 4, y - 4 + wave); ctx.stroke();
      if (p > 0.4) { const cy = lerp(86, WATER_Y, clamp((p - 0.4) / 0.5, 0, 1)); sparkle(x - 30, cy, t * 2); } // coin falling
      break;
    }
    case "avalanche": {
      // puffs of snow tumbling down the mountainside
      for (let i = 0; i < 7; i++) {
        const ph = (p + i * 0.13) % 1, xx = 360 + i * 6 - ph * 40, yy = 70 + ph * 70 + Math.sin(i) * 4;
        ctx.globalAlpha = ea * (1 - ph) * 0.9; ctx.fillStyle = "#eef4ff"; ctx.beginPath(); ctx.arc(xx, yy, 3 + ph * 4, 0, 6.28); ctx.fill();
      }
      ctx.globalAlpha = ea;
      break;
    }
    case "log": {
      // a big log drifting across the surface, pushing a wake
      const x = cross, y = WATER_Y + 7 + Math.sin(t * 2) * 1;
      ctx.save(); if (dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
      px(x - 20, y - 3, 40, 7, "#6a4628"); px(x - 20, y - 3, 40, 2, "#7d5736");
      px(x - 20, y - 3, 4, 7, "#4a2e18"); px(x + 16, y - 3, 4, 7, "#8a6a45"); // dark / cut end
      px(x + 17, y - 2, 2, 2, "#a8855a"); px(x + 17, y, 2, 1, "#7d5736");      // end rings
      ctx.restore();
      for (let i = 0; i < 3; i++) { ctx.globalAlpha = ea * 0.4; ctx.strokeStyle = "#b9c8ff"; ctx.beginPath(); ctx.ellipse(x - dir * 22, y + 3, 10 + i * 5, 3, 0, 0, 6.28); ctx.stroke(); }
      ctx.globalAlpha = ea;
      break;
    }
    case "kayak": {
      // a paddler zipping across, paddle dipping side to side
      const x = cross, y = WATER_Y + 6 + Math.sin(t * 3) * 1, pad = Math.sin(t * 8);
      ctx.save(); if (dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
      px(x - 12, y, 24, 5, "#d24a3a"); px(x - 12, y, 24, 2, "#e86a54");        // hull
      px(x - 2, y - 7, 5, 7, "#ffd84a"); px(x - 1, y - 11, 3, 4, "#e8c098");   // torso + head
      ctx.strokeStyle = "#caa07a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 8, y - 8 + pad * 3); ctx.lineTo(x + 8, y - 4 - pad * 3); ctx.stroke();
      px(x - 9, y - 9 + pad * 3, 3, 2, "#3a6a8a"); px(x + 7, y - 5 - pad * 3, 3, 2, "#3a6a8a"); // blades
      ctx.restore();
      addRippleMaybe(x - dir * 12, y + 3);
      break;
    }
    case "goldpan": {
      // gold flecks glinting in the shallows near shore
      const x = 104, y = 159;
      ctx.fillStyle = "#3a2a18"; ctx.beginPath(); ctx.ellipse(x, y, 9, 4, 0, 0, 6.28); ctx.fill(); // pan
      ctx.strokeStyle = "#5a4226"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 9, 4, 0, 0, 6.28); ctx.stroke();
      for (let i = 0; i < 4; i++) sparkle(x - 5 + i * 3, y - 1 + Math.sin(t * 2 + i) * 1, t * 1.5 + i);
      break;
    }
    case "fossegrim": {
      // a mystic figure by the falls playing a fiddle, notes drifting up
      const x = 408, y = 128, bow = Math.sin(t * 7) * 4;
      px(x - 4, y, 8, 12, "#2a4a5a"); px(x - 3, y + 12, 3, 6, "#1a2a3a"); px(x + 1, y + 12, 3, 6, "#1a2a3a");
      px(x - 3, y - 6, 7, 7, "#cfe6e0"); ctx.globalAlpha = ea * 0.6; px(x - 5, y - 2, 11, 14, "#aef0e0"); ctx.globalAlpha = ea; // glow
      px(x - 6, y + 2, 4, 5, "#8a5a2a"); // fiddle
      ctx.strokeStyle = "#e8e0c0"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 7, y + 1); ctx.lineTo(x - 2, y + 7 + bow); ctx.stroke();
      for (let i = 0; i < 3; i++) { const ny = y - 6 - ((t * 14 + i * 12) % 36); ctx.globalAlpha = ea * Math.max(0, 1 - ((t * 14 + i * 12) % 36) / 36); ctx.fillStyle = "#b0ffe6"; ctx.font = "9px monospace"; ctx.fillText("\u266a", x + 6 + Math.sin(ny) * 3, ny); }
      ctx.globalAlpha = ea;
      break;
    }
    case "wisp": {
      // a will-o'-the-wisp drifting in a wavy path with a soft halo
      const x = cross, y = 132 + Math.sin(t * 2 + sd) * 14;
      const g = ctx.createRadialGradient(x, y, 1, x, y, 14); g.addColorStop(0, "rgba(170,255,200,0.9)"); g.addColorStop(1, "rgba(170,255,200,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 14, 0, 6.28); ctx.fill();
      px(x - 1, y - 1, 3, 3, "#e6fff0");
      for (let i = 0; i < 4; i++) { ctx.globalAlpha = ea * (1 - i / 4) * 0.5; px(x - dir * i * 4, y + Math.sin(t * 2 + i) * 3, 2, 2, "#aaffd0"); }
      ctx.globalAlpha = ea;
      break;
    }
    case "troll": {
      // a lumpy bog troll rising at the treeline, then sinking back
      const rise = Math.sin(p * Math.PI) * 26, x = 350, y = 150 - rise;
      px(x - 12, y - 18, 26, 26, "#5a6a48"); px(x - 12, y - 18, 26, 3, "#6a7a56"); // hulking body
      px(x - 8, y - 28, 18, 12, "#5a6a48");                                        // head
      px(x + 2, y - 22, 6, 6, "#7a8a64"); px(x + 4, y - 18, 3, 4, "#4a5a3a");       // big nose
      px(x - 5, y - 24, 3, 3, "#caa84a"); px(x + 5, y - 24, 3, 3, "#caa84a");       // glowing eyes
      px(x - 6, y - 23, 1, 1, "#1a1208"); px(x + 6, y - 23, 1, 1, "#1a1208");
      px(x - 4, y - 14, 8, 1, "#2a3a1a");                                           // grumpy mouth
      px(x - 9, y - 30, 3, 4, "#4a3a22"); px(x + 6, y - 30, 3, 4, "#4a3a22");       // mossy tufts
      break;
    }
    case "bubble": {
      // a fat marsh-gas bubble rising and popping at the surface
      const rise = clamp(p / 0.7, 0, 1), x = clamp(bobber.x, 140, W - 40), y = lerp(WATER_Y + 22, WATER_Y + 2, rise), r = 3 + rise * 4;
      if (p < 0.72) { ctx.globalAlpha = ea * 0.7; ctx.fillStyle = "#9abf6a"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); ctx.globalAlpha = ea * 0.9; px(x - 1, y - 1, 1, 1, "#d8f0a0"); }
      else { for (let i = 0; i < 6; i++) { const a2 = i / 6 * 6.28; ctx.globalAlpha = ea * (1 - (p - 0.72) / 0.28); px(x + Math.cos(a2) * (r + (p - 0.72) * 40), y + Math.sin(a2) * (r + (p - 0.72) * 30), 2, 2, "#c8e89a"); } }
      ctx.globalAlpha = ea; addRippleMaybe(x, WATER_Y + 2);
      break;
    }
    case "coins": {
      // old silver coins glinting in the mud by the shore
      const x = 98, y = 161;
      for (const [ox, oy] of [[0, 0], [4, 2], [-3, 3], [2, 5]]) { px(x + ox, y + oy, 3, 3, "#cfd6dd"); px(x + ox, y + oy, 3, 1, "#eef2f6"); }
      sparkle(x + 1 + Math.sin(t * 2) * 3, y, t * 1.7);
      break;
    }
    case "moose": {
      // the cheeky moose wading in and slurping at the water
      const x = 338, y = 150, dip = (Math.sin(t * 1.4) * 0.5 + 0.5) * 9;
      px(x - 3, y + 3, 4, 11, "#4a3422"); px(x + 8, y + 3, 4, 11, "#4a3422"); // legs in water
      px(x - 6, y - 8, 20, 12, "#5a3e26"); px(x - 6, y - 8, 20, 2, "#6a4a30"); // body
      const hx = x + 13, hy = y - 8 + dip;
      px(hx, hy, 8, 7, "#5a3e26"); px(hx + 5, hy + 3, 4, 3, "#3a2818");        // head + muzzle
      px(hx + 2, hy + 1, 1, 1, "#1a1208");
      px(hx - 4, hy - 4, 6, 3, "#7a5a3a"); px(hx + 6, hy - 4, 6, 3, "#7a5a3a"); // palmate antlers
      if (dip > 7) { addRippleMaybe(hx + 4, y + 2); }
      break;
    }
    case "picnic": {
      // a little family on a checked blanket on the bank, waving
      const x = 36, y = 220, wave = Math.sin(t * 5) * 3;
      for (let i = 0; i < 5; i++) px(x - 8 + i * 4, y, 4, 4, i % 2 ? "#e8e0d0" : "#d23a3a"); // blanket
      px(x - 6, y - 8, 5, 8, "#3a6a8a"); px(x - 5, y - 12, 3, 4, "#e8c098");   // grown-up
      px(x + 2, y - 6, 4, 6, "#caa23a"); px(x + 3, y - 9, 3, 3, "#e8c098");    // child
      ctx.strokeStyle = "#3a6a8a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 2, y - 6); ctx.lineTo(x - 5, y - 11 + wave); ctx.stroke(); // wave
      px(x + 8, y - 5, 3, 2, "#f0d8a0"); // a waffle
      break;
    }
    case "beaver": {
      // a beaver swimming across, then a big tail-slap splash
      const x = cross, y = WATER_Y + 6, slap = p > 0.45 && p < 0.6;
      ctx.save(); if (dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
      px(x - 7, y - 2, 13, 5, "#6a4a2a"); px(x - 7, y - 2, 13, 2, "#7d5736");  // body
      px(x + 5, y - 5, 5, 5, "#5a3e22"); px(x + 8, y - 3, 1, 1, "#1a1208");    // head
      px(x - 10, y - 1, 4, 3, "#4a3018");                                      // flat tail
      ctx.restore();
      if (slap) { for (let i = 0; i < 8; i++) { const a2 = -1 + i * 0.3; ctx.globalAlpha = ea; px(x - dir * 9 + Math.cos(a2) * 10, y + 2 - Math.abs(Math.sin(a2)) * 12, 2, 2, "#cfe0ff"); } addRippleMaybe(x - dir * 9, y + 3); }
      ctx.globalAlpha = ea;
      break;
    }
    case "lure": {
      // a fancy spinner glinting on the surface near the float
      const x = clamp(bobber.x - 16, 130, W - 30), y = WATER_Y + 6 + Math.sin(t * 2) * 1;
      px(x - 2, y - 2, 4, 5, "#caa23a"); px(x - 1, y - 2, 1, 5, "#ffe6a0");    // body
      px(x - 1, y + 3, 2, 2, "#d24a3a");                                       // hook feather
      sparkle(x, y - 2, t * 2.2);
      break;
    }
    case "wish": {
      // a bright shooting star arcing across the sky with a sparkle trail
      const sx = lerp(W - 40, 60, p), sy = lerp(28, 70, p);
      ctx.strokeStyle = "rgba(200,240,255,0.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 22, sy - 10); ctx.stroke();
      px(sx - 1, sy - 1, 3, 3, "#ffffff"); sparkle(sx, sy, t * 3);
      for (let i = 1; i < 5; i++) { ctx.globalAlpha = ea * (1 - i / 5); px(sx + i * 5, sy - i * 2, 2, 2, "#b0ffe6"); }
      ctx.globalAlpha = ea;
      break;
    }
    case "auroraflare": {
      // the aurora surges — extra bright green curtains across the top
      ctx.globalAlpha = ea * (0.25 + 0.2 * Math.sin(t * 3));
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = ["#7dffb0", "#5ad0ff", "#aef0a0"][i];
        ctx.beginPath(); ctx.moveTo(0, 30 + i * 6);
        for (let xx = 0; xx <= W; xx += 16) ctx.lineTo(xx, 30 + i * 6 + Math.sin(xx * 0.02 + t * 1.5 + i) * 12);
        ctx.lineTo(W, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = ea;
      break;
    }
    case "gnome": {
      // a tiny red-capped gnome on the bank, leaving a coin behind
      const x = 100, y = 158, bob = Math.sin(t * 3) * 1;
      px(x - 3, y - 6 + bob, 6, 6, "#3a5a7a"); px(x - 3, y, 2, 3, "#3a2a1a"); px(x + 1, y, 2, 3, "#3a2a1a"); // body + boots
      px(x - 2, y - 9 + bob, 4, 3, "#f0d8c0"); px(x - 2, y - 4 + bob, 4, 2, "#e8e0d0");                       // face + beard
      ctx.fillStyle = "#c83a2a"; ctx.beginPath(); ctx.moveTo(x - 3, y - 9 + bob); ctx.lineTo(x + 3, y - 9 + bob); ctx.lineTo(x + 1, y - 15 + bob); ctx.closePath(); ctx.fill(); // pointed cap
      if (p > 0.5) { px(x + 6, y + 2, 3, 3, "#ffd84a"); sparkle(x + 7, y + 1, t * 2); }
      break;
    }
    case "frost": {
      // biting cold — frost creeps in at the edges and crystals drift
      ctx.globalAlpha = ea * 0.5;
      const fg = ctx.createLinearGradient(0, 0, 0, H); fg.addColorStop(0, "rgba(180,215,255,0.35)"); fg.addColorStop(0.5, "rgba(180,215,255,0)"); fg.addColorStop(1, "rgba(180,215,255,0.3)");
      ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = ea;
      for (let i = 0; i < 12; i++) { const fx = (i * 53 + t * 8) % W, fy = (i * 37 + t * 18) % H; ctx.globalAlpha = ea * 0.8; px(fx, fy, 1, 1, "#eaf4ff"); px(fx, fy - 1, 1, 3, "#cfe6ff"); px(fx - 1, fy, 3, 1, "#cfe6ff"); }
      ctx.globalAlpha = ea;
      break;
    }
  }
  ctx.restore();
}
function addRippleMaybe(x, y) { if (Math.random() < 0.08) addRipple(x, y, 10); }
function sparkle(x, y, ph) {
  const s = 0.5 + 0.5 * Math.sin(ph * 3), prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * (0.4 + s * 0.6);
  px(x, y - 2, 1, 5, "#fff4c0"); px(x - 2, y, 5, 1, "#fff4c0"); px(x, y, 1, 1, "#ffffff");
  ctx.globalAlpha = prev;
}
function drawGameEvent() {
  if (!gameEvent.active) return;
  const k = gameEvent.t;
  const a = Math.min(clamp(k / 0.4, 0, 1), clamp((gameEvent.dur - k) / 0.6, 0, 1));
  const w = 246, x = (W - w) / 2, y = 7;
  ctx.globalAlpha = a;
  px(x, y, w, 24, "rgba(14,12,22,0.9)"); px(x, y, w, 2, gameEvent.color); px(x, y, 3, 24, gameEvent.color);
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = gameEvent.color; ctx.font = "8px monospace"; ctx.fillText(gameEvent.title, x + 9, y + 8);
  ctx.fillStyle = "#dfe6ff"; ctx.font = "7px monospace"; ctx.fillText(gameEvent.line, x + 9, y + 17);
  ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function drawGroundFish() {
  // when the catch piles up, a heap of fish lies on the grassy bank beside you (on land, not in the water)
  const n = save.basket.length;
  if (n < 5) return;
  const count = clamp(Math.floor((n - 3) / 3), 0, 7);
  // a little tuft of grass under the pile so it clearly reads as resting on land
  const cx = 40, cy = 226;
  ctx.fillStyle = "#16261c"; ctx.beginPath(); ctx.ellipse(cx + 4, cy + 4, 22, 6, 0, 0, 6.28); ctx.fill();
  // stack them in overlapping rows forming a mound (bottom row widest)
  const layout = [
    [-16, 2, 1, false], [-2, 4, -1, true], [12, 2, 1, false],   // base row
    [-9, -3, 1, true], [5, -2, -1, false],                       // middle row
    [-2, -8, 1, false], [9, -7, -1, true],                       // top
  ];
  for (let i = 0; i < count; i++) {
    const [dx, dy, dir, silver] = layout[i];
    const gx = cx + dx, gy = cy + dy;
    ctx.save(); ctx.translate(gx, gy); ctx.scale(dir, 1);
    px(-1, 2, 2, 1, "rgba(10,16,10,0.4)");                     // contact shadow
    px(0, 0, 10, 4, silver ? "#aeb8c2" : "#cf9a4a");           // body
    px(1, -1, 7, 1, silver ? "#cfd6dd" : "#e0b46a");           // top highlight
    px(1, 4, 7, 1, silver ? "#7e8893" : "#9a6a2a");            // belly shade
    px(10, -1, 3, 6, silver ? "#8e98a3" : "#a87a3a");          // tail
    px(2, 1, 1, 1, "#1a1a1a");                                 // eye
    px(4, 0, 3, 1, silver ? "#c2cbd4" : "#dcab62");            // sheen
    ctx.restore();
  }
}
function drawBuffHud() {
  if (buff.t <= 0) return;
  const w = 104, h = 16, x = 8, y = H - 24;
  const intensity = clamp(buff.luck / 1.4, 0, 1);
  const fillCol = intensity < 0.4 ? "#5fbf5f" : intensity < 0.75 ? "#ffcf5a" : "#ff7a5a";
  px(x, y, w, h, "rgba(14,12,22,0.82)");
  px(x, y, w, 2, fillCol);
  // header: a standard RUS label + current flaks bonus
  ctx.font = "7px monospace"; ctx.textBaseline = "top"; ctx.textAlign = "left";
  ctx.fillStyle = "#f0e6d0"; ctx.fillText(buff.count >= 2 ? "RUS ×" + buff.count : "RUS", x + 4, y + 2);
  ctx.textAlign = "right"; ctx.fillStyle = fillCol; ctx.fillText("+" + Math.round(buff.luck * 100) + "% flaks", x + w - 4, y + 2);
  // the rus meter (intensity) with a thin time-remaining line beneath it
  const barX = x + 4, barW = w - 8;
  px(barX, y + 10, barW, 3, "rgba(255,255,255,0.10)");
  px(barX, y + 10, barW * intensity, 3, fillCol);
  const frac = clamp(buff.t / buff.dur, 0, 1);
  px(barX, y + h - 1, barW * frac, 1, "rgba(255,255,255,0.55)");
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function drawKioskKeeper(x, y) {
  const sway = Math.sin(t * 1.3) * 1; x += sway;
  // apron / body
  px(x - 10, y + 6, 20, 24, "#2f6a4a"); px(x - 10, y + 6, 20, 3, "#3f8a5a");
  px(x - 3, y + 10, 6, 14, "#e8e2d0");
  // arms
  px(x - 13, y + 9, 4, 13, "#e0b48a"); px(x + 9, y + 9, 4, 13, "#e0b48a");
  // head
  px(x - 6, y - 6, 12, 11, "#e8c098"); px(x - 6, y + 4, 12, 2, "#d2a07c");
  // sunglasses
  px(x - 6, y - 2, 12, 1, "#1a1a1a"); px(x - 5, y - 1, 4, 3, "#1a1a1a"); px(x + 1, y - 1, 4, 3, "#1a1a1a");
  // cap
  px(x - 7, y - 10, 14, 4, "#b83a3a"); px(x - 7, y - 7, 14, 1, "#8a2a2a"); px(x + 4, y - 7, 8, 2, "#b83a3a");
  // grin
  px(x - 2, y + 2, 5, 1, "#a85a4a");
  // cigarette + ember + smoke wisp
  px(x + 4, y + 2, 4, 1, "#e8e2d0"); px(x + 8, y + 2, 1, 1, "#ff7a3a");
  ctx.globalAlpha = 0.3 + 0.1 * Math.sin(t * 3); ctx.fillStyle = "#cfcfcf";
  ctx.beginPath(); ctx.arc(x + 9, y - 1 + Math.sin(t * 2), 2, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
}

/* ---- world map ---- */
function drawMapBg() {
  // parchment
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#d8c79a"); g.addColorStop(1, "#c2ad7c"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // seeded paper speckle
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  ctx.fillStyle = "rgba(120,100,70,0.18)";
  for (let i = 0; i < 220; i++) ctx.fillRect((rnd() * W) | 0, (rnd() * H) | 0, 1, 1);
  // border
  ctx.strokeStyle = "#7a6038"; ctx.lineWidth = 3; ctx.strokeRect(8, 8, W - 16, H - 16);
  ctx.strokeStyle = "#9a8050"; ctx.lineWidth = 1; ctx.strokeRect(12, 12, W - 24, H - 24);
  // little water blobs under spots
  ctx.fillStyle = "rgba(90,130,150,0.5)";
  for (const sp of MAP_SPOTS) { ctx.beginPath(); ctx.ellipse(sp.x, sp.y + 2, 22, 12, 0, 0, 6.28); ctx.fill(); }
  // dotted roads connecting spots in order
  ctx.strokeStyle = "#7a5a38"; ctx.setLineDash([3, 4]); ctx.lineWidth = 2;
  ctx.beginPath();
  MAP_SPOTS.forEach((sp, i) => { if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y); });
  ctx.stroke(); ctx.setLineDash([]);
  // markers
  for (const sp of MAP_SPOTS) {
    const loc = LOCATIONS.find((l) => l.key === sp.key);
    const current = LOC.key === sp.key;
    const locked = !(save.unlocked || []).includes(sp.key);
    if (current) { const pr = 14 + Math.sin(t * 4) * 3; ctx.strokeStyle = "rgba(210,70,50,0.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sp.x, sp.y - 12, pr, 0, 6.28); ctx.stroke(); }
    // pin
    ctx.fillStyle = locked ? "#6a6058" : "#c43a2a";
    ctx.beginPath(); ctx.arc(sp.x, sp.y - 12, 7, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.moveTo(sp.x - 5, sp.y - 8); ctx.lineTo(sp.x + 5, sp.y - 8); ctx.lineTo(sp.x, sp.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f0d8b0"; ctx.beginPath(); ctx.arc(sp.x, sp.y - 12, 3, 0, 6.28); ctx.fill();
    // label
    ctx.fillStyle = "#3a2c18"; ctx.font = "8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(loc.name, sp.x, sp.y + 6);
    if (current) { ctx.fillStyle = "#2a6a3a"; ctx.fillText("(her)", sp.x, sp.y + 16); }
    else if (locked) {
      const afford = save.money >= loc.cost;
      ctx.fillStyle = afford ? "#7a5a2a" : "#9a4030";
      ctx.fillText("🔒 " + fmt(loc.cost) + " kr", sp.x, sp.y + 16);
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
}

/* ---- travel: red pickup driving to the next spot ---- */
function drawPickup(x, y) {
  const bob = Math.sin(t * 18) * 1.5;
  y += bob;
  // bed
  px(x - 26, y - 8, 24, 12, "#b8302a"); px(x - 26, y - 8, 24, 2, "#d24a3a");
  px(x - 24, y - 6, 20, 8, "#8a221c"); // cargo shadow
  // rods sticking out the back
  ctx.strokeStyle = "#caa97a"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 24, y - 6); ctx.lineTo(x - 40, y - 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 22, y - 6); ctx.lineTo(x - 38, y - 16); ctx.stroke();
  // cab
  px(x - 4, y - 16, 18, 20, "#c43a2a"); px(x - 4, y - 16, 18, 3, "#e05a44");
  px(x, y - 13, 12, 8, "#a8d4e0"); // window
  px(x + 1, y - 12, 5, 6, "#c8e8f0");
  // bumper + headlight
  px(x + 14, y - 2, 3, 6, "#d8d8d8"); px(x + 16, y - 1, 2, 3, "#fff2a0");
  const gg = ctx.createRadialGradient(x + 20, y, 1, x + 20, y, 22); gg.addColorStop(0, "rgba(255,240,150,0.5)"); gg.addColorStop(1, "rgba(255,240,150,0)"); ctx.fillStyle = gg; ctx.fillRect(x + 8, y - 14, 40, 30);
  // wheels
  const wsp = t * 22;
  for (const wx of [x - 18, x + 8]) {
    ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(wx, y + 5, 5, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#6a6a6a"; ctx.beginPath(); ctx.arc(wx, y + 5, 2, 0, 6.28); ctx.fill();
    ctx.strokeStyle = "#9a9a9a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(wx + Math.cos(wsp) * 4, y + 5 + Math.sin(wsp) * 4); ctx.lineTo(wx - Math.cos(wsp) * 4, y + 5 - Math.sin(wsp) * 4); ctx.stroke();
  }
}
function drawTravelBg() {
  const p = clamp(travel.t / travel.dur, 0, 1);
  // dusk sky
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2a2348"); g.addColorStop(0.6, "#5a4a6a"); g.addColorStop(1, "#b07a5a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawStars();
  // scrolling hills
  const scroll = t * 90;
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? "#3a3050" : "#2a2440";
    const base = 150 + layer * 14, amp = 18 - layer * 6, off = (scroll * (layer ? 1 : 0.6)) % 80;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = -80; x <= W + 80; x += 40) { const hx = x - off; ctx.lineTo(hx, base + Math.sin((x) * 0.05) * amp); }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
  }
  // road
  ctx.fillStyle = "#3a3038"; ctx.fillRect(0, 196, W, H - 196);
  ctx.fillStyle = "#2a2228"; ctx.fillRect(0, 196, W, 3);
  // dashes
  ctx.fillStyle = "#d8c060";
  const doff = (scroll * 2) % 48;
  for (let x = -48; x < W + 48; x += 48) ctx.fillRect(x - doff, 214, 22, 3);
  // dust
  ctx.globalAlpha = 0.4; ctx.fillStyle = "#caa";
  for (let i = 0; i < 8; i++) { const dx = (220 - i * 12 - (t * 60) % 30); ctx.beginPath(); ctx.arc(dx, 205 + Math.sin(t * 6 + i) * 3, 2 + i * 0.4, 0, 6.28); ctx.fill(); }
  ctx.globalAlpha = 1;
  // the truck (sits mid-screen, world scrolls past)
  drawPickup(W / 2 + 30, 196);
  // progress bar + destination
  ctx.fillStyle = "rgba(10,8,16,0.6)"; ctx.fillRect(120, 30, 240, 22);
  ctx.fillStyle = "#e6d8a8"; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("Kj\u00f8rer til " + travel.toName + "\u2026", W / 2, 36);
  ctx.fillStyle = "#3a2f1a"; ctx.fillRect(135, 44, 210, 4);
  ctx.fillStyle = "#c43a2a"; ctx.fillRect(135, 44, 210 * p, 4);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}

/* =========================================================================
   Opening cinematic — "Jeg er en fattig bonddreng" (one-time, first launch)
   ========================================================================= */
function startIntro() {
  intro = { t: 0, running: false, enginePlayed: false, rodSfx: false };
  screen = "intro";
  OVERLAYS.forEach((o) => $(o).classList.remove("active"));
  hudEl.classList.add("hidden");
  reelEl.classList.add("hidden"); catchEl.classList.add("hidden"); hintEl.classList.add("hidden");
}
function startIntroPlayback() {
  if (intro.running) return;
  ensureAudio();
  intro.running = true; intro.t = 0;
  save.seenIntro = true; persist();   // only mark seen once the player actually starts it
  startIntroMusic();
}
function endIntro() {
  stopIntroMusic(); stopEngine();
  setScreen("menu");
}
// the cosy folk tune the player dropped in (lyder/intro-music.mp3)
let introMusicNode = null;
function startIntroMusic() {
  stopIntroMusic();
  introMusicNode = playSample("introMusic", { vol: 0.9, loop: true });
}
function stopIntroMusic() {
  if (introMusicNode) { stopSample(introMusicNode); introMusicNode = null; }
}
function introTruckX(tt) { if (tt < IN.driveS) return 372; const dx = tt - IN.driveS; return 372 + 10 * dx * dx; }
function drawFarmhouse() {
  // red plank walls
  px(6, 138, 96, 68, "#a8392e"); px(6, 138, 96, 3, "#bd4a3b");
  for (let yy = 144; yy < 206; yy += 6) px(8, yy, 92, 1, "#8e2d24");
  // dark overhanging roof
  ctx.fillStyle = "#3a2c26"; ctx.beginPath(); ctx.moveTo(-2, 141); ctx.lineTo(54, 110); ctx.lineTo(110, 141); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#4a3a32"; ctx.beginPath(); ctx.moveTo(-2, 141); ctx.lineTo(54, 110); ctx.lineTo(54, 114); ctx.lineTo(0, 144); ctx.closePath(); ctx.fill();
  // chimney + drifting smoke
  px(74, 106, 8, 16, "#6e3a30"); px(74, 106, 8, 3, "#7e463a");
  for (let i = 0; i < 4; i++) { const a = 0.5 - i * 0.1; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = "#d8d2c8"; ctx.beginPath(); ctx.arc(78 + Math.sin(t * 0.8 + i) * 3, 100 - i * 7 - (t * 8) % 7, 3 + i, 0, 6.28); ctx.fill(); }
  ctx.globalAlpha = 1;
  // window with white frame
  px(20, 152, 20, 18, "#e8efe0"); px(22, 154, 16, 14, "#9ed2e0"); px(29, 154, 1, 14, "#e8efe0"); px(22, 160, 16, 1, "#e8efe0");
  // door
  px(68, 166, 18, 40, "#5a3a24"); px(68, 166, 18, 2, "#6e4a30"); px(82, 186, 2, 2, "#caa84a");
}
// a calm little cottage garden: a low fence, flowers and a watering can —
// cosy rather than a busy barnyard (the cat is the star now)
function drawGarden(tt) {
  // back fence along the yard
  ctx.fillStyle = "#6a4a2c";
  for (let fx = 110; fx <= 300; fx += 18) { px(fx, 196, 2, 14, "#5a3e24"); }
  px(110, 199, 192, 2, "#6a4a2c"); px(110, 205, 192, 2, "#5a3e24");
  // scattered flowers in the grass
  const flowerCols = ["#f0c0d0", "#ffe6a0", "#c0a8f0", "#ffffff"];
  for (let i = 0; i < 14; i++) {
    const fx = 112 + (i * 53) % 250, fy = 216 + (i * 29) % 22;
    px(fx, fy, 1, 3, "#2c4a1e"); px(fx - 1, fy - 1, 3, 1, flowerCols[i % 4]); px(fx, fy - 2, 1, 1, flowerCols[i % 4]); px(fx, fy - 1, 1, 1, "#ffe6a0");
  }
  // a tin watering can resting in the grass
  const wcx = 322, wcy = 224;
  px(wcx - 7, wcy - 7, 12, 9, "#7fa6b0"); px(wcx - 7, wcy - 7, 12, 2, "#9cc2cc");
  px(wcx + 5, wcy - 5, 6, 2, "#7fa6b0"); px(wcx + 10, wcy - 6, 2, 4, "#9cc2cc"); // spout
  ctx.strokeStyle = "#9cc2cc"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(wcx - 1, wcy - 9, 4, 3.4, 6.1); ctx.stroke(); // handle
  // a small flower pot by the fence
  px(124, 198, 7, 7, "#a85a3a"); px(124, 198, 7, 2, "#c47049");
  px(126, 192, 1, 5, "#2c4a1e"); px(125, 191, 3, 1, "#f0c0d0"); px(129, 192, 1, 4, "#2c4a1e"); px(128, 191, 3, 1, "#ffe6a0");
}
// Findus-style tabby cat that trots after the farm boy and hops into the truck
function drawIntroCat(tt) {
  // follow the boy with a little lag, then leap up into the truck bed
  let cx, cy = 204, walking = true, jump = 0;
  if (tt < IN.walkStart) { cx = 78; walking = false; }
  else if (tt < IN.walkEnd) { cx = lerp(78, 300, clamp((tt - IN.walkStart - 0.5) / (IN.walkEnd - IN.walkStart), 0, 1)); }
  else if (tt < IN.climbS) { cx = 300; walking = false; }
  else if (tt < IN.climbE + 0.3) { const k = clamp((tt - IN.climbS) / (IN.climbE + 0.3 - IN.climbS), 0, 1); cx = lerp(300, 348, k); jump = Math.sin(k * Math.PI) * 14; }
  else return; // tucked into the truck, off we go
  drawCatSprite(cx, cy - jump, walking, "#d9863a", "#b8662a", Math.sin(t * 12) * (walking ? 1 : 0.25));
}
function bobY(ph, amp = 2) { return -Math.abs(Math.sin(t * 5 + ph)) * amp; }
// shared little tabby cat sprite (used in the intro and as the in-game companion)
// dir: facing offset for tail sway; body/stripe are colours; gait = leg/tail animation
function drawCatSprite(x, y, walking, body, stripe, gait, sitting = false) {
  ctx.save();
  // contact shadow
  ctx.globalAlpha = 0.22; ctx.fillStyle = "#101810"; ctx.beginPath(); ctx.ellipse(x, y + 1, 7, 2, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
  const step = walking ? gait : 0;
  if (sitting) {
    // haunches sitting upright
    px(x - 5, y - 8, 11, 8, body); px(x - 5, y - 8, 11, 2, "#e8a85a");
    px(x - 5, y - 4, 2, 4, stripe); px(x - 1, y - 6, 2, 5, stripe); px(x + 3, y - 5, 2, 4, stripe);
    px(x - 4, y, 3, 2, body); px(x + 2, y, 3, 2, body); // front paws
  } else {
    // legs
    px(x - 5, y - 2, 2, 3 + step, stripe); px(x + 3, y - 2, 2, 3 - step, stripe);
    px(x - 2, y - 2, 2, 3 - step, stripe); px(x + 1, y - 2, 2, 3 + step, stripe);
    // body
    px(x - 6, y - 8, 13, 7, body); px(x - 6, y - 8, 13, 2, "#e8a85a");
    // tabby stripes
    px(x - 3, y - 8, 1, 6, stripe); px(x, y - 8, 1, 6, stripe); px(x + 3, y - 8, 1, 6, stripe);
  }
  // head (faces right)
  const hx = x + 6, hy = y - 9;
  px(hx, hy, 7, 7, body); px(hx, hy, 7, 2, "#e8a85a");
  px(hx, hy - 2, 2, 2, body); px(hx + 5, hy - 2, 2, 2, body); // ears
  px(hx + 1, hy + 2, 1, 1, "#2a3a20"); px(hx + 4, hy + 2, 1, 1, "#2a3a20"); // eyes
  px(hx + 3, hy + 4, 1, 1, "#caa"); // nose
  // whiskers
  ctx.strokeStyle = "rgba(240,240,220,0.5)"; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(hx + 5, hy + 4); ctx.lineTo(hx + 10, hy + 3); ctx.moveTo(hx + 5, hy + 5); ctx.lineTo(hx + 10, hy + 6); ctx.stroke();
  // stripey tail (sways)
  const tailSway = Math.sin(t * 5 + (walking ? 0 : 1)) * (sitting ? 2 : 3);
  ctx.strokeStyle = body; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.quadraticCurveTo(x - 12, y - 8 + tailSway, x - 11, y - 13 + tailSway); ctx.stroke();
  ctx.strokeStyle = stripe; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 9, y - 8 + tailSway * 0.6); ctx.lineTo(x - 10, y - 10 + tailSway * 0.8); ctx.stroke();
  ctx.restore();
}
// ---- in-game cat companion (the same orange tabby from the intro) ----
function catMeow() {
  // soft procedural meow: a little rise then fall
  blip(560, 0.12, "sine", 0.05); setTimeout(() => blip(430, 0.18, "sine", 0.045), 120);
}
function catHiss() {
  // a startled hiss when you shoo it off
  blip(820, 0.07, "sawtooth", 0.05); setTimeout(() => blip(300, 0.12, "sawtooth", 0.045), 80);
}
function startCatSteal() {
  cat.mission = "steal"; cat.state = "arrive"; cat.x = -16; cat.target = 44 + Math.random() * 8; cat.t = 0;
  catMeow();
}
function eatSmallestFish() {
  if (!save.basket.length) return;
  let mi = 0;
  for (let i = 1; i < save.basket.length; i++) if (save.basket[i].weight < save.basket[mi].weight) mi = i;
  const taken = save.basket.splice(mi, 1)[0];
  persist(); buildBasket(); refreshHUD();
  const f = FISH_BY_KEY[taken.key];
  showCatEvent("Katten snappet " + (f ? f.name : "fisken") + "!", "Pus stakk av med den minste fangsten din.");
}
function showCatEvent(title, line) {
  gameEvent = { active: true, t: 0, dur: 4.5, title, line, color: "#ffd27a", sprite: "_cat", dir: 1, seed: Math.random() };
}
function pickCatAction() {
  const actions = ["watch", "wash", "bat", "nap", "chase", "watch", "sit"];
  cat.action = actions[Math.floor(Math.random() * actions.length)];
  cat.timer = 4 + Math.random() * 7;
  cat.t = 0;
  if (cat.action === "chase") cat.chaseX = cat.x;
}
function updateCat(dt) {
  cat.t += dt;
  switch (cat.state) {
    case "away":
      cat.timer -= dt;
      if (cat.timer <= 0) { cat.state = "arrive"; cat.x = -16; cat.target = 30 + Math.random() * 56; cat.t = 0; if (Math.random() < 0.6) catMeow(); }
      break;
    case "arrive":
      cat.x = lerp(cat.x, cat.target, dt * 1.8);
      if (cat.x > cat.target - 2) {
        if (cat.mission === "steal") { cat.state = "eat"; cat.eat = 5.5; cat.munch = 0; cat.action = "eat"; catMeow(); }
        else { cat.state = "settle"; pickCatAction(); if (Math.random() < 0.4) catMeow(); }
      }
      break;
    case "eat":
      cat.eat -= dt; cat.munch += dt;
      if (cat.munch > 0.45 && Math.random() < dt * 3) { blip(170 + Math.random() * 60, 0.05, "square", 0.04); cat.munch = 0; }
      if (!save.basket.length) { cat.state = "leave"; cat.mission = null; cat.t = 0; }
      else if (cat.eat <= 0) { eatSmallestFish(); cat.state = "leave"; cat.mission = null; cat.t = 0; catMeow(); }
      break;
    case "settle":
      cat.timer -= dt;
      if (cat.action === "chase") {
        // pad back and forth chasing a firefly, but stay on the grassy bank
        cat.x = clamp(cat.chaseX + Math.sin(cat.t * 2.2) * 16, 18, 96);
      } else if (cat.action === "bat" && Math.random() < dt * 1.5) {
        blip(300 + Math.random() * 80, 0.04, "triangle", 0.03);
      }
      if (cat.timer <= 0) {
        if (Math.random() < 0.38) { cat.state = "leave"; cat.t = 0; if (Math.random() < 0.4) catMeow(); }
        else pickCatAction();
      }
      break;
    case "leave":
      cat.x -= dt * 22;
      if (cat.x < -16) { cat.state = "away"; cat.timer = 22 + Math.random() * 40; }
      break;
  }
}
function drawCat() {
  if (cat.state === "away") return;
  const walking = cat.state === "arrive" || cat.state === "leave";
  const napping = !walking && cat.action === "nap";
  const sitting = !walking && !napping && cat.action !== "chase";
  const gait = walking ? Math.sin(t * 13) * 1.4 : (cat.action === "chase" ? Math.sin(t * 10) * 1.2 : 0);
  let y = cat.y;
  if (cat.action === "bat" && sitting) y += Math.abs(Math.sin(t * 7)) * 1.2; // little pounce bob
  // padding off to the left → face left (flip); otherwise face right toward the water
  const faceLeft = cat.state === "leave";
  if (faceLeft) {
    ctx.save(); ctx.translate(cat.x * 2, 0); ctx.scale(-1, 1);
    drawCatSprite(cat.x, y, walking, "#d9863a", "#b8662a", gait, false);
    ctx.restore();
  } else {
    drawCatSprite(cat.x, y, walking, "#d9863a", "#b8662a", gait, sitting && !napping);
  }
  if (napping) {
    // curled-up nap: redraw lower + floating zzz
    px(cat.x - 6, y - 2, 13, 4, "#d9863a"); px(cat.x - 6, y - 2, 13, 1, "#e8a85a");
    px(cat.x - 4, y - 1, 1, 2, "#b8662a"); px(cat.x, y - 1, 1, 2, "#b8662a"); px(cat.x + 4, y - 1, 1, 2, "#b8662a");
    ctx.fillStyle = "rgba(220,220,240,0.7)"; ctx.font = "6px monospace"; ctx.textAlign = "left";
    const zz = (Math.sin(t * 1.5) * 0.5 + 0.5);
    ctx.globalAlpha = 0.5 + zz * 0.4; ctx.fillText("z", cat.x + 8, y - 8 - zz * 3);
    ctx.fillText("z", cat.x + 11, y - 12 - zz * 2); ctx.globalAlpha = 1;
  }
  if (cat.action === "wash" && sitting) {
    // licking a raised paw
    px(cat.x + 2, y - 5, 2, 2, "#e8a85a");
  }
  if (cat.action === "chase" && !walking) {
    // a firefly the cat is batting at, just ahead of it
    const fx = cat.x + 10 + Math.sin(t * 3) * 3, fy = y - 12 + Math.cos(t * 4) * 3;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 9); px(fx, fy, 1, 1, "#fff2a0"); ctx.globalAlpha = 1;
  }
  if (cat.state === "eat") {
    // the pilfered fish lying on the bank, getting chomped
    const fx = cat.x + 10, fy = y - 1;
    px(fx, fy, 6, 3, "#9fb8c8"); px(fx + 5, fy, 2, 3, "#7fa0b0"); px(fx, fy, 6, 1, "#c0d8e8");
    px(fx + 1, fy + 1, 1, 1, "#24343f");
    if (Math.sin(t * 9) > 0) px(fx + 2, fy, 2, 2, "rgba(0,0,0,0.28)"); // bite flicker
    // pulsing warning so you have time to react and shoo it
    const a = 0.55 + 0.45 * Math.sin(t * 6);
    ctx.globalAlpha = a; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#ffd27a";
    ctx.fillText("!", cat.x + 2, y - 18); ctx.globalAlpha = 1; ctx.textAlign = "left";
  }
}
function drawFarmer(tt) {
  let gx, walking, alpha = 1;
  if (tt < IN.walkStart) { gx = 96; walking = false; }
  else if (tt < IN.walkEnd) { gx = lerp(96, 322, (tt - IN.walkStart) / (IN.walkEnd - IN.walkStart)); walking = true; }
  else if (tt < IN.climbS) { gx = 322; walking = false; }
  else { const k = clamp((tt - IN.climbS) / (IN.climbE - IN.climbS), 0, 1); gx = lerp(322, 358, k); walking = true; alpha = 1 - k * 0.9; }
  const gy = 206;
  ctx.globalAlpha = alpha;
  // soft shadow
  ctx.globalAlpha = alpha * 0.25; ctx.fillStyle = "#1a2410"; ctx.beginPath(); ctx.ellipse(gx, gy + 1, 8, 2, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = alpha;
  const step = walking ? Math.sin(t * 10) * 2 : 0;
  // legs + boots
  px(gx - 4, gy - 12, 3, 12 + step, "#3b4a6b"); px(gx + 1, gy - 12, 3, 12 - step, "#33405e");
  px(gx - 5, gy - 1, 4, 3, "#43352a"); px(gx + 1, gy - 1, 4, 3, "#43352a");
  // plaid shirt — matches the in-game character (no suspenders, no eyes)
  px(gx - 7, gy - 26, 14, 16, "#b8473f");
  ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = "#6e251f";
  for (let i = 0; i < 3; i++) ctx.fillRect(gx - 7 + i * 5, gy - 26, 2, 16);
  for (let i = 0; i < 3; i++) ctx.fillRect(gx - 7, gy - 26 + i * 6, 14, 2);
  ctx.globalAlpha = alpha;
  // head + straw hat (same build as the in-game guy)
  const hx = gx, hy = gy - 30;
  px(hx - 4, hy - 4, 9, 8, "#e3b58c"); px(hx - 4, hy + 3, 9, 2, "#caa07a");
  px(hx - 8, hy - 2, 17, 2, "#d8b25a"); px(hx - 5, hy - 7, 11, 6, "#e7c56e"); px(hx - 5, hy - 3, 11, 1, "#b8923f");
  // arms + the rod
  if (tt < IN.throwS) {
    // carried over the shoulder, pointing up and back
    px(gx + 3, gy - 24, 4, 4, "#e3b58c");
    ctx.strokeStyle = "#caa97a"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx + 5, gy - 23); ctx.lineTo(gx - 12, gy - 42); ctx.stroke();
    px(gx - 13, gy - 43, 2, 2, "#bfe6ef");
  } else if (tt < IN.throwE) {
    // throwing arm flung forward (rod is drawn flying separately)
    px(gx + 4, gy - 28, 5, 3, "#e3b58c");
  } else {
    px(gx + 4, gy - 22, 4, 4, "#e3b58c");
  }
  ctx.globalAlpha = 1;
}
function drawThrownRod(tt) {
  const k = clamp((tt - IN.throwS) / (IN.throwE - IN.throwS), 0, 1);
  const x = lerp(318, 350, k), y = lerp(176, 192, k) - Math.sin(k * Math.PI) * 26;
  ctx.save(); ctx.translate(x, y); ctx.rotate(lerp(-0.7, 0.5, k));
  ctx.strokeStyle = "#caa97a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.stroke();
  px(-12, -1, 3, 3, "#7a5a36"); px(10, -1, 2, 2, "#bfe6ef");
  ctx.restore();
}
function drawIntroTruck(x, y, driving, hasRod) {
  const bob = driving ? Math.sin(t * 18) * 1.2 : 0; y += bob;
  // exhaust puffs while driving (behind the truck)
  if (driving) { for (let i = 0; i < 5; i++) { const ex = x - 30 - i * 8 - (t * 40) % 16, a = 0.45 - i * 0.08; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = "#cfcabf"; ctx.beginPath(); ctx.arc(ex, y + 2 + Math.sin(t * 5 + i) * 2, 2 + i, 0, 6.28); ctx.fill(); } ctx.globalAlpha = 1; }
  // bed
  px(x - 26, y - 8, 24, 12, "#b8302a"); px(x - 26, y - 8, 24, 2, "#d24a3a"); px(x - 24, y - 6, 20, 8, "#8a221c");
  if (hasRod) {
    ctx.strokeStyle = "#caa97a"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 24, y - 6); ctx.lineTo(x - 40, y - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 21, y - 6); ctx.lineTo(x - 37, y - 15); ctx.stroke();
    px(x - 41, y - 21, 2, 2, "#bfe6ef");
  }
  // cab
  px(x - 4, y - 16, 18, 20, "#c43a2a"); px(x - 4, y - 16, 18, 3, "#e05a44");
  px(x, y - 13, 12, 8, "#a8d4e0"); px(x + 1, y - 12, 5, 6, "#c8e8f0");
  // bumper + headlight
  px(x + 14, y - 2, 3, 6, "#d8d8d8"); px(x + 16, y - 1, 2, 3, "#fff2a0");
  // wheels
  const wsp = driving ? t * 26 : 0;
  for (const wx of [x - 18, x + 8]) {
    ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(wx, y + 5, 5, 0, 6.28); ctx.fill();
    ctx.fillStyle = "#6a6a6a"; ctx.beginPath(); ctx.arc(wx, y + 5, 2, 0, 6.28); ctx.fill();
    ctx.strokeStyle = "#9a9a9a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(wx + Math.cos(wsp) * 4, y + 5 + Math.sin(wsp) * 4); ctx.lineTo(wx - Math.cos(wsp) * 4, y + 5 - Math.sin(wsp) * 4); ctx.stroke();
  }
}
function drawIntroBg() {
  const tt = intro.running ? intro.t : 0;
  // dusk sky — muted to match the rest of the game (kveldsfiske)
  const g = ctx.createLinearGradient(0, 0, 0, 206);
  g.addColorStop(0, "#2a2a48"); g.addColorStop(0.5, "#4a3f60"); g.addColorStop(1, "#9a6a5a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 206);
  // a few faint stars in the upper sky
  for (const s of stars) { if (s.y > 70) continue; ctx.globalAlpha = (0.2 + s.b * 0.4) * (0.5 + 0.5 * Math.sin(t * 1.5 + s.tw)); px(s.x, s.y, 1, 1, "#fff7e0"); }
  ctx.globalAlpha = 1;
  // low evening sun setting behind the hill
  const sx = 408, sy = 96;
  const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, 56); sg.addColorStop(0, "rgba(255,200,140,0.7)"); sg.addColorStop(1, "rgba(255,200,140,0)");
  ctx.fillStyle = sg; ctx.fillRect(sx - 56, sy - 56, 112, 112);
  ctx.fillStyle = "#f0b878"; ctx.beginPath(); ctx.arc(sx, sy, 11, 0, 6.28); ctx.fill();
  // drifting dusk clouds
  const cloud = (cx, cy) => { ctx.fillStyle = "rgba(180,150,170,0.45)"; for (const [ox, oy, r] of [[0, 0, 7], [9, 2, 6], [-9, 3, 6], [3, -3, 5]]) { ctx.beginPath(); ctx.arc(cx + ox, cy + oy, r, 0, 6.28); ctx.fill(); } };
  for (let i = 0; i < 3; i++) cloud(((i * 165 + t * 6) % (W + 90)) - 45, 30 + i * 15);
  // tree-covered hill on the horizon (dark silhouette)
  ctx.fillStyle = "#33402a"; ctx.beginPath(); ctx.moveTo(0, 206);
  for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 170 + Math.sin(x * 0.03) * 8); ctx.lineTo(W, 206); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#26331f"; for (let x = 14; x < W; x += 28) { const hy = 170 + Math.sin(x * 0.03) * 8; ctx.beginPath(); ctx.moveTo(x, hy - 12); ctx.lineTo(x - 4, hy); ctx.lineTo(x + 4, hy); ctx.closePath(); ctx.fill(); }
  // grass + dirt path to the truck (dim evening tones)
  px(0, 200, W, 70, "#36482a"); px(0, 200, W, 3, "#42562f");
  ctx.fillStyle = "#4a371f"; ctx.beginPath(); ctx.moveTo(78, 206); ctx.lineTo(96, 206); ctx.lineTo(372, 232); ctx.lineTo(338, 232); ctx.closePath(); ctx.fill();
  // a tuft of grass blades
  ctx.strokeStyle = "#2c3c1f"; ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) { const bx = (i * 37) % W, by = 210 + (i * 13) % 50; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.sin(t + i) * 1.5, by - 4); ctx.stroke(); }
  drawFarmhouse();
  // a calm cottage garden with the boy's cat trotting along
  drawGarden(tt);
  // truck + farmer + thrown rod
  const truckX = introTruckX(tt), hasRod = tt >= IN.throwE, driving = tt >= IN.driveS;
  drawIntroTruck(truckX, 200, driving, hasRod);
  if (tt >= IN.throwS && tt < IN.throwE) drawThrownRod(tt);
  if (tt < IN.climbE) drawFarmer(tt);
  drawIntroCat(tt);
  // closing title once the truck has rolled off
  const titleA = clamp((tt - 16) / 1.6, 0, 1);
  if (titleA > 0) {
    ctx.globalAlpha = titleA; ctx.fillStyle = "#fff4d2"; ctx.font = "bold 22px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Cozy Pond", W / 2, 96); ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
  // prompt / skip hint
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (!intro.running) {
    const pa = 0.6 + 0.4 * Math.sin(t * 3);
    px(W / 2 - 96, 124, 192, 26, "rgba(14,12,22,0.72)");
    ctx.globalAlpha = pa; ctx.fillStyle = "#ffe6a0"; ctx.font = "9px monospace";
    ctx.fillText("Klikk for \u00e5 begynne \u2666", W / 2, 137); ctx.globalAlpha = 1;
  } else if (titleA < 1) {
    ctx.fillStyle = "rgba(230,224,180,0.6)"; ctx.font = "7px monospace";
    ctx.fillText("klikk for \u00e5 hoppe over \u203a", W / 2, H - 10);
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  drawVignette();
}

function render() {
  ctx.clearRect(0, 0, W, H);
  switch (screen) {
    case "game":
      drawSky(); drawStars(); drawAurora(); drawMoon(); drawMountains(); drawTreeline(); drawLurkingEyes(); drawMoose(); drawParkedTruck(); drawWater(); drawWaterfall(); drawReflections(); drawForestDetails(); drawSummerDetails(); drawShore();
      drawLine(); drawBobber(); drawBuffAura(); drawGuy(); drawSmoke(); drawProps(); drawGroundFish(); drawCat(); drawInspector(); drawCoolerMenu(); drawGodsakerPanel(); drawRodPanel(); drawBagPanel(); drawRecordsPanel(); drawTruckMenu(); drawReedsFront(); drawFireflies();
      drawRevealFish(); drawFog(); drawBuffHud(); drawEventActor(); drawGameEvent(); drawHoverHighlight(); drawVignette();
      break;
    case "menu": drawMenuBg(); break;
    case "market": drawMarketBg(); break;
    case "intro": drawIntroBg(); break;
    case "map": drawMapBg(); break;
    case "travel": drawTravelBg(); break;
    case "shopFish": drawShopFishBg(); break;
    case "shopRod": drawShopRodBg(); break;
    case "shopKiosk": drawShopKioskBg(); break;
    case "shopCasino": drawShopCasinoBg(); break;
  }
}

/* =========================================================================
   Loop
   ========================================================================= */
let last = performance.now();
function loop(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  update(dt); render();
  if (hover.on) updateCursor();
  requestAnimationFrame(loop);
}

// init
// progression: waters are unlocked by paying at the pickup/map; own every rod up to the one in use
if (!Array.isArray(save.unlocked) || !save.unlocked.length) save.unlocked = ["skogstjern"];
// one-time gate-down for old saves that had every water unlocked for free
if (!save.gated) {
  save.unlocked = ["skogstjern"];
  if (!save.unlocked.includes(save.location)) save.location = "skogstjern";
  save.gated = true;
}
if (!save.unlocked.includes("skogstjern")) save.unlocked.unshift("skogstjern");
if (!Array.isArray(save.owned)) save.owned = [0];
for (let i = 0; i <= save.rodLevel; i++) if (!save.owned.includes(i)) save.owned.push(i);
if (!save.owned.includes(0)) save.owned.push(0);
if (!save.stock || typeof save.stock !== "object") save.stock = { beer: 0, snus: 0, cigar: 0, akevitt: 0, snabel: 0 };
for (const k of ["beer", "snus", "cigar", "akevitt", "snabel"]) if (save.stock[k] == null) save.stock[k] = 0;
if (typeof save.license !== "number") save.license = 0;
persist();
setLocation(save.location || "skogstjern");
refreshHUD();
// "Fortsett" when there is saved progress, otherwise "Start spill"
(function () {
  const played = save.money > 0 || save.basket.length > 0 || save.rodLevel > 0 || save.location !== "skogstjern" || Object.keys(save.record || {}).length > 0;
  const b = $("startBtn"); if (b) b.textContent = played ? "Fortsett" : "Start spill";
})();
if (!save.seenIntro) startIntro(); else setScreen("menu");
requestAnimationFrame(loop);
