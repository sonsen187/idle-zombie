import { 
    isPaused, gameState, isReloading, reloadTimer, 
    activeTab, skillsCooldown, audioMuted, player 
} from '../state.js';
import { INITIAL_GAME_STATE } from '../constants.js';
import { formatNumber } from '../helpers.js';
import { renderShop } from './Shop.js';

export function togglePauseGame() {
    isPaused.value = !isPaused.value;
    const pauseOverlay = document.getElementById('pause-overlay');
    const pauseIcon = document.getElementById('pause-icon');
    const pauseToggleBtn = document.getElementById('pause-toggle');
    
    if (isPaused.value) {
        if (pauseOverlay) {
            pauseOverlay.classList.remove('hidden');
            pauseOverlay.classList.add('flex');
        }
        if (pauseIcon) {
            pauseIcon.className = 'fa-solid fa-play text-xs';
        }
        if (pauseToggleBtn) {
            pauseToggleBtn.classList.remove('text-yellow-500');
            pauseToggleBtn.classList.add('text-emerald-400', 'animate-pulse');
            pauseToggleBtn.title = "Tiếp tục trận đấu";
        }
    } else {
        if (pauseOverlay) {
            pauseOverlay.classList.add('hidden');
            pauseOverlay.classList.remove('flex');
        }
        if (pauseIcon) {
            pauseIcon.className = 'fa-solid fa-pause text-xs';
        }
        if (pauseToggleBtn) {
            pauseToggleBtn.classList.add('text-yellow-500');
            pauseToggleBtn.classList.remove('text-emerald-400', 'animate-pulse');
            pauseToggleBtn.title = "Tạm dừng trận đấu";
        }
    }
}

export function dispatchDOMUpdates() {
    const goldDisplay = document.getElementById('gold-display');
    const dnaDisplay = document.getElementById('dna-display');
    const waveProgressBar = document.getElementById('wave-progress-bar');
    const waveTitle = document.getElementById('wave-title');
    const wallHpText = document.getElementById('wall-hp-text');
    const autoDpsText = document.getElementById('auto-dps-text');
    const ammoText = document.getElementById('ammo-text');

    if (goldDisplay) goldDisplay.innerText = formatNumber(Math.floor(gameState.gold));
    if (dnaDisplay) dnaDisplay.innerText = formatNumber(Math.floor(gameState.dna));
    
    const maxZombiesThisWave = 10 + (gameState.wave * 5);
    const ratio = Math.min(1.0, gameState.waveProgress / maxZombiesThisWave);
    if (waveProgressBar) waveProgressBar.style.width = `${ratio * 100}%`;
    if (waveTitle) waveTitle.innerText = `WAVE ${gameState.wave}`;

    const shieldDnaMod = 1 + (gameState.mutations.dnaWallShield.level * gameState.mutations.dnaWallShield.mult);
    const maxHp = Math.round(gameState.wallMaxHp * shieldDnaMod);
    if (wallHpText) wallHpText.innerText = `${Math.round(gameState.wallHp)}/${maxHp}`;

    let baseDpsVal = 0;
    gameState.mercenaries.forEach(m => {
        if (m && m.hired) {
            const levelPowerMult = Math.pow(1.22 + (m.level * 0.003), m.level - 1);
            let mercPower = m.baseDps * levelPowerMult;
            
            const hiredPowerLvl = gameState.mutations.dnaHiredPower ? gameState.mutations.dnaHiredPower.level : 0;
            const hiredPowerMod = 1 + (hiredPowerLvl * (gameState.mutations.dnaHiredPower ? gameState.mutations.dnaHiredPower.mult : 0.25));
            mercPower *= hiredPowerMod;
            
            baseDpsVal += mercPower;
        }
    });
    if (autoDpsText) autoDpsText.innerText = formatNumber(Math.round(baseDpsVal));
    
    const activeWep = gameState.weapons[gameState.activeWeaponIndex];
    if (activeWep && ammoText) {
        if (activeWep.currentClip === undefined) {
            const defaultWep = INITIAL_GAME_STATE.weapons.find(w => w.id === activeWep.id);
            activeWep.clipSize = defaultWep.clipSize;
            activeWep.currentClip = defaultWep.clipSize;
            activeWep.reloadTime = defaultWep.reloadTime;
        }

        if (isReloading.value) {
            ammoText.innerText = `RELOAD ${reloadTimer.value.toFixed(1)}s`;
            ammoText.className = "font-tech text-xs text-red-500 font-bold mt-0.5 animate-pulse";
        } else {
            ammoText.innerText = `${activeWep.currentClip}/${activeWep.clipSize}`;
            ammoText.className = "font-tech text-xs text-yellow-400 font-bold mt-0.5";
        }
    }

    updateAutoFireUI();
    updateButtonStates();
}

