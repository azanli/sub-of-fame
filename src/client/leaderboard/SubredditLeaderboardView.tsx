import type { InitResponse, LeaderboardPageResponse } from '../../shared/api';
import { LeaderboardSection } from './LeaderboardSection';

type SubredditLeaderboardViewProps = {
  initData: InitResponse;
  data: LeaderboardPageResponse;
};

export const SubredditLeaderboardView = ({
  initData,
  data,
}: SubredditLeaderboardViewProps) => {
  const hostCard = initData.dashboardSubreddits?.[0] ?? null;
  const section = data.sections[0];

  if (section === undefined) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Could not load leaderboard.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {hostCard !== null && (
        <div className="flex items-center gap-3">
          <img
            src={hostCard.iconUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              r/{hostCard.subreddit}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              All-time leaderboard
            </p>
          </div>
        </div>
      )}
      <LeaderboardSection section={section} showHeading={false} />
    </div>
  );
};
