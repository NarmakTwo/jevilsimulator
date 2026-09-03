// Browser driver. Owns real time; the sim only ever advances whole 30fps
// frames through the accumulator (same rule as the Knight port).

import { drain } from './gml.js';
import { createState, stepFrame, cue } from './sim.js';
import { createParty } from './party.js';
import { createBattle, stepBattle, beginMode, returnToSelect, modeIndexAt, gameoverIndexAt, toggleHitbox, HITBOX_ROW } from './battle.js';
import { setMeta } from './meta.js';
import { loadSprites, render } from './render.js';
import { bindKeyboard, readInput, readPressed } from './input.js';
import { initAudio, resumeAudio, play } from './audio.js';

function canvasPoint(canvas, ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (ev.clientX - r.left) * (canvas.width / r.width),
    y: (ev.clientY - r.top) * (canvas.height / r.height),
  };
}

async function boot() {
  const canvas = document.getElementById('game');
  const manifest = await (await fetch('manifest.json')).json();
  setMeta(manifest);
  await Promise.all([loadSprites(manifest), initAudio()]);

  const state = createState();
  state.party = createParty();
  state.boardAlive = true;
  const battle = createBattle();
  window.__state = state;
  window.__battle = battle;

  bindKeyboard({
    onZ() {
      if (battle.phase === 'select' && battle.modeIndex !== HITBOX_ROW) {
        resumeAudio();
      }
    },
  });

  canvas.addEventListener('pointermove', (ev) => {
    const { x, y } = canvasPoint(canvas, ev);
    if (battle.phase === 'select') {
      const i = modeIndexAt(x, y);
      if (i >= 0 && i !== battle.modeIndex) {
        battle.modeIndex = i;
        cue(state, 'menumove');
      }
      return;
    }
    if (battle.phase === 'gameover') {
      const i = gameoverIndexAt(x, y);
      if (i >= 0 && i !== battle.goIndex) {
        battle.goIndex = i;
        cue(state, 'menumove');
      }
    }
  });

  canvas.addEventListener('pointerdown', (ev) => {
    const { x, y } = canvasPoint(canvas, ev);
    if (battle.phase === 'select') {
      const i = modeIndexAt(x, y);
      if (i < 0) return;
      ev.preventDefault();
      battle.modeIndex = i;
      if (i === HITBOX_ROW) {
        toggleHitbox(state, battle);
        return;
      }
      resumeAudio();
      beginMode(state, battle);
      return;
    }
    if (battle.phase === 'gameover') {
      const i = gameoverIndexAt(x, y);
      if (i < 0) return;
      ev.preventDefault();
      battle.goIndex = i;
      cue(state, 'menu');
      if (i === 0) beginMode(state, battle);
      else returnToSelect(state, battle);
    }
  });

  let last = performance.now();
  let acc = 0;

  function frame(now) {
    const { steps, accumulator } = drain(acc, now - last);
    acc = accumulator;
    last = now;

    canvas.style.cursor = (battle.phase === 'select' || battle.phase === 'gameover')
      ? 'pointer' : 'default';

    for (let i = 0; i < steps; i += 1) {
      const input = readInput();
      const pressed = readPressed();
      stepBattle(state, battle, input, pressed);
      stepFrame(state, input);
      if ((state.grazefx || 0) > 0) state.grazefx -= 1;
      for (const c of state.cues) play(c);
      state.cues.length = 0;
    }

    render(canvas, state, battle);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
