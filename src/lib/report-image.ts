/** Gera um relatório em imagem (PNG) com a identidade visual do app. Client-only. */

interface ReportMetric {
  label: string;
  value: string;
}

export interface ReportData {
  campaignName: string;
  headline?: string;
  status: string;
  metrics: ReportMetric[];
  generatedAt?: Date;
}

const PRIMARY = "#7c5cff";
const ACCENT = "#22d3ee";
const GOLD = "#e6b422";
const BG = "#0b0b12";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function downloadReportImage(data: ReportData) {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Fundo
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Glow decorativo
  const g1 = ctx.createRadialGradient(120, 120, 0, 120, 120, 420);
  g1.addColorStop(0, "rgba(124,92,255,0.35)");
  g1.addColorStop(1, "rgba(124,92,255,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const g2 = ctx.createRadialGradient(W - 100, 260, 0, W - 100, 260, 380);
  g2.addColorStop(0, "rgba(34,211,238,0.28)");
  g2.addColorStop(1, "rgba(34,211,238,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // Grid sutil
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Cabeçalho / logo
  const logoGrad = ctx.createLinearGradient(60, 0, 220, 0);
  logoGrad.addColorStop(0, PRIMARY);
  logoGrad.addColorStop(1, ACCENT);
  ctx.fillStyle = logoGrad;
  roundRect(ctx, 60, 56, 56, 56, 16);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("R", 88, 86);

  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("Robô de Lucro", 132, 74);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "14px sans-serif";
  ctx.fillText("Relatório de desempenho da campanha", 132, 100);

  // Linha divisória
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(60, 148);
  ctx.lineTo(W - 60, 148);
  ctx.stroke();

  // Nome campanha
  ctx.fillStyle = "#fff";
  ctx.font = "bold 40px sans-serif";
  wrapText(ctx, data.campaignName, 60, 210, W - 120, 46);

  if (data.headline) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "18px sans-serif";
    ctx.fillText(data.headline, 60, 262);
  }

  // Tag de status
  ctx.fillStyle = "rgba(124,92,255,0.15)";
  const statusText = data.status;
  ctx.font = "bold 14px sans-serif";
  const tw = ctx.measureText(statusText).width;
  roundRect(ctx, 60, 284, tw + 32, 32, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(124,92,255,0.4)";
  ctx.stroke();
  ctx.fillStyle = PRIMARY;
  ctx.fillText(statusText, 76, 300);

  // Grid de métricas (cards)
  const startY = 350;
  const cols = 2;
  const gap = 20;
  const cardW = (W - 120 - gap * (cols - 1)) / cols;
  const cardH = 120;

  data.metrics.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 60 + col * (cardW + gap);
    const y = startY + row * (cardH + gap);

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, x, y, cardW, cardH, 18);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "14px sans-serif";
    ctx.fillText(m.label.toUpperCase(), x + 22, y + 34);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText(m.value, x + 22, y + 78);
  });

  // Rodapé
  const footerY = H - 90;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(60, footerY);
  ctx.lineTo(W - 60, footerY);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "13px sans-serif";
  const generated = (data.generatedAt ?? new Date()).toLocaleString("pt-BR");
  ctx.fillText(`Gerado em ${generated}`, 60, footerY + 30);

  ctx.fillStyle = GOLD;
  ctx.font = "bold 13px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Robô de Lucro · robodelucro.com", W - 60, footerY + 30);
  ctx.textAlign = "left";

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = data.campaignName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  a.download = `relatorio-${safeName}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = word;
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
}
