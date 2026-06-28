export type SubredditOption = {
  name: string;
  displayName: string;
  iconUrl: string;
};

export const CURATED_SUBREDDITS: SubredditOption[] = [
  {
    name: 'askreddit',
    displayName: 'AskReddit',
    iconUrl:
      'https://styles.redditmedia.com/t5_2qh1i/styles/communityIcon_p6kb2m6b185b1.png?width=128&frame=1&auto=webp&s=1124511c3a95cc4ec094a4e8886de1e08a0f1e0a',
  },
  {
    name: 'cats',
    displayName: 'cats',
    iconUrl:
      'https://styles.redditmedia.com/t5_2qhta/styles/communityIcon_2fsd7ji8awg91.png?width=128&frame=1&auto=webp&s=e6227ad9f13cfeed4046201f51686e92bbb37d68',
  },
  {
    name: 'sports',
    displayName: 'sports',
    iconUrl:
      'https://styles.redditmedia.com/t5_2qgzy/styles/communityIcon_rvt3zjh1fc551.png?width=128&frame=1&auto=webp&s=3947f8eb6f99d7f6869637dc0d8cabc904495259',
  },
];
