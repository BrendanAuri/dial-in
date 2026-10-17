import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { OFFLINE_NOTICE_MS } from '../../engine/constants';

/**
 * Registers the service worker and tells the player when the app can work
 * offline, or when a new version is ready (they choose when to reload, so
 * an update never interrupts a round).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(() => setOfflineReady(false), OFFLINE_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (needRefresh) {
    return (
      <div className="app-notice" role="status">
        <span>A new version of Dial In is ready.</span>
        <button type="button" className="button primary" onClick={() => void updateServiceWorker(true)}>
          Reload
        </button>
        <button type="button" className="button" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </div>
    );
  }
  if (offlineReady) {
    return (
      <div className="app-notice" role="status">
        <span>Dial In now works offline.</span>
      </div>
    );
  }
  return null;
}
