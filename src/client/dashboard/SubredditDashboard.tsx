import { useMemo, useState } from 'react';
import type { GameMode, InitResponse } from '../../shared/api';
import {
  HISTORICAL_CAMPAIGN_TIMEFRAMES,
  type CampaignTimeframe,
} from '../../shared/campaignTimeframes';
import { normalizeSubredditDisplayName } from '../../shared/subreddits';
import {
  resolveHiveIQDisplay,
  formatHiveIQDisplayText,
} from '../../shared/hiveIQ';
import { useFakeRubberBand } from '../useFakeRubberBand';
import { DashboardFooterAnimation } from './DashboardFooterAnimation';
import { DashboardSection } from './DashboardSection';
import { DashboardSpaceScene } from './DashboardSpaceScene';
import { DashboardTopBar } from './DashboardTopBar';
import { HubSettingsPanel } from './HubSettingsPanel';
import { LiveGauntletCard } from './LiveGauntletCard';
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
const LIVE_GAUNTLET_TIMEFRAME: CampaignTimeframe = 'day';

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
  useFakeRubberBand();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isLoggedIn = initData.userGlobalHiveIQ !== null;
  const isLoadingSelection = loadingTimeframe !== null;
  const isLiveGauntletLoading = loadingTimeframe === LIVE_GAUNTLET_TIMEFRAME;

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

  if (isSettingsOpen) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4">
        <DashboardTopBar
          coins={isLoggedIn ? initData.coins : null}
          leaderboardLabel={`r/${normalizeSubredditDisplayName(hostCard.subreddit)}`}
          {...(onLeaderboardClick !== undefined ? { onLeaderboardClick } : {})}
          isSettingsOpen={isSettingsOpen}
          onSettingsToggle={() => {
            setIsSettingsOpen((open) => !open);
          }}
          settingsPanelId={SETTINGS_PANEL_ID}
        />

        <HubSettingsPanel
          id={SETTINGS_PANEL_ID}
          faqVariant="hub"
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
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-4">
      <DashboardTopBar
        coins={isLoggedIn ? initData.coins : null}
        leaderboardLabel={`r/${hostCard.subreddit}`}
        {...(onLeaderboardClick !== undefined ? { onLeaderboardClick } : {})}
        isSettingsOpen={isSettingsOpen}
        onSettingsToggle={() => {
          setIsSettingsOpen((open) => !open);
        }}
        settingsPanelId={SETTINGS_PANEL_ID}
      />

      <DashboardSpaceScene isLoadingSelection={isLoadingSelection} />

      {initData.dailyChallenge !== null && (
        <DashboardSection label="Daily Challenge">
          <div className="rounded-xl animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] shadow-[0_0_15px_rgba(217,57,0,0.6)] border border-[#d93900]/50">
            <LiveGauntletCard
              iconUrl={hostCard.iconUrl}
              displayName={hostCard.subreddit}
              resetsAt={initData.dailyChallenge.resetsAt}
              hiveIQDisplay={hiveIQDisplay}
              leaderboardRank={hostCard.leaderboardRank}
              onSelect={() => {
                onSelectCampaign(LIVE_GAUNTLET_TIMEFRAME);
              }}
              isLoading={isLiveGauntletLoading}
              disabled={isLoadingSelection && !isLiveGauntletLoading}
            />
          </div>
        </DashboardSection>
      )}

      <DashboardSection label="Campaigns">
        {HISTORICAL_CAMPAIGN_TIMEFRAMES.map((campaign) => {
          const isLoading = loadingTimeframe === campaign.id;
          const metrics = initData.campaignMetrics?.find(
            (entry) => entry.timeframe === campaign.id
          );
          const campaignHiveIQDisplay =
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

          if (
            metrics?.leaderboardRank !== null &&
            metrics?.leaderboardRank !== undefined
          ) {
            badges.push({
              label: `#${metrics.leaderboardRank}`,
              emoji: '🏆',
              variant: 'accent',
              ariaLabel: `Leaderboard rank ${metrics.leaderboardRank}`,
            });
          }

          if (
            campaignHiveIQDisplay !== null &&
            campaignHiveIQDisplay.kind !== 'unplayed'
          ) {
            const hiveIQBadge: DashboardCardBadge = {
              label: formatHiveIQDisplayText(campaignHiveIQDisplay),
              ariaLabel: `Hive IQ ${formatHiveIQDisplayText(campaignHiveIQDisplay)}`,
            };
            if (campaignHiveIQDisplay.kind === 'score') {
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

      <DashboardFooterAnimation />
    </div>
  );
};
