import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, Copy, Sparkles } from 'lucide-react';
import type { AuditReport, VerificationRequest } from '../../types';
import { SAMPLE_VERIFICATION_REQUESTS } from '../../lib/documents/syntheticData';
import { runCloudPlanner } from '../../lib/ai/hybridModel';

interface Props {
  onRequestPlanned: (request: VerificationRequest, audit: AuditReport) => void;
  isLoading: boolean;
}

export const RequestAuditorView: React.FC<Props> = ({ onRequestPlanned, isLoading }) => {
  const [requestText, setRequestText] = useState(SAMPLE_VERIFICATION_REQUESTS[0].rawRequestText);
  const [requesterName, setRequesterName] = useState(SAMPLE_VERIFICATION_REQUESTS[0].requesterName || '');
  const [currentAudit, setCurrentAudit] = useState<AuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSelectPreset = (preset: VerificationRequest) => {
    setRequestText(preset.rawRequestText);
    setRequesterName(preset.requesterName || '');
    setCurrentAudit(null);
  };

  const handleExecuteAudit = async () => {
    if (!requestText.trim()) return;
    setIsAuditing(true);
    try {
      const audit = await runCloudPlanner(requestText);
      setCurrentAudit(audit);
      onRequestPlanned(
        {
          id: `req_${Date.now()}`,
          rawRequestText: requestText,
          requesterName,
          timestamp: Date.now(),
        },
        audit
      );
    } finally {
      setIsAuditing(false);
    }
  };

  const handleCopyProposal = () => {
    if (currentAudit?.politeCounterProposal) {
      navigator.clipboard.writeText(currentAudit.politeCounterProposal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="airlock-card">
      <div className="card-header">
        <div className="card-title-group">
          <div className="step-indicator">1</div>
          <div>
            <h3 className="card-title">Request Auditor & Blind Planner</h3>
            <p className="card-subtitle">Cloud model reads request text ONLY. Never accesses your files.</p>
          </div>
        </div>
      </div>

      <div className="preset-pills-row">
        <span style={{ fontSize: '12px', color: 'var(--text-dim)', alignSelf: 'center' }}>Presets:</span>
        {SAMPLE_VERIFICATION_REQUESTS.map((sample) => (
          <button key={sample.id} type="button" className="btn-preset" onClick={() => handleSelectPreset(sample)}>
            {sample.requesterName}
          </button>
        ))}
      </div>

      <textarea
        className="textarea-styled"
        value={requestText}
        onChange={(e) => setRequestText(e.target.value)}
        placeholder="Paste third-party verification demand (landlord, lender, employer)..."
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input
          type="text"
          value={requesterName}
          onChange={(e) => setRequesterName(e.target.value)}
          placeholder="Requester Name (optional)"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '8px 12px',
            color: 'var(--text-main)',
            fontSize: '13px',
            width: '240px',
          }}
        />

        <button
          type="button"
          className="btn-primary"
          onClick={handleExecuteAudit}
          disabled={isAuditing || isLoading || !requestText.trim()}
        >
          <Sparkles size={16} />
          {isAuditing ? 'Auditing Request in Cloud...' : 'Audit Request & Plan Extraction'}
        </button>
      </div>

      {currentAudit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '6px' }}>
          {currentAudit.scamRedFlags.map((flag, idx) => (
            <div key={idx} className="alert-box danger">
              <ShieldAlert size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>Security Phishing Warning:</strong>
                <div>{flag}</div>
              </div>
            </div>
          ))}

          {currentAudit.overAskingFlags.map((flag, idx) => (
            <div key={idx} className="alert-box warning">
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <div>
                <strong>Over-Asking Detected:</strong>
                <div>{flag}</div>
              </div>
            </div>
          ))}

          {!currentAudit.isSuspicious && currentAudit.overAskingFlags.length === 0 && (
            <div className="alert-box info">
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div>Request evaluated: standard qualification inquiry. Formulating minimal extraction jobs.</div>
            </div>
          )}

          <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                MINIMAL COUNTER-PROPOSAL
              </span>
              <button
                type="button"
                className="btn-preset"
                onClick={handleCopyProposal}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Copy size={12} />
                {copied ? 'Copied' : 'Copy Proposal'}
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#cbd5e1', fontStyle: 'italic', lineHeight: '1.4' }}>
              "{currentAudit.politeCounterProposal}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

