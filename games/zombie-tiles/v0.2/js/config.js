/* =====================================================================
   ZOMBIE TILES (working title) - TUNABLE RULES  v0.2
   ---------------------------------------------------------------------
   Every rule number lives here. Change a value, save, refresh the TV.
   Phones read the same file (dice styles, colours, labels).
   ===================================================================== */
(function (root) {
  root.ZT_CONFIG = {
    version: '0.2.1',

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
      pipe:   { label: 'Lead pipe',    short: 'Pipe',   bonus: 1, rank: 1 },
      pistol: { label: 'Pistol',       short: 'Pistol', bonus: 1, rank: 2, gun: true, ammoPerFight: 1, clip: 5 },
      mg:     { label: 'Machine gun',  short: 'MG',     bonus: 2, rank: 3, gun: true, ammoPerFight: 3, clip: 20 }
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
    pickupWeights: { heart: 3, pipe: 3, pistol: 2, mg: 1, ammo: 3 },

    // ---- display ----
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
      hit: { color: '#ff0000', bri: 0.85, ms: 450 },                   // player loses hearts
      kill: { color: '#ffffff', bri: 0.75, ms: 250 },                  // zombie destroyed: short white pop
      crunch: { color: '#ff0000', bri: 1.0, holdMs: 1500, fadeMs: 2500 },   // a player is taken out
      rise: { color: '#5cff2e', bri: 0.55, ms: 1200 },                 // a fallen player rises
      escape: { colors: ['#ffc21a', '#fff0b8', '#ffa200'], bri: 1.0, steps: 6, stepMs: 500 },  // helicopter escape
      over: { holdMs: 4000 },     // final look is held this long before the original lights come back
      restoreTransitionMs: 1500,
      disconnectRestoreMs: 30000, // TV gone this long -> restore the lights
      rate: { lightsPerSec: 8, groupsPerSec: 1, perLightMax: 6 }   // Hue limits: ~10/s lights, ~1/s groups.
      // perLightMax: up to this many selected lights are driven individually (snappier); more use room/zone commands
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
