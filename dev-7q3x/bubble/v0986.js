/* v0.9.86: bigger setup typography/art/pills; phone rink stays portrait during play.
   Setup still reacts to rotation (985 portrait vs landscape layouts).
   On Enter / start-play (a user gesture): request fullscreen + orientation.lock('portrait')
   where supported. Fallback: CSS-rotate #rot 90° so the rink stays on the phone's
   portrait axis, remap touches, and keep V.fit on portrait metrics (no landscape relayout).
   ?rotlock=0 disables the play lock. */
(function (root) {
  'use strict';
  var rotOff = /[?&]rotlock=0(?:&|$)/.test(location.search || '');
  var inPlay = false, rotA = 0, hookedFit = false;

  function isPad() { return /pad/i.test(location.pathname || ''); }

  function css() {
    if (document.getElementById('ztp986css')) return;
    var s = document.createElement('style'); s.id = 'ztp986css';
    s.textContent =
      /* noticeably larger captions, art frame, and tappable pills (min ~44px) */
      '#ztpSetup .ztp-tcard{padding:14px 14px 18px}' +
      '#ztpSetup .ztp-tcard p{margin:.7em .3em 0;font:400 22px/1.3 Georgia,serif!important;letter-spacing:.02em}' +
      '#ztpSetup.land .ztp-tcard{width:min(48vw,420px)}' +
      '#ztpSetup.land .ztp-row{gap:42px}' +
      '#ztpSetup.port .ztp-solo p{font-size:clamp(22px,4.2vh,34px);line-height:1.3;margin:.45em .15em .1em}' +
      '#ztpSetup.port .ztp-stage{padding:6px 4px 0}' +
      '#ztpSetup.port .ztp-solo{width:min(98vw,640px)}' +
      '#ztpSetup.port .ztp-solo canvas,#ztpSetup.port .ztp-solo img{flex:1 1 auto;width:100%;height:100%;min-height:0;object-fit:contain}' +
      '#ztpSetup .ztp-dock h2{margin:0 0 12px;font:400 clamp(18px,3.2vh,28px)/1 Georgia,serif;letter-spacing:.28em}' +
      '#ztpSetup .ztp-pills{gap:10px}' +
      '#ztpSetup .ztp-pills button{font:16px/1 Georgia,serif;letter-spacing:.08em;min-height:44px;padding:0 1.2em;' +
      'display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box}' +
      '#ztpSetup.land .ztp-pills button{font-size:15px;min-height:44px}' +
      '#ztpSetup.port .ztp-dock{max-height:38vh;padding:8px 10px calc(12px + env(safe-area-inset-bottom))}' +
      '#ztpSetup .ztp-sheet,body.ztp-setup #kjoin.ztp-join-panel{bottom:calc(108px + env(safe-area-inset-bottom))}' +
      /* during play-lock, keep fixed UI inside #rot so a CSS rotate actually carries the rink */
      'body.ztp-rotlock #rot{position:fixed;left:0;top:0;transform-origin:0 0;overflow:hidden;z-index:1}' +
      'body.ztp-rotlock #rot canvas.full,body.ztp-rotlock #rot #cv,' +
      'body.ztp-rotlock #rot #score,body.ztp-rotlock #rot #big,body.ztp-rotlock #rot #tip,' +
      'body.ztp-rotlock #rot #fx,body.ztp-rotlock #rot #stage,body.ztp-rotlock #rot #wrap,' +
      'body.ztp-rotlock #rot #pad{position:absolute!important;inset:0;width:100%!important;height:100%!important}' +
      'body.ztp-rotlock #rot #score{inset:auto 0  auto 0;top:6px;height:auto}' +
      'body.ztp-rotlock #rot #tip{inset:auto 0 8px 0;top:auto;height:auto}';
    document.head.appendChild(s);
  }

  /* Larger figures so the graphic fills the card instead of floating in empty frame. */
  function drawArt(cv, i, port) {
    var w = cv.width = port ? 720 : 640, h = cv.height = port ? 980 : 400, x = cv.getContext('2d');
    x.fillStyle = '#050403'; x.fillRect(0, 0, w, h);
    x.save();
    x.translate(w * 0.5, h * (port ? 0.70 : 0.78));
    x.scale(1, port ? 0.40 : 0.28);
    var iceR = port ? 420 : 260;
    var g = x.createRadialGradient(0, 0, 10, 0, 0, iceR);
    g.addColorStop(0, 'rgba(226,184,74,0.22)');
    g.addColorStop(0.5, 'rgba(200,160,80,0.09)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, iceR, 0, 7); x.fill();
    x.strokeStyle = 'rgba(226,184,74,0.32)'; x.lineWidth = 4; x.beginPath(); x.arc(0, 0, iceR * 0.82, 0, 7); x.stroke();
    x.restore();
    function figure(cx, cy, sc, pose, gold) {
      x.save(); x.translate(cx, cy); x.scale(sc, sc);
      x.strokeStyle = gold ? '#e2b84a' : '#c08a22';
      x.fillStyle = gold ? '#1a150c' : '#0c0a06';
      x.lineWidth = 4; x.lineJoin = 'round'; x.lineCap = 'round';
      x.beginPath(); x.ellipse(0, -20, 16, 28, 0, 0, 7); x.fill(); x.stroke();
      x.beginPath(); x.arc(0, -56, 12, 0, 7); x.fill(); x.stroke();
      if (pose === 'check') {
        x.beginPath(); x.moveTo(-8, -8); x.lineTo(-36, 8); x.lineTo(-20, 30); x.stroke();
        x.beginPath(); x.moveTo(8, -6); x.lineTo(34, -28); x.lineTo(44, 6); x.stroke();
        x.beginPath(); x.moveTo(0, -20); x.lineTo(18, -70); x.stroke();
      } else if (pose === 'fall') {
        x.rotate(0.9);
        x.beginPath(); x.ellipse(0, -10, 16, 26, 0.3, 0, 7); x.fill(); x.stroke();
        x.beginPath(); x.arc(18, -40, 11, 0, 7); x.fill(); x.stroke();
      } else if (pose === 'poke') {
        x.beginPath(); x.moveTo(10, -18); x.lineTo(70, 8); x.lineWidth = 5; x.stroke();
        x.beginPath(); x.moveTo(-10, 0); x.lineTo(-28, 36); x.stroke();
      } else if (pose === 'stumble') {
        x.rotate(-0.45);
        x.beginPath(); x.ellipse(0, -16, 14, 24, 0, 0, 7); x.fill(); x.stroke();
        x.beginPath(); x.arc(0, -46, 11, 0, 7); x.fill(); x.stroke();
      } else if (pose === 'slap') {
        x.beginPath(); x.moveTo(-30, 10); x.lineTo(50, -50); x.lineWidth = 5; x.stroke();
        x.beginPath(); x.arc(54, -56, 5, 0, 7); x.fillStyle = '#fbe7a1'; x.fill();
      } else if (pose === 'goalie') {
        x.beginPath(); x.ellipse(0, 6, 28, 16, 0, 0, 7); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(20, -20); x.lineTo(48, -8); x.lineWidth = 6; x.stroke();
      } else {
        x.beginPath(); x.moveTo(-12, 8); x.lineTo(-8, 40); x.moveTo(12, 8); x.lineTo(10, 40); x.stroke();
      }
      x.restore();
    }
    var sc = port ? 3.55 : 1.45, cy = port ? 0.52 : 0.52;
    if (i === 0) { figure(w * 0.34, h * cy, 1.15 * sc, 'check', 1); figure(w * 0.70, h * (cy + 0.06), 1.05 * sc, 'fall', 0); }
    else if (i === 1) {
      figure(w * 0.32, h * (cy + 0.02), 1.15 * sc, 'poke', 1);
      figure(w * 0.70, h * (cy + 0.04), 1.0 * sc, 'stumble', 0);
      x.fillStyle = '#fbe7a1'; x.beginPath(); x.arc(w * 0.80, h * (port ? 0.72 : 0.72), port ? 16 : 8, 0, 7); x.fill();
    } else if (i === 2) {
      figure(w * 0.46, h * cy, 1.2 * sc, 'slap', 1);
      x.strokeStyle = 'rgba(226,184,74,.35)';
      x.strokeRect(w * 0.74, h * (port ? 0.16 : 0.18), port ? 110 : 80, port ? 200 : 100);
    } else {
      figure(w * 0.42, h * (cy + 0.04), 1.2 * sc, 'goalie', 1);
      x.fillStyle = '#c08a22';
      x.fillRect(w * 0.22, h * (port ? 0.78 : 0.84), port ? 320 : 200, port ? 18 : 8);
      x.fillStyle = '#fbe7a1';
      x.beginPath(); x.arc(w * 0.66, h * (port ? 0.78 : 0.84) + (port ? 9 : 4), port ? 20 : 12, 0, 7); x.fill();
    }
    x.strokeStyle = 'rgba(251,231,161,0.15)'; x.strokeRect(8, 8, w - 16, h - 16);
  }

  function boostCards() {
    var box = document.getElementById('ztpSetup');
    if (!box) return;
    var port = box.classList.contains('port');
    var cards = box.querySelectorAll('.ztp-tcard');
    for (var i = 0; i < cards.length; i++) {
      var el = cards[i], cv = el.querySelector('canvas');
      if (!cv) continue;
      var idx = el.dataset.i != null ? +el.dataset.i : i % 4;
      var solo = port && el.classList.contains('ztp-solo');
      /* 985 may reuse a canvas after a swipe; always paint our larger art. */
      if (cv._z986 === idx + (solo ? 10 : 0) && cv.width) continue;
      drawArt(cv, idx, solo || (port && cards.length === 1));
      cv._z986 = idx + (solo ? 10 : 0);
    }
  }

  function hookPills() {
    var box = document.getElementById('ztpSetup');
    if (!box || box._z986hook) return;
    box._z986hook = 1;
    box.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest && ev.target.closest('.ztp-pills button');
      if (!b) return;
      var t = (b.textContent || '').toLowerCase();
      if (/^enter$/.test(t) || /play the computer|host for 2|join \/ room|watch a game/.test(t)) {
        startPlayLock();
      }
    }, true);
  }

  function hookJoin() {
    ['kgo', 'vsai', 'host2'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && !el._z986) {
        el._z986 = 1;
        el.addEventListener('click', startPlayLock, true);
      }
    });
  }

  function startPlayLock() {
    if (rotOff || !isPad()) return;
    inPlay = true;
    document.body.classList.add('ztp-rotlock');
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        var el = document.documentElement;
        var fn = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
        if (fn) {
          var p = fn.call(el);
          if (p && p.catch) p.catch(function () {});
        }
      }
    } catch (e) {}
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(function () {});
      }
    } catch (e2) {}
    applyPlayOrient();
  }

  function devAngle() {
    var a = screen.orientation && screen.orientation.angle != null ? screen.orientation.angle : (window.orientation || 0);
    return ((a % 360) + 360) % 360;
  }

  function hookFit(V) {
    if (!V || hookedFit || rotOff) return;
    hookedFit = true;
    var orig = V.fit.bind(V);
    V.fit = function (W, H, top, horiz, bot) {
      if (inPlay && isPad()) {
        var vw = innerWidth, vh = innerHeight;
        if (vw > vh) { W = vh; H = vw; }
        else { W = vw; H = vh; }
        if (top == null) top = 34;
        return orig(W, H, top, false, bot);
      }
      return orig(W, H, top, horiz, bot);
    };
  }

  function applyPlayOrient() {
    if (rotOff || !isPad() || !inPlay) return;
    var rot = document.getElementById('rot');
    var V = (root.BHP && BHP.V) || root.V;
    hookFit(V);
    var W = innerWidth, H = innerHeight, land = W > H;
    var a = devAngle();
    /* Don't depend on angle===90/270 (tablets / some phones report 0 in landscape). */
    rotA = land ? ((a === 270 || a === 180) ? 270 : 90) : 0;
    var VW = land ? H : W, VH = land ? W : H;
    if (rot) {
      document.body.classList.add('ztp-rotlock');
      rot.style.position = 'fixed';
      rot.style.left = '0';
      rot.style.top = '0';
      rot.style.transformOrigin = '0 0';
      rot.style.width = VW + 'px';
      rot.style.height = VH + 'px';
      rot.style.transform = rotA === 90 ? 'translate(0px,' + H + 'px) rotate(-90deg)'
        : rotA === 270 ? 'translate(' + W + 'px,0px) rotate(90deg)' : 'none';
    }
    if (V) {
      V.unrot = rotA ? function (X, Y) {
        return rotA === 90 ? [innerHeight - Y, X] : [Y, innerWidth - X];
      } : null;
      V.fit(VW, VH - 30, 34);
    }
  }

  function applyNoLock() {
    /* ?rotlock=0: undo the older pad size() CSS-rotate so rotate can relayout. */
    if (!rotOff || !isPad()) return;
    var rot = document.getElementById('rot');
    var W = innerWidth, H = innerHeight;
    if (rot) {
      rot.style.transform = 'none';
      rot.style.width = W + 'px';
      rot.style.height = H + 'px';
    }
    document.body.classList.remove('ztp-rotlock');
    var V = (root.BHP && BHP.V) || root.V;
    if (V) { V.unrot = null; V.fit(W, H - 30, 34); }
  }

  function onResize() {
    boostCards();
    if (rotOff) applyNoLock();
    else if (inPlay) applyPlayOrient();
  }

  function boot() {
    css();
    hookPills();
    hookJoin();
    var mo = new MutationObserver(function () {
      hookPills(); hookJoin(); boostCards();
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    addEventListener('resize', function () { requestAnimationFrame(onResize); });
    addEventListener('orientationchange', function () { setTimeout(onResize, 80); });
    if (screen.orientation && screen.orientation.addEventListener) {
      screen.orientation.addEventListener('change', function () { setTimeout(onResize, 80); });
    }
    /* Re-request lock on a later gesture if the first attempt was rejected (needs fullscreen). */
    document.addEventListener('pointerdown', function () {
      if (inPlay) startPlayLock();
    }, { passive: true });
    var n = 0;
    var t = setInterval(function () {
      n++;
      hookPills(); hookJoin(); boostCards();
      if (root.BHP && BHP.V) hookFit(BHP.V);
      if ((document.getElementById('ztpSetup') && document.querySelector('#ztpSetup .ztp-tcard')) || n > 60) {
        /* keep pumping a little so 985's delayed mount still gets bigger art */
        if (n > 80) clearInterval(t);
      }
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  root.ZTP986 = {
    startPlayLock: startPlayLock,
    applyPlayOrient: applyPlayOrient,
    boostCards: boostCards,
    inPlay: function () { return inPlay; }
  };
})(window);
