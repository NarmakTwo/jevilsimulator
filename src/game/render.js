// Canvas renderer. GameMaker interpolation is off, so rotation is nearest-
// neighbour ("bitcrush") rather than canvas's bilinear rotate().

import { META } from './meta.js';
import { lengthdirX, lengthdirY } from './gml.js';
import { loadFont, drawText } from './font.js';
import { dmgColor, TYPE_DEAD } from './dmg.js';
import { BOLT_SPEED, ROW_PITCH, BAR_X, BAR_Y } from './fightbar.js';
import { bagRows, ACTS, MAGIC, MODES, MODE_MENU, GAMEOVER_MENU, HITBOX_ROW, SELECT_ROWS } from './battle.js';
import { buildMasks } from './hitmask.js';

const images = {};
const rotCache = new Map();
const tintCache = new Map();
let nid = 0;

function cacheId(img) {
  if (img.src) return img.src;
  if (!img._nid) img._nid = `c${nid += 1}`;
  return img._nid;
}

export async function loadSprites(manifest) {
  loadFont('fnt_main');
  loadFont('fnt_mainbig');
  const jobs = [];
  for (const name of Object.keys(manifest)) {
    if (name.startsWith('__')) continue;
    for (let i = 0; i < manifest[name].frames; i += 1) {
      const img = new Image();
      img.src = `sprites/${name}_${i}.png`;
      images[`${name}_${i}`] = img;
      jobs.push(new Promise((res) => { img.onload = res; img.onerror = res; }));
    }
  }
  await Promise.all(jobs);
  buildMasks(images);
}

function imgOf(name, index) {
  const m = META[name];
  if (!m) return null;
  const n = m.frames || 1;
  const i = ((Math.floor(Math.abs(index)) % n) + n) % n;
  return images[`${name}_${i}`] || null;
}

function sourceData(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, img.width, img.height);
}

/**
 * Rotate a sprite around its origin with nearest-neighbour sampling — the
 * jagged look GameMaker produces with texture interpolation off.
 */
function nnRotated(img, ox, oy, angleDeg) {
  const q = Math.round(((angleDeg % 360) + 360) % 360);
  if (q === 0) return null;
  const key = `${cacheId(img)}|${ox}|${oy}|${q}`;
  const hit = rotCache.get(key);
  if (hit) return hit;

  const w = img.width;
  const h = img.height;
  const rad = (q * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const corners = [[-ox, -oy], [w - ox, -oy], [-ox, h - oy], [w - ox, h - oy]];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [lx, ly] of corners) {
    const dx = lx * cosA + ly * sinA;
    const dy = -lx * sinA + ly * cosA;
    if (dx < minX) minX = dx;
    if (dx > maxX) maxX = dx;
    if (dy < minY) minY = dy;
    if (dy > maxY) maxY = dy;
  }
  const dw = Math.max(1, Math.ceil(maxX - minX) + 2);
  const dh = Math.max(1, Math.ceil(maxY - minY) + 2);
  const nox = -minX;
  const noy = -minY;

  const src = sourceData(img);
  const dst = new ImageData(dw, dh);
  const sdat = src.data;
  const ddat = dst.data;
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const lx = x - nox;
      const ly = y - noy;
      const sx = Math.round(lx * cosA - ly * sinA + ox);
      const sy = Math.round(lx * sinA + ly * cosA + oy);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const si = (sy * w + sx) * 4;
      if (sdat[si + 3] === 0) continue;
      const di = (y * dw + x) * 4;
      ddat[di] = sdat[si];
      ddat[di + 1] = sdat[si + 1];
      ddat[di + 2] = sdat[si + 2];
      ddat[di + 3] = sdat[si + 3];
    }
  }
  const c = document.createElement('canvas');
  c.width = dw;
  c.height = dh;
  c.getContext('2d').putImageData(dst, 0, 0);
  const rec = { canvas: c, ox: nox, oy: noy };
  rotCache.set(key, rec);
  return rec;
}

