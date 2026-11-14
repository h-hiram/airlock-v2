import React, { useState } from 'react';
import { Settings, X, Save, RefreshCw, Key, CheckCircle, Info } from 'lucide-react';
import { saveCustomFirebaseConfig, getFirebaseStatus } from '../../lib/ai/client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

export const ConfigModal: React.FC<Props> = ({ isOpen, onClose, onConfigUpdated }) => {
  const status = getFirebaseStatus();

  const [apiKey, setApiKey] = useState(() => {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem('airlock_firebase_config');
    if (stored) {
      try {
        return JSON.parse(stored).apiKey || '';
      } catch {
        return '';
      }
    }
    return import.meta.env.VITE_FIREBASE_API_KEY || '';
  });

  const [projectId, setProjectId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem('airlock_firebase_config');
    if (stored) {
      try {
        return JSON.parse(stored).projectId || '';
      } catch {
        return '';
      }
    }
    return import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
  });

  const [appId, setAppId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem('airlock_firebase_config');
    if (stored) {
      try {
        return JSON.parse(stored).appId || '';
      } catch {
        return '';
      }
    }
    return import.meta.env.VITE_FIREBASE_APP_ID || '';
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim() && projectId.trim() && appId.trim()) {
      saveCustomFirebaseConfig({
        apiKey: apiKey.trim(),
        projectId: projectId.trim(),
        appId: appId.trim(),
        debugToken: 'true',
      });
    } else {
      saveCustomFirebaseConfig(null);
    }
    setSavedSuccess(true);
    onConfigUpdated();
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
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
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="airlock-card"
        style={{
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#10131a',
          border: '1px solid #2d3345',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={20} color="#38bdf8" />
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff' }}>
              Firebase & Gemini AI Settings
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="alert-box info" style={{ fontSize: '12px', lineHeight: '1.4' }}>
          <Info size={16} style={{ flexShrink: 0 }} />
          <div>
            Configure your Firebase Web Project credentials here to enable live Cloud Gemini calls via{' '}
            <code>firebase/ai</code>. If left empty, Airlock operates in deterministic local simulation mode.
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Firebase Web API Key (apiKey)
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              style={{
                width: '100%',
                background: '#090a0f',
                border: '1px solid #282e3f',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Firebase Project ID (projectId)
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="airlock-production"
              style={{
                width: '100%',
                background: '#090a0f',
                border: '1px solid #282e3f',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Firebase Web App ID (appId)
            </label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="1:123456789:web:abcdef..."
              style={{
                width: '100%',
                background: '#090a0f',
                border: '1px solid #282e3f',
                borderRadius: '6px',
                padding: '8px 12px',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'var(--font-mono)',
              }}
            />
          </div>

          <div style={{ background: '#090a0d', border: '1px solid #1f2432', borderRadius: '8px', padding: '12px' }}>
            <h5 style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', marginBottom: '6px' }}>
              Enabling Gemini Nano on Chrome Desktop (Mac):
            </h5>
            <ol style={{ fontSize: '12px', color: '#94a3b8', paddingLeft: '18px', lineHeight: '1.6' }}>
              <li>Open <code>chrome://flags/#prompt-api-for-gemini-nano-multimodal-input</code> and select <strong>Enabled</strong>.</li>
              <li>Open <code>chrome://flags/#optimization-guide-on-device-model</code> and select <strong>Enabled BypassPerfRequirement</strong>.</li>
              <li>Relaunch Chrome and visit <code>chrome://on-device-internals</code> to verify model download.</li>
            </ol>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <div style={{ fontSize: '12px', color: status.isConfigured ? 'var(--color-success)' : '#64748b' }}>
              Status: {status.isConfigured ? 'Active Credentials Connected' : 'Unconfigured (Local Mode)'}
            </div>

            <button type="submit" className="btn-primary" style={{ padding: '8px 18px' }}>
              {savedSuccess ? (
                <>
                  <CheckCircle size={14} /> Saved!
                </>
              ) : (
                <>
                  <Save size={14} /> Save & Apply
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

