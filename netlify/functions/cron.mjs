import { json, sb, env } from "./_lib.mjs";
import { sendPush } from "./_push.mjs";
/* Chamado de hora em hora (GitHub Actions ou cron-job.org): envia o lembrete a quem escolheu esta hora. */
export default async function cronHandler(req) {
  const secret = env("CRON_SECRET"); const got = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("s");
  if (!secret || got !== secret) return json(401, { error: "secret" });
  const hour = new Date().getUTCHours();
  const r = await sb(`push_subs?hour=eq.${hour}&select=endpoint&limit=5000`);
  const subs = r.ok ? await r.json() : [];
  let ok = 0, gone = 0, fail = 0;
  for (let i = 0; i < subs.length; i += 20) {
    await Promise.all(subs.slice(i, i + 20).map(async ({ endpoint }) => {
      try { const p = await sendPush(endpoint);
        if (p.status === 404 || p.status === 410) { gone++; await sb(`push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE" }); }
        else if (p.ok) ok++; else fail++; } catch { fail++; }
    }));
  }
  return json(200, { hour, total: subs.length, ok, gone, fail });
}
export const config = { path: "/api/cron" };
