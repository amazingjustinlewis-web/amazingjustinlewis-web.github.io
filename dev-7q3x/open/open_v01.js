/* Open-games join router v0.1: scanning a Zero to Phi QR lands here.
   If a seat is open, drop straight into the controller. Otherwise show queue / new lobby / browse, plus a studio link. */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var room = String(Q.get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  var game = Q.get('game') || 'rdr';
  var join = Q.get('join') || '../rdr-phone/controller_v077.html';
  var tv = Q.get('tv') || '../rdr-phone/index_v078.html';
  var local = /[?&]local=1/.test(location.search);
  var $ = function (id) { return document.getElementById(id); };
  var studio = (window.ZTPOpenGames && ZTPOpenGames.studioUrl()) || '../../family.html';
  $('studioLink').href = studio;

  function locQ(u) {
    if (!local) return u;
    return u + (u.indexOf('?') >= 0 ? '&' : '?') + 'local=1';
  }
  function goJoin(auto) {
    var u = locQ(join + (join.indexOf('?') >= 0 ? '&' : '?') + 'room=' + encodeURIComponent(room) + (auto ? '&auto=1&inv=1' : ''));
    location.replace(u);
  }
  function show(id) {
    $('choices').hidden = id !== 'choices';
    $('queueBox').hidden = id !== 'queue';
  }
  function setStatus(t) { $('status').textContent = t; }

  function paintList(list) {
    var box = $('openRows'), wrap = $('openList');
    var rows = (list || []).filter(function (r) { return r.room && r.room !== room; });
    if (!rows.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    box.innerHTML = rows.map(function (r) {
      var href = 'index_v01.html?game=' + encodeURIComponent(r.game || 'rdr') + '&room=' + encodeURIComponent(r.room) +
        (r.join ? '&join=' + encodeURIComponent(r.join) : '') + (local ? '&local=1' : '');
      return '<a class="row" href="' + href + '"><b>' + (r.title || r.game) + '</b> · room ' + r.room +
        '<div class="mut">' + (r.open > 0 ? r.open + ' seat' + (r.open === 1 ? '' : 's') + ' open' : 'full · you can queue') +
        (r.phase ? ' · ' + r.phase : '') + '</div></a>';
    }).join('');
  }
  if (window.ZTPOpenGames) ZTPOpenGames.watch(paintList);

  function openChoices(why) {
    show('choices');
    var full = /full|observer|no open|not open/i.test(why || '');
    $('choiceH').textContent = full ? 'That game is full' : 'Could not jump in';
    var raw = String(why || '');
    var nice = /no-room/.test(raw) ? 'This link has no room code.'
      : /timeout|noroom|unavailable|closed|no-net|no-probe|connect/.test(raw) ? 'That room did not answer.'
      : /full|observer/.test(raw) ? ''
      : raw;
    $('choiceP').textContent = full
      ? 'A seat is not open right now. Queue for the next game, start a new lobby, or browse what’s on.'
      : (nice ? nice + ' ' : '') + 'You can start a new lobby or browse the games.';
    setStatus(room ? ('Room ' + room + (full ? ' is full.' : ' was not ready.')) : 'This link has no room code. Browse the games or open the studio page.');
  }

  $('btnQueue').onclick = function () {
    show('queue');
    setStatus('Queued for room ' + room + '. Keep this page open.');
    try { sessionStorage.setItem('ztp-queue', JSON.stringify({ game: game, room: room, at: Date.now() })); } catch (e) {}
    /* If we can still reach the host, try the existing TV queue protocol. */
    if (window.RDRNet && room) {
      var o = { code: room, onOpen: function () { try { qnet.send({ t: 'queueJoin', name: 'Guest', cid: 'q-' + Date.now() }); } catch (e) {} },
        onMessage: function (m) {
          if (!m) return;
          if (m.t === 'queueGo' && m.url) location.href = locQ(m.url);
          if (m.t === 'welcome' && !m.observer) goJoin(true);
        } };
      var qnet = local ? new RDRNet.LocalClient(o) : new RDRNet.Client(o);
      $('btnQueueLeave').onclick = function () {
        try { qnet.send({ t: 'queueLeave' }); qnet.destroy(); } catch (e) {}
        try { sessionStorage.removeItem('ztp-queue'); } catch (e2) {}
        show('choices'); setStatus('Left the queue.');
      };
    }
  };
  $('btnLobby').onclick = function () { location.href = locQ(tv + (tv.indexOf('?') >= 0 ? '&' : '?') + 'room=' + (room || '')); };
  $('btnOther').onclick = function () { location.href = studio; };
  $('btnBrowse').onclick = function () { location.href = '../index.html'; };

  if (!room) { openChoices('no-room'); setStatus('This link has no room code. Browse the games or open the studio page.'); return; }
  setStatus('Room ' + room + ': checking for an open seat…');
  if (!window.ZTPOpenGames || !ZTPOpenGames.probeRdr) { openChoices('no-probe'); return; }
  ZTPOpenGames.probeRdr({ room: room, local: local, name: 'Guest' }).then(function (r) {
    if (r && r.ok && r.seat) { setStatus('Seat open. Jumping in…'); goJoin(true); return; }
    if (r && r.ok && r.observer) { openChoices('observer'); return; }
    openChoices((r && (r.reason || r.full && 'full')) || 'unavailable');
  });
})();
