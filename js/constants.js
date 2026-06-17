export const STORAGE_KEY = 'ZombieIdleSurvivorPC_v5_hyper_progressive';

export const INITIAL_GAME_STATE = {
    gold: 0,
    dna: 0,
    wave: 1,
    waveProgress: 0,
    maxWave: 1,
    wallHp: 100,
    wallMaxHp: 100,
    wallRegen: 0,
    wallThorns: 0,
    activeWeaponIndex: 0,
    isDefeated: false,
    soundMuted: false,
    autoFire: true,
    statUpgrades: {
        tapDamage: 1,
        critChance: 1,
        critMultiplier: 1,
        passiveScavenge: 0,
        goldBoost: 0
    },
    weapons: [
        { id: 'pistol', name: 'Súng Colt .45', level: 1, baseDamage: 4, damageScale: 1.5, baseCost: 10, currentCost: 4, unlocked: true, clipSize: 12, currentClip: 12, reloadTime: 1.2 },
        { id: 'smg', name: 'Tiểu Liên Uzi', level: 0, baseDamage: 9, damageScale: 3.8, baseCost: 150, currentCost: 150, unlocked: false, clipSize: 30, currentClip: 30, reloadTime: 1.5 },
        { id: 'shotgun', name: 'Shotgun M870', level: 0, baseDamage: 36, damageScale: 15, baseCost: 950, currentCost: 950, unlocked: false, clipSize: 8, currentClip: 8, reloadTime: 2.0 },
        { id: 'rifle', name: 'Trường Sa AR-15', level: 0, baseDamage: 55, damageScale: 24, baseCost: 4800, currentCost: 4800, unlocked: false, clipSize: 30, currentClip: 30, reloadTime: 1.8 },
        { id: 'flame', name: 'Hỏa Thần Hellfire', level: 0, baseDamage: 12, damageScale: 5.2, baseCost: 14000, currentCost: 14000, unlocked: false, clipSize: 60, currentClip: 60, reloadTime: 2.2 },
        { id: 'plasma', name: 'Pháo Laze Plasma', level: 0, baseDamage: 160, damageScale: 75, baseCost: 28000, currentCost: 28000, unlocked: false, clipSize: 5, currentClip: 5, reloadTime: 2.5 },
        { id: 'gatling', name: 'Súng Máy 6 Nòng Vàng', level: 0, baseDamage: 380, damageScale: 180, baseCost: 150000, currentCost: 150000, unlocked: false, clipSize: 100, currentClip: 100, reloadTime: 3.5 },
        { id: 'freeze', name: 'Băng Thần Blizzard', level: 0, baseDamage: 45, damageScale: 21, baseCost: 320000, currentCost: 320000, unlocked: false, clipSize: 15, currentClip: 15, reloadTime: 2.0 },
        { id: 'tesla', name: 'Bão Sét Tesla', level: 0, baseDamage: 950, damageScale: 450, baseCost: 750000, currentCost: 750000, unlocked: false, clipSize: 45, currentClip: 45, reloadTime: 2.2 },
        { id: 'nuclear', name: 'Pháo Phân Rã Hạt Nhân', level: 0, baseDamage: 4800, damageScale: 2250, baseCost: 3500000, currentCost: 3500000, unlocked: false, clipSize: 3, currentClip: 3, reloadTime: 4.5 }
    ],
    mercenaries: [
        { id: 'merc_recruit', name: 'Binh Nhất Jack', level: 0, baseDps: 3, dpsScale: 1.5, baseCost: 60, currentCost: 60, hired: false, fireTimer: 0 },
        { id: 'merc_sniper', name: 'Sniper Bóng Đêm', level: 0, baseDps: 18, dpsScale: 9.5, baseCost: 600, currentCost: 600, hired: false, fireTimer: 0 },
        { id: 'merc_gunner', name: 'Trọng Liên Heavy', level: 0, baseDps: 90, dpsScale: 45, baseCost: 5000, currentCost: 5000, hired: false, fireTimer: 0 },
        { id: 'merc_medic', name: 'Bác Sĩ Trận Địa', level: 0, baseDps: 0, dpsScale: 0, wallRegenInc: 3, baseCost: 2500, currentCost: 2500, hired: false, fireTimer: 0 },
        { id: 'merc_drone', name: 'Robot Drone Sparky', level: 0, baseDps: 280, dpsScale: 140, baseCost: 35000, currentCost: 35000, hired: false, fireTimer: 0 }
    ],
    mutations: {
        dnaDamageMult: { level: 0, cost: 5, mult: 0.20, name: 'Sợi Gen Sát Thủ (+20% Sát Thương)' },
        dnaWallShield: { level: 0, cost: 8, mult: 0.20, name: 'Gia Cố Năng Lượng (+20% Máu Trạm)' },
        dnaGoldDrop: { level: 0, cost: 6, mult: 0.10, name: 'Hóa Chemical (+10% Vàng Rơi)' },
        dnaCritRate: { level: 0, cost: 10, mult: 0.03, name: 'Đột Biến Nhãn Quan (+3% Chí Mạng)' },
        dnaReloadSpeed: { level: 0, cost: 12, mult: 0.07, name: 'Sợi Cơ Học (-7% Giờ Nạp Đạn)' },
        dnaAirstrikeCo: { level: 0, cost: 15, mult: 0.08, name: 'Phóng Xạ Không Kích (-8% Cooldown)' },
        dnaHiredPower: { level: 0, cost: 10, mult: 0.25, name: 'Tế Bào Thống Lĩnh (+25% Sức Mạnh Đồng Đội)' }
    }
};

// Realistic Weapon & Combat Audio System files
export const realisticSoundFiles = {
    pistol: "assets/audio/deagle.wav",
    smg: "assets/audio/uzi.wav",
    shotgun: "assets/audio/pumpshotgun.wav",
    rifle: "assets/audio/ak47.wav",
    gatling: "assets/audio/m249.wav",
    explosion: "assets/audio/explosion.wav",
    reload: "assets/audio/ak47_reload.mp3",
    crit: "assets/audio/hit_sound.mp3",
    launch: "assets/audio/heavysniper.wav",
    plasma: "assets/audio/plasma.wav",
    flame: "assets/audio/flame.ogg"
};

export const POOL_SIZE_PER_SOUND = 8;

export const MAX_PARTICLES = 120;
export const MAX_BULLETS = 250;
export const MAX_TEXTS = 30;
export const MAX_CONCURRENT_ZOMBIES = 120;

export const DOM_UPDATE_INTERVAL = 0.1;
export const REPAIR_TIME_MAX = 5.0;
