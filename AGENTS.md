# Agent Entry Point & Project Roadmap

Welcome, Agent! This document serves as the primary gateway to understanding the **Zombie Survivor - Tactical Command PC** codebase. It is designed to help you build a mental model of the project immediately, minimize context drift, and avoid common regression bugs.

---

## 🗺️ Codebase Map

The project is structured as a pure ES Module application running directly in the browser without build tools.

```
/ (Root)
├── AGENTS.md                   <-- You are here (Core instructions & entry point)
├── .cursorrules                <-- System-level development rules for IDE Agents
├── index.html                  <-- The HTML Shell (loads CSS & entry JS module)
├── css/
│   └── style.css               <-- Styling (CRT screen filter, shop tabs, custom layouts)
├── js/                         <-- Core Game Logic (ES Modules)
│   ├── main.js                 <-- Entry Point (initialization, canvas setup, game loop)
│   ├── constants.js            <-- Static configs (weapons, mercs, mutations, audio files)
│   ├── state.js                <-- Centralized dynamic game state & PixiJS references
│   ├── helpers.js              <-- Math helper functions, 3D projection, formatters
│   ├── audio.js                <-- Audio engine (Tone.js synthesizer & Audio Pools)
│   ├── entities.js             <-- Barrel export for entities submodules
│   ├── entities/               # Entities submodules (Player, Zombie, Bullet, Particle, AirDrop, FloatingText)
│   ├── systems.js              <-- Barrel export for systems submodules
│   ├── systems/                # Systems submodules (Wave, Combat, Save, hooks)
│   ├── renderer.js             <-- Barrel export for renderer submodules
│   ├── renderer/               # Renderer submodules (Renderer drawing engine)
│   ├── ui.js                   <-- Barrel export for UI submodules
│   └── ui/                     # UI submodules (Shop panels, Modals, HUD Updates)
└── docs/                       <-- Detailed Technical Specifications
    ├── architecture.md         <-- System architecture & module relations
    ├── state_management.md     <-- Game state lifecycle & LocalStorage sync
    └── entities_and_systems.md <-- Entity behaviors & system updates
```

---

## 📚 Technical Specifications

Please read these documents in order before writing any code:

1. [Architecture & Design Patterns](file:///home/sonsen/Workspace/Personal/Idle%20Zombie/docs/architecture.md)
   - ES Module architecture.
   - Event Hook registry (solving circular dependencies).
   - Rendering loop & 3D projection math.
2. [State Management & Data Sync](file:///home/sonsen/Workspace/Personal/Idle%20Zombie/docs/state_management.md)
   - Central state vs. temporary states.
   - Object Pools management (`bulletPool`, `particlePool`, `textPool`).
   - LocalStorage encryption/decryption (`btoa`/`atob`) and migration path.
3. [Entities & Game Systems](file:///home/sonsen/Workspace/Personal/Idle%20Zombie/docs/entities_and_systems.md)
   - Player, Zombie, Bullet, and Particle lifecycles.
   - Combat hit-registration, airstrikes, and skills.
   - Wave manager and prestige system.

---

## 🛠️ Global Development Rules

When writing code or refactoring this codebase, you **MUST** adhere to the following principles:

1. **No Bundlers / No Build Tools**: Do not introduce webpack, vite, npm package builders. The game must run directly using browser-native ES Modules via a basic HTTP server (`python3 -m http.server 8080`).
2. **ESM Live-Binding Safety**: ES Module exports are read-only for importers. 
   - Never reassign imported variables directly (e.g. `let app` imported from `state.js` cannot be reassigned like `app = new PIXI.Application()`).
   - Instead, group reassigned objects into a single exported reference container (like the `pixi` object wrapper in [state.js](file:///home/sonsen/Workspace/Personal/Idle%20Zombie/js/state.js#L35)) or use setters (like `setGameState()`, `setCanvas()`).
3. **No Circular Imports**: To prevent Temporal Dead Zone (TDZ) errors, do not import chieflly between `entities.js`, `systems.js`, and `ui.js`. Use the **Event Hooks Pattern** registered in `main.js`.
4. **Cache Busting**: When modifying HTML files, always preserve the anti-cache meta headers and clean up temporary assets.
5. **No Placeholders**: Always write production-ready, fully-functional code. Do not use `TODO` comments or stub functions unless requested.
