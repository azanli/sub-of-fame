type WalletBalanceBadgeProps = {
  coins: number;
};

export const WalletBalanceBadge = ({ coins }: WalletBalanceBadgeProps) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-4 py-1.5 text-sm font-semibold text-orange-800 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
    <img src="/coin.svg" alt="" aria-hidden="true" className="h-5 w-5" />
    <span className="tabular-nums">{coins}</span>
  </span>
);
