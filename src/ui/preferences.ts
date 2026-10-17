/** Small per-browser display preferences. Lost data here is harmless, so failures are ignored. */
import { useCallback, useState } from 'react';
import { browserStore } from '../storage/storage';

const SPECTRUM_KEY = 'dialin.ui.spectrum';
const INSTALL_DISMISSED_KEY = 'dialin.ui.installDismissed';

/** Whether the live spectrum is shown, remembered between visits. */
export function useSpectrumShown(): [boolean, (shown: boolean) => void] {
  const [shown, setShown] = useState(() => browserStore().read(SPECTRUM_KEY) !== 'hidden');
  const update = useCallback((next: boolean) => {
    setShown(next);
    browserStore().write(SPECTRUM_KEY, next ? 'shown' : 'hidden');
  }, []);
  return [shown, update];
}

/** Whether the player has dismissed the install suggestion. */
export function useInstallDismissed(): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(() => browserStore().read(INSTALL_DISMISSED_KEY) !== null);
  const dismiss = useCallback(() => {
    setDismissed(true);
    browserStore().write(INSTALL_DISMISSED_KEY, new Date().toISOString());
  }, []);
  return [dismissed, dismiss];
}
