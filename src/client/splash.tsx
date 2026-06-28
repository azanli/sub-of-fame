import './index.css';

import type { InitResponse } from '../shared/api';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { trpcClient } from './trpc';

const FADE_DURATION_MS = 300;

const LOADING_MESSAGES = [
  'Consulting the hivemind...',
  'Scouting the subreddits...',
] as const;

type SplashPhase = 'loading' | 'fading' | 'ready' | 'error';

const SplashLoadingScreen = ({
  message,
  isFading,
}: {
  message: string;
  isFading: boolean;
}) => (
  <div
    className={`relative flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-900 px-6 transition-opacity duration-300 ${
      isFading ? 'opacity-0' : 'opacity-100'
    }`}
  >
    <img
      className="mx-auto w-1/2 max-w-[220px] object-contain"
      src="/snoo.png"
      alt="Snoo"
    />
    <div className="flex flex-col items-center gap-2 text-center">
      <h1 className="text-3xl font-bold tracking-wide text-white">
        Sub <span className="text-[#ff4500]">of</span> Fame
      </h1>
      <p className="max-w-xs text-sm text-gray-400">
        A social psychology game for witty Redditors.
      </p>
    </div>
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#ff4500] border-t-transparent" />
      <p
        key={message}
        className="min-h-[1.25rem] animate-pulse text-sm text-gray-300"
      >
        {message}
      </p>
    </div>
    <footer className="absolute bottom-3 left-0 right-0 px-4 text-center text-[0.65rem] leading-relaxed text-gray-600">
      α Build v0.1.0-alpha • Environment: Sandbox • Report bugs to r/SubOfFame
    </footer>
  </div>
);

const SplashErrorScreen = ({ onRetry }: { onRetry: () => void }) => (
  <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-900 px-6">
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
    <footer className="absolute bottom-3 left-0 right-0 px-4 text-center text-[0.65rem] leading-relaxed text-gray-600">
      α Build v0.1.0-alpha • Environment: Sandbox • Report bugs to r/SubOfFame
    </footer>
  </div>
);

export const Splash = () => {
  const [phase, setPhase] = useState<SplashPhase>('loading');
  const [initData, setInitData] = useState<InitResponse | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const fadeTimeoutRef = useRef<number | undefined>(undefined);

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
        if (cancelled) {
          return;
        }

        setInitData(init);
        setPhase('fading');

        fadeTimeoutRef.current = window.setTimeout(() => {
          if (!cancelled) {
            setPhase('ready');
          }
        }, FADE_DURATION_MS);
      } catch {
        if (!cancelled) {
          setPhase('error');
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
      window.clearTimeout(fadeTimeoutRef.current);
    };
  }, [retryCount]);

  useEffect(() => {
    if (phase !== 'loading' && phase !== 'fading') {
      return;
    }

    const intervalId = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % LOADING_MESSAGES.length);
    }, 2400);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [phase]);

  if (phase === 'ready' && initData !== null) {
    return <App preloadedInit={initData} />;
  }

  if (phase === 'error') {
    return <SplashErrorScreen onRetry={handleRetry} />;
  }

  return (
    <SplashLoadingScreen
      message={LOADING_MESSAGES[messageIndex] ?? LOADING_MESSAGES[0]}
      isFading={phase === 'fading'}
    />
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
