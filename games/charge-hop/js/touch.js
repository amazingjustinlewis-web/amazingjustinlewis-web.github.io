/* Touch controls (v3.1) - iPad / phone.
   - Single player: tap / hold ANYWHERE = Space.   Two players: LEFT half = P1 (Space), RIGHT half = P2 (Enter).
   - Every finger is tracked by pointerId and fed into the SAME input queue as the keys (Input.attachTouch),
     so hop / charge / overload / streak behave exactly as on the keyboard.
   - Small DOM buttons: pause menu (touch stand-in for P / R / ESC / M) and fullscreen where the browser allows it. */
(() => {
  const canvas = document.getElementById('game');
  Input.attachTouch(canvas, (x, y, w, h) => Game.touchRoute(x, y, w, h));
  Input.onTouch(() => Sfx.unlock());            // iOS: AudioContext must be created / resumed inside a user gesture

  const $ = (id) => document.getElementById(id);
  const pauseBtn = $('tPause'), fullBtn = $('tFull'), menu = $('tmenu');
  const doc = document, root = doc.documentElement;
  const canFull = !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled) && !!(root.requestFullscreen || root.webkitRequestFullscreen);
  const isFull = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);

  // buttons must not leak touches to the game, scroll the page or zoom
  for (const el of [pauseBtn, fullBtn, menu]) {
    el.addEventListener('touchstart', (e) => { Sfx.unlock(); e.stopPropagation(); }, { passive: true });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  menu.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  const tap = (el, fn) => el.addEventListener('click', (e) => { e.preventDefault(); Sfx.unlock(); fn(); });

  const openMenu = () => { if (Game.state === 'title') return; if (!Game.paused) Game.togglePause(); sync(); };
  const closeMenu = () => { if (Game.paused) Game.togglePause(); sync(); };
  tap(pauseBtn, () => (Game.paused ? closeMenu() : openMenu()));
  tap($('tmResume'), closeMenu);
  tap($('tmRestart'), () => { Game.restart(); sync(); });                 // same as R
  tap($('tmTitle'), () => { Game.toTitle(); sync(); });                    // same as ESC
  tap($('tmSound'), () => { Sfx.toggleMute(); sync(); });                  // same as M
  tap(fullBtn, () => {
    if (isFull()) (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
    else { const p = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (p && p.catch) p.catch(() => {}); }
  });

  let last = '';
  function sync() {
    const touch = Input.isTouch, title = Game.state === 'title';
    const uiS = Game.uiScale || 1;
    // sits just under the timer / level name at the top centre (HUD panels are at the top corners)
    const top = Math.round(78 * uiS + 6) + 'px';
    const showPause = touch && !title;
    const key = [touch, title, Game.paused, Sfx.muted, canFull, isFull(), top].join();
    if (key === last) return;
    last = key;
    pauseBtn.style.display = showPause ? 'block' : 'none';
    fullBtn.style.display = touch && canFull ? 'block' : 'none';
    pauseBtn.style.top = fullBtn.style.top = top;
    pauseBtn.style.left = showPause && canFull ? 'calc(50% - 50px)' : 'calc(50% - 22px)';
    fullBtn.style.left = showPause ? 'calc(50% + 6px)' : 'calc(50% - 22px)';
    if (title) { fullBtn.style.top = 'calc(env(safe-area-inset-top, 0px) + 10px)'; fullBtn.style.left = 'calc(100% - env(safe-area-inset-right, 0px) - 54px)'; }
    pauseBtn.innerHTML = Game.paused ? '&#9654;' : '&#10074;&#10074;';
    fullBtn.innerHTML = isFull() ? '&#x2715;' : '&#x26F6;';
    menu.classList.toggle('open', touch && Game.paused);
    $('tmSound').textContent = 'Sound: ' + (Sfx.muted ? 'OFF' : 'on');
  }
  (function loop() { sync(); requestAnimationFrame(loop); })();
})();
