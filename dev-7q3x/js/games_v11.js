/* Dev launcher catalogue v11: after games_v10. Official Red Deer Rich TV board v0.7.7 and AI playtest panel v0.5. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrtv') {
      g.ver = 'v0.7.7';
      g.url = 'rdr-phone/index_v077.html';
      g.tag = 'TV board + phones \u00b7 sidebar fix \u00b7 shake dice half-size then grow \u00b7 PiP follow \u00b7 phone run strip \u00b7 recap vote';
    }
    if (g.id === 'aipanel') {
      g.ver = 'v0.5';
      g.url = 'sim/panel_v05.html';
      g.tag = 'Dev tool \u00b7 1-8 AI phones play Red Deer Rich \u00b7 points at TV v0.7.7 \u00b7 readable TV scores \u00b7 next-game queue';
    }
  });
})();
