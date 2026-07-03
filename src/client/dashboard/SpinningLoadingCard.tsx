import type { ReactNode } from 'react';
import { cardButtonClasses } from './DashboardCard';

type SpinningLoadingCardProps = {
  children: ReactNode;
};

/** Shared spinning-border loading shell for any priority/standard dashboard card. */
export const SpinningLoadingCard = ({ children }: SpinningLoadingCardProps) => (
  <div className="relative rounded-xl">
    {/* 1. The Spinning Border Layer (Masked to only show the edges) */}
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl p-[2px]"
      style={{
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }}
    >
      <div className="absolute inset-[-100%] animate-spin bg-[conic-gradient(from_0deg,transparent_0deg,transparent_250deg,#fb923c_285deg,#d93900_360deg)]" />
    </div>

    {/* 2. The Card Content (Now free to use bg-transparent) */}
    <button
      type="button"
      disabled
      className={`${cardButtonClasses} relative z-10 rounded-xl border-0 bg-transparent`}
    >
      {children}
    </button>
  </div>
);
