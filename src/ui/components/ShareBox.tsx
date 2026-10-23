import { useState } from 'react';

interface ShareBoxProps {
  readonly text: string;
  /** A link to share with the text, if any. */
  readonly url?: string;
  /** The button's label where there's a share sheet; "Copy" replaces "Share" without one. */
  readonly label?: string;
}

type Status = 'idle' | 'copied' | 'failed';

/** Shows text (and a link) and shares it: the share sheet where there is one, else the clipboard. */
export function ShareBox({ text, url, label = 'Share result' }: ShareBoxProps) {
  const [status, setStatus] = useState<Status>('idle');
  const canShare = typeof navigator.share === 'function';
  const full = url ? `${text} ${url}` : text;

  async function share(): Promise<void> {
    if (canShare) {
      try {
        await navigator.share(url ? { text, url } : { text });
        return;
      } catch (error) {
        // Closing the share sheet isn't a failure.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(full);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="share-box">
      <output className="share-text">
        {text}
        {url && (
          <>
            {' '}
            <span className="share-url">{url}</span>
          </>
        )}
      </output>
      <div className="share-actions">
        <button type="button" className="button primary" onClick={() => void share()}>
          {canShare ? label : label.replace(/^Share/, 'Copy')}
        </button>
        <span className="share-status" role="status">
          {status === 'copied' ? 'Copied' : status === 'failed' ? 'Select the text above to copy it.' : ''}
        </span>
      </div>
    </div>
  );
}
