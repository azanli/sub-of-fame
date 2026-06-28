# Sub of Fame - Puzzle Gameplay & Time Clock

Isolated documentation for Tap-to-Rank interaction, the Start Puzzle gate, client-side timer calculation, and countdown timeout behavior. Product overview lives in `001-overview.md`; API contracts live in `002-api.md`.

---

## 1. Client-Side Dynamic Timer Calculation

**Do not add a time limit to `PuzzleNextResponse`.** The backend puzzle payload is unchanged. When the client receives a `ready` puzzle, it derives the allotted seconds locally from the three comment bodies.

### Inputs

The `comments` array on the `puzzle.next` `ready` response: combine the `body` field of all three entries.

### Calculation

1. Concatenate all three comment bodies into one string.
2. Estimate word count with a 5-characters-per-word heuristic: `Math.ceil(combinedText.length / 5)`.
3. Apply the reading rate plus interface buffer:

```typescript
const calculatedSeconds = Math.ceil(wordCount / 2.5) + 15;
```

4. Clamp the result to a **30-second floor** and **120-second ceiling**:

```typescript
const MIN_TIME = 30;
const MAX_TIME = 120;

return Math.min(MAX_TIME, Math.max(MIN_TIME, calculatedSeconds));
```

### Reference implementation

```typescript
function calculatePuzzleTimer(comments: { body: string }[]): number {
  const combinedText = comments.map((c) => c.body).join(' ');
  const wordCount = Math.ceil(combinedText.length / 5);
  const calculatedSeconds = Math.ceil(wordCount / 2.5) + 15;

  const MIN_TIME = 30;
  const MAX_TIME = 120;

  return Math.min(MAX_TIME, Math.max(MIN_TIME, calculatedSeconds));
}
```

### Rationale

Average adult reading speed is roughly 200–250 WPM. This game asks players to read, compare, and rank—not just skim—so the budget uses a relaxed **2.5 words per second** (~150 WPM). The flat **15-second buffer** covers Tap-to-Rank taps and decision time (replacing the old drag-and-drop overhead).

### UX note

Timer length will vary by puzzle. Before the player commits, do **not** show the numeric countdown; optional copy such as "Short read" vs "Deep read" may appear near **Start Puzzle** if helpful. The numeric clock appears only after the gate opens.

---

## 2. Start Puzzle Commitment Gate

Each new level begins in a **pre-start** state. The player may read the source post without time pressure or comment spoilers.

### Initial render

- Show the source post **title** and **body** (and `imageUrl` when present).
- Keep all three comments **hidden or heavily blurred**. Do not render readable comment text before start.
- Render a prominent primary button labeled **`Start Puzzle`**.

### On click

1. Open a **comments modal** that overlays the post. The post title/body/image stay visible underneath but are not the focus; the post body is **not collapsible**—there is no time budget to re-read it during the timed phase.
2. Render the three comments in a fixed vertical stack inside the modal.
3. Compute `calculatePuzzleTimer(comments)` and start the countdown immediately.
4. Enable Tap-to-Rank interaction (see §3).

The gate resets whenever a new `ready` puzzle is loaded (including after submit reveal → next Puzzle).

---

## 3. Tap-to-Rank Interaction

Replace all drag-and-drop mechanics. Remove DnD context providers, drag handles, drop zones, pointer-capture handlers, and reorder animations tied to dragging.

### Layout

- After **Start Puzzle**, comments live in a **modal overlay** on top of the source post. The post remains in the background; interaction is confined to the modal during the timed phase.
- Three comment cards in a **fixed, structurally stationary vertical stack** inside the modal (presentation order from the API shuffle).
- No separate rank slots column; rank is expressed **on each card** via a prominent badge.

### Selection rules

| Action                          | Result                                                                                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tap an unselected comment       | Assign the next open rank: 1st tap → `①`, 2nd → `②`, 3rd → `③`                                                                                              |
| Tap an already selected comment | **Clear that rank and every rank after it**; lower ranks stay assigned. Example: if `①` and `②` are set, tapping the `②` card clears only `②`; `①` remains. |
| All three ranks assigned        | **Auto-submit** immediately (or enable **Submit Order** if a confirmation beat is kept—auto-submit is preferred)                                            |

