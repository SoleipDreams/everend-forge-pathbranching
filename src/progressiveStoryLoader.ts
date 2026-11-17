import type { UniverseFile } from "./pathBranchingWorkspace.js";

export type StoryEventFileReadError = {
  relativePath: string;
  message: string;
};

export type StoryEventFileBatch = {
  eventIds: string[];
  files: UniverseFile[];
  errors: StoryEventFileReadError[];
};

export type StoryEventFileLoadResult = {
  eventId: string;
  files: UniverseFile[];
  errors: StoryEventFileReadError[];
};

type QueuedEvent = {
  eventId: string;
  relativePaths: string[];
  state: "queued" | "reading" | "done";
  priority: "viewport" | "background";
  promise: Promise<StoryEventFileLoadResult>;
  resolve: (result: StoryEventFileLoadResult) => void;
};

/** Bounded event-file reader that deduplicates in-flight requests and prioritizes viewport reads. */
export class ProgressiveStoryEventLoader {
  private readonly records = new Map<string, QueuedEvent>();
  private readonly viewportQueue: string[] = [];
  private readonly backgroundQueue: string[] = [];
  private readonly handlers = new Set<(batch: StoryEventFileBatch) => void | Promise<void>>();
  private running = false;
  private cancelled = false;
  private backgroundPaused = false;

  constructor(
    private readonly filePathsByEventId: ReadonlyMap<string, readonly string[]>,
    private readonly readFiles: (relativePaths: readonly string[]) => Promise<{ files: UniverseFile[]; errors: StoryEventFileReadError[] }>,
    private readonly batchSize = 32,
    private readonly backgroundBatchSize = batchSize,
  ) {}

  subscribe(handler: (batch: StoryEventFileBatch) => void | Promise<void>): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  request(eventIds: readonly string[], priority: "viewport" | "background" = "viewport"): Promise<StoryEventFileLoadResult[]> {
    if (this.cancelled) return Promise.resolve([]);
    const uniqueIds = [...new Set(eventIds)];
    const results = uniqueIds.map((eventId) => {
      const existing = this.records.get(eventId);
      if (existing) {
        if (priority === "viewport" && existing.state === "queued" && existing.priority !== "viewport") {
          existing.priority = "viewport";
          this.viewportQueue.push(eventId);
        }
        return existing.promise;
      }

      let resolve!: (result: StoryEventFileLoadResult) => void;
      const promise = new Promise<StoryEventFileLoadResult>((complete) => { resolve = complete; });
      const record: QueuedEvent = {
        eventId,
        relativePaths: [...(this.filePathsByEventId.get(eventId) ?? [])],
        state: "queued",
        priority,
        promise,
        resolve,
      };
      this.records.set(eventId, record);
      (priority === "viewport" ? this.viewportQueue : this.backgroundQueue).push(eventId);
      return promise;
    });
    this.pump();
    return Promise.all(results);
  }

  async loadRemaining(eventIds: readonly string[], options: { resumeBackground?: boolean } = {}): Promise<void> {
    if (options.resumeBackground) this.resumeBackground();
    await this.request(eventIds, "background");
  }

  pauseBackground(): void {
    this.backgroundPaused = true;
  }

  resumeBackground(): void {
    if (!this.backgroundPaused) return;
    this.backgroundPaused = false;
    this.pump();
  }

  cancel(): void {
    this.cancelled = true;
    for (const record of this.records.values()) {
      if (record.state !== "queued") continue;
      const result = {
        eventId: record.eventId,
        files: [],
        errors: [{ relativePath: record.relativePaths[0] ?? record.eventId, message: "Event loading was cancelled." }],
      };
      record.state = "done";
      record.resolve(result);
    }
    this.viewportQueue.length = 0;
    this.backgroundQueue.length = 0;
    this.handlers.clear();
  }

  private nextBatch(): QueuedEvent[] {
    if (!this.viewportQueue.length && this.backgroundPaused) return [];
    const next: QueuedEvent[] = [];
    const nextBatchSize = this.viewportQueue.length ? this.batchSize : this.backgroundBatchSize;
    const takeFrom = (queue: string[]) => {
      while (queue.length && next.length < nextBatchSize) {
        const eventId = queue.shift()!;
        const record = this.records.get(eventId);
        if (!record || record.state !== "queued") continue;
        record.state = "reading";
        next.push(record);
      }
    };
    takeFrom(this.viewportQueue);
    if (!this.backgroundPaused && next.length === 0) takeFrom(this.backgroundQueue);
    return next;
  }

  private pump(): void {
    if (this.running || this.cancelled || (!this.viewportQueue.length && (this.backgroundPaused || !this.backgroundQueue.length))) return;
    this.running = true;
    void this.runQueue().finally(() => {
      this.running = false;
      if (!this.cancelled && (this.viewportQueue.length || (!this.backgroundPaused && this.backgroundQueue.length))) this.pump();
    });
  }

  private async runQueue(): Promise<void> {
    while (!this.cancelled) {
      const batch = this.nextBatch();
      if (!batch.length) return;
      const relativePaths = [...new Set(batch.flatMap((record) => record.relativePaths))];
      let readResult: { files: UniverseFile[]; errors: StoryEventFileReadError[] };
      try {
        readResult = await this.readFiles(relativePaths);
      } catch (error) {
        readResult = {
          files: [],
          errors: [{ relativePath: relativePaths[0] ?? ".", message: error instanceof Error ? error.message : String(error) }],
        };
      }
      const fileByPath = new Map(readResult.files.map((file) => [file.relativePath, file]));
      const errorByPath = new Map(readResult.errors.map((error) => [error.relativePath, error]));
      const eventResults = batch.map((record): StoryEventFileLoadResult => {
        const files = record.relativePaths.flatMap((path) => fileByPath.has(path) ? [fileByPath.get(path)!] : []);
        const errors = record.relativePaths.flatMap((path) => {
          const error = errorByPath.get(path);
          return error ? [error] : fileByPath.has(path) ? [] : [{ relativePath: path, message: "Universe file is missing from the selected folder." }];
        });
        const result = { eventId: record.eventId, files, errors };
        record.state = "done";
        record.resolve(result);
        return result;
      });
      if (!this.cancelled) {
        const files = eventResults.flatMap((result) => result.files);
        const errors = eventResults.flatMap((result) => result.errors);
        const notification = { eventIds: batch.map((record) => record.eventId), files, errors };
        for (const handler of this.handlers) await handler(notification);
      }
      // The workspace now owns the resident payload. Drop completed promises so
      // this queue cannot keep evicted event files reachable indefinitely.
      for (const record of batch) {
        if (this.records.get(record.eventId) === record) this.records.delete(record.eventId);
      }
      // Give React and the browser compositor a chance to process the visible batch.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }
}
