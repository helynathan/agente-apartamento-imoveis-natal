# Migração WhattsAtendeBless → Apartamento e Imóveis Natal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer o código da `WhattsAtendeBless` (Next.js + Prisma, painel de atendimento humano com WhatsApp + Instagram) para `AgenteInstagram`, reconfigurado para o cliente Apartamento e Imóveis Natal, com RD Station como CRM e três workflows n8n de ponte fina (não mais orquestradores de conversa).

**Architecture:** Cópia quase integral do código Next.js (a lógica de conversa/IA já é agnóstica de cliente); o n8n deste cliente fica reduzido a 3 papéis — normalizar/repassar eventos de Instagram pro Next.js, enviar mensagens de Instagram via Graph API, e sincronizar leads com o RD Station. O código antigo de `AgenteInstagram` (workflow WhatsApp com bug conhecido, agente de Instagram arquivado) é apagado.

**Tech Stack:** Next.js 14 + Prisma 5 + NextAuth + Vitest, Postgres, n8n (workflows JSON), OpenAI (`gpt-4o-mini`), Evolution API (WhatsApp), Instagram Graph API, RD Station CRM API v1.

**Spec:** `docs/superpowers/specs/2026-09-08-migracao-whattsatendebless-apartamento-imoveis-natal-design.md`

## Global Constraints

- CRM é RD Station (não Vista/LOFT) — confirmado pelo usuário.
- LLM único do projeto é OpenAI — já é o que o código copiado usa (`gpt-4o-mini`), nenhuma mudança de provedor.
- Infraestrutura isolada por cliente: banco Postgres, instância n8n e deploy próprios deste cliente, sem compartilhar com a infra da Bless.
- `VISTA_*` fica deliberadamente sem configurar — cliente ainda não tem portal de imóveis; o código correspondente permanece no repositório mas inerte.
- Conteúdo antigo de `AgenteInstagram` (`n8n/workflow.json`, `n8n/schema.sql`, `README-N8N.md`, `archive-instagram-agent/`) é apagado, não arquivado — decisão explícita do usuário.
- Preservar as proteções de loop/dedup/eco do Instagram e a resolução de PSID via `/conversations` já validadas em produção — não reescrever essa lógica do zero.

---

### Task 1: Copiar o código da WhattsAtendeBless para AgenteInstagram

**Files:**
- Create: todo o conteúdo de `C:\Users\helyn\OneDrive\Documents\Desenvolvimento\WhattsAtendeBless` copiado para a raiz de `C:\Users\helyn\OneDrive\Documents\Desenvolvimento\AgenteInstagram`, exceto `node_modules/`, `.next/`, `.git/`, `.worktrees/`, `tsconfig.tsbuildinfo`.
- Não afeta: `AgenteInstagram\docs\superpowers\specs\` e `AgenteInstagram\docs\superpowers\plans\` (já existem, ficam como estão — o `docs/superpowers` da WhattsAtendeBless tem specs/plans diferentes, dela mesma; não devem sobrescrever os deste projeto).

**Interfaces:** N/A (task de cópia de arquivos, não produz interface de código).

- [ ] **Step 1: Copiar a árvore de arquivos, excluindo artefatos de build/deps**

Rodar (PowerShell, `robocopy` lida bem com exclusões grandes tipo `node_modules`):

```powershell
robocopy "C:\Users\helyn\OneDrive\Documents\Desenvolvimento\WhattsAtendeBless" "C:\Users\helyn\OneDrive\Documents\Desenvolvimento\AgenteInstagram" /E /XD node_modules .next .git .worktrees "C:\Users\helyn\OneDrive\Documents\Desenvolvimento\WhattsAtendeBless\docs" /XF tsconfig.tsbuildinfo
```

Nota: exclui a pasta `docs` inteira da origem porque `AgenteInstagram` já tem sua própria `docs/superpowers` (specs/plans deste projeto) — copiá-la sobrescreveria/misturaria com os specs/plans da Bless. O `docs/superpowers` da WhattsAtendeBless não é necessário aqui.

**Step 2: Verificar que a cópia trouxe os arquivos esperados**

```bash
ls "C:\Users\helyn\OneDrive\Documents\Desenvolvimento\AgenteInstagram\src\app\api\webhook\instagram\[secret]\route.ts"
ls "C:\Users\helyn\OneDrive\Documents\Desenvolvimento\AgenteInstagram\prisma\schema.prisma"
ls "C:\Users\helyn\OneDrive\Documents\Desenvolvimento\AgenteInstagram\package.json"
```

Esperado: os três arquivos existem. Robocopy retorna código de saída 1 em caso de sucesso com arquivos copiados (não é erro — só falha real é código >= 8).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\helyn\OneDrive\Documents\Desenvolvimento\AgenteInstagram"
git add src prisma scripts package.json package-lock.json tsconfig.json vitest.config.ts next.config.mjs next-env.d.ts postcss.config.cjs tailwind.config.ts middleware.ts Dockerfile docker-compose.yml .dockerignore .gitignore .env.example public
git commit -m "Copy WhattsAtendeBless codebase as base for this client

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Apagar o conteúdo antigo de AgenteInstagram

**Files:**
- Delete: `n8n/workflow.json`, `n8n/schema.sql`, `README-N8N.md`, `archive-instagram-agent/` (pasta inteira).

**Interfaces:** N/A.

- [ ] **Step 1: Apagar os arquivos/pastas antigos**

```bash
cd "C:\Users\helyn\OneDrive\Documents\Desenvolvimento\AgenteInstagram"
rm -f n8n/workflow.json n8n/schema.sql README-N8N.md
rm -rf archive-instagram-agent
```

- [ ] **Step 2: Verificar que sumiram e que a pasta `n8n/` ficou vazia (será repovoada nas próximas tasks)**

```bash
ls n8n/ 2>&1
ls archive-instagram-agent 2>&1
```

Esperado: `n8n/` vazia ou inexistente; `archive-instagram-agent` não encontrado.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Remove legacy prototype content (old n8n workflow, archived Instagram agent)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Instalar dependências e validar que a cópia builda

**Files:** Nenhum arquivo novo (gera `node_modules/`, `package-lock.json` já existe e deve ser respeitado).

**Interfaces:** N/A.

- [ ] **Step 1: Instalar dependências**

```bash
cd "C:\Users\helyn\OneDrive\Documents\Desenvolvimento\AgenteInstagram"
npm install
```

- [ ] **Step 2: Rodar a suíte de testes existente (deve passar sem alteração de lógica)**

```bash
npm test
```

Esperado: todos os testes passam (a suíte da WhattsAtendeBless não depende de credenciais reais — usa mocks/DB de teste).

- [ ] **Step 3: Rodar o build de produção**

```bash
npm run build
```

Esperado: build conclui sem erro de tipo ou de compilação.

- [ ] **Step 4: Commit (só se `npm install` alterou o lockfile)**

```bash
git status --porcelain package-lock.json
```

Se houver diferença:

```bash
git add package-lock.json
git commit -m "Update lockfile after fresh install

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Identidade do projeto (package.json) e variáveis de ambiente

