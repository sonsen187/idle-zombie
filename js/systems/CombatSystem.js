import { INITIAL_GAME_STATE, REPAIR_TIME_MAX } from '../constants.js';
import { 
    gameState, player, activeFlashes, canvas, isReloading, reloadTimer, 
    shakeTime, skillsCooldown, activeSkillsDuration, activeBomberPlanes, 
    activeAirstrikeBombs, zombies, bulletPool, airDrops, setZombies, 
    setActiveBomberPlanes, setActiveAirstrikeBombs, baseRepairTimer, mousePosition
} from '../state.js';
import { 
    playReloadSound, playShootSound, playDefeatDrone, initAudioEngine 
} from '../audio.js';
import { 
    getPrioritizedZombie, getAvailableBullet, getAvailableParticle, spawnExplosion 
} from '../entities.js';
import { saveGameData } from './SaveSystem.js';
import { checkWaveFinished } from './WaveSystem.js';
import { unproject3D } from '../helpers.js';
import { systemHooks } from './hooks.js';

// Weapon helper calculation functions
export function getWeaponDamage(w) {
    if (w.level === 0) return 0;
    const scaleFactor = Math.pow(1.18 + (w.level * 0.002), w.level - 1);
    return Math.round(w.baseDamage * scaleFactor);
}

export function getWeaponNextDamage(w) {
    const nextLvl = w.level + 1;
    const scaleFactor = Math.pow(1.18 + (nextLvl * 0.002), nextLvl - 1);
    return Math.round(w.baseDamage * scaleFactor);
}

export function getWeaponUpgradeCost(w) {
    if (!w.unlocked || w.level === 0) {
        return w.baseCost;
    }
    return Math.round(w.baseCost * 0.4 * Math.pow(1.25, w.level - 1));
}

export function getReloadTimeModifier() {
    const dnaReloadLvl = gameState.mutations.dnaReloadSpeed ? gameState.mutations.dnaReloadSpeed.level : 0;
    const mult = gameState.mutations.dnaReloadSpeed ? gameState.mutations.dnaReloadSpeed.mult : 0.07;
    return Math.max(0.2, 1 - (dnaReloadLvl * mult));
}

export function getAirstrikeCooldown() {
    const dnaAirLvl = gameState.mutations.dnaAirstrikeCo ? gameState.mutations.dnaAirstrikeCo.level : 0;
    return Math.max(4, 20 * (1 - (dnaAirLvl * 0.08)));
}

export function getCritChance() {
    const dnaCritLvl = gameState.mutations.dnaCritRate ? gameState.mutations.dnaCritRate.level : 0;
    const dnaCritMod = dnaCritLvl * 0.03;
    return 0.05 + (gameState.statUpgrades.critChance * 0.015) + dnaCritMod; 
}

export function getCritMultiplier() {
    return 1.5 + (gameState.statUpgrades.critMultiplier * 0.1); 
}

export function addGold(amount) {
    gameState.gold += amount;
}

export function getActiveWeaponRange(weaponId) {
    switch (weaponId) {
        case 'flame': return 320;
        case 'shotgun': return 400;
        case 'tesla': return 500;
        case 'freeze': return 600;
        case 'pistol': return 700;
        case 'smg': return 800;
        case 'gatling': return 950;
        case 'plasma': return 1000;
        case 'rifle': return 1200;
        case 'nuclear': return 1300;
        default: return 800;
    }
}

export function getMercenaryRange(mercId) {
    switch (mercId) {
        case 'merc_recruit': return 700;
        case 'merc_sniper': return 1400;
        case 'merc_gunner': return 950;
        case 'merc_drone': return 900;
        default: return 700;
    }
}

export function getMercenaryWeaponId(mercId) {
    switch (mercId) {
        case 'merc_recruit': return 'smg';
        case 'merc_sniper': return 'rifle';
        case 'merc_gunner': return 'gatling';
        case 'merc_medic': return 'pistol';
        case 'merc_drone': return 'plasma';
        default: return 'pistol';
    }
}

