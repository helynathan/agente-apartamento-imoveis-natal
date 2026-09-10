# Contexto de imóvel por post do Instagram (PDF por post) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um admin vincule um PDF a um post do Instagram; quando alguém comenta nesse post e a conversa evolui pra DM, a IA passa a ter o conteúdo do PDF como contexto extra durante toda a conversa.

**Architecture:** Um PDF por post (1:1). O texto é extraído no upload e revisável/editável pelo admin — não guardamos o PDF original, só o texto. O n8n ganha uma 4ª ponte fina (`resolve-post-url`) pra resolver link→media_id, mantendo a credencial do Instagram centralizada lá. O vínculo comentário→post só existe no momento do comentário, então o n8n guarda `{mediaId, timestamp}` por `commenterId` em memória do workflow (expira em 7 dias) até a pessoa responder na DM. O contexto é buscado a cada turno da IA a partir de `Conversation.originMediaId`, sem depender de janela de memória.

**Tech Stack:** Next.js (Server Actions + Prisma), n8n (workflows JSON), `pdf-parse` (extração de texto), Instagram Graph API (via n8n).

**Spec:** `docs/superpowers/specs/2026-09-10-pdf-por-post-instagram-design.md`

## Global Constraints

- Um PDF por post (mapeamento 1:1) — não há busca semântica/RAG entre PDFs.
- Não guardar o arquivo PDF original — só o texto extraído/editado.
- O Next.js não recebe credencial própria do Instagram — toda chamada à Graph API passa por uma ponte n8n.
- `originMediaId` é gravado só na criação da conversa, nunca sobrescrito depois.
- O mapa `commenterId → mediaId` expira em 7 dias (janela de DM do Instagram); limitação aceita: comentar em posts diferentes antes de responder sobrescreve o vínculo anterior.
- Upload de PDF: só `.pdf`, até 10MB.
- PDF sem texto extraível: salva com texto vazio (não bloqueia), UI avisa e permite edição manual — nunca lançar erro que perca o upload.
- Testes que tocam banco usam um banco descartável criado/derrubado na VPS do cliente — nunca a base de produção (`dbagenteinsta`).

---

### Task 1: Schema — tabela PostListing e campo Conversation.originMediaId

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260910000000_add_post_listing/migration.sql`
- Create: `src/lib/db.post-listing-schema.test.ts`

**Interfaces:**
- Produces: modelo Prisma `PostListing { id, mediaId, postUrl, propertyText, createdAt, updatedAt }` e `Conversation.originMediaId: String?` — usados por todas as tasks seguintes.

- [ ] **Step 1: Adicionar o modelo e o campo no schema**

Em `prisma/schema.prisma`, dentro do `model Conversation { ... }`, logo após a linha `profilePictureUrl String?` (linha 65), adicionar:

```prisma
  originMediaId  String?
```

No final do arquivo, depois do `model ProductPage { ... }`, adicionar:

```prisma

