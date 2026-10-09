/* IRON STRIDE (working title) - tunable numbers, v0.1 prototype.
   Every gameplay number lives here. The TV and the phones both read this file. */
(function (root) {
  var C = root.MECH_CONFIG = {
    version: '0.3',
    title: 'IRON STRIDE',
    peerPrefix: 'ztp-ironstride-v01-',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    liveControllerUrl: 'https://amazingjustinlewis-web.github.io/games/mech/controller.html',
    seats: [ { role: 'PILOT', color: '#ffb02e' }, { role: 'GUNNER', color: '#3ae0ff' } ],

    // ---- aiming (phone gyro, like Laser Range: the phone's top edge points at the TV) ----
    aim: {
      sendHz: 30,
      defaultSpanDeg: 50,          // degrees of swing from the left edge of the TV to the right edge (before calibrating)
      minSpanDeg: 12,              // calibration refused if left and right are closer than this
      edge: 0.35,                  // v0.3: the turn zone feathers in from 35% of the half-screen (wider, softer)
      turnDegPerSec: 115, turnCurve: 2.8,   // speed at the far edge; eased curve (u^2.8): barely turns near the start, fast at the edge           // torso turn speed at the very edge
      pitchEdge: 0.5, pitchDegPerSec: 40, pitchLimitDeg: [-89, 89],
      filter: { minCutoff: 1.4, beta: 4, dCutoff: 1.0 }
    },
    // ---- hidden aim assist: reads intent. steady = tight, strong lock; shaky = wide, soft, approximate ----
    assist: {
      windowMs: 450,               // how much recent crosshair motion is used to judge steadiness
      shakyAt: 0.9,                // crosshair speed (screen half-widths per second, RMS) that counts as fully shaky
      radiusSteady: 0.07, radiusShaky: 0.16,  // lock cone (fraction of screen half-width)
      pullSteady: 0.5, pullShaky: 0.3,       // v0.2 reticle gravity: soft pull, fades out toward the edge of the cone      // how far the shot bends from the crosshair to the target
      scatterShaky: 0.025,         // extra random spread when shaky (screen half-widths)
      stickyMs: 350,               // a lock holds this long after the crosshair slips off
      intentTauSteady: 0.07, intentTauShaky: 0.32,   // v0.2 intent reticle: seconds to catch up (steady = quick, shaky = heavy smoothing)
      spreadSteady: 0.004, spreadShaky: 0.045        // shot spread around the intent reticle (screen half-widths)
    },
    weapons: [
      { id: 'cannon', label: 'AUTOCANNON', short: 'CANNON', mag: 40, reloadSec: 1.8, rpm: 540, damage: 1, spread: 0.006, color: '#ffd84a' },
      { id: 'rocket', label: 'ROCKETS', short: 'ROCKET', mag: 6, reloadSec: 3.0, rpm: 150, damage: 3, splash: 8, speed: 70, homing: 1.6, lockHoming: 7, color: '#ff6a3d' },
      { id: 'rail', label: 'RAIL', short: 'RAIL', mag: 2, reloadSec: 2.6, chargeSec: 1.1, minCharge: 0.25, damage: 2, maxDamage: 8, color: '#7af0ff' }
    ],
    gunner: { weapon: 0 },         // co-pilot gunner phone: own crosshair, autocannon
    pad: { holdSec: 0.8, decaySec: 3.5, swipeBoost: 1.0 },   // v0.3 thumb-pad momentum: hold the swipe speed, then fade (time constant)
    tilt: { deadDeg: 6, fullDeg: 22 },   // v0.3 trackpad mode: lean the phone to walk
    lock: { radius: 0.3, keepRadius: 0.5, acquireSec: 0.4, max: 3, loseSec: 0.8 },   // v0.3 rocket lock-on (fairly forgiving)
    mech: { faceDegPerSec: 150, backSpeed: 0.55, walkSpeed: 7, turnDegPerSec: 55, strideSec: 1.05, eyeHeight: 9.5, radius: 3.2, hull: 100, lookahead: 7, arriveDist: 3 },
    bay: { reloadPerSec: 1, repairPerSec: 18 },
    enemies: {
      drone: { hp: 2, speed: 16, radius: 2.2, fireEvery: [2.8, 4.5], boltSpeed: 34, damage: 4, score: 100 },
      tank: { hp: 7, speed: 6, radius: 3.4, fireEvery: [4.5, 6.5], shellSpeed: 42, damage: 9, score: 250, keepDist: 42 },
      maxAlive: [3, 9], rampSec: 150, spawnEvery: [3.5, 6], spawnDist: 115
    },
    barrel: { damage: 6, splash: 9, score: 50 },
    world: { half: 150, city: 112, seed: 7 },
    // ---- auto quality (like Red Deer Rich v0.4): start from device hints, then step down if fps stays low ----
    quality: {
      rungs: [ { scale: 1.25, fx: 1 }, { scale: 1.0, fx: 1 }, { scale: 0.8, fx: 0.7 }, { scale: 0.65, fx: 0.5 }, { scale: 0.5, fx: 0.35 } ],
      downBelowFps: 40, downAfterSec: 3, upAboveFps: 57, upAfterSec: 12
    }
  };
  root.LR_CONFIG = { peerPrefix: C.peerPrefix, iceServers: C.iceServers };   // the shared net.js reads this name
})(typeof window !== 'undefined' ? window : globalThis);
