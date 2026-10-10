/* ZERO TO PHI CAFE - shared config, storage and helpers.
   Storage is behind CafeStore so a Firebase/Supabase account backend can replace localStorage later:
   implement the same async methods (loadConfig, saveConfig, getScores, addScore, resetScores, addFeedback). */
(function (root) {
  'use strict';
  var VERSION = '0.1';
  root.LR_CONFIG = { peerPrefix: 'ztp-cafe-v01-', iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
  var TABLE_PREFIX = 'ztp-cafe-tbl-v01-';
  var BASE = 'https://amazingjustinlewis-web.github.io/cafe/';
  var GAMES = [
    { id: 'battleship', name: 'Battleship', icon: '\u2693', blurb: 'Sink the fleet. Solo or at your table.', ready: true, tv: false },
    { id: 'connect4', name: 'Connect Four', icon: '\uD83D\uDD34', blurb: 'Four in a row. On the big TV or your phone.', ready: true, tv: true },
    { id: 'pegs', name: 'Peg Puzzle', icon: '\uD83D\uDD3A', blurb: 'The triangle peg classic.', ready: false },
    { id: 'checkers', name: 'Checkers', icon: '\u26AA', blurb: 'Crown your kings.', ready: false },
    { id: 'wordwheel', name: 'Word Wheel', icon: '\uD83C\uDFA1', blurb: 'Spin and guess the phrase.', ready: false },
    { id: 'arcade', name: 'Bean Dash', icon: '\uD83D\uDC7E', blurb: 'A quick arcade round.', ready: false },
    { id: 'chess', name: 'Chess', icon: '\u265F', blurb: 'The long game.', ready: false },
    { id: 'hangman', name: 'Hangman', icon: '\uD83D\uDD24', blurb: 'Guess before the cup spills.', ready: false }
  ];
  function defaults() {
    return { v: 1, name: 'My Caf\u00e9', logo: '', accent: '#e07a3f', accent2: '#2f6f5e', bg: '#fbf3e6',
      games: { battleship: true, connect4: true }, menu: [], specials: [], promos: [], promoRewards: true, leaderboards: true, scoreEpoch: 1 };
  }
  function demo() {
    var c = defaults();
    c.name = 'The Daily Grind'; c.accent = '#c8682f'; c.accent2 = '#2f6f5e'; c.bg = '#fbf3e6';
    c.menu = [
      ['Espresso', '3.25', 'Coffee'], ['Americano', '3.75', 'Coffee'], ['Latte', '5.25', 'Coffee'], ['Cappuccino', '4.95', 'Coffee'],
      ['Mocha', '5.75', 'Coffee'], ['Golden Bean', '', 'Special'], ['Flat White', '4.95', 'Coffee'], ['Cold Brew', '4.50', 'Cold'],
      ['Chai Latte', '5.25', 'Tea'], ['London Fog', '5.25', 'Tea'], ['Matcha', '5.50', 'Tea'], ['Hot Chocolate', '4.25', 'Kids'],
      ['Butter Croissant', '3.95', 'Bakery'], ['Blueberry Muffin', '3.75', 'Bakery'], ['Cinnamon Bun', '4.50', 'Bakery'], ['Golden Bean', '', 'Special'],
      ['Breakfast Wrap', '8.95', 'Kitchen'], ['Avocado Toast', '9.50', 'Kitchen'], ['Soup of the Day', '6.95', 'Kitchen'], ['Grilled Cheese', '7.95', 'Kitchen']
    ].map(function (r) { return { name: r[0], price: r[1], cat: r[2] }; });
    c.specials = ['Pumpkin Spice Latte is back! \uD83C\uDF83', 'Fresh cinnamon buns every morning at 8', 'Tuesday: buy 9 coffees, the 10th is on us'];
    c.promos = [{ text: '10% off a latte', on: true }, { text: 'Free cookie with any drink', on: true }];
    return c;
  }
  function merge(c) { var d = defaults(); c = c || {}; for (var k in d) if (!(k in c)) c[k] = d[k]; return c; }

  // ---- shareable encoding: deflate-raw + base64url when available, plain base64url (prefix "b") otherwise
  function b64u(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function pipe(bytes, Stream) { return new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function encode(cfg) {
    var raw = new TextEncoder().encode(JSON.stringify(cfg));
    if (typeof CompressionStream === 'function') return pipe(raw, CompressionStream).then(function (z) { return 'z' + b64u(z); });
    return Promise.resolve('b' + b64u(raw));
  }
  function decode(s) {
    try {
      if (!s) return Promise.resolve(null);
      var kind = s[0], bytes = unb64u(s.slice(1));
      var p = kind === 'z' ? pipe(bytes, DecompressionStream) : Promise.resolve(bytes);
      return p.then(function (b) { return merge(JSON.parse(new TextDecoder().decode(b))); }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function cfgFromHash() { var m = /[#&]c=([^&]+)/.exec(location.hash); return decode(m ? m[1] : ''); }

  // ---- storage backend (localStorage today)
  function key(cfg, k) { return 'ztpcafe:' + k + ':' + (cfg && cfg.name || 'cafe').toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
  function jget(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  var LocalBackend = {
    loadConfig: function () { return Promise.resolve(jget('ztpcafe:config', null)); },
    saveConfig: function (c) { return Promise.resolve(jset('ztpcafe:config', c)); },
    getScores: function (cfg) { var s = jget(key(cfg, 'scores'), { epoch: cfg.scoreEpoch, list: [] }); if (s.epoch !== cfg.scoreEpoch) s = { epoch: cfg.scoreEpoch, list: [] }; return Promise.resolve(s.list); },
    addScore: function (cfg, e) { return this.getScores(cfg).then(function (l) { l.push(e); if (l.length > 400) l = l.slice(-400); jset(key(cfg, 'scores'), { epoch: cfg.scoreEpoch, list: l }); return l; }); },
    resetScores: function (cfg) { jset(key(cfg, 'scores'), { epoch: cfg.scoreEpoch, list: [] }); return Promise.resolve(); },
    addFeedback: function (f) { var l = jget('ztpcafe:feedback', []); l.push(f); jset('ztpcafe:feedback', l); return Promise.resolve(l.length); }
  };

  // leaderboard: per game, best by wins then fewest moves
  function board(list, game) {
    var by = {};
    list.filter(function (e) { return e.game === game; }).forEach(function (e) {
      var p = by[e.name] || (by[e.name] = { name: e.name, wins: 0, plays: 0, best: 0 });
      p.plays++; if (e.win) { p.wins++; if (e.moves && (!p.best || e.moves < p.best)) p.best = e.moves; }
    });
    return Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.wins - a.wins || (a.best || 999) - (b.best || 999); }).slice(0, 5);
  }
  function activePromos(cfg) { return (cfg.promos || []).filter(function (p) { return p.on !== false && p.text; }); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function qrSvg(text, cell) { try { var q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell || 6, margin: 2, scalable: true }); } catch (e) { return ''; } }
  function applyTheme(cfg) { var r = document.documentElement.style; r.setProperty('--accent', cfg.accent); r.setProperty('--accent2', cfg.accent2); r.setProperty('--bg', cfg.bg); }
  function base() { return /^https?:/.test(location.protocol) && location.host ? location.href.replace(/[^/]*([?#].*)?$/, '') : BASE; }

  root.Cafe = { VERSION: VERSION, GAMES: GAMES, TABLE_PREFIX: TABLE_PREFIX, defaults: defaults, demo: demo, merge: merge, encode: encode, decode: decode,
    cfgFromHash: cfgFromHash, store: LocalBackend, board: board, activePromos: activePromos, esc: esc, qrSvg: qrSvg, applyTheme: applyTheme, base: base,
    EMAIL: 'amazingjustinlewis@gmail.com', LEARN: 'https://amazingjustinlewis-web.github.io/business.html' };
})(window);
