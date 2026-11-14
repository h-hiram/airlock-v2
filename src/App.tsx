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
} from 'lucide-react';
import { InferenceMode } from 'firebase/ai';
import { RequestAuditorView } from './components/audit/RequestAuditorView';
import { DocumentWorkspace } from './components/canvas/DocumentWorkspace';
import { SnippetApprovalList } from './components/approval/SnippetApprovalList';
import { NetworkTapLog } from './components/network/NetworkTapLog';
import { DisclosureReceiptModal } from './components/receipt/DisclosureReceiptModal';
import { TraceDrawer } from './components/common/TraceDrawer';
import { ConfigModal } from './components/common/ConfigModal';
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
import { computeSha256 } from './lib/defense/crypto';
import { telemetryStore } from './lib/network/telemetryStore';

export default function App() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  const [deviceCalib, setDeviceCalib] = useState<DeviceCalibrationResult | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseClientStatus | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  const [currentRequest, setCurrentRequest] = useState<VerificationRequest>(SAMPLE_VERIFICATION_REQUESTS[0]);
  const [currentAudit, setCurrentAudit] = useState<AuditReport | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SyntheticDocument>(SYNTHETIC_PAYSLIP_CLEAN);

  const [candidates, setCandidates] = useState<ExtractedCandidate[]>([]);
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set());

  const [isExtracting, setIsExtracting] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const [activeReceipt, setActiveReceipt] = useState<DisclosureReceipt | null>(null);
  const [finalCoverLetter, setFinalCoverLetter] = useState<string>('');

  const refreshStatus = () => {
    runDeviceCalibration().then(setDeviceCalib);
    setFirebaseStatus(getFirebaseStatus());
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleRequestPlanned = (req: VerificationRequest, audit: AuditReport) => {
    setCurrentRequest(req);
    setCurrentAudit(audit);
    setCandidates([]);
    setApprovedKeys(new Set());
  };

  const handleStartExtraction = async (mode: 'prefer_on_device' | 'only_on_device' = 'prefer_on_device') => {
    if (!currentAudit || currentAudit.recommendedMinimalFields.length === 0) return;
    setIsExtracting(true);
    setCandidates([]);
    setApprovedKeys(new Set());

    const inferenceMode =
      mode === 'only_on_device' ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.PREFER_ON_DEVICE;

    try {
      const extracted: ExtractedCandidate[] = [];
      const newApproved = new Set<string>();

      for (const job of currentAudit.recommendedMinimalFields) {
        const candidate = await extractFieldOnDevice(job, selectedDoc.rawText, 1, inferenceMode);
        extracted.push(candidate);
        if (candidate.found && candidate.isGrounded) {
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
      const approvedSnippets: ApprovedSnippet[] = [];
      let totalSnippetBytes = 0;

      for (const cand of approvedCandidates) {
        const textVal = cand.exactQuote || String(cand.value);
        totalSnippetBytes += new TextEncoder().encode(textVal).length;
        const hash = await computeSha256(textVal);
        approvedSnippets.push({
          fieldKey: cand.fieldKey,
          fieldLabel: cand.fieldLabel,
          value: cand.value || '',
          exactQuote: cand.exactQuote || '',
          pageNumber: cand.pageNumber || 1,
          sourceHash: hash.slice(0, 16),
          approvedByUser: true,
        });
      }

      telemetryStore.setDisclosedSnippetBytes(totalSnippetBytes);

      const { coverLetter } = await composeVerifiedAnswerSheet(
        currentRequest,
        approvedSnippets,
        currentAudit.politeCounterProposal
      );

      const receipt = telemetryStore.generateReceipt(approvedSnippets.length, 3);
      const receiptHash = await computeSha256(coverLetter);
      receipt.sha256Attestation = receiptHash.slice(0, 24);

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
            />
          </div>
        )}

        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {activeReceipt && (
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
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setActiveReceipt(activeReceipt)}
                  >
                    View Cryptographic Receipt
                  </button>
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
            )}

            <NetworkTapLog />
          </div>
        )}

        {/* Real-time Model Execution Trace & Prompt Inspector */}
        <TraceDrawer />
      </main>

      {activeReceipt && (
        <DisclosureReceiptModal
          receipt={activeReceipt}
          coverLetter={finalCoverLetter}
          onClose={() => setActiveReceipt(null)}
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
