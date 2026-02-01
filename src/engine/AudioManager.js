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

        // Instancing control to prevent volume stacking
        this.recentPlays = new Map(); // name -> { count, lastTime }

        // Load saved settings
        this.loadSettings();
    }

    loadSettings() {
        const savedMaster = localStorage.getItem('settings_volume_master');
        const savedMusic = localStorage.getItem('settings_volume_music');
        const savedSfx = localStorage.getItem('settings_volume_sfx');

        if (savedMaster !== null) this.masterGain.gain.value = parseFloat(savedMaster);
        if (savedMusic !== null) this.musicGain.gain.value = parseFloat(savedMusic);
        if (savedSfx !== null) this.sfxGain.gain.value = parseFloat(savedSfx);
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
        if (!buffer) return null;

        const now = Date.now();
        const recent = this.recentPlays.get(name) || { count: 0, lastTime: now };
        const elapsed = now - recent.lastTime;
        // Leaky bucket: decay the count MUCH faster (1 unit per 2ms)
        // This prevents the count from snowballing during high-rate fire
        recent.count = Math.max(0, (recent.count || 0) - (elapsed / 2));
        recent.count += 1;

        recent.lastTime = now;
        this.recentPlays.set(name, recent);

        let volumeMultiplier = 1.0;

        // ONLY apply aggressive instance limiting to freeze ray laser or sounds marked as spammy (like freeze hits)
        // This follows the "dont touch other sounds" request while still fixing the crash
        if (name === 'shoot_lsr' || options.isSpammy) {
            if (recent.count > 1) {
                // "more freeze rays > more quiet sounds" 
                volumeMultiplier = 1 / Math.pow(recent.count, 0.5);
            }
            // Hard limit on how quiet it can get
            volumeMultiplier = Math.max(0.15, volumeMultiplier);

            // Removed hard cap - keep playing
        } else {
            // For normal sounds, be much more permissive 
            if (recent.count > 5) {
                volumeMultiplier = 2 / Math.sqrt(recent.count);
            }
            volumeMultiplier = Math.max(0.2, volumeMultiplier);

            if (recent.count > 1000) return null; // Extreme safety only
        }

        const baseVolume = (options.volume !== undefined ? options.volume : 1.0);
        const finalVolume = baseVolume * volumeMultiplier;

        // Never skip entirely unless it's truly silent
        if (finalVolume < 0.001) return null;

        // Resume context if suspended (browser behavior)
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        const source = this.context.createBufferSource();
        source.buffer = buffer;

        const pitch = options.pitch !== undefined ? options.pitch : 1.0;
        const randomizePitch = options.randomizePitch || 0;
        const loop = options.loop || false;
        const type = options.type || 'sfx'; // 'sfx' or 'music'

        const gainNode = this.context.createGain();
        gainNode.gain.value = finalVolume;

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
        localStorage.setItem('settings_volume_master', v);
    }

    setMusicVolume(value) {
        const v = Math.max(0, Math.min(1, value));
        this.musicGain.gain.setTargetAtTime(v, this.context.currentTime, 0.1);
        localStorage.setItem('settings_volume_music', v);
    }

    setSfxVolume(value) {
        const v = Math.max(0, Math.min(1, value));
        this.sfxGain.gain.setTargetAtTime(v, this.context.currentTime, 0.1);
        localStorage.setItem('settings_volume_sfx', v);
    }
}
