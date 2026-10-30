"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeable?: boolean;
};

const widths = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = "md",
  closeable = true,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeable) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeable, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#071c31]/65 p-3 backdrop-blur-sm md:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && closeable) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_28px_90px_rgba(3,20,38,.35)] md:max-h-[calc(100vh-3rem)] ${widths[size]}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 md:px-6">
          <div>
            <h2 id={titleId} className="text-xl font-extrabold text-[#092b4c]">
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-1 text-sm leading-6 text-slate-500"
              >
                {description}
              </p>
            )}
          </div>
          {closeable && (
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-[#092b4c]"
              aria-label="Đóng cửa sổ"
            >
              <X size={19} />
            </button>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          {children}
        </div>
      </section>
    </div>
  );
}
