import './style.css'
import { Game } from './engine/Game.js'
import { SaveManager } from './game/systems/SaveManager.js'
import { PartsLibrary } from './shared/parts/Part.js'
import { loadPromotedPartLabManifest, applyPartLabManifest } from './game/dev/PartLabManifest.js'
import { resolvePartLabDevelopmentFlag } from './game/dev/PartLabEnvironment.js'
import { loadPromotedEnemyLabManifest, applyPromotedEnemyLabManifest } from './game/dev/EnemyLabManifest.js'

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
    let authoring = {};
    const flavor = import.meta.env?.VITE_FRAMEBOUND_FLAVOR;
    const standalonePartLab = flavor === 'part-lab';
    const standaloneEnemyLab = flavor === 'enemy-lab';
    const authoringBuild = import.meta.env?.DEV === true || flavor === 'dev' || standalonePartLab || standaloneEnemyLab;
    if (authoringBuild) {
      authoring = await import('./game/dev/AuthoringWindows.js');
    }
    let partLabManifest = null;
    try {
      partLabManifest = await loadPromotedPartLabManifest();
      if (partLabManifest) applyPartLabManifest(partLabManifest, PartsLibrary);
    } catch (error) {
      console.warn('[Boot] promoted part lab manifest ignored:', error);
    }
    try {
      const enemyLabManifest = await loadPromotedEnemyLabManifest();
      if (enemyLabManifest) applyPromotedEnemyLabManifest(enemyLabManifest);
    } catch (error) {
      console.warn('[Boot] promoted enemy lab manifest ignored:', error);
    }
    const game = new Game(canvas, {
      partLabManifest,
      isDevelopment: resolvePartLabDevelopmentFlag({
        viteDev: import.meta.env?.DEV === true,
        flavor: import.meta.env?.VITE_FRAMEBOUND_FLAVOR
      }),
      partLabWindowClass: authoring.PartLabWindow,
      signalForgeWindowClass: authoring.SignalForgeWindow,
      enemyLabWindowClass: authoring.EnemyLabWindow,
      partLabStandalone: standalonePartLab,
      enemyLabStandalone: standaloneEnemyLab
    });
    window.game = game;
    if (standalonePartLab) {
      document.documentElement.dataset.frameboundFlavor = 'part-lab';
      game.partLabWindow.open();
    } else if (standaloneEnemyLab) {
      document.documentElement.dataset.frameboundFlavor = 'enemy-lab';
      game.enemyLabWindow.open();
    } else {
      game.start();
    }
  }
}

boot().catch(error => {
  console.error('[Boot] Failed to start Framebound:', error);
});
