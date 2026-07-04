import { navigateTo } from '@devvit/web/client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PuzzleRevealResult } from '../../shared/api';
import { formatCompactNumber } from '../../shared/formatNumber';
import { formatSubredditLabel } from '../../shared/subreddits';
import type { ReadyPuzzle } from './types';

type RevealScreenProps = {
  result: PuzzleRevealResult;
  puzzle: ReadyPuzzle;
  onNextLevel: () => void;
  onExit: () => void;
  coinBalance: number | null;
  lastRedemptionRemarkIndex: number | null;
  onRedemptionRemarkUsed: (index: number) => void;
  onDevResetRankIndex?: () => void | Promise<void>;
};

const SLOT_REVEAL_STAGGER_MS = 500;
const VERDICT_DELAY_AFTER_LAST_SLOT_MS = 150;
const REMARK_ENTRANCE_MS = 300;
const COIN_HEADER_PULSE_MS = 200;
const COIN_REVEAL_STAGGER_MS = 300;
const COIN_FLOAT_MS = 800;
const SKIP_SNOO_RISE_MS = 450;
const DEV_RESET_DOUBLE_TAP_MS = 400;

const REDEMPTION_REMARKS = [
  'The Hivemind is unpredictable today.',
  'You over-estimated r/{subredditName}.',
  'A beautifully chaotic guess.',
  'You applied logic where there was absolutely none.',
  'You thought like a scholar. They voted like Redditors.',
  'The hivemind works in mysterious (and highly questionable) ways.',
  'An absolute, certified chaos victory for the comment section.',
  'A perfectly inverted masterpiece of a guess. Mathematically impressive!',
  'You read the room beautifully... if the room were completely upside down.',
  'Task failed successfully: maximum unpredictability unlocked.',
  'Statistically speaking, being this wrong is actually harder than being right.',
  'Your faith in the sanity of r/{subredditName} was your downfall.',
  'The psychology of r/{subredditName} remains an unsolved scientific mystery.',
  'In a parallel universe, your prediction was flawlessly correct.',
  'The algorithms are just as confused by these upvote ratios as you are.',
] as const;

const pickRedemptionRemarkIndex = (
  lastIndex: number | null,
  remarkCount: number
): number => {
  if (remarkCount <= 1) {
    return 0;
  }

  let index = Math.floor(Math.random() * remarkCount);
  while (index === lastIndex) {
    index = Math.floor(Math.random() * remarkCount);
  }
  return index;
};

