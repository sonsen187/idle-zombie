import { 
    realisticSoundFiles, 
    POOL_SIZE_PER_SOUND 
} from './constants.js';

import { 
    audioInitialized, 
    audioMuted, 
    realisticAudioInitialized, 
    toneBuffersLoaded,
    realisticAudioPools,
    toneBuffers,
    audioNodes,
    setAudioNode
} from './state.js';

export function initToneBuffers() {
    if (toneBuffersLoaded.value) return;
    try {
        for (const [key, path] of Object.entries(realisticSoundFiles)) {
            toneBuffers[key] = new Tone.Buffer(path);
        }
        toneBuffersLoaded.value = true;
        console.log("Tone.js buffers initialization started.");
    } catch (e) {
        console.warn("Failed to init Tone.js buffers:", e);
    }
}

export function initRealisticAudio() {
    if (realisticAudioInitialized.value) return;
    try {
        for (const [key, path] of Object.entries(realisticSoundFiles)) {
            realisticAudioPools[key] = [];
            for (let i = 0; i < POOL_SIZE_PER_SOUND; i++) {
                const audio = new Audio(path);
                audio.preload = "auto";
                audio.load();
                realisticAudioPools[key].push(audio);
            }
        }
        realisticAudioInitialized.value = true;
        console.log("Realistic Combat Audio Pool initialized.");
    } catch (e) {
        console.warn("Failed to initialize realistic audio pools:", e);
    }
}

export function playRealisticSound(key, volume = 0.5) {
    if (audioMuted.value) return false;

    // Try Tone.js BufferSource first for ultra-low latency play
    if (toneBuffersLoaded.value && toneBuffers[key] && toneBuffers[key].loaded) {
        try {
            const buffer = toneBuffers[key];
            const source = new Tone.BufferSource(buffer);
            const db = 20 * Math.log10(Math.max(0.01, volume));
            const volumeNode = new Tone.Volume(db);
            
            if (audioNodes.masterCompressor) {
                source.chain(volumeNode, audioNodes.masterCompressor);
            } else {
                source.chain(volumeNode, Tone.Destination);
            }
            source.start();
            return true;
        } catch (e) {
            console.warn("Tone.BufferSource failed, falling back to HTML5 Audio:", e);
        }
    }

    if (!realisticAudioInitialized.value) {
        initRealisticAudio();
    }
    const pool = realisticAudioPools[key];
    if (!pool || pool.length === 0) return false;
    
    // Find an audio instance that is idle
    let audio = pool.find(a => a.paused || a.ended);
    if (!audio) {
        // Recycle the oldest one
        audio = pool[0];
        pool.push(pool.shift());
    }
    
    try {
        audio.currentTime = 0;
        audio.volume = volume;
        audio.play().catch(e => {
            // Autoplay blocks or loading delays
        });
        return true;
    } catch (e) {
        console.warn("Error playing realistic sound: " + key, e);
        return false;
    }
}

export function playRealSound(spriteName) {
    // Disabled legacy sound sprite (fx_mixdown.mp3) to improve performance and mute undesired sounds
    return false;
}

