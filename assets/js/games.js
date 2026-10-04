/* =====================================================================
   GAMES DATA  -  the whole site's game lists are rendered from here.
   ---------------------------------------------------------------------
   All paths are RELATIVE TO THE SITE ROOT (no leading slash).

   SECTIONS (the three layered cards on the home page)
     'soft-play'  front card: soft, bright, gentle. Kids + the One-Button Series
     'family'     centre card: the main section, soft to intense, all family-appropriate
     'deep-end'   back card: darker experiments (locked for now, no games listed)

   ADD A GAME = add one object to GAMES:
     id          short unique slug, e.g. 'charge-hop'
     title       game name
     pitch       one-line pitch
     cover       16:9 card image (~640x360 .webp)
     coverAlt    what the cover shows (screen readers)
     details     the game's details page
     status      small badge text ('Early prototype', 'New!', ...)
     tags        a few short labels
     accent      optional card colour
     sections    which home-page sections list it, e.g. ['soft-play', 'family']
     series      optional series id from SERIES below (e.g. 'one-button')
     intensity   1-5 on the family scale (see INTENSITY below)
     goodToKnow  short plain-language notes for parents / sensory-sensitive players
     versions    playable builds, newest first. Exactly one should have current: true.
                 Only list builds that really exist in the repo.

   ADD A NEW VERSION of a game: copy the build into its own folder (for example
   games/charge-hop/v4/), mark it current: true, set the old one to current: false
   and keep it in the list so people can still play it.
   ===================================================================== */

window.INTENSITY = ['', 'Gentle', 'Playful', 'Lively', 'Intense', 'Full throttle'];

window.SERIES = [
  {
    id: 'one-button',
    title: 'The One-Button Series',
    section: 'soft-play',
    blurb: 'Experimental games you play with a single button. One simple input, lots of ways to use it.'
  }
];

