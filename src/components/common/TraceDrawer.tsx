import React, { useEffect, useState } from 'react';
import { Terminal, Cpu, Cloud, ChevronDown, ChevronRight, Zap } from 'lucide-react';
import type { ExecutionTrace } from '../../types';
import { traceStore } from '../../lib/ai/traceStore';

export const TraceDrawer: React.FC = () => {
  const [traces, setTraces] = useState<ExecutionTrace[]>(traceStore.getTraces());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = traceStore.subscribe(() => {
      setTraces(traceStore.getTraces());
    });
    return unsub;
  }, []);

  if (traces.length === 0) {
    return null;
  }

  const latest = traces[0];

  return (
    <div
      style={{
        background: '#090a0f',
        border: '1px solid #1f2430',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={16} color="#38bdf8" />
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', letterSpacing: '0.3px' }}>
            Live Model Execution Trace & Prompt Inspector
          </h4>
        </div>
        <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
          {traces.length} {traces.length === 1 ? 'Invocation' : 'Invocations'} Recorded
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
        {traces.map((trace) => {
          const isExpanded = expandedId === trace.id || (expandedId === null && trace.id === latest.id);
          const isCloud = trace.tier === 'cloud_gemini';
          const isNano = trace.tier === 'on_device_nano';

          return (
            <div
              key={trace.id}
              style={{
                background: '#11131a',
                border: '1px solid #232838',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                onClick={() => setExpandedId(isExpanded ? '' : trace.id)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isExpanded ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{trace.stepName}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    className="status-pill"
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      background: isCloud ? 'rgba(59, 130, 246, 0.15)' : isNano ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      color: isCloud ? '#93c5fd' : isNano ? '#6ee7b7' : '#cbd5e1',
                      border: 'none',
                    }}
                  >
                    {isCloud ? <Cloud size={10} /> : <Cpu size={10} />}
                    {trace.modelIdentifier}
                  </span>

                  <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                    <Zap size={10} style={{ display: 'inline', marginRight: '2px' }} />
                    {trace.latencyMs}ms
                  </span>

                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: trace.networkBytesTransmitted === 0 ? 'var(--color-success)' : 'var(--color-warning)',
                    }}
                  >
                    {trace.networkBytesTransmitted === 0 ? '0 B (On-Device)' : `${trace.networkBytesTransmitted} B sent`}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Exact Prompt Dispatched:
                    </span>
                    <pre
                      style={{
                        background: '#090a0d',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        whiteSpace: 'pre-wrap',
                        color: '#94a3b8',
                        marginTop: '3px',
                        maxHeight: '120px',
                        overflowY: 'auto',
                      }}
                    >
                      {trace.promptSent}
                    </pre>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                      Raw Model Response:
                    </span>
                    <pre
                      style={{
                        background: '#090a0d',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        whiteSpace: 'pre-wrap',
                        color: isNano ? '#6ee7b7' : isCloud ? '#93c5fd' : '#f1f5f9',
                        marginTop: '3px',
                        maxHeight: '140px',
                        overflowY: 'auto',
                      }}
                    >
                      {trace.rawResponseText}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

