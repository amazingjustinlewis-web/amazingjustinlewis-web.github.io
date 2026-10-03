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
      'Each phone shows its own hearts and ammo, so a little secrecy is part of the fun.',
      'Simple bleeps and boops from the TV: press M to mute.',
      'Needs an internet connection for phones to join (the TV and phones should share the same Wi-Fi). No phones? Play hot-seat on one screen.',
      'Optional Philips Hue lights: short colour flickers plus red and gold flashes in fights and escapes. Leave them off if anyone is sensitive to flashing lights.'
    ],
    versions: [
      {
        id: 'v0.2',
        name: 'Lights On',
        current: true,
        play: 'games/zombie-tiles/index.html',
        notes: 'Same game as v0.1, plus optional Philips Hue lights that react to turns, dice, fights and escapes (needs the Lights Helper on a PC).'
      },
      {
        id: 'v0.1',
        name: 'First playable',
        current: false,
        play: 'games/zombie-tiles/v0.1/index.html',
        notes: 'Working title. Open it on a TV or big screen; phones join with the QR code. Hot-seat on one screen works too.'
      }
    ]
  }
];
