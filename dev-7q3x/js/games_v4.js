/* Dev launcher catalogue v4 (b=13): loads after games_v2.js; Dev tools entries (AI playtest panel v0.2). Replaces games_v3.js in index.html.
   Landscape deck: a normal tile (opens in its own tab). Portrait grid: a "Dev tools" folder at the end. */
(function () {
  window.DEV_GAMES.push({ id: 'aipanel', name: 'AI playtest panel', ver: 'v0.2', url: 'sim/panel_v02.html', img: 'sim/shot.jpg', tag: 'Dev tool \u00b7 1-8 AI phones play Red Deer Rich \u00b7 take a seat yourself \u00b7 double-tap to zoom', mode: 'tab' });
  var f = { id: 'f-dev', name: 'Dev tools', icon: '\uD83E\uDDEA', items: ['aipanel'], end: true }, list = window.DEV_FOLDERS, i;
  for (i = 0; i < list.length; i++) if (list[i].id === 'f-studio') break;
  list.splice(i, 0, f);
})();
