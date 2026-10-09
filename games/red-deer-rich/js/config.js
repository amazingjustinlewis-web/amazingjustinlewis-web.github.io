/* =====================================================================
   RED DEER RICH - TUNABLE NUMBERS  v0.5 (placeholder art)
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
    unhockFee: 0.10,             // unmortgage = mortgage value + 10% (v0.4: 'hock' is called Mortgage everywhere players can see; the code keeps the old names)
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
      graceMs: 3000,             // PASS DICE (and ROLL AGAIN) is locked this long after landing on someone's deed (v0.3: only when a PAY UP window opens)
      kidGraceMs: 4000,          // Kid Mode grace
      loudAmpMs: 1000,           // Mike's perk: his window stays open this much longer after PASS DICE
      aiReflexMs: { easy: [4000, 7000], normal: [2000, 4000], ruthless: [800, 1500] },
      aiPassDiceMs: [3000, 5500], // AI movers pass the dice after a random pause in this range (never before graceMs)
      boom: { shake: 0.5, flash: 0.275 },   // v0.3: the PAY UP catch boom at half strength (TV shake amplitude, red flash opacity; the sound is halved in sfx.js)
      explode: { burstMs: 420, flyMs: 760, spread: 2.3, mult: 1.8 }   // v0.3: on a PAY UP catch the money explodes out of the caught token (burst radius in tiles), then streams to the catcher
    },
    // ---- v0.3 card decks (cards themselves are in js/board.js) ----
    decks: {
      random: { name: 'RED DEER RANDOMNESS', tile: 'RANDOM- NESS', blurb: 'quirky everyday Red Deer happenings' },
      finds:  { name: 'SECRET FINDS', tile: 'SECRET FINDS', blurb: 'true stories from Red Deer history' }
    },
    // era skins (design doc section 13). Every card carries one of these (or 'any'). eraFilter: null = draw from all eras;
    // set it to an era id and the decks only use that era's cards (plus 'any'), falling back to all if too few.
    eras: { pioneer: 'Pioneer Red Deer', punk2000: '2000 Punk Red Deer', present: 'Present Day', future: 'Future Red Deer' },
    eraFilter: null,
    cardHoldMs: 12000,           // v0.5: every drawn card stays up on the TV this long unless another card replaces it
    storyHoldMs: 12000,           // v0.3: a Secret Finds card stays up on the TV this long (stories need a little longer than 6 s)
    ping: { ms: 1100, lift: 0.22, gapMs: 600 },   // v0.3: tapping a deed in My Stuff bounces that tile on the TV (lift = bounce height in tiles)
    // v0.4 Heckle (house rule): when the active player stalls, everyone else gets a tiny heckle button. It unlocks after
    // afterMs[0] of inactivity on the first stall of a turn, afterMs[1] on the second, afterMs[2] on the third, and after the
    // third it stays unlocked until the turn ends. Any action by the stalling player locks it again. gapMs = per-heckler spam limit.
    // v0.5 Disasters (house rule): mild local mishaps hit a random owned business between turns. sev 1/2/3 = minor/medium/major
    // = closed or half rent for that many of the owner's turns. Never two on one deed. chance = per turn, at most maxPerRound
    // per round and maxActive at once, from startRound on, never the same owner twice in a row. rushPct x price per turn
    // left = RUSH REPAIR cost. sevWeights pick the severity (mostly minor). Night events need the TV's night (sim: every 3rd turn).
    disasters: { chance: 0.14, maxPerRound: 2, maxActive: 3, startRound: 2, rushPct: 0.10, sevWeights: [0.56, 0.32, 0.12], flyMs: 900, holdMs: 5200 },
    // v0.5 AUTO-RAISE plan order: mortgage deeds outside full sets (cheapest first), sell Shops evenly from the weakest set,
    // then mortgage set deeds (weakest set first). Stops as soon as the debt is covered.
    // v0.5 game timer: separate from game length. null = the length's default (Regular none, Medium 45, Quick 30).
    timerChoices: [0, 20, 30, 45, 60, 90],
    // v0.5 resting tokens let tile text show through; solid while moving and for the active player
    tokenRestAlpha: 0.7,
    buildSeqMs: 3200,            // v0.5 Mega-Plex construction (saw + hammer on the tile)
    heckle: { afterMs: [15000, 5000, 3000], gapMs: 450, targetGapMs: 120, faces: ['\uD83D\uDE02', '\uD83E\uDD23', '\uD83D\uDE06', '\uD83D\uDE1D', '\uD83E\uDD2A'] },

    // ---- TV presentation (v0.1.1) ----
    tradeFadeMs: 10000,          // after a private deal, traded tiles drift from the old owner's colour to the new one
    ownerTint: { fill: 0.24, fillHocked: 0.128, border: 0.76, phoneFill: 0.336, phoneFillHocked: 0.16 },   // (v0.3 wash; v0.4 keeps fill only for the My Stuff tile-bounce flash)
    // v0.4 owned tiles: a hard outline in the owner's colour at the tile edge (line = share of a tile's width) that feathers
    // inward a little (feather = share of a tile's width, steps = how many soft rings). The middle of the tile and its colour
    // band are never tinted. Mortgaged tiles draw the outline at mortgagedAlpha.
    ownerLine: { line: 0.085, feather: 0.12, steps: 4, mortgagedAlpha: 0.45 },
    sky: { on: true, alpha: 0.2, sunR: 0.075, moonR: 0.06, sunLight: 0.16, moonLight: 0.12, horizon: 1.06, height: 0.86 },   // v0.1.1 sun + moon arc: ~80% transparent over the board
    art: { lean: 0.12, fisheye: 0.3 },   // v0.2 building art: roofs lean OUTWARD from the board centre by lean x height at the edge (0 = flat, 0.12 = ~9 degrees). One knob.
    lighting: { feather: 0.2 },
    fx: { noteHoldMs: 6000, noteFadeMs: 1400, bigRent: 150, floatMs: 1700, countTauMs: 170 },  // v0.2 notifications / money feedback
    logLines: 9,                 // v0.2 TV log: most lines shown (fewer when the side panel is crowded)  // v0.2: night tint / sun glow cover the centre square and feather this share of a tile's depth onto the tiles
    camera: { zoom: 1.32, zoomTauMs: 650, followTauMs: 420, outHoldMs: 1300, marginTiles: 1.3 },
    boardDice: { holdMs: 1700, fadeMs: 350 },
    tileText: { nameScale: 0.235, priceScale: 0.215, minPx: 12, cornerScale: 1.55 },   // v0.1 was 0.15 x tile width for names (and 0.135 for prices)

    // ---- modes ----
    // v0.1.1: three game lengths. deal: 0 = nothing pre-dealt, 'some' = dealSmall/dealBig deeds each, 'all' = every ownable space dealt out
    modes: {
      regular: { label: 'Regular', blurb: 'Nothing pre-dealt', startCash: 1800, deal: 0, minutes: 0 },
      medium:  { label: 'Medium', blurb: 'Some deeds pre-dealt, 45 min', startCash: 1500, deal: 'some', minutes: 45 },
      quick:   { label: 'Quick', blurb: 'ALL deeds pre-dealt, 30 min', startCash: 1500, deal: 'all', minutes: 30 }
    },
    quick: { dealSmall: 3, dealBig: 2 },   // Medium: 3 deeds each for 2-3 players, 2 each for 4+
    // v0.1.1 auctions: a deed nobody buys goes under the hammer
    auction: { start: 10, steps: [20, 50, 100], ms: 8000, aiReactMs: [700, 2600] },
    maxRounds: 250,              // safety net: after this many rounds the richest player wins (keeps AI-only games finite)

    // ---- house rules (lobby defaults) ----
    rules: {
      jackpot: false,            // Dirt Lot Jackpot
      feesToPot: false,          // taxes, card fines and tow fees go into the pot (needs jackpot)
      bullseye: false,           // $500 for landing exactly on The Halfway
      payupRace: true,           // off = classic automatic rent
      perks: true,               // character perks
      kidMode: false,            // 4 s PAY UP grace
      auctions: true,            // a passed-on deed goes to auction (every phone can bid)
      camera: true,              // TV camera gently follows the active player (also the C key on the TV)
      evenBuild: true,           // build evenly across a colour set
      shopShortage: true,        // limited bank stock
      disasters: false,          // v0.5: mild local mishaps close or halve a business's rent for 1-3 turns
      heckle: true               // v0.4: everyone can heckle a player who stalls on their turn (escalating 15 s / 5 s / 3 s)
    },

    // ---- v0.2.1 game options as players see them (setup screens, TV lobby). Order = display order.
    //   short: one line in the options list; long: shown when you press and hold the row; icon + tag: TV lobby chips
    options: [
      { k: 'payupRace', icon: '\u270B', tag: 'PAY UP race', label: 'PAY UP race', short: 'Owners hit PAY UP before the dice pass, or the rent is missed',
        long: 'When someone lands on your deed, a giant PAY UP button takes over your phone. Hit it before they pass the dice to collect the rent. Miss it and they tiptoe away. Off: rent is paid automatically, like the classic game.' },
      { k: 'auctions', icon: '\uD83D\uDD28', tag: 'Auctions', label: 'Auctions', short: 'A deed nobody buys goes to auction, every phone can bid',
        long: 'If the player who lands on a deed passes on it, it goes straight to an 8-second auction starting at $10. Anyone can bid +$20, +$50 or +$100 from their phone. Each bid resets the clock.' },
      { k: 'perks', icon: '\u2B50', tag: 'Perks', label: 'Character perks', short: 'Each character has a little special power',
        long: 'Every character has a perk, like Mike\'s Loud Amp (his PAY UP window lasts 1 second longer). Swipe through the characters on your phone to read them. A few are still marked coming soon.' },
      { k: 'jackpot', icon: '\uD83D\uDCB0', tag: 'Jackpot', label: 'Dirt Lot Jackpot', short: 'Land on the Secret Dirt Lot and win the pot ($500 to start)',
        long: 'The Secret Dirt Lot corner holds a cash pot that starts at $500. Land on it and the whole pot is yours, then it resets to $500. Pairs well with Fees feed the pot.' },
      { k: 'feesToPot', icon: '\uD83E\uDE99', tag: 'Fees \u2192 pot', label: 'Fees feed the pot', short: 'Taxes, card fines and tow fees grow the jackpot',
        long: 'Instead of vanishing into the bank, taxes, Red Deer Randomness and Secret Finds fines and tow truck fees pile up in the Dirt Lot pot, so the jackpot gets juicy. Turning this on also turns on the Dirt Lot Jackpot.' },
      { k: 'bullseye', icon: '\uD83C\uDFAF', tag: 'Bullseye', label: 'Bullseye Halfway', short: 'Land exactly on The Halfway for $500 instead of $250',
        long: 'Passing The Halfway pays $250 as usual. Landing exactly on it is a Bullseye and pays $500.' },
      { k: 'kidMode', icon: '\uD83E\uDDF8', tag: 'Kid Mode', label: 'Kid Mode', short: 'Owners get 4 seconds to hit PAY UP (gentler for little hands)',
        long: 'After a token lands, the dice can\'t be passed for 4 seconds instead of 3, so slower hands still have time to hit PAY UP. Only matters with the PAY UP race on.' },
      { k: 'camera', icon: '\uD83C\uDFA5', tag: 'TV camera', label: 'TV camera', short: 'The TV gently zooms in and follows whoever is moving',
        long: 'The TV board softly zooms toward the active player and swoops in on big moments (purchases, big rent, bankruptcies). Turn it off for a fixed, full-board view. Also the C key on the TV.' },
      { k: 'heckle', icon: '\uD83D\uDE02', tag: 'Heckle', label: 'Heckle', short: 'Stall on your turn and everyone gets a heckle button',
        long: 'If the player whose turn it is sits still for 15 seconds, a tiny laughing-face button pops up beside their name on everyone else\'s phone. Every tap floats laughing faces up their screen and buzzes their phone. It locks again the moment they do something. Stall a second time and it unlocks after 5 seconds, a third time after 3 seconds, and then it stays open until their turn is over.' },
      { k: 'disasters', icon: '\u26C8\uFE0F', tag: 'Disasters', label: 'Disasters', short: 'Hail, floods, raccoons: a business closes or earns half for a turn or three',
        long: 'Now and then a mild local mishap hits a random owned business: hail, a water main break on Gaetz, a goose standoff, a break-in at night. Minor ones last 1 turn, medium 2, major 3, and the business is closed (no rent) or earns half rent until it is fixed. Never two on the same deed, a few per round at most. The owner can pay for a RUSH REPAIR (about 10% of the price per turn skipped). No tornadoes.' }
    ],
    // one-tap presets (camera is a TV preference and is left alone). Edit anything afterwards and setup shows "Custom".
    presets: {
      classic: { label: 'Classic', blurb: 'The game as designed', rules: { payupRace: true, auctions: true, perks: true, jackpot: false, feesToPot: false, bullseye: false, kidMode: false, heckle: true, disasters: false } },
      chaos:   { label: 'Chaos', blurb: 'Everything on, big swings', rules: { payupRace: true, auctions: true, perks: true, jackpot: true, feesToPot: true, bullseye: true, kidMode: false, heckle: true, disasters: true } },
      chill:   { label: 'Chill', blurb: 'Automatic rent, no auctions, bonus cash', rules: { payupRace: false, auctions: false, perks: true, jackpot: true, feesToPot: false, bullseye: true, kidMode: false, heckle: false, disasters: false } }
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
        line: 'Laid-back low end. Nothing rattles him.', perk: 'Steady Groove', perkText: 'Never pays more than $100 on a single Red Deer Randomness card.' },
      { id: 'drew', name: 'DREW', full: 'Drew Weatherhead', role: 'Guitar / vocals', band: true, color: '#1d1d24', ink: '#ff4040', shape: 'star',
        line: 'Jumps off everything. "An amazing human being."', perk: 'High Kick', perkText: 'Once per game, roll 3 dice and keep 2. (coming soon)' },
      { id: 'grace', name: 'GRACE', full: 'Grace Friesen', role: 'Church-going mom of four', color: '#e889b5', ink: '#4a1030', shape: 'heart',
        line: '"I\'ll pray for your rent payment, hon."', perk: 'Blessed Finds', perkText: 'Secret Finds cards that pay her pay $25 more.' },
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
      takeoverAfterMs: 10000,    // v0.2: a phone that drops mid-game shows a countdown on the TV, then an AI covers the seat
      lostAfterMs: 9000,         // v0.2: no ping for this long = the phone is gone (phones ping every 4 s)
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
      cityCars: 3, cityPegs: 8,                        // v0.1.1 mini city: extra little cars on the inner ring road + peg-people (capped; halved / dropped by Auto-Crush)
      crushBelowFps: 24, crushAfterSec: 5,            // Auto-Crush: drop a rung if fps < 24 for 5 s
      recoverAboveFps: 28, recoverAfterSec: 30,
      maxRung: 6,
      // v0.4 auto quality: the starting rung comes from device hints (CPU cores, memory, TV-stick browsers), then a short
      // frame-time probe right after load (and again as each game starts) jumps straight to the right rung instead of
      // waiting out Auto-Crush. Hidden overrides: ?fx=0..6, ?lowfx, ?nocrush, or localStorage rdr_fx = '0'..'6' / 'auto'.
      probe: { warmMs: 900, ms: 2600, slowMs: 34, verySlowMs: 50, fastMs: 19 }
    },

    // ---- Upper Level Youth Centre (the band's old all-ages venue, landmark by downtown) ----
    youthCentre: {
      nearSpaces: [32, 33, 34],  // spaces right in front of it (Gaetz Avenue, Secret Finds, Ross Street)
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