export function getWeaponDamageForMerc(w) {
    const lvl = Math.max(1, w.level);
    const scaleFactor = Math.pow(1.18 + (lvl * 0.002), lvl - 1);
    return Math.round(w.baseDamage * scaleFactor);
}

function spawnMuzzleSparks(x, y, angle, wepId) {
    let count = 4;
    let color = '#facc15'; // default yellow spark
    let spread = 0.4;
    let speedBase = 6;
    
    if (wepId === 'shotgun') {
        count = 12;
        spread = 0.65;
        speedBase = 8;
    } else if (wepId === 'plasma') {
        count = 6;
        color = '#22d3ee'; // Cyan plasma spark
        spread = 0.5;
        speedBase = 7;
    } else if (wepId === 'tesla') {
        count = 5;
        color = '#06b6d4'; // Cyan/Blue electric spark
        spread = 0.8;
        speedBase = 5;
    } else if (wepId === 'flame') {
        count = 2;
        color = '#f97316'; // Flame spark
        spread = 0.3;
        speedBase = 4;
    } else if (wepId === 'nuclear') {
        count = 15;
        color = '#4ade80'; // Green nuclear sparks
        spread = 0.7;
        speedBase = 10;
    } else if (wepId === 'freeze') {
        count = 5;
        color = '#38bdf8'; // Blue freeze spark
        spread = 0.5;
        speedBase = 6;
    }
    
    for (let i = 0; i < count; i++) {
        const p = getAvailableParticle();
        if (p) {
            const a = angle + (Math.random() - 0.5) * spread;
            const speed = Math.random() * speedBase + (speedBase * 0.4);
            p.spawn(
                x, 
                y, 
                Math.cos(a) * speed, 
                Math.sin(a) * speed, 
                color, 
                Math.random() * 2.2 + 1.0, 
                Math.random() * 0.22 + 0.12, 
                0.0, 
                'spark'
            );
        }
    }
}

