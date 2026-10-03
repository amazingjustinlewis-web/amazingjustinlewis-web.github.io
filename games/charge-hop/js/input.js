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

  return {
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
