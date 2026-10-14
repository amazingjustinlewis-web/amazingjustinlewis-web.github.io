/* IRON STRIDE SQUAD (dev v0.5-dev) - asymmetric mechs. Loads after ../../games/mech/js/config.js and world.js. */
(function (root) {
  root.SQ_CONFIG = {
    version: '0.5-dev',
    peerPrefix: 'ztp-ironsquad-v05-',
    maxPhones: 4, maxPads: 4,
    // controller (gamepad) pilots: small, quick, light guns
    light: { name: 'Strider', scale: 1, colR: 2.2, hitR: 2.6, h: 9, muzzle: 6.5, speed: 16, turn: 9, hp: 60, respawn: 5,
      mg: { cd: 0.09, dmg: 1.2, speed: 140, spread: 0.035, range: 90 },
      dash: { cd: 2.2, speed: 42, time: 0.22 } },
    // phone pilots: ~6x the size, slow, much heavier weapons, tactical (tap) control
    titan: { name: 'Titan', scale: 6, colR: 4.5, hitR: 14, h: 54, muzzle: 30, speed: 3.2, turn: 0.7, hp: 480, respawn: 10,
      siege: { cd: 2.6, dmg: 18, splash: 11, speed: 95, range: 170 },
      barrage: { cd: 9, n: 8, dmg: 7, splash: 7, speed: 60, range: 150 },
      stomp: { cd: 7, r: 26, dmg: 12, knock: 30 } },
    enemies: {
      drone: { hp: 4, speed: 13, r: 2.2, alt: 12, fire: [1.4, 2.6], bolt: 40, dmg: 3, score: 100 },
      tank: { hp: 16, speed: 5, r: 3.4, alt: 1.6, fire: [2.8, 4.2], bolt: 48, dmg: 9, score: 250, keep: 40 },
      maxAlive: [6, 18], rampSec: 180, spawnEvery: [2.5, 4.5], spawnDist: [70, 120]
    },
    colors: ['#ffb02e', '#3ae0ff', '#7dff6a', '#ff5ad1', '#c79bff', '#ff6a3d', '#ffe066', '#7af0ff']
  };
  root.LR_CONFIG.peerPrefix = root.SQ_CONFIG.peerPrefix;   // separate rooms from the live Iron Stride
})(typeof window !== 'undefined' ? window : globalThis);
