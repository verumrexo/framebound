/**
 * Keep the editor gate explicit and injectable. Vite's DEV flag is passed in
 * by main.js, while node tests and Tauri harnesses can use the runtime flag.
 */
export function resolvePartLabDevelopmentFlag({
    viteDev = false,
    runtimeFlag = globalThis.__FRAMEBOUND_DEV__
} = {}) {
    return viteDev === true || runtimeFlag === true;
}
