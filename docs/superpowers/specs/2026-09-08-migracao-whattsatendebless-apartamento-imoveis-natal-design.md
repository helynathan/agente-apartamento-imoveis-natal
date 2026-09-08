# Migração da WhattsAtendeBless para o cliente Apartamento e Imóveis Natal

- **Data**: 2026-09-08
- **Status**: aprovado, pendente de implementação
- **Repositório alvo**: `AgenteInstagram` (hoje sem git; vira o deploy isolado deste cliente)

## Contexto

`AgenteInstagram` continha até aqui apenas protótipos de referência: um workflow n8n
de WhatsApp com um bug conhecido no schema (`lead_data` ausente) e um agente de
Instagram standalone (`archive-instagram-agent/`, migrado de Claude para OpenAI numa
sessão anterior, mas nunca colocado em produção). Nenhum dos dois tem valor de
produção.

Em paralelo, dois projetos de outro cliente (Bless) já rodam ou estão em estágio
avançado:

- **`Instagram Bless`** — agente de Instagram via Composio + workflows n8n
  standalone (IA + qualificação + CRM tudo dentro do n8n). Um desses workflows,
  `apartamento-imoveis-natal-instagram-crm.json`, **já roda em produção para o
  cliente Apartamento e Imóveis Natal** — usa RD Station CRM, tem proteções reais
  contra loop/duplicidade e resolve uma pegadinha documentada de IDs do Instagram
  (PSID via `/conversations`, não via `entry.id` nem `/me`).
- **`WhattsAtendeBless`** — produto completo (Next.js + Prisma + painel de
  atendimento humano com Kanban, SLA, copiloto de IA, WhatsApp via Evolution API e
  Instagram) construído para a Bless, usando LOFT CRM (Vista Software). Downstream
  de CRM e de envio de Instagram são delegados a um n8n via dois webhooks HTTP
  simples (`N8N_LEAD_WEBHOOK_URL`, `N8N_INSTAGRAM_SEND_WEBHOOK_URL`) — o n8n não
  orquestra a conversa nesse desenho, só executa ações pontuais.

## Objetivo

Trazer a `WhattsAtendeBless` para dentro de `AgenteInstagram` como base do sistema
de atendimento do cliente **Apartamento e Imóveis Natal**, com:

- Painel de atendimento humano completo (não só bot autônomo).
- WhatsApp (Evolution API) e Instagram no mesmo painel.
- CRM: **RD Station** (não Vista — confirmado que é o CRM real deste cliente).
- Infraestrutura **isolada**: banco de dados, instância n8n e deploy próprios deste
  cliente, sem compartilhar nada com a infra da Bless.
- Sem catálogo de produtos/imóveis por enquanto (o portal ainda não existe — a
  função de busca de produto já degrada bem sozinha, sem precisar remover código).

## Decisão de arquitetura

Copiar o código da `WhattsAtendeBless` quase integralmente (é o produto certo para
o que foi pedido), e reduzir o n8n deste cliente a um papel de **ponte fina**,
migrando a lógica de conversa (IA, qualificação, memória) para dentro do Next.js —
que é o desenho já provado na Bless — em vez de manter dois orquestradores de
conversa (um no n8n antigo do Instagram, outro no Next.js).

Alternativas descartadas (registradas para referência futura):

- **Faseado (WhatsApp primeiro, Instagram depois)** — adiaria sem necessidade a
  ponte RD Station, que precisa existir de qualquer forma; e deixaria Instagram
  fora do painel por um tempo sem ganho real, já que o trabalho de extrair a ponte
  de Instagram é pequeno.
- **Eliminar o n8n do caminho de Instagram por completo** (portar Graph API +
  resolução de PSID direto pro Next.js) — reabriria risco em bugs já resolvidos e
  documentados no Instagram Bless (resposta pra pessoa errada quando há múltiplas
  conversas simultâneas); nenhum ganho de infraestrutura justifica o risco agora.

## Arquitetura

```
Cliente WhatsApp/Instagram
        │
        ▼
┌───────────────────────────────────────────────────┐
│  AgenteInstagram (Next.js — cópia de               │
│  WhattsAtendeBless, reconfigurada)                 │
│                                                     │
│  Webhook WhatsApp (Evolution API, direto) ──┐      │
│  Webhook Instagram (via ponte n8n) ─────────┤      │
│                                              ▼      │
│                              persistInboundMessage  │
│                                              │      │
│                                              ▼      │
│                        processInboundForAi (GPT)    │
│                          │              │           │
│                    responde         encaminha p/    │
│                    autônomo         fila (Kanban)   │
│                                              │      │
│                                              ▼      │
│                        Painel de atendimento        │
│                        (corretor assume,            │
│                         copiloto de IA)             │
│                                              │      │
│                                              ▼      │
│                        outboundWorker (+Instagram)  │
└───────────┬─────────────────────────┬───────────────┘
            │                         │
   WhatsApp: direto            Instagram: via
   via Evolution API           ponte n8n fina
            │                         │
            ▼                         ▼
   Evolution API              n8n (instância isolada deste cliente)
   (própria do cliente)         │         │            │
                          webhook-in  instagram-send  lead-webhook
                          (normaliza,   (envia via     (RD Station:
                           dedup,        Graph API)     Contato +
                           resolve PSID) │               Negociação)
                                │        ▼               │
                                ▼    Graph API            ▼
                          Next.js webhook            RD Station CRM
                          /api/webhook/instagram
```

## Componentes