function tinted(img, blend) {
  if (!blend) return img;
  const key = `${cacheId(img)}|${blend}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = blend;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(img, 0, 0);
  tintCache.set(key, c);
  return c;
}

function drawSprite(ctx, name, index, x, y, xscale, yscale, angle, alpha, blend) {
  const m = META[name];
  const img = imgOf(name, index);
  if (!m || !img || !img.width) return;
  const a = Math.max(0, Math.min(1, alpha));
  if (a <= 0) return;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = a;
  const src = blend ? tinted(img, blend) : img;
  const rot = angle ? nnRotated(src, m.ox, m.oy, angle) : null;
  ctx.translate(x, y);
  ctx.scale(xscale, yscale);
  if (rot) ctx.drawImage(rot.canvas, -rot.ox, -rot.oy);
  else ctx.drawImage(src, -m.ox, -m.oy);
  ctx.restore();
}

// ---------------------------------------------------------------- background

const DKBLUE = 'rgb(6,6,122)';
const DKBLUE2 = 'rgb(32,32,96)';
const DKBLUE3 = 'rgb(26,26,77)';

function drawCarouselBg(ctx, b) {
  const bg = imgOf('spr_carouselbg', 0);
  const alpha = Math.min(1, b.bgalpha);
  if (alpha <= 0) return;

  // Perspective strips — obj_jokerbg_triangle_real Draw, first two loops.
  if (bg && bg.width) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    const tintedBg = tinted(bg, DKBLUE3);
    let curl = ((b.bgx % 640) + 640) % 640;
    let curx = 0;
    const drawStrip = (i, scaleFn, h) => {
      const tempscale = 1 + 0.5 * i;
      const curscale = scaleFn(tempscale);
      const sx = curl;
      const sw = 5;
      ctx.drawImage(tintedBg, sx, 0, sw, Math.min(h, bg.height), curx, -i, sw * curscale, h);
      curl = (curl + 5) % 640;
      curx += 5 * curscale - 5;
    };
    for (let i = 0; i < 16; i += 1) drawStrip(i, Math.floor, 300);
    for (let i = 16; i > 0; i -= 1) drawStrip(i, (t) => Math.ceil(Math.max(1, t)), 380);
    ctx.restore();
  }

  // Floor / ceiling triangles
  const xcen = 320;
  const ycen = 240;
  const radius = 360;
  const trimax = 8;
  const rot = b.bgrot;
  ctx.save();
  ctx.globalAlpha = alpha;
  let blackon = 0;
  const spoke = (i) => {
    let x1 = lengthdirX(radius, rot + (360 / trimax) * i);
    let y1 = lengthdirY(radius / 2, rot + (360 / trimax) * i);
    let x2 = lengthdirX(radius, rot + (360 / trimax) * (i + 1));
    let y2 = lengthdirY(radius / 2, rot + (360 / trimax) * (i + 1));
    if (y1 <= 0) y1 *= 0.6;
    if (y2 <= 0) y2 *= 0.6;
    const col = blackon === 0 ? DKBLUE : DKBLUE2;
    blackon = blackon === 0 ? 1 : 0;
    return { x1, y1, x2, y2, col };
  };
  const tri = (x0, y0, x1, y1, x2, y2, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.closePath();
    ctx.fill();
  };
  for (let i = 0; i < trimax; i += 1) {
    const s = spoke(i);
    tri(xcen, ycen, xcen + s.x1, ycen + s.y1, xcen + s.x2, ycen + s.y2, s.col);
  }
  blackon = 0;
  for (let i = 0; i < 8; i += 1) {
    const s = spoke(i);
    if ((s.y1 > 0 || s.y2 > 0) && s.x2 > s.x1 - 48) {
      tri(xcen, ycen - 80, xcen + s.x1 / 6, ycen + s.y1 / 6, xcen + s.x2 / 6, ycen + s.y2 / 6, s.col);
    }
  }
  blackon = 0;
  for (let i = 8; i >= 0; i -= 1) {
    const s = spoke(i);
    if (s.y1 > 0 || s.y2 > 0) {
      tri(xcen, ycen - 80, xcen + s.x1 / 4, (ycen + s.y1) - 380, xcen + s.x2 / 4, (ycen + s.y2) - 380, s.col);
    }
  }
  blackon = 0;
  for (let i = 0; i < trimax; i += 1) {
    const s = spoke(i);
    tri(xcen, ycen - 320, xcen + s.x1, (ycen + s.y1) - 320, xcen + s.x2, (ycen + s.y2) - 320, s.col);
  }
  ctx.restore();
}

function stepBg(b, dodging) {
  const inFight = b.phase !== 'select' && b.phase !== 'gameover';
  if (inFight) {
    if (b.bgalpha < 1) b.bgalpha = Math.min(1, b.bgalpha + 0.02);
    b.bgrot += 2.5 * Math.max(0.1, b.bgrotspeed || 1);
    b.bgx += 1;
  } else if (b.bgalpha > 0) {
    b.bgalpha = Math.max(0, b.bgalpha - 0.02);
  }
  b.floatsiner += b.floatsinerspeed || 1;
}

// ---------------------------------------------------------------- actors

const PARTY_DRAW = [
  { idle: 'spr_krisb_idle', hurt: 'spr_krisb_hurt', down: 'spr_krisb_defeat', x: 80, y: 100 },
  { idle: 'spr_susieb_idle', hurt: 'spr_susieb_hurt', down: 'spr_susieb_defeat', x: 90, y: 150 },
  { idle: 'spr_ralseib_idle', hurt: 'spr_ralseib_hurt', down: 'spr_ralseib_defeat', x: 100, y: 210 },
];

function drawParty(ctx, state, b) {
  if (b.phase === 'select') return;
  for (let i = 0; i < 3; i += 1) {
    const p = state.party[i];
    const d = PARTY_DRAW[i];
    let spr = d.idle;
    let idx = state.frame / 5;
    if (p.hp <= 0) { spr = d.down; idx = 0; }
    else if (p.hurt > 0 && META[d.hurt]) { spr = d.hurt; idx = 0; }
    if (!META[spr]) spr = d.idle;
    drawSprite(ctx, spr, idx, d.x, d.y, 2, 2, 0, 1, null);
  }
}

function drawJevil(ctx, state, b) {
  if (b.spared || (b.phase === 'dodge' && !state.boardAlive)) return;
  if (b.bodyCondition === 4) return;
  const size = b.bodySize ?? 2;
  if (size <= 0) return;
  const fly = Math.sin(b.floatsiner / 8) * 3 * ((b.floatsinerspeed * 2) - 1);
  const flyx = b.dancelv >= 1
    ? Math.cos(b.floatsiner / 8) * 3 * ((b.floatsinerspeed * 2) - 1)
    : 0;
  const offx = 500 + 20 + (b.hurtFlash > 0 ? (Math.random() - 0.5) * 8 : 0);
  const offy = 160 + 18;
  const flash = b.hurtFlash > 0 && b.hurtFlash % 4 < 2;

  if (b.dancelv === 3) {
    b.dancesiner = (b.dancesiner || 0) + 1;
    if (!b.shadows) {
      b.shadows = Array.from({ length: 7 }, () => ({
        x: 0, y: 0, f: 1.5 - Math.random() * 3,
      }));
    }
    for (let i = 0; i < 7; i += 1) {
      const sh = b.shadows[i];
      if (i >= 1) {
        sh.x += Math.sin(i + b.floatsiner / 5) * 8 * sh.f;
        sh.y += Math.cos(i + b.floatsiner / 5) * 4 * sh.f;
      }
      let dalpha = Math.sin(i + b.dancesiner / 9);
      if (dalpha < 0 && i >= 1) {
        sh.x = 60 - Math.random() * 120;
        sh.y = 60 - Math.random() * 120;
        sh.f = 1.5 - Math.random() * 3;
      }
      if (dalpha > 0) {
        drawSprite(ctx, 'spr_joker_dance', b.dancesiner / 2 + i / 4,
          500 + sh.x, 160 + sh.y, size, 2, 0, dalpha, null);
      }
    }
    return;
  }

  let spr = 'spr_joker_main';
  let idx = 0;
  if (b.dancelv === 1) {
    spr = 'spr_joker_dance';
    idx = b.floatsiner / 3;
  } else if (b.dancelv === 2 || b.tired) {
    spr = 'spr_joker_tired';
  }
  drawSprite(ctx, spr, idx, offx + flyx, offy + fly, size, 2, 0, flash ? 0.35 : 1, null);

  // Ground shadow under him
  if (b.dancelv <= 2) {
    ctx.fillStyle = '#000';
    const sx = offx + flyx;
    const sy = 160 + 80 - fly / 2;
    ctx.fillRect(sx - 20 - fly + flyx, sy, 50 + fly * 2, 5 + fly);
  }
}

// ---------------------------------------------------------------- HUD

const BP = 152;
const B_OFFSET = 336;
const CHUNK = [0, 212, 424];
const CHAR_COLOR = ['#00ffff', '#ff00ff', '#00ff00'];
const MAROON = 'rgb(128,0,0)';
const BCOLOR = 'rgb(0,0,128)';
const BUTTONS = [
  { sprite: 'spr_btfight', x: 15 },
  { sprite: 'spr_btact', x: 50 },
  { sprite: 'spr_btitem', x: 85 },
  { sprite: 'spr_btspare', x: 120 },
  { sprite: 'spr_btdefend', x: 155 },
];
const HEADS = ['spr_headkris', 'spr_headsusie', 'spr_headralsei'];
const NAMES = ['spr_bnamekris', 'spr_bnamesusie', 'spr_bnameralsei'];

const trail = { apparent: 0, current: 0, changetimer: 0, x: -40, sp: 13 };
const HP_MAP = '0123456789+-';

function drawHpNum(ctx, str, x, y, color) {
  const s = String(str);
  let pen = x;
  for (let i = s.length - 1; i >= 0; i -= 1) {
    const idx = HP_MAP.indexOf(s[i]);
    if (idx < 0) continue;
    pen -= 8;
    const img = imgOf('spr_numbersfontsmall', idx);
    if (!img || !img.width) continue;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(color && color !== '#ffffff' ? tinted(img, color) : img, pen, y);
    ctx.restore();
  }
}

function stepTension(state) {
  if (trail.sp > 0) {
    trail.sp -= 1;
    trail.x += trail.sp;
    if (trail.sp <= 0) trail.x = 38;
  }
  const tension = state.tension ?? 0;
  if (Math.abs(trail.apparent - tension) < 20) trail.apparent = tension;
  if (trail.apparent < tension) trail.apparent += 20;
  if (trail.apparent > tension) trail.apparent -= 20;
  if (trail.apparent !== trail.current) {
    trail.changetimer += 1;
    if (trail.changetimer > 15) {
      const d = trail.apparent - trail.current;
      if (d > 0) trail.current += 2;
      if (d > 10) trail.current += 2;
      if (d > 25) trail.current += 3;
      if (d < 0) trail.current -= 2;
      if (d < -10) trail.current -= 2;
      if (Math.abs(trail.apparent - trail.current) < 3) trail.current = trail.apparent;
    }
  } else trail.changetimer = 0;
}

function drawTension(ctx, state) {
  const X = trail.x;
  const Y = 40;
  const max = 100;
  drawSprite(ctx, 'spr_tplogo', 0, X - 30, Y + 30, 1, 1, 0, 1, null);
  drawSprite(ctx, 'spr_tensionbar', 1, X, Y, 1, 1, 0, 1, null);
  const bar = META.spr_tensionbar;
  const h = bar ? bar.h : 196;
  const w = bar ? bar.w : 25;
  const fill = (value, style) => {
    const top = Y + h - (value / max) * h;
    ctx.fillStyle = style;
    ctx.fillRect(X + 3, top, w - 4, Y + h - 1 - top);
  };
  if (trail.current > 0 || trail.apparent > 0) {
    if (trail.apparent < trail.current) {
      fill(trail.current, '#ff0000');
      fill(trail.apparent, 'rgb(255,128,0)');
    } else if (trail.apparent > trail.current) {
      fill(trail.apparent, '#ffffff');
      fill(trail.current, 'rgb(255,128,0)');
    } else {
      fill(trail.current, 'rgb(255,128,0)');
    }
  }
  if (trail.apparent > 20 && trail.apparent < max) {
    drawSprite(ctx, 'spr_tensionmarker', 0, X + 3,
      Y + h - (trail.current / max) * h, 1, 1, 0, 1, null);
  }
  drawSprite(ctx, 'spr_tensionbar', 0, X, Y, 1, 1, 0, 1, null);

  const font = loadFont('fnt_mainbig');
  const tamt = Math.floor((trail.apparent / max) * 100);
  if (tamt < 100) {
    drawText(ctx, font, String(tamt), X - 30, Y + 70, { color: '#ffffff' });
    drawText(ctx, font, '%', X - 25, Y + 95, { color: '#ffffff' });
  } else {
    drawText(ctx, font, 'M', X - 28, Y + 70, { color: '#ffff00' });
    drawText(ctx, font, 'A', X - 24, Y + 90, { color: '#ffff00' });
    drawText(ctx, font, 'X', X - 20, Y + 110, { color: '#ffff00' });
  }
}

function selectionMatrix(ctx, x, y, siner, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 210, 3);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i += 1) {
    const m = siner + i * (10 * Math.PI);
    ctx.globalAlpha = Math.max(0, Math.min(1, Math.sin(m / 60)));
    ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 33); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 211, y - 3); ctx.lineTo(x + 211, y + 33); ctx.stroke();
    if (Math.cos(m / 60) < 0) {
      ctx.beginPath();
      ctx.moveTo(x - Math.sin(m / 60) * 30 + 30, y);
      ctx.lineTo(x - Math.sin(m / 60) * 30 + 30, y + 33);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function stepMmy(b) {
  const selected = b.phase === 'menu' ? (b.charturn ?? 0) : -1;
  if (!b.mmy) b.mmy = [0, 0, 0];
  for (let c = 0; c < 3; c += 1) {
    let m = b.mmy[c];
    if (c === selected) {
      if (m > -32) m -= 2;
      if (m > -24) m -= 4;
      if (m > -16) m -= 6;
      if (m > -8) m -= 8;
      if (m < -32) m = -32;
    } else if (m < -14) {
      m += 15;
    } else {
      m = 0;
    }
    b.mmy[c] = m;
  }
}

function drawCharboxes(ctx, state, b) {
  const top = 480 - BP;
  ctx.fillStyle = '#000';
  ctx.fillRect(-10, top, 660, 160);
  ctx.fillStyle = BCOLOR;
  ctx.fillRect(-10, top - 2, 660, 2);
  ctx.fillRect(-10, top + 34, 660, 2);

  stepMmy(b);
  const selecting = b.phase === 'menu';
  const fontBig = loadFont('fnt_mainbig');
  if (!b.selected) b.selected = [0, 0, 0];

  for (let c = 0; c < 3; c += 1) {
    const chunk = CHUNK[c];
    const raised = b.mmy[c];
    const color = CHAR_COLOR[c];
    const active = selecting && c === (b.charturn ?? 0);
    const up = (state.party[c]?.hp ?? 0) > 0;

    if (up && b.phase !== 'select' && b.mode !== 'endless') {
      for (let i = 0; i < BUTTONS.length; i += 1) {
        const spec = BUTTONS[i];
        const spr = i === 1 && c !== 0 ? 'spr_bttech' : spec.sprite;
        const lit = active && !b.submenu && b.selected[c] === i ? 1 : 0;
        drawSprite(ctx, spr, lit, chunk + spec.x, 485 - BP, 1, 1, 0, 1, null);
      }
    }

    ctx.fillStyle = active ? color : '#808080';
    ctx.fillRect(chunk, top - 2 + raised, 212, 2 - raised);
    ctx.fillStyle = '#000';
    ctx.fillRect(chunk + 2, top + raised, 208, 33);

    if (active && !b.submenu) {
      selectionMatrix(ctx, chunk, top, state.frame * 2, color);
    }

    drawSprite(ctx, HEADS[c], 0, chunk + 13, B_OFFSET + raised, 1, 1, 0, 1, null);
    drawSprite(ctx, NAMES[c], 0, chunk + 51, B_OFFSET + 3 + raised, 1, 1, 0, 1, null);
    drawSprite(ctx, 'spr_hpname', 0, chunk + 109, B_OFFSET + 11 + raised, 1, 1, 0, 1, null);

    const p = state.party[c];
    const hp = p.hp;
    const maxhp = p.maxhp;
    let hpColor = '#ffffff';
    if (hp / maxhp <= 0.25) hpColor = '#ffff00';
    if (hp <= 0) hpColor = '#ff0000';
    drawHpNum(ctx, hp, chunk + 160, B_OFFSET - 2 + raised, hpColor);
    drawSprite(ctx, 'spr_hpslash', 0, chunk + 159, B_OFFSET - 4 + raised, 1, 1, 0, 1, null);
    drawHpNum(ctx, maxhp, chunk + 205, B_OFFSET - 2 + raised, hpColor);

    ctx.fillStyle = MAROON;
    ctx.fillRect(chunk + 128, B_OFFSET + 11 + raised, 75, 8);
    if (hp > 0) {
      ctx.fillStyle = color;
      ctx.fillRect(chunk + 128, B_OFFSET + 11 + raised, Math.ceil((hp / maxhp) * 75), 8);
    }
  }

  if (selecting && b.submenu) {
    let rows = [];
    let sel = b.subIndex;
    if (b.submenu === 'act') rows = ACTS;
    else if (b.submenu === 'magic') {
      rows = (MAGIC[b.charturn] || []).map((s) => `${s.name}  ${s.cost}%`);
    }
    if (b.submenu === 'item') {
      bagRows(b).forEach((it, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const label = it.count > 1 ? `${it.name} x${it.count}` : it.name;
        if (i === sel) drawSprite(ctx, 'spr_heart', 0, col ? 230 : 10, 385 + row * 30, 1, 1, 0, 1, null);
        drawText(ctx, fontBig, label, col ? 260 : 30, 376 + row * 30, { color: '#ffffff' });
      });
    } else if (b.submenu === 'target') {
      state.party.forEach((p, i) => {
        if (i === b.targetIndex) drawSprite(ctx, 'spr_heart', 0, 10, 385 + i * 30, 1, 1, 0, 1, null);
        drawText(ctx, fontBig, p.name, 30, 376 + i * 30, { color: '#ffffff' });
      });
    } else {
      rows.forEach((r, i) => {
        if (i === sel) drawSprite(ctx, 'spr_heart', 0, 10, 385 + i * 30, 1, 1, 0, 1, null);
        let color = '#ffffff';
        if (b.submenu === 'magic') {
          const sp = (MAGIC[b.charturn] || [])[i];
          if (sp && (state.tension ?? 0) < sp.cost) color = '#808080';
        }
        drawText(ctx, fontBig, r, 30, 376 + i * 30, { color });
      });
    }
  } else if (b.phase === 'menu' || b.phase === 'enemytext' || b.phase === 'end') {
    const lines = String(b.message || '').split('\n');
    lines.forEach((ln, i) => {
      drawText(ctx, fontBig, ln, 30, 376 + i * 28, { color: '#ffffff' });
    });
  }
}

function drawEntities(ctx, state, b) {
  const list = state.entities
    .filter((e) => e.alive && e.visible && e.type.name !== 'obj_growtangle')
    .sort((x, y) => y.depth - x.depth || x.seq - y.seq);

  for (const e of list) {
    const t = e.type.name;
    if (t === 'obj_heart') {
      const blink = state.inv > 0 && state.frame % 4 < 2;
      drawSprite(ctx, 'spr_dodgeheart', e.image_index, e.x, e.y, 1, 1, 0, blink ? 0.35 : 1, null);
      if ((state.grazefx || 0) > 0) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,160,${state.grazefx / 12})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x + 10, e.y + 10, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      continue;
    }
    if (t === 'obj_suitbomb') {
      if (e.con === 3) {
        ctx.save();
        ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 1 - e.explodedraw / 40)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.explodedraw * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else if (e.visible && e.sprite_index) {
        const flash = e.image_speed > 0 && Math.floor(e.image_index) % 2 === 1;
        drawSprite(ctx, e.sprite_index, 0, e.x, e.y, 2, 2, 0, 1, flash ? '#ffffff' : null);
      }
      continue;
    }
    if (t === 'obj_laserscythe') {
      if (e.explode < 2) {
        drawSprite(ctx, 'spr_joker_scythebody', 0, e.remx, e.remy, e.scale, e.scale, e.remrot, 1, null);
      }
      if (e.explode >= 1) {
        const w = Math.max(0, e.image_xscale * 5);
        ctx.fillStyle = `rgba(255,255,255,${e.image_alpha * (e.active === 1 ? 1 : 0.45)})`;
        ctx.fillRect(e.x - w / 2, 0, w, 480);
      }
      continue;
    }
    if (!e.sprite_index) continue;
    const blend = e.behind ? 'rgb(85,85,85)' : e.image_blend;
    drawSprite(ctx, e.sprite_index, e.image_index, e.x, e.y,
      e.image_xscale, e.image_yscale, e.image_angle, e.image_alpha, blend);
  }
}

function mergeRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgbCss(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

const C_WHITE = [255, 255, 255];
const C_NAVY = [0, 0, 128];
const C_BLUE = [0, 0, 255];
const C_PURPLE = [128, 0, 128];
const C_GREEN = [0, 128, 0];
const BOLTCOLOR = [[0, 255, 255], [255, 0, 255], [0, 255, 0]].map((c) => mergeRgb(c, C_WHITE, 0.5));
const ROWCOLOR = [C_BLUE, C_PURPLE, C_GREEN];

function outlineRect(ctx, x1, y1, x2, y2, color) {
  ctx.strokeStyle = rgbCss(color);
  ctx.lineWidth = 1;
  ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1, y2 - y1);
}

function drawFightBar(ctx, bar) {
  if (!bar || !bar.active) return;
  const x = BAR_X;
  const y = BAR_Y;
  const anyChar = bar.havechar.some((h) => h === 1);
  ctx.save();
  for (let i = 0; i < 3; i += 1) {
    const ry = y + ROW_PITCH * i;
    if (anyChar && (i === 1 || i === 2)) {
      ctx.fillStyle = rgbCss(C_NAVY);
      ctx.fillRect(x + 77, ry, 300 - 77, 1);
    }
    if (bar.havechar[i] !== 1) continue;
    const j = i + 1;
    let color = ROWCOLOR[j - 1] ?? C_NAVY;
    const pb = bar.pressbuffer[j] ?? 0;
    if (pb > 0) color = mergeRgb(color, C_WHITE, pb / 5);
    outlineRect(ctx, x + 78, ry, x + 80 + 15 * BOLT_SPEED, ry + 36, color);
    outlineRect(ctx, x + 79, ry + 2, x + 80 + 15 * BOLT_SPEED - 1, ry + 35, color);
    drawSprite(ctx, 'spr_pressfront', j - 1, x, ry, 1, 1, 0, 1, null);
    drawSprite(ctx, 'spr_pressfront_b', bar.oneButton ? 0 : i, x, ry, 1, 1, 0, 1, null);
    drawSprite(ctx, 'spr_pressspot', j - 1, x + 80, ry, 1, 1, 0, 1, null);
  }
  for (const a of bar.afterimages) {
    drawSprite(ctx, 'spr_attackspot', 0, x + a.x, y + a.y, 1, 1, 0, a.alpha, null);
  }
  for (const bolt of bar.bolts) {
    if (!bolt.alive) continue;
    const close = bolt.frame - bar.boltx;
    const alpha = close < 0 ? 1 + close / 3 : 1;
    if (alpha <= 0) continue;
    drawSprite(ctx, 'spr_attackspot', 0, x + 80 + close * BOLT_SPEED, y + ROW_PITCH * bolt.char, 1, 1, 0, alpha, null);
  }
  for (const s of bar.bursts) {
    const color = s.critical ? '#ffff00' : rgbCss(BOLTCOLOR[s.char] ?? C_WHITE);
    drawSprite(ctx, 'spr_attackspot', 0, x + s.x, y + s.y, s.xscale, s.yscale, 0, Math.max(0, s.alpha), color);
  }
  if (bar.fade) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, bar.fadeamt ?? 0)})`;
    ctx.fillRect(x - 1, y, 641, 300);
  }
  ctx.restore();
}

