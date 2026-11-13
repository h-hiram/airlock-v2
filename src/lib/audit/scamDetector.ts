import type { AuditReport, ExtractionJob } from '../../types';

interface HeuristicRule {
  pattern: RegExp;
  category: 'scam' | 'over_asking';
  warning: string;
}

const RULES: HeuristicRule[] = [
  {
    pattern: /\b(pin|passcode|otp|one-time\s+password|login\s+password|security\s+code)\b/i,
    category: 'scam',
    warning: 'CRITICAL SECURITY ALERT: Requester is asking for private security credentials (PIN / OTP / Password). Legitimate verifiers never require access credentials.',
  },
  {
    pattern: /\b(online\s+banking\s+login|bank\s+password|routing\s+credentials)\b/i,
    category: 'scam',
    warning: 'CRITICAL SECURITY ALERT: Request demands online banking authentication credentials.',
  },
  {
    pattern: /\b(full\s+social\s+security|full\s+ssn|unredacted\s+id\s+photo|front\s+and\s+back\s+id)\b/i,
    category: 'scam',
    warning: 'IDENTITY THEFT RISK: Request demands unredacted government identification numbers or raw identity card photos.',
  },
  {
    pattern: /\b(full\s+(90|60|180|all)\s+day|all\s+transactions|complete\s+bank\s+statement|entire\s+statement)\b/i,
    category: 'over_asking',
    warning: 'OVER-ASKING DETECTED: Requester is demanding itemized transaction histories. Standard qualification only requires net monthly income and employer attestation.',
  },
];

export function runHeuristicAudit(requestText: string): AuditReport {
  const scamFlags: string[] = [];
  const overAskingFlags: string[] = [];

  for (const rule of RULES) {
    if (rule.pattern.test(requestText)) {
      if (rule.category === 'scam') {
        scamFlags.push(rule.warning);
      } else {
        overAskingFlags.push(rule.warning);
      }
    }
  }

  const isSuspicious = scamFlags.length > 0;

  const recommendedMinimalFields: ExtractionJob[] = [];

  const lower = requestText.toLowerCase();

  if (lower.includes('salary') || lower.includes('income') || lower.includes('earnings') || lower.includes('pay') || lower.includes('mshahara')) {
    recommendedMinimalFields.push({
      fieldKey: 'net_monthly_pay',
      fieldLabel: 'Net Monthly Income',
      description: 'The take-home net earnings disbursed to the employee for the most recent period.',
      expectedDataType: 'string',
      sensitiveDecoy: false,
    });
  }

  if (lower.includes('employer') || lower.includes('company') || lower.includes('organization') || lower.includes('mwajiri')) {
    recommendedMinimalFields.push({
      fieldKey: 'employer_name',
      fieldLabel: 'Employer / Organization Name',
      description: 'The formal corporate name of the employing entity.',
      expectedDataType: 'string',
      sensitiveDecoy: false,
    });
  }

  if (lower.includes('start date') || lower.includes('tenure') || lower.includes('period') || lower.includes('kuanza')) {
    recommendedMinimalFields.push({
      fieldKey: 'employment_start_date',
      fieldLabel: 'Employment Start Date / Tenure',
      description: 'The documented start date or official tenure duration.',
      expectedDataType: 'string',
      sensitiveDecoy: false,
    });
  }

  if (recommendedMinimalFields.length === 0) {
    recommendedMinimalFields.push(
      {
        fieldKey: 'net_monthly_pay',
        fieldLabel: 'Net Monthly Income',
        description: 'Take-home monthly remuneration',
        expectedDataType: 'string',
        sensitiveDecoy: false,
      },
      {
        fieldKey: 'employer_name',
        fieldLabel: 'Employer Name',
        description: 'Employing entity name',
        expectedDataType: 'string',
        sensitiveDecoy: false,
      }
    );
  }

  const counterProposal = isSuspicious
    ? 'SECURITY NOTICE: I cannot provide banking credentials, one-time passwords, or unredacted account access. I can provide tamper-evident, cryptographic proof of my verified net monthly earnings and employer tenure via Airlock selective disclosure.'
    : overAskingFlags.length > 0
    ? 'To protect financial privacy and prevent over-exposure of unrequested transaction histories, I have prepared a minimal verification sheet confirming my employer tenure and verified net monthly income through Airlock selective disclosure.'
    : 'Please find attached the certified answers to your requested verification points, extracted with verbatim page citations via Airlock selective disclosure.';

  return {
    isSuspicious,
    scamRedFlags: scamFlags,
    overAskingFlags,
    recommendedMinimalFields,
    politeCounterProposal: counterProposal,
  };
}

