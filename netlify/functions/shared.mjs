import { json, getUser, sb } from "./_lib.mjs";
/* Conteúdo compartilhado entre todos os usuários: capítulos traduzidos, introduções, verbetes e buscas por tema.
   Regra: nunca sobrescreve texto pronto; só completa o que estava faltando. */
const OK = /^(ch_|intro_|ent_|tema_)[A-Za-z0-9_]{1,80}$/;
export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  const user = await getUser(req); if (!user) return json(401, { error: "login" });
  const { key, value } = await req.json().catch(() => ({}));
  if (!OK.test(key || "") || !value || typeof value !== "object") return json(400, { error: "inválido" });
  if (JSON.stringify(value).length > 200000) return json(413, { error: "grande demais" });
  const r = await sb(`shared_content?key=eq.${encodeURIComponent(key)}&select=value`);
  const [cur] = r.ok ? await r.json() : [];
  let next = value;
  if (cur) {
    const old = cur.value || {}; next = { ...old };
    for (const [k, v] of Object.entries(value)) { if (old[k] == null || old[k] === "" ) next[k] = v; }
    if (key.startsWith("ch_") && old.complete === false && typeof value.text === "string" && value.text.length > (old.text || "").length && value.text.startsWith((old.text || "").slice(0, 200))) { next.text = value.text; next.complete = !!value.complete; }
    if (JSON.stringify(next) === JSON.stringify(old)) return json(409, { ok: true, unchanged: true });
  }
  const w = await sb("shared_content", { method: "POST", headers: { prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ key, value: next, updated_by: user.id }) });
  return w.ok ? json(200, { ok: true }) : json(500, { error: "db" });
};
export const config = { path: "/api/shared" };
