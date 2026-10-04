/* =====================================================================
   RED DEER RICH - TUNABLE NUMBERS  v0.1 (first playable, placeholder art)
   ---------------------------------------------------------------------
   Every rule number lives here. Change a value, save, refresh the TV.
   Phones read the same file (colours, labels, characters).
   The board (spaces, prices, rents) and the card decks are in js/board.js.
   ===================================================================== */
(function (root) {
  root.RDR_CONFIG = {
    version: '0.1',

    // ---- money (present-day dollars; era skins come later) ----
    startCash: 1800,
    halfwayPay: 250,             // passing or landing on THE HALFWAY
    bullseyePay: 500,            // house rule: land EXACTLY on The Halfway
    jackpotSeed: 500,            // house rule: Secret Dirt Lot pot starts (and reseeds) here
    towFee: 60,                  // pay to get out of the Snowbank
    snowTries: 3,                // rolls for doubles before you must pay and move
    unhockFee: 0.10,             // unhock = hock value + 10%
    shopSellBack: 0.5,           // selling a Shop back to the bank returns this share of its cost
    bankShops: 32,               // Shop Shortage stock
    bankMegas: 12,
    triplesToSnowbank: 3,        // doubles in a row that send you into the ditch

    // ---- players ----
    maxPlayers: 8,
    minPlayers: 2,

    // ---- Rags -> Doing Good -> GOLD (net worth = cash + deed prices (hocked at half) + Shop costs) ----
    states: { goodNetWorth: 2500, goldNetWorth: 6000 },

    // ---- PAY UP race ----
    payup: {
      graceMs: 1500,             // PASS DICE is disabled this long after landing
      kidGraceMs: 4000,          // Kid Mode grace
      loudAmpMs: 1000,           // Mike's perk: his window stays open this much longer after PASS DICE
      aiReflexMs: { easy: [4000, 7000], normal: [2000, 4000], ruthless: [800, 1500] },
      aiPassDiceMs: [2200, 4800] // AI movers pass the dice after a random pause in this range
    },

    // ---- modes ----
    quick: { startCash: 1500, minutes: 45, dealSmall: 3, dealBig: 2 },   // 3 deeds each for 2-3 players, 2 each for 4+
    maxRounds: 250,              // safety net: after this many rounds the richest player wins (keeps AI-only games finite)

    // ---- house rules (lobby defaults) ----
    rules: {
      jackpot: false,            // Dirt Lot Jackpot
      feesToPot: false,          // taxes, card fines and tow fees go into the pot (needs jackpot)
      bullseye: false,           // $500 for landing exactly on The Halfway
      payupRace: true,           // off = classic automatic rent
      perks: true,               // character perks
      kidMode: false,            // 4 s PAY UP grace
      evenBuild: true,           // build evenly across a colour set
      shopShortage: true         // limited bank stock
    },

    // ---- timing (ms). &fast in the URL divides these by 4 ----
    timing: { roll: 900, step: 230, card: 2600, afterMove: 350, turnGap: 500, banner: 2200 },

    // ---- characters: 11 playables, 8 seats max. shape = placeholder token shape ----
    characters: [
      { id: 'justin', name: 'JUSTIN', full: 'Justin', role: 'Drums / vocals', band: true, color: '#3d8b3d', ink: '#ffd84a', shape: 'mohawk',
        line: 'Counts the band in, hits hardest, and is shirtless by the second song.', perk: 'Count-In', perkText: 'Once per game, re-roll your dice. (coming soon)' },
      { id: 'mike', name: 'MIKE', full: 'Mike', role: 'Vocals, Justin\'s brother', band: true, color: '#d8262f', ink: '#ffffff', shape: 'spikes',
        line: 'The tallest hair and the loudest voice in any room.', perk: 'Loud Amp', perkText: 'His PAY UP window lasts 1 second longer.' },
      { id: 'doug', name: 'DOUG', full: 'Doug', role: 'Original bass player', band: true, color: '#f2c94c', ink: '#3a2a00', shape: 'mop',
        line: 'Laid-back low end. Nothing rattles him.', perk: 'Steady Groove', perkText: 'Never pays more than $100 on a single Hailstone card.' },
      { id: 'drew', name: 'DREW', full: 'Drew Weatherhead', role: 'Guitar / vocals', band: true, color: '#1d1d24', ink: '#ff4040', shape: 'star',
        line: 'Jumps off everything. "An amazing human being."', perk: 'High Kick', perkText: 'Once per game, roll 3 dice and keep 2. (coming soon)' },
      { id: 'grace', name: 'GRACE', full: 'Grace Friesen', role: 'Church-going mom of four', color: '#e889b5', ink: '#4a1030', shape: 'heart',
        line: '"I\'ll pray for your rent payment, hon."', perk: 'Potluck Blessing', perkText: 'Potluck cards that pay her pay $25 more.' },
      { id: 'walt', name: 'WALT', full: 'Walt', role: 'Knows every trail, bench and name', color: '#8a6a3a', ink: '#fff3d6', shape: 'toque',
        line: '"Been here longer than the roundabouts, friend."', perk: 'Knows Every Shortcut', perkText: 'Nudge his move by 1 space once per lap. (coming soon)' },
      { id: 'dez', name: 'DEZ', full: 'Dez Kowalski', role: 'Metalhead, flyer route', color: '#5a6b85', ink: '#e8eef8', shape: 'horns',
        line: '"Life\'s too short for quiet guitars."', perk: 'Iron Neck', perkText: 'Shrugs off his first WHITEOUT each game.' },
      { id: 'lenore', name: 'LENORE', full: 'Lenore Vance', role: 'Goth poet, works nights', color: '#6b3fa0', ink: '#efe0ff', shape: 'moon',
        line: '"Darkness is just the sun taking a break."', perk: 'Unbothered', perkText: 'Ignores her first "lose a turn" card.' },
      { id: 'priya', name: 'PRIYA', full: 'Priya Sandhu', role: 'Realtor-in-training', color: '#1f7fd1', ink: '#ffffff', shape: 'diamond',
        line: '"Let\'s circle back to that offer."', perk: 'Pre-Approved', perkText: 'First deed she buys each lap is 10% off.' },
      { id: 'minh', name: 'MINH', full: 'Minh Tran', role: 'Runs a tiny pho shop', color: '#e8762b', ink: '#ffffff', shape: 'bowl',
        line: '"Shop local. Especially my shop."', perk: 'Regulars', perkText: '+$10 from the bank whenever someone pays him rent.' },
      { id: 'cody', name: 'CODY', full: 'Cody Tremblay', role: 'Farm kid turned rig hand', color: '#2bb3a3', ink: '#05302b', shape: 'cap',
        line: '"Payday\'s comin\', boys."', perk: 'Two-and-Two', perkText: 'Every 2nd Halfway pass pays $100 extra.' }
    ],

    // ---- AI players ----
    ai: {
      levels: { easy: { label: 'Easy', reserve: 50, buyBias: 0.75, build: 0.5, trade: 0.15 },
                normal: { label: 'Normal', reserve: 150, buyBias: 0.95, build: 0.85, trade: 0.3 },
                ruthless: { label: 'Ruthless', reserve: 220, buyBias: 1, build: 1, trade: 0.45 } },
      thinkMs: [700, 1500],      // pause before an AI rolls / buys
      tradeEveryTurns: 3,        // an AI looks for a set-completing trade about this often
      takeoverAfterMs: 15000,    // a phone that drops mid-game gets an AI stand-in after this long
      lines: {
        greet:    { _: ['Let\'s get rich, Red Deer!', 'Good luck, everybody.', 'May the dice be kind.', 'Who brought snacks?'],
                    dez: ['Turn it up to eleven! \uD83E\uDD18', 'Life\'s too short for quiet guitars.'], grace: ['Bless this game, everyone!', 'I brought squares!'],
                    walt: ['Been here longer than the roundabouts, friend.'], priya: ['Love the energy. Let\'s do some deals.'],
                    justin: ['One, two, three, FOUR!'], mike: ['THIS IS GONNA BE LOUD!'], doug: ['Nice and easy, folks.'], drew: ['Let\'s gooo! *jumps off the couch*'],
                    lenore: ['The night is young.'], minh: ['Shop local, everybody.'], cody: ['Payday\'s comin\', boys.'] },
        offer:    { _: ['Got a deal for you. Take a look.', 'I think this works for both of us.', 'Check your trades, friend.'],
                    dez: ['Your set needs my riff. Check the deal.'], priya: ['Let\'s circle back to that offer.'], walt: ['Fair trade, friend. Have a look.'] },
        accepted: { _: ['Pleasure doing business!', 'Done deal.', 'Cemented!'], grace: ['I brought squares to celebrate this deal!'], dez: ['Deal! \uD83E\uDD18'] },
        declined: { _: ['No thanks.', 'Not today.', 'Hard pass.'], grace: ['Bless your heart, that\'s a no.'], walt: ['I know a fair trade when I see one. This ain\'t it, friend.'],
                    dez: ['Your offer is weaker than an acoustic cover.'], priya: ['Love the energy. Let\'s circle back with numbers.'] },
        caught:   { _: ['PAY UP!', 'Gotcha!', 'Not so fast!'], dez: ['PAY UP, poser! \uD83E\uDD18'], grace: ['Rent, hon. I\'ll pray for you.'], mike: ['PAAAAY UUUUP!'] },
        gotCaught:{ _: ['Aw, nuts.', 'So close!', 'Fine, fine.'], walt: ['Fair\'s fair, friend.'], lenore: ['How very predictable.'] },
        slipped:  { _: ['Heh. Tiptoe...', 'Nobody saw that.', 'Free parking, basically.'] },
        chat:     { _: ['Ha! Good one.', 'Focus on the game, friend.', 'Maybe after this lap.', 'I\'m just here for the deals.', '\uD83D\uDE04'] }
      }
    },

    // ---- living board (TV only, rules unchanged) ----
    living: {
      cycleMin: 12, nightShare: 1 / 3, blendSec: 30,   // 12-minute day/night cycle, 1/3 night, 30 s dawn/dusk blends
      walkersDay: 14, walkersNight: 9, cars: 4,
      crushBelowFps: 24, crushAfterSec: 5,            // Auto-Crush: drop a rung if fps < 24 for 5 s
      recoverAboveFps: 28, recoverAfterSec: 30,
      maxRung: 6
    },

    // ---- Upper Level Youth Centre (the band's old all-ages venue, landmark by downtown) ----
    youthCentre: {
      nearSpaces: [32, 33, 34],  // spaces right in front of it (Gaetz Avenue, Potluck, Ross Street)
      hearRange: 9,              // spaces away where the band starts to be (faintly) heard
      minVol: 0.0, maxVol: 0.55, bpm: 176
    },

    // ---- Philips Hue (optional) via the Zombie Tiles Lights Helper (same message protocol) ----
    // The helper reads these when it joins. Same keys as Zombie Tiles so the helper works unchanged.
    hue: {
      intensity: 0.8,
      ambient: { color: '#f2d9a6', bri: 0.35, transitionMs: 2500 },
      turn: { mix: 0.55, bri: 0.4, transitionMs: 1200, flickers: 1 },
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
      boom: { color: '#bfe6ff', flash: '#ffffff', bri: 1.0, ms: 900 },
      crunch: { color: '#ff0000', bri: 1.0, holdMs: 1500, fadeMs: 2500 },
      rise: { color: '#9dff6a', bri: 0.55, ms: 1200 },
      escape: { colors: ['#ffd23f', '#3fb54a', '#ff4fd8', '#3fd0ff', '#ffffff', '#ff7a1a'], bri: 1.0, steps: 8, stepMs: 450 },
      over: { holdMs: 4000 },
      restoreTransitionMs: 1500,
      disconnectRestoreMs: 30000,
      rate: { lightsPerSec: 8, groupsPerSec: 1, perLightMax: 6 }
    },
    // the existing Zombie Tiles Lights Helper dials rooms with this prefix; the TV opens a small extra "lights door" with it
    lightsPeerPrefix: 'ztp-zombietiles-v01-',

    // ---- networking ----
    peerPrefix: 'ztp-reddeerrich-v01-',
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    liveControllerUrl: 'https://amazingjustinlewis-web.github.io/games/red-deer-rich/controller.html'
  };
})(typeof window !== 'undefined' ? window : globalThis);
