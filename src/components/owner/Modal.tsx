import type { ComponentChildren } from 'preact';

/** Native <dialog> modal: focus trap, Esc to close and backdrop come from the browser. */
export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  return (
    <dialog
      class="modal"
      aria-label={title}
      ref={(el) => {
        if (el && !el.open) {
          el.showModal();
          el.querySelector<HTMLElement>('input,select,textarea')?.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
