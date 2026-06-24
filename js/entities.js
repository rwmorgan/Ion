// ===== ION — combat entities =====

// ---- Projectile ----
class Projectile {
  constructor(x, y, vx, vy, weapon, faction, ownerIdx) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.w = weapon; this.faction = faction; this.owner = ownerIdx;
    this.life = weapon.life; this.dead = false;
    this.dmg = weapon.dmg;
    this.homing = weapon.homing || 0;
    this.angle = Math.atan2(vy, vx);
  }
  update(dt, world) {
    // Missiles steer toward the nearest enemy ship.
    if (this.homing) {
      let best = null, bd = 1e9;
      for (const s of world.ships) {
        if (s.dead || s.faction === this.faction) continue;
        const d = dist(this.x, this.y, s.x, s.y);
        if (d < bd) { bd = d; best = s; }
      }
      if (best && bd < 520) {
        const desired = angTo(this.x, this.y, best.x, best.y);
        this.angle += clamp(angDiff(this.angle, desired), -this.homing * dt, this.homing * dt);
        const sp = Math.hypot(this.vx, this.vy);
        this.vx = Math.cos(this.angle) * sp;
        this.vy = Math.sin(this.angle) * sp;
      }
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    // Wrap around arena edges.
    if (this.x < 0) this.x += world.w; if (this.x > world.w) this.x -= world.w;
    if (this.y < 0) this.y += world.h; if (this.y > world.h) this.y -= world.h;
  }
  draw(ctx) {
    const c = this.w.color, p = this.w.proj;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Additive glow halo.
    const glow = Sprites.glow(c);
    ctx.globalCompositeOperation = 'lighter';
    const gs = p === 'rail' ? 28 : p === 'torpedo' ? 22 : 14;
    ctx.drawImage(glow, -gs / 2, -gs / 2, gs, gs);
    ctx.globalCompositeOperation = 'source-over';

    ctx.fillStyle = '#ffffff';
    if (p === 'bolt') { ctx.fillStyle = c; ctx.fillRect(-6, -1.5, 12, 3); ctx.fillStyle = '#fff'; ctx.fillRect(-3, -0.7, 7, 1.4); }
    else if (p === 'beam') { ctx.fillStyle = c; ctx.fillRect(-9, -1, 18, 2); ctx.fillStyle = '#fff'; ctx.fillRect(-5, -0.5, 12, 1); }
    else if (p === 'slug') { ctx.fillStyle = c; ctx.fillRect(-4, -2.5, 8, 5); }
    else if (p === 'rail') { ctx.fillStyle = '#fff'; ctx.fillRect(-16, -1.2, 32, 2.4); ctx.fillStyle = c; ctx.fillRect(-16, -0.6, 26, 1.2); }
    else if (p === 'blob') { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, 0, 3.2, 0, TAU); ctx.fill(); }
    else if (p === 'missile') {
      ctx.fillStyle = '#cfd6e2'; ctx.fillRect(-5, -2, 10, 4);
      ctx.fillStyle = '#ffb14f'; ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-11, 0); ctx.lineTo(-5, 2); ctx.fill();
    }
    else if (p === 'torpedo') {
      ctx.fillStyle = '#d7c0b8'; ctx.fillRect(-7, -3, 14, 6);
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(7, -3); ctx.lineTo(11, 0); ctx.lineTo(7, 3); ctx.fill();
      ctx.fillStyle = '#ff8a4f'; ctx.beginPath(); ctx.moveTo(-7, -2.5); ctx.lineTo(-13, 0); ctx.lineTo(-7, 2.5); ctx.fill();
    }
    ctx.restore();
  }
}

