import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Trash2 } from 'lucide-react';
import type { NetworkTelemetryEntry } from '../../types';
import { telemetryStore } from '../../lib/network/telemetryStore';

export const NetworkTapLog: React.FC = () => {
  const [entries, setEntries] = useState<NetworkTelemetryEntry[]>(telemetryStore.getEntries());
  const [docBytesHeld, setDocBytesHeld] = useState(telemetryStore.getDocumentBytesHeld());
  const [disclosedBytes, setDisclosedBytes] = useState(telemetryStore.getDisclosedSnippetBytes());

  useEffect(() => {
    const unsubscribe = telemetryStore.subscribe(() => {
      setEntries(telemetryStore.getEntries());
      setDocBytesHeld(telemetryStore.getDocumentBytesHeld());
      setDisclosedBytes(telemetryStore.getDisclosedSnippetBytes());
    });
    return unsubscribe;
  }, []);

  const totalSent = entries.reduce((acc, curr) => acc + curr.requestBytes, 0);
  const sealedPercent =
    docBytesHeld > 0 ? (((docBytesHeld - disclosedBytes) / docBytesHeld) * 100).toFixed(2) : '100.00';
  const docDisclosureRatio =
    docBytesHeld > 0 ? ((disclosedBytes / docBytesHeld) * 100).toFixed(2) : '0.00';

  return (
    <div className="network-tap-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} color="var(--color-accent)" />
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
            Live Network Tap (window.fetch Interceptor)
          </h4>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="status-pill success" style={{ fontSize: '11px' }}>
            <ShieldCheck size={12} />
            <span>{sealedPercent}% of Source Document Sealed Locally</span>
          </div>

          <button
            type="button"
            className="btn-preset"
            onClick={() => telemetryStore.clear()}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Trash2 size={12} />
            <span>Clear Log</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)' }}>
          Document Held in Browser: <strong style={{ color: '#fff' }}>{docBytesHeld.toLocaleString()} bytes</strong>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          Approved Snippets Disclosed: <strong style={{ color: 'var(--color-success)' }}>{disclosedBytes} bytes ({docDisclosureRatio}%)</strong>
        </span>
        <span style={{ color: 'var(--text-muted)' }}>
          Protocol Prompt Overhead: <strong style={{ color: 'var(--color-accent)' }}>{totalSent.toLocaleString()} bytes</strong>
        </span>
      </div>

      {entries.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', padding: '12px 0' }}>
          No outbound network requests recorded yet. All document parsing and local extraction remain isolated inside browser memory.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', maxHeight: '180px' }}>
          <table className="tap-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Destination Endpoint</th>
                <th>Tier</th>
                <th>Request Bytes</th>
                <th>Response Bytes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{new Date(entry.timestamp).toLocaleTimeString()}</td>
                  <td>
                    <span style={{ color: 'var(--color-accent)' }}>{entry.method}</span>
                  </td>
                  <td style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.url}>
                    {entry.url}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: entry.tier === 'cloud_ai' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: entry.tier === 'cloud_ai' ? '#93c5fd' : '#6ee7b7',
                        fontSize: '11px',
                      }}
                    >
                      {entry.tier}
                    </span>
                  </td>
                  <td style={{ color: entry.requestBytes > 0 ? 'var(--color-warning)' : 'var(--text-dim)' }}>
                    {entry.requestBytes.toLocaleString()} B
                  </td>
                  <td>{entry.responseBytes.toLocaleString()} B</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
