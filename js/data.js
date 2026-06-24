// ===== ION — game data: hulls, components, default loadouts =====
const Data = (() => {

  // ---- Hulls ----
  // slots: component slots. engines: nozzle count (used by sprite renderer).
  const HULLS = {
    scout: {
      id: 'scout', name: 'Scout', slots: 3, baseHp: 40, mass: 1.0,
      thrust: 320, turn: 4.2, maxSpeed: 320, cost: 2, r: 13, engines: 1,
      shape: [[18,0],[-10,-11],[-6,0],[-10,11]],
    },
    fighter: {
      id: 'fighter', name: 'Fighter', slots: 5, baseHp: 80, mass: 1.6,
      thrust: 300, turn: 3.2, maxSpeed: 270, cost: 4, r: 17, engines: 2,
      shape: [[22,0],[6,-14],[-14,-16],[-8,0],[-14,16],[6,14]],
    },
    gunship: {
      id: 'gunship', name: 'Gunship', slots: 6, baseHp: 110, mass: 2.1,
      thrust: 280, turn: 2.6, maxSpeed: 240, cost: 5, r: 20, engines: 2,
      shape: [[26,0],[10,-13],[6,-21],[-16,-18],[-10,0],[-16,18],[6,21],[10,13]],
    },
    cruiser: {
      id: 'cruiser', name: 'Cruiser', slots: 8, baseHp: 150, mass: 2.8,
      thrust: 250, turn: 2.0, maxSpeed: 210, cost: 7, r: 24, engines: 3,
      shape: [[30,0],[14,-12],[10,-22],[-18,-20],[-12,0],[-18,20],[10,22],[14,12]],
    },
    dreadnought: {
      id: 'dreadnought', name: 'Dreadnought', slots: 10, baseHp: 240, mass: 3.8,
      thrust: 205, turn: 1.45, maxSpeed: 175, cost: 11, r: 31, engines: 4,
      shape: [[40,0],[22,-11],[18,-27],[-6,-27],[-24,-23],[-15,0],[-24,23],[-6,27],[18,27],[22,11]],
    },
  };

  // ---- Components ----
  const COMPONENTS = {
    // Weapons
    laser:   { id:'laser',   name:'Laser',     type:'weapon', mass:0.2, color:'#7ad7ff',
               dmg:6,  rof:0.12, speed:680, life:0.9, spread:0.02, proj:'bolt', sound:'laser' },
    beam:    { id:'beam',    name:'Pulse Beam',type:'weapon', mass:0.3, color:'#aef0ff',
               dmg:4,  rof:0.06, speed:1000,life:0.55,spread:0.012,proj:'beam', sound:'beam' },
    cannon:  { id:'cannon',  name:'Cannon',    type:'weapon', mass:0.6, color:'#ffd27a',
               dmg:22, rof:0.7,  speed:520, life:1.4, spread:0.04, proj:'slug', sound:'cannon' },
    railgun: { id:'railgun', name:'Railgun',   type:'weapon', mass:0.9, color:'#e0b3ff',
               dmg:44, rof:1.5,  speed:1150,life:1.0, spread:0.005,proj:'rail', sound:'railgun' },
    plasma:  { id:'plasma',  name:'Plasma',    type:'weapon', mass:0.5, color:'#c98bff',
               dmg:9,  rof:0.28, speed:560, life:0.7, spread:0.18, pellets:3, proj:'blob', sound:'plasma' },
    flak:    { id:'flak',    name:'Flak',      type:'weapon', mass:0.6, color:'#ffb24f',
               dmg:6,  rof:0.6,  speed:430, life:0.45,spread:0.34, pellets:5, proj:'blob', sound:'flak' },
    missile: { id:'missile', name:'Missile',   type:'weapon', mass:0.7, color:'#ff9b6b',
               dmg:30, rof:1.1,  speed:300, life:2.6, spread:0, proj:'missile', homing:3.0, sound:'missile' },
    torpedo: { id:'torpedo', name:'Torpedo',   type:'weapon', mass:1.0, color:'#ff6b5d',
               dmg:55, rof:2.2,  speed:215, life:3.8, spread:0, proj:'torpedo', homing:2.2, splash:78, sound:'torpedo' },
    // Defense / utility
    engine:  { id:'engine',  name:'Engine',    type:'engine', mass:0.3, color:'#6bffd0',
               thrustMul:0.35, turnMul:0.30, speedMul:0.22 },
    armour:  { id:'armour',  name:'Armour',    type:'armour', mass:0.8, color:'#9fb0c8', hp:45 },
    shield:  { id:'shield',  name:'Shield',    type:'shield', mass:0.4, color:'#5db4ff',
               shield:40, regen:9, delay:2.5 },
    // Specials
    boost:     { id:'boost',     name:'Afterburn', type:'special', mass:0.2, color:'#ffe06b', special:'boost',     cooldown:6,  duration:1.6 },
    overdrive: { id:'overdrive', name:'Overdrive', type:'special', mass:0.3, color:'#ffd86b', special:'overdrive', cooldown:9,  duration:4.0 },
    cloak:     { id:'cloak',     name:'Cloak',     type:'special', mass:0.2, color:'#8a93ff', special:'cloak',     cooldown:12, duration:3.0 },
    blink:     { id:'blink',     name:'Blink',     type:'special', mass:0.2, color:'#b08bff', special:'blink',     cooldown:7,  distance:210 },
    repair:    { id:'repair',    name:'Repair',    type:'special', mass:0.3, color:'#6bff8e', special:'repair',    cooldown:14, amount:50 },
    emp:       { id:'emp',       name:'EMP Burst', type:'special', mass:0.4, color:'#5fd0ff', special:'emp',       cooldown:10, radius:160, stun:1.4 },
  };

  // Palette grouping for the editor UI.
  const PALETTE = [
    { group:'Weapons',  items:['laser','beam','cannon','railgun','plasma','flak','missile','torpedo'] },
    { group:'Defense',  items:['armour','shield'] },
    { group:'Engine',   items:['engine'] },
    { group:'Special',  items:['boost','overdrive','cloak','blink','repair','emp'] },
  ];

  function computeStats(hullId, comps) {
    const hull = HULLS[hullId];
    let mass = hull.mass, hp = hull.baseHp, shield = 0, regen = 0, delay = 2.5;
    let thrust = hull.thrust, turn = hull.turn, maxSpeed = hull.maxSpeed;
    const weapons = [], specials = [];
    for (const cid of comps) {
      if (!cid) continue;
      const c = COMPONENTS[cid];
      mass += c.mass;
      if (c.type === 'weapon') weapons.push(c);
      else if (c.type === 'armour') hp += c.hp;
      else if (c.type === 'shield') { shield += c.shield; regen += c.regen; delay = Math.min(delay, c.delay); }
      else if (c.type === 'engine') { thrust *= (1 + c.thrustMul); turn *= (1 + c.turnMul); maxSpeed *= (1 + c.speedMul); }
      else if (c.type === 'special') specials.push(c);
    }
    const massPenalty = clamp(hull.mass / mass, 0.45, 1);
    thrust *= massPenalty; turn *= massPenalty; maxSpeed *= (0.6 + 0.4 * massPenalty);
    return { hull, hp, shield, regen, delay, thrust, turn, maxSpeed, weapons, specials, mass };
  }

  function buildCost(hullId, comps) {
    let c = HULLS[hullId].cost;
    for (const cid of comps) {
      if (!cid) continue;
      c += COMPONENTS[cid].type === 'weapon' ? 2 : 1;
    }
    return c;
  }

  // ---- Preset / starter loadouts (also used by AI) ----
  function preset(name) {
    switch (name) {
      case 'interceptor': return { hull:'scout',       comps:['beam','engine','blink'] };
      case 'gunship':     return { hull:'gunship',     comps:['cannon','laser','flak','armour','shield','boost'] };
      case 'bomber':      return { hull:'fighter',     comps:['torpedo','missile','armour','engine','repair'] };
      case 'battleship':  return { hull:'dreadnought', comps:['railgun','cannon','cannon','plasma','flak','armour','armour','shield','emp','overdrive'] };
      default:            return { hull:'fighter',     comps:['laser','cannon','armour','shield','engine'] };
    }
  }
  const PRESET_NAMES = ['interceptor','gunship','bomber','battleship'];

  // ---- Difficulty levels ----
  // skirmish: combat-AI skill for skirmish matches.
  // conquestBase/Step: per-player combat skill in conquest = base + playerIndex*step.
  const DIFFICULTY = [
    { name: 'Easy',   skirmish: 0.30, conquestBase: 0.22, conquestStep: 0.04 },
    { name: 'Normal', skirmish: 0.55, conquestBase: 0.42, conquestStep: 0.05 },
    { name: 'Hard',   skirmish: 0.82, conquestBase: 0.62, conquestStep: 0.06 },
  ];

  return { HULLS, COMPONENTS, PALETTE, computeStats, buildCost, preset, PRESET_NAMES, DIFFICULTY };
})();