export function initAudioEngine() {
    if (audioInitialized.value) return;
    initRealisticAudio();
    try {
        Tone.start();
        initToneBuffers();

        // 1. Master Compression to glue sounds together, prevent clipping and maximize power
        const masterCompressor = new Tone.Compressor({
            threshold: -12,
            ratio: 4,
            attack: 0.02,
            release: 0.08
        }).toDestination();
        setAudioNode('masterCompressor', masterCompressor);

        // 2. Battlefield reflection simulation (Empty urban decay streets acoustics)
        const combatDelay = new Tone.FeedbackDelay({
            delayTime: "32n",
            feedback: 0.18,
            wet: 0.15
        }).connect(masterCompressor);
        setAudioNode('combatDelay', combatDelay);

        // 3. Distortion node for realistic grit/saturation on physical blasts
        const distortionNode = new Tone.Distortion({
            distortion: 0.28,
            wet: 0.35
        }).connect(combatDelay);
        setAudioNode('distortionNode', distortionNode);

        // 4. Transient/Punch generator (Simulates dry projectile slap and bolt clack)
        const transientFilter = new Tone.Filter({ type: "lowpass", frequency: 1500 }).connect(distortionNode);
        setAudioNode('transientFilter', transientFilter);
        const transientEnv = new Tone.AmplitudeEnvelope({
            attack: 0.001,
            decay: 0.05,
            sustain: 0,
            release: 0.04
        }).connect(transientFilter);
        setAudioNode('transientEnv', transientEnv);
        const transientOsc = new Tone.Oscillator({ type: "sawtooth", frequency: 220 }).connect(transientEnv);
        setAudioNode('transientOsc', transientOsc);
        transientOsc.start();

        // 5. Blast/Gas Expansion (Custom Filtered Noise Generator)
        const noiseFilter = new Tone.Filter({ type: "bandpass", frequency: 900, Q: 2 }).connect(distortionNode);
        setAudioNode('noiseFilter', noiseFilter);
        const noiseEnv = new Tone.AmplitudeEnvelope({
            attack: 0.002,
            decay: 0.08,
            sustain: 0,
            release: 0.08
        }).connect(noiseFilter);
        setAudioNode('noiseEnv', noiseEnv);
        const noiseGen = new Tone.Noise({ type: "pink" }).connect(noiseEnv);
        setAudioNode('noiseGen', noiseGen);
        noiseGen.start();

        // 6. Deep Sub-Bass Rumble (Low frequency punch for high caliber weaponry)
        const subEnv = new Tone.AmplitudeEnvelope({
            attack: 0.004,
            decay: 0.22,
            sustain: 0,
            release: 0.22
        }).connect(masterCompressor); // Sub bass bypasses delay & saturation for clean tactile punch
        setAudioNode('subEnv', subEnv);
        const subOsc = new Tone.Oscillator({ type: "sine", frequency: 75 }).connect(subEnv);
        setAudioNode('subOsc', subOsc);
        subOsc.start();

        // 7. Futuristic Energy weapon synthesis (Plasma Emitter Synth)
        const plasmaFilter = new Tone.Filter({ type: "bandpass", frequency: 2400, Q: 5 }).connect(combatDelay);
        setAudioNode('plasmaFilter', plasmaFilter);
        const plasmaEnv = new Tone.AmplitudeEnvelope({
            attack: 0.008,
            decay: 0.25,
            sustain: 0.02,
            release: 0.12
        }).connect(plasmaFilter);
        setAudioNode('plasmaEnv', plasmaEnv);
        const plasmaOsc = new Tone.Oscillator({ type: "square", frequency: 550 }).connect(plasmaEnv);
        setAudioNode('plasmaOsc', plasmaOsc);
        plasmaOsc.start();

        // 8. Chime Synth for UI/Rewards/Crits (Hi-tech clean bell tones)
        const chimeSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.008, decay: 0.18, sustain: 0.1, release: 0.35 }
        }).connect(masterCompressor);
        chimeSynth.volume.value = -9;
        setAudioNode('chimeSynth', chimeSynth);

        audioInitialized.value = true;
        console.log("Tactical Audio Engine initialized successfully.");
    } catch (e) {
        console.warn("Audio context restricted by browser security policies.", e);
    }
}

