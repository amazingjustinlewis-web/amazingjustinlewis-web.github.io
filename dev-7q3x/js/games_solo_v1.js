/* Dev launcher catalogue patch (solo phone): loads last. Points the Red Deer Rich solo tile at the newest solo page.
   (games_v5.js pins rdrsolo to v0.5, so the solo tile is set here, after every other catalogue.) Does not overwrite earlier catalogues. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrsolo') {
      g.ver = 'solo v0.10';
      g.url = 'rdr-phone/solo_v10.html';
      g.img = 'rdr-phone/solo_v10_shot.png';
      g.tag = 'Solo vs 1-3 AI · cards rise out of the board space, centre replays no longer dim the board';
      g.mode = 'tab';
    }
  });
})();
