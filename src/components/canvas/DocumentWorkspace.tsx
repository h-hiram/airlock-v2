import React, { useEffect, useState } from 'react';
import { FileText, Lock, ShieldCheck, Upload, AlertCircle } from 'lucide-react';
import type { SyntheticDocument } from '../../types';
import {
  SYNTHETIC_PAYSLIP_CLEAN,
  SYNTHETIC_PAYSLIP_HOSTILE,
  SYNTHETIC_BANK_STATEMENT,
} from '../../lib/documents/syntheticData';
import { telemetryStore } from '../../lib/network/telemetryStore';

interface Props {
  selectedDocument: SyntheticDocument;
  onSelectDocument: (doc: SyntheticDocument) => void;
  onStartExtraction: () => void;
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
    <div className="airlock-card">
      <div className="card-header">
        <div className="card-title-group">
          <div className="step-indicator">2</div>
          <div>
            <h3 className="card-title">Local Document Vault</h3>
            <p className="card-subtitle">Document bytes are isolated locally. Never uploaded to cloud AI.</p>
          </div>
        </div>

        <div className="status-pill success">
          <Lock size={12} />
          <span>Locally Held: {selectedDocument.fileSizeBytes.toLocaleString()} bytes</span>
        </div>
      </div>

      <div className="preset-pills-row">
        <span style={{ fontSize: '12px', color: 'var(--text-dim)', alignSelf: 'center' }}>Synthetic Sets:</span>
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
        >
          Adversarial Injection
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
        <div className="alert-box danger" style={{ padding: '8px 12px', fontSize: '12px' }}>
          <AlertCircle size={14} />
          <span>Security Test Pack: Document contains an embedded prompt-injection payload.</span>
        </div>
      )}

      <div className="doc-preview-box">
        {selectedDocument.rawText}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-dim)' }}>
          <ShieldCheck size={14} color="var(--color-success)" />
          <span>Document parsed in local memory. 0 outbound network requests.</span>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={onStartExtraction}
          disabled={!canExtract || isExtracting}
        >
          {isExtracting ? 'Extracting On-Device with Nano...' : 'Run On-Device Extraction'}
        </button>
      </div>
    </div>
  );
};

