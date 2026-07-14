import { useEffect } from 'react';
import { attachFakeRubberBand } from './fakeRubberBand';

/** Enables edge rubber-banding for the expanded-view root while a dashboard is mounted. */
export const useFakeRubberBand = (): void => {
  useEffect(() => {
    const root = document.getElementById('root');
    if (root === null) {
      return;
    }

    return attachFakeRubberBand(root);
  }, []);
};
