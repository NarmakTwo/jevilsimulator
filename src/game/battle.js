// The fight: obj_joker's turn table + the party command loop.
//
// jturn/jattack, HP gates, hypnosis skips, chaosdance and tired come from
// obj_joker. The command phase is the Chapter 1 shape: Kris → Susie → Ralsei,
// X is scr_prevhero, FIGHT/ACT-or-MAGIC/ITEM/SPARE/DEFEND per character.

import { spawn, destroy, cue } from './sim.js';
import { choose, random, irandom } from './gml.js';
import { soul, growtangle, BOARD } from './soul.js';
import { dbulletcontroller } from './controller.js';
import { createParty, healMember, tensionHeal, ACTION_DEFEND, TP_DEFEND } from './party.js';
import { createFightBar, stepFightBar, fightTp } from './fightbar.js';
import { createDmgNumbers, resetDmgStack, spawnDmgNumber, spawnImpact, stepDmgNumbers } from './dmg.js';

export const MODES = [
  { id: 'standard', label: 'STANDARD', desc: ['The Jevil fight.'] },
  { id: 'hard', label: 'HARD MODE', desc: ['Attacks last twice as long.', 'You take 25% more damage.'] },
  { id: 'nohit', label: 'NO HIT', desc: ['Getting hit restarts the fight.'] },
  { id: 'endless', label: 'ENDLESS', desc: ['Dodge practice. No damage, no healing, no end.'] },
];

export const MODE_MENU = {
  titleY: 72,
  startY: 148,
  spacing: 38,
  heartX: 188,
  textX: 220,
  left: 150,
  right: 490,
  rowPad: 6,
};

export const SELECT_ROWS = MODES.length + 1;
export const HITBOX_ROW = MODES.length;

export function modeIndexAt(x, y) {
  const m = MODE_MENU;
  for (let i = 0; i < SELECT_ROWS; i += 1) {
    const top = m.startY + i * m.spacing - m.rowPad;
    const bot = top + m.spacing;
    if (y >= top && y < bot && x >= m.left && x <= m.right) return i;
  }
  return -1;
}

export function toggleHitbox(state, b) {
  b.accurateHitbox = !b.accurateHitbox;
  state.accurateHitbox = b.accurateHitbox;
  cue(state, 'menumove');
}

export const GAMEOVER_MENU = {
  y: 268,
  continueX: 150,
  menuX: 400,
  top: 248,
  bottom: 310,
};

export function gameoverIndexAt(x, y) {
  const g = GAMEOVER_MENU;
  if (y < g.top || y > g.bottom) return -1;
  return x < 320 ? 0 : 1;
}

export const JEVIL_MAX_HP = 3500;

// jattack -> controller setup, from obj_joker/Other_15.gml.
// dmg is the monsterat multiplier; tt is a turntimer override.
const ATTACKS = {
  0:  { type: 70, gp: 2, dmg: 5 },
  1:  { type: 65, gp: 3, dmg: 5 },
  2:  { type: 49, gp: 3, dmg: 4, all: true },
  3:  { type: 75, gp: 3, dmg: 6 },
  4:  { type: 62, gp: 2, dmg: 5, inv: 20 },
  5:  { type: 50, gp: 3, dmg: 4, all: true, tt: 300 },
  6:  { type: 73, gp: 1, dmg: 5 },
  7:  { type: 68, gp: 2, dmg: 5 },
  8:  { type: 61, gp: 3, dmg: 5, inv: 20, tt: 240 },
  9:  { type: 48, gp: 4, dmg: 4, all: true, tt: 270 },
  10: { type: 72, gp: 1, dmg: 5 },
  11: { type: 76, gp: 3, dmg: 6 },
  12: { type: 71, gp: 2, dmg: 5 },
  13: { type: 46, gp: 4, dmg: 4, all: true, tt: 330 },
  14: { type: 74, gp: 1, dmg: 4 },
  15: { type: 77, gp: 1, dmg: 4, tt: 1500 },
};

