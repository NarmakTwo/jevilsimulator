// Per-pixel collision masks built from sprite PNGs. Used only when
// accurate-hitbox mode is on: a hit is opaque-on-opaque, after the same
// translate / scale / nearest-neighbour rotate the renderer uses.

import { META } from './meta.js';

const masks = new Map();

export function buildMasks(images) {
  masks.clear();
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d', { willReadFrequently: true });
  for (const [key, img] of Object.entries(images)) {
    if (!img || !img.width) continue;
    canvas.width = img.width;
    canvas.height = img.height;
    g.clearRect(0, 0, img.width, img.height);
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, img.width, img.height).data;
    const a = new Uint8Array(img.width * img.height);
    for (let i = 0; i < a.length; i += 1) a[i] = data[i * 4 + 3];
    masks.set(key, { w: img.width, h: img.height, a });
  }
}

function maskOf(name, index) {
  const m = META[name];
  const n = m?.frames || 1;
  const i = ((Math.floor(Math.abs(index || 0)) % n) + n) % n;
  return masks.get(`${name}_${i}`) || null;
}

/** Inverse of drawSprite's transform: world point -> source pixel. */
function sample(e, name, wx, wy) {
  const meta = META[name];
  const mask = maskOf(name, e.image_index);
  if (!meta || !mask) return false;
  const sx = e.image_xscale || 1;
  const sy = e.image_yscale || 1;
  if (sx === 0 || sy === 0) return false;
  const rad = ((e.image_angle || 0) * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const dx = (wx - e.x) / sx;
  const dy = (wy - e.y) / sy;
  const px = Math.round(dx * cosA - dy * sinA + meta.ox);
  const py = Math.round(dx * sinA + dy * cosA + meta.oy);
  if (px < 0 || py < 0 || px >= mask.w || py >= mask.h) return false;
  return mask.a[py * mask.w + px] > 0;
}

function worldAABB(e, name) {
  const meta = META[name];
  if (!meta) return null;
  const sx = e.image_xscale || 1;
  const sy = e.image_yscale || 1;
  const rad = ((e.image_angle || 0) * Math.PI) / 180;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const corners = [
    [-meta.ox, -meta.oy],
    [meta.w - meta.ox, -meta.oy],
    [-meta.ox, meta.h - meta.oy],
    [meta.w - meta.ox, meta.h - meta.oy],
  ];
  let l = Infinity;
  let t = Infinity;
  let r = -Infinity;
  let b = -Infinity;
  for (const [lx, ly] of corners) {
    const rx = lx * cosA + ly * sinA;
    const ry = -lx * sinA + ly * cosA;
    const wx = e.x + rx * sx;
    const wy = e.y + ry * sy;
    if (wx < l) l = wx;
    if (wx > r) r = wx;
    if (wy < t) t = wy;
    if (wy > b) b = wy;
  }
  return { l, r, t, b };
}

function heartDraw(heart) {
  return {
    x: heart.x,
    y: heart.y,
    image_xscale: 1,
    image_yscale: 1,
    image_angle: 0,
    image_index: heart.image_index,
  };
}

function overlapHits(a, aname, b, bname) {
  const aa = worldAABB(a, aname);
  const ba = worldAABB(b, bname);
  if (!aa || !ba) return false;
  const l = Math.max(aa.l, ba.l);
  const r = Math.min(aa.r, ba.r);
  const t = Math.max(aa.t, ba.t);
  const btm = Math.min(aa.b, ba.b);
  if (l >= r || t >= btm) return false;
  const x0 = Math.floor(l);
  const y0 = Math.floor(t);
  const x1 = Math.ceil(r);
  const y1 = Math.ceil(btm);
  for (let wy = y0; wy < y1; wy += 1) {
    for (let wx = x0; wx < x1; wx += 1) {
      const cx = wx + 0.5;
      const cy = wy + 0.5;
      if (sample(a, aname, cx, cy) && sample(b, bname, cx, cy)) return true;
    }
  }
  return false;
}

/** True if an opaque pixel of the drawn sprite overlaps the soul. */
export function pixelHitsAt(draw, heart) {
  const name = draw.sprite_index;
  if (!name) return false;
  return overlapHits(draw, name, heartDraw(heart), 'spr_dodgeheart');
}

/** True if an opaque pixel of the bullet overlaps an opaque pixel of the soul. */
export function pixelHits(e, heart) {
  return pixelHitsAt(e, heart);
}

/** Soul opaque pixels vs an axis-aligned world rect (canvas-drawn beams). */
export function pixelHitsRect(rect, heart) {
  const h = heartDraw(heart);
  const ha = worldAABB(h, 'spr_dodgeheart');
  if (!ha) return false;
  const l = Math.max(rect.l, ha.l);
  const r = Math.min(rect.r, ha.r);
  const t = Math.max(rect.t, ha.t);
  const b = Math.min(rect.b, ha.b);
  if (l >= r || t >= b) return false;
  const x0 = Math.floor(l);
  const y0 = Math.floor(t);
  const x1 = Math.ceil(r);
  const y1 = Math.ceil(b);
  for (let wy = y0; wy < y1; wy += 1) {
    for (let wx = x0; wx < x1; wx += 1) {
      if (sample(h, 'spr_dodgeheart', wx + 0.5, wy + 0.5)) return true;
    }
  }
  return false;
}