function drawDmgNumbers(ctx, state) {
  const d = state.dmg;
  if (!d) return;
  for (const v of d.vfx) {
    drawSprite(ctx, v.sprite, v.index, v.x, v.y, v.scale, v.scale, 0, 1, null);
  }
  for (const n of d.list) {
    if (n.delaytimer < n.delay) continue;
    const xs = 2 - n.stretch;
    const ys = n.stretch + n.kill;
    const alpha = Math.max(0, 1 - n.kill);
    if (xs <= 0 || ys <= 0 || alpha <= 0) continue;
    const color = dmgColor(n.type);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(n.x + 30, n.y);
    ctx.scale(xs, ys);
    let frame = -1;
    if (n.damage === 0) frame = 0;
    if (n.type === TYPE_DEAD) frame = 1;
    if (frame >= 0) {
      const msg = imgOf('spr_battlemsg', frame);
      const meta = META.spr_battlemsg;
      if (msg && msg.width && meta) {
        ctx.drawImage(color !== '#ffffff' ? tinted(msg, color) : msg, -meta.ox, -meta.oy);
      }
    } else {
      const text = String(n.damage);
      let pen = 0;
      for (let i = 0; i < text.length; i += 1) pen += 20;
      let x = -pen;
      for (const ch of text) {
        const img = imgOf('spr_numbersfontbig', '0123456789'.indexOf(ch));
        if (img && img.width) {
          ctx.drawImage(color !== '#ffffff' ? tinted(img, color) : img, x, 0);
        }
        x += 20;
      }
    }
    ctx.restore();
  }
}