model PostListing {
  id           String   @id @default(cuid())
  mediaId      String   @unique
  postUrl      String
  propertyText String   @default("")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

- [ ] **Step 2: Gerar o Prisma Client atualizado**

```bash
npx prisma generate
```

Expected: conclui sem erro. Isso é obrigatório antes de qualquer código (incluindo os testes das próximas tasks) referenciar `db.postListing` ou `conversation.originMediaId` — sem isso, o TypeScript não reconhece os novos campos/tabela.

- [ ] **Step 3: Criar a migration manualmente**

Criar `prisma/migrations/20260910000000_add_post_listing/migration.sql`:

```sql
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "originMediaId" TEXT;

-- CreateTable
CREATE TABLE "PostListing" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "propertyText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostListing_mediaId_key" ON "PostListing"("mediaId");
```

- [ ] **Step 4: Escrever o teste do schema**

Criar `src/lib/db.post-listing-schema.test.ts`:

```typescript
// src/lib/db.post-listing-schema.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';

describe('PostListing schema', () => {
  afterEach(async () => {
    await db.postListing.deleteMany();
  });

  it('creates a post listing with default empty propertyText', async () => {
    const listing = await db.postListing.create({
      data: { mediaId: '17841409145832360_123', postUrl: 'https://www.instagram.com/p/ABC123/' },
    });

    expect(listing.propertyText).toBe('');
    expect(listing.mediaId).toBe('17841409145832360_123');
  });

  it('enforces a unique mediaId', async () => {
    await db.postListing.create({
      data: { mediaId: 'dup-media-id', postUrl: 'https://www.instagram.com/p/ABC123/' },
    });

    await expect(
      db.postListing.create({ data: { mediaId: 'dup-media-id', postUrl: 'https://www.instagram.com/p/DIFFERENT/' } })
    ).rejects.toThrow();
  });

  it('allows a conversation to reference a mediaId via originMediaId', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: 'ig-user-1', channel: 'INSTAGRAM', originMediaId: '17841409145832360_123' },
    });

    expect(conversation.originMediaId).toBe('17841409145832360_123');
    await db.conversation.deleteMany();
  });
});
```

- [ ] **Step 5: Aplicar a migration e rodar o teste**

Isso precisa de um Postgres alcançável. Siga o padrão já usado neste projeto: crie um banco descartável na mesma instância Postgres da VPS do cliente (nunca a base de produção `dbagenteinsta`), rode a migration nele, rode o teste, depois derrube o banco descartável.

```bash
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx prisma migrate deploy
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx vitest run src/lib/db.post-listing-schema.test.ts
```

Expected: as migrations aplicam sem erro e os 3 testes passam.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260910000000_add_post_listing src/lib/db.post-listing-schema.test.ts
git commit -m "Add PostListing model and Conversation.originMediaId

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Repositório PostListing

**Files:**
- Create: `src/lib/posts/postListingRepository.ts`
- Test: `src/lib/posts/postListingRepository.test.ts`

**Interfaces:**
- Consumes: `db.postListing` (Prisma Client, produzido pela Task 1).
- Produces: `upsertPostListing(params: { mediaId: string; postUrl: string; propertyText: string }): Promise<PostListing>`, `listPostListings(): Promise<PostListing[]>`, `findPostListingByMediaId(mediaId: string): Promise<PostListing | null>`, `deletePostListing(id: string): Promise<void>` — usados pelas Tasks 8 e 9.

- [ ] **Step 1: Escrever os testes**

Criar `src/lib/posts/postListingRepository.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/lib/db';
import {
  upsertPostListing,
  listPostListings,
  findPostListingByMediaId,
  deletePostListing,
} from '@/lib/posts/postListingRepository';

describe('postListingRepository', () => {
  afterEach(async () => {
    await db.postListing.deleteMany();
  });

  it('creates a new listing on first upsert', async () => {
    const listing = await upsertPostListing({
      mediaId: 'media-1',
      postUrl: 'https://www.instagram.com/p/ABC123/',
      propertyText: 'Apartamento 2 quartos, 80m²',
    });

    expect(listing.mediaId).toBe('media-1');
    expect(listing.propertyText).toBe('Apartamento 2 quartos, 80m²');
  });

  it('updates propertyText on a second upsert with the same mediaId', async () => {
    await upsertPostListing({ mediaId: 'media-1', postUrl: 'https://www.instagram.com/p/ABC123/', propertyText: 'Texto original' });

    const updated = await upsertPostListing({
      mediaId: 'media-1',
      postUrl: 'https://www.instagram.com/p/ABC123/',
      propertyText: 'Texto corrigido',
    });

    expect(updated.propertyText).toBe('Texto corrigido');
    const all = await listPostListings();
    expect(all).toHaveLength(1);
  });

  it('finds a listing by mediaId', async () => {
    await upsertPostListing({ mediaId: 'media-1', postUrl: 'https://www.instagram.com/p/ABC123/', propertyText: 'Texto' });

    const found = await findPostListingByMediaId('media-1');
    const notFound = await findPostListingByMediaId('media-inexistente');

    expect(found?.propertyText).toBe('Texto');
    expect(notFound).toBeNull();
  });

  it('lists all listings ordered by most recently created first', async () => {
    await upsertPostListing({ mediaId: 'media-1', postUrl: 'https://www.instagram.com/p/A/', propertyText: 'A' });
    await upsertPostListing({ mediaId: 'media-2', postUrl: 'https://www.instagram.com/p/B/', propertyText: 'B' });

    const all = await listPostListings();

    expect(all.map((l) => l.mediaId)).toEqual(['media-2', 'media-1']);
  });

  it('deletes a listing by id', async () => {
    const listing = await upsertPostListing({ mediaId: 'media-1', postUrl: 'https://www.instagram.com/p/ABC123/', propertyText: 'Texto' });

    await deletePostListing(listing.id);

    const found = await findPostListingByMediaId('media-1');
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar pra confirmar que falha (RED)**

```bash
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx vitest run src/lib/posts/postListingRepository.test.ts
```

Expected: FAIL — módulo `@/lib/posts/postListingRepository` não existe.

- [ ] **Step 3: Implementar**

Criar `src/lib/posts/postListingRepository.ts`:

```typescript
import { db } from '@/lib/db';

export interface PostListing {
  id: string;
  mediaId: string;
  postUrl: string;
  propertyText: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function upsertPostListing(params: {
  mediaId: string;
  postUrl: string;
  propertyText: string;
}): Promise<PostListing> {
  return db.postListing.upsert({
    where: { mediaId: params.mediaId },
    update: { postUrl: params.postUrl, propertyText: params.propertyText },
    create: { mediaId: params.mediaId, postUrl: params.postUrl, propertyText: params.propertyText },
  });
}

export async function listPostListings(): Promise<PostListing[]> {
  return db.postListing.findMany({ orderBy: { createdAt: 'desc' } });
}

export async function findPostListingByMediaId(mediaId: string): Promise<PostListing | null> {
  return db.postListing.findUnique({ where: { mediaId } });
}

export async function deletePostListing(id: string): Promise<void> {
  await db.postListing.delete({ where: { id } });
}
```

- [ ] **Step 4: Rodar pra confirmar que passa (GREEN)**

```bash
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx vitest run src/lib/posts/postListingRepository.test.ts
```

Expected: PASS, 5/5 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/posts/postListingRepository.ts src/lib/posts/postListingRepository.test.ts
git commit -m "Add PostListing repository (upsert/list/find/delete)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Extração de texto de PDF

**Files:**
- Modify: `package.json` (adicionar dependências)
- Create: `src/lib/pdf/extractPdfText.ts`
- Test: `src/lib/pdf/extractPdfText.test.ts`

**Interfaces:**
- Produces: `extractPdfText(buffer: Buffer): Promise<string>` — nunca lança exceção, devolve `''` se não conseguir extrair nada. Usado pela Task 9.

Esta task não depende de banco de dados — os testes rodam sem `DATABASE_URL`.

- [ ] **Step 1: Adicionar as dependências**

Em `package.json`, na seção `"dependencies"`, adicionar (ordem alfabética, como as demais):

```json
    "pdf-parse": "^1.1.1",
```

Na seção `"devDependencies"`, adicionar:

```json
    "@types/pdf-parse": "^1.1.4",
```

Rodar:
```bash
npm install
```

- [ ] **Step 2: Escrever o teste**

Criar `src/lib/pdf/extractPdfText.test.ts`:

```typescript
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
```

- [ ] **Step 3: Rodar pra confirmar que falha (RED)**

```bash
npx vitest run src/lib/pdf/extractPdfText.test.ts
```

Expected: FAIL — módulo `@/lib/pdf/extractPdfText` não existe.

- [ ] **Step 4: Implementar**

Criar `src/lib/pdf/extractPdfText.ts`:

```typescript
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
```

- [ ] **Step 5: Rodar pra confirmar que passa (GREEN)**

```bash
npx vitest run src/lib/pdf/extractPdfText.test.ts
```

Expected: PASS, 3/3 testes. Se o teste do PDF mínimo não extrair "Ola Mundo" (biblioteca rejeitando o xref manual), ajuste o `MINIMAL_PDF` adicionando offsets reais de byte na seção `xref` — o essencial é que o teste use um PDF real construído no próprio arquivo de teste, não um download externo.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/pdf/extractPdfText.ts src/lib/pdf/extractPdfText.test.ts
git commit -m "Add PDF text extraction (pdf-parse), never throwing on bad input

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Cliente da ponte n8n resolve-post-url

**Files:**
- Modify: `.env.example`
- Create: `src/lib/instagram/resolvePostUrl.ts`
- Test: `src/lib/instagram/resolvePostUrl.test.ts`

**Interfaces:**
- Produces: `resolvePostUrl(postUrl: string): Promise<{ mediaId: string }>` — lança erro se a variável de ambiente não estiver configurada, se a resposta HTTP não for OK, ou se a resposta não trouxer um `mediaId` de string não vazia. Usado pela Task 9.

Esta task não depende de banco de dados.

- [ ] **Step 1: Adicionar a variável de ambiente**

Em `.env.example`, logo abaixo da linha `N8N_INSTAGRAM_SEND_WEBHOOK_URL=...`, adicionar:

```
N8N_RESOLVE_POST_URL_WEBHOOK_URL="https://your-n8n-instance.example.com/webhook/resolve-post-url"
```

- [ ] **Step 2: Escrever os testes**

Criar `src/lib/instagram/resolvePostUrl.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolvePostUrl } from '@/lib/instagram/resolvePostUrl';

describe('resolvePostUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts the postUrl and returns the mediaId from the response', async () => {
    vi.stubEnv('N8N_RESOLVE_POST_URL_WEBHOOK_URL', 'https://n8n.example.com/webhook/resolve-post-url');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ mediaId: '17841409145832360_123' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolvePostUrl('https://www.instagram.com/p/ABC123/');

    expect(result).toEqual({ mediaId: '17841409145832360_123' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://n8n.example.com/webhook/resolve-post-url',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        signal: expect.any(AbortSignal),
        body: JSON.stringify({ postUrl: 'https://www.instagram.com/p/ABC123/' }),
      })
    );
  });

  it('throws when N8N_RESOLVE_POST_URL_WEBHOOK_URL is not configured', async () => {
    vi.stubEnv('N8N_RESOLVE_POST_URL_WEBHOOK_URL', '');

    await expect(resolvePostUrl('https://www.instagram.com/p/ABC123/')).rejects.toThrow(
      'N8N_RESOLVE_POST_URL_WEBHOOK_URL is not configured'
    );
  });

  it('throws when the webhook responds with a non-ok status', async () => {
    vi.stubEnv('N8N_RESOLVE_POST_URL_WEBHOOK_URL', 'https://n8n.example.com/webhook/resolve-post-url');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(resolvePostUrl('https://www.instagram.com/p/inexistente/')).rejects.toThrow('HTTP 404');
  });

  it('throws when the response has no mediaId', async () => {
    vi.stubEnv('N8N_RESOLVE_POST_URL_WEBHOOK_URL', 'https://n8n.example.com/webhook/resolve-post-url');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) }));

    await expect(resolvePostUrl('https://www.instagram.com/p/ABC123/')).rejects.toThrow('did not return a mediaId');
  });
});
```

- [ ] **Step 3: Rodar pra confirmar que falha (RED)**

```bash
npx vitest run src/lib/instagram/resolvePostUrl.test.ts
```

Expected: FAIL — módulo `@/lib/instagram/resolvePostUrl` não existe.

- [ ] **Step 4: Implementar**

Criar `src/lib/instagram/resolvePostUrl.ts`:

```typescript
export async function resolvePostUrl(postUrl: string): Promise<{ mediaId: string }> {
  const url = process.env.N8N_RESOLVE_POST_URL_WEBHOOK_URL;
  if (!url) {
    throw new Error('N8N_RESOLVE_POST_URL_WEBHOOK_URL is not configured');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postUrl }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`N8N resolve-post-url webhook responded with HTTP ${response.status}`);
  }

  const data = (await response.json()) as { mediaId?: unknown };
  if (typeof data.mediaId !== 'string' || data.mediaId.length === 0) {
    throw new Error('N8N resolve-post-url webhook did not return a mediaId');
  }

  return { mediaId: data.mediaId };
}
```

- [ ] **Step 5: Rodar pra confirmar que passa (GREEN)**

```bash
npx vitest run src/lib/instagram/resolvePostUrl.test.ts
```

Expected: PASS, 4/4 testes.

- [ ] **Step 6: Commit**

```bash
git add .env.example src/lib/instagram/resolvePostUrl.ts src/lib/instagram/resolvePostUrl.test.ts
git commit -m "Add resolvePostUrl client for the new n8n resolve-post-url bridge

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Workflow n8n — resolve-post-url (4ª ponte fina)

