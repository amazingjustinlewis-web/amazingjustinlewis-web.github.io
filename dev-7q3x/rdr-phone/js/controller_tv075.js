/* Phone pad v0.7.5: SMACK timing button + mic/chat talk. */
(function (w) {
  'use strict';
  var cue = null, raf = 0;
  var MAX = 100;
  function $(id) { return document.getElementById(id); }
  function send(m) {
    /* controller.js send() is closed over; reuse the same net if we can find a hook, else walk buttons? */
    if (typeof w.RDR075Send === 'function') return w.RDR075Send(m);
    try { w.dispatchEvent(new CustomEvent('rdr075-out', { detail: m })); } catch (e) {}
  }

  /* hook the closed-over send by wrapping Client.send after connect — store last client via RDRNet patch leftover */
  function findSend() {
    if (w.RDR075Send) return w.RDR075Send;
    var N = w.RDRNet;
    /* last constructed client may be on a known global; try a few */
    var c = w.net || (w.RDR && RDR.client);
    return c && c.send && c.send.bind(c);
  }

  /* Patch RDRNet Client.send usage: wrap constructors already hook onMessage.
     Also intercept outgoing by wrapping Client.prototype.send if present. */
  function hookOutgoing() {
    var N = w.RDRNet; if (!N) return;
    ['Client', 'LocalClient'].forEach(function (name) {
      var C = N[name]; if (!C || !C.prototype || C.prototype._tv075SendHook) return;
      var orig = C.prototype.send;
      if (typeof orig !== 'function') return;
      C.prototype._tv075SendHook = true;
      C.prototype.send = function () {
        w._rdr075Client = this;
        return orig.apply(this, arguments);
      };
    });
  }
  hookOutgoing();
  setInterval(hookOutgoing, 500);

  function actuallySend(m) {
    if (w.RDRC && typeof RDRC.send === 'function') { RDRC.send(m); return true; }
    var c = w._rdr075Client;
    if (c && typeof c.send === 'function') { c.send(m); return true; }
    return false;
  }

  function mount() {
    if ($('smackPad')) return;
    var pad = document.createElement('div');
    pad.id = 'smackPad';
    pad.innerHTML = '<canvas id="smackRing" width="280" height="280"></canvas><button type="button" class="smack-hit" id="smackHit">SMACK</button><div class="smack-hint">Tap in the window — gold is PERFECT</div>';
    document.body.appendChild(pad);
    var fab = document.createElement('button');
    fab.id = 'talkFab'; fab.type = 'button'; fab.title = 'Talk'; fab.textContent = '🎤';
    document.body.appendChild(fab);
    var sheet = document.createElement('div');
    sheet.id = 'talkSheet';
    sheet.innerHTML = '<h3>Talk as your runner</h3><div class="row"><input id="talkText" maxlength="100" placeholder="Say a short line…" autocomplete="off"><button type="button" id="talkMic" class="ghost">MIC</button><button type="button" id="talkSend">SEND</button></div><div class="hint" id="talkHint">Type, or use the mic. Your phone keyboard can also do speech-to-text.</div>';
    document.body.appendChild(sheet);

    $('smackHit').addEventListener('click', function () {
      var now = cue && cue.now0 != null ? cue.now0 + (performance.now() - cue.atWall) : 0;
      actuallySend({ t: 'smackTap', at: now });
    });
    fab.addEventListener('click', function () {
      sheet.classList.toggle('on');
      if (sheet.classList.contains('on')) setTimeout(function () { $('talkText').focus(); }, 50);
    });
    $('talkSend').addEventListener('click', submitTalk);
    $('talkText').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitTalk(); });
    $('talkMic').addEventListener('click', toggleMic);
  }
  function submitTalk() {
    var inp = $('talkText'); if (!inp) return;
    var t = String(inp.value || '').replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (t.length > MAX) t = t.slice(0, MAX);
    actuallySend({ t: 'talk', text: t });
    inp.value = '';
    $('talkSheet').classList.remove('on');
  }

  var rec = null, recOn = false;
  function toggleMic() {
    var SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    var btn = $('talkMic'), hint = $('talkHint');
    if (!SR) {
      if (hint) hint.textContent = 'Live dictation isn’t available here — use your keyboard’s microphone, then Send.';
      var inp = $('talkText'); if (inp) inp.focus();
      return;
    }
    if (recOn && rec) { try { rec.stop(); } catch (e) {} recOn = false; if (btn) btn.classList.remove('listen'); return; }
    rec = new SR();
    rec.lang = (navigator.language || 'en-CA');
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      var t = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      var inp = $('talkText'); if (inp) inp.value = t.slice(0, MAX);
      if (ev.results[ev.results.length - 1].isFinal) { submitTalk(); }
    };
    rec.onend = function () { recOn = false; if (btn) btn.classList.remove('listen'); };
    rec.onerror = function () { recOn = false; if (btn) btn.classList.remove('listen'); if (hint) hint.textContent = 'Mic didn’t catch that — type it, or use the keyboard microphone.'; };
    try { rec.start(); recOn = true; if (btn) btn.classList.add('listen'); if (hint) hint.textContent = 'Listening…'; } catch (e) {
      if (hint) hint.textContent = 'Couldn’t start the mic. Use your keyboard’s speech-to-text, then Send.';
    }
  }

  function setCue(m) {
    if (!m || !m.passes || !m.passes.length) { cue = null; hidePad(); return; }
    cue = { passes: m.passes, now0: m.now, start: m.start, atWall: performance.now(), pre: m.pre || 450, post: m.post || 350, sweet: m.sweet || 60 };
    showPad();
  }
  function showPad() { var el = $('smackPad'); if (el) el.classList.add('on'); if (!raf) raf = requestAnimationFrame(drawRing); }
  function hidePad() { var el = $('smackPad'); if (el) el.classList.remove('on'); if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function drawRing() {
    raf = 0;
    var cv = $('smackRing'); if (!cv || !cue) { hidePad(); return; }
    var now = cue.now0 + (performance.now() - cue.atWall);
    var live = cue.passes.filter(function (p) { return now <= p.close && now >= p.open - 80; });
    if (!live.length && cue.passes.every(function (p) { return now > p.close; })) { hidePad(); cue = null; return; }
    var ctx = cv.getContext('2d'), W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    var p = live[0] || cue.passes[0];
    if (p) {
      var span = (p.close - p.open) || 1, mid = (now - p.open) / span;
      mid = Math.max(0, Math.min(1, mid));
      var sweet = Math.abs(now - p.tc) <= (p.sweet || cue.sweet);
      var r = (W * 0.42) * (1 - mid * 0.75);
      ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.max(16, r), 0, Math.PI * 2);
      ctx.strokeStyle = sweet ? '#ffd23f' : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = sweet ? 10 : 6; ctx.stroke();
      ctx.fillStyle = sweet ? '#ffd23f' : '#f4ead6';
      ctx.font = '800 28px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sweet ? 'PERFECT' : 'SMACK', W / 2, H / 2);
    }
    raf = requestAnimationFrame(drawRing);
  }

  function vib(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  w.RDR075OnMsg = function (m) {
    if (!m) return;
    if (m.t === 'state') {
      if (m.smack) setCue(m.smack);
      else if (cue && !(m.smack)) {
        /* leave cue running until its window ends */
      }
      /* also grab the client from last state path — if someone sent via net we're fine */
    } else if (m.t === 'smackCue') setCue(m);
    else if (m.t === 'smackBuzz') vib(m.pattern || 20);
  };
  w.addEventListener('rdr075-msg', function (e) { w.RDR075OnMsg(e.detail); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
