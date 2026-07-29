import '../tests/setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

const { readAppConfig } = await import('./AppConfig.js');

test('runtime config trims and validates deploy-specific values', () => {
    assert.deepEqual(readAppConfig({
        VITE_SERVER_URL: ' https://server.example.test/ ',
        VITE_SIGNALING_URL: 'https://signal.example.test/',
        VITE_SUPABASE_URL: 'https://scores.example.test/',
        VITE_SUPABASE_ANON_KEY: ' public-key '
    }), {
        serverUrl: 'https://server.example.test',
        signalingUrl: 'https://signal.example.test',
        supabaseUrl: 'https://scores.example.test',
        supabaseAnonKey: 'public-key'
    });
});

test('runtime config rejects malformed urls and empty keys', () => {
    assert.deepEqual(readAppConfig({
        VITE_SERVER_URL: 'javascript:alert(1)',
        VITE_SUPABASE_URL: 'not a url',
        VITE_SUPABASE_ANON_KEY: ' '
    }), {
        serverUrl: undefined,
        signalingUrl: undefined,
        supabaseUrl: undefined,
        supabaseAnonKey: undefined
    });
});
