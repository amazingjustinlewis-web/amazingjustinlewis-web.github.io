/* DANGEROUS WATERS v0.1.2 effects. BSFX.shot(gridEl, cell, hit): splash on every shot; on a hit also an explosion flash,
   sparks and a screen shake. DOM + CSS only so it works on phones and the TV alike. */
(function (root) {
  function el(cls, x, y, css) { var d = document.createElement('div'); d.className = 'fx ' + cls; d.style.left = x + 'px'; d.style.top = y + 'px'; if (css) for (var k in css) d.style.setProperty(k, css[k]); document.body.appendChild(d); return d; }
  function shot(grid, c, hit) {
    var cell = grid && grid.querySelector('[data-c="' + c + '"]'); if (!cell) return;
    var r = cell.getBoundingClientRect(), x = r.left + r.width / 2 + scrollX, y = r.top + r.height / 2 + scrollY, s = r.width, all = [];
    all.push(el('ring', x, y, { '--s': s * (hit ? 3.2 : 2.4) + 'px' }));
    for (var i = 0; i < (hit ? 14 : 9); i++) { var a = -Math.PI / 2 + (Math.random() - .5) * 2.2, v = s * (.8 + Math.random() * (hit ? 1.6 : 1.1));
      all.push(el('drop', x, y, { '--dx': Math.cos(a) * v + 'px', '--dy': Math.sin(a) * v + 'px', '--z': (.4 + Math.random() * .6) * s * .22 + 'px', 'animation-delay': (hit ? .08 : 0) + 's' })); }
    if (hit) {
      all.push(el('boom', x, y, { '--s': s * 3 + 'px' }));
      for (i = 0; i < 18; i++) { a = Math.random() * 7; v = s * (1 + Math.random() * 2.4);
        all.push(el('spark', x, y, { '--dx': Math.cos(a) * v + 'px', '--dy': Math.sin(a) * v + 'px', '--r': a + 'rad' })); }
      document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake');
      setTimeout(function () { document.body.classList.remove('shake'); }, 520);
    }
    setTimeout(function () { all.forEach(function (d) { d.remove(); }); }, 1300);
  }
  root.BSFX = { shot: shot };
})(window);
