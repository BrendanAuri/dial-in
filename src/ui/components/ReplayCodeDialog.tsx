import { useState, type FormEvent } from 'react';
import { Modal } from './Modal';

interface ReplayCodeDialogProps {
  /** Start the round for `code`. Returns an error message, or null on success. */
  readonly onSubmit: (code: string) => string | null;
  readonly onCancel: () => void;
}

export function ReplayCodeDialog({ onSubmit, onCancel }: ReplayCodeDialogProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent): void {
    event.preventDefault();
    setError(onSubmit(code));
  }

  return (
    <Modal title="Replay a round" onClose={onCancel}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Replay code</span>
          <input
            type="text"
            value={code}
            placeholder="dev/brightness@1:1x9k3f"
            autoFocus
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            Play
          </button>
        </div>
      </form>
    </Modal>
  );
}
