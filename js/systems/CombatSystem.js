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

export function triggerAutomaticFire(manualAngle = null) {
    if (gameState.isDefeated || isReloading.value) return;
    initAudioEngine();
    
    const activeWep = gameState.weapons[gameState.activeWeaponIndex];
    if (!activeWep) return;
    
    let target = null;
    let baseAngle = 0;

    const startX = player.x + Math.cos(player.angle) * 12;
    const startY = player.y + Math.sin(player.angle) * 12;

    if (manualAngle !== null) {
        // Bắn thủ công bằng chuột: tính toán góc bay chính xác từ đầu nòng súng tới trỏ chuột
        const worldMouse = unproject3D(mousePosition.x, mousePosition.y);
        baseAngle = Math.atan2(worldMouse.y - startY, worldMouse.x - startX);
    } else {
        target = getPrioritizedZombie();
        if (!target) return;
        baseAngle = Math.atan2(target.y - startY, target.x - startX);
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
                b.spawn(startX, startY, 0, 0, damagePerPellet, isCrit, speed, false, true, 1, pelletAngle);
            }
        }
    } else if (activeWep.id === 'flame') {
        const flameSpread = (Math.random() - 0.5) * (0.26 + player.recoilSpread);
        const flameAngle = baseAngle + flameSpread;
        const b = getAvailableBullet();
        if (b) {
            b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 12, false, false, 1, flameAngle, false, false, false, true, false);
            b.life = 0.35;
        }
    } else if (activeWep.id === 'freeze') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 18, false, false, 1, angle, false, false, false, false, true);
    } else if (activeWep.id === 'plasma') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 34, true, false, 1, angle);
    } else if (activeWep.id === 'gatling') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 48, false, false, 1, angle, true);
    } else if (activeWep.id === 'tesla') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 55, false, false, 1, angle, false, true, false);
    } else if (activeWep.id === 'nuclear') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 10, false, false, 1, angle, false, false, true);
    } else if (activeWep.id === 'rifle') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 52, false, false, 1, angle);
    } else if (activeWep.id === 'smg') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 42, false, false, 1, angle);
    } else if (activeWep.id === 'pistol') {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 38, false, false, 1, angle);
    } else {
        const b = getAvailableBullet();
        if (b) b.spawn(startX, startY, 0, 0, finalDamage, isCrit, 38, false, false, 1, angle);
    }
    
    activeFlashes.push({ x: startX, y: startY, life: 0.05 });
    
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
    if (m.id === 'merc_medic') return; 

    m.fireTimer = (m.fireTimer || 0) + dt;
    const fireInterval = m.id === 'merc_sniper' ? 1.5 : (m.id === 'merc_gunner' ? 0.14 : (m.id === 'merc_drone' ? 0.35 : 0.75)); 

    if (m.fireTimer >= fireInterval) {
        m.fireTimer = 0;
        shootMercenary(m, fireInterval);
    }
}

export function shootMercenary(m, fireInterval) {
    if (zombies.length === 0 || gameState.isDefeated) return;
    
    let target = getPrioritizedZombie();
    if (!target) return;

    const levelPowerMult = Math.pow(1.22 + (m.level * 0.003), m.level - 1);
    let dps = m.baseDps * levelPowerMult;
    
    const hiredPowerLvl = gameState.mutations.dnaHiredPower ? gameState.mutations.dnaHiredPower.level : 0;
    const hiredPowerMod = 1 + (hiredPowerLvl * (gameState.mutations.dnaHiredPower ? gameState.mutations.dnaHiredPower.mult : 0.25));
    dps *= hiredPowerMod;

    const damagePerShot = Math.max(1, Math.round(dps * fireInterval));
    
    const barricadeY = canvas.height - 160;
    const allyY = barricadeY + 30;
    let allyX = canvas.width * 0.5;
    if (m.id === 'merc_recruit') allyX = canvas.width * 0.20;
    else if (m.id === 'merc_sniper') allyX = canvas.width * 0.35;
    else if (m.id === 'merc_gunner') allyX = canvas.width * 0.65;
    else if (m.id === 'merc_medic') allyX = canvas.width * 0.80;
    else if (m.id === 'merc_drone') allyX = canvas.width * 0.92;
    
    const isCrit = Math.random() < 0.08; 
    const finalDamage = Math.round(damagePerShot * (isCrit ? 1.5 : 1.0));

    const b = getAvailableBullet();
    if (b) {
        let speed = 22;
        if (m.id === 'merc_soldier') speed = 38;
        else if (m.id === 'merc_sniper') speed = 65;
        else if (m.id === 'merc_gunner') speed = 45;
        else if (m.id === 'merc_drone') speed = 34;

        b.spawn(allyX, allyY, target.x, target.y, finalDamage, isCrit, speed, false);
        if (m.id === 'merc_drone') {
            b.isPlasma = true;
        }
    }
    
    if (m.id !== 'merc_drone') {
        const p = getAvailableParticle();
        if (p) {
            p.spawn(allyX, allyY + 2, (Math.random()-0.5)*1.0, 1.2 + Math.random() * 1.2, '#ca8a04', 1.6, 1.5, 0.28, 'shell', 12, 3.0 + Math.random()*2.0);
        }
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
