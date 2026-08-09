const JFXR_VERSION = '0.13.0';
let jfxrPromise = null;

async function loadJfxr() {
    if (!jfxrPromise) jfxrPromise = import('jfxr');
    return jfxrPromise;
}

function soundToDocument(sound) {
    return JSON.parse(sound.serialize());
}

function documentToSound(Sound, recipe) {
    const sound = new Sound();
    sound.parse(JSON.stringify(recipe));
    return sound;
}

export class JfxrAdapter {
    async listPresets() {
        const { ALL_PRESETS } = await loadJfxr();
        return ALL_PRESETS.map(preset => preset.name.toLowerCase());
    }

    async create(presetName = 'laser/shoot') {
        const { ALL_PRESETS, Sound } = await loadJfxr();
        const sound = new Sound();
        const preset = ALL_PRESETS.find(item => item.name.toLowerCase() === presetName.toLowerCase()) || ALL_PRESETS[0];
        preset.applyTo?.(sound);
        sound.name = preset.name.toLowerCase();
        return soundToDocument(sound);
    }

    async mutate(recipe) {
        const { Preset, Sound } = await loadJfxr();
        const sound = documentToSound(Sound, recipe);
        Preset.mutate(sound);
        return soundToDocument(sound);
    }

    async update(recipe, values) {
        const { Sound } = await loadJfxr();
        const sound = documentToSound(Sound, recipe);
        for (const [key, value] of Object.entries(values)) {
            if (sound[key] && 'value' in sound[key]) sound[key].value = value;
        }
        return soundToDocument(sound);
    }

    async describe(recipe) {
        const { Sound } = await loadJfxr();
        const sound = documentToSound(Sound, recipe);
        const parameters = [];
        sound.forEachParam((key, param) => {
            parameters.push({
                key,
                label: param.label.toLowerCase(),
                type: param.type,
                value: param.value,
                min: param.minValue,
                max: param.maxValue,
                step: param.step,
                unit: param.unit,
                values: param.values
            });
        });
        return parameters;
    }

    async render(recipe) {
        const { Synth } = await loadJfxr();
        const clip = await new Promise((resolve, reject) => {
            try {
                const synth = new Synth(JSON.stringify(recipe));
                synth.run(resolve);
            } catch (error) {
                reject(error);
            }
        });
        const samples = clip.toFloat32Array();
        let peak = 0;
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
        return {
            jfxrVersion: JFXR_VERSION,
            samples,
            wavBytes: clip.toWavBytes(),
            sampleRate: clip.getSampleRate(),
            duration: clip.getNumSamples() / clip.getSampleRate(),
            peak
        };
    }
}
