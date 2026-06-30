import { PDFParse } from 'pdf-parse';

const PDF_DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/;

export async function extractPdfText(dataUrl, maxChars = 50000) {
  let parser;
  try {
    const match = String(dataUrl || '').match(PDF_DATA_URL_PATTERN);
    if (!match || !match[1].toLowerCase().includes('pdf')) return null;

    parser = new PDFParse({ data: Buffer.from(match[2], 'base64') });
    const result = await parser.getText();
    const text = result.text?.trim() || '';
    return text ? text.slice(0, maxChars) : null;
  } catch (error) {
    console.error('Failed to extract PDF text:', error.message);
    return null;
  } finally {
    await parser?.destroy().catch(() => {});
  }
}
