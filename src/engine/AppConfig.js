export function readAppConfig(env = import.meta.env ?? {}) {
    return Object.freeze({
        serverUrl: cleanUrl(env.VITE_SERVER_URL),
        signalingUrl: cleanUrl(
            env.VITE_SIGNALING_URL || env.VITE_SERVER_URL
        ),
        supabaseUrl: cleanUrl(env.VITE_SUPABASE_URL),
        supabaseAnonKey: cleanString(env.VITE_SUPABASE_ANON_KEY)
    });
}

export const APP_CONFIG = readAppConfig();

function cleanUrl(value) {
    const clean = cleanString(value);
    if (!clean) return undefined;
    try {
        const url = new URL(clean);
        if (!['http:', 'https:'].includes(url.protocol)) return undefined;
        return url.toString().replace(/\/$/, '');
    } catch {
        return undefined;
    }
}

function cleanString(value) {
    if (typeof value !== 'string') return undefined;
    const clean = value.trim();
    return clean || undefined;
}
