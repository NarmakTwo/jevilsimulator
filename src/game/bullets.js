// Jevil's bullet objects, translated from the Chapter 1 decompile.
//
// Sources (othershit/Exported_Project/objects/...):
//   obj_collidebullet/Other_15.gml        damage + destroy on contact
//   obj_regularbullet/Create_0,Step_0     wall bounds
//   obj_regularbullet_permanent/Other_15  damage without destroy
//   obj_suitbomb/*                        suit bombs (types 46-50)
//   obj_heartbomb_blast/*                 the heart bomb's orbiting cluster
//   obj_carouselbullet/*                  carousel horses (61, 62)
//   obj_spadering/*                       spade rings (65, 68)
//   obj_clubsbullet_dark/*                dark clubs rush (72)
//   obj_dbullet_vert/*                    vertical diamonds (73, 74)
//   obj_joker_teleport/*                  teleporting Jevil throws (70, 71)
//   obj_centerscythe/*                    scythe carousel (75, 76)
//   obj_laserscythe/*                     final chaos scythes (77)

import { spawn, destroy, cue, find, findAll } from './sim.js';
import { random, choose, lengthdirX, lengthdirY, pointDirection, moveTowardsPoint } from './gml.js';
import { BOARD, heartRect, grazeRect } from './soul.js';
import { bulletHits } from './meta.js';
import { pixelHits, pixelHitsAt, pixelHitsRect } from './hitmask.js';
import { scrDamage, scrDamageAll, tensionHeal } from './party.js';

// ---------------------------------------------------------------- framework

/**
 * Shared collision phase for every bullet: contact damage (obj_heart's
 * Collision -> bullet Other_15), then graze (obj_grazebox's Collision).
 */
function bulletCollision(e, state) {
  const heart = find(state, 'obj_heart');
  if (!heart) return;

  const hitScale = e.sprite_index === 'spr_joker_scythebody' ? 0.75 : 1;
  const contact = state.accurateHitbox
    ? accurateContact(e, heart)
    : bulletHits(e, heartRect(heart), 0, hitScale);
  if (e.active === 1 && state.inv < 0 && contact) {
    if (e.target !== 3) scrDamage(state, e);
    else scrDamageAll(state, e);
    if (!e.type.permanent) {
      destroy(e);
      return;
    }
  }

  if (state.inv < 0 && e.image_alpha > 0.05 && bulletHits(e, grazeRect(heart))) {
    if (state.mode === 'endless') {
      if (e.grazed === 0) {
        e.grazed = 1;
        cue(state, 'graze');
        state.grazefx = 10;
      } else {
        state.grazefx = Math.max(state.grazefx || 0, 2);
      }
      return;
    }
    if (e.grazed === 1) {
      tensionHeal(state, e.grazepoints / 20);
      if (state.turntimer >= 10) state.turntimer -= e.timepoints / 20;
      state.grazefx = Math.max(state.grazefx || 0, 2);
    } else if (e.grazed === 0) {
      e.grazed = 1;
      tensionHeal(state, e.grazepoints);
      if (state.turntimer >= 10) state.turntimer -= e.timepoints;
      cue(state, 'graze');
      state.grazefx = 10;
      if (e.type.onGraze) e.type.onGraze(e, state);
    }
  }
}

/** PIXEL mode: opaque sprite pixels. Laserscythe beam is a canvas rect. */
function accurateContact(e, heart) {
  if (e.type.name !== 'obj_laserscythe' && (e.image_alpha ?? 1) <= 0) return false;
  if (e.type.name === 'obj_laserscythe') {
    if (e.explode < 2) {
      const scythe = pixelHitsAt({
        x: e.remx,
        y: e.remy,
        image_xscale: e.scale,
        image_yscale: e.scale,
        image_angle: e.remrot,
        image_index: 0,
        sprite_index: 'spr_joker_scythebody',
      }, heart);
      if (scythe) return true;
    }
    if (e.explode >= 1) {
      const w = Math.max(0, e.image_xscale * 5);
      return pixelHitsRect({ l: e.x - w / 2, r: e.x + w / 2, t: 0, b: 480 }, heart);
    }
    return false;
  }
  return pixelHits(e, heart);
}

function wallDestroy(e) {
  if (e.x < -40 || e.x > 680 || e.y < -40 || e.y > 520) destroy(e);
}