function drawBattleBlcon(ctx, text) {
  const lines = String(text).split('\n');
  const x = 340;
  const y = 128;
  const w = 150;
  const padX = 10;
  const padY = 8;
  const lh = 16;
  const h = Math.max(44, padY * 2 + lines.length * lh);
  const mid = y + Math.floor(h / 2);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(x + w - 1, mid - 8);
  ctx.lineTo(x + w + 11, mid);
  ctx.lineTo(x + w - 1, mid + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x + w - 1, mid - 6);
  ctx.lineTo(x + w + 9, mid);
  ctx.lineTo(x + w - 1, mid + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const font = loadFont('fnt_main');
  lines.forEach((line, i) => {
    drawText(ctx, font, line, x + padX, y + padY + i * lh, { color: '#000000' });
  });
}

function drawGameover(ctx, state, b, font, small) {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, 640, 480);
  drawText(ctx, font, 'GAME OVER', 320, 168, { color: '#ff3333', halign: 'center' });
  drawText(ctx, small, "DON'T GIVE UP!", 320, 214, { color: '#ffffff', halign: 'center' });
  const g = GAMEOVER_MENU;
  const sel = b.goIndex ?? 0;
  const bob = Math.round(Math.sin(state.frame / 3) * 1);
  const labels = [
    { text: 'CONTINUE', x: g.continueX },
    { text: 'MAIN MENU', x: g.menuX },
  ];
  labels.forEach((opt, i) => {
    const on = i === sel;
    if (on) drawSprite(ctx, 'spr_heart', 0, opt.x - 22, g.y + 8 + bob, 1, 1, 0, 1, null);
    drawText(ctx, font, opt.text, opt.x, g.y, { color: on ? '#ffff00' : '#ffffff' });
  });
}

