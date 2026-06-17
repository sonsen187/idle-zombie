import { 
    MAX_PARTICLES, 
    MAX_BULLETS, 
    MAX_TEXTS 
} from './constants.js';

import { 
    gameState, 
    player, 
    canvas, 
    audioMuted, 
    isPaused, 
    lastTime, 
    framesThisSecond, 
    lastFpsUpdate, 
    fps, 
    zombies, 
    particlePool, 
    bulletPool, 
    textPool, 
    airDrops, 
    setCanvas,
    pixi,
    keysPressed,
    mousePosition,
    isMouseDown,
    activeSkillsDuration,
    mainWeaponShootTimer,
    isReloading,
    reloadTimer
} from './state.js';

import { 
    project3D 
} from './helpers.js';

import { 
    hooks as entityHooks, 
    Zombie, 
    Bullet, 
    Particle, 
    FloatingText 
} from './entities.js';

import { 
    systemHooks, 
    updateGame, 
    checkWaveFinished, 
    addGold, 
    triggerAirstrike, 
    triggerOverclock, 
    executePrestige, 
    saveGameData, 
    getSaveString,
    applySaveString,
    loadGameData,
    attackBarricade,
    getWeaponDamage,
    getCritChance,
    getCritMultiplier,
    triggerAutomaticFire
} from './systems.js';

import { 
    dispatchDOMUpdates, 
    switchTab, 
    showModal, 
    closeModal, 
    closeSaveModal, 
    copySaveToClipboard, 
    importSaveData, 
    togglePauseGame, 
    updateSoundUI, 
    renderShop, 
    updateActiveSkillCooldownUI, 
    triggerBossWarning,
    updateAutoFireUI
} from './ui.js';

import { 
    initPixi, 
    drawGame, 
    initBgCanvas, 
    addBloodSplatterToBg,
    addToxicSplatterToBg
} from './renderer.js';

import { 
    initAudioEngine,
    playHoverBeep
} from './audio.js';

// 1. POPULATE OBJECT POOLS
for (let i = 0; i < MAX_PARTICLES; i++) {
    particlePool.push(new Particle());
}
for (let i = 0; i < MAX_BULLETS; i++) {
    bulletPool.push(new Bullet());
}
for (let i = 0; i < MAX_TEXTS; i++) {
    textPool.push(new FloatingText());
}

// 2. BIND EVENT HOOKS to resolve circular dependencies
entityHooks.dispatchDOMUpdates = dispatchDOMUpdates;
entityHooks.checkWaveFinished = checkWaveFinished;
entityHooks.saveGameData = () => saveGameData(true);
entityHooks.attackBarricade = attackBarricade;
entityHooks.addGold = addGold;
entityHooks.getCritChance = getCritChance;
entityHooks.getCritMultiplier = getCritMultiplier;
entityHooks.getWeaponDamage = getWeaponDamage;
entityHooks.addBloodSplatterToBg = addBloodSplatterToBg;
entityHooks.addToxicSplatterToBg = addToxicSplatterToBg;

systemHooks.dispatchDOMUpdates = dispatchDOMUpdates;
systemHooks.updateActiveSkillCooldownUI = updateActiveSkillCooldownUI;
systemHooks.showModal = showModal;
systemHooks.initBgCanvas = initBgCanvas;
systemHooks.renderShop = renderShop;
systemHooks.setupCanvas = setupCanvas;
systemHooks.triggerBossWarning = triggerBossWarning;

