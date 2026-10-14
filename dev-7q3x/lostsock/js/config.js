/* LOST SOCK v0.1 - every tunable number. TV and phones read this file. */
(function (root) {
  root.LS_CONFIG = {
    version: '0.2',
    maxTeams: 4, socksPerTeam: 3, hp: 100,
    teamColors: ['#ff5a6e', '#3aa8ff', '#5fdc7a', '#ffc93f'],
    teamNames: ['Left Feet', 'Odd Ones', 'Holey Rollers', 'Dryer Escapees'],
    sockNames: ['Argyle', 'Toesy', 'Heel', 'Lint', 'Fuzz', 'Darn', 'Tube', 'Ankle', 'Knee-Hi', 'Cuff', 'Stripe', 'Bobble'],
    world: { W: 2400, H: 1200, water: 1130 },
    turnSec: 30, retreatSec: 3, settleMaxSec: 8, winHoldSec: 58,
    grav: 620, walk: 55, jump: [150, -260], fallSafe: 330, fallDmg: 0.12,
    windMax: 1, windAcc: 140,
    dopeyOverkill: 22,       // final hit this far past 0 or less: dopey unravel. more: explodes into fuzz
    weapons: [
      { id: 'bazooka', name: 'Detergent Pod Launcher', icon: '\uD83E\uDEE7', desc: 'Lobbed soap pod rocket. Wind pushes it. Big soapy boom.', speed: 950, wind: 1, r: 58, dmg: 50 },
      { id: 'mgun', name: 'Starch Gun', icon: '\uD83D\uDD2B', desc: '14 fast starch pellets in a straight line.', shots: 14, speed: 1500, r: 7, dmg: 5 },
      { id: 'molotov', name: 'Hot Sauce Bottle', icon: '\uD83D\uDD25', desc: 'Lob it. Leaves fire that burns anyone walking in for a few turns.', speed: 760, wind: 0.6, r: 18, dmg: 10 },
      { id: 'washer', name: 'Washing Machine', icon: '\uD83E\uDDFA', desc: 'Place a trap. Any sock that walks in gets spin-cycled and flung out dizzy.', dmg: 22 },
      { id: 'holy', name: 'Holy Darning Egg', icon: '\uD83E\uDD5A', desc: 'Bouncy, 3s fuse, enormous blessed boom. Once per team.', speed: 700, fuse: 3, r: 120, dmg: 95, limit: 1 },
      { id: 'dryer', name: 'Dryer Bomb', icon: '\uD83C\uDF2C\uFE0F', desc: 'Stuffed with dryer sheets. Big shockwave rings (hard, medium, soft knockback) and it shrinks socks nearby. Once per team.', speed: 820, wind: 0.5, r: 70, dmg: 45, rings: [110, 190, 280], push: [700, 420, 200], limit: 1 },
      { id: 'mortar', name: 'Fabric Softener Mortar', icon: '\uD83E\uDDF4', desc: 'Lob a softener jug. It bursts into 5 fluffy bomblets.', speed: 800, wind: 0.8, r: 44, dmg: 30, blets: 5, br: 36, bdmg: 20 },
      { id: 'airstrike', name: 'Iron Airstrike', icon: '\u2708\uFE0F', desc: 'Power sets how far. Five hot irons drop from the sky. Once per team.', r: 52, dmg: 34, n: 5, limit: 1 },
      { id: 'mine', name: 'Hamper Landmine', icon: '\uD83E\uDDF3', desc: 'Place a hamper. Anyone who wanders close: beep beep BOOM.', r: 78, dmg: 58, arm: 2, trig: 40 },
      { id: 'decoy', name: 'Mismatched Pair', icon: '\uD83E\uDDE6', desc: 'Needs line of sight. Stitches a fake partner sock that walks to the enemy, lures them in, then blows up big.', r: 85, dmg: 70, speed: 70, lure: 170, fuse: 9, limit: 1 },
      { id: 'drill', name: 'Spin-Cycle Drill', icon: '\uD83C\uDF00', desc: 'Ride a spinning washer drum through the ground the way you aim, 3 seconds.', dur: 3 }
    ],
    aiCoverSec: 20,
    peerPrefix: 'ztp-lostsock-v01-',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    liveControllerUrl: 'https://amazingjustinlewis-web.github.io/dev-7q3x/lostsock/controller.html'
  };
})(typeof window !== 'undefined' ? window : globalThis);