const TURN_LINES = {
  0: 'CHAOS,\nCHAOS!',
  1: 'I CAN DO\nANYTHING!',
  2: "ISN'T THIS\nEXCITING?\nISN'T THIS\nTHRILLING?",
  3: 'THE HANDS\nOF FATE\nSPIN LIKE A\nCAROUSEL!',
  5: 'A GAME,\nA GAME!\nLET US PLAY\nA GAME!',
  6: 'YOUR\nCHOICES\nARE\nUSELESS!',
  7: 'ANYTHING,\nANYTHING\nCAN\nHAPPEN!',
  8: 'ROUND AND\nROUND THE\nWORLD\nREVOLVES!',
  10: 'THE FUN\nIS JUST\nBEGINNING!',
  11: 'DANCE,\nDANCE!\nEVERYONE\nDANCE!',
  12: 'UEE HEE\nHEE!\nTOO SLOW,\nTOO SLOW!',
  13: 'HOW ABOUT\nA NICE\nGAME OF\nCARDS?',
  15: 'THE CLOCK\nIS TICKING,\nTICK TOCK,\nTICK TOCK!',
  16: 'SOON,\nSOON,\nTHE SHOW\nWILL END!',
  17: 'NOW THE\nTRUE SHOW\nBEGINS!',
  18: 'METAMORPHOSIS\nNEO CHAOS!',
};

const CHAOS_QUIPS = [
  'CHAOS,\nCHAOS!',
  'I CAN DO\nANYTHING!',
  "LET'S PLAY,\nLET'S PLAY!",
  'UEE HEE\nHEE!',
  'HEARTS,\nDIAMONDS,\nI CAN DO\nANYTHING!',
];

const CHAOS_LINES = [
  '"THE DEVIL LAUGHS AT NOTHING AT ALL."',
  'JEVIL SPUN AROUND. HIS DEFENSE DROPPED!',
  'A CHILL RUNS THROUGH THE AIR. Mercy invulnerability got shorter!',
  "JEVIL'S EYES GLAZED. His next attack will be weaker!",
  'A COMPLETELY USELESS BIRD FLEW BY.',
  'JEVIL CLAPPED ALONG. Someone recovered HP!',
  "EVERYTHING SWAPPED! SUSIE AND RALSEI'S HP TRADED PLACES!",
  'JEVIL GOT EXCITED! His next attack will be stronger!',
  'THE CROWD (?) APPLAUDED. Everyone recovered HP!',
];

function battleFields() {
  return {
    phase: 'select',
    timer: 0,
    menuIndex: 0,
    subIndex: 0,
    message: '* The shadow of a strange\n  jester falls over the party.',
    turnLine: '',
    jturn: 0, jattack: 0, turns: 0, chaosdance: 0,
    hypnosiscounter: 0, pirouettecounter: 0, pfactor: 1,
    tired: false, spared: false, defeated: false,
    monsterat: 8, monsterdf: 0,
    jevilhp: JEVIL_MAX_HP,
    hurtFlash: 0,
    bars: [], barIndex: 0, barX: 0, hits: [],
    items: defaultItems(),
    reminvc: 1,
    dancelv: 0, floatsiner: 0, floatsinerspeed: 1, dancesiner: 0,
    bgalpha: 0, bgrot: 0, bgx: 0, bgrotspeed: 1,
    mmy: [0, 0, 0],
    fightBar: null,
    charturn: 0,
    selected: [0, 0, 0],
    actions: [null, null, null],
    submenu: null,
    targetIndex: 0,
    pending: null,
    menuLock: 0,
    itemSnap: [null, null, null],
    tpSnap: [0, 0, 0],
    shadows: null,
    endlessIndex: 0,
    bodyCondition: 0,
    bodySize: 2,
    goIndex: 0,
    failTimer: 0,
  };
}

export function createBattle() {
  // debug: ?attack=N forces a specific jattack every turn (0-15)
  const params = new URLSearchParams(window.location.search);
  const forced = params.has('attack') ? Number(params.get('attack')) : null;
  return {
    forcedAttack: forced !== null && forced >= 0 && forced <= 15 ? forced : null,
    mode: null,
    modeIndex: 0,
    accurateHitbox: false,
    ...battleFields(),
  };
}

function wipeEntities(state) {
  for (const e of state.entities) destroy(e);
  state.entities = state.entities.filter((e) => e.alive);
}

function resetSim(state) {
  wipeEntities(state);
  state.party = createParty();
  state.inv = -1;
  state.invc = 1;
  state.sp = 4;
  state.tension = 0;
  state.turntimer = 0;
  state.mnfight = 0;
  state.gameover = false;
  state.nohitFail = false;
  state.shake = 0;
  state.darkfade = 0;
  state.fadewhite = 0;
  state.grazefx = 0;
  state.charaction = [0, 0, 0];
  state.boardAlive = true;
  state.boardAlpha = 1;
  state.dmg = createDmgNumbers();
  state.dmgFlash = null;
  state.endlessHits = 0;
  state.endlessFail = false;
}