function drawModeSelect(ctx, state, b, font, small) {
  const m = MODE_MENU;
  drawText(ctx, font, 'JEVIL', 320, m.titleY, { color: '#cc88ff', halign: 'center' });
  const sel = b.modeIndex ?? 0;
  const bob = Math.round(Math.sin(state.frame / 3) * 1);
  for (let i = 0; i < SELECT_ROWS; i += 1) {
    const y = m.startY + i * m.spacing;
    const on = i === sel;
    if (on) {
      drawSprite(ctx, 'spr_heart', 0, m.heartX, y + 8 + bob, 1, 1, 0, 1, null);
    }
    const label = i === HITBOX_ROW
      ? (b.accurateHitbox ? 'ACCURATE HITBOXES  ON' : 'ACCURATE HITBOXES  OFF')
      : MODES[i].label;
    drawText(ctx, font, label, m.textX, y, { color: on ? '#ffff00' : '#ffffff' });
  }
  const desc = sel === HITBOX_ROW
    ? ['Hits use each sprite\'s opaque pixels.', 'Applies to every fight mode.']
    : (MODES[sel]?.desc || []);
  const descY = m.startY + SELECT_ROWS * m.spacing + 8;
  desc.forEach((line, i) => {
    drawText(ctx, small, line, 320, descY + i * 18, { color: '#888888', halign: 'center' });
  });
  drawText(ctx, small, 'UP / DOWN  Z or click to begin   LEFT / RIGHT hitbox', 320, 438, {
    color: '#666666',
    halign: 'center',
  });
}

