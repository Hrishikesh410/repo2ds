/**
 * Runs `mapper` over `items` with at most `limit` operations in flight and
 * returns results in input order. Used for file system calls: unbounded
 * `Promise.all` over thousands of files exhausts the file descriptor limit.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const workerCount = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index] as T, index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
