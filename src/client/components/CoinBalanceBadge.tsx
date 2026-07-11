type CoinBalanceBadgeVariant = 'neutral' | 'orange' | 'gold';

type CoinBalanceBadgeProps = {
  coins: number;
  variant: CoinBalanceBadgeVariant;
  className?: string;
  'aria-label'?: string;
};

const variantClassNames: Record<CoinBalanceBadgeVariant, string> = {
  neutral:
    'border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white',
  orange:
    'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-200',
  gold: 'border-amber-500 bg-gradient-to-b from-amber-50 to-amber-100 text-amber-950 dark:border-amber-400 dark:from-amber-950/70 dark:to-amber-900/50 dark:text-amber-100',
};

export const CoinBalanceBadge = ({
  coins,
  variant,
  className = '',
  'aria-label': ariaLabel = 'Karma Coin balance',
}: CoinBalanceBadgeProps) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold ${variantClassNames[variant]} ${className}`}
    aria-label={ariaLabel}
  >
    <img src="/coin.svg" alt="" aria-hidden="true" className="h-5 w-5" />
    <span className="tabular-nums transition-all duration-200">{coins}</span>
  </span>
);
