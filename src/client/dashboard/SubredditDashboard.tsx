import { useMemo, useState } from 'react';
import type { GameMode, InitResponse } from '../../shared/api';
import {
  CAMPAIGN_TIMEFRAMES,
  type CampaignTimeframe,
} from '../../shared/campaignTimeframes';
import { resolveHiveIQDisplay, formatHiveIQDisplayText } from '../../shared/hiveIQ';
import { CommunityProfileHeader } from './CommunityProfileHeader';
import { DashboardSection } from './DashboardSection';
import { DashboardTopBar } from './DashboardTopBar';
import { HubSettingsPanel } from './HubSettingsPanel';
import {
  SubredditDashboardCard,
  type DashboardCardBadge,
} from './SubredditDashboardCard';

type SubredditDashboardProps = {
  initData: InitResponse;
  onSelectCampaign: (timeframe: CampaignTimeframe) => void;
  onLeaderboardClick?: () => void;
  loadingTimeframe?: CampaignTimeframe | null;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  isSavingGameMode?: boolean;
  gameModeError?: string | null;
  onDeleteUserData: () => Promise<void>;
  isDeletingUserData?: boolean;
  deleteUserDataError?: string | null;
};

const SETTINGS_PANEL_ID = 'subreddit-settings-panel';

export const SubredditDashboard = ({
  initData,
  onSelectCampaign,
  onLeaderboardClick,
  loadingTimeframe = null,
  gameMode,
  onGameModeChange,
  isSavingGameMode = false,
  gameModeError = null,
  onDeleteUserData,
  isDeletingUserData = false,
  deleteUserDataError = null,
}: SubredditDashboardProps) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isLoggedIn = initData.userGlobalHiveIQ !== null;
  const isLoadingSelection = loadingTimeframe !== null;

  const hostCard = initData.dashboardSubreddits?.[0] ?? null;

  const hiveIQDisplay = useMemo(() => {
    if (hostCard === null) {
      return null;
    }

    return resolveHiveIQDisplay(
      hostCard.userSubredditHiveIQ,
      hostCard.completedRoundCount
    );
  }, [hostCard]);

  if (hostCard === null) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4">
        <DashboardTopBar
          coins={isLoggedIn ? initData.coins : null}
          showSettings={false}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Could not load community profile.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4">
      <DashboardTopBar
        coins={isLoggedIn ? initData.coins : null}
        {...(onLeaderboardClick !== undefined ? { onLeaderboardClick } : {})}
        isSettingsOpen={isSettingsOpen}
        onSettingsToggle={() => {
          setIsSettingsOpen((open) => !open);
        }}
        settingsPanelId={SETTINGS_PANEL_ID}
      />

      <CommunityProfileHeader
        iconUrl={hostCard.iconUrl}
        displayName={hostCard.subreddit}
        hiveIQDisplay={hiveIQDisplay}
        leaderboardRank={hostCard.leaderboardRank}
      />

      <HubSettingsPanel
        id={SETTINGS_PANEL_ID}
        isOpen={isSettingsOpen}
        gameMode={gameMode}
        onGameModeChange={onGameModeChange}
        isSavingGameMode={isSavingGameMode}
        gameModeError={gameModeError}
        isLoggedIn={isLoggedIn}
        onDeleteUserData={onDeleteUserData}
        isDeletingUserData={isDeletingUserData}
        deleteUserDataError={deleteUserDataError}
      />

      <DashboardSection label="Campaigns">
        {CAMPAIGN_TIMEFRAMES.map((campaign) => {
          const isLoading = loadingTimeframe === campaign.id;
          const metrics = initData.campaignMetrics?.find(
            (entry) => entry.timeframe === campaign.id
          );
          const hiveIQDisplay =
            metrics !== undefined
              ? resolveHiveIQDisplay(
                  metrics.userCampaignHiveIQ,
                  metrics.completedRoundCount
                )
              : null;
          const badges: DashboardCardBadge[] = [];

          if (metrics !== undefined && metrics.currentRankIndex > 1) {
            badges.push({
              label: `Rank ${metrics.currentRankIndex}`,
              emoji: '🎯',
              ariaLabel: `Next playable rank ${metrics.currentRankIndex}`,
            });
          }

          if (metrics?.leaderboardRank !== null && metrics?.leaderboardRank !== undefined) {
            badges.push({
              label: `#${metrics.leaderboardRank}`,
              emoji: '🏆',
              variant: 'accent',
              ariaLabel: `Leaderboard rank ${metrics.leaderboardRank}`,
            });
          }

          if (hiveIQDisplay !== null && hiveIQDisplay.kind !== 'unplayed') {
            const hiveIQBadge: DashboardCardBadge = {
              label: formatHiveIQDisplayText(hiveIQDisplay),
              ariaLabel: `Hive IQ ${formatHiveIQDisplayText(hiveIQDisplay)}`,
            };
            if (hiveIQDisplay.kind === 'score') {
              hiveIQBadge.emoji = '🧠';
            }
            badges.push(hiveIQBadge);
          }

          return (
            <SubredditDashboardCard
              key={campaign.id}
              icon={campaign.icon}
              title={campaign.title}
              description={campaign.description}
              badges={badges}
              onSelect={() => {
                onSelectCampaign(campaign.id);
              }}
              isLoading={isLoading}
              disabled={isLoadingSelection && !isLoading}
            />
          );
        })}
      </DashboardSection>

      <img
        className="mx-auto w-1/2 max-w-[220px] object-contain animate-[skip-snoo-rise_ease-out_both]"
        style={{ animationDuration: '700ms', animationDelay: '150ms' }}
        src="/snoo.png"
        alt="Snoo thinking about the hivemind"
      />
    </div>
  );
};
