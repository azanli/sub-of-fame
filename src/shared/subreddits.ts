export type SubredditOption = {
  name: string;
  subreddit: string;
  iconUrl: string;
};

export const normalizeSubredditDisplayName = (value: string): string =>
  value.trim().replace(/^r\//i, '').split(' ')[0] ?? '';

export const formatSubredditLabel = (displayName: string): string => {
  console.log('displayName', displayName);
  if (displayName === 'Global Leaderboard') {
    return 'Global Leaderboard';
  }
  return `r/${normalizeSubredditDisplayName(displayName)}`;
};

export const CURATED_SUBREDDITS: SubredditOption[] = [
  {
    name: 'askreddit',
    subreddit: 'AskReddit',
    iconUrl:
      'https://styles.redditmedia.com/t5_2qh1i/styles/communityIcon_p6kb2m6b185b1.png?width=128&frame=1&auto=webp&s=1124511c3a95cc4ec094a4e8886de1e08a0f1e0a',
  },
  {
    name: 'funny',
    subreddit: 'funny',
    iconUrl:
      'https://a.thumbs.redditmedia.com/kIpBoUR8zJLMQlF8azhN-kSBsjVUidHjvZNLuHDONm8.png',
  },
  {
    name: 'cats',
    subreddit: 'cats',
    iconUrl:
      'https://styles.redditmedia.com/t5_2qhta/styles/communityIcon_2fsd7ji8awg91.png?width=128&frame=1&auto=webp&s=e6227ad9f13cfeed4046201f51686e92bbb37d68',
  },
];
