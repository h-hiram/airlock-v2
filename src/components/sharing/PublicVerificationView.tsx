import React, { useEffect, useState } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Eye,
  CheckCircle2,
  Lock,
  ArrowLeft,
  FileCheck,
  Award,
  Hash,
  AlertOctagon,
} from 'lucide-react';
import type { RevocableDisclosure } from '../../types';
import { fetchPublicDisclosure, revokeDisclosure, getAllSavedDisclosures } from '../../lib/sharing/firestoreSharing';
import { HashVerificationModal } from '../common/HashVerificationModal';

interface Props {
  disclosureId: string;
  onBackToApp: () => void;
}

export const PublicVerificationView: React.FC<Props> = ({ disclosureId, onBackToApp }) => {
  const [disclosure, setDisclosure] = useState<RevocableDisclosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const [verifyingSnippet, setVerifyingSnippet] = useState<{
    fieldLabel: string;
    value: string | number;
    exactQuote: string;
    fullHash: string;
    salt?: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchPublicDisclosure(disclosureId)
      .then((data) => {
        if (!isMounted) return;
        if (!data) {
          setError(`No disclosure certificate found for ID: ${disclosureId}`);
        } else {
          setDisclosure(data);
          // Check if current user is owner
          const localList = getAllSavedDisclosures();
          const matchesLocal = localList.some((d) => d.id === disclosureId);
          setIsOwner(matchesLocal);
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load verification certificate.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [disclosureId]);

  const handleRevoke = async () => {
    if (!disclosure) return;
    setIsRevoking(true);
    try {
      await revokeDisclosure(disclosure.id);
      setDisclosure((prev) => (prev ? { ...prev, revoked: true, revokedAt: Date.now() } : null));
      setShowRevokeConfirm(false);
    } finally {
      setIsRevoking(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <Shield size={36} color="#38bdf8" className="animate-spin" />
        </div>
        <h3 style={{ color: '#fff', fontSize: '18px' }}>Validating Cryptographic Attestation...</h3>
        <p style={{ fontSize: '13px' }}>Resolving zero-knowledge disclosure record from Cloud Firestore</p>
      </div>
    );
  }

  if (error || !disclosure) {
    return (
      <div className="airlock-card" style={{ maxWidth: '640px', margin: '40px auto', textAlign: 'center' }}>
        <AlertOctagon size={48} color="#f43f5e" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>Verification Certificate Not Found</h3>
        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
          {error || 'The requested verification link may have expired, been purged, or does not exist.'}
        </p>
        <button type="button" className="btn-primary" onClick={onBackToApp}>
          <ArrowLeft size={16} /> Return to Airlock Studio
        </button>
      </div>
    );
  }

  const isExpired = Date.now() > disclosure.expiresAt;
  const isRevoked = disclosure.revoked;
  const isValid = !isRevoked && !isExpired;

  const daysRemaining = Math.max(0, Math.ceil((disclosure.expiresAt - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Navigation Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={onBackToApp}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
        >
          <ArrowLeft size={14} /> Back to Airlock App
        </button>

        <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
          CERTIFICATE REF: {disclosure.id}
        </span>
      </div>

      {/* Main Attestation Card */}
      <div className="airlock-card" style={{ padding: '24px' }}>
        {/* Certificate Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: isValid
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                  : 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isValid ? '0 0 20px rgba(16, 185, 129, 0.4)' : '0 0 20px rgba(225, 29, 72, 0.4)',
              }}
            >
              {isValid ? <ShieldCheck size={28} color="#fff" /> : <ShieldAlert size={28} color="#fff" />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Airlock Certified Minimal Disclosure
                </h2>
                {isValid && (
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.4)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    GENUINE & ATTESTED
                  </span>
                )}
              </div>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0' }}>
                Counterparty Verification Record issued to <strong>{disclosure.requesterName}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
              <Eye size={12} />
              <span>{disclosure.viewCount} views</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
              <Clock size={12} />
              <span>Issued: {new Date(disclosure.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* State Banner: Active vs Revoked vs Expired */}
        <div style={{ marginTop: '20px' }}>
          {isRevoked ? (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.2) 0%, rgba(136, 19, 55, 0.3) 100%)',
                border: '1px solid #f43f5e',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <ShieldAlert size={28} color="#f43f5e" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#fff', fontSize: '15px', display: 'block' }}>
                  DISCLOSURE PERMANENTLY REVOKED BY OWNER
                </strong>
                <span style={{ fontSize: '12px', color: '#fecdd3' }}>
                  The creator of this verification record exercised their 1-click revocation right. Access to all verified
                  facts has been permanently terminated. This certificate is invalid.
                </span>
              </div>
            </div>
          ) : isExpired ? (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid #f59e0b',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <Clock size={28} color="#f59e0b" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ color: '#fff', fontSize: '15px', display: 'block' }}>
                  CERTIFICATE EXPIRED
                </strong>
                <span style={{ fontSize: '12px', color: '#fde68a' }}>
                  The designated validity period of this disclosure has elapsed. Please request a refreshed minimal attestation.
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid #10b981',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle2 size={18} color="#10b981" />
                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
                  <strong>Zero-Knowledge Attestation Active:</strong> Only requested fields disclosed. Source document sealed on owner's device.
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                Expires in {daysRemaining} days
              </span>
            </div>
          )}
        </div>

        {/* Facts Table: Hidden if Revoked */}
        {!isRevoked && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.5px' }}>
                MINIMAL VERIFIED FACTS ({disclosure.approvedSnippets.length})
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Extracted via on-device Gemini Nano • Salted SHA-256 commitments (Uncomputable preimage)
              </span>
            </div>

            <div
              style={{
                background: '#070b14',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>Requested Fact</th>
                    <th style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>Attested Value</th>
                    <th style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>Source Quote</th>
                    <th style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600 }}>Salted Hash Commitment</th>
                    <th style={{ padding: '10px 14px', color: '#94a3b8', fontWeight: 600, textAlign: 'right' }}>Math Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {disclosure.approvedSnippets.map((snip) => (
                    <tr key={snip.fieldKey} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px 14px', color: '#f1f5f9', fontWeight: 600 }}>
                        {snip.fieldLabel}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#34d399', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {String(snip.value)}
                      </td>
                      <td style={{ padding: '12px 14px', color: '#cbd5e1', fontSize: '12px' }}>
                        "{snip.exactQuote}" (p.{snip.pageNumber})
                      </td>
                      <td style={{ padding: '12px 14px', color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ color: '#38bdf8' }} title={`Full SHA-256: ${snip.sourceHash}`}>
                            <Hash size={11} style={{ display: 'inline', marginRight: '2px' }} />
                            {snip.sourceHash.length > 20 ? `${snip.sourceHash.slice(0, 16)}...` : snip.sourceHash}
                          </span>
                          {snip.salt && (
                            <span style={{ fontSize: '10px', color: '#64748b' }} title={`Full 128-bit Salt: ${snip.salt}`}>
                              salt: {snip.salt.slice(0, 10)}...
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() =>
                            setVerifyingSnippet({
                              fieldLabel: snip.fieldLabel,
                              value: snip.value,
                              exactQuote: snip.exactQuote,
                              fullHash: snip.sourceHash,
                              salt: snip.salt,
                            })
                          }
                          className="btn-preset"
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            color: '#38bdf8',
                            borderColor: 'rgba(56, 189, 248, 0.4)',
                          }}
                        >
                          🔍 Verify Proof
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Formal Answer Sheet Letter */}
            <div style={{ marginTop: '20px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
                SYNTHESIZED COVER LETTER (CLOUD GEMINI)
              </span>
              <div
                style={{
                  background: '#090e1a',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  padding: '16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: '#e2e8f0',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {disclosure.coverLetter}
              </div>
            </div>

            {/* Cryptographic Seal */}
            <div
              style={{
                marginTop: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#0d1322',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#64748b',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <Award size={14} color="#10b981" />
                <span>Salted SHA-256 Attestation:</span>
                <code style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                  {disclosure.sha256Receipt}
                </code>
                {disclosure.salt && (
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    (Salt: <code style={{ color: '#a7f3d0' }}>{disclosure.salt.slice(0, 10)}...</code>)
                  </span>
                )}
              </div>
              <span>Secured by Google Firebase AI Logic & App Check</span>
            </div>
          </div>
        )}

        {/* Owner Self-Service Revocation Controls */}
        {isOwner && !isRevoked && (
          <div
            style={{
              marginTop: '24px',
              padding: '16px',
              background: '#0b0f19',
              border: '1px dashed #334155',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#f1f5f9', display: 'block' }}>
                👑 You own this disclosure certificate
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                You can revoke counterparty access immediately at any time.
              </span>
            </div>

            {showRevokeConfirm ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#fb7185' }}>Confirm permanent revocation?</span>
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  style={{
                    background: '#e11d48',
                    border: 'none',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isRevoking ? 'Revoking...' : 'Yes, Revoke Now'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRevokeConfirm(false)}
                  className="btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '12px' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowRevokeConfirm(true)}
                style={{
                  background: 'rgba(225, 29, 72, 0.15)',
                  border: '1px solid #f43f5e',
                  color: '#fda4af',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Lock size={12} />
                1-Click Revoke Certificate
              </button>
            )}
          </div>
        )}
      </div>

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
    </div>
  );
};

