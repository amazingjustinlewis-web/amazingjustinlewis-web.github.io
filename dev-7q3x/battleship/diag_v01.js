/* Battleship match diagnostics v01: per-message log, ping/pong RTT, clock offset, input timing, anomalies, reconnects, errors.
   window.BSDIAG.report() -> plain text. No names beyond the nicknames players typed; nothing leaves the device unless shared/downloaded. */
(function (root) {
  'use strict';
  var T0 = Date.now(), log = [], rtt = [], offs = [], shotLat = [], oneWay = [], A = { dup: 0, ooo: 0, gap: 0, overlap: 0, offturn: 0, fastTap: 0, reconnect: 0, error: 0, lateResult: 0 };
  var seqOut = 0, lastIn = 0, seen = {}, pid = 0, pendPing = {}, pendShot = {}, lastTap = 0, meta = { role: '', code: '', me: '', foe: '', ua: navigator.userAgent, started: new Date(T0).toISOString() }, statusLast = '';
  function now() { return Date.now(); }
  function rel(t) { return ('+' + ((t - T0) / 1000).toFixed(3) + 's').padStart(10); }
  function add(kind, txt) { log.push([now(), kind, txt]); if (log.length > 5000) log.shift(); }
  function off() { if (!offs.length) return 0; var s = offs.slice(-8).sort(function (a, b) { return a - b; }); return s[Math.floor(s.length / 2)]; }
  var D = {
    meta: meta,
    wrap: function (m) { m.s = ++seqOut; m.ts = now(); if (m.t !== 'dping' && m.t !== 'dpong') add('SEND', m.t + ' #' + m.s + brief(m)); return m; },
    recv: function (m) {   // returns false if the message should be dropped (duplicate)
      var t = now();
      if (typeof m.s === 'number') {
        if (seen[m.s]) { A.dup++; add('ANOM', 'duplicate #' + m.s + ' ' + m.t); return false; }
        seen[m.s] = 1;
        if (m.s < lastIn) { A.ooo++; add('ANOM', 'out-of-order #' + m.s + ' after #' + lastIn); }
        else if (m.s > lastIn + 1 && lastIn) { A.gap++; add('ANOM', 'sequence gap #' + lastIn + ' -> #' + m.s); }
        lastIn = Math.max(lastIn, m.s);
      }
      if (m.t === 'dping') return 'pong';
      if (m.t === 'dpong') { var p = pendPing[m.id]; if (p) { delete pendPing[m.id]; var r = t - p; rtt.push(r); offs.push(m.t1 - (p + t) / 2); add('PING', 'rtt ' + r + 'ms offset ' + Math.round(m.t1 - (p + t) / 2) + 'ms'); } return false; }
      if (typeof m.ts === 'number' && offs.length) { var ow = t - (m.ts - off()); oneWay.push(ow); }
      if (m.t !== 'ping') add('RECV', m.t + (m.s ? ' #' + m.s : '') + brief(m) + (typeof m.ts === 'number' && offs.length ? ' one-way~' + Math.round(t - (m.ts - off())) + 'ms' : ''));
      return true;
    },
    pingMsg: function () { var id = ++pid; pendPing[id] = now(); return { t: 'dping', id: id }; },
    pongMsg: function (m) { return { t: 'dpong', id: m.id, t1: now() }; },
    tap: function (c, ok, why) { var t = now(); if (lastTap && t - lastTap < 120) { A.fastTap++; add('ANOM', 'two taps ' + (t - lastTap) + 'ms apart'); } lastTap = t; add('INPUT', 'tap cell ' + c + (ok ? ' fired' : ' ignored (' + why + ')')); },
    shotSent: function (c) { if (Object.keys(pendShot).length) { A.overlap++; add('ANOM', 'shot ' + c + ' sent while shot ' + Object.keys(pendShot).join(',') + ' still awaiting result'); } pendShot[c] = now(); },
    shotResult: function (c) { var p = pendShot[c]; if (p == null) { A.lateResult++; add('ANOM', 'result for cell ' + c + ' with no pending shot'); return; } delete pendShot[c]; var l = now() - p; shotLat.push(l); add('TIMING', 'shot ' + c + ' -> result ' + l + 'ms'); },
    shotIn: function (c, myTurn) { if (myTurn) { A.offturn++; add('ANOM', 'opponent shot ' + c + ' arrived during MY turn (overlap)'); } },
    status: function (s, d) { if (s === statusLast) return; if (/reconnect/.test(s)) A.reconnect++; statusLast = s; add('NET', s + (d ? ' (' + d + ')' : '')); },
    note: function (t) { add('NOTE', t); },
    error: function (t) { A.error++; add('ERROR', t); },
    report: function () {
      function st(a) { if (!a.length) return 'n/a'; var s = a.slice().sort(function (x, y) { return x - y; }), sum = a.reduce(function (x, y) { return x + y; }, 0); return 'n=' + a.length + ' avg=' + (sum / a.length).toFixed(1) + 'ms min=' + s[0] + 'ms p95=' + s[Math.min(s.length - 1, Math.floor(s.length * .95))] + 'ms max=' + s[s.length - 1] + 'ms'; }
      var jit = 0; for (var i = 1; i < rtt.length; i++) jit += Math.abs(rtt[i] - rtt[i - 1]); jit = rtt.length > 1 ? (jit / (rtt.length - 1)).toFixed(1) + 'ms' : 'n/a';
      var L = ['ZERO TO PHI · BATTLESHIP MATCH REPORT (diag v01)', '='.repeat(48),
        'Game code: ' + meta.code + '   Role: ' + meta.role + '   You: ' + meta.me + '   Opponent: ' + meta.foe,
        'Started: ' + meta.started + '   Report: ' + new Date().toISOString() + '   Duration: ' + ((now() - T0) / 1000).toFixed(1) + 's',
        'Device: ' + meta.ua, '', 'SUMMARY', '-------',
        'Messages sent: ' + seqOut + '   received (highest seq): ' + lastIn,
        'Round-trip latency (ping/pong): ' + st(rtt), 'Jitter (mean change between pings): ' + jit,
        'Clock offset vs opponent (median of last 8, + = their clock ahead): ' + (offs.length ? Math.round(off()) + 'ms' : 'n/a'),
        'One-way latency estimate (offset-corrected): ' + st(oneWay.map(Math.round)),
        'Shot -> result latency: ' + st(shotLat),
        'Anomalies: duplicates ' + A.dup + ', out-of-order ' + A.ooo + ', seq gaps ' + A.gap + ', overlapping shots ' + A.overlap + ', off-turn shots received ' + A.offturn + ', double taps <120ms ' + A.fastTap + ', orphan results ' + A.lateResult,
        'Reconnects: ' + A.reconnect + '   Errors: ' + A.error, '', 'LOG', '---'];
      log.forEach(function (e) { L.push(rel(e[0]) + '  ' + e[1].padEnd(6) + ' ' + e[2]); });
      return L.join('\n');
    },
    stats: function () { return { rtt: rtt.slice(), offs: offs.slice(), shotLat: shotLat.slice(), anomalies: A }; }
  };
  function brief(m) { return m.c != null ? ' cell ' + m.c + (m.r ? ' ' + m.r.r : '') : ''; }
  root.addEventListener('error', function (e) { D.error((e.message || 'error') + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno); });
  root.addEventListener('unhandledrejection', function (e) { D.error('promise: ' + (e.reason && e.reason.message || e.reason)); });
  root.BSDIAG = D;
})(window);
