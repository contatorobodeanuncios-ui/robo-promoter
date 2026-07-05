import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/app/Logo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Robô de Lucro" },
      { name: "description", content: "Como o Robô de Lucro coleta, usa e protege seus dados pessoais conforme a LGPD." },
      { property: "og:title", content: "Política de Privacidade — Robô de Lucro" },
      { property: "og:description", content: "Como tratamos seus dados pessoais conforme a LGPD (Lei 13.709/2018)." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Logo size={28} />
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Voltar</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10 prose prose-invert">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 05 de julho de 2026</p>

        <section className="space-y-4 text-sm leading-relaxed">
          <p>
            Esta Política descreve como o <strong>Robô de Lucro Automático</strong> ("nós")
            trata dados pessoais em conformidade com a Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018 — "LGPD").
          </p>

          <h2 className="text-xl font-semibold mt-6">1. Dados que coletamos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Cadastro:</strong> nome, e-mail, telefone e senha (criptografada).</li>
            <li><strong>Uso da plataforma:</strong> campanhas criadas, criativos, textos, links e métricas.</li>
            <li><strong>Pagamentos:</strong> valores adicionados de saldo (processados via Asaas — não armazenamos cartão).</li>
            <li><strong>Técnicos:</strong> logs de acesso, IP e navegador para segurança e auditoria.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6">2. Finalidade do tratamento</h2>
          <p>
            Usamos seus dados para: (i) prestar o serviço de automação de anúncios, (ii)
            processar pagamentos e faturas, (iii) enviar comunicações operacionais,
            (iv) cumprir obrigações legais e regulatórias e (v) prevenir fraudes.
          </p>

          <h2 className="text-xl font-semibold mt-6">3. Base legal</h2>
          <p>
            Tratamos dados com base em: execução de contrato (art. 7º, V), cumprimento
            de obrigação legal (art. 7º, II), legítimo interesse (art. 7º, IX) e
            consentimento quando aplicável (art. 7º, I).
          </p>

          <h2 className="text-xl font-semibold mt-6">4. Compartilhamento</h2>
          <p>
            Compartilhamos dados apenas com operadores necessários à prestação do serviço:
            Meta Platforms (execução de anúncios), Asaas (pagamentos), Supabase (banco de dados)
            e Cloudflare (hospedagem). Não vendemos dados pessoais.
          </p>

          <h2 className="text-xl font-semibold mt-6">5. Seus direitos (art. 18 LGPD)</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Confirmação e acesso aos seus dados</li>
            <li>Correção de dados incompletos ou desatualizados</li>
            <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
            <li>Portabilidade e revogação do consentimento</li>
            <li>Eliminação da conta (envie e-mail solicitando)</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6">6. Retenção</h2>
          <p>
            Mantemos dados enquanto sua conta estiver ativa e por até 5 anos após o
            encerramento, para fins fiscais e de auditoria, conforme legislação.
          </p>

          <h2 className="text-xl font-semibold mt-6">7. Segurança</h2>
          <p>
            Adotamos criptografia em trânsito (TLS), controle de acesso por RLS no
            banco, senhas com hash e auditoria de operações administrativas.
          </p>

          <h2 className="text-xl font-semibold mt-6">8. Encarregado (DPO)</h2>
          <p>
            Contato do Encarregado pelo Tratamento de Dados:{" "}
            <a href="mailto:prototipospremium@gmail.com" className="text-primary">
              prototipospremium@gmail.com
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
