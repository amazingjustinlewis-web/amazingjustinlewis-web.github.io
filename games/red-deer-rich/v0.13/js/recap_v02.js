/* Red Deer Rich recap booth v02: v01 plus stall fix.
   Defer the show until the current move/card finishes, pause through a clock shim
   so host pauseOff stays honest, expose playing, and kick the turn when the show ends.
   Does not overwrite recap_v01.js.
   Original: selectable Recap show after a run of laps.
   Shows: The Last Few with Gary & Stu (default), UNIT 9, Here For When It Goes Wrong (Viv & June), or Off.
   Choice + lap interval (2/3/5) live in localStorage. Captions always; speech when the browser has it. */
(function (root) {
  'use strict';
  var KEY = 'rdr_recap_v01';
  var SHOWS = {
    'gary-stu': {
      id: 'gary-stu', label: 'The Last Few with Gary & Stu',
      voices: 2, names: ['GARY', 'STU'],
      colors: [{ fg: '#E2B84A', bg: '#0b0906' }, { fg: '#F6E2A0', bg: '#0b0906' }],
      pitch: [0.85, 1.12], rate: [0.95, 1.08],
      prefer: [['male', 'en'], ['male', 'en']]
    },
    'unit9': {
      id: 'unit9', label: 'UNIT 9',
      voices: 1, names: ['UNIT 9'],
      colors: [{ fg: '#8BE7FF', bg: '#071018' }],
      pitch: [0.72], rate: [0.82],
      prefer: [['male', 'en']]
    },
    'viv-june': {
      id: 'viv-june', label: 'Here For When It Goes Wrong',
      voices: 2, names: ['VIV', 'JUNE'],
      colors: [{ fg: '#FF8FAB', bg: '#1a0a12' }, { fg: '#FFC38A', bg: '#1a0a12' }],
      pitch: [1.12, 1.05], rate: [1.02, 0.98],
      prefer: [['female', 'en'], ['female', 'en']],
      disastersOnly: true
    }
  };
  var DEFAULTS = { show: 'gary-stu', laps: 3 };

  function load() {
    var s = DEFAULTS;
    try { s = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
    if (!SHOWS[s.show] && s.show !== 'off') s.show = 'gary-stu';
    if ([2, 3, 5].indexOf(+s.laps) < 0) s.laps = 3;
    s.laps = +s.laps;
    return s;
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function fill(tmpl, d) {
    return tmpl.replace(/\{(\w+)\}/g, function (_, k) { return d[k] != null ? d[k] : ''; });
  }

  /* ---------- classify a slice of the official game log ---------- */
  function classify(entries) {
    var ev = { buys: [], auctions: [], failedAuctions: [], rents: [], slips: [], busts: [], snow: [], smacks: [], heckles: [], gold: [], builds: [], halfway: [], deals: [], other: [], disasters: 0 };
    (entries || []).forEach(function (e) {
      var s = (e && e.s) || e || '';
      var m;
      if ((m = s.match(/^(.+?) bought (.+?) for (\$.+)$/))) ev.buys.push({ name: m[1], place: m[2], amount: m[3], s: s });
      else if ((m = s.match(/^(.+?) won (.+?) at auction for (\$.+)\.$/))) ev.auctions.push({ name: m[1], place: m[2], amount: m[3], s: s });
      else if (/^No sale: the bank keeps /.test(s)) { ev.failedAuctions.push({ s: s, place: s.replace(/^No sale: the bank keeps /, '').replace(/\.$/, '') }); ev.disasters++; }
      else if ((m = s.match(/^PAY UP! (.+?) caught (.+?) on (.+?) for (\$.+)\.$/))) { ev.rents.push({ name: m[1], other: m[2], place: m[3], amount: m[4], s: s }); ev.disasters++; }
      else if ((m = s.match(/^(.+?) slipped away from (.+?)'s (.+?)!$/))) ev.slips.push({ name: m[1], other: m[2], place: m[3], s: s });
      else if ((m = s.match(/^(.+?) went BUST(.*)$/))) { ev.busts.push({ name: m[1], s: s }); ev.disasters++; }
      else if (/SNOWBANK|WHITEOUT|hit the ditch|still stuck in the Snowbank/i.test(s)) { ev.snow.push({ s: s }); ev.disasters++; }
      else if (/smack/i.test(s)) { ev.smacks.push({ s: s }); ev.disasters++; }
      else if (/heckle/i.test(s)) ev.heckles.push({ s: s });
      else if ((m = s.match(/^(.+?) went FULL GOLD!$/))) ev.gold.push({ name: m[1], s: s });
      else if ((m = s.match(/^(.+?) built (.+) on (.+)$/))) ev.builds.push({ name: m[1], what: m[2], place: m[3], s: s });
      else if (/THE HALFWAY/.test(s)) ev.halfway.push({ s: s });
      else if (/A deal went down/.test(s)) ev.deals.push({ s: s });
      else ev.other.push({ s: s });
    });
    return ev;
  }

  function standings(game) {
    if (!game || !game.players) return [];
    return game.players.filter(function (p) { return !p.bankrupt; }).map(function (p) {
      return { name: p.name, w: game.worthOf ? game.worthOf(p) : (p.cash || 0), laps: p.laps || 0, cash: p.cash || 0 };
    }).sort(function (a, b) { return b.w - a.w; });
  }

  /* ---------- line banks (no brand names; family-friendly; varied) ---------- */
  var USED = {};
  function take(show, bank, d) {
    var key = show + ':' + bank.id, used = USED[key] || [];
    var pool = bank.lines.filter(function (t) { return used.indexOf(t) < 0; });
    if (!pool.length) { used = []; pool = bank.lines.slice(); }
    var t = pick(pool);
    used.push(t);
    USED[key] = used;
    return fill(t, d);
  }

  var BANKS = {
    'gary-stu': {
      open: [
        { who: 0, t: "Welcome back to The Last Few, I'm Gary." },
        { who: 1, t: "And I'm Stu." }
      ],
      buy: { id: 'buy', lines: [
        '{name} just dropped {amount} on {place}. That is a statement buy.',
        'Big swing from {name}: {place} is theirs for {amount}.',
        '{place} sold, {name} wrote a cheque for {amount}. I like the confidence.',
        '{name} snatched {place} at {amount}. Somebody came to play.'
      ]},
      auction: { id: 'auc', lines: [
        'Auction room was spicy. {name} walked out with {place} for {amount}.',
        '{name} won {place} at auction, {amount}. Stu, that was a fight.',
        '{place} went to {name} for {amount}. I would have gone one more bid. Maybe.'
      ]},
      failAuc: { id: 'fauc', lines: [
        'Nobody wanted {place}. The bank shrugged and kept it.',
        'Auction for {place} went quiet. That deed is still sitting there.'
      ]},
      rent: { id: 'rent', lines: [
        'PAY UP! {name} caught {other} on {place} for {amount}. Beautiful timing.',
        '{other} landed on {place} and {name} was already there with a hand out for {amount}.',
        '{amount} changed hands on {place}. {name} is eating well. {other} is not.'
      ]},
      slip: { id: 'slip', lines: [
        '{name} slipped off {place} before {other} could collect. That is luck, or practice.',
        'Almost a payday for {other}, but {name} got away from {place}.'
      ]},
      bust: { id: 'bust', lines: [
        'Tough one: {name} went bust. The table just got quieter.',
        '{name} is out. Hats off, that run was a ride.'
      ]},
      snow: { id: 'snow', lines: [
        'Somebody found the ditch. The Snowbank is doing Snowbank things.',
        'Whiteout on the board. Hope they packed a tow.',
        'Still stuck in the snow. I have been there. Not literally. Well, maybe.'
      ]},
      smack: { id: 'smack', lines: [
        'There was a smack in traffic. Pure theatre, no harm done.',
        'Someone got a friendly head smack on the way past. The crowd loves it.'
      ]},
      lead: { id: 'lead', lines: [
        '{name} is out in front, about {amount} on the table.',
        'If you are keeping score at home, {name} is leading this thing.',
        'Standings check: {name} on top, {other} is right behind them.'
      ]},
      slipst: { id: 'slipst', lines: [
        '{name} has some catching up to do.',
        'The back of the pack is feeling it. Come on, {name}.'
      ]},
      build: { id: 'build', lines: [
        '{name} put {what} on {place}. Rent just got ruder.',
        'Construction on {place}: {name} is building. I would not land there.'
      ]},
      gold: { id: 'gold', lines: [
        '{name} went full gold. That is a look.',
        'Gold status for {name}. The board notices.'
      ]},
      half: { id: 'half', lines: [
        'A few trips past The Halfway, wallets got a little fatter.',
        'Laps are stacking up. The Halfway keeps paying out.'
      ]},
      filler: { id: 'fill', lines: [
        'Quiet stretch, then a pile-up. Classic Red Deer evening.',
        'I have coffee, I have notes, I have opinions about every deed on this ring.',
        'We will be here when it gets loud again. Stay with us.'
      ]}
    },
    'unit9': {
      open: [
        { who: 0, t: 'Unit 9 recap. Interval complete. Summarising.' }
      ],
      buy: { id: 'buy', lines: [
        'Purchase logged. {name}. {place}. {amount}. Efficiency: acceptable.',
        '{name} acquired {place} for {amount}. Noted.'
      ]},
      auction: { id: 'auc', lines: [
        'Auction resolved. Winner: {name}. Asset: {place}. Price: {amount}.',
        '{place} transferred to {name} at auction, {amount}.'
      ]},
      failAuc: { id: 'fauc', lines: [
        'Auction failed. {place} remains with the bank. Demand: insufficient.'
      ]},
      rent: { id: 'rent', lines: [
        'Rent event. Collector {name}. Payer {other}. {place}. {amount}.',
        'Catch confirmed on {place}. {amount} moved to {name}.'
      ]},
      slip: { id: 'slip', lines: [
        'Collection missed. {name} vacated {place} before {other} could complete the transfer.'
      ]},
      bust: { id: 'bust', lines: [
        'Player {name} is insolvent. Seat status: out.',
        '{name} has exited the economy of this board.'
      ]},
      snow: { id: 'snow', lines: [
        'Snowbank incident recorded. Mobility: reduced.',
        'Whiteout protocol. Tow options remain available.'
      ]},
      smack: { id: 'smack', lines: [
        'Cosmetic contact detected. No rules violation. Theatre: high.'
      ]},
      lead: { id: 'lead', lines: [
        'Current leader: {name}. Approximate net: {amount}.',
        'Standing update. First: {name}. Second: {other}.'
      ]},
      slipst: { id: 'slipst', lines: [
        '{name} is trailing. Recovery is statistically possible.'
      ]},
      build: { id: 'build', lines: [
        'Construction: {name} added {what} to {place}. Rent multiplier up.'
      ]},
      gold: { id: 'gold', lines: [
        '{name} reached gold state. Cosmetic, but noted.'
      ]},
      half: { id: 'half', lines: [
        'Halfway crossings in this interval: several. Cash was distributed.'
      ]},
      filler: { id: 'fill', lines: [
        'No further anomalies. Resuming play.',
        'Interval recap complete.'
      ]}
    },
    'viv-june': {
      open: [
        { who: 0, t: "We're just here for when it goes wrong." },
        { who: 1, t: "And it did. Hi, I'm June." }
      ],
      buy: { id: 'buy', lines: [ '{name} spent {amount} on {place}. Brave, or a setup for later pain.' ]},
      auction: { id: 'auc', lines: [ '{name} fought for {place} at {amount}. Hope it does not haunt them.' ]},
      failAuc: { id: 'fauc', lines: [
        'Nobody bid on {place}. Even the bargain hunters walked away.',
        '{place} failed to sell. That is a mood.'
      ]},
      rent: { id: 'rent', lines: [
        'Oof. {other} got caught on {place} for {amount}. {name} did not blink.',
        '{amount} rent on {place}. {other}, we felt that from here.',
        'That catch on {place} was rude in the best way. {name} collected {amount}.'
      ]},
      slip: { id: 'slip', lines: [
        '{other} almost had {name} on {place}. Almost does not pay the bills.'
      ]},
      bust: { id: 'bust', lines: [
        'There it is. {name} went bust. We did say we were here for this.',
        '{name} is out. Silence for a second. Okay, that is enough silence.'
      ]},
      snow: { id: 'snow', lines: [
        'Snowbank. Called it. Someone is waiting on a tow.',
        'Whiteout! If you listen closely, that is the sound of a plan falling over.',
        'Stuck in the snow again. Pack a pass next time, friend.'
      ]},
      smack: { id: 'smack', lines: [
        'A smack on the way past. We are not proud of how much we enjoyed that.',
        'Head smack in the traffic. Comedy, officially.'
      ]},
      lead: { id: 'lead', lines: [
        '{name} is ahead, which means someone else is having a worse night.'
      ]},
      slipst: { id: 'slipst', lines: [
        '{name} is slipping. We are watching. With snacks.'
      ]},
      build: { id: 'build', lines: [
        '{name} built on {place}. Future disasters now have a nicer building to happen in.'
      ]},
      gold: { id: 'gold', lines: [ '{name} went gold. Give it time.' ]},
      half: { id: 'half', lines: [ 'They keep going around. That is how you find trouble.' ]},
      filler: { id: 'fill', lines: [
        'We will be quiet until it breaks again. Do not keep us waiting long.',
        'That is our kind of recap. Back to the mess.'
      ]}
    }
  };

  function facts(ev, game) {
    var st = standings(game), d = { name: 'someone', other: 'someone', place: 'a deed', amount: 'cash', what: 'a Shop' };
    if (ev.buys[0]) Object.assign(d, ev.buys[0]);
    else if (ev.auctions[0]) Object.assign(d, ev.auctions[0]);
    else if (ev.rents[0]) Object.assign(d, ev.rents[0]);
    else if (ev.busts[0]) Object.assign(d, ev.busts[0]);
    if (st[0]) { if (!ev.buys[0] && !ev.auctions[0] && !ev.rents[0]) d.name = st[0].name; d.amount = d.amount && d.amount[0] === '$' ? d.amount : '$' + Math.round(st[0].w).toLocaleString('en-US'); }
    if (st[1]) d.other = d.other && d.other !== 'someone' ? d.other : st[1].name;
    if (st.length > 1 && ev.rents[0]) { /* keep */ }
    else if (st[st.length - 1] && st.length > 1) { /* trailing name used in slipst */ }
    return { d: d, st: st };
  }

  function scriptFor(showId, ev, game) {
    var banks = BANKS[showId], show = SHOWS[showId], lines = [];
    if (!banks) return lines;
    banks.open.forEach(function (o) { lines.push({ who: o.who, text: o.t }); });
    var f = facts(ev, game), d = f.d, st = f.st, n = 0, max = 4 + ((Math.random() * 3) | 0); // 4-6 body lines after opener, we'll trim to 3-6 total body
    max = 3 + ((Math.random() * 4) | 0); // 3-6 body
    function add(bank, data, whoHint) {
      if (n >= max || !bank) return;
      var who = show.voices === 1 ? 0 : (whoHint != null ? whoHint : (lines.length % show.voices));
      lines.push({ who: who, text: take(showId, bank, data || d) });
      n++;
    }
    ev.busts.forEach(function (x, i) { if (i < 2) add(banks.bust, x); });
    ev.rents.sort(function (a, b) { return (parseInt((b.amount || '').replace(/[^0-9]/g, ''), 10) || 0) - (parseInt((a.amount || '').replace(/[^0-9]/g, ''), 10) || 0); });
    ev.rents.slice(0, 2).forEach(function (x) { add(banks.rent, x); });
    ev.snow.slice(0, 1).forEach(function (x) { add(banks.snow, x); });
    ev.failedAuctions.slice(0, 1).forEach(function (x) { add(banks.failAuc, x); });
    ev.smacks.slice(0, 1).forEach(function (x) { add(banks.smack, x); });
    ev.buys.slice(0, 2).forEach(function (x) { add(banks.buy, x); });
    ev.auctions.slice(0, 1).forEach(function (x) { add(banks.auction, x); });
    ev.slips.slice(0, 1).forEach(function (x) { add(banks.slip, x); });
    ev.builds.slice(0, 1).forEach(function (x) { add(banks.build, x); });
    ev.gold.slice(0, 1).forEach(function (x) { add(banks.gold, x); });
    if (st[0]) add(banks.lead, { name: st[0].name, amount: '$' + Math.round(st[0].w).toLocaleString('en-US'), other: st[1] ? st[1].name : 'the pack' });
    if (st.length > 1) add(banks.slipst, { name: st[st.length - 1].name, amount: '$' + Math.round(st[st.length - 1].w).toLocaleString('en-US') });
    if (ev.halfway.length) add(banks.half, d);
    while (n < 3) add(banks.filler, d);
    return lines;
  }

  /* ---------- voices + captions ---------- */
  var voiceCache = {};
  function voicesFor(show) {
    var list = [];
    try { list = root.speechSynthesis ? speechSynthesis.getVoices() || [] : []; } catch (e) { list = []; }
    var en = list.filter(function (v) { return /en/i.test(v.lang || ''); });
    var pool = en.length ? en : list;
    function sex(v, want) {
      var n = ((v.name || '') + ' ' + (v.voiceURI || '')).toLowerCase();
      if (want === 'female') return /female|woman|girl|samantha|victoria|karen|moira|tessa|zira|hazel|fiona|susan|siri|linda/.test(n);
      if (want === 'male') return /male|man|daniel|david|alex|fred|tom|arthur|ravi|george|gordon|james|mark|lee/.test(n) && !/female/.test(n);
      return true;
    }
    var out = [], used = {};
    (show.prefer || []).forEach(function (pref, i) {
      var cand = pool.filter(function (v, idx) { return sex(v, pref[0]) && !used[v.name]; });
      var v = cand[i % (cand.length || 1)] || pool[i % (pool.length || 1)] || null;
      if (v) used[v.name] = 1;
      out.push(v);
    });
    return out;
  }

  var ui, speaking = false, wePaused = false, queue = [], skipFn = null;

  function ensureUi() {
    if (ui) return ui;
    var st = document.createElement('style');
    st.textContent = '#rrecS{position:fixed;right:12px;bottom:12px;z-index:9000;background:#000c;color:#E2B84A;border:2px solid #E2B84A88;border-radius:12px;padding:7px 10px;font:700 13px system-ui;cursor:pointer}' +
      '#rrecP{position:fixed;inset:0;z-index:10001;background:#000a;display:none;align-items:flex-end;justify-content:center;padding:0 4vw 8vh;font-family:system-ui,sans-serif}' +
      '#rrecP.on{display:flex}#rrecC{width:min(920px,94vw);background:#111;border:2px solid #E2B84A;border-radius:16px;padding:14px 18px 16px;color:#fff;box-shadow:0 10px 40px #000}' +
      '#rrecC .tag{display:inline-block;font:800 13px/1 system-ui;letter-spacing:.12em;padding:5px 9px;border-radius:8px;margin-bottom:8px}' +
      '#rrecC .line{font:600 28px/1.25 system-ui,serif;margin:0}#rrecC .skip{margin-top:10px;font:600 13px system-ui;opacity:.7}' +
      '#rrecSet{position:fixed;inset:0;z-index:10002;background:#000c;display:none;align-items:center;justify-content:center}' +
      '#rrecSet.on{display:flex}#rrecSet .box{background:#14122a;color:#fff;border-radius:16px;padding:18px;width:min(92vw,420px);font:16px system-ui}' +
      '#rrecSet h2{margin:0 0 10px;font-size:20px;color:#E2B84A}#rrecSet label{display:block;margin:8px 0 4px;opacity:.8}' +
      '#rrecSet select,#rrecSet button{width:100%;padding:10px;border-radius:10px;border:0;font:700 15px system-ui;margin:4px 0}' +
      '#rrecSet select{background:#0d0b18;color:#fff;border:1px solid #E2B84A55}#rrecSet .go{background:#E2B84A;color:#111}#rrecSet .x{background:#444;color:#fff}';
    document.head.appendChild(st);
    var b = document.createElement('button'); b.id = 'rrecS'; b.type = 'button'; b.textContent = 'Recap show';
    var cap = document.createElement('div'); cap.id = 'rrecP';
    cap.innerHTML = '<div id="rrecC"><div class="tag" id="rrecTag">GARY</div><p class="line" id="rrecLine"></p><div class="skip">Tap to skip</div></div>';
    var set = document.createElement('div'); set.id = 'rrecSet';
    set.innerHTML = '<div class="box"><h2>Recap show</h2><p style="opacity:.8;margin:0 0 8px">A short booth segment after a few laps around the board. You can turn it off any time.</p>' +
      '<label>Personality</label><select id="rrecShow"><option value="gary-stu">The Last Few with Gary &amp; Stu</option><option value="unit9">UNIT 9</option><option value="viv-june">Here For When It Goes Wrong (Viv &amp; June)</option><option value="off">Off</option></select>' +
      '<label>After how many laps?</label><select id="rrecLaps"><option value="2">2 laps</option><option value="3">3 laps</option><option value="5">5 laps</option></select>' +
      '<button class="go" id="rrecSave">Save</button><button class="x" id="rrecX">Close</button></div>';
    document.body.appendChild(b); document.body.appendChild(cap); document.body.appendChild(set);
    b.onclick = function () { var s = load(); document.getElementById('rrecShow').value = s.show; document.getElementById('rrecLaps').value = String(s.laps); set.classList.add('on'); };
    document.getElementById('rrecX').onclick = function () { set.classList.remove('on'); try { if (root.RDRWatchdog) RDRWatchdog.kick('recap-settings'); } catch (e) {} };
    document.getElementById('rrecSave').onclick = function () {
      var s = { show: document.getElementById('rrecShow').value, laps: +document.getElementById('rrecLaps').value };
      save(s); paintBtn(); set.classList.remove('on'); try { if (root.RDRWatchdog) RDRWatchdog.kick('recap-settings'); } catch (e) {}
    };
    cap.onclick = function () { if (skipFn) skipFn(); };
    ui = { btn: b, cap: cap, set: set };
    paintBtn();
    return ui;
  }
  function paintBtn() {
    var s = load();
    if (!ui) return;
    ui.btn.textContent = s.show === 'off' ? 'Recap: Off' : ('Recap: ' + (SHOWS[s.show] ? SHOWS[s.show].label.split(' with ')[0] : s.show));
  }

  function showLine(show, line) {
    ensureUi();
    var col = show.colors[line.who % show.colors.length];
    var tag = document.getElementById('rrecTag'), el = document.getElementById('rrecLine');
    tag.textContent = show.names[line.who % show.names.length];
    tag.style.color = col.fg; tag.style.background = '#000'; tag.style.border = '2px solid ' + col.fg;
    el.textContent = line.text;
    document.getElementById('rrecC').style.borderColor = col.fg;
    document.getElementById('rrecC').style.background = col.bg;
    ui.cap.classList.add('on');
  }
  function hideCap() { if (ui) ui.cap.classList.remove('on'); }

  function speakLine(show, line, cb) {
    showLine(show, line);
    var syn = root.speechSynthesis;
    if (!syn || typeof SpeechSynthesisUtterance === 'undefined') { setTimeout(cb, 2200); return; }
    try { syn.cancel(); } catch (e) {}
    var u = new SpeechSynthesisUtterance(line.text);
    var vs = voicesFor(show);
    if (vs[line.who]) u.voice = vs[line.who];
    else if (vs[0]) u.voice = vs[0];
    u.pitch = show.pitch[line.who % show.pitch.length];
    u.rate = show.rate[line.who % show.rate.length];
    u.onend = function () { cb(); };
    u.onerror = function () { cb(); };
    syn.speak(u);
    // some browsers need a kick after getVoices
    if (syn.paused) try { syn.resume(); } catch (e2) {}
  }

  function play(showId, ev, game, done) {
    var show = SHOWS[showId], lines = scriptFor(showId, ev, game);
    if (!show || !lines.length) { if (done) done([]); return; }
    ensureUi();
    speaking = true;
    root.RDRRecap.playing = true;
    var i = 0, stopped = false;
    skipFn = function () { stopped = true; try { if (root.speechSynthesis) speechSynthesis.cancel(); } catch (e) {} finish(); };
    function finish() {
      if (!speaking) return;
      speaking = false; skipFn = null; hideCap();
      root.RDRRecap.playing = false;
      if (wePaused && game && game.setPaused) { try { game.setPaused(false); } catch (e) {} }
      wePaused = false;
      if (done) done(lines);
      try { if (root.RDRWatchdog) RDRWatchdog.kick('recap-end'); } catch (e3) {}
    }
    function next() {
      if (stopped) return;
      if (i >= lines.length) { finish(); return; }
      speakLine(show, lines[i], function () { i++; next(); });
    }
    next();
    return { lines: lines, skip: skipFn };
  }

  /* ---------- watch the live game ---------- */
  var lapCount = 0, logMark = 0, armed = false;

  function sliceLog(game) {
    var log = (game && game.log) || [];
    var part = log.slice(logMark);
    logMark = log.length;
    return part;
  }

  function turnBusy(game) {
    var t = game && game.turn;
    if (!t) return false;
    return t.stage === 'rolling' || t.stage === 'moving' || t.stage === 'card' || t.stage === 'closing';
  }
  var deferT = 0;
  function maybeStart(game) {
    var s = load();
    if (s.show === 'off' || speaking) return;
    if (turnBusy(game)) {
      clearTimeout(deferT);
      deferT = setTimeout(function () { maybeStart(game); }, 400);
      return;
    }
    var ev = classify(sliceLog(game));
    if (SHOWS[s.show] && SHOWS[s.show].disastersOnly && ev.disasters === 0) return; // stay quiet
    if (game && !game.paused && game.setPaused) { wePaused = true; try { game.setPaused(true); } catch (e) { wePaused = false; } }
    play(s.show, ev, game);
  }

  function onEvent(type, d, game) {
    if (type === 'start') { lapCount = 0; logMark = (game.log || []).length; armed = true; return; }
    if (type === 'halfway') {
      lapCount++;
      var s = load();
      if (s.show !== 'off' && lapCount >= s.laps) { lapCount = 0; maybeStart(game); }
    }
  }

  function hook() {
    var g = root.RDR && RDR.game;
    if (!g || g._recapHooked) return !!g;
    g._recapHooked = true;
    if (!g.listeners) g.listeners = [];
    g.listeners.push(onEvent);
    if (g.phase === 'play') { armed = true; logMark = (g.log || []).length; }
    return true;
  }

  function boot() {
    ensureUi();
    try { if (root.speechSynthesis) speechSynthesis.getVoices(); } catch (e) {}
    if (root.speechSynthesis) speechSynthesis.addEventListener('voiceschanged', function () {});
    var n = 0, t = setInterval(function () { if (hook() || ++n > 80) clearInterval(t); }, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  root.RDRRecap = {
    load: load, save: save, SHOWS: SHOWS,
    playing: false,
    classify: classify, scriptFor: scriptFor, play: play, showLine: showLine,
    /* test helper: build lines + show the first caption from a fake log, no live game needed */
    testFromLog: function (entries, showId, game) {
      var ev = classify(entries);
      var show = showId || load().show;
      var lines = scriptFor(show, ev, game || { players: [] });
      if (lines[0] && SHOWS[show]) showLine(SHOWS[show], lines[0]);
      return { ev: ev, lines: lines, settings: load() };
    }
  };
})(window);
