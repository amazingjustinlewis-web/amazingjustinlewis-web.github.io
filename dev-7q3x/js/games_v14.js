/* Dev launcher catalogue v14: after games_v13. Red Deer Rich TV v0.7.9
   (v0.7.8b board + phone-controller "Add selfie" bobblehead flow).
   v0.7.8, v0.7.8b and controller_v078b are left untouched. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrtv') {
      g.ver = 'v0.7.9';
      g.url = 'rdr-phone/index_v079.html';
      g.tag = (g.tag || '') + ' \u00b7 Add selfie on the phone \u00b7 bobblehead with blinks and glances';
      if (g.modes && g.modes.match) g.modes.match.url = 'rdr-phone/index_v079.html';
    }
  });
})();