// 3. MAIN GAME LOOP
function gameLoop(time) {
    if (!lastTime.value) lastTime.value = time;
    let dt = (time - lastTime.value) / 1000;
    if (dt > 0.1) dt = 0.1; 
    lastTime.value = time;

    framesThisSecond.value++;
    if (time > lastFpsUpdate.value + 1000) {
        fps.value = Math.round((framesThisSecond.value * 1000) / (time - lastFpsUpdate.value));
        const fpsEl = document.getElementById('fps-counter');
        if (fpsEl) {
            fpsEl.innerText = fps.value;
            if (fps.value >= 55) {
                fpsEl.className = "text-emerald-500 font-bold";
            } else if (fps.value >= 35) {
                fpsEl.className = "text-yellow-500 font-bold";
            } else {
                fpsEl.className = "text-red-500 font-bold animate-pulse";
            }
        }
        framesThisSecond.value = 0;
        lastFpsUpdate.value = time;
    }

    if (!isPaused.value) {
        updateGame(dt);
    }
    drawGame();

    requestAnimationFrame(gameLoop);
}

// 4. SETUP CANVAS SIZE
function setupCanvas() {
    const activeCanvas = document.getElementById('gameCanvas');
    if (!activeCanvas) return;
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;
    
    const rect = wrapper.getBoundingClientRect();
    
    activeCanvas.width = rect.width;
    activeCanvas.height = rect.height;
    
    const appRef = pixi.app;
    if (appRef && appRef.renderer) {
        appRef.renderer.resize(rect.width, rect.height);
        
        // Recreate blood textures on resize
        const bloodSpriteRef = appRef.stage.getChildAt(0).getChildAt(1); // newBloodSprite is at index 1
        if (bloodSpriteRef && bloodSpriteRef.texture) {
            bloodSpriteRef.texture.destroy(true);
            const newBloodTexture = PIXI.RenderTexture.create({ width: rect.width, height: rect.height });
            bloodSpriteRef.texture = newBloodTexture;
            // update state reference directly
            pixi.bloodTexture = newBloodTexture;
        }
    }
    
    initBgCanvas(activeCanvas.clientWidth, activeCanvas.clientHeight);
    
    if (player) {
        player.x = activeCanvas.clientWidth / 2;
        const barricadeY = activeCanvas.clientHeight - 160;
        player.y = barricadeY + 30; 
        player.targetX = player.x;
    }
}

// 5. CANVAS MOUSE EVENTS (AIRDROP, AIMING & FIRE)
function handleCanvasMouseDown(e) {
    if (isPaused.value) return;
    initAudioEngine();
    
    if (e.button === 0) { // Left click
        isMouseDown.value = true;
        
        const activeCanvas = document.getElementById('gameCanvas');
        if (!activeCanvas) return;
        const rect = activeCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        
        let clickedAirdrop = false;
        airDrops.forEach(drop => {
            if (drop && drop.active && drop.landed) {
                const pt = project3D(drop.x + drop.width/2, drop.targetY + drop.height/2, 0);
                const dx = clickX - pt.x;
                const dy = clickY - pt.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                if (distance < 35) {
                    drop.collect();
                    clickedAirdrop = true;
                }
            }
        });
        
        if (!clickedAirdrop && !gameState.autoFire && !gameState.isDefeated) {
            const activeWep = gameState.weapons[gameState.activeWeaponIndex];
            if (!activeWep || isReloading.value) return;
            
            const shootSpeedInterval = activeWep.shootInterval || 0.5;
            const currentSpeed = activeSkillsDuration.overclock > 0 ? (shootSpeedInterval * 0.35) : shootSpeedInterval;
            
            if (mainWeaponShootTimer.value >= currentSpeed) {
                mainWeaponShootTimer.value = 0;
                triggerAutomaticFire(player.angle);
            }
        }
    }
}

function toggleAutoFire() {
    if (gameState.isDefeated) return;
    gameState.autoFire = !gameState.autoFire;
    updateAutoFireUI();
    saveGameData();
}

