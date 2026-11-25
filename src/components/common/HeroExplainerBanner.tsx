import React from 'react';
import { Shield, ShieldAlert } from 'lucide-react';
import type { SyntheticDocument, VerificationRequest } from '../../types';
import {
  SYNTHETIC_PAYSLIP_CLEAN,
  SYNTHETIC_PAYSLIP_HOSTILE,
  SYNTHETIC_MPESA_STATEMENT,
  SYNTHETIC_BANK_STATEMENT,
  SAMPLE_VERIFICATION_REQUESTS,
} from '../../lib/documents/syntheticData';

interface Props {
  onSelectScenario: (req: VerificationRequest, doc: SyntheticDocument) => void;
  activeScenarioId?: string;
  onOpenScoreboard?: () => void;
}

export const HeroExplainerBanner: React.FC<Props> = ({ onSelectScenario, activeScenarioId, onOpenScoreboard }) => {
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
          🏢 1. Global Tenancy (Clean)
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
          onClick={() => onSelectScenario(SAMPLE_VERIFICATION_REQUESTS[1], SYNTHETIC_MPESA_STATEMENT)}
          className={`btn-preset ${activeScenarioId === 'nairobi_tenancy' ? 'active' : ''}`}
          style={{
            fontSize: '12px',
            padding: '5px 12px',
            borderColor: activeScenarioId === 'nairobi_tenancy' ? '#10b981' : undefined,
            color: activeScenarioId === 'nairobi_tenancy' ? '#6ee7b7' : undefined,
          }}
        >
          🇰🇪 3. Nairobi Tenancy (M-Pesa)
        </button>

        <button
          type="button"
          onClick={() => onSelectScenario(SAMPLE_VERIFICATION_REQUESTS[2], SYNTHETIC_BANK_STATEMENT)}
          className={`btn-preset ${activeScenarioId === 'scam_loan' ? 'active' : ''}`}
          style={{
            fontSize: '12px',
            padding: '5px 12px',
            borderColor: activeScenarioId === 'scam_loan' ? '#f59e0b' : undefined,
            color: activeScenarioId === 'scam_loan' ? '#fde68a' : undefined,
          }}
        >
          🛡️ 4. Phishing Loan App (KDPA §3)
        </button>

        {onOpenScoreboard && (
          <button
            type="button"
            onClick={onOpenScoreboard}
            className="btn-preset"
            style={{
              fontSize: '12px',
              padding: '5px 12px',
              borderColor: '#38bdf8',
              color: '#38bdf8',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <ShieldAlert size={12} />
            <span>Run Security Battery</span>
          </button>
        )}
      </div>
    </div>
  );
};
