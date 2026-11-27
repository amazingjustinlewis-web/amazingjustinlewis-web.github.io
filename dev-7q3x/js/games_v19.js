/* Dev launcher catalogue v19: after games_v18 (Bubble Hockey, leave that catalogue alone).
   Red Deer Rich TV v0.7.13 — optional end-of-game post (prefilled initials, Skip,
   Auto-post preference, negative bust/ocean scores). Earlier TV pages are untouched. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrtv') {
      g.ver = 'v0.7.13';
      g.url = 'rdr-phone/index_v0713.html';
      if (g.modes && g.modes.match) g.modes.match.url = 'rdr-phone/index_v0713.html';
    }
  });
})();
