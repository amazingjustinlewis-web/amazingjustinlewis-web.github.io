/* Lights Helper page (v0.2.1).
   helper.py decides which open page holds the room link ("connector"): normally a hidden background Edge/Chrome
   started by helper.py (?relay=1). Only the connector joins the TV room as the non-player "lights" peer and relays
   game events to helper.py. Visible pages (any browser) are the control panel. */
(function () {
  'use strict';
  var C = window.ZT_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var Q = new URLSearchParams(location.search);
  var RELAY = Q.get('relay') === '1';
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  var api = function (path, body) {
    return fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-ZT-Helper': '1' }, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  };
  var status = null, net = null, hostOnline = false, lastSentStatus = '', lastSentAt = 0, lostAt = 0, fxCfg = C.hue || {};
  var isConnector = false, onlineAt = 0, lastDetail = '', prefsTouched = 0, groupsKey = '';
  var pageId = (RELAY ? 'R' : 'U') + Math.random().toString(36).slice(2, 10);
  var clientId = store.get('zt_lights_client') || ('L' + Math.random().toString(36).slice(2, 10));
  store.set('zt_lights_client', clientId);
  if (RELAY) document.title = 'Lights Helper (background link)';

  // ------------------------------------------------------------ status from helper.py
  function refresh() {
    return api('/api/status').then(function (s) { status = s; render(); sendStatus(false); }).catch(function () {
      $('bridgeLine').innerHTML = '<span class="bad">The helper program is not running.</span> Start it with "Start Lights Helper.bat".';
      $('connLine').innerHTML = '<span class="bad">Not connected (helper program not running).</span>';
    });
  }
  function hostView() {
    var s = status || {};
    return { t: 'lights-status', ok: !!s.ok, paired: !!s.paired, reachable: !!s.reachable, mock: !!s.mock, error: s.error || '',
      bridge: s.bridge ? { name: s.bridge.name, model: s.bridge.model } : null, groups: s.groups || [], remembered: s.remembered || null,
      prefs: s.prefs || null, session: !!(s.engine && s.engine.session), pairing: s.pairing ? s.pairing.state : 'idle' };
  }
  function sendStatus(force) {
    if (!net || !hostOnline) return;
    var v = hostView(), js = JSON.stringify(v);
    if (!force && js === lastSentStatus && Date.now() - lastSentAt < 10000) return;
    lastSentStatus = js; lastSentAt = Date.now();
    net.send(v);
  }
  function roomText(s) {
    var r = s.room || {}, rl = s.relay || {}, via = r.by ? ' via ' + esc(r.by) : '';
    var pages = s.pages || [], conn = pages.filter(function (p) { return p.connector; })[0];
    if (!r.want) return 'Not connected yet. Click <b>Open the game on the TV</b>, or type the room code shown on the TV and click <b>Connect</b>.';
    var code = '<b>' + esc(r.want) + '</b>';
    if (!conn || r.state === 'nolink') return '<span class="warnc">Room ' + code + ': waiting for the background browser (or an open Edge/Chrome helper page) to take the link&hellip;</span>' + (rl.error ? '<br><span class="bad">' + esc(rl.error) + '</span>' : '');
    if (r.state === 'welcomed') return '<span class="ok">\u2714 Connected to room ' + code + '</span>' + via + '. The TV and the host phone can now offer Hue lights.';
    if (r.state === 'noroom') return 'Waiting for room ' + code + ' on the TV&hellip; (is the game open on the TV? does the code match?)' + via;
    var t = 'Connecting to room ' + code + via + '&hellip; ' + (r.age || 0) + ' s' + (r.ice ? ' (network check: ' + esc(r.ice) + ')' : '');
    if ((r.age || 0) > 20 && conn.browser === 'Firefox') t += '<br><span class="warnc">Firefox often can\'t reach the Chromecast. Open <b>http://127.0.0.1:' + esc(location.port) + '/</b> in Microsoft Edge or Chrome instead.</span>';
    else if ((r.age || 0) > 30) t += '<br><span class="small">Still trying. If the TV shows a different code, type that code and click Connect.</span>';
    return t;
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
    if (s.room && s.room.want && document.activeElement !== $('code') && !$('code').value) $('code').value = s.room.want;
    $('connLine').innerHTML = roomText(s);
    var rl = s.relay || {};
    $('diagLine').innerHTML = 'Background link: ' + (rl.mode === 'off' ? 'off (this tab connects)' : rl.running ? '<span class="ok">running</span> (' + esc(rl.browser) + ')' : '<span class="warnc">not running</span>' + (rl.error ? ' - ' + esc(rl.error) : '')) +
      ' &middot; open pages: ' + ((s.pages || []).map(function (p) { return esc(p.browser) + (p.connector ? ' (linked)' : ''); }).join(', ') || 'none');
    $('foot').textContent = rl.running ? 'This page is only a control panel: you can close it. The helper keeps the TV connection in a hidden background browser while its black window is open. Close the helper window to stop; lights are put back first.'
      : 'Keep this tab open while you play (it can be in the background). Close the helper window to stop; lights are put back first.';
    renderPrefs(s);
    var e = s.engine || {};
    var names = (s.groups || []).filter(function (g) { return (e.selected || []).indexOf(g.id) !== -1; }).map(function (g) { return g.name; });
    $('useLine').innerHTML = !s.paired ? 'Pair with the bridge first (section 1).'
      : !e.enabled ? 'Hue is <b>off</b> for the game. Tick <b>Use lights</b> and some rooms below (or choose on the host phone / TV lobby).'
      : !names.length ? '<span class="warnc">Hue is on, but no rooms are ticked.</span>'
      : '<span class="ok">Hue is ON</span> for: <b>' + esc(names.join(', ')) + '</b> (' + (e.lights || 0) + ' lights, ' + esc(e.mode || '') + ' commands)' +
        (e.session ? ' &middot; <span class="warnc">game lights active</span>' : (s.room && s.room.welcomed ? ' &middot; waiting for the game to start' : ' &middot; <span class="warnc">waiting for the TV connection</span>')) + (e.lastEvent ? ' &middot; last effect: ' + esc(e.lastEvent) : '');
    $('staleBtn').hidden = !e.staleSnapshot;
    $('log').textContent = (s.log || []).slice().reverse().join('\n');
  }
  function renderPrefs(s) {
    var groups = s.groups || [], p = s.prefs || {};
    $('prefsBox').hidden = !(s.paired && groups.length);
    var key = groups.map(function (g) { return g.id + ':' + g.name; }).join('|');
    if (key !== groupsKey) {
      groupsKey = key;
      $('roomChecks').innerHTML = groups.map(function (g) {
        return '<label><input type="checkbox" data-g="' + esc(g.id) + '"> ' + esc(g.name) + ' <small>(' + (g.type === 'Zone' ? 'zone, ' : '') + g.lights + ')</small></label>';
      }).join('');
      prefsTouched = 0;
    }
    if (Date.now() - prefsTouched < 2500) return;          // don't fight the user's clicks
    $('useLights').checked = !!p.enabled;
    var sel = (p.selected || []).map(String);
    Array.prototype.forEach.call($('roomChecks').querySelectorAll('input'), function (i) { i.checked = sel.indexOf(i.getAttribute('data-g')) !== -1; });
    $('roomChecks').className = 'checks' + (p.enabled ? '' : ' off');
  }
  function checkedRooms() {
    return Array.prototype.filter.call($('roomChecks').querySelectorAll('input'), function (i) { return i.checked; }).map(function (i) { return i.getAttribute('data-g'); });
  }
  function savePrefs() {
    prefsTouched = Date.now();
    var sel = checkedRooms(), en = $('useLights').checked;
    if (en && !sel.length && status && status.groups && status.groups.length) {         // turning on with nothing ticked: tick all real rooms
      sel = status.groups.filter(function (g) { return g.type !== 'Zone'; }).map(function (g) { return g.id; });
    }
    api('/api/prefs', { enabled: en, selected: sel }).then(function (s) { status = s; prefsTouched = 0; render(); sendStatus(true); });
  }

  // ------------------------------------------------------------ room connection (connector page only)
  function roomState() {
    if (!net) return 'idle';
    if (hostOnline) return 'welcomed';
    return net.status || 'connecting';
  }
  function iceState() {
    try { var pc = net && net.conn && net.conn.peerConnection; return pc ? (pc.iceConnectionState || '') : ''; } catch (e) { return ''; }
  }
  function join(code) {
    if (net && net.code === code) return;
    hostOnline = false; onlineAt = 0; lastDetail = '';
    if (net) { net.code = code; net.reconnect(); return; }
    net = new window.ZTNet.Client({
      code: code,
      onOpen: function () { onlineAt = Date.now(); net.send({ t: 'hello', role: 'lights', clientId: clientId }); },
      onMessage: onHost,
      onStatus: function (st, d) {
        lastDetail = d || '';
        if (st === 'online') { if (!onlineAt) onlineAt = Date.now(); return; }
        onlineAt = 0;
        if (hostOnline) { hostOnline = false; lostAt = Date.now(); }
      }
    });
  }
  function leave() {
    if (net) { try { net.destroy(); } catch (e) {} }
    net = null; hostOnline = false; onlineAt = 0;
  }
  function onHost(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'lights-welcome') {
      hostOnline = true; lostAt = 0;
      if (m.fx) { fxCfg = m.fx; api('/api/hostcfg', { fx: m.fx }); }
      ping();
      refresh().then(function () { sendStatus(true); });
      return;
    }
    if (m.t === 'reject') { lastDetail = String(m.reason || 'rejected'); return; }
    if (m.t === 'lights-config') { api('/api/config', { enabled: !!m.enabled, selected: (m.selected || []).map(String) }).then(refresh); return; }
    if (m.t === 'lights-test') { api('/api/test', { groups: m.groups || [] }).then(refresh); return; }
    if (m.t === 'fx') { api('/api/fx', m).then(function () { setTimeout(refresh, 300); }); return; }
    if (m.t === 'lights-refresh') { api('/api/refresh', {}).then(function (s) { status = s; render(); sendStatus(true); }); return; }
  }
  var pinging = false;
  function ping() {
    if (pinging) return; pinging = true;
    api('/api/ping', { pageId: pageId, kind: RELAY ? 'relay' : 'ui', ua: navigator.userAgent, state: roomState(), code: net ? net.code : '',
      detail: lastDetail, ice: iceState(), hostOnline: hostOnline })
      .then(function (r) {
        pinging = false;
        isConnector = !!r.connector;
        if (isConnector && r.wantRoom) join(r.wantRoom); else if (net) leave();
      }).catch(function () { pinging = false; });
    // linked to the TV's peer but no welcome after 30 s: start the handshake over
    if (net && !hostOnline && onlineAt && Date.now() - onlineAt > 30000) { onlineAt = 0; lastDetail = 'no reply from the TV, retrying'; net.reconnect(); }
    // TV gone for a while during a game: put the lights back
    if (net && !hostOnline && lostAt && status && status.engine && status.engine.session && Date.now() - lostAt > (fxCfg.disconnectRestoreMs || 30000)) {
      lostAt = 0; api('/api/fx', { k: 'end', reason: 'TV disconnected' });
    }
  }
  function setRoom(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    if (code.length !== 4) { $('connLine').innerHTML = '<span class="bad">Type the 4-letter room code shown on the TV.</span>'; return; }
    $('code').value = code;
    api('/api/room', { code: code }).then(function () { ping(); refresh(); });
  }

  // ------------------------------------------------------------ buttons
  $('connectBtn').onclick = function () { setRoom($('code').value); };
  $('code').addEventListener('keydown', function (e) { if (e.key === 'Enter') setRoom($('code').value); });
  $('code').addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('pairBtn').onclick = function () { api('/api/pair', { seconds: 60 }).then(refresh); };
  $('mockLink').onclick = function () { api('/api/mock-link', {}).then(refresh); };
  $('restoreBtn').onclick = function () { api('/api/restore', {}).then(refresh); };
  $('staleBtn').onclick = function () { api('/api/restore', { stale: true }).then(refresh); };
  $('useLights').onchange = savePrefs;
  $('roomChecks').addEventListener('change', function () {
    if (checkedRooms().length && !$('useLights').checked) $('useLights').checked = true;   // ticking a room means "use lights"
    savePrefs();
  });
  $('testBtn').onclick = function () {
    var sel = checkedRooms();
    if (!sel.length) { $('useLine').innerHTML = '<span class="warnc">Tick at least one room to test.</span>'; return; }
    api('/api/test', { groups: sel }).then(refresh);
  };
  $('castBtn').onclick = function () {
    var code = window.ZTNet.makeCode(), base = (status && status.gameUrl) || 'https://amazingjustinlewis-web.github.io/games/zombie-tiles/';
    $('code').value = code;
    api('/api/cast', { url: base + '?room=' + code }).then(function () { return api('/api/room', { code: code }); }).then(function () { ping(); refresh(); });
  };

  // ------------------------------------------------------------ timers
  setInterval(ping, RELAY ? 1000 : 2000);
  setInterval(refresh, RELAY ? 3000 : 2000);
  refresh(); ping();
  if (Q.get('room')) setRoom(Q.get('room'));
  window.ZTL = { connect: setRoom, status: function () { return status; }, net: function () { return net; }, hostOnline: function () { return hostOnline; }, connector: function () { return isConnector; }, pageId: pageId };
})();
