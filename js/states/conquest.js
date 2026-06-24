// ===== ION — conquest (turn-based strategy) =====
// Operates on Game.C so state survives switching to skirmish for live battles.
var STATES = STATES || {};

STATES.conquest = (() => {

  const PANEL = { x: ION.W - 300, y: 0, w: 300, h: ION.H };
  const MAPW = ION.W - 300;

  // ---- Map generation ----
  function generateMap(size, numPlayers) {
    const count = size === 0 ? 7 : size === 1 ? 11 : 15;
    const planets = [];
    const margin = 90;
    let tries = 0;
    while (planets.length < count && tries < 4000) {
      tries++;
      const x = rand(margin, MAPW - margin), y = rand(margin, ION.H - margin);
      if (planets.every(p => dist(p.x, p.y, x, y) > 150)) {
        planets.push({ x, y, owner: -1, ships: randInt(1, 3), value: randInt(1, 3),
          r: rand(20, 30), links: [] });
      }
    }
    // Connect each planet to its 2-3 nearest neighbours.
    for (let i = 0; i < planets.length; i++) {
      const order = planets.map((p, j) => ({ j, d: dist(planets[i].x, planets[i].y, p.x, p.y) }))
        .filter(o => o.j !== i).sort((a, b) => a.d - b.d);
      const n = randInt(2, 3);
      for (let k = 0; k < n && k < order.length; k++) link(planets, i, order[k].j);
    }
    // Ensure connectivity: link isolated components to nearest.
    ensureConnected(planets);

    // Assign starting planets to players (spread out).
    const corners = [
      { x: margin, y: margin }, { x: MAPW - margin, y: ION.H - margin },
      { x: MAPW - margin, y: margin }, { x: margin, y: ION.H - margin },
    ];
    for (let p = 0; p < numPlayers; p++) {
      let best = -1, bd = 1e9;
      for (let i = 0; i < planets.length; i++) {
        if (planets[i].owner >= 0) continue;
        const d = dist(planets[i].x, planets[i].y, corners[p].x, corners[p].y);
        if (d < bd) { bd = d; best = i; }
      }
      planets[best].owner = p; planets[best].ships = 3; planets[best].value = 3;
    }
    return planets;
  }

  function link(planets, a, b) {
    if (a === b) return;
    if (!planets[a].links.includes(b)) planets[a].links.push(b);
    if (!planets[b].links.includes(a)) planets[b].links.push(a);
  }

  function ensureConnected(planets) {
    const seen = new Set();
    const stack = [0]; seen.add(0);
    while (stack.length) { const c = stack.pop(); for (const n of planets[c].links) if (!seen.has(n)) { seen.add(n); stack.push(n); } }
    // Any unseen planet: connect to nearest seen one.
    for (let i = 0; i < planets.length; i++) {
      if (seen.has(i)) continue;
      let best = -1, bd = 1e9;
      for (const j of seen) { const d = dist(planets[i].x, planets[i].y, planets[j].x, planets[j].y); if (d < bd) { bd = d; best = j; } }
      if (best >= 0) { link(planets, i, best); seen.add(i); }
    }
  }

  // ---- Setup (called by Game.launchConquest) ----
  function init(humanDesign, aiCount, mapSize, diffLevel = 1) {
    const numPlayers = 1 + aiCount;
    const planets = generateMap(mapSize, numPlayers);
    const D = Data.DIFFICULTY[diffLevel] || Data.DIFFICULTY[1];
    const players = [];
    for (let i = 0; i < numPlayers; i++) {
      players.push({
        faction: i, human: i === 0, resources: 5, eliminated: false,
        design: i === 0 ? humanDesign : Data.preset(pick(Data.PRESET_NAMES)),
        difficulty: D.conquestBase + i * D.conquestStep,
      });
    }
    return {
      planets, players, numPlayers, humanFaction: 0,
      turn: 1, phase: 'human', selected: -1, started: true,
      neutralDesign: Data.preset('interceptor'),
      message: 'Your move, Commander.',
      battleQueue: [], aiDesigns: players.filter(p => !p.human).map(p => p.design),
      over: false, result: '',
    };
  }

  // ---- Ship power for auto-resolve ----
  function shipPower(design) {
    const st = Data.computeStats(design.hull, design.comps);
    let dps = 0; for (const w of st.weapons) dps += (w.dmg * (w.pellets || 1)) / w.rof;
    const ehp = st.hp + st.shield;
    return Math.max(1, Math.sqrt(Math.max(1, ehp) * Math.max(1, dps)) / 12);
  }

  function designOf(C, faction) {
    if (faction === NEUTRAL || faction < 0) return C.neutralDesign;
    return C.players[faction].design;
  }

  // ---- Movement / combat ----
  // Returns true if a live skirmish was launched (caller must stop and wait).
  function applyMove(C, fromIdx, toIdx, count, then) {
    const src = C.planets[fromIdx], dst = C.planets[toIdx];
    const attacker = src.owner;
    src.ships -= count;
    // Synchronous outcomes return false WITHOUT calling `then` so the AI loop
    // continues naturally; only the live-skirmish branch uses the continuation.
    if (dst.owner === attacker) { dst.ships += count; return false; }
    if (dst.ships === 0) { dst.owner = attacker; dst.ships = count; Audio2.play('deploy'); return false; }

    const defender = dst.owner;                 // may be -1 (neutral)
    const defFaction = defender < 0 ? NEUTRAL : defender;
    const humanInvolved = attacker === C.humanFaction || defender === C.humanFaction;

    if (humanInvolved) {
      Game.startBattle({
        attacker, defender: defFaction, planetName: `PLANET ${toIdx + 1}`,
        atkDesign: designOf(C, attacker), defDesign: designOf(C, defFaction),
        atkCount: count, defCount: dst.ships, humanFaction: C.humanFaction,
        difficulty: C.players.find(p => p.faction === (attacker === C.humanFaction ? defender : attacker))?.difficulty ?? 0.3,
        onResolve: (winnerFaction, survivors) => {
          resolveBattle(C, fromIdx, toIdx, count, attacker, defender, winnerFaction, survivors);
          then && then();
        },
      });
      return true;
    } else {
      // Auto-resolve (shouldn't happen on human turn, but safe).
      const { winner, survivors } = autoResolve(C, attacker, defFaction, count, dst.ships);
      resolveBattle(C, fromIdx, toIdx, count, attacker, defender, winner, survivors);
      return false;
    }
  }

  function autoResolve(C, attacker, defFaction, atkCount, defCount) {
    const aP = atkCount * shipPower(designOf(C, attacker)) * rand(0.85, 1.2);
    const dP = defCount * shipPower(designOf(C, defFaction)) * 1.15 * rand(0.85, 1.2);
    if (aP >= dP) {
      const surv = clamp(Math.round(atkCount * (1 - defCount / (atkCount + defCount) * 0.9)), 1, atkCount);
      return { winner: attacker, survivors: surv };
    } else {
      const surv = clamp(Math.round(defCount * (1 - atkCount / (atkCount + defCount) * 0.9)), 1, defCount);
      return { winner: defFaction, survivors: surv };
    }
  }

  // winnerFaction may be NEUTRAL for neutral defender.
  function resolveBattle(C, fromIdx, toIdx, atkCount, attacker, defender, winnerFaction, survivors) {
    const dst = C.planets[toIdx];
    survivors = Math.max(1, survivors);
    if (winnerFaction === attacker) {
      dst.owner = attacker; dst.ships = survivors;
      C.message = `Captured ${planetName(toIdx)}!`;
    } else {
      // Defender holds. owner unchanged (could be -1 neutral or enemy player).
      dst.ships = survivors;
      C.message = `Attack on ${planetName(toIdx)} repelled.`;
    }
    checkWin(C);
  }

  function planetName(i) { return `Planet ${i + 1}`; }

  // ---- Turn processing ----
  function endTurn(C) {
    if (C.phase !== 'human' || C.over) return;
    C.phase = 'ai';
    C.selected = -1;
    // Build a flat order list across all AI players.
    C.aiOrders = [];
    for (const pl of C.players) {
      if (pl.human || pl.eliminated) continue;
      const orders = AI.strategyTurn(C, pl.faction);
      for (const o of orders) C.aiOrders.push(o);
    }
    processAIOrders(C);
  }

  // Process AI orders sequentially; battles vs human launch live skirmish.
  function processAIOrders(C) {
    while (C.aiOrders && C.aiOrders.length) {
      const o = C.aiOrders.shift();
      if (o.type === 'build') {
        const p = C.planets[o.planet];
        const cost = Data.buildCost(o.design.hull, o.design.comps);
        // Only build if the planet is still owned by an (AI) player who can afford it.
        if (p && p.owner >= 0 && C.players[p.owner] && !C.players[p.owner].human && C.players[p.owner].resources >= cost) {
          C.players[p.owner].resources -= cost; p.ships += 1;
        }
        continue;
      }
      if (o.type === 'move') {
        const src = C.planets[o.from], dst = C.planets[o.to];
        if (!src || src.owner < 0 || src.ships <= 1) continue;
        const count = Math.min(o.count, src.ships - 1);
        if (count <= 0) continue;
        const launched = applyMove(C, o.from, o.to, count, () => processAIOrders(C));
        if (launched) return; // wait for skirmish; continuation resumes this loop
      }
    }
    // No more orders -> finish round.
    finishRound(C);
  }

  function finishRound(C) {
    // Income for everyone, eliminate players with no planets.
    for (const pl of C.players) {
      if (pl.eliminated) continue;
      const owned = C.planets.filter(p => p.owner === pl.faction);
      if (owned.length === 0) { pl.eliminated = true; continue; }
      pl.resources += owned.reduce((s, p) => s + p.value, 0);
    }
    C.turn++;
    C.phase = 'human';
    checkWin(C);
    if (C.players[C.humanFaction].eliminated) { C.over = true; C.result = 'defeat'; Audio2.play('lose'); }
  }

  function checkWin(C) {
    const owners = new Set(C.planets.map(p => p.owner).filter(o => o >= 0));
    if (owners.size === 1) {
      const w = [...owners][0];
      C.over = true;
      C.result = w === C.humanFaction ? 'victory' : 'defeat';
      Audio2.play(w === C.humanFaction ? 'win' : 'lose');
    }
  }

  // ---- State hooks ----
  function enter() {
    Audio2.startMusic('strategy');
    // Game.C is created by Game.launchConquest; enter may also be a resume after a battle.
    if (Game.C && !Game.C.started) { /* shouldn't happen */ }
  }

  let moveMode = false; // selected own planet, awaiting target

  function update(ctx, m, dt) {
    const C = Game.C;
    if (!C) { Game.setState('menu'); return; }
    // Cheat: keep the human player's coffers full.
    if (Game.cheats.unlimitedResources) C.players[C.humanFaction].resources = 9999;
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, ION.W, ION.H);
    drawStars(ctx);

    handleInput(C, m);
    drawMap(ctx, C, m);
    drawPanel(ctx, C, m);

    if (C.over) drawGameOver(ctx, C, m);
  }

  let stars = null;
  function drawStars(ctx) {
    if (!stars) { stars = []; for (let i = 0; i < 80; i++) stars.push({ x: rand(0, MAPW), y: rand(0, ION.H), s: rand(0.5, 1.5) }); }
    for (const s of stars) { ctx.fillStyle = 'rgba(150,190,255,0.4)'; ctx.fillRect(s.x, s.y, s.s, s.s); }
  }

  function handleInput(C, m) {
    if (C.over || C.phase !== 'human') return;
    if (!m.clicked || m.x > MAPW) return;
    // Find clicked planet.
    let hit = -1;
    for (let i = 0; i < C.planets.length; i++) {
      const p = C.planets[i];
      if (dist(m.x, m.y, p.x, p.y) < p.r + 6) { hit = i; break; }
    }
    if (hit < 0) { C.selected = -1; return; }
    const p = C.planets[hit];
    if (C.selected < 0) {
      if (p.owner === C.humanFaction && p.ships > 0) { C.selected = hit; Audio2.play('click'); }
      else Audio2.play('deny');
      return;
    }
    // Have a selection: clicking it again deselects; clicking a linked planet issues a move.
    if (hit === C.selected) { C.selected = -1; return; }
    const src = C.planets[C.selected];
    if (!src.links.includes(hit)) { Audio2.play('deny'); C.message = 'Not connected to that planet.'; return; }
    if (src.ships <= 1) { Audio2.play('deny'); C.message = 'Need at least 2 ships to move out.'; return; }
    const all = Input.down('ShiftLeft') || Input.down('ShiftRight');
    const count = all ? src.ships : Math.max(1, src.ships - 1);
    const from = C.selected; C.selected = -1;
    applyMove(C, from, hit, count, null); // launches skirmish if a battle vs human
  }

  function drawMap(ctx, C, m) {
    // Links
    ctx.lineWidth = 1.5;
    for (let i = 0; i < C.planets.length; i++) {
      const p = C.planets[i];
      for (const j of p.links) {
        if (j < i) continue;
        const q = C.planets[j];
        const lit = C.selected === i || C.selected === j;
        ctx.strokeStyle = lit ? 'rgba(79,195,255,0.5)' : 'rgba(120,140,190,0.18)';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      }
    }
    // Move targets highlight
    const sel = C.selected >= 0 ? C.planets[C.selected] : null;

    for (let i = 0; i < C.planets.length; i++) {
      const p = C.planets[i];
      const col = p.owner >= 0 ? FACTION[p.owner].main : FACTION[NEUTRAL].main;
      const isTarget = sel && sel.links.includes(i);
      const hover = inRect ? dist(m.x, m.y, p.x, p.y) < p.r + 6 : false;

      // glow / selection ring
      if (C.selected === i) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 7, 0, TAU); ctx.stroke(); }
      else if (isTarget) { ctx.strokeStyle = COL.warn; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 7, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }

      // body
      const g = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.1, p.x, p.y, p.r);
      g.addColorStop(0, col); g.addColorStop(1, shade(col));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      ctx.lineWidth = hover ? 2.5 : 1.5; ctx.strokeStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();

      // ship count
      drawText(ctx, '' + p.ships, p.x, p.y + 1, { size: 18, align: 'center', baseline: 'middle', weight: '800', color: '#05060d' });
      // value pips above
      for (let v = 0; v < p.value; v++) { ctx.fillStyle = COL.warn; ctx.beginPath(); ctx.arc(p.x - (p.value - 1) * 5 + v * 10, p.y - p.r - 10, 2.5, 0, TAU); ctx.fill(); }
      drawText(ctx, planetName(i), p.x, p.y + p.r + 16, { size: 11, align: 'center', color: COL.dim });
    }
  }

  function shade(hex) {
    // darken a hex color
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgb(${(r * 0.25) | 0},${(g * 0.25) | 0},${(b * 0.25) | 0})`;
  }

  function drawPanel(ctx, C, m) {
    roundRect(ctx, PANEL.x, -10, PANEL.w + 10, PANEL.h + 20, 0); ctx.fillStyle = COL.panel; ctx.fill();
    ctx.strokeStyle = '#2a3550'; ctx.beginPath(); ctx.moveTo(PANEL.x, 0); ctx.lineTo(PANEL.x, PANEL.h); ctx.stroke();
    const px = PANEL.x + 20;
    drawText(ctx, 'CONQUEST', px, 40, { size: 24, weight: '800', color: COL.accent });
    drawText(ctx, `Turn ${C.turn}`, PANEL.x + PANEL.w - 20, 40, { size: 16, align: 'right', color: COL.text });

    // Player standings
    let y = 78;
    drawText(ctx, 'FACTIONS', px, y, { size: 12, color: COL.dim, weight: '700' }); y += 22;
    for (const pl of C.players) {
      const owned = C.planets.filter(p => p.owner === pl.faction).length;
      const total = C.planets.filter(p => p.owner === pl.faction).reduce((s, p) => s + p.ships, 0);
      ctx.globalAlpha = pl.eliminated ? 0.4 : 1;
      ctx.fillStyle = FACTION[pl.faction].main; ctx.beginPath(); ctx.arc(px + 6, y - 4, 6, 0, TAU); ctx.fill();
      drawText(ctx, (pl.human ? 'You' : `AI ${pl.faction}`) + (pl.eliminated ? ' (out)' : ''), px + 20, y, { size: 14, weight: '600' });
      drawText(ctx, `${owned}p · ${total}sh`, PANEL.x + PANEL.w - 20, y, { size: 13, align: 'right', color: COL.dim });
      ctx.globalAlpha = 1; y += 24;
    }

    // Resources
    y += 8;
    drawText(ctx, 'RESOURCES', px, y, { size: 12, color: COL.dim, weight: '700' });
    drawText(ctx, '' + C.players[C.humanFaction].resources, PANEL.x + PANEL.w - 20, y, { size: 18, align: 'right', color: COL.good, weight: '800' });
    y += 16;
    drawText(ctx, `Flagship: ${C.players[C.humanFaction].design.name || 'custom'} (cost ${Data.buildCost(C.players[C.humanFaction].design.hull, C.players[C.humanFaction].design.comps)})`, px, y + 14, { size: 12, color: COL.dim });
    y += 36;

    // Selected planet actions
    const sel = C.selected >= 0 ? C.planets[C.selected] : null;
    drawText(ctx, 'SELECTED', px, y, { size: 12, color: COL.dim, weight: '700' }); y += 8;
    const box = { x: px, y, w: PANEL.w - 40, h: 92 };
    roundRect(ctx, box.x, box.y, box.w, box.h, 8); ctx.fillStyle = COL.panelLight; ctx.fill();
    ctx.strokeStyle = '#2a3550'; ctx.stroke();
    if (sel) {
      drawText(ctx, planetName(C.selected), box.x + 12, box.y + 24, { size: 16, weight: '700' });
      drawText(ctx, `Ships: ${sel.ships}   Value: ${sel.value}/turn`, box.x + 12, box.y + 46, { size: 13, color: COL.dim });
      const cost = Data.buildCost(C.players[C.humanFaction].design.hull, C.players[C.humanFaction].design.comps);
      const canBuild = C.players[C.humanFaction].resources >= cost && sel.owner === C.humanFaction;
      if (button(ctx, m, { x: box.x + 12, y: box.y + 58, w: box.w - 24, h: 26 },
        `BUILD SHIP  (-${cost})`, { size: 13, disabled: !canBuild, fill: COL.panel, accent: COL.good })) {
        C.players[C.humanFaction].resources -= cost; sel.ships += 1; Audio2.play('deploy');
      }
    } else {
      drawText(ctx, 'Click a planet you own.', box.x + 12, box.y + 30, { size: 13, color: COL.dim });
      drawText(ctx, 'Then click a linked planet to', box.x + 12, box.y + 50, { size: 12, color: COL.dim });
      drawText(ctx, 'move / attack (Shift = send all).', box.x + 12, box.y + 66, { size: 12, color: COL.dim });
    }
    y = box.y + box.h + 20;

    // Message
    roundRect(ctx, px, y, PANEL.w - 40, 44, 8); ctx.fillStyle = '#0c1322'; ctx.fill();
    drawText(ctx, C.message, px + 12, y + 26, { size: 13, color: COL.accent });
    y += 64;

    // End turn
    const busy = C.phase !== 'human';
    if (button(ctx, m, { x: px, y: PANEL.h - 130, w: PANEL.w - 40, h: 50 },
      busy ? 'AI THINKING…' : 'END TURN', { size: 20, fill: busy ? COL.panel : COL.accent, accent: busy ? COL.dim : '#05060d', border: COL.accent, disabled: busy })) {
      endTurn(C);
    }
    if (button(ctx, m, { x: px, y: PANEL.h - 66, w: PANEL.w - 40, h: 36 }, 'QUIT TO MENU', { size: 15 })) {
      Game.C = null; Audio2.play('click'); Game.setState('menu');
    }
  }

  function drawGameOver(ctx, C, m) {
    ctx.fillStyle = 'rgba(5,6,13,0.75)'; ctx.fillRect(0, 0, ION.W, ION.H);
    const win = C.result === 'victory';
    drawText(ctx, win ? 'CONQUEST COMPLETE' : 'DEFEATED', ION.W / 2, 290, { size: 56, align: 'center', weight: '800', color: win ? COL.good : COL.accent2, shadow: win ? COL.good : COL.accent2 });
    drawText(ctx, win ? 'You control the sector.' : 'Your fleet has fallen.', ION.W / 2, 340, { size: 18, align: 'center', color: COL.dim });
    if (button(ctx, m, { x: ION.W / 2 - 110, y: 400, w: 220, h: 52 }, 'RETURN TO MENU', { size: 18 })) {
      Game.C = null; Game.setState('menu');
    }
  }

  return { enter, update, init };
})();
