# n8n — pontes finas (Apartamento e Imóveis Natal)

Diferente do projeto Bless, o n8n aqui **não orquestra a conversa** — isso vive inteiro no
Next.js (`processInboundForAi`, painel, fila). O n8n só executa 4 ações pontuais, numa
instância isolada deste cliente:

| Workflow | Papel | Chamado por |
|---|---|---|
| `webhook-in-instagram.json` | Recebe o webhook bruto da Meta, resolve o PSID correto (evita responder pra pessoa errada — ver seção abaixo), repassa evento normalizado pro Next.js | Meta (Instagram) |
| `instagram-send.json` | Envia mensagem via Graph API do Instagram | Next.js (`sendInstagramMessage.ts`, via `N8N_INSTAGRAM_SEND_WEBHOOK_URL`) |
| `lead-webhook-rdstation.json` | Cria/atualiza Contato e Negociação no RD Station | Next.js (`notifyLeadToCrm.ts`, via `N8N_LEAD_WEBHOOK_URL`) |
| `resolve-post-url.json` | Recebe um link de post do Instagram, devolve o `media_id` correspondente | Next.js (tela de admin "Posts com Imóvel", via `resolvePostUrl.ts`, `N8N_RESOLVE_POST_URL_WEBHOOK_URL`) |

## Setup

1. Importar os 4 arquivos JSON no n8n (**Workflows → Import from File**).
2. Em cada um, preencher as credenciais indicadas na sticky note do próprio workflow
   (Instagram: HTTP Header Auth com `Authorization: Bearer TOKEN`; RD Station: credencial
   Query Auth — nome do parâmetro `token`, valor o token da API do RD Station CRM).
3. Preencher `igUserId`/`graphApiVersion` no node "Config" de `webhook-in-instagram` e de
   `instagram-send` — mesmo valor nos dois (obtido em
   `graph.instagram.com/me/conversations?fields=participants`, não em `/me` nem `entry.id`
   do webhook cru — ver "IDs do Instagram" abaixo).
4. Preencher `nextjsWebhookBaseUrl` e `nextjsWebhookSecret` diretamente no node "Config" do
   workflow `webhook-in-instagram` (não são mais variáveis de ambiente do n8n; o segundo
   precisa ser igual ao `WEBHOOK_SECRET` do `.env` do Next.js).
5. No `.env` do Next.js, apontar `N8N_LEAD_WEBHOOK_URL`, `N8N_INSTAGRAM_SEND_WEBHOOK_URL` e
   `N8N_RESOLVE_POST_URL_WEBHOOK_URL` pras Production URLs dos webhooks correspondentes.
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

## Decisão: DM de abertura por comentário não passa pelo painel (2026-09-08)

O branch de comentário (`Parse Evento Comentario` → `Responder Comentario Publicamente` →
`Enviar DM Privada do Comentario`) manda a mensagem de abertura direto pela Graph API, sem
repassar pro Next.js — ela não fica registrada no histórico da conversa nem visível no painel.
Isso foi identificado na revisão final como uma exceção à regra de "toda mensagem passa pelo
Next.js", mas decisão explícita do usuário: não é necessário resolver isso agora. Se algum dia
importar ter esse histórico completo no painel, o ajuste é fazer esse branch também chamar o
mesmo endpoint que `webhook-in-instagram` usa pra mensagens normais, antes de responder.

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