| Componente | Origem | Tratamento |
|---|---|---|
| App Next.js completo (`src/app`, `src/lib`, `src/components`, Prisma, scripts) | Copiado de `WhattsAtendeBless` | Trocar branding/textos que mencionem "Bless"; nenhuma mudança estrutural |
| WhatsApp via Evolution API (webhook direto, `parseInboundWebhook.ts`) | Copiado sem mudança de lógica | Só credenciais novas |
| CRM (`notifyLeadToCrm.ts`) | Copiado sem mudança (já agnóstico — payload genérico pro `N8N_LEAD_WEBHOOK_URL`) | Nenhuma — a adaptação pro RD Station fica inteira do lado do n8n |
| Busca de produtos (`searchRelevantProducts.ts`, `crawlProductPages.ts`) | Copiado, mantido no código | `VISTA_*` fica sem configurar; a função já retorna lista vazia sem erro quando a tabela `ProductPage` está vazia — plugar depois quando o portal existir |
| **n8n: `webhook-in` (Instagram)** | **Extraído** do workflow `apartamento-imoveis-natal-instagram-crm.json` | Mantém webhook de verificação + `Parse Evento Instagram` + `Buscar Conversa` + `Extrair PSID` + todas as proteções de loop/dedup/eco documentadas; remove `AI Agent`, memória e os nós de CRM; termina com uma chamada HTTP pro Next.js (`/api/webhook/instagram/[secret]`) com `{senderId, messageId, content, customerName?}` |
| **n8n: `instagram-send`** | **Extraído** do mesmo workflow | Só a credencial Instagram + `POST /{igUserId}/messages`; recebe `{externalId, content}` do Next.js, devolve `{id}` |
| **n8n: `lead-webhook` (RD Station)** | **Novo** — construído do zero, reaproveitando os padrões de upsert de contato + criação de negociação já usados no `workflow.json` antigo deste projeto | Recebe `{telefone, nome, historico, interesse, canal, link}`; busca/cria Contato no RD Station; cria Negociação com resumo do histórico |
| Setores do painel (`sectorRepository.ts`) | Seed novo | Compra, locação, administração — mesmos objetivos já usados no roteiro de qualificação do workflow antigo de Instagram deste cliente |

## Configuração (variáveis de ambiente)

```
DATABASE_URL=                     # Postgres isolado deste cliente
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=
WEBHOOK_SECRET=                   # novo, próprio
NEXTAUTH_SECRET=                  # novo, próprio
NEXTAUTH_URL=
REALTIME_PORT=
REALTIME_INTERNAL_URL=
REALTIME_SECRET=
NEXT_PUBLIC_REALTIME_WS_URL=
OPENAI_API_KEY=
N8N_LEAD_WEBHOOK_URL=             # -> workflow "lead-webhook" (RD Station), instância n8n isolada
N8N_INSTAGRAM_SEND_WEBHOOK_URL=   # -> workflow "instagram-send", mesma instância
# VISTA_* deliberadamente vazio por enquanto
```

## Passos de execução

1. Copiar os arquivos da `WhattsAtendeBless` para `AgenteInstagram` (excluindo
   `node_modules`, `.next`, `.git`, `.worktrees`, `tsconfig.tsbuildinfo`).
2. Apagar o conteúdo antigo de `AgenteInstagram` (`n8n/workflow.json`,
   `n8n/schema.sql`, `README-N8N.md`, `archive-instagram-agent/`) — sem valor de
   produção, decisão explícita do usuário de não manter como histórico.
3. `npm install` na nova raiz.
4. Ajustar branding/textos genéricos que mencionem "Bless" no painel e nos
   prompts.
5. Seed inicial de setores: compra, locação, administração.
6. Construir os 3 papéis do n8n (`webhook-in`, `instagram-send`, `lead-webhook`)
   como workflows na instância isolada deste cliente.
7. `.env` com placeholders (credenciais reais entram quando Postgres/Evolution
   API/n8n estiverem provisionados).
8. Rodar `npm test`, `npm run build` para validar que a cópia funciona.
9. `git init` + primeiro commit.

## Testes e validação

- Suíte de testes existente (Vitest) deve passar sem alteração — a lógica não
  muda, só configuração.
- `lead-webhook`: validado manualmente (n8n não tem suíte automatizada neste
  projeto) — dispara webhook de teste, confere Contato + Negociação no RD Station.
- `webhook-in` / `instagram-send`: validado contra a Graph API real de teste,
  reaproveitando o token/app já validado no fluxo antigo; atenção especial à
  resolução de PSID (documentada como a parte mais confusa do projeto Bless).
- Critério de conclusão: `npm test` e `npm run build` passam, e um teste
  ponta-a-ponta manual funciona nos três fluxos — WhatsApp → painel, Instagram DM →
  painel, handoff pro corretor → RD Station.

## Pontos de atenção herdados (não regressar)

- Proteções de loop/duplicidade do Instagram (dedup por `message.mid`, ignorar
  `is_echo`, ignorar `sender.id` da própria conta) — preservar integralmente no
  workflow `webhook-in`.
- IDs do Instagram: `igUserId` correto só vem de
  `graph.instagram.com/me/conversations?fields=participants` — não usar `/me` nem
  `entry.id` do webhook cru.
- Token de Instagram de longa duração (~60 dias) não renova sozinho — trava manual
  conhecida, documentar para o operador deste cliente.
- Limite de segurança de IA (`SAFETY_NET_LIMIT = 6` mensagens) e fallback "vou te
  encaminhar para um atendente" já existem no código copiado — nenhuma mudança
  necessária.

## Fora de escopo (por enquanto)

- Catálogo de produtos/imóveis via crawler + Vista API — cliente ainda não tem
  portal; código fica presente mas inerte (`VISTA_*` vazio).
- Provisionamento real de infraestrutura (Postgres, Evolution API, n8n, hosting) —
  este spec cobre a migração de código e desenho de integração; a criação das
  instâncias de infra é um passo operacional separado, fora do escopo desta
  implementação.