export function triggerAutomaticFire(manualAngle = null) {
    if (gameState.isDefeated || isReloading.value) return;
    initAudioEngine();
    
    const activeWep = gameState.weapons[gameState.activeWeaponIndex];
    if (!activeWep) return;
    
    const range = getActiveWeaponRange(activeWep.id);
    let target = null;
    let baseAngle = 0;

    // 1. Calculate aiming angle based on player center
    if (manualAngle !== null) {
        baseAngle = manualAngle;
    } else {
        target = getPrioritizedZombie(player.x, player.y - 4, range);
        if (!target) return;
        baseAngle = Math.atan2(target.y - (player.y - 4), target.x - player.x);
    }

    // 2. Compute exact starting coordinates at the muzzle (barrel tip)
    let gunH = 12, barrelExt = 5;
    switch (activeWep.id) {
        case 'pistol':   gunH = 8;  barrelExt = 5;  break;
        case 'smg':      gunH = 13; barrelExt = 4;  break;
        case 'shotgun':  gunH = 15; barrelExt = 5;  break;
        case 'rifle':    gunH = 18; barrelExt = 6;  break;
        case 'flame':    gunH = 12; barrelExt = 4;  break;
        case 'plasma':   gunH = 16; barrelExt = 5;  break;
        case 'freeze':   gunH = 14; barrelExt = 5;  break;
        case 'gatling':  gunH = 18; barrelExt = 8;  break;
        case 'tesla':    gunH = 17; barrelExt = 6;  break;
        case 'nuclear':  gunH = 20; barrelExt = 7;  break;
    }
    const gunLength = 10 + gunH + barrelExt;
    const startX = player.x + Math.cos(baseAngle) * gunLength;
    const startY = player.y - 4 + Math.sin(baseAngle) * gunLength;

    // 3. Recalculate precise angle from muzzle to mouse for manual firing
    if (manualAngle !== null) {
        const worldMouse = unproject3D(mousePosition.x, mousePosition.y);
        baseAngle = Math.atan2(worldMouse.y - startY, worldMouse.x - startX);
    }
    
    if (activeWep.currentClip === undefined) {
        const defaultWep = INITIAL_GAME_STATE.weapons.find(w => w.id === activeWep.id);
        activeWep.clipSize = defaultWep.clipSize;
        activeWep.currentClip = defaultWep.clipSize;
        activeWep.reloadTime = defaultWep.reloadTime;
    }

    if (activeWep.currentClip <= 0) {
        isReloading.value = true;
        reloadTimer.value = activeWep.reloadTime * getReloadTimeModifier();
        playReloadSound();
        return;
    }

    activeWep.currentClip--;
    
    let recoilAmt = 4.0;
    let fireShake = 0;
    switch (activeWep.id) {
        case 'pistol': recoilAmt = 2.8; fireShake = 0; break;
        case 'smg': recoilAmt = 1.5; fireShake = 0; break;
        case 'shotgun': recoilAmt = 16.0; fireShake = 0.12; break;
        case 'rifle': recoilAmt = 4.0; fireShake = 0.03; break;
        case 'flame': recoilAmt = 0.15; fireShake = 0; break;
        case 'plasma': recoilAmt = 8.0; fireShake = 0.07; break;
        case 'freeze': recoilAmt = 2.5; fireShake = 0; break;
        case 'gatling': recoilAmt = 1.8; fireShake = 0.015; break;
        case 'tesla': recoilAmt = 0.8; fireShake = 0; break;
        case 'nuclear': recoilAmt = 25.0; fireShake = 0.35; break;
    }
    player.recoil = recoilAmt;
    player.flashTimer = 0.05;
    if (fireShake > 0) {
        shakeTime.value = Math.max(shakeTime.value, fireShake);
    }
    
    const isCrit = Math.random() < getCritChance();
    const dmgScaleMod = 1 + (gameState.mutations.dnaDamageMult.level * gameState.mutations.dnaDamageMult.mult);
    const finalDamage = Math.round(getWeaponDamage(activeWep) * (isCrit ? getCritMultiplier() : 1.0) * dmgScaleMod);
    
    playShootSound(activeWep.id);
    
    let baseSpread = 0.01;
    let spreadPerShot = 0.015;
    let maxSpread = 0.15;
    
    switch (activeWep.id) {
        case 'pistol': baseSpread = 0.015; spreadPerShot = 0.04; maxSpread = 0.08; break;
        case 'smg': baseSpread = 0.035; spreadPerShot = 0.06; maxSpread = 0.20; break;
        case 'shotgun': baseSpread = 0.06; spreadPerShot = 0.10; maxSpread = 0.20; break;
        case 'rifle': baseSpread = 0.01; spreadPerShot = 0.07; maxSpread = 0.14; break;
        case 'flame': baseSpread = 0.12; spreadPerShot = 0.01; maxSpread = 0.26; break;
        case 'plasma': baseSpread = 0.005; spreadPerShot = 0.08; maxSpread = 0.12; break;
        case 'freeze': baseSpread = 0.018; spreadPerShot = 0.05; maxSpread = 0.10; break;
        case 'gatling': baseSpread = 0.045; spreadPerShot = 0.05; maxSpread = 0.24; break;
        case 'tesla': baseSpread = 0.02; spreadPerShot = 0.02; maxSpread = 0.08; break;
        case 'nuclear': baseSpread = 0.00; spreadPerShot = 0.12; maxSpread = 0.20; break;
    }

    player.recoilSpread = Math.min(maxSpread, player.recoilSpread + spreadPerShot);

    const currentTotalSpread = baseSpread + player.recoilSpread;
    const spreadOffset = (Math.random() - 0.5) * currentTotalSpread;
    const angle = baseAngle + spreadOffset;

    if (activeWep.id === 'shotgun') {
        const pelletCount = 15;
        const damagePerPellet = Math.max(1, Math.round(finalDamage / pelletCount));
        
        for (let i = 0; i < pelletCount; i++) {
            const randomOffset = (Math.random() - 0.5) * (0.15 + player.recoilSpread);
            const pelletAngle = baseAngle + randomOffset;
            const b = getAvailableBullet();
            if (b) {
                const speed = 32 + Math.random() * 6;
                b.spawn(startX, startY, 0, 0, damagePerPellet, isCrit, speed, false, true, 1, pelletAngle, false, false, false, false, false, range);
            }
        }
    } else if (activeWep.id === 'flame') {
        const flameSpread = (Math.random() - 0.5) * (0.26 + player.recoilSpread);
        const flameAngle = baseAngle + flameSpread;
        const b = getAvailableBullet();
        if (b) {
            b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 12, false, false, 1, flameAngle, false, false, false, true, false, range);
            b.life = 0.35;
        }
    } else if (activeWep.id === 'freeze') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 18, false, false, 1, angle, false, false, false, false, true, range);
    } else if (activeWep.id === 'plasma') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 34, true, false, 1, angle, false, false, false, false, false, range);
    } else if (activeWep.id === 'gatling') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 48, false, false, 1, angle, true, false, false, false, false, range);
    } else if (activeWep.id === 'tesla') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 55, false, false, 1, angle, false, true, false, false, false, range);
    } else if (activeWep.id === 'nuclear') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 10, false, false, 1, angle, false, false, true, false, false, range);
    } else if (activeWep.id === 'rifle') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 52, false, false, 1, angle, false, false, false, false, false, range);
    } else if (activeWep.id === 'smg') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 42, false, false, 1, angle, false, false, false, false, false, range);
    } else if (activeWep.id === 'pistol') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 38, false, false, 1, angle, false, false, false, false, false, range);
    } else {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 38, false, false, 1, angle, false, false, false, false, false, range);
    }
    
    activeFlashes.push({ x: startX, y: startY, life: 0.05 });
    spawnMuzzleSparks(startX, startY, baseAngle, activeWep.id);
    
    if (activeWep.id !== 'flame' && activeWep.id !== 'plasma' && activeWep.id !== 'tesla') {
        const p = getAvailableParticle();
        if (p) {
            const shellAngle = player.angle - Math.PI/2 - (Math.random() * 0.4);
            p.spawn(startX - 10, startY, Math.cos(shellAngle) * 2.2, Math.sin(shellAngle) * 1.5, '#eab308', 1.8, 1.5, 0.28, 'shell', 12, 3.5 + Math.random()*2.0);
        }
    }
}

