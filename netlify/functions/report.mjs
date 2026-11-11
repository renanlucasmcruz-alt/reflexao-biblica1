import { CFG, json, getUser, sb, env } from "./_lib.mjs";
/* "Avisar problema": quando 2 pessoas diferentes avisam (ou o dono do app), o texto compartilhado é apagado
   e a próxima pessoa que abrir recebe uma versão nova, que passa a valer para todos. */
const OK = /^(ch_|intro_|ent_|tema_|rf_|ls_|qz_)[A-Za-z0-9_]{1,80}$/;
export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  const user = await getUser(req); if (!user) return json(401, { error: "login" });
  const { keys } = await req.json().catch(() => ({}));
  const list = (Array.isArray(keys) ? keys : []).filter((k) => OK.test(k || "")).slice(0, 3);
  if (!list.length) return json(400, { error: "inválido" });
  const need = Math.max(1, parseInt(env("REPORT_THRESHOLD", "2"), 10));
  const admins = env("ADMIN_EMAILS", "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  const isAdmin = !!user.email && admins.includes(user.email.toLowerCase());
  let replaced = false, count = 0;
  for (const key of list) {
    const r = await sb(`shared_content?key=eq.${encodeURIComponent(key)}&select=key`);
    const exists = r.ok && (await r.json()).length > 0;
    if (!exists) { if (key === list[0]) replaced = true; continue; }
    const rk = "rp_" + key.slice(0, 80);
    const q = await sb(`shared_content?key=eq.${encodeURIComponent(rk)}&select=value`);
    const [row] = q.ok ? await q.json() : [];
    const users = Array.isArray(row?.value?.u) ? row.value.u : [];
    if (!users.includes(user.id)) users.push(user.id);
    count = Math.max(count, users.length);
    if (isAdmin || users.length >= need) {
      await sb(`shared_content?key=eq.${encodeURIComponent(key)}`, { method: "DELETE" });
      await sb(`shared_content?key=eq.${encodeURIComponent(rk)}`, { method: "DELETE" });
      replaced = true;
    } else {
      await sb("shared_content", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key: rk, value: { u: users, at: new Date().toISOString() }, updated_by: user.id }) });
    }
  }
  return json(200, { ok: true, replaced, count, need });
};
export const config = { path: "/api/report" };