**Files:**
- Create: `n8n/resolve-post-url.json`

**Interfaces:**
- Consumes: `POST` com corpo `{"postUrl": string}` — mesmo formato enviado por `resolvePostUrl.ts` (Task 4).
- Produces: resposta `{"mediaId": string}` (HTTP 200) quando encontrado, ou `{"error": "not_found"}` (HTTP 404) quando não — consumido por `resolvePostUrl.ts`, que trata qualquer resposta não-OK como erro.

- [ ] **Step 1: Criar o workflow**

Criar `n8n/resolve-post-url.json`:

```json
{
  "name": "Apartamento Imoveis Natal - Resolve Post URL",
  "nodes": [
    {
      "parameters": {
        "content": "## Setup antes de ativar\n\n1. Preencha `igUserId`/`graphApiVersion` no node \"Config\" (mesmos valores dos outros 3 workflows deste cliente).\n2. Credencial Instagram (HTTP Header Auth) no node \"Buscar Mídia Recente\" — mesma credencial já usada nos outros workflows.\n3. No `.env` do Next.js, `N8N_RESOLVE_POST_URL_WEBHOOK_URL` deve apontar pra Production URL do node \"Webhook\" abaixo.\n\nEsse workflow só busca entre os 50 posts mais recentes da conta — o admin deve vincular o PDF logo após publicar o post.",
        "height": 280,
        "width": 420
      },
      "type": "n8n-nodes-base.stickyNote",
      "typeVersion": 1,
      "position": [-1120, -280],
      "id": "sticky-setup",
      "name": "Instruções de Setup"
    },
    {
      "parameters": { "httpMethod": "POST", "path": "apartamentoimoveis-resolve-post-url", "responseMode": "responseNode", "options": {} },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [-1120, 0],
      "id": "webhook",
      "name": "Webhook",
      "webhookId": "apartamentoimoveis-resolve-post-url"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            { "id": "cfg-ig-user-id", "name": "igUserId", "value": "17841409145832360", "type": "string" },
            { "id": "cfg-graph-version", "name": "graphApiVersion", "value": "v25.0", "type": "string" }
          ]
        },
        "includeOtherFields": true,
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [-880, 0],
      "id": "config",
      "name": "Config"
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{ 'https://graph.instagram.com/' + $json.graphApiVersion + '/' + $json.igUserId + '/media?fields=id,permalink&limit=50' }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-640, 0],
      "id": "fetch-media",
      "name": "Buscar Mídia Recente",
      "credentials": { "httpHeaderAuth": { "id": "REPLACE_ME", "name": "Instagram Graph API" } }
    },
    {
      "parameters": {
        "jsCode": "function extractShortcode(url) {\n  if (!url) return null;\n  const match = String(url).match(/\\/(?:p|reel|tv)\\/([^/?]+)/);\n  return match ? match[1] : null;\n}\n\nconst targetShortcode = extractShortcode($('Webhook').item.json.body.postUrl);\nconst media = ($input.first().json.data || []).find((m) => extractShortcode(m.permalink) === targetShortcode);\n\nif (!media || !targetShortcode) {\n  return [{ json: { error: 'not_found' } }];\n}\n\nreturn [{ json: { mediaId: media.id } }];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-400, 0],
      "id": "find-media",
      "name": "Encontrar Media ID"
    },
    {
      "parameters": {
        "conditions": {
          "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "loose" },
          "conditions": [
            { "id": "cond-found", "leftValue": "={{ $json.mediaId }}", "rightValue": "", "operator": { "type": "string", "operation": "notEquals" } }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [-160, 0],
      "id": "if-found",
      "name": "IF Encontrado"
    },
    {
      "parameters": { "respondWith": "json", "responseBody": "={{ { mediaId: $json.mediaId } }}", "options": {} },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [80, -100],
      "id": "respond-found",
      "name": "Responder Encontrado"
    },
    {
      "parameters": { "respondWith": "json", "responseBody": "={{ { error: 'not_found' } }}", "options": { "responseCode": 404 } },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [80, 100],
      "id": "respond-not-found",
      "name": "Responder Não Encontrado"
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "Config", "type": "main", "index": 0 }]] },
    "Config": { "main": [[{ "node": "Buscar Mídia Recente", "type": "main", "index": 0 }]] },
    "Buscar Mídia Recente": { "main": [[{ "node": "Encontrar Media ID", "type": "main", "index": 0 }]] },
    "Encontrar Media ID": { "main": [[{ "node": "IF Encontrado", "type": "main", "index": 0 }]] },
    "IF Encontrado": { "main": [[{ "node": "Responder Encontrado", "type": "main", "index": 0 }], [{ "node": "Responder Não Encontrado", "type": "main", "index": 0 }]] }
  },
  "active": false,
  "settings": { "executionOrder": "v1" },
  "pinData": {}
}
```

