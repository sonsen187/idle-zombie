import { STORAGE_KEY, INITIAL_GAME_STATE } from '../constants.js';
import { gameState, canvas } from '../state.js';
import { playUpgradeChime } from '../audio.js';
import { systemHooks } from './hooks.js';
import { resetField } from './WaveSystem.js';
import { getWeaponUpgradeCost } from './CombatSystem.js';

export function getSaveString() {
    try {
        const stringified = JSON.stringify(gameState, (key, value) => {
            if (key === 'graphics') return undefined;
            return value;
        });
        return btoa(encodeURIComponent(stringified).replace(/%([0-9A-F]{2})/g, function(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
    } catch (e) {
        console.error("Lỗi mã hóa save:", e);
        return "";
    }
}

export function saveGameData(force = false) {
    if (!force) return;
    try {
        const saveStr = getSaveString();
        localStorage.setItem(STORAGE_KEY, saveStr);
    } catch (e) {
        console.error("Lỗi khi lưu game:", e);
    }
}

export function applySaveString(saveStr, notifyUser = true) {
    try {
        const decoded = decodeURIComponent(atob(saveStr).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const parsed = JSON.parse(decoded);
        if (!parsed) return;

        if (parsed.gold !== undefined) gameState.gold = Number(parsed.gold);
        if (parsed.dna !== undefined) gameState.dna = Number(parsed.dna);
        if (parsed.wave !== undefined) gameState.wave = Number(parsed.wave);
        if (parsed.waveProgress !== undefined) gameState.waveProgress = Number(parsed.waveProgress);
        if (parsed.maxWave !== undefined) gameState.maxWave = Number(parsed.maxWave);
        if (parsed.wallHp !== undefined) gameState.wallHp = Number(parsed.wallHp);
        if (parsed.wallMaxHp !== undefined) gameState.wallMaxHp = Number(parsed.wallMaxHp);
        if (parsed.wallRegen !== undefined) gameState.wallRegen = Number(parsed.wallRegen);
        if (parsed.wallThorns !== undefined) gameState.wallThorns = Number(parsed.wallThorns);
        if (parsed.activeWeaponIndex !== undefined) {
            let oldIndex = Number(parsed.activeWeaponIndex);
            let oldWeapons = parsed.weapons || [];
            if (oldWeapons[oldIndex]) {
                let oldId = oldWeapons[oldIndex].id;
                let newIndex = gameState.weapons.findIndex(w => w.id === oldId);
                if (newIndex !== -1) {
                    gameState.activeWeaponIndex = newIndex;
                } else {
                    gameState.activeWeaponIndex = 0;
                }
            } else {
                gameState.activeWeaponIndex = Math.min(oldIndex, gameState.weapons.length - 1);
            }
        }
        if (parsed.soundMuted !== undefined) gameState.soundMuted = Boolean(parsed.soundMuted);

        if (parsed.weapons && Array.isArray(parsed.weapons)) {
            parsed.weapons.forEach(savedWep => {
                const localWep = gameState.weapons.find(w => w.id === savedWep.id);
                if (localWep) {
                    localWep.level = savedWep.level ?? localWep.level;
                    localWep.unlocked = savedWep.unlocked ?? localWep.unlocked;
                    localWep.currentCost = getWeaponUpgradeCost(localWep);
                    
                    const defaultWep = INITIAL_GAME_STATE.weapons.find(w => w.id === localWep.id);
                    if (defaultWep) {
                        localWep.clipSize = savedWep.clipSize ?? defaultWep.clipSize;
                        localWep.currentClip = savedWep.currentClip ?? (savedWep.unlocked ? defaultWep.clipSize : 0);
                        localWep.reloadTime = savedWep.reloadTime ?? defaultWep.reloadTime;
                    }
                }
            });
        }

        if (parsed.mercenaries && Array.isArray(parsed.mercenaries)) {
            parsed.mercenaries.forEach(savedMerc => {
                const localMerc = gameState.mercenaries.find(m => m.id === savedMerc.id);
                if (localMerc) {
                    localMerc.level = savedMerc.level ?? localMerc.level;
                    localMerc.hired = savedMerc.hired ?? localMerc.hired;
                    localMerc.currentCost = savedMerc.currentCost ?? localMerc.currentCost;
                }
            });
        }

        if (parsed.statUpgrades) {
            Object.keys(parsed.statUpgrades).forEach(k => {
                if (gameState.statUpgrades[k] !== undefined) {
                    gameState.statUpgrades[k] = parsed.statUpgrades[k];
                }
            });
        }

        if (parsed.mutations) {
            Object.keys(parsed.mutations).forEach(k => {
                if (gameState.mutations[k] && parsed.mutations[k]) {
                    gameState.mutations[k].level = parsed.mutations[k].level ?? gameState.mutations[k].level;
                }
            });
        }

        resetField();
        saveGameData(true);
        if (notifyUser && systemHooks.showModal) {
            playUpgradeChime();
            systemHooks.showModal("Khôi Phục Tiến Trình", "Đã nạp file sao lưu của bạn thành công! Trở lại trận địa bảo vệ rào chắn.");
            if (systemHooks.dispatchDOMUpdates) systemHooks.dispatchDOMUpdates();
            if (systemHooks.renderShop) systemHooks.renderShop();
            if (systemHooks.initBgCanvas && canvas) systemHooks.initBgCanvas(canvas.width, canvas.height);
        }
    } catch (e) {
        if (notifyUser && systemHooks.showModal) {
            systemHooks.showModal("Lỗi Khôi Phục", "Mã lưu trữ bạn nhập không hợp lệ hoặc bị lỗi ký tự. Vui lòng kiểm tra lại!");
        }
        console.error("Lỗi khi áp dụng chuỗi save:", e);
    }
}

export function loadGameData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            applySaveString(saved, false);
        }
    } catch (e) {
        console.error("Lỗi khi tải save game:", e);
    }
}
