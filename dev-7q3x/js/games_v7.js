/* Dev launcher catalogue v7 (b=16): after games_v6. AI playtest panel v0.3, and the TV board on v0.7.4
   (v0.7.3 + the explore-after-pick phone controller_v074). */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'aipanel') { g.ver = 'v0.3'; g.url = 'sim/panel_v03.html'; g.tag = 'Dev tool \u00b7 1-8 AI phones play Red Deer Rich \u00b7 phone sounds \u00b7 curious AIs \u00b7 host + pace \u00b7 TV breakout'; }
    if (g.id === 'rdrtv') { g.ver = 'v0.7.4'; g.url = 'rdr-phone/index_v074.html'; g.tag = 'TV board + phones \u00b7 invite \u00b7 recap \u00b7 browse after you pick'; }
  });
})();
