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
