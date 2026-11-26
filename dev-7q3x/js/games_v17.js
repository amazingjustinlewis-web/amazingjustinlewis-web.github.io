/* Dev launcher catalogue v17: after games_v16. Red Deer Rich TV v0.7.11
   (end-of-game prompt on the phone: Exit / Leave arcade initials / Make a profile).
   v0.7.10 and earlier are left untouched. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrtv') {
      g.ver = 'v0.7.11';
      g.url = 'rdr-phone/index_v0711.html';
      if (g.modes && g.modes.match) g.modes.match.url = 'rdr-phone/index_v0711.html';
    }
  });
})();
