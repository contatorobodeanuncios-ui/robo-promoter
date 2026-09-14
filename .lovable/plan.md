# Correções de preço e retomada do PIX

## Resultado esperado

- A aprovação do PIX usa o plano efetivo do cliente e preserva a regra correta do pacote Créditos/Pro Max.
- A tela de pagamento exibe exatamente o valor retornado pelo servidor e cobrado no PIX, inclusive extras e order bump.
- Campanhas PIX ainda sem solicitação de cobrança ficam separadas como **Aguardando chave PIX** e podem ter o pagamento retomado pelo cliente ou pelo admin.
- Campanhas pagas com saldo do app continuam inalteradas.

## Implementação

### 1. Corrigir o recálculo após aprovação

- Em `creditApprovedPayment`, buscar `plan`, `trial_days` e `trial_started_at` do dono da campanha.
- Resolver o plano com `effectivePlan` e passá-lo para `campaignPricing`.
- Para Créditos/Pro Max, calcular a verba interna a partir do valor efetivamente pago, mantendo extras/order bump e evitando que `budget × days` volte a ser usado por engano.
- Cobrir aprovação manual e por cartão; revisar o webhook para aplicar a mesma regra financeira e impedir divergências entre formas de confirmação.

### 2. Unificar o valor mostrado e cobrado

- Na tela `/payment`, usar `amount` de `getCampaignCharge` como fonte de verdade para campanhas Créditos/Pro Max.
- Remover o total antigo derivado de `campaignPricing` no quadro “Valor do pacote”.
- Manter o cálculo local apenas como fallback para fluxos legados/não Créditos, sem permitir cobrança antes de o valor real da campanha terminar de carregar.

### 3. Novo estado “Aguardando chave PIX”

- Adicionar `aguardando_chave_pix` ao enum de status no banco e aos tipos/validadores do app.
- Novas campanhas `pix_dedicated` nascem nesse estado; campanhas `wallet` mantêm o fluxo atual.
- Ao criar ou reaproveitar uma solicitação pendente de pagamento da campanha, atualizar o status para `aguardando_vinculo_meta` (“Aguardando pagamento”).
- Se a cobrança já estiver paga, manter/colocar a campanha em `rodando`.
- Fazer backfill somente de campanhas PIX não pagas que realmente não tenham nenhuma solicitação de pagamento, sem reclassificar campanhas com histórico existente.

### 4. Retomar e compartilhar pagamento

- Tornar a geração idempotente por campanha: reutilizar uma solicitação pendente existente antes de criar outra.
- No dashboard, adicionar filtros separados, incluindo **Aguardando chave PIX** e **Aguardando pagamento**.
- Nas campanhas sem chave, exibir **Gerar chave PIX**; o cliente segue para `/payment?campaignId=...`, onde a cobrança existente é reutilizada ou criada.
- No admindev, adicionar o filtro **Aguardando chave PIX** e a ação **Reenviar link de pagamento**.
- A ação administrativa prepara/reaproveita a solicitação e entrega o link interno `/payment?campaignId=...` pronto para copiar. Como CPF/CNPJ e a chave do provedor pertencem à sessão do cliente, a geração final continua segura na tela de pagamento do próprio cliente.
- Atualizar rótulos na tela de detalhes e resumos para distinguir claramente “aguardando chave” de “aguardando pagamento”.

## Testes

1. Testes focados de preço: Créditos, Pro Max, extras/order bump, plano Pro/Free e teste Pro expirado.
2. Teste de idempotência: dois cliques não criam duas solicitações pendentes.
3. Teste de transição: criação PIX → `aguardando_chave_pix` → solicitação criada/reutilizada → `aguardando_vinculo_meta` → aprovação → `rodando`.
4. Teste de regressão: campanha `wallet` mantém débito de saldo e fluxo atual.
5. Validação no navegador em desktop e mobile das telas dashboard, pagamento e admindev, incluindo cópia e abertura do link.
