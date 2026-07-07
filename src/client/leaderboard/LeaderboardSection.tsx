import type { LeaderboardSection as LeaderboardSectionData } from '../../shared/api';
import { LeaderboardTable } from './LeaderboardTable';

type LeaderboardSectionProps = {
  section: LeaderboardSectionData;
  showHeading: boolean;
};

export const LeaderboardSection = ({
  section,
  showHeading,
}: LeaderboardSectionProps) => (
  <section className="flex flex-col gap-2">
    {showHeading && (
      <div className="flex items-center gap-2">
        {section.subredditMetadata !== null ? (
          <img
            src={section.subredditMetadata.iconUrl}
            alt=""
            className="h-6 w-6 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span aria-hidden="true" className="text-base">
            🏆
          </span>
        )}
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          {section.title}
        </h2>
      </div>
    )}
    {section.viewerRank !== null && (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Your rank: #{section.viewerRank}
      </p>
    )}
    <LeaderboardTable entries={section.entries} />
  </section>
);