- [ ] **Step 2: Validar o JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('n8n/resolve-post-url.json', 'utf-8')); console.log('OK')"
```

Expected: imprime `OK`.

- [ ] **Step 3: Commit**

```bash
git add n8n/resolve-post-url.json
git commit -m "Add n8n bridge: resolve an Instagram post URL to its media_id

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: n8n — lembrar mediaId por comentário e repassar na mensagem seguinte

**Files:**
- Modify: `n8n/webhook-in-instagram.json`

**Interfaces:**
- Produces: o payload que `Enviar para Next.js` manda ganha um campo opcional `originMediaId` — consumido pela Task 7 (`parseInstagramWebhook.ts`).

- [ ] **Step 1: Atualizar o código do node "Parse Evento Comentario"**

Em `n8n/webhook-in-instagram.json`, encontrar o node com `"id": "parse-comment"` (nome "Parse Evento Comentario"). Substituir o valor de `"jsCode"` (a string atual começa com `"const body = $input.first().json.body;\nconst entry = body?.entry?.[0];\nconst change = entry?.changes?.find..."`) por exatamente este valor:

```
"const body = $input.first().json.body;\nconst entry = body?.entry?.[0];\nconst change = entry?.changes?.find((c) => c.field === 'comments');\nconst ourAccountId = entry?.id;\n\nif (!change) {\n  return [];\n}\n\nconst value = change.value;\n\nif (!value || !value.id || value.from?.id === ourAccountId) {\n  return [];\n}\n\nconst commentId = value.id;\n\nconst staticData = $getWorkflowStaticData('node');\nstaticData.processedCommentIds = staticData.processedCommentIds || {};\nif (staticData.processedCommentIds[commentId]) {\n  return [];\n}\nstaticData.processedCommentIds[commentId] = true;\n\nconst commenterId = value.from?.id || null;\nconst mediaId = value.media?.id || null;\n\nif (commenterId && mediaId) {\n  const globalData = $getWorkflowStaticData('global');\n  globalData.postContextByCommenter = globalData.postContextByCommenter || {};\n  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;\n  const now = Date.now();\n  for (const key of Object.keys(globalData.postContextByCommenter)) {\n    if (now - globalData.postContextByCommenter[key].timestamp > sevenDaysMs) {\n      delete globalData.postContextByCommenter[key];\n    }\n  }\n  globalData.postContextByCommenter[commenterId] = { mediaId, timestamp: now };\n}\n\nreturn [{\n  json: {\n    commentId,\n    commentText: value.text || '',\n    commenterId,\n  },\n}];\n"
```

- [ ] **Step 2: Atualizar o código do node "Parse Evento Instagram"**

No mesmo arquivo, encontrar o node com `"id": "parse-event"` (nome "Parse Evento Instagram"). Substituir o valor de `"jsCode"` por exatamente este valor:

```
"const body = $input.first().json.body;\nconst entry = body?.entry?.[0];\nconst messaging = entry?.messaging?.[0];\nconst ourAccountId = entry?.id;\n\nif (\n  !messaging ||\n  !messaging.message ||\n  messaging.message.is_echo ||\n  !messaging.message.text ||\n  messaging.sender?.id === ourAccountId\n) {\n  return [];\n}\n\nconst mid = messaging.message.mid;\n\nconst staticData = $getWorkflowStaticData('node');\nstaticData.processedMessageIds = staticData.processedMessageIds || {};\nif (mid && staticData.processedMessageIds[mid]) {\n  return [];\n}\nif (mid) {\n  staticData.processedMessageIds[mid] = true;\n}\n\nconst senderId = messaging.sender.id;\nconst globalData = $getWorkflowStaticData('global');\nconst postContext = globalData.postContextByCommenter && globalData.postContextByCommenter[senderId];\nconst sevenDaysMs = 7 * 24 * 60 * 60 * 1000;\nconst originMediaId = postContext && (Date.now() - postContext.timestamp <= sevenDaysMs) ? postContext.mediaId : null;\n\nreturn [{\n  json: {\n    senderId,\n    recipientId: messaging.recipient.id,\n    messageText: messaging.message.text,\n    messageId: mid,\n    originMediaId,\n  },\n}];\n"
```

- [ ] **Step 3: Atualizar o código do node "Montar Payload Next.js"**

No mesmo arquivo, encontrar o node com `"id": "build-payload"` (nome "Montar Payload Next.js"). Substituir o valor de `"jsCode"` (atualmente `"const profile = $json;\nconst evt = $('Extrair PSID').item.json;\nreturn [{\n  json: {\n    senderId: evt.recipientId,\n    messageId: evt.messageId,\n    content: evt.messageText,\n    customerName: profile.username || undefined,\n    profilePictureUrl: profile.profile_pic || undefined,\n  },\n}];\n"`) por exatamente este valor:

```
"const profile = $json;\nconst evt = $('Extrair PSID').item.json;\nreturn [{\n  json: {\n    senderId: evt.recipientId,\n    messageId: evt.messageId,\n    content: evt.messageText,\n    customerName: profile.username || undefined,\n    profilePictureUrl: profile.profile_pic || undefined,\n    originMediaId: evt.originMediaId || undefined,\n  },\n}];\n"
```

- [ ] **Step 4: Validar o JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('n8n/webhook-in-instagram.json', 'utf-8')); console.log('OK')"
```

Expected: imprime `OK`.

- [ ] **Step 5: Commit**

```bash
git add n8n/webhook-in-instagram.json
git commit -m "Remember commenter->mediaId in n8n and forward originMediaId to Next.js

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Encaminhar originMediaId do webhook até a criação da conversa

**Files:**
- Modify: `src/lib/webhook/parseInstagramWebhook.ts`
- Modify: `src/lib/webhook/parseInstagramWebhook.test.ts`
- Modify: `src/lib/conversations/persistInboundMessage.ts`
- Modify: `src/lib/conversations/persistInboundMessage.test.ts`
- Modify: `src/app/api/webhook/instagram/[secret]/route.ts`
- Modify: `src/app/api/webhook/instagram/[secret]/route.test.ts`

**Interfaces:**
- Consumes: payload `{senderId, messageId, content, customerName?, profilePictureUrl?, originMediaId?}` (produzido pela Task 6).
- Produces: `Conversation.originMediaId` gravado na criação — consumido pela Task 8.

- [ ] **Step 1: Escrever o teste de `parseInstagramWebhook`**

Em `src/lib/webhook/parseInstagramWebhook.test.ts`, adicionar (mantendo os testes existentes):

```typescript
  it('parses originMediaId when present', () => {
    const result = parseInstagramWebhook({
      senderId: 'ig-user-1',
      messageId: 'IGM123',
      content: 'Olá',
      originMediaId: '17841409145832360_123',
    });

    expect(result?.originMediaId).toBe('17841409145832360_123');
  });

  it('leaves originMediaId undefined when absent', () => {
    const result = parseInstagramWebhook({ senderId: 'ig-user-1', messageId: 'IGM123', content: 'Olá' });

    expect(result?.originMediaId).toBeUndefined();
  });
```

