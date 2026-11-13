import { useEffect, useState } from 'react';
import { Shield, Cpu, Flame } from 'lucide-react';
import { RequestAuditorView } from './components/audit/RequestAuditorView';
import { DocumentWorkspace } from './components/canvas/DocumentWorkspace';
import { SnippetApprovalList } from './components/approval/SnippetApprovalList';
import { NetworkTapLog } from './components/network/NetworkTapLog';
import { DisclosureReceiptModal } from './components/receipt/DisclosureReceiptModal';
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
  const [deviceCalib, setDeviceCalib] = useState<DeviceCalibrationResult | null>(null);
  const [firebaseStatus, setFirebaseStatus] = useState<FirebaseClientStatus | null>(null);

  const [currentRequest, setCurrentRequest] = useState<VerificationRequest>(SAMPLE_VERIFICATION_REQUESTS[0]);
  const [currentAudit, setCurrentAudit] = useState<AuditReport | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SyntheticDocument>(SYNTHETIC_PAYSLIP_CLEAN);

  const [candidates, setCandidates] = useState<ExtractedCandidate[]>([]);
  const [approvedKeys, setApprovedKeys] = useState<Set<string>>(new Set());

  const [isExtracting, setIsExtracting] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const [activeReceipt, setActiveReceipt] = useState<DisclosureReceipt | null>(null);
  const [finalCoverLetter, setFinalCoverLetter] = useState<string>('');

  useEffect(() => {
    runDeviceCalibration().then(setDeviceCalib);
    setFirebaseStatus(getFirebaseStatus());
  }, []);

  const handleRequestPlanned = (req: VerificationRequest, audit: AuditReport) => {
    setCurrentRequest(req);
    setCurrentAudit(audit);
    setCandidates([]);
    setApprovedKeys(new Set());
  };

  const handleStartExtraction = async () => {
    if (!currentAudit || currentAudit.recommendedMinimalFields.length === 0) return;
    setIsExtracting(true);
    setCandidates([]);
    setApprovedKeys(new Set());

    try {
      const extracted: ExtractedCandidate[] = [];
      const newApproved = new Set<string>();

      for (const job of currentAudit.recommendedMinimalFields) {
        const candidate = await extractFieldOnDevice(job, selectedDoc.rawText, 1);
        extracted.push(candidate);
        if (candidate.found && candidate.isGrounded) {
          newApproved.add(candidate.fieldKey);
        }
      }

      setCandidates(extracted);
      setApprovedKeys(newApproved);
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

      for (const cand of approvedCandidates) {
        const hash = await computeSha256(cand.exactQuote || String(cand.value));
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
    } finally {
      setIsComposing(false);
    }
  };

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
                  ? 'Gemini Nano Active (On-Device)'
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

          <div className="meter-badge">
            <span style={{ color: 'var(--text-dim)' }}>Transmitted:</span>
            <span className="meter-highlight">
              {telemetryStore.getTotalBytesSent() > 0
                ? `${telemetryStore.getTotalBytesSent()} B`
                : '0 Bytes (Private)'}
            </span>
          </div>
        </div>
      </header>

      <main className="dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <RequestAuditorView onRequestPlanned={handleRequestPlanned} isLoading={isExtracting} />
          <DocumentWorkspace
            selectedDocument={selectedDoc}
            onSelectDocument={setSelectedDoc}
            onStartExtraction={handleStartExtraction}
            canExtract={Boolean(currentAudit && currentAudit.recommendedMinimalFields.length > 0)}
            isExtracting={isExtracting}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <SnippetApprovalList
            candidates={candidates}
            approvedKeys={approvedKeys}
            onToggleApproval={handleToggleApproval}
            onComposeVerifiedSheet={handleComposeVerifiedSheet}
            isComposing={isComposing}
            canCompose={approvedKeys.size > 0}
          />
          <NetworkTapLog />
        </div>
      </main>

      {activeReceipt && (
        <DisclosureReceiptModal
          receipt={activeReceipt}
          coverLetter={finalCoverLetter}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </>
  );
}
