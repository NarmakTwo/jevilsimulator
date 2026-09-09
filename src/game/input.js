// Keyboard and controller state. Held keys feed the soul; edge presses feed the menus.

const held = new Set();
const controllerHeld = new Set();
let pressQueue = [];
let handlers = {};

const MAP = {
  ArrowLeft: 'l', a: 'l', A: 'l',
  ArrowRight: 'r', d: 'r', D: 'r',
  ArrowUp: 'u', w: 'u', W: 'u',
  ArrowDown: 'd', s: 'd', S: 'd',
  z: 'z', Z: 'z', Enter: 'z',
  x: 'x', X: 'x', Shift: 'x',
};

export function bindKeyboard(inputHandlers = {}) {
  handlers = inputHandlers;
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

function readController() {
  if (!navigator.getGamepads) return;

  const pad = [...navigator.getGamepads()].find((gamepad) => gamepad?.connected);
  const next = new Set();
  if (pad) {
    const axisX = pad.axes[0] || 0;
    const axisY = pad.axes[1] || 0;
    const button = (index) => pad.buttons[index]?.pressed;

    if (button(14) || axisX < -0.35) next.add('l');
    if (button(15) || axisX > 0.35) next.add('r');
    if (button(12) || axisY < -0.35) next.add('u');
    if (button(13) || axisY > 0.35) next.add('d');
    if (button(0) || button(9)) next.add('z');
    if (button(1) || button(2) || button(3)) next.add('x');
  }

  for (const key of next) {
    if (!controllerHeld.has(key)) {
      pressQueue.push(key);
      if (key === 'z') handlers.onZ?.();
    }
  }
  controllerHeld.clear();
  for (const key of next) controllerHeld.add(key);
}

export function readInput() {
  readController();
  return {
    l: held.has('l') || controllerHeld.has('l'),
    r: held.has('r') || controllerHeld.has('r'),
    u: held.has('u') || controllerHeld.has('u'),
    d: held.has('d') || controllerHeld.has('d'),
    z: held.has('z') || controllerHeld.has('z'),
    x: held.has('x') || controllerHeld.has('x'),
  };
}

/** Drain edge-presses accumulated since the last sim frame. */
export function readPressed() {
  const p = { l: false, r: false, u: false, d: false, z: false, x: false };
  for (const k of pressQueue) p[k] = true;
  pressQueue = [];
  return p;
}