export function triggerAirstrike() {
    if (skillsCooldown.airstrike > 0 || gameState.isDefeated) return;
    initAudioEngine();
    
    skillsCooldown.airstrike = getAirstrikeCooldown(); 
    
    const logicalHeight = canvas.height;
    activeBomberPlanes.push({
        x: -120,
        y: logicalHeight * 0.08,
        speed: 12.0,
        dropPositions: [120, 185, 250, 315, 380, 445],
        droppedFlags: [false, false, false, false, false, false]
    });
}

export function triggerOverclock() {
    if (skillsCooldown.overclock > 0 || gameState.isDefeated) return;
    initAudioEngine();
    
    skillsCooldown.overclock = 15;
    activeSkillsDuration.overclock = 6;
    
    const overclockBtn = document.getElementById('skill-overclock-sidebar');
    if (overclockBtn) overclockBtn.classList.add('bg-orange-500/40');
}

export function updateMercenary(m, dt) {
    // Ensure position is initialized dynamically
    if (m.x === undefined) {
        const barricadeY = canvas.clientHeight - 160;
        m.y = barricadeY + 30;
        if (m.id === 'merc_recruit') m.x = canvas.clientWidth * 0.20;
        else if (m.id === 'merc_sniper') m.x = canvas.clientWidth * 0.35;
        else if (m.id === 'merc_gunner') m.x = canvas.clientWidth * 0.65;
        else if (m.id === 'merc_medic') m.x = canvas.clientWidth * 0.80;
        else if (m.id === 'merc_drone') m.x = canvas.clientWidth * 0.92;
        else m.x = canvas.clientWidth * 0.5;
        
        m.angle = -Math.PI / 2;
        m.screenAngle = -Math.PI / 2;
        m.walkCycle = 0;
        m.speed = 110;
        m.targetX = m.x;
        m.flashTimer = 0;
        m.recoil = 0;
        m.currentClip = 12;
        m.isReloading = false;
        m.reloadTimer = 0;
        m.lastWeaponId = 'pistol';
        m.patrolTargetX = null;
    }

    const mercWepId = getMercenaryWeaponId(m.id);
    const mercWep = gameState.weapons.find(w => w.id === mercWepId);
    if (!mercWep) return;

    if (m.currentClip === undefined || m.lastWeaponId !== mercWepId) {
        m.lastWeaponId = mercWepId;
        m.currentClip = mercWep.clipSize;
        m.isReloading = false;
        m.reloadTimer = 0;
    }

    if (m.isReloading) {
        m.reloadTimer -= dt;
        if (m.reloadTimer <= 0) {
            m.isReloading = false;
            m.currentClip = mercWep.clipSize;
        }
    }

    if (m.flashTimer > 0) {
        m.flashTimer -= dt;
    }
    m.recoil = Math.max(0, (m.recoil || 0) - dt * 45);

    // Range is mercenary-specific
    const range = getMercenaryRange(m.id);
    const target = getPrioritizedZombie(m.x, m.y, range);
    
    if (m.id === 'merc_drone') {
        const homeX = canvas.clientWidth * 0.92;
        if (target) {
            m.targetX = target.x;
        } else {
            // Hover patrol: gentle sine wave movement around homeX
            m.targetX = homeX + Math.sin(Date.now() * 0.001) * 60;
        }
        m.targetX = Math.max(canvas.clientWidth * 0.60, Math.min(canvas.clientWidth * 0.96, m.targetX));
        
        const dx = m.targetX - m.x;
        if (Math.abs(dx) > 1) {
            m.x += dx * 0.04 * (dt * 60);
        }
        if (target) {
            m.angle = Math.atan2(target.y - m.y, target.x - m.x);
        } else {
            m.angle = m.angle * 0.95 + (-Math.PI / 2) * 0.05;
        }
    } else {
        // Human mercenaries (Jack, Sniper, Gunner, Medic)
        let homeX = canvas.clientWidth * 0.5;
        if (m.id === 'merc_recruit') homeX = canvas.clientWidth * 0.20;
        else if (m.id === 'merc_sniper') homeX = canvas.clientWidth * 0.35;
        else if (m.id === 'merc_gunner') homeX = canvas.clientWidth * 0.65;
        else if (m.id === 'merc_medic') homeX = canvas.clientWidth * 0.80;
        
        if (target) {
            m.patrolTargetX = null;
            m.targetX = target.x;
            m.targetX = Math.max(homeX - 110, Math.min(homeX + 110, m.targetX));
            m.angle = Math.atan2(target.y - m.y, target.x - m.x);
            m.screenAngle = m.angle;
        } else {
            // Continuous patrol back and forth around homeX
            if (!m.patrolTargetX || Math.abs(m.patrolTargetX - m.x) < 8) {
                m.patrolTargetX = homeX + (Math.random() - 0.5) * 180;
            }
            m.targetX = m.patrolTargetX;
            
            // Turn face direction slightly towards the patrol destination
            const walkDir = Math.sign(m.targetX - m.x);
            const patrolAngle = -Math.PI / 2 + walkDir * 0.25;
            m.angle = m.angle * 0.95 + patrolAngle * 0.05;
            m.screenAngle = m.screenAngle * 0.95 + patrolAngle * 0.05;
        }
        
        const dx = m.targetX - m.x;
        if (Math.abs(dx) > 3) {
            const step = Math.sign(dx) * m.speed * dt;
            m.x += Math.abs(dx) < Math.abs(step) ? dx : step;
            m.walkCycle += dt * 12;
        } else {
            m.walkCycle = 0;
        }
        
        const minMercX = canvas.clientWidth * 0.05;
        const maxMercX = canvas.clientWidth * 0.95;
        m.x = Math.max(minMercX, Math.min(maxMercX, m.x));
    }

    // Fire rate inherits fixed weapon fire speed
    const shootSpeedInterval = mercWep.shootInterval || 0.5;
    const fireInterval = activeSkillsDuration.overclock > 0 ? (shootSpeedInterval * 0.35) : shootSpeedInterval;

    m.fireTimer = (m.fireTimer || 0) + dt;

    if (m.fireTimer >= fireInterval) {
        m.fireTimer = 0;
        shootMercenary(m, fireInterval);
    }
}

