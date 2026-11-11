import { json, sb, CFG, env } from "./_lib.mjs";
/* Reflexão do dia para quem ainda não entrou na conta.
   Só gera se a reflexão compartilhada ainda não existir; teto diário global baixo para evitar abuso. */
const CAP = () => parseInt(env("DAILY_ANON_CAP", "6"), 10);
const store = (key, value) => sb("shared_content", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key, value }) });
export default async function dailyHandler(req) {
  if (req.method !== "POST") return json(405, { error: "method" });
  const { key, prompt } = await req.json().catch(() => ({}));
  if (!/^rf_[A-Za-z0-9_]{1,70}_s$/.test(key || "") || typeof prompt !== "string" || prompt.length > 6000 || !prompt.includes("REFLEXÃO DO DIA")) return json(400, { error: "inválido" });
  const ex = await sb(`shared_content?key=eq.${encodeURIComponent(key)}&select=value`);
  const [row] = ex.ok ? await ex.json() : [];
  if (row && row.value && row.value.text) return json(200, { text: row.value.text });
  const ck = "sys_daily_" + new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const c = await sb(`shared_content?key=eq.${ck}&select=value`);
  const [cr] = c.ok ? await c.json() : []; const n = (cr && cr.value && cr.value.n) || 0;
  if (n >= CAP()) return json(429, { error: "limite" });
  await store(ck, { n: n + 1 });
  const up = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": CFG.ANTHROPIC_KEY(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: CFG.MODEL("complex"), max_tokens: 1800, stream: true, messages: [{ role: "user", content: prompt }] }),
  });
  if (!up.ok || !up.body) return json(502, { error: "ia", status: up.status });
  // Repassa o SSE ao app e, ao terminar, guarda o texto para todos.
  let text = "", stop = "", buf = ""; const dec = new TextDecoder();
  const feed = (chunk) => { const line = chunk.split("\n").find((l) => l.startsWith("data:")); if (!line) return; try { const ev = JSON.parse(line.slice(5).trim());
      if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") text += ev.delta.text;
      else if (ev.type === "message_delta" && ev.delta?.stop_reason) stop = ev.delta.stop_reason; } catch {} };
  const ts = new TransformStream({
    transform(chunk, ctl) { ctl.enqueue(chunk); buf += dec.decode(chunk, { stream: true }).replace(/\r/g, ""); let i; while ((i = buf.indexOf("\n\n")) >= 0) { feed(buf.slice(0, i)); buf = buf.slice(i + 2); } },
    async flush() { if (buf.trim()) feed(buf); if (text && stop === "end_turn" && !/REFER[ÊE]NCIA INV[ÁA]LIDA/i.test(text)) { try { await store(key, { text }); } catch {} } },
  });
  return new Response(up.body.pipeThrough(ts), { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-rb-format": "sse" } });
}
export const config = { path: "/api/daily" };
