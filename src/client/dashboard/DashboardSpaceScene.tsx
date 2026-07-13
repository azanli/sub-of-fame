import { useEffect, useState } from 'react';

export const DashboardSpaceScene = ({
  isLoadingSelection,
  isSkeleton = false,
}: {
  isLoadingSelection: boolean;
  isSkeleton?: boolean;
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="relative w-full h-16 overflow-hidden -mt-6"
    >
      {isSkeleton ? null : (
        <div
          className={`${!isLoadingSelection ? (isVisible ? 'rescue-spaceship-entrance' : 'rescue-spaceship-hidden') : ''} mt-3.75`}
        >
          <div
            className={
              !isLoadingSelection
                ? 'rescue-spaceship-swing'
                : 'rescue-spaceship-fly'
            }
          >
            <img
              src="/spaceship-happy.png"
              alt=""
              aria-hidden="true"
              className="h-[clamp(2.5rem,8vw,3.25rem)] w-auto object-contain"
            />
          </div>
        </div>
      )}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute top-10 left-1/4 twinkle-star"
        style={{ animationDelay: '0.8s', animationDuration: '4s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute bottom-12 left-1/3 twinkle-star"
        style={{ animationDelay: '1.2s', animationDuration: '2s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute top-1/2 right-28 twinkle-star"
        style={{ animationDelay: '0.6s', animationDuration: '2.5s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute top-4 right-6 twinkle-star"
        style={{ animationDelay: '2.4s', animationDuration: '3.5s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
    </div>
  );
};
