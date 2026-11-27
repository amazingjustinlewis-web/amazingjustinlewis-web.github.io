/* Dev launcher catalogue patch (solo phone) v3: loads last, after games_solo_v2.
   Points the Red Deer Rich solo tile at solo v0.13. Does not overwrite earlier catalogues. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrsolo') {
      g.ver = 'solo v0.13';
      g.url = 'rdr-phone/solo_v13.html';
      g.img = 'rdr-phone/solo_v11_shot.png';
      g.tag = 'Solo vs AI, or host friends from this phone \u00b7 Join a TV \u00b7 QR + invite \u00b7 optional score post, ocean board';
      g.mode = 'tab';
      g.modes = {
        phone: { label: 'Play on this phone', url: 'rdr-phone/solo_v13.html' },
        match: { label: 'Start a match (TV/room)', url: 'rdr-phone/index_v0713.html' }
      };
    }
    if (g.id === 'rdrtv' && g.modes && g.modes.phone) {
      g.modes.phone.url = 'rdr-phone/solo_v13.html';
    }
  });
})();
