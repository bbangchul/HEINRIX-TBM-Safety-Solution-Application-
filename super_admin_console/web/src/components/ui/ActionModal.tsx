import type { FormEvent, ReactNode } from "react";

interface ActionModalProps {
  className?: string;
  open: boolean;
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  submitTone?: "primary" | "danger" | "subtle";
  submitting?: boolean;
  disableSubmit?: boolean;
  onClose: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
}

export function ActionModal({
  className,
  open,
  title,
  description,
  submitLabel = "저장",
  cancelLabel = "취소",
  submitTone = "primary",
  submitting = false,
  disableSubmit = false,
  onClose,
  onSubmit,
  children,
}: ActionModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className={`modal-backdrop ${className ?? ""}`} role="dialog" aria-modal="true" aria-label={title}>
      <form className="modal-card" onSubmit={onSubmit ?? (event => event.preventDefault())}>
        <header className="modal-header">
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </header>

        <section className="modal-body">{children}</section>

        <footer className="modal-actions">
          <button type="button" className="action-btn subtle" onClick={onClose} disabled={submitting}>
            {cancelLabel}
          </button>
          {onSubmit && (
            <button
              type="submit"
              className={`action-btn ${submitTone}`}
              disabled={submitting || disableSubmit}
            >
              {submitting ? "처리 중..." : submitLabel}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}