const formatRedemptionRemark = (
  template: string,
  subredditDisplayName: string
): string =>
  template
    .replace(/\{subredditName\}/g, subredditDisplayName)
    .replace(/\$\{subredditName\}/g, subredditDisplayName);

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
  onNextLevel,
  onExit,
  coinBalance,
  lastRedemptionRemarkIndex,
  onRedemptionRemarkUsed,
  onDevResetRankIndex,
}: RevealScreenProps) => {
  const isSkipped = result.status === 'skipped';
  const isZeroScore = result.score === 0;
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
    coinBalance !== null && !isZeroScore
      ? coinBalance - result.score
      : coinBalance
  );
  const [flashingSlotIndex, setFlashingSlotIndex] = useState<number | null>(
    null
  );

  const [redemptionRemark] = useState(() => {
    if (!isZeroScore || isSkipped) {
      return null;
    }
    const index = pickRedemptionRemarkIndex(
      lastRedemptionRemarkIndex,
      REDEMPTION_REMARKS.length
    );
    return {
      index,
      text: formatRedemptionRemark(
        REDEMPTION_REMARKS[index] ?? REDEMPTION_REMARKS[0],
        puzzle.subredditDisplayName
      ),
    };
  });

  useEffect(() => {
    if (redemptionRemark !== null) {
      onRedemptionRemarkUsed(redemptionRemark.index);
    }
  }, [redemptionRemark, onRedemptionRemarkUsed]);

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

  useEffect(() => {
    const timers: number[] = [];

    for (let slotIndex = 0; slotIndex < result.slots.length; slotIndex += 1) {
      timers.push(
        window.setTimeout(() => {
          setRevealedSlotCount(slotIndex + 1);
          const slot = result.slots[slotIndex];
          if (slot?.correct) {
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
    timers.push(
      window.setTimeout(() => {
        setShowVerdict(true);

        if (isZeroScore && !isSkipped && coinBalance !== null) {
          setCoinHeaderPulse(true);
          timers.push(
            window.setTimeout(
              () => setCoinHeaderPulse(false),
              COIN_HEADER_PULSE_MS
            )
          );
          return;
        }

        if (!isZeroScore && !isSkipped) {
          const startBalance =
            coinBalance !== null ? coinBalance - result.score : null;

          for (let coinIndex = 0; coinIndex < result.score; coinIndex += 1) {
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
      }, lastSlotRevealMs + VERDICT_DELAY_AFTER_LAST_SLOT_MS)
    );

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [result.slots, isZeroScore, isSkipped, coinBalance, result.score]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-6 p-4 pb-6">
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
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
              <p className="truncate text-sm font-medium text-gray-500 dark:text-gray-400 tracking-widest ml-2">
                {formatSubredditLabel(puzzle.subredditDisplayName)}
              </p>
            </div>
            {coinBalance !== null ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div
                  className={`pointer-events-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-semibold text-gray-900 transition-transform duration-200 ease-out dark:border-gray-700 dark:bg-gray-800 dark:text-white ${
                    coinHeaderPulse ? 'scale-105' : 'scale-100'
                  }`}
                  aria-label="Karma Coin balance"
                >
                  <CoinIcon className="h-5 w-5" />
                  <span className="tabular-nums">
                    {displayedCoinBalance ?? coinBalance}
                  </span>
                </div>
              </div>
            ) : null}
            <span
              aria-label="Post comment count"
              className="relative flex shrink-0 items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400"
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
            ) : isZeroScore ? (
              <div
                className={`w-full px-2 text-center text-lg font-semibold leading-snug text-[#E28743] transition-all ease-out dark:text-[#E28743] ${
                  showVerdict
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-2.5 opacity-0'
                }`}
                style={{ transitionDuration: `${REMARK_ENTRANCE_MS}ms` }}
                aria-live="polite"
              >
                {redemptionRemark?.text}
              </div>
            ) : (
              <>
                {activeFloatingCoinIndices.map((coinIndex) => (
                  <CoinIcon
                    key={`float-${coinIndex}`}
                    className="pointer-events-none absolute top-6 z-10 h-8 w-8 -translate-x-1/2 animate-[float-up_800ms_ease-out_forwards]"
                    style={{
                      left: `calc(50% + ${(coinIndex - (result.score - 1) / 2) * 28}px)`,
                    }}
                  />
                ))}
                <div
                  className={`flex flex-col items-center transition-all ease-out ${
                    showVerdict
                      ? 'translate-y-0 opacity-100'
                      : 'translate-y-2.5 opacity-0'
                  }`}
                  style={{ transitionDuration: `${REMARK_ENTRANCE_MS}ms` }}
                  aria-live="polite"
                >
                  <div className="flex min-h-10 items-center justify-center gap-2">
                    {Array.from(
                      { length: revealedCoinCount },
                      (_, coinIndex) => (
                        <CoinIcon
                          key={coinIndex}
                          className="h-10 w-10 animate-[skip-cost-pop_350ms_ease-out_forwards]"
                          {...(coinIndex === 0
                            ? {
                                alt: `${result.score} Karma Coin${result.score === 1 ? '' : 's'} earned`,
                              }
                            : {})}
                        />
                      )
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            {result.slots.map((slot, index) => {
              const isRevealed = index < revealedSlotCount;
              const isFlashing = flashingSlotIndex === index;

              const upvoteBarWidthPercent =
                maxSlotScore > 0 ? (slot.score / maxSlotScore) * 100 : 0;

              return (
                <div
                  key={slot.commentId}
                  className={`relative overflow-hidden rounded-xl border px-4 py-3 flex items-start gap-3 transition-all duration-300 ease-out ${
                    isRevealed
                      ? slot.correct
                        ? `border-green-400 bg-green-50 dark:bg-green-950 ${
                            isFlashing
                              ? 'scale-[1.02] ring-2 ring-green-300'
                              : ''
                          }`
                        : 'border-red-400 bg-red-50 dark:bg-red-950'
                      : 'border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-800/60'
                  }`}
                >
                  <span className="shrink-0 text-sm font-bold text-gray-400">
                    #{index + 1}
                  </span>
                  <div className="flex flex-col gap-1 flex-1">
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
                      className={`absolute bottom-0 left-0 h-1 transition-[width] duration-500 ease-out ${
                        slot.correct
                          ? 'bg-green-400 dark:bg-green-400'
                          : 'bg-red-400 dark:bg-red-400'
                      }`}
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
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-full px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
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
          className="bg-[#d93900] hover:bg-[#c23300] text-white font-semibold rounded-full px-6 py-2 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-center gap-1.5">
            Next Challenge
            <RightArrowIcon />
          </div>
        </button>
      </div>
    </div>
  );
};