- [ ] **Step 2: Rodar pra confirmar que falha (RED)**

```bash
npx vitest run src/lib/webhook/parseInstagramWebhook.test.ts
```

Expected: FAIL — `result?.originMediaId` é `undefined` no primeiro teste novo porque o campo ainda não existe no tipo/retorno (o teste falha por não bater `'17841409145832360_123'`).

- [ ] **Step 3: Atualizar `parseInstagramWebhook.ts`**

Substituir o conteúdo de `src/lib/webhook/parseInstagramWebhook.ts` por:

```typescript
interface ParsedInstagramMessage {
  senderId: string;
  messageId: string;
  text: string;
  name?: string;
  profilePictureUrl?: string;
  originMediaId?: string;
}

export function parseInstagramWebhook(payload: unknown): ParsedInstagramMessage | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;

  const senderId = body.senderId;
  const messageId = body.messageId;
  const text = body.content;
  const name = body.customerName;
  const profilePictureUrl = body.profilePictureUrl;
  const originMediaId = body.originMediaId;

  if (typeof senderId !== 'string' || senderId.length === 0) return null;
  if (typeof messageId !== 'string' || messageId.length === 0) return null;
  if (typeof text !== 'string' || text.length === 0) return null;

  return {
    senderId,
    messageId,
    text,
    name: typeof name === 'string' && name.length > 0 ? name : undefined,
    profilePictureUrl: typeof profilePictureUrl === 'string' && profilePictureUrl.length > 0 ? profilePictureUrl : undefined,
    originMediaId: typeof originMediaId === 'string' && originMediaId.length > 0 ? originMediaId : undefined,
  };
}
```

- [ ] **Step 4: Rodar pra confirmar que passa (GREEN)**

```bash
npx vitest run src/lib/webhook/parseInstagramWebhook.test.ts
```

Expected: PASS, todos os testes (os já existentes + os 2 novos).

- [ ] **Step 5: Escrever o teste de `persistInboundMessage`**

Em `src/lib/conversations/persistInboundMessage.test.ts`, adicionar (mesmo padrão dos testes de `customerName`/`profilePictureUrl` já existentes):

```typescript
  it('sets originMediaId on a new conversation and never changes it later', async () => {
    const first = await persistInboundMessage({
      channel: 'INSTAGRAM',
      phone: 'ig-user-1',
      text: 'Primeira',
      externalId: 'MSG1',
      originMediaId: 'media-abc',
    });
    await persistInboundMessage({
      channel: 'INSTAGRAM',
      phone: 'ig-user-1',
      text: 'Segunda',
      externalId: 'MSG2',
      originMediaId: 'media-diferente',
    });

    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.originMediaId).toBe('media-abc');
  });

  it('leaves originMediaId null when not provided on creation', async () => {
    const first = await persistInboundMessage({
      channel: 'INSTAGRAM',
      phone: 'ig-user-2',
      text: 'Primeira',
      externalId: 'MSG3',
    });

    const conversation = await db.conversation.findUnique({ where: { id: first.conversationId } });
    expect(conversation?.originMediaId).toBeNull();
  });
```

- [ ] **Step 6: Rodar pra confirmar que falha (RED)**

```bash
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx vitest run src/lib/conversations/persistInboundMessage.test.ts
```

Expected: FAIL — `conversation?.originMediaId` vem `undefined`/erro de tipo porque `persistInboundMessage` ainda não aceita esse parâmetro.

- [ ] **Step 7: Atualizar `persistInboundMessage.ts`**

Em `src/lib/conversations/persistInboundMessage.ts`, modificar a assinatura da função (linhas 7-20) adicionando `originMediaId?: string;` no objeto de parâmetros, logo após `profilePictureUrl?: string;`:

```typescript
export async function persistInboundMessage(params: {
  channel: Channel;
  phone: string;
  text: string;
  externalId: string;
  name?: string;
  profilePictureUrl?: string;
  originMediaId?: string;
}): Promise<{
```

No bloco `create` do `db.conversation.upsert` (dentro do `create: { ... }`, logo após `profilePictureUrl: params.profilePictureUrl,`), adicionar:

```typescript
      originMediaId: params.originMediaId,
```

Não mexer no bloco `update` — `originMediaId` nunca é sobrescrito depois da criação, por desenho.

- [ ] **Step 8: Rodar pra confirmar que passa (GREEN)**

```bash
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx vitest run src/lib/conversations/persistInboundMessage.test.ts
```

Expected: PASS, todos os testes.

- [ ] **Step 9: Escrever o teste da rota**

Em `src/app/api/webhook/instagram/[secret]/route.test.ts`, adicionar um teste seguindo o padrão dos existentes (usa `persistInboundMessage` mockado):

```typescript
  it('passes originMediaId through to persistInboundMessage when present', async () => {
    await callWithSecret('correct-secret', {
      senderId: 'ig-user-1',
      messageId: 'IGM123',
      content: 'Olá',
      originMediaId: 'media-abc',
    });

    expect(persistInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({ originMediaId: 'media-abc' })
    );
  });
```

- [ ] **Step 10: Rodar pra confirmar que falha (RED)**

```bash
npx vitest run "src/app/api/webhook/instagram/[secret]/route.test.ts"
```

Expected: FAIL — `persistInboundMessage` não é chamado com `originMediaId` ainda.

- [ ] **Step 11: Atualizar `route.ts`**

Em `src/app/api/webhook/instagram/[secret]/route.ts`, na chamada a `persistInboundMessage` (linhas 29-36), adicionar `originMediaId: parsed.originMediaId,` logo após `profilePictureUrl: parsed.profilePictureUrl,`:

```typescript
  const result = await persistInboundMessage({
    channel: 'INSTAGRAM',
    phone: parsed.senderId,
    text: parsed.text,
    externalId: parsed.messageId,
    name: parsed.name,
    profilePictureUrl: parsed.profilePictureUrl,
    originMediaId: parsed.originMediaId,
  });
```

- [ ] **Step 12: Rodar pra confirmar que passa (GREEN)**

```bash
npx vitest run "src/app/api/webhook/instagram/[secret]/route.test.ts"
```

Expected: PASS, todos os testes.

- [ ] **Step 13: Commit**

