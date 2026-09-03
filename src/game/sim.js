// Entity runtime with GameMaker's event phases and built-in motion.
//
// Phase order per frame (GameMaker manual): Begin Step, Alarms, Step,
// built-in motion, Collision, End Step, then the "draw phase" — a slot for
// translated Draw-event code that mutates state (obj_dbullet_vert does its
// whole motion setup in Draw). Rendering itself only reads state.
//
// Deviations from the source engine, stated plainly:
//  * collision is oriented-bounding-box vs the heart's 16x16 mask, not
//    per-pixel sprite masks;
//  * numbers are f64 (GameMaker narrows built-ins to f32);
//  * RNG is Math.random, not GameMaker's seeded LCG — no replay support.

import { lengthdirX, lengthdirY, pointDirection } from './gml.js';
import { createDmgNumbers } from './dmg.js';

let seq = 0;

export function createState() {
  return {
    entities: [],
    frame: 0,
    // globals used by the translated code
    inv: -1,          // global.inv (soul invulnerability countdown)
    invc: 1,          // global.invc (multiplier; Jevil's chaosdance can lower it)
    sp: 4,            // global.sp (soul speed)
    tension: 0,       // TP, 0..100
    turntimer: 0,     // frames left in the enemy turn
    mnfight: 0,       // 0 idle, 2 enemy attacking
    shake: 0,
    heartx: 320, hearty: 170,
    cues: [],         // audio cue names drained by the driver
    dmg: createDmgNumbers(),
    charaction: [0, 0, 0],
    accurateHitbox: false,
  };
}

export function cue(state, name) {
  state.cues.push(name);
}

export function spawn(state, type, x, y, init) {
  const e = {
    type, x, y, seq: seq++,
    alive: true,
    hspeed: 0, vspeed: 0, friction: 0, gravity: 0, gravity_direction: 270,
    image_angle: 0, image_xscale: 1, image_yscale: 1,
    image_alpha: 1, image_index: 0, image_speed: 0, image_blend: null,
    depth: 0, visible: true,
    sprite_index: type.sprite || null,
    alarm: {},
    // bullet fields (scr_bullet_inherit envelope)
    damage: 124, grazepoints: 5, timepoints: 5, inv: 60, target: 0,
    grazed: 0, grazetimer: 0, active: 0,
  };
  // GML speed/direction are views over hspeed/vspeed.
  Object.defineProperty(e, 'speed', {
    get() { return Math.hypot(e.hspeed, e.vspeed); },
    set(v) {
      const d = e.direction;
      e.hspeed = lengthdirX(v, d);
      e.vspeed = lengthdirY(v, d);
      e._dir = d;
    },
  });
  Object.defineProperty(e, 'direction', {
    get() {
      if (e.hspeed === 0 && e.vspeed === 0) return e._dir || 0;
      return pointDirection(0, 0, e.hspeed, e.vspeed);
    },
    set(d) {
      d = ((d % 360) + 360) % 360;
      const s = Math.hypot(e.hspeed, e.vspeed);
      e._dir = d;
      e.hspeed = lengthdirX(s, d);
      e.vspeed = lengthdirY(s, d);
    },
  });
  if (init) Object.assign(e, init);
  if (type.create) type.create(e, state);
  state.entities.push(e);
  return e;
}

export function destroy(e) {
  e.alive = false;
}

export function find(state, typeName) {
  return state.entities.find((e) => e.alive && e.type.name === typeName);
}

export function findAll(state, typeName) {
  return state.entities.filter((e) => e.alive && e.type.name === typeName);
}

export function exists(state, typeName) {
  return !!find(state, typeName);
}

function runHandler(state, key) {
  // Snapshot: entities spawned during a phase don't run that phase this frame.
  const list = state.entities.slice();
  for (const e of list) {
    if (!e.alive) continue;
    const fn = e.type[key];
    if (fn) fn(e, state);
  }
}

function runAlarms(state) {
  const list = state.entities.slice();
  for (const e of list) {
    if (!e.alive) continue;
    for (const k of Object.keys(e.alarm)) {
      if (e.alarm[k] > 0) {
        e.alarm[k] -= 1;
        if (e.alarm[k] === 0 && e.type.alarms && e.type.alarms[k]) {
          e.type.alarms[k](e, state);
        }
      }
    }
  }
}

function runMotion(state) {
  for (const e of state.entities) {
    if (!e.alive) continue;
    // friction reduces speed magnitude, clamping at zero on crossing
    // (negative friction accelerates — several Jevil bullets rely on it)
    if (e.friction !== 0) {
      const s = e.speed;
      if (s !== 0) {
        let ns = s - e.friction;
        if (e.friction > 0 && ns < 0) ns = 0;
        e.speed = ns;
      }
    }
    if (e.gravity !== 0) {
      e.hspeed += lengthdirX(e.gravity, e.gravity_direction);
      e.vspeed += lengthdirY(e.gravity, e.gravity_direction);
    }
    e.x += e.hspeed;
    e.y += e.vspeed;
  }
}

/** One 30fps frame. `input` = { l, r, u, d, z, x } held-state booleans. */
export function stepFrame(state, input) {
  state.input = input;
  runHandler(state, 'beginStep');
  runAlarms(state);
  runHandler(state, 'step');
  runMotion(state);
  runHandler(state, 'collision');
  runHandler(state, 'endStep');
  runHandler(state, 'drawPhase');
  state.entities = state.entities.filter((e) => e.alive);
  state.frame += 1;
}
