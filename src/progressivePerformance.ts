export type ProgressivePerformanceDetails = Record<string, number | string | boolean | null>;

export type ProgressivePerformanceSpan = {
  name: string;
  startTimeMs: number;
  durationMs: number;
  details?: ProgressivePerformanceDetails;
};

export type ProgressivePerformanceMetrics = {
  version: 1;
  spans: ProgressivePerformanceSpan[];
};

declare global {
  interface Window {
    /** Opt-in switch used by the Tauri/Playwright performance harness. */
    __PATHBRANCHING_PERF_CAPTURE__?: boolean;
    __PATHBRANCHING_PERF_METRICS__?: ProgressivePerformanceMetrics;
  }
}

const MAX_CAPTURED_SPANS = 2048;

function captureTarget(): ProgressivePerformanceMetrics | undefined {
  try {
    if (typeof window === "undefined" || !window.__PATHBRANCHING_PERF_CAPTURE__) return undefined;
    const existing = window.__PATHBRANCHING_PERF_METRICS__;
    if (existing?.version === 1 && Array.isArray(existing.spans)) return existing;
    return window.__PATHBRANCHING_PERF_METRICS__ = { version: 1, spans: [] };
  } catch {
    return undefined;
  }
}

function appendSpan(
  target: ProgressivePerformanceMetrics,
  name: string,
  startTimeMs: number,
  getDetails?: () => ProgressivePerformanceDetails | undefined,
): void {
  try {
    const durationMs = Math.max(0, performance.now() - startTimeMs);
    const details = getDetails?.();
    if (target.spans.length >= MAX_CAPTURED_SPANS) target.spans.shift();
    target.spans.push({ name, startTimeMs, durationMs, details });
  } catch {
    // Opt-in diagnostics must never interfere with authoring or loading.
  }
}

/** Finish a frame-spanning measurement without taking over application scheduling. */
export function recordProgressivePerformance(
  name: string,
  startTimeMs: number,
  details?: ProgressivePerformanceDetails,
): void {
  const target = captureTarget();
  if (target) appendSpan(target, name, startTimeMs, () => details);
}

/** Record a synchronous stage only when the opt-in capture switch is enabled. */
export function measureProgressivePerformance<T>(
  name: string,
  operation: () => T,
  details?: (result: T) => ProgressivePerformanceDetails | undefined,
): T {
  const target = captureTarget();
  if (!target) return operation();

  const startedAt = performance.now();
  let result: T | undefined;
  try {
    result = operation();
    return result;
  } finally {
    appendSpan(target, name, startedAt, () => result === undefined ? undefined : details?.(result));
  }
}

/** Record an asynchronous stage only when the opt-in capture switch is enabled. */
export async function measureProgressivePerformanceAsync<T>(
  name: string,
  operation: () => Promise<T>,
  details?: (result: T) => ProgressivePerformanceDetails | undefined,
): Promise<T> {
  const target = captureTarget();
  if (!target) return operation();

  const startedAt = performance.now();
  let result: T | undefined;
  try {
    result = await operation();
    return result;
  } finally {
    appendSpan(target, name, startedAt, () => result === undefined ? undefined : details?.(result));
  }
}
