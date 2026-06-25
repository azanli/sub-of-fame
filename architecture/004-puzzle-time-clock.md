# Sub of Fame - Puzzle Time Clock

Isolated documentation for how puzzle times should be calculated

---

## 1. The Dynamic Timer Formula

The average adult reads English text at roughly 200 to 250 words per minute (WPM). Because this is a game where players must not only read but also compare, analyze, and physically drag cards around, you should budget for a relaxed reading speed—around 120 to 150 WPM (or roughly 2 to 2.5 words per second).Step-by-Step Calculation:Count the Words: Combined word count of all 3 comments.Apply the WPM Rate: Divide the total words by the target words-per-second rate.Add UI/Buffer Time: Add a flat overhead for drag-and-drop actions and decision-making.Clamp the Results: Enforce an absolute minimum and maximum time limit so the UI remains predictable.

The Mathematical Formula:

$$\text{Allocated Time (seconds)} = \text{Clamp}\left( \left( \frac{\text{Total Words}}{2.5} \right) + 15, \quad \text{Floor: } 30, \quad \text{Ceiling: } 120 \right)$$

Note on Word Counting: Since splitting strings by spaces in TypeScript can be slightly inconsistent with markdown punctuation, a safe fallback approximation for character-to-word conversion is 5 characters per word.

## 2. Implementation in Your Code Strategy

To keep the game client safe from cheating (preventing a player from seeing the time allocation and trying to guess the lengths programmatically before hitting start), this value should be calculated on the backend and passed down with the puzzle data.

Here is how you would translate this formula into clean TypeScript for your backend service:

```typescript
function calculatePuzzleTimer(comments: { body: string }[]): number {
  // 1. Combine all text to analyze length
  const combinedText = comments.map((c) => c.body).join(' ');

  // 2. Approximate word count (safer and faster than regex splits on messy markdown)
  const wordCount = Math.max(1, Math.ceil(combinedText.length / 5));

  // 3. 2.5 words per second + 15 seconds UI/interactivity buffer
  const calculatedSeconds = Math.ceil(wordCount / 2.5) + 15;

  // 4. Clamp the values between a 30-second floor and a 2-minute ceiling
  const MIN_TIME = 30;
  const MAX_TIME = 120;

  return Math.min(MAX_TIME, Math.max(MIN_TIME, calculatedSeconds));
}
```

## 3. Player Psychology: How to display it?

If a player sees a timer changing drastically from level to level (45s $\rightarrow$ 30s $\rightarrow$ 90s), they might find it jarring if unexplained.

To make this feel deliberate and premium, you can add a small UI indicator next to the clock before they press start, like a reading difficulty label:

- ⏱️ 30s (Short & Punchy) — for short comments
- ⏱️ 60s (Standard Depth) — for typical interactions
- ⏱️ 120s (Deep Read) — for subreddits like ELI5

This gives the user a heads-up on the cognitive load they are about to experience before they open the floodgates.
