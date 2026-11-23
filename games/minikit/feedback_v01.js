/* ZTP shared feedback widget v01.
   ZTPFeedback.mount({ game, version, corner: 'tl'|'tr'|'bl'|'br', offX, offY })
   Self-contained CSS. Sends to the studio playtest inbox via FormSubmit (no email app).
   Offline submissions are queued in localStorage and retried on the next load. */
(function (root) {
  'use strict';
  var GOLD = '#E2B84A';
  var MAIL = 'zerotophi+playtest@mail.grokbot.com';
  /* FormSubmit random-string alias, filled in after inbox activation when provided. */
  var FORM_ALIAS = 'b5f82194fd36ac01bb5848f0a1c181e1';
  var ENDPOINT = 'https://formsubmit.co/ajax/' + (FORM_ALIAS || encodeURIComponent(MAIL));
  var QUEUE_KEY = 'ztp_feedback_queue_v01';
  var NAME_KEY = 'ztp_feedback_name_v01';
  var TAGS = ['Bug', 'Idea', 'Loved it', 'Confusing'];
  var EV_POINTER = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'mousemove', 'click', 'wheel', 'contextmenu'];
  var EV_KEY = ['keydown', 'keyup', 'keypress'];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
  function cssPx(v, fallback) {
    if (v == null || v === '') return fallback;
    return typeof v === 'number' ? v + 'px' : String(v);
  }
  function deviceInfo() {
    var n = navigator || {};
    var parts = [];
    if (n.platform) parts.push(n.platform);
    parts.push((n.maxTouchPoints ? 'touch' : 'pointer') + (n.maxTouchPoints ? '=' + n.maxTouchPoints : ''));
    if (n.userAgent) parts.push(n.userAgent);
    return parts.join(' | ');
  }
  function screenInfo() {
    var iw = (root.innerWidth || 0) + 'x' + (root.innerHeight || 0);
    var sw = (screen && screen.width ? screen.width + 'x' + screen.height : '');
    var dpr = root.devicePixelRatio || 1;
    return iw + ' viewport, ' + (sw ? sw + ' screen, ' : '') + 'dpr ' + dpr;
  }
  function nowStamp() {
    var d = new Date();
    var iso = d.toISOString();
    var local;
    try {
      local = d.toLocaleString('en-CA', { timeZone: 'America/Regina', hour12: false }) + ' America/Regina';
    } catch (e) {
      local = d.toString();
    }
    return iso + ' (' + local + ')';
  }
  function inferGame() {
    var t = (document.title || '').replace(/\s*[|\u2013\u2014\-]\s*Zero to Phi.*$/i, '').trim();
    return t || 'Zero to Phi';
  }
  function inferVersion() {
    var t = document.title || '';
    var m = t.match(/\bv\.?\s*\d+(?:\.\d+)*\b/i) || t.match(/\bv0\.\d[\w.]*/i);
    if (m) return m[0];
    var el = document.querySelector('[data-version], .proto, .ver, .vr');
    if (el && el.getAttribute) return el.getAttribute('data-version') || (el.textContent || '').trim().slice(0, 24);
    return '';
  }
  function savedName() {
    try {
      var n = localStorage.getItem(NAME_KEY);
      if (n) return n;
      var p = JSON.parse(localStorage.getItem('ztp:profile') || 'null');
      if (p && p.name) return String(p.name).slice(0, 40);
    } catch (e) {}
    return '';
  }
  function loadQueue() {
    try {
      var q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return q && q.length ? q : [];
    } catch (e) { return []; }
  }
  function saveQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q || [])); } catch (e) {}
  }

  function postFormSubmit(payload) {
    var body = {
      _subject: 'ZTP feedback: ' + payload.game + (payload.tag ? ' ' + payload.tag : ''),
      _template: 'table',
      _captcha: 'false',
      _honey: payload._honey || '',
      game: payload.game,
      version: payload.version || '',
      tag: payload.tag || '',
      name: payload.name || '',
      message: payload.message,
      url: payload.url,
      device: payload.device,
      screen: payload.screen,
      timestamp: payload.timestamp
    };
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null;
        try { j = JSON.parse(t); } catch (e) {}
        return { okHttp: r.ok, json: j, text: t };
      });
    });
  }
  function accepted(res) {
    if (!res || !res.json) return false;
    var s = res.json.success;
    return s === true || s === 'true';
  }
  function needsActivation(res) {
    var m = res && res.json && String(res.json.message || '');
    return /activat/i.test(m);
  }
  function mailtoUrl(payload) {
    var sub = 'ZTP feedback: ' + payload.game + (payload.tag ? ' ' + payload.tag : '');
    var body = [
      payload.message,
      '',
      '---',
      'Name: ' + (payload.name || ''),
      'Game: ' + payload.game,
      'Version: ' + (payload.version || ''),
      'Tag: ' + (payload.tag || ''),
      'URL: ' + payload.url,
      'Device: ' + payload.device,
      'Screen: ' + payload.screen,
      'Time: ' + payload.timestamp
    ].join('\n');
    return 'mailto:' + MAIL + '?subject=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(body);
  }

  var sending = false;
  function deliver(payload) {
    if (payload._honey) return Promise.resolve({ status: 'dropped' });
    if (!root.navigator.onLine) return Promise.resolve({ status: 'queued' });
    return postFormSubmit(payload).then(function (res) {
      if (accepted(res)) return { status: 'sent' };
      if (needsActivation(res)) return { status: 'queued', reason: 'activation' };
      return { status: 'failed', reason: (res.json && res.json.message) || res.text || 'error' };
    }).catch(function (err) {
      return { status: 'queued', reason: String(err && err.message || err) };
    });
  }
  function enqueue(payload) {
    var q = loadQueue();
    q.push(payload);
    saveQueue(q);
  }
  function flushQueue() {
    var q = loadQueue();
    if (!q.length || sending) return;
    sending = true;
    function next(i) {
      if (i >= q.length) { saveQueue([]); sending = false; return; }
      deliver(q[i]).then(function (r) {
        if (r.status === 'sent' || r.status === 'dropped') {
          next(i + 1);
        } else {
          saveQueue(q.slice(i));
          sending = false;
        }
      });
    }
    next(0);
  }

  var mounted = null;

  function mount(opts) {
    opts = opts || {};
    if (mounted) return mounted;
    var game = opts.game || inferGame();
    var version = opts.version != null ? opts.version : inferVersion();
    var corner = (opts.corner || 'br').toLowerCase();
    if (!/^[tb][lr]$/.test(corner)) corner = 'br';

    var css = document.createElement('style');
    css.textContent =
      '#ztpFbB,#ztpFbS,#ztpFbS *{-webkit-tap-highlight-color:transparent}' +
      '#ztpFbB,#ztpFbS{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-text-size-adjust:100%}' +
      '#ztpFbS input,#ztpFbS textarea{-webkit-user-select:text;user-select:text}' +
      '#ztpFbB{position:fixed;z-index:10050;width:40px;height:40px;padding:0;margin:0;border-radius:50%;' +
        'border:1.5px solid ' + GOLD + ';background:#14121bee;color:' + GOLD + ';box-shadow:0 2px 10px #0008;' +
        'display:flex;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;' +
        'opacity:.92}' +
      '#ztpFbB:hover,#ztpFbB:focus{opacity:1;outline:none;box-shadow:0 0 0 2px #14121b,0 0 0 4px ' + GOLD + '66}' +
      '#ztpFbB svg{display:block;width:22px;height:22px;pointer-events:none}' +
      'body.playing #ztpFbB.ztpFb-host{display:none!important}' +
      '#ztpFbS{position:fixed;inset:0;z-index:10051;display:none;align-items:flex-end;justify-content:center;' +
        'background:#000a;touch-action:none;font:16px/1.35 system-ui,sans-serif;color:#f4efe4}' +
      '#ztpFbS.on{display:flex}' +
      '#ztpFbS .ztpFb-card{background:#16141f;color:#f4efe4;width:min(100vw,440px);max-height:min(92vh,720px);' +
        'border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));' +
        'box-shadow:0 -8px 40px #000a;overflow:auto;touch-action:auto;-webkit-overflow-scrolling:touch}' +
      '@media (min-width:640px){#ztpFbS{align-items:center}#ztpFbS .ztpFb-card{border-radius:18px;padding:20px}}' +
      '#ztpFbS h2{margin:0 36px 4px 0;font:700 20px/1.2 system-ui,sans-serif;color:' + GOLD + ';letter-spacing:.02em}' +
      '#ztpFbS .ztpFb-sub{margin:0 36px 12px 0;font-size:13px;opacity:.75}' +
      '#ztpFbS label{display:block;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:' + GOLD + ';margin:10px 0 6px}' +
      '#ztpFbS textarea,#ztpFbS input[type=text]{width:100%;box-sizing:border-box;background:#0b0a10;color:#f4efe4;' +
        'border:1px solid #E2B84A55;border-radius:12px;padding:12px;font:16px/1.4 system-ui,sans-serif}' +
      '#ztpFbS textarea{min-height:140px;resize:vertical}' +
      '#ztpFbS textarea:focus,#ztpFbS input[type=text]:focus{outline:none;border-color:' + GOLD + ';box-shadow:0 0 0 2px #E2B84A44}' +
      '#ztpFbS .ztpFb-tags{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 8px}' +
      '#ztpFbS .ztpFb-tag{border:1px solid #E2B84A66;background:#0000;color:#f4efe4;border-radius:999px;padding:8px 12px;' +
        'font:700 13px system-ui,sans-serif;cursor:pointer;touch-action:manipulation}' +
      '#ztpFbS .ztpFb-tag[aria-pressed=true]{background:' + GOLD + ';color:#14121b;border-color:' + GOLD + '}' +
      '#ztpFbS .ztpFb-row{display:flex;gap:8px;margin-top:14px}' +
      '#ztpFbS .ztpFb-send,#ztpFbS .ztpFb-close{flex:1;border:0;border-radius:12px;padding:14px 12px;cursor:pointer;' +
        'font:700 16px system-ui,sans-serif;touch-action:manipulation}' +
      '#ztpFbS .ztpFb-send{background:' + GOLD + ';color:#14121b}' +
      '#ztpFbS .ztpFb-send[disabled]{opacity:.45;cursor:default}' +
      '#ztpFbS .ztpFb-close{background:#ffffff14;color:#f4efe4}' +
      '#ztpFbS .ztpFb-x{position:absolute;top:10px;right:10px;width:36px;height:36px;border:0;border-radius:18px;' +
        'background:#ffffff14;color:#f4efe4;font:700 20px/36px system-ui;cursor:pointer}' +
      '#ztpFbS .ztpFb-msg{min-height:1.3em;margin:10px 0 0;font-size:14px;color:' + GOLD + '}' +
      '#ztpFbS .ztpFb-card{position:relative}' +
      '#ztpFbS .ztpFb-hp{position:absolute;left:-9999px;height:0;width:0;opacity:0;pointer-events:none}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.id = 'ztpFbB';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Send feedback');
    btn.setAttribute('title', 'Feedback');
    if (document.getElementById('launcher') || document.getElementById('stage')) btn.className = 'ztpFb-host';
    btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="' + GOLD + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" d="M5 5.8h14a2.4 2.4 0 0 1 2.4 2.4v6.4a2.4 2.4 0 0 1-2.4 2.4h-5.7L8.2 20.8v-3.8H5A2.4 2.4 0 0 1 2.6 14.6V8.2A2.4 2.4 0 0 1 5 5.8z"/><circle cx="8.2" cy="11.7" r="1.05" fill="' + GOLD + '"/><circle cx="12" cy="11.7" r="1.05" fill="' + GOLD + '"/><circle cx="15.8" cy="11.7" r="1.05" fill="' + GOLD + '"/></svg>';
    var vert = corner.charAt(0) === 't' ? 'top' : 'bottom';
    var horz = corner.charAt(1) === 'l' ? 'left' : 'right';
    var offY = cssPx(opts.offY, '12px');
    var offX = cssPx(opts.offX, '12px');
    btn.style[vert] = 'max(' + offY + ', env(safe-area-inset-' + vert + ', 0px))';
    btn.style[horz] = 'max(' + offX + ', env(safe-area-inset-' + horz + ', 0px))';

    var sheet = document.createElement('div');
    sheet.id = 'ztpFbS';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'ztpFbH');
    sheet.hidden = true;
    sheet.innerHTML = '<div class="ztpFb-card">' +
      '<button class="ztpFb-x" type="button" aria-label="Close">&times;</button>' +
      '<h2 id="ztpFbH">Feedback</h2>' +
      '<p class="ztpFb-sub">Goes to the Zero to Phi studio. No account needed.</p>' +
      '<label for="ztpFbMsg">Your note</label>' +
      '<textarea id="ztpFbMsg" name="message" maxlength="4000" placeholder="Tell us anything \u2014 tap the mic on your keyboard to talk"></textarea>' +
      '<label for="ztpFbName">Name or initials <span style="text-transform:none;opacity:.7">(optional)</span></label>' +
      '<input id="ztpFbName" type="text" name="name" maxlength="60" placeholder="Name or initials" autocomplete="name">' +
      '<input class="ztpFb-hp" id="ztpFbHp" type="text" name="_honey" tabindex="-1" autocomplete="off">' +
      '<label>Tag <span style="text-transform:none;opacity:.7">(optional)</span></label>' +
      '<div class="ztpFb-tags" id="ztpFbTags"></div>' +
      '<div class="ztpFb-row"><button class="ztpFb-send" type="button" disabled>Send</button><button class="ztpFb-close" type="button">Close</button></div>' +
      '<div class="ztpFb-msg" id="ztpFbNote" aria-live="polite"></div>' +
      '</div>';

    function place() {
      /* Nudge away from a same-corner Invite button if both are visible. */
      var inv = document.getElementById('zinvB');
      if (!inv || inv.style.display === 'none' || inv.classList.contains('h')) return;
      var ics = root.getComputedStyle(inv);
      var sameV = (vert === 'top' && ics.top !== 'auto') || (vert === 'bottom' && ics.bottom !== 'auto');
      var sameH = (horz === 'left' && ics.left !== 'auto') || (horz === 'right' && ics.right !== 'auto');
      if (sameV && sameH) {
        var extra = (parseFloat(offY) || 12) + 52;
        btn.style[vert] = 'max(' + extra + 'px, env(safe-area-inset-' + vert + ', 0px))';
      }
    }

    var open = false;
    var tag = '';
    var lastFocus = null;
    var openedAt = 0;
    var $msg, $name, $note, $send, $hp;

    function insideWidget(t) {
      return t && (t === btn || t === sheet || (sheet.contains && sheet.contains(t)) || (btn.contains && btn.contains(t)));
    }
    function trapBubble(e) {
      e.stopPropagation();
    }
    function shieldPointer(e) {
      if (!insideWidget(e.target)) {
        if (open) { e.stopPropagation(); e.preventDefault(); }
        return;
      }
      /* Let the event reach the button/sheet; do not capture-stop on the widget itself
         or our own click/input handlers never run. */
    }
    function trapKey(e) {
      if (!open) return;
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (insideWidget(e.target)) return;
      e.stopPropagation();
      e.preventDefault();
    }
    EV_POINTER.forEach(function (ev) {
      btn.addEventListener(ev, trapBubble, false);
      sheet.addEventListener(ev, trapBubble, false);
      root.addEventListener(ev, shieldPointer, true);
    });
    EV_KEY.forEach(function (ev) {
      root.addEventListener(ev, trapKey, true);
    });

    function setNote(t) { $note.textContent = t || ''; }
    function syncSend() {
      $send.disabled = !String($msg.value || '').trim() || $send.dataset.busy === '1';
    }
    function show() {
      if (open) return;
      open = true;
      openedAt = Date.now();
      lastFocus = document.activeElement;
      sheet.hidden = false;
      sheet.classList.add('on');
      $msg.value = '';
      $name.value = savedName();
      $hp.value = '';
      tag = '';
      Array.prototype.forEach.call(sheet.querySelectorAll('.ztpFb-tag'), function (b) { b.setAttribute('aria-pressed', 'false'); });
      $send.dataset.busy = '';
      $send.textContent = 'Send';
      setNote('');
      syncSend();
      setTimeout(function () { try { $msg.focus(); } catch (e) {} }, 50);
    }
    function close() {
      if (!open) return;
      open = false;
      sheet.classList.remove('on');
      sheet.hidden = true;
      if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
    }
    function send() {
      var message = String($msg.value || '').trim();
      if (!message || $send.dataset.busy === '1') return;
      var name = String($name.value || '').trim();
      var payload = {
        game: game,
        version: version || '',
        tag: tag,
        name: name,
        message: message,
        url: location.href,
        device: deviceInfo(),
        screen: screenInfo(),
        timestamp: nowStamp(),
        _honey: String($hp.value || '')
      };
      $send.dataset.busy = '1';
      $send.textContent = 'Sending\u2026';
      $send.disabled = true;
      setNote('');
      if (name) try { localStorage.setItem(NAME_KEY, name); } catch (e) {}
      deliver(payload).then(function (r) {
        if (r.status === 'sent' || r.status === 'dropped') {
          setNote('Thanks! Sent to the studio.');
          $send.textContent = 'Sent';
          setTimeout(close, 1400);
          return;
        }
        enqueue(payload);
        if (r.status === 'queued') {
          setNote('Thanks! Sent to the studio.');
          $send.textContent = 'Saved';
          setTimeout(close, 1400);
          return;
        }
        /* Hard failure: last-resort mailto. */
        $send.dataset.busy = '';
        $send.textContent = 'Send';
        syncSend();
        setNote('Could not send just now. You can try again, or open your email app.');
        var a = sheet.querySelector('.ztpFb-mail');
        if (!a) {
          a = document.createElement('a');
          a.className = 'ztpFb-mail';
          a.style.cssText = 'display:inline-block;margin-top:8px;color:' + GOLD + ';font-weight:700';
          a.textContent = 'Open email app';
          $note.parentNode.appendChild(a);
        }
        a.href = mailtoUrl(payload);
      });
    }

    function ready() {
      $msg = sheet.querySelector('#ztpFbMsg');
      $name = sheet.querySelector('#ztpFbName');
      $note = sheet.querySelector('#ztpFbNote');
      $send = sheet.querySelector('.ztpFb-send');
      $hp = sheet.querySelector('#ztpFbHp');
      var tags = sheet.querySelector('#ztpFbTags');
      TAGS.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ztpFb-tag';
        b.textContent = t;
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function (e) {
          e.preventDefault();
          tag = tag === t ? '' : t;
          Array.prototype.forEach.call(tags.children, function (x) {
            x.setAttribute('aria-pressed', x.textContent === tag ? 'true' : 'false');
          });
        });
        tags.appendChild(b);
      });
      $msg.addEventListener('input', syncSend);
      sheet.querySelector('.ztpFb-send').addEventListener('click', function (e) { e.preventDefault(); send(); });
      sheet.querySelector('.ztpFb-close').addEventListener('click', function (e) { e.preventDefault(); close(); });
      sheet.querySelector('.ztpFb-x').addEventListener('click', function (e) { e.preventDefault(); close(); });
      sheet.addEventListener('click', function (e) {
        if (e.target === sheet && Date.now() - openedAt > 350) close();
      });
      function tapOpen(e) { e.preventDefault(); e.stopPropagation(); show(); }
      btn.addEventListener('click', tapOpen);
      btn.addEventListener('pointerup', function (e) {
        if (e.button != null && e.button !== 0) return;
        tapOpen(e);
      });
    }

    function attach() {
      (document.body || document.documentElement).appendChild(btn);
      (document.body || document.documentElement).appendChild(sheet);
      ready();
      place();
      setTimeout(place, 800);
      flushQueue();
    }
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', attach);

    mounted = { open: show, close: close, button: btn, flush: flushQueue };
    root.ZTPFeedback.last = mounted;
    return mounted;
  }

  function autoOpts() {
    var s = document.currentScript;
    var o = {};
    if (!s || !s.getAttribute) return o;
    if (s.getAttribute('data-game')) o.game = s.getAttribute('data-game');
    if (s.getAttribute('data-version')) o.version = s.getAttribute('data-version');
    if (s.getAttribute('data-corner')) o.corner = s.getAttribute('data-corner');
    if (s.getAttribute('data-off-x')) o.offX = s.getAttribute('data-off-x');
    if (s.getAttribute('data-off-y')) o.offY = s.getAttribute('data-off-y');
    return o;
  }

  root.ZTPFeedback = { mount: mount, flush: flushQueue, mailtoUrl: mailtoUrl, version: 'v01' };

  /* Auto-mount only when the script tag sets data-auto="1" or data-game.
     Pages that call ZTPFeedback.mount({...}) right after the script should not auto-mount,
     or the later mount would be ignored. */
  (function () {
    var s = document.currentScript;
    if (!s) return;
    var auto = s.getAttribute('data-auto') === '1' || !!s.getAttribute('data-game');
    if (auto) {
      var o = autoOpts();
      if (document.body) mount(o);
      else document.addEventListener('DOMContentLoaded', function () { mount(o); });
    }
  })();
  root.addEventListener('online', function () { flushQueue(); });
})(window);