/** obj_regularbullet — destroyed on contact and at the room walls. */
export const regularbullet = {
  name: 'obj_regularbullet',
  collision: bulletCollision,
  create(e) {
    e.grazepoints = 5;
    e.timepoints = 5;
    e.inv = 60;
    e.damage = 124;
    e.active = 1;
    e.depth = -5;
  },
  step(e) {
    wallDestroy(e);
  },
};

/** obj_collidebullet — same but no wall check (spade rings fly far out). */
export const collidebullet = {
  name: 'obj_collidebullet',
  collision: bulletCollision,
  create(e) {
    e.active = 0;
    e.depth = -5;
  },
};

/** scr_bullet_inherit — the controller stamps its envelope onto a bullet. */
export function bulletInherit(b, dc) {
  b.damage = dc.damage;
  b.grazepoints = dc.grazepoints;
  b.timepoints = dc.timepoints;
  b.inv = dc.inv;
  b.target = dc.target;
  b.grazed = 0;
  b.grazetimer = 0;
}

// --------------------------------------------------------------- suit bombs

export const suitbomb = {
  name: 'obj_suitbomb',
  create(e) {
    e.visible = false;
    e.bombtype = choose(0, 1, 2, 3);
    e.y = -80;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.con = 0;
    e.timer = 0;
    e.vspeed = 10;
    e.maxtimer = 20 + random(16);
    e.explodedraw = 0;
    e.active = 0; // the bomb itself never damages — its burst does
    e.depth = 5;
  },
  step(e, state) {
    if (e.con === 0) {
      e.sprite_index = ['spr_bomb_spade', 'spr_bomb_diamond', 'spr_bomb_heart', 'spr_bomb_club'][e.bombtype];
      e.visible = true;
      e.con = 1;
    }
    if (e.con === 1) {
      e.timer += 1;
      if (e.timer >= 10) {
        if (e.timer % 5 === 0) cue(state, 'bombfall');
        e.image_speed = e.timer / e.maxtimer;
        e.image_index = (e.image_index + e.image_speed) % 2;
      }
      if (e.timer >= e.maxtimer) {
        e.con = 2;
        e.timer = 0;
        e.hspeed = 0;
        e.vspeed = 0;
      }
    }
    if (e.con === 2) {
      cue(state, 'bomb');
      const heart = find(state, 'obj_heart');
      if (e.bombtype === 0) {
        const dir = random(360);
        for (let i = 0; i < 12; i += 1) {
          const s = spawn(state, regularbullet, e.x, e.y);
          bulletInherit(s, e);
          s.active = 1;
          s.sprite_index = 'spr_spadebullet';
          s.direction = dir + i * 30;
          s.speed = 8;
          s.image_angle = s.direction;
        }
      }
      if (e.bombtype === 1) {
        for (let i = 0; i < 3; i += 1) {
          const d = spawn(state, regularbullet, e.x, e.y);
          bulletInherit(d, e);
          moveTowardsPoint(d, heart.x + 8, heart.y + 8, 11);
          d.speed = 11 - i;
          d.image_angle = d.direction;
          d.sprite_index = 'spr_diamondbullet';
        }
      }
      if (e.bombtype === 2) {
        const h = spawn(state, heartblast, e.x, e.y);
        bulletInherit(h, e);
      }
      if (e.bombtype === 3) {
        const dir = pointDirection(e.x, e.y, heart.x + 8, heart.y + 8);
        for (let i = 0; i < 3; i += 1) {
          const c = spawn(state, regularbullet, e.x, e.y);
          c.sprite_index = 'spr_clubsbullet';
          bulletInherit(c, e);
          c.active = 1;
          c.direction = dir - 20 + i * 20;
          c.image_angle = c.direction;
          c.speed = 8;
        }
      }
      e.con = 3;
    }
    if (e.con === 3) {
      e.explodedraw += 1;
      if (e.explodedraw >= 40) destroy(e);
    }
  },
};

/** obj_heartbomb_blast — 4 heart bullets orbiting a homing centre. */
export const heartblast = {
  name: 'obj_heartbomb_blast',
  create(e) {
    e.made = 0;
    e.active = 0;
    e.pausetimer = 0;
    e.con = 0;
    e.siner = 0;
    e.maxlength = 0;
    e.visible = false;
    e.sons = [];
  },
  step(e, state) {
    if (e.made === 0) {
      for (let i = 0; i < 4; i += 1) {
        const s = spawn(state, regularbullet, e.x, e.y);
        s.sprite_index = 'spr_heartbullet';
        bulletInherit(s, e);
        e.sons.push(s);
      }
      e.made = 1;
    }
    e.pausetimer += 1;
    if (e.pausetimer >= 10 && e.con === 0) {
      const heart = find(state, 'obj_heart');
      moveTowardsPoint(e, heart.x + 8, heart.y + 8, 7);
      e.con = 1;
    }
    e.siner += 1;
    if (e.maxlength < 40) e.maxlength += 4;
    for (let i = 0; i < 4; i += 1) {
      const s = e.sons[i];
      if (s && s.alive) {
        s.x = e.x + lengthdirX(e.maxlength, e.siner * 3 + i * 90);
        s.y = e.y + lengthdirY(e.maxlength, e.siner * 3 + i * 90);
      }
    }
    if (e.x < -60 || e.x > 700 || e.y < -60 || e.y > 540) destroy(e);
  },
};