// ---- Particle effects (explosions, sparks) ----
class Effect {
  constructor(x, y, opts = {}) {
    this.x = x; this.y = y; this.dead = false;
    this.parts = [];
    const n = opts.count || 14;
    const col = opts.color || '#ffae5d';
    const spd = opts.speed || 180;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(spd * 0.2, spd);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rand(0.3, opts.life || 0.7), max: 0.7, col, r: rand(1, opts.size || 3) });
    }
  }
  update(dt) {
    let alive = false;
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
      p.life -= dt; alive = true;
    }
    if (!alive) this.dead = true;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      const g = Sprites.glow(p.col);
      const s = p.r * 4;
      ctx.drawImage(g, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// ---- Asteroid ----
class Asteroid {
  constructor(x, y, r) {
    this.x = x; this.y = y; this.r = r;
    const a = rand(0, TAU), s = rand(8, 30);
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.spin = rand(-0.5, 0.5); this.rot = 0; this.hp = r * 2;
    this.spriteIndex = randInt(0, (Sprites.count || 1) - 1);
    this.dead = false;
  }
  update(dt, world) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.rot += this.spin * dt;
    if (this.x < -this.r) this.x = world.w + this.r;
    if (this.x > world.w + this.r) this.x = -this.r;
    if (this.y < -this.r) this.y = world.h + this.r;
    if (this.y > world.h + this.r) this.y = -this.r;
  }
  draw(ctx) {
    const spr = Sprites.asteroid(this.spriteIndex);
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    // Sprite is rendered at SS=4; its full world size is canvas.width/4. Scale so
    // the sprite's design radius R maps onto this asteroid's radius.
    const ws = (spr.canvas.width / 4) * (this.r / spr.R);
    ctx.drawImage(spr.canvas, -ws / 2, -ws / 2, ws, ws);
    ctx.restore();
  }
}