```bash
git add src/lib/webhook/parseInstagramWebhook.ts src/lib/webhook/parseInstagramWebhook.test.ts src/lib/conversations/persistInboundMessage.ts src/lib/conversations/persistInboundMessage.test.ts "src/app/api/webhook/instagram/[secret]/route.ts" "src/app/api/webhook/instagram/[secret]/route.test.ts"
git commit -m "Thread originMediaId from n8n webhook through to conversation creation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: IA usa o texto do PostListing como contexto quando disponível

**Files:**
- Modify: `src/lib/ai/processInboundForAi.ts`
- Modify: `src/lib/ai/processInboundForAi.test.ts`

**Interfaces:**
- Consumes: `findPostListingByMediaId(mediaId: string): Promise<PostListing | null>` (Task 2), `conversation.originMediaId` (Task 7).
- Produces: quando `conversation.originMediaId` aponta pra um `PostListing` existente, `requestTriageDecision` é chamado com `productContext` igual ao `propertyText` daquele listing — sem rodar `searchRelevantProducts` nesse caso.

- [ ] **Step 1: Escrever os testes**

Em `src/lib/ai/processInboundForAi.test.ts`, adicionar o mock do novo módulo perto dos outros `vi.mock` (topo do arquivo, junto aos já existentes):

```typescript
vi.mock('@/lib/posts/postListingRepository', () => ({
  findPostListingByMediaId: vi.fn().mockResolvedValue(null),
}));
```

E o import correspondente, junto aos outros imports:

```typescript
import { findPostListingByMediaId } from '@/lib/posts/postListingRepository';
```

Adicionar os testes (seguindo o padrão dos testes de `productContext` já existentes no arquivo, que criam uma conversa, mockam a resposta e verificam a chamada a `requestTriageDecision`):

```typescript
  it('uses the linked PostListing propertyText as productContext when originMediaId matches one', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: 'ig-user-1', channel: 'INSTAGRAM', aiMessageCount: 1, originMediaId: 'media-abc' },
    });
    vi.mocked(findPostListingByMediaId).mockResolvedValueOnce({
      id: 'listing-1',
      mediaId: 'media-abc',
      postUrl: 'https://www.instagram.com/p/ABC123/',
      propertyText: 'Apartamento 2 quartos, 80m², R$ 350.000',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(requestTriageDecision).mockResolvedValue({ acao: 'responder', mensagem: 'Sim, temos esse imóvel!', eLead: false });

    await processInboundForAi(conversation.id);

    expect(findPostListingByMediaId).toHaveBeenCalledWith('media-abc');
    expect(requestTriageDecision).toHaveBeenCalledWith(
      expect.objectContaining({ productContext: 'Apartamento 2 quartos, 80m², R$ 350.000' })
    );
    expect(searchRelevantProducts).not.toHaveBeenCalled();
  });

  it('falls back to no productContext when originMediaId has no matching PostListing', async () => {
    const conversation = await db.conversation.create({
      data: { customerExternalId: 'ig-user-1', channel: 'INSTAGRAM', aiMessageCount: 1, originMediaId: 'media-sem-listing' },
    });
    vi.mocked(findPostListingByMediaId).mockResolvedValueOnce(null);
    vi.mocked(requestTriageDecision).mockResolvedValue({ acao: 'responder', mensagem: 'Olá!', eLead: false });

    await processInboundForAi(conversation.id);

    expect(requestTriageDecision).toHaveBeenCalledWith(expect.objectContaining({ productContext: undefined }));
  });
```

- [ ] **Step 2: Rodar pra confirmar que falha (RED)**

```bash
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx vitest run src/lib/ai/processInboundForAi.test.ts
```

Expected: FAIL — o primeiro teste novo falha porque `productContext` vem `undefined` (a função ainda não consulta `findPostListingByMediaId`).

- [ ] **Step 3: Implementar**

Em `src/lib/ai/processInboundForAi.ts`, adicionar o import logo após os já existentes (linha 6, depois de `searchRelevantProducts`):

```typescript
import { findPostListingByMediaId } from '@/lib/posts/postListingRepository';
```

Substituir o bloco (linhas 98-110):

```typescript
  const lastInboundMessage = [...conversation.messages].reverse().find((m) => m.direction === 'INBOUND');
  let productContext: string | undefined;
  let products: Array<{ url: string; content: string }> = [];
  if (lastInboundMessage) {
    try {
      products = await searchRelevantProducts(lastInboundMessage.content, 3);
      if (products.length > 0) {
        productContext = products.map((p) => `- ${p.url}: ${p.content.slice(0, 2000)}`).join('\n');
      }
    } catch (error) {
      console.warn('Product search failed, continuing without product context', error);
    }
  }
```

por:

```typescript
  const lastInboundMessage = [...conversation.messages].reverse().find((m) => m.direction === 'INBOUND');
  let productContext: string | undefined;

  if (conversation.originMediaId) {
    try {
      const listing = await findPostListingByMediaId(conversation.originMediaId);
      if (listing) {
        productContext = listing.propertyText;
      }
    } catch (error) {
      console.warn('Post listing lookup failed, continuing without post context', error);
    }
  }

  let products: Array<{ url: string; content: string }> = [];
  if (!productContext && lastInboundMessage) {
    try {
      products = await searchRelevantProducts(lastInboundMessage.content, 3);
      if (products.length > 0) {
        productContext = products.map((p) => `- ${p.url}: ${p.content.slice(0, 2000)}`).join('\n');
      }
    } catch (error) {
      console.warn('Product search failed, continuing without product context', error);
    }
  }
```

- [ ] **Step 4: Rodar pra confirmar que passa (GREEN)**

```bash
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx vitest run src/lib/ai/processInboundForAi.test.ts
```

Expected: PASS, todos os testes (os já existentes continuam passando — a busca de produtos do WhatsApp só é pulada quando já existe `productContext` vindo de um `PostListing`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/processInboundForAi.ts src/lib/ai/processInboundForAi.test.ts
git commit -m "Use the linked post's PostListing text as AI context when available

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Tela de admin — vincular PDF a um post

**Files:**
- Create: `src/app/painel/admin/posts/actions.ts`
- Create: `src/app/painel/admin/posts/actions.test.ts`
- Create: `src/app/painel/admin/posts/page.tsx`
- Modify: `src/components/painel/navLinks.ts`
- Modify: `src/components/painel/navLinks.test.ts`

**Interfaces:**
- Consumes: `resolvePostUrl` (Task 4), `extractPdfText` (Task 3), `upsertPostListing`/`listPostListings`/`deletePostListing` (Task 2).

- [ ] **Step 1: Atualizar o link de navegação — teste**

Em `src/components/painel/navLinks.test.ts`, atualizar o segundo teste (o de `'ADMIN'`) para incluir o novo link, logo após `Produtos`:

```typescript
  it('returns the queue link plus admin links for ADMIN role', () => {
    expect(getNavLinks('ADMIN')).toEqual([
      { href: '/painel', label: 'Fila de Atendimento' },
      { href: '/painel/admin/setores', label: 'Setores' },
      { href: '/painel/admin/usuarios', label: 'Usuários' },
      { href: '/painel/admin/produtos', label: 'Produtos' },
      { href: '/painel/admin/posts', label: 'Posts com Imóvel' },
    ]);
  });
```

- [ ] **Step 2: Rodar pra confirmar que falha (RED)**

```bash
npx vitest run src/components/painel/navLinks.test.ts
```

Expected: FAIL — o array retornado por `getNavLinks('ADMIN')` ainda não tem o novo item.

- [ ] **Step 3: Atualizar `navLinks.ts`**

Em `src/components/painel/navLinks.ts`, no array `ADMIN_LINKS`, adicionar depois de `Produtos`:

```typescript
const ADMIN_LINKS: NavLink[] = [
  { href: '/painel/admin/setores', label: 'Setores' },
  { href: '/painel/admin/usuarios', label: 'Usuários' },
  { href: '/painel/admin/produtos', label: 'Produtos' },
  { href: '/painel/admin/posts', label: 'Posts com Imóvel' },
];
```

- [ ] **Step 4: Rodar pra confirmar que passa (GREEN)**

```bash
npx vitest run src/components/painel/navLinks.test.ts
```

Expected: PASS.

- [ ] **Step 5: Escrever os testes das actions**

Criar `src/app/painel/admin/posts/actions.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { db } from '@/lib/db';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/instagram/resolvePostUrl', () => ({ resolvePostUrl: vi.fn() }));
vi.mock('@/lib/pdf/extractPdfText', () => ({ extractPdfText: vi.fn() }));

