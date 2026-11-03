/* Cave Cinema v03 - library loading (newest manifest + genre tabs from categories_vNN.json) + content-mode filter (shared).
   Launcher design: everything is a "shelf" ({ id, label, items }). Movies is the first shelf; later a Games shelf
   (items = ZTP games with a launch URL) slots in next to it, so one QR scan on the projector picks anything. */
(function (root) {
  'use strict';
  var RANK = { kid: 0, family: 1, mature: 2 }, ORDER = ['Action', 'Comedy', 'Sci-Fi', 'Horror', 'Drama', 'Animation', 'Kids', 'TV'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // newest versioned file: try _v09.json down to _v01.json, first one that exists wins (files are never overwritten)
  function newest(pre, n) { return n < 1 ? Promise.reject(0) : fetch(pre + pad(n) + '.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return newest(pre, n - 1); }); }
  function cat(p) { var a = String(p || '').split(/[\\/]/); return a.length > 2 ? a[a.length - 2] : (a.length > 1 ? a[0] : 'Other'); }
  root.CineLib = {
    // API base: the Asus helper (cinema_helper_v01.py, port 8093) serves manifest, posters and proxies /api/* to Cave Cinema :8090.
    base: function () { var q = new URLSearchParams(location.search).get('api'); if (q) return q.replace(/\/$/, ''); return /^809[34]$/.test(location.port) ? location.origin : 'http://127.0.0.1:8094'; },
    load: function () {
      var B = this.base();
      var gen = {};
      var cats = newest(B + '/cinema/categories_v', 9).then(function (c) { gen = c.movies || {}; ORDER = c.order || ORDER; }).catch(function () {});
      return cats.then(function () { return newest(B + '/cinema/manifest_v', 9); }).then(function (m) {
        return m.movies.map(function (x) { return { id: x.id, t: x.t, y: x.y, p: x.p, cat: x.cat || cat(x.p), g: (gen[x.id] && gen[x.id].cats) || [], mode: x.mode || 'mature', poster: x.poster ? B + '/cinema/' + x.poster : '' }; });
      }).catch(function () {   // no manifest yet: plain catalog, no posters (all tagged mature until classified)
        return fetch(B + '/api/catalog').then(function (r) { return r.json(); }).then(function (d) {
          return (d.cat.movies || []).concat(d.cat.collections || []).map(function (x, k) { var p = x.v && x.v[0] && x.v[0].p; return { id: 'm' + k, g: [], t: x.t, y: x.y, p: p, cat: cat(p), mode: 'mature', poster: '' }; });
        });
      });
    },
    fits: function (m, mode) { return (RANK[m.mode] == null ? 2 : RANK[m.mode]) <= (RANK[mode] == null ? 1 : RANK[mode]); },
    shelves: function (movies) {
      // genre tabs in fixed order; empty ones (e.g. Horror in kid mode) are hidden
      var out = [{ id: 'all', label: 'All', items: movies }];
      ORDER.forEach(function (c) { var it = movies.filter(function (m) { return (m.g || []).indexOf(c) >= 0; }); if (it.length) out.push({ id: 'g:' + c, label: c, items: it }); });
      return out;
    },
    play: function (m) { return fetch(this.base() + '/api/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p: m.p, t: m.t }) }); },
    stop: function () { return fetch(this.base() + '/api/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); }
  };
})(window);