// ----------------------------------------------------------------- carousel

export const carouselbullet = {
  name: 'obj_carouselbullet',
  sprite: 'spr_carousel',
  permanent: true,
  create(e) {
    e.siner = 0;
    e.t = 0;
    e.hspeed = 6;
    e.sinspeed = 1;
    e.altmode = 0;
    e.altsin = 0;
    e.vsin = 0;
    e.active = 0;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.image_alpha = 0;
    e.behind = false;
  },
  step(e) {
    if (e.t <= 25) e.image_alpha += 0.04;
    if (e.t === 25) e.active = 1;
    if (e.t === 0) e.hspeed = 0;
    e.t += 1;
    e.siner += e.sinspeed;
    const sinfactor0 = Math.sin((e.siner - 1) / 20);
    const sinfactor = Math.sin(e.siner / 20);
    const sinsign = sinfactor - sinfactor0;
    e.x = BOARD.x - sinfactor * 150;
    e.image_xscale = sinsign * 50;
    if (e.image_xscale > 2) e.image_xscale = 2;
    if (e.image_xscale < -2) e.image_xscale = -2;
    if (sinsign > 0) {
      e.depth = 21;
      e.active = 0;
      e.behind = true; // drawn gray behind the board
    }
    if (sinsign < 0) {
      e.depth = 0;
      if (e.image_alpha >= 1) e.active = 1;
      e.behind = false;
    }
    e.vsin += 1;
    if (e.altmode === 0 || e.altmode === 2 || e.altmode === 3) {
      e.y += Math.sin(e.vsin / 10) * 3.5;
    }
    if (e.altmode === 1) e.y -= Math.sin(e.vsin / 10) * 3.5;
  },
  collision: bulletCollision,
};

// --------------------------------------------------------------- spade ring

export const spadering = {
  name: 'obj_spadering',
  create(e) {
    e.maxspade = 8;
    e.t = 0;
    e.con = 0;
    e.startspade = 0;
    e.spadet = 0;
    e.startang = random(360);
    e.grav = 0.2;
    e.size = 1;
    e.special = 0;
    e.side = 0;
    e.spades = [];
    e.visible = false;
    e.active = 0;
  },
  step(e, state) {
    if (e.t === 0) {
      if (e.size > 1) e.startang = -random(180);
      for (let i = 0; i < e.maxspade; i += 1) {
        let spadeang = (360 / e.maxspade) * i + e.startang;
        if (e.side === 1) spadeang = -spadeang;
        const sx = lengthdirX(300, spadeang + 180);
        const sy = lengthdirY(300, spadeang + 180);
        const s = spawn(state, collidebullet, sx + BOARD.x, sy + BOARD.y);
        bulletInherit(s, e);
        s.sprite_index = 'spr_spadebullet';
        s.image_alpha = 0;
        s.active = 1;
        s.direction = spadeang;
        s.image_angle = spadeang;
        s.speed = 26;
        s.image_xscale = e.size;
        s.image_yscale = e.size;
        e.spades.push(s);
      }
    }
    if (e.t >= 1 && e.t < 15) {
      for (const s of e.spades) {
        if (!s.alive) continue;
        s.speed *= 0.87;
        s.image_alpha += 0.1;
      }
    }
    if (e.t === 15) {
      for (const s of e.spades) {
        if (!s.alive) continue;
        s.speed = 0;
        s.image_alpha += 0.1;
      }
    }
    if (e.t >= 15 && e.con === 0) {
      e.spadet += 1;
      if (e.special === 1) e.spadet += 6;
      if (e.spadet >= 4) {
        const s = e.spades[e.startspade];
        if (s && s.alive) {
          s.gravity_direction = s.direction;
          s.speed = -3.4;
          s.gravity = e.grav;
        }
        e.startspade += 1;
        if (e.startspade >= e.maxspade) {
          e.con = 1;
          destroy(e);
        }
        e.spadet = 0;
      }
    }
    e.t += 1;
  },
};

