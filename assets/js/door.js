/* Zero to Phi front door (TV side).
   Every screen opens a PeerJS room; its QR is <site>/go/?pair=<room>. A phone that scans becomes this screen's remote:
   the QR sinks into the black, and the TV shows the options menu, driven from the phone (or locally by mouse/keyboard).
   Picking a big-screen game fades the TV into it (in-page frame, no new tab); the game shows its own join QR,
   and the front-door QR comes back for the next arrival. ?local=1 uses a same-browser BroadcastChannel (tests). */
(function (root) {
  'use strict';
  var SITE = 'https://amazingjustinlewis-web.github.io/';
  root.LR_CONFIG = root.LR_CONFIG || { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  var CSS = '#door{position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);opacity:0;pointer-events:none;transition:opacity .6s;font-family:Georgia,serif;cursor:default}' +
    '#door.on{opacity:1;pointer-events:auto}#door .p{min-width:min(560px,80vw);padding:4vh 4vw;border:1px solid rgba(226,184,74,.35);border-radius:3vh;background:rgba(6,5,3,.92)}' +
    '#door h2{margin:0 0 2.4vh;font-weight:400;letter-spacing:.3em;color:#e2b84a;font-size:clamp(14px,2.4vh,28px)}#door ul{list-style:none;margin:0;padding:0}' +
    '#door li{padding:1.5vh 2vw;margin:.6vh 0;border-radius:1.6vh;color:#e9dcc0;font-size:clamp(16px,3.2vh,40px);letter-spacing:.06em;cursor:pointer;border:1px solid transparent}' +
    '#door li.sel{border-color:#e2b84a;background:#2a200c;color:#fff3cc}#door .hint{margin-top:2vh;color:#7d6c48;font-size:clamp(11px,1.7vh,20px);letter-spacing:.12em}' +
    '#door .big{display:flex;flex-direction:column;align-items:center;gap:2vh}#door canvas{background:#cea03e;border-radius:1vh}' +
    '#doorframe{position:fixed;inset:0;z-index:30;width:100%;height:100%;border:0;background:#000;opacity:0;transition:opacity .9s;pointer-events:none}#doorframe.on{opacity:1;pointer-events:auto}' +
    '#doorfade{position:fixed;inset:0;z-index:29;background:#000;opacity:0;transition:opacity .6s;pointer-events:none}#doorfade.on{opacity:1}' +
    '#doorbadge{position:fixed;left:1.4vw;bottom:1.4vh;z-index:31;font:clamp(10px,1.5vh,16px) Georgia,serif;letter-spacing:.2em;color:rgba(226,184,74,.35);pointer-events:none}';
  root.Door = function (o) {
    var q = new URLSearchParams(location.search), local = q.get('local') === '1';
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var ov = document.createElement('div'); ov.id = 'door'; document.body.appendChild(ov);
    var fade = document.createElement('div'); fade.id = 'doorfade'; document.body.appendChild(fade);
    var fr = document.createElement('iframe'); fr.id = 'doorframe'; fr.allow = 'autoplay; fullscreen; gamepad; accelerometer; gyroscope'; document.body.appendChild(fr);
    var badge = document.createElement('div'); badge.id = 'doorbadge'; document.body.appendChild(badge);
    // stack = menu state (shared with the phone); shown = whether the menu is painted on the TV.
    // A paired phone drives the menu on its own screen; the TV stays the logo page until something is launched.
    var stack = [], sel = 0, shown = false, playing = null, net = null, remotes = {}, code = null, lost = null;
    function pairURL(c) { var u = SITE + 'go/?pair=' + c + (local ? '&local=1' : ''); return o.extra ? u + '&' + o.extra : u; }
    function cur() { return stack[stack.length - 1]; }
    function items() { var m = cur(); return m ? m.items : []; }
    function broadcast(m) { for (var k in remotes) try { net.send(remotes[k], m); } catch (e) {} }
    function sync() { broadcast(playing ? { t: 'playing', name: playing.name, since: playing.since, mins: playing.mins || 20, late: !!playing.late, ctrl: playing.ctrl || '', owner: playing.owner || '' } : stack.length ? { t: 'menu', title: cur().title, items: items().map(function (i) { return i.label; }), sel: sel, depth: stack.length } : { t: 'idle' }); }
    function paint() {
      var m = cur(), vis = !!m && (shown || !!m.big); ov.classList.toggle('on', vis);
      if (vis) {
        if (m.big) { ov.innerHTML = '<div class="p big"><h2>' + m.title + '</h2><canvas id="doorqr"></canvas><div class="hint">' + m.big.replace(SITE, '') + '</div><ul><li class="sel">Back</li></ul></div>'; drawBig(m.big); }
        else ov.innerHTML = '<div class="p"><h2>' + m.title + '</h2><ul>' + m.items.map(function (it, i) { return '<li data-i="' + i + '"' + (i === sel ? ' class="sel"' : '') + '>' + it.label + '</li>'; }).join('') + '</ul><div class="hint">ARROWS + ENTER · ESC TO CLOSE</div></div>';
      }
      sync();
    }
    function drawBig(url) { var c = document.getElementById('doorqr'), Q = qrcode(0, 'M'); Q.addData(url); Q.make(); var n = Q.getModuleCount() + 8, m = Math.max(3, Math.floor(innerHeight * 0.42 / n)), x = c.getContext('2d');
      c.width = c.height = n * m; x.fillStyle = '#cea03e'; x.fillRect(0, 0, n * m, n * m); x.fillStyle = '#000'; for (var r = 0; r < n - 8; r++) for (var k = 0; k < n - 8; k++) if (Q.isDark(r, k)) x.fillRect((k + 4) * m, (r + 4) * m, m, m); }
    function menu(onTV) { stack = [{ title: o.title || 'ZERO TO PHI', items: o.items() }]; sel = 0; shown = !!onTV; paint(); }
    // camera moves: paired -> the logo eases ~10% closer; launching -> fly through the 0's hollow; returning -> the reverse
    var flown = false;
    function flyTo(mode) {
      var el = o.flyEl && o.flyEl(); if (!el) return;
      if (o.flyOrigin) el.style.transformOrigin = o.flyOrigin();
      var base = (Object.keys(remotes).length || lost != null) ? 1.1 : 1;
      el.style.willChange = 'transform, opacity';
      el.style.transition = mode === 'in' ? 'transform 1.1s cubic-bezier(.65,0,1,.55), opacity .75s ease-in .35s'
        : mode === 'out' ? 'transform 1.1s cubic-bezier(0,.55,.35,1), opacity .6s ease-out' : 'transform 3.5s cubic-bezier(.45,0,.25,1)';
      el.style.transform = 'scale(' + (mode === 'in' ? 18 : base) + ')'; el.style.opacity = mode === 'in' ? '0' : '1';
    }
    function enter() { flown = true; flyTo('in'); }
    var outUntil = 0;
    function leave() { if (!flown) return; flown = false; flyTo('out'); outUntil = Date.now() + 1150; }
    function close() { if (paired()) { menu(false); return; } stack = []; shown = false; paint(); }
    function back() { if (playing) return stop(); if (stack.length > 1) { var wasBig = !!cur().big; stack.pop(); sel = 0; paint(); if (wasBig) leave(); } else if (shown) close(); }
    var actor = null; // the remote connection that triggered the current action (null = local)
    function act(it) {
      if (!it) return;
      if (it.phoneGo && actor) { net.send(actor, { t: 'go', url: it.phoneGo, release: true }); release(actor); return; }
      if (it.phoneGo && !it.href) return;
      if (it.sub) { stack.push({ title: it.label.toUpperCase(), items: it.sub() }); sel = 0; paint(); }
      else if (it.qr) { stack.push({ title: 'SCAN TO PAIR A PHONE', items: [{ label: 'Back', back: 1 }], big: pairURL(code) }); sel = 0; enter(); setTimeout(paint, 700); }
      else if (it.play) play(it);
      else if (it.phone && !Object.keys(remotes).length) location.href = it.phone;
      else if (it.phone) broadcast({ t: 'open', url: it.phone });
      else if (it.href) location.href = it.href;
      else if (it.back) back();
      else if (it.close) close();
    }
    // a phone leaving for phone-only content gives the screen back at once: no grace, QR breathes for the next person
    // game over (a game posts {ztp:'end'} to its parent): free the screen for the next people
    function endGame() { if (!playing) return; for (var k in remotes) { var c = remotes[k]; try { net.send(c, { t: 'ended', name: playing.name }); } catch (e) {} c.ztpReleased = true; delete remotes[k]; delete seen[k]; } clearGrace(); stop(); stack = []; paint(); update(); }
    window.addEventListener('message', function (e) { if (e.source === fr.contentWindow && e.data && (e.data.ztp === 'end' || e.data.t === 'ztp-end')) endGame(); });
    function release(conn) {
      delete remotes[conn.connectionId]; delete seen[conn.connectionId]; conn.ztpReleased = true;
      setTimeout(function () { try { conn.close(); } catch (e) {} }, 400);
      if (!Object.keys(remotes).length) { clearGrace(); if (playing) stop(); leave(); stack = []; shown = false; paint(); }
      update();
    }
    function nav(d, from) {
      if (playing) { if (d === 'back' && (!from || !playing.owner || from === playing.owner)) stop(); return; }
      if (!stack.length) { menu(!from); return; }
      var n = cur().big ? 1 : items().length;
      if (d === 'up') sel = (sel + n - 1) % n; else if (d === 'down') sel = (sel + 1) % n;
      else if (d === 'select') return cur().big ? back() : act(items()[sel]); else if (d === 'back') return back();
      paint();
    }
    // fade the TV into a game in-page; the game shows its own join QR for everyone else
    function play(it) {
      it.since = Date.now(); it.owner = it.owner || ''; playing = it; shown = false; stack = []; ov.classList.remove('on'); enter(); setTimeout(function () { if (playing === it) fade.classList.add('on'); }, 450);
      setTimeout(function () { if (playing !== it) return; fr.onload = function () { if (playing !== it) return; fr.classList.add('on'); fade.classList.remove('on'); }; fr.src = it.play; }, 750);
      if (o.onPlay) o.onPlay(true); update(); sync();
    }
    function stop() { fr.onload = null; fade.classList.remove('on'); fr.classList.remove('on'); setTimeout(function () { if (!playing) fr.removeAttribute('src'); }, 900); playing = null; if (o.onPlay) o.onPlay(false); leave(); update(); menu(false); }
    ov.addEventListener('click', function (e) { var li = e.target.closest('li'); if (!li) return; if (cur().big) return back(); sel = +li.dataset.i; act(items()[sel]); e.stopPropagation(); });
    addEventListener('keydown', function (e) {
      var k = e.key, vis = ov.classList.contains('on');
      if (k === 'Escape' || k === 'Backspace') { if (vis || playing) { back(); e.preventDefault(); } return; }
      if (!vis) { if (k === 'Enter' || k === ' ') { if (stack.length) { shown = true; paint(); } else menu(true); } return; }
      if (k === 'ArrowUp') nav('up'); else if (k === 'ArrowDown') nav('down'); else if (k === 'Enter' || k === ' ') nav('select'); else return; e.preventDefault();
    });
    // remote lost: silently wait 10 s, step back one layer, wait 5 s more, then the top logo page with the QR breathing
    function clearGrace() { clearTimeout(lost); lost = null; }
    function startGrace() {
      clearGrace();
      lost = setTimeout(function () {
        if (playing) stop(); else if (stack.length > 1) { var wb = !!cur().big; stack.pop(); sel = 0; paint(); if (wb) leave(); } else if (shown) { shown = false; paint(); }
        lost = setTimeout(function () { lost = null; if (playing) stop(); leave(); stack = []; shown = false; paint(); update(); }, 5000);
      }, 10000);
    }
    function paired() { return Object.keys(remotes).length > 0 || lost != null; }
    function update() { if (o.onPaired) o.onPaired(paired()); if (!flown && Date.now() > outUntil) flyTo('base'); badge.textContent = Object.keys(remotes).length ? 'PAIRED' : ''; }
    // phones ping every 4 s; a phone that went quiet (screen off, wifi gone) without closing counts as lost after 9 s
    var seen = {};
    setInterval(function () { var now = Date.now(); for (var k in remotes) if (now - (seen[k] || now) > 9000) { var c = remotes[k]; try { c.close(); } catch (e) {} opts.onClose(c); } }, 1500);
    function who(conn) { return conn.ztpId || conn.connectionId; }
    var opts = { prefix: 'ztp-door-v1-', onStatus: function (s, c) { if (c && c !== code) { code = c; if (o.onCode) o.onCode(pairURL(c), c); } },
      onJoin: function (conn) { remotes[conn.connectionId] = conn; seen[conn.connectionId] = Date.now(); clearGrace(); net.send(conn, { t: 'hello', screen: o.name || 'Zero to Phi' }); update(); if (!stack.length && !playing) menu(false); else sync(); },
      onMessage: function (conn, d) { if (!remotes[conn.connectionId]) opts.onJoin(conn); seen[conn.connectionId] = Date.now(); if (!d || d.t === 'ping') return net.send(conn, { t: 'pong' });
        if (d.t === 'hi') { if (d.id) conn.ztpId = d.id; sync(); }
        else if (d.t === 'nav') { actor = conn; nav(d.d, who(conn)); actor = null; }
        else if (d.t === 'release') release(conn);
        else if (d.t === 'launch') { var g = o.find && o.find(d.game); if (!g) return; if (Object.keys(remotes).some(function (k) { return remotes[k] !== conn; }) || playing) return net.send(conn, { t: 'busy' }); g.owner = who(conn); play(g); }
        else if (d.t === 'screen') { if (d.logo && d.id) try { localStorage.setItem('ztp-biz-logo-' + d.id, d.logo); } catch (e) {} play({ name: d.name || 'Caf\u00e9 screen', play: d.url, mins: 60, owner: who(conn) }); }
        else if (d.t === 'qrpage') { if (playing) return; if (!stack.length) menu(false); act({ qr: 1 }); }
        else if (d.t === 'pick') { if (playing) return; if (!stack.length) menu(false); sel = d.i; var it = items()[d.i]; if (it && it.play) it.owner = who(conn); actor = conn; act(it); actor = null; } },
      onClose: function (conn) { if (conn.ztpReleased || !remotes[conn.connectionId]) return; delete remotes[conn.connectionId]; delete seen[conn.connectionId]; if (playing && playing.owner && playing.owner === who(conn)) { var ks = Object.keys(remotes); playing.owner = ks.length ? who(remotes[ks[0]]) : ''; sync(); } if (!Object.keys(remotes).length) startGrace(); update(); } };
    if (!o.noPair) { net = local ? new LRNet.LocalHost(opts) : new LRNet.Host(opts); code = net.code; if (o.onCode) o.onCode(pairURL(code), code); }
    var api = { menu: function () { menu(true); }, close: close, isOpen: function () { return ov.classList.contains('on') || !!playing; }, code: function () { return code; }, pairURL: function () { return pairURL(code); },
      state: function () { return { menu: stack.length, shown: ov.classList.contains('on'), playing: playing && playing.name, paired: paired(), grace: lost != null }; } };
    root.__door = api; return api;
  };
})(window);
