# Airlock v2: Selective Disclosure Engine

> **Tagline:** *Answer only what's asked. Reveal nothing else.*  
> **Target Event:** Google Firebase **#BuildHybridAI** Hackathon  
> **Core Architecture:** Firebase AI Logic Hybrid Inference Web SDK (`firebase/ai` + Chrome Gemini Nano + Cloud Gemini 2.5 Flash)

---

## 1. Executive Summary & Value Proposition

In modern digital verification, individuals are routinely coerced into uploading multi-page, unredacted documents—such as annual tax returns, 6-month bank ledgers, medical records, or employment contracts—to prove simple atomic facts (e.g., net monthly pay $\ge \$5,000$, current employer, or tenancy stability). This practice causes catastrophic personal data over-exposure, exposing sensitive account numbers, tax identification pins, itemized spending histories, and physical addresses.

**Airlock v2 flips the traditional document inspection paradigm upside down:**
Instead of sending your documents to an auditor, **the auditor's questions drive local extraction on your device**. 

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             THE AIRLOCK PARADIGM                            │
│                                                                             │
│  [Requester's Questions]                                                    │
│           │                                                                 │
│           ▼                                                                 │
│   Cloud Gemini Flash        ◄── Blind Planning: Reads questions ONLY.       │
│   (ONLY_IN_CLOUD)               Audits for over-asking & scam red flags.    │
│           │                     Plans atomic extraction schemas.            │
│           │                     Never sees your raw files.                  │
│           ▼ Structured Tasks & Predicates                                   │
│   On-Device Gemini Nano     ◄── Private Extraction: Runs locally in Chrome. │
│   (ONLY_ON_DEVICE)              Never uploads document bytes.               │
│           │                                                                 │
│           ▼ Extracted Snippets & Predicates                                 │
│   Grounding Gate            ◄── Deterministic Verification: Verifies quotes │
│   (Local JavaScript)            match source text & neutralizes injections. │
│           │                                                                 │
│           ▼                                                                 │
│   Human Approval Screen     ◄── User in Full Control: Approve or omit.      │
│           │                                                                 │
│           ▼ Approved Snippets / Derived Claims ONLY                         │
│   Cloud Gemini Flash        ◄── Synthesis: Composes formal answer sheet.    │
│   (ONLY_IN_CLOUD)               Transmits ~100 bytes instead of 2 MB.       │
│           │                                                                 │
│           ▼                                                                 │
│   Disclosure Receipt        ◄── Live Proof: Network tap, Canary Leak test,  │
│                                 & Salted SHA-256 Commitments.               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Key Defenses & Architectural Pillars

### A. Strict Air-Gapped `ONLY_ON_DEVICE` Extraction
- **Rule Compliance:** 100% of AI inference routes through `@firebase/ai` (`getGenerativeModel`, `InferenceMode`). No direct Prompt API calls during extraction.
- **Air-Gap Guarantee:** `InferenceMode.ONLY_ON_DEVICE` is strictly the default. Raw document bytes never leave the browser sandbox.

### B. Derived Claims Engine (Zero-Leakage Predicates)
Evaluates conditions locally on-device without exposing underlying numbers:
- `amount_at_least`: Proves salary $\ge \$5,000$ or M-Pesa inflow $\ge \text{KES } 75,000$ with an attested `YES/NO` result.
- `amount_between`: Verifies income within an acceptable bracket without leaking exact pay.
- `tenure_at_least_months`: Verifies employment stability with day-precision calendar calculations while keeping hire date private.
- `text_equals`: Verifies corporate identity with legal entity suffix stripping (`Ltd`, `LLC`, `Corp`).
- **Verifiable Local Openings:** The prover's browser generates a local-only salt and opening commitment (`$sha256$<hash>`). The salt never leaves the device during disclosure, preventing dictionary and rainbow-table attacks.
- **Safe 3-State Logic:** Quarantined, ungrounded, or currency-mismatched candidates yield `null` rather than asserting false facts.

### C. ProbeGuard Anti-Probing Defense
Detects adversaries who issue repeated queries with varying thresholds (e.g., "income $\ge \$4,000$", then "$\ge \$5,000$", then "$\ge \$6,000$") to binary-search and triangulate the user's exact salary.
- Tracks counterparty query histories in `localStorage`.
- Automatically blocks queries and alerts the user upon detection of $\ge 4$ distinct thresholds.

### D. Live Network Tap & Canary Leak Scanner
Synthetic documents are seeded with sealed canary tokens (`CANARY-TID-98201`, `CANARY-ACC-77124`, `CANARY-MSISDN-254712`).
- The network tap inspects request bodies (JSON, URLSearchParams, ArrayBuffer) of every outbound `fetch` call.
- Generates certified proof: **0 of N Planted Canaries Leaked (100% Contained)**.

### E. Real Document Ingestion (PDF & Photo OCR)
- **Air-Gapped PDF Extractor:** Pure client-side PDF text extraction using Web Streams and `DecompressionStream('deflate')` for FlateDecode streams. Real `.pdf` bank statements and payslips can be dropped directly into the browser without third-party servers.
- **Mobile Photo / Receipt Ingestion:** Allows loading local photos and scans into browser memory for on-device visual analysis.

### F. Kenyan Tenancy & Digital Lending Scenarios (KDPA 2019 §3)
- **Nairobi Tenancy Preset:** 6-Month SafariCom M-Pesa statement verifying monthly inflow $\ge \text{KES } 75,000$ while withholding sensitive medical transactions, remittances, and Fuliza overdrafts.
- **Rogue Digital Loan App Phishing Defense:** Detects demands for phone contacts, call logs, and M-Pesa PINs, citing statutory violations under Section 3 of the Kenya Data Protection Act 2019 and GDPR Art. 5(1)(c) Data Minimisation Principle.

### G. Interactive Adversarial Defense Scoreboard
A built-in security battery in the UI that runs 6 live adversarial tests:
1. Prompt Injection Shield (neutralizes `[SYSTEM OVERRIDE...]` directives)
2. Citation Grounding Gate (quarantines hallucinated values)
3. ProbeGuard Rate-Limiting (blocks binary-search threshold triangulation)
4. Network Tap Canary Containment (guarantees 0 canary token leaks)
5. Salted SHA-256 Commitments (rejects bit-flipped forged claims)
6. Statutory Data Minimization (flags KDPA §3 phishing asks)

### H. 1-Click Cryptographic Revocation & Privacy Tombstoning
When a user revokes an attested verification link, both remote Cloud Firestore and local browser storage permanently zero out all snippets, cover letters, and claims, leaving only an immutable cryptographic tombstone for audit history.

---

## 3. Chrome Gemini Nano Setup Guide

To run on-device inference using Chrome's built-in Gemini Nano model:

### Step 1: Requirements
- **Google Chrome** (Version 128+ Canary/Dev or 138+ Stable on macOS, Windows, or Linux).
- At least 22 GB of free disk space for the on-device model weights.
- GPU with at least 4 GB VRAM or modern integrated CPU.

### Step 2: Enable Chrome Flags
Navigate to `chrome://flags` in your Chrome browser and enable:
1. `chrome://flags/#prompt-api-for-gemini-nano` -> Set to **Enabled**.
2. `chrome://flags/#optimization-guide-on-device-model` -> Set to **Enabled BypassPerfRequirement**.

### Step 3: Download Model Weights
1. Navigate to `chrome://components`.
2. Locate **Optimization Guide On Device Model**.
3. Click **Check for update** to download the Gemini Nano model weights (typically ~1.5 GB).
4. Restart Chrome.

### Step 4: Verify in DevTools Console
Open Chrome DevTools (`Cmd + Option + I` or `F12`) and test:
```javascript
const session = await ai.languageModel.create();
console.log(await session.prompt("Hello Gemini Nano!"));
```
*Note: If your machine does not support Gemini Nano, Airlock's Per-Device Calibration automatically switches to our deterministic local engine with 100% feature parity and 0 network leakage.*

---

## 4. Test Suite & Verification

Airlock features a comprehensive test suite covering cryptographic primitives, money parsers, leap-year boundaries, Prompt Injections, and canary containment.

To run the automated test suite:
```bash
npm test
```

### Test Coverage Summary (71 Tests across 14 Suites):
- `tests/derivedClaims.test.ts`: Strict money formats, dates, tenure math, tamper rejection, ProbeGuard.
- `tests/evaluatePredicate.test.ts`: Concatenation bugs, day-first dates, substring holes, local opening wipes.
- `tests/airlock.test.ts`: System integration, canary leak audit, KDPA §3 scam heuristics, Firestore tombstoning.
- `tests/adversarial_hard.test.ts`: 7 hard adversarial suites (system overrides, exotic money fuzzing, leap-year boundaries, bit-flip detection, canary interception in binary buffers).
- `tests/pdfExtractor.test.ts`: Air-gapped PDF text stream decompression and scanned document handling.

---

## 5. Quickstart & Installation

```bash
# Clone the repository
git clone https://github.com/h-hiram/airlock-v2.git
cd airlock-v2

# Install dependencies
npm install

# Run automated tests
npm test

# Build for production
npm run build

# Start local development server
npm run dev
```

Visit `http://localhost:5173` to explore Airlock v2!

---

## 6. Airplane-Mode Demonstration (Air-Gap Proof)

To verify the air-gapped guarantee during evaluation:
1. Open Airlock v2 in your browser.
2. Select **🏢 Clean Payslip** or drop your own `.pdf` statement.
3. Plan the verification request.
4. **Turn ON Airplane Mode** (disconnect Wi-Fi/Ethernet).
5. Click **Extract on Device (ONLY_ON_DEVICE)**.
6. Observe that extraction, grounding verification, and zero-leakage predicates complete successfully with zero active internet connection!
