// Revocable Share Card - Cloud Firestore Attestation & Public Verification Portal
import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Lock,
  PlusCircle,
  Trash2,
  Award,
  RefreshCw,
} from 'lucide-react';
import type { ApprovedSnippet, RevocableDisclosure, DerivedClaim } from '../../types';
import {
  publishRevocableDisclosure,
  revokeDisclosure,
  getAllSavedDisclosures,
  seedSampleDisclosure,
  deleteLocalDisclosure,
} from '../../lib/sharing/firestoreSharing';

interface Props {
  requesterName?: string;
  requestText?: string;
  counterProposal?: string;
  coverLetter?: string;
  approvedSnippets?: ApprovedSnippet[];
  derivedClaims?: DerivedClaim[];
  sha256Receipt?: string;
  salt?: string;
  onOpenPortal: (disclosureId: string) => void;
}

export const RevocableShareCard: React.FC<Props> = ({
  requesterName = 'Third-Party Requester',
  requestText = '',
  counterProposal = '',
  coverLetter = '',
  approvedSnippets = [],
  derivedClaims = [],
  sha256Receipt = '',
  salt = '',
  onOpenPortal,
}) => {
  const [activeDisclosure, setActiveDisclosure] = useState<RevocableDisclosure | null>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = useState<number>(7);
  const [savedDisclosures, setSavedDisclosures] = useState<RevocableDisclosure[]>([]);

  const loadSaved = () => {
    const list = getAllSavedDisclosures();
    setSavedDisclosures(list);
  };

  useEffect(() => {
    loadSaved();
  }, []);

  const handleGenerateLink = async () => {
    if (!coverLetter && approvedSnippets.length === 0) return;
    setIsPublishing(true);
    try {
      const result = await publishRevocableDisclosure({
        requesterName,
        requestText,
        counterProposal,
        coverLetter,
        approvedSnippets,
        derivedClaims,
        sha256Receipt,
        salt,
        expiresInDays,
      });

      setActiveDisclosure(result.disclosure);
      setShareUrl(result.shareUrl);
      loadSaved();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopy = (id: string, url?: string) => {
    const link = url || `${window.location.origin}${window.location.pathname}?verify=${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await revokeDisclosure(id);
      if (activeDisclosure && activeDisclosure.id === id) {
        setActiveDisclosure((prev) => (prev ? { ...prev, revoked: true, revokedAt: Date.now() } : null));
      }
      setConfirmRevokeId(null);
      loadSaved();
    } finally {
      setRevokingId(null);
    }
  };

  const handleSeedDemo = () => {
    const sample = seedSampleDisclosure();
    setActiveDisclosure(sample);
    setShareUrl(`${window.location.origin}${window.location.pathname}?verify=${sample.id}`);
    loadSaved();
  };

  const handleDelete = (id: string) => {
    deleteLocalDisclosure(id);
    if (activeDisclosure && activeDisclosure.id === id) {
      setActiveDisclosure(null);
      setShareUrl('');
    }
    loadSaved();
  };

  const canPublishCurrent = Boolean(coverLetter || approvedSnippets.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Active Certificate Generation Section */}
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
                Publish attested disclosure links to Cloud Firestore with TTL expiration and 1-click instant revocation.
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
              {canPublishCurrent ? (
                <>
                  Generate a secure, time-limited verification portal link for <strong>{requesterName}</strong>. The
                  counterparty can only view the minimal attested fields; raw document bytes and unrequested lines are
                  never exposed.
                </>
              ) : (
                <>
                  No active disclosure generated in this step yet. You can publish a certificate after approving snippets
                  in Step 3, or seed a pre-configured demo certificate below to test the verifier portal and revocation.
                </>
              )}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {canPublishCurrent && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={14} color="#64748b" />
                    <span style={{ fontSize: '13px', color: '#cbd5e1' }}>Validity TTL:</span>
                    <select
                      value={expiresInDays}
                      onChange={(e) => setExpiresInDays(Number(e.target.value))}
                      style={{
                        background: '#0f172a',
                        border: '1px solid #334155',
                        color: '#f8fafc',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '13px',
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
                </>
              )}

              <button
                type="button"
                className="btn-secondary"
                onClick={handleSeedDemo}
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <PlusCircle size={14} color="#38bdf8" />
                <span>Seed Demo Certificate (Test Verifier & Revocation)</span>
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
                  Revocation notice. Sensitive payload has been wiped and zeroed.
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
                      fontSize: '13px',
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => handleCopy(activeDisclosure.id, shareUrl)}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
                  >
                    {copiedId === activeDisclosure.id ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                    <span>{copiedId === activeDisclosure.id ? 'Copied URL!' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenPortal(activeDisclosure.id)}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '8px 14px' }}
                  >
                    <ExternalLink size={14} />
                    <span>Open Verifier View</span>
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#64748b' }}>
                    <span>Ref: {activeDisclosure.id}</span>
                    <span>•</span>
                    <span>Recipient: {activeDisclosure.requesterName}</span>
                    <span>•</span>
                    <span>Expires: {new Date(activeDisclosure.expiresAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Views: {activeDisclosure.viewCount}</span>
                  </div>

                  {confirmRevokeId === activeDisclosure.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#fb7185' }}>Confirm Revocation?</span>
                      <button
                        type="button"
                        onClick={() => handleRevoke(activeDisclosure.id)}
                        disabled={revokingId === activeDisclosure.id}
                        style={{
                          background: '#e11d48',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '4px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {revokingId === activeDisclosure.id ? 'Revoking...' : 'Yes, Revoke Now'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRevokeId(null)}
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRevokeId(activeDisclosure.id)}
                      style={{
                        background: 'rgba(225, 29, 72, 0.1)',
                        border: '1px solid rgba(225, 29, 72, 0.4)',
                        color: '#fda4af',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Lock size={12} />
                      1-Click Revoke
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Saved Attestation Certificates Management Table */}
      <div className="airlock-card">
        <div className="card-header">
          <div className="card-title-group">
            <Award size={18} color="#38bdf8" />
            <div>
              <h3 className="card-title">Attestation Certificate Registry ({savedDisclosures.length})</h3>
              <p className="card-subtitle">
                Inspect all selective disclosure certificates issued from this client, test counterparty portal views, and exercise instant revocation.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={loadSaved}
              style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Refresh list"
            >
              <RefreshCw size={12} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleSeedDemo}
              style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <PlusCircle size={12} color="#38bdf8" />
              <span>Add Demo Certificate</span>
            </button>
          </div>
        </div>

        {savedDisclosures.length === 0 ? (
          <div
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              border: '1px dashed #334155',
              borderRadius: '8px',
              background: '#090e1a',
            }}
          >
            <ShieldAlert size={28} color="#64748b" style={{ margin: '0 auto 8px' }} />
            <h4 style={{ color: '#e2e8f0', fontSize: '14px', margin: '0 0 6px' }}>No Issued Certificates Found</h4>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
              Run through Steps 1 to 3 to synthesize and sign a custom certificate, or seed a pre-configured tenancy demo certificate to test verification and revocation right now.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSeedDemo}
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              <PlusCircle size={14} />
              <span>Seed Demo Certificate</span>
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Certificate Ref</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Recipient</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Issued</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Views</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedDisclosures.map((disc) => {
                  const isDiscRevoked = disc.revoked;
                  const isDiscExpired = Date.now() > disc.expiresAt;

                  return (
                    <tr
                      key={disc.id}
                      style={{
                        borderBottom: '1px solid #111827',
                        background: activeDisclosure?.id === disc.id ? 'rgba(56, 189, 248, 0.05)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '12px', fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>
                        {disc.id}
                      </td>
                      <td style={{ padding: '12px', color: '#f1f5f9', fontWeight: 500 }}>
                        {disc.requesterName}
                      </td>
                      <td style={{ padding: '12px', color: '#94a3b8' }}>
                        {new Date(disc.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px' }}>
                        {isDiscRevoked ? (
                          <span
                            style={{
                              background: 'rgba(225, 29, 72, 0.15)',
                              border: '1px solid rgba(225, 29, 72, 0.4)',
                              color: '#fda4af',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <ShieldAlert size={12} />
                            REVOKED (TOMBSTONE)
                          </span>
                        ) : isDiscExpired ? (
                          <span
                            style={{
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              color: '#fde68a',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Clock size={12} />
                            EXPIRED
                          </span>
                        ) : (
                          <span
                            style={{
                              background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.4)',
                              color: '#6ee7b7',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle2 size={12} />
                            LIVE & VERIFIABLE
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                        {disc.viewCount || 0}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => onOpenPortal(disc.id)}
                            className="btn-primary"
                            style={{
                              padding: '4px 10px',
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Open recipient verification view"
                          >
                            <ExternalLink size={12} />
                            <span>Open Verifier View</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopy(disc.id)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            title="Copy verifier portal link"
                          >
                            {copiedId === disc.id ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                          </button>

                          {!isDiscRevoked && (
                            <>
                              {confirmRevokeId === disc.id ? (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleRevoke(disc.id)}
                                    disabled={revokingId === disc.id}
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
                                    {revokingId === disc.id ? 'Revoking...' : 'Confirm'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmRevokeId(null)}
                                    className="btn-secondary"
                                    style={{ padding: '4px 6px', fontSize: '11px' }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmRevokeId(disc.id)}
                                  style={{
                                    background: 'rgba(225, 29, 72, 0.1)',
                                    border: '1px solid rgba(225, 29, 72, 0.4)',
                                    color: '#fda4af',
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  title="Revoke certificate and zero payload"
                                >
                                  <Lock size={12} />
                                  <span>Revoke</span>
                                </button>
                              )}
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDelete(disc.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              padding: '4px',
                            }}
                            title="Remove from local registry"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
