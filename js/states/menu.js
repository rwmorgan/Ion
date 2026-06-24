// ===== ION — main menu + setup screens =====
var STATES = STATES || {};

STATES.menu = (() => {
  let mode = 'main';      // 'main' | 'skirmish' | 'conquest'
  let stars = [];
  let t = 0;

  function enter() {
    mode = 'main';
    Audio2.startMusic('strategy');
    if (stars.length === 0) {
      for (let i = 0; i < 140; i++)
        stars.push({ x: rand(0, ION.W), y: rand(0, ION.H), z: rand(0.3, 1.4), s: rand(0.5, 1.8) });
    }
  }

  function drawBackground(ctx) {
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, ION.W, ION.H);
    for (const s of stars) {
      s.x -= s.z * 0.25; if (s.x < 0) s.x = ION.W;
      ctx.globalAlpha = 0.3 + s.z * 0.4;
      ctx.fillStyle = '#9fd0ff';
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  function title(ctx) {
    const cx = ION.W / 2;
    ctx.save();
    ctx.shadowColor = COL.accent; ctx.shadowBlur = 30;
    drawText(ctx, 'I O N', cx, 150, { size: 96, align: 'center', weight: '800', color: '#eaf4ff', font: "'Segoe UI', sans-serif" });
    ctx.restore();
    drawText(ctx, 'SPACE  SKIRMISH  &  STRATEGY', cx, 200, { size: 18, align: 'center', color: COL.accent, weight: '600' });
  }

  function update(ctx, m) {
    t += 1 / 60;
    drawBackground(ctx);
    title(ctx);
    const cx = ION.W / 2;

    if (mode === 'main') {
      const bw = 320, bh = 58, bx = cx - bw / 2;
      let y = 280;
      if (button(ctx, m, { x: bx, y, w: bw, h: bh }, 'CONQUEST', { size: 24 })) { Audio2.play('click'); mode = 'conquest'; }
      y += 74;
      if (button(ctx, m, { x: bx, y, w: bw, h: bh }, 'SKIRMISH', { size: 24 })) { Audio2.play('click'); mode = 'skirmish'; }
      y += 74;
      if (button(ctx, m, { x: bx, y, w: bw, h: bh }, 'SHIP EDITOR', { size: 24 })) { Audio2.play('click'); Game.setState('editor'); }
      y += 74;
      if (button(ctx, m, { x: bx, y, w: bw, h: bh }, 'HOW TO PLAY', { size: 24 })) { Audio2.play('click'); Game.setState('help'); }

      // Footer
      drawText(ctx, 'Move: WASD / Arrows   Fire: F   Special: G', cx, ION.H - 60, { size: 14, align: 'center', color: COL.dim });
      if (button(ctx, m, { x: ION.W - 150, y: ION.H - 50, w: 130, h: 34 },
        Audio2.enabled ? 'SOUND: ON' : 'SOUND: OFF', { size: 13 })) { Audio2.toggle(); Audio2.play('click'); }
      drawText(ctx, `${Game.designs.length} saved design${Game.designs.length === 1 ? '' : 's'}`, 24, ION.H - 30, { size: 13, color: COL.dim });
    }
    else if (mode === 'skirmish') setupScreen(ctx, m, 'skirmish');
    else if (mode === 'conquest') setupScreen(ctx, m, 'conquest');
  }

  // Shared setup screen for both modes.
  function setupScreen(ctx, m, kind) {
    const cx = ION.W / 2;
    const S = Game.settings;
    drawText(ctx, kind === 'skirmish' ? 'SKIRMISH SETUP' : 'CONQUEST SETUP', cx, 260, { size: 30, align: 'center', weight: '700' });

    // Opponents selector
    drawText(ctx, 'AI Opponents', cx - 200, 326, { size: 18, color: COL.text });
    for (let i = 1; i <= 3; i++) {
      const r = { x: cx + 20 + (i - 1) * 60, y: 308, w: 50, h: 32 };
      const sel = S.aiCount === i;
      if (button(ctx, m, r, '' + i, { size: 18, fill: sel ? COL.accent : COL.panel, accent: sel ? '#05060d' : COL.accent })) {
        S.aiCount = i; Audio2.play('click');
      }
      if (sel) drawText(ctx, '' + i, r.x + r.w / 2, r.y + r.h / 2, { size: 18, align: 'center', baseline: 'middle', color: '#05060d', weight: '700' });
    }

    // Your ship design selector
    drawText(ctx, 'Your Flagship', cx - 200, 386, { size: 18, color: COL.text });
    const designs = Game.allSelectableDesigns();
    const dname = designs[S.designIndex % designs.length].name;
    if (button(ctx, m, { x: cx + 20, y: 368, w: 40, h: 32 }, '<', { size: 18 })) { S.designIndex = (S.designIndex + designs.length - 1) % designs.length; Audio2.play('click'); }
    drawText(ctx, dname, cx + 145, 386, { size: 18, align: 'center', color: COL.accent, weight: '600' });
    if (button(ctx, m, { x: cx + 230, y: 368, w: 40, h: 32 }, '>', { size: 18 })) { S.designIndex = (S.designIndex + 1) % designs.length; Audio2.play('click'); }

    // Difficulty selector
    drawText(ctx, 'Difficulty', cx - 200, 446, { size: 18, color: COL.text });
    for (let i = 0; i < Data.DIFFICULTY.length; i++) {
      const r = { x: cx + 20 + i * 90, y: 428, w: 80, h: 32 };
      const sel = S.difficulty === i;
      const col = i === 0 ? COL.good : i === 2 ? COL.accent2 : COL.warn;
      if (button(ctx, m, r, Data.DIFFICULTY[i].name, { size: 15, fill: sel ? col : COL.panel, accent: sel ? '#05060d' : col, border: sel ? col : '#2a3550' })) { S.difficulty = i; Audio2.play('click'); }
      if (sel) drawText(ctx, Data.DIFFICULTY[i].name, r.x + r.w / 2, r.y + r.h / 2, { size: 15, align: 'center', baseline: 'middle', color: '#05060d', weight: '700' });
    }

    if (kind === 'skirmish') {
      drawText(ctx, 'Each fleet has 3 ships — last fleet flying wins.', cx, 512, { size: 15, align: 'center', color: COL.dim });
    } else {
      drawText(ctx, 'Map size', cx - 200, 506, { size: 18, color: COL.text });
      const sizes = ['Small', 'Medium', 'Large'];
      for (let i = 0; i < 3; i++) {
        const r = { x: cx + 20 + i * 90, y: 488, w: 80, h: 32 };
        const sel = S.mapSize === i;
        if (button(ctx, m, r, sizes[i], { size: 15, fill: sel ? COL.accent : COL.panel, accent: sel ? '#05060d' : COL.accent })) { S.mapSize = i; Audio2.play('click'); }
        if (sel) drawText(ctx, sizes[i], r.x + r.w / 2, r.y + r.h / 2, { size: 15, align: 'center', baseline: 'middle', color: '#05060d', weight: '700' });
      }
    }

    // Start / Back
    if (button(ctx, m, { x: cx - 170, y: 560, w: 150, h: 50 }, 'BACK', { size: 20 })) { mode = 'main'; Audio2.play('click'); }
    if (button(ctx, m, { x: cx + 20, y: 560, w: 150, h: 50 }, 'LAUNCH', { size: 20, fill: COL.accent, accent: '#05060d', border: COL.accent })) {
      Audio2.play('deploy');
      const design = designs[S.designIndex % designs.length];
      if (kind === 'skirmish') Game.launchSkirmishMatch(design, S.aiCount, S.difficulty);
      else Game.launchConquest(design, S.aiCount, S.mapSize, S.difficulty);
    }
  }

  return { enter, update };
})();
