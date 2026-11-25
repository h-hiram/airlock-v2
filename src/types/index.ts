export const AIRLOCK_VERSION = '2.1.0';

export type InferenceSourceType = 'on_device' | 'in_cloud' | 'local_deterministic';

export interface VerificationRequest {
  id: string;
  rawRequestText: string;
  requesterName?: string;
  timestamp: number;
  language?: string;
}

export type PredicateKind =
  | 'amount_at_least'
  | 'amount_between'
  | 'tenure_at_least_months'
  | 'text_matches';

export interface PredicateSpec {
  kind: PredicateKind;
  fieldKey: string;
  fieldLabel: string;
  threshold?: number;
  min?: number;
  max?: number;
  currency?: string;
  months?: number;
  expectedText?: string;
  humanRequirement: string;
}

export interface DerivedClaim {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  predicateKind: PredicateKind;
  statement: string;
  result: boolean;
  commitmentHash: string;
  salt?: string;
  revealsSummary: string;
  approvedByUser: boolean;
}

export interface ExtractionJob {
  fieldKey: string;
  fieldLabel: string;
  description: string;
  expectedDataType: 'string' | 'number' | 'date' | 'boolean';
  sensitiveDecoy: boolean;
  predicate?: PredicateSpec;
}

export interface AuditReport {
  isSuspicious: boolean;
  overAskingFlags: string[];
  scamRedFlags: string[];
  recommendedMinimalFields: ExtractionJob[];
  politeCounterProposal: string;
  kdpaViolationNote?: string;
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
  derivedClaim?: DerivedClaim;
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
  derivedClaim?: DerivedClaim;
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

export interface CanaryTestResult {
  totalCanariesSealed: number;
  canariesDetectedOutbound: number;
  leakedCanaryDetails: string[];
  isFullyContained: boolean;
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
  canaryAudit?: CanaryTestResult;
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
  derivedClaims?: DerivedClaim[];
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
  revokedAt?: number;
  tombstone?: boolean;
  viewCount: number;
  sha256Receipt: string;
  salt?: string;
}

export interface SyntheticDocument {
  id: string;
  title: string;
  filename: string;
  mimeType: 'text/plain' | 'application/pdf' | 'image/png' | 'image/jpeg';
  rawText: string;
  fileSizeBytes: number;
  groundTruth: Record<string, string | number>;
  containsInjection?: boolean;
  canaryTokens?: string[];
  imageUrl?: string;
  totalPages?: number;
}
