/* Zero to Phi dev kit - AI playtest panel v0.1: hooks for later versions (out of scope for v0.1, wired but idle).

   1. VENUES  (simulated cafe / pub / stage with servers, robots, bouncers, real-looking food)
      ZTPSimVenues[id] = { name, mount(el, run), unmount(), onArrive(persona), onLeave(persona), onEvent(ev), tick(now) }
      The panel calls these if a venue is picked in the setup bar. A venue is where a persona's motive comes from
      (persona.motive is already generated: "on a date", "waiting on food", ...) and could later set who walks in,
      when they scan in, and when they wander off to the bar.

   2. GROUP MENU VOTES  (the room swipes yes / no / indifferent on what to play next)
      ZTPSimHooks.groupVote(options, personas) -> { winner, tally: { option: { yes, no, meh } }, swipes: [...] }
      v0.1 ships a simple trait-based stand-in so a future menu screen can call it today. persona.prefs is the
      slot for the profile "superhero card" sliders and hard limits; a real vote must respect hard limits first.

   3. EVENTS  ZTPSimHooks.onEvent(ev) gets every log line { t, who, text, kind } (kind: ai, game, buy, miss, big, sys). */
(function (root) {
  'use strict';
  root.ZTPSimVenues = root.ZTPSimVenues || {};
  root.ZTPSimHooks = root.ZTPSimHooks || {
    onRunStart: null, onRunStop: null, onEvent: null,
    groupVote: function (options, personas) {
      var tally = {}, swipes = [];
      options.forEach(function (o) { tally[o.id || o] = { yes: 0, no: 0, meh: 0 }; });
      personas.forEach(function (p) {
        options.forEach(function (o) {
          var id = o.id || o, lim = p.prefs && p.prefs.hardNo && p.prefs.hardNo.indexOf(id) >= 0;
          var lean = lim ? -1 : (o.intensity != null ? 1 - Math.abs(o.intensity - p.temper) / 10 : 0.5) + (Math.random() - 0.5) * 0.6;
          var s = lim || lean < 0.3 ? 'no' : lean > 0.6 ? 'yes' : 'meh'; tally[id][s]++; swipes.push({ who: p.name, option: id, swipe: s, hardLimit: !!lim });
        });
      });
      var ids = Object.keys(tally), best = ids.filter(function (id) { return !swipes.some(function (s) { return s.option === id && s.hardLimit; }); })
        .sort(function (a, b) { return (tally[b].yes - tally[b].no) - (tally[a].yes - tally[a].no); })[0] || null;
      return { winner: best, tally: tally, swipes: swipes };
    }
  };
})(window);
