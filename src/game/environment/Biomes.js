export const Biomes = {
    DEFAULT: {
        name: 'Deep Space',
        colors: {
            background: '#050510',
            grid: '#1a334d',
            gridMajor: '#2a557d',
            stars: '#ffffff'
        }
    },
    NEON_CITY: {
        name: 'Neon Grid',
        colors: {
            background: '#12001f', // Dark purple
            grid: '#ff00ff',       // Magenta
            gridMajor: '#aa00aa',
            stars: '#00ffff'       // Cyan stars
        }
    },
    RUST_BELT: {
        name: 'Rust Belt',
        colors: {
            background: '#1a0f05', // Dark brown
            grid: '#cc6600',       // Orange
            gridMajor: '#884400',
            stars: '#ffeeb0'       // Dusty yellow
        }
    },
    ICE_FIELD: {
        name: 'Cryo Sector',
        colors: {
            background: '#00111f', // Deep blue
            grid: '#aaddff',       // Ice blue
            gridMajor: '#5599cc',
            stars: '#ffffff'
        }
    },
    TOXIC_NEBULA: {
        name: 'Toxic Nebula',
        colors: {
            background: '#051405', // Dark green
            grid: '#33ff33',       // Lime
            gridMajor: '#118811',
            stars: '#ccffcc'
        }
    },
    SOLAR_FLARE: {
        name: 'Solar Zone',
        colors: {
            background: '#220000', // Dark red
            grid: '#ffaa00',       // Gold/Orange
            gridMajor: '#cc4400',
            stars: '#ff8888'
        }
    }
};

export function getRandomBiome() {
    const keys = Object.keys(Biomes).filter(k => k !== 'DEFAULT');
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    return Biomes[randomKey];
}
