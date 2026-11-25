/**
 * Client-Side Air-Gapped PDF Text Extractor
 * 
 * Extracts text layers from PDF files directly in browser memory without sending
 * bytes to any cloud API or external service.
 * Supports:
 * - Direct text streams (BT ... ET, Tj, TJ)
 * - FlateDecode decompression via native browser DecompressionStream API
 * - Multi-page structure extraction
 */

export interface ExtractedPdfPage {
  pageNumber: number;
  text: string;
}

export interface PdfExtractionResult {
  filename: string;
  totalPages: number;
  fullText: string;
  pages: ExtractedPdfPage[];
  isScannedOnly: boolean;
}

/**
 * Extracts raw ASCII/UTF-8 strings from PDF TJ array or Tj string
 */
function parsePdfStringLiterals(streamText: string): string {
  const textChunks: string[] = [];

  // Match TJ operator: [ (string1) offset (string2) ] TJ
  const tjRegex = /\[(.*?)\]\s*TJ/gs;
  let match: RegExpExecArray | null;

  while ((match = tjRegex.exec(streamText)) !== null) {
    const arrayContent = match[1];
    // Extract everything inside parentheses (str)
    const parenRegex = /\((.*?)(?<!\\)\)/g;
    let parenMatch: RegExpExecArray | null;
    let lineStr = '';
    while ((parenMatch = parenRegex.exec(arrayContent)) !== null) {
      lineStr += parenMatch[1]
        .replace(/\\([()\\])/g, '$1') // unescape \( \) \\
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '')
        .replace(/\\t/g, ' ');
    }
    if (lineStr.trim()) {
      textChunks.push(lineStr.trim());
    }
  }

  // Match Tj operator: (string) Tj
  const singleTjRegex = /\((.*?)(?<!\\)\)\s*Tj/gs;
  while ((match = singleTjRegex.exec(streamText)) !== null) {
    const rawStr = match[1]
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ');
    if (rawStr.trim()) {
      textChunks.push(rawStr.trim());
    }
  }

  // Match ' or " operators
  const quoteRegex = /\((.*?)(?<!\\)\)\s*['"]/gs;
  while ((match = quoteRegex.exec(streamText)) !== null) {
    textChunks.push(match[1].trim());
  }

  return textChunks.join(' ');
}

/**
 * Decompresses a raw Uint8Array Flate stream using native DecompressionStream
 */
async function decompressFlate(bytes: Uint8Array): Promise<string> {
  // If DecompressionStream is not available (older runtime), fallback to raw text scan
  if (typeof DecompressionStream === 'undefined') {
    return new TextDecoder('latin1').decode(bytes);
  }

  try {
    // Try zlib format ('deflate')
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(bytes as unknown as BufferSource);
    writer.close();
    const decompressed = await new Response(ds.readable).arrayBuffer();
    return new TextDecoder('latin1').decode(decompressed);
  } catch {
    try {
      // Try raw deflate format ('deflate-raw') by stripping 2-byte zlib header if present
      const rawBytes = bytes.length > 2 && bytes[0] === 0x78 ? bytes.slice(2, -4) : bytes;
      const dsRaw = new DecompressionStream('deflate-raw');
      const writer = dsRaw.writable.getWriter();
      writer.write(rawBytes as unknown as BufferSource);
      writer.close();
      const decompressed = await new Response(dsRaw.readable).arrayBuffer();
      return new TextDecoder('latin1').decode(decompressed);
    } catch {
      // Fallback: decode directly (works on uncompressed streams)
      return new TextDecoder('latin1').decode(bytes);
    }
  }
}

/**
 * Extracts plain text from a PDF buffer in browser memory
 */
export async function extractTextFromPdf(
  buffer: ArrayBuffer,
  filename: string = 'document.pdf'
): Promise<PdfExtractionResult> {
  const uint8 = new Uint8Array(buffer);
  const rawContent = new TextDecoder('latin1').decode(uint8);

  const pagesText: string[] = [];
  
  // Find all stream / endstream pairs in the PDF
  const streamHeader = 'stream';
  const streamTrailer = 'endstream';

  let searchIndex = 0;
  while (true) {
    const streamStart = rawContent.indexOf(streamHeader, searchIndex);
    if (streamStart === -1) break;

    // Stream data starts immediately after "stream\r\n" or "stream\n"
    let dataStart = streamStart + streamHeader.length;
    if (rawContent.charCodeAt(dataStart) === 0x0d) dataStart++;
    if (rawContent.charCodeAt(dataStart) === 0x0a) dataStart++;

    const streamEnd = rawContent.indexOf(streamTrailer, dataStart);
    if (streamEnd === -1) break;

    const streamBytes = uint8.slice(dataStart, streamEnd);
    
    // Check if this stream is preceded by /Filter /FlateDecode
    const dictSlice = rawContent.slice(Math.max(0, streamStart - 400), streamStart);
    const isFlate = /Filter\s*\/?FlateDecode/i.test(dictSlice);

    let decodedStreamText = '';
    if (isFlate) {
      decodedStreamText = await decompressFlate(streamBytes);
    } else {
      decodedStreamText = new TextDecoder('latin1').decode(streamBytes);
    }

    if (decodedStreamText.includes('BT') || decodedStreamText.includes('Tj') || decodedStreamText.includes('TJ')) {
      const pageExtracted = parsePdfStringLiterals(decodedStreamText);
      if (pageExtracted.trim()) {
        pagesText.push(pageExtracted.trim());
      }
    }

    searchIndex = streamEnd + streamTrailer.length;
  }

  // If no streams yielded text, fallback to global string literal scan on the raw file
  if (pagesText.length === 0) {
    const fallbackText = parsePdfStringLiterals(rawContent);
    if (fallbackText.trim()) {
      pagesText.push(fallbackText.trim());
    }
  }

  const isScannedOnly = pagesText.length === 0;
  const fullText = isScannedOnly
    ? `[PDF Notice: "${filename}" contains rasterized images/scans without an embedded text layer. Please use a text-based PDF or photo upload with on-device OCR.]`
    : pagesText.join('\n\n--- Page Break ---\n\n');

  return {
    filename,
    totalPages: Math.max(1, pagesText.length),
    fullText,
    pages: pagesText.map((text, idx) => ({ pageNumber: idx + 1, text })),
    isScannedOnly,
  };
}
