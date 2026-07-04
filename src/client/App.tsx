import type {
  InitResponse,
  PuzzleNextRequest,
  PuzzleRevealResult,
} from '../shared/api';
import { SUBREDDIT_UNLOCK_COST } from '../shared/coins';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { TRPCClientError } from '@trpc/client';
import { HubDashboard } from './dashboard/HubDashboard';
import { HubDashboardFromPromise } from './dashboard/HubDashboardFromPromise';
import { HubDashboardSkeleton } from './dashboard/HubDashboardSkeleton';
import { GameplayRound } from './gameplay/GameplayRound';
import { PuzzleGateFromPromise } from './gameplay/PuzzleGateFromPromise';
import { PuzzleLoadTransition } from './gameplay/PuzzleLoadTransition';
import { RevealScreen } from './gameplay/RevealScreen';
import { resolveLoadingCard } from './gameplay/resolveLoadingCard';
import { StartPuzzleGateSkeleton } from './gameplay/StartPuzzleGate';
import type { ReadyPuzzle } from './gameplay/types';
import { trpcClient } from './trpc';

type PuzzleLoadFailure =
  | { type: 'select_failed' }
  | { type: 'insufficient_coins' }
  | { type: 'exhausted'; message: string }
  | { type: 'unplayable'; rankIndex: number; unplayableCount: number }
  | { type: 'problem'; message: string }
  | { type: 'network' };

type AppState =
  | { phase: 'booting' }
  | {
      phase: 'loading_hub';
      initPromise: Promise<InitResponse>;
    }
  | { phase: 'hub_dashboard' }
  | {
      phase: 'loading_next';
      puzzlePromise: Promise<ReadyPuzzle>;
      unplayableCount: number;
      rankIndex?: number;
      subredditDisplayName: string;
      fromHubSelection: boolean;
    }
  | { phase: 'ready'; puzzle: ReadyPuzzle }
  | { phase: 'submitting'; puzzle: ReadyPuzzle }
  | { phase: 'skipping'; puzzle: ReadyPuzzle }
  | { phase: 'revealed'; result: PuzzleRevealResult; puzzle: ReadyPuzzle }
  | { phase: 'exhausted'; message: string }
  | { phase: 'problem'; message: string };

type SessionContext = {
  isHub: boolean;
  isLoggedIn: boolean;
  campaignSubreddit: string | null;
};

type AppProps = {
  preloadedInit?: InitResponse;
};

const buildSessionFromInit = (init: InitResponse): SessionContext => ({
  isHub: init.isHub,
  isLoggedIn: init.userGlobalHiveIQ !== null,
  campaignSubreddit: init.isHub ? null : init.hostSubreddit,
});

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

const pendingInitPromise = new Promise<InitResponse>(() => {});

const initialAppState = (init: InitResponse | undefined): AppState => {
  if (init?.isHub) {
    return { phase: 'hub_dashboard' };
  }
  if (init) {
    return { phase: 'booting' };
  }
  return { phase: 'loading_hub', initPromise: pendingInitPromise };
};

