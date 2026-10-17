import { install, isIos, isStandalone, useCanInstall } from '../install';
import { useInstallDismissed } from '../preferences';

/**
 * Suggests installing Dial In: browsers can clear data for sites that
 * aren't installed, while installed apps keep progress and saved sounds.
 */
export function InstallCard() {
  const canInstall = useCanInstall();
  const [dismissed, dismiss] = useInstallDismissed();
  if (dismissed || isStandalone()) return null;
  const ios = isIos();
  if (!canInstall && !ios) return null;

  return (
    <section className="card install-card" aria-labelledby="install-title">
      <h2 id="install-title" className="card-kicker">
        Install Dial In
      </h2>
      <p className="card-note">
        {ios
          ? 'Tap the Share button, then Add to Home Screen. It opens full screen, works offline and keeps your progress safe.'
          : 'Add it to your home screen or desktop. It opens in its own window, works offline and keeps your progress safe.'}
      </p>
      <div className="form-actions">
        <button type="button" className="button" onClick={dismiss}>
          {ios ? 'Got it' : 'Not now'}
        </button>
        {canInstall && (
          <button type="button" className="button primary" onClick={() => void install()}>
            Install
          </button>
        )}
      </div>
    </section>
  );
}
