/* Phone controller v0.7.9: "Add selfie" uses the same bobblehead flow as solo v0.11
   (camera snap, egg head with eye/mouth markers, Confirm). Sends a compressed JPEG
   plus alignment points over the existing { t: 'selfie', pid, data } PeerJS /
   BroadcastChannel message (pts and skin are optional extras). Usable in the lobby
   and between turns. The older circular-crop selfie sheet is hidden. */
(function (w) {
  'use strict';
  var SF_PTS = { le: { x: 0.37, y: 0.43 }, re: { x: 0.63, y: 0.43 }, mo: { x: 0.5, y: 0.72 } };
  var SIZE = 192, QUALITY = 0.74, MAX_CHARS = 100000;
  var stream = null, sfData = null, sfPts = null, hasSelfie = false, lastSent = null;

  function $(id) { return document.getElementById(id); }

  function actuallySend(m) {
    if (w.RDRC && typeof RDRC.send === 'function') { RDRC.send(m); return true; }
    var c = w._rdr076Client || w._rdr075Client;
    if (c && typeof c.send === 'function') { c.send(m); return true; }
    return false;
  }
  function myPid() {
    try { var st = w.RDRC && RDRC.state && RDRC.state(); return st && st.me && st.me.id; } catch (e) { return null; }
  }
  function isMyTurn() {
    try { var st = w.RDRC && RDRC.state && RDRC.state(); return !!(st && st.turn && st.me && st.turn.pid === st.me.id && st.phase === 'play'); } catch (e) { return false; }
  }
  function inLobby() { var el = $('lobby'); return !!(el && !el.hidden); }
  function inGame() { var el = $('game'); return !!(el && !el.hidden); }
  function blocking() {
    var boom = $('boom'), pu = $('payup'), smack = $('smackPad');
    if (boom && !boom.hidden) return true;
    if (pu && !pu.hidden && !pu.classList.contains('under-boom')) return true;
    if (smack && smack.classList && smack.classList.contains('on')) return true;
    return false;
  }
  /* Lobby, or in a live game between turns (not over a takeover). */
  function selfieAllowed() {
    if (blocking()) return false;
    if (inLobby()) return true;
    if (inGame() && !isMyTurn()) return true;
    return false;
  }

  function cropTo(src, sw, sh) {
    var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
    var c2 = cv.getContext('2d'), k = Math.min(sw, sh);
    /* Mirror a live video frame so it matches the preview the player just saw. */
    if (src && src.tagName === 'VIDEO') {
      c2.translate(SIZE, 0); c2.scale(-1, 1);
    }
    c2.drawImage(src, (sw - k) / 2, (sh - k) / 2, k, k, 0, 0, SIZE, SIZE);
    var q = QUALITY, out = cv.toDataURL('image/jpeg', q);
    while (out.length > MAX_CHARS && q > 0.45) {
      q -= 0.08; out = cv.toDataURL('image/jpeg', q);
    }
    return out;
  }

  function sampleSkin(im, pts) {
    try {
      var cv2 = document.createElement('canvas'); cv2.width = cv2.height = 64;
      var c2 = cv2.getContext('2d'); c2.drawImage(im, 0, 0, 64, 64);
      var P = pts || SF_PTS;
      function px(u, v) {
        var d = c2.getImageData(Math.max(0, Math.min(61, Math.round(u * 64) - 1)), Math.max(0, Math.min(61, Math.round(v * 64) - 1)), 3, 3).data;
        var r = 0, g = 0, b = 0, i;
        for (i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        return [r / 9, g / 9, b / 9];
      }
      function hex(c, m) { return '#' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v * m))).toString(16).padStart(2, '0'); }).join(''); }
      var a = px(P.le.x - 0.02, P.le.y + 0.15), b = px(P.re.x + 0.02, P.re.y + 0.15);
      return { skin: hex([0, 1, 2].map(function (i) { return (a[i] + b[i]) / 2; }), 1), lid: hex([0, 1, 2].map(function (i) { return (a[i] + b[i]) / 2; }), 0.9) };
    } catch (e) { return { skin: null, lid: null }; }
  }

  function stopCam() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    var v = $('sfVid078'); if (v) v.srcObject = null;
  }

  function copyPts(src) {
    var p = src || SF_PTS;
    return { le: { x: p.le.x, y: p.le.y }, re: { x: p.re.x, y: p.re.y }, mo: { x: p.mo.x, y: p.mo.y } };
  }

  function placeMarks() {
    var stage = $('sfStage078'); if (!stage || !sfPts) return;
    stage.querySelectorAll('.mk').forEach(function (m) {
      var q = sfPts[m.getAttribute('data-k')];
      if (q) { m.style.left = (q.x * 100) + '%'; m.style.top = (q.y * 100) + '%'; }
    });
  }

  function selfieDom() {
    var el = $('rdrSelfie'); if (el) return el;
    el = document.createElement('div'); el.id = 'rdrSelfie'; el.hidden = true;
    el.innerHTML =
      '<div class="sf-in"><b class="sf-t">SELFIE BOBBLEHEAD</b>' +
      '<div class="sf-align" id="sfAlign078" hidden><div class="sf-stage" id="sfStage078"><img id="sfAImg078" alt="">' +
      '<i class="sf-egg"></i>' +
      '<i class="mk" data-k="le"><s></s><em>eye</em></i>' +
      '<i class="mk" data-k="re"><s></s><em>eye</em></i>' +
      '<i class="mk mo" data-k="mo"><s></s><em>mouth</em></i></div>' +
      '<p class="sf-msg">Drag the markers onto your eyes and mouth</p>' +
      '<div class="sf-btns"><button type="button" class="btn ghost" id="sfAgain078">Retake</button>' +
      '<button type="button" class="btn go" id="sfOk078">Confirm</button></div></div>' +
      '<div class="sf-cap" id="sfCap078"><div class="sf-ring"><video id="sfVid078" playsinline muted autoplay></video>' +
      '<img id="sfPrev078" alt=""></div>' +
      '<p class="sf-msg" id="sfMsg078">Line your face up in the circle.</p>' +
      '<div class="sf-btns"><button type="button" class="btn go" id="sfSnap078">\uD83D\uDCF8 Snap</button>' +
      '<label class="btn" id="sfFileL078">Use a photo<input type="file" id="sfFile078" accept="image/*" capture="user" hidden></label></div>' +
      '<div class="sf-btns"><button type="button" class="btn ghost" id="sfRemove078">Remove selfie</button>' +
      '<button type="button" class="btn ghost" id="sfX078">Cancel</button></div></div></div>';
    document.body.appendChild(el);

    $('sfX078').addEventListener('click', closeSelfie);
    $('sfRemove078').addEventListener('click', function () { removeSelfie(); closeSelfie(); });
    $('sfFile078').addEventListener('change', function (e) { fromFile(e.target.files && e.target.files[0]); e.target.value = ''; });
    $('sfSnap078').addEventListener('click', function () {
      var v = $('sfVid078');
      if (stream && v && v.videoWidth) startAlign(cropTo(v, v.videoWidth, v.videoHeight));
      else $('sfFile078').click();
    });
    $('sfOk078').addEventListener('click', confirmSelfie);
    $('sfAgain078').addEventListener('click', function () {
      $('sfAlign078').hidden = true; $('sfCap078').hidden = false; openSelfie();
    });

    var stage = $('sfStage078'), drag = null;
    function at(e) {
      var r = stage.getBoundingClientRect();
      var ev = (e.touches && e.touches[0]) || e;
      return { x: Math.max(0.03, Math.min(0.97, (ev.clientX - r.left) / r.width)), y: Math.max(0.03, Math.min(0.97, (ev.clientY - r.top) / r.height)) };
    }
    stage.addEventListener('pointerdown', function (e) {
      var m = e.target.closest && e.target.closest('.mk'), q = at(e);
      if (!sfPts) sfPts = copyPts();
      if (m) drag = m.getAttribute('data-k');
      else {
        drag = Object.keys(sfPts).sort(function (a, b) {
          return Math.hypot(sfPts[a].x - q.x, sfPts[a].y - q.y) - Math.hypot(sfPts[b].x - q.x, sfPts[b].y - q.y);
        })[0];
        sfPts[drag] = q; placeMarks();
      }
      try { stage.setPointerCapture(e.pointerId); } catch (er) {}
      e.preventDefault();
    });
    stage.addEventListener('pointermove', function (e) { if (!drag) return; sfPts[drag] = at(e); placeMarks(); });
    function up() { drag = null; }
    stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
    return el;
  }

  function startAlign(data) {
    selfieDom(); sfData = data; sfPts = copyPts();
    stopCam();
    $('sfAImg078').src = data;
    $('sfCap078').hidden = true; $('sfAlign078').hidden = false;
    placeMarks();
  }

  function fromFile(file) {
    if (!file) return;
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () { startAlign(cropTo(im, im.naturalWidth, im.naturalHeight)); URL.revokeObjectURL(url); };
    im.onerror = function () { setMsg('That photo could not be read'); URL.revokeObjectURL(url); };
    im.src = url;
  }

  function setMsg(t) { var m = $('sfMsg078'); if (m) m.textContent = t; }

  function openSelfie() {
    var el = selfieDom();
    var old = $('selfieSheet'); if (old) old.classList.remove('on');
    $('sfAlign078').hidden = true; $('sfCap078').hidden = false;
    el.hidden = false;
    var prev = $('sfPrev078');
    if (prev) { prev.src = hasSelfie && lastSent ? lastSent : ''; prev.hidden = !(hasSelfie && lastSent); }
    $('sfRemove078').hidden = !hasSelfie;
    $('sfSnap078').textContent = hasSelfie ? '\uD83D\uDCF8 Retake' : '\uD83D\uDCF8 Snap';
    var md = navigator.mediaDevices;
    if (md && md.getUserMedia) {
      setMsg('Line your face up in the circle.');
      md.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } }, audio: false }).then(function (st) {
        if ($('rdrSelfie').hidden) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = st; var v = $('sfVid078'); v.srcObject = st; v.play().catch(function () {});
        if (prev) prev.hidden = true;
      }).catch(function () { setMsg('No camera here: tap “Use a photo” (or Snap) to pick one.'); });
    } else setMsg('Tap Snap or “Use a photo” to take one.');
  }

  function closeSelfie() {
    var el = $('rdrSelfie'); if (el) el.hidden = true;
    stopCam();
  }

  function confirmSelfie() {
    if (!sfData) return;
    var pts = copyPts(sfPts);
    var im = new Image();
    im.onload = function () {
      var skin = sampleSkin(im, pts);
      var msg = { t: 'selfie', pid: myPid(), data: sfData, pts: pts };
      if (skin.skin) { msg.skin = skin.skin; msg.lid = skin.lid; }
      var ok = actuallySend(msg);
      hasSelfie = true; lastSent = { data: sfData, pts: pts, skin: skin, msg: msg };
      paintButtons();
      closeSelfie();
      toast(ok ? '\uD83D\uDCF8 Bobblehead on!' : 'Saved on this phone — waiting to reach the TV.');
    };
    im.onerror = function () { toast('Could not read that photo'); };
    im.src = sfData;
  }

  function removeSelfie() {
    hasSelfie = false; lastSent = null; sfData = null;
    actuallySend({ t: 'selfie', pid: myPid(), clear: true });
    paintButtons();
  }

  function toast(text) {
    var el = $('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = text; el.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { el.hidden = true; }, 1800);
  }

  /* If the player confirmed before their seat id was known, send again once it is. */
  function flushPending() {
    if (!hasSelfie || !lastSent || !lastSent.msg) return;
    var pid = myPid();
    if (pid == null) return;
    if (lastSent.msg.pid === pid && lastSent.sentPid === pid) return;
    lastSent.msg.pid = pid;
    lastSent.sentPid = pid;
    actuallySend(lastSent.msg);
  }

  function paintButtons() {
    var fab = $('selfieFab');
    if (fab) {
      fab.classList.add('selfieAddFab');
      fab.hidden = !selfieAllowed();
      fab.textContent = hasSelfie ? '\uD83D\uDCF8 Selfie' : '\uD83D\uDCF8 Add selfie';
      fab.title = hasSelfie ? 'Retake or remove your selfie' : 'Add selfie';
      fab.setAttribute('aria-label', fab.title);
    }
    var lb = $('lobbySelfieBtn');
    if (lb) {
      lb.hidden = !inLobby();
      lb.textContent = hasSelfie ? '\uD83D\uDCF8 Retake selfie' : '\uD83D\uDCF8 Add selfie';
      lb.classList.toggle('on', hasSelfie);
    }
    var old = $('selfieSheet'); if (old) old.classList.remove('on');
    if (!selfieAllowed()) {
      var ov = $('rdrSelfie');
      if (ov && !ov.hidden) closeSelfie();
    }
  }

  function wireFab() {
    var fab = $('selfieFab');
    if (fab && !fab._v078) {
      fab._v078 = true;
      fab.addEventListener('click', function (e) {
        e.preventDefault(); e.stopImmediatePropagation();
        var old = $('selfieSheet'); if (old) old.classList.remove('on');
        var ov = $('rdrSelfie');
        if (ov && !ov.hidden) closeSelfie(); else openSelfie();
      }, true);
    }
    var lb = $('lobbySelfieBtn');
    if (lb && !lb._v078) {
      lb._v078 = true;
      lb.addEventListener('click', function (e) { e.preventDefault(); openSelfie(); });
    }
  }

  function boot() { wireFab(); paintButtons(); flushPending(); }
  setInterval(boot, 200);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  w.RDRControllerSelfie = {
    open: openSelfie, close: closeSelfie, has: function () { return hasSelfie; },
    startAlign: startAlign, cropTo: cropTo
  };
})(window);