import { getServerSession } from 'next-auth';
import { resolvePostUrl } from '@/lib/instagram/resolvePostUrl';
import { extractPdfText } from '@/lib/pdf/extractPdfText';
import { createPostListingAction, updatePostListingTextAction, deletePostListingAction } from './actions';

function formDataWithFile(entries: Record<string, string>, file?: { name: string; type: string; content: string }): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value);
  }
  if (file) {
    formData.set('pdf', new File([file.content], file.name, { type: file.type }));
  }
  return formData;
}

describe('createPostListingAction', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.postListing.deleteMany();
  });

  it('resolves the post URL, extracts the PDF text and saves a listing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    vi.mocked(resolvePostUrl).mockResolvedValue({ mediaId: 'media-abc' });
    vi.mocked(extractPdfText).mockResolvedValue('Apartamento 2 quartos');

    const formData = formDataWithFile(
      { postUrl: 'https://www.instagram.com/p/ABC123/' },
      { name: 'ficha.pdf', type: 'application/pdf', content: 'conteudo-fake' }
    );

    await createPostListingAction(formData);

    const listing = await db.postListing.findUnique({ where: { mediaId: 'media-abc' } });
    expect(listing?.propertyText).toBe('Apartamento 2 quartos');
    expect(listing?.postUrl).toBe('https://www.instagram.com/p/ABC123/');
  });

  it('saves the listing with empty propertyText when extraction fails, without throwing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    vi.mocked(resolvePostUrl).mockResolvedValue({ mediaId: 'media-abc' });
    vi.mocked(extractPdfText).mockResolvedValue('');

    const formData = formDataWithFile(
      { postUrl: 'https://www.instagram.com/p/ABC123/' },
      { name: 'ficha.pdf', type: 'application/pdf', content: 'conteudo-fake' }
    );

    await createPostListingAction(formData);

    const listing = await db.postListing.findUnique({ where: { mediaId: 'media-abc' } });
    expect(listing?.propertyText).toBe('');
  });

  it('rejects a non-PDF file', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);

    const formData = formDataWithFile(
      { postUrl: 'https://www.instagram.com/p/ABC123/' },
      { name: 'foto.png', type: 'image/png', content: 'conteudo-fake' }
    );

    await expect(createPostListingAction(formData)).rejects.toThrow('O arquivo precisa ser um PDF.');
    expect(resolvePostUrl).not.toHaveBeenCalled();
  });

  it('rejects when the caller is not an admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'AGENT' } } as never);

    const formData = formDataWithFile(
      { postUrl: 'https://www.instagram.com/p/ABC123/' },
      { name: 'ficha.pdf', type: 'application/pdf', content: 'conteudo-fake' }
    );

    await expect(createPostListingAction(formData)).rejects.toThrow(
      'Apenas administradores podem vincular PDFs a posts.'
    );
    expect(resolvePostUrl).not.toHaveBeenCalled();
  });
});

describe('updatePostListingTextAction', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.postListing.deleteMany();
  });

  it('updates the propertyText of an existing listing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    await db.postListing.create({ data: { mediaId: 'media-abc', postUrl: 'https://www.instagram.com/p/ABC123/', propertyText: 'Texto antigo' } });

    const formData = new FormData();
    formData.set('mediaId', 'media-abc');
    formData.set('postUrl', 'https://www.instagram.com/p/ABC123/');
    formData.set('propertyText', 'Texto corrigido pelo admin');

    await updatePostListingTextAction(formData);

    const listing = await db.postListing.findUnique({ where: { mediaId: 'media-abc' } });
    expect(listing?.propertyText).toBe('Texto corrigido pelo admin');
  });
});