export function playShootSound(type) {
    if (audioMuted.value) return;

    // Try playing realistic gunshot sound first
    let playedReal = false;
    if (type === 'pistol') {
        playedReal = playRealisticSound('pistol', 0.45);
    } else if (type === 'smg') {
        playedReal = playRealisticSound('smg', 0.4);
    } else if (type === 'shotgun') {
        playedReal = playRealisticSound('shotgun', 0.55);
    } else if (type === 'rifle') {
        playedReal = playRealisticSound('rifle', 0.45);
    } else if (type === 'gatling') {
        playedReal = playRealisticSound('gatling', 0.45);
    } else if (type === 'nuclear') {
        playedReal = playRealisticSound('launch', 0.6); // Realistic heavy launcher thump
    } else if (type === 'plasma') {
        playedReal = playRealisticSound('plasma', 0.5);
    } else if (type === 'flame') {
        playedReal = playRealisticSound('flame', 0.4);
    }

    if (!playedReal) {
        // Fallback to legacy audio sprite
        if (type === 'shotgun') {
            playedReal = playRealSound('squit');
        } else if (type === 'nuclear') {
            playedReal = playRealSound('alien death');
        } else if (['pistol', 'smg', 'rifle', 'gatling'].includes(type)) {
            playedReal = playRealSound('shot');
        }
    }

    // Fallback to Tone.js if real sound failed or it is an energy weapon
    if (!playedReal && audioInitialized.value) {
        try {
            const now = Tone.now();
            const { 
                transientOsc, transientEnv, 
                noiseFilter, noiseEnv, 
                subOsc, subEnv,
                plasmaOsc, plasmaFilter, plasmaEnv 
            } = audioNodes;

            if (type === 'pistol') {
                transientOsc.frequency.setValueAtTime(450, now);
                transientOsc.frequency.exponentialRampToValueAtTime(80, now + 0.04);
                transientEnv.decay = 0.035;
                transientEnv.triggerAttackRelease("32n", now);

                noiseFilter.type = "bandpass";
                noiseFilter.frequency.setValueAtTime(1100, now);
                noiseEnv.decay = 0.045;
                noiseEnv.triggerAttackRelease("32n", now);

                subOsc.frequency.setValueAtTime(95, now);
                subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.05);
                subEnv.decay = 0.05;
                subEnv.triggerAttackRelease("32n", now);

            } else if (type === 'smg') {
                transientOsc.frequency.setValueAtTime(620, now);
                transientOsc.frequency.exponentialRampToValueAtTime(110, now + 0.025);
                transientEnv.decay = 0.018;
                transientEnv.triggerAttackRelease("64n", now);

                noiseFilter.type = "highpass";
                noiseFilter.frequency.setValueAtTime(1800, now);
                noiseEnv.decay = 0.028;
                noiseEnv.triggerAttackRelease("64n", now);

                subOsc.frequency.setValueAtTime(115, now);
                subOsc.frequency.exponentialRampToValueAtTime(55, now + 0.03);
                subEnv.decay = 0.028;
                subEnv.triggerAttackRelease("64n", now);

            } else if (type === 'rifle') {
                transientOsc.frequency.setValueAtTime(850, now);
                transientOsc.frequency.exponentialRampToValueAtTime(90, now + 0.065);
                transientEnv.decay = 0.055;
                transientEnv.triggerAttackRelease("16n", now);

                noiseFilter.type = "lowpass";
                noiseFilter.frequency.setValueAtTime(1500, now);
                noiseFilter.frequency.exponentialRampToValueAtTime(350, now + 0.08);
                noiseEnv.decay = 0.11;
                noiseEnv.triggerAttackRelease("16n", now);

                subOsc.frequency.setValueAtTime(110, now);
                subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.11);
                subEnv.decay = 0.14;
                subEnv.triggerAttackRelease("16n", now);

            } else if (type === 'shotgun') {
                const pelletOffsets = [0, 0.003, 0.007, 0.012, 0.018, 0.024, 0.031, 0.039];
                pelletOffsets.forEach((delayTime) => {
                    const t = now + delayTime;
                    transientOsc.frequency.setValueAtTime(280 + Math.random() * 80, t);
                    transientOsc.frequency.exponentialRampToValueAtTime(35, t + 0.03);
                    transientEnv.triggerAttackRelease("64n", t);

                    noiseFilter.type = "bandpass";
                    noiseFilter.frequency.setValueAtTime(850 + Math.random() * 300, t);
                    noiseFilter.Q.setValueAtTime(1.8, t);
                    noiseEnv.triggerAttackRelease("64n", t);
                });

                subOsc.frequency.setValueAtTime(68, now);
                subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.24);
                subEnv.decay = 0.32;
                subEnv.triggerAttackRelease("8n", now);

            } else if (type === 'plasma') {
                plasmaOsc.frequency.setValueAtTime(150, now);
                plasmaOsc.frequency.exponentialRampToValueAtTime(1600, now + 0.14);
                plasmaFilter.frequency.setValueAtTime(120, now);
                plasmaFilter.frequency.exponentialRampToValueAtTime(3400, now + 0.16);
                plasmaEnv.decay = 0.2;
                plasmaEnv.triggerAttackRelease("8n", now);

                noiseFilter.type = "highpass";
                noiseFilter.frequency.setValueAtTime(2600, now);
                noiseEnv.decay = 0.12;
                noiseEnv.triggerAttackRelease("8n", now);
            } else if (type === 'flame') {
                noiseFilter.type = "bandpass";
                noiseFilter.frequency.setValueAtTime(450, now);
                noiseFilter.frequency.exponentialRampToValueAtTime(120, now + 0.12);
                noiseEnv.decay = 0.14;
                noiseEnv.triggerAttackRelease("16n", now);

                subOsc.frequency.setValueAtTime(55, now);
                subEnv.decay = 0.08;
                subEnv.triggerAttackRelease("16n", now);
            } else if (type === 'freeze') {
                plasmaOsc.frequency.setValueAtTime(1200, now);
                plasmaOsc.frequency.exponentialRampToValueAtTime(300, now + 0.18);
                plasmaFilter.frequency.setValueAtTime(2500, now);
                plasmaFilter.frequency.exponentialRampToValueAtTime(800, now + 0.2);
                plasmaEnv.decay = 0.22;
                plasmaEnv.triggerAttackRelease("8n", now);
            } else if (type === 'gatling') {
                transientOsc.frequency.setValueAtTime(700 + (Math.random() - 0.5) * 100, now);
                transientOsc.frequency.exponentialRampToValueAtTime(110, now + 0.03);
                transientEnv.decay = 0.025;
                transientEnv.triggerAttackRelease("64n", now);

                noiseFilter.type = "bandpass";
                noiseFilter.frequency.setValueAtTime(1300, now);
                noiseEnv.decay = 0.035;
                noiseEnv.triggerAttackRelease("64n", now);

                subOsc.frequency.setValueAtTime(90, now);
                subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.04);
                subEnv.decay = 0.045;
                subEnv.triggerAttackRelease("64n", now);
            } else if (type === 'tesla') {
                plasmaOsc.frequency.setValueAtTime(800, now);
                plasmaOsc.frequency.exponentialRampToValueAtTime(3200, now + 0.08);
                plasmaEnv.decay = 0.1;
                plasmaEnv.triggerAttackRelease("16n", now);
            } else if (type === 'nuclear') {
                subOsc.frequency.setValueAtTime(55, now);
                subOsc.frequency.exponentialRampToValueAtTime(20, now + 0.45);
                subEnv.decay = 0.5;
                subEnv.triggerAttackRelease("4n", now);

                noiseFilter.type = "lowpass";
                noiseFilter.frequency.setValueAtTime(300, now);
                noiseEnv.decay = 0.4;
                noiseEnv.triggerAttackRelease("4n", now);
            }
        } catch(e) {}
    }
}

