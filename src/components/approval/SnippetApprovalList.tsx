import React from 'react';
import { Check, ShieldAlert, CheckCircle2, Cpu, FileCheck } from 'lucide-react';
import type { ExtractedCandidate } from '../../types';

interface Props {
  candidates: ExtractedCandidate[];
  approvedKeys: Set<string>;
  onToggleApproval: (fieldKey: string) => void;
  onComposeVerifiedSheet: () => void;
  isComposing: boolean;
  canCompose: boolean;
}

export const SnippetApprovalList: React.FC<Props> = ({
  candidates,
  approvedKeys,
  onToggleApproval,
  onComposeVerifiedSheet,
  isComposing,
  canCompose,
}) => {
  if (candidates.length === 0) {
    return (
      <div className="airlock-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="step-indicator">3</div>
            <div>
              <h3 className="card-title">Human-in-the-Loop Snippet Approval</h3>
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

  return (
    <div className="airlock-card">
      <div className="card-header">
        <div className="card-title-group">
          <div className="step-indicator">3</div>
          <div>
            <h3 className="card-title">Human-in-the-Loop Snippet Approval</h3>
            <p className="card-subtitle">Review and approve only the specific answers that leave your device.</p>
          </div>
        </div>

        <div className="status-pill success">
          <FileCheck size={12} />
          <span>{approvedKeys.size} Approved for Disclosure</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {candidates.map((candidate) => {
          const isApproved = approvedKeys.has(candidate.fieldKey);
          const isQuarantined = !candidate.isGrounded;

          return (
            <div
              key={candidate.fieldKey}
              className={`snippet-card ${isApproved ? 'approved' : ''} ${isQuarantined ? 'quarantined' : ''}`}
            >
              <div className="snippet-header">
                <div className="snippet-title">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isQuarantined ? 'not-allowed' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isApproved}
                      disabled={isQuarantined}
                      onChange={() => onToggleApproval(candidate.fieldKey)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--color-success)' }}
                    />
                    <span>{candidate.fieldLabel}</span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="status-pill" style={{ fontSize: '11px', padding: '3px 8px' }}>
                    <Cpu size={10} />
                    {candidate.sourceType === 'on_device' ? 'Gemini Nano (On-Device)' : 'Local Deterministic'}
                  </span>

                  {isQuarantined ? (
                    <span className="status-pill danger" style={{ fontSize: '11px', padding: '3px 8px' }}>
                      <ShieldAlert size={10} />
                      QUARANTINED
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
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Extracted Value:</span>
                    <strong style={{ fontSize: '16px', color: isQuarantined ? 'var(--color-danger)' : '#fff', fontFamily: 'var(--font-mono)' }}>
                      {String(candidate.value)}
                    </strong>
                  </div>

                  {candidate.exactQuote && (
                    <div className="quote-box">
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>
                        Verbatim Source Quote (Page {candidate.pageNumber || 1}):
                      </span>
                      "{candidate.exactQuote}"
                    </div>
                  )}

                  {isQuarantined && (
                    <div style={{ fontSize: '12px', color: 'var(--color-danger)', marginTop: '4px' }}>
                      ⚠️ {candidate.quarantineReason}
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
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
  );
};