window.GAMES = [
  {
    id: 'charge-hop',
    title: 'Charge Hop',
    pitch: 'One button. Charge it. Don\u2019t blow it. A hop-and-launch race for 1\u20132 players.',
    cover: 'assets/img/charge-hop/cover-card.webp',
    coverAlt: 'Charge Hop title screen with the yellow toy robot and orange robot dog',
    details: 'games/charge-hop.html',
    status: 'Early prototype',
    tags: ['1\u20132 players', 'Keyboard', 'Browser'],
    accent: '#FFD700',
    sections: ['soft-play', 'family'],
    series: 'one-button',
    intensity: 3,
    goodToKnow: [
      'Beeps and boops made by the game: press M to mute.',
      'Press P to pause at any time.',
      'Slow-motion zooms on close calls; the screen shakes on crashes and overloads.',
      'Bright fireworks when someone wins.',
      'Falling in water or lava is a silly gag: the robot pops right back out.'
    ],
    versions: [
      {
        id: 'v3',
        name: 'The Lava Run',
        current: true,
        play: 'games/charge-hop/index.html',
        notes: 'Lava chutes and open sprints. The earlier levels, Rush Hour Creek and The Long Way, are in its level select.'
      }
      // Older builds can be added here once they're in the repo, e.g.
      // ,{ id: 'v2', name: 'The Long Way', current: false, play: 'games/charge-hop/v2/index.html', notes: '...' }
    ]
  },
  {
    id: 'zombie-tiles',
    title: 'Zombie Tiles',          // WORKING TITLE (placeholder name)
    pitch: 'Explore a zombie city tile by tile, fight with dice and race for the helipad. On your TV, with phones as controllers.',
    cover: 'assets/img/zombie-tiles/cover-card.webp',
    coverAlt: 'Zombie Tiles title art: a pixel-art city board with a fortified helipad, zombies and four stylised dice',
    details: 'games/zombie-tiles.html',
    status: 'Prototype',
    tags: ['1\u20134 players', 'TV + phones', 'Working title'],
    accent: '#b6ff7a',
    sections: ['family'],
    intensity: 4,
    goodToKnow: [
      'Cartoon zombies, no gore: fights are dice rolls with big result text.',
      'Players can be knocked out and come back as a zombie (or just watch).',
      'Trap boxes catch zombies in a cartoon rope snare, and dynamite goes off with a big cartoon boom and a screen shake.',
      'A player down to their last heart leaves a few small cartoon red drops on the board as they walk; they fade away after a few seconds.',
      'Each phone shows its own hearts and ammo, so a little secrecy is part of the fun.',
      'Short, cartoony sound effects from the TV (war cries, little screams, a crunch when a fight goes wrong): press M to mute.',
      'Optional teams (2\u20134, colour-coded): teammates never fight each other and can wait for each other on the helipad. While anyone waits there, zombies swarm the pad, so it gets tense.',
      'Computer players (AI) can fill empty seats, each with its own personality and an Easy, Normal or Ruthless setting.',
      'Needs an internet connection for phones to join (the TV and phones should share the same Wi-Fi). No phones? Play hot-seat on one screen.',
      'Optional Philips Hue lights: short colour flickers plus red, gold and orange flashes in fights, escapes and explosions. Leave them off if anyone is sensitive to flashing lights.'
    ],
    versions: [
      {
        id: 'v0.5',
        name: 'Teams & Takeoff',
        current: true,
        play: 'games/zombie-tiles/index.html',
        notes: 'Play in teams: the host turns on Teams in the lobby and puts players and AI into 2 to 4 colour-coded teams. Teammates never fight each other, and the results show the winning team. At the helipad you now choose TAKE OFF NOW or WAIT for the others: while anyone waits, zombies swarm the pad fence and attack, so you have to hold them off (weapons and thrown TNT help), then take off together. Plans can mix steps and drops: move 2, drop TNT, move 2 more, EXECUTE. AI players do all of this too. Fight balance unchanged.'
      },
      {
        id: 'v0.4',
        name: 'Traps & TNT',
        current: false,
        play: 'games/zombie-tiles/v0.4/index.html',
        notes: 'Pick up trap boxes and dynamite and drop them from your phone. Zombies that step on a trap get caught in a cartoon rope snare; lit dynamite goes off at the end of the round (or when you press DETONATE) and clears the zombies around it, but it hurts players standing too close. New phone buttons: RESET MOVES and END TURN. Players and zombies are now little animated characters that walk square by square (you can draw your own). Computer players use traps and dynamite too. v0.4.1: weapons hit harder (pipe +2, pistol +3, machine gun +5; bare hands unchanged), and a player on their last heart leaves a few cartoon drops behind them. v0.4.2: phones can now join on older smart-TV browsers (such as Samsung TVs) that used to say "PeerJS did not load" (all versions got this fix).'
      },
      {
        id: 'v0.3',
        name: 'AI Crew',
        current: false,
        play: 'games/zombie-tiles/v0.3/index.html',
        notes: 'Add computer players with personalities (cautious looter, reckless fighter, helipad sprinter, sneaky backstabber, loyal buddy) and Easy / Normal / Ruthless difficulty. They show their planned path, chat in speech bubbles, sometimes share ammo with a teammate (or leave them behind at the helipad), and cover for a phone that drops out. Optional coach hints on a phone. New sound effects and stronger light effects for everyone. v0.3.1: a helicopter celebration when someone escapes, a gentle "your turn" buzz on phones (switchable), and placing a tile now always ends your turn.'
      },
      {
        id: 'v0.2',
        name: 'Lights On',
        current: false,
        play: 'games/zombie-tiles/v0.2/index.html',
        notes: 'Same game as v0.1, plus optional Philips Hue lights that react to turns, dice, fights and escapes (needs the Lights Helper on a PC). v0.2.1: the helper connects through a hidden Edge/Chrome, so it works even when Firefox is the default browser; rooms can be ticked on the helper page too.'
      },
      {
        id: 'v0.1',
        name: 'First playable',
        current: false,
        play: 'games/zombie-tiles/v0.1/index.html',
        notes: 'Working title. Open it on a TV or big screen; phones join with the QR code. Hot-seat on one screen works too.'
      }
    ]
  },
  {
    id: 'red-deer-rich',
    title: 'Red Deer Rich',
    pitch: 'Buy Red Deer, build Shops, make deals on your phone and hit PAY UP before they pass the dice. On your TV, with phones as controllers.',
    cover: 'assets/img/red-deer-rich/cover-card.webp',
    coverAlt: 'Red Deer Rich TV board: Red Deer streets around a river, the Upper Level Youth Centre and player tokens',
    details: 'games/red-deer-rich.html',
    status: 'Early test',
    tags: ['2\u20138 players', 'TV + phones', 'Placeholder art'],
    accent: '#f2c230',
    sections: ['family'],
    intensity: 2,
    goodToKnow: [
      'A friendly property trading game set in Red Deer, Alberta. Players can go bankrupt; the last one standing wins.',
      'PAY UP is a reaction race: a big button pops up on the owner\u2019s phone, with a cartoon BOOM on the payer\u2019s phone when they get caught.',
      'Phones carry private chat and deals between players (the TV never shows them).',
      'A faint, made-up punk band plays from the Upper Level Youth Centre and gets louder as tokens get close. Press M on the TV to mute.',
      'Computer players can fill empty seats (Easy, Normal or Ruthless), in the lobby or mid-game from the host phone.',
      'Late arrivals can scan the small QR on the TV to watch, and ask to take over a computer player\u2019s seat.',
      'Three game lengths: Regular (nothing pre-dealt), Medium (some deeds dealt, 45 min) and Quick (every deed dealt, 30 min).',
      'Needs an internet connection for phones to join (the TV and phones should share the same Wi-Fi).',
      'Early test: placeholder art, and some character perks are still marked coming soon.'
    ],
    versions: [
      {
        id: 'v0.1.2',
        name: 'Projector night fixes',
        current: true,
        play: 'games/red-deer-rich/index.html',
        notes: 'Fixes from the first Chromecast and projector night: a much bigger, high-contrast watch QR in the corner that scans off a blurry wall projector, a sound engine rebuild that stops the "chunky blips" on slow TV sticks, a New Game button on the host phone (with an are-you-sure) that takes everyone back to setup without recasting, and the host phone no longer moves to someone else when the game starts.'
      },
      {
        id: 'v0.1.1',
        name: 'Auctions + living city',
        current: false,
        play: 'games/red-deer-rich/v0.1.1/index.html',
        notes: 'Auctions on every passed deed (bid from any phone), Regular / Medium / Quick game lengths, AI players can fill empty seats mid-game, owner-colour tiles that drift slowly after private deals, a 3 s PASS DICE lock, a follow camera, tumbling dice, bigger tile names, a sun and moon arc, a first-pass mini city in the middle of the board, a zoomable phone board with player dots, AI stand-ins you can take back by rejoining, Leave Game (hand your seat to an AI, split your stuff, give it to one player or throw it in the pot), an Observer mode from a small QR on the TV (watch, then ask to take over an AI seat), an end-of-game podium with fun titles, fireworks and a Hue celebration, and phone play on older Samsung TV browsers.'
      },
      {
        id: 'v0.1',
        name: 'First playable',
        play: 'games/red-deer-rich/v0.1/index.html',
        notes: 'Present Day board, dice, buying, rent with the PAY UP race, Shops and Mega-Plexes, hocking, the Snowbank, bankruptcy, trades and chat on phones, AI players, house rules, Full or Quick mode. Placeholder art.'
      }
    ]
  },
  {
    id: 'laser-range',
    title: 'Laser Range',
    pitch: 'Point your phone at the TV like a light gun. Pop cartoon targets, blow up barrels and don\u2019t shoot granny. 1 to 4 players, 90-second rounds.',
    cover: 'assets/img/laser-range/cover-card.webp',
    coverAlt: 'Laser Range on the TV: a desert shooting gallery with barrels, crates and brick walls, a pop-up target and a red crosshair firing a laser',
    details: 'games/laser-range.html',
    status: 'Early test',
    tags: ['1\u20134 players', 'TV + phones', 'Motion aiming'],
    accent: '#ff4fd8',
    sections: ['family'],
    intensity: 3,
    goodToKnow: [
      'Cartoon shooting gallery: round targets and silly bandits pop up from behind cover. Nothing gets hurt; targets just flip over.',
      'There is a granny cut-out you should NOT shoot (it costs points).',
      'Red barrels explode with a flash, a boom and a little screen shake (switched off in low-detail mode).',
      'Aim by pointing your phone at the TV (motion sensor). iPhones ask for permission first. No sensor? Drag on the touchpad instead.',
      'A quick 5-point calibration before you play: point at each target and tap. Re-centre any time if the cursor drifts.',
      'Needs an internet connection for phones to join (the TV and phones should share the same Wi-Fi).',
      'Optional: works with the Zombie Tiles Lights Helper to flash Hue lights when barrels explode.',
      'Laser zaps, pops and booms. Press M on the TV to mute.',
      'Early test: placeholder art, and motion aiming has not been tried on many real phones yet.'
    ],
    versions: [
      {
        id: 'v0.1',
        name: 'First test',
        current: true,
        play: 'games/laser-range/index.html',
        notes: 'Motion aiming with 5-point calibration and Re-centre, a touchpad fallback, a 90-second shooting gallery with pop-up targets, a rail of ducks and gold runners, exploding barrels with chain reactions, a charge-cannon balloon power-up, swipe blasts, scores, awards and a results screen. Auto low detail for Chromecast. Placeholder art.'
      }
    ]
  }
];
