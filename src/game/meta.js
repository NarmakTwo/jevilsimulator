// Sprite metadata (dims, origins, bboxes) loaded from the generated
// manifest.json at boot. Both the sim (hit shapes) and the renderer use it.

export const META = {};

export function setMeta(manifest) {
  for (const k of Object.keys(manifest)) {
    if (k !== '__sounds') META[k] = manifest[k];
  }
}

/**
 * Oriented-bbox vs axis-aligned rect overlap (SAT on the two frames).
 * The bullet bbox comes from its sprite meta, scaled and rotated around the
 * sprite origin. Approximation of GameMaker's precise masks.
 */
export function bulletHits(e, rect, shrink = 0, hitboxScale = 1) {
  const m = META[e.sprite_index];
  if (!m) return false;
  const sx = Math.abs(e.image_xscale) * hitboxScale;
  const sy = Math.abs(e.image_yscale) * hitboxScale;
  // bbox corners relative to origin, scaled
  const l = (m.bbl - m.ox) * sx + shrink;
  const r = (m.bbr + 1 - m.ox) * sx - shrink;
  const t = (m.bbt - m.oy) * sy + shrink;
  const b = (m.bbb + 1 - m.oy) * sy - shrink;
  if (l >= r || t >= b) return false;

  const a = -e.image_angle * Math.PI / 180; // screen-space rotation
  const cos = Math.cos(a);
  const sin = Math.sin(a);

  // rect corners into bullet-local space
  const cx = e.x;
  const cy = e.y;
  const pts = [
    [rect.l - cx, rect.t - cy], [rect.r - cx, rect.t - cy],
    [rect.l - cx, rect.b - cy], [rect.r - cx, rect.b - cy],
  ].map(([px, py]) => [px * cos + py * sin, -px * sin + py * cos]);

  // SAT axis set 1: bullet-local axes
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  if (maxX < l || minX > r || maxY < t || minY > b) return false;

  // SAT axis set 2: world axes — project bullet's rotated corners
  const corners = [[l, t], [r, t], [l, b], [r, b]].map(([px, py]) => [
    cx + px * cos - py * sin,
    cy + px * sin + py * cos,
  ]);
  let wMinX = Infinity, wMaxX = -Infinity, wMinY = Infinity, wMaxY = -Infinity;
  for (const [px, py] of corners) {
    if (px < wMinX) wMinX = px;
    if (px > wMaxX) wMaxX = px;
    if (py < wMinY) wMinY = py;
    if (py > wMaxY) wMaxY = py;
  }
  return !(wMaxX < rect.l || wMinX > rect.r || wMaxY < rect.t || wMinY > rect.b);
}
