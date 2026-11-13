import { Schema } from 'firebase/ai';

export const extractionResponseSchema = Schema.object({
  properties: {
    found: Schema.boolean({
      description: 'Set to true if the requested information is clearly present in the provided document chunk; false otherwise.',
    }),
    value: Schema.string({
      description: 'The extracted value or answer for the requested field. Empty string if not found.',
    }),
    exactQuote: Schema.string({
      description: 'Verbatim excerpt copied exactly character-for-character from the document proving this value. Empty string if not found.',
    }),
    confidenceScore: Schema.number({
      description: 'Confidence between 0.0 and 1.0 that this value directly satisfies the requested field without ambiguity.',
    }),
  },
  optionalProperties: ['value', 'exactQuote', 'confidenceScore'],
});

export const cloudPlannerResponseSchema = Schema.object({
  properties: {
    isSuspicious: Schema.boolean({
      description: 'Whether the request asks for passwords, PINs, or sensitive credentials.',
    }),
    overAskingFlags: Schema.array({
      items: Schema.string(),
      description: 'List of over-asking warnings detected in the request.',
    }),
    scamRedFlags: Schema.array({
      items: Schema.string(),
      description: 'List of serious fraud or credential harvesting red flags.',
    }),
    tasks: Schema.array({
      items: Schema.object({
        properties: {
          fieldKey: Schema.string(),
          fieldLabel: Schema.string(),
          description: Schema.string(),
          expectedDataType: Schema.string(),
        },
      }),
      description: 'The minimal atomic extraction tasks needed to satisfy legitimate verification.',
    }),
    politeCounterProposal: Schema.string({
      description: 'A polite, professional response offering the minimal attested proof instead of full document access.',
    }),
  },
});

