import { useEffect, useState } from 'react';
import type { InitResponse } from '../../shared/api';
import { HubDashboard } from '../dashboard/HubDashboard';
import { StartPuzzleGateSkeleton } from './StartPuzzleGateSkeleton';

const CARD_ANIMATION_MIN_MS = 1500;

type PuzzleLoadTransitionProps = {
  fromHubSelection: boolean;
  initData: InitResponse | null;
  loadingSubreddit: string;
  subredditDisplayName: string;
  onExit: () => void;
  selectionError: string | null;
};

export const PuzzleLoadTransition = ({
  fromHubSelection,
  initData,
  loadingSubreddit,
  subredditDisplayName,
  onExit,
  selectionError,
}: PuzzleLoadTransitionProps) => {
  const [showSkeleton, setShowSkeleton] = useState(!fromHubSelection);

  useEffect(() => {
    if (!fromHubSelection) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSkeleton(true);
    }, CARD_ANIMATION_MIN_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fromHubSelection]);

  if (fromHubSelection && !showSkeleton && initData !== null) {
    return (
      <HubDashboard
        initData={initData}
        loadingSubreddit={loadingSubreddit}
        onSelectSubreddit={() => undefined}
        selectionError={selectionError}
      />
    );
  }

  return (
    <StartPuzzleGateSkeleton
      subredditDisplayName={subredditDisplayName}
      onExit={onExit}
    />
  );
};
