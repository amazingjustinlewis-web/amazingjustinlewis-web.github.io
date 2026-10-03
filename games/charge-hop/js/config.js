/* =====================================================================
   CHARGE HOP - config.js
   Every tuning number lives here. Units:
     time  = seconds of GAME time (slow motion stretches these) unless noted "real"
     space = world pixels (1 row / 1 column = world.tile pixels)
     speed = world pixels per second
   Tip: press ` (backquote) in game to tweak many of these live, then hit
   "Dump values" in the debug panel and paste the numbers back in here.
   ===================================================================== */
const CONFIG = {
  world: {
    tile: 48,              // size of one row (and one column) in world px
    columns: 13,           // playfield width in tiles (world width = tile * columns)
    offscreenMargin: 5,    // tiles beyond each side where vehicles spawn / logs wrap (hidden by side curtains)
    curtainTiles: 1.6,     // how many tiles outside the playfield the dark side curtains take to go fully opaque
    feetOffset: 0.26       // where a character's feet sit inside its row (0 = row centre, 0.5 = bottom edge), in tiles
  },

  sim: {
    fixedDt: 1 / 120,      // fixed simulation step (real seconds). Game dt per step = fixedDt * timeScale
    maxFrameTime: 0.25     // clamp for long frames (tab switches etc.)
  },

  input: {
    tapThreshold: 0.15,    // released before this = a quick "tap" hop (1 row, no crouch shown)
    bufferWindow: 0.12     // a tap finished this long (or less) before landing is replayed as a hop on landing
  },

  charge: {
    level1Time: 0.35,      // hold this long -> charge level 1 = 2-row jump
    level2Time: 0.75,      // hold this long (needs power-up) -> charge level 2 = 3-row jump
    overloadGrace: 0.6,    // keep holding this long past FULL charge -> overload burst
    rows: [1, 2, 3],       // rows jumped for charge level 0 / 1 / 2
    crouchMax: 0.6,        // how deep the crouch gets at full charge (0..1 of leg length)
    shakeBase: 0.4,        // px of vibration when charge starts
    shakeFull: 2.2,        // px of vibration at full charge
    shakeOverload: 6.5,    // px of vibration right before an overload burst (violent warning)
    fireRateMin: 14,       // fire particles per second at the start of a charge
    fireRateMax: 90,       // fire particles per second at full charge / overload
    glowRadius: 34         // px radius of the charge glow at full charge
  },

  jump: {
    airBase: 0.10,         // air time = airBase + airPerRow * rows
    airPerRow: 0.12,
    arcBase: 12,           // peak arc height (px) = arcBase + arcPerRow * rows
    arcPerRow: 11,
    apexScale: 0.22,       // extra scale at apex (fake 3D "toward camera")
    takeoffStretch: 0.28,  // vertical stretch at takeoff (squash & stretch)
    landSquash: 0.32,      // vertical squash at landing
    landTime: 0.14,        // how long the landing squash pose lasts
    inheritRideVelocity: 1.0 // fraction of your sideways velocity (from logs/slides) kept while airborne
  },

  streak: {                // TAP RHYTHM MOMENTUM: quick repeated taps build a speed streak
    window: 0.30,          // tap again within this long after landing to keep the streak going
    perTap: 0.09,          // each streak step shortens hop air time by this fraction...
    minAirMul: 0.55,       // ...down to this multiplier (0.55 = hops take 55% of normal time)
    max: 6,                // streak cap
    arcMul: 0.85           // arc height multiplier at max streak (flatter, snappier hops)
  },

  // SURFACE FRICTION (1/s): how quickly your sideways velocity decays toward the surface's own
  // velocity (0 for ground, the log's speed for logs). High = grippy, low = slippery.
  // Any lane in a level can override with  friction: <number>  (e.g. an ice lane: friction: 0.4).
  friction: {
    start: 6, grass: 6, goal: 8, road: 7, checkpoint: 6, plain: 6,
    river: 4,              // grip on logs (lower = slide more after bumps / landings)
    chute: 4,              // grip on lava-chute rock chunks
    default: 6
  },

  overload: {
    flingRows: 1,          // overload always flings exactly this many rows
    flingAir: 0.42,        // air time of the fling (s)
    flingArc: 30,          // px arc height of the fling
    spins: 1.25,           // tumbling turns during the fling
    sideKick: 40,          // random sideways velocity (px/s, +-) added to the fling for chaos
    dizzyTime: 0.5         // input ignored for this long after landing a fling
  },

  player: {
    hitHalfWidth: 10,      // half-width of a character's collision box (px)
    colors: ['#ff8a1f', '#22d3ee'],      // P1 orange, P2 cyan
    darkColors: ['#7a3a00', '#0b5563'],
    names: ['P1', 'P2'],
    keys: ['SPACE', 'ENTER'],
    startColumns: [4, 8],  // start columns in 2-player mode
    soloColumn: 6,         // start column when playing alone
    respawnBlink: 0.6      // seconds of blinking after a respawn (cosmetic)
  },

  road: {
    vehicleInset: 4,       // px shaved off each end of a vehicle's hitbox (forgiveness)
    takeoffCloseGap: 26,   // leaving a road lane with a vehicle this close (px) = close call
    landCloseGap: 18       // landing on a road this close (px) to a vehicle without being hit = close call
  },

  river: {
    currentPull: 0.6,      // how quickly (1/s) a log returns to its own preferred speed after a bump
    speedJitter: 0.35,      // how much logs' speeds wander around the lane's mean speed (std dev, fraction of mean).
                           // Logs start at their level-file speeds, then drift: they catch up, bump, separate.
    driftTime: 4,          // seconds for a log's speed to forget its current offset (higher = longer chases)
    restitution: 0.7,      // bounciness of log-vs-log bumps (0 = dead stop, 1 = perfectly elastic)
    landingSlide: 0.35,    // fraction of airborne relative velocity kept as slide when landing on a log
    landTolerance: 6,      // px your centre may be past a log edge and still (barely) land on it
    edgeSafe: 8,           // centre closer than this (px) to a log edge -> teeter
    teeterGrace: 0.45,     // seconds of teetering before you fall in (jump away to save yourself!)
    edgeCloseCall: 12,     // landing with your centre this close to an edge triggers slow-mo
    worldEdgeGrace: 4,     // px past the playfield edge a rider can be carried before dying
    wrapMargin: 4          // tiles beyond each side where logs wrap round (keep > curtainTiles + half the longest log)
  },

  // ---------------- v2 additions ----------------
  domino: {                // OPEN PLAINS dominoes (sizes in world px; 1 tile = 48)
    width: 22,             // across the tile
    thickness: 7,          // standing footprint depth
    height: 38,            // length when lying flat (how far it reaches when it falls)
    spacing: 28,           // default gap between dominoes along a pattern (must be < height to chain)
    reachSlack: 4,         // extra px of reach when knocking the next domino
    coneDeg: 62,           // a falling domino hits standing ones within this angle of its fall direction
    fallTime: 0.30,        // seconds (game time) to tip over flat
    triggerAt: 0.62,       // fraction of the fall when it knocks the next one (lower = faster chains)
    obliqueK: 0.62,        // fake-3D: how tall things look (screen px per px of height)
    footBand: [18, 6],     // a player's footprint: px above / below the feet line used for domino collisions
    bumpStun: 0.3,         // stun after bouncing off a standing domino (gentle)
    landOnPlayerStun: 0.35,// stun when a falling domino lands on you
    knockback: 0.5,        // sideways velocity reversed by this much when you slide into a standing one
    deflect: 130,          // px/s minimum sideways glance when you bonk into a fallen domino...
    deflectMax: 480,       // ...aimed at the nearest open column, fast enough to reach it, capped here (px/s)
    glanceTime: 0.6,       // s: during the glance you can slide past fallen tiles in your own row (no boxed-in pockets)
    chargeVault: 2,        // a CHARGED jump landing on fallen dominoes carries on up to this many extra rows (a tap: 1)
    slowmoChain: 8,        // chain length that can trigger a slow-mo moment...
    slowmoRadius: 3.5,     // ...if a player is within this many tiles (uses the normal slow-mo cooldown)
    clickGap: 0.035,       // min seconds between domino click sounds
    brushRadius: 26        // v3 open straights: passing within this many px of a standing domino tips it over (no blocking)
  },

  run: {                   // v3 OPEN STRAIGHTS (plains with run: true): auto-run forward with momentum. Speeds in ROWS per second.
    entrySpeed: 5,         // walking onto a straight from the checkpoint before it (no chute)
    launchSpeed: 7.5,      // landing in a straight off a lava chute (auto launch)
    launchBonus: 1.5,      // + this for a timed jump off the chute's end (BIG LAUNCH)
    cruise: 3.5,           // speed settles toward this: drops fast when above it...
    decay: 0.6,            // ...(fraction of the excess lost per second)...
    recover: 0.25,         // ...and creeps back up when below it (rows/s per second)
    max: 9,                // top speed
    min: 1.6,              // never slower than this
    tapBoost: 1.2,         // each tap (long jump) adds this much speed
    slowMul: 0.55,         // landing on a fallen domino / boulder multiplies speed by this ('slow!')
    hopArc: 7,             // px: height of the little running strides
    longJumpRows: 3,       // tap = long jump this many rows (cut short at the end of the straight)
    longJumpK: 1.1,        // long-jump airtime = rows / (speed * this), clamped to:
    longAirMin: 0.3,       //   s
    longAirMax: 0.55,      //   s
    longArc: 28,           // px: long-jump height
    sideDrag: 2            // /s: sideways momentum you came in with fades by this rate while running
  },

  chute: {                 // v3 LAVA CHUTES (transitions). Per-chute overrides in the level: v0, v1, chunks, waveGap, side0, side1
    v0: 55,                // px/s forward flow at the entrance...
    v1: 210,               // ...speeding up to this at the lip
    accel: 2,              // speed-up curve: 1 = steady, 2 = lazy start then a rush at the end (speed = v0 + (v1-v0) * s^accel)
    waveGap: 40,           // px between rows (waves) of chunks at the entrance (gaps grow as the flow speeds up)
    chunksPerWave: 3,      // rock chunks per wave
    chunkW: [62, 86],      // px: chunk width range at the entrance
    chunkH: 30,            // px: chunk depth
    side0: 22,             // px/s sideways sway of each row at the entrance...
    side1: 60,             // ...+ this much more at the lip
    sway: 70,              // px each row swings either side of the centre line
    spread: 0.6,           // a row of chunks gets this much wider by the lip (chunks spread apart from each other)
    bankGap: 18,           // px: chunks are held this far off the banks by the lip (0 at the entrance, so you can board from anywhere)
    launchCarry: 0.5,      // fraction of the chunk's sideways speed you keep when the chute launches you
    shrink: 0.4,           // chunks lose this fraction of their width by the lip (melting)
    landTolX: 6,           // px of forgiveness past a chunk's edge when landing on it
    landTolY: 16,          // px of forgiveness ahead/behind
    lipStart: 0.78,        // last part of the chute (fraction of its length) = the LIP: tap there = BIG LAUNCH
    launchRows: 2,         // the auto launch lands this many rows into the next open straight (1 = its first row)
    bigLaunchExtra: 1,     // a BIG LAUNCH lands this many rows further
    launchAir: 0.5,        // s airtime of the launch
    launchArc: 36          // px launch height
  },

  lavaDeath: {             // v3 falling in lava: red-hot & sizzling, then hops out smoking -> last checkpoint (~1.1 s)
    scorch: 0.5,           // s: sinking a bit, heating up red-hot, smoke & embers
    hop: 0.6,              // s: the smoking hop back toward the last checkpoint
    heatFade: 1.4,         // s: the red-hot glow cools off after respawning
    slowmo: false          // true = lava deaths trigger the death slow-mo
  },

  characters: {            // v2 character proxies (procedural placeholders; art in assets/ always overrides them)
    style: 'robots',       // 'robots' (P1 yellow toy robot, P2 bronze robot dog) or 'stickman'. C on the title screen toggles it.
    reassembleTime: 0.4    // s: a robot that came apart snaps back together after respawning
  },

  waterDeath: {            // falling in the water: big splash -> sink (rusting) -> swim back up -> pop out -> respawn
    tip: 0.12,             // s: tipping off a log edge before the splash (teeter falls only)
    sink: 0.6,             // s: sinking below the surface, rusting, bubbles
    rise: 0.4,             // s: flailing back up
    pop: 0.5,              // s: popping out, shaking off, hopping back toward the last safe spot   (total ~1.5 s)
    rustFade: 1.2,         // s: rust wears off after respawning
    slowmo: false          // true = water deaths also trigger the death slow-mo (makes the dunk longer)
  },

  idleDrop: {              // 2P: a joined player who never presses their button after GO sits the round out
    enabled: true,
    after: 10              // seconds after GO
  },

  celebrate: {             // WIN fireworks, then the same level restarts by itself with the same players
    duration: 5.0,         // seconds (real time) of fireworks before the automatic restart
    autoRestart: true,     // false = wait for R like v1
    rocketsPerSec: 3.2,    // average launch rate during the show
    finale: 7,             // rockets in the quick closing volley
    sparks: 70,            // sparks per burst (big shells get 1.5x)
    featuredShare: 0.55,   // share of shells in the WINNER's colour
    palette: ['#ff4fa3', '#ffe14d', '#7cff6b', '#b388ff', '#ff6b6b', '#ffffff', '#4fc3ff']
  },

  catchup: {               // two players very far apart (beyond the camera's min zoom)
    enabled: true,
    delay: 3.0,            // real seconds off the bottom of the screen before the trailing player is pulled up
    arrowMargin: 46        // px from the screen edge for the off-screen arrow
  },

  death: {
    animTime: 0.8,         // death animation length
    pauseTime: 0.45        // extra pause before respawn
  },

  powerup: {
    duration: 10,          // triple-jump power lasts this long...
    uses: 3,               // ...or this many 3-row jumps, whichever runs out first
    respawnTime: 8,        // seconds until a collected orb reappears
    pickupRadius: 22       // px
  },

  camera: {
    rowsAtZoom1: 9,        // rows visible top-to-bottom at zoom 1.0
    minZoom: 0.62,         // most zoomed OUT allowed (players far apart)
    twoPlayerMinZoom: 0.75,// v2: 2P spread never zooms out past this (readability); beyond it the camera keeps the
                           //     LEADER in frame and the trailing player gets an edge arrow. Set to 0.62 for v1 behaviour.
    maxZoom: 1.25,         // most zoomed IN allowed (players close / solo)
    fitWidth: true,        // never zoom in so far that the full playfield width is cut off (slow-mo push-in excepted)
    padRows: 2.6,          // breathing room (rows) above/below the players' bounding box
    padCols: 2.2,          // breathing room (columns) left/right of the players' bounding box
    lookAhead: 1.2,        // rows the camera looks ahead (up the screen)
    followEase: 3.2,       // position easing speed (1/s, real time)
    zoomEase: 2.4,         // zoom easing speed (1/s, real time)
    focusZoom: 1.45,       // zoom multiplier during a slow-mo moment
    focusEase: 9,          // how fast the camera snaps toward the slow-mo focus (1/s)
    shakeDecay: 7          // screen shake decay (1/s, real time)
  },

  slowmo: {
    enabled: true,
    timeScale: 0.3,        // game speed during a slow-mo moment
    hold: 0.8,             // real seconds at full slow-mo
    easeIn: 0.08,          // real seconds to drop into slow-mo
    easeOut: 0.35,         // real seconds to ease back to full speed
    cooldown: 2.5,         // real seconds before another close call can trigger slow-mo
    priorityCooldown: 0.9  // deaths / overloads / wins only need this much gap
  },

  shake: {
    death: 9,              // px screen shake on death
    overload: 6,           // px screen shake on overload burst
    bump: 0.8,             // px per (100 px/s) of log impact
    land3: 2.5             // px shake on landing a 3-row jump
  },

  audio: {
    volume: 0.45
  },

  debug: {
    showHitboxes: false,
    timeScale: 1           // manual global time multiplier (debug panel), stacks with slow-mo
  }
};