/** Start or restart the fight in the currently selected mode. */
export function beginMode(state, b) {
  if (b.modeIndex === HITBOX_ROW) {
    toggleHitbox(state, b);
    return;
  }
  const fromSelect = b.phase === 'select';
  const mode = MODES[b.modeIndex]?.id || 'standard';
  b.mode = mode;
  state.mode = mode;
  const forced = b.forcedAttack;
  const modeIndex = b.modeIndex;
  const accurateHitbox = !!b.accurateHitbox;
  Object.assign(b, battleFields());
  b.forcedAttack = forced;
  b.mode = mode;
  b.modeIndex = modeIndex;
  b.accurateHitbox = accurateHitbox;
  resetSim(state);
  state.accurateHitbox = accurateHitbox;
  if (fromSelect) cue(state, 'menu');
  b.bgalpha = 1;
  if (mode === 'endless') {
    beginEnemy(state, b);
    return;
  }
  if (fromSelect) cue(state, 'joker_laugh0');
  b.message = '* JEVIL blocks the way!';
  b.phase = 'menu';
  openPlayerTurn(state, b);
}

export function returnToSelect(state, b) {
  const forced = b.forcedAttack;
  const modeIndex = b.modeIndex;
  const accurateHitbox = !!b.accurateHitbox;
  Object.assign(b, battleFields());
  b.forcedAttack = forced;
  b.mode = null;
  b.modeIndex = modeIndex;
  b.accurateHitbox = accurateHitbox;
  resetSim(state);
  state.mode = null;
  state.accurateHitbox = accurateHitbox;
  b.phase = 'select';
  b.bgalpha = 0;
}

function defaultItems() {
  return [
    { id: 'topcake', name: 'Top Cake', count: 1, heal: 160, all: true },
    { id: 'darkburger', name: 'DarkBurger', count: 9, heal: 70 },
    { id: 'darkcandy', name: 'Dark Candy', count: 1, heal: 40 },
    { id: 'revivemint', name: 'ReviveMint', count: 1, revive: true },
  ];
}

function cloneItems(items) {
  return items.map((it) => ({ ...it }));
}

const COMMANDS = ['FIGHT', 'ACT', 'ITEM', 'SPARE', 'DEFEND'];
export const ACTS = ['Check', 'Pirouette', 'Hypnosis'];
export const MAGIC = {
  1: [{ id: 'rude', name: 'Rude Buster', cost: 50, target: 'enemy' }],
  2: [
    { id: 'heal', name: 'Heal Prayer', cost: 32, target: 'party' },
    { id: 'pacify', name: 'Pacify', cost: 16, target: 'enemy' },
  ],
};

function isUp(state, i) {
  return (state.party[i]?.hp ?? 0) > 0;
}

function firstUp(state) {
  for (let i = 0; i < 3; i += 1) if (isUp(state, i)) return i;
  return 3;
}

function nextUp(state, from) {
  for (let i = from + 1; i < 3; i += 1) if (isUp(state, i)) return i;
  return 3;
}

function prevUp(state, from) {
  for (let i = from - 1; i >= 0; i -= 1) if (isUp(state, i)) return i;
  return -1;
}

export function commandName(c, index) {
  if (index === 1) return c === 0 ? 'ACT' : 'MAGIC';
  return COMMANDS[index];
}

export function bagRows(b) {
  return (b.items || []).filter((it) => it.count > 0);
}

