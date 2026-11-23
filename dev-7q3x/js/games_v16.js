/* Dev launcher catalogue v16: after games_v15. Red Deer Rich TV v0.7.10
   (playtest stall, selfie disc, off-edge pointers, prompt, away label, faster
   join/relay, smack lag, snowbank, plus a latency test room). v0.7.9 and
   earlier, and the venue v0.3 catalogue in games_v15, are left untouched. */
(function () {
  (window.DEV_GAMES || []).forEach(function (g) {
    if (g.id === 'rdrtv') {
      g.ver = 'v0.7.10';
      g.url = 'rdr-phone/index_v0710.html';
      if (g.modes && g.modes.match) g.modes.match.url = 'rdr-phone/index_v0710.html';
    }
  });
  var list = window.DEV_GAMES || (window.DEV_GAMES = []);
  var has = list.some(function (g) { return g.id === 'rdrlat'; });
  if (!has) {
    list.push({
      id: 'rdrlat',
      fname: 'RDR latency room',
      name: 'RDR latency room',
      ver: 'v0.1',
      url: 'latency/index_v01.html',
      img: 'rdr-phone/shot.png',
      tag: 'Dev tool \u00b7 TV + phone tap or shake on GO \u00b7 RTT, one-way delay, jitter, transport',
      mode: 'tab'
    });
  }
})();
