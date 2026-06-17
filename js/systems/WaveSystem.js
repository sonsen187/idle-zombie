import { INITIAL_GAME_STATE, REPAIR_TIME_MAX, MAX_CONCURRENT_ZOMBIES, DOM_UPDATE_INTERVAL } from '../constants.js';
import { 
    gameState, player, canvas, zombies, bulletPool, airDrops, textPool, particlePool,
    activeFlashes, isReloading, reloadTimer, shakeTime, skillsCooldown, activeSkillsDuration,
    activeBomberPlanes, activeAirstrikeBombs, mainWeaponShootTimer, baseRepairTimer,
    setZombies, setActiveBomberPlanes, setActiveAirstrikeBombs, setActiveFlashes,
    keysPressed, mousePosition, isMouseDown,
    setGameState, domUpdateTimer, autosaveTimer, waveTimer, dayNightCycle
} from '../state.js';
import { playUpgradeChime, playDefeatDrone, playExplosionSound } from '../audio.js';
import { 
    Zombie, AirDrop, getAvailableText, getAvailableParticle, getAvailableBullet, 
    spawnExplosion, getPrioritizedZombie 
} from '../entities.js';
import { distToSegmentSquared, project3D, unproject3D } from '../helpers.js';
import { saveGameData } from './SaveSystem.js';
import { triggerAutomaticFire, updateMercenary, getWeaponDamage } from './CombatSystem.js';
import { systemHooks } from './hooks.js';

// Reset playfield
export function resetField() {
    zombies.forEach(z => z.destroyGraphics());
    setZombies([]);
    bulletPool.forEach(b => b.active = false);
    airDrops.forEach(drop => drop.destroyGraphics());
    airDrops.length = 0;
    setActiveBomberPlanes([]);
    setActiveAirstrikeBombs([]);
    setActiveFlashes([]);
    
    const defeatOverlay = document.getElementById('defeat-overlay');
    if (defeatOverlay) {
        defeatOverlay.classList.add('hidden');
        defeatOverlay.classList.remove('flex');
    }
    
    const bossWarning = document.getElementById('boss-warning');
    if (bossWarning) {
        bossWarning.classList.add('hidden');
        bossWarning.classList.remove('flex');
    }
}

// Prestige system
export function executePrestige(dnaReward) {
    const keptMutations = JSON.parse(JSON.stringify(gameState.mutations));
    const accumulatedDna = gameState.dna + dnaReward;

    const freshState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
    setGameState(freshState);
    gameState.mutations = keptMutations;
    gameState.dna = accumulatedDna;
    gameState.wave = 1;
    gameState.waveProgress = 0;
    
    isReloading.value = false;
    reloadTimer.value = 0;

    resetField();
    if (systemHooks.initBgCanvas && canvas) systemHooks.initBgCanvas(canvas.width, canvas.height);
    
    saveGameData(true);
    if (systemHooks.renderShop) systemHooks.renderShop();
    if (systemHooks.dispatchDOMUpdates) systemHooks.dispatchDOMUpdates();
    
    spawnExplosion(180, 180, '#10b981', 30);
    if (systemHooks.showModal) {
        systemHooks.showModal('Giải Cứu Thành Công!', 'Trực thăng mẫu thí nghiệm đã hạ cánh an toàn xuống Tổng cục Chỉ Huy. DNA thu hoạch đã được gửi vào phòng nghiên cứu.');
    }
}

// Wave Finished checks
export function checkWaveFinished() {
    const activeZombies = zombies.filter(z => z && z.active && z.hp > 0);
    if (activeZombies.length === 0) {
        const maxZombiesThisWave = 10 + (gameState.wave * 5);
        if (gameState.waveProgress >= maxZombiesThisWave) {
            gameState.wave++;
            gameState.waveProgress = 0;
            
            saveGameData();

            playUpgradeChime();
            const ft = getAvailableText();
            if (ft) {
                ft.spawn(canvas.width / 2, 60, `WAVE ${gameState.wave} BẮT ĐẦU!`, '#f59e0b', 18, true);
            }
            if (systemHooks.dispatchDOMUpdates) systemHooks.dispatchDOMUpdates();
            
            const baseBonus = Math.round(100 * Math.pow(1.16, gameState.wave - 2));
            gameState.gold += baseBonus; // Direct update or addGold
            
            const bt = getAvailableText();
            if (bt) {
                bt.spawn(100, 80, `Thưởng dọn wave: +🪙${baseBonus}`, '#facc15', 12);
            }
            saveGameData();
        }
    }
}

