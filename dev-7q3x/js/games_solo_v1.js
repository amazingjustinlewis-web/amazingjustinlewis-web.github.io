/* Dev launcher catalogue patch (solo phone): loads last. Points the Red Deer Rich solo tile at the newest solo page.
   (games_v5.js pins rdrsolo to v0.5, so the solo tile is set here, after every other catalogue.) Does not overwrite earlier catalogues. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrsolo') {
      g.ver = 'solo v0.11';
      g.url = 'rdr-phone/solo_v11.html';
      g.img = 'rdr-phone/solo_v11_shot.png';
      g.tag = 'Solo vs AI, or host friends from this phone \u00b7 Join a TV \u00b7 QR + invite \u00b7 shorter auction clock';
      g.mode = 'tab';
      g.modes = {
        phone: { label: 'Play on this phone', url: 'rdr-phone/solo_v11.html' },
        match: { label: 'Start a match (TV/room)', url: 'rdr-phone/index_v078.html' }
      };
    }
    if (g.id === 'rdrphone') {
      g.modes = g.modes || {
        phone: { label: 'Play on this phone', url: g.url },
        match: { label: 'Start a match (TV/room)', url: 'rdr-phone/index_v078.html' }
      };
    }
  });
})();
