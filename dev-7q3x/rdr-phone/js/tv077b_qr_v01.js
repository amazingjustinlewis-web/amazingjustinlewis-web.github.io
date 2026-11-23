/* v0.7.7b: tv077_boot_v01.js still stamps the lobby QR with controller_v076.html.
   After that boot file, retarget the join URL and QR at window.RDR_CONTROLLER. */
(function (w) {
  'use strict';
  function controllerName() { return w.RDR_CONTROLLER || 'controller_v077b.html'; }
  function fix() {
    var net = w.RDR && RDR.net && RDR.net();
    if (!net || !net.code) return;
    var local = /(?:\?|&)local=1(?:&|$)/.test(location.search);
    var base = location.href.replace(/[^/]*([?#].*)?$/, '') + controllerName();
    var url = base + '?room=' + net.code + (local ? '&local=1' : '');
    var el = document.getElementById('joinUrl');
    if (el) el.textContent = url.replace(/^https?:\/\//, '');
    var cv = document.getElementById('qr');
    if (!cv || !window.qrcode) return;
    if (String(el && el.getAttribute('data-fixed077b') || '') === net.code + '|' + controllerName()) return;
    if (el) el.setAttribute('data-fixed077b', net.code + '|' + controllerName());
    try {
      var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
      var qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
      var n = qr.getModuleCount(), cell = Math.floor(cv.width / (n + 4)), off = Math.floor((cv.width - cell * n) / 2);
      ctx.fillStyle = '#000';
      for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (qr.isDark(r, col)) ctx.fillRect(off + col * cell, off + r * cell, cell, cell);
    } catch (e) {}
  }
  var n = 0, iv = setInterval(function () { fix(); if (++n > 40) clearInterval(iv); }, 250);
  if (document.readyState === 'complete') fix();
  else window.addEventListener('load', fix);
})(window);
