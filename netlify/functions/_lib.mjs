/* Variáveis de ambiente: Cloudflare (contexto da requisição), Netlify Edge ou Node. */
let RUNTIME_ENV = null;
export const setEnv = (e) => { RUNTIME_ENV = e || null; };
export const env = (k, d = "") => (RUNTIME_ENV && RUNTIME_ENV[k] != null ? String(RUNTIME_ENV[k]) : undefined) ?? (globalThis.Netlify?.env?.get?.(k)) ?? globalThis.process?.env?.[k] ?? d;
export const CFG = {
  SUPABASE_URL: () => env("SUPABASE_URL"),
  SUPABASE_ANON_KEY: () => env("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_KEY: () => env("SUPABASE_SERVICE_ROLE_KEY"),
  ANTHROPIC_KEY: () => env("ANTHROPIC_API_KEY"),
  FREE_DAILY: () => parseInt(env("FREE_DAILY_LIMIT", "5"), 10),
  SHARED_DAILY: (plan) => parseInt(env(plan === "pro" ? "PRO_SHARED_LIMIT" : "FREE_SHARED_LIMIT", plan === "pro" ? "200" : "40"), 10),
  PRO_PREMIUM: () => parseInt(env("PRO_PREMIUM_DAILY", "10"), 10),
  PRO_DAILY: () => parseInt(env("PRO_DAILY_LIMIT", "60"), 10),
  MODEL: (tier) => tier === "quick" ? env("MODEL_QUICK", "claude-haiku-5-5") : tier === "complex" ? env("MODEL_COMPLEX", "claude-sonnet-5-5") : env("MODEL_DEFAULT", "claude-sonnet-5-5"),
  PACKAGE: () => env("ANDROID_PACKAGE_NAME"),
  GOOGLE_SA: () => env("GOOGLE_SERVICE_ACCOUNT_JSON"),
  PRICE_LABEL: () => env("PRO_PRICE_LABEL", ""),
};
export const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export async function getUser(req) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const r = await fetch(`${CFG.SUPABASE_URL()}/auth/v1/user`, { headers: { authorization: auth, apikey: CFG.SUPABASE_ANON_KEY() } });
  if (!r.ok) return null;
  return r.json();
}
export async function sb(path, init = {}) {
  return fetch(`${CFG.SUPABASE_URL()}/rest/v1/${path}`, {
    ...init,
    headers: { ...svcHeaders(), "content-type": "application/json", ...(init.headers || {}) },
  });
}
export async function getPlan(userId) {
  const r = await sb(`profiles?id=eq.${userId}&select=plan,pro_until`);
  const [p] = r.ok ? await r.json() : [];
  return p && p.plan === "pro" && (!p.pro_until || new Date(p.pro_until) > new Date()) ? "pro" : "free";
}
/* Conta um uso e devolve false se o limite do dia já foi atingido. */
export async function takeQuota(userId, plan) {
  const r = await sb("rpc/take_quota", { method: "POST", body: JSON.stringify({ p_user: userId, p_limit: plan === "pro" ? CFG.PRO_DAILY() : CFG.FREE_DAILY() }) });
  if (!r.ok) return true; // se o contador falhar, não bloqueia o usuário
  return (await r.json()) === true;
}

// chaves novas (sb_secret_...) vão só no apikey; chaves antigas (JWT) também no Authorization
export function svcHeaders() { const k = CFG.SUPABASE_SERVICE_KEY(); return k.startsWith("sb_") ? { apikey: k } : { apikey: k, authorization: `Bearer ${k}` }; }

/* Contador separado para conteúdo compartilhado (capítulos, lições, reflexões...): abrir o que ainda
   não foi gerado não consome as perguntas do dia. Fica na tabela usage, numa "data" deslocada 200 anos. */
export async function takeSharedQuota(userId, plan) {
  const d = new Date(); const day = `${d.getUTCFullYear() + 200}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  try {
    const r = await sb(`usage?user_id=eq.${userId}&day=eq.${day}&select=count`);
    const [row] = r.ok ? await r.json() : []; const n = row ? row.count : 0;
    if (n >= CFG.SHARED_DAILY(plan)) return false;
    await sb("usage", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ user_id: userId, day, count: n + 1 }) });
  } catch (e) { /* se o contador falhar, não bloqueia */ }
  return true;
}

/* Quantas perguntas o usuário já fez hoje (contador principal). */
export async function usageToday(userId) {
  const d = new Date().toISOString().slice(0, 10);
  try { const r = await sb(`usage?user_id=eq.${userId}&day=eq.${d}&select=count`); const [row] = r.ok ? await r.json() : []; return row ? row.count : 0; }
  catch (e) { return 0; }
}
