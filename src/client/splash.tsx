import './index.css';
import './splash.css';

import { requestExpandedMode } from '@devvit/web/client';
import { StrictMode, useEffect, useState, type MouseEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { InitResponse } from '../shared/api';
import { trpcClient } from './trpc';

const LOADING_MESSAGES = [
  'Consulting the hivemind...',
  'Scouting the subreddits...',
  'Reading the room...',
  'Weighing the internet...',
  'Decoding the comment roots...',
  'Summoning the upvote experts...',
  'Scrambling the comments...',
] as const;

const ONBOARDING_STEPS = [
  { icon: '🧵', copy: 'Read a viral Reddit post.' },
  { icon: '🎯', copy: 'Rank the top three comments.' },
  { icon: '🧠', copy: 'Test your social wits.' },
] as const;

type SplashPhase = 'loading' | 'ready' | 'error';

const PlayIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

const SplashFooter = () => (
  <footer className="absolute bottom-3 left-0 right-0 px-4 text-center text-[0.65rem] leading-relaxed text-gray-600">
    α Build v0.1.0-alpha • Environment: Sandbox • Report bugs to r/SubOfFame
  </footer>
);

const OnboardingStepRow = ({ icon, copy }: { icon: string; copy: string }) => (
  <div className="flex w-full max-w-md items-center justify-center gap-3 rounded-xl bg-gray-800/70 px-3 py-3.5">
    <div
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl"
    >
      {icon}
    </div>
    <p className="min-w-0 flex-1 text-left text-sm leading-snug text-gray-200">
      {copy}
    </p>
  </div>
);

const SplashHeader = ({
  playerName,
  hasGameData,
  isLoading,
}: {
  playerName: string;
  hasGameData: boolean;
  isLoading: boolean;
}) => (
  <header className="flex w-full max-w-md flex-col items-center pt-10 text-center">
    <h1 className="text-3xl font-bold tracking-wide text-[#d93900]">
      Sub of Fame
    </h1>
    <p className="text-[0.68rem] font-medium uppercase tracking-[0.28em] text-gray-400">
      The Best of Reddit
    </p>
    {isLoading ? (
      <div className="flex flex-col items-center gap-3">
        <p className="min-h-[1.5rem] animate-pulse text-sm text-gray-300"> </p>
      </div>
    ) : (
      <p className="text-md text-gray-300 mt-2">
        {hasGameData ? 'Welcome back,' : 'Welcome,'}{' '}
        <span className="font-medium font-bold text-[#d93900]">
          {playerName}
        </span>
      </p>
    )}
  </header>
);

const SplashScreen = ({
  isLoading,
  loadingMessage,
  playerName,
  hasGameData,
}: {
  isLoading: boolean;
  loadingMessage: string;
  playerName: string;
  hasGameData: boolean;
}) => {
  const handleLaunch = (event: MouseEvent<HTMLButtonElement>) => {
    requestExpandedMode(event.nativeEvent, 'game');
  };

  return (
    <div className="relative flex h-full flex-col bg-gray-900 px-6 items-center">
      <SplashHeader
        playerName={playerName}
        hasGameData={hasGameData}
        isLoading={isLoading}
      />

      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8">
        {ONBOARDING_STEPS.map(({ icon, copy }) => (
          <OnboardingStepRow key={copy} icon={icon} copy={copy} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-8 pb-14">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#ff4500] border-t-transparent" />
            <p
              key={loadingMessage}
              className="min-h-[1.25rem] animate-pulse text-sm text-gray-300"
            >
              {loadingMessage}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleLaunch}
            className="cursor-pointer rounded-full bg-[#d93900] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#c23300]"
          >
            <div className="flex items-center justify-center gap-2">
              Play
              <PlayIcon />
            </div>
          </button>
        )}
      </div>

      <SplashFooter />
    </div>
  );
};

const SplashErrorScreen = ({ onRetry }: { onRetry: () => void }) => (
  <div className="relative flex h-full flex-col items-center justify-center gap-6 bg-gray-900 px-6">
    <img
      className="mx-auto w-1/2 max-w-[220px] object-contain"
      src="/snoo.png"
      alt="Snoo"
    />
    <div className="flex flex-col items-center gap-2 text-center">
      <h1 className="text-2xl font-bold text-white">Connection failed</h1>
      <p className="max-w-xs text-sm text-gray-400">
        We couldn&apos;t reach the hivemind. Check your connection and try
        again.
      </p>
    </div>
    <button
      type="button"
      onClick={onRetry}
      className="rounded-full bg-[#d93900] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c23300]"
    >
      Retry Connection
    </button>
    <SplashFooter />
  </div>
);

export const Splash = () => {
  const [phase, setPhase] = useState<SplashPhase>('loading');
  const [initData, setInitData] = useState<InitResponse | null>(null);
  const [messageIndex, setMessageIndex] = useState(
    // eslint-disable-next-line react-hooks/purity
    Math.floor(Math.random() * LOADING_MESSAGES.length)
  );
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setPhase('loading');
    setInitData(null);
    setRetryCount((count) => count + 1);
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const init = await trpcClient.init.query();
        if (!cancelled) {
          setInitData(init);
          setPhase('ready');
        }
      } catch {
        if (!cancelled) {
          setPhase('error');
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  useEffect(() => {
    if (phase !== 'loading') {
      return;
    }

    const intervalId = window.setInterval(() => {
      setMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));
    }, 2400);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [phase]);

  if (phase === 'error') {
    return <SplashErrorScreen onRetry={handleRetry} />;
  }

  return (
    <SplashScreen
      isLoading={phase === 'loading'}
      loadingMessage={LOADING_MESSAGES[messageIndex] ?? LOADING_MESSAGES[0]}
      playerName={initData?.playerName ?? 'Guest'}
      hasGameData={initData?.hasGameData ?? false}
    />
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
