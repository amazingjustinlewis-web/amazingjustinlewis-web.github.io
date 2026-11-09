/* BUBBLE HOCKEY v0.9.41 fight buttons (dimmed while your move + cooldown runs) (phone). Left side: Attack high / Grab / Attack low. Right side: Dodge high / Escape / Dodge low.
   BubbleFightPad(getSt, getTeam, send) -- shows only while st.ft is on and one of the two fighters is on your team. */
(function (root) {
  'use strict';
  root.BubbleFightPad = function (getSt, getTeam, send) {
    var css = document.createElement('style'); css.textContent = '#ftpad{position:fixed;inset:0;z-index:12;display:none;pointer-events:none}#ftpad .col{position:absolute;top:26vh;bottom:4vh;width:22vw;display:flex;flex-direction:column;justify-content:space-between;gap:2vh}'
      + '#ftpad .l{left:2vw}#ftpad .r{right:2vw}#ftpad button{pointer-events:auto;flex:1;border:3px solid #fff9;border-radius:18px;color:#fff;font:700 4.2vw Fredoka,sans-serif;text-shadow:0 2px 3px #000a;touch-action:manipulation;-webkit-tap-highlight-color:transparent}'
      + '#ftpad button:active,#ftpad button.on{transform:scale(.94);filter:brightness(1.4)}#ftpad .a{background:#e0433d99}#ftpad .g{background:#d98a1f99}#ftpad .d{background:#2f7fe099}#ftpad .e{background:#3fb06a99}#ftpad button:disabled{opacity:.35}#ftpad.cd button{opacity:.38;filter:grayscale(.6)}'
      + '@media (orientation:landscape){#ftpad .col{top:18vh;width:18vw}#ftpad button{font-size:2.6vw}}';
    document.head.appendChild(css);
    var el = document.createElement('div'); el.id = 'ftpad';
    el.innerHTML = '<div class="col l"><button class="a" data-a="hi">ATTACK<br>HIGH</button><button class="g" data-a="grab">GRAB</button><button class="a" data-a="lo">ATTACK<br>LOW</button></div>'
      + '<div class="col r"><button class="d" data-a="dh">DODGE<br>HIGH</button><button class="e" data-a="esc">ESCAPE</button><button class="d" data-a="dl">DODGE<br>LOW</button></div>';
    document.body.appendChild(el);
    var btns = [].slice.call(el.querySelectorAll('button'));
    btns.forEach(function (b) { b.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); send({ t: 'fight', a: b.getAttribute('data-a') }); if (navigator.vibrate) navigator.vibrate(18); b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 120); }); });
    var last = '';
    (function tick() { var st = getSt(), F = st && st.ft, tm = getTeam(), B = root.Bubble, mine = F && B && (B.TR[F.a].t === tm || B.TR[F.b].t === tm), on = !!(mine && F.ph !== 'end');
      el.style.display = on ? 'block' : 'none'; el.classList.toggle('cd', !!(on && F.cd && F.cd[B.TR[F.a].t === tm ? 0 : 1] > 0));
      if (on) { var s = B.TR[F.a].t === tm ? 0 : 1, me = s ? F.b : F.a, op = s ? F.a : F.b, held = F.gr === op, hold = F.gr === me, key = F.ph + held + hold;
        if (key !== last) { last = key; btns.forEach(function (b) { var a = b.getAttribute('data-a'); b.disabled = F.ph !== 'fight'; if (a === 'esc') b.innerHTML = held ? 'PULL<br>AWAY' : 'ESCAPE'; if (a === 'grab') b.innerHTML = hold ? 'PUNCH' : 'GRAB'; }); } }
      requestAnimationFrame(tick); })();
    return el; };
})(window);
