// obj_dbulletcontroller — the Jevil block (joker == 1, types 46..77),
// translated from othershit/Exported_Project/objects/obj_dbulletcontroller/
// Step_0.gml lines 1000-1674. Each jattack in obj_joker's Other_15 creates
// one of these with a type; the controller owns the spawn cadence.
//
// jattack -> type map (obj_joker/Other_15.gml):
//   0->70  1->65  2->49  3->75  4->62  5->50  6->73  7->68
//   8->61  9->48 10->72 11->76 12->71 13->46 14->74 15->77

import { spawn, destroy, cue, find, exists } from './sim.js';
import { random, choose, lengthdirX, lengthdirY } from './gml.js';
import { BOARD } from './soul.js';
import {
  suitbomb, carouselbullet, spadering, clubsdark, dbulletVert,
  jokerTeleport, laserscythe, launchCenterscythes, bulletInherit,
} from './bullets.js';

function bombWave(state, e, forceType) {
  const xx = choose(0, 1);
  const basex = BOARD.x;
  let idealx;
  if (xx === 0) idealx = basex - 180 - random(100);
  else idealx = basex + 180 + random(100);
  const bomb = spawn(state, suitbomb, idealx, -20);
  bulletInherit(bomb, e);
  if (forceType !== undefined) bomb.bombtype = forceType;
  else if (bomb.bombtype === 2) bomb.bombtype = choose(0, 1, 2, 3);
  e.btimer = 0;
}

