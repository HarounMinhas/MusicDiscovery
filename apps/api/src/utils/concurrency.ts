export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  if (concurrency <= 0) throw new Error('Concurrency must be positive');
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let active = 0;

  return new Promise((resolve, reject) => {
    const maybeStart = () => {
      if (nextIndex >= items.length && active === 0) {
        resolve(results);
        return;
      }
      while (active < concurrency && nextIndex < items.length) {
        const current = nextIndex++;
        active++;
        Promise.resolve(worker(items[current], current))
          .then((value) => {
            results[current] = value;
            active--;
            maybeStart();
          })
          .catch((error) => {
            reject(error);
          });
      }
    };

    maybeStart();
  });
}
