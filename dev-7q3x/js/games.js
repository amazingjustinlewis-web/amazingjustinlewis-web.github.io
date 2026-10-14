/* Dev launcher catalogue. url is relative to /dev-7q3x/. mode: 'frame' (runs inside the launcher) or 'tab' (fallback: opens on its own). */
window.DEV_GAMES = [
  { id: 'zerostatic', name: 'Zero logo STATIC', ver: 'v0.1', url: 'zero/logo-static.html', img: 'zero/static-shot.png', tag: 'Thin crisp logo \u00b7 breathing QR', mode: 'tab' },
  { id: 'zerolive', name: 'Zero logo LIVE', ver: 'v0.1', url: 'zero/logo-live.html', img: 'zero/live-shot.png', tag: 'Procedural logo \u00b7 energy + strike \u00b7 QR', mode: 'tab' },
  { id: 'zerologo', name: 'Zero logo + QR', ver: 'v0.1', url: 'zero/logo.html', img: 'zero/logo-shot.png', tag: 'Logo pulse \u00b7 3 light modes', mode: 'tab' },
  { id: 'zeroqr', name: 'Zero QR test', ver: 'v0.1', url: 'zero-qr/index.html', img: 'zero-qr/shot.png', tag: 'Hidden QR \u00b7 5 contrast presets', mode: 'tab' },
  { id: 'zero', name: 'Zero front page (draft)', ver: 'v0.1', url: 'zero/index.html', img: 'zero/shot.png', tag: 'New 0\u2011Phi home \u00b7 draft', mode: 'tab' },
  { id: 'rdrphone', name: 'Red Deer Rich \u00b7 phone mode', ver: 'v0.9-dev', url: 'rdr-phone/phone.html', img: 'rdr-phone/shot.png', tag: 'Play on one phone \u00b7 friends join \u00b7 Move to TV', mode: 'tab' },
  { id: 'lostsock', name: 'Lost Sock', ver: 'v0.2', url: 'lostsock/index.html', img: 'lostsock/shot.png', tag: 'Sock artillery \u00b7 phones \u00b7 WIP' },
  { id: 'derby', name: 'Demolition Derby', ver: 'v0.1', url: 'derby/index.html', img: 'derby/shot.png', tag: 'Car smash \u00b7 phones \u00b7 WIP' },
  { id: 'rescue', name: 'Red Deer Rescue', ver: 'v0.1', url: '../games/rescue/index.html', img: '../games/rescue/shots/cover-card.webp', tag: 'Hero crawler \u00b7 phones vote' },
  { id: 'rdr', name: 'Red Deer Rich', ver: 'v0.8', url: '../games/red-deer-rich/index.html', img: '../assets/img/red-deer-rich/cover-card.webp', tag: 'Board game \u00b7 phones' },
  { id: 'walker', name: 'Walker', ver: 'v0.4', url: '../games/walker/index.html', img: '../assets/img/walker/cover-card.webp', tag: 'Calm play world' },
  { id: 'space', name: 'Drift Signal', ver: 'v0.4', url: '../games/space/index.html', img: '../assets/img/space/cover-card.webp', tag: 'Space crew' },
  { id: 'mech', name: 'Iron Stride', ver: 'v0.4', url: '../games/mech/index.html', img: '../assets/img/mech/cover-card.webp', tag: 'Mech \u00b7 gyro aim' },
  { id: 'zt', name: 'Zombie Tiles', ver: 'v0.5', url: '../games/zombie-tiles/index.html', img: '../assets/img/zombie-tiles/cover-card.webp', tag: 'Tile game \u00b7 phones' },
  { id: 'laser', name: 'Laser Range', ver: 'v0.1', url: '../games/laser-range/index.html', img: '../assets/img/laser-range/cover-card.webp', tag: 'Gyro aim' },
  { id: 'hop', name: 'Charge Hop', ver: 'v0.3', url: '../games/charge-hop/index.html', img: '../assets/img/charge-hop/cover-card.webp', tag: 'Keyboard \u00b7 laptop', escTwice: true },
  { id: 'cafe', name: 'Caf\u00e9 demo screen', ver: 'v0.1', url: '../cafe/screen.html?demo=1', img: '../cafe/shots/01-screen-idle-welcome.png', tag: 'The Daily Grind' }
];
window.DEV_OLD = [
  ['walker', 'Walker', ['v0.3', 'v0.2', 'v0.1']],
  ['red-deer-rich', 'Red Deer Rich', ['v0.8', 'v0.6', 'v0.5', 'v0.4', 'v0.3', 'v0.2.1', 'v0.2', 'v0.1.2', 'v0.1.1', 'v0.1']],
  ['space', 'Drift Signal', ['v0.2', 'v0.1']],
  ['mech', 'Iron Stride', ['v0.2', 'v0.1']],
  ['zombie-tiles', 'Zombie Tiles', ['v0.4', 'v0.3', 'v0.2', 'v0.1']]
].reduce(function (a, g) {
  var img = { 'red-deer-rich': 'red-deer-rich', 'zombie-tiles': 'zombie-tiles' }[g[0]] || g[0];
  g[2].forEach(function (v) { a.push({ id: g[0] + '-' + v, name: g[1], ver: v, url: '../games/' + g[0] + '/' + v + '/index.html', img: '../assets/img/' + img + '/cover-card.webp', tag: 'Older version', old: true }); });
  return a;
}, []);
