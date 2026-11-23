/* minikit/perf.js - DEV-ONLY lightweight metrics (load only on dev-7q3x pages).
   TV: FPS, frame-time p50/p95/p99 (fixed histogram, no per-frame allocation), long frames > 50 ms, sim vs render time (auto-wraps
   known Sim.step / World.step and THREE.WebGLRenderer.render / FoosView.draw), JS heap, device + GPU, phone count, per-phone net:
   RTT + jitter (TV pings each phone every PERF.ping ms over the reliable channel, phone echoes), msg rate, bytes/s (sampled),
   late / out-of-order / dropped pings, share of messages on the unordered fast channel.
   Phone: FPS + RTT/jitter (TV tells it), sent back inside the echo.
   5 s buckets; rolling session log in localStorage ('mk-perf-log'); overlay via ?perf=1 or triple-tap the top-left corner;
   overlay has Download log (JSON) and Clear. */
(function (root) {
  'use strict';
  var PERF = { bucket: 5000, ping: 2000, late: 150, sampleEvery: 8, logKey: 'mk-perf-log', logMax: 360, corner: 70 };
  var PAD = /pad\.html$/.test(location.pathname), BINS = 400, BW = 0.25;   // histogram 0..100 ms in 0.25 ms bins (+ overflow)
  var hist = new Uint16Array(BINS + 1), nF = 0, longF = 0, lastT = 0, simMs = 0, renMs = 0, simN = 0, renN = 0, maxF = 0;
  var P = { pad: PAD, rtt: 0, jit: 0, fps: 0, cur: null, log: null, peers: {}, host: null };
  // ---- frame loop (one closure, no allocation per frame)
  function tick(t) { if (lastT) { var d = t - lastT; nF++; var b = (d / BW) | 0; hist[b < BINS ? b : BINS]++; if (d > 50) longF++; if (d > maxF) maxF = d; } lastT = t; requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
  function pct(q) { var tot = 0, i; for (i = 0; i <= BINS; i++) tot += hist[i]; if (!tot) return 0; var need = tot * q, acc = 0; for (i = 0; i <= BINS; i++) { acc += hist[i]; if (acc >= need) return i >= BINS ? 100 : (i + .5) * BW; } return 100; }
  // ---- timing wrappers
  var now = performance.now.bind(performance);
  function wrap(proto, name, kind) { if (!proto || typeof proto[name] !== "function" || proto[name].__perf) return; var f = proto[name]; var w = function () { var a = now(), r = f.apply(this, arguments), d = now() - a; if (kind === 's') { simMs += d; simN++; } else { renMs += d; renN++; } return r; }; w.__perf = 1; proto[name] = w; }
  function autoWrap() { var g = root;
    [['Bubble', 'Sim'], ['Marble', 'Sim'], ['Foos', 'Sim'], ['Orbit', 'Sim'], ['Stunt', 'World']].forEach(function (k) { if (g[k[0]] && g[k[0]][k[1]]) wrap(g[k[0]][k[1]].prototype, 'step', 's'); });
    if (g.THREE && g.THREE.WebGLRenderer) wrap(g.THREE.WebGLRenderer.prototype, 'render', 'r'); if (g.FoosView) wrap(g.FoosView.prototype, 'draw', 'r'); }
  // ---- device
  function device() { var gpu = '', d = { ua: navigator.userAgent, scr: screen.width + 'x' + screen.height, win: innerWidth + 'x' + innerHeight, dpr: devicePixelRatio, cores: navigator.hardwareConcurrency || 0, mem: navigator.deviceMemory || 0 };
    try { var c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl'); if (gl) { var e = gl.getExtension('WEBGL_debug_renderer_info'); gpu = e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); var lx = gl.getExtension('WEBGL_lose_context'); if (lx) lx.loseContext(); } } catch (x) {}
    d.gpu = gpu; return d; }
  // ---- network (TV side)
  function peer(id) { return P.peers[id] || (P.peers[id] = { rx: 0, rxB: 0, rxS: 0, fast: 0, tx: 0, txB: 0, txS: 0, sent: 0, got: 0, ooo: 0, late: 0, hi: 0, rtt: 0, jit: 0, rttN: 0, fps: -1, pend: {} }); }
  function size(m) { try { return typeof m === 'string' ? m.length : JSON.stringify(m).length; } catch (e) { return 0; } }
  P.rx = function (p, d, viaFast) { if (!p) return; var q = peer(p.id); q.rx++; if (viaFast) q.fast++; if (++q.rxS >= PERF.sampleEvery) { q.rxS = 0; q.rxB += size(d) * PERF.sampleEvery; } };
  P.tx = function (p, m) { if (!p) return; var q = peer(p.id); q.tx++; if (++q.txS >= PERF.sampleEvery) { q.txS = 0; q.txB += size(m) * PERF.sampleEvery; } };
  P.pong = function (p, d) { if (!p) return; var q = peer(p.id), t = now(), r = t - d.ts; if (d.n < q.hi) q.ooo++; else q.hi = d.n; if (!q.pend[d.n]) return; delete q.pend[d.n]; q.got++; if (r > PERF.late) q.late++;
    if (q.rttN) q.jit += (Math.abs(r - q.rtt) - q.jit) / 8; q.rtt = q.rttN ? q.rtt + (r - q.rtt) / 4 : r; q.rttN++; q.fps = d.f; };
  P.attachHost = function (h) { P.host = h; var n = 0; setInterval(function () { n++; var t = now(); h.players.forEach(function (p) { if (!p.on || p.local || !p.conn) return; var q = peer(p.id); q.sent++; q.pend[n] = 1; var old = n - 6; if (q.pend[old]) delete q.pend[old];
      try { p.conn.send({ t: 'pq', n: n, ts: t, r: Math.round(q.rtt), j: Math.round(q.jit) }); } catch (e) {} }); }, PERF.ping); };
  // phone side: kit.js calls this on 'pq' and sends the returned echo
  P.echo = function (m) { P.rtt = m.r; P.jit = m.j; return { t: 'pa', n: m.n, ts: m.ts, f: Math.round(P.fps) }; };
  // ---- buckets + log
  var bStart = now();
  function loadLog() { try { return JSON.parse(localStorage.getItem(PERF.logKey) || '[]'); } catch (e) { return []; } }
  function bucket() { var t = now(), span = (t - bStart) / 1000; bStart = t; var b = { t: new Date().toISOString().slice(11, 19), fps: +(nF / span).toFixed(1), p50: pct(.5), p95: pct(.95), p99: pct(.99), max: Math.round(maxF), long: longF,
      sim: simN ? +(simMs / simN).toFixed(2) : null, ren: renN ? +(renMs / renN).toFixed(2) : null, simF: +(simMs / Math.max(1, nF)).toFixed(2), renF: +(renMs / Math.max(1, nF)).toFixed(2) };
    var mem = performance.memory; if (mem) b.heap = Math.round(mem.usedJSHeapSize / 1048576);
    P.fps = b.fps;
    if (PAD) { b.rtt = P.rtt; b.jit = P.jit; }
    else { b.phones = P.host ? P.host.players.filter(function (p) { return p.on; }).length : 0; b.net = {};
      for (var id in P.peers) { var q = P.peers[id]; b.net[id] = { rtt: Math.round(q.rtt), jit: Math.round(q.jit), inHz: +(q.rx / span).toFixed(1), inBps: Math.round(q.rxB / span), outHz: +(q.tx / span).toFixed(1), outBps: Math.round(q.txB / span), fast: q.rx ? Math.round(q.fast / q.rx * 100) : 0, drop: Math.max(0, q.sent - q.got - Object.keys(q.pend).length), late: q.late, ooo: q.ooo, fps: q.fps };
        q.rx = q.rxB = q.fast = q.tx = q.txB = 0; q.sent = Object.keys(q.pend).length; q.got = 0; q.late = q.ooo = 0; } }
    hist.fill(0); nF = longF = 0; maxF = 0; simMs = renMs = 0; simN = renN = 0;
    P.cur.b.push(b); if (P.cur.b.length > PERF.logMax) P.cur.b.shift();
    var L = loadLog().filter(function (s) { return s.id !== P.cur.id; }); L.push(P.cur); var tot = 0; for (var i = L.length - 1; i >= 0; i--) { tot += L[i].b.length; if (tot > PERF.logMax * 2) { L = L.slice(i + 1); break; } }
    try { localStorage.setItem(PERF.logKey, JSON.stringify(L)); } catch (e) {}
    if (ov) paint(b); }
  // ---- overlay
  var ov = null, liveT = 0;
  function paint(b) { var s = (PAD ? 'PHONE ' : 'TV ') + (root.MINI || '') + '  ' + b.t + '\n' + 'fps ' + b.fps + '  ms p50/95/99 ' + b.p50 + '/' + b.p95 + '/' + b.p99 + '  max ' + b.max + '  >50ms ' + b.long + '\n' +
      'sim ' + (b.sim == null ? '-' : b.sim) + 'ms  render ' + (b.ren == null ? '-' : b.ren) + 'ms (per frame ' + b.simF + '/' + b.renF + ')' + (b.heap ? '  heap ' + b.heap + 'MB' : '') + '\n';
    if (PAD) s += 'rtt ' + b.rtt + 'ms  jitter ' + b.jit + 'ms\n';
    else { s += 'phones ' + b.phones + '\n'; var nm = {}; if (P.host) P.host.players.forEach(function (p) { nm[p.id] = p.name; });
      for (var id in b.net) { var n = b.net[id]; s += (nm[id] || id).slice(0, 8) + ': rtt ' + n.rtt + '\u00b1' + n.jit + '  in ' + n.inHz + '/s ' + n.inBps + 'B/s  out ' + n.outHz + '/s ' + n.outBps + 'B/s  fast ' + n.fast + '%  drop ' + n.drop + ' late ' + n.late + ' ooo ' + n.ooo + '  fps ' + n.fps + '\n'; } }
    ov.firstChild.textContent = s; }
  function toggle(on) { if (on === undefined) on = !ov; if (!on) { if (ov) ov.remove(); ov = null; return; }
    ov = document.createElement('div'); ov.style.cssText = 'position:fixed;left:6px;top:6px;z-index:99999;background:rgba(0,0,0,.78);color:#9f9;font:11px/1.35 ui-monospace,monospace;padding:6px 8px;border-radius:6px;max-width:96vw;pointer-events:auto';
    var pre = document.createElement('pre'); pre.style.cssText = 'margin:0;white-space:pre-wrap'; pre.textContent = 'collecting (5 s buckets)\u2026\n' + JSON.stringify(P.cur.dev).slice(0, 300); ov.appendChild(pre);
    var bt = document.createElement('div'); bt.style.cssText = 'margin-top:4px;display:flex;gap:6px'; ov.appendChild(bt);
    [['Download log', download], ['Clear', function () { localStorage.removeItem(PERF.logKey); P.cur.b = []; }], ['\u2715', function () { toggle(false); }]].forEach(function (x) { var b = document.createElement('button'); b.textContent = x[0]; b.style.cssText = 'font:11px monospace;padding:3px 7px;border-radius:4px;border:0;background:#2b4;color:#fff'; b.onclick = function (e) { e.stopPropagation(); x[1](); }; bt.appendChild(b); });
    document.body.appendChild(ov); if (P.cur.b.length) paint(P.cur.b[P.cur.b.length - 1]); }
  function download() { var blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), sessions: loadLog() }, null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'perf-' + (root.MINI || 'mini') + '-' + Date.now() + '.json'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  var taps = [0, 0, 0];
  addEventListener('pointerdown', function (e) { if (e.clientX > PERF.corner || e.clientY > PERF.corner) return; taps[0] = taps[1]; taps[1] = taps[2]; taps[2] = e.timeStamp; if (taps[2] - taps[0] < 700) { taps[0] = taps[1] = taps[2] = 0; toggle(); } }, true);
  function init() { autoWrap(); P.cur = { id: Date.now().toString(36), game: root.MINI || location.pathname, role: PAD ? 'phone' : 'tv', start: new Date().toISOString(), dev: device(), b: [] };
    setInterval(bucket, PERF.bucket); if (/[?&]perf=1/.test(location.search)) toggle(true); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
  addEventListener('load', autoWrap);
  P.toggle = toggle; P.bucketNow = bucket; P.PERF = PERF; P.wrap = wrap; P.download = download;
  root.Perf = P;
})(window);
