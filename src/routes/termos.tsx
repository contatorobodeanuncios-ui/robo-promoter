import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/app/Logo";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Robô de Lucro" },
      { name: "description", content: "Termos e condições de uso da plataforma Robô de Lucro Automático." },
      { property: "og:title", content: "Termos de Uso — Robô de Lucro" },
      { property: "og:description", content: "Condições contratuais para uso da plataforma de automação de anúncios." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Logo size={28} />
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Voltar</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold mb-2">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 05 de julho de 2026</p>

        <section className="space-y-4 text-sm leading-relaxed">
          <h2 className="text-xl font-semibold mt-2">1. Aceitação</h2>
          <p>
            Ao criar uma conta no <strong>Robô de Lucro Automático</strong>, você declara
            ter lido, entendido e concordado integralmente com estes Termos e com a
            Política de Privacidade.
          </p>

          <h2 className="text-xl font-semibold mt-6">2. Objeto</h2>
          <p>
            A plataforma oferece automação de campanhas no Facebook/Meta Ads, incluindo
            criação, análise por IA, gestão de saldo e relatórios de desempenho.
          </p>

          <h2 className="text-xl font-semibold mt-6">3. Cadastro e aprovação</h2>
          <p>
            Toda conta nova passa por aprovação manual do administrador antes de acessar
            o painel. Você é responsável pela veracidade dos dados fornecidos e pela
            segurança da sua senha.
          </p>

          <h2 className="text-xl font-semibold mt-6">4. Saldo e pagamentos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Pagamentos processados via Asaas (Pix, boleto ou cartão).</li>
            <li>O saldo adicionado é usado exclusivamente para veiculação de anúncios.</li>
            <li>Valores não utilizados não são reembolsáveis após 30 dias da adição.</li>
            <li>Campanhas são pausadas automaticamente quando o saldo é consumido.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-6">5. Uso permitido</h2>
          <p>
            É vedado usar a plataforma para veicular anúncios que violem as políticas
            do Meta, leis brasileiras, direitos autorais ou que promovam discurso de ódio,
            golpes financeiros, produtos ilegais ou desinformação.
          </p>

          <h2 className="text-xl font-semibold mt-6">6. Suspensão e banimento</h2>
          <p>
            Reservamos o direito de suspender ou banir contas que violem estes Termos, sem
            aviso prévio, com retenção de saldo para apuração de danos quando aplicável.
          </p>

          <h2 className="text-xl font-semibold mt-6">7. Limitação de responsabilidade</h2>
          <p>
            Não garantimos resultados específicos de campanhas. O desempenho depende de
            fatores externos (mercado, criativo, público). Nossa responsabilidade
            limita-se ao valor pago pelo usuário nos últimos 30 dias.
          </p>

          <h2 className="text-xl font-semibold mt-6">8. Alterações</h2>
          <p>
            Podemos alterar estes Termos a qualquer tempo. Alterações relevantes serão
            comunicadas por e-mail com 15 dias de antecedência.
          </p>

          <h2 className="text-xl font-semibold mt-6">9. Foro</h2>
          <p>
            Fica eleito o foro da comarca do usuário para dirimir eventuais controvérsias
            decorrentes destes Termos, com renúncia a qualquer outro.
          </p>

          <p className="pt-6 text-xs text-muted-foreground">
            Ver também:{" "}
            <Link to="/privacidade" className="text-primary hover:underline">
              Política de Privacidade
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
