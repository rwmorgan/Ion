// ===== ION — help / instructions =====
var STATES = STATES || {};

STATES.help = (() => {
  let tab = 0; // 0 = How to Play, 1 = Arsenal
  let stars = [];

  function enter() {
    Audio2.startMusic('strategy');
    if (!stars.length) for (let i = 0; i < 90; i++) stars.push({ x: rand(0, ION.W), y: rand(0, ION.H), s: rand(0.5, 1.6) });
  }

  function bg(ctx) {
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, ION.W, ION.H);
    for (const s of stars) { ctx.fillStyle = 'rgba(150,190,255,0.4)'; ctx.fillRect(s.x, s.y, s.s, s.s); }
  }

  function update(ctx, m) {
    bg(ctx);
    drawText(ctx, 'HOW TO PLAY', ION.W / 2, 64, { size: 38, align: 'center', weight: '800', color: COL.accent, shadow: COL.accent });

    // Tabs
    const tabs = ['How to Play', 'Arsenal'];
    for (let i = 0; i < tabs.length; i++) {
      const r = { x: ION.W / 2 - 210 + i * 210, y: 96, w: 200, h: 40 };
      const sel = tab === i;
      if (button(ctx, m, r, tabs[i], { size: 16, fill: sel ? COL.accent : COL.panel, accent: sel ? '#05060d' : COL.accent })) { tab = i; Audio2.play('click'); }
      if (sel) drawText(ctx, tabs[i], r.x + r.w / 2, r.y + r.h / 2, { size: 16, align: 'center', baseline: 'middle', color: '#05060d', weight: '700' });
    }

    if (tab === 0) howTo(ctx);
    else arsenal(ctx);

    if (button(ctx, m, { x: ION.W / 2 - 90, y: ION.H - 60, w: 180, h: 44 }, '← BACK', { size: 18 })) { Audio2.play('click'); Game.setState('menu'); }
  }

  function panel(ctx, x, y, w, h, title) {
    roundRect(ctx, x, y, w, h, 10); ctx.fillStyle = COL.panel; ctx.fill();
    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 1; ctx.stroke();
    drawText(ctx, title, x + 18, y + 26, { size: 16, weight: '700', color: COL.accent });
  }

  function lines(ctx, x, y, arr, gap = 22, opts = {}) {
    for (const l of arr) { drawText(ctx, l, x, y, { size: opts.size || 14, color: opts.color || COL.text }); y += gap; }
    return y;
  }

  function howTo(ctx) {
    const colW = 540, gap = 30, x0 = ION.W / 2 - colW - gap / 2, x1 = ION.W / 2 + gap / 2, top = 160, h = 460;

    panel(ctx, x0, top, colW, 150, 'CONTROLS');
    lines(ctx, x0 + 18, top + 56, [
      'Thrust / reverse —  W / S   (or ↑ / ↓)',
      'Turn left / right —  A / D   (or ← / →)',
      'Fire weapons —  F          Special power —  G',
      'Pause —  Esc or P          Menus —  Mouse',
    ], 24, { color: COL.text });

    panel(ctx, x0, top + 170, colW, h - 170, 'SHIP EDITOR');
    lines(ctx, x0 + 18, top + 226, [
      'Pick a hull, then drag components from the',
      'palette into its slots. Click a slot to remove.',
      '',
      'Bigger hulls have more slots but turn slower —',
      'every component adds mass, so balance firepower',
      'and armour against speed and handling.',
      '',
      'Name your ship and SAVE it; saved designs are',
      'stored on this device and can be flown as your',
      'flagship in Skirmish and Conquest.',
    ], 22, { color: COL.text });

    panel(ctx, x1, top, colW, 210, 'SKIRMISH');
    lines(ctx, x1 + 18, top + 56, [
      'Fast, real-time arena combat. Pick your flagship',
      'and 1–3 AI opponents. Each fleet has 3 ships —',
      'when one is destroyed the next launches.',
      '',
      'Last fleet flying wins. Watch the hazards:',
      'asteroids bump and chip you, the planet pulls',
      'you in with gravity, and the nebula slows you.',
    ], 22, { color: COL.text });

    panel(ctx, x1, top + 230, colW, h - 230, 'CONQUEST');
    lines(ctx, x1 + 18, top + 286, [
      'Turn-based galaxy war. Each owned planet gives',
      'resources per turn — spend them to BUILD ships.',
      '',
      'Select a planet you own, then click a linked',
      'planet to move (Shift = send all). Attacking a',
      'defended planet drops you into a live skirmish.',
      '',
      'Capture every planet to win the sector.',
    ], 22, { color: COL.text });
  }

  function arsenal(ctx) {
    const top = 160;
    // Weapons table
    panel(ctx, 60, top, 720, 470, 'WEAPONS');
    const ws = ['laser', 'beam', 'cannon', 'railgun', 'plasma', 'flak', 'missile', 'torpedo'];
    let y = top + 52;
    drawText(ctx, 'NAME', 80, y, { size: 12, color: COL.dim, weight: '700' });
    drawText(ctx, 'DMG', 300, y, { size: 12, color: COL.dim, weight: '700', align: 'right' });
    drawText(ctx, 'RATE', 380, y, { size: 12, color: COL.dim, weight: '700', align: 'right' });
    drawText(ctx, 'NOTES', 420, y, { size: 12, color: COL.dim, weight: '700' });
    y += 10;
    for (const id of ws) {
      const c = Data.COMPONENTS[id]; y += 28;
      ctx.fillStyle = c.color; roundRect(ctx, 80, y - 12, 12, 12, 3); ctx.fill();
      drawText(ctx, c.name, 100, y, { size: 14, weight: '600' });
      drawText(ctx, '' + (c.dmg * (c.pellets || 1)), 300, y, { size: 14, align: 'right', color: COL.text });
      drawText(ctx, c.rof.toFixed(2) + 's', 384, y, { size: 13, align: 'right', color: COL.dim });
      const note = c.homing ? (c.splash ? 'homing + area blast' : 'homing') : c.pellets ? `${c.pellets}-pellet spread` : c.proj === 'rail' ? 'hyper-velocity' : c.proj === 'beam' ? 'rapid pulses' : 'direct fire';
      drawText(ctx, note, 420, y, { size: 13, color: COL.dim });
    }

    // Specials + defense
    panel(ctx, 800, top, 420, 470, 'SPECIALS & DEFENSE');
    const sp = [
      ['Afterburn', 'Speed + thrust burst'],
      ['Overdrive', 'Doubles fire rate (4s)'],
      ['Cloak', 'Near-invisible (3s)'],
      ['Blink', 'Teleport forward'],
      ['Repair', 'Restore +50 hull'],
      ['EMP Burst', 'Stun + strip nearby shields'],
      ['—', ''],
      ['Armour', '+45 hull health'],
      ['Shield', '+40 regenerating shield'],
      ['Engine', 'More speed, thrust & turn'],
    ];
    y = top + 60;
    for (const [n, d] of sp) {
      if (n === '—') { ctx.strokeStyle = '#2a3550'; ctx.beginPath(); ctx.moveTo(818, y - 6); ctx.lineTo(1200, y - 6); ctx.stroke(); y += 14; continue; }
      drawText(ctx, n, 820, y, { size: 14, weight: '600', color: COL.accent });
      drawText(ctx, d, 940, y, { size: 13, color: COL.text });
      y += 40;
    }
  }

  return { enter, update };
})();
