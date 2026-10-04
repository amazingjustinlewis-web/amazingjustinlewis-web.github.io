/* =====================================================================
   LASER RANGE (working title) - TUNABLE NUMBERS  v0.1 (prototype)
   ---------------------------------------------------------------------
   Every gameplay number lives here. Change a value, save, refresh the TV.
   Phones read the same file (colours, aiming, gestures).
   Positions on the TV are in "screen units": x 0..1 left to right, y 0..1 top to bottom.
   ===================================================================== */
(function (root) {
  root.LR_CONFIG = {
    version: '0.1',

    // ---- players ----
    maxPlayers: 4,
    colors: [                                  // seat colours (crosshair, calibration targets, score card)
      { name: 'RED', color: '#ff4b55', ink: '#ffffff' },
      { name: 'BLUE', color: '#3aa8ff', ink: '#ffffff' },
      { name: 'GREEN', color: '#45e07a', ink: '#05301a' },
      { name: 'YELLOW', color: '#ffd23f', ink: '#3a2a00' }
    ],

    // ---- round ----
    roundSec: 90,
    countdownSec: 3,
    resultsAutoMs: 0,                          // 0 = stay on the results screen until someone presses PLAY AGAIN

    // ---- aiming (phone gyro) ----
    aim: {
      axis: 'top',              // 'top' = point the phone's top edge at the TV (like a remote); 'back' = point the camera side at the TV
      sendHz: 30,               // how often a phone sends its aim to the TV
      // calibration targets (screen units): order the phone walks through
      calPoints: [
        { id: 'tl', label: 'TOP-LEFT', x: 0.1, y: 0.14 },
        { id: 'tr', label: 'TOP-RIGHT', x: 0.9, y: 0.14 },
        { id: 'br', label: 'BOTTOM-RIGHT', x: 0.9, y: 0.86 },
        { id: 'bl', label: 'BOTTOM-LEFT', x: 0.1, y: 0.86 },
        { id: 'c', label: 'CENTRE', x: 0.5, y: 0.5 }
      ],
      defaultSpanDeg: { x: 38, y: 24 },        // before calibrating (or if it is skipped): degrees of turn across the whole screen
      minSpanDeg: 4,                           // calibration rejected if the corners are closer together than this (phone did not move)
      ridge: 0.1,                              // 0 = pure perspective fit (exact, but shaky hands show more); bigger = closer to a plain affine fit
      sampleMs: [380, 70],                     // a calibration tap averages the aim from 380 ms to 70 ms before the tap (skips the jolt of the tap itself)
      // cursor smoothing on the TV ("one-euro" filter): lower minCutoff = steadier but laggier; higher beta = snappier on fast moves
      filter: { minCutoff: 1.2, beta: 6, dCutoff: 1.0 },
      overscan: 0.06            // the cursor may drift this far past the screen edge before it is clamped
    },
    // ---- touchpad aiming (phones without a gyro, or by choice) ----
    pad: { sensitivity: 1.3 },                 // screen widths moved per phone-pad width dragged

    // ---- weapons ----
    weapons: {
      blaster: { label: 'BLASTER', mode: 'tap', radius: 0.022, damage: 1, cooldownMs: 160 },
      charger: { label: 'CHARGE CANNON', mode: 'hold', radius: 0.03, maxRadius: 0.085, damage: 1, maxDamage: 3, chargeMs: 900, minChargeMs: 120, cooldownMs: 250 },
      powerupSec: 12            // the charge cannon lasts this long after shooting a power-up balloon
    },
    swipe: { speed: 1.7, radius: 0.04, pierce: 3, cooldownMs: 1400, minDistPx: 50, maxMs: 450 },   // swipe blast: screen units per second, hit radius, targets it can pass through

    // ---- targets ----
    spawn: { everyMs: [450, 1100], maxUp: 6, rampTo: 9 },  // a new target pops up every 0.45-1.1 s, max 6 up at once (ramps to 9 near the end)
    targets: {
      bullseye: { points: 100, upMs: [1600, 2600], weight: 50 },
      bandit:   { points: 150, upMs: [1100, 1800], weight: 30 },
      gold:     { points: 300, upMs: [700, 1100], weight: 8, small: true },
      buddy:    { points: -100, upMs: [1400, 2200], weight: 8 }   // don't shoot the friendly cardboard granny (set weight 0 to remove)
    },
    popMs: 180,                // rise / duck animation
    streakBonus: { every: 5, points: 50 },     // 5 hits in a row without a miss: +50

    // ---- barrels ----
    barrel: { hp: 3, blastRadius: 0.16, chainDelayMs: 160, respawnMs: 9000, points: 50, blastPoints: 25 },

    // ---- power-up balloon ----
    powerup: { everyMs: [14000, 22000], speed: 0.09 },

    // ---- TV detail (Chromecast-friendly) ----
    lowfx: { belowFps: 40, afterSec: 3, recoverAboveFps: 56, recoverAfterSec: 20, scale: 0.66, maxParticles: 60 },

    // ---- Philips Hue (optional) via the Zombie Tiles Lights Helper (same message protocol) ----
    // Barrel explosions send an orange 'boom' flash. Same keys as Zombie Tiles so the helper works unchanged.
    hueBoomGapMs: 1500,        // at most one Hue flash this often (chain reactions stay under the Hue rate limits)
    hue: {
      intensity: 0.8,
      ambient: { color: '#d6e4ff', bri: 0.4, transitionMs: 2000 },
      turn: { mix: 0.5, bri: 0.4, transitionMs: 1200, flickers: 0 },
      zombieTurnColor: '#5cff2e',
      roll: { flickers: 2, dip: 0.35, gapMs: 140, lights: 3 },
      fight: { color: '#ff1a1a', bri: 0.65, low: 0.25, pulses: 3, pulseMs: 700 },
      hit: { color: '#ff0000', bri: 1.0, ms: 300, flashes: 2, gapMs: 200 },
      kill: { color: '#fff3c4', colors: ['#fff3c4', '#ffd23f', '#9dff6a'], bri: 1.0, ms: 650, sparkle: 3 },
      charge: { bri: 1.0, ms: 350 },
      scream: { color: '#ffffff', bri: 0.9, blinks: 2, ms: 140 },
      pickup: { bri: 0.8, ms: 400 },
      helipad: { color: '#ffd23f', bri: 0.85, ms: 1400 },
      gateNo: { color: '#ff2020', bri: 0.75, ms: 500 },
      lunge: { color: '#ffffff', dip: 0.3, flickers: 2 },
      boom: { color: '#ff7a00', flash: '#ffffff', bri: 1.0, ms: 700 },
      crunch: { color: '#ff0000', bri: 1.0, holdMs: 1500, fadeMs: 2500 },
      rise: { color: '#9dff6a', bri: 0.55, ms: 1200 },
      escape: { colors: ['#ffd23f', '#3fb54a', '#ff4fd8', '#3fd0ff', '#ffffff', '#ff7a1a'], bri: 1.0, steps: 8, stepMs: 450 },
      over: { holdMs: 4000 },
      restoreTransitionMs: 1500,
      disconnectRestoreMs: 30000,
      rate: { lightsPerSec: 8, groupsPerSec: 1, perLightMax: 6 }
    },
    lightsPeerPrefix: 'ztp-zombietiles-v01-',  // the existing Lights Helper dials rooms with this prefix; the TV opens a small extra door with it

    // ---- networking ----
    peerPrefix: 'ztp-laserrange-v01-',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    liveControllerUrl: 'https://amazingjustinlewis-web.github.io/games/laser-range/controller.html'
  };
})(typeof window !== 'undefined' ? window : globalThis);
