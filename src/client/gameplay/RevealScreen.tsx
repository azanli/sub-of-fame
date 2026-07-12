import { navigateTo } from '@devvit/web/client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { GameMode, PuzzleRevealResult } from '../../shared/api';
import { formatCompactNumber } from '../../shared/formatNumber';
import { formatSubredditLabel } from '../../shared/subreddits';
import { ForfeitAngelScene } from './ForfeitAngelScene';
import {
  FORFEIT_ANGEL_SCENE,
  createReducedMotionPath,
  generateZigZagPath,
  prefersReducedMotion,
  type ZigZagPathPoint,
} from './forfeitAnimation';
import {
  pickRevealRemark,
  pickSkipRevealRemark,
  resolveCasualSlotHighlight,
} from './helpers';
import {
  getForfeitRevealRemarkKey,
  getRevealRemarkKey,
} from '../../shared/revealRemarks';
import { CoinBalanceBadge } from '../components/CoinBalanceBadge';
import type { ReadyPuzzle } from './types';

type RevealScreenProps = {
  result: PuzzleRevealResult;
  puzzle: ReadyPuzzle;
  gameMode: GameMode;
  onNextLevel: () => void;
  onExit: () => void;
  coinBalance: number | null;
  lastRevealRemarkIndexByKey: Record<string, number | null>;
  onRevealRemarkUsed: (key: string, index: number) => void;
  onDevResetRankIndex?: () => void | Promise<void>;
  resultPending?: boolean;
};

const SLOT_REVEAL_STAGGER_MS = 500;
const VERDICT_DELAY_AFTER_LAST_SLOT_MS = 150;
const REMARK_ENTRANCE_MS = 300;
const COIN_HEADER_PULSE_MS = 200;
const COIN_REVEAL_STAGGER_MS = 300;
const COIN_FLOAT_MS = 800;
const SKIP_SNOO_RISE_MS = 450;
const SNOO_CHEER_ENTRANCE_MS = 500;
const SNOO_CHEER_LEFT_WALL_OFFSET_PX = 5;
const DEV_RESET_DOUBLE_TAP_MS = 400;

const CommentIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CoinIcon = ({
  className,
  alt,
  style,
}: {
  className: string;
  alt?: string;
  style?: CSSProperties;
}) => (
  <img
    src="/coin.svg"
    alt={alt ?? ''}
    aria-hidden={alt === undefined}
    className={className}
    style={style}
  />
);

const RightArrowIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4 shrink-0"
    aria-hidden="true"
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const RevealScreen = ({
  result,
  puzzle,
  gameMode,
  onNextLevel,
  onExit,
  coinBalance,
  lastRevealRemarkIndexByKey,
  onRevealRemarkUsed,
  onDevResetRankIndex,
  resultPending = false,
}: RevealScreenProps) => {
  const isSkipped = result.status === 'skipped';
  const isForfeited = result.status === 'forfeited';
  const coinsEarned = result.status === 'submitted' ? result.coinAward : 0;
  const hintUsed = result.status === 'submitted' ? result.hintUsed : false;
  const isZeroCoinAward = coinsEarned === 0;
  const isCasualMode = gameMode === 'casual';
  const revealRemarkKey = isForfeited
    ? getForfeitRevealRemarkKey()
    : getRevealRemarkKey(gameMode, result.score);
  const lastRevealRemarkIndex =
    lastRevealRemarkIndexByKey[revealRemarkKey] ?? null;
  const [revealedSlotCount, setRevealedSlotCount] = useState(0);
  const [showVerdict, setShowVerdict] = useState(false);
  const [coinHeaderPulse, setCoinHeaderPulse] = useState(false);
  const [revealedCoinCount, setRevealedCoinCount] = useState(0);
  const [activeFloatingCoinIndices, setActiveFloatingCoinIndices] = useState<
    number[]
  >([]);
  const [displayedCoinBalance, setDisplayedCoinBalance] = useState<
    number | null
  >(
    coinBalance !== null && coinsEarned > 0
      ? coinBalance - coinsEarned
      : coinBalance
  );
  const [flashingSlotIndex, setFlashingSlotIndex] = useState<number | null>(
    null
  );
  const [showForfeitAngel, setShowForfeitAngel] = useState(false);
  const [forfeitPath] = useState<ZigZagPathPoint[] | null>(() =>
    isForfeited
      ? prefersReducedMotion()
        ? createReducedMotionPath()
        : generateZigZagPath()
      : null
  );

  const [revealRemark] = useState(() =>
    isSkipped
      ? null
      : pickRevealRemark({
          gameMode,
          score: result.score,
          lastIndex: lastRevealRemarkIndex,
          subredditDisplayName: puzzle.subredditDisplayName,
          forfeited: isForfeited,
        })
  );

  const [skipRemark] = useState(() =>
    isSkipped ? pickSkipRevealRemark() : null
  );

  useEffect(() => {
    if (resultPending || revealRemark === null) {
      return;
    }

    onRevealRemarkUsed(revealRemark.key, revealRemark.index);
  }, [revealRemark, onRevealRemarkUsed, resultPending]);

  const lastDevResetTapRef = useRef<number | null>(null);

  const handleDevResetTap = () => {
    if (onDevResetRankIndex === undefined) {
      return;
    }

    const now = Date.now();
    if (
      lastDevResetTapRef.current !== null &&
      now - lastDevResetTapRef.current <= DEV_RESET_DOUBLE_TAP_MS
    ) {
      lastDevResetTapRef.current = null;
      void onDevResetRankIndex();
      return;
    }

    lastDevResetTapRef.current = now;
  };

  const maxSlotScore = Math.max(...result.slots.map((slot) => slot.score), 0);
  const showMarginalCheerSnoo =
    showVerdict && !isSkipped && !hintUsed && coinsEarned === 1;
  const showPerfectCheerLeftSnoo =
    coinsEarned === 3 && !isSkipped && revealedCoinCount >= 2;
  const showPerfectCheerRightSnoo =
    coinsEarned === 3 && !isSkipped && revealedCoinCount >= 3;

  const triggerZeroScoreCoinHeaderPulse = useCallback(() => {
    if (coinBalance === null) {
      return;
    }

    setCoinHeaderPulse(true);
    window.setTimeout(() => setCoinHeaderPulse(false), COIN_HEADER_PULSE_MS);
  }, [coinBalance]);

  const handleForfeitAngelComplete = () => {
    setShowVerdict(true);

    if (isCasualMode && result.score === 0) {
      triggerZeroScoreCoinHeaderPulse();
      return;
    }

    if (!isCasualMode && isZeroCoinAward && !isSkipped) {
      triggerZeroScoreCoinHeaderPulse();
    }
  };

  useEffect(() => {
    if (resultPending) {
      return;
    }

    const timers: number[] = [];

    for (let slotIndex = 0; slotIndex < result.slots.length; slotIndex += 1) {
      timers.push(
        window.setTimeout(() => {
          setRevealedSlotCount(slotIndex + 1);
          const slot = result.slots[slotIndex];
          const isHintedSlot = hintUsed && slotIndex === 2;
          const shouldFlash = isSkipped
            ? false
            : isHintedSlot
              ? false
              : Boolean(slot?.correct);
          if (shouldFlash) {
            setFlashingSlotIndex(slotIndex);
            timers.push(
              window.setTimeout(() => setFlashingSlotIndex(null), 300)
            );
          }
        }, slotIndex * SLOT_REVEAL_STAGGER_MS)
      );
    }

    const lastSlotRevealMs =
      Math.max(0, result.slots.length - 1) * SLOT_REVEAL_STAGGER_MS;
    const verdictDelayMs = isForfeited
      ? FORFEIT_ANGEL_SCENE.postRevealDelayMs
      : VERDICT_DELAY_AFTER_LAST_SLOT_MS;
    timers.push(
      window.setTimeout(() => {
        if (isForfeited) {
          setShowForfeitAngel(true);
          return;
        }

        setShowVerdict(true);

        if (isCasualMode) {
          if (coinsEarned === 0 && result.score === 0 && coinBalance !== null) {
            triggerZeroScoreCoinHeaderPulse();
            return;
          }

          if (coinsEarned > 0) {
            const startBalance =
              coinBalance !== null ? coinBalance - coinsEarned : null;

            for (let coinIndex = 0; coinIndex < coinsEarned; coinIndex += 1) {
              timers.push(
                window.setTimeout(() => {
                  setRevealedCoinCount(coinIndex + 1);
                  setActiveFloatingCoinIndices((current) => [
                    ...current,
                    coinIndex,
                  ]);
                  if (startBalance !== null) {
                    setDisplayedCoinBalance(startBalance + coinIndex + 1);
                  }
                  timers.push(
                    window.setTimeout(
                      () =>
                        setActiveFloatingCoinIndices((current) =>
                          current.filter((index) => index !== coinIndex)
                        ),
                      COIN_FLOAT_MS
                    )
                  );
                }, coinIndex * COIN_REVEAL_STAGGER_MS)
              );
            }
          }
          return;
        }

        if (isZeroCoinAward && !isSkipped && coinBalance !== null) {
          triggerZeroScoreCoinHeaderPulse();
          return;
        }

        if (coinsEarned > 0 && !isSkipped) {
          const startBalance =
            coinBalance !== null ? coinBalance - coinsEarned : null;

          for (let coinIndex = 0; coinIndex < coinsEarned; coinIndex += 1) {
            timers.push(
              window.setTimeout(() => {
                setRevealedCoinCount(coinIndex + 1);
                setActiveFloatingCoinIndices((current) => [
                  ...current,
                  coinIndex,
                ]);
                if (startBalance !== null) {
                  setDisplayedCoinBalance(startBalance + coinIndex + 1);
                }
                timers.push(
                  window.setTimeout(
                    () =>
                      setActiveFloatingCoinIndices((current) =>
                        current.filter((index) => index !== coinIndex)
                      ),
                    COIN_FLOAT_MS
                  )
                );
              }, coinIndex * COIN_REVEAL_STAGGER_MS)
            );
          }
        }
      }, lastSlotRevealMs + verdictDelayMs)
    );

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [
    result.slots,
    coinsEarned,
    hintUsed,
    isSkipped,
    isForfeited,
    isCasualMode,
    coinBalance,
    result.score,
    resultPending,
    triggerZeroScoreCoinHeaderPulse,
  ]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {isForfeited && showForfeitAngel && forfeitPath !== null ? (
        <ForfeitAngelScene
          path={forfeitPath}
          onComplete={handleForfeitAngelComplete}
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-6 p-4 pb-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 sm:gap-x-3">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={onExit}
                aria-label="Back to dashboard"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 dark:border-gray-600 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 cursor-pointer"
              >
                <span
                  aria-hidden="true"
                  className="text-md text-gray-500 dark:text-gray-400 leading-none"
                >
                  ×
                </span>
              </button>
              <p className="truncate text-sm font-medium text-gray-500 dark:text-gray-400 tracking-widest ml-1">
                {formatSubredditLabel(puzzle.subredditDisplayName)}
              </p>
            </div>
            <CoinBalanceBadge
              coins={displayedCoinBalance ?? coinBalance ?? 0}
              variant="neutral"
              className={`shrink-0 transition-transform duration-200 ease-out ${
                coinHeaderPulse ? 'scale-105' : 'scale-100'
              }`}
            />
            <span
              aria-label="Post comment count"
              className="relative flex shrink-0 items-center justify-self-end gap-1 text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              <CommentIcon />
              {formatCompactNumber(puzzle.numberOfComments)} comments
              {onDevResetRankIndex ? (
                <button
                  type="button"
                  onClick={handleDevResetTap}
                  aria-label="Dev: reset rank index to replay this puzzle"
                  className="absolute inset-0 cursor-default opacity-0"
                />
              ) : null}
            </span>
          </div>

          <div className="relative flex min-h-16 flex-col items-center justify-center py-2">
            {isSkipped ? (
              <div className="flex flex-col items-center gap-2">
                <img
                  src="/snoo-skip.png"
                  alt=""
                  aria-hidden="true"
                  className={`h-24 w-auto max-w-full object-contain ${
                    showVerdict
                      ? 'animate-[skip-snoo-rise_ease-out_forwards]'
                      : 'translate-y-6 opacity-0'
                  }`}
                  style={
                    showVerdict
                      ? { animationDuration: `${SKIP_SNOO_RISE_MS}ms` }
                      : undefined
                  }
                />
                {skipRemark !== null ? (
                  <div
                    className={`transition-all ease-out ${
                      showVerdict
                        ? 'translate-y-0 opacity-100'
                        : 'translate-y-2.5 opacity-0'
                    }`}
                    style={{ transitionDuration: `${REMARK_ENTRANCE_MS}ms` }}
                    aria-live="polite"
                  >
                    <p className="px-2 text-center text-lg font-semibold leading-snug text-[#E28743] dark:text-[#E28743]">
                      {skipRemark}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                {activeFloatingCoinIndices.map((coinIndex) => (
                  <CoinIcon
                    key={`float-${coinIndex}`}
                    className="pointer-events-none absolute top-6 z-10 h-8 w-8 -translate-x-1/2 animate-[float-up_800ms_ease-out_forwards]"
                    style={{
                      left: `calc(50% + ${(coinIndex - (coinsEarned - 1) / 2) * 28}px)`,
                    }}
                  />
                ))}
                <div
                  className={`flex flex-col items-center gap-2 transition-all ease-out ${
                    showVerdict
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-2.5 opacity-0'
                  }`}
                  style={{ transitionDuration: `${REMARK_ENTRANCE_MS}ms` }}
                  aria-live="polite"
                >
                  {revealRemark !== null ? (
                    <p className="px-2 text-center text-lg font-semibold leading-snug text-[#E28743] dark:text-[#E28743]">
                      {revealRemark.text}
                    </p>
                  ) : null}
                  {coinsEarned > 0 ? (
                    <div className="relative px-4 py-3">
                      <div aria-hidden="true" className="coin-reward-glow" />
                      <div className="relative flex min-h-10 items-center justify-center gap-2">
                        {Array.from(
                          { length: revealedCoinCount },
                          (_, coinIndex) => (
                            <CoinIcon
                              key={coinIndex}
                              className="h-10 w-10 animate-[skip-cost-pop_350ms_ease-out_forwards]"
                              {...(coinIndex === 0
                                ? {
                                    alt: `${coinsEarned} Karma Coin${coinsEarned === 1 ? '' : 's'} earned`,
                                  }
                                : {})}
                            />
                          )
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <div className="relative flex flex-col gap-3">
            {coinsEarned >= 1 && !isSkipped ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-4 -right-4 bottom-full z-10 h-24 sm:h-28"
              >
                {coinsEarned === 1 || coinsEarned === 3 ? (
                  <img
                    src="/snoo-cheer-one.png"
                    alt=""
                    className={`absolute bottom-0 h-full w-auto max-w-[45%] object-contain object-left-bottom ${
                      showMarginalCheerSnoo || showPerfectCheerLeftSnoo
                        ? 'animate-[snoo-cheer-slide-left_ease-out_forwards]'
                        : 'opacity-0 -translate-x-full'
                    }`}
                    style={{
                      left: `-${SNOO_CHEER_LEFT_WALL_OFFSET_PX}px`,
                      ...(showMarginalCheerSnoo || showPerfectCheerLeftSnoo
                        ? { animationDuration: `${SNOO_CHEER_ENTRANCE_MS}ms` }
                        : undefined),
                    }}
                  />
                ) : null}
                {coinsEarned === 3 ? (
                  <img
                    src="/snoo-cheer-two.png"
                    alt=""
                    className={`absolute bottom-0 right-4 h-full w-auto max-w-[38%] object-contain object-right-bottom ${
                      showPerfectCheerRightSnoo
                        ? 'animate-[snoo-cheer-slide-right_ease-out_forwards]'
                        : 'opacity-0 translate-x-8 translate-y-4'
                    }`}
                    style={
                      showPerfectCheerRightSnoo
                        ? { animationDuration: `${SNOO_CHEER_ENTRANCE_MS}ms` }
                        : undefined
                    }
                  />
                ) : null}
              </div>
            ) : null}
            {resultPending
              ? Array.from({ length: result.slots.length }, (_, index) => (
                  <div
                    key={`pending-slot-${index}`}
                    aria-hidden="true"
                    className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60"
                  >
                    <div className="pointer-events-none absolute left-0 top-0 size-10">
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 bg-gray-200 dark:bg-gray-700"
                        style={{ clipPath: 'polygon(0 0, 85% 0, 0 85%)' }}
                      />
                      <span className="absolute left-1 top-1 text-sm font-bold leading-none text-gray-500 select-none dark:text-gray-300">
                        {index + 1}
                      </span>
                    </div>
                    <div className="ml-4 flex flex-col gap-2">
                      <div className="h-4 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                      <div className="h-4 w-[80%] animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    </div>
                  </div>
                ))
              : result.slots.map((slot, index) => {
              const isRevealed = index < revealedSlotCount;
              const isFlashing = flashingSlotIndex === index;
              const isHintedSlot = hintUsed && index === 2;

              const upvoteBarWidthPercent =
                maxSlotScore > 0 ? (slot.score / maxSlotScore) * 100 : 0;

              const slotHighlight = isSkipped
                ? 'neutral'
                : isHintedSlot
                  ? 'neutral'
                  : isCasualMode
                    ? resolveCasualSlotHighlight(
                        index,
                        slot,
                        result.score,
                        isForfeited,
                        isSkipped
                      )
                    : slot.correct
                      ? 'correct'
                      : 'incorrect';

              const rankBadgeBgClass = !isRevealed
                ? 'bg-gray-200 dark:bg-gray-700'
                : slotHighlight === 'correct'
                  ? 'bg-green-400'
                  : slotHighlight === 'incorrect'
                    ? 'bg-amber-400'
                    : 'bg-gray-200 dark:bg-gray-700';
              const rankBadgeTextClass =
                isRevealed && slotHighlight !== 'neutral'
                  ? 'text-white'
                  : 'text-gray-500 dark:text-gray-300';

              const revealedCardClass = isSkipped
                ? index === 0
                  ? 'border-gray-400 bg-gray-50 dark:border-gray-500 dark:bg-gray-800/80'
                  : 'border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800/60'
                : slotHighlight === 'correct'
                  ? `border-green-400 bg-green-50 dark:bg-green-950 ${
                      isFlashing ? 'scale-[1.02] ring-2 ring-green-300' : ''
                    }`
                  : slotHighlight === 'incorrect'
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60';

              const upvoteBarClass =
                slotHighlight === 'correct'
                  ? 'bg-green-400 dark:bg-green-400'
                  : slotHighlight === 'incorrect'
                    ? 'bg-amber-400 dark:bg-amber-400'
                    : 'bg-gray-300 dark:bg-gray-600';

              return (
                <div
                  key={slot.commentId}
                  className={`relative overflow-hidden rounded-xl border px-4 py-3 flex items-start gap-3 transition-all duration-300 ease-out ${
                    isRevealed
                      ? revealedCardClass
                      : 'border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800/60'
                  }`}
                >
                  <div className="pointer-events-none absolute left-0 top-0 size-10">
                    <div
                      aria-hidden="true"
                      className={`absolute inset-0 ${rankBadgeBgClass}`}
                      style={{ clipPath: 'polygon(0 0, 85% 0, 0 85%)' }}
                    />
                    <span
                      className={`absolute left-1 top-1 text-sm font-bold leading-none select-none ${rankBadgeTextClass}`}
                    >
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 flex-1 ml-4">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {slot.body}
                    </p>
                    <p
                      className={`text-xs text-gray-400 transition-opacity duration-300 ${
                        isRevealed ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {slot.score.toLocaleString()} upvotes
                    </p>
                  </div>
                  {isRevealed && maxSlotScore > 0 ? (
                    <div
                      aria-hidden="true"
                      className={`absolute bottom-0 left-0 h-1 transition-[width] duration-500 ease-out ${upvoteBarClass}`}
                      style={{ width: `${upvoteBarWidthPercent}%` }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-3 justify-center border-t border-gray-200 bg-gray-50/95 p-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/95">
        {puzzle.postUrl ? (
          <button
            type="button"
            onClick={() => navigateTo(puzzle.postUrl)}
            disabled={resultPending}
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm sm:text-base font-semibold rounded-full px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="flex items-center justify-center gap-2">
              Open Post
              <ExternalLinkIcon />
            </div>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onNextLevel}
          disabled={resultPending}
          aria-busy={resultPending}
          className="bg-[#d93900] hover:bg-[#c23300] text-white text-sm sm:text-base font-semibold rounded-full px-6 py-2 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        >
          <div className="flex items-center justify-center gap-1.5">
            Next Challenge
            <span
              aria-hidden="true"
              className="inline-flex animate-[next-chevron-nudge_2.4s_ease-in-out_infinite]"
            >
              <RightArrowIcon />
            </span>
          </div>
        </button>
      </div>
    </div>
  );
};
