import type { ReactNode } from 'react';
import { cardButtonClasses, idleCardClasses } from './dashboardCardStyles';
import { SpinningLoadingCard } from './SpinningLoadingCard';

export type DashboardCardBadge = {
  label: string;
  emoji?: string;
  ariaLabel?: string;
  variant?: 'default' | 'accent';
};

type SubredditDashboardCardProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  badges?: DashboardCardBadge[];
  onSelect: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

const badgeVariantClasses: Record<
  NonNullable<DashboardCardBadge['variant']>,
  string
> = {
  default: 'text-gray-500 dark:text-gray-400',
  accent: 'font-medium text-orange-600 dark:text-orange-400',
};

export const SubredditDashboardCard = ({
  icon,
  title,
  description,
  badges = [],
  onSelect,
  isLoading = false,
  disabled = false,
}: SubredditDashboardCardProps) => {
  const cardContent = (
    <>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center text-2xl"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate font-semibold text-gray-900 dark:text-white">
          {title}
        </p>
        {description !== undefined && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
        {/* {badges.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className={`inline-flex items-center gap-0.5 text-xs ${badgeVariantClasses[badge.variant ?? 'default']}`}
                aria-label={badge.ariaLabel ?? badge.label}
              >
                <span>{badge.label}</span>
                {badge.emoji !== undefined && (
                  <span aria-hidden="true">{badge.emoji}</span>
                )}
              </span>
            ))}
          </div>
        )} */}
      </div>
    </>
  );

  if (isLoading) {
    return <SpinningLoadingCard>{cardContent}</SpinningLoadingCard>;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`${cardButtonClasses} ${idleCardClasses}`}
    >
      {cardContent}
    </button>
  );
};