// 6. INITIALIZE GAME WINDOW ONLOAD
window.onload = function() {
    const activeCanvas = document.getElementById('gameCanvas');
    setCanvas(activeCanvas);
    
    initPixi();
    setupCanvas();
    
    window.addEventListener('resize', setupCanvas);
    
    activeCanvas.addEventListener('mousemove', (e) => {
        const rect = activeCanvas.getBoundingClientRect();
        mousePosition.x = e.clientX - rect.left;
        mousePosition.y = e.clientY - rect.top;
    });
    activeCanvas.addEventListener('mousedown', handleCanvasMouseDown);
    
    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            isMouseDown.value = false;
        }
    });
    
    loadGameData();
    
    audioMuted.value = gameState.soundMuted;
    updateSoundUI();
    updateAutoFireUI();
    
    dispatchDOMUpdates();
    switchTab('weapons');
    
    const autofireBtn = document.getElementById('autofire-toggle');
    if (autofireBtn) {
        autofireBtn.addEventListener('click', toggleAutoFire);
    }

    requestAnimationFrame(gameLoop);
};

// 7. KEYBOARD SHORTCUTS AND WASD MOVEMENTS
window.addEventListener('keydown', (e) => {
    if (isPaused.value) {
        if (["Digit1", "Digit2"].includes(e.code)) {
            e.preventDefault();
            return;
        }
    }
    
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
        keysPressed[e.code] = true;
        if (!gameState.autoFire && e.code === 'KeyW') {
            return; 
        }
    }

    if (["Digit1", "Digit2"].includes(e.code)) {
        e.preventDefault();
    }
    if (e.code === 'Digit1') triggerAirstrike();
    if (e.code === 'Digit2') triggerOverclock();

    if (e.code === 'KeyQ') switchTab('weapons');
    if (e.code === 'KeyW' && gameState.autoFire) switchTab('defense');
    if (e.code === 'KeyE') switchTab('mercs');
    if (e.code === 'KeyR') switchTab('mutations');
    
    if (e.code === 'KeyF') {
        e.preventDefault();
        toggleAutoFire();
    }
});

window.addEventListener('keyup', (e) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
        keysPressed[e.code] = false;
    }
});

// 8. BUTTON EVENT LISTENERS
const airstrikeBtn = document.getElementById('skill-airstrike-sidebar');
if (airstrikeBtn) airstrikeBtn.addEventListener('click', triggerAirstrike);

const overclockBtn = document.getElementById('skill-overclock-sidebar');
if (overclockBtn) overclockBtn.addEventListener('click', triggerOverclock);

const soundToggleBtn = document.getElementById('sound-toggle');
if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
        initAudioEngine();
        audioMuted.value = !audioMuted.value;
        gameState.soundMuted = audioMuted.value;
        saveGameData(true);
        updateSoundUI();
    });
}

const pauseToggleBtn = document.getElementById('pause-toggle');
if (pauseToggleBtn) pauseToggleBtn.addEventListener('click', togglePauseGame);

