import { useRef, useState } from 'react';
import { BACKUP_NUDGE_SAVES } from '../../engine/constants';
import { isReadOnly, querySounds, type Library, type SavedSound, type SortOrder } from '../../library/library';
import { Modal } from './Modal';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

interface LibraryPanelProps {
  readonly library: Library;
  readonly currentId: string | null;
  readonly onClose: () => void;
  readonly onLoad: (sound: SavedSound) => void;
  readonly onEdit: (id: string) => void;
  readonly onDuplicate: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onFavourite: (id: string) => void;
  readonly onExportOne: (id: string) => void;
  readonly onExportAll: () => void;
  readonly onImport: (file: File) => void;
  readonly onDismissBackup: () => void;
}

/** Saved sounds: search, sort, favourites, and per-sound actions. */
export function LibraryPanel(props: LibraryPanelProps) {
  const { library, currentId } = props;
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortOrder>('recent');
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(currentId);
  const fileInput = useRef<HTMLInputElement>(null);

  const sounds = querySounds(library, { search, sort, favouritesOnly });
  const empty = library.sounds.length === 0;

  return (
    <Modal title="Sounds" onClose={props.onClose} className="sheet">
      <div className="library-tools">
        <input
          type="search"
          className="input library-search"
          placeholder="Search names and tags"
          aria-label="Search sounds"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="input"
          aria-label="Sort by"
          value={sort}
          onChange={(event) => setSort(event.target.value === 'name' ? 'name' : 'recent')}
        >
          <option value="recent">Recent</option>
          <option value="name">Name</option>
        </select>
        <button
          type="button"
          className={favouritesOnly ? 'button on' : 'button'}
          aria-pressed={favouritesOnly}
          onClick={() => setFavouritesOnly(!favouritesOnly)}
        >
          ★ Favourites
        </button>
      </div>

      {library.savesSinceExport >= BACKUP_NUDGE_SAVES && (
        <div className="backup-nudge" role="status">
          <p>Sounds are stored in this browser only. Export a backup now and then so they're safe.</p>
          <div className="form-actions">
            <button type="button" className="button" onClick={props.onDismissBackup}>
              Not now
            </button>
            <button type="button" className="button primary" onClick={props.onExportAll}>
              Export backup
            </button>
          </div>
        </div>
      )}

      {empty ? (
        <p className="library-empty">No saved sounds yet. Make a sound you like and press Save.</p>
      ) : sounds.length === 0 ? (
        <p className="library-empty">No sounds match.</p>
      ) : (
        <ul className="sound-list">
          {sounds.map((sound) => {
            const open = expanded === sound.id;
            const readOnly = isReadOnly(sound);
            const meta = [
              sound.id === currentId ? 'open now' : null,
              readOnly ? 'preset' : null,
              sound.tags.length > 0 ? sound.tags.join(', ') : null,
              dateFormat.format(sound.updatedAt),
            ].filter((part) => part !== null);
            return (
              <li key={sound.id} className={open ? 'sound open' : 'sound'}>
                <div className="sound-row">
                  <button
                    type="button"
                    className={sound.favourite ? 'star on' : 'star'}
                    aria-pressed={sound.favourite}
                    aria-label={`Favourite ${sound.name}`}
                    onClick={() => props.onFavourite(sound.id)}
                  >
                    {sound.favourite ? '★' : '☆'}
                  </button>
                  <button
                    type="button"
                    className="sound-main"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : sound.id)}
                  >
                    <span className="sound-name">{sound.name}</span>
                    <span className="sound-meta">{meta.join(' · ')}</span>
                  </button>
                </div>
                {open && (
                  <div className="sound-actions">
                    <button type="button" className="button primary" onClick={() => props.onLoad(sound)}>
                      Load
                    </button>
                    {!readOnly && (
                      <button type="button" className="button" onClick={() => props.onEdit(sound.id)}>
                        Rename
                      </button>
                    )}
                    <button type="button" className="button" onClick={() => props.onDuplicate(sound.id)}>
                      Duplicate
                    </button>
                    <button type="button" className="button" onClick={() => props.onExportOne(sound.id)}>
                      Export
                    </button>
                    {!readOnly && (
                      <button type="button" className="button danger-outline" onClick={() => props.onDelete(sound.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="library-footer">
        <button type="button" className="button" disabled={empty} onClick={props.onExportAll}>
          Export all
        </button>
        <button type="button" className="button" onClick={() => fileInput.current?.click()}>
          Import
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) props.onImport(file);
          }}
        />
        <button type="button" className="button primary library-done" onClick={props.onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
