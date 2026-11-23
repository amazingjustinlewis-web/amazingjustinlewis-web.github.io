/* Dev launcher catalogue v9: after games_v8. Official Red Deer Rich TV board v0.7.6 and AI playtest panel v0.4. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrtv') {
      g.ver = 'v0.7.6';
      g.url = 'rdr-phone/index_v076.html';
      g.tag = 'TV board + phones \u00b7 lobby zoom \u00b7 dice handoff \u00b7 selfie heads \u00b7 recap montage \u00b7 turn ping \u00b7 extra screens \u00b7 queue';
    }
    if (g.id === 'aipanel') {
      g.ver = 'v0.4';
      g.url = 'sim/panel_v04.html';
      g.tag = 'Dev tool \u00b7 1-8 AI phones play Red Deer Rich \u00b7 readable TV scores \u00b7 next-game queue \u00b7 local/TV vote';
    }
  });
})();
