export class AudioManager {
    constructor() {
        this.sounds = new Map();
        this.defaultSounds = new Map();
        this.eventBindings = new Map();
        this.missingSoundWarnings = new Set();
        this.previewVoices = new Set();
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

        this.previewGain = this.context.createGain();
        this.previewGain.gain.value = 0.7;
        this.previewLimiter = this.context.createDynamicsCompressor();
        this.previewLimiter.threshold.value = -6;
        this.previewLimiter.knee.value = 0;
        this.previewLimiter.ratio.value = 20;
        this.previewLimiter.attack.value = 0.003;
        this.previewLimiter.release.value = 0.12;
        this.previewGain.connect(this.previewLimiter);
        this.previewLimiter.connect(this.sfxGain);

        // Instancing control to prevent volume stacking
        this.recentPlays = new Map(); // name -> { count, lastTime }

        // Load saved settings
        this.loadSettings();
    }

    loadSettings() {
        try {
            this.restoreVolume(
                this.masterGain,
                localStorage.getItem('settings_volume_master')
            );
            this.restoreVolume(
                this.musicGain,
                localStorage.getItem('settings_volume_music')
            );
            this.restoreVolume(
                this.sfxGain,
                localStorage.getItem('settings_volume_sfx')
            );
        } catch (error) {
            console.warn('[Audio] Failed to load volume settings:', error);
        }
    }

    restoreVolume(gainNode, storedValue) {
        if (storedValue === null) return;
        const parsed = Number.parseFloat(storedValue);
        if (!Number.isFinite(parsed)) return;
        gainNode.gain.value = Math.max(0, Math.min(1, parsed));
    }

    saveVolume(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn('[Audio] Failed to save volume setting:', error);
        }
    }

    async load(name, url, { preserveDefault = true } = {}) {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.sounds.set(name, audioBuffer);
            if (preserveDefault) this.defaultSounds.set(name, audioBuffer);
            console.log(`Sound loaded: ${name}`);
        } catch (error) {
            console.error(`Failed to load sound: ${name} from ${url}`, error);
        }
    }

    play(name, options = {}) {
        return this.playResolved(`global:${name}`, name, options);
    }

    playEvent(eventKey, fallbackName, options = {}) {
        return this.playResolved(eventKey, fallbackName, options);
    }

    playResolved(eventKey, fallbackName, options = {}) {
        const name = this.eventBindings.get(eventKey) || fallbackName;
        const buffer = this.sounds.get(name);
        if (!buffer) {
            if (!this.missingSoundWarnings.has(name)) {
                this.missingSoundWarnings.add(name);
                console.warn(`[Audio] Missing sound for ${eventKey}: ${name}`);
            }
            return null;
        }

        const now = Date.now();
        const recent = this.recentPlays.get(eventKey) || { count: 0, lastTime: now };
        const elapsed = now - recent.lastTime;
        // Leaky bucket: decay the count MUCH faster (1 unit per 2ms)
        // This prevents the count from snowballing during high-rate fire
        recent.count = Math.max(0, (recent.count || 0) - (elapsed / 2));
        recent.count += 1;

        recent.lastTime = now;
        this.recentPlays.set(eventKey, recent);

        let volumeMultiplier = 1.0;

        // Aggressive instance limiting for beam/charge sounds and spammy sounds
        const isBeamSound = fallbackName === 'shoot_lsr' || fallbackName === 'rail' || fallbackName === 'rail_shot' || fallbackName === 'rail_charge';
        if (isBeamSound || options.isSpammy) {
            if (recent.count > 1) {
                // More sounds = quieter each instance
                volumeMultiplier = 1 / Math.pow(recent.count, 0.6);
            }
            // Hard limit on how quiet it can get
            volumeMultiplier = Math.max(0.1, volumeMultiplier);
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

        const type = options.type || 'sfx'; // 'sfx' or 'music'
        const loop = options.loop || false;

        // Optimization: Check effective volume (including Master/Channel gain) before creating nodes
        const channelGain = (type === 'music' ? this.musicGain.gain.value : this.sfxGain.gain.value);
        const masterGain = this.masterGain.gain.value;
        const effectiveVolume = finalVolume * channelGain * masterGain;

        // Never skip entirely unless it's truly silent (and not a looping sound that might need to be unmuted later)
        if ((effectiveVolume < 0.001 && !loop) || finalVolume < 0.001) return null;

        // Resume context if suspended (browser behavior)
        if (this.context.state === 'suspended') {
            this.context.resume();
        }

        const source = this.context.createBufferSource();
        source.buffer = buffer;

        const pitch = options.pitch !== undefined ? options.pitch : 1.0;
        const randomizePitch = options.randomizePitch || 0;

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

    replace(name, audioBuffer) {
        if (!name || !audioBuffer) return false;
        this.sounds.set(name, audioBuffer);
        this.missingSoundWarnings.delete(name);
        return true;
    }

    remove(name) {
        if (this.defaultSounds.has(name)) return false;
        return this.sounds.delete(name);
    }

    restoreDefault(name) {
        const defaultBuffer = this.defaultSounds.get(name);
        if (!defaultBuffer) return false;
        this.sounds.set(name, defaultBuffer);
        return true;
    }

    bindEvent(eventKey, soundName) {
        if (!eventKey || !soundName || !this.sounds.has(soundName)) return false;
        this.eventBindings.set(eventKey, soundName);
        return true;
    }

    unbindEvent(eventKey) {
        return this.eventBindings.delete(eventKey);
    }

    getEventBinding(eventKey) {
        return this.eventBindings.get(eventKey) || null;
    }

    hasSound(name) {
        return Boolean(name && this.sounds.has(name));
    }

    previewSound(name, options = {}) {
        return this.preview(this.sounds.get(name), options);
    }

    async decodeAudioBytes(bytes) {
        const arrayBuffer = bytes instanceof ArrayBuffer
            ? bytes.slice(0)
            : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        return this.context.decodeAudioData(arrayBuffer);
    }

    preview(audioBuffer, { volume = 0.7, pitch = 1 } = {}) {
        if (!audioBuffer) return null;
        this.stopPreview();
        if (this.context.state === 'suspended') this.context.resume();

        const source = this.context.createBufferSource();
        const gainNode = this.context.createGain();
        source.buffer = audioBuffer;
        source.playbackRate.value = Math.max(0.1, Math.min(4, pitch));
        gainNode.gain.value = Math.max(0, Math.min(1, volume));
        source.connect(gainNode);
        gainNode.connect(this.previewGain);
        const voice = { source, gainNode };
        this.previewVoices.add(voice);
        source.onended = () => this.previewVoices.delete(voice);
        source.start(0);
        return voice;
    }

    stopPreview() {
        for (const voice of this.previewVoices) {
            try {
                voice.source.stop();
            } catch {
                // The voice already ended between collection and stop.
            }
        }
        this.previewVoices.clear();
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
        this.saveVolume('settings_volume_master', v);
    }

    setMusicVolume(value) {
        const v = Math.max(0, Math.min(1, value));
        this.musicGain.gain.setTargetAtTime(v, this.context.currentTime, 0.1);
        this.saveVolume('settings_volume_music', v);
    }

    setSfxVolume(value) {
        const v = Math.max(0, Math.min(1, value));
        this.sfxGain.gain.setTargetAtTime(v, this.context.currentTime, 0.1);
        this.saveVolume('settings_volume_sfx', v);
    }
}
