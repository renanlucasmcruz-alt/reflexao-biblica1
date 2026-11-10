import { CFG, json, getUser } from "./_lib.mjs";
/* Exclusão de conta (exigência da Google Play): apaga o usuário e, em cascata, todos os seus dados. */
export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });
  const user = await getUser(req); if (!user) return json(401, { error: "login" });
  const r = await fetch(`${CFG.SUPABASE_URL()}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: { apikey: CFG.SUPABASE_SERVICE_KEY(), authorization: `Bearer ${CFG.SUPABASE_SERVICE_KEY()}` } });
  return r.ok ? json(200, { ok: true }) : json(500, { error: "não foi possível excluir" });
};
export const config = { path: "/api/delete-account" };
