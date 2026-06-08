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
const licenseStateEl = $("licenseState");

/* =========================================================================
   Save / economy
   ========================================================================= */
const SAVE_KEY = "cozyPond_v1";        // legacy single-slot key (migrated to slot 0)
const SLOT_COUNT = 3;
const SLOT_KEY = "cozyPond_slot";      // which slot is currently active (0..2)
function slotKey(i) { return SAVE_KEY + "_s" + i; }
function defaultSave() {
  return { money: 0, rodLevel: 0, beers: 0, basket: [], record: {}, junk: {}, location: "skogstjern", unlocked: ["skogstjern"], owned: [0], stock: { beer: 0, snus: 0, cigar: 0, akevitt: 0, snabel: 0 }, licenses: {}, gated: true, seenIntro: false, playerName: "", hats: ["straw"], hat: "straw" };
}
// one-time migration: fold the old single save into slot 0 the first time we boot the slot system
function migrateSaves() {
  const hasSlot = [0, 1, 2].some((i) => localStorage.getItem(slotKey(i)) != null);
  if (!hasSlot) {
    const old = localStorage.getItem(SAVE_KEY);
    if (old != null) { try { localStorage.setItem(slotKey(0), old); } catch (e) {} }
  }
}
migrateSaves();
function activeSlot() { const n = parseInt(localStorage.getItem(SLOT_KEY), 10); return (n >= 0 && n < SLOT_COUNT) ? n : 0; }
let currentSlot = activeSlot();
function loadSave(slot) {
  try {
    const s = JSON.parse(localStorage.getItem(slotKey(slot)));
    if (s && typeof s === "object") {
      const merged = Object.assign(defaultSave(), s);
      if (!merged.licenses || typeof merged.licenses !== "object") merged.licenses = {};
      // hats are cosmetics; everyone always owns the free straw hat and wears a valid one
      if (!Array.isArray(merged.hats) || !merged.hats.length) merged.hats = ["straw"];
      if (!merged.hats.includes("straw")) merged.hats.unshift("straw");
      if (!merged.hats.includes(merged.hat)) merged.hat = "straw";
      // migrate the old single global licence count onto whichever water you were last at
      if (typeof s.license === "number" && s.license > 0) merged.licenses[merged.location] = (merged.licenses[merged.location] || 0) + s.license;
      delete merged.license;
      return merged;
    }
  } catch (e) {}
  return defaultSave();
}
let save = loadSave(currentSlot);
function persist() {
  // defensive: never let money drift negative, fractional or NaN before it's stored/shown
  if (!Number.isFinite(save.money) || save.money < 0) save.money = 0;
  save.money = Math.round(save.money);
  try { localStorage.setItem(slotKey(currentSlot), JSON.stringify(save)); } catch (e) {}
}
// quick summary of a slot for the slot picker (null = empty/never-played)
function slotSummary(slot) {
  try {
    const raw = localStorage.getItem(slotKey(slot));
    if (raw == null) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return null;
    let species = 0;
    if (s.record) for (const k in s.record) { if (s.record[k] && s.record[k].count) species++; }
    const loc = (LOCATIONS.find((l) => l.key === s.location) || {}).name || "Skogstjernet";
    return { money: s.money || 0, species, location: loc, name: s.playerName || "" };
  } catch (e) { return null; }
}
const fmt = (n) => Math.round(n).toLocaleString("nb-NO");

/* =========================================================================
   Fish + rods
   ========================================================================= */
// kr = base kr per kg. weight = rarity. min/max in kg.
const FISH = [
  { key: "abbor",  name: "Abbor",  min: 0.1, max: 1.6, weight: 30, kr: 40,  shape: "normal", body: "#5f7d3a", belly: "#d9d2a6", fin: "#c23b2b", pattern: "stripes", spot: "#3a4a22", seed: 11 },
  { key: "mort",   name: "Mort",   min: 0.08, max: 0.5, weight: 26, kr: 24, shape: "normal", body: "#97a6b2", belly: "#e8eef2", fin: "#d23b2b", pattern: "plain", seed: 23 },
  { key: "sik",    name: "Sik",    min: 0.3, max: 2.2, weight: 14, kr: 55,  shape: "normal", body: "#aab6c2", belly: "#eef3f7", fin: "#8c9aa6", pattern: "plain", seed: 31 },
  { key: "brasme", name: "Brasme", min: 0.4, max: 3.5, weight: 12, kr: 25,  shape: "tall", body: "#9b8642", belly: "#e6dcb0", fin: "#5b4a2a", pattern: "plain", seed: 41 },
  { key: "gjedde", name: "Gjedde", min: 0.8, max: 9.0, weight: 12, kr: 45,  shape: "long", body: "#566b39", belly: "#d4d39a", fin: "#7a4030", pattern: "spots", spot: "#c6d488", seed: 53 },
  { key: "orret",  name: "Ørret",  min: 0.25, max: 4.5, weight: 14, kr: 120, shape: "normal", body: "#7a6a4a", belly: "#e8c9a0", fin: "#6b5638", pattern: "spots", spot: "#b03a2a", seed: 61 },
  { key: "roye",   name: "Røye",   min: 0.25, max: 3.0, weight: 8,  kr: 145, shape: "normal", body: "#4f6d8a", belly: "#e06b3a", fin: "#e8783a", pattern: "spots", spot: "#f2c9a0", seed: 71 },
  { key: "harr",   name: "Harr",   min: 0.25, max: 1.6, weight: 7,  kr: 95,  shape: "normal", body: "#7d8a93", belly: "#dfe6ea", fin: "#6a4a7a", pattern: "spots", spot: "#3a2c4a", bigDorsal: true, seed: 83 },
  { key: "lake",   name: "Lake",   min: 0.4, max: 3.0, weight: 5,  kr: 50,  shape: "long", body: "#5a5236", belly: "#cfc18a", fin: "#4a4326", pattern: "spots", spot: "#3a3520", seed: 97 },
  { key: "karpe",  name: "Karpe",  min: 0.6, max: 6.0, weight: 6,  kr: 30,  shape: "round", body: "#a8762f", belly: "#e6c98a", fin: "#7a531f", pattern: "plain", seed: 101 },
  // Jettegryta-kjemper: kjente arter, men vokst seg enorme i det bunnløse grottevatnet
  { key: "kjempelake",  name: "Kjempelake",  min: 2.0, max: 9.0,  weight: 6, kr: 70,  shape: "long", body: "#4a4630", belly: "#c8b97a", fin: "#33301c", pattern: "spots", spot: "#2a2818", seed: 211 },
  { key: "grottegjedde", name: "Grottegjedde", min: 3.0, max: 16.0, weight: 8, kr: 65,  shape: "long", body: "#48563f", belly: "#cdd0a0", fin: "#6a4434", pattern: "spots", spot: "#aebf80", seed: 223 },
  { key: "jetteorret",  name: "Jetteørret",  min: 2.0, max: 11.0, weight: 7, kr: 95,  shape: "normal", body: "#8a7a64", belly: "#ece0c4", fin: "#6a5840", pattern: "spots", spot: "#a85a4a", seed: 233 },
];
const FISH_BY_KEY = Object.fromEntries(FISH.map((f) => [f.key, f]));

const JUNK = [
  { key: "stovel", name: "Gammel støvel", junk: true, weight: 3, tag: "Passer ikke. Rett i samlingen!", kind: "boot" },
  { key: "boks",   name: "Blikkboks",     junk: true, weight: 2, tag: "Pant? Niks. Men en kuriositet.", kind: "can" },
  { key: "truse",  name: "Damestringtruse", junk: true, weight: 1.4, tag: "Øh… best å ikke spørre. Lommeboka gråter, samlingen jubler.", kind: "thong" },
  { key: "and",    name: "Gummiand",      junk: true, weight: 1.6, tag: "Kvakk! En trofast badevenn.", kind: "duck" },
  { key: "briller",name: "Gamle briller", junk: true, weight: 1.3, tag: "Noen ser nok dårlig nå. Fint funn!", kind: "glasses" },
];

const RODS = [
  { name: "Pinnestang",            reel: 1.0,  tens: 0.9,  rare: 0.0,  window: 1.0,  cost: 0,    color: "#7a5a36", grip: "#3b2b1f", tip: "#caa97a" },
  { name: "Glassfiberstang",       reel: 1.1,  tens: 0.85, rare: 0.0,  window: 1.06, cost: 600,  color: "#3f7d8c", grip: "#23404a", tip: "#bfe6ef" },
  { name: "Karbonstang",           reel: 1.2,  tens: 0.8,  rare: 0.0,  window: 1.12, cost: 1700, color: "#2c2c34", grip: "#7a1f1f", tip: "#d24a3a" },
  { name: "Proffstang",            reel: 1.3,  tens: 0.74, rare: 0.0,  window: 1.18, cost: 3200, color: "#caa23a", grip: "#5a3aa0", tip: "#fff2a0" },
  { name: "Splittbambusstang",     reel: 1.4,  tens: 0.7,  rare: 0.14, window: 1.24, cost: 6000, color: "#7d9a3a", grip: "#3a2a14", tip: "#e8f0a0" },
  { name: "Nordlysstang",          reel: 1.5,  tens: 0.66, rare: 0.28, window: 1.3,  cost: 13000, color: "#2fc0a0", grip: "#3a2a6a", tip: "#b0ffe6" },
  { name: "Jettestanga",           reel: 1.62, tens: 0.6,  rare: 0.42, window: 1.38, cost: 28000, color: "#4a4a55", grip: "#23232c", tip: "#a0ffe0" },
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
    key: "fjellvatn", name: "Fjellvatnet", cost: 3600, desc: "\u00d8rret, r\u00f8ye & harr \u2014 dyrt",
    sky: ["#0e1430", "#1f2a52", "#3a4f7a", "#6f8fb0", "#cfe0ec"],
    water: ["#2a4a6e", "#1c3450", "#0e2030"],
    tree: "#1a2a3a", snow: true, moon: true, fog: 0.05, junk: 0.5, mountains: true,
    fish: ["orret", "roye", "harr", "sik", "mort"],
    rare: { key: "storroye", name: "Gammelrøya", min: 4, max: 9, kr: 220, shape: "normal", body: "#3f5d7a", belly: "#f08b4a", fin: "#f8983a", pattern: "spots", spot: "#fff0d0", seed: 701 },
  },
  {
    key: "elva", name: "Stryket", cost: 2100, desc: "\u00d8rret, harr & lake",
    sky: ["#241a32", "#3a2a48", "#6a4a5a", "#c08a5a", "#e0a878"],
    water: ["#3a5a5a", "#264a48", "#143230"],
    tree: "#142218", moon: false, fog: 0, junk: 0.8, waterfall: true,
    fish: ["orret", "harr", "lake", "gjedde", "mort", "sik"],
    rare: { key: "kjempeorret", name: "Kjempeørret", min: 5, max: 12, kr: 200, shape: "normal", body: "#6a5838", belly: "#f0d2a0", fin: "#5a4628", pattern: "spots", spot: "#c03a2a", seed: 711 },
  },
  {
    key: "myra", name: "Trollmyra", cost: 850, desc: "Skummelt \u2014 store troll lurer",
    sky: ["#0e1a14", "#16241a", "#2a3a26", "#46502e", "#6a5a3a"],
    water: ["#2a3a26", "#1a2a1a", "#0e1a10"],
    tree: "#0a140c", fog: 0.28, moon: true, spooky: true, junk: 1.6, eyes: true,
    fish: ["lake", "gjedde", "karpe", "brasme", "abbor"],
    rare: { key: "myrtroll", name: "Myrtrollet", min: 9, max: 22, kr: 90, shape: "long", body: "#3a4a2a", belly: "#5a6a38", fin: "#2a3520", pattern: "spots", spot: "#1a2410", seed: 999, tag: "Hva i alle dager?!" },
  },
  {
    key: "elgtjern", name: "Elgtjernet", cost: 1300, desc: "Lyst sommertjern \u2014 elgen titter innom",
    sky: ["#1b2c52", "#395a86", "#6f93b4", "#d6a878", "#f4d79a"],
    water: ["#2f6f72", "#1f5256", "#123638"],
    tree: "#1d3a22", moon: true, fog: 0.03, junk: 0.7, moose: true, summer: true,
    fish: ["orret", "abbor", "sik", "mort", "karpe", "brasme"],
    rare: { key: "tjernsgiganten", name: "Tjernsgiganten", min: 6, max: 16, kr: 170, shape: "round", body: "#7a6a2a", belly: "#e8d88a", fin: "#5a4a1a", pattern: "plain", seed: 811, tag: "S\u00e5 stor at elgen ble misunnelig! \ud83e\udeac" },
  },
  {
    key: "nordlys", name: "Nordlysvatnet", cost: 5200, desc: "Arktisk \u2014 nordlyset danser",
    sky: ["#02060f", "#06101e", "#0a1828", "#0e2236", "#143048"],
    water: ["#10283a", "#0a1c2c", "#06121e"],
    tree: "#0c1822", snow: true, fog: 0.06, junk: 0.4, aurora: true,
    fish: ["roye", "harr", "sik", "orret", "lake"],
    rare: { key: "nordlysroya", name: "Nordlysr\u00f8ya", min: 5, max: 11, kr: 300, shape: "normal", body: "#2a6a7a", belly: "#9affd0", fin: "#6affc0", pattern: "spots", spot: "#e0fff0", seed: 821, tag: "Den lyser som selve nordlyset! \u2728" },
  },
  {
    key: "jettegryta", name: "Jettegryta", cost: 14000, desc: "Bunnl\u00f8st grottevatn \u2014 gigantfisk i m\u00f8rket",
    sky: ["#05060a", "#0a0a12", "#10101c", "#161826", "#1c2030"],
    water: ["#142028", "#0c161e", "#060c12"],
    tree: "#0a0c14", cave: true, glow: true, drip: true, fog: 0.12, junk: 0.5, fightMul: 1.35,
    fish: ["kjempelake", "grottegjedde", "jetteorret", "lake", "gjedde"],
    rare: { key: "urgjedda", name: "Urgjedda", min: 14, max: 30, kr: 200, shape: "long", body: "#3a4a36", belly: "#c0c890", fin: "#5a3828", pattern: "spots", spot: "#9ab070", seed: 911, tag: "Et urtidsmonster fra dypet! \ud83d\udc09" },
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
  const luck = (buff.t > 0 ? buff.luck : 0) + (castOnRise ? 0.5 : 0);
  // legendary catch of this location — rare early (a real "wow"), climbs with the top rods + luck
  if (LOC.rare && Math.random() < 0.008 + r * 0.026 + luck * 0.04) return LOC.rare;
  const pool = [];
  for (const f of locFish()) {
    let w = f.weight;
    if (f.kr >= 90) w *= 1 + r * 0.6 + luck * 0.9;        // valuable fish a bit more likely with good rod / boost
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
// pick the weather for a fresh fishing session. Snowy/foggy waters lean misty;
// everywhere else gets a gentle mix. Rain perks the fish up a touch.
function rollWeather() {
  const bag = ["clear", "clear", "clear", "overcast", "rain", "mist"];
  if (LOC && (LOC.snow || LOC.fog)) bag.push("mist", "mist", "overcast");
  const type = bag[Math.floor(Math.random() * bag.length)];
  weather.type = type; weather.t = 0; weather.flash = 0;
  rainDrops.length = 0;
  if (type === "rain") for (let i = 0; i < 70; i++) rainDrops.push({ x: Math.random() * W, y: Math.random() * WATER_Y, sp: 220 + Math.random() * 120, len: 5 + Math.random() * 5 });
}
// gentle per-weather bite multiplier (smaller = bites sooner)
function weatherBiteMul() {
  return weather.type === "rain" ? 0.7 : weather.type === "overcast" ? 0.88 : 1;
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
const FISH_STALL = { x: 7, y: 90, w: 90, h: 100 };
const KIOSK_STALL = { x: 101, y: 90, w: 90, h: 100 };
const ROD_STALL = { x: 195, y: 90, w: 90, h: 100 };
const CASINO_STALL = { x: 289, y: 90, w: 90, h: 100 };
const LICENSE_BOOTH = { x: 383, y: 90, w: 90, h: 100 };   // the warden's permit stall, now in line with the others
const MARKET_TRUCK = { x: 6, y: 214, w: 60, h: 30 };

/* =========================================================================
   State
   ========================================================================= */
let screen = "menu";        // menu | game | market | shopFish | shopRod | inventory
let prevScreen = "menu";
let menuReturn = "game";    // where «Fortsett» returns to — set when the menu is opened mid-game/market
let fishState = "ready";    // ready | casting | waiting | bite | hooked | reveal | missed
let t = 0, stateTime = 0;

let biteTimer = 0, biteWindow = 0, nibbleTimer = 0, nibbleShake = 0;
let holding = false, progress = 0, tension = 0, pullTimer = 0, pulling = 0;
let bigFishTired = false;   // one-shot flag: a heavy fish has visibly worn down
let currentFish = null, currentCatch = null, currentWeight = 0, missReason = "";
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
  { key: "jettegryta", x: 432, y: 128 },
];
const MAP_MARKET = { x: 110, y: 244 };   // the market town, reachable from the map too
let mapReturn = "game";                   // where the map's «back» button returns to
let travel = { key: null, t: 0, dur: 2.8, toName: "" };
// one-time opening cinematic (poor farm boy leaves the farm to go fishing)
let intro = { t: 0, running: false, enginePlayed: false, rodSfx: false };
const IN = { walkStart: 1.4, walkEnd: 7.2, throwS: 7.2, throwE: 8.2, climbS: 8.6, climbE: 10.2, engine: 10.4, driveS: 11.2, end: 18.6, wifeThrowS: 3.2, wifeThrowE: 3.7, wifeThrowR: 3.7, wifeThrowL: 5.0 };
function startTravel(key) {
  travel.key = key; travel.t = 0;
  travel.toName = key === "market" ? "Markedet" : ((LOCATIONS.find((l) => l.key === key) || {}).name || "");
  screen = "travel";
  OVERLAYS.forEach((o) => $(o).classList.remove("active"));
  hudEl.classList.add("hidden");
  stopRadio(); inspector.active = false;
  ensureAudio(); sfxHorn(); startEngine();
  autoSubmitScore();   // the drive is a natural moment to quietly push the latest score
}
// travel to a water, buying its unlock first if needed (markedet is always free)
function tryTravel(key) {
  const atMarket = mapReturn === "market";
  if (key === "market") {
    if (atMarket) { setScreen("market"); return; }   // already standing in the market — no need to drive
    startTravel("market"); return;
  }
  const loc = LOCATIONS.find((l) => l.key === key); if (!loc) return;
  if ((save.unlocked || []).includes(key)) {
    if (key === save.location && !atMarket) setScreen("game");   // already sitting at this water
    else startTravel(key);
    return;
  }
  if (save.money < loc.cost) { sfxMiss(); return; }   // can't afford it yet — the price is shown on the map
  save.money -= loc.cost; save.unlocked.push(key); persist(); refreshHUD(); sfxCoin();
  startTravel(key);
}

// guy beer animation
let sipTimer = 6 + Math.random() * 6, sipAnim = 0, drinking = 0, drinkKind = "beer";
const cans = []; // thrown beer cans {x,y,vx,vy,rot,life}

// boosts / vices (consumables grant temporary luck + reeling ease)
let buff = { label: "", luck: 0, reel: 0, t: 0, dur: 1, color: "#fff" };
let buffFlash = 0, drunk = 0, smoking = 0, snusing = 0;
// one consistent fyll scale: each drink adds a fixed amount, capped at DRUNK_MAX,
// and you keel over (cartoon blackout) once you cross DRUNK_KO.
const DRUNK_KO = 1.4, DRUNK_MAX = 1.7;
// classic cartoon blackout when he drinks WAY past the limit
let knockout = { active: false, t: 0, phase: "fall" };
let hangover = 0;                  // woozy after-effect seconds once he comes to
let staggerWarned = false;         // so the "you're hammered" warning only fires once per binge
// little book-keeping so we can chirp a soft "pop" the moment a buff/rus fully wears off
let buffWasOn = false, drunkWasOn = false;
// per-session weather — picked fresh every time you arrive at a water, for a bit of life
let weather = { type: "clear", t: 0, flash: 0 };
const rainDrops = [];
// gentle drifting snow — only on the wintry waters (Fjellvatnet, Nordlysvatnet)
const snowFlakes = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * WATER_Y, sp: 8 + Math.random() * 14, r: 1 + Math.random() * 1.4, ph: Math.random() * 6.28, drift: 0.5 + Math.random() * 0.8 }));
const WEATHER_HINT = { clear: "Klar og stille kveld \u2014 fint fiskev\u00e6r.", overcast: "Gr\u00e5tt og overskyet i kveld.", rain: "Lett regn pisler i vannet \u2014 fisken er p\u00e5hugget!", mist: "T\u00e5ka ligger t\u00e9tt over vannet i kveld." };
const smoke = [];
let coolerMenu = false, truckMenu = false, rodPanel = false, bagPanel = false, recordsPanel = false, godsakerPanel = false, funnPanel = false, kioskIdleTimer = 5, partyNode = null;
// cosmetic hats: bought from the wandering hat seller, equipped from the sekk
let hatPanel = false, hatShop = false;
let hatRowRects = [];
const HATS = [
  { key: "straw", name: "Str\u00e5hatt", cost: 0, blurb: "Den gode gamle str\u00e5hatten." },
  { key: "jester", name: "Narrehatt", cost: 3200, blurb: "Fargerik festivalhatt med bjeller." },
  { key: "pinkcowboy", name: "Rosa cowboyhatt", cost: 5500, blurb: "Glitrende rosa \u2014 for festivalkongen." },
  { key: "tophat", name: "Flosshatt", cost: 8000, blurb: "Stilig herrehatt for finere fiskere." },
  { key: "rabbit", name: "Blinkende kanin\u00f8rer", cost: 12000, blurb: "Lyser opp natten. Hvorfor? Hvem vet." },
  { key: "viking", name: "Vikinghjelm", cost: 18000, blurb: "Med ekte horn. Skitt fiske, h\u00f8vding!" },
];
const HAT_BY_KEY = Object.fromEntries(HATS.map((h) => [h.key, h]));
// the wandering Romanian hat seller — strolls up from the foreground, offers hats, leaves if ignored
let hatSeller = { state: "away", x: 108, y: 280, t: 0, timer: 150 + Math.random() * 180, idleDur: 14 };
let marketNode = null, casinoAmbNode = null, casinoSpinNode = null, casinoLoseNode = null, licenseAmbNode = null;
let menuNode = null;
// screens that are «part of the menu» and should keep the menu music playing
const isMenuFamily = (name) => name === "menu" || name === "help" || name === "slots" || name === "scores";
// fiskeoppsynet (license inspector) — a rare visiting NPC
let inspector = { active: false, t: 0, x: -18, phase: "in", line: "", fined: false };
let inspectorTimer = 80 + Math.random() * 120;
// per-location random happenings (themed like the inspector but unique to each water)
let gameEvent = { active: false, t: 0, dur: 0, title: "", line: "", color: "#cfe" };
let eventTimer = 45 + Math.random() * 65;
let catStealTimer = 80 + Math.random() * 110;
// a shared little breather between «notable» happenings (events, inspector, cat-steal, hat seller)
// so they never pile on top of each other — there's always a calm gap of just fishing in between
let momentGap = 0;
// a fish «vaker» (rises) out in the open water now and then — cast onto it for a luck/size bonus
let riseSpot = { active: false, x: 0, y: 0, t: 0, dur: 0, timer: 7 + Math.random() * 12, ringT: 0 };
let castOnRise = false;

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
  x: Math.random() * W, y: 188 + (i % 3) * 5,
  dir: Math.random() < 0.5 ? 1 : -1, sp: 10 + Math.random() * 12,
  coat: NPC_COLORS[i % NPC_COLORS.length][0], hat: NPC_COLORS[i % NPC_COLORS.length][1],
  ph: Math.random() * 6.28, pause: 0,
}));
const ripples = [];
function addRipple(x, y, max = 14) { ripples.push({ x, y, r: 1, max, life: 1 }); }
// occasional comical street happenings at the market
let marketGag = { active: false, t: 0, dur: 0, kind: "", dir: 1, seed: 0 };
let marketGagTimer = 4 + Math.random() * 6;
const MARKET_GAGS = ["dog", "cat", "gull", "barrel", "balloon", "pee", "hat", "trip", "busker", "snatch", "couple", "rat"];
function startMarketGag() {
  const kind = MARKET_GAGS[Math.floor(Math.random() * MARKET_GAGS.length)];
  const dur = kind === "balloon" ? 4 : kind === "pee" ? 7.5 : kind === "busker" ? 8 : kind === "hat" ? 5 : kind === "couple" ? 5.5 : kind === "snatch" ? 4.5 : kind === "trip" ? 3.5 : 3;
  marketGag = { active: true, t: 0, dur, kind, dir: Math.random() < 0.5 ? 1 : -1, seed: Math.random() * 6.28 };
  // little procedural sound stings for some of the gags
  if (kind === "gull" || kind === "snatch") { setTimeout(() => { blip(1400, 0.06, "sawtooth", 0.05); setTimeout(() => blip(1700, 0.05, "sawtooth", 0.045), 80); }, 200); }
  else if (kind === "hat") noise(0.4, 600, 0.06, "highpass");        // a whoosh of wind
  else if (kind === "trip") setTimeout(() => { noise(0.12, 200, 0.08); blip(180, 0.1, "square", 0.05); }, 60);
  else if (kind === "rat") setTimeout(() => { blip(1900, 0.04, "square", 0.03); blip(2100, 0.03, "square", 0.025, 0.05); }, 150);
  else if (kind === "busker") { const tune = [523, 659, 784, 659, 587, 784]; tune.forEach((f, i) => blip(f, 0.18, "triangle", 0.05, 0.25 + i * 0.28)); }
}

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
// a pitch-sweeping tone with a slow vibrato — used for unearthly wails & ghostly moans
function wail(f0, f1, dur, vol = 0.12, type = "sawtooth", when = 0) {
  if (muted || !audioCtx) return;
  const tt = audioCtx.currentTime + when;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, tt);
  o.frequency.linearRampToValueAtTime(f1, tt + dur);
  g.gain.setValueAtTime(0.0001, tt);
  g.gain.exponentialRampToValueAtTime(vol, tt + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, tt + dur);
  // a slow vibrato makes it warble like a ghost's moan
  const lfo = audioCtx.createOscillator(), lg = audioCtx.createGain();
  lfo.type = "sine"; lfo.frequency.value = 5.5; lg.gain.value = f0 * 0.05;
  lfo.connect(lg).connect(o.frequency);
  o.connect(g).connect(masterGain || audioCtx.destination);
  o.start(tt); o.stop(tt + dur + 0.05); lfo.start(tt); lfo.stop(tt + dur + 0.05);
}

