import { useEffect, useState } from 'react';
import {
  Shield,
  Cpu,
  Flame,
  Settings,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Search,
  CheckSquare,
  Award,
  Hash,
} from 'lucide-react';
import { InferenceMode } from 'firebase/ai';
import { RequestAuditorView } from './components/audit/RequestAuditorView';
import { DocumentWorkspace } from './components/canvas/DocumentWorkspace';
import { SnippetApprovalList } from './components/approval/SnippetApprovalList';
import { NetworkTapLog } from './components/network/NetworkTapLog';
import { DisclosureReceiptModal } from './components/receipt/DisclosureReceiptModal';
import { TraceDrawer } from './components/common/TraceDrawer';
import { ConfigModal } from './components/common/ConfigModal';
import { HeroExplainerBanner } from './components/common/HeroExplainerBanner';
import { HashVerificationModal } from './components/common/HashVerificationModal';
import { RevocableShareCard } from './components/sharing/RevocableShareCard';
import { PublicVerificationView } from './components/sharing/PublicVerificationView';
import type {
  VerificationRequest,
  AuditReport,
  SyntheticDocument,
  ExtractedCandidate,
  ApprovedSnippet,
  DisclosureReceipt,
} from './types';
import { SYNTHETIC_PAYSLIP_CLEAN, SAMPLE_VERIFICATION_REQUESTS } from './lib/documents/syntheticData';
import { runDeviceCalibration, type DeviceCalibrationResult } from './lib/ai/calibration';
import { getFirebaseStatus, type FirebaseClientStatus } from './lib/ai/client';
import { extractFieldOnDevice, composeVerifiedAnswerSheet } from './lib/ai/hybridModel';
import { computeSha256, computeSaltedSha256, generateSalt } from './lib/defense/crypto';
import { telemetryStore } from './lib/network/telemetryStore';

