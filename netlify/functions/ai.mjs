import { CFG, json, getUser, getPlan, takeQuota } from "./_lib.mjs";

const MAX = { quick: 1500, default: 4000, complex: 8000 };

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  const user = await getUser(req);
  if (!user) return json(401, { error: "login" });
  let body; try { body = await req.json(); } catch { return json(400, { error: "json" }); }
  const tier = ["quick", "default", "complex"].includes(body.tier) ? body.tier : "default";
  const messages = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
  if (!messages.length) return json(400, { error: "messages" });
  const size = JSON.stringify(messages).length; if (size > 120000) return json(413, { error: "grande demais" });

  const plan = await getPlan(user.id);
  if (!(await takeQuota(user.id, plan))) {
    return json(402, { message: plan === "pro" ? "Você atingiu o limite de segurança de hoje. Volte amanhã." : `Você usou as ${CFG.FREE_DAILY()} consultas grátis de hoje. Assine o Pro para continuar sem limites.` });
  }

  // Imagens (opcional) vão no último turno do usuário.
  const msgs = messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }));
  if (Array.isArray(body.images) && body.images.length) {
    const last = msgs[msgs.length - 1];
    last.content = [...body.images.slice(0, 2).map((im) => ({ type: "image", source: { type: "base64", media_type: im.media_type || "image/jpeg", data: im.data } })), { type: "text", text: last.content }];
  }

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": CFG.ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: CFG.MODEL(tier), max_tokens: MAX[tier], stream: true, messages: msgs }),
  });
  if (!upstream.ok || !upstream.body) {
    const t = await upstream.text().catch(() => "");
    console.error("anthropic", upstream.status, t.slice(0, 500));
    return json(upstream.status === 429 ? 429 : 502, { error: "ia" });
  }

  // Converte o SSE da Anthropic em texto puro; no fim, envia \u0000STOP:<motivo>.
  const enc = new TextEncoder(), dec = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader(); let buf = "", stop = "end_turn";
      try {
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true });
          let i; while ((i = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
            const line = chunk.split("\n").find((l) => l.startsWith("data:")); if (!line) continue;
            let ev; try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
            if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") controller.enqueue(enc.encode(ev.delta.text));
            if (ev.type === "message_delta" && ev.delta?.stop_reason) stop = ev.delta.stop_reason;
            if (ev.type === "error") stop = "error";
          }
        }
      } catch (e) { stop = "error"; }
      controller.enqueue(enc.encode("\u0000STOP:" + stop)); controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
};
export const config = { path: "/api/ai" };
