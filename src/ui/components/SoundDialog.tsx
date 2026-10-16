import { useState, type FormEvent } from 'react';
import { SOUND_NAME_MAX_LENGTH } from '../../engine/constants';
import { cleanName, parseTags } from '../../library/library';
import { Modal } from './Modal';

interface SoundDialogProps {
  readonly title: string;
  readonly submitLabel: string;
  readonly initialName: string;
  readonly initialTags: readonly string[];
  readonly onSubmit: (name: string, tags: string[]) => void;
  readonly onCancel: () => void;
}

/** Name and tags for saving or editing a sound. */
export function SoundDialog({ title, submitLabel, initialName, initialTags, onSubmit, onCancel }: SoundDialogProps) {
  const [name, setName] = useState(initialName);
  const [tags, setTags] = useState(initialTags.join(', '));

  function submit(event: FormEvent): void {
    event.preventDefault();
    onSubmit(cleanName(name), parseTags(tags));
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            maxLength={SOUND_NAME_MAX_LENGTH}
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Tags (optional, separated by commas)</span>
          <input
            type="text"
            value={tags}
            placeholder="bass, dark, pluck"
            onChange={(event) => setTags(event.target.value)}
          />
        </label>
        <div className="form-actions">
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
