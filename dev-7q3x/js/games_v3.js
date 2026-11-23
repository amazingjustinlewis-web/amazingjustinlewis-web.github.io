/* Dev launcher catalogue v3 (b=12): loads after games_v2.js and adds the Dev tools entries.
   Landscape deck: a normal tile (opens in its own tab). Portrait grid: a "Dev tools" folder at the end. */
(function () {
  window.DEV_GAMES.push({ id: 'aipanel', name: 'AI playtest panel', ver: 'v0.1', url: 'sim/panel_v01.html', img: 'sim/shot.jpg', tag: 'Dev tool \u00b7 1-8 AI phones play Red Deer Rich side by side \u00b7 scan in and join them', mode: 'tab' });
  var f = { id: 'f-dev', name: 'Dev tools', icon: '\uD83E\uDDEA', items: ['aipanel'], end: true }, list = window.DEV_FOLDERS, i;
  for (i = 0; i < list.length; i++) if (list[i].id === 'f-studio') break;
  list.splice(i, 0, f);
})();
