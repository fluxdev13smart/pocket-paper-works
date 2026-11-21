/** Preview hosts must never hold an app-shell service worker. */
export function refusesOfflineWorker(hostname: string, production: boolean, framed: boolean, disabled: boolean) {
  const host = hostname.toLowerCase();
  const platform = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host);
  const label = host.split('.')[0] ?? '';
  return !production || framed || disabled ||
    (platform && (/^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label) || /^project--.+-dev$/.test(label))) ||
    ['lovableproject.com', 'lovableproject-dev.com', 'beta.lovable.dev'].some(domain => host === domain || host.endsWith(`.${domain}`));
}

export async function initializeOffline() {
  if (!('serviceWorker' in navigator)) return;
  const refused = refusesOfflineWorker(window.location.hostname, import.meta.env.PROD, window.self !== window.top, new URLSearchParams(window.location.search).get('sw') === 'off');
  if (refused) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(reg => [reg.active, reg.waiting, reg.installing].some(worker => worker && new URL(worker.scriptURL).pathname === '/sw.js')).map(reg => reg.unregister()));
    return;
  }
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const warmPages = async () => {
    if (!navigator.serviceWorker.controller) return;
    await Promise.allSettled(['/', '/editor', '/pages', '/formats', '/offline', '/architecture'].map(path => fetch(path, { headers: { Accept: 'text/html' } })));
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => { void warmPages(); });
  await navigator.serviceWorker.ready;
  await warmPages();
  const activateUpdate = () => registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
  activateUpdate();
  registration.addEventListener('updatefound', () => {
    registration.installing?.addEventListener('statechange', activateUpdate);
  });
}
