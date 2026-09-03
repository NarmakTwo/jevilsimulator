// GameMaker font assets (fnt_main / fnt_mainbig) extracted from the .yy + png.

const caches = new Map();

export function loadFont(name = 'fnt_mainbig') {
  if (caches.has(name)) return caches.get(name);
  const f = { ready: false, glyphs: new Map(), img: null, meta: null };
  caches.set(name, f);
  fetch(`fonts/${name}.json`)
    .then((r) => r.json())
    .then((meta) => {
      f.meta = meta;
      for (const g of meta.glyphs) f.glyphs.set(g.c, g);
      const img = new Image();
      img.onload = () => { f.img = img; f.ready = true; };
      img.src = `fonts/${name}.png`;
    })
    .catch(() => {});
  return f;
}

export function textWidth(font, text) {
  if (!font || !font.glyphs.size) return 0;
  let w = 0;
  for (const ch of String(text)) {
    const g = font.glyphs.get(ch.codePointAt(0));
    if (g) w += g.shift;
  }
  return w;
}

const tintPages = new Map();

function tintedPage(font, color) {
  if (!color || color === '#ffffff' || color === '#fff') return font.img;
  const key = `${font.meta.name}|${color}`;
  const hit = tintPages.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = font.img.width;
  c.height = font.img.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(font.img, 0, 0);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(font.img, 0, 0);
  tintPages.set(key, c);
  return c;
}

export function drawText(ctx, font, str, x, y, { color = '#ffffff', alpha = 1, halign = 'left', xscale = 1 } = {}) {
  if (!font || !font.ready || !font.img) return;
  let pen = x;
  if (halign !== 'left') {
    const w = textWidth(font, str) * xscale;
    pen -= halign === 'center' ? w / 2 : w;
  }
  const page = tintedPage(font, color);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  for (const ch of String(str)) {
    const g = font.glyphs.get(ch.codePointAt(0));
    if (!g) continue;
    if (g.w > 0 && g.h > 0) {
      ctx.drawImage(page, g.x, g.y, g.w, g.h, pen + g.offset * xscale, y, g.w * xscale, g.h);
    }
    pen += g.shift * xscale;
  }
  ctx.restore();
}
