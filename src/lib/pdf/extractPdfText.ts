import pdfParse from 'pdf-parse';

export async function extractPdfText(buffer: Buffer): Promise<string> {
  if (buffer.length === 0) {
    return '';
  }
  try {
    const result = await pdfParse(buffer);
    return result.text.trim();
  } catch (error) {
    console.warn('PDF text extraction failed', error);
    return '';
  }
}
