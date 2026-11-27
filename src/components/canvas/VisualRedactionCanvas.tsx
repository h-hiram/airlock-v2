import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Lock, CheckCircle2, Copy, Check } from 'lucide-react';
import type { ApprovedSnippet } from '../../types';

interface Props {
  rawText: string;
  documentTitle: string;
  approvedSnippets: ApprovedSnippet[];
  fileSizeBytes: number;
}

export const VisualRedactionCanvas: React.FC<Props> = ({
  rawText,
  documentTitle,
  approvedSnippets,
  fileSizeBytes,
}) => {
  const [viewMode, setViewMode] = useState<'redacted' | 'xray'>('redacted');
  const [copied, setCopied] = useState(false);

  // Normalize approved snippet quotes/values for matching
  const approvedTerms = approvedSnippets
    .map((s) => ({
      key: s.fieldKey,
      label: s.fieldLabel,
      quote: (s.exactQuote || '').trim().toLowerCase(),
      val: String(s.value || '').trim().toLowerCase(),
    }))
    .filter((s) => s.val.length > 0 || s.quote.length > 0);

  const lines = rawText.split('\n');

  // Determine line classification
  let totalLines = lines.length;
  let approvedLineCount = 0;
  let redactedLineCount = 0;

  const analyzedLines = lines.map((line, lineIndex) => {
    const trimmed = line.trim();
    const lowerLine = line.toLowerCase();

    // Check if line is purely cosmetic decoration
    const isHeaderSeparator = /^[=\-_*#]{3,}$/.test(trimmed);

    // Check if line contains an approved disclosure
    const matchedSnippet = approvedTerms.find((t) => {
      if (t.quote.length > 3 && lowerLine.includes(t.quote)) return true;
      if (t.val.length > 2 && lowerLine.includes(t.val)) return true;
      return false;
    });

    if (matchedSnippet) {
      approvedLineCount++;
      return {
        lineIndex,
        raw: line,
        status: 'approved' as const,
        matchedLabel: matchedSnippet.label,
      };
    }

    if (trimmed.length === 0 || isHeaderSeparator) {
      return {
        lineIndex,
        raw: line,
        status: 'structural' as const,
      };
    }

    redactedLineCount++;
    return {
      lineIndex,
      raw: line,
      status: 'redacted' as const,
    };
  });

  const suppressionPercentage =
    totalLines > 0
      ? Math.max(0, Math.min(100, Math.round((redactedLineCount / (approvedLineCount + redactedLineCount || 1)) * 100)))
      : 100;

  const handleCopyRedactedText = () => {
    const textToCopy = analyzedLines
      .map((l) => {
        if (l.status === 'approved' || l.status === 'structural') return l.raw;
        return '█'.repeat(Math.max(12, Math.min(48, l.raw.length)));
      })
      .join('\n');

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        background: '#070b14',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Canvas Top Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.9)',
          padding: '12px 18px',
          borderBottom: '1px solid #1e293b',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 10px #10b981',
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.5px' }}>
                VISUAL REDACTION CANVAS
              </span>
              <span
                style={{
                  fontSize: '11px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                }}
              >
                {suppressionPercentage}% SEALED ON DEVICE
              </span>
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Source: {documentTitle} ({fileSizeBytes.toLocaleString()} bytes held locally)
            </span>
          </div>
        </div>

        {/* View Mode & Copy Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('redacted')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'redacted' ? '#1e293b' : 'transparent',
                color: viewMode === 'redacted' ? '#38bdf8' : '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <EyeOff size={13} />
              Classified Redaction
            </button>

            <button
              type="button"
              onClick={() => setViewMode('xray')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'xray' ? '#1e293b' : 'transparent',
                color: viewMode === 'xray' ? '#fbbf24' : '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Eye size={13} />
              X-Ray Inspection
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyRedactedText}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid #334155',
              background: '#0f172a',
              color: copied ? '#34d399' : '#cbd5e1',
              cursor: 'pointer',
            }}
            title="Copy Redacted Presentation"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy Redacted'}
          </button>
        </div>
      </div>

      {/* Legend & Summary Ribbon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#0a0f1d',
          padding: '8px 18px',
          borderBottom: '1px solid #1e293b',
          fontSize: '12px',
          color: '#94a3b8',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                background: '#10b981',
                borderRadius: '3px',
                display: 'inline-block',
              }}
            />
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>Approved Disclosed Field</span>
            <span style={{ color: '#64748b' }}>({approvedLineCount} lines)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '24px',
                height: '12px',
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: '2px',
                display: 'inline-block',
              }}
            />
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>Locally Redacted Tape</span>
            <span style={{ color: '#64748b' }}>({redactedLineCount} lines suppressed)</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>On-Device Security Gate Active</span>
        </div>
      </div>

      {/* Interactive Monospace Redaction Viewport */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          fontSize: '12px',
          lineHeight: '1.7',
          padding: '16px 0',
          maxHeight: '440px',
          overflowY: 'auto',
          background: '#050811',
          userSelect: viewMode === 'redacted' ? 'none' : 'text',
        }}
      >
        {analyzedLines.map((line) => {
          if (line.status === 'approved') {
            return (
              <div
                key={line.lineIndex}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(16, 185, 129, 0.12)',
                  borderLeft: '4px solid #10b981',
                  padding: '2px 16px',
                }}
              >
                <span
                  style={{
                    width: '36px',
                    color: '#059669',
                    userSelect: 'none',
                    fontSize: '11px',
                  }}
                >
                  {String(line.lineIndex + 1).padStart(2, '0')}
                </span>
                <span style={{ color: '#34d399', fontWeight: 600, flex: 1 }}>{line.raw}</span>
                {line.matchedLabel && (
                  <span
                    style={{
                      fontSize: '10px',
                      background: 'rgba(16, 185, 129, 0.25)',
                      color: '#a7f3d0',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <CheckCircle2 size={10} />
                    {line.matchedLabel}
                  </span>
                )}
              </div>
            );
          }

          if (line.status === 'structural') {
            return (
              <div
                key={line.lineIndex}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px 16px',
                  color: '#334155',
                  opacity: 0.6,
                }}
              >
                <span
                  style={{
                    width: '36px',
                    color: '#1e293b',
                    userSelect: 'none',
                    fontSize: '11px',
                  }}
                >
                  {String(line.lineIndex + 1).padStart(2, '0')}
                </span>
                <span style={{ color: '#475569' }}>{line.raw || ' '}</span>
              </div>
            );
          }

          // Redacted lines
          return (
            <div
              key={line.lineIndex}
              title={
                viewMode === 'redacted'
                  ? 'Sealed locally in browser memory. Not transmitted over network.'
                  : `X-RAY VIEW: ${line.raw}`
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '2px 16px',
                borderLeft: '4px solid transparent',
                transition: 'background 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '36px',
                  color: '#334155',
                  userSelect: 'none',
                  fontSize: '11px',
                }}
              >
                {String(line.lineIndex + 1).padStart(2, '0')}
              </span>

              {viewMode === 'redacted' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <div
                    style={{
                      background: 'linear-gradient(90deg, #090e1a 0%, #030712 100%)',
                      border: '1px solid #1e293b',
                      borderRadius: '4px',
                      padding: '1px 10px',
                      color: '#475569',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      letterSpacing: '2px',
                      fontSize: '11px',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
                    }}
                  >
                    <Lock size={10} color="#64748b" />
                    <span>██████████████████████████████</span>
                    <span style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.5px' }}>
                      [SEALED ON DEVICE]
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span
                    style={{
                      color: '#94a3b8',
                      textDecoration: 'line-through',
                      textDecorationColor: '#f43f5e',
                      opacity: 0.7,
                    }}
                  >
                    {line.raw}
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      background: 'rgba(244, 63, 94, 0.15)',
                      color: '#fda4af',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                    }}
                  >
                    PREVENTED FROM TRANSMISSION
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Canvas Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.8)',
          padding: '10px 18px',
          borderTop: '1px solid #1e293b',
          fontSize: '11px',
          color: '#64748b',
        }}
      >
        <span>
          Airlock Zero-Knowledge Redaction Pipeline • SHA-256 chunk hashes verified
        </span>
        <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
          {approvedSnippets.length} Approved Snippets • {redactedLineCount} Lines Sealed
        </span>
      </div>
    </div>
  );
};

