/* Shared helper to mount Invite v02 on a TV host or phone pad. */
(function (root) {
  'use strict';
  function localFlag() { return /[?&]local=1/.test(location.search) ? '&local=1' : ''; }
  function dir() { return location.href.replace(/[^/]*([?#].*)?$/, ''); }
  function looksCode(s) {
    var t = String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
    return t.length === 4 ? t : '';
  }
  function readCode() {
    var net = root.__ZTP_NET;
    if (net && looksCode(net.code) && net.status !== 'connecting' && net.status !== 'offline') return looksCode(net.code);
    var h = root.Kit && Kit.lastHost;
    if (h && looksCode(h.code) && (h.status === 'online' || h.status === 'ok' || !h.status)) return looksCode(h.code);
    var p = root.Kit && Kit.lastPad;
    if (p && looksCode(p.room)) return looksCode(p.room);
    var cands = [];
    try {
      if (root.RDR) cands.push(root.RDR.host, root.RDR.net);
      if (root.ZT) cands.push(root.ZT.host, root.ZT.net);
      if (root.LR) cands.push(root.LR.host, root.LR.net);
      if (root.PS) cands.push(root.PS);
      if (root.LSNet && root.LSNet.lastHost) cands.push(root.LSNet.lastHost);
    } catch (e) {}
    var i, n;
    for (i = 0; i < cands.length; i++) {
      n = cands[i];
      if (n && looksCode(n.code) && n.status !== 'connecting' && n.status !== 'offline') return looksCode(n.code);
      if (n && looksCode(n.room)) return looksCode(n.room);
    }
    var el = document.getElementById('code') || document.getElementById('minicode') || document.querySelector('.kcode, .code');
    if (el) {
      var t = looksCode(el.textContent);
      if (t) return t;
    }
    return looksCode(new URLSearchParams(location.search).get('room') || '');
  }
  root.ZTPInvite = {
    readCode: readCode,
    joinUrl: function (joinFile, code) {
      return dir() + joinFile + '?room=' + encodeURIComponent(code) + localFlag() + '&inv=1&auto=1';
    },
    attach: function (o) {
      if (!root.Invite) return null;
      var inv = root.Invite.mount({
        title: o.title,
        corner: o.corner || (o.role === 'pad' ? 'tr' : 'bl'),
        offY: o.offY, offX: o.offX,
        hideBtn: !!o.hideBtn,
        tvUrl: o.tvUrl,
        text: o.text,
        code: function () { return (o.code && o.code()) || readCode(); },
        url: function (c) { return (o.url && o.url(c)) || root.ZTPInvite.joinUrl(o.join, c); },
        noCode: o.noCode
      });
      if (o.invOpen || /[?&]inv=1/.test(location.search)) setTimeout(function () { try { inv.open(); } catch (e) {} }, 450);
      // Prefill-only join screens: tap Join once if auto=1 and the form is still up.
      if (o.role === 'pad' && /[?&]auto=1/.test(location.search) && /[?&]room=/.test(location.search)) {
        setTimeout(function () {
          var join = document.getElementById('join');
          if (join && (join.hidden || join.classList.contains('hide'))) return;
          var btn = document.getElementById('joinBtn') || document.getElementById('kgo') || document.getElementById('go');
          if (btn && !root.ZTPInvite._autoClicked) { root.ZTPInvite._autoClicked = true; try { btn.click(); } catch (e2) {} }
        }, 600);
      }
      root.ZTPInvite.last = inv;
      return inv;
    }
  };
})(window);
