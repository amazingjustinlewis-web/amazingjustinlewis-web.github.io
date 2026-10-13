/* DEMOLITION DERBY v0.1 - every tunable number. TV and phones read this file. */
(function (root) {
  root.DD_CONFIG = {
    version: '0.1',
    maxPlayers: 8,
    colors: ['#ff4b55', '#3aa8ff', '#45e07a', '#ffd23f', '#ff8a2a', '#c16bff', '#3fe0d0', '#ff6bc1'],
    rounds: 3, lives: 2, countdownSec: 3, roundOverSec: 4, podiumSec: 60,
    arena: { R: 40, moundR: 7, moundH: 3.2, wallH: 1.6,
      // wall arcs in degrees (gaps between them are open drop-offs). gate sits inside the first arc.
      walls: [[-30, 30], [60, 120], [150, 210], [240, 300]], gateAt: 180, gateW: 16, gateEverySec: 4, gateOpenSec: 3 },
    phys: { grav: 30, wallBounce: 0.45, carBounce: 0.35, dmgScale: 0.9, minHit: 4, crushDmg: 45, aiCoverSec: 20 },
    // speed = top speed, accel, mass, hp, turn (rad/s), grip (0..1 per-step lateral kill)
    cars: [
      { id: 'compact', name: 'Compact', speed: 24, accel: 30, mass: 0.8, hp: 90, turn: 3.4, grip: 0.9, size: [1.7, 3.0, 1.1] },
      { id: 'muscle', name: 'Muscle', speed: 30, accel: 32, mass: 1.0, hp: 100, turn: 2.6, grip: 0.7, size: [1.9, 3.8, 1.0] },
      { id: 'pickup', name: 'Pickup', speed: 25, accel: 26, mass: 1.25, hp: 120, turn: 2.5, grip: 0.8, size: [2.0, 4.0, 1.4] },
      { id: 'van', name: 'Van', speed: 22, accel: 22, mass: 1.45, hp: 135, turn: 2.2, grip: 0.82, size: [2.1, 4.0, 1.9] },
      { id: 'bus', name: 'Big Bus', speed: 18, accel: 16, mass: 2.2, hp: 180, turn: 1.6, grip: 0.9, size: [2.4, 5.6, 2.2] },
      { id: 'buggy', name: 'Buggy', speed: 29, accel: 40, mass: 0.6, hp: 70, turn: 3.8, grip: 0.6, size: [1.7, 2.6, 0.9] }
    ],
    armour: {
      none: { name: 'None', take: 1.0, deal: 0, mass: 0 },
      plate: { name: 'Plates', take: 0.5, deal: 0, mass: 0.12 },
      spike: { name: 'Spikes', take: 1.15, deal: 14, mass: 0.05 }
    },
    sideMul: { front: 0.6, side: 1.2, back: 1.45 },
    boosts: {
      ram: { name: 'Ram burst', desc: 'Big shove + extra damage, long cooldown', dur: 0.8, mul: 2.4, cd: 5, dmg: 1.5 },
      sustain: { name: 'Long boost', desc: 'Hold for a steady push, meter refills', dur: 3, mul: 1.5, regen: 0.35, dmg: 1.0 },
      dash: { name: 'Quick dash', desc: 'Instant hop of speed, short cooldown', kick: 13, cd: 2.2, dmg: 1.15 }
    },
    peerPrefix: 'ztp-derby-v01-',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    liveControllerUrl: 'https://amazingjustinlewis-web.github.io/dev-7q3x/derby/controller.html'
  };
})(typeof window !== 'undefined' ? window : globalThis);
