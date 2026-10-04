/* ZOMBIE TILES - phone controller. Sends intents to the TV; shows your private hearts / ammo / rolls. */
(function () {
  'use strict';
  var C = window.ZT_CONFIG, W = C.weapons;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var Q = new URLSearchParams(location.search);
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  var room = (Q.get('room') || store.get('zt_room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  var dice = store.get('zt_dice') || C.dice[Math.floor(Math.random() * C.dice.length)].id;
  $('room').value = room;
  $('name').value = store.get('zt_name') || '';
  var net = null, state = null, lastRollSeq = 0, lastFightKey = '', lastMode = '', stopAnim = null;

  // ------------------------------------------------------------ join screen
  function drawPick() {
    var box = $('dicePick'); box.innerHTML = '';
    C.dice.forEach(function (d) {
      var b = document.createElement('button'); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', d.id === dice ? 'true' : 'false');
      var cv = document.createElement('canvas'); cv.width = 240; cv.height = 120; b.appendChild(cv);
      b.appendChild(document.createTextNode(d.name));
      window.ZTDice.still(cv, d.id === 'candy' ? [3, 5] : d.id === 'sunshine' ? [1, 6] : d.id === 'bone' ? [1, 4] : d.id === 'blood' ? [1, 6] : [5, 6], d.id);
      b.onclick = function () { dice = d.id; store.set('zt_dice', dice); drawPick(); if (state) send({ t: 'dice', id: dice }); };
      box.appendChild(b);
    });
  }
  drawPick();
  function clientId(code) {
    var k = 'zt_client_' + code, v = store.get(k);
    if (!v) { v = 'c' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); store.set(k, v); }
    return v;
  }
  function joinStatus(t, bad) { var el = $('joinStatus'); el.textContent = t; el.className = 'jstatus' + (bad ? ' bad' : ''); }
  $('room').addEventListener('input', function () { this.value = this.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  $('joinBtn').onclick = join;
  $('name').addEventListener('keydown', function (e) { if (e.key === 'Enter') join(); });
  function join() {
    room = $('room').value.toUpperCase().replace(/[^A-Z]/g, '');
    var name = $('name').value.trim();
    if (room.length !== 4) { joinStatus('Type the 4-letter room code from the TV.', true); return; }
    if (!name) { joinStatus('Type your name.', true); $('name').focus(); return; }
    store.set('zt_name', name); store.set('zt_room', room); store.set('zt_dice', dice);
    $('joinBtn').disabled = true; joinStatus('Connecting to room ' + room + '...');
    requestWake();
    connect();
  }
  function connect() {
    if (net) { net.code = room; net.reconnect(); return; }
    net = new window.ZTNet.Client({
      code: room,
      onOpen: function () { send({ t: 'hello', clientId: clientId(room), name: store.get('zt_name') || $('name').value, dice: dice, coach: coachOn }); },
      onMessage: onMessage,
      onStatus: function (s, d) {
        var c = $('conn');
        if (s === 'online') { c.textContent = 'LINKED'; c.className = 'conn'; }
        else { nagStop(); c.textContent = s === 'noroom' ? 'NO ROOM' : 'RECONNECTING'; c.className = 'conn bad'; }
        if (!state) {
          if (s === 'noroom') { joinStatus('No room ' + room + ' found. Check the code on the TV (still trying...).', true); }
          else if (s === 'offline') { joinStatus('Could not reach the room server. Check your internet.', true); $('joinBtn').disabled = false; }
          else if (s !== 'online') joinStatus('Connecting to room ' + room + '...');
        }
      }
    });
  }
  function send(m) { if (net) net.send(m); }
  // v0.3: coach hints (remembered per phone) and the host's "Add AI player" picker
  var coachOn = store.get('zt_coach') === '1';
  // turn reminder: gentle buzz every few seconds + an on-screen YOUR TURN pulse, from the start of your turn until you touch the phone
  var turnBuzzOn = store.get('zt_turnbuzz') !== '0', canVibrate = 'vibrate' in navigator;
  var NEED = ['roll', 'fight', 'zturn', 'place', 'plan'], TURN = NEED.concat(['rolling', 'exec', 'fightview', 'zmoving']);
  var nag = null;
  function nagStart() {
    if (nag) return;
    var pc = C.phone || {};
    nag = setInterval(function () { if (turnBuzzOn && document.visibilityState === 'visible') buzz(pc.turnBuzzPattern || [40]); }, pc.turnBuzzEveryMs || 3500);
    $('play').classList.add('nag');
  }
  function nagStop() { if (!nag) return; clearInterval(nag); nag = null; $('play').classList.remove('nag'); }
  var AIC = C.ai, aiSel = { p: 0, l: 1 };
  var BLURB = { looter: 'Grabs weapons and hearts, avoids risky fights.', fighter: 'Charges at zombies. Very loud!', sprinter: 'Races for the helipad.',
    sneak: 'Tiptoes around zombies.', buddy: 'Teams up with a player and shares ammo.' };

  function onMessage(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'reject') { state = null; $('play').hidden = true; $('join').hidden = false; $('joinBtn').disabled = false; joinStatus(m.reason, true); return; }
    if (m.t === 'welcome') { store.set('zt_joined_' + room, '1'); $('join').hidden = true; $('play').hidden = false; return; }
    if (m.t === 'state') { state = m; $('join').hidden = true; $('play').hidden = false; render(); }
  }

  // ------------------------------------------------------------ inputs
  function press(el, fn) {
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (el.disabled) return;
      el.classList.add('down-now'); setTimeout(function () { el.classList.remove('down-now'); }, 120);
      buzz(12);
      fn();
    });
    el.addEventListener('click', function (e) { if (e.detail === 0) fn(); });   // keyboard / accessibility activation
  }
  Array.prototype.forEach.call(document.querySelectorAll('.dir'), function (b) { press(b, function () { send({ t: 'dir', d: b.getAttribute('data-d') }); }); });
  press($('exec'), function () { send({ t: 'exec' }); });
  press($('roll'), function () { send({ t: 'roll' }); });
  press($('undo'), function () { send({ t: 'undo' }); });
  press($('clear'), function () { send({ t: 'clear' }); });
  document.addEventListener('keydown', function (e) {     // handy when testing on a laptop
    if (!state || e.target.tagName === 'INPUT') return;
    nagStop();
    var m = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R' }[e.key];
    if (m) { send({ t: 'dir', d: m }); e.preventDefault(); }
    else if (e.key === 'Enter') send({ t: 'exec' }); else if (e.key === ' ') send({ t: 'roll' }); else if (e.key === 'Backspace') send({ t: 'undo' });
  });

  // ------------------------------------------------------------ render
  function heartsHtml(n, max) { var s = ''; for (var i = 0; i < max; i++) s += i < n ? '\u2665' : '<span class="e">\u2665</span>'; return s; }
  function render() {
    var s = state, y = s.you, mode = s.mode;
    document.documentElement.style.setProperty('--c', y.color);
    $('meName').textContent = y.name;
    $('hearts').innerHTML = heartsHtml(y.hearts, y.maxHearts);
    var wc = $('weapIcon').getContext('2d'); wc.clearRect(0, 0, 64, 64); if (y.weapon !== 'none') window.ZTRender.drawItem(wc, y.weapon, 32, 32, 54);
    $('weapName').textContent = W[y.weapon].short;
    var its = y.items || {}; $('ammo').textContent = 'AMMO ' + y.ammo + (its.trap ? ' \u00b7 TRAP\u00d7' + its.trap : '') + (its.dynamite ? ' \u00b7 TNT\u00d7' + its.dynamite : '');
    var s1 = '', s2 = s.msg || '', hot = false, crossOn = false, rollShow = false, rollOn = false, rollLabel = 'ROLL', execLabel = 'EXECUTE', placing = false, planRow = false;
    var extra = '';
    var curName = s.cur ? '<span style="color:' + s.cur.color + '">' + esc(s.cur.name) + '</span>' : '';
    switch (mode) {
      case 'lobby':
        s1 = "You're in!"; s2 = y.vip ? 'Start when everyone has joined.' : 'Waiting for ' + esc((s.lobby[0] || {}).name || 'the first player') + ' to start...';
        s2 = y.vip ? 'Start when everyone has joined.' : 'Waiting for ' + esc(s.vipName || 'the first player') + ' to start...';
        extra = lobbyList(s, y.vip) + (y.vip ? aiPicker(s) : '') +
          hueHtml(s.hue, y.vip) +
          (y.vip ? '<button class="big-btn" id="startGame">START GAME</button>' : '') + '<button class="small" id="changeDice">Change dice (' + esc(window.ZTDice.style(y.dice).name) + ')</button>' + coachBtn() + (canVibrate ? buzzBtn() : '');
        break;
      case 'roll': s1 = 'YOUR TURN!'; s2 = 'Roll to move'; hot = true; rollShow = rollOn = true; break;
      case 'rolling': s1 = 'Rolling...'; rollShow = true; break;
      case 'plan':
        s1 = 'Plan your path'; s2 = 'Tap directions, then EXECUTE. Opposite direction backs up.'; crossOn = true; planRow = true;
        execLabel = s.planLen ? 'EXECUTE' : 'STAY'; break;
      case 'exec': s1 = 'Moving...'; s2 = ''; break;
      case 'place':
        s1 = 'New tile!'; s2 = (s.place ? esc(s.place.tile) + '. ' : '') + '\u25C0 \u25B6 rotate \u00b7 \u25B2 \u25BC other spot' + (s.place && s.place.slots > 1 ? ' (' + s.place.slots + ')' : '');
        crossOn = true; placing = true; execLabel = 'PLACE'; hot = true; break;
      case 'fight':
        s1 = 'FIGHT!'; s2 = (s.fight && s.fight.attacker ? esc(s.fight.attacker) + ' (zombie) attacks you! ' : '') + W[y.weapon].label + ' +' + W[y.weapon].bonus + (W[y.weapon].gun ? (y.ammo > 0 ? ' (uses ' + Math.min(y.ammo, W[y.weapon].ammoPerFight) + ' ammo)' : ' (no ammo: +0)') : '');
        hot = true; rollShow = rollOn = true; rollLabel = 'FIGHT ROLL'; break;
      case 'fightview':
        var f = s.fight;
        s1 = f && f.stage === 'result' ? (f.title || 'Fight') : 'FIGHT!';
        if (f && f.stage === 'result') extra = '<div class="fightres ' + f.outcome + '">You ' + f.ptotal + ' vs ' + f.ztotal + '<br>' + esc(f.text) + '</div>';
        s2 = ''; break;
      case 'zturn': s1 = "YOU'RE A ZOMBIE"; s2 = 'Lurch 1-2 squares toward the nearest survivor.'; hot = true; rollShow = rollOn = true; rollLabel = 'LURCH'; break;
      case 'zmoving': s1 = 'Lurching...'; break;
      case 'dead':
        s1 = 'LEFT FOR DEAD'; s2 = 'You rise after ' + C.riseAfterRounds + ' full round' + (C.riseAfterRounds > 1 ? 's' : '') + '. Then:';
        extra = '<div class="choice"><button data-v="zombie" class="' + (y.deadChoice === 'zombie' ? 'on' : '') + '">Play as zombie</button><button data-v="spectate" class="' + (y.deadChoice === 'spectate' ? 'on' : '') + '">Spectate</button></div>';
        break;
      case 'escaped': s1 = 'YOU ESCAPED!'; s2 = 'Place: ' + ordinal(y.place) + '. Enjoy the chopper ride.'; break;
      case 'spectate': s1 = 'Spectating'; s2 = 'Watch the TV. ' + (s.cur ? 'Turn: ' + esc(s.cur.name) : ''); break;
      case 'over':
        s1 = (s.results || []).some(function (r) { return r.pid === y.id && r.escaped; }) ? 'YOU MADE IT!' : 'GAME OVER';
        s2 = '';
        extra = '<ul class="plist">' + (s.results || []).map(function (r) { return '<li><span class="d" style="background:' + r.color + '"></span>' + esc(r.name) + '<span class="lab">' + esc(r.label) + '</span></li>'; }).join('') + '</ul>' +
          (y.vip ? '<button class="big-btn" id="again">PLAY AGAIN</button>' : '<div class="private">' + esc(s.vipName || 'The first player') + ' can start the next game.</div>');
        break;
      default:
        s1 = s.cur ? curName + (s.cur.zombie ? ' (zombie)' : '') + "'s turn" : 'Waiting...';
        if (y.status === 'zombie') s2 = 'You are a zombie. Your lurch comes on your turn.';
    }
    if (mode === 'zturn' && y.status === 'zombie') extra = '<button class="small" id="toSpectate">Stop and spectate instead</button>';
    if (coachOn && s.coach && s.coach.text && (mode === 'plan' || mode === 'roll' || mode === 'fight')) extra = '<div class="coach"><span class="ci">\uD83E\uDDE0 Coach:</span> ' + esc(s.coach.text) + (s.coach.arrows && mode === 'plan' ? '<div class="carr">' + esc(s.coach.arrows) + '</div>' : '') + '</div>' + extra;
    if ((mode === 'roll' || mode === 'plan') && y.status === 'alive') extra += actionsHtml(y);
    if (['wait', 'roll', 'plan', 'fight', 'zturn'].indexOf(mode) !== -1 && y.status !== 'escaped') extra += coachBtn();
    if (mode === 'wait' && canVibrate) extra += buzzBtn();
    var nopad = ['lobby', 'over', 'dead', 'escaped', 'spectate'].indexOf(mode) !== -1;
    $('play').classList.toggle('nopad', nopad);
    if (nopad && stopAnim) { stopAnim(); stopAnim = null; }
    if (nopad) $('dice').getContext('2d').clearRect(0, 0, 360, 160);
    $('s1').innerHTML = s1; $('s2').innerHTML = s2;
    $('status').className = 'status' + (hot ? ' hot' : '');
    $('cross').className = 'cross' + (crossOn ? '' : ' off') + (placing ? ' placing' : '');
    $('exec').innerHTML = execLabel;
    $('roll').hidden = !rollShow; $('roll').disabled = !rollOn; $('roll').textContent = rollLabel;
    $('roll').className = 'roll' + (rollOn ? ' hot' : '') + (mode === 'zturn' ? ' zombie' : '');
    $('planRow').hidden = !planRow;
    $('moves').textContent = mode === 'plan' ? s.planLen + '/' + s.movesLeft : (mode === 'exec' ? s.movesLeft + ' left' : '');
    $('extra').innerHTML = extra;
    wireExtra();
    // dice animation for my movement / zombie roll
    if (s.roll && s.roll.seq !== lastRollSeq) {
      lastRollSeq = s.roll.seq; if (stopAnim) stopAnim();
      stopAnim = window.ZTDice.animate($('dice'), s.roll.d, s.roll.kind === 'zombie' ? 'zombie' : y.dice, C.timing.roll);
    } else if (!s.roll && (mode === 'roll' || mode === 'wait' || mode === 'lobby')) {
      if (stopAnim) stopAnim(); stopAnim = null; $('dice').getContext('2d').clearRect(0, 0, 360, 160);
    }
    if (mode === 'fight' && lastFightKey.indexOf((s.fight ? s.fight.seq : 0) + ':') !== 0) {   // new fight: clear the old movement dice
      lastFightKey = (s.fight ? s.fight.seq : 0) + ':await'; if (stopAnim) stopAnim(); stopAnim = null; $('dice').getContext('2d').clearRect(0, 0, 360, 160);
    }
    if (s.fight && s.fight.p) {
      var fk = s.fight.seq + ':' + s.fight.stage;
      if (fk !== lastFightKey) {
        lastFightKey = fk; if (stopAnim) stopAnim();
        if (s.fight.stage === 'rolling') stopAnim = window.ZTDice.animate($('dice'), s.fight.p, y.dice, C.timing.roll);
        else window.ZTDice.still($('dice'), s.fight.p, y.dice);
      }
    }
    if (TURN.indexOf(mode) === -1) nagStop();                                        // turn passed / game over
    else if (mode !== lastMode && NEED.indexOf(mode) !== -1 && TURN.indexOf(lastMode) === -1) nagStart();   // my turn (or a fight) just started
    if (mode !== lastMode) {
      if (mode === 'roll' || mode === 'fight' || mode === 'zturn' || mode === 'place') buzz([60, 60, 120]);
      if (mode === 'dead') buzz([300, 100, 300]);
      if (mode === 'escaped') buzz((C.escapeShow && C.escapeShow.buzz) || [90, 60, 90, 60, 300]);   // celebration buzz
      lastMode = mode;
    }
  }
  // Philips Hue (v0.2): only shown when the TV has a Lights Helper connected. The host phone (first player) picks rooms.
  function hueHtml(h, vip) {
    if (!h) return '';
    if (!h.canEdit) {
      if (!h.ok || !h.enabled || !h.selected.length) return '';
      var names = h.groups.filter(function (g) { return h.selected.indexOf(g.id) !== -1; }).map(function (g) { return g.name; });
      return '<div class="huecard mini">\uD83D\uDCA1 Hue lights on: ' + esc(names.join(', ')) + '</div>';
    }
    if (!h.ok) return '<div class="huecard warn"><div class="ht">\uD83D\uDCA1 Lights helper found</div><div class="hs">' + esc(h.msg) + '</div></div>';
    var out = '<div class="huecard"><div class="ht">\uD83D\uDCA1 Philips Hue found' + (h.mock ? ' (mock)' : '') + '</div><div class="hs">Use your lights in this game?</div>' +
      '<div class="hchoice"><button data-hue="on" class="' + (h.enabled ? 'on' : '') + '">Yes</button><button data-hue="off" class="' + (!h.enabled ? 'on' : '') + '">No</button></div>';
    if (h.enabled) {
      out += '<div class="hlist" role="group" aria-label="Rooms and zones">' + h.groups.map(function (g) {
        var on = h.selected.indexOf(g.id) !== -1;
        return '<button class="hroom' + (on ? ' on' : '') + '" data-g="' + esc(g.id) + '" role="checkbox" aria-checked="' + on + '"><span class="box">' + (on ? '\u2714' : '') + '</span><span class="hn">' + esc(g.name) + '</span><span class="hk">' + (g.type === 'Zone' ? 'Zone' : 'Room') + ' \u00b7 ' + g.lights + ' light' + (g.lights === 1 ? '' : 's') + '</span></button>';
      }).join('') + '</div>' +
        (h.selected.length ? '<button class="small htest" data-hue="test">Flash ticked rooms</button>' : '<div class="hs warnc">Tick at least one room.</div>');
    }
    return out + '</div>';
  }
  function lobbyList(s, vip) {
    return '<ul class="plist">' + (s.lobby || []).map(function (q) {
      return '<li><span class="d" style="background:' + q.color + '"></span>' + esc(q.name) + '<span class="lab">' + (q.ai ? '\uD83E\uDD16 ' + esc(q.ai) : q.local ? 'hot-seat' : 'phone') + '</span>' +
        (vip && q.ai ? '<button class="rmai" data-pid="' + q.pid + '" aria-label="Remove ' + esc(q.name) + '">\u2715</button>' : '') + '</li>';
    }).join('') + '</ul>';
  }
  function aiPicker(s) {
    if (s.full) return '<div class="private">The game is full (' + C.maxPlayers + ' players).</div>';
    var per = AIC.personas[AIC.order[aiSel.p]], lv = AIC.levels[AIC.levelOrder[aiSel.l]];
    return '<div class="aicard"><div class="ht">\uD83E\uDD16 Add AI player</div>' +
      '<button class="small" id="aiPer">' + esc(per.label) + ' \u25B8</button><div class="hs">' + esc(BLURB[AIC.order[aiSel.p]] || '') + '</div>' +
      '<div class="hchoice">' + AIC.levelOrder.map(function (k, i) { return '<button data-lv="' + i + '" class="' + (i === aiSel.l ? 'on' : '') + '">' + esc(AIC.levels[k].label) + '</button>'; }).join('') + '</div>' +
      '<button class="small addai" id="aiAddP">+ ADD ' + esc(lv.label.toUpperCase()) + ' AI</button></div>';
  }
  function coachBtn() { return '<button class="small coachb' + (coachOn ? ' on' : '') + '" id="coachT">\uD83E\uDDE0 Coach hints: ' + (coachOn ? 'ON' : 'OFF') + '</button>'; }
  // v0.4: drop items on your square, set off your dynamite, or stop here (unused moves are lost; tap twice so it can't happen by accident)
  var endArm = 0;
  function actionsHtml(y) {
    var it = y.items || {}, h = '<div class="acts">';
    if (it.trap) h += '<button class="small act" data-act="trap"' + (y.canTrap ? '' : ' disabled') + '>\uD83E\uDEA4 DROP TRAP (' + it.trap + ')</button>';
    if (it.dynamite) h += '<button class="small act tnt" data-act="dynamite"' + (y.canTNT ? '' : ' disabled') + '>\uD83E\uDDE8 DROP TNT (' + it.dynamite + ')</button>';
    if (y.myBombs) h += '<button class="small act boom" data-act="detonate">\uD83D\uDCA5 DETONATE</button>';
    h += '<button class="small act end" data-act="end">' + (Date.now() < endArm ? 'TAP AGAIN TO END TURN' : '\u23F9 END TURN') + '</button>';
    return h + '</div>';
  }
  function buzzBtn() { return '<button class="small coachb' + (turnBuzzOn ? ' on' : '') + '" id="buzzT">\uD83D\uDCF3 Turn buzz: ' + (turnBuzzOn ? 'ON' : 'OFF') + '</button>'; }
  function wireExtra() {
    var b;
    Array.prototype.forEach.call(document.querySelectorAll('#extra .act'), function (bt) {
      press(bt, function () {
        var a = bt.getAttribute('data-act');
        if (a === 'trap' || a === 'dynamite') send({ t: 'drop', item: a });
        else if (a === 'detonate') send({ t: 'detonate' });
        else if (a === 'end') {
          if (Date.now() < endArm) { endArm = 0; send({ t: 'endTurn' }); }
          else { endArm = Date.now() + 2500; render(); setTimeout(function () { if (state) render(); }, 2600); }
        }
      });
    });
    if ((b = $('buzzT'))) press(b, function () { turnBuzzOn = !turnBuzzOn; store.set('zt_turnbuzz', turnBuzzOn ? '1' : '0'); render(); });
    if ((b = $('coachT'))) press(b, function () { coachOn = !coachOn; store.set('zt_coach', coachOn ? '1' : '0'); send({ t: 'coach', on: coachOn }); render(); });
    if ((b = $('aiPer'))) press(b, function () { aiSel.p = (aiSel.p + 1) % AIC.order.length; render(); });
    if ((b = $('aiAddP'))) press(b, function () { send({ t: 'addAI', persona: AIC.order[aiSel.p], level: AIC.levelOrder[aiSel.l] }); aiSel.p = (aiSel.p + 1) % AIC.order.length; });
    Array.prototype.forEach.call(document.querySelectorAll('#extra .aicard [data-lv]'), function (bt) { press(bt, function () { aiSel.l = +bt.getAttribute('data-lv'); render(); }); });
    Array.prototype.forEach.call(document.querySelectorAll('#extra .rmai'), function (bt) { press(bt, function () { send({ t: 'removeAI', pid: +bt.getAttribute('data-pid') }); }); });
    Array.prototype.forEach.call(document.querySelectorAll('#extra .huecard button'), function (bt) {
      press(bt, function () {
        var v = bt.getAttribute('data-hue'), g = bt.getAttribute('data-g');
        if (v === 'on' || v === 'off') send({ t: 'hue', enabled: v === 'on' });
        else if (v === 'test') send({ t: 'hue', test: true });
        else if (g) send({ t: 'hue', toggle: g });
      });
    });
    if ((b = $('startGame'))) press(b, function () { send({ t: 'start' }); });
    if ((b = $('again'))) press(b, function () { send({ t: 'again' }); });
    if ((b = $('toSpectate'))) press(b, function () { send({ t: 'deadChoice', v: 'spectate' }); });
    if ((b = $('changeDice'))) press(b, function () {
      var i = C.dice.findIndex(function (d) { return d.id === dice; }); dice = C.dice[(i + 1) % C.dice.length].id; store.set('zt_dice', dice); send({ t: 'dice', id: dice });
    });
    Array.prototype.forEach.call(document.querySelectorAll('#extra .choice button'), function (bt) { press(bt, function () { send({ t: 'deadChoice', v: bt.getAttribute('data-v') }); }); });
  }
  var tapped = false;
  document.addEventListener('pointerdown', function () { tapped = true; nagStop(); }, true);   // any touch = 'I'm on it'
  function buzz(p) { if (!tapped) return; try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
  function ordinal(n) { return window.ZTGame ? window.ZTGame.ordinal(n) : n + ['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]; }
  var wake = null;
  function requestWake() { try { if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {}); } catch (e) {} }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && state) requestWake(); });

  // came back after a reload / phone sleep: rejoin the same seat automatically
  if (room && store.get('zt_joined_' + room) && store.get('zt_name')) { joinStatus('Rejoining room ' + room + '...'); $('joinBtn').disabled = true; connect(); }
  window.ZTC = { send: send, state: function () { return state; }, net: function () { return net; } };
})();
