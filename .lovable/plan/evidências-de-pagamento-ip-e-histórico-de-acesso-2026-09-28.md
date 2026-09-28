# Evidências de pagamento, IP e histórico de acesso

Entrega em 3 etapas. Antes da etapa 1, termino a correção pendente do ajuste de saldo (botão Adicionar/Subtrair/Zerar) e testo os 3 casos (100-30=70, 50+20=70, Zerar=0).

## Etapa 1 — Captura + checkbox de Termos + tabelas
- IP lido só no servidor: `cf-connecting-ip`, senão o primeiro IP de `x-forwarded-for`. Cidade/país só dos cabeçalhos da hospedagem (`cf-ipcountry`, `cf-ipcity`); sem dado grava vazio e a tela mostra "Não disponível". Nada é estimado.
- Novas tabelas (sem exclusão automática, sem acesso para usuários comuns, leitura só pelo admin no servidor):
  - `payment_evidence` (uma por solicitação de pagamento): IP, user agent, id da sessão, e-mail da conta, aceite de termos (sim/não, data/hora, IP, versão), saldo antes/depois, bônus, lista de eventos de status (criado, PIX gerado, confirmado) com data/hora e IP quando existir.
  - `login_events`: usuário, IP, user agent, cidade, país, data/hora.
  - `terms_acceptances`: usuário, versão, IP, user agent, data/hora.
  - `user_activity_events` recebe as colunas ip, user_agent, cidade, país.
- Pontos de gravação: clique em pagar (`createPaymentRequest`), confirmação (webhook Asaas + aprovação por cartão/admin), aceite dos Termos, início de sessão (nova função no servidor chamada ao abrir o app, uma vez por sessão).
- Checkbox obrigatório "Li e aceito os Termos de Uso" na tela de pagamento, logo acima do botão de pagar. É a única mudança visual no fluxo de pagamento.
- Não depende de `auth.audit_log_entries`.

## Etapa 2 — Detalhe no admin
- No perfil do cliente (admindev): aba "Histórico de acesso" (últimos logins com IP, cidade, país, aparelho) e, em cada pagamento, um botão "Evidências" com todos os campos acima.
- Pagamentos antigos: campos sem registro aparecem como "Não registrado".
- Campo separado, claramente rotulado "IP da sessão de login (auth.sessions)", lido no servidor. Nunca aparece como IP do pagamento.
- Os cards existentes não mudam de visual.

## Etapa 3 — Exportar PDF
- Botão "Exportar PDF" no detalhe de evidências (só admin), gerado no servidor com o mesmo gerador já usado nos comprovantes.
- Conteúdo: dados do cliente, pagamento (valor pago, status, datas, referência Asaas), aceite de termos, IP/aparelho/local, saldo antes/depois, bônus, linha do tempo de status, logins próximos.
- Fica de fora: valor real gasto no Meta Ads, margem, repartição, dados de outros clientes. Campos vazios aparecem como "Não registrado".

## Detalhes técnicos
- Helper `getRequestMeta()` em `src/lib/request-meta.server.ts` (usa `getRequest()`).
- Tabelas com RLS ligada e nenhuma policy para `authenticated`. Só `service_role` tem acesso. As leituras do admin passam por server functions com `assertAdmin`.
- Versão dos termos numa constante (`TERMS_VERSION`) compartilhada entre a página /termos e a gravação.
- O webhook grava o IP do chamador (Asaas) como evento "confirmado pelo provedor", separado do IP do cliente.
