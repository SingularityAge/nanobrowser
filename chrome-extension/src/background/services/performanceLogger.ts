import type { AgentEvent } from '../agent/event/types';

export interface PerfEvent {
  timestamp: number;
  taskId: string;
  step: number;
  actor: AgentEvent['actor'];
  modality?: 'vision' | 'dom';
  action?: string;
  outcome?: 'success' | 'fail' | 'stuck' | 'skipped';
  origin: string;
  sessionId: string;
  note?: string;
}

const LOG_STORAGE_KEY = 'performance_logger_events';
const MAX_EVENTS = 100;

export class PerformanceLogger {
  private events: PerfEvent[] = [];
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    if (this.loadingPromise) {
      await this.loadingPromise;
      return;
    }

    this.loadingPromise = (async () => {
      try {
        const stored = await chrome.storage.local.get(LOG_STORAGE_KEY);
        const rawEvents = stored[LOG_STORAGE_KEY];
        if (Array.isArray(rawEvents)) {
          this.events = rawEvents.slice(-MAX_EVENTS);
        }
        this.loaded = true;
      } finally {
        this.loadingPromise = null;
      }
    })();

    await this.loadingPromise;
  }

  async addEvent(event: PerfEvent): Promise<void> {
    await this.ensureLoaded();
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: this.events });
  }

  async getEvents(): Promise<PerfEvent[]> {
    await this.ensureLoaded();
    return [...this.events];
  }

  async clear(): Promise<void> {
    this.events = [];
    this.loaded = true;
    await chrome.storage.local.set({ [LOG_STORAGE_KEY]: this.events });
  }
}