/* ---- recorded samples (mp3 files in /lyder) ---- */
const SAMPLES = { burp: "burp", fart: "fart", engine: "engine", yiha: "yiha", howl: "howl", cigar: "lighitng-cigar", radio: "radiosong1", radio2: "radiosong2", radio3: "radiosong3", radio4: "radiosong4", hoo: "hooooo", party: "muffled-party-music", moan: "woman-moan", scream: "Red girl screaming loud", grumpyVoice: "grumpy-man-sound", ohbro: "oh-brother", eyybro: "eyy-eyy-eyy-sup-my.bro", market: "market-sound", casinoAmb: "casino-ambient-sound", casinoSpin: "casino-spin", spinLose: "spin-lose", spinLose2: "spin-lose2", ladyWelcome: "lady-welcome-talk", menuMusic: "menu-music", introMusic: "intro-music", catPurr: "cat-purring", catAngry: "cat-angry-meow", sinister: "sinister-laugh", motor: "backgorund-motor.sound", bottleBreak: "glass-bottle-breaking", blackout: "blacokout", buying: "buying-item", radio5: "radiosong5", radio6: "radiosong6", sellFishBg: "sell-fish-shop-backgorund-music", licenseAmb: "fiskekort-ambience" };
const sampleEls = {};
for (const k in SAMPLES) { const a = new Audio(`lyder/${encodeURIComponent(SAMPLES[k])}.mp3`); a.preload = "auto"; sampleEls[k] = a; }
// some clips have dead air at the front — skip straight to where the sound actually starts
const SAMPLE_OFFSETS = { buying: 1.5 };
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
  const startAt = opts.offset != null ? opts.offset : (SAMPLE_OFFSETS[name] || 0);   // skip leading silence in some clips (e.g. the buy sfx)
  try { node.currentTime = startAt; } catch (e) {}
  const pr = node.play();
  if (pr && pr.then) { node._playPromise = pr; pr.then(() => { if (node._stopped) { try { node.pause(); } catch (e) {} } else if (startAt) { try { if (node.currentTime < startAt - 0.05) node.currentTime = startAt; } catch (e) {} } }).catch(() => {}); }
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
let motorNode = null;        // looping idle motor while you hover the parked truck
let purrNode = null;         // looping purr while you pet the cat
let licenseBoughtThisVisit = false;
function stopMotor() { if (motorNode) { stopSample(motorNode); motorNode = null; } }
function stopPurr() { if (purrNode) { stopSample(purrNode); purrNode = null; } }
function startEngine() {
  engineNode = playSample("engine", { vol: 0.45, loop: true });
  playSample("yiha", { vol: 0.85 });
}
function stopEngine() {
  stopSample(engineNode); engineNode = null;
}
let frogTimer = 3 + Math.random() * 5, owlTimer = 10 + Math.random() * 14;
let ladyIdleTimer = 3, rodIdleTimer = 4;
// the fiskekort warden: a smug, profiteering bureaucrat who stamps papers and rubs his hands
let licenseIdleTimer = 4, wardenStamp = 0, wardenScheme = 0, wardenLine = 0;
const WARDEN_LINES = [
  "Fiskeoppsynet var her i sted... heldig at du har kortet i orden, hva?",
  "Et kort i dag holder boten unna i morgen. Smart investering.",
  "Reglene er reglene. Jeg lager dem ikke — jeg bare... selger dem.",
  "Hørte om han som fisket uten kort. Trist historie. Dyr historie.",
  "Helt tilfeldig at oppsynet alltid vet akkurat hvor de skal lete, ja...",
  "Stempel hit, stempel dit. Pengene ruller inn av seg selv.",
  "Du ser ærlig ut. Men ærlige folk kjøper kort, ikke sant?",
];
function wardenChuckle() {
  if (muted || !audioCtx) return;
  blip(220, 0.08, "square", 0.045); blip(180, 0.09, "square", 0.04, 0.09); blip(150, 0.11, "square", 0.035, 0.19);
}
function wardenStampSfx() {
  if (muted || !audioCtx) return;
  noise(0.07, 220, 0.07); blip(130, 0.06, "square", 0.05);
}

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
let radio = { on: true };
let radioNode = null;
const RADIO_SONGS = ["radio", "radio2", "radio3", "radio4", "radio5", "radio6"];
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
  } else if (kind === "thong") {
    // a frilly pink ladies' thong (a daft catch)
    for (let x = -4; x <= 4; x++) { cell(x, -3, "#e87aa6"); cell(x, -2, "#f4a8c8"); }
    for (let x = -2; x <= 2; x++) cell(x, -1, "#f099bd");
    cell(-1, 0, "#f099bd"); cell(0, 0, "#f099bd"); cell(1, 0, "#f099bd");
    cell(0, 1, "#f099bd"); cell(0, 2, "#f099bd");
    cell(-4, -4, "#ffd0e2"); cell(0, -4, "#ffd0e2"); cell(4, -4, "#ffd0e2");
  } else if (kind === "duck") {
    for (let x = -2; x <= 2; x++) for (let y = 0; y <= 2; y++) cell(x, y, "#f4c83a");   // body
    for (let x = -3; x <= -1; x++) for (let y = -3; y <= -1; y++) cell(x, y, "#f4c83a"); // head
    cell(-4, -2, "#e8902a"); cell(-5, -2, "#e8902a");                                    // beak
    cell(-2, -2, "#1a1a1a");                                                             // eye
    for (let x = -2; x <= 3; x++) cell(x, 3, "#3a6a8a");                                 // water line
  } else if (kind === "glasses") {
    for (const lx of [-3, 1]) { cell(lx, -1, "#2a2a2a"); cell(lx + 1, -1, "#2a2a2a"); cell(lx, 0, "#2a2a2a"); cell(lx + 1, 0, "#2a2a2a"); }
    cell(-2, -1, "#bfe6ef"); cell(2, -1, "#bfe6ef");   // glints in the lenses
    cell(-1, -1, "#2a2a2a"); cell(0, -1, "#2a2a2a");   // bridge
    cell(-5, -1, "#2a2a2a"); cell(3, -1, "#2a2a2a");   // arms
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
  if (knockout.active) return;          // passed out cold — no fishing until he comes to
  if (screen === "intro") { if (!intro.running) startIntroPlayback(); else endIntro(); return; }
  if (screen === "market") {
    if (inRect(p.x, p.y, MARKET_TRUCK)) { mapReturn = "market"; sfxHorn(); setScreen("map"); return; }
    if (inRect(p.x, p.y, FISH_STALL)) { setScreen("shopFish"); }
    else if (inRect(p.x, p.y, KIOSK_STALL)) { sfxKiosk(); setScreen("shopKiosk"); }
    else if (inRect(p.x, p.y, ROD_STALL)) { setScreen("shopRod"); }
    else if (inRect(p.x, p.y, CASINO_STALL)) { setScreen("shopCasino"); }
    else if (inRect(p.x, p.y, LICENSE_BOOTH)) { sfxClink(); setScreen("shopLicense"); }
    return;
  }
  if (screen === "map") {
    if (Math.hypot(p.x - MAP_MARKET.x, p.y - (MAP_MARKET.y - 12)) < 20) { tryTravel("market"); return; }
    for (const sp of MAP_SPOTS) {
      if (Math.hypot(p.x - sp.x, p.y - (sp.y - 12)) < 18) { tryTravel(sp.key); return; }
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
      else if (it.key === "_hats") { hatPanel = true; sfxClink(); }
      else if (it.key === "_records") { recordsPanel = true; sfxClink(); }
      else if (it.key === "_funn") { funnPanel = true; sfxClink(); }
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
  // hatter wardrobe (from the sekk): equip a hat you already own
  if (hatPanel) {
    if (backBtnRect && inRect(p.x, p.y, backBtnRect)) { hatPanel = false; coolerMenu = true; sfxClink(); return; }
    for (const rr of hatRowRects) if (inRect(p.x, p.y, rr)) {
      if (save.hat !== rr.key) { save.hat = rr.key; persist(); setHint("Byttet til " + (HAT_BY_KEY[rr.key] || {}).name); }
      sfxClink(); hatPanel = false; return;
    }
    hatPanel = false; return;
  }
  // hat seller's shop: buy a new hat (auto-equips) or switch to one you own — stays open
  if (hatShop) {
    if (backBtnRect && inRect(p.x, p.y, backBtnRect)) { hatShop = false; hatSeller.t = 0; sfxClink(); return; }
    for (const rr of hatRowRects) if (inRect(p.x, p.y, rr)) { buyOrEquipHat(rr.key); return; }
    hatShop = false; hatSeller.t = 0; return;
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
  if (funnPanel) {
    if (backBtnRect && inRect(p.x, p.y, backBtnRect)) { funnPanel = false; coolerMenu = true; sfxClink(); return; }
    funnPanel = false; return;
  }
  // the wandering hat seller — tap her while she's up on the bank to open her hat stall
  if ((hatSeller.state === "approach" || hatSeller.state === "idle") &&
      inRect(p.x, p.y, { x: hatSeller.x - 16, y: hatSeller.y - 26, w: 34, h: 38 })) {
    openHatShop(); return;
  }
  // shoo the thieving cat before it slinks off with your smallest fish
  if (cat.mission === "steal" && (cat.state === "arrive" || cat.state === "grab" || cat.state === "carry") &&
      inRect(p.x, p.y, { x: cat.x - 14, y: cat.y - 20, w: 34, h: 26 })) {
    cat.state = "flee"; cat.mission = null; cat.fishKey = null; cat.t = 0; catYowl();
    showCatEvent("Du jaget katten!", "Pus mjauer surt og stikker av — fisken er reddet.");
    return;
  }
  // pet the friendly cat whenever it's around (lounging OR padding about) → it settles down and purrs
  if (cat.state !== "away" && cat.mission == null && cat.state !== "flee" &&
      inRect(p.x, p.y, { x: cat.x - 14, y: cat.y - 20, w: 32, h: 28 })) {
    petCat(); return;
  }
  if (fishState === "reveal") { closeReveal(); return; }
  if (fishState === "ready") {
    if (inRect(p.x, p.y, padRect(TRUCK, 6))) { mapReturn = "game"; sfxHorn(); setScreen("map"); return; }
    if (inRect(p.x, p.y, padRect(SEKK, 10))) { coolerMenu = true; sfxClink(); return; }
    if (inRect(p.x, p.y, padRect(RADIO, 6))) { clickRadio(); return; }
    // cast where you click on the water (keyboard uses default spot)
    if (p.x >= 0 && p.y > WATER_Y) {
      castTarget.x = clamp(p.x, 185, 462);
      castTarget.y = clamp(p.y, WATER_Y + 14, H - 26);
    } else {
      castTarget.x = BOBBER_HOME.x; castTarget.y = BOBBER_HOME.y;
    }
    // a cast that lands on the rising fish gets a luck + quick-bite bonus
    castOnRise = riseSpot.active && Math.hypot(castTarget.x - riseSpot.x, castTarget.y - riseSpot.y) < 32;
    if (castOnRise) { riseSpot.active = false; sfxCoin(); setHint("Rett p\u00e5 vaket! Her napper det godt \uD83C\uDFAF"); }
    startCast(); return;
  }
  // a click while the line is just out (casting/waiting) reels it back in — a clean cancel
  if (fishState === "casting" || fishState === "waiting") { cancelFishing(); return; }
  if (fishState === "bite") { hookFish(); return; }
  if (fishState === "hooked") { holding = true; return; }
}

canvas.addEventListener("mousedown", (e) => { e.preventDefault(); canvasPress(toCanvas(e)); });
canvas.addEventListener("mouseup", () => (holding = false));
canvas.addEventListener("mouseleave", () => { holding = false; hover.on = false; hoverProp = null; canvas.style.cursor = "default"; });
canvas.addEventListener("touchstart", (e) => { touchMode = true; e.preventDefault(); canvasPress(toCanvas(e)); }, { passive: false });
canvas.addEventListener("touchend", (e) => { e.preventDefault(); holding = false; }, { passive: false });
canvas.addEventListener("touchcancel", () => { holding = false; }, { passive: false });

// hover feedback: a pointer cursor (and an in-scene highlight) over anything clickable
let hover = { x: -1, y: -1, on: false };
let touchMode = false;       // set on first touch — drives always-on labels for phones
let hoverProp = null;        // "truck" | "sekk" | "radio" — highlighted in the fishing scene
let marketHover = null;      // {rect,label} currently hovered in the market
function interactiveAt(p) {
  if (screen === "intro") return "play";
  if (screen === "menu") return null; // menu uses real DOM buttons
  if (screen === "market") {
    if (inRect(p.x, p.y, MARKET_TRUCK) || inRect(p.x, p.y, FISH_STALL) || inRect(p.x, p.y, KIOSK_STALL) || inRect(p.x, p.y, ROD_STALL) || inRect(p.x, p.y, CASINO_STALL) || inRect(p.x, p.y, LICENSE_BOOTH)) return "btn";
    return null;
  }
  if (screen === "map") {
    if (Math.hypot(p.x - MAP_MARKET.x, p.y - (MAP_MARKET.y - 12)) < 20) return "btn";
    for (const sp of MAP_SPOTS) if (Math.hypot(p.x - sp.x, p.y - (sp.y - 12)) < 18) return "btn";
    return null;
  }
  if (screen !== "game") return null;
  if (truckMenu) { for (const it of truckItemRects()) if (inRect(p.x, p.y, it)) return "btn"; return "btn"; }
  if (coolerMenu) { if (backBtnRect && inRect(p.x, p.y, backBtnRect)) return "btn"; for (const it of coolerItemRects()) if (inRect(p.x, p.y, it)) return "btn"; return "btn"; }
  if (godsakerPanel) { if (backBtnRect && inRect(p.x, p.y, backBtnRect)) return "btn"; for (const it of godsakerRects()) if (inRect(p.x, p.y, it)) return "btn"; return "btn"; }
  if (funnPanel) return "btn";
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
  if (!hover.on) { canvas.style.cursor = "default"; hoverProp = null; marketHover = null; stopMotor(); return; }
  const k = interactiveAt(hover);
  hoverProp = (screen === "game" && fishState === "ready" && (k === "truck" || k === "sekk" || k === "radio")) ? k : null;
  marketHover = screen === "market" ? marketTarget(hover) : null;
  // the parked truck idles + smokes while you hover it (fishing scene AND the market's pickup)
  const truckHovered = (hoverProp === "truck") || (screen === "market" && marketHover && marketHover.rect === MARKET_TRUCK);
  if (truckHovered && !motorNode) motorNode = playSample("motor", { loop: true, vol: 0.4 });
  else if (!truckHovered) stopMotor();
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

// touch devices have no hover, so always label the three tappable props while you're idle
function drawTouchHints() {
  if (!touchMode || screen !== "game" || fishState !== "ready") return;
  if (truckMenu || coolerMenu || godsakerPanel || rodPanel || bagPanel || recordsPanel || funnPanel || hatPanel || hatShop) return;
  const pulse = 0.55 + 0.45 * Math.sin(t * 3);
  ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const [r, label] of [[TRUCK, "Reise"], [SEKK, "Sekk"], [RADIO, "Radio"]]) {
    const lx = r.x + r.w / 2, ly = r.y - 6;
    const lw = ctx.measureText(label).width + 6;
    ctx.globalAlpha = 0.8;
    px(Math.round(lx - lw / 2), Math.round(ly - 5), Math.round(lw), 10, "rgba(14,12,22,0.7)");
    ctx.globalAlpha = 0.7 + 0.3 * pulse;
    ctx.fillStyle = "#ffe6a0"; ctx.fillText(label, lx, ly);
  }
  ctx.globalAlpha = 1; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
// market interactables share the fishing scene's hover style (no permanent outlines)
const MARKET_TARGETS = () => [
  [FISH_STALL, "Selg fisk"], [KIOSK_STALL, "Kiosk"], [ROD_STALL, "Stenger"],
  [CASINO_STALL, "Kasino"], [LICENSE_BOOTH, "Fiskekort"], [MARKET_TRUCK, "Reise"],
];
function marketTarget(p) {
  for (const [r, label] of MARKET_TARGETS()) if (inRect(p.x, p.y, r)) return { rect: r, label };
  return null;
}
function drawMarketLabel(r, label, alpha) {
  ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  const lx = r.x + r.w / 2, ly = r.y + r.h + 4, lw = ctx.measureText(label).width + 8;
  ctx.globalAlpha = alpha; px(Math.round(lx - lw / 2), ly - 1, Math.round(lw), 11, "rgba(14,12,22,0.82)");
  ctx.globalAlpha = 1; ctx.fillStyle = "#ffe6a0"; ctx.fillText(label, lx, ly + 1);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function drawMarketHover() {
  // on touch there's no hover — the wooden signs already name every booth, so skip the
  // always-on label spam that used to clutter the scene and hide where you are
  if (touchMode) return;
  if (!marketHover) return;
  const r = marketHover.rect, pulse = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.globalAlpha = 0.45 + 0.45 * pulse; ctx.strokeStyle = "#ffe6a0"; ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, r.w - 1, r.h - 1);
  ctx.globalAlpha = 1;
  drawMarketLabel(r, marketHover.label, 0.9);
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
    else if (screen === "scores") setScreen(prevScreen === "menu" ? "menu" : "game");
    else if (screen === "slots") setScreen(prevScreen === "menu" ? "menu" : "game");
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
// remember the leaderboard name as it's typed; Enter submits
const playerNameEl = $("playerName");
if (playerNameEl) {
  playerNameEl.addEventListener("change", () => { save.playerName = cleanName(playerNameEl.value); persist(); });
  playerNameEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); submitScore(); } });
}
// new-game name field: Enter starts the game
const newGameNameEl = $("newGameName");
if (newGameNameEl) {
  newGameNameEl.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); confirmNewGame(); } });
}
syncVolUI();

/* =========================================================================
   Save slots (up to 3 separate games) — managed from the menu
   ========================================================================= */
function buildSlots() {
  const list = $("slotList"); if (!list) return;
  list.innerHTML = "";
  for (let i = 0; i < SLOT_COUNT; i++) {
    const sum = slotSummary(i);
    const active = i === currentSlot;
    const row = document.createElement("div");
    row.className = "slot-row" + (active ? " active" : "");
    const title = `Plass ${i + 1}` + (active ? " · aktiv" : "");
    const info = sum
      ? `${sum.name ? escapeHtml(sum.name) + " · " : ""}${fmt(sum.money)} kr · ${sum.species} arter<br><small>${escapeHtml(sum.location)}</small>`
      : "<small>Tom plass — start et nytt eventyr</small>";
    row.innerHTML =
      `<span class="grow"><b>${title}</b><br>${info}</span>` +
      `<span class="slot-btns">` +
      `<button class="buy-btn" data-action="playSlot" data-slot="${i}">${sum ? "Spill" : "Nytt"}</button>` +
      (sum ? `<button class="del-btn" data-action="deleteSlot" data-slot="${i}" title="Slett">🗑</button>` : "") +
      `</span>`;
    list.appendChild(row);
  }
}
// wipe every bit of transient world state so a fresh slot never inherits the old game's
// buff/fyll, cat mid-steal, lingering event banner, knockout or thrown clutter
function resetTransientState() {
  buff = { label: "", luck: 0, reel: 0, t: 0, dur: 1, color: "#fff" };
  drunk = 0; buffFlash = 0; smoking = 0; snusing = 0;
  knockout.active = false; knockout.t = 0;
  hangover = 0; staggerWarned = false;
  gameEvent.active = false;
  inspector.active = false; inspectorTimer = 80 + Math.random() * 120;
  cat.state = "away"; cat.x = -20; cat.mission = null; cat.fishKey = null; cat.action = "sit"; cat.timer = 14 + Math.random() * 26;
  hatSeller.state = "away"; hatSeller.x = 108; hatSeller.y = 280; hatSeller.t = 0; hatSeller.timer = 150 + Math.random() * 180;
  hatPanel = false; hatShop = false;
  cans.length = 0; smoke.length = 0; ripples.length = 0;
}
function playSlot(slot) {
  slot = parseInt(slot, 10);
  if (!(slot >= 0 && slot < SLOT_COUNT)) return;
  if (slot !== currentSlot) {
    persist();                                   // stash the slot we're leaving
    currentSlot = slot;
    try { localStorage.setItem(SLOT_KEY, String(slot)); } catch (e) {}
    save = loadSave(slot);
    resetTransientState();
    setLocation(save.location);
    refreshAll();
  }
  rollWeather();
  setScreen("game");
}
function deleteSlot(slot) {
  slot = parseInt(slot, 10);
  if (!(slot >= 0 && slot < SLOT_COUNT)) return;
  if (!confirm(`Slette spillet i Plass ${slot + 1}? Dette kan ikke angres.`)) return;
  try { localStorage.removeItem(slotKey(slot)); } catch (e) {}
  if (slot === currentSlot) {                    // wipe the live game back to a fresh start
    save = loadSave(slot);
    persist();
    setLocation(save.location);
    resetTransientState();
    refreshAll();
  }
  buildSlots();
}

/* =========================================================================
   New game + name entry — every fresh game gets a fisher name up front, so the
   leaderboard works automatically and players never juggle data by hand.
   ========================================================================= */
let pendingNewSlot = -1;       // which slot the name screen is creating a game for
let newGameReturn = "menu";    // where «Avbryt» goes back to

// a slot nobody has named or earned anything in yet
function slotIsFresh(slot) {
  const sum = slotSummary(slot);
  return !sum || (!sum.name && !sum.money && !sum.species);
}
// "Start spill" from the menu: name first if this game has no fisher yet
function startGame() {
  if (!save.playerName) promptNewGame(currentSlot);
  else setScreen(menuReturn === "market" ? "market" : "game");   // resume right where you opened the menu
}
// pick a slot: brand-new ones go through the name screen, played ones load straight in
function enterSlot(slot) {
  slot = parseInt(slot, 10);
  if (!(slot >= 0 && slot < SLOT_COUNT)) return;
  if (slotIsFresh(slot)) promptNewGame(slot);
  else playSlot(slot);
}
function promptNewGame(slot) {
  newGameReturn = screen === "slots" ? "slots" : "menu";
  pendingNewSlot = parseInt(slot, 10);
  setScreen("newGame");
  const input = $("newGameName");
  if (input) { input.value = ""; setTimeout(() => { try { input.focus(); } catch (e) {} }, 60); }
}
function confirmNewGame() {
  const input = $("newGameName");
  const name = cleanName(input ? input.value : "");
  if (!name) { if (input) { try { input.focus(); } catch (e) {} } return; }
  const slot = pendingNewSlot >= 0 ? pendingNewSlot : currentSlot;
  if (slot !== currentSlot) {                    // switch into a different fresh slot
    persist();
    currentSlot = slot;
    try { localStorage.setItem(SLOT_KEY, String(slot)); } catch (e) {}
    save = loadSave(slot);
    resetTransientState();
    setLocation(save.location);
  }
  save.playerName = name; persist();
  refreshAll();
  pendingNewSlot = -1;
  rollWeather();
  setScreen("game");
}
function cancelNewGame() {
  pendingNewSlot = -1;
  setScreen(newGameReturn);
}

function doAction(a, data) {
  switch (a) {
    case "startGame": startGame(); break;
    case "watchIntro": if (menuNode) { stopSample(menuNode); menuNode = null; } startIntro(); startIntroPlayback(); break;
    case "openMarket": setScreen("market"); break;
    case "openMap": mapReturn = screen === "market" ? "market" : "game"; setScreen("map"); break;
    case "openHelp": prevScreen = screen; setScreen("help"); break;
    case "openMenu": menuReturn = screen === "market" ? "market" : "game"; setScreen("menu"); break;
    case "backToGame": setScreen("game"); break;
    case "backFromMap": setScreen(mapReturn === "market" ? "market" : "game"); break;
    case "driveBack": startTravel(save.location); break;
    case "shopFish": setScreen("shopFish"); break;
    case "shopRod": setScreen("shopRod"); break;
    case "shopLicense": setScreen("shopLicense"); break;
    case "sellAll": sellAll(); break;
    case "sellSpecies": sellSpecies(data.key); break;
    case "buyRod": buyRod(parseInt(data.level, 10)); break;
    case "equipRod": equipRod(parseInt(data.level, 10)); break;
    case "buyConsumable": buyConsumable(data.kind); break;
    case "buyLicense": buyLicense(data.key); break;
    case "openKiosk": setScreen("shopKiosk"); break;
    case "casinoColor": casinoColor(data.color); break;
    case "casinoBet": casinoBet(data.amt); break;
    case "casinoSpin": casinoSpin(); break;
    case "backFromHelp": setScreen(prevScreen === "menu" ? "menu" : "game"); break;
    case "openScores": prevScreen = screen; openScores(); break;
    case "backFromScores": setScreen(prevScreen === "menu" ? "menu" : "game"); break;
    case "submitScore": submitScore(); break;
    case "openSlots": prevScreen = screen; setScreen("slots"); break;
    case "backFromSlots": setScreen(prevScreen === "menu" ? "menu" : "game"); break;
    case "playSlot": enterSlot(data.slot); break;
    case "deleteSlot": deleteSlot(data.slot); break;
    case "confirmNewGame": confirmNewGame(); break;
    case "cancelNewGame": cancelNewGame(); break;
    case "toggleMute": toggleMute(); break;
    case "toggleFullscreen": toggleFullscreen(); break;
  }
}

function toggleMute() {
  muted = !muted;
  if (masterGain) masterGain.gain.value = effVol();
  if (muted) activeLoops.forEach((n) => { try { n.pause(); } catch (e) {} });
  else activeLoops.forEach((n) => { n.volume = (n._baseVol == null ? 1 : n._baseVol) * effVol(); const pr = n.play(); if (pr && pr.catch) pr.catch(() => {}); });
  if (muted) stopAllVoices();
  // if we just unmuted on the menu and music never started, kick it off now
  if (!muted && isMenuFamily(screen) && !menuNode) menuNode = playSample("menuMusic", { loop: true, vol: 0.5 });
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
  if (wasMuted && !muted && isMenuFamily(screen) && !menuNode) menuNode = playSample("menuMusic", { loop: true, vol: 0.5 });
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
   Global leaderboard (dreamlo) — two boards from one submission:
     • score  field → "Storfiskeren": species + trophies + skill (mastery)
     • seconds field → "Største fangst": your single heaviest fish, in grams
   dreamlo is http-only, but the game is served over https, so every request is
   routed through a public https CORS proxy to avoid mixed-content blocking.
   ========================================================================= */
const DREAMLO_PUBLIC = "6a25cca68f40bb17b07b2d4d";
const DREAMLO_PRIVATE = "lV6DCx6CQEGJ1uIa1epi1AcY_5FKrgHUeWLrsvn-692A";
const DREAMLO_BASE = "http://dreamlo.com/lb/";
const SCORE_PROXIES = [
  // corsproxy.io + codetabs are the most reliable right now; allorigins is flaky (522s)
  { url: (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u), unwrap: (t) => t },
  { url: (u) => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u), unwrap: (t) => t },
  { url: (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u), unwrap: (t) => t },
  // allorigins /get wraps the body in JSON .contents — last resort
  { url: (u) => "https://api.allorigins.win/get?url=" + encodeURIComponent(u), unwrap: (t) => { try { return JSON.parse(t).contents; } catch (e) { return t; } } },
  { url: (u) => "https://thingproxy.freeboard.io/fetch/" + u, unwrap: (t) => t },
];
let scoresBusy = false;

// turn the local save into the two board values + a human summary line
function computeScore() {
  let species = 0, trophies = 0, totalKg = 0, totalCount = 0, biggestKg = 0, biggestName = "";
  const tally = (f, isTrophy) => {
    const r = save.record[f.key];
    if (!r || !r.count) return;
    if (isTrophy) trophies++; else species++;
    totalCount += r.count; totalKg += r.best;
    if (r.best > biggestKg) { biggestKg = r.best; biggestName = f.name; }
  };
  for (const f of FISH) tally(f, false);
  for (const f of RARES) tally(f, true);
  const score = species * 1000 + trophies * 2500 + Math.round(totalKg * 100) + totalCount * 5;
  const biggestG = Math.round(biggestKg * 1000);
  const text = `${species} arter, ${trophies} trofeer` + (biggestName ? `, ${biggestName} ${biggestKg.toFixed(2)} kg` : "");
  return { score, species, trophies, totalCount, biggestKg, biggestName, biggestG, text };
}

