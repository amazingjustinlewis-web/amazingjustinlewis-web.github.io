/* Cave Cinema v01 - library loading + content-mode filter (shared).
   Launcher design: everything is a "shelf" ({ id, label, items }). Movies is the first shelf; later a Games shelf
   (items = ZTP games with a launch URL) slots in next to it, so one QR scan on the projector picks anything. */
(function (root) {
  'use strict';
  var RANK = { kid: 0, family: 1, mature: 2 };
  function cat(p) { var a = String(p || '').split(/[\\/]/); return a.length > 2 ? a[a.length - 2] : (a.length > 1 ? a[0] : 'Other'); }
  root.CineLib = {
    // API base: the Asus helper (cinema_helper_v01.py, port 8093) serves manifest, posters and proxies /api/* to Cave Cinema :8090.
    base: function () { var q = new URLSearchParams(location.search).get('api'); if (q) return q.replace(/\/$/, ''); return location.port === '8093' ? location.origin : 'http://127.0.0.1:8093'; },
    load: function () {
      var B = this.base();
      return fetch(B + '/cinema/manifest_v01.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (m) {
        return m.movies.map(function (x) { return { id: x.id, t: x.t, y: x.y, p: x.p, cat: x.cat || cat(x.p), mode: x.mode || 'mature', poster: x.poster ? B + '/cinema/' + x.poster : '' }; });
      }).catch(function () {   // no manifest yet: plain catalog, no posters (all tagged mature until classified)
        return fetch(B + '/api/catalog').then(function (r) { return r.json(); }).then(function (d) {
          return (d.cat.movies || []).map(function (x, k) { var p = x.v && x.v[0] && x.v[0].p; return { id: 'm' + k, t: x.t, y: x.y, p: p, cat: cat(p), mode: 'mature', poster: '' }; });
        });
      });
    },
    fits: function (m, mode) { return (RANK[m.mode] == null ? 2 : RANK[m.mode]) <= (RANK[mode] == null ? 1 : RANK[mode]); },
    shelves: function (movies) {
      var cats = []; movies.forEach(function (m) { if (cats.indexOf(m.cat) < 0) cats.push(m.cat); }); cats.sort();
      return [{ id: 'all', label: 'All', items: movies }].concat(cats.map(function (c) { return { id: 'c:' + c, label: c, items: movies.filter(function (m) { return m.cat === c; }) }; }));
    },
    play: function (m) { return fetch(this.base() + '/api/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p: m.p, t: m.t }) }); },
    stop: function () { return fetch(this.base() + '/api/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); }
  };
})(window);
