import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  readonly title: string;
  readonly onClose: () => void;
  /** Extra class on the dialog, e.g. 'sheet' for the full-height side panel. */
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * A modal dialog, open while mounted. Escape or a tap on the backdrop calls
 * onClose; focus is trapped inside by the browser.
 */
export function Modal({ title, onClose, className, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={className ? `modal ${className}` : 'modal'}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-body">
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