export function switchTab(tabId) {
    activeTab.value = tabId;
    const tabWeapons = document.getElementById('tab-weapons');
    const tabDefense = document.getElementById('tab-defense');
    const tabMercs = document.getElementById('tab-mercs');
    const tabMutations = document.getElementById('tab-mutations');

    if (tabWeapons) tabWeapons.classList.remove('btn-active-tab');
    if (tabDefense) tabDefense.classList.remove('btn-active-tab');
    if (tabMercs) tabMercs.classList.remove('btn-active-tab');
    if (tabMutations) tabMutations.classList.remove('btn-active-tab');
    
    const activeTabEl = document.getElementById(`tab-${tabId}`);
    if (activeTabEl) activeTabEl.classList.add('btn-active-tab');
    
    renderShop(); 
}

export function updateActiveSkillCooldownUI(skill) {
    const cdDiv = document.getElementById(`cooldown-${skill}`);
    const timeVal = Math.ceil(skillsCooldown[skill]);
    
    if (cdDiv) {
        if (timeVal > 0) {
            cdDiv.classList.remove('hidden');
            cdDiv.classList.add('flex');
            cdDiv.innerText = `${timeVal}s`;
        } else {
            cdDiv.classList.add('hidden');
            cdDiv.classList.remove('flex');
        }
    }
}

export function updateButtonStates() {
    const buttons = document.querySelectorAll('#shop-panel button[data-cost]');
    buttons.forEach(btn => {
        const cost = parseInt(btn.getAttribute('data-cost'));
        const currency = btn.getAttribute('data-currency');
        const currentAmount = currency === 'dna' ? gameState.dna : gameState.gold;
        const canAfford = currentAmount >= cost;
        
        const activeClasses = btn.getAttribute('data-active-class').split(' ');
        
        if (canAfford) {
            if (btn.disabled) {
                btn.disabled = false;
                btn.classList.remove('bg-zinc-900', 'text-zinc-650', 'text-zinc-600');
                activeClasses.forEach(cls => btn.classList.add(cls));
            }
        } else {
            if (!btn.disabled) {
                btn.disabled = true;
                activeClasses.forEach(cls => btn.classList.remove(cls));
                btn.classList.add('bg-zinc-900', 'text-zinc-650');
            }
        }
    });
}

export function triggerBossWarning() {
    const banner = document.getElementById('boss-warning');
    if (banner) {
        banner.classList.remove('hidden');
        banner.classList.add('flex');
        setTimeout(() => {
            banner.classList.add('hidden');
            banner.classList.remove('flex');
        }, 2800);
    }
}

export function updateSoundUI() {
    const soundIcon = document.getElementById('sound-icon');
    if (soundIcon) {
        if (audioMuted.value) {
            soundIcon.className = 'fa-solid fa-volume-xmark text-red-500';
        } else {
            soundIcon.className = 'fa-solid fa-volume-high text-zinc-300';
        }
    }
}

export function updateAutoFireUI() {
    const autoFireBtn = document.getElementById('autofire-toggle');
    if (autoFireBtn) {
        const textSpan = autoFireBtn.querySelector('span');
        const icon = autoFireBtn.querySelector('i');
        // Ensure autoFire has a boolean value
        const isAuto = gameState.autoFire !== false;
        
        if (isAuto) {
            autoFireBtn.className = "px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition pointer-events-auto";
            if (textSpan) textSpan.innerText = "TỰ ĐỘNG BẮN: BẬT";
            if (icon) icon.className = "fa-solid fa-robot animate-pulse";
            autoFireBtn.title = "Bật/Tắt Tự Động Bắn [F]";
        } else {
            autoFireBtn.className = "px-2 py-0.5 rounded bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/40 hover:text-white font-bold flex items-center gap-1 cursor-pointer transition pointer-events-auto";
            if (textSpan) textSpan.innerText = "TỰ ĐỘNG BẮN: TẮT";
            if (icon) icon.className = "fa-solid fa-gamepad";
            autoFireBtn.title = "Bật/Tắt Tự Động Bắn [F] | Phím [WASD] để di chuyển | Chuột trái để bắn";
        }
    }
}
