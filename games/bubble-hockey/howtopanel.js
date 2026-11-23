/* Bubble Hockey v0.9.11: scrollable How to play panel (gentle auto-scroll, hand-scrollable). Phone: '?' button + lobby link. */
(function () {
  var H = [
    ['Move', 'Put a finger on any of your players and drag. He slides along his slot. With the puck, your finger steers the puck around him.'],
    ['Switch players', 'Just touch a different player. Whoever is under your thumb is yours (coloured ring). The computer moves the rest.'],
    ['Pass', 'With the puck, <b>FLICK toward a teammate</b> (quick swipe and let go). The game picks the teammate closest to your flick direction. Faster flick = harder pass.'],
    ['Shoot', '<b>TAP on (or near) your player with the puck</b> - he shoots at the open side of the net. A hard flick straight at their net (top of your screen) also shoots.'],
    ['One-timer', 'Flick a pass, then tap before it arrives: the teammate who gets it fires straight away.'],
    ['Steal / check', 'When they have the puck, tap near him: your player closest to the tap pokes at it. Or put a thumb in open ice and your best player rushes the puck. Drag hard into an opponent to body-check him.'],
    ['Goalie', 'The strip behind your net (bottom) moves your goalie: slide sideways, push up to come out. Quick swipe = reach.'],
    ['Faceoff', 'After the buzzer the puck pops up from centre ice. Nobody can touch it until it drops low - then the nearest player grabs it. Have a player ready near centre.'],
    ['Goal', 'Your goal is always at the bottom. First to 5 or 3 minutes. Tap to skip replays.']];
  var css = document.createElement('style');
  css.textContent = '#htBtn{position:fixed;z-index:9998;top:8px;right:8px;width:30px;height:30px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font:700 16px system-ui;cursor:pointer}' +
    '#htPan{position:fixed;z-index:9999;inset:6% 5%;max-width:440px;margin:auto;background:#0e1630f4;border:1px solid #fff3;border-radius:14px;color:#fff;font:15px/1.4 system-ui;display:none;flex-direction:column;box-shadow:0 8px 30px #000a}' +
    '#htPan h3{margin:0;padding:12px 14px 6px;font-size:18px}#htScroll{overflow-y:auto;padding:0 14px;flex:1;-webkit-overflow-scrolling:touch}#htScroll .s{margin:0 0 12px}#htScroll .s b.k{display:block;color:#ffb300;font-size:13px;letter-spacing:.06em;text-transform:uppercase}' +
    '#htPan .r{display:flex;gap:8px;padding:10px 14px}#htPan .r button{flex:1;border:0;border-radius:9px;padding:9px;font:700 14px system-ui;cursor:pointer;background:#fff2;color:#fff}#htClose{background:#ffb300!important;color:#000!important}' +
    '.htLink{display:block;width:100%;margin-top:8px;background:none;border:0;color:#fff;opacity:.8;text-decoration:underline;font:14px system-ui;cursor:pointer}';
  document.head.appendChild(css);
  var p = document.createElement('div'); p.id = 'htPan';
  p.innerHTML = '<h3>How to play</h3><div id="htScroll">' + H.map(function (h) { return '<p class="s"><b class="k">' + h[0] + '</b>' + h[1] + '</p>'; }).join('') + '<p style="height:20px"></p></div><div class="r">' +
    (window.HowTo ? '<button id="htDemo">Watch demo</button>' : '') + '<button id="htClose">Got it</button></div>';
  document.body.appendChild(p);
  var sc = p.querySelector('#htScroll'), auto = 0, pausedUntil = 0, raf = 0, pos = 0;
  function stop(e) { e.stopPropagation(); }
  ['pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'click'].forEach(function (k) { p.addEventListener(k, stop); });
  ['pointerdown', 'wheel', 'touchstart'].forEach(function (k) { sc.addEventListener(k, function () { pausedUntil = performance.now() + 4000; }, { passive: true }); });
  function tick(t) {   // ~18 px/s, pauses 4 s after any hand scroll, stops at the end
    if (p.style.display !== 'flex') return;
    if (t > pausedUntil) { if (Math.abs(sc.scrollTop - pos) > 2) pos = sc.scrollTop; pos += .3; sc.scrollTop = pos; } else pos = sc.scrollTop;
    if (sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1) raf = requestAnimationFrame(tick);
  }
  function open() { p.style.display = 'flex'; sc.scrollTop = 0; pos = 0; pausedUntil = performance.now() + 2500; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
  function close() { p.style.display = 'none'; cancelAnimationFrame(raf); }
  function tap(el, fn) { var last = 0; function go(e) { var n = Date.now(); if (n - last < 400) return; last = n; e.stopPropagation(); e.preventDefault && e.preventDefault(); fn(); } el.addEventListener('pointerup', go); el.addEventListener('click', go); ['pointerdown', 'touchstart'].forEach(function (k) { el.addEventListener(k, stop); }); }
  tap(p.querySelector('#htClose'), close);
  var d = p.querySelector('#htDemo'); if (d) tap(d, function () { close(); HowTo.play(); });
  var b = document.createElement('button'); b.id = 'htBtn'; b.textContent = '?'; b.setAttribute('aria-label', 'How to play'); document.body.appendChild(b); tap(b, open);
  // lobby link (phone join card is built by minikit; add the link whenever it appears)
  setInterval(function () { var k = document.getElementById('kjoin'); if (k && !k.querySelector('.htLink')) { var l = document.createElement('button'); l.className = 'htLink'; l.textContent = 'How to play'; k.appendChild(l); tap(l, open); } }, 500);
  window.BubbleHowTo = { open: open, close: close };
})();
