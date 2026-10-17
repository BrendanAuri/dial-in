/** Small per-browser display preferences. Lost data here is harmless, so failures are ignored. */
import { useCallback, useState } from 'react';
import { browserStore } from '../storage/storage';

const SPECTRUM_KEY = 'dialin.ui.spectrum';

/** Whether the live spectrum is shown, remembered between visits. */
export function useSpectrumShown(): [boolean, (shown: boolean) => void] {
  const [shown, setShown] = useState(() => browserStore().read(SPECTRUM_KEY) !== 'hidden');
  const update = useCallback((next: boolean) => {
    setShown(next);
    browserStore().write(SPECTRUM_KEY, next ? 'shown' : 'hidden');
  }, []);
  return [shown, update];
}