describe('deletePostListingAction', () => {
  afterEach(async () => {
    vi.clearAllMocks();
    await db.postListing.deleteMany();
  });

  it('deletes the listing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { role: 'ADMIN' } } as never);
    const listing = await db.postListing.create({ data: { mediaId: 'media-abc', postUrl: 'https://www.instagram.com/p/ABC123/', propertyText: 'Texto' } });

    const formData = new FormData();
    formData.set('id', listing.id);

    await deletePostListingAction(formData);

    const found = await db.postListing.findUnique({ where: { mediaId: 'media-abc' } });
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 6: Rodar pra confirmar que falha (RED)**

```bash
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx vitest run src/app/painel/admin/posts/actions.test.ts
```

Expected: FAIL — o módulo `./actions` não existe.

- [ ] **Step 7: Implementar as actions**

Criar `src/app/painel/admin/posts/actions.ts`:

```typescript
'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/authOptions';
import { revalidatePath } from 'next/cache';
import { resolvePostUrl } from '@/lib/instagram/resolvePostUrl';
import { extractPdfText } from '@/lib/pdf/extractPdfText';
import { upsertPostListing, deletePostListing } from '@/lib/posts/postListingRepository';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

export async function createPostListingAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    throw new Error('Apenas administradores podem vincular PDFs a posts.');
  }

  const postUrl = String(formData.get('postUrl') ?? '').trim();
  const file = formData.get('pdf');

  if (!postUrl) {
    throw new Error('Link do post é obrigatório.');
  }
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Selecione um arquivo PDF.');
  }
  if (file.type !== 'application/pdf') {
    throw new Error('O arquivo precisa ser um PDF.');
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error('O PDF não pode passar de 10MB.');
  }

  const { mediaId } = await resolvePostUrl(postUrl);

  const buffer = Buffer.from(await file.arrayBuffer());
  const propertyText = await extractPdfText(buffer);

  await upsertPostListing({ mediaId, postUrl, propertyText });
  revalidatePath('/painel/admin/posts');
}

export async function updatePostListingTextAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    throw new Error('Apenas administradores podem editar o texto do imóvel.');
  }

  const mediaId = String(formData.get('mediaId') ?? '');
  const postUrl = String(formData.get('postUrl') ?? '');
  const propertyText = String(formData.get('propertyText') ?? '').trim();

  if (!propertyText) {
    throw new Error('Texto do imóvel é obrigatório.');
  }

  await upsertPostListing({ mediaId, postUrl, propertyText });
  revalidatePath('/painel/admin/posts');
}

export async function deletePostListingAction(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    throw new Error('Apenas administradores podem remover vínculos.');
  }

  const id = String(formData.get('id') ?? '');
  await deletePostListing(id);
  revalidatePath('/painel/admin/posts');
}
```

Nota: como o texto extraído fica vazio quando a extração falha (`extractPdfText` nunca lança), `createPostListingAction` **não** trata isso como erro — salva com `propertyText: ''` e a UI (Step 9) avisa e deixa o admin editar depois. Isso está de propósito, não é uma omissão.

- [ ] **Step 8: Rodar pra confirmar que passa (GREEN)**

```bash
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx vitest run src/app/painel/admin/posts/actions.test.ts
```

Expected: PASS, todos os testes.

- [ ] **Step 9: Criar a página**

Criar `src/app/painel/admin/posts/page.tsx`:

```tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/authOptions';
import { listPostListings } from '@/lib/posts/postListingRepository';
import { createPostListingAction, updatePostListingTextAction, deletePostListingAction } from './actions';

export default async function PostsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') {
    redirect('/painel');
  }

  const listings = await listPostListings();

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="font-display mb-6 text-xl font-bold text-nathai-ink">Posts com Imóvel</h1>
      <p className="mb-4 text-sm text-nathai-ink/60">
        Vincule um PDF a um post do Instagram. Quando alguém comentar nesse post e a conversa
        evoluir pra DM, a IA vai ter as informações do PDF como contexto durante toda a conversa.
      </p>
      <form
        action={createPostListingAction}
        encType="multipart/form-data"
        className="mb-8 space-y-3 rounded-2xl border border-nathai-mist bg-white p-4 shadow-card"
      >
        <input
          name="postUrl"
          type="url"
          required
          placeholder="Link do post (ex: https://www.instagram.com/p/ABC123/)"
          className="w-full rounded-xl border border-nathai-mist px-3 py-2 outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
        />
        <input
          name="pdf"
          type="file"
          accept="application/pdf"
          required
          className="w-full rounded-xl border border-nathai-mist px-3 py-2 text-sm outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-nathai-blue to-nathai-cyan px-4 py-2 font-display text-sm font-semibold text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover"
        >
          Vincular PDF ao post
        </button>
      </form>
      <ul className="space-y-4">
        {listings.map((listing) => (
          <li key={listing.id} className="rounded-2xl border border-nathai-mist bg-white p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between gap-2">
              <a
                href={listing.postUrl}
                target="_blank"
                rel="noreferrer"
                className="truncate text-sm text-nathai-blue hover:underline"
              >
                {listing.postUrl}
              </a>
              <form action={deletePostListingAction}>
                <input type="hidden" name="id" value={listing.id} />
                <button type="submit" className="text-xs text-red-600 hover:underline">
                  Remover
                </button>
              </form>
            </div>
            {!listing.propertyText && (
              <p className="mb-2 text-xs font-medium text-nathai-amber">
                Texto vazio — não conseguimos extrair do PDF. Digite manualmente abaixo.
              </p>
            )}
            <form action={updatePostListingTextAction} className="space-y-2">
              <input type="hidden" name="mediaId" value={listing.mediaId} />
              <input type="hidden" name="postUrl" value={listing.postUrl} />
              <textarea
                name="propertyText"
                defaultValue={listing.propertyText}
                rows={6}
                placeholder="Texto do imóvel (preço, metragem, condições...)"
                className="w-full rounded-xl border border-nathai-mist px-3 py-2 text-sm outline-none transition focus:border-nathai-blue focus:ring-2 focus:ring-nathai-blue/20"
              />
              <button
                type="submit"
                className="rounded-lg bg-gradient-to-r from-nathai-blue to-nathai-cyan px-3 py-1 font-display text-sm font-medium text-white shadow-button transition-all duration-200 hover:-translate-y-0.5 hover:shadow-button-hover"
              >
                Salvar texto
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 10: Rodar o typecheck**

```bash
npx tsc --noEmit
```

Expected: sem erros.

- [ ] **Step 11: Commit**

```bash
git add src/app/painel/admin/posts src/components/painel/navLinks.ts src/components/painel/navLinks.test.ts
git commit -m "Add admin page to link a PDF's extracted text to an Instagram post

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Documentação e validação final

**Files:**
- Modify: `n8n/README.md`

**Interfaces:** N/A (documentação + validação).

- [ ] **Step 1: Atualizar a tabela de workflows**

Em `n8n/README.md`, na tabela do início do arquivo, adicionar uma linha depois de `lead-webhook-rdstation.json`:

```markdown
| `resolve-post-url.json` | Recebe um link de post do Instagram, devolve o `media_id` correspondente | Next.js (tela de admin "Posts com Imóvel", via `resolvePostUrl.ts`, `N8N_RESOLVE_POST_URL_WEBHOOK_URL`) |
```

- [ ] **Step 2: Adicionar uma seção explicando o recurso**

No final de `n8n/README.md`, adicionar:

```markdown

## Contexto de imóvel por post (PDF vinculado)

Um admin vincula um PDF a um post específico na tela `/painel/admin/posts`
do Next.js. Quando alguém comenta nesse post, o node `Parse Evento
Comentario` de `webhook-in-instagram.json` guarda `{mediaId, timestamp}`
por `commenterId` na memória do workflow (`$getWorkflowStaticData('global')`,
chave `postContextByCommenter`), expirando entradas com mais de 7 dias. Se
essa pessoa responder a DM aberta pelo comentário, `Parse Evento Instagram`
resgata esse vínculo e inclui `originMediaId` no payload mandado pro
Next.js — que grava esse valor na conversa (só na criação, nunca depois) e
usa o texto do PDF vinculado como contexto extra pra IA em todo turno da
conversa.

Limitação aceita: se a mesma pessoa comentar em posts diferentes antes de
responder a alguma DM, o vínculo mais recente sobrescreve o anterior (a
memória é por `commenterId`, não por comentário específico).
```

- [ ] **Step 3: Rodar a suíte completa**

```bash
DATABASE_URL="postgresql://<usuario>:<senha>@<host-vps>:5432/<banco_descartavel>" npx vitest run
```

Expected: todos os testes passam (os já existentes + todos os adicionados nas Tasks 1-9).

- [ ] **Step 4: Rodar o build**

```bash
npm run build
```

Expected: build conclui sem erros.

- [ ] **Step 5: Validar os 4 JSONs do n8n de uma vez**

```bash
node -e "
['n8n/webhook-in-instagram.json', 'n8n/instagram-send.json', 'n8n/lead-webhook-rdstation.json', 'n8n/resolve-post-url.json'].forEach((f) => {
  JSON.parse(require('fs').readFileSync(f, 'utf-8'));
  console.log(f + ': OK');
});
"
```

Expected: as 4 linhas `OK`.

- [ ] **Step 6: Commit**

```bash
git add n8n/README.md
git commit -m "Document the resolve-post-url bridge and the per-post PDF context feature

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Fora deste plano (passos operacionais, não implementação)

- Importar `n8n/resolve-post-url.json` na instância n8n do cliente, configurar credencial e `igUserId`/`graphApiVersion`.
- Configurar `N8N_RESOLVE_POST_URL_WEBHOOK_URL` no `.env` real do EasyPanel.
- Aplicar a migration da Task 1 no banco de produção (`dbagenteinsta`) — feito separadamente, fora deste plano, quando o deploy for feito.
- Teste ponta-a-ponta manual: vincular um PDF de verdade a um post real, comentar com uma conta de teste, confirmar que a IA usa o contexto certo.
