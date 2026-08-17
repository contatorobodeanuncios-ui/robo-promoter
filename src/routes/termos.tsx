import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/app/Logo";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Robô de Lucro" },
      { name: "description", content: "Termos e condições de uso da plataforma Robô de Lucro: planos, créditos, pagamentos, cancelamento e responsabilidades." },
      { property: "og:title", content: "Termos de Uso — Robô de Lucro" },
      { property: "og:description", content: "Condições contratuais para uso da plataforma de gestão automatizada de anúncios." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermosPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="text-xl font-semibold mt-6">{title}</h2>
      <div className="space-y-3">{children}</div>
    </>
  );
}

function TermosPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Logo size={28} />
        <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Voltar</Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold mb-2">Termos de Uso — Robô de Lucro</h1>
        <p className="text-sm text-muted-foreground mb-8">Última atualização: 17 de agosto de 2026</p>

        <section className="space-y-4 text-sm leading-relaxed">
          <Section title="1. Sobre o serviço">
            <p>
              O Robô de Lucro é um serviço de gestão automatizada de anúncios (Meta Ads/Facebook Ads).
              Ao criar uma conta ou usar o app, você ("cliente", "usuário") concorda com estes Termos de Uso.
            </p>
            <p>
              O cliente não conecta sua própria conta de anúncios — toda a veiculação é feita dentro das
              contas de anúncio administradas pela Plataforma. O cliente fornece criativo, copy, localização
              de veiculação (cidade, bairro e raio de até 199 km) e escolhe a quantidade de visualizações e
              dias de veiculação desejados. A Plataforma analisa o criativo (inclusive por IA), configura e
              opera a campanha. O cliente acompanha métricas reais assim que reportadas pelo Facebook/Pixel.
            </p>
          </Section>

          <Section title="2. Planos e créditos">
            <p>2.1 A Plataforma oferece dois planos: Créditos e Pro Max.</p>
            <p>
              2.2 No plano Créditos (e no Pro Max), 1 crédito equivale a 1 dia (24 horas) de veiculação. O
              preço de cada pacote é calculado com base na quantidade de dias e de visualizações escolhidas,
              exibido de forma clara antes da confirmação do pagamento. Créditos não utilizados não são
              reembolsados e expiram em 30 (trinta) dias corridos a contar da data da compra.
            </p>
            <p>
              2.3 Recursos do plano Pro Max: Copy Inteligente (refinamento de texto por IA), Suporte
              prioritário via WhatsApp, selo de prioridade nas filas de pagamento e execução de campanhas,
              download de relatório de campanha em formato de imagem, e a função Turbinar Alcance (exclusiva
              para assinantes Pro Max). A Seller School é uma plataforma de ensino atualmente em fase de
              lançamento, oferecida como bônus promocional aos assinantes Pro Max enquanto durar essa fase —
              não constitui parte obrigatória do pacote contratado e pode ser alterada, suspensa ou
              descontinuada a qualquer momento, sem impacto nos demais benefícios do plano.
            </p>
            <p>
              2.4 O cliente pode adquirir visualizações adicionais para uma campanha já existente (Turbinar
              Alcance) ou no momento da criação da campanha (ofertas promocionais exibidas durante o fluxo de
              compra), mediante pagamento adicional.
            </p>
          </Section>

          <Section title="3. Pagamentos">
            <p>3.1 Os pagamentos podem ser feitos via saldo pré-pago no app ou via PIX, conforme escolha do cliente.</p>
            <p>
              3.2 Ao adquirir um pacote, o cliente não está comprando um valor fixo de "orçamento de anúncio"
              no montante total pago. O valor pago é destinado a: (i) taxas de transferência bancária, (ii)
              taxas e encargos de imposto aplicáveis, (iii) taxa de serviço da própria Plataforma, e (iv)
              orçamento de veiculação repassado ao Meta Ads. A divisão entre essas partes fica a critério da
              gestão de tráfego realizada pelo administrador da Plataforma, podendo variar conforme a
              campanha. O cliente adquire créditos de visualização e de dias de veiculação — não um valor
              fixo e garantido de orçamento publicitário.
            </p>
            <p>
              3.3 Quando o pagamento é feito via PIX, o valor recebido não é integralmente destinado à
              campanha — parte é retida para as finalidades descritas na cláusula 3.2.
            </p>
          </Section>

          <Section title="4. Cancelamento e reembolso">
            <p>
              4.1 Valores pagos por campanhas (via saldo ou PIX) não são reembolsáveis, uma vez que parte é
              repassada à Meta para veiculação e as demais partes cobrem taxas bancárias, tributos e custos
              operacionais da Plataforma.
            </p>
            <p>
              4.2 Recargas de saldo do app não são reembolsáveis, em razão das taxas bancárias incidentes
              sobre a transação, que ficam a cargo da Plataforma.
            </p>
            <p>
              4.3 Exceção — Plano Pro Max: por ser adquirido por meio de checkout externo (Kiwify), a compra
              do plano Pro Max está sujeita ao direito de arrependimento previsto no art. 49 do Código de
              Defesa do Consumidor, podendo ser cancelada em até 7 (sete) dias corridos a contar da
              contratação, conforme as políticas de reembolso praticadas pela Kiwify.
            </p>
            <p>
              4.4 O cliente pode solicitar a pausa de uma campanha em andamento a qualquer momento pelo app.
              A pausa não implica em reembolso de valores já pagos.
            </p>
            <p>
              4.5 A Plataforma pode, por razões operacionais, pausar temporariamente o início de novas
              campanhas por período determinado, informando ao cliente o horário previsto de retomada, sem
              afetar campanhas já em veiculação.
            </p>
          </Section>

          <Section title="5. Responsabilidades do cliente">
            <p>
              O cliente declara que é titular ou possui autorização para uso do criativo, marca, copy e demais
              materiais enviados; que o conteúdo não viola direitos de terceiros, leis aplicáveis, nem as
              políticas de anúncios do Facebook/Meta; e que as informações fornecidas são verdadeiras e atuais.
            </p>
            <p>
              A Plataforma pode recusar, pausar ou remover qualquer campanha que viole estas condições ou as
              políticas do Meta Ads, sem reembolso do valor referente ao período não gerado por causa
              atribuível ao cliente.
            </p>
          </Section>

          <Section title="6. Isenção de garantia de resultado">
            <p>
              A Plataforma envida seus melhores esforços para entregar as métricas estimadas (visualizações,
              cliques) informadas no momento da contratação, dentro das faixas apresentadas. Resultados de
              negócio (vendas, conversões, retorno sobre investimento) dependem de fatores fora do controle da
              Plataforma e não são garantidos.
            </p>
          </Section>

          <Section title="7. Propriedade intelectual">
            <p>
              Os criativos, textos e demais materiais enviados pelo cliente permanecem de sua titularidade. Ao
              enviá-los, o cliente concede à Plataforma licença não exclusiva de uso exclusivamente na
              veiculação da campanha contratada. O software, marca, layout e demais elementos do Robô de Lucro
              são de titularidade da Plataforma e protegidos por lei.
            </p>
          </Section>

          <Section title="8. Suspensão e encerramento de conta">
            <p>
              A Plataforma pode suspender ou encerrar o acesso de um usuário em caso de descumprimento destes
              Termos, uso fraudulento, ou solicitação de reembolso indevida (chargeback) sem contato prévio
              com o suporte.
            </p>
          </Section>

          <Section title="9. Alterações nestes Termos">
            <p>
              Estes Termos podem ser atualizados a qualquer momento. Alterações relevantes serão comunicadas
              dentro do app ou por e-mail cadastrado, com antecedência razoável quando aplicável.
            </p>
          </Section>

          <Section title="10. Lei aplicável e foro">
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro do
              domicílio do consumidor para dirimir eventuais controvérsias, conforme legislação de defesa do
              consumidor aplicável.
            </p>
          </Section>

          <Section title="11. Contato">
            <p>
              Dúvidas sobre estes Termos podem ser enviadas para{" "}
              <a href="mailto:contato.robodelucro@gmail.com" className="text-primary">
                contato.robodelucro@gmail.com
              </a>{" "}
              ou pelo canal de suporte disponível dentro do app.
            </p>
          </Section>

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
