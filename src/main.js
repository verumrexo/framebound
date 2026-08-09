import './style.css'
import { Game } from './engine/Game.js'
import { SaveManager } from './game/systems/SaveManager.js'

async function boot() {
  await SaveManager.hydrateDesktopBackup();

  const query = new URLSearchParams(window.location.search);
  const showVisualGallery = query.has('visual-gallery');
  const runPeerSmoke = query.has('peer-link-smoke');
  const peerSessionRole = query.get('peer-session-smoke');

  document.querySelector('#app').innerHTML = `
    <div class="render-stack">
      <canvas id="gameCanvas" data-render-surface="world"></canvas>
      ${showVisualGallery ? '' : '<canvas id="hudCanvas" data-render-surface="hud"></canvas>'}
    </div>
  `

  const canvas = document.querySelector('#gameCanvas');

  if (peerSessionRole) {
    import('./game/dev/PeerSessionSmoke.js').then(({
      runPeerSessionSmoke
    }) => {
      window.peerSessionSmoke = runPeerSessionSmoke(
        peerSessionRole,
        query.get('code'),
        query.get('resume')
      );
    });
  } else if (runPeerSmoke) {
    window.peerLinkSmoke = import('./game/dev/PeerLinkSmoke.js')
      .then(({ runPeerLinkSmoke }) => runPeerLinkSmoke())
      .then(result => {
        document.documentElement.dataset.peerSmoke =
          JSON.stringify({ ok: true, ...result });
        return result;
      })
      .catch(error => {
        document.documentElement.dataset.peerSmoke =
          JSON.stringify({
            ok: false,
            error: String(error?.message || error)
          });
        throw error;
      });
  } else if (showVisualGallery) {
    import('./game/dev/VisualGallery.js').then(({
      renderVisualGallery
    }) => {
      renderVisualGallery(canvas);
    });
  } else {
    const game = new Game(canvas);
    window.game = game;
    game.start();
  }
}

boot().catch(error => {
  console.error('[Boot] Failed to start Framebound:', error);
});
