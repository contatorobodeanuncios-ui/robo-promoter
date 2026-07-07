import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Gera um comprovante em PDF (base64) para o cliente baixar.
// Usa pdf-lib (Worker-safe, sem binários nativos).
export const generateReceiptPDF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p, error } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .eq("id", data.payment_id)
      .maybeSingle();
    if (error || !p) throw new Error("Comprovante não encontrado");
    if (p.user_id !== context.userId) {
      // admin pode baixar qualquer um
      const email = ((context.claims as { email?: string })?.email ?? "").toLowerCase();
      if (email !== "prototipospremium@gmail.com") throw new Error("Forbidden");
    }
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email")
      .eq("id", p.user_id)
      .maybeSingle();

    // Import dinâmico: evita bundle no cliente
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const primary = rgb(0.13, 0.83, 0.81);
    const gray = rgb(0.35, 0.4, 0.48);
    const dark = rgb(0.05, 0.08, 0.14);

    // Header
    page.drawRectangle({ x: 0, y: 780, width: 595, height: 62, color: primary });
    page.drawText("Robô de Lucro Automático", { x: 40, y: 810, size: 20, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Comprovante de Pagamento", { x: 40, y: 792, size: 11, font, color: rgb(1, 1, 1) });

    let y = 740;
    const line = (label: string, value: string) => {
      page.drawText(label, { x: 40, y, size: 10, font, color: gray });
      page.drawText(value, { x: 200, y, size: 11, font: bold, color: dark });
      y -= 22;
    };

    line("Cliente:", prof?.display_name ?? "—");
    line("E-mail:", prof?.email ?? "—");
    line("Data:", new Date(p.approved_at ?? p.created_at).toLocaleString("pt-BR"));
    line("ID da transação:", p.id.slice(0, 8).toUpperCase());
    line("Referência Asaas:", p.asaas_payment_id ?? "—");
    y -= 10;
    line("Status:", p.status.toUpperCase());
    line("Valor pago:", `R$ ${Number(p.amount).toFixed(2).replace(".", ",")}`);

    y -= 20;
    page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.85, 0.87, 0.9) });
    y -= 30;
    page.drawText("Este comprovante confirma a adição de créditos na sua conta Robô de Lucro.", {
      x: 40, y, size: 9, font, color: gray,
    });
    y -= 14;
    page.drawText("Guarde este documento para seus registros. Pagamento processado via Asaas.", {
      x: 40, y, size: 9, font, color: gray,
    });

    // Footer
    page.drawText("robodelucros.lovable.app", { x: 40, y: 40, size: 9, font, color: gray });
    page.drawText(`Gerado em ${new Date().toLocaleString("pt-BR")}`, { x: 380, y: 40, size: 9, font, color: gray });

    const bytes = await doc.save();
    // to base64
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    return { pdf: base64, filename: `comprovante-${p.id.slice(0, 8)}.pdf` };
  });
