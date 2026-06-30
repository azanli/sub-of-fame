import { use } from 'react';
import type { InitResponse } from '../../shared/api';
import { HubDashboard } from './HubDashboard';

type HubDashboardFromPromiseProps = {
  initPromise: Promise<InitResponse>;
  onSelectSubreddit: (subreddit: string) => void;
  selectionError: string | null;
};

export const HubDashboardFromPromise = ({
  initPromise,
  onSelectSubreddit,
  selectionError,
}: HubDashboardFromPromiseProps) => {
  const initData = use(initPromise);

  if (!initData.isHub) {
    return null;
  }

  return (
    <HubDashboard
      initData={initData}
      onSelectSubreddit={onSelectSubreddit}
      selectionError={selectionError}
    />
  );
};