export function render(canvas, state, b) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 640, 480);

  if (state.shake > 0) {
    state.shake -= 0.5;
    ctx.translate((Math.random() - 0.5) * state.shake * 2, (Math.random() - 0.5) * state.shake * 2);
  }

  const dodging = b.phase === 'dodge';
  stepBg(b, dodging);
  stepTension(state);
  drawCarouselBg(ctx, b);
  drawParty(ctx, state, b);
  drawJevil(ctx, state, b);

  if (b.phase !== 'select') {
    drawTension(ctx, state);
    drawCharboxes(ctx, state, b);
    if (b.phase === 'fight') drawFightBar(ctx, b.fightBar);
  }

  if (dodging && state.boardAlive) {
    const box = state.entities.find((e) => e.alive && e.type.name === 'obj_growtangle');
    if (box) {
      // obj_growtangle Draw: frame 1 then draw_self(), both with image_blend.
      const a = (box.image_alpha ?? 1) * (state.boardAlpha ?? 1);
      const blend = box.image_blend;
      drawSprite(ctx, 'spr_battlebg_0', 1, box.x, box.y,
        box.image_xscale, box.image_yscale, box.image_angle, a, blend);
      drawSprite(ctx, 'spr_battlebg_0', 0, box.x, box.y,
        box.image_xscale, box.image_yscale, box.image_angle, a, blend);
    }
  }

  drawEntities(ctx, state, b);
  drawDmgNumbers(ctx, state);

  if ((state.darkfade || 0) > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, state.darkfade) * 0.55})`;
    ctx.fillRect(-20, -20, 680, 520);
  }
  if ((state.fadewhite || 0) > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(1, state.fadewhite)})`;
    ctx.fillRect(-20, -20, 680, 520);
  }

  if (b.phase === 'enemytext' && b.turnLine) {
    drawBattleBlcon(ctx, b.turnLine);
  }

  if ((state.endlessFail || (b.failTimer || 0) > 0) && b.mode === 'endless') {
    drawText(ctx, loadFont('fnt_mainbig'), 'FAILED', 16, 12, { color: '#ff0000' });
  }

  const font = loadFont('fnt_mainbig');
  const small = loadFont('fnt_main');
  if (b.phase === 'select') {
    drawModeSelect(ctx, state, b, font, small);
  }
  if (b.phase === 'gameover') {
    drawGameover(ctx, state, b, font, small);
  }
  if (b.phase === 'end') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 640, 480);
    drawText(ctx, font, b.spared ? 'YOU WON!' : 'JEVIL WAS DEFEATED', 320, 190, { color: '#ffff66', halign: 'center' });
  }
}
