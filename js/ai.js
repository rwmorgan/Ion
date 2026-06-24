// ===== ION — combat AI =====
// Fills ship.control each frame. Difficulty scales aim/aggression.
const AI = (() => {

  function nearestEnemy(ship, world) {
    let best = null, bd = 1e9;
    for (const s of world.ships) {
      if (s.dead || s.faction === ship.faction) continue;
      const d = dist(ship.x, ship.y, s.x, s.y);
      if (d < bd) { bd = d; best = s; }
    }
    return { target: best, d: bd };
  }

  // Lead the target based on its velocity and a representative projectile speed.
  function leadAim(ship, target) {
    const projSpeed = ship.stats.weapons.length ? Math.max(...ship.stats.weapons.map(w => w.speed)) : 600;
    const d = dist(ship.x, ship.y, target.x, target.y);
    const t = d / projSpeed;
    return { x: target.x + target.vx * t, y: target.y + target.vy * t };
  }

  function nearestAsteroidAhead(ship, world) {
    let best = null, bd = 1e9;
    for (const a of world.asteroids) {
      const d = dist(ship.x, ship.y, a.x, a.y);
      if (d > 180 + a.r) continue;
      // Only worry about ones roughly in front of our heading.
      const ahead = Math.cos(angDiff(ship.angle, angTo(ship.x, ship.y, a.x, a.y)));
      if (ahead > 0.3 && d < bd) { bd = d; best = a; }
    }
    return best;
  }

  function update(ship, world, dt) {
    const c = ship.control;
    c.thrust = 0; c.turn = 0; c.fire = false; c.special = false;
    if (ship.dead || ship.stun > 0) return;

    const { target, d } = nearestEnemy(ship, world);
    if (!target) { c.thrust = 0.2; return; }

    const diff = ship.brain.difficulty ?? 0.4;

    // Hesitation: at low skill the AI frequently "thinks" instead of acting,
    // drifting for a frame. This makes it noticeably sluggish and beatable.
    if (Math.random() < (1 - diff) * 0.18) { c.thrust = 0.15; return; }

    // Avoid asteroids first (steering override).
    const ast = nearestAsteroidAhead(ship, world);
    if (ast && dist(ship.x, ship.y, ast.x, ast.y) < ast.r + 70) {
      const away = angTo(ast.x, ast.y, ship.x, ship.y);
      const turnDelta = angDiff(ship.angle, away);
      c.turn = Math.sign(turnDelta);
      c.thrust = 1;
      return;
    }

    // Aim with leading; aim error grows sharply as difficulty drops.
    const aim = leadAim(ship, target);
    const jitter = (1 - diff) * 1.4;
    const desired = angTo(ship.x, ship.y, aim.x, aim.y) + rand(-jitter, jitter);
    const turnDelta = angDiff(ship.angle, desired);
    // Lower skill = slower, mushier turning.
    c.turn = clamp(turnDelta * (1.2 + diff * 1.8), -1, 1);

    // Range management: weaker AI keeps its distance and dawdles.
    const ideal = 230 + (1 - diff) * 120;
    if (d > ideal + 90) c.thrust = 1;
    else if (d < ideal - 90) c.thrust = -1;     // back off
    else c.thrust = (Math.abs(turnDelta) < 0.5 ? 0.4 : 0.7) * (0.5 + diff * 0.5);

    // Fire only when well aligned, in closer range, and — at low skill — only
    // some of the time. This is the biggest lethality dial.
    const aligned = Math.abs(turnDelta) < 0.14 + diff * 0.12;
    if (aligned && d < 420 + diff * 160 && Math.random() < 0.25 + diff * 0.65) c.fire = true;

    // Specials: use offensively/defensively based on situation.
    if (ship.specialTimers.some(t => t === 0)) {
      for (let i = 0; i < ship.stats.specials.length; i++) {
        if (ship.specialTimers[i] > 0) continue;
        const sp = ship.stats.specials[i];
        if (sp.special === 'repair' && ship.hp < ship.maxHp * 0.45) c.special = true;
        else if (sp.special === 'emp' && d < sp.radius * 0.8) c.special = true;
        else if (sp.special === 'boost' && d > 320 && Math.random() < 0.02) c.special = true;
        else if (sp.special === 'cloak' && ship.hp < ship.maxHp * 0.35 && Math.random() < 0.02) c.special = true;
      }
    }
  }

  // ---- Strategy AI (conquest) ----
  // Given the conquest state and a player index, returns a list of orders:
  // { type:'build', planet, design } and { type:'move', from, to, count }.
  function strategyTurn(C, pIdx) {
    const orders = [];
    const me = C.players[pIdx];
    let budget = me.resources;
    const myPlanets = C.planets.filter(p => p.owner === pIdx);
    if (myPlanets.length === 0) return orders;

    // Build ships on the most threatened owned planet until budget is low.
    // Threat = enemy fleets on adjacent planets.
    function threatOf(planet) {
      let t = 0;
      for (const nIdx of planet.links) {
        const n = C.planets[nIdx];
        if (n.owner !== pIdx && n.owner !== -1) t += n.ships;
      }
      return t + (planet.ships < 2 ? 2 : 0);
    }
    myPlanets.sort((a, b) => threatOf(b) - threatOf(a));

    const design = pick(C.aiDesigns || [Data.preset('gunship')]);
    const cost = Data.buildCost(design.hull, design.comps);
    let guard = 0;
    while (budget >= cost && guard < 3) {
      const target = myPlanets[0];
      orders.push({ type: 'build', planet: C.planets.indexOf(target), design });
      target._plannedShips = (target._plannedShips || target.ships) + 1;
      budget -= cost; guard++;
    }

    // Move: from strong owned planets, attack the weakest adjacent enemy/neutral.
    for (const p of myPlanets) {
      const pi = C.planets.indexOf(p);
      const garrison = p.ships;
      if (garrison < 2) continue;
      let bestTarget = -1, bestScore = -1e9;
      for (const nIdx of p.links) {
        const n = C.planets[nIdx];
        if (n.owner === pIdx) continue;
        // Prefer weakly defended, valuable targets.
        const score = (n.value * 2) - n.ships + (n.owner === -1 ? 2 : 0);
        if (score > bestScore) { bestScore = score; bestTarget = nIdx; }
      }
      if (bestTarget >= 0) {
        const send = Math.max(1, garrison - 1);
        const defNeeded = C.planets[bestTarget].ships;
        // Cautious: only commit when it has a clear advantage, and only
        // sometimes — so the AI expands slowly and rarely overruns the player.
        if (send > defNeeded * 1.4 && Math.random() < 0.45) {
          orders.push({ type: 'move', from: pi, to: bestTarget, count: send });
        }
      }
    }
    return orders;
  }

  return { update, strategyTurn };
})();
