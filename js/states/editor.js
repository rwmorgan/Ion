// ===== ION — ship editor (drag & drop loadout) =====
var STATES = STATES || {};

STATES.editor = (() => {
  let cur = null;          // { hull, comps:[] }
  let drag = null;         // { id, from } while dragging
  let nameBuf = '';
  let editingName = false;
  const hullIds = ['scout', 'fighter', 'gunship', 'cruiser', 'dreadnought'];

  function enter() {
    Audio2.startMusic('strategy');
    cur = { hull: 'fighter', comps: new Array(Data.HULLS.fighter.slots).fill(null) };
    nameBuf = 'My Ship';
    drag = null; editingName = false;
  }

  function setHull(id) {
    const slots = Data.HULLS[id].slots;
    const old = cur.comps;
    cur = { hull: id, comps: new Array(slots).fill(null) };
    for (let i = 0; i < Math.min(slots, old.length); i++) cur.comps[i] = old[i];
    Audio2.play('click');
  }

  // ---- Layout regions ----
  const PAL = { x: 24, y: 140, w: 252, h: 470 };
  const SHIP = { cx: 648, cy: 248 };
  const STAT = { x: 1000, y: 140, w: 256, h: 372 };

  // Slot rectangles arranged in a grid below the ship preview.
  function slotRects() {
    const n = cur.comps.length;
    const cols = Math.min(5, n);
    const sw = 84, sh = 58, gap = 10;
    const totalW = cols * sw + (cols - 1) * gap;
    const x0 = SHIP.cx - totalW / 2, y0 = 410;
    const rects = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      rects.push({ x: x0 + c * (sw + gap), y: y0 + r * (sh + gap), w: sw, h: sh, idx: i });
    }
    return rects;
  }

  // Palette item rectangles (two columns per group).
  function paletteRects() {
    const rects = [];
    const cw = (PAL.w - 16 - 8) / 2, ch = 36, gx = 8, gy = 6;
    let y = PAL.y + 4;
    for (const grp of Data.PALETTE) {
      rects.push({ header: grp.group, y });
      y += 24;
      for (let i = 0; i < grp.items.length; i++) {
        const col = i % 2, row = Math.floor(i / 2);
        rects.push({ id: grp.items[i], x: PAL.x + 8 + col * (cw + gx), y: y + row * (ch + gy), w: cw, h: ch });
      }
      y += Math.ceil(grp.items.length / 2) * (ch + gy) + 10;
    }
    return rects;
  }

  let wasDown = false;

  function update(ctx, m) {
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, ION.W, ION.H);
    drawText(ctx, 'SHIP EDITOR', 24, 56, { size: 30, weight: '700' });
    drawText(ctx, 'Drag components into slots · click a slot to remove', 250, 56, { size: 14, color: COL.dim });

    const pal = paletteRects();
    const slots = slotRects();

    // ---- Start a drag ----
    if (m.downThisFrame && !drag) {
      for (const p of pal) if (p.id && inRect(m.x, m.y, p)) { drag = { id: p.id, from: -1 }; Audio2.play('click'); break; }
      if (!drag) for (const s of slots) if (cur.comps[s.idx] && inRect(m.x, m.y, s)) { drag = { id: cur.comps[s.idx], from: s.idx }; cur.comps[s.idx] = null; break; }
    }

    // ---- Resolve a drop ----
    if (wasDown && !m.down && drag) {
      let placed = false;
      for (const s of slots) {
        if (inRect(m.x, m.y, s)) {
          const existing = cur.comps[s.idx];
          cur.comps[s.idx] = drag.id;
          if (drag.from >= 0 && existing) cur.comps[drag.from] = existing;
          placed = true; Audio2.play('place'); break;
        }
      }
      if (!placed && drag.from >= 0) Audio2.play('deny');
      drag = null;
    }
    wasDown = m.down;

    drawHullPicker(ctx, m);
    drawPalette(ctx, pal, m);
    drawShip(ctx);
    drawSlots(ctx, slots, m);
    drawStats(ctx, m);
    drawSaveRow(ctx, m);
    drawSavedStrip(ctx, m);

    if (drag) drawComponentChip(ctx, drag.id, m.x - 56, m.y - 18, 112, 36, true);

    if (button(ctx, m, { x: 24, y: ION.H - 50, w: 124, h: 36 }, '← MENU', { size: 15 })) Game.setState('menu');
  }

  function drawPalette(ctx, pal, m) {
    roundRect(ctx, PAL.x, PAL.y, PAL.w, PAL.h, 10); ctx.fillStyle = COL.panel; ctx.fill();
    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 1; ctx.stroke();
    for (const p of pal) {
      if (p.header) { drawText(ctx, p.header.toUpperCase(), PAL.x + 12, p.y + 16, { size: 12, color: COL.dim, weight: '700' }); continue; }
      drawComponentChip(ctx, p.id, p.x, p.y, p.w, p.h, inRect(m.x, m.y, p));
    }
  }

  function drawComponentChip(ctx, id, x, y, w, h, hi) {
    const c = Data.COMPONENTS[id];
    roundRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = hi ? COL.panelLight : '#10182a'; ctx.fill();
    ctx.strokeStyle = c.color; ctx.lineWidth = hi ? 2 : 1.1; ctx.stroke();
    ctx.fillStyle = c.color; roundRect(ctx, x + 6, y + h / 2 - 7, 14, 14, 3); ctx.fill();
    drawText(ctx, c.name, x + 26, y + h / 2 - 4, { size: 12, baseline: 'middle', color: COL.text, weight: '600' });
    const tag = c.type === 'weapon' ? `${c.dmg * (c.pellets || 1)}dmg` : c.type === 'armour' ? `+${c.hp}hp`
      : c.type === 'shield' ? `+${c.shield}sh` : c.type === 'engine' ? 'speed' : 'active';
    drawText(ctx, tag, x + 26, y + h / 2 + 9, { size: 10, baseline: 'middle', color: COL.dim });
  }

  function drawShip(ctx) {
    const hull = Data.HULLS[cur.hull];
    ctx.save();
    ctx.translate(SHIP.cx, SHIP.cy);
    ctx.fillStyle = 'rgba(79,195,255,0.05)';
    ctx.beginPath(); ctx.ellipse(0, 40, 190, 60, 0, 0, TAU); ctx.fill();
    const spr = Sprites.ship(cur.hull, 0);
    if (spr) {
      ctx.rotate(-Math.PI / 2);
      const sc = 150 / Math.max(spr.w, spr.h);
      ctx.scale(sc, sc);
      ctx.drawImage(spr.canvas, -spr.ax, -spr.ay, spr.w, spr.h);
    }
    ctx.restore();
    drawText(ctx, hull.name.toUpperCase(), SHIP.cx, 348, { size: 20, align: 'center', weight: '700', color: COL.accent });
    drawText(ctx, `${hull.slots} slots`, SHIP.cx, 370, { size: 13, align: 'center', color: COL.dim });
  }

  function drawSlots(ctx, slots, m) {
    for (const s of slots) {
      const id = cur.comps[s.idx];
      const hover = inRect(m.x, m.y, s);
      roundRect(ctx, s.x, s.y, s.w, s.h, 8);
      ctx.fillStyle = id ? '#10182a' : 'rgba(255,255,255,0.02)'; ctx.fill();
      ctx.setLineDash(id ? [] : [5, 4]);
      ctx.strokeStyle = id ? Data.COMPONENTS[id].color : (hover ? COL.accent : '#39406a');
      ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
      if (id) {
        const c = Data.COMPONENTS[id];
        ctx.fillStyle = c.color; roundRect(ctx, s.x + s.w / 2 - 9, s.y + 9, 18, 18, 5); ctx.fill();
        drawText(ctx, c.name, s.x + s.w / 2, s.y + s.h - 12, { size: 11, align: 'center', color: COL.text, weight: '600' });
      } else {
        drawText(ctx, 'empty', s.x + s.w / 2, s.y + s.h / 2, { size: 12, align: 'center', baseline: 'middle', color: COL.dim });
      }
    }
  }

  function drawStats(ctx, m) {
    const st = Data.computeStats(cur.hull, cur.comps);
    roundRect(ctx, STAT.x, STAT.y, STAT.w, STAT.h, 10); ctx.fillStyle = COL.panel; ctx.fill();
    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 1; ctx.stroke();
    drawText(ctx, 'STATS', STAT.x + 16, STAT.y + 26, { size: 16, weight: '700', color: COL.accent });
    let dps = 0; for (const w of st.weapons) dps += (w.dmg * (w.pellets || 1)) / w.rof;
    const rows = [
      ['Hull', Data.HULLS[cur.hull].name],
      ['Health', Math.round(st.hp)],
      ['Shield', Math.round(st.shield) + (st.shield ? ` (+${st.regen}/s)` : '')],
      ['Top speed', Math.round(st.maxSpeed)],
      ['Turn rate', st.turn.toFixed(1)],
      ['Weapons', st.weapons.length ? st.weapons.length + ' fitted' : 'none'],
      ['Specials', st.specials.length ? st.specials.map(w => w.name).join(', ') : 'none'],
      ['Mass', st.mass.toFixed(1)],
      ['Est. DPS', Math.round(dps)],
      ['Build cost', Data.buildCost(cur.hull, cur.comps)],
    ];
    let y = STAT.y + 56;
    for (const [k, v] of rows) {
      const good = k === 'Est. DPS';
      drawText(ctx, k, STAT.x + 16, y, { size: 13, color: COL.dim });
      drawText(ctx, '' + v, STAT.x + STAT.w - 16, y, { size: 13, align: 'right', color: good ? COL.good : COL.text, weight: good ? '700' : '600' });
      y += 30;
    }
  }

  function drawHullPicker(ctx, m) {
    drawText(ctx, 'HULL', PAL.x, 84, { size: 13, color: COL.dim, weight: '700' });
    const bw = 116, x0 = PAL.x + 56;
    for (let i = 0; i < hullIds.length; i++) {
      const id = hullIds[i];
      const r = { x: x0 + i * (bw + 8), y: 70, w: bw, h: 38 };
      const sel = cur.hull === id;
      if (button(ctx, m, r, Data.HULLS[id].name, { size: 14, fill: sel ? COL.accent : COL.panel, accent: sel ? '#05060d' : COL.accent })) setHull(id);
      if (sel) drawText(ctx, Data.HULLS[id].name, r.x + r.w / 2, r.y + r.h / 2, { size: 14, align: 'center', baseline: 'middle', color: '#05060d', weight: '700' });
    }
  }

  function drawSaveRow(ctx, m) {
    const y = STAT.y + STAT.h + 18;
    const fr = { x: STAT.x, y, w: STAT.w, h: 36 };
    roundRect(ctx, fr.x, fr.y, fr.w, fr.h, 7);
    ctx.fillStyle = editingName ? COL.panelLight : COL.panel; ctx.fill();
    ctx.strokeStyle = editingName ? COL.accent : '#2a3550'; ctx.lineWidth = 1.4; ctx.stroke();
    drawText(ctx, nameBuf + (editingName && Math.floor(Date.now() / 400) % 2 ? '|' : ''), fr.x + 10, fr.y + fr.h / 2, { size: 15, baseline: 'middle' });
    if (m.clicked) editingName = inRect(m.x, m.y, fr);

    if (button(ctx, m, { x: STAT.x, y: y + 46, w: STAT.w, h: 44 }, 'SAVE DESIGN', { size: 16, fill: COL.good, accent: '#05060d', border: COL.good })) {
      Game.saveDesign({ name: nameBuf || 'Ship', hull: cur.hull, comps: cur.comps.slice() });
      Audio2.play('place');
    }
  }

  // Saved designs as a horizontal strip along the bottom (load on click, ✕ to delete).
  function drawSavedStrip(ctx, m) {
    const y = 632, h = 56, x0 = 168;
    drawText(ctx, 'SAVED', x0, y - 6, { size: 11, color: COL.dim, weight: '700' });
    const ds = Game.designs;
    if (!ds.length) { drawText(ctx, 'No saved designs yet — build one and hit SAVE DESIGN.', x0, y + 30, { size: 13, color: COL.dim }); return; }
    const cw = 150, gap = 10;
    for (let i = 0; i < ds.length; i++) {
      const x = x0 + i * (cw + gap);
      if (x + cw > ION.W - 10) break; // clip overflow
      const d = ds[i];
      const hover = inRect(m.x, m.y, { x, y: y + 6, w: cw, h });
      roundRect(ctx, x, y + 6, cw, h, 8); ctx.fillStyle = hover ? COL.panelLight : COL.panel; ctx.fill();
      ctx.strokeStyle = hover ? COL.accent : '#2a3550'; ctx.lineWidth = 1.2; ctx.stroke();
      drawText(ctx, d.name, x + 12, y + 26, { size: 14, weight: '600' });
      drawText(ctx, `${Data.HULLS[d.hull].name} · ${Data.buildCost(d.hull, d.comps)}c`, x + 12, y + 46, { size: 11, color: COL.dim });
      // delete button
      const del = { x: x + cw - 26, y: y + 12, w: 18, h: 18 };
      if (button(ctx, m, del, '✕', { size: 12, radius: 4, fill: COL.panel, accent: COL.accent2 })) { Game.deleteDesign(d.name); Audio2.play('deny'); return; }
      // load on body click (avoid the delete hotspot)
      if (m.clicked && hover && !inRect(m.x, m.y, del)) {
        cur = { hull: d.hull, comps: d.comps.slice() };
        nameBuf = d.name; Audio2.play('click');
      }
    }
  }

  function onKey(e) {
    if (!editingName) return;
    if (e.key === 'Backspace') nameBuf = nameBuf.slice(0, -1);
    else if (e.key === 'Enter') editingName = false;
    else if (e.key.length === 1 && nameBuf.length < 16) nameBuf += e.key;
  }

  return { enter, update, onKey };
})();
