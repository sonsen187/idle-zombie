# State Management & Data Sync

This document details how the game manages dynamic state variables, optimizes memory via Object Pooling, and synchronizes progress with local storage.

---

## 1. Centralized State vs. Reactive References

To avoid global namespace pollution and ensure compatibility with ES Modules (where direct exports are read-only to importing files), the game state is organized as follows:

- **Centralized Game State (`gameState`)**: A single mutable object containing all saveable progress (weapons, mutations, currency). Imported directly, but updated using the `setGameState(newState)` function in [state.js](file:///home/sonsen/Workspace/Personal/Idle%20Zombie/js/state.js#L7).
- **Reactive Value Objects**: Dynamic scalars (like `isPaused`, `isReloading`, `shakeTime`, `waveTimer`) are wrapped in objects with a `.value` property (e.g. `audioMuted = { value: false }`). This allows different modules to read and write to the same reference without reassigning the export identifier itself.

```
+-----------------------------------------------------------+
|                          state.js                         |
|                                                           |
|  gameState = { gold: 100, dna: 0, ... }                   |
|  isPaused = { value: false }                              |
|                                                           |
+-----------------------------+-----------------------------+
                              |
       +----------------------+----------------------+
       | (Direct read)                               | (Write through wrapper/.value)
       v                                             v
+--------------+                               +-------------+
| renderer.js  |                               | systems.js  |
|              |                               |             |
+--------------+                               +-------------+
```

---

## 2. Object Pools (Performance Optimization)

Spawning and destroying hundreds of bullet and particle objects per second causes garbage collection (GC) spikes, causing visual micro-stuttering (lag).

To solve this, we initialize pre-allocated **Object Pools** in [main.js](file:///home/sonsen/Workspace/Personal/Idle%20Zombie/js/main.js#L82) at startup:
- `particlePool`: Pre-allocates `MAX_PARTICLES` (120) instances.
- `bulletPool`: Pre-allocates `MAX_BULLETS` (250) instances.
- `textPool`: Pre-allocates `MAX_TEXTS` (30) instances.

### How Pooling Works
When a new entity is needed, we do **NOT** call `new Bullet()`. Instead, we query the pool for an inactive instance:

```javascript
// js/entities.js
export function getAvailableBullet() {
    return bulletPool.find(b => !b.active);
}
```

If found, we reset its parameters and mark it `active = true`. Once its life expires (goes off-screen or hits a target), we set `active = false` so it can be reused.

---

## 3. Save Game System & Sync

Game progress is saved automatically every 10 seconds or manually upon certain actions (e.g., shopping, prestiged).

### Storage Mechanism
- **Key**: `ZombieIdleSurvivorPC_v5_hyper_progressive`
- **Serialization**: The `gameState` object is converted to a JSON string.
- **Obfuscation**: The JSON string is encoded to a Base64 string using `btoa()` to prevent simple cheating by editing the local storage manually, and loaded back using `atob()`.

```javascript
// Save Game (js/systems.js)
const saveStr = btoa(unescape(encodeURIComponent(JSON.stringify(gameState))));
localStorage.setItem(STORAGE_KEY, saveStr);

// Load Game (js/systems.js)
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
    const rawJSON = decodeURIComponent(escape(atob(saved)));
    setGameState(JSON.parse(rawJSON));
}
```

### Import / Export Save
The game provides a manual save manager. The Base64 string is displayed in a modal, allowing players to copy their code to backup or paste a code to restore progress.
- Handled by UI bindings linked to [ui.js](file:///home/sonsen/Workspace/Personal/Idle%20Zombie/js/ui.js#L30) / [systems.js](file:///home/sonsen/Workspace/Personal/Idle%20Zombie/js/systems.js#L130).