**Files:**
- Modify: `package.json:2` (campo `"name"`)
- Modify: `.env.example` (adicionar comentário sobre `VISTA_*` ficar sem uso por enquanto)

**Interfaces:** N/A.

- [ ] **Step 1: Renomear o projeto em `package.json`**

Em `package.json`, trocar:

```json
  "name": "whattsatendebless",
```

por:

```json
  "name": "agente-apartamento-imoveis-natal",
```

- [ ] **Step 2: Anotar no `.env.example` que `VISTA_*` fica fora de escopo por enquanto**

Adicionar comentário logo acima das linhas `VISTA_API_KEY`/`VISTA_CODIGO_USUARIO`/`VISTA_CODIGO_IMOBILIARIA` em `.env.example`:

```
# Catálogo de imóveis (Vista Software) — fora de escopo por enquanto, cliente ainda não tem portal.
# Deixe em branco: a busca de produtos degrada bem sozinha (retorna lista vazia) sem essas credenciais.
VISTA_API_KEY="changeme"
VISTA_CODIGO_USUARIO="changeme"
VISTA_CODIGO_IMOBILIARIA="changeme"
```

- [ ] **Step 3: Verificar que o projeto ainda builda após a mudança de nome**

```bash
npm run build
```

Esperado: build passa (o campo `name` do `package.json` não afeta o build do Next.js).

- [ ] **Step 4: Commit**

```bash
git add package.json .env.example
git commit -m "Set project identity for Apartamento e Imóveis Natal; document Vista as out of scope

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Seed dos setores do painel

O prompt de IA já copiado (`src/lib/ai/openaiClient.ts:52-55`) tem os critérios de roteamento
**hardcoded** para os nomes `Administrativo`, `Comercial` e `Financeiro` — usar esses nomes exatos
faz o roteamento automático funcionar sem tocar no prompt.

**Files:**
- Create: `scripts/seed-sectors.ts`
- Modify: `package.json` (novo script `seed-sectors`)

**Interfaces:**
- Consumes: `createSector(name: string): Promise<{id: string; name: string}>` e `listSectors(): Promise<Array<{id: string; name: string}>>` de `src/lib/sectors/sectorRepository.ts` (já existentes, sem alteração).
- Produces: script `npm run seed-sectors`, idempotente.

- [ ] **Step 1: Criar o script de seed**

Criar `scripts/seed-sectors.ts`:

```typescript
import { createSector, listSectors } from '@/lib/sectors/sectorRepository';
import { db } from '@/lib/db';

