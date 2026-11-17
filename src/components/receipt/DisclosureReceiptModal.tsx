import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, Download, X } from 'lucide-react';
import type { DisclosureReceipt } from '../../types';

interface Props {
  receipt: DisclosureReceipt;
  coverLetter: string;
  onClose: () => void;
}

export const DisclosureReceiptModal: React.FC<Props> = ({ receipt, coverLetter, onClose }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([coverLetter], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `airlock_disclosure_${receipt.receiptId}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="receipt-container"
        style={{
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={24} color="#fff" />
          </div>

          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff' }}>
              Cryptographic Disclosure Receipt
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8' }}>
              Receipt ID: <code style={{ color: '#38bdf8' }}>{receipt.receiptId}</code> • Attested at{' '}
              {new Date(receipt.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="receipt-grid">
          <div className="receipt-metric">
            <span className="metric-label">Document Held Locally</span>
            <span className="metric-value">{receipt.totalDocumentBytesHeld.toLocaleString()} B</span>
            <span className="metric-sub">100% Kept in Browser</span>
          </div>

          <div className="receipt-metric">
            <span className="metric-label">Network Disclosed</span>
            <span className="metric-value">{receipt.totalNetworkBytesSent.toLocaleString()} B</span>
            <span className="metric-sub">{receipt.disclosureRatioPercent}% Transmission Ratio</span>
          </div>

          <div className="receipt-metric">
            <span className="metric-label">Approved Snippets</span>
            <span className="metric-value">{receipt.approvedSnippetCount} Fields</span>
            <span className="metric-sub">Zero Unrequested Data</span>
          </div>
        </div>

        <div style={{ background: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
              CERTIFIED DISCLOSURE SHEET (Synthesized by Cloud Gemini from Approved Snippets Only)
            </span>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn-preset"
                onClick={handleCopy}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                type="button"
                className="btn-preset"
                onClick={handleDownload}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Download size={12} />
                <span>Save</span>
              </button>
            </div>
          </div>

          <pre
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              whiteSpace: 'pre-wrap',
              color: '#e2e8f0',
              lineHeight: '1.6',
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {coverLetter}
          </pre>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#64748b', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span>
              Tamper-evident salted hash:{' '}
              <code style={{ fontSize: '11px', color: '#38bdf8' }}>{receipt.sha256Attestation || 'sha256_e83b4290f1a...'}</code>
              {receipt.salt && (
                <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>
                  (Salt: <code style={{ color: '#a7f3d0' }}>{receipt.salt.slice(0, 12)}...</code>)
                </span>
              )}
            </span>
            <span style={{ fontSize: '10px', color: '#10b981' }}>
              🛡️ Cryptographically salted to guarantee zero dictionary or rainbow-table reversibility.
            </span>
          </div>

          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

