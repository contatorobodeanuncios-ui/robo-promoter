// Mensagens genéricas para o usuário final. O detalhe técnico completo
// continua nos logs (console do servidor/navegador), nunca na tela.

const GENERIC = "Algo deu errado, tente novamente.";

// Mensagens seguras (não expõem banco/tabelas/stack) que podem passar direto.
const SAFE_PATTERNS: RegExp[] = [
  /invalid login credentials/i,
  /email not confirmed/i,
  /user already registered/i,
  /password should be/i,
  /muitas tentativas/i,
  /rate limit/i,
];

const TECHNICAL_PATTERNS: RegExp[] = [
  /relation .* does not exist/i,
  /column .* does not exist/i,
  /violates .* constraint/i,
  /duplicate key/i,
  /permission denied/i,
  /postgres|pgrst|supabase|jwt|sql|rls/i,
  /at .*\(.*:\d+:\d+\)/,
];

export function friendlyMessage(err: unknown, fallback = GENERIC): string {
  console.error("[app error]", err);
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!raw) return fallback;
  if (TECHNICAL_PATTERNS.some((re) => re.test(raw))) return fallback;
  if (SAFE_PATTERNS.some((re) => re.test(raw))) return raw;
  // Mensagens curtas e sem cara de erro técnico podem ser exibidas.
  return raw.length <= 120 && !/[{};]|\bError\b/.test(raw) ? raw : fallback;
}