export default function App() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Verification Portal Routing (e.g., ?verify=disc_xyz)
  const [activeVerifyId, setActiveVerifyId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('verify');
    }
    return null;
  });

  const [deviceCalib, setDeviceCalib] = useState<DeviceCalibrationResult | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseClientStatus | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const [currentRequest, setCurrentRequest] = useState<VerificationRequest>(SAMPLE_VERIFICATION_REQUESTS[0]);
  const [currentAudit, setCurrentAudit] = useState<AuditReport | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SyntheticDocument>(SYNTHETIC_PAYSLIP_CLEAN);

  const [candidates, setCandidates] = useState<ExtractedCandidate[]>([]);
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set());
  const [approvedSnippets, setApprovedSnippets] = useState<ApprovedSnippet[]>([]);

  const [isExtracting, setIsExtracting] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const [activeReceipt, setActiveReceipt] = useState<DisclosureReceipt | null>(null);
  const [finalCoverLetter, setFinalCoverLetter] = useState<string>('');

  // Interactive Live Cryptographic Proof Modal state
  const [verifyingSnippet, setVerifyingSnippet] = useState<{
    fieldLabel: string;
    value: string | number;
    exactQuote: string;
    fullHash: string;
    salt?: string;
  } | null>(null);

  const refreshStatus = () => {
    runDeviceCalibration().then(setDeviceCalib);
    setFirebaseStatus(getFirebaseStatus());
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleSelectScenario = (req: VerificationRequest, doc: SyntheticDocument) => {
    setCurrentRequest(req);
    setSelectedDoc(doc);
    setCurrentAudit(null);
    setCandidates([]);
    setApprovedKeys(new Set());
    setApprovedSnippets([]);
    setCurrentStep(1);
  };

  const handleRequestPlanned = (req: VerificationRequest, audit: AuditReport) => {
    setCurrentRequest(req);
    setCurrentAudit(audit);
    setCandidates([]);
    setApprovedKeys(new Set());
    setApprovedSnippets([]);
  };

  const handleStartExtraction = async (mode: 'prefer_on_device' | 'only_on_device' = 'prefer_on_device') => {
    if (!currentAudit || currentAudit.recommendedMinimalFields.length === 0) return;
    setIsExtracting(true);
    setCandidates([]);
    setApprovedKeys(new Set());
    setApprovedSnippets([]);

    const inferenceMode =
      mode === 'only_on_device' ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.PREFER_ON_DEVICE;

    try {
      const extracted: ExtractedCandidate[] = [];
      const newApproved = new Set<string>();

      for (const job of currentAudit.recommendedMinimalFields) {
        const candidate = await extractFieldOnDevice(job, selectedDoc.rawText, 1, inferenceMode);
        extracted.push(candidate);
        if (candidate.found && candidate.isGrounded && !candidate.isAdversarialAttack) {
          newApproved.add(candidate.fieldKey);
        }
      }

      setCandidates(extracted);
      setApprovedKeys(newApproved);
      setCurrentStep(3);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleToggleApproval = (fieldKey: string) => {
    setApprovedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      return next;
    });
  };

  const handleComposeVerifiedSheet = async () => {
    if (!currentAudit) return;
    setIsComposing(true);

    try {
      const approvedCandidates = candidates.filter((c) => approvedKeys.has(c.fieldKey));
      const builtSnippets: ApprovedSnippet[] = [];
      let totalSnippetBytes = 0;

      for (const cand of approvedCandidates) {
        const textVal = cand.exactQuote || String(cand.value);
        totalSnippetBytes += new TextEncoder().encode(textVal).length;

        // Compute FULL 64-char SHA-256 hash with 128-bit salt
        const { hash, salt } = await computeSaltedSha256(textVal);

        builtSnippets.push({
          fieldKey: cand.fieldKey,
          fieldLabel: cand.fieldLabel,
          value: cand.value || '',
          exactQuote: cand.exactQuote || '',
          pageNumber: cand.pageNumber || 1,
          sourceHash: hash, // FULL 64-character hash
          salt,             // FULL 32-hex character salt
          approvedByUser: true,
        });
      }

      setApprovedSnippets(builtSnippets);
      telemetryStore.setDisclosedSnippetBytes(totalSnippetBytes);

      const { coverLetter } = await composeVerifiedAnswerSheet(
        currentRequest,
        builtSnippets,
        currentAudit.politeCounterProposal
      );

      const receipt = telemetryStore.generateReceipt(builtSnippets.length, 3);
      const masterSalt = generateSalt(16);
      const receiptHash = await computeSha256(coverLetter, masterSalt);
      receipt.salt = masterSalt;
      receipt.sha256Attestation = receiptHash; // FULL 64-character hash

      setFinalCoverLetter(coverLetter);
      setActiveReceipt(receipt);
      setCurrentStep(4);
    } finally {
      setIsComposing(false);
    }
  };

  const stepsMeta = [
    { num: 1, label: 'Audit Request', icon: Search },
    { num: 2, label: 'Document Vault', icon: FileText },
    { num: 3, label: 'Approval & Defense', icon: CheckSquare },
    { num: 4, label: 'Receipt & Network Tap', icon: Award },
  ];

  // If viewing public verification portal via URL parameter
  if (activeVerifyId) {
    return (
      <div style={{ minHeight: '100vh', padding: '24px 16px', background: 'var(--bg-app)' }}>
        <PublicVerificationView
          disclosureId={activeVerifyId}
          onBackToApp={() => {
            setActiveVerifyId(null);
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', window.location.pathname);
            }
          }}
        />
      </div>
    );
  }

  return (
    <>
      <header className="airlock-header">
        <div className="brand-section">
          <div className="brand-icon">
            <Shield size={24} color="#fff" />
          </div>
          <div>
            <div className="brand-title">
              AIRLOCK <span style={{ color: '#38bdf8', fontSize: '18px' }}>v2</span>
            </div>
            <div className="brand-tagline">Answer only what's asked. Reveal nothing else.</div>
          </div>
        </div>

        <div className="header-status-group">
          {deviceCalib && (
            <div
              className={`status-pill ${deviceCalib.isNanoAvailable ? 'success' : 'warning'}`}
              title={deviceCalib.diagnosticMessage}
            >
              <Cpu size={14} />
              <span>
                {deviceCalib.isNanoAvailable
                  ? 'Gemini Nano Active'
                  : 'Deterministic Local Mode'}
              </span>
            </div>
          )}

          {firebaseStatus && (
            <div
              className={`status-pill ${firebaseStatus.isConfigured ? 'success' : ''}`}
              title={firebaseStatus.projectId ? `Project: ${firebaseStatus.projectId}` : 'Running with local AI fallback'}
            >
              <Flame size={14} />
              <span>
                {firebaseStatus.isConfigured ? `Firebase: ${firebaseStatus.projectId}` : 'Hybrid SDK Ready'}
              </span>
            </div>
          )}

          <button
            type="button"
            className="btn-preset"
            onClick={() => setIsConfigOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Settings size={14} />
            <span>Configure AI</span>
          </button>
        </div>
      </header>

      {/* Guided Step Navigation Bar */}
      <nav
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '12px 20px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {stepsMeta.map((s) => {
            const Icon = s.icon;
            const isActive = currentStep === s.num;
            const isCompleted = currentStep > s.num;

            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setCurrentStep(s.num as 1 | 2 | 3 | 4)}
                style={{
                  background: isActive ? 'var(--color-accent)' : isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--color-accent)' : isCompleted ? 'var(--border-success)' : 'var(--border-subtle)'}`,
                  color: isActive ? '#fff' : isCompleted ? '#6ee7b7' : 'var(--text-muted)',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
              >
                {isCompleted ? <CheckCircle2 size={14} color="#10b981" /> : <Icon size={14} />}
                <span>
                  Step {s.num}: {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentStep > 1 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {currentStep < 4 && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)}
              style={{ padding: '6px 14px', fontSize: '13px' }}
            >
              Next Step <ArrowRight size={14} />
            </button>
          )}
        </div>
      </nav>

      {/* Step Content Container */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Visual Value Proposition & Interactive Demo Selector */}
            <HeroExplainerBanner
              onSelectScenario={handleSelectScenario}
              activeScenarioId={
                selectedDoc.id === 'doc_payslip_clean'
                  ? 'clean_payslip'
                  : selectedDoc.id === 'doc_payslip_hostile'
                  ? 'hostile_payslip'
                  : 'scam_bank'
              }
            />

            <RequestAuditorView onRequestPlanned={handleRequestPlanned} isLoading={isExtracting} />
            {currentAudit && (
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setCurrentStep(2)}
                  style={{ padding: '10px 20px' }}
                >
                  Proceed to Step 2: Ingest Document <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <DocumentWorkspace
              selectedDocument={selectedDoc}
              onSelectDocument={setSelectedDoc}
              onStartExtraction={handleStartExtraction}
              canExtract={Boolean(currentAudit && currentAudit.recommendedMinimalFields.length > 0)}
              isExtracting={isExtracting}
            />
          </div>
        )}

        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SnippetApprovalList
              candidates={candidates}
              approvedKeys={approvedKeys}
              onToggleApproval={handleToggleApproval}
              onComposeVerifiedSheet={handleComposeVerifiedSheet}
              isComposing={isComposing}
              canCompose={approvedKeys.size > 0}
              rawDocumentText={selectedDoc.rawText}
              documentTitle={selectedDoc.title}
              documentSizeBytes={selectedDoc.fileSizeBytes}
              onVerifyProof={async (fieldLabel, value, exactQuote) => {
                const textVal = exactQuote || String(value);
                const { hash, salt } = await computeSaltedSha256(textVal);
                setVerifyingSnippet({
                  fieldLabel,
                  value,
                  exactQuote,
                  fullHash: hash,
                  salt,
                });
              }}
            />
          </div>
        )}

        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {activeReceipt && (
              <>
                <div className="airlock-card">
                  <div className="card-header">
                    <div className="card-title-group">
                      <Award size={20} color="var(--color-success)" />
                      <div>
                        <h3 className="card-title">Disclosure Completed & Attested</h3>
                        <p className="card-subtitle">
                          Certified answer sheet prepared from approved snippets alone.
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setVerifyingSnippet({
                            fieldLabel: 'Master Cover Sheet Attestation',
                            value: 'Synthesized Answer Sheet',
                            exactQuote: finalCoverLetter,
                            fullHash: activeReceipt.sha256Attestation,
                            salt: activeReceipt.salt,
                          })
                        }
                        style={{ fontSize: '12px', padding: '6px 12px' }}
                      >
                        <Hash size={13} /> Test Salted Hash
                      </button>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setActiveReceipt(activeReceipt)}
                      >
                        View Cryptographic Receipt
                      </button>
                    </div>
                  </div>

                  <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', display: 'block', marginBottom: '8px' }}>
                      CERTIFIED ANSWER SHEET PREVIEW
                    </span>
                    <pre
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '12px',
                        whiteSpace: 'pre-wrap',
                        color: '#e2e8f0',
                        lineHeight: '1.6',
                        maxHeight: '220px',
                        overflowY: 'auto',
                      }}
                    >
                      {finalCoverLetter}
                    </pre>
                  </div>
                </div>

                {/* Revocable Share Card */}
                <RevocableShareCard
                  requesterName={currentRequest.requesterName || 'Third-Party Requester'}
                  requestText={currentRequest.rawRequestText}
                  counterProposal={currentAudit?.politeCounterProposal || ''}
                  coverLetter={finalCoverLetter}
                  approvedSnippets={approvedSnippets}
                  sha256Receipt={activeReceipt.sha256Attestation}
                  salt={activeReceipt.salt}
                  onOpenPortal={(id) => {
                    setActiveVerifyId(id);
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', `?verify=${id}`);
                    }
                  }}
                />
              </>
            )}

            <NetworkTapLog />
          </div>
        )}

        {/* Real-time Model Execution Trace & Prompt Inspector */}
        <TraceDrawer />
      </main>

      {/* Cryptographic Receipt Modal */}
      {activeReceipt && (
        <DisclosureReceiptModal
          receipt={activeReceipt}
          coverLetter={finalCoverLetter}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {/* Live Interactive Hash Verification Modal */}
      {verifyingSnippet && (
        <HashVerificationModal
          fieldLabel={verifyingSnippet.fieldLabel}
          value={verifyingSnippet.value}
          exactQuote={verifyingSnippet.exactQuote}
          fullHash={verifyingSnippet.fullHash}
          salt={verifyingSnippet.salt}
          onClose={() => setVerifyingSnippet(null)}
        />
      )}

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfigUpdated={refreshStatus}
      />
    </>
  );
}
