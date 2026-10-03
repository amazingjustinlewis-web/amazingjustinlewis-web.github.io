/* =====================================================================
   input.js - one button per player + a few global hotkeys.
   P1 = Space, P2 = Enter / Numpad Enter.
   Each player button keeps a queue of 'down' / 'up' edges which the game
   drains once per fixed update, so even a press+release inside one frame
   is never lost.
   ===================================================================== */
const Input = (() => {
  // key code -> player index. Add more codes here to remap buttons.
  const BUTTON_MAP = { Space: 0, Enter: 1, NumpadEnter: 1 };

  const buttons = [0, 1].map(() => ({
    keys: new Set(),   // physical keys currently down for this button
    queue: [],         // pending edges: 'down' | 'up'
    blocked: false     // ignore everything until the button is released
  }));
  const hotkeys = {};          // code -> callback
  const anyKeyListeners = [];

  function isTypingTarget(e) {
    const t = e.target;
    return t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && t.type === 'text'));
  }

  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e)) return;
    anyKeyListeners.forEach((f) => f(e));
    if (e.code in BUTTON_MAP) {
      e.preventDefault();
      const b = buttons[BUTTON_MAP[e.code]];
      const wasDown = b.keys.size > 0;
      b.keys.add(e.code);
      if (!wasDown && !b.blocked) b.queue.push('down');
      return;
    }
    if (hotkeys[e.code]) {
      e.preventDefault();
      if (!e.repeat) hotkeys[e.code](e);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code in BUTTON_MAP) {
      e.preventDefault();
      const b = buttons[BUTTON_MAP[e.code]];
      b.keys.delete(e.code);
      if (b.keys.size === 0) {
        if (b.blocked) b.blocked = false;
        else b.queue.push('up');
      }
    }
  });

  // Losing focus while holding would leave a button stuck down.
  window.addEventListener('blur', () => {
    buttons.forEach((b) => {
      if (b.keys.size && !b.blocked) b.queue.push('up');
      b.keys.clear();
      b.blocked = false;
    });
  });

  /* ---------------- touch / pointer (v3.1) ----------------
     Every touch is tracked by its pointerId and treated as one more "physical key" held on the
     button it started on (left/right half etc. - main.js decides via the router). So a touch
     feeds EXACTLY the same edge queue / held state / blocking as Space and Enter do. */
  const owners = new Map();      // pointerId -> button index it is holding
  const touchListeners = [];
  let touchUsed = false;
  function pressVirtual(i, id) {
    const b = buttons[i], wasDown = b.keys.size > 0;
    b.keys.add(id);
    if (!wasDown && !b.blocked) b.queue.push('down');
  }
  function releaseVirtual(i, id) {
    const b = buttons[i];
    if (!b.keys.delete(id)) return;
    if (b.keys.size === 0) {
      if (b.blocked) b.blocked = false;
      else b.queue.push('up');
    }
  }
  window.addEventListener('blur', () => owners.clear());   // (keys were cleared by the blur handler above)

  function attachTouch(el, route) {
    const nopassive = { passive: false };
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;              // desktop mouse: unchanged (keyboard only, as before)
      e.preventDefault();
      touchUsed = true;
      touchListeners.forEach((f) => f(e));
      const r = el.getBoundingClientRect();
      const i = route(e.clientX - r.left, e.clientY - r.top, r.width, r.height, e);
      if (i !== 0 && i !== 1) return;                     // consumed (a title-screen button) or ignored
      owners.set(e.pointerId, i);
      pressVirtual(i, 'pointer' + e.pointerId);
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
    }, nopassive);
    const up = (e) => {
      const i = owners.get(e.pointerId);
      if (i === undefined) return;
      owners.delete(e.pointerId);
      releaseVirtual(i, 'pointer' + e.pointerId);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('lostpointercapture', up);
    // no scrolling, pinch / double-tap zoom, long-press callout, selection or context menu on the game
    for (const t of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      el.addEventListener(t, (e) => {
        if (e.cancelable) e.preventDefault();
        if (t === 'touchend' || t === 'touchstart') touchListeners.forEach((f) => f(e));   // iOS audio unlock
      }, nopassive);
    }
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('dblclick', (e) => e.preventDefault());
    el.addEventListener('selectstart', (e) => e.preventDefault());
    for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, (e) => e.preventDefault(), nopassive);
  }

  return {
    attachTouch,
    onTouch(fn) { touchListeners.push(fn); },
    /** true on touch-first devices (coarse pointer) or once a real touch has happened */
    get isTouch() { return touchUsed || !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); },
    get touchCount() { return owners.size; },
    /** Returns and clears pending edges for player i. */
    poll(i) { const q = buttons[i].queue; buttons[i].queue = []; return q; },
    isHeld(i) { return buttons[i].keys.size > 0 && !buttons[i].blocked; },
    /** Drop pending edges; if the button is held, ignore it until released. */
    requireFresh(i) { const b = buttons[i]; b.queue = []; b.blocked = b.keys.size > 0; },
    clear(i) { buttons[i].queue = []; },
    onKey(code, fn) { hotkeys[code] = fn; },
    onAnyKey(fn) { anyKeyListeners.push(fn); }
  };
})();
