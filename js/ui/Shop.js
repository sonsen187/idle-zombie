import { gameState, player, isReloading, reloadTimer, activeTab } from '../state.js';
import { INITIAL_GAME_STATE } from '../constants.js';
import { formatNumber } from '../helpers.js';
import { playUpgradeChime } from '../audio.js';
import { spawnExplosion } from '../entities.js';
import { getWeaponDamage, getWeaponNextDamage, getWeaponUpgradeCost, saveGameData } from '../systems.js';
import { showModal } from './Modal.js';
import { dispatchDOMUpdates } from './HUD.js';

export function getWeaponDesc(id) {
    switch(id) {
        case 'pistol': return 'Súng ngắn Colt .45 tiêu chuẩn. Độ giật thấp, độ chính xác cao. Thích hợp cho phòng ngự cơ bản giai đoạn đầu trận.';
        case 'smg': return 'Súng tiểu liên Uzi 9mm. Tốc độ bắn cực nhanh, hỏa lực dày đặc nhưng sát thương riêng lẻ thấp. Thích hợp dọn dẹp các đợt zombie chạy nhanh.';
        case 'shotgun': return 'Shotgun M870 nạp đạn thủ công. Bắn ra 10 viên đạn chì phân tán mạnh. Càng gần mục tiêu sát thương càng khủng khiếp.';
        case 'rifle': return 'Súng trường tấn công AR-15 cỡ đạn 5.56mm. Sát thương cao, hỏa lực ổn định và băng đạn lớn. Vũ khí chủ lực trung hạn.';
        case 'flame': return 'Súng phun lửa Hellfire tầm ngắn. Phun luồng lửa thiêu đốt tất cả zombie trong phạm vi hình nón, gây sát thương liên tục và xuyên thấu hoàn toàn kẻ địch.';
        case 'plasma': return 'Pháo Laze Plasma tương lai. Bắn ra luồng plasma siêu nóng có khả năng xuyên thấu mục tiêu và tích năng lượng cao.';
        case 'freeze': return 'Súng năng lượng âm độ Blizzard. Bắn ra luồng khí cực lạnh làm đóng băng và giảm tốc độ di chuyển của zombie đi 65%, gây sát thương băng.';
        case 'gatling': return 'Súng máy 6 nòng vàng hạng nặng. Tốc độ xả đạn chóng mặt với sát thương khổng lồ. Hủy diệt mọi tuyến phòng thủ xác sống.';
        case 'tesla': return 'Máy phát điện cao áp Tesla. Phóng ra tia sét chuỗi tự động giật lan sang tối đa 3 mục tiêu lân cận trong phạm vi 150px.';
        case 'nuclear': return 'Vũ khí hủy diệt tối thượng. Bắn ra đầu đạn hạt nhân bay chậm nhưng gây ra vụ nổ phóng xạ diện rộng hủy diệt cực lớn.';
        default: return '';
    }
}

export function getDefenseDesc(key) {
    switch(key) {
        case 'wallMaxHp': return 'Nâng cấp vật liệu composite và từ trường cho rào chắn, tăng máu tối đa của trạm chỉ huy giúp chống đỡ siêu boss.';
        case 'wallRegen': return 'Tích hợp các robot nano tự động sửa chữa và hàn gắn các hư hại cấu trúc của rào chắn theo thời gian thực.';
        case 'wallThorns': return 'Gia cố gai thép nhiễm điện cao áp. Khi zombie cào vào rào chắn sẽ tự động nhận sát thương phản hồi mạnh.';
        case 'passiveScavenge': return 'Huy động drone tự động thu nhặt vàng vụn từ xác zombie. Mang lại +3 🪙/giây mỗi cấp nâng cấp.';
        case 'goldBoost': return 'Trang bị cảm biến quét kim loại tầm xa, tăng thêm +15% vàng rơi từ thây ma mỗi cấp nâng cấp.';
        default: return '';
    }
}

export function getMercDesc(id) {
    switch(id) {
        case 'merc_recruit': return 'Tân binh súng trường tầm trung. Bắn đạn chì tiêu chuẩn hỗ trợ phòng thủ. Chi phí thuê rẻ, nâng cấp dễ dàng.';
        case 'merc_sniper': return 'Xạ thủ bắn tỉa ẩn nấp từ phía sau. Tốc độ bắn chậm nhưng mỗi phát bắn gây sát thương cực lớn vào mục tiêu đi đầu.';
        case 'merc_gunner': return 'Binh sĩ vũ trang hạng nặng với súng máy liên thanh. Xả đạn liên tục tạo ra hỏa lực áp chế khủng khiếp lên bầy zombie.';
        case 'merc_medic': return 'Bác sĩ không trực tiếp chiến đấu. Tự động chăm sóc, sửa chữa rào chắn năng lượng liên tục mỗi giây.';
        case 'merc_drone': return 'Robot drone Sparky được thiết lập tuần tra tầm trung. Bay lơ lửng, quét nhiệt tự động bắn tia laze áp chế tốc độ cao.';
        default: return '';
    }
}

