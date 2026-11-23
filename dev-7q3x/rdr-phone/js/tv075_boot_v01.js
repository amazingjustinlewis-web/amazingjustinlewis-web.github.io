/* TV v0.7.5 boot: net intercept, draw wrap, QR to controller_v075, wire walkers / smack / lobby / talk. */
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

  function hookNet() {
    var net = w.RDR && RDR.net && RDR.net();
    if (!net || !net.o || hookedNet) return !!net;
    hookedNet = true;
    var orig = net.o.onMessage;
    net.o.onMessage = function (conn, m) {
      if (m && m.t === 'smackTap' && w.RDRSmack) { RDRSmack.onTap(conn, m); return; }
      if (m && m.t === 'talk' && w.RDRTalk) { RDRTalk.onTalk(conn, m); return; }
      if (typeof orig === 'function') return orig.apply(this, arguments);
    };
    if (!net._tv075Send && typeof net.send === 'function') {
      net._tv075Send = true;
      var os = net.send.bind(net);
      net.send = function (conn, m) {
        if (m && m.t === 'state' && w.RDRSmack) {
          var pid = m.me && m.me.id;
          var cue = RDRSmack.cueFor(pid);
          if (cue) m.smack = cue;
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
      var ret = origFrame(now, dt, opts);
      if (w.RDRWalkers) {
        var cam = rnd.cam, camOn = cam && cam.z > 1.002;
        if (camOn) {
          var c = rnd.ctx;
          c.save();
          c.beginPath(); c.rect(rnd.bx, rnd.by, rnd.S, rnd.S); c.clip();
          c.translate(rnd.bx + rnd.S / 2, rnd.by + rnd.S / 2);
          c.scale(cam.z, cam.z);
          c.translate(-cam.x, -cam.y);
          RDRWalkers.draw(rnd, now);
          c.restore();
        } else {
          RDRWalkers.draw(rnd, now);
        }
      }
      return ret;
    };
    return true;
  }

  function fixJoinUrl() {
    var net = w.RDR && RDR.net && RDR.net();
    if (!net || !net.code) return;
    var local = /(?:\?|&)local=1(?:&|$)/.test(location.search);
    var base = location.href.replace(/[^/]*([?#].*)?$/, '') + 'controller_v075.html';
    var url = base + '?room=' + net.code + (local ? '&local=1' : '');
    var el = document.getElementById('joinUrl');
    if (el && el.textContent.indexOf('controller_v075') < 0) {
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
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(off + c * cell, off + r * cell, cell, cell);
      } catch (e) {}
    }
  }

  function boot() {
    hookNet();
    hookDraw();
    if (w.RDRWalkers) RDRWalkers.hookGame();
    if (w.RDRTalk) { RDRTalk.wrapPeopleMouth(); RDRTalk.mountMuteBtn(); }
    if (w.RDRTalkQueue) RDRTalkQueue.wrapRecap();
    if (w.RDRLobbyFX) { RDRLobbyFX.applyLobbyCss(); RDRLobbyFX.wrapStart(); RDRLobbyFX.startWatch(); }
    fixJoinUrl();
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
      if (w.RDRRecap && RDRRecap._tv075Queued) RDRTalkQueue._wrappedOnce = true;
    }
  }

  if (document.readyState === 'complete') boot();
  else w.addEventListener('load', boot);
  setInterval(tick, 400);
})(window);