const REQUIRED_SECTORS = ['Comercial', 'Administrativo', 'Financeiro'];

async function main() {
  const existing = await listSectors();
  const existingNames = new Set(existing.map((s) => s.name));

  for (const name of REQUIRED_SECTORS) {
    if (existingNames.has(name)) {
      console.log(`Setor já existe, pulando: ${name}`);
      continue;
    }
    const sector = await createSector(name);
    console.log(`Setor criado: ${sector.name} (${sector.id})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
```

- [ ] **Step 2: Registrar o script no `package.json`**

Em `package.json`, na seção `"scripts"`, adicionar (seguindo o padrão dos scripts existentes como `"create-admin": "tsx scripts/create-admin.ts"`):

```json
    "seed-sectors": "tsx scripts/seed-sectors.ts",
```

- [ ] **Step 3: Verificar que compila (sem banco real disponível ainda, só checagem de tipos)**

```bash
npx tsc --noEmit
```

Esperado: sem erros de tipo no novo arquivo.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-sectors.ts package.json
git commit -m "Add idempotent seed script for the three sectors the AI prompt already routes to

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(Rodar `npm run seed-sectors` de fato fica para quando o Postgres deste cliente estiver provisionado — está documentado no `n8n/README.md` da Task 9 como passo operacional.)

---

### Task 6: Workflow n8n — `webhook-in-instagram` (normaliza e repassa pro Next.js)

Extraído de `Instagram Bless/n8n/apartamento-imoveis-natal-instagram-crm.json` — mantém webhook de
verificação, parsing do evento, resolução de PSID (a parte "mais confusa" documentada no projeto Bless)
e todas as proteções de loop/dedup. Remove `AI Agent`, memória e os nós de CRM — troca por uma chamada
HTTP simples pro Next.js.

**Files:**
- Create: `n8n/webhook-in-instagram.json`

**Interfaces:**
- Produces: `POST {NEXTJS_WEBHOOK_BASE_URL}/api/webhook/instagram/{NEXTJS_WEBHOOK_SECRET}` com corpo `{"senderId": string, "messageId": string, "content": string}` — consumido pela Task 1 do código já copiado (`src/app/api/webhook/instagram/[secret]/route.ts`, que espera exatamente esses três campos, ver `parseInstagramWebhook.ts`).

- [ ] **Step 1: Criar o workflow**

Criar `n8n/webhook-in-instagram.json`:

```json
{
  "name": "Apartamento Imoveis Natal - Instagram Webhook In",
  "nodes": [
    {
      "parameters": {
        "content": "## Setup antes de ativar\n\n1. Preencha `igUserId` e `graphApiVersion` no node \"Config\" (mesmos valores já usados no workflow antigo deste cliente).\n2. Credencial Instagram (HTTP Header Auth): Header Name = `Authorization`, Header Value = `Bearer SEU_ACCESS_TOKEN`. Selecione nos 3 nodes de HTTP Request que chamam graph.instagram.com.\n3. Variáveis de ambiente do n8n: `NEXTJS_WEBHOOK_BASE_URL` (ex: https://painel.seudominio.com) e `NEXTJS_WEBHOOK_SECRET` (mesmo valor de `WEBHOOK_SECRET` no .env do Next.js).\n4. Webhook do Meta: Callback URL = URL de produção do node \"Webhook Verificação\"; Verify Token = valor usado no node \"IF Token Válido\" (troque `apartamentoimoveis-verify-2026` se quiser, mantendo igual nos dois lugares). Inscreva os campos `messages` e `comments`.",
        "height": 380,
        "width": 460
      },
      "type": "n8n-nodes-base.stickyNote",
      "typeVersion": 1,
      "position": [-1120, -520],
      "id": "sticky-setup",
      "name": "Instruções de Setup"
    },
    {
      "parameters": { "httpMethod": "GET", "path": "apartamentoimoveis-instagram", "responseMode": "responseNode", "options": {} },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [-1120, -40],
      "id": "webhook-verify",
      "name": "Webhook Verificação",
      "webhookId": "apartamentoimoveis-instagram-verify"
    },
    {
      "parameters": {
        "conditions": {
          "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "loose" },
          "conditions": [
            { "id": "cond-verify-token", "leftValue": "={{ $json.query[\"hub.verify_token\"] }}", "rightValue": "apartamentoimoveis-verify-2026", "operator": { "type": "string", "operation": "equals" } }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [-880, -40],
      "id": "if-verify-token",
      "name": "IF Token Válido"
    },
    {
      "parameters": { "respondWith": "text", "responseBody": "={{ $json.query[\"hub.challenge\"] }}", "options": {} },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [-640, -140],
      "id": "respond-ok",
      "name": "Responder Challenge"
    },
    {
      "parameters": { "respondWith": "text", "responseBody": "Forbidden", "options": { "responseCode": 403 } },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [-640, 60],
      "id": "respond-forbidden",
      "name": "Responder Forbidden"
    },
    {
      "parameters": { "httpMethod": "POST", "path": "apartamentoimoveis-instagram", "responseMode": "onReceived", "options": {} },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [-1120, 320],
      "id": "webhook-events",
      "name": "Webhook Eventos",
      "webhookId": "apartamentoimoveis-instagram-events"
    },
    {
      "parameters": {
        "assignments": {
          "assignments": [
            { "id": "cfg-ig-user-id", "name": "igUserId", "value": "17841409145832360", "type": "string" },
            { "id": "cfg-graph-version", "name": "graphApiVersion", "value": "v25.0", "type": "string" },
            { "id": "cfg-comment-public-reply", "name": "commentPublicReply", "value": "Te chamamos no Direct! 📩 Vem conversar com a gente por lá.", "type": "string" },
            { "id": "cfg-comment-dm-opening", "name": "commentDmOpening", "value": "Oi! Vimos seu comentário no post 😊 Sou o assistente da Apartamento Imóveis Natal — posso te ajudar com compra, locação ou administração de imóveis. O que você está procurando?", "type": "string" }
          ]
        },
        "includeOtherFields": true,
        "options": {}
      },
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [-880, 320],
      "id": "config",
      "name": "Config"
    },
    {
      "parameters": {
        "jsCode": "const body = $input.first().json.body;\nconst entry = body?.entry?.[0];\nconst messaging = entry?.messaging?.[0];\nconst ourAccountId = entry?.id;\n\nif (\n  !messaging ||\n  !messaging.message ||\n  messaging.message.is_echo ||\n  !messaging.message.text ||\n  messaging.sender?.id === ourAccountId\n) {\n  return [];\n}\n\nconst mid = messaging.message.mid;\n\nconst staticData = $getWorkflowStaticData('node');\nstaticData.processedMessageIds = staticData.processedMessageIds || {};\nif (mid && staticData.processedMessageIds[mid]) {\n  return [];\n}\nif (mid) {\n  staticData.processedMessageIds[mid] = true;\n}\n\nreturn [{\n  json: {\n    senderId: messaging.sender.id,\n    recipientId: messaging.recipient.id,\n    messageText: messaging.message.text,\n    messageId: mid,\n  },\n}];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-640, 320],
      "id": "parse-event",
      "name": "Parse Evento Instagram"
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{ 'https://graph.instagram.com/' + $('Config').item.json.graphApiVersion + '/' + $('Config').item.json.igUserId + '/conversations?fields=participants&limit=25' }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-560, 460],
      "id": "fetch-conversation",
      "name": "Buscar Conversa",
      "credentials": { "httpHeaderAuth": { "id": "REPLACE_ME", "name": "Instagram Graph API" } }
    },
    {
      "parameters": {
        "jsCode": "const conv = $input.first().json;\nconst senderId = $('Parse Evento Instagram').item.json.senderId;\nconst conversations = conv.data || [];\n\n// Não pega cegamente a primeira conversa (limit=1) — procura a que realmente contém\n// quem mandou a mensagem atual, senão o bot pode responder pra pessoa errada quando\n// há várias conversas ativas ao mesmo tempo (bug real documentado no projeto-base).\nlet resolvedId = null;\nfor (const conversation of conversations) {\n  const participants = conversation.participants ? conversation.participants.data : [];\n  const match = participants.find((p) => p.id === senderId);\n  if (match) {\n    const other = participants.find((p) => p.id !== $('Config').item.json.igUserId);\n    resolvedId = other ? other.id : senderId;\n    break;\n  }\n}\n\nreturn [{\n  json: {\n    ...$('Parse Evento Instagram').item.json,\n    recipientId: resolvedId || senderId,\n  },\n}];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-440, 460],
      "id": "extract-psid",
      "name": "Extrair PSID"
    },
    {
      "parameters": {
        "jsCode": "return [{\n  json: {\n    senderId: $json.recipientId,\n    messageId: $json.messageId,\n    content: $json.messageText,\n  },\n}];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-200, 460],
      "id": "build-payload",
      "name": "Montar Payload Next.js"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.NEXTJS_WEBHOOK_BASE_URL + '/api/webhook/instagram/' + $env.NEXTJS_WEBHOOK_SECRET }}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [40, 460],
      "id": "forward-to-nextjs",
      "name": "Enviar para Next.js"
    },
    {
      "parameters": {
        "jsCode": "const body = $input.first().json.body;\nconst entry = body?.entry?.[0];\nconst change = entry?.changes?.find((c) => c.field === 'comments');\nconst ourAccountId = entry?.id;\n\nif (!change) {\n  return [];\n}\n\nconst value = change.value;\n\nif (!value || !value.id || value.from?.id === ourAccountId) {\n  return [];\n}\n\nconst commentId = value.id;\n\nconst staticData = $getWorkflowStaticData('node');\nstaticData.processedCommentIds = staticData.processedCommentIds || {};\nif (staticData.processedCommentIds[commentId]) {\n  return [];\n}\nstaticData.processedCommentIds[commentId] = true;\n\nreturn [{\n  json: {\n    commentId,\n    commentText: value.text || '',\n    commenterId: value.from?.id || null,\n  },\n}];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-640, 700],
      "id": "parse-comment",
      "name": "Parse Evento Comentario"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ 'https://graph.instagram.com/' + $('Config').item.json.graphApiVersion + '/' + $json.commentId + '/replies' }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendQuery": true,
        "queryParameters": { "parameters": [ { "name": "message", "value": "={{ $('Config').item.json.commentPublicReply }}" } ] },
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-440, 700],
      "id": "reply-comment-public",
      "name": "Responder Comentario Publicamente",
      "credentials": { "httpHeaderAuth": { "id": "REPLACE_ME", "name": "Instagram Graph API" } }
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ 'https://graph.instagram.com/' + $('Config').item.json.graphApiVersion + '/' + $('Config').item.json.igUserId + '/messages' }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ { recipient: { comment_id: $('Parse Evento Comentario').item.json.commentId }, message: { text: $('Config').item.json.commentDmOpening } } }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-240, 700],
      "id": "send-comment-dm",
      "name": "Enviar DM Privada do Comentario",
      "credentials": { "httpHeaderAuth": { "id": "REPLACE_ME", "name": "Instagram Graph API" } }
    }
  ],
  "connections": {
    "Webhook Verificação": { "main": [[{ "node": "IF Token Válido", "type": "main", "index": 0 }]] },
    "IF Token Válido": { "main": [[{ "node": "Responder Challenge", "type": "main", "index": 0 }], [{ "node": "Responder Forbidden", "type": "main", "index": 0 }]] },
    "Webhook Eventos": { "main": [[{ "node": "Config", "type": "main", "index": 0 }]] },
    "Config": { "main": [[{ "node": "Parse Evento Instagram", "type": "main", "index": 0 }, { "node": "Parse Evento Comentario", "type": "main", "index": 0 }]] },
    "Parse Evento Instagram": { "main": [[{ "node": "Buscar Conversa", "type": "main", "index": 0 }]] },
    "Buscar Conversa": { "main": [[{ "node": "Extrair PSID", "type": "main", "index": 0 }]] },
    "Extrair PSID": { "main": [[{ "node": "Montar Payload Next.js", "type": "main", "index": 0 }]] },
    "Montar Payload Next.js": { "main": [[{ "node": "Enviar para Next.js", "type": "main", "index": 0 }]] },
    "Parse Evento Comentario": { "main": [[{ "node": "Responder Comentario Publicamente", "type": "main", "index": 0 }]] },
    "Responder Comentario Publicamente": { "main": [[{ "node": "Enviar DM Privada do Comentario", "type": "main", "index": 0 }]] }
  },
  "active": false,
  "settings": { "executionOrder": "v1" },
  "pinData": {}
}
```

- [ ] **Step 2: Validar que o JSON é sintaticamente válido**

```bash
node -e "JSON.parse(require('fs').readFileSync('n8n/webhook-in-instagram.json', 'utf-8')); console.log('OK')"
```

Esperado: imprime `OK`.

- [ ] **Step 3: Commit**

```bash
git add n8n/webhook-in-instagram.json
git commit -m "Add n8n bridge: normalize Instagram webhook events and forward to Next.js

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Workflow n8n — `instagram-send` (envia mensagem via Graph API)

**Files:**
- Create: `n8n/instagram-send.json`

**Interfaces:**
- Consumes: `POST` com corpo `{"externalId": string, "content": string}` — mesmo formato enviado por `src/lib/instagram/sendInstagramMessage.ts:7-11` (já copiado, sem alteração).
- Produces: resposta `{"id": string}` — consumida por `sendInstagramMessage.ts:18-20`, que espera `data.id`.

- [ ] **Step 1: Criar o workflow**

Criar `n8n/instagram-send.json`:

```json
{
  "name": "Apartamento Imoveis Natal - Instagram Send",
  "nodes": [
    {
      "parameters": {
        "content": "## Setup antes de ativar\n\n1. Preencha `igUserId`/`graphApiVersion` no node \"Config\" (mesmos valores do workflow webhook-in-instagram).\n2. Credencial Instagram (HTTP Header Auth) no node \"Enviar Mensagem Instagram\".\n3. No `.env` do Next.js, `N8N_INSTAGRAM_SEND_WEBHOOK_URL` deve apontar pra Production URL do node \"Webhook\" abaixo.",
        "height": 260,
        "width": 400
      },
      "type": "n8n-nodes-base.stickyNote",
      "typeVersion": 1,
      "position": [-880, -300],
      "id": "sticky-setup",
      "name": "Instruções de Setup"
    },
    {
      "parameters": { "httpMethod": "POST", "path": "apartamentoimoveis-instagram-send", "responseMode": "responseNode", "options": {} },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [-880, 0],
      "id": "webhook",
      "name": "Webhook",
      "webhookId": "apartamentoimoveis-instagram-send"
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
      "position": [-640, 0],
      "id": "config",
      "name": "Config"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ 'https://graph.instagram.com/' + $json.graphApiVersion + '/' + $json.igUserId + '/messages' }}",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ { recipient: { id: $json.body.externalId }, message: { text: $json.body.content } } }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-400, 0],
      "id": "send-message",
      "name": "Enviar Mensagem Instagram",
      "credentials": { "httpHeaderAuth": { "id": "REPLACE_ME", "name": "Instagram Graph API" } }
    },
    {
      "parameters": { "respondWith": "json", "responseBody": "={{ { id: $json.message_id } }}", "options": {} },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [-160, 0],
      "id": "respond",
      "name": "Responder"
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "Config", "type": "main", "index": 0 }]] },
    "Config": { "main": [[{ "node": "Enviar Mensagem Instagram", "type": "main", "index": 0 }]] },
    "Enviar Mensagem Instagram": { "main": [[{ "node": "Responder", "type": "main", "index": 0 }]] }
  },
  "active": false,
  "settings": { "executionOrder": "v1" },
  "pinData": {}
}
```

- [ ] **Step 2: Validar JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('n8n/instagram-send.json', 'utf-8')); console.log('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add n8n/instagram-send.json
git commit -m "Add n8n bridge: send Instagram messages via Graph API on behalf of the Next.js app

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Workflow n8n — `lead-webhook-rdstation` (sincroniza lead com RD Station)

Construído do zero, reaproveitando os padrões de upsert de contato e criação de negociação já usados
no antigo `n8n/workflow.json` deste projeto (apagado na Task 2, mas a lógica RD Station validada é
reaproveitada aqui).

**Files:**
- Create: `n8n/lead-webhook-rdstation.json`

**Interfaces:**
- Consumes: `POST` com corpo `{"telefone": string, "nome"?: string, "historico": Array<{direction: "INBOUND"|"OUTBOUND", content: string}>, "interesse"?: string, "canal": "WhatsApp"|"Instagram", "link": string}` — mesmo formato produzido por `src/lib/crm/notifyLeadToCrm.ts:6-13` (já copiado, sem alteração).
- Produces: resposta `{"ok": true}`.

- [ ] **Step 1: Criar o workflow**

Criar `n8n/lead-webhook-rdstation.json`:

```json
{
  "name": "Apartamento Imoveis Natal - Lead to RD Station",
  "nodes": [
    {
      "parameters": {
        "content": "## Setup antes de ativar\n\n1. Variável de ambiente do n8n: `RD_CRM_TOKEN` (token da API do RD Station CRM).\n2. No `.env` do Next.js, `N8N_LEAD_WEBHOOK_URL` deve apontar pra Production URL do node \"Webhook\" abaixo.",
        "height": 220,
        "width": 400
      },
      "type": "n8n-nodes-base.stickyNote",
      "typeVersion": 1,
      "position": [-1120, -280],
      "id": "sticky-setup",
      "name": "Instruções de Setup"
    },
    {
      "parameters": { "httpMethod": "POST", "path": "apartamentoimoveis-lead-rdstation", "responseMode": "responseNode", "options": {} },
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2,
      "position": [-1120, 0],
      "id": "webhook",
      "name": "Webhook",
      "webhookId": "apartamentoimoveis-lead-rdstation"
    },
    {
      "parameters": {
        "method": "GET",
        "url": "={{ 'https://crm.rdstation.com/api/v1/contacts?token=' + $env.RD_CRM_TOKEN + '&phone=' + encodeURIComponent($json.body.telefone) }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-880, 0],
      "id": "rd-search",
      "name": "Buscar Contato RD Station"
    },
    {
      "parameters": {
        "conditions": {
          "options": { "caseSensitive": true, "leftValue": "", "typeValidation": "loose" },
          "conditions": [ { "id": "cond-exists", "leftValue": "={{ ($json.contacts && $json.contacts.length > 0) }}", "rightValue": true, "operator": { "type": "boolean", "operation": "equals" } } ],
          "combinator": "and"
        },
        "options": {}
      },
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [-640, 0],
      "id": "rd-if-exists",
      "name": "Contato já existe?"
    },
    {
      "parameters": {
        "method": "PUT",
        "url": "={{ 'https://crm.rdstation.com/api/v1/contacts/' + $json.contacts[0]._id + '?token=' + $env.RD_CRM_TOKEN }}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ { contact: { name: $('Webhook').item.json.body.nome, phones: [{ phone: $('Webhook').item.json.body.telefone, type: 'cellphone' }] } } }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-400, -120],
      "id": "rd-update",
      "name": "Atualizar Contato RD Station"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ 'https://crm.rdstation.com/api/v1/contacts?token=' + $env.RD_CRM_TOKEN }}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ { contact: { name: $('Webhook').item.json.body.nome, phones: [{ phone: $('Webhook').item.json.body.telefone, type: 'cellphone' }] } } }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [-400, 120],
      "id": "rd-create",
      "name": "Criar Contato RD Station"
    },
    {
      "parameters": {
        "jsCode": "const historico = $('Webhook').item.json.body.historico || [];\nconst resumo = historico.map((m) => (m.direction === 'INBOUND' ? 'Cliente: ' : 'Atendimento: ') + m.content).join('\\n');\nconst link = $('Webhook').item.json.body.link;\n\nreturn [{\n  json: {\n    contactId: $json._id,\n    resumo: resumo + (link ? '\\n\\nConversa: ' + link : ''),\n  },\n}];\n"
      },
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-160, 0],
      "id": "build-summary",
      "name": "Montar Resumo"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ 'https://crm.rdstation.com/api/v1/deals?token=' + $env.RD_CRM_TOKEN }}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ { deal: { name: '[' + $('Webhook').item.json.body.canal + '] ' + ($('Webhook').item.json.body.interesse || 'lead') + ' - ' + ($('Webhook').item.json.body.nome || 'sem nome') }, contacts: [{ id: $json.contactId }] } }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [80, 0],
      "id": "rd-deal",
      "name": "Criar Negociação RD Station"
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ 'https://crm.rdstation.com/api/v1/activities?token=' + $env.RD_CRM_TOKEN }}",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ { activity: { deal_id: $json._id, text: 'Resumo da conversa:\\n' + $('Montar Resumo').item.json.resumo } } }}",
        "options": {}
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [320, 0],
      "id": "rd-note",
      "name": "Criar Anotação RD Station"
    },
    {
      "parameters": { "respondWith": "json", "responseBody": "={{ { ok: true } }}", "options": {} },
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.1,
      "position": [560, 0],
      "id": "respond",
      "name": "Responder"
    }
  ],
  "connections": {
    "Webhook": { "main": [[{ "node": "Buscar Contato RD Station", "type": "main", "index": 0 }]] },
    "Buscar Contato RD Station": { "main": [[{ "node": "Contato já existe?", "type": "main", "index": 0 }]] },
    "Contato já existe?": { "main": [[{ "node": "Atualizar Contato RD Station", "type": "main", "index": 0 }], [{ "node": "Criar Contato RD Station", "type": "main", "index": 0 }]] },
    "Atualizar Contato RD Station": { "main": [[{ "node": "Montar Resumo", "type": "main", "index": 0 }]] },
    "Criar Contato RD Station": { "main": [[{ "node": "Montar Resumo", "type": "main", "index": 0 }]] },
    "Montar Resumo": { "main": [[{ "node": "Criar Negociação RD Station", "type": "main", "index": 0 }]] },
    "Criar Negociação RD Station": { "main": [[{ "node": "Criar Anotação RD Station", "type": "main", "index": 0 }]] },
    "Criar Anotação RD Station": { "main": [[{ "node": "Responder", "type": "main", "index": 0 }]] }
  },
  "active": false,
  "settings": { "executionOrder": "v1" },
  "pinData": {}
}
```

- [ ] **Step 2: Validar JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('n8n/lead-webhook-rdstation.json', 'utf-8')); console.log('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add n8n/lead-webhook-rdstation.json
git commit -m "Add n8n bridge: sync qualified leads to RD Station CRM

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Documentar os 3 workflows-ponte e o setup operacional

**Files:**
- Create: `n8n/README.md`

**Interfaces:** N/A (documentação).

- [ ] **Step 1: Criar o README**

Criar `n8n/README.md`:

```markdown
# n8n — pontes finas (Apartamento e Imóveis Natal)

