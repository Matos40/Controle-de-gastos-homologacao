export const DEFAULT_LIMITS = Object.freeze({minute: 3, day: 20, month: 100});

export function countsInWindow(previous, now = Date.now()) {
  const current = new Date(now).toISOString();
  const prior = previous ? previous.at.toDate().toISOString() : '';
  return Object.fromEntries([['minute', 16], ['day', 10], ['month', 7]].map(([key, size]) =>
    [key, current.slice(0, size) === prior.slice(0, size) ? previous[key] : 0]));
}

export function nextCounts(previous, limits, now) {
  const counts = countsInWindow(previous, now);
  for (const key of Object.keys(counts)) {
    if (++counts[key] > limits[key]) throw Error('QUOTA_EXCEEDED');
  }
  return counts;
}
