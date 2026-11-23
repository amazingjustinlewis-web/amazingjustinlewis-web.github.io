/* TV v0.7.8: publish this room to the open-games list so a scanned QR can see if a seat is open. */
(function (w) {
  'use strict';
  function rec() {
    var g = w.RDR && RDR.game, net = w.RDR && (typeof RDR.net === 'function' ? RDR.net() : RDR.net);
    if (!net || !net.code) return null;
    var C = w.RDR_CONFIG || { maxPlayers: 8 };
    var nAll = g ? g.players.length : 0, nHuman = g ? g.players.filter(function (p) { return !p.ai; }).length : 0;
    var open = Math.max(0, (C.maxPlayers || 8) - nAll);
    if (g && g.phase === 'play') open = g.players.filter(function (p) { return p.ai && !p.bankrupt; }).length;
    var ctrl = w.RDR_CONTROLLER || 'controller_v077.html';
    var dir = location.href.replace(/[^/]*([?#].*)?$/, '');
    var loc = /[?&]local=1/.test(location.search) ? '&local=1' : '';
    return {
      game: 'rdr', title: 'Red Deer Rich', room: net.code, status: net.status,
      phase: g ? g.phase : 'lobby', players: nHuman, seats: nAll, open: open,
      join: dir + ctrl + '?room=' + net.code + loc + '&inv=1&auto=1',
      openPage: dir + '../open/index_v01.html?game=rdr&room=' + net.code + '&join=' + encodeURIComponent('../rdr-phone/' + ctrl) + '&tv=' + encodeURIComponent('../rdr-phone/index_v078.html') + loc,
      host: 'tv', local: /[?&]local=1/.test(location.search), at: Date.now()
    };
  }
  function pub() {
    if (!w.ZTPOpenGames || !ZTPOpenGames.publish) return;
    var r = rec(); if (r) ZTPOpenGames.publish(r);
  }
  setInterval(pub, 2500);
  setTimeout(pub, 600);
})(window);
