// The soul (obj_heart, Chapter 1) and the battle board (obj_growtangle).
//
// The Ch1 heart's wall handling is place_meeting against the board's hollow
// border mask plus the Step_2 "keep" clamp. The board here is an axis-aligned
// square that never moves, so the whole thing reduces to the keep-clamp
// numbers from obj_growtangle/Step_2: left/top border +5, right/bottom
// border -22 (the 20px sprite plus 2). That is a simplification, not a
// translation, and it only holds because Jevil's board is static.

import { spawn, destroy, cue } from './sim.js';

export const BOARD = { x: 320, y: 170, half: 75 };

// Heart collision mask: spr_dodgeheartmask bbox 2..17 of the 20x20 sprite.
export const HEART_MASK = { l: 2, t: 2, r: 17, b: 17 };
export const GRAZE_HALF = 25; // grazebox half-size around heart centre

export const growtangle = {
  name: 'obj_growtangle',
  create(e) {
    e.timer = 0;
    e.maxtimer = 15;
    e.growcon = 1;
    e.image_xscale = 0;
    e.image_yscale = 0;
    e.image_angle = 180;
    e.image_speed = 0;
    e.image_index = 0;
    e.image_alpha = 0.3;
    e.depth = 50;
    // merge_color(c_green, c_lime, 0.5) — both Draw layers use this.
    e.image_blend = 'rgb(0,191,0)';
  },
  step(e, state) {
    let growth = 0;
    if (e.timer < e.maxtimer && e.growcon === 1) growth = 1;
    if (e.timer > 0 && e.growcon === 3) growth = 1;
    if (growth === 1) {
      if (e.growcon === 1) e.timer += 1;
      if (e.growcon === 3) e.timer -= 1;
      e.image_xscale = 2 * (e.timer / e.maxtimer);
      e.image_yscale = e.image_xscale;
      e.image_angle = 180 + (180 * (e.timer / e.maxtimer));
      e.image_alpha = 0.5 + ((e.timer / e.maxtimer) * 0.5);
      if (e.timer >= e.maxtimer && e.growcon === 1) {
        e.growcon = 2;
        e.image_angle = 0;
      }
      if (e.timer <= 0 && e.growcon === 3) destroy(e);
    }
  },
};

export const soul = {
  name: 'obj_heart',
  sprite: 'spr_dodgeheart',
  create(e, state) {
    state.sp = 4;
    e.wspeed = state.sp;
    e.boundaryup = 0;
    e.dmgnoise = 0;
    e.disableslow = state.input && state.input.x ? 1 : 0;
    e.depth = -10;
  },
  step(e, state) {
    const inp = state.input;
    const wspeed = e.wspeed;
    let px = 0;
    let py = 0;
    if (inp.r) px = wspeed;
    if (inp.l) px = -wspeed;
    if (inp.d) py = wspeed;
    if (inp.u) py = -wspeed;

    if (inp.x) {
      if (e.disableslow === 0) {
        px = Math.sign(px) * Math.ceil(Math.abs(px) * 0.5);
        py = Math.sign(py) * Math.ceil(Math.abs(py) * 0.5);
      }
    } else {
      e.disableslow = 0;
    }

    if (state.boardAlive) {
      // keep-clamp inside the board (see header note)
      const lo = BOARD.x - BOARD.half;
      const hi = BOARD.x + BOARD.half;
      const to = BOARD.y - BOARD.half;
      const bo = BOARD.y + BOARD.half;
      if (e.x + px < lo + 5) px = lo + 5 - e.x;
      if (e.x + px > hi - 22) px = hi - 22 - e.x;
      if (e.y + py < to + 5) py = to + 5 - e.y;
      if (e.y + py > bo - 22) py = bo - 22 - e.y;
    } else {
      // no board (final chaos): the room clamp from obj_heart's Step
      if (e.x + px >= 640 - 20) px = 640 - 20 - e.x;
      if (e.x + px <= 0) px = -e.x;
      if (e.y + py <= 0) py = -e.y;
      if (e.y + py >= 320 - 20 + e.boundaryup) py = 320 - 20 + e.boundaryup - e.y;
    }

    e.x += px;
    e.y += py;

    if (e.dmgnoise === 1) {
      e.dmgnoise = 0;
      cue(state, 'hurt');
    }

    state.inv -= 1;
    if (state.inv > 0) {
      e.image_speed = 0.25;
      e.image_index = (e.image_index + 0.25) % 2;
    } else {
      e.image_speed = 0;
      e.image_index = 0;
    }

    state.heartx = e.x + 2;
    state.hearty = e.y + 2;
  },
};

export function heartRect(h) {
  return {
    l: h.x + HEART_MASK.l, t: h.y + HEART_MASK.t,
    r: h.x + HEART_MASK.r, b: h.y + HEART_MASK.b,
  };
}

export function grazeRect(h) {
  return {
    l: h.x + 10 - GRAZE_HALF, t: h.y + 10 - GRAZE_HALF,
    r: h.x + 10 + GRAZE_HALF, b: h.y + 10 + GRAZE_HALF,
  };
}
