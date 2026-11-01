/* hopbtns_v01: on-screen HOP buttons (P1 bottom-left = Space, P2 bottom-right = Enter).
   They send the same key codes the keyboard does, so keyboard play is untouched. */
(() => {
  const mk = (id, code, txt, side) => {
    const b = document.createElement('button');
    b.id = id; b.className = 'hopbtn'; b.textContent = txt; b.setAttribute('aria-label', txt);
    b.style[side] = 'calc(env(safe-area-inset-' + side + ', 0px) + 18px)';
    const send = (type) => window.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : 'Enter', bubbles: true }));
    let down = false;
    const press = (e) => { e.preventDefault(); e.stopPropagation(); if (window.Sfx && Sfx.unlock) Sfx.unlock(); if (!down) { down = true; b.classList.add('on'); send('keydown'); } };
    const release = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } if (down) { down = false; b.classList.remove('on'); send('keyup'); } };
    b.addEventListener('pointerdown', (e) => { try { b.setPointerCapture(e.pointerId); } catch (_) {} press(e); });
    b.addEventListener('pointerup', release); b.addEventListener('pointercancel', release); b.addEventListener('lostpointercapture', () => release());
    b.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    document.body.appendChild(b);
  };
  const st = document.createElement('style');
  st.textContent = '.hopbtn{position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 18px);z-index:25;width:96px;height:96px;border-radius:50%;' +
    'border:3px solid rgba(255,255,255,.45);background:rgba(255,138,31,.35);color:#fff;font:900 18px/1 system-ui,sans-serif;touch-action:none;cursor:pointer;opacity:.8}' +
    '.hopbtn.on{background:rgba(255,138,31,.85);transform:scale(.94)}#hopP2{background:rgba(60,160,255,.35)}#hopP2.on{background:rgba(60,160,255,.85)}';
  document.head.appendChild(st);
  mk('hopP1', 'Space', 'P1 HOP', 'left');
  mk('hopP2', 'Enter', 'P2 HOP', 'right');
})();
