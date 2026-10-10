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
  function start(c) {
    code = c; document.getElementById('join').classList.add('hide');
    var o = { code: code, onStatus: function (s) { dot.classList.toggle('on', s === 'online'); },
      onOpen: function () { net.send({ t: 'hello', s: pad.s }); },
      onMessage: function (m) { if (m && m.t === 'st') pad.setState(m); } };
    net = local ? new LRNet.LocalClient(o) : new LRNet.Client(o);
  }
  if (code) start(code);
  else { var j = document.getElementById('join'); j.classList.remove('hide'); document.getElementById('go').onclick = function () { var v = document.getElementById('code').value.trim().toUpperCase(); if (v.length === 4) start(v); }; }
})();
