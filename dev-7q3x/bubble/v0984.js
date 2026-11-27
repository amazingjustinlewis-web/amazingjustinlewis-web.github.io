/* v0.9.84: setup tutorial cards, lobby toy, shorter punchy goal replays.
   ?tutcards=0  hide the drifting setup cards
   ?lobbytoy=0  disable grab/fling-off-pegs in the lobby / faceoff wait
   ?repframe=0  old replay camera framing (lengths still halved)
*/
(function (root) {
  'use strict';
  var q = location.search || '';
  function off(n) { return new RegExp('[?&]' + n + '=0(?:&|$)').test(q); }
  var TUT_ON = !off('tutcards'), TOY_ON = !off('lobbytoy'), NEW_FRAME = !off('repframe');

  var CARDS = [
    { id: 'bodycheck', pose: 'HP_bodyCheckFront', pose2: 'HP_tenseGlide',
      cap: 'Slide while holding to body check' },
    { id: 'pokecheck', pose: 'HP_tenseGlide', pose2: 'HP_idleGlide',
      cap: 'Tap to poke check' },
    { id: 'slapshot', pose: 'HP_idleGlide',
      cap: 'Taps always shoot, one-timers to the center are automatic' },
    { id: 'glove', pose: 'G_padL', pose2: 'G_ready',
      cap: 'Take control of your goaltender for nuanced saves, or trust your goalie' }
  ];
  // Swap in a pre-rendered PNG later: CARDS[i].img = 'tut/card_bodycheck.png'

  /* ---------- tutorial cards + bottom option buttons ---------- */
  function cssTut() {
    if (document.getElementById('ztpTutCss')) return;
    var s = document.createElement('style'); s.id = 'ztpTutCss';
    s.textContent =
      '#ztpTut{position:fixed;inset:0;z-index:12000;background:#030304;color:#e8cf86;font-family:Georgia,"Times New Roman",serif;overflow:hidden}' +
      '#ztpTut .stage{position:absolute;left:0;right:0;top:0;bottom:72px;overflow:hidden}' +
      '#ztpTut .row{position:absolute;left:0;top:50%;height:min(58vh,420px);display:flex;gap:28px;align-items:center;will-change:transform}' +
      '#ztpTut .ztp-tcard{flex:0 0 auto;width:min(52vw,340px);background:#080705;border:1px solid rgba(226,184,74,.38);box-shadow:0 12px 40px #000,0 0 24px rgba(226,184,74,.08);padding:10px 10px 14px;border-radius:4px}' +
      '#ztpTut .ztp-tcard canvas,#ztpTut .ztp-tcard img{display:block;width:100%;height:auto;background:#030304}' +
      '#ztpTut .ztp-tcard p{margin:.7em .4em 0;font:400 13px/1.4 Georgia,serif;letter-spacing:.04em;color:#f3dc95;text-align:center}' +
      '#ztpTut .opts{position:absolute;left:0;right:0;bottom:0;height:72px;display:flex;justify-content:center;align-items:center;gap:10px;padding:0 10px calc(8px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,#030304 28%);}' +
      '#ztpTut .opts button{font:12px/1 Georgia,serif;letter-spacing:.14em;text-transform:lowercase;color:#e2b84a;background:transparent;border:1px solid rgba(226,184,74,.4);border-radius:999px;padding:.7em 1.1em;cursor:pointer}' +
      '#ztpTut .opts button:hover,#ztpTut .opts button:focus-visible{border-color:#fbe7a1;color:#fff3cc;outline:none}' +
      'body.ztp-tut #watchBtn,body.ztp-tut #join,body.ztp-tut #big,body.ztp-tut #tip{visibility:hidden}body.ztp-tut .playbar,body.ztp-tut [data-here],body.ztp-tut #invite,body.ztp-tut .invite,body.ztp-tut #ztpPlaybar,body.ztp-tut .ztp-playbar{visibility:hidden!important}';
    document.head.appendChild(s);
  }
  function drawPlaceholder(cv, card, i) {
    var w = cv.width = 640, h = cv.height = 400, x = cv.getContext('2d');
    x.fillStyle = '#050403'; x.fillRect(0, 0, w, h);
    // ice patch + shadow
    x.save();
    x.translate(w * 0.5, h * 0.78);
    x.scale(1, 0.28);
    var g = x.createRadialGradient(0, 0, 10, 0, 0, 220);
    g.addColorStop(0, 'rgba(226,184,74,0.18)');
    g.addColorStop(0.5, 'rgba(200,160,80,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, 220, 0, 7); x.fill();
    x.strokeStyle = 'rgba(226,184,74,0.28)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, 180, 0, 7); x.stroke();
    x.restore();
    // gold-lit figures (stylized stand-ins; swap card.img later)
    function figure(cx, cy, sc, pose, gold) {
      x.save(); x.translate(cx, cy); x.scale(sc, sc);
      x.strokeStyle = gold ? '#e2b84a' : '#c08a22';
      x.fillStyle = gold ? '#1a150c' : '#0c0a06';
      x.lineWidth = 4; x.lineJoin = 'round'; x.lineCap = 'round';
      // body
      x.beginPath(); x.ellipse(0, -20, 16, 28, 0, 0, 7); x.fill(); x.stroke();
      // head
      x.beginPath(); x.arc(0, -56, 12, 0, 7); x.fill(); x.stroke();
      if (pose === 'check') {
        x.beginPath(); x.moveTo(-8, -8); x.lineTo(-36, 8); x.lineTo(-20, 30); x.stroke();
        x.beginPath(); x.moveTo(8, -6); x.lineTo(34, -28); x.lineTo(44, 6); x.stroke();
        x.beginPath(); x.moveTo(0, -20); x.lineTo(18, -70); x.stroke(); // stick high
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
        // loose puck
      } else if (pose === 'slap') {
        x.beginPath(); x.moveTo(-30, 10); x.lineTo(50, -50); x.lineWidth = 5; x.stroke();
        x.beginPath(); x.arc(54, -56, 5, 0, 7); x.fillStyle = '#fbe7a1'; x.fill();
      } else if (pose === 'goalie') {
        x.beginPath(); x.ellipse(0, 6, 28, 16, 0, 0, 7); x.fill(); x.stroke(); // pads
        x.beginPath(); x.moveTo(20, -20); x.lineTo(48, -8); x.lineWidth = 6; x.stroke(); // glove
        // golden slider thumb behind
      } else {
        x.beginPath(); x.moveTo(-12, 8); x.lineTo(-8, 40); x.moveTo(12, 8); x.lineTo(10, 40); x.stroke();
      }
      x.restore();
    }
    if (i === 0) { figure(w * 0.38, h * 0.52, 1.15, 'check', 1); figure(w * 0.66, h * 0.58, 1.05, 'fall', 0); }
    else if (i === 1) { figure(w * 0.36, h * 0.54, 1.15, 'poke', 1); figure(w * 0.68, h * 0.56, 1.0, 'stumble', 0); x.fillStyle = '#fbe7a1'; x.beginPath(); x.arc(w * 0.78, h * 0.72, 6, 0, 7); x.fill(); }
    else if (i === 2) { figure(w * 0.46, h * 0.52, 1.2, 'slap', 1); /* net hint */ x.strokeStyle = 'rgba(226,184,74,.35)'; x.strokeRect(w * 0.72, h * 0.22, 70, 90); }
    else { figure(w * 0.42, h * 0.56, 1.15, 'goalie', 1); /* golden slider */ x.fillStyle = '#c08a22'; x.fillRect(w * 0.30, h * 0.84, 180, 8); x.fillStyle = '#fbe7a1'; x.beginPath(); x.arc(w * 0.62, h * 0.84 + 4, 11, 0, 7); x.fill(); }
    // gold rim light
    x.strokeStyle = 'rgba(251,231,161,0.15)'; x.strokeRect(8, 8, w - 16, h - 16);
  }
  function mountTut() {
    if (!TUT_ON || document.getElementById('ztpTut')) return;
    cssTut();
    var box = document.createElement('div'); box.id = 'ztpTut';
    box.innerHTML = '<div class="stage"><div class="row" id="ztpTutRow"></div></div><div class="opts" id="ztpTutOpts"></div>';
    document.body.appendChild(box);
    document.body.classList.add('ztp-tut');
    var row = box.querySelector('#ztpTutRow');
    // two copies of the set so the loop can scroll seamlessly
    function addSet() {
      CARDS.forEach(function (c, i) {
        var el = document.createElement('div'); el.className = 'ztp-tcard';
        if (c.img) {
          var im = document.createElement('img'); im.alt = ''; im.src = c.img; el.appendChild(im);
        } else {
          var cv = document.createElement('canvas');
          drawPlaceholder(cv, c, i);
          el.appendChild(cv);
        }
        var p = document.createElement('p'); p.textContent = c.cap; el.appendChild(p);
        row.appendChild(el);
      });
    }
    addSet(); addSet();
    var opts = box.querySelector('#ztpTutOpts');
    function btn(label, fn) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', fn); opts.appendChild(b); return b;
    }
    var isPad = !!root.MINI && /pad/i.test(location.pathname + '');
    btn('How to play', function () {
      if (root.Howto && Howto.show) { try { Howto.show(); } catch (e) {} }
      else {
        var tip = document.getElementById('tip');
        alert(tip && tip.textContent ? tip.textContent : 'Drag a player along his slot. With the puck, your finger steers it. Flick toward a teammate to pass. Tap to shoot.');
      }
    });
    btn('Sound', function () {
      root.BH_MUTE = !root.BH_MUTE;
      this.textContent = root.BH_MUTE ? 'Sound off' : 'Sound';
    });
    if (!isPad) {
      btn('Watch a game', function () {
        hideTut();
        if (root.BHT && BHT.startWatch) BHT.startWatch();
      });
    }
    btn('Enter', function () { hideTut(); });
    // slow drift
    var t0 = performance.now(), w0 = 0;
    function measure() { w0 = row.scrollWidth / 2; }
    measure(); addEventListener('resize', measure);
    function tick(now) {
      if (!box.parentNode) return;
      var t = (now - t0) / 1000;
      var x = -((t * 28) % (w0 || 1));
      var y = Math.sin(t * 0.35) * 10;
      row.style.transform = 'translate(' + x + 'px, calc(-50% + ' + y + 'px))';
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // skip on empty stage tap (not on a button)
    box.querySelector('.stage').addEventListener('click', function (ev) {
      if (ev.target === this || ev.target.id === 'ztpTutRow') hideTut();
    });
  }
  function hideTut() {
    var box = document.getElementById('ztpTut');
    if (box && box.parentNode) box.parentNode.removeChild(box);
    document.body.classList.remove('ztp-tut');
  }
  function bootTut() {
    if (!TUT_ON) return;
    // Show on the setup/attract screen; not after play has already started
    // (?tut=1 forces it). Hide once a real game is running.
    if (/[?&]tut=1(?:&|$)/.test(q) || /[?&]shot=cards(?:&|$)/.test(q)) { mountTut(); return; }
    var start = function () {
      var playing = root.BHT && BHT.sim && !BHT.demo && !BHT.attract && (BHT.plist && BHT.plist.length);
      if (playing) return;
      mountTut();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else setTimeout(start, 50);
  }

  /* ---------- lobby toy: fling figures off pegs, free puck ---------- */
  var toy = { on: 0, pos: [], vel: [], held: -1, last: null, puckV: null };
  function homeOf(sim, i) {
    var B = root.Bubble, T = B.TR[i], u = sim.u[i] != null ? sim.u[i] : 0.5;
    var q = B.pos(T, u);
    return [q[0], q[1]];
  }
  function toyActive(sim) {
    if (!TOY_ON || !sim) return false;
    if (sim.over >= 0) return false;
    // Waiting in a lobby / faceoff pause, before the drop.
    if (sim.msg === 'FACE OFF' && sim.pause > 0) return true;
    if (root.BHT && (BHT.demo || BHT.attract)) return true;
    return false;
  }
  function hookToy() {
    if (!TOY_ON || !root.Bubble) return;
    var S = root.Bubble.Sim.prototype;
    if (S._toy984) return; S._toy984 = 1;
    var oStep = S.step;
    S.step = function (dt) {
      var wasFo = this.msg === 'FACE OFF' && this.pause > 0;
      var r = oStep.apply(this, arguments);
      var nowFo = this.msg === 'FACE OFF' && this.pause > 0;
      if (wasFo && !nowFo) {
        // Faceoff drop: return everyone to their rod spots.
        toy.held = -1; toy.pos = []; toy.vel = [];
      } else if (toyActive(this)) {
        applyToy(this, dt || 0.016);
      }
      return r;
    };
    var oFo = S.faceoff;
    S.faceoff = function () {
      var r = oFo.apply(this, arguments);
      toy.held = -1; toy.pos = []; toy.vel = [];
      return r;
    };
  }
  function applyToy(sim, dt) {
    var B = root.Bubble, i, H, F = 2.4, SPR = 1.35;
    if (!toy.pos.length) {
      for (i = 0; i < 12; i++) { var h = homeOf(sim, i); toy.pos[i] = [h[0], h[1]]; toy.vel[i] = [0, 0]; }
    }
    for (i = 0; i < 12; i++) {
      if (i === toy.held) continue;
      var p = toy.pos[i], v = toy.vel[i], hm = homeOf(sim, i);
      v[0] -= v[0] * F * dt; v[1] -= v[1] * F * dt;
      v[0] += (hm[0] - p[0]) * SPR * dt; v[1] += (hm[1] - p[1]) * SPR * dt;
      p[0] += v[0] * dt; p[1] += v[1] * dt;
      // write as a visual/physical offset so they can sit off the peg
      if (!sim.o) continue;
      var q = B.pos(B.TR[i], sim.u[i]);
      sim.o[i] = [p[0] - q[0], p[1] - q[1]];
    }
    // puck stays free: if it was zeroed by the faceoff pause, keep a residual
    if (sim.pause > 0 && sim.msg === 'FACE OFF' && toy.puckV) {
      sim.v[0] = toy.puckV[0]; sim.v[1] = toy.puckV[1];
      sim.p[0] += sim.v[0] * dt; sim.p[1] += sim.v[1] * dt;
      toy.puckV[0] *= Math.exp(-1.2 * dt); toy.puckV[1] *= Math.exp(-1.2 * dt);
    } else if (sim.v && (Math.abs(sim.v[0]) + Math.abs(sim.v[1]) > 0.02)) {
      toy.puckV = [sim.v[0], sim.v[1]];
    }
  }
  function hookToyInput(R) {
    if (!TOY_ON || !R || !R.prototype || R.prototype._toy984) return;
    R.prototype._toy984 = 1;
    // Pad / TV pointer: grab any figure while the toy is active.
    var cv = R.cv || document.getElementById('cv');
    if (!cv || cv._toy984) return;
    cv._toy984 = 1;
    function rinkAt(ev) {
      var V = root.BHT && (root.BHT.R3 && root.BHT.R3.V) || (root.BubbleView && null);
      // fall back: map from view if present on this
      var view = (root.BHT && root.BHT.R3 && root.BHT.R3.V) || null;
      if (view && view.from) {
        try { return view.from(ev.clientX, ev.clientY); } catch (e) {}
      }
      return null;
    }
    function pick(sim, pt) {
      var best = -1, bd = 0.09;
      for (var i = 0; i < 12; i++) {
        var P = toy.pos[i] || homeOf(sim, i);
        var d = Math.hypot(P[0] - pt[0], P[1] - pt[1]);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }
    cv.addEventListener('pointerdown', function (ev) {
      var sim = root.BHT && BHT.sim; if (!toyActive(sim)) return;
      var pt = rinkAt(ev); if (!pt) return;
      var i = pick(sim, pt); if (i < 0) return;
      toy.held = i; toy.last = [pt[0], pt[1], performance.now()];
      if (!toy.pos[i]) toy.pos[i] = [pt[0], pt[1]];
      ev.preventDefault();
    }, { capture: true });
    cv.addEventListener('pointermove', function (ev) {
      if (toy.held < 0) return;
      var sim = root.BHT && BHT.sim; if (!sim) return;
      var pt = rinkAt(ev); if (!pt) return;
      var i = toy.held, now = performance.now(), last = toy.last;
      toy.pos[i] = [pt[0], pt[1]];
      if (last) {
        var dt = Math.max(0.008, (now - last[2]) / 1000);
        toy.vel[i] = [(pt[0] - last[0]) / dt, (pt[1] - last[1]) / dt];
      }
      toy.last = [pt[0], pt[1], now];
    }, { capture: true });
    function end(ev) {
      if (toy.held < 0) return;
      toy.held = -1;
    }
    cv.addEventListener('pointerup', end, { capture: true });
    cv.addEventListener('pointercancel', end, { capture: true });
  }

  /* ---------- replay rework: half length, punchy 1+2, slow 3, framing ---------- */
  function hookReplay(R) {
    if (!R || !R.prototype || R.prototype._rep984) return;
    R.prototype._rep984 = 1;
    var oGoal = R.prototype.goal;
    R.prototype.goal = function (team) {
      var r = oGoal ? oGoal.call(this, team) : undefined;
      var Rp = this.rep; if (!Rp || Rp.cine || !Rp.segs) return r;
      var F = Rp.F; if (!F || F.length < 4) return r;
      var D = F[F.length - 1].t - F[0].t;
      var RSPD = (root.BH_RSPD != null ? root.BH_RSPD : 1);
      // Short pre-roll (was 5–8 s linger in v0.9.81).
      Rp.wait = this.phone ? 0.25 : 0.35;
      // Wall-time lengths (half of the stretched v0.9.81 package, punchy 1+2, slower 3).
      // Replay 1: two cuts ~0.5 s each. Replay 2: two cuts ~0.5 s. Replay 3: ~1.3 s follow.
      var r1 = RSPD, r2 = 0.85 * RSPD, r3 = 0.45 * RSPD;
      function seg(lead, tail, rate, kind) {
        return [Math.max(0, D - lead), D + tail * rate, rate, kind];
      }
      Rp.segs = [
        seg(0.55, 0.20, r1, NEW_FRAME ? 'side' : 'top'),
        seg(0.70, 0.20, r1, NEW_FRAME ? 'track' : 'side'),
        seg(0.80, 0.22, r2, NEW_FRAME ? 'rail' : 'side'),
        seg(0.45, 0.18, r2, NEW_FRAME ? 'net' : 'net'),
        seg(1.10, 0.35, r3, NEW_FRAME ? 'follow' : 'net')
      ];
      Rp._v984 = 1;
      if (root.BHSET) {
        // wait + 0.5+0.5+0.5+0.5+1.3 ≈ 3.7 s so all three replays can play
        root.BHSET.cap = 3.8;
      }
      // interaction memory for framing: last 3 things the puck touched
      Rp._hits = collectHits(F);
      return r;
    };

    var oShot = R.prototype.shot;
    R.prototype.shot = function (kind, fr, Rp, dt, cut) {
      if (kind === 'follow') {
        followCam(this, fr, Rp, dt, cut);
        if (!NEW_FRAME) return this.persp;
        frameHits(this, fr, Rp);
        return this.persp;
      }
      var cam = oShot ? oShot.call(this, kind, fr, Rp, dt, cut) : this.persp;
      if (NEW_FRAME && Rp && !Rp.cine && fr) frameHits(this, fr, Rp);
      return cam || this.persp;
    };
  }
  function collectHits(F) {
    var hits = [], lastTk = null, lastFx = null, lastBg = null;
    function push(kind, id, p) {
      var key = kind + ':' + id;
      if (hits.length && hits[hits.length - 1].key === key) {
        hits[hits.length - 1].p = p; return;
      }
      hits.push({ kind: kind, id: id, p: p, key: key });
      if (hits.length > 12) hits.shift();
    }
    for (var i = 0; i < F.length; i++) {
      var f = F[i], p = f.p || [0.5, 1];
      if (f.tk && f.tk[0] !== lastTk) { lastTk = f.tk[0]; if (f.tk[1] >= 0) push('player', f.tk[1], p); }
      if (f.fx && f.fx[0] !== lastFx) {
        lastFx = f.fx[0];
        var k = f.fx[1], who = f.fx[2];
        if (k === 'G' || k === 'g') push('goalie', who != null ? who : 0, p);
        else if (k === 'B' || k === 'R' || k === 'board') push('boards', 'boards', p);
        else if (k === 'N' || k === 'post' || k === 'net') push('net', 'net', p);
        else if (who != null) push('player', who, p);
      }
      if (f.bpg && f.bpg[0] !== lastBg) { lastBg = f.bpg[0]; push('boards', 'boards', p); }
      if (f.c >= 0) push('player', f.c, p);
    }
    return hits;
  }
  function followCam(view, fr, Rp, dt, cut) {
    var G = view.G, L3to = function (x, y, h) { return G.localToWorld(new THREE.Vector3(y, h || 0, x)); };
    var cam = view.persp, dir = Rp.dir || 1, sd = fr.p[0] < 0.5 ? -1 : 1;
    // Dynamic moving angle that follows the play, always above the ice.
    var u = Rp.t || 0;
    var swing = Math.sin(u * 1.1) * 0.08;
    var want = L3to(fr.p[0] + sd * (0.22 + swing), fr.p[1] - dir * (0.32 + (u * 0.02)), 0.11);
    var look = L3to(fr.p[0], fr.p[1] + dir * 0.08, 0.02 + (fr.z || 0));
    if (cut || !Rp._fw) { Rp._fw = want.clone(); Rp._fl = look.clone(); }
    Rp._fw.lerp(want, 1 - Math.exp(-(dt || 0.016) * 4.2));
    Rp._fl.lerp(look, 1 - Math.exp(-(dt || 0.016) * 5));
    if (Rp._fw.y < 0.04) Rp._fw.y = 0.04;
    cam.position.copy(Rp._fw);
    cam.up.set(0, 1, 0);
    cam.lookAt(Rp._fl);
    Rp.ls = { p: Rp._fl };
  }
  function frameHits(view, fr, Rp) {
    if (!view.G || !view.persp || !fr || !fr.p) return;
    var G = view.G, cam = view.persp;
    var pts = [[fr.p[0], fr.p[1], (fr.z || 0) + 0.01]];
    var hits = Rp._hits || [];
    for (var i = hits.length - 1; i >= 0 && pts.length < 4; i--) {
      var h = hits[i]; if (h && h.p) pts.push([h.p[0], h.p[1], 0.02]);
    }
    // Fit a loose frame around puck + last 3 interactions; line of action along the play.
    var sx = 0, sy = 0, n = pts.length, j;
    for (j = 0; j < n; j++) { sx += pts[j][0]; sy += pts[j][1]; }
    var cx = sx / n, cy = sy / n;
    var span = 0.12;
    for (j = 0; j < n; j++) span = Math.max(span, Math.hypot(pts[j][0] - cx, pts[j][1] - cy));
    span = Math.min(0.55, span + 0.08);
    var dir = Rp.dir || 1;
    var look = G.localToWorld(new THREE.Vector3(cy, 0.03, cx));
    var want = G.localToWorld(new THREE.Vector3(cy - dir * (0.18 + span * 0.5), Math.max(0.08, 0.10 + span * 0.35), cx + (cx < 0.5 ? -1 : 1) * (0.12 + span * 0.25)));
    if (want.y < 0.05) want.y = 0.05;
    // Softly pull the existing camera toward this fit so cuts stay punchy, not top-down.
    cam.position.lerp(want, 0.35);
    if (cam.position.y < 0.05) cam.position.y = 0.05;
    cam.up.set(0, 1, 0);
    cam.lookAt(look);
    Rp.ls = { p: look };
  }

  function hook(R) {
    hookReplay(R);
    hookToyInput(R);
  }

  hookToy();
  if (root.Bubble3D) hook(root.Bubble3D);
  if (root.BHT && root.BHT.R3) hook(root.BHT.R3.constructor);
  bootTut();
  // Late hook if Bubble3D appears after this script (shouldn't, but cheap).
  var t = setInterval(function () {
    if (root.Bubble3D) { hook(root.Bubble3D); hookToy(); }
    if (root.BHT && root.BHT.R3) hook(root.BHT.R3.constructor);
    if (root.Bubble3D && root.Bubble) { clearInterval(t); }
  }, 80);
  setTimeout(function () { clearInterval(t); }, 8000);

  root.ZTP984 = { hook: hook, cards: CARDS, hideTut: hideTut, showTut: mountTut };
})(window);
