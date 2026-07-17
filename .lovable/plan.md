
## Escopo confirmado

- **Ordem**: tudo em uma leva.
- **Saldo x campanha (item 3)**: manter saldo, só isolar. Pagamento de campanha nunca credita `balance`; vai direto para `pix_total_budget`/orçamento retido da campanha e é debitado conforme `spent` da Meta.
- **Magic link (7/8)**: gerado sob demanda por clique no admindev, expira ~1h, faz login como o usuário-alvo. Botão permanece após aprovação.
- **IA de métricas (6)**: cron automático (a cada 3h) **+** botão "reanalisar agora". Visível **apenas no admindev**.

## Backend (migrações + funções)

1. **Storage** — bucket privado `support-attachments` + policies:
   - upload/read pelo dono da conversa; admin lê tudo.
   - Coluna nova em `support_messages`: `attachments jsonb[]` (`{path, mime, size, name}`).
2. **Campanhas — isolamento de saldo (item 3)**:
   - Migração garante que `payment_requests.kind = 'campaign_pix'` **nunca** credita `profiles.balance`. Webhook Asaas revisto para creditar somente `pix_total_budget` da campanha alvo.
   - Adicionar CHECK/trigger: pagamento de campanha só altera `pix_total_budget`; pagamento de recarga só altera `balance`.
3. **Auditoria de vínculo Meta (item 14)** — tabela `campaign_meta_link_audit(campaign_id, changed_by, old_ad_account_id, new_ad_account_id, old_meta_campaign_id, new_meta_campaign_id, created_at)`. Trigger em `campaigns` grava toda troca.
4. **IA de métricas (item 6)** — tabela `campaign_ai_reviews(campaign_id, verdict enum('good','warn','bad'), summary, recommendations jsonb, model, created_at)`.
5. **Sincronização Meta (item 12)** — `campaigns.meta_last_sync_at`, `meta_last_sync_status`, `meta_last_sync_error` (já parcialmente existem — completar).
6. **Magic link (7/8)** — nenhuma nova tabela; usa `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink' })` em server fn `adminGenerateAccessLink(userId)` (só admin).

## Server functions / routes

- `src/lib/support.functions.ts` — `sendMyMessage`/`adminSendMessage` aceitam `attachments`. Nova fn `getSignedAttachmentUrl(path)`.
- `src/lib/payment.functions.ts` — `createPaymentRequest` recebe `replaceCpf?: string` para item 10. Erro Asaas com causa provável/ação recomendada (item 13). Fluxo de campanha nunca escreve em `balance`.
- `src/routes/api/public/asaas-webhook.ts` — revisar: PIX de campanha → `pix_total_budget`, PIX de recarga → `balance`. Nunca cruza.
- `src/lib/admin.functions.ts`:
  - `adminGenerateAccessLink(userId)` — magic link (item 7/8).
  - `adminSetMetaCampaignId` — já grava auditoria via trigger; adicionar retorno com `meta_last_sync_at` + status para item 12.
  - Erros Meta/Asaas com `{ code, cause, suggestion }` (item 13).
- `src/lib/ai-analysis.functions.ts` — nova `aiReviewCampaign(campaign_id)` + `aiReviewAllCampaigns()` (admin only). Usa `google/gemini-3-flash-preview`. Análise de imagem (item 5) melhorada com prompt mais rigoroso + multimodal (imagem da campanha como `image_url`).
- `src/routes/api/public/hooks/ai-review-cron.ts` — cron 3/3h chama `aiReviewAllCampaigns`.
- `src/routes/api/public/hooks/meta-metrics-sync.ts` — verificado (item 9): logar `meta_metrics_runs`, gravar `meta_last_sync_*`, retornar contagem processada.

## Frontend

- **`SupportWidget.tsx` (item 11)** — z-index correto, posicionamento que não colide com bottom-nav mobile, input sempre visível (fix `disabled` + contraste). Botão de anexo (imagem/áudio/arquivo) com preview e upload (item 1). Audio via `MediaRecorder`.
- **`_app.admin-support.tsx`** — mesmo painel de anexos + player de áudio + preview de imagem.
- **`_app.dashboard.tsx` (item 2)** — em campanhas com status `aguardando_vinculo_meta` e sem pagamento confirmado: banner vermelho "Pagamento pendente — aguardando finalização para o robô iniciar" + botão **Concluir pagamento** que leva a `/payment?campaign=<id>` reabrindo a mesma solicitação (também item já pedido em turnos anteriores, garantir estado consistente).
- **`_app.payment.tsx` (item 10)** — quando Asaas retornar erro de CPF, mostrar botão **Trocar CPF** que reabre formulário e reenvia. Toast com causa/solução (item 13).
- **`_app.admindev.tsx`**:
  - Cada linha de `access_requests` (aprovada ou não): botão **Copiar link de acesso** → chama `adminGenerateAccessLink` e copia (item 7/8).
  - Após vincular campanha Meta: exibir badge com `meta_last_sync_at` + status verde/amarelo/vermelho e timestamp (item 12).
  - Nova seção **IA de métricas**: lista veredictos + botão "Reanalisar agora" por campanha (item 6).
  - Nova seção **Auditoria Meta**: histórico de mudanças de account_id/meta_campaign_id (item 14).
- **Notificações (item 4)** — auditar `push.functions.ts` + `send-push-daily.ts`: garantir que subscription é registrada corretamente, VAPID enviado, e disparar push de teste ao ligar. Botão "Enviar teste" em `settings`.

## Verificação (item 9 — métricas Meta)

- Rodar `meta-metrics-sync` manualmente via `stack_modern--invoke-server-function`, ler logs, confirmar que `campaigns.spent/clicks/impressions` estão sendo atualizados por campanhas com `meta_campaign_id`. Corrigir mapeamento se necessário.

## Ordem de execução

1. Migração única com: bucket storage, `support_messages.attachments`, `campaign_meta_link_audit` + trigger, `campaign_ai_reviews`, colunas `meta_last_sync_*` (se faltarem), CHECK de isolamento saldo/campanha.
2. Editar server functions (`support`, `payment`, `admin`, `ai-analysis`, webhook Asaas, meta-metrics-sync).
3. Nova rota cron `ai-review-cron`.
4. Refactor de UI (`SupportWidget`, `admin-support`, `dashboard`, `payment`, `admindev`).
5. Verificação: invocar meta-sync e ler logs; testar magic link.
6. Relatório final honesto com o que ficou funcional e o que precisa de validação manual sua (ex.: você testar upload real de imagem, testar push em iOS, etc.).

## Notas

- Não vou mexer em áreas fora dessa lista.
- Onde a Meta API/Asaas retornar erro, exibo `causa provável + ação recomendada`, não apenas o texto bruto.
- Magic link é registrado no `admin_audit_log` para rastreabilidade.
- Relatório final marcará explicitamente "implementado e testado", "implementado mas requer validação sua", ou "não pude testar automaticamente".
