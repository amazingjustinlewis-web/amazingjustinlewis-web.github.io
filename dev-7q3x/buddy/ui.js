/* BALLOON BUDDY player controls (used by pad.html and by the host page when one phone hosts). */
(function (root) {
  root.BuddyUI = function (el, send) {
    el.innerHTML = '<div id="bmsg"></div><div id="bset" style="display:none"><input class="tx" id="bword" maxlength="24" placeholder="Secret word (no peeking!)" autocomplete="off" type="password"><label style="font-size:13px"><input type="checkbox" id="bshow"> show</label><button class="btn go" id="bok" style="width:100%">Hide it!</button></div><div id="bkeys"></div><button class="btn go" id="bnext" style="width:100%;display:none;margin-top:8px">Next round &#9654;</button>';
    var $ = function (i) { return el.querySelector('#' + i); }, keys = '';
    'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').forEach(function (l, i) { keys += (i === 10 || i === 19 ? '<br>' : '') + '<button class="btn bk" data-l="' + l + '">' + l + '</button>'; });
    $('bkeys').innerHTML = keys;
    $('bkeys').addEventListener('click', function (e) { var b = e.target.closest('[data-l]'); if (b && !b.disabled) { send({ t: 'guess', l: b.dataset.l }); if (navigator.vibrate) navigator.vibrate(10); } });
    $('bok').onclick = function () { send({ t: 'word', w: $('bword').value }); $('bword').value = ''; };
    $('bshow').onchange = function () { $('bword').type = this.checked ? 'text' : 'password'; };
    $('bnext').onclick = function () { send({ t: 'next' }); };
    return function (s) {
      var setting = s.phase === 'set' && s.me === s.setter, guessing = s.phase === 'guess' && s.me !== s.setter, end = s.phase === 'won' || s.phase === 'lost';
      $('bset').style.display = setting ? '' : 'none'; $('bkeys').style.display = guessing ? '' : 'none'; $('bnext').style.display = end || s.phase === 'lobby' ? '' : 'none';
      $('bnext').textContent = s.phase === 'lobby' ? 'START' : 'Next round \u25B6';
      $('bmsg').textContent = setting ? 'Your turn to pick a word. Make it tricky!' : s.phase === 'guess' && s.me === s.setter ? 'Your word: ' + s.word + '. Watch them squirm\u2026' : s.phase === 'set' ? s.log : s.phase === 'lobby' ? 'Waiting for players. Anyone can start.' : s.log;
      el.querySelectorAll('[data-l]').forEach(function (b) { var l = b.dataset.l; b.disabled = s.got.indexOf(l) >= 0 || s.wrong.indexOf(l) >= 0; b.style.background = s.got.indexOf(l) >= 0 ? '#3a8a5a' : s.wrong.indexOf(l) >= 0 ? '#8a3a4a' : ''; });
    };
  };
})(window);
