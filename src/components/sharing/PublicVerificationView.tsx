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
  Award,
  Hash,
  AlertOctagon,
  Info,
  QrCode,
  Printer,
  X,
} from 'lucide-react';
import type { RevocableDisclosure } from '../../types';
import { fetchPublicDisclosure, revokeDisclosure, getAllSavedDisclosures } from '../../lib/sharing/firestoreSharing';
import { HashVerificationModal } from '../common/HashVerificationModal';
import { generateQrCodeSvg } from '../../lib/sharing/qrGenerator';

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
  const [showQrModal, setShowQrModal] = useState(false);

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
      setDisclosure((prev) =>
        prev
          ? {
              ...prev,
              revoked: true,
              revokedAt: Date.now(),
              tombstone: true,
              coverLetter: '[REVOKED - SENSITIVE PAYLOAD ZEROED BY ISSUER]',
              approvedSnippets: [],
              derivedClaims: [],
            }
          : null
      );
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
        <p style={{ fontSize: '13px' }}>Resolving selective disclosure record from Cloud Firestore</p>
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
                border: isValid ? '1px solid #10b981' : '1px solid #f43f5e',
              }}
            >
              {isValid ? <ShieldCheck size={28} color="#fff" /> : <ShieldAlert size={28} color="#fff" />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: 0 }}>
                  Airlock Certified Selective Disclosure
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
                Selective Disclosure Record issued to <strong>{disclosure.requesterName}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-preset"
                onClick={() => setShowQrModal(true)}
                style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                title="Scan QR Code on mobile"
              >
                <QrCode size={13} color="#38bdf8" />
                <span>Mobile QR</span>
              </button>
              <button
                type="button"
                className="btn-preset"
                onClick={() => window.print()}
                style={{ fontSize: '12px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                title="Print or export certificate"
              >
                <Printer size={13} color="#94a3b8" />
                <span>Print</span>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
              <Eye size={12} />
              <span>{disclosure.viewCount} views</span>
              <span>•</span>
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
                  DISCLOSURE PERMANENTLY REVOKED (TOMBSTONED)
                </strong>
                <span style={{ fontSize: '12px', color: '#fecdd3' }}>
                  The creator of this verification record exercised their 1-click revocation right. All sensitive snippets and claims have been permanently wiped from both device cache and Cloud Firestore. Only the immutable SHA-256 receipt commitment remains for audit history.
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
                  The designated validity period of this disclosure has elapsed. Please request a refreshed selective disclosure.
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
                  <strong>Selective Disclosure Active:</strong> Only requested fields and zero-leakage predicates disclosed. Raw document never left user's browser.
                </span>
              </div>
              <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                Expires in {daysRemaining} days
              </span>
            </div>
          )}
        </div>

        {/* Derived Claims Section (Zero-Leakage Predicates) */}
        {!isRevoked && disclosure.derivedClaims && disclosure.derivedClaims.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.5px' }}>
                ZERO-LEAKAGE DERIVED CLAIMS ({disclosure.derivedClaims.length})
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Evaluated locally • Exact raw numbers are sealed and never transmitted
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {disclosure.derivedClaims.map((claim) => (
                <div
                  key={claim.id}
                  style={{
                    background: '#070b14',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        background: claim.result ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                        border: `1px solid ${claim.result ? '#10b981' : '#f43f5e'}`,
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontWeight: 800,
                        fontSize: '13px',
                        color: claim.result ? '#34d399' : '#f43f5e',
                      }}
                    >
                      {claim.result ? 'YES / VERIFIED' : 'NO / NOT MET'}
                    </div>
                    <div>
                      <strong style={{ color: '#fff', fontSize: '13px', display: 'block' }}>
                        {claim.statement}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {claim.revealsSummary}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                      Hash: {claim.commitmentHash.slice(0, 14)}...
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setVerifyingSnippet({
                          fieldLabel: claim.statement,
                          value: claim.result ? 'TRUE' : 'FALSE',
                          exactQuote: claim.statement,
                          fullHash: claim.commitmentHash,
                          salt: claim.salt,
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
                      Verify Proof
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Minimal Verified Facts Table: Hidden if Revoked */}
        {!isRevoked && disclosure.approvedSnippets.length > 0 && (
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
                          Verify Proof
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

        {/* Honest Proof Notice (Scope of Proof) */}
        <div
          style={{
            marginTop: '24px',
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '14px 16px',
            fontSize: '12px',
            color: '#94a3b8',
            lineHeight: '1.5',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#f1f5f9' }}>
            <Info size={14} color="#38bdf8" />
            <strong style={{ fontSize: '12px' }}>Cryptographic Scope: What this proof does and does not prove</strong>
          </div>
          <p style={{ margin: '0 0 6px' }}>
            • <strong>What it proves:</strong> Mathematical non-repudiation. The attested values, derived predicates, and quotes exactly match the cryptographic SHA-256 preimage committed by the user's browser, and have not been altered or tampered with since issuance.
          </p>
          <p style={{ margin: 0 }}>
            • <strong>What it does not prove:</strong> It does not independently guarantee that the underlying source document is authentic (a user could theoretically feed a fabricated statement into their device).
          </p>
        </div>

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
                You own this disclosure certificate
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                You can revoke counterparty access immediately at any time. Revocation wipes sensitive snippets from both device and cloud storage.
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

      {showQrModal && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '380px',
              width: '90%',
              background: '#0d1321',
              border: '1px solid #1e293b',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <QrCode size={18} color="#38bdf8" />
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>Scan on Mobile</span>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
              Scan with your phone camera to independently audit this selective disclosure certificate.
            </p>

            <div
              dangerouslySetInnerHTML={{
                __html: generateQrCodeSvg(typeof window !== 'undefined' ? window.location.href : disclosure.id, 200),
              }}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              }}
            />

            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b', wordBreak: 'break-all' }}>
              ID: {disclosure.id}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowQrModal(false)}
              style={{ width: '100%', padding: '8px' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