// --------------------------------------------------------------- dark clubs

export const clubsdark = {
  name: 'obj_clubsbullet_dark',
  sprite: 'spr_clubsbullet',
  create(e) {
    e.active = 0;
    e.dtimer = 0;
    e.btype = 0;
    e.initangle = 0;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.image_blend = '#404040';
    e.depth = -6;
  },
  step(e, state) {
    e.dtimer += 1;
    const heart = find(state, 'obj_heart');
    if (e.btype === 2) {
      if (e.dtimer === 20 || e.dtimer === 22 || e.dtimer === 24) {
        moveTowardsPoint(e, heart.x + 8, heart.y + 8, 0.1);
        const dir = e.direction;
        const names = ['spr_clubsball_b', 'spr_clubsball_c', 'spr_clubsball_a'];
        const offs = [0, -19, 19];
        for (let i = 0; i < 3; i += 1) {
          const b = spawn(state, regularbullet, e.x, e.y);
          b.sprite_index = names[i];
          b.direction = dir + offs[i] - 2 + e.initangle;
          b.speed = 5;
          b.image_angle = dir;
          bulletInherit(b, e);
        }
        e.initangle += 2;
      }
      if (e.dtimer === 26) {
        spawn(state, afterimage, e.x, e.y, {
          sprite_index: e.sprite_index, image_angle: e.image_angle,
          image_xscale: e.image_xscale, image_yscale: e.image_yscale,
          image_blend: e.image_blend,
        });
        destroy(e);
      }
    }
  },
  collision: bulletCollision,
};

export const afterimage = {
  name: 'obj_afterimage',
  create(e) {
    e.depth = 10;
  },
  step(e) {
    e.image_alpha -= 0.04;
    if (e.image_alpha < 0) destroy(e);
  },
};

// --------------------------------------------------------- vertical diamonds

export const dbulletVert = {
  name: 'obj_dbullet_vert',
  sprite: 'spr_diamondbullet_vert',
  create(e) {
    if (e.y < 20) e.y = 20;
    if (e.y > 460) e.y = 460;
    e.grazepoints = 5;
    e.timepoints = 5;
    e.damage = 124;
    e.active = 0;
    e.image_alpha = 0;
    e.btype = 0;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.depth = -4;
  },
  // obj_dbullet_vert runs its logic in the Draw event; drawPhase is this
  // port's slot for exactly that.
  drawPhase(e, state) {
    if (e.active === 0) {
      if (e.image_alpha < 1) {
        e.image_alpha += 0.1;
        if (e.btype === 1) {
          e.vspeed = 3;
          e.gravity = -0.5;
        }
      } else {
        if (e.btype === 0) {
          const heart = find(state, 'obj_heart');
          if (heart.y + 8 < e.y) {
            e.vspeed = 1;
            e.gravity = -0.2;
          } else {
            e.vspeed = -2;
            e.gravity = 1;
          }
        }
        e.active = 1;
      }
    }
    if (e.btype === 0 && e.speed > 8) e.speed = 8;
    if (e.y > 500 || e.y < -20) destroy(e);
  },
  collision: bulletCollision,
};

// ------------------------------------------------------------ Jevil teleport

