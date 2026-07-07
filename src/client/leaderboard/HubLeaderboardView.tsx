import type { LeaderboardPageResponse } from '../../shared/api';
import { LeaderboardSection } from './LeaderboardSection';

type HubLeaderboardViewProps = {
  data: LeaderboardPageResponse;
};

export const HubLeaderboardView = ({ data }: HubLeaderboardViewProps) => (
  <div className="flex flex-col gap-6">
    {data.sections.map((section) => (
      <LeaderboardSection
        key={
          section.scope.kind === 'ecosystem'
            ? 'ecosystem'
            : section.scope.subredditName
        }
        section={section}
        showHeading
      />
    ))}
  </div>
);
