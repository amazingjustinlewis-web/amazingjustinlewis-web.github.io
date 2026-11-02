/* ZTP invite panel v01 (from battleship play_v02): icon -> panel with QR, code, Text, Email, Copy link, Share.
   Invite.mount({ title, code: fn->code|'' , url: fn(code)->link, noCode: fn (optional), corner: 'tl'|'tr'|'bl'|'br' }) */
(function (root) {
  'use strict';
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function qr(u) { try { var q = root.qrcode(0, 'M'); q.addData(u); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); } catch (e) { return ''; } }
  root.Invite = { mount: function (o) {
    var css = document.createElement('style');
    css.textContent = '#zinvB{position:fixed;z-index:1000;touch-action:manipulation;border:2px solid #fff6;background:#000a;color:#fff;border-radius:12px;font:700 15px system-ui;padding:8px 12px;cursor:pointer}' +
      '#zinv{position:fixed;inset:0;z-index:1000;background:#000c;display:none;align-items:center;justify-content:center;touch-action:manipulation}#zinv.on{display:flex}' +
      '#zinv .c{background:#14122a;color:#fff;border-radius:18px;padding:16px;width:min(92vw,440px);max-height:94vh;overflow:auto;text-align:center;font-family:system-ui}' +
      '#zinvQ{width:min(70vw,48vh);aspect-ratio:1;margin:8px auto;background:#fff;border-radius:12px;padding:4px;color:#222;word-break:break-all}#zinvQ svg{width:100%;height:100%}' +
      '#zinvC{font:800 30px ui-monospace,monospace;letter-spacing:.15em;color:#ffe7a0}#zinv .g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}' +
      '#zinv .g a,#zinv .g button,#zinvX{display:block;padding:12px;border-radius:12px;border:0;background:#5b6cff;color:#fff;font:700 15px system-ui;text-decoration:none;touch-action:manipulation}#zinvX{width:100%;background:#555}#zinv .h{display:none!important}';
    document.head.appendChild(css);
    var b = document.createElement('button'); b.id = 'zinvB'; b.type = 'button'; b.textContent = '\uD83D\uDD17 Invite';
    var k = o.corner || 'bl'; b.style[k[0] === 't' ? 'top' : 'bottom'] = o.offY || '12px'; b.style[k[1] === 'l' ? 'left' : 'right'] = o.offX || '12px';
    var p = document.createElement('div'); p.id = 'zinv';
    p.innerHTML = '<div class="c"><h2 style="margin:4px 0">Invite a friend to ' + esc(o.title) + '</h2><div id="zinvQ"></div><div id="zinvC"></div><p id="zinvL" style="font-size:12px;opacity:.75;word-break:break-all"></p>' +
      '<p style="font-size:13px;opacity:.85">Works on any network. Their link drops them straight into this match.</p>' +
      '<div class="g"><button id="zinvS">Share\u2026</button><a id="zinvT">Text invite</a><a id="zinvM">Email</a><button id="zinvK">Copy link</button></div><div id="zinvMsg" style="min-height:1.2em"></div><button id="zinvX">Close</button></div>';
    document.body.appendChild(b); document.body.appendChild(p);
    function $(i) { return document.getElementById(i); }
    function open() {
      var c = '', u = ''; try { c = o.code() || ''; } catch (e) {}
      $('zinvMsg').textContent = ''; var btns = ['zinvS', 'zinvT', 'zinvM', 'zinvK'];
      if (!c) { $('zinvC').textContent = ''; $('zinvL').textContent = ''; btns.forEach(function (i) { $(i).classList.add('h'); });
        $('zinvQ').innerHTML = '<div style="padding:18px;font-size:15px">' + (o.noCode ? 'You are flying solo right now.<br><br><button id="zinvH" style="padding:12px;border-radius:12px;border:0;background:#5b6cff;color:#fff;font-weight:700">Host a match for friends &amp; get invite</button>' : 'Still connecting\u2026 try again in a moment.') + '</div>';
        if ($('zinvH')) $('zinvH').onclick = o.noCode;
      } else {
        u = o.url(c); var msg = 'Join my ' + o.title + ' match on Zero to Phi (code ' + c + '): ' + u;
        btns.forEach(function (i) { $(i).classList.remove('h'); }); $('zinvS').classList.toggle('h', !navigator.share);
        $('zinvC').textContent = c; $('zinvL').textContent = u;
        $('zinvQ').innerHTML = qr(u) || '<div style="padding:14px;font-size:14px">QR unavailable. Share this link:<br><b>' + esc(u) + '</b></div>';
        $('zinvS').onclick = function () { navigator.share({ title: o.title, text: msg, url: u }).catch(function () {}); };
        $('zinvT').href = 'sms:?&body=' + encodeURIComponent(msg);
        $('zinvM').href = 'mailto:?subject=' + encodeURIComponent('Join my ' + o.title + ' match') + '&body=' + encodeURIComponent(msg);
        $('zinvK').onclick = function () { var done = function () { $('zinvMsg').textContent = 'Link copied'; };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, function () { prompt('Copy this link', u); }); else prompt('Copy this link', u); };
      }
      p.classList.add('on');
    }
    b.onclick = open; $('zinvX').onclick = function () { p.classList.remove('on'); };
    p.onclick = function (e) { if (e.target === p) p.classList.remove('on'); };
    return { open: open, button: b };
  } };
})(window);
