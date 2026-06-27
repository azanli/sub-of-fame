import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameplayRound } from './gameplay/GameplayRound';
import type { ReadyPuzzle } from './gameplay/types';

const FIXTURE_PUZZLE: ReadyPuzzle = {
  status: 'ready',
  attemptId: 'fixture-attempt-1',
  rankIndex: 1,
  post: {
    title: 'What is the single best purchase you have made for under $100?',
  },
  comments: [
    {
      id: 't1_aaa',
      body: "A good chef's knife. Changed my whole relationship with cooking.",
    },
    {
      id: 't1_bbb',
      body: 'An ergonomic mouse. My wrist thanked me immediately.',
    },
    {
      id: 't1_ccc',
      body: 'Blackout curtains. Best sleep of my life.',
    },
  ],
};

export const App = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
    <GameplayRound
      puzzle={FIXTURE_PUZZLE}
      onSubmit={(slots) => console.log('submit', slots)}
    />
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
