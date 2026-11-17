export const AIRLOCK_VERSION = '2.0.0';

export type InferenceSourceType = 'on_device' | 'in_cloud' | 'local_deterministic';

export interface VerificationRequest {
  id: string;
  rawRequestText: string;
  requesterName?: string;
  timestamp: number;
  language?: string;
}

export interface ExtractionJob {
  fieldKey: string;
  fieldLabel: string;
  description: string;
  expectedDataType: 'string' | 'number' | 'date' | 'boolean';
  sensitiveDecoy: boolean;
}

export interface AuditReport {
  isSuspicious: boolean;
  overAskingFlags: string[];
  scamRedFlags: string[];
  recommendedMinimalFields: ExtractionJob[];
  politeCounterProposal: string;
}

export interface ExtractedCandidate {
  fieldKey: string;
  fieldLabel: string;
  found: boolean;
  value?: string | number;
  exactQuote?: string;
  pageNumber?: number;
  sourceType: InferenceSourceType;
  confidenceScore: number;
  isGrounded: boolean;
  isAdversarialAttack?: boolean;
  quarantineReason?: string;
}

export interface ApprovedSnippet {
  fieldKey: string;
  fieldLabel: string;
  value: string | number;
  exactQuote: string;
  pageNumber: number;
  sourceHash: string;
  salt?: string;
  approvedByUser: boolean;
}

export interface NetworkTelemetryEntry {
  id: string;
  timestamp: number;
  url: string;
  method: string;
  requestBytes: number;
  responseBytes: number;
  tier: 'cloud_ai' | 'firestore' | 'app_check' | 'other';
}

export interface DisclosureReceipt {
  receiptId: string;
  timestamp: number;
  totalDocumentBytesHeld: number;
  totalNetworkBytesSent: number;
  bytesPreventedFromLeaving: number;
  disclosureRatioPercent: number;
  approvedSnippetCount: number;
  unrequestedPagesSuppressedCount: number;
  telemetryLogs: NetworkTelemetryEntry[];
  sha256Attestation: string;
  salt?: string;
}

export interface ExecutionTrace {
  id: string;
  timestamp: number;
  stepName: string;
  tier: 'cloud_gemini' | 'on_device_nano' | 'local_deterministic';
  modelIdentifier: string;
  promptSent: string;
  rawResponseText: string;
  latencyMs: number;
  networkBytesTransmitted: number;
}

export interface RevocableDisclosure {
  id: string;
  ownerUid: string;
  requesterName: string;
  requestText: string;
  counterProposal: string;
  coverLetter: string;
  approvedSnippets: ApprovedSnippet[];
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
  revokedAt?: number;
  viewCount: number;
  sha256Receipt: string;
  salt?: string;
}

export interface SyntheticDocument {
  id: string;
  title: string;
  filename: string;
  mimeType: 'text/plain' | 'application/pdf' | 'image/png';
  rawText: string;
  fileSizeBytes: number;
  groundTruth: Record<string, string | number>;
  containsInjection?: boolean;
}

