import { useId, useState } from 'react';

type FaqEntry = {
  question: string;
  answer: string;
};

const FAQ_ENTRIES: FaqEntry[] = [
  {
    question: 'What is Sub of Fame?',
    answer:
      'Sub of Fame is a social-psychology puzzle game where you rank real Reddit comments by popularity in the best of all-time posts.',
  },
  {
    question: 'What is the difference between Casual and Expert mode?',
    answer:
      'Casual mode gives you more time and lets you return to the post while deciding which is the top comment. Expert mode is strictly timed and locks you in the comments puzzle until you rank the comments from most to least popular.',
  },
  {
    question: 'How do coins work?',
    answer:
      'Coins are earned by playing and can be spent to unlock custom subreddit campaigns or to skip the puzzle.',
  },
];

type FaqItemProps = {
  entry: FaqEntry;
  isOpen: boolean;
  onToggle: () => void;
};

const FaqItem = ({ entry, isOpen, onToggle }: FaqItemProps) => {
  const answerId = useId();

  return (
    <div className="border-b border-gray-200 last:border-b-0 dark:border-gray-700">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={answerId}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-start justify-between gap-3 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {entry.question}
        </span>
        <span
          aria-hidden="true"
          className={`mt-0.5 shrink-0 text-xs text-gray-500 transition-transform duration-200 dark:text-gray-400 ${
            isOpen ? 'rotate-180' : 'rotate-0'
          }`}
        >
          ▼
        </span>
      </button>

      <div
        id={answerId}
        role="region"
        aria-hidden={!isOpen}
        className={`grid transition-all duration-200 ease-out ${
          isOpen
            ? 'grid-rows-[1fr] pb-3 opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {entry.answer}
          </p>
        </div>
      </div>
    </div>
  );
};

export const FaqSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Frequently Asked Questions
      </p>

      <div className="mt-1 divide-y divide-gray-200 dark:divide-gray-700">
        {FAQ_ENTRIES.map((entry, index) => (
          <FaqItem
            key={entry.question}
            entry={entry}
            isOpen={openIndex === index}
            onToggle={() => {
              setOpenIndex((current) => (current === index ? null : index));
            }}
          />
        ))}
      </div>
    </div>
  );
};