// sanitise a player name for dreamlo (no asterisks/slashes, trimmed, capped)
function cleanName(n) {
  return (n || "").replace(/[*\/\\<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
}

// fetch a dreamlo URL through the first proxy that answers
async function proxyGet(dreamloUrl) {
  const bust = dreamloUrl + (dreamloUrl.includes("?") ? "&" : "?") + "_=" + Date.now();
  let lastErr;
  for (const p of SCORE_PROXIES) {
    try {
      const res = await fetch(p.url(bust), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const raw = await res.text();
      return p.unwrap(raw);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("fetch failed");
}

function parseDreamlo(txt) {
  let j; try { j = JSON.parse(txt); } catch (e) { return []; }
  const lb = j && j.dreamlo && j.dreamlo.leaderboard;
  if (!lb || !lb.entry) return [];
  const arr = Array.isArray(lb.entry) ? lb.entry : [lb.entry];
  return arr.filter((e) => e && typeof e === "object");   // never let null/blank rows through to render
}

function renderScoreList(elId, entries, valFn) {
  const el = $(elId); if (!el) return;
  const me = cleanName(save.playerName);
  if (!entries.length) { el.innerHTML = '<li class="score-empty">Ingen poeng ennå — bli den første!</li>'; return; }
  el.innerHTML = entries.slice(0, 15).map((e) => {
    const name = (e.name || "").toString();
    const mine = me && name.toLowerCase() === me.toLowerCase();
    const sub = (e.text || "").toString();
    return `<li class="score-row${mine ? " me" : ""}"><span class="s-name" title="${escapeHtml(sub)}">${escapeHtml(name)}</span><span class="s-val">${valFn(e)}</span></li>`;
  }).join("");
}

function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

async function loadScores() {
  const byScore = $("listMastery"), byBig = $("listBiggest");
  if (byScore) byScore.innerHTML = '<li class="score-empty">Laster …</li>';
  if (byBig) byBig.innerHTML = '<li class="score-empty">Laster …</li>';
  try {
    const [a, b] = await Promise.all([
      proxyGet(DREAMLO_BASE + DREAMLO_PUBLIC + "/json/0/15"),
      proxyGet(DREAMLO_BASE + DREAMLO_PUBLIC + "/json-seconds/0/15"),
    ]);
    renderScoreList("listMastery", parseDreamlo(a), (e) => fmt(parseInt(e.score, 10) || 0) + " p");
    renderScoreList("listBiggest", parseDreamlo(b), (e) => ((parseInt(e.seconds, 10) || 0) / 1000).toFixed(2) + " kg");
  } catch (e) {
    const msg = '<li class="score-empty">Kunne ikke laste topplista.</li>';
    if (byScore) byScore.innerHTML = msg;
    if (byBig) byBig.innerHTML = msg;
  }
}

function openScores() {
  setScreen("scores");
  const input = $("playerName");
  if (input) input.value = save.playerName || "";
  const sc = computeScore();
  const my = $("myScore");
  if (my) my.textContent = sc.score > 0
    ? `Din poengsum: ${fmt(sc.score)} p · ${sc.species} arter · ${sc.trophies} troféer` + (sc.biggestName ? ` · største ${sc.biggestName} ${sc.biggestKg.toFixed(2)} kg` : "")
    : "Fang noen fisk først, så havner du på topplista!";
  const st = $("scoreStatus"); if (st) st.textContent = "";
  loadScores();
}

async function submitScore() {
  if (scoresBusy) return;
  const input = $("playerName");
  const name = cleanName(input ? input.value : save.playerName);
  const st = $("scoreStatus");
  if (!name) { if (st) st.textContent = "Skriv inn et navn først."; if (input) input.focus(); return; }
  const sc = computeScore();
  if (sc.score <= 0) { if (st) st.textContent = "Du må fange minst én fisk før du kan sende inn."; return; }
  save.playerName = name; persist();
  scoresBusy = true;
  if (st) st.textContent = "Sender inn …";
  const url = DREAMLO_BASE + DREAMLO_PRIVATE + "/add/" + encodeURIComponent(name) + "/" + sc.score + "/" + sc.biggestG + "/" + encodeURIComponent(sc.text);
  try {
    await proxyGet(url);
    if (st) st.textContent = "Poengsum sendt inn! 🎣";
    await loadScores();
  } catch (e) {
    if (st) st.textContent = "Klarte ikke å sende inn — prøv igjen om litt.";
  } finally {
    scoresBusy = false;
  }
}

// fire-and-forget submit during a travel cutscene — no UI, only if we have a name + score.
// keeps the leaderboard fresh by itself so casual players never have to think about it.
async function autoSubmitScore() {
  const name = cleanName(save.playerName);
  if (!name) return;
  const sc = computeScore();
  if (sc.score <= 0) return;
  const url = DREAMLO_BASE + DREAMLO_PRIVATE + "/add/" + encodeURIComponent(name) + "/" + sc.score + "/" + sc.biggestG + "/" + encodeURIComponent(sc.text);
  try { await proxyGet(url); } catch (e) {}
}

/* =========================================================================
   Screen management
   ========================================================================= */
const OVERLAYS = ["menu", "market", "map", "help", "scores", "slots", "newGame", "shopFish", "shopRod", "shopLicense", "shopKiosk", "shopCasino"];
function setScreen(name) {
  const from = screen;
  if (from === "travel") stopEngine();
  if (name !== "game") { stopMotor(); stopPurr(); }
  // cut any lingering voice/greeting lines from the previous screen before the new one speaks
  if (name !== from) stopAllVoices();
  coolerMenu = false; truckMenu = false; rodPanel = false; bagPanel = false; recordsPanel = false; godsakerPanel = false; funnPanel = false; hatPanel = false; hatShop = false;
  if (name !== "game") { resetFishing(); stopRadio(); inspector.active = false; hatSeller.state = "away"; }
  // rod seller: hooooo on entry (sour until purchase), fart on the way out
  if (name === "shopRod" && from !== "shopRod") { speak("rodSpeech", "Hmf. Skal du kjøpe noe, eller bare glo?"); playSample("hoo", { vol: 0.45 }); rodGrumpyBuy = false; rodHop = 0; }
  if (from === "shopRod" && name !== "shopRod") playSample("fart", { vol: 0.7 });
  // fish lady: a spoken welcome when you walk in to sell
  if (name === "shopFish" && from !== "shopFish") { speak("ladySpeech", "Hei, kjekken… har du noe fint til meg i dag?"); playSample("ladyWelcome", { vol: 0.8 }); playSample("sellFishBg", { vol: 0.28 }); }
  // casino croupier greeting
  if (name === "shopCasino" && from !== "shopCasino") playSample("ohbro", { vol: 0.7 });
  // fishing warden: a sinister cackle as you leave after actually buying a permit
  if (name === "shopLicense" && from !== "shopLicense") licenseBoughtThisVisit = false;
  if (from === "shopLicense" && name !== "shopLicense" && licenseBoughtThisVisit) { playSample("sinister", { vol: 0.7 }); licenseBoughtThisVisit = false; }
  // fishing warden: a polite greeting + paper shuffle when you visit the permit booth
  if (name === "shopLicense" && from !== "shopLicense") { speak("licenseSpeech", "God dag! Skal det være et gyldig fiskekort? Husk — fiskeoppsynet er ute og går."); blip(520, 0.05, "square", 0.04); setTimeout(() => blip(440, 0.05, "square", 0.035), 90); }  // kiosk: muffled party music on loop while inside + a greeting
  if (name === "shopKiosk" && from !== "shopKiosk") { speak("kioskSpeech", "Tjena! Trygdepatron, snus, sigarillo, blænnvin — eller snabelstoff for de tøffe? Alt for et godt fiske."); playSample("eyybro", { vol: 0.7 }); }
  // looping ambience per screen — always clear it first so nothing bleeds between screens
  if (partyNode) { stopSample(partyNode); partyNode = null; }
  if (marketNode) { stopSample(marketNode); marketNode = null; }
  if (casinoAmbNode) { stopSample(casinoAmbNode); casinoAmbNode = null; }
  if (casinoSpinNode) { stopSample(casinoSpinNode); casinoSpinNode = null; }
  if (casinoLoseNode) { stopSample(casinoLoseNode); casinoLoseNode = null; }
  if (licenseAmbNode) { stopSample(licenseAmbNode); licenseAmbNode = null; }
  if (menuNode && !isMenuFamily(name)) { stopSample(menuNode); menuNode = null; }   // «hvordan spille», lagringsplasser & toppliste er del av menyen — hold musikken gående
  if (casino.spinning && name !== "shopCasino") { casino.spinning = false; casino.win = false; }
  if (name === "shopKiosk") partyNode = playSample("party", { loop: true, vol: 0.4 });
  else if (name === "market") marketNode = playSample("market", { loop: true, vol: 0.45 });
  else if (name === "shopCasino") casinoAmbNode = playSample("casinoAmb", { loop: true, vol: 0.4 });
  else if (name === "shopLicense") licenseAmbNode = playSample("licenseAmb", { loop: true, vol: 0.4 });
  else if (isMenuFamily(name) && !menuNode) menuNode = playSample("menuMusic", { loop: true, vol: 0.5 });
  screen = name;
  OVERLAYS.forEach((o) => $(o).classList.toggle("active", o === name));
  hudEl.classList.toggle("hidden", name !== "game");
  if (name !== "game") { reelEl.classList.add("hidden"); catchEl.classList.add("hidden"); hintEl.classList.add("hidden"); }
  if (name === "game") { resetFishing(); setHint("Klikk for å kaste ut"); if (radio.on && !radioNode) { radioIdx = Math.floor(Math.random() * RADIO_SONGS.length); playRadioSong(); } }
  if (name === "shopFish") buildBasket();
  if (name === "shopRod") { buildRods(); }
  if (name === "shopLicense") buildLicenses();
  if (name === "shopKiosk") buildKiosk();
  if (name === "slots") buildSlots();
  if (name === "shopCasino") { speak("casinoSpeech", "Welcome, my friend! Velg rød eller svart, sett innsatsen og spinn. Treffer fargen vinner du dobbelt — men pass deg for grønn null! 🎩"); buildCasino(); }
  refreshHUD();
  ensureAudio();
  hoverProp = null; updateCursor();   // recompute the cursor for the new screen even without a mouse move
}

function refreshHUD() {
  moneyEl.textContent = fmt(save.money);
  basketCountEl.textContent = save.basket.length;
  rodNameEl.textContent = rod().name;
  if (licenseStateEl) {
    const lic = currentLicense();
    licenseStateEl.textContent = lic > 0 ? "✓ " + lic : "✗ mangler";
    licenseStateEl.style.color = lic > 0 ? "#9affc0" : "#ff8a7a";
  }
  document.querySelectorAll(".moneyMirror").forEach((e) => (e.textContent = fmt(save.money)));
}
function refreshAll() { refreshHUD(); buildBasket(); buildRods(); buildLicenses(); buildKiosk(); }

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
  castOnRise = false; bigFishTired = false;
}
// reel the line straight back in without a fish — lets you bail out of a cast you regret
function cancelFishing() {
  resetFishing();
  sfxPlop();
  setHint("Du sveiver inn igjen — klikk for å kaste ut");
}
// ---- drunk blackout (cartoon iris-out) ----
function startKnockout() {
  knockout.active = true; knockout.t = 0; knockout.phase = "wooze";
  holding = false; if (fishState !== "ready") resetFishing();
  // a clear, readable lead-in so the blackout never feels like it jumped out of nowhere
  setHint("Uff… hodet snurrer. Du klarer ikke holde deg våken…");
  blip(220, 0.4, "sine", 0.06); blip(150, 0.7, "sine", 0.05, 0.18);
  setTimeout(() => { try { playSample("burp", { vol: 0.9 }); } catch (e) {} }, 260);
}
function updateKnockout(dt) {
  knockout.t += dt;
  const ph = knockout.phase;
  // slow, readable lead-in: he sways hard and the world dims before he actually drops
  if (ph === "wooze" && knockout.t > 1.5) {
    knockout.phase = "fall"; knockout.t = 0;
    playSample("blackout", { vol: 0.85 });
    blip(120, 0.18, "sawtooth", 0.08); setTimeout(() => { try { noise(0.22, 800, 0.08, "lowpass"); } catch (e) {} }, 160);
  }
  else if (ph === "fall" && knockout.t > 1.3) { knockout.phase = "close"; knockout.t = 0; }
  else if (ph === "close" && knockout.t > 0.8) { knockout.phase = "black"; knockout.t = 0; try { playSample("fart", { vol: 0.5 }); } catch (e) {} }
  else if (ph === "black" && knockout.t > 1.2) { knockout.phase = "open"; knockout.t = 0; }
  else if (ph === "open" && knockout.t > 1.0) {
    // comes to — stone-cold sober, rus gone, but woozy for a few seconds (tømmermenn)
    knockout.active = false; drunk = 0;
    buff.t = 0; buff.luck = 0; buff.reel = 0;
    staggerWarned = false; hangover = 5;
    setHint("Tømmermenn… du våkner på bredden. Klikk for å kaste ut.");
  }
}
function setMiss(reason) {
  setFish("missed"); missReason = reason; sfxMiss();
  reelEl.classList.add("hidden");
}
function startCast() { setFish("casting"); castProgress = 0; sfxCast(); setHint(""); stopMotor(); }
function beginWaiting() {
  setFish("waiting");
  bobber.x = castTarget.x; bobber.y = castTarget.y; bobber.sink = 0;
  addRipple(bobber.x, bobber.y, 18); sfxPlop();
  biteTimer = (castOnRise ? 1.4 + Math.random() * 2 : 4 + Math.random() * 7) * weatherBiteMul();
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
  currentWeight = currentFish.junk ? 0 : rollWeight(currentFish);   // decided now so the fight scales to THIS fish
  setFish("hooked");
  progress = 10; tension = 10; pullTimer = 0.5 + Math.random() * 0.7; pulling = 0; holding = false;
  reelEl.classList.remove("hidden");
  bigFishTired = false;
  setHint(currentWeight >= 4 ? "Diger fisk! Sveiv jevnt — og SLIPP når den rykker!" : "Hold for å sveive — slipp når den drar!");
  sfxSplash();
}
function finalizeCatch() {
  const f = currentFish;
  if (f.junk) {
    save.junk = save.junk || {};
    save.junk[f.key] = (save.junk[f.key] || 0) + 1;
    persist();
    currentCatch = { f, junk: true, tag: f.tag };
  } else {
    const weight = currentWeight || rollWeight(f);
    const value = Math.round(f.kr * weight);
    const rec = save.record[f.key] || { count: 0, best: 0 };
    const isPB = rec.count > 0 && weight > rec.best;   // genuinely beat a previous personal best
    rec.count++; if (weight > rec.best) rec.best = weight;
    save.record[f.key] = rec;
    save.basket.push({ key: f.key, weight, value });
    if (currentLicense() > 0) save.licenses[save.location] = currentLicense() - 1;
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
  if (c.junk) { catchName.textContent = c.f.name; catchInfo.textContent = "til samlingen · " + ((save.junk && save.junk[c.f.key]) || 1) + " stk"; catchTag.textContent = c.tag || ""; }
  else { catchName.textContent = c.f.name; catchInfo.textContent = c.weight.toFixed(2) + " kg · " + fmt(c.value) + " kr"; catchTag.textContent = c.tag || ""; }
  catchEl.classList.remove("hidden");
  setHint("");
  if (c.junk) sfxMiss(); else sfxCatch();
  refreshHUD();
}
function closeReveal() { catchEl.classList.add("hidden"); setFish("ready"); setHint("Klikk for å kaste ut"); }

/* ---- consumables / boosts ---- */
function applyBuff(label, luck, reel, dur, color) {
  // ONE shared flaks-meter shared by drinks, snus AND magical events. A fresh source
  // starts clean; topping up an active buff stacks the bonus (with diminishing returns)
  // and REFRESHES the timer to the longest natural duration in play — it never piles
  // up into a weird multi-minute reservoir, so the time bar always drains cleanly.
  const active = buff.t > 0;
  const stackFade = active ? 0.5 : 1;            // half effect when stacked on top
  buff.luck = clamp((active ? buff.luck : 0) + luck * stackFade, 0, 1.0);   // flaks caps at +100 %
  buff.reel = clamp((active ? buff.reel : 0) + reel * stackFade, 0, 0.7);
  buff.t = Math.max(buff.t, dur);
  buff.dur = buff.t;                             // bar starts full and drains from here
  buff.label = label;
  buff.color = color;
  buffFlash = 1;
}
function drinkBeer() {
  drinking = 2.2; drinkKind = "beer"; sipAnim = 0; save.beers++; persist();
  sfxCanOpen();
  setTimeout(() => { if (screen === "game") sfxGulp(); }, 700); setTimeout(() => { if (screen === "game") sfxGulp(); }, 1100); setTimeout(() => { if (screen === "game") sfxGulp(); }, 1500);
  setTimeout(() => { if (screen !== "game") return; playSample("burp", { vol: 0.8 }); if (Math.random() < 0.45) setTimeout(() => { if (screen === "game") playSample("fart", { vol: 0.6 }); }, 500); }, 2150);
  applyBuff("Ølmodig", 0.14, 0.08, 48, "#ffcf5a");
  drunk = Math.min(DRUNK_MAX, drunk + 0.30);
}
function drinkAkevitt() {
  drinking = 2.6; drinkKind = "akevitt"; sipAnim = 0;
  sfxCanOpen();
  setTimeout(() => { if (screen === "game") sfxGulp(); }, 600); setTimeout(() => { if (screen === "game") sfxGulp(); }, 1000); setTimeout(() => { if (screen === "game") sfxGulp(); }, 1400);
  setTimeout(() => { if (screen !== "game") return; playSample("burp", { vol: 0.85 }); setTimeout(() => { if (screen === "game") playSample("fart", { vol: 0.7 }); }, 600); }, 2100);
  applyBuff("Brennevin", 0.4, 0.22, 90, "#ffe08a");
  drunk = Math.min(DRUNK_MAX, drunk + 0.55);
}
function drinkSnabel() {
  drinking = 2.8; drinkKind = "snabel"; sipAnim = 0;
  sfxCanOpen();
  setTimeout(() => { if (screen === "game") sfxGulp(); }, 600); setTimeout(() => { if (screen === "game") sfxGulp(); }, 1050); setTimeout(() => { if (screen === "game") sfxGulp(); }, 1500); setTimeout(() => { if (screen === "game") sfxGulp(); }, 1900);
  setTimeout(() => { if (screen !== "game") return; playSample("burp", { vol: 0.85 }); setTimeout(() => { if (screen === "game") playSample("fart", { vol: 0.85 }); }, 650); }, 2300);
  applyBuff("Snabelstoff", 0.55, 0.3, 120, "#d8e0c0");
  drunk = Math.min(DRUNK_MAX, drunk + 0.78);
}
function takeSnus() {
  snusing = 1.4;
  blip(520, 0.05, "square", 0.08); setTimeout(() => blip(300, 0.08, "sine", 0.07), 120);
  applyBuff("Snusrus", 0.09, 0.05, 28, "#5fbf5f");
  drunk = Math.min(DRUNK_MAX, drunk + 0.12);          // a light nicotine buzz feeds the RUS-meter too
}
function smokeCigar() {
  smoking = 6.5;
  playSample("cigar", { vol: 0.8 });
  applyBuff("Røykpause", 0.22, 0.11, 65, "#caa46a");
  drunk = Math.min(DRUNK_MAX, drunk + 0.16);          // a mellow tobacco haze adds a little RUS
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
// the empty brennevin/snabel bottle gets hurled and shatters on the bank
function throwBottle() {
  cans.push({ x: 78, y: 94, vx: 72 + Math.random() * 34, vy: -96, rot: 0, life: 2.6, kind: "bottle" });
  sfxThrow();
}

/* =========================================================================
   Market actions
   ========================================================================= */
function sellAll() {
  if (!save.basket.length) { speak("ladySpeech", "Tom fangst? Kom tilbake når du har fanget noe, da."); return; }
  const total = save.basket.reduce((s, b) => s + b.value, 0);
  const n = save.basket.length;
  save.money += total; save.basket = []; persist();
  sfxCoin(); playSample("buying", { vol: 0.6 }); playSample("moan", { vol: 0.6 });
  speak("ladySpeech", `Mmm, ${n} fisk for ${fmt(total)} kr. Takk skal du ha, kjekken 😘`);
  buildBasket(); refreshHUD();
}
function sellSpecies(key) {
  const sold = save.basket.filter((b) => b.key === key);
  if (!sold.length) return;
  const total = sold.reduce((s, b) => s + b.value, 0);
  save.basket = save.basket.filter((b) => b.key !== key);
  save.money += total; persist();
  sfxCoin(); playSample("buying", { vol: 0.6 }); playSample("moan", { vol: 0.6 });
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
  sfxCoin(); playSample("buying", { vol: 0.6 }); rodGrumpyBuy = true; rodHop = 1;
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

/* ---- fiskekort (fishing license) sold by the rod seller — one per water ---- */
const LICENSE_GRANT = 60, LICENSE_FINE = 50, LICENSE_FINE_PCT = 0.25;
function licenseCostFor(key) {
  const l = LOCATIONS.find((x) => x.key === key) || LOCATIONS[0];
  return 50 + Math.round((l.cost || 0) / 16);   // pricier waters carry pricier permits
}
function currentLicense() { return (save.licenses && save.licenses[save.location]) || 0; }
function buyLicense(locKey) {
  const key = locKey || save.location;
  const loc = LOCATIONS.find((x) => x.key === key) || LOCATIONS[0];
  const cost = licenseCostFor(key);
  if (save.money < cost) { speak("licenseSpeech", "Fiskekort koster penger, det også. Kom igjen med kontanter."); sfxMiss(); return; }
  save.money -= cost; save.licenses[key] = (save.licenses[key] || 0) + LICENSE_GRANT; persist();
  licenseBoughtThisVisit = true;
  sfxCoin(); playSample("buying", { vol: 0.6 });
  wardenStamp = 1; wardenScheme = 2.2; setTimeout(wardenStampSfx, 120);   // he stamps your card with a smug flourish
  speak("licenseSpeech", `Vær så god — kort for ${loc.name} som varer ${LICENSE_GRANT} fangster.`);
  buildLicenses(); refreshHUD();
}

/* ---- fiskeoppsynet: a rare inspector who checks your license ---- */
function triggerInspector() {
  inspector.active = true; inspector.t = 0; inspector.x = -18; inspector.phase = "in"; inspector.fined = false; inspector.line = "";
  playSample("grumpyVoice", { vol: 0.55 });
}
function resolveInspector() {
  if (currentLicense() > 0) {
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
    { t: "Flaskepost", l: "En flaske med {n} kr i driver i land ved føttene dine!", k: "money", amt: [25, 60], c: "#ffd877", s: "bottle" },
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
    { t: "TROLLET!", l: "Et ekte troll reiser seg br\u00f8lende opp av myra \u2014 fisken flykter i panikk!", k: "scare", c: "#3f5a2e", s: "trollbig" },
    { t: "Lyktemann", l: "Et bluss svever over myra og lokker fram napp.", k: "luck", luck: 0.4, dur: 16, c: "#aaffd0", s: "wisp" },
    { t: "Sur troll", l: "Trollet brummer \u2014 du kaster det en fisk for husfreden ({n} kr).", k: "loss", amt: [10, 30], c: "#6a8a4a", s: "troll" },
    { t: "Myrgass", l: "En stor boble plopper \u2014 fisken rygger unna!", k: "scare", c: "#9abf6a", s: "bubble" },
    { t: "Gammelt s\u00f8lv", l: "Du roter opp {n} kr i gamle mynter fra mudderet.", k: "money", amt: [30, 80], c: "#cfd6dd", s: "coins" },
  ],
  elgtjern: [
    { t: "Frekk elg", l: "Elgen vasser uti og slubrer i seg agnet ditt!", k: "scare", c: "#7a5a3a", s: "moose" },
    { t: "Fiskekompis", l: "Kompisen din kommer med en sterk dram og napper en fisk med en gang!", k: "buddy", c: "#ffd877", s: "buddy" },
    { t: "Bever", l: "En bever smeller halen i vannet \u2014 pladask!", k: "scare", c: "#6a4a2a", s: "beaver" },
    { t: "Forvirra jeger", l: "En jeger labber ut av skogen, ser seg r\u00e5dvilt rundt \u2014 og rusler inn igjen.", k: "flavor", c: "#7a6a4a", s: "hunter" },
    { t: "Fint s\u00f8kke", l: "Du finner et eksklusivt sluk verdt {n} kr.", k: "money", amt: [40, 100], c: "#caa23a", s: "lure" },
  ],
  nordlys: [
    { t: "Stjerne\u00f8nske", l: "Et stjerneskudd! Du \u00f8nsker deg storfisk \u2014 flaksen flammer!", k: "luck", luck: 0.6, dur: 22, c: "#b0ffe6", s: "wish" },
    { t: "Nordlyset blusser", l: "Himmelen flammer gr\u00f8nt \u2014 fisken biter ivrig!", k: "luck", luck: 0.45, dur: 20, c: "#8affc0", s: "auroraflare" },
    { t: "Fiskenisse", l: "En liten nisse legger igjen {n} kr p\u00e5 isen til deg.", k: "money", amt: [60, 140], c: "#ffd877", s: "gnome" },
    { t: "Polarkulde", l: "Bitende kulde \u2014 fisken blir doven og sky.", k: "scare", c: "#cfe6ff", s: "frost" },
  ],
  jettegryta: [
    { t: "STEINRAS!", l: "Steiner raser ned fra taket og smeller i vannet \u2014 fisken stikker av i panikk!", k: "scare", c: "#8a8a96", s: "rockfall" },
    { t: "Grotteheksa", l: "Ei heks glir forbi p\u00e5 kosteskaftet og mumler en fiskeformular \u2014 flaksen gnistrer gr\u00f8nt!", k: "luck", luck: 0.55, dur: 22, c: "#b890ff", s: "witch" },
    { t: "Flaggermussverm!", l: "En sverm flaggermus virvler opp fra m\u00f8rket \u2014 fisken dukker til bunns!", k: "scare", c: "#5a4a6a", s: "bats" },
    { t: "Krystall\u00e5re", l: "Lommelykta treffer en \u00e5re med edelstener \u2014 du vrikker l\u00f8s {n} kr!", k: "money", amt: [90, 200], c: "#9affe0", s: "gems" },
    { t: "DRAUGEN", l: "En grottedraug stiger opp av det svarte vannet og hyler \u2014 isnende kaldt!", k: "scare", c: "#7affc0", s: "draug" },
  ],
};
function triggerGameEvent() {
  const list = LOCATION_EVENTS[save.location];
  if (!list || !list.length) return;
  const ev = list[Math.floor(Math.random() * list.length)];
  let line = ev.l;
  if (ev.amt) {
    const amount = Math.round(ev.amt[0] + Math.random() * (ev.amt[1] - ev.amt[0]));
    if (ev.k === "money") { save.money += amount; persist(); refreshHUD(); sfxCoin(); line = line.replace("{n}", fmt(amount)); if (ev.s === "gems") { [1318, 1568, 1976, 2637].forEach((f, i) => blip(f, 0.22, "sine", 0.06, i * 0.08)); } }
    else if (ev.k === "loss") { const loss = Math.min(amount, save.money); save.money -= loss; persist(); refreshHUD(); sfxMiss(); line = line.replace("{n}", fmt(loss)); }
  } else if (ev.k === "luck") {
    applyBuff(ev.t, ev.luck, 0, ev.dur, ev.c); blip(660, 0.1, "sine", 0.05);
    // the witch gets a crooked little cackle instead of a plain chime
    if (ev.s === "witch") { [880, 1040, 760, 980, 700].forEach((f, i) => blip(f, 0.07, "square", 0.05, i * 0.1)); }
  } else if (ev.k === "buddy") {
    // a buddy shares a strong dram — same flaks-kick as a Blænnvin. It nudges you tipsy,
    // but an *event* you didn't choose should never be the thing that knocks you out.
    applyBuff("Blænnvin", 0.4, 0.22, 90, "#caa84a");
    drunk = Math.min(drunk + 0.4, Math.max(drunk, 1.2));
    setTimeout(() => { try { sfxGulp(); } catch (e) {} }, 900);
    setTimeout(() => { try { playSample("burp", { vol: 0.9 }); } catch (e) {} }, 1700);
    setTimeout(() => { try { sfxSplash(); } catch (e) {} }, 3900);
  } else if (ev.k === "scare") {
    if (ev.s === "trollbig") { try { playSample("grumpyVoice", { vol: 0.75 }); } catch (e) {} blip(70, 0.45, "sawtooth", 0.09); setTimeout(() => { try { noise(0.4, 420, 0.1, "lowpass"); } catch (e) {} }, 140); }
    // rockfall: a deep rumble plus a few staggered boulder-thuds smacking the water
    if (ev.s === "rockfall") { noise(0.7, 240, 0.13, "lowpass"); blip(52, 0.45, "sawtooth", 0.09); [180, 320, 540].forEach((d, i) => setTimeout(() => { try { blip(70 - i * 8, 0.16, "square", 0.08); noise(0.18, 800, 0.07, "bandpass"); } catch (e) {} }, d)); }
    // bats: a flurry of high, chittering squeaks + leathery wing-flutter
    if (ev.s === "bats") { for (let i = 0; i < 9; i++) { try { blip(2200 + Math.random() * 1600, 0.035, "square", 0.03, i * 0.05); } catch (e) {} } setTimeout(() => { try { noise(0.5, 1200, 0.05, "highpass"); } catch (e) {} }, 60); }
    // draug: an unearthly two-tone wail rising from the black water, no human voice
    if (ev.s === "draug") { wail(170, 80, 1.5, 0.13, "sawtooth"); wail(255, 120, 1.5, 0.07, "sine", 0.05); setTimeout(() => { try { noise(0.8, 200, 0.1, "lowpass"); } catch (e) {} }, 200); }
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
  beer: { name: "Trygdepatron", per: 6, cost: 36, blurb: "Sekspakning på billigtilbud — grei flaks i god tid (~48 s). Den naturlige favoritten!", color: "#caa23a" },
  snus: { name: "Snus", per: 20, cost: 50, blurb: "Boks med 20 prilla under leppa — billig, lite napp men varer en god stund (~28 s).", color: "#3a7a3a" },
  cigar: { name: "Sigarillo", per: 12, cost: 80, blurb: "Pakke med 12 — røykpause med roligere hånd, god flaks lenge (~65 s).", color: "#7a5a2a" },
  akevitt: { name: "Blænnvin", per: 1, cost: 110, blurb: "Hjemmekjært brennevin! Stor flaks, lang tid (~90 s) — men du vingler.", color: "#caa84a" },
  snabel: { name: "Snabelstoff", per: 1, cost: 250, blurb: "Hjemmebrentdunk på topphylla! Vill flaks, lengst tid (~120 s) — du sjangler skikkelig.", color: "#d8d2c0" },
};
function buyConsumable(kind) {
  const g = KIOSK_GOODS[kind]; if (!g) return;
  if (save.money < g.cost) { speak("kioskSpeech", "Tomme lommer? Kom igjen med kontanter, kompis."); sfxMiss(); return; }
  save.money -= g.cost; save.stock[kind] = (save.stock[kind] || 0) + g.per; persist();
  sfxCoin(); playSample("buying", { vol: 0.6 }); sfxKiosk();
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
  if (casinoLoseNode) { stopSample(casinoLoseNode); casinoLoseNode = null; }   // cut any lingering loser-laugh so fast spins don't stack
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
    if (casinoLoseNode) { stopSample(casinoLoseNode); casinoLoseNode = null; }
    casinoLoseNode = playSample(Math.random() < 0.5 ? "spinLose" : "spinLose2", { vol: 0.85 });
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
}
function buildLicenses() {
  const list = $("licenseList"); if (!list) return;
  list.innerHTML = "";
  // one fiskekort per water you've unlocked — pricier lakes need pricier permits
  for (const loc of LOCATIONS) {
    if (!save.unlocked.includes(loc.key)) continue;
    const cost = licenseCostFor(loc.key);
    const have = (save.licenses && save.licenses[loc.key]) || 0;
    const here = loc.key === save.location;
    const afford = save.money >= cost;
    const status = have > 0 ? `Gyldig — dekker ${have} fangster til` : "Mangler kort!";
    const row = document.createElement("div");
    row.className = "rod-row" + (afford ? "" : " locked") + (here ? " equipped" : "");
    row.innerHTML = `<div class="rod-info"><div class="rod-title">🎫 ${loc.name}${here ? " <small>(din plass)</small>" : ""}</div><div class="rod-stats">${status} · slipp bot fra fiskeoppsynet</div></div><button class="buy-btn" data-action="buyLicense" data-key="${loc.key}" ${afford ? "" : "disabled"}>${fmt(cost)} kr</button>`;
    list.appendChild(row);
  }
}
function rodTab(tab) {
  // legacy no-op: fiskekort moved to its own shop (kept so any old call is harmless)
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
      // the wife keeps shrieking from the doorway until he's climbing into the truck
      if (intro.t >= (intro.nextYell || 1e9) && intro.t < IN.climbS) {
        womanYell(); intro.nextYell = intro.t + 2.4 + Math.random() * 1.3;
      }
      // she hurls a pot after him once he's a few steps away
      if (!intro.threw && intro.t >= IN.wifeThrowR) {
        intro.threw = true;
        blip(300, 0.12, "triangle", 0.06); setTimeout(() => blip(180, 0.1, "square", 0.05), 120);   // whoosh
        setTimeout(() => { blip(140, 0.08, "sawtooth", 0.06); blip(90, 0.12, "square", 0.05); }, ((IN.wifeThrowL - IN.wifeThrowR) * 1000) | 0);  // smash
      }
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
      else {
        setLocation(travel.key); resetFishing(); rollWeather(); setScreen("game");
        setHint(WEATHER_HINT[weather.type] || "");
      }
    }
    return;
  }

  // crickets + wolf (only on outdoor screens)
  if (screen === "game" || screen === "menu") {
    cricketTimer -= dt;
    if (cricketTimer <= 0) { cricketTimer = 0.6 + Math.random() * 1.4; if (Math.random() < 0.7) cricketChirp(); }
    updateCat(dt);
    if (screen === "game") updateHatSeller(dt);
    // the cat sometimes sneaks in to nick your smallest fish — tap it to shoo it off
    if (screen === "game" && cat.state === "away" && cat.mission == null) {
      catStealTimer -= dt;
      if (catStealTimer <= 0) {
        catStealTimer = 85 + Math.random() * 120;
        const menuOpen = coolerMenu || truckMenu || rodPanel || bagPanel || recordsPanel || godsakerPanel || funnPanel || hatPanel || hatShop;
        // the cat is a recurring companion, not a random event — it doesn't wait for (or impose)
        // the calm gap between happenings. It still won't literally overlap an inspector/event though.
        if (save.basket.length > 0 && !menuOpen && !inspector.active && !gameEvent.active && fishState !== "reveal") startCatSteal();
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
    if (momentGap > 0) momentGap -= dt;   // tick down the calm gap between notable happenings
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
    } else if (fishState === "ready" && !coolerMenu && !truckMenu && !rodPanel && !bagPanel && !recordsPanel && !godsakerPanel && !funnPanel) {
      inspectorTimer -= dt;
      if (inspectorTimer <= 0) {
        inspectorTimer = 130 + Math.random() * 160;
        if (momentGap <= 0 && save.money > LICENSE_FINE) { triggerInspector(); momentGap = 12 + Math.random() * 8; }
      }
    }
    // per-location random happenings (can fire while you fish; not during the inspector or menus)
    if (gameEvent.active) { gameEvent.t += dt; if (gameEvent.t > gameEvent.dur) gameEvent.active = false; }
    if (momentGap <= 0 && (fishState === "ready" || fishState === "waiting") && !gameEvent.active && cat.mission == null && !inspector.active && !coolerMenu && !truckMenu && !rodPanel && !bagPanel && !recordsPanel && !godsakerPanel && !funnPanel && !hatPanel && !hatShop) {
      eventTimer -= dt;
      if (eventTimer <= 0) { eventTimer = 50 + Math.random() * 70; triggerGameEvent(); momentGap = 12 + Math.random() * 8; }
    }
    // the rising fish: appears for a few seconds, leaving spreading rings; cast on it for a bonus
    if (riseSpot.active) {
      riseSpot.t += dt; riseSpot.ringT += dt;
      if (riseSpot.ringT > 0.75) { riseSpot.ringT = 0; addRipple(riseSpot.x, riseSpot.y, 15); if (Math.random() < 0.5) plopRandom(); }
      if (riseSpot.t > riseSpot.dur) riseSpot.active = false;
    } else if (fishState === "ready" || fishState === "waiting") {
      riseSpot.timer -= dt;
      if (riseSpot.timer <= 0) {
        riseSpot.timer = 9 + Math.random() * 14;
        riseSpot.active = true; riseSpot.t = 0; riseSpot.dur = 4.5 + Math.random() * 3; riseSpot.ringT = 0.75;
        riseSpot.x = 210 + Math.random() * 230; riseSpot.y = WATER_Y + 24 + Math.random() * (H - WATER_Y - 54);
        plopRandom();
      }
    }
  }
  // chatty shopkeepers make idle noises
  if (screen === "shopFish") { ladyIdleTimer -= dt; if (ladyIdleTimer <= 0) { ladyIdleTimer = 4 + Math.random() * 5; sfxLady(); } }
  if (screen === "shopRod") { rodIdleTimer -= dt; if (rodIdleTimer <= 0) { rodIdleTimer = 4.5 + Math.random() * 4; playSample("grumpyVoice", { vol: 0.5 }); } }
  if (screen === "shopKiosk") { kioskIdleTimer -= dt; if (kioskIdleTimer <= 0) { kioskIdleTimer = 5 + Math.random() * 5; sfxKiosk(); } }
  // the warden idly stamps papers, mutters sly threats and rubs his hands
  if (wardenStamp > 0) wardenStamp = Math.max(0, wardenStamp - dt * 1.8);
  if (wardenScheme > 0) wardenScheme = Math.max(0, wardenScheme - dt);
  if (screen === "shopLicense") {
    licenseIdleTimer -= dt;
    if (licenseIdleTimer <= 0) {
      licenseIdleTimer = 5 + Math.random() * 4;
      if (Math.random() < 0.55) {            // stamp another paper on his pile
        wardenStamp = 1; wardenStampSfx();
      } else {                               // drop a sly line + chuckle to himself
        wardenLine = (wardenLine + 1 + Math.floor(Math.random() * (WARDEN_LINES.length - 1))) % WARDEN_LINES.length;
        speak("licenseSpeech", WARDEN_LINES[wardenLine]);
        wardenChuckle(); wardenScheme = 1.4;
      }
    }
  }
  // market passers-by stroll the street
  if (screen === "market") {
    for (const n of marketNPCs) {
      if (n.pause > 0) { n.pause -= dt; continue; }
      n.x += n.dir * n.sp * dt; n.ph += dt * 8;
      if (n.x < 10) { n.x = 10; n.dir = 1; if (Math.random() < 0.5) n.pause = 0.5 + Math.random(); }
      else if (n.x > W - 10) { n.x = W - 10; n.dir = -1; if (Math.random() < 0.5) n.pause = 0.5 + Math.random(); }
      else if (Math.random() < dt * 0.25) n.dir *= -1;
    }
    // a little comic relief now and then
    if (marketGag.active) { marketGag.t += dt; if (marketGag.t > marketGag.dur) marketGag.active = false; }
    else { marketGagTimer -= dt; if (marketGagTimer <= 0) { marketGagTimer = 6 + Math.random() * 9; startMarketGag(); } }
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

  // thrown cans / bottles physics
  const burst = [];
  for (const c of cans) {
    c.vy += 320 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += dt * 8; c.life -= dt;
    if (c.y > 138) {
      c.y = 138;
      if (c.kind === "bottle" && !c.broke) {
        c.broke = true; c.life = 0.45; c.vx = 0; c.vy = 0;
        playSample("bottleBreak", { vol: 0.6 });
        for (let s = 0; s < 9; s++) burst.push({ x: c.x, y: 137, vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 70, rot: Math.random() * 6, life: 0.5 + Math.random() * 0.3, kind: "shard" });
      } else { c.vy *= -0.35; c.vx *= 0.6; }
    }
  }
  if (burst.length) for (const b of burst) cans.push(b);
  for (let i = cans.length - 1; i >= 0; i--) if (cans[i].life <= 0) cans.splice(i, 1);

  // beer drinking sequence
  if (drinking > 0) {
    drinking -= dt;
    if (drinking <= 0.3 && !drinkThrown) { if (drinkKind === "beer") throwCan(); else if (drinkKind === "akevitt" || drinkKind === "snabel") throwBottle(); drinkThrown = true; }
    if (drinking <= 0) drinkThrown = false;
  }
  // buffs + vices — these only tick while you're actually fishing, so opening the menu truly pauses them
  if (screen === "game") {
    if (buff.t > 0) buff.t -= dt;
    if (drunk > 0) drunk = Math.max(0, drunk - dt * 0.045);
    if (hangover > 0) hangover = Math.max(0, hangover - dt);
    if (snusing > 0) snusing -= dt;
  }
  if (buffFlash > 0) buffFlash -= dt;
  // soft "pop" the instant a flaks-buff fully wears off, so it doesn't just vanish silently
  const buffOn = buff.t > 0;
  if (buffWasOn && !buffOn) { blip(620, 0.05, "sine", 0.05); blip(360, 0.09, "sine", 0.045, 0.04); }
  buffWasOn = buffOn;
  // gentle "pop" + sigh when the rus finally clears
  const drunkOn = drunk > 0.04;
  if (drunkWasOn && !drunkOn) { blip(300, 0.07, "sine", 0.05); staggerWarned = false; }
  drunkWasOn = drunkOn;
  // one clear heads-up before the blackout, so passing out never feels like it came from nowhere
  if (screen === "game" && !knockout.active) {
    if (drunk > DRUNK_KO * 0.8 && drunk <= DRUNK_KO && !staggerWarned) {
      staggerWarned = true;
      setHint("Oi… nå vingler du skikkelig. Én tår til og du sovner!");
    }
  }
  if (smoking > 0) {
    if (screen === "game") smoking -= dt;
    if (screen === "game" && Math.random() < dt * 12) smoke.push({ x: 80 + Math.random() * 2, y: 95, vx: 5 + Math.random() * 7, vy: -12 - Math.random() * 8, life: 1.5, size: 1 + Math.random() * 1.5 });
  }
  for (const s of smoke) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy *= 0.97; s.life -= dt * 0.7; s.size += dt * 2.5; }
  for (let i = smoke.length - 1; i >= 0; i--) if (smoke[i].life <= 0) smoke.splice(i, 1);
  // weather drift — rain falls, an occasional far-off flash on rainy nights
  if (screen === "game") {
    weather.t += dt;
    if (weather.type === "rain") {
      for (const d of rainDrops) { d.y += d.sp * dt; d.x -= d.sp * 0.18 * dt; if (d.y > WATER_Y) { d.y = -4; d.x = Math.random() * W; } }
      if (weather.flash > 0) weather.flash = Math.max(0, weather.flash - dt * 3);
      else if (Math.random() < dt * 0.04) weather.flash = 1;
    }
    // soft snowfall on the wintry waters — flakes sway as they fall, then loop back to the top
    if (LOC.snow) {
      for (const s of snowFlakes) {
        s.ph += dt * s.drift;
        s.y += s.sp * dt; s.x += Math.sin(s.ph) * s.drift * 6 * dt;
        if (s.y > WATER_Y + 4) { s.y = -3; s.x = Math.random() * W; }
        else if (s.x < -4) s.x = W + 4; else if (s.x > W + 4) s.x = -4;
      }
    }
  }
  // idle sips (visual only) when relaxed and not in a drink sequence
  sipAnim = Math.max(0, sipAnim - dt);
  if (screen === "game" && drinking <= 0 && (fishState === "ready" || fishState === "waiting")) {
    sipTimer -= dt;
    if (sipTimer <= 0) { sipTimer = 8 + Math.random() * 8; sipAnim = 1.2; sfxGulp(); }
  }

  // too much moonshine — he keels right over once past the limit (classic iris-out, then comes to)
  if (drunk > DRUNK_KO && !knockout.active && screen === "game") startKnockout();
  if (knockout.active) updateKnockout(dt);

  if (screen !== "game") return; // fishing logic only on water
  if (knockout.active) return;   // out cold — skip the fishing state machine

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
      // safety net: no fish fights forever — after a long struggle the line finally parts
      if (stateTime > 40) { setMiss("Fisken rømte til slutt…"); break; }
      // how hard THIS fish fights, scaled by its actual weight (kg):
      // a small fish is a quick reel-in, a heavy trophy is a real battle
      // …it tires a LITTLE over time so the runs ease off a touch — but a true giant never
      // just gives up: you have to play it, time your releases and earn the landing.
      const fatigue = clamp((stateTime - 6) / 22, 0, 0.5);
      if (fatigue > 0.22 && !bigFishTired && currentWeight >= 3) { bigFishTired = true; setHint("Den drar fortsatt hardt — sveiv jevnt, slipp på rykkene!"); }
      const fishFight = (currentFish.junk ? 0.4 : clamp(0.4 + currentWeight * 0.17, 0.4, 3.1)) * (1 - fatigue) * (LOC.fightMul || 1);
      pullTimer -= dt;
      if (pulling > 0) {
        pulling -= dt;
        if (pulling <= 0) setHint("Sveiv inn! 🎣");
      } else if (pullTimer <= 0) {
        // a run — heavier fish bolt more often and a bit longer, but the calm gap between runs
        // is ALWAYS longer than the run itself, so there's always a window to reel in
        pulling = 0.4 + Math.random() * 0.3 + fishFight * 0.15;
        pullTimer = 0.85 + Math.random() * 0.8 + fishFight * 0.12;
        if (fishFight > 0.9) { setHint("SLIPP! Den rykker! ⚠️"); blip(150, 0.12, "sawtooth", 0.05); }
      }
      const rb = buff.t > 0 ? buff.reel : 0;        // booze eases the fight a little
      if (holding) {
        if (pulling > 0) {
          // hauling against a run loads the line fast (worse the bigger the fish), little progress
          tension += dt * (10 + 24 * fishFight) * r.tens * (1 - rb * 0.35);
          progress += dt * 5 * r.reel;
        } else {
          // calm reeling: quick progress, only light strain
          progress += dt * 26 * r.reel * (1 + rb);
          tension += dt * (3 + 5 * fishFight) * r.tens;
        }
        if (Math.random() < dt * 12) sfxReel();
      } else {
        // letting line out: a touch of slip, tension drains fast
        progress -= dt * 5;
        tension -= dt * 32;
      }
      // the fish's own run always loads the line a bit, even if you let go
      if (pulling > 0) tension += dt * (4 + 10 * fishFight) * r.tens;
      progress = clamp(progress, 0, 100); tension = clamp(tension, 0, 100);
      bobber.y = castTarget.y + 6 + Math.sin(t * 18) * (pulling > 0 ? 4 : 1.5);
      bobber.x = castTarget.x + Math.sin(t * 9) * (pulling > 0 ? 3 : 1);
      progressEl.style.width = progress + "%";
      tensionEl.style.width = tension + "%";
      tensionEl.classList.toggle("danger", tension > 70);
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
  if (LOC.cave) return;   // no sky inside the cavern
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
  if (LOC.cave) { drawCaveWall(); return; }   // a jagged rock wall instead of pines
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
// Jettegryta — the dripping back wall of the cavern (stands in for the treeline)
function drawCaveWall() {
  // solid rock backdrop above the water
  const g = ctx.createLinearGradient(0, 0, 0, WATER_Y);
  g.addColorStop(0, "#070810"); g.addColorStop(0.7, "#12141f"); g.addColorStop(1, "#1a1d2a");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, WATER_Y);
  // hanging stalactites from the ceiling
  ctx.fillStyle = LOC.tree;
  let seed = 4; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let x = -6; x < W + 6; x += 13) {
    const h = 10 + rnd() * 22;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 6.5, 0); ctx.lineTo(x + 3, h); ctx.closePath(); ctx.fill();
  }
  // a soft shaft of pale light from a crack in the ceiling — drawn over the rock so it actually glows
  const lx = 250;
  const lg = ctx.createLinearGradient(lx, 0, lx + 30, WATER_Y);
  lg.addColorStop(0, "rgba(190,215,235,0.22)"); lg.addColorStop(1, "rgba(190,215,235,0)");
  ctx.fillStyle = lg;
  ctx.beginPath(); ctx.moveTo(lx - 4, 0); ctx.lineTo(lx + 10, 0); ctx.lineTo(lx + 40, WATER_Y); ctx.lineTo(lx + 6, WATER_Y); ctx.closePath(); ctx.fill();
  // rugged rock shelf rising from the waterline
  ctx.fillStyle = "#0d0f18";
  for (let x = -10; x < W + 10; x += 9) { const h = 8 + rnd() * 18; ctx.fillRect(x, WATER_Y - h, 10, h); }
  // stumpy stalagmites poking up at the shore
  ctx.fillStyle = "#151824";
  for (let x = 10; x < W; x += 47) { const h = 6 + rnd() * 12; ctx.beginPath(); ctx.moveTo(x, WATER_Y); ctx.lineTo(x + 7, WATER_Y); ctx.lineTo(x + 3, WATER_Y - h); ctx.closePath(); ctx.fill(); }
}
// Jettegryta — glowing mushrooms, drips and a faint mist that make the cavern feel alive
let caveDrips = null;
function drawCaveDetails() {
  if (!LOC.cave) return;
  if (!caveDrips) caveDrips = Array.from({ length: 6 }, () => ({ x: 20 + Math.random() * (W - 40), ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 0.6 }));
  // glowing cave mushrooms clustered along the back rock shelf
  const spots = [[40, 138], [96, 132], [196, 140], [300, 134], [360, 138], [420, 132]];
  for (let i = 0; i < spots.length; i++) {
    const [mx, my] = spots[i];
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7);
    const gg = ctx.createRadialGradient(mx, my, 1, mx, my, 12);
    gg.addColorStop(0, `rgba(120,255,200,${0.12 + pulse * 0.12})`); gg.addColorStop(1, "rgba(120,255,200,0)");
    ctx.fillStyle = gg; ctx.fillRect(mx - 12, my - 12, 24, 24);
    px(mx, my - 1, 1, 3, "#2a4a3a");                       // tiny stalk
    px(mx - 1, my - 3, 3, 2, "#7affc8");                   // glowing cap
    px(mx, my - 4, 1, 1, "#d0ffe8");
  }
  // slow drips falling from the ceiling, splashing into the pond
  ctx.fillStyle = "rgba(170,210,230,0.6)";
  for (const d of caveDrips) {
    d.ph += d.sp * 0.02;
    const fall = (d.ph % 1);
    const dy = fall * (WATER_Y - 4);
    px(Math.round(d.x), Math.round(dy), 1, 3, "rgba(170,210,230,0.6)");
    if (fall > 0.94) { ctx.globalAlpha = (1 - fall) * 12; px(Math.round(d.x) - 1, WATER_Y - 1, 3, 1, "#b9c8ff"); ctx.globalAlpha = 1; }
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
// per-session weather painted over the scene: overcast tint, rain streaks, thicker mist
function drawWeather() {
  if (screen !== "game") return;
  if (weather.type === "overcast") {
    ctx.globalAlpha = 0.16; ctx.fillStyle = "#3a3f52"; ctx.fillRect(0, 0, W, WATER_Y); ctx.globalAlpha = 1;
  } else if (weather.type === "rain") {
    ctx.globalAlpha = 0.12; ctx.fillStyle = "#2e3548"; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(190,205,225,0.5)"; ctx.lineWidth = 1; ctx.beginPath();
    for (const d of rainDrops) { ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.len * 0.35, d.y + d.len); }
    ctx.stroke();
    if (weather.flash > 0.4) { ctx.globalAlpha = (weather.flash - 0.4) * 0.5; ctx.fillStyle = "#cdd6e6"; ctx.fillRect(0, 0, W, WATER_Y); ctx.globalAlpha = 1; }
  } else if (weather.type === "mist") {
    for (let i = 0; i < 3; i++) {
      const y = WATER_Y - 26 + i * 16;
      const off = Math.sin(t * 0.22 + i * 2.1) * 36;
      ctx.globalAlpha = 0.16 + 0.06 * Math.sin(t * 0.3 + i);
      ctx.fillStyle = "#cdd8e6";
      ctx.beginPath(); ctx.ellipse(W / 2 + off, y, 240, 14, 0, 0, 6.28); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
// tømmermenn: a brief woozy haze after you come to from a blackout
function drawHangover() {
  if (hangover <= 0) return;
  const k = clamp(hangover / 5, 0, 1);
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
  ctx.globalAlpha = k * (0.12 + pulse * 0.06);
  ctx.fillStyle = "#5a7a5e"; ctx.fillRect(0, 0, W, H);
  const sx = Math.sin(t * 1.6) * 10 * k;
  const g = ctx.createRadialGradient(W / 2 + sx, H / 2, 50, W / 2 + sx, H / 2, 230);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(10,14,18,${k * 0.4})`);
  ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
function drawFishShadow(x, y, dir) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 3, 0, 0, 6.28); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-15, -3 + Math.sin(t * 6) * 2); ctx.lineTo(-15, 3 + Math.sin(t * 6) * 2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawShore() {
  if (LOC.cave) { drawCaveShore(); return; }   // a wet rocky bank, no grass
  ctx.fillStyle = "#1e3326";
  ctx.beginPath(); ctx.moveTo(0, WATER_Y - 6); ctx.lineTo(0, H); ctx.lineTo(132, H);
  ctx.quadraticCurveTo(150, WATER_Y + 8, 96, WATER_Y - 4); ctx.quadraticCurveTo(40, WATER_Y - 14, 0, WATER_Y - 6); ctx.fill();
  ctx.fillStyle = "#16261c";
  ctx.beginPath(); ctx.moveTo(0, WATER_Y - 1); ctx.quadraticCurveTo(60, WATER_Y + 5, 120, WATER_Y + 14); ctx.lineTo(132, H); ctx.lineTo(0, H); ctx.fill();
  ctx.strokeStyle = "#2f5238"; ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) { const gx = 6 + i * 7; if (gx > 120) continue; const gy = WATER_Y - 4 + (i % 3) * 4 + Math.min(40, i * 2); ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx - 1 + Math.sin(t + i) * 1.5, gy - 5); ctx.stroke(); }
}
// Jettegryta — a dark, wet stone bank instead of the grassy shore
function drawCaveShore() {
  ctx.fillStyle = "#1a1c26";
  ctx.beginPath(); ctx.moveTo(0, WATER_Y - 6); ctx.lineTo(0, H); ctx.lineTo(132, H);
  ctx.quadraticCurveTo(150, WATER_Y + 8, 96, WATER_Y - 4); ctx.quadraticCurveTo(40, WATER_Y - 14, 0, WATER_Y - 6); ctx.fill();
  ctx.fillStyle = "#101220";
  ctx.beginPath(); ctx.moveTo(0, WATER_Y - 1); ctx.quadraticCurveTo(60, WATER_Y + 5, 120, WATER_Y + 14); ctx.lineTo(132, H); ctx.lineTo(0, H); ctx.fill();
  // scattered pebbles + cracks instead of grass blades
  let seed = 9; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 18; i++) {
    const gx = 6 + rnd() * 116, gy = WATER_Y + 2 + rnd() * 74;
    px(Math.round(gx), Math.round(gy), 2, 1, rnd() > 0.5 ? "#2a2d3a" : "#212430");
  }
  // a damp sheen along the waterline
  ctx.globalAlpha = 0.25; ctx.strokeStyle = "#3a4a5a"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, WATER_Y - 2); ctx.quadraticCurveTo(60, WATER_Y + 3, 120, WATER_Y + 12); ctx.stroke();
  ctx.globalAlpha = 1;
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
  if (knockout.active && knockout.phase !== "fall" && knockout.phase !== "wooze") return;   // hidden behind the black iris
  const bob = Math.sin(t * 1.4) * 0.6;
  // sway harder and harder during the woozy lead-in, so the topple feels earned
  const woozeK = (knockout.active && knockout.phase === "wooze") ? 1 + clamp(knockout.t / 1.5, 0, 1) * 2.5 : 1;
  const sway = drunk > 0 ? Math.sin(t * 1.7) * drunk * 2.2 * woozeK : 0;
  const baseX = 70 + sway, baseY = 112 + bob;
  const toppling = knockout.active && knockout.phase === "fall";
  ctx.save();
  if (toppling) {
    const k = clamp(knockout.t / 1.1, 0, 1);
    ctx.translate(58, 150); ctx.rotate(-k * 1.35); ctx.translate(-58, -150 + k * 8);   // tips backward off the chair
  }
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
  drawPlayerHat(headX, headY, save.hat || "straw");
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
  if (snusing > 0) {
    // a pinch of snus travels from the box up to the upper lip — clearly readable
    const sk = clamp((1.4 - snusing) / 1.4, 0, 1);
    const fx = baseX + 8 - sk * 6, fy = headY + 4 - sk * 1;
    px(baseX + 2, headY + 2, 5, 4, "#e3b58c");               // forearm up to the lip
    px(fx, fy, 2, 2, "#e3b58c"); px(fx, fy - 1, 2, 1, "#f4f0e6");   // fingertips + white pinch
    px(baseX - 9, baseY + 2, 5, 5, "#2b6b46"); px(baseX - 9, baseY + 2, 5, 1, "#3f9a63"); px(baseX - 8, baseY + 3, 3, 1, "#e8e2d0"); // snus box in the other hand
    if (sk > 0.6) px(headX - 2, headY + 3, 3, 2, "#caa07a");  // upper-lip bulge as it goes in
    if (sk > 0.7 && Math.sin(t * 20) > 0) sparkle(headX + 6, headY - 4, t);
  }
  ctx.restore();
}
// the cartoon iris-out (and toppling stars) when he passes out
function drawKnockout() {
  if (!knockout.active) return;
  const cx = 64, cy = 104;
  // lead-in: the world dims and pulses at the edges, eyelids getting heavy — readable warning
  if (knockout.phase === "wooze") {
    const k = clamp(knockout.t / 1.5, 0, 1);
    ctx.save();
    // creeping vignette that grows as he fades
    const g = ctx.createRadialGradient(cx, cy, 30, cx, cy, 220);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${0.25 + k * 0.55})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // eyelids drooping from top and bottom, with a slow blink wobble
    const lid = (0.18 + k * 0.4) * H + Math.sin(t * 3) * 4 * k;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, lid * 0.6);
    ctx.fillRect(0, H - lid * 0.6, W, lid * 0.6);
    ctx.restore();
    // a few woozy stars already circling
    for (let i = 0; i < 3; i++) { const a = t * 3 + i * 2.09; sparkle(cx + Math.cos(a) * 9, cy - 16 + Math.sin(a) * 3, t * 1.5 + i); }
    return;
  }
  if (knockout.phase === "fall") {
    for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.57; sparkle(cx + Math.cos(a) * 11, cy - 16 + Math.sin(a) * 4, t * 2 + i); }
    return;
  }
  let r;
  if (knockout.phase === "close") r = lerp(470, 0, clamp(knockout.t / 0.8, 0, 1));
  else if (knockout.phase === "black") r = 0;
  else r = lerp(0, 470, clamp(knockout.t / 1.0, 0, 1));
  ctx.save();
  ctx.fillStyle = "#000"; ctx.beginPath(); ctx.rect(0, 0, W, H);
  if (r > 0) ctx.arc(cx, cy, r, 0, 6.28, true);
  ctx.fill("evenodd");
  ctx.restore();
  if (knockout.phase === "black") {
    ctx.fillStyle = "#5a5a7a"; ctx.font = "bold 13px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("z Z z…", cx + 34, cy - 8);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
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
    if (can.kind === "shard") {
      ctx.globalAlpha = clamp(can.life * 2, 0, 1); px(-1, -1, 2, 2, "#bfe3d0"); px(0, 0, 1, 1, "#ffffff"); ctx.globalAlpha = 1;
    } else if (can.kind === "bottle") {
      if (can.broke) { ctx.globalAlpha = clamp(can.life * 2.2, 0, 1); px(-3, 0, 7, 2, "#7a9a6a"); px(-1, -1, 2, 1, "#bfe3d0"); ctx.globalAlpha = 1; }
      else { px(-2, -4, 4, 8, "#6a8a4a"); px(-1, -6, 2, 3, "#5a7a3a"); px(-2, -4, 4, 1, "#9aba7a"); }
    } else {
      px(-2, -3, 4, 6, "#cf3b3b"); px(-2, -3, 4, 1, "#e8e8e8"); px(-2, 2, 4, 1, "#9aa0a8");
    }
    ctx.restore();
  }
}
function drawReedsFront() {
  if (LOC.cave) return;   // no reeds grow in the cavern
  ctx.strokeStyle = "#10261a"; ctx.lineWidth = 2;
  const reed = (x, h, ph) => { ctx.beginPath(); ctx.moveTo(x, H); ctx.quadraticCurveTo(x + Math.sin(t * 0.8 + ph) * 6, H - h * 0.6, x + Math.sin(t * 0.8 + ph) * 10, H - h); ctx.stroke(); ctx.fillStyle = "#3a2a1a"; ctx.fillRect(x + Math.sin(t * 0.8 + ph) * 10 - 1, H - h - 6, 3, 8); };
  for (let i = 0; i < 5; i++) reed(W - 8 - i * 11, 40 + i * 8, i);
  for (let i = 0; i < 3; i++) reed(150 + i * 9, 30 + i * 6, i + 2);
}
function drawFireflies() {
  if (LOC.snow) return;   // no summer fireflies over the frozen waters — they get snow instead
  for (const ff of fireflies) {
    const glow = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(ff.ph));
    ctx.globalAlpha = glow * 0.8; ctx.fillStyle = "#fff2a0"; ctx.beginPath(); ctx.arc(ff.x, ff.y, 2.2, 0, 6.28); ctx.fill();
    ctx.globalAlpha = glow; px(ff.x, ff.y, 1, 1, "#fffbe0");
  }
  ctx.globalAlpha = 1;
}
// gentle snowfall drifting over the wintry waters (Fjellvatnet, Nordlysvatnet)
function drawSnow() {
  if (!LOC.snow) return;
  ctx.fillStyle = "#eef4ff";
  for (const s of snowFlakes) {
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(s.ph);
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill();
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
  drawSky(); drawStars(); drawAurora(); drawMoon(); drawMountains(); drawTreeline(); drawLurkingEyes(); drawMoose(); drawWater(); drawWaterfall(); drawReflections(); drawForestDetails(); drawSummerDetails(); drawCaveDetails(); drawShore();
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
  // ground clutter so the street feels lived-in: a lamppost, a couple of crates and a gutter puddle
  // cobble gutter line
  px(0, 214, W, 1, "#15101b");
  // lamppost (left), pooling warm light on the cobbles
  px(24, 150, 3, 64, "#2a2230"); px(22, 148, 7, 4, "#3a2f3f");
  ctx.globalAlpha = 0.7 + 0.1 * Math.sin(t * 4); ctx.fillStyle = "#ffe9a8";
  ctx.beginPath(); ctx.ellipse(25, 148, 5, 6, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.12; ctx.fillStyle = "#ffe9a8"; ctx.beginPath(); ctx.ellipse(25, 214, 18, 5, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
  // stacked crates (right)
  px(W - 34, 196, 14, 14, "#6a4a2c"); px(W - 34, 196, 14, 2, "#7c5a34"); px(W - 27, 196, 1, 14, "#3a2614");
  px(W - 30, 184, 12, 12, "#74512f"); px(W - 30, 184, 12, 2, "#86643b"); px(W - 24, 184, 1, 12, "#3a2614");
  // gutter puddle reflecting the lights
  ctx.globalAlpha = 0.3; ctx.fillStyle = "#3a4a66"; ctx.beginPath(); ctx.ellipse(120, 220, 16, 4, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
  // stalls + shopkeepers (counter drawn last so they stand behind it) — five booths in a row
  const SX = [52, 146, 240, 334, 428];
  drawStall(SX[0], 110, "#7a3b3b", 90); drawLady(SX[0], 150); drawStallCounter(SX[0], 110, 90);
  drawStall(SX[1], 110, "#3b7a4a", 90); drawKioskKeeper(SX[1], 150); drawStallCounter(SX[1], 110, 90);
  drawStall(SX[2], 110, "#3b5a7a", 90); drawGrumpyMan(SX[2], 150); drawStallCounter(SX[2], 110, 90);
  drawStall(SX[3], 110, "#5a2a4a", 90); drawCroupier(SX[3], 150); drawStallCounter(SX[3], 110, 90);
  drawStall(SX[4], 110, "#3a5a44", 90); drawLicenseWarden(SX[4], 150); drawStallCounter(SX[4], 110, 90);
  // wooden signs (no emoji)
  drawSign(SX[0], 92, "FISKEHANDEL");
  drawSign(SX[1], 92, "KIOSK");
  drawSign(SX[2], 92, "FISKEUTSTYR");
  drawSign(SX[3], 92, "KASINO");
  drawSign(SX[4], 92, "FISKEKORT");
  // people strolling the street — drawn in FRONT of the stalls so they never vanish behind a booth
  for (const n of marketNPCs) drawMarketNPC(n);
  drawMarketGag();
  drawMarketTruck();
  drawMarketHover();
  drawFireflies(); drawVignette();
}
// our own truck parked at the market — click it to drive back to the water
function drawMarketTruck() {
  const r = MARKET_TRUCK;
  const on = (screen === "market" && marketHover && marketHover.rect === MARKET_TRUCK);   // hovered → engine idles, shakes, lights on, puffs exhaust
  const shake = on ? Math.sin(t * 38) * 0.6 : 0;
  const x = r.x + shake, y = r.y + (on ? Math.sin(t * 31) * 0.4 : 0), w = r.w;
  // tyre-track patch on the ground
  ctx.fillStyle = "#1c1622";
  ctx.beginPath(); ctx.ellipse(r.x + w / 2, r.y + r.h - 2, w / 2, 3, 0, 0, 6.28); ctx.fill();
  // exhaust puffs from the tailpipe at the back while idling
  if (on) {
    const puff = (t * 1.4) % 1;
    ctx.globalAlpha = (1 - puff) * 0.4; ctx.fillStyle = "#b9b4ad";
    ctx.beginPath(); ctx.arc(x + w - 3, y + 24 - puff * 10, 1.5 + puff * 3, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // body (side view, cab to the left)
  px(x + 4, y + 14, w - 6, 13, "#b23a2a");     // bed
  px(x + 4, y + 4, 24, 13, "#c64636");         // cab
  px(x + 8, y + 7, 14, 8, "#bfe6ef");          // window
  px(x + 4, y + 25, w - 6, 3, "#7a241c");      // chassis shadow
  // wheels
  px(x + 11, y + 26, 8, 6, "#1a1a1a"); px(x + 14, y + 28, 2, 2, "#555");
  px(x + w - 16, y + 26, 8, 6, "#1a1a1a"); px(x + w - 13, y + 28, 2, 2, "#555");
  // headlight (glows brighter + casts a little beam when idling) + rod sticking out of the bed
  px(x + 3, y + 11, 2, 3, on ? "#fff6c8" : "#ffe9a0");
  if (on) {
    ctx.globalAlpha = 0.28 + 0.1 * Math.sin(t * 30); ctx.fillStyle = "#fff0b0";
    ctx.beginPath(); ctx.moveTo(x + 2, y + 10); ctx.lineTo(x - 13, y + 6); ctx.lineTo(x - 13, y + 16); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = "#caa97a"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + w - 6, y + 14); ctx.lineTo(x + w + 4, y - 1); ctx.stroke();
}
function drawMarketGag() {
  if (!marketGag.active) return;
  const g = marketGag, p = clamp(g.t / g.dur, 0, 1), dir = g.dir;
  const cross = dir > 0 ? -20 + p * (W + 40) : W + 20 - p * (W + 40);
  ctx.save();
  if (g.kind === "dog") {
    const x = cross, y = 206 - Math.abs(Math.sin(t * 14)) * 2;
    ctx.save(); if (dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
    px(x - 5, y, 10, 5, "#8a5a32"); px(x + 4, y - 3, 4, 4, "#8a5a32");
    px(x + 7, y - 2, 2, 1, "#1a1208"); px(x - 6, y - 1, 3, 2, "#6a4426");
    px(x - 4, y + 5, 2, 3, "#6a4426"); px(x + 2, y + 5, 2, 3, "#6a4426");
    ctx.restore();
  } else if (g.kind === "cat") {
    const x = cross, y = 207 - Math.abs(Math.sin(t * 16)) * 2;
    ctx.save(); if (dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
    px(x - 5, y, 9, 4, "#3a3340"); px(x + 3, y - 3, 4, 4, "#3a3340");
    px(x + 3, y - 5, 1, 2, "#3a3340"); px(x + 6, y - 5, 1, 2, "#3a3340");
    ctx.strokeStyle = "#3a3340"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 5, y + 1); ctx.quadraticCurveTo(x - 11, y - 3, x - 8, y - 6); ctx.stroke();
    ctx.restore();
  } else if (g.kind === "gull") {
    const x = cross, y = 60 + Math.sin(t * 3 + g.seed) * 8, flap = Math.sin(t * 12) * 4;
    ctx.strokeStyle = "#e8eef2"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 7, y + flap); ctx.lineTo(x, y); ctx.lineTo(x + 7, y + flap); ctx.stroke();
    px(x - 1, y - 1, 2, 3, "#e8eef2"); px(x + 1, y, 2, 1, "#ffb03a");
    if (p > 0.45 && p < 0.55) px(x | 0, (y | 0) + 6, 2, 2, "#dfe6ea");
  } else if (g.kind === "barrel") {
    const x = cross, y = 204;
    ctx.save(); ctx.translate(x, y); ctx.rotate(dir * t * 8);
    px(-6, -6, 12, 12, "#7a5226"); px(-6, -3, 12, 2, "#3a2614"); px(-6, 1, 12, 2, "#3a2614");
    ctx.restore();
  } else if (g.kind === "balloon") {
    const x = 60 + g.seed * 40 + Math.sin(t * 1.5) * 6, y = lerp(210, 20, p);
    ctx.fillStyle = ["#e0506a", "#5a86d0", "#5fbf6a"][Math.floor(g.seed) % 3];
    ctx.beginPath(); ctx.ellipse(x, y, 6, 7, 0, 0, 6.28); ctx.fill();
    ctx.strokeStyle = "#caa"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x + Math.sin(t * 2) * 2, y + 18); ctx.stroke();
  } else if (g.kind === "pee") {
    // a drunk slips off to a corner for a wee — then the law shows up and chases him off
    const spot = dir > 0 ? W - 40 : 40;          // the wall he picks
    const face = dir > 0 ? 1 : -1;
    const t1 = 1.8, t2 = 4.4;                     // walk-in, do-the-deed, then the chase
    if (g.t < t1) {                              // stroll over to the wall
      const k = g.t / t1, sx = lerp(dir > 0 ? W + 16 : -16, spot, k);
      drawStreetGuy(sx, 196, face, false, true);
    } else if (g.t < t2) {                       // standing relieving himself against the wall
      drawStreetGuy(spot, 196, face, true, false);
      ctx.strokeStyle = "#ffe066"; ctx.lineWidth = 1; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(spot + face * 5, 202); ctx.lineTo(spot + face * 9, 210); ctx.stroke(); ctx.globalAlpha = 1;
      const grow = clamp((g.t - t1) / (t2 - t1), 0, 1);
      ctx.fillStyle = "rgba(220,200,80,0.45)"; ctx.beginPath(); ctx.ellipse(spot + face * 9, 211, 4 * grow + 1, 1.4 * grow + 0.5, 0, 0, 6.28); ctx.fill();
      if (Math.sin(t * 4) > 0.3) { ctx.fillStyle = "#ffe6a0"; ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.fillText("aaah…", spot, 176); ctx.textAlign = "left"; }
    } else {                                     // BUSTED — police runs in, drunk legs it off-screen
      const k = clamp((g.t - t2) / (g.dur - t2), 0, 1);
      const run = Math.abs(Math.sin(t * 22)) * 3;
      const gx = lerp(spot, dir > 0 ? W + 24 : -24, k);
      const px0 = lerp(dir > 0 ? -24 : W + 24, gx - face * 20, k);
      drawStreetGuy(gx, 196 - run, face, false, true);          // fleeing drunk
      drawPolice(px0, 196 - run, face);                          // hot pursuit
      if (Math.sin(t * 16) > 0) { ctx.fillStyle = "#fff"; ctx.font = "8px monospace"; ctx.textAlign = "center"; ctx.fillText("HEI!", px0 - face * 6, 174); ctx.textAlign = "left"; }
    }
  } else if (g.kind === "hat") {
    // a gust whips a fellow's hat off and he chases it across the cobbles
    const face = dir > 0 ? 1 : -1;
    const guyX = cross;
    const hatX = guyX + face * (22 + Math.sin(t * 3) * 4);
    const hatY = 182 + Math.sin(t * 5 + g.seed) * 6;
    drawStreetGuy(guyX, 196, face, false, true);
    ctx.save(); ctx.translate(hatX, hatY); ctx.rotate(t * 6 * face);
    px(-4, 0, 8, 2, "#3a2c1e"); px(-2, -3, 4, 3, "#4a3724");
    ctx.restore();
    if (Math.sin(t * 14) > 0.4) { ctx.fillStyle = "#fff"; ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.fillText("hatten min!", guyX, 176); ctx.textAlign = "left"; }
  } else if (g.kind === "trip") {
    // someone stumbles on a loose cobblestone, flails, then carries on like nothing happened
    const face = dir > 0 ? 1 : -1, x = cross;
    if (p > 0.42 && p < 0.6) {
      drawStreetGuy(x, 200, face, true, false);
      px(x - 8, 209, 4, 2, "#5a3a5a"); px(x + 5, 209, 4, 2, "#5a3a5a");   // flailing arms
      px(x + face * 9, 210, 4, 3, "#6a6256");                            // the loose stone
      ctx.fillStyle = "#fff"; ctx.font = "8px monospace"; ctx.textAlign = "center"; ctx.fillText("OISANN!", x, 178); ctx.textAlign = "left";
    } else {
      drawStreetGuy(x, 196, face, false, true);
    }
  } else if (g.kind === "busker") {
    // a street musician parks in a corner and squeezes out a little tune
    const bx = dir > 0 ? 70 : W - 70, by = 198;
    px(bx - 14, by + 12, 8, 3, "#3a2c1e"); px(bx - 13, by + 11, 6, 1, "#4a3724");  // coin hat on the ground
    ctx.globalAlpha = 0.25; px(bx - 4, by + 13, 10, 1, "#000"); ctx.globalAlpha = 1;
    px(bx - 3, by + 4, 8, 8, "#4a5a3a"); px(bx - 2, by - 2, 5, 5, "#e0b48a"); px(bx - 3, by - 4, 7, 3, "#6a4a2a");
    const sq = 4 + Math.sin(t * 5) * 2;                                   // accordion squeezing
    px(bx + 4, by + 4, 3, 6, "#9a2a2a"); px(bx + 7, by + 4, sq, 6, "#c8c8c8"); px(bx + 7 + sq, by + 4, 3, 6, "#9a2a2a");
    for (let i = 0; i < 3; i++) {                                         // floating notes
      const np = (t * 0.5 + i * 0.4 + g.seed) % 1;
      const ny = by - 4 - np * 30, nx = bx + 12 + Math.sin(np * 6 + i) * 6;
      ctx.globalAlpha = 1 - np; ctx.fillStyle = "#ffe6a0"; ctx.font = "8px monospace"; ctx.fillText(i % 2 ? "♪" : "♫", nx, ny); ctx.globalAlpha = 1;
    }
  } else if (g.kind === "snatch") {
    // a greedy gull dive-bombs a man's sausage-on-a-stick and makes off with it
    const face = dir > 0 ? 1 : -1;
    const walkX = p < 0.45 ? lerp(dir > 0 ? -16 : W + 16, W * 0.5, clamp(p / 0.45, 0, 1)) : W * 0.5;
    if (p < 0.45) {
      drawStreetGuy(walkX, 196, face, false, true);
      px(walkX + (face > 0 ? 5 : -10), 190, 6, 1, "#caa"); px(walkX + face * 10, 188, 4, 3, "#b5532a");
    } else if (p < 0.6) {
      drawStreetGuy(walkX, 196, face, false, false);
      px(walkX + (face > 0 ? 5 : -10), 190, 6, 1, "#caa"); px(walkX + face * 10, 188, 4, 3, "#b5532a");
      drawGull(walkX + face * 10, lerp(40, 186, (p - 0.45) / 0.15), t);
    } else {
      drawStreetGuy(walkX, 196, face, false, false);
      px(walkX + (face > 0 ? 4 : -5), 188, 2, 3, "#5a3a5a");            // raised fist
      const gp = (p - 0.6) / 0.4, gx = walkX + face * (10 + gp * 130), gy = lerp(186, 28, gp);
      drawGull(gx, gy, t); px(gx + face * 4, gy + 1, 4, 3, "#b5532a");  // loot in beak
      if (Math.sin(t * 14) > 0.3) { ctx.fillStyle = "#fff"; ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.fillText("tjuv!", walkX, 176); ctx.textAlign = "left"; }
    }
  } else if (g.kind === "couple") {
    // two neighbours meet in the middle, have a good old natter, then part ways
    const meetL = W * 0.43, meetR = W * 0.57, inT = 0.28, outStart = 0.74;
    let lx, rx;
    if (p < inT) { const k = p / inT; lx = lerp(-16, meetL, k); rx = lerp(W + 16, meetR, k); }
    else if (p < outStart) { lx = meetL; rx = meetR; }
    else { const k = (p - outStart) / (1 - outStart); lx = lerp(meetL, -16, k); rx = lerp(meetR, W + 16, k); }
    const chatting = p >= inT && p < outStart;
    drawStreetGuy(lx, 196, 1, false, !chatting);
    drawStreetGuy(rx, 196, -1, false, !chatting);
    if (chatting && Math.sin(t * 5) > 0) { ctx.fillStyle = "#fff"; ctx.font = "8px monospace"; ctx.textAlign = "center"; ctx.fillText("…", (lx + rx) / 2, 178); ctx.textAlign = "left"; }
  } else if (g.kind === "rat") {
    // a cheeky rat scurries along the gutter
    const x = cross, y = 213 - Math.abs(Math.sin(t * 26));
    ctx.save(); if (dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
    px(x - 4, y, 7, 3, "#5a5048"); px(x + 3, y - 1, 3, 3, "#5a5048"); px(x + 5, y, 1, 1, "#1a1208");
    ctx.strokeStyle = "#5a5048"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 4, y + 1); ctx.lineTo(x - 9, y + 2); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
// a little seagull (used by the gull + snatch gags)
function drawGull(x, y, tt) {
  const flap = Math.sin(tt * 12) * 4;
  ctx.strokeStyle = "#e8eef2"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 7, y + flap); ctx.lineTo(x, y); ctx.lineTo(x + 7, y + flap); ctx.stroke();
  px(x - 1, y - 1, 2, 3, "#e8eef2"); px(x + 1, y, 2, 1, "#ffb03a");
}
// a generic little street fellow for the pee gag (face = +1 right / -1 left)
function drawStreetGuy(x, y, face, hunched, walk) {
  x = Math.round(x); y = Math.round(y);
  const step = walk ? Math.sin(t * 12) * 2 : 0;
  ctx.globalAlpha = 0.25; px(x - 3, y + 13, 8, 1, "#000"); ctx.globalAlpha = 1;
  px(x - 2, y + 8, 2, 5 + step, "#2a2a3a"); px(x + 1, y + 8, 2, 5 - step, "#2a2a3a");
  px(x - 3, y + (hunched ? 1 : 0), 7, 9, "#6a4a6a"); px(x - 3, y + (hunched ? 1 : 0), 7, 2, "#7c5a7c");
  px(x + (face > 0 ? 3 : -4), y + 2, 2, 6, "#5a3a5a");
  px(x - 2, y - 5 + (hunched ? 1 : 0), 5, 5, "#e0b48a");
  px(x - 3, y - 7 + (hunched ? 1 : 0), 7, 3, "#3a2c2c");
}
// a beat cop chasing the offender
function drawPolice(x, y, face) {
  x = Math.round(x); y = Math.round(y);
  const step = Math.sin(t * 22) * 2.5;
  ctx.globalAlpha = 0.25; px(x - 3, y + 13, 8, 1, "#000"); ctx.globalAlpha = 1;
  px(x - 2, y + 8, 2, 5 + step, "#1a2236"); px(x + 1, y + 8, 2, 5 - step, "#1a2236");
  px(x - 3, y, 7, 9, "#26416e"); px(x - 3, y, 7, 2, "#365a93");   // navy uniform
  px(x - 1, y + 2, 2, 6, "#cab43a");                              // brass buttons
  px(x + (face > 0 ? 3 : -4), y + 1, 2, 7, "#1f3458");           // outstretched arm
  px(x - 2, y - 5, 5, 5, "#e0b48a");
  px(x - 3, y - 8, 7, 3, "#16213a"); px(x - 3, y - 9, 7, 2, "#16213a"); px(x - 1, y - 10, 3, 1, "#cab43a"); // peaked cap + badge
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
function drawStall(cx, cy, color, w = 100) {
  const half = w / 2;
  px(cx - half, cy, w, 70, "#2a2230");
  // roof stripes
  const n = Math.max(6, Math.round(w / 10)), sw = w / n;
  for (let i = 0; i < n; i++) px(cx - half + i * sw, cy - 14, Math.ceil(sw), 14, i % 2 ? color : "#e8e2d0");
  px(cx - half - 4, cy - 16, w + 8, 4, "#1c1622");
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
function drawStallCounter(cx, cy, w = 100) {
  const half = w / 2;
  px(cx - half, cy + 50, w, 8, "#4a3a2a"); px(cx - half, cy + 50, w, 2, "#5e4a32");
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
/* ---- the fishing warden (sells fiskekort in his own booth on the market) ---- */
function drawLicenseWarden(x, y) {
  const sway = Math.sin(t * 1.2) * 0.8; x += sway;
  // olive uniform jacket
  px(x - 15, y + 4, 30, 30, "#4a5a38"); px(x - 15, y + 4, 30, 3, "#5a6a44");
  // shirt + green tie
  px(x - 4, y + 4, 8, 18, "#dfe6d2");
  px(x - 2, y + 5, 4, 14, "#2f5a3e");
  // brass buttons
  for (let i = 0; i < 3; i++) px(x - 1, y + 8 + i * 6, 2, 2, "#caa23a");
  // breast badge
  px(x - 12, y + 9, 4, 3, "#caa23a"); px(x - 11, y + 10, 2, 1, "#fff2a0");
  // arms — one holds a clipboard
  px(x - 19, y + 8, 5, 16, "#4a5a38"); px(x + 14, y + 8, 5, 14, "#4a5a38");
  px(x - 20, y + 22, 4, 4, "#e3b58c");
  // clipboard in the near hand
  px(x + 11, y + 18, 11, 13, "#6a4a2a"); px(x + 12, y + 19, 9, 11, "#efe7d2");
  px(x + 15, y + 17, 4, 2, "#caa23a");
  for (let i = 0; i < 3; i++) px(x + 13, y + 22 + i * 3, 7, 1, "#9aa0a8");
  px(x + 9, y + 20, 4, 4, "#e3b58c");
  // a rubber stamp he keeps thunking down on the paperwork
  if (wardenStamp > 0) {
    const lift = Math.round(wardenStamp * 9);
    const sx = x + 14, sy = y + 15 - lift;
    px(sx, sy + 3, 4, 3, "#9a2a2a");            // inked head
    px(sx + 1, sy - 1, 2, 4, "#2a2026");        // handle
    if (wardenStamp < 0.3) px(x + 15, y + 21, 3, 2, "#7a2a3a");   // fresh red mark left behind
  }
  // when scheming he rubs his greedy little hands together at his belly
  if (wardenScheme > 0) {
    const rub = Math.sin(t * 14) * 2;
    px(x - 4 + rub, y + 20, 4, 3, "#e3b58c");
    px(x + 1 - rub, y + 20, 4, 3, "#e3b58c");
  }
  // head
  px(x - 8, y - 9, 16, 14, "#e7c19a"); px(x - 8, y + 3, 16, 2, "#d2a87c");
  // friendly eyes + moustache + a smile that turns sly when he schemes
  px(x - 4, y - 3, 2, 2, "#2a2030"); px(x + 2, y - 3, 2, 2, "#2a2030");
  px(x - 4, y + 1, 8, 1, "#6a5a3a");
  if (wardenScheme > 0) {
    px(x - 3, y + 3, 6, 1, "#7a4a4a"); px(x - 4, y + 2, 1, 1, "#7a4a4a"); px(x + 3, y + 2, 1, 1, "#7a4a4a"); // upturned sly grin
    px(x - 5, y - 4, 2, 1, "#6a5a3a");                                                                       // one cocked eyebrow
  } else {
    px(x - 2, y + 3, 4, 1, "#9a6a5a");                                                                       // small neutral smile
  }
  // peaked cap (dark green) with black brim + brass badge
  px(x - 9, y - 12, 18, 5, "#2f4a30"); px(x - 9, y - 7, 18, 2, "#243a26");
  px(x - 12, y - 5, 8, 2, "#1a1a1a");
  px(x - 2, y - 11, 4, 3, "#caa23a"); px(x - 1, y - 10, 2, 1, "#fff2a0");
}
// the little permit booth standing out on the market square
function drawLicenseBooth() {
  const r = LICENSE_BOOTH, cx = r.x + r.w / 2, y = r.y;
  ctx.globalAlpha = 0.25; ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(cx, y + r.h, r.w / 2, 4, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
  // booth box + plank shading
  px(cx - 30, y + 2, 60, 46, "#5a4632"); px(cx - 30, y + 2, 60, 3, "#6e573f");
  for (let yy = y + 8; yy < y + 46; yy += 6) px(cx - 28, yy, 56, 1, "#4a3826");
  // striped awning
  for (let i = 0; i < 7; i++) px(cx - 31 + i * 9, y - 7, 9, 9, i % 2 ? "#3a7a4a" : "#e8e2d0");
  px(cx - 33, y - 9, 66, 3, "#2c2230");
  // the warden, then the counter in front of him
  drawLicenseWarden(cx, y + 12);
  px(cx - 32, y + 30, 64, 7, "#4a3a2a"); px(cx - 32, y + 30, 64, 2, "#5e4a32");
  // sign plank
  px(cx - 28, y + 38, 56, 9, "#6a4a2a"); px(cx - 28, y + 38, 56, 2, "#7e5a36");
  ctx.fillStyle = "#ffe6a0"; ctx.font = "bold 7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("FISKEKORT", cx, y + 43);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  // pulsing «click me» outline
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);
  ctx.globalAlpha = 0.35 + 0.45 * pulse; ctx.strokeStyle = "#ffe6a0"; ctx.lineWidth = 1;
  ctx.strokeRect(r.x, r.y - 8, r.w, r.h + 8);
  ctx.globalAlpha = 1;
}
function drawShopLicenseBg() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#27322a"); g.addColorStop(1, "#161d18"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // wood-panel wall
  for (let x = 0; x < W; x += 28) px(x, 0, 1, 150, "#1f291f");
  // a framed "FISKEKORT KREVES" notice
  px(40, 36, 96, 60, "#3a2c1e"); px(44, 40, 88, 52, "#e8e0cc");
  ctx.fillStyle = "#3a4a30"; ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("FISKEKORT", 88, 52); ctx.fillText("KREVES", 88, 62);
  ctx.strokeStyle = "#7a8a5a"; ctx.lineWidth = 1; ctx.strokeRect(56, 70, 64, 14);
  ctx.fillStyle = "#6a7a4a"; ctx.font = "6px monospace"; ctx.fillText("av alle som fisker", 88, 77);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  // pinned permit cards on the wall
  const cols = ["#ffe6a0", "#bfe6ef", "#f0c0d0", "#c8f0c0"];
  for (let i = 0; i < 4; i++) { const cx = 168 + i * 28; px(cx, 44, 18, 12, cols[i]); px(cx, 44, 18, 2, "#fff"); px(cx + 8, 41, 2, 4, "#7a5a38"); }
  // counter + the warden
  px(60, 175, 360, 55, "#3a4a30"); px(60, 175, 360, 6, "#4a5e3f");
  drawLicenseWarden(150, 150);
  drawVignette();
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
// in-scene side panels are right-aligned to this edge so they never cover the fisherman on the left
const PANEL_R = 472;
const COOLER_MENU = [
  { key: "_godsaker", name: "Godsaker", action: true },
  { key: "_rods", name: "Bytt stang", action: true },
  { key: "_hats", name: "Hatter", action: true },
  { key: "_bag", name: "Se fangst", action: true },
  { key: "_records", name: "Rekorder", action: true },
  { key: "_funn", name: "Skrotsamling", action: true },
];
const CONSUMABLES = [
  { key: "beer", name: "Trygdepatron" },
  { key: "snus", name: "Snus" },
  { key: "cigar", name: "Sigarillo" },
  { key: "akevitt", name: "Blænnvin" },
  { key: "snabel", name: "Snabelstoff" },
];
function coolerItemRects() {
  const w = 122, h = 17, x = PANEL_R - 126;
  return COOLER_MENU.map((it, i) => ({ ...it, x, y: 170 - i * 21, w, h }));
}
function drawCoolerMenu() {
  if (!coolerMenu) return;
  const rects = coolerItemRects();
  const top = rects[rects.length - 1].y - 15, bot = rects[0].y + 17 + 4;
  const x0 = rects[0].x - 4, pw = 130;
  px(x0, top, pw, bot - top, "rgba(14,12,22,0.94)");
  px(x0, top, pw, 3, "#caa46a");
  ctx.fillStyle = "#e6c98a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("SEKKEN", x0 + pw / 2, top + 8);
  drawBackArrow(x0, pw, top);
  for (const it of rects) {
    px(it.x, it.y, it.w, it.h, "#2a2440");
    px(it.x, it.y, it.w, 1, "#3a2e4a");
    const cy = it.y + it.h / 2;
    const ic = it.key === "_godsaker" ? "🍬" : it.key === "_rods" ? "🎣" : it.key === "_hats" ? "🎩" : it.key === "_bag" ? "🎒" : it.key === "_funn" ? "📦" : "🏆";
    ctx.fillStyle = "#bfc8ff"; ctx.font = "8px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(ic, it.x + 5, cy);
    ctx.fillStyle = "#dfe6ff"; ctx.font = "9px monospace"; ctx.fillText(it.name, it.x + 20, cy + 1);
    ctx.fillStyle = "#9aa6d0"; ctx.textAlign = "right"; ctx.fillText("›", it.x + it.w - 6, cy);
  }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function godsakerRects() {
  const w = 122, h = 17, x = PANEL_R - 126;
  return CONSUMABLES.map((it, i) => ({ ...it, x, y: 170 - i * 21, w, h }));
}
function drawGodsakerPanel() {
  if (!godsakerPanel) return;
  const rects = godsakerRects();
  const top = rects[rects.length - 1].y - 15, bot = rects[0].y + 17 + 4 + 26;   // extra room for the RUS gauge
  const x0 = rects[0].x - 4, pw = 130;
  px(x0, top, pw, bot - top, "rgba(14,12,22,0.94)");
  px(x0, top, pw, 3, "#caa46a");
  ctx.fillStyle = "#e6c98a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("GODSAKER", x0 + pw / 2, top + 8);
  drawBackArrow(x0, pw, top);
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
  // live RUS gauge so you can see how close you are to blacking out before you keel over
  const gy = rects[0].y + 17 + 8, gx = x0 + 8, gw = pw - 16, gh = 7;
  const dfrac = clamp(drunk / DRUNK_KO, 0, 1);
  const near = dfrac >= 0.82;
  const col = dfrac < 0.5 ? "#8ad0ff" : dfrac < 0.82 ? "#ffb04a" : "#ff5a4a";
  ctx.font = "bold 7px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillStyle = "#cbb9c6"; ctx.fillText("RUS", gx, gy - 4);
  if (near) {
    ctx.textAlign = "right"; ctx.fillStyle = (Math.sin(t * 8) > 0) ? "#ff7a6a" : "#ffd27a";
    ctx.fillText(dfrac >= 1 ? "BLACKOUT!" : "STOPP!", gx + gw, gy - 4);
  }
  px(gx, gy, gw, gh, "#241c30"); px(gx, gy, gw, 1, "#3a2e4a");
  px(gx + 1, gy + 1, Math.max(1, Math.round((gw - 2) * dfrac)), gh - 2, col);
  // limit marker at the blackout line
  px(gx + 1 + Math.round((gw - 2) * 1.0) - 1, gy - 1, 1, gh + 2, "#ff5a4a");
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
/* in-scene rod picker (replaces the old inventory overlay for "Bytt stang") */
function rodPanelRects() {
  const owned = save.owned.slice().sort((a, b) => a - b);
  const w = 132, h = 20, x = PANEL_R - 136;
  return owned.map((level, i) => ({ level, x, y: 150 - i * 22, w, h }));
}
function drawRodPanel() {
  if (!rodPanel) return;
  const rects = rodPanelRects();
  const top = rects[rects.length - 1].y - 16, bot = rects[0].y + 20 + 5;
  const x0 = rects[0].x - 4, pw = 140;
  px(x0, top, pw, bot - top, "rgba(14,12,22,0.94)");
  px(x0, top, pw, 3, "#caa46a");
  ctx.fillStyle = "#e6c98a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("BYTT STANG", x0 + pw / 2, top + 8);
  drawBackArrow(x0, pw, top);
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
  const w = 168, x = PANEL_R - w, rh = 14, top = 40, headH = 22;
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
/* the silly collectibles you fish up — a little side-quest to complete the set */
function drawFunnPanel() {
  if (!funnPanel) return;
  let found = 0;
  for (const j of JUNK) if ((save.junk || {})[j.key] > 0) found++;
  const w = 200, x = PANEL_R - w, rh = 16, top = 30, headH = 26;
  const h = headH + JUNK.length * rh + 18;
  px(x, top, w, h, "rgba(14,12,22,0.96)");
  px(x, top, w, 3, "#caa46a");
  ctx.fillStyle = "#e6c98a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("SKROTSAMLING", x + w / 2, top + 10);
  drawBackArrow(x, w, top);
  ctx.font = "7px monospace"; ctx.fillStyle = found === JUNK.length ? "#9affc0" : "#9aa6d0";
  ctx.fillText(found === JUNK.length ? "Komplett! Du har funnet alt rart." : "Funn: " + found + "/" + JUNK.length + " typer", x + w / 2, top + 19);
  ctx.textBaseline = "middle";
  JUNK.forEach((j, i) => {
    const n = (save.junk || {})[j.key] || 0;
    const has = n > 0;
    const y = top + headH + i * rh + 8;
    if (has) drawJunkSprite(ctx, x + 14, y, 1.4, j.kind);
    ctx.textAlign = "left"; ctx.font = "8px monospace";
    ctx.fillStyle = has ? "#f0e6d0" : "#6a6472";
    ctx.fillText(has ? j.name : "???", x + 28, y);
    ctx.textAlign = "right";
    ctx.fillStyle = has ? "#ffe6a0" : "#6a6472";
    ctx.fillText(has ? "×" + n : "ikke funnet", x + w - 8, y);
  });
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
/* in-scene record book (replaces the old inventory "Rekorder" tab) */
function drawRecordsPanel() {
  if (!recordsPanel) return;
  let caught = 0;
  for (const f of FISH) { const r = save.record[f.key]; if (r && r.count > 0) caught++; }
  let trophies = 0;
  for (const f of RARES) { const r = save.record[f.key]; if (r && r.count > 0) trophies++; }
  // two-column "open book" layout so the whole catalogue fits on-screen as it grows
  const w = 252, x = PANEL_R - w, rh = 11, top = 13, headH = 23;
  const colW = (w - 16) / 2, colX = [x + 8, x + 8 + colW];
  const fishRows = Math.ceil(FISH.length / 2), trophyRows = Math.ceil(RARES.length / 2);
  const h = headH + fishRows * rh + 14 + trophyRows * rh + 10;
  px(x, top, w, h, "rgba(14,12,22,0.96)");
  px(x, top, w, 3, "#caa46a");
  // a faint centre crease so it reads like an open book
  px(x + w / 2, top + headH - 2, 1, fishRows * rh + 4, "rgba(202,164,106,0.18)");
  ctx.fillStyle = "#e6c98a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("REKORDBOKA", x + w / 2, top + 10);
  drawBackArrow(x, w, top);
  ctx.font = "7px monospace"; ctx.fillStyle = "#9aa6d0";
  ctx.fillText(`Arter: ${caught}/${FISH.length}   Troféer: ${trophies}/${RARES.length}`, x + w / 2, top + 19);
  ctx.textBaseline = "middle";
  FISH.forEach((f, i) => {
    const r = save.record[f.key];
    const has = r && r.count > 0;
    const cx = colX[i % 2], y = top + headH + Math.floor(i / 2) * rh + 6;
    ctx.font = "8px monospace"; ctx.textAlign = "left"; ctx.fillStyle = has ? "#f0e6d0" : "#6a6472";
    ctx.fillText(has ? f.name : "???", cx, y);
    ctx.textAlign = "right"; ctx.font = "7px monospace";
    if (has) { ctx.fillStyle = "#ffe6a0"; ctx.fillText(`${r.best.toFixed(1)}kg ×${r.count}`, cx + colW - 6, y); }
    else { ctx.fillStyle = "#6a6472"; ctx.fillText("—", cx + colW - 6, y); }
  });
  // trophy fish section
  const ty = top + headH + fishRows * rh + 9;
  ctx.textAlign = "center"; ctx.fillStyle = "#ffd877"; ctx.font = "bold 8px monospace";
  ctx.fillText("— TROFÉFISK —", x + w / 2, ty);
  RARES.forEach((f, i) => {
    const r = save.record[f.key];
    const has = r && r.count > 0;
    const cx = colX[i % 2], y = ty + 9 + Math.floor(i / 2) * rh;
    ctx.font = "8px monospace"; ctx.textAlign = "left"; ctx.fillStyle = has ? "#ffe6a0" : "#6a6472";
    ctx.fillText(has ? "🏆 " + f.name : "🔒 ???", cx, y);
    ctx.textAlign = "right"; ctx.font = "7px monospace";
    if (has) { ctx.fillStyle = "#ffd877"; ctx.fillText(`${r.best.toFixed(1)}kg`, cx + colW - 6, y); }
    else { ctx.fillStyle = "#6a6472"; ctx.fillText(f.locName, cx + colW - 6, y); }
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
  const r = TRUCK;
  const on = hoverProp === "truck";                 // hovered → engine idles, shakes, lights on, puffs exhaust
  const shake = on ? Math.sin(t * 38) * 0.6 : 0;
  const x = r.x + shake, y = r.y + (on ? Math.sin(t * 31) * 0.4 : 0);
  // small earthy tyre-track patch so it reads as parked on the bank (not floating)
  ctx.fillStyle = "#241a10";
  ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, r.y + r.h, r.w / 2 - 1, 3, 0, 0, 6.28); ctx.fill();
  // exhaust puffs from the tailpipe at the back while idling
  if (on) {
    const puff = (t * 1.4) % 1;
    ctx.globalAlpha = (1 - puff) * 0.4; ctx.fillStyle = "#b9b4ad";
    ctx.beginPath(); ctx.arc(x + r.w - 2, y + 20 - puff * 10, 1.5 + puff * 3, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // body (side view, cab to the left)
  px(x + 3, y + 11, r.w - 5, 10, "#b23a2a");   // bed
  px(x + 3, y + 4, 18, 10, "#c64636");         // cab
  px(x + 6, y + 6, 11, 6, "#bfe6ef");          // window
  px(x + 3, y + 19, r.w - 5, 3, "#7a241c");    // chassis shadow
  // wheels
  px(x + 8, y + 20, 6, 5, "#1a1a1a"); px(x + 10, y + 22, 2, 2, "#555");
  px(x + r.w - 12, y + 20, 6, 5, "#1a1a1a"); px(x + r.w - 10, y + 22, 2, 2, "#555");
  // headlight (glows brighter + casts a little beam when idling)
  px(x + 2, y + 9, 2, 3, on ? "#fff6c8" : "#ffe9a0");
  if (on) {
    ctx.globalAlpha = 0.28 + 0.1 * Math.sin(t * 30); ctx.fillStyle = "#fff0b0";
    ctx.beginPath(); ctx.moveTo(x + 1, y + 8); ctx.lineTo(x - 14, y + 5); ctx.lineTo(x - 14, y + 14); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
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
    case "trollbig": {
      // a hulking troll heaves itself up out of the bog, then sinks back
      const x = clamp(bobber.x, 150, W - 60), base = WATER_Y + 34;
      const rise = Math.min(clamp(gameEvent.t / 1.2, 0, 1), clamp((gameEvent.dur - gameEvent.t) / 1.2, 0, 1));
      const cy = base - rise * 66;
      px(x - 26, cy, 52, 52, "#3f5a2e"); px(x - 26, cy, 52, 4, "#4f6e3a");          // head/shoulders
      px(x - 32, cy + 10, 8, 14, "#3f5a2e"); px(x + 24, cy + 10, 8, 14, "#3f5a2e");   // ears
      for (let i = 0; i < 8; i++) px(x - 22 + i * 6, cy - 4, 5, 6, "#2c421f");          // mossy hair
      px(x - 18, cy + 4, 12, 3, "#22331a");                                            // brow
      px(x - 16, cy + 14, 9, 7, "#ffd23a"); px(x + 7, cy + 14, 9, 7, "#ffd23a");       // glowing eyes
      px(x - 13, cy + 16, 3, 3, "#1a1208"); px(x + 10, cy + 16, 3, 3, "#1a1208");
      px(x - 4, cy + 21, 9, 13, "#365021");                                            // big nose
      px(x - 14, cy + 38, 28, 4, "#1a2410");                                           // mouth
      px(x - 12, cy + 38, 4, 6, "#dfe6c0"); px(x + 8, cy + 38, 4, 6, "#dfe6c0");        // tusks
      if (rise > 0.55 && Math.random() < 0.4) { addRippleMaybe(x - 22, base + 6); addRippleMaybe(x + 22, base + 8); }
      break;
    }
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
      // a corked bottle drifting in from the open water to the near bank, right at the angler's feet
      const fx = 120, fy = 150;                       // resting spot at the water's edge by his boots
      const k = clamp(p / 0.7, 0, 1);                 // eases in over the first ~70 % of the event
      const x = lerp(fx + 84, fx, k);                 // drifts shoreward (right→left) toward the player
      const y = lerp(fy + 16, fy, k) + Math.sin(t * 2 + sd) * 1.2;
      addRippleMaybe(x, y);
      px(x - 2, y - 6, 4, 10, "#5a8a6a"); px(x - 1, y - 6, 1, 10, "#7aa888"); // glass
      px(x - 1, y - 9, 2, 3, "#caa07a");                                       // cork
      px(x - 2, y - 2, 4, 3, "#e8e0c0");                                       // paper note inside
      if (p > 0.6) { sparkle(x, y - 2, t); }
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
      // a big log drifting across the open water, pushing a wake (kept well off the far grass edge)
      const x = cross, y = WATER_Y + 32 + Math.sin(t * 2) * 1.5;
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
      // a paddler zipping across the open water, paddle dipping side to side
      const x = cross, y = WATER_Y + 22 + Math.sin(t * 3) * 1, pad = Math.sin(t * 8);
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
      // a fat marsh-gas bubble rising and popping at the surface near where you're fishing
      const rise = clamp(p / 0.7, 0, 1), x = clamp(bobber.x, 140, W - 40), y = lerp(bobber.y + 16, bobber.y - 2, rise), r = 3 + rise * 4;
      if (p < 0.72) { ctx.globalAlpha = ea * 0.7; ctx.fillStyle = "#9abf6a"; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); ctx.globalAlpha = ea * 0.9; px(x - 1, y - 1, 1, 1, "#d8f0a0"); }
      else { for (let i = 0; i < 6; i++) { const a2 = i / 6 * 6.28; ctx.globalAlpha = ea * (1 - (p - 0.72) / 0.28); px(x + Math.cos(a2) * (r + (p - 0.72) * 40), y + Math.sin(a2) * (r + (p - 0.72) * 30), 2, 2, "#c8e89a"); } }
      ctx.globalAlpha = ea; addRippleMaybe(x, bobber.y - 2);
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
    case "hunter": {
      // a hunter ambles out of the treeline, peers around all confused, then heads back in
      const ground = 150;                                                          // far-bank ground line (right side)
      let x, face = -1, walk = false, looking = false;
      if (p < 0.26) { x = lerp(W + 18, 322, p / 0.26); walk = true; face = -1; }    // emerges from the right
      else if (p < 0.72) { x = 322; looking = true; face = Math.sin(t * 1.1) > 0 ? -1 : 1; }   // stops and glances about
      else { x = lerp(322, W + 18, (p - 0.72) / 0.28); walk = true; face = 1; }     // gives up and wanders back
      drawHunter(x, ground, face, walk, looking, ea);
      break;
    }
    case "buddy": {
      // your fishing buddy: ambles in, hands you a strong dram, then wades in and yanks out a fish
      const ground = 220;
      let x, y = ground, walk = false, face = 1, bottle = false, fish = false, sub = 0;
      if (p < 0.20) { x = lerp(-22, 42, p / 0.20); walk = true; face = 1; }                         // walk in
      else if (p < 0.38) { x = 42; bottle = true; }                                                  // hand over the dram
      else if (p < 0.52) { x = lerp(42, 116, (p - 0.38) / 0.14); walk = true; face = 1; }            // head for the water
      else if (p < 0.64) { x = 116; sub = (p - 0.52) / 0.12; y = ground + sub * 12; }                // wade in / dunk
      else if (p < 0.78) { x = 116; sub = 1 - (p - 0.64) / 0.14; y = ground + sub * 12; fish = true; } // rise with a fish
      else { x = lerp(116, -22, (p - 0.78) / 0.22); walk = true; face = -1; fish = true; }            // saunter off with the catch
      drawBuddy(x, y, face, walk, bottle, fish, sub, ea);
      break;
    }
    case "beaver": {
      // a beaver swimming across the open water, then a big tail-slap splash
      const x = cross, y = WATER_Y + 24, slap = p > 0.45 && p < 0.6;
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
      const x = clamp(bobber.x - 16, 130, W - 30), y = bobber.y - 6 + Math.sin(t * 2) * 1;
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
    case "rockfall": {
      // boulders crashing down from the cavern roof into the pond
      const cxr = clamp(bobber.x, 150, W - 50);
      for (let i = 0; i < 4; i++) {
        const ph = (p * 1.4 + i * 0.22) % 1;
        const rx = cxr - 30 + i * 18 + Math.sin(i) * 6;
        const ry = lerp(0, WATER_Y + 6, ph);
        const rr = 3 + (i % 3);
        ctx.fillStyle = "#5a5560"; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 6.28); ctx.fill();
        px(rx - rr + 1, ry - rr + 1, 2, 2, "#7a7682");
        if (ph > 0.92) { for (let k = 0; k < 5; k++) { const a2 = -1 + k * 0.4; px(rx + Math.cos(a2) * 8, WATER_Y - Math.abs(Math.sin(a2)) * 10, 2, 2, "#bcd0e6"); } addRippleMaybe(rx, WATER_Y + 2); }
      }
      // dust puff at the ceiling crack
      ctx.globalAlpha = ea * 0.4 * (1 - p); ctx.fillStyle = "#6a6470"; ctx.beginPath(); ctx.arc(cxr, 6, 10, 0, 6.28); ctx.fill();
      ctx.globalAlpha = ea;
      break;
    }
    case "witch": {
      // a witch glides across on a broomstick, trailing green spell-sparkles
      const x = cross, y = 56 + Math.sin(t * 2 + sd) * 8;
      ctx.save(); if (dir < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
      px(x - 14, y + 4, 22, 2, "#7a5630"); for (let i = 0; i < 5; i++) px(x + 8, y + 2 + i, 6 - i, 1, "#caa060"); // broom + bristles
      px(x - 6, y - 6, 10, 12, "#2a1f3a"); px(x - 6, y - 6, 10, 2, "#3a2f4a");        // cloak
      px(x - 3, y - 12, 6, 7, "#9ad08a"); px(x - 2, y - 9, 1, 1, "#1a1208"); px(x + 1, y - 9, 1, 1, "#1a1208"); // green face + eyes
      ctx.fillStyle = "#1a1228"; ctx.beginPath(); ctx.moveTo(x - 5, y - 11); ctx.lineTo(x + 5, y - 11); ctx.lineTo(x + 1, y - 23); ctx.closePath(); ctx.fill(); // pointy hat
      px(x - 6, y - 11, 12, 2, "#1a1228"); px(x - 1, y - 19, 3, 2, "#7a3a8a");          // brim + band
      ctx.restore();
      for (let i = 1; i < 5; i++) { ctx.globalAlpha = ea * (1 - i / 5); px(x + dir * i * 6, y + 6 + Math.sin(t * 3 + i) * 3, 2, 2, "#9affc0"); }
      ctx.globalAlpha = ea;
      break;
    }
    case "bats": {
      // a swarm of bats flitting across the cavern
      for (let i = 0; i < 9; i++) {
        const ph = (p + i * 0.11) % 1;
        const bx = dir > 0 ? -20 + ph * (W + 40) : W + 20 - ph * (W + 40);
        const by = 38 + (i % 4) * 16 + Math.sin(t * 6 + i) * 6;
        const flap = Math.sin(t * 18 + i) > 0 ? 1 : -1;
        ctx.fillStyle = "#5a5070"; px(bx, by, 2, 2, "#6a6080");
        ctx.beginPath(); ctx.moveTo(bx, by + 1); ctx.lineTo(bx - 4, by - flap * 2); ctx.lineTo(bx - 1, by + 1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx + 2, by + 1); ctx.lineTo(bx + 6, by - flap * 2); ctx.lineTo(bx + 3, by + 1); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case "gems": {
      // a vein of glittering crystals in the back wall
      const x = 150, y = 118;
      for (const [ox, oy, col] of [[0, 0, "#9affe0"], [6, 3, "#7ad0ff"], [-4, 4, "#c0a0ff"], [3, -3, "#9affe0"]]) {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + ox, y + oy - 3); ctx.lineTo(x + ox + 2, y + oy); ctx.lineTo(x + ox, y + oy + 3); ctx.lineTo(x + ox - 2, y + oy); ctx.closePath(); ctx.fill();
        px(x + ox - 1, y + oy - 1, 1, 1, "#eafff8");
      }
      for (let i = 0; i < 3; i++) sparkle(x - 4 + i * 5, y + Math.sin(t * 2 + i) * 2, t * 2 + i);
      break;
    }
    case "draug": {
      // a spectral cave-draug heaves up out of the black water, wailing, then sinks
      const x = clamp(bobber.x, 150, W - 60);
      const rise = Math.min(clamp(gameEvent.t / 1.2, 0, 1), clamp((gameEvent.dur - gameEvent.t) / 1.2, 0, 1));
      const base = WATER_Y + 30, cy = base - rise * 56;
      ctx.globalAlpha = ea * 0.85;
      const gg = ctx.createRadialGradient(x, cy + 6, 4, x, cy + 6, 34); gg.addColorStop(0, "rgba(120,255,200,0.4)"); gg.addColorStop(1, "rgba(120,255,200,0)");
      ctx.fillStyle = gg; ctx.fillRect(x - 34, cy - 28, 68, 68);
      ctx.fillStyle = "#3a6a58";
      ctx.beginPath(); ctx.moveTo(x - 14, cy + 34); ctx.lineTo(x - 10, cy); ctx.quadraticCurveTo(x, cy - 14, x + 10, cy); ctx.lineTo(x + 14, cy + 34); ctx.closePath(); ctx.fill(); // tattered shroud
      px(x - 6, cy - 6, 12, 12, "#cfeee0"); px(x - 6, cy + 4, 12, 2, "#9ac0b0");           // skull
      px(x - 4, cy - 1, 3, 4, "#0a1a14"); px(x + 1, cy - 1, 3, 4, "#0a1a14");              // eye sockets
      px(x - 1, cy + 4, 2, 3, "#0a1a14"); px(x - 4, cy + 8, 8, 1, "#1a2a22");              // nose + jaw
      ctx.globalAlpha = ea;
      if (rise > 0.5 && Math.random() < 0.3) { addRippleMaybe(x - 12, base + 4); addRippleMaybe(x + 12, base + 6); }
      break;
    }
  }
  ctx.restore();
}
function addRippleMaybe(x, y) { if (Math.random() < 0.08) addRipple(x, y, 10); }
function drawBuddy(x, y, face, walk, bottle, fish, sub, ea) {
  // a sturdy fishing buddy — same build as the player, but a navy jacket + red beanie so he reads as a pal
  ctx.save();
  if (face < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
  const step = walk ? Math.sin(t * 11) * 2 : 0;
  // soft shadow
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * 0.25; ctx.fillStyle = "#16240e"; ctx.beginPath(); ctx.ellipse(x, y + 1, 8, 2, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = prevA;
  // legs + boots
  px(x - 4, y - 12, 3, 12 + step, "#3a4658"); px(x + 1, y - 12, 3, 12 - step, "#323c4e");
  px(x - 5, y - 1, 4, 3, "#3a2a1a"); px(x + 1, y - 1, 4, 3, "#3a2a1a");
  // navy jacket torso (broader + taller than the old family figure)
  px(x - 7, y - 27, 15, 16, "#2f4a6a"); px(x - 7, y - 27, 15, 2, "#3d5d82");
  px(x - 1, y - 25, 2, 13, "#24405e");                                       // zipper
  // head + red beanie
  const hx = x, hy = y - 31;
  px(hx - 4, hy - 3, 9, 8, "#e3b58c"); px(hx - 4, hy + 4, 9, 2, "#caa07a");
  px(hx - 5, hy - 6, 11, 4, "#c0392b"); px(hx - 5, hy - 3, 11, 1, "#8c2a20"); px(hx, hy - 8, 2, 2, "#e05a4a"); // beanie + pom
  px(hx - 1, hy + 1, 1, 1, "#2a1f18"); px(hx + 3, hy + 1, 1, 1, "#2a1f18");  // eyes
  if (bottle) {
    // raising the dram toward you
    px(x + 5, y - 25, 4, 8, "#2f4a6a"); px(x + 7, y - 30, 4, 5, "#e3b58c");
    px(x + 7, y - 36, 3, 7, "#9a7a3a"); px(x + 7, y - 37, 3, 2, "#caa84a");  // bottle
    if (Math.sin(t * 8) > 0) { ctx.fillStyle = "#ffe6a0"; ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.fillText("skaal!", x + 2, y - 40); ctx.textAlign = "left"; }
  } else if (fish) {
    // holding a flapping fish triumphantly overhead
    px(x + 4, y - 29, 4, 8, "#2f4a6a"); px(x + 6, y - 35, 4, 5, "#e3b58c");
    const flop = Math.sin(t * 12) * 2;
    px(x + 5, y - 43 + flop, 9, 4, "#9fb8c8"); px(x + 5, y - 43 + flop, 9, 1, "#c0d8e8");
    px(x + 13, y - 44 + flop, 3, 6, "#7fa0b0");                              // tail
    px(x + 6, y - 42 + flop, 1, 1, "#24343f");                              // eye
  } else {
    px(x + 5, y - 24, 5, 8, "#2f4a6a"); px(x + 7, y - 17, 3, 3, "#e3b58c");
  }
  // submerged: a water line cuts across the lower body + splash droplets
  if (sub > 0) {
    const wl = y - 5 - sub * 5;
    ctx.globalAlpha = prevA * 0.55; ctx.fillStyle = "#2a5a5a"; ctx.fillRect(x - 9, wl, 18, (y + 2) - wl); ctx.globalAlpha = prevA;
    for (let i = 0; i < 5; i++) { const a2 = -1 + i * 0.4; px(x + Math.cos(a2) * 9, wl - Math.abs(Math.sin(a2)) * 7 * sub, 2, 2, "#bfe0e0"); }
  }
  ctx.restore();
}
function drawHunter(x, y, face, walk, looking, ea) {
  // a confused hunter in a blaze-orange cap + olive coat, rifle slung on his back
  ctx.save();
  if (face < 0) { ctx.translate(x * 2, 0); ctx.scale(-1, 1); }
  const step = walk ? Math.sin(t * 10) * 2 : 0;
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * 0.25; ctx.fillStyle = "#16240e"; ctx.beginPath(); ctx.ellipse(x, y + 1, 7, 2, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = prevA;
  // legs + boots
  px(x - 4, y - 11, 3, 11 + step, "#3a3326"); px(x + 1, y - 11, 3, 11 - step, "#322b20");
  px(x - 5, y - 1, 4, 3, "#241a10"); px(x + 1, y - 1, 4, 3, "#241a10");
  // slung rifle (drawn behind the torso, barrel over the shoulder)
  ctx.strokeStyle = "#2a2018"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y - 5); ctx.lineTo(x + 6, y - 26); ctx.stroke();
  px(x + 4, y - 27, 3, 2, "#4a3a28");                                          // stock
  // olive hunting coat
  px(x - 6, y - 25, 13, 15, "#4a5234"); px(x - 6, y - 25, 13, 2, "#5a6442");
  px(x - 6, y - 18, 13, 1, "#3a4228");                                         // belt line
  // head + blaze-orange cap
  const hx = x, hy = y - 29;
  px(hx - 4, hy - 2, 8, 8, "#e3b58c"); px(hx - 4, hy + 5, 8, 2, "#caa07a");
  px(hx - 5, hy - 5, 10, 4, "#e8641e"); px(hx - 5, hy - 2, 10, 1, "#b8480f");  // cap
  px(hx + 4, hy - 4, 3, 2, "#e8641e");                                         // cap brim
  px(hx - 1, hy + 1, 1, 1, "#2a1f18"); px(hx + 3, hy + 1, 1, 1, "#2a1f18");    // eyes
  if (looking) {
    // raises a hand to his brow, scouting — with a puzzled "?" bobbing overhead
    px(x + 4, y - 25, 4, 6, "#4a5234"); px(x + 6, y - 30, 4, 3, "#e3b58c");    // arm + hand at brow
    const bob = Math.sin(t * 3) * 1.5;
    ctx.globalAlpha = prevA * (0.6 + 0.4 * Math.sin(t * 4));
    ctx.fillStyle = "#ffe6a0"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
    ctx.fillText("?", x, y - 40 + bob); ctx.textAlign = "left";
    ctx.globalAlpha = prevA;
  } else {
    px(x + 5, y - 23, 4, 7, "#4a5234"); px(x + 6, y - 17, 3, 3, "#e3b58c");    // arm swinging
  }
  ctx.restore();
}
function sparkle(x, y, ph) {
  const s = 0.5 + 0.5 * Math.sin(ph * 3), prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * (0.4 + s * 0.6);
  px(x, y - 2, 1, 5, "#fff4c0"); px(x - 2, y, 5, 1, "#fff4c0"); px(x, y, 1, 1, "#ffffff");
  ctx.globalAlpha = prev;
}
function drawRiseSpot() {
  if (!riseSpot.active) return;
  const x = riseSpot.x, y = riseSpot.y;
  const fade = Math.min(clamp(riseSpot.t / 0.5, 0, 1), clamp((riseSpot.dur - riseSpot.t) / 0.8, 0, 1));
  ctx.save();
  ctx.globalAlpha = 0.85 * fade;
  // a fish back breaking the surface — a little dark arc that bobs with each ring cycle
  const arc = Math.sin(riseSpot.ringT / 0.75 * Math.PI);
  ctx.fillStyle = "#33434b";
  ctx.beginPath(); ctx.ellipse(x, y - arc * 2, 5, 2 + arc * 1.4, 0, Math.PI, 2 * Math.PI); ctx.fill();
  px(Math.round(x + 4), Math.round(y - arc * 2 - 1), 2, 1, "#56666e");   // tail flick
  // a glint so it clearly reads as a spot worth casting at
  sparkle(x - 1, y - 6, t + riseSpot.x);
  ctx.restore();
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
  // a little pad under the pile so it clearly reads as resting on land
  const cx = 40, cy = 226;
  ctx.fillStyle = LOC.cave ? "#14161f" : "#16261c"; ctx.beginPath(); ctx.ellipse(cx + 4, cy + 4, 22, 6, 0, 0, 6.28); ctx.fill();
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
  // tuck the meters into the bottom-RIGHT corner so they never sit on top of the cat,
  // the catch pile or the fisherman over on the left bank.
  // Keep them visible while the sekk / godsaker menu is open — that's exactly where you
  // pop drinks and snus, so you want to watch FLAKS and RUS react. Those menus sit higher
  // up on the right, so they don't collide with this bottom-corner bar.
  if (rodPanel || bagPanel || recordsPanel || funnPanel || truckMenu) return;
  const showBuff = buff.t > 0;
  const dfrac = clamp(drunk / DRUNK_KO, 0, 1);       // 1.0 = blackout territory
  const showDrunk = drunk > 0.05;
  if (!showBuff && !showDrunk) return;
  const w = 104, x = W - w - 8;
  const rows = (showBuff ? 1 : 0) + (showDrunk ? 1 : 0);
  const h = 5 + rows * 13;
  const y = H - 8 - h;
  const intensity = clamp(buff.luck / 1.0, 0, 1);
  const buffCol = intensity < 0.4 ? "#5fbf5f" : intensity < 0.75 ? "#ffcf5a" : "#ff7a5a";
  const near = dfrac > 0.82;                          // ~drunk 1.15 — the blackout looms
  const drunkCol = dfrac < 0.5 ? "#8ad0ff" : dfrac < 0.82 ? "#ffb04a" : "#ff5a4a";
  px(x, y, w, h, "rgba(14,12,22,0.82)");
  px(x, y, w, 2, showBuff ? buffCol : drunkCol);
  ctx.font = "7px monospace"; ctx.textBaseline = "top";
  const barX = x + 4, barW = w - 8;
  let ry = y + 3;
  // FLAKS row: bonus % up top, a single time-remaining bar that drains cleanly
  if (showBuff) {
    ctx.textAlign = "left"; ctx.fillStyle = "#f0e6d0"; ctx.fillText("FLAKS", x + 4, ry);
    ctx.textAlign = "right"; ctx.fillStyle = buffCol; ctx.fillText("+" + Math.round(buff.luck * 100) + "%", x + w - 4, ry);
    const frac = clamp(buff.t / buff.dur, 0, 1);
    px(barX, ry + 7, barW, 2, "rgba(255,255,255,0.10)");
    px(barX, ry + 7, barW * frac, 2, buffCol);
    ry += 13;
  }
  // RUS row: how close he is to keeling over — pulses red near the limit
  if (showDrunk) {
    const pulse = near ? 0.45 + 0.55 * Math.abs(Math.sin(t * 8)) : 1;
    ctx.globalAlpha = pulse;
    ctx.textAlign = "left"; ctx.fillStyle = "#cfe0ff"; ctx.fillText("RUS", x + 4, ry);
    ctx.textAlign = "right"; ctx.fillStyle = drunkCol; ctx.fillText(near ? "vingler!" : Math.round(dfrac * 100) + "%", x + w - 4, ry);
    px(barX, ry + 7, barW, 2, "rgba(255,255,255,0.10)");
    px(barX, ry + 7, barW * dfrac, 2, drunkCol);
    ctx.globalAlpha = 1;
  }
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
// terrain doodles that make the parchment read like a real region map
function drawMapTerrain() {
  ctx.save();
  // faint topographic contour rings for texture
  ctx.strokeStyle = "rgba(150,128,90,0.22)"; ctx.lineWidth = 1;
  for (const [cx, cy, rr] of [[70, 56, 30], [70, 56, 20], [205, 36, 24], [405, 150, 34], [405, 150, 22], [255, 235, 22]]) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr * 0.7, 0, 0, 6.28); ctx.stroke();
  }
  // a winding river hinting at how the waters connect
  ctx.strokeStyle = "rgba(90,140,165,0.4)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(120, 60); ctx.quadraticCurveTo(180, 120, 150, 170); ctx.quadraticCurveTo(130, 215, 200, 240); ctx.stroke();
  // little forest clusters (pine triangles) scattered in the empty patches
  for (const [fx, fy] of [[40, 118], [62, 205], [205, 168], [275, 96], [350, 44], [150, 58], [120, 150], [330, 200]]) {
    for (let i = 0; i < 3; i++) {
      const ox = fx + (i - 1) * 6;
      ctx.fillStyle = "#5f7d4a"; ctx.beginPath(); ctx.moveTo(ox, fy - 7); ctx.lineTo(ox - 3, fy); ctx.lineTo(ox + 3, fy); ctx.closePath(); ctx.fill();
      px(ox - 1, fy, 2, 2, "#6a4a28");
    }
  }
  // a small snow-tipped mountain range across the top
  for (const [mx, my] of [[300, 50], [318, 46], [338, 52]]) {
    ctx.fillStyle = "#9a8a72"; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - 10, my + 14); ctx.lineTo(mx + 10, my + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#eef0e0"; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - 3, my + 5); ctx.lineTo(mx + 3, my + 5); ctx.closePath(); ctx.fill();
  }
  drawCompassRose(40, 44, 15);
  drawMapSerpent(320, 246);
  // decorative title cartouche, top middle
  const tw = 96, tx = W / 2 - tw / 2, ty = 16;
  ctx.fillStyle = "rgba(165,135,86,0.5)"; px(tx, ty, tw, 15, "rgba(165,135,86,0.5)");
  ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 1; ctx.strokeRect(tx, ty, tw, 15);
  px(tx - 3, ty + 3, 3, 9, "rgba(140,112,70,0.6)"); px(tx + tw, ty + 3, 3, 9, "rgba(140,112,70,0.6)"); // scroll ends
  ctx.fillStyle = "#4a2f15"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("FISKEKARTET", W / 2, ty + 8);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  ctx.restore();
}
// a little hand-drawn compass rose
function drawCompassRose(cx, cy, r) {
  ctx.strokeStyle = "#7a5a38"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.28); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, 6.28); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 - Math.PI / 2;
    const tx = cx + Math.cos(a) * r, ty = cy + Math.sin(a) * r;
    const lx = cx + Math.cos(a + 2.2) * (r * 0.32), ly = cy + Math.sin(a + 2.2) * (r * 0.32);
    const rx = cx + Math.cos(a - 2.2) * (r * 0.32), ry = cy + Math.sin(a - 2.2) * (r * 0.32);
    ctx.fillStyle = i === 0 ? "#9a4030" : "#6a4e30";
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(lx, ly); ctx.lineTo(rx, ry); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = "#7a2a1a"; ctx.font = "bold 7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("N", cx, cy - r - 4);
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
// a classic "here be monsters" sea-serpent doodle
function drawMapSerpent(x, y) {
  ctx.strokeStyle = "rgba(70,100,90,0.5)"; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) { const xx = x + i * 3, yy = y + Math.sin(i * 0.7) * 4; if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
  ctx.stroke();
  ctx.fillStyle = "rgba(70,100,90,0.6)"; ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.28); ctx.fill();
  px(x - 2, y - 2, 1, 1, "#d8e8d0");
}

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
  drawMapTerrain();   // forests, hills, contours, compass + doodles so it reads like a real region
  // little ponds under spots — with the fish that live there swimming inside, so you can see what's biting
  for (const sp of MAP_SPOTS) {
    ctx.fillStyle = "rgba(90,130,150,0.5)";
    ctx.beginPath(); ctx.ellipse(sp.x, sp.y + 2, 24, 13, 0, 0, 6.28); ctx.fill();
    const loc = LOCATIONS.find((l) => l.key === sp.key); if (!loc) continue;
    const unlocked = (save.unlocked || []).includes(sp.key);
    const here = loc.fish.map((k) => FISH_BY_KEY[k]).filter(Boolean).slice(0, 3);
    const slots = [[-10, -4], [10, -2], [-1, 2]];
    here.forEach((f, i) => {
      const [ox, oy] = slots[i];
      const fx = sp.x + ox + Math.sin(t * 1.1 + i * 2.1) * 2.5;
      const fy = sp.y + 2 + oy + Math.cos(t * 1.4 + i) * 1.1;
      ctx.globalAlpha = unlocked ? 1 : 0.5;     // locked waters show shadowy fish — a little teaser
      drawMapFish(fx, fy, f, i % 2 === 1);
    });
    ctx.globalAlpha = 1;
  }
  // dotted road threading the waters from cheapest to priciest — the angler's journey
  const route = MAP_SPOTS.slice().sort((a, b) => {
    const ca = (LOCATIONS.find((l) => l.key === a.key) || {}).cost || 0;
    const cb = (LOCATIONS.find((l) => l.key === b.key) || {}).cost || 0;
    return ca - cb;
  });
  ctx.strokeStyle = "#7a5a38"; ctx.setLineDash([3, 4]); ctx.lineWidth = 2;
  ctx.beginPath();
  route.forEach((sp, i) => { if (i === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y); });
  ctx.stroke(); ctx.setLineDash([]);
  // markers
  const atMarket = mapReturn === "market";
  for (const sp of MAP_SPOTS) {
    const loc = LOCATIONS.find((l) => l.key === sp.key);
    const current = !atMarket && LOC.key === sp.key;
    const locked = !(save.unlocked || []).includes(sp.key);
    // a little themed scene by each water so the map reads like a real region
    drawMapIcon(sp.key, sp.x, sp.y, locked);
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
    if (current) drawMapHere(sp.x + 16, sp.y - 14);   // your parked pickup
  }
  // the market town — always reachable from the map (sell fish, buy gear)
  {
    const mx = MAP_MARKET.x, my = MAP_MARKET.y;
    if (atMarket) { const pr = 14 + Math.sin(t * 4) * 3; ctx.strokeStyle = "rgba(210,70,50,0.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my - 12, pr, 0, 6.28); ctx.stroke(); }
    // little market house: striped awning + walls
    px(mx - 10, my - 12, 20, 12, "#caa06a"); px(mx - 10, my - 12, 20, 2, "#a8814a");
    for (let i = 0; i < 5; i++) px(mx - 10 + i * 4, my - 18, 4, 6, i % 2 ? "#c43a2a" : "#e8e2d0");
    px(mx - 12, my - 19, 24, 2, "#7a5a38");
    px(mx - 3, my - 8, 6, 8, "#6e4a2a");   // door
    // label
    ctx.fillStyle = "#3a2c18"; ctx.font = "8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText("Markedet", mx, my + 4);
    if (atMarket) { ctx.fillStyle = "#2a6a3a"; ctx.fillText("(her)", mx, my + 14); }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    if (atMarket) drawMapHere(mx + 16, my - 14);
  }
}
// a tiny fish swimming in a map pond, drawn in the species' own colours
function drawMapFish(x, y, f, faceLeft) {
  const d = faceLeft ? -1 : 1;
  ctx.fillStyle = f.body;
  ctx.beginPath(); ctx.ellipse(x, y, 3.4, 1.9, 0, 0, 6.28); ctx.fill();
  ctx.fillStyle = f.belly;
  ctx.beginPath(); ctx.ellipse(x, y + 0.7, 2.4, 0.9, 0, 0, 6.28); ctx.fill();
  ctx.fillStyle = f.fin;
  ctx.beginPath(); ctx.moveTo(x - d * 3, y); ctx.lineTo(x - d * 5.4, y - 1.8); ctx.lineTo(x - d * 5.4, y + 1.8); ctx.closePath(); ctx.fill();
  ctx.fillRect(Math.round(x - d * 0.5), Math.round(y - 2.6), 1.4, 1);   // dorsal nub
  ctx.fillStyle = "#fff"; ctx.fillRect(Math.round(x + d * 1.6), Math.round(y - 0.9), 1, 1);
  ctx.fillStyle = "#10131f"; ctx.fillRect(Math.round(x + d * 1.8), Math.round(y - 0.7), 1, 1);
}
// a tiny parked pickup that marks where you currently are on the map
function drawMapHere(x, y) {
  px(x - 6, y, 12, 5, "#c43a2a"); px(x - 6, y, 7, -3, "#c43a2a"); px(x - 5, y - 3, 6, 4, "#c43a2a");
  px(x - 4, y - 2, 4, 3, "#bfe6ef");   // cab window
  ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(x - 4, y + 5, 2, 0, 6.28); ctx.fill(); ctx.beginPath(); ctx.arc(x + 4, y + 5, 2, 0, 6.28); ctx.fill();
}
// small themed decoration drawn next to each water (gives the map character + meaning)
function drawMapIcon(key, x, y, locked) {
  ctx.save();
  if (locked) ctx.globalAlpha = 0.5;
  const ix = x - 22, iy = y - 14;
  if (key === "skogstjern") {            // pine forest
    for (const ox of [0, 7]) { ctx.fillStyle = "#2c5a32"; ctx.beginPath(); ctx.moveTo(ix + ox, iy - 10); ctx.lineTo(ix + ox - 4, iy); ctx.lineTo(ix + ox + 4, iy); ctx.closePath(); ctx.fill(); px(ix + ox - 1, iy, 2, 3, "#5a3a22"); }
  } else if (key === "myra") {           // a troll peeking out of the bog
    px(ix - 2, iy - 6, 12, 10, "#3f5a2e"); px(ix - 4, iy - 9, 4, 5, "#3f5a2e"); px(ix + 6, iy - 9, 4, 5, "#3f5a2e"); // head + ears
    px(ix, iy - 3, 2, 2, "#ffd23a"); px(ix + 6, iy - 3, 2, 2, "#ffd23a");   // glowing eyes
    px(ix + 1, iy + 1, 6, 1, "#1a2410"); px(ix + 2, iy + 2, 1, 2, "#cfe0a0"); // grin + tusk
  } else if (key === "elgtjern") {       // a moose head with antlers
    px(ix, iy - 4, 8, 9, "#5a4030"); px(ix + 2, iy + 3, 5, 3, "#4a3326");
    ctx.strokeStyle = "#caa07a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ix + 1, iy - 4); ctx.lineTo(ix - 4, iy - 9); ctx.moveTo(ix + 7, iy - 4); ctx.lineTo(ix + 12, iy - 9); ctx.stroke();
  } else if (key === "elva") {           // a little waterfall
    px(ix, iy - 10, 8, 4, "#5a6a44"); ctx.strokeStyle = "#bfe6ef"; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(ix + 1 + i * 2, iy - 6); ctx.lineTo(ix + 1 + i * 2, iy + 4 + Math.sin(t * 4 + i) * 1); ctx.stroke(); }
  } else if (key === "fjellvatn") {      // a snowy peak
    ctx.fillStyle = "#6a7283"; ctx.beginPath(); ctx.moveTo(ix + 4, iy - 11); ctx.lineTo(ix - 4, iy + 2); ctx.lineTo(ix + 12, iy + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#eef3f7"; ctx.beginPath(); ctx.moveTo(ix + 4, iy - 11); ctx.lineTo(ix + 1, iy - 5); ctx.lineTo(ix + 7, iy - 5); ctx.closePath(); ctx.fill();
  } else if (key === "nordlys") {        // dancing aurora ribbons + a star
    ctx.strokeStyle = "rgba(120,255,180,0.85)"; ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(ix - 4, iy - 4 + i * 4); ctx.quadraticCurveTo(ix + 4, iy - 10 + i * 4 + Math.sin(t * 2 + i) * 2, ix + 12, iy - 4 + i * 4); ctx.stroke(); }
    px(ix + 10, iy - 10, 1, 1, "#fff");
  } else if (key === "jettegryta") {     // a dark cave mouth with a glowing eye in the deep
    ctx.fillStyle = "#5a5040"; ctx.beginPath(); ctx.moveTo(ix - 4, iy + 3); ctx.lineTo(ix - 2, iy - 9); ctx.lineTo(ix + 10, iy - 9); ctx.lineTo(ix + 12, iy + 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#0a0c12"; ctx.beginPath(); ctx.ellipse(ix + 4, iy - 1, 6, 7, 0, 0, 6.28); ctx.fill();   // dark opening
    const gl = 0.5 + 0.5 * Math.sin(t * 2);
    ctx.fillStyle = `rgba(120,255,200,${0.5 + gl * 0.4})`; px(ix + 3, iy - 2, 2, 2, `rgba(120,255,200,${0.5 + gl * 0.4})`);   // glowing eye in the dark
  }
  ctx.restore();
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
   Opening cinematic — the old man and his cat flee the farm while the
   furious wife shrieks from the doorway (one-time, first launch)
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
// no folk tune any more — the old man is being chased off by his furious wife,
// so the intro runs on dramatic stings and her screaming (lyder/Red girl screaming loud.mp3)
let introMusicNode = null;
function startIntroMusic() {
  stopIntroMusic();
  introSting();                 // ominous opening hit as the door flies open
  intro.nextYell = 1e9;         // no repeated shrieks any more — her recorded yell plays once, naturally
  intro.threw = false;
  // the furious wife's shriek from the doorway — played a single time and left to ring out
  setTimeout(() => { if (intro.running && !muted) introMusicNode = playSample("scream", { vol: 0.5 }); }, 500);
}
function stopIntroMusic() {
  if (introMusicNode) { stopSample(introMusicNode); introMusicNode = null; }
}
function introSting() {
  // low, ominous brass-ish double hit
  blip(70, 0.55, "sawtooth", 0.16); blip(104, 0.45, "square", 0.06);
  setTimeout(() => blip(58, 0.8, "sawtooth", 0.13), 130);
}
function womanYell() {
  // the furious wife in the doorway: her recorded scream plus a sharp sting
  if (introMusicNode) { stopSample(introMusicNode); introMusicNode = null; }
  introMusicNode = playSample("scream", { vol: 0.5 });
  blip(880, 0.09, "square", 0.05); blip(660, 0.12, "square", 0.04, 0.05);
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
  // window with white frame + warm cosy glow (matches the game's evening mood)
  const wg = ctx.createRadialGradient(30, 161, 2, 30, 161, 20); wg.addColorStop(0, "rgba(255,210,130,0.55)"); wg.addColorStop(1, "rgba(255,210,130,0)");
  ctx.fillStyle = wg; ctx.fillRect(10, 141, 40, 40);
  px(20, 152, 20, 18, "#e8efe0"); px(22, 154, 16, 14, "#f0c878"); px(29, 154, 1, 14, "#e8efe0"); px(22, 160, 16, 1, "#e8efe0");
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
// ---- cosmetic hats: drawn on the fisherman, in panels, and on the seller's stack ----
// draws the equipped hat around the fisherman's head point (hx, hy)
function drawPlayerHat(hx, hy, hat) {
  switch (hat) {
    case "pinkcowboy": {
      px(hx - 9, hy - 2, 19, 2, "#e85aa8");                                   // wide brim
      px(hx - 10, hy - 3, 3, 1, "#ff8ad0"); px(hx + 8, hy - 3, 3, 1, "#ff8ad0"); // upturned tips
      px(hx - 5, hy - 8, 11, 6, "#ff7ac0"); px(hx - 5, hy - 8, 11, 1, "#ffb0dc"); // crown + highlight
      px(hx - 5, hy - 4, 11, 1, "#cf4f94");                                   // hat band
      px(hx - 1, hy - 8, 1, 6, "#ffa0d4");                                    // centre crease
      if (Math.sin(t * 4) > 0.4) sparkle(hx + 7, hy - 9, t);
      break;
    }
    case "rabbit": {
      const glow = 0.5 + 0.5 * Math.sin(t * 7), prevA = ctx.globalAlpha;
      px(hx - 6, hy - 3, 14, 2, "#ff5a9a");                                   // headband
      ctx.globalAlpha = prevA * (0.25 + glow * 0.5);                          // neon halo behind ears
      px(hx - 6, hy - 18, 5, 16, "#ff9ad8"); px(hx + 3, hy - 18, 5, 16, "#9af0ff");
      ctx.globalAlpha = prevA;
      px(hx - 5, hy - 17, 3, 15, "#fdf6ff"); px(hx + 3, hy - 17, 3, 15, "#fdf6ff"); // ears
      px(hx - 4, hy - 15, 1, 10, "#ff9ac0"); px(hx + 4, hy - 15, 1, 10, "#9af0ff"); // inner
      ctx.globalAlpha = prevA * glow;                                         // blinking tips
      px(hx - 5, hy - 18, 3, 2, "#ff6ad0"); px(hx + 3, hy - 18, 3, 2, "#6ae0ff");
      ctx.globalAlpha = prevA;
      if (glow > 0.7) { sparkle(hx - 4, hy - 20, t); sparkle(hx + 4, hy - 19, t + 1); }
      break;
    }
    case "jester": {
      px(hx - 5, hy - 4, 11, 3, "#7a3aa8");                                   // band
      const pts = [[-6, -12, "#ff5a5a", "#ffd23a"], [0, -15, "#3ad07a", "#ff8ad0"], [6, -12, "#3a8aff", "#ffd23a"]];
      for (const [ox, oy, c, bell] of pts) {
        const sway = Math.sin(t * 2 + ox) * 1.5;
        px(hx + ox - 1, hy + oy, 3, 8, c);
        px(Math.round(hx + ox + sway), hy + oy - 2, 2, 2, bell);              // jingling bell tip
      }
      break;
    }
    case "tophat": {
      px(hx - 8, hy - 2, 17, 2, "#23202c");                                   // brim
      px(hx - 5, hy - 12, 11, 10, "#2c2836"); px(hx - 5, hy - 12, 11, 1, "#3a3548");
      px(hx - 5, hy - 5, 11, 2, "#b03a3a");                                   // red band
      break;
    }
    case "viking": {
      px(hx - 6, hy - 4, 13, 3, "#8a8f9a"); px(hx - 6, hy - 7, 13, 3, "#9aa0ac"); // dome
      px(hx - 6, hy - 7, 13, 1, "#c0c6d2");
      px(hx - 2, hy - 4, 1, 2, "#5a5f6a"); px(hx + 1, hy - 4, 1, 2, "#5a5f6a"); // rivets
      px(hx - 9, hy - 9, 3, 3, "#e8e2d0"); px(hx - 11, hy - 12, 3, 4, "#e8e2d0"); px(hx - 11, hy - 13, 2, 2, "#f4f0e6"); // L horn
      px(hx + 7, hy - 9, 3, 3, "#e8e2d0"); px(hx + 9, hy - 12, 3, 4, "#e8e2d0"); px(hx + 10, hy - 13, 2, 2, "#f4f0e6"); // R horn
      break;
    }
    default: {  // straw — the original
      px(hx - 8, hy - 2, 17, 2, "#d8b25a"); px(hx - 5, hy - 7, 11, 6, "#e7c56e"); px(hx - 5, hy - 3, 11, 1, "#b8923f");
    }
  }
}
// a tiny hat swatch for the shop/wardrobe rows
function drawHatPreview(hk, x, y) {
  switch (hk) {
    case "pinkcowboy": px(x - 6, y, 13, 2, "#ff7ac0"); px(x - 3, y - 3, 7, 3, "#ff7ac0"); px(x - 3, y - 1, 7, 1, "#cf4f94"); break;
    case "rabbit": px(x - 4, y, 9, 2, "#ff5a9a"); px(x - 3, y - 6, 2, 6, "#fdf6ff"); px(x + 2, y - 6, 2, 6, "#fdf6ff"); px(x - 3, y - 6, 2, 2, "#ff6ad0"); px(x + 2, y - 6, 2, 2, "#6ae0ff"); break;
    case "jester": px(x - 4, y, 9, 2, "#7a3aa8"); px(x - 4, y - 3, 2, 3, "#ff5a5a"); px(x, y - 4, 2, 4, "#3ad07a"); px(x + 3, y - 3, 2, 3, "#3a8aff"); break;
    case "tophat": px(x - 6, y, 13, 2, "#23202c"); px(x - 3, y - 5, 7, 5, "#2c2836"); px(x - 3, y - 2, 7, 1, "#b03a3a"); break;
    case "viking": px(x - 4, y, 9, 3, "#9aa0ac"); px(x - 6, y - 2, 2, 3, "#e8e2d0"); px(x + 4, y - 2, 2, 3, "#e8e2d0"); break;
    default: px(x - 5, y, 11, 2, "#d8b25a"); px(x - 3, y - 3, 7, 3, "#e7c56e");
  }
}
// shared renderer for the seller's shop (isShop=true, shows prices) and the sekk wardrobe
function drawHatList(title, listKeys, isShop) {
  const w = 176, x = PANEL_R - w, rh = 21, top = 28, headH = 22;
  const h = headH + listKeys.length * rh + 10;
  px(x, top, w, h, "rgba(14,12,22,0.96)");
  px(x, top, w, 3, "#ff8ad0");
  ctx.fillStyle = "#ffd0ec"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(title, x + w / 2, top + 11);
  drawBackArrow(x, w, top);
  hatRowRects = [];
  ctx.textBaseline = "middle";
  listKeys.forEach((hk, i) => {
    const hat = HAT_BY_KEY[hk]; if (!hat) return;
    const owned = (save.hats || []).includes(hk);
    const equipped = save.hat === hk;
    const ry = top + headH + i * rh;
    const rr = { key: hk, x: x + 4, y: ry, w: w - 8, h: rh - 3 };
    hatRowRects.push(rr);
    px(rr.x, rr.y, rr.w, rr.h, equipped ? "#3a2a40" : "#241c30");
    px(rr.x, rr.y, rr.w, 1, equipped ? "#ff8ad0" : "#3a2e4a");
    const cy = rr.y + rr.h / 2;
    drawHatPreview(hk, rr.x + 13, cy + 3);
    ctx.font = "9px monospace"; ctx.textAlign = "left";
    ctx.fillStyle = owned ? "#f0e6d0" : "#d4bcc8";
    ctx.fillText(hat.name, rr.x + 26, cy + 1);
    ctx.textAlign = "right"; ctx.font = "8px monospace";
    if (equipped) { ctx.fillStyle = "#9affc0"; ctx.fillText("i bruk", rr.x + rr.w - 6, cy + 1); }
    else if (owned) { ctx.fillStyle = "#9aa6d0"; ctx.fillText("bruk \u203a", rr.x + rr.w - 6, cy + 1); }
    else { ctx.fillStyle = save.money >= hat.cost ? "#ffe6a0" : "#a06a6a"; ctx.fillText(fmt(hat.cost) + " kr", rr.x + rr.w - 6, cy + 1); }
  });
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}
function drawHatShop() { if (hatShop) drawHatList("HATTESELGER", HATS.map((h) => h.key), true); }
function drawHatPanel() { if (hatPanel) drawHatList("HATTENE DINE", (save.hats || ["straw"]), false); }
// buy a hat (auto-equips) or switch to one you already own — called from the seller's shop
function buyOrEquipHat(hk) {
  const hat = HAT_BY_KEY[hk]; if (!hat) return;
  if ((save.hats || []).includes(hk)) {
    if (save.hat === hk) { sfxClink(); return; }
    save.hat = hk; persist(); sfxClink(); setHint("Du tok p\u00e5 " + hat.name + "!");
    return;
  }
  if (save.money < hat.cost) { sfxMiss(); setHint("Ikke nok penger til " + hat.name + " (" + fmt(hat.cost) + " kr)"); return; }
  save.money -= hat.cost; save.hats.push(hk); save.hat = hk; persist(); refreshHUD();
  sfxCoin(); playSample("buying", { vol: 0.6 }); setHint("Kj\u00f8pte og tok p\u00e5 " + hat.name + "! \ud83c\udfa9");
}
// open the seller's stall (also nudges her into the waiting pose so she sticks around)
function openHatShop() {
  hatSeller.state = "idle"; hatSeller.t = 0;
  hatShop = true; coolerMenu = false; godsakerPanel = false; rodPanel = false; hatPanel = false;
  sfxClink();
}
// the seller's traditional call when she ambles up
function sellerCall() {
  blip(440, 0.1, "triangle", 0.05); blip(620, 0.12, "triangle", 0.05, 0.12); blip(540, 0.14, "triangle", 0.045, 0.26);
}
// ---- wandering Romanian hat seller ----
function updateHatSeller(dt) {
  hatSeller.t += dt;
  const STAND_Y = 208, START_Y = 280;
  switch (hatSeller.state) {
    case "away": {
      hatSeller.timer -= dt;
      const busy = coolerMenu || truckMenu || rodPanel || bagPanel || recordsPanel || godsakerPanel || funnPanel || hatPanel || hatShop || inspector.active || gameEvent.active || cat.mission != null || knockout.active;
      if (hatSeller.timer <= 0 && momentGap <= 0 && !busy && (fishState === "ready" || fishState === "waiting")) {
        hatSeller.state = "approach"; hatSeller.x = 108; hatSeller.y = START_Y; hatSeller.t = 0;
        momentGap = 12 + Math.random() * 8;
        sellerCall();
      } else if (hatSeller.timer <= 0) {
        hatSeller.timer = 8 + Math.random() * 10;   // try again a little later when the coast clears
      }
      break;
    }
    case "approach":
      hatSeller.y = lerp(hatSeller.y, STAND_Y, dt * 1.7);
      if (hatSeller.y < STAND_Y + 1.5) { hatSeller.y = STAND_Y; hatSeller.state = "idle"; hatSeller.t = 0; }
      break;
    case "idle":
      if (hatShop) { hatSeller.t = 0; break; }      // she waits patiently while you browse
      if (hatSeller.t > hatSeller.idleDur) { hatSeller.state = "leave"; hatSeller.t = 0; blip(330, 0.12, "sine", 0.04); }
      break;
    case "leave":
      hatSeller.y += dt * 46;
      if (hatSeller.y > START_Y) { hatSeller.state = "away"; hatSeller.timer = 160 + Math.random() * 200; }
      break;
  }
}
function drawHatSeller() {
  if (hatSeller.state === "away") return;
  const x = Math.round(hatSeller.x), y = Math.round(hatSeller.y);
  const walking = hatSeller.state === "approach" || hatSeller.state === "leave";
  const gait = walking ? Math.sin(t * 8) * 1.2 : Math.sin(t * 1.6) * 0.5;
  const prevA = ctx.globalAlpha;
  // soft shadow
  ctx.globalAlpha = prevA * 0.3; ctx.fillStyle = "#0c1330";
  ctx.beginPath(); ctx.ellipse(x, y + 16, 11, 3, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = prevA;
  // long traditional skirt
  px(x - 7, y - 2, 15, 14, "#7a2a4a"); px(x - 7, y - 2, 15, 2, "#9a3a5a"); px(x - 7, y + 9, 15, 3, "#b83a5a");
  for (let i = 0; i < 3; i++) px(x - 6 + i * 5, y + 2, 1, 7, "#ffd23a");      // embroidery
  // legs shuffling
  px(x - 4, y + 12 + (gait > 0 ? 1 : 0), 3, 4, "#5a4a3a"); px(x + 1, y + 12 + (gait < 0 ? 1 : 0), 3, 4, "#5a4a3a");
  // apron
  px(x - 3, y - 1, 7, 11, "#e8d4a0"); px(x - 3, y - 1, 7, 1, "#c0a878");
  px(x - 2, y + 2, 5, 1, "#b8473f"); px(x - 2, y + 5, 5, 1, "#3a7a4a");
  // shawl over the shoulders
  px(x - 6, y - 8, 13, 7, "#5a2a3a"); px(x - 6, y - 8, 13, 1, "#7a3a4a");
  // arms
  px(x - 8, y - 4, 3, 6, "#5a2a3a"); px(x + 6, y - 4, 3, 6, "#5a2a3a");
  px(x - 9, y + 1, 3, 3, "#d8a878"); px(x + 7, y + 1, 3, 3, "#d8a878");        // hands
  // head + headscarf (babushka)
  px(x - 4, y - 15, 9, 8, "#d8a878");
  px(x - 5, y - 17, 11, 5, "#b8344a"); px(x - 5, y - 12, 2, 5, "#b8344a"); px(x + 4, y - 12, 2, 5, "#b8344a");
  px(x - 5, y - 17, 11, 1, "#d8546a");
  px(x - 2, y - 12, 1, 1, "#3a2018"); px(x + 2, y - 12, 1, 1, "#3a2018");      // eyes
  px(x - 1, y - 9, 3, 1, "#9a6a5a");                                          // kindly mouth
  // a colourful stack of festival hats balanced on her free hand
  const sx = x + 10, sy = y + 1;
  px(sx - 2, sy, 5, 1, "#ff7ac0"); px(sx - 1, sy - 2, 3, 2, "#ff7ac0");        // pink cowboy
  px(sx - 2, sy - 4, 5, 1, "#3ad07a"); px(sx - 1, sy - 6, 3, 2, "#3ad07a");    // green
  px(sx - 2, sy - 8, 5, 1, "#ffd23a"); px(sx - 1, sy - 10, 3, 2, "#ffd23a");   // yellow
  // speech bubble while she's around to be tapped
  if (hatSeller.state === "idle" || hatSeller.state === "approach") {
    const txt = "Kj\u00f8pe hatt?!";
    ctx.font = "bold 7px monospace";
    const bw = ctx.measureText(txt).width + 8;
    const bx = clamp(x - bw / 2, 2, W - bw - 2), by = y - 30;
    px(bx, by, bw, 11, "rgba(255,250,240,0.96)"); px(bx, by, bw, 2, "#ff8ad0");
    px(x - 2, by + 11, 3, 3, "rgba(255,250,240,0.96)");
    ctx.fillStyle = "#7a2a4a"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 7px monospace";
    ctx.fillText(txt, bx + bw / 2, by + 6);
    // a gentle tap-prompt so it's clear she's interactive
    if (hatSeller.state === "idle") {
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.globalAlpha = prevA * (0.5 + pulse * 0.5);
      ctx.fillStyle = "#ffd27a"; ctx.font = "7px monospace";
      ctx.fillText(touchMode ? "Trykk!" : "Klikk!", x, y + 22);
      ctx.globalAlpha = prevA;
    }
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
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
function catYowl() {
  // an aggressive, indignant meow when shooed off the fish
  playSample("catAngry", { vol: 0.72 });
  catHiss();
  setTimeout(() => blip(640, 0.13, "sawtooth", 0.06), 60);
  setTimeout(() => blip(360, 0.22, "square", 0.05), 220);
}
function startCatSteal() {
  cat.mission = "steal"; cat.state = "arrive"; cat.x = -16; cat.target = 44 + Math.random() * 8; cat.t = 0;
  cat.fishKey = null; catMeow();
}
// give the cat a fuss — it stops wherever it is, settles down and purrs; the loop stops ~3s after you stop petting
function petCat() {
  cat.state = "settle";                 // stop padding about / leaving — sit right here for the fuss
  cat.x = clamp(cat.x, 18, 110);        // keep it on the grassy bank, not off-screen
  cat.action = "pet"; cat.petHappy = 3; cat.timer = Math.max(cat.timer, 3.2); cat.t = 0;
  if (!purrNode) purrNode = playSample("catPurr", { loop: true, vol: 0.5 });
  blip(760, 0.05, "sine", 0.02);
}
function eatStolenFish() {
  if (!save.basket.length) return;
  let mi = 0;
  for (let i = 1; i < save.basket.length; i++) if (save.basket[i].weight < save.basket[mi].weight) mi = i;
  // prefer the exact fish it grabbed, if it's still in the basket
  if (cat.fishKey) { const idx = save.basket.findIndex((b) => b.key === cat.fishKey); if (idx >= 0) mi = idx; }
  const taken = save.basket.splice(mi, 1)[0];
  persist(); buildBasket(); refreshHUD();
  const f = FISH_BY_KEY[taken.key];
  showCatEvent("Katten stakk av med " + (f ? f.name : "fisken") + "!", "Du var for treig — pus forsynte seg.");
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
        if (cat.mission === "steal") { cat.state = "grab"; cat.grab = 0.7; cat.action = "grab"; catMeow(); }
        else { cat.state = "settle"; pickCatAction(); if (Math.random() < 0.4) catMeow(); }
      }
      break;
    case "grab":
      cat.grab -= dt;
      if (!save.basket.length) { cat.state = "leave"; cat.mission = null; cat.t = 0; }
      else if (cat.grab <= 0) {
        // pick (and remember) the smallest fish to carry off
        let mi = 0; for (let i = 1; i < save.basket.length; i++) if (save.basket[i].weight < save.basket[mi].weight) mi = i;
        cat.fishKey = save.basket[mi].key; cat.state = "carry"; cat.t = 0;
      }
      break;
    case "carry":
      cat.x -= dt * 14;                 // slinks off slowly so you still have time to react
      if (cat.x < -16) { eatStolenFish(); cat.state = "away"; cat.timer = 26 + Math.random() * 40; cat.mission = null; cat.fishKey = null; }
      break;
    case "flee":
      cat.x -= dt * 42;                 // bolts off after being shooed
      if (cat.x < -16) { cat.state = "away"; cat.timer = 26 + Math.random() * 44; cat.fishKey = null; }
      break;
    case "settle":
      cat.timer -= dt;
      if (cat.action === "pet") {
        // stays content while being fussed; purr loop trails off ~3s after the last pet
        cat.petHappy -= dt;
        if (cat.petHappy <= 0) { stopPurr(); pickCatAction(); }
      } else if (cat.action === "chase") {
        // pad back and forth chasing a firefly, but stay on the grassy bank
        cat.x = clamp(cat.chaseX + Math.sin(cat.t * 2.2) * 16, 18, 96);
      } else if (cat.action === "bat" && Math.random() < dt * 1.5) {
        blip(300 + Math.random() * 80, 0.04, "triangle", 0.03);
      }
      if (cat.timer <= 0) {
        if (cat.action === "pet") break;   // never wander off mid-fuss
        if (Math.random() < 0.38) { cat.state = "leave"; cat.t = 0; stopPurr(); if (Math.random() < 0.4) catMeow(); }
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
  const walking = cat.state === "arrive" || cat.state === "leave" || cat.state === "carry" || cat.state === "flee";
  const napping = !walking && cat.action === "nap";
  const sitting = !walking && !napping && cat.action !== "chase";
  const gait = walking ? Math.sin(t * 13) * 1.4 : (cat.action === "chase" ? Math.sin(t * 10) * 1.2 : 0);
  let y = cat.y;
  if (cat.action === "bat" && sitting) y += Math.abs(Math.sin(t * 7)) * 1.2; // little pounce bob
  // padding off to the left → face left (flip); otherwise face right toward the water
  const faceLeft = cat.state === "leave" || cat.state === "carry" || cat.state === "flee";
  if (faceLeft) {
    ctx.save(); ctx.translate(cat.x * 2, 0); ctx.scale(-1, 1);
    drawCatSprite(cat.x, y, walking, "#d9863a", "#b8662a", gait, false);
    if (cat.state === "carry") {
      // a small fish clamped in its jaws (drawn in flipped space so it sits at the muzzle)
      const mx = cat.x + 8, my = y - 7;
      px(mx, my, 6, 3, "#9fb8c8"); px(mx, my, 6, 1, "#c0d8e8"); px(mx + 5, my, 2, 3, "#7fa0b0"); px(mx + 1, my + 1, 1, 1, "#24343f");
    }
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
  if (cat.action === "pet") {
    // content kitty: a happy closed-eye smile + little hearts floating up
    px(cat.x - 3, y - 9, 2, 1, "#1a1208"); px(cat.x + 3, y - 9, 2, 1, "#1a1208");   // squinty happy eyes
    px(cat.x - 1, y - 6, 3, 1, "#7a4a3a");                                            // smile
    for (let i = 0; i < 2; i++) {
      const hp = ((t * 0.9 + i * 0.5) % 1), hy = y - 14 - hp * 14, hx = cat.x + 4 + Math.sin(t * 3 + i * 2) * 3;
      ctx.globalAlpha = (1 - hp) * 0.9; ctx.fillStyle = "#ff7a9a";
      px(hx, hy, 1, 1, "#ff7a9a"); px(hx + 2, hy, 1, 1, "#ff7a9a"); px(hx - 1, hy + 1, 4, 1, "#ff7a9a"); px(hx, hy + 2, 2, 1, "#ff7a9a");
      ctx.globalAlpha = 1;
    }
  }
  if (cat.action === "chase" && !walking) {
    // a firefly the cat is batting at, just ahead of it
    const fx = cat.x + 10 + Math.sin(t * 3) * 3, fy = y - 12 + Math.cos(t * 4) * 3;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 9); px(fx, fy, 1, 1, "#fff2a0"); ctx.globalAlpha = 1;
  }
  if (cat.state === "carry") {
    // pulsing red warning above the cat as it slinks off with your fish
    const a = 0.55 + 0.45 * Math.sin(t * 6);
    ctx.globalAlpha = a; ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#ff5a4a";
    ctx.fillText("!", cat.x - 4, y - 18); ctx.globalAlpha = 1; ctx.textAlign = "left";
  } else if (cat.mission === "steal" && (cat.state === "arrive" || cat.state === "grab")) {
    // EARLY heads-up while the cat sneaks in and reaches for your catch — tap it in time!
    const a = 0.55 + 0.45 * Math.sin(t * 7), bx = cat.x, by = y - 26;
    // little speech bubble
    ctx.globalAlpha = 0.85; px(bx - 14, by - 1, 30, 12, "rgba(14,12,22,0.85)"); px(bx - 2, by + 11, 3, 3, "rgba(14,12,22,0.85)");
    ctx.globalAlpha = a; ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#ffd27a";
    ctx.fillText("Trykk!", bx, by + 8);
    ctx.font = "9px monospace"; ctx.fillStyle = "#ff5a4a"; ctx.fillText("!", bx + 12, by + 8);
    ctx.globalAlpha = 1; ctx.textAlign = "left";
  }
}
function drawAngryWife(tt) {
  // the furious wife (kjærringa) filling the doorway — tall, clearly a woman, shaking her fist
  const wx = 78, wy = 207;
  const shake = Math.sin(t * 14) * 1.0;            // trembling with rage
  // she winds up and hurls a pot around mid-intro, then keeps shaking her fist
  const throwing = tt >= IN.wifeThrowS && tt < IN.wifeThrowE;
  const wind = throwing ? clamp((tt - IN.wifeThrowS) / (IN.wifeThrowE - IN.wifeThrowS), 0, 1) : 0;
  const armUp = throwing ? lerp(-6, 8, wind) : Math.sin(t * 8) * 3;   // arm swings down through the throw
  // shadow
  ctx.globalAlpha = 0.22; ctx.fillStyle = "#101810"; ctx.beginPath(); ctx.ellipse(wx, wy + 1, 8, 2, 0, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
  // long flared dress (clearly a long skirt)
  ctx.fillStyle = "#7a3a6a";
  ctx.beginPath(); ctx.moveTo(wx - 6 + shake * 0.4, wy - 26); ctx.lineTo(wx + 6 + shake * 0.4, wy - 26);
  ctx.lineTo(wx + 11 + shake * 0.4, wy); ctx.lineTo(wx - 11 + shake * 0.4, wy); ctx.closePath(); ctx.fill();
  px(wx - 6 + shake * 0.4, wy - 26, 12, 2, "#9a4f86");           // bodice highlight
  // waist + apron
  px(wx - 8 + shake * 0.4, wy - 12, 16, 2, "#5a2a4e");          // waistband
  ctx.fillStyle = "#efe7d6";
  ctx.beginPath(); ctx.moveTo(wx - 4 + shake * 0.4, wy - 16); ctx.lineTo(wx + 4 + shake * 0.4, wy - 16);
  ctx.lineTo(wx + 7 + shake * 0.4, wy - 1); ctx.lineTo(wx - 7 + shake * 0.4, wy - 1); ctx.closePath(); ctx.fill();
  // bust (reads as female)
  px(wx - 6 + shake * 0.4, wy - 24, 5, 4, "#8a4576"); px(wx + 1 + shake * 0.4, wy - 24, 5, 4, "#8a4576");
  // hip arm (the other hand planted on her hip)
  px(wx + 7 + shake * 0.4, wy - 22, 3, 9, "#e8b896"); px(wx + 8 + shake * 0.4, wy - 14, 3, 3, "#e8b896");
  // raised throwing/fist arm
  const ax = wx - 8 + shake * 0.4, ay = wy - 30 + armUp;
  ctx.strokeStyle = "#e8b896"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx - 4 + shake * 0.4, wy - 24); ctx.lineTo(ax, ay); ctx.stroke();
  px(ax - 2, ay - 2, 4, 4, "#e8b896");                          // fist
  if (throwing && wind < 0.5) { px(ax - 3, ay - 5, 6, 5, "#a85a3a"); px(ax - 3, ay - 5, 6, 1, "#c47049"); } // pot still in hand at wind-up
  // head — flushed with fury
  const hx = wx + shake, hy = wy - 36;
  px(hx - 5, hy - 4, 11, 10, "#ec9a82"); px(hx - 5, hy + 5, 11, 1, "#cf7660");
  // long hair framing the face + flowing down (clearly feminine)
  ctx.fillStyle = "#5a3324";
  px(hx - 7, hy - 6, 15, 4, "#5a3324");                          // top
  px(hx - 7, hy - 2, 3, 13, "#5a3324"); px(hx + 5, hy - 2, 3, 13, "#5a3324");  // down both sides
  px(hx - 6, hy - 7, 13, 2, "#6e4030");                          // hair highlight
  // angry eyes + furrowed brows + open yelling mouth
  px(hx - 2, hy, 2, 2, "#2a1810"); px(hx + 3, hy, 2, 2, "#2a1810");
  ctx.strokeStyle = "#3a2418"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(hx - 3, hy - 2); ctx.lineTo(hx, hy - 1); ctx.moveTo(hx + 6, hy - 2); ctx.lineTo(hx + 3, hy - 1); ctx.stroke();
  px(hx, hy + 3, 6, 3, "#6e1c14"); px(hx + 1, hy + 4, 4, 1, "#b03a2a");
  // red lips/blush hint of make-up
  px(hx - 4, hy + 2, 1, 1, "#d06a6a"); px(hx + 6, hy + 2, 1, 1, "#d06a6a");
  // pulsing anger-curse above her head while she yells
  if (intro.running && Math.sin(t * 6) > -0.3) {
    ctx.fillStyle = "#ff5a4a"; ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("#%@!", hx, hy - 12 + Math.sin(t * 8) * 1.5);
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  }
}
// the pot she hurls after the fleeing old man, arcing across the yard
function drawWifeThrow(tt) {
  if (tt < IN.wifeThrowR || tt > IN.wifeThrowL + 0.4) return;
  const k = clamp((tt - IN.wifeThrowR) / (IN.wifeThrowL - IN.wifeThrowR), 0, 1);
  // farmer's position at this moment (so the pot chases him)
  const target = clamp(lerp(96, 322, (tt - IN.walkStart) / (IN.walkEnd - IN.walkStart)), 96, 300) - 18;
  const x = lerp(70, target, k);
  const y = lerp(176, 202, k) - Math.sin(k * Math.PI) * 34;       // high arc
  if (k < 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tt * 12);
    px(-4, -3, 8, 7, "#a85a3a"); px(-4, -3, 8, 2, "#c47049"); px(-3, -4, 6, 2, "#8a4326");
    ctx.restore();
  } else {
    // shattered on the ground behind him + a little dust
    ctx.globalAlpha = clamp(1 - (tt - IN.wifeThrowL) / 0.4, 0, 1);
    for (let i = 0; i < 6; i++) { const sx = target + (i - 3) * 4, sy = 203 + (i % 2) * 2; px(sx, sy, 2, 2, "#a85a3a"); }
    ctx.fillStyle = "rgba(180,160,140,0.5)"; ctx.beginPath(); ctx.arc(target, 200, 6, 0, 6.28); ctx.fill();
    ctx.globalAlpha = 1;
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
  // a bulging burlap sack slung over his back — he's packed up and storming off
  if (tt < IN.climbS) {
    const sb = walking ? Math.sin(t * 10) * 1 : 0;
    px(gx - 14, gy - 27 + sb, 9, 13, "#6e4f30"); px(gx - 14, gy - 27 + sb, 9, 2, "#866341");
    px(gx - 13, gy - 23 + sb, 7, 1, "#553c22"); px(gx - 13, gy - 19 + sb, 7, 1, "#553c22");
    px(gx - 11, gy - 29 + sb, 4, 3, "#5a3f24");   // tied neck of the sack
  }
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
  // sack strap across his chest
  if (tt < IN.climbS) { ctx.strokeStyle = "#4a3420"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx - 7, gy - 24); ctx.lineTo(gx + 5, gy - 12); ctx.stroke(); }
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
// a comic speech bubble for the opening cinematic
function drawIntroBubble(cx, cy, lines, accent) {
  ctx.font = "bold 8px monospace";
  let w = 0; for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  w += 12; const h = 6 + lines.length * 10;
  const bx = clamp(cx - w / 2, 4, W - 4 - w), by = clamp(cy - h, 4, H - 20);
  px(bx, by, w, h, "rgba(255,250,240,0.96)");
  px(bx, by, w, 2, accent || "#ffd0c0");
  ctx.fillStyle = "rgba(255,250,240,0.96)"; ctx.beginPath(); ctx.moveTo(cx - 3, by + h - 1); ctx.lineTo(cx + 4, by + h - 1); ctx.lineTo(cx, by + h + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#3a2030"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = "bold 8px monospace";
  let ly = by + 3; for (const l of lines) { ctx.fillText(l, bx + w / 2, ly); ly += 10; }
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
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
  // the furious wife planted in the doorway
  drawAngryWife(tt);
  // the pot she flings after the old man
  drawWifeThrow(tt);
  // a few crows startled into the air by all the shouting
  ctx.fillStyle = "#1a1620";
  for (let i = 0; i < 5; i++) {
    const bx = 120 + i * 26 + (tt * 22 + i * 40) % 220, by = 40 + (i % 3) * 14 - tt * 1.2;
    const flap = Math.sin(t * 12 + i * 1.7) * 3;
    ctx.beginPath(); ctx.moveTo(bx - 4, by + flap); ctx.lineTo(bx, by); ctx.lineTo(bx + 4, by + flap); ctx.lineWidth = 1; ctx.strokeStyle = "#1a1620"; ctx.stroke();
  }
  // a calm cottage garden with the boy's cat trotting along
  drawGarden(tt);
  // truck + farmer + thrown rod
  const truckX = introTruckX(tt), hasRod = tt >= IN.throwE, driving = tt >= IN.driveS;
  drawIntroTruck(truckX, 200, driving, hasRod);
  if (tt >= IN.throwS && tt < IN.throwE) drawThrownRod(tt);
  if (tt < IN.climbE) drawFarmer(tt);
  drawIntroCat(tt);
  // dialogue: he's off fishing (again!) and the wife is livid about it
  if (tt > 0.4 && tt < 6.7) {
    const wifeLines = (Math.floor(tt / 1.7) % 2 === 0) ? ["FISKETUR?!", "IKKE TALE OM!"] : ["KOM DEG HJEM,", "DIN LATSABB!"];
    drawIntroBubble(116, 150, wifeLines, "#ff7a6a");
  }
  if (tt > IN.walkStart + 0.5 && tt < 6.4) {
    const fgx = clamp(lerp(96, 322, (tt - IN.walkStart) / (IN.walkEnd - IN.walkStart)), 104, 372);
    drawIntroBubble(fgx, 170, ["P\u00e5 fisketur! \ud83c\udfa3"], "#9ad0ff");
  }
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

// On landscape phones the shop menu docks to one side, leaving a narrow strip of
// the scene. A plain wide shot leaves the keeper tiny and lonely there, so we zoom
// the scene toward the shopkeeper/counter — it reads like you stepped up to the desk.
const SHOP_FOCUS = {
  shopFish:    { fx: 330, fy: 150, tx: 360, ty: 150, z: 1.4 },
  shopRod:     { fx: 150, fy: 156, tx: 116, ty: 150, z: 1.5 },
  shopKiosk:   { fx: 150, fy: 150, tx: 116, ty: 150, z: 1.5 },
  shopLicense: { fx: 150, fy: 152, tx: 118, ty: 150, z: 1.45 },
  shopCasino:  { fx: 240, fy: 110, tx: 176, ty: 118, z: 1.32 },
};
let _shopZoomMQ = null;
function shopZoomActive() {
  if (!_shopZoomMQ && window.matchMedia) {
    _shopZoomMQ = window.matchMedia(
      "(orientation: landscape) and (max-height: 540px), (orientation: landscape) and (pointer: coarse)"
    );
  }
  return _shopZoomMQ ? _shopZoomMQ.matches : false;
}
function drawShopScene(key, drawFn) {
  const f = SHOP_FOCUS[key];
  if (f && shopZoomActive()) {
    ctx.save();
    ctx.translate(f.tx, f.ty);
    ctx.scale(f.z, f.z);
    ctx.translate(-f.fx, -f.fy);
    drawFn();
    ctx.restore();
  } else {
    drawFn();
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);
  switch (screen) {
    case "game":
      drawSky(); drawStars(); drawAurora(); drawMoon(); drawMountains(); drawTreeline(); drawLurkingEyes(); drawMoose(); drawParkedTruck(); drawWater(); drawWaterfall(); drawReflections(); drawForestDetails(); drawSummerDetails(); drawCaveDetails(); drawShore(); drawRiseSpot();
      drawLine(); drawBobber(); drawBuffAura(); drawGuy(); drawSmoke(); drawProps(); drawGroundFish(); drawCat(); drawHatSeller(); drawInspector(); drawReedsFront(); drawCoolerMenu(); drawGodsakerPanel(); drawHatPanel(); drawHatShop(); drawRodPanel(); drawBagPanel(); drawRecordsPanel(); drawFunnPanel(); drawTruckMenu(); drawFireflies(); drawSnow();
      drawRevealFish(); drawFog(); drawWeather(); drawBuffHud(); drawEventActor(); drawGameEvent(); drawHoverHighlight(); drawTouchHints(); drawVignette(); drawHangover(); drawKnockout();
      break;
    case "menu": drawMenuBg(); break;
    case "market": drawMarketBg(); break;
    case "intro": drawIntroBg(); break;
    case "map": drawMapBg(); break;
    case "travel": drawTravelBg(); break;
    case "shopFish": drawShopScene("shopFish", drawShopFishBg); break;
    case "shopRod": drawShopScene("shopRod", drawShopRodBg); break;
    case "shopLicense": drawShopScene("shopLicense", drawShopLicenseBg); break;
    case "shopKiosk": drawShopScene("shopKiosk", drawShopKioskBg); break;
    case "shopCasino": drawShopScene("shopCasino", drawShopCasinoBg); break;
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
if (!save.licenses || typeof save.licenses !== "object") save.licenses = {};
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
