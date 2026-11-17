import React, { useEffect, useState } from 'react';
import {
  FileText,
  Lock,
  ShieldCheck,
  Upload,
  AlertCircle,
  Cpu,
  CloudLightning,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { SyntheticDocument } from '../../types';
import {
  SYNTHETIC_PAYSLIP_CLEAN,
  SYNTHETIC_PAYSLIP_HOSTILE,
  SYNTHETIC_BANK_STATEMENT,
} from '../../lib/documents/syntheticData';
import { telemetryStore } from '../../lib/network/telemetryStore';
import { VisualRedactionCanvas } from './VisualRedactionCanvas';

interface Props {
  selectedDocument: SyntheticDocument;
  onSelectDocument: (doc: SyntheticDocument) => void;
  onStartExtraction: (mode: 'prefer_on_device' | 'only_on_device') => void;
  canExtract: boolean;
  isExtracting: boolean;
}

export const DocumentWorkspace: React.FC<Props> = ({
  selectedDocument,
  onSelectDocument,
  onStartExtraction,
  canExtract,
  isExtracting,
}) => {
  const [customFileNotice, setCustomFileNotice] = useState<string | null>(null);
  const [routingMode, setRoutingMode] = useState<'prefer_on_device' | 'only_on_device'>('prefer_on_device');
  const [viewMode, setViewMode] = useState<'canvas' | 'raw'>('canvas');

  useEffect(() => {
    telemetryStore.setDocumentBytesHeld(selectedDocument.fileSizeBytes);
  }, [selectedDocument]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      const customDoc: SyntheticDocument = {
        id: `custom_${Date.now()}`,
        title: file.name,
        filename: file.name,
        mimeType: 'text/plain',
        fileSizeBytes: file.size,
        rawText: content,
        groundTruth: {},
      };
      onSelectDocument(customDoc);
      setCustomFileNotice(`Loaded custom local file "${file.name}" (${file.size} bytes). Stored in browser memory.`);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="airlock-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="step-indicator">2</div>
            <div>
              <h3 className="card-title">Local Document Vault & Hybrid Routing</h3>
              <p className="card-subtitle">
                Document bytes remain strictly isolated on your device. Choose your hybrid execution policy.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="status-pill success">
              <Lock size={12} />
              <span>Locally Held: {selectedDocument.fileSizeBytes.toLocaleString()} bytes</span>
            </div>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="preset-pills-row">
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', alignSelf: 'center' }}>Test Scenarios:</span>
          <button
            type="button"
            className={`btn-preset ${selectedDocument.id === SYNTHETIC_PAYSLIP_CLEAN.id ? 'active' : ''}`}
            onClick={() => {
              setCustomFileNotice(null);
              onSelectDocument(SYNTHETIC_PAYSLIP_CLEAN);
            }}
          >
            Clean Payslip
          </button>
          <button
            type="button"
            className={`btn-preset ${selectedDocument.id === SYNTHETIC_PAYSLIP_HOSTILE.id ? 'active' : ''}`}
            onClick={() => {
              setCustomFileNotice(null);
              onSelectDocument(SYNTHETIC_PAYSLIP_HOSTILE);
            }}
            style={
              selectedDocument.id === SYNTHETIC_PAYSLIP_HOSTILE.id
                ? { borderColor: '#f43f5e', color: '#fda4af' }
                : undefined
            }
          >
            🛡️ Adversarial Injection Test
          </button>
          <button
            type="button"
            className={`btn-preset ${selectedDocument.id === SYNTHETIC_BANK_STATEMENT.id ? 'active' : ''}`}
            onClick={() => {
              setCustomFileNotice(null);
              onSelectDocument(SYNTHETIC_BANK_STATEMENT);
            }}
          >
            Bank Statement
          </button>

          <label className="btn-preset" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
            <Upload size={12} />
            <span>Upload File</span>
            <input type="file" accept=".txt,.json" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {customFileNotice && (
          <div className="alert-box info" style={{ padding: '8px 12px', fontSize: '12px' }}>
            <FileText size={14} />
            <span>{customFileNotice}</span>
          </div>
        )}

        {selectedDocument.containsInjection && (
          <div
            style={{
              background: 'rgba(225, 29, 72, 0.15)',
              border: '1px solid #f43f5e',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#fecdd3',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={15} color="#f43f5e" />
            <span>
              <strong>Security Flag:</strong> Document contains embedded prompt-injection payload.
            </span>
          </div>
        )}

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>DOCUMENT VIEWER</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className={`btn-preset ${viewMode === 'canvas' ? 'active' : ''}`}
              onClick={() => setViewMode('canvas')}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              <Layers size={11} style={{ display: 'inline', marginRight: '4px' }} />
              Redaction Canvas
            </button>
            <button
              type="button"
              className={`btn-preset ${viewMode === 'raw' ? 'active' : ''}`}
              onClick={() => setViewMode('raw')}
              style={{ fontSize: '11px', padding: '4px 10px' }}
            >
              <FileText size={11} style={{ display: 'inline', marginRight: '4px' }} />
              Raw Monospace
            </button>
          </div>
        </div>

        {viewMode === 'canvas' ? (
          <VisualRedactionCanvas
            rawText={selectedDocument.rawText}
            documentTitle={selectedDocument.title}
            approvedSnippets={[]}
            fileSizeBytes={selectedDocument.fileSizeBytes}
          />
        ) : (
          <div className="doc-preview-box">{selectedDocument.rawText}</div>
        )}

        {/* Hybrid Routing Policy Selector */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
              HYBRID INFERENCE ROUTING POLICY
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              Firebase AI Logic <code>InferenceMode</code>
            </span>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: routingMode === 'prefer_on_device' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="routing_policy"
                value="prefer_on_device"
                checked={routingMode === 'prefer_on_device'}
                onChange={() => setRoutingMode('prefer_on_device')}
              />
              <CloudLightning size={14} color="#38bdf8" />
              <span>
                <strong>PREFER_ON_DEVICE (Hackathon Default)</strong> — Runs on Gemini Nano; falls back to Cloud Gemini if unavailable.
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                color: routingMode === 'only_on_device' ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="routing_policy"
                value="only_on_device"
                checked={routingMode === 'only_on_device'}
                onChange={() => setRoutingMode('only_on_device')}
              />
              <Cpu size={14} color="#10b981" />
              <span>
                <strong>ONLY_ON_DEVICE (Strict Air-Gapped)</strong> — Enforces local execution only.
              </span>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-dim)' }}>
            <ShieldCheck size={14} color="var(--color-success)" />
            <span>Local memory buffer active. Zero outbound network requests until approved.</span>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => onStartExtraction(routingMode)}
            disabled={!canExtract || isExtracting}
          >
            <Sparkles size={16} />
            {isExtracting ? 'Extracting with Firebase AI Logic...' : 'Run Hybrid Extraction'}
          </button>
        </div>
      </div>
    </div>
  );
};
