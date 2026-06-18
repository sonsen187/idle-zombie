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
        { id: 'pistol', name: 'Súng Colt .45', level: 1, baseDamage: 4, baseCost: 10, currentCost: 10, unlocked: true, clipSize: 12, currentClip: 12, reloadTime: 1.2, shootInterval: 0.42 },
        { id: 'smg', name: 'Tiểu Liên Uzi', level: 0, baseDamage: 5, baseCost: 120, currentCost: 120, unlocked: false, clipSize: 30, currentClip: 30, reloadTime: 1.5, shootInterval: 0.09 },
        { id: 'shotgun', name: 'Shotgun M870', level: 0, baseDamage: 120, baseCost: 1000, currentCost: 1000, unlocked: false, clipSize: 8, currentClip: 8, reloadTime: 1.8, shootInterval: 1.0 },
        { id: 'rifle', name: 'Trường Sa AR-15', level: 0, baseDamage: 75, baseCost: 8000, currentCost: 8000, unlocked: false, clipSize: 35, currentClip: 35, reloadTime: 1.8, shootInterval: 0.16 },
        { id: 'flame', name: 'Hỏa Thần Hellfire', level: 0, baseDamage: 35, baseCost: 45000, currentCost: 45000, unlocked: false, clipSize: 120, currentClip: 120, reloadTime: 2.0, shootInterval: 0.05 },
        { id: 'plasma', name: 'Pháo Laze Plasma', level: 0, baseDamage: 1500, baseCost: 220000, currentCost: 220000, unlocked: false, clipSize: 6, currentClip: 6, reloadTime: 2.4, shootInterval: 1.25 },
        { id: 'gatling', name: 'Súng Máy 6 Nòng Vàng', level: 0, baseDamage: 320, baseCost: 1100000, currentCost: 1100000, unlocked: false, clipSize: 150, currentClip: 150, reloadTime: 3.0, shootInterval: 0.04 },
        { id: 'freeze', name: 'Băng Thần Blizzard', level: 0, baseDamage: 2200, baseCost: 4800000, currentCost: 4800000, unlocked: false, clipSize: 20, currentClip: 20, reloadTime: 2.2, shootInterval: 0.45 },
        { id: 'tesla', name: 'Bão Sét Tesla', level: 0, baseDamage: 2600, baseCost: 24000000, currentCost: 24000000, unlocked: false, clipSize: 45, currentClip: 45, reloadTime: 2.0, shootInterval: 0.14 },
        { id: 'nuclear', name: 'Pháo Phân Rã Hạt Nhân', level: 0, baseDamage: 120000, baseCost: 120000000, currentCost: 120000000, unlocked: false, clipSize: 3, currentClip: 3, reloadTime: 4.2, shootInterval: 2.8 }
    ],
    mercenaries: [
        { id: 'merc_recruit', name: 'Binh Nhất Jack', level: 0, baseDps: 15, dpsScale: 7.5, baseCost: 180, currentCost: 180, hired: false, fireTimer: 0 },
        { id: 'merc_sniper', name: 'Sniper Bóng Đêm', level: 0, baseDps: 90, dpsScale: 45, baseCost: 12000, currentCost: 12000, hired: false, fireTimer: 0 },
        { id: 'merc_medic', name: 'Bác Sĩ Trận Địa', level: 0, baseDps: 0, dpsScale: 0, wallRegenInc: 3, baseCost: 2800, currentCost: 2800, hired: false, fireTimer: 0 },
        { id: 'merc_gunner', name: 'Trọng Liên Heavy', level: 0, baseDps: 450, dpsScale: 220, baseCost: 1500000, currentCost: 1500000, hired: false, fireTimer: 0 },
        { id: 'merc_drone', name: 'Robot Drone Sparky', level: 0, baseDps: 1500, dpsScale: 750, baseCost: 280000, currentCost: 280000, hired: false, fireTimer: 0 }
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
