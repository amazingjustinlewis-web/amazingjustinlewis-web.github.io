/* DRIFT SIGNAL (working title) - every tunable number and the sector catalogue.
   Renaming the game: change TITLE below (and the word in the two HTML <title> tags if you like). Everything visible reads TITLE. */
(function (root) {
  var TITLE = 'DRIFT SIGNAL';              // <-- the one place to rename the game
  var C = root.SPACE_CONFIG = {
    TITLE: TITLE, workingTitle: false,
    version: '0.4',
    peerPrefix: 'ztp-driftsignal-v03-',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    liveControllerUrl: 'https://amazingjustinlewis-web.github.io/games/space/controller.html',
    maxCrew: 6,
    // crew stations; order = auto-assign priority for people who join after the captain
    stations: [
      { id: 'cap', label: 'CAPTAIN', short: 'CMD', color: '#ffd27a' },
      { id: 'helm', label: 'HELM', short: 'HELM', color: '#6fe3ff' },
      { id: 'sci', label: 'SCIENCE', short: 'SCI', color: '#9d8cff' },
      { id: 'tac', label: 'TACTICAL', short: 'TAC', color: '#ff7a6b' },
      { id: 'eng', label: 'ENGINEERING', short: 'ENG', color: '#ffb347' },
      { id: 'com', label: 'COMMS', short: 'COMMS', color: '#7dffb0' }
    ],
    // travel: speed (units/s) = impulse, or warpK * w^warpExp. Ship time runs timeScale x faster than real time (shown as the ETA).
    nav: { impulse: 28, warpK: 5.5, warpExp: 2.35, accel: 0.9, turnRate: 0.32, timeScale: 60, arriveGap: 2.6 },
    power: { total: 12, max: 5, start: { shields: 3, engines: 3, sensors: 2, life: 2, tractor: 2 } },
    danger: { off: 0, low: 1 / 240, medium: 1 / 120, high: 1 / 55 },   // chance per second of a random space event
    blackHole: { warn: 2.8, danger: 1.7 },                             // multiples of the black hole's visual radius
    quality: {
      rungs: [ { scale: 1.25, fx: 1 }, { scale: 1.0, fx: 1 }, { scale: 0.8, fx: 0.7 }, { scale: 0.62, fx: 0.5 }, { scale: 0.5, fx: 0.35 } ],
      downBelowFps: 38, downAfterSec: 3, upAboveFps: 57, upAfterSec: 14
    },
    // ---- the sector. Planets are generated from their seed (colours, land/water, clouds, rings). ----
    sector: [
      { id: 'home', kind: 'station', cat: 'stations', name: 'Kessler Rest', x: 0, y: 0, z: -1400, r: 90, flavour: 'Held together with duct tape and whatever bolts the customers aren\u2019t using. Fuel is cheap. The coffee is not coffee.', reviews: '2.1 \u2605', trader: 'kessler' },
      { id: 'vael', kind: 'station', cat: 'stations', name: 'Vael Spindle', x: 7800, y: 900, z: -5200, r: 120, flavour: 'An alien depot grown, not built. Docking is by invitation; they trade in minerals and memories, not credits.', reviews: '?? \u2605', trader: 'vael' },
      { id: 'aurel', kind: 'station', cat: 'stations', name: 'Aurelia Prime Exchange', x: -6400, y: -700, z: -9800, r: 140, flavour: 'Ultra-advanced, spotless, quietly judging your hull. Accepts credits, prefers rare isotopes.', reviews: '4.9 \u2605', trader: 'aurel' },
      { id: 'thal', kind: 'planet', cat: 'planets', name: 'Thalassa-4471', seed: 4471, water: true, landable: true, x: 3600, y: -300, z: -7400, r: 420, flavour: 'Rocky, desolate, mostly ocean. Something on the surface moves when nothing should.' },
      { id: 'dune', kind: 'planet', cat: 'planets', name: 'Sere Khamsin', seed: 5150, desert: true, landable: true, x: -1700, y: -450, z: -6300, r: 460, flavour: 'Endless dunes under a white sun. Long ripples cross the sand in calm air. Seismic readings: rhythmic.' },
      { id: 'ruby', kind: 'planet', cat: 'planets', name: 'Corvane', seed: 918, x: -3800, y: 600, z: -4200, r: 520, flavour: 'Iron-red dust world with ice caps. Old mining beacons still ping.' },
      { id: 'gas', kind: 'planet', cat: 'planets', name: 'Big Hollis', seed: 30307, gas: true, x: 9600, y: -1200, z: -12800, r: 1300, flavour: 'Banded gas giant with a faint ring. Probes go in, probes do not come out.' },
      { id: 'moss', kind: 'planet', cat: 'planets', name: 'Verdance', seed: 77, x: -9400, y: 200, z: -1800, r: 380, flavour: 'Green and wet. Atmosphere smells like cut grass on the sensors, somehow.' },
      { id: 'bh', kind: 'blackhole', cat: 'anomalies', name: 'The Quiet Eye', x: -11800, y: 1500, z: -15600, r: 260, flavour: 'A black hole with a bright accretion disk. Light bends around it. Keep your distance.' },
      { id: 'neb', kind: 'nebula', cat: 'anomalies', name: 'Lantern Nebula', x: 1800, y: 2600, z: -17000, r: 2600, flavour: 'Glowing gas lit by young stars. Sensors fog, the view does not.' },
      { id: 'comet', kind: 'comet', cat: 'hazards', name: 'Comet Iris-9', x: -900, y: 300, z: -3600, r: 26, flavour: 'Off-gassing comet with a long debris tail. Flying through the tail lights up the shields.' },
      { id: 'pulse', kind: 'signal', cat: 'signals', name: 'Prime-number pulse', x: 5200, y: 2200, z: -14000, r: 30, flavour: 'Repeating pulse: 2, 3, 5, 7, 11... then a long silence.' },
      { id: 'echo', kind: 'signal', cat: 'signals', name: 'Distress echo', x: -7800, y: -900, z: -7000, r: 30, flavour: 'An automated distress call, three hundred years old, still politely asking for help.' },
      { id: 'drifter', kind: 'ship', cat: 'ships', name: 'Freighter \u201cSlow Ollie\u201d', x: 2400, y: 120, z: -2300, r: 40, flavour: 'Bulk hauler drifting at one-quarter impulse. Crew of three, plus a goat (unconfirmed).', trader: 'ollie' }
    ],
    cats: [
      { id: 'stations', label: 'Stations & depots', icon: '\u25A3' },
      { id: 'planets', label: 'Planets', icon: '\u25CF' },
      { id: 'anomalies', label: 'Anomalies', icon: '\u2726' },
      { id: 'ships', label: 'Ships', icon: '\u25B2' },
      { id: 'hazards', label: 'Hazards', icon: '\u2622' },
      { id: 'signals', label: 'Signals', icon: '\u2248' }
    ],
    // ---- Default mode: the recommended pace and settings. Any change on a phone switches the preset to Custom. ----
    presets: { default: { danger: 'medium', voice: 'occasional', drone: false, wild: true } },
    wildChance: 0.05,   // share of random events that are 'monolithic' wild events (Default mode only)
    // ---- data-driven event list: add dozens more later. kind = the TV routine that stages it. ----
    events: [
      { id: 'storm', kind: 'storm', weight: 3, say: 'Micrometeor storm. Shields holding.', tone: 'alert' },
      { id: 'raider', kind: 'raider', weight: 2, say: 'Unidentified vessel on an intercept course. They are not answering.', tone: 'alert' },
      { id: 'distress', kind: 'distress', weight: 2, say: 'Distress call. A small ship is caught in a debris current.', tone: 'alert' },
      { id: 'envoy', kind: 'alien', weight: 2, species: 'velith', say: 'Incoming transmission. Translating.', tone: 'calm' },
      { id: 'colossus', kind: 'colossus', wild: true, weight: 1, say: 'Spatial rupture ahead. Something very large is coming through.', tone: 'urgent' }
    ],
    // alien species: how the computer's translation looks on screen
    species: {
      velith: { name: 'Velith Concord', style: 'smooth', color: '#9fe8ff' },
      krr: { name: 'Krr’tak Brood', style: 'clicks', color: '#ffb36b' },
      unknown: { name: 'Unknown', style: 'struggle', color: '#d79bff' }
    },
    // one sample encounter: shallow tree. Crew phones get the options; nobody answers in `wait` s -> they carry on.
    encounters: {
      envoy: { species: 'velith', wait: 25, open: 'Small vessel. You drift through our quiet water. Declare your purpose, or keep drifting.',
        options: [
          { id: 'peace', label: 'We come in peace. Just passing through.', reply: 'Passing is permitted. Take this: a map of the calm currents.', mood: 'gift' },
          { id: 'trade', label: 'Got anything to trade?', reply: 'Trade? [the computer struggles] ...we exchange... memories, not things. Perhaps later.', mood: 'neutral' },
          { id: 'cool', label: 'Nice ship.', reply: 'It is a ship. Yours is also... a ship. We will remember this kindness.', mood: 'gift' },
          { id: 'rude', label: 'Out of our way.', reply: 'Noted. Your hull temperature will be noted also.', mood: 'hostile' }
        ], ignore: 'Silence. A fitting answer. Drift on, little vessel.' },
      raider: { species: 'krr', wait: 18, open: 'Krr-tk. Your cargo. Ours. Or your shields. Also ours.',
        options: [ { id: 'no', label: 'Not today.', reply: 'Tk. Tk. Brave. We watch.', mood: 'hostile' }, { id: 'gift', label: 'Have some spare oxygen.', reply: 'Krr... generous prey. We leave. For now.', mood: 'gift' } ],
        ignore: 'Tk-tk-tk. Silent prey. Boring prey.' }
    },
    // distress outcomes after you tow/tractor a ship clear
    distressOutcomes: [
      { id: 'thanks', weight: 3, text: 'They thank you warmly and beam over cargo: 40 units of refined ice and a jar of something that hums.' },
      { id: 'steal', weight: 1, text: 'It was a trap. They latch on, siphon 15% of your fuel and flee laughing.' },
      { id: 'royal', weight: 1, text: 'A royal message arrives: "Her Radiance did NOT require assistance and finds your tractor beam presumptuous."' }
    ],
    // ---- v0.3: cargo + trading. value = what a fair trader thinks it is worth. ----
    items: {
      fuel: { name: 'Fuel cell', icon: '\u26FD', v: 20 }, ice: { name: 'Refined ice', icon: '\u2744', v: 14 }, parts: { name: 'Spare parts', icon: '\u2699', v: 24 },
      rations: { name: 'Rations', icon: '\uD83E\uDD6B', v: 9 }, jar: { name: 'Humming jar', icon: '\uD83C\uDFFA', v: 42 }, iso: { name: 'Rare isotopes', icon: '\u2622', v: 60 },
      map: { name: 'Star map', icon: '\uD83D\uDDFA', v: 34 }, med: { name: 'Medical kit', icon: '\u271A', v: 28 }, memory: { name: 'Memory shard', icon: '\uD83D\uDC8E', v: 45 },
      torp: { name: 'Torpedo', icon: '\u2738', v: 50 }, credits: { name: 'Credit chip', icon: '\u00A4', v: 10 }, goat: { name: 'A goat', icon: '\uD83D\uDC10', v: 30 }, spice: { name: 'Dune spice', icon: '\u2728', v: 55 }
    },
    cargoStart: ['fuel', 'fuel', 'ice', 'ice', 'parts', 'rations', 'rations', 'med', 'credits', 'credits', 'credits'],
    // greed > 1 = wants more than fair. likes/hates multiply the value they see. counter = how willing they are to haggle.
    traders: {
      ollie: { name: 'Freighter \u201cSlow Ollie\u201d', greed: 1.0, counter: 0.75, likes: { rations: 1.6, jar: 1.3 }, hates: {}, hold: ['parts', 'parts', 'fuel', 'goat', 'torp', 'map', 'rations'],
        hi: 'Ollie here. Hold\u2019s open, kettle\u2019s on. Whatcha got?', yes: 'Pleasure doing business. Goat says hi.', no: 'Nah, can\u2019t do that one, friend.', ctr: 'Close! Throw in a little something and we\u2019re square.' },
      kessler: { name: 'Kessler Rest quartermaster', greed: 1.15, counter: 0.7, likes: { parts: 1.3, fuel: 1.1 }, hates: { jar: 0.6 }, hold: ['fuel', 'fuel', 'fuel', 'torp', 'torp', 'med', 'rations'],
        hi: 'Quartermaster. Cash, parts or fuel. No refunds. No questions.', yes: 'Fine. Don\u2019t scratch the airlock on the way out.', no: 'Ha. No.', ctr: 'Almost. Sweeten it.' },
      vael: { name: 'Vael Spindle', greed: 1.05, counter: 0.6, likes: { memory: 2.0, map: 1.6, jar: 1.8 }, hates: { credits: 0.2, torp: 0.3 }, hold: ['memory', 'memory', 'iso', 'map', 'ice'],
        hi: 'We trade in what is remembered. Show us your hold.', yes: 'The exchange is... pleasing. We will remember you.', no: 'This offer has no memory in it.', ctr: 'Add something that has been loved, and it is done.' },
      aurel: { name: 'Aurelia Prime Exchange', greed: 1.35, counter: 0.8, likes: { iso: 1.6, spice: 1.5 }, hates: { rations: 0.4, goat: 0.2 }, hold: ['iso', 'torp', 'torp', 'torp', 'med', 'med', 'map'],
        hi: 'Aurelia Prime Exchange. Please do not touch anything. What are you offering?', yes: 'Accepted. Your hull has been politely noted.', no: 'We regret to decline. Deeply. Not really.', ctr: 'An interesting start. Add value.' }
    },
    weapons: { torpedoes: 4, phaserDmg: [8, 13], torpDmg: [32, 44] },
    // ---- v0.3: the sandworm desert ----
    dunes: { firstWormSec: 40, attackEvery: [70, 120], escapeSec: 22, wormHp: 100, liftChance: 0.55 },
    shipStart: { x: 420, y: 80, z: 300 },
    // v0.2 tiered sensors: default range always gives full detail; sweeps reach further with less detail
    sensors: { base: 2600, small: 5200, medium: 11000, large: 26000, sweepHold: 75 },
    interference: { thal: 'EM field', neb: 'dust fog', bh: 'gravitational shear', gas: 'radiation belts', echo: 'signal echo' },
    broad: { station: 'Artificial structure', planet: 'Planetary body', blackhole: 'Gravitational anomaly', nebula: 'Diffuse gas cloud', comet: 'Small icy body', signal: 'Repeating transmission', ship: 'Small vessel' },
    // v0.2 ship motion: gentle banking, rare slow barrel rolls / corkscrews
    motion: { bankMax: 0.42, bankK: 2.4, rollDur: 9, rollCool: [110, 200] }
  };
  // seeded random shared by TV and phone (mulberry32)
  C.rng = function (seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  C.speedFor = function (w) { var N = C.nav; return w <= 0 ? N.impulse : Math.max(N.impulse, N.warpK * Math.pow(w, N.warpExp)); };
  C.maxWarp = function (enginesPower) { return Math.min(9.9, 3 + enginesPower * 1.4); };
  C.fmtShipTime = function (sec) {
    sec = Math.round(sec); if (sec < 90) return sec + ' s';
    var m = Math.round(sec / 60); if (m < 90) return m + ' min';
    var h = Math.floor(m / 60); if (h < 48) return h + ' h ' + (m % 60) + ' min';
    return Math.round(h / 24) + ' days';
  };
  root.LR_CONFIG = { peerPrefix: C.peerPrefix, iceServers: C.iceServers };
})(typeof window !== 'undefined' ? window : globalThis);
