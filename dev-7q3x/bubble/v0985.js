/* v0.9.85: one combined setup screen.
   Landscape/TV: the v0.9.84 drifting card row (captions ~25% larger) plus a
   bottom row of small gold pills that open panels instead of a big form.
   Portrait: one card at a time fills the top ~2/3 (slip in, hover ~8 s, zip
   out); swipe left/right snaps to the next card and restarts auto-advance;
   menu lives in the bottom third.
   ?tutcards=0 leaves the original join card alone.
*/
(function (root) {
  'use strict';
  if (/[?&]tutcards=0(?:&|$)/.test(location.search || '')) return;

  var CARDS = (root.ZTP984 && ZTP984.cards) || [
    { id: 'bodycheck', cap: 'Slide while holding to body check' },
    { id: 'pokecheck', cap: 'Tap to poke check' },
    { id: 'slapshot', cap: 'Taps always shoot, one-timers to the center are automatic' },
    { id: 'glove', cap: 'Take control of your goaltender for nuanced saves, or trust your goalie' }
  ];

  var HOLD = 8000, state = {
    mode: null, i: 0, t0: 0, timer: 0, drift: 0,
    drag: null, rowW: 0, alive: false
  };

  function isPortrait() {
    return innerHeight > innerWidth * 1.05;
  }
  function isPad() {
    return /pad/i.test(location.pathname || '');
  }

  function css() {
    if (document.getElementById('ztp985css')) return;
    var s = document.createElement('style'); s.id = 'ztp985css';
    s.textContent =
      'body.ztp-setup #ztpTut{display:none!important}' +
      'body.ztp-setup #bhMusic{visibility:hidden!important}body.ztp-setup #watchBtn,body.ztp-setup #big,body.ztp-setup #tip,' +
      'body.ztp-setup #ztppb,body.ztp-setup #ztppop{display:none!important}body.ztp-setup .playbar,body.ztp-setup [data-here],body.ztp-setup #invite,' +
      'body.ztp-setup .invite,body.ztp-setup #ztpPlaybar{visibility:hidden!important}' +
      /* hide the stock full-screen join form; it is restyled as a panel when open */
      'body.ztp-setup #kjoin{display:none!important}' +
      'body.ztp-setup #kjoin.ztp-join-panel{display:flex!important;inset:auto;left:50%;' +
      'bottom:calc(70px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(420px,94vw);' +
      'height:auto;max-height:46vh;background:#080705;border:1px solid rgba(226,184,74,.45);' +
      'border-radius:14px;padding:14px 16px 16px;z-index:12020;align-items:flex-end;justify-content:center;' +
      'box-shadow:0 16px 50px #000}' +
      'body.ztp-setup #kjoin.ztp-join-panel>div{max-width:100%;width:100%;background:#080705;position:relative;z-index:1}' +
      'body.ztp-setup #kjoin.ztp-join-panel h1{font-size:22px;margin:0 0 8px;text-shadow:none;letter-spacing:.12em}' +
      'body.ztp-setup #kjoin.ztp-join-panel #vsai,' +
      'body.ztp-setup #kjoin.ztp-join-panel #host2,' +
      'body.ztp-setup #kjoin.ztp-join-panel p,body.ztp-setup #kjoin .htLink,body.ztp-setup #htBtn{display:none!important}' +
      'body.ztp-setup #kjoin.ztp-join-panel .btn{margin-top:8px}' +
      '#ztpSetup{position:fixed;inset:0;z-index:12000;display:flex;flex-direction:column;' +
      'background:#030304;color:#e8cf86;font-family:Georgia,"Times New Roman",serif}' +
      '#ztpSetup .ztp-stage{position:relative;flex:1 1 auto;min-height:0;overflow:hidden}' +
      '#ztpSetup .ztp-row{position:absolute;left:0;top:50%;display:flex;gap:36px;align-items:center;will-change:transform}' +
      '#ztpSetup .ztp-tcard{flex:0 0 auto;background:#080705;border:1px solid rgba(226,184,74,.4);' +
      'box-shadow:0 14px 40px #000,0 0 24px rgba(226,184,74,.08);padding:12px 12px 16px;border-radius:4px}' +
      '#ztpSetup .ztp-tcard canvas,#ztpSetup .ztp-tcard img{display:block;width:100%;height:auto;background:#030304}' +
      '#ztpSetup .ztp-tcard p{margin:.75em .35em 0;font:400 17px/1.35 Georgia,serif;letter-spacing:.03em;' +
      'color:#f3dc95;text-align:center}' +
      /* landscape: row of moderately wide cards */
      '#ztpSetup.land .ztp-tcard{width:min(42vw,340px)}' +
      '#ztpSetup.land .ztp-stage{flex:1 1 auto}' +
      '#ztpSetup.land .ztp-dock{flex:0 0 auto}' +
      /* portrait: one card fills the top 2/3 */
      '#ztpSetup.port{flex-direction:column}' +
      '#ztpSetup.port .ztp-stage{flex:1 1 auto;min-height:0;display:flex;align-items:stretch;justify-content:center;padding:10px 8px 0}' +
      '#ztpSetup.port #ztpSoloWrap{width:100%;height:100%;display:flex;align-items:stretch;justify-content:center}' +
      '#ztpSetup.port .ztp-solo{width:min(94vw,560px);height:100%;max-height:100%;display:flex;flex-direction:column;box-sizing:border-box;' +
      'transition:transform .38s cubic-bezier(.22,.7,.3,1),opacity .32s}' +
      '#ztpSetup.port .ztp-solo canvas,#ztpSetup.port .ztp-solo img{flex:1 1 auto;width:100%;min-height:0;height:auto;object-fit:contain}' +
      '#ztpSetup.port .ztp-solo p{flex:0 0 auto;font-size:clamp(17px,2.8vh,24px);line-height:1.35}' +
      '#ztpSetup.port .ztp-dock{flex:0 0 auto;max-height:33vh;display:flex;flex-direction:column;' +
      'justify-content:flex-end;padding:8px 10px calc(10px + env(safe-area-inset-bottom))}' +
      '#ztpSetup .ztp-dock h2{margin:0 0 10px;font:400 clamp(14px,2.6vh,22px)/1 Georgia,serif;' +
      'letter-spacing:.32em;color:#e2b84a;text-align:center;text-transform:uppercase}' +
      '#ztpSetup .ztp-pills{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:8px}' +
      '#ztpSetup .ztp-pills button{font:11px/1 Georgia,serif;letter-spacing:.12em;text-transform:lowercase;' +
      'color:#e2b84a;background:transparent;border:1px solid rgba(226,184,74,.45);border-radius:999px;' +
      'padding:.62em 1em;cursor:pointer}' +
      '#ztpSetup .ztp-pills button:hover,#ztpSetup .ztp-pills button:focus-visible,' +
      '#ztpSetup .ztp-pills button.on{border-color:#fbe7a1;color:#fff3cc;outline:none}' +
      '#ztpSetup.land .ztp-dock{padding:8px 12px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(180deg,transparent,#030304 28%)}' +
      '#ztpSetup .ztp-sheet{display:none;position:absolute;left:50%;bottom:calc(70px + env(safe-area-inset-bottom));' +
      'transform:translateX(-50%);width:min(420px,94vw);background:#080705;border:1px solid rgba(226,184,74,.45);' +
      'border-radius:14px;padding:14px 16px;z-index:12020;color:#e8d7a4;font:16px/1.45 Georgia,serif;' +
      'box-shadow:0 16px 50px #000}' +
      '#ztpSetup .ztp-sheet.on{display:block}' +
      '#ztpSetup .ztp-sheet p{margin:0}' +
      '#ztpSetup .ztp-sheet .x{float:right;background:none;border:0;color:#e2b84a;cursor:pointer;font:16px/1 Georgia,serif}';
    document.head.appendChild(s);
  }

  function drawArt(cv, i, port) {
    var w = cv.width = port ? 720 : 640, h = cv.height = port ? 980 : 400, x = cv.getContext('2d');
    x.fillStyle = '#050403'; x.fillRect(0, 0, w, h);
    x.save();
    x.translate(w * 0.5, h * (port ? 0.62 : 0.78));
    x.scale(1, port ? 0.36 : 0.28);
    var g = x.createRadialGradient(0, 0, 10, 0, 0, port ? 280 : 220);
    g.addColorStop(0, 'rgba(226,184,74,0.18)');
    g.addColorStop(0.5, 'rgba(200,160,80,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, port ? 280 : 220, 0, 7); x.fill();
    x.strokeStyle = 'rgba(226,184,74,0.28)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, port ? 230 : 180, 0, 7); x.stroke();
    x.restore();
    function figure(cx, cy, sc, pose, gold) {
      x.save(); x.translate(cx, cy); x.scale(sc, sc);
      x.strokeStyle = gold ? '#e2b84a' : '#c08a22';
      x.fillStyle = gold ? '#1a150c' : '#0c0a06';
      x.lineWidth = 4; x.lineJoin = 'round'; x.lineCap = 'round';
      x.beginPath(); x.ellipse(0, -20, 16, 28, 0, 0, 7); x.fill(); x.stroke();
      x.beginPath(); x.arc(0, -56, 12, 0, 7); x.fill(); x.stroke();
      if (pose === 'check') {
        x.beginPath(); x.moveTo(-8, -8); x.lineTo(-36, 8); x.lineTo(-20, 30); x.stroke();
        x.beginPath(); x.moveTo(8, -6); x.lineTo(34, -28); x.lineTo(44, 6); x.stroke();
        x.beginPath(); x.moveTo(0, -20); x.lineTo(18, -70); x.stroke();
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
      } else if (pose === 'slap') {
        x.beginPath(); x.moveTo(-30, 10); x.lineTo(50, -50); x.lineWidth = 5; x.stroke();
        x.beginPath(); x.arc(54, -56, 5, 0, 7); x.fillStyle = '#fbe7a1'; x.fill();
      } else if (pose === 'goalie') {
        x.beginPath(); x.ellipse(0, 6, 28, 16, 0, 0, 7); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(20, -20); x.lineTo(48, -8); x.lineWidth = 6; x.stroke();
      } else {
        x.beginPath(); x.moveTo(-12, 8); x.lineTo(-8, 40); x.moveTo(12, 8); x.lineTo(10, 40); x.stroke();
      }
      x.restore();
    }
    var sc = port ? 1.65 : 1, cy = port ? 0.48 : 0.52;
    if (i === 0) { figure(w * 0.36, h * cy, 1.15 * sc, 'check', 1); figure(w * 0.68, h * (cy + 0.05), 1.05 * sc, 'fall', 0); }
    else if (i === 1) { figure(w * 0.34, h * (cy + 0.02), 1.15 * sc, 'poke', 1); figure(w * 0.68, h * (cy + 0.04), 1.0 * sc, 'stumble', 0); x.fillStyle = '#fbe7a1'; x.beginPath(); x.arc(w * 0.78, h * (port ? 0.64 : 0.72), (port ? 9 : 6), 0, 7); x.fill(); }
    else if (i === 2) { figure(w * 0.46, h * cy, 1.2 * sc, 'slap', 1); x.strokeStyle = 'rgba(226,184,74,.35)'; x.strokeRect(w * 0.72, h * (port ? 0.18 : 0.22), port ? 90 : 70, port ? 130 : 90); }
    else { figure(w * 0.42, h * (cy + 0.04), 1.15 * sc, 'goalie', 1); x.fillStyle = '#c08a22'; x.fillRect(w * 0.28, h * (port ? 0.70 : 0.84), port ? 230 : 180, port ? 12 : 8); x.fillStyle = '#fbe7a1'; x.beginPath(); x.arc(w * 0.64, h * (port ? 0.70 : 0.84) + (port ? 6 : 4), port ? 14 : 11, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(251,231,161,0.15)'; x.strokeRect(8, 8, w - 16, h - 16);
  }

  function makeCard(c, i, wide) {
    var el = document.createElement('div');
    el.className = 'ztp-tcard' + (wide ? ' ztp-solo' : '');
    el.dataset.i = i;
    if (c.img) {
      var im = document.createElement('img'); im.alt = ''; im.src = c.img; el.appendChild(im);
    } else {
      var cv = document.createElement('canvas');
      drawArt(cv, i, wide);
      el.appendChild(cv);
    }
    var p = document.createElement('p'); p.textContent = c.cap; el.appendChild(p);
    return el;
  }

  function suppress984() {
    if (root.ZTP984 && ZTP984.hideTut) { try { ZTP984.hideTut(); } catch (e) {} }
    if (root.ZTP984) ZTP984.showTut = function () {};
    var tut = document.getElementById('ztpTut');
    if (tut && tut.parentNode) tut.parentNode.removeChild(tut);
    document.body.classList.remove('ztp-tut');
  }

  function click(id) {
    var el = document.getElementById(id);
    if (el) el.click();
  }

  function closePanels() {
    var k = document.getElementById('kjoin');
    if (k) k.classList.remove('ztp-join-panel');
    var sh = document.getElementById('ztpSheet');
    if (sh) sh.classList.remove('on');
  }

  function openJoin() {
    closePanels();
    var k = document.getElementById('kjoin');
    if (k) k.classList.add('ztp-join-panel');
    hookJoin();
  }

  function openSheet(html) {
    closePanels();
    var sh = document.getElementById('ztpSheet');
    if (!sh) return;
    sh.innerHTML = '<button type="button" class="x" aria-label="Close">×</button>' + html;
    sh.classList.add('on');
    sh.querySelector('.x').onclick = closePanels;
  }

  function buildPills(dock) {
    var title = document.createElement('h2');
    title.textContent = 'Bubble Hockey';
    dock.appendChild(title);
    var row = document.createElement('div'); row.className = 'ztp-pills';
    function pill(label, fn, id) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      if (id) b.id = id;
      b.addEventListener('click', fn);
      row.appendChild(b);
      return b;
    }
    if (isPad()) {
      pill('Join / room code', openJoin);
      pill('Play the computer', function () { closePanels(); click('vsai'); teardown(); });
      pill('Host for 2 phones', function () { closePanels(); click('host2'); teardown(); });
    } else {
      pill('Invite / code', function () {
        var join = document.getElementById('join');
        var html = '<p>Scan the code on the table, or open Join on a phone.</p>';
        if (join) html += '<div style="display:flex;justify-content:center;margin-top:8px"></div>';
        openSheet(html);
        var box = document.querySelector('#ztpSheet div');
        if (box && join) {
          var qr = join.cloneNode(true);
          qr.style.position = 'static'; qr.style.width = '140px'; qr.style.display = 'block';
          box.appendChild(qr);
        }
      });
      pill('Watch a game', function () {
        closePanels();
        teardown();
        if (root.BHT && BHT.startWatch) BHT.startWatch();
        else click('watchBtn');
      });
    }
    pill('How to play', function () {
      if (root.Howto && Howto.show) { try { closePanels(); Howto.show(); return; } catch (e) {} }
      if (root.Howto && Howto.play) { try { closePanels(); Howto.play(); return; } catch (e2) {} }
      var tip = document.getElementById('tip');
      openSheet('<p>' + (tip && tip.textContent ? tip.textContent :
        'Drag a player along his slot. With the puck, your finger steers it. Flick toward a teammate to pass. Tap to shoot. Slide while holding to body check.') + '</p>');
    });
    var snd = pill('Sound', function () {
      root.BH_MUTE = !root.BH_MUTE;
      snd.textContent = root.BH_MUTE ? 'Sound off' : 'Sound';
      snd.classList.toggle('on', !root.BH_MUTE);
    }, 'ztp985snd');
    pill('Enter', function () {
      closePanels();
      /* Stay on this combined screen but drop the cards, leaving the pills over the table. */
      var st = document.querySelector('#ztpSetup .ztp-stage');
      if (st) st.style.display = 'none';
    });
    dock.appendChild(row);
    var sheet = document.createElement('div'); sheet.className = 'ztp-sheet'; sheet.id = 'ztpSheet';
    dock.appendChild(sheet);
  }

  function fillLand(stage) {
    stage.innerHTML = '';
    var row = document.createElement('div'); row.className = 'ztp-row'; row.id = 'ztpRow';
    function addSet() {
      CARDS.forEach(function (c, i) { row.appendChild(makeCard(c, i, false)); });
    }
    addSet(); addSet();
    stage.appendChild(row);
    state.rowW = 0;
    requestAnimationFrame(function () { state.rowW = row.scrollWidth / 2; });
  }

  function fillPort(stage) {
    stage.innerHTML = '';
    var wrap = document.createElement('div');
    wrap.id = 'ztpSoloWrap';
    wrap.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden';
    var card = makeCard(CARDS[state.i], state.i, true);
    card.id = 'ztpSolo';
    wrap.appendChild(card);
    stage.appendChild(wrap);
    slipIn(card, 0);
    armHover();
    hookSwipe(stage);
  }

  function slipIn(el, dir) {
    /* dir < 0 comes from the left (after swipe right); dir > 0 from the right. */
    var from = (dir < 0 ? -1 : 1) * 28;
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.transform = 'translateX(' + from + 'vw)';
    el.offsetHeight;
    el.style.transition = '';
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
  }

  function zipOut(el, dir, done) {
    var to = (dir < 0 ? -1 : 1) * 40;
    el.style.opacity = '0';
    el.style.transform = 'translateX(' + to + 'vw)';
    setTimeout(done, 340);
  }

  function gotoCard(next, dir) {
    var n = CARDS.length;
    state.anim = 1;
    state.i = ((next % n) + n) % n;
    var stage = document.querySelector('#ztpSetup .ztp-stage');
    if (!stage) return;
    var old = document.getElementById('ztpSolo');
    function put() {
      var card = makeCard(CARDS[state.i], state.i, true);
      card.id = 'ztpSolo';
      var wrap = document.getElementById('ztpSoloWrap') || stage;
      wrap.appendChild(card);
      slipIn(card, dir);
      state.anim = 0;
      armHover();
    }
    if (old) zipOut(old, dir, function () { if (old.parentNode) old.parentNode.removeChild(old); put(); });
    else put();
  }

  function armHover() {
    clearTimeout(state.timer);
    if (state.mode !== 'port') return;
    state.timer = setTimeout(function () { gotoCard(state.i + 1, 1); }, HOLD);
  }

  function hookSwipe(stage) {
    if (stage._swipe) return;
    stage._swipe = 1;
    var startX = 0, startY = 0, dx = 0, on = false;
    stage.addEventListener('pointerdown', function (ev) {
      if (state.mode !== 'port') return;
      on = true; dx = 0; startX = ev.clientX; startY = ev.clientY;
      stage.setPointerCapture && stage.setPointerCapture(ev.pointerId);
    });
    stage.addEventListener('pointermove', function (ev) {
      if (!on) return;
      dx = ev.clientX - startX;
      var el = document.getElementById('ztpSolo');
      if (el && Math.abs(dx) > Math.abs(ev.clientY - startY)) {
        el.style.transition = 'none';
        el.style.transform = 'translateX(' + dx + 'px)';
      }
    });
    function end() {
      if (!on) return; on = false;
      var el = document.getElementById('ztpSolo');
      if (el) el.style.transition = '';
      var thresh = Math.min(72, innerWidth * 0.16);
      if (dx < -thresh) gotoCard(state.i + 1, 1);
      else if (dx > thresh) gotoCard(state.i - 1, -1);
      else if (el) el.style.transform = 'translateX(0)';
      /* auto-advance resumes after the swipe (gotoCard arms it; snap-back too) */
      if (Math.abs(dx) <= thresh) armHover();
      dx = 0;
    }
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
  }

  function applyMode() {
    var box = document.getElementById('ztpSetup');
    if (!box) return;
    var port = isPortrait();
    var next = port ? 'port' : 'land';
    if (state.mode === next && box.classList.contains(next)) return;
    state.mode = next;
    box.classList.remove('port', 'land');
    box.classList.add(next);
    var stage = box.querySelector('.ztp-stage');
    clearTimeout(state.timer);
    if (port) fillPort(stage);
    else { fillLand(stage); state.drift = performance.now(); }
  }

  function tick(now) {
    if (!state.alive) return;
    if (state.mode === 'land') {
      var row = document.getElementById('ztpRow');
      if (row) {
        if (!state.rowW) state.rowW = row.scrollWidth / 2;
        var t = (now - (state.drift || now)) / 1000;
        var x = -((t * 28) % (state.rowW || 1));
        var y = Math.sin(t * 0.35) * 10;
        row.style.transform = 'translate(' + x + 'px, calc(-50% + ' + y + 'px))';
      }
    } else if (state.mode === 'port') {
      var el = document.getElementById('ztpSolo');
      if (el && !state.drag && !state.anim) {
        var t2 = now / 1000;
        var bob = Math.sin(t2 * 0.7) * 6;
        /* don't fight a swipe in progress (inline transition none) */
        if (el.style.transition !== 'none') {
          el.style.transform = 'translateY(' + bob + 'px)';
        }
      }
    }
    requestAnimationFrame(tick);
  }

  function mount() {
    if (document.getElementById('ztpSetup')) return;
    css();
    suppress984();
    document.body.classList.add('ztp-setup');
    var box = document.createElement('div'); box.id = 'ztpSetup';
    box.innerHTML = '<div class="ztp-stage"></div><div class="ztp-dock"></div>';
    document.body.appendChild(box);
    buildPills(box.querySelector('.ztp-dock'));
    state.alive = true;
    applyMode();
    addEventListener('resize', applyMode);
    addEventListener('orientationchange', function () { setTimeout(applyMode, 80); });
    requestAnimationFrame(tick);
    /* if they join / start a local game, the stock code removes #kjoin — drop our shell too */
    var mo = new MutationObserver(function () {
      if (isPad() && !document.getElementById('kjoin') && document.body.classList.contains('ztp-setup')) {
        /* kjoin removed means they started */
        if (!document.getElementById('vsai')) teardown();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    state.mo = mo;
    hookJoin();
  }

  function hookJoin() {
    var go = document.getElementById('kgo');
    if (go && !go._ztp985) {
      go._ztp985 = 1;
      go.addEventListener('click', function () { setTimeout(teardown, 0); });
    }
  }

  function teardown() {
    state.alive = false;
    clearTimeout(state.timer);
    closePanels();
    var box = document.getElementById('ztpSetup');
    if (box && box.parentNode) box.parentNode.removeChild(box);
    document.body.classList.remove('ztp-setup');
    var k = document.getElementById('kjoin');
    if (k) k.classList.remove('ztp-join-panel');
    if (state.mo) { try { state.mo.disconnect(); } catch (e) {} }
  }

  function boot() {
    suppress984();
    /* Wait for the pad join card so pills can drive its buttons; TV has no #kjoin. */
    var n = 0;
    var t = setInterval(function () {
      n++;
      suppress984();
      var playing = root.BHT && BHT.sim && !BHT.demo && !BHT.attract && BHT.plist && BHT.plist.length;
      if (playing) { clearInterval(t); return; }
      if (!isPad() || document.getElementById('kjoin') || n > 40) {
        clearInterval(t);
        if (playing) return;
        mount();
      }
    }, 50);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  root.ZTP985 = { mount: mount, teardown: teardown, next: function () { gotoCard(state.i + 1, 1); } };
})(window);
