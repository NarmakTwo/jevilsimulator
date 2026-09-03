// Keyboard state. Held keys feed the soul; edge presses feed the menus.

const held = new Set();
let pressQueue = [];

const MAP = {
  ArrowLeft: 'l', a: 'l', A: 'l',
  ArrowRight: 'r', d: 'r', D: 'r',
  ArrowUp: 'u', w: 'u', W: 'u',
  ArrowDown: 'd', s: 'd', S: 'd',
  z: 'z', Z: 'z', Enter: 'z',
  x: 'x', X: 'x', Shift: 'x',
};

export function bindKeyboard(handlers = {}) {
  window.addEventListener('keydown', (ev) => {
    const k = MAP[ev.key];
    if (!k) return;
    ev.preventDefault();
    if (k === 'z') handlers.onZ?.(ev);
    if (!held.has(k)) pressQueue.push(k);
    held.add(k);
  });
  window.addEventListener('keyup', (ev) => {
    const k = MAP[ev.key];
    if (k) held.delete(k);
  });
  window.addEventListener('blur', () => held.clear());
}

export function readInput() {
  return {
    l: held.has('l'), r: held.has('r'), u: held.has('u'), d: held.has('d'),
    z: held.has('z'), x: held.has('x'),
  };
}

/** Drain edge-presses accumulated since the last sim frame. */
export function readPressed() {
  const p = { l: false, r: false, u: false, d: false, z: false, x: false };
  for (const k of pressQueue) p[k] = true;
  pressQueue = [];
  return p;
}
