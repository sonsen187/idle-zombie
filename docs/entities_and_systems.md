# Entities & Game Systems

This document describes the design, properties, and runtime behavior of entities and game systems in **Zombie Survivor - Tactical Command PC**.

---

## 1. Game Entities (`js/entities.js`)

All interactive game elements are modeled as ES6 classes. To optimize rendering efficiency, graphics are handled using PixiJS primitive vectors rather than textures.

### Player
- Represents the commander behind the barricade.
- **Movement**: Moves horizontally toward the cursor `targetX`.
- **Properties**: Recoil, weapon angle, and leg-sway walk cycles.
- **Weapon System**: Graphically renders different weapons (SMG, Shotgun, Flame, Gatling, Plasma, Nuclear, etc.) based on the active weapon index.

### Zombie
- **Variations**:
  - `runner`: High speed, low health.
  - `armored`: Low speed, high health, gray colors.
  - `toxic`: Poisonous green aura, medium stats.
  - `necromancer`: Purple aura, periodically spawns extra normal zombies.
  - `golden`: Rare golden glow, drops huge gold payouts upon death.
  - `boss` (e.g. *Titan Armored*, *Goliath Toxic*): Spawns at the end of waves, scales in size and health.
- **AI Behavior**: Moves straight down towards `y = barricadeY`. Once it reaches the wall, it stops moving and attacks the barricade every interval.

### Bullet
- Fired from the player or hired mercenaries.
- Moves in a straight 3D vector towards target positions.
- Deactivates when it exits screen boundaries or collides with a zombie.

### AirDrop
- Parachutes down from the sky periodically.
- Landed drops can be clicked by the player to collect random rewards (Gold or DNA).

---

## 2. Core Game Systems (`js/systems.js`)

The game logic runs inside the central update loop `updateGame(dt)` triggered by the browser's `requestAnimationFrame` ticker.

```
[gameLoop] -> updateGame(dt)
                 |
                 +--> updateSkills(dt)
                 +--> updateMercenaries(dt)
                 +--> updateZombiesBehavior(dt)
                 +--> updateBulletsAndParticles(dt)
                 +--> checkCollisions()
                 +--> updateWaveManager(dt)
                 +--> autoSaveTick(dt)
```

### Combat & Damage Calculation
1. **Weapon Damage Scale**: Damage scales exponentially based on weapon level:
   $$\text{Damage} = \text{baseDamage} \times (\text{damageScale})^{\text{level}-1}$$
2. **Critical Hits**: Taps/bullets calculate critical hit chance. If triggered, damage is multiplied by the critical modifier and plays a sound/spawns critical floating text.
3. **Collision Registry**: Standard distance-based math is used for hitboxes, projected into 3D space scale:
   - For bullets vs. zombies, we check if the bullet distance to the zombie coordinate is less than the zombie's radius.
   - Flame and Plasma weapons use continuous piercing/beam checks instead of destroying bullets on first impact.

### Wave Management
- Spawns waves of zombies with scaling difficulty.
- Every wave increases the health multiplier of spawned zombies.
- At Wave 10, Bosses start appearing.
- Automatically handles transitions between waves, triggers a boss warning siren when a boss is spawning, and coordinates with the UI to display wave rewards.

### Prestige (Helicopter Evacuation)
- Available only after reaching Wave 10.
- Resetting prestige awards DNA based on the highest wave achieved:
  $$\text{DNA Reward} = \text{round}\left(1 + (\text{wave} - 9)^{1.25}\right)$$
- DNA can be spent on **Mutations** (persistent, permanent stat boosts like +20% damage, -7% reload time) which do not reset on evacuation.