### State model (client)

```typescript
type TapRankState = {
  // commentId -> rank 1 | 2 | 3, or absent when unselected
  assignments: Map<string, 1 | 2 | 3>;
  nextRank: 1 | 2 | 3 | null; // null when all three filled; after a partial clear, equals the cleared rank
};
```

On re-tap of rank `N`, remove every assignment where `rank >= N`, then set `nextRank = N`.

Build the `puzzle.submit` `slots` tuple by placing comment IDs into ranks 1–3 from `assignments`. On timeout, use the fill-remaining strategy in §4 before submit—never send partial or empty slot arrays.

### Visual badges

Display circled numerals (`①`, `②`, `③`) or equivalent rank badges prominently on or beside each selected card. Unselected cards show no rank badge.

---

## 4. Countdown Timer Component

Show a clear visual countdown (**`M:SS`**) in the comments modal, visible only **after** **Start Puzzle** is pressed. The timer counts down from the client-calculated limit to `0:00`.

### Timeout handler (fill-remaining)

When the timer reaches zero before a normal submit, the client **always** builds a complete `slots: [string, string, string]` permutation and fires a standard `puzzle.submit`. The backend never accepts partial arrays, empty slots, or a separate timeout payload.

**Fill-remaining algorithm:**

1. Start with three rank slots. Copy any player-assigned comment IDs into their chosen ranks (`①` → index 0, etc.).
2. Collect comment IDs not yet placed, preserving **presentation-array order** (the order of `comments` on the `puzzle.next` `ready` response—the same order as `attempt.commentOrder`).
3. Walk rank slots left to right (`#1`, `#2`, `#3`) and assign the next unplaced ID from that list into each empty slot.
4. Submit the resulting tuple immediately.

| Player state at `0:00` | Resulting payload                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| 0 ranks assigned       | All three slots filled from presentation-array order (ranks 1→3). Likely score `0`; still a valid submit. |
| 1–2 ranks assigned     | Player picks kept; empty slots filled from remaining IDs in presentation-array order.                     |
| 3 ranks assigned       | Submit the player's permutation as-is (same as auto-submit).                                              |

```typescript
function buildTimeoutSlots(
  comments: { id: string }[],
  assignments: Map<string, 1 | 2 | 3>
): [string, string, string] {
  const slots: Array<string | null> = [null, null, null];

  for (const [commentId, rank] of assignments) {
    slots[rank - 1] = commentId;
  }

  const placed = new Set(slots.filter(Boolean));
  const remaining = comments.map((c) => c.id).filter((id) => !placed.has(id));

  let next = 0;
  for (let i = 0; i < 3; i++) {
    if (slots[i] === null) {
      slots[i] = remaining[next++]!;
    }
  }

  return slots as [string, string, string];
}
```

After timeout submit, disable further taps and follow the normal post-submit reveal flow.

### Timer lifecycle

- **Pre-start:** no countdown visible; timer not running.
- **Post-start:** countdown runs until submit success or timeout force-submit.
- **Post-submit / loading next:** stop and hide the timer.

---

## 5. Legacy Clean-Up

Remove all player-facing **Skip Level** affordances. The ladder is strictly progressive; there is no manual skip mutation, route, or tracking state.

**Keep** backend invalid-post skip behavior during `puzzle.next` (content validation advancing `rankIndex`). That is server-side pipeline logic, not a player control.

**Remove** from puzzle UI components:

- Skip Level buttons, menu items, and keyboard shortcuts
- Skip-level client state, analytics events, and tRPC calls (none are defined in the API contract)
- Drag-and-drop libraries, contexts, and slot-drop targets

---

## 6. Reading Difficulty Labels (optional)

If timer variance feels abrupt, optional pre-start labels near **Start Puzzle** can set expectations without revealing the exact second count:

- **Short & Punchy** — clamped time near 30s
- **Standard Depth** — mid-range
- **Deep Read** — clamped time near 120s

These are cosmetic; the authoritative limit is always the calculated clamped value started at gate open.
