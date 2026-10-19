/* Bubble Hockey move report (v0.9.19): phone-side input log. On with ?log=1 or the toggle in the Feedback panel (saved on the phone).
   Gestures (view.js) report raw touches here; game outcomes are read from the state the phone already has (local sim snaps or TV state messages).
   When off, every hook returns immediately: zero gameplay impact. */
(function () {
  'use strict';
  var CFG = { max: 300, win: 1.5, interp: .25, mailMax: 1800, email: 'amazingjustinlewis@gmail.com', key: 'bubbleMoveLog' };
  var NAMES = ['goalie', 'left D', 'right D', 'left wing', 'centre', 'right wing'];
  var q = /[?&]log=1/.test(location.search), on = q; try { if (!q) on = localStorage.getItem(CFG.key) === '1'; } catch (e) {}
  var log = [], n = 0, pend = [], getSt = null, team = function () { return 0; }, prev = null, lastFlick = -9, cur = null, uiList = null;
  function now() { return performance.now() / 1000; }
  function pn(i) { if (i == null || i < 0) return 'nobody'; var t = i < 6 ? 0 : 1, mine = t === team(); return (mine ? 'your ' : 'their ') + NAMES[i % 6] + ' (#' + i + ')'; }
  function clock(st) { var s = st && st.tm != null ? st.tm : 0; return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function dir(dx, dy) { var a = Math.atan2(dy, dx) * 180 / Math.PI, up = team() ? 1 : -1, ny = dy * up, nx = dx * (team() ? -1 : 1), s = '';
    if (ny < -Math.abs(nx) * .4) s = 'back'; else if (ny > Math.abs(nx) * .4) s = 'up-ice'; if (Math.abs(nx) > Math.abs(ny) * .4) s += (s ? '-' : '') + (nx > 0 ? 'right' : 'left'); return s || 'still'; }
  function f2(x) { return (Math.round(x * 100) / 100).toFixed(2); }
  function add(txt, st) { n++; log.push('#' + n + ' [' + clock(st || (getSt && getSt())) + '] ' + txt); if (log.length > CFG.max) log.shift(); if (uiList && uiList.offsetParent) render(); }
  // ---- hooks from Gestures ----
  function down(d) { if (!on) return; src(); var st = getSt && getSt(); cur = { d: d, st0: st ? JSON.parse(JSON.stringify({ c: st.c, sc: st.sc, fx: st.fx, wh: st.wh, p: st.p, pz: st.pz, iev: st.iev, sh: st.sh, kdn: st.kdn })) : null, t0: now() }; }
  function up(u) { if (!on) return; var st = getSt && getSt(), c = cur || { d: {}, st0: null, t0: now() }; cur = null; var d = c.d, s0 = c.st0 || {}, mine = s0.c != null && s0.c >= 0 && ((s0.c < 6 ? 0 : 1) === team());
    var phys = [], kind = u.kind;
    if (d.goalie) phys.push('GOALIE STRIP ' + (u.reach ? 'swipe' : 'slide') + ' ' + f2(u.dur) + ' s, path ' + f2(u.path));
    else { phys.push(kind.toUpperCase() + (d.multi ? ' (2nd finger)' : '') + ' ' + f2(u.dur) + ' s, path ' + f2(u.path) + ' rink, release ' + f2(u.sp) + '/s ' + (u.sp < .05 ? 'still' : dir(u.vx, u.vy)));
      if (s0.c != null && s0.c >= 0 && s0.sh != null) phys.push((mine ? 'you' : 'carrier ' + pn(s0.c)) + ' shielding ' + f2(s0.sh) + (mine ? '' : ' (poke chance ~' + Math.round((.7 - .45 * s0.sh) * 100) + '%)'));
      if (!d.multi) phys.push('down ' + (d.best >= 0 ? f2(d.bd) + ' from ' + pn(d.best) : 'on open ice') + ', puck ' + f2(d.pd) + ' away'); }
    var e = { txt: phys.join('; '), kind: kind, d: d, s0: s0, mine: mine, t: now(), st0: st, interp: null, res: [], fx0: s0.fx ? s0.fx[0] : null, wh0: s0.wh || 0, sc0: s0.sc ? s0.sc.slice() : [0, 0], c0: s0.c, done: false, flickSent: u.flick, iev0: s0.iev ? s0.iev[0] : null, kd0: s0.kdn ? s0.kdn[0] : null };
    // expected interpretation from the pre-gesture state (confirmed / corrected by events below)
    if (d.goalie) e.interp = u.reach ? 'goalie swipe (reach)' : 'goalie move';
    else if (s0.pz > 0 && kind === 'tap') e.interp = 'skip / ignored (play stopped)';
    else if (kind === 'tap' || d.multi) { if (mine) e.interp = 'shot by ' + pn(s0.c); else if (s0.c < 0 && now() - lastFlick < 2.5) e.interp = 'arm one-timer'; else e.want = 'tap'; }
    else if (kind === 'flick') { if (!u.flick) e.interp = 'ignored: flick too slow (' + f2(u.sp) + ' < 0.90)' + (d.best >= 0 ? '; moved ' + pn(d.best) : ''); else if (!mine) e.interp = 'ignored: flick without the puck' + (d.best >= 0 ? '; moved ' + pn(d.best) : ''); else { e.want = 'flick'; lastFlick = now(); } }
    else e.interp = d.best >= 0 ? (d.snag ? 'snag rush by ' : 'grab + move ') + pn(d.best) : 'ignored: no player near the touch';
    pend.push(e); }
  // ---- state watcher ----
  function src() { var S = window.BubbleMoveLogSrc; if (S && !getSt) { getSt = S.st; team = S.team; } }
  function tick() { if (!on) return requestAnimationFrame(tick); src(); var st = getSt && getSt(); if (st && st !== prev) { see(st); prev = st; } requestAnimationFrame(tick); }
  function see(st) { var t = now(), ev = st.ev || '';
    for (var k = 0; k < pend.length; k++) { var e = pend[k]; if (e.done) continue; var age = t - e.t;
      if (st.iev && st.iev[0] !== e.iev0) { var iv = st.iev; e.iev0 = iv[0]; if (iv[1] === team() && !e.gotI) { e.gotI = 1; var k2 = iv[2]; if (iv[4] != null) { e.c0 = iv[4]; e.lc = st.c; }
          var I = k2 === 'pass' ? 'pass by ' + pn(e.c0) + ' to ' + pn(iv[3]) : k2 === 'shot' ? 'shot by ' + pn(e.c0) + (e.kind === 'flick' ? ' (flick at the net)' : '') : k2 === 'arm' ? 'arm one-timer (next touch fires)' : k2 === 'poke' ? 'poke/stick-check: knocked it off the carrier' : k2 === 'steal' ? 'stick-check: steal' : k2 === 'jab' ? 'stick-check: jab at the loose puck' : k2 === 'snag' ? 'snag rush by ' + pn(e.d.best) : k2 === 'reach' ? 'goalie swipe (reach)' : k2 === 'shielded' ? 'poke/stick-check: blocked by the carrier shielding (shield ' + f2(st.sh || 0) + ')' : k2 === 'auto' ? null : k2;
          if (I) { if (/^(poke|stick-check)/.test(I) && /^poke\/stick-check by/.test(e.interp || '')) e.interp = e.interp + ' -> ' + I.replace(/^poke\/stick-check: |^stick-check: /, ''); else e.interp = I; } } }
      if (st.kdn && st.kdn[0] !== e.kd0) { e.kd0 = st.kdn[0]; if (age < CFG.win) e.res.push('KNOCKDOWN: ' + pn(st.kdn[2]) + ' knocked down ' + pn(st.kdn[1])); }
      if (st.fx && st.fx[0] !== e.fx0) { var fx = st.fx; e.fx0 = fx[0];
        if (fx[1] === 'P' && !e.interp && e.want === 'tap') e.interp = 'poke/stick-check by ' + pn(fx[2]) + (e.c0 >= 0 && !e.mine ? ' at carrier ' + pn(e.c0) : ' at the loose puck');
        else if ((fx[1] === 'C' || fx[1] === 'B' || fx[1] === 'K') && fx[2] === e.d.best) e.res.push((fx[1] === 'B' ? 'BIG body check' : 'body check') + ' by ' + pn(fx[2])); }
      if (!e.interp && e.want === 'flick' && (ev === 'pass' || ev === 'shot' || ev === 'onetimer')) e.interp = ev === 'pass' ? 'pass by ' + pn(e.c0) : 'shot (flick at the net) by ' + pn(e.c0);
      if (!e.interp && e.want === 'flick' && st.c < 0 && age > .05) e.interp = 'flick release (loose, no teammate in the cone)';
      if (ev === 'arm' && !e.interp) e.interp = 'arm one-timer';
      if (ev && /^(poke|steal|jab|knock|popup|whistle|save|glove|post|bar|onetimer|snag|reach)$/.test(ev) && e.res.indexOf(ev) < 0 && age < CFG.win) e.res.push(ev === 'popup' ? 'scramble pop-up' : ev === 'onetimer' ? 'one-timer fired' : ev === 'jab' ? 'jab hit the puck' : ev === 'reach' ? 'goalie reached' : ev);
      if ((st.wh || 0) > e.wh0 && e.res.indexOf('whistle') < 0) e.res.push('whistle'); e.wh0 = st.wh || 0;
      if (st.sc && (st.sc[0] !== e.sc0[0] || st.sc[1] !== e.sc0[1])) { var gt = st.sc[0] !== e.sc0[0] ? 0 : 1; e.res.push('GOAL ' + (gt === team() ? 'for you' : 'against you')); e.sc0 = st.sc.slice(); e.goal = 1; }
      if (st.c !== e.lc) { if (st.c >= 0 && age > .05 && st.c !== e.c0 && (e.nc = (e.nc || 0) + 1) <= 2) { var same = e.c0 >= 0 && (st.c < 6) === (e.c0 < 6); e.res.push((e.c0 >= 0 ? (same ? 'reached teammate ' : 'taken by ') : 'picked up by ') + pn(st.c)); if (!e.endc) e.endc = st.c; } e.lc = st.c; }
      if (age >= CFG.win) fin(e, st); }
    pend = pend.filter(function (e) { return !e.done; }); }
  function fin(e, st) { e.done = true; var interp = e.interp || (e.want === 'tap' ? 'ignored: tap did nothing (no free player / out of reach)' : e.want === 'flick' ? 'flick (no reaction seen)' : '?');
    if (/^poke/.test(interp) && !/knocked|steal|jab|blocked/.test(interp) && !e.res.some(function (r) { return /poke|steal|jab/.test(r); })) e.res.unshift('missed: out of reach');
    if (/^shot/.test(interp) && !e.goal) { var s = e.res.filter(function (r) { return /save|glove|post|bar|taken by their goalie/.test(r); }); e.res.unshift(s.length ? 'on net, no goal' : (e.res.some(function (r) { return /taken by/.test(r); }) ? 'blocked / picked off' : 'wide or no result')); }
    if (/^pass/.test(interp)) e.res.unshift(e.endc != null ? ((e.endc < 6) === (e.c0 < 6) ? 'pass completed' : 'pass intercepted') : 'pass not collected');
    add(e.txt + ' -> GAME: ' + interp + ' -> RESULT: ' + (e.res.length ? e.res.join(', ') : '-'), e.st0); }
  // ---- UI: toggle + buttons in the Feedback panel, Mark pill while on ----
  var mk, pan;
  function stop(x) { ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'click'].forEach(function (k) { x.addEventListener(k, function (e) { e.stopPropagation(); }); }); }
  function tapd(x, fn) { var l = 0; function go(e) { var t = Date.now(); if (t - l < 400) return; l = t; e.stopPropagation(); fn(); } x.addEventListener('pointerup', go); x.addEventListener('click', go); }
  function build() { return (window.BubbleFeedback && window.BubbleFeedback.BUILD) || '?'; }
  function header() { return 'Bubble Hockey ' + build() + ' move report\nDevice: ' + navigator.userAgent + '\nScreen: ' + screen.width + 'x' + screen.height + ' @' + (window.devicePixelRatio || 1) + 'x\nEntries: ' + log.length + ' (last ' + CFG.max + ' kept)\nTime: ' + new Date().toString() + '\n\n'; }
  function render() { uiList.value = log.length ? log.join('\n') : '(no moves logged yet' + (on ? ')' : ' - turn the move report on)'); uiList.scrollTop = uiList.scrollHeight; }
  function ui() { var fb = document.getElementById('fbPan'); if (!fb) return setTimeout(ui, 300);
    var css = document.createElement('style'); css.textContent = '#mlRow{margin-top:10px;border-top:1px solid #fff2;padding-top:8px;font-size:13px}#mlRow label{display:flex;gap:8px;align-items:center}#mlRow button,#mlPan button{border:0;border-radius:9px;padding:8px;font:700 13px system-ui;cursor:pointer;background:#fff2;color:#fff;flex:1}#mlPan{position:fixed;z-index:10000;left:3vw;right:3vw;top:6vh;bottom:6vh;background:#0b1224f5;border:1px solid #fff3;border-radius:14px;padding:10px;display:none;flex-direction:column;color:#fff;font:13px system-ui}#mlPan textarea{flex:1;width:100%;box-sizing:border-box;background:#0008;color:#dfe;border:1px solid #fff2;border-radius:8px;font:11px ui-monospace,monospace;padding:6px;resize:none;white-space:pre-wrap}#mlPan .r{display:flex;gap:6px;margin-top:8px}#mlMark{position:fixed;z-index:9998;top:48px;left:8px;border:0;border-radius:12px;background:#ff3b6bcc;color:#fff;font:700 11px system-ui;padding:5px 10px;display:none}#mlMsg{font-size:11px;opacity:.75;min-height:13px;margin-top:4px}';
    document.head.appendChild(css);
    var row = document.createElement('div'); row.id = 'mlRow'; row.innerHTML = '<label><input type="checkbox" id="mlOn"> Move report (logs your thumb moves)</label><div style="display:flex;gap:8px;margin-top:6px"><button id="mlShow">Move report</button></div>'; fb.appendChild(row);
    pan = document.createElement('div'); pan.id = 'mlPan'; pan.innerHTML = '<b>Move report</b><div style="opacity:.7;font-size:11px;margin:2px 0 6px">thumb did -> game read it as -> what happened (1.5 s)</div><textarea id="mlList" readonly></textarea><div class="r"><button id="mlCopy" style="background:#ffb300;color:#000">COPY</button><button id="mlMail">Email</button><button id="mlClear">Clear</button><button id="mlClose">Close</button></div><div id="mlMsg"></div>'; document.body.appendChild(pan);
    mk = document.createElement('button'); mk.id = 'mlMark'; mk.textContent = 'Mark'; document.body.appendChild(mk);
    [row, pan, mk].forEach(stop); uiList = pan.querySelector('#mlList');
    var cb = row.querySelector('#mlOn'); cb.checked = on; cb.addEventListener('change', function () { set(cb.checked); });
    function msg(t) { pan.querySelector('#mlMsg').textContent = t; }
    tapd(row.querySelector('#mlShow'), function () { fb.style.display = 'none'; pan.style.display = 'flex'; render(); msg(''); });
    tapd(pan.querySelector('#mlClose'), function () { pan.style.display = 'none'; });
    tapd(pan.querySelector('#mlClear'), function () { log = []; render(); msg('Cleared.'); });
    tapd(mk, function () { add('*** MARK ***'); mk.textContent = 'Marked'; setTimeout(function () { mk.textContent = 'Mark'; }, 700); });
    tapd(pan.querySelector('#mlCopy'), function () { var t = header() + log.join('\n'); function fb2() { uiList.value = t; uiList.focus(); uiList.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} msg(ok ? 'Copied!' : 'Selected - press and hold to copy.'); }
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(function () { msg('Copied ' + log.length + ' entries!'); }, fb2); else fb2(); });
    tapd(pan.querySelector('#mlMail'), function () { var h = header(), b = [], len = 0; for (var i = log.length - 1; i >= 0; i--) { len += log[i].length + 1; if (len > CFG.mailMax) break; b.unshift(log[i]); }
      var note = b.length < log.length ? '[Email shows the last ' + b.length + ' of ' + log.length + ' entries (mail links are length-limited). Use COPY for the full report.]\n' : ''; location.href = 'mailto:' + CFG.email + '?subject=' + encodeURIComponent('[Move report] Bubble Hockey ' + build()) + '&body=' + encodeURIComponent(h + note + b.join('\n')); });
    vis(); }
  function vis() { if (mk) mk.style.display = on ? 'block' : 'none'; }
  function set(v) { on = !!v; try { localStorage.setItem(CFG.key, on ? '1' : '0'); } catch (e) {} if (on) add('(move report on)'); vis(); }
  window.BubbleMoveLog = { get on() { return on; }, down: down, up: up, set: set, mark: function () { add('*** MARK ***'); }, text: function () { return log.join('\n'); }, entries: function () { return log; }, see: see, CFG: CFG,
    attach: function (gs, tm) { getSt = gs; if (tm) team = tm; } };
  requestAnimationFrame(tick);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ui); else ui();
})();
