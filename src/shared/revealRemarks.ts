import type { CasualRevealScore } from './api.js';

export type ExpertRevealScore = 0 | 1 | 2 | 3;

export const SCORE_ZERO_REVEAL_REMARKS = [
  'The Hivemind is unpredictable!',
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

export const SCORE_ONE_REVEAL_REMARKS = [
  'So Close! Consolation Prize.',
  'You found a silver-tier masterpiece. The hivemind demands gold.',
  'A highly respectable take. You almost spoke fluent r/{subredditName}.',
  'You predicted a runner-up. In any other room, you’d be a genius.',
  'Right neighborhood, wrong house. Still worth a coin!',
  "The hivemind nodded in approval, but it didn't completely lose its mind.",
  'You captured a massive chunk of the room, just not the absolute spotlight.',
  'A solid fallback option. r/{subredditName} has a slightly weirder favorite.',
  'You matched the vibe perfectly, but someone else bought more upvote real estate.',
];

export const SCORE_THREE_REVEAL_REMARKS = [
  'Perfect Prediction!',
  'You have officially achieved complete Reddit enlightenment.',
  'An elite reading of the room. You speak fluent Hivemind.',
  'Are you a psychologist or just chronically online? Incredible pick!',
  'Absolute bullseye. You calculated r/{subredditName} down to the exact digit.',
  'Flawless calibration. The comment section bows to your intuition.',
  'You didn’t just read the room—you practically authored the thread.',
  'A perfect match. Your brainwaves are perfectly synchronized with the hivemind.',
  'Unmatched accuracy. You navigated the battlefield of wits and claimed top prize.',
];

export const CASUAL_REVEAL_REMARKS: Record<
  CasualRevealScore,
  readonly string[]
> = {
  0: SCORE_ZERO_REVEAL_REMARKS,
  1: SCORE_ONE_REVEAL_REMARKS,
  3: SCORE_THREE_REVEAL_REMARKS,
};

export const EXPERT_REVEAL_REMARKS: Record<
  ExpertRevealScore,
  readonly string[]
> = {
  0: SCORE_ZERO_REVEAL_REMARKS,
  1: ['One slot nailed — the hivemind almost made sense.'],
  2: ['Two out of three. Agonizingly close to full Reddit enlightenment.'],
  3: ['Perfect Prediction!'],
};

export const FORFEIT_REVEAL_REMARKS = [
  'You let Snoo down this time, but you can try again.',
  'Snoo needs your help! Try again.',
  "You can't blame the spaceship for this one.",
  'Was Snoo too heavy for you to lift?',
  'Wake up captain!',
  'You snooze, you lose.',
  'Maybe Snoo needs to go on a diet...',
  'Ask not what Snoo can do for you, ask what you can do for Snoo.',
] as const;

export const getRevealRemarkKey = (
  gameMode: 'casual' | 'expert',
  score: number
): string => `${gameMode}-${score}`;

export const getForfeitRevealRemarkKey = (): string => 'casual-forfeit';
