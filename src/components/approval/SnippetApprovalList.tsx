import React, { useState } from 'react';
import {
  Check,
  ShieldAlert,
  CheckCircle2,
  Cpu,
  FileCheck,
  AlertTriangle,
  Eye,
  Lock,
  Layers,
} from 'lucide-react';
import type { ExtractedCandidate, ApprovedSnippet } from '../../types';
import { VisualRedactionCanvas } from '../canvas/VisualRedactionCanvas';

interface Props {
  candidates: ExtractedCandidate[];
  approvedKeys: Set<string>;
  onToggleApproval: (fieldKey: string) => void;
  onComposeVerifiedSheet: () => void;
  isComposing: boolean;
  canCompose: boolean;
  rawDocumentText?: string;
  documentTitle?: string;
  documentSizeBytes?: number;
  onVerifyProof?: (fieldLabel: string, value: string | number, exactQuote: string) => void;
}

export const SnippetApprovalList: React.FC<Props> = ({
  candidates,
  approvedKeys,
  onToggleApproval,
  onComposeVerifiedSheet,
  isComposing,
  canCompose,
  rawDocumentText = '',
  documentTitle = 'Local Document',
  documentSizeBytes = 0,
  onVerifyProof,
}) => {
  const [showCanvas, setShowCanvas] = useState(true);

  if (candidates.length === 0) {
    return (
      <div className="airlock-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="step-indicator">3</div>
            <div>
              <h3 className="card-title">Human-in-the-Loop Snippet Approval & Defense</h3>
              <p className="card-subtitle">Review and approve only the specific answers that leave your device.</p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-dim)', fontSize: '13px' }}>
          Extraction jobs will appear here once you run the On-Device Extractor in Step 2.
        </div>
      </div>
    );
  }

  // Derive approved snippets list for the Visual Redaction Canvas
  const approvedSnippetObjects: ApprovedSnippet[] = candidates
    .filter((c) => approvedKeys.has(c.fieldKey) && c.found && c.isGrounded)
    .map((c) => ({
      fieldKey: c.fieldKey,
      fieldLabel: c.fieldLabel,
      value: c.value || '',
      exactQuote: c.exactQuote || String(c.value || ''),
      pageNumber: c.pageNumber || 1,
      sourceHash: '0x' + c.fieldKey.slice(0, 8),
      approvedByUser: true,
    }));

  const hasAdversarialAttacks = candidates.some((c) => c.isAdversarialAttack);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="airlock-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="step-indicator">3</div>
            <div>
              <h3 className="card-title">Human-in-the-Loop Snippet Approval & Defense</h3>
              <p className="card-subtitle">
                Inspect extracted fields. Verify citations and approve disclosure before cryptographic synthesis.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {rawDocumentText && (
              <button
                type="button"
                className="btn-preset"
                onClick={() => setShowCanvas((prev) => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: showCanvas ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                  borderColor: showCanvas ? '#38bdf8' : 'var(--border-subtle)',
                  color: showCanvas ? '#38bdf8' : 'var(--text-muted)',
                }}
              >
                <Layers size={13} />
                <span>{showCanvas ? 'Hide Redaction Canvas' : 'Show Redaction Canvas'}</span>
              </button>
            )}

            <div className="status-pill success">
              <FileCheck size={12} />
              <span>{approvedKeys.size} Approved for Disclosure</span>
            </div>
          </div>
        </div>

        {/* Adversarial Attack Notification Banner */}
        {hasAdversarialAttacks && (
          <div
            style={{
              background: 'rgba(225, 29, 72, 0.15)',
              border: '1px solid #f43f5e',
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} color="#fb7185" />
              <strong style={{ color: '#fff', fontSize: '13px' }}>
                HOSTILE PAYLOAD INTERCEPTED: Checkbox locked. Injected override neutralized.
              </strong>
            </div>
            <span
              style={{
                fontSize: '11px',
                background: '#e11d48',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 700,
              }}
            >
              QUARANTINED
            </span>
          </div>
        )}

        {/* Snippet Candidates List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {candidates.map((candidate) => {
            const isApproved = approvedKeys.has(candidate.fieldKey);
            const isAttack = Boolean(candidate.isAdversarialAttack);
            const isQuarantined = !candidate.isGrounded || isAttack;

            return (
              <div
                key={candidate.fieldKey}
                className={`snippet-card ${isApproved ? 'approved' : ''} ${isQuarantined ? 'quarantined' : ''}`}
                style={
                  isAttack
                    ? {
                      border: '1px solid #e11d48',
                      background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.08) 0%, #0d1117 100%)',
                    }
                    : undefined
                }
              >
                <div className="snippet-header">
                  <div className="snippet-title">
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: isQuarantined ? 'not-allowed' : 'pointer',
                      }}
                      title={isQuarantined ? 'Cannot approve quarantined or compromised candidate' : 'Toggle approval'}
                    >
                      <input
                        type="checkbox"
                        checked={isApproved}
                        disabled={isQuarantined}
                        onChange={() => onToggleApproval(candidate.fieldKey)}
                        style={{
                          width: '16px',
                          height: '16px',
                          accentColor: 'var(--color-success)',
                          cursor: isQuarantined ? 'not-allowed' : 'pointer',
                        }}
                      />
                      <span style={{ fontWeight: 600, color: isAttack ? '#fb7185' : '#f1f5f9' }}>
                        {candidate.fieldLabel}
                      </span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="status-pill" style={{ fontSize: '11px', padding: '3px 8px' }}>
                      <Cpu size={10} />
                      {candidate.sourceType === 'on_device' ? 'Gemini Nano (On-Device)' : 'Local Deterministic'}
                    </span>

                    {isAttack ? (
                      <span
                        className="status-pill danger"
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          background: 'rgba(225, 29, 72, 0.25)',
                          color: '#fda4af',
                          border: '1px solid #f43f5e',
                          fontWeight: 700,
                        }}
                      >
                        <ShieldAlert size={12} color="#f43f5e" />
                        ADVERSARIAL ATTACK INTERCEPTED
                      </span>
                    ) : isQuarantined ? (
                      <span className="status-pill warning" style={{ fontSize: '11px', padding: '3px 8px' }}>
                        <AlertTriangle size={10} />
                        QUARANTINED (UNVERIFIABLE)
                      </span>
                    ) : (
                      <span className="status-pill success" style={{ fontSize: '11px', padding: '3px 8px' }}>
                        <CheckCircle2 size={10} />
                        GROUNDED
                      </span>
                    )}
                  </div>
                </div>

                {candidate.found ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Extracted Value:</span>
                      <strong
                        style={{
                          fontSize: '16px',
                          color: isAttack ? '#fb7185' : isQuarantined ? 'var(--color-warning)' : '#34d399',
                          fontFamily: 'var(--font-mono)',
                          textDecoration: isAttack ? 'line-through' : 'none',
                        }}
                      >
                        {String(candidate.value)}
                      </strong>

                      {isAttack && (
                        <span
                          style={{
                            fontSize: '11px',
                            background: 'rgba(225, 29, 72, 0.2)',
                            color: '#fda4af',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 600,
                          }}
                        >
                          <Lock size={10} style={{ display: 'inline', marginRight: '3px' }} />
                          BLOCKED FROM DISCLOSURE
                        </span>
                      )}
                    </div>

                    {candidate.exactQuote && (
                      <div
                        className="quote-box"
                        style={
                          isAttack
                            ? {
                              borderLeft: '3px solid #e11d48',
                              background: 'rgba(225, 29, 72, 0.05)',
                              color: '#fda4af',
                            }
                            : undefined
                        }
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            color: isAttack ? '#fb7185' : 'var(--text-dim)',
                            display: 'block',
                            marginBottom: '2px',
                          }}
                        >
                          Verbatim Source Quote (Page {candidate.pageNumber || 1}):
                        </span>
                        "{candidate.exactQuote}"
                      </div>
                    )}

                    {!isQuarantined && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginTop: '6px',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                          Commitment: Salted SHA-256 (128-bit)
                        </span>

                        {onVerifyProof && (
                          <button
                            type="button"
                            onClick={() => onVerifyProof(candidate.fieldLabel, candidate.value || '', candidate.exactQuote || '')}
                            className="btn-preset"
                            style={{ fontSize: '11px', padding: '2px 8px', color: '#38bdf8' }}
                          >
                            Verify Math
                          </button>
                        )}
                      </div>
                    )}

                    {isQuarantined && candidate.quarantineReason && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: isAttack ? '#fb7185' : 'var(--color-warning)',
                          marginTop: '6px',
                          padding: '8px 10px',
                          background: isAttack ? 'rgba(225, 29, 72, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          border: `1px solid ${isAttack ? 'rgba(225, 29, 72, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                          borderRadius: '6px',
                          lineHeight: '1.4',
                        }}
                      >
                        <strong>{isAttack ? '🛡️ Grounding Gate Neutralization:' : '⚠️ Quarantine Reason:'}</strong>{' '}
                        {candidate.quarantineReason}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                    Information not found in provided document.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
            Only checked snippets are transferred into the Cloud Gemini cover letter.
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={onComposeVerifiedSheet}
            disabled={!canCompose || isComposing}
          >
            <Check size={16} />
            {isComposing ? 'Cloud Composing Answer Sheet...' : 'Compose Minimal Answer Sheet (Cloud)'}
          </button>
        </div>
      </div>

      {/* Visual Redaction Canvas Preview in Step 3 */}
      {showCanvas && rawDocumentText && (
        <VisualRedactionCanvas
          rawText={rawDocumentText}
          documentTitle={documentTitle}
          approvedSnippets={approvedSnippetObjects}
          fileSizeBytes={documentSizeBytes}
        />
      )}
    </div>
  );
};
