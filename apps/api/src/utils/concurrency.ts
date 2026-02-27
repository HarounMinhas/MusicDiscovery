export async function mapWithConcurrency<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item === undefined) continue;

    const promise = (async () => {
      const result = await mapper(item, i);
      results[i] = result;
    })();

    const wrapped = promise.then(() => {
      executing.splice(executing.indexOf(wrapped), 1);
    });

    executing.push(wrapped);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results.filter((r): r is R => r !== undefined);
}
