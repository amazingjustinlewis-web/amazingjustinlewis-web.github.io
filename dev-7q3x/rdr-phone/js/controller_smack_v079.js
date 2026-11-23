/* Phone controller v0.7.10: shake-to-smack (devicemotion, iOS permission) plus
   tap-anywhere, sent immediately on pointerdown over a fast/unreliable channel
   when available, with a phone timestamp so the TV can compensate for lag. */
(function (w) {
  'use strict';
  var lastShake = 0, motionOn = false, asked = false, cueOn = false;
  var SHAKE = 18; /* m/s^2 delta threshold */

  function $(id) { return document.getElementById(id); }
  function myPid() {
    try { var st = w.RDRC && RDRC.state && RDRC.state(); return st && st.me && st.me.id; } catch (e) { return null; }
  }
  function sendFast(m) {
    var c = w._rdr076Client || w._rdr075Client;
    if (c && typeof c.sendFast === 'function') return c.sendFast(m);
    if (w.RDRC && typeof RDRC.send === 'function') return RDRC.send(m);
    if (c && typeof c.send === 'function') return c.send(m);
    return false;
  }
  function fire(why) {
    var pad = $('smackPad');
    var armed = !!(pad && pad.classList.contains('on')) || cueOn;
    if (!armed) return;
    var now = Date.now();
    if (now - fire._at < 90) return;
    fire._at = now;
    var tPhone = (typeof performance !== 'undefined' ? performance.now() : now);
    /* Game-clock estimate if the cue carried a TV now + wall mapping (existing pad math). */
    var atGame = null;
    try {
      var cue = w._rdrSmackCue;
      if (cue && cue.now0 != null && cue.atWall != null) atGame = cue.now0 + (performance.now() - cue.atWall);
    } catch (e) {}
    sendFast({ t: 'smackTap', pid: myPid(), at: atGame, atPhone: tPhone, clock: atGame != null ? 'game' : 'phone', why: why || 'tap', wall: now });
    try { if (navigator.vibrate) navigator.vibrate(18); } catch (e2) {}
  }
  fire._at = 0;

  function onMotion(e) {
    var a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
    var mag = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
    if (!onMotion.prev) { onMotion.prev = mag; return; }
    var d = Math.abs(mag - onMotion.prev); onMotion.prev = mag * 0.5 + onMotion.prev * 0.5;
    if (d > SHAKE && Date.now() - lastShake > 280) { lastShake = Date.now(); fire('shake'); }
  }
  function enableMotion() {
    if (motionOn) return;
    function go() {
      motionOn = true;
      w.addEventListener('devicemotion', onMotion, { passive: true });
    }
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      if (asked) return;
      asked = true;
      DeviceMotionEvent.requestPermission().then(function (s) { if (s === 'granted') go(); }).catch(function () {});
    } else go();
  }

  function hint() {
    var h = document.querySelector('#smackPad .smack-hint');
    if (h && !h._v079) { h._v079 = true; h.textContent = 'Tap anywhere or shake — gold is PERFECT'; }
  }
  function armFromDom() {
    var pad = $('smackPad');
    cueOn = !!(pad && pad.classList.contains('on'));
    if (cueOn) { hint(); enableMotion(); }
  }

  document.addEventListener('pointerdown', function (e) {
    var pad = $('smackPad');
    if (!pad || !pad.classList.contains('on')) return;
    /* Tap anywhere on the pad (not only the SMACK button). Don't steal the button's own handler twice. */
    fire('tap');
  }, { capture: true, passive: true });

  /* iOS needs a user gesture for motion permission: first pad open + first tap. */
  document.addEventListener('pointerup', function () { if ($('smackPad') && $('smackPad').classList.contains('on')) enableMotion(); }, { passive: true });

  var obs = new MutationObserver(armFromDom);
  function boot() {
    var pad = $('smackPad');
    if (pad) obs.observe(pad, { attributes: true, attributeFilter: ['class'] });
    hint();
    armFromDom();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
  setInterval(armFromDom, 800);

  /* Keep a copy of the current cue's clock mapping if controller_tv077 sets it. */
  var prevSet;
  function hookCue() {
    /* controller_tv077 keeps `cue` closed over; we also watch smackCue messages via RDRC if present. */
  }
  /* Stash cue clock mapping and exchange light pings so the TV can estimate offset. */
  function hookMsgs() {
    var net = w.RDRC && RDRC.net && (typeof RDRC.net === 'function' ? RDRC.net() : RDRC.net);
    /* Fall back: wrap nothing; watch join-status pages. */
    if (hookMsgs._on) return;
    hookMsgs._on = true;
    document.addEventListener('rdr-smack-cue', function (e) { w._rdrSmackCue = e.detail; });
  }
  var lastPing = 0;
  function ping() {
    if (Date.now() - lastPing < 2000) return;
    lastPing = Date.now();
    sendFast({ t: 'latPing', tPhone: (typeof performance !== 'undefined' ? performance.now() : Date.now()), pid: myPid(), echo: 1 });
  }
  function hookIncoming() {
    /* If the controller already has onMsg, we also listen via a Client wrapper. */
    var N = w.RDRNet; if (!N || hookIncoming._on) return !!N;
    ['Client', 'LocalClient'].forEach(function (name) {
      var C = N[name]; if (!C || !C.prototype || C.prototype._tv0710SmackIn) return;
      C.prototype._tv0710SmackIn = true;
      var orig = C.prototype.o && null;
    });
    /* Wrap RDRC? The message path is Client o.onMessage set in controller_v074. Patch by wrapping after net client exists. */
    var tryWrap = function () {
      var c = w._rdr076Client || w._rdr075Client;
      if (!c || c._tv0710In) return;
      c._tv0710In = true;
      var o = c.o; if (!o || typeof o.onMessage !== 'function') return;
      var prev = o.onMessage.bind(o);
      o.onMessage = function (d) {
        if (d && (d.t === 'smackCue' || (d.t === 'state' && d.smack))) {
          var m = d.t === 'smackCue' ? d : d.smack;
          if (m && m.now != null) w._rdrSmackCue = { now0: m.now, start: m.start, atWall: performance.now(), passes: m.passes };
        }
        if (d && d.t === 'latPong' && d.tPhone != null) {
          var tNow = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          var rtt = tNow - d.tPhone;
          sendFast({ t: 'latPing', tPhone: d.tTv, tTvEcho: tNow, rtt: rtt, pid: myPid() });
        }
        return prev(d);
      };
    };
    setInterval(tryWrap, 500);
    tryWrap();
  }
  hookMsgs(); hookIncoming();
  setInterval(function () { if ($('smackPad') && $('smackPad').classList.contains('on')) ping(); }, 2000);

  w.RDRSmackInput = { fire: fire, enableMotion: enableMotion };
})(window);
