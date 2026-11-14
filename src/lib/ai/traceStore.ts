import type { ExecutionTrace } from '../../types';

type Listener = () => void;

class TraceStore {
  private traces: ExecutionTrace[] = [];
  private listeners: Set<Listener> = new Set();

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public addTrace(trace: Omit<ExecutionTrace, 'id' | 'timestamp'>): ExecutionTrace {
    const fullTrace: ExecutionTrace = {
      ...trace,
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    };
    this.traces.unshift(fullTrace);
    this.notify();
    return fullTrace;
  }

  public getTraces(): ExecutionTrace[] {
    return [...this.traces];
  }

  public getLatestTrace(): ExecutionTrace | null {
    return this.traces[0] || null;
  }

  public clear(): void {
    this.traces = [];
    this.notify();
  }
}

export const traceStore = new TraceStore();

