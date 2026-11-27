import type { AuditReport, ExtractionJob } from '../../types';

interface HeuristicRule {
  pattern: RegExp;
  category: 'scam' | 'over_asking';
  warning: string;
  statutoryReference?: string;
}

const RULES: HeuristicRule[] = [
  {
    pattern: /\b(pin|passcode|otp|one-time\s+password|login\s+password|security\s+code|m-?pesa\s+pin)\b/i,
    category: 'scam',
    warning: 'CRITICAL SECURITY ALERT: Requester is demanding private security authentication credentials (PIN / OTP / Password). Legitimate counterparties never require access credentials.',
    statutoryReference: 'Cybercrime & Computer Misuse Act / Global Banking Security Standards',
  },
  {
    pattern: /\b(phone\s+contacts|contact\s+book|call\s+logs|sms\s+inbox|access\s+contacts)\b/i,
    category: 'over_asking',
    warning: 'DATA HARVESTING DETECTED: Loan apps demanding contact books or call logs violate the statutory Data Minimisation Principle. Qualification requires only income proof.',
    statutoryReference: 'Kenya Data Protection Act 2019 (Section 3) & GDPR Art. 5(1)(c): Data Minimisation Principle',
  },
  {
    pattern: /\b(online\s+banking\s+login|bank\s+password|routing\s+credentials)\b/i,
    category: 'scam',
    warning: 'CRITICAL SECURITY ALERT: Request demands online banking authentication credentials.',
  },
  {
    pattern: /\b(full\s+social\s+security|full\s+ssn|unredacted\s+id\s+photo|front\s+and\s+back\s+id|raw\s+national\s+id)\b/i,
    category: 'over_asking',
    warning: 'IDENTITY OVER-DISCLOSURE RISK: Request demands unredacted government identification cards or raw identity photos. Selective disclosure of name and birthdate is sufficient.',
    statutoryReference: 'Kenya Data Protection Act 2019 / International Identity Privacy Guidelines',
  },
  {
    pattern: /\b(full\s+(90|60|180|all)\s+day|all\s+transactions|complete\s+bank\s+statement|entire\s+statement|6-?months?\s+m-?pesa\s+statement)\b/i,
    category: 'over_asking',
    warning: 'OVER-ASKING DETECTED: Demanding itemized 6-month transaction histories exposes private medical payments, family remittances, and loans. Qualification requires only net inflow proof.',
    statutoryReference: 'Principle of Data Minimisation: Processing must be strictly limited to what is necessary.',
  },
];

export function runHeuristicAudit(requestText: string): AuditReport {
  const scamFlags: string[] = [];
  const overAskingFlags: string[] = [];
  let kdpaNote: string | undefined;

  for (const rule of RULES) {
    if (rule.pattern.test(requestText)) {
      if (rule.category === 'scam') {
        scamFlags.push(rule.warning);
      } else {
        overAskingFlags.push(rule.warning);
      }
      if (rule.statutoryReference) {
        kdpaNote = rule.statutoryReference;
      }
    }
  }

  const isSuspicious = scamFlags.length > 0;
  const recommendedMinimalFields: ExtractionJob[] = [];
  const lower = requestText.toLowerCase();

  // Kenyan M-Pesa / Mobile Money statement flow
  if (lower.includes('m-pesa') || lower.includes('mpesa') || lower.includes('kes') || lower.includes('ksh') || lower.includes('inflow')) {
    recommendedMinimalFields.push({
      fieldKey: 'primary_inflow',
      fieldLabel: 'Average Monthly Inflow',
      description: 'Recurring monthly mobile money or payroll credits received.',
      expectedDataType: 'string',
      sensitiveDecoy: false,
      predicate: {
        kind: 'amount_at_least',
        fieldKey: 'primary_inflow',
        fieldLabel: 'Average Monthly Inflow',
        threshold: 75000,
        currency: 'KES',
        humanRequirement: 'Average monthly inflow >= KES 75,000',
      },
    });

    recommendedMinimalFields.push({
      fieldKey: 'account_holder',
      fieldLabel: 'Verified Account Holder Name',
      description: 'Documented identity of the primary account or wallet owner.',
      expectedDataType: 'string',
      sensitiveDecoy: false,
    });
  } else {
    // Standard international employment flow
    if (lower.includes('salary') || lower.includes('income') || lower.includes('earnings') || lower.includes('pay') || lower.includes('mshahara')) {
      const hasThreshold = lower.includes('at least') || lower.includes('5,000') || lower.includes('5000') || lower.includes('minimum');
      recommendedMinimalFields.push({
        fieldKey: 'net_monthly_pay',
        fieldLabel: 'Net Monthly Income',
        description: 'The take-home net earnings disbursed to the employee for the most recent period.',
        expectedDataType: 'string',
        sensitiveDecoy: false,
        predicate: hasThreshold
          ? {
              kind: 'amount_at_least',
              fieldKey: 'net_monthly_pay',
              fieldLabel: 'Net Monthly Income',
              threshold: 5000,
              currency: 'USD',
              humanRequirement: 'Net monthly income >= $5,000',
            }
          : undefined,
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
        predicate: lower.includes('6 months')
          ? {
              kind: 'tenure_at_least_months',
              fieldKey: 'employment_start_date',
              fieldLabel: 'Employment Tenure',
              months: 6,
              humanRequirement: 'Employment tenure >= 6 months',
            }
          : undefined,
      });
    }
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
    ? 'SECURITY NOTICE: I cannot provide banking credentials, PIN codes, or unredacted account access. Under statutory data minimisation standards, I have provided verified cryptographic proof of my recurring income and employer tenure through Airlock selective disclosure.'
    : overAskingFlags.length > 0
    ? 'To prevent over-exposure of private transaction histories and comply with the Data Protection Act (Data Minimisation Principle), I have prepared a minimal verification sheet confirming my verified income threshold and account attestation via Airlock selective disclosure.'
    : 'Please find attached the certified answers to your requested verification points, extracted with verbatim page citations via Airlock selective disclosure.';

  return {
    isSuspicious,
    scamRedFlags: scamFlags,
    overAskingFlags,
    recommendedMinimalFields,
    politeCounterProposal: counterProposal,
    kdpaViolationNote: kdpaNote,
  };
}
