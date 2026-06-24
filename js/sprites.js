// ===== ION — procedural sprite art (pre-rendered to offscreen canvases) =====
// Bakes detailed ships / asteroids / planets / glows once at boot so the game
// draws real shaded sprites instead of flat wireframes — no external assets.
const Sprites = (() => {
  const SS = 4;            // supersample factor for crisp downscaled sprites
  const ships = {};        // key `${hull}_${faction}` -> {canvas, ax, ay, w, h}
  const asteroids = [];    // array of canvases
  const planets = [];      // array of canvases
  const glowCache = {};    // color -> canvas
  let ready = false;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w); c.height = Math.ceil(h);
    return c;
  }

  // ---- Ship sprites (parametric from hull.shape) ----
  function buildShip(hull, factionIdx) {
    const fc = FACTION[factionIdx].main;
    const sh = hull.shape;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const [x, y] of sh) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const padL = 16, padR = 6, padV = 8;           // extra room on the left for engine flare
    const w = (maxX - minX + padL + padR), h = (maxY - minY + padV * 2);
    const cv = makeCanvas(w * SS, h * SS);
    const ctx = cv.getContext('2d');
    ctx.scale(SS, SS);
    ctx.translate(padL - minX, padV - minY);       // shape (0,0) now at (padL-minX, padV-minY)
    const ax = padL - minX, ay = padV - minY;       // anchor (ship origin) in world units

    const path = () => {
      ctx.beginPath();
      for (let i = 0; i < sh.length; i++) i === 0 ? ctx.moveTo(sh[i][0], sh[i][1]) : ctx.lineTo(sh[i][0], sh[i][1]);
      ctx.closePath();
    };

    // Engine nozzles + flames behind the hull (rear = minX side).
    const eng = hull.engines || 2;
    for (let e = 0; e < eng; e++) {
      const ey = (eng === 1) ? 0 : lerp(minY * 0.55, maxY * 0.55, e / (eng - 1));
      const ex = minX + 2;
      ctx.fillStyle = '#0a0e16';
      ctx.fillRect(ex - 4, ey - 2.6, 6, 5.2);
      const fg = ctx.createLinearGradient(ex - 12, ey, ex, ey);
      fg.addColorStop(0, 'rgba(120,200,255,0)');
      fg.addColorStop(1, 'rgba(150,220,255,0.7)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(ex, ey - 2.4); ctx.lineTo(ex - 11, ey); ctx.lineTo(ex, ey + 2.4); ctx.closePath(); ctx.fill();
    }

    // Hull body with a metallic top-down gradient (lit from top).
    const grad = ctx.createLinearGradient(0, minY, 0, maxY);
    grad.addColorStop(0, '#445066');
    grad.addColorStop(0.45, '#2c3647');
    grad.addColorStop(0.5, '#27303f');
    grad.addColorStop(1, '#161c27');
    path(); ctx.fillStyle = grad; ctx.fill();

    // Inner darker core for depth.
    ctx.save(); path(); ctx.clip();
    const core = ctx.createLinearGradient(minX, 0, maxX, 0);
    core.addColorStop(0, 'rgba(0,0,0,0.35)');
    core.addColorStop(0.4, 'rgba(0,0,0,0)');
    core.addColorStop(1, 'rgba(255,255,255,0.06)');
    ctx.fillStyle = core; ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

    // Panel lines.
    ctx.strokeStyle = 'rgba(10,14,22,0.6)'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(minX + 4, 0); ctx.lineTo(maxX - 4, 0);
    ctx.moveTo(lerp(minX, maxX, 0.4), minY + 2); ctx.lineTo(lerp(minX, maxX, 0.4), maxY - 2);
    ctx.moveTo(lerp(minX, maxX, 0.65), minY + 3); ctx.lineTo(lerp(minX, maxX, 0.65), maxY - 3);
    ctx.stroke();

    // Faction accent stripes along the long axis.
    ctx.strokeStyle = fc; ctx.globalAlpha = 0.85; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(minX + 6, minY * 0.45); ctx.lineTo(maxX - 6, minY * 0.18);
    ctx.moveTo(minX + 6, maxY * 0.45); ctx.lineTo(maxX - 6, maxY * 0.18);
    ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();

    // Hull outline + faction glow edge.
    path();
    ctx.lineWidth = 1.6; ctx.strokeStyle = fc;
    ctx.shadowColor = fc; ctx.shadowBlur = 6 * SS / SS; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(8,10,16,0.9)'; ctx.stroke();

    // Cockpit canopy near the nose (front = maxX side).
    const cpx = maxX * 0.35 + 2, cpw = (maxX - minX) * 0.16, cph = (maxY - minY) * 0.22;
    const cg = ctx.createRadialGradient(cpx - cpw * 0.3, -cph * 0.3, 0.5, cpx, 0, cpw);
    cg.addColorStop(0, '#dff3ff'); cg.addColorStop(0.5, fc); cg.addColorStop(1, '#10202f');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(cpx, 0, cpw, cph, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.6; ctx.stroke();

    // Weapon hardpoint nubs along the leading edges.
    ctx.fillStyle = '#1b2230';
    for (let i = 0; i < Math.min(3, Math.floor(hull.slots / 2)); i++) {
      const t = 0.3 + i * 0.22;
      ctx.fillRect(lerp(minX, maxX, t), minY * 0.7 - 1, 3, 2);
      ctx.fillRect(lerp(minX, maxX, t), maxY * 0.7 - 1, 3, 2);
    }

    return { canvas: cv, ax, ay, w, h };
  }

  // ---- Asteroid sprites ----
  function buildAsteroid(seed) {
    const R = 60, pad = 8, size = (R + pad) * 2;
    const cv = makeCanvas(size * SS, size * SS);
    const ctx = cv.getContext('2d');
    ctx.scale(SS, SS); ctx.translate(size / 2, size / 2);
    const n = 9 + (seed % 4);
    const verts = [];
    for (let i = 0; i < n; i++) verts.push(R * (0.72 + ((Math.sin(seed * 9.7 + i * 2.3) * 0.5 + 0.5)) * 0.32));
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = verts[i]; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.closePath();
    ctx.save(); ctx.clip();
    const g = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#6a7180'); g.addColorStop(0.6, '#474d5a'); g.addColorStop(1, '#2a2f3a');
    ctx.fillStyle = g; ctx.fillRect(-size, -size, size * 2, size * 2);
    // craters + speckle
    for (let i = 0; i < 7; i++) {
      const a = Math.sin(seed * 3.1 + i) * TAU, rr = (Math.cos(seed + i * 2) * 0.5 + 0.5) * R * 0.7;
      const cx = Math.cos(a) * rr, cy = Math.sin(a) * rr, cr = 3 + (Math.sin(seed * i) * 0.5 + 0.5) * 7;
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.arc(cx, cy, cr, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.arc(cx - cr * 0.3, cy - cr * 0.3, cr * 0.6, 0, TAU); ctx.fill();
    }
    for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; ctx.fillRect(rand(-R, R), rand(-R, R), 1, 1); }
    ctx.restore();
    ctx.lineWidth = 1.4; ctx.strokeStyle = '#5b6373'; ctx.stroke();
    return { canvas: cv, R };
  }

  // ---- Planet sprites ----
  function buildPlanet(hue) {
    const R = 90, pad = 26, size = (R + pad) * 2;
    const cv = makeCanvas(size * SS, size * SS);
    const ctx = cv.getContext('2d');
    ctx.scale(SS, SS); ctx.translate(size / 2, size / 2);
    // atmosphere glow
    const atm = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R + pad);
    atm.addColorStop(0, `hsla(${hue},70%,60%,0.35)`); atm.addColorStop(1, `hsla(${hue},70%,60%,0)`);
    ctx.fillStyle = atm; ctx.beginPath(); ctx.arc(0, 0, R + pad, 0, TAU); ctx.fill();
    // body
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip();
    const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R);
    g.addColorStop(0, `hsl(${hue},55%,62%)`); g.addColorStop(0.7, `hsl(${hue},58%,34%)`); g.addColorStop(1, `hsl(${hue},60%,14%)`);
    ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2);
    // bands
    for (let i = 0; i < 8; i++) {
      const yy = -R + (i / 8) * R * 2 + Math.sin(i) * 4;
      ctx.fillStyle = `hsla(${hue + (i % 2 ? 12 : -12)},55%,${30 + (i % 2) * 12}%,0.30)`;
      ctx.fillRect(-R, yy, R * 2, R * 0.18);
    }
    // surface mottling
    for (let i = 0; i < 40; i++) { ctx.fillStyle = `hsla(${hue},50%,${20 + Math.random() * 40}%,0.10)`; const a = rand(0, TAU), rr = rand(0, R); ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, rand(3, 12), 0, TAU); ctx.fill(); }
    // terminator shadow
    const sh = ctx.createRadialGradient(R * 0.5, R * 0.4, R * 0.2, R * 0.1, 0, R * 1.5);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = sh; ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
    ctx.lineWidth = 1.5; ctx.strokeStyle = `hsla(${hue},70%,75%,0.4)`; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
    return { canvas: cv, R };
  }

  // ---- Soft additive glow (cached per color) ----
  function glow(color) {
    if (glowCache[color]) return glowCache[color];
    const R = 32, cv = makeCanvas(R * 2, R * 2);
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(R, R, 0, R, R, R);
    g.addColorStop(0, color); g.addColorStop(0.25, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(R, R, R, 0, TAU); ctx.fill();
    glowCache[color] = cv; return cv;
  }

  function init() {
    if (ready) return;
    for (const hid in Data.HULLS)
      for (let f = 0; f < FACTION.length; f++)
        ships[`${hid}_${f}`] = buildShip(Data.HULLS[hid], f);
    for (let i = 0; i < 6; i++) asteroids.push(buildAsteroid(i * 13 + 3));
    [205, 30, 280, 140].forEach(h => planets.push(buildPlanet(h)));
    ready = true;
  }

  return {
    init,
    ship: (hull, faction) => ships[`${hull}_${faction}`],
    asteroid: i => asteroids[i % asteroids.length],
    planet: i => planets[i % planets.length],
    glow,
    get count() { return asteroids.length; },
    get planetCount() { return planets.length; },
  };
})();