/** obj_joker Step — turn selection with HP gates and hypnosis skips. */
function selectTurn(b) {
  if (b.mode === 'endless') {
    b.jattack = b.endlessIndex % 16;
    b.endlessIndex += 1;
    b.turnLine = choose(...CHAOS_QUIPS);
    return;
  }
  const ratio = b.jevilhp / JEVIL_MAX_HP;
  if (ratio <= 0.8 && b.jturn === 4) b.jturn = 5;
  if (ratio <= 0.6 && b.jturn === 9) b.jturn = 10;
  if (ratio <= 0.4 && b.jturn === 14) b.jturn = 15;
  if (ratio <= 0.15 && b.jturn < 17) b.jturn = 17;
  if (b.hypnosiscounter >= 2 && b.jturn === 4 && b.turns >= 5 - b.hypnosiscounter) b.jturn = 5;
  if (b.hypnosiscounter >= 4 && b.jturn === 9 && b.turns >= 11 - b.hypnosiscounter) b.jturn = 10;
  if (b.hypnosiscounter >= 6 && b.jturn === 14 && b.turns >= 17 - b.hypnosiscounter) b.jturn = 15;
  if (b.jturn >= 19 && b.turns >= 29 - b.hypnosiscounter) b.tired = true;

  b.turnLine = TURN_LINES[b.jturn] || '';
  if (b.jturn === 4 || b.jturn === 9 || b.jturn === 14 || b.jturn >= 19) {
    b.turnLine = choose(...CHAOS_QUIPS);
  }
  if (b.tired) b.turnLine = "I'M TIRED...\nBUT I CAN\nSTILL PLAY,\nPLAY...";

  if (b.jturn >= 19) {
    if (b.monsterdf > -10) b.monsterdf -= 3;
    if (b.monsterat < 11) b.monsterat += 0.5;
    b.jattack = choose(0, 4, 7, 8, 10, 11, 12, 13, 13, 13);
  }
  if (b.jturn >= 15 && b.jturn <= 18) { b.jattack = b.jturn - 3; b.jturn += 1; }
  if (b.jturn >= 17) b.dancelv = Math.max(b.dancelv, 2);
  else if (b.jturn === 14) b.jattack = choose(8, 9, 10, 11);
  else if (b.jturn >= 10 && b.jturn <= 13) { b.jattack = b.jturn - 2; b.jturn += 1; }
  else if (b.jturn === 9) b.jattack = choose(4, 5, 6, 7);
  else if (b.jturn >= 5 && b.jturn <= 8) { b.jattack = b.jturn - 1; b.jturn += 1; }
  else if (b.jturn === 4) b.jattack = choose(0, 1, 2, 3);
  else if (b.jturn <= 3) { b.jattack = b.jturn; b.jturn += 1; }
}

/** obj_joker Other_15 — launch the chosen attack. */
function launchAttack(state, b) {
  b.turns += 1;
  b.chaosdance += 1;
  if (b.chaosdance >= 9) b.chaosdance = 0;
  if (b.forcedAttack !== null) b.jattack = b.forcedAttack;

  const a = ATTACKS[b.jattack];
  const at = b.monsterat * b.pfactor;
  const dc = spawn(state, dbulletcontroller, 320, 60);
  dc.ctype = a.type;
  dc.damage = at * a.dmg;
  dc.grazepoints = a.gp;
  if (a.inv !== undefined) dc.inv = a.inv;
  dc.target = a.all ? 3 : irandom(2);
  const base = a.tt !== undefined ? a.tt : 240;
  state.turntimer = b.mode === 'hard' ? base * 2 : base;
  b.pfactor = 1;

  if (b.jattack === 0) cue(state, 'joker_chaos');
  if (b.jattack === 4 || b.jattack === 8) cue(state, 'joker_anything');
  if (b.jattack === 15) cue(state, 'joker_metamorphosis');

  state.endlessHits = 0;
  state.endlessFail = false;
  b.failTimer = 0;
  // obj_joker Other_15: body.condition = 2 on teleport / bomb turns
  if (HIDE_BODY.has(b.jattack)) {
    b.bodyCondition = 2;
    b.bodySize = 2;
  } else {
    b.bodyCondition = 0;
    b.bodySize = 2;
  }
}

const HIDE_BODY = new Set([0, 2, 5, 9, 12, 13]);

function stepJevilBody(state, b) {
  if (b.bodyCondition === 2) {
    if (b.bodySize >= 2) cue(state, 'spearappear');
    b.bodySize -= 0.5;
    if (b.bodySize <= 0) {
      b.bodySize = 0;
      b.bodyCondition = 4;
    }
  } else if (b.bodyCondition === 4) {
    if (state.turntimer <= 10) {
      b.bodyCondition = 3;
      b.bodySize = 0;
      cue(state, 'spearappear');
    }
  } else if (b.bodyCondition === 3) {
    b.bodySize += 0.5;
    if (b.bodySize >= 2) {
      b.bodySize = 2;
      b.bodyCondition = 0;
    }
  }
}

function startEnemyTurn(state, b) {
  b.reminvc = state.invc;
  state.mnfight = 2;
  state.boardAlive = true;
  state.boardAlpha = 1;
  // moveheart + growtangle
  const heart = spawn(state, soul, BOARD.x - 10, BOARD.y - 10);
  heart.wspeed = state.sp;
  spawn(state, growtangle, BOARD.x, BOARD.y);
  launchAttack(state, b);
}

function endEnemyTurn(state, b) {
  state.mnfight = 0;
  state.invc = b.reminvc;
  state.inv = -1;
  state.sp = 4;
  state.darkfade = 0;
  state.fadewhite = 0;
  b.bodyCondition = 0;
  b.bodySize = 2;
  // the between-turn bullet sweep
  for (const e of state.entities) {
    if (e.type.name !== 'obj_joker') destroy(e);
  }
  for (const m of state.party) m.hurt = 0;
}