Diferente do projeto Bless, o n8n aqui **não orquestra a conversa** — isso vive inteiro no
Next.js (`processInboundForAi`, painel, fila). O n8n só executa 3 ações pontuais, numa
instância isolada deste cliente:

| Workflow | Papel | Chamado por |
|---|---|---|
| `webhook-in-instagram.json` | Recebe o webhook bruto da Meta, resolve o PSID correto (evita responder pra pessoa errada — ver seção abaixo), repassa evento normalizado pro Next.js | Meta (Instagram) |
| `instagram-send.json` | Envia mensagem via Graph API do Instagram | Next.js (`sendInstagramMessage.ts`, via `N8N_INSTAGRAM_SEND_WEBHOOK_URL`) |
| `lead-webhook-rdstation.json` | Cria/atualiza Contato e Negociação no RD Station | Next.js (`notifyLeadToCrm.ts`, via `N8N_LEAD_WEBHOOK_URL`) |

## Setup

1. Importar os 3 arquivos JSON no n8n (**Workflows → Import from File**).
2. Em cada um, preencher as credenciais indicadas na sticky note do próprio workflow
   (Instagram: HTTP Header Auth com `Authorization: Bearer TOKEN`; RD Station: variável de
   ambiente `RD_CRM_TOKEN` no n8n, não credencial).
