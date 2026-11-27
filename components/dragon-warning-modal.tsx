"use client";

import * as React from "react";
import { DEFAULT_BRAND_LOGO, DRAGON_WARNING_MESSAGE, MINIMUM_SUSHI_PIECES } from "@/lib/kimura-sushi-menu";

interface DragonWarningModalProps {
  open: boolean;
  currentCount: number;
  logoUrl?: string;
  onClose: () => void;
}

export function DragonWarningModal({
  open,
  currentCount,
  logoUrl,
  onClose,
}: DragonWarningModalProps) {
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const dragonSrc = logoUrl || DEFAULT_BRAND_LOGO;
  const remaining = Math.max(0, MINIMUM_SUSHI_PIECES - currentCount);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="dragon-warning-title"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      <div
        dir="rtl"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 text-center text-card-foreground shadow-2xl"
      >
        <div className="mx-auto flex justify-center">
          <img
            src={dragonSrc}
            alt="تنين كيمورا سوشي"
            className="h-44 w-auto sm:h-52 object-contain select-none drop-shadow-[0_12px_24px_rgba(0,0,0,0.28)]"
          />
        </div>

        <h2
          id="dragon-warning-title"
          className="mt-5 font-display text-xl sm:text-2xl font-semibold leading-snug text-foreground"
        >
          {DRAGON_WARNING_MESSAGE}
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {currentCount > 0
            ? `القطع المختارة حالياً: ${currentCount} قطعة — متبقي ${remaining} ${remaining === 1 ? "قطعة" : "قطع"} للوصول للحد الأدنى.`
            : "الحد الأدنى لطلب قطع السوشي الفردية هو 6 قطع على الأقل."}
        </p>

        <div className="mt-6">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            اختيار باقي القطع
          </button>
        </div>
      </div>
    </div>
  );
}
