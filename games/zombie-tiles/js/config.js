/* =====================================================================
   ZOMBIE TILES (working title) - TUNABLE RULES  v0.3
   ---------------------------------------------------------------------
   Every rule number lives here. Change a value, save, refresh the TV.
   Phones read the same file (dice styles, colours, labels).
   ===================================================================== */
(function (root) {
  root.ZT_CONFIG = {
    version: '0.4.1',

    // ---- board ----
    tileSize: 8,                 // squares per tile side (data model keeps w/h per tile for later)
    deckSize: 14,                // tiles in the deck after the spawn tile (helipad included)
    helipadEarliest: 0.5,        // helipad is shuffled into the back half of the deck (0.5 = back half)

    // ---- players ----
    maxPlayers: 4,
    startHearts: 5,
    maxHearts: 5,
    moveDice: 2,                 // 2d6 for movement
    playerColors: ['#ff5a5f', '#3fa7ff', '#ffd23f', '#b46bff'],
    playerColorNames: ['Red', 'Blue', 'Yellow', 'Purple'],

    // ---- weapons (rank decides auto-pickup: higher replaces lower) ----
    weapons: {
      none:   { label: 'Empty hands',  short: 'Fists',  bonus: 0, rank: 0 },
      pipe:   { label: 'Lead pipe',    short: 'Pipe',   bonus: 2, rank: 1 },                                         // v0.4.1: was +1
      pistol: { label: 'Pistol',       short: 'Pistol', bonus: 3, rank: 2, gun: true, ammoPerFight: 1, clip: 5 },   // v0.4.1: was +1
      mg:     { label: 'Machine gun',  short: 'MG',     bonus: 5, rank: 3, gun: true, ammoPerFight: 3, clip: 20 }   // v0.4.1: was +2
    },
    ammoClipRounds: 5,           // rounds in a loose ammo clip pickup
    maxAmmo: 40,
    dropEmptyGuns: true,         // a gun is tossed automatically when its ammo hits 0

    // ---- fights: player 2d6 + weapon vs zombie 2d6; margin = player - zombie ----
    fight: {
      playerDice: 2,
      zombieDice: 2,
      cleanMargin: 2,            // margin >= this: clean kill, no damage
      cleanMarginWeak: 3,        // ...or >= this when the player is weak
      weakHearts: 2,             // "weak" = at or below this many hearts
      maxHeartsLost: 3           // cap on hearts lost in one losing fight (hearts lost = |margin|)
    },

    // ---- zombies ----
    zombie: {
      hp: 2,
      roundShuffleChance: 1.0,   // end of round: zombies on tiles with NO players step 1 square at random
      lungeEvery: 2,             // during a move, every N steps zombies on your tile step toward you
      lungeRange: 3,             // ...if they are within this many squares (walking distance, straight-line check)
      playerZombieSteps: [1, 2]  // a player-zombie lurches 1 square (die 1-3) or 2 squares (die 4-6)
    },
    riseAfterRounds: 1,          // a fallen player rises as a zombie after this many FULL rounds

    // ---- helipad gates ----
    gates: { minYes: 1, maxYes: 4 },

    // ---- pickups: weights when a tile sprinkles its pickups ----
    pickupWeights: { heart: 3, pipe: 3, pistol: 2, mg: 1, ammo: 3, trap: 2, dynamite: 1 },

    // ---- v0.4 items: picked up, then DROPPED on your square from the phone (or T / B keys in hot-seat) ----
    items: {
      // a zombie that steps on a trap box is caught in a rope snare and yanked up. 'remove' = gone, 'stun' = hangs there for stunTurns
      trap: { label: 'Trap box', short: 'Trap', max: 2, wild: 'remove', playerZombie: 'stun', stunTurns: 2 },
      // lit dynamite blows at the end of the round (or when its owner presses DETONATE): clears zombies within radius
      // (squares, diagonals count) and hurts players there
      dynamite: { label: 'Dynamite', short: 'TNT', max: 2, radius: 1, playerDamage: 1, wild: 'remove', playerZombie: 'stun', stunTurns: 2 }
    },

    // ---- display ----
    phone: { turnBuzzEveryMs: 3500, turnBuzzPattern: [40] },   // gentle 'your turn' reminder buzz on the phone until the player acts (phones can switch it off)
    escapeShow: { ms: 5200, fireworks: [0.9, 1.7, 2.3, 2.9, 3.5, 4.1], buzz: [90, 60, 90, 60, 90, 120, 400] },   // helicopter cinematic on the TV when someone escapes (the game waits for it)
    // v0.4 character sprites: walk cycles + idle bobs. Drop in your own sheets (format: js/sprites.js / assets/sprites/README.md)
    sprites: { enabled: true, frame: 32, player: '', zombie: '', walkFps: 12, idleMs: 520, stepSec: 0.22 },
    // v0.4.1: a badly hurt player leaves little cartoon blood drops on the squares they walk through (TV only, purely visual)
    bloodTrail: { enabled: true, hearts: 1, fadeMs: 12000, max: 80, color: '#d81e2c' },
    showHeartsOnTV: true,        // hearts on the TV player cards (ammo is ALWAYS phone-only)

    // ---- timing (ms) ----
    timing: { step: 300, zombieStep: 260, roll: 1100, fightResult: 2600, banner: 1700, endTurn: 450, roundEnd: 900 },

    // ---- dice pairs players choose on their phones ----
    dice: [
      { id: 'bone',     name: 'Bone',      face: '#efe6d2', edge: '#b8a98c', pip: '#3a2e25', mood: 'dark' },
      { id: 'blood',    name: 'Blood Red', face: '#b3122b', edge: '#5e0a17', pip: '#fff1f1', mood: 'dark' },
      { id: 'toxic',    name: 'Toxic',     face: '#83ff57', edge: '#3a9c1b', pip: '#0f230a', mood: 'dark' },
      { id: 'midnight', name: 'Midnight',  face: '#1e2757', edge: '#0b0f2e', pip: '#7fe7ff', mood: 'dark' },
      { id: 'candy',    name: 'Candy',     face: '#ffa3d5', edge: '#e0549f', pip: '#ffffff', mood: 'happy' },
      { id: 'sunshine', name: 'Sunshine',  face: '#ffd84a', edge: '#e09a12', pip: '#d0401a', mood: 'happy' }
    ],

    // ---- Philips Hue lights (optional, v0.2) ----
    // Lights only work when the "Lights Helper" runs on a PC on the same network (see lights-helper/README.md).
    // The helper reads these values when it joins the room. Colours are hex; brightness values are 0..1.
    // All effects are short and return to the base look; the lights' original state is restored when the
    // game ends, when Hue is switched off, or when the TV disconnects.
    hue: {
      intensity: 0.85,           // master scale for effect brightness (0..1). Lower = subtler.
      ambient: { color: '#1d4a6e', bri: 0.22, transitionMs: 2500 },   // moody base during play
      turn: { mix: 0.6, bri: 0.34, transitionMs: 1200, flickers: 2 },  // base tinted toward the player's colour
      zombieTurnColor: '#5cff2e',                                      // tint for a player-zombie's turn
      roll: { flickers: 3, dip: 0.3, gapMs: 140, lights: 3 },          // quick brightness dips on dice rolls
      fight: { color: '#ff1a1a', bri: 0.7, low: 0.22, pulses: 3, pulseMs: 850 },  // red pulses while fighting
      hit: { color: '#ff0000', bri: 1.0, ms: 380, flashes: 2, gapMs: 260 },   // you lose a fight: hard red double flash
      kill: { color: '#fff3c4', colors: ['#fff3c4', '#ffd23f', '#9dff6a'], bri: 1.0, ms: 650, sparkle: 3 },  // zombie destroyed: bright burst
      charge: { bri: 1.0, ms: 350 },                                   // charging into a fight: flash of the player's colour
      scream: { color: '#ffffff', bri: 0.9, blinks: 2, ms: 140 },      // cornered / grabbed: quick white blinks
      pickup: { bri: 0.8, ms: 300 },                                   // grabbing an item: one light sparkles
      helipad: { color: '#ffc21a', bri: 0.8, ms: 1400 },               // the helipad tile is found
      gateNo: { color: '#ff2020', bri: 0.75, ms: 500 },                // the guard says NO
      lunge: { color: '#5cff2e', dip: 0.35, flickers: 2 },             // zombies lurch toward you
      boom: { color: '#ff7a00', flash: '#fff1c4', bri: 1.0, ms: 900 },  // dynamite goes off: white-hot flash, then orange (needs Lights Helper v0.4)
      crunch: { color: '#ff0000', bri: 1.0, holdMs: 1500, fadeMs: 2500 },   // a player is taken out
      rise: { color: '#5cff2e', bri: 0.55, ms: 1200 },                 // a fallen player rises
      escape: { colors: ['#ffd23f', '#ff4fd8', '#3fd0ff', '#9dff6a', '#ffffff', '#ff7a1a'], bri: 1.0, steps: 8, stepMs: 500 },  // helicopter escape: multi-colour firework bursts
      over: { holdMs: 4000 },     // final look is held this long before the original lights come back
      restoreTransitionMs: 1500,
      disconnectRestoreMs: 30000, // TV gone this long -> restore the lights
      rate: { lightsPerSec: 8, groupsPerSec: 1, perLightMax: 6 }   // Hue limits: ~10/s lights, ~1/s groups.
      // perLightMax: up to this many selected lights are driven individually (snappier); more use room/zone commands
    },

    // ---- AI players (v0.3) ----
    // Personalities: w = how much they care about loot / hearts / exploring / the helipad / fighting / avoiding danger.
    // minOdds = chance of winning a fight they need before walking into one on purpose.
    // share / betray = how likely they share ammo with their ally / ditch the ally at the helipad (0..1).
    // hunt = who they chase after rising as a zombie: nearest | weakest | leader.  voice = pitch of their little screams.
    ai: {
      personas: {
        looter:   { label: 'Cautious looter',  short: 'Looter',   names: ['Penny', 'Magpie', 'Pip', 'Rummy'],  dice: 'candy',
                    w: { loot: 1.7, heart: 1.5, explore: 0.8, helipad: 1.1, fight: 0.15, danger: 2.4 }, minOdds: 0.78, share: 0.5, betray: 0.15, hunt: 'weakest', voice: 1.3 },
        fighter:  { label: 'Reckless fighter', short: 'Fighter',  names: ['Brick', 'Tank', 'Rumble', 'Moose'], dice: 'blood',
                    w: { loot: 0.9, heart: 0.6, explore: 0.8, helipad: 0.9, fight: 1.7, danger: 0.45 }, minOdds: 0.5, share: 0.3, betray: 0.2, hunt: 'nearest', voice: 0.8 },
        sprinter: { label: 'Helipad sprinter', short: 'Sprinter', names: ['Dash', 'Zoom', 'Bolt', 'Skye'],     dice: 'sunshine',
                    w: { loot: 0.45, heart: 0.7, explore: 1.7, helipad: 2.2, fight: 0.35, danger: 1.2 }, minOdds: 0.6, share: 0.2, betray: 0.6, hunt: 'leader', voice: 1.15 },
        sneak:    { label: 'Sneaky backstabber', short: 'Sneak',  names: ['Slink', 'Vex', 'Shady', 'Weasel'],  dice: 'midnight',
                    w: { loot: 1.25, heart: 0.9, explore: 1.0, helipad: 1.6, fight: 0.6, danger: 1.4 }, minOdds: 0.6, share: 0.1, betray: 0.95, hunt: 'leader', voice: 1.0 },
        buddy:    { label: 'Team player',      short: 'Buddy',    names: ['Sunny', 'Nova', 'Pal', 'Biscuit'],  dice: 'toxic',
                    w: { loot: 1.0, heart: 1.1, explore: 1.0, helipad: 1.4, fight: 0.8, danger: 1.3 }, minOdds: 0.55, share: 0.9, betray: 0.0, hunt: 'nearest', voice: 1.2 }
      },
      order: ['fighter', 'looter', 'sprinter', 'sneak', 'buddy'],
      // noise = random wobble in how they value things; slip = chance of picking a worse plan (from the top 4);
      // oddsErr = fight-odds misjudgement; care = how seriously they take zombie danger (1 = sensibly)
      levels: {
        easy:     { label: 'Easy',     noise: 0.6,  slip: 0.4,  oddsErr: 0.25, care: 0.35 },
        normal:   { label: 'Normal',   noise: 0.12, slip: 0.06, oddsErr: 0.06, care: 1 },
        ruthless: { label: 'Ruthless', noise: 0,    slip: 0,    oddsErr: 0,    care: 1.25 }
      },
      levelOrder: ['easy', 'normal', 'ruthless'],
      timing: { think: 450, dirStep: 120, showPlan: 1000, roll: 750, fight: 900, place: 350, placeHold: 600 },  // ms (TV speed)
      takeoverAfterMs: 10000,    // a phone silent this long mid-game: an AI plays that seat until the phone comes back
      takeoverPersona: 'buddy', takeoverLevel: 'normal',
      bubbleMs: 2300              // speech bubbles on the TV
    },

    // ---- networking ----
    peerPrefix: 'ztp-zombietiles-v01-',
    // WebRTC ICE servers. STUN is enough when the TV and phones share the same Wi-Fi (the normal case).
    // For phones on mobile data / strict networks, add a TURN server here, e.g.
    // { urls: 'turn:your.turn.host:3478', username: '...', credential: '...' }
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    // when the TV page is opened from a local file, phones are sent to the live controller instead
    liveControllerUrl: 'https://amazingjustinlewis-web.github.io/games/zombie-tiles/controller.html'
  };
})(typeof window !== 'undefined' ? window : globalThis);
