"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

export type GuidedTourStep = {
  id: string;
  target: string;
  title: string;
  description: string;
  tab?: string;
  illustration:
    | "sidebar"
    | "overview"
    | "students"
    | "sources"
    | "create-exam"
    | "exam-list"
    | "attempts"
    | "materials";
};

type WorkspaceGuidedTourProps = {
  open: boolean;
  steps: GuidedTourStep[];
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onClose: () => void;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function WorkspaceGuidedTour({
  open,
  steps,
  currentTab,
  onSelectTab,
  onClose,
}: WorkspaceGuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const [viewport, setViewport] = useState({ width: 1280, height: 800 });

  const activeStep = steps[stepIndex] || steps[0];

  const handleClose = useCallback(() => {
    setStepIndex(0);
    onClose();
  }, [onClose]);

  const measureTarget = useCallback(() => {
    if (!open || !activeStep || typeof window === "undefined") return;
    setViewport({ width: window.innerWidth, height: window.innerHeight });
    const element = document.querySelector<HTMLElement>(
      `[data-tour="${activeStep.target}"]`,
    );
    if (!element) {
      setRect(null);
      return;
    }
    const bounds = element.getBoundingClientRect();
    const pad = 6;
    setRect({
      top: Math.max(8, bounds.top - pad),
      left: Math.max(8, bounds.left - pad),
      width: Math.min(window.innerWidth - 16, bounds.width + pad * 2),
      height: Math.min(window.innerHeight - 16, bounds.height + pad * 2),
    });
  }, [open, activeStep]);

  useEffect(() => {
    if (!open || !activeStep) return;

    if (activeStep.tab && activeStep.tab !== currentTab) {
      onSelectTab(activeStep.tab);
    }

    const timer = window.setTimeout(() => {
      const element = document.querySelector<HTMLElement>(
        `[data-tour="${activeStep.target}"]`,
      );
      if (element) {
        const bounds = element.getBoundingClientRect();
        const isOutOfView =
          bounds.top < 20 ||
          bounds.bottom > window.innerHeight - 20 ||
          bounds.left < 0 ||
          bounds.right > window.innerWidth;
        if (isOutOfView) {
          element.scrollIntoView({ behavior: "instant", block: "center" });
        }
      }
      measureTarget();
    }, 120);

    const timerLate = window.setTimeout(() => {
      measureTarget();
    }, 360);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timerLate);
    };
  }, [open, activeStep, currentTab, onSelectTab, measureTarget]);

  useEffect(() => {
    if (!open) return;
    const handleUpdate = () => measureTarget();
    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);
    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [open, measureTarget]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (stepIndex < steps.length - 1) {
          setStepIndex((prev) => prev + 1);
        } else {
          handleClose();
        }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (stepIndex > 0) {
          setStepIndex((prev) => prev - 1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, stepIndex, steps.length, handleClose]);

  if (!open || !activeStep) return null;

  const cardWidth = Math.min(368, viewport.width - 24);
  const cardHeightEstimate = 350;
  const gap = 16;

  let popoverTop = Math.max(16, (viewport.height - cardHeightEstimate) / 2);
  let popoverLeft = Math.max(16, (viewport.width - cardWidth) / 2);

  if (rect) {
    const spaceRight = viewport.width - (rect.left + rect.width);
    const spaceLeft = rect.left;
    const spaceBottom = viewport.height - (rect.top + rect.height);
    const spaceTop = rect.top;

    if (spaceRight >= cardWidth + gap + 16) {
      popoverLeft = rect.left + rect.width + gap;
      popoverTop = Math.max(
        16,
        Math.min(rect.top, viewport.height - cardHeightEstimate - 16),
      );
    } else if (spaceBottom >= cardHeightEstimate + gap) {
      popoverTop = rect.top + rect.height + gap;
      popoverLeft = Math.max(
        16,
        Math.min(rect.left, viewport.width - cardWidth - 16),
      );
    } else if (spaceLeft >= cardWidth + gap + 16) {
      popoverLeft = rect.left - cardWidth - gap;
      popoverTop = Math.max(
        16,
        Math.min(rect.top, viewport.height - cardHeightEstimate - 16),
      );
    } else if (spaceTop >= cardHeightEstimate + gap) {
      popoverTop = Math.max(16, rect.top - cardHeightEstimate - gap);
      popoverLeft = Math.max(
        16,
        Math.min(rect.left, viewport.width - cardWidth - 16),
      );
    } else {
      popoverTop = Math.max(16, viewport.height - cardHeightEstimate - 20);
      popoverLeft = Math.max(16, (viewport.width - cardWidth) / 2);
    }
  }

  const isLastStep = stepIndex === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-[140]"
      role="dialog"
      aria-modal="true"
      aria-label={`Hướng dẫn sử dụng bước ${stepIndex + 1} trên ${steps.length}: ${activeStep.title}`}
    >
      {/* Dimmed backdrop when no target rect is found */}
      {!rect && (
        <div
          className="fixed inset-0 bg-[#070b19]/75 backdrop-blur-[2px]"
          onClick={handleClose}
        />
      )}

      {/* Spotlight Highlight Frame with Giant Box-Shadow Cutout */}
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[141] rounded-2xl border-2 border-[#a855f7] transition-all duration-300 ease-out"
          style={{
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            boxShadow:
              "0 0 0 9999px rgba(8, 12, 26, 0.72), 0 0 0 4px rgba(168, 85, 247, 0.24), 0 0 28px rgba(168, 85, 247, 0.55)",
          }}
        />
      )}

      {/* Click-outside catcher around the popover */}
      <div
        className="fixed inset-0 z-[142]"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Floating Tour Popover Card */}
      <section
        onClick={(event) => event.stopPropagation()}
        style={{
          top: `${popoverTop}px`,
          left: `${popoverLeft}px`,
          width: `${cardWidth}px`,
        }}
        className="fixed z-[143] overflow-hidden rounded-2xl border border-[#8b5cf6]/35 bg-[#1b1035] text-white shadow-[0_24px_70px_rgba(0,0,0,0.65),0_0_40px_rgba(139,92,246,0.2)] transition-all duration-300 ease-out"
      >
        {/* Top Schematic Illustration Header */}
        <div
          className="relative flex h-28 items-center justify-center border-b border-white/10 bg-[#140b29] px-6"
          style={{
            backgroundImage:
              "radial-gradient(rgba(168, 85, 247, 0.18) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
          }}
        >
          <TourStepIllustration type={activeStep.illustration} />
          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng hướng dẫn"
            className="absolute right-3 top-3 grid size-7 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step Content Body */}
        <div className="p-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#c4b5fd]">
            HƯỚNG DẪN · {stepIndex + 1}/{steps.length}
          </p>
          <h3 className="mt-1.5 text-lg font-extrabold tracking-tight text-white">
            {activeStep.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {activeStep.description}
          </p>

          {/* Footer Controls: Progress Dots + Skip / Back / Next */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
            <div
              className="flex items-center gap-1.5"
              role="tablist"
              aria-label="Các bước hướng dẫn"
            >
              {steps.map((step, idx) => {
                const isActive = idx === stepIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Bước ${idx + 1}: ${step.title}`}
                    onClick={() => setStepIndex(idx)}
                    className={`h-2 rounded-full transition-all duration-200 ${
                      isActive
                        ? "w-5 bg-[#9333ea]"
                        : "w-2 bg-white/25 hover:bg-white/45"
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-2 py-1.5 text-xs font-bold text-slate-300 transition hover:text-white"
              >
                Bỏ qua
              </button>
              {stepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
                  className="rounded-lg border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-white/20"
                >
                  Quay lại
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (isLastStep) {
                    handleClose();
                  } else {
                    setStepIndex((prev) => prev + 1);
                  }
                }}
                className="rounded-lg bg-[#8b5cf6] px-3.5 py-1.5 text-xs font-extrabold text-white shadow-[0_4px_14px_rgba(139,92,246,0.45)] transition hover:bg-[#7c3aed]"
              >
                {isLastStep ? "Hoàn tất" : "Tiếp"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function TourStepIllustration({
  type,
}: {
  type: GuidedTourStep["illustration"];
}) {
  switch (type) {
    case "sidebar":
      return (
        <svg
          width="140"
          height="64"
          viewBox="0 0 140 64"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="10"
            y="8"
            width="120"
            height="48"
            rx="8"
            stroke="#a855f7"
            strokeOpacity="0.45"
            strokeWidth="1.5"
            fill="#1e1338"
          />
          <rect
            x="16"
            y="14"
            width="34"
            height="36"
            rx="5"
            fill="#2e1d59"
          />
          <rect x="20" y="19" width="26" height="6" rx="3" fill="#a855f7" />
          <rect
            x="20"
            y="29"
            width="22"
            height="5"
            rx="2.5"
            fill="#ffffff"
            fillOpacity="0.3"
          />
          <rect
            x="20"
            y="38"
            width="24"
            height="5"
            rx="2.5"
            fill="#ffffff"
            fillOpacity="0.3"
          />
          <rect
            x="58"
            y="16"
            width="64"
            height="12"
            rx="4"
            fill="#ffffff"
            fillOpacity="0.1"
          />
          <rect
            x="58"
            y="33"
            width="44"
            height="15"
            rx="4"
            fill="#ffffff"
            fillOpacity="0.08"
          />
        </svg>
      );
    case "overview":
      return (
        <svg
          width="140"
          height="64"
          viewBox="0 0 140 64"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="12"
            y="12"
            width="35"
            height="40"
            rx="6"
            fill="#251645"
            stroke="#a855f7"
            strokeWidth="1.5"
          />
          <rect x="18" y="20" width="16" height="6" rx="3" fill="#c084fc" />
          <rect
            x="18"
            y="32"
            width="22"
            height="4"
            rx="2"
            fill="#ffffff"
            fillOpacity="0.3"
          />
          <rect
            x="53"
            y="12"
            width="35"
            height="40"
            rx="6"
            fill="#251645"
            stroke="#ffffff"
            strokeOpacity="0.2"
          />
          <rect x="59" y="20" width="18" height="6" rx="3" fill="#38bdf8" />
          <rect
            x="59"
            y="32"
            width="22"
            height="4"
            rx="2"
            fill="#ffffff"
            fillOpacity="0.3"
          />
          <rect
            x="94"
            y="12"
            width="35"
            height="40"
            rx="6"
            fill="#251645"
            stroke="#ffffff"
            strokeOpacity="0.2"
          />
          <rect x="100" y="20" width="14" height="6" rx="3" fill="#34d399" />
          <rect
            x="100"
            y="32"
            width="22"
            height="4"
            rx="2"
            fill="#ffffff"
            fillOpacity="0.3"
          />
        </svg>
      );
    case "students":
      return (
        <svg
          width="140"
          height="64"
          viewBox="0 0 140 64"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="14"
            y="10"
            width="112"
            height="44"
            rx="8"
            fill="#231442"
            stroke="#a855f7"
            strokeOpacity="0.6"
            strokeWidth="1.5"
          />
          <circle cx="32" cy="27" r="8" fill="#a855f7" />
          <rect x="46" y="21" width="42" height="5" rx="2.5" fill="#ffffff" />
          <rect
            x="46"
            y="30"
            width="64"
            height="4"
            rx="2"
            fill="#ffffff"
            fillOpacity="0.35"
          />
          <rect
            x="24"
            y="42"
            width="92"
            height="5"
            rx="2.5"
            fill="#ffffff"
            fillOpacity="0.12"
          />
          <rect x="24" y="42" width="68" height="5" rx="2.5" fill="#34d399" />
        </svg>
      );
    case "sources":
      return (
        <svg
          width="140"
          height="64"
          viewBox="0 0 140 64"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="22"
            y="12"
            width="96"
            height="40"
            rx="8"
            fill="#231442"
            stroke="#a855f7"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <path
            d="M70 40V22M70 22L63 29M70 22L77 29"
            stroke="#c084fc"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="42"
            y="43"
            width="56"
            height="4"
            rx="2"
            fill="#ffffff"
            fillOpacity="0.35"
          />
        </svg>
      );
    case "create-exam":
      return (
        <svg
          width="140"
          height="64"
          viewBox="0 0 140 64"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="18"
            y="10"
            width="104"
            height="44"
            rx="8"
            fill="#231442"
            stroke="#a855f7"
            strokeWidth="1.5"
          />
          <rect
            x="28"
            y="18"
            width="52"
            height="6"
            rx="3"
            fill="#ffffff"
            fillOpacity="0.85"
          />
          <rect
            x="28"
            y="29"
            width="84"
            height="5"
            rx="2.5"
            fill="#ffffff"
            fillOpacity="0.25"
          />
          <rect x="82" y="38" width="30" height="10" rx="5" fill="#9333ea" />
        </svg>
      );
    case "exam-list":
    case "attempts":
    case "materials":
    default:
      return (
        <svg
          width="140"
          height="64"
          viewBox="0 0 140 64"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="16"
            y="12"
            width="108"
            height="24"
            rx="6"
            fill="#231442"
            stroke="#a855f7"
            strokeWidth="1.5"
          />
          <circle
            cx="28"
            cy="24"
            r="5"
            stroke="#c084fc"
            strokeWidth="1.8"
          />
          <path
            d="M32 28L36 32"
            stroke="#c084fc"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <rect
            x="42"
            y="21"
            width="48"
            height="5"
            rx="2.5"
            fill="#ffffff"
            fillOpacity="0.5"
          />
          <rect
            x="104"
            y="18"
            width="14"
            height="12"
            rx="3"
            stroke="#ffffff"
            strokeOpacity="0.35"
          />
          <rect
            x="38"
            y="43"
            width="64"
            height="4"
            rx="2"
            fill="#ffffff"
            fillOpacity="0.25"
          />
          <rect
            x="46"
            y="51"
            width="48"
            height="3"
            rx="1.5"
            fill="#ffffff"
            fillOpacity="0.15"
          />
        </svg>
      );
  }
}
