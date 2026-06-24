# ION — Space Skirmish & Strategy

A browser game built from the *Ion* game design document by Rob Morgan. Combines a
real-time space **skirmish** (Asteroids-style dogfighting with customisable ships) and a
turn-based **conquest** strategy layer, where contested planets are resolved with live
skirmish battles.

> Status: **playable prototype (v1)** — full game loop working end to end with placeholder
> (programmer) art and procedurally generated audio. No external assets required.

## Run it

It's plain HTML5 + JavaScript with **no build step**. Two ways to play:

**Option A — just open it**
Double-click `index.html`. (Some browsers restrict audio/file access on `file://`; if so use Option B.)

**Option B — local server (recommended)**
```bash
cd "G:\My Drive\Claude\Ion"
python -m http.server 8123
```
Then open <http://localhost:8123> in a browser.

## Controls

| Action            | Key                                  |
|-------------------|--------------------------------------|
| Thrust / reverse  | `W` / `S`  (or `↑` / `↓`)            |
| Turn              | `A` / `D`  (or `←` / `→`)            |
| Fire weapons      | `F`                                  |
| Special power     | `G`                                  |
| Pause             | `Esc` or `P`                         |
| Menus / editor    | Mouse                                |

## Modes

- **How to Play** — in-game help screen with controls, a guide to each mode, and an **Arsenal**
  reference listing every weapon and special with its stats.
- **Ship Editor** — choose a hull and **drag components** from the palette into its slots. Live
  stat readout. **Saved designs persist on this device** (localStorage) and appear in a strip you
  can click to re-load or delete; saved ships can be flown as your flagship in either mode.
- **Skirmish** — pick your flagship and 1–3 AI opponents. Each fleet has 3 ships; last fleet flying
  wins. Arena hazards: asteroids, a gravity-well planet, and a slowing nebula.
- **Conquest** — turn-based map of planets. Earn resources each turn from owned planets, build ships,
  and move fleets along links. Attacking a defended planet drops you into a live skirmish battle;
  AI-vs-AI battles auto-resolve. Control all planets to win.

## Hulls & components

- **Hulls** (light → heavy): Scout · Fighter · Gunship · Cruiser · Dreadnought — more slots but
  slower handling as they get bigger.
- **Weapons**: Laser, Pulse Beam, Cannon, Railgun, Plasma, Flak, Missile (homing), Torpedo
  (homing + area blast).
- **Specials**: Afterburn, Overdrive (double fire-rate), Cloak, Blink (teleport), Repair, EMP Burst.
- **Defense/utility**: Armour, Shield, Engine.

## Art & audio

All visuals are **procedurally generated sprites** baked to offscreen canvases at boot — shaded
metallic ship hulls (one variant per faction), cratered asteroids, banded planets with atmospheres,
and additive-glow projectiles/explosions. No external image files. Audio is **layered WebAudio
synthesis** (oscillators + filtered noise + envelopes) with per-weapon sounds and two generative
music beds (calm strategy / driving skirmish). Toggle sound from the main menu.

## Project layout

```
index.html            entry point (loads scripts in order)
css/style.css         page/canvas styling
js/util.js            math, colours, canvas + UI helpers
js/audio.js           layered WebAudio SFX + generative music
js/input.js           keyboard + mouse, per-player control schemes
js/data.js            hulls, components, stat computation, presets
js/sprites.js         procedural sprite art baked to offscreen canvases
js/storage.js         localStorage persistence (saved designs)
js/entities.js        Ship, Projectile, Asteroid, Hazard, Effect
js/ai.js              combat piloting AI + conquest strategy AI
js/states/menu.js     main menu + setup screens
js/states/help.js     how-to-play + arsenal reference
js/states/editor.js   drag-and-drop ship builder + saved designs
js/states/skirmish.js real-time combat (also used for conquest battles)
js/states/conquest.js turn-based strategy map
js/main.js            state machine, game loop, shared Game object
```

## Known simplifications (v1)

- Conquest battles field up to 3 ships per side (matching the "3 ships" skirmish rule); larger
  fleets contribute as uncommitted reserves to the result.
- Local single-human play vs AI (the design's 1–4 players is supported structurally via factions;
  a second human on the keyboard can be enabled later).
- All art/audio is generated in code (no external asset files); this keeps the game fully
  self-contained and easy to drop hand-made sprites/audio into later.

## Next steps / ideas

- Hand-authored sprite/audio assets to replace the procedural ones
- Second human player (hot-seat) in skirmish
- Fleet composition per planet (mixed ship designs) in conquest
- Campaign progress save (designs already persist via localStorage)
- Package as a Windows `.exe` with Electron
