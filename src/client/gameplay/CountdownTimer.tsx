type CountdownTimerProps = {
  secondsRemaining: number;
  totalSeconds: number;
};

export const CountdownTimer = ({
  secondsRemaining,
  totalSeconds,
}: CountdownTimerProps) => {
  const progressPercent =
    totalSeconds > 0 ? (secondsRemaining / totalSeconds) * 100 : 0;
  const isUrgent = secondsRemaining <= 10;

  return (
    <div
      className="shrink-0 bg-gray-200 dark:bg-gray-700"
      role="progressbar"
      aria-valuenow={secondsRemaining}
      aria-valuemin={0}
      aria-valuemax={totalSeconds}
      aria-label="Time remaining"
    >
      <div
        className="h-1.5 transition-[width] duration-1000 ease-linear"
        style={{ width: `${progressPercent}%` }}
      >
        <div
          className={`h-full ${isUrgent ? 'countdown-blink-urgent' : 'bg-[#d93900]'}`}
        />
      </div>
    </div>
  );
};
