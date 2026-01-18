export class AudioManager {
    constructor() {
        this.sounds = new Map();
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        this.masterGain.gain.value = 0.5; // Default volume
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

        const gainNode = this.context.createGain();
        gainNode.gain.value = volume;

        // Pitch randomization
        const finalPitch = pitch + (Math.random() - 0.5) * randomizePitch;
        source.playbackRate.value = finalPitch;

        if (loop) {
            source.loop = true;
        }

        source.connect(gainNode);
        gainNode.connect(this.masterGain);

        source.start(0);
        return { source, gainNode }; // Return both for control
    }

    playMusic(name, volume = 0.5) {
        if (this.currentMusic && this.currentMusicName === name) return; // Already playing

        this.stopMusic();

        const ref = this.play(name, { volume, loop: true });
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
        this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, 0.1);
    }
}
