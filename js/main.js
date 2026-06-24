// ===== ION — main: state machine, game loop, shared Game object =====
const Game = (() => {
  let canvas, ctx;
  let current = null;
  let lastT = 0;

  // Shared persistent data.
  const designs = [];        // player-saved ship designs
  const settings = { aiCount: 1, designIndex: 0, mapSize: 1, difficulty: 1 }; // difficulty: 0=Easy 1=Normal 2=Hard
  let skirmishConfig = null; // active skirmish setup
  let C = null;              // active conquest state (held here so it survives battles)
  let pendingBattleResolve = null;
  const cheats = { unlimitedResources: false };

  // Built-in starter designs so the game is playable before the editor is touched.
  function builtins() {
    return Data.PRESET_NAMES.map(n => {
      const p = Data.preset(n);
      return { name: n.charAt(0).toUpperCase() + n.slice(1), hull: p.hull, comps: p.comps, builtin: true };
    });
  }

  function allSelectableDesigns() {
    return [...designs, ...builtins()];
  }

  function saveDesign(d) {
    // Replace if same name exists (non-builtin).
    const i = designs.findIndex(x => x.name === d.name);
    if (i >= 0) designs[i] = d; else designs.push(d);
    Store.saveDesigns(designs);
  }

  function deleteDesign(name) {
    const i = designs.findIndex(x => x.name === name);
    if (i >= 0) { designs.splice(i, 1); Store.saveDesigns(designs); }
  }

  function setState(name) {
    current = STATES[name];
    if (current && current.enter) current.enter();
  }

  // ---- Launch helpers used by menu / conquest ----
  function launchSkirmishMatch(humanDesign, aiCount, diffLevel = 1) {
    const fleets = [{ faction: 0, design: humanDesign, count: 3, human: true }];
    for (let i = 1; i <= aiCount; i++)
      fleets.push({ faction: i, design: Data.preset(pick(Data.PRESET_NAMES)), count: 3, human: false });
    const skill = (Data.DIFFICULTY[diffLevel] || Data.DIFFICULTY[1]).skirmish;
    skirmishConfig = {
      title: 'SKIRMISH', difficulty: skill, fleets,
      hazards: { asteroids: 6, planet: true, nebula: true },
      onEnd: () => setState('menu'),
    };
    setState('skirmish');
  }

  function launchConquest(humanDesign, aiCount, mapSize, diffLevel = 1) {
    C = STATES.conquest.init(humanDesign, aiCount, mapSize, diffLevel);
    setState('conquest');
  }

  // Launch a single conquest battle as a live skirmish, then resume conquest.
  function startBattle(opts) {
    const aDesign = opts.atkDesign, dDesign = opts.defDesign;
    skirmishConfig = {
      title: `BATTLE — ${opts.planetName}`,
      difficulty: opts.difficulty ?? 0.3,
      fleets: [
        { faction: opts.attacker, design: aDesign, count: Math.min(3, Math.max(1, opts.atkCount)), human: opts.attacker === opts.humanFaction },
        { faction: opts.defender, design: dDesign, count: Math.min(3, Math.max(1, opts.defCount)), human: opts.defender === opts.humanFaction },
      ],
      hazards: { asteroids: 4, planet: true, nebula: false },
      onEnd: (winnerFaction, fleets) => {
        // Survivors = winning fleet's remaining ships + any uncommitted overflow.
        const winFleet = fleets.find(f => f.faction === winnerFaction);
        const lives = winFleet ? (winFleet.reserve + (winFleet.active && !winFleet.active.dead ? 1 : 0)) : 1;
        const committed = winnerFaction === opts.attacker ? opts.atkCount : opts.defCount;
        const overflow = Math.max(0, committed - 3);
        let survivors = Math.max(1, lives + overflow);
        // Mutual destruction -> defender holds with 1 (planet contested).
        if (winnerFaction < 0) { survivors = 1; winnerFaction = opts.defender; }
        opts.onResolve(winnerFaction, survivors);
        setState('conquest');
      },
    };
    setState('skirmish');
  }

  // ---- Loop ----
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000) || 0;
    lastT = t;
    Input.mouse; // ensure exists
    if (current && current.update) current.update(ctx, Input.mouse, dt);
    Input.endFrame();
    requestAnimationFrame(frame);
  }

  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    ION.W = canvas.width; ION.H = canvas.height;
    Input.attach(canvas);

    // Pre-render sprite art and restore saved designs.
    Sprites.init();
    const saved = Store.loadDesigns();
    for (const d of saved) designs.push(d);

    // Route typed keys to the editor's name field, and unlock audio on first input.
    let audioUnlocked = false;
    function unlock() { if (!audioUnlocked) { Audio2.init(); Audio2.resume(); audioUnlocked = true; } }
    window.addEventListener('keydown', e => { unlock(); if (current === STATES.editor && STATES.editor.onKey) STATES.editor.onKey(e); });
    window.addEventListener('mousedown', unlock);

    // Cheat code: type "MOTHERLODE" to toggle unlimited Conquest resources.
    const CODE = 'motherlode';
    let buf = '';
    window.addEventListener('keydown', e => {
      if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
      buf = (buf + e.key.toLowerCase()).slice(-CODE.length);
      if (buf === CODE) {
        cheats.unlimitedResources = !cheats.unlimitedResources;
        Audio2.play(cheats.unlimitedResources ? 'win' : 'deny');
        if (C) C.message = cheats.unlimitedResources ? '★ CHEAT: unlimited resources ON' : 'CHEAT: unlimited resources OFF';
        buf = '';
      }
    });

    setState('menu');
    requestAnimationFrame(frame);
  }

  // Expose
  const api = {
    boot, setState, saveDesign, deleteDesign, allSelectableDesigns,
    launchSkirmishMatch, launchConquest, startBattle,
    get designs() { return designs; },
    get settings() { return settings; },
    get skirmishConfig() { return skirmishConfig; },
    get C() { return C; }, set C(v) { C = v; },
    get cheats() { return cheats; },
  };
  return api;
})();

window.addEventListener('load', Game.boot);
