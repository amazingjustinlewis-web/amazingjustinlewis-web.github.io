/* Dev launcher catalogue v10 (b=21): after games_v9. Adds the 0-Phi Room venue simulator v0.1
   to Dev tools, next to the AI playtest panel. */
(function () {
  window.DEV_GAMES.push({
    id: 'venue',
    name: '0-Phi Room',
    ver: 'v0.1',
    url: 'sim/venue_v01.html',
    img: 'sim/venue_shot.jpg',
    tag: 'Dev tool \u00b7 bar / hangout venue sim \u00b7 live Red Deer Rich TV \u00b7 GyroForge pod \u00b7 original band \u00b7 drop in',
    mode: 'tab'
  });
  (window.DEV_FOLDERS || []).forEach(function (f) {
    if (f.id === 'f-dev' && f.items.indexOf('venue') < 0) f.items.push('venue');
  });
})();
