import type { NetworkTelemetryEntry, DisclosureReceipt, CanaryTestResult } from '../../types';

type Listener = () => void;

class TelemetryStore {
  private entries: NetworkTelemetryEntry[] = [];
  private listeners: Set<Listener> = new Set();
  private totalDocumentBytesHeld = 0;
  private totalDisclosedSnippetBytes = 0;
  private activeCanaries: Set<string> = new Set();
  private leakedCanaries: Map<string, string[]> = new Map(); // canary -> [urls]

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

  public logRequest(
    tier: 'cloud_ai' | 'firestore' | 'app_check' | 'other',
    method: string,
    url: string,
    requestBytes: number,
    responseBytes: number = 0
  ): void {
    this.recordEntry({
      url,
      method,
      requestBytes,
      responseBytes,
      tier,
    });
  }

  public setActiveCanaries(tokens: string[]): void {
    this.activeCanaries = new Set(tokens.filter(Boolean));
    this.leakedCanaries.clear();
    this.notify();
  }

  public getActiveCanaries(): string[] {
    return Array.from(this.activeCanaries);
  }

  public recordCanaryLeak(token: string, url: string): void {
    if (!this.leakedCanaries.has(token)) {
      this.leakedCanaries.set(token, []);
    }
    const list = this.leakedCanaries.get(token)!;
    if (!list.includes(url)) {
      list.push(url);
    }
    this.notify();
  }

  public getCanaryAudit(): CanaryTestResult {
    const totalCanariesSealed = this.activeCanaries.size;
    const canariesDetectedOutbound = this.leakedCanaries.size;
    const leakedCanaryDetails: string[] = [];

    this.leakedCanaries.forEach((urls, token) => {
      leakedCanaryDetails.push(`${token} leaked in payload to ${urls.join(', ')}`);
    });

    return {
      totalCanariesSealed,
      canariesDetectedOutbound,
      leakedCanaryDetails,
      isFullyContained: canariesDetectedOutbound === 0,
    };
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
    this.leakedCanaries.clear();
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
      canaryAudit: this.getCanaryAudit(),
    };
  }
}

export const telemetryStore = new TelemetryStore();
