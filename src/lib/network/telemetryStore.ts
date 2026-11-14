import type { NetworkTelemetryEntry, DisclosureReceipt } from '../../types';

type Listener = () => void;

class TelemetryStore {
  private entries: NetworkTelemetryEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private totalDocumentBytesHeld = 0;
  private totalDisclosedSnippetBytes = 0;

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public recordEntry(entry: Omit<NetworkTelemetryEntry, 'id' | 'timestamp'>): void {
    const fullEntry: NetworkTelemetryEntry = {
      ...entry,
      id: `tel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    this.entries.push(fullEntry);
    this.notify();
  }

  public setDocumentBytesHeld(bytes: number): void {
    this.totalDocumentBytesHeld = bytes;
    this.notify();
  }

  public getDocumentBytesHeld(): number {
    return this.totalDocumentBytesHeld;
  }

  public setDisclosedSnippetBytes(bytes: number): void {
    this.totalDisclosedSnippetBytes = bytes;
    this.notify();
  }

  public getDisclosedSnippetBytes(): number {
    return this.totalDisclosedSnippetBytes;
  }

  public getEntries(): NetworkTelemetryEntry[] {
    return [...this.entries];
  }

  public getTotalBytesSent(): number {
    return this.entries.reduce((acc, curr) => acc + curr.requestBytes, 0);
  }

  public clear(): void {
    this.entries = [];
    this.totalDocumentBytesHeld = 0;
    this.totalDisclosedSnippetBytes = 0;
    this.notify();
  }

  public generateReceipt(approvedSnippetCount: number, pagesSuppressed: number): DisclosureReceipt {
    const totalSent = this.getTotalBytesSent();
    const held = this.totalDocumentBytesHeld;
    const snippetBytes = this.totalDisclosedSnippetBytes;
    const prevented = Math.max(0, held - snippetBytes);
    const ratio = held > 0 ? (snippetBytes / held) * 100 : 0;

    return {
      receiptId: `rcpt_${Date.now().toString(36)}`,
      timestamp: Date.now(),
      totalDocumentBytesHeld: held,
      totalNetworkBytesSent: totalSent,
      bytesPreventedFromLeaving: prevented,
      disclosureRatioPercent: Number(ratio.toFixed(2)),
      approvedSnippetCount,
      unrequestedPagesSuppressedCount: pagesSuppressed,
      telemetryLogs: [...this.entries],
      sha256Attestation: '',
    };
  }
}

export const telemetryStore = new TelemetryStore();