3. Preencher `igUserId`/`graphApiVersion` no node "Config" de `webhook-in-instagram` e de
   `instagram-send` — mesmo valor nos dois (obtido em
   `graph.instagram.com/me/conversations?fields=participants`, não em `/me` nem `entry.id`
   do webhook cru — ver "IDs do Instagram" abaixo).
4. Configurar `NEXTJS_WEBHOOK_BASE_URL` e `NEXTJS_WEBHOOK_SECRET` como variáveis de ambiente
   do n8n (o segundo precisa ser igual ao `WEBHOOK_SECRET` do `.env` do Next.js).
5. No `.env` do Next.js, apontar `N8N_LEAD_WEBHOOK_URL` e `N8N_INSTAGRAM_SEND_WEBHOOK_URL`
   pras Production URLs dos webhooks correspondentes.
6. Ativar os 3 workflows.

## IDs do Instagram (herdado do projeto Bless — não pular)

O Instagram representa a mesma conta com IDs diferentes dependendo da API chamada. O único
correto para `igUserId` é o retornado por
`graph.instagram.com/me/conversations?fields=participants` — não o de `/me` nem o `entry.id`
do corpo do webhook. Errar isso faz o bot responder pra pessoa errada quando há várias
conversas simultâneas. Ver `extract-psid` em `webhook-in-instagram.json` — ele resolve isso
buscando, entre as conversas retornadas, a que realmente contém quem mandou a mensagem atual.

