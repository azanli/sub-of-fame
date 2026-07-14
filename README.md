## Sub of Fame

**Social psychological puzzles for witty Redditors.**

### 📖 App Overview

**Sub of Fame** is a text-based social-psychology puzzle built around linear subreddit campaigns. Instead of testing reflexes or trivia, this game tests a player's ability to "read the room" and predict human behavior by using deduction, linguistic parsing, temporal clues, sarcasm detection, and subreddit lore.

Players are presented with a viral Reddit post and three real, top-level comments pulled from that exact thread. _The challenge?_ **[Casual mode]** Select the comment you believe received the most upvotes among the three. **[Expert mode]** Rank those three comments in order of their actual upvote popularity before the clock runs out.

**Who is this for?** This game is designed for Redditors who want to test their "Hive IQ" and see how well they understand the collective psychology of their favorite communities while enjoying the best posts of all time.

**Critical Operational Notes:**

- **Community Host Locking:** The game features a strict security and gameplay invariant where a puzzle is locked to the subreddit it is posted in. For example, a game post installed in r/funny will only serve players the top posts from r/funny.
- **Live Ladder Content:** The game dynamically caches and pulls from a subreddit's real-time top posts, meaning the campaign is a fluid reflection of the community's history.
- **Platform Stack:** The app is built on the Devvit Web platform, utilizing a React webview client and a Node.js serverless backend.

### 🎮 How to Interact & Play

Sub of Fame uses a highly responsive, space-rescue-themed dark mode interface.

1. **Read the Context:** When the game loads, read the title, body, and any provided media of a viral Reddit post.
2. **Start the Puzzle:** Tap "Start Puzzle" to open the comment gateway and start the client-calculated dynamic timer (which scales between 30 and 120 seconds based on reading length).
3. **Tap-to-Rank:** Read the three unranked comments and tap them in order from most upvoted to least upvoted. Tapping a comment assigns it a rank badge (①, ②, ③).
4. **Earn Rewards:** Once all three are ranked, the game auto-submits your prediction. Correct placements earn you coins and boost your personal Hive IQ metric.
5. **Use Your Tokens:** Earned tokens can be spent to buy hints during tough rounds or skip puzzles entirely.

### 🛠️ Installation & Configuration

**For Subreddit Moderators (The Easy Way):**
To bring Sub of Fame to your community, you do not need to touch any code.

1. **Install the App:** Navigate to the Reddit App Directory and install Sub of Fame directly to your subreddit.
2. **Automatic Configuration:** Zero setup is required. The game features strict "Community Host Locking." The backend automatically recognizes the host subreddit and curates the puzzles exclusively for your community.
3. **Ready to Play:** Once a game post is created in your subreddit, the app dynamically pulls from your real-time top posts to generate the "Live Gauntlet" and historical timeframe campaigns.

**For Developers (Manual Deployment):**
If you are a developer looking to fork the source code or test a custom instance using the Devvit web stack:

1. **Clone the Repository:** Pull the source code from https://github.com/azanli/sub-of-fame.
2. **App Configuration:** Ensure your app's metadata, Node.js server settings, and permissions are properly defined within the devvit.json file in the root directory (this replaces legacy devvit.yaml files).
3. **Deploy via CLI:** Use the Devvit CLI tool to upload and publish your custom build to the Reddit platform.

### Commands

- `npm run dev`: Starts a development server where you can develop your application live on Reddit.
- `npm run build`: Builds your client and server projects
- `npm run deploy`: Uploads a new version of your app
- `npm run launch`: Publishes your app for review
- `npm run login`: Logs your CLI into Reddit
- `npm run type-check`: Type checks, lints, and prettifies your app

### Resources

- [Devvit](https://developers.reddit.com/): A way to build and deploy immersive games on Reddit
- [Vite](https://vite.dev/): For compiling the webView
- [React](https://react.dev/): For UI
- [Hono](https://hono.dev/): For backend logic
- [Tailwind](https://tailwindcss.com/): For styles
- [TypeScript](https://www.typescriptlang.org/): For type safety