export const App = ({ preloadedInit }: AppProps) => {
  const [state, setState] = useState<AppState>(() =>
    initialAppState(preloadedInit)
  );
  const [session, setSession] = useState<SessionContext | null>(() =>
    preloadedInit ? buildSessionFromInit(preloadedInit) : null
  );
  const [initData, setInitData] = useState<InitResponse | null>(
    preloadedInit ?? null
  );
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const guestRankIndexRef = useRef(1);
  const retryTimeoutRef = useRef<number | undefined>(undefined);
  const activePuzzleRef = useRef<ReadyPuzzle | null>(null);
  const sessionRef = useRef<SessionContext | null>(
    preloadedInit ? buildSessionFromInit(preloadedInit) : null
  );
  const loadingFromHubRef = useRef(false);
  const [lastRedemptionRemarkIndex, setLastRedemptionRemarkIndex] = useState<
    number | null
  >(null);
  const loadNextPuzzleRef = useRef<
    (unplayableCount: number, rankIndex: number | undefined) => void
  >(() => undefined);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const handleUnplayable = useCallback(
    (unplayableCount: number, rankIndex: number) => {
      if (unplayableCount >= 2) {
        setState({
          phase: 'problem',
          message:
            'We encountered a problem finding a playable puzzle. Please try again later.',
        });
        return;
      }

      setState((current) => {
        if (current.phase !== 'loading_next') {
          return current;
        }

        return {
          ...current,
          unplayableCount: unplayableCount + 1,
          rankIndex,
        };
      });

      const delay = 500 + Math.floor(Math.random() * 500);
      retryTimeoutRef.current = window.setTimeout(() => {
        void loadNextPuzzleRef.current(unplayableCount + 1, rankIndex);
      }, delay);
    },
    []
  );

  const fetchNextPuzzle = useCallback(
    async (
      unplayableCount: number,
      rankIndex: number | undefined
    ): Promise<ReadyPuzzle> => {
      const activeSession = sessionRef.current;
      if (activeSession === null) {
        throw { type: 'network' } satisfies PuzzleLoadFailure;
      }

      if (activeSession.isHub && activeSession.campaignSubreddit === null) {
        throw { type: 'problem', message: 'No subreddit selected.' } satisfies PuzzleLoadFailure;
      }

      const effectiveRankIndex = activeSession.isLoggedIn
        ? undefined
        : (rankIndex ?? guestRankIndexRef.current);

      try {
        const response = await trpcClient.puzzle.next.mutate(
          buildNextRequest(activeSession, effectiveRankIndex)
        );

        if (response.status === 'ready') {
          return response;
        }

        if (response.status === 'exhausted') {
          throw {
            type: 'exhausted',
            message: response.message,
          } satisfies PuzzleLoadFailure;
        }

        if (response.status === 'unplayable') {
          if (!activeSession.isLoggedIn) {
            guestRankIndexRef.current = response.rankIndex;
          }
          throw {
            type: 'unplayable',
            rankIndex: response.rankIndex,
            unplayableCount,
          } satisfies PuzzleLoadFailure;
        }

        throw {
          type: 'problem',
          message: response.message,
        } satisfies PuzzleLoadFailure;
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'type' in error &&
          typeof error.type === 'string'
        ) {
          throw error;
        }

        throw { type: 'network' } satisfies PuzzleLoadFailure;
      }
    },
    []
  );

  const handlePuzzleLoadFailure = useCallback(
    (error: unknown) => {
      if (
        typeof error !== 'object' ||
        error === null ||
        !('type' in error) ||
        typeof error.type !== 'string'
      ) {
        setState({
          phase: 'problem',
          message: 'A network error occurred. Please try again.',
        });
        return;
      }

      if (error.type === 'select_failed') {
        setState({ phase: 'hub_dashboard' });
        setSelectionError('Could not load that subreddit. Please try another.');
        return;
      }

      if (error.type === 'insufficient_coins') {
        setState({ phase: 'hub_dashboard' });
        setSelectionError(
          `You need ${SUBREDDIT_UNLOCK_COST} coins to unlock a custom subreddit.`
        );
        return;
      }

      if (error.type === 'exhausted' && 'message' in error) {
        setState({
          phase: 'exhausted',
          message: typeof error.message === 'string' ? error.message : '',
        });
        return;
      }

      if (
        error.type === 'unplayable' &&
        'rankIndex' in error &&
        'unplayableCount' in error &&
        typeof error.rankIndex === 'number' &&
        typeof error.unplayableCount === 'number'
      ) {
        handleUnplayable(error.unplayableCount, error.rankIndex);
        return;
      }

      if (error.type === 'problem' && 'message' in error) {
        setState({
          phase: 'problem',
          message:
            typeof error.message === 'string'
              ? error.message
              : 'We encountered a problem.',
        });
        return;
      }

      setState({
        phase: 'problem',
        message: 'A network error occurred. Please try again.',
      });
    },
    [handleUnplayable]
  );

  const beginPuzzleLoad = useCallback(
    (
      fetchPromise: Promise<ReadyPuzzle>,
      unplayableCount: number,
      rankIndex: number | undefined,
      subredditDisplayName: string,
      fromHubSelection: boolean
    ) => {
      loadingFromHubRef.current = fromHubSelection;

      const puzzlePromise = fetchPromise.then(
        (puzzle) => {
          loadingFromHubRef.current = false;
          setState({ phase: 'ready', puzzle });
          return puzzle;
        },
        (error: unknown) => {
          loadingFromHubRef.current = false;
          handlePuzzleLoadFailure(error);
          return new Promise<ReadyPuzzle>(() => {});
        }
      );

      const loadingState: Extract<AppState, { phase: 'loading_next' }> = {
        phase: 'loading_next',
        puzzlePromise,
        unplayableCount,
        subredditDisplayName,
        fromHubSelection,
      };
      if (rankIndex !== undefined) {
        loadingState.rankIndex = rankIndex;
      }
      setState(loadingState);
    },
    [handlePuzzleLoadFailure]
  );

  const loadNextPuzzle = useCallback(
    (unplayableCount: number, rankIndex: number | undefined) => {
      const activeSession = sessionRef.current;
      if (activeSession === null) {
        return;
      }

      if (activeSession.isHub && activeSession.campaignSubreddit === null) {
        setState({ phase: 'hub_dashboard' });
        return;
      }

      const subredditDisplayName = activeSession.campaignSubreddit ?? '';
      beginPuzzleLoad(
        fetchNextPuzzle(unplayableCount, rankIndex),
        unplayableCount,
        rankIndex,
        subredditDisplayName,
        loadingFromHubRef.current
      );
    },
    [beginPuzzleLoad, fetchNextPuzzle]
  );

  useEffect(() => {
    loadNextPuzzleRef.current = loadNextPuzzle;
  }, [loadNextPuzzle]);

  useEffect(() => {
    if (
      state.phase === 'ready' ||
      state.phase === 'submitting' ||
      state.phase === 'skipping'
    ) {
      activePuzzleRef.current = state.puzzle;
    }
  }, [state]);

  useEffect(() => {
    return () => {
      window.clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  const applyInitData = useCallback((init: InitResponse) => {
    setInitData(init);

    const nextSession = buildSessionFromInit(init);
    sessionRef.current = nextSession;
    setSession(nextSession);
    guestRankIndexRef.current = 1;
  }, []);

  const handleHubLoadFailure = useCallback(() => {
    const activeSession = sessionRef.current;
    if (activeSession?.isHub) {
      const resetSession: SessionContext = {
        ...activeSession,
        campaignSubreddit: null,
      };
      sessionRef.current = resetSession;
      setSession(resetSession);
      setState({ phase: 'hub_dashboard' });
      return;
    }

    setState({
      phase: 'problem',
      message: 'Failed to load game state. Please try again.',
    });
  }, []);

  const beginHubLoad = useCallback(
    (fetchPromise: Promise<InitResponse>) => {
      const initPromise = fetchPromise.then(
        (init) => {
          applyInitData(init);

          if (init.isHub) {
            setState({ phase: 'hub_dashboard' });
          } else {
            loadNextPuzzleRef.current(0, undefined);
          }

          return init;
        },
        () => {
          handleHubLoadFailure();
          return new Promise<InitResponse>(() => {});
        }
      );

      setState({ phase: 'loading_hub', initPromise });
    },
    [applyInitData, handleHubLoadFailure]
  );

  useEffect(() => {
    if (preloadedInit) {
      if (!preloadedInit.isHub) {
        void loadNextPuzzleRef.current(0, undefined);
      }
      return;
    }

    beginHubLoad(trpcClient.init.query());
  }, [beginHubLoad, preloadedInit]);

  const handleSelectSubreddit = useCallback(
    (subreddit: string) => {
      const activeSession = sessionRef.current;
      if (activeSession === null) {
        return;
      }

      setSelectionError(null);

      const puzzlePromise = (async (): Promise<ReadyPuzzle> => {
        try {
          const result = await trpcClient.session.selectSubreddit.mutate({
            subreddit,
          });

          const updatedSession: SessionContext = {
            ...activeSession,
            campaignSubreddit: result.activeSubreddit,
          };
          sessionRef.current = updatedSession;
          setSession(updatedSession);

          if (!activeSession.isLoggedIn) {
            guestRankIndexRef.current = result.currentRankIndex;
          }

          if (result.coins !== null) {
            setInitData((current) =>
              current === null ? current : { ...current, coins: result.coins }
            );
          }

          return fetchNextPuzzle(0, undefined);
        } catch (error) {
          if (
            error instanceof TRPCClientError &&
            error.message === 'INSUFFICIENT_COINS'
          ) {
            throw { type: 'insufficient_coins' } satisfies PuzzleLoadFailure;
          }

          throw { type: 'select_failed' } satisfies PuzzleLoadFailure;
        }
      })();

      beginPuzzleLoad(puzzlePromise, 0, undefined, subreddit, true);
    },
    [beginPuzzleLoad, fetchNextPuzzle]
  );

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
          if (result.coins !== null) {
            setInitData((current) =>
              current === null ? current : { ...current, coins: result.coins }
            );
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
        setState({
          phase: 'problem',
          message: 'Submit failed. Please try again.',
        });
      }
    },
    [session]
  );

  const handleSkip = useCallback(async () => {
    const puzzle = activePuzzleRef.current;
    if (puzzle === null) {
      return;
    }

    setState({ phase: 'skipping', puzzle });

    try {
      const result = await trpcClient.puzzle.skip.mutate({
        attemptId: puzzle.attemptId,
      });

      if (result.status === 'skipped') {
        if (session !== null && !session.isLoggedIn) {
          guestRankIndexRef.current = result.nextRankIndex;
        }
        if (result.coins !== null) {
          setInitData((current) =>
            current === null ? current : { ...current, coins: result.coins }
          );
        }
        setState({ phase: 'revealed', result, puzzle });
        return;
      }

      if (result.code === 'INSUFFICIENT_COINS') {
        setState({ phase: 'ready', puzzle });
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
      setState({ phase: 'problem', message: 'Skip failed. Please try again.' });
    }
  }, [session]);

  const handleNextLevel = () => {
    void loadNextPuzzle(
      0,
      session?.isLoggedIn ? undefined : guestRankIndexRef.current
    );
  };

  const handleDevResetRankIndex = useCallback(() => {
    if (state.phase !== 'revealed') {
      return;
    }

    const { puzzle } = state;
    const rankIndex = puzzle.rankIndex;

    if (session?.isLoggedIn) {
      const subreddit = session.campaignSubreddit;
      if (subreddit === null) {
        return;
      }

      void trpcClient.puzzle.devResetRankIndex.mutate({
        subreddit,
        rankIndex,
      });
      return;
    }

    guestRankIndexRef.current = rankIndex;
  }, [session, state]);

  const refreshHubDashboard = useCallback(() => {
    setSelectionError(null);
    beginHubLoad(trpcClient.init.query());
  }, [beginHubLoad]);

  const handleDashboard = useCallback(() => {
    if (session?.isHub) {
      refreshHubDashboard();
      return;
    }

    void loadNextPuzzle(0, undefined);
  }, [session, refreshHubDashboard, loadNextPuzzle]);

  if (state.phase === 'loading_hub') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Suspense fallback={<HubDashboardSkeleton />}>
          <HubDashboardFromPromise
            initPromise={state.initPromise}
            onSelectSubreddit={handleSelectSubreddit}
            selectionError={selectionError}
          />
        </Suspense>
      </div>
    );
  }

  if (state.phase === 'booting') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (state.phase === 'loading_next') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Suspense
          fallback={
            state.fromHubSelection ? (
              <PuzzleLoadTransition
                fromHubSelection={state.fromHubSelection}
                initData={initData}
                loadingSubreddit={state.subredditDisplayName}
                selectionError={selectionError}
              />
            ) : (
              <StartPuzzleGateSkeleton
                subredditDisplayName={
                  state.subredditDisplayName.length > 0
                    ? resolveLoadingCard(state.subredditDisplayName, initData)
                        .card.displayName
                    : ''
                }
              />
            )
          }
        >
          <PuzzleGateFromPromise
            puzzlePromise={state.puzzlePromise}
            onSubmit={(slots) => {
              void handleSubmit(slots);
            }}
            onSkip={() => {
              void handleSkip();
            }}
            isSubmitting={false}
            isSkipping={false}
            onDashboard={handleDashboard}
            coinBalance={initData?.coins ?? null}
          />
        </Suspense>
        {state.unplayableCount > 0 && (
          <p className="pointer-events-none fixed inset-x-0 bottom-24 z-20 px-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Searching deeper for a worthy puzzle...
          </p>
        )}
      </div>
    );
  }

  if (state.phase === 'hub_dashboard' && initData !== null) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <HubDashboard
          initData={initData}
          onSelectSubreddit={handleSelectSubreddit}
          selectionError={selectionError}
        />
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {state.message}
          </p>
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {state.message}
          </p>
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
          onExit={handleDashboard}
          coinBalance={initData?.coins ?? null}
          lastRedemptionRemarkIndex={lastRedemptionRemarkIndex}
          onRedemptionRemarkUsed={setLastRedemptionRemarkIndex}
          onDevResetRankIndex={handleDevResetRankIndex}
        />
      </div>
    );
  }

  if (
    state.phase === 'ready' ||
    state.phase === 'submitting' ||
    state.phase === 'skipping'
  ) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <GameplayRound
          puzzle={state.puzzle}
          onSubmit={(slots) => {
            void handleSubmit(slots);
          }}
          onSkip={() => {
            void handleSkip();
          }}
          isSubmitting={state.phase === 'submitting'}
          isSkipping={state.phase === 'skipping'}
          onDashboard={handleDashboard}
          coinBalance={initData?.coins ?? null}
        />
      </div>
    );
  }

  return null;
};