export const jokerTeleport = {
  name: 'obj_joker_teleport',
  sprite: 'spr_joker_teleport',
  create(e) {
    e.con = 0;
    e.image_xscale = 0;
    e.image_yscale = 2;
    e.timer = 0;
    e.btype = 0;
    e.damage = 100;
    e.grazepoints = 4;
    e.timepoints = 2;
    e.inv = 60;
    e.sndcon = 0;
    e.active = 0;
    e.depth = -2;
    if (e.x < 320) e.sprite_index = 'spr_joker_teleport_r';
  },
  step(e, state) {
    const heart = find(state, 'obj_heart');
    if (e.con === 0) {
      if (e.sndcon === 0) {
        cue(state, 'swing');
        e.sndcon = 1;
      }
      e.image_index = 0;
      if (e.image_xscale < 2) {
        e.image_xscale += 0.4;
      } else {
        e.image_xscale = 2;
        e.con = 1;
        e.timer = 0;
      }
    }
    if (e.con === 1) {
      e.timer += 1;
      if (e.timer >= 8) {
        if (e.sndcon === 1 && e.btype < 3) {
          cue(state, 'joker_oh');
          e.sndcon = 2;
        }
        e.image_index = 1;
        e.con = 2;
        e.timer = 0;
        if (e.btype === 0) {
          const b = spawn(state, collidebullet, e.x, e.y);
          b.sprite_index = 'spr_diamondbullet';
          b.active = 1;
          bulletInherit(b, e);
          moveTowardsPoint(b, heart.x + 10, heart.y + 10, 8);
          b.image_angle = b.direction;
          b.image_xscale = 0.7;
          b.image_yscale = 0.7;
        }
        if (e.btype === 1) {
          for (let i = 0; i < 5; i += 1) {
            const b = spawn(state, collidebullet, e.x, e.y);
            b.sprite_index = 'spr_spadebullet';
            b.active = 1;
            bulletInherit(b, e);
            moveTowardsPoint(b, heart.x + 10, heart.y + 10, 4.5);
            b.direction = b.direction - 36 + 18 * i;
            b.image_angle = b.direction;
            b.image_xscale = 0.4;
            b.image_yscale = 0.4;
          }
        }
      }
    }
    if (e.con === 2) {
      e.timer += 1;
      if (e.timer >= 10) {
        e.con = 4;
        e.timer = 0;
      }
    }
    if (e.con === 4) {
      if (e.sndcon === 2) {
        cue(state, 'swing');
        e.sndcon = 3;
      }
      if (e.image_xscale > 0) {
        e.image_xscale -= 0.4;
        e.image_yscale += 0.2;
      } else {
        destroy(e);
      }
    }
  },
};

// --------------------------------------------------------- centre scythes

export const centerscythe = {
  name: 'obj_centerscythe',
  sprite: 'spr_joker_scythebody',
  permanent: true,
  create(e, state) {
    e.grazepoints = 3;
    e.timepoints = 2;
    e.damage = 124;
    e.active = 0;
    e.image_alpha = 0;
    e.rotspeed = 0;
    e.insanity = 1;
    e.chasecon = 1;
    e.centerx = BOARD.x;
    e.centery = BOARD.y;
    e.radius = 150;
    e.sine = 0;
    e.sinespeed = 1.4;
    e.dir = random(70);
    e.dirspeed = 1.5 * choose(1, -1);
    e.un = 0;
    e.scythetimer = -5;
    e.scythesidex = 1;
    e.noisebuffer = 0;
    e.stype = 0;
    e.king = 0;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.depth = -3;
  },
  step(e, state) {
    if (e.chasecon === 1) {
      e.image_alpha += 0.04;
      if (e.image_alpha >= 1) {
        e.image_alpha = 1;
        e.chasecon = 2;
        e.active = 1;
      }
    }
    if (e.chasecon === 2) {
      if (e.un === 0 && e.rotspeed <= 10) e.rotspeed += 1;
      if (e.un === 1 && e.rotspeed >= -10) e.rotspeed -= 1;
      e.sine += e.sinespeed;
      e.dir += e.dirspeed;
      if (e.insanity === 1) {
        if (e.dirspeed > 0 && e.dirspeed < 3) e.dirspeed += 0.01;
        if (e.dirspeed < 0 && e.dirspeed > -3) e.dirspeed -= 0.01;
      }
      const length = Math.cos(e.sine / 18) * e.radius;
      e.x = e.centerx - lengthdirX(length, e.dir);
      e.y = e.centery - lengthdirY(length, e.dir);
      if (e.king === 1) {
        e.noisebuffer -= 1;
        if (Math.abs(length) <= 8 && e.noisebuffer < 0) {
          cue(state, 'swing');
          e.noisebuffer = 10;
        }
      }
    }
    // king of type 1 (dc 76): the red scythe swipes across the middle
    if (e.king === 1 && e.stype === 1) {
      e.scythetimer += 1;
      if (e.scythetimer === 60) {
        cue(state, 'spearappear');
        const s = spawn(state, collidebullet,
          e.centerx + e.radius * e.scythesidex, e.centery + 60 * e.scythesidex);
        s.image_xscale = 2;
        s.image_yscale = 2;
        s.image_alpha = 0;
        s.sprite_index = 'spr_joker_scythebody';
        s.image_blend = '#ff4040';
        s.active = 1;
        s.permanentRef = true;
        bulletInherit(s, e);
        e.sbul = s;
      }
      if (e.scythetimer >= 60 && e.scythetimer < 70 && e.sbul && e.sbul.alive) {
        e.sbul.image_angle += 10 * e.scythesidex;
        e.sbul.image_alpha += 0.1;
      }
      if (e.scythetimer >= 85 && e.scythetimer < 90 && e.sbul && e.sbul.alive) {
        e.sbul.hspeed -= 3 * e.scythesidex;
      }
      if (e.scythetimer >= 100 && e.scythetimer < 105 && e.sbul && e.sbul.alive) {
        e.sbul.image_alpha -= 0.2;
      }
      if (e.scythetimer >= 105) {
        if (e.sbul && e.sbul.alive) destroy(e.sbul);
        e.scythesidex = e.scythesidex === -1 ? 1 : -1;
        e.scythetimer = 59;
      }
    }
    e.image_angle += e.rotspeed;
    if (e.grazed === 1) {
      e.grazetimer += 1;
      if (e.grazetimer >= 30) {
        e.grazed = 0;
        e.grazetimer = 0;
      }
    }
  },
  collision: bulletCollision,
};

