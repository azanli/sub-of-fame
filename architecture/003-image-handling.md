# Sub of Fame - Post Image Handling

Isolated documentation for how images should be rendered

---

## 1. How to parse images during the fetch pipeline:

When the server fetches the top posts to populate the linear cache, use a simple normalization check:

```typescript
let imageUrl: string | undefined = undefined;

// Check if it's a standard image link
if (
  !post.isSelf &&
  post.url &&
  (post.url.endsWith('.jpg') ||
    post.url.endsWith('.png') ||
    post.url.endsWith('.gif'))
) {
  imageUrl = post.url;
} else if (
  !post.isSelf &&
  post.thumbnail &&
  post.thumbnail !== 'default' &&
  post.thumbnail !== 'self'
) {
  // Fall back to a thumbnail link if it's a link-type post or video cover
  imageUrl = post.thumbnail;
}
```

## 2. Storing it in your Redis Schema (002-api.md)

You do not want to store massive media blobs in Redis. Storing just the URL string keeps your cache fast.

Modify the PuzzleSnapshot type in your API contract to include an optional field:

```typescript
export type PuzzleSnapshot = {
  ...
  imageUrl?: string;
};
```

When turning this snapshot into a PuzzleNextResponse (which strips the scores before sending it to the client), include imageUrl.

## 3. Client rendering in the React webview (001-overview.md)

In your React client frontend, check if imageUrl is present:

```typescript
<div>
  <h2>{puzzle.title}</h2>
  {puzzle.body && <p>{puzzle.body}</p>}
  {puzzle.imageUrl && (
    <img
      src={puzzle.imageUrl}
      alt="Context"
      style={{ maxWidth: '100%', borderRadius: '8px', marginBottom: '12px' }}
    />
  )}
</div>
```
