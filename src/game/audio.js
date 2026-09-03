// SFX: WAV blobs from the Chapter 1 export (data.win / sounds/).
// Battle BGM (The World Revolving / mus/joker.ogg) is not played.

let ctx = null;
const buffers = {};

const CUES = {
  hurt: 'snd_hurt1',
  hurt_jevil: 'snd_hurt1',
  graze: 'snd_graze',
  swing: 'snd_swing',
  spearappear: 'snd_spearappear',
  scytheburst: 'snd_scytheburst',
  rumble: 'snd_rumble',
  bombfall: 'snd_bombfall',
  bomb: 'snd_bomb',
  pirouette: 'snd_pirouette',
  hypnosis: 'snd_hypnosis',
  joker_chaos: 'snd_joker_chaos',
  joker_anything: 'snd_joker_anything',
  joker_oh: 'snd_joker_oh',
  joker_byebye: 'snd_joker_byebye',
  joker_neochaos: 'snd_joker_neochaos',
  joker_laugh0: 'snd_joker_laugh0',
  joker_laugh1: 'snd_joker_laugh1',
  joker_ha0: 'snd_joker_ha0',
  joker_ha1: 'snd_joker_ha1',
  joker_metamorphosis: 'snd_joker_metamorphosis',
  weirdeffect: 'snd_weirdeffect',
  menu: 'snd_select',
  menumove: 'snd_menumove',
  slash: 'snd_smallswing',
  crit: 'snd_criticalswing',
  heal: 'snd_weirdeffect',
};

async function decodeFile(path) {
  const res = await fetch(path);
  if (!res.ok) return null;
  const data = await res.arrayBuffer();
  return ctx.decodeAudioData(data.slice(0));
}

export async function initAudio() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const names = [...new Set(Object.values(CUES))];
  await Promise.all(names.map(async (file) => {
    try {
      buffers[file] = await decodeFile(`sounds/${file}.wav`)
        || await decodeFile(`sounds/${file}.ogg`)
        || await decodeFile(`sounds/${file}.audio`);
    } catch { /* leave missing */ }
  }));
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}

export function play(name) {
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const file = CUES[name] || name;
  const buf = buffers[file] || buffers[name];
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = 0.55;
  src.connect(g).connect(ctx.destination);
  src.start();
}