/** Launch the 4-scythe carousel (dc types 75/76). */
export function launchCenterscythes(state, dc, stype) {
  const cx = BOARD.x;
  const cy = BOARD.y;
  const configs = [
    { x: cx - 150, y: cy, dirBase: null, un: 0 },
    { x: cx + 150, y: cy, dirBase: 180, un: 1 },
    { x: cx, y: cy - 150, dirBase: 90, un: 0 },
    { x: cx, y: cy + 150, dirBase: 270, un: 1 },
  ];
  const king = spawn(state, centerscythe, configs[0].x, configs[0].y);
  king.king = 1;
  king.stype = stype;
  if (stype === 1) {
    king.insanity = 0;
    king.sinespeed = 1.3;
    king.scythesidex = choose(1, -1);
  }
  const kingDir = king.dir;
  for (let i = 1; i < 4; i += 1) {
    const s = spawn(state, centerscythe, configs[i].x, configs[i].y);
    s.stype = stype;
    s.sine = 0;
    s.dir = configs[i].dirBase + kingDir;
    s.un = configs[i].un;
    s.sinespeed = king.sinespeed;
    s.dirspeed = king.dirspeed;
    s.insanity = king.insanity;
    s.x = s.centerx - lengthdirX(s.radius, s.dir);
    s.y = s.centery - lengthdirY(s.radius, s.dir);
  }
  for (const s of findAll(state, 'obj_centerscythe')) {
    bulletInherit(s, dc);
    s.grazepoints = dc.grazepoints;
  }
}

// ----------------------------------------------------------- laser scythes

export const laserscythe = {
  name: 'obj_laserscythe',
  sprite: 'spr_joker_scythebody',
  permanent: true,
  create(e) {
    e.grazepoints = 15;
    e.timepoints = 0;
    e.damage = 124;
    e.active = 1;
    e.image_xscale = 2;
    e.image_yscale = 2;
    e.image_angle = random(360);
    e.rotspeed = 14;
    e.vspeed = 5;
    e.gravity = 1;
    e.explode = 0;
    e.explodetimer = 0;
    e.remrot = e.image_angle;
    e.remx = e.x;
    e.remy = e.y;
    e.scale = 2;
    e.depth = -6;
  },
  step(e, state) {
    if (e.explode === 0) {
      e.remx = e.x;
      e.remy = e.y;
      e.image_angle += e.rotspeed;
      e.remrot = e.image_angle;
    }
    if (e.y >= 380 && e.explode === 0) {
      cue(state, 'scytheburst');
      e.remx = e.x;
      e.remy = e.y;
      e.explode = 1;
      e.remrot = e.image_angle;
      e.image_angle = 0;
      e.hspeed = 0;
      e.vspeed = 0;
      e.gravity = 0;
      e.sprite_index = 'spr_tallpx';
      e.grazed = 0;
      e.y = 0;
    }
    if (e.explode === 1) {
      e.active = 0;
      e.image_xscale += 8;
      if (e.image_xscale >= 16) e.active = 1;
      if (e.image_xscale >= 32) e.explode = 2;
    }
    if (e.explode === 2) {
      e.image_xscale -= 4;
      if (e.image_xscale <= 16) {
        e.image_alpha -= 0.25;
        e.active = 0;
      }
      if (e.image_xscale <= 0) destroy(e);
    }
  },
  onGraze(e, state) {
    // grazing a laser scythe feeds the controller's wind-down counter
    const dc = find(state, 'obj_dbulletcontroller');
    if (dc) dc.made += 0.2;
    e.grazed = 2;
  },
  collision: bulletCollision,
};