## Token de longa duração do Instagram

Expira em ~60 dias e não renova sozinho — trava manual conhecida. Reveja periodicamente.
```

- [ ] **Step 2: Commit**

```bash
git add n8n/README.md
git commit -m "Document the three n8n bridge workflows and operational setup

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Validação final e primeiro estado consistente do repositório

**Files:** Nenhum novo — task de verificação.

**Interfaces:** N/A.

- [ ] **Step 1: Rodar a suíte de testes completa**

```bash
cd "C:\Users\helyn\OneDrive\Documents\Desenvolvimento\AgenteInstagram"
npm test
```

Esperado: todos os testes passam.

- [ ] **Step 2: Rodar o build**

```bash
npm run build
```

Esperado: build conclui sem erro.

- [ ] **Step 3: Validar os 3 JSONs do n8n de uma vez**

```bash
node -e "
['n8n/webhook-in-instagram.json', 'n8n/instagram-send.json', 'n8n/lead-webhook-rdstation.json'].forEach((f) => {
  JSON.parse(require('fs').readFileSync(f, 'utf-8'));
  console.log(f + ': OK');
});
"
```

Esperado: as 3 linhas `OK`.

- [ ] **Step 4: Conferir o estado do git**

```bash
git status
git log --oneline
```

Esperado: working tree limpo, histórico com um commit por task anterior.

- [ ] **Step 5: Commit final (se sobrou algo pendente)**

```bash
git add -A
git status --porcelain
```

Se houver mudanças pendentes:

```bash
git commit -m "Finish WhattsAtendeBless migration for Apartamento e Imóveis Natal

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Fora deste plano (passos operacionais, não implementação)

- Provisionar Postgres, Evolution API e instância n8n reais deste cliente.
- Preencher o `.env` real com credenciais (RD Station, Instagram, Evolution API, OpenAI).
- Rodar `npm run seed-sectors` e `npm run create-admin` contra o banco real.
- Registrar o app no Meta for Developers e configurar o webhook de produção.
- Teste ponta-a-ponta manual nos 3 fluxos (WhatsApp → painel, Instagram DM → painel, handoff → RD Station) — só possível com infra real no ar.
