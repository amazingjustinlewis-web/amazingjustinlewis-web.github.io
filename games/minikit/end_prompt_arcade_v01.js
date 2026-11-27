/* Optional end-of-game score prompt for public arcade games (v01).
   Posting is always optional. Prefills initials for signed-in players,
   with Post / Skip, Make a profile, and Auto-post (default off).
   EndPromptArcade.mount({ game, isOver, title, sub, score, label, fallback, key }) */
(function (root) {
  if (root.EndPromptArcade) return;
  var offered = {};

  function val(v) {
    try { return typeof v === 'function' ? v() : v; } catch (e) { return null; }
  }

  function mount(o) {
    if (!root.Acct || !o || !o.game || !o.isOver) return;
    var key = o.game + ':' + (o.key || 'default');
    function tick() {
      var over = false;
      try { over = !!o.isOver(); } catch (e) { return; }
      if (!over) { offered[key] = false; return; }
      if (offered[key]) return;
      offered[key] = true;
      var score = Math.round(Number(val(o.score)) || 0);
      var label = String(val(o.label) || '');
      var title = String(val(o.title) || 'Game over');
      var sub = String(val(o.sub) || 'Post this result under your initials if you like, or skip. Nothing is posted unless you choose to.');
      var fallback = val(o.fallback);
      function post(name) {
        return Acct.submit(o.game, { name: name, score: score, label: label });
      }
      var initials = (Acct.initials && Acct.initials()) || '';
      var pr = {};
      try { pr = JSON.parse(localStorage.getItem('ztp:profile') || '{}') || {}; } catch (e) { pr = {}; }
      if (!initials && pr.initials) initials = String(pr.initials);
      if (Acct.autoPostPref && Acct.autoPostPref() && initials) {
        post(initials).then(function (e) {
          if (Acct.toastPosted) Acct.toastPosted(o.game, e);
        }).catch(function (err) { console.warn('[end-prompt] auto-post failed', err); offered[key] = false; });
        return;
      }
      Acct.endPrompt({ title: title, sub: sub, game: o.game, fallback: fallback, post: post });
    }
    setInterval(tick, 450);
    if (root.Acct.ready && root.Acct.ready.then) root.Acct.ready.then(function () { tick(); });
    else tick();
  }

  root.EndPromptArcade = { mount: mount };
})(window);
