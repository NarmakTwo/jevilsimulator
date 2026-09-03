// Party state, scr_damage / scr_damage_all, and tension.
//
// Stats are Chapter 1 endgame ballpark (the decompile reads them from save
// globals, which this port doesn't have). Jevil's AT is 8 in the dump's
// monster tables; controller damage arrives as monsterat * 4..6.

import { cue } from './sim.js';
import { spawnPartyDmg, TYPE_PARTY, TYPE_DEAD, TYPE_HEAL } from './dmg.js';

export const ACTION_DEFEND = 10;
export const TP_DEFEND = 16; // Ch1: 40 / maxtension 250, shown as 16%

export function createParty() {
  return [
    { name: 'KRIS', hp: 90, maxhp: 90, at: 10, df: 2, mag: 4, downed: false, hurt: 0 },
    { name: 'SUSIE', hp: 110, maxhp: 110, at: 12, df: 2, mag: 1, downed: false, hurt: 0 },
    { name: 'RALSEI', hp: 70, maxhp: 70, at: 8, df: 2, mag: 9, downed: false, hurt: 0 },
  ];
}

function damageOne(state, target, damage) {
  const party = state.party;
  let t = target;
  // retarget away from downed members (scr_damage)
  if (party[t].hp <= 0) {
    const up = party.map((m, i) => i).filter((i) => party[i].hp > 0);
    if (up.length) t = up[Math.floor(Math.random() * up.length)];
  }
  const m = party[t];
  let tdamage = Math.ceil(damage - m.df * 3);
  if (state.charaction?.[t] === ACTION_DEFEND) tdamage = Math.ceil((2 * tdamage) / 3);
  if (state.mode === 'hard') tdamage = Math.ceil(tdamage * 1.25);
  if (tdamage < 1) tdamage = 1;
  m.hurt = 12;
  state.shake = 8;
  spawnPartyDmg(state, t, tdamage, m.hp - tdamage <= 0 && m.hp > 0 ? TYPE_DEAD : TYPE_PARTY);
  if (m.hp <= 0) {
    m.hp -= Math.round(tdamage / 4);
  } else {
    m.hp -= tdamage;
    if (m.hp <= 0) {
      m.hp = Math.round(-m.maxhp / 2);
      m.downed = true;
    }
  }
  state.dmgFlash = { target: t, amount: tdamage, timer: 30 };
}

/** scr_damage — one member (bullet.target picks; retargets if downed). */
export function scrDamage(state, bullet) {
  if (state.inv >= 0) return;
  if (state.mode === 'endless') {
    finishEndlessHit(state);
    return;
  }
  damageOne(state, bullet.target % 3, bullet.damage);
  finishHit(state);
}

/** scr_damage_all — everyone still standing takes the full hit. */
export function scrDamageAll(state, bullet) {
  if (state.inv >= 0) return;
  if (state.mode === 'endless') {
    finishEndlessHit(state);
    return;
  }
  for (let i = 0; i < 3; i += 1) {
    if (state.party[i].hp > 0) damageOne(state, i, bullet.damage);
  }
  finishHit(state);
}

function finishEndlessHit(state) {
  state.inv = state.invc * 40;
  const heart = state.entities.find((e) => e.alive && e.type.name === 'obj_heart');
  if (heart) heart.dmgnoise = 1;
  cue(state, 'hurt');
  state.endlessHits = (state.endlessHits || 0) + 1;
  if (state.endlessHits > 3) state.endlessFail = true;
}

function finishHit(state) {
  state.inv = state.invc * 40;
  const heart = state.entities.find((e) => e.alive && e.type.name === 'obj_heart');
  if (heart) heart.dmgnoise = 1;
  cue(state, 'hurt');
  if (state.mode === 'nohit') {
    state.nohitFail = true;
    return;
  }
  if (state.party.every((m) => m.hp <= 0)) state.gameover = true;
}

/** scr_tensionheal */
export function tensionHeal(state, amount) {
  state.tension = Math.min(100, state.tension + amount);
}

export function healMember(state, i, amount, opts = {}) {
  const m = state.party[i];
  let shown = amount;
  if (opts.revive && m.hp <= 0) {
    shown = m.maxhp - Math.max(m.hp, 0);
    m.hp = m.maxhp;
  } else {
    m.hp = Math.min(m.maxhp, m.hp + amount);
    if (m.hp > m.maxhp) m.hp = m.maxhp;
  }
  if (m.hp > 0) m.downed = false;
  if (opts.popup !== false && shown > 0) spawnPartyDmg(state, i, shown, TYPE_HEAL);
  return shown;
}
