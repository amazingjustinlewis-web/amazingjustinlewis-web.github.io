/* Phone pad v0.7.6: SMACK timing, mic/chat talk, session-only selfie head, queue + local/TV vote,
   logo closeout back to the game list, PAY UP hidden under CAUGHT. */
(function (w) {
  'use strict';
  var cue = null, raf = 0, queue = null, myVote = null, betweenTurns = true, hasSelfie = false;
  var MAX = 100;
  function $(id) { return document.getElementById(id); }
  function hookOutgoing() {
    var N = w.RDRNet; if (!N) return;
    ['Client', 'LocalClient'].forEach(function (name) {
      var C = N[name]; if (!C || !C.prototype || C.prototype._tv076SendHook) return;
      var orig = C.prototype.send;
      if (typeof orig !== 'function') return;
      C.prototype._tv076SendHook = true;
      C.prototype.send = function () {
        w._rdr076Client = this;
        return orig.apply(this, arguments);
      };
    });
  }
  hookOutgoing();
  setInterval(hookOutgoing, 500);

  function actuallySend(m) {
    if (w.RDRC && typeof RDRC.send === 'function') { RDRC.send(m); return true; }
    var c = w._rdr076Client || w._rdr075Client;
    if (c && typeof c.send === 'function') { c.send(m); return true; }
    return false;
  }

  function myPid() {
    try { var st = w.RDRC && RDRC.state && RDRC.state(); return st && st.me && st.me.id; } catch (e) { return null; }
  }
  function myName() {
    try { var st = w.RDRC && RDRC.state && RDRC.state(); return (st && st.me && st.me.name) || ($('name') && $('name').value) || 'Player'; } catch (e) { return 'Player'; }
  }
  function isMyTurn() {
    try { var st = w.RDRC && RDRC.state && RDRC.state(); return !!(st && st.turn && st.me && st.turn.pid === st.me.id && st.phase === 'play'); } catch (e) { return false; }
  }
  function phasePlay() {
    try { var st = w.RDRC && RDRC.state && RDRC.state(); return st && st.phase === 'play'; } catch (e) { return false; }
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

    var sf = document.createElement('button');
    sf.id = 'selfieFab'; sf.type = 'button'; sf.title = 'Selfie'; sf.textContent = '📷';
    document.body.appendChild(sf);
    var ss = document.createElement('div');
    ss.id = 'selfieSheet';
    ss.innerHTML = '<h3>Selfie head</h3><img id="selfiePrev" alt="Your selfie head" hidden><video id="selfieVid" playsinline muted autoplay></video><div class="row"><button type="button" id="selfieShot">Take selfie</button><button type="button" id="selfieRetake" class="ghost" hidden>Retake</button><button type="button" id="selfieOff" class="ghost" hidden>Remove</button><button type="button" id="selfieFile" class="ghost">Upload</button></div><input id="selfieInp" type="file" accept="image/*" capture="user" hidden><div class="hint">Only this session — it stays on the TV for this game, never uploaded.</div>';
    document.body.appendChild(ss);

    var qp = document.createElement('div');
    qp.id = 'queuePad';
    qp.innerHTML = '<h2>Next game queue</h2><div class="sub" id="queueSub">You\'re in the party for the next game.</div><div id="queueParty"></div><div id="queueVote"><button type="button" data-v="tv">Wait for the TV</button><button type="button" data-v="local">Play locally on my phone</button></div><div id="queueCount"></div><button type="button" class="ghost" id="queueCancel">Cancel countdown</button><button type="button" id="queueJoinBtn">Enter the queue for the next game</button>';
    document.body.appendChild(qp);

    var gc = document.createElement('div');
    gc.id = 'gameClose';
    gc.innerHTML = '<img class="logo" alt="Zero to Phi" src="assets/logo.svg"><div class="word">ZERO TO PHI</div><div class="list" id="gameCloseList"></div>';
    document.body.appendChild(gc);

    $('smackHit').addEventListener('click', function () {
      var now = cue && cue.now0 != null ? cue.now0 + (performance.now() - cue.atWall) : 0;
      actuallySend({ t: 'smackTap', at: now, pid: myPid() });
    });
    fab.addEventListener('click', function () {
      sheet.classList.toggle('on'); ss.classList.remove('on');
      if (sheet.classList.contains('on')) setTimeout(function () { $('talkText').focus(); }, 50);
    });
    $('talkSend').addEventListener('click', submitTalk);
    $('talkText').addEventListener('keydown', function (e) { if (e.key === 'Enter') submitTalk(); });
    $('talkMic').addEventListener('click', toggleMic);
    sf.addEventListener('click', function () { ss.classList.toggle('on'); sheet.classList.remove('on'); });
    $('selfieShot').addEventListener('click', takeSelfie);
    $('selfieRetake').addEventListener('click', retakeSelfie);
    $('selfieOff').addEventListener('click', removeSelfie);
    $('selfieFile').addEventListener('click', function () { $('selfieInp').click(); });
    $('selfieInp').addEventListener('change', onSelfieFile);
    $('queueVote').addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]'); if (!b) return;
      myVote = b.getAttribute('data-v');
      actuallySend({ t: 'queueVote', vote: myVote, cid: clientCid(), name: myName() });
      paintVote();
    });
    $('queueCancel').addEventListener('click', function () {
      myVote = null;
      actuallySend({ t: 'queueVote', vote: null, cid: clientCid(), name: myName() });
    });
    $('queueJoinBtn').addEventListener('click', function () {
      actuallySend({ t: 'queueJoin', cid: clientCid(), name: myName() });
    });
    hookGamesBtn();
    hookCaught();
    hookObsSeats();
  }

  function clientCid() {
    var c = w._rdr076Client || w._rdr075Client;
    return (c && (c.id || c.peer)) || ('pad-' + myPid());
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

  /* ---------- selfie ---------- */
  var stream = null;
  function stopCam() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    var v = $('selfieVid'); if (v) v.classList.remove('on');
  }
  function sendFace(data) {
    actuallySend({ t: 'selfie', pid: myPid(), data: data });
    hasSelfie = true;
    var img = $('selfiePrev'); if (img) { img.src = data; img.hidden = false; }
    $('selfieRetake').hidden = false; $('selfieOff').hidden = false; $('selfieShot').textContent = 'Retake';
  }
  function downscaleAndSend(src) {
    var im = new Image();
    im.onload = function () {
      var MAXS = 96, cv = document.createElement('canvas'); cv.width = MAXS; cv.height = MAXS;
      var c = cv.getContext('2d');
      var s = Math.max(MAXS / im.width, MAXS / im.height), w2 = im.width * s, h2 = im.height * s;
      c.beginPath(); c.arc(MAXS / 2, MAXS / 2, MAXS / 2, 0, 7); c.closePath(); c.clip();
      c.drawImage(im, (MAXS - w2) / 2, (MAXS - h2) / 2, w2, h2);
      sendFace(cv.toDataURL('image/jpeg', 0.7));
    };
    im.src = src;
  }
  function takeSelfie() {
    var v = $('selfieVid');
    if (v && v.classList.contains('on') && v.videoWidth) {
      var cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight;
      var c = cv.getContext('2d'); c.translate(cv.width, 0); c.scale(-1, 1); c.drawImage(v, 0, 0);
      stopCam();
      downscaleAndSend(cv.toDataURL('image/jpeg', 0.8));
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { $('selfieInp').click(); return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 240, height: 240 }, audio: false }).then(function (s) {
      stream = s; v.srcObject = s; v.classList.add('on'); $('selfieShot').textContent = 'Snap';
    }).catch(function () { $('selfieInp').click(); });
  }
  function retakeSelfie() { takeSelfie(); }
  function removeSelfie() {
    stopCam(); hasSelfie = false;
    actuallySend({ t: 'selfie', pid: myPid(), clear: true });
    var img = $('selfiePrev'); if (img) { img.removeAttribute('src'); img.hidden = true; }
    $('selfieRetake').hidden = true; $('selfieOff').hidden = true; $('selfieShot').textContent = 'Take selfie';
  }
  function onSelfieFile(e) {
    var f = e.target.files && e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { downscaleAndSend(rd.result); };
    rd.readAsDataURL(f);
    e.target.value = '';
  }
  function placeholderSelfie() {
    var cv = document.createElement('canvas'); cv.width = 96; cv.height = 96;
    var c = cv.getContext('2d');
    c.fillStyle = '#f1c7a1'; c.beginPath(); c.arc(48, 48, 46, 0, 7); c.fill();
    c.fillStyle = '#3a2415'; c.beginPath(); c.arc(34, 42, 6, 0, 7); c.arc(62, 42, 6, 0, 7); c.fill();
    c.strokeStyle = '#3a2415'; c.lineWidth = 3; c.beginPath(); c.arc(48, 54, 14, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    downscaleAndSend(cv.toDataURL('image/jpeg', 0.7));
  }

  /* ---------- smack pad ---------- */
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
    var ctx = cv.getContext('2d'), Wd = cv.width, H = cv.height;
    ctx.clearRect(0, 0, Wd, H);
    var p = live[0] || cue.passes[0];
    if (p) {
      var span = (p.close - p.open) || 1, mid = (now - p.open) / span;
      mid = Math.max(0, Math.min(1, mid));
      var sweet = Math.abs(now - p.tc) <= (p.sweet || cue.sweet);
      var r = (Wd * 0.42) * (1 - mid * 0.75);
      ctx.beginPath(); ctx.arc(Wd / 2, H / 2, Math.max(16, r), 0, Math.PI * 2);
      ctx.strokeStyle = sweet ? '#ffd23f' : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = sweet ? 10 : 6; ctx.stroke();
      ctx.fillStyle = sweet ? '#ffd23f' : '#f4ead6';
      ctx.font = '800 28px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(sweet ? 'PERFECT' : 'SMACK', Wd / 2, H / 2);
    }
    raf = requestAnimationFrame(drawRing);
  }
  function vib(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {} }

  /* ---------- queue / party ---------- */
  function paintQueue(m) {
    queue = m;
    var pad = $('queuePad'); if (!pad) return;
    var mineIn = false, cid = clientCid();
    (m.players || []).forEach(function (p) { if (p.cid === cid) { mineIn = true; myVote = p.vote; } });
    if (!mineIn && !m.forceShow) { /* keep join prompt if we're an observer with no seats */ return; }
    pad.classList.add('on');
    $('queueJoinBtn').classList.remove('on');
    var box = $('queueParty');
    box.innerHTML = (m.players || []).map(function (p) {
      var ini = String(p.name || '?').slice(0, 1).toUpperCase();
      var v = p.vote === 'local' ? 'phone' : (p.vote === 'tv' ? 'TV' : '…');
      return '<div class="qp"><div class="dot" style="background:' + (p.color || '#ffd23f') + '">' + ini + '</div><b>' + esc(p.name || 'Player') + '</b><span>' + v + '</span></div>';
    }).join('') || '<div class="sub">Waiting for friends…</div>';
    paintVote();
    var cd = $('queueCount'), ca = $('queueCancel');
    if (m.counting) {
      cd.classList.add('on'); ca.classList.add('on');
      cd.innerHTML = m.left > 0 ? ('Confirmed, going in<br><span class="go">' + m.left + '</span>') : '<span class="go">GO</span>';
    } else { cd.classList.remove('on'); ca.classList.remove('on'); }
    $('queueSub').textContent = m.dir === 'local' && m.counting ? 'Everyone voted to play locally on their phone.' : m.counting ? 'Everyone voted to wait for the TV.' : 'Vote how you want the next game to start. Anyone can change their mind.';
  }
  function paintVote() {
    var btns = $('queueVote') ? $('queueVote').querySelectorAll('[data-v]') : [];
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-v') === myVote);
  }
  function offerQueue() {
    var pad = $('queuePad'); if (!pad) return;
    pad.classList.add('on');
    $('queueJoinBtn').classList.add('on');
    $('queueSub').textContent = 'This game is full or already underway.';
    $('queueParty').innerHTML = '';
    $('queueVote').style.display = 'none';
  }
  function hideQueue() {
    var pad = $('queuePad'); if (pad) pad.classList.remove('on');
    $('queueVote').style.display = '';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function hookObsSeats() {
    var el = $('obsSeats'); if (!el || hookObsSeats._on) return;
    hookObsSeats._on = true;
    var obs = new MutationObserver(function () { patchObs(); });
    obs.observe(el, { childList: true, subtree: true, characterData: true });
    patchObs();
  }
  function patchObs() {
    var el = $('obsSeats'); if (!el) return;
    var txt = el.textContent || '';
    if (/No AI seats/i.test(txt) || /join the next game automatically/i.test(txt)) {
      el.innerHTML = '<button type="button" class="big-btn" id="obsQueueBtn">Enter the queue for the next game</button>';
      var b = $('obsQueueBtn');
      if (b) b.onclick = function () { actuallySend({ t: 'queueJoin', cid: clientCid(), name: myName() }); offerQueue(); $('queueVote').style.display = ''; };
    }
  }

  function onQueueGo(m) {
    if (m.dir === 'local' && m.url) {
      setTimeout(function () { location.href = m.url; }, 200);
    } else {
      $('queueSub').textContent = 'You\'re in for the next TV game. Hang tight.';
    }
  }

  /* ---------- closeout to logo + game list ---------- */
  var GAMES = [
    { id: 'rdr', name: 'Red Deer Rich (TV)', url: 'controller_v076.html' },
    { id: 'rdr-solo', name: 'Red Deer Rich (phone solo)', url: 'solo_v06.html' },
    { id: 'list', name: 'All Zero to Phi games', url: '../../family.html#family-games' }
  ];
  function closeoutToList(thenUrl) {
    var el = $('gameClose'); if (!el) { if (thenUrl) location.href = thenUrl; return; }
    var list = $('gameCloseList');
    list.innerHTML = GAMES.map(function (g) { return '<a href="' + g.url + '">' + esc(g.name) + '</a>'; }).join('');
    el.className = 'on';
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () {
      el.classList.add('liston');
      if (thenUrl) setTimeout(function () { location.href = thenUrl; }, 80);
    }, 900);
  }
  function hookGamesBtn() {
    var b = $('gamesBtn'); if (!b || b._tv076) return;
    b._tv076 = true;
    var orig = b.onclick;
    b.onclick = function (e) {
      try { if (e) e.preventDefault(); } catch (x) {}
      try { actuallySend({ t: 'leave' }); } catch (x2) {}
      closeoutToList();
      return false;
    };
  }

  /* PAY UP stays hidden while CAUGHT boom is up */
  function hookCaught() {
    if (hookCaught._on) return; hookCaught._on = true;
    setInterval(function () {
      var boom = $('boom'), pu = $('payup');
      if (boom && pu && !boom.hidden) { pu.classList.add('under-boom'); pu.hidden = true; }
      else if (pu) pu.classList.remove('under-boom');
      hookGamesBtn();
      hookObsSeats();
      var fab = $('selfieFab');
      if (fab) {
        var ok = phasePlay() && !isMyTurn();
        fab.hidden = !ok;
        if (!ok) { var ss = $('selfieSheet'); if (ss) ss.classList.remove('on'); stopCam(); }
      }
    }, 200);
  }

  var profileSent = false;
  function sendProfileLook() {
    if (profileSent) return;
    var look = null, face = null;
    try {
      var pr = JSON.parse(localStorage.getItem('ztp:profile') || 'null');
      if (pr) {
        if (pr.avatar) look = pr.avatar;
        var f = pr.face || pr.photo || pr.faceUrl || pr.pic || (pr.avatar && (pr.avatar.face || pr.avatar.photo));
        if (typeof f === 'string' && f.indexOf('data:image') === 0) face = f;
      }
    } catch (e) {}
    if (!look && !face) return;
    actuallySend({ t: 'profileLook', pid: myPid(), look: look, face: face });
    profileSent = true;
  }

  w.RDR076OnMsg = function (m) {
    if (!m) return;
    if (m.t === 'state') {
      if (m.smack) setCue(m.smack);
      if (m.queue && m.queue.players && m.queue.players.length) paintQueue(m.queue);
      betweenTurns = !isMyTurn();
      sendProfileLook();
    } else if (m.t === 'smackCue') setCue(m);
    else if (m.t === 'smackBuzz') vib(m.pattern || 20);
    else if (m.t === 'queue') paintQueue(m);
    else if (m.t === 'queueGo') onQueueGo(m);
  };
  w.addEventListener('rdr076-msg', function (e) { w.RDR076OnMsg(e.detail); });
  /* also accept leftover v075 events */
  w.addEventListener('rdr075-msg', function (e) { w.RDR076OnMsg(e.detail); });
  w.RDR076Closeout = closeoutToList;
  w.RDR076SelfieTest = placeholderSelfie;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})(window);
