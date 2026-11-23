/* Zero to Phi dev kit - AI playtest panel v0.1: simulated people.
   A persona is the "who": name, look, 0-10 stats, orientation habit, one quirk, plus a motive (why they showed up).
   The Human model below turns those stats into human timing: reaction delays with a long tail, hesitation on
   decisions, missed taps, misreads, and short "looked away" lapses. Game adapters ask it HOW and WHEN to act;
   the adapter decides WHAT to do. Nothing here knows about any one game. */
(function (root) {
  'use strict';
  var NAMES = {
    woman: ['Maya', 'Priya', 'Lena', 'Aiyana', 'Sofia', 'Hana', 'Rosa', 'Noor', 'Tessa', 'Ingrid', 'Zara', 'Mina', 'Jade', 'Keisha', 'Amara', 'Lucia'],
    man: ['Marcus', 'Theo', 'Jonah', 'Kofi', 'Mateo', 'Eli', 'Callum', 'Raj', 'Wes', 'Otis', 'Dmitri', 'Tane', 'Hugo', 'Malik', 'Sven', 'Andre'],
    nb: ['Sky', 'River', 'Ash', 'Robin', 'Quinn', 'Sage', 'Rowan', 'Kai']
  };
  var LOOKS = {
    woman: ['\uD83D\uDC69\uD83C\uDFFD', '\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDDB0', '\uD83D\uDC71\uD83C\uDFFC\u200D\u2640\uFE0F', '\uD83D\uDC69\uD83C\uDFFF', '\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDDB1', '\uD83D\uDC75\uD83C\uDFFC', '\uD83D\uDC69\uD83C\uDFFB'],
    man: ['\uD83D\uDC68\uD83C\uDFFE', '\uD83E\uDDD4\uD83C\uDFFB', '\uD83D\uDC68\uD83C\uDFFC\u200D\uD83E\uDDB1', '\uD83D\uDC71\uD83C\uDFFF\u200D\u2642\uFE0F', '\uD83D\uDC68\uD83C\uDFFD', '\uD83D\uDC74\uD83C\uDFFB', '\uD83E\uDDD4\uD83C\uDFFF'],
    nb: ['\uD83E\uDDD1\uD83C\uDFFD', '\uD83E\uDDD1\uD83C\uDFFB\u200D\uD83E\uDDB1', '\uD83E\uDDD1\uD83C\uDFFF\u200D\uD83E\uDDB2', '\uD83E\uDDD1\uD83C\uDFFC', '\uD83E\uDDD1\uD83C\uDFFE\u200D\uD83E\uDDB0']
  };
  var GENDERS = [['woman', 'Woman'], ['man', 'Man'], ['nb', 'Non-binary']];
  var ORIENT = [['portrait', 'Portrait'], ['landscape', 'Landscape'], ['switch', 'Switches mid-game']];
  var QUIRKS = {
    none:        { label: 'No quirk', blurb: 'Plays it straight' },
    secondguess: { label: 'Second-guesser', blurb: 'Hovers over decisions, sometimes changes their mind' },
    speedtap:    { label: 'Speed tapper', blurb: 'Taps before reading, fast but sloppy' },
    browser:     { label: 'Browser', blurb: 'Pokes through every tab between turns' },
    trashtalk:   { label: 'Trash-talker', blurb: 'Chats, heckles, celebrates loudly' },
    saver:       { label: 'Cautious saver', blurb: 'Hoards cash, hates risk' },
    spender:     { label: 'Big spender', blurb: 'Buys everything, bids hard' },
    distract:    { label: 'Distractible', blurb: 'Keeps checking their texts' }
  };
  var MOTIVES = ['unwinding after work', 'first time here, a friend dragged them', 'out-of-towner killing time', 'regular, knows everyone',
    'on a date', 'here to win, competitive streak', 'celebrating a birthday', 'waiting on food', 'shy, warming up slowly', 'here for the music'];
  var COLORS = ['#ffd23f', '#5ef2c8', '#ff6a9a', '#7aa8ff', '#ff9d3f', '#b98cff', '#8be36b', '#ff5a5a'];

  // seeded or plain random (seed makes a panel run repeatable)
  function rng(seed) {
    if (seed == null) return Math.random;
    var s = (+seed || 1) >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function pick(r, a) { return a[Math.floor(r() * a.length)]; }
  function stat(r) { var v = (r() + r() + r()) / 3 * 10; return Math.max(0, Math.min(10, Math.round(v + (r() - 0.5) * 3))); }   // bell-ish 0-10

  function make(i, r, used) {
    r = r || Math.random; used = used || {};
    var g = r() < 0.12 ? 'nb' : r() < 0.5 ? 'woman' : 'man', name, k = 0;
    do { name = pick(r, NAMES[g]); k++; } while (used[name] && k < 30); used[name] = 1;
    var or = r(), qk = Object.keys(QUIRKS);
    return { id: 'bot' + (i + 1), name: name, gender: g, look: pick(r, LOOKS[g]), color: COLORS[i % COLORS.length],
      skill: stat(r), smarts: stat(r), reaction: stat(r), temper: stat(r),
      orient: or < 0.55 ? 'portrait' : or < 0.8 ? 'landscape' : 'switch',
      quirk: r() < 0.25 ? 'none' : pick(r, qk.slice(1)), motive: pick(r, MOTIVES),
      prefs: {} };    // hook: per-person style sliders / hard limits (profile superhero card), used by venue + group votes later
  }
  function makeSet(n, seed, keep) {
    var r = rng(seed), used = {}, out = [];
    for (var i = 0; i < n; i++) { if (keep && keep[i]) { used[keep[i].name] = 1; out.push(keep[i]); } else out.push(make(i, r, used)); }
    return out;
  }
  function temperLabel(t) { return t <= 2 ? 'Calm' : t <= 5 ? 'Steady' : t <= 7 ? 'Lively' : 'Intense'; }

  // ------------------------------------------------------------------ the human model
  // speed() is the panel's sim speed (1, 2, 4): every human delay is divided by it.
  function Human(p, speed) {
    this.p = p; this.speed = speed || function () { return 1; };
    this.r = Math.random; this.awayUntil = 0; this.nextLapse = Date.now() + this.lapseGap();
    this.stats = { taps: 0, misses: 0, misreads: 0, decisions: 0, lapses: 0, reactSum: 0, reactN: 0 };
  }
  var H = Human.prototype;
  H.q = function (k) { return this.p.quirk === k; };
  // base reaction in ms: reaction 10 ~ 380 ms, reaction 0 ~ 1900 ms, long right tail (lognormal-ish)
  H.react = function (mult) {
    var p = this.p, base = 1900 - p.reaction * 152, tail = Math.exp((this.r() + this.r() + this.r() - 1.5) * 0.55);
    if (this.q('speedtap')) base *= 0.6; if (p.temper >= 8) base *= 0.85; if (p.temper <= 2) base *= 1.2;
    var ms = Math.max(160, base * tail * (mult || 1));
    this.stats.reactSum += ms; this.stats.reactN++;
    return ms / this.speed();
  };
  // a decision: reaction + reading/thinking time. weight 0..1 = how big the decision is
  H.think = function (weight) {
    var p = this.p, w = weight == null ? 0.5 : weight, read = 600 + (10 - p.smarts) * 140 + this.r() * 900;
    if (this.q('secondguess')) read *= 1.9; if (this.q('speedtap')) read *= 0.35; if (p.temper >= 8) read *= 0.7; if (p.temper <= 2) read *= 1.25;
    this.stats.decisions++;
    return this.react() + read * w / this.speed();
  };
  // chance a tap lands off the button (finger slip). skill 10 ~ 1.5 %, skill 0 ~ 15 %
  H.missChance = function () { var m = 0.015 + (10 - this.p.skill) * 0.0135; if (this.q('speedtap')) m *= 1.8; return m; };
  H.slips = function () { return this.r() < this.missChance(); };
  // chance of misjudging a decision (reads the price wrong, flips a choice). smarts 10 ~ 1 %, 0 ~ 16 %
  H.misreads = function () { var m = 0.01 + (10 - this.p.smarts) * 0.015; if (this.q('speedtap')) m *= 1.5; if (this.r() < m) { this.stats.misreads++; return true; } return false; };
  H.chance = function (x) { return this.r() < x; };
  // lapses: looking at another app for a few seconds (more for distractible / calm people)
  H.lapseGap = function () { var g = 45000 + this.p.reaction * 6000 + this.r() * 60000; if (this.q('distract')) g *= 0.35; return g; };
  H.away = function (now) {
    if (now < this.awayUntil) return true;
    if (now >= this.nextLapse) {
      this.nextLapse = now + this.lapseGap() / this.speed();
      this.awayUntil = now + (2500 + this.r() * (this.q('distract') ? 11000 : 6000)) / this.speed();
      this.stats.lapses++; this.lapseNote = pick(this.r, ['\uD83D\uDCF1 checking a text\u2026', '\uD83C\uDF7A sips a drink\u2026', '\uD83D\uDC40 looks up at the TV\u2026', '\uD83D\uDDE3\uFE0F chatting to the person beside them\u2026', '\uD83E\uDD14 zoned out\u2026']);
      return true;
    }
    return false;
  };
  H.avgReact = function () { return this.stats.reactN ? Math.round(this.stats.reactSum / this.stats.reactN) : 0; };

  root.ZTPPersonas = { make: make, makeSet: makeSet, rng: rng, Human: Human, temperLabel: temperLabel,
    NAMES: NAMES, LOOKS: LOOKS, GENDERS: GENDERS, ORIENT: ORIENT, QUIRKS: QUIRKS, MOTIVES: MOTIVES, COLORS: COLORS };
})(window);
