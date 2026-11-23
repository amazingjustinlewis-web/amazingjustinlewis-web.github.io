/* minikit/quality.js - shared per-device quality tier (v1, added for Bubble Hockey v0.9.38; other games may adopt).
   ZTP.quality.tier  -> 'high' | 'medium' | 'low' | 'minimal'   ZTP.quality.idx -> 0..3   ZTP.quality.pinned -> true if ?q= set
   ZTP.quality.sample(fps)  feed ~1 s fps windows; steps down after 3 windows < 30 fps, back up after 6 windows > 50 fps (not when pinned)
   ZTP.quality.set(idx|name, why)   ZTP.quality.onChange(fn(idx, name, rec))   ZTP.quality.log -> per-device records
   Start tier: ?q=high|medium|low|minimal (or 0-3) pins it; else the last tier remembered for this device (localStorage 'ztp-quality'), else 'high'.
   Each change is logged to console, localStorage 'ztp-quality-log' (last 100) and Perf.cur.quality when minikit/perf.js is loaded.
   Games interpret the tier their own way. */
(function (root) {
  'use strict';
  var N = ['high', 'medium', 'low', 'minimal'], C = { lo: 30, hi: 50, bad: 3, good: 6 }, game = root.MINI || location.pathname.split('/').slice(-2)[0];
  function ix(v) { if (v == null) return -1; var i = N.indexOf(String(v)); return i >= 0 ? i : (/^[0-3]$/.test(String(v)) ? +v : -1); }
  var qs = (location.search.match(/[?&]q=([^&]+)/) || [])[1], pin = ix(qs), mem = -1;
  try { mem = ix(JSON.parse(localStorage.getItem('ztp-quality') || '{}')[game]); } catch (e) {}
  var Q = { tiers: N, idx: pin >= 0 ? pin : (mem >= 0 ? mem : 0), pinned: pin >= 0, fps: 0, cb: [], bad: 0, good: 0 };
  Q.tier = N[Q.idx];
  function load() { try { return JSON.parse(localStorage.getItem('ztp-quality-log') || '[]'); } catch (e) { return []; } }
  Q.log = load();
  Q.set = function (v, why) { var i = ix(v); if (i < 0) return; Q.idx = i; Q.tier = N[i];
    var rec = { t: Date.now(), game: game, tier: Q.tier, why: why || '', fps: Math.round(Q.fps), ua: navigator.userAgent, scr: screen.width + 'x' + screen.height, dpr: devicePixelRatio, cores: navigator.hardwareConcurrency || 0, mem: navigator.deviceMemory || 0 };
    console.log('[quality] ' + game + ' -> ' + Q.tier + ' (' + rec.why + ', ' + rec.fps + ' fps)');
    Q.log.push(rec); Q.log = Q.log.slice(-100);
    try { localStorage.setItem('ztp-quality-log', JSON.stringify(Q.log)); if (!Q.pinned) { var m = JSON.parse(localStorage.getItem('ztp-quality') || '{}'); m[game] = Q.tier; localStorage.setItem('ztp-quality', JSON.stringify(m)); } } catch (e) {}
    if (root.Perf) { root.Perf.quality = rec; if (root.Perf.cur) root.Perf.cur.quality = rec; }
    Q.cb.forEach(function (f) { try { f(i, Q.tier, rec); } catch (e) {} }); };
  Q.onChange = function (f) { Q.cb.push(f); };
  Q.sample = function (fps) { Q.fps = fps; if (Q.pinned) return; Q.bad = fps < C.lo ? Q.bad + 1 : 0; Q.good = fps > C.hi ? Q.good + 1 : 0;
    if (Q.bad >= C.bad && Q.idx < 3) { Q.bad = Q.good = 0; Q.set(Q.idx + 1, 'auto down'); } else if (Q.good >= C.good && Q.idx > 0) { Q.bad = Q.good = 0; Q.set(Q.idx - 1, 'auto up'); } };
  Q.cfg = C;
  (root.ZTP = root.ZTP || {}).quality = Q;
})(window);
