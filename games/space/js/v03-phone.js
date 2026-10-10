/* DRIFT SIGNAL v0.3 phone: targeting list, trade screen (drag cargo into an offer), sandworm escape card, restart. */
(function () {
  'use strict';
  var C = window.SPACE_CONFIG, IT = C.items, $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var S = null, give = [], take = [], rev = -1, drag = null, keys = {};
  function act(a) { window.DS.act(a); }
  function owns(st) { return S && S.asg[st] === window.DS.me(); }
  function setHTML(id, html) { if (keys[id] === html) return; keys[id] = html; $(id).innerHTML = html; }
  function tile(id, idx, zone, used) { var it = IT[id] || { icon: '?', name: id, v: 0 }; return '<div class="tile v' + (used ? ' used' : '') + '" data-zone="' + zone + '" data-i="' + idx + '"><span>' + it.icon + '</span><small>' + esc(it.name) + '</small><i>' + it.v + '</i></div>'; }
  window.DS_v03 = function (st) {
    S = st; var x = S.x3; if (!x) return;
    // ---- targeting (Tactical)
    setHTML('tgtList', x.targets.length ? x.targets.map(function (t) { return '<button data-lock="' + esc(t.id) + '" class="' + t.k + (x.lock === t.id ? ' lk' : '') + '"><span>' + (x.lock === t.id ? '\u25CE ' : '') + esc(t.n) + '</span><small>' + (t.d >= 1000 ? (t.d / 1000).toFixed(1) + 'k' : t.d) + (t.k === 'hostile' ? ' \u00B7 hostile' : t.k === 'friendly' ? ' \u00B7 friendly' : '') + '</small></button>'; }).join('') : '<p class="small">No contacts close enough to lock.</p>');
    $('torpBtn').textContent = 'Fire torpedo (' + x.torps + ')'; $('torpBtn').disabled = !x.torps;
    // ---- helm: cave + lift-off from the dunes
    $('caveBtn').classList.toggle('on', !!x.cave && x.cave !== 'gone'); $('caveBtn').textContent = x.cave === 'inside' || x.cave === 'turn' ? 'Leave the cave' : x.cave && x.cave !== 'gone' ? 'Cave: ' + x.cave : 'Asteroid cave';
    if (S.ship.loc === 'dunes') { $('landBox').hidden = false; $('lLift').disabled = !!(x.worm && x.worm.attack); $('lDescend').disabled = true; }
    // ---- comms: trade
    $('tradeBtn').disabled = !x.traderNear; $('tradeBtn').textContent = x.traderNear ? 'Trade with ' + x.traderNear.replace(/^Freighter /, '') : 'Trade (fly near a trader)';
    var T = x.trade, showT = !!T && owns('com');
    $('tradeSheet').hidden = !showT;
    if (showT) {
      if (T.rev !== rev) { rev = T.rev; give = []; take = []; }
      give = give.filter(function (i) { return i < T.mine.length; }); take = take.filter(function (i) { return i < T.theirs.length; });
      $('trName').textContent = '\u21C4 ' + T.name; $('trMsg').textContent = '\u201C' + T.msg + '\u201D'; $('trMsg').className = 'ts-msg ' + (T.mood === 'no' ? 'no' : T.mood === 'counter' ? 'counter' : '');
      $('trCounterRow').hidden = !T.counter;
      if (!drag) renderTrade(T);
    }
    // ---- sandworm escape: on every phone
    var Wm = x.worm, inW = !!(Wm && Wm.attack && /lunge|shield|close|held/.test(Wm.attack));
    $('wormSheet').hidden = !inW;
    if (inW) { $('wormText').textContent = (Wm.attack === 'shield' ? 'Shields are fighting it!' : Wm.attack === 'lunge' ? 'It is lunging at us!' : 'It is on the hull and the glass is cracking.') + ' Worm ' + Wm.hp + '% \u00B7 ' + Wm.left + ' s left'; $('wormTorp').textContent = '\u2738 Fire torpedo (' + x.torps + ')'; $('wormTorp').disabled = !x.torps; }
    var O = x.over; $('overSheet').hidden = !O;
    if (O) $('overText').innerHTML = 'Swallowed whole on Sere Khamsin.<br><small>' + O.mins + ' min aboard \u00B7 ' + (O.dist / 1000).toFixed(1) + 'k km \u00B7 ' + O.trades + ' trades \u00B7 ' + O.torps + ' torpedoes \u00B7 ' + O.worms + ' worms escaped</small>';
  };
  function renderTrade(T) {
    setHTML('trTheirs', T.theirs.map(function (id, i) { return tile(id, i, 'theirs', take.indexOf(i) >= 0); }).join(''));
    setHTML('trMine', T.mine.map(function (id, i) { return tile(id, i, 'mine', give.indexOf(i) >= 0); }).join(''));
    setHTML('trTake', take.map(function (i) { return tile(T.theirs[i], i, 'take'); }).join(''));
    setHTML('trGive', give.map(function (i) { return tile(T.mine[i], i, 'give'); }).join(''));
    var gv = give.reduce(function (s, i) { return s + IT[T.mine[i]].v; }, 0), tv = take.reduce(function (s, i) { return s + IT[T.theirs[i]].v; }, 0);
    $('trVal').textContent = give.length || take.length ? 'Fair value: you give ' + gv + ' \u00B7 you get ' + tv + '. Traders see value their own way.' : 'Drag cargo into the offer, or tap a tile.';
    $('trPropose').disabled = !give.length && !take.length;
  }
  // move a tile between zones
  function move(from, i, to) {
    if (from === 'mine' && (to === 'give' || to === 'tap')) { if (give.indexOf(i) < 0) give.push(i); }
    else if (from === 'theirs' && (to === 'take' || to === 'tap')) { if (take.indexOf(i) < 0) take.push(i); }
    else if (from === 'give' && to !== 'give') give = give.filter(function (q) { return q !== i; });
    else if (from === 'take' && to !== 'take') take = take.filter(function (q) { return q !== i; });
    if (S && S.x3 && S.x3.trade) renderTrade(S.x3.trade);
    try { navigator.vibrate && navigator.vibrate(10); } catch (e) {}
  }
  var sheet = $('tradeSheet');
  sheet.addEventListener('pointerdown', function (e) {
    var t = e.target.closest('.tile'); if (!t || t.classList.contains('used')) return;
    var r = t.getBoundingClientRect(); drag = { el: t, zone: t.dataset.zone, i: +t.dataset.i, x0: e.clientX, y0: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, ghost: null, id: e.pointerId };
    try { t.setPointerCapture(e.pointerId); } catch (er) {}
  });
  sheet.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.ghost && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 8) { drag.ghost = drag.el.cloneNode(true); drag.ghost.classList.add('ghost'); document.body.appendChild(drag.ghost); }
    if (drag.ghost) { drag.ghost.style.left = (e.clientX - drag.ox) + 'px'; drag.ghost.style.top = (e.clientY - drag.oy) + 'px'; var z = zoneAt(e.clientX, e.clientY); $('ozGive').classList.toggle('hot', z === 'give'); $('ozTake').classList.toggle('hot', z === 'take'); e.preventDefault(); }
  });
  function zoneAt(x, y) { var el = document.elementFromPoint(x, y), z = el && el.closest('[data-zone]'); if (!z) return null; if (z.classList.contains('tile')) z = z.parentElement.closest('[data-zone]') || z.parentElement; var id = z.id; return id === 'ozGive' || id === 'trGive' ? 'give' : id === 'ozTake' || id === 'trTake' ? 'take' : id === 'trMine' ? 'mine' : id === 'trTheirs' ? 'theirs' : z.dataset.zone; }
  function end(e) {
    if (!drag || e.pointerId !== drag.id) return; var d = drag; drag = null;
    $('ozGive').classList.remove('hot'); $('ozTake').classList.remove('hot');
    if (d.ghost) { d.ghost.remove(); var z = zoneAt(e.clientX, e.clientY); if (z) move(d.zone, d.i, z); else if (S && S.x3 && S.x3.trade) renderTrade(S.x3.trade); }
    else move(d.zone, d.i, 'tap');
  }
  sheet.addEventListener('pointerup', end); sheet.addEventListener('pointercancel', function (e) { if (drag && drag.ghost) drag.ghost.remove(); drag = null; });
  $('trPropose').onclick = function () { act({ a: 'tradeOffer', give: give.slice(), take: take.slice() }); };
  $('trClear').onclick = function () { give = []; take = []; if (S && S.x3 && S.x3.trade) renderTrade(S.x3.trade); };
  $('tgtList').addEventListener('click', function (e) { var b = e.target.closest('[data-lock]'); if (b) act({ a: 'lock', id: b.dataset.lock }); });
  window.DS_trade = { give: function () { return give; }, take: function () { return take; }, move: move };
})();