const fullscreenToggleBtn = document.getElementById('fullscreen-toggle');
const fullscreenIcon = document.getElementById('fullscreen-icon');
if (fullscreenToggleBtn) {
    fullscreenToggleBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn(`Error trying to enable fullscreen mode: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });
}

document.addEventListener('fullscreenchange', () => {
    if (fullscreenIcon) {
        if (document.fullscreenElement) {
            fullscreenIcon.className = 'fa-solid fa-compress text-red-500';
        } else {
            fullscreenIcon.className = 'fa-solid fa-expand text-zinc-300';
        }
    }
});

const crtToggleBtn = document.getElementById('crt-toggle');
const crtIcon = document.getElementById('crt-icon');
if (crtToggleBtn) {
    crtToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('crt-off');
        const isOff = document.body.classList.contains('crt-off');
        if (crtIcon) {
            if (isOff) {
                crtIcon.className = 'fa-solid fa-tv text-zinc-500';
                crtToggleBtn.className = 'w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition';
            } else {
                crtIcon.className = 'fa-solid fa-tv text-teal-400';
                crtToggleBtn.className = 'w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-teal-400 hover:text-white hover:bg-zinc-800 transition';
            }
        }
    });
}

const btnSaveManager = document.getElementById('btn-save-manager');
if (btnSaveManager) {
    btnSaveManager.addEventListener('click', () => {
        saveGameData(true);
        const saveStr = getSaveString();
        const saveCodeBox = document.getElementById('save-code-box');
        const importCodeBox = document.getElementById('import-code-box');
        const saveModal = document.getElementById('save-modal');
        
        if (saveCodeBox) saveCodeBox.value = saveStr;
        if (importCodeBox) importCodeBox.value = "";
        if (saveModal) saveModal.classList.remove('hidden');
        
        const t = textPool.find(ft => !ft.active);
        if (t && canvas) {
            t.spawn(canvas.clientWidth / 2, canvas.clientHeight / 2 - 40, "ĐÃ LƯU TIẾN TRÌNH", "#10b981", 14, true);
        }
    });
}

const btnEvacuate = document.getElementById('btn-evacuate');
if (btnEvacuate) {
    btnEvacuate.addEventListener('click', () => {
        if (gameState.wave < 10) {
            showModal('Sơ Tán Thất Bại', 'Cảnh báo: Hàng rào phòng thủ phải đạt tối thiểu Làn Sóng (Wave) 10 mới đủ điều kiện huy động trực thăng thu hồi DNA mẫu vật!');
            return;
        }

        const rewardDna = Math.round(1 + Math.pow(gameState.wave - 9, 1.25));
        
        const modal = document.getElementById('info-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalMessage = document.getElementById('modal-message');
        
        if (modalTitle) modalTitle.innerText = 'PHÊ DUYỆT RÚT QUÂN?';
        if (modalMessage) {
            modalMessage.innerHTML = `
                <span class="text-red-500 font-bold">Lưu ý rút quân:</span> Rút quân giải cứu sẽ đặt lại Làn sóng phòng thủ về Wave 1, giải tán toàn bộ binh lính và kho vũ khí thô sơ hiện tại.<br><br>
                Bù lại, mẫu thí nghiệm thu được sẽ mang lại cho bạn <span class="text-emerald-400 font-tech font-bold">🧬 ${rewardDna} DNA ĐỘT BIẾN GEN</span> để tiến hóa vĩnh viễn!<br><br>
                Xác nhận tiến hành?
            `;
        }
        
        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'mt-5 mr-3 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition active:scale-95';
        confirmBtn.innerText = 'XÁC NHẬN SƠ TÁN';
        confirmBtn.onclick = () => {
            executePrestige(rewardDna);
            if (modal) modal.classList.add('hidden');
            confirmBtn.remove();
        };
        
        const container = modal.querySelector('.bg-zinc-900');
        const existingClose = container.querySelector('button');
        
        const prevConfirms = container.querySelectorAll('button:not([onclick="closeModal()"]):not([onclick="window.game.closeModal()"])');
        prevConfirms.forEach(btn => btn.remove());
        
        container.insertBefore(confirmBtn, existingClose);
        if (modal) modal.classList.remove('hidden');
    });
}

// 9. EXPOSE GLOBALLY FOR HTML ONCLICK BINDINGS
import('./ui.js').then(uiModule => {
    window.game = {
        playHoverBeep,
        switchTab: uiModule.switchTab,
        togglePauseGame: uiModule.togglePauseGame,
        closeModal: uiModule.closeModal,
        closeSaveModal: uiModule.closeSaveModal,
        copySaveToClipboard: uiModule.copySaveToClipboard,
        importSaveData: uiModule.importSaveData,
        unlockWeapon: uiModule.unlockWeapon,
        upgradeWeapon: uiModule.upgradeWeapon,
        selectWeapon: uiModule.selectWeapon,
        upgradeDefense: uiModule.upgradeDefense,
        hireOrUpgradeMerc: uiModule.hireOrUpgradeMerc,
        evolveMutation: uiModule.evolveMutation
    };
});
