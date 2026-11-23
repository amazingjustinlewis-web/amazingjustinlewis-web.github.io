/* TV v0.7.7 boot: net intercept (smack, talk, selfie, profile, queue), draw wrap (walkers, underlight,
   lobby zoom vignette, dice, waypoints, montage, selfie, turn ping), QR to controller_v076. */
(function (w) {
  'use strict';
  var hookedNet = false, hookedDraw = false;

  function sendToClient(c, m) {
    var net = w.RDR && RDR.net && RDR.net();
    if (net && c && c.conn && net.send) net.send(c.conn, m);
  }
  function sendToPid(pid, m) {
    var cl = w.RDR && RDR.clients; if (!cl) return;
    for (var k in cl) if (cl[k].pid === pid) sendToClient(cl[k], m);
  }
  function sendAll(m) {
    var cl = w.RDR && RDR.clients; if (!cl) return;
    for (var k in cl) sendToClient(cl[k], m);
  }
  w.RDR075 = { sendToPid: sendToPid, sendAll: sendAll, sendToClient: sendToClient };
  w.RDR076 = w.RDR075;

  function hookNet() {
    var net = w.RDR && RDR.net && RDR.net();
    if (!net || !net.o || hookedNet) return !!net;
    hookedNet = true;
    var orig = net.o.onMessage;
    net.o.onMessage = function (conn, m) {
      if (m && m.t === 'smackTap' && w.RDRSmack) { RDRSmack.onTap(conn, m); return; }
      if (m && m.t === 'talk' && w.RDRTalk) { RDRTalk.onTalk(conn, m); return; }
      if (m && m.t === 'selfie' && w.RDRSelfie) {
        var cl = w.RDR && RDR.clients, pid = m.pid;
        if (pid == null && cl) { for (var k in cl) if (cl[k].conn === conn) pid = cl[k].pid; }
        if (m.clear) RDRSelfie.clear(pid);
        else if (m.data) RDRSelfie.setFace(pid, m.data);
        return;
      }
      if (m && m.t === 'profileLook' && w.RDRSelfie && RDRSelfie.setProfile) {
        var clp = w.RDR && RDR.clients, pidp = m.pid;
        if (pidp == null && clp) { for (var kp in clp) if (clp[kp].conn === conn) pidp = clp[kp].pid; }
        RDRSelfie.setProfile(pidp, { look: m.look, face: m.face });
        return;
      }
      if (m && w.RDRQueue && RDRQueue.onMessage(conn, m)) return;
      if (m && w.RDRScreens && RDRScreens.onMessage(conn, m)) return;
      if (m && m.t === 'svoteClear') {
        var sv = w.RDR && RDR.sv && RDR.sv();
        var pid = m.pid;
        if (pid == null && w.RDR && RDR.clients) {
          for (var ck in RDR.clients) if (RDR.clients[ck].conn === conn) pid = RDR.clients[ck].pid;
        }
        if (sv && pid != null) { delete sv.yes[pid]; delete sv.no[pid]; }
        return;
      }
      if (typeof orig === 'function') return orig.apply(this, arguments);
    };
    if (!net._tv076Send && typeof net.send === 'function') {
      net._tv076Send = true;
      var os = net.send.bind(net);
      net.send = function (conn, m) {
        if (m && m.t === 'state' && w.RDRSmack) {
          var pid = m.me && m.me.id;
          var cue = RDRSmack.cueFor(pid);
          if (cue) m.smack = cue;
        }
        if (m && m.t === 'state' && w.RDRQueue) {
          m.queue = RDRQueue.snapshot();
        }
        if (m && m.t === 'state') {
          m.recap = !!(w.RDRMontage && RDRMontage.isOn && RDRMontage.isOn())
            || !!(w.RDRRecap && RDRRecap.playing)
            || !!(document.getElementById('rrecP') && document.getElementById('rrecP').classList.contains('on'));
          if (w.RDRSmack && RDRSmack.lastHit) m.smackHit = RDRSmack.lastHit;
        }
        return os(conn, m);
      };
    }
    return true;
  }

  function hookDraw() {
    var rnd = w.RDR && RDR.render;
    if (!rnd || hookedDraw) return !!rnd;
    if (typeof rnd.frame !== 'function' || typeof rnd.drawToken !== 'function') return false;
    hookedDraw = true;
    var origFrame = rnd.frame.bind(rnd);
    var origToken = rnd.drawToken.bind(rnd);
    rnd.drawToken = function (c, p, x, y, r, active, now) {
      if (w.RDRWalkers && RDRWalkers.replaces(p)) return;
      return origToken(c, p, x, y, r, active, now);
    };
    rnd.frame = function (now, dt, opts) {
      opts = opts || {};
      var g = w.RDR && RDR.game;
      if (g && g.phase === 'lobby') opts.paused = true;
      if (w.RDRWalkers) RDRWalkers.update(now, dt, rnd);
      if (w.RDRDiceHandoff) RDRDiceHandoff.update(now);
      var ret = origFrame(now, dt, opts);
      var cam = rnd.cam, camOn = cam && cam.z > 1.002;
      function overlay() {
        if (w.RDRRunnerFx && RDRRunnerFx.drawUnder) RDRRunnerFx.drawUnder(rnd, now);
        if (w.RDRWalkers) RDRWalkers.draw(rnd, now);
        if (w.RDRDiceHandoff) RDRDiceHandoff.draw(rnd.ctx, rnd, now);
        if (w.RDRFxTune && RDRFxTune.drawWaypoints) RDRFxTune.drawWaypoints(rnd.ctx, rnd, now);
        if (w.RDRMontage && RDRMontage.draw) RDRMontage.draw(rnd.ctx, rnd, now);
        if (w.RDRPipCam && RDRPipCam.draw) RDRPipCam.draw(rnd, now);
        if (w.RDRLobbyCam && RDRLobbyCam.drawVignette) RDRLobbyCam.drawVignette(rnd.ctx, rnd);
      }
      if (camOn) {
        var c = rnd.ctx;
        c.save();
        c.beginPath(); c.rect(rnd.bx, rnd.by, rnd.S, rnd.S); c.clip();
        c.translate(rnd.bx + rnd.S / 2, rnd.by + rnd.S / 2);
        c.scale(cam.z, cam.z);
        c.translate(-cam.x, -cam.y);
        overlay();
        c.restore();
      } else {
        overlay();
      }
      return ret;
    };
    return true;
  }

  function fixJoinUrl() {
    var net = w.RDR && RDR.net && RDR.net();
    if (!net || !net.code) return;
    var local = /(?:\?|&)local=1(?:&|$)/.test(location.search);
    var base = location.href.replace(/[^/]*([?#].*)?$/, '') + 'controller_v076.html';
    var url = base + '?room=' + net.code + (local ? '&local=1' : '');
    var el = document.getElementById('joinUrl');
    if (el && el.textContent.indexOf('controller_v076') < 0) {
      el.textContent = url.replace(/^https?:\/\//, '');
    }
    var cv = document.getElementById('qr');
    if (cv && window.qrcode && el && String(el.getAttribute('data-fixed') || '') !== net.code) {
      el.setAttribute('data-fixed', net.code);
      try {
        var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        var qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
        var n = qr.getModuleCount(), cell = Math.floor(cv.width / (n + 4)), off = Math.floor((cv.width - cell * n) / 2);
        ctx.fillStyle = '#000';
        for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (qr.isDark(r, col)) ctx.fillRect(off + col * cell, off + r * cell, cell, cell);
      } catch (e) {}
    }
  }

  function simClass() {
    if (/(?:\?|&)sim=1(?:&|$)/.test(location.search)) document.documentElement.classList.add('sim');
  }

  function testHooks() {
    var Q = new URLSearchParams(location.search);
    var t = Q.get('test');
    if (!t) return;
    setTimeout(function () {
      try {
        if (t === 'recap' && w.RDRMontage) RDRMontage.test();
        if (t === 'selfie' && w.RDRSelfie) {
          var g = w.RDR && RDR.game, p = g && g.players[0];
          if (p) RDRSelfie.placeholder(p.id, (p.name || 'ME').slice(0, 4));
          g && g.players.slice(0, 4).forEach(function (q, i) { RDRSelfie.placeholder(q.id, (q.name || ('P' + i)).slice(0, 4)); });
        }
        if (t === 'dice' && w.RDRDiceHandoff) {
          var g2 = w.RDR && RDR.game;
          if (g2 && g2.players[0] && g2.players[1]) RDRDiceHandoff.test(g2.players[0].id, g2.players[1].id);
        }
        if (t === 'caught') {
          var el = document.getElementById('payupBar');
          if (el) { el.hidden = false; el.className = 'caught'; el.innerHTML = '<div class="pu1">CAUGHT!</div><div class="pu2">Test catch: $140 rent</div>'; document.body.classList.add('rdr-caught'); }
        }
        if (t === 'lobby' && w.RDRLobbyCam) {
          document.body.classList.add('tv076-lobby');
          var lobby = document.getElementById('lobby'); if (lobby) { lobby.hidden = false; lobby.classList.add('tv076-overlay'); }
          if (w.RDR && RDR.addAI) { try { RDR.addAI(); RDR.addAI(); RDR.addAI(); } catch (e2) {} }
        }
        function fillDemo() {
            try {
              var g = w.RDR && RDR.game; if (!g) return;
              var p0 = g.players[0], p1 = g.players[1], p2 = g.players[2];
              [1, 3, 6, 8, 9, 11, 13, 14].forEach(function (i, k) {
                var pr = g.props[i]; if (!pr) return;
                var who = g.players[k % 3];
                pr.owner = g.oid(who);
                if (i === 1 || i === 6) pr.hocked = true;
                if (i === 14 || i === 9) pr.shops = 3;
              });
              if (p0) p0.cash = 4200;
              if (p2) p2.cash = 80;
              if (w.RDRSelfie) {
                if (p0) RDRSelfie.placeholder(p0.id, (p0.name || 'ME').slice(0, 4));
                if (p1 && RDRSelfie.setProfile) {
                  RDRSelfie.setProfile(p1.id, { look: { shirt: p1.color, pants: '#222', shoes: '#111', hatStyle: 'cap', hat: p1.color, skin: '#f1c7a1' } });
                  RDRSelfie.placeholder(p1.id, (p1.name || 'P2').slice(0, 4));
                  var f = RDRSelfie.of(p1.id); if (f) { RDRSelfie.setProfile(p1.id, { face: f.url }); RDRSelfie.clear(p1.id); }
                }
              }
              if (typeof g.updateStates === 'function') g.updateStates();
            } catch (e4) { if (w.console) console.error(e4); }
        }
        w.RDR077StartBtn = function () {
          try { while ((RDR.game.players || []).length < 4) RDR.addAI(); } catch (e) {}
          var b = document.getElementById('startBtn');
          if (b) { b.disabled = false; b.click(); }
          return (w.RDR && RDR.game && RDR.game.phase) || '';
        };
        if (t === 'play' && w.RDR && RDR.addAI) {
          try { while ((RDR.game.players || []).length < 4) RDR.addAI(); RDR.startGame(); } catch (e3) {}
          setTimeout(fillDemo, 500);
        }
        if (t === 'playbtn' && w.RDR && RDR.addAI) {
          w.RDR077StartBtn();
          setTimeout(fillDemo, 500);
        }
      } catch (e) { if (w.console) console.error(e); }
    }, 700);
  }

  function hookSmackHit() {
    if (!w.RDRSmack || typeof RDRSmack.doSmack !== 'function' || RDRSmack._tv077Hit) return;
    RDRSmack._tv077Hit = true;
    var orig = RDRSmack.doSmack.bind(RDRSmack);
    RDRSmack.doSmack = function () {
      RDRSmack.lastHit = { at: Date.now(), kind: arguments[0] && arguments[0].kind, from: arguments[0] && arguments[0].from, to: arguments[0] && arguments[0].to };
      return orig.apply(this, arguments);
    };
  }
  function boot() {
    simClass();
    hookNet();
    hookDraw();
    if (w.RDRFxTune) RDRFxTune.boot();
    if (w.RDRWalkers) RDRWalkers.hookGame();
    if (w.RDRTalk) { RDRTalk.wrapPeopleMouth(); RDRTalk.mountMuteBtn(); }
    if (w.RDRTalkQueue) RDRTalkQueue.wrapRecap();
    if (w.RDRLobbyFX) { RDRLobbyFX.applyLobbyCss(); RDRLobbyFX.wrapStart(); RDRLobbyFX.startWatch(); }
    if (w.RDRLobbyCam) RDRLobbyCam.boot();
    if (w.RDRDiceHandoff) { RDRDiceHandoff.wrapRoll(); RDRDiceHandoff.hookTurns(); }
    if (w.RDRSelfie) RDRSelfie.wrapWalkers();
    if (w.RDRMontage) { RDRMontage.hookGame(); RDRMontage.hookSmack(); RDRMontage.wrapRecap(); }
    if (w.RDRQueue) RDRQueue.hookEnd();
    if (w.RDRTurnPing) RDRTurnPing.boot();
    if (w.RDRScreens) RDRScreens.boot();
    hookSmackHit();
    if (w.RDRChrome) RDRChrome.boot();
    if (w.RDRPipCam) RDRPipCam.boot();
    if (w.RDRDiceHandoff) { RDRDiceHandoff.wrapRoll(); RDRDiceHandoff.hookTurns(); }
    fixJoinUrl();
    testHooks();
  }

  function tick() {
    if (!hookedNet) hookNet();
    if (!hookedDraw) hookDraw();
    fixJoinUrl();
    if (w.RDRWalkers && w.RDR && RDR.game && !RDRWalkers._hookedOnce) {
      RDRWalkers.hookGame(); RDRWalkers._hookedOnce = true;
    }
    if (w.RDRTalkQueue && !RDRTalkQueue._wrappedOnce) {
      RDRTalkQueue.wrapRecap();
      if (w.RDRRecap && (RDRRecap._tv075Queued || RDRRecap._tv076Montage)) RDRTalkQueue._wrappedOnce = true;
    }
    if (w.RDRMontage && w.RDRRecap && !RDRRecap._tv076Montage) RDRMontage.wrapRecap();
    if (w.RDRSelfie) RDRSelfie.wrapWalkers();
    if (w.RDRDiceHandoff) { RDRDiceHandoff.wrapRoll(); RDRDiceHandoff.hookTurns(); }
    if (w.RDRLobbyCam) RDRLobbyCam.wrapCam();
    if (w.RDRFxTune) RDRFxTune.wrapOwners();
    if (w.RDRScreens) RDRScreens.tick();
    if (w.RDRChrome) RDRChrome.sync();
    if (w.RDRPipCam) { RDRPipCam.hookCam(); RDRPipCam.paintUi(); }
  }

  if (document.readyState === 'complete') boot();
  else w.addEventListener('load', boot);
  setInterval(tick, 400);
})(window);
