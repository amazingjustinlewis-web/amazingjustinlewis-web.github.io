/* DEMOLITION DERBY v0.2 - every tunable number. TV and phones read this file. */
(function (root) {
  root.DD_CONFIG = {
    version: '0.3',
    maxPlayers: 8,
    colors: ['#ff4b55', '#3aa8ff', '#45e07a', '#ffd23f', '#ff8a2a', '#c16bff', '#3fe0d0', '#ff6bc1'],
    rounds: 3, lives: 2, countdownSec: 3, roundOverSec: 4, podiumSec: 60,
    arena: { R: 40, moundR: 7, moundH: 3.2, wallH: 1.6,
      // wall arcs in degrees (gaps between them are open drop-offs). gate sits inside the first arc.
      walls: [[-30, 30], [60, 120], [150, 210], [240, 300]], gateAt: 180, gateW: 16, gateEverySec: 4, gateOpenSec: 3,
      // v0.2.1 shrinking arena: edge radius per stage; a stage drops when the field thins out (or after stageMaxSec)
      shrinkR: [40, 33, 27, 21], warnSec: 3, sinkSec: 1.8, stageMaxSec: 45, thrRampSec: 0.9 },
    phys: { grav: 30, wallBounce: 0.45, carBounce: 0.35, dmgScale: 0.9, minHit: 4, crushDmg: 45, aiCoverSec: 20 },
    // speed = top speed, accel, mass, hp, turn (rad/s), grip (0..1 per-step lateral kill)
    cars: [
      { id: 'compact', name: 'Compact', speed: 21.6, accel: 30, mass: 0.8, hp: 90, turn: 3.4, grip: 0.9, size: [1.7, 3.0, 1.1] },
      { id: 'muscle', name: 'Muscle', speed: 27, accel: 32, mass: 1.0, hp: 100, turn: 2.6, grip: 0.7, size: [1.9, 3.8, 1.0] },
      { id: 'pickup', name: 'Pickup', speed: 22.5, accel: 26, mass: 1.25, hp: 120, turn: 2.5, grip: 0.8, size: [2.0, 4.0, 1.4] },
      { id: 'van', name: 'Van', speed: 19.8, accel: 22, mass: 1.45, hp: 135, turn: 2.2, grip: 0.82, size: [2.1, 4.0, 1.9] },
      { id: 'bus', name: 'Big Bus', speed: 16.2, accel: 16, mass: 2.2, hp: 180, turn: 1.6, grip: 0.9, size: [2.4, 5.6, 2.2] },
      { id: 'buggy', name: 'Buggy', speed: 26.1, accel: 40, mass: 0.6, hp: 70, turn: 3.8, grip: 0.6, size: [1.7, 2.6, 0.9] }
    ],
    armour: {
      // take = damage taken on that side, deal = flat spike damage on contact, push = knockback taken, spd = top-speed multiplier per piece
      none: { name: 'None', desc: 'Light and fast: +10% speed and quicker boost refill per bare side', take: 0.85, deal: 0, mass: 0, push: 1.0, spd: 1.1 },
      plate: { name: 'Plates', desc: 'Tank: half damage, hard to shove, but slower', take: 0.78, deal: 0, mass: 0.14, push: 0.75, spd: 0.92 },
      spike: { name: 'Spikes', desc: 'Glass cannon: big contact damage, grinds on touch', take: 1.05, deal: 24, mass: 0.05, push: 1.0, spd: 1.0, grind: 12 }
    },
    sideMul: { front: 0.6, side: 1.2, back: 1.45 },
    boosts: {
      ram: { name: 'Ram burst', desc: 'Unstoppable charge: double weight, x1.6 damage, long cooldown', dur: 0.9, mul: 2.16, cd: 5, dmg: 1.6, massMul: 2 },
      sustain: { name: 'Long boost', desc: 'Hold for steady speed you can steer with, meter refills', dur: 3, mul: 1.4, regen: 0.35, dmg: 1.0 },
      dash: { name: 'Hop dash', desc: 'Instant hop forward: dodge, or land on someone for a crush', kick: 11.7, hop: 7.5, cd: 2.4, dmg: 1.15 }
    },
    peerPrefix: 'ztp-derby-v02-',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    liveControllerUrl: 'https://amazingjustinlewis-web.github.io/dev-7q3x/derby/controller.html'
  };
})(typeof window !== 'undefined' ? window : globalThis);
