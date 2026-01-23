export class AudioManager {
    constructor() {
        this.sounds = new Map();
        this.context = new (window.AudioContext || window.webkitAudioContext)();

        // Master Gain
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        this.masterGain.gain.value = 0.5; // Default volume

        // Music Channel
        this.musicGain = this.context.createGain();
        this.musicGain.connect(this.masterGain);
        this.musicGain.gain.value = 0.5;

        // SFX Channel
        this.sfxGain = this.context.createGain();
        this.sfxGain.connect(this.masterGain);
        this.sfxGain.gain.value = 1.0;
    }

    async load(name, url) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.sounds.set(name, audioBuffer);
            console.log(`Sound loaded: ${name}`);
        } catch (error) {
            console.error(`Failed to load sound: ${name} from ${url}`, error);
        }
    }

    play(name, options = {}) {
        const buffer = this.sounds.get(name);
        if (!buffer) return;

        // Resume context if suspended (browser behavior)
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        const source = this.context.createBufferSource();
        source.buffer = buffer;

        const volume = options.volume !== undefined ? options.volume : 1.0;
        const pitch = options.pitch !== undefined ? options.pitch : 1.0;
        const randomizePitch = options.randomizePitch || 0;
        const loop = options.loop || false;
        const type = options.type || 'sfx'; // 'sfx' or 'music'

        const gainNode = this.context.createGain();
        gainNode.gain.value = volume;

        // Pitch randomization
        const finalPitch = pitch + (Math.random() - 0.5) * randomizePitch;
        source.playbackRate.value = finalPitch;

        if (loop) {
            source.loop = true;
        }

        source.connect(gainNode);

        // Route to appropriate channel
        if (type === 'music') {
            gainNode.connect(this.musicGain);
        } else {
            gainNode.connect(this.sfxGain);
        }

        source.start(0);
        return { source, gainNode }; // Return both for control
    }

    playMusic(name, volume = 0.8) {
        if (this.currentMusic && this.currentMusicName === name) return; // Already playing

        this.stopMusic();

        // Music volume is handled by channel gain now, so individual track volume can be closer to 1.0 or used for relative mixing
        // But we'll keep the parameter for flexibility
        const ref = this.play(name, { volume, loop: true, type: 'music' });
        if (ref) {
            this.currentMusic = ref;
            this.currentMusicName = name;
        }
    }

    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.source.stop();
            this.currentMusic = null;
            this.currentMusicName = null;
        }
    }

    setMasterVolume(value) {
        // Clamp between 0 and 1
        const v = Math.max(0, Math.min(1, value));
        this.masterGain.gain.setTargetAtTime(v, this.context.currentTime, 0.1);
    }

    setMusicVolume(value) {
        const v = Math.max(0, Math.min(1, value));
        this.musicGain.gain.setTargetAtTime(v, this.context.currentTime, 0.1);
    }

    setSfxVolume(value) {
        const v = Math.max(0, Math.min(1, value));
        this.sfxGain.gain.setTargetAtTime(v, this.context.currentTime, 0.1);
    }
}
