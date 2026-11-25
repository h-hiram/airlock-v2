import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractTextFromPdf } from '../src/lib/documents/pdfExtractor.ts';

describe('PDF Extractor Unit Tests', () => {
  test('extracts plain uncompressed text stream from PDF buffer', async () => {
    const rawPdf = `%PDF-1.4
1 0 obj
<< /Length 75 >>
stream
BT
/F1 12 Tf
72 712 Td
(APEX DATA PLATFORM LTD - MONTHLY EARNINGS) Tj
T*
[(Net Pay:) 10 ($7,420.00)] TJ
ET
endstream
endobj
xref
trailer
<< /Root 1 0 R >>
%%EOF`;

    const encoder = new TextEncoder();
    const buffer = encoder.encode(rawPdf).buffer;

    const res = await extractTextFromPdf(buffer, 'payslip.pdf');
    assert.strictEqual(res.filename, 'payslip.pdf');
    assert.strictEqual(res.isScannedOnly, false);
    assert.ok(res.fullText.includes('APEX DATA PLATFORM LTD'));
    assert.ok(res.fullText.includes('$7,420.00'));
  });

  test('flags scanned PDF with no text layers honestly', async () => {
    const emptyPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R >>
endobj
xref
trailer
<< /Root 1 0 R >>
%%EOF`;

    const buffer = new TextEncoder().encode(emptyPdf).buffer;
    const res = await extractTextFromPdf(buffer, 'scan.pdf');
    assert.strictEqual(res.isScannedOnly, true);
    assert.ok(res.fullText.includes('rasterized images/scans'));
  });
});
