// obj_dmgwriter — floating damage numbers. Same motion as rory/sim/dmgnumbers.js.

export const TYPE_PARTY = -1;
export const TYPE_DEAD = 4;
export const TYPE_HEAL = 3;
export const MSG_MAX = 3;

const LIGHTB = '#80ffff';
const LIGHTF = '#ff99ff';
const LIGHTG = '#80ff80';

export function dmgColor(type) {
  if (type === 0) return LIGHTB;
  if (type === 1) return LIGHTF;
  if (type === 2) return LIGHTG;
  if (type === TYPE_HEAL) return '#00ff00';
  if (type === TYPE_DEAD) return '#ff0000';
  return '#ffffff';
}

export function createDmgNumbers() {
  return { list: [], hittarget: 0, tu: [0, 0, 0], vfx: [] };
}

export function resetDmgStack(state) {
  if (state.dmg) {
    state.dmg.hittarget = 0;
    state.dmg.tu = [0, 0, 0];
  }
}

export function spawnDmgNumber(state, x, y, damage, type, delay = 8) {
  const d = state.dmg;
  if (!d) return;
  const top = y + 20 - d.hittarget * 20;
  d.list.push({
    x, y: top, ystart: top, damage, type, delay,
    delaytimer: 0, hspeed: 0, vspeed: 0, vstart: 0,
    bounces: 0, stretch: 0.2, stretchgo: 1,
    killtimer: 0, killactive: 0, kill: 0,
  });
  d.hittarget += 1;
}

/** Over a party member. Does not use the enemy hittarget stack. */
export function spawnPartyDmg(state, slot, damage, type = TYPE_PARTY) {
  const d = state.dmg;
  if (!d) return;
  const pos = [
    { x: 80, y: 100 },
    { x: 90, y: 150 },
    { x: 100, y: 210 },
  ][slot];
  const tu = d.tu[slot] ?? 0;
  d.list.push({
    x: pos.x, y: pos.y - tu * 20, ystart: pos.y - tu * 20,
    damage, type, delay: 8,
    delaytimer: 0, hspeed: 0, vspeed: 0, vstart: 0,
    bounces: 0, stretch: 0.2, stretchgo: 1,
    killtimer: 0, killactive: 0, kill: 0,
  });
  d.tu[slot] = tu + 1;
}

export function spawnImpact(state, x, y, critical) {
  if (!state.dmg) return;
  state.dmg.vfx.push({
    sprite: 'spr_attack_cut1',
    x: x + Math.random() * 6,
    y: y + Math.random() * 6,
    index: 0,
    speed: 0.334,
    maxindex: 3,
    scale: critical ? 2.5 : 2,
    critical,
  });
}

export function stepDmgNumbers(state) {
  const d = state.dmg;
  if (!d) return;
  for (const n of d.list) {
    if (n.delaytimer < n.delay) {
      n.delaytimer += 1;
      if (n.delaytimer === n.delay) {
        n.vspeed = -5 - Math.random() * 2;
        n.vstart = n.vspeed;
        n.hspeed = 10;
      }
      continue;
    }
    if (n.hspeed > 0) n.hspeed -= 1;
    else if (n.hspeed < 0) n.hspeed += 1;
    if (Math.abs(n.hspeed) < 1) n.hspeed = 0;
    n.x += n.hspeed;
    if (n.bounces < 2) n.vspeed += 1;
    n.y += n.vspeed;
    if (n.y > n.ystart && n.bounces < 2 && n.killactive === 0) {
      n.y = n.ystart;
      n.vspeed = n.vstart / 2;
      n.bounces += 1;
    }
    if (n.bounces >= 2 && n.killactive === 0) {
      n.vspeed = 0;
      n.y = n.ystart;
    }
    if (n.stretchgo === 1) n.stretch += 0.4;
    if (n.stretch >= 1.2) { n.stretch = 1; n.stretchgo = 0; }
    n.killtimer += 1;
    if (n.killtimer > 35) n.killactive = 1;
    if (n.killactive === 1) {
      n.kill += 0.08;
      n.y -= 4;
    }
  }
  d.list = d.list.filter((n) => n.kill <= 1);

  for (const v of d.vfx) {
    v.index += v.speed;
    if (v.critical) v.scale += 0.1;
  }
  d.vfx = d.vfx.filter((v) => v.index < v.maxindex);
}
