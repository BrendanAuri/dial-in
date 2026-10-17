import { useState } from 'react';

interface ShareBoxProps {
  readonly text: string;
}

type Status = 'idle' | 'copied' | 'failed';

/** Shows a spoiler-free result and shares it (share sheet where there is one, else the clipboard). */
export function ShareBox({ text }: ShareBoxProps) {
  const [status, setStatus] = useState<Status>('idle');
  const canShare = typeof navigator.share === 'function';

  async function share(): Promise<void> {
    if (canShare) {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        // Closing the share sheet isn't a failure.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="share-box">
      <output className="share-text">{text}</output>
      <div className="share-actions">
        <button type="button" className="button primary" onClick={() => void share()}>
          {canShare ? 'Share result' : 'Copy result'}
        </button>
        <span className="share-status" role="status">
          {status === 'copied' ? 'Copied' : status === 'failed' ? 'Select the text above to copy it.' : ''}
        </span>
      </div>
    </div>
  );
}