function applyFightHit(state, b, slot) {
  const points = b.fightBar.points[slot];
  const at = state.party[slot].at;
  let damage = Math.round(((at * points) / 20) - (b.monsterdf * 3));
  if (damage < 0) damage = 0;
  spawnDmgNumber(state, 500, 160, damage, slot, damage === 0 ? 2 : 8);
  if (damage > 0) {
    tensionHeal(state, fightTp(points));
    spawnImpact(state, 500, 160, points === 150);
    damageJevil(b, damage, state);
    cue(state, points === 150 ? 'crit' : 'slash');
  }
}

function damageJevil(b, amount, state) {
  if (b.mode === 'endless') return;
  b.jevilhp = Math.max(0, b.jevilhp - amount);
  b.hurtFlash = 15;
  const ratio = b.jevilhp / JEVIL_MAX_HP;
  b.floatsinerspeed = 1 + (1 - ratio);
  if (ratio <= 0.8 && b.dancelv === 0) b.dancelv = 1;
  if (ratio <= 0.4 && b.jturn < 17) b.dancelv = 3;
  if (ratio <= 0.2 && b.jturn === 17) b.dancelv = 2;
  b.bgrotspeed = 1 + (1.5 - ratio * 1.5);
  cue(state, ['joker_laugh0', 'joker_ha1', 'joker_ha0'][Math.floor(Math.random() * 3)]);
  if (b.jevilhp === 0) b.defeated = true;
}

function openPlayerTurn(state, b) {
  b.actions = [null, null, null];
  state.charaction = [0, 0, 0];
  b.submenu = null;
  b.pending = null;
  b.menuLock = 0;
  b.charturn = firstUp(state);
  b.itemSnap = [cloneItems(b.items), null, null];
  b.tpSnap = [state.tension, 0, 0];
  if (b.charturn < 3) {
    b.itemSnap[b.charturn] = cloneItems(b.items);
    b.tpSnap[b.charturn] = state.tension;
  }
}

function finishHero(state, b) {
  b.submenu = null;
  b.pending = null;
  b.menuLock = 2;
  const n = nextUp(state, b.charturn);
  if (n >= 3) {
    commitTurn(state, b);
    return;
  }
  b.charturn = n;
  b.itemSnap[n] = cloneItems(b.items);
  b.tpSnap[n] = state.tension;
}

function prevHero(state, b) {
  const p = prevUp(state, b.charturn);
  if (p < 0) {
    cue(state, 'menumove');
    return;
  }
  b.charturn = p;
  if (b.itemSnap[p]) b.items = cloneItems(b.itemSnap[p]);
  if (b.tpSnap[p] !== undefined) state.tension = b.tpSnap[p];
  b.actions[p] = null;
  if (state.charaction) state.charaction[p] = 0;
  b.submenu = null;
  b.pending = null;
  b.menuLock = 2;
  cue(state, 'menumove');
}

function lockAction(state, b, action) {
  b.actions[b.charturn] = action;
  finishHero(state, b);
}

function applyItem(state, b, item, target) {
  const who = state.party[b.charturn]?.name || 'Kris';
  if (item.all) {
    for (let i = 0; i < 3; i += 1) healMember(state, i, item.heal);
    cue(state, 'heal');
    return `* ${who} used the ${item.name}!\n* Everyone recovered ${item.heal} HP!`;
  }
  if (item.revive) {
    const m = state.party[target];
    const dead = m.hp <= 0;
    healMember(state, target, dead ? m.maxhp : 100, { revive: dead });
    cue(state, 'heal');
    return dead
      ? `* ${who} used the ${item.name}!\n* ${m.name} was revived!`
      : `* ${who} used the ${item.name}!\n* ${m.name} recovered 100 HP!`;
  }
  healMember(state, target, item.heal);
  cue(state, 'heal');
  return `* ${who} used the ${item.name}!\n* ${state.party[target].name} recovered ${item.heal} HP!`;
}

