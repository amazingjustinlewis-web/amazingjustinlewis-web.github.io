/* Dev launcher catalogue v13: after games_v12. 0-Phi Room venue simulator v0.2,
   and Red Deer Rich TV v0.7.8b (v0.7.8 board + a sturdier phone link).
   v0.7.8 and v0.7.7 are left untouched. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'venue') {
      g.ver = 'v0.2';
      g.url = 'sim/venue_v02.html';
      g.img = 'sim/venue_v02_shot.jpg';
      g.tag = 'Dev tool \u00b7 patrons path around furniture \u00b7 animated band \u00b7 16:9 wall screen \u00b7 coat check + merch';
    }
    if (g.id === 'rdrtv') {
      g.ver = 'v0.7.8b';
      g.url = 'rdr-phone/index_v078b.html';
      g.tag = (g.tag || '') + ' \u00b7 Connecting\u2026 help after 6s \u00b7 STUN/TURN + cloud relay fallback';
      if (g.modes && g.modes.match) g.modes.match.url = 'rdr-phone/index_v078b.html';
    }
  });
})();
