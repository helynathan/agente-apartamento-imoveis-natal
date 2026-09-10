# Contexto de imóvel por post do Instagram (PDF por post)

- **Data**: 2026-09-10
- **Status**: aprovado, pendente de implementação
- **Repositório**: `AgenteInstagram` (Apartamento e Imóveis Natal)

## Contexto

Hoje, quando alguém comenta num post do Instagram, o n8n abre uma DM genérica
("Sou o assistente da Apartamento Imóveis Natal — posso te ajudar com compra,
locação ou administração de imóveis. O que você está procurando?") e a IA que
conduz a conversa depois (via Next.js, `processInboundForAi`/`openaiClient`)
não sabe qual imóvel motivou o contato — trata a conversa de forma genérica,
mesmo que a pessoa tenha comentado especificamente no post de um imóvel
concreto.

O cliente pediu uma abordagem diferente: quando o comentário vier de um post
específico, a IA deveria ter informações detalhadas sobre aquele imóvel
disponíveis desde o início da conversa. A fonte dessas informações é um PDF
que o cliente já tem pronto por imóvel (ficha técnica, condições, etc).

## Objetivo

Permitir que um admin vincule um PDF a um post específico do Instagram. Quando
alguém comenta nesse post e a conversa evolui para DM, a IA passa a ter o
conteúdo daquele PDF como contexto extra durante toda a conversa — sem nunca
citar o PDF literalmente, só usando como pano de fundo, do mesmo jeito que já
funciona a busca de produtos do catálogo do WhatsApp (`productContext`).

## Decisão de arquitetura

- **Um PDF por post** (mapeamento 1:1), confirmado com o usuário.
- O texto extraído do PDF é **revisado e editável pelo admin** antes de
  salvar — por isso não precisamos guardar o arquivo PDF original em lugar
  nenhum, só o texto final (já resolve, de quebra, qualquer preocupação sobre
  armazenamento de arquivo em disco efêmero do container).
- O Next.js **não ganha credencial própria do Instagram** — para resolver
  "link do post → media_id" (necessário pra escolher o `media_id`), criamos
  uma 4ª ponte fina no n8n, mantendo a credencial do Instagram centralizada
  lá (mesmo padrão já usado pelas outras 3 pontes).
- A ligação entre "quem comentou" e "qual post" só existe no momento do
  comentário (evento separado da mensagem que vem depois) — por isso o n8n
  precisa **lembrar** `{mediaId, timestamp}` por `commenterId` até a pessoa
  responder na DM, expirando em 7 dias (mesma janela de DM do Instagram).
  Essa técnica já existia, documentada, no workflow antigo deste cliente
  (Instagram Bless) — reaproveitada aqui, não inventada do zero.
- O contexto do imóvel é buscado **a cada turno da IA** (não só na primeira
  mensagem) a partir de `Conversation.originMediaId`, evitando o problema de
  "esquecer" o contexto que o projeto-base antigo tinha com memória de janela
  limitada — aqui a busca é sempre fresca, sem depender de histórico.

Alternativas descartadas:
- **Dar ao Next.js sua própria credencial do Instagram** — duplicaria
  gerenciamento de token em dois lugares; descartado a favor de manter tudo
  centralizado no n8n.
- **Guardar o PDF original em disco/S3** — desnecessário, já que só o texto
  extraído (e revisado) importa; evita introduzir uma dependência de storage
  externo só para isso.

## Arquitetura e fluxo de dados

```
Admin cola link do post + sobe PDF
        │
        ▼
Next.js: extrai texto do PDF (pdf-parse, local, sem IA)
        │
        ▼
Next.js → n8n (nova ponte "resolve-post-url"): "qual o media_id desse link?"
        │
        ▼
Admin revisa/edita o texto extraído → salva (PostListing: mediaId + texto)

─────────── (mais tarde, cliente real comenta o post) ───────────

Comentário no post ──► n8n: guarda {mediaId, timestamp} por commenterId
                        (expira em 7 dias) + manda resposta pública e abre
                        DM genérica (inalterado, continua fora do Next.js)
        │
Pessoa responde na DM ──► n8n: reconhece o commenterId, resgata o mediaId
                        guardado (se ainda válido), inclui como
                        "originMediaId" no payload pro Next.js
        │
        ▼
Next.js: 1ª mensagem da conversa grava Conversation.originMediaId
        │
        ▼
A cada turno da IA: se a conversa tiver originMediaId, busca o PostListing
correspondente e manda o texto como productContext pra IA (mesmo mecanismo
já usado pro catálogo de produtos do WhatsApp)
```

## Componentes

### Banco de dados (nova migration)
- `PostListing`: `id`, `mediaId` (único), `postUrl`, `propertyText`,
  `createdAt`, `updatedAt`
- `Conversation.originMediaId`: novo campo opcional, preenchido só na
  criação da conversa (nunca sobrescrito depois)

### Next.js — novo
- `src/app/painel/admin/posts/page.tsx` + `actions.ts` — tela de admin:
  lista de posts vinculados, formulário (link do post + upload de PDF),
  textarea editável com o texto extraído, botão remover vínculo
- `src/lib/posts/postListingRepository.ts` — CRUD do `PostListing`
  (create/update por mediaId, list, delete, findByMediaId)
- `src/lib/pdf/extractPdfText.ts` — extrai texto de um PDF (nova
  dependência: `pdf-parse`)
- `src/lib/instagram/resolvePostUrl.ts` — chama a ponte n8n
  `resolve-post-url` pra resolver link → media_id

### Next.js — modificados
- `src/lib/webhook/parseInstagramWebhook.ts` — aceita `originMediaId`
  opcional no payload
- `src/lib/conversations/persistInboundMessage.ts` — grava
  `originMediaId` só na criação da conversa (parâmetro novo,
  comportamento de update inalterado)
- `src/lib/ai/processInboundForAi.ts` — se `conversation.originMediaId`
  existir, busca `PostListing` por esse id e passa `propertyText` como
  `productContext` pra `requestTriageDecision` (substituindo/combinando
  com a busca de produtos do WhatsApp, que não se aplica a conversas do
  Instagram hoje)

### n8n — novo
- `n8n/resolve-post-url.json` — 4ª ponte fina: recebe `{postUrl}`, busca
  a mídia recente da conta (`GET /{igUserId}/media?fields=id,permalink`),
  compara `permalink` com o link recebido, devolve `{mediaId}` ou erro se
  não encontrar

### n8n — modificado
- `webhook-in-instagram.json`:
  - `Parse Evento Comentario` passa a gravar
    `staticData.postContextByCommenter[commenterId] = { mediaId, timestamp }`
    (`$getWorkflowStaticData('global')`, expirando entradas com mais de 7
    dias)
  - `Parse Evento Instagram` (mensagem) passa a consultar esse mapa pelo
    `senderId` e incluir `originMediaId` no payload quando encontrar uma
    entrada válida (não expirada)

## Tratamento de erros e casos extremos

- **Link de post inválido ou não encontrado**: `resolve-post-url` retorna
  erro; a tela de admin mostra "Não encontramos esse post nessa conta" e
  não salva nada.
- **PDF sem texto extraível** (escaneado como imagem, arquivo corrompido):
  a textarea de revisão vem vazia/com lixo; a tela avisa explicitamente
  ("Texto extraído está vazio — confira o arquivo ou digite manualmente")
  em vez de permitir salvar um contexto vazio sem aviso.
- **Re-upload num post que já tem PDF vinculado**: substitui o
  `propertyText` anterior (upsert por `mediaId`), sem precisar remover
  antes.
- **Pessoa comenta em posts diferentes antes de responder alguma DM**: o
  mapa é por `commenterId` (não por comentário específico) — o vínculo
  mais recente sobrescreve o anterior. Limitação aceita, replica o
  comportamento do projeto anterior (Instagram Bless); não será resolvida
  agora.
- **Mais de 7 dias sem resposta à DM**: a entrada expira, a conversa segue
  no modo genérico, sem contexto do post.
- **Upload**: valida extensão/mime `.pdf` e limita tamanho (10MB) antes de
  tentar extrair texto.
- **Ponte `resolve-post-url` fora do ar**: a tela de admin mostra erro
  claro, não deixa salvar vínculo quebrado.

## Testes

- `postListingRepository`: create/update (upsert por mediaId), list,
  delete, findByMediaId — testes de unidade contra banco descartável
  (mesmo padrão já usado no projeto: banco temporário criado e derrubado
  na VPS, nunca a base de produção).
- `extractPdfText`: extrai texto de um PDF de teste conhecido; trata PDF
  vazio/corrompido sem lançar exceção não tratada.
- `processInboundForAi`: quando `conversation.originMediaId` aponta para
  um `PostListing` existente, `requestTriageDecision` é chamado com
  `productContext` igual ao `propertyText`; quando não aponta pra nada
  (ou é nulo), comportamento idêntico ao atual.
- `persistInboundMessage`: grava `originMediaId` na criação; mensagens
  seguintes na mesma conversa não alteram esse campo.
- Workflows n8n: sem suíte automatizada (mesmo padrão do projeto) —
  validação manual via `Execute step` no editor e teste ponta-a-ponta com
  comentário real antes de considerar pronto.

## Fora de escopo (por enquanto)

- Resolver o caso de comentários em múltiplos posts antes da resposta à
  DM (limitação aceita, documentada acima).
- Qualquer forma de busca semântica/RAG entre vários PDFs — é sempre 1
  PDF por post, sem necessidade de embeddings ou busca por similaridade.
- Guardar o arquivo PDF original — só o texto extraído/editado é
  persistido.
