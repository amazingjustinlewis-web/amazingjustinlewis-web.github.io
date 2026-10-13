/* DRIFT SIGNAL v0.4 phone: AI pilot toggle + mode buttons on the Helm tab. Any other helm order takes control back (TV side). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); }, prev = window.DS_v03;
  window.DS_v03 = function (st) {
    if (prev) prev(st);
    var a = st && st.auto; if (!a || !$('autoBtn')) return;
    $('autoBtn').classList.toggle('on', a.on); $('autoBtn').textContent = 'AI pilot: ' + (a.on ? 'ON' : 'OFF');
    document.querySelectorAll('[data-amode]').forEach(function (b) { b.classList.toggle('on', a.on && b.dataset.amode === a.mode); });
    $('autoSt').textContent = a.on ? '\u00B7 ' + (a.status || '') + (a.mode === 'gather' && a.n ? ' \u00B7 ' + a.n + ' gathered' : '') : '\u00B7 manual helm';
  };
})();
