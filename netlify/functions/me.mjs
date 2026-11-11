import { CFG, json, getUser, getPlan, usageToday } from "./_lib.mjs";
/* Plano e uso do dia, para o app mostrar "x de 5 perguntas hoje". */
export default async (req) => {
  const user = await getUser(req); if (!user) return json(401, { error: "login" });
  const plan = await getPlan(user.id);
  const used = await usageToday(user.id);
  return json(200, { plan, used, limit: plan === "pro" ? CFG.PRO_DAILY() : CFG.FREE_DAILY() });
};
export const config = { path: "/api/me" };
