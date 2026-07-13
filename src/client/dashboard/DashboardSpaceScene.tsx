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
      className="relative h-[calc(clamp(2.5rem,8vw,3.25rem)+2rem)] -my-4"
    >
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-screen -translate-x-1/2 overflow-hidden">
        {isSkeleton ? null : (
          <div
            className={`${!isLoadingSelection ? (isVisible ? 'dashboard-spaceship-entrance' : 'dashboard-spaceship-hidden') : ''} mt-3.75 pl-[max(1rem,calc(50vw-15rem))]`}
          >
            <div
              className={
                !isLoadingSelection
                  ? 'dashboard-spaceship-swing'
                  : 'dashboard-spaceship-fly'
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
      </div>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute top-[20%] left-[25%] twinkle-star"
        style={{ animationDelay: '0.8s', animationDuration: '8s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute top-[5%] left-[40%] twinkle-star"
        style={{ animationDelay: '0.4s', animationDuration: '6s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute top-[35%] left-[53%] twinkle-star"
        style={{ animationDelay: '1.2s', animationDuration: '12s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute top-[50%] left-[65%] twinkle-star"
        style={{ animationDelay: '0.4s', animationDuration: '3s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute top-[80%] left-[67%] twinkle-star"
        style={{ animationDelay: '1.2s', animationDuration: '2s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute top-[85%] left-[85%] twinkle-star"
        style={{ animationDelay: '0.6s', animationDuration: '2.5s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="white"
        className="absolute top-[45%] left-[87%] twinkle-star"
        style={{ animationDelay: '2.4s', animationDuration: '3.5s' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 2C12.3 8.3 12.3 8.3 19 12C12.3 15.7 12.3 15.7 12 22C11.7 15.7 11.7 15.7 5 12C11.7 8.3 11.7 8.3 12 2Z" />
      </svg>
    </div>
  );
};
