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
  SYNTHETIC_MPESA_STATEMENT,
  SYNTHETIC_BANK_STATEMENT,
} from '../../lib/documents/syntheticData';
import { telemetryStore } from '../../lib/network/telemetryStore';
import { VisualRedactionCanvas } from './VisualRedactionCanvas';
import { extractTextFromPdf } from '../../lib/documents/pdfExtractor';

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
  const [routingMode, setRoutingMode] = useState<'prefer_on_device' | 'only_on_device'>('only_on_device');
  const [viewMode, setViewMode] = useState<'canvas' | 'raw'>('canvas');

  useEffect(() => {
    telemetryStore.setDocumentBytesHeld(selectedDocument.fileSizeBytes);
    telemetryStore.setActiveCanaries(selectedDocument.canaryTokens || []);
  }, [selectedDocument]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        if (!buffer) return;
        try {
          const res = await extractTextFromPdf(buffer, file.name);
          const customDoc: SyntheticDocument = {
            id: `custom_${Date.now()}`,
            title: file.name,
            filename: file.name,
            mimeType: 'application/pdf',
            fileSizeBytes: file.size,
            rawText: res.fullText,
            totalPages: res.totalPages,
            groundTruth: {},
          };
          onSelectDocument(customDoc);
          setCustomFileNotice(
            `Air-gapped PDF loaded: "${file.name}" (${file.size.toLocaleString()} bytes, ${res.totalPages} page${res.totalPages > 1 ? 's' : ''}). ${res.isScannedOnly ? 'Scanned PDF (no embedded text layer).' : 'Text layer extracted locally.'}`
          );
        } catch (err) {
          console.error('PDF extraction failed:', err);
          setCustomFileNotice(`Failed to parse PDF text: ${String(err)}`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = String(event.target?.result || '');
        const customDoc: SyntheticDocument = {
          id: `custom_${Date.now()}`,
          title: file.name,
          filename: file.name,
          mimeType: file.type as 'image/png' | 'image/jpeg',
          fileSizeBytes: file.size,
          rawText: `[Local Photo/Receipt: ${file.name}]\nFile Size: ${file.size} bytes\nFormat: ${file.type}\nStatus: Loaded in browser memory. Ready for on-device visual analysis.`,
          imageUrl: dataUrl,
          groundTruth: {},
        };
        onSelectDocument(customDoc);
        setCustomFileNotice(`Local photo loaded: "${file.name}" (${file.size.toLocaleString()} bytes). Held strictly on device.`);
      };
      reader.readAsDataURL(file);
    } else {
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
        setCustomFileNotice(`Loaded custom local file "${file.name}" (${file.size.toLocaleString()} bytes). Stored in browser memory.`);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="airlock-card">
        <div className="card-header">
          <div className="card-title-group">
            <div className="step-indicator">2</div>
            <div>
              <h3 className="card-title">Local Document Vault & Air-Gapped Extraction</h3>
              <p className="card-subtitle">
                Document bytes remain strictly isolated in browser memory. Extracted locally via Gemini Nano.
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
            Adversarial Injection
          </button>
          <button
            type="button"
            className={`btn-preset ${selectedDocument.id === SYNTHETIC_MPESA_STATEMENT.id ? 'active' : ''}`}
            onClick={() => {
              setCustomFileNotice(null);
              onSelectDocument(SYNTHETIC_MPESA_STATEMENT);
            }}
            style={
              selectedDocument.id === SYNTHETIC_MPESA_STATEMENT.id
                ? { borderColor: '#10b981', color: '#6ee7b7' }
                : undefined
            }
          >
            Nairobi M-Pesa Statement
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
            <span>Upload PDF / Photo / Text</span>
            <input type="file" accept=".pdf,.txt,.json,image/png,image/jpeg" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {customFileNotice && (
          <div className="alert-box info" style={{ padding: '8px 12px', fontSize: '12px' }}>
            <FileText size={14} />
            <span>{customFileNotice}</span>
          </div>
        )}

        {selectedDocument.imageUrl && (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', alignSelf: 'flex-start' }}>
              <strong>Local Photo / Receipt Preview (In-Memory Buffer)</strong>
            </div>
            <img
              src={selectedDocument.imageUrl}
              alt="Uploaded document scan"
              style={{
                maxHeight: '260px',
                maxWidth: '100%',
                borderRadius: '6px',
                objectFit: 'contain',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            />
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
                <strong>ONLY_ON_DEVICE (Airlock Default)</strong>: Strict Air-Gap. Raw document bytes never leave the browser sandbox.
              </span>
            </label>

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
                <strong>PREFER_ON_DEVICE (Cloud Fallback)</strong>: Uses Nano; permits cloud fallback only if device model is missing.
              </span>
            </label>
          </div>

          {routingMode === 'prefer_on_device' && (
            <div style={{ fontSize: '11px', color: '#fde68a', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 10px', borderRadius: '4px' }}>
              <strong>Air-Gap Notice:</strong> In PREFER_ON_DEVICE mode, if Chrome Gemini Nano is unavailable on your hardware, extraction will fallback to Cloud Gemini. Choose ONLY_ON_DEVICE to guarantee raw text never touches the network.
            </div>
          )}
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
            {isExtracting ? 'Extracting with Firebase AI Logic...' : 'Run On-Device Extraction'}
          </button>
        </div>
      </div>
    </div>
  );
};
