import './index.css';

import type { PuzzleNextRequest, PuzzleSubmitSuccess } from '../shared/api';
import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameplayRound } from './gameplay/GameplayRound';
import { RevealScreen } from './gameplay/RevealScreen';
import type { ReadyPuzzle } from './gameplay/types';
import { trpcClient } from './trpc';

type AppState =
  | { phase: 'booting' }
  | { phase: 'loading_next'; unplayableCount: number; rankIndex?: number }
  | { phase: 'ready'; puzzle: ReadyPuzzle }
  | { phase: 'submitting'; puzzle: ReadyPuzzle }
  | { phase: 'revealed'; result: PuzzleSubmitSuccess; puzzle: ReadyPuzzle }
  | { phase: 'exhausted'; message: string }
  | { phase: 'problem'; message: string };

type SessionContext = {
  isHub: boolean;
  isLoggedIn: boolean;
  campaignSubreddit: string | null;
};

const buildNextRequest = (
  session: SessionContext,
  rankIndex: number | undefined
): PuzzleNextRequest => {
  const input: PuzzleNextRequest = {};

  if (session.isHub) {
    if (session.campaignSubreddit !== null) {
      input.subreddit = session.campaignSubreddit;
    }
  }

  if (!session.isLoggedIn && rankIndex !== undefined) {
    input.rankIndex = rankIndex;
  }

  return input;
};

export const App = () => {
  const [state, setState] = useState<AppState>({ phase: 'booting' });
  const [session, setSession] = useState<SessionContext | null>(null);
  const guestRankIndexRef = useRef(1);
  const retryTimeoutRef = useRef<number | undefined>(undefined);
  const activePuzzleRef = useRef<ReadyPuzzle | null>(null);
  const loadNextPuzzleRef = useRef<
    (unplayableCount: number, rankIndex: number | undefined) => Promise<void>
  >(async () => undefined);

  const handleUnplayable = useCallback((unplayableCount: number, rankIndex: number) => {
    if (unplayableCount >= 2) {
      setState({
        phase: 'problem',
        message:
          'We encountered a problem finding a playable puzzle. Please try again later.',
      });
      return;
    }

    const delay = 500 + Math.floor(Math.random() * 500);
    const nextState: Extract<AppState, { phase: 'loading_next' }> = {
      phase: 'loading_next',
      unplayableCount: unplayableCount + 1,
      rankIndex,
    };
    setState(nextState);

    retryTimeoutRef.current = window.setTimeout(() => {
      void loadNextPuzzleRef.current(unplayableCount + 1, rankIndex);
    }, delay);
  }, []);

  const loadNextPuzzle = useCallback(
    async (unplayableCount: number, rankIndex: number | undefined) => {
      if (session === null) {
        return;
      }

      const loadingState: Extract<AppState, { phase: 'loading_next' }> = {
        phase: 'loading_next',
        unplayableCount,
      };
      if (rankIndex !== undefined) {
        loadingState.rankIndex = rankIndex;
      }
      setState(loadingState);

      if (session.isHub && session.campaignSubreddit === null) {
        setState({
          phase: 'problem',
          message: 'Select a subreddit from the dashboard to start playing.',
        });
        return;
      }

      const effectiveRankIndex = session.isLoggedIn
        ? undefined
        : (rankIndex ?? guestRankIndexRef.current);

      try {
        const response = await trpcClient.puzzle.next.mutate(
          buildNextRequest(session, effectiveRankIndex)
        );

        if (response.status === 'ready') {
          setState({ phase: 'ready', puzzle: response });
          return;
        }

        if (response.status === 'exhausted') {
          setState({ phase: 'exhausted', message: response.message });
          return;
        }

        if (response.status === 'unplayable') {
          if (!session.isLoggedIn) {
            guestRankIndexRef.current = response.rankIndex;
          }
          handleUnplayable(unplayableCount, response.rankIndex);
          return;
        }

        setState({ phase: 'problem', message: response.message });
      } catch {
        setState({
          phase: 'problem',
          message: 'A network error occurred. Please try again.',
        });
      }
    },
    [session, handleUnplayable]
  );

  useEffect(() => {
    loadNextPuzzleRef.current = loadNextPuzzle;
  }, [loadNextPuzzle]);

  useEffect(() => {
    if (state.phase === 'ready' || state.phase === 'submitting') {
      activePuzzleRef.current = state.puzzle;
    }
  }, [state]);

  useEffect(() => {
    return () => {
      window.clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const init = await trpcClient.init.query();
        if (cancelled) {
          return;
        }

        const nextSession: SessionContext = {
          isHub: init.isHub,
          isLoggedIn: init.userGlobalHiveIQ !== null,
          campaignSubreddit: init.isHub ? init.activeSubreddit : init.hostSubreddit,
        };
        setSession(nextSession);
        guestRankIndexRef.current = 1;
        await loadNextPuzzleRef.current(0, undefined);
      } catch {
        if (!cancelled) {
          setState({
            phase: 'problem',
            message: 'Failed to load game state. Please try again.',
          });
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = useCallback(
    async (slots: [string, string, string]) => {
      const puzzle = activePuzzleRef.current;
      if (puzzle === null) {
        return;
      }

      setState({ phase: 'submitting', puzzle });

      try {
        const result = await trpcClient.puzzle.submit.mutate({
          attemptId: puzzle.attemptId,
          slots,
        });

        if (result.status === 'submitted') {
          if (session !== null && !session.isLoggedIn) {
            guestRankIndexRef.current = result.nextRankIndex;
          }
          setState({ phase: 'revealed', result, puzzle });
          return;
        }

        if (result.nextAction === 'request_next_puzzle') {
          void loadNextPuzzleRef.current(0, result.currentRankIndex);
          return;
        }

        if (result.nextAction === 'refresh_game') {
          void loadNextPuzzleRef.current(0, undefined);
          return;
        }

        setState({ phase: 'problem', message: result.message });
      } catch {
        setState({ phase: 'problem', message: 'Submit failed. Please try again.' });
      }
    },
    [session]
  );

  const handleNextLevel = () => {
    void loadNextPuzzle(0, session?.isLoggedIn ? undefined : guestRankIndexRef.current);
  };

  const handleDashboard = () => {
    void loadNextPuzzle(0, undefined);
  };

  if (state.phase === 'booting' || state.phase === 'loading_next') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          {state.phase === 'loading_next' && state.unplayableCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              Searching deeper for a worthy puzzle...
            </p>
          )}
        </div>
      </div>
    );
  }

  if (state.phase === 'exhausted') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            You&apos;ve reached the end of this subreddit&apos;s top posts.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{state.message}</p>
          <button
            type="button"
            onClick={handleDashboard}
            className="bg-[#d93900] hover:bg-[#c23300] text-white font-semibold rounded-full px-8 py-3 transition-colors"
          >
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'problem') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-4 text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            We encountered a problem.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{state.message}</p>
          <button
            type="button"
            onClick={handleDashboard}
            className="bg-[#d93900] hover:bg-[#c23300] text-white font-semibold rounded-full px-8 py-3 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === 'revealed') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <RevealScreen
          result={state.result}
          puzzle={state.puzzle}
          onNextLevel={handleNextLevel}
          onDashboard={handleDashboard}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <GameplayRound
        puzzle={state.puzzle}
        onSubmit={(slots) => {
          void handleSubmit(slots);
        }}
        isSubmitting={state.phase === 'submitting'}
      />
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
