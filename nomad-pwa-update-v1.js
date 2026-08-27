/* Nomad Horse Market — Atualizador PWA v23 */
(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;

  const SW_URL = './sw.js?v=23';
  const RELOAD_KEY = 'nhm_pwa_reload_v23';
  let registration = null;

  function activateWaitingWorker() {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  async function checkForUpdate() {
    try {
      if (!registration) registration = await navigator.serviceWorker.getRegistration('./');
      if (!registration) {
        registration = await navigator.serviceWorker.register(SW_URL, {
          scope: './',
          updateViaCache: 'none'
        });
      }
      await registration.update();
      activateWaitingWorker();
    } catch (_) {}
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (sessionStorage.getItem(RELOAD_KEY) === '1') return;
    sessionStorage.setItem(RELOAD_KEY, '1');
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register(SW_URL, {
        scope: './',
        updateViaCache: 'none'
      });
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') activateWaitingWorker();
        });
      });
      activateWaitingWorker();
      setTimeout(() => sessionStorage.removeItem(RELOAD_KEY), 5000);
    } catch (_) {}
  });

  window.addEventListener('online', checkForUpdate);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  setInterval(checkForUpdate, 5 * 60 * 1000);
})();
