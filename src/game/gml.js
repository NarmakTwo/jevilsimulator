// GML built-in helpers, translated to match GameMaker semantics.
// Angles are degrees, counter-clockwise on screen (y axis inverted).

export const FPS = 30;
export const MS_PER_FRAME = 1000 / FPS;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function random(n) {
  return Math.random() * n;
}

export function irandom(n) {
  return Math.floor(Math.random() * (n + 1));
}

export function choose(...args) {
  return args[Math.floor(Math.random() * args.length)];
}

const D2R = Math.PI / 180;

export function lengthdirX(len, dir) {
  return len * Math.cos(dir * D2R);
}

export function lengthdirY(len, dir) {
  return -len * Math.sin(dir * D2R);
}

export function pointDirection(x1, y1, x2, y2) {
  let d = Math.atan2(-(y2 - y1), x2 - x1) / D2R;
  return ((d % 360) + 360) % 360;
}

export function pointDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** GML move_towards_point: sets direction toward target and speed. */
export function moveTowardsPoint(e, tx, ty, spd) {
  e.direction = pointDirection(e.x, e.y, tx, ty);
  e.speed = spd;
}

/** scr_approach — decrement/increment with clamp on crossing. */
export function scrApproach(from, to, step) {
  if (from < to) {
    from += step;
    if (from > to) return to;
  } else {
    from -= step;
    if (from < to) return to;
  }
  return from;
}

/**
 * Drain a real-time accumulator into whole 30fps frames (rule: the sim never
 * sees wall-clock time; the driver asks how many frames to run).
 */
export function drain(accumulatorMs, elapsedMs, maxSteps = 5) {
  let acc = accumulatorMs + elapsedMs;
  let steps = 0;
  while (acc >= MS_PER_FRAME && steps < maxSteps) {
    acc -= MS_PER_FRAME;
    steps += 1;
  }
  if (steps === maxSteps && acc >= MS_PER_FRAME) acc = 0;
  return { steps, accumulator: acc };
}
