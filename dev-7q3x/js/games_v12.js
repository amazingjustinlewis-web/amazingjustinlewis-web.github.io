/* Dev launcher catalogue v12: after games_v11. Official Red Deer Rich TV board v0.7.8.
   Also documents the generic `modes` field used by launcher_portrait_v2.js:
   modes: { phone: { label, url }, match: { label, url } }
   Tiles with both modes show "Play on this phone" and "Start a match (TV/room)" underneath. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrtv') {
      g.ver = 'v0.7.8';
      g.url = 'rdr-phone/index_v078.html';
      g.tag = 'TV board + phones \u00b7 auction clock matches solo (~3.3s ease-in) \u00b7 heads glance at smacks, runners and trades';
      g.modes = {
        phone: { label: 'Play on this phone', url: 'rdr-phone/solo_v11.html' },
        match: { label: 'Start a match (TV/room)', url: 'rdr-phone/index_v078.html' }
      };
    }
    if (g.id === 'aipanel') {
      g.tag = (g.tag || '').replace('TV v0.7.7', 'TV v0.7.8');
    }
  });
})();
