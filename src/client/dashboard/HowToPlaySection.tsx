import type { FaqVariant } from './FaqSection';

type HowToPlayStep = {
  title: string;
  description?: string;
  hub?: string;
  subreddit?: string;
};

const getStepDescription = (
  step: HowToPlayStep,
  variant: FaqVariant
): string => {
  if (step.description !== undefined) {
    return step.description;
  }

  return step[variant] ?? '';
};

const HOW_TO_PLAY_STEPS: HowToPlayStep[] = [
  {
    title: 'Pick a campaign',
    hub: 'Choose a subreddit campaign from the dashboard or enter a custom subreddit to unlock.',
    subreddit:
      "Choose a timeframe in the community's campaign from the dashboard to start.",
  },
  {
    title: 'Read the post',
    description:
      'Review the viral Reddit post before starting. Comments stay hidden until you commit.',
  },
  {
    title: 'Rank the comments',
    description:
      'Tap comments in order from most to least popular before the time runs out. Pick only the top comment in casual mode or rank their order in expert mode.',
  },
  {
    title: 'Climb the ladder',
    description:
      'Reveal your results, earn rewards, and advance to the next post in the campaign.',
  },
];

type HowToPlaySectionProps = {
  variant: FaqVariant;
};

export const HowToPlaySection = ({ variant }: HowToPlaySectionProps) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
      How to Play
    </p>

    <ol className="mt-3 space-y-3">
      {HOW_TO_PLAY_STEPS.map((step, index) => (
        <li key={step.title} className="flex gap-3">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d93900]/10 text-xs font-semibold text-[#d93900] dark:bg-orange-400/10 dark:text-orange-400"
          >
            {index + 1}
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {step.title}
            </p>
            <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              {getStepDescription(step, variant)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  </div>
);
