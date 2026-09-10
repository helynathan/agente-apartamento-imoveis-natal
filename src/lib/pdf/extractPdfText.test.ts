import { describe, it, expect } from 'vitest';
import { extractPdfText } from '@/lib/pdf/extractPdfText';

// PDF mínimo válido, escrito à mão (sem depender de nenhum arquivo fixture) — um
// documento de uma página com o texto "Ola Mundo" desenhado via operador Tj.
const MINIMAL_PDF = `%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/MediaBox[0 0 200 200]/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 44>>
stream
BT /F1 24 Tf 20 100 Td (Ola Mundo) Tj ET
endstream
endobj
xref
0 6
0000000000 65535 f
trailer<</Size 6/Root 1 0 R>>
startxref
0
%%EOF`;

describe('extractPdfText', () => {
  it('extracts text from a valid PDF', async () => {
    const buffer = Buffer.from(MINIMAL_PDF, 'binary');

    const text = await extractPdfText(buffer);

    expect(text).toContain('Ola Mundo');
  });

  it('returns an empty string instead of throwing for a non-PDF buffer', async () => {
    const buffer = Buffer.from('isso definitivamente não é um PDF', 'utf-8');

    const text = await extractPdfText(buffer);

    expect(text).toBe('');
  });

  it('returns an empty string instead of throwing for an empty buffer', async () => {
    const text = await extractPdfText(Buffer.alloc(0));

    expect(text).toBe('');
  });
});
