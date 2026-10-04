/* ZOMBIE TILES - TV / host glue: lobby, board loop, overlays, hot-seat input, phone networking. */
(function () {
  'use strict';
  var C = window.ZT_CONFIG, W = C.weapons;
  var Q = new URLSearchParams(location.search);
  var FAST = Q.has('fast'), SEED = Q.has('seed') ? +Q.get('seed') : null, NONET = Q.has('nonet');
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var dirty = true, phoneDirty = true;
  var game = new window.ZTGame({ speed: FAST ? 0.08 : 1, onChange: function () { dirty = true; phoneDirty = true; if (ai) ai.poke(); }, onEvent: onEvent });
  var rnd = new window.ZTRender($('board'));
  var AIC = C.ai, ai = null;
  function isAI(p) { return !!(p && (p.ai || p.aiTakeover)); }
  ai = new window.ZTAI.Driver(game, { controls: isAI, react: aiReact });
  window.ZT = { game: game, render: rnd, config: C, ai: ai };     // handy for testing / tinkering in the console

  // ------------------------------------------------------------ sound (tiny synth, M to mute)
  var SFX = window.ZTSfx, muted = Q.has('mute'); SFX.muted = muted;
  function tone(f, d, type, vol, slide) { SFX.tone(f, d, type, vol, slide); }
  function sfx(name, p) { SFX.play(name, { pitch: voice(p) }); }
  function voice(p) {             // each player's little voice: AI by personality, humans by seat colour
    if (!p) return 1;
    if (p.ai && AIC.personas[p.ai.persona]) return AIC.personas[p.ai.persona].voice;
    return [1.0, 1.18, 0.88, 1.3][p.colorIdx % 4];
  }
  function rattle() { for (var i = 0; i < 7; i++) setTimeout(function () { tone(300 + Math.random() * 500, 0.04, 'triangle', 0.05); }, i * 60 + Math.random() * 40); }

  // ------------------------------------------------------------ events -> juice
  function playerById(id) { return game.byId(id); }
  function big(text, sub, color, cls) {
    $('big').className = cls || '';
    var el = document.createElement('div'); el.className = 'b'; if (color) el.style.setProperty('--bc', color);
    el.innerHTML = esc(text) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    $('big').innerHTML = ''; $('big').appendChild(el);
  }
  function onEvent(type, d) {
    var p = d.pid ? playerById(d.pid) : null;
    switch (type) {
      case 'start': ai.onStart(); rnd.snap(game); big('FIND THE HELIPAD', 'Explore tile by tile. Watch out for zombies.', '#b6ff7a'); tone(220, 0.4, 'sawtooth', 0.05, 110); break;
      case 'turn': if (p) { tone(660, 0.08); tone(990, 0.1, 'square', 0.04); } break;
      case 'roll': rattle(); break;
      case 'step': tone(180 + Math.random() * 40, 0.05, 'triangle', 0.04); break;
      case 'bump': tone(90, 0.08, 'square', 0.04); break;
      case 'pickup': if (p && p.ai && Math.random() < 0.35) say(p, 'pickup'); if (p) rnd.pop(d.kind === 'heart' ? '+1 \u2665' : d.kind === 'ammo' ? 'AMMO' : (W[d.kind] || C.items[d.kind]).short.toUpperCase() + '!', p.x, p.y, d.kind === 'heart' ? '#ff6b88' : '#ffd65a'); tone(880, 0.08, 'square', 0.05, 1320); break;
      case 'draw': big(d.tpl === 'helipad' ? 'THE HELIPAD!' : 'NEW TILE', d.tpl === 'helipad' ? 'Reach a gate. The guard says YES... or NO.' : 'Rotate it and attach it', d.tpl === 'helipad' ? '#ffd65a' : '#9ad8ff'); tone(330, 0.25, 'sine', 0.06, 660); break;
      case 'tile': break;
      case 'lunge': tone(120, 0.2, 'sawtooth', 0.05, 80); break;
      case 'fightStart':
        fightStyle = chargeOrScream(game.fight);
        sfx(fightStyle, p);
        if (p) { if (p.ai) say(p, fightStyle); else rnd.pop(fightStyle === 'charge' ? 'CHARGE!' : 'EEK!', p.x, p.y, fightStyle === 'charge' ? '#ffd65a' : '#ffffff', true); }
        if (game.fight && game.fight.attackerPid) { var att = game.byId(game.fight.attackerPid); if (att && att.ai) rnd.bubble(att.id, 'Braaains!', att.color, true); }
        break;
      case 'fightRoll': rattle(); break;
      case 'fightResult':
        var f = game.fight;
        if (f) {
          if (f.lost) {
            rnd.pop('-' + f.lost + ' \u2665', f.px, f.py, '#ff4a5a', true); rnd.shake = Math.min(1.4, 0.5 + f.lost * 0.3);
            sfx('crunch', p); setTimeout(function () { sfx('ouch', p); }, 120); flash('#ff1e2e', 0.55);
            if (p && p.ai && p.hearts > 0) say(p, 'hit');
          }
          if (f.zdead) {
            rnd.pop('KILL!', f.x, f.y, '#6dff9e', true); setTimeout(function () { sfx('victory', p); }, f.lost ? 350 : 0); flash('#ffe27a', 0.45);
            if (p && p.ai && !f.lost) say(p, 'kill');
          } else if (f.zdmg) rnd.pop('-1 HP', f.x, f.y, '#ffd65a');
        }
        break;
      case 'gate': if (!d.yes) { big('NO!', 'The guard shakes his head. Try another gate.', '#ff3b4e'); tone(110, 0.4, 'square', 0.06); if (p && p.ai) say(p, 'gateNo'); } break;
      case 'escape':
        big(p.name + ' ESCAPED!', Ordinal(d.place) + ' place. The chopper takes them aboard.', p.color, 'esc');
        rnd.cinematic(p, p.x, p.y);                       // helicopter swoops in, token hops aboard, lift-off + fireworks
        SFX.play('rotor', { dur: 4.4 }); setTimeout(function () { SFX.play('fanfare'); }, 1900);
        ((C.escapeShow && C.escapeShow.fireworks) || []).forEach(function (s, i) { setTimeout(function () { SFX.play('pop', { pitch: 0.8 + (i % 3) * 0.2 }); flash(i % 2 ? p.color : '#ffffff', 0.18); }, s * 1000); });
        flash('#ffd23f', 0.4);
        if (p.ai) {
          var al = p.allyPid && game.byId(p.allyPid);
          if (al && al.status === 'alive') {      // light betrayal: ditch the partner at the helipad (or cheer them on)
            var b = AIC.personas[p.ai.persona] || {};
            if (Math.random() < (b.betray || 0)) { p.betrayed = al.id; say(p, 'betray', { ally: al.name }); } else say(p, 'loyal', { ally: al.name });
          } else say(p, 'escape');
        }
        break;
      case 'death': big('LEFT FOR DEAD', p.name + ' will rise in ' + C.riseAfterRounds + ' full round' + (C.riseAfterRounds > 1 ? 's' : '') + '...', '#ff3b4e'); rnd.shake = 1.2; tone(70, 0.8, 'sawtooth', 0.08, 40); setTimeout(function () { sfx('scream', p); }, 60); if (p.ai) say(p, 'death'); break;
      case 'rise': big(p.name + ' RISES!', p.status === 'zombie' ? 'Now playing as a zombie' : 'A new zombie joins the horde', '#b6ff7a'); tone(60, 0.9, 'sawtooth', 0.08, 120); if (p.ai && p.status === 'zombie') say(p, 'rise'); break;
      case 'share': var to = game.byId(d.to); if (to) { rnd.pop('+' + d.n + ' AMMO', to.x, to.y, '#ffd65a', true); tone(880, 0.08, 'square', 0.05, 1320); } break;
      case 'drop':
        rnd.pop(d.kind === 'trap' ? 'TRAP SET' : 'LIT!', d.x, d.y, d.kind === 'trap' ? '#e0b070' : '#ff8a1a', true);
        if (d.kind === 'trap') { tone(520, 0.06, 'square', 0.05); setTimeout(function () { tone(380, 0.08, 'square', 0.05); }, 70); } else SFX.play('fuse');
        break;
      case 'snare':
        rnd.snare(d.x, d.y, d.owner ? (playerById(d.owner) || {}).color : null, d.removed); SFX.play('snare'); rnd.pop('SNARED!', d.x, d.y, '#9dff6a', true);
        if (p && p.ai && p.status === 'alive' && Math.random() < 0.6) say(p, 'snare');
        break;
      case 'boom':
        rnd.boom(d.x, d.y, d.r); rnd.shake = 2.2; SFX.play('boom'); flash('#ff8a1a', 0.75); setTimeout(function () { flash('#ffd23f', 0.35); }, 180);
        if (d.zombies) rnd.pop(d.zombies > 1 ? d.zombies + ' ZOMBIES!' : 'BOOM!', d.x, d.y, '#ffd23f', true);
        (d.hurt || []).forEach(function (pid) { var q = playerById(pid); if (q) { rnd.pop('-1 \u2665', q.x, q.y, '#ff6b88'); if (q.ai && q.hearts > 0) say(q, 'hit'); } });
        if (p && p.ai && p.status === 'alive' && Math.random() < 0.6) setTimeout(function () { say(p, 'boom'); }, 500);
        break;
      case 'round': if (d.round > 1) big('ROUND ' + d.round, d.moved ? 'The dead shuffle...' : '', '#c9b7ff'); break;
      case 'over': tone(392, 0.3, 'square', 0.05); break;
    }
    if (type === 'escape' || type === 'death' || type === 'fightResult' || type === 'over' || type === 'rise') phoneDirty = true;
    lightsForEvent(type, d, p);
  }
  var Ordinal = window.ZTGame.ordinal, fightStyle = 'charge';
  // charge if you walked into the fight with decent odds; scream if you got grabbed, are hurt, or the odds are bad
  function chargeOrScream(f) {
    if (!f) return 'scream';
    var p = game.byId(f.pid), odds = window.ZTAI.fightOdds(p).win;
    if (f.context === 'move' && odds >= 0.5 && p.hearts > C.fight.weakHearts) return 'charge';
    if (f.context === 'zombieAttack' || p.hearts <= C.fight.weakHearts || odds < 0.45) return 'scream';
    return f.context === 'turnStart' ? 'scream' : 'charge';
  }
  function say(p, kind, vars) {
    vars = vars || {};
    if (!vars.ally && p.allyPid) { var a = game.byId(p.allyPid); if (a) vars.ally = a.name; }
    rnd.bubble(p.id, window.ZTAI.line(p, kind, null, vars), p.color, kind === 'charge' || kind === 'scream');
  }
  function itemsText(p) { var it = p.items || {}, s = ''; if (it.trap) s += ' \u00b7 Trap\u00d7' + it.trap; if (it.dynamite) s += ' \u00b7 TNT\u00d7' + it.dynamite; return s; }
  function aiReact(p, kind, info) {
    if (kind === 'think') {
      var vars = {}; if (p.allyPid) { var a = game.byId(p.allyPid); if (a) vars.ally = a.name; }
      rnd.bubble(p.id, window.ZTAI.line(p, 'think', info.why, vars), p.color, false);
    } else if (kind === 'share') say(p, 'share', { ally: info.ally.name });
    else if (kind === 'drop') rnd.bubble(p.id, window.ZTAI.line(p, 'drop', info.item), p.color, info.item === 'dynamite');
  }
  function flash(color, a) {
    var el = $('flash'); if (!el) return;
    el.style.transition = 'none'; el.style.background = color; el.style.opacity = a;
    void el.offsetWidth; el.style.transition = 'opacity 0.6s ease-out'; el.style.opacity = 0;
  }

  // ------------------------------------------------------------ layout + loop
  function layout() {
    var w = innerWidth, h = innerHeight;
    rnd.resize(w, h, Math.min(2, window.devicePixelRatio || 1));
    var top = $('top').getBoundingClientRect().height, side = $('side').getBoundingClientRect().width, ban = $('banner').getBoundingClientRect().height;
    rnd.setArea({ x: 0, y: top + 8, w: w - side, h: h - top - ban - 40 });
  }
  addEventListener('resize', layout);
  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (dirty) { dirty = false; updateDom(); }
    rnd.frame(game, dt, now);
    if (phoneDirty) { phoneDirty = false; pushPhones(); }
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ DOM updates
  var lastRollSeq = 0, lastFightSeq = -1, lastFightStage = '', stopDice = null, stopF1 = null, stopF2 = null;
  function heartsHtml(n) { var s = ''; for (var i = 0; i < C.maxHearts; i++) s += i < n ? '\u2665' : '<span class="e">\u2665</span>'; return s; }
  function weaponCanvas(kind) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    if (kind !== 'none') window.ZTRender.drawItem(cv.getContext('2d'), kind, 32, 32, 52);
    return cv;
  }
  function actor() { var id = game.actorId(); return id ? game.byId(id) : null; }
  function tvControls(p) { return !!p && !isAI(p) && (p.local || !p.connected || Q.get('hotseat') === 'all'); }
  function aiTag(p) {
    if (p.aiTakeover) return 'AI COVERING';
    var per = AIC.personas[p.ai.persona], lv = AIC.levels[p.ai.level];
    return 'AI \u00b7 ' + (per ? per.short : '') + ' \u00b7 ' + (lv ? lv.label : '');
  }

  function updateDom() {
    var g = game, ph = g.phase;
    $('lobby').hidden = ph !== 'lobby';
    $('results').hidden = ph !== 'over';
    if (ph === 'lobby') { renderLobby(); return; }
    if (ph === 'over') renderResults();
    $('roundInfo').innerHTML = 'Round <b>' + g.round + '</b>';
    $('deckInfo').innerHTML = 'Tiles left <b>' + g.deck.length + '</b>';
    $('joinInfo').innerHTML = net && net.status === 'online' ? 'Room <b>' + net.code + '</b>' : '';
    $('lightInfo').innerHTML = lightsOn() ? '\uD83D\uDCA1 <b>Hue</b>' : '';
    // cards
    var cards = $('cards'); cards.innerHTML = '';
    var cur = g.curP();
    g.players.forEach(function (p) {
      var el = document.createElement('div');
      var out = p.status !== 'alive' && p.status !== 'zombie';
      el.className = 'card' + (p === cur && ph !== 'over' ? ' cur' : '') + (out ? ' out' : '');
      el.style.setProperty('--c', p.color);
      var tag = isAI(p) ? aiTag(p) : p.local ? 'HOT-SEAT' : (p.connected ? 'PHONE' : 'RECONNECTING');
      var stat = p.status === 'escaped' ? '<div class="cstat esc">ESCAPED ' + Ordinal(p.place).toUpperCase() + '!</div>'
        : p.status === 'dead' ? '<div class="cstat dead">Left for dead (rises soon)</div>'
        : p.status === 'zombie' ? '<div class="cstat zom">Zombie (hunting)</div>'
        : p.status === 'spectator' ? '<div class="cstat dead">Spectating</div>' : '';
      var ally = p.ai && p.allyPid && g.byId(p.allyPid), rel = ally ? (p.betrayed === ally.id ? '<div class="cally bad">\uD83D\uDC94 ditched ' + esc(ally.name) + '</div>' : '<div class="cally">\uD83E\uDD1D teamed with ' + esc(ally.name) + '</div>') : '';
      el.innerHTML = '<div class="cname"><canvas class="cport" width="56" height="56"></canvas>' + esc(p.name) + '<span class="tag' + (isAI(p) ? ' ai' : p.local || p.connected ? '' : ' off') + '">' + tag + '</span></div>' +
        (p.status === 'alive' ? '<div class="crow">' + (C.showHeartsOnTV ? '<span class="hearts">' + heartsHtml(p.hearts) + '</span>' : '') + '<span class="weap"></span></div>' : '') + stat + rel;
      window.ZTRender.portrait(el.querySelector('.cport'), p);
      var wp = el.querySelector('.weap');
      if (wp) { wp.appendChild(weaponCanvas(p.weapon)); wp.appendChild(document.createTextNode(W[p.weapon].short + itemsText(p))); }
      cards.appendChild(el);
    });
    $('log').innerHTML = g.messages.slice(-4).map(function (m) { return '<div>' + esc(m) + '</div>'; }).join('');
    // banner
    var a = actor(), tv = tvControls(a);
    var who = cur ? '<span style="color:' + cur.color + '">' + esc(cur.name) + '</span>' : '';
    var what = '', sub = '';
    var key = function (k, phone) { return tv ? '<kbd>' + k + '</kbd>' : phone; };
    var aiNow = isAI(cur) && ph !== 'over';
    if (aiNow) {
      what = { roll: 'Getting ready to roll...', rolling: 'Rolling...', plan: g.plan.length ? 'Planned route: <b>' + g.plan.length + '</b> / ' + g.movesLeft + ' squares' : 'Thinking...', exec: 'Moving... ' + g.movesLeft + ' left',
        place: 'Placing the new tile...', fight: 'FIGHT!', zturn: 'Zombie turn...', zmoving: 'Lurching...', escape: 'ESCAPED!' }[ph] || '';
      sub = cur.aiTakeover ? 'The AI plays for ' + cur.name + ' until their phone reconnects.' : '';
      ph = '_ai';
    }
    switch (ph) {
      case 'roll': what = 'Roll to move: ' + key('ENTER', 'press ROLL on your phone'); break;
      case 'rolling': what = 'Rolling...'; break;
      case 'plan': what = 'Plan your path: <b>' + g.plan.length + '</b> / ' + g.movesLeft + ' squares, then ' + key('ENTER', 'EXECUTE'); sub = 'Press the opposite direction to back up. Execute with 0 squares to stay put.'; break;
      case 'exec': what = 'Moving... ' + g.movesLeft + ' left'; break;
      case 'place': what = 'New tile! ' + (tv ? '<kbd>\u25C0 \u25B6</kbd> rotate &middot; <kbd>\u25B2 \u25BC</kbd> other spot &middot; <kbd>ENTER</kbd> place' : '\u25C0 \u25B6 rotate \u00b7 \u25B2 \u25BC other spot \u00b7 EXECUTE places it'); sub = g.place && g.place.slots.length > 1 ? g.place.slots.length + ' places it could go' : ''; break;
      case 'fight': what = 'FIGHT!'; break;
      case 'zturn': what = 'Zombie turn: ' + key('ENTER', 'press LURCH on your phone'); break;
      case 'zmoving': what = 'Lurching...'; break;
      case 'escape': what = 'ESCAPED!'; break;
      case 'between': case 'roundEnd': what = ''; break;
    }
    ph = g.phase;
    $('bWho').innerHTML = who + (aiNow ? ' <span class="aitag">AI</span>' : ''); $('bWhat').innerHTML = what; $('bSub').textContent = sub || g.lastMsg || '';
    // banner dice
    if (g.roll && g.roll.seq !== lastRollSeq) {
      lastRollSeq = g.roll.seq; if (stopDice) stopDice();
      stopDice = window.ZTDice.animate($('bannerDice'), g.roll.d, g.roll.kind === 'zombie' ? 'zombie' : g.roll.dice, C.timing.roll * game.speed);
    } else if (!g.roll && lastRollSeq !== -1 && (ph === 'roll' || ph === 'zturn')) {
      if (stopDice) stopDice(); stopDice = null; $('bannerDice').getContext('2d').clearRect(0, 0, 240, 120);
    }
    // hot-seat pad
    $('pad').hidden = !(a && tv);
    if (a && tv) {
      $('padWho').innerHTML = '<span style="color:' + a.color + '">' + esc(a.name) + '</span>';
      $('padRoll').textContent = ph === 'zturn' ? 'LURCH' : ph === 'fight' ? 'FIGHT' : 'ROLL';
      $('padExec').textContent = ph === 'place' ? 'PLACE' : ph === 'plan' ? 'GO' : ph === 'roll' || ph === 'fight' || ph === 'zturn' ? 'ROLL' : 'GO';
    }
    renderFight();
  }

  function renderFight() {
    var f = game.fight, ov = $('fight');
    if (!f) { ov.hidden = true; lastFightStage = ''; return; }
    ov.hidden = false;
    var p = game.byId(f.pid), z = game.zombieById(f.zid), tv = tvControls(p);
    $('fpName').innerHTML = '<span style="color:' + p.color + '">' + esc(p.name) + '</span>';
    var bonus = f.stage === 'await' ? W[p.weapon].bonus : f.bonus;
    $('fpWeap').textContent = W[f.stage === 'await' ? p.weapon : f.weapon].label + ' (+' + bonus + ')' + (f.note ? ' \u00b7 ' + f.note : '') + ((f.stage === 'await' ? p.hearts <= C.fight.weakHearts : f.weak) ? ' \u00b7 WEAK (needs +' + C.fight.cleanMarginWeak + ' for a clean kill)' : '');
    $('fzName').textContent = f.zname ? f.zname.toUpperCase() + ' (ZOMBIE)' : 'ZOMBIE';
    $('fzHp').textContent = (z ? z.hp : 0) + ' HP' + (f.attackerPid ? ' \u00b7 attacking!' : '');
    var key = f.seq + ':' + f.stage;
    if (key === lastFightStage) return;
    lastFightStage = key;
    var res = $('fRes'), pr = $('fPrompt');
    if (f.stage === 'await') {
      [$('fpDice'), $('fzDice')].forEach(function (cv) { var c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); c.fillStyle = 'rgba(255,255,255,0.25)'; c.font = '700 120px Fredoka'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('? ?', cv.width / 2, cv.height / 2); });
      $('fpTot').textContent = ''; $('fzTot').textContent = '';
      res.className = 'fresult'; res.innerHTML = '';
      pr.className = 'fprompt blink'; pr.innerHTML = isAI(p) ? esc(p.name) + ' is rolling...' : esc(p.name) + ', ' + (tv ? 'press <b>ENTER</b> to roll!' : 'press <b>ROLL</b> on your phone!');
    } else if (f.stage === 'rolling') {
      pr.className = 'fprompt'; pr.textContent = '';
      if (stopF1) stopF1(); if (stopF2) stopF2();
      stopF1 = window.ZTDice.animate($('fpDice'), f.p, f.dice, C.timing.roll * game.speed);
      stopF2 = window.ZTDice.animate($('fzDice'), f.z, 'zombie', C.timing.roll * game.speed * 1.08);
    } else if (f.stage === 'result') {
      window.ZTDice.still($('fpDice'), f.p, f.dice); window.ZTDice.still($('fzDice'), f.z, 'zombie');
      $('fpTot').textContent = f.p[0] + '+' + f.p[1] + (f.bonus ? '+' + f.bonus : '') + ' = ' + f.ptotal;
      $('fzTot').textContent = f.z[0] + '+' + f.z[1] + ' = ' + f.ztotal;
      res.className = 'fresult ' + f.outcome;
      var sub = f.text.replace(f.title, '').trim();
      res.innerHTML = esc(p.hearts <= 0 ? 'LEFT FOR DEAD' : f.title) + '<small>Margin ' + (f.margin > 0 ? '+' : '') + f.margin + (sub ? ' \u00b7 ' + esc(sub) : '') + '</small>';
    }
  }

  // ------------------------------------------------------------ lobby
  var hsDice = 0;
  function renderLobby() {
    var ul = $('lobbyPlayers'); ul.innerHTML = '';
    for (var i = 0; i < C.maxPlayers; i++) {
      var p = game.players[i], li = document.createElement('li');
      if (!p) { li.className = 'empty'; li.textContent = 'Waiting for player ' + (i + 1) + '...'; ul.appendChild(li); continue; }
      li.style.setProperty('--c', p.color);
      var kind = p.ai ? 'AI \u00b7 ' + esc(AIC.personas[p.ai.persona].label) + ' \u00b7 ' + esc(AIC.levels[p.ai.level].label) : (p.local ? 'Hot-seat (this screen)' : p.connected ? 'Phone' : 'Phone (reconnecting)');
      li.innerHTML = '<canvas class="lport" width="64" height="64"></canvas><span>' + esc(p.name) + (i === 0 && !p.ai ? ' <span class="kind">(starts the game)</span>' : '') +
        '<br><span class="kind">' + kind + ' \u00b7 ' + esc(window.ZTDice.style(p.dice).name) + ' dice</span></span>';
      window.ZTRender.portrait(li.querySelector('.lport'), p);
      var cv = document.createElement('canvas'); cv.width = 240; cv.height = 120; li.appendChild(cv);
      window.ZTDice.still(cv, [5, 6], p.dice);
      var rm = document.createElement('button'); rm.className = 'rm'; rm.innerHTML = '&times;'; rm.setAttribute('aria-label', 'Remove ' + p.name);
      rm.onclick = (function (id) { return function () { game.removePlayer(id); }; })(p.id);
      li.appendChild(rm);
      ul.appendChild(li);
    }
    $('pcount').textContent = game.players.length + '/' + C.maxPlayers;
    $('startBtn').disabled = !game.players.length;
    $('hsDice').textContent = 'Dice: ' + C.dice[hsDice].name;
    $('hsAdd').disabled = game.players.length >= C.maxPlayers;
    $('aiAdd').disabled = game.players.length >= C.maxPlayers;
    $('aiPersona').textContent = AIC.personas[AIC.order[aiPick.p]].label;
    $('aiLevel').textContent = AIC.levels[AIC.levelOrder[aiPick.l]].label;
    renderHuePanel();
  }
  $('hsDice').onclick = function () { hsDice = (hsDice + 1) % C.dice.length; dirty = true; };
  function addHotseat(name) {
    var p = game.addPlayer({ name: name || $('hsName').value || ('Player ' + (game.players.length + 1)), dice: C.dice[hsDice].id, local: true });
    $('hsName').value = ''; hsDice = (hsDice + 1) % C.dice.length;
    return p;
  }
  $('hsAdd').onclick = function () { addHotseat(); };
  var aiPick = { p: 0, l: 1 };
  function vip() {                // the host phone = first phone player (AI and hot-seat seats can't hold a phone)
    for (var i = 0; i < game.players.length; i++) { var q = game.players[i]; if (!q.ai && !q.local) return q; }
    return null;
  }
  function addAI(persona, level) { return game.addPlayer({ ai: { persona: persona || AIC.order[aiPick.p], level: level || AIC.levelOrder[aiPick.l] } }); }
  $('aiPersona').onclick = function () { aiPick.p = (aiPick.p + 1) % AIC.order.length; dirty = true; };
  $('aiLevel').onclick = function () { aiPick.l = (aiPick.l + 1) % AIC.levelOrder.length; dirty = true; };
  $('aiAdd').onclick = function () { if (addAI()) aiPick.p = (aiPick.p + 1) % AIC.order.length; dirty = true; };
  $('hsName').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.stopPropagation(); addHotseat(); } });
  $('startBtn').onclick = function () { startGame(); };
  $('againBtn').onclick = function () { startGame(); };
  $('lobbyBtn').onclick = function () { game.phase = 'lobby'; game.changed(); lightFx('end', { reason: 'back to the lobby' }); };
  function startGame() { if (!game.players.length) return; requestWake(); game.start(SEED); layout(); rnd.snap(game); }

  function renderResults() {
    var r = game.results || [];
    $('resTitle').textContent = r.some(function (x) { return x.escaped; }) ? 'THE CHOPPER LIFTS OFF!' : 'THE HORDE WINS...';
    $('resList').innerHTML = r.map(function (x) {
      return '<li class="' + (x.escaped ? 'esc' : '') + '" style="--c:' + x.color + '"><span class="pl' + (x.escaped ? '' : ' skull') + '">' + (x.escaped ? Ordinal(x.place) : '\u2620') + '</span>' + esc(x.name) + '<span class="lab">' + esc(x.label) + '</span></li>';
    }).join('');
  }

  // ------------------------------------------------------------ hot-seat input (keyboard + on-screen pad)
  function act(m) {
    var a = actor();
    if (game.phase === 'over' && m.t === 'exec') { startGame(); return; }
    if (!a || !tvControls(a)) return;     // AI seats (and phones) aren't driven from the TV keys
    if (m.t === 'roll' && (game.phase === 'plan' || game.phase === 'place')) return;
    game.intent(a.id, m);
  }
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    var k = e.key;
    if (k === 'm' || k === 'M') { muted = !muted; SFX.muted = muted; return; }
    if ((k === 'l' || k === 'L') && lightsAvailable()) { setLights(!lights.enabled, lights.selected); if (game.phase !== 'lobby') big(lights.enabled ? 'LIGHTS ON' : 'LIGHTS OFF', lights.enabled ? 'Hue effects are back' : 'Your lights go back to normal', '#ffd65a'); return; }
    if (game.phase === 'lobby') {
      if (k === 'Enter' && document.activeElement === document.body && game.players.length) { startGame(); e.preventDefault(); }
      return;
    }
    var map = { ArrowUp: { t: 'dir', d: 'U' }, ArrowDown: { t: 'dir', d: 'D' }, ArrowLeft: { t: 'dir', d: 'L' }, ArrowRight: { t: 'dir', d: 'R' },
      w: { t: 'dir', d: 'U' }, s: { t: 'dir', d: 'D' }, a: { t: 'dir', d: 'L' }, d: { t: 'dir', d: 'R' },
      Enter: { t: 'exec' }, ' ': { t: 'exec' }, r: { t: 'roll' }, Backspace: { t: 'undo' }, z: { t: 'undo' }, Escape: { t: 'clear' }, q: { t: 'rot', v: -1 }, e: { t: 'rot', v: 1 },
      t: { t: 'drop', item: 'trap' }, b: { t: 'drop', item: 'dynamite' }, x: { t: 'detonate' }, n: { t: 'endTurn' } };
    var m = map[k] || map[k.toLowerCase && k.toLowerCase()];
    if (!m) return;
    if (document.activeElement && document.activeElement.tagName === 'BUTTON' && (k === 'Enter' || k === ' ')) return;  // let focused buttons click
    e.preventDefault();
    act(m);
  });
  Array.prototype.forEach.call(document.querySelectorAll('#pad button'), function (b) {
    b.addEventListener('click', function () {
      var k = b.getAttribute('data-k');
      act(k === 'exec' ? { t: 'exec' } : k === 'roll' ? { t: game.phase === 'plan' ? 'exec' : 'roll' } : k === 'undo' ? { t: 'undo' } : { t: 'dir', d: k });
      b.blur();
    });
  });

  // ------------------------------------------------------------ networking
  var net = null, clients = {};     // clientId -> { pid, conn, seen, lastSent }
  function controllerUrl(code) {
    var base = location.protocol === 'file:' ? C.liveControllerUrl : new URL('controller.html', location.href.split('?')[0]).href;
    return base + '?room=' + code;
  }
  function drawQr(text) {
    var cv = $('qr'), ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    try {
      var qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
      var n = qr.getModuleCount(), cell = Math.floor(cv.width / (n + 4)), off = Math.floor((cv.width - cell * n) / 2);
      ctx.fillStyle = '#14121b';
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(off + c * cell, off + r * cell, cell, cell);
    } catch (e) { ctx.fillStyle = '#000'; ctx.fillText('QR unavailable', 20, 150); }
  }
  function setNetUi(status, code, detail) {
    var ns = $('netStatus');
    if (status === 'online') {
      var url = controllerUrl(code);
      $('code').textContent = code; $('joinUrl').textContent = url.replace(/^https?:\/\//, ''); drawQr(url);
      ns.className = 'netstatus ok'; ns.textContent = 'Room open. Phones can join now.';
      $('netBadge').textContent = '';
    } else if (status === 'offline') {
      ns.className = 'netstatus bad'; ns.textContent = 'Phone play unavailable (' + (detail || 'no connection') + '). Hot-seat still works. Retrying...';
      $('netBadge').textContent = game.phase !== 'lobby' ? 'Phones offline: ' + (detail || '') : '';
      if (net) setTimeout(function () { if (net.status === 'offline') { net.tries = 0; net.open(); } }, 8000);
    } else {
      ns.className = 'netstatus'; ns.textContent = status === 'reconnecting' ? 'Reconnecting to the room server...' : 'Connecting to the room server...';
      $('netBadge').textContent = game.phase !== 'lobby' && status === 'reconnecting' ? 'Room server reconnecting (phones already joined keep working)' : '';
    }
    dirty = true;
  }
  function onPhoneMessage(conn, m) {
    if (!m || typeof m !== 'object') return;
    if ((m.t === 'hello' && m.role === 'lights') || conn._lights) { onLightsMessage(conn, m); return; }
    if (m.t === 'hello') {
      var cid = String(m.clientId || conn.peer).slice(0, 40), c = clients[cid];
      var p = c ? game.byId(c.pid) : null;
      if (!p) {
        if (game.phase !== 'lobby' && game.phase !== 'over') { net.send(conn, { t: 'reject', reason: 'A game is already running. Join when it finishes!' }); return; }
        p = game.addPlayer({ name: m.name, dice: m.dice, local: false, clientId: cid });
        if (!p) { net.send(conn, { t: 'reject', reason: 'The room is full (' + C.maxPlayers + ' players).' }); return; }
      } else if (game.phase === 'lobby' || game.phase === 'over') {
        if (m.name) p.name = String(m.name).replace(/[^\w \-'!.?]/g, '').trim().slice(0, 12) || p.name;
        if (m.dice) game.intent(p.id, { t: 'dice', id: m.dice });
      }
      if (c && c.conn && c.conn !== conn) try { c.conn.close(); } catch (e) {}
      clients[cid] = { pid: p.id, conn: conn, seen: Date.now(), lastSent: '' };
      conn._cid = cid;
      p.connected = true;
      if (typeof m.coach === 'boolean') p.coach = m.coach;
      handBack(p);
      game.changed();
      net.send(conn, { t: 'welcome', pid: p.id, room: net.code });
      return;
    }
    var cl = clients[conn._cid];
    if (!cl || cl.conn !== conn) return;
    cl.seen = Date.now();
    var pl = game.byId(cl.pid);
    if (!pl) { net.send(conn, { t: 'reject', reason: 'You were removed from the room.' }); return; }
    if (!pl.connected) { pl.connected = true; dirty = true; handBack(pl); }
    if (m.t === 'ping') { net.send(conn, { t: 'pong' }); return; }
    if (m.t === 'start' || m.t === 'again') {
      if (vip() === pl && (game.phase === 'lobby' || game.phase === 'over')) startGame();
      return;
    }
    if (m.t === 'leave') { if (game.phase === 'lobby') { game.removePlayer(pl.id); delete clients[conn._cid]; } return; }
    if (m.t === 'hue') { if (vip() === pl) hueIntent(m); return; }
    if (m.t === 'coach') { pl.coach = !!m.on; phoneDirty = true; return; }
    if (m.t === 'addAI' || m.t === 'removeAI') {        // the host phone manages computer players in the lobby
      if (vip() !== pl || (game.phase !== 'lobby' && game.phase !== 'over')) return;
      if (m.t === 'addAI') addAI(AIC.personas[m.persona] ? m.persona : null, AIC.levels[m.level] ? m.level : null);
      else { var q = game.byId(+m.pid); if (q && q.ai) game.removePlayer(q.id); }
      return;
    }
    game.intent(pl.id, m);
  }
  function onPhoneClose(conn) {
    if (conn._lights) { if (conn === lights.conn) { lights.conn = null; lights.st = null; dirty = phoneDirty = true; } return; }
    var cl = clients[conn._cid];
    if (cl && cl.conn === conn) { var p = game.byId(cl.pid); if (p) { p.connected = false; if (!p.offSince) p.offSince = Date.now(); game.changed(); } }
  }
  function handBack(p) {           // a phone came back: the AI gives the seat back
    p.offSince = 0;
    if (!p.aiTakeover) return;
    p.aiTakeover = null;
    if (inGame()) { big(p.name + ' IS BACK!', 'The AI hands the seat back.', p.color); rnd.bubble(p.id, "I'm back!", p.color, false); }
    game.changed();
  }
  setInterval(function () {               // phones that went quiet (asleep) show as reconnecting; hot-seat keys can cover for them
    var now = Date.now(), ch = false;
    for (var cid in clients) {
      var cl = clients[cid], p = game.byId(cl.pid);
      if (p && p.connected && now - cl.seen > 15000) { p.connected = false; ch = true; }
      if (p && !p.connected && !p.ai && inGame()) {       // still gone after a while: an AI keeps the seat warm
        if (!p.offSince) p.offSince = now;
        if (!p.aiTakeover && now - p.offSince > AIC.takeoverAfterMs && p.status !== 'escaped' && p.status !== 'spectator') {
          p.aiTakeover = { persona: AIC.takeoverPersona, level: AIC.takeoverLevel };
          big('AI PLAYS FOR ' + p.name.toUpperCase(), 'Until their phone reconnects.', p.color);
          rnd.bubble(p.id, 'I\'ll play for ' + p.name + ' for now!', p.color, false);
          ch = true;
        }
      }
    }
    if (ch) game.changed();
    if (lights.conn && now - lights.seen > 20000) { lights.conn = null; lights.st = null; dirty = true; }
    phoneDirty = true;                   // heartbeat: resend state every few seconds
    for (var c2 in clients) clients[c2].lastSent = '';
  }, 3000);

  function phoneState(p) {
    var g = game, a = g.actorId(), cur = g.curP && g.phase !== 'lobby' ? g.curP() : null, f = g.fight;
    var mode = 'wait';
    if (g.phase === 'lobby') mode = 'lobby';
    else if (g.phase === 'over') mode = 'over';
    else if (p.status === 'dead') mode = 'dead';
    else if (p.status === 'escaped') mode = 'escaped';
    else if (p.status === 'spectator') mode = 'spectate';
    else if (a === p.id) mode = g.phase;                    // roll | plan | place | fight | zturn
    else if (f && f.pid === p.id) mode = 'fightview';
    else if (cur === p && (g.phase === 'rolling' || g.phase === 'exec' || g.phase === 'zmoving')) mode = g.phase;
    var st = {
      t: 'state', phase: g.phase, mode: mode, round: g.round || 1,
      you: { id: p.id, name: p.name, color: p.color, dice: p.dice, hearts: p.hearts, maxHearts: C.maxHearts, ammo: p.ammo, weapon: p.weapon,
        status: p.status, place: p.place, deadChoice: p.deadChoice, vip: vip() === p, coach: !!p.coach, aiCover: !!p.aiTakeover,
        items: p.items || { trap: 0, dynamite: 0 }, canTrap: g.canDrop ? g.canDrop(p, 'trap') : false, canTNT: g.canDrop ? g.canDrop(p, 'dynamite') : false,
        myBombs: (g.bombs || []).filter(function (b) { return b.owner === p.id; }).length },
      coach: p.coach && !p.aiTakeover && (mode === 'plan' || mode === 'fight' || mode === 'roll') ? coachFor(p) : null,
      full: g.players.length >= C.maxPlayers, vipName: vip() ? vip().name : '',
      cur: cur ? { id: cur.id, name: cur.name, color: cur.color, zombie: cur.status === 'zombie' } : null,
      movesLeft: g.movesLeft || 0, planLen: g.plan ? g.plan.length : 0,
      roll: g.roll && g.roll.pid === p.id ? { seq: g.roll.seq, d: g.roll.d, total: g.roll.total, kind: g.roll.kind } : null,
      fight: f && f.pid === p.id ? { seq: f.seq, stage: f.stage, p: f.stage !== 'await' ? f.p : null, z: f.stage !== 'await' ? f.z : null, bonus: f.bonus, ptotal: f.ptotal, ztotal: f.ztotal,
        outcome: f.stage === 'result' ? f.outcome : null, text: f.stage === 'result' ? f.text : null, title: f.title || null, attacker: f.attackerPid ? (g.byId(f.attackerPid) || {}).name : null } : null,
      place: g.phase === 'place' && g.place ? { slots: g.place.slots.length, tile: window.ZT_TILES.byId[g.place.tpl].name } : null,
      msg: g.lastMsg || '',
      lobby: g.phase === 'lobby' || g.phase === 'over' ? g.players.map(function (q) { return { pid: q.id, name: q.name, color: q.color, dice: q.dice, local: q.local, ai: q.ai ? AIC.personas[q.ai.persona].short + ' \u00b7 ' + AIC.levels[q.ai.level].label : null }; }) : null,
      results: g.phase === 'over' ? g.results : null,
      hue: g.phase === 'lobby' ? hueView(p) : null
    };
    return st;
  }
  var coachCache = {};
  function coachFor(p) {          // worked out once per decision, so the hint doesn't jump around while you tap
    var g = game, k = [p.id, g.phase, g.rollSeq, g.fightSeq, g.tiles.length, g.execSteps].join(':');
    if (!coachCache[p.id] || coachCache[p.id].k !== k) coachCache[p.id] = { k: k, v: window.ZTAI.coach(g, p) };
    return coachCache[p.id].v;
  }
  function pushPhones() {
    if (!net) return;
    for (var cid in clients) {
      var cl = clients[cid], p = game.byId(cl.pid);
      if (!p || !cl.conn || !cl.conn.open) continue;
      var st = phoneState(p), js = JSON.stringify(st);
      if (js === cl.lastSent) continue;
      cl.lastSent = js;
      net.send(cl.conn, st);
    }
  }

  // ------------------------------------------------------------ Philips Hue lights (optional) via the Lights Helper
  // The helper (lights-helper/ on a PC) joins the room as a non-player peer, reports the bridge's rooms/zones,
  // and turns the events we send into light effects. Without it nothing here does anything.
  var lights = { conn: null, seen: 0, st: null, enabled: false, selected: [], adopted: false, prefsRev: null };
  function lightsAvailable() { return !!(lights.conn && lights.conn.open && lights.st && lights.st.ok); }
  function lightsOn() { return lightsAvailable() && lights.enabled && lights.selected.length > 0; }
  function lightsSend(m) { if (net && lights.conn && lights.conn.open) net.send(lights.conn, m); }
  function inGame() { return game.phase !== 'lobby' && game.phase !== 'over'; }
  function lightFx(k, d) { if (!lightsOn()) return; var m = d || {}; m.t = 'fx'; m.k = k; lightsSend(m); }
  function lightsSync() {
    lightsSend({ t: 'lights-config', enabled: lights.enabled && lightsAvailable(), selected: lights.selected });
    if (lightsOn() && inGame()) {                       // switched on (or helper rejoined) mid-game
      lightFx('start');
      var cur = game.curP && game.curP();
      if (cur) lightFx('turn', { color: cur.color, zombie: cur.status === 'zombie' });
    }
    dirty = true; phoneDirty = true;
  }
  function setLights(enabled, selected) {
    var ids = (lights.st && lights.st.groups || []).map(function (g) { return g.id; });
    lights.enabled = !!enabled;
    lights.selected = (selected || []).map(String).filter(function (id) { return ids.indexOf(id) !== -1; });
    lightsSync();
  }
  function hueIntent(m) {
    if (!lightsAvailable()) return;
    if (typeof m.enabled === 'boolean') setLights(m.enabled, lights.selected);
    if (m.toggle != null && game.phase === 'lobby') {
      var id = String(m.toggle), sel = lights.selected.slice(), i = sel.indexOf(id);
      if (i === -1) sel.push(id); else sel.splice(i, 1);
      setLights(lights.enabled, sel);
    }
    if (m.test) lightsSend({ t: 'lights-test', groups: lights.selected.length ? lights.selected : [] });
  }
  function onLightsMessage(conn, m) {
    if (m.t === 'hello') {
      if (lights.conn && lights.conn !== conn) try { lights.conn.close(); } catch (e) {}
      conn._lights = true; lights.conn = conn; lights.seen = Date.now(); lights.st = null;
      net.send(conn, { t: 'lights-welcome', room: net.code, fx: C.hue });
      dirty = true; phoneDirty = true;
      return;
    }
    if (conn !== lights.conn) return;
    lights.seen = Date.now();
    if (m.t === 'ping') { net.send(conn, { t: 'pong' }); return; }
    if (m.t === 'lights-status') {
      var first = !lights.st;
      lights.st = {
        ok: !!m.ok, paired: !!m.paired, reachable: !!m.reachable, mock: !!m.mock, error: String(m.error || '').slice(0, 160),
        bridge: m.bridge && m.bridge.name ? String(m.bridge.name).slice(0, 40) : 'Hue bridge', pairing: m.pairing,
        groups: (Array.isArray(m.groups) ? m.groups : []).slice(0, 40).map(function (g) { return { id: String(g.id), name: String(g.name).slice(0, 32), type: g.type === 'Zone' ? 'Zone' : 'Room', lights: +g.lights || 0 }; })
      };
      var rev = m.prefs && typeof m.prefs.rev === 'number' ? m.prefs.rev : null;
      if (first) {
        if (!lights.adopted && m.remembered) { lights.adopted = true; setLights(!!m.remembered.enabled, m.remembered.selected || []); }
        else if (rev !== null && lights.prefsRev != null && rev !== lights.prefsRev) setLights(!!m.prefs.enabled, m.prefs.selected || []);
        else setLights(lights.enabled, lights.selected);
      } else if (rev !== null && rev !== lights.prefsRev) {
        setLights(!!m.prefs.enabled, m.prefs.selected || []);   // lights were chosen on the helper page itself
      }
      if (rev !== null) lights.prefsRev = rev;
      dirty = true; phoneDirty = true;
    }
  }
  function lightsForEvent(type, d, p) {
    if (!lightsOn()) return;
    switch (type) {
      case 'start': lightFx('start'); break;
      case 'turn': if (p) lightFx('turn', { color: p.color, zombie: p.status === 'zombie' }); break;
      case 'roll': lightFx('roll'); break;
      case 'fightStart': lightFx('fight', { style: fightStyle, color: p ? p.color : '#ffffff' }); break;
      case 'fightRoll': lightFx('fightRoll'); break;
      case 'fightResult': var f = game.fight || {}; lightFx('fightResult', { lost: f.lost || 0, zdead: !!f.zdead }); break;
      case 'death': lightFx('crunch'); break;
      case 'snare': lightFx('fightResult', { zdead: true }); break;      // same bright burst as a zombie kill
      case 'boom': lightFx('boom', { color: '#ff7a00' }); break;          // orange blast (Lights Helper v0.4+)
      case 'rise': lightFx('rise'); break;
      case 'escape': lightFx('escape', { color: p ? p.color : '#ffd65a' }); break;
      case 'pickup': lightFx('pickup', { color: d.kind === 'heart' ? '#ff6b88' : '#ffd65a' }); break;
      case 'draw': if (d.tpl === 'helipad') lightFx('helipad'); break;
      case 'gate': if (!d.yes) lightFx('gateNo'); break;
      case 'lunge': lightFx('lunge'); break;
      case 'over': lightFx('over', { escaped: (game.results || []).some(function (r) { return r.escaped; }) }); break;
    }
  }
  function hueView(p) {
    if (!lights.conn || !lights.st) return null;
    var st = lights.st;
    return { ok: st.ok, msg: st.ok ? '' : hueProblem(st), bridge: st.bridge, mock: st.mock, enabled: lights.enabled, selected: lights.selected,
      groups: st.ok ? st.groups : [], canEdit: vip() === p };
  }
  function hueProblem(st) {
    if (!st.reachable) return st.error || 'The helper cannot reach the Hue bridge.';
    if (!st.paired) return st.pairing === 'waiting' ? 'Pairing: press the button on the Hue bridge now.' : 'The helper is not paired with the bridge yet (run pair-hue-bridge.bat on the PC).';
    if (!st.groups.length) return st.error || 'No rooms or zones found on the bridge.';
    return st.error || 'Hue not ready.';
  }
  function renderHuePanel() {
    var el = $('huePanel'), st = lights.st;
    var code = net && net.status === 'online' ? net.code : '';
    if (!lights.conn) {
      el.className = 'hue-panel off';
      el.innerHTML = '<span class="bulb">\uD83D\uDCA1</span><span>Philips Hue lights (optional): lights helper not found. Start the <b>Lights Helper</b> on your PC' + (code ? ' and connect it to room <b>' + code + '</b>' : '') + '.</span>';
      return;
    }
    if (!st) { el.className = 'hue-panel'; el.innerHTML = '<span class="bulb">\uD83D\uDCA1</span><span>Lights helper connected. Checking the Hue bridge&hellip;</span>'; return; }
    if (!st.ok) { el.className = 'hue-panel warn'; el.innerHTML = '<span class="bulb">\uD83D\uDCA1</span><span>Lights helper connected, but: ' + esc(hueProblem(st)) + '</span>'; return; }
    var key = JSON.stringify([lights.enabled, lights.selected, st.groups, st.bridge]);
    if (el._key === key) return;               // don't rebuild while someone is clicking
    el._key = key;
    el.className = 'hue-panel ok';
    var h = '<div class="hue-q"><span class="bulb">\uD83D\uDCA1</span><span>Philips Hue found' + (st.mock ? ' (mock bridge)' : '') + '. <b>Use lights in this game?</b></span>' +
      '<button class="hb' + (lights.enabled ? ' on' : '') + '" data-hue="on">YES</button><button class="hb' + (!lights.enabled ? ' on' : '') + '" data-hue="off">NO</button></div>';
    if (lights.enabled) {
      h += '<div class="hue-rooms">' + st.groups.map(function (g) {
        var on = lights.selected.indexOf(g.id) !== -1;
        return '<button class="hroom' + (on ? ' on' : '') + '" data-g="' + esc(g.id) + '" aria-pressed="' + on + '"><span class="box">' + (on ? '\u2714' : '') + '</span>' + esc(g.name) + '<small>' + (g.type === 'Zone' ? 'zone' : 'room') + ' \u00b7 ' + g.lights + '</small></button>';
      }).join('') + '<button class="htest" data-hue="test"' + (lights.selected.length ? '' : ' disabled') + '>Flash ticked</button></div>' +
        (lights.selected.length ? '' : '<div class="hue-note">Tick the rooms that should join the game.</div>');
    }
    el.innerHTML = h;
  }
  $('huePanel').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var v = b.getAttribute('data-hue'), g = b.getAttribute('data-g');
    if (v === 'on' || v === 'off') hueIntent({ enabled: v === 'on' });
    else if (v === 'test') hueIntent({ test: true });
    else if (g) hueIntent({ toggle: g });
    b.blur();
  });

  // ------------------------------------------------------------ misc
  var wake = null;
  function requestWake() { try { if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {}); } catch (e) {} }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && game.phase !== 'lobby') { wake = null; requestWake(); } });

  // boot
  if (location.protocol === 'file:') $('backLink').hidden = true;
  if (window.matchMedia && matchMedia('(max-width: 760px) and (pointer: coarse)').matches) $('phoneHint').hidden = false;
  layout();
  if (!NONET) net = new window.ZTNet.Host({ code: Q.get('room') ? Q.get('room').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) : null, onStatus: setNetUi, onMessage: onPhoneMessage, onClose: onPhoneClose });
  else setNetUi('offline', null, 'phones disabled with ?nonet');
  var hs = +Q.get('hotseat');
  if (hs > 0) { var names = ['Maya', 'Leo', 'Ava', 'Sam']; for (var i = 0; i < Math.min(hs, 4); i++) { hsDice = i; addHotseat(names[i]); } }
  if (Q.get('ai')) {                   // ?ai=3 or ?ai=fighter:ruthless,looter:easy
    var spec = Q.get('ai');
    if (/^\d+$/.test(spec)) { for (var j = 0; j < Math.min(+spec, C.maxPlayers); j++) addAI(AIC.order[j % AIC.order.length], 'normal'); }
    else spec.split(',').forEach(function (x) { var pr = x.split(':'); addAI(AIC.personas[pr[0]] ? pr[0] : null, AIC.levels[pr[1]] ? pr[1] : 'normal'); });
  }
  if (Q.has('autostart') && game.players.length) startGame();
  window.ZT.startGame = startGame; window.ZT.addHotseat = addHotseat; window.ZT.addAI = addAI; window.ZT.sfx = SFX; window.ZT.net = function () { return net; };
  window.ZT.lights = function () { return lights; }; window.ZT.hue = hueIntent;
  requestAnimationFrame(loop);
})();