export function getMutationDesc(key) {
    switch(key) {
        case 'dnaDamageMult': return 'Kích hoạt các mã gen săn mồi trong tế bào, cường hóa sát thương cho mọi loại súng thêm +20% mỗi cấp đột biến.';
        case 'dnaWallShield': return 'Đột biến lớp vỏ chitin của rào chắn, khuếch đại tổng lượng máu rào chắn lên +20% mỗi cấp đột biến.';
        case 'dnaGoldDrop': return 'Biến đổi hóa học trong quá trình phân hủy xác sống, tăng lượng vàng rơi ra thêm +10% mỗi cấp đột biến.';
        case 'dnaCritRate': return 'Cải thiện nhãn quan chiến đấu của nhân vật chính, tăng vĩnh viễn +3% tỷ lệ chí mạng trên mỗi phát bắn.';
        case 'dnaReloadSpeed': return 'Biến đổi cấu trúc cơ tay của chiến binh, gia gia tăng tốc độ nạp đạn lên +7% mỗi cấp đột biến.';
        case 'dnaAirstrikeCo': return 'Cải tạo hệ thống truyền dẫn không kích, giảm thời gian cooldown của kỹ năng Không kích đi -8% mỗi cấp.';
        case 'dnaHiredPower': return 'Tiết ra hormone thống lĩnh giúp kích thích tinh thần chiến đấu của lính đánh thuê, tăng +25% hỏa lực/hồi phục đồng đội.';
        default: return '';
    }
}

