import { json, sb, getUser } from "./_lib.mjs";
/* Guarda (ou remove) a inscrição do lembrete diário. hour = hora UTC escolhida. */
export default async function pushSubHandler(req) {
  if (req.method !== "POST") return json(405, { error: "method" });
  const { endpoint, hour, off } = await req.json().catch(() => ({}));
  if (typeof endpoint !== "string" || !/^https:\/\/[^\s]{10,800}$/.test(endpoint)) return json(400, { error: "inválido" });
  if (off) { await sb(`push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE" }); return json(200, { ok: true }); }
  const h = parseInt(hour, 10); if (!(h >= 0 && h < 24)) return json(400, { error: "hora" });
  const user = await getUser(req).catch(() => null);
  const r = await sb("push_subs", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ endpoint, hour: h, user_id: user ? user.id : null }) });
  return r.ok ? json(200, { ok: true }) : json(500, { error: "db" });
}
export const config = { path: "/api/push-sub" };
