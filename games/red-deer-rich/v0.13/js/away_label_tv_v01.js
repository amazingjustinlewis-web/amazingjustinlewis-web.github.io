/* TV v0.7.10: a player whose phone is gone but whose seat is being auto-played
   is labelled "Away, auto-playing" instead of a red "Disconnected" / "offline"
   / "AI covering" while they still hit PAY UP. Purely a label; auto-play is unchanged. */
(function (w) {
  'use strict';
  function relabel() {
    var g = w.RDR && RDR.game; if (!g || !g.players) return;
    g.players.forEach(function (p) {
      var card = document.querySelector('.pcard[data-pid="' + p.id + '"]');
      if (!card) return;
      if (p.ai && !p.aiTakeover) return; /* genuine computer seat keeps "AI Normal" etc. */
      var tag = card.querySelector('.tag');
      var auto = !!p.aiTakeover;
      var gone = p.connected === false;
      if (auto) {
        if (!tag) {
          var sub = card.querySelector('.psub'); if (!sub) return;
          tag = document.createElement('span'); sub.appendChild(tag);
        }
        tag.className = 'tag away';
        tag.textContent = 'Away, auto-playing';
      } else if (gone) {
        if (!tag) {
          var sub2 = card.querySelector('.psub'); if (!sub2) return;
          tag = document.createElement('span'); sub2.appendChild(tag);
        }
        tag.className = 'tag off';
        tag.textContent = 'Disconnected';
      }
    });
  }
  setInterval(relabel, 400);
  w.RDRAwayLabel = { paint: relabel };
})(window);
