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
    // per-phone view of the screen: members of the running game get their controller, everyone else the busy screen + queue
    function sync() { for (var k in remotes) try { net.send(remotes[k], view(remotes[k])); } catch (e) {} paintCQ(); }
    function waitFor(i) { var w = playing && !playing.home ? Math.max(1, Math.round((playing.mins || 20) - (Date.now() - playing.since) / 60000)) : 0; for (var j = 0; j < i; j++) w += queue[j].mins || 20; return w; }
    function view(conn) { var v = view0(), id = who(conn); if (v.t !== 'playing') return v;
      var mi = playing.members.indexOf(id); v.member = mi >= 0; v.joinable = !!playing.p1ctrl && mi < 0; v.host = playing.owner === id || !connOf(playing.owner);
      if (v.member && v.p1) v.p1 = v.p1.replace('name=Player%201', 'name=Player%20' + (mi + 1));
      if (!v.member) v.p1 = ''; v.started = !!playing.started; v.games = o.games ? o.games() : [];
      for (var q = 0; q < queue.length; q++) if (queue[q].owner === id) { v.q = { pos: q + 1, wait: waitFor(q), name: queue[q].name }; break; }
      return v; }
    function view0() { return (busy() ? { t: 'playing', p1wait: !!(playing.p1ctrl && !playing.p1url), room: playing.room || '', name: playing.name, since: playing.since, mins: playing.mins || 20, late: !!playing.late, ctrl: playing.ctrl || '', owner: playing.owner || '', p1: playing.p1url || '' } : stack.length ? { t: 'menu', title: cur().title, items: items().map(function (i) { return i.label; }), sel: sel, depth: stack.length } : { t: 'idle' }); }
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
    function menu(onTV) { var its = o.items(); if (home) its = its.slice(0, -1).concat([{ label: 'Stop caf\u00e9 screen', unhome: 1 }], its.slice(-1)); stack = [{ title: o.title || 'ZERO TO PHI', items: its }]; sel = 0; shown = !!onTV; paint(); }
    // camera moves: paired -> the logo eases ~10% closer; launching -> fly through the 0's hollow; returning -> the reverse
    var flown = false, spun = false, LOCALQ = /[?&]local=1/.test(location.search);
    // heartbeat: once paired and eased in, the logo beats gently (the CSS 'scale' property composes with the fly transform)
    (function () { var st = document.createElement('style'); st.textContent = '@keyframes ztpBeat{0%{scale:1}7%{scale:1.024}14%{scale:1}22%{scale:1.016}32%,100%{scale:1}}.ztp-beat{animation:ztpBeat 7.2s ease-in-out infinite}' +
      '#ztpHole{position:fixed;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:radial-gradient(circle,#000 55%,rgba(0,0,0,.85) 70%,rgba(0,0,0,0) 100%);pointer-events:none;z-index:4;transform:scale(0);opacity:0}'; document.head.appendChild(st); })();
    var beatT = null;
    function beat(on) { var el = o.flyEl && o.flyEl(); if (!el) return; clearTimeout(beatT); if (!on) { el.classList.remove('ztp-beat'); return; } if (!el.classList.contains('ztp-beat')) beatT = setTimeout(function () { el.classList.add('ztp-beat'); }, 3600); }
    // the corkscrew: a full turn while diving into the Phi, whose vertical split opens into a black hole
    function hole(mode, el) { var h = document.getElementById('ztpHole'); if (!h) { h = document.createElement('div'); h.id = 'ztpHole'; document.body.appendChild(h); }
      var r = el.getBoundingClientRect(), org = (o.spinOrigin && o.spinOrigin()) || '50% 50%', p = org.split(' ');
      if (mode === 'in') { h.style.left = (r.left + parseFloat(p[0]) * (p[0].indexOf('%') > 0 ? r.width / 100 : 1)) + 'px'; h.style.top = (r.top + parseFloat(p[1]) * (p[1].indexOf('%') > 0 ? r.height / 100 : 1)) + 'px'; }
      h.style.transition = mode === 'in' ? 'transform 1.5s cubic-bezier(.7,0,.9,.6) .2s, opacity .4s ease .2s' : 'transform 1.2s cubic-bezier(.1,.4,.3,1), opacity .5s ease .8s';
      h.style.transform = mode === 'in' ? 'scale(120)' : 'scale(0)'; h.style.opacity = mode === 'in' ? '1' : '0'; }
    function flyTo(mode) {
      var el = o.flyEl && o.flyEl(); if (!el) return;
      if (mode !== 'base') beat(false);
      if (spun && o.spinOrigin) el.style.transformOrigin = o.spinOrigin(); else if (o.flyOrigin) el.style.transformOrigin = o.flyOrigin();
      if (spun && mode !== 'base') {
        el.style.willChange = 'transform, opacity';
        el.style.transition = mode === 'in' ? 'transform 1.7s cubic-bezier(.55,0,.95,.5), opacity .6s ease-in 1.1s' : 'transform 1.5s cubic-bezier(.05,.5,.45,1), opacity .5s ease-out';
        el.style.transform = mode === 'in' ? 'rotate(360deg) scale(30)' : 'rotate(0deg) scale(' + ((Object.keys(remotes).length || lost != null) ? 1.1 : 1) + ')'; el.style.opacity = mode === 'in' ? '0' : '1';
        hole(mode, el); if (mode === 'out') setTimeout(function () { if (!flown) { spun = false; if (paired()) beat(true); } }, 1600); return;
      }
      var base = (Object.keys(remotes).length || lost != null) ? 1.1 : 1;
      el.style.willChange = 'transform, opacity';
      el.style.transition = mode === 'in' ? 'transform 1.1s cubic-bezier(.65,0,1,.55), opacity .75s ease-in .35s'
        : mode === 'out' ? 'transform 1.1s cubic-bezier(0,.55,.35,1), opacity .6s ease-out' : 'transform 3.5s cubic-bezier(.45,0,.25,1)';
      el.style.transform = 'rotate(0deg) scale(' + (mode === 'in' ? 18 : base) + ')'; el.style.opacity = mode === 'in' ? '0' : '1';
      if (mode === 'base') beat(base > 1); else if (mode === 'out' && base > 1) setTimeout(function () { if (!flown && paired()) beat(true); }, 1200);
    }
    function enter(spin) { flown = true; spun = !!(spin && o.spinOrigin); flyTo('in'); }
    var outUntil = 0, p1Watch = null, home = null, queue = [];
    function leave() { if (!flown) return; flown = false; flyTo('out'); outUntil = Date.now() + (spun ? 1600 : 1150); }
    function close() { if (paired()) { menu(false); return; } stack = []; shown = false; paint(); }
    function back() { if (busy()) return stop(); if (stack.length > 1) { var wasBig = !!cur().big; stack.pop(); sel = 0; paint(); if (wasBig) leave(); } else if (shown) close(); }
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
      else if (it.unhome) { unHome(); menu(false); }
    }
    // a phone leaving for phone-only content gives the screen back at once: no grace, QR breathes for the next person
    // game over (a game posts {ztp:'end'} to its parent): free the screen for the next people
    function endGame() { if (!busy()) return; for (var k in remotes) { var c = remotes[k]; if (queued(who(c))) continue; try { net.send(c, { t: 'ended', name: playing.name }); } catch (e) {} c.ztpReleased = true; delete remotes[k]; delete seen[k]; } clearGrace(); stop(); stack = []; paint(); update(); }
    window.addEventListener('message', function (e) {
      if (e.source !== fr.contentWindow || !e.data) return; var d = e.data;
      if (d.ztp === 'end' || d.t === 'ztp-end') return endGame();
      if (d.ztp === 'started' && busy()) { playing.started = true; return sync(); }
      if (d.ztp === 'room' && playing && !playing.home) { var it = playing, was = it.p1url, ws = it.started; it.roomStatus = d.status; if (d.phase && !/^(lobby|title|setup|join)$/.test(d.phase)) it.started = true; it.n = d.n || 0; if (it.n > 0) it.hadN = true;
        if (d.status === 'online' && d.code && it.p1ctrl && (!it.p1url || it.room !== d.code)) { it.room = d.code; it.p1url = it.p1ctrl + '?room=' + d.code + '&name=Player%201&auto=1' + (LOCALQ ? '&local=1' : ''); }
        if (it.p1url !== was || it.started !== ws) sync();
        // nobody left anywhere (no remote, no players in the game): the screen frees itself
        // (never end a game because connections dropped: a wifi blip drops everyone at once. Only {ztp:'end'} or the host's End game do.)
        if ((d.off || 0) !== (it.off || 0)) { it.off = d.off || 0; paintCQ(); }
      } });
    function toOwner(m) { for (var k in remotes) if (playing && who(remotes[k]) === playing.owner) try { net.send(remotes[k], m); } catch (e) {} }
    function busy() { return !!playing && !playing.home; }
    function release(conn) {
      delete remotes[conn.connectionId]; delete seen[conn.connectionId]; conn.ztpReleased = true;
      setTimeout(function () { try { conn.close(); } catch (e) {} }, 400);
      if (busy() && playing.owner === who(conn)) passHost(who(conn));
      if (!Object.keys(remotes).length) { clearGrace(); if (busy() && !playing.started) stop(); if (!busy()) leave(); stack = []; shown = false; paint(); }
      update();
    }
    function nav(d, from) {
      if (busy()) { if (d !== 'back') return;
        if (playing.started && from && actor) return stepOut(actor);
        if (!from || !playing.owner || from === playing.owner || !connOf(playing.owner)) stop(); return; }
      if (!stack.length) { menu(!from); return; }
      var n = cur().big ? 1 : items().length;
      if (d === 'up') sel = (sel + n - 1) % n; else if (d === 'down') sel = (sel + 1) % n;
      else if (d === 'select') return cur().big ? back() : act(items()[sel]); else if (d === 'back') return back();
      paint();
    }
    // fade the TV into a game in-page; the game shows its own join QR for everyone else
    function play(it) {
      it.since = Date.now(); it.owner = it.owner || ''; playing = it; shown = false; stack = []; ov.classList.remove('on'); enter(it.spin);
      setTimeout(function () { if (playing === it) fade.classList.add('on'); }, 450);
      var src = it.play; it.p1url = ''; it.n = 0; it.members = it.owner ? [it.owner] : []; it.started = false; it.hadN = false; it.room = null; it.roomStatus = '';
      // the launching phone becomes player 1: the game opens a room with this code, and the phone gets the controller URL
      // only once the game reports that its room is actually registered (the code it ended up with, which can differ)
      if (it.p1ctrl) { var room = ''; for (var q = 0; q < 4; q++) room += 'ABCDEFGHJKLMNPQRSTUVWXYZ'.charAt(Math.floor(Math.random() * 24)); src += (src.indexOf('?') < 0 ? '?' : '&') + 'room=' + room + (LOCALQ ? '&local=1' : ''); it.room = room;
        clearTimeout(p1Watch); p1Watch = setTimeout(function () { if (playing === it && !it.p1url) toOwner({ t: 'dbg', text: 'The TV game has not opened its room yet (' + (it.roomStatus || 'loading') + '). Still trying\u2026' }); }, 12000); }
      setTimeout(function () { if (playing !== it) return; fr.onload = function () { if (playing !== it) return; fr.classList.add('on'); fade.classList.remove('on'); }; fr.src = src; }, 750);
      if (o.onPlay) o.onPlay(true); update(); sync();
    }
    function stop() { var wasHome = playing && playing.home; clearTimeout(p1Watch); fr.onload = null; fade.classList.remove('on'); fr.classList.remove('on'); setTimeout(function () { if (!playing) fr.removeAttribute('src'); }, 900); playing = null; if (o.onPlay) o.onPlay(false); leave(); update(); if (paired()) menu(false); else { stack = []; shown = false; paint(); }
      if (queue.length && !wasHome) setTimeout(launchNext, 1400);
      else if (home && !wasHome) setTimeout(function () { if (!playing && home) { play(home); if (paired()) menu(false); } }, 1300); }
    function queued(id) { return queue.some(function (q) { return q.owner === id; }); }
    function connOf(id) { for (var k in remotes) if (who(remotes[k]) === id) return remotes[k]; return null; }
    // the next queued game takes the screen (its phone becomes player 1); queued phones that have gone are skipped
    function launchNext() { if (busy()) return; while (queue.length) { var q = queue.shift(), g = o.find && o.find(q.game); if (g && connOf(q.owner)) { g.owner = q.owner; play(g); return; } } if (home && !playing) { play(home); if (paired()) menu(false); } sync(); }
    function passHost(id) { var p = playing; if (!p || p.owner !== id) return; var nx = p.members.filter(function (m) { return m !== id && connOf(m); })[0];
      if (!nx) for (var k in remotes) if (who(remotes[k]) !== id) { nx = who(remotes[k]); break; } p.owner = nx || ''; }
    // a player stepping out mid-game: their phone lets go of the screen, the game keeps their seat, and the TV shows a small
    // QR so they (or anyone) can scan back in; the same phone id lands them back on their own seat
    function stepOut(conn) { var id = who(conn); try { net.send(conn, { t: 'steppedout', name: playing.name }); } catch (e) {}
      passHost(id); delete remotes[conn.connectionId]; delete seen[conn.connectionId]; conn.ztpReleased = true; setTimeout(function () { try { conn.close(); } catch (e) {} }, 400);
      update(); sync(); }
    var cq = null;
    function paintCQ() { var want = busy() && !playing.home && (playing.off > 0 || playing.members.some(function (m) { return !connOf(m); }) || !!playing.p1ctrl) && code && !inFrame;
      if (!cq) { cq = document.createElement('div'); cq.id = 'doorcq'; cq.style.cssText = 'position:fixed;right:1.6vw;bottom:2vh;z-index:32;display:none;flex-direction:column;align-items:center;gap:.6vh;padding:1vh;border-radius:1.2vh;background:rgba(0,0,0,.72);border:1px solid rgba(226,184,74,.4);font:clamp(10px,1.5vh,16px) Georgia,serif;letter-spacing:.12em;color:#e2b84a;pointer-events:none'; document.body.appendChild(cq); }
      if (!want) { cq.style.display = 'none'; return; }
      if (cq.dataset.c !== code) { cq.dataset.c = code; var Q = qrcode(0, 'M'); Q.addData(pairURL(code)); Q.make(); var n = Q.getModuleCount() + 4, m = Math.max(2, Math.floor(innerHeight * 0.17 / n)), c = document.createElement('canvas'), x = c.getContext('2d');
        c.width = c.height = n * m; x.fillStyle = '#cea03e'; x.fillRect(0, 0, n * m, n * m); x.fillStyle = '#000'; for (var i = 0; i < n - 4; i++) for (var j = 0; j < n - 4; j++) if (Q.isDark(i, j)) x.fillRect((j + 2) * m, (i + 2) * m, m, m);
        cq.innerHTML = ''; cq.appendChild(c); var t = document.createElement('div'); t.textContent = 'BACK IN? SCAN'; cq.appendChild(t); }
      cq.style.display = 'flex'; }   // a café's TV goes back to its configured screen
    // café screen launched from a phone becomes this TV's home (kept across reloads) until someone stops it from the menu
    function setHome(h) { home = h; try { localStorage.setItem('ztp-home', JSON.stringify(h)); } catch (e) {} play(h); if (paired()) menu(false); }
    function unHome() { home = null; try { localStorage.removeItem('ztp-home'); } catch (e) {} if (playing) stop(); }
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
        if (busy()) { if (!playing.started) stop(); } else if (stack.length > 1) { var wb = !!cur().big; stack.pop(); sel = 0; paint(); if (wb) leave(); } else if (shown) { shown = false; paint(); }
        lost = setTimeout(function () { lost = null; if (busy() && !playing.started) stop(); if (!busy()) leave(); stack = []; shown = false; paint(); update(); }, 10000);
      }, 25000);
    }
    var inFrame = false; try { inFrame = window.parent !== window; } catch (e) { inFrame = true; }   // shown inside the TV door (e.g. a branded caf\u00e9 screen): the outer page owns the pairing badge
    function paired() { return Object.keys(remotes).length > 0 || lost != null; }
    function update() { if (o.onPaired) o.onPaired(paired()); if (!flown && Date.now() > outUntil) flyTo('base'); badge.textContent = Object.keys(remotes).length && !inFrame && !playing ? 'PAIRED' : ''; }
    // phones ping every 4 s; a phone that went quiet (screen off, wifi gone) without closing counts as lost after 9 s
    var seen = {};
    setInterval(function () { var now = Date.now(); for (var k in remotes) if (now - (seen[k] || now) > 20000) { var c = remotes[k]; try { c.close(); } catch (e) {} opts.onClose(c); } }, 1500);
    function who(conn) { return conn.ztpId || conn.connectionId; }
    var opts = { prefix: 'ztp-door-v1-', onStatus: function (s, c) { if (c && c !== code) { code = c; if (o.onCode) o.onCode(pairURL(c), c); } },
      onJoin: function (conn) { remotes[conn.connectionId] = conn; seen[conn.connectionId] = Date.now(); clearGrace(); net.send(conn, { t: 'hello', screen: o.name || 'Zero to Phi' }); update(); if (!stack.length && !playing) menu(false); else if (!busy()) sync(); },
      onMessage: function (conn, d) { if (!remotes[conn.connectionId]) opts.onJoin(conn); seen[conn.connectionId] = Date.now(); if (!d || d.t === 'ping') return net.send(conn, { t: 'pong' });
        if (d.t === 'hi') { if (d.id) conn.ztpId = d.id; sync(); }
        else if (d.t === 'join') { if (busy() && playing.p1ctrl && playing.members.indexOf(who(conn)) < 0) playing.members.push(who(conn)); sync(); }
        else if (d.t === 'endgame') { if (busy() && (who(conn) === playing.owner || !connOf(playing.owner))) endGame(); }
        else if (d.t === 'queue') { var qg = o.find && o.find(d.game); if (!qg) return; queue = queue.filter(function (q) { return q.owner !== who(conn); }); queue.push({ owner: who(conn), game: d.game, name: qg.name, mins: qg.mins || 20 }); if (!busy()) launchNext(); else sync(); }
        else if (d.t === 'unqueue') { queue = queue.filter(function (q) { return q.owner !== who(conn); }); sync(); }
        else if (d.t === 'nav') { actor = conn; nav(d.d, who(conn)); actor = null; }
        else if (d.t === 'release') release(conn);
        else if (d.t === 'launch') { var g = o.find && o.find(d.game); if (!g) return; if (Object.keys(remotes).some(function (k) { return remotes[k] !== conn; }) || busy()) return net.send(conn, { t: 'busy' }); g.owner = who(conn); play(g); }
        else if (d.t === 'screen') { if (d.logo && d.id) try { localStorage.setItem('ztp-biz-logo-' + d.id, d.logo); } catch (e) {} setHome({ name: d.name || 'Caf\u00e9 screen', play: d.url, mins: 60, home: true }); }
        else if (d.t === 'qrpage') { if (busy()) return; if (!stack.length) menu(false); act({ qr: 1 }); }
        else if (d.t === 'pick') { if (busy()) return; if (!stack.length) menu(false); sel = d.i; var it = items()[d.i]; if (it && it.play) it.owner = who(conn); actor = conn; act(it); actor = null; } },
      onClose: function (conn) { if (conn.ztpReleased || !remotes[conn.connectionId]) return; delete remotes[conn.connectionId]; delete seen[conn.connectionId]; if (playing && playing.owner && playing.owner === who(conn)) { var pw = playing, oid = who(conn); setTimeout(function () { if (playing === pw && pw.owner === oid && !connOf(oid)) { passHost(oid); sync(); } }, 25000); } if (!Object.keys(remotes).length) startGrace(); update(); } };
    if (!o.noPair) { net = local ? new LRNet.LocalHost(opts) : new LRNet.Host(opts); code = net.code; if (o.onCode) o.onCode(pairURL(code), code); }
    var api = { menu: function () { menu(true); }, close: close, isOpen: function () { return ov.classList.contains('on') || !!playing; }, code: function () { return code; }, pairURL: function () { return pairURL(code); },
      state: function () { return { menu: stack.length, shown: ov.classList.contains('on'), playing: playing && playing.name, paired: paired(), grace: lost != null, home: home && home.name, room: playing && playing.room, p1: playing && playing.p1url || '' }; } };
    if (o.homes && !inFrame) try { var hh = JSON.parse(localStorage.getItem('ztp-home') || 'null'); if (hh && hh.play) { home = hh; setTimeout(function () { if (!playing) play(hh); }, 900); } } catch (e) {}
    root.__door = api; return api;
  };
})(window);
