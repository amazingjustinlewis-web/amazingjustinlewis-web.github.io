/* Dev launcher catalogue v15: after games_v14. 0-Phi Room venue simulator v0.3
   (living patrons, servers, band breaks). v0.2 is left untouched. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'venue') {
      g.ver = 'v0.3';
      g.url = 'sim/venue_v03.html';
      g.img = 'sim/venue_v03_shot.jpg';
      g.tag = 'Dev tool \u00b7 living patrons \u00b7 servers run drinks and food \u00b7 band takes breaks \u00b7 coat check to last call';
    }
  });
})();
