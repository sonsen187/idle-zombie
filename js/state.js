import { INITIAL_GAME_STATE } from './constants.js';

// Deep clone initial state
export let gameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));

// Setters for gameState since ES6 exports are read-only for importers
export function setGameState(newState) {
    gameState = newState;
}

// Audio state variables
export let audioInitialized = { value: false };
export let audioMuted = { value: false };
export let realisticAudioInitialized = { value: false };
export let toneBuffersLoaded = { value: false };

// Pools and Arrays
export const realisticAudioPools = {};
export const toneBuffers = {};
export const airDrops = [];
export let activeBomberPlanes = [];
export let activeAirstrikeBombs = [];
export let activeFlashes = [];

export function setActiveBomberPlanes(val) { activeBomberPlanes = val; }
export function setActiveAirstrikeBombs(val) { activeAirstrikeBombs = val; }
export function setActiveFlashes(val) { activeFlashes = val; }

// Object pools (to be populated)
export const particlePool = [];
export const bulletPool = [];
export const textPool = [];
// Pixi references grouped into a single object wrapper to prevent ESM live-binding updates issues
export const pixi = {
    app: null,
    ready: false,
    shakeContainer: null,
    bgGraphics: null,
    bloodTexture: null,
    bloodSprite: null,
    barricadeGraphics: null,
    zombiesContainer: null,
    bulletsGraphics: null,
    particlesGraphics: null,
    airDropsContainer: null,
    bombersGraphics: null,
    ambientGraphics: null,
    pixiTextPool: []
};

// Player Class
class Player {
    constructor() {
        this.x = 400;
        this.y = 500;
        this.targetX = 400;
        this.angle = -Math.PI / 2;
        this.screenAngle = -Math.PI / 2;
        this.speed = 180;
        this.walkCycle = 0;
        this.recoil = 0;
        this.recoilSpread = 0;
        this.flashTimer = 0;
        this.graphics = null;
    }
}
export const player = new Player();

// Canvas reference
export let canvas = null;
export function setCanvas(c) {
    canvas = c;
}

// Game Loop / Engine states
export let isPaused = { value: false };
export const keysPressed = {
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false
};
export const mousePosition = { x: 0, y: 0 };
export const isMouseDown = { value: false };
export let lastTime = { value: 0 };
export let framesThisSecond = { value: 0 };
export let lastFpsUpdate = { value: 0 };
export let fps = { value: 0 };
export let domUpdateTimer = { value: 0 };
export let waveTimer = { value: 0 };
export let dayNightCycle = { value: 0 };
export let mainWeaponShootTimer = { value: 0 };
export let autosaveTimer = { value: 0 };
export let activeTab = { value: 'weapons' };
export let zombies = [];
export let shakeTime = { value: 0 };
export let baseRepairTimer = { value: 0 };

export function setZombies(newZombies) {
    zombies.length = 0;
    newZombies.forEach(z => zombies.push(z));
}

// Skills states
export const skillsCooldown = { airstrike: 0, overclock: 0 };
export const activeSkillsDuration = { overclock: 0 };

// Ammo and reload global logic variables
export let isReloading = { value: false };
export let reloadTimer = { value: 0 };

// Advanced Tone.js Nodes for Synth Audio
export const audioNodes = {
    masterCompressor: null,
    combatDelay: null,
    distortionNode: null,
    transientOsc: null,
    transientEnv: null,
    transientFilter: null,
    noiseGen: null,
    noiseEnv: null,
    noiseFilter: null,
    subOsc: null,
    subEnv: null,
    plasmaOsc: null,
    plasmaEnv: null,
    plasmaFilter: null,
    chimeSynth: null
};
export function setAudioNode(key, node) {
    audioNodes[key] = node;
}
