/* Phone-side end-of-game prompt for Red Deer Rich (solo v0.12 / TV v0.7.13).
   Offered when the human wins, loses, or busts — at the moment they bust, or at
   latest when the results card appears. Posting is always optional.
   If they have initials (or a signed-in profile), those are prefilled for a
   one-tap Post, with Skip. If the account preference "Auto-post my scores" is
   on (default off), the result posts automatically under their initials with a
   toast and Undo. Bust/ocean scores post as negatives (e.g. -$180). */
(function () {
  if (!window.Acct) return;
  var offered = false, posted = false, lastKey = '';

  function ctx() {
    try {
      if (window.RDRSolo && RDRSolo.game && RDRSolo.game()) {
        var g = RDRSolo.game(), meId = RDRSolo.meId && RDRSolo.meId();
        var me = (g.byId && meId != null) ? g.byId(meId) : null;
        if (!me) return null;
        var r = ((g.results || []).filter(function (x) { return x.pid === me.id; })[0]) || null;
        return { kind: 'solo', g: g, me: me, over: g.phase === 'over', bust: !!me.bankrupt, result: r, results: g.results || [], n: (g.players || []).length };
      }
      if (window.RDRC && RDRC.state) {
        var st = RDRC.state();
        if (!st || !st.me || st.me.ai || st.me.observer) return null;
        var me2 = st.me;
        var r2 = ((st.results || []).filter(function (x) { return x.pid === me2.id; })[0]) || null;
        return { kind: 'pad', g: st, me: me2, over: st.phase === 'over', bust: !!me2.bankrupt, result: r2, results: st.results || [], n: (st.players || []).length };
      }
    } catch (e) { return null; }
    return null;
  }

  function scoreOf(c) {
    var r = c && c.result, me = c && c.me;
    if (r) {
      if (r.bankrupt) return -Math.round(r.owed || 0);
      return Math.round(r.worth || 0);
    }
    if (me && me.bankrupt) return -Math.round(me.bustOwed || me.owed || 0);
    if (me && me.worth != null) return Math.round(me.worth || 0);
    return 0;
  }

  function titleOf(c) {
    var r = c.result, me = c.me;
    if (c.over && r && r.place === 1 && !r.bankrupt) return 'You are Red Deer Rich!';
    if (me && me.bankrupt) {
      var owed = (r && r.owed) || me.bustOwed || 0;
      return owed > 0 ? 'Skipped Town Owing ' + (window.Acct.fmtScore ? Acct.fmtScore(-owed) : ('-$' + owed)) : 'You went bust';
    }
    if (c.over && r) return r.place === 1 ? 'You are Red Deer Rich!' : 'Game over';
    return 'Game over';
  }

  function postScore(c, name) {
    posted = true;
    return Acct.submit('red-deer-rich', {
      name: name,
      score: scoreOf(c),
      label: c.n + ' players'
    });
  }

  function offer(c) {
    if (offered) return;
    offered = true;
    var initials = (Acct.initials && Acct.initials()) || '';
    var pr = {};
    try { pr = JSON.parse(localStorage.getItem('ztp:profile') || '{}') || {}; } catch (e) { pr = {}; }
    if (!initials && pr.initials) initials = String(pr.initials);
    var auto = Acct.autoPostPref && Acct.autoPostPref();
    if (auto && initials) {
      postScore(c, initials).then(function (e) {
        if (Acct.toastPosted) Acct.toastPosted('red-deer-rich', e);
      }).catch(function (err) { console.warn('[end-prompt] auto-post failed', err); offered = false; posted = false; });
      return;
    }
    Acct.endPrompt({
      title: titleOf(c),
      sub: (c.me && c.me.bankrupt)
        ? 'Post this result under your initials if you like — even a bust goes on the board (ocean zone). Or skip.'
        : 'Post your score under your initials if you like, or skip. Nothing is posted unless you choose to.',
      fallback: c.me && c.me.name,
      post: function (name) { return postScore(c, name); }
    });
  }

  function tick() {
    var c = ctx();
    if (!c) return;
    var key = (c.kind || '') + ':' + (c.me && c.me.id) + ':' + (c.over ? 'over' : 'play') + ':' + (c.bust ? 'bust' : 'ok');
    if (key !== lastKey && !c.over && !c.bust) { offered = false; posted = false; lastKey = key; return; }
    lastKey = key;
    if (!c.over && !c.bust) return;
    offer(c);
  }

  setInterval(tick, 400);
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(tick, 50);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(tick, 50); });
})();
