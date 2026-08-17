import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/app/Logo";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Robô de Lucro" },
      { name: "description", content: "Como o Robô de Lucro coleta, usa, armazena e protege seus dados pessoais conforme a LGPD." },
      { property: "og:title", content: "Política de Privacidade — Robô de Lucro" },
      { property: "og:description", content: "Como tratamos seus dados pessoais conforme a LGPD (Lei 13.709/2018)." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacidadePage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="text-xl font-semibold mt-6">{title}</h2>
      <div className="space-y-3">{children}</div>
    </>
  );
}

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Logo size={28} />
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Voltar</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold mb-2">Política de Privacidade — Robô de Lucro</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 17 de agosto de 2026</p>

        <section className="space-y-4 text-sm leading-relaxed">
          <Section title="1. Quem somos">
            <p>
              Esta Política de Privacidade descreve como o Robô de Lucro coleta, usa, armazena e protege os
              dados pessoais dos usuários do app, em conformidade com a Lei Geral de Proteção de Dados
              (Lei nº 13.709/2018 — LGPD).
            </p>
            <p>
              Contato para assuntos de privacidade e proteção de dados:{" "}
              <a href="mailto:contato.robodelucro@gmail.com" className="text-primary">
                contato.robodelucro@gmail.com
              </a>
            </p>
          </Section>

          <Section title="2. Dados que coletamos">
            <p>
              2.1 Dados fornecidos pelo usuário: nome, e-mail, telefone e demais dados de cadastro/login;
              dados de pagamento (processados por gateways terceiros — não armazenamos números completos de
              cartão); criativos enviados (imagens, vídeos), textos de anúncio, links de destino, informações
              de localização fornecidas para criação de campanhas; mensagens trocadas com o suporte.
            </p>
            <p>
              2.2 Dados coletados automaticamente: dados de uso e navegação no app (telas acessadas, botões
              clicados, tempo de permanência e horários de acesso); métricas de desempenho das campanhas
              reportadas pelo Facebook Marketing API e Pixel; dados técnicos do dispositivo (tipo de
              dispositivo, sistema operacional, endereço IP).
            </p>
          </Section>

          <Section title="3. Finalidade do tratamento">
            <p>
              Utilizamos os dados para: criar e gerenciar a conta do usuário; processar pagamentos e emitir
              cobranças; configurar, veicular e monitorar as campanhas contratadas; prestar suporte ao
              cliente; prevenir fraudes e uso indevido da Plataforma; cumprir obrigações legais; e melhorar a
              experiência do app.
            </p>
            <p>
              A base legal para o tratamento é a execução de contrato (art. 7º, V, LGPD), o cumprimento de
              obrigação legal (art. 7º, II) e, quando aplicável, o legítimo interesse (art. 7º, IX) para
              prevenção a fraudes e melhoria do serviço.
            </p>
          </Section>

          <Section title="4. Compartilhamento de dados">
            <p>
              Podemos compartilhar dados pessoais com: Meta/Facebook Ads, para veiculação das campanhas
              contratadas; gateways de pagamento, para processamento de transações; Kiwify, para contratação
              do plano Pro Max; provedores de infraestrutura (ex.: Supabase), para armazenamento seguro dos
              dados; e autoridades públicas, quando exigido por lei ou ordem judicial. Não vendemos dados
              pessoais a terceiros.
            </p>
          </Section>

          <Section title="5. Armazenamento e segurança">
            <p>
              Os dados são armazenados com controles de segurança técnica e administrativa, incluindo
              criptografia em trânsito (HTTPS), controle de acesso restrito por perfil (usuário comum vs.
              administrador), e armazenamento de criativos em bucket de acesso controlado (não público), com
              geração de links de acesso temporário quando necessário. Em caso de incidente de segurança que
              possa acarretar risco relevante aos titulares, comunicaremos os afetados e a Autoridade Nacional
              de Proteção de Dados (ANPD) conforme exigido pela LGPD.
            </p>
          </Section>

          <Section title="6. Retenção de dados">
            <p>
              Mantemos os dados pessoais pelo tempo necessário para cumprir as finalidades descritas nesta
              Política, ou pelo prazo exigido por obrigações legais, fiscais ou regulatórias, após o qual são
              eliminados ou anonimizados.
            </p>
          </Section>

          <Section title="7. Direitos do titular">
            <p>
              Nos termos da LGPD, o titular pode solicitar: confirmação da existência de tratamento; acesso
              aos dados; correção de dados incompletos, inexatos ou desatualizados; anonimização, bloqueio ou
              eliminação de dados desnecessários; portabilidade a outro fornecedor; eliminação dos dados
              tratados com base no consentimento; informação sobre compartilhamento; e revogação do
              consentimento, quando aplicável. Solicitações podem ser enviadas para{" "}
              <a href="mailto:contato.robodelucro@gmail.com" className="text-primary">
                contato.robodelucro@gmail.com
              </a>
              .
            </p>
          </Section>

          <Section title="8. Cookies e tecnologias similares">
            <p>
              O app pode utilizar cookies e tecnologias similares para manter a sessão do usuário, lembrar
              preferências e coletar dados de uso descritos na cláusula 2.2. O usuário pode gerenciar essas
              preferências nas configurações do navegador ou dispositivo, observando que a desativação pode
              afetar o funcionamento do app.
            </p>
          </Section>

          <Section title="9. Menores de idade">
            <p>
              O Robô de Lucro é destinado a maiores de 18 anos, por envolver contratação de serviços pagos e
              gestão de investimento em publicidade. Não coletamos intencionalmente dados de menores de idade.
            </p>
          </Section>

          <Section title="10. Alterações nesta Política">
            <p>
              Esta Política pode ser atualizada periodicamente. A versão vigente estará sempre disponível
              dentro do app, com indicação da data da última atualização.
            </p>
          </Section>

          <Section title="11. Contato">
            <p>
              Dúvidas ou solicitações relacionadas a esta Política podem ser enviadas para{" "}
              <a href="mailto:contato.robodelucro@gmail.com" className="text-primary">
                contato.robodelucro@gmail.com
              </a>{" "}
              ou pelo canal de suporte disponível dentro do app.
            </p>
          </Section>

          <p className="pt-6 text-xs text-muted-foreground">
            Ver também:{" "}
            <Link to="/termos" className="text-primary hover:underline">
              Termos de Uso
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
