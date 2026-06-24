// ===== ION — skirmish combat (real-time) =====
var STATES = STATES || {};

STATES.skirmish = (() => {
  let world = null;
  let fleets = [];
  let cfg = null;
  let over = false, winner = -1, endTimer = 0, ended = false;
  let paused = false;
  let banner = '', bannerT = 0;

  function makeWorld() {
    return {
      w: ION.W, h: ION.H,
      ships: [], projectiles: [], asteroids: [], hazards: [], effects: [],
      addProjectile(p) { this.projectiles.push(p); },
      addEffect(e) { this.effects.push(e); },
    };
  }

  function enter() {
    cfg = Game.skirmishConfig;
    Audio2.startMusic('skirmish');
    world = makeWorld();
    over = false; winner = -1; endTimer = 0; ended = false; paused = false;
    banner = cfg.title || 'BATTLE'; bannerT = 2.2;

    // Hazards: asteroids + a planet + nebula (configurable).
    const haz = cfg.hazards || { asteroids: 6, planet: true, nebula: true };
    for (let i = 0; i < haz.asteroids; i++)
      world.asteroids.push(new Asteroid(rand(100, ION.W - 100), rand(100, ION.H - 100), rand(18, 46)));
    if (haz.planet) world.hazards.push(new Hazard(ION.W / 2, ION.H / 2, 46, 'planet'));
    if (haz.nebula) world.hazards.push(new Hazard(rand(200, ION.W - 200), rand(150, ION.H - 150), 130, 'nebula'));

    // Build fleets. Spawn points spread around the arena.
    const spawnPts = [
      { x: 160, y: 160 }, { x: ION.W - 160, y: ION.H - 160 },
      { x: ION.W - 160, y: 160 }, { x: 160, y: ION.H - 160 },
    ];
    fleets = cfg.fleets.map((f, i) => ({
      faction: f.faction, design: f.design, human: f.human,
      reserve: (f.count || 3), active: null, respawn: 0,
      spawn: spawnPts[i % spawnPts.length],
    }));
    fleets.forEach(spawnShip);
  }

  function spawnShip(fleet) {
    if (fleet.reserve <= 0) return;
    fleet.reserve--;
    const s = new Ship(fleet.design, fleet.faction, fleet.spawn.x + rand(-30, 30), fleet.spawn.y + rand(-30, 30));
    if (fleet.human) { s.scheme = Input.SCHEMES[0]; }
    else { s.isAI = true; s.brain = { difficulty: cfg.difficulty ?? 0.7 }; }
    fleet.active = s;
    world.ships.push(s);
  }

  function fleetAlive(f) { return f.reserve > 0 || (f.active && !f.active.dead); }

  function update(ctx, m, dt) {
    // Pause toggle
    if (Input.justPressed('Escape') || Input.justPressed('KeyP')) paused = !paused;

    if (!paused) step(dt);
    draw(ctx, m);

    if (paused) drawPause(ctx, m);
  }

  function step(dt) {
    // Once the match is decided, just run out the end timer, then hand back once.
    if (over) {
      endTimer += dt;
      if (endTimer > 3 && !ended) { ended = true; cfg.onEnd(winner, fleets); }
      return;
    }
    // --- Controls ---
    for (const f of fleets) {
      const s = f.active;
      if (!s || s.dead) continue;
      if (f.human) {
        const k = s.scheme, c = s.control;
        c.turn = (Input.down(k.left) ? -1 : 0) + (Input.down(k.right) ? 1 : 0);
        c.thrust = (Input.down(k.up) ? 1 : 0) + (Input.down(k.down) ? -1 : 0);
        c.fire = Input.down(k.fire);
        c.special = Input.justPressed(k.special);
      } else {
        AI.update(s, world, dt);
      }
    }

    // --- Updates ---
    for (const s of world.ships) s.update(dt, world);
    for (const p of world.projectiles) p.update(dt, world);
    for (const a of world.asteroids) a.update(dt, world);
    for (const h of world.hazards) { h.update(dt); for (const s of world.ships) if (!s.dead) h.apply(s, dt, world); }
    for (const e of world.effects) e.update(dt);

    collisions();

    // --- Respawn / elimination ---
    for (const f of fleets) {
      if (f.active && f.active.dead) {
        if (f.reserve > 0) {
          f.respawn += dt;
          if (f.respawn > 1.6) { f.respawn = 0; spawnShip(f); }
        }
      }
    }

    // --- Cleanup ---
    world.ships = world.ships.filter(s => !s.dead);
    world.projectiles = world.projectiles.filter(p => !p.dead);
    world.asteroids = world.asteroids.filter(a => !a.dead);
    world.effects = world.effects.filter(e => !e.dead);

    // --- Win check ---
    const alive = fleets.filter(fleetAlive);
    if (alive.length <= 1) {
      over = true;
      winner = alive.length === 1 ? alive[0].faction : -1;
      Audio2.play(alive.length === 1 && alive[0].human ? 'win' : 'lose');
    }
    bannerT = Math.max(0, bannerT - dt);
  }

  function collisions() {
    // Projectiles vs ships & asteroids
    for (const p of world.projectiles) {
      if (p.dead) continue;
      for (const s of world.ships) {
        if (s.dead || s.faction === p.faction) continue;
        if (dist(p.x, p.y, s.x, s.y) < s.stats.hull.r + 3) {
          s.takeDamage(p.dmg, p.x, p.y, world);
          if (p.w.splash) {
            // Area blast: damage nearby enemies too.
            world.addEffect(new Effect(p.x, p.y, { count: 22, color: p.w.color, speed: 240, life: 0.6, size: 4 }));
            Audio2.play('explosion');
            for (const o of world.ships) {
              if (o === s || o.dead || o.faction === p.faction) continue;
              if (dist(p.x, p.y, o.x, o.y) < p.w.splash) o.takeDamage(p.dmg * 0.55, p.x, p.y, world);
            }
          } else {
            world.addEffect(new Effect(p.x, p.y, { count: 5, color: p.w.color, speed: 90, life: 0.3, size: 2 }));
          }
          p.dead = true; break;
        }
      }
      if (p.dead) continue;
      for (const a of world.asteroids) {
        if (dist(p.x, p.y, a.x, a.y) < a.r) {
          a.hp -= p.dmg; p.dead = true;
          world.addEffect(new Effect(p.x, p.y, { count: 4, color: '#8a8f9d', speed: 70, life: 0.3, size: 2 }));
          if (a.hp <= 0) { a.dead = true; world.addEffect(new Effect(a.x, a.y, { count: 12, color: '#7a8090', speed: 120 })); }
          break;
        }
      }
    }
    // Ship vs asteroid (bump + chip damage)
    for (const s of world.ships) {
      if (s.dead) continue;
      for (const a of world.asteroids) {
        const d = dist(s.x, s.y, a.x, a.y), min = a.r + s.stats.hull.r;
        if (d < min) {
          const ang = angTo(a.x, a.y, s.x, s.y);
          s.x = a.x + Math.cos(ang) * min; s.y = a.y + Math.sin(ang) * min;
          s.vx += Math.cos(ang) * 60; s.vy += Math.sin(ang) * 60;
          s.takeDamage(12 * (1 / 60), a.x, a.y, world);
        }
      }
    }
    // Ship vs ship (soft bounce)
    for (let i = 0; i < world.ships.length; i++) {
      for (let j = i + 1; j < world.ships.length; j++) {
        const a = world.ships[i], b = world.ships[j];
        if (a.dead || b.dead) continue;
        const min = a.stats.hull.r + b.stats.hull.r;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < min && d > 0) {
          const ang = angTo(a.x, a.y, b.x, b.y), push = (min - d) / 2;
          a.x -= Math.cos(ang) * push; a.y -= Math.sin(ang) * push;
          b.x += Math.cos(ang) * push; b.y += Math.sin(ang) * push;
        }
      }
    }
  }

  // ---- Rendering ----
  function draw(ctx, m) {
    ctx.fillStyle = COL.bg; ctx.fillRect(0, 0, ION.W, ION.H);
    drawStarfield(ctx);
    for (const h of world.hazards) h.draw(ctx);
    for (const a of world.asteroids) a.draw(ctx);
    for (const e of world.effects) e.draw(ctx);
    for (const p of world.projectiles) p.draw(ctx);
    for (const s of world.ships) s.draw(ctx);
    drawHUD(ctx);

    if (bannerT > 0) {
      ctx.globalAlpha = clamp(bannerT, 0, 1);
      drawText(ctx, banner, ION.W / 2, ION.H / 2 - 40, { size: 44, align: 'center', weight: '800', color: COL.accent, shadow: COL.accent });
      ctx.globalAlpha = 1;
    }
    if (over) {
      ctx.fillStyle = 'rgba(5,6,13,0.55)'; ctx.fillRect(0, 0, ION.W, ION.H);
      const txt = winner < 0 ? 'MUTUAL DESTRUCTION'
        : (fleets.find(f => f.faction === winner)?.human ? 'VICTORY' : `${FACTION[winner].name.toUpperCase()} WINS`);
      drawText(ctx, txt, ION.W / 2, ION.H / 2, { size: 56, align: 'center', weight: '800',
        color: winner < 0 ? COL.warn : FACTION[winner].main, shadow: winner < 0 ? COL.warn : FACTION[winner].main });
    }
  }

  let sf = null;
  function drawStarfield(ctx) {
    if (!sf) { sf = []; for (let i = 0; i < 90; i++) sf.push({ x: rand(0, ION.W), y: rand(0, ION.H), s: rand(0.5, 1.6) }); }
    ctx.fillStyle = '#243', ctx.globalAlpha = 1;
    for (const s of sf) { ctx.fillStyle = 'rgba(150,190,255,0.5)'; ctx.fillRect(s.x, s.y, s.s, s.s); }
  }

  function drawHUD(ctx) {
    // Per-fleet life pips
    let y = 20;
    for (const f of fleets) {
      const col = FACTION[f.faction].main;
      const total = (f.reserve) + (f.active && !f.active.dead ? 1 : 0);
      drawText(ctx, (f.human ? 'YOU' : FACTION[f.faction].name), 24, y + 14, { size: 14, color: col, weight: '700' });
      for (let i = 0; i < (f.count || 3); i++) {
        ctx.fillStyle = i < total ? col : 'rgba(255,255,255,0.12)';
        ctx.beginPath(); ctx.arc(120 + i * 18, y + 9, 6, 0, TAU); ctx.fill();
      }
      // human special/shield readout
      if (f.human && f.active && !f.active.dead) {
        const s = f.active;
        drawText(ctx, `HP ${Math.max(0, Math.round(s.hp))}/${s.maxHp}`, 220, y + 14, { size: 13, color: COL.dim });
        if (s.stats.specials.length) {
          const ready = s.specialTimers.some(t => t === 0);
          drawText(ctx, ready ? 'SPECIAL READY (G)' : 'special…', 330, y + 14, { size: 13, color: ready ? COL.good : COL.dim });
        }
      }
      y += 30;
    }
    drawText(ctx, 'Esc: pause', ION.W - 24, 28, { size: 13, align: 'right', color: COL.dim });
  }

  function drawPause(ctx, m) {
    ctx.fillStyle = 'rgba(5,6,13,0.7)'; ctx.fillRect(0, 0, ION.W, ION.H);
    drawText(ctx, 'PAUSED', ION.W / 2, 260, { size: 48, align: 'center', weight: '800' });
    if (button(ctx, m, { x: ION.W / 2 - 110, y: 320, w: 220, h: 50 }, 'RESUME', { size: 20 })) paused = false;
    if (button(ctx, m, { x: ION.W / 2 - 110, y: 384, w: 220, h: 50 }, 'QUIT TO MENU', { size: 20 })) {
      paused = false; Audio2.play('click'); Game.setState('menu');
    }
  }

  return { enter, update };
})();
