/* Dev launcher catalogue v5: loads after games_v2.js (and v4 if present).
   Points multiplayer tiles at invite-enabled versioned pages. Does not overwrite earlier catalogues. */
(function () {
  var patch = {
    rdrsolo: { ver: 'solo v0.5', url: 'rdr-phone/solo_v05.html', tag: 'Solo vs 1-3 AI \u00b7 invite a friend / play on a TV \u00b7 rename on your card \u00b7 PERFECT smack combo' },
    rdrphone: { url: 'rdr-phone/phone_v01.html' },
    rdr: { url: 'red-deer-rich/index_v01.html' },
    hoptop: { url: 'hoptop/index_v01.html' },
    broadside: { url: 'broadside/index_v01.html' },
    swish: { url: 'swish/index_v01.html' },
    dunk: { url: 'dunk/index_v01.html' },
    puck: { url: 'puck/index_v01.html' },
    stack: { url: 'stack/index_v01.html' },
    buddy: { url: 'buddy/index_v01.html' },
    marble: { url: 'marble/index_v01.html' },
    stunt: { url: 'stunt/index_v01.html' },
    foosball: { url: 'foosball/index_v01.html' },
    rts: { url: 'rts/index_v01.html' },
    lostsock: { url: 'lostsock/index_v01.html' },
    derby: { url: 'derby/index_v01.html' },
    mechsquad: { url: 'mech-squad/index_v01.html' },
    mechopen: { url: 'mech-open/index_v01.html' },
    rescue: { url: 'rescue/index_v01.html' },
    walker: { url: 'walker/index_v01.html' },
    space: { url: 'space/index_v01.html' },
    mech: { url: 'mech/index_v01.html' },
    zt: { url: 'zombie-tiles/index_v01.html' },
    laser: { url: 'laser-range/index_v01.html' }
  };
  (window.DEV_GAMES || []).forEach(function (g) {
    if (patch[g.id]) Object.assign(g, patch[g.id]);
  });
  if (window.DEV_GAMES && !DEV_GAMES.some(function (g) { return g.id === 'rdrtv'; })) {
    DEV_GAMES.push({ id: 'rdrtv', fname: 'Red Deer Rich \u00b7 TV board (dev)', name: 'Red Deer Rich', ver: 'v0.7.2', url: 'rdr-phone/index_v072.html', img: 'rdr-phone/shot.png', tag: 'TV board + phones \u00b7 invite a friend', mode: 'tab' });
    var f = (window.DEV_FOLDERS || []).filter(function (x) { return x.id === 'f-rdr'; })[0];
    if (f && f.items.indexOf('rdrtv') < 0) f.items.splice(2, 0, 'rdrtv');
  }
})();
