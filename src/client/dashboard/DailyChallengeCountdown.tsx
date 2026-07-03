import { useEffect, useState } from 'react';

const TICK_INTERVAL_MS = 30_000;

const formatCountdown = (msRemaining: number): string => {
  if (msRemaining <= 0) {
    return 'Resetting…';
  }

  const totalMinutes = Math.floor(msRemaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `Resets in ${minutes}m`;
  }

  return `Resets in ${hours}h ${minutes}m`;
};

type DailyChallengeCountdownProps = {
  resetsAt: number;
};

export const DailyChallengeCountdown = ({ resetsAt }: DailyChallengeCountdownProps) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return <>{formatCountdown(resetsAt - now)}</>;
};