export function renderShop() {
    const panel = document.getElementById('shop-panel');
    if (!panel) return;
    let html = '';
    const currentGold = gameState.gold;
    const currentDna = gameState.dna;

    if (activeTab.value === 'weapons') {
        gameState.weapons.forEach((w, index) => {
            const isUnlocked = w.unlocked;
            const cost = w.currentCost;
            const canAfford = currentGold >= cost;
            const activeMark = gameState.activeWeaponIndex === index;
            const nextLvlDmg = getWeaponNextDamage(w);
            const currentDmg = getWeaponDamage(w);
            
            const clipVal = w.clipSize ?? INITIAL_GAME_STATE.weapons[index].clipSize;
            const reloadSec = w.reloadTime ?? INITIAL_GAME_STATE.weapons[index].reloadTime;
            
            html += `
            <div class="bg-zinc-950 border ${activeMark ? 'border-red-600/50 shadow-[0_0_12px_rgba(239,68,68,0.1)]' : 'border-zinc-900'} p-2.5 rounded-xl flex flex-col gap-1 transition-all duration-300 group hover:bg-zinc-900/40 hover:border-zinc-800" title="${getWeaponDesc(w.id)}">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-bold font-tech ${isUnlocked ? 'text-zinc-200' : 'text-zinc-500'}">${w.name}</span>
                            ${activeMark ? '<span class="px-1.5 py-0.2 bg-red-600/10 border border-red-500/20 text-red-500 text-[7px] font-black rounded uppercase">ACTIVE</span>' : ''}
                        </div>
                        <p class="text-[10px] text-zinc-400 mt-1">
                            Cấp: <span class="text-white font-bold font-tech">${w.level}</span> | 
                            ST: <span class="text-orange-400 font-bold font-tech">${currentDmg}</span> 
                            ${isUnlocked ? `➔ <span class="text-emerald-400 font-bold font-tech">${nextLvlDmg}</span>` : ''}
                        </p>
                        <p class="text-[9px] text-zinc-500 mt-0.5">
                            Băng đạn: <span class="text-yellow-500 font-bold font-tech">${clipVal} viên</span> | 
                            Nạp đạn: <span class="text-red-400 font-bold font-tech">${reloadSec}s</span>
                        </p>
                    </div>
                    <div>
                        ${!isUnlocked ? `
                            <button data-cost="${cost}" data-currency="gold" data-active-class="bg-yellow-500 text-black hover:bg-yellow-400" onclick="window.game.unlockWeapon(${index})" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition active:scale-95 ${canAfford ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-zinc-900 text-zinc-650'}" ${!canAfford ? 'disabled' : ''}>
                                Mở: 🪙${formatNumber(cost)}
                            </button>
                        ` : `
                            <div class="flex flex-col gap-1">
                                <button data-cost="${cost}" data-currency="gold" data-active-class="bg-red-600 text-white hover:bg-red-500" onclick="window.game.upgradeWeapon(${index})" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition active:scale-95 ${canAfford ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-zinc-900 text-zinc-650'}" ${!canAfford ? 'disabled' : ''}>
                                    Cấp+: 🪙${formatNumber(cost)}
                                </button>
                                ${!activeMark ? `
                                    <button onclick="window.game.selectWeapon(${index})" class="px-2.5 py-0.5 bg-zinc-900 text-zinc-450 rounded text-[8px] uppercase font-bold tracking-wider hover:bg-zinc-850 transition">Trang bị</button>
                                ` : ''}
                            </div>
                        `}
                    </div>
                </div>
                <div class="max-h-0 overflow-hidden opacity-0 group-hover:max-h-20 group-hover:opacity-100 transition-all duration-300 text-[10px] text-zinc-500 border-t border-zinc-900/50 pt-0 group-hover:pt-1.5 mt-0 group-hover:mt-1 leading-normal font-medium">
                    ${getWeaponDesc(w.id)}
                </div>
            </div>`;
        });
    } else if (activeTab.value === 'defense') {
        const maxHpLvl = (gameState.wallMaxHp - 100) / 20;
        const wallRegenLvl = Math.round(gameState.wallRegen / 0.5);
        const wallThornsLvl = Math.round(gameState.wallThorns / 1.5);
        const passiveScavLvl = gameState.statUpgrades.passiveScavenge;
        const goldBoostLvl = gameState.statUpgrades.goldBoost || 0;

        const upgrades = [
            { key: 'wallMaxHp', name: 'Độ Bền Rào Năng Lượng', pseudoLvl: maxHpLvl, current: gameState.wallMaxHp, cost: Math.round(15 * Math.pow(1.22, maxHpLvl)), icon: 'fa-shield-heart' },
            { key: 'wallRegen', name: 'Mô-đun Tự Động Vá Lỗi', pseudoLvl: wallRegenLvl, current: gameState.wallRegen.toFixed(1) + " HP/s", cost: Math.round(40 * Math.pow(1.32, wallRegenLvl)), icon: 'fa-heart-pulse' },
            { key: 'wallThorns', name: 'Gai Phản Hồi Điện Kháng', pseudoLvl: wallThornsLvl, current: gameState.wallThorns.toFixed(1) + " Dame", cost: Math.round(55 * Math.pow(1.28, wallThornsLvl)), icon: 'fa-hand-fist' },
            { key: 'passiveScavenge', name: 'Biệt Đội Quét Vàng (Idle)', pseudoLvl: passiveScavLvl, current: `Cấp ${passiveScavLvl} (${(passiveScavLvl * 3)} 🪙/s)`, cost: Math.round(20 * Math.pow(1.20, passiveScavLvl)), icon: 'fa-coins' },
            { key: 'goldBoost', name: 'Máy Dò Kim Loại (+15% Vàng Rơi)', pseudoLvl: goldBoostLvl, current: `Cấp ${goldBoostLvl} (+${(goldBoostLvl * 15)}%)`, cost: Math.round(25 * Math.pow(1.22, goldBoostLvl)), icon: 'fa-sack-dollar' }
        ];

        upgrades.forEach(u => {
            const canAfford = currentGold >= u.cost;
            html += `
            <div class="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl flex flex-col gap-1 transition-all duration-300 group hover:bg-zinc-900/40 hover:border-zinc-800" title="${getDefenseDesc(u.key)}">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex-1 flex items-center gap-2.5">
                        <div class="w-7 h-7 rounded bg-zinc-900 border border-zinc-850 flex items-center justify-center text-red-500 text-xs"><i class="fa-solid ${u.icon}"></i></div>
                        <div>
                            <span class="text-xs font-bold font-tech block text-zinc-200">${u.name}</span>
                            <p class="text-[10px] text-zinc-400 mt-0.5">Cấp: <span class="text-white font-bold font-tech">${u.current}</span></p>
                        </div>
                    </div>
                    <button data-cost="${u.cost}" data-currency="gold" data-active-class="bg-red-600 text-white hover:bg-red-500" onclick="window.game.upgradeDefense('${u.key}', ${u.cost}, ${u.pseudoLvl})" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition active:scale-95 ${canAfford ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-zinc-900 text-zinc-650'}" ${!canAfford ? 'disabled' : ''}>
                        Nâng: 🪙${formatNumber(u.cost)}
                    </button>
                </div>
                <div class="max-h-0 overflow-hidden opacity-0 group-hover:max-h-20 group-hover:opacity-100 transition-all duration-300 text-[10px] text-zinc-500 border-t border-zinc-900/50 pt-0 group-hover:pt-1.5 mt-0 group-hover:mt-1 leading-normal font-medium">
                    ${getDefenseDesc(u.key)}
                </div>
            </div>`;
        });
    } else if (activeTab.value === 'mercs') {
        gameState.mercenaries.forEach((m, idx) => {
            const isHired = m.hired;
            const cost = m.currentCost;
            const canAfford = currentGold >= cost;

            const levelPowerMult = Math.pow(1.22 + (m.level * 0.003), m.level - 1);
            const nextPowerMult = Math.pow(1.22 + ((m.level + 1) * 0.003), m.level);

            const hiredPowerLvl = gameState.mutations.dnaHiredPower ? gameState.mutations.dnaHiredPower.level : 0;
            const hiredPowerMod = 1 + (hiredPowerLvl * (gameState.mutations.dnaHiredPower ? gameState.mutations.dnaHiredPower.mult : 0.25));

            let currentStat, nextStat;
            if (m.id === 'merc_medic') {
                const currentHeal = m.wallRegenInc * m.level * Math.pow(1.15, m.level - 1) * hiredPowerMod;
                const nextHeal = m.wallRegenInc * (m.level + 1) * Math.pow(1.15, m.level) * hiredPowerMod;
                currentStat = `${currentHeal.toFixed(1)} HP/s`;
                nextStat = `${nextHeal.toFixed(1)} HP/s`;
            } else {
                currentStat = `${formatNumber(Math.round(m.baseDps * levelPowerMult * hiredPowerMod))} DPS`;
                nextStat = `${formatNumber(Math.round(m.baseDps * nextPowerMult * hiredPowerMod))} DPS`;
            }

            html += `
            <div class="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl flex flex-col gap-1 transition-all duration-300 group hover:bg-zinc-900/40 hover:border-zinc-800" title="${getMercDesc(m.id)}">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex-1">
                        <span class="text-xs font-bold font-tech text-zinc-200 block">${m.name}</span>
                        <p class="text-[10px] text-zinc-400 mt-1">
                            Cấp: <span class="text-white font-bold font-tech">${m.level}</span> | 
                            Tác chiến: <span class="text-orange-400 font-bold font-tech">${isHired ? currentStat : 'Chưa Thuê'}</span>
                            ${isHired ? `➔ <span class="text-emerald-400 font-bold font-tech">${nextStat}</span>` : ''}
                        </p>
                    </div>
                    <button data-cost="${cost}" data-currency="gold" data-active-class="bg-red-600 text-white hover:bg-red-500" onclick="window.game.hireOrUpgradeMerc(${idx})" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition active:scale-95 ${canAfford ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-zinc-900 text-zinc-650'}" ${!canAfford ? 'disabled' : ''}>
                        ${isHired ? 'Nâng' : 'Thuê'}: 🪙${formatNumber(cost)}
                    </button>
                </div>
                <div class="max-h-0 overflow-hidden opacity-0 group-hover:max-h-20 group-hover:opacity-100 transition-all duration-300 text-[10px] text-zinc-500 border-t border-zinc-900/50 pt-0 group-hover:pt-1.5 mt-0 group-hover:mt-1 leading-normal font-medium">
                    ${getMercDesc(m.id)}
                </div>
            </div>`;
        });
    } else if (activeTab.value === 'mutations') {
        Object.keys(gameState.mutations).forEach(k => {
            const mut = gameState.mutations[k];
            const cost = mut.cost + mut.level * 4;
            const canAfford = currentDna >= cost;
            const boostPercent = (mut.level * mut.mult * 100).toFixed(0);
            
            html += `
            <div class="bg-zinc-950 border border-emerald-950/40 p-2.5 rounded-xl flex flex-col gap-1 transition-all duration-300 group hover:bg-zinc-900/40 hover:border-zinc-800" title="${getMutationDesc(k)}">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex-1">
                        <span class="text-xs font-bold font-tech text-emerald-400 block">${mut.name}</span>
                        <p class="text-[10px] text-zinc-400 mt-1">Đột biến: <span class="text-white font-bold font-tech">${mut.level}</span> (Hiệu quả: <span class="text-emerald-400 font-bold">+${boostPercent}%</span>)</p>
                    </div>
                    <button data-cost="${cost}" data-currency="dna" data-active-class="bg-emerald-600 text-white hover:bg-emerald-500" onclick="window.game.evolveMutation('${k}', ${cost})" class="px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase transition active:scale-95 ${canAfford ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-zinc-900 text-zinc-650'}" ${!canAfford ? 'disabled' : ''}>
                        Gen: 🧬${cost}
                    </button>
                </div>
                <div class="max-h-0 overflow-hidden opacity-0 group-hover:max-h-20 group-hover:opacity-100 transition-all duration-300 text-[10px] text-zinc-500 border-t border-zinc-900/50 pt-0 group-hover:pt-1.5 mt-0 group-hover:mt-1 leading-normal font-medium">
                    ${getMutationDesc(k)}
                </div>
            </div>`;
        });
    }

    panel.innerHTML = html;
}

export function unlockWeapon(index) {
    const wep = gameState.weapons[index];
    const cost = getWeaponUpgradeCost(wep);
    if (gameState.gold >= cost) {
        gameState.gold -= cost;
        wep.unlocked = true;
        wep.level = 1;
        wep.currentCost = getWeaponUpgradeCost(wep);
        wep.currentClip = wep.clipSize;
        gameState.activeWeaponIndex = index;
        
        isReloading.value = false;
        reloadTimer.value = 0;

        playUpgradeChime();
        saveGameData(true);
        renderShop();
        dispatchDOMUpdates();
        
        showModal('Chi Viện Đặc Biệt!', `Đã phân phối vũ khí hỏa lực cao cấp: ${wep.name}`);
    }
}

export function upgradeWeapon(index) {
    const wep = gameState.weapons[index];
    const cost = getWeaponUpgradeCost(wep);
    if (gameState.gold >= cost) {
        gameState.gold -= cost;
        wep.level++;
        wep.currentCost = getWeaponUpgradeCost(wep);
        wep.currentClip = wep.clipSize;
        
        if (gameState.activeWeaponIndex === index) {
            isReloading.value = false;
            reloadTimer.value = 0;
        }

        playUpgradeChime();
        saveGameData(true);
        renderShop();
        dispatchDOMUpdates();
        
        spawnExplosion(player.x + 10, player.y, '#eab308', 5);
    }
}

export function selectWeapon(index) {
    gameState.activeWeaponIndex = index;
    isReloading.value = false;
    reloadTimer.value = 0;
    
    saveGameData(true);
    renderShop();
}

export function upgradeDefense(key, cost, pseudoLvl) {
    if (gameState.gold >= cost) {
        gameState.gold -= cost;
        
        if (key === 'wallMaxHp') {
            const bonus = Math.round(20 * Math.pow(1.12, pseudoLvl));
            gameState.wallMaxHp += bonus;
            const shieldDnaMod = 1 + (gameState.mutations.dnaWallShield.level * gameState.mutations.dnaWallShield.mult);
            gameState.wallHp = Math.round(gameState.wallMaxHp * shieldDnaMod); 
        } else if (key === 'wallRegen') {
            const bonus = 0.5 * Math.pow(1.15, pseudoLvl);
            gameState.wallRegen += bonus;
        } else if (key === 'wallThorns') {
            const bonus = 1.5 * Math.pow(1.15, pseudoLvl);
            gameState.wallThorns += bonus;
        } else if (key === 'passiveScavenge') {
            gameState.statUpgrades.passiveScavenge++;
        } else if (key === 'goldBoost') {
            gameState.statUpgrades.goldBoost = (gameState.statUpgrades.goldBoost || 0) + 1;
        }

        playUpgradeChime();
        saveGameData(true);
        renderShop();
        dispatchDOMUpdates();
    }
}

export function hireOrUpgradeMerc(idx) {
    const m = gameState.mercenaries[idx];
    if (gameState.gold >= m.currentCost) {
        gameState.gold -= m.currentCost;
        
        if (!m.hired) {
            m.hired = true;
            m.level = 1;
        } else {
            m.level++;
        }
        
        m.currentCost = Math.round(m.currentCost * 1.55);
        playUpgradeChime();
        saveGameData(true);
        renderShop();
        dispatchDOMUpdates();
        
        showModal('Đã Đưa Quân Đến!', `Đồng đội đắc lực mới gia nhập phòng tuyến: ${m.name}`);
    }
}

export function evolveMutation(key, cost) {
    if (gameState.dna >= cost) {
        gameState.dna -= cost;
        gameState.mutations[key].level++;
        
        playUpgradeChime();
        saveGameData(true);
        renderShop();
        dispatchDOMUpdates();
    }
}
