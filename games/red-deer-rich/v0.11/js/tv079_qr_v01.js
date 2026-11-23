/* TV v0.7.9: keep the lobby QR and join URL on window.RDR_CONTROLLER (controller_v078.html).
   tv077_boot_v01.js still stamps controller_v076.html on a tick, and tv077b_qr_v01.js
   stops after ~10s / after a one-shot flag, so the v076 URL can come back. This file
   keeps correcting the visible URL and QR for as long as the lobby is up. */
(function (w) {
  'use strict';
  function controllerName() { return w.RDR_CONTROLLER || 'controller_v078.html'; }
  function joinUrlFor(code) {
    var local = /(?:\?|&)local=1(?:&|$)/.test(location.search);
    var base = location.href.replace(/[^/]*([?#].*)?$/, '') + controllerName();
    return base + '?room=' + code + (local ? '&local=1' : '');
  }
  function paintQr(cv, url) {
    if (!cv || !window.qrcode) return;
    try {
      var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      var qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
      var n = qr.getModuleCount(), cell = Math.floor(cv.width / (n + 4)), off = Math.floor((cv.width - cell * n) / 2);
      ctx.fillStyle = '#000';
      for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (qr.isDark(r, col)) ctx.fillRect(off + col * cell, off + r * cell, cell, cell);
    } catch (e) {}
  }
  function fix() {
    var net = w.RDR && RDR.net && RDR.net();
    if (!net || !net.code) return;
    var name = controllerName();
    var url = joinUrlFor(net.code);
    var el = document.getElementById('joinUrl');
    var shown = el ? String(el.textContent || '') : '';
    if (el && shown.indexOf(name) < 0) {
      el.textContent = url.replace(/^https?:\/\//, '');
      el.setAttribute('data-fixed079', net.code + '|' + name);
      paintQr(document.getElementById('qr'), url);
    }
  }
  setInterval(fix, 400);
  if (document.readyState === 'complete') fix();
  else window.addEventListener('load', fix);
})(window);
