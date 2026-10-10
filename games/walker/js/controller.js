/* WALKER phone: six big buttons. Sends taps to the TV, gets back which area we're in and floating moments. */
(function () {
  var q = new URLSearchParams(location.search), code = (q.get('room') || '').toUpperCase(), local = q.get('local') === '1';
  var net = null, dot = document.getElementById('dot'), wake = null;
  var pad = new WalkerPad(document.getElementById('pad'), { send: function (m) { if (net) net.send(m); }, onSetting: function (k) { if (k === 'awake') applyWake(); } });
  window.WALKER_PAD = pad;
  function applyWake() {
    if (pad.s.awake && 'wakeLock' in navigator) { if (!wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {}); }
    else if (!pad.s.awake && wake) { wake.release(); wake = null; }
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') applyWake(); });
  document.addEventListener('pointerdown', applyWake, { once: true });
  var lk = document.getElementById('linking'), linked = false, t0 = 0, watch = null;
  function lkShow(msg, sub, retry) { lk.classList.remove('hide'); document.getElementById('lkMsg').textContent = msg; document.getElementById('lkSub').textContent = sub || ''; document.getElementById('lkRetry').classList.toggle('hide', !retry); }
  function confirmed() { if (!linked) { linked = true; lk.classList.add('hide'); clearInterval(watch); } }
  document.getElementById('lkRetry').onclick = function () { t0 = Date.now(); lkShow('Connecting\u2026'); if (net && net.reconnect) net.reconnect(); };
  function start(c) {
    code = c; document.getElementById('join').classList.add('hide');
    t0 = Date.now(); lkShow('Connecting\u2026');
    var o = { code: code, onStatus: function (s) { dot.classList.toggle('on', s === 'online'); if (s !== 'online' && linked) { linked = false; t0 = Date.now(); lkShow('Reconnecting\u2026'); startWatch(); } if (s === 'noroom' && !linked) lkShow('Looking for the TV\u2026', 'Is Walker open on the TV? Room ' + code); },
      onOpen: function () { net.send({ t: 'hello', s: pad.s }); },
      onMessage: function (m) { if (m && m.t === 'st') { confirmed(); pad.setState(m); } } };   // linked = the TV actually answered
    net = local ? new LRNet.LocalClient(o) : new LRNet.Client(o);
    startWatch();
  }
  function startWatch() {
    clearInterval(watch);
    watch = setInterval(function () {
      if (linked) { clearInterval(watch); return; }
      if (net && net.status === 'online') net.send({ t: 'hello', s: pad.s });
      var secs = (Date.now() - t0) / 1000;
      if (secs > 40) lkShow('Can\u2019t reach the TV', 'Check Walker is open on the TV and this device is on the same Wi-Fi. Still trying\u2026', true);
      else if (secs > 12) lkShow('Still connecting\u2026', 'Room ' + code);
    }, 3000);
  }
  if (code) start(code);
  else { var j = document.getElementById('join'); j.classList.remove('hide'); document.getElementById('go').onclick = function () { var v = document.getElementById('code').value.trim().toUpperCase(); if (v.length === 4) start(v); }; }
})();
