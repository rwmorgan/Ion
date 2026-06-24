// ===== ION — shared utilities =====
// Global namespace to keep things simple with plain <script> includes.
const ION = {
  W: 1280,
  H: 720,
};

// ---- Math helpers ----
const TAU = Math.PI * 2;
function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
// Smallest signed angular difference (target - current), wrapped to [-PI, PI].
function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// ---- Color palette ----
const COL = {
  bg: '#05060d',
  panel: '#0e1320',
  panelLight: '#161d30',
  line: '#2a3550',
  accent: '#4fc3ff',
  accent2: '#ff5d8f',
  warn: '#ffcf4f',
  good: '#5dff9b',
  text: '#dce6ff',
  dim: '#6f7da0',
};

// Player faction colors (index 0..3).
const FACTION = [
  { name: 'Azure',   main: '#4fc3ff', glow: 'rgba(79,195,255,0.5)' },
  { name: 'Crimson', main: '#ff5d6c', glow: 'rgba(255,93,108,0.5)' },
  { name: 'Verdant', main: '#5dff9b', glow: 'rgba(93,255,155,0.5)' },
  { name: 'Amber',   main: '#ffcf4f', glow: 'rgba(255,207,79,0.5)' },
  { name: 'Neutral', main: '#8b95ad', glow: 'rgba(139,149,173,0.4)' }, // index 4 = neutral garrisons
];
const NEUTRAL = 4;

// ---- Canvas drawing helpers ----
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawText(ctx, txt, x, y, opts = {}) {
  ctx.save();
  ctx.font = `${opts.weight || ''} ${opts.size || 16}px ${opts.font || "'Segoe UI', sans-serif"}`.trim();
  ctx.fillStyle = opts.color || COL.text;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'alphabetic';
  if (opts.shadow) { ctx.shadowColor = opts.shadow; ctx.shadowBlur = opts.shadowBlur || 8; }
  ctx.fillText(txt, x, y);
  ctx.restore();
}

// Simple point-in-rect test used widely for UI hit testing.
function inRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

// A reusable button helper. Returns true if clicked this frame.
function button(ctx, mouse, r, label, opts = {}) {
  const hover = inRect(mouse.x, mouse.y, r);
  ctx.save();
  roundRect(ctx, r.x, r.y, r.w, r.h, opts.radius ?? 8);
  ctx.fillStyle = opts.disabled ? '#11151f'
    : hover ? (opts.hoverFill || COL.panelLight) : (opts.fill || COL.panel);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = opts.disabled ? '#222a3a'
    : hover ? (opts.accent || COL.accent) : (opts.border || '#2a3550');
  ctx.stroke();
  ctx.restore();
  drawText(ctx, label, r.x + r.w / 2, r.y + r.h / 2, {
    size: opts.size || 18, align: 'center', baseline: 'middle',
    color: opts.disabled ? COL.dim : (hover ? (opts.accent || COL.accent) : COL.text),
    weight: opts.weight || '600',
  });
  return !opts.disabled && hover && mouse.clicked;
}