export function shootMercenary(m, fireInterval) {
    if (zombies.length === 0 || gameState.isDefeated) return;
    if (m.x === undefined) return;
    
    const mercWepId = getMercenaryWeaponId(m.id);
    const mercWep = gameState.weapons.find(w => w.id === mercWepId);
    if (!mercWep) return;
    
    if (m.isReloading) return;
    
    if (m.currentClip <= 0) {
        m.isReloading = true;
        m.reloadTimer = mercWep.reloadTime * getReloadTimeModifier();
        playReloadSound();
        return;
    }
    
    const range = getMercenaryRange(m.id);
    let target = getPrioritizedZombie(m.x, m.y, range);
    if (!target) return;

    // Inherit fixed weapon damage
    const baseDamage = getWeaponDamageForMerc(mercWep);
    const levelPowerMult = Math.pow(1.22 + (m.level * 0.003), m.level - 1);
    let totalDmg = baseDamage * levelPowerMult;
    
    const hiredPowerLvl = gameState.mutations.dnaHiredPower ? gameState.mutations.dnaHiredPower.level : 0;
    const hiredPowerMod = 1 + (hiredPowerLvl * (gameState.mutations.dnaHiredPower ? gameState.mutations.dnaHiredPower.mult : 0.25));
    totalDmg *= hiredPowerMod;

    const isCrit = Math.random() < 0.08; 
    const finalDamage = Math.round(totalDmg * (isCrit ? 1.5 : 1.0));

    let gunH = 12, barrelExt = 5;
    switch (mercWepId) {
        case 'pistol':   gunH = 8;  barrelExt = 5;  break;
        case 'smg':      gunH = 13; barrelExt = 4;  break;
        case 'shotgun':  gunH = 15; barrelExt = 5;  break;
        case 'rifle':    gunH = 18; barrelExt = 6;  break;
        case 'flame':    gunH = 12; barrelExt = 4;  break;
        case 'plasma':   gunH = 16; barrelExt = 5;  break;
        case 'freeze':   gunH = 14; barrelExt = 5;  break;
        case 'gatling':  gunH = 18; barrelExt = 8;  break;
        case 'tesla':    gunH = 17; barrelExt = 6;  break;
        case 'nuclear':  gunH = 20; barrelExt = 7;  break;
    }
    let gunLength = 10 + gunH + barrelExt;
    let yOffset = -4;
    if (m.id === 'merc_drone') {
        gunLength = 12;
        yOffset = 0;
    }
    
    const mercAngle = Math.atan2(target.y - m.y, target.x - m.x);
    const startX = m.x + Math.cos(mercAngle) * gunLength;
    const startY = m.y + yOffset + Math.sin(mercAngle) * gunLength;

    let baseSpread = 0.01;
    switch (mercWepId) {
        case 'pistol': baseSpread = 0.015; break;
        case 'smg': baseSpread = 0.035; break;
        case 'shotgun': baseSpread = 0.06; break;
        case 'rifle': baseSpread = 0.01; break;
        case 'flame': baseSpread = 0.12; break;
        case 'plasma': baseSpread = 0.005; break;
        case 'freeze': baseSpread = 0.018; break;
        case 'gatling': baseSpread = 0.045; break;
        case 'tesla': baseSpread = 0.02; break;
        case 'nuclear': baseSpread = 0.00; break;
    }
    const spreadOffset = (Math.random() - 0.5) * baseSpread;
    const angle = mercAngle + spreadOffset;

    let recoilAmt = 4.0;
    switch (mercWepId) {
        case 'pistol': recoilAmt = 2.8; break;
        case 'smg': recoilAmt = 1.5; break;
        case 'shotgun': recoilAmt = 16.0; break;
        case 'rifle': recoilAmt = 4.0; break;
        case 'flame': recoilAmt = 0.15; break;
        case 'plasma': recoilAmt = 8.0; break;
        case 'freeze': recoilAmt = 2.5; break;
        case 'gatling': recoilAmt = 1.8; break;
        case 'tesla': recoilAmt = 0.8; break;
        case 'nuclear': recoilAmt = 25.0; break;
    }
    m.recoil = recoilAmt;
    m.flashTimer = 0.05;

    // Use fixed weapon mechanics for bullet spawns
    if (mercWepId === 'shotgun') {
        const pelletCount = 15;
        const damagePerPellet = Math.max(1, Math.round(finalDamage / pelletCount));
        for (let i = 0; i < pelletCount; i++) {
            const randomOffset = (Math.random() - 0.5) * 0.20;
            const pelletAngle = mercAngle + randomOffset;
            const b = getAvailableBullet();
            if (b) {
                const speed = 32 + Math.random() * 6;
                b.spawn(startX, startY, 0, 0, damagePerPellet, isCrit, speed, false, true, 1, pelletAngle, false, false, false, false, false, range);
            }
        }
    } else if (mercWepId === 'flame') {
        const flameSpread = (Math.random() - 0.5) * 0.26;
        const flameAngle = mercAngle + flameSpread;
        const b = getAvailableBullet();
        if (b) {
            b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 12, false, false, 1, flameAngle, false, false, false, true, false, range);
            b.life = 0.35;
        }
    } else if (mercWepId === 'freeze') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 18, false, false, 1, angle, false, false, false, false, true, range);
    } else if (mercWepId === 'plasma') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 34, true, false, 1, angle, false, false, false, false, false, range);
    } else if (mercWepId === 'gatling') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 48, false, false, 1, angle, true, false, false, false, false, range);
    } else if (mercWepId === 'tesla') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 55, false, false, 1, angle, false, true, false, false, false, range);
    } else if (mercWepId === 'nuclear') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 10, false, false, 1, angle, false, false, true, false, false, range);
    } else if (mercWepId === 'rifle') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 52, false, false, 1, angle, false, false, false, false, false, range);
    } else if (mercWepId === 'smg') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 42, false, false, 1, angle, false, false, false, false, false, range);
    } else if (mercWepId === 'pistol') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 38, false, false, 1, angle, false, false, false, false, false, range);
    } else {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 38, false, false, 1, angle, false, false, false, false, false, range);
    }
    
    spawnMuzzleSparks(startX, startY, mercAngle, mercWepId);
    
    if (mercWepId !== 'flame' && mercWepId !== 'plasma' && mercWepId !== 'tesla') {
        const p = getAvailableParticle();
        if (p) {
            const shellAngle = mercAngle - Math.PI/2 - (Math.random() * 0.4);
            p.spawn(startX - Math.cos(mercAngle) * 8, startY - Math.sin(mercAngle) * 8, Math.cos(shellAngle) * 2.2, Math.sin(shellAngle) * 1.5, '#eab308', 1.8, 1.5, 0.28, 'shell', 12, 3.5 + Math.random()*2.0);
        }
    }

    playShootSound(mercWepId);

    m.currentClip--;
    if (m.currentClip <= 0) {
        m.isReloading = true;
        m.reloadTimer = mercWep.reloadTime * getReloadTimeModifier();
        playReloadSound();
    }
}

export function attackBarricade(amount) {
    if (gameState.isDefeated) return;
    
    if (gameState.wallThorns > 0) {
        const thornDmg = Math.round(gameState.wallThorns);
        let target = getPrioritizedZombie();
        if (target) {
            const isDead = target.damageTake(thornDmg, false);
            if (isDead) {
                checkWaveFinished();
            }
        }
    }

    gameState.wallHp = Math.max(0, gameState.wallHp - amount);

    if (gameState.wallHp <= 0) {
        triggerDefeat();
    }
    saveGameData();
}

export function triggerDefeat() {
    gameState.isDefeated = true;
    baseRepairTimer.value = REPAIR_TIME_MAX;
    document.getElementById('defeat-overlay').classList.remove('hidden');
    document.getElementById('defeat-overlay').classList.add('flex');
    zombies.forEach(z => z.destroyGraphics());
    setZombies([]); 
    bulletPool.forEach(b => b.active = false);
    airDrops.forEach(drop => drop.destroyGraphics());
    airDrops.length = 0;
    setActiveBomberPlanes([]);
    setActiveAirstrikeBombs([]);
    playDefeatDrone();
    saveGameData();
}
