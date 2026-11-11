import { CFG, json, getUser, getPlan, takeQuota, takeSharedQuota, usageToday } from "./_lib.mjs";

/* Custo: grátis usa o Haiku (barato); Pro usa o modelo do nível pedido (Sonnet).
   Conteúdo compartilhado (tradução de capítulos, introduções, dicionário, interlinear...)
   é gerado uma vez e servido a todos, então sempre vai no modelo de maior qualidade. */
/* Pro: as primeiras PRO_PREMIUM_DAILY (10) perguntas do dia vão no modelo de maior qualidade;
   depois disso continua respondendo, no modelo econômico, até o limite diário. */
function pickModel(tier, plan, shared, usedToday) {
  if (shared) return CFG.MODEL("complex");
  if (plan === "pro" && usedToday <= CFG.PRO_PREMIUM()) return CFG.MODEL(tier);
  return CFG.MODEL("quick");
}

const MAX = { quick: 1500, default: 4000, complex: 8000 };

export default async function aiHandler(req) {
  try { return await handle(req); } catch (e) { console.error("ai crash", e); return json(500, { error: "server", detail: String(e && e.message || e).slice(0, 200) }); }
}

async function handle(req) {
  if (req.method !== "POST") return json(405, { error: "method" });
  const user = await getUser(req);
  if (!user) return json(401, { error: "login" });
  let body; try { body = await req.json(); } catch { return json(400, { error: "json" }); }
  const tier = ["quick", "default", "complex"].includes(body.tier) ? body.tier : "default";
  const messages = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
  if (!messages.length) return json(400, { error: "messages" });
  const size = JSON.stringify(messages).length; if (size > 120000) return json(413, { error: "grande demais" });

  const plan = await getPlan(user.id);
  const shared = body.shared === true;
  if (shared && !(await takeSharedQuota(user.id, plan))) {
    return json(402, { message: "Você abriu muitos conteúdos novos hoje. Volte amanhã ou assine o Pro." });
  }
  if (!shared && !(await takeQuota(user.id, plan))) {
    return json(402, { message: plan === "pro" ? "Você atingiu o limite de segurança de hoje. Volte amanhã." : `Você usou as ${CFG.FREE_DAILY()} consultas grátis de hoje. Assine o Pro para continuar sem limites.` });
  }

  const usedToday = (!shared && plan === "pro") ? await usageToday(user.id) : 0;

  // Imagens (opcional) vão no último turno do usuário.
  const msgs = messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }));
  if (Array.isArray(body.images) && body.images.length) {
    const last = msgs[msgs.length - 1];
    last.content = [...body.images.slice(0, 2).map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type || "image/jpeg", data: im.data } })), { type: "text", text: last.content }];
  }

  // Grátis: respostas mais enxutas (exceto conteúdo compartilhado, que serve a todos).
  const concise = !shared && plan !== "pro";
  const maxTokens = concise ? Math.min(MAX[tier], 2200) : MAX[tier];
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": CFG.ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: pickModel(tier, plan, shared, usedToday), max_tokens: maxTokens, stream: true, messages: msgs, ...(concise ? { system: "Responda de forma enxuta e direta: vá ao essencial, sem perder a precisão. Se o pedido exigir um formato fixo, siga o formato." } : {}) }),
  });
  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => "");
    console.error("anthropic", upstream.status, t.slice(0, 500));
    let detail = ""; try { detail = JSON.parse(t).error?.message || ""; } catch {}
    if (!CFG.ANTHROPIC_KEY()) detail = "ANTHROPIC_API_KEY não configurada";
    return json(upstream.status === 429 ? 429 : 502, { error: "ia", status: upstream.status, detail: ("Anthropic " + upstream.status + ": " + detail).slice(0, 240) });
  }

  // Repassa o SSE da Anthropic direto ao app (quase zero CPU no servidor; o app interpreta os eventos).
  return new Response(upstream.body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-rb-format": "sse" } });
}
export const config = { path: "/api/ai-fn" }; // a rota /api/ai é atendida pela Edge Function (sem o limite de 10 s)
