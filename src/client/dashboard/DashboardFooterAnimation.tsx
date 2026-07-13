const RISE_MS = 700;
const RISE_DELAY_MS = 150;
const BOB_START_MS = RISE_DELAY_MS + RISE_MS;

const QUESTION_MARKS = [
  {
    // 10 o'clock — tipped left toward the coin
    className: 'absolute left-[-6%] -top-3 w-[30%]',
    rotate: '38deg',
    bounceDelayMs: BOB_START_MS,
    bounceDurationMs: 2200,
  },
  {
    // 7 o'clock — smaller, closer to upright
    className: 'absolute left-0 top-[52%] w-[18%]',
    rotate: '-14deg',
    bounceDelayMs: BOB_START_MS + 180,
    bounceDurationMs: 2500,
  },
  {
    // 4 o'clock — tipped further right, slightly larger
    className: 'absolute left-[71%] top-[40%] w-[24%]',
    rotate: '39deg',
    bounceDelayMs: BOB_START_MS + 320,
    bounceDurationMs: 2350,
  },
] as const;

export const DashboardFooterAnimation = () => {
  return (
    <div
      className="relative mx-auto w-1/2 max-w-[220px] h-[190px] animate-[skip-snoo-rise_ease-out_both] mt-6"
      style={{
        animationDuration: `${RISE_MS}ms`,
        animationDelay: `${RISE_DELAY_MS}ms`,
      }}
      role="img"
      aria-label="Snoo thinking about the hivemind"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[44%] top-[0.5%] z-10 aspect-square w-[44%]"
      >
        <img
          src="/gold.png"
          alt=""
          className="absolute left-[18%] top-[14%] w-[58%] object-contain footer-gold-bob"
          style={{
            animationDelay: `${BOB_START_MS}ms`,
          }}
        />

        {QUESTION_MARKS.map((mark) => (
          <div
            key={mark.className}
            className={mark.className}
            style={{ transform: `rotate(${mark.rotate})` }}
          >
            <img
              src="/question-mark.png"
              alt=""
              className="w-full object-contain footer-qm-bounce"
              style={{
                animationDelay: `${mark.bounceDelayMs}ms`,
                animationDuration: `${mark.bounceDurationMs}ms`,
              }}
            />
          </div>
        ))}
      </div>

      <img
        src="/snoo.png"
        alt=""
        className="relative z-0 w-28 object-contain mt-16"
      />
    </div>
  );
};
