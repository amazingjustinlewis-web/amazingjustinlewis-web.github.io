/* Bubble Hockey feedback button (v0.9.12): small corner pill -> panel with the build number + COPY. Touches never reach the game. */
(function () {
  var BUILD = 'v0.9.25', DATE = '2026-10-19';
  var TXT;
  function mk() { TXT = 'Bubble Hockey build ' + BUILD + ' (' + DATE + ') - please include this build number in your feedback'; }
  mk();
  var phone = /pad\.html/.test(location.pathname);
  var css = document.createElement('style');
  css.textContent = '#fbBtn{position:fixed;z-index:9998;border:0;border-radius:12px;background:rgba(255,255,255,.12);color:#fff;opacity:.55;font:600 11px system-ui;padding:4px 9px;cursor:pointer;' +
    (phone ? 'top:48px;right:8px' : 'left:1.2vw;top:1.5vh') + '}#fbBtn:hover{opacity:.9}' +
    '#fbPan{position:fixed;z-index:9999;left:50%;top:50%;transform:translate(-50%,-50%);width:min(86vw,360px);background:#101830f2;border:1px solid #fff3;border-radius:14px;padding:14px;color:#fff;font:14px system-ui;display:none;box-shadow:0 8px 30px #000a}' +
    '#fbPan textarea{width:100%;box-sizing:border-box;height:68px;background:#0006;color:#fff;border:1px solid #fff3;border-radius:8px;font:13px system-ui;padding:6px;resize:none}' +
    '#fbPan .r{display:flex;gap:8px;margin-top:10px}#fbPan button{flex:1;border:0;border-radius:9px;padding:9px;font:700 14px system-ui;cursor:pointer}#fbCopy{background:#ffb300;color:#000}#fbClose{background:#fff2;color:#fff}';
  document.head.appendChild(css);
  function el(t, id, p) { var e = document.createElement(t); if (id) e.id = id; (p || document.body).appendChild(e); return e; }
  var root = document.body;   // on body, above the join lobby (which sits outside the phone's #rot wrapper)
  var b = el('button', 'fbBtn', root); b.textContent = 'Feedback'; b.setAttribute('aria-label', 'Feedback / build number');
  var p = el('div', 'fbPan', root);
  p.innerHTML = '<b>Feedback</b><p style="margin:6px 0 8px;opacity:.85">Tell Justin what you think. Please include this:</p><textarea id="fbTxt" readonly></textarea><div class="r"><button id="fbCopy">COPY</button><button id="fbClose">Close</button></div><div id="fbMsg" style="font-size:12px;opacity:.7;margin-top:6px;min-height:14px"></div>';
  var ta = p.querySelector('#fbTxt'); ta.value = TXT;
  // single source of truth: build.json (also read by the playtest page); the constants above are only a fallback
  fetch('build.json?t=' + Date.now()).then(function (r) { return r.json(); }).then(function (j) { if (j.ver) { BUILD = j.ver; DATE = j.date || DATE; mk(); ta.value = TXT; window.BubbleFeedback.BUILD = BUILD; window.BubbleFeedback.TEXT = TXT; } }).catch(function () {});
  function stop(e) { e.stopPropagation(); }
  ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'click'].forEach(function (k) { b.addEventListener(k, stop); p.addEventListener(k, stop); });
  // act on pointerup too: the game may preventDefault touches, which kills synthetic clicks on phones
  function tap(e2, fn) { var last = 0; function go(e) { var n = Date.now(); if (n - last < 400) return; last = n; e.stopPropagation(); fn(); } e2.addEventListener('pointerup', go); e2.addEventListener('click', go); }
  tap(b, function () { p.style.display = p.style.display === 'block' ? 'none' : 'block'; p.querySelector('#fbMsg').textContent = ''; });
  tap(p.querySelector('#fbClose'), function () { p.style.display = 'none'; });
  function fallback() { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} return ok; }
  tap(p.querySelector('#fbCopy'), function () {
    var m = p.querySelector('#fbMsg');
    function done(ok) { m.textContent = ok ? 'Copied!' : 'Selected - press and hold (or Ctrl+C) to copy.'; if (!ok) fallback(); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(TXT).then(function () { done(true); }, function () { done(fallback()); });
    else done(fallback());
  });
  window.BubbleFeedback = { BUILD: BUILD, TEXT: TXT, open: function () { p.style.display = 'block'; } };
})();
