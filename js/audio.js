// ===== ION — procedural audio (WebAudio, no asset files) =====
// Layered synthesis: each SFX combines oscillators, noise and filter sweeps with
// shaped envelopes for a "designed" feel. Two generative music beds.
const Audio2 = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null, comp = null;
  let enabled = true, musicTimer = null;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0.65;
    comp.connect(master); master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.75; sfxGain.connect(comp);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.20; musicGain.connect(comp);
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function now() { return ctx.currentTime; }

  // ---- Building blocks ----
  // Oscillator with optional frequency glide and ADSR-ish gain envelope.
  function osc({ f, f2, type = 'sine', t0 = 0, dur = 0.2, vol = 0.3, atk = 0.005, dest = sfxGain }) {
    if (!ctx || !enabled) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const s = now() + t0;
    o.type = type;
    o.frequency.setValueAtTime(f, s);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), s + dur);
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(vol, s + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
    o.connect(g); g.connect(dest);
    o.start(s); o.stop(s + dur + 0.02);
  }

  // Filtered noise burst.
  function noise({ t0 = 0, dur = 0.2, vol = 0.3, type = 'lowpass', f = 1200, f2 = null, q = 1, dest = sfxGain }) {
    if (!ctx || !enabled) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    const s = now() + t0;
    flt.frequency.setValueAtTime(f, s);
    if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f2), s + dur);
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(flt); flt.connect(g); g.connect(dest);
    src.start(s);
  }

  // ---- Named SFX ----
  const sfx = {
    laser:    () => { osc({ f: 900, f2: 320, type: 'square', dur: 0.12, vol: 0.16 }); osc({ f: 1800, f2: 600, type: 'sine', dur: 0.08, vol: 0.06 }); },
    beam:     () => { osc({ f: 1400, f2: 900, type: 'sawtooth', dur: 0.08, vol: 0.10 }); osc({ f: 2600, f2: 1600, type: 'sine', dur: 0.05, vol: 0.05 }); },
    cannon:   () => { osc({ f: 200, f2: 60, type: 'sawtooth', dur: 0.2, vol: 0.26 }); noise({ dur: 0.12, vol: 0.2, f: 900, f2: 200 }); },
    railgun:  () => { osc({ f: 1200, f2: 140, type: 'sawtooth', dur: 0.28, vol: 0.22 }); osc({ f: 80, f2: 40, type: 'sine', dur: 0.3, vol: 0.18 }); noise({ dur: 0.2, vol: 0.12, type: 'bandpass', f: 2400, f2: 400, q: 3 }); },
    plasma:   () => { osc({ f: 620, f2: 240, type: 'triangle', dur: 0.16, vol: 0.18 }); noise({ dur: 0.1, vol: 0.08, f: 1600, f2: 600 }); },
    flak:     () => { noise({ dur: 0.14, vol: 0.22, f: 1800, f2: 300, q: 0.7 }); osc({ f: 260, f2: 90, type: 'square', dur: 0.1, vol: 0.1 }); },
    missile:  () => { osc({ f: 420, f2: 760, type: 'sawtooth', dur: 0.3, vol: 0.12 }); noise({ dur: 0.3, vol: 0.06, f: 600, f2: 1400 }); },
    torpedo:  () => { osc({ f: 180, f2: 320, type: 'sawtooth', dur: 0.4, vol: 0.14 }); noise({ dur: 0.4, vol: 0.08, f: 400, f2: 900 }); },
    explosion:() => { noise({ dur: 0.6, vol: 0.5, f: 800, f2: 80, q: 0.6 }); osc({ f: 120, f2: 35, type: 'sawtooth', dur: 0.5, vol: 0.3 }); osc({ f: 60, f2: 28, type: 'sine', dur: 0.6, vol: 0.22 }); },
    hit:      () => osc({ f: 320, f2: 160, type: 'square', dur: 0.06, vol: 0.1 }),
    shieldHit:() => { osc({ f: 760, f2: 380, type: 'sine', dur: 0.12, vol: 0.12 }); osc({ f: 1500, f2: 900, type: 'sine', dur: 0.08, vol: 0.05 }); },
    click:    () => osc({ f: 680, f2: 760, type: 'square', dur: 0.05, vol: 0.1 }),
    place:    () => { osc({ f: 520, f2: 780, type: 'triangle', dur: 0.09, vol: 0.14 }); osc({ f: 1040, type: 'sine', dur: 0.06, vol: 0.06 }); },
    deny:     () => osc({ f: 180, f2: 110, type: 'square', dur: 0.16, vol: 0.14 }),
    special:  () => { osc({ f: 300, f2: 900, type: 'sine', dur: 0.25, vol: 0.16 }); osc({ f: 600, f2: 1800, type: 'triangle', dur: 0.2, vol: 0.08 }); },
    deploy:   () => { osc({ f: 440, type: 'triangle', dur: 0.1, vol: 0.14 }); osc({ f: 660, t0: 0.05, type: 'triangle', dur: 0.12, vol: 0.1 }); },
    win:      () => [523, 659, 784, 1046].forEach((f, i) => osc({ f, t0: i * 0.13, type: 'triangle', dur: 0.32, vol: 0.2 })),
    lose:     () => [392, 330, 262, 196].forEach((f, i) => osc({ f, t0: i * 0.15, type: 'sawtooth', dur: 0.36, vol: 0.18 })),
  };
  function play(name) { if (sfx[name]) sfx[name](); }

  // ---- Generative music ----
  const scales = {
    strategy: [220, 261.6, 293.7, 349.2, 392, 440, 523.3],
    skirmish: [196, 233, 261.6, 311, 349, 415, 466],
  };
  let curMood = null;
  function startMusic(mood) {
    init();
    if (curMood === mood && musicTimer) return;
    stopMusic();
    curMood = mood;
    const scale = scales[mood] || scales.strategy;
    const step = mood === 'skirmish' ? 250 : 520;
    let beat = 0;
    musicTimer = setInterval(() => {
      if (!enabled || !ctx) return;
      const root = scale[0] / 2;
      // Bass pulse on the downbeat.
      if (beat % 2 === 0) osc({ f: root, type: 'triangle', dur: step / 1000 * 1.6, vol: 0.12, dest: musicGain });
      // Pad chord every 4 beats.
      if (beat % 4 === 0) { [0, 2, 4].forEach(i => osc({ f: scale[i], type: 'sine', dur: step / 1000 * 3.6, vol: 0.05, dest: musicGain })); }
      // Melody.
      if (Math.random() < (mood === 'skirmish' ? 0.8 : 0.5)) {
        const n = pick(scale);
        osc({ f: n, type: 'sine', dur: step / 1000 * 1.4, vol: 0.08, dest: musicGain });
      }
      // Percussion for the skirmish bed.
      if (mood === 'skirmish') {
        noise({ dur: 0.05, vol: 0.06, f: 6000, type: 'highpass', dest: musicGain }); // hat
        if (beat % 4 === 0) noise({ dur: 0.14, vol: 0.14, f: 200, f2: 60, dest: musicGain }); // kick-ish
      }
      beat++;
    }, step);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } curMood = null; }
  // The `enabled` flag gates every voice, so the music loop can keep ticking
  // silently and resume instantly when re-enabled.
  function toggle() { enabled = !enabled; return enabled; }

  return { init, resume, play, startMusic, stopMusic, toggle, get enabled() { return enabled; } };
})();
