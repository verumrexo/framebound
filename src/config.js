export const SERVER_URL = (() => {
    // Check hostname
    const hostname = window.location.hostname;

    // Local Development (Vite or Manual)
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000';
    }

    // GitHub Pages or Production
    // If we are deployed, we likely don't have a server unless one is configured.
    // Return null to disable connection attempts and prevent console spam.
    if (hostname.includes('github.io')) {
        return null;
    }

    // Default: Disable unless explicitly configured
    // If user deploys to Vercel/Render, they should update this logic.
    return null;
})();
