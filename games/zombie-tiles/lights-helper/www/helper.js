/* Lights Helper page: joins the game room as a non-player "lights" peer and relays events to helper.py. */
(function () {
  'use strict';
  var C = window.ZT_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var Q = new URLSearchParams(location.search);
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var api = function (path, body) {
    return fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-ZT-Helper': '1' }, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  };
  var status = null, net = null, hostOnline = false, lastSentStatus = '', lastSentAt = 0, gameCfg = { enabled: false, selected: [] }, lostAt = 0, fxCfg = C.hue || {};
  var clientId = store.get('zt_lights_client') || ('L' + Math.random().toString(36).slice(2, 10));
  store.set('zt_lights_client', clientId);

  // ------------------------------------------------------------ status from helper.py
  function refresh() {
    return api('/api/status').then(function (s) { status = s; render(); sendStatus(false); }).catch(function () {
      $('bridgeLine').innerHTML = '<span class="bad">The helper program is not running.</span> Start it with start-lights-helper.bat.';
    });
  }
  function hostView() {
    var s = status || {};
    return { t: 'lights-status', ok: !!s.ok, paired: !!s.paired, reachable: !!s.reachable, mock: !!s.mock, error: s.error || '',
      bridge: s.bridge ? { name: s.bridge.name, model: s.bridge.model } : null, groups: s.groups || [], remembered: s.remembered || null,
      session: !!(s.engine && s.engine.session), pairing: s.pairing ? s.pairing.state : 'idle' };
  }
  function sendStatus(force) {
    if (!net || !hostOnline) return;
    var v = hostView(), js = JSON.stringify(v);
    if (!force && js === lastSentStatus && Date.now() - lastSentAt < 10000) return;
    lastSentStatus = js; lastSentAt = Date.now();
    net.send(v);
  }
  function render() {
    var s = status; if (!s) return;
    $('mockTag').hidden = !s.mock;
    var b = s.bridge || {};
    $('bridgeLine').innerHTML = s.reachable
      ? '<span class="ok">\u2714 ' + esc(b.name || 'Hue bridge') + '</span> at ' + esc(b.ip) + ' (' + esc(b.model || '') + ', API ' + esc(b.apiversion || '?') + ')' + (s.paired ? ' &middot; <span class="ok">paired</span>' : ' &middot; <span class="warnc">not paired</span>')
      : '<span class="bad">\u2716 ' + esc(s.error || 'Bridge not reachable') + '</span>';
    if (s.reachable && s.error) $('bridgeLine').innerHTML += '<br><span class="bad">' + esc(s.error) + '</span>';
    $('pairBox').hidden = !(s.reachable && !s.paired);
    $('mockLink').hidden = !s.mock;
    var pr = s.pairing || {};
    $('pairBtn').disabled = pr.state === 'waiting';
    $('pairMsg').innerHTML = pr.state === 'waiting' ? '<span class="warnc">' + esc(pr.message) + ' (' + Math.max(0, Math.round((pr.until || 0) - Date.now() / 1000)) + ' s left)</span>' : esc(pr.message || '');
    var eng = s.engine || {}, sel = eng.enabled ? (eng.selected || []) : [];
    $('groupsLine').innerHTML = s.groups && s.groups.length ? 'Rooms &amp; zones: <div class="chips">' + s.groups.map(function (g) {
      return '<span class="chip' + (sel.indexOf(g.id) !== -1 ? ' on' : '') + '">' + esc(g.name) + ' <small>(' + (g.type === 'Zone' ? 'zone, ' : '') + g.lights + ')</small></span>';
    }).join('') + '</div>' : '';
    var c = s.cast || {};
    $('castRow').hidden = !c.available; $('castDev').textContent = c.device || 'the TV';
    $('castBtn').disabled = c.state === 'quitting' || c.state === 'casting';
    $('castMsg').textContent = c.state && c.state !== 'idle' ? c.message : '';
    var e = s.engine || {};
    var names = (s.groups || []).filter(function (g) { return (e.selected || []).indexOf(g.id) !== -1; }).map(function (g) { return g.name; });
    $('useLine').innerHTML = !e.enabled ? 'Hue is <b>off</b> for the game. Turn it on from the host phone or the TV lobby ("Use Philips Hue lights?").'
      : '<span class="ok">Hue is ON</span> for: <b>' + esc(names.join(', ') || 'no rooms ticked') + '</b> (' + (e.lights || 0) + ' lights, ' + esc(e.mode || '') + ' commands)' +
        (e.session ? ' &middot; <span class="warnc">game lights active</span>' : ' &middot; waiting for the game to start') + (e.lastEvent ? ' &middot; last effect: ' + esc(e.lastEvent) : '');
    $('staleBtn').hidden = !e.staleSnapshot;
    $('log').textContent = (s.log || []).slice().reverse().join('\n');
  }

  // ------------------------------------------------------------ room connection
  function connLine(html) { $('connLine').innerHTML = html; }
  function connect(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    if (code.length !== 4) { connLine('<span class="bad">Type the 4-letter room code shown on the TV.</span>'); return; }
    $('code').value = code; store.set('zt_lights_room', code);
    hostOnline = false;
    if (net) { net.code = code; net.reconnect(); return; }
    net = new window.ZTNet.Client({
      code: code,
      onOpen: function () { net.send({ t: 'hello', role: 'lights', clientId: clientId }); },
      onMessage: onHost,
      onStatus: function (st) {
        if (st === 'online') return;               // wait for the welcome
        if (hostOnline) { hostOnline = false; lostAt = Date.now(); }
        var c = net ? net.code : code;
        connLine(st === 'noroom' ? 'Waiting for room <b>' + esc(c) + '</b> on the TV&hellip; (open the game on the TV, or check the code)' : 'Connecting to room <b>' + esc(c) + '</b>&hellip;');
      }
    });
  }
  function onHost(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'lights-welcome') {
      hostOnline = true; lostAt = 0;
      if (m.fx) { fxCfg = m.fx; api('/api/hostcfg', { fx: m.fx }); }
      connLine('<span class="ok">\u2714 Connected to room <b>' + esc(net.code) + '</b>.</span> The TV and the host phone can now offer Hue lights.');
      refresh().then(function () { sendStatus(true); });
      return;
    }
    if (m.t === 'reject') { connLine('<span class="bad">' + esc(m.reason) + '</span>'); return; }
    if (m.t === 'lights-config') {
      gameCfg = { enabled: !!m.enabled, selected: (m.selected || []).map(String) };
      api('/api/config', gameCfg).then(refresh);
      return;
    }
    if (m.t === 'lights-test') { api('/api/test', { groups: m.groups || [] }).then(refresh); return; }
    if (m.t === 'fx') { api('/api/fx', m).then(function () { setTimeout(refresh, 300); }); return; }
    if (m.t === 'lights-refresh') { api('/api/refresh', {}).then(function (s) { status = s; render(); sendStatus(true); }); return; }
  }

  // ------------------------------------------------------------ buttons
  $('connectBtn').onclick = function () { connect($('code').value); };
  $('code').addEventListener('keydown', function (e) { if (e.key === 'Enter') connect($('code').value); });
  $('code').addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('pairBtn').onclick = function () { api('/api/pair', { seconds: 60 }).then(refresh); };
  $('mockLink').onclick = function () { api('/api/mock-link', {}).then(refresh); };
  $('restoreBtn').onclick = function () { api('/api/restore', {}).then(refresh); };
  $('staleBtn').onclick = function () { api('/api/restore', { stale: true }).then(refresh); };
  $('castBtn').onclick = function () {
    var code = window.ZTNet.makeCode(), base = (status && status.gameUrl) || 'https://amazingjustinlewis-web.github.io/games/zombie-tiles/';
    api('/api/cast', { url: base + '?room=' + code }).then(refresh);
    connect(code);
  };

  // ------------------------------------------------------------ timers
  setInterval(function () {
    api('/api/ping', { hostOnline: hostOnline }).catch(function () {});
    refresh();
    // TV gone for a while during a game: put the lights back
    if (!hostOnline && lostAt && status && status.engine && status.engine.session && Date.now() - lostAt > (fxCfg.disconnectRestoreMs || 30000)) {
      lostAt = 0; api('/api/fx', { k: 'end', reason: 'TV disconnected' });
    }
  }, 3000);
  addEventListener('pagehide', function () { try { navigator.sendBeacon && fetch('/api/bye', { method: 'POST', keepalive: true, headers: { 'X-ZT-Helper': '1' } }); } catch (e) {} });

  refresh();
  var start = Q.get('room') || store.get('zt_lights_room');
  if (start) connect(start);
  window.ZTL = { connect: connect, status: function () { return status; }, net: function () { return net; }, hostOnline: function () { return hostOnline; } };
})();