// ---- Planet / Nebula hazards (decorative + gravity / slow) ----
class Hazard {
  constructor(x, y, r, kind) {
    this.x = x; this.y = y; this.r = r; this.kind = kind; // 'planet' | 'nebula'
    this.hue = randInt(180, 320);
    this.spriteIndex = randInt(0, (Sprites.planetCount || 1) - 1);
    this.rot = 0;
  }
  update(dt) { this.rot += dt * 0.05; }
  apply(ship, dt, world) {
    const d = dist(this.x, this.y, ship.x, ship.y);
    if (this.kind === 'planet') {
      // Gentle gravity well; solid core damages on contact.
      if (d < this.r + ship.stats.hull.r) { ship.takeDamage(40 * dt, this.x, this.y, world); }
      else if (d < this.r * 4) {
        const g = 3200 / (d * d) * this.r;
        ship.vx += Math.cos(angTo(ship.x, ship.y, this.x, this.y)) * g * dt;
        ship.vy += Math.sin(angTo(ship.x, ship.y, this.x, this.y)) * g * dt;
      }
    } else if (this.kind === 'nebula') {
      if (d < this.r) { ship.vx *= (1 - 0.9 * dt); ship.vy *= (1 - 0.9 * dt); ship.inNebula = true; }
    }
  }
  draw(ctx) {
    ctx.save(); ctx.translate(this.x, this.y);
    if (this.kind === 'planet') {
      const spr = Sprites.planet(this.spriteIndex);
      const ws = (spr.canvas.width / 4) * (this.r / spr.R);
      ctx.drawImage(spr.canvas, -ws / 2, -ws / 2, ws, ws);
    } else {
      const g = ctx.createRadialGradient(0, 0, this.r * 0.2, 0, 0, this.r);
      g.addColorStop(0, `hsla(${this.hue},70%,55%,0.22)`);
      g.addColorStop(1, `hsla(${this.hue},70%,40%,0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

// ---- Ship ----
class Ship {
  constructor(loadout, faction, x, y) {
    this.loadout = loadout;
    this.stats = Data.computeStats(loadout.hull, loadout.comps);
    this.faction = faction;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.angle = rand(0, TAU);
    this.maxHp = this.stats.hp; this.hp = this.maxHp;
    this.maxShield = this.stats.shield; this.shield = this.maxShield;
    this.shieldTimer = 0;
    this.dead = false;
    this.isAI = false;
    this.brain = null;        // AI controller, if any
    this.scheme = null;       // keyboard scheme, if human
    this.control = { thrust:0, turn:0, fire:false, special:false };
    this.fireTimers = this.stats.weapons.map(() => 0);
    this.specialTimers = this.stats.specials.map(() => 0);
    this.boost = 0; this.cloak = 0; this.stun = 0; this.overdrive = 0;
    this.inNebula = false;
    this.thrustFx = 0;
    this.score = 0;
  }

  takeDamage(amount, sx, sy, world) {
    if (this.dead) return;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed; amount -= absorbed;
      this.shieldTimer = this.stats.delay;
      Audio2.play('shieldHit');
    }
    if (amount > 0) { this.hp -= amount; Audio2.play('hit'); }
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      if (world) {
        world.addEffect(new Effect(this.x, this.y, { count: 30, color: this.factionColor(), speed: 260, size: 4, life: 0.9 }));
        world.addEffect(new Effect(this.x, this.y, { count: 18, color: '#ffae5d', speed: 200, size: 3 }));
      }
      Audio2.play('explosion');
    }
  }

  factionColor() { return FACTION[this.faction].main; }

  // Activate special index if off cooldown.
  fireSpecial(world) {
    for (let i = 0; i < this.stats.specials.length; i++) {
      if (this.specialTimers[i] > 0) continue;
      const sp = this.stats.specials[i];
      this.specialTimers[i] = sp.cooldown;
      Audio2.play('special');
      if (sp.special === 'boost') this.boost = sp.duration;
      else if (sp.special === 'overdrive') this.overdrive = sp.duration;
      else if (sp.special === 'cloak') this.cloak = sp.duration;
      else if (sp.special === 'blink') {
        this.x += Math.cos(this.angle) * sp.distance;
        this.y += Math.sin(this.angle) * sp.distance;
        if (this.x < 0) this.x += world.w; if (this.x > world.w) this.x -= world.w;
        if (this.y < 0) this.y += world.h; if (this.y > world.h) this.y -= world.h;
        world.addEffect(new Effect(this.x, this.y, { count: 16, color: '#b08bff', speed: 160, life: 0.5 }));
      }
      else if (sp.special === 'repair') {
        this.hp = Math.min(this.maxHp, this.hp + sp.amount);
        world.addEffect(new Effect(this.x, this.y, { count: 16, color: '#6bff8e', speed: 120, life: 0.6 }));
      } else if (sp.special === 'emp') {
        world.addEffect(new Effect(this.x, this.y, { count: 26, color: '#5fd0ff', speed: 320, life: 0.5 }));
        for (const s of world.ships) {
          if (s === this || s.dead || s.faction === this.faction) continue;
          if (dist(this.x, this.y, s.x, s.y) < sp.radius) { s.stun = Math.max(s.stun, sp.stun); s.shield = 0; }
        }
      }
      return; // one special per press
    }
  }

  fireWeapons(world) {
    for (let i = 0; i < this.stats.weapons.length; i++) {
      if (this.fireTimers[i] > 0) continue;
      const w = this.stats.weapons[i];
      this.fireTimers[i] = w.rof * (this.overdrive > 0 ? 0.5 : 1);
      // Muzzle position slightly ahead of the nose.
      const mx = this.x + Math.cos(this.angle) * (this.stats.hull.r + 6);
      const my = this.y + Math.sin(this.angle) * (this.stats.hull.r + 6);
      const pellets = w.pellets || 1;
      for (let p = 0; p < pellets; p++) {
        const a = this.angle + rand(-w.spread, w.spread);
        const vx = Math.cos(a) * w.speed + this.vx * 0.3;
        const vy = Math.sin(a) * w.speed + this.vy * 0.3;
        world.addProjectile(new Projectile(mx, my, vx, vy, w, this.faction, this.faction));
      }
      Audio2.play(w.sound);
    }
  }

  update(dt, world) {
    if (this.dead) return;
    // Timers
    for (let i = 0; i < this.fireTimers.length; i++) this.fireTimers[i] = Math.max(0, this.fireTimers[i] - dt);
    for (let i = 0; i < this.specialTimers.length; i++) this.specialTimers[i] = Math.max(0, this.specialTimers[i] - dt);
    this.boost = Math.max(0, this.boost - dt);
    this.cloak = Math.max(0, this.cloak - dt);
    this.overdrive = Math.max(0, this.overdrive - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.inNebula = false;

    const c = this.control;
    const stunned = this.stun > 0;

    // Rotation
    if (!stunned) this.angle += c.turn * this.stats.turn * dt;

    // Thrust
    let thrustMul = 1 + (this.boost > 0 ? 1.4 : 0);
    this.thrustFx = 0;
    if (!stunned && c.thrust > 0) {
      this.vx += Math.cos(this.angle) * this.stats.thrust * thrustMul * dt;
      this.vy += Math.sin(this.angle) * this.stats.thrust * thrustMul * dt;
      this.thrustFx = c.thrust;
    } else if (!stunned && c.thrust < 0) {
      this.vx -= Math.cos(this.angle) * this.stats.thrust * 0.45 * dt;
      this.vy -= Math.sin(this.angle) * this.stats.thrust * 0.45 * dt;
    }

    // Drag + speed cap
    this.vx *= 0.992; this.vy *= 0.992;
    const sp = Math.hypot(this.vx, this.vy);
    const cap = this.stats.maxSpeed * (this.boost > 0 ? 1.5 : 1);
    if (sp > cap) { this.vx = this.vx / sp * cap; this.vy = this.vy / sp * cap; }

    // Fire
    if (!stunned && c.fire) this.fireWeapons(world);
    if (!stunned && c.special) this.fireSpecial(world);

    // Integrate
    this.x += this.vx * dt; this.y += this.vy * dt;

    // Arena wrap
    if (this.x < 0) this.x += world.w; if (this.x > world.w) this.x -= world.w;
    if (this.y < 0) this.y += world.h; if (this.y > world.h) this.y -= world.h;

    // Shield regen
    if (this.maxShield > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
      if (this.shieldTimer === 0 && this.shield < this.maxShield)
        this.shield = Math.min(this.maxShield, this.shield + this.stats.regen * dt);
    }

    // Thrust particle trail
    if (this.thrustFx > 0 && Math.random() < 0.7) {
      const bx = this.x - Math.cos(this.angle) * this.stats.hull.r;
      const by = this.y - Math.sin(this.angle) * this.stats.hull.r;
      world.addEffect(new Effect(bx, by, { count: 2, color: this.boost > 0 ? '#ffe06b' : '#7ad7ff', speed: 60, life: 0.25, size: 2 }));
    }
  }

  draw(ctx) {
    if (this.dead) return;
    const fc = this.factionColor();
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.globalAlpha = this.cloak > 0 ? 0.3 : 1;

    // Engine flame behind the hull (additive) when thrusting.
    if (this.thrustFx > 0) {
      const bx = -this.stats.hull.r;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const flame = Sprites.glow(this.boost > 0 ? '#ffe06b' : '#7ad7ff');
      const len = rand(12, 22) + (this.boost > 0 ? 10 : 0);
      ctx.drawImage(flame, bx - len, -7, len, 14);
      ctx.restore();
    }

    // Baked ship sprite (falls back to a wedge if sprites unavailable).
    const spr = Sprites.ship && Sprites.ship(this.stats.hull.id, this.faction);
    if (spr) {
      ctx.drawImage(spr.canvas, -spr.ax, -spr.ay, spr.w, spr.h);
    } else {
      const shape = this.stats.hull.shape;
      ctx.beginPath();
      for (let i = 0; i < shape.length; i++) i === 0 ? ctx.moveTo(shape[i][0], shape[i][1]) : ctx.lineTo(shape[i][0], shape[i][1]);
      ctx.closePath(); ctx.fillStyle = '#11192b'; ctx.fill();
      ctx.lineWidth = 2.2; ctx.strokeStyle = fc; ctx.stroke();
    }

    // Overdrive shimmer
    if (this.overdrive > 0) {
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(Date.now() / 60);
      ctx.strokeStyle = '#ffd86b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, this.stats.hull.r + 3, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Shield bubble
    if (this.shield > 0.5) {
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.18 * (this.shield / this.maxShield);
      ctx.strokeStyle = '#5db4ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.stats.hull.r + 7, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (this.stun > 0) {
      ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = '#5fd0ff'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.stats.hull.r + 3 + i * 3, rand(0, TAU), rand(0, TAU));
        ctx.stroke();
      }
      ctx.restore();
    }

    // Health bar
    this.drawBar(ctx);
  }

  drawBar(ctx) {
    const w = 34, x = this.x - w / 2, y = this.y - this.stats.hull.r - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
    ctx.fillStyle = '#39406a'; ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = this.factionColor(); ctx.fillRect(x, y, w * clamp(this.hp / this.maxHp, 0, 1), 4);
    if (this.maxShield > 0) {
      ctx.fillStyle = '#5db4ff';
      ctx.fillRect(x, y - 4, w * clamp(this.shield / this.maxShield, 0, 1), 2);
    }
  }
}