export function playReloadSound() {
    if (audioMuted.value) return;
    if (playRealisticSound('reload', 0.55)) return;
    if (playRealSound('numkey')) return;

    if (audioInitialized.value && audioNodes.chimeSynth) {
        try {
            const now = Tone.now();
            audioNodes.chimeSynth.triggerAttackRelease("A3", "32n", now);
            audioNodes.chimeSynth.triggerAttackRelease("E4", "32n", now + 0.15);
        } catch(e) {}
    }
}

export function playExplosionSound(volume = 0.65) {
    if (audioMuted.value) return;
    if (playRealisticSound('explosion', volume)) return;
    playRealSound('alien death');
}

export function playCritChime() {
    if (audioMuted.value) return;
    if (playRealisticSound('crit', 0.45)) return;
    if (playRealSound('numkey')) return;

    if (audioInitialized.value && audioNodes.chimeSynth) {
        try {
            const now = Tone.now();
            audioNodes.chimeSynth.triggerAttackRelease("G5", "32n", now);
            audioNodes.chimeSynth.triggerAttackRelease("D6", "16n", now + 0.025);
        } catch(e) {}
    }
}

export function playUpgradeChime() {
    if (audioMuted.value) return;
    if (playRealSound('ping')) return;

    if (audioInitialized.value && audioNodes.chimeSynth) {
        try {
            const now = Tone.now();
            audioNodes.chimeSynth.triggerAttackRelease("B4", "16n", now);
            audioNodes.chimeSynth.triggerAttackRelease("F#5", "16n", now + 0.08);
            audioNodes.chimeSynth.triggerAttackRelease("B5", "16n", now + 0.16);
            audioNodes.chimeSynth.triggerAttackRelease("D#6", "8n", now + 0.24);
        } catch(e) {}
    }
}

export function playDefeatDrone() {
    if (audioMuted.value) return;
    if (playRealSound('death')) return;

    if (audioInitialized.value && audioNodes.chimeSynth) {
        try {
            const now = Tone.now();
            audioNodes.chimeSynth.triggerAttackRelease("E3", "4n", now);
            audioNodes.chimeSynth.triggerAttackRelease("C3", "4n", now + 0.25);
            audioNodes.chimeSynth.triggerAttackRelease("Ab2", "2n", now + 0.5);
        } catch(e) {}
    }
}
