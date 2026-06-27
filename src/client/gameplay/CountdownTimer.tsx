import { formatCountdown } from './helpers';

type CountdownTimerProps = {
  secondsRemaining: number;
};

export const CountdownTimer = ({ secondsRemaining }: CountdownTimerProps) => (
  <div className="text-2xl font-mono font-bold tabular-nums text-gray-900 dark:text-white">
    {formatCountdown(secondsRemaining)}
  </div>
);