function applyMagic(state, b, spell, target) {
  const c = b.charturn;
  const caster = state.party[c];
  if (spell.id === 'rude') {
    const dmg = Math.ceil((caster.mag * 5) + (caster.at * 11) - (b.monsterdf * 3));
    spawnDmgNumber(state, 500, 160, Math.max(0, dmg), c, 8);
    if (dmg > 0) {
      spawnImpact(state, 500, 160, false);
      damageJevil(b, dmg, state);
      cue(state, 'slash');
    }
    return `* ${caster.name} used Rude Buster!`;
  }
  if (spell.id === 'heal') {
    const amt = caster.mag * 5;
    healMember(state, target, amt);
    cue(state, 'heal');
    return `* ${caster.name} gave a Heal Prayer!\n* ${state.party[target].name} recovered ${amt} HP!`;
  }
  if (spell.id === 'pacify') {
    if (b.tired) {
      b.spared = true;
      cue(state, 'joker_byebye');
      return '* Ralsei used Pacify!\n* JEVIL fell asleep... You won!';
    }
    return "* Ralsei used Pacify!\n* But JEVIL wasn't TIRED...";
  }
  return `* ${caster.name} cast a spell!`;
}

function applyAct(state, b, act) {
  if (act === 'Check') {
    return `* JEVIL - AT ${Math.round(b.monsterat)} DF ${b.monsterdf}\n* Can do anything.`;
  }
  if (act === 'Pirouette') {
    cue(state, 'pirouette');
    if (b.tired) {
      b.spared = true;
      cue(state, 'joker_byebye');
      return '* You pirouetted. JEVIL, satisfied,\n  gives up the game. You won!';
    }
    const c = b.chaosdance;
    let msg = '* You pirouetted!\n* ' + CHAOS_LINES[c];
    if (c === 1 && b.monsterdf >= -16) b.monsterdf -= 4;
    if (c === 2) state.invc = 0.4;
    if (c === 3) b.pfactor = 0.7;
    if (c === 5) {
      const alive = state.party.map((m, i) => i).filter((i) => state.party[i].hp > 0);
      const i = alive[irandom(alive.length - 1)];
      healMember(state, i, Math.floor(random(31) + 25));
    }
    if (c === 6) {
      const s = state.party[1];
      const r = state.party[2];
      const tmp = { hp: s.hp, maxhp: s.maxhp };
      s.hp = r.hp; s.maxhp = r.maxhp;
      r.hp = tmp.hp; r.maxhp = tmp.maxhp;
    }
    if (c === 7) b.pfactor = 1.25;
    if (c === 8) {
      for (let i = 0; i < 3; i += 1) healMember(state, i, 36 + Math.floor(random(15)));
    }
    b.hypnosiscounter += 0.5;
    b.pirouettecounter += 1;
    return msg;
  }
  if (act === 'Hypnosis') {
    cue(state, 'hypnosis');
    if (b.monsterat > 10) b.monsterat -= 0.5;
    b.pfactor = 0.7;
    b.hypnosiscounter += 1;
    return choose(
      '* You look deep into JEVIL\'s eyes...\n* "CHAOS!" It has no effect... or does it?',
      '* You swing a pendulum.\n* JEVIL grew strangely drowsy!',
      '* You hypnotize JEVIL.\n* His attacks seem... slower.',
    );
  }
  return '* Nothing happened.';
}

function resolveNonFight(state, b) {
  resetDmgStack(state);
  const msgs = [];
  for (let i = 0; i < 3; i += 1) {
    const a = b.actions[i];
    if (!a) continue;
    const saved = b.charturn;
    b.charturn = i;
    if (a.type === 'act') msgs.push(applyAct(state, b, a.act));
    else if (a.type === 'magic') msgs.push(applyMagic(state, b, a.spell, a.target));
    else if (a.type === 'item') {
      const it = b.items.find((x) => x.id === a.itemId);
      if (it) msgs.push(applyItem(state, b, it, a.target));
    } else if (a.type === 'spare') {
      if (b.tired) {
        b.spared = true;
        cue(state, 'joker_byebye');
        msgs.push('* You spared JEVIL.');
      } else {
        msgs.push(choose(
          '* You spared JEVIL.\n* But his name was not shining...',
          "* JEVIL laughs. 'SPARE ME? THE GAME'S NOT OVER!'",
        ));
      }
    }
    b.charturn = saved;
  }
  if (msgs.length) b.message = msgs[msgs.length - 1];
}

function beginEnemy(state, b) {
  if (b.mode !== 'endless') {
    if (b.spared) {
      b.phase = 'end';
      b.message = '* You spared JEVIL.';
      return;
    }
    if (b.defeated) {
      b.phase = 'end';
      b.message = "* JEVIL: 'I CAN'T LOSE...\n  I CAN'T LOSE...!'";
      return;
    }
  }
  b.phase = 'enemytext';
  b.timer = 0;
  selectTurn(b);
}

