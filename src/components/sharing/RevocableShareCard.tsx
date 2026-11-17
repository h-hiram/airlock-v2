// Revocable Share Card - Cloud Firestore Attestation & Public Verification Portal
import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Clock,
  Eye,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import type { ApprovedSnippet, RevocableDisclosure } from '../../types';
import { publishRevocableDisclosure, revokeDisclosure } from '../../lib/sharing/firestoreSharing';

interface Props {
  requesterName: string;
  requestText: string;
  counterProposal: string;
  coverLetter: string;
  approvedSnippets: ApprovedSnippet[];
  sha256Receipt: string;
  salt?: string;
  onOpenPortal: (disclosureId: string) => void;
}

export const RevocableShareCard: React.FC<Props> = ({
  requesterName,
  requestText,
  counterProposal,
  coverLetter,
  approvedSnippets,
  sha256Receipt,
  salt,
  onOpenPortal,
}) => {
  const [activeDisclosure, setActiveDisclosure] = useState<RevocableDisclosure | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [showConfirmRevoke, setShowConfirmRevoke] = useState(false);

  const handleGenerateLink = async () => {
    setIsPublishing(true);
    try {
      const result = await publishRevocableDisclosure({
        requesterName,
        requestText,
        counterProposal,
        coverLetter,
        approvedSnippets,
        sha256Receipt,
        salt,
        expiresInDays,
      });

      setActiveDisclosure(result.disclosure);
      setShareUrl(result.shareUrl);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!activeDisclosure) return;
    setIsRevoking(true);
    try {
      await revokeDisclosure(activeDisclosure.id);
      setActiveDisclosure((prev) => (prev ? { ...prev, revoked: true, revokedAt: Date.now() } : null));
      setShowConfirmRevoke(false);
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <div className="airlock-card">
      <div className="card-header">
        <div className="card-title-group">
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Share2 size={18} color="#38bdf8" />
          </div>
          <div>
            <h3 className="card-title">Cloud Firestore Revocable Share Portal</h3>
            <p className="card-subtitle">
              Publish an attested disclosure link to Cloud Firestore with TTL expiration and 1-click instant revocation.
            </p>
          </div>
        </div>

        {activeDisclosure && (
          <div
            className={`status-pill ${activeDisclosure.revoked ? 'danger' : 'success'}`}
            style={{ fontSize: '12px' }}
          >
            {activeDisclosure.revoked ? <ShieldAlert size={12} /> : <CheckCircle2 size={12} />}
            <span>{activeDisclosure.revoked ? 'REVOKED' : 'LIVE & VERIFIABLE'}</span>
          </div>
        )}
      </div>

      {!activeDisclosure ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: '1.5' }}>
            Generate a secure, time-limited verification portal link for <strong>{requesterName}</strong>. The recipient
            can only view the minimal attested fields; raw document bytes and unrequested lines are never exposed.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} color="#64748b" />
              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>Validity TTL:</span>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '12px',
                }}
              >
                <option value={1}>24 Hours</option>
                <option value={7}>7 Days (Default)</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleGenerateLink}
              disabled={isPublishing}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              <Share2 size={14} />
              {isPublishing ? 'Publishing to Cloud Firestore...' : 'Generate Revocable Share Link'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {activeDisclosure.revoked ? (
            <div
              style={{
                background: 'rgba(225, 29, 72, 0.15)',
                border: '1px solid #f43f5e',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#fecdd3',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <ShieldAlert size={20} color="#f43f5e" />
              <div>
                <strong>Certificate Revoked:</strong> Counterparties visiting this link now receive a permanent 403 /
                Revocation notice. Verified facts are unreadable.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    minWidth: '260px',
                    background: '#090e1a',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#38bdf8',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                  }}
                />

                <button
                  type="button"
                  onClick={handleCopy}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px' }}
                >
                  {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied URL!' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPortal(activeDisclosure.id)}
                  className="btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px' }}
                >
                  <ExternalLink size={14} />
                  <span>Preview Portal</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                  <span>ID: {activeDisclosure.id}</span>
                  <span>•</span>
                  <span>Expires: {new Date(activeDisclosure.expiresAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>Views: {activeDisclosure.viewCount}</span>
                </div>

                {showConfirmRevoke ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#fb7185' }}>Confirm?</span>
                    <button
                      type="button"
                      onClick={handleRevoke}
                      disabled={isRevoking}
                      style={{
                        background: '#e11d48',
                        border: 'none',
                        color: '#fff',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {isRevoking ? 'Revoking...' : 'Yes, Revoke'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConfirmRevoke(false)}
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmRevoke(true)}
                    style={{
                      background: 'rgba(225, 29, 72, 0.1)',
                      border: '1px solid rgba(225, 29, 72, 0.4)',
                      color: '#fda4af',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Lock size={10} />
                    1-Click Revoke
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

