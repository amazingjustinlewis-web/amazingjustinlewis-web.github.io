/* TV v0.7.5: speech bubbles, per-character voices, mouth flap, kid-safe filter, mute (bubbles stay). */
(function (w) {
  'use strict';
  var MAX = 100;
  var MUTE_KEY = 'rdr_tv075_mute';
  var muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
  var bubbles = {}; /* pid -> { text, until, born } */
  var talking = {}; /* pid -> { until, t0, boundaries: [] } */
  var BAD = /\b(fuck|shit|bitch|asshole|bastard|dick|cunt|piss|faggot|slut|cock|nigger|nigga)\w*\b/gi;
  var SOFT = /\b(damn|hell|ass|crap|bloody)\b/gi;

  try { muted = muted; } catch (e) {}

  function game() { return w.RDR && RDR.game; }
  function kidMode() { var g = game(); return !!(g && g.rules && g.rules.kidMode); }
  function filter(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (s.length > MAX) s = s.slice(0, MAX);
    if (kidMode()) s = s.replace(BAD, '---').replace(SOFT, '---');
    return s;
  }
  function setMute(on) {
    muted = !!on;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
    var btn = document.getElementById('tv075-voices');
    if (btn) { btn.setAttribute('aria-pressed', muted ? 'true' : 'false'); btn.textContent = muted ? 'Voices off' : 'Voices on'; }
    if (muted && w.speechSynthesis) try { speechSynthesis.cancel(); } catch (e) {}
  }
  function voiceFor(charId) {
    var h = (w.RDRWalkers && RDRWalkers.hash) ? RDRWalkers.hash(charId) : 1;
    var st = (w.RDRCharStats && RDRCharStats.statsOf(charId)) || { cash: 5, buy: 5, tough: 5 };
    var voices = [];
    try { if (w.speechSynthesis) voices = speechSynthesis.getVoices() || []; } catch (e) {}
    var pick = voices.length ? voices[h % voices.length] : null;
    return {
      voice: pick,
      pitch: Math.max(0.5, Math.min(1.8, 0.75 + (h % 11) * 0.07 + (st.cash - 5) * 0.05)),
      rate: Math.max(0.7, Math.min(1.35, 0.92 + (st.buy - 5) * 0.04 + ((h >> 3) % 5) * 0.03 - (st.tough - 5) * 0.02))
    };
  }
  function estimateMs(text, rate) {
    var words = Math.max(1, String(text).split(/\s+/).length);
    return Math.max(700, Math.min(6000, (words / (2.4 * (rate || 1))) * 1000 + 280));
  }
  function playLine(pid, text, done) {
    var now = performance.now();
    var g = game(), p = g && g.byId(pid);
    var vf = voiceFor(p && p.charId);
    var dur = estimateMs(text, vf.rate);
    bubbles[pid] = { text: text, until: now + dur + 400, born: now };
    talking[pid] = { t0: now, until: now + dur, rate: vf.rate };
    var finished = false;
    function finish() { if (finished) return; finished = true; talking[pid] = null; if (done) done(); }
    if (!muted && w.speechSynthesis && w.SpeechSynthesisUtterance) {
      try {
        var u = new SpeechSynthesisUtterance(text);
        u.pitch = vf.pitch; u.rate = vf.rate; if (vf.voice) u.voice = vf.voice;
        u.onboundary = function (ev) {
          var tk = talking[pid]; if (!tk) return;
          tk.flap = performance.now();
        };
        u.onend = finish;
        u.onerror = finish;
        speechSynthesis.speak(u);
        setTimeout(function () { if (talking[pid] && talking[pid].t0 === now) finish(); }, dur + 1500);
        return;
      } catch (e) {}
    }
    setTimeout(finish, dur);
  }
  function say(pid, text, opt) {
    opt = opt || {};
    text = filter(text);
    if (!text) return;
    var Q = w.RDRTalkQueue;
    if (!Q) { playLine(pid, text, function () {}); return; }
    Q.enqueue(function (done) { playLine(pid, text, done); }, { kind: 'talk', label: 'p' + pid, beat: opt.beat });
  }
  function onTalk(conn, m) {
    var g = game(); if (!g) return;
    var pid = m.pid, p = pid != null ? g.byId(pid) : null;
    if (!p) {
      var cl = w.RDR && RDR.clients;
      if (cl) for (var k in cl) if (cl[k].conn === conn) p = g.byId(cl[k].pid);
    }
    if (!p) return;
    say(p.id, m.text || '');
  }
  function mouthOf(pid, now) {
    var tk = talking[pid]; if (!tk) return 0;
    now = now || performance.now();
    if (now > tk.until) return 0;
    if (tk.flap && now - tk.flap < 90) return 1;
    /* timer flap synced to rate */
    var ph = ((now - tk.t0) / (120 / (tk.rate || 1))) % 1;
    return ph < 0.55 ? 1 : 0;
  }
  function wrapPeopleMouth() {
    var P = w.RDRPeople; if (!P || P._tv075Mouth) return;
    P._tv075Mouth = true;
    var orig = P.draw;
    P.draw = function (g, x, y, h, look, o) {
      orig(g, x, y, h, look, o);
      o = o || {};
      var open = o.mouth; if (!open) return;
      var a = P.clean(look);
      var walk = o.walk == null ? -1 : o.walk, swbob = walk < 0 ? 0 : Math.abs(Math.sin(walk * Math.PI * 2)) * 3;
      var sq = o.squash || 1, sx = sq === 1 ? 1 : 1 / Math.sqrt(sq), face = o.face || 1, s = h / 132;
      g.save();
      g.translate(x, y); if (o.tilt) g.rotate(o.tilt * face);
      g.scale(s * face * sx, s * sq);
      g.translate(-50, -129 - swbob);
      if (o.head) { g.translate(50, 50); g.rotate(o.head); g.translate(-50, -50); }
      /* cover the smile, flap an oval mouth */
      g.fillStyle = a.skin;
      g.beginPath(); g.arc(52, 43, 8, 0, 7); g.fill();
      g.fillStyle = '#4a1824';
      g.beginPath(); if (g.ellipse) g.ellipse(52, 44, 5.5, 2 + 4.5 * open, 0, 0, 7); else { g.save(); g.translate(52, 44); g.scale(5.5, 2 + 4.5 * open); g.arc(0, 0, 1, 0, 7); g.restore(); } g.fill();
      g.restore();
    };
  }
  function draw(c, rnd, now) {
    var WW = w.RDRWalkers; if (!WW) return;
    var g = game(); if (!g) return;
    var h = WW.heightOf(rnd);
    g.players.forEach(function (p) {
      var b = bubbles[p.id]; if (!b) return;
      if (now >= b.until) { delete bubbles[p.id]; return; }
      var v = WW.visOf(p); if (!v.shown) return;
      var a = Math.min(1, (b.until - now) / 280, (now - b.born) / 160);
      var txt = b.text;
      c.save(); c.globalAlpha = a;
      c.font = '700 13px ui-sans-serif, system-ui, sans-serif';
      var wdt = Math.min(200, c.measureText(txt).width + 20);
      var x = v.x, y = v.y - h * 1.15 * (v.scale || 1) - 16;
      c.fillStyle = 'rgba(255,248,235,0.94)';
      c.strokeStyle = 'rgba(20,18,27,0.25)'; c.lineWidth = 1.5;
      var rr = 10, x0 = x - wdt / 2, y0 = y - 22, ww = wdt, hh = 28;
      c.beginPath();
      if (c.roundRect) c.roundRect(x0, y0, ww, hh, rr);
      else { c.rect(x0, y0, ww, hh); }
      c.fill(); c.stroke();
      c.beginPath(); c.moveTo(x - 6, y0 + hh); c.lineTo(x, y0 + hh + 8); c.lineTo(x + 6, y0 + hh); c.fill();
      c.fillStyle = '#1c1824'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(txt, x, y0 + hh / 2 + 1, ww - 12);
      c.restore();
    });
  }
  function mountMuteBtn() {
    if (document.getElementById('tv075-voices')) return;
    var btn = document.createElement('button');
    btn.id = 'tv075-voices';
    btn.type = 'button';
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    btn.textContent = muted ? 'Voices off' : 'Voices on';
    btn.addEventListener('click', function () { setMute(!muted); });
    document.body.appendChild(btn);
    /* warm voices */
    try { if (w.speechSynthesis) speechSynthesis.getVoices(); } catch (e) {}
  }

  w.RDRTalk = {
    say: say, onTalk: onTalk, mouthOf: mouthOf, draw: draw, filter: filter,
    setMute: setMute, muted: function () { return muted; },
    wrapPeopleMouth: wrapPeopleMouth, mountMuteBtn: mountMuteBtn,
    MAX: MAX, bubbles: bubbles
  };
})(window);
