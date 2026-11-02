/* Battleship v03 shot FX: missile drop + splash/boom, canvas + WebAudio. Original code, no assets. */
window.BSFX = (function () {
  var cv, g, parts = [], shots = [], raf = 0, ac = null, DROP = 520;
  function ctx() { if (!cv) { cv = document.createElement('canvas'); cv.id = 'bsfx'; cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:50'; document.body.appendChild(cv); g = cv.getContext('2d'); addEventListener('resize', size); size(); } }
  function size() { var d = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * d; cv.height = innerHeight * d; g.setTransform(d, 0, 0, d, 0, 0); }
  function audio() { try { if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} return ac; }
  function noise(dur) { var a = ac, b = a.createBuffer(1, a.sampleRate * dur, a.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; var s = a.createBufferSource(); s.buffer = b; return s; }
  function snd(kind) { var a = audio(); if (!a) return; try {
    var t = a.currentTime, n, f = a.createBiquadFilter(), v = a.createGain(); v.connect(a.destination); f.connect(v);
    if (kind === 'whoosh') { n = noise(.55); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + .5); v.gain.setValueAtTime(.001, t); v.gain.exponentialRampToValueAtTime(.35, t + .4); v.gain.exponentialRampToValueAtTime(.001, t + .55); }
    else if (kind === 'splash') { n = noise(.8); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(300, t + .7); v.gain.setValueAtTime(.6, t); v.gain.exponentialRampToValueAtTime(.001, t + .8); }
    else { n = noise(.9); f.type = 'lowpass'; f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(80, t + .8); v.gain.setValueAtTime(.9, t); v.gain.exponentialRampToValueAtTime(.001, t + .9);
      var o = a.createOscillator(), og = a.createGain(); o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(35, t + .5); og.gain.setValueAtTime(.7, t); og.gain.exponentialRampToValueAtTime(.001, t + .5); o.connect(og); og.connect(a.destination); o.start(t); o.stop(t + .5); }
    n.connect(f); n.start(t); } catch (e) {} }
  function burst(x, y, s, kind) {
    var i, N = kind === 'miss' ? 34 : 26;
    parts.push({ k: 'ring', x: x, y: y, r: s * .3, life: 0, max: 700, s: s });
    if (kind === 'miss') parts.push({ k: 'ring', x: x, y: y, r: s * .1, life: -120, max: 700, s: s });
    else parts.push({ k: 'flash', x: x, y: y, life: 0, max: 260, s: s });
    for (i = 0; i < N; i++) { var a = Math.random() * Math.PI * 2, sp = (kind === 'miss' ? .6 + Math.random() : .4 + Math.random() * 1.1) * s * 0.01;
      if (kind === 'miss') parts.push({ k: 'drop', x: x, y: y, vx: Math.cos(a) * sp * .7, vy: -Math.abs(Math.sin(a)) * sp * 2.2 - s * .004, life: 0, max: 650 + Math.random() * 250, r: 1.5 + Math.random() * s * .06 });
      else parts.push({ k: i % 3 ? 'spark' : 'smoke', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (i % 3 ? 0 : s * .002), life: 0, max: i % 3 ? 380 + Math.random() * 250 : 700 + Math.random() * 300, r: i % 3 ? 1.5 + Math.random() * 1.5 : s * (.15 + Math.random() * .15) }); }
  }
  function missile(sh, p) { // p 0..1
    var e = p * .4 + p * p * .6, sx = sh.x + (sh.x < innerWidth / 2 ? 1 : -1) * innerWidth * .15, sy = Math.min(sh.y - 80, innerHeight * .1);
    var x = sx + (sh.x - sx) * e, y = sy + (sh.y - sy) * e, sc = (1 - e) * 3.2 + .45, L = sh.s * sc, ang = Math.atan2(sh.y - sy, sh.x - sx);
    g.save(); g.globalAlpha = Math.min(1, p * 3.5); g.translate(x, y); g.rotate(ang - Math.PI / 2);
    g.fillStyle = 'rgba(255,170,60,.85)'; g.beginPath(); g.moveTo(-L * .09, -L * .45); g.lineTo(0, -L * (.75 + Math.random() * .2)); g.lineTo(L * .09, -L * .45); g.fill();
    g.fillStyle = '#c9d2dc'; g.fillRect(-L * .1, -L * .45, L * .2, L * .7);
    g.fillStyle = '#d64545'; g.beginPath(); g.moveTo(-L * .1, L * .25); g.lineTo(0, L * .5); g.lineTo(L * .1, L * .25); g.fill();
    g.fillStyle = '#7d8894'; g.beginPath(); g.moveTo(-L * .1, -L * .45); g.lineTo(-L * .24, -L * .55); g.lineTo(-L * .1, -L * .25); g.moveTo(L * .1, -L * .45); g.lineTo(L * .24, -L * .55); g.lineTo(L * .1, -L * .25); g.fill();
    g.restore();
  }
  var last = 0;
  function loop(t) {
    var dt = Math.min(50, t - (last || t)); last = t; g.clearRect(0, 0, innerWidth, innerHeight);
    shots = shots.filter(function (sh) { var p = (performance.now() - sh.t0) / DROP; if (p >= 1) { sh.hit(); return false; } missile(sh, p); return true; });
    parts = parts.filter(function (q) { q.life += dt; if (q.life < 0) return true; var k = q.life / q.max; if (k >= 1) return false; g.save();
      if (q.k === 'ring') { g.globalAlpha = 1 - k; g.strokeStyle = '#dff4ff'; g.lineWidth = 3 * (1 - k) + 1; g.beginPath(); g.ellipse(q.x, q.y, q.r + q.s * 1.3 * k, (q.r + q.s * 1.3 * k) * .55, 0, 0, 7); g.stroke(); }
      else if (q.k === 'flash') { g.globalAlpha = 1 - k; var gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.s * (.5 + k)); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(.4, '#ff9a2a'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, q.s * (.5 + k), 0, 7); g.fill(); }
      else { q.x += q.vx * dt; q.y += q.vy * dt; if (q.k === 'drop') q.vy += .0018 * dt * 3; if (q.k === 'smoke') { q.vx *= .96; q.vy *= .96; }
        g.globalAlpha = q.k === 'smoke' ? .45 * (1 - k) : 1 - k; g.fillStyle = q.k === 'drop' ? '#bfe8ff' : q.k === 'spark' ? (k < .4 ? '#fff2a0' : '#ff7a1a') : '#444';
        g.beginPath(); g.arc(q.x, q.y, q.k === 'smoke' ? q.r * (1 + k) : q.r, 0, 7); g.fill(); }
      g.restore(); return true; });
    if (shots.length || parts.length) raf = requestAnimationFrame(loop); else { raf = 0; last = 0; g.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  /* fire(cellEl) -> handle; handle.result(kind) gives 'miss'|'hit'; onImpact(kind) called once both impact time reached and result known */
  function fire(el, onImpact) {
    ctx(); var r = el.getBoundingClientRect(), h = { kind: null, landed: false, done: false };
    var sh = { x: r.left + r.width / 2, y: r.top + r.height / 2, s: Math.max(18, r.width), t0: performance.now() };
    function go() { if (h.done || !h.landed || !h.kind) return; h.done = true; burst(sh.x, sh.y, sh.s, h.kind); snd(h.kind === 'miss' ? 'splash' : 'boom'); kick(); onImpact && onImpact(h.kind); }
    sh.hit = function () { h.landed = true; go(); };
    h.result = function (k) { h.kind = k === 'miss' ? 'miss' : 'hit'; go(); };
    shots.push(sh); snd('whoosh'); kick();
    setTimeout(function () { if (!h.landed) sh.hit(); }, DROP + 400); // rAF throttled (background tab) fallback
    return h;
  }
  return { fire: fire, unlock: audio, DROP: DROP };
})();
