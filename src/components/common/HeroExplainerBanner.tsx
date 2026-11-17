import React from 'react';
import { Shield, Sparkles } from 'lucide-react';
import type { SyntheticDocument, VerificationRequest } from '../../types';
import {
  SYNTHETIC_PAYSLIP_CLEAN,
  SYNTHETIC_PAYSLIP_HOSTILE,
  SYNTHETIC_BANK_STATEMENT,
  SAMPLE_VERIFICATION_REQUESTS,
} from '../../lib/documents/syntheticData';

interface Props {
  onSelectScenario: (req: VerificationRequest, doc: SyntheticDocument) => void;
  activeScenarioId?: string;
}

export const HeroExplainerBanner: React.FC<Props> = ({ onSelectScenario, activeScenarioId }) => {
  return (
    <div
      style={{
        background: '#090e1a',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        padding: '10px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 10px #10b981',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={14} color="#38bdf8" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.5px' }}>
            AIR-GAP TEST SUITE:
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => onSelectScenario(SAMPLE_VERIFICATION_REQUESTS[0], SYNTHETIC_PAYSLIP_CLEAN)}
          className={`btn-preset ${activeScenarioId === 'clean_payslip' ? 'active' : ''}`}
          style={{ fontSize: '12px', padding: '5px 12px' }}
        >
          🏢 1. Clean Tenancy Application
        </button>

        <button
          type="button"
          onClick={() => onSelectScenario(SAMPLE_VERIFICATION_REQUESTS[0], SYNTHETIC_PAYSLIP_HOSTILE)}
          className={`btn-preset ${activeScenarioId === 'hostile_payslip' ? 'active' : ''}`}
          style={{
            fontSize: '12px',
            padding: '5px 12px',
            borderColor: activeScenarioId === 'hostile_payslip' ? '#f43f5e' : undefined,
            color: activeScenarioId === 'hostile_payslip' ? '#fda4af' : undefined,
          }}
        >
          🚨 2. Prompt-Injection Attack Test
        </button>

        <button
          type="button"
          onClick={() => onSelectScenario(SAMPLE_VERIFICATION_REQUESTS[1], SYNTHETIC_BANK_STATEMENT)}
          className={`btn-preset ${activeScenarioId === 'scam_bank' ? 'active' : ''}`}
          style={{
            fontSize: '12px',
            padding: '5px 12px',
            borderColor: activeScenarioId === 'scam_bank' ? '#f59e0b' : undefined,
            color: activeScenarioId === 'scam_bank' ? '#fde68a' : undefined,
          }}
        >
          ⚠️ 3. Scam & Phishing Over-Asking
        </button>
      </div>
    </div>
  );
};
