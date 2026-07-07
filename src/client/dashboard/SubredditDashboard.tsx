import { useMemo, useState } from 'react';
import type { GameMode, InitResponse } from '../../shared/api';
import {
  CAMPAIGN_TIMEFRAMES,
  type CampaignTimeframe,
} from '../../shared/campaignTimeframes';
import { resolveHiveIQDisplay } from '../../shared/hiveIQ';
import { CommunityProfileHeader } from './CommunityProfileHeader';
import { DashboardSection } from './DashboardSection';
import { DashboardTopBar } from './DashboardTopBar';
import { HubSettingsPanel } from './HubSettingsPanel';
import { SubredditDashboardCard } from './SubredditDashboardCard';

type SubredditDashboardProps = {
  initData: InitResponse;
  onSelectCampaign: (timeframe: CampaignTimeframe) => void;
  loadingTimeframe?: CampaignTimeframe | null;
  gameMode: GameMode;
  onGameModeChange: (mode: GameMode) => void;
  isSavingGameMode?: boolean;
  gameModeError?: string | null;
};

const SETTINGS_PANEL_ID = 'subreddit-settings-panel';

export const SubredditDashboard = ({
  initData,
  onSelectCampaign,
  loadingTimeframe = null,
  gameMode,
  onGameModeChange,
  isSavingGameMode = false,
  gameModeError = null,
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
      />

      <DashboardSection label="Campaigns">
        {CAMPAIGN_TIMEFRAMES.map((campaign) => {
          const isLoading = loadingTimeframe === campaign.id;

          return (
            <SubredditDashboardCard
              key={campaign.id}
              icon={campaign.icon}
              title={campaign.title}
              description={campaign.description}
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
