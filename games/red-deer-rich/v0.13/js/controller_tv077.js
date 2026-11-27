/* Phone pad v0.7.7: SMACK timing, mic/chat talk, session-only selfie head, queue + local/TV vote,
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
      injectStrip();
      syncRecapVote();
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


  function stateNow() {
    try { return w.RDRC && RDRC.state && RDRC.state(); } catch (e) { return null; }
  }
  function meNow() {
    var st = stateNow();
    if (st && st.me) return st.me;
    var pid = myPid();
    if (st && st.players) {
      for (var i = 0; i < st.players.length; i++) if (st.players[i].id === pid) return st.players[i];
    }
    return null;
  }

  /* ---- run strip: runner stays put, board tiles scroll under him ---- */
  var strip = { cv: null, ctx: null, shown: 0, from: 0, to: 0, animT: 0, animDur: 0, hopT: -1, walk: 0,
    giveT: -1, getT: -1, lastSmack: 0, raf: 0, lastPos: null };
  function spaceAt(i) {
    var B = w.RDR_BOARD, sp = B && B.SPACES;
    if (!sp) return { name: '', short: '', color: '#3a3344' };
    var s = sp[((i % 40) + 40) % 40];
    var col = '#3a3344';
    if (s.group && B.GROUPS && B.GROUPS[s.group]) col = B.GROUPS[s.group].color;
    else if (s.type === 'halfway') col = '#ffd23f';
    else if (s.type === 'snowbank') col = '#9ad4ff';
    else if (s.type === 'dirtlot') col = '#c4a574';
    else if (s.type === 'finds') col = '#7cf0c2';
    else if (s.type === 'random') col = '#ff8a3d';
    else if (s.type === 'tax') col = '#d0d0d0';
    else if (s.type === 'whistle' || s.type === 'rail') col = '#8a94a8';
    else if (s.type === 'juice' || s.type === 'util' || s.type === 'power') col = '#6ecbff';
    return { name: s.name || '', short: s.short || s.name || '', color: col, type: s.type || 'prop' };
  }
  function injectStrip() {
    var box = $('diceBox');
    if (!box) return null;
    var cv = $('runStrip');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'runStrip';
      cv.width = 252; cv.height = 180;
      box.appendChild(cv);
    }
    strip.cv = cv; strip.ctx = cv.getContext('2d');
    return cv;
  }
  function startMoveTo(pos) {
    var n = ((pos % 40) + 40) % 40;
    if (strip.lastPos == null) { strip.lastPos = n; strip.shown = n; strip.from = n; strip.to = n; return; }
    var d = ((n - strip.lastPos) % 40 + 40) % 40;
    if (d === 0) return;
    if (d > 20) d -= 40; /* backward */
    strip.from = strip.shown; strip.to = strip.from + d; strip.animT = 0;
    strip.animDur = Math.max(280, Math.abs(d) * 220);
    strip.hopT = -1; strip.lastPos = n;
  }
  function onSmackFx(m) {
    if (!m) return;
    var at = m.at || Date.now();
    if (at === strip.lastSmack) return;
    strip.lastSmack = at;
    var me = myPid();
    var from = m.from != null ? m.from : m.a; var to = m.to != null ? m.to : m.b;
    if (from === me) strip.giveT = 0;
    else if (to === me) strip.getT = 0;
    else if (m.kind === 'give' || m.who === 'me') strip.giveT = 0;
    else if (m.kind === 'get' || m.hit === me) strip.getT = 0;
  }
  function drawTiles(c, W, H, at) {
    var tw = 84, mid = W * 0.62, foot = H * 0.82;
    c.fillStyle = '#141018'; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(0, foot - 4, W, H - (foot - 4));
    for (var k = -3; k <= 3; k++) {
      var si = Math.floor(at + k);
      var frac = (at - Math.floor(at));
      var x = mid - frac * tw + k * tw - tw / 2;
      var sp = spaceAt(si);
      c.fillStyle = '#1c1824';
      if (c.roundRect) { c.beginPath(); c.roundRect(x + 3, foot - 36, tw - 6, 40, 6); c.fill(); }
      else { c.fillRect(x + 3, foot - 36, tw - 6, 40); }
      c.fillStyle = sp.color;
      c.fillRect(x + 3, foot - 36, tw - 6, 8);
      c.fillStyle = '#f4ead6';
      c.font = '600 9px ui-sans-serif, system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'top';
      var label = (sp.short || sp.name || '').slice(0, 14);
      c.fillText(label, x + tw / 2, foot - 24);
    }
  }
  function drawStrip(now) {
    if (!strip.ctx && !injectStrip()) return;
    var c = strip.ctx, cv = strip.cv, W = cv.width, H = cv.height;
    var dt = strip._now ? Math.min(48, now - strip._now) : 16; strip._now = now;
    if (strip.animDur > 0 && strip.animT < strip.animDur) {
      strip.animT += dt;
      var u = Math.min(1, strip.animT / strip.animDur);
      var e = 1 - Math.pow(1 - u, 3);
      strip.shown = strip.from + (strip.to - strip.from) * e;
      strip.walk += dt / 280;
      if (u >= 1) { strip.shown = strip.to; strip.animDur = 0; strip.hopT = 0; strip.walk = 0; }
    }
    if (strip.hopT >= 0) strip.hopT += dt;
    if (strip.giveT >= 0) strip.giveT += dt;
    if (strip.getT >= 0) strip.getT += dt;
    if (strip.giveT > 700) strip.giveT = -1;
    if (strip.getT > 700) strip.getT = -1;
    if (strip.hopT > 520) strip.hopT = -1;
    drawTiles(c, W, H, strip.shown);
    var me = meNow() || {};
    var look = me.look || (w.RDRPeople && RDRPeople.profile && RDRPeople.profile()) || (w.RDRPeople && RDRPeople.random && RDRPeople.random(null, me.color));
    if (look && me.color && !me.look) look = Object.assign({}, look, { shirt: me.color });
    var hop = 0, squash = 1;
    if (strip.hopT >= 0) {
      var ht = strip.hopT;
      if (ht < 240) { var h1 = ht / 240; hop = Math.sin(h1 * Math.PI) * 14; squash = h1 < 0.5 ? 1.12 : 0.88 + 0.12 * (h1 - 0.5) * 2; }
      else { var h2 = (ht - 240) / 240; hop = Math.sin(h2 * Math.PI) * 10; squash = h2 < 0.5 ? 1.1 : 0.9 + 0.1 * (h2 - 0.5) * 2; }
    }
    var o = { face: 1, glow: me.color || '#ffd23f', bob: 0, squash: squash };
    if (strip.animDur > 0) o.walk = strip.walk % 1;
    else o.walk = -1;
    if (strip.giveT >= 0) o.swing = Math.min(0.99, strip.giveT / 520);
    if (strip.getT >= 0) { o.tilt = Math.sin(strip.getT / 70) * 0.35; o.head = Math.sin(strip.getT / 50) * 0.4; o.face = -1; }
    var feetX = W * 0.62, feetY = H * 0.82 - 4 - hop;
    if (w.RDRPeople && RDRPeople.draw) RDRPeople.draw(c, feetX, feetY, 92, look, o);
    else {
      c.fillStyle = me.color || '#ffd23f';
      c.beginPath(); c.arc(feetX, feetY - 28, 16, 0, 7); c.fill();
    }
  }
  function stripTick() {
    injectStrip();
    var me = meNow();
    if (me && me.pos != null) startMoveTo(me.pos);
    drawStrip(performance.now());
    strip.raf = requestAnimationFrame(stripTick);
  }

  /* ---- recap resume-vote: X cancels vote and hides the box; tap / Vote pill brings it back ---- */
  var voteAway = false, recapUi = false;
  function ensureRecapUi() {
    var ph = $('pausePh'); if (!ph) return;
    if (!ph.querySelector('.pz-box')) {
      var box = document.createElement('div'); box.className = 'pz-box';
      while (ph.firstChild) box.appendChild(ph.firstChild);
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'pz-x'; x.setAttribute('aria-label', 'Cancel vote'); x.textContent = '\u00d7';
      box.insertBefore(x, box.firstChild);
      ph.appendChild(box);
      x.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        actuallySend({ t: 'svoteClear', pid: myPid() });
        voteAway = true;
        document.body.classList.add('recap-vote-away');
      });
    }
    var pill = $('recapVotePill');
    if (!pill) {
      pill = document.createElement('button');
      pill.id = 'recapVotePill'; pill.type = 'button'; pill.textContent = 'Vote';
      document.body.appendChild(pill);
      pill.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        voteAway = false; document.body.classList.remove('recap-vote-away');
      });
    }
    if (!recapUi) {
      recapUi = true;
      ph.addEventListener('click', function (e) {
        if (!document.body.classList.contains('recap-cinema')) return;
        if (!document.body.classList.contains('recap-vote-away')) return;
        if (e.target && e.target.closest && e.target.closest('.pz-box')) return;
        voteAway = false; document.body.classList.remove('recap-vote-away');
      });
    }
  }
  function syncRecapVote() {
    var st = stateNow() || {};
    var recap = !!(st.paused && (st.recap || st.recapping));
    var ph = $('pausePh');
    document.body.classList.toggle('recap-cinema', recap);
    if (!recap) {
      voteAway = false;
      document.body.classList.remove('recap-vote-away');
      return;
    }
    ensureRecapUi();
    if (ph) ph.hidden = false;
    document.body.classList.toggle('recap-vote-away', voteAway);
  }

  w.RDR076OnMsg = function (m) {
    if (!m) return;
    if (m.t === 'state') {
      if (m.smack) setCue(m.smack);
      if (m.smackHit) onSmackFx(m.smackHit);
      if (m.queue && m.queue.players && m.queue.players.length) paintQueue(m.queue);
      betweenTurns = !isMyTurn();
      sendProfileLook();
      if (m.me && m.me.pos != null) startMoveTo(m.me.pos);
      else if (meNow() && meNow().pos != null) startMoveTo(meNow().pos);
      syncRecapVote();
    } else if (m.t === 'smackCue') { setCue(m); onSmackFx(m); }
    else if (m.t === 'smackBuzz') vib(m.pattern || 20);
    else if (m.t === 'queue') paintQueue(m);
    else if (m.t === 'queueGo') onQueueGo(m);
  };
  w.addEventListener('rdr076-msg', function (e) { w.RDR076OnMsg(e.detail); });
  /* also accept leftover v075 events */
  w.addEventListener('rdr075-msg', function (e) { w.RDR076OnMsg(e.detail); });
  w.RDR076Closeout = closeoutToList;
  w.RDR076SelfieTest = placeholderSelfie;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); if (!strip.raf) stripTick(); });
  else { mount(); if (!strip.raf) stripTick(); }
})(window);
