/* =====================================================================
   GAMES LIST  -  add a game = add one object to this array.
   ---------------------------------------------------------------------
   The home page grid is rendered from this list (see assets/js/site.js).
   All paths are RELATIVE TO THE SITE ROOT (no leading slash), so the
   site works on username.github.io/repo/ today and on a .com later.

   Fields
     id       short unique slug, e.g. 'charge-hop'
     title    game name shown on the card
     pitch    one-line pitch (keep it short and punchy)
     cover    card image, 16:9 (~640x360 .webp works great)
     coverAlt description of the cover image for screen readers
     play     path to the playable game's index.html
     details  path to the game's details page
     status   small badge text, e.g. 'Early prototype', 'New!', 'v1.0'
     tags     a few short labels (players, controls, genre...)
     accent   optional card colour (any CSS colour)
   ===================================================================== */
window.GAMES = [
  {
    id: 'charge-hop',
    title: 'Charge Hop',
    pitch: 'One button. Charge it. Don\u2019t blow it. A frantic hop-and-launch race for 1\u20132 players.',
    cover: 'assets/img/charge-hop/cover-card.webp',
    coverAlt: 'Charge Hop title screen with the yellow toy robot and orange robot dog',
    play: 'games/charge-hop/index.html',
    details: 'games/charge-hop.html',
    status: 'Early prototype',
    tags: ['1\u20132 players', 'Keyboard', 'Browser'],
    accent: '#FFD700'
  }

  // Next game goes here, e.g.
  // ,{
  //   id: 'my-next-game',
  //   title: 'My Next Game',
  //   pitch: 'One line that makes people want to click Play.',
  //   cover: 'assets/img/my-next-game/cover-card.webp',
  //   coverAlt: 'What the cover shows',
  //   play: 'games/my-next-game/index.html',
  //   details: 'games/my-next-game.html',
  //   status: 'New!',
  //   tags: ['1 player', 'Mouse'],
  //   accent: '#00F0FF'
  // }
];
