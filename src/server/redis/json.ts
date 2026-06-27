// JSON parse/stringify helpers for Redis string values. All Redis-stored JSON
// passes through these helpers so callers never manually try/catch JSON errors
// or handle null raw values.

export type RedisStorageError = {
  kind: 'redis_storage_error';
  message: string;
  cause?: unknown;
};

/**
 * Parse a raw Redis string value into the expected shape.
 * Returns `null` when the raw value is `null` or `undefined` (key missing).
 * Returns `null` and logs a console.error when the value is malformed JSON —
 * callers treat malformed cached data the same as a cache miss.
 * Accepts `string | null | undefined` to match the Devvit Redis client's
 * `get()` return type (`string | undefined`).
 */
export const parseJson = <T>(raw: string | null | undefined): T | null => {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error('[redis/json] Failed to parse stored value:', err, 'raw:', raw.slice(0, 200));
    return null;
  }
};

/**
 * Serialize a value to a JSON string for storage in Redis.
 * Throws a `RedisStorageError` on circular references or other serialization
 * failures so callers receive a typed error rather than a raw TypeError.
 */
export const stringifyJson = <T>(value: T): string => {
  try {
    return JSON.stringify(value);
  } catch (err) {
    const storageError: RedisStorageError = {
      kind: 'redis_storage_error',
      message: 'Failed to serialize value for Redis storage',
      cause: err,
    };
    throw storageError;
  }
};
