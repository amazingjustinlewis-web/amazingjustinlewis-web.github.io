/* Dev launcher catalogue v6: after games_v5. Points the dev Red Deer Rich TV board at the recap-booth build. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrtv') { g.ver = 'v0.7.3'; g.url = 'rdr-phone/index_v073.html'; g.tag = 'TV board + phones \u00b7 invite a friend \u00b7 recap show'; }
  });
})();
