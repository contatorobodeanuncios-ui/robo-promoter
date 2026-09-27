/**
 * Converte o texto digitado pelo admin em um valor POSITIVO em reais.
 * Aceita "50", "50,00", "50.5", "1.234,56", "R$ 30". Qualquer "-" é ignorado:
 * a direção (somar/subtrair) nunca vem do texto. Retorna NaN se inválido.
 */
export function parsePositiveBRL(input: string): number {
  let s = input.replace(/[^\d.,]/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if ((s.match(/\./g) ?? []).length > 1) return NaN;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return NaN;
  return Math.round(n * 100) / 100;
}

export type BalanceOperation = "add" | "subtract" | "set_zero";

/** Mesma regra usada no servidor, exposta para testes. */
export function nextBalance(current: number, op: BalanceOperation, amount = 0): number {
  if (op === "set_zero") return 0;
  const abs = Math.abs(amount);
  const v = op === "subtract" ? current - abs : current + abs;
  return Math.round(v * 100) / 100;
}
