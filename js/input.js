// ===== ION — input (keyboard + mouse) =====
const Input = (() => {
  const keys = {};        // current down state by code
  const pressed = {};     // edge: true for one frame after keydown
  const mouse = { x: 0, y: 0, down: false, clicked: false, downThisFrame: false };
  let canvas = null;
  let downInside = false;

  function attach(cv) {
    canvas = cv;
    window.addEventListener('keydown', e => {
      if (!keys[e.code]) pressed[e.code] = true;
      keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });

    function toCanvas(e) {
      const r = canvas.getBoundingClientRect();
      const sx = canvas.width / r.width, sy = canvas.height / r.height;
      mouse.x = (e.clientX - r.left) * sx;
      mouse.y = (e.clientY - r.top) * sy;
    }
    canvas.addEventListener('mousemove', toCanvas);
    canvas.addEventListener('mousedown', e => {
      toCanvas(e); mouse.down = true; mouse.downThisFrame = true; downInside = true;
    });
    // A click = press started on canvas and released anywhere.
    window.addEventListener('mouseup', () => {
      if (downInside) mouse.clicked = true;
      mouse.down = false; downInside = false;
    });
  }

  // Clear one-shot states at end of each frame.
  function endFrame() {
    for (const k in pressed) pressed[k] = false;
    mouse.clicked = false;
    mouse.downThisFrame = false;
  }

  function down(code) { return !!keys[code]; }
  function justPressed(code) { return !!pressed[code]; }

  // Per-player control schemes for skirmish. Player 0 = human (WASD + F/G).
  const SCHEMES = [
    { up: 'KeyW', left: 'KeyA', right: 'KeyD', down: 'KeyS', fire: 'KeyF', special: 'KeyG' },
    { up: 'ArrowUp', left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown', fire: 'Slash', special: 'Period' },
  ];

  return { attach, endFrame, down, justPressed, mouse, keys, pressed, SCHEMES };
})();
