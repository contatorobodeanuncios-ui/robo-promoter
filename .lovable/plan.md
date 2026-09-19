# Saldo em massa no AdminDev

## Objetivo
Adicionar uma ferramenta independente do ajuste individual para creditar o mesmo valor a vários clientes com prévia obrigatória, confirmação explícita e registro auditável.

## Implementação

1. **Operação segura no banco**
   - Criar uma função restrita ao servidor que atualiza `profiles.balance` em uma única instrução, usando `profiles.created_at` para os filtros por período.
   - Aceitar os critérios: clientes específicos, últimas X horas, últimas 24 horas e todos os clientes.
   - Executar atualização e gravação no `admin_audit_log` na mesma transação, registrando administrador, quantidade, valor unitário, total, critério e data/hora.
   - Restringir a função ao acesso privilegiado do servidor; a tela nunca poderá chamá-la diretamente.

2. **Funções administrativas protegidas**
   - Adicionar uma função de prévia protegida pela mesma validação administrativa existente, retornando apenas contagem e total calculado.
   - Adicionar uma função de aplicação protegida, com validação de valor positivo, limite de horas e IDs válidos.
   - Recalcular os clientes elegíveis no momento da confirmação, sem confiar na contagem enviada pela tela.

3. **Modal “Adicionar saldo em massa”**
   - Posicionar o novo botão na área “Todos os Clientes”, sem alterar o `BalanceDialog` individual.
   - Oferecer quatro modos no mesmo modal: Específico, Últimas X horas, Último dia e Todos os clientes.
   - No modo Específico, permitir buscar por nome/e-mail e selecionar múltiplos clientes.
   - Solicitar valor unitário e exibir uma prévia com quantidade afetada e valor total.
   - Liberar a aplicação somente após uma etapa separada de confirmação.

4. **Resultado e atualização da tela**
   - Mostrar “Saldo de R$ X adicionado para Y clientes.” após sucesso.
   - Atualizar a lista e os saldos exibidos sem recarregar a página.
   - Tratar ausência de clientes e mudanças entre prévia e confirmação com mensagens claras.

5. **Validação**
   - Testar os quatro critérios, a prévia, a confirmação, a auditoria e a operação atômica.
   - Confirmar que o ajuste individual continua funcionando sem alterações.
   - Verificar o modal em desktop e mobile.

## Detalhes técnicos
- Coluna confirmada para data de cadastro: `profiles.created_at` (`timestamp with time zone`).
- Registro reutilizado: `admin_audit_log`, sem criar uma nova tabela.
- A atualização será um único `UPDATE ... WHERE ...`, com retorno dos afetados e um único registro de auditoria dentro da mesma transação.