export const dbulletcontroller = {
  name: 'obj_dbulletcontroller',
  create(e) {
    e.btimer = 99;
    e.ctype = 1;
    e.side = 1;
    e.damage = 100;
    e.grazepoints = 1;
    e.timepoints = 1;
    e.inv = 60;
    e.target = 0;
    e.made = 0;
    e.special = 0;
    e.visible = false;
    e.active = 0;
  },
  step(e, state) {
    e.btimer += 1;
    const t = e.ctype;
    const heart = find(state, 'obj_heart');

    // 46: every suit, 48: spades, 49: hearts, 50: clubs (47 diamonds unused)
    if (t === 46 && e.btimer >= 12) bombWave(state, e);
    if (t === 47 && e.btimer >= 12) bombWave(state, e, 1);
    if (t === 48 && e.btimer >= 12) bombWave(state, e, 0);
    if (t === 49 && e.btimer >= 20) bombWave(state, e, 2);
    if (t === 50 && e.btimer >= 12) bombWave(state, e, 3);

    // 61: alternating carousel pairs on a shared vertical seed
    if (t === 61 && e.btimer >= 40 && e.made === 0) {
      e.btimer = 0;
      e.made = 1;
      const vseed = random(300);
      for (let j = 0; j < 3; j += 1) {
        for (let i = 0; i < 3; i += 1) {
          let h = spawn(state, carouselbullet, BOARD.x + 150, BOARD.y - 80 + i * 80);
          h.siner = j * 42;
          h.vsin = vseed;
          h.image_index = 0;
          h.altmode = 2;
          h.sinspeed = 1.1;
          bulletInherit(h, e);
          h = spawn(state, carouselbullet, BOARD.x + 150, BOARD.y - 80 + i * 80);
          h.siner = j * 42 + 21;
          h.vsin = vseed;
          h.image_index = 1;
          h.altmode = 1;
          h.sinspeed = 1.1;
          bulletInherit(h, e);
          if (Math.floor(random(50)) === 1) h.image_index = 2;
        }
      }
    }

    // 62: 21 horses, phased rows
    if (t === 62 && e.btimer >= 40 && e.made === 0) {
      e.btimer = 0;
      e.made = 1;
      for (let i = 0; i < 3; i += 1) {
        for (let j = 0; j < 7; j += 1) {
          const h = spawn(state, carouselbullet, BOARD.x + 150, BOARD.y - 80 + i * 80);
          h.siner = j * 18;
          h.vsin = j * 9;
          h.sinspeed = 1.15;
          h.altmode = 3;
          bulletInherit(h, e);
        }
      }
    }

    // 65 / 68: spade rings
    if (t === 65 && e.btimer >= 60) {
      const ring = spawn(state, spadering, BOARD.x, BOARD.y);
      ring.maxspade = 10;
      ring.grav = 0.4;
      bulletInherit(ring, e);
      e.btimer = 0;
    }
    if (t === 68) {
      if (heart) heart.wspeed = 5;
      if (e.btimer >= 54) {
        const ring = spawn(state, spadering, BOARD.x, BOARD.y);
        ring.side = choose(0, 1);
        ring.grav = 0.45;
        ring.maxspade = 10;
        bulletInherit(ring, e);
        e.btimer = 0;
      }
    }

    // 70 / 71: teleporting Jevil throws
    if (t === 70 && e.btimer >= 20 && state.turntimer >= 30) {
      const jx = choose(BOARD.x - 100 - random(100), BOARD.x + 100 + random(100));
      const jy = choose(BOARD.y - random(100), BOARD.y + random(100));
      const j = spawn(state, jokerTeleport, jx, jy);
      j.btype = 1;
      bulletInherit(j, e);
      j.active = 0;
      e.btimer = 0;
    }
    if (t === 71 && e.btimer >= 9 && state.turntimer >= 20) {
      const jx = choose(BOARD.x - 100 - random(100), BOARD.x + 100 + random(100));
      const jy = choose(BOARD.y - random(100), BOARD.y + random(100));
      const j = spawn(state, jokerTeleport, jx, jy);
      bulletInherit(j, e);
      j.active = 0;
      e.btimer = 0;
    }

    // 72: dark clubs diving past the soul
    if (t === 72 && e.btimer >= 18) {
      e.btimer = 0;
      let dir;
      if (e.side === 1) dir = choose(225, 315);
      else dir = choose(45, 135);
      const xx = lengthdirX(360, dir);
      const yy = lengthdirY(360, dir);
      const d = spawn(state, clubsdark, heart.x + 8 + xx, heart.y + 8 + yy);
      d.direction = dir + 180;
      d.speed = 20;
      d.friction = 1;
      d.btype = 2;
      d.damage = e.damage;
      d.target = e.target;
      d.image_angle = d.direction;
      e.side = e.side === 1 ? -1 : 1;
    }

    // 73 / 74: vertical diamonds
    if (t === 73 && e.btimer >= 4) {
      e.btimer = 0;
      let xx = -100 + random(200);
      if (choose(0, 1, 2, 3) === 3) xx = -10 + random(20);
      const db = spawn(state, dbulletVert, heart.x + 8 + xx, BOARD.y + 100);
      db.btype = 1;
      db.damage = e.damage;
      db.target = e.target;
      db.timepoints = 2;
    }
    if (t === 74 && e.btimer >= 9) {
      e.btimer = 0;
      const radius = 140 + random(40);
      const yy = radius * e.side;
      let xx = -100 + random(200);
      if (choose(0, 1, 2, 3) === 3) xx = -10 + random(20);
      const d = spawn(state, dbulletVert, heart.x + 8 + xx, heart.y + 8 + yy);
      d.grazepoints = 12;
      d.timepoints = 2;
      d.damage = e.damage;
      d.target = e.target;
    }

    // 75 / 76: the scythe carousel
    if ((t === 75 || t === 76) && e.special === 0) {
      cue(state, 'spearappear');
      launchCenterscythes(state, e, t === 76 ? 1 : 0);
      e.special = 1;
    }

    // 77: FINAL CHAOS
    if (t === 77) {
      state.sp = 10;
      if (heart) heart.wspeed = 10;
      if (e.special === 0) {
        cue(state, 'joker_byebye');
        e.prevmake = 0;
        e.special = 1;
        e.rank = 16;
        e.realtimer = 0;
        e.chase = 0;
        e.made = 0;
        e.amount = 0;
        e.jokertimer = 0;
        state.darkfade = 0;
      }
      if (e.realtimer >= 0 && e.realtimer < 10) {
        state.darkfade = Math.min(1, (state.darkfade || 0) + 0.1);
        state.boardAlpha = Math.max(0, (state.boardAlpha ?? 1) - 0.1);
        if (heart) {
          heart.y += 16;
          heart.boundaryup = 160;
        }
      }
      if (e.realtimer === 10) {
        state.boardAlive = false; // obj_battlesolid destroyed
      }
      if (e.realtimer === 20) spawn(state, laserscythe, 40, -60);
      if (e.realtimer === 40) spawn(state, laserscythe, 570, -60);
      if (e.realtimer >= 60 && e.amount < 30) {
        if (e.btimer >= e.rank) {
          if (e.rank > 7) e.rank -= 1;
          let which = Math.floor(random(5));
          if (which === e.prevmake) which = Math.floor(random(5));
          if (e.chase === 3) {
            which = Math.floor((heart.x + 8) / 90);
            e.chase = 0;
          }
          spawn(state, laserscythe, 40 + 90 * which, -60);
          if (which === 1) spawn(state, laserscythe, 40 + 450, -60);
          if (which === 0) spawn(state, laserscythe, 40 + 540, -60);
          e.prevmake = which;
          e.btimer = 0;
          e.chase += 1;
          e.amount += 1;
        }
      }
      if (e.amount >= 29 - e.made && e.special === 1) {
        e.jokertimer = 0;
        const j = spawn(state, jokerTeleport, 320, 100);
        j.btype = 66;
        j.depth = -30;
        e.special = 2;
      }
      if (e.special === 2) {
        e.jokertimer += 1;
        if (e.jokertimer === 10) cue(state, 'joker_neochaos');
        if (e.jokertimer === 40 || e.jokertimer === 98) {
          spawn(state, laserscythe, 40, -60);
          spawn(state, laserscythe, 580, -60);
        }
        if (e.jokertimer === 46 || e.jokertimer === 86) {
          spawn(state, laserscythe, 130, -60);
          spawn(state, laserscythe, 490, -60);
        }
        if (e.jokertimer === 52 || e.jokertimer === 80) {
          spawn(state, laserscythe, 220, -60);
          spawn(state, laserscythe, 400, -60);
        }
        if (e.jokertimer === 66 || e.jokertimer === 98) {
          spawn(state, laserscythe, 310, -60);
        }
        if (e.jokertimer === 130) {
          const last = spawn(state, laserscythe, 320, -320);
          cue(state, 'rumble');
          last.vspeed = 1;
          last.gravity = 0.02;
          last.image_xscale = 16;
          last.image_yscale = 16;
          last.scale = 16;
          last.rotspeed = 0;
          last.image_angle = 160;
          e.lastscythe = last;
          state.fadewhite = -0.3;
        }
        if (e.jokertimer >= 131) {
          if (e.lastscythe && e.lastscythe.alive) {
            e.lastscythe.x = 320 + random(8);
          }
          state.fadewhite += 0.01;
          if (state.fadewhite >= 1) {
            state.darkfade = 0;
            if (e.lastscythe && e.lastscythe.alive) destroy(e.lastscythe);
          }
          if (state.fadewhite >= 1.3) e.special = 3;
        }
      }
      if (e.special === 3) {
        if (heart) {
          heart.x = 320;
          heart.y = 120;
        }
        state.fadewhite -= 0.1;
        if (state.fadewhite <= 0) {
          state.fadewhite = 0;
          state.turntimer = 11;
          e.special = 4;
        }
      }
      e.realtimer += 1;
    }
  },
};