function commitTurn(state, b) {
  const fighters = [0, 1, 2].filter((i) => b.actions[i]?.type === 'fight' && isUp(state, i));
  if (fighters.length) {
    resetDmgStack(state);
    b.fightBar = createFightBar(fighters);
    b.phase = 'fight';
    return;
  }
  resolveNonFight(state, b);
  beginEnemy(state, b);
}

export function stepBattle(state, b, input, pressed) {
  if (state.nohitFail && b.mode === 'nohit') {
    state.nohitFail = false;
    beginMode(state, b);
    return;
  }

  b.timer += 1;
  if (b.hurtFlash > 0) b.hurtFlash -= 1;
  for (const m of state.party) if (m.hurt > 0) m.hurt -= 1;
  stepDmgNumbers(state);

  switch (b.phase) {
    case 'select': {
      if (pressed.u) {
        b.modeIndex = (b.modeIndex + SELECT_ROWS - 1) % SELECT_ROWS;
        cue(state, 'menumove');
      }
      if (pressed.d) {
        b.modeIndex = (b.modeIndex + 1) % SELECT_ROWS;
        cue(state, 'menumove');
      }
      if (pressed.l || pressed.r) toggleHitbox(state, b);
      if (pressed.z) {
        if (b.modeIndex === HITBOX_ROW) toggleHitbox(state, b);
        else beginMode(state, b);
      }
      break;
    }

    case 'menu': {
      if (b.menuLock > 0) b.menuLock -= 1;
      const c = b.charturn;
      if (c >= 3) break;
      const locked = b.menuLock > 0;

      if (b.submenu === 'act') {
        if (pressed.u) { b.subIndex = (b.subIndex + ACTS.length - 1) % ACTS.length; cue(state, 'menumove'); }
        if (pressed.d) { b.subIndex = (b.subIndex + 1) % ACTS.length; cue(state, 'menumove'); }
        if (pressed.x && !locked) { b.submenu = null; b.menuLock = 2; cue(state, 'menumove'); }
        if (pressed.z && !locked) {
          cue(state, 'menu');
          lockAction(state, b, { type: 'act', act: ACTS[b.subIndex] });
        }
        break;
      }

      if (b.submenu === 'magic') {
        const spells = MAGIC[c] || [];
        if (!spells.length) { b.submenu = null; break; }
        if (pressed.u) { b.subIndex = (b.subIndex + spells.length - 1) % spells.length; cue(state, 'menumove'); }
        if (pressed.d) { b.subIndex = (b.subIndex + 1) % spells.length; cue(state, 'menumove'); }
        if (pressed.x && !locked) { b.submenu = null; b.menuLock = 2; cue(state, 'menumove'); }
        if (pressed.z && !locked) {
          const spell = spells[b.subIndex];
          if ((state.tension ?? 0) < spell.cost) { cue(state, 'menumove'); break; }
          cue(state, 'menu');
          if (spell.target === 'party') {
            b.pending = { type: 'magic', spell };
            b.submenu = 'target';
            b.targetIndex = 0;
            b.menuLock = 2;
          } else {
            state.tension -= spell.cost;
            lockAction(state, b, { type: 'magic', spell, target: 0 });
          }
        }
        break;
      }

      if (b.submenu === 'item') {
        const bag = bagRows(b);
        if (!bag.length) { b.submenu = null; cue(state, 'menumove'); break; }
        const n = bag.length;
        if (pressed.l && b.subIndex % 2 === 1) { b.subIndex -= 1; cue(state, 'menumove'); }
        if (pressed.r && b.subIndex % 2 === 0 && b.subIndex + 1 < n) { b.subIndex += 1; cue(state, 'menumove'); }
        if (pressed.u && b.subIndex >= 2) { b.subIndex -= 2; cue(state, 'menumove'); }
        if (pressed.d && b.subIndex + 2 < n) { b.subIndex += 2; cue(state, 'menumove'); }
        if (pressed.x && !locked) { b.submenu = null; b.menuLock = 2; cue(state, 'menumove'); }
        if (pressed.z && !locked) {
          const it = bag[b.subIndex % bag.length];
          cue(state, 'menu');
          if (it.all) {
            it.count -= 1;
            lockAction(state, b, { type: 'item', itemId: it.id, target: 0 });
          } else {
            b.pending = { type: 'item', item: it };
            b.submenu = 'target';
            b.targetIndex = 0;
            b.menuLock = 2;
          }
        }
        break;
      }

      if (b.submenu === 'target') {
        if (pressed.u) { b.targetIndex = (b.targetIndex + 2) % 3; cue(state, 'menumove'); }
        if (pressed.d) { b.targetIndex = (b.targetIndex + 1) % 3; cue(state, 'menumove'); }
        if (pressed.x && !locked) {
          b.submenu = b.pending?.type === 'magic' ? 'magic' : 'item';
          b.menuLock = 2;
          cue(state, 'menumove');
        }
        if (pressed.z && !locked) {
          const t = b.targetIndex;
          cue(state, 'menu');
          if (b.pending?.type === 'magic') {
            state.tension -= b.pending.spell.cost;
            lockAction(state, b, { type: 'magic', spell: b.pending.spell, target: t });
          } else if (b.pending?.item) {
            b.pending.item.count -= 1;
            lockAction(state, b, { type: 'item', itemId: b.pending.item.id, target: t });
          }
        }
        break;
      }

      if (pressed.l) { b.selected[c] = (b.selected[c] + 4) % 5; cue(state, 'menumove'); }
      if (pressed.r) { b.selected[c] = (b.selected[c] + 1) % 5; cue(state, 'menumove'); }
      if (pressed.x && !locked) prevHero(state, b);
      if (pressed.z && !locked) {
        const cmd = commandName(c, b.selected[c]);
        cue(state, 'menu');
        if (cmd === 'FIGHT') lockAction(state, b, { type: 'fight' });
        else if (cmd === 'ACT') {
          b.subIndex = 0;
          b.submenu = 'act';
          b.menuLock = 2;
        } else if (cmd === 'MAGIC') {
          const spells = MAGIC[c] || [];
          if (!spells.length) break;
          b.subIndex = 0;
          b.submenu = 'magic';
          b.menuLock = 2;
        } else if (cmd === 'ITEM') {
          if (!bagRows(b).length) { cue(state, 'menumove'); break; }
          b.subIndex = 0;
          b.submenu = 'item';
          b.menuLock = 2;
        } else if (cmd === 'SPARE') lockAction(state, b, { type: 'spare' });
        else if (cmd === 'DEFEND') {
          tensionHeal(state, TP_DEFEND);
          if (state.charaction) state.charaction[c] = ACTION_DEFEND;
          lockAction(state, b, { type: 'defend' });
        }
      }
      break;
    }

    case 'fight': {
      const bar = b.fightBar;
      if (!bar) break;
      stepFightBar(bar, pressed.z);
      for (let i = 0; i < 3; i += 1) {
        if (bar.attacked[i] && !bar.applied[i] && bar.havechar[i]) {
          bar.applied[i] = true;
          applyFightHit(state, b, i);
        }
      }
      if (bar.fade && bar.fadeamt > 1) {
        bar.active = false;
        resolveNonFight(state, b);
        beginEnemy(state, b);
      }
      break;
    }

    case 'enemytext': {
      const ready = b.mode === 'endless' ? b.timer > 18 : (b.timer > 20 && (pressed.z || b.timer > 90));
      if (ready) {
        startEnemyTurn(state, b);
        b.phase = 'dodge';
      }
      break;
    }

    case 'dodge': {
      stepJevilBody(state, b);
      if (state.gameover) {
        endEnemyTurn(state, b);
        b.phase = 'gameover';
        b.goIndex = 0;
        break;
      }
      if (b.mode === 'endless' && state.endlessFail) {
        if (b.failTimer === 0) endEnemyTurn(state, b);
        b.failTimer += 1;
        if (b.failTimer > 40) {
          state.endlessFail = false;
          state.endlessHits = 0;
          b.failTimer = 0;
          startEnemyTurn(state, b);
          b.phase = 'dodge';
        }
        break;
      }
      state.turntimer -= 1;
      if (state.turntimer <= 0) {
        endEnemyTurn(state, b);
        if (b.mode === 'endless') {
          beginEnemy(state, b);
          break;
        }
        b.message = b.tired
          ? '* JEVIL is exhausted.\n* This is your chance to SPARE!'
          : choose(
            '* The air crackles with freedom.',
            '* JEVIL spins his scythe, cackling.',
            '* You smell popcorn, somehow.',
            '* JEVIL bounces to an inaudible song.',
          );
        b.phase = 'menu';
        openPlayerTurn(state, b);
      }
      break;
    }

    case 'end':
      break;

    case 'gameover': {
      if (pressed.l || pressed.r) {
        b.goIndex = b.goIndex === 0 ? 1 : 0;
        cue(state, 'menumove');
      }
      if (pressed.z) {
        cue(state, 'menu');
        if (b.goIndex === 0) beginMode(state, b);
        else returnToSelect(state, b);
      }
      break;
    }
  }
}