// Main game logic tick update
export function updateGame(dt) {
    const logicalWidth = canvas.width;
    const barricadeY = canvas.height - 160;

    domUpdateTimer.value += dt;
    if (domUpdateTimer.value >= DOM_UPDATE_INTERVAL) {
        domUpdateTimer.value = 0;
        if (systemHooks.dispatchDOMUpdates) systemHooks.dispatchDOMUpdates();
    }

    // Cooldown trackers
    if (skillsCooldown.airstrike > 0) {
        skillsCooldown.airstrike = Math.max(0, skillsCooldown.airstrike - dt);
        if (systemHooks.updateActiveSkillCooldownUI) systemHooks.updateActiveSkillCooldownUI('airstrike');
    }
    if (skillsCooldown.overclock > 0) {
        skillsCooldown.overclock = Math.max(0, skillsCooldown.overclock - dt);
        if (systemHooks.updateActiveSkillCooldownUI) systemHooks.updateActiveSkillCooldownUI('overclock');
    }
    if (activeSkillsDuration.overclock > 0) {
        activeSkillsDuration.overclock = Math.max(0, activeSkillsDuration.overclock - dt);
        if (activeSkillsDuration.overclock <= 0) {
            const overclockBtn = document.getElementById('skill-overclock-sidebar');
            if (overclockBtn) overclockBtn.classList.remove('bg-orange-500/40');
        }
    }

    // Reload timer
    if (isReloading.value) {
        reloadTimer.value -= dt;
        if (reloadTimer.value <= 0) {
            isReloading.value = false;
            const activeWep = gameState.weapons[gameState.activeWeaponIndex];
            if (activeWep) {
                activeWep.currentClip = activeWep.clipSize;
            }
            saveGameData();
        }
    }

    // Recoil and Shake decays
    player.recoil = Math.max(0, player.recoil - dt * 45);
    player.recoilSpread = Math.max(0, player.recoilSpread - dt * 0.9);
    if (player.flashTimer > 0) {
        player.flashTimer -= dt;
    }
    if (shakeTime.value > 0) {
        shakeTime.value = Math.max(0, shakeTime.value - dt);
    }

    const target = getPrioritizedZombie();
    
    // Player movement and aiming
    if (!gameState.isDefeated) {
        if (gameState.autoFire) {
            // Automatic movement and aiming mode (Idle Mode)
            if (target) {
                player.targetX = target.x;
                player.angle = Math.atan2(target.y - player.y, target.x - player.x);
                
                // Calculate screenAngle for visual drawing to point exactly at target on screen
                const playerPt = project3D(player.x, player.y, 10);
                const targetPt = project3D(target.x, target.y, 0);
                player.screenAngle = Math.atan2(targetPt.y - playerPt.y, targetPt.x - playerPt.x);
                
                const dx = player.targetX - player.x;
                if (Math.abs(dx) > 4) {
                    const step = Math.sign(dx) * player.speed * dt;
                    player.x += Math.abs(dx) < Math.abs(step) ? dx : step;
                    player.walkCycle += dt * 12;
                } else {
                    player.walkCycle = 0;
                }
                
                const minPlayerX = canvas.width * 0.10;
                const maxPlayerX = canvas.width * 0.90;
                player.x = Math.max(minPlayerX, Math.min(maxPlayerX, player.x));
                
                // Keep player at default Y position in auto mode
                player.y = barricadeY + 30;
            } else {
                player.targetX = canvas.width / 2;
                const dx = player.targetX - player.x;
                if (Math.abs(dx) > 2) {
                    player.x += dx * 0.05;
                    player.walkCycle += dt * 4;
                } else {
                    player.walkCycle = 0;
                }
                player.angle = player.angle * 0.95 + (-Math.PI / 2) * 0.05;
                player.screenAngle = player.screenAngle * 0.95 + (-Math.PI / 2) * 0.05;
                player.y = barricadeY + 30;
            }
        } else {
            // Manual movement (WASD) and mouse aiming mode
            let moveX = 0;
            let moveY = 0;
            if (keysPressed.KeyA) moveX -= 1;
            if (keysPressed.KeyD) moveX += 1;
            if (keysPressed.KeyW) moveY -= 1;
            if (keysPressed.KeyS) moveY += 1;

            if (moveX !== 0 || moveY !== 0) {
                // Normalize diagonal movement speed
                let speedMultiplier = 1.0;
                if (moveX !== 0 && moveY !== 0) {
                    speedMultiplier = 0.7071;
                }
                player.x += moveX * player.speed * speedMultiplier * dt;
                player.y += moveY * player.speed * speedMultiplier * dt;
                player.walkCycle += dt * 12;
            } else {
                player.walkCycle = 0;
            }

            // Clamp player within defense zone
            const minPlayerX = canvas.width * 0.10;
            const maxPlayerX = canvas.width * 0.90;
            const minPlayerY = barricadeY + 20;
            const maxPlayerY = canvas.height - 20;

            player.x = Math.max(minPlayerX, Math.min(maxPlayerX, player.x));
            player.y = Math.max(minPlayerY, Math.min(maxPlayerY, player.y));

            // Aim towards cursor position
            // Unproject mouse screen coordinates to world coordinates for bullet angle
            const worldMouse = unproject3D(mousePosition.x, mousePosition.y);
            player.angle = Math.atan2(worldMouse.y - player.y, worldMouse.x - player.x);

            // Calculate screenAngle for visual drawing to point exactly at mouse on screen
            const playerPt = project3D(player.x, player.y, 10);
            player.screenAngle = Math.atan2(mousePosition.y - playerPt.y, mousePosition.x - playerPt.x);
        }

        // Fire rate interval handling
        mainWeaponShootTimer.value += dt;
        const activeWep = gameState.weapons[gameState.activeWeaponIndex];
        let shootSpeedInterval = 0.5;
        
        if (activeWep) {
            switch(activeWep.id) {
                case 'pistol': shootSpeedInterval = 0.42; break;
                case 'smg': shootSpeedInterval = 0.08; break;
                case 'shotgun': shootSpeedInterval = 1.15; break;
                case 'rifle': shootSpeedInterval = 0.15; break;
                case 'flame': shootSpeedInterval = 0.05; break;
                case 'plasma': shootSpeedInterval = 0.85; break;
                case 'freeze': shootSpeedInterval = 0.55; break;
                case 'gatling': shootSpeedInterval = 0.04; break;
                case 'tesla': shootSpeedInterval = 0.15; break;
                case 'nuclear': shootSpeedInterval = 2.4; break;
            }
        }
        
        const currentSpeed = activeSkillsDuration.overclock > 0 ? (shootSpeedInterval * 0.35) : shootSpeedInterval;
        
        if (gameState.autoFire) {
            // Auto-fire mode: Shoot automatically when ready
            if (mainWeaponShootTimer.value >= currentSpeed) {
                mainWeaponShootTimer.value = 0;
                triggerAutomaticFire();
            }
        } else {
            // Manual mode: Autofire for automatic weapons, manual click for others
            const isAutoWeapon = activeWep && ['smg', 'rifle', 'flame', 'gatling', 'tesla'].includes(activeWep.id);
            if (isMouseDown.value && isAutoWeapon) {
                if (mainWeaponShootTimer.value >= currentSpeed) {
                    mainWeaponShootTimer.value = 0;
                    triggerAutomaticFire(player.angle);
                }
            }
        }
    }

    if (gameState.isDefeated) {
        baseRepairTimer.value -= dt;
        const ratio = Math.max(0, (REPAIR_TIME_MAX - baseRepairTimer.value) / REPAIR_TIME_MAX);
        const repBar = document.getElementById('repair-progress-bar');
        const repPct = document.getElementById('repair-percent');
        if (repBar) repBar.style.width = `${ratio * 100}%`;
        if (repPct) repPct.innerText = `${Math.round(ratio * 100)}%`;

        if (baseRepairTimer.value <= 0) {
            gameState.isDefeated = false;
            const shieldDnaMod = 1 + (gameState.mutations.dnaWallShield.level * gameState.mutations.dnaWallShield.mult);
            gameState.wallHp = Math.round(gameState.wallMaxHp * shieldDnaMod);
            gameState.waveProgress = 0; 
            const defeatOverlay = document.getElementById('defeat-overlay');
            if (defeatOverlay) {
                defeatOverlay.classList.add('hidden');
                defeatOverlay.classList.remove('flex');
            }
            
            if (gameState.wave > 1) {
                gameState.wave = Math.max(1, gameState.wave - 2); 
            }
            saveGameData();
        }
        return; 
    }

    // Autosave
    autosaveTimer.value += dt;
    if (autosaveTimer.value >= 60) {
        autosaveTimer.value = 0;
        saveGameData(true);
        const t = getAvailableText();
        if (t) {
            t.spawn(canvas.width - 80, 25, "AUTOSAVE", "#10b981", 9, false);
        }
    }

    // Spawning waves
    waveTimer.value += dt;
    const spawnRate = Math.max(0.25, 2.5 - (gameState.wave * 0.1)); 
    const maxZombiesThisWave = 10 + (gameState.wave * 5);
    
    if (waveTimer.value >= spawnRate && gameState.waveProgress < maxZombiesThisWave) {
        waveTimer.value = 0;
        
        const activeZombies = zombies.filter(z => z && z.active && z.hp > 0).length;
        
        if (activeZombies < MAX_CONCURRENT_ZOMBIES) {
            const minGroup = Math.max(1, Math.min(8, Math.floor(gameState.wave / 4)));
            const maxGroup = Math.max(2, Math.min(16, 2 + Math.floor(gameState.wave / 2)));
            const groupSize = Math.min(
                Math.floor(Math.random() * (maxGroup - minGroup + 1)) + minGroup, 
                maxZombiesThisWave - gameState.waveProgress
            );
            
            for (let g = 0; g < groupSize; g++) {
                gameState.waveProgress++;
                const isBoss = (gameState.waveProgress === maxZombiesThisWave);
                zombies.push(new Zombie(gameState.wave, isBoss, g));
                
                if (isBoss && systemHooks.triggerBossWarning) {
                    systemHooks.triggerBossWarning();
                }
            }
        } else {
            const buffZombie = zombies.find(z => z && z.active && z.hp > 0);
            if (buffZombie) {
                buffZombie.maxHp = Math.round(buffZombie.maxHp * 1.8);
                buffZombie.hp = Math.round(buffZombie.hp * 1.8);
                buffZombie.goldReward = Math.round(buffZombie.goldReward * 1.6);
            }
            gameState.waveProgress++;
        }
    }

    // Supply drops
    if (!gameState.isDefeated && Math.random() < 0.0006) {
        const dropX = logicalWidth * 0.3 + Math.random() * (logicalWidth * 0.55);
        const dropTargetY = canvas.height * 0.35 + Math.random() * (canvas.height * 0.45);
        airDrops.push(new AirDrop(dropX, dropTargetY));
    }

    // Passive medic healing
    if (gameState.wallHp < gameState.wallMaxHp) {
        const medicMerc = gameState.mercenaries.find(m => m.id === 'merc_medic');
        const medicHired = medicMerc && medicMerc.hired;
        
        let medicRegen = 0;
        if (medicHired) {
            const healScale = Math.pow(1.15, medicMerc.level - 1);
            medicRegen = medicMerc.wallRegenInc * medicMerc.level * healScale;

            const hiredPowerLvl = gameState.mutations.dnaHiredPower ? gameState.mutations.dnaHiredPower.level : 0;
            const hiredPowerMod = 1 + (hiredPowerLvl * (gameState.mutations.dnaHiredPower ? gameState.mutations.dnaHiredPower.mult : 0.25));
            medicRegen *= hiredPowerMod;
        }

        const totalRegen = gameState.wallRegen + medicRegen;

        if (totalRegen > 0) {
            const shieldDnaMod = 1 + (gameState.mutations.dnaWallShield.level * gameState.mutations.dnaWallShield.mult);
            const maxHp = Math.round(gameState.wallMaxHp * shieldDnaMod);
            gameState.wallHp = Math.min(maxHp, gameState.wallHp + totalRegen * dt);
        }
    }

    // Scavengers passive gold income
    if (gameState.statUpgrades.passiveScavenge > 0) {
        const incomeTick = gameState.statUpgrades.passiveScavenge * 3 * dt;
        gameState.gold += incomeTick;
    }

    // Entity updates
    const zombieCount = zombies.length;
    let activeCount = 0;
    for (let i = zombieCount - 1; i >= 0; i--) {
        const z = zombies[i];
        if (z && z.active) {
            z.update(dt, barricadeY);
            activeCount++;
        } else {
            zombies.splice(i, 1);
        }
    }
    const zCounter = document.getElementById('zombie-counter');
    if (zCounter) zCounter.innerText = activeCount;

    // Airstrike planes
    for (let i = activeBomberPlanes.length - 1; i >= 0; i--) {
        const plane = activeBomberPlanes[i];
        plane.x += plane.speed * dt * 60;
        
        plane.dropPositions.forEach((posX, idx) => {
            if (plane.x >= posX && !plane.droppedFlags[idx]) {
                plane.droppedFlags[idx] = true;
                
                const targetY = canvas.height * 0.30 + Math.random() * (canvas.height * 0.50);
                activeAirstrikeBombs.push({
                    x: plane.x,
                    y: plane.y,
                    startY: plane.y,
                    vx: plane.speed * 0.35, 
                    vy: 1.0, 
                    targetY: targetY,
                    angle: 0
                });
            }
        });
        
        if (plane.x > canvas.width + 150) {
            activeBomberPlanes.splice(i, 1);
        }
    }

    // Airstrike bombs
    for (let i = activeAirstrikeBombs.length - 1; i >= 0; i--) {
        const bomb = activeAirstrikeBombs[i];
        bomb.vy += 0.28 * dt * 60;
        bomb.x += bomb.vx * dt * 60;
        bomb.y += bomb.vy * dt * 60;
        bomb.angle = Math.atan2(bomb.vy, bomb.vx);
        
        if (bomb.y >= bomb.targetY) {
            spawnExplosion(bomb.x, bomb.targetY, '#ef4444', 24);
            shakeTime.value = 0.45;
            playExplosionSound(0.28);
            
            let anyDead = false;
            zombies.forEach(z => {
                if (z && z.active && z.hp > 0) {
                    const dx = z.x - bomb.x;
                    const dy = z.y - bomb.targetY;
                    const distSq = dx*dx + dy*dy;
                    if (distSq < 90 * 90) { 
                        const activeWep = gameState.weapons[gameState.activeWeaponIndex];
                        const dmg = Math.round((activeWep ? getWeaponDamage(activeWep) : 18) * 30.0);
                        const blastAngle = Math.atan2(dy, dx);
                        const pushForce = 32.0;
                        if (z.damageTake(dmg, true, pushForce, blastAngle)) {
                            anyDead = true;
                        }
                    }
                }
            });
            if (anyDead) {
                checkWaveFinished();
            }
            activeAirstrikeBombs.splice(i, 1);
        }
    }

    // Air drops
    for (let i = airDrops.length - 1; i >= 0; i--) {
        const drop = airDrops[i];
        if (drop && drop.active) {
            drop.update(dt);
        } else {
            if (drop) drop.destroyGraphics();
            airDrops.splice(i, 1);
        }
    }

    // Mercenaries logic
    gameState.mercenaries.forEach(m => {
        if (m && m.hired) {
            updateMercenary(m, dt);
        }
    });

    // Bullets movement
    bulletPool.forEach(b => {
        if (b.active) b.update(dt);
    });

    // Particles decay
    particlePool.forEach(p => {
        if (p.active) p.update(dt);
    });

    // Flashes decay
    activeFlashes.forEach(f => f.life -= dt);
    const livingFlashes = activeFlashes.filter(f => f.life > 0);
    setActiveFlashes(livingFlashes);

    // Floating text update
    textPool.forEach(ft => {
        if (ft.active) ft.update(dt);
    });

    // Collisions matrixes
    bulletPool.forEach(b => {
        if (!b.active) return;
        
        for (let j = 0; j < zombies.length; j++) {
            const z = zombies[j];
            if (!z || !z.active || z.hp <= 0) continue;
            
            const dist = distToSegmentSquared(
                { x: z.x, y: z.y },
                { x: b.prevX, y: b.prevY },
                { x: b.x, y: b.y }
            );
            
            const colRadius = b.isFlame ? b.size : 3;
            const radiiSum = z.radius + colRadius;

            if (dist < radiiSum * radiiSum) {
                let anyDead = false;
                
                if (b.isFlame || b.isPlasma) {
                    if (b.hitZombies.includes(z.id)) {
                        continue;
                    }
                    b.hitZombies.push(z.id);
                }

                const bulletAngle = Math.atan2(b.vy, b.vx);
                if (z.damageTake(b.damage, b.isCrit, b.knockback, bulletAngle)) {
                    anyDead = true;
                }
                
                if (b.isNuclear) {
                    b.explode();
                } else if (!b.isFlame && !b.isPlasma) {
                    b.active = false; 
                }

                if (b.isFreeze) {
                    z.isFrozen = true;
                    z.freezeTimer = 4.0;
                    
                    for (let s = 0; s < 6; s++) {
                        const sp = getAvailableParticle();
                        if (sp) {
                            const angle = Math.random() * Math.PI * 2;
                            const speed = Math.random() * 2 + 1.2;
                            sp.spawn(z.x, z.y, Math.cos(angle)*speed, Math.sin(angle)*speed, '#38bdf8', 1.8, 0.6, 0.05);
                        }
                    }
                }

                if (b.isFlame) {
                    z.isBurning = true;
                    z.burnTimer = 3.5;
                    z.burnDamage = Math.max(1, Math.round(b.damage * 0.35));
                }

                if (b.isTesla) {
                    let chainsCount = 0;
                    for (let k = 0; k < zombies.length; k++) {
                        const nearZ = zombies[k];
                        if (nearZ && nearZ.active && nearZ.hp > 0 && nearZ !== z) {
                            const nDx = nearZ.x - z.x;
                            const nDy = nearZ.y - z.y;
                            const nDist = nDx*nDx + nDy*nDy;
                            if (nDist < 22500) { 
                                const teslaAngle = Math.atan2(nDy, nDx);
                                if (nearZ.damageTake(Math.round(b.damage * 0.6), false, b.knockback * 0.5, teslaAngle)) {
                                    anyDead = true;
                                }
                                for(let s=0; s<4; s++) {
                                    const sp = getAvailableParticle();
                                    if(sp) sp.spawn(nearZ.x, nearZ.y, (Math.random()-0.5)*3, (Math.random()-0.5)*3, '#22d3ee', 1.5, 0.4, 0);
                                }
                                chainsCount++;
                                if (chainsCount >= 3) break;
                            }
                        }
                    }
                }

                if (b.isNuclear) {
                    spawnExplosion(b.x, b.y, '#22c55e', 45);
                    shakeTime.value = 0.4;
                    playExplosionSound();
                    zombies.forEach(nz => {
                        if (nz && nz.active && nz.hp > 0) {
                            const nzDx = nz.x - b.x;
                            const nzDy = nz.y - b.y;
                            const nzDist = nzDx*nzDx + nzDy*nzDy;
                            if (nzDist < 25600) { 
                                const blastAngle = Math.atan2(nzDy, nzDx);
                                if (nz.damageTake(Math.round(b.damage * 0.8), false, 35.0, blastAngle)) {
                                    anyDead = true;
                                }
                            }
                        }
                    });
                }

                if (anyDead) {
                    checkWaveFinished();
                }
                
                if (!b.isFlame) {
                    break;
                }
            }
        }
    });

    dayNightCycle.value += dt * 0.04;

    if (zombies.length === 0 && !gameState.isDefeated) {
        checkWaveFinished();
    }
}
